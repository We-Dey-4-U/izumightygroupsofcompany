const CompanyTaxLedger = require("../models/CompanyTaxLedger");

async function getMonthlyPAYESummary(companyId) {
  return CompanyTaxLedger.aggregate([
    { $match: { companyId, taxType: "PAYE" } },
    {
      $group: {
        _id: "$period",
        totalPAYE: { $sum: "$taxAmount" },
        count: { $sum: 1 }
      }
    },
    { $sort: { _id: -1 } }
  ]);
}

module.exports = { getMonthlyPAYESummary };