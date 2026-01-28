const express = require("express");
const cors = require("cors");
const path = require("path");
require("dotenv").config();

const authRoutes = require("./routes/auth");
const recipeRoutes = require("./routes/recipes");
const commentRoutes = require("./routes/comments");
const usersRoutes = require("./routes/users");
const activityRoutes = require("./routes/activities");
const authBodyLimiter = require("./middleware/bodySizeLimiter");

const app = express();

// Middleware
app.use(cors());
// Configure body parser with size limits (10kb for auth endpoints, 1mb for others)
// Apply 10kb limit to auth routes (runs first, parses body for /api/auth routes)
app.use("/api/auth", authBodyLimiter);
// Apply 1mb limit to all other routes (Express will skip if body already parsed)
app.use(express.json({ limit: "1mb" }));

// Serve frontend
app.use(express.static(path.join(__dirname, "../frontend")));
// Serve uploaded images
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// Optional explicit root route
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "../frontend/login.html"));
});

// API routes
app.use("/api/auth", authRoutes);
app.use("/api/recipes", recipeRoutes);
app.use("/api/comments", commentRoutes);
app.use("/api/users", usersRoutes);
app.use("/api/activities", activityRoutes);

// Handle 404 for unknown routes (MUST be last)
app.use((req, res) => {
  res.status(404).send("Page Not Found");
});

module.exports = app;
