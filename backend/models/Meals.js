const mongoose = require("mongoose");

const mealSchema = new mongoose.Schema({
  breakfast: {
    type: String, // could be recipe ID or name
    default: ""
  },
  lunch: {
    type: String,
    default: ""
  },
  dinner: {
    type: String,
    default: ""
  }
});

const mealPlanSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true
  },
  week: {
    monday: { type: mealSchema, default: () => ({}) },
    tuesday: { type: mealSchema, default: () => ({}) },
    wednesday: { type: mealSchema, default: () => ({}) },
    thursday: { type: mealSchema, default: () => ({}) },
    friday: { type: mealSchema, default: () => ({}) },
    saturday: { type: mealSchema, default: () => ({}) },
    sunday: { type: mealSchema, default: () => ({}) }
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// Optional: ensure only one meal plan per user per week (if needed)
mealPlanSchema.index({ user: 1, createdAt: 1 });

module.exports = mongoose.model("MealPlan", mealPlanSchema);
