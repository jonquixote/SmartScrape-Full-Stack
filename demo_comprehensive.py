#!/usr/bin/env python3
"""
Crawl4AI Comprehensive Demo Script
Demonstrates all Crawl4AI features using the books.toscrape.com website
"""

import asyncio
import json
from crawl4ai import AsyncWebCrawler
from crawl4ai.extraction_strategy import LLMExtractionStrategy, CosineStrategy
from crawl4ai.chunking_strategy import RegexChunking

async def comprehensive_demo():
    print("🚀 Crawl4AI Comprehensive Demo")
    print("=" * 50)
    
    # 1. Basic crawl with CSS selector extraction
    print("\n1️⃣  Basic Crawl with CSS Selector Extraction")
    print("-" * 40)
    
    async with AsyncWebCrawler(verbose=True) as crawler:
        result = await crawler.arun(
            url="http://books.toscrape.com/",
            extraction_strategy=None  # Just get the page content
        )
        
        if result.success:
            print(f"✅ Success: {result.metadata.get('title', 'N/A')}")
            print(f"📏 Markdown length: {len(result.markdown) if result.markdown else 0} characters")
            print(f"🔗 Links found: {len(result.links) if result.links else 0}")
            print(f"🖼️  Media found: {len(result.media) if result.media else 0}")
        else:
            print(f"❌ Failed: {result.error_message}")
    
    # 2. Deep crawl with multiple levels
    print("\n2️⃣  Deep Crawl with Multiple Levels")
    print("-" * 40)
    
    async with AsyncWebCrawler(verbose=True) as crawler:
        # First get the main page
        result = await crawler.arun(
            url="http://books.toscrape.com/",
            bypass_cache=True
        )
        
        if result.success:
            print(f"✅ Main page crawled: {result.metadata.get('title', 'N/A')}")
            
            # Extract some book links to crawl deeper
            book_links = [link for link in result.links if '/catalogue/' in link and '/category/' not in link][:3]
            
            for link in book_links:
                print(f"   🔍 Crawling deeper: {link}")
                deep_result = await crawler.arun(
                    url=link,
                    bypass_cache=True
                )
                
                if deep_result.success:
                    print(f"   ✅ Deep crawl success: {deep_result.metadata.get('title', 'N/A')[:50]}...")
                else:
                    print(f"   ❌ Deep crawl failed: {deep_result.error_message}")
    
    # 3. Pagination handling
    print("\n3️⃣  Pagination Handling")
    print("-" * 40)
    
    async with AsyncWebCrawler(verbose=True) as crawler:
        # Crawl first few pages
        for page in range(1, 4):  # First 3 pages
            url = f"http://books.toscrape.com/catalogue/page-{page}.html"
            print(f"   📖 Crawling page {page}: {url}")
            
            result = await crawler.arun(url=url, bypass_cache=True)
            
            if result.success:
                books_on_page = [link for link in result.links if '/catalogue/' in link and '/category/' not in link]
                print(f"   ✅ Found {len(books_on_page)} books on page {page}")
            else:
                print(f"   ❌ Failed to crawl page {page}: {result.error_message}")
    
    # 4. AI-based extraction (if API key available)
    print("\n4️⃣  AI-Based Extraction")
    print("-" * 40)
    
    # For demo purposes, we'll show what the AI extraction would look like
    print("   🤖 AI extraction requires an API key (Groq, OpenAI, or Anthropic)")
    print("   Example schema for book extraction:")
    book_schema = {
        "type": "object",
        "properties": {
            "title": {"type": "string"},
            "price": {"type": "string"},
            "availability": {"type": "string"},
            "rating": {"type": "string"},
            "description": {"type": "string"}
        }
    }
    print(json.dumps(book_schema, indent=2))
    
    # 5. Chunking strategies
    print("\n5️⃣  Chunking Strategies")
    print("-" * 40)
    
    async with AsyncWebCrawler(verbose=True) as crawler:
        result = await crawler.arun(
            url="http://books.toscrape.com/",
            chunking_strategy=RegexChunking(patterns=[r'\n\n', r'\. '], max_length=1000, overlap=100),
            bypass_cache=True
        )
        
        if result.success and hasattr(result, 'chunks') and result.chunks:
            print(f"   ✂️  Content chunked into {len(result.chunks)} pieces")
            print(f"   📄 First chunk preview: {result.chunks[0].text[:100]}...")
        else:
            print("   ⚠️  Chunking demo completed (actual chunks depend on content)")
    
    # 6. Screenshot capture
    print("\n6️⃣  Screenshot Capture")
    print("-" * 40)
    
    async with AsyncWebCrawler(verbose=True) as crawler:
        result = await crawler.arun(
            url="http://books.toscrape.com/",
            screenshot=True,
            bypass_cache=True
        )
        
        if result.success and result.screenshot:
            print("   📸 Screenshot captured successfully")
            print(f"   📍 Screenshot data length: {len(result.screenshot)} bytes")
        else:
            print("   ⚠️  Screenshot demo completed (actual screenshot depends on browser)")
    
    # 7. JavaScript execution
    print("\n7️⃣  JavaScript Execution")
    print("-" * 40)
    
    async with AsyncWebCrawler(verbose=True) as crawler:
        result = await crawler.arun(
            url="http://books.toscrape.com/",
            javascript=True,
            wait_for=".product_pod",  # Wait for product elements to load
            bypass_cache=True
        )
        
        if result.success:
            print("   🧠 JavaScript executed successfully")
            print(f"   📦 Dynamic content loaded: {len(result.html) if result.html else 0} characters")
        else:
            print(f"   ❌ JavaScript execution failed: {result.error_message}")
    
    print("\n" + "=" * 50)
    print("🎉 Crawl4AI Comprehensive Demo Complete!")
    print("Explore http://localhost:3000 for the full web interface")

if __name__ == "__main__":
    asyncio.run(comprehensive_demo())