const { expect } = require("chai");
const request = require("supertest");
const express = require("express");
const authBodyLimiter = require("../../middleware/bodySizeLimiter");

describe("Body Size Limiter Middleware", function() {
  let app;

  beforeEach(function() {
    app = express();
    app.use(authBodyLimiter);
    app.post("/test", (req, res) => {
      res.status(200).json({ message: "Success" });
    });
  });

  it("should accept requests within 10kb limit", function(done) {
    const smallPayload = { email: "test@example.com", password: "Test123!@#" };
    
    request(app)
      .post("/test")
      .send(smallPayload)
      .expect(200, done);
  });

  it("should reject requests exceeding 10kb limit", function(done) {
    // Create a payload larger than 10kb
    const largePayload = {
      email: "test@example.com",
      password: "a".repeat(11 * 1024) // 11kb
    };
    
    request(app)
      .post("/test")
      .send(largePayload)
      .expect(413, done);
  });

  it("should handle empty body", function(done) {
    request(app)
      .post("/test")
      .send({})
      .expect(200, done);
  });
});
