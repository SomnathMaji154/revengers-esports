const request = require('supertest');
const express = require('express');
const session = require('express-session');
const { router: authRoutes, isAuthenticated } = require('../backend/auth');
const db = require('../backend/db');

// Create test app
const createTestApp = () => {
  const app = express();
  
  // Setup session middleware for testing
  app.use(session({
    secret: 'test-secret',
    resave: false,
    saveUninitialized: false,
    cookie: { secure: false }
  }));
  
  app.use(express.json());
  app.use('/api', authRoutes);
  
  return app;
};

describe('Authentication', () => {
  let app;
  
  beforeEach(() => {
    app = createTestApp();
    global.MOCK_MODE = true;
  });
  
  afterEach(() => {
    jest.clearAllMocks();
  });
  
  describe('Admin Login', () => {
    test('should reject login with missing credentials', async () => {
      const response = await request(app)
        .post('/api/admin/login')
        .send({});
      
      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
    });
    
    test('should reject login with missing username', async () => {
      const response = await request(app)
        .post('/api/admin/login')
        .send({ password: 'password123' });
      
      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
    });
    
    test('should reject login with missing password', async () => {
      const response = await request(app)
        .post('/api/admin/login')
        .send({ username: 'admin' });
      
      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
    });
    
    test('should reject login with invalid username format', async () => {
      const response = await request(app)
        .post('/api/admin/login')
        .send({ 
          username: 'ad', // Too short
          password: 'password123'
        });
      
      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
    });
    
    test('should reject login with short password', async () => {
      const response = await request(app)
        .post('/api/admin/login')
        .send({ 
          username: 'admin',
          password: '123' // Too short
        });
      
      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
    });
    
    test('should reject login with non-existent user', async () => {
      // Mock db.get to return no user
      jest.spyOn(db, 'get').mockImplementation((query, params, callback) => {
        callback(null, null); // No user found
      });
      
      const response = await request(app)
        .post('/api/admin/login')
        .send({ 
          username: 'nonexistent',
          password: 'password123'
        });
      
      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty('error', 'Invalid credentials');
      expect(response.body).toHaveProperty('code', 'INVALID_CREDENTIALS');
    });
    
    test('should reject login with wrong password in mock mode', async () => {
      // Mock db.get to return a user
      jest.spyOn(db, 'get').mockImplementation((query, params, callback) => {
        callback(null, {
          id: 1,
          username: 'admin',
          password: 'correctpassword'
        });
      });
      
      const response = await request(app)
        .post('/api/admin/login')
        .send({ 
          username: 'admin',
          password: 'wrongpassword'
        });
      
      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty('error', 'Invalid credentials');
    });
    
    test('should accept login with correct credentials in mock mode', async () => {
      // Mock db.get to return a user
      jest.spyOn(db, 'get').mockImplementation((query, params, callback) => {
        callback(null, {
          id: 1,
          username: 'admin',
          password: 'correctpassword'
        });
      });
      
      // Mock db.run for updating last login
      jest.spyOn(db, 'run').mockImplementation((query, params, callback) => {
        callback(null);
      });
      
      const response = await request(app)
        .post('/api/admin/login')
        .send({ 
          username: 'admin',
          password: 'correctpassword'
        });
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('message', 'Logged in successfully');
      expect(response.body).toHaveProperty('admin');
      expect(response.body.admin).toHaveProperty('username', 'admin');
    });
    
    test('should handle database errors gracefully', async () => {
      // Mock db.get to return an error
      jest.spyOn(db, 'get').mockImplementation((query, params, callback) => {
        callback(new Error('Database connection failed'), null);
      });
      
      const response = await request(app)
        .post('/api/admin/login')
        .send({ 
          username: 'admin',
          password: 'password123'
        });
      
      expect(response.status).toBe(500);
      expect(response.body).toHaveProperty('error', 'Authentication service error');
      expect(response.body).toHaveProperty('code', 'AUTH_SERVICE_ERROR');
    });
  });
  
  describe('Admin Logout', () => {
    test('should handle logout when no session exists', async () => {
      // Create app without session middleware
      const appNoSession = express();
      appNoSession.use(express.json());
      appNoSession.use('/api', authRoutes);
      
      const response = await request(appNoSession)
        .post('/api/admin/logout');
      
      expect(response.status).toBe(503);
      expect(response.body).toHaveProperty('error', 'Session service unavailable');
    });
    
    test('should logout successfully', async () => {
      const agent = request.agent(app);
      
      // First login to create a session
      jest.spyOn(db, 'get').mockImplementation((query, params, callback) => {
        callback(null, {
          id: 1,
          username: 'admin',
          password: 'password123'
        });
      });
      
      await agent
        .post('/api/admin/login')
        .send({ 
          username: 'admin',
          password: 'password123'
        });
      
      // Then logout
      const response = await agent
        .post('/api/admin/logout');
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('message', 'Logged out successfully');
      expect(response.body).toHaveProperty('code', 'LOGOUT_SUCCESS');
    });
  });
  
  describe('Admin Status', () => {
    test('should return logged out status by default', async () => {
      const response = await request(app)
        .get('/api/admin/status');
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('loggedIn', false);
    });
    
    test('should return logged in status after login', async () => {
      const agent = request.agent(app);
      
      // Mock successful login
      jest.spyOn(db, 'get').mockImplementation((query, params, callback) => {
        callback(null, {
          id: 1,
          username: 'admin',
          password: 'password123'
        });
      });
      
      // Login first
      await agent
        .post('/api/admin/login')
        .send({ 
          username: 'admin',
          password: 'password123'
        });
      
      // Check status
      const response = await agent
        .get('/api/admin/status');
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('loggedIn', true);
      expect(response.body).toHaveProperty('adminId', 1);
    });
  });
  
  describe('Authentication Middleware', () => {
    test('should reject requests without session', () => {
      const req = testUtils.mockReq();
      const res = testUtils.mockRes();
      const next = testUtils.mockNext();
      
      // No session
      req.session = null;
      
      isAuthenticated(req, res, next);
      
      expect(res.status).toHaveBeenCalledWith(503);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Service temporarily unavailable',
        code: 'SERVICE_UNAVAILABLE'
      });
      expect(next).not.toHaveBeenCalled();
    });
    
    test('should reject requests without admin session', () => {
      const req = testUtils.mockReq();
      const res = testUtils.mockRes();
      const next = testUtils.mockNext();
      
      // Session without admin flag
      req.session = { id: 'test-session' };
      req.session.destroy = jest.fn((callback) => callback());
      
      isAuthenticated(req, res, next);
      
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Unauthorized: Invalid or expired session',
        code: 'SESSION_EXPIRED'
      });
      expect(req.session.destroy).toHaveBeenCalled();
      expect(next).not.toHaveBeenCalled();
    });
    
    test('should allow requests with valid admin session', () => {
      const req = testUtils.mockReq();
      const res = testUtils.mockRes();
      const next = testUtils.mockNext();
      
      // Valid admin session
      req.session = testUtils.createAdminSession();
      
      isAuthenticated(req, res, next);
      
      expect(res.set).toHaveBeenCalledWith({
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      });
      expect(next).toHaveBeenCalled();
    });
  });
});