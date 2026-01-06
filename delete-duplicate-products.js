require("dotenv").config();
const mongoose = require("mongoose");

async function run() {
  await mongoose.connect(process.env.CONNECTION_STRING);
  console.log("✅ Connected");

  const collection = mongoose.connection.db.collection("taxsettings");

  // Find documents where company is null OR missing
  const badDocs = await collection.find({
    $or: [
      { company: null },
      { company: { $exists: false } }
    ]
  }).sort({ _id: 1 }).toArray();

  if (badDocs.length > 1) {
    const idsToDelete = badDocs.slice(1).map(d => d._id);

    await collection.deleteMany({ _id: { $in: idsToDelete } });

    console.log(`🗑️ Removed ${idsToDelete.length} invalid taxsettings docs`);
  } else {
    console.log("✅ No duplicate invalid taxsettings");
  }

  process.exit(0);
}

run().catch(console.error);