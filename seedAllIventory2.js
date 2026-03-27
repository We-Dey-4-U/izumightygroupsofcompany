require("dotenv").config({ path: __dirname + "/.env" });
const mongoose = require("mongoose");
const InventoryProduct = require("./models/InventoryProduct");
const InventoryCategory = require("./models/InventoryCategory");
const StoreInventory = require("./models/StoreInventory");
const Store = require("./models/Store");

if (!process.env.CONNECTION_STRING) {
  console.error("❌ CONNECTION_STRING missing in .env");
  process.exit(1);
}

const COMPANY_ID = "69934576cb826ddfd7a54543";
const CREATED_BY = "69937290cb826ddfd7a54ab4";

const products = [

{ name: "Cat6e Patch Cord 5m", productModel: "", category: "Patch Cord", sellingPrice: 45 },
{ name: "Cat6e Patch Cord 0.5m", productModel: "", category: "Patch Cord", sellingPrice: 15 },
{ name: "Cat6e Patch Cord 3m", productModel: "", category: "Patch Cord", sellingPrice: 35 },
{ name: "Cat6e Patch Cord 1m", productModel: "", category: "Patch Cord", sellingPrice: 25 }

];

const seedProducts = async () => {
  try {
    await mongoose.connect(process.env.CONNECTION_STRING);
    console.log("✅ Connected to MongoDB");

    // 🔥 GET ALL CATEGORIEs
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
  for (const item of formattedProducts) {
    // Insert product
    const productDoc = await InventoryProduct.create(item);

    // Get all stores for this company
    const stores = await Store.find({ companyId: COMPANY_ID });

    // Create StoreInventory rows for each store
    if (stores.length) {
      const ops = stores.map(store => ({
        updateOne: {
          filter: { store: store._id, product: productDoc._id },
          update: { $setOnInsert: { companyId: COMPANY_ID, quantity: 0 } },
          upsert: true
        }
      }));

      await StoreInventory.bulkWrite(ops);
    }
  }

  console.log("🎉 PRODUCTS INSERTED SUCCESSFULLY with store inventory!");
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