# SmartScrape Simplified UI Documentation

## Overview

The SmartScrape Simplified UI transforms the powerful Crawl4AI Ultimate Pro engine into an intuitive, user-friendly interface while preserving all advanced features. This document explains how to use the simplified interface and access all Crawl4AI capabilities.

## Key Features

### 1. One-Prompt Interface
- **Single input field** for describing what you want to crawl
- **AI-powered URL discovery** or manual URL entry
- **Simple workflow** with clear steps

### 2. Feature Activation System
- **Radio Buttons**: For mutually exclusive options (URL discovery method, crawl strategy)
- **Checkboxes**: For enabling/disabling features (deep crawling, pagination, AI extraction)
- **Edit Buttons**: Open modals for detailed configuration of each feature

### 3. Modal-Based Configuration
All advanced settings are accessed through modals, keeping the main interface clean:
- Deep Crawling Settings
- Pagination Configuration
- AI Extraction Parameters
- Manual Extraction Selectors
- Advanced Crawl Settings
- Proxy Management

### 4. Real-Time Progress Tracking
- Visual progress bar
- Statistics dashboard with key metrics
- Live chart showing success/failure rates
- Results display as they're crawled

## Workflow

### 1. Define Your Crawl
- Enter a prompt describing what you want to crawl
- Choose between AI discovery or manual URLs
- Configure AI settings if using AI discovery

### 2. Select URLs
- Review and select URLs discovered by AI
- Confirm which URLs to crawl

### 3. Configure Features
Navigate through three configuration steps:
- **Strategy** (crawl mode, deep crawling, pagination, proxies)
- **Extraction** (output formats, AI/manual extraction)
- **Advanced** (content processing, crawl parameters)

Use "Edit" buttons to access detailed settings in modals.

### 4. Start Crawling
- Click "Start Crawling" to begin
- Monitor progress in real-time
- View results as they're collected

### 5. Export Results
- Download results in JSON or CSV format
- Access all crawled content and metadata

## API Integration

The simplified UI connects to enhanced API endpoints that maintain full compatibility with the existing system while providing a cleaner interface:

### Key Endpoints
- `POST /api/simplified-crawl/sessions/create-simplified` - Create crawl session
- `POST /api/simplified-crawl/discover-urls-simplified` - AI URL discovery
- `POST /api/simplified-crawl/sessions/:id/start-simplified` - Start crawl
- `GET /api/simplified-crawl/sessions/:id/progress-simplified` - Progress tracking
- `GET /api/simplified-crawl/sessions/:id/export-simplified/:format` - Export results

## Benefits

### For Users
- **Simplified Experience**: Complex features accessible through simple interface
- **Guided Workflow**: Clear steps for setting up and running crawls
- **Flexible Configuration**: Access to all advanced settings when needed
- **Real-Time Feedback**: Immediate progress updates and results

### For Developers
- **Backward Compatibility**: Existing API endpoints unchanged
- **Modular Design**: Easy to extend with new features
- **Clean Separation**: UI logic separated from backend complexity
- **Maintainable Code**: Simplified routes and components

## Feature Preservation

All original Crawl4AI features are preserved:
- AI-powered URL discovery with multiple LLM models
- Deep crawling with configurable depth limits
- Pagination handling with auto-detection
- Proxy management with health monitoring
- AI extraction with custom schemas
- Manual extraction with CSS/XPath selectors
- Content processing and cleaning
- Export capabilities (JSON, CSV)
- Real-time progress tracking

The simplified UI makes these features more accessible without sacrificing functionality.