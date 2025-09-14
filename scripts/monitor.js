#!/usr/bin/env node

const performance = require('../backend/performance');
const logger = require('../backend/logger');

/**
 * Performance Monitoring Script
 * Continuously monitors application performance and provides insights
 */

class PerformanceMonitor {
  constructor() {
    this.isRunning = false;
    this.intervalId = null;
    this.reportInterval = 60000; // 1 minute
  }

  start() {
    if (this.isRunning) {
      console.log('⚠️  Performance monitor is already running');
      return;
    }

    console.log('🚀 Starting performance monitor...');
    this.isRunning = true;

    // Initial report
    this.generateReport();

    // Set up periodic monitoring
    this.intervalId = setInterval(() => {
      this.generateReport();
      this.performMaintenance();
    }, this.reportInterval);

    // Graceful shutdown
    process.on('SIGINT', () => this.stop());
    process.on('SIGTERM', () => this.stop());
  }

  stop() {
    if (!this.isRunning) {
      return;
    }

    console.log('🛑 Stopping performance monitor...');
    this.isRunning = false;

    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }

    // Final report
    this.generateReport();
    console.log('✅ Performance monitor stopped');
    process.exit(0);
  }

  generateReport() {
    try {
      const report = performance.getPerformanceReport();
      
      console.log('\n📊 Performance Report', new Date().toLocaleTimeString());
      console.log('═'.repeat(60));
      
      // Memory usage
      console.log(`🧠 Memory Usage:`);
      console.log(`   Heap Used: ${report.memory.heapUsed} MB`);
      console.log(`   Heap Total: ${report.memory.heapTotal} MB`);
      console.log(`   RSS: ${report.memory.rss} MB`);
      
      // Cache performance
      console.log(`\n💾 Cache Performance:`);
      console.log(`   Hit Rate: ${report.cache.hitRate}%`);
      console.log(`   Cache Size: ${report.cache.size} entries`);
      console.log(`   Hits: ${report.cache.hits} | Misses: ${report.cache.misses}`);
      
      // Database performance
      console.log(`\n🗄️  Database Performance:`);
      console.log(`   Average Query Time: ${report.database.averageQueryTime}ms`);
      console.log(`   Slow Queries: ${report.database.slowQueries}`);
      console.log(`   Total Queries: ${report.database.totalQueries}`);
      
      if (report.database.connectionPool) {
        console.log(`   Pool - Total: ${report.database.connectionPool.totalCount}, ` +
                   `Idle: ${report.database.connectionPool.idleCount}, ` +
                   `Waiting: ${report.database.connectionPool.waitingCount}`);
      }
      
      // Recommendations
      if (report.recommendations.length > 0) {
        console.log(`\n💡 Recommendations:`);
        report.recommendations.forEach((rec, index) => {
          console.log(`   ${index + 1}. ${rec}`);
        });
      }
      
      // Health status
      const healthStatus = this.getHealthStatus(report);
      console.log(`\n🏥 Health Status: ${this.getHealthEmoji(healthStatus)} ${healthStatus.toUpperCase()}`);
      
      console.log('═'.repeat(60));
      
      // Log to file for historical analysis
      logger.info('Performance report generated', report);
      
    } catch (error) {
      console.error('❌ Error generating performance report:', error);
      logger.error('Performance monitoring error', { error: error.message });
    }
  }

  getHealthStatus(report) {
    const issues = [];
    
    if (report.memory.heapUsed > 500) issues.push('high_memory');
    if (report.database.averageQueryTime > 500) issues.push('slow_queries');
    if (report.cache.hitRate < 50) issues.push('poor_cache');
    if (report.database.slowQueries > 10) issues.push('many_slow_queries');
    
    if (issues.length === 0) return 'healthy';
    if (issues.length <= 2) return 'warning';
    return 'critical';
  }

  getHealthEmoji(status) {
    switch (status) {
      case 'healthy': return '✅';
      case 'warning': return '⚠️';
      case 'critical': return '🚨';
      default: return '❓';
    }
  }

  performMaintenance() {
    try {
      performance.performMaintenance();
      
      // Additional monitoring-specific maintenance
      const memUsage = process.memoryUsage();
      const heapUsedMB = memUsage.heapUsed / 1024 / 1024;
      
      if (heapUsedMB > 800) { // 800MB threshold for critical alert
        console.log('🚨 CRITICAL: Very high memory usage detected!');
        logger.error('Critical memory usage', { 
          heapUsedMB: Math.round(heapUsedMB),
          threshold: 800
        });
      }
      
    } catch (error) {
      console.error('❌ Error during maintenance:', error);
      logger.error('Performance maintenance error', { error: error.message });
    }
  }

  // Static method for one-time reports
  static async generateOnceReport() {
    console.log('📊 Generating one-time performance report...');
    const monitor = new PerformanceMonitor();
    monitor.generateReport();
    
    // Also run database optimization
    try {
      console.log('\n🔧 Running database optimization...');
      const optimizations = await performance.optimizeDatabase();
      console.log('✅ Database optimization completed:');
      optimizations.forEach(opt => console.log(`   ${opt}`));
    } catch (error) {
      console.error('❌ Database optimization failed:', error);
    }
  }
}

// CLI interface
if (require.main === module) {
  const args = process.argv.slice(2);
  
  if (args.includes('--once') || args.includes('-o')) {
    PerformanceMonitor.generateOnceReport();
  } else if (args.includes('--help') || args.includes('-h')) {
    console.log(`
Performance Monitor Usage:
  node monitor.js           Start continuous monitoring
  node monitor.js --once    Generate single report and exit
  node monitor.js --help    Show this help message

Examples:
  node scripts/monitor.js
  node scripts/monitor.js --once
    `);
  } else {
    const monitor = new PerformanceMonitor();
    monitor.start();
  }
}

module.exports = PerformanceMonitor;