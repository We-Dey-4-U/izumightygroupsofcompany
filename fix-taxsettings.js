const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, ".env") });

const mongoose = require("mongoose");

if (!process.env.CONNECTION_STRING) {
  console.error("❌ CONNECTION_STRING missing in .env");
  process.exit(1);
}

async function run() {
  await mongoose.connect(process.env.CONNECTION_STRING);
  console.log("✅ MongoDB Connected");

  const collection = mongoose.connection.db.collection("taxsettings");

  // 1️⃣ DELETE INVALID DOCUMENT
  const deleteResult = await collection.deleteMany({
    $or: [
      { company: null },
      { company: { $exists: false } },
      { companyId: null },
      { companyId: { $exists: false } }
    ]
  });

  console.log(`🗑️ Deleted ${deleteResult.deletedCount} invalid taxsettings docs`);

  // 2️⃣ DROP BROKEN UNIQUE INDEXES
  const indexes = await collection.indexes();

  for (const idx of indexes) {
    if (idx.name === "company_1" || idx.name === "companyId_1") {
      await collection.dropIndex(idx.name);
      console.log(`🔥 Dropped index ${idx.name}`);
    }
  }

  // 3️⃣ CREATE SAFE PARTIAL UNIQUE INDEXES
  await collection.createIndex(
    { company: 1 },
    {
      unique: true,
      partialFilterExpression: {
        company: { $type: "string" }
      }
    }
  );

  await collection.createIndex(
    { companyId: 1 },
    {
      unique: true,
      partialFilterExpression: {
        companyId: { $type: "string" }
      }
    }
  );

  console.log("✅ Partial unique indexes created (company, companyId)");

  await mongoose.disconnect();
  process.exit(0);
}

run().catch(err => {
  console.error("❌ FIX FAILED:", err);
  process.exit(1);
});