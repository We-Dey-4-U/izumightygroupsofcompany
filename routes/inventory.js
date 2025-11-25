const express = require("express");
const router = express.Router();
const { auth, isAdmin, isSuperStakeholder } = require("../middleware/auth");

const InventoryProduct = require("../models/InventoryProduct");
const StockMovement = require("../models/StockMovement");

// -----------------------------------------
// CREATE PRODUCT
// -----------------------------------------
router.post("/product", auth, isAdmin, async (req, res) => {
  try {
    const {
      name,
      productModel,
      category,
      image,
      costPrice,
      sellingPrice,
      quantityInStock = 0,
      itemsSold = 0,
    } = req.body;

    if (!name || !productModel || !category || !costPrice || !sellingPrice) {
      return res.status(400).json({ message: "Please provide all required fields" });
    }

    const product = await InventoryProduct.create({
      name,
      productModel,
      category,
      image,
      costPrice,
      sellingPrice,
      quantityInStock,
      itemsSold,
      createdBy: req.user._id,
    });

    res.status(201).json(product);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// -----------------------------------------
// ADD STOCK (STOCK IN)
// -----------------------------------------
router.post("/stock-in/:productId", auth, isAdmin, async (req, res) => {
  try {
    const { quantity, description } = req.body;
    const product = await InventoryProduct.findById(req.params.productId);

    if (!product) return res.status(404).json({ message: "Product not found" });

    const prevQty = product.quantityInStock;
    product.quantityInStock += quantity;
    await product.save();

    await StockMovement.create({
      product: product._id,
      type: "STOCK_IN",
      quantity,
      previousQuantity: prevQty,
      newQuantity: product.quantityInStock,
      description,
      performedBy: req.user._id,
    });

    res.status(200).json({ message: "Stock added successfully", product });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// -----------------------------------------
// REMOVE STOCK (STOCK OUT)
// -----------------------------------------
router.post("/stock-out/:productId", auth, isAdmin, async (req, res) => {
  try {
    const { quantity, description } = req.body;
    const product = await InventoryProduct.findById(req.params.productId);

    if (!product) return res.status(404).json({ message: "Product not found" });

    if (product.quantityInStock < quantity)
      return res.status(400).json({ message: "Insufficient stock" });

    const prevQty = product.quantityInStock;
    product.quantityInStock -= quantity;
    await product.save();

    await StockMovement.create({
      product: product._id,
      type: "STOCK_OUT",
      quantity,
      previousQuantity: prevQty,
      newQuantity: product.quantityInStock,
      description,
      performedBy: req.user._id,
    });

    res.status(200).json({ message: "Stock removed successfully", product });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// -----------------------------------------
// GET ALL PRODUCTS
// -----------------------------------------
router.get("/products", auth, async (req, res) => {
  // ❌ Block if user is NOT admin AND NOT super stakeholder
  if (!req.user.isAdmin && !req.user.isSuperStakeholder) {
    return res.status(403).json({ message: "Access denied" });
  }

  try {
    const products = await InventoryProduct.find().sort({ createdAt: -1 });
    res.status(200).json(products);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});
// -----------------------------------------
// GET STOCK HISTORY FOR A PRODUCT
// -----------------------------------------
router.get("/history/:productId", auth, isAdmin, async (req, res) => {
  try {
    const history = await StockMovement.find({
      product: req.params.productId,
    })
      .populate("performedBy", "name email")
      .sort({ createdAt: -1 });

    res.status(200).json(history);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// -----------------------------------------
// UPDATE ITEMS SOLD  ✅ PLACE IT BEFORE EXPORT
// -----------------------------------------
router.patch("/update-sold/:productId", auth, isAdmin, async (req, res) => {
  console.log("PATCH /update-sold called");

  try {
    const { itemsSold } = req.body;
    console.log("itemsSold:", itemsSold);

    const product = await InventoryProduct.findById(req.params.productId);
    if (!product) return res.status(404).json({ message: "Product not found" });

    if (itemsSold > product.quantityInStock)
      return res.status(400).json({ message: "Items sold cannot exceed stock" });

    product.itemsSold = itemsSold;
    await product.save();

    res.status(200).json({ message: "Product updated", product });
  } catch (err) {
    console.error("Error updating itemsSold:", err);
    res.status(500).json({ message: err.message });
  }
});

module.exports = router; // 🚨 EXPORT ONLY AT THE END