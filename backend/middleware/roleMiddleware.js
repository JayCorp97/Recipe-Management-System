const { sendError, ErrorCodes } = require("../utils/errorHandler");

/**
 * Middleware to check if user has admin role
 * Must be used after authMiddleware
 */
const adminOnly = (req, res, next) => {
  if (!req.userRole) {
    return sendError(res, 401, ErrorCodes.UNAUTHORIZED, 
      "Authentication required");
  }
  
  if (req.userRole !== "admin") {
    return sendError(res, 403, ErrorCodes.FORBIDDEN, 
      "Admin access required");
  }
  
  next();
};

/**
 * Middleware to check if user has admin or user role
 * Must be used after authMiddleware
 */
const userOrAdmin = (req, res, next) => {
  if (!req.userRole) {
    return sendError(res, 401, ErrorCodes.UNAUTHORIZED, 
      "Authentication required");
  }
  
  if (req.userRole !== "admin" && req.userRole !== "user") {
    return sendError(res, 403, ErrorCodes.FORBIDDEN, 
      "Invalid user role");
  }
  
  next();
};

module.exports = {
  adminOnly,
  userOrAdmin
};

