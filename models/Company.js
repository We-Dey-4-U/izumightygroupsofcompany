const mongoose = require("mongoose");

const companySchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true },
  registrationNumber: { type: String, required: true, unique: true },
  address: { type: String },
  contactEmail: { type: String },
  contactPhone: { type: String },
  isActive: { type: Boolean, default: true }, // deactivate company if needed
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" }, // Superadmin
}, { timestamps: true });

module.exports = mongoose.model("Company", companySchema);