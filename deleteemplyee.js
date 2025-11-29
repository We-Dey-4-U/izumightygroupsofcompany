require("dotenv").config({ path: __dirname + "/.env" });
const mongoose = require("mongoose");
const EmployeeInfo = require("./models/EmployeeInfo"); // <-- adjust path if needed

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

    // WARNING: THIS WILL DELETE ALL EMPLOYEE INFO DOCUMENT
    console.log("⚠️ Deleting all EmployeeInfo documents...");
    const result = await EmployeeInfo.deleteMany({});
    console.log(`✅ Deleted ${result.deletedCount} EmployeeInfo record(s).`);

    process.exit(0);
  } catch (err) {
    console.error("❌ Error:", err);
    process.exit(1);
  }
};

run();