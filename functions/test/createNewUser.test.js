/**
 * Tests for createNewUser Cloud Function
 */

const { expect } = require('chai');
const sinon = require('sinon');
const admin = require('firebase-admin');
const functions = require('firebase-functions');

// Initialize Firebase Admin for testing (using test project or emulator)
if (!admin.apps.length) {
  admin.initializeApp({
    projectId: 'test-project',
    databaseURL: 'http://localhost:9000?ns=test-project'
  });
}

// Import the function to test
const createNewUser = require('../functions/createNewUser');

describe('createNewUser', () => {
  let sandbox;
  let authStub;
  let databaseStub;
  let userRefStub;
  let usernameRefStub;

  beforeEach(() => {
    sandbox = sinon.createSandbox();
    
    // Stub admin.auth()
    authStub = {
      getUser: sandbox.stub()
    };
    sandbox.stub(admin, 'auth').returns(authStub);

    // Stub admin.database()
    databaseStub = {
      ref: sandbox.stub()
    };
    sandbox.stub(admin, 'database').returns(databaseStub);

    // Setup ref stubs
    userRefStub = {
      once: sandbox.stub(),
      transaction: sandbox.stub()
    };
    usernameRefStub = {
      once: sandbox.stub(),
      transaction: sandbox.stub(),
      remove: sandbox.stub()
    };

    databaseStub.ref.withArgs(sinon.match(/^users\//)).returns(userRefStub);
    databaseStub.ref.withArgs(sinon.match(/^usernames\//)).returns(usernameRefStub);
  });

  afterEach(() => {
    sandbox.restore();
  });

  describe('Authentication', () => {
    it('should throw error if user is not authenticated', async () => {
      const context = { auth: null };
      const data = { username: 'testuser123' };

      try {
        await createNewUser(data, context);
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error).to.be.instanceOf(functions.https.HttpsError);
        expect(error.code).to.equal('unauthenticated');
      }
    });

    it('should throw error if uid is missing', async () => {
      const context = { auth: {} };
      const data = { username: 'testuser123' };

      try {
        await createNewUser(data, context);
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
      const context = { auth: { uid } };
      const data = { username: 'testuser123' };

      authStub.getUser.withArgs(uid).resolves({
        uid,
        email: 'test@example.com',
        emailVerified: false
      });

      try {
        await createNewUser(data, context);
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
    const context = { auth: { uid } };
    
    beforeEach(() => {
      authStub.getUser.withArgs(uid).resolves({
        uid,
        email: 'test@example.com',
        emailVerified: true
      });
      userRefStub.once.withArgs('value').resolves({
        exists: () => false
      });
    });

    it('should throw error if username is missing', async () => {
      const data = {};

      try {
        await createNewUser(data, context);
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error).to.be.instanceOf(functions.https.HttpsError);
        expect(error.code).to.equal('invalid-argument');
      }
    });

    it('should throw error if username is not a string', async () => {
      const data = { username: 12345 };

      try {
        await createNewUser(data, context);
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error).to.be.instanceOf(functions.https.HttpsError);
        expect(error.code).to.equal('invalid-argument');
      }
    });

    it('should throw error if username is too short (< 8 chars)', async () => {
      const data = { username: 'short' };

      try {
        await createNewUser(data, context);
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
        await createNewUser(data, context);
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
        await createNewUser(data, context);
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
        await createNewUser(data, context);
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
        await createNewUser(data, context);
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
        await createNewUser(data, context);
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error).to.be.instanceOf(functions.https.HttpsError);
        expect(error.code).to.equal('invalid-argument');
        expect(error.message).to.equal('username rules failed');
      }
    });

    it('should accept valid username', async () => {
      const data = { username: 'testuser123' };
      usernameRefStub.once.withArgs('value').resolves({
        exists: () => false
      });
      usernameRefStub.transaction.resolves({
        committed: true,
        snapshot: {
          val: () => ({ created_at: 1234567890 })
        }
      });
      userRefStub.transaction.resolves({
        committed: true,
        snapshot: {
          val: () => ({})
        }
      });

      const result = await createNewUser(data, context);
      expect(result.success).to.be.true;
      expect(result.username).to.equal('testuser123');
    });
  });

  describe('User Existence Check', () => {
    const uid = 'test-uid-123';
    const context = { auth: { uid } };
    const data = { username: 'testuser123' };

    beforeEach(() => {
      authStub.getUser.withArgs(uid).resolves({
        uid,
        email: 'test@example.com',
        emailVerified: true
      });
    });

    it('should throw error if user already exists', async () => {
      userRefStub.once.withArgs('value').resolves({
        exists: () => true
      });

      try {
        await createNewUser(data, context);
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
    const context = { auth: { uid } };
    const data = { username: 'testuser123' };

    beforeEach(() => {
      authStub.getUser.withArgs(uid).resolves({
        uid,
        email: 'test@example.com',
        emailVerified: true
      });
      userRefStub.once.withArgs('value').resolves({
        exists: () => false
      });
    });

    it('should throw error if username already taken', async () => {
      usernameRefStub.once.withArgs('value').resolves({
        exists: () => true
      });

      try {
        await createNewUser(data, context);
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error).to.be.instanceOf(functions.https.HttpsError);
        expect(error.code).to.equal('already-exists');
        expect(error.message).to.equal('username already taken');
      }
    });
  });

  describe('Successful Creation', () => {
    const uid = 'test-uid-123';
    const context = { auth: { uid } };
    const data = { username: 'testuser123' };
    const email = 'test@example.com';
    const timestamp = 1234567890;

    beforeEach(() => {
      authStub.getUser.withArgs(uid).resolves({
        uid,
        email,
        emailVerified: true
      });
      userRefStub.once.withArgs('value').resolves({
        exists: () => false
      });
      usernameRefStub.once.withArgs('value').resolves({
        exists: () => false
      });
    });

    it('should successfully create user profile', async () => {
      usernameRefStub.transaction.resolves({
        committed: true,
        snapshot: {
          val: () => ({ created_at: timestamp })
        }
      });
      userRefStub.transaction.resolves({
        committed: true,
        snapshot: {
          val: () => ({})
        }
      });

      const result = await createNewUser(data, context);

      expect(result.success).to.be.true;
      expect(result.username).to.equal('testuser123');
      expect(result.uid).to.equal(uid);
      expect(usernameRefStub.transaction.calledOnce).to.be.true;
      expect(userRefStub.transaction.calledOnce).to.be.true;
    });

    it('should use same timestamp for both username and user', async () => {
      let capturedTimestamp;
      usernameRefStub.transaction.resolves({
        committed: true,
        snapshot: {
          val: () => ({ created_at: timestamp })
        }
      });
      userRefStub.transaction.callsFake((updateFn) => {
        const result = updateFn(null);
        capturedTimestamp = result.created_at;
        return Promise.resolve({
          committed: true,
          snapshot: { val: () => result }
        });
      });

      await createNewUser(data, context);

      expect(capturedTimestamp).to.equal(timestamp);
    });
  });

  describe('Retry Logic', () => {
    const uid = 'test-uid-123';
    const context = { auth: { uid } };
    const data = { username: 'testuser123' };

    beforeEach(() => {
      authStub.getUser.withArgs(uid).resolves({
        uid,
        email: 'test@example.com',
        emailVerified: true
      });
      userRefStub.once.withArgs('value').resolves({
        exists: () => false
      });
      usernameRefStub.once.withArgs('value').resolves({
        exists: () => false
      });
    });

    it('should retry username creation on failure', async () => {
      usernameRefStub.transaction
        .onFirstCall().resolves({ committed: false })
        .onSecondCall().resolves({
          committed: true,
          snapshot: {
            val: () => ({ created_at: 1234567890 })
          }
        });
      userRefStub.transaction.resolves({
        committed: true,
        snapshot: { val: () => ({}) }
      });

      await createNewUser(data, context);

      expect(usernameRefStub.transaction.calledTwice).to.be.true;
    });

    it('should throw error after max retries for username', async () => {
      usernameRefStub.transaction.resolves({ committed: false });

      try {
        await createNewUser(data, context);
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error).to.be.instanceOf(functions.https.HttpsError);
        expect(error.message).to.equal('Something is wrong');
        expect(usernameRefStub.transaction.callCount).to.equal(3);
      }
    });

    it('should retry user creation on failure with delay', async () => {
      usernameRefStub.transaction.resolves({
        committed: true,
        snapshot: {
          val: () => ({ created_at: 1234567890 })
        }
      });
      userRefStub.transaction
        .onFirstCall().resolves({ committed: false })
        .onSecondCall().resolves({
          committed: true,
          snapshot: { val: () => ({}) }
        });

      await createNewUser(data, context);

      expect(userRefStub.transaction.calledTwice).to.be.true;
    });

    it('should cleanup username if user creation fails after retries', async () => {
      usernameRefStub.transaction.resolves({
        committed: true,
        snapshot: {
          val: () => ({ created_at: 1234567890 })
        }
      });
      userRefStub.transaction.resolves({ committed: false });
      usernameRefStub.remove.resolves();

      try {
        await createNewUser(data, context);
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error).to.be.instanceOf(functions.https.HttpsError);
        expect(error.message).to.equal('Something is Wrong');
        expect(usernameRefStub.remove.called).to.be.true;
      }
    });
  });
});

