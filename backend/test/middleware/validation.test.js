const { expect } = require("chai");
const sinon = require("sinon");
const request = require("supertest");
const express = require("express");
const { validateRegister, validateLogin } = require("../../middleware/validation");

describe("Validation Middleware", function() {
  let app;

  beforeEach(function() {
    app = express();
    app.use(express.json());
  });

  describe("validateRegister", function() {
    it("should pass validation with valid registration data", function(done) {
      app.post("/register", validateRegister, (req, res) => {
        res.status(200).json({ message: "Valid" });
      });

      request(app)
        .post("/register")
        .send({
          f_name: "John",
          l_name: "Doe",
          email: "john.doe@example.com",
          password: "Test123!@#",
          confirm_password: "Test123!@#"
        })
        .expect(200, done);
    });

    it("should fail validation when first name is missing", function(done) {
      app.post("/register", validateRegister, (req, res) => {
        res.status(200).json({ message: "Valid" });
      });

      request(app)
        .post("/register")
        .send({
          l_name: "Doe",
          email: "john.doe@example.com",
          password: "Test123!@#",
          confirm_password: "Test123!@#"
        })
        .expect(400, done);
    });

    it("should fail validation when email is invalid", function(done) {
      app.post("/register", validateRegister, (req, res) => {
        res.status(200).json({ message: "Valid" });
      });

      request(app)
        .post("/register")
        .send({
          f_name: "John",
          l_name: "Doe",
          email: "invalid-email",
          password: "Test123!@#",
          confirm_password: "Test123!@#"
        })
        .expect(400, done);
    });

    it("should fail validation when password is too short", function(done) {
      app.post("/register", validateRegister, (req, res) => {
        res.status(200).json({ message: "Valid" });
      });

      request(app)
        .post("/register")
        .send({
          f_name: "John",
          l_name: "Doe",
          email: "john.doe@example.com",
          password: "Test1!",
          confirm_password: "Test1!"
        })
        .expect(400, done);
    });

    it("should fail validation when password lacks uppercase", function(done) {
      app.post("/register", validateRegister, (req, res) => {
        res.status(200).json({ message: "Valid" });
      });

      request(app)
        .post("/register")
        .send({
          f_name: "John",
          l_name: "Doe",
          email: "john.doe@example.com",
          password: "test123!@#",
          confirm_password: "test123!@#"
        })
        .expect(400, done);
    });

    it("should fail validation when passwords do not match", function(done) {
      app.post("/register", validateRegister, (req, res) => {
        res.status(200).json({ message: "Valid" });
      });

      request(app)
        .post("/register")
        .send({
          f_name: "John",
          l_name: "Doe",
          email: "john.doe@example.com",
          password: "Test123!@#",
          confirm_password: "Test123!@#Different"
        })
        .expect(400, done);
    });

    it("should trim whitespace from names", function(done) {
      app.post("/register", validateRegister, (req, res) => {
        expect(req.body.f_name).to.equal("John");
        expect(req.body.l_name).to.equal("Doe");
        res.status(200).json({ message: "Valid" });
      });

      request(app)
        .post("/register")
        .send({
          f_name: "  John  ",
          l_name: "  Doe  ",
          email: "john.doe@example.com",
          password: "Test123!@#",
          confirm_password: "Test123!@#"
        })
        .expect(200, done);
    });
  });

  describe("validateLogin", function() {
    it("should pass validation with valid login data", function(done) {
      app.post("/login", validateLogin, (req, res) => {
        res.status(200).json({ message: "Valid" });
      });

      request(app)
        .post("/login")
        .send({
          email: "john.doe@example.com",
          password: "Test123!@#"
        })
        .expect(200, done);
    });

    it("should fail validation when email is missing", function(done) {
      app.post("/login", validateLogin, (req, res) => {
        res.status(200).json({ message: "Valid" });
      });

      request(app)
        .post("/login")
        .send({
          password: "Test123!@#"
        })
        .expect(400, done);
    });

    it("should fail validation when password is missing", function(done) {
      app.post("/login", validateLogin, (req, res) => {
        res.status(200).json({ message: "Valid" });
      });

      request(app)
        .post("/login")
        .send({
          email: "john.doe@example.com"
        })
        .expect(400, done);
    });

    it("should fail validation when email format is invalid", function(done) {
      app.post("/login", validateLogin, (req, res) => {
        res.status(200).json({ message: "Valid" });
      });

      request(app)
        .post("/login")
        .send({
          email: "invalid-email",
          password: "Test123!@#"
        })
        .expect(400, done);
    });

    it("should normalize email", function(done) {
      app.post("/login", validateLogin, (req, res) => {
        expect(req.body.email).to.equal("john.doe@example.com");
        res.status(200).json({ message: "Valid" });
      });

      request(app)
        .post("/login")
        .send({
          email: "  JOHN.DOE@EXAMPLE.COM  ",
          password: "Test123!@#"
        })
        .expect(200, done);
    });
  });
});
