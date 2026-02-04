const mongoose = require("mongoose");

const recipeSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },

    title: { type: String, required: true, trim: true },
    desc: { type: String, required: true, trim: true },
    category: { type: String, default: "Dinner" },
    rating: { type: Number, default: 0 },
    imageUrl: { type: String, default: "" },
    
    // New fields
    ingredients: { type: [String], default: [] },
    instructions: { type: [String], default: [] },
    difficulty: { type: String, enum: ["Easy", "Medium", "Hard"], default: "Medium" },
    dietary: { type: [String], default: [] },
    tags: { type: [String], default: [] },
    notes: { type: String, trim: true, default: "" },
    cookingTime: { type: Number, default: 0 },
    prepTime: { type: Number, default: 0 },
    servings: { type: Number, default: 0 },

    // Soft delete / trash: set when recipe is deleted (bulk or single soft-delete)
    deletedAt: { type: Date, default: null },
    deletedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null }
  },
  { timestamps: true }
);

// Pre-save hook to ensure data consistency
// Using async/await pattern for better compatibility with Mongoose 9.x
recipeSchema.pre("save", async function () {
  // Trim and filter empty strings and null/undefined values from arrays
  if (this.ingredients && Array.isArray(this.ingredients)) {
    this.ingredients = this.ingredients
      .filter(i => i != null && i !== undefined) // Filter out null/undefined first
      .map(i => String(i).trim())
      .filter(i => i.length > 0);
  }
  if (this.instructions && Array.isArray(this.instructions)) {
    this.instructions = this.instructions
      .filter(i => i != null && i !== undefined)
      .map(i => String(i).trim())
      .filter(i => i.length > 0);
  }
  if (this.dietary && Array.isArray(this.dietary)) {
    this.dietary = this.dietary
      .filter(d => d != null && d !== undefined)
      .map(d => String(d).trim())
      .filter(d => d.length > 0);
  }
  if (this.tags && Array.isArray(this.tags)) {
    this.tags = this.tags
      .filter(t => t != null && t !== undefined)
      .map(t => String(t).trim().toLowerCase())
      .filter(t => t.length > 0);
  }
});

module.exports = mongoose.model("Recipe", recipeSchema);
