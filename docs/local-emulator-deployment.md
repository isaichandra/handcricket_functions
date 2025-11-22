# Step-by-Step Guide: Deploy Cloud Functions to Local Firebase Emulator

This guide walks you through deploying and running your Firebase Cloud Functions in the local Firebase emulator.

## Prerequisites

Before starting, ensure you have:

1. **Node.js 18+** installed
2. **Firebase CLI** installed globally:
   ```bash
   npm install -g firebase-tools
   ```
3. **Firebase CLI logged in**:
   ```bash
   firebase login
   ```

## Step 1: Install Dependencies

Install all required npm packages for the functions:

```bash
# From the project root
npm install

# This will automatically run: cd functions && npm install
```

Or manually:

```bash
cd functions
npm install
cd ..
```

## Step 2: Configure Firebase Project (if not already done)

Create a `.firebaserc` file in the project root if it doesn't exist:

```bash
# Create .firebaserc (or copy from .firebaserc.example if available)
```

The file should contain:

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

**Note:** For local emulator development, you can use any project ID (even a dummy one) since the emulator runs independently. However, it's recommended to use a dedicated local project ID.

## Step 3: Set Up Local Environment Variables

Create a `.env` file in the `functions/` directory:

```bash
cd functions
touch .env
```

Add the following environment variables to `functions/.env`:

```bash
# functions/.env
CURSOR_HMAC_SECRET=your-local-secret-here
FIREBASE_ENV=local
DEFAULT_PAGE_SIZE=10
MAX_PAGE_SIZE=50
LOG_LEVEL=debug
```

**Generate a secure secret:**

```bash
openssl rand -base64 32
```

Copy the output and use it as your `CURSOR_HMAC_SECRET` value.

**Important:** 
- The `.env` file should be in `functions/.env` (not the root)
- Make sure `.env` is in your `.gitignore` to avoid committing secrets

## Step 4: Verify Firebase Configuration

Check that your `infra/firebase.json` has emulator configuration:

```json
{
  "emulators": {
    "functions": {
      "port": 5001
    },
    "firestore": {
      "port": 8080
    },
    "ui": {
      "enabled": true,
      "port": 4000
    },
    "singleProjectMode": true
  }
}
```

This configuration is already set up in your project.

## Step 5: Start the Firebase Emulators

You have multiple options to start the emulators:

### Option A: Using npm script (Recommended)

From the project root:

```bash
npm run emulators
```

This runs: `cd functions && npm run serve`, which starts only the functions emulator.

### Option B: Start all emulators (Functions + Firestore + UI)

From the project root:

```bash
firebase emulators:start
```

This will start:
- **Functions Emulator** on port `5001`
- **Firestore Emulator** on port `8080`
- **Emulator UI** on port `4000` (web interface)

### Option C: Start only specific emulators

```bash
# Only functions
firebase emulators:start --only functions

# Functions and Firestore
firebase emulators:start --only functions,firestore

# Functions, Firestore, and UI
firebase emulators:start --only functions,firestore,ui
```

## Step 6: Verify Functions are Running

Once the emulators start, you should see output like:

```
✔  functions[us-central1-listItems]: http function initialized (http://localhost:5001/your-project-id/us-central1/listItems)
✔  functions[us-central1-health]: http function initialized (http://localhost:5001/your-project-id/us-central1/health)
✔  functions[us-central1-createUserProfile]: http function initialized (http://localhost:5001/your-project-id/us-central1/createUserProfile)

✔  All emulators ready! It is now safe to connect.
```

### Access Points:

1. **Emulator UI**: Open `http://localhost:4000` in your browser
   - View function logs
   - Monitor Firestore data
   - Test functions interactively

2. **Function Endpoints**: Your functions will be available at:
   - `http://localhost:5001/your-project-id/us-central1/listItems`
   - `http://localhost:5001/your-project-id/us-central1/health`
   - `http://localhost:5001/your-project-id/us-central1/createUserProfile`

## Step 7: Test Your Functions

### Test Health Endpoint

```bash
curl http://localhost:5001/your-project-id/us-central1/health
```

### Test List Items (with pagination)

```bash
curl "http://localhost:5001/your-project-id/us-central1/listItems?limit=20"
```

### Test Create User Profile (Callable Function)

For callable functions, you'll need to use the Firebase SDK or the emulator UI. In the Emulator UI (http://localhost:4000), you can test callable functions directly.

## Step 8: Monitor Logs

Function logs will appear in the terminal where you started the emulators. You can also view them in the Emulator UI at `http://localhost:4000`.

## Troubleshooting

### Issue: Functions not loading

**Solution:**
1. Check that dependencies are installed: `cd functions && npm install`
2. Verify `.env` file exists in `functions/.env`
3. Ensure `CURSOR_HMAC_SECRET` is set in `.env`
4. Restart the emulators

### Issue: "CURSOR_HMAC_SECRET not set" error

**Solution:**
1. Create `functions/.env` file
2. Add `CURSOR_HMAC_SECRET=your-secret-here`
3. Restart emulators

### Issue: Port already in use

**Solution:**
```bash
# Kill process on port 5001 (functions)
lsof -ti:5001 | xargs kill -9

# Kill process on port 4000 (UI)
lsof -ti:4000 | xargs kill -9

# Kill process on port 8080 (Firestore)
lsof -ti:8080 | xargs kill -9
```

Or change ports in `infra/firebase.json`.

### Issue: Wrong Firebase project

**Solution:**
```bash
# Check current project
firebase use

# Switch to local
firebase use local
# or
npm run setup:local
```

### Issue: Environment variables not loading

**Solution:**
1. Ensure `.env` file is in `functions/.env` (not root)
2. Verify `FIREBASE_ENV=local` is set in `.env`
3. Restart emulators after changing `.env`

## Quick Reference Commands

```bash
# Install dependencies
npm install

# Start emulators (functions only)
npm run emulators

# Start all emulators
firebase emulators:start

# Start specific emulators
firebase emulators:start --only functions,firestore

# Stop emulators
# Press Ctrl+C in the terminal

# View emulator UI
open http://localhost:4000

# Check current Firebase project
firebase use

# Switch to local environment
npm run setup:local
```

## Next Steps

After successfully running functions in the emulator:

1. **Test your functions** using the Emulator UI or curl commands
2. **Add test data** to Firestore emulator for testing
3. **Write unit tests** (see `functions/test/` directory)
4. **Deploy to staging** when ready: `npm run deploy:staging`

## Additional Resources

- [Firebase Emulator Documentation](https://firebase.google.com/docs/emulator-suite)
- [Local Development Guide](./environment-setup.md)
- [Project README](../README.md)

