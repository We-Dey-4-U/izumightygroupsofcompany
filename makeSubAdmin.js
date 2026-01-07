require("dotenv").config({ path: __dirname + "/.env" });
const mongoose = require("mongoose");
const { User } = require("./models/user");

// Email of the account to make SubAdmin
const targetEmail = "stakeholder@techwireict.com";

const makeSubAdmin = async () => {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.CONNECTION_STRING, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    console.log("✅ Connected to MongoDB");

    // Find user
    const user = await User.findOne({ email: targetEmail });

    if (!user) {
      console.error(`❌ User not found: ${targetEmail}`);
      process.exit(1);
    }

    // Update role
    user.isAdmin = false;              // not admin
    user.isSubAdmin = false;            // YES subadmin
    user.isStaff = false;              // remove staff
    user.isSuperStakeholder = true;   // remove stakeholder

    await user.save();

    console.log(`✔ User ${targetEmail} is now a SubAdmin`);
    process.exit(0);

  } catch (err) {
    console.error("❌ Error updating user:", err);
    process.exit(1);
  }
};

makeSubAdmin();