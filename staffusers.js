require("dotenv").config({ path: __dirname + "/.env" });
const mongoose = require("mongoose");
const bcrypt = require("bcrypt");
const { User } = require("./models/user");

// Check for MongoDB connection string
if (!process.env.CONNECTION_STRING) {
  console.error("❌ CONNECTION_STRING missing in .env");
  process.exit(1);
}

// --- Admins / Subadmins / Stakeholders --
const specialUsers = [
  // Agreeko
  {
    name: "Agreeko Admin",
    email: "agreeko.admin@example.com",
    password: "Admin@123",
    company: "Agreeko",
    isAdmin: true,
    isSubAdmin: false,
    isSuperStakeholder: false,
    isStaff: false,
  },
  {
    name: "Agreeko SubAdmin",
    email: "agreeko.subadmin@example.com",
    password: "SubAdmin@123",
    company: "Agreeko",
    isAdmin: false,
    isSubAdmin: true,
    isSuperStakeholder: false,
    isStaff: false,
  },
  // Welbe
  {
    name: "Welbeg Admin",
    email: "welbeg.admin@example.com",
    password: "Admin@123",
    company: "Welbeg",
    isAdmin: true,
    isSubAdmin: false,
    isSuperStakeholder: false,
    isStaff: false,
  },
  {
    name: "Welbeg SubAdmin",
    email: "welbeg.subadmin@example.com",
    password: "SubAdmin@123",
    company: "Welbeg",
    isAdmin: false,
    isSubAdmin: true,
    isSuperStakeholder: false,
    isStaff: false,
  },
  // Super Stakeholder
  {
    name: "Super Stakeholder",
    email: "stakeholder@example.com",
    password: "Stakeholder@123",
    company: "Agreeko",
    isAdmin: false,
    isSubAdmin: false,
    isSuperStakeholder: true,
    isStaff: false,
  },
];

// --- Staff Users (20 users alternating companies) ---
const staffUsers = Array.from({ length: 20 }, (_, i) => ({
  name: `Staff User ${i + 1}`,
  email: `staff${i + 1}@example.com`,
  password: `Staff@${i + 1}23`,
  company: i % 2 === 0 ? "Agreeko" : "Welbeg",
  isAdmin: false,
  isSubAdmin: false,
  isSuperStakeholder: false,
  isStaff: true,
}));

const allUsers = [...specialUsers, ...staffUsers];

// --- Seed Function ---
const seedUsers = async () => {
  try {
    await mongoose.connect(process.env.CONNECTION_STRING, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log("✅ Connected to MongoDB");

    for (const u of allUsers) {
      const existing = await User.findOne({ email: u.email });
      if (existing) {
        console.log(`⚠ User already exists: ${u.email}`);
        continue;
      }

      const hashedPassword = await bcrypt.hash(u.password, 10);

      const newUser = new User({
        name: u.name,
        email: u.email,
        password: hashedPassword,
        company: u.company,
        isAdmin: u.isAdmin,
        isSubAdmin: u.isSubAdmin,
        isSuperStakeholder: u.isSuperStakeholder,
        isStaff: u.isStaff,
      });

      await newUser.save();

      console.log(
        `✔ Created ${u.isAdmin ? "Admin" : u.isSubAdmin ? "SubAdmin" : u.isSuperStakeholder ? "Stakeholder" : "Staff"}: ${newUser.email} | Company: ${newUser.company} | isStaff: ${newUser.isStaff}`
      );
    }

    console.log("🎉 All users seeded successfully!");
    process.exit(0);
  } catch (err) {
    console.error("❌ Error seeding users:", err);
    process.exit(1);
  }
};

// Run the seed
seedUsers();