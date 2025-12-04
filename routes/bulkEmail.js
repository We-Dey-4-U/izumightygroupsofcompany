const express = require("express");
const router = express.Router();
const { auth } = require("../middleware/auth");
const ClientEmail = require("../models/ClientEmail");
const EmailLog = require("../models/EmailLog");
const nodemailer = require("nodemailer");
const { v4: uuidv4 } = require("uuid");

const BASE_URL = process.env.BASE_URL;
const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:3000";

// ROLE CHECK
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

// ------------------------------------------------------
// ADD CLIENT EMAIL
// ------------------------------------------------------
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
        return res
          .status(409)
          .json({ message: "Email already exists for your company" });

      const clientEmail = new ClientEmail({
        email: email.toLowerCase(),
        name: name || "",
        company: req.user.company,
        addedBy: req.user._id,
        category: category || "General",
      });

      await clientEmail.save();

      res
        .status(201)
        .json({ message: "Email added successfully", clientEmail });
    } catch (err) {
      console.error("❌ Add client email error:", err);
      res
        .status(500)
        .json({ message: "Server error", error: err.message });
    }
  }
);

// ------------------------------------------------------
// LIST CLIENT EMAILS
// ------------------------------------------------------
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
      res
        .status(500)
        .json({ message: "Server error", error: err.message });
    }
  }
);

// ------------------------------------------------------
// SEND BULK EMAIL (Mobile-Friendly Template)
// ------------------------------------------------------
// -----------------------------------------
// SEND BULK EMAIL (Mobile-Friendly Template with Logo)
// -----------------------------------------
router.post(
  "/send",
  auth,
  allowRoles("isAdmin", "isStaff", "isSubAdmin", "isSuperStakeholder"),
  async (req, res) => {
    try {
      const { subject, body, category } = req.body;
      if (!subject || !body)
        return res
          .status(400)
          .json({ message: "Subject and body are required" });

      const query = { company: req.user.company };
      if (category) query.category = category;

      const clients = await ClientEmail.find(query).select("email name");
      if (!clients.length)
        return res
          .status(404)
          .json({ message: "No client emails found" });

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
      const senderName =
        process.env.SMTP_NAME || "Techwire ICT Solutions Limited";

      const logoURL = process.env.COMPANY_LOGO_URL || "https://postimg.cc/Z0M757wJ";

      let sent = 0;

      for (const client of clients) {
        const clientName =
          client.name?.trim()?.length > 0
            ? client.name
            : "Valued Customer";

        const personalizedBody = body.replace(
          /{{\s*First Name\/Company Name\s*}}/gi,
          clientName
        );

        const trackingId = uuidv4();
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

        const htmlTemplate = `
        <table width="100%" cellpadding="0" cellspacing="0" bgcolor="#f4f7fa" style="padding:0;margin:0;">
          <tr>
            <td align="center">
              
              <table width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,0.1);margin:20px;">
                
                <!-- HEADER with Logo -->
                <tr>
                  <td bgcolor="#0066cc" style="padding:25px;text-align:center;">
                    <img src="${logoURL}" alt="Company Logo" width="120" style="display:block;margin:0 auto 10px auto;" />
                    <div style="color:#ffffff;font-size:24px;font-weight:bold;">${senderName}</div>
                  </td>
                </tr>

                <!-- BODY -->
                <tr>
                  <td style="padding:25px;font-family:Arial,sans-serif;color:#333;font-size:16px;line-height:1.7;">
                    <p>Hello <strong>${clientName}</strong>,</p>
                    <div style="word-wrap:break-word;">
                      ${personalizedBody.replace(/\n/g, "<br>")}
                    </div>
                    <br>
                    <div style="text-align:center;">
                      <a href="${clickURL}" 
                        style="
                          background:#0066cc;
                          padding:14px 28px;
                          color:#ffffff !important;
                          font-size:16px;
                          border-radius:8px;
                          text-decoration:none;
                          font-weight:bold;
                          display:inline-block;
                        ">
                        Learn More
                      </a>
                    </div>
                    <br>
                    <p style="font-size:13px;color:#777;">
                      If this email was not intended for you, you can ignore it.
                    </p>
                  </td>
                </tr>

                <!-- FOOTER -->
                <tr>
                  <td bgcolor="#f0f3f7" style="padding:20px;text-align:center;font-size:13px;color:#666;font-family:Arial;">
                    © ${new Date().getFullYear()} ${senderName}. All rights reserved.
                    <br>
                    <a href="${unsubscribeURL}" style="color:red;">Unsubscribe</a>
                  </td>
                </tr>

              </table>

              <!-- TRACKING PIXEL -->
              <img src="${openURL}" width="1" height="1" style="opacity:0;" />

            </td>
          </tr>
        </table>
        `;

        const mailOptions = {
          from: `"${senderName}" <${senderEmail}>`,
          to: client.email,
          subject,
          headers: { "List-Unsubscribe": `<${unsubscribeURL}>` },
          html: htmlTemplate,
        };

        await transporter.sendMail(mailOptions);
        sent++;
      }

      res.status(200).json({
        message: `Email sent to ${sent} clients successfully.`,
      });
    } catch (err) {
      console.error("❌ Bulk email send error:", err);
      res
        .status(500)
        .json({ message: "Server error", error: err.message });
    }
  }
);

// ------------------------------------------------------
// OPEN TRACKING
// ------------------------------------------------------
router.get("/track-open/:id", async (req, res) => {
  try {
    const { id } = req.params;

    await EmailLog.findOneAndUpdate(
      { trackingId: id },
      { opened: true, openTime: new Date() }
    );

    const pixel = Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO2NDYUAAAAASUVORK5CYII=",
      "base64"
    );

    res.set("Content-Type", "image/png");
    res.set("Cache-Control", "no-cache, no-store, must-revalidate");
    res.set("Pragma", "no-cache");
    res.set("Expires", "0");
    res.send(pixel);
  } catch (err) {
    console.error("❌ Track-open error:", err);
    res.sendStatus(500);
  }
});

// ------------------------------------------------------
// CLICK TRACKING
// ------------------------------------------------------
router.get("/track-click/:id", async (req, res) => {
  try {
    const { id } = req.params;

    await EmailLog.findOneAndUpdate(
      { trackingId: id },
      {
        clicked: true,
        clickTime: new Date(),
        opened: true,
        openTime: new Date(),
      }
    );

    res.redirect(FRONTEND_URL);
  } catch (err) {
    console.error("❌ Track-click error:", err);
    res.status(500).send("Error tracking click");
  }
});

// ------------------------------------------------------
// UNSUBSCRIBE
// ------------------------------------------------------
router.get("/unsubscribe/:email", async (req, res) => {
  try {
    const email = req.params.email.toLowerCase();

    await EmailLog.updateMany(
      { recipient: email },
      { unsubscribed: true, unsubTime: new Date() }
    );

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

// ------------------------------------------------------
// FETCH LOGS
// ------------------------------------------------------
router.get(
  "/logs",
  auth,
  allowRoles("isAdmin", "isStaff", "isSubAdmin", "isSuperStakeholder"),
  async (req, res) => {
    try {
      const logs = await EmailLog.find({
        company: req.user.company,
      }).sort({ sentAt: -1 });
      res.status(200).json(logs);
    } catch (err) {
      console.error("❌ Fetch logs error:", err);
      res
        .status(500)
        .json({ message: "Server error", error: err.message });
    }
  }
);

module.exports = router;