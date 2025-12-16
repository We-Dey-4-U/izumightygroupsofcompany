const express = require("express");
const router = express.Router();
const { auth, isAdmin } = require("../middleware/auth");
const { getMonthlyPAYESummary } = require("../services/payeSummary.service");

router.get("/", auth, isAdmin, async (req, res) => {
  const summary = await getMonthlyPAYESummary(req.user.companyId);
  res.json(summary);
});

module.exports = router;