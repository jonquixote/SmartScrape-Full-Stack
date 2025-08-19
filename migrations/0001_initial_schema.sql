-- Crawl4AI Ultimate Pro Database Schema
-- Initial migration for web scraping application

-- Users table for multi-user support
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  api_key_hash TEXT, -- For storing hashed Groq API keys
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Crawl sessions table
CREATE TABLE IF NOT EXISTS crawl_sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  start_method TEXT NOT NULL CHECK (start_method IN ('ai', 'manual')), -- ai or manual
  ai_prompt TEXT,
  groq_model TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'completed', 'failed', 'stopped')),
  
  -- Crawl Configuration
  enable_deep_crawl BOOLEAN DEFAULT FALSE,
  max_depth INTEGER DEFAULT 3,
  domain_strategy TEXT DEFAULT 'same' CHECK (domain_strategy IN ('same', 'whitelist', 'any')),
  domain_whitelist TEXT, -- JSON array of domains
  
  -- Pagination settings
  enable_pagination BOOLEAN DEFAULT FALSE,
  pagination_strategy TEXT DEFAULT 'auto' CHECK (pagination_strategy IN ('auto', 'custom-selector')),
  pagination_selector TEXT,
  max_pages INTEGER DEFAULT 10,
  
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

-- URLs discovered/processed in crawl sessions
CREATE TABLE IF NOT EXISTS crawl_urls (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id INTEGER NOT NULL,
  url TEXT NOT NULL,
  parent_url TEXT,
  depth INTEGER DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'discovered' CHECK (status IN ('discovered', 'processing', 'success', 'failed', 'blocked')),
  
  -- Response data
  response_status INTEGER,
  content_type TEXT,
  content_length INTEGER,
  
  -- Extracted content
  title TEXT,
  content TEXT, -- Main content
  markdown_content TEXT,
  metadata TEXT, -- JSON metadata
  links TEXT, -- JSON array of extracted links
  media_urls TEXT, -- JSON array of media URLs
  ai_extracted_data TEXT, -- JSON data from AI extraction
  
  -- Processing info
  proxy_used TEXT,
  user_agent_used TEXT,
  processing_time INTEGER, -- milliseconds
  error_message TEXT,
  
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  
  FOREIGN KEY (session_id) REFERENCES crawl_sessions(id),
  UNIQUE(session_id, url)
);

-- Proxy management
CREATE TABLE IF NOT EXISTS proxies (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  url TEXT NOT NULL UNIQUE,
  source TEXT, -- 'static', 'custom', or proxy source name
  type TEXT DEFAULT 'http' CHECK (type IN ('http', 'https', 'socks4', 'socks5')),
  
  -- Health monitoring
  status TEXT NOT NULL DEFAULT 'inactive' CHECK (status IN ('inactive', 'active', 'testing', 'failed')),
  latency INTEGER DEFAULT NULL, -- milliseconds
  score INTEGER DEFAULT 0, -- Performance score 0-100
  last_tested_at DATETIME,
  
  -- Usage statistics
  success_count INTEGER DEFAULT 0,
  failure_count INTEGER DEFAULT 0,
  total_requests INTEGER DEFAULT 0,
  
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Crawl results export/downloads
CREATE TABLE IF NOT EXISTS exports (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id INTEGER NOT NULL,
  user_id INTEGER NOT NULL,
  format TEXT NOT NULL CHECK (format IN ('json', 'csv', 'markdown', 'pdf')),
  filename TEXT NOT NULL,
  file_size INTEGER,
  download_count INTEGER DEFAULT 0,
  
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  expires_at DATETIME, -- For temporary downloads
  
  FOREIGN KEY (session_id) REFERENCES crawl_sessions(id),
  FOREIGN KEY (user_id) REFERENCES users(id)
);

-- System configurations and settings
CREATE TABLE IF NOT EXISTS settings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  key TEXT UNIQUE NOT NULL,
  value TEXT,
  description TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_crawl_sessions_user_id ON crawl_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_crawl_sessions_status ON crawl_sessions(status);
CREATE INDEX IF NOT EXISTS idx_crawl_sessions_created_at ON crawl_sessions(created_at);

CREATE INDEX IF NOT EXISTS idx_crawl_urls_session_id ON crawl_urls(session_id);
CREATE INDEX IF NOT EXISTS idx_crawl_urls_url ON crawl_urls(url);
CREATE INDEX IF NOT EXISTS idx_crawl_urls_status ON crawl_urls(status);
CREATE INDEX IF NOT EXISTS idx_crawl_urls_parent_url ON crawl_urls(parent_url);

CREATE INDEX IF NOT EXISTS idx_proxies_status ON proxies(status);
CREATE INDEX IF NOT EXISTS idx_proxies_source ON proxies(source);
CREATE INDEX IF NOT EXISTS idx_proxies_score ON proxies(score DESC);

CREATE INDEX IF NOT EXISTS idx_exports_session_id ON exports(session_id);
CREATE INDEX IF NOT EXISTS idx_exports_user_id ON exports(user_id);

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

-- Insert default settings
INSERT OR IGNORE INTO settings (key, value, description) VALUES
  ('app_version', '1.0.0', 'Application version'),
  ('max_concurrent_crawls', '10', 'Maximum concurrent crawl sessions'),
  ('default_crawl_delay', '1000', 'Default crawl delay in milliseconds'),
  ('max_pages_per_session', '1000', 'Maximum pages per crawl session'),
  ('enable_ai_features', 'true', 'Enable AI-powered features'),
  ('default_user_agent', 'Crawl4AI Ultimate Pro/1.0', 'Default user agent string');

-- Insert default proxies (static wrappers)
INSERT OR IGNORE INTO proxies (name, url, source, type, status) VALUES
  ('AllOrigins', 'https://api.allorigins.win/raw?url={URL}', 'static', 'http', 'active'),
  ('ThingProxy', 'https://thingproxy.freeboard.io/fetch/{URL}', 'static', 'http', 'active'),
  ('CORS-Anywhere', 'https://cors-anywhere.herokuapp.com/{URL}', 'static', 'http', 'active'),
  ('CodeTabs', 'https://api.codetabs.com/v1/proxy?quest={URL}', 'static', 'http', 'active'),
  ('CORS-Proxy.io', 'https://corsproxy.io/?{URL}', 'static', 'http', 'active');