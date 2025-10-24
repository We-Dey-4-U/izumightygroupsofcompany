const { Product } = require("../models/product");
const { isAdmin } = require("../middleware/auth");
const router = require("express").Router();
const multer = require("multer");
const path = require("path");
const fs = require("fs");

// --- Ensure uploads folder exists ---
const uploadDir = "uploads";
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

// --- Multer config ---
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  },
});

const fileFilter = (req, file, cb) => {
  const allowedTypes = /jpeg|jpg|png|gif/;
  const valid =
    allowedTypes.test(path.extname(file.originalname).toLowerCase()) &&
    allowedTypes.test(file.mimetype);
  cb(valid ? null : new Error("Only images are allowed"), valid);
};

const upload = multer({ storage, fileFilter });

// --- CREATE PRODUCT ---
router.post("/", isAdmin, upload.single("image"), async (req, res) => {
  try {
    const { name, category, desc, price, originalPrice, rating } = req.body;
    const image = req.file ? req.file.path : null;

    console.log("Creating product:", { name, category, desc, price, originalPrice, rating, image });

    const product = new Product({
      name,
      category,           // ✅ use category enum
      desc,
      price: Number(price),
      originalPrice: originalPrice ? Number(originalPrice) : undefined,
      rating: rating ? Number(rating) : undefined,
      image,
    });

    const savedProduct = await product.save();
    console.log("Product saved:", savedProduct);
    res.status(200).send(savedProduct);
  } catch (error) {
    console.error("Create product error:", error);
    res.status(500).send(error);
  }
});

// --- UPDATE PRODUCT ---
router.put("/:id", isAdmin, upload.single("image"), async (req, res) => {
  try {
    const updateData = { ...req.body };

    if (req.file) {
      const product = await Product.findById(req.params.id);
      if (product.image) fs.unlink(product.image, (err) => err && console.error(err));
      updateData.image = req.file.path;
    }

    if (updateData.price) updateData.price = Number(updateData.price);
    if (updateData.originalPrice) updateData.originalPrice = Number(updateData.originalPrice);
    if (updateData.rating) updateData.rating = Number(updateData.rating);

    const updatedProduct = await Product.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true }
    );

    console.log("Product updated:", updatedProduct);
    res.status(200).send(updatedProduct);
  } catch (error) {
    console.error("Update error:", error);
    res.status(500).send(error);
  }
});

// --- DELETE PRODUCT ---
router.delete("/:id", isAdmin, async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) return res.status(404).send("Product not found...");
    if (product.image) fs.unlink(product.image, (err) => err && console.error(err));
    const deletedProduct = await Product.findByIdAndDelete(req.params.id);
    console.log("Product deleted:", deletedProduct);
    res.status(200).send(deletedProduct);
  } catch (error) {
    console.error("Delete error:", error);
    res.status(500).send(error);
  }
});

// --- GET ALL PRODUCTS ---
router.get("/", async (req, res) => {
  try {
    const products = await Product.find();
    console.log("Fetched products:", products);
    res.status(200).send(products);
  } catch (error) {
    console.error("Fetch products error:", error);
    res.status(500).send(error);
  }
});

// --- GET SINGLE PRODUCT ---
router.get("/:id", async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) return res.status(404).send("Product not found");
    res.status(200).send(product);
  } catch (error) {
    console.error("Fetch single product error:", error);
    res.status(500).send(error);
  }
});



// --- GET PRODUCTS BY CATEGORY ---
router.get("/category/:category", async (req, res) => {
  try {
    const products = await Product.find({ category: req.params.category });
    console.log(`Fetched products for category ${req.params.category}:`, products);
    res.status(200).json(products);
  } catch (err) {
    console.error("Fetch products by category error:", err);
    res.status(500).json({ error: err.message });
  }
});


module.exports = router;