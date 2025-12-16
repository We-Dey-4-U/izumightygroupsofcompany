router.post("/paye", auth, isAdmin, async (req, res) => {
  const { period, receiptNo } = req.body;

  await markAsRemitted({
    companyId: req.user.companyId,
    period,
    receiptNo
  });

  res.json({ message: "PAYE marked as remitted" });
});