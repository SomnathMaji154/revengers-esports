const multer = require('multer');
const sharp = require('sharp');
const { uploader } = require('./cloudinaryConfig');

// Configure multer for memory storage
const configureMulter = () => {
  return multer({ 
    storage: multer.memoryStorage(),
    limits: {
      fileSize: 5 * 1024 * 1024
    },
    fileFilter: (req, file, cb) => {
      if (file.mimetype.startsWith('image/')) {
        cb(null, true);
      } else {
        cb(new Error('Only image files are allowed!'), false);
      }
    }
  });
};

// Helper function to upload image to Cloudinary with better error handling and optimization
async function uploadImageToCloudinary(fileBuffer, originalFilename, folder) {
  const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
  const publicId = `${folder}/processed-${uniqueSuffix}`;

  const uploadOptions = {
    public_id: publicId,
    format: 'webp',
    quality: 'auto:good',
    resource_type: 'image',
    transformation: [{
      fetch_format: 'auto',
      quality: 'auto:good'
    }],
    timeout: 60000 // 60 second timeout
  };

  try {
    // Validate file buffer
    if (!fileBuffer || fileBuffer.length === 0) {
      throw new Error('Invalid or empty file buffer');
    }

    const result = await new Promise((resolve, reject) => {
      const uploadStream = uploader.upload_stream(uploadOptions, (error, result) => {
        if (error) {
          console.error('Cloudinary upload error:', error);
          reject(new Error(`Cloudinary upload failed: ${error.message || 'Unknown error'}`));
        } else {
          resolve(result);
        }
      });
      uploadStream.end(fileBuffer);
    });
    
    // Validate result
    if (!result || !result.secure_url) {
      throw new Error('Upload succeeded but no URL returned');
    }
    
    return result.secure_url;
  } catch (error) {
    console.error('Error uploading to Cloudinary:', error);
    throw new Error(`Failed to upload image: ${error.message || 'Upload service unavailable'}`);
  }
}

// Helper function to delete image from Cloudinary
async function deleteImageFromCloudinary(imageUrl, folder) {
  if (!imageUrl) return;

  try {
    const urlParts = new URL(imageUrl).pathname.split('/');
    const filename = urlParts.pop().split('.')[0];
    const publicId = `${folder}/${filename}`;

    await new Promise((resolve, reject) => {
      uploader.destroy(publicId, (error, result) => {
        if (error) {
          reject(error);
        } else {
          resolve(result);
        }
      });
    });
  } catch (error) {
    console.error('Error deleting image from Cloudinary:', error);
  }
}

module.exports = {
  configureMulter,
  uploadImageToCloudinary,
  deleteImageFromCloudinary
};
