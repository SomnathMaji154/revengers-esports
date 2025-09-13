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
    const folder = urlParts.pop(); // 'managers'
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

// GET /api/managers - Fetch all managers
router.get('/', (req, res) => {
  db.all("SELECT id, name, role, imageUrl AS \"imageUrl\" FROM managers", [], (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return console.error(err.message);
    }
    res.json(rows);
  });
});

// POST /api/managers - Add new manager (protected route)
router.post('/', isAuthenticated, upload.single('image'), async (req, res) => {
  const { name, role } = req.body;
  let imageUrl = null;

  if (req.file) {
    try {
      const processedImageBuffer = await sharp(req.file.buffer)
        .resize(300, 400, { // Standard size for manager cards
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

// PUT /api/managers/:id/image - Update manager image (protected route)
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
        await deleteImageFromCloudinary(oldManager.imageUrl);
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

// DELETE /api/managers/:id - Delete manager (protected route)
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
      await deleteImageFromCloudinary(manager.imageUrl);
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
