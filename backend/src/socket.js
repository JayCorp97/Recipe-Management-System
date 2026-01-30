// Socket.IO server setup
const { Server } = require("socket.io");

let io = null;

/**
 * Initialize Socket.IO server
 * @param {http.Server} httpServer - HTTP server instance
 * @returns {Server} Socket.IO server instance
 */
function initSocket(httpServer) {
  io = new Server(httpServer, {
    cors: {
      origin: "*", // Allow all origins (adjust for production)
      methods: ["GET", "POST"],
      credentials: true
    }
  });

  io.on("connection", (socket) => {
    console.log(` Client connected: ${socket.id}`);

    // Handle join event for activity feed room
    socket.on("join", (room) => {
      if (room === "activity-feed") {
        socket.join("activity-feed");
        console.log(` Client ${socket.id} joined activity-feed room`);
      }
    });

    socket.on("disconnect", () => {
      console.log(` Client disconnected: ${socket.id}`);
    });
  });

  console.log(" Socket.IO server initialized");
  return io;
}

/**
 * Get the Socket.IO instance
 * @returns {Server|null} Socket.IO server instance or null if not initialized
 */
function getIO() {
  return io;
}

/**
 * Emit a new activity to all connected clients
 * @param {Object} activity - Activity object to broadcast
 */
function emitActivity(activity) {
  if (io) {
    io.to("activity-feed").emit("new-activity", activity);
    console.log(`📡 Emitted activity: ${activity.userName} ${activity.action} "${activity.recipeTitle}"`);
  } else {
    console.warn("⚠️ Socket.IO not initialized, cannot emit activity");
  }
}

module.exports = {
  initSocket,
  getIO,
  emitActivity
};
