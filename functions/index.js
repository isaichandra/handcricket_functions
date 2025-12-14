/**
 * Firebase Cloud Functions entry point
 * 
 * This file exports all Cloud Functions for the Hand Cricket application.
 * Individual functions are organized in separate files under the handlers/ directory.
 */

const admin = require('firebase-admin');

// Initialize Firebase Admin
// Get project ID for database URL
const projectId = process.env.GCLOUD_PROJECT || process.env.GCP_PROJECT || 'handcricket-club';

// Configure for emulator if running locally
// Firebase emulator sets FIREBASE_DATABASE_EMULATOR_HOST when database emulator is running
const isEmulator = process.env.FUNCTIONS_EMULATOR === 'true' || 
                   process.env.FIREBASE_DATABASE_EMULATOR_HOST ||
                   process.env.FIREBASE_AUTH_EMULATOR_HOST;

if (isEmulator) {
  // Use emulator database URL
  // Format: http://localhost:9000?ns=<project-id>
  const databaseURL = process.env.FIREBASE_DATABASE_EMULATOR_HOST
    ? `http://${process.env.FIREBASE_DATABASE_EMULATOR_HOST}?ns=${projectId}`
    : `http://localhost:9000?ns=${projectId}`;
  
  admin.initializeApp({
    projectId: projectId,
    databaseURL: databaseURL
  });
} else {
  // Production: use default initialization
  // databaseURL will be determined from project ID
  admin.initializeApp();
}

// Import and export all functions
exports.listItems = require('./handlers/listItems');
exports.health = require('./handlers/health');
exports.createNewUser = require('./handlers/createNewUser');
exports.quickMatch = require('./handlers/quickMatch');
exports.cancelQuickMatch = require('./handlers/cancelQuickMatch');

