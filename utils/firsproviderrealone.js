const axios = require("axios");

async function sendToFirsProvider(payload) {
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
}

module.exports = { sendToFirsProvider };