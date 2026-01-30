require("../../test/helpers/testSetup");
const { expect } = require("chai");
const bcrypt = require("bcryptjs");
const User = require("../../models/User");
const { createTestUser } = require("../helpers/testSetup");

describe("User Model", function() {
  describe("Schema Validation", function() {
    it("should create a user with required fields", async function() {
      const user = await User.create({
        f_name: "John",
        l_name: "Doe",
        email: `test${Date.now()}@example.com`,
        password: "hashedpassword123"
      });

      expect(user).to.exist;
      expect(user.f_name).to.equal("John");
      expect(user.l_name).to.equal("Doe");
      expect(user.email).to.exist;
    });

    it("should fail when f_name is missing", async function() {
      try {
        await User.create({
          l_name: "Doe",
          email: `test${Date.now()}@example.com`,
          password: "hashedpassword123"
        });
        expect.fail("Should have thrown an error");
      } catch (error) {
        expect(error.name).to.equal("ValidationError");
      }
    });

    it("should fail when l_name is missing", async function() {
      try {
        await User.create({
          f_name: "John",
          email: `test${Date.now()}@example.com`,
          password: "hashedpassword123"
        });
        expect.fail("Should have thrown an error");
      } catch (error) {
        expect(error.name).to.equal("ValidationError");
      }
    });

    it("should fail when email is missing", async function() {
      try {
        await User.create({
          f_name: "John",
          l_name: "Doe",
          password: "hashedpassword123"
        });
        expect.fail("Should have thrown an error");
      } catch (error) {
        expect(error.name).to.equal("ValidationError");
      }
    });

    it("should fail when password is missing", async function() {
      try {
        await User.create({
          f_name: "John",
          l_name: "Doe",
          email: `test${Date.now()}@example.com`
        });
        expect.fail("Should have thrown an error");
      } catch (error) {
        expect(error.name).to.equal("ValidationError");
      }
    });
  });

  describe("Email Validation", function() {
    it("should enforce unique email constraint", async function() {
      const email = `unique${Date.now()}@example.com`;
      
      await User.create({
        f_name: "John",
        l_name: "Doe",
        email: email,
        password: "hashedpassword123"
      });

      try {
        await User.create({
          f_name: "Jane",
          l_name: "Doe",
          email: email,
          password: "hashedpassword123"
        });
        expect.fail("Should have thrown an error");
      } catch (error) {
        expect(error.code).to.equal(11000); // MongoDB duplicate key error
      }
    });

    it("should lowercase email automatically", async function() {
      const email = `TEST${Date.now()}@EXAMPLE.COM`;
      const user = await User.create({
        f_name: "John",
        l_name: "Doe",
        email: email,
        password: "hashedpassword123"
      });

      expect(user.email).to.equal(email.toLowerCase());
    });

    it("should trim email automatically", async function() {
      const email = `  test${Date.now()}@example.com  `;
      const user = await User.create({
        f_name: "John",
        l_name: "Doe",
        email: email,
        password: "hashedpassword123"
      });

      expect(user.email).to.equal(email.trim().toLowerCase());
    });
  });

  describe("Default Values", function() {
    it("should set default role to 'user'", async function() {
      const user = await User.create({
        f_name: "John",
        l_name: "Doe",
        email: `test${Date.now()}@example.com`,
        password: "hashedpassword123"
      });

      expect(user.role).to.equal("user");
    });

    it("should set default active to 1", async function() {
      const user = await User.create({
        f_name: "John",
        l_name: "Doe",
        email: `test${Date.now()}@example.com`,
        password: "hashedpassword123"
      });

      expect(user.active).to.equal(1);
    });

    it("should set default created_date", async function() {
      const user = await User.create({
        f_name: "John",
        l_name: "Doe",
        email: `test${Date.now()}@example.com`,
        password: "hashedpassword123"
      });

      expect(user.created_date).to.exist;
      expect(user.created_date).to.be.instanceOf(Date);
    });
  });

  describe("Role Validation", function() {
    it("should accept 'user' role", async function() {
      const user = await User.create({
        f_name: "John",
        l_name: "Doe",
        email: `test${Date.now()}@example.com`,
        password: "hashedpassword123",
        role: "user"
      });

      expect(user.role).to.equal("user");
    });

    it("should accept 'admin' role", async function() {
      const user = await User.create({
        f_name: "John",
        l_name: "Doe",
        email: `test${Date.now()}@example.com`,
        password: "hashedpassword123",
        role: "admin"
      });

      expect(user.role).to.equal("admin");
    });

    it("should reject invalid role", async function() {
      try {
        await User.create({
          f_name: "John",
          l_name: "Doe",
          email: `test${Date.now()}@example.com`,
          password: "hashedpassword123",
          role: "invalid"
        });
        expect.fail("Should have thrown an error");
      } catch (error) {
        expect(error.name).to.equal("ValidationError");
      }
    });
  });

  describe("Pre-save Hook", function() {
    it("should normalize email on save", async function() {
      const user = await User.create({
        f_name: "John",
        l_name: "Doe",
        email: `  TEST${Date.now()}@EXAMPLE.COM  `,
        password: "hashedpassword123"
      });

      expect(user.email).to.equal(user.email.toLowerCase().trim());
    });
  });

  describe("OTP Fields", function() {
    it("should allow OTP and otpExpires fields", async function() {
      const user = await User.create({
        f_name: "John",
        l_name: "Doe",
        email: `test${Date.now()}@example.com`,
        password: "hashedpassword123",
        otp: "123456",
        otpExpires: new Date(Date.now() + 5 * 60 * 1000)
      });

      expect(user.otp).to.equal("123456");
      expect(user.otpExpires).to.exist;
    });
  });
});
