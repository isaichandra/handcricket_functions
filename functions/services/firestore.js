/**
 * Firestore service layer
 * 
 * Provides helper functions for common Firestore operations.
 */

const admin = require('firebase-admin');
const db = admin.firestore();
const logger = require('../utils/logger');

/**
 * Get a document by ID
 * 
 * @param {string} collection - Collection name
 * @param {string} docId - Document ID
 * @returns {Promise<Object|null>} Document data or null if not found
 */
async function getDocument(collection, docId) {
  try {
    const doc = await db.collection(collection).doc(docId).get();
    if (!doc.exists) {
      return null;
    }
    return { id: doc.id, ...doc.data() };
  } catch (error) {
    logger.error('Error getting document', {
      collection,
      docId,
      error: error.message
    });
    throw error;
  }
}

/**
 * Create a new document
 * 
 * @param {string} collection - Collection name
 * @param {Object} data - Document data
 * @param {string} docId - Optional document ID (auto-generated if not provided)
 * @returns {Promise<string>} Document ID
 */
async function createDocument(collection, data, docId = null) {
  try {
    const docRef = docId
      ? db.collection(collection).doc(docId)
      : db.collection(collection).doc();
    
    await docRef.set({
      ...data,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });
    
    return docRef.id;
  } catch (error) {
    logger.error('Error creating document', {
      collection,
      error: error.message
    });
    throw error;
  }
}

/**
 * Update a document
 * 
 * @param {string} collection - Collection name
 * @param {string} docId - Document ID
 * @param {Object} data - Fields to update
 * @returns {Promise<void>}
 */
async function updateDocument(collection, docId, data) {
  try {
    await db.collection(collection).doc(docId).update({
      ...data,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });
  } catch (error) {
    logger.error('Error updating document', {
      collection,
      docId,
      error: error.message
    });
    throw error;
  }
}

/**
 * Delete a document
 * 
 * @param {string} collection - Collection name
 * @param {string} docId - Document ID
 * @returns {Promise<void>}
 */
async function deleteDocument(collection, docId) {
  try {
    await db.collection(collection).doc(docId).delete();
  } catch (error) {
    logger.error('Error deleting document', {
      collection,
      docId,
      error: error.message
    });
    throw error;
  }
}

/**
 * Query documents with filters
 * 
 * @param {string} collection - Collection name
 * @param {Array} filters - Array of filter objects { field, operator, value }
 * @param {string} orderBy - Field to order by
 * @param {string} orderDirection - 'asc' or 'desc'
 * @param {number} limit - Maximum number of documents
 * @returns {Promise<Array>} Array of documents
 */
async function queryDocuments(collection, filters = [], orderBy = 'createdAt', orderDirection = 'desc', limit = 100) {
  try {
    let query = db.collection(collection);
    
    // Apply filters
    filters.forEach(filter => {
      query = query.where(filter.field, filter.operator, filter.value);
    });
    
    // Apply ordering
    query = query.orderBy(orderBy, orderDirection);
    
    // Apply limit
    query = query.limit(limit);
    
    const snapshot = await query.get();
    const docs = [];
    snapshot.forEach(doc => {
      docs.push({ id: doc.id, ...doc.data() });
    });
    
    return docs;
  } catch (error) {
    logger.error('Error querying documents', {
      collection,
      error: error.message
    });
    throw error;
  }
}

module.exports = {
  getDocument,
  createDocument,
  updateDocument,
  deleteDocument,
  queryDocuments,
  db
};

