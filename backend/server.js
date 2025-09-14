const express = require('express');
const path = require('path');
const session = require('express-session');
const connectPgSimple = require('connect-pg-simple');
const helmet = require('helmet');
const morgan = require('morgan');
const compression = require('compression');
const cors = require('cors');

// Import modularized components
const { pool } = require('./db');
const db = require('./db');
const { router: authRoutes, isAuthenticated } = require('./auth');
const playerRoutes = require('./playerRoutes');
const managerRoutes = require('./managerRoutes');
const trophyRoutes = require('./trophyRoutes');
const contactRoutes = require('./contactRoutes');

const app = express();
const PORT = process.env.PORT || 3000;
const NODE_ENV = process.env.NODE_ENV || 'development';

// Trust the first proxy
app.set('trust proxy', 1);

// Middleware
app.use(compression());
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "https://cdnjs.cloudflare.com"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://cdnjs.cloudflare.com"],
      imgSrc: ["'self'", "data:", "https://revengers-esports.onrender.com", "https://res.cloudinary.com", "https://cloudinary.com"],
      connectSrc: ["'self'"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"],
    },
  },
}));
app.use(morgan('tiny'));

// Configure CORS
const corsOptions = {
  origin: NODE_ENV === 'production' ? 'https://revengers-esports.onrender.com' : '*',
  credentials: true,
};
app.use(cors(corsOptions));

const rateLimit = require('express-rate-limit');

// General API rate limiter
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: {
    error: 'Too many requests from this IP, please try again later.'
  },
  standardHeaders: true,
 legacyHeaders: false
});

// Strict rate limiter for authentication endpoints
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: {
    error: 'Too many authentication attempts, please try again later.'
  },
  standardHeaders: true,
  legacyHeaders: false
});

app.use('/api/', generalLimiter);
app.use('/api/admin/login', authLimiter);

app.use(express.json({ limit: '10mb' }));

// Session middleware with PostgreSQL store - with fallback
let sessionConfig = {
  secret: process.env.SESSION_SECRET || 'super_secret_dev_key_change_in_production',
  resave: false,
 saveUninitialized: false,
  cookie: { 
    secure: NODE_ENV === 'production',
    httpOnly: true,
    sameSite: NODE_ENV === 'production' ? 'strict' : 'lax',
    maxAge: 24 * 60 * 60 * 1000,
    path: '/'
  },
  name: 'revengers.sid',
  rolling: true
};

// Try to use PostgreSQL session store, fallback to memory store if DB unavailable
try {
  const pgSession = connectPgSimple(session);
  sessionConfig.store = new pgSession({
    pool: pool,
    tableName: 'sessions',
    createTableIfMissing: true
  });
} catch (err) {
  console.warn('Warning: Could not initialize PostgreSQL session store. Using memory store.');
  // Explicitly set memory store as fallback
  sessionConfig.store = new session.MemoryStore();
}

app.use(session(sessionConfig));

// Serve static frontend files from root and public directories
app.use(express.static(path.join(__dirname, '../')));
app.use(express.static(path.join(__dirname, '../public')));


// API Routes
app.use('/api', authRoutes);
app.use('/api/players', playerRoutes);
app.use('/api/managers', managerRoutes);
app.use('/api/trophies', trophyRoutes);
app.use('/api/contact', contactRoutes);
app.use('/api/registered-users', contactRoutes);

// Health check route for Render
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Centralized Error Handling Middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(err.statusCode || 500).json({
    message: err.message || 'An unexpected error occurred.',
    error: NODE_ENV === 'development' ? err : {},
  });
});

const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT} in ${NODE_ENV} mode`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  server.close(() => {
    console.log('Process terminated');
  });
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully');
  server.close(() => {
    console.log('Process terminated');
  });
});
