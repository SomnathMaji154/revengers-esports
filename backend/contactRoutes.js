const express = require('express');
const db = require('./db'); // Import the database connection
const { isAuthenticated } = require('./auth'); // Import isAuthenticated middleware

const router = express.Router();

// Input validation middleware for contact form
function validateContactData(req, res, next) {
  const { name, email, whatsapp } = req.body;
  
  // Validate required fields
  if (!name || !email || !whatsapp) {
    return res.status(400).json({ error: 'Name, email, and WhatsApp number are required' });
  }
  
  // Sanitize inputs (remove any HTML tags)
  const sanitized_name = name.replace(/<[^>]*>/g, '').trim();
  const sanitized_email = email.replace(/<[^>]*>/g, '').trim();
  const sanitized_whatsapp = whatsapp.replace(/<[^>]*>/g, '').trim();
  
  if (sanitized_name.length === 0 || sanitized_email.length === 0 || sanitized_whatsapp.length === 0) {
    return res.status(400).json({ error: 'Name, email, and WhatsApp number cannot be empty' });
  }
  
  // Validate email format
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(sanitized_email)) {
    return res.status(400).json({ error: 'Please enter a valid email address' });
  }
  
  // Validate WhatsApp number (10-15 digits)
  const whatsappRegex = /^\d{10,15}$/;
  if (!whatsappRegex.test(sanitized_whatsapp.replace(/\D/g, ''))) {
    return res.status(400).json({ error: 'Please enter a valid WhatsApp number (10-15 digits)' });
  }
  
  req.body.name = sanitized_name;
  req.body.email = sanitized_email;
  req.body.whatsapp = sanitized_whatsapp;
  
  next();
}

// POST /api/contact - Submit contact form
router.post('/', validateContactData, (req, res) => {
  const { name, email, whatsapp } = req.body;
  const sql = `INSERT INTO contact_submissions (name, email, whatsapp) VALUES ($1, $2, $3)`;
  const params = [name, email, whatsapp];

  db.run(sql, params, function(err) {
    if (err) {
      res.status(500).json({ error: err.message });
      return console.error(err.message);
    }
    res.status(201).json({ id: this.lastID, message: 'Contact submission received successfully' });
  });
});

// GET /api/registered-users - View registered users (protected route)
router.get('/', isAuthenticated, (req, res) => {
  db.all("SELECT name, email, whatsapp FROM contact_submissions ORDER BY submission_date DESC", [], (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return console.error(err.message);
    }
    res.json(rows);
  });
});

module.exports = router;
