# Integration Tests - Simple Guide

Integration tests check if different parts of the system work together correctly.

## What These Tests Do

### `workflows.test.js`
Tests complete user journeys:
- User registers → logs in → creates recipe → views it → updates it → deletes it
- Multiple users creating recipes (they don't see each other's recipes)
- Admin can see and delete any recipe
- Activities are logged correctly

### `crossComponent.test.js`
Tests how different parts work together:
- Rate limiting (preventing too many requests)
- Data stays consistent across the system
- Errors are handled properly
- Multiple users can create recipes at the same time

## How to Run

### Run just integration tests:
```bash
npm run test:integration
```

### Run all tests (including integration):
```bash
npm test
```

### Watch for changes:
```bash
npm run test:watch
```

### See coverage report:
```bash
npm run test:coverage
```

## What's Different?

**Unit tests** = Test one thing at a time  
**Integration tests** = Test complete workflows (like a real user would)

Both use the same setup and run together when you type `npm test`.

## Before Running

✅ MongoDB must be running  
✅ `.env` file must have `TEST_MONGO_URI` set  
✅ Run `npm install` first  

## If Something Goes Wrong

### MongoDB Not Running?
```bash
# Check if it's running
Get-Service MongoDB

# Start it if needed
net start MongoDB
```

### Connection Errors?
1. Make sure MongoDB is running (see above)
2. Check your `.env` file has: `TEST_MONGO_URI=mongodb://localhost:27017/recipe-management-test`
3. Try connecting manually: `mongosh mongodb://localhost:27017/recipe-management-test`

### Can't Find Module?
- Make sure you're in the `backend` folder when running tests

## Important Notes

- These tests take longer (up to 2 minutes) because they test complete workflows
- Tests clean up after themselves automatically
- **MongoDB must be running** before you start tests
