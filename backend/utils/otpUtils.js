const bcrypt = require('bcryptjs');

/**
 * Generate a numeric OTP and expiration
 * @param {number} length - OTP length (default 6)
 * @param {number} expireMinutes - Expiration in minutes (default 2)
 * @returns {Promise<{ otp: string, hashedOtp: string, expiresAt: Date }>}
 */
async function generateOtp(length = 6, expireMinutes = 2) {
  // Generate random numeric OTP
  const otp = Math.floor(Math.random() * (10 ** length - 10 ** (length - 1)) + 10 ** (length - 1)).toString();

  // Hash OTP for secure storage
  const hashedOtp = await bcrypt.hash(otp, 10);

  // Set expiration timestamp
  const expiresAt = new Date(Date.now() + expireMinutes * 60 * 1000);

  return { otp, hashedOtp, expiresAt };
}

/**
 * Verify OTP
 * @param {string} inputOtp - OTP entered by user
 * @param {string} hashedOtp - OTP hash stored in DB
 * @param {Date} expiresAt - OTP expiry from DB
 * @returns {Promise<boolean>} - true if valid, false if invalid or expired
 */
async function verifyOtp(inputOtp, hashedOtp, expiresAt) {
  if (!hashedOtp || !expiresAt) return false;

  // Check expiry
  if (new Date() > new Date(expiresAt)) return false;

  // Compare OTP with hash
  const isMatch = await bcrypt.compare(inputOtp, hashedOtp);
  return isMatch;
}

module.exports = { generateOtp, verifyOtp };
