const bcrypt = require("bcryptjs");
const { User } = require("../models/user");
const Company = require("../models/Company");
const Joi = require("joi");
const express = require("express");
const generateAuthToken = require("../utils/generateAuthToken");
const router = express.Router();

// ---------------------------
// USER REGISTRATION ROUTE
// ---------------------------
router.post("/", async (req, res) => {
  try {
    console.log("📌 [User Registration] Request body:", req.body);

    // Password policy: at least 8 chars, 1 uppercase, 1 special character
    const PASSWORD_REGEX = /^(?=.*[A-Z])(?=.*[@#$%^&*])[A-Za-z\d@#$%^&*]{8,}$/;

    // ✅ Validation schema
    const schema = Joi.object({
      name: Joi.string().min(3).max(30).required(),
      email: Joi.string().min(3).max(200).required().email(),
      password: Joi.string()
        .pattern(PASSWORD_REGEX)
        .required()
        .messages({
          "string.pattern.base":
            "Password must be at least 8 characters long, include one uppercase letter and one special character (@#$%^&*)",
        }),
      companyCode: Joi.number().optional(),
    });

    const { error } = schema.validate(req.body);
    if (error) {
      console.warn("⚠ Validation failed:", error.details[0].message);
      return res.status(400).json({ message: error.details[0].message });
    }

    const { name, email, password, companyCode } = req.body;
    const normalizedEmail = email.toLowerCase().trim();

    // Check existing user
    const existingUser = await User.findOne({ email: normalizedEmail });
    if (existingUser) return res.status(400).json({ message: "User already exists." });

    let companyDoc = null;
    let companyName = null;
    let companyId = null;

    if (companyCode) {
      companyDoc = await Company
  .findOne({ code: Number(companyCode) })
  .maxTimeMS(5000);
      if (!companyDoc)
        return res
          .status(400)
          .json({ message: "Company not found. Please contact your administrator." });

      companyName = companyDoc.name;
      companyId = companyDoc._id;
    }

    // Create user
    const newUser = new User({
  name,
  email: normalizedEmail,
  password,
  company: companyName,
  companyId,
});

    // 🔐 Hash password
    const salt = await bcrypt.genSalt(8);
    newUser.password = await bcrypt.hash(password, salt);

    await newUser.save();

    const token = generateAuthToken(newUser);

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

  if (err.code === 11000) {
    return res.status(400).json({
      message: "User with this email already exists",
    });
  }

  res.status(500).json({ message: "Server error" });
}
});

module.exports = router;