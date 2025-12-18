const mongoose = require("mongoose");

const companyTaxLedgerSchema = new mongoose.Schema(
  {
    companyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Company",
      required: true,
      index: true
    },

    taxType: {
  type: String,
  enum: ["VAT", "WHT", "CIT", "TET", "PAYE", "NHF", "NHIS", "NHIS_EMPLOYER"],
  required: true
},

    period: {
      type: String,
      required: true // e.g. 2025-01 or 2025-Q1
    },

    basisAmount: {
      type: Number,
      required: true
    },

    rate: {
      type: Number,
      required: true
    },

    taxAmount: {
      type: Number,
      required: true
    },

    // ✅ Added "Sale" to enum
    source: {
      type: String,
      enum: ["Invoice", "Expense", "ProfitComputation", "Payroll", "Sale"],
      required: true
    },

    // Rename to plural consistency
    sourceRefs: [{ type: mongoose.Schema.Types.ObjectId }],

    remitted: {
      type: Boolean,
      default: false
    },

    remittanceDate: Date,
    firsReceiptNo: String,

    /** 🔍 AUDIT METADATA */
    auditTrail: {
      computedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
      computedAt: { type: Date, default: Date.now },
      lawVersion: { type: String, default: "FIRS-2023" },
      notes: String
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model("CompanyTaxLedger", companyTaxLedgerSchema);