const mongoose = require("mongoose");

const taxHistorySchema = new mongoose.Schema(
  {
    payrollId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Payroll",
      required: true,
    },
    employeeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    month: { type: String, required: true },
    year: { type: Number, required: true },

    // Employee-level payroll details
    grossSalary: { type: Number, required: true },
    taxDeduction: { type: Number, default: 0 }, // PAYE
    nhfDeduction: { type: Number, default: 0 },
    nhisEmployeeDeduction: { type: Number, default: 0 },
    nhisEmployerContribution: { type: Number, default: 0 },
    pensionDeduction: { type: Number, default: 0 },
    otherDeductions: { type: Number, default: 0 },
    netPay: { type: Number, required: true },

    // Company-level taxes
    companyTaxes: {
      cit: { type: Number, default: 0 },
      vat: { type: Number, default: 0 },
      wht: { type: Number, default: 0 },
      tet: { type: Number, default: 0 },
    },
  },
  { timestamps: true }
);

// Prevent duplicate records for the same employee/month/year
taxHistorySchema.index({ employeeId: 1, month: 1, year: 1 }, { unique: true });

module.exports = mongoose.model("TaxHistory", taxHistorySchema);