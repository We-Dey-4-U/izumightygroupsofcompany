require("dotenv").config({ path: __dirname + "/.env" });
const mongoose = require("mongoose");
const Company = require("./models/Company"); // adjust path if needed

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
    const companies = await Company.find(
      {},
      {
        name: 1,
        code: 1,
        bank: 1,
        _id: 0,
      }
    );

    console.log("\n🏢 Companies, Codes & Bank Details:\n");

    companies.forEach((c, i) => {
      console.log(`🔹 ${i + 1}. Company Name: ${c.name}`);
      console.log(`   Code: ${c.code}`);

      if (c.bank) {
        console.log(`   Bank Name: ${c.bank.bankName}`);
        console.log(`   Account Number: ${c.bank.accountNumber}`);
        console.log(`   Account Name: ${c.bank.accountName}`);
      } else {
        console.log("   ⚠️ No bank details provided");
      }

      console.log("--------------------------------------------------");
    });

    process.exit(0);
  } catch (err) {
    console.error("❌ Error:", err);
    process.exit(1);
  }
};

run();
