require("dotenv").config({ path: __dirname + "/.env" });
const mongoose = require("mongoose");
const Sale = require("./models/Sale"); // <-- adjust path if needed

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

    console.log("✅ MongoDB Connected!");

    // ⚠️ WARNING: THIS WILL DELETE ALL SALES
    console.log("⚠️ Deleting ALL Sale documents...");
    const result = await Sale.deleteMany({});

    console.log(`✅ Deleted ${result.deletedCount} sale record(s).`);

    await mongoose.disconnect();
    process.exit(0);
  } catch (err) {
    console.error("❌ Error:", err);
    process.exit(1);
  }
};

run();