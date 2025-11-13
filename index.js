const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
const register = require("./routes/register");
const login = require("./routes/login");
// const stripe = require("./routes/stripe");
const productsRoute = require("./routes/products");
const users = require("./routes/users");
const orders = require("./routes/orders");
const products = require("./products");
const reportsRoute = require("./routes/reports");
const prerender = require("prerender-node");
require("dotenv").config();
const expensesRoute = require("./routes/expenses");
const attendanceRoutes = require("./routes/attendanceRoutes");
const analyticsRoutes = require("./routes/analyticsRoutes");

const app = express();

// Optional: set your token if you use prerender.io
prerender.set('prerenderToken', process.env.PRERENDER_TOKEN);
app.use(prerender);

// ✅ CORS configuration
const frontendURL = "https://techwireict.vercel.app";

// Allow all origins in development, only frontendURL in production
const corsOptions = {
  origin: process.env.NODE_ENV === "development" ? "*" : frontendURL,
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
  credentials: true
};

app.use(cors(corsOptions));
app.options("*", cors(corsOptions)); // handle preflight

// ✅ Log CORS requests
app.use((req, res, next) => {
  console.log(`CORS check: ${req.method} ${req.url}`);
  next();
});

// Parse JSON requests
app.use(express.json());

// Serve static files
app.use("/uploads", express.static("uploads"));

// API routes
app.use("/api/register", register);
app.use("/api/login", login);
// app.use("/api/stripe", stripe);
app.use("/api/products", productsRoute);
app.use("/api/users", users);
app.use("/api/orders", orders);
app.use("/api/reports", reportsRoute);
app.use("/api/expenses", expensesRoute);
app.use("/api/attendance", attendanceRoutes);
app.use("/api/analytics", analyticsRoutes);

// Base routes
app.get("/", (req, res) => {
  res.send("Welcome to our online shop API...");
});

app.get("/products", (req, res) => {
  res.send(products);
});

// MongoDB connection
mongoose
  .connect(process.env.CONNECTION_STRING, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => console.log("MongoDB connection established..."))
  .catch((error) => console.error("MongoDB connection failed:", error.message));

// Start server
const port = process.env.PORT || 2000;
app.listen(port, () => {
  console.log(`Server running on port ${port}...`);
});

// ✅ Export app for Vercel
module.exports = app;