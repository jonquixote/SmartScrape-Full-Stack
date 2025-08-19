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
    const sessionId = c.req.param('id');
    
    // Update session status to running
    await c.env.DB.prepare(`
      UPDATE crawl_sessions SET status = 'running', updated_at = CURRENT_TIMESTAMP 
      WHERE id = ?
    `).bind(sessionId).run();

    // In a real implementation, this would start the actual crawling process
    // For now, we'll just return success and the frontend can simulate progress
    
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
    const sessionId = c.req.param('id');
    
    await c.env.DB.prepare(`
      UPDATE crawl_sessions SET status = 'stopped', updated_at = CURRENT_TIMESTAMP 
      WHERE id = ?
    `).bind(sessionId).run();

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

// Delete crawl session
crawl.delete('/sessions/:id', async (c) => {
  try {
    const sessionId = c.req.param('id');
    
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