require("dotenv").config();
const express = require("express");
const router = express.Router();
const multer = require("multer");
const axios = require("axios");
const FormData = require("form-data");
const { v4: uuidv4 } = require("uuid");
const { Expense } = require("../models/Expense");
const { auth, isAdmin } = require("../middleware/auth");

// ---------- Appwrite Setup Check ----------
(async () => {
  console.log("🧠 Checking Appwrite config for Expenses...");
  const { APPWRITE_ENDPOINT, APPWRITE_PROJECT_ID, APPWRITE_BUCKET_ID, APPWRITE_API_KEY } = process.env;

  if (!APPWRITE_ENDPOINT || !APPWRITE_PROJECT_ID || !APPWRITE_BUCKET_ID || !APPWRITE_API_KEY) {
    console.error("❌ Missing Appwrite env vars for Expense module!");
    return;
  }

  try {
    const res = await axios.get(
      `${APPWRITE_ENDPOINT}/storage/buckets/${APPWRITE_BUCKET_ID}`,
      {
        headers: {
          "X-Appwrite-Project": APPWRITE_PROJECT_ID,
          "X-Appwrite-Key": APPWRITE_API_KEY,
        },
      }
    );
    console.log("✅ Appwrite bucket OK for Expenses:", res.data.name || APPWRITE_BUCKET_ID);
  } catch (err) {
    console.error("❌ Appwrite check failed:", err.response?.data || err.message);
  }
})();

// ---------- Multer (Memory Storage) ----------
const upload = multer({ storage: multer.memoryStorage() });

// ---------- Helper: Upload to Appwrite ----------
async function uploadToAppwrite(file) {
  console.log("📤 Uploading to Appwrite:", file.originalname);

  const fileId = uuidv4();
  const formData = new FormData();
  formData.append("fileId", fileId);
  formData.append("file", file.buffer, {
    filename: file.originalname,
    contentType: file.mimetype,
    knownLength: file.size,
  });

  const url = `${process.env.APPWRITE_ENDPOINT}/storage/buckets/${process.env.APPWRITE_BUCKET_ID}/files`;

  try {
    const res = await axios.post(url, formData, {
      headers: {
        "X-Appwrite-Project": process.env.APPWRITE_PROJECT_ID,
        "X-Appwrite-Key": process.env.APPWRITE_API_KEY,
        ...formData.getHeaders(),
      },
      maxBodyLength: Infinity,
    });

    const imageUrl = `${process.env.APPWRITE_ENDPOINT}/storage/buckets/${process.env.APPWRITE_BUCKET_ID}/files/${res.data.$id}/view?project=${process.env.APPWRITE_PROJECT_ID}`;
    console.log("✅ Uploaded file:", imageUrl);
    return { id: res.data.$id, url: imageUrl };
  } catch (err) {
    console.error("❌ Appwrite upload failed:", err.response?.data || err.message);
    throw new Error("Appwrite upload failed");
  }
}

// ---------- CREATE EXPENSE ----------
router.post("/", auth, upload.array("receipts"), async (req, res) => {
  try {
    const {
      dateOfExpense,
      expenseCategory,
      description,
      purpose,
      paidTo,
      amount,
      type = "Expense",
      paymentMethod,
      department,
      approvedBy, // optional for staff
      status,     // default "Pending" for staff
    } = req.body;

    if (!dateOfExpense || !expenseCategory || !amount) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    // Upload receipts to Appwrite if any
    const receiptUploads = req.files?.length
      ? await Promise.all(req.files.map((file) => uploadToAppwrite(file)))
      : [];

    // ---------- Compute running balance ----------
    const lastRecord = await Expense.findOne().sort({ createdAt: -1 });
    const previousBalance = lastRecord ? lastRecord.balanceAfterTransaction : 0;
    const newBalance =
      type === "Expense"
        ? previousBalance - Number(amount)
        : previousBalance + Number(amount);

    // Create expense
    const expense = new Expense({
      dateOfExpense,
      expenseCategory,
      description,
      purpose,
      paidTo,
      amount: Number(amount),
      type,
      balanceAfterTransaction: newBalance,
      paymentMethod,
      department,
      enteredBy: req.user.name, // always from auth
      approvedBy: req.user.isAdmin ? approvedBy || "" : "", // only admin can pre-approve
      status: req.user.isAdmin ? status || "Pending" : "Pending",
      receiptUploads,
    });

    const saved = await expense.save();
    res.status(201).json(saved);
  } catch (error) {
    console.error("❌ [CREATE EXPENSE] Error:", error.message);
    res.status(500).json({ message: error.message });
  }
});

// ---------- GET ALL EXPENSES ----------
router.get("/", isAdmin, async (req, res) => {
  try {
    const expenses = await Expense.find().sort({ createdAt: -1 });
    res.status(200).json(expenses);
  } catch (error) {
    console.error("❌ [GET EXPENSES] Error:", error.message);
    res.status(500).json({ message: error.message });
  }
});

// ---------- GET SINGLE EXPENSE ----------
router.get("/:id", isAdmin, async (req, res) => {
  try {
    const expense = await Expense.findById(req.params.id);
    if (!expense) return res.status(404).json({ message: "Expense not found" });
    res.status(200).json(expense);
  } catch (error) {
    console.error("❌ [GET EXPENSE] Error:", error.message);
    res.status(500).json({ message: error.message });
  }
});

// ---------- UPDATE EXPENSE ----------
router.put("/:id", isAdmin, upload.array("receipts"), async (req, res) => {
  try {
    const existing = await Expense.findById(req.params.id);
    if (!existing) return res.status(404).json({ message: "Expense not found" });

    let receiptUploads = existing.receiptUploads;

    if (req.files && req.files.length > 0) {
      const newUploads = await Promise.all(req.files.map((f) => uploadToAppwrite(f)));
      receiptUploads = [...receiptUploads, ...newUploads];
    }

    Object.assign(existing, { ...req.body, receiptUploads });
    const updated = await existing.save();

    console.log("✅ [UPDATE EXPENSE] Updated:", updated._id);
    res.status(200).json(updated);
  } catch (error) {
    console.error("❌ [UPDATE EXPENSE] Error:", error.message);
    res.status(500).json({ message: error.message });
  }
});

// ---------- UPDATE EXPENSE STATUS ----------
router.patch("/:id/status", async (req, res) => {
  try {
    const { status } = req.body;
    if (!["Pending", "Approved", "Declined"].includes(status)) {
      return res.status(400).json({ message: "Invalid status value" });
    }

    const expense = await Expense.findById(req.params.id);
    if (!expense) return res.status(404).json({ message: "Expense not found" });

    expense.status = status;

    // Optionally record who approved
    if (status === "Approved") {
      expense.approvedBy = req.user?.name || "CEO"; // ensure req.user set via auth middleware
    }

    const updated = await expense.save();
    res.status(200).json(updated);
  } catch (error) {
    console.error("❌ [UPDATE STATUS] Error:", error.message);
    res.status(500).json({ message: error.message });
  }
});

// ---------- DELETE EXPENSE ----------
router.delete("/:id", isAdmin, async (req, res) => {
  try {
    const expense = await Expense.findById(req.params.id);
    if (!expense) return res.status(404).json({ message: "Expense not found" });

    // Delete receipts from Appwrite
    if (expense.receiptUploads?.length) {
      console.log(`🗑️ Deleting ${expense.receiptUploads.length} receipts from Appwrite...`);
      for (const file of expense.receiptUploads) {
        if (file.id) {
          try {
            await axios.delete(
              `${process.env.APPWRITE_ENDPOINT}/storage/buckets/${process.env.APPWRITE_BUCKET_ID}/files/${file.id}`,
              {
                headers: {
                  "X-Appwrite-Project": process.env.APPWRITE_PROJECT_ID,
                  "X-Appwrite-Key": process.env.APPWRITE_API_KEY,
                },
              }
            );
            console.log(`✅ Deleted Appwrite file: ${file.id}`);
          } catch (err) {
            console.warn(`⚠️ Failed to delete Appwrite file ${file.id}:`, err.message);
          }
        }
      }
    }

    const deleted = await Expense.findByIdAndDelete(req.params.id);
    console.log("✅ [DELETE EXPENSE] Deleted:", deleted._id);
    res.status(200).json(deleted);
  } catch (error) {
    console.error("❌ [DELETE EXPENSE] Error:", error.message);
    res.status(500).json({ message: error.message });
  }
});

// ---------- MONTHLY SUMMARY ----------
router.get("/summary/monthly", isAdmin, async (req, res) => {
  try {
    const summary = await Expense.aggregate([
      {
        $group: {
          _id: { $month: "$dateOfExpense" },
          totalAmount: { $sum: "$amount" },
        },
      },
      { $sort: { "_id": 1 } },
    ]);

    // Format amounts in Naira
    const formattedSummary = summary.map(item => ({
      month: item._id,
      totalAmount: `₦${item.totalAmount.toLocaleString("en-NG")}`, // ✅ Naira formatting
    }));

    res.status(200).json(formattedSummary);
  } catch (error) {
    console.error("❌ [MONTHLY SUMMARY] Error:", error.message);
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;