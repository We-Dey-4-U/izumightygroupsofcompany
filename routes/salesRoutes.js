const express = require("express");
const router = express.Router();
const { auth, isAdmin, isSuperStakeholder, isStaff } = require("../middleware/auth");

const Sale = require("../models/Sale");
const InventoryProduct = require("../models/InventoryProduct");

// Generate Sale ID
const generateSaleId = () => {
  return `SALE-${Math.floor(100000 + Math.random() * 900000)}`;
};

// ======================================================
// CREATE A NEW SALE
// ======================================================
router.post("/create", auth, async (req, res) => {
  try {
    const {
      items,            // [{ productId, quantity, price }]
      tax = 0,
      discount = 0,
      paymentMethod,
      customerName,
      customerPhone,
    } = req.body;

    if (!items || items.length === 0) {
      return res.status(400).json({ message: "No items selected for sale" });
    }

    let subtotal = 0;

    // Validate items + adjust stock
    for (const item of items) {
      const product = await InventoryProduct.findById(item.productId);
      if (!product) {
        return res.status(404).json({ message: `Product not found: ${item.productId}` });
      }

      // Check if sufficient stock is available
      if (product.quantityInStock < item.quantity) {
        return res.status(400).json({
          message: `Insufficient stock for ${product.name}. Available: ${product.quantityInStock}`
        });
      }

      // Calculate totals
      item.price = product.sellingPrice;
      item.total = item.quantity * item.price;

      subtotal += item.total;

      // Deduct stock
      product.quantityInStock -= item.quantity;
      product.itemsSold += item.quantity;
      await product.save();
    }

    const totalAmount = subtotal + tax - discount;

    const sale = await Sale.create({
      saleId: generateSaleId(),
      items,
      subtotal,
      tax,
      discount,
      totalAmount,
      paymentMethod,
      customerName,
      customerPhone,
      createdBy: req.user._id,
    });

    res.status(201).json(sale);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ======================================================
// GET ALL SALES (Admin + SuperStakeholder Only)
// ======================================================
router.get("/all", auth, async (req, res) => {
  if (!req.user.isAdmin && !req.user.isSuperStakeholder) {
    return res.status(403).json({ message: "Access denied" });
  }

  try {
    const sales = await Sale.find()
      .populate("createdBy", "name email")
      .populate("items.productId", "name productModel category")
      .sort({ createdAt: -1 });

    res.status(200).json(sales);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ======================================================
// GET A SINGLE SALE
// ======================================================
router.get("/:saleId", auth, async (req, res) => {
  try {
    const sale = await Sale.findOne({ saleId: req.params.saleId })
      .populate("createdBy", "name email")
      .populate("items.productId", "name productModel category");

    if (!sale) return res.status(404).json({ message: "Sale not found" });

    res.status(200).json(sale);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ======================================================
// DELETE A SALE (Optional)
// ======================================================
router.delete("/:saleId", auth, isAdmin, async (req, res) => {
  try {
    const sale = await Sale.findOne({ saleId: req.params.saleId });
    if (!sale) return res.status(404).json({ message: "Sale not found" });

    await Sale.deleteOne({ saleId: req.params.saleId });

    res.status(200).json({ message: "Sale deleted successfully" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ======================================================
// GET TOTAL SALES ANALYTICS (Sum)
// ======================================================
router.get("/analytics/total-sales", auth, async (req, res) => {
  if (
    !req.user.isAdmin &&
    !req.user.isSuperStakeholder &&
    !req.user.isSubAdmin
  ) {
    return res.status(403).json({ message: "Access denied" });
  }

  try {
    const totalSales = await Sale.aggregate([
      { $group: { _id: null, total: { $sum: "$totalAmount" } } }
    ]);

    res.status(200).json({
      totalSales: totalSales[0]?.total || 0
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;