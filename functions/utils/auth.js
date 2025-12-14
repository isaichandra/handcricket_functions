/**
 * Authentication and validation utilities
 * 
 * Provides reusable functions for validating App Check, authentication,
 * and email verification across Cloud Functions.
 */

const functions = require('firebase-functions');
const admin = require('firebase-admin');
const logger = require('./logger');

/**
 * Validates App Check token, authentication, and email verification
 * 
 * @param {Object} context - Callable context with auth information
 * @param {string} functionName - Name of the calling function (for logging)
 * @throws {functions.https.HttpsError} If validation fails
 */
async function validateAuthAndEmail(context, functionName) {
  // Step 1: Validate App Check token
  if (!context.app) {
    logger.warn(`App Check token missing in ${functionName} request`);
    throw new functions.https.HttpsError(
      'failed-precondition',
      'App Check verification failed'
    );
  }

  // Step 2: Validate auth token
  if (!context.auth || !context.auth.uid) {
    logger.warn(`Unauthenticated request to ${functionName}`);
    throw new functions.https.HttpsError(
      'unauthenticated',
      'Authentication required'
    );
  }

  const uid = context.auth.uid;
  logger.debug(`${functionName} called`, { uid });

  // Get user record to check email verification
  let userRecord;
  try {
    userRecord = await admin.auth().getUser(uid);
  } catch (error) {
    logger.error('Error getting user record', { uid, error: error.message });
    throw new functions.https.HttpsError(
      'internal',
      'Failed to retrieve user information'
    );
  }

  // Step 3: Check if email is verified
  if (!userRecord.emailVerified) {
    logger.warn('Email not verified', { uid, email: userRecord.email });
    throw new functions.https.HttpsError(
      'failed-precondition',
      'use a verified email address to continue'
    );
  }
}

module.exports = { validateAuthAndEmail };
