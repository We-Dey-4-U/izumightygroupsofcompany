// utils/companyTaxCalculator.js
const Sale = require("../models/Sale");

async function calculateVATFromSales(company, month, year) {
  const start = new Date(year, month - 1, 1);
  const end = new Date(year, month, 0, 23, 59, 59);

  const result = await Sale.aggregate([
    {
      $match: {
        company,
        createdAt: { $gte: start, $lte: end }
      }
    },
    {
      $group: {
        _id: null,
        totalVAT: { $sum: "$vatAmount" },
        totalSales: { $sum: "$subtotal" }
      }
    }
  ]);

  return {
    vatFromSales: result[0]?.totalVAT || 0,
    vatableSales: result[0]?.totalSales || 0
  };
}

module.exports = { calculateVATFromSales };