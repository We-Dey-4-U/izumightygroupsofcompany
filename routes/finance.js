const express = require("express");
const router = express.Router();
const Expense = require("../models/Expense");
const { auth } = require("../middleware/auth");

// ---------- CURRENT BALANCE ----------
router.get("/balance", auth, async (req, res) => {
  try {
    const result = await Expense.aggregate([
      { $match: { companyId: req.user.companyId, status: "Approved" } },
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

    res.json(
      result[0] || { balance: 0, totalIncome: 0, totalExpense: 0 }
    );
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;