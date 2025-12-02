require("dotenv").config({ path: __dirname + "/.env" });
const mongoose = require("mongoose");
const bcrypt = require("bcrypt");
const { User } = require("./models/user");

// Safety check
if (!process.env.CONNECTION_STRING) {
  console.error("❌ Error: CONNECTION_STRING is missing in .env");
  process.exit(1);
}

// Users to create: 2 per company for each role
const companies = ["Agreeko", "Welbeg"];

const usersToCreate = [];

companies.forEach((company) => {
  usersToCreate.push(
    {
      name: `${company} Admin`,
      email: `admin_${company.toLowerCase()}@example.com`,
      password: "Admin@123",
      role: "admin",
      company,
    },
    {
      name: `${company} SubAdmin`,
      email: `subadmin_${company.toLowerCase()}@example.com`,
      password: "SubAdmin@123",
      role: "subadmin",
      company,
    },
    {
      name: `${company} Stakeholder`,
      email: `stakeholder_${company.toLowerCase()}@example.com`,
      password: "Stakeholder@123",
      role: "stakeholder",
      company,
    }
  );
});

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

      const hashedPassword = await bcrypt.hash(u.password, 10);

      const newUser = new User({
        name: u.name,
        email: u.email,
        password: hashedPassword,
        company: u.company,
        isAdmin: u.role === "admin",
        isSubAdmin: u.role === "subadmin",
        isSuperStakeholder: u.role === "stakeholder",
      });

      await newUser.save();
      console.log(`✔ Created ${u.role} (${u.company}): ${newUser.email}`);
    }

    console.log("🎉 User seeding complete!");
    process.exit(0);
  } catch (err) {
    console.error("❌ Error seeding users:", err);
    process.exit(1);
  }
};

createUsers();