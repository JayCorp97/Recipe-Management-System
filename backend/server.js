const mongoose = require("mongoose");
const app = require("./app");
require("dotenv").config();

// Connect to MongoDB
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log("MongoDB Connected"))
  .catch(err => console.log(err));

// Start server
const PORT = process.env.PORT //|| 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
