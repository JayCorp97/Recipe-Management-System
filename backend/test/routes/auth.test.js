require("../helpers/testSetup");
const { expect } = require("chai");
const request = require("supertest");
const app = require("../../app");
const User = require("../../models/User");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { createTestUser, createTestAdmin, generateToken } = require("../helpers/testSetup");

describe("Auth Routes", function() {
  describe("POST /api/auth/register - User Registration", function() {
    it("should register a new user with valid data", async function() {
      const userData = {
        f_name: "John",
        l_name: "Doe",
        email: `test${Date.now()}@example.com`,
        password: "Test123!@#",
        confirm_password: "Test123!@#"
      };

      const res = await request(app)
        .post("/api/auth/register")
        .send(userData)
        .expect(201);

      expect(res.body).to.have.property("message", "Registered successfully");
      expect(res.body).to.have.property("token");
      
      // Verify user was created
      const user = await User.findOne({ email: userData.email.toLowerCase() });
      expect(user).to.exist;
      expect(user.f_name).to.equal(userData.f_name);
    });

    it("should fail with duplicate email", async function() {
      const email = `test${Date.now()}@example.com`;
      const userData = {
        f_name: "John",
        l_name: "Doe",
        email: email,
        password: "Test123!@#",
        confirm_password: "Test123!@#"
      };

      await request(app)
        .post("/api/auth/register")
        .send(userData)
        .expect(201);

      // Try to register again with same email
      const res = await request(app)
        .post("/api/auth/register")
        .send(userData)
        .expect(400);

      expect(res.body.error.code).to.equal("VALIDATION_ERROR");
    });

    it("should fail when passwords don't match", async function() {
      const userData = {
        f_name: "John",
        l_name: "Doe",
        email: `test${Date.now()}@example.com`,
        password: "Test123!@#",
        confirm_password: "Different123!@#"
      };

      const res = await request(app)
        .post("/api/auth/register")
        .send(userData)
        .expect(400);

      // Check if error message or details contains "do not match"
      const errorMessage = res.body.error.message || "";
      const errorDetails = res.body.error.details || [];
      const allErrors = [errorMessage, ...(Array.isArray(errorDetails) ? errorDetails : [errorDetails])].join(" ");
      expect(allErrors.toLowerCase()).to.include("do not match");
    });

    it("should fail with weak password", async function() {
      const userData = {
        f_name: "John",
        l_name: "Doe",
        email: `test${Date.now()}@example.com`,
        password: "weak",
        confirm_password: "weak"
      };

      const res = await request(app)
        .post("/api/auth/register")
        .send(userData)
        .expect(400);

      expect(res.body.error.code).to.equal("VALIDATION_ERROR");
    });

    it("should hash password before storing", async function() {
      const userData = {
        f_name: "John",
        l_name: "Doe",
        email: `test${Date.now()}@example.com`,
        password: "Test123!@#",
        confirm_password: "Test123!@#"
      };

      await request(app)
        .post("/api/auth/register")
        .send(userData)
        .expect(201);

      const user = await User.findOne({ email: userData.email.toLowerCase() });
      expect(user.password).to.not.equal(userData.password);
      expect(await bcrypt.compare(userData.password, user.password)).to.be.true;
    });

    it("should normalize email to lowercase", async function() {
      const userData = {
        f_name: "John",
        l_name: "Doe",
        email: `TEST${Date.now()}@EXAMPLE.COM`,
        password: "Test123!@#",
        confirm_password: "Test123!@#"
      };

      await request(app)
        .post("/api/auth/register")
        .send(userData)
        .expect(201);

      const user = await User.findOne({ email: userData.email.toLowerCase() });
      expect(user.email).to.equal(userData.email.toLowerCase());
    });

    it("should return JWT token on successful registration", async function() {
      const userData = {
        f_name: "John",
        l_name: "Doe",
        email: `test${Date.now()}@example.com`,
        password: "Test123!@#",
        confirm_password: "Test123!@#"
      };

      const res = await request(app)
        .post("/api/auth/register")
        .send(userData)
        .expect(201);

      expect(res.body.token).to.exist;
      
      // Verify token is valid
      const decoded = jwt.verify(res.body.token, process.env.JWT_SECRET || "test-secret-key");
      expect(decoded).to.have.property("id");
      expect(decoded).to.have.property("role", "user");
    });
  });

  describe("POST /api/auth/login - User Login", function() {
    let user, userData;

    beforeEach(async function() {
      userData = {
        f_name: "John",
        l_name: "Doe",
        email: `test${Date.now()}@example.com`,
        password: "Test123!@#"
      };

      const hashedPassword = await bcrypt.hash(userData.password, 10);
      user = await User.create({
        ...userData,
        password: hashedPassword,
        active: 1
      });
    });

    it("should login with valid credentials", async function() {
      const res = await request(app)
        .post("/api/auth/login")
        .send({
          email: userData.email,
          password: userData.password
        })
        .expect(200);

      expect(res.body).to.have.property("token");
      
      // Verify token
      const decoded = jwt.verify(res.body.token, process.env.JWT_SECRET || "test-secret-key");
      expect(decoded.id.toString()).to.equal(user._id.toString());
    });

    it("should fail with invalid email", async function() {
      const res = await request(app)
        .post("/api/auth/login")
        .send({
          email: "nonexistent@example.com",
          password: userData.password
        })
        .expect(401);

      expect(res.body.error.code).to.equal("AUTH_ERROR");
    });

    it("should fail with invalid password", async function() {
      const res = await request(app)
        .post("/api/auth/login")
        .send({
          email: userData.email,
          password: "WrongPassword123!@#"
        })
        .expect(401);

      expect(res.body.error.code).to.equal("AUTH_ERROR");
    });

    it("should fail for inactive user", async function() {
      user.active = 0;
      await user.save();

      const res = await request(app)
        .post("/api/auth/login")
        .send({
          email: userData.email,
          password: userData.password
        })
        .expect(403);

      expect(res.body.error.code).to.equal("FORBIDDEN");
    });

    it("should normalize email during login", async function() {
      const res = await request(app)
        .post("/api/auth/login")
        .send({
          email: userData.email.toUpperCase(),
          password: userData.password
        })
        .expect(200);

      expect(res.body).to.have.property("token");
    });
  });

  describe("POST /api/auth/request-otp - Request OTP", function() {
    let user;

    beforeEach(async function() {
      user = await createTestUser({ active: 1 });
    });

    it("should generate OTP for valid user", async function() {
      const res = await request(app)
        .post("/api/auth/request-otp")
        .send({ email: user.email })
        .expect(200);

      expect(res.body.message).to.include("OTP sent");

      // Verify OTP was saved
      const updatedUser = await User.findById(user._id);
      expect(updatedUser.otp).to.exist;
      expect(updatedUser.otpExpires).to.exist;
    });

    it("should fail for non-existent user", async function() {
      const res = await request(app)
        .post("/api/auth/request-otp")
        .send({ email: "nonexistent@example.com" })
        .expect(404);

      expect(res.body.error.code).to.equal("NOT_FOUND");
    });

    it("should fail for inactive user", async function() {
      user.active = 0;
      await user.save();

      const res = await request(app)
        .post("/api/auth/request-otp")
        .send({ email: user.email })
        .expect(403);

      expect(res.body.error.code).to.equal("FORBIDDEN");
    });
  });

  describe("POST /api/auth/verify-otp - Verify OTP", function() {
    let user, otp;

    beforeEach(async function() {
      user = await createTestUser({ active: 1 });
      otp = "123456";
      user.otp = otp;
      user.otpExpires = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes
      await user.save();
    });

    it("should login with valid OTP", async function() {
      const res = await request(app)
        .post("/api/auth/verify-otp")
        .send({
          email: user.email,
          otp: otp
        })
        .expect(200);

      expect(res.body).to.have.property("token");

      // Verify OTP was cleared
      const updatedUser = await User.findById(user._id);
      expect(updatedUser.otp).to.be.null;
      expect(updatedUser.otpExpires).to.be.null;
    });

    it("should fail with invalid OTP", async function() {
      const res = await request(app)
        .post("/api/auth/verify-otp")
        .send({
          email: user.email,
          otp: "000000"
        })
        .expect(401);

      expect(res.body.error.code).to.equal("AUTH_ERROR");
    });

    it("should fail with expired OTP", async function() {
      user.otpExpires = new Date(Date.now() - 1000); // Expired
      await user.save();

      const res = await request(app)
        .post("/api/auth/verify-otp")
        .send({
          email: user.email,
          otp: otp
        })
        .expect(401);

      expect(res.body.error.code).to.equal("AUTH_ERROR");
    });
  });

  describe("GET /api/auth/me - Get Current User", function() {
    it("should return current user info", async function() {
      const user = await createTestUser();
      const token = generateToken(user._id, user.role);

      const res = await request(app)
        .get("/api/auth/me")
        .set("Authorization", `Bearer ${token}`)
        .expect(200);

      expect(res.body._id.toString()).to.equal(user._id.toString());
      expect(res.body).to.not.have.property("password");
    });

    it("should fail without authentication", async function() {
      await request(app)
        .get("/api/auth/me")
        .expect(401);
    });
  });

  describe("GET /api/auth/admin/me - Get Admin User", function() {
    it("should return admin user info", async function() {
      const admin = await createTestAdmin();
      const token = generateToken(admin._id, "admin");

      const res = await request(app)
        .get("/api/auth/admin/me")
        .set("Authorization", `Bearer ${token}`)
        .expect(200);

      expect(res.body.role).to.equal("admin");
    });

    it("should fail for regular user", async function() {
      const user = await createTestUser();
      const token = generateToken(user._id, "user");

      await request(app)
        .get("/api/auth/admin/me")
        .set("Authorization", `Bearer ${token}`)
        .expect(403);
    });
  });

  describe("POST /api/auth/logout - Logout", function() {
    it("should logout successfully", async function() {
      const user = await createTestUser();
      const token = generateToken(user._id, user.role);

      const res = await request(app)
        .post("/api/auth/logout")
        .set("Authorization", `Bearer ${token}`)
        .expect(200);

      expect(res.body.message).to.include("Logged out");
    });

    it("should fail without authentication", async function() {
      await request(app)
        .post("/api/auth/logout")
        .expect(401);
    });
  });
});
