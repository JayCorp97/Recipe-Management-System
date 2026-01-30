const path = require('path');

module.exports = {
  timeout: 120000, // Increased timeout to 2 minutes for database operations
  exit: true,
  recursive: true,
  require: [path.join(__dirname, 'helpers/testSetup.js')],
  // Only match .test.js files
  spec: [path.join(__dirname, '**/*.test.js')],
  // Explicitly ignore helper files that shouldn't be run as tests
  ignore: [
    path.join(__dirname, 'helpers/testConnection.js'),
    path.join(__dirname, '**/testConnection.js')
  ]
};
