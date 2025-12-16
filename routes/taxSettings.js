const express = require("express");
const router = express.Router();
const { auth, isAdmin } = require("../middleware/auth");
const TaxSettings = require("../models/TaxSettings");

// GET company tax settings
router.get("/", auth, isAdmin, async (req, res) => {
  try {
    const settings = await TaxSettings.findOne({ companyId: req.user.companyId });

    if (!settings) {
      const newSettings = await TaxSettings.create({
        companyId: req.user.companyId,
        mode: "STANDARD_PAYE",
        customPercent: 0
      });
      return res.json(newSettings);
    }

    res.json(settings);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// UPDATE settings
router.put("/", auth, isAdmin, async (req, res) => {
  try {
    const { mode, customPercent } = req.body;

    const updated = await TaxSettings.findOneAndUpdate(
      { companyId: req.user.companyId },
      { mode, customPercent },
      { new: true, upsert: true }
    );

    res.json(updated);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;