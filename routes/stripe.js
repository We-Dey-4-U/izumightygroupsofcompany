const express = require("express");
const Stripe = require("stripe");
const Order = require("../models/Order");

require("dotenv").config();

const stripe = Stripe(process.env.STRIPE_KEY);
const router = express.Router();

// ✅ Create Checkout Session
router.post("/create-checkout-session", async (req, res) => {
  try {
    // Save the cart in DB instead of huge metadata
    const { userId, cartItems } = req.body;

    // Just store lightweight info in Stripe metadata
    const customer = await stripe.customers.create({
      metadata: {
        userId: userId,
        cartCount: cartItems.length.toString(), // ✅ small and safe
      },
    });

    const line_items = cartItems.map((item) => ({
      price_data: {
        currency: "usd",
        product_data: {
          name: item.name,
          images: [item.image],
          description: item.desc,
          metadata: {
            id: item.id,
          },
        },
        unit_amount: Math.round(item.price * 100),
      },
      quantity: item.cartQuantity,
    }));

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      shipping_address_collection: {
        allowed_countries: ["US", "CA", "KE"],
      },
      shipping_options: [
        {
          shipping_rate_data: {
            type: "fixed_amount",
            fixed_amount: { amount: 0, currency: "usd" },
            display_name: "Free shipping",
            delivery_estimate: {
              minimum: { unit: "business_day", value: 5 },
              maximum: { unit: "business_day", value: 7 },
            },
          },
        },
        {
          shipping_rate_data: {
            type: "fixed_amount",
            fixed_amount: { amount: 1500, currency: "usd" },
            display_name: "Next day air",
            delivery_estimate: {
              minimum: { unit: "business_day", value: 1 },
              maximum: { unit: "business_day", value: 1 },
            },
          },
        },
      ],
      phone_number_collection: { enabled: true },
      line_items,
      mode: "payment",
      customer: customer.id,
      success_url: `${process.env.CLIENT_URL}/checkout-success`,
      cancel_url: `${process.env.CLIENT_URL}/cart`,
    });

    res.status(200).send({ url: session.url });
  } catch (err) {
    console.error("❌ Stripe Checkout Error:", err.message);
    res.status(400).send({ error: err.message });
  }
});

// ✅ Create order after successful payment
const createOrder = async (customer, data) => {
  try {
    // Retrieve cart from your DB if needed
    // For now we’ll just simulate small product info
    const newOrder = new Order({
      userId: customer.metadata.userId,
      customerId: data.customer,
      paymentIntentId: data.payment_intent,
      products: [], // TODO: you can fetch real products by userId here
      subtotal: data.amount_subtotal,
      total: data.amount_total,
      shipping: data.customer_details,
      payment_status: data.payment_status,
    });

    const savedOrder = await newOrder.save();
    console.log("✅ Processed Order:", savedOrder._id);
  } catch (err) {
    console.error("❌ Order creation failed:", err.message);
  }
};

// ✅ Stripe Webhook (no metadata overflow)
router.post(
  "/webhook",
  express.json({ type: "application/json" }),
  async (req, res) => {
    let data;
    let eventType;

    const webhookSecret = process.env.STRIPE_WEB_HOOK;

    if (webhookSecret) {
      let signature = req.headers["stripe-signature"];
      try {
        const event = stripe.webhooks.constructEvent(
          req.body,
          signature,
          webhookSecret
        );
        data = event.data.object;
        eventType = event.type;
      } catch (err) {
        console.error("⚠️ Webhook signature verification failed:", err.message);
        return res.sendStatus(400);
      }
    } else {
      data = req.body.data.object;
      eventType = req.body.type;
    }

    if (eventType === "checkout.session.completed") {
      try {
        const customer = await stripe.customers.retrieve(data.customer);
        createOrder(customer, data);
      } catch (err) {
        console.error("❌ Webhook processing error:", err.message);
      }
    }

    res.status(200).end();
  }
);

module.exports = router;