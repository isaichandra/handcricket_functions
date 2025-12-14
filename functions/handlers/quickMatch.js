/**
 * Quick match function
 * 
 * Callable function for quick match functionality.
 * Adds user to the quick matchmaking queue if they are online and not already waiting.
 * 
 * @param {Object} data - Request data (not used)
 * @param {Object} context - Callable context with auth information
 * @returns {Promise<Object>} Success response
 */

const functions = require('firebase-functions');
const admin = require('firebase-admin');
const logger = require('../utils/logger');
const { validateAuthAndEmail } = require('../utils/auth');
const { getServerTimestamp } = require('../utils/firestore');

const db = admin.firestore();
const rtdb = admin.database();

// Export handler for testing
const quickMatchHandler = async (data, context) => {
  try {
    // Step 1: Validate App Check, auth, and email verification
    await validateAuthAndEmail(context, 'quickMatch');
    
    const uid = context.auth.uid;
    logger.debug('quickMatch called', { uid });

    // Step 2: Check if user is online by checking presence/{uid} in Realtime Database
    const presenceRef = rtdb.ref(`presence/${uid}`);
    const presenceSnapshot = await presenceRef.once('value');
    
    if (!presenceSnapshot.exists()) {
      logger.warn('User not online', { uid });
      throw new functions.https.HttpsError(
        'failed-precondition',
        'User Not Online'
      );
    }

    // Step 3: Check if user is already waiting in the queue
    const queueDocRef = db.collection('quick_matchmaking_queue').doc(uid);
    const queueDoc = await queueDocRef.get();
    
    if (queueDoc.exists) {
      logger.warn('User already waiting to be matched', { uid });
      throw new functions.https.HttpsError(
        'already-exists',
        'User Already Waiting to be matched'
      );
    }

    // Step 4: Create document in quick_matchmaking_queue collection
    const timestamp = getServerTimestamp();
    await queueDocRef.set({
      uid: uid,
      created_at: timestamp,
      status: 'waiting'
    });

    logger.info('User added to quick matchmaking queue', { uid });
    
    return {
      success: true
    };
  } catch (error) {
    // Re-throw HttpsError as-is
    if (error instanceof functions.https.HttpsError) {
      throw error;
    }

    // Log unexpected errors
    logger.error('Unexpected error in quickMatch', {
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
module.exports = functions.https.onCall(quickMatchHandler);

// Export handler for testing
module.exports.handler = quickMatchHandler;
