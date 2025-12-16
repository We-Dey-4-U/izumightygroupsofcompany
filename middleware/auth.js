const jwt = require("jsonwebtoken");
const { User } = require("../models/user"); // ✅ make sure this is imported


// ====== Verify Token ======
// ====== Verify Token ======
const auth = async (req, res, next) => {
  const token = req.header("x-auth-token");
  if (!token) return res.status(401).send("Access denied. Not authenticated...");

  try {
    const jwtSecretKey = process.env.JWT_SECRET_KEY;
    const decoded = jwt.verify(token, jwtSecretKey);

    // Fetch full user from DB
    const user = await User.findById(decoded._id).select("-password");
    if (!user) return res.status(401).send("User not found");

    req.user = user; // ✅ now includes company, roles, etc 
    next();
  } catch (ex) {
    console.error("Auth error:", ex);
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


// ====== Check if SubAdmin =====
const isSubAdmin = (req, res, next) => {
  auth(req, res, () => {
    if (req.user.isSubAdmin || req.user.isAdmin) {
      next();
    } else {
      res.status(403).send("Access denied. Only SubAdmins can perform this action.");
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

// Only SuperAdmin
const isSuperAdmin = (req, res, next) => {
  if (req.user.isSuperAdmin) next();
  else res.status(403).send("Access denied. Only super admin allowed.");
};


const isCompanyAdmin = (req, res, next) => {
  const user = req.user;
  if (!user.roles.isAdmin && !user.roles.isSuperStakeholder) {
    return res.status(403).json({ message: "Forbidden: Admins only" });
  }
  next();
};

const companyDataAccess = (model) => async (req, res, next) => {
  req.model = model;
  req.companyId = req.user.company;
  next();
};

module.exports = { auth, isUser, isAdmin, isStaff, isSuperStakeholder,isSubAdmin,isCompanyAdmin ,companyDataAccess,  isSuperAdmin  };