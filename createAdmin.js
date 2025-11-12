require("dotenv").config({ path: __dirname + "/.env" });
const mongoose = require("mongoose");
const bcrypt = require("bcrypt");
const { User } = require("./models/user"); // Make sure your User model is exported

// Safety check
if (!process.env.CONNECTION_STRING) {
  console.error("Error: CONNECTION_STRING is undefined. Please check your .env file.");
  process.exit(1);
}

// Users to create
const usersToCreate = [
  {
    name: "Admin User",
    email: "admintechwire@example.com",
    password: "Admin@123",
    role: "admin", // will map to isAdmin
  },
  {
    name: "Staff User",
    email: "staff@example.com",
    password: "Staff@123",
    role: "staff", // will map to isStaff
  },
  {
    name: "Regular User",
    email: "user@example.com",
    password: "User@123",
    role: "user", // default user
  },
];

const createUsers = async () => {
  try {
    await mongoose.connect(process.env.CONNECTION_STRING, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log("Connected to MongoDB");

    for (const u of usersToCreate) {
      const existing = await User.findOne({ email: u.email });
      if (existing) {
        console.log(`${u.role} already exists: ${u.email}`);
        continue;
      }

      const hashedPassword = await bcrypt.hash(u.password, 10);

      const newUser = new User({
        name: u.name,
        email: u.email,
        password: hashedPassword,
        isAdmin: u.role === "admin",
        isStaff: u.role === "staff",
      });

      await newUser.save();
      console.log(`Created ${u.role}: ${newUser.email}`);
    }

    console.log("User seeding complete!");
    process.exit(0);
  } catch (err) {
    console.error("Error creating users:", err);
    process.exit(1);
  }
};

createUsers();