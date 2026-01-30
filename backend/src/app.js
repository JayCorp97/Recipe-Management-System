// backend/app.js
const express = require("express");
const cors = require("cors");
const path = require("path");
require("dotenv").config();

console.log("APP.JS LOADED");

const authRoutes = require("./routes/auth");
const recipeRoutes = require("./routes/recipes");
const userRoutes = require("./routes/users");

const app = express();

/* =====================
   Middleware
===================== */
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

/* =====================
   Static frontend
===================== */
app.use(express.static(path.join(__dirname, "../frontend")));

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "../frontend/login.html"));
});

/* =====================
   API Routes
===================== */
app.use("/api/auth", authRoutes);
app.use("/api/recipes", recipeRoutes);
app.use("/api/users", userRoutes);

/* =====================
   404 handler
===================== */
app.use((req, res) => {
  res.status(404).json({ message: "Route not found" });
});

module.exports = app;
