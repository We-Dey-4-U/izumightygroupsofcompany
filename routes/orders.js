// routes/orders.js
require("dotenv").config();
const router = require("express").Router();
const { auth, isUser, isAdmin } = require("../middleware/auth");
const Order = require("../models/order");
const { Product } = require("../models/product");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const moment = require("moment");
const Joi = require("joi");
const mongoose = require("mongoose");

// ✅ Import sanitize middleware
const sanitizeBody = require("../middleware/sanitize");


// ===============================
// Helpers
// ===============================
const objectIdSchema = Joi.string().custom((value, helpers) => {
  if (!mongoose.Types.ObjectId.isValid(value)) {
    return helpers.error("any.invalid");
  }
  return value;
}, "ObjectId Validation");

// ===============================
// Ensure uploads/receipts folder exists
// ===============================
const receiptDir = path.join(__dirname, "..", "uploads", "receipts");
if (!fs.existsSync(receiptDir)) {
  fs.mkdirSync(receiptDir, { recursive: true });
}

// ===============================
// Multer config
// ===============================
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, receiptDir),
  filename: (req, file, cb) => cb(null, Date.now() + "-" + file.originalname),
});
const upload = multer({ storage });

// =======================================================
// CREATE ORDER (BANK TRANSFER) — COMPANY ISOLATED ✅
// =======================================================
// =======================================================
// CREATE ORDER (BANK TRANSFER) — COMPANY ISOLATED ✅
// =======================================================
router.post(
  "/bank-transfer",
  auth,
  upload.single("receipt"),
  // ✅ Sanitize shipping fields
  sanitizeBody([
    "shipping.address",
    "shipping.city",
    "shipping.state",
    "shipping.zip",
    "shipping.country",
  ]),
  async (req, res) => {
    try {
      // ---------- Validation ----------
      const schema = Joi.object({
        userId: objectIdSchema.required(),
        products: Joi.string().required(), // JSON string (multipart)
        subtotal: Joi.number().min(0).required(),
        total: Joi.number().min(0).required(),
        shipping: Joi.string().required(), // JSON string
        paymentMethod: Joi.string().default("bankTransfer"),
      });

      const { error, value } = schema.validate(req.body);
      if (error)
        return res.status(400).json({ message: error.details[0].message });

      const { userId, products, subtotal, total, shipping, paymentMethod } = value;
      const parsedProducts = JSON.parse(products);

      // 🔒 Fetch actual products from DB
      const productIds = parsedProducts.map((p) => p.productId);
      const dbProducts = await Product.find({ _id: { $in: productIds } });

      if (!dbProducts.length) {
        return res.status(400).json({ message: "Invalid products" });
      }

      // 🔒 Enforce ONE COMPANY per order
      const companyId = dbProducts[0].companyId.toString();
      const hasMixedCompany = dbProducts.some(
        (p) => p.companyId.toString() !== companyId
      );
      if (hasMixedCompany) {
        return res.status(400).json({
          message: "Products from multiple companies are not allowed in one order",
        });
      }

      // ✅ Create order
      const order = new Order({
        userId,
        company: companyId,
        products: parsedProducts,
        subtotal: Number(subtotal),
        total: Number(total),
        shipping: JSON.parse(shipping),
        paymentMethod,
        payment_status: "awaiting_payment",
        receipt: req.file ? req.file.path : "",
      });

      const savedOrder = await order.save();

      // 🔄 Optional: Reduce product stock
      for (const item of parsedProducts) {
        await Product.findByIdAndUpdate(item.productId, {
          $inc: { stock: -item.quantity },
        });
      }

      // ✅ Populate order for frontend
      const populatedOrder = await Order.findById(savedOrder._id)
        .populate({
          path: "products.productId",
          populate: {
            path: "createdBy",
            select: "companyId",
            populate: { path: "companyId", select: "name" },
          },
        })
        .populate("company", "name")
        .populate("userId", "email name");

      res.status(201).json(populatedOrder);
    } catch (err) {
      console.error("❌ Bank transfer order error:", err);
      res.status(500).json({ message: err.message });
    }
  }
);
// =======================================================
// CREATE ORDER (OTHER PAYMENT FLOWS) — SAFE DEFAULT
// =======================================================
router.post("/", auth, async (req, res) => {
  try {
    const schema = Joi.object({
      userId: objectIdSchema.required(),
      products: Joi.array().min(1).required(),
      subtotal: Joi.number().min(0).required(),
      total: Joi.number().min(0).required(),
      shipping: Joi.object().required(),
      paymentMethod: Joi.string().required(),
    });

    const { error } = schema.validate(req.body, { stripUnknown: false });
    if (error) return res.status(400).json({ message: error.details[0].message });

    const newOrder = new Order(req.body);
    const savedOrder = await newOrder.save();
    res.status(200).json(savedOrder);

  } catch (err) {
    res.status(500).json(err);
  }
});

// =======================================================
// UPDATE ORDER — COMPANY ADMIN ONLY
// =======================================================
router.put("/:id", isAdmin, async (req, res) => {
  const idCheck = objectIdSchema.validate(req.params.id);
  if (idCheck.error) return res.status(400).json({ message: "Invalid order ID" });

  try {
    const order = await Order.findOne({
      _id: req.params.id,
      company: req.user.companyId,
    });

    if (!order) {
      return res.status(403).json({ message: "Not authorized" });
    }

    const schema = Joi.object({
      delivery_status: Joi.string(),
      payment_status: Joi.string(),
      trackingNumber: Joi.string(),
    });

    const { error, value } = schema.validate(req.body, { stripUnknown: false });
    if (error) return res.status(400).json({ message: error.details[0].message });

    Object.assign(order, value);
    const updatedOrder = await order.save();

    res.status(200).json(updatedOrder);
  } catch (err) {
    res.status(500).json(err);
  }
});

// =======================================================
// MARK PAYMENT AS PAID
// =======================================================
router.put("/:id/payment", isAdmin, async (req, res) => {
  const idCheck = objectIdSchema.validate(req.params.id);
  if (idCheck.error) return res.status(400).json({ message: "Invalid order ID" });

  try {
    const order = await Order.findOne({
      _id: req.params.id,
      company: req.user.companyId,
    });

    if (!order) return res.status(403).json({ message: "Not authorized" });
    if (order.payment_status === "paid")
      return res.status(400).json({ message: "Already paid" });

    order.payment_status = "paid";
    res.status(200).json(await order.save());

  } catch (err) {
    res.status(500).json(err);
  }
});

// =======================================================
// MARK DELIVERY AS DELIVERED
// =======================================================
router.put("/:id/delivery", isAdmin, async (req, res) => {
  const idCheck = objectIdSchema.validate(req.params.id);
  if (idCheck.error) return res.status(400).json({ message: "Invalid order ID" });

  try {
    const order = await Order.findOne({
      _id: req.params.id,
      company: req.user.companyId,
    });

    if (!order) return res.status(403).json({ message: "Not authorized" });
    if (order.delivery_status === "delivered")
      return res.status(400).json({ message: "Already delivered" });

    order.delivery_status = "delivered";
    res.status(200).json(await order.save());

  } catch (err) {
    res.status(500).json(err);
  }
});

// =======================================================
// DELETE ORDER — ONLY OWN & DELIVERED
// =======================================================
router.delete("/:id", isAdmin, async (req, res) => {
  const idCheck = objectIdSchema.validate(req.params.id);
  if (idCheck.error) return res.status(400).json({ message: "Invalid order ID" });

  try {
    const order = await Order.findOne({
      _id: req.params.id,
      company: req.user.companyId,
    });

    if (!order) return res.status(403).json({ message: "Not authorized" });
    if (order.delivery_status !== "delivered")
      return res.status(400).json({ message: "Only delivered orders can be deleted" });

    await Order.findByIdAndDelete(order._id);
    res.status(200).json({ message: "Order deleted" });

  } catch (err) {
    res.status(500).json(err);
  }
});

// =======================================================
// GET USER ORDERS
// =======================================================
router.get("/find/:userId", isUser, async (req, res) => {
  const idCheck = objectIdSchema.validate(req.params.userId);
  if (idCheck.error) return res.status(400).json({ message: "Invalid user ID" });

  try {
    const orders = await Order.find({ userId: req.params.userId });
    res.status(200).json(orders);
  } catch (err) {
    res.status(500).json(err);
  }
});

// ======================================================
// GET COMPANY ORDERS
// =======================================================
router.get("/", isAdmin, async (req, res) => {
  try {
    const orders = await Order.find({
      company: req.user.companyId,
    }).sort({ _id: -1 });

    res.status(200).json(orders);
  } catch (err) {
    res.status(500).json(err);
  }
});

// =======================================================
// COMPANY MONTHLY INCOME
// =======================================================
router.get("/income/stats", isAdmin, async (req, res) => {
  const previousMonth = moment()
    .month(moment().month() - 1)
    .set("date", 1)
    .toDate();

  try {
    const income = await Order.aggregate([
      {
        $match: {
          company: req.user.companyId,
          createdAt: { $gte: previousMonth },
        },
      },
      {
        $project: {
          month: { $month: "$createdAt" },
          sales: "$total",
        },
      },
      {
        $group: {
          _id: "$month",
          total: { $sum: "$sales" },
        },
      },
    ]);

    res.status(200).json(income);
  } catch (err) {
    res.status(500).json(err);
  }
});

// =======================================================
// COMPANY WEEKLY SALES
// =======================================================
router.get("/week-sales", isAdmin, async (req, res) => {
  const last7Days = moment().subtract(7, "days").toDate();

  try {
    const income = await Order.aggregate([
      {
        $match: {
          company: req.user.companyId,
          createdAt: { $gte: last7Days },
        },
      },
      {
        $project: {
          day: { $dayOfWeek: "$createdAt" },
          sales: "$total",
        },
      },
      {
        $group: {
          _id: "$day",
          total: { $sum: "$sales" },
        },
      },
    ]);

    res.status(200).json(income);
  } catch (err) {
    res.status(500).json(err);
  }
});

module.exports = router;