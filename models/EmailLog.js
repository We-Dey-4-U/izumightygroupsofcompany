const mongoose = require("mongoose");

const EmailLogSchema = new mongoose.Schema({
  recipient: String,
  subject: String,
  company: String,
  sentAt: Date,

  opened: { type: Boolean, default: false },
  openTime: Date,

  clicked: { type: Boolean, default: false },
  clickTime: Date,

  unsubscribed: { type: Boolean, default: false },
  unsubTime: Date,

  trackingId: { type: String, unique: true }
});

module.exports = mongoose.model("EmailLog", EmailLogSchema);