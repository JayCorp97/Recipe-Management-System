const { expect } = require("chai");
const sinon = require("sinon");
const { adminOnly, userOrAdmin } = require("../../middleware/roleMiddleware");

describe("Role Middleware", function() {
  let req, res, next;

  beforeEach(function() {
    req = {
      userRole: null,
      userId: null
    };
    res = {
      status: sinon.stub().returnsThis(),
      json: sinon.stub()
    };
    next = sinon.spy();
  });

  afterEach(function() {
    sinon.restore();
  });

  describe("adminOnly", function() {
    it("should call next() for admin role", function() {
      req.userRole = "admin";
      
      adminOnly(req, res, next);
      
      expect(next.calledOnce).to.be.true;
      expect(res.status.called).to.be.false;
    });

    it("should return 403 for user role", function() {
      req.userRole = "user";
      
      adminOnly(req, res, next);
      
      expect(next.called).to.be.false;
      expect(res.status.calledWith(403)).to.be.true;
      expect(res.json.calledOnce).to.be.true;
    });

    it("should return 401 when userRole is missing", function() {
      req.userRole = null;
      
      adminOnly(req, res, next);
      
      expect(next.called).to.be.false;
      expect(res.status.calledWith(401)).to.be.true;
    });

    it("should return 403 for invalid role", function() {
      req.userRole = "invalid";
      
      adminOnly(req, res, next);
      
      expect(next.called).to.be.false;
      expect(res.status.calledWith(403)).to.be.true;
    });
  });

  describe("userOrAdmin", function() {
    it("should call next() for admin role", function() {
      req.userRole = "admin";
      
      userOrAdmin(req, res, next);
      
      expect(next.calledOnce).to.be.true;
      expect(res.status.called).to.be.false;
    });

    it("should call next() for user role", function() {
      req.userRole = "user";
      
      userOrAdmin(req, res, next);
      
      expect(next.calledOnce).to.be.true;
      expect(res.status.called).to.be.false;
    });

    it("should return 401 when userRole is missing", function() {
      req.userRole = null;
      
      userOrAdmin(req, res, next);
      
      expect(next.called).to.be.false;
      expect(res.status.calledWith(401)).to.be.true;
    });

    it("should return 403 for invalid role", function() {
      req.userRole = "invalid";
      
      userOrAdmin(req, res, next);
      
      expect(next.called).to.be.false;
      expect(res.status.calledWith(403)).to.be.true;
    });
  });
});
