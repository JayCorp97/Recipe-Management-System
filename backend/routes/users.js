const express = require("express");
const router = express.Router();
const bcrypt = require("bcryptjs");
const User = require("../models/User");
const MealPlan = require("../models/meals");
const authMiddleware = require("../middleware/authMiddleware"); // checks JWT
const { adminOnly } = require("../middleware/roleMiddleware");
const Recipe = require("../models/Recipe");
const Comment = require("../models/Comment");
const Activity = require("../models/Activity");
const { sendError, ErrorCodes } = require("../utils/errorHandler");
const { body, query, param, validationResult } = require("express-validator");
const { logAdminAction } = require("../utils/adminAudit");

const handleValidation = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const errorMessages = errors.array().map((err) => err.msg);
    return sendError(res, 400, ErrorCodes.VALIDATION_ERROR, "Validation failed", errorMessages);
  }
  next();
};

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
// ADMIN: LIST USERS (PAGINATED)
// =========================
router.get(
  "/admin/all",
  authMiddleware,
  adminOnly,
  [
    query("page").optional().isInt({ min: 1 }).withMessage("page must be >= 1"),
    query("limit").optional().isInt({ min: 1, max: 100 }).withMessage("limit must be 1-100"),
    query("search").optional().isString().withMessage("search must be a string"),
    query("role").optional().isIn(["all", "user", "admin"]).withMessage("Invalid role filter"),
    query("status").optional().isIn(["all", "active", "inactive", "suspended", "deleted"]).withMessage("Invalid status filter"),
    handleValidation
  ],
  async (req, res) => {
    try {
      const page = Number(req.query.page || 1);
      const limit = Number(req.query.limit || 10);
      const search = String(req.query.search || "").trim();
      const role = req.query.role || "all";
      const status = req.query.status || "all";

      const filter = {};
      if (role !== "all") filter.role = role;
      if (status === "active") {
        filter.active = 1;
        filter.deletedAt = null;
      }
      if (status === "inactive" || status === "suspended") {
        filter.active = 0;
        filter.deletedAt = null;
      }
      if (status === "deleted") {
        filter.deletedAt = { $ne: null };
      }
      if (search) {
        filter.$or = [
          { f_name: { $regex: new RegExp(search, "i") } },
          { l_name: { $regex: new RegExp(search, "i") } },
          { email: { $regex: new RegExp(search, "i") } }
        ];
      }

      const total = await User.countDocuments(filter);
      const users = await User.find(filter)
        .select("-password")
        .sort({ created_date: -1 })
        .skip((page - 1) * limit)
        .limit(limit);

      res.json({
        users,
        page,
        limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / limit))
      });
    } catch (err) {
      console.error("Admin list users error:", err);
      return sendError(res, 500, ErrorCodes.SERVER_ERROR, "Server error");
    }
  }
);

// =========================
// ADMIN: UPDATE USER STATUS
// =========================
router.put(
  "/admin/:id/status",
  authMiddleware,
  adminOnly,
  [
    param("id").isMongoId().withMessage("Invalid user id"),
    body("active").isBoolean().withMessage("active must be boolean"),
    handleValidation
  ],
  async (req, res) => {
    try {
      if (String(req.userId) === String(req.params.id)) {
        return sendError(res, 400, ErrorCodes.VALIDATION_ERROR, "Cannot change your own status");
      }

      const user = await User.findById(req.params.id);
      if (!user) return sendError(res, 404, ErrorCodes.NOT_FOUND, "User not found");

      if (user.role === "admin") {
        return sendError(res, 403, ErrorCodes.FORBIDDEN, "Cannot change status of another admin");
      }

      if (user.deletedAt) {
        return sendError(res, 409, ErrorCodes.VALIDATION_ERROR, "Cannot activate a deleted user");
      }

      user.active = req.body.active ? 1 : 0;
      await user.save();

      await logAdminAction({
        actorId: req.userId,
        action: user.active === 1 ? "USER_ACTIVATED" : "USER_DEACTIVATED",
        targetType: "User",
        targetId: user._id,
        details: { active: user.active }
      });

      return res.json({
        message: `User ${user.active === 1 ? "activated" : "deactivated"}`,
        user: { id: user._id, active: user.active }
      });
    } catch (err) {
      console.error("Admin update status error:", err);
      return sendError(res, 500, ErrorCodes.SERVER_ERROR, "Server error");
    }
  }
);

// =========================
// ADMIN: DELETE USER (SOFT/HARD)
// =========================
router.delete(
  "/admin/:id",
  authMiddleware,
  adminOnly,
  [param("id").isMongoId().withMessage("Invalid user id"), handleValidation],
  async (req, res) => {
    try {
      if (String(req.userId) === String(req.params.id)) {
        return sendError(res, 400, ErrorCodes.VALIDATION_ERROR, "Cannot delete your own account");
      }

      const hardDelete = String(req.query.hard || "false") === "true";
      const user = await User.findById(req.params.id);
      if (!user) return sendError(res, 404, ErrorCodes.NOT_FOUND, "User not found");

      if (user.role === "admin") {
        return sendError(res, 403, ErrorCodes.FORBIDDEN, "Cannot delete another admin");
      }

      if (hardDelete) {
        const hasRecipes = await Recipe.exists({ userId: user._id, deletedAt: null });
        const hasComments = await Comment.exists({ userId: user._id });
        const hasActivities = await Activity.exists({ userId: user._id });
        const hasMealPlan = await MealPlan.exists({ user: user._id });

        if (hasRecipes || hasComments || hasActivities || hasMealPlan) {
          return sendError(
            res,
            409,
            ErrorCodes.VALIDATION_ERROR,
            "Cannot hard delete user with existing data"
          );
        }

        await User.deleteOne({ _id: user._id });
        await logAdminAction({
          actorId: req.userId,
          action: "USER_HARD_DELETED",
          targetType: "User",
          targetId: user._id
        });
        return res.json({ message: "User permanently deleted" });
      }

      if (user.deletedAt) {
        return sendError(res, 409, ErrorCodes.VALIDATION_ERROR, "User already deleted");
      }

      user.deletedAt = new Date();
      user.deletedBy = req.userId;
      user.active = 0;
      await user.save();

      await logAdminAction({
        actorId: req.userId,
        action: "USER_SOFT_DELETED",
        targetType: "User",
        targetId: user._id
      });

      return res.json({ message: "User soft deleted" });
    } catch (err) {
      console.error("Admin delete user error:", err);
      return sendError(res, 500, ErrorCodes.SERVER_ERROR, "Server error");
    }
  }
);

// =========================
// ADMIN: BULK UPDATE STATUS
// =========================
router.post(
  "/admin/bulk-status",
  authMiddleware,
  adminOnly,
  [
    body("ids").isArray({ min: 1 }).withMessage("ids array is required"),
    body("active").isBoolean().withMessage("active must be boolean"),
    handleValidation
  ],
  async (req, res) => {
    try {
      const ids = req.body.ids.map(String);
      const makeActive = req.body.active === true;

      const users = await User.find({ _id: { $in: ids } });
      const updated = [];
      const skipped = [];

      for (const user of users) {
        if (String(user._id) === String(req.userId)) {
          skipped.push({ id: user._id, reason: "self_protection" });
          continue;
        }
        if (user.role === "admin") {
          skipped.push({ id: user._id, reason: "admin_protection" });
          continue;
        }
        if (user.deletedAt) {
          skipped.push({ id: user._id, reason: "deleted_user" });
          continue;
        }
        user.active = makeActive ? 1 : 0;
        await user.save();
        updated.push(user._id);

        await logAdminAction({
          actorId: req.userId,
          action: makeActive ? "USER_ACTIVATED" : "USER_DEACTIVATED",
          targetType: "User",
          targetId: user._id,
          details: { active: user.active }
        });
      }

      return res.json({
        message: `Bulk status update completed`,
        updatedCount: updated.length,
        skippedCount: skipped.length,
        updated,
        skipped
      });
    } catch (err) {
      console.error("Admin bulk status error:", err);
      return sendError(res, 500, ErrorCodes.SERVER_ERROR, "Server error");
    }
  }
);

// =========================
// ADMIN: BULK DELETE (SOFT/HARD)
// =========================
router.post(
  "/admin/bulk-delete",
  authMiddleware,
  adminOnly,
  [
    body("ids").isArray({ min: 1 }).withMessage("ids array is required"),
    body("hard").optional().isBoolean().withMessage("hard must be boolean"),
    handleValidation
  ],
  async (req, res) => {
    try {
      const ids = req.body.ids.map(String);
      const hardDelete = req.body.hard === true;
      const users = await User.find({ _id: { $in: ids } });

      const deleted = [];
      const skipped = [];

      for (const user of users) {
        if (String(user._id) === String(req.userId)) {
          skipped.push({ id: user._id, reason: "self_protection" });
          continue;
        }
        if (user.role === "admin") {
          skipped.push({ id: user._id, reason: "admin_protection" });
          continue;
        }

        if (hardDelete) {
          const hasRecipes = await Recipe.exists({ userId: user._id, deletedAt: null });
          const hasComments = await Comment.exists({ userId: user._id });
          const hasActivities = await Activity.exists({ userId: user._id });
          const hasMealPlan = await MealPlan.exists({ user: user._id });

          if (hasRecipes || hasComments || hasActivities || hasMealPlan) {
            skipped.push({ id: user._id, reason: "has_data" });
            continue;
          }

          await User.deleteOne({ _id: user._id });
          deleted.push(user._id);
          await logAdminAction({
            actorId: req.userId,
            action: "USER_HARD_DELETED",
            targetType: "User",
            targetId: user._id
          });
        } else {
          if (user.deletedAt) {
            skipped.push({ id: user._id, reason: "already_deleted" });
            continue;
          }
          user.deletedAt = new Date();
          user.deletedBy = req.userId;
          user.active = 0;
          await user.save();
          deleted.push(user._id);
          await logAdminAction({
            actorId: req.userId,
            action: "USER_SOFT_DELETED",
            targetType: "User",
            targetId: user._id
          });
        }
      }

      return res.json({
        message: "Bulk delete completed",
        deletedCount: deleted.length,
        skippedCount: skipped.length,
        deleted,
        skipped
      });
    } catch (err) {
      console.error("Admin bulk delete error:", err);
      return sendError(res, 500, ErrorCodes.SERVER_ERROR, "Server error");
    }
  }
);




module.exports = router;
