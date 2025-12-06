require("dotenv").config();
const express = require("express");
const router = express.Router();
const multer = require("multer");
const axios = require("axios");
const FormData = require("form-data");
const { v4: uuidv4 } = require("uuid");
const { Expense } = require("../models/Expense");
const { auth, isAdmin, isSuperStakeholder } = require("../middleware/auth");
const { User } = require("../models/user");

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

// ---------- Upload Helper ----------
async function uploadToAppwrite(file) {
  const fileId = uuidv4();
  const formData = new FormData();
  formData.append("fileId", fileId);
  formData.append("file", file.buffer, {
    filename: file.originalname,
    contentType: file.mimetype,
    knownLength: file.size,
  });

  try {
    const res = await axios.post(
      `${process.env.APPWRITE_ENDPOINT}/storage/buckets/${process.env.APPWRITE_BUCKET_ID}/files`,
      formData,
      {
        headers: {
          "X-Appwrite-Project": process.env.APPWRITE_PROJECT_ID,
          "X-Appwrite-Key": process.env.APPWRITE_API_KEY,
          ...formData.getHeaders(),
        },
        maxBodyLength: Infinity,
      }
    );

    const imageUrl = `${process.env.APPWRITE_ENDPOINT}/storage/buckets/${process.env.APPWRITE_BUCKET_ID}/files/${res.data.$id}/view?project=${process.env.APPWRITE_PROJECT_ID}`;
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
      paidTo,
      amount,
      type = "Expense",
      paymentMethod,
      department,
      approvedBy,
      status,
    } = req.body;

    if (!dateOfExpense || !expenseCategory || !amount) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    const receiptUploads = req.files?.length
      ? await Promise.all(req.files.map((file) => uploadToAppwrite(file)))
      : [];

    // Get previous balance for this user's company
    const usersInCompany = await User.find({ company: req.user.company }).select("_id");
    const lastRecord = await Expense.findOne({ enteredByUser: { $in: usersInCompany } })
      .sort({ createdAt: -1 });

    const previousBalance = lastRecord ? lastRecord.balanceAfterTransaction : 0;
    const newBalance =
      type === "Expense"
        ? previousBalance - Number(amount)
        : previousBalance + Number(amount);

    const expense = new Expense({
      dateOfExpense,
      expenseCategory,
      description,
      paidTo,
      amount: Number(amount),
      type,
      balanceAfterTransaction: newBalance,
      paymentMethod,
      department,
      enteredByUser: req.user._id,
      approvedBy: req.user.isAdmin ? approvedBy || "" : "",
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
router.get("/", auth, async (req, res) => {
  if (!req.user.isAdmin && !req.user.isSuperStakeholder) {
    return res.status(403).json({ message: "Access denied" });
  }

  try {
    const usersInCompany = await User.find({ company: req.user.company }).select("_id");

    const expenses = await Expense.find({ enteredByUser: { $in: usersInCompany } })
      .populate("enteredByUser", "name company")
      .sort({ createdAt: -1 });

    res.status(200).json(expenses);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// ---------- GET SINGLE EXPENSE ----------
router.get("/:id", auth, async (req, res) => {
  try {
    const expense = await Expense.findById(req.params.id).populate("enteredByUser", "company");
    if (!expense) return res.status(404).json({ message: "Expense not found" });

    if (expense.enteredByUser.company !== req.user.company) {
      return res.status(403).json({ message: "Access denied" });
    }

    res.status(200).json(expense);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// ---------- UPDATE EXPENSE ----------
router.put("/:id", auth, upload.array("receipts"), async (req, res) => {
  try {
    const existing = await Expense.findById(req.params.id).populate("enteredByUser", "company");
    if (!existing) return res.status(404).json({ message: "Expense not found" });
    if (existing.enteredByUser.company !== req.user.company) return res.status(403).json({ message: "Access denied" });

    let receiptUploads = existing.receiptUploads;
    if (req.files?.length) {
      const newUploads = await Promise.all(req.files.map((f) => uploadToAppwrite(f)));
      receiptUploads = [...receiptUploads, ...newUploads];
    }

    Object.assign(existing, { ...req.body, receiptUploads });
    const updated = await existing.save();
    res.status(200).json(updated);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// ---------- UPDATE STATUS ----------
router.patch("/:id/status", auth, async (req, res) => {
  try {
    const { status } = req.body;
    if (!["Pending", "Approved", "Declined"].includes(status)) {
      return res.status(400).json({ message: "Invalid status value" });
    }

    const expense = await Expense.findById(req.params.id).populate("enteredByUser", "company");
    if (!expense) return res.status(404).json({ message: "Expense not found" });
    if (expense.enteredByUser.company !== req.user.company) return res.status(403).json({ message: "Access denied" });

    if (status === "Approved" && !req.user.isSuperStakeholder) {
      return res.status(403).json({ message: "Only SuperStakeholder can approve expenses" });
    }
    if (status === "Declined" && !req.user.isAdmin && !req.user.isSuperStakeholder) {
      return res.status(403).json({ message: "Not authorized to decline expenses" });
    }

    expense.status = status;
    if (["Approved", "Declined"].includes(status)) {
      expense.approvedBy = req.user.name;
    }

    const updated = await expense.save();
    res.status(200).json(updated);
  } catch (error) {
    console.error("❌ [UPDATE EXPENSE STATUS] Error:", error.message);
    res.status(500).json({ message: error.message });
  }
});

// ---------- DELETE EXPENSE ----------
router.delete("/:id", auth, async (req, res) => {
  try {
    const expense = await Expense.findById(req.params.id).populate("enteredByUser", "company");
    if (!expense) return res.status(404).json({ message: "Expense not found" });
    if (expense.enteredByUser.company !== req.user.company) return res.status(403).json({ message: "Access denied" });

    if (expense.receiptUploads?.length) {
      for (const file of expense.receiptUploads) {
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
        } catch {}
      }
    }

    const deleted = await Expense.findByIdAndDelete(req.params.id);
    res.status(200).json(deleted);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// ---------- MONTHLY SUMMARY ----------
router.get("/summary/monthly", auth, async (req, res) => {
  try {
    const summary = await Expense.aggregate([
      {
        $lookup: {
          from: "users",
          localField: "enteredByUser",
          foreignField: "_id",
          as: "user",
        },
      },
      { $unwind: "$user" },
      { $match: { "user.company": req.user.company } },
      {
        $group: {
          _id: { $month: "$dateOfExpense" },
          totalAmount: { $sum: "$amount" },
        },
      },
      { $sort: { "_id": 1 } },
    ]);

    const formatted = summary.map((item) => ({
      month: item._id,
      totalAmount: `₦${item.totalAmount.toLocaleString("en-NG")}`,
    }));

    res.status(200).json(formatted);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;