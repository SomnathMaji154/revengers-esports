const express = require('express');
const monitoring = require('./monitoring');

const router = express.Router();

/**
 * Basic health check endpoint
 */
router.get('/health', (req, res) => {
    try {
        const health = monitoring.getHealthStatus();
        
        res.status(health.status === 'healthy' ? 200 : 503).json({
            status: health.status,
            timestamp: health.timestamp,
            uptime: health.uptime,
            version: process.env.npm_package_version || '1.0.0',
            environment: process.env.NODE_ENV || 'development'
        });
    } catch (error) {
        res.status(500).json({
            status: 'error',
            message: 'Health check failed',
            timestamp: new Date().toISOString()
        });
    }
});

/**
 * Detailed health status with metrics
 */
router.get('/health/detailed', (req, res) => {
    try {
        const health = monitoring.getHealthStatus();
        res.json(health);
    } catch (error) {
        res.status(500).json({
            status: 'error',
            message: 'Detailed health check failed',
            error: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

/**
 * Application readiness check
 */
router.get('/ready', async (req, res) => {
    try {
        // Check database connectivity
        const db = require('./database');
        await db.query('SELECT 1');
        
        // Check critical services
        const health = monitoring.getHealthStatus();
        const isReady = health.status !== 'unhealthy' && 
                       health.metrics.requests.pending < 100;
        
        res.status(isReady ? 200 : 503).json({
            ready: isReady,
            checks: {
                database: 'ok',
                monitoring: 'ok',
                pendingRequests: health.metrics.requests.pending
            },
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        res.status(503).json({
            ready: false,
            checks: {
                database: 'error',
                monitoring: 'unknown',
                error: error.message
            },
            timestamp: new Date().toISOString()
        });
    }
});

/**
 * Application liveness check
 */
router.get('/live', (req, res) => {
    // Simple liveness check - if we can respond, we're alive
    res.json({
        alive: true,
        pid: process.pid,
        uptime: process.uptime(),
        memoryUsage: process.memoryUsage(),
        timestamp: new Date().toISOString()
    });
});

/**
 * Metrics endpoint (Prometheus-style)
 */
router.get('/metrics', (req, res) => {
    try {
        const metrics = monitoring.getDetailedMetrics();
        const health = monitoring.getHealthStatus();
        
        // Generate Prometheus-style metrics
        let output = '';
        
        // Request metrics
        output += `# HELP http_requests_total Total number of HTTP requests\n`;
        output += `# TYPE http_requests_total counter\n`;
        output += `http_requests_total ${metrics.requests.total}\n\n`;
        
        output += `# HELP http_request_errors_total Total number of HTTP request errors\n`;
        output += `# TYPE http_request_errors_total counter\n`;
        output += `http_request_errors_total ${metrics.requests.errors}\n\n`;
        
        output += `# HELP http_requests_pending Current number of pending HTTP requests\n`;
        output += `# TYPE http_requests_pending gauge\n`;
        output += `http_requests_pending ${metrics.requests.pending}\n\n`;
        
        // Database metrics
        output += `# HELP database_queries_total Total number of database queries\n`;
        output += `# TYPE database_queries_total counter\n`;
        output += `database_queries_total ${metrics.database.queries}\n\n`;
        
        output += `# HELP database_slow_queries_total Total number of slow database queries\n`;
        output += `# TYPE database_slow_queries_total counter\n`;
        output += `database_slow_queries_total ${metrics.database.slow_queries}\n\n`;
        
        // Security metrics
        output += `# HELP security_blocked_requests_total Total number of blocked requests\n`;
        output += `# TYPE security_blocked_requests_total counter\n`;
        output += `security_blocked_requests_total ${metrics.security.blocked_requests}\n\n`;
        
        // System metrics
        const latestMemory = metrics.memory[metrics.memory.length - 1];
        if (latestMemory) {
            output += `# HELP memory_usage_percent Current memory usage percentage\n`;
            output += `# TYPE memory_usage_percent gauge\n`;
            output += `memory_usage_percent ${latestMemory.systemPercent}\n\n`;
            
            output += `# HELP memory_heap_used_bytes Current heap memory used in bytes\n`;
            output += `# TYPE memory_heap_used_bytes gauge\n`;
            output += `memory_heap_used_bytes ${latestMemory.heapUsed}\n\n`;
        }
        
        // Application uptime
        output += `# HELP application_uptime_seconds Application uptime in seconds\n`;
        output += `# TYPE application_uptime_seconds gauge\n`;
        output += `application_uptime_seconds ${metrics.uptime}\n\n`;
        
        // Health score
        output += `# HELP application_health_score Current application health score (0-100)\n`;
        output += `# TYPE application_health_score gauge\n`;
        output += `application_health_score ${health.score}\n\n`;
        
        res.set('Content-Type', 'text/plain').send(output);
    } catch (error) {
        res.status(500).json({
            error: 'Failed to generate metrics',
            message: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

/**
 * Alerts endpoint
 */
router.get('/alerts', (req, res) => {
    try {
        const health = monitoring.getHealthStatus();
        const severity = req.query.severity;
        
        let alerts = health.alerts;
        if (severity) {
            alerts = alerts.filter(alert => alert.severity === severity);
        }
        
        res.json({
            alerts,
            total: alerts.length,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        res.status(500).json({
            error: 'Failed to retrieve alerts',
            message: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

/**
 * Performance metrics endpoint
 */
router.get('/performance', (req, res) => {
    try {
        const metrics = monitoring.getDetailedMetrics();
        const timeframe = parseInt(req.query.timeframe) || 300000; // 5 minutes default
        const since = Date.now() - timeframe;
        
        const recentRequests = metrics.response_times.filter(
            req => req.timestamp > since
        );
        
        const avgResponseTime = recentRequests.length > 0
            ? recentRequests.reduce((sum, req) => sum + req.responseTime, 0) / recentRequests.length
            : 0;
        
        const p95ResponseTime = recentRequests.length > 0
            ? recentRequests.map(r => r.responseTime).sort((a, b) => a - b)[Math.floor(recentRequests.length * 0.95)]
            : 0;
        
        const errorRate = recentRequests.length > 0
            ? (recentRequests.filter(req => req.statusCode >= 400).length / recentRequests.length) * 100
            : 0;
        
        res.json({
            timeframe: `${timeframe / 1000}s`,
            requests: {
                total: recentRequests.length,
                averageResponseTime: Math.round(avgResponseTime),
                p95ResponseTime: Math.round(p95ResponseTime),
                errorRate: parseFloat(errorRate.toFixed(2))
            },
            database: {
                queries: metrics.database.queries,
                slowQueries: metrics.database.slow_queries,
                errors: metrics.database.errors
            },
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        res.status(500).json({
            error: 'Failed to retrieve performance metrics',
            message: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

/**
 * System information endpoint
 */
router.get('/system', (req, res) => {
    try {
        const os = require('os');
        
        res.json({
            system: {
                platform: os.platform(),
                arch: os.arch(),
                release: os.release(),
                cpus: os.cpus().length,
                totalMemory: os.totalmem(),
                freeMemory: os.freemem(),
                loadAverage: os.loadavg(),
                uptime: os.uptime()
            },
            process: {
                pid: process.pid,
                version: process.version,
                uptime: process.uptime(),
                memoryUsage: process.memoryUsage(),
                cpuUsage: process.cpuUsage(),
                env: process.env.NODE_ENV || 'development'
            },
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        res.status(500).json({
            error: 'Failed to retrieve system information',
            message: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

module.exports = router;