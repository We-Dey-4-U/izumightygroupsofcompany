router.get("/balance-sheet", async (req, res) => {
  const { companyId } = req.user;

  const ledger = await LedgerEntry.find({ companyId });

  const balance = acc =>
    ledger.reduce((t, l) => {
      if (l.account !== acc) return t;
      return l.entryType === "debit" ? t + l.amount : t - l.amount;
    }, 0);

  res.json({
    assets: {
      cash: balance("Cash"),
      inventory: balance("Inventory"),
    },
    liabilities: {
      vatPayable: balance("VAT Payable"),
    },
    equity: {
      retainedEarnings: balance("Revenue") - balance("Expenses"),
    }
  });
});