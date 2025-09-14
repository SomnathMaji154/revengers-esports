const express = require('express');
const path = require('path');
const sharp = require('sharp');
const db = require('./db');
const { isAuthenticated } = require('./auth');
const { configureMulter, uploadImageToCloudinary, deleteImageFromCloudinary } = require('./utils');

const router = express.Router();

// Configure multer for memory storage
const upload = configureMulter();

// GET /api/trophies - Fetch all trophies with better error handling
router.get('/', (req, res) => {
  db.all("SELECT id, name, year, imageUrl AS \"imageUrl\" FROM trophies ORDER BY year DESC LIMIT 20", [], (err, rows) => {
    if (err) {
      console.error('Database error fetching trophies:', err);
      return res.status(500).json({ error: 'Failed to fetch trophies. Please try again later.' });
    }
    res.json(rows || []);
  });
});

// Input validation middleware for trophy data
function validateTrophyData(req, res, next) {
  const { name, year } = req.body;
  
  // Validate required fields
  if (!name || !year) {
    return res.status(400).json({ error: 'Name and year are required' });
  }
  
  // Validate year (1900-2100)
  const trophyYear = parseInt(year);
  if (isNaN(trophyYear) || trophyYear < 1900 || trophyYear > 2100) {
    return res.status(400).json({ error: 'Year must be between 1900 and 2100' });
  }
  
  // Sanitize name (remove any HTML tags)
  const sanitized_name = name.replace(/<[^>]*>/g, '').trim();
  if (sanitized_name.length === 0) {
    return res.status(400).json({ error: 'Name cannot be empty' });
  }
  
  req.body.name = sanitized_name;
  req.body.year = trophyYear;
  
  next();
}

// POST /api/trophies - Add new trophy
router.post('/', isAuthenticated, validateTrophyData, upload.single('image'), async (req, res) => {
  const { name, year } = req.body;
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
        .resize(400, 300, {
          fit: sharp.fit.cover,
          position: sharp.strategy.entropy
        })
        .webp({ quality: 80 })
        .toBuffer();

      imageUrl = await uploadImageToCloudinary(processedImageBuffer, req.file.originalname, 'trophies');
    } catch (error) {
      console.error('Error processing or uploading trophy image:', error);
      return res.status(500).json({ error: 'Error processing or uploading image' });
    }
  }

  const sql = `INSERT INTO trophies (name, year, imageUrl) VALUES ($1, $2, $3)`;
  const params = [name, year, imageUrl];
  
  db.run(sql, params, function(err) {
    if (err) {
      res.status(500).json({ error: err.message });
      return console.error(err.message);
    }
    res.status(201).json({ id: this.lastID, message: 'Trophy added successfully' });
  });
});

// PUT /api/trophies/:id/image - Update trophy image
router.put('/:id/image', isAuthenticated, upload.single('image'), async (req, res) => {
  const { id } = req.params;
  let imageUrl = null;

  if (req.file) {
    try {
      // Get old image URL to delete from Cloudinary
      const oldTrophy = await new Promise((resolve, reject) => {
        db.get("SELECT imageUrl FROM trophies WHERE id = $1", [id], (err, row) => {
          if (err) reject(err);
          else resolve(row);
        });
      });

      if (oldTrophy && oldTrophy.imageUrl) {
        await deleteImageFromCloudinary(oldTrophy.imageUrl, 'trophies');
      }

      const processedImageBuffer = await sharp(req.file.buffer)
        .resize(400, 300, {
          fit: sharp.fit.cover,
          position: sharp.strategy.entropy
        })
        .webp({ quality: 80 })
        .toBuffer();

      imageUrl = await uploadImageToCloudinary(processedImageBuffer, req.file.originalname, 'trophies');
    } catch (error) {
      console.error('Error processing or uploading trophy image:', error);
      return res.status(500).json({ error: 'Error processing or uploading image' });
    }
  } else {
    return res.status(400).json({ error: 'No image file provided' });
  }

  const sql = 'UPDATE trophies SET imageUrl = $1 WHERE id = $2';
  const params = [imageUrl, id];
  
  db.run(sql, params, function(err) {
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

// DELETE /api/trophies/:id - Delete trophy
router.delete('/:id', isAuthenticated, async (req, res) => {
  const { id } = req.params;

  try {
      // Get image URL to delete from Cloudinary
    const trophy = await new Promise((resolve, reject) => {
      db.get("SELECT imageUrl FROM trophies WHERE id = $1", [id], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });

    if (trophy && trophy.imageUrl) {
      await deleteImageFromCloudinary(trophy.imageUrl, 'trophies');
    }

    db.run("DELETE FROM trophies WHERE id = $1", [id], function(err) {
      if (err) {
        res.status(500).json({ error: err.message });
        return console.error(err.message);
      }
      if (this.changes === 0) {
        return res.status(404).json({ error: 'Trophy not found' });
      }
      res.json({ message: 'Trophy deleted successfully' });
    });
  } catch (error) {
    console.error('Error deleting trophy or image:', error);
    res.status(500).json({ error: 'Error deleting trophy or image' });
  }
});

module.exports = router;
