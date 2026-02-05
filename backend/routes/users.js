const express = require("express");
const router = express.Router();
const bcrypt = require("bcryptjs");
const User = require("../models/User");
const MealPlan = require("../models/Meals");
const authMiddleware = require("../middleware/authMiddleware"); // checks JWT
const { verifyOtp } = require('../utils/otpUtils');

// =========================
// GET CURRENT USER INFO
// =========================
router.get("/me", authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.userId).select("-password"); // exclude password
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    res.json(user);
  } catch (err) {
    console.error("Get user error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// =========================
// UPDATE PROFILE (name, email)
// =========================
router.put("/profile", authMiddleware, async (req, res) => {
  try {
    const { f_name, l_name, email } = req.body;

    if (!f_name || !l_name || !email) {
      return res.status(400).json({ message: "All fields are required" });
    }

    // Check if email is already used by another user
    const existingUser = await User.findOne({ email, _id: { $ne: req.userId } });
    if (existingUser) {
      return res.status(400).json({ message: "Email is already in use" });
    }

    const user = await User.findById(req.userId);
    if (!user) return res.status(404).json({ message: "User not found" });

    user.f_name = f_name;
    user.l_name = l_name;
    user.email = email;

    await user.save();

    res.json({ message: "Profile updated successfully", user: user });
  } catch (err) {
    console.error("Update profile error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// =========================
// CHANGE PASSWORD
// =========================
router.put("/password", authMiddleware, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ message: "All password fields are required" });
    }

    const user = await User.findById(req.userId);
    if (!user) return res.status(404).json({ message: "User not found" });

    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) return res.status(401).json({ message: "Current password is incorrect" });

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    user.password = hashedPassword;

    await user.save();

    res.json({ message: "Password changed successfully" });
  } catch (err) {
    console.error("Change password error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// =========================
// SAVE PREFERENCES
// =========================
router.put("/preferences", authMiddleware, async (req, res) => {
  try {
    const { darkMode, emailNotifications } = req.body;

    const user = await User.findById(req.userId);
    if (!user) return res.status(404).json({ message: "User not found" });

    user.preferences = user.preferences || {};
    user.preferences.darkMode = !!darkMode;
    user.preferences.emailNotifications = !!emailNotifications;

    user.mode = darkMode ? "true" : "false";

    await user.save();

    res.json({ message: "Preferences saved successfully" });
  } catch (err) {
    console.error("Save preferences error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// =========================
// PUBLIC USER INFO (optional)
// =========================
router.get("/public/:id", async (req, res) => {
  try {
    const userId = req.params.id;
    const user = await User.findById(userId).select("f_name l_name role");

    if (!user) return res.status(404).json({ message: "User not found" });

    res.json({
      user: {
        id: user._id,
        name: `${user.f_name} ${user.l_name}`,
        role: user.role,
        avatarUrl: "images/chef.png" // default avatar
      }
    });
  } catch (err) {
    console.error("Get public user error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// =========================
// SAVE MEAL PLAN
// =========================
router.put("/meals", authMiddleware, async (req, res) => {
  try {
    const { meals } = req.body;

    // find existing meal plan for user
    let plan = await MealPlan.findOne({ user: req.userId });

    if (!plan) {
      plan = new MealPlan({ user: req.userId, meals });
    } else {
      plan.meals = meals;
    }

    await plan.save();
    res.json({ message: "Meal plan saved successfully", plan });
  } catch (err) {
    console.error("Save meal plan error:", err);
    res.status(500).json({ message: "Server error" });
  }
});


// =========================
// FORGOT PASSWORD - VERIFY EMAIL & SEND OTP
// =========================
const { generateOtp } = require("../utils/otpUtils");

// POST /api/users/verify-email
router.post("/verify-email", async (req, res) => {
  try {
    const { email } = req.body;

    // 1Validate input
    if (!email) {
      return res.status(400).json({ message: "Email is required" });
    }

    // Check if user exists
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ message: "Email not found" });
    }

    // Generate OTP using utility function
    const { otp, hashedOtp, expiresAt } = await generateOtp();

    // Save hashed OTP and expiry to user
    user.otp = hashedOtp;
    user.otpExpires = expiresAt;
    await user.save();

    // Send OTP via email service (TODO)
    console.log(`Password Reset OTP for ${email}: ${otp} (expires at ${expiresAt})`);

    // Respond to frontend
    res.json({ message: "Email verified. OTP sent successfully." });

  } catch (err) {
    console.error("Forgot password email verify error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;



// =========================
// OTP verification route
// =========================

router.post("/verify-otp", async (req, res) => {
  try {
    const { email, otp, newPassword } = req.body;
    if (!email || !otp || !newPassword) {
      return res.status(400).json({ message: "Email, OTP, and new password are required" });
    }

    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ message: "User not found" });

    const isValid = await verifyOtp(otp, user.otp, user.otpExpires);
    if (!isValid) return res.status(400).json({ message: "Invalid or expired OTP" });

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    user.password = hashedPassword;
    user.otp = undefined;
    user.otpExpires = undefined;
    await user.save();

    res.json({ message: "Password reset successfully" });

  } catch (err) {
    console.error("Verify OTP error:", err);
    res.status(500).json({ message: "Server error" }); // <-- always JSON
  }
});



module.exports = router;
