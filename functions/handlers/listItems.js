/**
 * List items with cursor-based pagination
 * 
 * GET /listItems?limit=20&cursor=<token>
 * 
 * Response: { items: [...], nextCursor: string|null, hasMore: boolean }
 */

const functions = require('firebase-functions');
const admin = require('firebase-admin');
const { verifyCursor, signPayload } = require('../utils/cursor');
const logger = require('../utils/logger');
const config = require('../config');

const db = admin.firestore();

module.exports = functions.https.onRequest(async (req, res) => {
  try {
    // Enforce CORS if needed
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
      res.status(204).send('');
      return;
    }

    // Validate and enforce page size limits
    const pageSize = Math.min(
      parseInt(req.query.limit || config.DEFAULT_PAGE_SIZE, 10),
      config.MAX_PAGE_SIZE
    );
    const cursorToken = req.query.cursor;

    // Build query with deterministic ordering
    let q = db.collection('items')
      .orderBy('createdAt', 'desc')
      .orderBy(admin.firestore.FieldPath.documentId(), 'desc')
      .limit(pageSize + 1);

    // Apply cursor if provided
    if (cursorToken) {
      let payload;
      try {
        payload = verifyCursor(cursorToken);
      } catch (err) {
        logger.warn('Invalid cursor', { error: err.message, cursor: cursorToken });
        return res.status(400).json({ 
          error: 'Invalid or expired cursor',
          code: 'INVALID_CURSOR'
        });
      }

      // Try to use document snapshot for strict ordering
      try {
        const snap = await db.collection('items').doc(payload.docId).get();
        if (snap.exists) {
          q = q.startAfter(snap);
        } else {
          // Fallback: startAfter using lastValue and docId
          q = q.startAfter(payload.lastValue, payload.docId);
        }
      } catch (err) {
        logger.error('Error applying cursor', { error: err.message, payload });
        // Fallback to field-based startAfter
        q = q.startAfter(payload.lastValue, payload.docId);
      }
    }

    // Execute query
    const snaps = await q.get();
    const docs = [];
    snaps.forEach(d => docs.push({ id: d.id, ...d.data() }));

    // Generate next cursor if there are more items
    let nextCursor = null;
    if (docs.length === pageSize + 1) {
      const last = docs.pop();
      const lastValue = last.createdAt instanceof admin.firestore.Timestamp
        ? last.createdAt.toMillis()
        : (last.createdAt || Date.now());
      
      const payload = {
        lastValue,
        docId: last.id,
        v: 1,
        exp: Date.now() + config.CURSOR_TTL_MS
      };
      nextCursor = signPayload(payload);
    }

    res.json({
      items: docs,
      nextCursor,
      hasMore: !!nextCursor
    });
  } catch (err) {
    logger.error('Error in listItems', { error: err.message, stack: err.stack });
    res.status(500).json({ 
      error: 'internal_error',
      message: 'An internal error occurred'
    });
  }
});

