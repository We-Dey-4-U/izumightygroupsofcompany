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
      items,
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

    for (const item of items) {

      // -------------------------------------------------
      // PRODUCT TYPE
      // -------------------------------------------------
      if (item.type === "product") {
        if (!item.productId) {
          return res.status(400).json({ message: "Product ID is required for product items" });
        }

        const product = await InventoryProduct.findById(item.productId);
        if (!product) {
          return res.status(404).json({ message: `Product not found: ${item.productId}` });
        }

        if (product.quantityInStock < item.quantity) {
          return res.status(400).json({
            message: `Insufficient stock for ${product.name}. Available: ${product.quantityInStock}`,
          });
        }

        // Auto-fill pricing
        item.price = product.sellingPrice;
        item.total = item.quantity * item.price;
        subtotal += item.total;

        // Deduct stock
        product.quantityInStock -= item.quantity;
        product.itemsSold += item.quantity;
        await product.save();
      }

      // -------------------------------------------------
      // SERVICE TYPE
      // -------------------------------------------------
      else if (item.type === "service") {
        if (!item.serviceName || item.serviceName.trim() === "") {
          return res.status(400).json({ message: "Service name is required for service items" });
        }

        if (!item.price || item.price <= 0) {
          return res.status(400).json({ message: "Service price must be greater than 0" });
        }

        // Compute total normally
        item.total = item.price * item.quantity;
        subtotal += item.total;

        // productId stays null for services
        item.productId = null;
      }

      // -------------------------------------------------
      // UNKNOWN TYPE
      // -------------------------------------------------
      else {
        return res.status(400).json({ message: `Invalid item type: ${item.type}` });
      }
    }

    const totalAmount = subtotal + Number(tax) - Number(discount);

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