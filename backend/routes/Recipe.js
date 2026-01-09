const express = require("express");
const router = express.Router();
const Recipe = require("../models/recipe");
const authMiddleware = require("../middleware/authMiddleware");

router.post("/", authMiddleware, async (req, res) => {
  try {
    const {
      title,
      ingredients,
      instructions,
      cookingTime,
      difficulty,
    } = req.body;

    const recipe = new Recipe({
      title,
      ingredients,
      instructions,
      cookingTime,
      difficulty,
      user: req.user.id, // authenticated user
    });

    const savedRecipe = await recipe.save();

    return res.status(201).json(savedRecipe);
  } catch (error) {
    // Field-specific validation errors
    if (error.name === "ValidationError") {
      const errors = {};

      Object.keys(error.errors).forEach((field) => {
        errors[field] = error.errors[field].message;
      });

      return res.status(400).json({ errors });
    }

    return res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;
