// models/Sale.js
const mongoose = require("mongoose");

const saleSchema = new mongoose.Schema(
  {
    saleId: { type: String, unique: true },

    // 🔥 MULTI-TENANT ISOLATION (MATCH PAYROLL & INVENTORY)
    companyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Company",
      required: true,
      index: true
    },

    items: [
      {
        type: {
          type: String,
          enum: ["product", "service"],
          required: true
        },

        productId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "InventoryProduct",
          default: null
        },

        serviceName: { type: String, default: "" },
        quantity: { type: Number, required: true },
        price: { type: Number, required: true },
        total: { type: Number, required: true }
      }
    ],

    subtotal: { type: Number, required: true },

    // ✅ VAT – explicit & auditable
    vatRate: { type: Number, default: 7.5 },
    vatAmount: { type: Number, default: 0 },

    discount: { type: Number, default: 0 },
    totalAmount: { type: Number, required: true },

    paymentMethod: String,
    customerName: String,
    customerPhone: String,

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model("Sale", saleSchema);