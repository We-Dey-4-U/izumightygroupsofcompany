const mongoose = require("mongoose");

// 🔐 Generate unique product code
const generateProductCode = () => {
  return `PRD-${Math.floor(100000 + Math.random() * 900000)}`;
};

const inventoryProductSchema = new mongoose.Schema(
  {
    // 🔹 MULTI-TENANT ISOLATION
    companyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Company",
      required: true,
      index: true
    },

    // ✅ NORMALIZED NAME
    name: {
      type: String,
      required: true,
      trim: true,
      lowercase: true
    },

    productModel: {
      type: String,
      trim: true
    },

    // 🔐 UNIQUE PRODUCT CODE
    productCode: {
      type: String,
      unique: true,
      default: generateProductCode,
      immutable: true
    },

    category: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "InventoryCategory",
      required: true
    },

    image: String,

    costPrice: {
      type: Number,
      required: true,
      min: 0
    },

    sellingPrice: {
      type: Number,
      default: 0,
      min: 0
    },

    quantityInStock: {
      type: Number,
      default: 0,
      min: 0
    },

    totalSold: {
      type: Number,
      default: 0,
      min: 0
    },

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User"
    }
  },
  { timestamps: true }
);


// ✅ PRE-SAVE SAFETY (extra normalization)
inventoryProductSchema.pre("save", function (next) {
  if (this.name) {
    this.name = this.name.trim().toLowerCase();
  }
  next();
});


// ✅ INDEXES

// for fast queries
inventoryProductSchema.index({ companyId: 1, createdAt: -1 });

// 🔥 prevent duplicate names per company
inventoryProductSchema.index(
  { companyId: 1, name: 1 },
  { unique: true }
);


// 🚀 EXPORT
module.exports = mongoose.model("InventoryProduct", inventoryProductSchema);