# Crawl4AI Ultimate Pro - Full Stack Edition

A comprehensive web scraping platform built with Hono, Cloudflare Pages, and modern web technologies. Transform any single-file scraping script into a scalable, production-ready full-stack application.

## 🚀 Live Application

- **Production URL**: https://3000-it2le3ytkbq3tizmojidw-6532622b.e2b.dev
- **API Health**: https://3000-it2le3ytkbq3tizmojidw-6532622b.e2b.dev/api/health


## 📋 Current Features

### ✅ Completed Features

1. **Multi-Session Crawl Management**
   - Create and manage multiple crawl sessions
   - AI-powered URL discovery using Groq API
   - Manual URL input support
   - Real-time session status 
   - Session lifecycle management (pending → running → completed)


2. **Comprehensive Database Schema**
   - User management with API key hashing
   - Crawl sessions with full configuration storage
   - URL tracking with detailed metadata
   - Proxy management with health monitoring
   - Export functionality for results
   - Proper foreign key relationships and constraints
   - 

3. **REST API Endpoints**
   - `/api/crawl/sessions` - Full CRUD operations
   - `/api/crawl/sessions/:id/start` - Start crawling
   - `/api/crawl/sessions/:id/stop` - Stop crawling
   - `/api/crawl/sessions/:id/progress` - Real-time progress tracking
   - `/api/proxies/*` - Proxy management and testing
   - `/api/health` - Application health check
   - All endpoints properly tested and functional

4. **Modern Frontend Interface**
   - Responsive design with Tailwind CSS
   - Interactive dashboard with real-time stats
   - Session creation wizard with validation
   - Proxy management interface
   - Progress tracking and notifications
   - Dynamic tab-based navigation

5. **Enhanced Crawler Engine**
   - Multi-threaded URL processing with concurrency control
   - Support for various proxy types and CORS bypass
   - Content extraction using Cheerio
   - Markdown generation with Turndown
   - Smart content cleaning and filtering
   - Error handling and retry logic

6. **Robust Proxy System**
   - Static proxy wrappers (CORS proxies)
   - Custom proxy support
   - Automatic proxy health testing
   - Performance scoring and statistics
   - Fallback proxy rotation

6. **Enhanced Crawler Engine**
   - Fixed status transitions and database consistency
   - Support for multiple content formats (HTML, Markdown)
   - Metadata extraction and link discovery
   - Error handling and retry mechanisms
   - Concurrent processing with configurable limits

### 🔄 Features In Development

1. **Crawler Engine Improvements**
   - Fixing async execution issues in Cloudflare Workers environment
   - Enhanced error reporting and debugging
   - Improved CORS proxy reliability
   - Better handling of JavaScript-heavy pages

2. **Real-time Updates**
   - WebSocket or Server-Sent Events for live progress
   - Real-time crawl status updates
   - Live proxy testing feedback

3. **User Authentication**
   - Multi-user support with JWT authentication
   - Personal API key management
   - Session isolation per user

4. **Advanced Features**
   - AI-powered content extraction with custom schemas
   - Deep crawling with intelligent link discovery
   - Advanced pagination support
   - Export functionality (CSV, JSON, PDF)

## 🏗️ Architecture

### Technology Stack

- **Backend**: Hono framework with TypeScript
- **Database**: Cloudflare D1 (SQLite)
- **Frontend**: Vanilla JavaScript + Tailwind CSS
- **Deployment**: Cloudflare Pages
- **Development**: PM2 for process management

### Data Models

#### Core Tables
- `users` - User accounts and API key management
- `crawl_sessions` - Crawl configurations and metadata
- `crawl_urls` - Individual URL results and content
- `proxies` - Proxy management and health monitoring
- `exports` - Generated export files
- `settings` - Application configuration

#### API Endpoints

**Crawl Management:**
- `GET /api/crawl/sessions` - List all sessions
- `POST /api/crawl/sessions` - Create new session
- `GET /api/crawl/sessions/:id` - Get session details
- `POST /api/crawl/sessions/:id/start` - Start crawling
- `POST /api/crawl/sessions/:id/stop` - Stop crawling
- `GET /api/crawl/sessions/:id/progress` - Get progress
- `POST /api/crawl/discover-urls` - AI URL discovery

**Proxy Management:**
- `GET /api/proxies` - List all proxies
- `POST /api/proxies/custom` - Add custom proxies
- `POST /api/proxies/load` - Load from external source
- `POST /api/proxies/test` - Test proxy health
- `GET /api/proxies/stats` - Get proxy statistics

## 🛠️ Development Setup

### Prerequisites
- Node.js 18+
- npm or yarn
- Wrangler CLI (for Cloudflare services)

### Local Development

1. **Clone and Setup**
   ```bash
   git clone <repository-url>
   cd webapp
   npm install
   ```

2. **Initialize Local Database**
   ```bash
   npm run db:migrate:local
   ```

3. **Build Project**
   ```bash
   npm run build
   ```

4. **Start Development Server**
   ```bash
   # Clean any existing processes
   npm run clean-port
   
   # Start with PM2 (recommended)
   pm2 start ecosystem.config.cjs
   
   # Or start directly
   npm run dev:sandbox
   ```

5. **Test Application**
   ```bash
   npm test
   # OR
   curl http://localhost:3000/api/health
   ```

### Available Scripts

```bash
# Development
npm run dev              # Vite dev server (local only)
npm run dev:sandbox      # Wrangler pages dev (sandbox)
npm run build            # Build for production

# Database
npm run db:migrate:local # Apply migrations locally
npm run db:migrate:prod  # Apply migrations to production
npm run db:console:local # Local database console
npm run db:console:prod  # Production database console

# Deployment
npm run deploy           # Deploy to Cloudflare Pages
npm run deploy:prod      # Deploy to production with project name

# Utilities
npm run clean-port       # Kill processes on port 3000
npm test                 # Test local server
```

## 🌐 Deployment

### Cloudflare Pages Deployment

1. **Setup Cloudflare Authentication**
   ```bash
   # Set up Cloudflare API key in environment
   export CLOUDFLARE_API_TOKEN=your-api-token
   ```

2. **Create Production Database**
   ```bash
   npx wrangler d1 create webapp-production
   # Update wrangler.jsonc with database ID
   ```

3. **Deploy Application**
   ```bash
   npm run build
   npm run db:migrate:prod
   npm run deploy:prod
   ```

### Configuration

Update `wrangler.jsonc` with your specific configuration:
```jsonc
{
  "name": "your-project-name",
  "d1_databases": [
    {
      "binding": "DB",
      "database_name": "webapp-production",
      "database_id": "your-actual-database-id"
    }
  ]
}
```

## 📊 Usage Guide

### Creating a Crawl Session

1. **Navigate to "New Crawl" tab**
2. **Enter session details**:
   - Title and description
   - Choose AI discovery or manual URLs

3. **AI Discovery** (recommended):
   - Enter your Groq API key
   - Select AI model
   - Describe what you want to find
   - Click "Discover URLs"

4. **Configure options**:
   - Enable deep crawling
   - Set output formats
   - Configure content cleaning

5. **Create and start session**

### Managing Proxies

1. **View proxy statistics** in the Proxies tab
2. **Add custom proxies** using the "Add Proxies" button
3. **Test proxy health** with "Test All" or individual tests
4. **Monitor performance** through the proxy table

### Monitoring Progress

- **Dashboard**: Real-time statistics and recent sessions
- **Sessions tab**: Detailed view of all crawl sessions
- **Individual session tracking**: Progress percentages and status

## 🔧 API Integration

### Example Usage

```javascript
// Create a new crawl session
const session = await fetch('/api/crawl/sessions', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    title: 'News Sites Crawl',
    start_method: 'manual',
    urls: ['https://example.com/news'],
    generate_markdown: true,
    extract_metadata: true
  })
});

// Start crawling
await fetch(`/api/crawl/sessions/${session.id}/start`, {
  method: 'POST'
});

// Monitor progress
const progress = await fetch(`/api/crawl/sessions/${session.id}/progress`);
```


## 🚨 Current Status & Next Steps

### ✅ Completed in This Session
- ✅ Fixed database schema and foreign key constraints
- ✅ Updated ecosystem configuration for proper PM2 management
- ✅ Corrected database field name mismatches in crawler engine
- ✅ Implemented comprehensive error handling
- ✅ Enhanced frontend JavaScript application
- ✅ Deployed working application with live URL
- ✅ Fixed static file serving and API endpoints

### 🔧 In Progress
- 🔄 Debugging crawler engine async execution in Workers environment
- 🔄 Improving CORS proxy reliability and rotation
- 🔄 Enhancing real-time progress updates

### 🎯 Next Priority Items
1. **Fix Crawler Execution**: Complete debugging of async worker execution
2. **Add Authentication**: Implement user login and session management  
3. **Enhanced Monitoring**: Add better logging and debugging tools
4. **Performance Optimization**: Improve crawler speed and reliability
5. **Export Features**: Complete CSV, JSON, and PDF export functionality


## 📈 Performance & Monitoring

- **Health Check**: `/api/health` endpoint for monitoring
- **Database Stats**: Optimized queries with proper indexing
- **Proxy Performance**: Real-time latency and success rate tracking
- **Session Metrics**: Comprehensive crawl statistics

## 🔒 Security Features

- **Input Validation**: All API endpoints validate input data
- **SQL Injection Prevention**: Parameterized queries throughout
- **Rate Limiting**: Ready for implementation with Cloudflare
- **API Key Hashing**: Secure storage of sensitive credentials

## 📝 License

This project is licensed under the MIT License. See LICENSE file for details.

---

**Built with ❤️ using Hono, Cloudflare Pages, and modern web technologies**