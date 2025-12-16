// backend/services/payeCSV.service.js
const CompanyTaxLedger = require("../models/CompanyTaxLedger");

async function exportPAYECSV(companyId, period) {
  const entries = await CompanyTaxLedger.find({
    companyId,
    taxType: "PAYE",
    period,
  });

  let csv = "EmployeeRef,Period,TaxAmount\n";

  entries.forEach((e) => {
    csv += `${e.sourceRefs[0] || ""},${period},${e.taxAmount}\n`;
  });

  return csv;
}

module.exports = { exportPAYECSV };