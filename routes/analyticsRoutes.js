// routes/analyticsRoutes.js
const express = require("express");
const router = express.Router();
const moment = require("moment");
const { auth, isAdmin, isStaff, isSuperStakeholder,isSubAdmin } = require("../middleware/auth");

// ✅ Import models properl
const { Report } = require("../models/Report");
const  Expense  = require("../models/Expense");
const Attendance = require("../models/Attendance");
const { User } = require("../models/user");
const { Product } = require("../models/product");
const Payroll = require("../models/Payroll");
const EmployeeInfo = require("../models/EmployeeInfo");
const Sale = require("../models/Sale");   // ✅ Add Sale model

// -----------------------------
// 2️⃣ ALL-TIME OVERVIEW (Totals)
// -----------------------------
const InventoryProduct = require("../models/InventoryProduct"); // ✅ new model
const Order = require("../models/order");


// -----------------------------
// WEEKLY REPORT SUBMISSION RATE
// -----------------------------
// WEEKLY REPORT SUBMISSION RATE
// WEEKLY REPORT SUBMISSION RATE (Company Isolated)
// -----------------------------
// 1️⃣ REPORTS SUMMARY (Weekly)
// -----------------------------
router.get("/reports-summary", auth, async (req, res) => {
  if (!req.user.isAdmin && !req.user.isSubAdmin && !req.user.isSuperStakeholder) {
    return res.status(403).json({ message: "Access denied" });
  }

  try {
    const startOfWeek = moment().startOf("isoWeek").toDate();
    const endOfWeek = moment().endOf("isoWeek").toDate();

    // Get all users in the same company
    const usersInCompany = await User.find({ company: req.user.company }).select("_id");
    const companyUserIds = usersInCompany.map(u => u._id);

    const totalStaff = await User.countDocuments({ _id: { $in: companyUserIds }, isStaff: true });

    const submittedReports = await Report.find({
      weekEnding: { $gte: startOfWeek, $lte: endOfWeek },
      submittedBy: { $in: companyUserIds }
    });

    const submittedCount = submittedReports.length;
    const pendingCount = totalStaff - submittedCount;
    const submissionRate = totalStaff > 0 ? ((submittedCount / totalStaff) * 100).toFixed(2) : 0;

    // Top department
    const topDept = await Report.aggregate([
      { $match: { weekEnding: { $gte: startOfWeek, $lte: endOfWeek }, submittedBy: { $in: companyUserIds } } },
      { $group: { _id: "$department", avgPerformance: { 
          $avg: { 
            $switch: { 
              branches: [
                { case: { $eq: ["$performanceRating", "Excellent"] }, then: 4 },
                { case: { $eq: ["$performanceRating", "Good"] }, then: 3 },
                { case: { $eq: ["$performanceRating", "Fair"] }, then: 2 },
                { case: { $eq: ["$performanceRating", "Poor"] }, then: 1 }
              ],
              default: 0
            }
          }
        } 
      }},
      { $sort: { avgPerformance: -1 } },
      { $limit: 1 }
    ]);

    res.status(200).json({
      totalStaff,
      submittedCount,
      pendingCount,
      submissionRate: Number(submissionRate),
      topDepartment: topDept[0]?._id || "N/A",
    });

  } catch (err) {
    console.error("❌ Reports Summary Error:", err.message);
    res.status(500).json({ message: err.message });
  }
});

// -----------------------------
// EMPLOYEE SUMMARY
// -----------------------------

// -----------------------------
// 2️⃣ EMPLOYEE SUMMARY
// -----------------------------
router.get("/employee-summary", auth, async (req, res) => {
  if (!req.user.isAdmin && !req.user.isSubAdmin && !req.user.isSuperStakeholder) {
    return res.status(403).json({ message: "Access denied" });
  }

  try {
    const usersInCompany = await User.find({ company: req.user.company }).select("_id");
    const companyUserIds = usersInCompany.map(u => u._id);

    const filteredEmployees = await EmployeeInfo.find({ user: { $in: companyUserIds } })
      .populate("user", "company");

    const totalEmployees = filteredEmployees.length;
    const activeEmployees = filteredEmployees.filter(e => e.employment?.status === "Active").length;
    const inactiveEmployees = totalEmployees - activeEmployees;

    const departmentMap = {};
    filteredEmployees.forEach(emp => {
      const dept = emp.employment?.department || "Unassigned";
      departmentMap[dept] = (departmentMap[dept] || 0) + 1;
    });

    const byDepartment = Object.keys(departmentMap).map(d => ({ department: d, count: departmentMap[d] }))
      .sort((a, b) => b.count - a.count);

    res.status(200).json({ totalEmployees, activeEmployees, inactiveEmployees, byDepartment });

  } catch (err) {
    console.error("❌ Employee Summary Error:", err.message);
    res.status(500).json({ message: err.message });
  }
});


// -----------------------------
// PAYROLL SUMMARY
// -----------------------------
// -----------------------------
// 3️⃣ PAYROLL SUMMARY (Monthly)
// -----------------------------
router.get("/payroll-summary", auth, async (req, res) => {
  if (!req.user.isAdmin && !req.user.isSuperStakeholder) return res.status(403).json({ message: "Access denied" });

  try {
    const startOfMonth = moment().startOf("month").toDate();
    const endOfMonth = moment().endOf("month").toDate();

    const usersInCompany = await User.find({ company: req.user.company }).select("_id");
    const companyUserIds = usersInCompany.map(u => u._id);

    const payrolls = await Payroll.aggregate([
      { $match: { employeeId: { $in: companyUserIds }, createdAt: { $gte: startOfMonth, $lte: endOfMonth } } },
      { $group: {
          _id: null,
          totalGross: { $sum: "$grossSalary" },
          totalNet: { $sum: "$netPay" },
          totalTaxDeducted: { $sum: { $add: ["$taxDeduction", "$pensionDeduction", "$otherDeductions"] } },
          employeeCount: { $addToSet: "$employeeId" }
        }
      }
    ]);

    const data = payrolls[0] || { totalGross: 0, totalNet: 0, totalTaxDeducted: 0, employeeCount: [] };

    res.status(200).json({
      totalGross: data.totalGross,
      totalNet: data.totalNet,
      totalTaxDeducted: data.totalTaxDeducted,
      totalEmployeesPaid: data.employeeCount.length,
    });
  } catch (err) {
    console.error("❌ Payroll Summary Error:", err.message);
    res.status(500).json({ message: err.message });
  }
});

// -----------------------------
// 4️⃣ ALL-TIME SUMMARY (Users, Products, Sales)
// -----------------------------
router.get("/alltime-summary", auth, async (req, res) => {
  if (!req.user.isAdmin && !req.user.isSubAdmin && !req.user.isSuperStakeholder) return res.status(403).json({ message: "Access denied" });

  try {
    const company = req.user.company;
    const prevDate = moment().startOf("month").toDate();

    const usersInCompany = await User.find({ company }).select("_id");
    const userIds = usersInCompany.map(u => u._id);

    const [totalUsers, prevUsers, totalProducts, prevProducts] = await Promise.all([
      User.countDocuments({ _id: { $in: userIds } }),
      User.countDocuments({ _id: { $in: userIds }, createdAt: { $lt: prevDate } }),
      InventoryProduct.countDocuments({ createdBy: { $in: userIds } }),
      InventoryProduct.countDocuments({ createdBy: { $in: userIds }, createdAt: { $lt: prevDate } })
    ]);

    const salesAgg = await Sale.aggregate([{ $match: { company } }, { $group: { _id: null, totalEarnings: { $sum: "$totalAmount" } } }]);
    const prevSalesAgg = await Sale.aggregate([{ $match: { company, createdAt: { $lt: prevDate } } }, { $group: { _id: null, prevEarnings: { $sum: "$totalAmount" } } }]);

    res.status(200).json({
      users: totalUsers || 0,
      products: totalProducts || 0,
      earnings: salesAgg[0]?.totalEarnings || 0,
      prevUsers: prevUsers || 0,
      prevProducts: prevProducts || 0,
      prevEarnings: prevSalesAgg[0]?.prevEarnings || 0,
    });

  } catch (err) {
    console.error("❌ All-time Summary Error:", err.message);
    res.status(500).json({ message: err.message });
  }
});

// -----------------------------
// 3️⃣ ATTENDANCE SUMMARY (Weekly)
// -----------------------------
router.get("/attendance-summary", auth, async (req, res) => {
  // Allow ONLY admin, subadmin, or super stakeholder
  if (!req.user.isAdmin && !req.user.isSubAdmin && !req.user.isSuperStakeholder) {
    return res.status(403).json({ message: "Access denied" });
  }

  console.log("📌 [GET /analytics/attendance-summary] Requested by:", req.user?.email);

  try {
    const startOfWeek = moment().startOf("isoWeek");
    const attendanceTrend = [];

    // Get dynamic total staff count
    const totalStaff = await User.countDocuments({ isStaff: true });

    for (let i = 0; i < 7; i++) {
      const day = moment(startOfWeek).add(i, "days").format("YYYY-MM-DD");
      const records = await Attendance.find({ date: day });

      const present = records.filter((r) => r.timeIn).length;
      const absent = totalStaff - present; // dynamic based on actual staff
      const late = records.filter((r) => moment(r.timeIn).hour() > 9).length;

      attendanceTrend.push({ date: day, present, absent, late });
    }

    res.status(200).json({ weeklyTrend: attendanceTrend });
  } catch (error) {
    console.error("❌ Attendance Summary Error:", error.message);
    res.status(500).json({ message: error.message });
  }
});

// -----------------------------
// 4️⃣ EXPENSES SUMMARY
// -----------------------------
// -----------------------------
// -----------------------------
// EXPENSE SUMMARY (Weekly / Monthly)
// -----------------------------
router.get("/expenses-summary", auth, async (req, res) => {
  if (!req.user.isAdmin && !req.user.isSuperStakeholder) {
    return res.status(403).json({ message: "Access denied" });
  }

  try {
    const startOfWeek = moment().startOf("isoWeek").toDate();
    const endOfWeek = moment().endOf("isoWeek").toDate();
    const startOfMonth = moment().startOf("month").toDate();
    const endOfMonth = moment().endOf("month").toDate();

    const [
      weeklyExpense,
      weeklyIncome,
      monthlyExpense,
      monthlyIncome,
      monthlyBalanceAgg,
      topCategories,
    ] = await Promise.all([
      // Weekly Expense
      Expense.aggregate([
        {
          $match: {
            companyId: req.user.companyId,
            type: "Expense",
            dateOfExpense: { $gte: startOfWeek, $lte: endOfWeek },
          },
        },
        { $group: { _id: null, totalAmount: { $sum: "$amount" } } },
      ]),

      // Weekly Income
      Expense.aggregate([
        {
          $match: {
            companyId: req.user.companyId,
            type: "Income",
            dateOfExpense: { $gte: startOfWeek, $lte: endOfWeek },
          },
        },
        { $group: { _id: null, totalAmount: { $sum: "$amount" } } },
      ]),

      // Monthly Expense
      Expense.aggregate([
        {
          $match: {
            companyId: req.user.companyId,
            type: "Expense",
            dateOfExpense: { $gte: startOfMonth, $lte: endOfMonth },
          },
        },
        { $group: { _id: null, totalAmount: { $sum: "$amount" } } },
      ]),

      // Monthly Income
      Expense.aggregate([
        {
          $match: {
            companyId: req.user.companyId,
            type: "Income",
            dateOfExpense: { $gte: startOfMonth, $lte: endOfMonth },
          },
        },
        { $group: { _id: null, totalAmount: { $sum: "$amount" } } },
      ]),

      // ✅ MONTHLY BALANCE — FIXED (PRODUCTION SAFE)
      Expense.aggregate([
        {
          $match: {
            companyId: req.user.companyId,
            $or: [
              {
                dateOfExpense: {
                  $gte: startOfMonth,
                  $lte: endOfMonth,
                },
              },
              {
                createdAt: {
                  $gte: startOfMonth,
                  $lte: endOfMonth,
                },
              },
            ],
          },
        },
        {
          $group: {
            _id: null,
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
          $project: {
            _id: 0,
            balance: {
              $subtract: ["$totalIncome", "$totalExpense"],
            },
          },
        },
      ]),

      // Top Categories
      Expense.aggregate([
        {
          $match: {
            companyId: req.user.companyId,
            dateOfExpense: { $gte: startOfMonth, $lte: endOfMonth },
          },
        },
        {
          $group: {
            _id: "$expenseCategory",
            total: { $sum: "$amount" },
          },
        },
        { $sort: { total: -1 } },
        { $limit: 5 },
      ]),
    ]);

    res.status(200).json({
      weeklyExpenses: weeklyExpense[0]?.totalAmount || 0,
      weeklyIncome: weeklyIncome[0]?.totalAmount || 0,
      monthlyExpenses: monthlyExpense[0]?.totalAmount || 0,
      monthlyIncome: monthlyIncome[0]?.totalAmount || 0,

      // ✅ GUARANTEED NUMBER (PRODUCTION + LOCAL)
      monthlyBalance:
        typeof monthlyBalanceAgg[0]?.balance === "number"
          ? monthlyBalanceAgg[0].balance
          : 0,

      topCategories: topCategories.map((c) => ({
        category: c._id,
        total: c.total,
      })),
    });
  } catch (err) {
    console.error("❌ Expenses Summary Error:", err.message);
    res.status(500).json({ message: err.message });
  }
});
// -----------------------------
// 5️⃣ STAFF PERFORMANCE TREND
// -----------------------------
// -----------------------------
// 7️⃣ PERFORMANCE TREND (Last 6 Weeks)
// -----------------------------
router.get("/performance-trend", auth, async (req, res) => {
  if (!req.user.isAdmin && !req.user.isSubAdmin && !req.user.isSuperStakeholder) {
    return res.status(403).json({ message: "Access denied" });
  }

  try {
    const last6Weeks = [];

    for (let i = 5; i >= 0; i--) {
      const start = moment().subtract(i, "weeks").startOf("isoWeek").toDate();
      const end = moment().subtract(i, "weeks").endOf("isoWeek").toDate();

      // Get reports for this company only
      const reports = await Report.find({
        weekEnding: { $gte: start, $lte: end },
      }).populate("submittedBy", "company");

      const companyReports = reports.filter(
        r => r.submittedBy?.company === req.user.company
      );

      const avgScore =
        companyReports.length > 0
          ? companyReports.reduce((sum, r) => {
              switch (r.performanceRating) {
                case "Excellent": return sum + 4;
                case "Good": return sum + 3;
                case "Fair": return sum + 2;
                case "Poor": return sum + 1;
                default: return sum;
              }
            }, 0) / companyReports.length
          : 0;

      last6Weeks.push({
        week: moment(start).format("MMM D"),
        avgPerformance: avgScore,
      });
    }

    res.status(200).json(last6Weeks);

  } catch (err) {
    console.error("❌ Performance Trend Error:", err.message);
    res.status(500).json({ message: err.message });
  }
});

// -----------------------------
// 6️⃣ WEEKLY EARNINGS (Last 7 Days)
// -----------------------------

// -----------------------------
// 6️⃣ SALES WEEKLY EARNINGS
// -----------------------------
router.get("/week-earnings", auth, async (req, res) => {
  if (!req.user.isAdmin && !req.user.isSuperStakeholder) return res.status(403).json({ message: "Access denied" });

  try {
    const startOfWeek = moment().startOf("isoWeek").toDate();
    const endOfWeek = moment().endOf("isoWeek").toDate();

    const earnings = await Sale.aggregate([
      { $match: { company: req.user.company, createdAt: { $gte: startOfWeek, $lte: endOfWeek } } },
      { $group: { _id: { $dayOfWeek: "$createdAt" }, total: { $sum: "$totalAmount" } } },
      { $sort: { _id: 1 } }
    ]);

    res.status(200).json(earnings.map(e => ({ day: e._id, total: e.total })));
  } catch (err) {
    console.error("❌ Week Earnings Error:", err.message);
    res.status(500).json({ message: err.message });
  }
});
// -----------------------------
// 7️⃣ EXPENSE CATEGORY ANALYTICS (Super Stakeholder)
// -----------------------------
router.get("/expenses-category-analytics", auth, async (req, res) => {
  // Allow ONLY admin or super stakeholder
  if (!req.user.isAdmin && !req.user.isSuperStakeholder) {
    return res.status(403).json({ message: "Access denied" });
  }

  console.log("📌 [GET /analytics/expenses-category-analytics] Requested by:", req.user?.email);

  try {
    // 🔥 1. Get all user IDs in the same company
    const usersInCompany = await User.find({ company: req.user.company }).select("_id");
    const companyUserIds = usersInCompany.map(u => u._id);

    // 🔥 2. Aggregate ONLY this company's expenses
    const summary = await Expense.aggregate([
      {
        $match: {
          enteredByUser: { $in: companyUserIds }, // COMPANY ISOLATION
        }
      },
      {
        $group: {
          _id: "$expenseCategory",
          totalAmount: { $sum: "$amount" },
          count: { $sum: 1 }
        }
      },
      { $sort: { totalAmount: -1 } }
    ]);

    res.status(200).json(
      summary.map((s) => ({
        category: s._id,
        totalAmount: s.totalAmount,
        count: s.count,
      }))
    );
  } catch (err) {
    console.error("❌ [CATEGORY ANALYTICS] Error:", err.message);
    res.status(500).json({ message: err.message });
  }
});


// -----------------------------
// 8️⃣ TOP PERFORMING SALES / PRODUCTS (Company Isolated)
// -----------------------------
router.get("/top-sales-products", auth, async (req, res) => {
  if (!req.user.isAdmin && !req.user.isSubAdmin && !req.user.isSuperStakeholder) {
    return res.status(403).json({ message: "Access denied" });
  }

  try {
    const startOfMonth = moment().startOf("month").toDate();
    const endOfMonth = moment().endOf("month").toDate();

    // 🔹 Top products by quantity sold this month (company isolated)
    const topProducts = await InventoryProduct.aggregate([
      { $match: { createdBy: { $exists: true }, company: req.user.company } },
      { $sort: { itemsSold: -1 } },
      { $limit: 5 },
      { $project: { name: 1, productModel: 1, itemsSold: 1 } }
    ]);

    // 🔹 Top sales by totalAmount this month (company isolated)
    const topSales = await Sale.aggregate([
      { $match: { company: req.user.company, createdAt: { $gte: startOfMonth, $lte: endOfMonth } } },
      { $sort: { totalAmount: -1 } },
      { $limit: 5 },
      { $project: { saleId: 1, customerName: 1, totalAmount: 1, createdAt: 1 } }
    ]);

    res.status(200).json({ topProducts, topSales });

  } catch (err) {
    console.error("❌ Top Sales/Products Error:", err.message);
    res.status(500).json({ message: err.message });
  }
});


// -----------------------------
// 8️⃣ SALES TOTAL ANALYTICS (Sum)
// -----------------------------


module.exports = router;