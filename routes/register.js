const bcrypt = require("bcryptjs");
const { User } = require("../models/user");
const Joi = require("joi");
const express = require("express");
const generateAuthToken = require("../utils/generateAuthToken");
const router = express.Router();

//WHEN WE CALL THIS ROUTE IT WILL PERFORM A CHECK OF THE DATA COMING IN
router.post("/", async (req, res) => {
  const schema = Joi.object({              
    name: Joi.string().min(3).max(30).required(),
    email: Joi.string().min(3).max(200).required().email(),
    password: Joi.string().min(6).max(200).required(),
  });

  const { error } = schema.validate(req.body);

  if (error) return res.status(400).send(error.details[0].message); //HERE WILL RETURN AN ERROR MESSAGE

  let user = await User.findOne({ email: req.body.email });   //CHECK IF THE USER ALREADY EXIST IN DATABASE
  if (user) return res.status(400).send("User already exists...");

  console.log("here");

  const { name, email, password } = req.body; 

  user = new User({ name, email, password }); //IF USER DOES NOT EXIST.WE GO AHEAD AND REGISTER NEW USER

  const salt = await bcrypt.genSalt(10);  //HERE WE HASH THE NEW USER PASSWORD 
  user.password = await bcrypt.hash(user.password, salt);

  await user.save(); //AND SAVE IT TO OUR DATABASE

  const token = generateAuthToken(user); //THEN WE GENERATE TOKEN AND PASS IT TO USER

  res.send(token);  //WE SEND IT TO FRONTEND
});

module.exports = router;