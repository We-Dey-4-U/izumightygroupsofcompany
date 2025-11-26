const mongoose = require("mongoose");

const saleSchema = new mongoose.Schema({
  saleId: { type: String, unique: true },
  items: [
    {
      productId: { type: mongoose.Schema.Types.ObjectId, ref: "InventoryProduct" },
      quantity: Number,
      price: Number,
      total: Number,
    }
  ],
  subtotal: Number,
  tax: Number,
  discount: Number,
  totalAmount: Number,
  paymentMethod: String,
  customerName: String,
  customerPhone: String,
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model("Sale", saleSchema);