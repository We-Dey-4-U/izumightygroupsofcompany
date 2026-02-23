const mongoose = require("mongoose");

const storeSchema = new mongoose.Schema({
  companyId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Company",
    required: true,
    index: true
  },

  name: { type: String, required: true },

  type: {
    type: String,
    enum: ["OFFICE", "PACKING"],
    required: true
  },

  location: String,

  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User"
  }

}, { timestamps: true });

module.exports = mongoose.model("Store", storeSchema);