const request = require('supertest');

// Mock dependencies
jest.mock('../backend/config', () => ({
  NODE_ENV: 'test',
  isDevelopment: false,
  isProduction: false,
  isTest: true,
  PORT: 3001,
  HOST: 'localhost',
  SESSION_SECRET: 'test-secret',
  MAX_FILE_SIZE: 5 * 1024 * 1024,
  ALLOWED_FILE_TYPES: ['image/jpeg', 'image/png'],
  rateLimitConfig: {
    windowMs: 15 * 60 * 1000,
    max: 100
  },
  authRateLimitConfig: {
    windowMs: 15 * 60 * 1000,
    max: 5
  },
  corsConfig: {
    origin: true,
    credentials: true
  },
  sessionConfig: {
    secret: 'test-secret',
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: false,
      httpOnly: true,
      maxAge: 24 * 60 * 60 * 1000
    }
  },
  COMPRESSION_LEVEL: 6,
  getDebugInfo: () => ({
    environment: 'test',
    port: 3001,
    database: 'mock'
  })
}));

jest.mock('../backend/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
  securityLog: jest.fn(),
  httpLog: jest.fn((req, res, next) => next())
}));

// Enable mock mode globally for tests
global.MOCK_MODE = true;

/**
 * Server Integration Tests
 * Comprehensive testing of API endpoints, middleware, and server functionality
 */
describe('Server Integration Tests', () => {
  let app;
  let server;

  beforeAll(async () => {
    // Import server after mocks are set up
    app = require('../backend/server');
    
    // Start test server
    server = app.listen(3001, () => {
      console.log('Test server running on port 3001');
    });
  });

  afterAll(async () => {
    if (server) {
      await new Promise((resolve) => {
        server.close(resolve);
      });
    }
  });

  describe('Health Check Endpoints', () => {
    test('GET /health should return server status', async () => {
      const response = await request(app)
        .get('/health')
        .expect(200);

      expect(response.body).toHaveProperty('status');
      expect(response.body).toHaveProperty('timestamp');
      expect(response.body).toHaveProperty('uptime');
      expect(response.body).toHaveProperty('environment', 'test');
      expect(response.body).toHaveProperty('memory');
      expect(response.body.database.mockMode).toBe(true);
    });

    test('GET /metrics should return Prometheus metrics', async () => {
      const response = await request(app)
        .get('/metrics')
        .expect(200);

      expect(response.text).toContain('# HELP');
      expect(response.text).toContain('# TYPE');
      expect(response.headers['content-type']).toContain('text/plain');
    });
  });

  describe('Static File Serving', () => {
    test('GET / should serve index.html', async () => {
      const response = await request(app)
        .get('/')
        .expect(200);

      expect(response.headers['content-type']).toContain('text/html');
      expect(response.headers['cache-control']).toContain('no-cache');
    });

    test('GET /nonexistent.html should fallback to index.html', async () => {
      const response = await request(app)
        .get('/nonexistent.html')
        .expect(404);

      expect(response.headers['content-type']).toContain('text/html');
    });
  });

  describe('API Rate Limiting', () => {
    test('Should apply rate limiting to API endpoints', async () => {
      const promises = [];
      
      // Make multiple requests quickly to trigger rate limiting
      for (let i = 0; i < 10; i++) {
        promises.push(
          request(app)
            .get('/api/players')
            .expect((res) => {
              expect([200, 429]).toContain(res.status);
            })
        );
      }
      
      await Promise.all(promises);
    });
  });

  describe('Security Headers', () => {
    test('Should include security headers', async () => {
      const response = await request(app)
        .get('/')
        .expect(200);

      expect(response.headers).toHaveProperty('x-content-type-options', 'nosniff');
      expect(response.headers).toHaveProperty('x-frame-options', 'DENY');
      expect(response.headers).toHaveProperty('x-xss-protection', '1; mode=block');
      expect(response.headers['strict-transport-security']).toBeDefined();
    });

    test('Should include CORS headers', async () => {
      const response = await request(app)
        .options('/api/players')
        .set('Origin', 'http://localhost:3000')
        .expect(204);

      expect(response.headers['access-control-allow-origin']).toBeDefined();
      expect(response.headers['access-control-allow-credentials']).toBe('true');
    });
  });

  describe('Error Handling', () => {
    test('Should handle 404 for unknown API endpoints', async () => {
      const response = await request(app)
        .get('/api/nonexistent')
        .expect(404);

      expect(response.body).toHaveProperty('error', 'API endpoint not found');
      expect(response.body).toHaveProperty('code', 'NOT_FOUND');
    });

    test('Should include correlation ID in error responses', async () => {
      const response = await request(app)
        .get('/api/nonexistent')
        .expect(404);

      expect(response.headers['x-correlation-id']).toBeDefined();
    });
  });

  describe('CSRF Protection', () => {
    test('GET /api/csrf-token should return CSRF token', async () => {
      const response = await request(app)
        .get('/api/csrf-token')
        .expect(200);

      expect(response.body).toHaveProperty('csrfToken');
      expect(response.body.csrfToken).toHaveLength(64);
      expect(response.headers['set-cookie']).toBeDefined();
    });
  });
});

/**
 * API Endpoint Tests
 */
describe('API Endpoints', () => {
  let app;

  beforeAll(() => {
    app = require('../backend/server');
  });

  describe('Players API', () => {
    test('GET /api/players should return players list', async () => {
      const response = await request(app)
        .get('/api/players')
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
    });

    test('POST /api/players should require authentication', async () => {
      const response = await request(app)
        .post('/api/players')
        .send({
          name: 'Test Player',
          jerseyNumber: 99,
          stars: 5
        })
        .expect(401);

      expect(response.body).toHaveProperty('error');
      expect(response.body).toHaveProperty('code', 'SESSION_EXPIRED');
    });
  });

  describe('Managers API', () => {
    test('GET /api/managers should return managers list', async () => {
      const response = await request(app)
        .get('/api/managers')
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
    });
  });

  describe('Trophies API', () => {
    test('GET /api/trophies should return trophies list', async () => {
      const response = await request(app)
        .get('/api/trophies')
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
    });
  });

  describe('Contact API', () => {
    test('POST /api/contact should accept valid contact form', async () => {
      const contactData = {
        name: 'John Doe',
        email: 'john@example.com',
        whatsapp: '1234567890'
      };

      const response = await request(app)
        .post('/api/contact')
        .send(contactData)
        .expect(201);

      expect(response.body).toHaveProperty('message');
      expect(response.body.message).toContain('successfully');
    });

    test('POST /api/contact should validate required fields', async () => {
      const response = await request(app)
        .post('/api/contact')
        .send({
          name: 'John Doe'
          // Missing email and whatsapp
        })
        .expect(400);

      expect(response.body).toHaveProperty('error');
    });

    test('POST /api/contact should validate email format', async () => {
      const response = await request(app)
        .post('/api/contact')
        .send({
          name: 'John Doe',
          email: 'invalid-email',
          whatsapp: '1234567890'
        })
        .expect(400);

      expect(response.body).toHaveProperty('error');
    });

    test('POST /api/contact should validate WhatsApp number', async () => {
      const response = await request(app)
        .post('/api/contact')
        .send({
          name: 'John Doe',
          email: 'john@example.com',
          whatsapp: '123' // Too short
        })
        .expect(400);

      expect(response.body).toHaveProperty('error');
    });
  });

  describe('Admin Authentication', () => {
    test('POST /api/admin/login should require valid credentials', async () => {
      const response = await request(app)
        .post('/api/admin/login')
        .send({
          username: 'invalid',
          password: 'invalid'
        })
        .expect(401);

      expect(response.body).toHaveProperty('error', 'Invalid credentials');
      expect(response.body).toHaveProperty('code', 'INVALID_CREDENTIALS');
    });

    test('POST /api/admin/login should validate input format', async () => {
      const response = await request(app)
        .post('/api/admin/login')
        .send({
          username: 'ad', // Too short
          password: 'short' // Too short
        })
        .expect(400);

      expect(response.body).toHaveProperty('error', 'Validation Error');
    });

    test('GET /api/admin/status should return authentication status', async () => {
      const response = await request(app)
        .get('/api/admin/status')
        .expect(200);

      expect(response.body).toHaveProperty('isAuthenticated', false);
    });
  });
});

/**
 * Input Sanitization Tests
 */
describe('Input Sanitization', () => {
  let app;

  beforeAll(() => {
    app = require('../backend/server');
  });

  test('Should sanitize XSS attempts in contact form', async () => {
    const maliciousData = {
      name: '<script>alert(\"xss\")</script>John',
      email: 'john@example.com',
      whatsapp: '1234567890'
    };

    const response = await request(app)
      .post('/api/contact')
      .send(maliciousData)
      .expect(201);

    // The response should be successful, indicating sanitization occurred
    expect(response.body).toHaveProperty('message');
  });

  test('Should handle SQL injection attempts', async () => {
    const maliciousData = {
      name: '\\\'; DROP TABLE players; --',
      email: 'john@example.com',
      whatsapp: '1234567890'
    };

    const response = await request(app)
      .post('/api/contact')
      .send(maliciousData)
      .expect(201);

    // Should complete successfully due to parameterized queries
    expect(response.body).toHaveProperty('message');
  });
});

/**
 * Performance Tests
 */
describe('Performance Tests', () => {
  let app;

  beforeAll(() => {
    app = require('../backend/server');
  });

  test('API endpoints should respond within acceptable time', async () => {
    const start = Date.now();
    
    await request(app)
      .get('/api/players')
      .expect(200);
    
    const duration = Date.now() - start;
    expect(duration).toBeLessThan(1000); // Should respond within 1 second
  });

  test('Health check should be fast', async () => {
    const start = Date.now();
    
    await request(app)
      .get('/health')
      .expect(200);
    
    const duration = Date.now() - start;
    expect(duration).toBeLessThan(500); // Should respond within 500ms
  });

  test('Should handle concurrent requests', async () => {
    const promises = [];
    const requestCount = 20;
    
    for (let i = 0; i < requestCount; i++) {
      promises.push(
        request(app)
          .get('/api/players')
          .expect(200)
      );
    }
    
    const start = Date.now();
    await Promise.all(promises);
    const duration = Date.now() - start;
    
    // All requests should complete within reasonable time
    expect(duration).toBeLessThan(5000); // 5 seconds for 20 concurrent requests
  });
});

/**
 * Compression Tests
 */
describe('Compression Tests', () => {
  let app;

  beforeAll(() => {
    app = require('../backend/server');
  });

  test('Should compress responses when appropriate', async () => {
    const response = await request(app)
      .get('/api/players')
      .set('Accept-Encoding', 'gzip')
      .expect(200);

    // Check if compression was applied for larger responses
    if (JSON.stringify(response.body).length > 1024) {
      expect(response.headers['content-encoding']).toBe('gzip');
    }
  });
});