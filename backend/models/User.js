const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({
  f_name: {
    type: String,
    required: true
  },
  l_name: {
    type: String,
    required: true
  },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true
  },
  password: {
    type: String,
    required: true
  },
  role: {
    type: String,
    enum: ["user", "admin"],
    default: "user"
  },
  active: {
    type: Number,
    default: 1
  },
  created_date: {
    type: Date,
    default: Date.now
  },
  otp: {
    type: String
  },
  otpExpires: {
    type: Date
  },
  mode: {
    type: Boolean
  }
});

// Pre-save hook to ensure email is always lowercase and trimmed
// Note: email field already has lowercase: true and trim: true in schema,
// but keeping this hook for additional safety
userSchema.pre("save", async function() {
  if (this.email) {
    this.email = this.email.toLowerCase().trim();
  }
});

module.exports = mongoose.model("User", userSchema);
