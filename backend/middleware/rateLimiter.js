const rateLimit = require("express-rate-limit");

/**
 * Rate limiter for authentication endpoints
 * Limits: 20 requests per 15 minutes per IP
 * Skips rate limiting in test environment
 */
const authLimiterConfig = {
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20, // Limit each IP to 20 requests per windowMs
  message: {
    error: {
      code: "RATE_LIMIT_EXCEEDED",
      message: "Too many requests from this IP, please try again later.",
      details: "Maximum 20 requests per 15 minutes allowed"
    }
  },
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
};

const authLimiter = rateLimit(authLimiterConfig);

// In test mode, skip rate limiting
const authLimiterMiddleware = (req, res, next) => {
  if (process.env.NODE_ENV === 'test') {
    return next();
  }
  return authLimiter(req, res, next);
};

module.exports = authLimiterMiddleware;

