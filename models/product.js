const mongoose = require("mongoose");

const productSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    category: { 
      type: String, 
      required: true, 
    enum: [
  "CCTV & Security",                 // access control, security systems
  "Networking Devices",              // routers, switches, cables
  "Computers & Laptops",             // desktops, laptops
  "Servers & Storage",               // NAS, servers, virtualization
  "Software Solutions",              // ERP, CRM, productivity software
  "Custom Software Development",     // web, mobile, enterprise apps
  "Cybersecurity Tools",             // antivirus, firewalls, data encryption
  "Digital Transformation Tools",    // IoT, automation, business process
  "Telecom Equipment",               // phones, VoIP, PBX
  "IT Infrastructure Solutions",     // network design, data centers
  "Cloud & Hosting Services",        // cloud integration, hosting plans
  "IT Sales and Deployment",         // sales, deployment of IT equipment
  "Inventory Solutions",             // stock management, barcode integration
  "Access Control Solutions",        // facial recognition, time attendance
  "Tracking Solutions",              // vehicle transit, route planning
  "Smart Home Automation",           // smart sensors, smart locks
  "Power & Backup Solutions",        // UPS, generators, solar panels
  "Printers & Scanners",             // office devices
  "All Products"                     // catch-all
]
    },
    desc: { type: String, required: true },
    features: [{ type: String }],
    price: { type: Number, required: true },
    originalPrice: { type: Number }, // optional, for discounts
    images: [{ 
  id: String, 
  url: String 
}],
    rating: { type: Number, default: 4, min: 1, max: 5 }, // ⭐ rating between 1-5
  },
  { timestamps: true } // to know when the product was uploaded
);

const Product = mongoose.model("Product", productSchema);

exports.Product = Product;