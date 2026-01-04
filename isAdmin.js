require("dotenv").config({ path: __dirname + "/.env" });
const mongoose = require("mongoose");
const { User } = require("./models/user");

// Check MongoDB connection string 
if (!process.env.CONNECTION_STRING) {
  console.error("❌ CONNECTION_STRING missing in .env");
  process.exit(1);
}

//scribleadmin@techwireict.com
//Scrible@29
//Ikesonlimited@techwireict.com
//welbeg233@electricity.com
//admindelight@delightsome.com
//oba@gmail.com
// Email of the account to make admin
//techwireadmin@techwireict.com
//admin@techwireict.com
//admin200@techwireict.org
//stakeholder@techwireict.org
//Delightsome@techwireict.com
//stakeholder20@techwireict.com
//Stakeholder@techwireict.com
const targetEmail = "harvesthub@sample.com";


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

    user.isAdmin = true;
    user.isSubAdmin = false; // Optional: reset subadmin
     user.isStaff = false; // Optional: reset subadmin
    user.isSuperStakeholder = false; // Optional: reset super stakeholder
    await user.save();

    console.log(`✔ User ${targetEmail} is now an admin`);
    process.exit(0);
  } catch (err) {
    console.error("❌ Error updating user:", err);
    process.exit(1);
  }
};

makeAdmin();