const mongoose = require("mongoose");

// Generate a unique product code
const generateProductCode = () => {
  return `PRD-${Math.floor(100000 + Math.random() * 900000)}`; // PRD-123456
};

const inventoryProductSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
   // company: { type: mongoose.Schema.Types.ObjectId, ref: "Company", required: true }, // 🔹 Company isolation
    productModel: { type: String, required: true }, // New field added
    productCode: {
      type: String,
      unique: true,
      default: generateProductCode,
      immutable: true, // cannot be changed after creation
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
    image: { type: String },
    costPrice: { type: Number, required: true },
    sellingPrice: { type: Number, required: true },

    // stock fields
    quantityInStock: { type: Number, default: 0 },
    itemsSold: { type: Number, default: 0 },
    itemsAvailable: {
      type: Number,
      default: function () {
        return this.quantityInStock - this.itemsSold;
      },
    },

    // admin who created it
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

// ----------------------
// Pre-validate hook
// Ensures productCode is always set before validation
// ----------------------
inventoryProductSchema.pre("validate", function (next) {
  if (!this.productCode) {
    this.productCode = generateProductCode();
  }
  next();
});




// ----------------------
// Pre-save hook
// Always updates itemsAvailable
// ----------------------
inventoryProductSchema.pre("save", function (next) {
  this.itemsAvailable = this.quantityInStock - this.itemsSold;
  next();
});

// ----------------------
// Method to sell items
// Automatically updates itemsSold and itemsAvailable
// ----------------------
inventoryProductSchema.methods.sellItems = async function (quantity = 1) {
  if (quantity > this.itemsAvailable)
    throw new Error("Not enough stock available");
  this.itemsSold += quantity;
  this.itemsAvailable = this.quantityInStock - this.itemsSold;
  await this.save();
};



module.exports = mongoose.model("InventoryProduct", inventoryProductSchema);