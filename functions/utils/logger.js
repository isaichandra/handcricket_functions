/**
 * Logger utility for Cloud Functions
 * 
 * Provides structured logging with different log levels.
 */

/**
 * Log an info message
 */
function info(message, metadata = {}) {
  console.log(JSON.stringify({
    level: 'info',
    message,
    timestamp: new Date().toISOString(),
    ...metadata
  }));
}

/**
 * Log a warning message
 */
function warn(message, metadata = {}) {
  console.warn(JSON.stringify({
    level: 'warn',
    message,
    timestamp: new Date().toISOString(),
    ...metadata
  }));
}

/**
 * Log an error message
 */
function error(message, metadata = {}) {
  console.error(JSON.stringify({
    level: 'error',
    message,
    timestamp: new Date().toISOString(),
    ...metadata
  }));
}

/**
 * Log a debug message (only in development)
 */
function debug(message, metadata = {}) {
  if (process.env.NODE_ENV !== 'production') {
    console.log(JSON.stringify({
      level: 'debug',
      message,
      timestamp: new Date().toISOString(),
      ...metadata
    }));
  }
}

module.exports = { info, warn, error, debug };

