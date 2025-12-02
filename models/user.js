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

      company: {
  type: String,
  required: true, // no enum, user can type any company
  minlength: 2,
  maxlength: 50
},
      // 🔥 NEW FIELD — COMPANY ENUM
   // company: {
   //   type: String,
    //  enum: ["Agreeko", "Welbeg","Techwireict"],   // ⬅ ONLY allowed companies
   //   required: true
   // },

   //   company: { type: mongoose.Schema.Types.ObjectId, ref: "Company", required: true }, // 🔹 Link user to company
    isAdmin: { type: Boolean, default: false },
    isStaff: { type: Boolean, default: false },
    isSuperStakeholder: { type: Boolean, default: false }, // ✅ NEW FIELD
     isSubAdmin: { type: Boolean, default: false },
    //  isSuperAdmin: { type: Boolean, default: false }, // Only superadmin can onboard companies
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