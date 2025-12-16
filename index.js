const express = require("express");
const cors = require("cors"); 
const mongoose = require("mongoose");
const register = require("./routes/register");
const login = require("./routes/login");
const sosRoutes = require("./routes/sosRoutes");
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
const employeeInfoRoutes = require("./routes/employeeInfoRoutes"); 
const payrollRoutes = require("./routes/payroll"); // updated payroll router
const inventoryRoutes = require("./routes/inventory");
const salesRoutes = require("./routes/salesRoutes");
const bulkEmailRoutes = require("./routes/bulkEmail"); // ✅ Bulk Email module
// Near your other tax routes
//const companyTaxRoutes = require("./routes/companyTax");
// near your other routes
const taxRoutes = require("./routes/tax");
const taxSettings = require("./routes/taxSettings");
const companyRoutes = require("./routes/company");

const companyTaxRoutes = require("./routes/companyTax");          // PAYE summary
const payeRemittanceRoutes = require("./routes/payeRemittance"); // Monthly remittance
const firsExportRoutes = require("./routes/firsExport");         // FIRS CSV export
const taxLedgerRoutes = require("./routes/taxLedger");

const app = express();

// Optional prerender
prerender.set('prerenderToken', process.env.PRERENDER_TOKEN);
app.use(prerender);

/* -----------------------------------
   ✅ FIXED CORS (allow all + tokens)
-------------------------------------- */
app.use(
  cors({
    origin: "*",
    methods: ["GET", "POST", "PUT","PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: [
      "Content-Type",
      "Authorization",
      "x-auth-token"   // 🔥 ADDED (required for protected routes)
    ],
  })
);

/* -----------------------------------
   ✅ Must come BEFORE all routes
   Parse JSON + form-data
-------------------------------------- */
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Log CORS
app.use((req, res, next) => {
  console.log(`CORS check: ${req.method} ${req.url}`);
  next();
});

// Static folder
app.use("/uploads", express.static("uploads"));

/* -----------------------------------
   API ROUTES
-------------------------------------- */
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
app.use("/api/employee-info", employeeInfoRoutes);
app.use("/api/payrolls", payrollRoutes);
app.use("/api/inventory", inventoryRoutes);
app.use("/api/sales", salesRoutes);
app.use("/api/sos", sosRoutes);
app.use("/api/bulk-email", bulkEmailRoutes); // ✅ Added Bulk Email routes
app.use("/api/tax", taxRoutes);
app.use("/api/tax-settings", taxSettings); 
// ... inside API ROUTES section
app.use("/api/company-tax", companyTaxRoutes);
// ✅ Company routes
app.use("/api/company", companyRoutes);
// Existing routes
app.use("/api/tax-ledger", taxLedgerRoutes);


/* ------------------------------
   ✅ PAYE & Company Tax Routes
------------------------------ */
// GET monthly PAYE summary
app.use("/api/company-tax", companyTaxRoutes);

// GET monthly remittance & mark remitted
app.use("/api/company-tax/paye-remittance", payeRemittanceRoutes);

// Download FIRS CSV
app.use("/api/firs-export", firsExportRoutes);

/* -----------------------------------
   BASE ROUTES
-------------------------------------- */
app.get("/", (req, res) => {
  res.send("Welcome to our online shop API...");
});

app.get("/products", (req, res) => {
  res.send(products);
});

/* -----------------------------------
   MONGODB CONNECTION
-------------------------------------- */
mongoose
  .connect(process.env.CONNECTION_STRING, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => console.log("MongoDB connection established..."))
  .catch((error) =>
    console.error("MongoDB connection failed:", error.message)
  );

/* -----------------------------------
   START SERVER
-------------------------------------- */
const port = process.env.PORT || 2000;
app.listen(port, () => {
  console.log(`Server running on port ${port}...`);
});

// Export for Vercel
module.exports = app;