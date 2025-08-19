import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { Bindings, Proxy, ProxyTestRequest, ProxyTestResult } from '../types/database';

const proxies = new Hono<{ Bindings: Bindings }>();

// Enable CORS for all proxy routes
proxies.use('/*', cors());

// Get all proxies
proxies.get('/', async (c) => {
  try {
    const { results } = await c.env.DB.prepare(`
      SELECT * FROM proxies 
      ORDER BY score DESC, status ASC, latency ASC
    `).all();

    return c.json({ proxies: results });
  } catch (error) {
    console.error('Error fetching proxies:', error);
    return c.json({ error: 'Failed to fetch proxies' }, 500);
  }
});

// Add custom proxies
proxies.post('/custom', async (c) => {
  try {
    const body = await c.req.json();
    const { proxies: proxyList, source = 'custom' } = body;

    if (!proxyList || !Array.isArray(proxyList)) {
      return c.json({ error: 'Invalid proxy list format' }, 400);
    }

    const insertPromises = proxyList.map((proxyUrl: string, index: number) => {
      const name = `${source}_${index}`;
      const url = proxyUrl.includes('://') ? proxyUrl : `http://${proxyUrl}`;
      
      return c.env.DB.prepare(`
        INSERT OR REPLACE INTO proxies (name, url, source, type, status, score)
        VALUES (?, ?, ?, 'http', 'inactive', 0)
      `).bind(name, url, source).run();
    });

    await Promise.all(insertPromises);

    return c.json({ 
      message: `Added ${proxyList.length} proxies`,
      count: proxyList.length 
    });
  } catch (error) {
    console.error('Error adding custom proxies:', error);
    return c.json({ error: 'Failed to add custom proxies' }, 500);
  }
});

// Load proxies from external source
proxies.post('/load', async (c) => {
  try {
    const body = await c.req.json();
    const { url: sourceUrl, source_name } = body;

    if (!sourceUrl || !source_name) {
      return c.json({ error: 'Missing required fields: url, source_name' }, 400);
    }

    // Use static wrapper to fetch proxy list
    const wrapperUrl = 'https://api.allorigins.win/raw?url=' + encodeURIComponent(sourceUrl);
    
    const response = await fetch(wrapperUrl);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const text = await response.text();
    
    // Basic check for HTML (error page)
    if (text.trim().toLowerCase().startsWith('<!doctype html')) {
      throw new Error("Received an HTML page, not a proxy list.");
    }

    // Parse proxy list
    let proxies: string[] = [];
    try {
      // Try parsing as JSON first
      const data = JSON.parse(text);
      if (data.proxies) {
        // Handle proxyscrape format
        proxies = data.proxies.map((p: any) => `${p.protocol}://${p.proxy}`);
      } else if (Array.isArray(data)) {
        // Handle other JSON array formats
        proxies = data.map((p: any) => (p.proxy ? `${p.protocol || 'http'}://${p.proxy}` : `http://${p}`));
      }
    } catch (e) {
      // If JSON parsing fails, assume it's a text list (e.g. ip:port)
      const lines = text.split('\n').filter(Boolean);
      proxies = lines.map(line => `http://${line.trim()}`);
    }

    if (proxies.length === 0) {
      throw new Error('No valid proxies found in the response');
    }

    // Insert proxies into database
    const insertPromises = proxies.map((proxyUrl, index) => {
      const name = `${source_name}_${index}`;
      
      return c.env.DB.prepare(`
        INSERT OR REPLACE INTO proxies (name, url, source, type, status, score)
        VALUES (?, ?, ?, 'http', 'inactive', 0)
      `).bind(name, proxyUrl, source_name).run();
    });

    await Promise.all(insertPromises);

    return c.json({ 
      message: `Loaded ${proxies.length} proxies from ${source_name}`,
      count: proxies.length,
      source: source_name
    });
  } catch (error) {
    console.error('Error loading proxies from source:', error);
    return c.json({ 
      error: error instanceof Error ? error.message : 'Failed to load proxies from source' 
    }, 500);
  }
});

// Test proxies
proxies.post('/test', async (c) => {
  try {
    const body: ProxyTestRequest = await c.req.json();
    
    let proxyIds: number[] = [];
    
    if (body.test_all) {
      // Get all proxy IDs
      const { results } = await c.env.DB.prepare(`SELECT id FROM proxies`).all();
      proxyIds = results.map((p: any) => p.id);
    } else if (body.proxy_ids && body.proxy_ids.length > 0) {
      proxyIds = body.proxy_ids;
    } else {
      return c.json({ error: 'No proxies specified for testing' }, 400);
    }

    if (proxyIds.length === 0) {
      return c.json({ error: 'No proxies found to test' }, 400);
    }

    // Update all specified proxies to testing status
    const updatePromises = proxyIds.map(id => 
      c.env.DB.prepare(`
        UPDATE proxies SET status = 'testing', last_tested_at = CURRENT_TIMESTAMP 
        WHERE id = ?
      `).bind(id).run()
    );
    await Promise.all(updatePromises);

    // Test proxies in parallel
    const testPromises = proxyIds.map(async (proxyId) => {
      try {
        const proxy = await c.env.DB.prepare(`
          SELECT * FROM proxies WHERE id = ?
        `).bind(proxyId).first();

        if (!proxy) {
          return { proxy_id: proxyId, status: 'failed', error: 'Proxy not found' } as ProxyTestResult;
        }

        const testUrl = 'https://httpbin.org/ip';
        
        // Try different test approaches based on proxy URL format
        let finalTestUrl = proxy.url;
        if (proxy.url.includes('{URL}')) {
          // Static wrapper format
          finalTestUrl = proxy.url.replace('{URL}', encodeURIComponent(testUrl));
        } else {
          // Direct proxy or other format - try with a simple wrapper
          finalTestUrl = 'https://api.allorigins.win/raw?url=' + encodeURIComponent(testUrl);
        }
        
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 8000);
        const startTime = Date.now();

        try {
          const response = await fetch(finalTestUrl, { 
            signal: controller.signal,
            headers: {
              'User-Agent': 'Crawl4AI-Proxy-Test/1.0'
            }
          });
          const latency = Date.now() - startTime;
          
          if (response.ok) {
            // Try to parse response to verify it's valid
            try {
              const responseText = await response.text();
              // Basic validation - should contain some expected content
              if (responseText.length > 10) {
                const score = Math.max(1, 100 - Math.floor(latency / 100));
                
                // Update proxy with success
                await c.env.DB.prepare(`
                  UPDATE proxies 
                  SET status = 'active', latency = ?, score = ?, success_count = success_count + 1,
                      total_requests = total_requests + 1, last_tested_at = CURRENT_TIMESTAMP
                  WHERE id = ?
                `).bind(latency, score, proxyId).run();

                return { proxy_id: proxyId, status: 'active', latency } as ProxyTestResult;
              } else {
                throw new Error('Empty or invalid response');
              }
            } catch (parseError) {
              throw new Error('Failed to parse response');
            }
          } else {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
          }
        } catch (e) {
          // Update proxy with failure
          await c.env.DB.prepare(`
            UPDATE proxies 
            SET status = 'failed', latency = NULL, score = 0, failure_count = failure_count + 1,
                total_requests = total_requests + 1, last_tested_at = CURRENT_TIMESTAMP
            WHERE id = ?
          `).bind(proxyId).run();

          return { 
            proxy_id: proxyId, 
            status: 'failed', 
            error: e instanceof Error ? e.message : 'Unknown error' 
          } as ProxyTestResult;
        } finally {
          clearTimeout(timeoutId);
        }
      } catch (error) {
        return { 
          proxy_id: proxyId, 
          status: 'failed', 
          error: error instanceof Error ? error.message : 'Test error' 
        } as ProxyTestResult;
      }
    });

    const results = await Promise.allSettled(testPromises);
    const testResults = results.map(result => 
      result.status === 'fulfilled' ? result.value : { status: 'failed', error: 'Promise rejected' }
    );

    const activeCount = testResults.filter(r => r.status === 'active').length;
    const failedCount = testResults.filter(r => r.status === 'failed').length;

    return c.json({ 
      message: `Tested ${proxyIds.length} proxies`,
      results: testResults,
      summary: {
        total: proxyIds.length,
        active: activeCount,
        failed: failedCount
      }
    });
  } catch (error) {
    console.error('Error testing proxies:', error);
    return c.json({ error: 'Failed to test proxies' }, 500);
  }
});

// Delete proxy
proxies.delete('/:id', async (c) => {
  try {
    const proxyId = c.req.param('id');
    
    const result = await c.env.DB.prepare(`DELETE FROM proxies WHERE id = ?`).bind(proxyId).run();
    
    if (result.changes === 0) {
      return c.json({ error: 'Proxy not found' }, 404);
    }

    return c.json({ message: 'Proxy deleted successfully' });
  } catch (error) {
    console.error('Error deleting proxy:', error);
    return c.json({ error: 'Failed to delete proxy' }, 500);
  }
});

// Clear all proxies (except static ones)
proxies.delete('/clear/custom', async (c) => {
  try {
    await c.env.DB.prepare(`DELETE FROM proxies WHERE source != 'static'`).run();
    
    return c.json({ message: 'All custom proxies cleared successfully' });
  } catch (error) {
    console.error('Error clearing custom proxies:', error);
    return c.json({ error: 'Failed to clear custom proxies' }, 500);
  }
});

// Get proxy statistics
proxies.get('/stats', async (c) => {
  try {
    const stats = await c.env.DB.prepare(`
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) as active,
        SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed,
        SUM(CASE WHEN status = 'inactive' THEN 1 ELSE 0 END) as inactive,
        SUM(CASE WHEN status = 'testing' THEN 1 ELSE 0 END) as testing,
        AVG(CASE WHEN latency IS NOT NULL THEN latency END) as avg_latency,
        MIN(CASE WHEN latency IS NOT NULL THEN latency END) as min_latency,
        MAX(CASE WHEN latency IS NOT NULL THEN latency END) as max_latency
      FROM proxies
    `).first();

    return c.json({ stats });
  } catch (error) {
    console.error('Error fetching proxy statistics:', error);
    return c.json({ error: 'Failed to fetch proxy statistics' }, 500);
  }
});

export default proxies;