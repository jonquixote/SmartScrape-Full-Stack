# SmartScrape Simplified API Endpoints

## Overview

This document outlines the new simplified API endpoints that complement the enhanced Crawl4AI Ultimate Pro engine while maintaining full backward compatibility with existing endpoints.

## New Simplified Endpoints

All simplified endpoints are prefixed with `/api/simplified-crawl/*` to distinguish them from the original API while maintaining compatibility.

### Session Management
- `POST /api/simplified-crawl/sessions/create-simplified` - Create simplified crawl session
- `GET /api/simplified-crawl/sessions/:id/simplified` - Get simplified session details
- `POST /api/simplified-crawl/sessions/:id/start-simplified` - Start simplified crawl
- `POST /api/simplified-crawl/sessions/:id/stop-simplified` - Stop simplified crawl
- `GET /api/simplified-crawl/sessions/:id/progress-simplified` - Get simplified progress
- `GET /api/simplified-crawl/sessions/:id/export-simplified/:format` - Export simplified results

### URL Discovery
- `POST /api/simplified-crawl/discover-urls-simplified` - AI-powered URL discovery

### Configuration
- `GET /api/simplified-crawl/config/simplified` - Get simplified configuration
- `POST /api/simplified-crawl/config/save-simplified` - Save simplified configuration
- `POST /api/simplified-crawl/config/load-simplified` - Load simplified configuration

## Endpoint Details

### Create Simplified Crawl Session
```http
POST /api/simplified-crawl/sessions/create-simplified
Content-Type: application/json

{
  "prompt": "Find all news articles about AI from tech websites",
  "start_method": "ai",
  "ai_api_key": "gsk_...",
  "ai_model": "gemma2-9b-it",
  "urls": ["https://example.com"],
  
  // Strategy
  "crawl_strategy": "smart",
  "enable_deep_crawl": true,
  "max_depth": 3,
  "max_urls": 50,
  "domain_strategy": "same-domain",
  "domain_whitelist": ["example.com"],
  "respect_robots": true,
  "parse_sitemaps": true,
  "discover_feeds": false,
  "include_patterns": "/blog/*, /articles/*, *.html",
  "exclude_patterns": "/admin/*, /login/*, *.pdf",
  
  // Pagination
  "enable_pagination": true,
  "pagination_strategy": "auto",
  "pagination_selector": "a.next, .pagination-next, [rel='next']",
  "max_pages": 10,
  "page_delay": 2,
  "deduplicate_paginated": true,
  
  // Output options
  "generate_markdown": true,
  "extract_metadata": true,
  "extract_links": true,
  "extract_media": false,
  
  // AI extraction
  "enable_ai_extraction": true,
  "groq_api_key": "gsk_...",
  "llm_model": "gemma2-9b-it",
  "ai_request_delay": 500,
  "custom_prompt": "Extract the main content, title, and key information. Format as clean JSON.",
  
  // Manual extraction
  "css_selector": ".article-content, #main",
  "xpath_selector": "//div[@class='content']",
  
  // Advanced settings
  "timeout": 10,
  "max_retries": 3,
  "crawl_delay": 1,
  "delay_jitter": 0.5,
  "concurrent_requests": 3,
  "user_agents": [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36"
  ],
  "smart_cleaning": true,
  "filter_ads": true,
  "filter_navigation": true
}
```

### AI URL Discovery
```http
POST /api/simplified-crawl/discover-urls-simplified
Content-Type: application/json

{
  "prompt": "Find all news articles about AI from tech websites",
  "ai_api_key": "gsk_...",
  "ai_model": "gemma2-9b-it"
}
```

### Start Simplified Crawl
```http
POST /api/simplified-crawl/sessions/:id/start-simplified
```

### Stop Simplified Crawl
```http
POST /api/simplified-crawl/sessions/:id/stop-simplified
```

### Get Simplified Progress
```http
GET /api/simplified-crawl/sessions/:id/progress-simplified

Response:
{
  "session_id": 1,
  "status": "running",
  "progress_percentage": 75,
  "urls_discovered": 50,
  "urls_completed": 38,
  "urls_failed": 2,
  "urls_blocked": 1,
  "urls_paginated": 5,
  "current_url": "https://example.com/page5",
  "current_depth": 2,
  "current_speed": 3,
  "estimated_completion": "2024-08-31T10:30:00Z"
}
```

### Export Simplified Results
```http
GET /api/simplified-crawl/sessions/:id/export-simplified/json
GET /api/simplified-crawl/sessions/:id/export-simplified/csv
```

## Benefits

### For Developers
- **Backward Compatibility**: All existing endpoints remain functional
- **Cleaner Interface**: Simplified routes for common operations
- **Easier Integration**: More intuitive API for new users
- **Modular Design**: Separated concerns for better maintainability

### For Users
- **Simplified Access**: Easier to understand API endpoints
- **Intuitive Naming**: Clear, descriptive endpoint names
- **Comprehensive Documentation**: Well-documented simplified routes
- **Consistent Responses**: Predictable response formats

## Implementation Notes

1. **Mapping to Existing Functionality**: All simplified endpoints map to existing complex functionality
2. **Parameter Validation**: All inputs are validated before processing
3. **Error Handling**: Comprehensive error handling with meaningful messages
4. **Performance**: Optimized for fast response times
5. **Security**: Input sanitization and secure API key handling
6. **Logging**: Detailed logging for debugging and monitoring

## Migration Path

Existing integrations can continue using the original endpoints without changes. New implementations should use the simplified endpoints for easier development.

Both endpoint sets coexist and share the same underlying database and crawler engine, ensuring consistent behavior regardless of which endpoints are used.