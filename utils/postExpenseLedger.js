const LedgerEntry = require("../models/LedgerEntry");
const validateJournal = require("./ledger/validateJournal");
const mongoose = require("mongoose");

module.exports = async function postExpenseLedger(expense) {
  const journalId = new mongoose.Types.ObjectId();

  const entries = [
    {
      companyId: expense.companyId,
      journalId,
      account: "Expenses",
      accountCategory: "expense",
      entryType: "debit",
      amount: expense.amount,
      source: "expense",
      referenceId: expense._id,
      createdBy: expense.createdBy,
    },
    {
      companyId: expense.companyId,
      journalId,
      account: "Cash",
      accountCategory: "asset",
      entryType: "credit",
      amount: expense.amount,
      source: "expense",
      referenceId: expense._id,
      createdBy: expense.createdBy,
    },
  ];

  validateJournal(entries);
  await LedgerEntry.insertMany(entries);
};