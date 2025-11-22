# Where to Run `firebase emulators:start`

## Quick Answer

**Run from the project root directory:**
```bash
cd /Users/saichandra/SACH/dev/repo/handcricket_functions
firebase emulators:start
```

**OR use the npm script (recommended):**
```bash
cd /Users/saichandra/SACH/dev/repo/handcricket_functions
npm run emulators
```

## Detailed Explanation

### Firebase CLI Configuration Discovery

Firebase CLI looks for `firebase.json` in the following order:
1. Current directory
2. Parent directories (walking up the tree)
3. Stops at the first `firebase.json` it finds

### Your Project Structure

```
/Users/saichandra/SACH/dev/
├── firebase.json                    ← Parent directory config (for other projects)
├── .firebaserc                      ← Parent directory project config
└── repo/
    └── handcricket_functions/       ← YOUR PROJECT ROOT
        ├── package.json
        ├── .firebaserc.example
        ├── functions/
        │   ├── .env                  ← Your local env vars go here
        │   ├── package.json
        │   └── ...
        └── infra/
            └── firebase.json        ← YOUR PROJECT'S firebase.json
```

### The Problem

Your `firebase.json` is located at:
- `infra/firebase.json` (relative to project root)

But Firebase CLI expects `firebase.json` to be:
- In the current directory, OR
- In a parent directory

**Firebase CLI does NOT look in subdirectories like `infra/`.**

### Solutions

#### Option 1: Use `--config` Flag (Recommended)

Run from project root with explicit config path:

```bash
cd /Users/saichandra/SACH/dev/repo/handcricket_functions
firebase emulators:start --config infra/firebase.json
```

#### Option 2: Move or Symlink `firebase.json` to Root

Move the config file to the project root:

```bash
cd /Users/saichandra/SACH/dev/repo/handcricket_functions
mv infra/firebase.json firebase.json
```

Then update the paths in `firebase.json`:
- Change `"rules": "infra/firestore.rules"` to keep as-is (relative path)
- Change `"indexes": "infra/firestore.indexes.json"` to keep as-is (relative path)
- `"source": "functions"` is already correct

#### Option 3: Use npm Scripts (Easiest)

The project already has npm scripts configured:

```bash
cd /Users/saichandra/SACH/dev/repo/handcricket_functions
npm run emulators
```

This runs: `cd functions && npm run serve`, which runs: `firebase emulators:start --only functions`

**Note:** This runs from the `functions/` directory, so Firebase CLI will look for `firebase.json` in:
1. `functions/` (not found)
2. `../` (project root - not found)
3. `../../` (repo directory - not found)
4. `../../../` (dev directory - **FOUND!** Uses parent `firebase.json`)

This might use the wrong config! ⚠️

### Recommended Solution

**Create a `firebase.json` in the project root** that references the infra directory:

```bash
cd /Users/saichandra/SACH/dev/repo/handcricket_functions
```

Create `firebase.json` in the root:

```json
{
  "functions": [
    {
      "source": "functions",
      "codebase": "default",
      "ignore": [
        "node_modules",
        ".git",
        "firebase-debug.log",
        "firebase-debug.*.log"
      ],
      "predeploy": []
    }
  ],
  "firestore": {
    "rules": "infra/firestore.rules",
    "indexes": "infra/firestore.indexes.json"
  },
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

This is identical to `infra/firebase.json`, but placed in the root where Firebase CLI expects it.

### Verify Correct Location

To verify you're in the right directory:

```bash
# Should show your project root
pwd
# Output: /Users/saichandra/SACH/dev/repo/handcricket_functions

# Should find firebase.json in current directory
ls firebase.json
# Should exist

# Should find functions directory
ls functions/
# Should exist

# Should find infra directory
ls infra/
# Should exist
```

### Summary

| Location | Command | Works? | Notes |
|----------|---------|--------|-------|
| Project root | `firebase emulators:start` | ✅ Yes | If `firebase.json` is in root |
| Project root | `firebase emulators:start --config infra/firebase.json` | ✅ Yes | Explicit config path |
| `functions/` directory | `firebase emulators:start` | ⚠️ Maybe | Might use parent `firebase.json` |
| Parent directory (`/dev/`) | `firebase emulators:start` | ❌ No | Wrong project |

### Best Practice

**Always run from the project root:**

```bash
cd /Users/saichandra/SACH/dev/repo/handcricket_functions
firebase emulators:start
```

Or if you prefer to keep config in `infra/`:

```bash
cd /Users/saichandra/SACH/dev/repo/handcricket_functions
firebase emulators:start --config infra/firebase.json
```

### Update npm Scripts

If you want to use `npm run emulators` from the root, update `package.json`:

```json
{
  "scripts": {
    "emulators": "firebase emulators:start --config infra/firebase.json"
  }
}
```

Or move `firebase.json` to root and keep the script as-is.

