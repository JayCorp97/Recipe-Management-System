const rateLimit = require("express-rate-limit");

/**
 * Rate limiter for authentication endpoints
 * Limits: 5 requests per 15 minutes per IP
 */
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // Limit each IP to 5 requests per windowMs
  message: {
    error: {
      code: "RATE_LIMIT_EXCEEDED",
      message: "Too many requests from this IP, please try again later.",
      details: "Maximum 5 requests per 15 minutes allowed"
    }
  },
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
});

module.exports = authLimiter;

