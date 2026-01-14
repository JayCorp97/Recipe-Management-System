const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const authMiddleware = require("../middleware/authMiddleware");
const authLimiter = require("../middleware/rateLimiter");
const { validateRegister, validateLogin } = require("../middleware/validation");
const { sendError, ErrorCodes } = require("../utils/errorHandler");

const router = express.Router();

/**
 * Password Policy Validation
 * Requirements: min 8 chars, uppercase, lowercase, number, special char
 */
function validatePassword(password) {
  const errors = [];
  
  if (password.length < 8) {
    errors.push("Password must be at least 8 characters long");
  }
  if (!/[A-Z]/.test(password)) {
    errors.push("Password must contain at least one uppercase letter");
  }
  if (!/[a-z]/.test(password)) {
    errors.push("Password must contain at least one lowercase letter");
  }
  if (!/[0-9]/.test(password)) {
    errors.push("Password must contain at least one number");
  }
  if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
    errors.push("Password must contain at least one special character");
  }
  
  return {
    isValid: errors.length === 0,
    errors: errors
  };
}

/**
 * REGISTER USER
 * POST /api/auth/register
 */
router.post("/register", authLimiter, validateRegister, async (req, res) => {
  try {
    // Check payload size (10kb limit)
    const contentLength = req.get("content-length");
    if (contentLength && parseInt(contentLength) > 10 * 1024) {
      return sendError(res, 413, ErrorCodes.PAYLOAD_TOO_LARGE, 
        "Request payload too large", 
        "Maximum 10kb allowed for registration");
    }

    const { f_name, l_name, email, password, confirm_password } = req.body;

    // Email is already normalized by express-validator
    const normalizedEmail = email.toLowerCase().trim();

    // Check existing user
    const existingUser = await User.findOne({ email: normalizedEmail });
    if (existingUser) {
      return sendError(res, 400, ErrorCodes.VALIDATION_ERROR, 
        "Email already exists");
    }

    // Password mismatch check
    if (password !== confirm_password) {
      return sendError(res, 400, ErrorCodes.VALIDATION_ERROR, 
        "Passwords do not match");
    }

    // Password policy validation
    const passwordValidation = validatePassword(password);
    if (!passwordValidation.isValid) {
      return sendError(res, 400, ErrorCodes.VALIDATION_ERROR, 
        "Password does not meet requirements",
        passwordValidation.errors);
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create user (role defaults to "user" from schema)
    const newUser = await User.create({
      f_name,
      l_name,
      email: normalizedEmail,
      password: hashedPassword,
      active: 1,
      created_date: new Date()
    });

    // Generate JWT token with user id and role, 24-hour expiry
    const token = jwt.sign(
      { 
        id: newUser._id,
        role: newUser.role || "user"
      },
      process.env.JWT_SECRET,
      { expiresIn: "24h" }
    );

    return res.status(201).json({ 
      message: "Registered successfully",
      token: token
    });

  } catch (error) {
    console.error("Register error:", error);
    return sendError(res, 500, ErrorCodes.SERVER_ERROR, 
      "Server error", 
      process.env.NODE_ENV === "development" ? error.message : undefined);
  }
});

/**
 * @route   POST /api/auth/login
 * @desc    Login user
 */
router.post("/login", authLimiter, validateLogin, async (req, res) => {
  try {
    // Check payload size (10kb limit)
    const contentLength = req.get("content-length");
    if (contentLength && parseInt(contentLength) > 10 * 1024) {
      return sendError(res, 413, ErrorCodes.PAYLOAD_TOO_LARGE, 
        "Request payload too large", 
        "Maximum 10kb allowed for login");
    }

    const { email, password } = req.body;

    // Email is already normalized by express-validator
    const normalizedEmail = email.toLowerCase().trim();

    // Find user
    const user = await User.findOne({ email: normalizedEmail });
    if (!user) {
      return sendError(res, 401, ErrorCodes.AUTH_ERROR, 
        "Invalid email or password");
    }

    // Compare passwords
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return sendError(res, 401, ErrorCodes.AUTH_ERROR, 
        "Invalid email or password");
    }

    // Active user check
    if (user.active !== 1) {
      return sendError(res, 403, ErrorCodes.FORBIDDEN, 
        "Account is inactive");
    }

    // Generate JWT with user id and role, 24-hour expiry
    const token = jwt.sign(
      { 
        id: user._id,
        role: user.role || "user"
      },
      process.env.JWT_SECRET,
      { expiresIn: "24h" }
    );

    return res.json({ token });

  } catch (error) {
    console.error("Login error:", error);
    return sendError(res, 500, ErrorCodes.SERVER_ERROR, 
      "Server error", 
      process.env.NODE_ENV === "development" ? error.message : undefined);
  }
});

// Get current logged-in user
router.get("/me", authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.userId).select("-password");
    if (!user) {
      return sendError(res, 404, ErrorCodes.NOT_FOUND, "User not found");
    }
    res.json(user);
  } catch (err) {
    console.error("Get user error:", err);
    return sendError(res, 500, ErrorCodes.SERVER_ERROR, 
      "Server error", 
      process.env.NODE_ENV === "development" ? err.message : undefined);
  }
});

module.exports = router;
