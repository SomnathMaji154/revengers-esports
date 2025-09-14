const winston = require('winston');
const path = require('path');
const config = require('./config');

/**
 * Enhanced logging system with Winston
 * Provides structured logging with different levels and transports
 */
class Logger {
  constructor() {
    this.logger = this.createLogger();
  }

  createLogger() {
    const logFormat = winston.format.combine(
      winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
      winston.format.errors({ stack: true }),
      winston.format.json()
    );

    const consoleFormat = winston.format.combine(
      winston.format.timestamp({ format: 'HH:mm:ss' }),
      winston.format.colorize(),
      winston.format.printf(({ timestamp, level, message, ...meta }) => {
        let metaStr = Object.keys(meta).length ? JSON.stringify(meta, null, 2) : '';
        return `${timestamp} [${level}]: ${message} ${metaStr}`;
      })
    );

    const transports = [
      // Console transport for development
      new winston.transports.Console({
        level: config.isDevelopment ? 'debug' : 'info',
        format: consoleFormat,
        handleExceptions: true
      })
    ];

    // File transport for production (Render supports ephemeral file system)
    if (config.isProduction) {
      transports.push(
        new winston.transports.File({
          filename: 'error.log',
          level: 'error',
          format: logFormat,
          maxsize: 5242880, // 5MB
          maxFiles: 2
        }),
        new winston.transports.File({
          filename: 'combined.log',
          format: logFormat,
          maxsize: 5242880, // 5MB
          maxFiles: 3
        })
      );
    }

    return winston.createLogger({
      level: config.LOG_LEVEL,
      format: logFormat,
      defaultMeta: { 
        service: 'revengers-esports',
        environment: config.NODE_ENV 
      },
      transports,
      exitOnError: false
    });
  }

  // Convenience methods
  error(message, meta = {}) {
    this.logger.error(message, meta);
  }

  warn(message, meta = {}) {
    this.logger.warn(message, meta);
  }

  info(message, meta = {}) {
    this.logger.info(message, meta);
  }

  debug(message, meta = {}) {
    this.logger.debug(message, meta);
  }

  // HTTP request logging
  httpLog(req, res, next) {
    const start = Date.now();
    
    res.on('finish', () => {
      const duration = Date.now() - start;
      const logData = {
        method: req.method,
        url: req.url,
        status: res.statusCode,
        duration: `${duration}ms`,
        ip: req.ip || req.connection.remoteAddress,
        userAgent: req.get('User-Agent'),
        userId: req.session?.userId || 'anonymous'
      };

      if (res.statusCode >= 400) {
        this.error('HTTP Error', logData);
      } else {
        this.info('HTTP Request', logData);
      }
    });

    next();
  }

  // Database operation logging
  dbLog(operation, table, duration, error = null) {
    const logData = {
      operation,
      table,
      duration: `${duration}ms`
    };

    if (error) {
      this.error('Database Error', { ...logData, error: error.message });
    } else {
      this.debug('Database Operation', logData);
    }
  }

  // Security event logging
  securityLog(event, details = {}) {
    this.warn('Security Event', {
      event,
      timestamp: new Date().toISOString(),
      ...details
    });
  }

  // Performance monitoring
  performance(label, duration, threshold = 1000) {
    const logData = {
      label,
      duration: `${duration}ms`,
      slow: duration > threshold
    };

    if (duration > threshold) {
      this.warn('Slow Operation', logData);
    } else {
      this.debug('Performance', logData);
    }
  }
}

module.exports = new Logger();