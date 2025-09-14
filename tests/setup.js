// Test setup file
const config = require('../backend/config');
const logger = require('../backend/logger');

// Set test environment
process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test_db';
process.env.SESSION_SECRET = 'test_session_secret_for_testing_only';
process.env.CLOUDINARY_CLOUD_NAME = 'test_cloud';
process.env.CLOUDINARY_API_KEY = 'test_key';
process.env.CLOUDINARY_API_SECRET = 'test_secret';

// Mock global MOCK_MODE for tests
global.MOCK_MODE = true;

// Increase timeout for async operations
jest.setTimeout(10000);

// Mock logger to reduce noise during testing
jest.mock('../backend/logger', () => ({
  info: jest.fn(),
  debug: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  httpLog: jest.fn((req, res, next) => next()),
  securityLog: jest.fn(),
  performance: jest.fn(),
  dbLog: jest.fn()
}));

// Mock Cloudinary to avoid external calls during testing
jest.mock('../backend/cloudinaryConfig', () => ({
  uploader: {
    upload_stream: jest.fn((options, callback) => {
      // Simulate successful upload
      const mockResult = {
        secure_url: 'https://mock-cloudinary.com/test-image.webp',
        public_id: 'test/mock-image-123',
        bytes: 50000
      };
      setTimeout(() => callback(null, mockResult), 100);
      return {
        end: jest.fn()
      };
    }),
    destroy: jest.fn((publicId, callback) => {
      setTimeout(() => callback(null, { result: 'ok' }), 100);
    })
  }
}));

// Global test utilities
global.testUtils = {
  // Mock request object
  mockReq: (overrides = {}) => ({
    body: {},
    params: {},
    query: {},
    headers: {},
    session: {},
    ip: '127.0.0.1',
    get: jest.fn((header) => {
      const headers = {
        'user-agent': 'test-agent',
        'content-type': 'application/json',
        ...overrides.headers
      };
      return headers[header.toLowerCase()];
    }),
    ...overrides
  }),
  
  // Mock response object
  mockRes: () => {
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
      send: jest.fn().mockReturnThis(),
      set: jest.fn().mockReturnThis(),
      cookie: jest.fn().mockReturnThis(),
      clearCookie: jest.fn().mockReturnThis()
    };
    return res;
  },
  
  // Mock next function
  mockNext: () => jest.fn(),
  
  // Mock file object for multer
  mockFile: (overrides = {}) => ({
    fieldname: 'image',
    originalname: 'test-image.jpg',
    encoding: '7bit',
    mimetype: 'image/jpeg',
    buffer: Buffer.from('mock-image-data'),
    size: 1024,
    ...overrides
  }),
  
  // Wait for async operations
  wait: (ms = 100) => new Promise(resolve => setTimeout(resolve, ms)),
  
  // Create mock admin session
  createAdminSession: () => ({
    isAdmin: true,
    adminId: 1,
    loginTime: new Date().toISOString(),
    id: 'mock-session-id'
  })
};

// Clean up after each test
afterEach(async () => {
  // Clear all mocks
  jest.clearAllMocks();
  
  // Reset global MOCK_MODE
  global.MOCK_MODE = true;
});

// Global error handler for unhandled promise rejections in tests
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  // Don't exit the process during tests
});