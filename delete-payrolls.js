require("dotenv").config({ path: __dirname + "/.env" });
const mongoose = require("mongoose");
const Payroll = require("./models/Payroll"); // <-- adjust path if needed

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

    // WARNING: THIS WILL DELETE ALL PAYROLL DOCUMENTS
    console.log("⚠️ Deleting ALL Payroll documents...");
    const result = await Payroll.deleteMany({});

    console.log(`✅ Deleted ${result.deletedCount} payroll record(s).`);

    process.exit(0);
  } catch (err) {
    console.error("❌ Error:", err);
    process.exit(1);
  }
};

run();