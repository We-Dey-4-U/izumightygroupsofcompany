const jwt = require("jsonwebtoken");

// ====== Verify Token ======
const auth = (req, res, next) => {
  const token = req.header("x-auth-token");
  if (!token) return res.status(401).send("Access denied. Not authenticated...");

  try {
    const jwtSecretKey = process.env.JWT_SECRET_KEY;
    const decoded = jwt.verify(token, jwtSecretKey);
    req.user = decoded;
    next();
  } catch (ex) {
    res.status(400).send("Invalid auth token...");
  }
};

// ====== Check if same user or admin =====
const isUser = (req, res, next) => {
  auth(req, res, () => {
    if (req.user._id === req.params.id || req.user.isAdmin) {
      next();
    } else {
      res.status(403).send("Access denied. Not authorized...");
    }
  });
};

// ====== Check if Admin ======
const isAdmin = (req, res, next) => {
  auth(req, res, () => {
    if (req.user.isAdmin) {
      next();
    } else {
      res.status(403).send("Access denied. Not authorized...");
    }
  });
};

// ====== Check if Staff ======
const isStaff = (req, res, next) => {
  auth(req, res, () => {
    if (req.user.isStaff || req.user.isAdmin) {
      next();
    } else {
      res.status(403).send("Access denied. Only staff can perform this action.");
    }
  });
};



// ====== Check if Super Stakeholder =====
const isSuperStakeholder = (req, res, next) => {
  auth(req, res, () => {
    if (req.user.isSuperStakeholder || req.user.isAdmin) {
      next();
    } else {
      res.status(403).send("Access denied. Only super stakeholders can perform this action.");
    }
  });
};

module.exports = { auth, isUser, isAdmin, isStaff, isSuperStakeholder };