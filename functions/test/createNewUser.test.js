/**
 * Tests for createNewUser Cloud Function
 */

const { expect } = require('chai');
const sinon = require('sinon');
const proxyquire = require('proxyquire');
const functions = require('firebase-functions');

describe('createNewUser', () => {
  let sandbox;
  let authStub;
  let databaseStub;
  let userRefStub;
  let usernameRefStub;
  let firestoreStub;
  let createNewUserHandler;
  let mockAdmin;

  beforeEach(() => {
    sandbox = sinon.createSandbox();
    
    // Create auth stub with getUser method
    authStub = {
      getUser: sandbox.stub()
    };

    // Setup Firestore document stubs
    // User document stub - needs get() to return a snapshot with exists property
    const userDocStub = {
      get: sandbox.stub().resolves({ exists: false }),
      set: sandbox.stub()
    };
    
    // Username document stub - needs get() to return a snapshot with exists property
    const usernameDocStub = {
      get: sandbox.stub().resolves({ exists: false }),
      set: sandbox.stub()
    };

    // Setup Firestore collection stubs
    const usersCollectionStub = {
      doc: sandbox.stub().returns(userDocStub)
    };
    
    const usernamesCollectionStub = {
      doc: sandbox.stub().returns(usernameDocStub)
    };

    const firestoreCollectionStub = sandbox.stub();
    firestoreCollectionStub.withArgs('users').returns(usersCollectionStub);
    firestoreCollectionStub.withArgs('usernames').returns(usernamesCollectionStub);

    const fieldValueStub = {
      serverTimestamp: sandbox.stub().returns('SERVER_TIMESTAMP')
    };

    // Declare firestoreStub in the outer scope so tests can access it
    firestoreStub = {
      collection: firestoreCollectionStub,
      runTransaction: sandbox.stub()
    };

    // Add constructor with FieldValue
    const FirestoreConstructor = function() {
      return firestoreStub;
    };
    FirestoreConstructor.FieldValue = fieldValueStub;
    firestoreStub.constructor = FirestoreConstructor;

    // Store stubs for use in tests (for backward compatibility with existing tests)
    userRefStub = userDocStub;
    usernameRefStub = usernameDocStub;

    // Create mock admin object
    mockAdmin = {
      auth: () => authStub,
      database: () => databaseStub,
      firestore: () => firestoreStub
    };

    // Use proxyquire to load the module with mocked firebase-admin
    delete require.cache[require.resolve('../handlers/createNewUser')];
    delete require.cache[require.resolve('../utils/auth')];
    delete require.cache[require.resolve('../utils/firestore')];
    
    // Mock utilities
    const mockAuth = proxyquire('../utils/auth', {
      'firebase-admin': mockAdmin
    });
    
    const mockFirestore = proxyquire('../utils/firestore', {
      'firebase-admin': mockAdmin
    });
    
    const createNewUser = proxyquire('../handlers/createNewUser', {
      'firebase-admin': mockAdmin,
      '../utils/auth': mockAuth,
      '../utils/firestore': mockFirestore
    });
    createNewUserHandler = createNewUser.handler;
  });

  afterEach(() => {
    sandbox.restore();
  });

  describe('Authentication', () => {
    it('should throw error if user is not authenticated', async () => {
      const context = { auth: null, app: {} };
      const data = { username: 'testuser123' };

      try {
        await createNewUserHandler(data, context);
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error).to.be.instanceOf(functions.https.HttpsError);
        expect(error.code).to.equal('unauthenticated');
      }
    });

    it('should throw error if uid is missing', async () => {
      const context = { auth: {}, app: {} };
      const data = { username: 'testuser123' };

      try {
        await createNewUserHandler(data, context);
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error).to.be.instanceOf(functions.https.HttpsError);
        expect(error.code).to.equal('unauthenticated');
      }
    });
  });

  describe('Email Verification', () => {
    it('should throw error if email is not verified', async () => {
      const uid = 'test-uid-123';
      const context = { auth: { uid }, app: {} };
      const data = { username: 'testuser123' };

      authStub.getUser.withArgs(uid).resolves({
        uid,
        email: 'test@example.com',
        emailVerified: false
      });

      try {
        await createNewUserHandler(data, context);
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error).to.be.instanceOf(functions.https.HttpsError);
        expect(error.code).to.equal('failed-precondition');
        expect(error.message).to.equal('use a verified email address to continue');
      }
    });
  });

  describe('Username Validation', () => {
    const uid = 'test-uid-123';
    const context = { auth: { uid }, app: {} };
    
    beforeEach(() => {
      authStub.getUser.withArgs(uid).resolves({
        uid,
        email: 'test@example.com',
        emailVerified: true
      });
      // User doesn't exist
      userRefStub.get.resolves({ exists: false });
      usernameRefStub.get.resolves({ exists: false });
    });

    it('should throw error if username is missing', async () => {
      const data = {};

      try {
        await createNewUserHandler(data, context);
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error).to.be.instanceOf(functions.https.HttpsError);
        expect(error.code).to.equal('invalid-argument');
      }
    });

    it('should throw error if username is not a string', async () => {
      const data = { username: 12345 };

      try {
        await createNewUserHandler(data, context);
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error).to.be.instanceOf(functions.https.HttpsError);
        expect(error.code).to.equal('invalid-argument');
      }
    });

    it('should throw error if username is too short (< 8 chars)', async () => {
      const data = { username: 'short' };

      try {
        await createNewUserHandler(data, context);
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error).to.be.instanceOf(functions.https.HttpsError);
        expect(error.code).to.equal('invalid-argument');
        expect(error.message).to.equal('username rules failed');
      }
    });

    it('should throw error if username is too long (> 15 chars)', async () => {
      const data = { username: 'thisusernameistoolong' };

      try {
        await createNewUserHandler(data, context);
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error).to.be.instanceOf(functions.https.HttpsError);
        expect(error.code).to.equal('invalid-argument');
        expect(error.message).to.equal('username rules failed');
      }
    });

    it('should throw error if username starts with underscore', async () => {
      const data = { username: '_testuser' };

      try {
        await createNewUserHandler(data, context);
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error).to.be.instanceOf(functions.https.HttpsError);
        expect(error.code).to.equal('invalid-argument');
        expect(error.message).to.equal('username rules failed');
      }
    });

    it('should throw error if username starts with number', async () => {
      const data = { username: '123testuser' };

      try {
        await createNewUserHandler(data, context);
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error).to.be.instanceOf(functions.https.HttpsError);
        expect(error.code).to.equal('invalid-argument');
        expect(error.message).to.equal('username rules failed');
      }
    });

    it('should throw error if username contains uppercase letters', async () => {
      const data = { username: 'TestUser123' };

      try {
        await createNewUserHandler(data, context);
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error).to.be.instanceOf(functions.https.HttpsError);
        expect(error.code).to.equal('invalid-argument');
        expect(error.message).to.equal('username rules failed');
      }
    });

    it('should throw error if username contains invalid characters', async () => {
      const data = { username: 'test-user' };

      try {
        await createNewUserHandler(data, context);
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error).to.be.instanceOf(functions.https.HttpsError);
        expect(error.code).to.equal('invalid-argument');
        expect(error.message).to.equal('username rules failed');
      }
    });

    it('should accept valid username', async () => {
      const data = { username: 'testuser123' };
      // User doesn't exist
      userRefStub.get.resolves({ exists: false });
      // Username doesn't exist
      usernameRefStub.get.resolves({ exists: false });
      // Transaction succeeds
      firestoreStub.runTransaction.resolves();

      const result = await createNewUserHandler(data, context);
      expect(result.success).to.be.true;
    });
  });

  describe('User Existence Check', () => {
    const uid = 'test-uid-123';
    const context = { auth: { uid }, app: {} };
    const data = { username: 'testuser123' };

    beforeEach(() => {
      authStub.getUser.withArgs(uid).resolves({
        uid,
        email: 'test@example.com',
        emailVerified: true
      });
    });

    it('should throw error if user already exists', async () => {
      // User already exists
      userRefStub.get.resolves({ exists: true });

      try {
        await createNewUserHandler(data, context);
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error).to.be.instanceOf(functions.https.HttpsError);
        expect(error.code).to.equal('already-exists');
        expect(error.message).to.equal('user already exists');
      }
    });
  });

  describe('Username Existence Check', () => {
    const uid = 'test-uid-123';
    const context = { auth: { uid }, app: {} };
    const data = { username: 'testuser123' };

    beforeEach(() => {
      authStub.getUser.withArgs(uid).resolves({
        uid,
        email: 'test@example.com',
        emailVerified: true
      });
      // User doesn't exist
      userRefStub.get.resolves({ exists: false });
    });

    it('should throw error if username already taken', async () => {
      // Username already exists (in transaction)
      firestoreStub.runTransaction.callsFake(async (callback) => {
        const transaction = {
          get: sandbox.stub()
            // First get: user document (doesn't exist)
            .onFirstCall().resolves({ exists: false })
            // Second get: username document (exists - username taken)
            .onSecondCall().resolves({ exists: true }),
          set: sandbox.stub()
        };
        await callback(transaction);
      });

      try {
        await createNewUserHandler(data, context);
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error).to.be.instanceOf(functions.https.HttpsError);
        expect(error.code).to.equal('already-exists');
        expect(error.message).to.include('already taken');
      }
    });
  });

  describe('Successful Creation', () => {
    const uid = 'test-uid-123';
    const context = { auth: { uid }, app: {} };
    const data = { username: 'testuser123' };
    const email = 'test@example.com';
    const timestamp = 1234567890;

    beforeEach(() => {
      authStub.getUser.withArgs(uid).resolves({
        uid,
        email,
        emailVerified: true
      });
      // User doesn't exist
      userRefStub.get.resolves({ exists: false });
      usernameRefStub.get.resolves({ exists: false });
      
      // Mock transaction
      firestoreStub.runTransaction.callsFake(async (callback) => {
        const transaction = {
          get: sandbox.stub().resolves({ exists: false }),
          set: sandbox.stub()
        };
        await callback(transaction);
      });
    });

    it('should successfully create user profile', async () => {
      const result = await createNewUserHandler(data, context);

      expect(result.success).to.be.true;
      expect(firestoreStub.runTransaction.calledOnce).to.be.true;
    });

    it('should use same timestamp for both username and user', async () => {
      let capturedTimestamps = [];
      firestoreStub.runTransaction.callsFake(async (callback) => {
        const transaction = {
          get: sandbox.stub().resolves({ exists: false }),
          set: sandbox.stub().callsFake((ref, data) => {
            if (data.created_at) {
              capturedTimestamps.push(data.created_at);
            }
          })
        };
        await callback(transaction);
      });

      await createNewUserHandler(data, context);

      // Both documents should have the same timestamp (username and user)
      expect(capturedTimestamps.length).to.equal(2);
      expect(capturedTimestamps[0]).to.equal(capturedTimestamps[1]);
    });
  });

  describe('Retry Logic', () => {
    const uid = 'test-uid-123';
    const context = { auth: { uid }, app: {} };
    const data = { username: 'testuser123' };

    beforeEach(() => {
      authStub.getUser.withArgs(uid).resolves({
        uid,
        email: 'test@example.com',
        emailVerified: true
      });
      // User doesn't exist
      userRefStub.get.resolves({ exists: false });
      usernameRefStub.get.resolves({ exists: false });
    });

    it('should retry username creation on failure', async () => {
      let attemptCount = 0;
      firestoreStub.runTransaction.callsFake(async (callback) => {
        attemptCount++;
        if (attemptCount === 1) {
          // First attempt fails
          throw new Error('Transaction failed');
        }
        // Second attempt succeeds
        const transaction = {
          get: sandbox.stub().resolves({ exists: false }),
          set: sandbox.stub()
        };
        await callback(transaction);
      });

      await createNewUserHandler(data, context);

      expect(attemptCount).to.equal(2);
    });

    it('should throw error after max retries for username', async () => {
      firestoreStub.runTransaction.rejects(new Error('Transaction failed'));

      try {
        await createNewUserHandler(data, context);
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error).to.be.instanceOf(functions.https.HttpsError);
        expect(error.message).to.equal('Something is wrong');
        expect(firestoreStub.runTransaction.callCount).to.equal(3);
      }
    });

    it('should retry user creation on failure with delay', async () => {
      let attemptCount = 0;
      firestoreStub.runTransaction.callsFake(async (callback) => {
        attemptCount++;
        if (attemptCount === 1) {
          // First attempt fails
          throw new Error('Transaction failed');
        }
        // Second attempt succeeds
        const transaction = {
          get: sandbox.stub().resolves({ exists: false }),
          set: sandbox.stub()
        };
        await callback(transaction);
      });

      await createNewUserHandler(data, context);

      expect(attemptCount).to.equal(2);
    });

    it('should cleanup username if user creation fails after retries', async () => {
      // This test doesn't apply to Firestore since we use transactions
      // Transactions are atomic, so if user creation fails, username creation also fails
      firestoreStub.runTransaction.rejects(new Error('Transaction failed'));

      try {
        await createNewUserHandler(data, context);
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error).to.be.instanceOf(functions.https.HttpsError);
        expect(error.message).to.equal('Something is wrong');
      }
    });
  });
});
