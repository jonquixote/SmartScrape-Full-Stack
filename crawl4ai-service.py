#!/usr/bin/env python3
"""
Crawl4AI Backend Service
A Python service that provides advanced crawling capabilities using Crawl4AI
"""

import asyncio
import json
import time
from typing import Dict, List, Optional, Any
from dataclasses import dataclass, asdict
from datetime import datetime

try:
    from fastapi import FastAPI, HTTPException, BackgroundTasks
    from fastapi.middleware.cors import CORSMiddleware
    from pydantic import BaseModel, HttpUrl
    import uvicorn
    from crawl4ai import AsyncWebCrawler
    from crawl4ai.extraction_strategy import LLMExtractionStrategy, CosineStrategy
    from crawl4ai.chunking_strategy import RegexChunking, NlpSentenceChunking
except ImportError as e:
    print(f"Missing dependencies. Please install: pip install fastapi uvicorn crawl4ai")
    print(f"Error: {e}")
    exit(1)

app = FastAPI(
    title="SmartScrape Crawl4AI Service",
    description="Advanced web crawling service powered by Crawl4AI",
    version="1.0.0"
)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Global crawler instance
crawler_instance = None

@dataclass
class CrawlRequest:
    url: str
    strategy: str = "basic"
    extraction_strategy: str = "css_selector"
    extraction_schema: Optional[Dict] = None
    enable_pagination: bool = False
    pagination_strategy: str = "auto"
    javascript_enabled: bool = True
    wait_for_selector: Optional[str] = None
    screenshot: bool = False
    user_agent: Optional[str] = None
    proxy: Optional[str] = None
    session_id: Optional[str] = None
    chunking_strategy: str = "semantic"
    max_length: int = 8192
    overlap: int = 100

class CrawlRequestModel(BaseModel):
    url: HttpUrl
    strategy: str = "basic"
    extraction_strategy: str = "css_selector" 
    extraction_schema: Optional[Dict] = None
    enable_pagination: bool = False
    pagination_strategy: str = "auto"
    javascript_enabled: bool = True
    wait_for_selector: Optional[str] = None
    screenshot: bool = False
    user_agent: Optional[str] = None
    proxy: Optional[str] = None
    session_id: Optional[str] = None
    chunking_strategy: str = "semantic"
    max_length: int = 8192
    overlap: int = 100

class BatchCrawlRequest(BaseModel):
    requests: List[CrawlRequestModel]

@dataclass
class CrawlResponse:
    success: bool
    url: str
    title: Optional[str] = None
    markdown: Optional[str] = None
    html: Optional[str] = None
    extracted_content: Optional[Dict] = None
    links: Optional[List[str]] = None
    media: Optional[List[str]] = None
    metadata: Optional[Dict] = None
    chunks: Optional[List[Dict]] = None
    pagination_info: Optional[Dict] = None
    performance_metrics: Optional[Dict] = None
    error: Optional[str] = None
    screenshot_url: Optional[str] = None

class AdvancedCrawlService:
    def __init__(self):
        self.active_sessions = {}
        
    async def get_crawler(self) -> AsyncWebCrawler:
        """Get or create crawler instance"""
        global crawler_instance
        if crawler_instance is None:
            crawler_instance = AsyncWebCrawler(
                verbose=True,
                browser_type="chromium",
                headless=True
            )
            await crawler_instance.__aenter__()
        return crawler_instance
    
    async def crawl_url(self, request: CrawlRequest) -> CrawlResponse:
        """Crawl a single URL with advanced options"""
        start_time = time.time()
        
        try:
            crawler = await self.get_crawler()
            
            # Prepare crawl options
            crawl_options = {
                "url": str(request.url),
                "user_agent": request.user_agent,
                "proxy": request.proxy,
                "wait_for": request.wait_for_selector,
                "screenshot": request.screenshot,
                "bypass_cache": True
            }
            
            # Add extraction strategy
            if request.extraction_strategy == "llm_based" and request.extraction_schema:
                instruction = request.extraction_schema.get("instruction", "Extract key information")
                schema = request.extraction_schema.get("schema", {})
                
                extraction_strategy = LLMExtractionStrategy(
                    provider="openai",
                    api_token=request.extraction_schema.get("api_key"),
                    instruction=instruction,
                    schema=schema
                )
                crawl_options["extraction_strategy"] = extraction_strategy
            
            elif request.extraction_strategy == "cosine":
                crawl_options["extraction_strategy"] = CosineStrategy(
                    semantic_filter=request.extraction_schema.get("semantic_filter", "main content")
                )
            
            # Add chunking strategy
            if request.chunking_strategy == "semantic":
                crawl_options["chunking_strategy"] = NlpSentenceChunking(
                    max_length=request.max_length,
                    overlap=request.overlap
                )
            elif request.chunking_strategy == "regex":
                crawl_options["chunking_strategy"] = RegexChunking(
                    patterns=[r'\n\n', r'\. '],
                    max_length=request.max_length,
                    overlap=request.overlap
                )
            
            # Perform crawl
            result = await crawler.arun(**crawl_options)
            
            if not result.success:
                return CrawlResponse(
                    success=False,
                    url=str(request.url),
                    error=f"Crawl failed: {result.error_message}"
                )
            
            # Process pagination if enabled
            pagination_info = None
            if request.enable_pagination:
                pagination_info = await self.detect_pagination(result.html, str(request.url))
            
            # Extract performance metrics
            end_time = time.time()
            performance_metrics = {
                "response_time": round((end_time - start_time) * 1000),
                "content_size": len(result.html) if result.html else 0,
                "markdown_size": len(result.markdown) if result.markdown else 0,
                "links_count": len(result.links) if result.links else 0,
                "media_count": len(result.media) if result.media else 0
            }
            
            # Process chunks if available
            chunks = None
            if hasattr(result, 'chunks') and result.chunks:
                chunks = [
                    {
                        "content": chunk.text,
                        "metadata": chunk.metadata,
                        "index": i
                    }
                    for i, chunk in enumerate(result.chunks)
                ]
            
            return CrawlResponse(
                success=True,
                url=str(request.url),
                title=result.metadata.get("title") if result.metadata else None,
                markdown=result.markdown,
                html=result.html,
                extracted_content=result.extracted_content,
                links=result.links,
                media=result.media,
                metadata=result.metadata,
                chunks=chunks,
                pagination_info=pagination_info,
                performance_metrics=performance_metrics,
                screenshot_url=result.screenshot if request.screenshot else None
            )
            
        except Exception as e:
            return CrawlResponse(
                success=False,
                url=str(request.url),
                error=f"Crawl error: {str(e)}"
            )
    
    async def detect_pagination(self, html: str, base_url: str) -> Dict:
        """Detect pagination patterns in HTML"""
        try:
            from bs4 import BeautifulSoup
            soup = BeautifulSoup(html, 'html.parser')
            
            # Common pagination patterns
            patterns = [
                ('a[href*="page="]', 'url_parameter'),
                ('a.next, .pagination .next', 'next_link'),
                ('a[rel="next"]', 'rel_next'),
                ('.load-more, .more-results', 'infinite_scroll'),
                ('button[onclick*="page"]', 'javascript_button')
            ]
            
            for selector, method in patterns:
                elements = soup.select(selector)
                if elements:
                    next_url = None
                    if method in ['url_parameter', 'next_link', 'rel_next']:
                        href = elements[0].get('href')
                        if href:
                            from urllib.parse import urljoin
                            next_url = urljoin(base_url, href)
                    
                    return {
                        "has_pagination": True,
                        "pagination_type": method,
                        "next_page_url": next_url,
                        "elements_found": len(elements),
                        "confidence": 0.8 if next_url else 0.6
                    }
            
            return {
                "has_pagination": False,
                "pagination_type": "none",
                "confidence": 0.9
            }
            
        except Exception as e:
            return {
                "has_pagination": False,
                "error": str(e),
                "confidence": 0.0
            }

# Global service instance
crawl_service = AdvancedCrawlService()

@app.on_event("startup")
async def startup_event():
    """Initialize the crawl service"""
    print("🚀 Starting Crawl4AI Service...")
    print("📡 Service will be available at http://localhost:8000")

@app.on_event("shutdown") 
async def shutdown_event():
    """Cleanup on shutdown"""
    global crawler_instance
    if crawler_instance:
        await crawler_instance.__aexit__(None, None, None)
    print("🛑 Crawl4AI Service stopped")

@app.get("/")
async def root():
    """Root endpoint with service information"""
    return {
        "service": "SmartScrape Crawl4AI Service",
        "version": "1.0.0",
        "status": "running",
        "endpoints": {
            "health": "/health",
            "crawl": "/crawl",
            "batch_crawl": "/batch-crawl",
            "analyze_structure": "/analyze-structure",
            "test_pagination": "/test-pagination"
        },
        "timestamp": datetime.now().isoformat()
    }

@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "version": "1.0.0",
        "features": [
            "advanced_crawling",
            "llm_extraction", 
            "pagination_detection",
            "chunking_strategies",
            "screenshot_capture"
        ],
        "uptime": time.time(),
        "timestamp": datetime.now().isoformat()
    }

@app.post("/crawl")
async def crawl_endpoint(request: CrawlRequestModel):
    """Crawl a single URL"""
    crawl_req = CrawlRequest(**request.dict())
    result = await crawl_service.crawl_url(crawl_req)
    return asdict(result)

@app.post("/batch-crawl")
async def batch_crawl_endpoint(request: BatchCrawlRequest):
    """Crawl multiple URLs"""
    results = []
    
    for crawl_request in request.requests:
        crawl_req = CrawlRequest(**crawl_request.dict())
        result = await crawl_service.crawl_url(crawl_req)
        results.append(asdict(result))
        
        # Add small delay between requests
        await asyncio.sleep(0.5)
    
    return {
        "results": results,
        "total_crawled": len(results),
        "timestamp": datetime.now().isoformat()
    }

@app.post("/analyze-structure")
async def analyze_structure(request: dict):
    """Analyze page structure and suggest selectors"""
    try:
        url = request.get("url")
        if not url:
            raise HTTPException(status_code=400, detail="URL is required")
        
        crawler = await crawl_service.get_crawler()
        result = await crawler.arun(url=url)
        
        if not result.success:
            raise HTTPException(status_code=400, detail=f"Failed to crawl URL: {result.error_message}")
        
        # Analyze HTML structure
        from bs4 import BeautifulSoup
        soup = BeautifulSoup(result.html, 'html.parser')
        
        selectors = {
            "headings": [tag.name for tag in soup.find_all(['h1', 'h2', 'h3', 'h4', 'h5', 'h6'])],
            "links": [a.get('href') for a in soup.find_all('a', href=True)[:10]],
            "images": [img.get('src') for img in soup.find_all('img', src=True)[:10]],
            "forms": [form.get('action') for form in soup.find_all('form')],
            "tables": len(soup.find_all('table')),
            "lists": len(soup.find_all(['ul', 'ol']))
        }
        
        # Generate suggestions
        suggestions = []
        
        # Title suggestions
        if soup.find('h1'):
            suggestions.append({
                "name": "main_title",
                "selector": "h1",
                "description": "Main page title",
                "confidence": 0.9
            })
        
        # Content suggestions
        for selector in ['article', '.content', '#content', 'main']:
            if soup.select(selector):
                suggestions.append({
                    "name": "main_content", 
                    "selector": selector,
                    "description": "Main content area",
                    "confidence": 0.8
                })
                break
        
        return {
            "selectors": selectors,
            "patterns": {"detected": len(suggestions)},
            "suggestions": suggestions
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/test-pagination")
async def test_pagination(request: dict):
    """Test pagination detection on a URL"""
    try:
        url = request.get("url")
        if not url:
            raise HTTPException(status_code=400, detail="URL is required")
        
        crawler = await crawl_service.get_crawler()
        result = await crawler.arun(url=url)
        
        if not result.success:
            raise HTTPException(status_code=400, detail=f"Failed to crawl URL: {result.error_message}")
        
        pagination_info = await crawl_service.detect_pagination(result.html, url)
        
        return pagination_info
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    print("🔧 Starting SmartScrape Crawl4AI Service...")
    print("📡 The service will be available at: http://localhost:8000")
    print("📖 API documentation: http://localhost:8000/docs")
    print("❤️  Health check: http://localhost:8000/health")
    
    uvicorn.run(
        "crawl4ai-service:app", 
        host="0.0.0.0", 
        port=8000, 
        reload=True,
        log_level="info"
    )