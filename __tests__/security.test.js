// Mock external dependencies
jest.mock('../backend/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
  securityLog: jest.fn()
}));

jest.mock('../backend/config', () => ({
  NODE_ENV: 'test',
  isDevelopment: false,
  isTest: true,
  MAX_FILE_SIZE: 5 * 1024 * 1024,
  ALLOWED_FILE_TYPES: ['image/jpeg', 'image/png']
}));

/**
 * Security Manager Unit Tests
 */
describe('Security Manager', () => {
  let security;

  beforeEach(() => {
    // Reset modules for each test
    jest.resetModules();
    security = require('../backend/security');
  });

  describe('String Sanitization', () => {
    test('should remove HTML tags from strings', () => {
      const input = '<script>alert(\"xss\")</script>Hello World';
      const result = security.sanitizeString(input);
      
      expect(result).not.toContain('<script>');
      expect(result).not.toContain('</script>');
      expect(result).toContain('Hello World');
    });

    test('should handle null and undefined inputs', () => {
      expect(security.sanitizeString(null)).toBeNull();
      expect(security.sanitizeString(undefined)).toBeUndefined();
      expect(security.sanitizeString('')).toBe('');
    });

    test('should remove dangerous Unicode characters', () => {
      const input = 'Hello\\x00World\\x1FTest';
      const result = security.sanitizeString(input);
      
      expect(result).toBe('HelloWorldTest');
    });

    test('should normalize Unicode characters', () => {
      const input = 'café'; // Contains combining characters
      const result = security.sanitizeString(input);
      
      expect(result).toBe('café');
    });
  });

  describe('Object Sanitization', () => {
    test('should sanitize nested objects recursively', () => {
      const input = {
        name: '<script>alert(\"xss\")</script>John',
        contact: {
          email: 'john@example.com',
          notes: '<iframe src=\"evil.com\"></iframe>Notes'
        },
        tags: ['<script>tag1</script>', 'tag2']
      };
      
      const result = security.sanitizeObject(input);
      
      expect(result.name).not.toContain('<script>');
      expect(result.contact.notes).not.toContain('<iframe>');
      expect(result.tags[0]).not.toContain('<script>');
      expect(result.tags[1]).toBe('tag2');
    });

    test('should prevent prototype pollution', () => {
      const input = {
        '__proto__': { isAdmin: true },
        'constructor': { isAdmin: true },
        'normalProp': 'value'
      };
      
      const result = security.sanitizeObject(input);
      
      expect(result).not.toHaveProperty('__proto__');
      expect(result).not.toHaveProperty('constructor');
      expect(result).toHaveProperty('normalProp', 'value');
    });
  });

  describe('Email Sanitization', () => {
    test('should validate and normalize email addresses', () => {
      expect(security.sanitizeEmail('John@Example.COM')).toBe('john@example.com');
      expect(security.sanitizeEmail('valid@test.com')).toBe('valid@test.com');
    });

    test('should reject invalid email formats', () => {
      expect(security.sanitizeEmail('invalid-email')).toBeNull();
      expect(security.sanitizeEmail('user@')).toBeNull();
      expect(security.sanitizeEmail('@domain.com')).toBeNull();
      expect(security.sanitizeEmail('')).toBeNull();
    });

    test('should reject emails with suspicious patterns', () => {
      expect(security.sanitizeEmail('user..double@test.com')).toBeNull();
      expect(security.sanitizeEmail('user++plus@test.com')).toBeNull();
    });
  });

  describe('Phone Number Sanitization', () => {
    test('should clean and validate phone numbers', () => {
      expect(security.sanitizePhone('+1 (555) 123-4567')).toBe('+15551234567');
      expect(security.sanitizePhone('555-123-4567')).toBe('5551234567');
      expect(security.sanitizePhone('5551234567')).toBe('5551234567');
    });

    test('should reject invalid phone numbers', () => {
      expect(security.sanitizePhone('123')).toBeNull(); // Too short
      expect(security.sanitizePhone('12345678901234567890')).toBeNull(); // Too long
      expect(security.sanitizePhone('abc-def-ghij')).toBeNull(); // Non-numeric
    });

    test('should handle edge cases', () => {
      expect(security.sanitizePhone('')).toBeNull();
      expect(security.sanitizePhone(null)).toBeNull();
      expect(security.sanitizePhone(undefined)).toBeNull();
    });
  });

  describe('File Upload Validation', () => {
    test('should validate file types and sizes', () => {
      const validFile = {
        buffer: Buffer.from([0xFF, 0xD8, 0xFF, 0xE0]), // JPEG signature
        size: 1024 * 1024, // 1MB
        mimetype: 'image/jpeg',
        originalname: 'test.jpg'
      };
      
      const result = security.validateFileUpload(validFile);
      
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    test('should reject files that are too large', () => {
      const largeFile = {
        buffer: Buffer.from([0xFF, 0xD8, 0xFF, 0xE0]),
        size: 10 * 1024 * 1024, // 10MB (larger than 5MB limit)
        mimetype: 'image/jpeg',
        originalname: 'large.jpg'
      };
      
      const result = security.validateFileUpload(largeFile);
      
      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual(expect.stringContaining('too large'));
    });

    test('should reject invalid file types', () => {
      const invalidFile = {
        buffer: Buffer.from([0x50, 0x4B, 0x03, 0x04]), // ZIP signature
        size: 1024,
        mimetype: 'application/zip',
        originalname: 'test.zip'
      };
      
      const result = security.validateFileUpload(invalidFile);
      
      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual(expect.stringContaining('Invalid file type'));
    });

    test('should reject files with suspicious filenames', () => {
      const suspiciousFile = {
        buffer: Buffer.from([0xFF, 0xD8, 0xFF, 0xE0]),
        size: 1024,
        mimetype: 'image/jpeg',
        originalname: '../../../etc/passwd'
      };
      
      const result = security.validateFileUpload(suspiciousFile);
      
      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual(expect.stringContaining('invalid characters'));
    });

    test('should detect mismatched file signatures', () => {
      const mismatchedFile = {
        buffer: Buffer.from([0x50, 0x4B, 0x03, 0x04]), // ZIP signature
        size: 1024,
        mimetype: 'image/jpeg', // Claims to be JPEG
        originalname: 'fake.jpg'
      };
      
      const result = security.validateFileUpload(mismatchedFile);
      
      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual(expect.stringContaining('signature'));
    });
  });

  describe('Filename Sanitization', () => {
    test('should sanitize unsafe filename characters', () => {
      expect(security.sanitizeFilename('file<>:\"/\\|?*.txt')).toBe('file_________.txt');
      expect(security.sanitizeFilename('../../../etc/passwd')).toBe('___etc_passwd');
    });

    test('should handle edge cases', () => {
      expect(security.sanitizeFilename('')).toBe('unnamed');
      expect(security.sanitizeFilename(null)).toBe('unnamed');
      expect(security.sanitizeFilename('...')).toBe('unnamed');
    });

    test('should limit filename length', () => {
      const longFilename = 'a'.repeat(200) + '.txt';
      const result = security.sanitizeFilename(longFilename);
      
      expect(result.length).toBeLessThanOrEqual(100);
      expect(result).toMatch(/\\.txt$/);
    });
  });

  describe('Rate Limit Key Generation', () => {
    test('should generate consistent keys for same request', () => {
      const req = {
        ip: '192.168.1.1',
        connection: { remoteAddress: '192.168.1.1' },
        get: jest.fn().mockReturnValue('Mozilla/5.0'),
        path: '/api/test'
      };
      
      const key1 = security.generateRateLimitKey(req);
      const key2 = security.generateRateLimitKey(req);
      
      expect(key1).toBe(key2);
    });

    test('should include user agent when requested', () => {
      const req = {
        ip: '192.168.1.1',
        get: jest.fn().mockReturnValue('Mozilla/5.0')
      };
      
      const keyWithUA = security.generateRateLimitKey(req, { includeUserAgent: true });
      const keyWithoutUA = security.generateRateLimitKey(req, { includeUserAgent: false });
      
      expect(keyWithUA).not.toBe(keyWithoutUA);
    });
  });

  describe('Suspicious Request Detection', () => {
    test('should detect SQL injection patterns', () => {
      const req = {
        query: { search: '\\\'; DROP TABLE users; --' },
        body: {},
        params: {},
        headers: {}
      };
      
      const indicators = security.detectSuspiciousRequest(req);
      
      expect(indicators).toContain('sql_injection');
    });

    test('should detect XSS patterns', () => {
      const req = {
        query: {},
        body: { comment: '<script>alert("xss")</script>' },
        params: {},
        headers: {}
      };
      
      const indicators = security.detectSuspiciousRequest(req);
      
      expect(indicators).toContain('xss_attempt');
    });

    test('should detect path traversal attempts', () => {
      const req = {
        query: { file: '../../../etc/passwd' },
        body: {},
        params: {},
        headers: {}
      };
      
      const indicators = security.detectSuspiciousRequest(req);
      
      expect(indicators).toContain('path_traversal');
    });

    test('should detect suspicious user agents', () => {
      const req = {
        query: {},
        body: {},
        params: {},
        headers: {},
        get: jest.fn().mockReturnValue('curl/7.68.0')
      };
      
      const indicators = security.detectSuspiciousRequest(req);
      
      expect(indicators).toContain('suspicious_user_agent');
    });
  });

  describe('Secure Token Generation', () => {
    test('should generate tokens of correct length', () => {
      const token = security.generateSecureToken(32);
      
      expect(token).toHaveLength(64); // 32 bytes = 64 hex characters
      expect(token).toMatch(/^[a-f0-9]+$/);
    });

    test('should generate unique tokens', () => {
      const token1 = security.generateSecureToken();
      const token2 = security.generateSecureToken();
      
      expect(token1).not.toBe(token2);
    });
  });

  describe('Data Hashing', () => {
    test('should hash data with salt', () => {
      const data = 'sensitive-data';
      const result = security.hashSensitiveData(data);
      
      expect(result).toHaveProperty('hash');
      expect(result).toHaveProperty('salt');
      expect(result.hash).toHaveLength(128); // 64 bytes = 128 hex characters
      expect(result.salt).toHaveLength(32); // 16 bytes = 32 hex characters
    });

    test('should produce consistent hashes with same salt', () => {
      const data = 'test-data';
      const salt = 'fixed-salt-for-testing';
      
      const result1 = security.hashSensitiveData(data, salt);
      const result2 = security.hashSensitiveData(data, salt);
      
      expect(result1.hash).toBe(result2.hash);
    });
  });
});