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

// Simplified session creation endpoint
interface SimplifiedSessionRequest {
  prompt: string;
  start_method: 'ai' | 'manual';
  ai_api_key?: string;
  ai_model?: string;
  urls?: string[]; // For manual method
  
  // Strategy
  crawl_strategy: 'basic' | 'smart' | 'magic' | 'comprehensive' | 'adaptive' | 'deep';
  
  // Deep crawling
  enable_deep_crawl: boolean;
  max_depth?: number;
  max_urls?: number;
  domain_strategy?: 'same-domain' | 'same-subdomain' | 'whitelist' | 'any';
  domain_whitelist?: string[];
  respect_robots?: boolean;
  parse_sitemaps?: boolean;
  discover_feeds?: boolean;
  include_patterns?: string;
  exclude_patterns?: string;
  
  // Pagination
  enable_pagination: boolean;
  pagination_strategy?: 'auto' | 'next-link' | 'numbered' | 'infinite-scroll' | 'custom-selector';
  pagination_selector?: string;
  max_pages?: number;
  page_delay?: number;
  deduplicate_paginated?: boolean;
  
  // Output options
  generate_markdown: boolean;
  extract_metadata: boolean;
  extract_links: boolean;
  extract_media: boolean;
  
  // AI extraction
  enable_ai_extraction: boolean;
  ai_extraction_schema?: object;
  groq_api_key?: string;
  llm_model?: string;
  ai_request_delay?: number;
  custom_prompt?: string;
  
  // Manual extraction
  css_selector?: string;
  xpath_selector?: string;
  
  // Advanced settings
  timeout?: number;
  max_retries?: number;
  crawl_delay?: number;
  delay_jitter?: number;
  concurrent_requests?: number;
  user_agents?: string[];
  smart_cleaning?: boolean;
  filter_ads?: boolean;
  filter_navigation?: boolean;
}

// Create simplified crawl session
crawl.post('/sessions/create-simplified', async (c) => {
  try {
    const body: SimplifiedSessionRequest = await c.req.json();
    
    if (!body.prompt) {
      return c.json({ error: 'Prompt is required' }, 400);
    }
    
    // Determine title from prompt
    const title = body.prompt.length > 50 ? 
      body.prompt.substring(0, 47) + '...' : 
      body.prompt;
    
    // Create session data based on simplified request
    const sessionData: CreateCrawlSessionRequest = {
      title: title,
      description: `Crawl session created from prompt: ${body.prompt}`,
      start_method: body.start_method,
      ai_prompt: body.start_method === 'ai' ? body.prompt : undefined,
      groq_model: body.ai_model,
      urls: body.start_method === 'manual' ? body.urls : undefined,
      
      // Strategy
      crawl_strategy: body.crawl_strategy,
      enable_deep_crawl: body.enable_deep_crawl,
      max_depth: body.max_depth,
      max_urls: body.max_urls,
      domain_strategy: body.domain_strategy,
      domain_whitelist: body.domain_whitelist,
      respect_robots: body.respect_robots,
      parse_sitemaps: body.parse_sitemaps,
      discover_feeds: body.discover_feeds,
      include_patterns: body.include_patterns,
      exclude_patterns: body.exclude_patterns,
      
      // Pagination
      enable_pagination: body.enable_pagination,
      pagination_strategy: body.pagination_strategy as any,
      pagination_selector: body.pagination_selector,
      max_pages: body.max_pages,
      page_delay: body.page_delay,
      deduplicate_paginated: body.deduplicate_paginated,
      
      // Output options
      generate_markdown: body.generate_markdown,
      extract_metadata: body.extract_metadata,
      extract_links: body.extract_links,
      extract_media: body.extract_media,
      
      // AI extraction
      enable_ai_extraction: body.enable_ai_extraction,
      ai_extraction_schema: body.ai_extraction_schema,
      crawl_delay: body.crawl_delay,
      delay_jitter: body.delay_jitter,
      max_concurrent: body.concurrent_requests,
      user_agents: body.user_agents,
      smart_cleaning: body.smart_cleaning,
      remove_ads: body.filter_ads,
      remove_navigation: body.filter_navigation
    };
    
    // Call existing session creation endpoint
    const response = await c.env.fetch('/api/crawl/sessions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(sessionData)
    });
    
    return response;
  } catch (error) {
    console.error('Error creating simplified crawl session:', error);
    return c.json({ error: 'Failed to create crawl session' }, 500);
  }
});

// Simplified AI URL discovery
crawl.post('/discover-urls-simplified', async (c) => {
  try {
    const body = await c.req.json();
    const { prompt, ai_api_key, ai_model } = body;

    if (!prompt || !ai_api_key || !ai_model) {
      return c.json({ error: 'Missing required fields: prompt, ai_api_key, ai_model' }, 400);
    }

    const discoveryRequest: AIDiscoveryRequest = {
      prompt,
      groq_api_key: ai_api_key,
      model: ai_model
    };

    // Call existing AI discovery endpoint
    const response = await c.env.fetch('/api/crawl/discover-urls', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(discoveryRequest)
    });
    
    return response;
  } catch (error) {
    console.error('Error in simplified URL discovery:', error);
    return c.json({ error: 'Failed to discover URLs' }, 500);
  }
});

// Get simplified session details
crawl.get('/sessions/:id/simplified', async (c) => {
  try {
    const sessionId = c.req.param('id');
    
    // Get session details
    const response = await c.env.fetch(`/api/crawl/sessions/${sessionId}`);
    const data = await response.json();
    
    if (data.error) {
      return c.json(data, response.status);
    }
    
    // Create simplified response
    const simplifiedData = {
      id: data.session?.id,
      title: data.session?.title,
      status: data.session?.status,
      start_method: data.session?.start_method,
      crawl_strategy: data.session?.crawl_strategy,
      enable_deep_crawl: data.session?.enable_deep_crawl,
      enable_pagination: data.session?.enable_pagination,
      generate_markdown: data.session?.generate_markdown,
      extract_metadata: data.session?.extract_metadata,
      extract_links: data.session?.extract_links,
      extract_media: data.session?.extract_media,
      enable_ai_extraction: data.session?.enable_ai_extraction,
      urls_discovered: data.session?.urls_discovered,
      urls_completed: data.session?.urls_completed,
      urls_failed: data.session?.urls_failed,
      urls_blocked: data.session?.urls_blocked,
      created_at: data.session?.created_at,
      updated_at: data.session?.updated_at
    };
    
    return c.json(simplifiedData);
  } catch (error) {
    console.error('Error fetching simplified session:', error);
    return c.json({ error: 'Failed to fetch session' }, 500);
  }
});

// Simplified start crawl
crawl.post('/sessions/:id/start-simplified', async (c) => {
  try {
    const sessionId = c.req.param('id');
    
    // Call existing start endpoint
    const response = await c.env.fetch(`/api/crawl/sessions/${sessionId}/start`, {
      method: 'POST'
    });
    
    return response;
  } catch (error) {
    console.error('Error starting simplified crawl:', error);
    return c.json({ error: 'Failed to start crawl' }, 500);
  }
});

// Simplified stop crawl
crawl.post('/sessions/:id/stop-simplified', async (c) => {
  try {
    const sessionId = c.req.param('id');
    
    // Call existing stop endpoint
    const response = await c.env.fetch(`/api/crawl/sessions/${sessionId}/stop`, {
      method: 'POST'
    });
    
    return response;
  } catch (error) {
    console.error('Error stopping simplified crawl:', error);
    return c.json({ error: 'Failed to stop crawl' }, 500);
  }
});

// Simplified progress
crawl.get('/sessions/:id/progress-simplified', async (c) => {
  try {
    const sessionId = c.req.param('id');
    
    // Call existing progress endpoint
    const response = await c.env.fetch(`/api/crawl/sessions/${sessionId}/progress`);
    const data = await response.json();
    
    if (data.error) {
      return c.json(data, response.status);
    }
    
    // Create simplified progress response
    const simplifiedProgress = {
      session_id: data.session_id,
      status: data.status,
      progress_percentage: data.progress_percentage,
      urls_discovered: data.urls_discovered,
      urls_completed: data.urls_completed,
      urls_failed: data.urls_failed,
      urls_blocked: data.urls_blocked,
      current_url: data.current_url
    };
    
    return c.json(simplifiedProgress);
  } catch (error) {
    console.error('Error fetching simplified progress:', error);
    return c.json({ error: 'Failed to fetch progress' }, 500);
  }
});

// Simplified export
crawl.get('/sessions/:id/export-simplified/:format', async (c) => {
  try {
    const sessionId = c.req.param('id');
    const format = c.req.param('format');
    
    // Validate format
    if (!['json', 'csv'].includes(format)) {
      return c.json({ error: 'Invalid format. Use json or csv.' }, 400);
    }
    
    // Call existing export endpoint
    const response = await c.env.fetch(`/api/crawl/sessions/${sessionId}/export/${format}`);
    
    // Return the same response
    return response;
  } catch (error) {
    console.error('Error exporting simplified results:', error);
    return c.json({ error: 'Failed to export results' }, 500);
  }
});

export default crawl;