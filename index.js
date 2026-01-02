require("dotenv").config();
const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
const prerender = require("prerender-node");
const helmet = require("helmet");
const Sentry = require("@sentry/node");
const Tracing = require("@sentry/tracing");
const rateLimit = require("express-rate-limit");
const financeRoutes = require("./routes/finance");
const invoiceRoutes = require("./routes/invoice");
// Routes
const register = require("./routes/register");
const login = require("./routes/login");
const safeFetchRoutes = require("./routes/safeFetch");
const sosRoutes = require("./routes/sosRoutes");
const productsRoute = require("./routes/products");
const users = require("./routes/users");
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

// Security
const { apiKeyMiddleware, createRateLimiter } = require("./middleware/security");

const app = express();

/* ------------------------------
   SENTRY MONITORING & ALERTING
------------------------------ */
Sentry.init({
  dsn: process.env.SENTRY_DSN,
  tracesSampleRate: 1.0,
});
app.use(Sentry.Handlers.requestHandler());
app.use(Sentry.Handlers.tracingHandler());

/* ------------------------------
   PRERENDER
------------------------------ */
//prerender.set("prerenderToken", process.env.PRERENDER_TOKEN);
////app.use((req, res, next) => {
 // if (req.url.startsWith("/api")) {
  //  return next(); // 🚫 skip prerender for API
//  }
//  prerender(req, res, next);
//});

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
   CORS
------------------------------ */
app.use(
  cors({
    origin: "*",
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "x-auth-token"],
  })
);

/* ------------------------------
   BOT / SCRAPER BLOCKING
------------------------------ */
app.use((req, res, next) => {
  const ua = (req.headers["user-agent"] || "").toLowerCase();
  const bots = ["curl", "wget", "python-requests", "scrapy"];
  if (bots.some(bot => ua.includes(bot))) {
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
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: "Too many requests to products, slow down",
});

/* ------------------------------
   JSON & FORM PARSING WITH LIMITS
------------------------------ */
app.use(express.json({ limit: "10kb" }));
app.use(express.urlencoded({ extended: true, limit: "10kb" }));

/* ------------------------------
   LOG REQUESTS
------------------------------ */
app.use((req, res, next) => {
  console.log(`Request: ${req.method} ${req.url}`);
  next();
});

/* ------------------------------
   STATIC FOLDER
------------------------------ */
app.use("/uploads", express.static("uploads"));

/* ------------------------------
   PUBLIC ROUTES
------------------------------ */
app.use("/api/register", defaultLimiter, register);
app.use("/api/login", defaultLimiter, login);
app.use("/api/products", productLimiter, productsRoute);
app.get("/products", productLimiter, (req, res) => res.send(products));

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
app.use("/api/users", users);
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
   MONGODB CONNECTION
------------------------------ */
mongoose
  .connect(process.env.CONNECTION_STRING, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => console.log("MongoDB connection established..."))
  .catch((error) => console.error("MongoDB connection failed:", error.message));

/* ------------------------------
   ERROR HANDLING
------------------------------ */
app.use(Sentry.Handlers.errorHandler());

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