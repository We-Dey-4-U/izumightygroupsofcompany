const mongoose = require("mongoose");
const CompanyTaxLedger = require("../models/CompanyTaxLedger");

/**
 * UPSERT a tax entry in CompanyTaxLedger
 * @param {Object} options
 * @param {mongoose.Types.ObjectId} options.companyId - Company ID
 * @param {String} options.taxType - "VAT" or "WHT"
 * @param {String} options.period - YYYY-MM
 * @param {Number} options.basisAmount - Amount the tax is computed on
 * @param {Number} options.rate - Tax rate (decimal, e.g., 0.075)
 * @param {Number} options.taxAmount - Calculated tax
 * @param {String} options.source - "Sale" | "Expense"
 * @param {Array<mongoose.Types.ObjectId>} options.sourceRefs - Array of ObjectId references
 * @param {mongoose.Types.ObjectId} options.userId - User performing the computation
 */
async function upsertLedgerEntry({
  companyId,
  taxType,
  period,
  basisAmount,
  rate,
  taxAmount,
  source,
  sourceRefs,
  userId
}) {
  if (!mongoose.Types.ObjectId.isValid(companyId)) {
    throw new Error("Invalid companyId passed to ledger");
  }

  const existing = await CompanyTaxLedger.findOne({
    companyId,
    taxType,
    period,
    source,
    sourceRefs: sourceRefs.length === 1 ? sourceRefs[0] : undefined
  });

  const ledgerData = {
    companyId,
    taxType,
    period,
    basisAmount,
    rate,
    taxAmount,
    source,
    sourceRefs,
    auditTrail: { processedBy: userId, processedAt: new Date() },
  };

  if (existing) {
    Object.assign(existing, ledgerData);
    await existing.save();
    return existing;
  } else {
    return CompanyTaxLedger.create(ledgerData);
  }
}

/**
 * Process Expense Tax (VAT/WHT) via shared ledger utility
 */
async function processExpenseTax(expense, companyId, userId) {
  if (!mongoose.Types.ObjectId.isValid(companyId)) throw new Error("Invalid companyId");

  const period = expense.dateOfExpense.toISOString().slice(0, 7);
  const sourceRefs = [expense._id];

  if (expense.taxFlags?.vatClaimable && expense.vatAmount > 0) {
    await upsertLedgerEntry({
      companyId,
      taxType: "VAT",
      period,
      basisAmount: expense.amount,
      rate: 0.075,
      taxAmount: expense.vatAmount,
      source: "Expense",
      sourceRefs,
      userId
    });
  }

  if (expense.taxFlags?.whtApplicable && expense.whtAmount > 0) {
    await upsertLedgerEntry({
      companyId,
      taxType: "WHT",
      period,
      basisAmount: expense.amount,
      rate: expense.whtRate,
      taxAmount: expense.whtAmount,
      source: "Expense",
      sourceRefs,
      userId
    });
  }
}

/**
 * Process Sales Tax (VAT) via shared ledger utility
 */
async function updateCompanyTaxFromSales(companyId, month, year, userId) {
  if (!mongoose.Types.ObjectId.isValid(companyId)) throw new Error("Invalid companyId");

  const start = new Date(year, month - 1, 1);
  const end = new Date(year, month, 1);

  const Sale = require("../models/Sale");
  const VAT_RATE = 0.075;

  // 🔥 FIX: query by companyId, not company name
  const sales = await Sale.find({
    companyId, // ✅ must be ObjectId
    createdAt: { $gte: start, $lt: end }
  });

  if (!sales.length) return null;

  const totalSubtotal = sales.reduce((sum, s) => sum + (s.subtotal || 0), 0);
  const totalVatAmount = Number((totalSubtotal * VAT_RATE).toFixed(2));
  const period = `${year}-${month.toString().padStart(2, "0")}`;

  return upsertLedgerEntry({
    companyId,
    taxType: "VAT",
    period,
    basisAmount: totalSubtotal,
    rate: VAT_RATE,
    taxAmount: totalVatAmount,
    source: "Sale",
    sourceRefs: sales.map(s => s._id),
    userId
  });
}

/**
 * Fetch all CompanyTaxLedger entries for a company
 * Optionally filter by taxType or period
 */
async function getCompanyTaxLedger(companyId, filter = {}) {
  if (!mongoose.Types.ObjectId.isValid(companyId)) throw new Error("Invalid companyId");
  return CompanyTaxLedger.find({ companyId, ...filter }).sort({ period: 1 });
}

module.exports = {
  upsertLedgerEntry,
  processExpenseTax,
  updateCompanyTaxFromSales,
  getCompanyTaxLedger
};