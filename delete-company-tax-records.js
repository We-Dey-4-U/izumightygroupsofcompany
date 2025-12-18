require("dotenv").config({ path: __dirname + "/.env" });
const mongoose = require("mongoose");
const CompanyTaxRecord = require("./models/CompanyTaxRecord"); // adjust path if needed

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

    console.log("⚠️ Deleting ALL CompanyTaxRecord documents...");
    const result = await CompanyTaxRecord.deleteMany({});

    console.log(`✅ Deleted ${result.deletedCount} company tax record(s).`);
    process.exit(0);
  } catch (err) {
    console.error("❌ Error:", err);
    process.exit(1);
  }
};

run();