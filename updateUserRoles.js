require("dotenv").config({ path: __dirname + "/.env" });
const mongoose = require("mongoose");
const { User } = require("./models/user");

// Check MongoDB connection string
if (!process.env.CONNECTION_STRING) {
  console.error("❌ CONNECTION_STRING missing in .env");
  process.exit(1);
}

/**
 * ============================
 * CONFIGURE THESE VALUES ONLY  
 * ============================
 */
const targetEmail = "dmvstakeholder@example.com"; // <-- Email of the user to update

const roles = {
  isAdmin: false,             // set to true or false  dmv@example.com dmvstakeholder@example.com
  isStaff: true,             // set to true or false  staff1dmv@example.com
  isSubAdmin: false,         // set to true or false
  isSuperStakeholder: true, // set to true or false
};
/**
 * ============================
 */

const updateUserRoles = async () => {
  try {
    await mongoose.connect(process.env.CONNECTION_STRING, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log("✅ Connected to MongoDB");

    const user = await User.findOne({ email: targetEmail });

    if (!user) {
      console.error(`❌ User not found: ${targetEmail}`);
      process.exit(1);
    }

    // Update roles dynamically based on `roles` object
    for (const [roleKey, roleValue] of Object.entries(roles)) {
      if (user[roleKey] !== undefined) {
        user[roleKey] = roleValue;
      }
    }

    await user.save();

    console.log(`✔ Updated roles for ${targetEmail}:`, roles);
    process.exit(0);
  } catch (err) {
    console.error("❌ Error updating user:", err);
    process.exit(1);
  }
};

updateUserRoles();