const mongoose = require("mongoose");

const activitySchema = new mongoose.Schema(
  {
    userId: { 
      type: mongoose.Schema.Types.ObjectId, 
      ref: "User", 
      required: true 
    },
    userName: { 
      type: String, 
      required: true 
    },
    action: { 
      type: String, 
      required: true,
      enum: ["created", "updated", "deleted"]
    },
    recipeId: { 
      type: mongoose.Schema.Types.ObjectId, 
      ref: "Recipe", 
      required: true 
    },
    recipeTitle: { 
      type: String, 
      required: true 
    },
  },
  { timestamps: true }
);

// Index for efficient querying by date
activitySchema.index({ createdAt: -1 });

module.exports = mongoose.model("Activity", activitySchema);
