// Set NODE_ENV to test if not already set
if (!process.env.NODE_ENV) {
  process.env.NODE_ENV = "test";
}

const mongoose = require("mongoose");
require("dotenv").config({ path: require("path").join(__dirname, "../../.env") });

// Test database connection
// Use 127.0.0.1 instead of localhost for better Windows compatibility
const TEST_MONGO_URI = process.env.TEST_MONGO_URI || "mongodb://127.0.0.1:27017/recipe-management-test";

// Configure Mongoose buffer timeout to be longer (default is 10000ms)
mongoose.set('bufferTimeoutMS', 120000);
// Keep buffering enabled but ensure connection is established quickly
// Models loaded before connection will buffer, but we'll ensure connection is ready before tests run

// CRITICAL: Start connecting immediately when this module loads
// This ensures connection is establishing before any models are loaded
let connectionPromise = null;
if (mongoose.connection.readyState === 0) {
  console.log(`Starting MongoDB connection to: ${TEST_MONGO_URI}`);
  connectionPromise = mongoose.connect(TEST_MONGO_URI, {
    serverSelectionTimeoutMS: 10000,
    socketTimeoutMS: 45000,
    connectTimeoutMS: 10000,
    bufferTimeoutMS: 120000,
    bufferCommands: true,
    maxPoolSize: 10,
    minPoolSize: 1,
    heartbeatFrequencyMS: 10000,
  }).then(() => {
    console.log('✓ MongoDB connection established at module load');
    return mongoose.connection;
  }).catch(err => {
    console.error('✗ MongoDB connection failed at module load:', err.message);
    throw err;
  });
} else if (mongoose.connection.readyState === 1) {
  console.log('✓ MongoDB already connected');
  connectionPromise = Promise.resolve(mongoose.connection);
} else {
  // Connection is in progress or error state
  connectionPromise = Promise.resolve(mongoose.connection);
}

// Only set up hooks if not already connected and if we're in a mocha context
// Check if mocha globals are available (they are when mocha is running)
if (typeof before !== 'undefined' && typeof after !== 'undefined') {
  // Connect to test database
  before(async function() {
    this.timeout(120000);
    
    // Wait for the connection that was started at module load time
    if (connectionPromise) {
      try {
        await connectionPromise;
      } catch (error) {
        console.error('Connection promise failed:', error.message);
        // Fall through to try connecting again
      }
    }
    
    // If already connected, verify and return
    if (mongoose.connection.readyState === 1) {
      console.log("✓ Already connected to test database");
      // Verify it's working
      try {
        await mongoose.connection.db.admin().ping();
        await syncMongooseModels();
        return;
      } catch (pingError) {
        console.warn("Connection verification failed, will reconnect...");
        // Fall through to reconnect
      }
    }
    
    try {
      console.log(`Ensuring connection to test database: ${TEST_MONGO_URI}`);
      
      // Check if already connected to the correct database
      if (mongoose.connection.readyState === 1) {
        const currentUri = mongoose.connection.client?.s?.url || '';
        if (currentUri.includes('recipe-management-test')) {
          console.log("✓ Already connected to test database");
          // Verify connection is still working
          try {
            await mongoose.connection.db.admin().ping();
            return;
          } catch (pingError) {
            console.warn("Connection ping failed, reconnecting...");
            // Fall through to reconnect
          }
        } else {
          console.log("Connected to wrong database, reconnecting...");
          await mongoose.disconnect();
        }
      } else if (mongoose.connection.readyState !== 0) {
        // Connection exists but is not ready, disconnect it
        try {
          await mongoose.disconnect();
          await new Promise(resolve => setTimeout(resolve, 100));
        } catch (disconnectError) {
          console.warn("Warning during disconnect:", disconnectError.message);
        }
      }
      
      // Set up connection event handlers BEFORE connecting
      mongoose.connection.on('error', (err) => {
        console.error('MongoDB connection error:', err);
      });
      
      mongoose.connection.on('disconnected', () => {
        console.warn('MongoDB disconnected. State:', mongoose.connection.readyState);
      });
      
      // Prevent connection from closing during tests
      mongoose.connection.on('close', () => {
        console.warn('MongoDB connection closed unexpectedly');
      });
      
      // Connect with explicit options and longer timeouts
      // CRITICAL: Wait for 'connected' event to ensure Mongoose has fully processed the connection
      const connectPromise = mongoose.connect(TEST_MONGO_URI, {
        serverSelectionTimeoutMS: 10000, // Reduced from 30000 for faster failure
        socketTimeoutMS: 45000, // Set explicit timeout instead of 0
        connectTimeoutMS: 10000, // Reduced from 30000
        bufferTimeoutMS: 120000,
        bufferCommands: true, // Enable buffering for models loaded before connection
        maxPoolSize: 10,
        minPoolSize: 1,
        // Remove maxIdleTimeMS to prevent connections from closing during tests
        heartbeatFrequencyMS: 10000, // Keep connection alive with heartbeats
      });
      
      // Wait for both the connect promise AND the 'connected' event
      // This ensures Mongoose has fully processed the connection internally
      const connectedPromise = new Promise((resolve, reject) => {
        // Check if already connected before setting up listeners
        if (mongoose.connection.readyState === 1) {
          console.log('✓ Connection already established, readyState: 1');
          resolve();
          return;
        }
        
        console.log(`Waiting for 'connected' event, current readyState: ${mongoose.connection.readyState}`);
        
        const timeout = setTimeout(() => {
          mongoose.connection.removeListener('connected', onConnected);
          mongoose.connection.removeListener('error', onError);
          reject(new Error(`Connection event timeout. Final readyState: ${mongoose.connection.readyState}`));
        }, 15000);
        
        const onConnected = () => {
          clearTimeout(timeout);
          mongoose.connection.removeListener('error', onError);
          console.log('✓ Received "connected" event');
          resolve();
        };
        
        const onError = (err) => {
          clearTimeout(timeout);
          mongoose.connection.removeListener('connected', onConnected);
          reject(err);
        };
        
        mongoose.connection.once('connected', onConnected);
        mongoose.connection.once('error', onError);
      });
      
      await Promise.all([connectPromise, connectedPromise]);
      
      console.log(`✓ Mongoose connect() completed, readyState: ${mongoose.connection.readyState}`);
      
      // Wait for connection to be fully established
      // Mongoose.connect() resolves when connection is ready, but we'll verify anyway
      
      // Wait for connection to be ready - verify with multiple checks
      // First check readyState
      if (mongoose.connection.readyState !== 1) {
        throw new Error(`Connection state is ${mongoose.connection.readyState}, expected 1 (connected)`);
      }
      
      console.log(`✓ Connection readyState verified: ${mongoose.connection.readyState}`);
      
      // Then verify with ping - this ensures the connection is actually working
      // Add timeout to prevent hanging
      const pingPromise = mongoose.connection.db.admin().ping();
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error("Ping timeout")), 10000)
      );
      await Promise.race([pingPromise, timeoutPromise]);
      
      // Perform a test operation to ensure the connection is fully functional
      // This ensures Mongoose recognizes the connection and won't buffer operations
      const testDb = mongoose.connection.db;
      const collections = await testDb.listCollections().toArray();
      
      // CRITICAL: Sync Mongoose models to ensure they recognize the connection
      // This is essential because models loaded before connection might not recognize it
      await syncMongooseModels();
      
      // Small delay to ensure connection is fully established and Mongoose has processed it
      await new Promise(resolve => setTimeout(resolve, 300));
      
      // Verify connection one more time
      if (mongoose.connection.readyState !== 1) {
        throw new Error("Connection lost immediately after establishment");
      }
      
      // Final verification: ensure Mongoose is not buffering operations
      // Perform both native and model operations to ensure everything is synced
      await mongoose.connection.db.admin().ping();
      await syncMongooseModels();
      
      console.log("✓ Test database connected successfully and verified");
    } catch (error) {
      console.error("✗ Test database connection failed!");
      console.error("Error details:", error.message);
      console.error("\nPlease ensure:");
      console.error("1. MongoDB is running");
      console.error(`2. Connection string is correct: ${TEST_MONGO_URI}`);
      console.error("3. You have access to the database");
      console.error("\nTry running: mongosh mongodb://127.0.0.1:27017");
      throw error;
    }
  });

  // Ensure connection is ready before each test
  beforeEach(async function() {
    this.timeout(30000);
    // Always call ensureConnection() to verify the connection actually works
    // This ensures Mongoose recognizes the connection and won't buffer operations
    await ensureConnection();
    
    // Additional verification: ensure Mongoose is not buffering operations
    // by performing a test operation that will fail fast if connection is not ready
    if (mongoose.connection.readyState !== 1) {
      throw new Error(`Database connection not ready before test. State: ${mongoose.connection.readyState}`);
    }
    
    // Force Mongoose to recognize the connection by performing both native and model operations
    // This ensures Mongoose models are synced with the connection
    try {
      // First verify native connection works
      await mongoose.connection.db.admin().ping();
      
      // CRITICAL: Use native MongoDB driver to perform an operation on the users collection
      // This ensures the collection exists and the connection is working
      // This bypasses Mongoose buffering entirely
      const db = mongoose.connection.db;
      await db.collection('users').findOne({}).catch(() => {
        // Ignore "not found" errors - collection might be empty
      });
      
      // Now sync Mongoose models - this should work now that we've used native driver
      await syncMongooseModels();
    } catch (error) {
      // If sync fails, that's a critical error - models will buffer
      console.error(`CRITICAL: Failed to sync Mongoose models: ${error.message}`);
      throw new Error(`Database connection verification failed: ${error.message}`);
    }
  });

  // Clean up after each test
  afterEach(async function() {
    this.timeout(60000); // Increased timeout for cleanup
    try {
      if (mongoose.connection.readyState === 1) {
        const collections = mongoose.connection.collections;
        for (const key in collections) {
          try {
            await collections[key].deleteMany({});
          } catch (err) {
            // Ignore cleanup errors, but log them
            console.warn(`Warning: Failed to cleanup collection ${key}:`, err.message);
          }
        }
      }
    } catch (error) {
      // Don't fail tests due to cleanup errors
      console.warn("Warning: Cleanup error:", error.message);
    }
  });

  // Disconnect after all tests
  after(async function() {
    this.timeout(30000);
    try {
      if (mongoose.connection.readyState === 1) {
        await mongoose.connection.close();
        console.log("Test database disconnected");
      }
    } catch (error) {
      console.warn("Warning: Error disconnecting:", error.message);
    }
  });
}

// Helper to sync Mongoose models with the connection
// This ensures models loaded before connection recognize the connection
async function syncMongooseModels() {
  if (mongoose.connection.readyState !== 1) {
    throw new Error(`Cannot sync models - connection not ready. State: ${mongoose.connection.readyState}`);
  }
  
  // CRITICAL: Verify connection is actually working before trying to use models
  // This ensures Mongoose recognizes the connection
  try {
    await mongoose.connection.db.admin().ping();
  } catch (error) {
    throw new Error(`Connection ping failed before syncing models: ${error.message}`);
  }
  
  // CRITICAL: Force Mongoose to recognize the connection by performing a native DB operation first
  // This ensures the connection is fully established before we try to use models
  try {
    // Use native MongoDB driver to perform an operation - this bypasses Mongoose buffering
    const db = mongoose.connection.db;
    await db.collection('users').countDocuments({}, { limit: 1 });
    
    // Now try a Mongoose model operation - this should work now that we've used the native driver
    // But only if the model is properly associated with the connection
    const User = require("../../models/User");
    
    // Check if the model is using the correct connection
    if (User.db && User.db !== mongoose.connection) {
      console.warn("User model is not using the current connection - this may cause buffering");
    }
    
    // Perform a simple operation with a very short timeout
    // If this times out, it means Mongoose is still buffering
    const countPromise = User.countDocuments({}).limit(1).exec();
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error("Model sync timeout - Mongoose may still be buffering")), 3000)
    );
    
    await Promise.race([countPromise, timeoutPromise]);
  } catch (error) {
    // If this fails, Mongoose doesn't recognize the connection
    // This is a critical error - models will buffer operations
    throw new Error(`Failed to sync Mongoose models with connection: ${error.message}`);
  }
}

// Helper to ensure database connection is ready
async function ensureConnection() {
  // If already connected, verify it actually works
  if (mongoose.connection.readyState === 1) {
    // Verify connection is actually functional by doing a lightweight operation
    // This ensures Mongoose recognizes the connection and won't buffer operations
    try {
      // Use native MongoDB operation to verify connection and force Mongoose to sync
      await mongoose.connection.db.admin().ping();
      // Sync Mongoose models to ensure they recognize the connection
      await syncMongooseModels();
      return; // Connection is working
    } catch (error) {
      // Connection might be broken, fall through to reconnect
      console.log("Connection verification failed, will reconnect...");
    }
  }
  
  // Wait a bit and check again (connection might be establishing)
  let attempts = 0;
  const maxAttempts = 50; // 5 seconds total wait time
  
  while (mongoose.connection.readyState !== 1 && attempts < maxAttempts) {
    await new Promise(resolve => setTimeout(resolve, 100));
    attempts++;
  }
  
  // If still not connected, try to reconnect
  if (mongoose.connection.readyState !== 1) {
    console.log("Connection lost, attempting to reconnect...");
    try {
      if (mongoose.connection.readyState !== 0) {
        await mongoose.disconnect();
      }
      
      // CRITICAL: Wait for both connect promise AND 'connected' event
      const connectPromise = mongoose.connect(TEST_MONGO_URI, {
        serverSelectionTimeoutMS: 10000, // Reduced from 30000 for faster failure
        socketTimeoutMS: 45000, // Set explicit timeout instead of 0
        connectTimeoutMS: 10000, // Reduced from 30000
        bufferTimeoutMS: 120000,
        bufferCommands: true, // Enable buffering for models loaded before connection
        maxPoolSize: 10,
        minPoolSize: 1,
        // Remove maxIdleTimeMS to prevent connections from closing during tests
        heartbeatFrequencyMS: 10000, // Keep connection alive with heartbeats
      });
      
      const connectedPromise = new Promise((resolve, reject) => {
        if (mongoose.connection.readyState === 1) {
          resolve();
          return;
        }
        const timeout = setTimeout(() => {
          mongoose.connection.removeListener('connected', onConnected);
          mongoose.connection.removeListener('error', onError);
          reject(new Error('Connection event timeout'));
        }, 15000);
        
        const onConnected = () => {
          clearTimeout(timeout);
          mongoose.connection.removeListener('error', onError);
          resolve();
        };
        
        const onError = (err) => {
          clearTimeout(timeout);
          mongoose.connection.removeListener('connected', onConnected);
          reject(err);
        };
        
        mongoose.connection.once('connected', onConnected);
        mongoose.connection.once('error', onError);
      });
      
      await Promise.all([connectPromise, connectedPromise]);
      
      // Wait for connection to be fully established and verified
      // Verify connection works with a lightweight operation
      // This ensures Mongoose recognizes the connection and won't buffer operations
      await mongoose.connection.db.admin().ping();
      // Sync Mongoose models to ensure they recognize the connection
      await syncMongooseModels();
      
      // Small delay to ensure Mongoose has synced its connection state
      await new Promise(resolve => setTimeout(resolve, 200));
      
      if (mongoose.connection.readyState === 1) {
        console.log("✓ Reconnected to test database");
        return;
      }
    } catch (reconnectError) {
      throw new Error(`Database connection is not ready. State: ${mongoose.connection.readyState}. Reconnect failed: ${reconnectError.message}`);
    }
  }
  
  // Final check
  if (mongoose.connection.readyState !== 1) {
    throw new Error(`Database connection is not ready. State: ${mongoose.connection.readyState}`);
  }
}

// Helper to create a test user
async function createTestUser(overrides = {}) {
  await ensureConnection();
  const User = require("../../models/User");
  const bcrypt = require("bcryptjs");
  
  const defaultUser = {
    f_name: "Test",
    l_name: "User",
    email: `test${Date.now()}@example.com`,
    password: await bcrypt.hash("Test123!@#", 10),
    role: "user",
    active: 1
  };
  
  return await User.create({ ...defaultUser, ...overrides });
}

// Helper to create a test admin
async function createTestAdmin(overrides = {}) {
  await ensureConnection();
  return await createTestUser({ 
    role: "admin",
    email: `admin${Date.now()}@example.com`,
    ...overrides 
  });
}

// Helper to create a test recipe
async function createTestRecipe(userId, overrides = {}) {
  await ensureConnection();
  const Recipe = require("../../models/Recipe");
  
  const defaultRecipe = {
    userId: userId,
    title: "Test Recipe",
    desc: "Test Description",
    category: "Dinner",
    rating: 5,
    ingredients: ["Ingredient 1", "Ingredient 2"],
    instructions: ["Step 1", "Step 2"],
    difficulty: "Easy",
    dietary: ["Vegetarian"],
    tags: ["test", "recipe"],
    cookingTime: 30,
    prepTime: 15,
    servings: 4
  };
  
  return await Recipe.create({ ...defaultRecipe, ...overrides });
}

// Helper to create a test activity
async function createTestActivity(userId, recipeId, overrides = {}) {
  await ensureConnection();
  const Activity = require("../../models/Activity");
  const User = require("../../models/User");
  
  const user = await User.findById(userId);
  const userName = user ? `${user.f_name} ${user.l_name}` : "Test User";
  
  const defaultActivity = {
    userId: userId,
    userName: userName,
    action: "created",
    recipeId: recipeId,
    recipeTitle: "Test Recipe"
  };
  
  return await Activity.create({ ...defaultActivity, ...overrides });
}

// Helper to generate JWT token
function generateToken(userId, role = "user") {
  const jwt = require("jsonwebtoken");
  const secret = process.env.JWT_SECRET || "test-secret-key";
  return jwt.sign({ id: userId, role }, secret, { expiresIn: "24h" });
}

module.exports = {
  createTestUser,
  createTestAdmin,
  createTestRecipe,
  createTestActivity,
  generateToken,
  ensureConnection,
  TEST_MONGO_URI
};
