require("dotenv").config({ path: __dirname + "/.env" });
const mongoose = require("mongoose");
const InventoryCategory = require("./models/InventoryCategory");

if (!process.env.CONNECTION_STRING) {
  console.error("❌ CONNECTION_STRING missing in .env");
  process.exit(1);
}

const COMPANY_ID = "69934576cb826ddfd7a54543";
const CREATED_BY = "69937290cb826ddfd7a54ab4";

const categories = [
  "Keyboard",
  "Laptop Battery",   // ✅ add this
  "Battery",
  "Laptop",
  "Laptop Charger"
];



const seedCategories = async () => {
  try {
    await mongoose.connect(process.env.CONNECTION_STRING);
    console.log("✅ Connected to MongoDB");

    for (let name of categories) {
      const exists = await InventoryCategory.findOne({
        name,
        companyId: COMPANY_ID
      });

      if (exists) {
        console.log(`⚠ Category already exists: ${name}`);
        continue;
      }

      await InventoryCategory.create({
        companyId: COMPANY_ID,
        name,
        createdBy: CREATED_BY
      });

      console.log(`✔ Created category: ${name}`);
    }

    console.log("🎉 Categories seeding completed!");
    process.exit(0);
  } catch (err) {
    console.error("❌ Error seeding categories:", err);
    process.exit(1);
  }
};

seedCategories();