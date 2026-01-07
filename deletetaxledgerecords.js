require("dotenv").config({ path: __dirname + "/.env" });
const mongoose = require("mongoose");

// Models
const CompanyTaxRecord = require("./models/CompanyTaxRecord"); // adjust path if needed
const CompanyTaxLedger = require("./models/CompanyTaxLedger"); // adjust path if needed

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

    // ----- DELETE ALL CompanyTaxRecord DOCUMENTS -----
    console.log("⚠️ Deleting ALL CompanyTaxRecord documents...");
    const recordResult = await CompanyTaxRecord.deleteMany({});
    console.log(`✅ Deleted ${recordResult.deletedCount} CompanyTaxRecord document(s).`);

    // ----- DELETE ALL CompanyTaxLedger DOCUMENTS -----
    console.log("⚠️ Deleting ALL CompanyTaxLedger documents...");
    const ledgerResult = await CompanyTaxLedger.deleteMany({});
    console.log(`✅ Deleted ${ledgerResult.deletedCount} CompanyTaxLedger document(s).`);

    console.log("✅ All deletions completed.");
    process.exit(0);

  } catch (err) {
    console.error("❌ Error:", err);
    process.exit(1);
  }
};

run();