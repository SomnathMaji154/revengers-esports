#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const imagemin = require('imagemin');
const imageminWebp = require('imagemin-webp');
const imageminMozjpeg = require('imagemin-mozjpeg');
const imageminPngquant = require('imagemin-pngquant');

/**
 * Image Optimization Script
 * Optimizes all images in the project for better performance
 */

const INPUT_DIR = path.join(__dirname, '../');
const OUTPUT_DIR = path.join(__dirname, '../optimized/');

// Ensure output directory exists
if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

async function optimizeImages() {
  try {
    console.log('🖼️  Starting image optimization...');
    
    // Find all image files
    const imageFiles = [];
    const allowedExtensions = ['.jpg', '.jpeg', '.png', '.gif'];
    
    function findImages(dir) {
      const files = fs.readdirSync(dir);
      
      for (const file of files) {
        const filePath = path.join(dir, file);
        const stat = fs.statSync(filePath);
        
        if (stat.isDirectory() && !['node_modules', '.git', 'optimized'].includes(file)) {
          findImages(filePath);
        } else if (stat.isFile()) {
          const ext = path.extname(file).toLowerCase();
          if (allowedExtensions.includes(ext)) {
            imageFiles.push(filePath);
          }
        }
      }
    }
    
    findImages(INPUT_DIR);
    console.log(`📁 Found ${imageFiles.length} images to optimize`);
    
    if (imageFiles.length === 0) {
      console.log('✅ No images found to optimize');
      return;
    }
    
    // Optimize images
    const optimizedFiles = await imagemin(imageFiles, {
      destination: OUTPUT_DIR,
      plugins: [
        // JPEG optimization
        imageminMozjpeg({
          quality: 85,
          progressive: true
        }),
        
        // PNG optimization
        imageminPngquant({
          quality: [0.7, 0.9],
          speed: 1,
          strip: true
        }),
        
        // Convert to WebP format for modern browsers
        imageminWebp({
          quality: 85,
          method: 6
        })
      ]
    });
    
    console.log(`✅ Optimized ${optimizedFiles.length} images`);
    
    // Calculate savings
    let originalSize = 0;
    let optimizedSize = 0;
    
    for (const file of imageFiles) {
      originalSize += fs.statSync(file).size;
    }
    
    for (const file of optimizedFiles) {
      optimizedSize += fs.statSync(file.destinationPath).size;
    }
    
    const savings = originalSize - optimizedSize;
    const savingsPercent = Math.round((savings / originalSize) * 100);
    
    console.log(`💾 Total savings: ${formatBytes(savings)} (${savingsPercent}%)`);
    console.log(`📊 Original: ${formatBytes(originalSize)} → Optimized: ${formatBytes(optimizedSize)}`);
    
    // Generate optimization report
    generateOptimizationReport(imageFiles, optimizedFiles, { originalSize, optimizedSize, savings });
    
  } catch (error) {
    console.error('❌ Image optimization failed:', error);
    process.exit(1);
  }
}

function formatBytes(bytes) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function generateOptimizationReport(originalFiles, optimizedFiles, stats) {
  const report = {
    timestamp: new Date().toISOString(),
    summary: {
      totalFiles: originalFiles.length,
      optimizedFiles: optimizedFiles.length,
      originalSize: stats.originalSize,
      optimizedSize: stats.optimizedSize,
      savings: stats.savings,
      savingsPercent: Math.round((stats.savings / stats.originalSize) * 100)
    },
    files: optimizedFiles.map(file => ({
      source: file.sourcePath,
      destination: file.destinationPath,
      originalSize: fs.statSync(file.sourcePath).size,
      optimizedSize: fs.statSync(file.destinationPath).size
    })),
    recommendations: [
      'Consider using WebP format for modern browsers',
      'Implement responsive images with different sizes',
      'Use lazy loading for images below the fold',
      'Consider using a CDN for image delivery'
    ]
  };
  
  const reportPath = path.join(OUTPUT_DIR, 'optimization-report.json');
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  console.log(`📋 Optimization report saved to: ${reportPath}`);
}

// Run the optimization
if (require.main === module) {
  optimizeImages().catch(console.error);
}

module.exports = { optimizeImages };