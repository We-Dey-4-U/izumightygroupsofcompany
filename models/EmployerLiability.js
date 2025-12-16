// models/EmployerLiability.js
const mongoose = require("mongoose");

const employerLiabilitySchema = new mongoose.Schema({
  company: { type: String, required: true },
  employeeId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  month: { type: String, required: true },
  year: { type: Number, required: true },
  employerPension: { type: Number, default: 0 },
  nsitf: { type: Number, default: 0 },
  otherEmployerCosts: { type: Number, default: 0 },
  totalLiability: { type: Number, default: 0 },
  recordedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
}, { timestamps: true });

employerLiabilitySchema.index({ company: 1, month: 1, year: 1 });

module.exports = mongoose.model("EmployerLiability", employerLiabilitySchema);