const express = require("express");
const router = express.Router();
const { auth, isAdmin } = require("../middleware/auth");
const EmployeeInfo = require("../models/EmployeeInfo");

// GET all employee info for admin
router.get("/all", auth, isAdmin, isSuperStakeholder, async (req, res) => {
  try {
    const allEmployees = await EmployeeInfo.find().populate("user", "name email role");
    res.status(200).json(allEmployees);
  } catch (err) {
    console.error("❌ Error fetching all employee info:", err);
    res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;