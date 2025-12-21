const bcrypt = require("bcryptjs");
const { User } = require("../models/user");
const Joi = require("joi");
const express = require("express");
const generateAuthToken = require("../utils/generateAuthToken");
const router = express.Router();

// ---------------------------
// LOGIN ROUTE
// ---------------------------
router.post("/", async (req, res) => {
  try {
    // ✅ Validation schema
    const schema = Joi.object({
      email: Joi.string().min(3).max(200).required().email(),
      password: Joi.string().min(6).max(200).required(),
    });

    // Validate input
    const { error } = schema.validate(req.body);
    if (error) return res.status(400).json({ message: error.details[0].message });

    const { email, password } = req.body;

    // Find user
    const user = await User.findOne({ email });
    if (!user) return res.status(400).json({ message: "Invalid email or password" });

    // Check password
    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) return res.status(400).json({ message: "Invalid email or password" });

    // Generate token (include company info)
    const token = generateAuthToken(user);

    // Respond with user info
    res.status(200).json({
      _id: user._id,
      name: user.name,
      email: user.email,
      isAdmin: user.isAdmin,
      isStaff: user.isStaff,
      isSuperStakeholder: user.isSuperStakeholder,
      isSubAdmin: user.isSubAdmin,
      isSuperAdmin: user.isSuperAdmin,
      company: user.company,
      token,
    });
  } catch (err) {
    console.error("❌ Login error:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
});

module.exports = router;