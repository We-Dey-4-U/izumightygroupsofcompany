const rateLimit = require("express-rate-limit");

// API Key check middleware
const apiKeyMiddleware = (req, res, next) => {
  const apiKey = req.headers["x-api-key"];
  if (!apiKey || apiKey !== process.env.MY_SECRET_API_KEY) {
    console.warn(`Unauthorized access attempt from IP: ${req.ip}`);
    return res.status(401).json({ message: "Unauthorized" });
  }
  next();
};

// Generic rate limiter factory (you can create different limits per route)
const createRateLimiter = (options = {}) => {
  return rateLimit({
    windowMs: options.windowMs || 15 * 60 * 1000, // default 15 minutes
    max: options.max || 100,                      // default 100 requests per IP
    message: options.message || "Too many requests, try later",
  });
};

module.exports = { apiKeyMiddleware, createRateLimiter };