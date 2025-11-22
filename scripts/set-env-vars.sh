#!/bin/bash
# Set environment variables for Firebase Functions
# Usage: ./scripts/set-env-vars.sh [local|staging|prod]

set -e

ENV=${1:-local}

# Validate environment
if [[ ! "$ENV" =~ ^(local|staging|prod)$ ]]; then
  echo "Error: Invalid environment. Must be one of: local, staging, prod"
  exit 1
fi

echo "Setting environment variables for: $ENV"

# Switch Firebase project
firebase use $ENV

# Read variables from .env file if it exists
ENV_FILE=".env.$ENV"
if [ ! -f "$ENV_FILE" ]; then
  echo "Warning: $ENV_FILE not found. Using default .env if available."
  ENV_FILE=".env"
fi

if [ ! -f "$ENV_FILE" ]; then
  echo "Error: No .env file found. Please create $ENV_FILE or .env"
  exit 1
fi

# Load environment variables
set -a
source "$ENV_FILE"
set +a

# Set Firebase Functions config
echo "Setting Firebase Functions config..."

if [ -n "$CURSOR_HMAC_SECRET" ]; then
  firebase functions:config:set cursor.hmac_secret="$CURSOR_HMAC_SECRET"
  echo "✅ Set cursor.hmac_secret"
else
  echo "⚠️  Warning: CURSOR_HMAC_SECRET not found in $ENV_FILE"
fi

# Optional: Set other config values
if [ -n "$DEFAULT_PAGE_SIZE" ]; then
  firebase functions:config:set pagination.default_page_size="$DEFAULT_PAGE_SIZE"
fi

if [ -n "$MAX_PAGE_SIZE" ]; then
  firebase functions:config:set pagination.max_page_size="$MAX_PAGE_SIZE"
fi

if [ -n "$CURSOR_TTL_MS" ]; then
  firebase functions:config:set cursor.ttl_ms="$CURSOR_TTL_MS"
fi

echo "✅ Environment variables set for $ENV"

