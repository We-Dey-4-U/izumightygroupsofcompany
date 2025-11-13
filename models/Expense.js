// models/Expense.js
const mongoose = require("mongoose");

const expenseSchema = new mongoose.Schema(
  {
    dateOfExpense: { type: Date, required: true },

    expenseCategory: {
      type: String,
      required: true,
      enum: [
        "Transport",
        "Feeding",
        "Stationery",
        "Internet",
        "Utilities",
        "Maintenance",
        "Allowance",
        "Other",
      ],
    },

    description: { type: String, required: true },
    purpose: { type: String, required: true },
    paidTo: { type: String, required: true },
    amount: { type: Number, required: true },

    type: {
      type: String,
      enum: ["Expense", "Income"],
      default: "Expense",
    },

    balanceAfterTransaction: { type: Number, default: 0 },

    paymentMethod: {
      type: String,
      enum: ["Cash", "Transfer", "POS", "Reimbursement"],
      required: true,
    },

    department: {
      type: String,
      enum: ["Admin", "IT", "Sales", "HR", "Operations", "Other"],
      required: true,
    },

    enteredBy: { type: String, required: true },
    approvedBy: { type: String, default: "" },
    status: {
      type: String,
      enum: ["Pending", "Approved", "Declined"],
      default: "Pending",
    },

    receiptUploads: [{ id: String, url: String }],
  },
  { timestamps: true }
);
//<Route path="/shop" element={<Home />} />v

const Expense = mongoose.model("Expense", expenseSchema);
exports.Expense = Expense;