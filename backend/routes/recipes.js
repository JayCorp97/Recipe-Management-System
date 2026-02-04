const express = require("express");
const path = require("path");
const multer = require("multer");
const mongoose = require("mongoose");

const Recipe = require("../models/Recipe");
const Activity = require("../models/Activity");
const User = require("../models/User");
const auth = require("../middleware/authMiddleware");
const { userOrAdmin, adminOnly } = require("../middleware/roleMiddleware");
const { emitActivity } = require("../src/socket");
const { logAdminAction } = require("../utils/adminAudit");

const router = express.Router();

/* ===========================
   Helpers
=========================== */

// Trim and normalize string safely
const safeTrim = (val, fallback = "") =>
  val != null ? String(val).trim() : fallback;

// Parse a number safely
const parseNumber = (val, fallback = 0) =>
  Number.isFinite(Number(val)) ? Number(val) : fallback;

// Normalize array of strings (filter empty/null)
const filterStringArray = (arr, toLower = false) =>
  Array.isArray(arr)
    ? arr
        .filter((v) => v != null)
        .map((v) => (toLower ? String(v).trim().toLowerCase() : String(v).trim()))
        .filter((v) => v.length > 0)
    : [];

// Convert userId to ObjectId safely
const toObjectId = (id) =>
  mongoose.Types.ObjectId.isValid(id) ? new mongoose.Types.ObjectId(id) : id;

// Log activity safely
const logActivity = async ({ userId, action, recipe }) => {
  try {
    const user = await User.findById(toObjectId(userId));
    if (!user) return;

    const userName = `${user.f_name} ${user.l_name}`.trim();
    const activity = await Activity.create({
      userId: toObjectId(userId),
      userName,
      action,
      recipeId: recipe._id,
      recipeTitle: safeTrim(recipe.title),
    });

    emitActivity({
      _id: activity._id,
      userName,
      action,
      recipeTitle: safeTrim(recipe.title),
      createdAt: activity.createdAt,
    });
  } catch (err) {
    console.error(`Activity log failed for ${action}:`, err.message);
  }
};

/* ===========================
   Multer config
=========================== */
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, path.join(__dirname, "../uploads")),
  filename: (req, file, cb) => {
    const safe = `${Date.now()}-${file.originalname.replace(/\s+/g, "-")}`;
    cb(null, safe);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ok = ["image/jpeg", "image/png", "image/webp", "image/gif"].includes(file.mimetype);
    cb(ok ? null : new Error("Only image files are allowed"), ok);
  },
});

/* ===========================
   Routes
=========================== */

/** Create recipe */
router.post("/", auth, userOrAdmin, upload.single("image"), async (req, res) => {
  try {
    const title = safeTrim(req.body.title);
    const desc = safeTrim(req.body.description);

    if (!title || !desc) return res.status(400).json({ message: "Title and description are required." });

    // Check duplicate (own recipes)
    const normalizedTitle = title.toLowerCase();
    const existing = await Recipe.findOne({
      userId: req.userId,
      deletedAt: null,
      title: { $regex: new RegExp(`^${normalizedTitle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "i") },
    });

    if (existing) {
      return res.status(409).json({
        message: `You already have a recipe titled "${existing.title}"`,
        duplicate: true,
        existingTitle: existing.title,
      });
    }

    const recipe = await Recipe.create({
      userId: req.userId,
      title,
      desc,
      category: safeTrim(req.body.category, "Uncategorised"),
      rating: parseNumber(req.body.rating),
      imageUrl: req.file ? `/uploads/${req.file.filename}` : safeTrim(req.body.imageUrl),
      ingredients: filterStringArray(req.body.ingredients),
      instructions: filterStringArray(req.body.instructions),
      dietary: filterStringArray(req.body.dietary),
      tags: filterStringArray(req.body.tags, true),
      difficulty: ["Easy", "Medium", "Hard"].includes(req.body.difficulty) ? req.body.difficulty : "Medium",
      notes: safeTrim(req.body.notes),
      cookingTime: parseNumber(req.body.cookingTime),
      prepTime: parseNumber(req.body.prepTime),
      servings: parseNumber(req.body.servings),
    });

    await logActivity({ userId: req.userId, action: "created", recipe });

    return res.status(201).json({ message: "Recipe saved", recipe });
  } catch (err) {
    console.error("Create recipe error:", err);
    return res.status(500).json({ message: "Server error", error: err.message });
  }
});

/** List all recipes (public) */
router.get("/", async (req, res) => {
  try {
    const recipes = await Recipe.find({ deletedAt: null }).sort({ createdAt: -1 });
    return res.json({ recipes });
  } catch (err) {
    console.error("List recipes error:", err);
    return res.status(500).json({ message: "Server error", error: err.message });
  }
});

/** List current user's recipes */
router.get("/mine", auth, userOrAdmin, async (req, res) => {
  try {
    const recipes = await Recipe.find({ userId: req.userId, deletedAt: null }).sort({ createdAt: -1 });
    return res.json({ recipes });
  } catch (err) {
    console.error("User recipes error:", err);
    return res.status(500).json({ message: "Server error", error: err.message });
  }
});

/** Bulk soft-delete */
router.post("/bulk-delete", auth, userOrAdmin, async (req, res) => {
  try {
    const ids = Array.isArray(req.body.ids) ? req.body.ids : [];
    if (!ids.length) return res.status(400).json({ message: "ids array required" });

    const isAdmin = req.userRole === "admin";
    const now = new Date();
    const deletedIds = [];

    for (const id of ids) {
      const recipe = await Recipe.findById(id);
      if (!recipe || recipe.deletedAt) continue;
      if (!isAdmin && String(recipe.userId) !== String(req.userId)) continue;

      recipe.deletedAt = now;
      await recipe.save();
      deletedIds.push(recipe._id);

      await logActivity({ userId: req.userId, action: "deleted", recipe });
    }

    return res.json({ message: "Bulk delete completed", deleted: deletedIds.length, deletedIds });
  } catch (err) {
    console.error("Bulk delete error:", err);
    return res.status(500).json({ message: "Server error", error: err.message });
  }
});

/** Bulk restore */
router.post("/bulk-restore", auth, userOrAdmin, async (req, res) => {
  try {
    const ids = Array.isArray(req.body.ids) ? req.body.ids : [];
    if (!ids.length) return res.status(400).json({ message: "ids array required" });

    const isAdmin = req.userRole === "admin";
    const restoredIds = [];

    for (const id of ids) {
      const recipe = await Recipe.findById(id);
      if (!recipe || !recipe.deletedAt) continue;
      if (!isAdmin && String(recipe.userId) !== String(req.userId)) continue;

      recipe.deletedAt = null;
      await recipe.save();
      restoredIds.push(recipe._id);
    }

    return res.json({ message: "Bulk restore completed", restored: restoredIds.length, restoredIds });
  } catch (err) {
    console.error("Bulk restore error:", err);
    return res.status(500).json({ message: "Server error", error: err.message });
  }
});

/** Trash list */
router.get("/trash", auth, userOrAdmin, async (req, res) => {
  try {
    const filter =
      req.userRole === "admin"
        ? { deletedAt: { $ne: null } }
        : { userId: req.userId, deletedAt: { $ne: null } };

    const recipes = await Recipe.find(filter).sort({ deletedAt: -1 });
    return res.json({ recipes });
  } catch (err) {
    console.error("Trash list error:", err);
    return res.status(500).json({ message: "Server error", error: err.message });
  }
});

/** Restore single recipe */
router.post("/:id/restore", auth, userOrAdmin, async (req, res) => {
  try {
    const recipe = await Recipe.findById(req.params.id);
    if (!recipe || !recipe.deletedAt) return res.status(404).json({ message: "Recipe not in trash" });

    const isOwner = String(recipe.userId) === String(req.userId);
    if (!isOwner && req.userRole !== "admin") return res.status(403).json({ message: "Not allowed" });

    recipe.deletedAt = null;
    await recipe.save();
    return res.json({ message: "Recipe restored", recipe });
  } catch (err) {
    console.error("Restore recipe error:", err);
    return res.status(500).json({ message: "Server error", error: err.message });
  }
});

/** Get single recipe */
router.get("/:id", auth, async (req, res) => {
  try {
    const recipe = await Recipe.findById(req.params.id);
    if (!recipe || recipe.deletedAt) return res.status(404).json({ message: "Recipe not found" });
    if (String(recipe.userId) !== String(req.userId)) return res.status(403).json({ message: "Not allowed" });
    return res.json({ recipe });
  } catch (err) {
    console.error("Get recipe error:", err);
    return res.status(500).json({ message: "Server error", error: err.message });
  }
});

/* ===========================
   Update, Delete, Admin routes
=========================== */

/** Update recipe */
router.put("/:id", auth, userOrAdmin, upload.single("image"), async (req, res) => {
  try {
    const recipe = await Recipe.findById(req.params.id);
    if (!recipe || recipe.deletedAt) return res.status(404).json({ message: "Recipe not found" });
    if (String(recipe.userId) !== String(req.userId)) return res.status(403).json({ message: "Not allowed" });

    const title = safeTrim(req.body.title, recipe.title);
    const description = safeTrim(req.body.description, recipe.desc);

    // Duplicate check
    const existing = await Recipe.findOne({
      userId: req.userId,
      _id: { $ne: recipe._id },
      deletedAt: null,
      title: { $regex: new RegExp(`^${title.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "i") },
    });
    if (existing) return res.status(409).json({ message: `Duplicate title: ${existing.title}` });

    Object.assign(recipe, {
      title,
      desc: description,
      category: safeTrim(req.body.category, recipe.category || "Uncategorised"),
      rating: parseNumber(req.body.rating, recipe.rating),
      imageUrl: req.file ? `/uploads/${req.file.filename}` : safeTrim(req.body.imageUrl, recipe.imageUrl),
      ingredients: filterStringArray(req.body.ingredients) || recipe.ingredients,
      instructions: filterStringArray(req.body.instructions) || recipe.instructions,
      dietary: filterStringArray(req.body.dietary) || recipe.dietary,
      tags: filterStringArray(req.body.tags, true) || recipe.tags,
      difficulty: ["Easy", "Medium", "Hard"].includes(req.body.difficulty) ? req.body.difficulty : recipe.difficulty || "Medium",
      notes: safeTrim(req.body.notes, recipe.notes || ""),
      cookingTime: parseNumber(req.body.cookingTime, recipe.cookingTime),
      prepTime: parseNumber(req.body.prepTime, recipe.prepTime),
      servings: parseNumber(req.body.servings, recipe.servings),
    });

    await recipe.save();
    await logActivity({ userId: req.userId, action: "updated", recipe });
    return res.json({ message: "Recipe updated", recipe });
  } catch (err) {
    console.error("Update recipe error:", err);
    return res.status(500).json({ message: "Server error", error: err.message });
  }
});

/** Delete recipe (owner) */
router.delete("/:id", auth, userOrAdmin, async (req, res) => {
  try {
    const recipe = await Recipe.findById(req.params.id);
    if (!recipe) return res.status(404).json({ message: "Recipe not found" });
    if (String(recipe.userId) !== String(req.userId)) return res.status(403).json({ message: "Not allowed" });

    await Recipe.deleteOne({ _id: recipe._id });
    await logActivity({ userId: req.userId, action: "deleted", recipe });
    return res.json({ message: "Recipe deleted" });
  } catch (err) {
    console.error("Delete recipe error:", err);
    return res.status(500).json({ message: "Server error", error: err.message });
  }
});

/** Admin: get all recipes with pagination & filters */
router.get("/admin/all", auth, adminOnly, async (req, res) => {
  try {
    const page = Number(req.query.page || 1);
    const limit = Math.min(Number(req.query.limit || 10), 100);
    const search = safeTrim(req.query.search);
    const category = safeTrim(req.query.category);
    const userId = safeTrim(req.query.userId);
    const status = safeTrim(req.query.status, "active"); // active | deleted | all

    if (!Number.isInteger(page) || page < 1) {
      return res.status(400).json({ message: "Invalid page value" });
    }
    if (!Number.isInteger(limit) || limit < 1) {
      return res.status(400).json({ message: "Invalid limit value" });
    }

    const filter = {};
    if (status === "active") filter.deletedAt = null;
    if (status === "deleted") filter.deletedAt = { $ne: null };
    if (status === "all") filter.deletedAt = { $exists: true };

    if (search) {
      filter.$or = [
        { title: { $regex: new RegExp(search, "i") } },
        { desc: { $regex: new RegExp(search, "i") } },
        { category: { $regex: new RegExp(search, "i") } },
        { tags: { $elemMatch: { $regex: new RegExp(search, "i") } } }
      ];
    }

    if (category) {
      filter.category = { $regex: new RegExp(`^${category}$`, "i") };
    }

    if (userId) {
      filter.userId = toObjectId(userId);
    }

    const total = await Recipe.countDocuments(filter);
    const recipes = await Recipe.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit);

    return res.json({
      recipes,
      page,
      limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / limit))
    });
  } catch (err) {
    console.error("Admin get all error:", err);
    return res.status(500).json({ message: "Server error", error: err.message });
  }
});

/** Admin: delete any recipe */
router.delete("/admin/:id", auth, adminOnly, async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ message: "Invalid recipe id" });
    }

    const recipe = await Recipe.findById(req.params.id);
    if (!recipe) return res.status(404).json({ message: "Recipe not found" });

    const mode = String(req.query.mode || "hard");
    if (mode === "soft") {
      recipe.deletedAt = new Date();
      recipe.deletedBy = req.userId;
      await recipe.save();
      await logAdminAction({
        actorId: req.userId,
        action: "RECIPE_SOFT_DELETED",
        targetType: "Recipe",
        targetId: recipe._id
      });
      return res.json({ message: "Recipe soft deleted by admin" });
    }

    await Recipe.deleteOne({ _id: recipe._id });
    await logActivity({ userId: req.userId, action: "deleted", recipe });
    await logAdminAction({
      actorId: req.userId,
      action: "RECIPE_HARD_DELETED",
      targetType: "Recipe",
      targetId: recipe._id
    });
    return res.json({ message: "Recipe deleted by admin" });
  } catch (err) {
    console.error("Admin delete error:", err);
    return res.status(500).json({ message: "Server error", error: err.message });
  }
});

/** Admin: bulk delete recipes (soft/hard) */
router.post("/admin/bulk-delete", auth, adminOnly, async (req, res) => {
  try {
    const ids = Array.isArray(req.body.ids) ? req.body.ids : [];
    if (!ids.length) return res.status(400).json({ message: "ids array required" });

    const mode = String(req.body.mode || "hard");
    const deleted = [];
    const skipped = [];

    for (const id of ids) {
      if (!mongoose.Types.ObjectId.isValid(id)) {
        skipped.push({ id, reason: "invalid_id" });
        continue;
      }
      const recipe = await Recipe.findById(id);
      if (!recipe) {
        skipped.push({ id, reason: "not_found" });
        continue;
      }

      if (mode === "soft") {
        if (recipe.deletedAt) {
          skipped.push({ id, reason: "already_deleted" });
          continue;
        }
        recipe.deletedAt = new Date();
        recipe.deletedBy = req.userId;
        await recipe.save();
        deleted.push(recipe._id);
        await logAdminAction({
          actorId: req.userId,
          action: "RECIPE_SOFT_DELETED",
          targetType: "Recipe",
          targetId: recipe._id
        });
        continue;
      }

      await Recipe.deleteOne({ _id: recipe._id });
      deleted.push(recipe._id);
      await logAdminAction({
        actorId: req.userId,
        action: "RECIPE_HARD_DELETED",
        targetType: "Recipe",
        targetId: recipe._id
      });
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
    return res.status(500).json({ message: "Server error", error: err.message });
  }
});

module.exports = router;
