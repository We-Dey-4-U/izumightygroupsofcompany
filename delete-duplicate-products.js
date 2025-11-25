require("dotenv").config({ path: __dirname + "/.env" });
const mongoose = require("mongoose");

const run = async () => {
  try {
    if (!process.env.CONNECTION_STRING) {
      console.error("❌ CONNECTION_STRING missing in .env");
      process.exit(1);
    }

    console.log("⏳ Connecting to MongoDB...");
    await mongoose.connect(process.env.CONNECTION_STRING, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    console.log("✅ Connected!");

    const db = mongoose.connection.db;
    const collection = db.collection("inventoryproducts");

    console.log("🔍 Checking indexes...");
    const indexes = await collection.indexes();
    console.log("📄 Current Indexes:", indexes);

    // Find sku index
    const skuIndex = indexes.find(idx => idx.name === "sku_1");

    if (!skuIndex) {
      console.log("✨ No sku_1 index found. Nothing to remove.");
      process.exit(0);
    }

    console.log("⚠️ Found OLD INDEX:", skuIndex);

    console.log("🗑️ Removing sku_1 index...");
    await collection.dropIndex("sku_1");

    console.log("✅ SUCCESS! sku_1 index removed.");
    process.exit(0);

  } catch (err) {
    console.error("❌ Error:", err);
    process.exit(1);
  }
};

run();
