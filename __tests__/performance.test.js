// Mock external dependencies
jest.mock('../backend/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn()
}));

jest.mock('../backend/config', () => ({
  NODE_ENV: 'test',
  isDevelopment: false,
  isTest: true,
  getDebugInfo: () => ({
    environment: 'test',
    database: 'mock'
  })
}));

// Mock database module
jest.mock('../backend/db', () => ({
  all: jest.fn(),
  run: jest.fn(),
  get: jest.fn(),
  pool: {
    query: jest.fn()
  }
}));

/**
 * Performance Manager Unit Tests
 */
describe('Performance Manager', () => {
  let performance;
  let mockDb;

  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    
    mockDb = require('../backend/db');
    performance = require('../backend/performance');
  });

  describe('Query Execution', () => {
    test('should execute queries and track performance', async () => {
      const mockResult = [{ id: 1, name: 'Test' }];
      mockDb.all.mockImplementation((query, params, callback) => {
        setTimeout(() => callback(null, mockResult), 10);
      });

      const result = await performance.executeQuery(
        'SELECT * FROM players',
        [],
        { cache: false }
      );

      expect(result).toEqual(mockResult);
      expect(mockDb.all).toHaveBeenCalledWith(
        'SELECT * FROM players',
        [],
        expect.any(Function)
      );
    });

    test('should cache query results when enabled', async () => {
      const mockResult = [{ id: 1, name: 'Test' }];
      mockDb.all.mockImplementation((query, params, callback) => {
        callback(null, mockResult);
      });

      // First call
      const result1 = await performance.executeQuery(
        'SELECT * FROM players',
        [],
        { cache: true, cacheTtl: 1000 }
      );

      // Second call should use cache
      const result2 = await performance.executeQuery(
        'SELECT * FROM players',
        [],
        { cache: true }
      );

      expect(result1).toEqual(mockResult);
      expect(result2).toEqual(mockResult);
      expect(mockDb.all).toHaveBeenCalledTimes(1); // Only called once due to caching
    });

    test('should handle query errors gracefully', async () => {
      const mockError = new Error('Database connection failed');
      mockDb.all.mockImplementation((query, params, callback) => {
        callback(mockError);
      });

      await expect(performance.executeQuery('SELECT * FROM invalid')).rejects.toThrow(
        'Database connection failed'
      );
    });

    test('should track slow queries', async () => {
      const mockResult = [{ id: 1 }];
      mockDb.all.mockImplementation((query, params, callback) => {
        // Simulate slow query
        setTimeout(() => callback(null, mockResult), 1100);
      });

      const result = await performance.executeQuery('SELECT * FROM slow_table');
      
      expect(result).toEqual(mockResult);
      // Check that slow query was logged (would need to spy on logger)
    });
  });

  describe('Cache Management', () => {
    test('should generate consistent cache keys', () => {
      const query = 'SELECT * FROM users WHERE id = ?';
      const params = [123];
      
      const key1 = performance.generateQueryHash(query, params);
      const key2 = performance.generateQueryHash(query, params);
      
      expect(key1).toBe(key2);
      expect(key1).toHaveLength(16); // MD5 hash truncated to 16 chars
    });

    test('should generate different keys for different queries', () => {
      const key1 = performance.generateQueryHash('SELECT * FROM users', []);
      const key2 = performance.generateQueryHash('SELECT * FROM players', []);
      
      expect(key1).not.toBe(key2);
    });
  });

  describe('Optimized Queries', () => {
    test('should provide optimized query for players', () => {
      const queryConfig = performance.getOptimizedQueries().getPlayers(10, 0);
      
      expect(queryConfig).toHaveProperty('query');
      expect(queryConfig).toHaveProperty('params', [10, 0]);
      expect(queryConfig).toHaveProperty('cache', true);
      expect(queryConfig.query).toContain('SELECT');
      expect(queryConfig.query).toContain('players');
      expect(queryConfig.query).toContain('LIMIT');
    });

    test('should provide search query with full-text search', () => {
      const queryConfig = performance.getOptimizedQueries().searchPlayers('john');
      
      expect(queryConfig).toHaveProperty('query');
      expect(queryConfig).toHaveProperty('params', ['john']);
      expect(queryConfig.query).toContain('search_vector');
      expect(queryConfig.query).toContain('plainto_tsquery');
    });

    test('should provide contact submissions query without caching', () => {
      const queryConfig = performance.getOptimizedQueries().getContactSubmissions(50, 0);
      
      expect(queryConfig).toHaveProperty('cache', false);
      expect(queryConfig.query).toContain('contact_submissions');
    });
  });

  describe('Performance Monitoring', () => {
    test('should track query metrics', () => {
      // Simulate some queries
      performance.updateQueryMetrics(100);
      performance.updateQueryMetrics(200);
      performance.updateQueryMetrics(150);

      const report = performance.getPerformanceReport();
      
      expect(report.database.totalQueries).toBe(3);
      expect(report.database.averageQueryTime).toBe(150);
    });

    test('should calculate cache hit rate', () => {
      // Simulate cache hits and misses
      performance.cacheHitStats.hits = 7;
      performance.cacheHitStats.misses = 3;
      
      performance.updateQueryMetrics(100);

      const report = performance.getPerformanceReport();
      
      expect(report.cache.hitRate).toBe(70); // 7/10 = 70%
    });

    test('should provide performance recommendations', () => {
      // Simulate high memory usage
      const originalMemUsage = process.memoryUsage;
      process.memoryUsage = () => ({
        heapUsed: 600 * 1024 * 1024, // 600MB
        heapTotal: 800 * 1024 * 1024,
        rss: 900 * 1024 * 1024,
        external: 50 * 1024 * 1024
      });

      const recommendations = performance.getPerformanceRecommendations();
      
      expect(recommendations).toContainEqual(
        expect.stringContaining('High memory usage')
      );

      // Restore original function
      process.memoryUsage = originalMemUsage;
    });
  });

  describe('Memory Optimization', () => {
    test('should clear cache when size limit exceeded', () => {
      // Simulate large cache
      for (let i = 0; i < 1001; i++) {
        performance.queryCache.set(`key${i}`, { data: 'test' });
      }

      performance.optimizeMemory();

      expect(performance.queryCache.size).toBe(0);
    });

    test('should perform garbage collection when available', () => {
      const originalGc = global.gc;
      global.gc = jest.fn();

      // Mock high memory usage
      const originalMemUsage = process.memoryUsage;
      process.memoryUsage = () => ({
        heapUsed: 250 * 1024 * 1024, // 250MB (above 200MB threshold)
        heapTotal: 300 * 1024 * 1024,
        rss: 400 * 1024 * 1024,
        external: 20 * 1024 * 1024
      });

      performance.optimizeMemory();

      expect(global.gc).toHaveBeenCalled();

      // Restore original functions
      global.gc = originalGc;
      process.memoryUsage = originalMemUsage;
    });
  });

  describe('Database Optimization', () => {
    beforeEach(() => {
      mockDb.pool.query.mockResolvedValue({ rows: [{ success: true }] });
    });

    test('should create database indexes', async () => {
      const optimizations = await performance.optimizeDatabase();

      expect(optimizations).toContain('✓ INDEX idx_players_jersey_unique');
      expect(optimizations).toContain('✓ INDEX idx_players_joined_date');
      expect(mockDb.pool.query).toHaveBeenCalledWith(
        expect.stringContaining('CREATE INDEX'),
        []
      );
    });

    test('should update database statistics', async () => {
      await performance.optimizeDatabase();

      expect(mockDb.pool.query).toHaveBeenCalledWith(
        'ANALYZE players, managers, trophies, contact_submissions',
        []
      );
    });

    test('should handle database optimization errors gracefully', async () => {
      mockDb.pool.query.mockRejectedValue(new Error('Permission denied'));

      await expect(performance.optimizeDatabase()).rejects.toThrow('Permission denied');
    });
  });

  describe('Maintenance Operations', () => {
    test('should reset metrics when threshold reached', () => {
      // Set metrics above threshold
      performance.performanceMetrics.requests = 10001;
      performance.performanceMetrics.averageResponseTime = 500;

      performance.performMaintenance();

      expect(performance.performanceMetrics.requests).toBe(0);
      expect(performance.performanceMetrics.averageResponseTime).toBe(0);
    });

    test('should not reset metrics when below threshold', () => {
      performance.performanceMetrics.requests = 100;
      performance.performanceMetrics.averageResponseTime = 200;

      performance.performMaintenance();

      expect(performance.performanceMetrics.requests).toBe(100);
      expect(performance.performanceMetrics.averageResponseTime).toBe(200);
    });
  });
});

/**
 * Error Tracker Unit Tests
 */
describe('Error Tracker', () => {
  let errorTracker;

  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    errorTracker = require('../backend/errorTracker');
  });

  describe('Error Creation', () => {
    test('should create error with metadata', () => {
      const error = errorTracker.createError(
        'Test error message',
        errorTracker.errorCategories.VALIDATION,
        { field: 'email' }
      );

      expect(error.message).toBe('Test error message');
      expect(error.category).toBe('validation');
      expect(error.context).toEqual({ field: 'email' });
      expect(error.timestamp).toBeDefined();
      expect(error.correlationId).toBeDefined();
    });

    test('should use default category when not specified', () => {
      const error = errorTracker.createError('Test error');

      expect(error.category).toBe('system');
    });
  });

  describe('Error Tracking', () => {
    test('should track error with request context', () => {
      const mockRequest = {
        method: 'POST',
        url: '/api/test',
        ip: '192.168.1.1',
        get: jest.fn().mockReturnValue('Mozilla/5.0'),
        session: { id: 'session123', userId: 'user456' }
      };

      const error = new Error('Test tracking error');
      error.category = errorTracker.errorCategories.DATABASE;

      const context = errorTracker.trackError(error, mockRequest, { extra: 'data' });

      expect(context.category).toBe('database');
      expect(context.request.method).toBe('POST');
      expect(context.request.ip).toBe('192.168.1.1');
      expect(context.request.userId).toBe('user456');
      expect(context.extra).toBe('data');
    });

    test('should track error without request context', () => {
      const error = new Error('Test error without request');
      
      const context = errorTracker.trackError(error);

      expect(context.category).toBe('system');
      expect(context.request).toBeUndefined();
      expect(context.system).toBeDefined();
    });

    test('should increment error count for same fingerprint', () => {
      const error1 = new Error('Duplicate error');
      const error2 = new Error('Duplicate error');

      errorTracker.trackError(error1);
      const context = errorTracker.trackError(error2);

      expect(context.occurrenceCount).toBe(2);
    });
  });

  describe('Error Fingerprinting', () => {
    test('should generate consistent fingerprints', () => {
      const error1 = new Error('Same error message');
      error1.stack = 'Error: Same error message\n    at test.js:1:1';
      
      const error2 = new Error('Same error message');
      error2.stack = 'Error: Same error message\n    at test.js:1:1';

      const fingerprint1 = errorTracker.generateErrorFingerprint(error1);
      const fingerprint2 = errorTracker.generateErrorFingerprint(error2);

      expect(fingerprint1).toBe(fingerprint2);
      expect(fingerprint1).toHaveLength(16);
    });

    test('should generate different fingerprints for different errors', () => {
      const error1 = new Error('First error');
      const error2 = new Error('Second error');

      const fingerprint1 = errorTracker.generateErrorFingerprint(error1);
      const fingerprint2 = errorTracker.generateErrorFingerprint(error2);

      expect(fingerprint1).not.toBe(fingerprint2);
    });
  });

  describe('Error Categories', () => {
    test('should determine correct log level for categories', () => {
      expect(errorTracker.getErrorLogLevel('security')).toBe('error');
      expect(errorTracker.getErrorLogLevel('database')).toBe('error');
      expect(errorTracker.getErrorLogLevel('validation')).toBe('warn');
      expect(errorTracker.getErrorLogLevel('network')).toBe('info');
    });
  });

  describe('Critical Pattern Detection', () => {
    test('should detect high frequency errors', () => {
      const error = new Error('Frequent error');
      const fingerprint = errorTracker.generateErrorFingerprint(error);
      
      // Simulate 10 occurrences
      errorTracker.checkCriticalPatterns(fingerprint, 10, error);
      
      // Should log high frequency alert (mocked logger would be called)
    });

    test('should detect security-related errors', () => {
      const error = new Error('Security breach detected');
      error.category = errorTracker.errorCategories.SECURITY;
      
      const fingerprint = errorTracker.generateErrorFingerprint(error);
      errorTracker.checkCriticalPatterns(fingerprint, 1, error);
      
      // Should log security alert (mocked logger would be called)
    });
  });

  describe('Error Statistics', () => {
    test('should provide error statistics', () => {
      // Simulate some errors
      errorTracker.errorCounts.set('error1', 3);
      errorTracker.errorCounts.set('error2', 7);
      errorTracker.errorCounts.set('error3', 2);

      const stats = errorTracker.getErrorStats();

      expect(stats.totalErrors).toBe(12);
      expect(stats.criticalErrors).toBe(1); // Only error2 has count >= 5
      expect(stats.topErrors).toHaveLength(3);
      expect(stats.topErrors[0].count).toBe(7); // Sorted by count
    });
  });

  describe('Performance Tracking', () => {
    test('should track function performance', async () => {
      const testFunction = async (value) => {
        await new Promise(resolve => setTimeout(resolve, 100));
        return value * 2;
      };

      const trackedFunction = errorTracker.trackPerformance('testFunction', testFunction);
      const result = await trackedFunction(5);

      expect(result).toBe(10);
      // Performance metrics would be logged (mocked logger)
    });

    test('should track function errors', async () => {
      const errorFunction = async () => {
        throw new Error('Function failed');
      };

      const trackedFunction = errorTracker.trackPerformance('errorFunction', errorFunction);

      await expect(trackedFunction()).rejects.toThrow('Function failed');
      // Error metrics would be logged (mocked logger)
    });
  });

  describe('Correlation ID Generation', () => {
    test('should generate unique correlation IDs', () => {
      const id1 = errorTracker.generateCorrelationId();
      const id2 = errorTracker.generateCorrelationId();

      expect(id1).toHaveLength(16);
      expect(id2).toHaveLength(16);
      expect(id1).not.toBe(id2);
      expect(id1).toMatch(/^[a-f0-9]+$/);
    });
  });
});