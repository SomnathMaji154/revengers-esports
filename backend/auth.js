const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('./db');

const router = express.Router();

// Authentication middleware with better error handling
function isAuthenticated(req, res, next) {
  // Check if session store is available
  if (!req.session) {
    return res.status(503).json({ 
      message: 'Service temporarily unavailable',
      code: 'SERVICE_UNAVAILABLE'
    });
  }
  
  if (req.session && req.session.isAdmin) {
    res.set({
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0'
    });
    next();
  } else {
    if (req.session) {
      req.session.destroy((err) => {
        if (err) {
          console.error('Session destruction error:', err);
        }
      });
    }
    res.status(401).json({ 
      message: 'Unauthorized: Invalid or expired session',
      code: 'SESSION_EXPIRED'
    });
  }
}

// Admin Login with better error handling
router.post('/admin/login', (req, res) => {
  const { username, password } = req.body;
  
  // Validate input
  if (!username || !password) {
    return res.status(400).json({ message: 'Username and password are required' });
  }
  
  db.get('SELECT * FROM admins WHERE username = $1', [username], async (err, admin) => {
    if (err) {
      console.error('Database error during login:', err);
      return res.status(500).json({ error: 'Authentication service temporarily unavailable' });
    }
    if (!admin) {
      // Add delay to prevent timing attacks
      await new Promise(resolve => setTimeout(resolve, 100));
      return res.status(400).json({ message: 'Invalid credentials' });
    }
    try {
      // Check if we're in mock mode
      if (global.MOCK_MODE) {
        // In mock mode, compare plain text password
        if (password === admin.password) {
          // Ensure session exists before setting properties
          if (req.session) {
            req.session.isAdmin = true;
            res.json({ message: 'Logged in successfully' });
          } else {
            res.status(503).json({ error: 'Session service unavailable' });
          }
        } else {
          res.status(400).json({ message: 'Invalid credentials' });
        }
      } else {
        // In real mode, use bcrypt
        const match = await bcrypt.compare(password, admin.password);
        if (match) {
          // Ensure session exists before setting properties
          if (req.session) {
            req.session.isAdmin = true;
            res.json({ message: 'Logged in successfully' });
          } else {
            res.status(503).json({ error: 'Session service unavailable' });
          }
        } else {
          res.status(400).json({ message: 'Invalid credentials' });
        }
      }
    } catch (bcryptErr) {
      console.error('Bcrypt error:', bcryptErr);
      res.status(500).json({ error: 'Authentication service error' });
    }
 });
});

// Admin Logout
router.post('/admin/logout', (req, res) => {
  if (!req.session) {
    return res.status(503).json({ error: 'Session service unavailable' });
  }
  
  req.session.destroy(err => {
    if (err) {
      console.error('Logout error:', err);
      return res.status(500).json({ error: 'Could not log out' });
    }
    res.json({ message: 'Logged out successfully' });
  });
});

// Admin Status (check if logged in)
router.get('/admin/status', (req, res) => {
  res.json({ loggedIn: (req.session && req.session.isAdmin) || false });
});

module.exports = { router, isAuthenticated };
