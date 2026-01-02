const mongoose = require("mongoose");

const bankSchema = new mongoose.Schema({
  bankName: { type: String, required: true },
  accountNumber: { type: String, required: true },
  accountName: { type: String, required: true },
});

const companySchema = new mongoose.Schema({
  name: { type: String, required: true },
  rcNumber: { type: String, required: true, unique: true },
  tin: { type: String, required: true },
  state: String,
  isVATRegistered: Boolean,

   phone: {
    type: String,
    required: true, // 🔥 REQUIRED going forward
  },

  bank: bankSchema, // ✅ COMPANY BANK DETAILS

  // ✅ NEW — company logo
  logo: {
    id: { type: String },
    url: { type: String },
  },

  code: { type: Number, required: true, unique: true },
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model("Company", companySchema);