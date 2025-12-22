require("dotenv").config({ path: __dirname + "/.env" });
const mongoose = require("mongoose");
const Company = require("./models/company"); // adjust path if neede

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

    // ⚠️ Delete all company documents
    console.log("⚠️ Deleting all company documents...");
    const result = await Company.deleteMany({});
    console.log(`✅ Deleted ${result.deletedCount} company document(s).`);

    process.exit(0);
  } catch (err) {
    console.error("❌ Error:", err);
    process.exit(1);
  }
};

run();