require("dotenv").config({ path: __dirname + "/.env" });
const mongoose = require("mongoose");
const CompanyTaxLedger = require("./models/CompanyTaxLedger"); // adjust path if neede

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

    console.log("⚠️ Deleting CORRUPTED Payroll Ledger records...");

    const result = await CompanyTaxLedger.deleteMany({
      source: "Payroll",
      taxType: { $in: ["PAYE", "NHIS"] }
    });

    console.log(`✅ Deleted ${result.deletedCount} ledger record(s).`);

    console.log("✅ Ledger cleanup complete.");
    process.exit(0);
  } catch (err) {
    console.error("❌ Error deleting ledger records:", err);
    process.exit(1);
  }
};

run();