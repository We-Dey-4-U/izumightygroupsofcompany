require("dotenv").config({ path: __dirname + "/.env" });
const mongoose = require("mongoose");
const { User } = require("./models/user");

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

    // 🔹 Delete only this user
    const emailToDelete = "Aladeojebi.timilehin@techwireict.com";

    console.log(`⚠️ Deleting user: ${emailToDelete} ...`);
    const result = await User.deleteOne({ email: emailToDelete });

    if (result.deletedCount === 1) {
      console.log(`✅ User ${emailToDelete} deleted successfully.`);
    } else {
      console.log(`ℹ️ User ${emailToDelete} not found in the database.`);
    }

    process.exit(0);
  } catch (err) {
    console.error("❌ Error:", err);
    process.exit(1);
  }
};

run();
