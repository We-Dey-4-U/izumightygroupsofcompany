require("dotenv").config({ path: __dirname + "/.env" });
const mongoose = require("mongoose");

const removeIndex = async () => {
  try {
    if (!process.env.CONNECTION_STRING) {
      console.error("CONNECTION_STRING is undefined. Check your .env file.");
      process.exit(1);
    }

    await mongoose.connect(process.env.CONNECTION_STRING, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    console.log("Connected to MongoDB");

    const db = mongoose.connection.db;

    // Drop the index 'userId_1' from users collection
    const result = await db.collection("users").dropIndex("userId_1");
    console.log("Index removed:", result);

    await mongoose.disconnect();
    process.exit(0);
  } catch (err) {
    console.error("Error removing index:", err.message);
    await mongoose.disconnect();
    process.exit(1);
  }
};

removeIndex();