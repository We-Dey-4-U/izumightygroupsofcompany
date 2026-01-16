const bcrypt = require("bcryptjs");
const { User } = require("../models/user");
const Company = require("../models/Company");
const Joi = require("joi");
const express = require("express");
const generateAuthToken = require("../utils/generateAuthToken");

// ✅ Import sanitize middleware
const sanitizeBody = require("../middleware/sanitize");

const router = express.Router();

// ---------------------------
// USER REGISTRATION ROUTE
// ---------------------------
router.post(
  "/", 
  // 🔐 Sanitize user input fields
  sanitizeBody(["name"]),
  async (req, res) => {
    console.log("📌 [User Registration] Received request");

    try {
      // ---------------------------
      // Step 1: Validate user input
      // ---------------------------
      console.log("🔹 Validating user input...");
      const PASSWORD_REGEX = /^(?=.*[A-Z])(?=.*[@#$%^&*])[A-Za-z\d@#$%^&*]{8,}$/;

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

      // ---------------------------
      // Step 2: Check if user exists
      // ---------------------------
      console.log("🔹 Checking if user already exists...");
      const existingUser = await User.findOne({ email: normalizedEmail });
      if (existingUser) {
        console.warn("⚠ User already exists:", normalizedEmail);
        return res.status(400).json({ message: "User already exists." });
      }

      // ---------------------------
      // Step 3: Optional company lookup
      // ---------------------------
      let companyDoc = null;
      let companyName = null;
      let companyId = null;

      if (companyCode) {
        console.log("🔹 Checking company code:", companyCode);
        try {
          // Increase maxTimeMS for production in case of slow queries
          companyDoc = await Company.findOne({ code: Number(companyCode) }).maxTimeMS(10000);
          if (!companyDoc) {
            console.warn("⚠ Company not found:", companyCode);
            return res
              .status(400)
              .json({ message: "Company not found. Please contact your administrator." });
          }

          companyName = companyDoc.name;
          companyId = companyDoc._id;
        } catch (err) {
          console.error("❌ Company lookup failed:", err);
          return res.status(500).json({ message: "Company lookup failed" });
        }
      }

      // ---------------------------
      // Step 4: Create new user
      // ---------------------------
      console.log("🔹 Creating new user document...");
      const newUser = new User({
        name,
        email: normalizedEmail,
        password, // will hash below
        company: companyName,
        companyId,
      });

      // ---------------------------
      // Step 5: Hash password
      // ---------------------------
      console.log("🔹 Hashing password...");
      try {
        const salt = await bcrypt.genSalt(10); // stronger salt
        newUser.password = await bcrypt.hash(password, salt);
      } catch (err) {
        console.error("❌ Password hashing failed:", err);
        return res.status(500).json({ message: "Failed to hash password" });
      }

      // ---------------------------
      // Step 6: Save user to DB
      // ---------------------------
      console.log("🔹 Saving user to database...");
      try {
        await newUser.save();
      } catch (err) {
        console.error("❌ Saving user failed:", err);
        if (err.code === 11000) {
          return res.status(400).json({ message: "User with this email already exists" });
        }
        return res.status(500).json({ message: "Failed to save user" });
      }

      // ---------------------------
      // Step 7: Generate auth token & respond
      // ---------------------------
      console.log("🔹 Generating auth token...");
      const token = generateAuthToken(newUser);

      console.log("✅ User registered successfully:", newUser._id);
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
      console.error("❌ Registration route error:", err);
      res.status(500).json({ message: "Server error" });
    }
  }
);

module.exports = router;