import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { Bindings, Proxy, ProxyTestRequest, ProxyTestResult } from '../types/database';

const proxies = new Hono<{ Bindings: Bindings }>();

// Enable CORS for all proxy routes
proxies.use('/*', cors());

interface ProxyPerformanceMetrics {
  proxy_id: number;
  response_time: number;
  success_rate: number;
  last_success: string | null;
  last_failure: string | null;
  total_requests: number;
  failed_requests: number;
  consecutive_failures: number;
  average_response_time: number;
  uptime_percentage: number;
}

interface EnhancedProxy extends Proxy {
  performance?: ProxyPerformanceMetrics;
  health_score?: number;
  reliability_rating?: 'excellent' | 'good' | 'fair' | 'poor' | 'unreliable';
}

class ProxyHealthMonitor {
  private db: D1Database;
  private testUrls: string[] = [
    'https://httpbin.org/ip',
    'https://httpbin.org/headers',
    'https://api.github.com/zen',
    'https://jsonplaceholder.typicode.com/posts/1'
  ];

  constructor(db: D1Database) {
    this.db = db;
  }

  async testProxy(proxy: Proxy, testUrl?: string): Promise<ProxyTestResult> {
    const startTime = Date.now();
    const targetUrl = testUrl || this.testUrls[Math.floor(Math.random() * this.testUrls.length)];
    
    try {
      // Use the proxy URL as a CORS proxy wrapper
      const proxyUrl = proxy.url + encodeURIComponent(targetUrl);
      
      const response = await fetch(proxyUrl, {
        method: 'GET',
        headers: {
          'User-Agent': 'SmartScrape-ProxyTester/1.0',
          'Accept': 'application/json,text/html,*/*'
        },
        signal: AbortSignal.timeout(15000) // 15 second timeout
      });

      const responseTime = Date.now() - startTime;

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      // Try to get response data for validation
      const responseText = await response.text();
      let responseData: any = null;

      try {
        responseData = JSON.parse(responseText);
      } catch (e) {
        // Not JSON, that's fine for HTML responses
        responseData = { html_length: responseText.length };
      }

      // Update proxy performance metrics
      await this.updateProxyMetrics(proxy.id, true, responseTime);

      return {
        proxy_id: proxy.id,
        proxy_url: proxy.url,
        test_url: targetUrl,
        status: 'success',
        response_time: responseTime,
        response_data: responseData,
        tested_at: new Date().toISOString()
      };

    } catch (error) {
      const responseTime = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      // Update proxy performance metrics
      await this.updateProxyMetrics(proxy.id, false, responseTime);

      return {
        proxy_id: proxy.id,
        proxy_url: proxy.url,
        test_url: targetUrl,
        status: 'failed',
        response_time: responseTime,
        error: errorMessage,
        tested_at: new Date().toISOString()
      };
    }
  }

  async updateProxyMetrics(proxyId: number, success: boolean, responseTime: number): Promise<void> {
    try {
      // Get current metrics
      const currentMetrics = await this.db.prepare(`
        SELECT * FROM proxy_performance WHERE proxy_id = ?
      `).bind(proxyId).first() as ProxyPerformanceMetrics | null;

      if (currentMetrics) {
        // Update existing metrics
        const totalRequests = currentMetrics.total_requests + 1;
        const failedRequests = success ? currentMetrics.failed_requests : currentMetrics.failed_requests + 1;
        const successRate = ((totalRequests - failedRequests) / totalRequests) * 100;
        const consecutiveFailures = success ? 0 : currentMetrics.consecutive_failures + 1;
        
        // Calculate rolling average response time
        const avgResponseTime = Math.round(
          (currentMetrics.average_response_time * currentMetrics.total_requests + responseTime) / totalRequests
        );

        await this.db.prepare(`
          UPDATE proxy_performance SET
            response_time = ?,
            success_rate = ?,
            last_success = ?,
            last_failure = ?,
            total_requests = ?,
            failed_requests = ?,
            consecutive_failures = ?,
            average_response_time = ?,
            updated_at = CURRENT_TIMESTAMP
          WHERE proxy_id = ?
        `).bind(
          responseTime,
          successRate,
          success ? new Date().toISOString() : currentMetrics.last_success,
          success ? currentMetrics.last_failure : new Date().toISOString(),
          totalRequests,
          failedRequests,
          consecutiveFailures,
          avgResponseTime,
          proxyId
        ).run();
      } else {
        // Create new metrics record
        await this.db.prepare(`
          INSERT INTO proxy_performance (
            proxy_id, response_time, success_rate, last_success, last_failure,
            total_requests, failed_requests, consecutive_failures, average_response_time
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).bind(
          proxyId,
          responseTime,
          success ? 100 : 0,
          success ? new Date().toISOString() : null,
          success ? null : new Date().toISOString(),
          1,
          success ? 0 : 1,
          success ? 0 : 1,
          responseTime
        ).run();
      }

      // Update proxy score based on performance
      await this.updateProxyScore(proxyId);

    } catch (error) {
      console.error('Error updating proxy metrics:', error);
    }
  }

  async updateProxyScore(proxyId: number): Promise<void> {
    try {
      const metrics = await this.db.prepare(`
        SELECT * FROM proxy_performance WHERE proxy_id = ?
      `).bind(proxyId).first() as ProxyPerformanceMetrics | null;

      if (!metrics) return;

      // Calculate health score (0-100)
      let healthScore = 0;
      
      // Success rate weight (40%)
      healthScore += (metrics.success_rate * 0.4);
      
      // Response time weight (30%) - faster is better
      const responseTimeScore = Math.max(0, 100 - (metrics.average_response_time / 100));
      healthScore += (responseTimeScore * 0.3);
      
      // Reliability weight (20%) - fewer consecutive failures is better
      const reliabilityScore = Math.max(0, 100 - (metrics.consecutive_failures * 20));
      healthScore += (reliabilityScore * 0.2);
      
      // Uptime weight (10%) - based on total requests vs failures
      const uptimeScore = metrics.total_requests > 0 ? 
        ((metrics.total_requests - metrics.failed_requests) / metrics.total_requests) * 100 : 0;
      healthScore += (uptimeScore * 0.1);

      // Determine status and reliability rating
      let status = 'inactive';
      let reliabilityRating: 'excellent' | 'good' | 'fair' | 'poor' | 'unreliable' = 'unreliable';

      if (healthScore >= 90) {
        status = 'active';
        reliabilityRating = 'excellent';
      } else if (healthScore >= 75) {
        status = 'active';
        reliabilityRating = 'good';
      } else if (healthScore >= 60) {
        status = 'active';
        reliabilityRating = 'fair';
      } else if (healthScore >= 40) {
        status = 'inactive';
        reliabilityRating = 'poor';
      } else {
        status = 'inactive';
        reliabilityRating = 'unreliable';
      }

      // Update proxy with new score and status
      await this.db.prepare(`
        UPDATE proxies SET 
          score = ?, 
          status = ?, 
          latency = ?,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).bind(
        Math.round(healthScore),
        status,
        metrics.average_response_time,
        proxyId
      ).run();

      // Store reliability rating in a separate field if the schema supports it
      try {
        await this.db.prepare(`
          UPDATE proxies SET reliability_rating = ? WHERE id = ?
        `).bind(reliabilityRating, proxyId).run();
      } catch (e) {
        // Column might not exist in older schema versions
      }

    } catch (error) {
      console.error('Error updating proxy score:', error);
    }
  }

  async batchTestProxies(proxies: Proxy[], concurrency: number = 10): Promise<ProxyTestResult[]> {
    const results: ProxyTestResult[] = [];
    const queue = [...proxies];

    // Process proxies in batches
    while (queue.length > 0) {
      const batch = queue.splice(0, concurrency);
      const batchPromises = batch.map(proxy => this.testProxy(proxy));
      
      try {
        const batchResults = await Promise.allSettled(batchPromises);
        
        batchResults.forEach((result, index) => {
          if (result.status === 'fulfilled') {
            results.push(result.value);
          } else {
            // Create error result for failed promise
            results.push({
              proxy_id: batch[index].id,
              proxy_url: batch[index].url,
              test_url: 'batch_test',
              status: 'failed',
              response_time: 0,
              error: result.reason?.message || 'Batch test failed',
              tested_at: new Date().toISOString()
            });
          }
        });

        // Add delay between batches to avoid overwhelming
        if (queue.length > 0) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      } catch (error) {
        console.error('Batch test error:', error);
      }
    }

    return results;
  }

  getReliabilityRating(score: number): 'excellent' | 'good' | 'fair' | 'poor' | 'unreliable' {
    if (score >= 90) return 'excellent';
    if (score >= 75) return 'good';
    if (score >= 60) return 'fair';
    if (score >= 40) return 'poor';
    return 'unreliable';
  }
}

// Get all proxies with enhanced metrics
proxies.get('/', async (c) => {
  try {
    const { results: proxyData } = await c.env.DB.prepare(`
      SELECT 
        p.*,
        pp.response_time,
        pp.success_rate,
        pp.last_success,
        pp.last_failure,
        pp.total_requests,
        pp.failed_requests,
        pp.consecutive_failures,
        pp.average_response_time
      FROM proxies p
      LEFT JOIN proxy_performance pp ON p.id = pp.proxy_id
      ORDER BY p.score DESC, p.status ASC, p.latency ASC
    `).all();

    // Enhance proxy data with calculated metrics
    const enhancedProxies: EnhancedProxy[] = proxyData.map((proxy: any) => {
      const monitor = new ProxyHealthMonitor(c.env.DB);
      return {
        ...proxy,
        health_score: proxy.score || 0,
        reliability_rating: monitor.getReliabilityRating(proxy.score || 0),
        performance: proxy.total_requests ? {
          proxy_id: proxy.id,
          response_time: proxy.response_time,
          success_rate: proxy.success_rate,
          last_success: proxy.last_success,
          last_failure: proxy.last_failure,
          total_requests: proxy.total_requests,
          failed_requests: proxy.failed_requests,
          consecutive_failures: proxy.consecutive_failures,
          average_response_time: proxy.average_response_time,
          uptime_percentage: proxy.total_requests > 0 ? 
            ((proxy.total_requests - proxy.failed_requests) / proxy.total_requests) * 100 : 0
        } : undefined
      };
    });

    return c.json({ proxies: enhancedProxies });
  } catch (error) {
    console.error('Error fetching proxies:', error);
    return c.json({ error: 'Failed to fetch proxies' }, 500);
  }
});

// Add custom proxies with validation
proxies.post('/custom', async (c) => {
  try {
    const body = await c.req.json();
    const { proxies: proxyList, source = 'custom', validate = false } = body;

    if (!proxyList || !Array.isArray(proxyList)) {
      return c.json({ error: 'Invalid proxy list format' }, 400);
    }

    // Validate proxy URLs
    const validatedProxies: string[] = [];
    const invalidProxies: string[] = [];

    for (const proxyUrl of proxyList) {
      try {
        const url = proxyUrl.includes('://') ? proxyUrl : `http://${proxyUrl}`;
        new URL(url); // This will throw if invalid
        validatedProxies.push(url);
      } catch (e) {
        invalidProxies.push(proxyUrl);
      }
    }

    if (validatedProxies.length === 0) {
      return c.json({ error: 'No valid proxy URLs provided', invalid: invalidProxies }, 400);
    }

    // Insert valid proxies
    const insertPromises = validatedProxies.map((proxyUrl: string, index: number) => {
      const name = `${source}_${Date.now()}_${index}`;
      
      return c.env.DB.prepare(`
        INSERT OR REPLACE INTO proxies (name, url, source, type, status, score)
        VALUES (?, ?, ?, 'http', 'inactive', 0)
      `).bind(name, proxyUrl, source).run();
    });

    await Promise.all(insertPromises);

    // Optionally validate proxies immediately
    let testResults: ProxyTestResult[] = [];
    if (validate) {
      // Get the newly inserted proxies
      const { results: newProxies } = await c.env.DB.prepare(`
        SELECT * FROM proxies WHERE source = ? AND created_at > datetime('now', '-1 minute')
      `).bind(source).all() as { results: Proxy[] };

      const monitor = new ProxyHealthMonitor(c.env.DB);
      testResults = await monitor.batchTestProxies(newProxies, 5);
    }

    return c.json({ 
      message: `Added ${validatedProxies.length} proxies`,
      added: validatedProxies.length,
      invalid: invalidProxies.length,
      invalid_proxies: invalidProxies,
      test_results: validate ? testResults : undefined
    });
  } catch (error) {
    console.error('Error adding custom proxies:', error);
    return c.json({ error: 'Failed to add custom proxies' }, 500);
  }
});

// Enhanced proxy testing with detailed results
proxies.post('/test', async (c) => {
  try {
    const body: ProxyTestRequest = await c.req.json();
    const { proxy_ids, test_url, concurrent = 10 } = body;

    let proxiesToTest: Proxy[] = [];

    if (proxy_ids && proxy_ids.length > 0) {
      // Test specific proxies
      const placeholders = proxy_ids.map(() => '?').join(',');
      const { results } = await c.env.DB.prepare(`
        SELECT * FROM proxies WHERE id IN (${placeholders})
      `).bind(...proxy_ids).all() as { results: Proxy[] };
      proxiesToTest = results;
    } else {
      // Test all proxies
      const { results } = await c.env.DB.prepare(`
        SELECT * FROM proxies ORDER BY score DESC
      `).all() as { results: Proxy[] };
      proxiesToTest = results;
    }

    if (proxiesToTest.length === 0) {
      return c.json({ error: 'No proxies found to test' }, 404);
    }

    const monitor = new ProxyHealthMonitor(c.env.DB);
    const testResults = await monitor.batchTestProxies(proxiesToTest, concurrent);

    // Generate summary statistics
    const summary = {
      total_tested: testResults.length,
      successful: testResults.filter(r => r.status === 'success').length,
      failed: testResults.filter(r => r.status === 'failed').length,
      average_response_time: Math.round(
        testResults.reduce((sum, r) => sum + r.response_time, 0) / testResults.length
      ),
      success_rate: Math.round(
        (testResults.filter(r => r.status === 'success').length / testResults.length) * 100
      )
    };

    return c.json({
      summary,
      results: testResults,
      tested_at: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error testing proxies:', error);
    return c.json({ error: 'Failed to test proxies' }, 500);
  }
});

// Get proxy statistics and analytics
proxies.get('/stats', async (c) => {
  try {
    const [
      totalCountResult,
      statusStatsResult,
      performanceStatsResult,
      topPerformersResult
    ] = await Promise.all([
      c.env.DB.prepare(`SELECT COUNT(*) as total FROM proxies`).first(),
      c.env.DB.prepare(`
        SELECT status, COUNT(*) as count 
        FROM proxies 
        GROUP BY status
      `).all(),
      c.env.DB.prepare(`
        SELECT 
          AVG(score) as avg_score,
          AVG(latency) as avg_latency,
          MIN(latency) as min_latency,
          MAX(latency) as max_latency
        FROM proxies 
        WHERE status = 'active'
      `).first(),
      c.env.DB.prepare(`
        SELECT p.*, pp.success_rate, pp.average_response_time, pp.total_requests
        FROM proxies p
        LEFT JOIN proxy_performance pp ON p.id = pp.proxy_id
        WHERE p.status = 'active'
        ORDER BY p.score DESC, pp.success_rate DESC
        LIMIT 10
      `).all()
    ]);

    const stats = {
      total_proxies: (totalCountResult as any)?.total || 0,
      status_distribution: (statusStatsResult as any).results || [],
      performance: performanceStatsResult || {},
      top_performers: (topPerformersResult as any).results || [],
      last_updated: new Date().toISOString()
    };

    return c.json(stats);
  } catch (error) {
    console.error('Error fetching proxy stats:', error);
    return c.json({ error: 'Failed to fetch proxy statistics' }, 500);
  }
});

// Proxy health monitoring endpoint
proxies.get('/health', async (c) => {
  try {
    const { results: healthData } = await c.env.DB.prepare(`
      SELECT 
        p.id,
        p.name,
        p.url,
        p.status,
        p.score,
        pp.success_rate,
        pp.consecutive_failures,
        pp.last_success,
        pp.last_failure,
        pp.total_requests
      FROM proxies p
      LEFT JOIN proxy_performance pp ON p.id = pp.proxy_id
      ORDER BY pp.consecutive_failures DESC, p.score ASC
    `).all();

    // Categorize proxies by health status
    const healthReport = {
      healthy: healthData.filter((p: any) => p.status === 'active' && (p.consecutive_failures || 0) < 3),
      degraded: healthData.filter((p: any) => p.status === 'active' && (p.consecutive_failures || 0) >= 3 && (p.consecutive_failures || 0) < 10),
      unhealthy: healthData.filter((p: any) => p.status === 'inactive' || (p.consecutive_failures || 0) >= 10),
      unknown: healthData.filter((p: any) => !p.total_requests || p.total_requests === 0)
    };

    const overallHealth = {
      healthy_count: healthReport.healthy.length,
      degraded_count: healthReport.degraded.length,
      unhealthy_count: healthReport.unhealthy.length,
      unknown_count: healthReport.unknown.length,
      total_count: healthData.length,
      health_percentage: healthData.length > 0 ? 
        Math.round((healthReport.healthy.length / healthData.length) * 100) : 0
    };

    return c.json({
      overall: overallHealth,
      categories: healthReport,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error fetching proxy health:', error);
    return c.json({ error: 'Failed to fetch proxy health data' }, 500);
  }
});

// Load proxies from external source with enhanced error handling
proxies.post('/load', async (c) => {
  try {
    const body = await c.req.json();
    const { url: sourceUrl, source_name, timeout = 30000 } = body;

    if (!sourceUrl || !source_name) {
      return c.json({ error: 'Missing required fields: url, source_name' }, 400);
    }

    // Enhanced proxy source fetching with multiple fallback methods
    const corsProxies = [
      'https://api.allorigins.win/raw?url=',
      'https://corsproxy.io/?',
      'https://api.codetabs.com/v1/proxy?quest=',
      'https://thingproxy.freeboard.io/fetch/'
    ];

    let response: Response | null = null;
    let lastError: string = '';

    // Try direct fetch first
    try {
      response = await fetch(sourceUrl, { 
        signal: AbortSignal.timeout(timeout),
        headers: {
          'User-Agent': 'SmartScrape-ProxyLoader/1.0'
        }
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
    } catch (e) {
      lastError = e instanceof Error ? e.message : 'Direct fetch failed';
    }

    // Try CORS proxies if direct fetch failed
    if (!response || !response.ok) {
      for (const corsProxy of corsProxies) {
        try {
          const proxyUrl = corsProxy + encodeURIComponent(sourceUrl);
          response = await fetch(proxyUrl, { 
            signal: AbortSignal.timeout(timeout),
            headers: {
              'User-Agent': 'SmartScrape-ProxyLoader/1.0'
            }
          });
          
          if (response.ok) break;
        } catch (e) {
          lastError = e instanceof Error ? e.message : 'CORS proxy failed';
          response = null;
        }
      }
    }

    if (!response || !response.ok) {
      throw new Error(`Failed to fetch proxy list: ${lastError}`);
    }

    const text = await response.text();
    
    // Enhanced proxy list parsing
    let proxies: string[] = [];
    const loadedProxies: { valid: string[], invalid: string[], total: number } = {
      valid: [],
      invalid: [],
      total: 0
    };

    try {
      // Try parsing as JSON first
      const data = JSON.parse(text);
      
      if (data.proxies && Array.isArray(data.proxies)) {
        // ProxyScrape format
        proxies = data.proxies.map((p: any) => `${p.protocol || 'http'}://${p.proxy}`);
      } else if (Array.isArray(data)) {
        // Generic JSON array
        proxies = data.map((p: any) => {
          if (typeof p === 'string') return `http://${p}`;
          if (p.proxy) return `${p.protocol || 'http'}://${p.proxy}`;
          if (p.ip && p.port) return `${p.protocol || 'http'}://${p.ip}:${p.port}`;
          return `http://${p}`;
        });
      } else if (data.data && Array.isArray(data.data)) {
        // Nested data structure
        proxies = data.data.map((p: any) => `http://${p.ip || p.host}:${p.port}`);
      }
    } catch (e) {
      // Not JSON, try parsing as text list
      const lines = text.split('\n')
        .map(line => line.trim())
        .filter(line => line && !line.startsWith('#') && !line.startsWith('//'));
      
      proxies = lines.map(line => {
        // Handle different formats: ip:port, protocol://ip:port
        if (line.includes('://')) return line;
        return `http://${line}`;
      });
    }

    loadedProxies.total = proxies.length;

    if (proxies.length === 0) {
      throw new Error('No proxies found in the response');
    }

    // Validate and insert proxies
    const insertPromises: Promise<any>[] = [];
    
    for (let i = 0; i < proxies.length; i++) {
      const proxyUrl = proxies[i];
      try {
        new URL(proxyUrl); // Validate URL
        loadedProxies.valid.push(proxyUrl);
        
        const name = `${source_name}_${Date.now()}_${i}`;
        insertPromises.push(
          c.env.DB.prepare(`
            INSERT OR REPLACE INTO proxies (name, url, source, type, status, score)
            VALUES (?, ?, ?, 'http', 'inactive', 0)
          `).bind(name, proxyUrl, source_name).run()
        );
      } catch (e) {
        loadedProxies.invalid.push(proxyUrl);
      }
    }

    await Promise.all(insertPromises);

    return c.json({ 
      message: `Loaded ${loadedProxies.valid.length} proxies from ${source_name}`,
      source: source_name,
      statistics: loadedProxies,
      loaded_at: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error loading proxies:', error);
    return c.json({ 
      error: `Failed to load proxies: ${error instanceof Error ? error.message : 'Unknown error'}` 
    }, 500);
  }
});

// Delete inactive or poor-performing proxies
proxies.delete('/cleanup', async (c) => {
  try {
    const { max_failures = 10, min_score = 20, days_inactive = 7 } = c.req.query();

    // Delete proxies with too many consecutive failures
    const failureCleanup = await c.env.DB.prepare(`
      DELETE FROM proxies 
      WHERE id IN (
        SELECT p.id FROM proxies p
        JOIN proxy_performance pp ON p.id = pp.proxy_id
        WHERE pp.consecutive_failures >= ?
      )
    `).bind(max_failures).run();

    // Delete proxies with very low scores
    const scoreCleanup = await c.env.DB.prepare(`
      DELETE FROM proxies WHERE score < ?
    `).bind(min_score).run();

    // Delete inactive proxies that haven't been tested recently
    const inactiveCleanup = await c.env.DB.prepare(`
      DELETE FROM proxies 
      WHERE status = 'inactive' 
        AND created_at <= datetime('now', ? || ' days')
        AND id NOT IN (
          SELECT DISTINCT proxy_id FROM proxy_performance 
          WHERE updated_at > datetime('now', '-1 day')
        )
    `).bind(`-${days_inactive}`).run();

    const totalDeleted = (failureCleanup.meta?.changes || 0) + 
                        (scoreCleanup.meta?.changes || 0) + 
                        (inactiveCleanup.meta?.changes || 0);

    return c.json({
      message: `Cleaned up ${totalDeleted} proxies`,
      details: {
        failure_cleanup: failureCleanup.meta?.changes || 0,
        score_cleanup: scoreCleanup.meta?.changes || 0,
        inactive_cleanup: inactiveCleanup.meta?.changes || 0
      },
      cleaned_at: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error cleaning up proxies:', error);
    return c.json({ error: 'Failed to cleanup proxies' }, 500);
  }
});

export default proxies;