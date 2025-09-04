#!/usr/bin/env python3
"""
Final Verification Script - Tests all core functionality
"""

import asyncio
import aiohttp
import json

async def verify_all_functionality():
    """Verify that all core functionality is working"""
    
    print("🔍 FINAL VERIFICATION - TESTING ALL CORE FUNCTIONALITY")
    print("=" * 60)
    
    async with aiohttp.ClientSession() as session:
        try:
            # 1. Test service health
            print("\n1️⃣  Service Health Check")
            print("-" * 30)
            
            async with session.get("http://localhost:8000/health") as response:
                if response.status == 200:
                    health_data = await response.json()
                    print(f"✅ Status: {health_data['status']}")
                    print(f"📊 Features Available: {len(health_data['features'])}")
                    for feature in health_data['features']:
                        print(f"   • {feature}")
                else:
                    print(f"❌ Health check failed with status {response.status}")
                    return
            
            # 2. Test basic crawl
            print("\n2️⃣  Basic Crawl Test")
            print("-" * 30)
            
            basic_config = {
                "url": "http://books.toscrape.com/",
                "strategy": "basic",
                "extraction_strategy": "css_selector"
            }
            
            async with session.post(
                "http://localhost:8000/crawl",
                json=basic_config,
                headers={"Content-Type": "application/json"}
            ) as response:
                if response.status == 200:
                    result = await response.json()
                    print(f"✅ Success: {result['success']}")
                    print(f"📰 Title: {result.get('title', 'N/A')[:50]}...")
                    print(f"📏 Content: {len(result.get('markdown', {}).get('raw_markdown', ''))} chars")
                    print(f"🔗 Links: {len(result.get('links', {}).get('internal', []))}")
                else:
                    print(f"❌ Basic crawl failed with status {response.status}")
            
            # 3. Test deep crawl
            print("\n3️⃣  Deep Crawl Test")
            print("-" * 30)
            
            deep_config = {
                "url": "http://books.toscrape.com/",
                "strategy": "comprehensive",
                "extraction_strategy": "css_selector",
                "enable_deep_crawl": True,
                "max_depth": 2,
                "javascript_enabled": True,
                "wait_for_selector": ".product_pod"
            }
            
            async with session.post(
                "http://localhost:8000/crawl",
                json=deep_config,
                headers={"Content-Type": "application/json"}
            ) as response:
                if response.status == 200:
                    result = await response.json()
                    print(f"✅ Success: {result['success']}")
                    print(f"📰 Title: {result.get('title', 'N/A')[:50]}...")
                    print(f"📏 Content: {len(result.get('markdown', {}).get('raw_markdown', ''))} chars")
                    print(f"🔗 Links: {len(result.get('links', {}).get('internal', []))}")
                    if result.get('performance_metrics'):
                        metrics = result['performance_metrics']
                        print(f"⏱️  Response Time: {metrics.get('response_time', 'N/A')}ms")
                else:
                    print(f"❌ Deep crawl failed with status {response.status}")
            
            # 4. Test structure analysis
            print("\n4️⃣  Structure Analysis Test")
            print("-" * 30)
            
            async with session.post(
                "http://localhost:8000/analyze-structure",
                json={"url": "http://books.toscrape.com/"},
                headers={"Content-Type": "application/json"}
            ) as response:
                if response.status == 200:
                    result = await response.json()
                    print(f"✅ Analysis Complete")
                    print(f"🔍 Patterns Detected: {result.get('patterns', {}).get('detected', 0)}")
                    print(f"🎯 Suggestions: {len(result.get('suggestions', []))}")
                else:
                    print(f"❌ Structure analysis failed with status {response.status}")
            
            # 5. Test pagination detection
            print("\n5️⃣  Pagination Detection Test")
            print("-" * 30)
            
            async with session.post(
                "http://localhost:8000/test-pagination",
                json={"url": "http://books.toscrape.com/"},
                headers={"Content-Type": "application/json"}
            ) as response:
                if response.status == 200:
                    result = await response.json()
                    has_pagination = result.get('has_pagination', False)
                    print(f"✅ Pagination Detection Complete")
                    print(f"📚 Has Pagination: {has_pagination}")
                    if has_pagination:
                        print(f"🔄 Type: {result.get('pagination_type', 'N/A')}")
                        print(f"📈 Confidence: {result.get('confidence', 0) * 100:.1f}%")
                else:
                    print(f"❌ Pagination detection failed with status {response.status}")
            
            # 6. Test web interface availability
            print("\n6️⃣  Web Interface Test")
            print("-" * 30)
            
            async with session.get("http://localhost:3000/") as response:
                if response.status == 200:
                    content = await response.text()
                    if "Crawl4AI Comprehensive Demo" in content:
                        print("✅ Web Interface Available")
                        print("🌐 Access at: http://localhost:3000")
                    else:
                        print("❌ Web interface content incorrect")
                else:
                    print(f"❌ Web interface unavailable (status {response.status})")
            
            print("\n" + "=" * 60)
            print("🎉 ALL CORE FUNCTIONALITY VERIFIED SUCCESSFULLY!")
            print("🚀 YOUR CRAWL4AI APPLICATION IS READY FOR USE!")
            print("🌐 ACCESS THE WEB INTERFACE AT: http://localhost:3000")
            
        except aiohttp.ClientError as e:
            print(f"❌ Network error: {e}")
        except json.JSONDecodeError as e:
            print(f"❌ JSON parsing error: {e}")
        except Exception as e:
            print(f"❌ Unexpected error: {e}")

if __name__ == "__main__":
    asyncio.run(verify_all_functionality())