require("dotenv").config({ path: __dirname + "/.env" });
const mongoose = require("mongoose");
const Expense = require("./models/Expense"); // adjust path if needed

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

    // ⚠️ WARNING: This will delete ALL Expense documents
    console.log("⚠️ Deleting all Expense documents...");
    const result = await Expense.deleteMany({});

    console.log(`✅ Deleted ${result.deletedCount} Expense record(s).`);
    process.exit(0);
  } catch (err) {
    console.error("❌ Error:", err);
    process.exit(1);
  }
};

run();
