/**
 * Health check endpoint
 * 
 * GET /health
 * 
 * Returns service health status.
 */

const functions = require('firebase-functions');

module.exports = functions.https.onRequest((req, res) => {
  res.json({ 
    status: 'ok',
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
});

