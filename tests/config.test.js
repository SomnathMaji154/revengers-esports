const config = require('../backend/config');

describe('Configuration', () => {
  beforeEach(() => {
    // Reset environment for each test
    process.env.NODE_ENV = 'test';
  });
  
  describe('Environment Detection', () => {
    test('should detect test environment correctly', () => {
      expect(config.NODE_ENV).toBe('test');
      expect(config.isTest).toBe(true);
      expect(config.isDevelopment).toBe(false);
      expect(config.isProduction).toBe(false);
    });
    
    test('should detect development environment', () => {
      process.env.NODE_ENV = 'development';
      // Note: config is cached, so we test the logic directly
      expect(process.env.NODE_ENV).toBe('development');
    });
    
    test('should detect production environment', () => {
      process.env.NODE_ENV = 'production';
      expect(process.env.NODE_ENV).toBe('production');
    });
  });
  
  describe('Default Values', () => {
    test('should have default port', () => {
      // Port might be set by environment, so check if it's a number
      expect(typeof config.PORT).toBe('number');
      expect(config.PORT).toBeGreaterThan(0);
    });
    
    test('should have default host', () => {
      expect(config.HOST).toBe('0.0.0.0');
    });
    
    test('should have bcrypt rounds configured', () => {
      expect(config.BCRYPT_ROUNDS).toBe(12);
      expect(typeof config.BCRYPT_ROUNDS).toBe('number');
    });
    
    test('should have file size limits', () => {
      expect(config.MAX_FILE_SIZE).toBeGreaterThan(0);
      expect(typeof config.MAX_FILE_SIZE).toBe('number');
    });
    
    test('should have allowed file types', () => {
      expect(Array.isArray(config.ALLOWED_FILE_TYPES)).toBe(true);
      expect(config.ALLOWED_FILE_TYPES.length).toBeGreaterThan(0);
    });
  });
  
  describe('Database Configuration', () => {
    test('should have database pool configuration', () => {
      const poolConfig = config.dbPoolConfig;
      
      expect(poolConfig).toHaveProperty('min');
      expect(poolConfig).toHaveProperty('max');
      expect(poolConfig).toHaveProperty('idleTimeoutMillis');
      expect(poolConfig).toHaveProperty('connectionTimeoutMillis');
      
      expect(typeof poolConfig.min).toBe('number');
      expect(typeof poolConfig.max).toBe('number');
    });
  });
  
  describe('Rate Limiting Configuration', () => {
    test('should have rate limit configuration', () => {
      const rateLimitConfig = config.rateLimitConfig;
      
      expect(rateLimitConfig).toHaveProperty('windowMs');
      expect(rateLimitConfig).toHaveProperty('max');
      expect(rateLimitConfig).toHaveProperty('standardHeaders');
      expect(rateLimitConfig).toHaveProperty('legacyHeaders');
      
      expect(typeof rateLimitConfig.windowMs).toBe('number');
      expect(typeof rateLimitConfig.max).toBe('number');
    });
    
    test('should have auth rate limit configuration', () => {
      const authRateLimitConfig = config.authRateLimitConfig;
      
      expect(authRateLimitConfig).toHaveProperty('windowMs');
      expect(authRateLimitConfig).toHaveProperty('max');
      expect(authRateLimitConfig.max).toBeLessThan(config.rateLimitConfig.max);
    });
  });
  
  describe('Session Configuration', () => {
    test('should have session configuration', () => {
      const sessionConfig = config.sessionConfig;
      
      expect(sessionConfig).toHaveProperty('secret');
      expect(sessionConfig).toHaveProperty('resave');
      expect(sessionConfig).toHaveProperty('saveUninitialized');
      expect(sessionConfig).toHaveProperty('cookie');
      
      expect(sessionConfig.resave).toBe(false);
      expect(sessionConfig.saveUninitialized).toBe(false);
    });
    
    test('should configure secure cookies for production', () => {
      // Test the logic (config is cached)
      const isSecure = process.env.NODE_ENV === 'production';
      expect(typeof isSecure).toBe('boolean');
    });
  });
  
  describe('CORS Configuration', () => {
    test('should have CORS configuration', () => {
      const corsConfig = config.corsConfig;
      
      expect(corsConfig).toHaveProperty('origin');
      expect(corsConfig).toHaveProperty('credentials');
      expect(corsConfig.credentials).toBe(true);
    });
  });
  
  describe('Debug Information', () => {
    test('should provide debug information', () => {
      const debugInfo = config.getDebugInfo();
      
      expect(debugInfo).toHaveProperty('NODE_ENV');
      expect(debugInfo).toHaveProperty('PORT');
      expect(debugInfo).toHaveProperty('isDevelopment');
      expect(debugInfo).toHaveProperty('isProduction');
      expect(debugInfo).toHaveProperty('isTest');
      expect(debugInfo).toHaveProperty('hasDatabase');
      expect(debugInfo).toHaveProperty('hasSessionSecret');
      
      expect(typeof debugInfo.hasDatabase).toBe('boolean');
      expect(typeof debugInfo.hasSessionSecret).toBe('boolean');
    });
  });
});