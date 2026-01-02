const express = require("express");
const router = express.Router();

const LedgerEntry = require("../models/LedgerEntry");
const Expense = require("../models/Expense");

const { auth } = require("../middleware/auth");

/* =====================================================
   1️⃣ CURRENT BALANCE (ADMIN + STAKEHOLDER)
   ===================================================== */
router.get("/balance", auth, async (req, res) => {
  if (!req.user.isAdmin && !req.user.isSuperStakeholder) {
    return res.status(403).json({ message: "Access denied" });
  }

  try {
    const result = await Expense.aggregate([
      {
        $match: {
          companyId: req.user.companyId,
          status: "Approved",
        },
      },
      {
        $group: {
          _id: null,
          totalIncome: {
            $sum: { $cond: [{ $eq: ["$type", "Income"] }, "$amount", 0] },
          },
          totalExpense: {
            $sum: { $cond: [{ $eq: ["$type", "Expense"] }, "$amount", 0] },
          },
        },
      },
      {
        $project: {
          _id: 0,
          balance: { $subtract: ["$totalIncome", "$totalExpense"] },
          totalIncome: 1,
          totalExpense: 1,
        },
      },
    ]);

    res.json(result[0] || { balance: 0, totalIncome: 0, totalExpense: 0 });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message });
  }
});

/* =====================================================
   2️⃣ LEDGER – READ ONLY (ADMIN + STAKEHOLDER)
   GET /api/finance/ledger
   ===================================================== */
router.get("/ledger", auth, async (req, res) => {
  if (!req.user.isAdmin && !req.user.isSuperStakeholder) {
    return res.status(403).json({ message: "Access denied" });
  }

  try {
    const { companyId } = req.user;
    const { page = 1, limit = 50, account, source, journalId, from, to } = req.query;

    const query = { companyId };
    if (account) query.account = account;
    if (source) query.source = source;
    if (journalId) query.journalId = journalId;
    if (from || to) {
      query.createdAt = {};
      if (from) query.createdAt.$gte = new Date(from);
      if (to) query.createdAt.$lte = new Date(to);
    }

    const ledger = await LedgerEntry.find(query)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(Number(limit))
      .populate("createdBy", "name email")
      .lean();

    const total = await LedgerEntry.countDocuments(query);

    res.json({
      page: Number(page),
      limit: Number(limit),
      total,
      data: ledger,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to fetch ledger" });
  }
});

/* =====================================================
   3️⃣ LEDGER GROUPED BY JOURNAL (ADMIN + STAKEHOLDER)
   GET /api/finance/ledger/journals
   ===================================================== */
router.get("/ledger/journals", auth, async (req, res) => {
  if (!req.user.isAdmin && !req.user.isSuperStakeholder) {
    return res.status(403).json({ message: "Access denied" });
  }

  try {
    const { companyId } = req.user;

    const journals = await LedgerEntry.aggregate([
      { $match: { companyId } },
      {
        $group: {
          _id: "$journalId",
          entries: { $push: "$$ROOT" },
          date: { $first: "$createdAt" },
          debitTotal: {
            $sum: { $cond: [{ $eq: ["$entryType", "debit"] }, "$amount", 0] },
          },
          creditTotal: {
            $sum: { $cond: [{ $eq: ["$entryType", "credit"] }, "$amount", 0] },
          },
        },
      },
      { $sort: { date: -1 } },
    ]);

    res.json(journals);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to fetch journals" });
  }
});

module.exports = router;