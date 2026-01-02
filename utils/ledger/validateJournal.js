module.exports = function validateJournal(entries) {
  const debit = entries
    .filter(e => e.entryType === "debit")
    .reduce((s, e) => s + e.amount, 0);

  const credit = entries
    .filter(e => e.entryType === "credit")
    .reduce((s, e) => s + e.amount, 0);

  if (debit !== credit) {
    throw new Error("Ledger imbalance: debit and credit mismatch");
  }
};