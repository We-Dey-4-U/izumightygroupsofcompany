const { Order } = require("../models/Order");
const { auth, isUser, isAdmin } = require("../middleware/auth");
const moment = require("moment")

const router = require("express").Router();

//CREATE

// createOrder is fired by stripe webhook
// example endpoint

router.post("/", auth, async (req, res) => {
  const newOrder = new Order(req.body);

  try {
    const savedOrder = await newOrder.save();
    res.status(200).send(savedOrder);
  } catch (err) {
    res.status(500).send(err);
  }
});

//UPDATE
router.put("/:id", isAdmin, async (req, res) => {
  try {
    const updatedOrder = await Order.findByIdAndUpdate(
      req.params.id,
      {
        $set: req.body,
      },
      { new: true }
    );
    res.status(200).send(updatedOrder);
  } catch (err) {
    res.status(500).send(err);
  }
});

//DELETE
router.delete("/:id", isAdmin, async (req, res) => {
  try {
    await Order.findByIdAndDelete(req.params.id);
    res.status(200).send("Order has been deleted...");
  } catch (err) {
    res.status(500).send(err);
  }
});

//GET USER ORDERS
router.get("/find/:userId", isUser, async (req, res) => {
  try {
    const orders = await Order.find({ userId: req.params.userId });
    res.status(200).send(orders);
  } catch (err) {
    res.status(500).send(err);
  }
});

//GET ALL ORDERS

router.get("/", isAdmin, async (req, res) => {
  const query = req.query.new;
  try {
    const orders = query
    ?await Order.find().sort({_id: -1}).limit(4)
    :await Order.find().sort({_id: -1});
    
    res.status(200).send(orders);
  } catch (err) {
    console.log(err);
    res.status(500).send(err); //sending eror to the client
  }
});

//NEXT IS TO FETCH THE DATA OF THE ABOVE ORDERS AND DISPLAY THEM OF THE UI

// GET MONTHLY INCOME

router.get("/income/stats", isAdmin, async (req, res) => {
  const previousMonth = moment()
  .month(moment().month() - 1)
  .set("date", 1)
  .format("YYYY-MM-DD HH:mm:ss");

  try {
    const income = await Order.aggregate([
      { 
        $match: { createdAt: { $gte: new Date(previousMonth) } }, 
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
    res.status(200).send(income);
  } catch (err) {
    console.log(err);
    res.status(500).send(err);
  }
});


// GET i week sales

router.get("/week-sales", isAdmin, async (req, res) => {
  const last7Days = moment()
  .day(moment().day() - 7)
  .format("YYYY-MM-DD HH:mm:ss");

  try {
    const income = await Order.aggregate([
      { 
        $match: { createdAt: { $gte: new Date(last7Days) } }, 
    },
      {
        $project: {
          day: { $dayOfWeek: "$createdAt" },
          sales: "$total",
        },
      },
      {
        $group: {
          _id: "$day",                      //represent each day of the week
          total: { $sum: "$sales" },
        },
      },
    ]);
    res.status(200).send(income);
  } catch (err) {
    console.log(err);
    res.status(500).send(err);
  }
});


module.exports = router;