#!/bin/bash
# SmartScrape Control Script

case "$1" in
  start)
    echo "Starting SmartScrape services..."
    npx pm2 start ecosystem.config.cjs
    echo "Services started!"
    echo "Frontend available at: http://localhost:3000"
    echo "Backend API available at: http://localhost:8000"
    ;;
  stop)
    echo "Stopping SmartScrape services..."
    npx pm2 stop all
    echo "Services stopped!"
    ;;
  restart)
    echo "Restarting SmartScrape services..."
    npx pm2 restart all
    echo "Services restarted!"
    echo "Frontend available at: http://localhost:3000"
    echo "Backend API available at: http://localhost:8000"
    ;;
  status)
    echo "SmartScrape services status:"
    npx pm2 status
    ;;
  logs)
    echo "SmartScrape services logs:"
    npx pm2 logs
    ;;
  *)
    echo "Usage: $0 {start|stop|restart|status|logs}"
    exit 1
    ;;
esac