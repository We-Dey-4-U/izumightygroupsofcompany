const bcrypt = require("bcryptjs");
const { User } = require("../models/user");
const Joi = require("joi");
const express = require("express");
const generateAuthToken = require("../utils/generateAuthToken");
const generateRefreshToken = require("../utils/generateRefreshToken");
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

    const { error } = schema.validate(req.body);
    if (error) return res.status(400).json({ message: error.details[0].message });

    const { email, password } = req.body;
    const user = await User.findOne({ email });
    if (!user) return res.status(400).json({ message: "Invalid email or password" });

    // 🔐 Check account lockout
    if (user.isLocked()) {
      return res
        .status(423)
        .json({ message: "Account locked due to multiple failed login attempts. Try later." });
    }

    // Check password
    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
      // Increment failed attempts
      user.failedLoginAttempts += 1;

      // Lock account after 5 failed attempts
      if (user.failedLoginAttempts >= 5) {
        user.lockUntil = new Date(Date.now() + 30 * 60 * 1000); // 30 minutes lock
      }

      await user.save();
      return res.status(400).json({ message: "Invalid email or password" });
    }

    // Reset failed attempts on successful login
    user.failedLoginAttempts = 0;
    user.lockUntil = null;
    await user.save();

    // Generate tokens
    const token = generateAuthToken(user);
    const refreshToken = generateRefreshToken(user);

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
      refreshToken,
    });
  } catch (err) {
    console.error("❌ Login error:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
});

module.exports = router;