const mongoose = require("mongoose");

const schema = new mongoose.Schema({
  product: { type: mongoose.Schema.Types.ObjectId, ref: "InventoryProduct" },
  companyId: mongoose.Schema.Types.ObjectId,

  requestedChanges: Object,

  requestedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },

  status: {
    type: String,
    enum: ["PENDING", "APPROVED", "REJECTED"],
    default: "PENDING"
  },

  approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  approvedAt: Date
}, { timestamps: true });

module.exports = mongoose.model("ProductEditRequest", schema);