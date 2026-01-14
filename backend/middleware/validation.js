const { body, validationResult } = require("express-validator");
const { sendError, ErrorCodes } = require("../utils/errorHandler");

/**
 * Validation result handler middleware
 * Checks validation results and sends standardized error if validation fails
 */
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const errorMessages = errors.array().map(err => err.msg);
    return sendError(res, 400, ErrorCodes.VALIDATION_ERROR, 
      "Validation failed", 
      errorMessages);
  }
  next();
};

/**
 * Registration validation rules
 */
const validateRegister = [
  body("f_name")
    .trim()
    .notEmpty().withMessage("First name is required")
    .isLength({ min: 1, max: 50 }).withMessage("First name must be between 1 and 50 characters"),
  
  body("l_name")
    .trim()
    .notEmpty().withMessage("Last name is required")
    .isLength({ min: 1, max: 50 }).withMessage("Last name must be between 1 and 50 characters"),
  
  body("email")
    .trim()
    .notEmpty().withMessage("Email is required")
    .isEmail().withMessage("Invalid email format")
    .normalizeEmail(),
  
  body("password")
    .notEmpty().withMessage("Password is required")
    .isLength({ min: 8 }).withMessage("Password must be at least 8 characters long")
    .matches(/[A-Z]/).withMessage("Password must contain at least one uppercase letter")
    .matches(/[a-z]/).withMessage("Password must contain at least one lowercase letter")
    .matches(/[0-9]/).withMessage("Password must contain at least one number")
    .matches(/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/).withMessage("Password must contain at least one special character"),
  
  body("confirm_password")
    .notEmpty().withMessage("Confirm password is required")
    .custom((value, { req }) => {
      if (value !== req.body.password) {
        throw new Error("Passwords do not match");
      }
      return true;
    }),
  
  handleValidationErrors
];

/**
 * Login validation rules
 */
const validateLogin = [
  body("email")
    .trim()
    .notEmpty().withMessage("Email is required")
    .isEmail().withMessage("Invalid email format")
    .normalizeEmail(),
  
  body("password")
    .notEmpty().withMessage("Password is required"),
  
  handleValidationErrors
];

module.exports = {
  validateRegister,
  validateLogin,
  handleValidationErrors
};

