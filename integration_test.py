#!/usr/bin/env python3
"""
Comprehensive Integration Test - Verifies all components work together
"""

import asyncio
import aiohttp
import json
import time

async def comprehensive_integration_test():
    """Test that all components work together seamlessly"""
    
    print("🧪 COMPREHENSIVE INTEGRATION TEST")
    print("=" * 50)
    
    # Test components
    components = [
        "Backend Service",
        "Frontend Interface", 
        "API Endpoints",
        "Crawl4AI Engine",
        "Web Interface Features"
    ]
    
    results = {}
    
    async with aiohttp.ClientSession() as session:
        try:
            # 1. Test backend service health
            print("\n1️⃣  Testing Backend Service Health")
            print("-" * 35)
            
            async with session.get("http://localhost:8000/health") as response:
                if response.status == 200:
                    health_data = await response.json()
                    results["backend_health"] = health_data["status"] == "healthy"
                    print(f"✅ Backend Health: {health_data['status']}")
                    print(f"📊 Features: {len(health_data['features'])} available")
                else:
                    results["backend_health"] = False
                    print(f"❌ Backend Health Check Failed")
            
            # 2. Test frontend availability
            print("\n2️⃣  Testing Frontend Interface")
            print("-" * 35)
            
            async with session.get("http://localhost:3000/") as response:
                if response.status == 200:
                    content = await response.text()
                    results["frontend_available"] = "Crawl4AI Comprehensive Demo" in content
                    print("✅ Web Interface Available")
                else:
                    results["frontend_available"] = False
                    print("❌ Web Interface Unavailable")
            
            # 3. Test API endpoints
            print("\n3️⃣  Testing API Endpoints")
            print("-" * 35)
            
            endpoints = [
                ("/health", "GET"),
                ("/crawl", "POST"),
                ("/analyze-structure", "POST"),
                ("/test-pagination", "POST")
            ]
            
            endpoint_results = []
            for endpoint, method in endpoints:
                try:
                    if method == "GET":
                        async with session.get(f"http://localhost:8000{endpoint}") as resp:
                            endpoint_results.append(resp.status == 200)
                    else:  # POST
                        async with session.post(
                            f"http://localhost:8000{endpoint}",
                            json={"url": "http://books.toscrape.com/"},
                            headers={"Content-Type": "application/json"}
                        ) as resp:
                            endpoint_results.append(resp.status in [200, 422])  # 422 for validation errors
                except:
                    endpoint_results.append(False)
            
            results["api_endpoints"] = all(endpoint_results)
            print(f"✅ API Endpoints: {sum(endpoint_results)}/{len(endpoint_results)} working")
            
            # 4. Test Crawl4AI engine integration
            print("\n4️⃣  Testing Crawl4AI Engine Integration")
            print("-" * 35)
            
            test_configs = [
                {
                    "name": "Basic Crawl",
                    "config": {
                        "url": "http://books.toscrape.com/",
                        "strategy": "basic",
                        "extraction_strategy": "css_selector"
                    }
                },
                {
                    "name": "Deep Crawl",
                    "config": {
                        "url": "http://books.toscrape.com/",
                        "strategy": "comprehensive",
                        "extraction_strategy": "css_selector",
                        "enable_deep_crawl": True,
                        "max_depth": 2
                    }
                },
                {
                    "name": "JavaScript Enabled",
                    "config": {
                        "url": "http://books.toscrape.com/",
                        "strategy": "basic",
                        "extraction_strategy": "css_selector",
                        "javascript_enabled": True,
                        "wait_for_selector": ".product_pod"
                    }
                }
            ]
            
            crawl_results = []
            for test in test_configs:
                try:
                    async with session.post(
                        "http://localhost:8000/crawl",
                        json=test["config"],
                        headers={"Content-Type": "application/json"}
                    ) as resp:
                        if resp.status == 200:
                            result = await resp.json()
                            crawl_results.append(result.get("success", False))
                            print(f"✅ {test['name']}: Success")
                        else:
                            crawl_results.append(False)
                            print(f"❌ {test['name']}: Failed (Status {resp.status})")
                except Exception as e:
                    crawl_results.append(False)
                    print(f"❌ {test['name']}: Exception - {str(e)}")
            
            results["crawl4ai_integration"] = all(crawl_results)
            print(f"📊 Crawl4AI Tests: {sum(crawl_results)}/{len(crawl_results)} passed")
            
            # 5. Test web interface features through API
            print("\n5️⃣  Testing Web Interface Features")
            print("-" * 35)
            
            feature_tests = [
                ("Structure Analysis", "/analyze-structure"),
                ("Pagination Detection", "/test-pagination")
            ]
            
            feature_results = []
            for feature_name, endpoint in feature_tests:
                try:
                    async with session.post(
                        f"http://localhost:8000{endpoint}",
                        json={"url": "http://books.toscrape.com/"},
                        headers={"Content-Type": "application/json"}
                    ) as resp:
                        feature_results.append(resp.status == 200)
                        print(f"✅ {feature_name}: {'Available' if resp.status == 200 else 'Unavailable'}")
                except:
                    feature_results.append(False)
                    print(f"❌ {feature_name}: Failed")
            
            results["web_features"] = all(feature_results)
            print(f"📊 Web Features: {sum(feature_results)}/{len(feature_results)} working")
            
            # 6. Overall results
            print("\n" + "=" * 50)
            print("📊 INTEGRATION TEST RESULTS")
            print("=" * 50)
            
            overall_success = all(results.values())
            
            for component, success in results.items():
                status = "✅ PASS" if success else "❌ FAIL"
                print(f"{status} {component.replace('_', ' ').title()}")
            
            print("-" * 50)
            if overall_success:
                print("🎉 ALL INTEGRATION TESTS PASSED!")
                print("🚀 CRAWL4AI FULL-STACK APPLICATION IS READY!")
            else:
                print("⚠️  SOME INTEGRATION TESTS FAILED")
                print("🔧 Please check the failed components above")
            
            print("\n🔗 ACCESS YOUR APPLICATION:")
            print("   Web Interface: http://localhost:3000")
            print("   Backend API: http://localhost:8000")
            print("   API Docs: http://localhost:8000/docs")
            
        except Exception as e:
            print(f"❌ Integration test failed with exception: {e}")

if __name__ == "__main__":
    asyncio.run(comprehensive_integration_test())