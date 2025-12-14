/**
 * Firestore utility functions
 * 
 * Provides helper functions for common Firestore operations.
 */

const admin = require('firebase-admin');

/**
 * Get a Firestore server timestamp
 * 
 * Uses db.constructor.FieldValue for reliable access in Cloud Functions runtime.
 * This is more reliable than admin.firestore.FieldValue which may not be available.
 * 
 * @returns {admin.firestore.FieldValue} Server timestamp sentinel
 * @throws {Error} If FieldValue is not available
 */
function getServerTimestamp() {
  // Get the Firestore instance lazily (not at module load time)
  // This allows the function to work in test environments where admin may not be initialized
  const db = admin.firestore();
  
  // Access FieldValue through the Firestore constructor (db.constructor.FieldValue)
  // This is more reliable than admin.firestore.FieldValue in Cloud Functions runtime
  const FieldValue = db.constructor.FieldValue;
  if (!FieldValue) {
    throw new Error('Firestore FieldValue is not available. Ensure admin is initialized.');
  }
  return FieldValue.serverTimestamp();
}

module.exports = { getServerTimestamp };
