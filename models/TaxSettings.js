const mongoose = require("mongoose");

const taxSettingsSchema = new mongoose.Schema({
 company: {
  type: mongoose.Schema.Types.ObjectId,
  ref: "Company",
  required: true,
  unique: true,
  index: true
},
  mode: { type: String, enum: ["STANDARD_PAYE", "CUSTOM_PERCENT"], default: "STANDARD_PAYE" },
  customPercent: { type: Number, default: 0 },
  pensionEmployeeRate: { type: Number, default: 0.08 },
  pensionEmployerRate: { type: Number, default: 0.10 },
  nhfRate: { type: Number, default: 0.025 },
  nsitfRate: { type: Number, default: 0.01 },
  craMin: { type: Number, default: 200000 },
  fixedReliefAnnual: { type: Number, default: 200000 },
}, { timestamps: true });

module.exports = mongoose.model("TaxSettings", taxSettingsSchema);