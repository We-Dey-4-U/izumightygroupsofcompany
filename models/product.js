const mongoose = require("mongoose");

const productSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    category: { 
      type: String, 
      required: true, 
      enum:[
  "Drinks & Cocktails",
  "Wine & Champagne",
  "Beer & Spirits",
  "Tea & Coffee",
  "Mocktails & Smoothies",
  "Grill & Barbecue",
  "Continental Dishes",
  "Local Dishes",
  "Desserts & Pastries",
  "Kitchen Specials",
  "Room Booking",
  "Event Reservations",
  "VIP Lounge",
  "Outdoor Lounge",
  "Takeaway & Delivery",
  "Shisha & Cigars",
  "Live Entertainment",
  "Games & Leisure",
  "Membership Packages",
  "Gift Cards",
  "All Services"
] // optional catch-all] // ✅ allowed categories
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