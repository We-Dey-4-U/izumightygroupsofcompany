const jwt = require("jsonwebtoken");

const generateAuthToken = (user) => {
  const jwtSecretKey = process.env.JWT_SECRET_KEY;

  const token = jwt.sign(
    {
      _id: user._id,
      name: user.name,
      email: user.email,

      // Role flags
      isAdmin: user.isAdmin || false,
      isStaff: user.isStaff || false,
      isSuperStakeholder: user.isSuperStakeholder || false,
      isSubAdmin: user.isSubAdmin || false,
      isSuperAdmin: user.isSuperAdmin || false,

      // Company context
      company: user.company || null,
      companyId: user.companyId || null,
    },
    jwtSecretKey,
    {
      expiresIn: "1h",
      audience: process.env.JWT_AUD, // use env directly
      issuer: process.env.JWT_ISS,    // use env directly
    }
  );

  return token;
};

module.exports = generateAuthToken;