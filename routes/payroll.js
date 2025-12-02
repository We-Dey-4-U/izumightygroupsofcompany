require("dotenv").config();
const express = require("express");
const router = express.Router();
const cors = require("cors");
const { auth, isAdmin, isSuperStakeholder } = require("../middleware/auth");
const Payroll = require("../models/Payroll");
const { User } = require("../models/user");
const { v4: uuidv4 } = require("uuid");
const axios = require("axios");
const FormData = require("form-data");

// --- CORS Setup ---
router.use(cors({
  origin: "*", // adjust to your frontend domain in production
  methods: ["GET", "POST", "PUT", "DELETE"],
}));

/** Helper: Upload payslip to Appwrite storage */
async function uploadPayslip(fileBuffer, fileName) {
  const fileId = uuidv4();
  const formData = new FormData();
  formData.append("fileId", fileId);
  formData.append("file", fileBuffer, { filename: fileName });

  try {
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

    console.log(`✅ Payslip uploaded: ${fileName}, fileId: ${fileId}`);
    return `${process.env.APPWRITE_ENDPOINT}/storage/buckets/${process.env.APPWRITE_BUCKET_ID}/files/${resp.data.$id}/view?project=${process.env.APPWRITE_PROJECT_ID}`;
  } catch (err) {
    console.error("❌ Error uploading payslip:", err.message, err.stack);
    throw err;
  }
}

/** 🔥 BULK PAYROLL SENDING */
router.post("/send-bulk", auth, isAdmin, async (req, res) => {
  try {
    const { month, year } = req.body;
    if (!month || !year) return res.status(400).json({ message: "Month and year are required" });

    console.log(`🔹 Bulk payroll request by ${req.user.email} for company ${req.user.company}, month: ${month}, year: ${year}`);

    const staff = await User.find({ company: req.user.company, isStaff: true }).select("_id name email");
    if (!staff.length) {
      console.warn(`⚠️ No staff found for company ${req.user.company}`);
      return res.status(404).json({ message: "No staff found for your company" });
    }

    for (const employee of staff) {
      const existing = await Payroll.findOne({ employeeId: employee._id, month, year });
      if (existing) continue;

      const payroll = new Payroll({
        employeeId: employee._id,
        month,
        year,
        basicSalary: 0,
        housingAllowance: 0,
        medicalAllowance: 0,
        transportationAllowance: 0,
        leaveAllowance: 0,
        taxDeduction: 0,
        pensionDeduction: 0,
        otherDeductions: 0,
        grossSalary: 0,
        netPay: 0,
      });

      await payroll.save();

      console.log(`✅ Payroll created for ${employee.email}, month: ${month}, year: ${year}`);

      sendEmail({
        to: employee.email,
        subject: `Your Payslip for ${month}/${year}`,
        body: `Hello ${employee.name},\nYour payslip for ${month}/${year} is ready.`,
      });
    }

    res.json({ message: "Bulk payroll processing completed", count: staff.length });
  } catch (err) {
    console.error("❌ Bulk payroll error:", err.message, err.stack);
    res.status(500).json({ message: "Server error", error: err.message });
  }
});

/** POST /generate - Single Payslip */
router.post("/generate", auth, isAdmin, async (req, res) => {
  try {
    const {
      emails,
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

    if (!emails || !emails.length) return res.status(400).json({ message: "Email(s) are required" });

    console.log(`🔹 Payroll generation request by ${req.user.email} for company ${req.user.company}, month: ${month}, year: ${year}`);

    const results = [];

    for (const email of emails) {
      const employee = await User.findOne({ email });
      if (!employee) {
        console.warn(`⚠️ Employee not found: ${email}`);
        continue;
      }

      if (employee.company !== req.user.company) {
        console.warn(`⚠️ Skipped payroll for ${email} - belongs to another company: ${employee.company}`);
        continue;
      }

      const existing = await Payroll.findOne({ employeeId: employee._id, month, year });
      if (existing) {
        console.log(`⚠️ Payroll already exists for ${email}, month: ${month}, year: ${year}`);
        continue;
      }

      const grossSalary =
        Number(basicSalary) +
        Number(housingAllowance) +
        Number(medicalAllowance) +
        Number(transportationAllowance) +
        Number(leaveAllowance);

      const totalDeductions = Number(taxDeduction) + Number(pensionDeduction) + Number(otherDeductions);
      const netPay = grossSalary - totalDeductions;

      const payroll = new Payroll({
        employeeId: employee._id,
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

      await payroll.save();

      console.log(`✅ Payroll generated for ${email}, netPay: ₦${netPay}`);

      sendEmail({
        to: email,
        subject: `Payslip for ${month}/${year}`,
        body: `Your net pay is ₦${netPay}`,
      });

      results.push(payroll);
    }

    res.status(201).json({ message: "Payroll processed", count: results.length, results });
  } catch (err) {
    console.error("❌ Single payroll generation error:", err.message, err.stack);
    res.status(500).json({ message: "Server error", error: err.message });
  }
});



/** GET my own payslips (FOR STAFF) */
router.get("/my-payslips", auth, async (req, res) => {
  try {
    // Staff ONLY sees their own payslips
    const payrolls = await Payroll.find({
      employeeId: req.user._id,
    }).sort({ year: -1, month: -1 });

    console.log(`📄 Staff ${req.user.email} fetched ${payrolls.length} payslips`);
    return res.status(200).json(payrolls);

  } catch (err) {
    console.error("❌ Error fetching staff payslips:", err.message);
    return res.status(500).json({
      message: "Server error",
      error: err.message,
    });
  }
});

/** GET all payrolls */
/** GET all payrolls */
router.get("/all", auth, async (req, res) => {
  try {
    console.log(`🔹 Fetching all payrolls for ${req.user.email}`);

    let payrolls;

    // 🔥 Both Admin & SuperStakeholder should ONLY see company payrolls
    if (req.user.isAdmin || req.user.isSuperStakeholder) {
      payrolls = await Payroll.find()
        .populate("employeeId", "name email company isStaff");

      payrolls = payrolls.filter(
        (p) =>
          p.employeeId?.company === req.user.company &&
          p.employeeId?.isStaff
      );
    } else {
      // Staff sees only their own payroll
      payrolls = await Payroll.find({
        employeeId: req.user._id,
      }).populate("employeeId", "name email company");
    }

    console.log(`✅ Retrieved ${payrolls.length} payroll(s)`);
    res.status(200).json(payrolls);

  } catch (err) {
    console.error("❌ Error fetching all payrolls:", err.message, err.stack);
    res.status(500).json({ message: "Server error", error: err.message });
  }
});


/** GET staff payrolls by employee ID */
router.get("/staff/:id", auth, async (req, res) => {
  try {
    const employee = await User.findById(req.params.id);
    if (!employee) {
      console.warn(`⚠️ Employee not found with ID: ${req.params.id}`);
      return res.status(404).json({ message: "Employee not found" });
    }

    if (!req.user.isSuperStakeholder && employee.company !== req.user.company) {
      console.warn(`⚠️ Access denied for ${req.user.email} to view ${employee.email}`);
      return res.status(403).json({ message: "Access denied" });
    }

    const payrolls = await Payroll.find({ employeeId: req.params.id }).sort({ year: -1, month: -1 });

    console.log(`✅ Retrieved ${payrolls.length} payroll(s) for ${employee.email}`);
    res.status(200).json(payrolls);
  } catch (err) {
    console.error("❌ Error fetching staff payrolls:", err.message, err.stack);
    res.status(500).json({ message: "Server error", error: err.message });
  }
});

/** GET staff by company */
router.get("/by-company/:company", auth, isAdmin, async (req, res) => {
  console.log("============================================");
  console.log("📌 [GET /payrolls/by-company/:company] HIT");
  console.log("📥 Full URL:", req.originalUrl);
  console.log("👥 Requested By:", req.user?.email || "Unknown User");
  console.log("🧩 Requested Company:", req.params.company);
  console.log("--------------------------------------------");

  try {
    const selectedCompany = req.params.company?.trim();
    const userCompany = req.user?.company?.trim();

    if (!selectedCompany) {
      console.log("❌ ERROR: Missing company param");
      console.log("============================================");
      return res.status(400).json({ message: "Company is required" });
    }

    if (!userCompany && !req.user.isSuperStakeholder) {
      console.log(`❌ ERROR: Admin ${req.user?.email || "Unknown"} has no company assigned`);
      console.log("============================================");
      return res.status(403).json({ message: "Access denied: No company assigned" });
    }

    const selectedLower = selectedCompany.toLowerCase();
    const userLower = userCompany?.toLowerCase();

    if (!req.user.isSuperStakeholder && selectedLower !== userLower) {
      console.log(`❌ ACCESS DENIED: ${req.user.email} tried to view ${selectedCompany} staff`);
      console.log("============================================");
      return res.status(403).json({ message: "Access denied: You cannot view other company's staff" });
    }

    const companyToSearch = req.user.isSuperStakeholder ? selectedCompany : userCompany;

    console.log(`🔍 Searching staff for company: ${companyToSearch}`);

    // ✅ Only staff users
    const staff = await User.find({ 
      company: companyToSearch,
      isStaff: true
    }).select("_id name email");

    console.log(`✅ Staff Found: ${staff.length}`);
    console.log("============================================");

    return res.status(200).json(staff);
  } catch (err) {
    console.log("❌ SERVER ERROR in /by-company route");
    console.log("🛑 Error:", err.message);
    console.log("============================================");
    return res.status(500).json({
      message: "Server error while fetching staff",
      error: err.message,
    });
  }
});

/** Email Notification (placeholder) */
function sendEmail({ to, subject, body, attachmentUrl }) {
  console.log("📧 Sending email to:", to);
  console.log("Subject:", subject);
  console.log("Body:", body);
  if (attachmentUrl) console.log("Attachment:", attachmentUrl);
}

module.exports = router;