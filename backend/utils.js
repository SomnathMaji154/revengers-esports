const multer = require('multer');
const sharp = require('sharp');
const { uploader } = require('./cloudinaryConfig');
const config = require('./config');
const logger = require('./logger');
const path = require('path');
const crypto = require('crypto');

// Enhanced multer configuration with security and validation
const configureMulter = () => {
  return multer({ 
    storage: multer.memoryStorage(),
    limits: {
      fileSize: config.MAX_FILE_SIZE,
      files: 1, // Only allow one file per upload
      parts: 10 // Limit number of parts
    },
    fileFilter: (req, file, cb) => {
      // Check file type
      if (!config.ALLOWED_FILE_TYPES.includes(file.mimetype)) {
        logger.securityLog('File upload blocked - invalid type', {
          mimetype: file.mimetype,
          filename: file.originalname,
          ip: req.ip
        });
        return cb(new Error(`File type ${file.mimetype} not allowed`), false);
      }
      
      // Check filename for security
      const filename = file.originalname;
      if (!/^[a-zA-Z0-9._-]+$/.test(filename)) {
        logger.securityLog('File upload blocked - suspicious filename', {
          filename,
          ip: req.ip
        });
        return cb(new Error('Invalid filename characters'), false);
      }
      
      // Check file extension
      const ext = path.extname(filename).toLowerCase();
      const allowedExtensions = ['.jpg', '.jpeg', '.png', '.webp', '.gif'];
      if (!allowedExtensions.includes(ext)) {
        return cb(new Error(`File extension ${ext} not allowed`), false);
      }
      
      logger.debug('File upload validation passed', {
        filename,
        mimetype: file.mimetype,
        size: file.size
      });
      
      cb(null, true);
    }
  });
};

// Enhanced image processing and upload to Cloudinary
async function uploadImageToCloudinary(fileBuffer, originalFilename, folder) {
  const startTime = Date.now();
  
  try {
    // Validate inputs
    if (!fileBuffer || fileBuffer.length === 0) {
      throw new Error('Invalid or empty file buffer');
    }
    
    if (fileBuffer.length > config.MAX_FILE_SIZE) {
      throw new Error(`File too large: ${Math.round(fileBuffer.length / 1024 / 1024)}MB`);
    }
    
    // Generate secure filename
    const timestamp = Date.now();
    const randomBytes = crypto.randomBytes(8).toString('hex');
    const sanitizedName = originalFilename.replace(/[^a-zA-Z0-9.-]/g, '_');
    const publicId = `${folder}/${timestamp}-${randomBytes}-${sanitizedName}`;
    
    // Process image with Sharp for optimization
    let processedBuffer;
    try {
      const metadata = await sharp(fileBuffer).metadata();
      logger.debug('Processing image', {
        originalSize: fileBuffer.length,
        dimensions: `${metadata.width}x${metadata.height}`,
        format: metadata.format
      });
      
      // Determine optimal dimensions based on folder
      let width, height;
      switch (folder) {
        case 'players':
          width = 300;
          height = 400;
          break;
        case 'managers':
          width = 300;
          height = 400;
          break;
        case 'trophies':
          width = 400;
          height = 300;
          break;
        default:
          width = 800;
          height = 600;
      }
      
      processedBuffer = await sharp(fileBuffer)
        .resize(width, height, {
          fit: sharp.fit.cover,
          position: sharp.strategy.entropy
        })
        .webp({ 
          quality: 85,
          effort: 6
        })
        .toBuffer();
        
      logger.debug('Image processed', {
        newSize: processedBuffer.length,
        compression: `${Math.round((1 - processedBuffer.length / fileBuffer.length) * 100)}%`
      });
      
    } catch (sharpError) {
      logger.warn('Image processing failed, using original', { error: sharpError.message });
      processedBuffer = fileBuffer;
    }

    // Upload to Cloudinary with optimized settings
    const uploadOptions = {
      public_id: publicId,
      format: 'webp',
      quality: 'auto:good',
      resource_type: 'image',
      transformation: [
        {
          fetch_format: 'auto',
          quality: 'auto:good'
        }
      ],
      timeout: 30000, // 30 second timeout
      use_filename: false,
      unique_filename: true
    };
    
    const result = await new Promise((resolve, reject) => {
      const uploadStream = uploader.upload_stream(uploadOptions, (error, result) => {
        if (error) {
          logger.error('Cloudinary upload error', {
            error: error.message,
            publicId,
            folder
          });
          reject(new Error(`Cloudinary upload failed: ${error.message || 'Unknown error'}`));
        } else {
          resolve(result);
        }
      });
      
      uploadStream.end(processedBuffer);
    });
    
    // Validate result
    if (!result || !result.secure_url) {
      throw new Error('Upload succeeded but no URL returned');
    }
    
    const duration = Date.now() - startTime;
    logger.info('Image uploaded successfully', {
      publicId: result.public_id,
      url: result.secure_url,
      duration: `${duration}ms`,
      originalSize: fileBuffer.length,
      finalSize: result.bytes
    });
    
    return result.secure_url;
    
  } catch (error) {
    const duration = Date.now() - startTime;
    logger.error('Image upload failed', {
      error: error.message,
      duration: `${duration}ms`,
      folder,
      originalFilename
    });
    throw new Error(`Failed to upload image: ${error.message || 'Upload service unavailable'}`);
  }
}

// Enhanced image deletion from Cloudinary
async function deleteImageFromCloudinary(imageUrl, folder) {
  if (!imageUrl) {
    logger.debug('No image URL provided for deletion');
    return;
  }

  try {
    // Extract public ID from URL
    const urlParts = new URL(imageUrl).pathname.split('/');
    const filenameWithExt = urlParts.pop();
    const filename = filenameWithExt.split('.')[0];
    
    // Reconstruct public ID
    let publicId;
    if (filename.includes(`${folder}/`)) {
      publicId = filename;
    } else {
      publicId = `${folder}/${filename}`;
    }
    
    logger.debug('Deleting image from Cloudinary', { publicId, imageUrl });
    
    const result = await new Promise((resolve, reject) => {
      uploader.destroy(publicId, (error, result) => {
        if (error) {
          reject(error);
        } else {
          resolve(result);
        }
      });
    });
    
    if (result.result === 'ok') {
      logger.info('Image deleted successfully', { publicId });
    } else {
      logger.warn('Image deletion result unclear', { publicId, result });
    }
    
  } catch (error) {
    logger.error('Error deleting image from Cloudinary', {
      error: error.message,
      imageUrl,
      folder
    });
    // Don't throw error as this is cleanup operation
  }
}

// Utility function to validate image buffer
function validateImageBuffer(buffer) {
  if (!buffer || buffer.length === 0) {
    throw new Error('Empty image buffer');
  }
  
  // Check for common image file signatures
  const signatures = {
    jpeg: [0xFF, 0xD8, 0xFF],
    png: [0x89, 0x50, 0x4E, 0x47],
    gif: [0x47, 0x49, 0x46],
    webp: [0x52, 0x49, 0x46, 0x46] // RIFF for WebP
  };
  
  let isValidImage = false;
  for (const [format, signature] of Object.entries(signatures)) {
    if (signature.every((byte, index) => buffer[index] === byte)) {
      isValidImage = true;
      logger.debug('Image signature validated', { format });
      break;
    }
  }
  
  if (!isValidImage) {
    throw new Error('Invalid image file signature');
  }
  
  return true;
}

// Utility function for secure filename generation
function generateSecureFilename(originalName, prefix = '') {
  const timestamp = Date.now();
  const randomBytes = crypto.randomBytes(8).toString('hex');
  const sanitizedName = originalName
    .replace(/[^a-zA-Z0-9.-]/g, '_')
    .toLowerCase();
  
  return `${prefix}${timestamp}-${randomBytes}-${sanitizedName}`;
}

// Utility function to get file type from buffer
function getFileTypeFromBuffer(buffer) {
  if (buffer.length < 4) return 'unknown';
  
  // Check JPEG
  if (buffer[0] === 0xFF && buffer[1] === 0xD8 && buffer[2] === 0xFF) {
    return 'image/jpeg';
  }
  
  // Check PNG
  if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4E && buffer[3] === 0x47) {
    return 'image/png';
  }
  
  // Check GIF
  if (buffer[0] === 0x47 && buffer[1] === 0x49 && buffer[2] === 0x46) {
    return 'image/gif';
  }
  
  // Check WebP
  if (buffer[0] === 0x52 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x46) {
    return 'image/webp';
  }
  
  return 'unknown';
}

module.exports = {
  configureMulter,
  uploadImageToCloudinary,
  deleteImageFromCloudinary,
  validateImageBuffer,
  generateSecureFilename,
  getFileTypeFromBuffer
};
