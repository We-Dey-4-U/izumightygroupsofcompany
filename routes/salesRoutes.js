const express = require("express");
const router = express.Router();
const { auth, permit, isAdmin, isSuperStakeholder, isSubAdmin } = require("../middleware/auth");
const { updateCompanyTaxFromSales } = require("../utils/companyTaxUpdater");
const Sale = require("../models/Sale");
const InventoryProduct = require("../models/InventoryProduct");
const StockMovement = require("../models/StockMovement");
const Invoice = require("../models/Invoice");
const postSaleLedger = require("../utils/postSaleLedger");
const Store = require("../models/Store");
const StoreInventory = require("../models/StoreInventory");

// Generate Sale ID
const generateSaleId = () => `SALE-${Math.floor(100000 + Math.random() * 900000)}`;
// Generate Invoice ID
const generateInvoiceId = () => `INV-${Math.floor(100000 + Math.random() * 900000)}`;

// ======================================================
// CREATE A NEW SALE (with automatic invoice creation)
// ======================================================
router.post("/create", auth, permit("create_sale"), async (req, res) => {
  const session = await require("mongoose").startSession();
  session.startTransaction();
  try {
    console.log(
      "🔵 [SALE CREATE]",
      "User:", req.user._id,
      "CompanyId:", req.user.companyId
    );

    // Explicit safeguard: check if the user has 'create_sale' permission
    if (!req.user.permissions.includes("create_sale")) {
      return res.status(403).json({
        message: "You do not have permission to create sales"
      });
    }

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

    // ✅ VALIDATE STORE ONCE (FIXED)
    const store = await Store.findOne({
      _id: req.body.storeId,
      companyId: req.user.companyId
    });

    if (!store)
      return res.status(404).json({ message: "Store not found" });

    if (store.type !== "OFFICE")
      return res.status(400).json({
        message: "Sales allowed only from office store"
      });

    // ======================================================
    // PROCESS ITEMS
    // ======================================================
    for (const item of items) {

      if (item.type === "product") {

        const product = await InventoryProduct.findById(item.productId);

        if (!product)
          return res.status(404).json({
            message: `Product not found: ${item.productId}`
          });

        if (!product.companyId.equals(req.user.companyId))
          return res.status(403).json({
            message: "Product does not belong to your company"
          });

       // if (product.quantityInStock < item.quantity)
         // return res.status(400).json({
          //  message: `Insufficient stock for ${product.name}. Available: ${product.quantityInStock}`
         // });

        item.productName = product.name; // ⭐ IMPORTANT
        item.price = product.sellingPrice;
       item.total = item.price * item.quantity;
       subtotal += item.total;

        // CHECK STORE STOCK
        const stock = await StoreInventory.findOne({
          store: req.body.storeId,
          product: item.productId
        });

        if (!stock || stock.quantity < item.quantity)
          return res.status(400).json({
            message: `Not enough stock in selected store`
          });

       //stock.quantity -= item.quantity;
        //await stock.save();


        const previousQty = stock.quantity;
stock.quantity -= item.quantity;
await stock.save();

await StockMovement.create({
  companyId: req.user.companyId,
  product: item.productId,
  type: "STOCK_OUT",
  quantity: item.quantity,
  previousQuantity: previousQty,
  newQuantity: stock.quantity,
  description: "Product sold",
  performedBy: req.user._id,
  store: store._id
});

        // track analytics
        product.itemsSold += item.quantity;
        await product.save();

      } else if (item.type === "service") {

        if (!item.serviceName || item.serviceName.trim() === "")
          return res.status(400).json({
            message: "Service name is required"
          });

        if (!item.price || item.price <= 0)
          return res.status(400).json({
            message: "Service price must be greater than 0"
          });

        item.total = item.price * item.quantity;
        subtotal += item.total;
        item.productId = null;

      } else {
        return res.status(400).json({
          message: `Invalid item type: ${item.type}`
        });
      }
    }

    // ======================================================
    // VAT CALCULATION
    // ======================================================

    const VAT_RATE = Number(vatRate ?? 7.5);

    if (VAT_RATE < 0 || VAT_RATE > 100) {
      return res.status(400).json({ message: "Invalid VAT rate" });
    }

    const vatAmount = Number(((subtotal * VAT_RATE) / 100).toFixed(2));
    const totalAmount = subtotal + vatAmount - Number(discount);

    // ======================================================
    // COMMISSION CALCULATION
    // ======================================================

    let commissionAmount = 0;
    if (salesperson && commissionRate > 0) {
      commissionAmount = Number(((totalAmount * commissionRate) / 100).toFixed(2));
    }

    // ======================================================
    // CREATE SALE
    // ======================================================

    const sale = await Sale.create({
  saleId: generateSaleId(),
  companyId: req.user.companyId,
  //store: storeId,
  store: store._id, // ✅ important
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
 createdBy: req.user._id,
createdByName: req.user.name
});
    console.log(`🟢 SALE CREATED: ${sale.saleId}`);

    // POST TO LEDGER
    await postSaleLedger(sale);
    console.log("📘 LEDGER UPDATED FOR SALE");

    // ======================================================
    // CREATE INVOICE
    // ======================================================

    const invoice = await Invoice.create({
      invoiceId: generateInvoiceId(),
      companyId: req.user.companyId,
      items,
      subtotal,
      vatRate: VAT_RATE,
      vatAmount,
      discount,
      totalAmount,
      customerName,
      customerPhone,
      createdBy: req.user._id
    });

    console.log(`🟢 INVOICE CREATED: ${invoice.invoiceId} for Sale ${sale.saleId}`);

    // ======================================================
    // UPDATE COMPANY TAX
    // ======================================================

    const saleDate = new Date(sale.createdAt);

    await updateCompanyTaxFromSales(
      sale.companyId,
      saleDate.getMonth() + 1,
      saleDate.getFullYear(),
      req.user._id
    );

    console.log("✅ COMPANY TAX UPDATED");

    // ======================================================
    // RESPONSE
    // ======================================================

   await session.commitTransaction();
session.endSession();

const populatedSale = await Sale.findById(sale._id)
  .populate("createdBy", "name email")
  .populate("store", "name type")
  .populate("items.productId", "name");

res.status(201).json({
  sale: populatedSale,
  invoice
});

  } catch (err) {
  await session.abortTransaction();
  session.endSession();
    console.error("🔥 [SALE CREATE ERROR]:", err);
    res.status(500).json({ message: err.message });
  }
});




// ======================================================
// GET ALL SALES
// ======================================================
router.get("/all", auth, permit("view_sales"), async (req,res)=>{
  if (!req.user.isAdmin && !req.user.isSuperStakeholder && !req.user.isSubAdmin) {
    return res.status(403).json({ message: "Access denied" });
  }

  try {
    const sales = await Sale.find({ companyId: req.user.companyId })
  .populate("createdBy", "name email")
  .populate("store", "name type")
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



// GET sales for a freelancer
// GET freelancer sales
// GET sales for a freelancer or staff
router.get("/freelancer/sales", auth, async (req, res) => {
  try {
    if (!req.user.isFreelancer && !req.user.isStaff) {
      return res.status(403).json({ message: "Access denied" });
    }

    const sales = await Sale.find({
      salesperson: req.user._id,
      companyId: req.user.companyId, // company isolation
    })
      .populate("items.productId", "name productModel category")
      .populate("createdBy", "name email")
      .sort({ createdAt: -1 });

    const totalCommission = sales.reduce((acc, sale) => acc + sale.commissionAmount, 0);

    res.status(200).json({ sales, totalCommission });
  } catch (err) {
    console.error("🔥 [FREELANCER/STAFF SALES ERROR]:", err);
    res.status(500).json({ message: err.message });
  }
});



// GET all freelancers sales with commission
// GET all freelancers/staff sales with commission
router.get("/freelancer/all", auth, async (req, res) => {
  if (!req.user.isAdmin && !req.user.isSuperStakeholder && !req.user.isSubAdmin) {
    return res.status(403).json({ message: "Access denied" });
  }

  try {
    // Get all freelancers + staff in the company
    const teamMembers = await User.find({
      companyId: req.user.companyId,
      $or: [{ isFreelancer: true }, { isStaff: true }],
    }).select("_id name email isFreelancer isStaff");

    const data = [];

    for (const member of teamMembers) {
      const sales = await Sale.find({
        salesperson: member._id,
        companyId: req.user.companyId,
      })
        .populate("items.productId", "name productModel category")
        .populate("createdBy", "name email")
        .sort({ createdAt: -1 });

      const totalCommission = sales.reduce((acc, sale) => acc + sale.commissionAmount, 0);

      data.push({ member, sales, totalCommission });
    }

    res.status(200).json(data);
  } catch (err) {
    console.error("🔥 [ADMIN TEAM SALES ERROR]:", err);
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;