const jwt = require("jsonwebtoken");
const { sendError, ErrorCodes } = require("../utils/errorHandler");

function auth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return sendError(res, 401, ErrorCodes.UNAUTHORIZED, "Not authorized - No token provided");
  }

  const token = authHeader.split(" ")[1];

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.userId = decoded.id; // attach user id to request
    req.userRole = decoded.role; // attach user role to request
    next();
  } catch (err) {
    return sendError(res, 401, ErrorCodes.UNAUTHORIZED, "Not authorized - Invalid or expired token");
  }
}

module.exports = auth;
