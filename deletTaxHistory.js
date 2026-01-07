require("dotenv").config({ path: __dirname + "/.env" });
const mongoose = require("mongoose");

// Models
const TaxHistory = require("./models/TaxHistory"); // adjust path if neede
const EmployerLiability = require("./models/EmployerLiability"); // adjust path if needed

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

    // ----- DELETE ALL TAX HISTORY DOCUMENTS -----
    console.log("⚠️ Deleting ALL TaxHistory documents...");
    const taxResult = await TaxHistory.deleteMany({});
    console.log(`✅ Deleted ${taxResult.deletedCount} TaxHistory document(s).`);

    // ----- DELETE ALL EMPLOYER LIABILITY DOCUMENTS -----
    console.log("⚠️ Deleting ALL EmployerLiability documents...");
    const employerResult = await EmployerLiability.deleteMany({});
    console.log(`✅ Deleted ${employerResult.deletedCount} EmployerLiability document(s).`);

    console.log("✅ All deletions completed.");
    process.exit(0);

  } catch (err) {
    console.error("❌ Error:", err);
    process.exit(1);
  }
};

run();