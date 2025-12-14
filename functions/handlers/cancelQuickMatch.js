/**
 * Cancel quick match function
 * 
 * Callable function for canceling quick match functionality.
 * Removes the user from the quick matchmaking queue if present.
 * 
 * @param {Object} data - Request data (not used)
 * @param {Object} context - Callable context with auth information
 * @returns {Promise<Object>} Success response
 */

const functions = require('firebase-functions');
const admin = require('firebase-admin');
const logger = require('../utils/logger');
const { validateAuthAndEmail } = require('../utils/auth');

const db = admin.firestore();

/**
 * Sleep utility for retry delays
 * @param {number} ms - Milliseconds to sleep
 * @returns {Promise<void>}
 */
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Attempts to delete a document with retry logic for locked documents
 * @param {admin.firestore.DocumentReference} docRef - Document reference to delete
 * @param {number} maxRetries - Maximum number of retries
 * @param {number} retryDelayMs - Delay between retries in milliseconds
 * @returns {Promise<boolean>} True if deleted successfully, false otherwise
 */
async function deleteWithRetry(docRef, maxRetries = 10, retryDelayMs = 500) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      // Check if document exists first
      const doc = await docRef.get();
      if (!doc.exists) {
        logger.debug('Document does not exist, nothing to delete');
        return true; // Document doesn't exist, consider it successful
      }

      // Attempt to delete
      await docRef.delete();
      logger.debug('Document deleted successfully', { attempt });
      return true;
    } catch (error) {
      // Check if this is a locked/contention error
      // Firestore returns 'aborted' for transaction conflicts
      // and 'failed-precondition' for other contention issues
      const isLockedError = error.code === 'aborted' || 
                           error.code === 'failed-precondition' ||
                           error.code === 'unavailable' ||
                           error.message?.includes('concurrent') ||
                           error.message?.includes('locked');

      if (isLockedError && attempt < maxRetries) {
        logger.debug('Document locked, retrying', { 
          attempt, 
          maxRetries,
          errorCode: error.code 
        });
        await sleep(retryDelayMs);
        continue;
      }

      // If not a locked error or we've exhausted retries, log and return false
      if (isLockedError) {
        logger.warn('Document still locked after max retries', {
          maxRetries,
          errorCode: error.code
        });
      } else {
        logger.warn('Unexpected error during delete', {
          attempt,
          errorCode: error.code,
          errorMessage: error.message
        });
      }
      return false;
    }
  }
  return false;
}

// Export handler for testing
const cancelQuickMatchHandler = async (data, context) => {
  try {
    // Step 1: Validate App Check, auth, and email verification
    await validateAuthAndEmail(context, 'cancelQuickMatch');
    
    const uid = context.auth.uid;
    logger.debug('cancelQuickMatch called', { uid });

    // Step 2: Delete document from quick_matchmaking_queue collection
    const queueDocRef = db.collection('quick_matchmaking_queue').doc(uid);
    
    // Step 3: Attempt deletion with retry logic for locked documents
    const deleted = await deleteWithRetry(queueDocRef, 10, 500);
    
    if (deleted) {
      logger.info('User removed from quick matchmaking queue', { uid });
    } else {
      logger.warn('Failed to remove user from queue after retries', { uid });
    }
    
    // Step 4: Return success regardless of deletion result
    return {
      success: true
    };
  } catch (error) {
    // Re-throw HttpsError as-is
    if (error instanceof functions.https.HttpsError) {
      throw error;
    }

    // Log unexpected errors
    logger.error('Unexpected error in cancelQuickMatch', {
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
module.exports = functions.https.onCall(cancelQuickMatchHandler);

// Export handler for testing
module.exports.handler = cancelQuickMatchHandler;
