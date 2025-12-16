const express = require("express");
const router = express.Router();
const cors = require("cors");

const { auth, isAdmin } = require("../middleware/auth");
const TaxHistory = require("../models/TaxHistory");
const { calculateVATFromSales } = require("../utils/companyTaxCalculator");
// ✅ Make sure this is imported correctly
const CompanyTaxRecord = require("../models/CompanyTaxRecord");  
router.use(cors({ origin: "*", methods: ["GET"] }));

// FIRS REPORT
// ======================= FIRS REPORT =======================
router.get("/firs-report/:month/:year", auth, isAdmin, async (req, res) => {
  try {
    const { month, year } = req.params;
    console.log(`[FIRS REPORT] Fetching report for month=${month}, year=${year}, company=${req.user.company}`);

    const records = await TaxHistory.find({ month, year })
      .populate("employeeId", "name email company")
      .sort({ employeeId: 1 });

    const companyRecords = records.filter(r => r.employeeId?.company === req.user.company);

    const report = companyRecords.map(r => ({
      employee: r.employeeId.name,
      email: r.employeeId.email,
      grossSalary: r.grossSalary,
      taxableIncome: r.grossSalary - r.nhfDeduction - r.nhisEmployeeDeduction,
      taxDeduction: r.taxDeduction,
      nhfDeduction: r.nhfDeduction,
      nhisEmployeeDeduction: r.nhisEmployeeDeduction,
      nhisEmployerContribution: r.nhisEmployerContribution,
      netPay: r.netPay,
      companyTaxes: r.companyTaxes || { cit: 0, vat: 0, wht: 0, tet: 0 },
      totalTaxPayable: r.taxDeduction 
        + r.nhisEmployerContribution 
        + (r.companyTaxes?.cit || 0) 
        + (r.companyTaxes?.vat || 0) 
        + (r.companyTaxes?.wht || 0) 
        + (r.companyTaxes?.tet || 0)
    }));

    console.log(`[FIRS REPORT] Total records for company: ${companyRecords.length}`);

    const totals = report.reduce((acc, r) => {
      acc.gross += r.grossSalary;
      acc.tax += r.taxDeduction;
      acc.nhf += r.nhfDeduction;
      acc.nhisEmployee += r.nhisEmployeeDeduction;
      acc.nhisEmployer += r.nhisEmployerContribution;

      acc.cit += r.companyTaxes.cit;
      acc.vat += r.companyTaxes.vat;
      acc.wht += r.companyTaxes.wht;
      acc.tet += r.companyTaxes.tet;

      acc.totalTaxPayable += r.totalTaxPayable;
      acc.net += r.netPay;
      return acc;
    }, { gross: 0, tax: 0, nhf: 0, nhisEmployee: 0, nhisEmployer: 0, cit: 0, vat: 0, wht: 0, tet: 0, totalTaxPayable: 0, net: 0 });

    res.json({ report, totals });
  } catch (err) {
    console.error("❌ FIRS report error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// TAX HISTORy
// ======================= TAX HISTORY =======================
router.get("/history/company/all", auth, isAdmin, async (req, res) => {
  try {
    console.log(`[TAX HISTORY] Fetching all employee tax history for company=${req.user.company}`);
    const records = await TaxHistory.find()
      .populate("employeeId", "name email company")
      .sort({ year: -1, month: -1 });

    const filteredRecords = records.filter(r => r.employeeId?.company === req.user.company);
    console.log(`[TAX HISTORY] Found ${filteredRecords.length} records for company`);
    res.json(filteredRecords);
  } catch (err) {
    console.error("❌ Error fetching tax history:", err);
    res.status(500).json({ message: "Server error" });
  }
});


// NEW: COMPANY TAX RECORDS ONLY

// ======================= COMPANY TAX RECORDS =======================
router.get("/company-tax/history", auth, isAdmin, async (req, res) => {
  try {
    console.log(`[COMPANY TAX HISTORY] Fetching company tax records for company=${req.user.company}`);
    const companyTaxRecords = await CompanyTaxRecord.find({ company: req.user.company })
      .sort({ year: -1, month: -1 });
    console.log(`[COMPANY TAX HISTORY] Found ${companyTaxRecords.length} records`);
    res.json(companyTaxRecords);
  } catch (err) {
    console.error("❌ Error fetching company tax records:", err);
    res.status(500).json({ message: "Server error" });
  }
});



// ======================= SAVE / UPDATE COMPANY TAX =======================
router.post("/company-tax", auth, isAdmin, async (req, res) => {
  try {
    const { month, year, cit = 0, wht = 0, tet = 0, notes } = req.body;
    console.log(`[SAVE COMPANY TAX] Received: month=${month}, year=${year}, cit=${cit}, wht=${wht}, tet=${tet}, company=${req.user.company}`);

    const vatData = await calculateVATFromSales(req.user.company, month, year);
    console.log(`[SAVE COMPANY TAX] VAT calculated: ${JSON.stringify(vatData)}`);

    const record = await CompanyTaxRecord.findOneAndUpdate(
      { company: req.user.company, month, year },
      {
        company: req.user.company,
        month,
        year,
        vatFromSales: vatData.vatFromSales,
        vatableSales: vatData.vatableSales,
        vatRate: 7.5,
        cit,
        wht,
        tet,
        notes
      },
      { upsert: true, new: true }
    );

    console.log(`[SAVE COMPANY TAX] Record saved: ${JSON.stringify(record)}`);
    res.json(record);
  } catch (err) {
    console.error("❌ Error saving company tax:", err);
    res.status(500).json({ message: "Server error" });
  }
});




/* =========================================================
   OPTIONAL: GET COMPANY TAX REPORT FOR A MONTH/YEAR
========================================================= */
// ======================= OPTIONAL: COMPANY TAX REPORT =======================
router.get("/company-tax-report/:month/:year", auth, isAdmin, async (req, res) => {
  try {
    const { month, year } = req.params;
    console.log(`[COMPANY TAX REPORT] Generating report for month=${month}, year=${year}, company=${req.user.company}`);

    const vatData = await calculateVATFromSales(req.user.company, month, year);
    const companyTax = await CompanyTaxRecord.findOne({ company: req.user.company, month, year });

    const report = {
      company: req.user.company,
      month,
      year,
      vat: vatData.vatFromSales,
      vatableSales: vatData.vatableSales,
      vatRate: 7.5,
      cit: companyTax?.cit || 0,
      wht: companyTax?.wht || 0,
      tet: companyTax?.tet || 0,
      totalCompanyTax: vatData.vatFromSales + (companyTax?.cit || 0) + (companyTax?.wht || 0) + (companyTax?.tet || 0)
    };

    console.log(`[COMPANY TAX REPORT] Report: ${JSON.stringify(report)}`);
    res.json(report);
  } catch (err) {
    console.error("❌ Company tax report error:", err);
    res.status(500).json({ message: "Server error" });
  }
});



/* =========================================================
   POST /company-tax
   Create or update manual company tax (CIT/WHT/TET)
========================================================= */
router.post("/company-tax", auth, isAdmin, async (req, res) => {
  try {
    const { month, year, cit = 0, wht = 0, tet = 0, notes } = req.body;

    // VAT from sales
    const vatData = await calculateVATFromSales(req.user.company, month, year);

    // Upsert: create or update existing month/year record
    const record = await CompanyTaxRecord.findOneAndUpdate(
      { company: req.user.company, month, year },
      {
        company: req.user.company,
        month,
        year,
        vatFromSales: vatData.vatFromSales,
        vatableSales: vatData.vatableSales,
        vatRate: 7.5,
        cit,
        wht,
        tet,
        notes
      },
      { upsert: true, new: true }
    );

    res.json(record);
  } catch (err) {
    console.error("❌ Error saving company tax:", err);
    res.status(500).json({ message: "Server error" });
  }
});


module.exports = router;