require("dotenv").config({ path: __dirname + "/.env" });
const mongoose = require("mongoose");
const { Product } = require("./models/product"); // adjust path if needed

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

    // ⚠️ Delete all products
    console.log("⚠️ Deleting all products...");
    const result = await Product.deleteMany({});
    console.log(`✅ Deleted ${result.deletedCount} product(s).`);

    process.exit(0);
  } catch (err) {
    console.error("❌ Error:", err);
    process.exit(1);
  }
};

run();