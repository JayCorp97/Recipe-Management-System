#!/usr/bin/env node

// Simple test runner to ensure output is visible
const { spawn } = require('child_process');
const path = require('path');

const mochaPath = path.join(__dirname, 'node_modules', 'mocha', 'bin', 'mocha');
const testDir = path.join(__dirname, 'test');

const args = [
  testDir,
  '--config', path.join(testDir, '.mocharc.js'),
  '--reporter', 'spec'
];

console.log('Running tests with Mocha...');
console.log('Command:', 'node', mochaPath, args.join(' '));
console.log('');

const mocha = spawn('node', [mochaPath, ...args], {
  stdio: 'inherit',
  shell: true,
  cwd: __dirname
});

mocha.on('close', (code) => {
  process.exit(code || 0);
});

mocha.on('error', (err) => {
  console.error('Error running tests:', err);
  process.exit(1);
});
