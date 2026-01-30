require("../helpers/testSetup");
const { expect } = require("chai");
const request = require("supertest");
const app = require("../../app");
const Recipe = require("../../models/Recipe");
const Activity = require("../../models/Activity");
const { createTestUser, createTestAdmin, createTestRecipe, generateToken } = require("../helpers/testSetup");
const path = require("path");
const fs = require("fs");

describe("Recipe Routes", function() {
  let userToken, adminToken, userId, adminId;

  beforeEach(async function() {
    const user = await createTestUser();
    userId = user._id;
    userToken = generateToken(userId, "user");

    const admin = await createTestAdmin();
    adminId = admin._id;
    adminToken = generateToken(adminId, "admin");
  });

  describe("POST /api/recipes - Create Recipe", function() {
    it("should create a recipe with valid data", async function() {
      const recipeData = {
        title: "New Recipe",
        description: "Recipe Description",
        category: "Dinner",
        rating: 5,
        ingredients: ["Ingredient 1", "Ingredient 2"],
        instructions: ["Step 1", "Step 2"],
        difficulty: "Easy",
        dietary: ["Vegetarian"],
        tags: ["test", "recipe"],
        cookingTime: 30,
        prepTime: 15,
        servings: 4
      };

      const res = await request(app)
        .post("/api/recipes")
        .set("Authorization", `Bearer ${userToken}`)
        .send(recipeData)
        .expect(201);

      expect(res.body).to.have.property("message", "Recipe saved");
      expect(res.body).to.have.property("recipe");
      expect(res.body.recipe.title).to.equal(recipeData.title);
      expect(res.body.recipe.desc).to.equal(recipeData.description);
    });

    it("should fail without authentication", async function() {
      const res = await request(app)
        .post("/api/recipes")
        .send({ title: "Test", description: "Test" })
        .expect(401);

      expect(res.body.error).to.exist;
      expect(res.body.error.code).to.equal("UNAUTHORIZED");
    });

    it("should fail when title is missing", async function() {
      const res = await request(app)
        .post("/api/recipes")
        .set("Authorization", `Bearer ${userToken}`)
        .send({ description: "Test Description" })
        .expect(400);

      expect(res.body.message).to.include("title is required");
    });

    it("should fail when description is missing", async function() {
      const res = await request(app)
        .post("/api/recipes")
        .set("Authorization", `Bearer ${userToken}`)
        .send({ title: "Test Recipe" })
        .expect(400);

      expect(res.body.message).to.include("description is required");
    });

    it("should detect duplicate recipe titles", async function() {
      const recipeData = {
        title: "Duplicate Recipe",
        description: "Description"
      };

      // Create first recipe
      await request(app)
        .post("/api/recipes")
        .set("Authorization", `Bearer ${userToken}`)
        .send(recipeData)
        .expect(201);

      // Try to create duplicate
      const res = await request(app)
        .post("/api/recipes")
        .set("Authorization", `Bearer ${userToken}`)
        .send(recipeData)
        .expect(409);

      expect(res.body.duplicate).to.be.true;
      expect(res.body.message).to.include("already have a recipe");
    });

    it("should sanitize ingredients array", async function() {
      const recipeData = {
        title: "Sanitized Recipe",
        description: "Description",
        ingredients: ["  Ingredient 1  ", "", "Ingredient 2", "   "]
      };

      const res = await request(app)
        .post("/api/recipes")
        .set("Authorization", `Bearer ${userToken}`)
        .send(recipeData)
        .expect(201);

      expect(res.body.recipe.ingredients).to.deep.equal(["Ingredient 1", "Ingredient 2"]);
    });

    it("should sanitize tags and convert to lowercase", async function() {
      const recipeData = {
        title: "Tagged Recipe",
        description: "Description",
        tags: ["  TAG1  ", "", "Tag2", "   "]
      };

      const res = await request(app)
        .post("/api/recipes")
        .set("Authorization", `Bearer ${userToken}`)
        .send(recipeData)
        .expect(201);

      expect(res.body.recipe.tags).to.deep.equal(["tag1", "tag2"]);
    });

    it("should set default difficulty to Medium", async function() {
      const recipeData = {
        title: "Default Difficulty",
        description: "Description"
      };

      const res = await request(app)
        .post("/api/recipes")
        .set("Authorization", `Bearer ${userToken}`)
        .send(recipeData)
        .expect(201);

      expect(res.body.recipe.difficulty).to.equal("Medium");
    });

    it("should validate difficulty enum", async function() {
      const recipeData = {
        title: "Invalid Difficulty",
        description: "Description",
        difficulty: "Invalid"
      };

      const res = await request(app)
        .post("/api/recipes")
        .set("Authorization", `Bearer ${userToken}`)
        .send(recipeData)
        .expect(201);

      // Should default to Medium
      expect(res.body.recipe.difficulty).to.equal("Medium");
    });

    it("should log activity when recipe is created", async function() {
      const recipeData = {
        title: "Activity Test Recipe",
        description: "Description"
      };

      const res = await request(app)
        .post("/api/recipes")
        .set("Authorization", `Bearer ${userToken}`)
        .send(recipeData)
        .expect(201);

      // Check if activity was logged
      const activities = await Activity.find({ recipeId: res.body.recipe._id });
      expect(activities.length).to.be.greaterThan(0);
      expect(activities[0].action).to.equal("created");
    });
  });

  describe("GET /api/recipes - List All Recipes", function() {
    it("should return all recipes (public endpoint)", async function() {
      await createTestRecipe(userId);
      await createTestRecipe(userId);

      const res = await request(app)
        .get("/api/recipes")
        .expect(200);

      expect(res.body).to.have.property("recipes");
      expect(res.body.recipes).to.be.an("array");
      expect(res.body.recipes.length).to.be.greaterThanOrEqual(2);
    });

    it("should return recipes sorted by createdAt descending", async function() {
      const recipe1 = await createTestRecipe(userId, { title: "First Recipe" });
      await new Promise(resolve => setTimeout(resolve, 100)); // Small delay
      const recipe2 = await createTestRecipe(userId, { title: "Second Recipe" });

      const res = await request(app)
        .get("/api/recipes")
        .expect(200);

      const recipes = res.body.recipes;
      expect(recipes[0].title).to.equal("Second Recipe");
      expect(recipes[1].title).to.equal("First Recipe");
    });
  });

  describe("GET /api/recipes/mine - Get User's Recipes", function() {
    it("should return only user's recipes", async function() {
      const otherUser = await createTestUser();
      await createTestRecipe(userId, { title: "My Recipe" });
      await createTestRecipe(otherUser._id, { title: "Other Recipe" });

      const res = await request(app)
        .get("/api/recipes/mine")
        .set("Authorization", `Bearer ${userToken}`)
        .expect(200);

      expect(res.body.recipes).to.be.an("array");
      expect(res.body.recipes.length).to.equal(1);
      expect(res.body.recipes[0].title).to.equal("My Recipe");
    });

    it("should fail without authentication", async function() {
      await request(app)
        .get("/api/recipes/mine")
        .expect(401);
    });
  });

  describe("GET /api/recipes/:id - Get Single Recipe", function() {
    it("should return recipe when user owns it", async function() {
      const recipe = await createTestRecipe(userId);

      const res = await request(app)
        .get(`/api/recipes/${recipe._id}`)
        .set("Authorization", `Bearer ${userToken}`)
        .expect(200);

      expect(res.body.recipe._id.toString()).to.equal(recipe._id.toString());
    });

    it("should return 404 when recipe not found", async function() {
      const mongoose = require("mongoose");
      const fakeId = new mongoose.Types.ObjectId();
      
      await request(app)
        .get(`/api/recipes/${fakeId}`)
        .set("Authorization", `Bearer ${userToken}`)
        .expect(404);
    });

    it("should return 403 when user doesn't own recipe", async function() {
      const otherUser = await createTestUser();
      const recipe = await createTestRecipe(otherUser._id);

      await request(app)
        .get(`/api/recipes/${recipe._id}`)
        .set("Authorization", `Bearer ${userToken}`)
        .expect(403);
    });
  });

  describe("PUT /api/recipes/:id - Update Recipe", function() {
    it("should update recipe with valid data", async function() {
      const recipe = await createTestRecipe(userId);

      const updateData = {
        title: "Updated Recipe",
        description: "Updated Description",
        rating: 4
      };

      const res = await request(app)
        .put(`/api/recipes/${recipe._id}`)
        .set("Authorization", `Bearer ${userToken}`)
        .send(updateData)
        .expect(200);

      expect(res.body.message).to.equal("Recipe updated");
      expect(res.body.recipe.title).to.equal(updateData.title);
      expect(res.body.recipe.desc).to.equal(updateData.description);
    });

    it("should detect duplicate titles when updating", async function() {
      const recipe1 = await createTestRecipe(userId, { title: "Recipe One" });
      const recipe2 = await createTestRecipe(userId, { title: "Recipe Two" });

      const res = await request(app)
        .put(`/api/recipes/${recipe2._id}`)
        .set("Authorization", `Bearer ${userToken}`)
        .send({
          title: "Recipe One",
          description: "Description"
        })
        .expect(409);

      expect(res.body.duplicate).to.be.true;
    });

    it("should allow updating with same title", async function() {
      const recipe = await createTestRecipe(userId, { title: "My Recipe" });

      const res = await request(app)
        .put(`/api/recipes/${recipe._id}`)
        .set("Authorization", `Bearer ${userToken}`)
        .send({
          title: "My Recipe",
          description: "Updated Description"
        })
        .expect(200);

      expect(res.body.recipe.desc).to.equal("Updated Description");
    });

    it("should log activity when recipe is updated", async function() {
      const recipe = await createTestRecipe(userId);

      await request(app)
        .put(`/api/recipes/${recipe._id}`)
        .set("Authorization", `Bearer ${userToken}`)
        .send({
          title: "Updated Recipe",
          description: "Updated Description"
        })
        .expect(200);

      const activities = await Activity.find({ 
        recipeId: recipe._id,
        action: "updated"
      });
      expect(activities.length).to.be.greaterThan(0);
    });
  });

  describe("DELETE /api/recipes/:id - Delete Recipe", function() {
    it("should delete recipe when user owns it", async function() {
      const recipe = await createTestRecipe(userId);

      await request(app)
        .delete(`/api/recipes/${recipe._id}`)
        .set("Authorization", `Bearer ${userToken}`)
        .expect(200);

      const deletedRecipe = await Recipe.findById(recipe._id);
      expect(deletedRecipe).to.be.null;
    });

    it("should return 403 when user doesn't own recipe", async function() {
      const otherUser = await createTestUser();
      const recipe = await createTestRecipe(otherUser._id);

      await request(app)
        .delete(`/api/recipes/${recipe._id}`)
        .set("Authorization", `Bearer ${userToken}`)
        .expect(403);
    });

    it("should log activity when recipe is deleted", async function() {
      const recipe = await createTestRecipe(userId);

      await request(app)
        .delete(`/api/recipes/${recipe._id}`)
        .set("Authorization", `Bearer ${userToken}`)
        .expect(200);

      const activities = await Activity.find({ 
        recipeId: recipe._id,
        action: "deleted"
      });
      expect(activities.length).to.be.greaterThan(0);
    });
  });

  describe("GET /api/recipes/admin/all - Admin Get All Recipes", function() {
    it("should return all recipes for admin", async function() {
      await createTestRecipe(userId);
      await createTestRecipe(userId);

      const res = await request(app)
        .get("/api/recipes/admin/all")
        .set("Authorization", `Bearer ${adminToken}`)
        .expect(200);

      expect(res.body).to.have.property("recipes");
      expect(res.body).to.have.property("count");
      expect(res.body.recipes.length).to.be.greaterThanOrEqual(2);
    });

    it("should fail for regular user", async function() {
      await request(app)
        .get("/api/recipes/admin/all")
        .set("Authorization", `Bearer ${userToken}`)
        .expect(403);
    });
  });

  describe("DELETE /api/recipes/admin/:id - Admin Delete Recipe", function() {
    it("should allow admin to delete any recipe", async function() {
      const recipe = await createTestRecipe(userId);

      await request(app)
        .delete(`/api/recipes/admin/${recipe._id}`)
        .set("Authorization", `Bearer ${adminToken}`)
        .expect(200);

      const deletedRecipe = await Recipe.findById(recipe._id);
      expect(deletedRecipe).to.be.null;
    });

    it("should fail for regular user", async function() {
      const recipe = await createTestRecipe(userId);

      await request(app)
        .delete(`/api/recipes/admin/${recipe._id}`)
        .set("Authorization", `Bearer ${userToken}`)
        .expect(403);
    });
  });
});
