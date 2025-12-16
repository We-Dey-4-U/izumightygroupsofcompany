const CompanyTaxLedger = require("../models/CompanyTaxLedger");

async function processExpenseTax(expense, companyId) {
  const period = expense.dateOfExpense.toISOString().slice(0, 7); // YYYY-MM

  // VAT (Input VAT)
  if (expense.taxFlags?.vatClaimable && expense.vatAmount > 0) {
    await CompanyTaxLedger.create({
      companyId,
      taxType: "VAT",
      period,
      basisAmount: expense.amount,
      rate: 0.075,
      taxAmount: expense.vatAmount,
      source: "Expense",
      sourceId: expense._id
    });
  }

  // WHT
  if (expense.taxFlags?.whtApplicable && expense.whtAmount > 0) {
    await CompanyTaxLedger.create({
      companyId,
      taxType: "WHT",
      period,
      basisAmount: expense.amount,
      rate: expense.whtRate,
      taxAmount: expense.whtAmount,
      source: "Expense",
      sourceId: expense._id
    });
  }
}

module.exports = { processExpenseTax };