# Test Directory - Simple Guide

This folder has all the tests for the Recipe Management System.

## What's Inside

The tests are organized by what they test:
- **middleware/** - Tests for security and validation
- **models/** - Tests for database models (Recipe, User, Activity)
- **routes/** - Tests for API endpoints
- **validation/** - Tests for duplicate checking and image uploads
- **utils/** - Tests for error handling
- **integration/** - Tests for complete workflows

## Quick Start

### 1. Install Everything
```bash
npm install
```

### 2. Set Up Your Test Database
Create a `.env` file in the `backend` folder with:
```
TEST_MONGO_URI=mongodb://localhost:27017/recipe-management-test
JWT_SECRET=your-secret-key-here
```

### 3. Run Tests

**Main command (this works!):**
```bash
node test-runner.js
```

**Or use npm:**
```bash
npm test                    # Same as: node test-runner.js
npm run test:watch         # Run tests and watch for changes
npm run test:integration   # Run only integration tests
npm run test:coverage      # Run tests with coverage report
```

## What Gets Tested

 **Security** - Login, authentication, user roles  
 **Recipes** - Create, read, update, delete recipes  
 **Users** - Registration, login, user management  
 **Images** - File uploads and validation  
 **Duplicates** - Checking for duplicate recipes  
 **Activities** - Activity feed and logging  

## Unit Tests vs Integration Tests

### Unit Tests (test individual pieces)

**Middleware Tests:**
- Authentication - Check if user is logged in
- Authorization - Check if user has permission (admin/user)
- Validation - Check if input data is valid
- Rate Limiting - Prevent too many requests
- Body Size Limits - Prevent oversized requests

**Model Tests:**
- Recipe Model - Data validation, default values, sanitization
- User Model - Email validation, password hashing, role checking
- Activity Model - Action types, timestamps, data structure

**Route Tests:**
- Auth Routes - Register, login, logout, OTP, user profile
- Recipe Routes - Create, read, update, delete recipes
- Activity Routes - Get activity feed, sorting, pagination

**Validation Tests:**
- Duplicate Detection - Check for duplicate recipe names
- Image Upload - File type, size, and format validation

**Utils Tests:**
- Error Handling - How errors are formatted and returned

### Integration Tests (test complete workflows)

**Complete User Workflows:**
- Register → Login → Create Recipe → View Recipe → Update Recipe → Delete Recipe
- Multiple users creating recipes (they don't see each other's recipes)
- Admin can see and delete any recipe

**Cross-Component Tests:**
- Rate limiting works across the system
- Data stays consistent between different parts
- Errors are handled properly everywhere
- Multiple users can work at the same time
- Activity logs are created correctly for all actions

**Summary:**
- **Unit Tests** = Test one thing at a time (like testing a single function)
- **Integration Tests** = Test complete user journeys (like a real person using the app)

## Important Notes

- Tests use a **separate test database** (won't affect your real data)
- Database is **cleaned after each test**
- Make sure **MongoDB is running** before running tests

## If Tests Don't Work

1. Is MongoDB running? Check with: `Get-Service MongoDB`
2. Check your `.env` file has the right database URL
3. Make sure `JWT_SECRET` is set in `.env`
4. Try running `npm install` again

**Wrote by**: Anushi 