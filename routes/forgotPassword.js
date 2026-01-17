const express = require("express");
const crypto = require("crypto");
const { User } = require("../models/user");
const bcrypt = require("bcryptjs");
const Joi = require("joi");
const sendEmail = require("../utils/sendEmail"); // You need a mailer utility
const router = express.Router();

// ----------------------------
// Request password reset
// ----------------------------
router.post("/request", async (req, res) => {
  const schema = Joi.object({ email: Joi.string().email().required() });
  const { error } = schema.validate(req.body);
  if (error) return res.status(400).json({ message: error.details[0].message });

  try {
    const user = await User.findOne({ email: req.body.email.toLowerCase() });
    if (!user) return res.status(404).json({ message: "User not found" });

    // Generate token
    const token = crypto.randomBytes(32).toString("hex");
    user.resetPasswordToken = token;
    user.resetPasswordExpires = Date.now() + 3600000; // 1 hour
    await user.save();

    // Send email (implement sendEmail)
    const resetUrl = `${process.env.FRONTEND_URL}/reset-password/${token}`;
    await sendEmail(user.email, "Password Reset", `Click to reset: ${resetUrl}`);

    res.status(200).json({ message: "Password reset link sent to your email" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

// ----------------------------
// Reset password using token
// ----------------------------
router.post("/reset/:token", async (req, res) => {
  const schema = Joi.object({ password: Joi.string().min(6).required() });
  const { error } = schema.validate(req.body);
  if (error) return res.status(400).json({ message: error.details[0].message });

  try {
    const user = await User.findOne({
      resetPasswordToken: req.params.token,
      resetPasswordExpires: { $gt: Date.now() },
    });
    if (!user) return res.status(400).json({ message: "Invalid or expired token" });

    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(req.body.password, salt);
    user.resetPasswordToken = null;
    user.resetPasswordExpires = null;
    await user.save();

    res.status(200).json({ message: "Password reset successful" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;