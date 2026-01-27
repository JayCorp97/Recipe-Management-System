require("../helpers/testSetup");
const { expect } = require("chai");
const request = require("supertest");
const app = require("../../app");
const Activity = require("../../models/Activity");
const { createTestUser, createTestRecipe, createTestActivity } = require("../helpers/testSetup");

describe("Activity Routes", function() {
  let userId, recipeId;

  beforeEach(async function() {
    const user = await createTestUser();
    userId = user._id;
    const recipe = await createTestRecipe(userId);
    recipeId = recipe._id;
  });

  describe("GET /api/activities - Get Activities", function() {
    it("should return activities (public endpoint)", async function() {
      await createTestActivity(userId, recipeId, { action: "created" });
      await createTestActivity(userId, recipeId, { action: "updated" });

      const res = await request(app)
        .get("/api/activities")
        .expect(200);

      expect(res.body).to.have.property("activities");
      expect(res.body.activities).to.be.an("array");
      expect(res.body.activities.length).to.be.greaterThanOrEqual(2);
    });

    it("should return activities sorted by createdAt descending", async function() {
      const activity1 = await createTestActivity(userId, recipeId, { 
        action: "created",
        recipeTitle: "First Activity"
      });
      
      await new Promise(resolve => setTimeout(resolve, 100)); // Small delay
      
      const activity2 = await createTestActivity(userId, recipeId, { 
        action: "updated",
        recipeTitle: "Second Activity"
      });

      const res = await request(app)
        .get("/api/activities")
        .expect(200);

      const activities = res.body.activities;
      expect(activities[0].recipeTitle).to.equal("Second Activity");
      expect(activities[1].recipeTitle).to.equal("First Activity");
    });

    it("should respect limit query parameter", async function() {
      // Create more than 5 activities
      for (let i = 0; i < 10; i++) {
        await createTestActivity(userId, recipeId, { 
          action: "created",
          recipeTitle: `Recipe ${i}`
        });
      }

      const res = await request(app)
        .get("/api/activities?limit=5")
        .expect(200);

      expect(res.body.activities.length).to.equal(5);
    });

    it("should use default limit of 20", async function() {
      // Create 25 activities
      for (let i = 0; i < 25; i++) {
        await createTestActivity(userId, recipeId, { 
          action: "created",
          recipeTitle: `Recipe ${i}`
        });
      }

      const res = await request(app)
        .get("/api/activities")
        .expect(200);

      expect(res.body.activities.length).to.equal(20);
    });

    it("should return only selected fields", async function() {
      await createTestActivity(userId, recipeId, { action: "created" });

      const res = await request(app)
        .get("/api/activities")
        .expect(200);

      const activity = res.body.activities[0];
      expect(activity).to.have.property("userName");
      expect(activity).to.have.property("action");
      expect(activity).to.have.property("recipeTitle");
      expect(activity).to.have.property("createdAt");
      expect(activity).to.have.property("_id");
      // Should not have other fields
      expect(activity).to.not.have.property("userId");
      expect(activity).to.not.have.property("recipeId");
    });

    it("should return empty array when no activities exist", async function() {
      // Clear all activities before this test
      await Activity.deleteMany({});
      
      const res = await request(app)
        .get("/api/activities")
        .expect(200);

      expect(res.body.activities).to.be.an("array").that.is.empty;
    });

    it("should handle invalid limit gracefully", async function() {
      await createTestActivity(userId, recipeId, { action: "created" });

      const res = await request(app)
        .get("/api/activities?limit=invalid")
        .expect(200);

      // Should use default limit
      expect(res.body.activities).to.be.an("array");
    });
  });

  describe("Activity Data Integrity", function() {
    it("should include all required activity fields", async function() {
      await createTestActivity(userId, recipeId, { 
        action: "created",
        recipeTitle: "Test Recipe"
      });

      const res = await request(app)
        .get("/api/activities")
        .expect(200);

      const activity = res.body.activities[0];
      expect(activity.userName).to.exist;
      expect(activity.action).to.exist;
      expect(activity.recipeTitle).to.exist;
      expect(activity.createdAt).to.exist;
    });

    it("should handle different action types", async function() {
      await createTestActivity(userId, recipeId, { action: "created" });
      await createTestActivity(userId, recipeId, { action: "updated" });
      await createTestActivity(userId, recipeId, { action: "deleted" });

      const res = await request(app)
        .get("/api/activities")
        .expect(200);

      const actions = res.body.activities.map(a => a.action);
      expect(actions).to.include("created");
      expect(actions).to.include("updated");
      expect(actions).to.include("deleted");
    });
  });
});
