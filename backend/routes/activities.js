const express = require("express");
const Activity = require("../models/Activity");

const router = express.Router();

// Debug: Log when route is loaded
console.log("Activities route loaded successfully");

/**
 * @route   GET /api/activities
 * @desc    Get recent activities (public endpoint)
 * @access  Public
 */
router.get("/", async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 20;
    
    // Check total count for debugging
    const totalCount = await Activity.countDocuments();
    console.log(`Total activities in database: ${totalCount}`);
    
    const activities = await Activity.find()
      .sort({ createdAt: -1 })
      .limit(limit)
      .select("userName action recipeTitle createdAt _id")
      .lean();

    console.log(`Returning ${activities.length} activities (requested limit: ${limit})`);
    
    // Log first activity for debugging
    if (activities.length > 0) {
      console.log("First activity:", JSON.stringify(activities[0], null, 2));
    }
    
    return res.json({ activities });
  } catch (err) {
    console.error("Get activities error:", err);
    console.error("Error stack:", err.stack);
    return res.status(500).json({
      message: "Server error fetching activities",
      error: err?.message,
    });
  }
});

module.exports = router;
