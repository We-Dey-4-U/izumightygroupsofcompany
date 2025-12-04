const express = require("express");
const router = express.Router();
const { auth } = require("../middleware/auth");
const ClientEmail = require("../models/ClientEmail");
const EmailLog = require("../models/EmailLog");
const nodemailer = require("nodemailer");
const { v4: uuidv4 } = require("uuid");

// Environment variables
const BASE_URL = process.env.BASE_URL;
const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:3000";

// Role checking middleware
const allowRoles = (...roles) => {
  return (req, res, next) => {
    const user = req.user;
    console.log("Checking roles for user:", user.email, roles);
    if (
      (roles.includes("isAdmin") && user.isAdmin) ||
      (roles.includes("isStaff") && user.isStaff) ||
      (roles.includes("isSubAdmin") && user.isSubAdmin) ||
      (roles.includes("isSuperStakeholder") && user.isSuperStakeholder)
    ) {
      console.log("Access granted for roles:", roles);
      return next();
    }
    console.warn("Access denied for user:", user.email);
    return res.status(403).json({ message: "Access denied" });
  };
};

// -----------------------------------------
// Add Client Email
// -----------------------------------------
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
        category: category || "General",
      });

      await clientEmail.save();
      console.log("Email added successfully:", clientEmail.email);
      res.status(201).json({ message: "Email added successfully", clientEmail });
    } catch (err) {
      console.error("❌ Add client email error:", err);
      res.status(500).json({ message: "Server error", error: err.message });
    }
  }
);

// -----------------------------------------
// Fetch Client Emails
// -----------------------------------------
router.get(
  "/list",
  auth,
  allowRoles("isAdmin", "isStaff", "isSubAdmin", "isSuperStakeholder"),
  async (req, res) => {
    try {
      console.log("Fetching client emails for company:", req.user.company);
      const emails = await ClientEmail.find({ company: req.user.company }).sort({ createdAt: -1 });
      console.log("Fetched emails count:", emails.length);
      res.status(200).json(emails);
    } catch (err) {
      console.error("❌ Fetch client emails error:", err);
      res.status(500).json({ message: "Server error", error: err.message });
    }
  }
);

// -----------------------------------------
// Send Bulk Email (Individual Per Recipient)
// -----------------------------------------
router.post(
  "/send",
  auth,
  allowRoles("isAdmin", "isStaff", "isSubAdmin", "isSuperStakeholder"),
  async (req, res) => {
    try {
      const { subject, body, category } = req.body;
      if (!subject || !body)
        return res.status(400).json({ message: "Subject and body are required" });

      const query = { company: req.user.company };
      if (category) query.category = category;

      const clients = await ClientEmail.find(query).select("email name");
      if (!clients.length) return res.status(404).json({ message: "No client emails found" });

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
        const clientName =
          client.name?.trim()?.length > 0 ? client.name : "Valued Customer";
        const personalizedBody = body.replace(
          /{{\s*First Name\/Company Name\s*}}/gi,
          clientName
        );

        const trackingId = uuidv4();
        // Cache-busting open pixel
        const openURL = `${BASE_URL}/api/bulk-email/track-open/${trackingId}?t=${Date.now()}`;
        const clickURL = `${BASE_URL}/api/bulk-email/track-click/${trackingId}`;
        const unsubscribeURL = `${BASE_URL}/api/bulk-email/unsubscribe/${client.email}`;

        await EmailLog.create({
          recipient: client.email,
          subject,
          company: req.user.company,
          sentAt: new Date(),
          trackingId,
        });

        const mailOptions = {
          from: `"${senderName}" <${senderEmail}>`,
          to: client.email,
          subject,
          headers: { "List-Unsubscribe": `<${unsubscribeURL}>` },
          html: `
            <div style="font-family: Arial; line-height:1.6;">
              ${personalizedBody.replace(/\n/g, "<br>")}
              <br><br>
              <a href="${clickURL}" style="font-weight:bold; color:#0066cc;">Click Here</a>
              <img src="${openURL}" width="1" height="1" style="opacity:0;" />
              <br><br>
              <a href="${unsubscribeURL}" style="color:red;">Unsubscribe</a>
            </div>
          `,
        };

        await transporter.sendMail(mailOptions);
        console.log("Email sent to:", client.email);
        sent++;
      }

      res.status(200).json({ message: `Email sent individually to ${sent} recipients.` });
    } catch (err) {
      console.error("❌ Bulk email send error:", err);
      res.status(500).json({ message: "Server error", error: err.message });
    }
  }
);

// -----------------------------------------
// Open Tracking Pixel
// -----------------------------------------
router.get("/track-open/:id", async (req, res) => {
  try {
    const { id } = req.params;
    console.log("Tracking pixel requested for ID:", id, new Date());

    await EmailLog.findOneAndUpdate(
      { trackingId: id },
      { opened: true, openTime: new Date() }
    );

    const pixel = Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO2NDYUAAAAASUVORK5CYII=",
      "base64"
    );

    // No-cache headers to avoid image caching
    res.set("Content-Type", "image/png");
    res.set("Cache-Control", "no-cache, no-store, must-revalidate");
    res.set("Pragma", "no-cache");
    res.set("Expires", "0");
    res.send(pixel);

    console.log("Open logged for trackingId:", id);
  } catch (err) {
    console.error("❌ Track-open error:", err);
    res.sendStatus(500);
  }
});

// -----------------------------------------
// Click Tracking
// -----------------------------------------
router.get("/track-click/:id", async (req, res) => {
  try {
    const { id } = req.params;
    console.log("Track click requested for ID:", id, new Date());

    await EmailLog.findOneAndUpdate(
      { trackingId: id },
      { clicked: true, clickTime: new Date() }
    );

    res.redirect(FRONTEND_URL); // Redirect to actual frontend
  } catch (err) {
    console.error("❌ Track-click error:", err);
    res.status(500).send("Error tracking click");
  }
});

// -----------------------------------------
// Unsubscribe (also tracked)
// -----------------------------------------
router.get("/unsubscribe/:email", async (req, res) => {
  try {
    const email = req.params.email.toLowerCase();
    console.log("Unsubscribe requested for:", email);

    await EmailLog.updateMany(
      { recipient: email },
      { unsubscribed: true, unsubTime: new Date() }
    );

    const removed = await ClientEmail.findOneAndDelete({ email });
    if (!removed) {
      console.warn("Unsubscribe: email not found", email);
      return res.send(`
        <h2>Email Not Found</h2>
        <p>The email <strong>${email}</strong> is not in our mailing list.</p>
      `);
    }

    console.log("Unsubscribed successfully:", email);
    res.send(`
      <h2>You Have Been Unsubscribed</h2>
      <p>The email <strong>${email}</strong> has been removed from our mailing list.</p>
    `);
  } catch (err) {
    console.error("❌ Unsubscribe Error:", err);
    res.status(500).send("Server error.");
  }
});

// -----------------------------------------
// Fetch Email Logs (Admin/Staff Only)
// -----------------------------------------
router.get(
  "/logs",
  auth,
  allowRoles("isAdmin", "isStaff", "isSubAdmin", "isSuperStakeholder"),
  async (req, res) => {
    try {
      console.log("Fetching email logs for company:", req.user.company);
      const logs = await EmailLog.find({ company: req.user.company }).sort({ sentAt: -1 });
      console.log("Logs fetched:", logs.length);
      res.status(200).json(logs);
    } catch (err) {
      console.error("❌ Fetch logs error:", err);
      res.status(500).json({ message: "Server error", error: err.message });
    }
  }
);

module.exports = router;