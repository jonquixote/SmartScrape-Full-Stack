-- Fix column name mismatches between crawler engine and database schema

-- Update crawl_urls table to match crawler engine expectations
-- Only add columns if they don't exist

-- Add markdown column (separate from existing markdown_content)
ALTER TABLE crawl_urls ADD COLUMN markdown TEXT;

-- Add response_time column (separate from existing processing_time)
ALTER TABLE crawl_urls ADD COLUMN response_time INTEGER;

-- Update the status values to match crawler engine expectations
UPDATE crawl_urls SET status = 'completed' WHERE status = 'success';