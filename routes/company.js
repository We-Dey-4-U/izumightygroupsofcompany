const express = require("express");
const router = express.Router();
const { body, validationResult } = require("express-validator");
const Company = require("../models/Company");
const { Product } = require("../models/product");
const { auth, isSuperAdmin } = require("../middleware/auth");

function generateCompanyCode() {
  return Math.floor(1000 + Math.random() * 9000);
}

router.post(
  "/create",
  auth,
  isSuperAdmin,
  [
    body("name").trim().notEmpty().withMessage("Company name is required"),
    body("rcNumber").trim().notEmpty().withMessage("RC Number is required"),
    body("tin").trim().notEmpty().withMessage("TIN is required"),
    body("state").optional().trim(),
    body("isVATRegistered").optional().isBoolean(),
    body("phone")
      .trim()
      .notEmpty()
      .withMessage("Phone number is required")
      .isLength({ min: 10 })
      .withMessage("Phone number must be valid"),
    body("bank").exists().withMessage("Bank details are required"),
    body("bank.bankName").trim().notEmpty().withMessage("Bank name is required"),
    body("bank.accountNumber")
      .trim()
      .isNumeric()
      .isLength({ min: 10, max: 10 })
      .withMessage("Account number must be 10 digits"),
    body("bank.accountName").trim().notEmpty().withMessage("Account name is required"),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ message: "Invalid input", errors: errors.array() });

    try {
      const { name, rcNumber, tin, state, isVATRegistered = false, bank, phone } = req.body;

      const sanitizedBank = {
        bankName: bank.bankName.trim(),
        accountNumber: bank.accountNumber.trim(),
        accountName: bank.accountName.trim(),
      };

      let code, exists = true;
      while (exists) {
        code = generateCompanyCode();
        exists = await Company.findOne({ code });
      }

      const company = new Company({ name, rcNumber, tin, state, isVATRegistered, phone, bank: sanitizedBank, code });
      await company.save();

      res.status(201).json({
        message: "Company created successfully",
        company, // send full object
      });
    } catch (err) {
      console.error("Error creating company:", err);
      res.status(500).json({ message: "Server error" });
    }
  }
);

router.get("/", auth, isSuperAdmin, async (req, res) => {
  try {
    const companies = await Company.find();
    res.status(200).json(companies);
  } catch (err) {
    console.error("Error fetching companies:", err);
    res.status(500).json({ message: "Server error" });
  }
});

router.post("/by-products", auth, async (req, res) => {
  try {
    const { productIds } = req.body;
    if (!Array.isArray(productIds) || !productIds.length) return res.status(400).json({ message: "Invalid product list" });

    const products = await Product.find({ _id: { $in: productIds } });
    if (!products.length) return res.status(400).json({ message: "Invalid products" });

    const companyId = products[0].companyId.toString();
    if (products.some(p => p.companyId.toString() !== companyId))
      return res.status(400).json({ message: "Multiple companies not allowed in one order" });

    const company = await Company.findById(companyId).select("name phone bank");
    res.json(company);
  } catch (err) {
    console.error("Error fetching company by products:", err);
    res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;