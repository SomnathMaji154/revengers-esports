const sanitizeHtml = require('sanitize-html');
const { JSDOM } = require('jsdom');
const DOMPurify = require('dompurify')(new JSDOM().window);
const validator = require('validator');
const config = require('./config');
const logger = require('./logger');

/**
 * Advanced Security Utilities
 * Comprehensive security functions for input sanitization, validation, and protection
 */
class SecurityManager {
  constructor() {
    this.sanitizeHtmlOptions = {
      allowedTags: ['b', 'i', 'em', 'strong', 'span'],
      allowedAttributes: {
        'span': ['class']
      },
      allowedClasses: {
        'span': ['highlight', 'emphasis']
      },
      disallowedTagsMode: 'discard',
      allowedSchemes: ['http', 'https', 'mailto'],
      allowedSchemesByTag: {
        img: ['http', 'https', 'data'],
        a: ['http', 'https', 'mailto']
      },
      transformTags: {
        'script': 'span',
        'iframe': 'span'
      }
    };
  }

  /**
   * Deep sanitize object properties recursively
   */
  sanitizeObject(obj, options = {}) {
    if (obj === null || obj === undefined) {
      return obj;
    }

    if (typeof obj === 'string') {
      return this.sanitizeString(obj, options);
    }

    if (Array.isArray(obj)) {
      return obj.map(item => this.sanitizeObject(item, options));
    }

    if (typeof obj === 'object') {
      const sanitized = {};
      for (const [key, value] of Object.entries(obj)) {
        // Sanitize key names to prevent prototype pollution
        const sanitizedKey = this.sanitizePropertyName(key);
        if (sanitizedKey) {
          sanitized[sanitizedKey] = this.sanitizeObject(value, options);
        }
      }
      return sanitized;
    }

    return obj;
  }

  /**
   * Sanitize string input with multiple layers of protection
   */
  sanitizeString(input, options = {}) {
    if (typeof input !== 'string') {
      return input;
    }

    let sanitized = input;

    // Remove null bytes and control characters
    sanitized = sanitized.replace(/\x00/g, '');
    sanitized = sanitized.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');

    // Normalize Unicode
    sanitized = sanitized.normalize('NFKC');

    // Remove potentially dangerous Unicode characters
    sanitized = sanitized.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F]/g, '');

    // HTML sanitization
    if (options.allowHtml) {
      sanitized = sanitizeHtml(sanitized, this.sanitizeHtmlOptions);
    } else {
      sanitized = sanitizeHtml(sanitized, { allowedTags: [], allowedAttributes: {} });
    }

    // Additional DOMPurify sanitization
    sanitized = DOMPurify.sanitize(sanitized, {
      ALLOWED_TAGS: options.allowHtml ? ['b', 'i', 'em', 'strong', 'span'] : [],
      ALLOWED_ATTR: options.allowHtml ? ['class'] : [],
      FORBID_SCRIPT: true,
      FORBID_TAGS: ['script', 'iframe', 'object', 'embed', 'form', 'input', 'textarea', 'select'],
      FORBID_ATTR: ['onclick', 'onload', 'onerror', 'onmouseover', 'onfocus', 'onblur']
    });

    // Trim whitespace
    sanitized = sanitized.trim();

    return sanitized;
  }

  /**
   * Sanitize property names to prevent prototype pollution
   */
  sanitizePropertyName(key) {
    if (typeof key !== 'string') {
      return null;
    }

    // Block dangerous property names
    const dangerous = ['__proto__', 'constructor', 'prototype', 'valueOf', 'toString'];
    if (dangerous.includes(key.toLowerCase())) {
      logger.securityLog('Blocked dangerous property name', { key });
      return null;
    }

    // Sanitize and validate
    const sanitized = this.sanitizeString(key);
    if (!/^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(sanitized)) {
      logger.securityLog('Invalid property name format', { key, sanitized });
      return null;
    }

    return sanitized;
  }

  /**
   * Validate and sanitize email addresses
   */
  sanitizeEmail(email) {
    if (!email || typeof email !== 'string') {
      return null;
    }

    const sanitized = this.sanitizeString(email).toLowerCase();
    
    if (!validator.isEmail(sanitized)) {
      return null;
    }

    // Additional checks for suspicious patterns
    if (sanitized.includes('..') || sanitized.includes('++')) {
      return null;
    }

    return validator.normalizeEmail(sanitized);
  }

  /**
   * Validate and sanitize phone numbers
   */
  sanitizePhone(phone) {
    if (!phone || typeof phone !== 'string') {
      return null;
    }

    // Remove all non-digit characters except +
    let sanitized = phone.replace(/[^\d+]/g, '');
    
    // Ensure + is only at the beginning
    if (sanitized.indexOf('+') > 0) {
      sanitized = sanitized.replace(/\+/g, '');
    }

    // Validate length and format
    if (!/^\+?[\d]{10,15}$/.test(sanitized)) {
      return null;
    }

    return sanitized;
  }

  /**
   * Validate file uploads with comprehensive security checks
   */
  validateFileUpload(file, options = {}) {
    const errors = [];

    if (!file || !file.buffer) {
      errors.push('No file provided');
      return { valid: false, errors };
    }

    // Check file size
    const maxSize = options.maxSize || config.MAX_FILE_SIZE;
    if (file.size > maxSize) {
      errors.push(`File too large. Maximum size: ${Math.round(maxSize / (1024 * 1024))}MB`);
    }

    // Check MIME type
    const allowedTypes = options.allowedTypes || config.ALLOWED_FILE_TYPES;
    if (!allowedTypes.includes(file.mimetype)) {
      errors.push(`Invalid file type. Allowed: ${allowedTypes.join(', ')}`);
    }

    // Check file signature (magic bytes)
    const signature = this.getFileSignature(file.buffer);
    if (!this.isValidFileSignature(signature, file.mimetype)) {
      errors.push('File signature does not match MIME type');
    }

    // Check filename for security
    const filename = file.originalname;
    if (!/^[a-zA-Z0-9._-]+$/.test(filename)) {
      errors.push('Filename contains invalid characters');
    }

    // Check for double extensions
    if (/\.[^.]+\.[^.]+$/.test(filename)) {
      errors.push('Double file extensions not allowed');
    }

    // Check file extension
    const ext = filename.split('.').pop().toLowerCase();
    const allowedExtensions = ['jpg', 'jpeg', 'png', 'webp', 'gif'];
    if (!allowedExtensions.includes(ext)) {
      errors.push(`Invalid file extension. Allowed: ${allowedExtensions.join(', ')}`);
    }

    // Scan for embedded scripts or suspicious content
    if (this.containsSuspiciousContent(file.buffer)) {
      errors.push('File contains suspicious content');
    }

    return {
      valid: errors.length === 0,
      errors,
      sanitizedFilename: this.sanitizeFilename(filename)
    };
  }

  /**
   * Get file signature from buffer
   */
  getFileSignature(buffer) {
    if (!buffer || buffer.length < 4) {
      return [];
    }
    return Array.from(buffer.slice(0, 10));
  }

  /**
   * Validate file signature against MIME type
   */
  isValidFileSignature(signature, mimetype) {
    const signatures = {
      'image/jpeg': [[0xFF, 0xD8, 0xFF]],
      'image/png': [[0x89, 0x50, 0x4E, 0x47]],
      'image/gif': [[0x47, 0x49, 0x46, 0x38]],
      'image/webp': [[0x52, 0x49, 0x46, 0x46]]
    };

    const expectedSignatures = signatures[mimetype];
    if (!expectedSignatures) {
      return false;
    }

    return expectedSignatures.some(expected => 
      expected.every((byte, index) => signature[index] === byte)
    );
  }

  /**
   * Check for suspicious content in file buffer
   */
  containsSuspiciousContent(buffer) {
    const content = buffer.toString('ascii', 0, Math.min(buffer.length, 1024));
    
    // Check for script tags, eval, or other suspicious patterns
    const suspiciousPatterns = [
      /<script/i,
      /javascript:/i,
      /eval\s*\(/i,
      /document\.write/i,
      /window\.location/i,
      /<iframe/i,
      /<object/i,
      /<embed/i
    ];

    return suspiciousPatterns.some(pattern => pattern.test(content));
  }

  /**
   * Sanitize filename for safe storage
   */
  sanitizeFilename(filename) {
    if (!filename || typeof filename !== 'string') {
      return 'unnamed';
    }

    // Remove path traversal attempts
    let sanitized = filename.replace(/[\/\\]/g, '');
    
    // Remove or replace unsafe characters
    sanitized = sanitized.replace(/[^a-zA-Z0-9._-]/g, '_');
    
    // Prevent leading dots or dashes
    sanitized = sanitized.replace(/^[.-]+/, '');
    
    // Limit length
    if (sanitized.length > 100) {
      const ext = sanitized.split('.').pop();
      const name = sanitized.substring(0, 90);
      sanitized = `${name}.${ext}`;
    }

    return sanitized || 'unnamed';
  }

  /**
   * Rate limiting key generator
   */
  generateRateLimitKey(req, options = {}) {
    const factors = [];
    
    // IP address (primary factor)
    factors.push(req.ip || req.connection.remoteAddress);
    
    // User ID if authenticated
    if (req.session && req.session.userId) {
      factors.push(`user:${req.session.userId}`);
    }
    
    // Endpoint if specified
    if (options.includeEndpoint) {
      factors.push(`endpoint:${req.route?.path || req.path}`);
    }
    
    // User agent fingerprint (optional)
    if (options.includeUserAgent) {
      const ua = req.get('User-Agent') || '';
      const fingerprint = require('crypto')
        .createHash('sha256')
        .update(ua)
        .digest('hex')
        .substring(0, 8);
      factors.push(`ua:${fingerprint}`);
    }
    
    return factors.join(':');
  }

  /**
   * Generate secure random tokens
   */
  generateSecureToken(length = 32) {
    const crypto = require('crypto');
    return crypto.randomBytes(length).toString('hex');
  }

  /**
   * Hash sensitive data with salt
   */
  hashSensitiveData(data, salt = null) {
    const crypto = require('crypto');
    if (!salt) {
      salt = crypto.randomBytes(16).toString('hex');
    }
    const hash = crypto.pbkdf2Sync(data, salt, 10000, 64, 'sha512').toString('hex');
    return { hash, salt };
  }

  /**
   * Middleware for request sanitization
   */
  sanitizeRequest() {
    return (req, res, next) => {
      try {
        // Sanitize query parameters
        if (req.query) {
          req.query = this.sanitizeObject(req.query);
        }
        
        // Sanitize body
        if (req.body) {
          req.body = this.sanitizeObject(req.body);
        }
        
        // Sanitize params
        if (req.params) {
          req.params = this.sanitizeObject(req.params);
        }
        
        // Log suspicious requests
        const suspiciousIndicators = this.detectSuspiciousRequest(req);
        if (suspiciousIndicators.length > 0) {
          logger.securityLog('Suspicious request detected', {
            ip: req.ip,
            userAgent: req.get('User-Agent'),
            path: req.path,
            method: req.method,
            indicators: suspiciousIndicators
          });
        }
        
        next();
      } catch (error) {
        logger.error('Error in request sanitization', { error: error.message });
        next(error);
      }
    };
  }

  /**
   * Detect suspicious request patterns
   */
  detectSuspiciousRequest(req) {
    const indicators = [];
    
    // Check for SQL injection patterns
    const sqlPatterns = [
      /(\bUNION\b|\bSELECT\b|\bINSERT\b|\bUPDATE\b|\bDELETE\b|\bDROP\b)/i,
      /(\bOR\b.*=.*\bOR\b|\bAND\b.*=.*\bAND\b)/i,
      /(\'|\")(\s*)(or|and)(\s*)(\'|\")/i
    ];
    
    // Check for XSS patterns
    const xssPatterns = [
      /<script[^>]*>/i,
      /javascript:/i,
      /on\w+\s*=/i,
      /<iframe[^>]*>/i
    ];
    
    // Check for path traversal
    const pathTraversalPatterns = [
      /\.\.\//,
      /\.\.\\/,
      /%2e%2e%2f/i,
      /%2e%2e%5c/i
    ];
    
    const allContent = JSON.stringify({
      query: req.query,
      body: req.body,
      params: req.params,
      headers: req.headers
    });
    
    if (sqlPatterns.some(pattern => pattern.test(allContent))) {
      indicators.push('sql_injection');
    }
    
    if (xssPatterns.some(pattern => pattern.test(allContent))) {
      indicators.push('xss_attempt');
    }
    
    if (pathTraversalPatterns.some(pattern => pattern.test(allContent))) {
      indicators.push('path_traversal');
    }
    
    // Check for unusual header patterns
    const userAgent = req.get('User-Agent') || '';
    if (userAgent.length < 10 || userAgent.includes('curl') || userAgent.includes('wget')) {
      indicators.push('suspicious_user_agent');
    }
    
    return indicators;
  }
}

module.exports = new SecurityManager();