const mongoose = require("mongoose");
const MealPlan = require("../models/Meals"); // your MealPlan model, double-check filename if needed
const User = require("../models/User");

async function seedMealPlans() {
  try {
    // Connect to MongoDB
    await mongoose.connect("mongodb://127.0.0.1:27017/recipeDB");

    // Find one existing user to assign the meal plan
    const user = await User.findOne();
    if (!user) {
      throw new Error("No users found in DB. Please seed users first.");
    }

    // Example meal plan data - replace 'mealId1' etc. with actual meal _id strings from your meals collection if needed
    const mealPlans = [
      {
        user: user._id,  // Required field - link to the user
        meals: {
          monday: { breakfast: "mealId1", lunch: "mealId2", dinner: "mealId3" },
          tuesday: { breakfast: "mealId4", lunch: "mealId5", dinner: "mealId6" },
          // Add the rest of the week as needed
        }
      }
    ];

    // Clear existing meal plans and insert new seed data
    await MealPlan.deleteMany();
    await MealPlan.insertMany(mealPlans);

    console.log("Meal plans seeded successfully!");
  } catch (err) {
    console.error("Seeding error:", err);
  } finally {
    await mongoose.disconnect();
  }
}

seedMealPlans();
