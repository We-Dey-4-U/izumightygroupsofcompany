const express = require("express");
const router = express.Router();
const { auth, isAdmin } = require("../middleware/auth");
const { generateMonthlyPAYE } = require("../services/payeRemittance.service");

router.get("/monthly", auth, isAdmin, async (req, res) => {
  const { year, month } = req.query;

  if (!year || !month) {
    return res.status(400).json({ message: "Year and month required" });
  }

  const summary = await generateMonthlyPAYE({
    companyId: req.user.companyId,
    year,
    month
  });

  res.json(summary);
});

module.exports = router;