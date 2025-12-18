require("dotenv").config({ path: __dirname + "/.env" });
const mongoose = require("mongoose");
const CompanyTaxLedger = require("./models/CompanyTaxLedger"); // adjust path

const run = async () => {
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

    // ⚠️ DELETE ALL LEDGER RECORDS
    console.log("⚠️ Deleting ALL CompanyTaxLedger records...");
    const result = await CompanyTaxLedger.deleteMany({});

    console.log(`✅ Deleted ${result.deletedCount} ledger record(s).`);
    process.exit(0);
  } catch (err) {
    console.error("❌ Error:", err);
    process.exit(1);
  }
};

run();