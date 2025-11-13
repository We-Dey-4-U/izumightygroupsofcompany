const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, minlength: 3, maxlength: 30 },
    email: {
      type: String,
      required: true,
      minlength: 3,
      maxlength: 200,
      unique: true,
    },
    password: { 
      type: String, 
      required: true, 
      minlength: 3, 
      maxlength: 1024 
     },
    isAdmin: { type: Boolean, default: false },
    isStaff: { type: Boolean, default: false },
    isSuperStakeholder: { type: Boolean, default: false }, // ✅ NEW FIELD
  },
  { timestamps: true }
);

const User = mongoose.model("User", userSchema);

exports.User = User;