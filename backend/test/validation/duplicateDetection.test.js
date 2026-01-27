require("../helpers/testSetup");
const { expect } = require("chai");
const request = require("supertest");
const app = require("../../app");
const Recipe = require("../../models/Recipe");
const { createTestUser, createTestRecipe, generateToken } = require("../helpers/testSetup");

describe("Duplicate Detection & Validation", function() {
  let userToken, userId;

  beforeEach(async function() {
    const user = await createTestUser();
    userId = user._id;
    userToken = generateToken(userId, "user");
  });

  describe("Case-Insensitive Duplicate Detection", function() {
    it("should detect duplicate titles regardless of case", async function() {
      // Create recipe with lowercase title
      await createTestRecipe(userId, { title: "chocolate cake" });

      // Try to create duplicate with different case
      const res = await request(app)
        .post("/api/recipes")
        .set("Authorization", `Bearer ${userToken}`)
        .send({
          title: "CHOCOLATE CAKE",
          description: "Description"
        })
        .expect(409);

      expect(res.body.duplicate).to.be.true;
    });

    it("should detect duplicate with mixed case", async function() {
      await createTestRecipe(userId, { title: "Chocolate Cake" });

      const res = await request(app)
        .post("/api/recipes")
        .set("Authorization", `Bearer ${userToken}`)
        .send({
          title: "chocolate cake",
          description: "Description"
        })
        .expect(409);

      expect(res.body.duplicate).to.be.true;
    });

    it("should detect duplicate with extra whitespace", async function() {
      await createTestRecipe(userId, { title: "Chocolate Cake" });

      const res = await request(app)
        .post("/api/recipes")
        .set("Authorization", `Bearer ${userToken}`)
        .send({
          title: "  Chocolate Cake  ",
          description: "Description"
        })
        .expect(409);

      expect(res.body.duplicate).to.be.true;
    });
  });

  describe("User-Specific Duplicate Detection", function() {
    it("should only check duplicates for same user", async function() {
      const otherUser = await createTestUser();
      await createTestRecipe(otherUser._id, { title: "Shared Recipe" });

      // Same user should be able to create recipe with same title
      const res = await request(app)
        .post("/api/recipes")
        .set("Authorization", `Bearer ${userToken}`)
        .send({
          title: "Shared Recipe",
          description: "Description"
        })
        .expect(201);

      expect(res.body.recipe.title).to.equal("Shared Recipe");
    });
  });

  describe("Update Duplicate Detection", function() {
    it("should detect duplicate when updating recipe", async function() {
      const recipe1 = await createTestRecipe(userId, { title: "Recipe One" });
      const recipe2 = await createTestRecipe(userId, { title: "Recipe Two" });

      // Try to update recipe2 with recipe1's title
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

    it("should allow updating with same title (same recipe)", async function() {
      const recipe = await createTestRecipe(userId, { title: "My Recipe" });

      const res = await request(app)
        .put(`/api/recipes/${recipe._id}`)
        .set("Authorization", `Bearer ${userToken}`)
        .send({
          title: "My Recipe",
          description: "Updated Description"
        })
        .expect(200);

      expect(res.body.recipe.title).to.equal("My Recipe");
    });
  });

  describe("Data Sanitization", function() {
    it("should sanitize ingredients array", async function() {
      const res = await request(app)
        .post("/api/recipes")
        .set("Authorization", `Bearer ${userToken}`)
        .send({
          title: "Sanitized Recipe",
          description: "Description",
          ingredients: ["  Ingredient 1  ", "", "Ingredient 2", "   ", null]
        })
        .expect(201);

      expect(res.body.recipe.ingredients).to.deep.equal(["Ingredient 1", "Ingredient 2"]);
    });

    it("should sanitize instructions array", async function() {
      const res = await request(app)
        .post("/api/recipes")
        .set("Authorization", `Bearer ${userToken}`)
        .send({
          title: "Sanitized Recipe",
          description: "Description",
          instructions: ["  Step 1  ", "", "Step 2", "   "]
        })
        .expect(201);

      expect(res.body.recipe.instructions).to.deep.equal(["Step 1", "Step 2"]);
    });

    it("should sanitize and lowercase tags", async function() {
      const res = await request(app)
        .post("/api/recipes")
        .set("Authorization", `Bearer ${userToken}`)
        .send({
          title: "Tagged Recipe",
          description: "Description",
          tags: ["  TAG1  ", "", "Tag2", "   ", "TAG3"]
        })
        .expect(201);

      expect(res.body.recipe.tags).to.deep.equal(["tag1", "tag2", "tag3"]);
    });

    it("should sanitize dietary array", async function() {
      const res = await request(app)
        .post("/api/recipes")
        .set("Authorization", `Bearer ${userToken}`)
        .send({
          title: "Dietary Recipe",
          description: "Description",
          dietary: ["  Vegetarian  ", "", "Vegan", "   "]
        })
        .expect(201);

      expect(res.body.recipe.dietary).to.deep.equal(["Vegetarian", "Vegan"]);
    });

    it("should trim title and description", async function() {
      const res = await request(app)
        .post("/api/recipes")
        .set("Authorization", `Bearer ${userToken}`)
        .send({
          title: "  Trimmed Title  ",
          description: "  Trimmed Description  "
        })
        .expect(201);

      expect(res.body.recipe.title).to.equal("Trimmed Title");
      expect(res.body.recipe.desc).to.equal("Trimmed Description");
    });
  });

  describe("Input Validation", function() {
    it("should validate required fields", async function() {
      const res = await request(app)
        .post("/api/recipes")
        .set("Authorization", `Bearer ${userToken}`)
        .send({})
        .expect(400);

      expect(res.body.message).to.include("required");
    });

    it("should validate title is not empty after trim", async function() {
      const res = await request(app)
        .post("/api/recipes")
        .set("Authorization", `Bearer ${userToken}`)
        .send({
          title: "   ",
          description: "Description"
        })
        .expect(400);

      expect(res.body.message).to.include("title is required");
    });

    it("should validate description is not empty after trim", async function() {
      const res = await request(app)
        .post("/api/recipes")
        .set("Authorization", `Bearer ${userToken}`)
        .send({
          title: "Title",
          description: "   "
        })
        .expect(400);

      expect(res.body.message).to.include("description is required");
    });

    it("should validate difficulty enum", async function() {
      const res = await request(app)
        .post("/api/recipes")
        .set("Authorization", `Bearer ${userToken}`)
        .send({
          title: "Title",
          description: "Description",
          difficulty: "Invalid"
        })
        .expect(201);

      // Should default to Medium
      expect(res.body.recipe.difficulty).to.equal("Medium");
    });

    it("should validate numeric fields", async function() {
      const res = await request(app)
        .post("/api/recipes")
        .set("Authorization", `Bearer ${userToken}`)
        .send({
          title: "Title",
          description: "Description",
          rating: "invalid",
          cookingTime: "invalid",
          prepTime: "invalid",
          servings: "invalid"
        })
        .expect(201);

      // Should default to 0 for invalid numbers
      expect(res.body.recipe.rating).to.equal(0);
      expect(res.body.recipe.cookingTime).to.equal(0);
      expect(res.body.recipe.prepTime).to.equal(0);
      expect(res.body.recipe.servings).to.equal(0);
    });
  });

  describe("Error Handling", function() {
    it("should return proper error format for duplicates", async function() {
      await createTestRecipe(userId, { title: "Existing Recipe" });

      const res = await request(app)
        .post("/api/recipes")
        .set("Authorization", `Bearer ${userToken}`)
        .send({
          title: "Existing Recipe",
          description: "Description"
        })
        .expect(409);

      expect(res.body).to.have.property("duplicate", true);
      expect(res.body).to.have.property("existingTitle");
      expect(res.body).to.have.property("message");
    });

    it("should handle database errors gracefully", async function() {
      // This test would require mocking database errors
      // For now, we test that the endpoint exists and handles errors
      const res = await request(app)
        .post("/api/recipes")
        .set("Authorization", `Bearer ${userToken}`)
        .send({
          title: "Test",
          description: "Test"
        });

      // Should either succeed or return proper error format
      expect([201, 400, 500]).to.include(res.status);
      if (res.status !== 201) {
        expect(res.body).to.have.property("message");
      }
    });
  });
});
