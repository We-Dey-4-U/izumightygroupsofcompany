require("dotenv").config({ path: __dirname + "/.env" });
const mongoose = require("mongoose");
const Company = require("./models/Company"); // Adjust path if needed

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

    console.log("📦 Fetching all companies...");
    const companies = await Company.find({}, { name: 1, code: 1, _id: 0 }); 
    // {_id:0} hides the MongoDB _id field, only shows name & code

    console.log("🏢 Companies and their codes:");
    companies.forEach((c, i) => {
      console.log(`${i + 1}. ${c.name} — Code: ${c.code}`);
    });

    process.exit(0);
  } catch (err) {
    console.error("❌ Error:", err);
    process.exit(1);
  }
};

run();