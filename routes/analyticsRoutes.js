// routes/analyticsRoutes.js
const express = require("express");
const router = express.Router();
const moment = require("moment");
const { auth, isAdmin, isStaff, isSuperStakeholder,isSubAdmin } = require("../middleware/auth");

// ✅ Import models properl
const { Report } = require("../models/Report");
const { Expense } = require("../models/Expense");
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
router.get("/reports-summary", auth, async (req, res) => {
  // Allow ONLY admin, subadmin, or super stakeholder
  if (
    !req.user.isAdmin &&
    !req.user.isSubAdmin &&
    !req.user.isSuperStakeholder
  ) {
    return res.status(403).json({ message: "Access denied" });
  }

  console.log("📌 [GET /analytics/reports-summary] Requested by:", req.user?.email);

  try {
    const startOfWeek = moment().startOf("isoWeek").toDate();
    const endOfWeek = moment().endOf("isoWeek").toDate();

    const totalStaff = await User.countDocuments({ isStaff: true });

    const submittedReports = await Report.find({
      weekEnding: { $gte: startOfWeek, $lte: endOfWeek },
    });

    const submittedCount = submittedReports.length;
    const pendingCount = totalStaff - submittedCount;

    const submissionRate =
      totalStaff > 0
        ? ((submittedCount / totalStaff) * 100).toFixed(2)
        : 0;

    // Top department by average performance
    const topDept = await Report.aggregate([
      { $match: { weekEnding: { $gte: startOfWeek, $lte: endOfWeek } } },
      {
        $group: {
          _id: "$department",
          avgPerformance: {
            $avg: {
              $switch: {
                branches: [
                  { case: { $eq: ["$performanceRating", "Excellent"] }, then: 4 },
                  { case: { $eq: ["$performanceRating", "Good"] }, then: 3 },
                  { case: { $eq: ["$performanceRating", "Fair"] }, then: 2 },
                  { case: { $eq: ["$performanceRating", "Poor"] }, then: 1 },
                ],
                default: 0,
              },
            },
          },
        },
      },
      { $sort: { avgPerformance: -1 } },
      { $limit: 1 },
    ]);

    res.status(200).json({
      totalStaff,
      submittedCount,
      pendingCount,
      submissionRate: Number(submissionRate),
      topDepartment: topDept[0]?._id || "N/A",
    });
  } catch (error) {
    console.error("❌ Reports Summary Error:", error.message);
    res.status(500).json({ message: error.message });
  }
});


// -----------------------------
// EMPLOYEE SUMMARY
// -----------------------------
router.get("/employee-summary", auth, async (req, res) => {
  // Allow ONLY admin, subadmin, or super stakeholder
  if (
    !req.user.isAdmin &&
    !req.user.isSubAdmin &&
    !req.user.isSuperStakeholder
  ) {
    return res.status(403).json({ message: "Access denied" });
  }

  console.log("📌 [GET /analytics/employee-summary] Requested by:", req.user?.email);

  try {
    // Total employees
    const totalEmployees = await EmployeeInfo.countDocuments();

    // Optional: breakdown by department
    const byDepartment = await EmployeeInfo.aggregate([
      { $group: { _id: "$employment.department", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]);

    // Optional: active vs inactive staff (assuming 'status' field exists)
    const activeEmployees = await EmployeeInfo.countDocuments({ "employment.status": "Active" });
    const inactiveEmployees = totalEmployees - activeEmployees;

    res.status(200).json({
      totalEmployees,
      activeEmployees,
      inactiveEmployees,
      byDepartment,
    });
  } catch (error) {
    console.error("❌ Employee Summary Error:", error.message);
    res.status(500).json({ message: error.message });
  }
});



// -----------------------------
// PAYROLL SUMMARY
// -----------------------------
router.get("/payroll-summary", auth, async (req, res) => {
  // Allow ONLY admin, subadmin, or super stakeholder
  if (
    !req.user.isAdmin &&
    !req.user.isSubAdmin &&
    !req.user.isSuperStakeholder
  ) {
    return res.status(403).json({ message: "Access denied" });
  }

  console.log("📌 [GET /analytics/payroll-summary] Requested by:", req.user?.email);

  try {
    const startOfMonth = moment().startOf("month").toDate();
    const endOfMonth = moment().endOf("month").toDate();

    // Aggregate payroll for the current month
    const payrolls = await Payroll.aggregate([
      { $match: { createdAt: { $gte: startOfMonth, $lte: endOfMonth } } },
      {
        $group: {
          _id: null,
          totalGross: { $sum: "$grossSalary" },
          totalNet: { $sum: "$netPay" },
          avgNetPay: { $avg: "$netPay" },
          employeeCount: { $addToSet: "$employeeId" }, // unique employees
        },
      },
    ]);

    const data = payrolls[0] || {
      totalGross: 0,
      totalNet: 0,
      avgNetPay: 0,
      employeeCount: [],
    };

    res.status(200).json({
      totalGross: data.totalGross,
      totalNet: data.totalNet,
      avgNetPay: data.avgNetPay,
      totalEmployeesPaid: data.employeeCount.length,
    });
  } catch (error) {
    console.error("❌ Payroll Summary Error:", error.message);
    res.status(500).json({ message: error.message });
  }
});


// -----------------------------
// 2️⃣ ALL-TIME OVERVIEW (Totals)
// ----------------------------


router.get("/alltime-summary", auth, async (req, res) => {
  // Allow ONLY admin, subadmin, or super stakeholder
  if (
    !req.user.isAdmin &&
    !req.user.isSubAdmin &&
    !req.user.isSuperStakeholder
  ) {
    return res.status(403).json({ message: "Access denied" });
  }

  console.log("📌 [GET /analytics/alltime-summary] Requested by:", req.user?.email);

  try {
    // Fetch totals in parallel
    const [totalUsers, totalProducts, totalOrders, totalEarnings] = await Promise.all([
      User.countDocuments({}),
      InventoryProduct.countDocuments({}), // ✅ Use InventoryProduct
      Order.countDocuments({}),
      Order.aggregate([{ $group: { _id: null, total: { $sum: "$total" } } }]),
    ]);

    // Previous totals (previous month)
    const startPrevMonth = moment().subtract(1, "month").startOf("month").toDate();
    const endPrevMonth = moment().subtract(1, "month").endOf("month").toDate();

    const [prevUsers, prevProducts, prevOrders, prevEarnings] = await Promise.all([
      User.countDocuments({ createdAt: { $lt: moment().startOf("month").toDate() } }),
      InventoryProduct.countDocuments({ createdAt: { $lt: moment().startOf("month").toDate() } }),
      Order.countDocuments({ createdAt: { $lt: moment().startOf("month").toDate() } }),
      Order.aggregate([
        { $match: { createdAt: { $lt: moment().startOf("month").toDate() } } },
        { $group: { _id: null, total: { $sum: "$total" } } },
      ]),
    ]);

    res.status(200).json({
      users: totalUsers || 0,
      prevUsers: prevUsers || 0,
      products: totalProducts || 0,
      prevProducts: prevProducts || 0,
      orders: totalOrders || 0,
      prevOrders: prevOrders || 0,
      earnings: totalEarnings[0]?.total || 0,
      prevEarnings: prevEarnings[0]?.total || 0,
    });
  } catch (error) {
    console.error("❌ All-time summary error:", error.message);
    res.status(500).json({ message: error.message });
  }
});



// -----------------------------
// 3️⃣ ATTENDANCE SUMMARY (Weekly)
// -----------------------------
router.get("/attendance-summary", auth, async (req, res) => {
  // Allow ONLY admin, subadmin, or super stakeholder
  if (
    !req.user.isAdmin &&
    !req.user.isSubAdmin &&
    !req.user.isSuperStakeholder
  ) {
    return res.status(403).json({ message: "Access denied" });
  }

  console.log("📌 [GET /analytics/attendance-summary] Requested by:", req.user?.email);

  try {
    const startOfWeek = moment().startOf("isoWeek");
    const attendanceTrend = [];

    for (let i = 0; i < 7; i++) {
      const day = moment(startOfWeek).add(i, "days").format("YYYY-MM-DD");
      const records = await Attendance.find({ date: day });

      const present = records.filter((r) => r.timeIn).length;
      const absent = 50 - present; // assuming 50 staff total
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
router.get("/expenses-summary", auth, async (req, res) => {
  // Allow ONLY admin, subadmin, or super stakeholder
  if (
    !req.user.isAdmin &&
    !req.user.isSubAdmin &&
    !req.user.isSuperStakeholder
  ) {
    return res.status(403).json({ message: "Access denied" });
  }

  console.log("📌 [GET /analytics/expenses-summary] Requested by:", req.user?.email);

  try {
    const startOfWeek = moment().startOf("isoWeek").toDate();
    const endOfWeek = moment().endOf("isoWeek").toDate();
    const startOfMonth = moment().startOf("month").toDate();
    const endOfMonth = moment().endOf("month").toDate();

    const [weeklyExpense, weeklyIncome, monthlyExpense, monthlyIncome, topCategories] =
      await Promise.all([
        Expense.aggregate([
          { $match: { dateOfExpense: { $gte: startOfWeek, $lte: endOfWeek }, type: "Expense" } },
          { $group: { _id: null, totalAmount: { $sum: "$amount" } } },
        ]),
        Expense.aggregate([
          { $match: { dateOfExpense: { $gte: startOfWeek, $lte: endOfWeek }, type: "Income" } },
          { $group: { _id: null, totalAmount: { $sum: "$amount" } } },
        ]),
        Expense.aggregate([
          { $match: { dateOfExpense: { $gte: startOfMonth, $lte: endOfMonth }, type: "Expense" } },
          { $group: { _id: null, totalAmount: { $sum: "$amount" } } },
        ]),
        Expense.aggregate([
          { $match: { dateOfExpense: { $gte: startOfMonth, $lte: endOfMonth }, type: "Income" } },
          { $group: { _id: null, totalAmount: { $sum: "$amount" } } },
        ]),
        Expense.aggregate([
          { $match: { dateOfExpense: { $gte: startOfMonth, $lte: endOfMonth } } },
          { $group: { _id: "$expenseCategory", total: { $sum: "$amount" } } },
          { $sort: { total: -1 } },
          { $limit: 5 },
        ]),
      ]);

    res.status(200).json({
      weeklyExpenses: weeklyExpense[0]?.totalAmount || 0,
      weeklyIncome: weeklyIncome[0]?.totalAmount || 0,
      monthlyExpenses: monthlyExpense[0]?.totalAmount || 0,
      monthlyIncome: monthlyIncome[0]?.totalAmount || 0,
      topCategories: topCategories.map((c) => ({
        category: c._id,
        total: c.total,
      })),
    });
  } catch (error) {
    console.error("❌ Expenses Summary Error:", error.message);
    res.status(500).json({ message: error.message });
  }
});

// -----------------------------
// 5️⃣ STAFF PERFORMANCE TREND
// -----------------------------
router.get("/performance-trend", auth, async (req, res) => {
  // Allow ONLY admin, subadmin, or super stakeholder
  if (
    !req.user.isAdmin &&
    !req.user.isSubAdmin &&
    !req.user.isSuperStakeholder
  ) {
    return res.status(403).json({ message: "Access denied" });
  }

  console.log("📌 [GET /analytics/performance-trend] Requested by:", req.user?.email);

  try {
    const last6Weeks = [];

    for (let i = 5; i >= 0; i--) {
      const start = moment().subtract(i, "weeks").startOf("isoWeek").toDate();
      const end = moment().subtract(i, "weeks").endOf("isoWeek").toDate();
      const reports = await Report.find({ weekEnding: { $gte: start, $lte: end } });

      const avgScore =
        reports.length > 0
          ? reports.reduce((sum, r) => {
              switch (r.performanceRating) {
                case "Excellent":
                  return sum + 4;
                case "Good":
                  return sum + 3;
                case "Fair":
                  return sum + 2;
                case "Poor":
                  return sum + 1;
                default:
                  return sum;
              }
            }, 0) / reports.length
          : 0;

      last6Weeks.push({
        week: moment(start).format("MMM D"),
        avgPerformance: avgScore,
      });
    }

    res.status(200).json(last6Weeks);
  } catch (error) {
    console.error("❌ Performance Trend Error:", error.message);
    res.status(500).json({ message: error.message });
  }
});

// -----------------------------
// 6️⃣ WEEKLY EARNINGS (Last 7 Days)
// -----------------------------
router.get("/week-earnings", auth, async (req, res) => {
  // Allow ONLY admin, subadmin, or super stakeholder
  if (
    !req.user.isAdmin &&
    !req.user.isSubAdmin &&
    !req.user.isSuperStakeholder
  ) {
    return res.status(403).json({ message: "Access denied" });
  }

  console.log("📌 [GET /analytics/week-earnings] Requested by:", req.user?.email);

  try {
    const startOfWeek = moment().startOf("isoWeek").toDate();
    const endOfWeek = moment().endOf("isoWeek").toDate();

    const earnings = await Order.aggregate([
      { $match: { createdAt: { $gte: startOfWeek, $lte: endOfWeek } } },
      { $group: { _id: { $dayOfWeek: "$createdAt" }, total: { $sum: "$total" } } },
      { $sort: { _id: 1 } },
    ]);

    res.status(200).json(
      earnings.map((e) => ({
        day: e._id,
        total: e.total,
      }))
    );
  } catch (error) {
    console.error("❌ Week Earnings Error:", error.message);
    res.status(500).json({ message: error.message });
  }
});

// -----------------------------
// 7️⃣ EXPENSE CATEGORY ANALYTICS (Super Stakeholder)
// -----------------------------
router.get("/expenses-category-analytics", auth, async (req, res) => {
  // Allow ONLY admin, subadmin, or super stakeholder
  if (
    !req.user.isAdmin &&
    !req.user.isSubAdmin &&
    !req.user.isSuperStakeholder
  ) {
    return res.status(403).json({ message: "Access denied" });
  }

  console.log("📌 [GET /analytics/expenses-category-analytics] Requested by:", req.user?.email);

  try {
    const summary = await Expense.aggregate([
      { $group: { _id: "$expenseCategory", totalAmount: { $sum: "$amount" }, count: { $sum: 1 } } },
      { $sort: { totalAmount: -1 } },
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
// 8️⃣ SALES TOTAL ANALYTICS (Sum)
// -----------------------------
router.get("/sales-total", auth, async (req, res) => {
  // Allow ONLY admin, subadmin, or super stakeholder
  if (
    !req.user.isAdmin &&
    !req.user.isSubAdmin &&
    !req.user.isSuperStakeholder
  ) {
    return res.status(403).json({ message: "Access denied" });
  }

  console.log("📌 [GET /analytics/sales-total] Requested by:", req.user?.email);

  try {
    const totalSales = await Sale.aggregate([
      { $group: { _id: null, total: { $sum: "$totalAmount" } } }
    ]);

    res.status(200).json({
      totalSales: totalSales[0]?.total || 0
    });
  } catch (err) {
    console.error("❌ Sales Analytics Error:", err.message);
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;