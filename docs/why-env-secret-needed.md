# Why `.env` and `CURSOR_HMAC_SECRET` Are Needed

## Quick Answer

**You CAN start the emulator without them**, but:
- ✅ `health` function will work fine
- ✅ `createUserProfile` function will work fine  
- ❌ `listItems` function will **fail** when it tries to use cursor pagination

## Detailed Explanation

### What is `CURSOR_HMAC_SECRET`?

`CURSOR_HMAC_SECRET` is a cryptographic secret key used to:
1. **Sign cursor tokens** - When generating pagination cursors (next page tokens)
2. **Verify cursor tokens** - When validating cursor tokens from client requests

It ensures that:
- Cursors cannot be tampered with by clients
- Only your server can create valid cursors
- Cursor tokens are cryptographically secure

### Which Functions Need It?

Looking at your codebase:

| Function | Needs `CURSOR_HMAC_SECRET`? | Why? |
|----------|----------------------------|------|
| `health` | ❌ No | Simple health check, no pagination |
| `createUserProfile` | ❌ No | Creates user profiles, no pagination |
| `listItems` | ✅ **YES** | Uses cursor-based pagination |

### What Happens Without It?

#### Scenario 1: Starting the Emulator

**Result:** ✅ The emulator **WILL start successfully**

The emulator doesn't check for environment variables at startup. It only loads them when functions are executed.

#### Scenario 2: Calling `health` Function

```bash
curl http://localhost:5001/your-project/us-central1/health
```

**Result:** ✅ **Works perfectly**

The `health` function doesn't use cursors, so it doesn't need the secret.

#### Scenario 3: Calling `createUserProfile` Function

**Result:** ✅ **Works perfectly**

The `createUserProfile` function doesn't use cursors, so it doesn't need the secret.

#### Scenario 4: Calling `listItems` WITHOUT a cursor (first page)

```bash
curl "http://localhost:5001/your-project/us-central1/listItems?limit=20"
```

**Result:** ⚠️ **Partially works, then fails**

1. ✅ The function starts executing
2. ✅ It queries Firestore successfully
3. ✅ It returns the first page of items
4. ❌ **FAILS** when trying to generate `nextCursor` (if there are more items)

**Error you'll see:**
```json
{
  "error": "internal_error",
  "message": "An internal error occurred"
}
```

**In the logs:**
```
Error: CURSOR_HMAC_SECRET not set
```

This happens at line 90 in `listItems.js` when it calls `signPayload(payload)` to create the next cursor.

#### Scenario 5: Calling `listItems` WITH a cursor (subsequent pages)

```bash
curl "http://localhost:5001/your-project/us-central1/listItems?limit=20&cursor=some-token"
```

**Result:** ❌ **Fails immediately**

**Error you'll see:**
```json
{
  "error": "Invalid or expired cursor",
  "code": "INVALID_CURSOR"
}
```

**In the logs:**
```
Error: CURSOR_HMAC_SECRET not set
```

This happens at line 46 in `listItems.js` when it calls `verifyCursor(cursorToken)` to validate the cursor.

### Code Evidence

Looking at `functions/utils/cursor.js`:

```javascript
function signPayload(payload) {
  if (!SECRET) {
    throw new Error('CURSOR_HMAC_SECRET not set');  // ❌ Throws error
  }
  // ... rest of the code
}

function verifyCursor(token) {
  if (!SECRET) {
    throw new Error('CURSOR_HMAC_SECRET not set');  // ❌ Throws error
  }
  // ... rest of the code
}
```

Both functions **throw errors** if `CURSOR_HMAC_SECRET` is not set.

### Why `.env` File?

The `.env` file is **not strictly required**, but it's the **easiest way** to set environment variables for local development.

**Alternative ways to set `CURSOR_HMAC_SECRET`:**

1. **Using `.env` file** (recommended for local):
   ```bash
   # functions/.env
   CURSOR_HMAC_SECRET=your-secret-here
   ```

2. **Exporting in terminal** (works, but lost when terminal closes):
   ```bash
   export CURSOR_HMAC_SECRET=your-secret-here
   firebase emulators:start
   ```

3. **Using Firebase Functions config** (for deployed functions):
   ```bash
   firebase functions:config:set cursor.hmac_secret="your-secret"
   ```

4. **Passing inline** (works, but not recommended):
   ```bash
   CURSOR_HMAC_SECRET=your-secret firebase emulators:start
   ```

The `.env` file is preferred because:
- ✅ Persists across terminal sessions
- ✅ Easy to manage
- ✅ Standard practice for local development
- ✅ Can be gitignored to keep secrets safe

### Summary Table

| What You're Testing | Without `CURSOR_HMAC_SECRET` | With `CURSOR_HMAC_SECRET` |
|---------------------|----------------------------|---------------------------|
| Emulator starts | ✅ Yes | ✅ Yes |
| `health` endpoint | ✅ Works | ✅ Works |
| `createUserProfile` | ✅ Works | ✅ Works |
| `listItems` (first page, no cursor) | ⚠️ Works but fails when generating nextCursor | ✅ Works |
| `listItems` (with cursor) | ❌ Fails | ✅ Works |
| `listItems` (pagination flow) | ❌ Broken | ✅ Works |

### Recommendation

**For local development, you should:**

1. ✅ Create `functions/.env` file
2. ✅ Generate and set `CURSOR_HMAC_SECRET`
3. ✅ Set `FIREBASE_ENV=local` (optional, but recommended)

**Why?**
- You can test all functions, including pagination
- You can test the complete user flow (first page → next page)
- You avoid unexpected errors during development
- It matches your production setup

**Minimum setup if you only want to test `health` and `createUserProfile`:**
- You can skip the `.env` file
- But you'll get errors if you accidentally call `listItems`

### Quick Test

To verify if you need it, try this:

```bash
# Start emulator without CURSOR_HMAC_SECRET
firebase emulators:start --only functions

# Test health (should work)
curl http://localhost:5001/your-project/us-central1/health

# Test listItems (will fail if there are items and it tries to generate nextCursor)
curl "http://localhost:5001/your-project/us-central1/listItems?limit=20"
```

You'll see the error in the emulator logs when `listItems` tries to create a cursor.

