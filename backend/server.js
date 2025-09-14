const config = require('./config');
const logger = require('./logger');
const express = require('express');
const path = require('path');
const session = require('express-session');
const connectPgSimple = require('connect-pg-simple');
const helmet = require('helmet');
const compression = require('compression');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const crypto = require('crypto');

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

// Log startup information
logger.info('Starting Revengers Esports server', config.getDebugInfo());

// Trust the first proxy (required for Render)
app.set('trust proxy', 1);

// Security and performance middleware
app.use(compression({ level: config.COMPRESSION_LEVEL }));
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "https://cdnjs.cloudflare.com"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://cdnjs.cloudflare.com", "https://fonts.googleapis.com"],
      imgSrc: ["'self'", "data:", "https://res.cloudinary.com", "https://cloudinary.com"],
      connectSrc: ["'self'"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"],
    },
  },
  crossOriginEmbedderPolicy: false, // Needed for some image processing
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' }
}));

// Enhanced logging middleware
app.use(logger.httpLog);

// CORS configuration
app.use(cors(config.corsConfig));

// Rate limiting
const generalLimiter = rateLimit({
  ...config.rateLimitConfig,
  message: {
    error: 'Too many requests from this IP, please try again later.',
    code: 'RATE_LIMIT_EXCEEDED'
  }
});

const authLimiter = rateLimit({
  ...config.authRateLimitConfig,
  message: {
    error: 'Too many authentication attempts, please try again later.',
    code: 'AUTH_RATE_LIMIT_EXCEEDED'
  },
  skipSuccessfulRequests: true,
  handler: (req, res, next, options) => {
    logger.securityLog('Rate limit exceeded for auth endpoint', {
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      path: req.path
    });
    res.status(options.statusCode).json(options.message);
  }
});

app.use('/api/', generalLimiter);
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

// Static file serving with enhanced caching
const staticOptions = {
  maxAge: config.CACHE_MAX_AGE * 1000, // Convert to milliseconds
  etag: true,
  lastModified: true,
  setHeaders: (res, path) => {
    // Set longer cache for images
    if (path.match(/\.(jpg|jpeg|png|gif|webp|svg)$/)) {
      res.setHeader('Cache-Control', 'public, max-age=86400'); // 24 hours
    }
    // Set shorter cache for HTML files
    if (path.match(/\.html$/)) {
      res.setHeader('Cache-Control', 'public, max-age=300'); // 5 minutes
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

// Health check endpoint with detailed status
app.get('/health', (req, res) => {
  const healthStatus = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: config.NODE_ENV,
    database: global.MOCK_MODE ? 'mock' : 'connected',
    memory: {
      used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
      total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024)
    }
  };
  
  res.status(200).json(healthStatus);
});

// Enhanced error handling middleware
app.use((err, req, res, next) => {
  // Log error details
  logger.error('Unhandled application error', {
    error: err.message,
    stack: err.stack,
    url: req.url,
    method: req.method,
    ip: req.ip,
    userAgent: req.get('User-Agent')
  });

  // CSRF errors
  if (err.code === 'EBADCSRFTOKEN') {
    return res.status(403).json({
      error: 'Invalid CSRF token',
      code: 'CSRF_INVALID'
    });
  }

  // Validation errors
  if (err.name === 'ValidationError') {
    return res.status(400).json({
      error: 'Validation Error',
      details: err.details || err.message
    });
  }

  // Database errors
  if (err.code && err.code.startsWith('23')) { // PostgreSQL constraint errors
    return res.status(409).json({
      error: 'Database constraint violation',
      code: 'CONSTRAINT_VIOLATION'
    });
  }

  // Default error response
  const statusCode = err.statusCode || err.status || 500;
  res.status(statusCode).json({
    error: statusCode === 500 ? 'Internal server error' : err.message,
    code: err.code || 'INTERNAL_ERROR',
    ...(config.isDevelopment && { stack: err.stack })
  });
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
