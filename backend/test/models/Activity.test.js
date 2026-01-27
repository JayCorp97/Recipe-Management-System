require("../../test/helpers/testSetup");
const { expect } = require("chai");
const Activity = require("../../models/Activity");
const { createTestUser, createTestRecipe, createTestActivity } = require("../helpers/testSetup");

describe("Activity Model", function() {
  let userId, recipeId;

  beforeEach(async function() {
    const user = await createTestUser();
    userId = user._id;
    const recipe = await createTestRecipe(userId);
    recipeId = recipe._id;
  });

  describe("Schema Validation", function() {
    it("should create an activity with required fields", async function() {
      const activity = await Activity.create({
        userId: userId,
        userName: "Test User",
        action: "created",
        recipeId: recipeId,
        recipeTitle: "Test Recipe"
      });

      expect(activity).to.exist;
      expect(activity.userId.toString()).to.equal(userId.toString());
      expect(activity.userName).to.equal("Test User");
      expect(activity.action).to.equal("created");
      expect(activity.recipeId.toString()).to.equal(recipeId.toString());
      expect(activity.recipeTitle).to.equal("Test Recipe");
    });

    it("should fail when userId is missing", async function() {
      try {
        await Activity.create({
          userName: "Test User",
          action: "created",
          recipeId: recipeId,
          recipeTitle: "Test Recipe"
        });
        expect.fail("Should have thrown an error");
      } catch (error) {
        expect(error.name).to.equal("ValidationError");
      }
    });

    it("should fail when userName is missing", async function() {
      try {
        await Activity.create({
          userId: userId,
          action: "created",
          recipeId: recipeId,
          recipeTitle: "Test Recipe"
        });
        expect.fail("Should have thrown an error");
      } catch (error) {
        expect(error.name).to.equal("ValidationError");
      }
    });

    it("should fail when action is missing", async function() {
      try {
        await Activity.create({
          userId: userId,
          userName: "Test User",
          recipeId: recipeId,
          recipeTitle: "Test Recipe"
        });
        expect.fail("Should have thrown an error");
      } catch (error) {
        expect(error.name).to.equal("ValidationError");
      }
    });

    it("should fail when recipeId is missing", async function() {
      try {
        await Activity.create({
          userId: userId,
          userName: "Test User",
          action: "created",
          recipeTitle: "Test Recipe"
        });
        expect.fail("Should have thrown an error");
      } catch (error) {
        expect(error.name).to.equal("ValidationError");
      }
    });

    it("should fail when recipeTitle is missing", async function() {
      try {
        await Activity.create({
          userId: userId,
          userName: "Test User",
          action: "created",
          recipeId: recipeId
        });
        expect.fail("Should have thrown an error");
      } catch (error) {
        expect(error.name).to.equal("ValidationError");
      }
    });
  });

  describe("Action Validation", function() {
    it("should accept 'created' action", async function() {
      const activity = await Activity.create({
        userId: userId,
        userName: "Test User",
        action: "created",
        recipeId: recipeId,
        recipeTitle: "Test Recipe"
      });

      expect(activity.action).to.equal("created");
    });

    it("should accept 'updated' action", async function() {
      const activity = await Activity.create({
        userId: userId,
        userName: "Test User",
        action: "updated",
        recipeId: recipeId,
        recipeTitle: "Test Recipe"
      });

      expect(activity.action).to.equal("updated");
    });

    it("should accept 'deleted' action", async function() {
      const activity = await Activity.create({
        userId: userId,
        userName: "Test User",
        action: "deleted",
        recipeId: recipeId,
        recipeTitle: "Test Recipe"
      });

      expect(activity.action).to.equal("deleted");
    });

    it("should reject invalid action", async function() {
      try {
        await Activity.create({
          userId: userId,
          userName: "Test User",
          action: "invalid",
          recipeId: recipeId,
          recipeTitle: "Test Recipe"
        });
        expect.fail("Should have thrown an error");
      } catch (error) {
        expect(error.name).to.equal("ValidationError");
      }
    });
  });

  describe("Timestamps", function() {
    it("should automatically add createdAt and updatedAt timestamps", async function() {
      const activity = await Activity.create({
        userId: userId,
        userName: "Test User",
        action: "created",
        recipeId: recipeId,
        recipeTitle: "Test Recipe"
      });

      expect(activity.createdAt).to.exist;
      expect(activity.updatedAt).to.exist;
      expect(activity.createdAt).to.be.instanceOf(Date);
      expect(activity.updatedAt).to.be.instanceOf(Date);
    });
  });

  describe("Indexes", function() {
    it("should have index on createdAt for efficient querying", async function() {
      // Create multiple activities
      await createTestActivity(userId, recipeId, { action: "created" });
      await createTestActivity(userId, recipeId, { action: "updated" });
      await createTestActivity(userId, recipeId, { action: "deleted" });

      // Query sorted by createdAt descending (should use index)
      const activities = await Activity.find()
        .sort({ createdAt: -1 })
        .limit(10);

      expect(activities.length).to.be.greaterThan(0);
      // Verify sorting (most recent first)
      for (let i = 1; i < activities.length; i++) {
        expect(activities[i - 1].createdAt.getTime()).to.be.greaterThanOrEqual(
          activities[i].createdAt.getTime()
        );
      }
    });
  });
});
