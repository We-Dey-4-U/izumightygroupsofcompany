const express = require("express");
const router = express.Router();
const { auth } = require("../middleware/auth");
const ClientEmail = require("../models/ClientEmail");
const nodemailer = require("nodemailer");

// Middleware to check allowed roles
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
router.post(
  "/add",
  auth,
  allowRoles("isAdmin", "isStaff", "isSubAdmin", "isSuperStakeholder"),
  async (req, res) => {
    try {
      const { email, name, category } = req.body;

      if (!email) return res.status(400).json({ message: "Email is required" });

      const exists = await ClientEmail.findOne({
        email: email.toLowerCase(),
        company: req.user.company,
      });

      if (exists)
        return res.status(409).json({ message: "Email already exists for your company" });

      const clientEmail = new ClientEmail({
        email: email.toLowerCase(),
        name: name || "",
        company: req.user.company,
        addedBy: req.user._id,
        category: category || "General", // assign category or default
      });

      await clientEmail.save();
      res.status(201).json({ message: "Email added successfully", clientEmail });
    } catch (err) {
      console.error("❌ Add client email error:", err);
      res.status(500).json({ message: "Server error", error: err.message });
    }
  }
);

// ------------------------------
// Fetch all client emails
// ------------------------------
router.get(
  "/list",
  auth,
  allowRoles("isAdmin", "isStaff", "isSubAdmin", "isSuperStakeholder"),
  async (req, res) => {
    try {
      const emails = await ClientEmail.find({
        company: req.user.company,
      }).sort({ createdAt: -1 });

      res.status(200).json(emails);
    } catch (err) {
      console.error("❌ Fetch client emails error:", err);
      res.status(500).json({ message: "Server error", error: err.message });
    }
  }
);

// ------------------------------
// Send bulk email — ONE EMAIL PER RECIPIENT WITH PLACEHOLDERS
// ------------------------------
router.post(
  "/send",
  auth,
  allowRoles("isAdmin", "isStaff", "isSubAdmin", "isSuperStakeholder"),
  async (req, res) => {
    try {
      const { subject, body, category } = req.body; // allow filtering by category

      if (!subject || !body)
        return res.status(400).json({ message: "Subject and body are required" });

      // filter by category if provided
      const query = { company: req.user.company };
      if (category) query.category = category;

      const clients = await ClientEmail.find(query).select("email name");

      if (!clients.length)
        return res.status(404).json({ message: "No client emails found for your company" });

      const transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: process.env.SMTP_PORT,
        secure: process.env.SMTP_PORT == "465",
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS,
        },
        tls: { rejectUnauthorized: false },
      });

      const senderEmail = process.env.SMTP_USER;
      const senderName = process.env.SMTP_NAME || "Techwire ICT Solutions Limited";

      let sent = 0;

      for (const client of clients) {
        const clientName = client.name && client.name.trim().length > 0
          ? client.name
          : "Valued Customer";

        const personalizedBody = body.replace(
          /{{\s*First Name\/Company Name\s*}}/gi,
          clientName
        );

        const mailOptions = {
          from: `"${senderName}" <${senderEmail}>`,
          to: client.email,
          subject,
          text: personalizedBody,
          html: `
  ${personalizedBody.replace(/\n/g, "<br>")}
  <br><br>
  <hr>
  <p style="font-size:12px;color:#555;">
    If you no longer want to receive emails from us, click here to unsubscribe: 
    <a href="https://techwireapii.onrender.com/api/bulk-email/unsubscribe/${client.email}">
      Unsubscribe
    </a>
  </p>
`,
        };

        await transporter.sendMail(mailOptions);
        sent++;
      }

      res.status(200).json({ message: `Email sent individually to ${sent} recipients.` });
    } catch (err) {
      console.error("❌ Bulk email send error:", err);
      res.status(500).json({ message: "Server error", error: err.message });
    }
  }
);


// ------------------------------
// Unsubscribe (remove email from list)
// ------------------------------
router.get("/unsubscribe/:email", async (req, res) => {
  try {
    const email = req.params.email.toLowerCase();

    const removed = await ClientEmail.findOneAndDelete({ email });

    if (!removed) {
      return res.send(`
        <h2>Email Not Found</h2>
        <p>The email <strong>${email}</strong> is not in our mailing list.</p>
      `);
    }

    res.send(`
      <h2>You Have Been Unsubscribed</h2>
      <p>The email <strong>${email}</strong> has been removed from our mailing list.</p>
    `);
  } catch (err) {
    console.error("❌ Unsubscribe Error:", err);
    res.status(500).send("Server error.");
  }
});

module.exports = router;