const express = require('express');
const path = require('path');
const sharp = require('sharp');
const db = require('./db');
const { isAuthenticated } = require('./auth');
const { configureMulter, uploadImageToCloudinary, deleteImageFromCloudinary } = require('./utils');

const router = express.Router();

// Configure multer for memory storage
const upload = configureMulter();

// GET /api/managers - Fetch all managers with better error handling
router.get('/', (req, res) => {
  db.all("SELECT id, name, role, imageUrl AS \"imageUrl\" FROM managers", [], (err, rows) => {
    if (err) {
      console.error('Database error fetching managers:', err);
      return res.status(500).json({ error: 'Failed to fetch managers. Please try again later.' });
    }
    res.json(rows || []);
  });
});

// Input validation middleware for manager data
function validateManagerData(req, res, next) {
  const { name, role } = req.body;
  
  // Validate required fields
  if (!name || !role) {
    return res.status(400).json({ error: 'Name and role are required' });
  }
  
  // Sanitize inputs (remove any HTML tags)
  const sanitized_name = name.replace(/<[^>]*>/g, '').trim();
  const sanitized_role = role.replace(/<[^>]*>/g, '').trim();
  
  if (sanitized_name.length === 0 || sanitized_role.length === 0) {
    return res.status(400).json({ error: 'Name and role cannot be empty' });
  }
  
  req.body.name = sanitized_name;
  req.body.role = sanitized_role;
  
  next();
}

// POST /api/managers - Add new manager
router.post('/', isAuthenticated, validateManagerData, upload.single('image'), async (req, res) => {
  const { name, role } = req.body;
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

      imageUrl = await uploadImageToCloudinary(processedImageBuffer, req.file.originalname, 'managers');
    } catch (error) {
      console.error('Error processing or uploading manager image:', error);
      return res.status(500).json({ error: 'Error processing or uploading image' });
    }
  }

  const sql = `INSERT INTO managers (name, role, imageUrl) VALUES ($1, $2, $3)`;
  const params = [name, role, imageUrl];
  
  db.run(sql, params, function(err) {
    if (err) {
      res.status(500).json({ error: err.message });
      return console.error(err.message);
    }
    res.status(201).json({ id: this.lastID, message: 'Manager added successfully' });
  });
});

// PUT /api/managers/:id/image - Update manager image
router.put('/:id/image', isAuthenticated, upload.single('image'), async (req, res) => {
  const { id } = req.params;
  let imageUrl = null;

  if (req.file) {
    try {
      // Get old image URL to delete from Cloudinary
      const oldManager = await new Promise((resolve, reject) => {
        db.get("SELECT imageUrl FROM managers WHERE id = $1", [id], (err, row) => {
          if (err) reject(err);
          else resolve(row);
        });
      });

      if (oldManager && oldManager.imageUrl) {
        await deleteImageFromCloudinary(oldManager.imageUrl, 'managers');
      }

      const processedImageBuffer = await sharp(req.file.buffer)
        .resize(300, 400, {
          fit: sharp.fit.cover,
          position: sharp.strategy.entropy
        })
        .webp({ quality: 80 })
        .toBuffer();

      imageUrl = await uploadImageToCloudinary(processedImageBuffer, req.file.originalname, 'managers');
    } catch (error) {
      console.error('Error processing or uploading manager image:', error);
      return res.status(500).json({ error: 'Error processing or uploading image' });
    }
  } else {
    return res.status(400).json({ error: 'No image file provided' });
  }

  const sql = 'UPDATE managers SET imageUrl = $1 WHERE id = $2';
  const params = [imageUrl, id];
  
  db.run(sql, params, function(err) {
    if (err) {
      res.status(500).json({ error: err.message });
      return console.error(err.message);
    }
    if (this.changes === 0) {
      return res.status(404).json({ error: 'Manager not found' });
    }
    res.json({ message: 'Manager image updated successfully', imageUrl: imageUrl });
  });
});

// DELETE /api/managers/:id - Delete manager
router.delete('/:id', isAuthenticated, async (req, res) => {
  const { id } = req.params;

  try {
      // Get image URL to delete from Cloudinary
    const manager = await new Promise((resolve, reject) => {
      db.get("SELECT imageUrl FROM managers WHERE id = $1", [id], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });

    if (manager && manager.imageUrl) {
      await deleteImageFromCloudinary(manager.imageUrl, 'managers');
    }

    db.run("DELETE FROM managers WHERE id = $1", [id], function(err) {
      if (err) {
        res.status(500).json({ error: err.message });
        return console.error(err.message);
      }
      if (this.changes === 0) {
        return res.status(404).json({ error: 'Manager not found' });
      }
      res.json({ message: 'Manager deleted successfully' });
    });
  } catch (error) {
    console.error('Error deleting manager or image:', error);
    res.status(500).json({ error: 'Error deleting manager or image' });
  }
});

module.exports = router;
