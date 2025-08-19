// Database types for Crawl4AI Ultimate Pro

export interface User {
  id: number;
  email: string;
  name: string;
  api_key_hash?: string;
  created_at: string;
  updated_at: string;
}

export interface CrawlSession {
  id: number;
  user_id: number;
  title: string;
  description?: string;
  start_method: 'ai' | 'manual';
  ai_prompt?: string;
  groq_model?: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'stopped';
  
  // Crawl Configuration
  enable_deep_crawl: boolean;
  max_depth: number;
  domain_strategy: 'same' | 'whitelist' | 'any';
  domain_whitelist?: string; // JSON array
  
  // Pagination settings
  enable_pagination: boolean;
  pagination_strategy: 'auto' | 'custom-selector';
  pagination_selector?: string;
  max_pages: number;
  
  // Output options
  generate_markdown: boolean;
  extract_metadata: boolean;
  extract_links: boolean;
  extract_media: boolean;
  
  // AI extraction settings
  enable_ai_extraction: boolean;
  ai_extraction_schema?: string; // JSON schema
  
  // Manual extraction settings
  crawl_delay: number;
  delay_jitter: number;
  max_concurrent: number;
  user_agents?: string; // JSON array
  
  // Content processing
  smart_cleaning: boolean;
  remove_ads: boolean;
  remove_navigation: boolean;
  
  // Statistics
  urls_discovered: number;
  urls_completed: number;
  urls_failed: number;
  urls_blocked: number;
  
  created_at: string;
  updated_at: string;
  completed_at?: string;
}

export interface CrawlUrl {
  id: number;
  session_id: number;
  url: string;
  parent_url?: string;
  depth: number;
  status: 'discovered' | 'processing' | 'success' | 'failed' | 'blocked';
  
  // Response data
  response_status?: number;
  content_type?: string;
  content_length?: number;
  
  // Extracted content
  title?: string;
  content?: string;
  markdown_content?: string;
  metadata?: string; // JSON metadata
  links?: string; // JSON array of links
  media_urls?: string; // JSON array of media URLs
  ai_extracted_data?: string; // JSON data from AI extraction
  
  // Processing info
  proxy_used?: string;
  user_agent_used?: string;
  processing_time?: number;
  error_message?: string;
  
  created_at: string;
  updated_at: string;
}

export interface Proxy {
  id: number;
  name: string;
  url: string;
  source: string;
  type: 'http' | 'https' | 'socks4' | 'socks5';
  
  // Health monitoring
  status: 'inactive' | 'active' | 'testing' | 'failed';
  latency?: number;
  score: number;
  last_tested_at?: string;
  
  // Usage statistics
  success_count: number;
  failure_count: number;
  total_requests: number;
  
  created_at: string;
  updated_at: string;
}

export interface Export {
  id: number;
  session_id: number;
  user_id: number;
  format: 'json' | 'csv' | 'markdown' | 'pdf';
  filename: string;
  file_size?: number;
  download_count: number;
  created_at: string;
  expires_at?: string;
}

export interface Setting {
  id: number;
  key: string;
  value?: string;
  description?: string;
  created_at: string;
  updated_at: string;
}

// API Request/Response types
export interface CreateCrawlSessionRequest {
  title: string;
  description?: string;
  start_method: 'ai' | 'manual';
  ai_prompt?: string;
  groq_model?: string;
  urls?: string[]; // For manual method
  
  // Configuration options
  enable_deep_crawl?: boolean;
  max_depth?: number;
  domain_strategy?: 'same' | 'whitelist' | 'any';
  domain_whitelist?: string[];
  enable_pagination?: boolean;
  pagination_strategy?: 'auto' | 'custom-selector';
  pagination_selector?: string;
  max_pages?: number;
  generate_markdown?: boolean;
  extract_metadata?: boolean;
  extract_links?: boolean;
  extract_media?: boolean;
  enable_ai_extraction?: boolean;
  ai_extraction_schema?: object;
  crawl_delay?: number;
  delay_jitter?: number;
  max_concurrent?: number;
  user_agents?: string[];
  smart_cleaning?: boolean;
  remove_ads?: boolean;
  remove_navigation?: boolean;
}

export interface AIDiscoveryRequest {
  prompt: string;
  groq_api_key: string;
  model: string;
}

export interface AIDiscoveryResponse {
  urls: string[];
}

export interface CrawlProgress {
  session_id: number;
  status: string;
  urls_discovered: number;
  urls_completed: number;
  urls_failed: number;
  urls_blocked: number;
  current_url?: string;
  progress_percentage: number;
}

export interface ProxyTestRequest {
  proxy_ids?: number[];
  test_all?: boolean;
}

export interface ProxyTestResult {
  proxy_id: number;
  status: 'active' | 'failed';
  latency?: number;
  error?: string;
}

// Cloudflare bindings interface
export interface Bindings {
  DB: D1Database;
  AI: Ai;
}