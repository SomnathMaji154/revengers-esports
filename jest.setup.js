// Jest Setup File
// Configure global test environment and mocks

// Set test environment variables
process.env.NODE_ENV = 'test';
process.env.SESSION_SECRET = 'test-secret-key-for-testing';
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test_db';

// Enable mock mode globally for tests
global.MOCK_MODE = true;

// Mock console methods to reduce noise in tests
const originalConsole = global.console;
global.console = {
  ...originalConsole,
  log: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn()
};

// Custom matchers
expect.extend({
  toBeWithinRange(received, floor, ceiling) {
    const pass = received >= floor && received <= ceiling;
    if (pass) {
      return {
        message: () => `expected ${received} not to be within range ${floor} - ${ceiling}`,
        pass: true
      };
    } else {
      return {
        message: () => `expected ${received} to be within range ${floor} - ${ceiling}`,
        pass: false
      };
    }
  },
  
  toContainObject(received, argument) {
    const pass = this.equals(received, 
      expect.arrayContaining([
        expect.objectContaining(argument)
      ])
    );
    
    if (pass) {
      return {
        message: () => `expected ${this.utils.printReceived(received)} not to contain object ${this.utils.printExpected(argument)}`,
        pass: true
      };
    } else {
      return {
        message: () => `expected ${this.utils.printReceived(received)} to contain object ${this.utils.printExpected(argument)}`,
        pass: false
      };
    }
  }
});

// Global test utilities
global.testUtils = {
  // Helper to create mock request objects
  createMockRequest: (overrides = {}) => ({
    method: 'GET',
    url: '/test',
    path: '/test',
    ip: '127.0.0.1',
    headers: {},
    query: {},
    body: {},
    params: {},
    session: null,
    get: jest.fn((header) => {
      const headers = {
        'user-agent': 'Mozilla/5.0 (Test Browser)',
        'content-type': 'application/json',
        ...overrides.headers
      };
      return headers[header.toLowerCase()];
    }),
    ...overrides
  }),
  
  // Helper to create mock response objects
  createMockResponse: (overrides = {}) => {
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
      send: jest.fn().mockReturnThis(),
      set: jest.fn().mockReturnThis(),
      cookie: jest.fn().mockReturnThis(),
      clearCookie: jest.fn().mockReturnThis(),
      redirect: jest.fn().mockReturnThis(),
      sendFile: jest.fn().mockReturnThis(),
      setHeader: jest.fn(),
      getHeader: jest.fn(),
      headers: {},
      statusCode: 200,
      ...overrides
    };
    
    // Mock setHeader to update headers object
    res.setHeader.mockImplementation((name, value) => {
      res.headers[name.toLowerCase()] = value;
    });
    
    // Mock getHeader to read from headers object
    res.getHeader.mockImplementation((name) => {
      return res.headers[name.toLowerCase()];
    });
    
    return res;
  },
  
  // Helper to create mock files for upload testing
  createMockFile: (overrides = {}) => ({
    fieldname: 'image',
    originalname: 'test.jpg',
    encoding: '7bit',
    mimetype: 'image/jpeg',
    buffer: Buffer.from([0xFF, 0xD8, 0xFF, 0xE0]), // JPEG signature
    size: 1024,
    ...overrides
  }),
  
  // Helper to create mock database responses
  createMockDbResponse: (data = [], error = null) => {
    if (error) {
      return Promise.reject(error);
    }
    return Promise.resolve(data);
  },
  
  // Helper to wait for async operations
  sleep: (ms) => new Promise(resolve => setTimeout(resolve, ms)),
  
  // Helper to generate test data
  generateTestData: {
    player: (overrides = {}) => ({
      id: Math.floor(Math.random() * 1000),
      name: 'Test Player',
      jerseyNumber: Math.floor(Math.random() * 99) + 1,
      stars: Math.floor(Math.random() * 5) + 1,
      imageUrl: 'https://example.com/player.jpg',
      joined_date: new Date().toISOString(),
      ...overrides
    }),
    
    manager: (overrides = {}) => ({
      id: Math.floor(Math.random() * 1000),
      name: 'Test Manager',
      role: 'Coach',
      imageUrl: 'https://example.com/manager.jpg',
      joined_date: new Date().toISOString(),
      ...overrides
    }),
    
    trophy: (overrides = {}) => ({
      id: Math.floor(Math.random() * 1000),
      name: 'Test Championship',
      year: new Date().getFullYear(),
      imageUrl: 'https://example.com/trophy.jpg',
      created_at: new Date().toISOString(),
      ...overrides
    }),
    
    contact: (overrides = {}) => ({
      id: Math.floor(Math.random() * 1000),
      name: 'John Doe',
      email: 'john@example.com',
      whatsapp: '1234567890',
      submission_date: new Date().toISOString(),
      ...overrides
    })
  }
};

// Global test hooks
beforeEach(() => {
  // Clear all timers
  jest.clearAllTimers();
  
  // Reset fetch mock if present
  if (global.fetch && global.fetch.mockClear) {
    global.fetch.mockClear();
  }
});

afterEach(() => {
  // Clean up any test artifacts
  jest.clearAllMocks();
});

// Handle unhandled promise rejections in tests
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  // Don't exit the process in test environment
});

// Increase timeout for slow tests
jest.setTimeout(30000);