require("dotenv").config();
const express = require("express");
const router = express.Router();
const multer = require("multer");
const axios = require("axios");
const FormData = require("form-data");
const { v4: uuidv4 } = require("uuid");
const Joi = require("joi");
const  Expense  = require("../models/Expense");
const { auth, isAdmin, isSuperStakeholder } = require("../middleware/auth");
const { User } = require("../models/user");
//const { processExpenseTax } = require("../utils/processExpenseTax");
const { updateCompanyTaxFromExpenses } = require("../utils/companyTaxUpdater");

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
      { headers: { "X-Appwrite-Project": APPWRITE_PROJECT_ID, "X-Appwrite-Key": APPWRITE_API_KEY } }
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
      { headers: { "X-Appwrite-Project": process.env.APPWRITE_PROJECT_ID, "X-Appwrite-Key": process.env.APPWRITE_API_KEY, ...formData.getHeaders() }, maxBodyLength: Infinity }
    );
    return { id: res.data.$id, url: `${process.env.APPWRITE_ENDPOINT}/storage/buckets/${process.env.APPWRITE_BUCKET_ID}/files/${res.data.$id}/view?project=${process.env.APPWRITE_PROJECT_ID}` };
  } catch (err) {
    console.error("❌ Appwrite upload failed:", err.response?.data || err.message);
    throw new Error("Appwrite upload failed");
  }
}

// ---------- CREATE EXPENSE ----------
// ---------------------------
// CREATE EXPENSE
// ---------------------------
router.post("/", auth, upload.array("receipts"), async (req, res) => {
  try {
    // ---------- Validation ----------
    const schema = Joi.object({
      dateOfExpense: Joi.date().required(),
      expenseCategory: Joi.string().max(100).required(),
      description: Joi.string().max(500).allow(""),
      paidTo: Joi.string().max(200).allow(""),
      amount: Joi.number().min(0).required(),
      type: Joi.string().valid("Income", "Expense").default("Expense"),
      paymentMethod: Joi.string().max(50).allow(""),
      department: Joi.string().max(100).allow(""),
      approvedBy: Joi.string().max(200).allow(""),
      status: Joi.string().valid("Pending", "Approved", "Declined"),
      taxFlags: Joi.object({
        vatClaimable: Joi.boolean().default(false),
        whtApplicable: Joi.boolean().default(false),
        citAllowable: Joi.boolean().default(true),
      }).default({}),
      whtRate: Joi.number().min(0).max(1).default(0),
    });

    const { error, value } = schema.validate(req.body, { stripUnknown: true });
    if (error) return res.status(400).json({ message: error.details[0].message });

    const {
      dateOfExpense,
      expenseCategory,
      description,
      paidTo,
      amount,
      type,
      paymentMethod,
      department,
      approvedBy,
      status,
      taxFlags,
      whtRate,
    } = value;

    // ---------- Upload receipts ----------
    const receiptUploads = req.files?.length
      ? await Promise.all(req.files.map(uploadToAppwrite))
      : [];

    // ---------- Ledger balance ----------
    const lastRecord = await Expense.findOne({ companyId: req.user.companyId }).sort({ createdAt: -1 });
    const previousBalance = lastRecord ? lastRecord.balanceAfterTransaction : 0;
    const newBalance = type === "Expense" ? previousBalance - amount : previousBalance + amount;

    // ---------- Create Expense ----------
    const expense = new Expense({
      companyId: req.user.companyId,
      dateOfExpense,
      expenseCategory,
      description,
      paidTo,
      amount,
      type,
      balanceAfterTransaction: newBalance,
      paymentMethod,
      department,
      enteredByUser: req.user._id,
      approvedBy: req.user.isAdmin ? approvedBy || "" : "",
      status: req.user.isAdmin ? status || "Pending" : "Pending",
      receiptUploads,
      taxFlags,
      whtRate,
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
  if (!req.user.isAdmin && !req.user.isSuperStakeholder) return res.status(403).json({ message: "Access denied" });

  try {
    const expenses = await Expense.find({ companyId: req.user.companyId })
      .populate("enteredByUser", "name company companyId")
      .sort({ createdAt: -1 });
    res.status(200).json(expenses);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// ---------- GET SINGLE EXPENSE ----------
router.get("/:id", auth, async (req, res) => {
  try {
    const expense = await Expense.findById(req.params.id)
      .populate("enteredByUser", "company companyId");
    if (!expense) return res.status(404).json({ message: "Expense not found" });

    if (expense.companyId.toString() !== req.user.companyId.toString()) return res.status(403).json({ message: "Access denied" });

    res.status(200).json(expense);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// ---------- UPDATE EXPENSE ----------
// ---------------------------
// UPDATE EXPENSE
// ---------------------------
router.put("/:id", auth, upload.array("receipts"), async (req, res) => {
  try {
    const existing = await Expense.findById(req.params.id);
    if (!existing) return res.status(404).json({ message: "Expense not found" });

    if (existing.companyId.toString() !== req.user.companyId.toString())
      return res.status(403).json({ message: "Access denied" });

    // ---------- Validation ----------
    const schema = Joi.object({
      dateOfExpense: Joi.date(),
      expenseCategory: Joi.string().max(100),
      description: Joi.string().max(500).allow(""),
      paidTo: Joi.string().max(200).allow(""),
      amount: Joi.number().min(0),
      type: Joi.string().valid("Income", "Expense"),
      paymentMethod: Joi.string().max(50).allow(""),
      department: Joi.string().max(100).allow(""),
      approvedBy: Joi.string().max(200).allow(""),
      status: Joi.string().valid("Pending", "Approved", "Declined"),
      taxFlags: Joi.object({
        vatClaimable: Joi.boolean(),
        whtApplicable: Joi.boolean(),
        citAllowable: Joi.boolean(),
      }),
      whtRate: Joi.number().min(0).max(1),
    });

    const { error, value } = schema.validate(req.body, { stripUnknown: true });
    if (error) return res.status(400).json({ message: error.details[0].message });

    // ---------- Handle new uploads ----------
    let receiptUploads = existing.receiptUploads;
    if (req.files?.length) {
      const newUploads = await Promise.all(req.files.map(uploadToAppwrite));
      receiptUploads = [...receiptUploads, ...newUploads];
    }

    Object.assign(existing, { ...value, receiptUploads });
    const updated = await existing.save();
    res.status(200).json(updated);

  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});


// ---------- UPDATE EXPENSE STATUS ----------
// ---------------------------
// UPDATE EXPENSE STATUS
// ---------------------------
router.patch("/:id/status", auth, async (req, res) => {
  try {
    // ---------- Validation ----------
    const schema = Joi.object({
      status: Joi.string().valid("Pending", "Approved", "Declined").required(),
    });

    const { error, value } = schema.validate(req.body, { stripUnknown: true });
    if (error) return res.status(400).json({ message: error.details[0].message });

    const { status } = value;

    const expense = await Expense.findById(req.params.id);
    if (!expense) return res.status(404).json({ message: "Expense not found" });

    if (expense.companyId.toString() !== req.user.companyId.toString())
      return res.status(403).json({ message: "Access denied" });

    if (status === "Approved" && !req.user.isSuperStakeholder)
      return res.status(403).json({ message: "Only SuperStakeholder can approve expenses" });

    if (status === "Declined" && !req.user.isAdmin && !req.user.isSuperStakeholder)
      return res.status(403).json({ message: "Not authorized to decline expenses" });

    expense.status = status;
    if (["Approved", "Declined"].includes(status)) expense.approvedBy = req.user.name;

    // Compute VAT/WHT and update ledger if approved
    if (status === "Approved") {
      const { taxFlags = {} } = expense;
      if (taxFlags.vatClaimable) expense.vatAmount = +(expense.amount * 0.075).toFixed(2);
      if (taxFlags.whtApplicable) expense.whtAmount = +(expense.amount * (expense.whtRate || 0)).toFixed(2);

      await expense.save();
      await updateCompanyTaxFromExpenses(expense);
    } else {
      await expense.save();
    }

    res.status(200).json(expense);

  } catch (error) {
    console.error("❌ [UPDATE EXPENSE STATUS] Error:", error);
    res.status(500).json({ message: error.message });
  }
});



// ---------- DELETE EXPENSE ----------
// ---------- DELETE EXPENSE ----------
router.delete("/:id", auth, async (req, res) => {
try {
const expense = await Expense.findById(req.params.id);
if (!expense) return res.status(404).json({ message: "Expense not found" });


if (expense.receiptUploads?.length) {
for (const file of expense.receiptUploads) {
try {
await axios.delete(`${process.env.APPWRITE_ENDPOINT}/storage/buckets/${process.env.APPWRITE_BUCKET_ID}/files/${file.id}`, { headers: { "X-Appwrite-Project": process.env.APPWRITE_PROJECT_ID, "X-Appwrite-Key": process.env.APPWRITE_API_KEY } });
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
      { $match: { companyId: req.user.companyId } },
      { $group: { _id: { $month: "$dateOfExpense" }, totalAmount: { $sum: "$amount" } } },
      { $sort: { "_id": 1 } },
    ]);

    const formatted = summary.map(item => ({ month: item._id, totalAmount: `₦${item.totalAmount.toLocaleString("en-NG")}` }));
    res.status(200).json(formatted);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});


// ---------- MONTHLY BALANCE (Income - Expense) ----------
// ---------- MONTHLY BALANCE (Income - Expense) ----------
router.get("/summary/monthly-balance", auth, async (req, res) => {
  console.log("🟢 [MONTHLY BALANCE] Request received");

  try {
    // ==========================
    // AUTH / USER CONTEXT
    // ==========================
    console.log("👤 User Info:", {
      userId: req.user?._id,
      companyId: req.user?.companyId,
      role: req.user?.role,
    });

    if (!req.user?.companyId) {
      console.warn("⚠️ Missing companyId on user");
      return res.status(400).json({ message: "Missing companyId" });
    }

    // ==========================
    // BASIC DATA CHECK
    // ==========================
    const totalApproved = await Expense.countDocuments({
      companyId: req.user.companyId,
      status: "Approved",
    });

    console.log("📊 Approved expenses count:", totalApproved);

    if (totalApproved === 0) {
      console.warn("⚠️ No approved expenses found");
    }

    // ==========================
    // SAMPLE DOCUMENT CHECK
    // ==========================
    const sampleDoc = await Expense.findOne({
      companyId: req.user.companyId,
      status: "Approved",
    }).lean();

    console.log("📄 Sample Approved Expense:", sampleDoc);

    // ==========================
    // AGGREGATION PIPELINE
    // ==========================
    const pipeline = [
      {
        $match: {
          companyId: req.user.companyId,
          status: "Approved",
          $or: [
            { dateOfExpense: { $ne: null } },
            { createdAt: { $ne: null } },
          ],
        },
      },

      // Pick usable date
      {
        $addFields: {
          effectiveDate: {
            $cond: [
              { $ifNull: ["$dateOfExpense", false] },
              "$dateOfExpense",
              "$createdAt",
            ],
          },
        },
      },

      // Validate effectiveDate
      {
        $match: {
          effectiveDate: { $ne: null },
        },
      },

      {
        $group: {
          _id: {
            year: { $year: "$effectiveDate" },
            month: { $month: "$effectiveDate" },
          },
          totalIncome: {
            $sum: {
              $cond: [{ $eq: ["$type", "Income"] }, "$amount", 0],
            },
          },
          totalExpense: {
            $sum: {
              $cond: [{ $eq: ["$type", "Expense"] }, "$amount", 0],
            },
          },
        },
      },

      {
        $addFields: {
          balance: { $subtract: ["$totalIncome", "$totalExpense"] },
        },
      },

      { $sort: { "_id.year": 1, "_id.month": 1 } },

      {
        $project: {
          _id: 0,
          year: "$_id.year",
          month: "$_id.month",
          totalIncome: 1,
          totalExpense: 1,
          balance: 1,
        },
      },
    ];

    console.log("🧪 Aggregation Pipeline:", JSON.stringify(pipeline, null, 2));

    // ==========================
    // RUN AGGREGATION
    // ==========================
    const result = await Expense.aggregate(pipeline);

    console.log("✅ Monthly Balance Aggregation Result:");
    console.table(result);

    if (!result || result.length === 0) {
      console.warn("⚠️ Aggregation returned EMPTY result set");
    }

    return res.status(200).json(result);
  } catch (error) {
    console.error("❌ Monthly Balance FAILED");
    console.error("Message:", error.message);
    console.error("Stack:", error.stack);

    return res.status(500).json({
      message: "Monthly balance aggregation failed",
      error: error.message,
    });
  }
});

module.exports = router;