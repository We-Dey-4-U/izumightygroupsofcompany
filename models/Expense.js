const mongoose = require("mongoose");

const expenseSchema = new mongoose.Schema(
  {
    companyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Company",
      required: true,
      index: true,
    },

    dateOfExpense: { type: Date, required: true },
    expenseCategory: { type: String },

    taxFlags: {
      vatClaimable: { type: Boolean, default: false },
      whtApplicable: { type: Boolean, default: false },
      citAllowable: { type: Boolean, default: true },
    },

    vendorIsNigerian: { type: Boolean, default: true },
    vatAmount: { type: Number, default: 0 },
    whtRate: { type: Number, default: 0 },
    whtAmount: { type: Number, default: 0 },

    enteredByUser: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    description: { type: String, required: true },
    paidTo: { type: String, required: true },
    amount: { type: Number, required: true },

    type: { type: String, default: "Expense" },
    balanceAfterTransaction: { type: Number, default: 0 },
    paymentMethod: { type: String, required: true },
    department: { type: String, required: true },

    approvedBy: { type: String, default: "" },
    status: { type: String, default: "Pending" },

    receiptUploads: [{ id: String, url: String }],
  },
  { timestamps: true }
);

module.exports = mongoose.model("Expense", expenseSchema);