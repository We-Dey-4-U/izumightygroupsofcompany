const express = require("express");
const router = express.Router();
const { auth, isAdmin, isSubAdmin, isSuperStakeholder } = require("../middleware/auth");

const InventoryProduct = require("../models/InventoryProduct");
const StockMovement = require("../models/StockMovement");
const { User } = require("../models/user");

// -----------------------------------------
// CREATE PRODUCT
// -----------------------------------------
router.post("/product", auth, async (req, res) => {
  if (!req.user.isAdmin && !req.user.isSubAdmin && !req.user.isSuperStakeholder) {
    return res.status(403).json({ message: "Access denied" });
  }

  try {
    const { name, productModel, category, image, costPrice, sellingPrice, quantityInStock = 0, itemsSold = 0 } = req.body;

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
// STOCK IN
// -----------------------------------------
router.post("/stock-in/:productId", auth, async (req, res) => {
  try {
    const { quantity, description } = req.body;
    const product = await InventoryProduct.findById(req.params.productId).populate("createdBy", "company");

    if (!product) return res.status(404).json({ message: "Product not found" });
    if (product.createdBy.company !== req.user.company) return res.status(403).json({ message: "Access denied: different company" });

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
// STOCK OUT
// -----------------------------------------
router.post("/stock-out/:productId", auth, async (req, res) => {
  try {
    const { quantity, description } = req.body;
    const product = await InventoryProduct.findById(req.params.productId).populate("createdBy", "company");

    if (!product) return res.status(404).json({ message: "Product not found" });
    if (product.createdBy.company !== req.user.company) return res.status(403).json({ message: "Access denied" });

    if (product.quantityInStock < quantity) return res.status(400).json({ message: "Insufficient stock" });

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
  if (!req.user.isAdmin && !req.user.isSubAdmin && !req.user.isSuperStakeholder) {
    return res.status(403).json({ message: "Access denied" });
  }

  try {
    let products = await InventoryProduct.find().populate("createdBy", "company").sort({ createdAt: -1 });
    products = products.filter((p) => p.createdBy?.company === req.user.company);

    res.status(200).json(products);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// -----------------------------------------
// GET STOCK HISTORY
// -----------------------------------------
router.get("/history/:productId", auth, async (req, res) => {
  try {
    const product = await InventoryProduct.findById(req.params.productId).populate("createdBy", "company");
    if (!product) return res.status(404).json({ message: "Product not found" });
    if (product.createdBy.company !== req.user.company) return res.status(403).json({ message: "Access denied" });

    const history = await StockMovement.find({ product: req.params.productId }).populate("performedBy", "name email").sort({ createdAt: -1 });
    res.status(200).json(history);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// -----------------------------------------
// UPDATE ITEMS SOLD
// -----------------------------------------
router.patch("/update-sold/:productId", auth, async (req, res) => {
  try {
    const { itemsSold } = req.body;
    const product = await InventoryProduct.findById(req.params.productId).populate("createdBy", "company");

    if (!product) return res.status(404).json({ message: "Product not found" });
    if (product.createdBy.company !== req.user.company) return res.status(403).json({ message: "Access denied" });
    if (itemsSold > product.quantityInStock) return res.status(400).json({ message: "Items sold cannot exceed stock" });

    product.itemsSold = itemsSold;
    await product.save();

    res.status(200).json({ message: "Product updated", product });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});


// -----------------------------------------
// MONTHLY INVENTORY SUMMARY
// -----------------------------------------
router.get("/summary/monthly", auth, async (req, res) => {
  try {
    // Step 1: Get all products for the user's company
    const products = await InventoryProduct.find()
      .populate("createdBy", "company")
      .sort({ createdAt: -1 });

    const companyProducts = products.filter(
      (p) => p.createdBy?.company === req.user.company
    );

    const productIds = companyProducts.map((p) => p._id);

    // Step 2: Aggregate stock movements by month and type
    const summary = await StockMovement.aggregate([
      { $match: { product: { $in: productIds } } },
      {
        $group: {
          _id: {
            month: { $month: "$createdAt" },
            year: { $year: "$createdAt" },
            type: "$type",
          },
          totalQuantity: { $sum: "$quantity" },
        },
      },
      { $sort: { "_id.year": 1, "_id.month": 1 } },
    ]);

    // Step 3: Format summary by month
    const formatted = summary.reduce((acc, item) => {
      const monthKey = `${item._id.year}-${item._id.month}`;
      if (!acc[monthKey]) acc[monthKey] = { STOCK_IN: 0, STOCK_OUT: 0 };
      acc[monthKey][item._id.type] = item.totalQuantity;
      return acc;
    }, {});

    // Step 4: Include total items sold per product
    const productsSold = companyProducts.map((p) => ({
      productName: p.name,
      itemsSold: p.itemsSold,
    }));

    res.status(200).json({
      monthlySummary: formatted,
      productsSold,
    });
  } catch (err) {
    console.error("❌ [MONTHLY INVENTORY SUMMARY] Error:", err.message);
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;