const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('./db');
const config = require('./config');
const logger = require('./logger');
const { validationRules, handleValidationErrors } = require('./validators');

const router = express.Router();

// Enhanced authentication middleware with session validation
function isAuthenticated(req, res, next) {
  // Check if session store is available
  if (!req.session) {
    logger.error('Session store unavailable', {
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      path: req.path
    });
    return res.status(503).json({ 
      error: 'Service temporarily unavailable',
      code: 'SERVICE_UNAVAILABLE'
    });
  }
  
  if (req.session && req.session.isAdmin) {
    // Set security headers for admin routes
    res.set({
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0'
    });
    
    // Log admin action
    logger.info('Admin action authenticated', {
      sessionId: req.session.id,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      path: req.path,
      method: req.method
    });
    
    next();
  } else {
    // Log unauthorized access attempt
    logger.securityLog('Unauthorized access attempt', {
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      path: req.path,
      hasSession: !!req.session,
      sessionData: req.session ? { isAdmin: req.session.isAdmin } : null
    });
    
    // Destroy invalid session
    if (req.session) {
      req.session.destroy((err) => {
        if (err) {
          logger.error('Session destruction error', { error: err.message });
        }
      });
    }
    
    res.status(401).json({ 
      error: 'Unauthorized: Invalid or expired session',
      code: 'SESSION_EXPIRED'
    });
  }
}

// Enhanced admin login with comprehensive security
router.post('/admin/login', validationRules.adminLogin, handleValidationErrors, async (req, res) => {
  const { username, password } = req.body;
  const clientInfo = {
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    timestamp: new Date().toISOString()
  };
  
  logger.info('Admin login attempt', { username, ...clientInfo });
  
  try {
    // Add delay to prevent timing attacks
    const loginStart = Date.now();
    
    const admin = await new Promise((resolve, reject) => {
      db.get('SELECT * FROM admins WHERE username = $1', [username], (err, admin) => {
        if (err) reject(err);
        else resolve(admin);
      });
    });
    
    // Ensure minimum response time to prevent timing attacks
    const minResponseTime = 100;
    const elapsed = Date.now() - loginStart;
    if (elapsed < minResponseTime) {
      await new Promise(resolve => setTimeout(resolve, minResponseTime - elapsed));
    }
    
    if (!admin) {
      logger.securityLog('Login attempt with invalid username', {
        username,
        ...clientInfo
      });
      return res.status(401).json({ 
        error: 'Invalid credentials',
        code: 'INVALID_CREDENTIALS'
      });
    }
    
    // Verify password
    let passwordValid = false;
    if (global.MOCK_MODE) {
      passwordValid = password === admin.password;
    } else {
      passwordValid = await bcrypt.compare(password, admin.password);
    }
    
    if (!passwordValid) {
      logger.securityLog('Login attempt with invalid password', {
        username,
        ...clientInfo
      });
      return res.status(401).json({ 
        error: 'Invalid credentials',
        code: 'INVALID_CREDENTIALS'
      });
    }
    
    // Successful login
    if (!req.session) {
      logger.error('Session unavailable during login', { username, ...clientInfo });
      return res.status(503).json({ 
        error: 'Session service unavailable',
        code: 'SESSION_UNAVAILABLE'
      });
    }
    
    req.session.isAdmin = true;
    req.session.adminId = admin.id;
    req.session.loginTime = new Date().toISOString();
    
    // Update last login time (if not in mock mode)
    if (!global.MOCK_MODE) {
      db.run('UPDATE admins SET last_login = CURRENT_TIMESTAMP WHERE id = $1', [admin.id], (err) => {
        if (err) {
          logger.error('Failed to update last login time', { error: err.message, adminId: admin.id });
        }
      });
    }
    
    logger.info('Admin login successful', {
      username,
      adminId: admin.id,
      sessionId: req.session.id,
      ...clientInfo
    });
    
    res.json({ 
      message: 'Logged in successfully',
      admin: {
        id: admin.id,
        username: admin.username
      }
    });
    
  } catch (error) {
    logger.error('Admin login error', {
      error: error.message,
      username,
      ...clientInfo
    });
    res.status(500).json({ 
      error: 'Authentication service error',
      code: 'AUTH_SERVICE_ERROR'
    });
  }
});

// Enhanced admin logout
router.post('/admin/logout', (req, res) => {
  const sessionInfo = {
    sessionId: req.session?.id,
    adminId: req.session?.adminId,
    ip: req.ip,
    userAgent: req.get('User-Agent')
  };
  
  if (!req.session) {
    logger.warn('Logout attempt with no session', sessionInfo);
    return res.status(503).json({ 
      error: 'Session service unavailable',
      code: 'SESSION_UNAVAILABLE'
    });
  }
  
  logger.info('Admin logout initiated', sessionInfo);
  
  req.session.destroy(err => {
    if (err) {
      logger.error('Logout error', { ...sessionInfo, error: err.message });
      return res.status(500).json({ 
        error: 'Could not log out',
        code: 'LOGOUT_ERROR'
      });
    }
    
    logger.info('Admin logout successful', sessionInfo);
    res.clearCookie('revengers.sid'); // Clear session cookie
    res.json({ 
      message: 'Logged out successfully',
      code: 'LOGOUT_SUCCESS'
    });
  });
});

// Enhanced admin status check
router.get('/admin/status', (req, res) => {
  const isLoggedIn = !!(req.session && req.session.isAdmin);
  const sessionInfo = {
    loggedIn: isLoggedIn,
    sessionId: req.session?.id,
    adminId: req.session?.adminId,
    loginTime: req.session?.loginTime
  };
  
  if (isLoggedIn) {
    logger.debug('Admin status check - authenticated', {
      sessionId: req.session.id,
      adminId: req.session.adminId,
      ip: req.ip
    });
  }
  
  res.json(sessionInfo);
});

module.exports = { router, isAuthenticated };
