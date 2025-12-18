const mongoose = require("mongoose");

const productSchema = new mongoose.Schema(
  {
    companyId: { // 🔹 COMPANY ISOLATION
      type: mongoose.Schema.Types.ObjectId,
      ref: "Company",
      required: true,
      index: true
    },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true }, // 🔥 New field  
    name: { type: String, required: true },
    category: { 
      type: String, 
      required: true, 
      enum: [
    // ================= IT / CRM (EXISTING) =================
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

    // ================= FASHION (NEW) =================
    "Men",
    "Women",
    "Kids",
    "Unisex",

    // Men
    "Men Clothing",
    "Men Shoes",
    "Men Accessories",

    // Women
    "Women Clothing",
    "Women Shoes",
    "Women Accessories",

    // Kids
    "Kids Clothing",
    "Kids Shoes",
    "Kids Accessories",

    // General Fashion
    "Bags",
    "Watches",
    "Jewelry",
    "Sportswear",
    "Traditional Wear",

    // ================= GENERAL =================
    "All Products"
  ]
    },
    desc: { type: String, required: true },
    features: { type: [String], default: [] },
    price: { type: Number, required: true },
    originalPrice: { type: Number, default: 0 },
    discountPercent: { type: Number, default: 0 },
    images: [{ id: String, url: String }],
    rating: { type: Number, default: 4, min: 1, max: 5 },
    wishlistedBy: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
  },
  { timestamps: true }
);

const Product = mongoose.model("Product", productSchema);
exports.Product = Product;