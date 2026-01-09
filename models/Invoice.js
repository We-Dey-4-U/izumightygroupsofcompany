const mongoose = require("mongoose");

const invoiceSchema = new mongoose.Schema({
  invoiceId: { type: String, unique: true },
  companyId: { type: mongoose.Schema.Types.ObjectId, ref: "Company", required: true, index: true },
  items: [
    {
      type: { type: String, enum: ["product", "service"], required: true },
      productId: { type: mongoose.Schema.Types.ObjectId, ref: "InventoryProduct", default: null },
        productName: {
      type: String,
      required: false // 🔴 SNAPSHOT FOR FIRS / AUDIT / QR
    },
      serviceName: { type: String, default: "" },
      quantity: { type: Number, required: true },
      price: { type: Number, required: true },
      total: { type: Number, required: true }
    }
  ],
  subtotal: { type: Number, required: true },
  vatRate: { type: Number, default: 7.5 },
  vatAmount: { type: Number, default: 0 },
  discount: { type: Number, default: 0 },
  totalAmount: { type: Number, required: true },
  paymentMethod: { type: String, default: "Pending" }, // Payment not done yet
  customerName: String,
  customerPhone: String,
    // ===============================
    // ✅ FIRS E-INVOICE LIFECYCLE
    // ===============================
    firsInvoiceStatus: {
      type: String,
      enum: ["DRAFT", "FINAL", "SUBMITTED", "ACCEPTED", "REJECTED"],
      default: "DRAFT"
    },

    firsReference: {
      type: String,
      default: null
    },

    firsStatus: {
      type: String,
      default: null
    },

    firsQrCode: {
      type: String,
      default: null
    },

    submittedToFirs: {
      type: Boolean,
      default: false
    },
  status: { type: String, enum: ["Pending", "Paid"], default: "Pending" },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true }
}, { timestamps: true });

module.exports = mongoose.model("Invoice", invoiceSchema);