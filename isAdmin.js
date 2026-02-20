require("dotenv").config({ path: __dirname + "/.env" });
const mongoose = require("mongoose");
const { User } = require("./models/user");

// Check MongoDB connection string 
if (!process.env.CONNECTION_STRING) {
  console.error("❌ CONNECTION_STRING missing in .env");
  process.exit(1);
}


//augustine.iyoha@rhapsody.com
//sales.rhapsodyinfotech@gmail.com
const targetEmail = "augustine.iyoha@rhapsody.com";


const makeAdmin = async () => {
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

    user.isAdmin = false;
    user.isSubAdmin = false; // Optional: reset subadmin
     user.isStaff = false; // Optional: reset subadmin
    user.isSuperStakeholder = true; // Optional: reset super stakeholder
    await user.save();

    console.log(`✔ User ${targetEmail} is now an admin`);
    process.exit(0);
  } catch (err) {
    console.error("❌ Error updating user:", err);
    process.exit(1);
  }
};

makeAdmin();