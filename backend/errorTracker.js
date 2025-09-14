const winston = require('winston');
const path = require('path');
const fs = require('fs');
const config = require('./config');

/**
 * Advanced Error Tracking and Structured Logging System
 * Comprehensive error handling with categorization, alerting, and analytics
 */
class ErrorTracker {
  constructor() {
    this.errorCounts = new Map();
    this.errorCategories = {
      VALIDATION: 'validation',
      DATABASE: 'database',
      AUTHENTICATION: 'authentication',
      AUTHORIZATION: 'authorization',
      NETWORK: 'network',
      FILE_SYSTEM: 'filesystem',
      EXTERNAL_API: 'external_api',
      BUSINESS_LOGIC: 'business_logic',
      SYSTEM: 'system',
      SECURITY: 'security',
      PERFORMANCE: 'performance'
    };
    
    this.setupLogger();
    this.setupErrorAggregation();
  }

  setupLogger() {
    // Ensure logs directory exists
    const logsDir = path.join(__dirname, '../logs');
    if (!fs.existsSync(logsDir)) {
      fs.mkdirSync(logsDir, { recursive: true });
    }

    // Custom format for structured logging
    const structuredFormat = winston.format.combine(
      winston.format.timestamp({
        format: 'YYYY-MM-DD HH:mm:ss.SSS'
      }),
      winston.format.errors({ stack: true }),
      winston.format.json(),
      winston.format.printf(info => {
        const { timestamp, level, message, ...meta } = info;
        
        const logEntry = {
          timestamp,
          level: level.toUpperCase(),
          message,
          service: 'revengers-esports',
          environment: config.NODE_ENV,
          ...meta
        };

        // Add correlation ID if available
        if (meta.correlationId) {
          logEntry.correlationId = meta.correlationId;
        }

        return JSON.stringify(logEntry);
      })
    );

    // Console format for development
    const consoleFormat = winston.format.combine(
      winston.format.timestamp({
        format: 'HH:mm:ss'
      }),
      winston.format.colorize(),
      winston.format.printf(info => {
        const { timestamp, level, message, stack } = info;
        let output = `${timestamp} [${level}]: ${message}`;
        
        if (stack) {
          output += `\n${stack}`;
        }
        
        return output;
      })
    );

    this.logger = winston.createLogger({
      level: config.LOG_LEVEL,
      defaultMeta: {
        service: 'revengers-esports',
        environment: config.NODE_ENV,
        nodeVersion: process.version,
        pid: process.pid
      },
      transports: [
        // Console logging (development)
        new winston.transports.Console({
          format: config.isDevelopment ? consoleFormat : structuredFormat,
          level: config.isDevelopment ? 'debug' : 'info'
        }),
        
        // File logging - All logs
        new winston.transports.File({
          filename: path.join(logsDir, 'application.log'),
          format: structuredFormat,
          maxsize: 50 * 1024 * 1024, // 50MB
          maxFiles: 10,
          tailable: true
        }),
        
        // File logging - Errors only
        new winston.transports.File({
          filename: path.join(logsDir, 'errors.log'),
          level: 'error',
          format: structuredFormat,
          maxsize: 50 * 1024 * 1024, // 50MB
          maxFiles: 10,
          tailable: true
        }),
        
        // File logging - Security events
        new winston.transports.File({
          filename: path.join(logsDir, 'security.log'),
          format: structuredFormat,
          maxsize: 50 * 1024 * 1024, // 50MB
          maxFiles: 10,
          tailable: true,
          level: 'warn'
        })
      ],
      
      // Handle logger errors
      exceptionHandlers: [
        new winston.transports.File({
          filename: path.join(logsDir, 'exceptions.log'),
          format: structuredFormat
        })
      ],
      
      rejectionHandlers: [
        new winston.transports.File({
          filename: path.join(logsDir, 'rejections.log'),
          format: structuredFormat
        })
      ],
      
      exitOnError: false
    });
  }

  setupErrorAggregation() {
    // Don't start timers in test environment
    if (process.env.NODE_ENV !== 'test') {
      // Reset error counts every hour
      setInterval(() => {
        this.errorCounts.clear();
      }, 60 * 60 * 1000);
    }
  }

  /**
   * Create enhanced error with categorization and context
   */
  createError(message, category = this.errorCategories.SYSTEM, context = {}) {
    const error = new Error(message);
    error.category = category;
    error.context = context;
    error.timestamp = new Date().toISOString();
    error.correlationId = this.generateCorrelationId();
    
    return error;
  }

  /**
   * Track and log errors with detailed context
   */
  trackError(error, request = null, additionalContext = {}) {
    // Generate error fingerprint for aggregation
    const fingerprint = this.generateErrorFingerprint(error);
    
    // Update error counts
    const count = this.errorCounts.get(fingerprint) || 0;
    this.errorCounts.set(fingerprint, count + 1);

    // Prepare error context
    const errorContext = {
      fingerprint,
      category: error.category || this.errorCategories.SYSTEM,
      stack: error.stack,
      occurrenceCount: count + 1,
      ...additionalContext
    };

    // Add request context if available
    if (request) {
      errorContext.request = {
        method: request.method,
        url: request.url,
        ip: request.ip,
        userAgent: request.get('User-Agent'),
        userId: request.session?.userId || 'anonymous',
        sessionId: request.session?.id,
        correlationId: request.correlationId || this.generateCorrelationId()
      };
    }

    // Add system context
    errorContext.system = {
      memory: this.getMemoryUsage(),
      uptime: process.uptime(),
      nodeVersion: process.version,
      platform: process.platform
    };

    // Log error with appropriate level
    const level = this.getErrorLogLevel(error.category);
    this.logger[level](error.message, errorContext);

    // Check for critical error patterns
    this.checkCriticalPatterns(fingerprint, count + 1, error);

    return errorContext;
  }

  /**
   * Generate error fingerprint for aggregation
   */
  generateErrorFingerprint(error) {
    const crypto = require('crypto');
    
    // Use error message and first few lines of stack trace
    const stackLines = error.stack ? error.stack.split('\n').slice(0, 3).join('\n') : '';
    const content = `${error.message}|${stackLines}|${error.category || ''}`;
    
    return crypto.createHash('sha256')
      .update(content)
      .digest('hex')
      .substring(0, 16);
  }

  /**
   * Generate correlation ID for request tracing
   */
  generateCorrelationId() {
    const crypto = require('crypto');
    return crypto.randomBytes(8).toString('hex');
  }

  /**
   * Get appropriate log level based on error category
   */
  getErrorLogLevel(category) {
    const criticalCategories = [
      this.errorCategories.SECURITY,
      this.errorCategories.DATABASE,
      this.errorCategories.SYSTEM
    ];
    
    const warningCategories = [
      this.errorCategories.AUTHENTICATION,
      this.errorCategories.AUTHORIZATION,
      this.errorCategories.VALIDATION
    ];

    if (criticalCategories.includes(category)) {
      return 'error';
    } else if (warningCategories.includes(category)) {
      return 'warn';
    } else {
      return 'info';
    }
  }

  /**
   * Check for critical error patterns requiring immediate attention
   */
  checkCriticalPatterns(fingerprint, count, error) {
    // High frequency errors
    if (count >= 10) {
      this.logger.error('High frequency error detected', {
        fingerprint,
        count,
        error: error.message,
        category: error.category,
        alert: 'HIGH_FREQUENCY_ERROR'
      });
    }

    // Security-related errors
    if (error.category === this.errorCategories.SECURITY) {
      this.logger.error('Security-related error', {
        fingerprint,
        error: error.message,
        alert: 'SECURITY_INCIDENT'
      });
    }

    // Database connection errors
    if (error.category === this.errorCategories.DATABASE && 
        error.message.includes('connect')) {
      this.logger.error('Database connectivity issue', {
        fingerprint,
        error: error.message,
        alert: 'DATABASE_CONNECTIVITY'
      });
    }
  }

  /**
   * Get current memory usage
   */
  getMemoryUsage() {
    const usage = process.memoryUsage();
    return {
      heapUsed: Math.round(usage.heapUsed / 1024 / 1024),
      heapTotal: Math.round(usage.heapTotal / 1024 / 1024),
      rss: Math.round(usage.rss / 1024 / 1024),
      external: Math.round(usage.external / 1024 / 1024)
    };
  }

  /**
   * Express middleware for error tracking
   */
  errorMiddleware() {
    return (err, req, res, next) => {
      // Track the error
      const errorContext = this.trackError(err, req);
      
      // Determine response based on error category and environment
      let statusCode = err.statusCode || err.status || 500;
      let response = {
        error: 'Internal server error',
        code: 'INTERNAL_ERROR',
        correlationId: errorContext.request?.correlationId
      };

      // Handle specific error types
      if (err.category === this.errorCategories.VALIDATION) {
        statusCode = 400;
        response.error = 'Validation error';
        response.code = 'VALIDATION_ERROR';
        if (config.isDevelopment) {
          response.details = err.message;
        }
      } else if (err.category === this.errorCategories.AUTHENTICATION) {
        statusCode = 401;
        response.error = 'Authentication required';
        response.code = 'AUTH_REQUIRED';
      } else if (err.category === this.errorCategories.AUTHORIZATION) {
        statusCode = 403;
        response.error = 'Access denied';
        response.code = 'ACCESS_DENIED';
      } else if (err.category === this.errorCategories.DATABASE) {
        statusCode = 503;
        response.error = 'Service temporarily unavailable';
        response.code = 'SERVICE_UNAVAILABLE';
      }

      // Include stack trace in development
      if (config.isDevelopment && err.stack) {
        response.stack = err.stack;
      }

      res.status(statusCode).json(response);
    };
  }

  /**
   * Request correlation middleware
   */
  correlationMiddleware() {
    return (req, res, next) => {
      // Generate or use existing correlation ID
      req.correlationId = req.get('X-Correlation-ID') || this.generateCorrelationId();
      
      // Add to response headers
      res.set('X-Correlation-ID', req.correlationId);
      
      next();
    };
  }

  /**
   * Get error statistics
   */
  getErrorStats() {
    const stats = {
      totalErrors: 0,
      categoryCounts: {},
      topErrors: [],
      criticalErrors: 0
    };

    // Count errors by category
    for (const [fingerprint, count] of this.errorCounts.entries()) {
      stats.totalErrors += count;
      
      if (count >= 5) {
        stats.criticalErrors++;
      }
    }

    // Get top errors by frequency
    const sortedErrors = Array.from(this.errorCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10);
    
    stats.topErrors = sortedErrors.map(([fingerprint, count]) => ({
      fingerprint,
      count
    }));

    return stats;
  }

  /**
   * Performance tracking for function execution
   */
  trackPerformance(functionName, fn) {
    return async (...args) => {
      const startTime = Date.now();
      const startMemory = process.memoryUsage().heapUsed;
      
      try {
        const result = await fn(...args);
        const duration = Date.now() - startTime;
        const memoryUsed = process.memoryUsage().heapUsed - startMemory;
        
        this.logger.debug('Function performance', {
          function: functionName,
          duration,
          memoryUsed: Math.round(memoryUsed / 1024),
          success: true
        });
        
        return result;
      } catch (error) {
        const duration = Date.now() - startTime;
        
        this.logger.warn('Function performance (error)', {
          function: functionName,
          duration,
          error: error.message,
          success: false
        });
        
        throw error;
      }
    };
  }
}

module.exports = new ErrorTracker();