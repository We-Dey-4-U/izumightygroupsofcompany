const express = require("express");
const router = express.Router();
const Company = require("../models/Company");
const { auth, isSuperAdmin } = require("../middleware/auth");

// Generate unique 4-digit company code
function generateCompanyCode() {
  return Math.floor(1000 + Math.random() * 9000);
}

// Create a new company — ONLY SUPERADMIN
router.post("/create", auth, isSuperAdmin, async (req, res) => {
  console.log("POST /api/company/create called");
  console.log("Headers:", req.headers);
  console.log("Body:", req.body);

  try {
    const { name, rcNumber, tin, state, isVATRegistered } = req.body;

    // Ensure unique code
    let code, exists = true;
    while (exists) {
      code = generateCompanyCode();
      exists = await Company.findOne({ code });
    }

    const company = new Company({
      name,
      rcNumber,
      tin,
      state,
      isVATRegistered,
      code,
    });

    await company.save();
    console.log("Company created:", company);
    res.status(201).json(company);
  } catch (err) {
    console.error("Error creating company:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
});

// Get all companies — ONLY SUPERADMIN
router.get("/", auth, isSuperAdmin, async (req, res) => {
  console.log("GET /api/company called");
  console.log("Headers:", req.headers);

  try {
    const companies = await Company.find();
    console.log("Fetched companies:", companies.length);
    res.status(200).json(companies);
  } catch (err) {
    console.error("Error fetching companies:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
});

module.exports = router;