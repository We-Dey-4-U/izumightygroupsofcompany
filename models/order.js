// models/Order.j
const mongoose = require("mongoose");

const orderSchema = new mongoose.Schema(
  {
    userId: { type: String, required: true },
    company: { type: mongoose.Schema.Types.ObjectId, ref: "Company", required: true }, // 🔹 Company isolation
    customerId: { type: String },
    paymentIntentId: { type: String },
    products: [
      {
        productId: { type: String },
        name: String,
        price: Number,
        quantity: Number,
      },
    ],
    subtotal: { type: Number, required: true },
    total: { type: Number, required: true },
    shipping: { type: Object, required: true },
    paymentMethod: { 
  type: String, 
  enum: ["stripe", "bankTransfer"], 
  required: true 
},
    receipt: { type: String }, // path to uploaded receipt file

    // use enums and defaults so statuses are consistent
    delivery_status: {
      type: String,
      enum: ["pending", "delivered"],
      default: "pending",
    },
    payment_status: {
      type: String,
      enum: ["awaiting_payment", "paid"],
      default: "awaiting_payment",
      required: true,
    },
  },
  { timestamps: true }
);

// Prevent OverwriteModelError (if you hot-reload)
module.exports = mongoose.models.Order || mongoose.model("Order", orderSchema);