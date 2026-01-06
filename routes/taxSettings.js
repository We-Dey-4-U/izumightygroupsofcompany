const express = require("express");
const router = express.Router();
const { auth, isAdmin } = require("../middleware/auth");
const TaxSettings = require("../models/TaxSettings");

// GET company tax settings
// GET company tax settings
router.get("/", auth, isAdmin, async (req, res) => {
  try {
    const companyId = req.user.companyId;

   let settings = await TaxSettings.findOne({ company: req.user.companyId });
if (!settings) {
  settings = await TaxSettings.create({
    company: employee.companyId._id,
    mode: "STANDARD_PAYE",
    customPercent: 0,
    nhfRate: 0.025,
    nhisEmployee: 0.05,
    nhisEmployer: 0.10
  });
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
    const companyId = req.user.companyId;

    const updated = await TaxSettings.findOneAndUpdate(
       { company: req.user.companyId }, // ✅ FIX
      { mode, customPercent },
      {
        new: true,
        upsert: true,
        runValidators: true            // 🔒 IMPORTANT
      }
    );

    res.json(updated);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;