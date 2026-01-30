// backend/server.js
require("dotenv").config();
const http = require("http");
const app = require("./app");
const connectDB = require("./src/db");
const { initSocket } = require("./src/socket");

const PORT = process.env.PORT || 5000;

(async () => {
  try {
    await connectDB();
<<<<<<< HEAD
    console.log("Database connected");

    app.listen(PORT, () => {
      console.log(`Server running on http://localhost:${PORT}`);
=======
    console.log(" Database connected");

    // Create HTTP server
    const httpServer = http.createServer(app);

    // Initialize Socket.IO
    initSocket(httpServer);

    // Start server
    httpServer.listen(PORT, () => {
      console.log(` Server running on http://localhost:${PORT}`);
      console.log(` Socket.IO ready for connections`);
>>>>>>> main
    });
  } catch (e) {
    console.error("Server failed to start:", e);
    process.exit(1);
  }
})();
