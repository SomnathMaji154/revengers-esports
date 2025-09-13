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

// GET /api/trophies - Fetch all trophies
router.get('/', (req, res) => {
  db.all("SELECT * FROM trophies", [], (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return console.error(err.message);
    }
    res.json(rows);
  });
});

// POST /api/trophies - Add new trophy (protected route)
router.post('/', isAuthenticated, upload.single('image'), async (req, res) => {
  const { name, year } = req.body;
  let imageUrl = null;

  if (req.file) {
    try {
      const processedImage = await sharp(req.file.buffer)
        .resize(400, 300, { // Standard size for trophies (landscape)
          fit: sharp.fit.cover,
          position: sharp.strategy.entropy
        })
        .webp({ quality: 80 })
        .toBuffer();

      const base64Image = processedImage.toString('base64');
      imageUrl = `data:image/webp;base64,${base64Image}`;
    } catch (error) {
      console.error('Error processing trophy image:', error);
      return res.status(500).json({ error: 'Error processing image' });
    }
  }

  const imageData = imageUrl ? imageUrl.split(',')[1] : null;
  db.run('INSERT INTO trophies (name, year, imageUrl, imageData) VALUES ($1, $2, $3, $4)', [name, year, imageUrl, imageData], function(err) {
    if (err) {
      res.status(500).json({ error: err.message });
      return console.error(err.message);
    }
    res.status(201).json({ id: this.lastID, message: 'Trophy added successfully' });
  });
});

// PUT /api/trophies/:id/image - Update trophy image (protected route)
router.put('/:id/image', isAuthenticated, upload.single('image'), async (req, res) => {
  const { id } = req.params;
  let imageUrl = null;

  if (req.file) {
    try {
      const processedImage = await sharp(req.file.buffer)
        .resize(400, 300, {
          fit: sharp.fit.cover,
          position: sharp.strategy.entropy
        })
        .webp({ quality: 80 })
        .toBuffer();

      const base64Image = processedImage.toString('base64');
      imageUrl = `data:image/webp;base64,${base64Image}`;
    } catch (error) {
      console.error('Error processing trophy image:', error);
      return res.status(500).json({ error: 'Error processing image' });
    }
  } else {
    return res.status(400).json({ error: 'No image file provided' });
  }

  const imageData = imageUrl ? imageUrl.split(',')[1] : null;
  db.run('UPDATE trophies SET imageUrl = $1, imageData = $2 WHERE id = $3', [imageUrl, imageData, id], function(err) {
    if (err) {
      res.status(500).json({ error: err.message });
      return console.error(err.message);
    }
    if (this.changes === 0) {
      return res.status(404).json({ error: 'Trophy not found' });
    }
    res.json({ message: 'Trophy image updated successfully', imageUrl: imageUrl });
  });
});

// DELETE /api/trophies/:id - Delete trophy (protected route)
router.delete('/:id', isAuthenticated, (req, res) => {
  db.run("DELETE FROM trophies WHERE id = ?", [req.params.id], function(err) {
    if (err) {
      res.status(500).json({ error: err.message });
      return console.error(err.message);
    }
    res.json({ message: 'Trophy deleted successfully' });
  });
});

module.exports = router;
