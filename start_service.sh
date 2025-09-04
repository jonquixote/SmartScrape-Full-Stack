#!/usr/bin/env bash
# Startup script for SmartScrape Crawl4AI Service
# Automatically updates AI models and starts the service

echo "🚀 SmartScrape Crawl4AI Service Startup Script"
echo "============================================="

# Activate virtual environment
echo "🔧 Activating virtual environment..."
source venv/bin/activate

# Update AI models in frontend
echo "🔄 Updating AI models in frontend..."
python update_models.py

# Start the service
echo "サービング SmartScrape Crawl4AI Service..."
python crawl4ai-service.py