const CompanyTaxLedger = require("../models/CompanyTaxLedger");

async function generateMonthlyPAYE({ companyId, year, month }) {
  const period = `${year}-${month.toString().padStart(2, "0")}`;

  const entries = await CompanyTaxLedger.find({
    companyId,
    taxType: "PAYE",
    period,
    remitted: false
  });

  const totalPAYE = entries.reduce((sum, e) => sum + e.taxAmount, 0);

  return {
    companyId,
    period,
    totalPAYE,
    entryCount: entries.length
  };
}

module.exports = { generateMonthlyPAYE };