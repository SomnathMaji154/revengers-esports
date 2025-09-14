#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { exec, execSync } = require('child_process');
const crypto = require('crypto');

/**
 * Production Build System
 * Comprehensive build process with asset optimization, bundling, and deployment preparation
 */
class BuildSystem {
  constructor() {
    this.buildDir = path.join(__dirname, '../dist');
    this.publicDir = path.join(__dirname, '../public');
    this.tempDir = path.join(__dirname, '../.build-temp');
    this.buildManifest = {};
    this.buildStats = {
      startTime: Date.now(),
      steps: [],
      errors: [],
      warnings: []
    };
  }

  async build() {
    console.log('🚀 Starting production build process...');
    this.logStep('BUILD_START', 'Build process initiated');

    try {
      // Clean and prepare
      await this.cleanBuildDirectories();
      await this.createBuildDirectories();
      
      // Run build steps
      await this.lintCode();
      await this.runTests();
      await this.optimizeAssets();
      await this.bundleAssets();
      await this.generateServiceWorker();
      await this.optimizeHtml();
      await this.generateManifest();
      await this.generateSitemap();
      await this.securityScan();
      await this.performanceAnalysis();
      
      // Finalize
      await this.generateBuildReport();
      await this.cleanup();
      
      console.log('✅ Build completed successfully!');
      this.logStep('BUILD_SUCCESS', 'Build process completed');
      
    } catch (error) {
      console.error('❌ Build failed:', error.message);
      this.logStep('BUILD_ERROR', error.message);
      this.buildStats.errors.push(error.message);
      process.exit(1);
    }
  }

  async cleanBuildDirectories() {
    console.log('🧹 Cleaning build directories...');
    
    const dirsToClean = [this.buildDir, this.tempDir];
    
    for (const dir of dirsToClean) {
      if (fs.existsSync(dir)) {
        fs.rmSync(dir, { recursive: true, force: true });
      }
    }
    
    this.logStep('CLEAN', 'Build directories cleaned');
  }

  async createBuildDirectories() {
    console.log('📁 Creating build directories...');
    
    const dirsToCreate = [
      this.buildDir,
      this.tempDir,
      path.join(this.buildDir, 'assets'),
      path.join(this.buildDir, 'assets/css'),
      path.join(this.buildDir, 'assets/js'),
      path.join(this.buildDir, 'assets/images')
    ];
    
    for (const dir of dirsToCreate) {
      fs.mkdirSync(dir, { recursive: true });
    }
    
    this.logStep('CREATE_DIRS', 'Build directories created');
  }

  async lintCode() {
    console.log('🔍 Running code linting...');
    
    try {
      execSync('npm run lint', { stdio: 'pipe' });
      this.logStep('LINT', 'Code linting passed');
    } catch (error) {
      const output = error.stdout?.toString() || error.stderr?.toString() || error.message;
      
      // Check if there are fixable issues
      if (output.includes('fixable')) {
        console.log('🔧 Attempting to fix linting issues...');
        try {
          execSync('npm run lint:fix', { stdio: 'pipe' });
          this.logStep('LINT_FIX', 'Linting issues fixed automatically');
        } catch (fixError) {
          throw new Error(`Linting failed: ${output}`);
        }
      } else {
        throw new Error(`Linting failed: ${output}`);
      }
    }
  }

  async runTests() {
    console.log('🧪 Running tests...');
    
    try {
      execSync('npm run test:ci', { stdio: 'pipe' });
      this.logStep('TESTS', 'All tests passed');
    } catch (error) {
      const output = error.stdout?.toString() || error.stderr?.toString() || error.message;
      throw new Error(`Tests failed: ${output}`);
    }
  }

  async optimizeAssets() {
    console.log('🎨 Optimizing assets...');
    
    // Optimize CSS
    await this.optimizeCSS();
    
    // Optimize JavaScript
    await this.optimizeJavaScript();
    
    // Optimize images
    await this.optimizeImages();
    
    this.logStep('OPTIMIZE_ASSETS', 'Assets optimized');
  }

  async optimizeCSS() {
    console.log('  📝 Optimizing CSS...');
    
    const cssFiles = ['styles.css'];
    
    for (const file of cssFiles) {
      const inputPath = path.join(__dirname, '..', file);
      const outputPath = path.join(this.buildDir, 'assets/css', file.replace('.css', '.min.css'));
      
      if (fs.existsSync(inputPath)) {
        try {
          // Read and process CSS
          let css = fs.readFileSync(inputPath, 'utf8');
          
          // Remove comments
          css = css.replace(/\/\*[\s\S]*?\*\//g, '');
          
          // Remove unnecessary whitespace
          css = css.replace(/\s+/g, ' ');
          css = css.replace(/;\s*}/g, '}');
          css = css.replace(/\s*{\s*/g, '{');
          css = css.replace(/;\s*/g, ';');
          css = css.trim();
          
          // Add cache busting hash
          const hash = this.generateHash(css);
          const hashedFilename = file.replace('.css', `.${hash}.min.css`);
          const hashedOutputPath = path.join(this.buildDir, 'assets/css', hashedFilename);
          
          fs.writeFileSync(hashedOutputPath, css);
          
          this.buildManifest[`css/${file}`] = `assets/css/${hashedFilename}`;
          
          console.log(`    ✓ ${file} → ${hashedFilename}`);
        } catch (error) {
          this.buildStats.warnings.push(`CSS optimization failed for ${file}: ${error.message}`);
        }
      }
    }
  }

  async optimizeJavaScript() {
    console.log('  📜 Optimizing JavaScript...');
    
    const jsFiles = ['script.js'];
    
    for (const file of jsFiles) {
      const inputPath = path.join(__dirname, '..', file);
      const outputPath = path.join(this.buildDir, 'assets/js', file.replace('.js', '.min.js'));
      
      if (fs.existsSync(inputPath)) {
        try {
          // Read JavaScript
          let js = fs.readFileSync(inputPath, 'utf8');
          
          // Basic minification (for production, consider using terser or uglify-js)
          js = js.replace(/\/\*[\s\S]*?\*\//g, ''); // Remove multi-line comments
          js = js.replace(/\/\/.*$/gm, ''); // Remove single-line comments
          js = js.replace(/\s+/g, ' '); // Collapse whitespace
          js = js.replace(/;\s*}/g, '}'); // Remove unnecessary semicolons
          js = js.trim();
          
          // Add cache busting hash
          const hash = this.generateHash(js);
          const hashedFilename = file.replace('.js', `.${hash}.min.js`);
          const hashedOutputPath = path.join(this.buildDir, 'assets/js', hashedFilename);
          
          fs.writeFileSync(hashedOutputPath, js);
          
          this.buildManifest[`js/${file}`] = `assets/js/${hashedFilename}`;
          
          console.log(`    ✓ ${file} → ${hashedFilename}`);
        } catch (error) {
          this.buildStats.warnings.push(`JS optimization failed for ${file}: ${error.message}`);
        }
      }
    }
  }

  async optimizeImages() {
    console.log('  🖼️ Optimizing images...');
    
    try {
      // Run image optimization script
      execSync('npm run optimize:images', { stdio: 'pipe' });
      
      // Copy optimized images to build directory
      const optimizedDir = path.join(__dirname, '../optimized');
      if (fs.existsSync(optimizedDir)) {
        this.copyDirectory(optimizedDir, path.join(this.buildDir, 'assets/images'));
      }
      
      console.log('    ✓ Images optimized');
    } catch (error) {
      this.buildStats.warnings.push(`Image optimization warning: ${error.message}`);
    }
  }

  async bundleAssets() {
    console.log('📦 Bundling assets...');
    
    // Create asset bundles for better caching
    await this.createCSSBundle();
    await this.createJSBundle();
    
    this.logStep('BUNDLE', 'Assets bundled');
  }

  async createCSSBundle() {
    const cssFiles = fs.readdirSync(path.join(this.buildDir, 'assets/css'));
    
    if (cssFiles.length > 0) {
      let bundledCSS = '';
      
      for (const file of cssFiles) {
        const filePath = path.join(this.buildDir, 'assets/css', file);
        bundledCSS += fs.readFileSync(filePath, 'utf8');
      }
      
      const hash = this.generateHash(bundledCSS);
      const bundleName = `bundle.${hash}.min.css`;
      const bundlePath = path.join(this.buildDir, 'assets/css', bundleName);
      
      fs.writeFileSync(bundlePath, bundledCSS);
      this.buildManifest['css/bundle'] = `assets/css/${bundleName}`;
      
      console.log(`  ✓ CSS bundle created: ${bundleName}`);
    }
  }

  async createJSBundle() {
    const jsFiles = fs.readdirSync(path.join(this.buildDir, 'assets/js'));
    
    if (jsFiles.length > 0) {
      let bundledJS = '';
      
      for (const file of jsFiles) {
        const filePath = path.join(this.buildDir, 'assets/js', file);
        bundledJS += fs.readFileSync(filePath, 'utf8');
      }
      
      const hash = this.generateHash(bundledJS);
      const bundleName = `bundle.${hash}.min.js`;
      const bundlePath = path.join(this.buildDir, 'assets/js', bundleName);
      
      fs.writeFileSync(bundlePath, bundledJS);
      this.buildManifest['js/bundle'] = `assets/js/${bundleName}`;
      
      console.log(`  ✓ JS bundle created: ${bundleName}`);
    }
  }

  async generateServiceWorker() {
    console.log('⚙️ Generating service worker...');
    
    const swTemplate = `// Service Worker - Generated at build time
const CACHE_NAME = 'revengers-esports-v${Date.now()}';
const urlsToCache = [
  '/',
  '/index.html',
  '${this.buildManifest['css/bundle'] || '/styles.css'}',
  '${this.buildManifest['js/bundle'] || '/script.js'}'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(urlsToCache))
  );
});

self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        if (response) {
          return response;
        }
        return fetch(event.request);
      }
    )
  );
});`;
    
    fs.writeFileSync(path.join(this.buildDir, 'service-worker.js'), swTemplate);
    this.logStep('SERVICE_WORKER', 'Service worker generated');
  }

  async optimizeHtml() {
    console.log('📄 Optimizing HTML files...');
    
    const htmlFiles = ['index.html', 'about.html', 'contact.html', 'players.html', 'managers.html', 'trophies.html', 'registered-users.html'];
    
    for (const file of htmlFiles) {
      const inputPath = path.join(__dirname, '..', file);
      const outputPath = path.join(this.buildDir, file);
      
      if (fs.existsSync(inputPath)) {
        let html = fs.readFileSync(inputPath, 'utf8');
        
        // Replace asset references with optimized versions
        html = this.replaceAssetReferences(html);
        
        // Minify HTML
        html = this.minifyHtml(html);
        
        fs.writeFileSync(outputPath, html);
        console.log(`  ✓ ${file} optimized`);
      }
    }
    
    this.logStep('HTML_OPTIMIZE', 'HTML files optimized');
  }

  replaceAssetReferences(html) {
    // Replace CSS references
    if (this.buildManifest['css/bundle']) {
      html = html.replace(/href="styles\.css"/, `href="${this.buildManifest['css/bundle']}"`);
    }
    
    // Replace JS references
    if (this.buildManifest['js/bundle']) {
      html = html.replace(/src="script\.js"/, `src="${this.buildManifest['js/bundle']}"`);
    }
    
    return html;
  }

  minifyHtml(html) {
    // Basic HTML minification
    return html
      .replace(/<!--[\s\S]*?-->/g, '') // Remove comments
      .replace(/\s+/g, ' ') // Collapse whitespace
      .replace(/> </g, '><') // Remove space between tags
      .trim();
  }

  async generateManifest() {
    console.log('📋 Generating build manifest...');
    
    const manifestPath = path.join(this.buildDir, 'manifest.json');
    fs.writeFileSync(manifestPath, JSON.stringify(this.buildManifest, null, 2));
    
    this.logStep('MANIFEST', 'Build manifest generated');
  }

  async generateSitemap() {
    console.log('🗺️ Generating sitemap...');
    
    const baseUrl = 'https://revengers-esports.onrender.com';
    const pages = [
      { url: '/', priority: '1.0', changefreq: 'weekly' },
      { url: '/about.html', priority: '0.8', changefreq: 'monthly' },
      { url: '/players.html', priority: '0.9', changefreq: 'weekly' },
      { url: '/managers.html', priority: '0.7', changefreq: 'monthly' },
      { url: '/trophies.html', priority: '0.8', changefreq: 'monthly' },
      { url: '/contact.html', priority: '0.6', changefreq: 'yearly' }
    ];
    
    const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${pages.map(page => `  <url>
    <loc>${baseUrl}${page.url}</loc>
    <changefreq>${page.changefreq}</changefreq>
    <priority>${page.priority}</priority>
    <lastmod>${new Date().toISOString().split('T')[0]}</lastmod>
  </url>`).join('\n')}
</urlset>`;
    
    fs.writeFileSync(path.join(this.buildDir, 'sitemap.xml'), sitemap);
    this.logStep('SITEMAP', 'Sitemap generated');
  }

  async securityScan() {
    console.log('🔒 Running security scan...');
    
    try {
      execSync('npm audit --audit-level=moderate', { stdio: 'pipe' });
      this.logStep('SECURITY_SCAN', 'Security scan passed');
    } catch (error) {
      const output = error.stdout?.toString() || error.stderr?.toString();
      if (output.includes('vulnerabilities')) {
        this.buildStats.warnings.push('Security vulnerabilities detected - run npm audit fix');
      }
    }
  }

  async performanceAnalysis() {
    console.log('⚡ Analyzing performance...');
    
    const stats = {
      buildTime: Date.now() - this.buildStats.startTime,
      bundleSizes: {},
      totalSize: 0
    };
    
    // Calculate bundle sizes
    const assetsDir = path.join(this.buildDir, 'assets');
    if (fs.existsSync(assetsDir)) {
      this.calculateDirectorySize(assetsDir, stats.bundleSizes);
      stats.totalSize = Object.values(stats.bundleSizes).reduce((sum, size) => sum + size, 0);
    }
    
    this.buildStats.performance = stats;
    this.logStep('PERFORMANCE', `Performance analysis completed - Total size: ${this.formatBytes(stats.totalSize)}`);
  }

  calculateDirectorySize(dir, sizes, prefix = '') {
    const items = fs.readdirSync(dir);
    
    for (const item of items) {
      const itemPath = path.join(dir, item);
      const stat = fs.statSync(itemPath);
      
      if (stat.isDirectory()) {
        this.calculateDirectorySize(itemPath, sizes, `${prefix}${item}/`);
      } else {
        sizes[`${prefix}${item}`] = stat.size;
      }
    }
  }

  async generateBuildReport() {
    console.log('📊 Generating build report...');
    
    const report = {
      buildId: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      duration: Date.now() - this.buildStats.startTime,
      status: this.buildStats.errors.length > 0 ? 'failed' : 'success',
      steps: this.buildStats.steps,
      errors: this.buildStats.errors,
      warnings: this.buildStats.warnings,
      manifest: this.buildManifest,
      performance: this.buildStats.performance,
      environment: {
        node: process.version,
        platform: process.platform,
        arch: process.arch
      }
    };
    
    const reportPath = path.join(this.buildDir, 'build-report.json');
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    
    console.log(`\n📋 Build Report:`);
    console.log(`   Duration: ${this.formatDuration(report.duration)}`);
    console.log(`   Status: ${report.status}`);
    console.log(`   Warnings: ${report.warnings.length}`);
    console.log(`   Errors: ${report.errors.length}`);
    
    if (report.performance) {
      console.log(`   Total Bundle Size: ${this.formatBytes(report.performance.totalSize)}`);
    }
    
    this.logStep('BUILD_REPORT', 'Build report generated');
  }

  async cleanup() {
    console.log('🧹 Cleaning up temporary files...');
    
    if (fs.existsSync(this.tempDir)) {
      fs.rmSync(this.tempDir, { recursive: true, force: true });
    }
    
    this.logStep('CLEANUP', 'Temporary files cleaned');
  }

  // Utility methods
  generateHash(content) {
    return crypto.createHash('md5').update(content).digest('hex').substring(0, 8);
  }

  logStep(step, message) {
    this.buildStats.steps.push({
      step,
      message,
      timestamp: Date.now()
    });
  }

  formatBytes(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  formatDuration(ms) {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    
    if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`;
    }
    return `${seconds}s`;
  }

  copyDirectory(src, dest) {
    if (!fs.existsSync(dest)) {
      fs.mkdirSync(dest, { recursive: true });
    }
    
    const items = fs.readdirSync(src);
    
    for (const item of items) {
      const srcPath = path.join(src, item);
      const destPath = path.join(dest, item);
      
      const stat = fs.statSync(srcPath);
      
      if (stat.isDirectory()) {
        this.copyDirectory(srcPath, destPath);
      } else {
        fs.copyFileSync(srcPath, destPath);
      }
    }
  }
}

// CLI interface
if (require.main === module) {
  const buildSystem = new BuildSystem();
  buildSystem.build();
}

module.exports = BuildSystem;