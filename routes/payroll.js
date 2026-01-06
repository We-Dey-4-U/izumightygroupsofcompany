require("dotenv").config();
const express = require("express");
const router = express.Router();
const cors = require("cors");
const { body, validationResult } = require("express-validator");
const { auth, isAdmin, isSuperStakeholder } = require("../middleware/auth");
const Payroll = require("../models/Payroll");
const { User } = require("../models/user");
const CompanyTaxLedger = require("../models/CompanyTaxLedger");
const TaxSettings = require("../models/TaxSettings");
const TaxHistory = require("../models/TaxHistory");
const { v4: uuidv4 } = require("uuid");
const axios = require("axios");
const FormData = require("form-data");
const taxUtil = require("../utils/taxCalculator");
const { recordTax } = require("../services/taxLedger.service");

// --- CORS Setup ---
router.use(cors({ origin: "*", methods: ["GET", "POST", "PUT", "DELETE"] }));

/** Helper: Upload payslip to storage */
async function uploadPayslip(fileBuffer, fileName) {
  const fileId = uuidv4();
  const formData = new FormData();
  formData.append("fileId", fileId);
  formData.append("file", fileBuffer, { filename: fileName });

  try {
    const resp = await axios.post(
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
    return `${process.env.APPWRITE_ENDPOINT}/storage/buckets/${process.env.APPWRITE_BUCKET_ID}/files/${resp.data.$id}/view?project=${process.env.APPWRITE_PROJECT_ID}`;
  } catch (err) {
    console.error("Error uploading payslip:", err.message);
    throw err;
  }
}

/** 🔹 SINGLE PAYROLL GENERATION */
/** 🔹 SINGLE PAYROLL GENERATION WITH VALIDATION & SANITIZATION */
router.post(
  "/generate",
  auth,
  isAdmin,
  [
    body("emails").isArray({ min: 1 }).withMessage("Emails are required").bail()
      .custom((arr) => arr.every(e => typeof e === "string" && e.includes("@"))).withMessage("Each email must be valid"),
    body("month").isInt({ min: 1, max: 12 }).withMessage("Invalid month"),
    body("year").isInt({ min: 2000 }).withMessage("Invalid year"),
    body("basicSalary").optional().isFloat({ min: 0 }).withMessage("Invalid basicSalary"),
    body("housingAllowance").optional().isFloat({ min: 0 }),
    body("medicalAllowance").optional().isFloat({ min: 0 }),
    body("transportationAllowance").optional().isFloat({ min: 0 }),
    body("leaveAllowance").optional().isFloat({ min: 0 }),
    body("pensionDeduction").optional().isFloat({ min: 0 }),
    body("otherDeductions").optional().isFloat({ min: 0 }),
  ],
  async (req, res) => {
    // Validate inputs
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    try {
      const {
        emails, month, year, basicSalary = 0, housingAllowance = 0,
        medicalAllowance = 0, transportationAllowance = 0, leaveAllowance = 0,
        pensionDeduction = 0, otherDeductions = 0
      } = req.body;

      const results = [];

      for (const email of emails) {
        const employee = await User.findOne({ email }).populate("companyId");
        if (!employee || !employee.companyId) continue;

        // Multi-tenant isolation
        if (!req.user.isSuperStakeholder && employee.companyId._id.toString() !== req.user.companyId?.toString()) continue;

        const existing = await Payroll.findOne({ employeeId: employee._id, month, year });
        if (existing) continue;

        const grossSalary = Number(basicSalary) + Number(housingAllowance) + Number(medicalAllowance)
          + Number(transportationAllowance) + Number(leaveAllowance);

        let settings = await TaxSettings.findOne({ company: employee.companyId._id });
if (!settings) {
  settings = await TaxSettings.create({
    company: employee.companyId._id,
    mode: "STANDARD_PAYE",
    customPercent: 0,
    nhfRate: 0.025,
    nhisEmployee: 0.05,
    nhisEmployer: 0.10
  });
}

        settings.nhfRate = settings.nhfRate ?? 0.025;
        settings.nhisEmployee = settings.nhisEmployee ?? 0.05;
        settings.nhisEmployer = settings.nhisEmployer ?? 0.10;

        const nhfDeduction = Number((grossSalary * settings.nhfRate).toFixed(2));
        const nhisEmployeeDeduction = Number((grossSalary * settings.nhisEmployee).toFixed(2));
        const nhisEmployerContribution = Number((grossSalary * settings.nhisEmployer).toFixed(2));
        const paye = Number((await taxUtil.computePAYE(grossSalary, nhfDeduction, nhisEmployeeDeduction, employee.companyId._id)).toFixed(2));

        const totalDeductions = nhfDeduction + nhisEmployeeDeduction + paye + Number(pensionDeduction) + Number(otherDeductions);
        const netPay = Number((grossSalary - totalDeductions).toFixed(2));

        const payroll = new Payroll({
          employeeId: employee._id,
          companyId: employee.companyId._id,
          month, year,
          basicSalary: Number(basicSalary),
          housingAllowance: Number(housingAllowance),
          medicalAllowance: Number(medicalAllowance),
          transportationAllowance: Number(transportationAllowance),
          leaveAllowance: Number(leaveAllowance),
          taxDeduction: paye,
          pensionDeduction: Number(pensionDeduction),
          nhfDeduction,
          nhisEmployeeDeduction,
          nhisEmployerContribution,
          otherDeductions: Number(otherDeductions),
          grossSalary,
          netPay
        });

        await payroll.save();

        await TaxHistory.findOneAndUpdate(
          { employeeId: employee._id, month, year },
          {
            payrollId: payroll._id,
            employeeId: employee._id,
            month,
            year,
            grossSalary,
            paye,
            nhfDeduction,
            nhisEmployeeDeduction,
            nhisEmployerContribution,
            pensionDeduction: Number(pensionDeduction),
            otherDeductions: Number(otherDeductions),
            netPay
          },
          { upsert: true }
        );

        const period = `${year}-${month.toString().padStart(2, "0")}`;

        await CompanyTaxLedger.create({
          companyId: employee.companyId._id,
          taxType: "PAYE",
          period,
          basisAmount: grossSalary,
          rate: grossSalary > 0 ? paye / grossSalary : 0,
          taxAmount: paye,
          source: "Payroll",
          sourceRefs: [payroll._id],
          computedBy: req.user._id
        });

        await CompanyTaxLedger.create({
          companyId: employee.companyId._id,
          taxType: "NHF",
          period,
          basisAmount: grossSalary,
          rate: settings.nhfRate,
          taxAmount: nhfDeduction,
          source: "Payroll",
          sourceRefs: [payroll._id],
          computedBy: req.user._id
        });

        await CompanyTaxLedger.create({
          companyId: employee.companyId._id,
          taxType: "NHIS",
          period,
          basisAmount: grossSalary,
          rate: settings.nhisEmployee,
          taxAmount: nhisEmployeeDeduction,
          source: "Payroll",
          sourceRefs: [payroll._id],
          computedBy: req.user._id
        });

        await CompanyTaxLedger.create({
          companyId: employee.companyId._id,
          taxType: "NHIS_EMPLOYER",
          period,
          basisAmount: grossSalary,
          rate: settings.nhisEmployer,
          taxAmount: nhisEmployerContribution,
          source: "Payroll",
          sourceRefs: [payroll._id],
          computedBy: req.user._id
        });

        results.push(payroll);
      }

      res.status(201).json({ message: "Payroll processed successfully", count: results.length, results });
    } catch (err) {
      console.error("Payroll error:", err);
      res.status(500).json({ message: "Server error", error: err.message });
    }
  }
);

/** 🔹 BULK PAYROLL GENERATION */
router.post("/send-bulk", auth, isAdmin, async (req, res) => {
  try {
    const { month, year } = req.body;
    if (!month || !year) return res.status(400).json({ message: "Month and year are required" });

    const staff = await User.find({ companyId: req.user.companyId, isStaff: true }).populate("companyId");
    if (!staff.length) return res.status(404).json({ message: "No staff found" });

    let createdCount = 0;

    for (const employee of staff) {
      if (!employee.companyId) continue;
      const existing = await Payroll.findOne({ employeeId: employee._id, month, year });
      if (existing) continue;

      const grossSalary = Number(employee.basicSalary || 0) + Number(employee.housingAllowance || 0)
        + Number(employee.medicalAllowance || 0) + Number(employee.transportationAllowance || 0)
        + Number(employee.leaveAllowance || 0);

      let settings = await TaxSettings.findOne({ companyId: employee.companyId._id });
      if (!settings) {
        settings = await TaxSettings.create({
          companyId: employee.companyId._id,
          mode: "STANDARD_PAYE",
          customPercent: 0,
          nhfRate: 0.025,
          nhisEmployee: 0.05,
          nhisEmployer: 0.10
        });
      }

      settings.nhfRate = settings.nhfRate ?? 0.025;
      settings.nhisEmployee = settings.nhisEmployee ?? 0.05;
      settings.nhisEmployer = settings.nhisEmployer ?? 0.10;

      const nhfDeduction = Number((grossSalary * settings.nhfRate).toFixed(2));
      const nhisEmployeeDeduction = Number((grossSalary * settings.nhisEmployee).toFixed(2));
      const nhisEmployerContribution = Number((grossSalary * settings.nhisEmployer).toFixed(2));
      const paye = Number((await taxUtil.computePAYE(grossSalary, nhfDeduction, nhisEmployeeDeduction, employee.companyId._id)).toFixed(2));

      const totalDeductions = nhfDeduction + nhisEmployeeDeduction + paye;
      const netPay = Number((grossSalary - totalDeductions).toFixed(2));

      const payroll = new Payroll({
        employeeId: employee._id,
        companyId: employee.companyId._id,
        month,
        year,
        basicSalary: Number(employee.basicSalary || 0),
        housingAllowance: Number(employee.housingAllowance || 0),
        medicalAllowance: Number(employee.medicalAllowance || 0),
        transportationAllowance: Number(employee.transportationAllowance || 0),
        leaveAllowance: Number(employee.leaveAllowance || 0),
        taxDeduction: paye,
        nhfDeduction,
        nhisEmployeeDeduction,
        nhisEmployerContribution,
        grossSalary,
        netPay
      });

      await payroll.save();

      await TaxHistory.findOneAndUpdate(
        { employeeId: employee._id, month, year },
        {
          payrollId: payroll._id,
          employeeId: employee._id,
          month,
          year,
          grossSalary,
          taxDeduction: paye,
          nhfDeduction,
          nhisEmployeeDeduction,
          nhisEmployerContribution,
          pensionDeduction: Number(employee.pensionDeduction || 0),
          otherDeductions: 0,
          netPay,
          companyTaxes: { cit: 0, vat: 0, wht: 0, tet: 0 }
        },
        { upsert: true }
      );

      const period = `${year}-${month.toString().padStart(2, "0")}`;

      // PAYE
      await CompanyTaxLedger.create({
        companyId: employee.companyId._id,
        taxType: "PAYE",
        period,
        basisAmount: grossSalary,
        rate: paye / grossSalary,
        taxAmount: paye,
        source: "Payroll",
        sourceRefs: [payroll._id],
        computedBy: req.user._id
      });

      // NHF
      await CompanyTaxLedger.create({
        companyId: employee.companyId._id,
        taxType: "NHF",
        period,
        basisAmount: grossSalary,
        rate: settings.nhfRate,
        taxAmount: nhfDeduction,
        source: "Payroll",
        sourceRefs: [payroll._id],
        computedBy: req.user._id
      });

      // NHIS
      await CompanyTaxLedger.create({
        companyId: employee.companyId._id,
        taxType: "NHIS",
        period,
        basisAmount: grossSalary,
        rate: settings.nhisEmployee,
        taxAmount: nhisEmployeeDeduction,
        source: "Payroll",
        sourceRefs: [payroll._id],
        computedBy: req.user._id
      });

      // ✅ NEW: NHIS Employer Contribution
await CompanyTaxLedger.create({
  companyId: employee.companyId._id,
  taxType: "NHIS_EMPLOYER",
  period,
  basisAmount: grossSalary,
  rate: settings.nhisEmployer,
  taxAmount: nhisEmployerContribution,
  source: "Payroll",
  sourceRefs: [payroll._id],
  computedBy: req.user._id
});

      createdCount++;
    }

    res.json({ message: "Bulk payroll processed", count: createdCount });
  } catch (err) {
    console.error("Bulk payroll error:", err.message, err.stack);
    res.status(500).json({ message: "Server error", error: err.message });
  }
});





/** GET all payrolls */
router.get("/all", auth, async (req, res) => {
  try {
    let payrolls;
    if (req.user.isAdmin || req.user.isSuperStakeholder) {
      payrolls = await Payroll.find().populate("employeeId", "name email companyId isStaff");
      payrolls = payrolls.filter(p => p.employeeId?.companyId._id.toString() === req.user.companyId?.toString() && p.employeeId?.isStaff);
    } else {
      payrolls = await Payroll.find({ employeeId: req.user._id }).populate("employeeId", "name email companyId");
    }
    res.status(200).json(payrolls);
  } catch (err) {
    console.error("Error fetching payrolls:", err.message, err.stack);
    res.status(500).json({ message: "Server error", error: err.message });
  }
});

/** GET payrolls for a single staff */
router.get("/staff/:id", auth, async (req, res) => {
  try {
    const employee = await User.findById(req.params.id).populate("companyId");
    if (!employee) return res.status(404).json({ message: "Employee not found" });
    if (!req.user.isSuperStakeholder && employee.companyId._id.toString() !== req.user.companyId?.toString())
      return res.status(403).json({ message: "Access denied" });

    const payrolls = await Payroll.find({ employeeId: req.params.id }).sort({ year: -1, month: -1 });
    res.status(200).json(payrolls);
  } catch (err) {
    console.error("Error fetching staff payrolls:", err.message, err.stack);
    res.status(500).json({ message: "Server error", error: err.message });
  }
});

/** GET all staff under a selected company */
router.get("/by-company/:companyId", auth, async (req, res) => {
  try {
    const companyToSearch = req.user.isSuperStakeholder ? req.params.companyId : req.user.companyId;
    const staff = await User.find({ companyId: companyToSearch, isStaff: true }).select("_id name email companyId");
    res.status(200).json(staff);
  } catch (err) {
    console.error("Error fetching staff by company:", err.message);
    res.status(500).json({ message: "Server error", error: err.message });
  }
});



// GET my payrolls (for staff)
router.get("/my-payslips", auth, async (req, res) => {
  try {
    const payrolls = await Payroll.find({ employeeId: req.user._id }).sort({ year: -1, month: -1 });
    res.status(200).json(payrolls);
  } catch (err) {
    console.error("Error fetching my payslips:", err.message);
    res.status(500).json({ message: "Server error", error: err.message });
  }
});



/** 🔹 GET audit-ready monthly payroll summary */
router.get("/summary/monthly", auth, isAdmin, async (req, res) => {
  try {
    const summary = await Payroll.aggregate([
      { $match: { companyId: req.user.companyId } },
      {
        $group: {
          _id: { month: "$month", year: "$year" },
          staffCount: { $sum: 1 },
          totalGross: { $sum: "$grossSalary" },
          totalPAYE: { $sum: "$taxDeduction" },
          totalNHF: { $sum: "$nhfDeduction" },
          totalNHISEmployee: { $sum: "$nhisEmployeeDeduction" },
          totalNHISEmployer: { $sum: "$nhisEmployerContribution" },
          totalNetPay: { $sum: "$netPay" },
        },
      },
      { $sort: { "_id.year": 1, "_id.month": 1 } },
    ]);

    res.status(200).json(summary);
  } catch (err) {
    console.error("Error fetching monthly summary:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
});


router.get("/remittance/:year/:month", auth, isAdmin, async (req, res) => {
  const { year, month } = req.params;
  try {
    const payrolls = await Payroll.find({ companyId: req.user.companyId, year: Number(year), month: Number(month) });
    if (!payrolls.length) return res.status(404).json({ message: "No payroll data found" });

    const grossSalary = payrolls.reduce((acc, p) => acc + p.grossSalary, 0);
    const taxDeduction = payrolls.reduce((acc, p) => acc + p.taxDeduction, 0);
    const nhfDeduction = payrolls.reduce((acc, p) => acc + p.nhfDeduction, 0);
    const nhisEmployeeDeduction = payrolls.reduce((acc, p) => acc + p.nhisEmployeeDeduction, 0);
    const nhisEmployerContribution = payrolls.reduce((acc, p) => acc + p.nhisEmployerContribution, 0);
    const pensionDeduction = payrolls.reduce((acc, p) => acc + p.pensionDeduction, 0);
    const otherDeductions = payrolls.reduce((acc, p) => acc + p.otherDeductions, 0);
    const netPay = payrolls.reduce((acc, p) => acc + p.netPay, 0);

    res.json({
      companyId: req.user.companyId,
      period: `${year}-${month.toString().padStart(2, "0")}`,
      grossSalary,
      taxDeduction,
      nhfDeduction,
      nhisEmployeeDeduction,
      nhisEmployerContribution,
      pensionDeduction,
      otherDeductions,
      netPay,
      entryCount: payrolls.length,
      remitted: false // or fetch from your remittance record
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
});



/** Email Notification (placeholder) */
function sendEmail({ to, subject, body }) {
  console.log(`📧 Sending email to: ${to}`);
  console.log(`Subject: ${subject}`);
  console.log(`Body: ${body}`);
}

module.exports = router;