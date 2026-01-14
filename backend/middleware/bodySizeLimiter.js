const express = require("express");

/**
 * Body size limiter for authentication endpoints
 * Limits request body to 10kb
 */
const authBodyLimiter = express.json({ 
  limit: "10kb",
  verify: (req, res, buf) => {
    // Additional verification if needed
    if (buf.length > 10 * 1024) {
      throw new Error("Request body too large");
    }
  }
});

module.exports = authBodyLimiter;

