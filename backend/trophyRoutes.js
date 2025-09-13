const express = require('express');
const path = require('path');
const sharp = require('sharp');
const multer = require('multer');
const db = require('./db'); // Import the database connection
const { isAuthenticated } = require('./auth'); // Import isAuthenticated middleware
const { bucket } = require('./firebaseAdmin'); // Import Firebase Storage bucket

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

// Helper function to upload image to Firebase Storage
async function uploadImageToFirebase(fileBuffer, originalFilename, folder) {
  const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
  const filename = `${folder}/processed-${uniqueSuffix}.webp`;
  const file = bucket.file(filename);

  await file.save(fileBuffer, {
    metadata: {
      contentType: 'image/webp'
    }
  });

  // Make the file publicly accessible
  await file.makePublic();

  return `https://storage.googleapis.com/${bucket.name}/${filename}`;
}

// Helper function to delete image from Firebase Storage
async function deleteImageFromFirebase(imageUrl) {
  if (!imageUrl) return;

  try {
    const url = new URL(imageUrl);
    const filename = url.pathname.substring(url.pathname.indexOf('/', 1) + 1); // Extract path after bucket name
    const file = bucket.file(filename);
    await file.delete();
    console.log(`Deleted ${filename} from Firebase Storage.`);
  } catch (error) {
    console.error('Error deleting image from Firebase Storage:', error);
  }
}

// GET /api/trophies - Fetch all trophies
router.get('/', (req, res) => {
  db.all("SELECT id, name, year, imageUrl FROM trophies", [], (err, rows) => {
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
      const processedImageBuffer = await sharp(req.file.buffer)
        .resize(400, 300, { // Standard size for trophies (landscape)
          fit: sharp.fit.cover,
          position: sharp.strategy.entropy
        })
        .webp({ quality: 80 })
        .toBuffer();

      imageUrl = await uploadImageToFirebase(processedImageBuffer, req.file.originalname, 'trophies');
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
      // Get old image URL to delete from Firebase
      const oldTrophy = await new Promise((resolve, reject) => {
        db.get("SELECT imageUrl FROM trophies WHERE id = $1", [id], (err, row) => {
          if (err) reject(err);
          else resolve(row);
        });
      });

      if (oldTrophy && oldTrophy.imageUrl) {
        await deleteImageFromFirebase(oldTrophy.imageUrl);
      }

      const processedImageBuffer = await sharp(req.file.buffer)
        .resize(400, 300, {
          fit: sharp.fit.cover,
          position: sharp.strategy.entropy
        })
        .webp({ quality: 80 })
        .toBuffer();

      imageUrl = await uploadImageToFirebase(processedImageBuffer, req.file.originalname, 'trophies');
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
    // Get image URL to delete from Firebase
    const trophy = await new Promise((resolve, reject) => {
      db.get("SELECT imageUrl FROM trophies WHERE id = $1", [id], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });

    if (trophy && trophy.imageUrl) {
      await deleteImageFromFirebase(trophy.imageUrl);
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
