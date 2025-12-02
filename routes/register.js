const bcrypt = require("bcryptjs");
const { User } = require("../models/user");
const Joi = require("joi");
const express = require("express");
const generateAuthToken = require("../utils/generateAuthToken");
const router = express.Router();

// Registration Route
router.post("/", async (req, res) => {
  // ✅ Updated Joi schema to allow manual company input
  const schema = Joi.object({
    name: Joi.string().min(3).max(30).required(),
    email: Joi.string().min(3).max(200).required().email(),
    password: Joi.string().min(6).max(200).required(),
    company: Joi.string().min(2).max(50).required(), // ✅ Removed enum, allow any string
  });

  const { error } = schema.validate(req.body);
  if (error) return res.status(400).send(error.details[0].message);

  let user = await User.findOne({ email: req.body.email });
  if (user) return res.status(400).send("User already exists...");

  const { name, email, password, company } = req.body;

  user = new User({ name, email, password, company });

  const salt = await bcrypt.genSalt(10);
  user.password = await bcrypt.hash(user.password, salt);

  await user.save();

  const token = generateAuthToken(user);
  res.send(token);
});

module.exports = router;