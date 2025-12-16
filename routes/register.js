const bcrypt = require("bcryptjs");
const { User } = require("../models/user");
const Company = require("../models/Company");
const Joi = require("joi");
const express = require("express");
const generateAuthToken = require("../utils/generateAuthToken");
const router = express.Router();

// ---------------------------
// USER REGISTRATION
// ---------------------------
router.post("/", async (req, res) => {
  try {
    console.log("📌 [User Registration] Request body:", req.body);

    // Validate input
    const schema = Joi.object({
      name: Joi.string().min(3).max(30).required(),
      email: Joi.string().min(3).max(200).required().email(),
      password: Joi.string().min(6).max(200).required(),
      companyCode: Joi.number().required(),
    });

    const { error } = schema.validate(req.body);
    if (error) {
      console.warn("⚠ Validation failed:", error.details[0].message);
      return res.status(400).send(error.details[0].message);
    }

    const { name, email, password, companyCode } = req.body;
    console.log("✅ Validation passed");

    // Check for existing user
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      console.warn(`⚠ User already exists: ${email}`);
      return res.status(400).send("User already exists.");
    }

    // Lookup company
    const numericCode = Number(companyCode);
    console.log("🔹 Company code received:", numericCode);

    const companyDoc = await Company.findOne({ code: numericCode });
    if (!companyDoc) {
      console.warn("⚠ Company not found for code:", numericCode);
      return res
        .status(400)
        .send("Company not found. Please contact your administrator.");
    }
    console.log("✅ Company found:", companyDoc.name);

    // Create user
    const newUser = new User({
      name,
      email,
      password,
      company: companyDoc.name,
      companyId: companyDoc._id,
    });
    console.log("🔹 New user instance created");

    // Hash password
    const salt = await bcrypt.genSalt(10);
    newUser.password = await bcrypt.hash(password, salt);
    console.log("🔹 Password hashed");

    await newUser.save();
    console.log("✅ User saved:", newUser.email);

    // Generate token
    const token = generateAuthToken(newUser);
    console.log("🔹 Auth token generated");

    res.status(201).json({
      _id: newUser._id,
      name: newUser.name,
      email: newUser.email,
      company: newUser.company,
      companyId: newUser.companyId,
      isAdmin: newUser.isAdmin,
      isStaff: newUser.isStaff,
      isSuperStakeholder: newUser.isSuperStakeholder,
      isSubAdmin: newUser.isSubAdmin,
      token,
    });
  } catch (err) {
    console.error("❌ Registration error:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
});

module.exports = router;