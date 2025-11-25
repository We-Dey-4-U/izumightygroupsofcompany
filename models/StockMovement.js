// models/StockMovement.js
const mongoose = require("mongoose");

const stockMovementSchema = new mongoose.Schema(
  {
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "InventoryProduct",
      required: true,
    },

    type: {
      type: String,
      enum: ["STOCK_IN", "STOCK_OUT"],
      required: true,
    },

    quantity: { type: Number, required: true },

    previousQuantity: Number,
    newQuantity: Number,

    description: String, // e.g. "Restock from supplier", "Damaged items", "Sales order"

    performedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("StockMovement", stockMovementSchema);