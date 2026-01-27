const { expect } = require("chai");
const request = require("supertest");
const express = require("express");
const authLimiter = require("../../middleware/rateLimiter");

describe("Rate Limiter Middleware", function() {
  let app;
  let originalNodeEnv;

  beforeEach(function() {
    // Save original NODE_ENV and set it to 'development' for these tests
    // so rate limiting is actually applied
    originalNodeEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'development';
    
    app = express();
    app.use(express.json());
    app.use("/api/auth", authLimiter);
    app.post("/api/auth/test", (req, res) => {
      res.status(200).json({ message: "Success" });
    });
  });

  afterEach(function() {
    // Restore original NODE_ENV
    if (originalNodeEnv !== undefined) {
      process.env.NODE_ENV = originalNodeEnv;
    } else {
      delete process.env.NODE_ENV;
    }
  });

  it("should allow requests within rate limit", function(done) {
    request(app)
      .post("/api/auth/test")
      .send({ test: "data" })
      .expect(200, done);
  });

  it("should include rate limit headers", function(done) {
    request(app)
      .post("/api/auth/test")
      .send({ test: "data" })
      .expect(200)
      .end(function(err, res) {
        if (err) return done(err);
        // Rate limit headers should be present when not in test mode
        expect(res.headers).to.have.property("ratelimit-limit");
        done();
      });
  });
});
