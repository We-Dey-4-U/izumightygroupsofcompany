require("dotenv").config();
const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
const prerender = require("prerender-node");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");

const forgotPasswordRoutes = require("./routes/forgotPassword");
const googleAuthRoutes = require("./routes/googleAuth");
// Routes
const financeRoutes = require("./routes/finance");
const invoiceRoutes = require("./routes/invoice");
const register = require("./routes/register");
const login = require("./routes/login");
const safeFetchRoutes = require("./routes/safeFetch");
const sosRoutes = require("./routes/sosRoutes");
const productsRoute = require("./routes/products");
//const users = require("./routes/users");
const orders = require("./routes/orders");
const products = require("./products");
const reportsRoute = require("./routes/reports");
const expensesRoute = require("./routes/expenses");
const attendanceRoutes = require("./routes/attendanceRoutes");
const analyticsRoutes = require("./routes/analyticsRoutes");
const employeeInfoRoutes = require("./routes/employeeInfoRoutes");
const payrollRoutes = require("./routes/payroll");
const inventoryRoutes = require("./routes/inventory");
const salesRoutes = require("./routes/salesRoutes");
const bulkEmailRoutes = require("./routes/bulkEmail");
const taxRoutes = require("./routes/tax");
const taxSettings = require("./routes/taxSettings");
const companyRoutes = require("./routes/company");
const companyTaxRoutes = require("./routes/companyTax");
const payeRemittanceRoutes = require("./routes/payeRemittance");
const firsExportRoutes = require("./routes/firsExport");
const taxLedgerRoutes = require("./routes/taxLedger");
const userRoutes = require("./routes/users");

// Security middleware
const { apiKeyMiddleware, createRateLimiter } = require("./middleware/security");
const { auth } = require("./middleware/auth");

const app = express();

/* =====================================================
   MONGODB CONNECTION (MUST COME FIRST)
===================================================== */
mongoose.set("strictQuery", true);

mongoose
  .connect(process.env.CONNECTION_STRING, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    maxPoolSize: 10,
    serverSelectionTimeoutMS: 5000,
    socketTimeoutMS: 45000,
  })
  .then(() => {
    console.log("✅ MongoDB connected");
  })
  .catch((error) => {
    console.error("❌ MongoDB connection failed:", error.message);
    process.exit(1);
  });

/* ------------------------------
   DISABLE EXPRESS FINGERPRINTING
------------------------------ */
app.disable("x-powered-by");

/* ------------------------------
   SECURITY HEADERS
------------------------------ */
app.use(
  helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
  })
);

/* ------------------------------
   FORCE HTTPS IN PRODUCTION
------------------------------ */
if (process.env.NODE_ENV === "production") {
  app.use((req, res, next) => {
    if (req.header("x-forwarded-proto") !== "https") {
      return res.redirect(`https://${req.headers.host}${req.url}`);
    }
    next();
  });
}

/* ------------------------------
   CORS (ENV-BASED, SAFE)
------------------------------ */
app.use(
  cors({
    origin: process.env.ALLOWED_ORIGINS?.split(",") || "*",
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE"],
    allowedHeaders: ["Content-Type", "Authorization", "x-auth-token"],
  })
);

/* ------------------------------
   BOT / SCRAPER BLOCKING
------------------------------ */
app.use((req, res, next) => {
  const ua = (req.headers["user-agent"] || "").toLowerCase();
  const bots = ["curl", "wget", "python-requests", "scrapy"];
  if (bots.some((bot) => ua.includes(bot))) {
    return res.status(403).json({ message: "Bots are not allowed" });
  }
  next();
});

/* ------------------------------
   RATE LIMITERS
------------------------------ */
const defaultLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: "Too many requests from this IP, please try later",
});

const productLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000,                 // allow more requests for dev
  message: "Too many requests to products, slow down",
});

/* ------------------------------
   JSON & FORM PARSING WITH LIMITS
------------------------------ */
app.use(express.json({ limit: "10kb" }));
app.use(express.urlencoded({ extended: true, limit: "10kb" }));

/* ------------------------------
   REQUEST LOGGING
------------------------------ */
app.use((req, res, next) => {
  console.log(`Request: ${req.method} ${req.url}`);
  next();
});

/* ------------------------------
   GLOBAL AUDIT LOGGING
------------------------------ */
app.use((req, res, next) => {
  res.on("finish", () => {
    if (req.user) {
      console.log(
        `[AUDIT] ${req.user._id} | ${req.method} ${req.originalUrl} | ${res.statusCode}`
      );
    }
  });
  next();
});

/* ------------------------------
   SECURE STATIC /uploads
------------------------------ */
app.use(
  "/uploads",
  auth, // require auth for uploads
  express.static("uploads", {
    dotfiles: "deny",
    maxAge: "1d",
  })
);

/* ------------------------------
   PUBLIC ROUTES
------------------------------ */
//app.use("/api/register", defaultLimiter, register);
app.use("/api/register", register);
app.use("/api/login", defaultLimiter, login);
app.use("/api/forgot-password", forgotPasswordRoutes);
app.use("/api/google", googleAuthRoutes);

// Products routes (public access for guests)
if (process.env.NODE_ENV === "production") {
  app.use("/api/products", productLimiter, productsRoute); // guests can fetch products
} else {
  app.use("/api/products", productsRoute); // no limiter for dev
}

// Legacy or fallback route
app.get("/products", productLimiter, (req, res) => res.send(products));

/* ------------------------------
   GLOBAL AUTH GATE (AUTOMATED TENANT GUARD)
   — only applies to non-public routes
------------------------------ */
app.use("/api", (req, res, next) => {
  // List of prefixes that should remain public
  const publicPrefixes = ["/api/login", "/api/register", "/api/products"];

  // If request path starts with any public prefix, skip auth
  if (publicPrefixes.some(prefix => req.path.startsWith(prefix))) return next();

  // All other routes require authentication
  return auth(req, res, next);
});

/* ------------------------------
   AUTHENTICATED / PROTECTED ROUTES
------------------------------ */
app.use("/api/orders", orders);
app.use("/api/attendance", attendanceRoutes);
app.use("/api/employee-info", employeeInfoRoutes);
app.use("/api/analytics", analyticsRoutes);
app.use("/api/payrolls", payrollRoutes);
app.use("/api/inventory", inventoryRoutes);
app.use("/api/sales", salesRoutes);
app.use("/api/sos", sosRoutes);
app.use("/api/bulk-email", bulkEmailRoutes);
app.use("/api/tax", taxRoutes);
app.use("/api/tax-settings", taxSettings);
app.use("/api/company-tax", companyTaxRoutes);
app.use("/api/company-tax/paye-remittance", payeRemittanceRoutes);
app.use("/api/firs-export", firsExportRoutes);
app.use("/api/company", companyRoutes);
app.use("/api/tax-ledger", taxLedgerRoutes);
app.use("/api/reports", reportsRoute);
app.use("/api/expenses", expensesRoute);
app.use("/api/safe-fetch", safeFetchRoutes);
app.use("/api/invoices", invoiceRoutes);
app.use("/api/users", userRoutes);
app.use("/api/finance", financeRoutes);
/* ------------------------------
   BASE ROUTES
------------------------------ */
app.get("/", (req, res) => {
  res.send("Welcome to our online shop API...");
});

/* ------------------------------
   GLOBAL 404 HANDLER
------------------------------ */
app.use((req, res) => {
  res.status(404).json({ message: "Resource not found" });
});

/* ------------------------------
   ERROR HANDLING
------------------------------ */
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ message: "Internal Server Error" });
});

/* ------------------------------
   START SERVER
------------------------------ */
const port = process.env.PORT || 2000;
app.listen(port, () => {
  console.log(`Server running on port ${port}...`);
});

module.exports = app;