require("../helpers/testSetup");
const { expect } = require("chai");
const request = require("supertest");
const app = require("../../app");
const User = require("../../models/User");
const Recipe = require("../../models/Recipe");
const Activity = require("../../models/Activity");
const bcrypt = require("bcryptjs");

describe("Integration Tests - Complete Workflows", function() {
  this.timeout(120000); // Increased timeout for integration tests

  describe("Complete User Workflow: Register → Login → Create → View → Update → Delete", function() {
    let userToken, userId, recipeId;

    it("should complete full user workflow successfully", async function() {
      // Step 1: Register a new user
      const registerData = {
        f_name: "Integration",
        l_name: "Test",
        email: `integration${Date.now()}@test.com`,
        password: "Test123!@#",
        confirm_password: "Test123!@#"
      };

      const registerRes = await request(app)
        .post("/api/auth/register")
        .send(registerData)
        .expect(201);

      expect(registerRes.body).to.have.property("token");
      expect(registerRes.body.message).to.equal("Registered successfully");
      userToken = registerRes.body.token;

      // Verify user was created in database
      const user = await User.findOne({ email: registerData.email.toLowerCase() });
      expect(user).to.exist;
      expect(user.f_name).to.equal(registerData.f_name);
      userId = user._id;

      // Step 2: Login with registered credentials
      const loginRes = await request(app)
        .post("/api/auth/login")
        .send({
          email: registerData.email,
          password: registerData.password
        })
        .expect(200);

      expect(loginRes.body).to.have.property("token");
      userToken = loginRes.body.token; // Use login token

      // Step 3: Get current user info
      const meRes = await request(app)
        .get("/api/auth/me")
        .set("Authorization", `Bearer ${userToken}`)
        .expect(200);

      expect(meRes.body._id.toString()).to.equal(userId.toString());
      expect(meRes.body.email).to.equal(registerData.email.toLowerCase());

      // Step 4: Create a recipe
      const recipeData = {
        title: "Integration Test Recipe",
        description: "A recipe created during integration testing",
        category: "Dinner",
        rating: 5,
        ingredients: ["Ingredient 1", "Ingredient 2"],
        instructions: ["Step 1", "Step 2"],
        difficulty: "Easy",
        dietary: ["Vegetarian"],
        tags: ["test", "integration"],
        cookingTime: 30,
        prepTime: 15,
        servings: 4
      };

      const createRes = await request(app)
        .post("/api/recipes")
        .set("Authorization", `Bearer ${userToken}`)
        .send(recipeData)
        .expect(201);

      expect(createRes.body).to.have.property("recipe");
      expect(createRes.body.recipe.title).to.equal(recipeData.title);
      recipeId = createRes.body.recipe._id;

      // Verify recipe was saved in database
      const recipe = await Recipe.findById(recipeId);
      expect(recipe).to.exist;
      expect(recipe.userId.toString()).to.equal(userId.toString());

      // Step 5: Verify activity was logged
      const activities = await Activity.find({ recipeId: recipeId });
      expect(activities.length).to.be.greaterThan(0);
      expect(activities[0].action).to.equal("created");
      expect(activities[0].userId.toString()).to.equal(userId.toString());

      // Step 6: View the created recipe
      const viewRes = await request(app)
        .get(`/api/recipes/${recipeId}`)
        .set("Authorization", `Bearer ${userToken}`)
        .expect(200);

      expect(viewRes.body.recipe._id.toString()).to.equal(recipeId.toString());
      expect(viewRes.body.recipe.title).to.equal(recipeData.title);

      // Step 7: View user's recipes
      const mineRes = await request(app)
        .get("/api/recipes/mine")
        .set("Authorization", `Bearer ${userToken}`)
        .expect(200);

      expect(mineRes.body.recipes).to.be.an("array");
      expect(mineRes.body.recipes.length).to.equal(1);
      expect(mineRes.body.recipes[0]._id.toString()).to.equal(recipeId.toString());

      // Step 8: Update the recipe
      const updateData = {
        title: "Updated Integration Test Recipe",
        description: "Updated description",
        rating: 4
      };

      const updateRes = await request(app)
        .put(`/api/recipes/${recipeId}`)
        .set("Authorization", `Bearer ${userToken}`)
        .send(updateData)
        .expect(200);

      expect(updateRes.body.recipe.title).to.equal(updateData.title);
      expect(updateRes.body.recipe.desc).to.equal(updateData.description);

      // Verify update in database
      const updatedRecipe = await Recipe.findById(recipeId);
      expect(updatedRecipe.title).to.equal(updateData.title);

      // Verify update activity was logged
      const updateActivities = await Activity.find({ 
        recipeId: recipeId,
        action: "updated"
      });
      expect(updateActivities.length).to.be.greaterThan(0);

      // Step 9: Delete the recipe
      const deleteRes = await request(app)
        .delete(`/api/recipes/${recipeId}`)
        .set("Authorization", `Bearer ${userToken}`)
        .expect(200);

      expect(deleteRes.body.message).to.equal("Recipe deleted");

      // Verify deletion in database
      const deletedRecipe = await Recipe.findById(recipeId);
      expect(deletedRecipe).to.be.null;

      // Verify delete activity was logged
      const deleteActivities = await Activity.find({ 
        recipeId: recipeId,
        action: "deleted"
      });
      expect(deleteActivities.length).to.be.greaterThan(0);

      // Step 10: Verify recipe no longer appears in user's recipes
      const mineAfterDeleteRes = await request(app)
        .get("/api/recipes/mine")
        .set("Authorization", `Bearer ${userToken}`)
        .expect(200);

      expect(mineAfterDeleteRes.body.recipes.length).to.equal(0);
    });
  });

  describe("Multi-User Recipe Management Workflow", function() {
    let user1Token, user2Token, user1Id, user2Id;
    let user1RecipeId, user2RecipeId;

    beforeEach(async function() {
      // Create two users
      const user1Data = {
        f_name: "User1",
        l_name: "Test",
        email: `user1${Date.now()}@test.com`,
        password: "Test123!@#",
        confirm_password: "Test123!@#"
      };

      const user2Data = {
        f_name: "User2",
        l_name: "Test",
        email: `user2${Date.now()}@test.com`,
        password: "Test123!@#",
        confirm_password: "Test123!@#"
      };

      // Register both users
      const user1Res = await request(app)
        .post("/api/auth/register")
        .send(user1Data)
        .expect(201);

      const user2Res = await request(app)
        .post("/api/auth/register")
        .send(user2Data)
        .expect(201);

      user1Token = user1Res.body.token;
      user2Token = user2Res.body.token;

      const user1 = await User.findOne({ email: user1Data.email.toLowerCase() });
      const user2 = await User.findOne({ email: user2Data.email.toLowerCase() });
      user1Id = user1._id;
      user2Id = user2._id;
    });

    it("should maintain recipe isolation between users", async function() {
      // User1 creates a recipe
      const user1RecipeData = {
        title: "User1's Recipe",
        description: "Recipe by User1"
      };

      const user1CreateRes = await request(app)
        .post("/api/recipes")
        .set("Authorization", `Bearer ${user1Token}`)
        .send(user1RecipeData)
        .expect(201);

      user1RecipeId = user1CreateRes.body.recipe._id;

      // User2 creates a recipe
      const user2RecipeData = {
        title: "User2's Recipe",
        description: "Recipe by User2"
      };

      const user2CreateRes = await request(app)
        .post("/api/recipes")
        .set("Authorization", `Bearer ${user2Token}`)
        .send(user2RecipeData)
        .expect(201);

      user2RecipeId = user2CreateRes.body.recipe._id;

      // User1 should only see their own recipe
      const user1MineRes = await request(app)
        .get("/api/recipes/mine")
        .set("Authorization", `Bearer ${user1Token}`)
        .expect(200);

      expect(user1MineRes.body.recipes.length).to.equal(1);
      expect(user1MineRes.body.recipes[0]._id.toString()).to.equal(user1RecipeId.toString());

      // User2 should only see their own recipe
      const user2MineRes = await request(app)
        .get("/api/recipes/mine")
        .set("Authorization", `Bearer ${user2Token}`)
        .expect(200);

      expect(user2MineRes.body.recipes.length).to.equal(1);
      expect(user2MineRes.body.recipes[0]._id.toString()).to.equal(user2RecipeId.toString());

      // Public endpoint should show both recipes
      const publicRes = await request(app)
        .get("/api/recipes")
        .expect(200);

      expect(publicRes.body.recipes.length).to.be.greaterThanOrEqual(2);
      const recipeIds = publicRes.body.recipes.map(r => r._id.toString());
      expect(recipeIds).to.include(user1RecipeId.toString());
      expect(recipeIds).to.include(user2RecipeId.toString());

      // User1 cannot access User2's recipe
      await request(app)
        .get(`/api/recipes/${user2RecipeId}`)
        .set("Authorization", `Bearer ${user1Token}`)
        .expect(403);

      // User2 cannot access User1's recipe
      await request(app)
        .get(`/api/recipes/${user1RecipeId}`)
        .set("Authorization", `Bearer ${user2Token}`)
        .expect(403);

      // User1 cannot update User2's recipe
      await request(app)
        .put(`/api/recipes/${user2RecipeId}`)
        .set("Authorization", `Bearer ${user1Token}`)
        .send({ title: "Hacked", description: "Hacked" })
        .expect(403);

      // User1 cannot delete User2's recipe
      await request(app)
        .delete(`/api/recipes/${user2RecipeId}`)
        .set("Authorization", `Bearer ${user1Token}`)
        .expect(403);
    });
  });

  describe("Admin Workflow: Login → View All → Delete Any Recipe", function() {
    let adminToken, adminId, userToken, userId, recipeId;

    beforeEach(async function() {
      // Create admin
      const adminData = {
        f_name: "Admin",
        l_name: "Test",
        email: `admin${Date.now()}@test.com`,
        password: "Admin123!@#",
        confirm_password: "Admin123!@#"
      };

      // Create admin user directly (since registration creates regular users)
      const hashedPassword = await bcrypt.hash(adminData.password, 10);
      const admin = await User.create({
        ...adminData,
        password: hashedPassword,
        role: "admin",
        active: 1
      });
      adminId = admin._id;

      // Login as admin
      const adminLoginRes = await request(app)
        .post("/api/auth/login")
        .send({
          email: adminData.email,
          password: adminData.password
        })
        .expect(200);

      adminToken = adminLoginRes.body.token;

      // Create a regular user and recipe
      const userData = {
        f_name: "Regular",
        l_name: "User",
        email: `regular${Date.now()}@test.com`,
        password: "Test123!@#",
        confirm_password: "Test123!@#"
      };

      const userRes = await request(app)
        .post("/api/auth/register")
        .send(userData)
        .expect(201);

      userToken = userRes.body.token;
      const user = await User.findOne({ email: userData.email.toLowerCase() });
      userId = user._id;

      // Create a recipe as regular user
      const recipeRes = await request(app)
        .post("/api/recipes")
        .set("Authorization", `Bearer ${userToken}`)
        .send({
          title: "User's Recipe",
          description: "A recipe by regular user"
        })
        .expect(201);

      recipeId = recipeRes.body.recipe._id;
    });

    it("should allow admin to view all recipes", async function() {
      const adminViewRes = await request(app)
        .get("/api/recipes/admin/all")
        .set("Authorization", `Bearer ${adminToken}`)
        .expect(200);

      expect(adminViewRes.body).to.have.property("recipes");
      expect(adminViewRes.body).to.have.property("count");
      expect(adminViewRes.body.recipes.length).to.be.greaterThanOrEqual(1);

      // Verify admin can see the user's recipe
      const recipeIds = adminViewRes.body.recipes.map(r => r._id.toString());
      expect(recipeIds).to.include(recipeId.toString());
    });

    it("should allow admin to delete any recipe", async function() {
      // Admin deletes user's recipe
      const deleteRes = await request(app)
        .delete(`/api/recipes/admin/${recipeId}`)
        .set("Authorization", `Bearer ${adminToken}`)
        .expect(200);

      expect(deleteRes.body.message).to.equal("Recipe deleted by admin");

      // Verify recipe was deleted
      const deletedRecipe = await Recipe.findById(recipeId);
      expect(deletedRecipe).to.be.null;

      // Verify activity was logged
      const activities = await Activity.find({ 
        recipeId: recipeId,
        action: "deleted"
      });
      expect(activities.length).to.be.greaterThan(0);
      expect(activities[0].userId.toString()).to.equal(adminId.toString());
    });

    it("should prevent regular user from accessing admin endpoints", async function() {
      // Regular user cannot view all recipes via admin endpoint
      await request(app)
        .get("/api/recipes/admin/all")
        .set("Authorization", `Bearer ${userToken}`)
        .expect(403);

      // Regular user cannot delete via admin endpoint
      await request(app)
        .delete(`/api/recipes/admin/${recipeId}`)
        .set("Authorization", `Bearer ${userToken}`)
        .expect(403);
    });
  });

  describe("Activity Tracking Integration", function() {
    let userToken, userId, recipeId;

    beforeEach(async function() {
      const userData = {
        f_name: "Activity",
        l_name: "Test",
        email: `activity${Date.now()}@test.com`,
        password: "Test123!@#",
        confirm_password: "Test123!@#"
      };

      const registerRes = await request(app)
        .post("/api/auth/register")
        .send(userData)
        .expect(201);

      userToken = registerRes.body.token;
      const user = await User.findOne({ email: userData.email.toLowerCase() });
      userId = user._id;
    });

    it("should track all recipe activities and display them", async function() {
      // Create a recipe
      const createRes = await request(app)
        .post("/api/recipes")
        .set("Authorization", `Bearer ${userToken}`)
        .send({
          title: "Activity Test Recipe",
          description: "Testing activity tracking"
        })
        .expect(201);

      recipeId = createRes.body.recipe._id;

      // Verify create activity was logged
      let activities = await Activity.find({ recipeId: recipeId });
      expect(activities.length).to.be.greaterThan(0);
      expect(activities[0].action).to.equal("created");

      // Update the recipe
      await request(app)
        .put(`/api/recipes/${recipeId}`)
        .set("Authorization", `Bearer ${userToken}`)
        .send({
          title: "Updated Activity Test Recipe",
          description: "Updated description"
        })
        .expect(200);

      // Verify update activity was logged
      activities = await Activity.find({ recipeId: recipeId });
      const updateActivities = activities.filter(a => a.action === "updated");
      expect(updateActivities.length).to.be.greaterThan(0);

      // View activities via API
      const activitiesRes = await request(app)
        .get("/api/activities")
        .expect(200);

      expect(activitiesRes.body).to.have.property("activities");
      expect(activitiesRes.body.activities).to.be.an("array");
      expect(activitiesRes.body.activities.length).to.be.greaterThan(0);

      // Verify our recipe activities are in the list
      const recipeActivities = activitiesRes.body.activities.filter(
        a => a.recipeTitle === "Updated Activity Test Recipe"
      );
      expect(recipeActivities.length).to.be.greaterThan(0);

      // Delete the recipe
      await request(app)
        .delete(`/api/recipes/${recipeId}`)
        .set("Authorization", `Bearer ${userToken}`)
        .expect(200);

      // Verify delete activity was logged
      const deleteActivities = await Activity.find({ 
        recipeId: recipeId,
        action: "deleted"
      });
      expect(deleteActivities.length).to.be.greaterThan(0);
    });
  });

  describe("Authentication and Authorization Flow", function() {
    it("should enforce authentication on protected routes", async function() {
      // Try to access protected route without token
      await request(app)
        .get("/api/recipes/mine")
        .expect(401);

      await request(app)
        .post("/api/recipes")
        .send({ title: "Test", description: "Test" })
        .expect(401);

      // Try with invalid token
      await request(app)
        .get("/api/recipes/mine")
        .set("Authorization", "Bearer invalid-token")
        .expect(401);
    });

    it("should enforce role-based access control", async function() {
      // Create regular user
      const userData = {
        f_name: "Regular",
        l_name: "User",
        email: `regular${Date.now()}@test.com`,
        password: "Test123!@#",
        confirm_password: "Test123!@#"
      };

      const registerRes = await request(app)
        .post("/api/auth/register")
        .send(userData)
        .expect(201);

      const userToken = registerRes.body.token;

      // Regular user cannot access admin endpoints
      await request(app)
        .get("/api/auth/admin/me")
        .set("Authorization", `Bearer ${userToken}`)
        .expect(403);

      await request(app)
        .get("/api/recipes/admin/all")
        .set("Authorization", `Bearer ${userToken}`)
        .expect(403);
    });
  });

  describe("Recipe CRUD with Activity Tracking", function() {
    let userToken, userId;

    beforeEach(async function() {
      const userData = {
        f_name: "CRUD",
        l_name: "Test",
        email: `crud${Date.now()}@test.com`,
        password: "Test123!@#",
        confirm_password: "Test123!@#"
      };

      const registerRes = await request(app)
        .post("/api/auth/register")
        .send(userData)
        .expect(201);

      userToken = registerRes.body.token;
      const user = await User.findOne({ email: userData.email.toLowerCase() });
      userId = user._id;
    });

    it("should create multiple recipes and track activities for each", async function() {
      const recipeTitles = ["Recipe 1", "Recipe 2", "Recipe 3"];
      const recipeIds = [];

      // Create multiple recipes
      for (const title of recipeTitles) {
        const createRes = await request(app)
          .post("/api/recipes")
          .set("Authorization", `Bearer ${userToken}`)
          .send({
            title: title,
            description: `Description for ${title}`
          })
          .expect(201);

        recipeIds.push(createRes.body.recipe._id);

        // Verify activity was logged for each
        const activities = await Activity.find({ 
          recipeId: createRes.body.recipe._id,
          action: "created"
        });
        expect(activities.length).to.equal(1);
      }

      // Verify all recipes are in user's list
      const mineRes = await request(app)
        .get("/api/recipes/mine")
        .set("Authorization", `Bearer ${userToken}`)
        .expect(200);

      expect(mineRes.body.recipes.length).to.equal(3);

      // Verify all activities are tracked
      const allActivities = await Activity.find({ userId: userId });
      const createActivities = allActivities.filter(a => a.action === "created");
      expect(createActivities.length).to.be.greaterThanOrEqual(3);
    });
  });
});
