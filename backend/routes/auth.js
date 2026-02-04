//routes/auth.js

const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const authMiddleware = require("../middleware/authMiddleware");
const { userOrAdmin, adminOnly } = require("../middleware/roleMiddleware");
const authLimiter = require("../middleware/rateLimiter");
const { validateRegister, validateLogin } = require("../middleware/validation");
const { sendError, ErrorCodes } = require("../utils/errorHandler");
const crypto = require("crypto");

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
    // Check if JWT_SECRET is configured
    if (!process.env.JWT_SECRET) {
      console.error("JWT_SECRET is not defined in environment variables");
      return sendError(res, 500, ErrorCodes.SERVER_ERROR, 
        "Server configuration error", 
        "JWT_SECRET is missing");
    }

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
    console.error("Error stack:", error.stack);
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

    // Deleted user check
    if (user.deletedAt) {
      return sendError(res, 403, ErrorCodes.FORBIDDEN,
        "Account has been deleted");
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

/**
 * @route   POST /api/auth/admin/login
 * @desc    Admin login
 */
router.post("/admin/login", authLimiter, validateLogin, async (req, res) => {
  try {
    const { email, password } = req.body;

    const normalizedEmail = email.toLowerCase().trim();
    const user = await User.findOne({ email: normalizedEmail });
    if (!user) {
      return sendError(res, 401, ErrorCodes.AUTH_ERROR,
        "Invalid email or password");
    }

    if (user.deletedAt) {
      return sendError(res, 403, ErrorCodes.FORBIDDEN,
        "Account has been deleted");
    }

    if (user.active !== 1) {
      return sendError(res, 403, ErrorCodes.FORBIDDEN,
        "Account is inactive");
    }

    if (user.role !== "admin") {
      return sendError(res, 403, ErrorCodes.FORBIDDEN,
        "Admin access required");
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return sendError(res, 401, ErrorCodes.AUTH_ERROR,
        "Invalid email or password");
    }

    const token = jwt.sign(
      {
        id: user._id,
        role: user.role || "admin"
      },
      process.env.JWT_SECRET,
      { expiresIn: "24h" }
    );

    return res.json({ token });
  } catch (error) {
    console.error("Admin login error:", error);
    return sendError(res, 500, ErrorCodes.SERVER_ERROR,
      "Server error",
      process.env.NODE_ENV === "development" ? error.message : undefined);
  }
});


/**
 * REQUEST OTP LOGIN
 * POST /api/auth/request-otp
 */
router.post("/request-otp", authLimiter, async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) {
      return sendError(res, 400, ErrorCodes.VALIDATION_ERROR, "Email is required");
    }

    const normalizedEmail = email.toLowerCase().trim();
    const user = await User.findOne({ email: normalizedEmail });

    if (!user) {
      return sendError(res, 404, ErrorCodes.NOT_FOUND, "User not found");
    }

    if (user.deletedAt) {
      return sendError(res, 403, ErrorCodes.FORBIDDEN, "Account has been deleted");
    }

    if (user.active !== 1) {
      return sendError(res, 403, ErrorCodes.FORBIDDEN, "Account is inactive");
    }

    const otp = crypto.randomInt(100000, 999999).toString();

    user.otp = otp;
    user.otpExpires = Date.now() + 5 * 60 * 1000; // 5 minutes
    await user.save();

    // TEMP: log OTP (replace with email/SMS later)
    console.log(`OTP for ${normalizedEmail}:`, otp);

    return res.json({ message: "OTP sent successfully" });

  } catch (error) {
    console.error("Request OTP error:", error);
    return sendError(res, 500, ErrorCodes.SERVER_ERROR, "Server error");
  }
});

/**
 * VERIFY OTP & LOGIN
 * POST /api/auth/verify-otp
 */
router.post("/verify-otp", authLimiter, async (req, res) => {
  try {
    const { email, otp } = req.body;

    if (!email || !otp) {
      return sendError(
        res,
        400,
        ErrorCodes.VALIDATION_ERROR,
        "Email and OTP are required"
      );
    }

    const normalizedEmail = email.toLowerCase().trim();
    const user = await User.findOne({ email: normalizedEmail });

    if (!user) {
      return sendError(res, 404, ErrorCodes.NOT_FOUND, "User not found");
    }

    if (
      user.otp !== otp ||
      !user.otpExpires ||
      user.otpExpires < Date.now()
    ) {
      return sendError(res, 401, ErrorCodes.AUTH_ERROR, "Invalid or expired OTP");
    }

    // Clear OTP after use
    user.otp = null;
    user.otpExpires = null;
    await user.save();

    // Generate JWT (same as password login)
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
    console.error("Verify OTP error:", error);
    return sendError(res, 500, ErrorCodes.SERVER_ERROR, "Server error");
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

/**
 * @route   GET /api/auth/admin/me
 * @desc    Get current admin user info
 * @access  Private - Admin only (US4-T.9: Admin route protection middleware)
 */
router.get("/admin/me", authMiddleware, adminOnly, async (req, res) => {
  try {
    const user = await User.findById(req.userId).select("-password");
    if (!user) {
      return sendError(res, 404, ErrorCodes.NOT_FOUND, "User not found");
    }
    // Double-check role (defense in depth)
    if (user.role !== "admin") {
      return sendError(res, 403, ErrorCodes.FORBIDDEN, 
        "Admin access required");
    }
    res.json(user);
  } catch (err) {
    console.error("Get admin user error:", err);
    return sendError(res, 500, ErrorCodes.SERVER_ERROR, 
      "Server error", 
      process.env.NODE_ENV === "development" ? err.message : undefined);
  }
});

//user ifo
// Get current logged-in user
// GET user by ID (public info)
router.get("/public/:id", authMiddleware, async (req, res) => {
  try {
    const userId = req.params.id;

    // Fetch user by ID, exclude sensitive fields
    const user = await User.findById(userId).select("name avatar email"); 
    // Only return safe fields: name, avatar, email optional

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    res.json({ user });
  } catch (err) {
    console.error("Get user error:", err);
    res.status(500).json({ message: "Server error" });
  }
});



/**
 * @route   POST /api/auth/logout
 * @desc    Logout user
 * @access  Private - requires valid user or admin role
 */
router.post("/logout", authMiddleware, userOrAdmin, async (req, res) => {
  try {
    // Log logout event (optional - for auditing)
    console.log(`User ${req.userId} (role: ${req.userRole}) logged out`);
    
    // Note: With stateless JWT, we can't invalidate the token server-side
    // without implementing a token blacklist. The client should remove
    // the token from localStorage after receiving this response.
    
    return res.json({ 
      message: "Logged out successfully" 
    });
  } catch (error) {
    console.error("Logout error:", error);
    return sendError(res, 500, ErrorCodes.SERVER_ERROR, 
      "Server error", 
      process.env.NODE_ENV === "development" ? error.message : undefined);
  }
});


module.exports = router;
