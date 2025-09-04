#!/bin/bash
#
# Crawl4AI Full-Stack Application Startup Script
# Easily start the complete Crawl4AI application with one command

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if we're in the right directory
if [ ! -f "crawl4ai-service.py" ]; then
    print_error "Please run this script from the project root directory"
    exit 1
fi

# Check if venv exists
if [ ! -d "venv" ]; then
    print_warning "Virtual environment not found. Creating one..."
    python3 -m venv venv
    source venv/bin/activate
    pip install crawl4ai fastapi uvicorn
    playwright install
else
    source venv/bin/activate
fi

# Check if node modules exist
if [ ! -d "node_modules" ]; then
    print_warning "Node modules not found. Installing dependencies..."
    npm install
fi

# Function to cleanup on exit
cleanup() {
    print_status "Shutting down services..."
    if [ ! -z "$BACKEND_PID" ]; then
        kill $BACKEND_PID 2>/dev/null || true
    fi
    if [ ! -z "$FRONTEND_PID" ]; then
        kill $FRONTEND_PID 2>/dev/null || true
    fi
    print_success "All services stopped."
    exit 0
}

# Trap SIGINT and SIGTERM for graceful shutdown
trap cleanup INT TERM

print_success "🚀 Starting Crawl4AI Full-Stack Application"

# Start backend service
print_status "Starting Crawl4AI backend service..."
python crawl4ai-service.py &
BACKEND_PID=$!
print_success "Backend service started (PID: $BACKEND_PID)"

# Wait a moment for backend to initialize
sleep 3

# Check if backend is running
if curl -s http://localhost:8000/health >/dev/null; then
    print_success "Backend service is healthy"
else
    print_error "Backend service failed to start properly"
    cleanup
    exit 1
fi

# Start frontend service
print_status "Starting web interface..."
npm run dev:local &
FRONTEND_PID=$!
print_success "Web interface started (PID: $FRONTEND_PID)"

# Wait for frontend to initialize
sleep 5

# Check if frontend is running
if curl -s http://localhost:3000/ | grep -q "Crawl4AI Comprehensive Demo"; then
    print_success "Web interface is ready"
else
    print_warning "Web interface may still be initializing..."
fi

print_success "🎉 Crawl4AI Full-Stack Application is now running!"
echo
print_status "🌐 Web Interface: http://localhost:3000"
print_status "🛠️  Backend API: http://localhost:8000"
print_status "📚 API Documentation: http://localhost:8000/docs"
print_status "❤️  Health Check: http://localhost:8000/health"
echo
print_status "Press Ctrl+C to stop all services"

# Wait indefinitely
wait