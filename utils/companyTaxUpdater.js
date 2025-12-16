const Sale = require("../models/Sale");
const CompanyTaxLedger = require("../models/CompanyTaxLedger");
const Expense = require("../models/Expense");

const VAT_RATE = 0.075; // 7.5%

/**
 * UPSERT a CompanyTaxLedger entry for sales VAT
 * (Existing working function – DO NOT CHANGE)
 */
async function updateCompanyTaxFromSales(companyId, month, year, userId) {
  try {
    console.log(`🔵 [UPDATE TAX LEDGER] CompanyId: ${companyId}, Month: ${month}, Year: ${year}, UserId: ${userId}`);

    const start = new Date(year, month - 1, 1);
    const end = new Date(year, month, 1);

    // Fetch all sales
    const sales = await Sale.find({
      companyId,
      createdAt: { $gte: start, $lt: end },
    });

    console.log(`📊 Sales found: ${sales.length}`);
    if (!sales.length) return null;

    const totalSubtotal = sales.reduce((sum, s) => sum + (s.subtotal || 0), 0);
    const totalVatAmount = Number((totalSubtotal * VAT_RATE).toFixed(2));

    const period = `${year}-${month.toString().padStart(2, "0")}`;

    console.log(`💰 Total subtotal: ${totalSubtotal}, VAT: ${totalVatAmount}, Period: ${period}`);

    // UPSERT ledger entry
    let ledgerEntry = await CompanyTaxLedger.findOne({ companyId, taxType: "VAT", period, source: "Sale" });

    const ledgerData = {
      companyId,
      taxType: "VAT",
      period,
      basisAmount: totalSubtotal,
      rate: VAT_RATE,
      taxAmount: totalVatAmount,
      source: "Sale",
      sourceRefs: sales.map(s => s._id),
      auditTrail: { computedBy: userId, computedAt: new Date() },
    };

    if (ledgerEntry) {
      console.log("✏️ Updating existing ledger entry (Sale)");
      Object.assign(ledgerEntry, ledgerData);
      ledgerEntry = await ledgerEntry.save();
    } else {
      console.log("🆕 Creating new ledger entry (Sale)");
      ledgerEntry = await CompanyTaxLedger.create(ledgerData);
    }

    console.log("✅ Sale ledger entry saved:", ledgerEntry._id);
    return ledgerEntry;

  } catch (err) {
    console.error("🔥 [UPDATE TAX LEDGER ERROR]:", err);
    throw err;
  }
}

/**
 * UPSERT a CompanyTaxLedger entry for Expense VAT/WHT
 * Call this when an expense is APPROVED
 * Fully additive: multiple expenses in same period aggregate correctly
 */
async function updateCompanyTaxFromExpenses(expense) {
  try {
    const {
      companyId,
      dateOfExpense,
      vatAmount = 0,
      whtAmount = 0,
      _id,
      enteredByUser,
      amount = 0,
      taxFlags = {},
    } = expense;

    // Ensure dateOfExpense is a Date object
    const expenseDate = dateOfExpense instanceof Date ? dateOfExpense : new Date(dateOfExpense);
    const period = `${expenseDate.getFullYear()}-${(expenseDate.getMonth() + 1).toString().padStart(2, "0")}`;

    console.log(`🔵 [PROCESS EXPENSE TAX] CompanyId: ${companyId}, ExpenseId: ${_id}, Period: ${period}`);
    console.log(`💡 Flags: VAT=${taxFlags.vatClaimable}, WHT=${taxFlags.whtApplicable}, Amount=${amount}, VAT=${vatAmount}, WHT=${whtAmount}`);

    // Helper function to upsert ledger
    const upsertLedger = async ({ taxType, taxValue }) => {
      if (!taxFlags) return;
      if (!taxValue || taxValue <= 0) return;

      let ledger = await CompanyTaxLedger.findOne({ companyId, taxType, period, source: "Expense" });

      if (ledger) {
        // Avoid duplicate sourceRefs
        if (!ledger.sourceRefs.includes(_id)) ledger.sourceRefs.push(_id);

        ledger.basisAmount += amount;
        ledger.taxAmount += taxValue;
        ledger.rate = ledger.taxAmount / ledger.basisAmount;
        ledger.auditTrail = { computedBy: enteredByUser, computedAt: new Date() };

        await ledger.save();
        console.log(`✏️ Updated existing Expense ${taxType} ledger for period ${period}`);
      } else {
        await CompanyTaxLedger.create({
          companyId,
          taxType,
          period,
          basisAmount: amount,
          rate: taxValue / amount,
          taxAmount: taxValue,
          source: "Expense",
          sourceRefs: [_id],
          auditTrail: { computedBy: enteredByUser, computedAt: new Date() },
        });
        console.log(`🆕 Created new Expense ${taxType} ledger for period ${period}`);
      }
    };

    // 1️⃣ VAT Ledger
    if (taxFlags.vatClaimable && vatAmount > 0) {
      await upsertLedger({ taxType: "VAT", taxValue: vatAmount });
    }

    // 2️⃣ WHT Ledger
    if (taxFlags.whtApplicable && whtAmount > 0) {
      await upsertLedger({ taxType: "WHT", taxValue: whtAmount });
    }

    console.log(`✅ Expense tax ledger processing completed for ExpenseId ${_id}`);

  } catch (err) {
    console.error("🔥 [UPDATE EXPENSE TAX LEDGER ERROR]:", err);
    throw err;
  }
}

/**
 * Fetch all CompanyTaxLedger entries for a company
 * Optionally filter by taxType, source, or period
 */
async function getCompanyTaxLedger(companyId, filter = {}) {
  try {
    console.log(`🔵 [GET TAX LEDGER] CompanyId: ${companyId}, Filter:`, filter);
    const entries = await CompanyTaxLedger.find({ companyId, ...filter }).sort({ period: 1 });
    console.log(`📂 Found ${entries.length} ledger entries`);
    entries.forEach((e, idx) => {
      console.log(`Entry ${idx + 1}: taxType=${e.taxType}, source=${e.source}, period=${e.period}, basisAmount=${e.basisAmount}, taxAmount=${e.taxAmount}`);
    });
    return entries;
  } catch (err) {
    console.error("🔥 [GET TAX LEDGER ERROR]:", err);
    throw err;
  }
}

module.exports = {
  updateCompanyTaxFromSales,
  updateCompanyTaxFromExpenses,
  getCompanyTaxLedger,
};