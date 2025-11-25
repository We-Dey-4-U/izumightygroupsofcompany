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







































//const mongoose = require("mongoose");

//const userSchema = new mongoose.Schema(
//  {
 //   name: { type: String, required: true, minlength: 3, maxlength: 30 },

 //   email: {
  //    type: String,
  //    required: true,
  //    minlength: 3,
  //    maxlength: 200,
  //    unique: true,
  //  },

 //   password: { 
  ///    type: String, 
  //    required: true, 
  //    minlength: 6, 
   //   maxlength: 1024 
   // },

   // role: {
   //   type: String,
  //    enum: ["superadmin", "company-admin", "staff"],
  //    default: "staff",
  //  },

   // company: {
   //   type: mongoose.Schema.Types.ObjectId,
   //   ref: "Company",
   //   default: null,   // superadmin will have null
  //  },
 // },
 // { timestamps: true }
//);

//const User = mongoose.model("User", userSchema);

//exports.User = User;