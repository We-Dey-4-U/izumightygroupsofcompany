const LedgerEntry = require("../models/LedgerEntry");
const InventoryProduct = require("../models/InventoryProduct");
const validateJournal = require("./ledger/validateJournal");
const mongoose = require("mongoose");

module.exports = async function postSaleLedger(sale) {
  const journalId = new mongoose.Types.ObjectId();
  const entries = [];

  // Cash
  entries.push({
    companyId: sale.companyId,
    journalId,
    account: "Cash",
    accountCategory: "asset",
    entryType: "debit",
    amount: sale.totalAmount,
    source: "sale",
    referenceId: sale._id,
    createdBy: sale.createdBy,
  });

  // Revenue
  entries.push({
    companyId: sale.companyId,
    journalId,
    account: "Revenue",
    accountCategory: "income",
    entryType: "credit",
    amount: sale.subtotal,
    source: "sale",
    referenceId: sale._id,
    createdBy: sale.createdBy,
  });

  // VAT Payable
  if (sale.vatAmount > 0) {
    entries.push({
      companyId: sale.companyId,
      journalId,
      account: "VAT Payable",
      accountCategory: "liability",
      entryType: "credit",
      amount: sale.vatAmount,
      source: "sale",
      referenceId: sale._id,
      createdBy: sale.createdBy,
    });
  }

  // Inventory & COGS
  for (const item of sale.items) {
    const product = await InventoryProduct.findById(item.productId);
    const cost = product.costPrice * item.quantity;

    entries.push(
      {
        companyId: sale.companyId,
        journalId,
        account: "Cost of Goods Sold",
        accountCategory: "expense",
        entryType: "debit",
        amount: cost,
        source: "sale",
        referenceId: sale._id,
        createdBy: sale.createdBy,
      },
      {
        companyId: sale.companyId,
        journalId,
        account: "Inventory",
        accountCategory: "asset",
        entryType: "credit",
        amount: cost,
        source: "sale",
        referenceId: sale._id,
        createdBy: sale.createdBy,
      }
    );
  }

  validateJournal(entries);
  await LedgerEntry.insertMany(entries);
};