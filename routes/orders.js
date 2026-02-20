require("dotenv").config();
const router = require("express").Router();
const { auth, isUser, isAdmin } = require("../middleware/auth");
const Order = require("../models/order");
const { Product } = require("../models/product");
const multer = require("multer");
const moment = require("moment");
const Joi = require("joi");
const mongoose = require("mongoose");
const axios = require("axios");
const FormData = require("form-data");
const { v4: uuidv4 } = require("uuid");

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
// Multer config — memory storage for Appwrite uploads
// ===============================
const upload = multer({ storage: multer.memoryStorage() });

// ===============================
// Appwrite receipt upload
// ===============================
async function uploadReceiptToAppwrite(file) {
  if (!file || !file.buffer) {
    throw new Error("No file buffer found for receipt");
  }

  const fileId = uuidv4();
  const formData = new FormData();
  formData.append("fileId", fileId);
  formData.append("file", file.buffer, {
    filename: file.originalname,
    contentType: file.mimetype,
    knownLength: file.size,
  });

  const resp = await axios.post(
    `${process.env.APPWRITE_ENDPOINT}/storage/buckets/${process.env.APPWRITE_BUCKET_ID}/files`,
    formData,
    {
      headers: {
        "X-Appwrite-Project": process.env.APPWRITE_PROJECT_ID,
        "X-Appwrite-Key": process.env.APPWRITE_API_KEY,
        ...formData.getHeaders(),
      },
      maxBodyLength: Infinity,
    }
  );

  const url = `${process.env.APPWRITE_ENDPOINT}/storage/buckets/${process.env.APPWRITE_BUCKET_ID}/files/${resp.data.$id}/view?project=${process.env.APPWRITE_PROJECT_ID}`;
  return { id: resp.data.$id, url };
}

// =======================================================
// CREATE ORDER (BANK TRANSFER) — COMPANY ISOLATED
// =======================================================
router.post(
  "/bank-transfer",
  auth,
  upload.single("receipt"),
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
        products: Joi.string().required(), // JSON string
        subtotal: Joi.number().min(0).required(),
        total: Joi.number().min(0).required(),
        shipping: Joi.string().required(), // JSON string
        paymentMethod: Joi.string().default("bankTransfer"),
      });

      const { error, value } = schema.validate(req.body);
      if (error) return res.status(400).json({ message: error.details[0].message });

      const { userId, products, subtotal, total, shipping, paymentMethod } = value;
      const parsedProducts = JSON.parse(products);

      const productIds = parsedProducts.map((p) => p.productId);
      const dbProducts = await Product.find({ _id: { $in: productIds } });

      if (!dbProducts.length) return res.status(400).json({ message: "Invalid products" });

      const companyId = dbProducts[0].companyId.toString();
      if (dbProducts.some((p) => p.companyId.toString() !== companyId)) {
        return res.status(400).json({ message: "Products from multiple companies not allowed" });
      }

      // ---------- Upload Receipt to Appwrite ----------
      let receipt = null;
      if (req.file) {
        try {
          receipt = await uploadReceiptToAppwrite(req.file);
        } catch (uploadErr) {
          console.error("❌ Receipt upload failed:", uploadErr);
          return res.status(500).json({ message: "Failed to upload receipt" });
        }
      }

      // ---------- Create Order ----------
      const order = new Order({
        userId,
        company: companyId,
        products: parsedProducts,
        subtotal: Number(subtotal),
        total: Number(total),
        shipping: JSON.parse(shipping),
        paymentMethod,
        payment_status: "awaiting_payment",
        receipt, // { id, url }
      });

      const savedOrder = await order.save();

      // Optional: reduce stock
      for (const item of parsedProducts) {
        await Product.findByIdAndUpdate(item.productId, { $inc: { stock: -item.quantity } });
      }

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
// CREATE ORDER (OTHER PAYMENT FLOWS)
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

    if (!order) return res.status(403).json({ message: "Not authorized" });

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
// DELETE ORDER — ONLY DELIVERED
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

// =======================================================
// GET COMPANY ORDERS
// =======================================================
router.get("/", auth, async (req, res) => {
  try {
    let filter = {};

    if (req.user.isSuperAdmin) filter = {};
    else if (req.user.isAdmin || req.user.isSuperStakeholder) filter = { company: req.user.companyId };
    else filter = { userId: req.user._id };

    const orders = await Order.find(filter).sort({ _id: -1 });
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
      { $match: { company: req.user.companyId, createdAt: { $gte: previousMonth } } },
      { $project: { month: { $month: "$createdAt" }, sales: "$total" } },
      { $group: { _id: "$month", total: { $sum: "$sales" } } },
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
      { $match: { company: req.user.companyId, createdAt: { $gte: last7Days } } },
      { $project: { day: { $dayOfWeek: "$createdAt" }, sales: "$total" } },
      { $group: { _id: "$day", total: { $sum: "$sales" } } },
    ]);

    res.status(200).json(income);
  } catch (err) {
    res.status(500).json(err);
  }
});

module.exports = router;
