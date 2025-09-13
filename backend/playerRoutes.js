const express = require('express');
const path = require('path');
const sharp = require('sharp');
const multer = require('multer');
const db = require('./db'); // Import the database connection
const { isAuthenticated } = require('./auth'); // Import isAuthenticated middleware

const router = express.Router();

const storage = multer.memoryStorage();
const upload = multer({ 
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed!'), false);
    }
  }
});

// GET /api/players - Fetch all players
router.get('/', (req, res) => {
  db.all("SELECT id, name, jerseyNumber, imageUrl, stars, joined_date FROM players ORDER BY joined_date DESC", [], (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return console.error(err.message);
    }
    res.json(rows);
  });
});

// POST /api/players - Add new player (handles both join page and admin)
router.post('/', isAuthenticated, upload.single('image'), async (req, res) => { // Protected route
  const { name, jerseyNumber, stars } = req.body;
  let imageUrl = null;

  if (req.file) {
    try {
      const processedImage = await sharp(req.file.buffer)
        .resize(300, 400, { // Standard size for player cards
          fit: sharp.fit.cover,
          position: sharp.strategy.entropy
        })
        .webp({ quality: 80 })
        .toBuffer();

      const base64Image = processedImage.toString('base64');
      imageUrl = `data:image/webp;base64,${base64Image}`;
    } catch (error) {
      console.error('Error processing player image:', error);
      return res.status(500).json({ error: 'Error processing image' });
    }
  }

  const sql = `INSERT INTO players (name, jerseyNumber, imageUrl, imageData, stars) VALUES ($1, $2, $3, $4, $5)`;
  const imageData = imageUrl ? imageUrl.split(',')[1] : null;
  const params = [name, jerseyNumber, imageUrl, imageData, stars];
  
  db.run(sql, params, function(err) {
    if (err) {
      res.status(500).json({ error: err.message });
      return console.error(err.message);
    }
    res.status(201).json({ id: this.lastID, message: 'Player added successfully' });
  });
});

// PUT /api/players/:id/image - Update player image
router.put('/:id/image', isAuthenticated, upload.single('image'), async (req, res) => {
  const { id } = req.params;
  let imageUrl = null;

  if (req.file) {
    try {
      const processedImage = await sharp(req.file.buffer)
        .resize(300, 400, {
          fit: sharp.fit.cover,
          position: sharp.strategy.entropy
        })
        .webp({ quality: 80 })
        .toBuffer();

      const base64Image = processedImage.toString('base64');
      imageUrl = `data:image/webp;base64,${base64Image}`;
    } catch (error) {
      console.error('Error processing player image:', error);
      return res.status(500).json({ error: 'Error processing image' });
    }
  } else {
    return res.status(400).json({ error: 'No image file provided' });
  }

  const sql = 'UPDATE players SET imageUrl = $1, imageData = $2 WHERE id = $3';
  const imageData = imageUrl ? imageUrl.split(',')[1] : null;
  const params = [imageUrl, imageData, id];
  
  db.run(sql, params, function(err) {
    if (err) {
      res.status(500).json({ error: err.message });
      return console.error(err.message);
    }
    if (this.changes === 0) {
      return res.status(404).json({ error: 'Player not found' });
    }
    res.json({ message: 'Player image updated successfully', imageUrl: imageUrl });
  });
});

// DELETE /api/players/:id - Delete any player (admin)
router.delete('/:id', isAuthenticated, (req, res) => { // Protected route
  const { id } = req.params;
  db.run("DELETE FROM players WHERE id = ?", [id], function(err) {
    if (err) {
      res.status(500).json({ error: err.message });
      return console.error(err.message);
    }
    if (this.changes === 0) {
      return res.status(404).json({ error: 'Player not found' });
    }
    res.json({ message: 'Player deleted successfully' });
  });
});

module.exports = router;
