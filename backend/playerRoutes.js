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
    const folder = urlParts.pop(); // 'players'
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

// GET /api/players - Fetch all players (limited for performance)
router.get('/', (req, res) => {
  db.all("SELECT id, name, jerseyNumber, imageUrl AS \"imageUrl\", stars, joined_date FROM players ORDER BY joined_date DESC LIMIT 20", [], (err, rows) => {
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
      const processedImageBuffer = await sharp(req.file.buffer)
        .resize(300, 400, { // Standard size for player cards
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
        await deleteImageFromCloudinary(oldPlayer.imageUrl);
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

// DELETE /api/players/:id - Delete any player (admin)
router.delete('/:id', isAuthenticated, async (req, res) => { // Protected route
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
      await deleteImageFromCloudinary(player.imageUrl);
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
