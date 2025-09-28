#!/usr/bin/env python3
"""
Complete Crawl4AI Workflow Demonstration
This script demonstrates the entire workflow from setup to execution
"""

import os
import sys
import subprocess
import time
import asyncio
import aiohttp

async def check_service_health(session, url):
    """Check if a service is healthy"""
    try:
        async with session.get(f"{url}/health") as response:
            if response.status == 200:
                data = await response.json()
                return data.get('status') == 'healthy'
    except:
        pass
    return False

async def demonstrate_complete_workflow():
    """Demonstrate the complete Crawl4AI workflow"""
    
    print("🚀 Complete Crawl4AI Workflow Demonstration")
    print("=" * 60)
    
    # Check if we're in the right directory
    if not os.path.exists('crawl4ai-service.py'):
        print("❌ Please run this script from the project root directory")
        return
    
    # Activate virtual environment
    venv_activate = "source venv/bin/activate && "
    
    try:
        # 1. Start backend service
        print("\n1️⃣  Starting Crawl4AI Backend Service")
        print("-" * 40)
        
        backend_process = subprocess.Popen(
            f"{venv_activate}python crawl4ai-service.py",
            shell=True,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE
        )
        
        print("   🔧 Backend service started (PID: {})".format(backend_process.pid))
        
        # 2. Start frontend service
        print("\n2️⃣  Starting Frontend Development Server")
        print("-" * 40)
        
        frontend_process = subprocess.Popen(
            "npm run dev:local",
            shell=True,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE
        )
        
        print("   🖥️  Frontend server started (PID: {})".format(frontend_process.pid))
        
        # 3. Wait for services to be ready
        print("\n3️⃣  Waiting for Services to Initialize")
        print("-" * 40)
        
        async with aiohttp.ClientSession() as session:
            backend_ready = False
            frontend_ready = False
            max_wait = 30  # seconds
            wait_time = 0
            
            while wait_time < max_wait and not (backend_ready and frontend_ready):
                if not backend_ready:
                    backend_ready = await check_service_health(session, "http://localhost:8000")
                    if backend_ready:
                        print("   ✅ Backend service ready")
                
                if not frontend_ready:
                    try:
                        async with session.get("http://localhost:3000/") as response:
                            if response.status == 200:
                                frontend_ready = True
                                print("   ✅ Frontend service ready")
                    except:
                        pass
                
                if not (backend_ready and frontend_ready):
                    print(f"   ⏳ Waiting... ({wait_time}s elapsed)")
                    time.sleep(2)
                    wait_time += 2
            
            if backend_ready and frontend_ready:
                print("\n🎉 All services are ready!")
            else:
                print("\n⚠️  Some services may not be ready. Continuing anyway...")
        
        # 4. Demonstrate API usage
        print("\n4️⃣  Demonstrating API Usage")
        print("-" * 40)
        
        sample_config = {
            "url": "http://books.toscrape.com/",
            "strategy": "comprehensive",
            "extraction_strategy": "css_selector",
            "enable_pagination": True,
            "enable_deep_crawl": True,
            "max_depth": 2,
            "javascript_enabled": True,
            "wait_for_selector": ".product_pod"
        }
        
        async with aiohttp.ClientSession() as session:
            try:
                print("   📡 Sending sample crawl request...")
                async with session.post(
                    "http://localhost:8000/crawl",
                    json=sample_config,
                    headers={"Content-Type": "application/json"}
                ) as response:
                    if response.status == 200:
                        result = await response.json()
                        print("   ✅ Crawl request successful!")
                        print(f"   📊 Results: {result.get('success', False)}")
                        if result.get('success'):
                            print(f"   📰 Title: {result.get('title', 'N/A')}")
                            print(f"   🔗 Links found: {len(result.get('links', []))}")
                            print(f"   🖼️  Media found: {len(result.get('media', []))}")
                            if result.get('performance_metrics'):
                                metrics = result['performance_metrics']
                                print(f"   ⏱️  Response time: {metrics.get('response_time', 'N/A')}ms")
                    else:
                        print(f"   ❌ API request failed with status {response.status}")
            except Exception as e:
                print(f"   ❌ API demonstration failed: {e}")
        
        # 5. Provide access information
        print("\n5️⃣  Access Information")
        print("-" * 40)
        print("   🌐 Web Interface: http://localhost:3000")
        print("   🛠️  Backend API: http://localhost:8000")
        print("   📚 API Docs: http://localhost:8000/docs")
        print("   ❤️  Health Check: http://localhost:8000/health")
        
        # 6. Next steps
        print("\n6️⃣  Next Steps")
        print("-" * 40)
        print("   1. Open your browser to http://localhost:3000")
        print("   2. Explore the comprehensive UI features")
        print("   3. Try different crawling configurations")
        print("   4. Experiment with AI-based extraction")
        print("   5. Test pagination and deep crawl features")
        
        print("\n" + "=" * 60)
        print("🎊 Complete Workflow Demonstration Finished!")
        print("💡 Press Ctrl+C to stop services when done exploring")
        
        # Keep services running
        try:
            backend_process.wait()
            frontend_process.wait()
        except KeyboardInterrupt:
            print("\n\n🛑 Shutting down services...")
            backend_process.terminate()
            frontend_process.terminate()
            print("✅ All services stopped")
    
    except Exception as e:
        print(f"❌ Workflow demonstration failed: {e}")
        # Clean up processes if they were started
        try:
            backend_process.terminate()
            frontend_process.terminate()
        except:
            pass

if __name__ == "__main__":
    asyncio.run(demonstrate_complete_workflow())