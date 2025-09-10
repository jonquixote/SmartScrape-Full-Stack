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
    from crawl4ai import AsyncWebCrawler, LLMConfig, CrawlerRunConfig, CacheMode
    from crawl4ai.extraction_strategy import LLMExtractionStrategy, CosineStrategy
    # Use only the basic chunking strategies to avoid import issues
    from crawl4ai.chunking_strategy import RegexChunking
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
    enable_deep_crawl: bool = False
    max_depth: int = 3
    max_urls: int = 50
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
    enable_deep_crawl: bool = False
    max_depth: int = 3
    max_urls: int = 50
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
    
    def _safe_parse_extracted_content(self, content):
        """Safely parse extracted content and handle common errors"""
        try:
            # If it's already a dict, check for problematic attributes
            if isinstance(content, dict):
                # Handle the specific "'list' object has no attribute 'usage'" error
                # This happens when the content contains a 'usage' key that's a list
                # but code tries to access it as an object with attributes
                if 'usage' in content:
                    if isinstance(content['usage'], list):
                        # Convert list to a more usable format or remove it
                        content = content.copy()  # Don't modify original
                        content['usage'] = {
                            'details': content['usage'],
                            'type': 'list'
                        }
                    elif content['usage'] is None:
                        # Remove None usage values
                        content = content.copy()
                        del content['usage']
                return content
            elif isinstance(content, str):
                # Try to parse as JSON
                import json
                try:
                    parsed = json.loads(content)
                    return self._safe_parse_extracted_content(parsed)  # Recursively handle parsed content
                except json.JSONDecodeError:
                    # Return as-is if not valid JSON
                    return content
            elif isinstance(content, list):
                # Handle case where content is unexpectedly a list
                return {
                    'data': content,
                    'type': 'list',
                    'count': len(content)
                }
            else:
                # For other types, convert to string
                return str(content)
        except Exception as e:
            print(f"DEBUG: Error in _safe_parse_extracted_content: {str(e)}")
            # Return raw content if parsing fails
            return content
    
    async def crawl_url(self, request: CrawlRequest) -> CrawlResponse:
        """Crawl a single URL with advanced options and retry logic"""
        start_time = time.time()
        max_retries = 3
        retry_count = 0
        
        while retry_count <= max_retries:
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
                print(f"DEBUG: Checking extraction strategy - {request.extraction_strategy}")
                if request.extraction_schema:
                    print(f"DEBUG: Extraction schema present: {list(request.extraction_schema.keys())}")
                
                if request.extraction_strategy == "llm_based":
                    print("DEBUG: LLM extraction strategy matched")
                    # Handle LLM-based extraction with proper configuration
                    # Even if no schema is provided, we should still set up LLM extraction
                    extraction_schema = request.extraction_schema or {}
                    api_key = extraction_schema.get("api_key")
                    instruction = extraction_schema.get("instruction", "Extract key information from the page")
                    schema = extraction_schema.get("schema", {})
                    provider = extraction_schema.get("provider", "openai")
                    model = extraction_schema.get("model", "gpt-3.5-turbo")
                    delay = extraction_schema.get("delay", 1000)
                    
                    # Debug logging
                    print(f"DEBUG: Setting up LLM extraction")
                    print(f"  Provider: {provider}")
                    print(f"  Model: {model}")
                    print(f"  API Key present: {bool(api_key)}")
                    print(f"  Instruction: {instruction}")
                    print(f"  Schema: {schema}")
                    print(f"  Delay: {delay}ms")
                    
                    if api_key:
                        # Format provider correctly for crawl4ai
                        # Use a current Groq model instead of deprecated ones
                        provider_format = f"groq/llama-3.1-8b-instant" if provider == "groq" else f"{provider}/{model}"
                        if "/" not in provider:
                            provider_format = f"{provider}/{model}"
                        print(f"  Provider format: {provider_format}")
                        
                        # Use LLMConfig to avoid ForwardRef errors
                        llm_config = LLMConfig(
                            provider=provider_format,
                            api_token=api_key
                        )
                        
                        # Handle schema properly - if it's a dict, we might need to convert it
                        extraction_schema = schema if schema else {}
                        
                        # For schema-based extraction, we need to specify the extraction_type
                        extraction_type = "schema" if schema else "block"
                        
                        extraction_strategy = LLMExtractionStrategy(
                            llm_config=llm_config,
                            instruction=instruction,
                            schema=extraction_schema,
                            extraction_type=extraction_type
                        )
                        
                        # Create CrawlerRunConfig with the extraction strategy
                        run_config = CrawlerRunConfig(
                            word_count_threshold=1,  # Process all content
                            extraction_strategy=extraction_strategy,
                            cache_mode=CacheMode.BYPASS  # Don't use cache for fresh results
                        )
                        
                        # Add the run_config to crawl options instead of extraction_strategy directly
                        crawl_options["config"] = run_config
                        print(f"  LLM extraction strategy set up successfully with CrawlerRunConfig")
                    else:
                        print(f"  No API key provided, skipping LLM extraction")
                
                elif request.extraction_strategy == "cosine":
                    print("DEBUG: Cosine extraction strategy matched")
                    crawl_options["extraction_strategy"] = CosineStrategy(
                        semantic_filter=request.extraction_schema.get("semantic_filter", "main content")
                    )
                else:
                    print(f"DEBUG: Unknown extraction strategy: {request.extraction_strategy}")
                
                # Add chunking strategy
                if request.chunking_strategy == "regex":
                    crawl_options["chunking_strategy"] = RegexChunking(
                        patterns=[r'\n\n', r'\. '],
                        max_length=request.max_length,
                        overlap=request.overlap
                    )
                # For semantic chunking, we'll use a simpler approach or skip it for now
                elif request.chunking_strategy == "semantic":
                    # Use regex chunking as a fallback for semantic
                    crawl_options["chunking_strategy"] = RegexChunking(
                        patterns=[r'\n\n', r'\. '],
                        max_length=request.max_length,
                        overlap=request.overlap
                    )
                
                # Perform crawl
                result = await crawler.arun(**crawl_options)
                
                # Check if we need to retry based on the result
                if not result.success:
                    error_msg = result.error_message.lower() if result.error_message else ""
                    
                    # Check for rate limiting or retry messages
                    if any(keyword in error_msg for keyword in ["rate limit", "retry after", "too many requests", "429"]):
                        # Extract delay time from error message if possible
                        delay_seconds = 1  # Default delay
                        
                        # Look for patterns like "retry after X seconds" or "retry in Xs"
                        import re
                        retry_match = re.search(r'retry\s+(?:after|in)\s+(\d+)\s*(?:seconds?|s)', error_msg)
                        if retry_match:
                            delay_seconds = int(retry_match.group(1))
                        
                        print(f"DEBUG: Rate limit detected. Retrying after {delay_seconds} seconds...")
                        
                        # Wait before retrying
                        await asyncio.sleep(delay_seconds)
                        
                        retry_count += 1
                        if retry_count <= max_retries:
                            print(f"DEBUG: Retry attempt {retry_count}/{max_retries}")
                            continue  # Continue the retry loop
                        else:
                            return CrawlResponse(
                                success=False,
                                url=str(request.url),
                                error=f"Rate limited after {max_retries} retries: {result.error_message}"
                            )
                    else:
                        # For other errors, don't retry
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
                
                # Process extracted content if available
                extracted_content = None
                if hasattr(result, 'extracted_content') and result.extracted_content:
                    # Use our safe parsing method to handle potential errors
                    extracted_content = self._safe_parse_extracted_content(result.extracted_content)
                
                # Process chunks if available
                chunks = None
                if hasattr(result, 'chunks') and result.chunks:
                    try:
                        # Handle potential list vs object issues with chunks
                        if isinstance(result.chunks, list):
                            chunks = [
                                {
                                    "content": getattr(chunk, 'text', str(chunk)),
                                    "metadata": getattr(chunk, 'metadata', {}),
                                    "index": i
                                }
                                for i, chunk in enumerate(result.chunks)
                            ]
                        else:
                            # Handle case where chunks might not be a list
                            chunks = [{"content": str(result.chunks), "metadata": {}, "index": 0}]
                    except Exception as chunk_error:
                        print(f"DEBUG: Error processing chunks: {str(chunk_error)}")
                        chunks = None
                
                return CrawlResponse(
                    success=True,
                    url=str(request.url),
                    title=result.metadata.get("title") if result.metadata else None,
                    markdown=result.markdown,
                    html=result.html,
                    extracted_content=extracted_content,  # Use parsed content
                    links=result.links,
                    media=result.media,
                    metadata=result.metadata,
                    chunks=chunks,
                    pagination_info=pagination_info,
                    performance_metrics=performance_metrics,
                    screenshot_url=result.screenshot if request.screenshot else None
                )
                
            except Exception as e:
                print(f"DEBUG: Exception in crawl_url: {str(e)}")
                import traceback
                traceback.print_exc()
                
                # Check if exception message contains retry information
                error_str = str(e).lower()
                if any(keyword in error_str for keyword in ["rate limit", "retry after", "too many requests", "429"]):
                    # Extract delay time from error message if possible
                    delay_seconds = 1  # Default delay
                    
                    # Look for patterns like "retry after X seconds" or "retry in Xs"
                    import re
                    retry_match = re.search(r'retry\s+(?:after|in)\s+(\d+)\s*(?:seconds?|s)', error_str)
                    if retry_match:
                        delay_seconds = int(retry_match.group(1))
                    
                    print(f"DEBUG: Rate limit exception detected. Retrying after {delay_seconds} seconds...")
                    
                    # Wait before retrying
                    await asyncio.sleep(delay_seconds)
                    
                    retry_count += 1
                    if retry_count <= max_retries:
                        print(f"DEBUG: Retry attempt {retry_count}/{max_retries} due to exception")
                        continue  # Continue the retry loop
                    else:
                        return CrawlResponse(
                            success=False,
                            url=str(request.url),
                            error=f"Rate limited after {max_retries} retries due to exception: {str(e)}"
                        )
                else:
                    # For other exceptions, don't retry
                    return CrawlResponse(
                        success=False,
                        url=str(request.url),
                        error=f"Crawl error: {str(e)}"
                    )
        
        # This shouldn't be reached, but just in case
        return CrawlResponse(
            success=False,
            url=str(request.url),
            error="Maximum retry attempts exceeded"
        )
    
    async def discover_sitemap(self, base_url: str) -> Dict:
        """Discover URLs from sitemap.xml and return structured data"""
        try:
            from urllib.parse import urljoin
            sitemap_url = urljoin(base_url, '/sitemap.xml')
            
            crawler = await self.get_crawler()
            result = await crawler.arun(url=sitemap_url)
            
            if not result.success:
                return {"urls": [], "structure": {}}
            
            # Parse XML sitemap
            from bs4 import BeautifulSoup
            soup = BeautifulSoup(result.html, 'xml')
            urls = []
            structure = {}
            
            # Handle standard sitemap
            loc_tags = soup.find_all('loc')
            for loc in loc_tags:
                url = loc.get_text().strip()
                if url.startswith('http'):
                    urls.append(url)
                    # Try to categorize URLs by path
                    try:
                        from urllib.parse import urlparse
                        parsed = urlparse(url)
                        path_parts = [p for p in parsed.path.split('/') if p]
                        if path_parts:
                            category = path_parts[0] if len(path_parts) > 0 else "root"
                            if category not in structure:
                                structure[category] = []
                            structure[category].append(url)
                    except:
                        pass
            
            return {"urls": urls[:100], "structure": structure}  # Limit to 100 URLs to prevent overload
        except Exception as e:
            print(f"Error discovering sitemap for {base_url}: {e}")
            return {"urls": [], "structure": {}}

    async def deep_crawl_stream(self, request: CrawlRequest):
        """Stream deep crawling results as they are discovered"""
        crawled_urls = set()
        crawl_queue = [(str(request.url), 0)]  # (url, depth)
        results_count = 0
        site_structure = {"root": str(request.url)}
        sitemap_data = None
        last_ai_request_time = 0  # Track last AI request time for rate limiting
        
        # Discover sitemap URLs first if requested
        if request.enable_deep_crawl:
            sitemap_result = await self.discover_sitemap(str(request.url))
            sitemap_data = sitemap_result
            sitemap_urls = sitemap_result.get("urls", [])
            site_structure["sitemap"] = sitemap_result.get("structure", {})
            
            # Add sitemap URLs to crawl queue at depth 1
            for sitemap_url in sitemap_urls:
                if sitemap_url not in crawled_urls and len(crawled_urls) < request.max_urls:
                    crawl_queue.append((sitemap_url, 1))
        
        # Create a new crawler instance for deep crawl
        crawler = await self.get_crawler()
        
        # Keep track of pagination chains to avoid infinite loops
        pagination_chains = {}
        
        # Send initial progress update with site structure
        yield {
            "type": "site_map", 
            "data": {
                "base_url": str(request.url),
                "sitemap_available": sitemap_data is not None and len(sitemap_data.get("urls", [])) > 0,
                "sitemap_urls_count": len(sitemap_data.get("urls", [])) if sitemap_data else 0,
                "site_structure": site_structure
            }
        }
        
        # Send initial progress update
        yield {"type": "progress", "completed": 0, "total": len(crawl_queue), "crawled": len(crawled_urls)}
        
        while crawl_queue and len(crawled_urls) < request.max_urls:
            url, depth = crawl_queue.pop(0)
            
            # Check if we've already crawled this URL or exceeded depth
            if url in crawled_urls or depth > request.max_depth:
                continue
                
            crawled_urls.add(url)
            
            # Apply rate limiting for AI extraction
            if request.extraction_strategy == "llm_based" and request.extraction_schema:
                delay = request.extraction_schema.get("delay", 1000)  # Default 1 second
                if delay > 0:
                    import time
                    current_time = time.time()
                    time_since_last_request = (current_time - last_ai_request_time) * 1000  # Convert to milliseconds
                    if time_since_last_request < delay:
                        wait_time = (delay - time_since_last_request) / 1000.0  # Convert back to seconds
                        await asyncio.sleep(wait_time)
                    last_ai_request_time = time.time()
            
            # Create a crawl request for this URL
            crawl_req = CrawlRequest(
                url=url,
                strategy=request.strategy,
                extraction_strategy=request.extraction_strategy,
                extraction_schema=request.extraction_schema,
                enable_pagination=request.enable_pagination,
                pagination_strategy=request.pagination_strategy,
                javascript_enabled=request.javascript_enabled,
                wait_for_selector=request.wait_for_selector,
                screenshot=request.screenshot,
                user_agent=request.user_agent,
                proxy=request.proxy,
                session_id=request.session_id,
                chunking_strategy=request.chunking_strategy,
                max_length=request.max_length,
                overlap=request.overlap
            )
            
            # Crawl the URL
            result = await self.crawl_url(crawl_req)
            
            # Debug logging for AI extraction
            if request.extraction_strategy == "llm_based":
                print(f"DEBUG: AI Extraction for {url}")
                print(f"  Success: {result.success}")
                print(f"  Has extracted_content: {hasattr(result, 'extracted_content') and result.extracted_content is not None}")
                if hasattr(result, 'extracted_content') and result.extracted_content is not None:
                    print(f"  Extracted content type: {type(result.extracted_content)}")
                    if isinstance(result.extracted_content, str):
                        print(f"  Extracted content preview: {result.extracted_content[:200]}...")
                    else:
                        print(f"  Extracted content: {result.extracted_content}")
                # Also check the raw result object
                if hasattr(result, '__dict__'):
                    result_attrs = [attr for attr in dir(result) if not attr.startswith('_')]
                    print(f"  Available attributes: {result_attrs}")
                    # Check for any AI-related attributes
                    ai_attrs = [attr for attr in result_attrs if 'extract' in attr.lower()]
                    if ai_attrs:
                        print(f"  AI-related attributes: {ai_attrs}")
                        for attr in ai_attrs:
                            value = getattr(result, attr, None)
                            if value is not None:
                                print(f"    {attr}: {type(value)} - {str(value)[:100]}...")
            elif hasattr(result, 'extracted_content') and result.extracted_content is not None:
                print(f"DEBUG: Non-AI Extraction for {url}")
                print(f"  Has extracted_content: True")
                print(f"  Extracted content type: {type(result.extracted_content)}")
                if isinstance(result.extracted_content, str):
                    print(f"  Extracted content preview: {result.extracted_content[:200]}...")
            
            # Ensure result is JSON serializable
            def make_serializable(obj):
                if isinstance(obj, dict):
                    return {k: make_serializable(v) for k, v in obj.items()}
                elif isinstance(obj, (list, tuple)):
                    return [make_serializable(item) for item in obj]
                elif hasattr(obj, '__dict__'):
                    # Handle objects with __dict__ attribute
                    return make_serializable(obj.__dict__)
                elif isinstance(obj, (str, int, float, bool)) or obj is None:
                    return obj
                else:
                    # Convert everything else to string representation
                    return str(obj)
            
            result_dict = asdict(result)
            result_dict['depth'] = depth  # Add depth information to result
            result_dict['source'] = 'direct' if depth == 0 else ('sitemap' if depth == 1 else 'deep_crawl')
            
            # Debug: Print extracted content if available
            if result_dict.get('extracted_content'):
                print(f"DEBUG: Sending extracted content for {url[:50]}...")
            
            result_dict = make_serializable(result_dict)
            results_count += 1
            
            # Send result as it's discovered
            yield {"type": "result", "data": result_dict}
            
            # Send progress update
            yield {"type": "progress", "completed": results_count, "total": len(crawl_queue) + results_count, "crawled": len(crawled_urls)}
            
            # Handle pagination separately if enabled
            if request.enable_pagination and result.success:
                try:
                    # Detect pagination for this page
                    pagination_info = await self.detect_pagination(result.html, url)
                    
                    if pagination_info and pagination_info.get('has_pagination') and pagination_info.get('next_page_url'):
                        next_url = pagination_info['next_page_url']
                        # Avoid infinite pagination loops by tracking chains
                        chain_key = f"pagination_chain_{url}"
                        if chain_key not in pagination_chains:
                            pagination_chains[chain_key] = set()
                        if next_url not in pagination_chains[chain_key] and next_url not in crawled_urls and len(crawled_urls) < request.max_urls:
                            pagination_chains[chain_key].add(next_url)
                            # Add pagination URL to queue with incremented depth
                            crawl_queue.append((next_url, depth + 1))
                except Exception as e:
                    print(f"Error handling pagination for {url}: {e}")
            
            # Handle deep crawling separately if enabled
            if request.enable_deep_crawl and depth < request.max_depth and result.success:
                try:
                    from bs4 import BeautifulSoup
                    from urllib.parse import urljoin, urlparse
                    soup = BeautifulSoup(result.html, 'html.parser')
                    
                    # Extract links for deep crawling - Generic approach for any site
                    content_links = []
                    
                    # Look for links in main content areas - Generic selectors
                    main_content_selectors = [
                        'main', '.main', '#main',
                        'article', '.article', '#article',
                        '.content', '#content',
                        '[class*="content"]', '[id*="content"]',
                        '[class*="main"]', '[id*="main"]',
                        '[class*="post"]', '[id*="post"]',
                        '[class*="article"]', '[id*="article"]'
                    ]
                    
                    # Extract links from content areas
                    for selector in main_content_selectors:
                        content_areas = soup.select(selector)
                        for area in content_areas:
                            links = area.find_all('a', href=True)
                            for link in links:
                                href = link['href']
                                absolute_url = urljoin(url, href)
                                if absolute_url.startswith('http') and absolute_url not in content_links:
                                    content_links.append(absolute_url)
                    
                    # If no content links found, fall back to general approach but filter out navigation
                    if not content_links:
                        all_links = soup.find_all('a', href=True)
                        # Filter out navigation/footer links - Generic selectors
                        navigation_selectors = [
                            'nav', 'footer', '.nav', '.navigation', '.menu',
                            '.sidebar', '.footer', '[role="navigation"]',
                            '[class*="nav"]', '[id*="nav"]',
                            '[class*="menu"]', '[id*="menu"]',
                            '[class*="sidebar"]', '[id*="sidebar"]',
                            '[class*="footer"]', '[id*="footer"]'
                        ]
                        
                        for link in all_links:
                            # Check if link is in navigation area
                            is_nav = False
                            parent = link.parent
                            for _ in range(3):  # Check up to 3 parent levels
                                if parent:
                                    for nav_selector in navigation_selectors:
                                        if parent.select(nav_selector):
                                            is_nav = True
                                            break
                                    parent = parent.parent
                                else:
                                    break
                            
                            if not is_nav:
                                href = link['href']
                                absolute_url = urljoin(url, href)
                                if absolute_url.startswith('http') and absolute_url not in content_links:
                                    content_links.append(absolute_url)
                    
                    # Add content links to crawl queue - Only same domain links
                    extracted_count = 0
                    try:
                        base_domain = urlparse(str(request.url)).netloc
                    except:
                        base_domain = None
                    
                    for absolute_url in content_links:
                        if extracted_count >= 20:  # Increase limit to 20 links per page
                            break
                        # Only crawl URLs from the same domain if we can determine it
                        if base_domain:
                            try:
                                link_domain = urlparse(absolute_url).netloc
                                if link_domain == base_domain and absolute_url not in crawled_urls and len(crawled_urls) < request.max_urls:
                                    crawl_queue.append((absolute_url, depth + 1))
                                    extracted_count += 1
                            except:
                                # If domain parsing fails, still add the URL if it's not been crawled
                                if absolute_url not in crawled_urls and len(crawled_urls) < request.max_urls:
                                    crawl_queue.append((absolute_url, depth + 1))
                                    extracted_count += 1
                        else:
                            # If we can't determine the base domain, still add the URL
                            if absolute_url not in crawled_urls and len(crawled_urls) < request.max_urls:
                                crawl_queue.append((absolute_url, depth + 1))
                                extracted_count += 1
                except Exception as e:
                    print(f"Error extracting links from {url}: {e}")
        
        # Send final completion message with full site structure
        yield {
            "type": "finished", 
            "total": results_count,
            "site_structure": site_structure,
            "sitemap_data": sitemap_data
        }

    async def deep_crawl(self, request: CrawlRequest) -> List[CrawlResponse]:
        """Perform deep crawling with the specified depth and URL limits"""
        # For backward compatibility, collect all results and return them
        results = []
        async for event in self.deep_crawl_stream(request):
            if event["type"] == "result":
                results.append(event["data"])
        
        # Ensure all results are JSON serializable
        def make_serializable(obj):
            if isinstance(obj, dict):
                return {k: make_serializable(v) for k, v in obj.items()}
            elif isinstance(obj, (list, tuple)):
                return [make_serializable(item) for item in obj]
            elif hasattr(obj, '__dict__'):
                # Handle objects with __dict__ attribute
                return make_serializable(obj.__dict__)
            elif isinstance(obj, (str, int, float, bool)) or obj is None:
                return obj
            else:
                # Convert everything else to string representation
                return str(obj)
        
        return make_serializable(results)
    
    async def detect_pagination(self, html: str, base_url: str) -> Dict:
        """Detect pagination patterns in HTML"""
        try:
            from bs4 import BeautifulSoup
            from urllib.parse import urljoin
            soup = BeautifulSoup(html, 'html.parser')
            
            # Common pagination patterns
            patterns = [
                ('a[href*="page="]', 'url_parameter'),
                ('a.next, .pagination .next', 'next_link'),
                ('a[rel="next"]', 'rel_next'),
                ('.load-more, .more-results', 'infinite_scroll'),
                ('button[onclick*="page"]', 'javascript_button')
            ]
            
            # Try to find pagination elements
            for selector, method in patterns:
                elements = soup.select(selector)
                if elements:
                    next_url = None
                    if method in ['url_parameter', 'next_link', 'rel_next']:
                        href = elements[0].get('href')
                        if href:
                            next_url = urljoin(base_url, href)
                    
                    return {
                        "has_pagination": True,
                        "pagination_type": method,
                        "next_page_url": next_url,
                        "elements_found": len(elements),
                        "confidence": 0.8 if next_url else 0.6
                    }
            
            # Additional check for numbered pagination links
            # Look for links with numeric text that might be page numbers
            numbered_links = []
            for link in soup.find_all('a', href=True):
                text = link.get_text(strip=True)
                if text.isdigit() and int(text) > 1:
                    href = link.get('href')
                    if href:
                        absolute_url = urljoin(base_url, href)
                        numbered_links.append({
                            'url': absolute_url,
                            'page': int(text)
                        })
            
            # If we found numbered links, sort them and take the first one as next page
            if numbered_links:
                numbered_links.sort(key=lambda x: x['page'])
                next_page = next((link for link in numbered_links if link['page'] == 2), None)
                if next_page:
                    return {
                        "has_pagination": True,
                        "pagination_type": "numbered",
                        "next_page_url": next_page['url'],
                        "elements_found": len(numbered_links),
                        "confidence": 0.7
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

from fastapi.responses import StreamingResponse
import json
import asyncio

@app.post("/crawl")
async def crawl_endpoint(request: CrawlRequestModel):
    """Crawl a single URL"""
    crawl_req = CrawlRequest(**request.dict())
    
    # If deep crawling is enabled, perform deep crawl
    if crawl_req.enable_deep_crawl:
        results = await crawl_service.deep_crawl(crawl_req)
        return {
            "results": results,
            "total_crawled": len(results),
            "is_deep_crawl": True
        }
    else:
        # Single URL crawl
        result = await crawl_service.crawl_url(crawl_req)
        return asdict(result)

@app.post("/crawl-stream")
async def crawl_stream_endpoint(request: CrawlRequestModel):
    """Stream crawl results as they are discovered"""
    crawl_req = CrawlRequest(**request.dict())
    
    async def crawl_generator():
        try:
            # Send initial message
            yield f"data: {json.dumps({'type': 'started', 'message': 'Crawl started'})}\n\n"
            
            if crawl_req.enable_deep_crawl:
                # Use the new streaming deep crawl method
                async for event in crawl_service.deep_crawl_stream(crawl_req):
                    yield f"data: {json.dumps(event)}\n\n"
            else:
                # Single URL crawl
                result = await crawl_service.crawl_url(crawl_req)
                yield f"data: {json.dumps({'type': 'progress', 'completed': 1, 'total': 1})}\n\n"
                yield f"data: {json.dumps({'type': 'result', 'data': asdict(result)})}\n\n"
                yield f"data: {json.dumps({'type': 'finished', 'total': 1})}\n\n"
        except Exception as e:
            # Send error message to client
            yield f"data: {json.dumps({'type': 'error', 'message': str(e)})}\n\n"
            raise e
    
    # Add CORS headers for streaming response
    return StreamingResponse(
        crawl_generator(), 
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "Access-Control-Allow-Origin": "*",
            "Transfer-Encoding": "chunked",
        }
    )

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