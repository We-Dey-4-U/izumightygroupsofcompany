const mongoose = require("mongoose");

const productSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    category: { 
      type: String, 
      required: true, 
      enum: [
  "Men Clothing",
  "Women Clothing",
  "Kids Clothing",
  "Shoes",
  "Jackets",
  "Jewelry",
  "Accessories",
  "Cars",
  "Car Accessories",
  "Gadgets",
  "Phones",
  "Cosmetics",
  "Sports Equipment",
  "Home Appliances",
  "Furniture",
  "Books",
  "Toys",
  "Stationery",
  "Pet Supplies",
  "Groceries",
  "Health & Wellness",
  "Gaming",
   "CCTV & Security",
   "Solar & Energy",
  "All Products"
]
    },
    desc: { type: String, required: true },
    price: { type: Number, required: true },
    originalPrice: { type: Number }, // optional, for discounts
    image: { type: Object, required: true },
    rating: { type: Number, default: 4, min: 1, max: 5 }, // ⭐ rating between 1-5
  },
  { timestamps: true } // to know when the product was uploaded
);

const Product = mongoose.model("Product", productSchema);

exports.Product = Product;