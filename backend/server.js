const express = require('express');
const path = require('path');
const session = require('express-session');
const helmet = require('helmet');
const morgan = require('morgan');
const compression = require('compression');
const cors = require('cors');
const fs = require('fs'); // Re-add fs module

// Import modularized components
const db = require('./db'); // Database connection and initialization
const { router: authRoutes, isAuthenticated } = require('./auth'); // Auth routes and middleware
const playerRoutes = require('./playerRoutes'); // Player API routes
const managerRoutes = require('./managerRoutes'); // Manager API routes
const trophyRoutes = require('./trophyRoutes'); // Trophy API routes
const contactRoutes = require('./contactRoutes'); // Contact API routes

const app = express();
const PORT = process.env.PORT || 3000;
const NODE_ENV = process.env.NODE_ENV || 'development';

// Middleware
app.use(compression()); // Gzip/Brotli compression
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "https://cdnjs.cloudflare.com"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://cdnjs.cloudflare.com"],
      imgSrc: ["'self'", "data:"],
      connectSrc: ["'self'"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"],
    },
  },
})); // Security headers
app.use(morgan('tiny')); // HTTP request logging

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
  console.log('Created uploads directory:', uploadsDir);
}

// Configure CORS for production
const corsOptions = {
  origin: NODE_ENV === 'production' ? 'https://revengers-esports.onrender.com' : '*',
  credentials: true,
};
app.use(cors(corsOptions));
app.use(express.json());

// Session middleware
app.use(session({
  secret: process.env.SESSION_SECRET || 'super_secret_dev_key',
  resave: false,
  saveUninitialized: true,
  cookie: { 
    secure: NODE_ENV === 'production',
    httpOnly: true,
    sameSite: 'lax',
  }
}));

// Serve static frontend files
app.use(express.static(path.join(__dirname, '../')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// API Routes
app.use('/api', authRoutes); // Authentication routes
app.use('/api/players', playerRoutes); // Player routes
app.use('/api/managers', managerRoutes); // Manager routes
app.use('/api/trophies', trophyRoutes); // Trophy routes
app.use('/api/contact', contactRoutes); // Contact routes (for submission)
app.use('/api/registered-users', contactRoutes); // Contact routes (for viewing registered users)

// Centralized Error Handling Middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(err.statusCode || 500).json({
    message: err.message || 'An unexpected error occurred.',
    error: NODE_ENV === 'development' ? err : {},
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT} in ${NODE_ENV} mode`);
});
