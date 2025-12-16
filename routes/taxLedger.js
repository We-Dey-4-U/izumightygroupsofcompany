const express = require("express");
const router = express.Router();
const { auth } = require("../middleware/auth");
const { getCompanyTaxLedger } = require("../utils/companyTaxUpdater");

/**
 * GET /tax-ledger
 * Optional query params: taxType=VAT|WHT, period=YYYY-MM
 */
router.get("/", auth, async (req, res) => {
  try {
    console.log("🔵 [TAX LEDGER REQUEST]");
    console.log("UserId:", req.user._id.toString());
    console.log("CompanyId:", req.user.companyId.toString());
    console.log("Query Params:", req.query);

    const { taxType, period } = req.query;
    const filter = {};
    if (taxType) filter.taxType = taxType;
    if (period) filter.period = period;

    console.log("Filter object for DB query:", filter);

    // Fetch ledger entries
    const entries = await getCompanyTaxLedger(req.user.companyId, filter);

    console.log("📂 Found ledger entries:", entries.length);

    // Extra debug: log sources
    entries.forEach((entry, idx) => {
      console.log(`Entry ${idx + 1}: taxType=${entry.taxType}, source=${entry.source}, period=${entry.period}, basisAmount=${entry.basisAmount}, taxAmount=${entry.taxAmount}`);
    });

    // Check if there are any Expense entries
    const expenseEntries = entries.filter(e => e.source === "Expense");
    console.log(`📌 Expense entries count: ${expenseEntries.length}`);

    res.status(200).json(entries);
  } catch (err) {
    console.error("❌ [GET TAX LEDGER] Error:", err);
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;