const mongoose = require("mongoose");

const productSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
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
    desc: { type: String, required: true },
     features: { type: [String], default: [] },        // explicit default
    price: { type: Number, required: true },
     originalPrice: { type: Number, default: 0 },
    discountPercent: { type: Number, default: 0 },    // explicit default
    images: [{ id: String, url: String }],
    rating: { type: Number, default: 4, min: 1, max: 5 },
    wishlistedBy: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }], // track users who wishlisted this
  },
  { timestamps: true }
);

const Product = mongoose.model("Product", productSchema);

exports.Product = Product;