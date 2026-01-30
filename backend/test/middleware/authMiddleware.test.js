const { expect } = require("chai");
const sinon = require("sinon");
const jwt = require("jsonwebtoken");
const authMiddleware = require("../../middleware/authMiddleware");

describe("Auth Middleware", function() {
  let req, res, next;

  beforeEach(function() {
    req = {
      headers: {},
      userId: null,
      userRole: null,
      user: null
    };
    res = {
      status: sinon.stub().returnsThis(),
      json: sinon.stub()
    };
    next = sinon.spy();
    
    // Set JWT_SECRET for testing
    if (!process.env.JWT_SECRET) {
      process.env.JWT_SECRET = "test-secret-key";
    }
  });

  afterEach(function() {
    sinon.restore();
  });

  describe("Token Validation", function() {
    it("should call next() with valid token", function() {
      const userId = "507f1f77bcf86cd799439011";
      const token = jwt.sign({ id: userId, role: "user" }, process.env.JWT_SECRET);
      
      req.headers.authorization = `Bearer ${token}`;
      
      authMiddleware(req, res, next);
      
      expect(next.calledOnce).to.be.true;
      expect(req.userId).to.equal(userId);
      expect(req.userRole).to.equal("user");
      expect(res.status.called).to.be.false;
    });

    it("should return 401 when no token is provided", function() {
      req.headers.authorization = "";
      
      authMiddleware(req, res, next);
      
      expect(next.called).to.be.false;
      expect(res.status.calledWith(401)).to.be.true;
      expect(res.json.calledOnce).to.be.true;
    });

    it("should return 401 when token is invalid", function() {
      req.headers.authorization = "Bearer invalid-token";
      
      authMiddleware(req, res, next);
      
      expect(next.called).to.be.false;
      expect(res.status.calledWith(401)).to.be.true;
      expect(res.json.calledOnce).to.be.true;
    });

    it("should return 401 when token is expired", function() {
      const expiredToken = jwt.sign(
        { id: "507f1f77bcf86cd799439011", role: "user" },
        process.env.JWT_SECRET,
        { expiresIn: "-1h" }
      );
      
      req.headers.authorization = `Bearer ${expiredToken}`;
      
      authMiddleware(req, res, next);
      
      expect(next.called).to.be.false;
      expect(res.status.calledWith(401)).to.be.true;
    });

    it("should handle token without Bearer prefix", function() {
      const userId = "507f1f77bcf86cd799439011";
      const token = jwt.sign({ id: userId, role: "user" }, process.env.JWT_SECRET);
      
      req.headers.authorization = token;
      
      authMiddleware(req, res, next);
      
      expect(next.called).to.be.false;
      expect(res.status.calledWith(401)).to.be.true;
    });

    it("should extract token correctly with Bearer prefix", function() {
      const userId = "507f1f77bcf86cd799439011";
      const token = jwt.sign({ id: userId, role: "admin" }, process.env.JWT_SECRET);
      
      req.headers.authorization = `Bearer ${token}`;
      
      authMiddleware(req, res, next);
      
      expect(next.calledOnce).to.be.true;
      expect(req.userRole).to.equal("admin");
    });

    it("should handle token with extra whitespace", function() {
      const userId = "507f1f77bcf86cd799439011";
      const token = jwt.sign({ id: userId, role: "user" }, process.env.JWT_SECRET);
      
      req.headers.authorization = `Bearer  ${token}  `;
      
      authMiddleware(req, res, next);
      
      expect(next.calledOnce).to.be.true;
      expect(req.userId).to.equal(userId);
    });
  });

  describe("User Object Attachment", function() {
    it("should attach user object to request", function() {
      const userId = "507f1f77bcf86cd799439011";
      const token = jwt.sign({ id: userId, role: "user" }, process.env.JWT_SECRET);
      
      req.headers.authorization = `Bearer ${token}`;
      
      authMiddleware(req, res, next);
      
      expect(req.user).to.exist;
      expect(req.user.id).to.equal(userId);
      expect(req.user.role).to.equal("user");
    });
  });
});
