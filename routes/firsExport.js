const express = require("express");
const router = express.Router();         // 🔹 Must declare this first
const { auth, isAdmin } = require("../middleware/auth");
const { exportPAYECSV } = require("../services/payeCSV.service"); // your service

// Download PAYE CSV
router.get("/paye-csv", auth, isAdmin, async (req, res) => {
  try {
    const { period } = req.query;
    if (!period) return res.status(400).json({ message: "Period is required" });

    const csvData = await exportPAYECSV(req.user.companyId, period);

    res.setHeader("Content-Type", "text/csv");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename=FIRS_PAYE_${period}.csv`
    );
    res.send(csvData);
  } catch (error) {
    console.error("FIRS CSV export error:", error);
    res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;