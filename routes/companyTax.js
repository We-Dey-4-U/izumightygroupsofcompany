const express = require("express");
const router = express.Router();
const cors = require("cors");

const { auth, isAdmin } = require("../middleware/auth");
const CompanyTaxRecord = require("../models/CompanyTaxRecord");
const { calculateVATFromSales } = require("../utils/companyTaxCalculator");
const { calculateCIT } = require("../utils/citCalculator");
router.use(cors({ origin: "*", methods: ["GET", "POST"] }));

/* =========================================================
   COMPANY TAX OBLIGATION REPORT (FIRS)
   ❗ NOT EMPLOYEE TAX
========================================================= */
router.get("/company-tax-report/:month/:year", auth, isAdmin, async (req, res) => {
  try {
    const { month, year } = req.params;

    // 🔹 VAT strictly from sales
    const vatData = await calculateVATFromSales(
      req.user.company,
      month,
      year
    );

    // 🔹 Manual company taxes
    const companyTax = await CompanyTaxRecord.findOne({
      company: req.user.company,
      month,
      year
    });

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

      totalCompanyTax:
        vatData.vatFromSales +
        (companyTax?.cit || 0) +
        (companyTax?.wht || 0) +
        (companyTax?.tet || 0)
    };

    res.json(report);

  } catch (err) {
    console.error("❌ Company tax report error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

/* =========================================================
   MANUAL COMPANY TAX ENTRY (CIT / WHT / TET)
========================================================= */
router.post("/company-tax", auth, isAdmin, async (req, res) => {
  try {
    const { month, year, cit = 0, wht = 0, tet = 0, notes } = req.body;

    const vatData = await calculateVATFromSales(
      req.user.company,
      month,
      year
    );

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
    console.error("❌ Company tax save error:", err);
    res.status(500).json({ message: "Server error" });
  }
});


// GET CIT for a company for a specific month/year
router.get("/cit", auth, async (req, res) => {
  try {
    if (!req.user.isAdmin && !req.user.isSuperStakeholder) {
      return res.status(403).json({ message: "Access denied" });
    }

    const { month, year } = req.query;
    if (!month || !year) return res.status(400).json({ message: "month and year are required" });

    const result = await calculateCIT(req.user.companyId, Number(month), Number(year));

    res.status(200).json({
      message: `CIT calculation for ${month}/${year}`,
      ...result,
    });
  } catch (error) {
    console.error("❌ [CIT CALCULATION ERROR]", error);
    res.status(500).json({ message: error.message });
  }
});


module.exports = router;