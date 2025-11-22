# Hand Cricket Firebase Functions

Firebase Cloud Functions and infrastructure for the Hand Cricket application.

## Project Structure

```
handcricket_functions/
├── functions/                    # Cloud Functions (JavaScript)
│   ├── package.json
│   ├── index.js                  # Main entry point for Cloud Functions
│   ├── utils/
│   │   ├── cursor.js             # Cursor pagination utilities
│   │   └── logger.js             # Logging utilities
│   ├── services/
│   │   └── firestore.js          # Firestore service layer
│   └── config/
│       └── index.js              # Configuration management (env-aware)
├── infra/                        # Infrastructure configuration
│   ├── firebase.json             # Firebase project configuration
│   ├── firestore.rules           # Firestore security rules
│   └── firestore.indexes.json    # Firestore composite indexes
├── scripts/                      # Deployment and environment scripts
│   ├── env-setup.sh              # Environment setup helper
│   ├── deploy.sh                 # Deployment script
│   └── set-env-vars.sh           # Set Firebase Functions config
├── docs/                         # Documentation
│   └── cursor-rule.mdc           # Cursor pagination guidelines
├── .firebaserc.example           # Firebase projects configuration template
├── .env.example                  # Environment variables template
├── .gitignore
├── package.json                  # Root package with convenience scripts
└── README.md                     # This file
```

## Prerequisites

- Node.js 18+
- Firebase CLI (`npm install -g firebase-tools`)
- Firebase project with billing enabled

## Setup

### Initial Setup

1. **Install dependencies:**
   ```bash
   npm install  # Installs functions dependencies
   ```

2. **Configure Firebase projects:**
   ```bash
   # Copy the example Firebase config
   cp .firebaserc.example .firebaserc
   # Edit .firebaserc and add your project IDs for local, staging, and prod
   ```

3. **Set up environment-specific configuration:**
   ```bash
   # Create environment-specific .env files (optional, for local development)
   # For local development, create functions/.env
   cp functions/.env.example functions/.env
   # Edit functions/.env with your local values
   ```

### Multi-Environment Configuration

This project supports three environments: **local**, **staging**, and **prod**.

#### 1. Firebase Project Configuration

Create `.firebaserc` (copy from `.firebaserc.example`):
```json
{
  "projects": {
    "default": "your-local-project-id",
    "local": "your-local-project-id",
    "staging": "your-staging-project-id",
    "prod": "your-prod-project-id"
  }
}
```

#### 2. Environment Variables

The configuration system automatically detects the environment from:
- `FIREBASE_ENV` environment variable (highest priority)
- `NODE_ENV` environment variable
- Defaults to `local` if neither is set

**Environment-specific defaults:**
- **local**: Smaller page sizes (10/50), shorter TTL (10 min), debug logging
- **staging**: Standard page sizes (20/100), standard TTL (30 min), info logging
- **prod**: Standard page sizes (20/100), standard TTL (30 min), warn logging

**Setting environment variables:**

For **local development** (using `.env` files):
```bash
# In functions/.env
CURSOR_HMAC_SECRET=your-local-secret
FIREBASE_ENV=local
```

For **staging/prod** (using Firebase Functions config):
```bash
# Set environment and configure
npm run env:vars:staging
# or
npm run env:vars:prod
```

Or manually:
```bash
firebase use staging
firebase functions:config:set cursor.hmac_secret="your-staging-secret"
```

#### 3. Switch Between Environments

**Using npm scripts:**
```bash
npm run setup:local      # Switch to local environment
npm run setup:staging    # Switch to staging environment
npm run setup:prod       # Switch to prod environment
```

**Using Firebase CLI directly:**
```bash
firebase use local
firebase use staging
firebase use prod
```

**Using functions package scripts:**
```bash
cd functions
npm run use:local
npm run use:staging
npm run use:prod
```

## Development

### Local Development with Emulators

```bash
# Start Firebase emulators (uses local environment)
npm run emulators

# Or using Firebase CLI directly
firebase emulators:start

# Or start only functions emulator
firebase emulators:start --only functions
```

The functions will be available at `http://localhost:5001`.

**Note:** Local development automatically uses the `local` environment configuration.

### Deployment

#### Deploy to Staging (Default)

```bash
# Deploy functions to staging
npm run deploy:staging

# Or deploy specific targets
npm run deploy:functions  # Functions only
npm run deploy:rules      # Firestore rules only
npm run deploy:indexes    # Firestore indexes only
```

#### Deploy to Production

```bash
# Deploy to production (requires confirmation)
npm run deploy:prod
```

#### Deploy to Local (for testing)

```bash
npm run deploy:local
```

#### Using Deployment Script

The `scripts/deploy.sh` script provides more control:

```bash
# Deploy functions to staging
./scripts/deploy.sh staging functions

# Deploy all (functions, rules, indexes) to staging
./scripts/deploy.sh staging all

# Deploy rules to production
./scripts/deploy.sh prod rules

# Deploy specific function
firebase deploy --only functions:listItems
```

#### Using Functions Package Scripts

```bash
cd functions
npm run deploy:staging    # Deploy to staging
npm run deploy:prod       # Deploy to production
npm run deploy:local      # Deploy to local
```

### View Logs

```bash
# View logs for current environment
cd functions && npm run logs

# View logs for specific environment
cd functions && npm run logs:staging
cd functions && npm run logs:prod
```

## Environment Variables

### Required Variables

- `CURSOR_HMAC_SECRET` - Secret key for cursor HMAC signing (minimum 32 bytes)
  - Generate with: `openssl rand -base64 32`
  - **Must be unique per environment** (local, staging, prod)
  - Set via `.env` file for local, or Firebase Functions config for deployed environments

### Optional Variables

- `FIREBASE_ENV` - Current environment: `local`, `staging`, or `prod` (auto-detected if not set)
- `DEFAULT_PAGE_SIZE` - Default pagination page size
  - Defaults: local=10, staging=20, prod=20
- `MAX_PAGE_SIZE` - Maximum allowed page size
  - Defaults: local=50, staging=100, prod=100
- `CURSOR_TTL_MS` - Cursor expiration time in milliseconds
  - Defaults: local=600000 (10 min), staging=1800000 (30 min), prod=1800000 (30 min)
- `LOG_LEVEL` - Logging level (debug/info/warn/error)
  - Defaults: local=debug, staging=info, prod=warn
- `NODE_ENV` - Node environment (development/production)
  - Auto-set based on FIREBASE_ENV

### Setting Environment Variables

**For Local Development:**
```bash
# Create functions/.env
CURSOR_HMAC_SECRET=your-local-secret
FIREBASE_ENV=local
```

**For Staging/Prod (Firebase Functions Config):**
```bash
# Use the helper script
npm run env:vars:staging
npm run env:vars:prod

# Or manually
firebase use staging
firebase functions:config:set cursor.hmac_secret="your-secret"
```

### Environment Detection

The configuration module (`functions/config/index.js`) automatically detects the environment:
1. Checks `FIREBASE_ENV` environment variable
2. Falls back to `NODE_ENV` 
3. Defaults to `local` if neither is set

Environment-specific defaults are applied automatically based on the detected environment.

## API Endpoints

### Health Check

```
GET /health
```

Returns service health status.

### List Items (with pagination)

```
GET /listItems?limit=20&cursor=<token>
```

Query parameters:
- `limit` (optional): Number of items per page (max 100, default 20)
- `cursor` (optional): Pagination cursor token

Response:
```json
{
  "items": [...],
  "nextCursor": "token-string-or-null",
  "hasMore": true
}
```

## Cursor Pagination

This project implements opaque, server-validated cursors for pagination. See `docs/cursor-rule.mdc` for detailed documentation.

Key features:
- Base64url-encoded payloads with HMAC-SHA256 signatures
- Server-side validation of all cursors
- Automatic expiration (configurable TTL)
- Deterministic ordering with tie-breakers

## Security

- All cursors are validated server-side using HMAC signatures
- Firestore security rules enforce authentication and authorization
- Environment variables are never exposed to clients
- Cursor secrets should be rotated periodically

## Testing

```bash
cd functions
npm test
```

## Troubleshooting

### Environment Issues

**Wrong Firebase project selected:**
```bash
# Check current project
firebase use

# Switch to correct environment
firebase use staging
# or
npm run setup:staging
```

**Configuration not loading correctly:**
- Verify `.firebaserc` has correct project IDs
- Check that `FIREBASE_ENV` is set correctly
- Ensure environment variables are set for the current environment

### Cursor Errors

- Ensure `CURSOR_HMAC_SECRET` is set in environment
  - For local: Check `functions/.env`
  - For deployed: Check Firebase Functions config
- Check that cursor tokens haven't expired
- Verify cursor format matches expected structure
- **Important**: Each environment (local/staging/prod) must have its own unique `CURSOR_HMAC_SECRET`

### Firestore Errors

- Check security rules match your data model
- Ensure composite indexes are deployed for complex queries
- Verify authentication is working correctly
- Ensure you're using the correct Firebase project for your environment

### Deployment Issues

**Deployment fails:**
- Verify you're authenticated: `firebase login`
- Check you have permissions for the target project
- Ensure the correct environment is selected: `firebase use <env>`

**Functions not updating:**
- Clear Firebase cache: `firebase deploy --only functions --force`
- Check function logs: `npm run logs:staging` or `npm run logs:prod`

## Contributing

1. Follow the cursor pagination guidelines in `docs/cursor-rule.mdc`
2. Update documentation when making changes
3. Test locally with emulators before deploying
4. Ensure all environment variables are documented

## License

[Your License Here]

