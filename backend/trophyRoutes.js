const express = require('express');
const path = require('path');
const sharp = require('sharp');
const multer = require('multer');
const db = require('./db'); // Import the database connection
const { isAuthenticated } = require('./auth'); // Import isAuthenticated middleware
const { uploader } = require('./cloudinaryConfig'); // Import Cloudinary uploader

const router = express.Router();

// Configure multer for memory storage
const upload = multer({ 
  storage: multer.memoryStorage(), // Store files in memory as buffers
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

// Helper function to upload image to Cloudinary
async function uploadImageToCloudinary(fileBuffer, originalFilename, folder) {
  const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
  const publicId = `${folder}/processed-${uniqueSuffix}`;

  const uploadOptions = {
    public_id: publicId,
    format: 'webp',
    quality: 'auto',
    resource_type: 'image'
  };

  return new Promise((resolve, reject) => {
    const uploadStream = uploader.upload_stream(uploadOptions, (error, result) => {
      if (error) {
        reject(error);
      } else {
        resolve(result.secure_url);
      }
    });
    uploadStream.end(fileBuffer);
  });
}

// Helper function to delete image from Cloudinary
async function deleteImageFromCloudinary(imageUrl) {
  if (!imageUrl) return;

  try {
    const urlParts = new URL(imageUrl).pathname.split('/');
    const filename = urlParts.pop().split('.')[0]; // e.g., 'processed-123'
    const folder = urlParts.pop(); // 'trophies'
    const publicId = `${folder}/${filename}`;

    await new Promise((resolve, reject) => {
      uploader.destroy(publicId, (error, result) => {
        if (error) {
          reject(error);
        } else {
          console.log(`Deleted ${publicId} from Cloudinary.`);
          resolve(result);
        }
      });
    });
  } catch (error) {
    console.error('Error deleting image from Cloudinary:', error);
  }
}

// GET /api/trophies - Fetch all trophies (limited for performance)
router.get('/', (req, res) => {
  db.all("SELECT id, name, year, imageUrl AS \"imageUrl\" FROM trophies ORDER BY year DESC LIMIT 20", [], (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return console.error(err.message);
    }
    res.json(rows);
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

// POST /api/trophies - Add new trophy (protected route)
router.post('/', isAuthenticated, validateTrophyData, upload.single('image'), async (req, res) => {
  const { name, year } = req.body;
  let imageUrl = null;

  if (req.file) {
    // Validate file type
    if (!req.file.mimetype.startsWith('image/')) {
      return res.status(400).json({ error: 'Only image files are allowed' });
    }
    
    // Validate file size (5MB limit)
    if (req.file.size > 5 * 1024 * 1024) {
      return res.status(400).json({ error: 'File size must be less than 5MB' });
    }
    
    try {
      const processedImageBuffer = await sharp(req.file.buffer)
        .resize(400, 300, { // Standard size for trophies (landscape)
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

// PUT /api/trophies/:id/image - Update trophy image (protected route)
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
        await deleteImageFromCloudinary(oldTrophy.imageUrl);
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

// DELETE /api/trophies/:id - Delete trophy (protected route)
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
      await deleteImageFromCloudinary(trophy.imageUrl);
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
