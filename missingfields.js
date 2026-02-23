require("dotenv").config({ path: __dirname + "/.env" });

const mongoose = require("mongoose");
const InventoryProduct = require("./models/InventoryProduct");
const StoreInventory = require("./models/StoreInventory");
const Store = require("./models/Store");

async function migrate() {
  try {
    if (!process.env.CONNECTION_STRING) {
      console.error("❌ CONNECTION_STRING missing in .env");
      process.exit(1);
    }

    console.log("⏳ Connecting to MongoDB...");
    await mongoose.connect(process.env.CONNECTION_STRING, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });

    console.log("✅ MongoDB Connected!");

    // find default store
    const defaultStore = await Store.findOne({ type: "OFFICE" });
    if (!defaultStore) {
      console.error("❌ No OFFICE store found. Create one first.");
      process.exit(1);
    }

    console.log("📦 Migrating products...");

    const products = await InventoryProduct.find({
      quantityInStock: { $exists: true }
    });

    console.log(`Found ${products.length} product(s) to migrate`);

    for (const p of products) {
      // move itemsSold → totalSold
      if (p.itemsSold !== undefined) {
        p.totalSold = p.itemsSold;
      }

      // create store inventory record
      await StoreInventory.updateOne(
        { store: defaultStore._id, product: p._id },
        {
          $setOnInsert: {
            companyId: p.companyId,
            quantity: p.quantityInStock || 0
          }
        },
        { upsert: true }
      );

      // remove old fields
      p.quantityInStock = undefined;
      p.itemsSold = undefined;
      p.itemsAvailable = undefined;

      await p.save();
    }

    console.log("✅ Migration complete!");

    await mongoose.disconnect();
    process.exit(0);

  } catch (err) {
    console.error("❌ Migration error:", err);
    process.exit(1);
  }
}

migrate();