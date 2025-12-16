const mongoose = require("mongoose");

// Generate unique product code
const generateProductCode = () => {
  return `PRD-${Math.floor(100000 + Math.random() * 900000)}`;
};

const inventoryProductSchema = new mongoose.Schema(
  {
    // 🔹 MULTI-TENANT ISOLATION (MATCH PAYROLL)
    companyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Company",
      required: true,
      index: true
    },

    name: { type: String, required: true },
    productModel: { type: String, required: true },

    productCode: {
      type: String,
      unique: true,
      default: generateProductCode,
      immutable: true
    },

    category: {
      type: String,
      required: true,
      enum: [
        "CCTV & Security",
        "Networking Devices",
        "Computers & Laptops",
        "Servers & Storage",
        "Software Solutions",
        "Custom Software Development",
        "Cybersecurity Tools",
        "Digital Transformation Tools",
        "Telecom Equipment",
        "IT Infrastructure Solutions",
        "Cloud & Hosting Services",
        "IT Sales and Deployment",
        "Inventory Solutions",
        "Access Control Solutions",
        "Tracking Solutions",
        "Smart Home Automation",
        "Power & Backup Solutions",
        "Printers & Scanners",
        "All Products"
      ]
    },

    image: String,

    costPrice: { type: Number, required: true },
    sellingPrice: { type: Number, required: true },

    quantityInStock: { type: Number, default: 0 },
    itemsSold: { type: Number, default: 0 },

    itemsAvailable: {
      type: Number,
      default: function () {
        return this.quantityInStock - this.itemsSold;
      }
    },

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User"
    }
  },
  { timestamps: true }
);

// Auto-update available items
inventoryProductSchema.pre("save", function (next) {
  this.itemsAvailable = this.quantityInStock - this.itemsSold;
  next();
});

module.exports = mongoose.model("InventoryProduct", inventoryProductSchema);