/**
 * Tests for quickMatch Cloud Function
 */

const { expect } = require('chai');
const sinon = require('sinon');
const proxyquire = require('proxyquire');
const functions = require('firebase-functions');

describe('quickMatch', () => {
  let sandbox;
  let authStub;
  let rtdbStub;
  let presenceRefStub;
  let firestoreStub;
  let queueCollectionStub;
  let queueDocRefStub;
  let quickMatchHandler;
  let mockAdmin;

  beforeEach(() => {
    sandbox = sinon.createSandbox();
    
    // Create auth stub with getUser method
    authStub = {
      getUser: sandbox.stub()
    };

    // Setup Realtime Database stubs
    presenceRefStub = {
      once: sandbox.stub()
    };

    rtdbStub = {
      ref: sandbox.stub()
    };
    rtdbStub.ref.withArgs(sinon.match(/^presence\//)).returns(presenceRefStub);

    // Setup Firestore stubs
    queueDocRefStub = {
      get: sandbox.stub(),
      set: sandbox.stub()
    };

    queueCollectionStub = {
      doc: sandbox.stub().returns(queueDocRefStub)
    };

    const fieldValueStub = {
      serverTimestamp: sandbox.stub().returns('SERVER_TIMESTAMP')
    };

    // Create a constructor function for Firestore that has FieldValue
    const FirestoreConstructor = function() {
      return firestoreStub;
    };
    FirestoreConstructor.FieldValue = fieldValueStub;

    firestoreStub = {
      collection: sandbox.stub().returns(queueCollectionStub),
      constructor: FirestoreConstructor
    };

    // Create mock admin object
    // Need to support both admin.firestore() and db.constructor.FieldValue
    const firestoreFunction = () => firestoreStub;
    firestoreFunction.FieldValue = fieldValueStub;
    
    mockAdmin = {
      auth: () => authStub,
      database: () => rtdbStub,
      firestore: firestoreFunction
    };

    // Use proxyquire to load the module with mocked firebase-admin
    delete require.cache[require.resolve('../handlers/quickMatch')];
    delete require.cache[require.resolve('../utils/auth')];
    delete require.cache[require.resolve('../utils/firestore')];
    
    // Mock both the handler and the auth utility
    const mockAuth = proxyquire('../utils/auth', {
      'firebase-admin': mockAdmin
    });
    
    // Mock the firestore utility
    const mockFirestore = proxyquire('../utils/firestore', {
      'firebase-admin': mockAdmin
    });
    
    const quickMatch = proxyquire('../handlers/quickMatch', {
      'firebase-admin': mockAdmin,
      '../utils/auth': mockAuth,
      '../utils/firestore': mockFirestore
    });
    quickMatchHandler = quickMatch.handler;
  });

  afterEach(() => {
    sandbox.restore();
  });

  describe('Authentication', () => {
    it('should throw error if user is not authenticated', async () => {
      const context = { auth: null, app: {} };
      const data = {};

      try {
        await quickMatchHandler(data, context);
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error).to.be.instanceOf(functions.https.HttpsError);
        expect(error.code).to.equal('unauthenticated');
      }
    });

    it('should throw error if uid is missing', async () => {
      const context = { auth: {}, app: {} };
      const data = {};

      try {
        await quickMatchHandler(data, context);
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
      const data = {};

      authStub.getUser.withArgs(uid).resolves({
        uid,
        email: 'test@example.com',
        emailVerified: false
      });

      try {
        await quickMatchHandler(data, context);
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error).to.be.instanceOf(functions.https.HttpsError);
        expect(error.code).to.equal('failed-precondition');
        expect(error.message).to.equal('use a verified email address to continue');
      }
    });
  });

  describe('User Online Check', () => {
    const uid = 'test-uid-123';
    const context = { auth: { uid }, app: {} };
    const data = {};

    beforeEach(() => {
      authStub.getUser.withArgs(uid).resolves({
        uid,
        email: 'test@example.com',
        emailVerified: true
      });
    });

    it('should throw error if user is not online', async () => {
      presenceRefStub.once.withArgs('value').resolves({
        exists: () => false
      });

      try {
        await quickMatchHandler(data, context);
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error).to.be.instanceOf(functions.https.HttpsError);
        expect(error.code).to.equal('failed-precondition');
        expect(error.message).to.equal('User Not Online');
      }
    });

    it('should proceed if user is online', async () => {
      presenceRefStub.once.withArgs('value').resolves({
        exists: () => true
      });
      queueDocRefStub.get.resolves({
        exists: false
      });
      queueDocRefStub.set.resolves();

      const result = await quickMatchHandler(data, context);
      expect(result.success).to.be.true;
    });
  });

  describe('Queue Existence Check', () => {
    const uid = 'test-uid-123';
    const context = { auth: { uid }, app: {} };
    const data = {};

    beforeEach(() => {
      authStub.getUser.withArgs(uid).resolves({
        uid,
        email: 'test@example.com',
        emailVerified: true
      });
      presenceRefStub.once.withArgs('value').resolves({
        exists: () => true
      });
    });

    it('should throw error if user is already waiting in queue', async () => {
      queueDocRefStub.get.resolves({
        exists: true
      });

      try {
        await quickMatchHandler(data, context);
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error).to.be.instanceOf(functions.https.HttpsError);
        expect(error.code).to.equal('already-exists');
        expect(error.message).to.equal('User Already Waiting to be matched');
      }
    });

    it('should proceed if user is not in queue', async () => {
      queueDocRefStub.get.resolves({
        exists: false
      });
      queueDocRefStub.set.resolves();

      const result = await quickMatchHandler(data, context);
      expect(result.success).to.be.true;
    });
  });

  describe('Successful Queue Addition', () => {
    const uid = 'test-uid-123';
    const context = { auth: { uid }, app: {} };
    const data = {};

    beforeEach(() => {
      authStub.getUser.withArgs(uid).resolves({
        uid,
        email: 'test@example.com',
        emailVerified: true
      });
      presenceRefStub.once.withArgs('value').resolves({
        exists: () => true
      });
      queueDocRefStub.get.resolves({
        exists: false
      });
      queueDocRefStub.set.resolves();
    });

    it('should successfully add user to queue', async () => {
      const result = await quickMatchHandler(data, context);

      expect(result.success).to.be.true;
      expect(queueCollectionStub.doc.calledWith(uid)).to.be.true;
      expect(queueDocRefStub.set.calledOnce).to.be.true;
    });

    it('should create document with correct fields', async () => {
      await quickMatchHandler(data, context);

      const setCall = queueDocRefStub.set.getCall(0);
      expect(setCall).to.not.be.null;
      const documentData = setCall.args[0];
      
      expect(documentData.uid).to.equal(uid);
      expect(documentData.status).to.equal('waiting');
      expect(documentData.created_at).to.equal('SERVER_TIMESTAMP');
    });
  });

  describe('Error Handling', () => {
    const uid = 'test-uid-123';
    const context = { auth: { uid }, app: {} };
    const data = {};

    beforeEach(() => {
      authStub.getUser.withArgs(uid).resolves({
        uid,
        email: 'test@example.com',
        emailVerified: true
      });
    });

    it('should handle unexpected errors gracefully', async () => {
      presenceRefStub.once.withArgs('value').rejects(new Error('Database error'));

      try {
        await quickMatchHandler(data, context);
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error).to.be.instanceOf(functions.https.HttpsError);
        expect(error.code).to.equal('internal');
        expect(error.message).to.equal('An unexpected error occurred');
      }
    });

    it('should re-throw HttpsError as-is', async () => {
      presenceRefStub.once.withArgs('value').resolves({
        exists: () => false
      });

      try {
        await quickMatchHandler(data, context);
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error).to.be.instanceOf(functions.https.HttpsError);
        expect(error.code).to.equal('failed-precondition');
        expect(error.message).to.equal('User Not Online');
      }
    });
  });
});
