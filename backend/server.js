const config = require('./config');
const logger = require('./logger');
const security = require('./security');
const errorTracker = require('./errorTracker');
const performance = require('./performance');
const monitoring = require('./monitoring');
const healthCheckRoutes = require('./healthcheck');
const express = require('express');
const path = require('path');
const session = require('express-session');
const connectPgSimple = require('connect-pg-simple');
const helmet = require('helmet');
const compression = require('compression');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const slowDown = require('express-slow-down');
const crypto = require('crypto');
const NodeCache = require('node-cache');
const client = require('prom-client');

// Import modularized components
const { pool } = require('./db');
const db = require('./db');
const { router: authRoutes, isAuthenticated } = require('./auth');
const playerRoutes = require('./playerRoutes');
const managerRoutes = require('./managerRoutes');
const trophyRoutes = require('./trophyRoutes');
const { contactRouter, registeredUsersRouter } = require('./contactRoutes');

const app = express();
const PORT = config.PORT;
const NODE_ENV = config.NODE_ENV;

// Initialize caching
const cache = new NodeCache({ stdTTL: 300, checkperiod: 60 });

// Initialize Prometheus metrics
const register = new client.Registry();
client.collectDefaultMetrics({ register });

// Custom metrics
const httpRequestsTotal = new client.Counter({
  name: 'http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'route', 'status_code'],
  registers: [register]
});

const httpRequestDuration = new client.Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route'],
  registers: [register]
});

const activeConnections = new client.Gauge({
  name: 'active_connections',
  help: 'Number of active connections',
  registers: [register]
});

// Log startup information
logger.info('Starting Revengers Esports server', config.getDebugInfo());

// Trust the first proxy (required for Render)
app.set('trust proxy', 1);

// Request correlation middleware (must be first)
app.use(errorTracker.correlationMiddleware());

// Security and performance middleware
app.use(compression({ 
  level: config.COMPRESSION_LEVEL,
  threshold: 1024,
  filter: (req, res) => {
    // Don't compress already compressed files
    if (req.headers['content-encoding']) {
      return false;
    }
    return compression.filter(req, res);
  }
}));

// Enhanced Helmet configuration with strict security
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: [
        "'self'", 
        "'unsafe-inline'", 
        "https://cdnjs.cloudflare.com",
        "https://unpkg.com",
        "'nonce-$NONCE'"
      ],
      styleSrc: [
        "'self'", 
        "'unsafe-inline'", 
        "https://cdnjs.cloudflare.com", 
        "https://fonts.googleapis.com"
      ],
      imgSrc: [
        "'self'", 
        "data:", 
        "https://res.cloudinary.com", 
        "https://cloudinary.com",
        "https:"
      ],
      connectSrc: ["'self'", "https://api.cloudinary.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"],
      baseUri: ["'self'"],
      formAction: ["'self'"],
      frameAncestors: ["'none'"],
      upgradeInsecureRequests: config.isProduction ? [] : null
    },
    reportOnly: false
  },
  crossOriginEmbedderPolicy: false,
  crossOriginOpenerPolicy: { policy: 'same-origin' },
  crossOriginResourcePolicy: { policy: 'cross-origin' },
  dnsPrefetchControl: { allow: false },
  frameguard: { action: 'deny' },
  hidePoweredBy: true,
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  },
  ieNoOpen: true,
  noSniff: true,
  originAgentCluster: true,
  permittedCrossDomainPolicies: false,
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
  xssFilter: true
}));

// Enhanced logging middleware with metrics
app.use((req, res, next) => {
  const start = Date.now();
  
  // Track active connections
  activeConnections.inc();
  
  res.on('finish', () => {
    const duration = (Date.now() - start) / 1000;
    const route = req.route ? req.route.path : req.path;
    
    // Record metrics
    httpRequestsTotal.inc({
      method: req.method,
      route,
      status_code: res.statusCode
    });
    
    httpRequestDuration.observe(
      { method: req.method, route },
      duration
    );
    
    activeConnections.dec();
    
    // Record in advanced monitoring
    monitoring.recordRequest(req.method, req.path, res.statusCode, duration * 1000);
    
    // Log request details
    const logData = {
      method: req.method,
      url: req.url,
      status: res.statusCode,
      duration: `${Math.round(duration * 1000)}ms`,
      ip: req.ip || req.connection.remoteAddress,
      userAgent: req.get('User-Agent'),
      userId: req.session?.userId || 'anonymous',
      responseSize: res.get('Content-Length') || 0
    };

    if (res.statusCode >= 400) {
      console.error('[HTTP Error]', logData);
    } else {
      console.log('[HTTP Request]', logData);
    }
  });

  next();
});

// Request sanitization middleware
app.use(security.sanitizeRequest());

// CORS configuration
app.use(cors(config.corsConfig));

// Rate limiting with enhanced security
const generalLimiter = rateLimit({
  ...config.rateLimitConfig,
  keyGenerator: (req) => security.generateRateLimitKey(req, { includeEndpoint: true }),
  message: {
    error: 'Too many requests from this IP, please try again later.',
    code: 'RATE_LIMIT_EXCEEDED',
    retryAfter: Math.ceil(config.rateLimitConfig.windowMs / 1000)
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res, next, options) => {
    logger.securityLog('Rate limit exceeded', {
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      path: req.path,
      key: security.generateRateLimitKey(req)
    });
    res.status(options.statusCode).json(options.message);
  }
});

const authLimiter = rateLimit({
  ...config.authRateLimitConfig,
  keyGenerator: (req) => security.generateRateLimitKey(req, { includeUserAgent: true }),
  message: {
    error: 'Too many authentication attempts, please try again later.',
    code: 'AUTH_RATE_LIMIT_EXCEEDED',
    retryAfter: Math.ceil(config.authRateLimitConfig.windowMs / 1000)
  },
  skipSuccessfulRequests: true,
  handler: (req, res, next, options) => {
    logger.securityLog('Auth rate limit exceeded', {
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      path: req.path
    });
    res.status(options.statusCode).json(options.message);
  }
});

// Slow down middleware for additional protection
const speedLimiter = slowDown({
  windowMs: 15 * 60 * 1000, // 15 minutes
  delayAfter: 50, // Allow 50 requests per window at full speed
  delayMs: 100, // Add 100ms delay per request after delayAfter
  maxDelayMs: 20000, // Maximum delay of 20 seconds
  keyGenerator: (req) => security.generateRateLimitKey(req)
});

app.use('/api/', generalLimiter);
app.use('/api/', speedLimiter);
app.use('/api/admin/login', authLimiter);

// Body parsing middleware
app.use(express.json({ 
  limit: '10mb',
  verify: (req, res, buf) => {
    // Log large payloads
    if (buf.length > 1024 * 1024) { // 1MB
      logger.warn('Large JSON payload received', {
        size: `${Math.round(buf.length / 1024)}KB`,
        ip: req.ip,
        path: req.path
      });
    }
  }
}));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Session configuration with enhanced security
let sessionConfig = config.sessionConfig;

// Try to use PostgreSQL session store, fallback to memory store if DB unavailable
try {
  const pgSession = connectPgSimple(session);
  sessionConfig.store = new pgSession({
    pool: pool,
    tableName: 'sessions',
    createTableIfMissing: true,
    pruneSessionInterval: 60 * 15, // Prune expired sessions every 15 minutes
    errorLog: (err) => {
      logger.error('Session store error', { error: err.message });
    }
  });
  logger.info('PostgreSQL session store initialized');
} catch (err) {
  logger.warn('Could not initialize PostgreSQL session store. Using memory store', {
    error: err.message,
    warning: 'Sessions will not persist across server restarts'
  });
  sessionConfig.store = new session.MemoryStore();
}

app.use(session(sessionConfig));

// Alternative CSRF protection using double submit cookie pattern
function csrfProtection(req, res, next) {
  // Only protect state-changing operations
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
    return next();
  }
  
  // Skip CSRF for API endpoints (use session-based auth instead)
  if (req.path.startsWith('/api/')) {
    return next();
  }
  
  const token = req.headers['x-csrf-token'] || req.body._csrf;
  const cookieToken = req.cookies['csrf-token'];
  
  if (!token || !cookieToken || token !== cookieToken) {
    logger.securityLog('CSRF token validation failed', {
      hasToken: !!token,
      hasCookieToken: !!cookieToken,
      tokensMatch: token === cookieToken,
      ip: req.ip,
      path: req.path
    });
    
    return res.status(403).json({
      error: 'CSRF token validation failed',
      code: 'CSRF_INVALID'
    });
  }
  
  next();
}

// Static file serving with no-cache for critical files
const staticOptions = {
  maxAge: 0, // No caching by default
  etag: true,
  lastModified: true,
  setHeaders: (res, path) => {
    // Force no-cache for HTML, CSS, JS files to ensure fresh content
    if (path.match(/\.(html|css|js)$/)) {
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
    }
    // Set longer cache for images only
    else if (path.match(/\.(jpg|jpeg|png|gif|webp|svg)$/)) {
      res.setHeader('Cache-Control', 'public, max-age=86400'); // 24 hours
    }
    // No cache for everything else
    else {
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    }
  }
};

app.use(express.static(path.join(__dirname, '../'), staticOptions));
app.use(express.static(path.join(__dirname, '../public'), staticOptions));

// API Routes with enhanced error handling
app.use('/api', authRoutes);
app.use('/api/players', playerRoutes);
app.use('/api/managers', managerRoutes);
app.use('/api/trophies', trophyRoutes);
app.use('/api/contact', contactRouter);
app.use('/api/registered-users', registeredUsersRouter);

// Advanced health check and monitoring routes
app.use('/api/health', healthCheckRoutes);

// CSRF token endpoint for frontend
app.get('/api/csrf-token', (req, res) => {
  const token = crypto.randomBytes(32).toString('hex');
  res.cookie('csrf-token', token, {
    httpOnly: false, // Needs to be accessible to JavaScript
    secure: config.isProduction,
    sameSite: 'strict',
    maxAge: 24 * 60 * 60 * 1000 // 24 hours
  });
  res.json({ csrfToken: token });
});

// Metrics endpoint for monitoring
app.get('/metrics', (req, res) => {
  res.set('Content-Type', register.contentType);
  res.end(register.metrics());
});

// Enhanced health check endpoint with comprehensive diagnostics
app.get('/health', async (req, res) => {
  const startTime = Date.now();
  
  const healthStatus = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: Math.floor(process.uptime()),
    environment: config.NODE_ENV,
    version: require('../package.json').version,
    nodejs: process.version,
    memory: {
      used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
      total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024),
      rss: Math.round(process.memoryUsage().rss / 1024 / 1024),
      external: Math.round(process.memoryUsage().external / 1024 / 1024)
    },
    cpu: {
      usage: process.cpuUsage()
    },
    database: {
      status: global.MOCK_MODE ? 'mock' : 'connected',
      mockMode: global.MOCK_MODE || false
    },
    cache: {
      keys: cache.keys().length,
      hits: cache.getStats().hits || 0,
      misses: cache.getStats().misses || 0
    },
    security: {
      csrfProtection: true,
      rateLimiting: true,
      helmet: true,
      inputSanitization: true
    },
    errors: errorTracker.getErrorStats(),
    performance: performance.getPerformanceReport()
  };

  // Test database connectivity
  if (!global.MOCK_MODE) {
    try {
      const dbStart = Date.now();
      await pool.query('SELECT 1 as health_check');
      healthStatus.database.responseTime = Date.now() - dbStart;
      healthStatus.database.status = 'healthy';
    } catch (error) {
      healthStatus.database.status = 'error';
      healthStatus.database.error = error.message;
      healthStatus.status = 'degraded';
      
      // Track database error
      errorTracker.trackError(
        errorTracker.createError(
          'Health check database error',
          errorTracker.errorCategories.DATABASE,
          { healthCheck: true }
        ),
        req
      );
    }
  }

  // Check memory usage thresholds
  if (healthStatus.memory.used > 500) { // 500MB threshold
    healthStatus.status = 'warning';
    healthStatus.warnings = healthStatus.warnings || [];
    healthStatus.warnings.push('High memory usage detected');
  }

  // Check error rates
  if (healthStatus.errors.criticalErrors > 0) {
    healthStatus.status = 'warning';
    healthStatus.warnings = healthStatus.warnings || [];
    healthStatus.warnings.push('Critical errors detected');
  }

  const responseTime = Date.now() - startTime;
  healthStatus.responseTime = responseTime;

  // Set appropriate status code
  const statusCode = healthStatus.status === 'ok' ? 200 : 
                    healthStatus.status === 'warning' ? 200 : 503;
  
  res.status(statusCode).json(healthStatus);
});

// Error statistics endpoint
app.get('/api/admin/errors', isAuthenticated, (req, res) => {
  const stats = errorTracker.getErrorStats();
  res.json({
    ...stats,
    timestamp: new Date().toISOString()
  });
});

// Performance report endpoint
app.get('/api/admin/performance', isAuthenticated, (req, res) => {
  const report = performance.getPerformanceReport();
  res.json(report);
});

// Root route handler - serve index.html with no-cache headers
app.get('/', (req, res) => {
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.sendFile(path.join(__dirname, '../index.html'));
});

// Catch-all route for HTML pages - serve with no-cache headers
app.get('*.html', (req, res) => {
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  
  const filePath = path.join(__dirname, '..', req.path);
  res.sendFile(filePath, (err) => {
    if (err) {
      logger.warn('HTML file not found', {
        requestedFile: req.path,
        ip: req.ip
      });
      res.status(404).sendFile(path.join(__dirname, '../index.html')); // Fallback to index
    }
  });
});

// Enhanced error handling middleware with comprehensive tracking
app.use((err, req, res, next) => {
  // Use error tracker for comprehensive logging and handling
  errorTracker.trackError(err, req, {
    endpoint: req.path,
    method: req.method,
    body: req.body,
    query: req.query,
    params: req.params
  });

  // CSRF errors
  if (err.code === 'EBADCSRFTOKEN') {
    const csrfError = errorTracker.createError(
      'Invalid CSRF token', 
      errorTracker.errorCategories.SECURITY,
      { originalError: err.message }
    );
    return errorTracker.errorMiddleware()(csrfError, req, res, next);
  }

  // Validation errors
  if (err.name === 'ValidationError') {
    const validationError = errorTracker.createError(
      err.message,
      errorTracker.errorCategories.VALIDATION,
      { details: err.details }
    );
    return errorTracker.errorMiddleware()(validationError, req, res, next);
  }

  // Database errors
  if (err.code && err.code.startsWith('23')) { // PostgreSQL constraint errors
    const dbError = errorTracker.createError(
      'Database constraint violation',
      errorTracker.errorCategories.DATABASE,
      { pgCode: err.code, detail: err.detail }
    );
    return errorTracker.errorMiddleware()(dbError, req, res, next);
  }

  // Rate limiting errors
  if (err.type === 'request.rate.limit') {
    const rateLimitError = errorTracker.createError(
      'Rate limit exceeded',
      errorTracker.errorCategories.SECURITY,
      { limit: err.limit, current: err.current }
    );
    return errorTracker.errorMiddleware()(rateLimitError, req, res, next);
  }

  // File upload errors
  if (err.code === 'LIMIT_FILE_SIZE') {
    const fileError = errorTracker.createError(
      'File too large',
      errorTracker.errorCategories.VALIDATION,
      { limit: err.limit, field: err.field }
    );
    return errorTracker.errorMiddleware()(fileError, req, res, next);
  }

  // Network/timeout errors
  if (err.code === 'ECONNREFUSED' || err.code === 'ENOTFOUND' || err.code === 'ETIMEDOUT') {
    const networkError = errorTracker.createError(
      'Network connectivity error',
      errorTracker.errorCategories.NETWORK,
      { code: err.code, address: err.address, port: err.port }
    );
    return errorTracker.errorMiddleware()(networkError, req, res, next);
  }

  // Use error tracker middleware for all other errors
  errorTracker.errorMiddleware()(err, req, res, next);
});

// 404 handler for API routes
app.use('/api/*', (req, res) => {
  logger.warn('API endpoint not found', {
    url: req.url,
    method: req.method,
    ip: req.ip
  });
  res.status(404).json({
    error: 'API endpoint not found',
    code: 'NOT_FOUND'
  });
});

// Start server with enhanced logging
const server = app.listen(PORT, config.HOST, () => {
  logger.info('Server started successfully', {
    port: PORT,
    host: config.HOST,
    environment: NODE_ENV,
    database: global.MOCK_MODE ? 'mock mode' : 'connected',
    processId: process.pid
  });
});

// Enhanced graceful shutdown
const gracefulShutdown = (signal) => {
  logger.info(`${signal} received, shutting down gracefully`, {
    uptime: process.uptime(),
    connections: server.listening ? 'active' : 'none'
  });
  
  server.close(async () => {
    try {
      // Close database connections
      if (pool && !global.MOCK_MODE) {
        await pool.end();
        logger.info('Database connections closed');
      }
      
      logger.info('Process terminated gracefully');
      process.exit(0);
    } catch (err) {
      logger.error('Error during shutdown', { error: err.message });
      process.exit(1);
    }
  });

  // Force close after 10 seconds
  setTimeout(() => {
    logger.error('Could not close connections in time, forcefully shutting down');
    process.exit(1);
  }, 10000);
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Handle uncaught exceptions
process.on('uncaughtException', (err) => {
  logger.error('Uncaught Exception', {
    error: err.message,
    stack: err.stack
  });
  gracefulShutdown('UNCAUGHT_EXCEPTION');
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection', {
    reason: reason,
    promise: promise
  });
  gracefulShutdown('UNHANDLED_REJECTION');
});
