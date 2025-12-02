const mongoose = require("mongoose");

const payrollSchema = new mongoose.Schema({
  employeeId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
 // company: { type: mongoose.Schema.Types.ObjectId, ref: "Company", required: true }, // 🔹 Company isolation
  month: { type: String, required: true },
  year: { type: Number, required: true },

  // Salary Components
  basicSalary: { type: Number, default: 0 },
  housingAllowance: { type: Number, default: 0 },
  medicalAllowance: { type: Number, default: 0 },
  transportationAllowance: { type: Number, default: 0 },
  leaveAllowance: { type: Number, default: 0 },

  // Deductions
  taxDeduction: { type: Number, default: 0 },
  pensionDeduction: { type: Number, default: 0 },
  otherDeductions: { type: Number, default: 0 },

  // Calculated
  grossSalary: { type: Number, required: true },
  netPay: { type: Number, required: true },

  preparedDate: { type: Date, default: Date.now },
  payslipUrl: { type: String, default: null }, // uploaded PDF/Doc
}, { timestamps: true });

// Prevent duplicate payrolls for same employee/month/year
payrollSchema.index({ employeeId: 1, month: 1, year: 1 }, { unique: true });

module.exports = mongoose.model("Payroll", payrollSchema);