const dotenv = require('dotenv');

// Load environment variables
dotenv.config();

/**
 * Application Configuration
 * Centralized configuration management with validation and defaults
 */
class Config {
  constructor() {
    this.validateRequired();
  }

  // Environment
  get NODE_ENV() {
    return process.env.NODE_ENV || 'development';
  }

  get isDevelopment() {
    return this.NODE_ENV === 'development';
  }

  get isProduction() {
    return this.NODE_ENV === 'production';
  }

  get isTest() {
    return this.NODE_ENV === 'test';
  }

  // Server Configuration
  get PORT() {
    return parseInt(process.env.PORT) || 3000;
  }

  get HOST() {
    return process.env.HOST || '0.0.0.0';
  }

  // Database Configuration
  get DATABASE_URL() {
    return process.env.DATABASE_URL;
  }

  get dbPoolConfig() {
    return {
      min: parseInt(process.env.DB_POOL_MIN) || 2,
      max: parseInt(process.env.DB_POOL_MAX) || 10,
      idleTimeoutMillis: parseInt(process.env.DB_POOL_IDLE_TIMEOUT_MS) || 30000,
      connectionTimeoutMillis: parseInt(process.env.DB_POOL_CONNECTION_TIMEOUT_MS) || 2000,
      ssl: this.isProduction ? { rejectUnauthorized: false } : false
    };
  }

  // Security Configuration
  get SESSION_SECRET() {
    return process.env.SESSION_SECRET;
  }

  get BCRYPT_ROUNDS() {
    return parseInt(process.env.BCRYPT_ROUNDS) || 12;
  }

  get COOKIE_MAX_AGE() {
    return parseInt(process.env.COOKIE_MAX_AGE_MS) || 24 * 60 * 60 * 1000; // 24 hours
  }

  // Cloudinary Configuration
  get cloudinaryConfig() {
    return {
      cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
      api_key: process.env.CLOUDINARY_API_KEY,
      api_secret: process.env.CLOUDINARY_API_SECRET,
      secure: true
    };
  }

  // File Upload Configuration
  get MAX_FILE_SIZE() {
    return (parseInt(process.env.MAX_FILE_SIZE_MB) || 5) * 1024 * 1024; // Convert to bytes
  }

  get ALLOWED_FILE_TYPES() {
    return (process.env.ALLOWED_FILE_TYPES || 'image/jpeg,image/png,image/webp,image/gif').split(',');
  }

  // Rate Limiting Configuration
  get rateLimitConfig() {
    return {
      windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 minutes
      max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100,
      standardHeaders: true,
      legacyHeaders: false
    };
  }

  get authRateLimitConfig() {
    return {
      windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 minutes
      max: parseInt(process.env.AUTH_RATE_LIMIT_MAX) || 5,
      standardHeaders: true,
      legacyHeaders: false
    };
  }

  // CORS Configuration
  get corsConfig() {
    return {
      origin: this.isProduction 
        ? process.env.PRODUCTION_URL || 'https://revengers-esports.onrender.com'
        : true, // Allow all origins in development
      credentials: true,
      optionsSuccessStatus: 200
    };
  }

  // Session Configuration
  get sessionConfig() {
    return {
      secret: this.SESSION_SECRET,
      resave: false,
      saveUninitialized: false,
      cookie: {
        secure: this.isProduction,
        httpOnly: true,
        sameSite: this.isProduction ? 'strict' : 'lax',
        maxAge: this.COOKIE_MAX_AGE,
        path: '/'
      },
      name: 'revengers.sid',
      rolling: true
    };
  }

  // Logging Configuration
  get LOG_LEVEL() {
    return process.env.LOG_LEVEL || (this.isDevelopment ? 'debug' : 'info');
  }

  get LOG_FILE() {
    return process.env.LOG_FILE || 'logs/app.log';
  }

  // Admin Configuration (Development only)
  get defaultAdmin() {
    if (!this.isDevelopment) {
      return null;
    }
    return {
      username: process.env.DEFAULT_ADMIN_USERNAME || 'admin',
      password: process.env.DEFAULT_ADMIN_PASSWORD || 'adminpassword'
    };
  }

  // Performance Configuration
  get COMPRESSION_LEVEL() {
    return parseInt(process.env.COMPRESSION_LEVEL) || 6;
  }

  get CACHE_MAX_AGE() {
    return parseInt(process.env.CACHE_MAX_AGE) || 3600; // 1 hour
  }

  // Monitoring Configuration
  get SENTRY_DSN() {
    return process.env.SENTRY_DSN;
  }

  /**
   * Validate required environment variables
   */
  validateRequired() {
    const required = ['SESSION_SECRET'];
    
    // Only require database URL if not in test mode
    if (!this.isTest) {
      required.push('DATABASE_URL');
    }

    // Require Cloudinary config in production
    if (this.isProduction) {
      required.push('CLOUDINARY_CLOUD_NAME', 'CLOUDINARY_API_KEY', 'CLOUDINARY_API_SECRET');
    }

    const missing = required.filter(key => !process.env[key]);
    
    if (missing.length > 0) {
      console.error('Missing required environment variables:', missing.join(', '));
      console.error('Please check your .env file and ensure all required variables are set.');
      console.error('See .env.example for reference.');
      
      if (this.isProduction) {
        process.exit(1);
      } else {
        console.warn('Continuing in development mode with fallback values...');
      }
    }
  }

  /**
   * Get all configuration for debugging (sensitive values hidden)
   */
  getDebugInfo() {
    return {
      NODE_ENV: this.NODE_ENV,
      PORT: this.PORT,
      HOST: this.HOST,
      isDevelopment: this.isDevelopment,
      isProduction: this.isProduction,
      isTest: this.isTest,
      hasDatabase: !!this.DATABASE_URL,
      hasCloudinary: !!(this.cloudinaryConfig.cloud_name && this.cloudinaryConfig.api_key),
      hasSessionSecret: !!this.SESSION_SECRET,
      maxFileSize: this.MAX_FILE_SIZE,
      allowedFileTypes: this.ALLOWED_FILE_TYPES,
      logLevel: this.LOG_LEVEL
    };
  }
}

module.exports = new Config();