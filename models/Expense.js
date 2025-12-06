const mongoose = require("mongoose");

const expenseSchema = new mongoose.Schema(
  {
    dateOfExpense: { type: Date, required: true },

    expenseCategory: {
      type: String,
      required: true,
    },

    // 🔹 Reference the user who entered the expense
    enteredByUser: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    description: { type: String, required: true },

    paidTo: { type: String, required: true },

    amount: { type: Number, required: true },

    type: {
      type: String,
      default: "Expense",
    },

    balanceAfterTransaction: { type: Number, default: 0 },

    paymentMethod: {
      type: String,
      required: true,
    },

    department: {
      type: String,
      required: true,
    },

    approvedBy: { type: String, default: "" },

    status: {
      type: String,
      default: "Pending",
    },

    receiptUploads: [{ id: String, url: String }],
  },
  { timestamps: true }
);

const Expense = mongoose.model("Expense", expenseSchema);
exports.Expense = Expense;