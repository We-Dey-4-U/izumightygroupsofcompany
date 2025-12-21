const express = require("express");
const axios = require("axios");
const { isSafeUrl } = require("../utils/ssrfProtection");

const router = express.Router();

router.post("/", async (req, res) => {
  const { url } = req.body;

  if (!url) {
    return res.status(400).json({ message: "URL is required" });
  }

  const safe = await isSafeUrl(url);
  if (!safe) {
    return res.status(400).json({ message: "Blocked: unsafe URL" });
  }

  try {
    const response = await axios.get(url, {
      timeout: 5000,        // prevent hanging requests
      maxRedirects: 0,      // prevent SSRF via redirects
      validateStatus: null  // return all status codes for inspection
    });

    res.json({
      status: "success",
      data: response.data
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to fetch external data" });
  }
});

module.exports = router;