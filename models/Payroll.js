const mongoose = require("mongoose");

const payrollSchema = new mongoose.Schema(
  {
    employeeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    // 🔹 Reference company directly for multi-tenancy
    companyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Company",
      required: true,
      index: true
    },

    month: { type: String, required: true },
    year: { type: Number, required: true },

    // Salary Components
    basicSalary: { type: Number, default: 0 },
    housingAllowance: { type: Number, default: 0 },
    medicalAllowance: { type: Number, default: 0 },
    transportationAllowance: { type: Number, default: 0 },
    leaveAllowance: { type: Number, default: 0 },

    // Statutory Deductions
    taxDeduction: { type: Number, default: 0 },
    pensionDeduction: { type: Number, default: 0 },

    // NHF / NHIS
    nhfDeduction: { type: Number, default: 0 },
    nhisEmployeeDeduction: { type: Number, default: 0 },
    nhisEmployerContribution: { type: Number, default: 0 },

    otherDeductions: { type: Number, default: 0 },

    // Calculated fields
    grossSalary: { type: Number, required: true },
    netPay: { type: Number, required: true },

    preparedDate: { type: Date, default: Date.now },

    // Payslip file URL
    payslipUrl: { type: String, default: null },
  },
  { timestamps: true }
);

// Prevent duplicate payrolls for same employee/month/year
payrollSchema.index({ employeeId: 1, month: 1, year: 1 }, { unique: true });

module.exports = mongoose.model("Payroll", payrollSchema);