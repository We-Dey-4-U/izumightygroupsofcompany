const Expense = require("../models/Expense");
const Sale = require("../models/Sale");

/**
 * Calculate CIT (Corporate Income Tax)
 * @param {ObjectId} companyId
 * @param {Number} month
 * @param {Number} year
 * @param {Number} citRate
 */
async function calculateCIT(companyId, month, year, citRate = 0.3) {
  try {
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 1);

    // =========================
    // TOTAL SALES (INCOME)
    // =========================
    const salesResult = await Sale.aggregate([
      {
        $match: {
          companyId,
          createdAt: { $gte: startDate, $lt: endDate },
        },
      },
      {
        $group: {
          _id: null,
          totalIncome: { $sum: "$totalAmount" },
        },
      },
    ]);

    const totalIncome = salesResult[0]?.totalIncome || 0;

    // =========================
    // APPROVED ALLOWABLE EXPENSES
    // =========================
    const expenseResult = await Expense.aggregate([
      {
        $match: {
          companyId,
          status: "Approved",
          dateOfExpense: { $gte: startDate, $lt: endDate },
          "taxFlags.citAllowable": true,
          type: "Expense",
        },
      },
      {
        $group: {
          _id: null,
          totalExpenses: { $sum: "$amount" },
        },
      },
    ]);

    const totalExpenses = expenseResult[0]?.totalExpenses || 0;

    // =========================
    // NET PROFIT & CIT
    // =========================
    const netProfit = totalIncome - totalExpenses;
    const citDue = netProfit > 0 ? Number((netProfit * citRate).toFixed(2)) : 0;

    return {
      month,
      year,
      totalIncome,
      totalExpenses,
      netProfit,
      citRate,
      citDue,
      computedAt: new Date(),
    };
  } catch (error) {
    console.error("❌ [CIT CALCULATION ERROR]", error);
    throw error;
  }
}

module.exports = { calculateCIT };