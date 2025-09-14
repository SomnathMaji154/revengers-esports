/**
 * Frontend Performance Optimization Module
 * Advanced lazy loading, code splitting, and performance monitoring for the client-side
 */

class PerformanceOptimizer {
  constructor() {
    this.observer = null;
    this.loadedModules = new Set();
    this.performanceMetrics = {
      pageLoadTime: 0,
      firstContentfulPaint: 0,
      largestContentfulPaint: 0,
      cumulativeLayoutShift: 0,
      firstInputDelay: 0
    };
    
    this.init();
  }

  init() {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => this.setup());
    } else {
      this.setup();
    }
  }

  setup() {
    this.setupIntersectionObserver();
    this.setupImageLazyLoading();
    this.setupContentLazyLoading();
    this.optimizeAssets();
    this.measurePerformance();
    this.preloadCriticalResources();
    this.setupServiceWorker();
  }

  /**
   * Set up Intersection Observer for lazy loading
   */
  setupIntersectionObserver() {
    if (!('IntersectionObserver' in window)) {
      // Fallback for older browsers
      this.loadAllContent();
      return;
    }

    this.observer = new IntersectionObserver(
      (entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            this.loadElement(entry.target);
            this.observer.unobserve(entry.target);
          }
        });
      },
      {
        rootMargin: '50px 0px', // Start loading 50px before element comes into view
        threshold: 0.1
      }
    );
  }

  /**
   * Set up lazy loading for images
   */
  setupImageLazyLoading() {
    // Find all images with data-src attribute
    const lazyImages = document.querySelectorAll('img[data-src]');
    
    lazyImages.forEach(img => {
      // Add loading placeholder
      img.style.backgroundColor = '#f0f0f0';
      img.style.minHeight = '200px';
      
      if (this.observer) {
        this.observer.observe(img);
      } else {
        this.loadImage(img);
      }
    });

    // Handle images with srcset for responsive loading
    const responsiveImages = document.querySelectorAll('img[data-srcset]');
    responsiveImages.forEach(img => {
      if (this.observer) {
        this.observer.observe(img);
      } else {
        this.loadResponsiveImage(img);
      }
    });
  }

  /**
   * Set up lazy loading for content sections
   */
  setupContentLazyLoading() {
    const lazyContent = document.querySelectorAll('[data-lazy-load]');
    
    lazyContent.forEach(element => {
      if (this.observer) {
        this.observer.observe(element);
      } else {
        this.loadContent(element);
      }
    });
  }

  /**
   * Load an element based on its type
   */
  loadElement(element) {
    if (element.tagName === 'IMG') {
      if (element.hasAttribute('data-srcset')) {
        this.loadResponsiveImage(element);
      } else {
        this.loadImage(element);
      }
    } else if (element.hasAttribute('data-lazy-load')) {
      this.loadContent(element);
    }
  }

  /**
   * Load a single image
   */
  loadImage(img) {
    const src = img.getAttribute('data-src');
    if (!src) return;

    // Create a new image to test loading
    const imageLoader = new Image();
    
    imageLoader.onload = () => {
      img.src = src;
      img.classList.add('loaded');
      img.style.backgroundColor = 'transparent';
      
      // Remove data-src to prevent reloading
      img.removeAttribute('data-src');
      
      // Trigger fade-in animation
      img.style.opacity = '0';
      img.style.transition = 'opacity 0.3s ease-in-out';
      requestAnimationFrame(() => {
        img.style.opacity = '1';
      });
    };
    
    imageLoader.onerror = () => {
      img.alt = 'Failed to load image';
      img.style.backgroundColor = '#ffebee';
      img.style.border = '2px dashed #f44336';
    };
    
    imageLoader.src = src;
  }

  /**
   * Load responsive image with srcset
   */
  loadResponsiveImage(img) {
    const srcset = img.getAttribute('data-srcset');
    const src = img.getAttribute('data-src');
    
    if (srcset) {
      img.srcset = srcset;
    }
    if (src) {
      img.src = src;
    }
    
    img.classList.add('loaded');
    img.removeAttribute('data-srcset');
    img.removeAttribute('data-src');
  }

  /**
   * Load content dynamically
   */
  async loadContent(element) {
    const contentType = element.getAttribute('data-lazy-load');
    const contentUrl = element.getAttribute('data-content-url');
    
    element.innerHTML = '<div class=\"loading-spinner\">Loading...</div>';
    
    try {
      switch (contentType) {
        case 'players':
          await this.loadPlayersContent(element);
          break;
        case 'managers':
          await this.loadManagersContent(element);
          break;
        case 'trophies':
          await this.loadTrophiesContent(element);
          break;
        case 'external':
          if (contentUrl) {
            await this.loadExternalContent(element, contentUrl);
          }
          break;
        default:
          element.innerHTML = '<p>Unknown content type</p>';
      }
    } catch (error) {
      console.error('Failed to load content:', error);
      element.innerHTML = '<p class=\"error\">Failed to load content. Please try again later.</p>';
    }
  }

  /**
   * Load players content
   */
  async loadPlayersContent(element) {
    try {
      const response = await fetch('/api/players');
      if (!response.ok) throw new Error('Failed to fetch players');
      
      const players = await response.json();
      element.innerHTML = this.generatePlayersHTML(players);
      
      // Set up lazy loading for player images
      const playerImages = element.querySelectorAll('img[data-src]');
      playerImages.forEach(img => {
        if (this.observer) {
          this.observer.observe(img);
        } else {
          this.loadImage(img);
        }
      });
    } catch (error) {
      throw error;
    }
  }

  /**
   * Load managers content
   */
  async loadManagersContent(element) {
    try {
      const response = await fetch('/api/managers');
      if (!response.ok) throw new Error('Failed to fetch managers');
      
      const managers = await response.json();
      element.innerHTML = this.generateManagersHTML(managers);
    } catch (error) {
      throw error;
    }
  }

  /**
   * Load trophies content
   */
  async loadTrophiesContent(element) {
    try {
      const response = await fetch('/api/trophies');
      if (!response.ok) throw new Error('Failed to fetch trophies');
      
      const trophies = await response.json();
      element.innerHTML = this.generateTrophiesHTML(trophies);
    } catch (error) {
      throw error;
    }
  }

  /**
   * Load external content
   */
  async loadExternalContent(element, url) {
    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error('Failed to fetch external content');
      
      const content = await response.text();
      element.innerHTML = content;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Generate HTML for players
   */
  generatePlayersHTML(players) {
    if (!players || players.length === 0) {
      return '<p class=\"no-content\">No players found.</p>';
    }
    
    return `
      <div class=\"players-grid\">
        ${players.map(player => `
          <div class=\"player-card\" data-player-id=\"${player.id}\">
            <div class=\"player-image\">
              <img data-src=\"${player.imageUrl || '/images/default-player.jpg'}\" 
                   alt=\"${player.name}\" 
                   class=\"lazy-image\" />
            </div>
            <div class=\"player-info\">
              <h3>${this.escapeHtml(player.name)}</h3>
              <p class=\"jersey-number\">#${player.jerseyNumber}</p>
              <div class=\"stars\" data-rating=\"${player.stars}\">
                ${this.generateStars(player.stars)}
              </div>
            </div>
          </div>
        `).join('')}
      </div>
    `;
  }

  /**
   * Generate HTML for managers
   */
  generateManagersHTML(managers) {
    if (!managers || managers.length === 0) {
      return '<p class=\"no-content\">No managers found.</p>';
    }
    
    return `
      <div class=\"managers-grid\">
        ${managers.map(manager => `
          <div class=\"manager-card\" data-manager-id=\"${manager.id}\">
            <div class=\"manager-image\">
              <img data-src=\"${manager.imageUrl || '/images/default-manager.jpg'}\" 
                   alt=\"${manager.name}\" 
                   class=\"lazy-image\" />
            </div>
            <div class=\"manager-info\">
              <h3>${this.escapeHtml(manager.name)}</h3>
              <p class=\"role\">${this.escapeHtml(manager.role)}</p>
            </div>
          </div>
        `).join('')}
      </div>
    `;
  }

  /**
   * Generate HTML for trophies
   */
  generateTrophiesHTML(trophies) {
    if (!trophies || trophies.length === 0) {
      return '<p class=\"no-content\">No trophies found.</p>';
    }
    
    return `
      <div class=\"trophies-grid\">
        ${trophies.map(trophy => `
          <div class=\"trophy-card\" data-trophy-id=\"${trophy.id}\">
            <div class=\"trophy-image\">
              <img data-src=\"${trophy.imageUrl || '/images/default-trophy.jpg'}\" 
                   alt=\"${trophy.name}\" 
                   class=\"lazy-image\" />
            </div>
            <div class=\"trophy-info\">
              <h3>${this.escapeHtml(trophy.name)}</h3>
              <p class=\"year\">${trophy.year}</p>
            </div>
          </div>
        `).join('')}
      </div>
    `;
  }

  /**
   * Generate star rating HTML
   */
  generateStars(rating) {
    const fullStars = Math.floor(rating);
    const hasHalfStar = rating % 1 !== 0;
    const emptyStars = 5 - Math.ceil(rating);
    
    let starsHTML = '';
    
    // Full stars
    for (let i = 0; i < fullStars; i++) {
      starsHTML += '<span class=\"star full\">★</span>';
    }
    
    // Half star
    if (hasHalfStar) {
      starsHTML += '<span class=\"star half\">★</span>';
    }
    
    // Empty stars
    for (let i = 0; i < emptyStars; i++) {
      starsHTML += '<span class=\"star empty\">☆</span>';
    }
    
    return starsHTML;
  }

  /**
   * Optimize assets for better performance
   */
  optimizeAssets() {
    // Preload critical CSS
    this.preloadCriticalCSS();
    
    // Optimize font loading
    this.optimizeFontLoading();
    
    // Minimize main thread blocking
    this.deferNonCriticalCSS();
    
    // Optimize third-party scripts
    this.optimizeThirdPartyScripts();
  }

  /**
   * Preload critical CSS
   */
  preloadCriticalCSS() {
    const criticalStyles = [
      '/styles.css'
    ];
    
    criticalStyles.forEach(href => {
      const link = document.createElement('link');
      link.rel = 'preload';
      link.as = 'style';
      link.href = href;
      link.onload = function() {
        this.onload = null;
        this.rel = 'stylesheet';
      };
      document.head.appendChild(link);
    });
  }

  /**
   * Optimize font loading
   */
  optimizeFontLoading() {
    // Preload important fonts
    const fonts = [
      'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap'
    ];
    
    fonts.forEach(href => {
      const link = document.createElement('link');
      link.rel = 'preload';
      link.as = 'style';
      link.href = href;
      document.head.appendChild(link);
    });
  }

  /**
   * Defer non-critical CSS
   */
  deferNonCriticalCSS() {
    const nonCriticalCSS = document.querySelectorAll('link[rel=\"stylesheet\"][data-defer]');
    
    nonCriticalCSS.forEach(link => {
      link.media = 'print';
      link.onload = function() {
        this.media = 'all';
      };
    });
  }

  /**
   * Optimize third-party scripts
   */
  optimizeThirdPartyScripts() {
    // Defer third-party scripts until user interaction
    const thirdPartyScripts = document.querySelectorAll('script[data-third-party]');
    
    const loadThirdPartyScripts = () => {
      thirdPartyScripts.forEach(script => {
        const newScript = document.createElement('script');
        newScript.src = script.getAttribute('data-src');
        newScript.async = true;
        document.head.appendChild(newScript);
      });
      
      // Remove event listeners after loading
      ['mousedown', 'touchstart', 'keydown', 'scroll'].forEach(event => {
        document.removeEventListener(event, loadThirdPartyScripts, { passive: true });
      });
    };
    
    // Load on first user interaction
    ['mousedown', 'touchstart', 'keydown', 'scroll'].forEach(event => {
      document.addEventListener(event, loadThirdPartyScripts, { passive: true });
    });
  }

  /**
   * Measure performance metrics
   */
  measurePerformance() {
    // Performance API support
    if (!('performance' in window)) return;
    
    // Page load time
    window.addEventListener('load', () => {
      const navigation = performance.getEntriesByType('navigation')[0];
      this.performanceMetrics.pageLoadTime = navigation.loadEventEnd - navigation.fetchStart;
    });
    
    // Core Web Vitals
    this.measureCoreWebVitals();
    
    // Resource timing
    this.analyzeResourceTiming();
  }

  /**
   * Measure Core Web Vitals
   */
  measureCoreWebVitals() {
    // First Contentful Paint
    const fcpObserver = new PerformanceObserver((entryList) => {
      const entries = entryList.getEntries();
      const fcp = entries[entries.length - 1];
      this.performanceMetrics.firstContentfulPaint = fcp.startTime;
    });
    
    try {
      fcpObserver.observe({ entryTypes: ['paint'] });
    } catch (e) {
      // Ignore if not supported
    }
    
    // Largest Contentful Paint
    const lcpObserver = new PerformanceObserver((entryList) => {
      const entries = entryList.getEntries();
      const lcp = entries[entries.length - 1];
      this.performanceMetrics.largestContentfulPaint = lcp.startTime;
    });
    
    try {
      lcpObserver.observe({ entryTypes: ['largest-contentful-paint'] });
    } catch (e) {
      // Ignore if not supported
    }
    
    // Cumulative Layout Shift
    let clsValue = 0;
    const clsObserver = new PerformanceObserver((entryList) => {
      for (const entry of entryList.getEntries()) {
        if (!entry.hadRecentInput) {
          clsValue += entry.value;
        }
      }
      this.performanceMetrics.cumulativeLayoutShift = clsValue;
    });
    
    try {
      clsObserver.observe({ entryTypes: ['layout-shift'] });
    } catch (e) {
      // Ignore if not supported
    }
    
    // First Input Delay
    const fidObserver = new PerformanceObserver((entryList) => {
      const entries = entryList.getEntries();
      const fid = entries[0];
      this.performanceMetrics.firstInputDelay = fid.processingStart - fid.startTime;
    });
    
    try {
      fidObserver.observe({ entryTypes: ['first-input'] });
    } catch (e) {
      // Ignore if not supported
    }
  }

  /**
   * Analyze resource timing
   */
  analyzeResourceTiming() {
    window.addEventListener('load', () => {
      const resources = performance.getEntriesByType('resource');
      
      const slowResources = resources.filter(resource => 
        resource.duration > 1000 // Resources taking more than 1 second
      );
      
      if (slowResources.length > 0) {
        console.warn('Slow loading resources detected:', slowResources);
      }
    });
  }

  /**
   * Preload critical resources
   */
  preloadCriticalResources() {
    const criticalResources = [
      { href: '/api/players', as: 'fetch', type: 'application/json' },
      { href: '/api/managers', as: 'fetch', type: 'application/json' },
      { href: '/images/logo.png', as: 'image' }
    ];
    
    criticalResources.forEach(resource => {
      const link = document.createElement('link');
      link.rel = 'preload';
      link.href = resource.href;
      link.as = resource.as;
      if (resource.type) {
        link.type = resource.type;
      }
      document.head.appendChild(link);
    });
  }

  /**
   * Set up service worker for caching
   */
  setupServiceWorker() {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/service-worker.js')
        .then(registration => {
          console.log('Service Worker registered successfully');
        })
        .catch(error => {
          console.log('Service Worker registration failed:', error);
        });
    }
  }

  /**
   * Load all content immediately (fallback for older browsers)
   */
  loadAllContent() {
    const allLazyElements = document.querySelectorAll('[data-src], [data-lazy-load]');
    
    allLazyElements.forEach(element => {
      this.loadElement(element);
    });
  }

  /**
   * Get performance metrics
   */
  getPerformanceMetrics() {
    return { ...this.performanceMetrics };
  }

  /**
   * Escape HTML to prevent XSS
   */
  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  /**
   * Cleanup method
   */
  destroy() {
    if (this.observer) {
      this.observer.disconnect();
    }
  }
}

// Initialize performance optimizer when DOM is ready
if (typeof window !== 'undefined') {
  window.performanceOptimizer = new PerformanceOptimizer();
  
  // Expose performance metrics globally for debugging
  window.getPerformanceMetrics = () => {
    return window.performanceOptimizer.getPerformanceMetrics();
  };
}

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
  module.exports = PerformanceOptimizer;
}