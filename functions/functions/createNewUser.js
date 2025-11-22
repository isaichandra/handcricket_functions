/**
 * Create user profile with username
 * 
 * Callable function that creates a user profile with a unique username.
 * Validates auth, email verification, username format, and ensures uniqueness.
 * 
 * @param {Object} data - Request data containing username
 * @param {string} data.username - Username (8-15 chars, lowercase/numbers/underscore, not starting with _ or number)
 * @param {Object} context - Callable context with auth information
 * @returns {Promise<Object>} Success response
 */

const functions = require('firebase-functions');
const admin = require('firebase-admin');
const logger = require('../utils/logger');

const rtdb = admin.database();

module.exports = functions.https.onCall(async (data, context) => {
  try {
    // Step 1: Validate auth token
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

    // Step 2: Check if email is verified
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

    // Step 3: Validate username format
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

    // Step 4: Check if /users/{uid} exists
    const userRef = rtdb.ref(`users/${uid}`);
    const userSnapshot = await userRef.once('value');
    if (userSnapshot.exists()) {
      logger.warn('User already exists', { uid });
      throw new functions.https.HttpsError(
        'already-exists',
        'user already exists'
      );
    }

    // Step 5: Check if /usernames/{username} exists
    const usernameRef = rtdb.ref(`usernames/${username}`);
    let usernameSnapshot = await usernameRef.once('value');
    if (usernameSnapshot.exists()) {
      logger.warn('Username already taken', { uid, username });
      throw new functions.https.HttpsError(
        'already-exists',
        'username already taken'
      );
    }

    // Step 6: Create /usernames/{username} with transaction and retry
    let usernameCreated = false;
    let createdTimestamp = null;
    const maxRetries = 3;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        // Re-check if username exists before retrying (except on first attempt)
        if (attempt > 1) {
          usernameSnapshot = await usernameRef.once('value');
          if (usernameSnapshot.exists()) {
            logger.warn('Username taken during retry', { uid, username, attempt });
            throw new functions.https.HttpsError(
              'already-exists',
              'username already taken'
            );
          }
        }

        // Attempt to create username using transaction
        const usernameTransactionResult = await rtdb.ref(`usernames/${username}`).transaction((currentData) => {
          if (currentData === null) {
            // Path doesn't exist, we can create it
            // Use ServerValue.TIMESTAMP if available, otherwise fallback to Date.now() for emulator
            const ServerValue = admin.database && admin.database.ServerValue;
            const timestamp = (ServerValue && ServerValue.TIMESTAMP) || Date.now();
            return {
              created_at: timestamp
            };
          }
          // Path exists, abort transaction
          return undefined;
        });

        // Check if transaction was committed
        if (usernameTransactionResult.committed) {
          usernameCreated = true;
          createdTimestamp = usernameTransactionResult.snapshot.val().created_at;
          logger.info('Username created successfully', { uid, username, attempt });
          break;
        } else {
          throw new Error('Transaction aborted - username may have been taken');
        }
      } catch (error) {
        if (error instanceof functions.https.HttpsError) {
          throw error; // Re-throw HttpsError (like already-exists)
        }
        
        logger.warn('Failed to create username', {
          uid,
          username,
          attempt,
          error: error.message
        });

        if (attempt === maxRetries) {
          logger.error('All retries failed for username creation', {
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

    if (!usernameCreated) {
      throw new functions.https.HttpsError(
        'internal',
        'Something is wrong'
      );
    }

    // Step 7: Create /users/{uid} with transaction and retry
    let userCreated = false;
    const retryDelay = 500; // 0.5 seconds

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        // Wait before retry (except on first attempt)
        if (attempt > 1) {
          await new Promise(resolve => setTimeout(resolve, retryDelay));
        }

        // Attempt to create user using transaction
        const userTransactionResult = await rtdb.ref(`users/${uid}`).transaction((currentData) => {
          if (currentData === null) {
            // Path doesn't exist, we can create it
            return {
              created_at: createdTimestamp,
              username: username,
              email_address: userRecord.email
            };
          }
          // Path exists, abort transaction
          return undefined;
        });

        // Check if transaction was committed
        if (userTransactionResult.committed) {
          userCreated = true;
          logger.info('User created successfully', { uid, username, attempt });
          break;
        } else {
          throw new Error('Transaction aborted - user may already exist');
        }
      } catch (error) {
        logger.warn('Failed to create user', {
          uid,
          username,
          attempt,
          error: error.message
        });

        if (attempt === maxRetries) {
          logger.error('All retries failed for user creation, cleaning up username', {
            uid,
            username,
            attempts: maxRetries
          });

          // Step 8: Cleanup - delete username if user creation failed
          try {
            await usernameRef.remove();
            logger.info('Cleaned up username after user creation failure', {
              uid,
              username
            });
          } catch (cleanupError) {
            logger.error('Failed to cleanup username', {
              uid,
              username,
              error: cleanupError.message
            });
          }

          throw new functions.https.HttpsError(
            'internal',
            'Something is Wrong'
          );
        }
        // Continue to next retry
      }
    }

    if (!userCreated) {
      // Final cleanup attempt
      try {
        await usernameRef.remove();
        logger.info('Cleaned up username after user creation failure (final)', {
          uid,
          username
        });
      } catch (cleanupError) {
        logger.error('Failed to cleanup username (final)', {
          uid,
          username,
          error: cleanupError.message
        });
      }

      throw new functions.https.HttpsError(
        'internal',
        'Something is Wrong'
      );
    }

    logger.info('User profile created successfully', { uid, username });
    return {
      success: true,
      username: username,
      uid: uid
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
});

