const Joi = require('joi');
const { body, param, query, validationResult } = require('express-validator');

/**
 * Comprehensive validation schemas and middleware
 * Using both Joi for schema validation and express-validator for middleware
 */

// Joi Schemas
const schemas = {
  player: Joi.object({
    name: Joi.string()
      .trim()
      .min(1)
      .max(100)
      .pattern(/^[a-zA-Z\s'-]+$/)
      .required()
      .messages({
        'string.pattern.base': 'Name can only contain letters, spaces, hyphens, and apostrophes',
        'string.min': 'Name cannot be empty',
        'string.max': 'Name must be less than 100 characters'
      }),
    jerseyNumber: Joi.number()
      .integer()
      .min(1)
      .max(99)
      .required()
      .messages({
        'number.min': 'Jersey number must be between 1 and 99',
        'number.max': 'Jersey number must be between 1 and 99'
      }),
    stars: Joi.number()
      .integer()
      .min(1)
      .max(5)
      .required()
      .messages({
        'number.min': 'Stars rating must be between 1 and 5',
        'number.max': 'Stars rating must be between 1 and 5'
      })
  }),

  manager: Joi.object({
    name: Joi.string()
      .trim()
      .min(1)
      .max(100)
      .pattern(/^[a-zA-Z\s'-]+$/)
      .required()
      .messages({
        'string.pattern.base': 'Name can only contain letters, spaces, hyphens, and apostrophes',
        'string.min': 'Name cannot be empty',
        'string.max': 'Name must be less than 100 characters'
      }),
    role: Joi.string()
      .trim()
      .min(1)
      .max(100)
      .pattern(/^[a-zA-Z\s'-]+$/)
      .required()
      .messages({
        'string.pattern.base': 'Role can only contain letters, spaces, hyphens, and apostrophes',
        'string.min': 'Role cannot be empty',
        'string.max': 'Role must be less than 100 characters'
      })
  }),

  trophy: Joi.object({
    name: Joi.string()
      .trim()
      .min(1)
      .max(200)
      .required()
      .messages({
        'string.min': 'Trophy name cannot be empty',
        'string.max': 'Trophy name must be less than 200 characters'
      }),
    year: Joi.number()
      .integer()
      .min(1900)
      .max(new Date().getFullYear() + 1)
      .required()
      .messages({
        'number.min': 'Year must be between 1900 and next year',
        'number.max': `Year must be between 1900 and ${new Date().getFullYear() + 1}`
      })
  }),

  contact: Joi.object({
    name: Joi.string()
      .trim()
      .min(1)
      .max(100)
      .pattern(/^[a-zA-Z\s'-]+$/)
      .required()
      .messages({
        'string.pattern.base': 'Name can only contain letters, spaces, hyphens, and apostrophes',
        'string.min': 'Name cannot be empty',
        'string.max': 'Name must be less than 100 characters'
      }),
    email: Joi.string()
      .email()
      .trim()
      .lowercase()
      .max(254)
      .required()
      .messages({
        'string.email': 'Please enter a valid email address',
        'string.max': 'Email must be less than 254 characters'
      }),
    whatsapp: Joi.string()
      .trim()
      .pattern(/^\+?[\d\s-()]{10,15}$/)
      .required()
      .messages({
        'string.pattern.base': 'Please enter a valid WhatsApp number (10-15 digits)'
      })
  }),

  admin: Joi.object({
    username: Joi.string()
      .trim()
      .alphanum()
      .min(3)
      .max(30)
      .required()
      .messages({
        'string.alphanum': 'Username can only contain letters and numbers',
        'string.min': 'Username must be at least 3 characters',
        'string.max': 'Username must be less than 30 characters'
      }),
    password: Joi.string()
      .min(8)
      .pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
      .required()
      .messages({
        'string.min': 'Password must be at least 8 characters',
        'string.pattern.base': 'Password must contain at least one lowercase letter, one uppercase letter, one digit, and one special character'
      })
  }),

  id: Joi.number()
    .integer()
    .positive()
    .required()
    .messages({
      'number.positive': 'ID must be a positive integer'
    })
};

// Express-validator middleware chains
const validationRules = {
  // Player validation
  createPlayer: [
    body('name')
      .trim()
      .isLength({ min: 1, max: 100 })
      .matches(/^[a-zA-Z\s'-]+$/)
      .withMessage('Name can only contain letters, spaces, hyphens, and apostrophes'),
    body('jerseyNumber')
      .isInt({ min: 1, max: 99 })
      .withMessage('Jersey number must be between 1 and 99'),
    body('stars')
      .isInt({ min: 1, max: 5 })
      .withMessage('Stars rating must be between 1 and 5')
  ],

  updatePlayer: [
    param('id').isInt({ min: 1 }).withMessage('Invalid player ID'),
    body('name')
      .optional()
      .trim()
      .isLength({ min: 1, max: 100 })
      .matches(/^[a-zA-Z\s'-]+$/)
      .withMessage('Name can only contain letters, spaces, hyphens, and apostrophes'),
    body('jerseyNumber')
      .optional()
      .isInt({ min: 1, max: 99 })
      .withMessage('Jersey number must be between 1 and 99'),
    body('stars')
      .optional()
      .isInt({ min: 1, max: 5 })
      .withMessage('Stars rating must be between 1 and 5')
  ],

  // Manager validation
  createManager: [
    body('name')
      .trim()
      .isLength({ min: 1, max: 100 })
      .matches(/^[a-zA-Z\s'-]+$/)
      .withMessage('Name can only contain letters, spaces, hyphens, and apostrophes'),
    body('role')
      .trim()
      .isLength({ min: 1, max: 100 })
      .matches(/^[a-zA-Z\s'-]+$/)
      .withMessage('Role can only contain letters, spaces, hyphens, and apostrophes')
  ],

  updateManager: [
    param('id').isInt({ min: 1 }).withMessage('Invalid manager ID'),
    body('name')
      .optional()
      .trim()
      .isLength({ min: 1, max: 100 })
      .matches(/^[a-zA-Z\s'-]+$/)
      .withMessage('Name can only contain letters, spaces, hyphens, and apostrophes'),
    body('role')
      .optional()
      .trim()
      .isLength({ min: 1, max: 100 })
      .matches(/^[a-zA-Z\s'-]+$/)
      .withMessage('Role can only contain letters, spaces, hyphens, and apostrophes')
  ],

  // Trophy validation
  createTrophy: [
    body('name')
      .trim()
      .isLength({ min: 1, max: 200 })
      .withMessage('Trophy name must be between 1 and 200 characters'),
    body('year')
      .isInt({ min: 1900, max: new Date().getFullYear() + 1 })
      .withMessage(`Year must be between 1900 and ${new Date().getFullYear() + 1}`)
  ],

  updateTrophy: [
    param('id').isInt({ min: 1 }).withMessage('Invalid trophy ID'),
    body('name')
      .optional()
      .trim()
      .isLength({ min: 1, max: 200 })
      .withMessage('Trophy name must be between 1 and 200 characters'),
    body('year')
      .optional()
      .isInt({ min: 1900, max: new Date().getFullYear() + 1 })
      .withMessage(`Year must be between 1900 and ${new Date().getFullYear() + 1}`)
  ],

  // Contact validation
  createContact: [
    body('name')
      .trim()
      .isLength({ min: 1, max: 100 })
      .matches(/^[a-zA-Z\s'-]+$/)
      .withMessage('Name can only contain letters, spaces, hyphens, and apostrophes'),
    body('email')
      .isEmail()
      .normalizeEmail()
      .isLength({ max: 254 })
      .withMessage('Please enter a valid email address'),
    body('whatsapp')
      .trim()
      .matches(/^\+?[\d\s-()]{10,15}$/)
      .withMessage('Please enter a valid WhatsApp number (10-15 digits)')
  ],

  // Admin validation
  adminLogin: [
    body('username')
      .trim()
      .isLength({ min: 3, max: 30 })
      .isAlphanumeric()
      .withMessage('Username must be 3-30 characters and contain only letters and numbers'),
    body('password')
      .isLength({ min: 8 })
      .withMessage('Password must be at least 8 characters')
  ],

  // ID parameter validation
  validateId: [
    param('id').isInt({ min: 1 }).withMessage('Invalid ID parameter')
  ]
};

// Validation middleware factory
function validate(schema) {
  return (req, res, next) => {
    const { error, value } = schema.validate(req.body);
    if (error) {
      return res.status(400).json({
        error: 'Validation Error',
        details: error.details.map(detail => ({
          field: detail.path.join('.'),
          message: detail.message
        }))
      });
    }
    req.body = value; // Use sanitized values
    next();
  };
}

// Express-validator error handling middleware
function handleValidationErrors(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      error: 'Validation Error',
      details: errors.array().map(error => ({
        field: error.path || error.param,
        message: error.msg,
        value: error.value
      }))
    });
  }
  next();
}

// File validation middleware
function validateFile(allowedTypes, maxSize) {
  return (req, res, next) => {
    if (!req.file) {
      return next(); // File is optional
    }

    // Check file type
    if (!allowedTypes.includes(req.file.mimetype)) {
      return res.status(400).json({
        error: 'Invalid file type',
        details: [`Allowed types: ${allowedTypes.join(', ')}`]
      });
    }

    // Check file size
    if (req.file.size > maxSize) {
      return res.status(400).json({
        error: 'File too large',
        details: [`Maximum size: ${Math.round(maxSize / (1024 * 1024))}MB`]
      });
    }

    next();
  };
}

// Sanitization helpers
const sanitizers = {
  // Remove HTML tags and trim whitespace
  sanitizeString: (str) => {
    if (typeof str !== 'string') return str;
    return str.replace(/<[^>]*>/g, '').trim();
  },

  // Sanitize and validate email
  sanitizeEmail: (email) => {
    if (typeof email !== 'string') return email;
    return email.toLowerCase().trim();
  },

  // Sanitize phone number (remove non-digits except + at start)
  sanitizePhone: (phone) => {
    if (typeof phone !== 'string') return phone;
    return phone.replace(/[^\d+]/g, '').replace(/(?!^)\+/g, '');
  }
};

module.exports = {
  schemas,
  validationRules,
  validate,
  handleValidationErrors,
  validateFile,
  sanitizers
};