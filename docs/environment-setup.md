# Multi-Environment Setup Guide

This guide explains how to configure and manage the three environments: **local**, **staging**, and **prod**.

## Overview

The project is configured to support three distinct environments:

1. **local** - Local development with Firebase Emulators
2. **staging** - Staging/testing environment
3. **prod** - Production environment

Each environment has:
- Its own Firebase project
- Environment-specific configuration defaults
- Separate environment variables
- Independent deployment process

## Initial Setup

### 1. Configure Firebase Projects

Create `.firebaserc` in the project root:

```json
{
  "projects": {
    "default": "handcricket-local",
    "local": "handcricket-local",
    "staging": "handcricket-staging",
    "prod": "handcricket-prod"
  }
}
```

Replace the project IDs with your actual Firebase project IDs.

### 2. Set Up Local Environment

For local development, create `functions/.env`:

```bash
# functions/.env
CURSOR_HMAC_SECRET=your-local-secret-here
FIREBASE_ENV=local
DEFAULT_PAGE_SIZE=10
MAX_PAGE_SIZE=50
LOG_LEVEL=debug
```

Generate a secret:
```bash
openssl rand -base64 32
```

### 3. Set Up Staging Environment

```bash
# Switch to staging
firebase use staging

# Set environment variables
firebase functions:config:set cursor.hmac_secret="your-staging-secret"
firebase functions:config:set pagination.default_page_size="20"
firebase functions:config:set pagination.max_page_size="100"
```

Or use the helper script:
```bash
npm run env:vars:staging
```

### 4. Set Up Production Environment

```bash
# Switch to production
firebase use prod

# Set environment variables
firebase functions:config:set cursor.hmac_secret="your-prod-secret"
firebase functions:config:set pagination.default_page_size="20"
firebase functions:config:set pagination.max_page_size="100"
```

Or use the helper script:
```bash
npm run env:vars:prod
```

**Important**: Use different secrets for each environment!

## Environment Configuration

### Automatic Environment Detection

The configuration system automatically detects the environment:

1. Checks `FIREBASE_ENV` environment variable
2. Falls back to `NODE_ENV` (maps: development→local, production→prod)
3. Defaults to `local` if neither is set

### Environment-Specific Defaults

| Setting | Local | Staging | Prod |
|---------|-------|---------|------|
| DEFAULT_PAGE_SIZE | 10 | 20 | 20 |
| MAX_PAGE_SIZE | 50 | 100 | 100 |
| CURSOR_TTL_MS | 600000 (10 min) | 1800000 (30 min) | 1800000 (30 min) |
| LOG_LEVEL | debug | info | warn |

These defaults can be overridden via environment variables.

## Working with Environments

### Switch Environments

**Using npm scripts:**
```bash
npm run setup:local
npm run setup:staging
npm run setup:prod
```

**Using Firebase CLI:**
```bash
firebase use local
firebase use staging
firebase use prod
```

**Check current environment:**
```bash
firebase use
```

### Deploy to Environments

**Deploy to staging:**
```bash
npm run deploy:staging
# or
./scripts/deploy.sh staging functions
```

**Deploy to production:**
```bash
npm run deploy:prod
# or (with confirmation prompt)
./scripts/deploy.sh prod functions
```

**Deploy specific targets:**
```bash
./scripts/deploy.sh staging functions    # Functions only
./scripts/deploy.sh staging rules        # Rules only
./scripts/deploy.sh staging indexes      # Indexes only
./scripts/deploy.sh staging all          # Everything
```

### View Logs

```bash
# Current environment
cd functions && npm run logs

# Specific environment
cd functions && npm run logs:staging
cd functions && npm run logs:prod
```

## Best Practices

### 1. Secret Management

- **Never commit secrets** to version control
- Use different secrets for each environment
- Rotate secrets periodically
- Store production secrets securely (e.g., secret management service)

### 2. Environment Variables

- Use `.env` files for local development (gitignored)
- Use Firebase Functions config for deployed environments
- Document all required variables in `.env.example`

### 3. Deployment Workflow

1. **Develop locally** with emulators
2. **Test in staging** before production
3. **Deploy to prod** only after staging validation
4. Always verify the correct environment before deploying

### 4. Configuration Changes

- Test configuration changes in local first
- Deploy to staging to verify
- Only update production after validation
- Keep environment configs in sync (where appropriate)

## Troubleshooting

### Wrong Environment Selected

```bash
# Check current project
firebase use

# Switch to correct environment
firebase use staging
```

### Configuration Not Loading

1. Verify `.firebaserc` has correct project IDs
2. Check `FIREBASE_ENV` is set (for local: in `functions/.env`)
3. For deployed: Verify Firebase Functions config is set
4. Restart emulators if running locally

### Deployment to Wrong Environment

Always verify before deploying:
```bash
firebase use  # Check current project
```

The deployment script will prompt for confirmation when deploying to production.

### Environment Variables Not Working

**For local:**
- Check `functions/.env` exists and has correct values
- Restart emulators after changing `.env`

**For deployed:**
- Verify Firebase Functions config: `firebase functions:config:get`
- Re-deploy functions after changing config

## Quick Reference

### Common Commands

```bash
# Setup
npm run setup:local
npm run setup:staging
npm run setup:prod

# Deploy
npm run deploy:staging
npm run deploy:prod

# Environment variables
npm run env:vars:staging
npm run env:vars:prod

# Logs
cd functions && npm run logs:staging
cd functions && npm run logs:prod

# Emulators (local)
npm run emulators
```

### File Locations

- `.firebaserc` - Firebase project configuration
- `functions/.env` - Local environment variables
- `functions/config/index.js` - Configuration module
- `scripts/` - Deployment and setup scripts

