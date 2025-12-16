const jwt = require("jsonwebtoken");

const generateAuthToken = (user) => {
  const jwtSecretKey = process.env.JWT_SECRET_KEY;  //BRINGING OUR SECRET KET USING PROCESS OBJECT
  const token = jwt.sign(       //WE MAKE USE OF THE SECRET KEY TO GENERATE A TOKEN
    {
      _id: user._id,
      name: user.name,
      email: user.email,
      isAdmin: user.isAdmin,
      isStaff: user.isStaff || false, // ✅ add staff flag safely
       isSuperStakeholder: user.isSuperStakeholder || false, // ✅ new flag
        isSubAdmin: user.isSubAdmin || false, // ✅ ADD THIS LINE
         isSuperAdmin: user.isSuperAdmin || false, // 🔥 Add this!
         company: user.company, // 🔥 include company here
    },
    jwtSecretKey
  );

  return token;
};

module.exports = generateAuthToken;