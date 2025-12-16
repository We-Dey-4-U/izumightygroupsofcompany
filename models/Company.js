const mongoose = require("mongoose");

const companySchema = new mongoose.Schema({
  name: { type: String, required: true },
  rcNumber: { type: String, required: true, unique: true },
  tin: { type: String, required: true },
  state: String,
  isVATRegistered: Boolean,
  code: { type: Number, required: true, unique: true }, // 🔥 Short numeric ID
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model("Company", companySchema);