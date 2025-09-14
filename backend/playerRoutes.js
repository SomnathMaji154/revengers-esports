const express = require('express');
const path = require('path');
const sharp = require('sharp');
const db = require('./db');
const { isAuthenticated } = require('./auth');
const { configureMulter, uploadImageToCloudinary, deleteImageFromCloudinary } = require('./utils');

const router = express.Router();

// Configure multer for memory storage
const upload = configureMulter();

// GET /api/players - Fetch all players with better error handling
router.get('/', (req, res) => {
  db.all("SELECT id, name, jerseyNumber, imageUrl AS \"imageUrl\", stars, joined_date FROM players ORDER BY joined_date DESC LIMIT 20", [], (err, rows) => {
    if (err) {
      console.error('Database error fetching players:', err);
      return res.status(500).json({ error: 'Failed to fetch players. Please try again later.' });
    }
    res.json(rows || []);
  });
});

// Input validation middleware for player data
function validatePlayerData(req, res, next) {
  const { name, jerseyNumber, stars } = req.body;
  
  // Validate required fields
  if (!name || !jerseyNumber || !stars) {
    return res.status(400).json({ error: 'Name, jersey number, and stars are required' });
  }
  
  // Validate jersey number (1-99)
  const jerseyNum = parseInt(jerseyNumber);
  if (isNaN(jerseyNum) || jerseyNum < 1 || jerseyNum > 99) {
    return res.status(400).json({ error: 'Jersey number must be between 1 and 99' });
 }
  
  // Validate stars (1-5)
  const starRating = parseInt(stars);
  if (isNaN(starRating) || starRating < 1 || starRating > 5) {
    return res.status(400).json({ error: 'Stars rating must be between 1 and 5' });
  }
  
  // Sanitize name (remove any HTML tags and limit length)
  const sanitized_name = name.replace(/<[^>]*>/g, '').trim();
  if (sanitized_name.length === 0) {
    return res.status(400).json({ error: 'Name cannot be empty' });
  }
  if (sanitized_name.length > 100) {
    return res.status(400).json({ error: 'Name must be less than 100 characters' });
  }
  
  req.body.name = sanitized_name;
  req.body.jerseyNumber = jerseyNum;
  req.body.stars = starRating;
  
  next();
}

// POST /api/players - Add new player
router.post('/', isAuthenticated, validatePlayerData, upload.single('image'), async (req, res) => {
  const { name, jerseyNumber, stars } = req.body;
  let imageUrl = null;

  if (req.file) {
    // Validate file type
    if (!req.file.mimetype.startsWith('image/')) {
      return res.status(400).json({ error: 'Only image files are allowed' });
    }
    
    // Validate file size
    if (req.file.size > 5 * 1024 * 1024) {
      return res.status(400).json({ error: 'File size must be less than 5MB' });
    }
    
    try {
      const processedImageBuffer = await sharp(req.file.buffer)
        .resize(300, 400, {
          fit: sharp.fit.cover,
          position: sharp.strategy.entropy
        })
        .webp({ quality: 80 })
        .toBuffer();

      imageUrl = await uploadImageToCloudinary(processedImageBuffer, req.file.originalname, 'players');
    } catch (error) {
      console.error('Error processing or uploading player image:', error);
      return res.status(500).json({ error: 'Error processing or uploading image' });
    }
  }

  const sql = `INSERT INTO players (name, jerseyNumber, imageUrl, stars) VALUES ($1, $2, $3, $4)`;
  const params = [name, jerseyNumber, imageUrl, stars];
  
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
      // Get old image URL to delete from Cloudinary
      const oldPlayer = await new Promise((resolve, reject) => {
        db.get("SELECT imageUrl FROM players WHERE id = $1", [id], (err, row) => {
          if (err) reject(err);
          else resolve(row);
        });
      });

      if (oldPlayer && oldPlayer.imageUrl) {
        await deleteImageFromCloudinary(oldPlayer.imageUrl, 'players');
      }

      const processedImageBuffer = await sharp(req.file.buffer)
        .resize(300, 400, {
          fit: sharp.fit.cover,
          position: sharp.strategy.entropy
        })
        .webp({ quality: 80 })
        .toBuffer();

      imageUrl = await uploadImageToCloudinary(processedImageBuffer, req.file.originalname, 'players');
    } catch (error) {
      console.error('Error processing or uploading player image:', error);
      return res.status(500).json({ error: 'Error processing or uploading image' });
    }
  } else {
    return res.status(400).json({ error: 'No image file provided' });
  }

  const sql = 'UPDATE players SET imageUrl = $1 WHERE id = $2';
  const params = [imageUrl, id];
  
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

// DELETE /api/players/:id - Delete any player
router.delete('/:id', isAuthenticated, async (req, res) => {
  const { id } = req.params;

  try {
      // Get image URL to delete from Cloudinary
    const player = await new Promise((resolve, reject) => {
      db.get("SELECT imageUrl FROM players WHERE id = $1", [id], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });

    if (player && player.imageUrl) {
      await deleteImageFromCloudinary(player.imageUrl, 'players');
    }

    db.run("DELETE FROM players WHERE id = $1", [id], function(err) {
      if (err) {
        res.status(500).json({ error: err.message });
        return console.error(err.message);
      }
      if (this.changes === 0) {
        return res.status(404).json({ error: 'Player not found' });
      }
      res.json({ message: 'Player deleted successfully' });
    });
  } catch (error) {
    console.error('Error deleting player or image:', error);
    res.status(500).json({ error: 'Error deleting player or image' });
  }
});

module.exports = router;
