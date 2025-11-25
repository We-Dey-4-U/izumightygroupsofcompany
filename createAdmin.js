require("dotenv").config({ path: __dirname + "/.env" });
const mongoose = require("mongoose");
const bcrypt = require("bcrypt");
const { User } = require("./models/user");

// Safety check
if (!process.env.CONNECTION_STRING) {
  console.error("❌ Error: CONNECTION_STRING is missing in .env");
  process.exit(1);
}

// Users to create
const usersToCreate = [
  {
    name: "Admin User",
    email: "admin2@example.com",
    password: "Admin@123",
    role: "admin",
  },
  {
    name: "Staff User",
    email: "staff2@example.com",
    password: "Staff@123",
    role: "staff",
  },
  {
    name: "Sub Admin",
    email: "subadmin@example.com",
    password: "SubAdmin@123",
    role: "subadmin",
  },
  {
    name: "Super Stakeholder",
    email: "stakeholder2@example.com",
    password: "Stakeholder@123",
    role: "stakeholder",
  },
  {
    name: "Regular User",
    email: "user2@example.com",
    password: "User@123",
    role: "user",
  },
];

const createUsers = async () => {
  try {
    await mongoose.connect(process.env.CONNECTION_STRING, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    console.log("✅ Connected to MongoDB");

    for (const u of usersToCreate) {
      const existing = await User.findOne({ email: u.email });

      if (existing) {
        console.log(`⚠ ${u.role} already exists: ${u.email}`);
        continue;
      }

      // 🔐 Twist the email (optional uniqueness)
      const twistedEmail = u.email.replace("@", `+seed@`);

      // 🔐 Hash password
      const hashedPassword = await bcrypt.hash(u.password, 10);

      const newUser = new User({
        name: u.name,
        email: twistedEmail,
        password: hashedPassword,

        // Map roles to boolean flags
        isAdmin: u.role === "admin",
        isStaff: u.role === "staff",
        isSubAdmin: u.role === "subadmin",
        isSuperStakeholder: u.role === "stakeholder",
      });

      await newUser.save();
      console.log(`✔ Created ${u.role}: ${newUser.email}`);
    }

    console.log("🎉 User seeding complete!");
    process.exit(0);
  } catch (err) {
    console.error("❌ Error seeding users:", err);
    process.exit(1);
  }
};

createUsers();