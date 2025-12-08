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
// WEEKLY REPORT SUBMISSION RATE (Company Isolated)
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

    // ✅ Get total staff in THIS ADMIN COMPANY only
    const totalStaff = await User.countDocuments({
      isStaff: true,
      company: req.user.company, // 🔥 Company Isolation
    });

    // ✅ Get reports submitted ONLY by users in this same company
    const submittedReports = await Report.find({
      weekEnding: { $gte: startOfWeek, $lte: endOfWeek },
    }).populate("submittedBy", "company");

    // 🔥 Filter reports to same company
    const companyReports = submittedReports.filter(
      (r) => r.submittedBy?.company === req.user.company
    );

    const submittedCount = companyReports.length;
    const pendingCount = totalStaff - submittedCount;

    const submissionRate =
      totalStaff > 0
        ? ((submittedCount / totalStaff) * 100).toFixed(2)
        : 0;

    // =====================================
    // 🔥 TOP DEPARTMENT (Company Isolated)
    // =====================================
    const topDept = await Report.aggregate([
      {
        $match: {
          weekEnding: { $gte: startOfWeek, $lte: endOfWeek },
        },
      },
      // join user
      {
        $lookup: {
          from: "users",
          localField: "submittedBy",
          foreignField: "_id",
          as: "user",
        },
      },
      { $unwind: "$user" },
      // filter by company
      {
        $match: {
          "user.company": req.user.company, // 🔥 Company Filter
        },
      },
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
  if (!req.user.isAdmin && !req.user.isSubAdmin && !req.user.isSuperStakeholder) {
    return res.status(403).json({ message: "Access denied" });
  }

  console.log("📌 [GET /analytics/employee-summary] Requested by:", req.user?.email);

  try {
    const company = req.user.company;

    // ✅ Fetch only employees whose user belongs to the admin's company
    const filteredEmployees = await EmployeeInfo.find()
      .populate({
        path: "user",
        select: "company",
        match: { company }, // 🔥 Company isolation applied here
      });

    // Remove EmployeeInfo records where populate failed (user not in this company)
    const employees = filteredEmployees.filter(emp => emp.user);

    // Total company employees
    const totalEmployees = employees.length;

    // Active employees
    const activeEmployees = employees.filter(
      emp => emp.employment?.status === "Active"
    ).length;

    // Inactive employees
    const inactiveEmployees = totalEmployees - activeEmployees;

    // Department breakdown
    const departmentMap = {};
    employees.forEach(emp => {
      const dept = emp.employment?.department || "Unassigned";
      departmentMap[dept] = (departmentMap[dept] || 0) + 1;
    });

    const byDepartment = Object.keys(departmentMap).map(dept => ({
      department: dept,
      count: departmentMap[dept],
    })).sort((a, b) => b.count - a.count);

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
  if (!req.user.isAdmin && !req.user.isSuperStakeholder) {
    return res.status(403).json({ message: "Access denied" });
  }

  const startOfMonth = moment().startOf("month").toDate();
  const endOfMonth = moment().endOf("month").toDate();
  const company = req.user.company;

  try {
    const payrolls = await Payroll.aggregate([
      { $match: { createdAt: { $gte: startOfMonth, $lte: endOfMonth } } },
      {
        $lookup: {
          from: "users",
          localField: "employeeId",
          foreignField: "_id",
          as: "employee",
        },
      },
      { $unwind: "$employee" },
      { $match: { "employee.company": company } },
      {
        $group: {
          _id: null,
          totalGross: { $sum: "$grossSalary" },
          totalNet: { $sum: "$netPay" },
          totalTaxDeducted: {
            $sum: { $add: ["$taxDeduction", "$pensionDeduction", "$otherDeductions"] },
          },
          employeeCount: { $addToSet: "$employeeId" },
        },
      },
    ]);

    const data = payrolls[0] || { totalGross: 0, totalNet: 0, totalTaxDeducted: 0, employeeCount: [] };

    res.status(200).json({
      totalGross: data.totalGross,
      totalNet: data.totalNet,
      totalTaxDeducted: data.totalTaxDeducted, // ✅ New field
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
  if (!req.user.isAdmin && !req.user.isSubAdmin && !req.user.isSuperStakeholder) {
    return res.status(403).json({ message: "Access denied" });
  }

  console.log("📌 [GET /analytics/alltime-summary] Requested by:", req.user?.email);

  try {
    const company = req.user.company;
    const prevDate = moment().startOf("month").toDate(); // Previous month cutoff

    // ---- USERS ----
    const [totalUsers, prevUsers, usersInCompany] = await Promise.all([
      User.countDocuments({ company }),
      User.countDocuments({ company, createdAt: { $lt: prevDate } }),
      User.find({ company }).select("_id"),
    ]);
    const userIds = usersInCompany.map(u => u._id);

    // ---- PRODUCTS ----
    const [totalProducts, prevProducts] = await Promise.all([
      InventoryProduct.countDocuments({ createdBy: { $in: userIds } }),
      InventoryProduct.countDocuments({ createdBy: { $in: userIds }, createdAt: { $lt: prevDate } }),
    ]);

    // ---- SALES / EARNINGS ----
    const salesAgg = await Sale.aggregate([
      { $match: { company } },
      { $group: { _id: null, totalEarnings: { $sum: "$totalAmount" } } },
    ]);

    const prevSalesAgg = await Sale.aggregate([
      { $match: { company, createdAt: { $lt: prevDate } } },
      { $group: { _id: null, prevEarnings: { $sum: "$totalAmount" } } },
    ]);

    const data = salesAgg[0] || {};
    const prevData = prevSalesAgg[0] || {};

    const response = {
      users: totalUsers || 0,
      products: totalProducts || 0,
      earnings: data.totalEarnings || 0,
      prevUsers: prevUsers || 0,
      prevProducts: prevProducts || 0,
      prevEarnings: prevData.prevEarnings || 0,
    };

    res.status(200).json(response);
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
router.get("/expenses-summary", auth, async (req, res) => {
  // Allow ONLY admin or super stakeholder
  if (!req.user.isAdmin && !req.user.isSuperStakeholder) {
    return res.status(403).json({ message: "Access denied" });
  }

  console.log("📌 [GET /analytics/expenses-summary] Requested by:", req.user?.email);

  try {
    const startOfWeek = moment().startOf("isoWeek").toDate();
    const endOfWeek = moment().endOf("isoWeek").toDate();
    const startOfMonth = moment().startOf("month").toDate();
    const endOfMonth = moment().endOf("month").toDate();

    // 🔥 1. Get all user IDs in same company
    const usersInCompany = await User.find({ company: req.user.company }).select("_id");

    // 🔥 2. Extract IDs
    const companyUserIds = usersInCompany.map((u) => u._id);

    // 🔥 3. Use company-based filtering inside every aggregation
    const [
      weeklyExpense,
      weeklyIncome,
      monthlyExpense,
      monthlyIncome,
      topCategories,
    ] = await Promise.all([
      // WEEKLY EXPENSE TOTAL
      Expense.aggregate([
        {
          $match: {
            dateOfExpense: { $gte: startOfWeek, $lte: endOfWeek },
            type: "Expense",
            enteredByUser: { $in: companyUserIds }, // 👈 Company Isolation
          },
        },
        { $group: { _id: null, totalAmount: { $sum: "$amount" } } },
      ]),

      // WEEKLY INCOME TOTAL
      Expense.aggregate([
        {
          $match: {
            dateOfExpense: { $gte: startOfWeek, $lte: endOfWeek },
            type: "Income",
            enteredByUser: { $in: companyUserIds },
          },
        },
        { $group: { _id: null, totalAmount: { $sum: "$amount" } } },
      ]),

      // MONTHLY EXPENSE TOTAL
      Expense.aggregate([
        {
          $match: {
            dateOfExpense: { $gte: startOfMonth, $lte: endOfMonth },
            type: "Expense",
            enteredByUser: { $in: companyUserIds },
          },
        },
        { $group: { _id: null, totalAmount: { $sum: "$amount" } } },
      ]),

      // MONTHLY INCOME TOTAL
      Expense.aggregate([
        {
          $match: {
            dateOfExpense: { $gte: startOfMonth, $lte: endOfMonth },
            type: "Income",
            enteredByUser: { $in: companyUserIds },
          },
        },
        { $group: { _id: null, totalAmount: { $sum: "$amount" } } },
      ]),

      // TOP CATEGORIES (Company Isolated)
      Expense.aggregate([
        {
          $match: {
            dateOfExpense: { $gte: startOfMonth, $lte: endOfMonth },
            enteredByUser: { $in: companyUserIds },
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

      // 🔥 Company isolation applied here
      const reports = await Report.find({
        weekEnding: { $gte: start, $lte: end },
      }).populate("submittedBy", "company");

      const companyReports = reports.filter(
        (r) => r.submittedBy?.company === req.user.company
      );

      const avgScore =
        companyReports.length > 0
          ? companyReports.reduce((sum, r) => {
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
            }, 0) / companyReports.length
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
  if (!req.user.isAdmin && !req.user.isSuperStakeholder) {
    return res.status(403).json({ message: "Access denied" });
  }

  console.log("📌 [GET /analytics/week-earnings] Requested by:", req.user?.email);

  try {
    const startOfWeek = moment().startOf("isoWeek").toDate();
    const endOfWeek = moment().endOf("isoWeek").toDate();

    const earnings = await Sale.aggregate([
      {
        $match: {
          company: req.user.company, // 🔹 Company isolation
          createdAt: { $gte: startOfWeek, $lte: endOfWeek },
        },
      },
      {
        $group: {
          _id: { $dayOfWeek: "$createdAt" },
          total: { $sum: "$totalAmount" }, // 🔹 Use totalAmount from Sale
        },
      },
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
// 8️⃣ SALES TOTAL ANALYTICS (Sum)
// -----------------------------


module.exports = router;