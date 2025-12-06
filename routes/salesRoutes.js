const express = require("express");
const router = express.Router();
const { auth, isAdmin, isSuperStakeholder, isSubAdmin } = require("../middleware/auth");

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
    console.log("🔵 [SALE CREATE] req.user:", req.user);

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

      if (item.type === "product") {
        console.log("🟡 Checking product:", item.productId);

        const product = await InventoryProduct.findById(item.productId)
          .populate("createdBy", "company");

        if (!product) {
          return res.status(404).json({ message: `Product not found: ${item.productId}` });
        }

        console.log("   → product.company:", product.createdBy?.company);
        console.log("   → req.user.company:", req.user.company);

        // SAFE GUARD
        if (!product.createdBy?.company || !req.user.company) {
          console.log("❌ Company undefined during product check");
          return res.status(403).json({ message: "System error: product-company mismatch" });
        }

        if (product.createdBy.company !== req.user.company) {
          console.log("❌ Company mismatch");
          return res.status(403).json({ message: "Product does not belong to your company" });
        }

        if (product.quantityInStock < item.quantity) {
          return res.status(400).json({
            message: `Insufficient stock for ${product.name}. Available: ${product.quantityInStock}`,
          });
        }

        item.price = product.sellingPrice;
        item.total = item.price * item.quantity;
        subtotal += item.total;

        product.quantityInStock -= item.quantity;
        product.itemsSold += item.quantity;
        await product.save();
      }

      else if (item.type === "service") {
        if (!item.serviceName || item.serviceName.trim() === "") {
          return res.status(400).json({ message: "Service name is required" });
        }

        if (!item.price || item.price <= 0) {
          return res.status(400).json({ message: "Service price must be greater than 0" });
        }

        item.total = item.price * item.quantity;
        subtotal += item.total;
        item.productId = null;
      }

      else {
        return res.status(400).json({ message: `Invalid item type: ${item.type}` });
      }
    }

    const totalAmount = subtotal + Number(tax) - Number(discount);

    const sale = await Sale.create({
      saleId: generateSaleId(),
      company: req.user.company,
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

    console.log("🟢 SALE CREATED:", sale.saleId);
    res.status(201).json(sale);

  } catch (err) {
    console.log("🔥 [SALE CREATE ERROR]:", err);
    res.status(500).json({ message: err.message });
  }
});

// ======================================================
// GET ALL SALES
// ======================================================
router.get("/all", auth, async (req, res) => {
  if (!req.user.isAdmin && !req.user.isSuperStakeholder && !req.user.isSubAdmin) {
    return res.status(403).json({ message: "Access denied" });
  }

  try {
    console.log("🔵 [GET ALL SALES] User company:", req.user.company);

    let sales = await Sale.find()
      .populate("createdBy", "name email company")
      .populate("items.productId", "name productModel category")
      .sort({ createdAt: -1 });

    sales = sales.filter(sale => {
      console.log("🟡 sale.company:", sale.company);
      return sale.company === req.user.company;
    });

    res.status(200).json(sales);

  } catch (err) {
    console.log("🔥 [GET SALES ERROR]:", err);
    res.status(500).json({ message: err.message });
  }
});

// ======================================================
// GET SINGLE SALE
// ======================================================
router.get("/:saleId", auth, async (req, res) => {
  try {
    const sale = await Sale.findOne({ saleId: req.params.saleId })
      .populate("createdBy", "name email company")
      .populate("items.productId", "name productModel category");

    if (!sale) return res.status(404).json({ message: "Sale not found" });

    console.log("🔵 [GET SALE] sale.company:", sale.company);
    console.log("🔵 req.user.company:", req.user.company);

    if (!sale.company || !req.user.company) {
      console.log("❌ Undefined company during single sale check");
      return res.status(403).json({ message: "Company mismatch" });
    }

    if (sale.company !== req.user.company) {
      return res.status(403).json({ message: "Access denied: different company" });
    }

    res.status(200).json(sale);

  } catch (err) {
    console.log("🔥 [GET SALE ERROR]:", err);
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;