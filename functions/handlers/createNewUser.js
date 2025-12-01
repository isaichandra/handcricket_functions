/**
 * Create user profile with username
 * 
 * Callable function that creates a user profile with a unique username.
 * Validates App Check, auth, email verification, username format, and ensures uniqueness.
 * 
 * @param {Object} data - Request data containing username
 * @param {string} data.username - Username (8-15 chars, lowercase/numbers/underscore, not starting with _ or number)
 * @param {Object} context - Callable context with auth information
 * @returns {Promise<Object>} Success response
 */

const functions = require('firebase-functions');
const admin = require('firebase-admin');
const logger = require('../utils/logger');

const db = admin.firestore();
// Helper function to get serverTimestamp - use db.constructor.FieldValue for reliable access
const getServerTimestamp = () => {
  // Access FieldValue through the Firestore constructor (db.constructor.FieldValue)
  // This is more reliable than admin.firestore.FieldValue in Cloud Functions runtime
  const FieldValue = db.constructor.FieldValue;
  if (!FieldValue) {
    throw new Error('Firestore FieldValue is not available. Ensure admin is initialized.');
  }
  return FieldValue.serverTimestamp();
};

// Export handler for testing
const createNewUserHandler = async (data, context) => {
  try {
    // Step 1: Validate App Check token
    if (!context.app) {
      logger.warn('App Check token missing in createNewUser request');
      throw new functions.https.HttpsError(
        'failed-precondition',
        'App Check verification failed'
      );
    }

    // Step 2: Validate auth token
    if (!context.auth || !context.auth.uid) {
      logger.warn('Unauthenticated request to createNewUser');
      throw new functions.https.HttpsError(
        'unauthenticated',
        'Authentication required'
      );
    }

    const uid = context.auth.uid;
    logger.debug('createNewUser called', { uid, username: data?.username });

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

    // Validate username input
    if (!data || typeof data.username !== 'string') {
      logger.warn('Invalid username input', { uid, username: data?.username });
      throw new functions.https.HttpsError(
        'invalid-argument',
        'username is required and must be a string'
      );
    }

    const username = data.username.trim();

    // Step 4: Validate username format
    // Rules:
    // - Min 8 chars, max 15 chars
    // - Only lowercase letters, numbers, and underscore
    // - Cannot start with _ or number
    const usernameRegex = /^[a-z][a-z0-9_]{7,14}$/;
    if (!usernameRegex.test(username)) {
      logger.warn('Username validation failed', { uid, username });
      throw new functions.https.HttpsError(
        'invalid-argument',
        'username rules failed'
      );
    }

    // Step 5: Check if user document exists by uid
    const userRef = db.collection('users').doc(uid);
    const userDoc = await userRef.get();
    if (userDoc.exists) {
      logger.warn('User already exists', { uid });
      throw new functions.https.HttpsError(
        'already-exists',
        'user already exists'
      );
    }

    // Step 6: Create user and username documents atomically using Firestore transaction
    // We use a separate 'usernames' collection (document ID = username) to ensure
    // atomic uniqueness checks, since Firestore transactions can read documents by ID
    // but cannot perform queries
    const usernameRef = db.collection('usernames').doc(username);
    let userCreated = false;
    const maxRetries = 3;
    const retryDelay = 500; // 0.5 seconds

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        // Wait before retry (except on first attempt)
        if (attempt > 1) {
          await new Promise(resolve => setTimeout(resolve, retryDelay));
        }

        // Use Firestore transaction to atomically check and create both documents
        // Get serverTimestamp sentinel before transaction (per Firebase Admin SDK docs)
        // https://googleapis.dev/nodejs/firestore/latest/FieldValue.html#.serverTimestamp
        const timestamp = getServerTimestamp();
        
        await db.runTransaction(async (transaction) => {
          // Re-read user document to ensure it still doesn't exist
          const userDocSnapshot = await transaction.get(userRef);
          if (userDocSnapshot.exists) {
            throw new Error('User already exists');
          }

          // Check if username is already taken by reading the username document
          const usernameDocSnapshot = await transaction.get(usernameRef);
          if (usernameDocSnapshot.exists) {
            logger.warn('Username already taken in transaction', { uid, username });
            throw new functions.https.HttpsError(
              'already-exists',
              `username ${username} already taken`
            );
          }

          // Both checks passed, create both documents atomically
          // Create username document (for uniqueness tracking)
          transaction.set(usernameRef, {
            uid: uid,
            created_at: timestamp
          });

          // Create user document
          transaction.set(userRef, {
            created_at: timestamp,
            username: username,
            email_address: userRecord.email
          });
        });

        userCreated = true;
        logger.info('User created successfully', { uid, username, attempt });
        break;

      } catch (error) {
        if (error instanceof functions.https.HttpsError) {
          throw error; // Re-throw HttpsError (like already-exists)
        }
        
        logger.warn('Failed to create user', {
          uid,
          username,
          attempt,
          error: error.message
        });

        if (attempt === maxRetries) {
          logger.error('All retries failed for user creation', {
            uid,
            username,
            attempts: maxRetries
          });
          throw new functions.https.HttpsError(
            'internal',
            'Something is wrong'
          );
        }
        // Continue to next retry
      }
    }

    if (!userCreated) {
      throw new functions.https.HttpsError(
        'internal',
        'Something is wrong'
      );
    }

    logger.info('User profile created successfully', { uid, username });
    return {
      success: true
    };

  } catch (error) {
    // Re-throw HttpsError as-is
    if (error instanceof functions.https.HttpsError) {
      throw error;
    }

    // Log unexpected errors
    logger.error('Unexpected error in createNewUser', {
      error: error.message,
      stack: error.stack,
      uid: context.auth?.uid
    });

    throw new functions.https.HttpsError(
      'internal',
      'An unexpected error occurred'
    );
  }
};

// Export the callable function
module.exports = functions.https.onCall(createNewUserHandler);

// Export handler for testing
module.exports.handler = createNewUserHandler;

