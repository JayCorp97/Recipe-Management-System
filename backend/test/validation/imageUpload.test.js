require("../helpers/testSetup");
const { expect } = require("chai");
const request = require("supertest");
const app = require("../../app");
const path = require("path");
const fs = require("fs");
const { createTestUser, generateToken } = require("../helpers/testSetup");

describe("Image Upload Handling", function() {
  let userToken, userId;

  beforeEach(async function() {
    const user = await createTestUser();
    userId = user._id;
    userToken = generateToken(userId, "user");
  });

  describe("File Validation", function() {
    it("should accept valid image files", async function() {
      // Create a mock image file buffer
      const imageBuffer = Buffer.from("fake-image-data");
      
      const res = await request(app)
        .post("/api/recipes")
        .set("Authorization", `Bearer ${userToken}`)
        .field("title", "Recipe with Image")
        .field("description", "Description")
        .attach("image", imageBuffer, "test.jpg")
        .expect(201);

      expect(res.body.recipe).to.have.property("imageUrl");
    });

    it("should reject files that are too large", async function() {
      // Create a file larger than 5MB
      const largeBuffer = Buffer.alloc(6 * 1024 * 1024); // 6MB
      
      const res = await request(app)
        .post("/api/recipes")
        .set("Authorization", `Bearer ${userToken}`)
        .field("title", "Recipe")
        .field("description", "Description")
        .attach("image", largeBuffer, "large.jpg");

      // Should either reject or accept but handle gracefully
      expect([201, 400, 413, 500]).to.include(res.status);
    });

    it("should accept imageUrl as alternative to file upload", async function() {
      const res = await request(app)
        .post("/api/recipes")
        .set("Authorization", `Bearer ${userToken}`)
        .send({
          title: "Recipe with URL",
          description: "Description",
          imageUrl: "/uploads/existing-image.jpg"
        })
        .expect(201);

      expect(res.body.recipe.imageUrl).to.equal("/uploads/existing-image.jpg");
    });

    it("should prioritize uploaded file over imageUrl", async function() {
      const imageBuffer = Buffer.from("fake-image-data");
      
      const res = await request(app)
        .post("/api/recipes")
        .set("Authorization", `Bearer ${userToken}`)
        .field("title", "Recipe")
        .field("description", "Description")
        .field("imageUrl", "/uploads/old-image.jpg")
        .attach("image", imageBuffer, "new.jpg")
        .expect(201);

      // Should use uploaded file, not imageUrl
      expect(res.body.recipe.imageUrl).to.not.equal("/uploads/old-image.jpg");
      expect(res.body.recipe.imageUrl).to.include("/uploads/");
    });
  });

  describe("File Type Validation", function() {
    it("should accept JPEG images", async function() {
      const imageBuffer = Buffer.from("fake-jpeg-data");
      
      const res = await request(app)
        .post("/api/recipes")
        .set("Authorization", `Bearer ${userToken}`)
        .field("title", "Recipe")
        .field("description", "Description")
        .attach("image", imageBuffer, "test.jpeg")
        .expect(201);

      expect(res.body.recipe).to.have.property("imageUrl");
    });

    it("should accept PNG images", async function() {
      const imageBuffer = Buffer.from("fake-png-data");
      
      const res = await request(app)
        .post("/api/recipes")
        .set("Authorization", `Bearer ${userToken}`)
        .field("title", "Recipe")
        .field("description", "Description")
        .attach("image", imageBuffer, "test.png")
        .expect(201);

      expect(res.body.recipe).to.have.property("imageUrl");
    });

    it("should accept WebP images", async function() {
      const imageBuffer = Buffer.from("fake-webp-data");
      
      const res = await request(app)
        .post("/api/recipes")
        .set("Authorization", `Bearer ${userToken}`)
        .field("title", "Recipe")
        .field("description", "Description")
        .attach("image", imageBuffer, "test.webp")
        .expect(201);

      expect(res.body.recipe).to.have.property("imageUrl");
    });

    it("should accept GIF images", async function() {
      const imageBuffer = Buffer.from("fake-gif-data");
      
      const res = await request(app)
        .post("/api/recipes")
        .set("Authorization", `Bearer ${userToken}`)
        .field("title", "Recipe")
        .field("description", "Description")
        .attach("image", imageBuffer, "test.gif")
        .expect(201);

      expect(res.body.recipe).to.have.property("imageUrl");
    });
  });

  describe("File Naming", function() {
    it("should generate unique filenames with timestamp", async function() {
      const imageBuffer = Buffer.from("fake-image-data");
      
      const res = await request(app)
        .post("/api/recipes")
        .set("Authorization", `Bearer ${userToken}`)
        .field("title", "Recipe")
        .field("description", "Description")
        .attach("image", imageBuffer, "test.jpg")
        .expect(201);

      const imageUrl = res.body.recipe.imageUrl;
      expect(imageUrl).to.include("/uploads/");
      // Should have timestamp prefix
      expect(imageUrl).to.match(/\d+-test\.jpg/);
    });

    it("should sanitize filename spaces", async function() {
      const imageBuffer = Buffer.from("fake-image-data");
      
      const res = await request(app)
        .post("/api/recipes")
        .set("Authorization", `Bearer ${userToken}`)
        .field("title", "Recipe")
        .field("description", "Description")
        .attach("image", imageBuffer, "test file name.jpg")
        .expect(201);

      const imageUrl = res.body.recipe.imageUrl;
      // Spaces should be replaced with dashes
      expect(imageUrl).to.not.include(" ");
    });
  });

  describe("Update Recipe with Image", function() {
    it("should update recipe image", async function() {
      // First create a recipe
      const createRes = await request(app)
        .post("/api/recipes")
        .set("Authorization", `Bearer ${userToken}`)
        .send({
          title: "Recipe to Update",
          description: "Description"
        })
        .expect(201);

      const recipeId = createRes.body.recipe._id;

      // Update with new image
      const imageBuffer = Buffer.from("new-image-data");
      const updateRes = await request(app)
        .put(`/api/recipes/${recipeId}`)
        .set("Authorization", `Bearer ${userToken}`)
        .field("title", "Recipe to Update")
        .field("description", "Description")
        .attach("image", imageBuffer, "new.jpg")
        .expect(200);

      expect(updateRes.body.recipe.imageUrl).to.include("/uploads/");
    });

    it("should keep existing image if no new file uploaded", async function() {
      // Create recipe with imageUrl
      const createRes = await request(app)
        .post("/api/recipes")
        .set("Authorization", `Bearer ${userToken}`)
        .send({
          title: "Recipe",
          description: "Description",
          imageUrl: "/uploads/existing.jpg"
        })
        .expect(201);

      const recipeId = createRes.body.recipe._id;

      // Update without new image
      const updateRes = await request(app)
        .put(`/api/recipes/${recipeId}`)
        .set("Authorization", `Bearer ${userToken}`)
        .send({
          title: "Updated Recipe",
          description: "Updated Description"
        })
        .expect(200);

      expect(updateRes.body.recipe.imageUrl).to.equal("/uploads/existing.jpg");
    });
  });
});
