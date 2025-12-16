const CompanyTaxLedger = require("../models/CompanyTaxLedger");

/**
 * Records tax entries (VAT/WHT) from an expense to the CompanyTaxLedger
 */
async function processExpenseTax(expense, companyId, userId) {
  const period = expense.dateOfExpense.toISOString().slice(0, 7); // YYYY-MM
  const sourceRefs = [expense._id];

  console.log(`🔵 [PROCESS EXPENSE TAX] CompanyId: ${companyId}, UserId: ${userId}, Period: ${period}`);

  // VAT (Input VAT)
  if (expense.taxFlags?.vatClaimable && expense.vatAmount > 0) {
    const existingVat = await CompanyTaxLedger.findOne({
      companyId,
      taxType: "VAT",
      period,
      source: "Expense",
      sourceRefs: { $in: sourceRefs },
    });

    if (existingVat) {
      existingVat.basisAmount = expense.amount;
      existingVat.taxAmount = expense.vatAmount;
      existingVat.rate = 0.075;
      existingVat.auditTrail = { processedBy: userId, processedAt: new Date() };
      await existingVat.save();
    } else {
      await CompanyTaxLedger.create({
        companyId,
        taxType: "VAT",
        period,
        basisAmount: expense.amount,
        rate: 0.075,
        taxAmount: expense.vatAmount,
        source: "Expense",
        sourceRefs,
        auditTrail: { processedBy: userId, processedAt: new Date() },
      });
    }
  }

  // WHT
  if (expense.taxFlags?.whtApplicable && expense.whtAmount > 0) {
    const existingWht = await CompanyTaxLedger.findOne({
      companyId,
      taxType: "WHT",
      period,
      source: "Expense",
      sourceRefs: { $in: sourceRefs },
    });

    if (existingWht) {
      existingWht.basisAmount = expense.amount;
      existingWht.taxAmount = expense.whtAmount;
      existingWht.rate = expense.whtRate;
      existingWht.auditTrail = { processedBy: userId, processedAt: new Date() };
      await existingWht.save();
    } else {
      await CompanyTaxLedger.create({
        companyId,
        taxType: "WHT",
        period,
        basisAmount: expense.amount,
        rate: expense.whtRate,
        taxAmount: expense.whtAmount,
        source: "Expense",
        sourceRefs,
        auditTrail: { processedBy: userId, processedAt: new Date() },
      });
    }
  }
}

module.exports = { processExpenseTax };