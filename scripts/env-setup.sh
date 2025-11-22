#!/bin/bash
# Environment setup script for Firebase projects
# Usage: ./scripts/env-setup.sh [local|staging|prod]

set -e

ENV=${1:-local}

# Validate environment
if [[ ! "$ENV" =~ ^(local|staging|prod)$ ]]; then
  echo "Error: Invalid environment. Must be one of: local, staging, prod"
  exit 1
fi

echo "Setting up environment: $ENV"

# Check if .firebaserc exists
if [ ! -f .firebaserc ]; then
  echo "Warning: .firebaserc not found. Creating from example..."
  if [ -f .firebaserc.example ]; then
    cp .firebaserc.example .firebaserc
    echo "Please update .firebaserc with your project IDs"
  else
    echo "Error: .firebaserc.example not found"
    exit 1
  fi
fi

# Switch Firebase project
echo "Switching to Firebase project: $ENV"
firebase use $ENV

# Set environment variable
export FIREBASE_ENV=$ENV

echo "Environment set to: $ENV"
echo "Current Firebase project: $(firebase use | grep 'Now using' | awk '{print $3}')"

