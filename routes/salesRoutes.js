const express = require("express");
const router = express.Router();
const { auth, isAdmin, isSuperStakeholder, isSubAdmin } = require("../middleware/auth");
const { updateCompanyTaxFromSales } = require("../utils/companyTaxUpdater");
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
    console.log(
      "🔵 [SALE CREATE]",
      "User:", req.user._id,
      "CompanyId:", req.user.companyId
    );

    const {
      items,
      discount = 0,
      paymentMethod,
      customerName,
      customerPhone
    } = req.body;

    if (!items || items.length === 0) {
      return res.status(400).json({ message: "No items selected for sale" });
    }

    let subtotal = 0;

    for (const item of items) {
      /* =======================
         PRODUCT
      ======================== */
      if (item.type === "product") {
        const product = await InventoryProduct.findById(item.productId);

        if (!product) {
          return res.status(404).json({
            message: `Product not found: ${item.productId}`
          });
        }

        // 🔥 COMPANY ISOLATION (ObjectId comparison)
        if (!product.companyId.equals(req.user.companyId)) {
          return res.status(403).json({
            message: "Product does not belong to your company"
          });
        }

        if (product.quantityInStock < item.quantity) {
          return res.status(400).json({
            message: `Insufficient stock for ${product.name}. Available: ${product.quantityInStock}`
          });
        }

        item.price = product.sellingPrice;
        item.total = item.price * item.quantity;
        subtotal += item.total;

        product.quantityInStock -= item.quantity;
        product.itemsSold += item.quantity;
        await product.save();
      }

      /* =======================
         SERVICE
      ======================== */
      else if (item.type === "service") {
        if (!item.serviceName || item.serviceName.trim() === "") {
          return res.status(400).json({ message: "Service name is required" });
        }

        if (!item.price || item.price <= 0) {
          return res.status(400).json({
            message: "Service price must be greater than 0"
          });
        }

        item.total = item.price * item.quantity;
        subtotal += item.total;
        item.productId = null;
      }

      else {
        return res.status(400).json({
          message: `Invalid item type: ${item.type}`
        });
      }
    }

    /* =======================
       VAT CALCULATION
    ======================== */
    const VAT_RATE = 7.5;
    const vatAmount = Number(((subtotal * VAT_RATE) / 100).toFixed(2));
    const totalAmount = subtotal + vatAmount - Number(discount);

    /* =======================
       CREATE SALE
    ======================== */
    const sale = await Sale.create({
      saleId: generateSaleId(),
      companyId: req.user.companyId, // ✅ FIXED
      items,
      subtotal,
      vatRate: VAT_RATE,
      vatAmount,
      discount,
      totalAmount,
      paymentMethod,
      customerName,
      customerPhone,
      createdBy: req.user._id
    });

    /* =======================
       UPDATE COMPANY TAX (VAT)
    ======================== */
    const saleDate = new Date(sale.createdAt);

    await updateCompanyTaxFromSales(
      sale.companyId,                // ✅ ObjectId
      saleDate.getMonth() + 1,
      saleDate.getFullYear(),
      req.user._id                   // audit trail
    );

    console.log("🟢 SALE CREATED + VAT UPDATED:", sale.saleId);
    res.status(201).json(sale);

  } catch (err) {
    console.error("🔥 [SALE CREATE ERROR]:", err);
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
    const sales = await Sale.find({
      companyId: req.user.companyId // ✅ DB-level isolation
    })
      .populate("createdBy", "name email")
      .populate("items.productId", "name productModel category")
      .sort({ createdAt: -1 });

    res.status(200).json(sales);
  } catch (err) {
    console.error("🔥 [GET SALES ERROR]:", err);
    res.status(500).json({ message: err.message });
  }
});

// ======================================================
// GET SINGLE SALE
// ======================================================
router.get("/:saleId", auth, async (req, res) => {
  try {
    const sale = await Sale.findOne({
      saleId: req.params.saleId,
      companyId: req.user.companyId // ✅ secure
    })
      .populate("createdBy", "name email")
      .populate("items.productId", "name productModel category");

    if (!sale) {
      return res.status(404).json({ message: "Sale not found" });
    }

    res.status(200).json(sale);
  } catch (err) {
    console.error("🔥 [GET SALE ERROR]:", err);
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;