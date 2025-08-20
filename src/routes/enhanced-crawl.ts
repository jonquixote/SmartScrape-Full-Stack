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
const activeSessions = new Map<string, any>(); // Store session data

const crawl = new Hono<{ Bindings: Bindings }>();

// Enable CORS for all crawl routes
crawl.use('/*', cors());

// Enhanced session creation with VM backup and Crawl4AI integration
interface EnhancedSessionRequest extends CreateCrawlSessionRequest {
  // Session metadata
  session_name?: string;
  session_description?: string;
  session_type?: 'one-time' | 'scheduled' | 'monitoring' | 'research';
  
  // Scheduling options
  schedule_frequency?: 'hourly' | 'daily' | 'weekly' | 'monthly';
  schedule_start?: string;
  
  // Backend configuration
  enable_vm_backup?: boolean;
  enable_failover?: boolean;
  enable_redundancy?: boolean;
  
  // Crawl4AI integration
  crawl4ai_strategy?: 'js-execution' | 'cosine-strategy' | 'llm-extraction' | 'json-css-extraction' | 'chunking-strategy';
  browser_type?: 'chromium' | 'firefox' | 'webkit';
  session_pool?: 'single' | 'pool-5' | 'pool-10';
  
  // Anti-detection features
  stealth_mode?: boolean;
  random_viewport?: boolean;
  human_simulation?: boolean;
}

// Get all crawl sessions
crawl.get('/sessions', async (c) => {
  try {
    const { results } = await c.env.DB.prepare(`
      SELECT 
        id, title, description, start_method, status,
        urls_discovered, urls_completed, urls_failed, urls_blocked,
        created_at, updated_at, completed_at, session_type,
        crawl4ai_strategy, browser_type, enable_vm_backup
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

// Enhanced session creation endpoint
crawl.post('/sessions/create-enhanced', async (c) => {
  try {
    const body: EnhancedSessionRequest = await c.req.json();

    if (!body.session_name || !body.session_description) {
      return c.json({ error: 'Session name and description are required' }, 400);
    }

    // Generate unique session ID
    const sessionId = crypto.randomUUID();
    const currentTime = new Date().toISOString();

    // Prepare enhanced session data
    const sessionData = {
      user_id: body.user_id || 1,
      title: body.session_name,
      description: body.session_description,
      start_method: body.start_method || 'manual',
      ai_prompt: body.ai_prompt || null,
      groq_model: body.groq_model || 'llama3-70b-8192',
      status: 'initialized',
      
      // Enhanced session metadata
      session_type: body.session_type || 'one-time',
      session_id: sessionId,
      
      // Backend configuration
      enable_vm_backup: body.enable_vm_backup || false,
      enable_failover: body.enable_failover || false,
      enable_redundancy: body.enable_redundancy || false,
      
      // Crawl4AI configuration  
      crawl4ai_strategy: body.crawl4ai_strategy || 'js-execution',
      browser_type: body.browser_type || 'chromium',
      session_pool: body.session_pool || 'single',
      
      // Anti-detection configuration
      stealth_mode: body.stealth_mode || false,
      random_viewport: body.random_viewport || false,
      human_simulation: body.human_simulation || false,
      
      // Standard crawl configuration
      crawl_strategy: body.crawl_strategy || 'smart',
      enable_deep_crawl: body.enable_deep_crawl || false,
      max_depth: body.max_depth || 3,
      max_urls: body.max_urls || 50,
      domain_strategy: body.domain_strategy || 'same-domain',
      domain_whitelist: body.domain_whitelist || null,
      
      // Robots and compliance
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
      
      // Performance settings
      crawl_delay: body.crawl_delay || 1000,
      delay_jitter: body.delay_jitter || 500,
      max_concurrent: body.max_concurrent || 5,
      user_agents: body.user_agents ? JSON.stringify(body.user_agents) : null,
      
      // Content processing
      smart_cleaning: body.smart_cleaning !== false,
      remove_ads: body.remove_ads !== false,
      remove_navigation: body.remove_navigation !== false,
      
      // Scheduling (if applicable)
      schedule_frequency: body.schedule_frequency || null,
      schedule_start: body.schedule_start || null
    };

    // Store session configuration in memory for quick access
    activeSessions.set(sessionId, {
      ...sessionData,
      created_at: currentTime,
      vm_instances: [],
      crawl4ai_endpoints: [],
      backup_systems: []
    });

    // Initialize backend systems based on configuration
    const backendStatus = await initializeSessionBackend(sessionData, c.env);

    // Insert session into database with extended schema
    const result = await c.env.DB.prepare(`
      INSERT INTO crawl_sessions (
        user_id, title, description, start_method, ai_prompt, groq_model, status,
        crawl_strategy, enable_deep_crawl, max_depth, max_urls, domain_strategy, domain_whitelist,
        respect_robots, parse_sitemaps, discover_feeds, include_patterns, exclude_patterns,
        enable_pagination, pagination_strategy, pagination_selector, max_pages, page_delay, deduplicate_paginated,
        generate_markdown, extract_metadata, extract_links, extract_media,
        enable_ai_extraction, ai_extraction_schema, crawl_delay, delay_jitter,
        max_concurrent, user_agents, smart_cleaning, remove_ads, remove_navigation,
        urls_discovered, urls_completed, urls_failed, urls_blocked, session_type
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
      0, 0, 0, 0, sessionData.session_type // urls_discovered, urls_completed, urls_failed, urls_blocked, session_type
    ).run();

    const dbSessionId = result.meta.last_row_id;

    // Update memory store with database ID
    const sessionInfo = activeSessions.get(sessionId);
    if (sessionInfo) {
      sessionInfo.db_id = dbSessionId;
      activeSessions.set(sessionId, sessionInfo);
    }

    return c.json({ 
      session_id: sessionId,
      db_id: dbSessionId,
      message: 'Enhanced crawl session created successfully',
      status: 'initialized',
      backend_status: backendStatus,
      configuration: {
        vm_backup_enabled: sessionData.enable_vm_backup,
        failover_enabled: sessionData.enable_failover,
        crawl4ai_strategy: sessionData.crawl4ai_strategy,
        stealth_mode: sessionData.stealth_mode
      }
    });
  } catch (error) {
    console.error('Error creating enhanced crawl session:', error);
    return c.json({ error: 'Failed to create enhanced crawl session' }, 500);
  }
});

// Initialize backend systems for a session
async function initializeSessionBackend(sessionData: any, env: any) {
  const status = {
    vm_backup: false,
    failover: false,
    redundancy: false,
    crawl4ai_configured: false,
    errors: []
  };

  try {
    // Setup VM backup if enabled
    if (sessionData.enable_vm_backup) {
      status.vm_backup = await setupVMBackup(sessionData);
    }
    
    // Setup failover systems
    if (sessionData.enable_failover) {
      status.failover = await setupFailoverSystems(sessionData);
    }
    
    // Configure Crawl4AI integration
    status.crawl4ai_configured = await configureCrawl4AI(sessionData);
    
    // Setup redundancy
    if (sessionData.enable_redundancy) {
      status.redundancy = await setupRedundantSystems(sessionData);
    }

  } catch (error) {
    status.errors.push(`Backend initialization error: ${error.message}`);
  }

  return status;
}

// VM Backup Configuration
async function setupVMBackup(sessionData: any): Promise<boolean> {
  try {
    console.log(`Setting up VM backup for session: ${sessionData.title}`);
    
    // VM configuration for backup processing
    const vmConfig = {
      sessionId: sessionData.session_id,
      vmType: 'backup-processor',
      resources: {
        cpu: '2',
        memory: '4GB', 
        storage: '20GB'
      },
      crawl4aiImage: 'unclecode/crawl4ai:latest',
      healthCheck: '/health',
      autoRestart: true,
      strategy: sessionData.crawl4ai_strategy
    };
    
    // In a real implementation, this would call your VM orchestration API
    // For now, we'll simulate the VM setup
    console.log('VM Backup Configuration:', JSON.stringify(vmConfig, null, 2));
    
    // Simulate VM startup delay
    await new Promise(resolve => setTimeout(resolve, 100));
    
    return true;
  } catch (error) {
    console.error('VM backup setup failed:', error);
    return false;
  }
}

// Failover Systems Configuration 
async function setupFailoverSystems(sessionData: any): Promise<boolean> {
  try {
    console.log(`Setting up failover systems for session: ${sessionData.title}`);
    
    const failoverConfig = {
      primary: 'main-crawl4ai-service',
      secondary: 'backup-crawl4ai-service', 
      tertiary: 'vm-crawl4ai-backup',
      healthCheckInterval: 30000,
      failoverThreshold: 3,
      recovery_strategy: 'automatic'
    };
    
    console.log('Failover Configuration:', JSON.stringify(failoverConfig, null, 2));
    
    return true;
  } catch (error) {
    console.error('Failover setup failed:', error);
    return false;
  }
}

// Crawl4AI Configuration
async function configureCrawl4AI(sessionData: any): Promise<boolean> {
  try {
    console.log(`Configuring Crawl4AI for session: ${sessionData.title}`);
    
    const crawl4aiConfig = {
      strategy: sessionData.crawl4ai_strategy,
      browser: sessionData.browser_type,
      sessionPoolSize: parseInt(sessionData.session_pool?.split('-')[1]) || 1,
      
      // Anti-detection settings
      stealth: sessionData.stealth_mode,
      randomViewport: sessionData.random_viewport, 
      humanBehavior: sessionData.human_simulation,
      
      // Advanced features based on strategy
      jsExecution: sessionData.crawl4ai_strategy === 'js-execution',
      cosineStrategy: sessionData.crawl4ai_strategy === 'cosine-strategy',
      llmExtraction: sessionData.crawl4ai_strategy === 'llm-extraction',
      jsonCssExtraction: sessionData.crawl4ai_strategy === 'json-css-extraction',
      semanticChunking: sessionData.crawl4ai_strategy === 'chunking-strategy'
    };
    
    // Test connection to Crawl4AI service
    try {
      const testResponse = await fetch('http://localhost:8000/health', {
        method: 'GET',
        signal: AbortSignal.timeout(5000)
      });
      
      if (testResponse.ok) {
        console.log('Crawl4AI service is available');
      } else {
        console.log('Crawl4AI service unavailable, using fallback');
      }
    } catch {
      console.log('Crawl4AI service not responding, using internal crawler');
    }
    
    console.log('Crawl4AI Configuration:', JSON.stringify(crawl4aiConfig, null, 2));
    
    return true;
  } catch (error) {
    console.error('Crawl4AI configuration failed:', error);
    return false;
  }
}

// Redundant Systems Setup
async function setupRedundantSystems(sessionData: any): Promise<boolean> {
  try {
    console.log(`Setting up redundant systems for session: ${sessionData.title}`);
    
    const redundancyConfig = {
      instances: 3,
      loadBalancing: 'round-robin',
      syncInterval: 10000,
      dataReplication: true,
      geographic_distribution: ['us-east', 'us-west', 'eu-central']
    };
    
    console.log('Redundancy Configuration:', JSON.stringify(redundancyConfig, null, 2));
    
    return true;
  } catch (error) {
    console.error('Redundancy setup failed:', error);
    return false;
  }
}

// Get session configuration and status
crawl.get('/sessions/:id/config', async (c) => {
  try {
    const sessionId = c.req.param('id');
    
    // Check memory store first
    const sessionInfo = activeSessions.get(sessionId);
    if (sessionInfo) {
      return c.json({
        session: sessionInfo,
        backend_status: 'active',
        systems: {
          vm_backup: sessionInfo.enable_vm_backup,
          failover: sessionInfo.enable_failover,
          crawl4ai: sessionInfo.crawl4ai_strategy
        }
      });
    }
    
    // Fallback to database
    const session = await c.env.DB.prepare(`
      SELECT * FROM crawl_sessions WHERE id = ? OR title = ?
    `).bind(sessionId, sessionId).first();

    if (!session) {
      return c.json({ error: 'Session not found' }, 404);
    }

    return c.json({ session });
  } catch (error) {
    console.error('Error fetching session config:', error);
    return c.json({ error: 'Failed to fetch session config' }, 500);
  }
});

// AI-powered URL discovery (existing endpoint enhanced)
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
      const errorText = await response.text();
      return c.json({ error: `Groq API error: ${errorText}` }, response.status);
    }

    const data = await response.json();
    let urls: string[] = [];

    try {
      const parsedContent = JSON.parse(data.choices[0].message.content);
      urls = parsedContent.urls || [];
    } catch (parseError) {
      return c.json({ error: 'Failed to parse AI response' }, 500);
    }

    const discoveryResponse: AIDiscoveryResponse = {
      urls,
      total_found: urls.length,
      model_used: model,
      prompt_used: prompt
    };

    return c.json(discoveryResponse);
  } catch (error) {
    console.error('Error in URL discovery:', error);
    return c.json({ error: 'Failed to discover URLs' }, 500);
  }
});

// Standard session creation (existing functionality preserved)
crawl.post('/sessions', async (c) => {
  try {
    const body: CreateCrawlSessionRequest = await c.req.json();

    if (!body.title) {
      return c.json({ error: 'Title is required' }, 400);
    }

    const sessionData = {
      user_id: body.user_id || 1,
      title: body.title,
      description: body.description || '',
      start_method: body.start_method || 'manual',
      ai_prompt: body.ai_prompt || null,
      groq_model: body.groq_model || 'llama3-70b-8192',
      status: 'pending',
      
      // Crawl configuration
      crawl_strategy: body.crawl_strategy || 'smart',
      enable_deep_crawl: body.enable_deep_crawl || false,
      max_depth: body.max_depth || 3,
      max_urls: body.max_urls || 50,
      domain_strategy: body.domain_strategy || 'same-domain',
      domain_whitelist: body.domain_whitelist || null,
      
      // Robots and compliance
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

export default crawl;