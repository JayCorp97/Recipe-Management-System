// Quick test script to verify MongoDB connection
const mongoose = require("mongoose");
require("dotenv").config({ path: require("path").join(__dirname, "../../.env") });

const TEST_MONGO_URI = process.env.TEST_MONGO_URI || "mongodb://localhost:27017/recipe-management-test";

async function testConnection() {
  try {
    console.log(`Testing connection to: ${TEST_MONGO_URI}`);
    await mongoose.connect(TEST_MONGO_URI, {
      serverSelectionTimeoutMS: 5000,
    });
    console.log("✓ Connection successful!");
    
    // Test a simple operation
    const db = mongoose.connection.db;
    const collections = await db.listCollections().toArray();
    console.log(`✓ Database accessible. Collections: ${collections.length}`);
    
    await mongoose.disconnect();
    console.log("✓ Disconnected successfully");
    process.exit(0);
  } catch (error) {
    console.error("✗ Connection failed!");
    console.error("Error:", error.message);
    console.error("\nTroubleshooting:");
    console.error("1. Make sure MongoDB is running: Get-Service MongoDB");
    console.error("2. Try connecting manually: mongosh mongodb://localhost:27017");
    console.error("3. Check if MongoDB is listening on port 27017");
    process.exit(1);
  }
}

// Only run if executed directly, not when required
// Additional check: ensure we're not in a Mocha test context
if (require.main === module && typeof describe === 'undefined' && typeof it === 'undefined') {
  testConnection();
}
