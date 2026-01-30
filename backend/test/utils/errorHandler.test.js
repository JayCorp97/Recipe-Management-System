const { expect } = require("chai");
const sinon = require("sinon");
const { sendError, createErrorResponse, ErrorCodes } = require("../../utils/errorHandler");

describe("Error Handler Utility", function() {
  let res;

  beforeEach(function() {
    res = {
      status: sinon.stub().returnsThis(),
      json: sinon.stub()
    };
  });

  afterEach(function() {
    sinon.restore();
  });

  describe("createErrorResponse", function() {
    it("should create error response with code and message", function() {
      const error = createErrorResponse(ErrorCodes.VALIDATION_ERROR, "Validation failed");
      
      expect(error).to.have.property("error");
      expect(error.error.code).to.equal(ErrorCodes.VALIDATION_ERROR);
      expect(error.error.message).to.equal("Validation failed");
      expect(error.error.details).to.be.undefined;
    });

    it("should include details when provided", function() {
      const details = ["Field is required", "Invalid format"];
      const error = createErrorResponse(ErrorCodes.VALIDATION_ERROR, "Validation failed", details);
      
      expect(error.error.details).to.deep.equal(details);
    });

    it("should handle string details", function() {
      const error = createErrorResponse(ErrorCodes.VALIDATION_ERROR, "Validation failed", "Field is required");
      
      expect(error.error.details).to.equal("Field is required");
    });
  });

  describe("sendError", function() {
    it("should send error response with status code", function() {
      sendError(res, 400, ErrorCodes.VALIDATION_ERROR, "Validation failed");
      
      expect(res.status.calledWith(400)).to.be.true;
      expect(res.json.calledOnce).to.be.true;
      
      const response = res.json.firstCall.args[0];
      expect(response.error.code).to.equal(ErrorCodes.VALIDATION_ERROR);
      expect(response.error.message).to.equal("Validation failed");
    });

    it("should send error with details", function() {
      const details = ["Field is required"];
      sendError(res, 400, ErrorCodes.VALIDATION_ERROR, "Validation failed", details);
      
      const response = res.json.firstCall.args[0];
      expect(response.error.details).to.deep.equal(details);
    });

    it("should handle different error codes", function() {
      sendError(res, 401, ErrorCodes.UNAUTHORIZED, "Not authorized");
      
      const response = res.json.firstCall.args[0];
      expect(response.error.code).to.equal(ErrorCodes.UNAUTHORIZED);
      expect(res.status.calledWith(401)).to.be.true;
    });
  });

  describe("ErrorCodes", function() {
    it("should have all required error codes", function() {
      expect(ErrorCodes).to.have.property("VALIDATION_ERROR");
      expect(ErrorCodes).to.have.property("AUTH_ERROR");
      expect(ErrorCodes).to.have.property("NOT_FOUND");
      expect(ErrorCodes).to.have.property("RATE_LIMIT_EXCEEDED");
      expect(ErrorCodes).to.have.property("SERVER_ERROR");
      expect(ErrorCodes).to.have.property("UNAUTHORIZED");
      expect(ErrorCodes).to.have.property("FORBIDDEN");
      expect(ErrorCodes).to.have.property("PAYLOAD_TOO_LARGE");
    });
  });
});
