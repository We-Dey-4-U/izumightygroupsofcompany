const axios = require("axios");

async function sendToFirsProvider(payload) {
  // ✅ Mock if API key is not configured
  if (!process.env.FIRS_API_KEY) {
    console.log("FIRS API not configured. Skipping actual submission.");
    // Return mock response similar to what FIRS would return
    return {
      success: true,
      message: "Invoice finalized locally (mock).",
      firsInvoiceStatus: "FINAL",
      invoiceId: payload.invoiceId || "MOCK-INV-12345"
    };
  }

  // ✅ Actual FIRS API call
  try {
    const response = await axios.post(
      process.env.FIRS_PROVIDER_URL,
      payload,
      {
        headers: {
          Authorization: `Bearer ${process.env.FIRS_API_KEY}`,
          "Content-Type": "application/json"
        },
        timeout: 15000
      }
    );

    return response.data;
  } catch (err) {
    console.error("FIRS submission error:", err.message || err);
    throw new Error("FIRS submission failed. " + (err.message || "Unknown error"));
  }
}

module.exports = { sendToFirsProvider };