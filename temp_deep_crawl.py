    async def deep_crawl_stream(self, request: CrawlRequest):
        """Stream deep crawling results as they are discovered"""
        crawled_urls = set()
        crawl_queue = [(str(request.url), 0)]  # (url, depth)
        results_count = 0
        site_structure = {"root": str(request.url)}
        sitemap_data = None
        
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
                    
                    # Extract links for deep crawling
                    content_links = []
                    
                    # Look for links in main content areas
                    main_content_selectors = [
                        'main', '.main', '#main',
                        'article', '.article', '#article',
                        '.content', '#content',
                        '.product_pod',  # Specific to books.toscrape.com
                        '.book',  # General book class
                        '[class*="product"]',  # Product-related classes
                        '[class*="book"]'  # Book-related classes
                    ]
                    
                    for selector in main_content_selectors:
                        content_areas = soup.select(selector)
                        for area in content_areas:
                            links = area.find_all('a', href=True)
                            for link in links:
                                href = link['href']
                                absolute_url = urljoin(url, href)
                                if absolute_url.startswith('http') and absolute_url not in content_links:
                                    content_links.append(absolute_url)
                    
                    # If no content links found, fall back to general links but filter out navigation
                    if not content_links:
                        all_links = soup.find_all('a', href=True)
                        # Filter out navigation/footer links
                        navigation_selectors = [
                            'nav', 'footer', '.nav', '.navigation', '.menu',
                            '.sidebar', '.footer', '[role="navigation"]'
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
                    
                    # Add content links to crawl queue
                    extracted_count = 0
                    for absolute_url in content_links:
                        if extracted_count >= 20:  # Increase limit to 20 links per page
                            break
                        # Only crawl URLs from the same domain
                        try:
                            base_domain = urlparse(str(request.url)).netloc
                            link_domain = urlparse(absolute_url).netloc
                            if link_domain == base_domain and absolute_url not in crawled_urls and len(crawled_urls) < request.max_urls:
                                crawl_queue.append((absolute_url, depth + 1))
                                extracted_count += 1
                        except:
                            # If domain parsing fails, still add the URL if it's not been crawled
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