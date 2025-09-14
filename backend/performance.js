const logger = require('./logger');
const config = require('./config');

/**
 * Performance Monitoring and Optimization Utilities
 * Comprehensive performance tracking, database optimization, and caching strategies
 */
class PerformanceManager {
  constructor() {
    this.queryCache = new Map();
    this.slowQueryThreshold = 1000; // 1 second
    this.cacheHitStats = { hits: 0, misses: 0 };
    this.performanceMetrics = {
      requests: 0,
      averageResponseTime: 0,
      slowQueries: 0,
      cacheHitRate: 0
    };
  }

  /**
   * Database query performance wrapper
   */
  async executeQuery(query, params = [], options = {}) {
    const startTime = Date.now();
    const queryHash = this.generateQueryHash(query, params);
    
    // Check cache first if enabled
    if (options.cache && this.queryCache.has(queryHash)) {
      this.cacheHitStats.hits++;
      logger.debug('Query cache hit', { query: query.substring(0, 100), params });
      return this.queryCache.get(queryHash);
    }

    try {
      // Execute query
      const result = await this.executeDbQuery(query, params);
      const duration = Date.now() - startTime;

      // Log slow queries
      if (duration > this.slowQueryThreshold) {
        this.performanceMetrics.slowQueries++;
        logger.warn('Slow query detected', {
          query: query.substring(0, 200),
          duration,
          params: params.length
        });
      }

      // Cache result if enabled and query was fast
      if (options.cache && duration < this.slowQueryThreshold) {
        const ttl = options.cacheTtl || 300000; // 5 minutes default
        this.queryCache.set(queryHash, result);
        setTimeout(() => this.queryCache.delete(queryHash), ttl);
      }

      this.cacheHitStats.misses++;
      
      // Update performance metrics
      this.updateQueryMetrics(duration);
      
      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      logger.error('Query execution error', {
        query: query.substring(0, 200),
        duration,
        error: error.message,
        params: params.length
      });
      throw error;
    }
  }

  /**
   * Execute database query (to be implemented based on your DB driver)
   */
  async executeDbQuery(query, params) {
    // This should be replaced with your actual database execution logic
    const db = require('./db');
    
    return new Promise((resolve, reject) => {
      if (query.trim().toUpperCase().startsWith('SELECT')) {
        db.all(query, params, (err, rows) => {
          if (err) reject(err);
          else resolve(rows);
        });
      } else {
        db.run(query, params, function(err) {
          if (err) reject(err);
          else resolve({ id: this.lastID, changes: this.changes });
        });
      }
    });
  }

  /**
   * Generate cache key for query
   */
  generateQueryHash(query, params) {
    const crypto = require('crypto');
    const content = query + JSON.stringify(params);
    return crypto.createHash('md5').update(content).digest('hex');
  }

  /**
   * Update query performance metrics
   */
  updateQueryMetrics(duration) {
    this.performanceMetrics.requests++;
    
    // Calculate rolling average
    const currentAvg = this.performanceMetrics.averageResponseTime;
    const newAvg = ((currentAvg * (this.performanceMetrics.requests - 1)) + duration) / 
                   this.performanceMetrics.requests;
    
    this.performanceMetrics.averageResponseTime = Math.round(newAvg);
    
    // Calculate cache hit rate
    const totalCacheRequests = this.cacheHitStats.hits + this.cacheHitStats.misses;
    this.performanceMetrics.cacheHitRate = totalCacheRequests > 0 ? 
      Math.round((this.cacheHitStats.hits / totalCacheRequests) * 100) : 0;
  }

  /**
   * Optimized query builders for common operations
   */
  getOptimizedQueries() {
    return {
      // Paginated players query with proper indexing
      getPlayers: (limit = 20, offset = 0) => ({
        query: `
          SELECT 
            id, 
            name, 
            jerseyNumber, 
            imageUrl, 
            stars, 
            joined_date,
            created_at
          FROM players 
          ORDER BY joined_date DESC 
          LIMIT $1 OFFSET $2
        `,
        params: [limit, offset],
        cache: true,
        cacheTtl: 180000 // 3 minutes
      }),

      // Players count for pagination
      getPlayersCount: () => ({
        query: 'SELECT COUNT(*) as total FROM players',
        params: [],
        cache: true,
        cacheTtl: 300000 // 5 minutes
      }),

      // Search players with full-text search
      searchPlayers: (searchTerm) => ({
        query: `
          SELECT 
            id, 
            name, 
            jerseyNumber, 
            imageUrl, 
            stars, 
            joined_date,
            ts_rank(search_vector, plainto_tsquery($1)) as rank
          FROM players 
          WHERE search_vector @@ plainto_tsquery($1)
          ORDER BY rank DESC, joined_date DESC
          LIMIT 50
        `,
        params: [searchTerm],
        cache: true,
        cacheTtl: 120000 // 2 minutes
      }),

      // Optimized managers query
      getManagers: (limit = 20) => ({
        query: `
          SELECT 
            id, 
            name, 
            role, 
            imageUrl, 
            joined_date
          FROM managers 
          ORDER BY joined_date DESC 
          LIMIT $1
        `,
        params: [limit],
        cache: true,
        cacheTtl: 300000 // 5 minutes
      }),

      // Trophies with year grouping
      getTrophies: () => ({
        query: `
          SELECT 
            id, 
            name, 
            year, 
            imageUrl,
            created_at
          FROM trophies 
          ORDER BY year DESC, created_at DESC
        `,
        params: [],
        cache: true,
        cacheTtl: 600000 // 10 minutes
      }),

      // Contact submissions with pagination and filtering
      getContactSubmissions: (limit = 50, offset = 0) => ({
        query: `
          SELECT 
            id,
            name, 
            email, 
            whatsapp, 
            submission_date,
            ip_address
          FROM contact_submissions 
          ORDER BY submission_date DESC 
          LIMIT $1 OFFSET $2
        `,
        params: [limit, offset],
        cache: false // Don't cache sensitive data
      })
    };
  }

  /**
   * Database index recommendations
   */
  async optimizeDatabase() {
    const optimizations = [];

    try {
      // Check if recommended indexes exist
      const indexQueries = [
        // Players indexes
        'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_players_jersey_unique ON players (jerseyNumber)',
        'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_players_joined_date ON players (joined_date DESC)',
        'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_players_stars ON players (stars DESC)',
        
        // Full-text search for players
        'ALTER TABLE players ADD COLUMN IF NOT EXISTS search_vector tsvector',
        `UPDATE players SET search_vector = to_tsvector('english', 
          COALESCE(name, '') || ' ' || COALESCE(CAST(jerseyNumber AS text), ''))`,
        'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_players_search ON players USING gin(search_vector)',
        
        // Managers indexes
        'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_managers_joined_date ON managers (joined_date DESC)',
        'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_managers_role ON managers (role)',
        
        // Trophies indexes
        'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_trophies_year ON trophies (year DESC)',
        'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_trophies_created_at ON trophies (created_at DESC)',
        
        // Contact submissions indexes
        'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_contact_submissions_date ON contact_submissions (submission_date DESC)',
        'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_contact_submissions_email ON contact_submissions (email)',
        
        // Sessions table optimization
        'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_sessions_expire ON sessions (expire)',
        'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_sessions_sid ON sessions (sid)'
      ];

      for (const query of indexQueries) {
        try {
          await this.executeDbQuery(query, []);
          optimizations.push(`✓ ${query.split(' ')[2]} ${query.split(' ')[7]}`);
        } catch (error) {
          logger.warn('Index creation warning', { query, error: error.message });
        }
      }

      // Set up automatic statistics updates
      await this.executeDbQuery('ANALYZE players, managers, trophies, contact_submissions', []);
      optimizations.push('✓ Database statistics updated');

      logger.info('Database optimization completed', { optimizations });
      return optimizations;
    } catch (error) {
      logger.error('Database optimization error', { error: error.message });
      throw error;
    }
  }

  /**
   * Memory optimization utilities
   */
  optimizeMemory() {
    // Clear query cache if it gets too large
    if (this.queryCache.size > 1000) {
      const oldSize = this.queryCache.size;
      this.queryCache.clear();
      logger.info('Query cache cleared due to size limit', { 
        oldSize, 
        newSize: this.queryCache.size 
      });
    }

    // Force garbage collection if available and memory usage is high
    const memUsage = process.memoryUsage();
    const heapUsedMB = memUsage.heapUsed / 1024 / 1024;
    
    if (global.gc && heapUsedMB > 200) { // 200MB threshold
      global.gc();
      const newMemUsage = process.memoryUsage();
      logger.info('Garbage collection performed', {
        before: Math.round(heapUsedMB),
        after: Math.round(newMemUsage.heapUsed / 1024 / 1024),
        freed: Math.round((memUsage.heapUsed - newMemUsage.heapUsed) / 1024 / 1024)
      });
    }
  }

  /**
   * Response compression optimization
   */
  shouldCompress(req, res) {
    // Don't compress if already compressed
    if (req.headers['content-encoding']) {
      return false;
    }

    // Don't compress small responses
    const contentLength = res.getHeader('content-length');
    if (contentLength && contentLength < 1024) {
      return false;
    }

    // Don't compress images and already compressed files
    const contentType = res.getHeader('content-type');
    if (contentType) {
      const skipTypes = [
        'image/',
        'video/',
        'audio/',
        'application/zip',
        'application/gzip',
        'application/x-7z-compressed'
      ];
      
      if (skipTypes.some(type => contentType.includes(type))) {
        return false;
      }
    }

    return true;
  }

  /**
   * Connection pooling optimization
   */
  optimizeConnectionPool() {
    const pool = require('./db').pool;
    
    if (pool) {
      // Monitor pool statistics
      const stats = {
        totalCount: pool.totalCount,
        idleCount: pool.idleCount,
        waitingCount: pool.waitingCount
      };

      logger.debug('Connection pool stats', stats);

      // Warn if pool is under stress
      if (stats.waitingCount > 5) {
        logger.warn('High connection pool wait count', stats);
      }

      if (stats.idleCount === 0 && stats.totalCount >= pool.options.max) {
        logger.warn('Connection pool exhausted', stats);
      }

      return stats;
    }

    return null;
  }

  /**
   * Get comprehensive performance report
   */
  getPerformanceReport() {
    const memUsage = process.memoryUsage();
    const connectionStats = this.optimizeConnectionPool();

    return {
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      memory: {
        heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024),
        heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024),
        rss: Math.round(memUsage.rss / 1024 / 1024),
        external: Math.round(memUsage.external / 1024 / 1024)
      },
      cache: {
        size: this.queryCache.size,
        hitRate: this.performanceMetrics.cacheHitRate,
        hits: this.cacheHitStats.hits,
        misses: this.cacheHitStats.misses
      },
      database: {
        averageQueryTime: this.performanceMetrics.averageResponseTime,
        slowQueries: this.performanceMetrics.slowQueries,
        totalQueries: this.performanceMetrics.requests,
        connectionPool: connectionStats
      },
      recommendations: this.getPerformanceRecommendations()
    };
  }

  /**
   * Generate performance recommendations
   */
  getPerformanceRecommendations() {
    const recommendations = [];
    const memUsage = process.memoryUsage();
    const heapUsedMB = memUsage.heapUsed / 1024 / 1024;

    if (heapUsedMB > 500) {
      recommendations.push('High memory usage detected. Consider implementing more aggressive caching cleanup.');
    }

    if (this.performanceMetrics.averageResponseTime > 500) {
      recommendations.push('High average response time. Consider query optimization and indexing.');
    }

    if (this.performanceMetrics.cacheHitRate < 50) {
      recommendations.push('Low cache hit rate. Review caching strategy and TTL settings.');
    }

    if (this.performanceMetrics.slowQueries > 10) {
      recommendations.push('Multiple slow queries detected. Review database indexes and query optimization.');
    }

    if (this.queryCache.size > 800) {
      recommendations.push('Query cache is getting large. Consider implementing LRU eviction.');
    }

    return recommendations;
  }

  /**
   * Cleanup and maintenance
   */
  performMaintenance() {
    this.optimizeMemory();
    
    // Reset metrics periodically
    if (this.performanceMetrics.requests > 10000) {
      this.performanceMetrics = {
        requests: 0,
        averageResponseTime: 0,
        slowQueries: 0,
        cacheHitRate: 0
      };
      this.cacheHitStats = { hits: 0, misses: 0 };
      logger.info('Performance metrics reset');
    }
  }
}

module.exports = new PerformanceManager();