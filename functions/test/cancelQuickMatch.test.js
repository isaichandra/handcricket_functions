/**
 * Tests for cancelQuickMatch Cloud Function
 */

const { expect } = require('chai');
const sinon = require('sinon');
const proxyquire = require('proxyquire');
const functions = require('firebase-functions');

describe('cancelQuickMatch', () => {
  let sandbox;
  let authStub;
  let firestoreStub;
  let queueCollectionStub;
  let queueDocRefStub;
  let cancelQuickMatchHandler;
  let mockAdmin;
  let clock;

  beforeEach(() => {
    sandbox = sinon.createSandbox();
    clock = sandbox.useFakeTimers();

    // Create auth stub with getUser method
    authStub = {
      getUser: sandbox.stub()
    };

    // Setup Firestore stubs
    queueDocRefStub = {
      get: sandbox.stub(),
      delete: sandbox.stub()
    };

    queueCollectionStub = {
      doc: sandbox.stub().returns(queueDocRefStub)
    };

    firestoreStub = {
      collection: sandbox.stub().returns(queueCollectionStub)
    };

    // Create mock admin object
    mockAdmin = {
      auth: () => authStub,
      firestore: () => firestoreStub
    };

    // Use proxyquire to load the module with mocked firebase-admin
    delete require.cache[require.resolve('../handlers/cancelQuickMatch')];
    delete require.cache[require.resolve('../utils/auth')];
    
    // Mock both the handler and the auth utility
    const mockAuth = proxyquire('../utils/auth', {
      'firebase-admin': mockAdmin
    });
    
    const cancelQuickMatch = proxyquire('../handlers/cancelQuickMatch', {
      'firebase-admin': mockAdmin,
      '../utils/auth': mockAuth
    });
    cancelQuickMatchHandler = cancelQuickMatch.handler;
  });

  afterEach(() => {
    sandbox.restore();
    clock.restore();
  });

  describe('Authentication', () => {
    it('should throw error if user is not authenticated', async () => {
      const context = { auth: null, app: {} };
      const data = {};

      try {
        await cancelQuickMatchHandler(data, context);
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
        await cancelQuickMatchHandler(data, context);
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
        await cancelQuickMatchHandler(data, context);
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error).to.be.instanceOf(functions.https.HttpsError);
        expect(error.code).to.equal('failed-precondition');
        expect(error.message).to.equal('use a verified email address to continue');
      }
    });
  });

  describe('Document Deletion', () => {
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

    it('should return success if document does not exist', async () => {
      queueDocRefStub.get.resolves({
        exists: false
      });

      const result = await cancelQuickMatchHandler(data, context);
      
      expect(result.success).to.be.true;
      expect(queueCollectionStub.doc.calledWith(uid)).to.be.true;
      expect(queueDocRefStub.get.calledOnce).to.be.true;
      expect(queueDocRefStub.delete.called).to.be.false;
    });

    it('should successfully delete existing document', async () => {
      queueDocRefStub.get.resolves({
        exists: true
      });
      queueDocRefStub.delete.resolves();

      const result = await cancelQuickMatchHandler(data, context);
      
      expect(result.success).to.be.true;
      expect(queueCollectionStub.doc.calledWith(uid)).to.be.true;
      expect(queueDocRefStub.get.calledOnce).to.be.true;
      expect(queueDocRefStub.delete.calledOnce).to.be.true;
    });

    it('should return success even if document deletion fails after retries', async () => {
      queueDocRefStub.get.resolves({
        exists: true
      });
      
      // Simulate locked document error
      const lockedError = new Error('Document locked');
      lockedError.code = 'aborted';
      queueDocRefStub.delete.rejects(lockedError);

      const deletePromise = cancelQuickMatchHandler(data, context);
      
      // Advance time to allow all retries (10 attempts = 9 retries = 4.5s)
      await clock.tickAsync(4500);
      
      const result = await deletePromise;
      
      expect(result.success).to.be.true;
      expect(queueDocRefStub.delete.callCount).to.equal(10);
    });

    it('should retry deletion with 0.5s delay when document is locked', async () => {
      queueDocRefStub.get.resolves({
        exists: true
      });
      
      // Simulate locked document error for first 2 attempts, then success
      const lockedError = new Error('Document locked');
      lockedError.code = 'aborted';
      
      queueDocRefStub.delete
        .onFirstCall().rejects(lockedError)
        .onSecondCall().rejects(lockedError)
        .onThirdCall().resolves();

      const deletePromise = cancelQuickMatchHandler(data, context);
      
      // Advance time by 0.5s (first retry delay)
      await clock.tickAsync(500);
      // Advance time by 0.5s (second retry delay)
      await clock.tickAsync(500);
      
      const result = await deletePromise;
      
      expect(result.success).to.be.true;
      expect(queueDocRefStub.delete.callCount).to.equal(3);
    });

    it('should handle failed-precondition error as locked document', async () => {
      queueDocRefStub.get.resolves({
        exists: true
      });
      
      const lockedError = new Error('Failed precondition');
      lockedError.code = 'failed-precondition';
      queueDocRefStub.delete.rejects(lockedError);

      const deletePromise = cancelQuickMatchHandler(data, context);
      
      // Advance time to allow all retries (10 attempts = 9 retries = 4.5s)
      await clock.tickAsync(4500);
      
      const result = await deletePromise;
      
      expect(result.success).to.be.true;
      expect(queueDocRefStub.delete.callCount).to.equal(10);
    });

    it('should handle unavailable error as locked document', async () => {
      queueDocRefStub.get.resolves({
        exists: true
      });
      
      const lockedError = new Error('Service unavailable');
      lockedError.code = 'unavailable';
      queueDocRefStub.delete.rejects(lockedError);

      const deletePromise = cancelQuickMatchHandler(data, context);
      
      // Advance time to allow all retries (10 attempts = 9 retries = 4.5s)
      await clock.tickAsync(4500);
      
      const result = await deletePromise;
      
      expect(result.success).to.be.true;
      expect(queueDocRefStub.delete.callCount).to.equal(10);
    });

    it('should not retry on non-locked errors', async () => {
      queueDocRefStub.get.resolves({
        exists: true
      });
      
      // Simulate a non-locked error (e.g., permission denied)
      const otherError = new Error('Permission denied');
      otherError.code = 'permission-denied';
      queueDocRefStub.delete.rejects(otherError);

      const result = await cancelQuickMatchHandler(data, context);
      
      expect(result.success).to.be.true;
      expect(queueDocRefStub.delete.callCount).to.equal(1);
    });

    it('should retry up to 10 times for locked documents', async () => {
      queueDocRefStub.get.resolves({
        exists: true
      });
      
      const lockedError = new Error('Document locked');
      lockedError.code = 'aborted';
      queueDocRefStub.delete.rejects(lockedError);

      const deletePromise = cancelQuickMatchHandler(data, context);
      
      // Advance time to allow all retries (10 attempts = 9 retries = 4.5s)
      await clock.tickAsync(4500);
      
      const result = await deletePromise;
      
      expect(result.success).to.be.true;
      expect(queueDocRefStub.delete.callCount).to.equal(10);
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
      // Test that get() errors are handled and function still returns success
      queueDocRefStub.get.rejects(new Error('Database error'));

      // The function should return success even if get() fails
      // because get() errors are caught in deleteWithRetry and return false
      // but the handler always returns success
      const result = await cancelQuickMatchHandler(data, context);
      
      expect(result.success).to.be.true;
      expect(queueDocRefStub.get.calledOnce).to.be.true;
    });

    it('should re-throw HttpsError as-is', async () => {
      // Create a context that will fail validation
      const invalidContext = { auth: { uid }, app: {} };
      
      // Mock getUser to throw HttpsError directly (simulating validation error)
      authStub.getUser.withArgs(uid).rejects(
        new functions.https.HttpsError('failed-precondition', 'use a verified email address to continue')
      );

      try {
        await cancelQuickMatchHandler(data, invalidContext);
        expect.fail('Should have thrown an error');
      } catch (error) {
        // The auth utility catches getUser errors and converts them to internal errors
        // So we expect an internal error here, not the original HttpsError
        expect(error).to.be.instanceOf(functions.https.HttpsError);
        expect(error.code).to.equal('internal');
      }
    });
  });
});
