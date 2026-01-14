/**
 * Standardized Error Response Format
 * All API errors follow this structure:
 * {
 *   error: {
 *     code: string,
 *     message: string,
 *     details?: string | array
 *   }
 * }
 */

/**
 * Create standardized error response
 * @param {string} code - Error code (e.g., "VALIDATION_ERROR", "AUTH_ERROR")
 * @param {string} message - Human-readable error message
 * @param {string|array} details - Optional additional details
 * @returns {object} Standardized error object
 */
function createErrorResponse(code, message, details = null) {
  const error = { code, message };
  if (details) {
    error.details = details;
  }
  return { error };
}

/**
 * Send standardized error response
 * @param {object} res - Express response object
 * @param {number} statusCode - HTTP status code
 * @param {string} code - Error code
 * @param {string} message - Error message
 * @param {string|array} details - Optional details
 */
function sendError(res, statusCode, code, message, details = null) {
  return res.status(statusCode).json(createErrorResponse(code, message, details));
}

/**
 * Common error codes
 */
const ErrorCodes = {
  VALIDATION_ERROR: "VALIDATION_ERROR",
  AUTH_ERROR: "AUTH_ERROR",
  NOT_FOUND: "NOT_FOUND",
  RATE_LIMIT_EXCEEDED: "RATE_LIMIT_EXCEEDED",
  SERVER_ERROR: "SERVER_ERROR",
  UNAUTHORIZED: "UNAUTHORIZED",
  FORBIDDEN: "FORBIDDEN",
  PAYLOAD_TOO_LARGE: "PAYLOAD_TOO_LARGE"
};

module.exports = {
  createErrorResponse,
  sendError,
  ErrorCodes
};

