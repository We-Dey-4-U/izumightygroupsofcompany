const bcrypt = require("bcryptjs");
const { User } = require("../models/user");
const Joi = require("joi");
const express = require("express");
const generateAuthToken = require("../utils/generateAuthToken");
const router = express.Router();

router.post("/", async (req, res) => {
  // Validation schema
  const schema = Joi.object({
    email: Joi.string().min(3).max(200).required().email(),
    password: Joi.string().min(6).max(200).required(),
  });

  const { error } = schema.validate(req.body);
  if (error) return res.status(400).send(error.details[0].message);

  // Find user
  const user = await User.findOne({ email: req.body.email });
  if (!user) return res.status(400).send("Invalid email or password...");

  // Check password
  const validPassword = await bcrypt.compare(req.body.password, user.password);
  if (!validPassword) return res.status(400).send("Invalid email or password...");

  // Generate token
  const token = generateAuthToken(user);

  // Respond with user info
  res.status(200).json({
  _id: user._id,
  name: user.name,
  email: user.email,
  isAdmin: user.isAdmin,
  isStaff: user.isStaff,
  isSuperStakeholder: user.isSuperStakeholder,
  isSubAdmin: user.isSubAdmin, // ✅ Add this line
  token,
});
});

module.exports = router;