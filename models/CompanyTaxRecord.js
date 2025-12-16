// models/CompanyTaxRecord.js
const mongoose = require("mongoose");

const companyTaxSchema = new mongoose.Schema({
  company: { type: String, required: true },
  month: { type: String, required: true },
  year: { type: Number, required: true },

  // VAT (AUTO)
  vatFromSales: { type: Number, default: 0 },
  vatableSales: { type: Number, default: 0 },
  vatRate: { type: Number, default: 7.5 },

  // MANUAL (COMPLIANT)
  cit: { type: Number, default: 0 },
  wht: { type: Number, default: 0 },
  tet: { type: Number, default: 0 },

  notes: String
}, { timestamps: true });

companyTaxSchema.index({ company: 1, month: 1, year: 1 }, { unique: true });

module.exports = mongoose.model("CompanyTaxRecord", companyTaxSchema);