const express = require("express");
const router = express.Router();
const Invoice = require("../models/Invoice");
const { auth } = require("../middleware/auth");

// Generate Invoice ID
const generateInvoiceId = () => `INV-${Math.floor(100000 + Math.random() * 900000)}`;

// CREATE INVOICE
router.post("/create", auth, async (req, res) => {
  try {
    const { items, discount = 0, customerName, customerPhone } = req.body;

    if (!items || items.length === 0) return res.status(400).json({ message: "No items selected" });

    let subtotal = 0;

    for (const item of items) {
      item.total = item.price * item.quantity;
      subtotal += item.total;
    }

    const vatRate = 7.5;
    const vatAmount = +(subtotal * vatRate / 100).toFixed(2);
    const totalAmount = subtotal + vatAmount - Number(discount);

    const invoice = await Invoice.create({
      invoiceId: generateInvoiceId(),
      companyId: req.user.companyId,
      items,
      subtotal,
      vatRate,
      vatAmount,
      discount,
      totalAmount,
      customerName,
      customerPhone,
      createdBy: req.user._id
    });

    res.status(201).json(invoice);
  } catch (err) {
    console.error("CREATE INVOICE ERROR:", err);
    res.status(500).json({ message: err.message });
  }
});

// GET ALL INVOICES
router.get("/all", auth, async (req, res) => {
  try {
    const invoices = await Invoice.find({ companyId: req.user.companyId }).sort({ createdAt: -1 });
    res.status(200).json(invoices);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET SINGLE INVOICE
router.get("/:invoiceId", auth, async (req, res) => {
  try {
    const invoice = await Invoice.findOne({
      invoiceId: req.params.invoiceId,
      companyId: req.user.companyId
    });
    if (!invoice) return res.status(404).json({ message: "Invoice not found" });
    res.status(200).json(invoice);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;