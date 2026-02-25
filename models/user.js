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

    company: { type: String, default: null },
    companyId: { type: mongoose.Schema.Types.ObjectId, ref: "Company", default: null },

       permissions: {
  type: [String],
  default: []
},

    isAdmin: { type: Boolean, default: false },
    isStaff: { type: Boolean, default: false },
    isSuperStakeholder: { type: Boolean, default: false },
    isSubAdmin: { type: Boolean, default: false },
    isSuperAdmin: { type: Boolean, default: false },
    isFreelancer: { type: Boolean, default: false },

    // 🔐 Account lockout fields
    failedLoginAttempts: { type: Number, default: 0 },
    lockUntil: { type: Date, default: null },

    
    // 🔑 Reset password fields
    resetPasswordToken: { type: String, default: null },
    resetPasswordExpires: { type: Date, default: null },
  },
  { timestamps: true }
);

// Check if account is locked
userSchema.methods.isLocked = function () {
  return this.lockUntil && this.lockUntil > Date.now();
};

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