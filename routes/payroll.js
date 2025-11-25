require("dotenv").config();
const express = require("express");
const router = express.Router();
const { auth, isAdmin,isSuperStakeholder } = require("../middleware/auth");
const Payroll = require("../models/Payroll");
const { User } = require("../models/user");
const { v4: uuidv4 } = require("uuid");
const axios = require("axios");
const FormData = require("form-data");

/**
 * Helper: Upload payslip to Appwrite storage
 */
async function uploadPayslip(fileBuffer, fileName) {
  const fileId = uuidv4();
  const formData = new FormData();
  formData.append("fileId", fileId);
  formData.append("file", fileBuffer, { filename: fileName });

  const resp = await axios.post(
    `${process.env.APPWRITE_ENDPOINT}/storage/buckets/${process.env.APPWRITE_BUCKET_ID}/files`,
    formData,
    {
      headers: {
        "X-Appwrite-Project": process.env.APPWRITE_PROJECT_ID,
        "X-Appwrite-Key": process.env.APPWRITE_API_KEY,
        ...formData.getHeaders(),
      },
      maxBodyLength: Infinity,
    }
  );

  return `${process.env.APPWRITE_ENDPOINT}/storage/buckets/${process.env.APPWRITE_BUCKET_ID}/files/${resp.data.$id}/view?project=${process.env.APPWRITE_PROJECT_ID}`;
}

/**
 * POST /generate
 * Generate payroll for a staff member (Admin only)
 */
router.post("/generate", auth, isAdmin, async (req, res) => {
  console.log("\n========================");
  console.log("📌 PAYSLIP GENERATION STARTED");
  console.log("========================");

  try {
    console.log("📥 Incoming Request Body:", req.body);

    const {
      email, // 🔥 using email instead of employeeId
      month,
      year,
      basicSalary = 0,
      housingAllowance = 0,
      medicalAllowance = 0,
      transportationAllowance = 0,
      leaveAllowance = 0,
      taxDeduction = 0,
      pensionDeduction = 0,
      otherDeductions = 0,
    } = req.body;

    console.log(`🔍 Searching for employee with email: ${email}`);

    // 🔥 Find employee using email
    const employee = await User.findOne({ email });
    console.log("👤 Employee Lookup Result:", employee);

    if (!employee) {
      console.log("❌ Employee NOT FOUND");
      return res.status(404).json({ message: "Employee not found with that email" });
    }

    const employeeId = employee._id;
    console.log("✅ Employee Found:", employeeId.toString());

    console.log(`🔍 Checking for existing payroll for: ${month}/${year}`);

    const existingPayroll = await Payroll.findOne({ employeeId, month, year });
    console.log("📄 Existing payroll check result:", existingPayroll);

    if (existingPayroll) {
      console.log("❌ Duplicate payroll detected!");
      return res.status(400).json({
        message: "Payroll already exists for this employee and month.",
      });
    }

    console.log("💰 Calculating salary and deductions...");

    const grossSalary =
      Number(basicSalary) +
      Number(housingAllowance) +
      Number(medicalAllowance) +
      Number(transportationAllowance) +
      Number(leaveAllowance);

    const totalDeductions =
      Number(taxDeduction) +
      Number(pensionDeduction) +
      Number(otherDeductions);

    const netPay = grossSalary - totalDeductions;

    console.log("💸 Gross Salary:", grossSalary);
    console.log("📉 Total Deductions:", totalDeductions);
    console.log("🧮 Net Pay:", netPay);

    console.log("📝 Creating and saving payroll record...");

    const payroll = new Payroll({
      employeeId,
      month,
      year,
      basicSalary,
      housingAllowance,
      medicalAllowance,
      transportationAllowance,
      leaveAllowance,
      taxDeduction,
      pensionDeduction,
      otherDeductions,
      grossSalary,
      netPay,
    });

    const savedPayslip = await payroll.save();
    console.log("✅ Payroll saved:", savedPayslip);

    console.log("📧 Checking if email notification should be sent...");
    console.log("Employee is staff?", employee.isStaff);
    console.log("Employee email:", employee.email);

    // Optional: send email notification
    if (employee.isStaff && employee.email) {
      console.log("📨 Sending payslip notification email...");

      sendEmail({
        to: employee.email,
        subject: `Your Payslip for ${month}/${year}`,
        body: `Hello ${employee.name}, your payroll has been generated.\nNet Pay: ₦${netPay}`,
        attachmentUrl: payroll.payslipUrl,
      });

      console.log("✅ Email dispatched");
    } else {
      console.log("⚠ Email NOT sent. Employee is not staff or email missing.");
    }

    console.log("🎉 PAYSLIP GENERATION COMPLETED SUCCESSFULLY");

    res.status(201).json({
      message: "Payroll generated successfully",
      payroll,
    });

  } catch (err) {
    console.log("\n❌ ERROR OCCURRED DURING PAYSLIP GENERATION");
    console.error(err);
    console.log("========================\n");

    res.status(500).json({
      message: "Server error",
      error: err.message,
    });
  }
});



/**
 * GET /all
 * Get all payrolls (Admin only)
 */
router.get("/all", auth, async (req, res) => {
  // Block if NOT admin AND NOT subadmin AND NOT super stakeholder
  if (
    !req.user.isAdmin &&
    !req.user.isSuperStakeholder
  ) {
    return res.status(403).json({ message: "Access denied" });
  }

  try {
    const payrolls = await Payroll.find().populate(
      "employeeId",
      "name email"
    );

    res.status(200).json(payrolls);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

/**
 * GET /staff/:id
 * Get payrolls for a specific staff (Admin only)
 */
router.get("/staff/:id", auth, isAdmin, async (req, res) => {
  try {
    const payrolls = await Payroll.find({ employeeId: req.params.id })
      .sort({ year: -1, month: -1 });
    res.status(200).json(payrolls);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});



router.get("/my-payslips", auth, async (req, res) => {
  try {
    const payrolls = await Payroll.find({ employeeId: req.user._id })
      .sort({ year: -1, month: -1 });

    return res.status(200).json(payrolls);
  } catch (err) {
    console.error("❌ Error fetching employee payslips:", err);
    return res.status(500).json({ message: "Server error" });
  }
});

/**
 * Placeholder function: Send email
 */
function sendEmail({ to, subject, body, attachmentUrl }) {
  console.log("📧 Sending email to:", to);
  console.log("Subject:", subject);
  console.log("Body:", body);
  if (attachmentUrl) console.log("Attachment:", attachmentUrl);
}

module.exports = router;