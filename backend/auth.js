const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('./db'); // Import the database connection

const router = express.Router();

// Authentication middleware
function isAuthenticated(req, res, next) {
  if (req.session.isAdmin) {
    next();
  } else {
    res.status(401).json({ message: 'Unauthorized' });
  }
}

// Admin Login
router.post('/admin/login', (req, res) => {
  const { username, password } = req.body;
  db.get('SELECT * FROM admins WHERE username = $1', [username], async (err, admin) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    if (!admin) {
      res.status(400).json({ message: 'Invalid credentials' });
      return;
    }
    const match = await bcrypt.compare(password, admin.password);
    if (match) {
      req.session.isAdmin = true;
      res.json({ message: 'Logged in successfully' });
    } else {
      res.status(400).json({ message: 'Invalid credentials' });
    }
  });
});

// Admin Logout
router.post('/admin/logout', (req, res) => {
  req.session.destroy(err => {
    if (err) {
      res.status(500).json({ error: 'Could not log out' });
      return;
    }
    res.json({ message: 'Logged out successfully' });
  });
});

// Admin Status (check if logged in)
router.get('/admin/status', (req, res) => {
  res.json({ loggedIn: req.session.isAdmin || false });
});

module.exports = { router, isAuthenticated };
