require("dotenv").config({ path: __dirname + "/.env" });
const mongoose = require("mongoose");
const bcrypt = require("bcrypt");
const { User } = require("./models/user");

// Safety check
if (!process.env.CONNECTION_STRING) {
  console.error("❌ CONNECTION_STRING missing in .env");
  process.exit(1);
}

const superAdminData = {
  name: "Techwireict SuperAdmin",
  email: "superadmin@techwireict.com",
  password: "SuperAdmin@123",
  isSuperAdmin: true,      // Has full privileg
  isAdmin: false,
  isStaff: false,
  isSuperStakeholder: false,
  isSubAdmin: false,
  company: null,           // 🔹 Superadmin has no company
  companyId: null,
};

const createSuperAdmin = async () => {
  try {
    await mongoose.connect(process.env.CONNECTION_STRING, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log("✅ Connected to MongoDB");

    const existing = await User.findOne({ email: superAdminData.email });
    if (existing) {
      console.log(`⚠ SuperAdmin already exists: ${existing.email}`);
      process.exit(0);
    }

    const hashedPassword = await bcrypt.hash(superAdminData.password, 10);

    const newUser = new User({
      ...superAdminData,
      password: hashedPassword,
    });

    await newUser.save();
    console.log(`✔ Created SuperAdmin: ${newUser.email}`);
    process.exit(0);
  } catch (err) {
    console.error("❌ Error creating SuperAdmin:", err);
    process.exit(1);
  }
};

createSuperAdmin();