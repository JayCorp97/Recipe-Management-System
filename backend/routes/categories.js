const express = require("express");
const { body, query, param, validationResult } = require("express-validator");

const Category = require("../models/Category");
const Recipe = require("../models/Recipe");
const authMiddleware = require("../middleware/authMiddleware");
const { adminOnly } = require("../middleware/roleMiddleware");
const { sendError, ErrorCodes } = require("../utils/errorHandler");
const { logAdminAction } = require("../utils/adminAudit");

const router = express.Router();

const handleValidation = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const errorMessages = errors.array().map((err) => err.msg);
    return sendError(res, 400, ErrorCodes.VALIDATION_ERROR, "Validation failed", errorMessages);
  }
  next();
};

const slugify = (value) =>
  String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "");

/* ===========================
   Public: list active categories
=========================== */
router.get("/", async (req, res) => {
  try {
    const categories = await Category.find({ isActive: true })
      .sort({ name: 1 })
      .select("name slug description");

    return res.json({ categories });
  } catch (err) {
    console.error("List categories error:", err);
    return sendError(res, 500, ErrorCodes.SERVER_ERROR, "Server error");
  }
});

/* ===========================
   Admin: list categories (paginated)
=========================== */
router.get(
  "/admin",
  authMiddleware,
  adminOnly,
  [
    query("page").optional().isInt({ min: 1 }).withMessage("page must be >= 1"),
    query("limit").optional().isInt({ min: 1, max: 100 }).withMessage("limit must be 1-100"),
    query("status").optional().isIn(["all", "active", "inactive"]).withMessage("Invalid status filter"),
    query("search").optional().isString().withMessage("search must be a string"),
    handleValidation
  ],
  async (req, res) => {
    try {
      const page = Number(req.query.page || 1);
      const limit = Number(req.query.limit || 10);
      const status = req.query.status || "all";
      const search = String(req.query.search || "").trim();

      const filter = {};
      if (status === "active") filter.isActive = true;
      if (status === "inactive") filter.isActive = false;
      if (search) filter.name = { $regex: new RegExp(search, "i") };

      const total = await Category.countDocuments(filter);
      const categories = await Category.find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit);

      return res.json({
        categories,
        page,
        limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / limit))
      });
    } catch (err) {
      console.error("Admin list categories error:", err);
      return sendError(res, 500, ErrorCodes.SERVER_ERROR, "Server error");
    }
  }
);

/* ===========================
   Admin: create category
=========================== */
router.post(
  "/",
  authMiddleware,
  adminOnly,
  [
    body("name")
      .trim()
      .isLength({ min: 2, max: 50 })
      .withMessage("Name must be between 2 and 50 characters"),
    body("description")
      .optional()
      .isLength({ max: 200 })
      .withMessage("Description must be 200 characters or less"),
    body("isActive")
      .optional()
      .isBoolean()
      .withMessage("isActive must be boolean"),
    handleValidation
  ],
  async (req, res) => {
    try {
      const name = String(req.body.name).trim();
      const slug = slugify(name);

      const existing = await Category.findOne({
        $or: [{ name: new RegExp(`^${name}$`, "i") }, { slug }]
      });

      if (existing) {
        return sendError(res, 409, ErrorCodes.VALIDATION_ERROR, "Category already exists");
      }

      const category = await Category.create({
        name,
        slug,
        description: String(req.body.description || "").trim(),
        isActive: req.body.isActive !== undefined ? Boolean(req.body.isActive) : true,
        createdBy: req.userId,
        updatedBy: req.userId
      });

      await logAdminAction({
        actorId: req.userId,
        action: "CATEGORY_CREATED",
        targetType: "Category",
        targetId: category._id
      });

      return res.status(201).json({ message: "Category created", category });
    } catch (err) {
      console.error("Create category error:", err);
      return sendError(res, 500, ErrorCodes.SERVER_ERROR, "Server error");
    }
  }
);

/* ===========================
   Admin: update category
=========================== */
router.put(
  "/:id",
  authMiddleware,
  adminOnly,
  [
    param("id").isMongoId().withMessage("Invalid category id"),
    body("name")
      .trim()
      .isLength({ min: 2, max: 50 })
      .withMessage("Name must be between 2 and 50 characters"),
    body("description")
      .optional()
      .isLength({ max: 200 })
      .withMessage("Description must be 200 characters or less"),
    body("isActive")
      .optional()
      .isBoolean()
      .withMessage("isActive must be boolean"),
    handleValidation
  ],
  async (req, res) => {
    try {
      const category = await Category.findById(req.params.id);
      if (!category) {
        return sendError(res, 404, ErrorCodes.NOT_FOUND, "Category not found");
      }

      const name = String(req.body.name).trim();
      const slug = slugify(name);

      const existing = await Category.findOne({
        _id: { $ne: category._id },
        $or: [{ name: new RegExp(`^${name}$`, "i") }, { slug }]
      });
      if (existing) {
        return sendError(res, 409, ErrorCodes.VALIDATION_ERROR, "Category name already in use");
      }

      const oldName = category.name;
      category.name = name;
      category.slug = slug;
      category.description = String(req.body.description || "").trim();
      if (req.body.isActive !== undefined) category.isActive = Boolean(req.body.isActive);
      category.updatedBy = req.userId;

      await category.save();

      if (oldName !== name) {
        await Recipe.updateMany(
          { category: { $regex: new RegExp(`^${oldName}$`, "i") } },
          { $set: { category: name } }
        );
      }

      await logAdminAction({
        actorId: req.userId,
        action: "CATEGORY_UPDATED",
        targetType: "Category",
        targetId: category._id,
        details: { oldName, newName: name }
      });

      return res.json({ message: "Category updated", category });
    } catch (err) {
      console.error("Update category error:", err);
      return sendError(res, 500, ErrorCodes.SERVER_ERROR, "Server error");
    }
  }
);

/* ===========================
   Admin: delete category
=========================== */
router.delete(
  "/:id",
  authMiddleware,
  adminOnly,
  [param("id").isMongoId().withMessage("Invalid category id"), handleValidation],
  async (req, res) => {
    try {
      const category = await Category.findById(req.params.id);
      if (!category) {
        return sendError(res, 404, ErrorCodes.NOT_FOUND, "Category not found");
      }

      const inUse = await Recipe.exists({
        category: { $regex: new RegExp(`^${category.name}$`, "i") },
        deletedAt: null
      });
      if (inUse) {
        return sendError(
          res,
          409,
          ErrorCodes.VALIDATION_ERROR,
          "Category is in use by existing recipes"
        );
      }

      await Category.deleteOne({ _id: category._id });
      await logAdminAction({
        actorId: req.userId,
        action: "CATEGORY_DELETED",
        targetType: "Category",
        targetId: category._id
      });
      return res.json({ message: "Category deleted" });
    } catch (err) {
      console.error("Delete category error:", err);
      return sendError(res, 500, ErrorCodes.SERVER_ERROR, "Server error");
    }
  }
);

module.exports = router;
