require("../../test/helpers/testSetup");
const { expect } = require("chai");
const mongoose = require("mongoose");
const Recipe = require("../../models/Recipe");
const { createTestUser, createTestRecipe } = require("../helpers/testSetup");

describe("Recipe Model", function() {
  let userId;

  beforeEach(async function() {
    const user = await createTestUser();
    userId = user._id;
  });

  describe("Schema Validation", function() {
    it("should create a recipe with required fields", async function() {
      const recipe = await Recipe.create({
        userId: userId,
        title: "Test Recipe",
        desc: "Test Description"
      });

      expect(recipe).to.exist;
      expect(recipe.title).to.equal("Test Recipe");
      expect(recipe.desc).to.equal("Test Description");
      expect(recipe.userId.toString()).to.equal(userId.toString());
    });

    it("should fail when userId is missing", async function() {
      try {
        await Recipe.create({
          title: "Test Recipe",
          desc: "Test Description"
        });
        expect.fail("Should have thrown an error");
      } catch (error) {
        expect(error.name).to.equal("ValidationError");
      }
    });

    it("should fail when title is missing", async function() {
      try {
        await Recipe.create({
          userId: userId,
          desc: "Test Description"
        });
        expect.fail("Should have thrown an error");
      } catch (error) {
        expect(error.name).to.equal("ValidationError");
      }
    });

    it("should fail when desc is missing", async function() {
      try {
        await Recipe.create({
          userId: userId,
          title: "Test Recipe"
        });
        expect.fail("Should have thrown an error");
      } catch (error) {
        expect(error.name).to.equal("ValidationError");
      }
    });
  });

  describe("Default Values", function() {
    it("should set default category", async function() {
      const recipe = await Recipe.create({
        userId: userId,
        title: "Test Recipe",
        desc: "Test Description"
      });

      expect(recipe.category).to.equal("Dinner");
    });

    it("should set default rating to 0", async function() {
      const recipe = await Recipe.create({
        userId: userId,
        title: "Test Recipe",
        desc: "Test Description"
      });

      expect(recipe.rating).to.equal(0);
    });

    it("should set default difficulty to Medium", async function() {
      const recipe = await Recipe.create({
        userId: userId,
        title: "Test Recipe",
        desc: "Test Description"
      });

      expect(recipe.difficulty).to.equal("Medium");
    });

    it("should initialize empty arrays for ingredients, instructions, dietary, tags", async function() {
      const recipe = await Recipe.create({
        userId: userId,
        title: "Test Recipe",
        desc: "Test Description"
      });

      expect(recipe.ingredients).to.be.an("array").that.is.empty;
      expect(recipe.instructions).to.be.an("array").that.is.empty;
      expect(recipe.dietary).to.be.an("array").that.is.empty;
      expect(recipe.tags).to.be.an("array").that.is.empty;
    });
  });

  describe("Pre-save Hook - Data Sanitization", function() {
    it("should trim and filter empty strings from ingredients", async function() {
      const recipe = await Recipe.create({
        userId: userId,
        title: "Test Recipe",
        desc: "Test Description",
        ingredients: ["  Ingredient 1  ", "", "Ingredient 2", "   "]
      });

      expect(recipe.ingredients).to.deep.equal(["Ingredient 1", "Ingredient 2"]);
    });

    it("should trim and filter empty strings from instructions", async function() {
      const recipe = await Recipe.create({
        userId: userId,
        title: "Test Recipe",
        desc: "Test Description",
        instructions: ["  Step 1  ", "", "Step 2", "   "]
      });

      expect(recipe.instructions).to.deep.equal(["Step 1", "Step 2"]);
    });

    it("should trim and filter empty strings from dietary", async function() {
      const recipe = await Recipe.create({
        userId: userId,
        title: "Test Recipe",
        desc: "Test Description",
        dietary: ["  Vegetarian  ", "", "Vegan", "   "]
      });

      expect(recipe.dietary).to.deep.equal(["Vegetarian", "Vegan"]);
    });

    it("should trim, lowercase, and filter empty strings from tags", async function() {
      const recipe = await Recipe.create({
        userId: userId,
        title: "Test Recipe",
        desc: "Test Description",
        tags: ["  TAG1  ", "", "Tag2", "   ", "TAG3"]
      });

      expect(recipe.tags).to.deep.equal(["tag1", "tag2", "tag3"]);
    });
  });

  describe("Field Types", function() {
    it("should accept valid difficulty values", async function() {
      const difficulties = ["Easy", "Medium", "Hard"];
      
      for (const difficulty of difficulties) {
        const recipe = await Recipe.create({
          userId: userId,
          title: `Test Recipe ${difficulty}`,
          desc: "Test Description",
          difficulty: difficulty
        });

        expect(recipe.difficulty).to.equal(difficulty);
      }
    });

    it("should reject invalid difficulty values", async function() {
      try {
        await Recipe.create({
          userId: userId,
          title: "Test Recipe",
          desc: "Test Description",
          difficulty: "Invalid"
        });
        expect.fail("Should have thrown an error");
      } catch (error) {
        expect(error.name).to.equal("ValidationError");
      }
    });

    it("should store numeric values for cookingTime, prepTime, servings", async function() {
      const recipe = await Recipe.create({
        userId: userId,
        title: "Test Recipe",
        desc: "Test Description",
        cookingTime: 30,
        prepTime: 15,
        servings: 4
      });

      expect(recipe.cookingTime).to.equal(30);
      expect(recipe.prepTime).to.equal(15);
      expect(recipe.servings).to.equal(4);
    });

    it("should store rating as number", async function() {
      const recipe = await Recipe.create({
        userId: userId,
        title: "Test Recipe",
        desc: "Test Description",
        rating: 5
      });

      expect(recipe.rating).to.equal(5);
      expect(typeof recipe.rating).to.equal("number");
    });
  });

  describe("Timestamps", function() {
    it("should automatically add createdAt and updatedAt timestamps", async function() {
      const recipe = await Recipe.create({
        userId: userId,
        title: "Test Recipe",
        desc: "Test Description"
      });

      expect(recipe.createdAt).to.exist;
      expect(recipe.updatedAt).to.exist;
      expect(recipe.createdAt).to.be.instanceOf(Date);
      expect(recipe.updatedAt).to.be.instanceOf(Date);
    });
  });

  describe("Full Recipe Creation", function() {
    it("should create a complete recipe with all fields", async function() {
      const recipeData = {
        userId: userId,
        title: "Complete Recipe",
        desc: "Complete Description",
        category: "Breakfast",
        rating: 5,
        imageUrl: "/uploads/test.jpg",
        ingredients: ["Ingredient 1", "Ingredient 2"],
        instructions: ["Step 1", "Step 2"],
        difficulty: "Easy",
        dietary: ["Vegetarian", "Gluten-Free"],
        tags: ["breakfast", "quick"],
        notes: "Test notes",
        cookingTime: 20,
        prepTime: 10,
        servings: 2
      };

      const recipe = await Recipe.create(recipeData);

      expect(recipe.title).to.equal(recipeData.title);
      expect(recipe.desc).to.equal(recipeData.desc);
      expect(recipe.category).to.equal(recipeData.category);
      expect(recipe.rating).to.equal(recipeData.rating);
      expect(recipe.imageUrl).to.equal(recipeData.imageUrl);
      expect(recipe.ingredients).to.deep.equal(recipeData.ingredients);
      expect(recipe.instructions).to.deep.equal(recipeData.instructions);
      expect(recipe.difficulty).to.equal(recipeData.difficulty);
      expect(recipe.dietary).to.deep.equal(recipeData.dietary);
      expect(recipe.tags).to.deep.equal(recipeData.tags);
      expect(recipe.notes).to.equal(recipeData.notes);
      expect(recipe.cookingTime).to.equal(recipeData.cookingTime);
      expect(recipe.prepTime).to.equal(recipeData.prepTime);
      expect(recipe.servings).to.equal(recipeData.servings);
    });
  });
});
