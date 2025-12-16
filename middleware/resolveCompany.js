const Company = require("../models/Company");

async function resolveCompany(req, res, next) {
  try {
    // Preferred: new system
    if (req.user?.companyId) {
      req.companyId = req.user.companyId;
      return next();
    }

    // Fallback: legacy system
    if (req.user?.company) {
      const company = await Company.findOne({ name: req.user.company });
      if (company) {
        req.companyId = company._id;
      }
    }

    next();
  } catch (err) {
    console.error("❌ resolveCompany error:", err.message);
    next();
  }
}

module.exports = resolveCompany;