-- Migration 0004: Enhanced features for improved crawling
-- Adds support for extracted data, pagination info, and better URL tracking

-- Add new columns to crawl_urls table for enhanced data storage
ALTER TABLE crawl_urls ADD COLUMN extracted_data TEXT DEFAULT NULL;
ALTER TABLE crawl_urls ADD COLUMN page_number INTEGER DEFAULT NULL;
ALTER TABLE crawl_urls ADD COLUMN is_paginated BOOLEAN DEFAULT FALSE;

-- Add new columns to crawl_sessions for better configuration
ALTER TABLE crawl_sessions ADD COLUMN extraction_templates TEXT DEFAULT NULL;
ALTER TABLE crawl_sessions ADD COLUMN pagination_config TEXT DEFAULT NULL;
ALTER TABLE crawl_sessions ADD COLUMN crawl_performance TEXT DEFAULT NULL;

-- Create index for better performance on common queries (skip if already exists)
CREATE INDEX IF NOT EXISTS idx_crawl_urls_session_status ON crawl_urls(session_id, status);

-- Create extraction_templates table for reusable extraction schemas
CREATE TABLE IF NOT EXISTS extraction_templates (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT,
    schema_json TEXT NOT NULL,
    created_by INTEGER DEFAULT 1,
    is_public BOOLEAN DEFAULT FALSE,
    usage_count INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create crawl_performance table for tracking performance metrics
CREATE TABLE IF NOT EXISTS crawl_performance (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id INTEGER NOT NULL,
    metric_name TEXT NOT NULL,
    metric_value REAL NOT NULL,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (session_id) REFERENCES crawl_sessions(id) ON DELETE CASCADE
);

-- Create crawl_errors table for better error tracking
CREATE TABLE IF NOT EXISTS crawl_errors (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id INTEGER NOT NULL,
    url_id INTEGER,
    error_type TEXT NOT NULL,
    error_message TEXT NOT NULL,
    error_details TEXT,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (session_id) REFERENCES crawl_sessions(id) ON DELETE CASCADE,
    FOREIGN KEY (url_id) REFERENCES crawl_urls(id) ON DELETE CASCADE
);

-- Create indexes for performance tables
CREATE INDEX IF NOT EXISTS idx_crawl_performance_session ON crawl_performance(session_id);
CREATE INDEX IF NOT EXISTS idx_crawl_errors_session ON crawl_errors(session_id);
CREATE INDEX IF NOT EXISTS idx_extraction_templates_public ON extraction_templates(is_public);