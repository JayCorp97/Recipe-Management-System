const express = require("express");
const mongoose = require("mongoose");

const User = require("../models/User");
const Recipe = require("../models/Recipe");
const Category = require("../models/Category");
const authMiddleware = require("../middleware/authMiddleware");
const { adminOnly } = require("../middleware/roleMiddleware");
const { sendError, ErrorCodes } = require("../utils/errorHandler");

const router = express.Router();

const parseRange = (days) => {
  const rangeDays = Number(days || 30);
  const safeDays = Number.isFinite(rangeDays) && rangeDays > 0 ? rangeDays : 30;
  const end = new Date();
  const start = new Date();
  start.setDate(end.getDate() - safeDays);
  return { start, end, days: safeDays };
};

const calculateGrowth = (current, previous) => {
  if (previous === 0 && current === 0) return 0;
  if (previous === 0) return 100;
  return Number((((current - previous) / previous) * 100).toFixed(2));
};

router.get("/overview", authMiddleware, adminOnly, async (req, res) => {
  try {
    const { start, end } = parseRange(30);
    const lastWeekStart = new Date(end);
    lastWeekStart.setDate(end.getDate() - 7);
    const prevWeekStart = new Date(end);
    prevWeekStart.setDate(end.getDate() - 14);

    const [userCounts, recipeCounts, categoryCount, weeklyUsers, weeklyRecipes] = await Promise.all([
      User.aggregate([
        {
          $group: {
            _id: null,
            total: { $sum: 1 },
            active: { $sum: { $cond: [{ $eq: ["$active", 1] }, 1, 0] } },
            suspended: { $sum: { $cond: [{ $eq: ["$active", 0] }, 1, 0] } },
            deleted: { $sum: { $cond: [{ $ne: ["$deletedAt", null] }, 1, 0] } }
          }
        },
        { $project: { _id: 0 } }
      ]),
      Recipe.aggregate([
        {
          $group: {
            _id: null,
            total: { $sum: 1 },
            deleted: { $sum: { $cond: [{ $ne: ["$deletedAt", null] }, 1, 0] } },
            avgRating: { $avg: "$rating" }
          }
        },
        { $project: { _id: 0, total: 1, deleted: 1, avgRating: { $ifNull: ["$avgRating", 0] } } }
      ]),
      Category.countDocuments({}),
      User.aggregate([
        {
          $match: {
            created_date: { $gte: prevWeekStart, $lte: end }
          }
        },
        {
          $project: {
            weekBucket: {
              $cond: [
                { $gte: ["$created_date", lastWeekStart] },
                "current",
                "previous"
              ]
            }
          }
        },
        { $group: { _id: "$weekBucket", total: { $sum: 1 } } }
      ]),
      Recipe.aggregate([
        {
          $match: {
            createdAt: { $gte: prevWeekStart, $lte: end }
          }
        },
        {
          $project: {
            weekBucket: {
              $cond: [
                { $gte: ["$createdAt", lastWeekStart] },
                "current",
                "previous"
              ]
            }
          }
        },
        { $group: { _id: "$weekBucket", total: { $sum: 1 } } }
      ])
    ]);

    const users = userCounts[0] || { total: 0, active: 0, suspended: 0, deleted: 0 };
    const recipes = recipeCounts[0] || { total: 0, deleted: 0, avgRating: 0 };

    const currentUsers = weeklyUsers.find((row) => row._id === "current")?.total || 0;
    const previousUsers = weeklyUsers.find((row) => row._id === "previous")?.total || 0;
    const currentRecipes = weeklyRecipes.find((row) => row._id === "current")?.total || 0;
    const previousRecipes = weeklyRecipes.find((row) => row._id === "previous")?.total || 0;

    const insights = {
      userGrowthPct: calculateGrowth(currentUsers, previousUsers),
      recipeGrowthPct: calculateGrowth(currentRecipes, previousRecipes),
      avgRating: Number(recipes.avgRating.toFixed(2))
    };

    return res.json({
      users,
      recipes,
      categories: categoryCount,
      insights
    });
  } catch (err) {
    console.error("Admin analytics overview error:", err);
    return sendError(res, 500, ErrorCodes.SERVER_ERROR, "Server error");
  }
});

router.get("/user-trends", authMiddleware, adminOnly, async (req, res) => {
  try {
    const { start, end, days } = parseRange(req.query.days);
    const trends = await User.aggregate([
      { $match: { created_date: { $gte: start, $lte: end } } },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m-%d", date: "$created_date" } },
          total: { $sum: 1 }
        }
      },
      { $project: { _id: 0, date: "$_id", total: 1 } },
      { $sort: { date: 1 } }
    ]);

    return res.json({ rangeDays: days, trends });
  } catch (err) {
    console.error("Admin user trends error:", err);
    return sendError(res, 500, ErrorCodes.SERVER_ERROR, "Server error");
  }
});

router.get("/recipe-trends", authMiddleware, adminOnly, async (req, res) => {
  try {
    const { start, end, days } = parseRange(req.query.days);
    const trends = await Recipe.aggregate([
      { $match: { createdAt: { $gte: start, $lte: end } } },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
          total: { $sum: 1 }
        }
      },
      { $project: { _id: 0, date: "$_id", total: 1 } },
      { $sort: { date: 1 } }
    ]);

    return res.json({ rangeDays: days, trends });
  } catch (err) {
    console.error("Admin recipe trends error:", err);
    return sendError(res, 500, ErrorCodes.SERVER_ERROR, "Server error");
  }
});

router.get("/category-usage", authMiddleware, adminOnly, async (req, res) => {
  try {
    const usage = await Recipe.aggregate([
      { $match: { deletedAt: null } },
      { $group: { _id: "$category", total: { $sum: 1 } } },
      {
        $lookup: {
          from: "categories",
          localField: "_id",
          foreignField: "name",
          as: "category"
        }
      },
      { $unwind: { path: "$category", preserveNullAndEmptyArrays: true } },
      {
        $project: {
          _id: 0,
          category: "$_id",
          total: 1,
          isActive: { $ifNull: ["$category.isActive", true] },
          description: { $ifNull: ["$category.description", ""] }
        }
      },
      { $sort: { total: -1 } }
    ]);

    return res.json({ usage });
  } catch (err) {
    console.error("Admin category usage error:", err);
    return sendError(res, 500, ErrorCodes.SERVER_ERROR, "Server error");
  }
});

router.get("/recipe-rating-buckets", authMiddleware, adminOnly, async (req, res) => {
  try {
    const buckets = await Recipe.aggregate([
      { $match: { deletedAt: null } },
      {
        $bucket: {
          groupBy: "$rating",
          boundaries: [0, 1, 2, 3, 4, 5, 6],
          default: "unknown",
          output: { total: { $sum: 1 } }
        }
      }
    ]);

    return res.json({ buckets });
  } catch (err) {
    console.error("Admin rating buckets error:", err);
    return sendError(res, 500, ErrorCodes.SERVER_ERROR, "Server error");
  }
});

router.get("/tag-insights", authMiddleware, adminOnly, async (req, res) => {
  try {
    const tags = await Recipe.aggregate([
      { $match: { deletedAt: null } },
      { $unwind: { path: "$tags", preserveNullAndEmptyArrays: false } },
      {
        $group: {
          _id: "$tags",
          total: { $sum: 1 },
          avgRating: { $avg: "$rating" }
        }
      },
      {
        $project: {
          _id: 0,
          tag: "$_id",
          total: 1,
          avgRating: { $ifNull: ["$avgRating", 0] }
        }
      },
      { $sort: { total: -1 } }
    ]);

    return res.json({ tags });
  } catch (err) {
    console.error("Admin tag insights error:", err);
    return sendError(res, 500, ErrorCodes.SERVER_ERROR, "Server error");
  }
});

router.get("/user-role-breakdown", authMiddleware, adminOnly, async (req, res) => {
  try {
    const roles = await User.aggregate([
      {
        $group: {
          _id: "$role",
          total: { $sum: 1 }
        }
      },
      { $project: { _id: 0, role: "$_id", total: 1 } },
      { $sort: { total: -1 } }
    ]);

    return res.json({ roles });
  } catch (err) {
    console.error("Admin role breakdown error:", err);
    return sendError(res, 500, ErrorCodes.SERVER_ERROR, "Server error");
  }
});

module.exports = router;
