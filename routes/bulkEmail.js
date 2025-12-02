const express = require("express");
const router = express.Router();
const { auth } = require("../middleware/auth");
const ClientEmail = require("../models/ClientEmail");
const nodemailer = require("nodemailer");

// Middleware to check any allowed roles
const allowRoles = (...roles) => {
  return (req, res, next) => {
    const user = req.user;
    if (
      (roles.includes("isAdmin") && user.isAdmin) ||
      (roles.includes("isStaff") && user.isStaff) ||
      (roles.includes("isSubAdmin") && user.isSubAdmin) ||
      (roles.includes("isSuperStakeholder") && user.isSuperStakeholder)
    ) {
      return next();
    }
    return res.status(403).json({ message: "Access denied" });
  };
};

// ------------------------------
// Add a client email
// ------------------------------
router.post("/add", auth, allowRoles("isAdmin", "isStaff", "isSubAdmin", "isSuperStakeholder"), async (req, res) => {
  try {
    const { email, name } = req.body;
    if (!email) return res.status(400).json({ message: "Email is required" });

    const exists = await ClientEmail.findOne({ email: email.toLowerCase(), company: req.user.company });
    if (exists) return res.status(409).json({ message: "Email already exists for your company" });

    const clientEmail = new ClientEmail({
      email: email.toLowerCase(),
      name: name || "",
      company: req.user.company,
      addedBy: req.user._id,
    });

    await clientEmail.save();
    res.status(201).json({ message: "Email added successfully", clientEmail });
  } catch (err) {
    console.error("❌ Add client email error:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
});

// ------------------------------
// Fetch all client emails for logged-in user's company
// ------------------------------
router.get("/list", auth, allowRoles("isAdmin", "isStaff", "isSubAdmin", "isSuperStakeholder"), async (req, res) => {
  try {
    const emails = await ClientEmail.find({ company: req.user.company }).sort({ createdAt: -1 });
    res.status(200).json(emails);
  } catch (err) {
    console.error("❌ Fetch client emails error:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
});

// ------------------------------
// Send bulk email with batching
// ------------------------------
router.post("/send", auth, allowRoles("isAdmin", "isStaff", "isSubAdmin", "isSuperStakeholder"), async (req, res) => {
  try {
    const { subject, body } = req.body;
    if (!subject || !body) return res.status(400).json({ message: "Subject and body are required" });

    const clients = await ClientEmail.find({ company: req.user.company }).select("email");
    if (!clients.length) return res.status(404).json({ message: "No client emails found for your company" });

    // Nodemailer transporter
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });

    // Batch size (Gmail recommends ≤100 recipients per email)
    const batchSize = 50;
    const emails = clients.map(c => c.email);

    for (let i = 0; i < emails.length; i += batchSize) {
      const batch = emails.slice(i, i + batchSize);

      const mailOptions = {
        from: process.env.SMTP_USER,
        to: batch,
        subject,
        text: body,
      };

      await transporter.sendMail(mailOptions);
      console.log(`📧 Sent batch ${i / batchSize + 1}: ${batch.length} emails`);
    }

    res.status(200).json({ message: `Email sent to ${emails.length} recipients in ${Math.ceil(emails.length / batchSize)} batch(es)` });
  } catch (err) {
    console.error("❌ Bulk email send error:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
});

module.exports = router;