const Invoice = require("../models/Invoice");
const Company = require("../models/Company");
const { sendToFirsProvider } = require("./firsProviderAdapter");

/**
 * Queue invoice for async FIRS submission
 * This MUST be called only after invoice is FINAL
 */
async function queueFirsSubmission(invoiceId) {
  // Non-blocking async execution
  setImmediate(() => submitInvoice(invoiceId));
}

/**
 * Submit finalized invoice to FIRS provider
 */
async function submitInvoice(invoiceId) {
  const invoice = await Invoice.findById(invoiceId);
  if (!invoice) return;

  // Safety check — never submit non-final invoices
  if (invoice.firsInvoiceStatus !== "FINAL") return;

  try {
    const company = await Company.findById(invoice.companyId);
    if (!company) throw new Error("Company not found");

    const payload = {
      invoiceNumber: invoice.invoiceId,
      invoiceDate: invoice.createdAt.toISOString().split("T")[0],

      seller: {
        tin: company.tin,
        name: company.name
      },

      buyer: {
        name: invoice.customerName || "Walk-in Customer"
      },

      items: invoice.items.map(item => ({
        description:
          item.type === "product"
            ? item.productName || "Product"
            : item.serviceName || "Service",
        quantity: item.quantity,
        unitPrice: item.price,
        total: item.total
      })),

      vatTotal: invoice.vatAmount,
      totalAmount: invoice.totalAmount
    };

    // Mark as submitted (optimistic lock)
    invoice.firsInvoiceStatus = "SUBMITTED";
    invoice.submittedToFirs = true;
    await invoice.save();

    // Send to provider
    const response = await sendToFirsProvider(payload);

    // ✅ Accepted by FIRS
    invoice.firsInvoiceStatus = "ACCEPTED";
    invoice.firsReference = response.reference || null;
    invoice.firsQrCode = response.qrCode || null;
    invoice.firsStatus = response.status || "ACCEPTED";
    await invoice.save();

  } catch (err) {
    console.error("❌ FIRS SUBMISSION FAILED:", err.message);

    // 🔁 Retry-safe rollback
    invoice.firsInvoiceStatus = "FINAL";
    invoice.submittedToFirs = false;
    await invoice.save();
  }
}

module.exports = { queueFirsSubmission };