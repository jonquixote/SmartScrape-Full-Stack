# SmartScrape Full-Stack Application

This is a full-stack web application that combines a modern frontend with a powerful backend for web crawling and data extraction.

## Services

1. **Frontend Service** (Port 3000)
   - Serves the comprehensive UI for interacting with the Crawl4AI service
   - Built with HTML, Tailwind CSS, and JavaScript

2. **Backend Service** (Port 8000)
   - Provides RESTful API endpoints for web crawling
   - Built with Python, FastAPI, and Crawl4AI

## Technologies Used

### Frontend
- HTML5
- Tailwind CSS
- JavaScript
- Chart.js for data visualization

### Backend
- Python 3.x
- FastAPI
- Crawl4AI
- Playwright for browser automation
- Various AI/ML libraries for content extraction

## Setup and Running

The application uses PM2 to manage both services:

```bash
# Start both services
npx pm2 start ecosystem.config.cjs

# Stop both services
npx pm2 stop all

# Restart both services
npx pm2 restart all

# View logs
npx pm2 logs
```

## API Endpoints

### Backend Endpoints
- `GET /health` - Health check endpoint
- `POST /crawl` - Crawl a website
- `POST /batch-crawl` - Crawl multiple websites
- `POST /analyze-structure` - Analyze website structure
- `POST /test-pagination` - Test pagination detection

### Frontend Endpoints
- `GET /` - Main UI interface

## Directory Structure

```
├── dist/                 # Built frontend files
├── DOCS/                 # Documentation files
├── logs/                 # PM2 log files
├── public/               # Static files for frontend
├── src/                  # Frontend source files
├── tests/                # Test files
├── venv/                 # Python virtual environment
├── ecosystem.config.cjs   # PM2 configuration
├── requirements.txt       # Python dependencies
├── package.json         # Node.js dependencies
└── ...
```

## Usage

1. Start the services using PM2:
   ```bash
   npx pm2 start ecosystem.config.cjs
   ```

2. Access the frontend UI at http://localhost:3000

3. The backend API is available at http://localhost:8000

4. Use the comprehensive UI to configure and run web crawling tasks

## Testing

Run the test script to verify the services are working:
```bash
node tests/test-crawl4ai.js
```