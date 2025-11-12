const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
const register = require("./routes/register");
const login = require("./routes/login");
//const stripe = require("./routes/stripe");
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
// (you’ll get it when you sign up for a free account)
prerender.set('prerenderToken', process.env.PRERENDER_TOKEN);

app.use(prerender);

app.use(express.json());
app.use(cors());
app.use("/uploads", express.static("uploads"));

// API routes
app.use("/api/register", register);
app.use("/api/login", login);
//app.use("/api/stripe", stripe);
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

// Local server for development
const port = process.env.PORT || 2000;
app.listen(port, () => {
  console.log(`Server running on port ${port}...`);
});

// ✅ Export app for Vercel
module.exports = app;