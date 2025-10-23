// Load environment variables
require("dotenv").config({ path: __dirname + "/.env" });

const mongoose = require("mongoose");
const bcrypt = require("bcrypt");
const { User } = require("./models/User");

// Safety check
if (!process.env.CONNECTION_STRING) {
  console.error("Error: CONNECTION_STRING is undefined. Please check your .env file.");
  process.exit(1);
}

console.log("Mongo URI:", process.env.CONNECTION_STRING);

const createAdmin = async () => {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.CONNECTION_STRING, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log("Connected to MongoDB");

    // Check if admin already exists
    const existingAdmin = await User.findOne({ email: "admin@example.com" });
    if (existingAdmin) {
      console.log("Admin already exists:", existingAdmin.email);
      process.exit(0);
    }

    // Hash the password
    const hashedPassword = await bcrypt.hash("Admin@123", 10);

    // Create new admin user
    const adminUser = new User({
      name: "Admin User",
      email: "admin@example.com",
      password: hashedPassword,
      isAdmin: true,
    });

    await adminUser.save();
    console.log("Admin user created successfully:", adminUser);

    process.exit(0);
  } catch (err) {
    console.error("Error creating admin user:", err);
    process.exit(1);
  }
};

createAdmin();