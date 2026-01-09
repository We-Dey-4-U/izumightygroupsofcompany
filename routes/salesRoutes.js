const express = require("express");
const router = express.Router();
const { auth, isAdmin, isSuperStakeholder, isSubAdmin } = require("../middleware/auth");
const { updateCompanyTaxFromSales } = require("../utils/companyTaxUpdater");
const Sale = require("../models/Sale");
const InventoryProduct = require("../models/InventoryProduct");
const Invoice = require("../models/Invoice");
const postSaleLedger = require("../utils/postSaleLedger");
const { queueFirsSubmission } = require("../utils/firsQueue");

// Generate Sale ID
const generateSaleId = () => `SALE-${Math.floor(100000 + Math.random() * 900000)}`;
// Generate Invoice ID
const generateInvoiceId = () => `INV-${Math.floor(100000 + Math.random() * 900000)}`;

// ======================================================
// CREATE A NEW SALE (FIRS-COMPLIANT)
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
      customerPhone,
      vatRate,
      salesperson,
      commissionRate = 0
    } = req.body;

    if (!items || items.length === 0) {
      return res.status(400).json({ message: "No items selected for sale" });
    }

    let subtotal = 0;

    for (const item of items) {
      if (item.type === "product") {
        const product = await InventoryProduct.findById(item.productId);
        if (!product) return res.status(404).json({ message: `Product not found: ${item.productId}` });
        if (!product.companyId.equals(req.user.companyId))
          return res.status(403).json({ message: "Product does not belong to your company" });
        if (product.quantityInStock < item.quantity)
          return res.status(400).json({
            message: `Insufficient stock for ${product.name}. Available: ${product.quantityInStock}`
          });

        item.price = product.sellingPrice;
        item.productName = product.name; // ✅ LOOKED UP FROM INVENTORY
        item.total = item.price * item.quantity;
        subtotal += item.total;

        product.quantityInStock -= item.quantity;
        product.itemsSold += item.quantity;
        await product.save();
      } else if (item.type === "service") {
        if (!item.serviceName || item.serviceName.trim() === "")
          return res.status(400).json({ message: "Service name is required" });
        if (!item.price || item.price <= 0)
          return res.status(400).json({ message: "Service price must be greater than 0" });

        item.total = item.price * item.quantity;
        subtotal += item.total;
        item.productId = null;
      } else {
        return res.status(400).json({ message: `Invalid item type: ${item.type}` });
      }
    }

    // VAT fallback
    const VAT_RATE = Number(vatRate ?? 7.5);
    if (VAT_RATE < 0 || VAT_RATE > 100) {
      return res.status(400).json({ message: "Invalid VAT rate" });
    }

    const vatAmount = Number(((subtotal * VAT_RATE) / 100).toFixed(2));
    const totalAmount = subtotal + vatAmount - Number(discount);

    // Commission
    let commissionAmount = 0;
    if (salesperson && commissionRate > 0) {
      commissionAmount = Number(((totalAmount * commissionRate) / 100).toFixed(2));
    }

    // ===============================
    // CREATE SALE (UNCHANGED LOGIC)
    // ===============================
    const sale = await Sale.create({
      saleId: generateSaleId(),
      companyId: req.user.companyId,
      items,
      subtotal,
      vatRate: VAT_RATE,
      vatAmount,
      discount,
      totalAmount,
      paymentMethod,
      customerName,
      customerPhone,
      salesperson: salesperson || null,
      commissionRate,
      commissionAmount,
      createdBy: req.user._id
    });

    console.log(`🟢 SALE CREATED: ${sale.saleId}`);

    // Ledger posting (unchanged)
    await postSaleLedger(sale);
    console.log("📘 LEDGER UPDATED FOR SALE");

    // ===============================
    // CREATE INVOICE (DRAFT — FIRS SAFE)
    // ===============================
    const invoice = await Invoice.create({
      invoiceId: generateInvoiceId(),
      companyId: req.user.companyId,
      items,
      subtotal,
      vatRate: VAT_RATE,
      vatAmount,
      discount,
      totalAmount,
      paymentMethod: paymentMethod || "Pending",
      customerName,
      customerPhone,

      // 🔐 FIRS RULE: NEVER AUTO-SUBMIT
      firsInvoiceStatus: "DRAFT",
      submittedToFirs: false,

      createdBy: req.user._id
    });

    console.log(`🟢 INVOICE CREATED (DRAFT): ${invoice.invoiceId}`);

    // OPTIONAL BUT SAFE: link invoice to sale (no breaking)
    sale.invoiceId = invoice.invoiceId;
    await sale.save();

    // ===============================
    // UPDATE COMPANY TAX (UNCHANGED)
    // ===============================
    const saleDate = new Date(sale.createdAt);
    await updateCompanyTaxFromSales(
      sale.companyId,
      saleDate.getMonth() + 1,
      saleDate.getFullYear(),
      req.user._id
    );

    console.log("✅ COMPANY TAX UPDATED");

    // RETURN RESPONSE
    res.status(201).json({ sale, invoice });

  } catch (err) {
    console.error("🔥 [SALE CREATE ERROR]:", err);
    res.status(500).json({ message: err.message });
  }
});

// ======================================================
// ALL OTHER ROUTES — UNTOUCHED
// ======================================================

router.get("/all", auth, async (req, res) => {
  if (!req.user.isAdmin && !req.user.isSuperStakeholder && !req.user.isSubAdmin) {
    return res.status(403).json({ message: "Access denied" });
  }

  try {
    const sales = await Sale.find({ companyId: req.user.companyId })
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
// FINALIZE INVOICE (FIRS ENTRY POINT)
// ======================================================
// ======================================================
// FINALIZE INVOICE (FIRS ENTRY POINT)
// ======================================================
router.post("/:invoiceId/finalize", auth, async (req, res) => {
  try {
    const invoice = await Invoice.findOne({
      invoiceId: req.params.invoiceId,
      companyId: req.user.companyId
    });

    if (!invoice) {
      return res.status(404).json({ message: "Invoice not found" });
    }

    if (invoice.firsInvoiceStatus !== "DRAFT") {
      return res.status(400).json({
        message: `Invoice already ${invoice.firsInvoiceStatus}`
      });
    }

    // ✅ MOCK: If FIRS API is not configured
    if (!process.env.FIRS_API_KEY) {
      console.log("FIRS API not configured. Skipping actual submission.");

      // Update invoice locally to FINAL
      invoice.firsInvoiceStatus = "FINAL";
      await invoice.save();

      return res.json({
        success: true,
        message: "Invoice finalized locally (mock).",
        firsInvoiceStatus: invoice.firsInvoiceStatus,
        invoiceId: invoice.invoiceId,
        totalAmount: invoice.totalAmount,
        items: invoice.items,
        subtotal: invoice.subtotal,
        vatRate: invoice.vatRate,
        vatAmount: invoice.vatAmount,
        discount: invoice.discount
      });
    }

    // 1️⃣ Mark FINAL (for real FIRS submission)
    invoice.firsInvoiceStatus = "FINAL";
    await invoice.save();

    // 2️⃣ Queue for FIRS submission (async-safe)
    await queueFirsSubmission(invoice._id);

    res.json({
      message: "Invoice finalized and queued for FIRS submission",
      invoiceId: invoice.invoiceId
    });

  } catch (err) {
    console.error("🔥 [FINALIZE INVOICE ERROR]:", err);
    res.status(500).json({ message: err.message });
  }
});


router.get("/:saleId", auth, async (req, res) => {
  try {
    const sale = await Sale.findOne({
      saleId: req.params.saleId,
      companyId: req.user.companyId
    })
      .populate("createdBy", "name email")
      .populate("items.productId", "name productModel category");

    if (!sale) return res.status(404).json({ message: "Sale not found" });

    res.status(200).json(sale);
  } catch (err) {
    console.error("🔥 [GET SALE ERROR]:", err);
    res.status(500).json({ message: err.message });
  }
});





module.exports = router;