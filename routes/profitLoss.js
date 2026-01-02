router.get("/profit-loss", async (req, res) => {
  const { companyId } = req.user;

  const data = await LedgerEntry.aggregate([
    { $match: { companyId } },
    {
      $group: {
        _id: { account: "$account", type: "$entryType" },
        total: { $sum: "$amount" }
      }
    }
  ]);

  const get = (acc, type) =>
    data.find(d => d._id.account === acc && d._id.type === type)?.total || 0;

  const revenue = get("Revenue", "credit");
  const cogs = get("Cost of Goods Sold", "debit");
  const expenses = get("Expenses", "debit");

  res.json({
    revenue,
    cogs,
    grossProfit: revenue - cogs,
    expenses,
    netProfit: revenue - cogs - expenses
  });
});