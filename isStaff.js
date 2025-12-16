require("dotenv").config({ path: __dirname + "/.env" });
const mongoose = require("mongoose");
const { User } = require("./models/user"); // adjust path if needed

// Check MongoDB connection string
if (!process.env.CONNECTION_STRING) {
  console.error("❌ CONNECTION_STRING missing in .env");
  process.exit(1);
}

// Emails of the accounts to make staff
const staffEmails = [
 // "staff1@welbecgelectricity.com",
 // "welbegstaff2@welbeg.com",
  "stakeholder@techwireict.com",
 // "techwire.staff2@example.com"
];

const makeStaff = async () => {
  try {
    await mongoose.connect(process.env.CONNECTION_STRING, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log("✅ Connected to MongoDB");

    for (const email of staffEmails) {
      const user = await User.findOne({ email });

      if (!user) {
        console.warn(`⚠ User not found: ${email}. Skipping.`);
        continue;
      }

      user.isStaff = false;             // Set as staff
      user.isAdmin = false;            // Remove admin if any
      user.isSubAdmin = false;         // Remove subadmin if any
      user.isSuperStakeholder = true; // Remove super stakeholder if any

      await user.save();
      console.log(`✔ User ${email} is now a staff member`);
    }

    process.exit(0);
  } catch (err) {
    console.error("❌ Error updating users:", err);
    process.exit(1);
  }
};

makeStaff();