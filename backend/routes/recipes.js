const express = require("express");
const path = require("path");
const multer = require("multer");
const mongoose = require("mongoose");

const Recipe = require("../models/Recipe");
const Activity = require("../models/Activity");
const User = require("../models/User");
const auth = require("../middleware/authMiddleware");
const { userOrAdmin, adminOnly } = require("../middleware/roleMiddleware");

const router = express.Router();

// Multer (file upload) config
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, path.join(__dirname, "../uploads")),
  filename: (req, file, cb) => {
    const safe = Date.now() + "-" + file.originalname.replace(/\s+/g, "-");
    cb(null, safe);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (req, file, cb) => {
    const ok = ["image/jpeg", "image/png", "image/webp", "image/gif"].includes(file.mimetype);
    cb(ok ? null : new Error("Only image files are allowed"), ok);
  },
});

// POST /api/recipes (create) - protected + role-based access + optional image upload
router.post("/", auth, userOrAdmin, upload.single("image"), async (req, res) => {
  try {
    const { title, category, description, rating } = req.body;

    if (!title || !String(title).trim()) {
      return res.status(400).json({ message: "Recipe title is required." });
    }

    // Schema requires `desc`
    const desc = description ? String(description).trim() : "";
    if (!desc) {
      return res.status(400).json({ message: "Recipe description is required." });
    }

    // Check for duplicate recipe title (case-insensitive) - check user's own recipes
    const normalizedTitle = String(title).trim().toLowerCase();
    const existingRecipe = await Recipe.findOne({
      userId: req.userId,
      title: { $regex: new RegExp(`^${normalizedTitle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, "i") }
    });

    if (existingRecipe) {
      return res.status(409).json({
        message: `You already have a recipe with the title "${existingRecipe.title}". Please use a different title.`,
        duplicate: true,
        existingTitle: existingRecipe.title
      });
    }

    // If a file was uploaded, use it; otherwise allow an imageUrl string from body
    const finalImageUrl = req.file
      ? `/uploads/${req.file.filename}`
      : (req.body.imageUrl || "").trim();

    // Process new fields
    const ingredients = Array.isArray(req.body.ingredients) 
      ? req.body.ingredients.map(i => String(i).trim()).filter(i => i.length > 0)
      : [];
    
    const instructions = Array.isArray(req.body.instructions)
      ? req.body.instructions.map(i => String(i).trim()).filter(i => i.length > 0)
      : [];

    const dietary = Array.isArray(req.body.dietary)
      ? req.body.dietary.map(d => String(d).trim()).filter(d => d.length > 0)
      : [];

    const tags = Array.isArray(req.body.tags)
      ? req.body.tags.map(t => String(t).trim().toLowerCase()).filter(t => t.length > 0)
      : [];

    const difficulty = ["Easy", "Medium", "Hard"].includes(req.body.difficulty)
      ? req.body.difficulty
      : "Medium";

    const notes = req.body.notes ? String(req.body.notes).trim() : "";

    const cookingTime = Number.isFinite(Number(req.body.cookingTime)) ? Number(req.body.cookingTime) : 0;
    const prepTime = Number.isFinite(Number(req.body.prepTime)) ? Number(req.body.prepTime) : 0;
    const servings = Number.isFinite(Number(req.body.servings)) ? Number(req.body.servings) : 0;

    const doc = await Recipe.create({
      userId: req.userId,
      title: String(title).trim(),
      desc,
      category: category ? String(category).trim() : "Uncategorised",
      rating: Number.isFinite(Number(rating)) ? Number(rating) : 0,
      imageUrl: finalImageUrl,
      ingredients,
      instructions,
      difficulty,
      dietary,
      tags,
      notes,
      cookingTime,
      prepTime,
      servings,
    });

    // Log activity for recipe creation
    try {
      // Ensure userId is a valid ObjectId
      let userIdObj;
      try {
        userIdObj = mongoose.Types.ObjectId.isValid(req.userId) 
          ? new mongoose.Types.ObjectId(req.userId) 
          : req.userId;
      } catch (e) {
        console.error("Invalid userId format:", req.userId);
        userIdObj = req.userId;
      }

      console.log(`Attempting to log activity for userId: ${req.userId} (${typeof req.userId}), recipeId: ${doc._id}`);
      
      const user = await User.findById(userIdObj);
      if (user) {
        const userName = `${user.f_name} ${user.l_name}`;
        console.log(`Found user: ${userName}, creating activity...`);
        
        const activityData = {
          userId: userIdObj,
          userName: userName.trim(),
          action: "created",
          recipeId: doc._id,
          recipeTitle: String(doc.title).trim(),
        };
        
        console.log("Activity data:", JSON.stringify(activityData, null, 2));
        
        const activity = await Activity.create(activityData);
        console.log(`✅ Activity logged successfully: ${userName} created "${doc.title}" (Activity ID: ${activity._id})`);
      } else {
        console.warn(`❌ User not found for userId: ${req.userId} (searched as: ${userIdObj})`);
        // Try to find user by string ID as fallback
        const userByString = await User.findById(String(req.userId));
        if (userByString) {
          console.log(`Found user using string ID: ${userByString.f_name} ${userByString.l_name}`);
        }
      }
    } catch (activityErr) {
      // Don't fail recipe creation if activity logging fails
      console.error("❌ Failed to log activity:", activityErr);
      console.error("Activity error details:", {
        message: activityErr.message,
        stack: activityErr.stack,
        name: activityErr.name,
        code: activityErr.code
      });
    }

    return res.status(201).json({ message: "Recipe saved", recipe: doc });
  } catch (err) {
    console.error("Save recipe error:", err);
    return res.status(500).json({
      message: "Server error saving recipe",
      error: err?.message,
      name: err?.name,
    });
  }
});

// GET /api/recipes (public list)
router.get("/", async (req, res) => {
  try {
    const recipes = await Recipe.find().sort({ createdAt: -1 });
    return res.json({ recipes });
  } catch (err) {
    console.error("List recipes error:", err);
    return res.status(500).json({
      message: "Server error fetching recipes",
      error: err?.message,
      name: err?.name,
    });
  }
});

// GET /api/recipes/mine (current user's recipes) - protected + role-based access
router.get("/mine", auth, userOrAdmin, async (req, res) => {
  try {
    const recipes = await Recipe.find({ userId: req.userId }).sort({ createdAt: -1 });
    return res.json({ recipes });
  } catch (err) {
    console.error("Mine recipes error:", err);
    return res.status(500).json({
      message: "Failed to load recipes",
      error: err?.message,
      name: err?.name,
    });
  }
});

// GET /api/recipes/:id (get single recipe by ID) - protected + ownership check
router.get("/:id", auth, userOrAdmin, async (req, res) => {
  try {
    const recipe = await Recipe.findById(req.params.id);
    if (!recipe) {
      return res.status(404).json({ message: "Recipe not found" });
    }

    // Check if user owns the recipe or is admin
    if (String(recipe.userId) !== String(req.userId)) {
      // Check if user is admin (you may need to add this check based on your auth middleware)
      return res.status(403).json({ message: "Not allowed to view this recipe" });
    }

    return res.json({ recipe });
  } catch (err) {
    console.error("Get recipe error:", err);
    return res.status(500).json({
      message: "Server error fetching recipe",
      error: err?.message,
      name: err?.name,
    });
  }
});

// PUT /api/recipes/:id (update recipe) - protected + role-based access + ownership check
router.put("/:id", auth, userOrAdmin, upload.single("image"), async (req, res) => {
  try {
    const recipe = await Recipe.findById(req.params.id);
    if (!recipe) {
      return res.status(404).json({ message: "Recipe not found" });
    }

    if (String(recipe.userId) !== String(req.userId)) {
      return res.status(403).json({ message: "Not allowed to update this recipe" });
    }

    const { title, category, description, rating } = req.body;

    if (!title || !String(title).trim()) {
      return res.status(400).json({ message: "Recipe title is required." });
    }

    const desc = description ? String(description).trim() : "";
    if (!desc) {
      return res.status(400).json({ message: "Recipe description is required." });
    }

    // Check for duplicate recipe title (case-insensitive) - exclude current recipe
    const normalizedTitle = String(title).trim().toLowerCase();
    const existingRecipe = await Recipe.findOne({
      userId: req.userId,
      _id: { $ne: req.params.id },
      title: { $regex: new RegExp(`^${normalizedTitle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, "i") }
    });

    if (existingRecipe) {
      return res.status(409).json({
        message: `You already have a recipe with the title "${existingRecipe.title}". Please use a different title.`,
        duplicate: true,
        existingTitle: existingRecipe.title
      });
    }

    // If a file was uploaded, use it; otherwise keep existing imageUrl or use body imageUrl
    const finalImageUrl = req.file
      ? `/uploads/${req.file.filename}`
      : (req.body.imageUrl || recipe.imageUrl || "").trim();

    // Process new fields
    const ingredients = Array.isArray(req.body.ingredients) 
      ? req.body.ingredients.map(i => String(i).trim()).filter(i => i.length > 0)
      : [];
    
    const instructions = Array.isArray(req.body.instructions)
      ? req.body.instructions.map(i => String(i).trim()).filter(i => i.length > 0)
      : [];

    const dietary = Array.isArray(req.body.dietary)
      ? req.body.dietary.map(d => String(d).trim()).filter(d => d.length > 0)
      : [];

    const tags = Array.isArray(req.body.tags)
      ? req.body.tags.map(t => String(t).trim().toLowerCase()).filter(t => t.length > 0)
      : [];

    const difficulty = ["Easy", "Medium", "Hard"].includes(req.body.difficulty)
      ? req.body.difficulty
      : "Medium";

    const notes = req.body.notes ? String(req.body.notes).trim() : "";

    const cookingTime = Number.isFinite(Number(req.body.cookingTime)) ? Number(req.body.cookingTime) : 0;
    const prepTime = Number.isFinite(Number(req.body.prepTime)) ? Number(req.body.prepTime) : 0;
    const servings = Number.isFinite(Number(req.body.servings)) ? Number(req.body.servings) : 0;

    // Update recipe
    recipe.title = String(title).trim();
    recipe.desc = desc;
    recipe.category = category ? String(category).trim() : recipe.category || "Dinner";
    recipe.rating = Number.isFinite(Number(rating)) ? Number(rating) : recipe.rating || 0;
    recipe.imageUrl = finalImageUrl;
    recipe.ingredients = ingredients;
    recipe.instructions = instructions;
    recipe.difficulty = difficulty;
    recipe.dietary = dietary;
    recipe.tags = tags;
    recipe.notes = notes;
    recipe.cookingTime = cookingTime;
    recipe.prepTime = prepTime;
    recipe.servings = servings;

    await recipe.save();

    // Log activity for recipe update
    try {
      let userIdObj;
      try {
        userIdObj = mongoose.Types.ObjectId.isValid(req.userId)
          ? new mongoose.Types.ObjectId(req.userId)
          : req.userId;
      } catch (e) {
        userIdObj = req.userId;
      }

      const user = await User.findById(userIdObj);
      if (user) {
        const userName = `${user.f_name} ${user.l_name}`.trim();
        await Activity.create({
          userId: userIdObj,
          userName,
          action: "updated",
          recipeId: recipe._id,
          recipeTitle: String(recipe.title).trim(),
        });
        console.log(`✅ Activity logged: ${userName} updated "${recipe.title}"`);
      }
    } catch (activityErr) {
      console.error("❌ Failed to log update activity:", activityErr);
    }

    return res.json({ message: "Recipe updated", recipe });
  } catch (err) {
    console.error("Update recipe error:", err);
    return res.status(500).json({
      message: "Server error updating recipe",
      error: err?.message,
      name: err?.name,
    });
  }
});

// DELETE /api/recipes/:id - protected + role-based access + ownership check
router.delete("/:id", auth, userOrAdmin, async (req, res) => {
  try {
    const recipe = await Recipe.findById(req.params.id);
    if (!recipe) return res.status(404).json({ message: "Recipe not found" });

    if (String(recipe.userId) !== String(req.userId)) {
      return res.status(403).json({ message: "Not allowed" });
    }

    // Store recipe info before deletion for activity logging
    const recipeTitle = String(recipe.title).trim();
    const recipeId = recipe._id;

    await Recipe.deleteOne({ _id: req.params.id });

    // Log activity for recipe deletion
    try {
      let userIdObj;
      try {
        userIdObj = mongoose.Types.ObjectId.isValid(req.userId)
          ? new mongoose.Types.ObjectId(req.userId)
          : req.userId;
      } catch (e) {
        userIdObj = req.userId;
      }

      const user = await User.findById(userIdObj);
      if (user) {
        const userName = `${user.f_name} ${user.l_name}`.trim();
        await Activity.create({
          userId: userIdObj,
          userName,
          action: "deleted",
          recipeId: recipeId,
          recipeTitle: recipeTitle,
        });
        console.log(`✅ Activity logged: ${userName} deleted "${recipeTitle}"`);
      }
    } catch (activityErr) {
      console.error("❌ Failed to log delete activity:", activityErr);
    }

    return res.json({ message: "Recipe deleted" });
  } catch (err) {
    console.error("Delete recipe error:", err);
    return res.status(500).json({
      message: "Server error deleting recipe",
      error: err?.message,
      name: err?.name,
    });
  }
});

/**
 * @route   GET /api/recipes/admin/all
 * @desc    Get all recipes (admin only) - for admin management
 * @access  Private - Admin only (US4-T.9: Admin route protection middleware)
 */
router.get("/admin/all", auth, adminOnly, async (req, res) => {
  try {
    const recipes = await Recipe.find().sort({ createdAt: -1 });
    return res.json({ recipes, count: recipes.length });
  } catch (err) {
    console.error("Admin get all recipes error:", err);
    return res.status(500).json({
      message: "Server error fetching recipes",
      error: err?.message,
      name: err?.name,
    });
  }
});

/**
 * @route   DELETE /api/recipes/admin/:id
 * @desc    Delete any recipe (admin only) - bypasses ownership check
 * @access  Private - Admin only (US4-T.9: Admin route protection middleware)
 */
router.delete("/admin/:id", auth, adminOnly, async (req, res) => {
  try {
    const recipe = await Recipe.findById(req.params.id);
    if (!recipe) {
      return res.status(404).json({ message: "Recipe not found" });
    }

    // Store recipe info before deletion for activity logging
    const recipeTitle = String(recipe.title).trim();
    const recipeId = recipe._id;

    await Recipe.deleteOne({ _id: req.params.id });

    // Log activity for admin recipe deletion
    try {
      let userIdObj;
      try {
        userIdObj = mongoose.Types.ObjectId.isValid(req.userId)
          ? new mongoose.Types.ObjectId(req.userId)
          : req.userId;
      } catch (e) {
        userIdObj = req.userId;
      }

      const user = await User.findById(userIdObj);
      if (user) {
        const userName = `${user.f_name} ${user.l_name}`.trim();
        await Activity.create({
          userId: userIdObj,
          userName,
          action: "deleted",
          recipeId: recipeId,
          recipeTitle: recipeTitle,
        });
        console.log(`✅ Activity logged: ${userName} (admin) deleted "${recipeTitle}"`);
      }
    } catch (activityErr) {
      console.error("❌ Failed to log admin delete activity:", activityErr);
    }

    return res.json({ message: "Recipe deleted by admin" });
  } catch (err) {
    console.error("Admin delete recipe error:", err);
    return res.status(500).json({
      message: "Server error deleting recipe",
      error: err?.message,
      name: err?.name,
    });
  }
});

module.exports = router;
