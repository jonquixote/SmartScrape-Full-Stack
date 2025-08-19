import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { 
  Bindings, 
  CreateCrawlSessionRequest, 
  AIDiscoveryRequest, 
  AIDiscoveryResponse,
  CrawlSession,
  CrawlUrl,
  CrawlProgress 
} from '../types/database';

// Store active crawler instances
const activeCrawlers = new Map<number, any>();

const crawl = new Hono<{ Bindings: Bindings }>();

// Enable CORS for all crawl routes
crawl.use('/*', cors());

// Get all crawl sessions
crawl.get('/sessions', async (c) => {
  try {
    const { results } = await c.env.DB.prepare(`
      SELECT 
        id, title, description, start_method, status,
        urls_discovered, urls_completed, urls_failed, urls_blocked,
        created_at, updated_at, completed_at
      FROM crawl_sessions 
      ORDER BY created_at DESC
      LIMIT 50
    `).all();

    return c.json({ sessions: results });
  } catch (error) {
    console.error('Error fetching crawl sessions:', error);
    return c.json({ error: 'Failed to fetch crawl sessions' }, 500);
  }
});

// Get specific crawl session
crawl.get('/sessions/:id', async (c) => {
  try {
    const sessionId = c.req.param('id');
    
    const session = await c.env.DB.prepare(`
      SELECT * FROM crawl_sessions WHERE id = ?
    `).bind(sessionId).first();

    if (!session) {
      return c.json({ error: 'Crawl session not found' }, 404);
    }

    // Get URLs for this session
    const { results: urls } = await c.env.DB.prepare(`
      SELECT * FROM crawl_urls 
      WHERE session_id = ? 
      ORDER BY created_at DESC
    `).bind(sessionId).all();

    return c.json({ session, urls });
  } catch (error) {
    console.error('Error fetching crawl session:', error);
    return c.json({ error: 'Failed to fetch crawl session' }, 500);
  }
});

// AI-powered URL discovery
crawl.post('/discover-urls', async (c) => {
  try {
    const body: AIDiscoveryRequest = await c.req.json();
    const { prompt, groq_api_key, model } = body;

    if (!prompt || !groq_api_key || !model) {
      return c.json({ error: 'Missing required fields: prompt, groq_api_key, model' }, 400);
    }

    const systemPrompt = `You are an expert web researcher. Your task is to find URLs based on the user's request.
    You MUST respond with a JSON object. This JSON object must contain a single key called "urls", which is an array of strings.
    Each string in the array must be a valid, absolute URL.
    For example: {"urls": ["https://www.example.com/news", "https://www.anotherexample.org/blog"]}
    Do not include any other text, explanations, or markdown formatting in your response. Only the raw JSON object.`;

    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${groq_api_key}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: prompt }
        ],
        response_format: { type: "json_object" }
      })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: { message: 'An unknown error occurred.' } }));
      throw new Error(errorData.error?.message || `HTTP Error: ${response.status}`);
    }

    const result = await response.json();
    const content: AIDiscoveryResponse = JSON.parse(result.choices[0].message.content);

    if (!content.urls || !Array.isArray(content.urls) || content.urls.length === 0) {
      throw new Error('AI did not return any URLs. Try rephrasing your prompt.');
    }

    return c.json({ urls: content.urls });
  } catch (error) {
    console.error('AI Discovery Error:', error);
    return c.json({ 
      error: error instanceof Error ? error.message : 'AI Discovery Failed' 
    }, 500);
  }
});

// Create new crawl session
crawl.post('/sessions', async (c) => {
  try {
    const body: CreateCrawlSessionRequest = await c.req.json();
    
    // Default values
    const sessionData = {
      title: body.title,
      description: body.description || null,
      start_method: body.start_method,
      ai_prompt: body.ai_prompt || null,
      groq_model: body.groq_model || null,
      status: 'pending',
      user_id: 1, // Default user for now - will add auth later
      
      // Crawl strategy and configuration
      crawl_strategy: body.crawl_strategy || 'smart',
      enable_deep_crawl: body.enable_deep_crawl || false,
      max_depth: body.max_depth || 3,
      max_urls: body.max_urls || 50,
      domain_strategy: body.domain_strategy || 'same-domain',
      domain_whitelist: body.domain_whitelist ? JSON.stringify(body.domain_whitelist) : null,
      respect_robots: body.respect_robots !== false,
      parse_sitemaps: body.parse_sitemaps !== false,
      discover_feeds: body.discover_feeds || false,
      include_patterns: body.include_patterns || null,
      exclude_patterns: body.exclude_patterns || null,
      
      // Pagination settings
      enable_pagination: body.enable_pagination || false,
      pagination_strategy: body.pagination_strategy || 'auto',
      pagination_selector: body.pagination_selector || null,
      max_pages: body.max_pages || 10,
      page_delay: body.page_delay || 2,
      deduplicate_paginated: body.deduplicate_paginated !== false,
      
      // Output options
      generate_markdown: body.generate_markdown !== false,
      extract_metadata: body.extract_metadata !== false,
      extract_links: body.extract_links !== false,
      extract_media: body.extract_media || false,
      
      // AI extraction settings
      enable_ai_extraction: body.enable_ai_extraction || false,
      ai_extraction_schema: body.ai_extraction_schema ? JSON.stringify(body.ai_extraction_schema) : null,
      
      // Manual extraction settings
      crawl_delay: body.crawl_delay || 1000,
      delay_jitter: body.delay_jitter || 500,
      max_concurrent: body.max_concurrent || 5,
      user_agents: body.user_agents ? JSON.stringify(body.user_agents) : null,
      
      // Content processing
      smart_cleaning: body.smart_cleaning !== false,
      remove_ads: body.remove_ads !== false,
      remove_navigation: body.remove_navigation !== false
    };

    // Insert session
    const result = await c.env.DB.prepare(`
      INSERT INTO crawl_sessions (
        user_id, title, description, start_method, ai_prompt, groq_model, status,
        crawl_strategy, enable_deep_crawl, max_depth, max_urls, domain_strategy, domain_whitelist,
        respect_robots, parse_sitemaps, discover_feeds, include_patterns, exclude_patterns,
        enable_pagination, pagination_strategy, pagination_selector, max_pages, page_delay, deduplicate_paginated,
        generate_markdown, extract_metadata, extract_links, extract_media,
        enable_ai_extraction, ai_extraction_schema, crawl_delay, delay_jitter,
        max_concurrent, user_agents, smart_cleaning, remove_ads, remove_navigation,
        urls_discovered, urls_completed, urls_failed, urls_blocked
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      sessionData.user_id, sessionData.title, sessionData.description, sessionData.start_method,
      sessionData.ai_prompt, sessionData.groq_model, sessionData.status,
      sessionData.crawl_strategy, sessionData.enable_deep_crawl, sessionData.max_depth, sessionData.max_urls, 
      sessionData.domain_strategy, sessionData.domain_whitelist, sessionData.respect_robots, sessionData.parse_sitemaps,
      sessionData.discover_feeds, sessionData.include_patterns, sessionData.exclude_patterns,
      sessionData.enable_pagination, sessionData.pagination_strategy, sessionData.pagination_selector, 
      sessionData.max_pages, sessionData.page_delay, sessionData.deduplicate_paginated,
      sessionData.generate_markdown, sessionData.extract_metadata, sessionData.extract_links, sessionData.extract_media,
      sessionData.enable_ai_extraction, sessionData.ai_extraction_schema, sessionData.crawl_delay, sessionData.delay_jitter,
      sessionData.max_concurrent, sessionData.user_agents, sessionData.smart_cleaning, sessionData.remove_ads, sessionData.remove_navigation,
      0, 0, 0, 0 // urls_discovered, urls_completed, urls_failed, urls_blocked
    ).run();

    const sessionId = result.meta.last_row_id;

    // If manual method with URLs, add them to crawl_urls table
    if (body.start_method === 'manual' && body.urls && body.urls.length > 0) {
      const insertPromises = body.urls.map(url => 
        c.env.DB.prepare(`
          INSERT INTO crawl_urls (session_id, url, depth, status)
          VALUES (?, ?, 0, 'discovered')
        `).bind(sessionId, url).run()
      );
      
      await Promise.all(insertPromises);
      
      // Update session discovered count
      await c.env.DB.prepare(`
        UPDATE crawl_sessions SET urls_discovered = ? WHERE id = ?
      `).bind(body.urls.length, sessionId).run();
    }

    return c.json({ 
      id: sessionId,
      message: 'Crawl session created successfully',
      status: 'pending'
    });
  } catch (error) {
    console.error('Error creating crawl session:', error);
    return c.json({ error: 'Failed to create crawl session' }, 500);
  }
});

// Start crawling a session
crawl.post('/sessions/:id/start', async (c) => {
  try {
    const sessionId = parseInt(c.req.param('id'));
    
    // Get session details
    const session = await c.env.DB.prepare(`
      SELECT * FROM crawl_sessions WHERE id = ?
    `).bind(sessionId).first();

    if (!session) {
      return c.json({ error: 'Crawl session not found' }, 404);
    }

    if (session.status === 'running') {
      return c.json({ error: 'Crawl session is already running' }, 400);
    }

    // Import and start the enhanced crawler engine
    const { EnhancedCrawlerEngine } = await import('./enhanced-crawler-engine');
    const crawler = new EnhancedCrawlerEngine(c.env.DB, sessionId, session as any);
    
    // Store the crawler instance for potential stopping
    activeCrawlers.set(sessionId, crawler);
    
    // Start crawling asynchronously (don't await to return immediately)
    crawler.startCrawling().catch(error => {
      console.error(`Crawling session ${sessionId} failed:`, error);
    }).finally(() => {
      // Clean up crawler instance when done
      activeCrawlers.delete(sessionId);
    });
    
    return c.json({ 
      message: 'Crawl session started',
      session_id: sessionId,
      status: 'running'
    });
  } catch (error) {
    console.error('Error starting crawl session:', error);
    return c.json({ error: 'Failed to start crawl session' }, 500);
  }
});

// Stop crawling a session
crawl.post('/sessions/:id/stop', async (c) => {
  try {
    const sessionId = parseInt(c.req.param('id'));
    
    // Stop the active crawler if it exists
    const crawler = activeCrawlers.get(sessionId);
    if (crawler) {
      await crawler.stopCrawling();
      activeCrawlers.delete(sessionId);
    } else {
      // If no active crawler, just update database status
      await c.env.DB.prepare(`
        UPDATE crawl_sessions SET status = 'stopped', updated_at = CURRENT_TIMESTAMP 
        WHERE id = ?
      `).bind(sessionId).run();
    }

    return c.json({ 
      message: 'Crawl session stopped',
      session_id: sessionId,
      status: 'stopped'
    });
  } catch (error) {
    console.error('Error stopping crawl session:', error);
    return c.json({ error: 'Failed to stop crawl session' }, 500);
  }
});

// Get crawl progress/statistics
crawl.get('/sessions/:id/progress', async (c) => {
  try {
    const sessionId = c.req.param('id');
    
    const session = await c.env.DB.prepare(`
      SELECT status, urls_discovered, urls_completed, urls_failed, urls_blocked
      FROM crawl_sessions WHERE id = ?
    `).bind(sessionId).first();

    if (!session) {
      return c.json({ error: 'Crawl session not found' }, 404);
    }

    // Get current processing URL
    const currentUrl = await c.env.DB.prepare(`
      SELECT url FROM crawl_urls 
      WHERE session_id = ? AND status = 'processing'
      ORDER BY updated_at DESC LIMIT 1
    `).bind(sessionId).first();

    const totalUrls = session.urls_discovered || 0;
    const completedUrls = (session.urls_completed || 0) + (session.urls_failed || 0) + (session.urls_blocked || 0);
    const progressPercentage = totalUrls > 0 ? Math.round((completedUrls / totalUrls) * 100) : 0;

    const progress: CrawlProgress = {
      session_id: parseInt(sessionId),
      status: session.status,
      urls_discovered: session.urls_discovered || 0,
      urls_completed: session.urls_completed || 0,
      urls_failed: session.urls_failed || 0,
      urls_blocked: session.urls_blocked || 0,
      current_url: currentUrl?.url,
      progress_percentage: progressPercentage
    };

    return c.json(progress);
  } catch (error) {
    console.error('Error fetching crawl progress:', error);
    return c.json({ error: 'Failed to fetch crawl progress' }, 500);
  }
});

// Get crawl tree data for visualization
crawl.get('/sessions/:id/tree', async (c) => {
  try {
    const sessionId = c.req.param('id');
    
    const { results: urls } = await c.env.DB.prepare(`
      SELECT 
        id, url, depth, status, title, created_at,
        CASE 
          WHEN status = 'completed' THEN 'success'
          WHEN status = 'failed' THEN 'failed'
          WHEN status = 'blocked' THEN 'blocked'
          WHEN status = 'processing' THEN 'processing'
          ELSE 'discovered'
        END as node_status
      FROM crawl_urls 
      WHERE session_id = ? 
      ORDER BY created_at ASC
    `).bind(sessionId).all();

    // Build tree structure
    const tree = {
      nodes: urls.map((url: any) => ({
        id: url.id,
        url: url.url,
        title: url.title || url.url,
        depth: url.depth,
        status: url.node_status,
        created_at: url.created_at
      })),
      // For now, we'll use a simple depth-based hierarchy
      // In a more advanced implementation, we'd track parent-child relationships
      edges: []
    };

    return c.json(tree);
  } catch (error) {
    console.error('Error fetching crawl tree:', error);
    return c.json({ error: 'Failed to fetch crawl tree' }, 500);
  }
});

// Get detailed URL data
crawl.get('/sessions/:id/urls/:urlId', async (c) => {
  try {
    const sessionId = c.req.param('id');
    const urlId = c.req.param('urlId');
    
    const url = await c.env.DB.prepare(`
      SELECT * FROM crawl_urls 
      WHERE session_id = ? AND id = ?
    `).bind(sessionId, urlId).first();

    if (!url) {
      return c.json({ error: 'URL not found' }, 404);
    }

    // Parse JSON fields
    const urlData = {
      ...url,
      metadata: url.metadata ? JSON.parse(url.metadata) : null,
      links: url.links ? JSON.parse(url.links) : null,
      media: url.media ? JSON.parse(url.media) : null
    };

    return c.json({ url: urlData });
  } catch (error) {
    console.error('Error fetching URL details:', error);
    return c.json({ error: 'Failed to fetch URL details' }, 500);
  }
});

// Export crawl results
crawl.get('/sessions/:id/export/:format', async (c) => {
  try {
    const sessionId = c.req.param('id');
    const format = c.req.param('format');
    
    if (!['json', 'csv'].includes(format)) {
      return c.json({ error: 'Invalid export format. Use json or csv.' }, 400);
    }

    const session = await c.env.DB.prepare(`
      SELECT * FROM crawl_sessions WHERE id = ?
    `).bind(sessionId).first();

    if (!session) {
      return c.json({ error: 'Crawl session not found' }, 404);
    }

    const { results: urls } = await c.env.DB.prepare(`
      SELECT * FROM crawl_urls WHERE session_id = ? ORDER BY created_at ASC
    `).bind(sessionId).all();

    if (format === 'json') {
      const exportData = {
        session,
        urls: urls.map((url: any) => ({
          ...url,
          metadata: url.metadata ? JSON.parse(url.metadata) : null,
          links: url.links ? JSON.parse(url.links) : null,
          media: url.media ? JSON.parse(url.media) : null
        }))
      };
      
      return c.json(exportData);
    } else if (format === 'csv') {
      // Generate CSV
      const headers = ['URL', 'Title', 'Status', 'Depth', 'Content Length', 'Response Time', 'Created At'];
      const rows = urls.map((url: any) => [
        url.url,
        url.title || '',
        url.status,
        url.depth || 0,
        url.content ? url.content.length : 0,
        url.response_time || 0,
        url.created_at
      ]);
      
      const csv = [headers, ...rows].map(row => 
        row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')
      ).join('\n');
      
      return new Response(csv, {
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': `attachment; filename="crawl-${sessionId}-${new Date().toISOString().split('T')[0]}.csv"`
        }
      });
    }
  } catch (error) {
    console.error('Error exporting crawl results:', error);
    return c.json({ error: 'Failed to export crawl results' }, 500);
  }
});

// Test extraction schema on a single URL
crawl.post('/test-extraction', async (c) => {
  try {
    const body = await c.req.json();
    const { url, extraction_schema } = body;
    
    if (!url || !extraction_schema) {
      return c.json({ error: 'Missing required fields: url, extraction_schema' }, 400);
    }

    // Import enhanced crawler for testing
    const { EnhancedCrawlerEngine } = await import('./enhanced-crawler-engine');
    
    // Create a temporary test session
    const testSession = {
      ai_extraction_schema: JSON.stringify(extraction_schema),
      smart_cleaning: true,
      remove_ads: true,
      remove_navigation: true
    } as any;

    const crawler = new EnhancedCrawlerEngine(c.env.DB, -1, testSession);
    
    // Test the extraction without saving to database
    const result = await (crawler as any).crawlUrl(url, {
      extractionSchema: extraction_schema,
      smartCleaning: true,
      removeAds: true,
      removeNavigation: true
    });

    return c.json({
      url: result.url,
      status: result.status,
      title: result.title,
      extractedData: result.extractedData,
      error: result.error
    });
  } catch (error) {
    console.error('Error testing extraction:', error);
    return c.json({ error: 'Failed to test extraction' }, 500);
  }
});

// Get extraction suggestions for a URL
crawl.post('/suggest-selectors', async (c) => {
  try {
    const body = await c.req.json();
    const { url } = body;
    
    if (!url) {
      return c.json({ error: 'Missing required field: url' }, 400);
    }

    // Fetch the page and analyze structure
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });

    if (!response.ok) {
      return c.json({ error: `Failed to fetch URL: ${response.status}` }, 400);
    }

    const html = await response.text();
    
    // Use Cheerio to analyze structure
    const cheerio = await import('cheerio');
    const $ = cheerio.load(html);

    const suggestions = {
      titles: [],
      headings: [],
      links: [],
      images: [],
      lists: [],
      tables: [],
      forms: []
    };

    // Analyze common elements
    $('h1, h2, h3').each((i, elem) => {
      const text = $(elem).text().trim();
      if (text && i < 10) {
        suggestions.headings.push({
          selector: elem.tagName.toLowerCase(),
          text: text.substring(0, 100),
          count: $(elem.tagName).length
        });
      }
    });

    $('a[href]').each((i, elem) => {
      if (i < 10) {
        const href = $(elem).attr('href');
        const text = $(elem).text().trim();
        suggestions.links.push({
          selector: 'a[href]',
          href: href,
          text: text.substring(0, 50)
        });
      }
    });

    $('img[src]').each((i, elem) => {
      if (i < 10) {
        const src = $(elem).attr('src');
        const alt = $(elem).attr('alt');
        suggestions.images.push({
          selector: 'img[src]',
          src: src,
          alt: alt || ''
        });
      }
    });

    return c.json({ suggestions });
  } catch (error) {
    console.error('Error suggesting selectors:', error);
    return c.json({ error: 'Failed to analyze page structure' }, 500);
  }
});

// Advanced crawl analytics
crawl.get('/sessions/:id/analytics', async (c) => {
  try {
    const sessionId = c.req.param('id');
    
    // Get detailed analytics for the session
    const [sessionData, urlStats, domainStats, statusStats] = await Promise.all([
      c.env.DB.prepare(`SELECT * FROM crawl_sessions WHERE id = ?`).bind(sessionId).first(),
      
      c.env.DB.prepare(`
        SELECT 
          COUNT(*) as total_urls,
          AVG(response_time) as avg_response_time,
          MAX(response_time) as max_response_time,
          MIN(response_time) as min_response_time,
          AVG(LENGTH(content)) as avg_content_length
        FROM crawl_urls WHERE session_id = ?
      `).bind(sessionId).first(),
      
      c.env.DB.prepare(`
        SELECT 
          SUBSTR(url, 1, INSTR(SUBSTR(url, 9), '/') + 8) as domain,
          COUNT(*) as count
        FROM crawl_urls 
        WHERE session_id = ? 
        GROUP BY domain 
        ORDER BY count DESC 
        LIMIT 10
      `).bind(sessionId).all(),
      
      c.env.DB.prepare(`
        SELECT status, COUNT(*) as count
        FROM crawl_urls 
        WHERE session_id = ? 
        GROUP BY status
      `).bind(sessionId).all()
    ]);

    const analytics = {
      session: sessionData,
      performance: urlStats,
      domains: domainStats.results,
      statusBreakdown: statusStats.results,
      crawlEfficiency: {
        successRate: 0,
        blockRate: 0,
        failRate: 0
      }
    };

    // Calculate efficiency metrics
    const total = (sessionData as any)?.urls_discovered || 0;
    if (total > 0) {
      analytics.crawlEfficiency = {
        successRate: Math.round(((sessionData as any).urls_completed / total) * 100),
        blockRate: Math.round(((sessionData as any).urls_blocked / total) * 100),
        failRate: Math.round(((sessionData as any).urls_failed / total) * 100)
      };
    }

    return c.json(analytics);
  } catch (error) {
    console.error('Error fetching crawl analytics:', error);
    return c.json({ error: 'Failed to fetch crawl analytics' }, 500);
  }
});

// Delete crawl session
crawl.delete('/sessions/:id', async (c) => {
  try {
    const sessionId = parseInt(c.req.param('id'));
    
    // Stop crawler if running
    const crawler = activeCrawlers.get(sessionId);
    if (crawler) {
      await crawler.stopCrawling();
      activeCrawlers.delete(sessionId);
    }
    
    // Delete related URLs first
    await c.env.DB.prepare(`DELETE FROM crawl_urls WHERE session_id = ?`).bind(sessionId).run();
    
    // Delete session
    await c.env.DB.prepare(`DELETE FROM crawl_sessions WHERE id = ?`).bind(sessionId).run();

    return c.json({ message: 'Crawl session deleted successfully' });
  } catch (error) {
    console.error('Error deleting crawl session:', error);
    return c.json({ error: 'Failed to delete crawl session' }, 500);
  }
});

export default crawl;