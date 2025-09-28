# Crawl4AI Full-Stack Application

A comprehensive web application showcasing all features of the Crawl4AI web crawling engine with a modern, intuitive interface.

## 🌟 Features

- **Complete Crawl4AI Integration**: All Crawl4AI features exposed through a clean web interface
- **Real-time Dashboard**: Live progress tracking and performance metrics
- **Advanced Configuration**: Full control over all crawling parameters
- **Feature Toggles**: Quick access to common features (Deep Crawl, Pagination, AI Extraction, etc.)
- **Responsive Design**: Works on all device sizes
- **RESTful API**: Complete backend API exposing all Crawl4AI capabilities

## 🚀 Quick Start

### Prerequisites

- Python 3.8+
- Node.js 16+
- npm/yarn

### Installation

```bash
# Clone the repository
git clone <repository-url>
cd SmartScrape-Full-Stack

# Create and activate Python virtual environment
python3 -m venv venv
source venv/bin/activate

# Install Python dependencies
pip install crawl4ai
pip install fastapi uvicorn

# Install Playwright browsers
playwright install

# Install Node.js dependencies
npm install
```

### Running the Application

1. **Start the Crawl4AI service** (Terminal 1):
```bash
source venv/bin/activate
python crawl4ai-service.py
```

2. **Start the web interface** (Terminal 2):
```bash
npm run dev:local
```

3. **Access the application**:
Open your browser to http://localhost:3000

## 🛠️ Architecture

```
┌─────────────────────────────┐
│      Web Interface          │
│  (HTML/CSS/JavaScript)      │
├─────────────────────────────┤
│         Hono.js             │
│    (Node.js Server)         │
├─────────────────────────────┤
│      REST API               │
│   (FastAPI Python)          │
├─────────────────────────────┤
│      Crawl4AI Engine        │
│   (Advanced Web Crawling)   │
└─────────────────────────────┘
```

## 🎯 Key Components

### 1. Web Interface (`public/comprehensive_ui.html`)
A feature-rich UI demonstrating all Crawl4AI capabilities:

- **Quick Feature Toggles**: One-click activation of common features
- **Advanced Configuration**: Comprehensive settings for all crawling options
- **Progress Dashboard**: Real-time metrics and visualization
- **Results Display**: Structured presentation of crawled content
- **Modals**: Dedicated interfaces for API keys, settings, and AI schemas

### 2. Backend Service (`crawl4ai-service.py`)
A robust Python FastAPI service that exposes Crawl4AI functionality:

- **Health Check**: Service status and feature availability
- **Single URL Crawling**: Full configuration options
- **Batch Crawling**: Multiple URL processing
- **Structure Analysis**: Page structure detection and suggestions
- **Pagination Testing**: Pagination pattern detection

### 3. Frontend Framework (`src/index.tsx`)
A Hono.js application serving the web interface:

- **Main Route**: Comprehensive UI with all features
- **API Routes**: All backend endpoints
- **Static Files**: HTML, CSS, JavaScript assets

## 🔧 Crawl4AI Features Demonstrated

### Basic Crawling
Foundation of web crawling - fetching and parsing web pages

### Deep Crawling
Multi-level crawling with configurable depth (1-10 levels)

### Pagination Handling
Automatic detection and traversal of paginated content

### AI-Based Extraction
LLM-powered content extraction with custom schemas

### Chunking Strategies
Content segmentation for better processing

### Screenshot Capture
Visual documentation of crawled pages

### JavaScript Execution
Dynamic content loading and interaction

### Performance Metrics
Real-time crawling statistics and monitoring

## 🌐 API Endpoints

### Core Endpoints
- `GET /health` - Service health check
- `POST /crawl` - Single URL crawling
- `POST /batch-crawl` - Multiple URL crawling
- `POST /analyze-structure` - Page structure analysis
- `POST /test-pagination` - Pagination detection testing

### Request Parameters
The API accepts comprehensive parameters that mirror Crawl4AI's capabilities:
- URL and crawling strategy
- Extraction and chunking strategies
- Pagination and deep crawl settings
- JavaScript execution and screenshot options
- Proxy and session management
- Custom CSS selectors and XPath expressions

## 📊 Real-Time Monitoring

### Dashboard Features
- Progress bars and completion metrics
- Success/failure counters
- Performance graphs and trends
- Detailed status messages
- Resource utilization indicators

## 💾 Result Management

### Export Options
- JSON download for structured data
- CSV export for spreadsheet compatibility
- Detailed result cards with extracted content
- Link and media asset listings
- Screenshot previews
- Performance metrics and statistics

## 🤖 AI Integration

### LLM Providers Supported
- Groq
- OpenAI
- Anthropic

### AI Features
- Custom schema definition for structured extraction
- Natural language instructions for content targeting
- Intelligent content filtering and organization

## 🌐 Proxy Support

### Proxy Features
- IP rotation and anonymity
- Geographic location spoofing
- Rate limit avoidance
- Blocked content access

## 🛡️ Security Features

### Built-in Security
- User agent randomization
- Request rate limiting
- Session persistence
- Cookie management
- SSL certificate handling

## 📈 Performance Optimization

### Optimization Features
- Concurrent request management
- Request delay configuration
- Timeout and retry settings
- Memory usage monitoring
- Browser instance pooling

## 🎨 UI/UX Highlights

### Design Features
- Clean, modern design with glassmorphism effects
- Intuitive feature toggles and controls
- Responsive layout for all device sizes
- Real-time feedback and status updates
- Interactive data visualization
- Accessible color scheme and typography

## 🚀 Deployment Options

### Local Development
- Vite development server with hot reloading

### Production Deployment
- Static file serving for frontend
- Python service as backend API
- Containerized deployment with Docker

### Cloud Deployment
- Cloudflare Pages for frontend
- Python service on cloud infrastructure
- Scalable architecture for high-volume crawling

## 📚 Learning Resources

### Getting Started
1. Explore the comprehensive UI to understand all features
2. Experiment with different crawling strategies
3. Define custom extraction schemas for your use cases
4. Monitor performance metrics to optimize crawling
5. Integrate with LLMs for intelligent content processing

## 🤝 Contributing

Contributions are welcome! Feel free to:
- Report bugs and issues
- Suggest new features and improvements
- Submit pull requests with enhancements
- Improve documentation and examples
- Share use cases and success stories

## 📄 License

This project is licensed under the MIT License.

## 🙏 Acknowledgments

Special thanks to:
- The Crawl4AI team for creating an exceptional web crawling library
- The open-source community for continuous innovation
- All contributors who help improve this demonstration

---

**Happy crawling with Crawl4AI! 🕷️**