const express = require("express");
const router = express.Router();
const { body, validationResult } = require("express-validator");
const Company = require("../models/Company");
const { Product } = require("../models/product");
const { auth, isSuperAdmin } = require("../middleware/auth");

/**
 * Generate unique 4-digit company code
 */
function generateCompanyCode() {
  return Math.floor(1000 + Math.random() * 9000);
}

/**
 * ============================
 * CREATE COMPANY (SUPERADMIN)
 * ============================
 */
router.post(
  "/create",
  auth,
  isSuperAdmin,

  // 🔐 VALIDATION & SANITIZATION
  [
    body("name").trim().notEmpty().withMessage("Company name is required"),
    body("rcNumber").trim().notEmpty().withMessage("RC Number is required"),
    body("tin").trim().notEmpty().withMessage("TIN is required"),
    body("state").optional().trim(),
    body("isVATRegistered").optional().isBoolean(),

    // BANK VALIDATION
    body("bank").exists().withMessage("Bank details are required"),
    body("bank.bankName")
      .trim()
      .notEmpty()
      .withMessage("Bank name is required"),
    body("bank.accountNumber")
      .trim()
      .isNumeric()
      .isLength({ min: 10, max: 10 })
      .withMessage("Account number must be 10 digits"),
    body("bank.accountName")
      .trim()
      .notEmpty()
      .withMessage("Account name is required"),
  ],

  async (req, res) => {
    console.log("🔐 POST /api/company/create");
    console.log("👤 Admin ID:", req.user?._id);
    console.log("🌍 IP Address:", req.ip);
    console.log("📦 Payload:", req.body);

    // ❌ VALIDATION ERRORS
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      console.warn("❌ Validation failed:", errors.array());
      return res.status(400).json({
        message: "Invalid input",
        errors: errors.array(),
      });
    }

    try {
      // 🔒 FIELD WHITELISTING (ANTI-INJECTION)
      const {
        name,
        rcNumber,
        tin,
        state,
        isVATRegistered = false,
        bank,
      } = req.body;

      // 🔐 Ensure bank object is clean
      const sanitizedBank = {
        bankName: bank.bankName.trim(),
        accountNumber: bank.accountNumber.trim(),
        accountName: bank.accountName.trim(),
      };

      // 🔢 Generate unique company code
      let code,
        exists = true;
      while (exists) {
        code = generateCompanyCode();
        exists = await Company.findOne({ code });
      }

      const company = new Company({
        name,
        rcNumber,
        tin,
        state,
        isVATRegistered,
        bank: sanitizedBank,
        code,
      });

      await company.save();

      console.log("✅ Company created successfully");
      console.log("🏢 Company ID:", company._id);
      console.log("🏦 Bank:", sanitizedBank.bankName);

      res.status(201).json({
        message: "Company created successfully",
        companyId: company._id,
      });
    } catch (err) {
      console.error("🔥 Error creating company:", err);
      res.status(500).json({
        message: "Server error",
      });
    }
  }
);

/**
 * ============================
 * GET ALL COMPANIES (SUPERADMIN)
 * ============================
 */
router.get("/", auth, isSuperAdmin, async (req, res) => {
  console.log("🔐 GET /api/company");
  console.log("👤 Admin ID:", req.user?._id);

  try {
    const companies = await Company.find();
    console.log("📦 Companies fetched:", companies.length);

    res.status(200).json(companies);
  } catch (err) {
    console.error("🔥 Error fetching companies:", err);
    res.status(500).json({ message: "Server error" });
  }
});

/**
 * ============================
 * FETCH COMPANY BY PRODUCTS
 * ============================
 * Used during checkout
 */
router.post("/by-products", auth, async (req, res) => {
  try {
    const { productIds } = req.body;

    if (!Array.isArray(productIds) || productIds.length === 0) {
      return res.status(400).json({ message: "Invalid product list" });
    }

    const products = await Product.find({ _id: { $in: productIds } });

    if (!products.length) {
      return res.status(400).json({ message: "Invalid products" });
    }

    // 🔐 ENSURE SINGLE COMPANY PER ORDER
    const companyId = products[0].companyId.toString();
    const mixed = products.some(
      (p) => p.companyId.toString() !== companyId
    );

    if (mixed) {
      console.warn("❌ Mixed companies detected in cart");
      return res.status(400).json({
        message: "Multiple companies not allowed in one order",
      });
    }

    const company = await Company.findById(companyId).select(
      "name bank"
    );

    res.json(company);
  } catch (err) {
    console.error("🔥 Error fetching company by products:", err);
    res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;