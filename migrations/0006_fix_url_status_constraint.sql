-- Migration 0006: Fix crawl_urls status constraint to include 'completed'
-- This fixes the issue where the crawler engine can't set status to 'completed'

-- Recreate crawl_urls table with updated status constraint
-- First backup the table
CREATE TABLE crawl_urls_backup AS SELECT * FROM crawl_urls;

-- Drop the original table
DROP TABLE crawl_urls;

-- Recreate with updated status constraint
CREATE TABLE crawl_urls (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id INTEGER NOT NULL,
  url TEXT NOT NULL,
  parent_url TEXT,
  depth INTEGER DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'discovered' CHECK (status IN ('discovered', 'processing', 'completed', 'success', 'failed', 'blocked')),
  
  -- Response data
  response_status INTEGER,
  content_type TEXT,
  content_length INTEGER,
  
  -- Extracted content
  title TEXT,
  content TEXT, -- Main content
  markdown_content TEXT,
  markdown TEXT, -- Added in migration 0003
  metadata TEXT, -- JSON metadata
  links TEXT, -- JSON array of extracted links
  media_urls TEXT, -- JSON array of media URLs
  ai_extracted_data TEXT, -- JSON data from AI extraction
  
  -- Processing info
  proxy_used TEXT,
  user_agent_used TEXT,
  processing_time INTEGER, -- milliseconds
  response_time INTEGER, -- Added in migration 0003
  error_message TEXT,
  
  -- Enhanced features from migration 0004
  extracted_data TEXT DEFAULT NULL,
  page_number INTEGER DEFAULT NULL,
  is_paginated BOOLEAN DEFAULT FALSE,
  
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  
  FOREIGN KEY (session_id) REFERENCES crawl_sessions(id),
  UNIQUE(session_id, url)
);

-- Restore data from backup and convert any remaining 'success' status to 'completed'
INSERT INTO crawl_urls (
  id, session_id, url, parent_url, depth, status,
  response_status, content_type, content_length,
  title, content, markdown_content, markdown, metadata, links, media_urls, ai_extracted_data,
  proxy_used, user_agent_used, processing_time, response_time, error_message,
  extracted_data, page_number, is_paginated,
  created_at, updated_at
)
SELECT 
  id, session_id, url, parent_url, depth, 
  CASE 
    WHEN status = 'success' THEN 'completed'
    ELSE status 
  END as status,
  response_status, content_type, content_length,
  title, content, markdown_content, markdown, metadata, links, media_urls, ai_extracted_data,
  proxy_used, user_agent_used, processing_time, response_time, error_message,
  extracted_data, page_number, is_paginated,
  created_at, updated_at
FROM crawl_urls_backup;

-- Clean up backup table
DROP TABLE crawl_urls_backup;

-- Recreate indexes
CREATE INDEX IF NOT EXISTS idx_crawl_urls_session_id ON crawl_urls(session_id);
CREATE INDEX IF NOT EXISTS idx_crawl_urls_url ON crawl_urls(url);
CREATE INDEX IF NOT EXISTS idx_crawl_urls_status ON crawl_urls(status);
CREATE INDEX IF NOT EXISTS idx_crawl_urls_parent_url ON crawl_urls(parent_url);
CREATE INDEX IF NOT EXISTS idx_crawl_urls_session_status ON crawl_urls(session_id, status);