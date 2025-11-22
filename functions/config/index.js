/**
 * Configuration module
 * 
 * Centralized configuration for Cloud Functions.
 * Supports multiple environments: local, staging, and prod.
 * Reads from environment variables with sensible defaults.
 */

// Detect environment from multiple sources
function detectEnvironment() {
  // Priority: FIREBASE_ENV > NODE_ENV > default to local
  const env = process.env.FIREBASE_ENV || process.env.NODE_ENV || 'local';
  
  // Normalize environment names
  const envMap = {
    'local': 'local',
    'development': 'local',
    'dev': 'local',
    'staging': 'staging',
    'stage': 'staging',
    'production': 'prod',
    'prod': 'prod'
  };
  
  return envMap[env.toLowerCase()] || 'local';
}

const ENV = detectEnvironment();
const IS_LOCAL = ENV === 'local';
const IS_STAGING = ENV === 'staging';
const IS_PROD = ENV === 'prod';

// Environment-specific defaults
const envDefaults = {
  local: {
    DEFAULT_PAGE_SIZE: 10,
    MAX_PAGE_SIZE: 50,
    CURSOR_TTL_MS: 10 * 60 * 1000, // 10 minutes for local
    LOG_LEVEL: 'debug'
  },
  staging: {
    DEFAULT_PAGE_SIZE: 20,
    MAX_PAGE_SIZE: 100,
    CURSOR_TTL_MS: 30 * 60 * 1000, // 30 minutes
    LOG_LEVEL: 'info'
  },
  prod: {
    DEFAULT_PAGE_SIZE: 20,
    MAX_PAGE_SIZE: 100,
    CURSOR_TTL_MS: 30 * 60 * 1000, // 30 minutes
    LOG_LEVEL: 'warn'
  }
};

const defaults = envDefaults[ENV] || envDefaults.local;

module.exports = {
  // Environment info
  ENV,
  IS_LOCAL,
  IS_STAGING,
  IS_PROD,
  NODE_ENV: process.env.NODE_ENV || (IS_LOCAL ? 'development' : 'production'),
  
  // Pagination defaults (env-specific with overrides)
  DEFAULT_PAGE_SIZE: parseInt(
    process.env.DEFAULT_PAGE_SIZE || String(defaults.DEFAULT_PAGE_SIZE),
    10
  ),
  MAX_PAGE_SIZE: parseInt(
    process.env.MAX_PAGE_SIZE || String(defaults.MAX_PAGE_SIZE),
    10
  ),
  
  // Cursor configuration
  CURSOR_TTL_MS: parseInt(
    process.env.CURSOR_TTL_MS || String(defaults.CURSOR_TTL_MS),
    10
  ),
  
  // Firebase project
  PROJECT_ID: process.env.GCLOUD_PROJECT || process.env.GCP_PROJECT,
  
  // Logging
  LOG_LEVEL: process.env.LOG_LEVEL || defaults.LOG_LEVEL,
  
  // Cursor HMAC Secret (required, should be set per environment)
  CURSOR_HMAC_SECRET: process.env.CURSOR_HMAC_SECRET
};

