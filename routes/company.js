require("dotenv").config();

const express = require("express");
const router = express.Router();

const multer = require("multer");
const upload = multer({ storage: multer.memoryStorage() });

const axios = require("axios");
const FormData = require("form-data");
const { v4: uuidv4 } = require("uuid");

const { body, validationResult } = require("express-validator");
const Company = require("../models/Company");
const { Product } = require("../models/product");
const { auth, isSuperAdmin } = require("../middleware/auth");

/* ======================================================
   🔧 REBUILD BANK OBJECT (🔥 FIX FOR multipart/form-data)
====================================================== */
const rebuildBank = (req, res, next) => {
  if (!req.body.bank && req.body["bank.bankName"]) {
    req.body.bank = {
      bankName: req.body["bank.bankName"],
      accountNumber: req.body["bank.accountNumber"],
      accountName: req.body["bank.accountName"],
    };
  }
  next();
};

/* ======================================================
   🧠 Appwrite Connectivity Check
====================================================== */
(async () => {
  console.log("🧠 [INIT] Checking Appwrite configuration...");

  const {
    APPWRITE_ENDPOINT,
    APPWRITE_PROJECT_ID,
    APPWRITE_BUCKET_ID,
    APPWRITE_API_KEY,
  } = process.env;

  if (!APPWRITE_ENDPOINT || !APPWRITE_PROJECT_ID || !APPWRITE_BUCKET_ID || !APPWRITE_API_KEY) {
    console.error("❌ [INIT] Missing Appwrite environment variables!");
    return;
  }

  try {
    const res = await axios.get(
      `${APPWRITE_ENDPOINT}/storage/buckets/${APPWRITE_BUCKET_ID}`,
      {
        headers: {
          "X-Appwrite-Project": APPWRITE_PROJECT_ID,
          "X-Appwrite-Key": APPWRITE_API_KEY,
        },
      }
    );
    console.log("✅ [INIT] Appwrite bucket reachable:", res.data.name);
  } catch (err) {
    console.error("❌ [INIT] Appwrite bucket check failed:", err.message);
  }
})();

/* ======================================================
   📤 Upload Logo to Appwrite
====================================================== */
async function uploadToAppwrite(file) {
  if (!file || !file.buffer) {
    throw new Error("No file buffer found");
  }

  const fileId = uuidv4();
  const formData = new FormData();

  formData.append("fileId", fileId);
  formData.append("file", file.buffer, {
    filename: file.originalname,
    contentType: file.mimetype,
    knownLength: file.size,
  });

  const resp = await axios.post(
    `${process.env.APPWRITE_ENDPOINT}/storage/buckets/${process.env.APPWRITE_BUCKET_ID}/files`,
    formData,
    {
      headers: {
        "X-Appwrite-Project": process.env.APPWRITE_PROJECT_ID,
        "X-Appwrite-Key": process.env.APPWRITE_API_KEY,
        ...formData.getHeaders(),
      },
      maxBodyLength: Infinity,
    }
  );

  return {
    id: resp.data.$id,
    url: `${process.env.APPWRITE_ENDPOINT}/storage/buckets/${process.env.APPWRITE_BUCKET_ID}/files/${resp.data.$id}/view?project=${process.env.APPWRITE_PROJECT_ID}`,
  };
}

/* ======================================================
   🔢 Company Code Generator
====================================================== */
function generateCompanyCode() {
  return Math.floor(1000 + Math.random() * 9000);
}

/* ======================================================
   ✅ CREATE COMPANY
====================================================== */
router.post(
  "/create",
  auth,
  isSuperAdmin,
  upload.single("logo"),
  rebuildBank, // 🔥 MUST BE BEFORE VALIDATION
  [
  body("name").trim().notEmpty().withMessage("Company name is required"),

  body("rcNumber").trim().notEmpty().withMessage("RC Number is required"),

  body("tin").trim().notEmpty().withMessage("TIN is required"),

  body("state").optional().trim(),

  body("phone")
    .trim()
    .notEmpty()
    .matches(/^[0-9+\-\s]{1,20}$/)
    .withMessage("Invalid phone number"),

  body("isVATRegistered").optional().isBoolean(),

  body("bank").isObject().withMessage("Bank details required"),

  body("bank.bankName").notEmpty().withMessage("Bank name required"),

  body("bank.accountNumber")
    .trim()
    .matches(/^[0-9]{1,20}$/)
    .withMessage("Account number must be 1–20 digits"),

  body("bank.accountName").notEmpty().withMessage("Account name required"),
],
  async (req, res) => {
    console.log("🚀 [CREATE COMPANY] Incoming request");
    console.log("📦 req.body:", req.body);
    console.log("📁 req.file:", req.file ? req.file.originalname : "NO FILE");

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      console.error("❌ [VALIDATION ERROR]", errors.array());
      return res.status(400).json({ message: "Invalid input", errors: errors.array() });
    }

    try {
      const {
        name,
        rcNumber,
        tin,
        state,
        phone,
        isVATRegistered = false,
        bank,
      } = req.body;

      let logo = null;
      if (req.file) {
        logo = await uploadToAppwrite(req.file);
      }

      let code;
      while (await Company.exists({ code: (code = generateCompanyCode()) })) {}

      const company = await Company.create({
        name,
        rcNumber,
        tin,
        state,
        phone,
        isVATRegistered,
        bank,
        code,
        logo,
      });

      res.status(201).json({
        message: "Company created successfully",
        company,
      });
    } catch (err) {
      console.error("🔥 [CREATE COMPANY ERROR]", err);
      res.status(500).json({ message: "Server error" });
    }
  }
);

/* ======================================================
   📄 GET ALL COMPANIES
====================================================== */
router.get("/", auth, isSuperAdmin, async (req, res) => {
  try {
    const companies = await Company.find();
    res.json(companies);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});
/* ======================================================
   🧾 GET COMPANY BY PRODUCTS
====================================================== */
router.post("/by-products", auth, async (req, res) => {
  const { productIds } = req.body;

  if (!Array.isArray(productIds) || !productIds.length) {
    return res.status(400).json({ message: "Invalid product list" });
  }

  const products = await Product.find({ _id: { $in: productIds } });
  const companyId = products[0]?.companyId;

  if (!companyId) {
    return res.status(400).json({ message: "Invalid products" });
  }

  const company = await Company.findById(companyId).select("name phone bank logo");
  res.json(company);
});

module.exports = router;