#!/bin/bash
# Deployment script for Firebase Functions
# Usage: ./scripts/deploy.sh [local|staging|prod] [--only functions|firestore:rules|firestore:indexes|all]

set -e

ENV=${1:-staging}
TARGET=${2:-functions}

# Validate environment
if [[ ! "$ENV" =~ ^(local|staging|prod)$ ]]; then
  echo "Error: Invalid environment. Must be one of: local, staging, prod"
  exit 1
fi

# Safety check for production
if [ "$ENV" = "prod" ]; then
  echo "⚠️  WARNING: You are about to deploy to PRODUCTION"
  read -p "Are you sure? (yes/no): " confirm
  if [ "$confirm" != "yes" ]; then
    echo "Deployment cancelled"
    exit 0
  fi
fi

echo "🚀 Deploying to environment: $ENV"
echo "📦 Target: $TARGET"

# Set environment
export FIREBASE_ENV=$ENV

# Switch Firebase project
firebase use $ENV

# Determine deployment target
case $TARGET in
  functions)
    echo "Deploying Cloud Functions..."
    firebase deploy --only functions
    ;;
  rules)
    echo "Deploying Firestore Rules..."
    firebase deploy --only firestore:rules
    ;;
  indexes)
    echo "Deploying Firestore Indexes..."
    firebase deploy --only firestore:indexes
    ;;
  all)
    echo "Deploying all (Functions, Rules, Indexes)..."
    firebase deploy --only functions,firestore:rules,firestore:indexes
    ;;
  *)
    echo "Error: Invalid target. Must be one of: functions, rules, indexes, all"
    exit 1
    ;;
esac

echo "✅ Deployment complete!"

