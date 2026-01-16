const jwt = require("jsonwebtoken");
const { User } = require("../models/user");

const auth = async (req, res, next) => {
  const token = req.header("x-auth-token");
  if (!token) return res.status(401).send("Access denied. Not authenticated");

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET_KEY);
    const user = await User.findById(decoded._id).select("-password");
    if (!user) return res.status(401).send("User not found");

    req.user = user;
    next();
  } catch (ex) {
    console.error("Auth error:", ex.message);
    res.status(401).send("Invalid or expired auth token");
  }
};

const isUser = (req, res, next) => {
  auth(req, res, () => {
    if (
      req.user._id.toString() === req.params.id ||
      req.user.isAdmin
    ) {
      next();
    } else {
      res.status(403).send("Access denied. Not authorized");
    }
  });
};

const isAdmin = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  if (!req.user.isAdmin) {
    return res.status(403).json({ message: "Admins only" });
  }

  next();
};

const isStaff = (req, res, next) => {
  auth(req, res, () => {
    if (req.user.isStaff || req.user.isAdmin) next();
    else res.status(403).send("Access denied. Staff only");
  });
};

const isSubAdmin = (req, res, next) => {
  auth(req, res, () => {
    if (req.user.isSubAdmin || req.user.isAdmin) next();
    else res.status(403).send("Access denied. SubAdmin only");
  });
};

const isSuperStakeholder = (req, res, next) => {
  auth(req, res, () => {
    if (req.user.isSuperStakeholder || req.user.isAdmin) next();
    else res.status(403).send("Access denied. SuperStakeholder only");
  });
};

const isSuperAdmin = (req, res, next) => {
  auth(req, res, () => {
    if (req.user.isSuperAdmin) next();
    else res.status(403).send("Access denied. Only super admin allowed");
  });
};

const isCompanyAdmin = (req, res, next) => {
  auth(req, res, () => {
    if (req.user.isAdmin || req.user.isSuperStakeholder) {
      next();
    } else {
      res.status(403).json({ message: "Forbidden: Admins only" });
    }
  });
};

const companyDataAccess = (model) => async (req, res, next) => {
  req.model = model;
  req.companyId = req.user.company;
  next();
};

module.exports = {
  auth,
  isUser,
  isAdmin,
  isStaff,
  isSubAdmin,
  isSuperStakeholder,
  isSuperAdmin,
  isCompanyAdmin,
  companyDataAccess,
};