const mongoose = require("mongoose");

const recipeSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, "Title is required"],
      trim: true,
    },

    ingredients: {
      type: [String],
      required: [true, "Ingredients are required"],
      validate: {
        validator: function (value) {
          return Array.isArray(value) && value.length > 0;
        },
        message: "Ingredients must be a non-empty list",
      },
    },

    instructions: {
      type: String,
      required: [true, "Instructions are required"],
    },

    //  link to authenticated user
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    // Optional fields
    cookingTime: {
      type: Number,
      min: [1, "Cooking time must be at least 1 minute"],
    },

    difficulty: {
      type: String,
      enum: ["easy", "medium", "hard"],
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Recipe", recipeSchema);
