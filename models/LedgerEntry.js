const mongoose = require("mongoose");

const ledgerEntrySchema = new mongoose.Schema(
  {
    companyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Company",
      required: true,
      index: true,
    },

    account: {
      type: String,
      required: true,
      enum: [
        "Cash",
        "Bank",
        "Accounts Receivable",
        "Inventory",
        "Cost of Goods Sold",
        "Revenue",
        "VAT Payable",
        "VAT Receivable",
        "Expenses",
        "Payroll Expense",
        "Commission Expense",
        "Tax Payable",
        "Equity",
        "Retained Earnings"
      ],
    },

    entryType: {
      type: String,
      enum: ["debit", "credit"],
      required: true,
    },

    amount: {
      type: Number,
      required: true,
      min: 0,
    },

    journalId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      index: true,
    },

    accountCategory: {
      type: String,
      enum: ["asset", "liability", "equity", "income", "expense"],
      required: true,
    },

    source: {
      type: String,
      enum: ["sale", "expense", "inventory", "payroll", "tax"],
      required: true,
    },

    referenceId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
    },

    description: String,

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    }
  },
  { timestamps: true }
);

// 🔒 IMMUTABLE LEDGER
ledgerEntrySchema.pre("findOneAndUpdate", function () {
  throw new Error("Ledger entries are immutable");
});

ledgerEntrySchema.pre("findOneAndDelete", function () {
  throw new Error("Ledger entries cannot be deleted");
});

module.exports = mongoose.model("LedgerEntry", ledgerEntrySchema);