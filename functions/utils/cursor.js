/**
 * Cursor utilities for pagination
 * 
 * Implements opaque, server-validated cursors using base64url encoding
 * and HMAC-SHA256 signatures.
 */

const crypto = require('crypto');

const SECRET = process.env.CURSOR_HMAC_SECRET;
const HMAC_ALGO = 'sha256';

if (!SECRET) {
  console.warn('WARNING: CURSOR_HMAC_SECRET not set. Cursor operations will fail.');
}

/**
 * Base64url encode a buffer
 */
function base64urlEncode(buf) {
  return buf.toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

/**
 * Base64url decode a string
 */
function base64urlDecode(str) {
  // Restore padding
  str = str.replace(/-/g, '+').replace(/_/g, '/');
  while (str.length % 4) {
    str += '=';
  }
  return Buffer.from(str, 'base64');
}

/**
 * Sign a payload and return a cursor token
 * 
 * @param {Object} payload - The cursor payload { lastValue, docId, v, exp }
 * @returns {string} Signed cursor token
 * @throws {Error} If CURSOR_HMAC_SECRET is not set
 */
function signPayload(payload) {
  if (!SECRET) {
    throw new Error('CURSOR_HMAC_SECRET not set');
  }
  const json = JSON.stringify(payload);
  const b64 = base64urlEncode(Buffer.from(json));
  const hmac = crypto.createHmac(HMAC_ALGO, SECRET).update(b64).digest();
  const sig = base64urlEncode(hmac);
  return `${b64}.${sig}`;
}

/**
 * Verify and decode a cursor token
 * 
 * @param {string} token - The cursor token to verify
 * @returns {Object} Decoded payload { lastValue, docId, v, exp }
 * @throws {Error} If token is invalid, expired, or malformed
 */
function verifyCursor(token) {
  if (!SECRET) {
    throw new Error('CURSOR_HMAC_SECRET not set');
  }
  if (!token) {
    throw new Error('Missing cursor');
  }
  
  const parts = token.split('.');
  if (parts.length !== 2) {
    throw new Error('Invalid cursor format');
  }
  
  const [b64, sig] = parts;
  const expected = base64urlEncode(
    crypto.createHmac(HMAC_ALGO, SECRET).update(b64).digest()
  );
  
  // Timing-safe compare
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    throw new Error('Invalid cursor signature');
  }
  
  const json = base64urlDecode(b64).toString();
  const payload = JSON.parse(json);
  
  // Validate expiry
  if (payload.exp && Date.now() > payload.exp) {
    throw new Error('Expired cursor');
  }
  
  // Validate version
  if (!payload.v || payload.v !== 1) {
    throw new Error('Unsupported cursor version');
  }
  
  // Validate required fields
  if (!('lastValue' in payload) || !payload.docId) {
    throw new Error('Malformed cursor payload');
  }
  
  return payload;
}

module.exports = { signPayload, verifyCursor };

