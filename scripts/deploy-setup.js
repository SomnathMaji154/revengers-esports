#!/usr/bin/env node

/**
 * Production Deployment Setup Script
 * Helps configure the application for production deployment
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const colors = {
  reset: '\\x1b[0m',
  red: '\\x1b[31m',
  green: '\\x1b[32m',
  yellow: '\\x1b[33m',
  blue: '\\x1b[34m',
  magenta: '\\x1b[35m',
  cyan: '\\x1b[36m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function generateSecureSecret(length = 64) {
  return crypto.randomBytes(length).toString('hex');
}

function checkEnvironmentVariables() {
  log('\n🔍 Checking Environment Variables...', 'cyan');
  
  const requiredVars = [
    'DATABASE_URL',
    'SESSION_SECRET',
    'CLOUDINARY_CLOUD_NAME',
    'CLOUDINARY_API_KEY',
    'CLOUDINARY_API_SECRET'
  ];
  
  const missing = [];
  const present = [];
  
  requiredVars.forEach(varName => {
    if (process.env[varName]) {
      present.push(varName);
      log(`  ✓ ${varName}`, 'green');
    } else {
      missing.push(varName);
      log(`  ✗ ${varName}`, 'red');
    }
  });
  
  if (missing.length > 0) {
    log(`\n⚠️  Missing ${missing.length} required environment variables:`, 'yellow');
    missing.forEach(varName => {
      log(`   - ${varName}`, 'red');
    });
    
    if (missing.includes('SESSION_SECRET')) {
      const newSecret = generateSecureSecret();
      log(`\n🔐 Generated session secret:`, 'cyan');
      log(`SESSION_SECRET=${newSecret}`, 'green');
    }
    
    return false;
  }
  
  log(`\n✅ All ${present.length} required environment variables are set!`, 'green');
  return true;
}

function checkDatabaseConnection() {
  log('\n🗄️  Checking Database Connection...', 'cyan');
  
  if (!process.env.DATABASE_URL) {
    log('  ✗ DATABASE_URL not set', 'red');
    return false;
  }
  
  // Basic URL validation
  try {
    const url = new URL(process.env.DATABASE_URL);
    if (url.protocol !== 'postgresql:' && url.protocol !== 'postgres:') {
      log('  ✗ Invalid PostgreSQL URL protocol', 'red');
      return false;
    }
    log(`  ✓ Database URL format valid`, 'green');
    log(`  ✓ Host: ${url.hostname}`, 'green');
    log(`  ✓ Database: ${url.pathname.slice(1)}`, 'green');
    return true;
  } catch (error) {
    log(`  ✗ Invalid DATABASE_URL format: ${error.message}`, 'red');
    return false;
  }
}

function checkCloudinaryConfig() {
  log('\n☁️  Checking Cloudinary Configuration...', 'cyan');
  
  const cloudinaryVars = ['CLOUDINARY_CLOUD_NAME', 'CLOUDINARY_API_KEY', 'CLOUDINARY_API_SECRET'];
  const missing = cloudinaryVars.filter(varName => !process.env[varName]);
  
  if (missing.length > 0) {
    log(`  ✗ Missing Cloudinary variables: ${missing.join(', ')}`, 'red');
    log('  📝 Get these from: https://cloudinary.com/console', 'blue');
    return false;
  }
  
  log('  ✓ All Cloudinary variables set', 'green');
  return true;
}

function checkFilePermissions() {
  log('\n📁 Checking File Permissions...', 'cyan');
  
  const criticalFiles = [
    'package.json',
    'backend/server.js',
    'backend/config.js'
  ];
  
  let allGood = true;
  
  criticalFiles.forEach(filePath => {
    try {
      fs.accessSync(filePath, fs.constants.R_OK);
      log(`  ✓ ${filePath}`, 'green');
    } catch (error) {
      log(`  ✗ ${filePath}: ${error.message}`, 'red');
      allGood = false;
    }
  });
  
  return allGood;
}

function validatePackageJson() {
  log('\n📦 Validating package.json...', 'cyan');
  
  try {
    const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
    
    // Check required scripts
    const requiredScripts = ['start', 'test'];
    const missingScripts = requiredScripts.filter(script => !pkg.scripts[script]);
    
    if (missingScripts.length > 0) {
      log(`  ✗ Missing scripts: ${missingScripts.join(', ')}`, 'red');
      return false;
    }
    
    // Check Node.js version
    if (pkg.engines && pkg.engines.node) {
      log(`  ✓ Node.js version specified: ${pkg.engines.node}`, 'green');
    } else {
      log(`  ⚠️  No Node.js version specified in engines`, 'yellow');
    }
    
    // Check main entry point
    if (pkg.main && fs.existsSync(pkg.main)) {
      log(`  ✓ Main entry point exists: ${pkg.main}`, 'green');
    } else {
      log(`  ✗ Main entry point missing or invalid: ${pkg.main}`, 'red');
      return false;
    }
    
    log('  ✓ package.json is valid', 'green');
    return true;
  } catch (error) {
    log(`  ✗ Error reading package.json: ${error.message}`, 'red');
    return false;
  }
}

function generateDeploymentChecklist() {
  log('\n📋 Deployment Checklist', 'magenta');
  log('═══════════════════════', 'magenta');
  
  const checklist = [
    '□ Set up PostgreSQL database on Render',
    '□ Configure Cloudinary account and get API credentials',
    '□ Set all environment variables in Render dashboard',
    '□ Configure custom domain (if needed)',
    '□ Set up monitoring and alerting',
    '□ Test the application thoroughly',
    '□ Set up backup strategy for database',
    '□ Review security headers and CORS settings',
    '□ Optimize images and static assets',
    '□ Set up error tracking (e.g., Sentry)',
    '□ Configure logging and log retention',
    '□ Test file upload functionality',
    '□ Verify session management works correctly',
    '□ Test rate limiting under load',
    '□ Set up health check monitoring'
  ];
  
  checklist.forEach(item => {
    log(`  ${item}`, 'yellow');
  });
}

function displayRenderConfiguration() {
  log('\n🚀 Render Configuration Guide', 'magenta');
  log('═══════════════════════════════', 'magenta');
  
  log('\n1. Create a new Web Service:', 'cyan');
  log('   - Repository: Connect your GitHub repo', 'blue');
  log('   - Build Command: npm install', 'blue');
  log('   - Start Command: npm start', 'blue');
  log('   - Environment: Node', 'blue');
  
  log('\n2. Environment Variables:', 'cyan');
  const envVars = [
    'NODE_ENV=production',
    'SESSION_SECRET=[generate-64-char-random-string]',
    'DATABASE_URL=[provided-by-render-database]',
    'CLOUDINARY_CLOUD_NAME=[your-cloud-name]',
    'CLOUDINARY_API_KEY=[your-api-key]',
    'CLOUDINARY_API_SECRET=[your-api-secret]',
    'PRODUCTION_URL=[your-render-app-url]'
  ];
  
  envVars.forEach(envVar => {
    log(`   ${envVar}`, 'blue');
  });
  
  log('\n3. Database Setup:', 'cyan');
  log('   - Create PostgreSQL service in Render', 'blue');
  log('   - Copy DATABASE_URL to web service env vars', 'blue');
  log('   - Database will auto-initialize on first run', 'blue');
}

function main() {
  log('\n🎯 Revengers Esports Production Setup', 'magenta');
  log('═══════════════════════════════════════', 'magenta');
  
  const checks = [
    checkFilePermissions,
    validatePackageJson,
    checkEnvironmentVariables,
    checkDatabaseConnection,
    checkCloudinaryConfig
  ];
  
  let allPassed = true;
  
  for (const check of checks) {
    if (!check()) {
      allPassed = false;
    }
  }
  
  if (allPassed) {
    log('\n🎉 All checks passed! Ready for deployment.', 'green');
  } else {
    log('\n⚠️  Some checks failed. Please fix the issues above.', 'yellow');
  }
  
  generateDeploymentChecklist();
  displayRenderConfiguration();
  
  log('\n💡 Pro Tips:', 'cyan');
  log('  - Use render.yaml for Infrastructure as Code', 'blue');
  log('  - Monitor the /health endpoint for uptime', 'blue');
  log('  - Enable auto-deploy from main branch', 'blue');
  log('  - Set up branch previews for testing', 'blue');
  
  log('\n📚 Documentation:', 'cyan');
  log('  - Render: https://render.com/docs', 'blue');
  log('  - Cloudinary: https://cloudinary.com/documentation', 'blue');
  
  log('\n✨ Happy deploying!', 'green');
}

if (require.main === module) {
  main();
}

module.exports = {
  checkEnvironmentVariables,
  checkDatabaseConnection,
  checkCloudinaryConfig,
  generateSecureSecret
};