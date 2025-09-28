#!/usr/bin/env python3
"""
Quick Start Guide - Helps users get started quickly with the Crawl4AI application
"""

def print_quick_start():
    """Print a quick start guide for the Crawl4AI application"""
    
    guide = """
====================================================================
           CRAWL4AI FULL-STACK APPLICATION - QUICK START GUIDE
====================================================================

👋 WELCOME TO CRAWL4AI!

This guide will help you get started quickly with your new 
Crawl4AI Full-Stack Application.

--------------------------------------------------------------------
🚀 QUICK START - 3 EASY STEPS
--------------------------------------------------------------------

STEP 1: VERIFY SERVICES ARE RUNNING
===================================
Check that both services are operational:

Backend Service:  http://localhost:8000  (should show "healthy")
Web Interface:    http://localhost:3000  (should show the web interface)

If services aren't running, start them with:
  ./start-fullstack.sh

STEP 2: EXPLORE THE WEB INTERFACE
=================================
Open your browser and visit: http://localhost:3000

Key areas to explore:
• Quick Feature Toggles (top section)
• Advanced Configuration (accordion panel)
• Progress Dashboard (real-time metrics)
• Results Section (extracted content)

STEP 3: TRY DIFFERENT FEATURES
==============================
Start with a simple crawl:
1. Enter URL: http://books.toscrape.com/
2. Click "Start Crawling"
3. Watch real-time progress in the dashboard
4. View results in the results section

Then try advanced features:
1. Enable "Deep Crawl" toggle
2. Enable "Pagination" toggle  
3. Expand "Advanced Configuration" accordion
4. Adjust crawling parameters
5. Start another crawl

--------------------------------------------------------------------
🎯 KEY FEATURES TO EXPLORE
--------------------------------------------------------------------

BASIC FEATURES:
• 🔍 Basic Crawling - Foundation web page crawling
• 📚 Deep Crawling - Multi-level crawling with depth control
• 📖 Pagination - Automatic detection and traversal
• 🤖 AI Extraction - LLM-powered content extraction
• ✂️  Chunking - Content segmentation strategies
• 📸 Screenshots - Visual documentation capture
• 🧠 JavaScript - Dynamic content execution

ADVANCED FEATURES:
• ⚙️  Proxy Support - IP rotation and anonymity
• 📊 Performance Metrics - Real-time monitoring
• 📤 Export Options - JSON/CSV data export
• 🎨 Modern UI - Intuitive feature toggles

--------------------------------------------------------------------
📋 COMMON USE CASES
--------------------------------------------------------------------

CASE 1: SIMPLE PAGE CRAWLING
============================
1. Enter a URL in the main input field
2. Click "Start Crawling"
3. View extracted content in results section

CASE 2: DEEP WEBSITE CRAWLING
=============================
1. Enter a website URL
2. Enable "Deep Crawl" toggle
3. Set max depth (1-10)
4. Click "Start Crawling"
5. Monitor progress in dashboard

CASE 3: AI-POWERED CONTENT EXTRACTION
======================================
1. Enter a URL
2. Enable "AI Extraction" toggle
3. Define custom extraction schema
4. Click "Start Crawling"
5. View AI-extracted structured data

--------------------------------------------------------------------
🔧 TROUBLESHOOTING TIPS
--------------------------------------------------------------------

ISSUE: Services Won't Start
SOLUTION: 
1. Check that Python 3.8+ and Node.js 16+ are installed
2. Verify virtual environment is activated
3. Run npm install to ensure dependencies are installed

ISSUE: Web Interface Not Loading
SOLUTION:
1. Check that both backend and frontend services are running
2. Verify ports 3000 (frontend) and 8000 (backend) are available
3. Try refreshing the browser or clearing cache

ISSUE: Crawling Fails
SOLUTION:
1. Verify the URL is accessible
2. Check internet connectivity
3. Ensure Playwright browsers are installed (playwright install)

--------------------------------------------------------------------
📚 LEARNING RESOURCES
--------------------------------------------------------------------

1. 📖 README.md - Complete project documentation
2. 🌐 Web Interface - Interactive feature exploration
3. 🛠️  API Documentation - http://localhost:8000/docs
4. 🧪 Demo Scripts - Various demonstration examples
5. 📁 Source Code - Well-commented implementation details

--------------------------------------------------------------------
🤝 GETTING HELP
--------------------------------------------------------------------

If you need assistance:

1. 🐛 Check GitHub Issues for known problems
2. 📧 Contact the development team
3. 🤝 Join the community discussion forums
4. 📚 Review the comprehensive documentation

--------------------------------------------------------------------
🎉 HAPPY CRAWLING!
--------------------------------------------------------------------

You now have a powerful, production-ready web crawling application
at your fingertips. Enjoy exploring the full capabilities of 
Crawl4AI through this intuitive interface!

Start your crawling journey at: http://localhost:3000 🕷️

====================================================================
"""
    
    print(guide)

if __name__ == "__main__":
    print_quick_start()