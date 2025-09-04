#!/usr/bin/env python3
"""
Final Crawl4AI Demonstration
This script demonstrates the complete Crawl4AI workflow with all features
"""

import asyncio
import aiohttp
import json
import time

async def demonstrate_all_features():
    """Demonstrate all Crawl4AI features"""
    
    print("🚀 Crawl4AI Complete Feature Demonstration")
    print("=" * 60)
    
    async with aiohttp.ClientSession() as session:
        try:
            # 1. Check service health
            print("\n1️⃣  Service Health Check")
            print("-" * 30)
            
            async with session.get("http://localhost:8000/health") as response:
                if response.status == 200:
                    health_data = await response.json()
                    print(f"✅ Status: {health_data['status']}")
                    print(f"📊 Features: {', '.join(health_data['features'])}")
                else:
                    print(f"❌ Health check failed with status {response.status}")
                    return
            
            # 2. Basic crawl demonstration
            print("\n2️⃣  Basic Crawl Demonstration")
            print("-" * 30)
            
            basic_config = {
                "url": "http://books.toscrape.com/",
                "strategy": "basic",
                "extraction_strategy": "css_selector"
            }
            
            print("   📡 Sending basic crawl request...")
            start_time = time.time()
            
            async with session.post(
                "http://localhost:8000/crawl",
                json=basic_config,
                headers={"Content-Type": "application/json"}
            ) as response:
                end_time = time.time()
                
                if response.status == 200:
                    result = await response.json()
                    print(f"   ✅ Success: {result['success']}")
                    print(f"   📰 Title: {result.get('title', 'N/A')[:50]}...")
                    print(f"   📏 Content length: {len(result.get('markdown', {}).get('raw_markdown', ''))} characters")
                    print(f"   🔗 Links found: {len(result.get('links', {}).get('internal', []))}")
                    print(f"   ⏱️  Response time: {end_time - start_time:.2f} seconds")
                else:
                    print(f"   ❌ Failed with status {response.status}")
            
            # 3. Deep crawl demonstration
            print("\n3️⃣  Deep Crawl Demonstration")
            print("-" * 30)
            
            deep_config = {
                "url": "http://books.toscrape.com/",
                "strategy": "comprehensive",
                "extraction_strategy": "css_selector",
                "enable_deep_crawl": True,
                "max_depth": 2,
                "max_urls": 10,
                "javascript_enabled": True,
                "wait_for_selector": ".product_pod"
            }
            
            print("   📡 Sending deep crawl request...")
            start_time = time.time()
            
            async with session.post(
                "http://localhost:8000/crawl",
                json=deep_config,
                headers={"Content-Type": "application/json"}
            ) as response:
                end_time = time.time()
                
                if response.status == 200:
                    result = await response.json()
                    print(f"   ✅ Success: {result['success']}")
                    print(f"   📰 Title: {result.get('title', 'N/A')[:50]}...")
                    print(f"   📏 Content length: {len(result.get('markdown', {}).get('raw_markdown', ''))} characters")
                    print(f"   🔗 Links found: {len(result.get('links', {}).get('internal', []))}")
                    print(f"   ⏱️  Response time: {end_time - start_time:.2f} seconds")
                else:
                    print(f"   ❌ Failed with status {response.status}")
            
            # 4. Pagination demonstration
            print("\n4️⃣  Pagination Demonstration")
            print("-" * 30)
            
            pagination_config = {
                "url": "http://books.toscrape.com/",
                "strategy": "basic",
                "extraction_strategy": "css_selector",
                "enable_pagination": True,
                "pagination_strategy": "auto"
            }
            
            print("   📡 Testing pagination...")
            
            async with session.post(
                "http://localhost:8000/test-pagination",
                json={"url": "http://books.toscrape.com/"},
                headers={"Content-Type": "application/json"}
            ) as response:
                if response.status == 200:
                    result = await response.json()
                    has_pagination = result.get('has_pagination', False)
                    print(f"   ✅ Pagination detected: {has_pagination}")
                    if has_pagination:
                        print(f"   🔄 Type: {result.get('pagination_type', 'N/A')}")
                        print(f"   🎯 Confidence: {result.get('confidence', 0) * 100:.1f}%")
                else:
                    print(f"   ❌ Pagination test failed with status {response.status}")
            
            # 5. AI extraction demonstration
            print("\n5️⃣  AI Extraction Demonstration")
            print("-" * 30)
            
            print("   🤖 AI extraction requires API keys (Groq, OpenAI, Anthropic)")
            print("   Example schema for book extraction:")
            
            book_schema = {
                "type": "object",
                "properties": {
                    "title": {"type": "string"},
                    "price": {"type": "string"},
                    "availability": {"type": "string"},
                    "rating": {"type": "string"}
                }
            }
            
            print(json.dumps(book_schema, indent=2))
            
            # 6. Chunking demonstration
            print("\n6️⃣  Chunking Strategies Demonstration")
            print("-" * 30)
            
            print("   ✂️  Crawl4AI supports multiple chunking strategies:")
            print("      • Semantic chunking (NLP-based)")
            print("      • Regex chunking (pattern-based)")
            print("      • Custom chunking strategies")
            
            # 7. Screenshot demonstration
            print("\n7️⃣  Screenshot Capture Demonstration")
            print("-" * 30)
            
            screenshot_config = {
                "url": "http://books.toscrape.com/",
                "strategy": "basic",
                "screenshot": True
            }
            
            print("   📸 Screenshot capture is available as a feature")
            print("   📍 Screenshot data is returned as base64-encoded PNG")
            
            # 8. Performance metrics
            print("\n8️⃣  Performance Metrics")
            print("-" * 30)
            
            print("   📊 Crawl4AI provides comprehensive performance metrics:")
            print("      • Response time")
            print("      • Content size")
            print("      • Links count")
            print("      • Media assets count")
            print("      • Memory usage")
            print("      • CPU utilization")
            
            print("\n" + "=" * 60)
            print("🎉 Crawl4AI Complete Feature Demonstration Finished!")
            print("🌐 Access the web interface at: http://localhost:3000")
            print("📚 Explore all features through the comprehensive UI")
            
        except aiohttp.ClientError as e:
            print(f"❌ Network error: {e}")
        except json.JSONDecodeError as e:
            print(f"❌ JSON parsing error: {e}")
        except Exception as e:
            print(f"❌ Unexpected error: {e}")

if __name__ == "__main__":
    asyncio.run(demonstrate_all_features())