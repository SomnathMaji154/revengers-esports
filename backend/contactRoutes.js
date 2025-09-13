const express = require('express');
const db = require('./db'); // Import the database connection
const { isAuthenticated } = require('./auth'); // Import isAuthenticated middleware

const router = express.Router();

// POST /api/contact - Submit contact form
router.post('/', (req, res) => {
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
