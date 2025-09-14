const os = require('os');
const process = require('process');
const { performance } = require('perf_hooks');

class AdvancedMonitoring {
    constructor() {
        this.metrics = {
            requests: { total: 0, errors: 0, pending: 0 },
            response_times: [],
            memory: [],
            cpu: [],
            database: { queries: 0, slow_queries: 0, errors: 0 },
            security: { blocked_requests: 0, suspicious_activity: 0 },
            uptime: process.uptime()
        };
        this.alerts = new Map();
        this.thresholds = {
            memory_usage: 80, // %
            cpu_usage: 80, // %
            response_time: 2000, // ms
            error_rate: 5, // %
            slow_query_threshold: 1000 // ms
        };
        
        // Don't start timers in test environment
        if (process.env.NODE_ENV !== 'test') {
            this.startSystemMetricsCollection();
        }
    }

    startSystemMetricsCollection() {
        setInterval(() => {
            this.collectSystemMetrics();
        }, 30000); // Every 30 seconds

        setInterval(() => {
            this.checkAlerts();
        }, 60000); // Every minute
    }

    collectSystemMetrics() {
        try {
            // Memory metrics
            const memUsage = process.memoryUsage();
            const totalMem = os.totalmem();
            const freeMem = os.freemem();
            const memPercent = ((totalMem - freeMem) / totalMem) * 100;

            this.metrics.memory.push({
                timestamp: Date.now(),
                rss: memUsage.rss,
                heapUsed: memUsage.heapUsed,
                heapTotal: memUsage.heapTotal,
                external: memUsage.external,
                systemPercent: memPercent
            });

            // Keep only last 100 measurements
            if (this.metrics.memory.length > 100) {
                this.metrics.memory = this.metrics.memory.slice(-100);
            }

            // CPU metrics (approximation)
            const cpuUsage = process.cpuUsage();
            this.metrics.cpu.push({
                timestamp: Date.now(),
                user: cpuUsage.user,
                system: cpuUsage.system,
                loadAverage: os.loadavg()[0]
            });

            if (this.metrics.cpu.length > 100) {
                this.metrics.cpu = this.metrics.cpu.slice(-100);
            }

            // Update uptime
            this.metrics.uptime = process.uptime();

        } catch (error) {
            console.error('Error collecting system metrics:', error);
        }
    }

    recordRequest(method, path, statusCode, responseTime) {
        this.metrics.requests.total++;
        
        if (statusCode >= 400) {
            this.metrics.requests.errors++;
        }

        this.metrics.response_times.push({
            timestamp: Date.now(),
            method,
            path,
            statusCode,
            responseTime
        });

        // Keep only last 1000 requests
        if (this.metrics.response_times.length > 1000) {
            this.metrics.response_times = this.metrics.response_times.slice(-1000);
        }

        // Check for slow responses
        if (responseTime > this.thresholds.response_time) {
            this.triggerAlert('slow_response', {
                method,
                path,
                responseTime,
                threshold: this.thresholds.response_time
            });
        }
    }

    recordDatabaseQuery(query, duration, error = null) {
        this.metrics.database.queries++;
        
        if (error) {
            this.metrics.database.errors++;
        }

        if (duration > this.thresholds.slow_query_threshold) {
            this.metrics.database.slow_queries++;
            this.triggerAlert('slow_query', {
                query: query.substring(0, 100) + '...',
                duration,
                threshold: this.thresholds.slow_query_threshold
            });
        }
    }

    recordSecurityEvent(type, details) {
        if (type === 'blocked_request') {
            this.metrics.security.blocked_requests++;
        } else if (type === 'suspicious_activity') {
            this.metrics.security.suspicious_activity++;
        }

        this.triggerAlert('security_event', { type, details });
    }

    triggerAlert(type, data) {
        const alertKey = `${type}_${Date.now()}`;
        const alert = {
            type,
            data,
            timestamp: new Date().toISOString(),
            severity: this.getAlertSeverity(type, data)
        };

        this.alerts.set(alertKey, alert);

        // Log critical alerts
        if (alert.severity === 'critical') {
            console.error(`CRITICAL ALERT: ${type}`, data);
        } else if (alert.severity === 'warning') {
            console.warn(`WARNING: ${type}`, data);
        }

        // Clean old alerts (keep only last 24 hours)
        const oneDayAgo = Date.now() - (24 * 60 * 60 * 1000);
        for (const [key, alert] of this.alerts.entries()) {
            if (new Date(alert.timestamp).getTime() < oneDayAgo) {
                this.alerts.delete(key);
            }
        }
    }

    getAlertSeverity(type, data) {
        switch (type) {
            case 'slow_response':
                return data.responseTime > this.thresholds.response_time * 2 ? 'critical' : 'warning';
            case 'slow_query':
                return data.duration > this.thresholds.slow_query_threshold * 2 ? 'critical' : 'warning';
            case 'security_event':
                return data.type === 'blocked_request' ? 'warning' : 'critical';
            case 'high_memory_usage':
                return data.percentage > 90 ? 'critical' : 'warning';
            case 'high_cpu_usage':
                return data.percentage > 90 ? 'critical' : 'warning';
            default:
                return 'info';
        }
    }

    checkAlerts() {
        try {
            // Check memory usage
            const latestMemory = this.metrics.memory[this.metrics.memory.length - 1];
            if (latestMemory && latestMemory.systemPercent > this.thresholds.memory_usage) {
                this.triggerAlert('high_memory_usage', {
                    percentage: latestMemory.systemPercent,
                    threshold: this.thresholds.memory_usage
                });
            }

            // Check error rate
            const recentRequests = this.metrics.response_times.filter(
                req => Date.now() - req.timestamp < 300000 // Last 5 minutes
            );
            
            if (recentRequests.length > 10) {
                const errorRate = (recentRequests.filter(req => req.statusCode >= 400).length / recentRequests.length) * 100;
                if (errorRate > this.thresholds.error_rate) {
                    this.triggerAlert('high_error_rate', {
                        rate: errorRate,
                        threshold: this.thresholds.error_rate,
                        timeframe: '5 minutes'
                    });
                }
            }

        } catch (error) {
            console.error('Error checking alerts:', error);
        }
    }

    getHealthStatus() {
        const now = Date.now();
        const fiveMinutesAgo = now - (5 * 60 * 1000);

        // Recent performance metrics
        const recentRequests = this.metrics.response_times.filter(
            req => req.timestamp > fiveMinutesAgo
        );

        const avgResponseTime = recentRequests.length > 0 
            ? recentRequests.reduce((sum, req) => sum + req.responseTime, 0) / recentRequests.length
            : 0;

        const errorRate = recentRequests.length > 0
            ? (recentRequests.filter(req => req.statusCode >= 400).length / recentRequests.length) * 100
            : 0;

        // Current system status
        const latestMemory = this.metrics.memory[this.metrics.memory.length - 1];
        const memoryUsage = latestMemory ? latestMemory.systemPercent : 0;

        // Overall health score
        let healthScore = 100;
        if (avgResponseTime > this.thresholds.response_time) healthScore -= 20;
        if (errorRate > this.thresholds.error_rate) healthScore -= 30;
        if (memoryUsage > this.thresholds.memory_usage) healthScore -= 25;

        const status = healthScore >= 80 ? 'healthy' : healthScore >= 60 ? 'degraded' : 'unhealthy';

        return {
            status,
            score: healthScore,
            uptime: this.metrics.uptime,
            metrics: {
                requests: {
                    total: this.metrics.requests.total,
                    errors: this.metrics.requests.errors,
                    pending: this.metrics.requests.pending,
                    errorRate: errorRate.toFixed(2)
                },
                performance: {
                    averageResponseTime: avgResponseTime.toFixed(2),
                    recentRequests: recentRequests.length
                },
                system: {
                    memoryUsage: memoryUsage.toFixed(2),
                    cpuCount: os.cpus().length,
                    platform: os.platform(),
                    nodeVersion: process.version
                },
                database: this.metrics.database,
                security: this.metrics.security
            },
            alerts: Array.from(this.alerts.values()).slice(-10), // Last 10 alerts
            timestamp: new Date().toISOString()
        };
    }

    getDetailedMetrics() {
        return {
            requests: this.metrics.requests,
            response_times: this.metrics.response_times.slice(-100),
            memory: this.metrics.memory.slice(-50),
            cpu: this.metrics.cpu.slice(-50),
            database: this.metrics.database,
            security: this.metrics.security,
            uptime: this.metrics.uptime,
            alerts: Array.from(this.alerts.values())
        };
    }

    // Middleware for Express.js
    createMiddleware() {
        return (req, res, next) => {
            const startTime = performance.now();
            this.metrics.requests.pending++;

            // Capture response
            const originalSend = res.send;
            res.send = function(body) {
                const endTime = performance.now();
                const responseTime = endTime - startTime;
                
                monitoring.recordRequest(
                    req.method,
                    req.path,
                    res.statusCode,
                    responseTime
                );
                
                monitoring.metrics.requests.pending--;
                return originalSend.call(this, body);
            };

            next();
        };
    }

    // Reset metrics (useful for testing)
    reset() {
        this.metrics = {
            requests: { total: 0, errors: 0, pending: 0 },
            response_times: [],
            memory: [],
            cpu: [],
            database: { queries: 0, slow_queries: 0, errors: 0 },
            security: { blocked_requests: 0, suspicious_activity: 0 },
            uptime: process.uptime()
        };
        this.alerts.clear();
    }
}

// Singleton instance
const monitoring = new AdvancedMonitoring();

module.exports = monitoring;