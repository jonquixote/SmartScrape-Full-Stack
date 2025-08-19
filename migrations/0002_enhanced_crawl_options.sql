-- Enhanced Crawl Configuration Options
-- Migration to add missing fields from the original HTML file

-- Add new columns to crawl_sessions table
ALTER TABLE crawl_sessions ADD COLUMN crawl_strategy TEXT DEFAULT 'smart' CHECK (crawl_strategy IN ('basic', 'smart', 'magic', 'comprehensive', 'adaptive', 'deep'));
ALTER TABLE crawl_sessions ADD COLUMN max_urls INTEGER DEFAULT 50;
ALTER TABLE crawl_sessions ADD COLUMN respect_robots BOOLEAN DEFAULT TRUE;
ALTER TABLE crawl_sessions ADD COLUMN parse_sitemaps BOOLEAN DEFAULT TRUE;
ALTER TABLE crawl_sessions ADD COLUMN discover_feeds BOOLEAN DEFAULT FALSE;
ALTER TABLE crawl_sessions ADD COLUMN include_patterns TEXT;
ALTER TABLE crawl_sessions ADD COLUMN exclude_patterns TEXT;
ALTER TABLE crawl_sessions ADD COLUMN page_delay INTEGER DEFAULT 2;
ALTER TABLE crawl_sessions ADD COLUMN deduplicate_paginated BOOLEAN DEFAULT TRUE;

-- Update domain_strategy check constraint to include all options
DROP TABLE IF EXISTS crawl_sessions_backup;
CREATE TABLE crawl_sessions_backup AS SELECT * FROM crawl_sessions;
DROP TABLE crawl_sessions;

CREATE TABLE crawl_sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  start_method TEXT NOT NULL CHECK (start_method IN ('ai', 'manual')),
  ai_prompt TEXT,
  groq_model TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'completed', 'failed', 'stopped')),
  
  -- Crawl Strategy and Configuration
  crawl_strategy TEXT DEFAULT 'smart' CHECK (crawl_strategy IN ('basic', 'smart', 'magic', 'comprehensive', 'adaptive', 'deep')),
  enable_deep_crawl BOOLEAN DEFAULT FALSE,
  max_depth INTEGER DEFAULT 3,
  max_urls INTEGER DEFAULT 50,
  domain_strategy TEXT DEFAULT 'same-domain' CHECK (domain_strategy IN ('same-domain', 'same-subdomain', 'whitelist', 'any')),
  domain_whitelist TEXT, -- JSON array of domains
  respect_robots BOOLEAN DEFAULT TRUE,
  parse_sitemaps BOOLEAN DEFAULT TRUE,
  discover_feeds BOOLEAN DEFAULT FALSE,
  include_patterns TEXT,
  exclude_patterns TEXT,
  
  -- Pagination settings
  enable_pagination BOOLEAN DEFAULT FALSE,
  pagination_strategy TEXT DEFAULT 'auto' CHECK (pagination_strategy IN ('auto', 'next-link', 'numbered', 'infinite-scroll', 'custom-selector')),
  pagination_selector TEXT,
  max_pages INTEGER DEFAULT 10,
  page_delay INTEGER DEFAULT 2,
  deduplicate_paginated BOOLEAN DEFAULT TRUE,
  
  -- Output options
  generate_markdown BOOLEAN DEFAULT TRUE,
  extract_metadata BOOLEAN DEFAULT TRUE,
  extract_links BOOLEAN DEFAULT TRUE,
  extract_media BOOLEAN DEFAULT FALSE,
  
  -- AI extraction settings
  enable_ai_extraction BOOLEAN DEFAULT FALSE,
  ai_extraction_schema TEXT, -- JSON schema for AI extraction
  
  -- Manual extraction settings
  crawl_delay INTEGER DEFAULT 1000, -- milliseconds
  delay_jitter INTEGER DEFAULT 500,
  max_concurrent INTEGER DEFAULT 5,
  user_agents TEXT, -- JSON array of user agents
  
  -- Content processing
  smart_cleaning BOOLEAN DEFAULT TRUE,
  remove_ads BOOLEAN DEFAULT TRUE,
  remove_navigation BOOLEAN DEFAULT TRUE,
  
  -- Statistics
  urls_discovered INTEGER DEFAULT 0,
  urls_completed INTEGER DEFAULT 0,
  urls_failed INTEGER DEFAULT 0,
  urls_blocked INTEGER DEFAULT 0,
  
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  completed_at DATETIME,
  
  FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Restore data from backup
INSERT INTO crawl_sessions (
  id, user_id, title, description, start_method, ai_prompt, groq_model, status,
  enable_deep_crawl, max_depth, domain_strategy, domain_whitelist,
  enable_pagination, pagination_strategy, pagination_selector, max_pages,
  generate_markdown, extract_metadata, extract_links, extract_media,
  enable_ai_extraction, ai_extraction_schema, crawl_delay, delay_jitter,
  max_concurrent, user_agents, smart_cleaning, remove_ads, remove_navigation,
  urls_discovered, urls_completed, urls_failed, urls_blocked,
  created_at, updated_at, completed_at
)
SELECT 
  id, user_id, title, description, start_method, ai_prompt, groq_model, status,
  enable_deep_crawl, max_depth, domain_strategy, domain_whitelist,
  enable_pagination, pagination_strategy, pagination_selector, max_pages,
  generate_markdown, extract_metadata, extract_links, extract_media,
  enable_ai_extraction, ai_extraction_schema, crawl_delay, delay_jitter,
  max_concurrent, user_agents, smart_cleaning, remove_ads, remove_navigation,
  urls_discovered, urls_completed, urls_failed, urls_blocked,
  created_at, updated_at, completed_at
FROM crawl_sessions_backup;

-- Clean up backup table
DROP TABLE crawl_sessions_backup;

-- Recreate indexes
CREATE INDEX IF NOT EXISTS idx_crawl_sessions_user_id ON crawl_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_crawl_sessions_status ON crawl_sessions(status);
CREATE INDEX IF NOT EXISTS idx_crawl_sessions_created_at ON crawl_sessions(created_at);