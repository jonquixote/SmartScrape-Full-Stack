#!/bin/bash

# SmartScrape Simplified UI - Startup Script

echo "🚀 Starting SmartScrape Simplified UI..."

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    echo "❌ Error: package.json not found. Please run this script from the project root directory."
    exit 1
fi

# Check if PM2 is installed
if ! command -v pm2 &> /dev/null; then
    echo "⚠️  PM2 not found. Installing PM2..."
    npm install -g pm2
fi

# Clean any existing processes on port 3000
echo "🧹 Cleaning existing processes on port 3000..."
npx kill-port 3000 2>/dev/null || true

# Install dependencies if node_modules doesn't exist
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    npm install
fi

# Build the project
echo "🔨 Building the project..."
npm run build

# Start the application with PM2
echo "▶️  Starting application with PM2..."
pm2 start ecosystem.config.cjs

# Wait a moment for the server to start
sleep 3

# Check if the server is running
if curl -s http://localhost:3000 >/dev/null; then
    echo "✅ SmartScrape Simplified UI is now running!"
    echo "🌐 Visit http://localhost:3000 in your browser"
    echo "📊 API Health Check: http://localhost:3000/api/health"
else
    echo "❌ Error: Failed to start the server. Check the logs for details."
    pm2 logs webapp
fi

echo "💡 To stop the application, run: pm2 stop webapp"
echo "💡 To view logs, run: pm2 logs webapp"
echo "💡 To restart the application, run: pm2 restart webapp"