require("dotenv").config({ path: __dirname + "/.env" });
const mongoose = require("mongoose");
const InventoryProduct = require("./models/InventoryProduct");
const InventoryCategory = require("./models/InventoryCategory");

if (!process.env.CONNECTION_STRING) {
  console.error("❌ CONNECTION_STRING missing in .env");
  process.exit(1);
}

const COMPANY_ID = "69934576cb826ddfd7a54543";
const CREATED_BY = "69937290cb826ddfd7a54ab4";

const products = [

// ===== NEWLY ADDED PRODUCTS (228–269) =====

{ name: "Mouse Adaptor || male to USB", productModel: "", category: "PC Accessories", sellingPrice: 0 },
{ name: "DVI-1 to VGA adaptor || female to male", productModel: "", category: "PC Accessories", sellingPrice: 0 },
{ name: "DVI-1 (male) to HDMI adaptor", productModel: "", category: "PC Accessories", sellingPrice: 0 },
{ name: "RJ45 Spliter adaptor || 1x2", productModel: "", category: "PC Accessories", sellingPrice: 0 },
{ name: "DVI-1 to VGA adaptor || male to female", productModel: "", category: "PC Accessories", sellingPrice: 0 },
{ name: "VGA to VGA coupler || male to male", productModel: "", category: "PC Accessories", sellingPrice: 0 },
{ name: "VGA to VGA coupler || female to female", productModel: "", category: "PC Accessories", sellingPrice: 0 },
{ name: "RJ11", productModel: "", category: "IP Phone", sellingPrice: 0 },
{ name: "9 Pin DB9-DR9 VGA Adaptor", productModel: "", category: "PC Accessories", sellingPrice: 0 },
{ name: "Cable clip || 8mm | 100pcs Pack", productModel: "", category: "General Accessories", sellingPrice: 0 },
{ name: "15.6 Slim Touch screen small connector || Laptop Screen", productModel: "", category: "Laptop Screen", sellingPrice: 3500 },
{ name: "15.6 Slim big connector || Laptop Screen", productModel: "", category: "Laptop Screen", sellingPrice: 0 },
{ name: "14.0 Slim small connector || Laptop Screen", productModel: "", category: "Laptop Screen", sellingPrice: 3500 },
{ name: "15.6 Normal 30 pin || Laptop Screen", productModel: "", category: "Laptop Screen", sellingPrice: 0 },
{ name: "15.6 Slim small connector || Laptop Screen", productModel: "", category: "Laptop Screen", sellingPrice: 0 },
{ name: "14.0 Super Slim big connector || Laptop Screen", productModel: "", category: "Laptop Screen", sellingPrice: 0 },
{ name: "15.4 Normal inverter big connector || Laptop Screen", productModel: "", category: "Laptop Screen", sellingPrice: 0 },
{ name: "14.0 Normal small connector || Laptop Screen", productModel: "", category: "Laptop Screen", sellingPrice: 0 },
{ name: "17.3 Normal big connector || Laptop Screen", productModel: "", category: "Laptop Screen", sellingPrice: 0 },
{ name: "14.1 Normal inverter big connector || Laptop Screen", productModel: "", category: "Laptop Screen", sellingPrice: 0 },
{ name: "14.0 Normal big connector || Laptop Screen", productModel: "", category: "Laptop Screen", sellingPrice: 0 },
{ name: "12.5 Slim Big connector || Laptop Screen", productModel: "", category: "Laptop Screen", sellingPrice: 0 },
{ name: "12.5 Slim small connector || Laptop Screen", productModel: "", category: "Laptop Screen", sellingPrice: 0 },
{ name: "13.3 Slim Big connector || Laptop Screen", productModel: "", category: "Laptop Screen", sellingPrice: 0 },
{ name: "13.3 Big connector || Laptop Screen", productModel: "", category: "Laptop Screen", sellingPrice: 0 },
{ name: "12.1 Normal inverter small connector || Laptop Screen", productModel: "", category: "Laptop Screen", sellingPrice: 0 },
{ name: "11.6 Normal Big connector || Laptop Screen", productModel: "", category: "Laptop Screen", sellingPrice: 0 },
{ name: "11.6 Slim small connector || Laptop Screen", productModel: "", category: "Laptop Screen", sellingPrice: 0 },
{ name: "10.1 Normal Big connector || Laptop Screen", productModel: "", category: "Laptop Screen", sellingPrice: 0 },
{ name: "10.1 Slim big connector || Laptop Screen", productModel: "", category: "Laptop Screen", sellingPrice: 0 },

];

const seedProducts = async () => {
  try {
    await mongoose.connect(process.env.CONNECTION_STRING);
    console.log("✅ Connected to MongoDB");

    // 🔥 GET ALL CATEGORIES
    const categories = await InventoryCategory.find({ companyId: COMPANY_ID });

    const categoryMap = {};
    categories.forEach(cat => {
      categoryMap[cat.name] = cat._id;
    });

    const formattedProducts = [];

    for (const item of products) {

      const categoryId = categoryMap[item.category];

      if (!categoryId) {
        console.log(`❌ Category not found: ${item.category}`);
        continue;
      }

      // prevent duplicate (same name + model + company)
      const exists = await InventoryProduct.findOne({
        name: item.name,
        productModel: item.productModel,
        companyId: COMPANY_ID
      });

      if (exists) {
        console.log(`⚠ Already exists: ${item.name}`);
        continue;
      }

      formattedProducts.push({
        companyId: COMPANY_ID,
        name: item.name,
        productModel:
    item.productModel && item.productModel.trim() !== ""
      ? item.productModel.trim()
      : "MODEL-" + Date.now() + "-" + Math.floor(Math.random() * 1000),
        category: categoryId,
        costPrice: 0,
        sellingPrice: item.sellingPrice,
        quantityInStock: 0,
        totalSold: 0,
        createdBy: CREATED_BY
      });
    }

    if (formattedProducts.length > 0) {
      await InventoryProduct.insertMany(formattedProducts);
      console.log("🎉 PRODUCTS INSERTED SUCCESSFULLY!");
    } else {
      console.log("⚠ No new products inserted.");
    }

    process.exit(0);

  } catch (err) {
    console.error("❌ Error inserting products:", err);
    process.exit(1);
  }
};

seedProducts();