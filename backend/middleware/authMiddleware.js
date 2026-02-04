const jwt = require("jsonwebtoken");
const User = require("../models/User");
const { sendError, ErrorCodes } = require("../utils/errorHandler");

module.exports = async function authMiddleware(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7).trim() : null;

  if (!token) {
    return sendError(
      res,
      401,
      ErrorCodes.UNAUTHORIZED,
      "Not authorized - No token provided"
    );
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);


    req.user = decoded;
    req.userId = decoded.id;
    req.userRole = decoded.role;

    const user = await User.findById(req.userId).select("role active deletedAt");
    if (!user) {
      return sendError(
        res,
        401,
        ErrorCodes.UNAUTHORIZED,
        "Not authorized - User not found"
      );
    }

    if (user.deletedAt) {
      return sendError(
        res,
        403,
        ErrorCodes.FORBIDDEN,
        "Account has been deleted"
      );
    }

    if (user.active !== 1) {
      return sendError(
        res,
        403,
        ErrorCodes.FORBIDDEN,
        "Account is inactive"
      );
    }

    req.userRole = user.role || req.userRole;

    return next();
  } catch (err) {
    return sendError(
      res,
      401,
      ErrorCodes.UNAUTHORIZED,
      "Not authorized - Invalid or expired token"
    );
  }
};
