const jwt = require("jsonwebtoken");

const generateRefreshToken = (user) => {
  const refreshSecret = process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET_KEY;

  const token = jwt.sign(
    {
      _id: user._id,
    },
    refreshSecret,
    {
      expiresIn: "7d",            // Refresh token valid for 7 days
      audience: process.env.JWT_AUD, // Use env variable directly
      issuer: process.env.JWT_ISS,   // Use env variable directly
    }
  );

  return token;
};

module.exports = generateRefreshToken;