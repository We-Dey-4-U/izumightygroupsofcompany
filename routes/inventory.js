const express = require("express");
const router = express.Router();
const { auth, isAdmin, isSubAdmin, isSuperStakeholder } = require("../middleware/auth");
const ProductEditRequest = require("../models/ProductEditRequest");
const InventoryProduct = require("../models/InventoryProduct");
const StockMovement = require("../models/StockMovement");

// -------------------------------------------------
// CREATE PRODUCT
// -------------------------------------------------
router.post("/product", auth, async (req, res) => {
  if (!req.user.isAdmin && !req.user.isSubAdmin && !req.user.isSuperStakeholder) {
    return res.status(403).json({ message: "Access denied" });
  }

  try {
    const {
      name,
      productModel,
      category,
      image,
      costPrice,
      sellingPrice,
      quantityInStock = 0
    } = req.body;

    if (!name || !productModel || !category || !costPrice || !sellingPrice) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    const product = await InventoryProduct.create({
      companyId: req.user.companyId, // 🔐 PAYROLL STYLE ISOLATION
      name,
      productModel,
      category,
      image,
      costPrice,
      sellingPrice,
      quantityInStock,
      createdBy: req.user._id
    });

    res.status(201).json(product);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});


// -------------------------------------------------
// STOCK IN
// -------------------------------------------------
router.post("/stock-in/:productId", auth, async (req, res) => {
  try {
    const { quantity, description } = req.body;

    const product = await InventoryProduct.findOne({
      _id: req.params.productId,
      companyId: req.user.companyId
    });

    if (!product) {
      return res.status(404).json({ message: "Product not found or access denied" });
    }

    const prevQty = product.quantityInStock;
    product.quantityInStock += Number(quantity);
    await product.save();

    await StockMovement.create({
      companyId: req.user.companyId,
      product: product._id,
      type: "STOCK_IN",
      quantity,
      previousQuantity: prevQty,
      newQuantity: product.quantityInStock,
      description,
      performedBy: req.user._id
    });

    res.json({ message: "Stock added successfully", product });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});


// -------------------------------------------------
// STOCK OUT
// -------------------------------------------------
router.post("/stock-out/:productId", auth, async (req, res) => {
  try {
    const { quantity, description } = req.body;

    const product = await InventoryProduct.findOne({
      _id: req.params.productId,
      companyId: req.user.companyId
    });

    if (!product) {
      return res.status(404).json({ message: "Product not found or access denied" });
    }

    if (product.quantityInStock < quantity) {
      return res.status(400).json({ message: "Insufficient stock" });
    }

    const prevQty = product.quantityInStock;
    product.quantityInStock -= Number(quantity);
    await product.save();

    await StockMovement.create({
      companyId: req.user.companyId,
      product: product._id,
      type: "STOCK_OUT",
      quantity,
      previousQuantity: prevQty,
      newQuantity: product.quantityInStock,
      description,
      performedBy: req.user._id
    });

    res.json({ message: "Stock removed successfully", product });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});


// -------------------------------------------------
// GET ALL PRODUCTS (COMPANY ISOLATED)
// -------------------------------------------------
router.get("/products", auth, async (req, res) => {
  if (!req.user.isAdmin && !req.user.isSubAdmin && !req.user.isSuperStakeholder) {
    return res.status(403).json({ message: "Access denied" });
  }

  try {
    const products = await InventoryProduct.find({
      companyId: req.user.companyId
    }).sort({ createdAt: -1 });

    res.json(products);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});


// -------------------------------------------------
// GET STOCK HISTORY
// -------------------------------------------------
router.get("/history/:productId", auth, async (req, res) => {
  try {
    const product = await InventoryProduct.findOne({
      _id: req.params.productId,
      companyId: req.user.companyId
    });

    if (!product) {
      return res.status(404).json({ message: "Product not found or access denied" });
    }

    const history = await StockMovement.find({
      product: product._id,
      companyId: req.user.companyId
    })
      .populate("performedBy", "name email")
      .sort({ createdAt: -1 });

    res.json(history);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});


// -------------------------------------------------
// UPDATE ITEMS SOLD
// -------------------------------------------------
router.patch("/update-sold/:productId", auth, async (req, res) => {
  try {
    const { itemsSold } = req.body;

    const product = await InventoryProduct.findOne({
      _id: req.params.productId,
      companyId: req.user.companyId
    });

    if (!product) {
      return res.status(404).json({ message: "Product not found or access denied" });
    }

    if (itemsSold > product.quantityInStock) {
      return res.status(400).json({ message: "Items sold cannot exceed stock" });
    }

    product.itemsSold = Number(itemsSold);
    await product.save();

    res.json({ message: "Product updated", product });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});



// -------------------------------------------------
// DIRECT PRODUCT EDIT (STAKEHOLDER ONLY)
// -------------------------------------------------
router.patch("/edit-product/:productId", auth, async (req, res) => {
  if (!req.user.isSuperStakeholder) {
    return res.status(403).json({ message: "Only stakeholder can edit product" });
  }

  try {
    const product = await InventoryProduct.findOne({
      _id: req.params.productId,
      companyId: req.user.companyId
    });

    if (!product) {
      return res.status(404).json({ message: "Product not found" });
    }

    Object.assign(product, req.body);
    await product.save();

    res.json({ message: "Product updated successfully", product });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});



// -------------------------------------------------
// REQUEST PRODUCT EDIT (ADMIN ONLY)
// -------------------------------------------------
router.post("/request-edit/:productId", auth, async (req, res) => {
  if (!req.user.isAdmin) {
    return res.status(403).json({ message: "Only admins can request edits" });
  }

  const product = await InventoryProduct.findOne({
    _id: req.params.productId,
    companyId: req.user.companyId
  });

  if (!product) {
    return res.status(404).json({ message: "Product not found" });
  }

  const request = await ProductEditRequest.create({
    product: product._id,
    companyId: req.user.companyId,
    requestedChanges: req.body,
    requestedBy: req.user._id
  });

  res.json({ message: "Edit request submitted", request });
});




// -------------------------------------------------
// APPROVE EDIT
// -------------------------------------------------
router.patch("/approve-edit/:requestId", auth, async (req, res) => {
  if (!req.user.isSuperStakeholder) {
    return res.status(403).json({ message: "Only SuperAdmin can approve" });
  }

  const request = await ProductEditRequest.findById(req.params.requestId)
    .populate("product");

  if (!request || request.status !== "PENDING") {
    return res.status(400).json({ message: "Invalid request" });
  }

  Object.assign(request.product, request.requestedChanges);
  await request.product.save();

  request.status = "APPROVED";
  request.approvedBy = req.user._id;
  request.approvedAt = new Date();
  await request.save();

  res.json({ message: "Approved successfully" });
});





router.patch("/reject-edit/:requestId", auth, async (req, res) => {
  if (!req.user.isSuperStakeholder) {
    return res.status(403).json({ message: "Only SuperAdmin can reject" });
  }

  const request = await ProductEditRequest.findById(req.params.requestId);

  if (!request) {
    return res.status(404).json({ message: "Request not found" });
  }

  request.status = "REJECTED";
  await request.save();

  res.json({ message: "Request rejected" });
});




router.get("/pending-requests", auth, async (req, res) => {
  if (!req.user.isSuperStakeholder) {
    return res.status(403).json({ message: "Access denied" });
  }

  const requests = await ProductEditRequest.find({
    companyId: req.user.companyId,
    status: "PENDING"
  })
  .populate("product")
  .populate("requestedBy", "name email")
  .sort({ createdAt: -1 });

  res.json(requests);
});



// -------------------------------------------------
// MONTHLY INVENTORY SUMMARY (PAYROLL STYLE)
// -------------------------------------------------
router.get("/summary/monthly", auth, async (req, res) => {
  try {
    const summary = await StockMovement.aggregate([
      { $match: { companyId: req.user.companyId } },
      {
        $group: {
          _id: {
            year: { $year: "$createdAt" },
            month: { $month: "$createdAt" },
            type: "$type"
          },
          totalQuantity: { $sum: "$quantity" }
        }
      },
      { $sort: { "_id.year": 1, "_id.month": 1 } }
    ]);

    const formatted = summary.reduce((acc, row) => {
      const key = `${row._id.year}-${row._id.month}`;
      if (!acc[key]) acc[key] = { STOCK_IN: 0, STOCK_OUT: 0 };
      acc[key][row._id.type] = row.totalQuantity;
      return acc;
    }, {});

    const productsSold = await InventoryProduct.find({
      companyId: req.user.companyId
    }).select("name itemsSold");

    res.json({
      monthlySummary: formatted,
      productsSold
    });
  } catch (err) {
    console.error("❌ INVENTORY SUMMARY ERROR:", err);
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;