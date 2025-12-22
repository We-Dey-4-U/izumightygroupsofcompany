require("dotenv").config({ path: __dirname + "/.env" });

const mongoose = require("mongoose");
const Expense = require("./models/Expense");

const run = async () => {
  try {
    console.log("ENV CHECK:", process.env.CONNECTION_STRING);

    if (!process.env.CONNECTION_STRING) {
      console.error("❌ CONNECTION_STRING missing in .env");
      process.exit(1);
    }

    console.log("⏳ Connecting to MongoDB...");
    await mongoose.connect(process.env.CONNECTION_STRING, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    console.log("✅ Connected to MongoDB");

    // Count how many expenses are missing dateOfExpense
    const missingCount = await Expense.countDocuments({ dateOfExpense: { $exists: false } });
    console.log(`📊 Expenses missing dateOfExpense: ${missingCount}`);

    // Count total expenses
    const totalCount = await Expense.countDocuments({});
    console.log(`📊 Total expenses in collection: ${totalCount}`);

    // Optionally, force update dateOfExpense = createdAt for all documents
    const forceUpdate = true; // change to false to only update missing dateOfExpense

    let filter = {};
    if (!forceUpdate) {
      filter = { dateOfExpense: { $exists: false }, createdAt: { $exists: true } };
    }

    const result = await Expense.updateMany(
      filter,
      [
        {
          $set: {
            dateOfExpense: "$createdAt",
          },
        },
      ]
    );

    console.log(`✅ Expenses updated: ${result.modifiedCount}`);

    await mongoose.disconnect();
    console.log("✅ Done");
    process.exit(0);
  } catch (err) {
    console.error("❌ Fix failed:", err);
    process.exit(1);
  }
};

run();