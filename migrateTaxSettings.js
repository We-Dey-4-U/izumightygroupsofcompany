// scripts/migrateTaxSettings.js

require("dotenv").config({ path: __dirname + "/.env" }); // load .env
const mongoose = require("mongoose");

const Company = require("./models/Company");
const TaxSettings = require("./models/TaxSettings");

async function migrateTaxSettings() {
  try {
    // ✅ Check CONNECTION_STRING
    if (!process.env.CONNECTION_STRING) {
      console.error("❌ CONNECTION_STRING missing in .env");
      process.exit(1);
    }

    console.log("⏳ Connecting to MongoDB...");
    await mongoose.connect(process.env.CONNECTION_STRING, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log("✅ MongoDB connected");

    const taxSettings = await TaxSettings.find();

    for (const ts of taxSettings) {
      // Find corresponding company by name
      const company = await Company.findOne({ name: ts.company });
      if (!company) {
        console.warn(`⚠️ No company found for TaxSettings: ${ts._id}`);
        continue;
      }

      // Update TaxSettings with companyId
      ts.companyId = company._id;
      await ts.save();
      console.log(`✅ Updated TaxSettings ${ts._id} with companyId ${company._id}`);
    }

    console.log("🎉 Migration completed");
    process.exit(0);
  } catch (err) {
    console.error("❌ Migration error:", err);
    process.exit(1);
  }
}

migrateTaxSettings();