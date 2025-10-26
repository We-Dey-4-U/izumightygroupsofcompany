// routes/orders.js
const router = require("express").Router();
const { auth, isUser, isAdmin } = require("../middleware/auth");
const Order = require("../models/order");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const moment = require("moment");

// Ensure uploads/receipts folder existttttttttttttttt
const receiptDir = path.join(__dirname, "..", "uploads", "receipts");
if (!fs.existsSync(receiptDir)) {
  fs.mkdirSync(receiptDir, { recursive: true });
}

// Multer config
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, receiptDir),
  filename: (req, file, cb) => cb(null, Date.now() + "-" + file.originalname),
});
const upload = multer({ storage });

// CREATE ORDER (manual payment)
// CREATE ORDER (bank transfer)
router.post("/bank-transfer", auth, upload.single("receipt"), async (req, res) => {
  try {
    const { userId, products, subtotal, total, shipping, paymentMethod } = req.body;

    if (!userId || !products || !subtotal || !total || !shipping) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    const order = new Order({
      userId,
      products: JSON.parse(products),
      subtotal: Number(subtotal),
      total: Number(total),
      shipping: JSON.parse(shipping),
      paymentMethod: paymentMethod || "bankTransfer",
      payment_status: "awaiting_payment",
      receipt: req.file ? req.file.path : "",
    });

    const savedOrder = await order.save();
    res.status(201).json(savedOrder);
  } catch (err) {
    console.error("Error creating bank transfer order:", err);
    res.status(500).json({ message: "Error creating bank transfer order", error: err.message });
  }
});


// CREATE (other payment flows
router.post("/", auth, async (req, res) => {
  try {
    const newOrder = new Order(req.body);
    const savedOrder = await newOrder.save();
    res.status(200).send(savedOrder);
  } catch (err) {
    res.status(500).send(err);
  }
});

// UPDATE generic (keeps existing)
router.put("/:id", isAdmin, async (req, res) => {
  try {
    const updatedOrder = await Order.findByIdAndUpdate(req.params.id, { $set: req.body }, { new: true });
    res.status(200).send(updatedOrder);
  } catch (err) {
    res.status(500).send(err);
  }
});

// MARK PAYMENT AS PAID
router.put("/:id/payment", isAdmin, async (req, res) => {
  try {
    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ message: "Order not found" });

    if (order.payment_status === "paid") {
      return res.status(400).json({ message: "Order already marked as paid" });
    }

    order.payment_status = "paid";
    const updated = await order.save();
    res.status(200).json(updated);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Error updating payment status", error: err.message });
  }
});

// MARK DELIVERY AS DELIVERED
router.put("/:id/delivery", isAdmin, async (req, res) => {
  try {
    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ message: "Order not found" });

    if (order.delivery_status === "delivered") {
      return res.status(400).json({ message: "Order already marked as delivered" });
    }

    order.delivery_status = "delivered";
    const updated = await order.save();
    res.status(200).json(updated);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Error updating delivery status", error: err.message });
  }
});

// DELETE order — only allow if delivered (safer)
router.delete("/:id", isAdmin, async (req, res) => {
  try {
    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ message: "Order not found" });

    if (order.delivery_status !== "delivered") {
      return res.status(400).json({ message: "Only delivered orders can be deleted" });
    }

    await Order.findByIdAndDelete(req.params.id);
    res.status(200).send({ message: "Order has been deleted" });
  } catch (err) {
    res.status(500).send(err);
  }
});

// GET USER ORDERS
router.get("/find/:userId", isUser, async (req, res) => {
  try {
    const orders = await Order.find({ userId: req.params.userId });
    res.status(200).send(orders);
  } catch (err) {
    res.status(500).send(err);
  }
});

// GET ALL ORDERS
router.get("/", isAdmin, async (req, res) => {
  const query = req.query.new;
  try {
    const orders = query
      ? await Order.find().sort({ _id: -1 }).limit(4)
      : await Order.find().sort({ _id: -1 });
    res.status(200).send(orders);
  } catch (err) {
    console.log(err);
    res.status(500).send(err);
  }
});

// GET MONTHLY INCOME
router.get("/income/stats", isAdmin, async (req, res) => {
  const previousMonth = moment().month(moment().month() - 1).set("date", 1).format("YYYY-MM-DD HH:mm:ss");
  try {
    const income = await Order.aggregate([
      { $match: { createdAt: { $gte: new Date(previousMonth) } } },
      { $project: { month: { $month: "$createdAt" }, sales: "$total" } },
      { $group: { _id: "$month", total: { $sum: "$sales" } } },
    ]);
    res.status(200).send(income);
  } catch (err) {
    console.log(err);
    res.status(500).send(err);
  }
});

// GET WEEKLY SALES
router.get("/week-sales", isAdmin, async (req, res) => {
  const last7Days = moment().day(moment().day() - 7).format("YYYY-MM-DD HH:mm:ss");
  try {
    const income = await Order.aggregate([
      { $match: { createdAt: { $gte: new Date(last7Days) } } },
      { $project: { day: { $dayOfWeek: "$createdAt" }, sales: "$total" } },
      { $group: { _id: "$day", total: { $sum: "$sales" } } },
    ]);
    res.status(200).send(income);
  } catch (err) {
    console.log(err);
    res.status(500).send(err);
  }
});

module.exports = router;