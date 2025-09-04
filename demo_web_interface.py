#!/usr/bin/env python3
"""
Crawl4AI Web Interface Demo Script
Demonstrates how to interact with the Crawl4AI web interface programmatically
"""

import asyncio
import aiohttp
import json

async def demo_web_interface():
    """Demonstrate programmatic interaction with the Crawl4AI web interface"""
    
    base_url = "http://localhost:8000"
    
    # Sample crawl configuration showcasing all features
    crawl_config = {
        "url": "http://books.toscrape.com/",
        "strategy": "comprehensive",
        "extraction_strategy": "css_selector",
        "chunking_strategy": "semantic",
        "enable_pagination": True,
        "pagination_strategy": "auto",
        "enable_deep_crawl": True,
        "max_depth": 3,
        "max_urls": 50,
        "javascript_enabled": True,
        "wait_for_selector": ".product_pod",
        "screenshot": True,
        "user_agent": "Mozilla/5.0 (compatible; Crawl4AI Demo Bot/1.0)",
        "proxy": None,
        "session_id": "demo-session-001",
        "max_length": 8192,
        "overlap": 100
    }
    
    print("🚀 Crawl4AI Web Interface Demo")
    print("=" * 50)
    
    async with aiohttp.ClientSession() as session:
        try:
            # 1. Check service health
            print("\n1️⃣  Checking Service Health")
            print("-" * 30)
            
            async with session.get(f"{base_url}/health") as response:
                if response.status == 200:
                    health_data = await response.json()
                    print(f"✅ Service Status: {health_data['status']}")
                    print(f"📊 Available Features: {', '.join(health_data['features'])}")
                else:
                    print(f"❌ Health check failed with status {response.status}")
                    return
            
            # 2. Perform a comprehensive crawl
            print("\n2️⃣  Performing Comprehensive Crawl")
            print("-" * 30)
            
            print("📋 Crawl Configuration:")
            print(json.dumps(crawl_config, indent=2))
            
            async with session.post(
                f"{base_url}/crawl",
                json=crawl_config,
                headers={"Content-Type": "application/json"}
            ) as response:
                if response.status == 200:
                    crawl_data = await response.json()
                    print(f"\n✅ Crawl Success: {crawl_data['success']}")
                    
                    if crawl_data['success']:
                        print(f"📄 Title: {crawl_data.get('title', 'N/A')}")
                        print(f"📏 Markdown Length: {len(crawl_data.get('markdown', {}).get('raw_markdown', '')) if crawl_data.get('markdown') else 0} characters")
                        print(f"🔗 Links Found: {len(crawl_data.get('links', {}).get('internal', [])) if crawl_data.get('links') else 0}")
                        print(f"🖼️  Media Assets: {len(crawl_data.get('media', {}).get('images', [])) if crawl_data.get('media') else 0}")
                        
                        # Show performance metrics if available
                        if crawl_data.get('performance_metrics'):
                            metrics = crawl_data['performance_metrics']
                            print(f"⏱️  Response Time: {metrics.get('response_time', 'N/A')} ms")
                            print(f"💾 Content Size: {metrics.get('content_size', 'N/A')} bytes")
                    else:
                        print(f"❌ Crawl Error: {crawl_data.get('error', 'Unknown error')}")
                else:
                    error_text = await response.text()
                    print(f"❌ Crawl request failed with status {response.status}")
                    print(f"Error details: {error_text}")
            
            # 3. Test structure analysis
            print("\n3️⃣  Testing Structure Analysis")
            print("-" * 30)
            
            analysis_config = {
                "url": "http://books.toscrape.com/"
            }
            
            async with session.post(
                f"{base_url}/analyze-structure",
                json=analysis_config,
                headers={"Content-Type": "application/json"}
            ) as response:
                if response.status == 200:
                    analysis_data = await response.json()
                    print("✅ Structure Analysis Complete")
                    print(f"🔍 Detected Patterns: {analysis_data.get('patterns', {}).get('detected', 0)}")
                    print(f"🎯 Suggestions: {len(analysis_data.get('suggestions', []))}")
                else:
                    print(f"❌ Structure analysis failed with status {response.status}")
            
            # 4. Test pagination detection
            print("\n4️⃣  Testing Pagination Detection")
            print("-" * 30)
            
            pagination_config = {
                "url": "http://books.toscrape.com/"
            }
            
            async with session.post(
                f"{base_url}/test-pagination",
                json=pagination_config,
                headers={"Content-Type": "application/json"}
            ) as response:
                if response.status == 200:
                    pagination_data = await response.json()
                    print("✅ Pagination Detection Complete")
                    has_pagination = pagination_data.get('has_pagination', False)
                    print(f"📚 Has Pagination: {has_pagination}")
                    if has_pagination:
                        print(f"🔄 Pagination Type: {pagination_data.get('pagination_type', 'N/A')}")
                        print(f"📈 Confidence: {pagination_data.get('confidence', 0) * 100:.1f}%")
                else:
                    print(f"❌ Pagination detection failed with status {response.status}")
            
            print("\n" + "=" * 50)
            print("🎉 Crawl4AI Web Interface Demo Complete!")
            print("📘 Explore the web interface at http://localhost:3000")
            print("📝 Use the comprehensive UI to explore all features")
            
        except aiohttp.ClientError as e:
            print(f"❌ Network error: {e}")
        except json.JSONDecodeError as e:
            print(f"❌ JSON parsing error: {e}")
        except Exception as e:
            print(f"❌ Unexpected error: {e}")

if __name__ == "__main__":
    asyncio.run(demo_web_interface())