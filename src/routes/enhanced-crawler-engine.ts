import { Bindings, CrawlSession, CrawlUrl } from '../types/database';
import * as cheerio from 'cheerio';
import TurndownService from 'turndown';

export interface CrawlResult {
  url: string;
  status: 'success' | 'failed' | 'blocked';
  html?: string;
  markdown?: string;
  title?: string;
  metadata?: Record<string, any>;
  links?: string[];
  media?: string[];
  text?: string;
  error?: string;
  responseTime?: number;
  extractedData?: any; // For custom extraction schemas
  paginationInfo?: PaginationInfo;
}

export interface PaginationInfo {
  hasNextPage: boolean;
  nextPageUrl?: string;
  currentPage?: number;
  totalPages?: number;
  paginationMethod?: 'css_selector' | 'auto_detect' | 'api';
}

export interface CrawlOptions {
  timeout?: number;
  userAgent?: string;
  followRedirects?: boolean;
  extractLinks?: boolean;
  extractMedia?: boolean;
  generateMarkdown?: boolean;
  smartCleaning?: boolean;
  removeAds?: boolean;
  removeNavigation?: boolean;
  extractionSchema?: ExtractionSchema;
  enablePagination?: boolean;
  paginationSelector?: string;
  maxPages?: number;
}

export interface ExtractionSchema {
  fields: Array<{
    name: string;
    selector: string;
    attribute?: string; // 'text', 'href', 'src', etc.
    multiple?: boolean; // Extract all matches vs first match
    required?: boolean;
  }>;
  listItems?: {
    container: string;
    fields: Array<{
      name: string;
      selector: string;
      attribute?: string;
    }>;
  };
}

export class EnhancedCrawlerEngine {
  private db: D1Database;
  private sessionId: number;
  private session: CrawlSession;
  private abortController: AbortController;
  private isRunning: boolean = false;
  private turndownService: TurndownService;
  
  // Enhanced CORS proxies with better reliability
  private static CORS_PROXIES = [
    'https://api.allorigins.win/raw?url=',
    'https://corsproxy.io/?',
    'https://api.codetabs.com/v1/proxy?quest=',
    'https://thingproxy.freeboard.io/fetch/',
    'https://cors-anywhere.herokuapp.com/',
    'https://yacdn.org/proxy/'
  ];

  // Diverse user agents for better stealth
  private static USER_AGENTS = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:127.0) Gecko/20100101 Firefox/127.0',
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.5.2 Safari/605.1.15',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Edge/126.0.0.0 Safari/537.36'
  ];

  // Common pagination patterns for auto-detection
  private static PAGINATION_PATTERNS = [
    { selector: 'a[href*="page="]:contains("Next")', type: 'next_link' },
    { selector: 'a[href*="page="]:contains(">")', type: 'next_link' },
    { selector: 'a.next, .pagination .next', type: 'next_link' },
    { selector: '.pagination a:last-child', type: 'next_link' },
    { selector: 'button[onclick*="page"]', type: 'button' },
    { selector: 'a[rel="next"]', type: 'next_link' },
    { selector: '.load-more, .more-results', type: 'load_more' }
  ];

  constructor(db: D1Database, sessionId: number, session: CrawlSession) {
    this.db = db;
    this.sessionId = sessionId;
    this.session = session;
    this.abortController = new AbortController();
    this.turndownService = new TurndownService({
      headingStyle: 'atx',
      codeBlockStyle: 'fenced'
    });
  }

  async startCrawling(): Promise<void> {
    if (this.isRunning) {
      throw new Error('Crawling session is already running');
    }

    try {
      this.isRunning = true;
      
      // Update session status to running
      await this.updateSessionStatus('running');
      
      // Get URLs to crawl
      const { results: urls } = await this.db.prepare(`
        SELECT * FROM crawl_urls 
        WHERE session_id = ? AND status = 'discovered'
        ORDER BY depth ASC, created_at ASC
      `).bind(this.sessionId).all() as { results: CrawlUrl[] };

      if (urls.length === 0) {
        await this.updateSessionStatus('completed');
        return;
      }

      // Process URLs with concurrency control
      const concurrency = Math.min(this.session.max_concurrent || 5, 10);
      await this.processUrlsConcurrently(urls, concurrency);
      
      // Mark session as completed
      await this.updateSessionStatus('completed');
    } catch (error) {
      console.error('Crawling error:', error);
      await this.updateSessionStatus('failed');
      throw error;
    } finally {
      this.isRunning = false;
    }
  }

  async stopCrawling(): Promise<void> {
    this.abortController.abort();
    this.isRunning = false;
    await this.updateSessionStatus('stopped');
  }

  private async processUrlsConcurrently(urls: CrawlUrl[], concurrency: number): Promise<void> {
    const queue = [...urls];
    const workers: Promise<void>[] = [];

    for (let i = 0; i < concurrency; i++) {
      workers.push(this.worker(queue));
    }

    await Promise.all(workers);
  }

  private async worker(queue: CrawlUrl[]): Promise<void> {
    while (queue.length > 0 && !this.abortController.signal.aborted) {
      const urlRecord = queue.shift();
      if (!urlRecord) continue;

      try {
        // Update URL status to processing
        await this.updateUrlStatus(urlRecord.id, 'processing');
        
        // Add crawl delay with jitter
        if (this.session.crawl_delay && this.session.crawl_delay > 0) {
          const delay = this.session.crawl_delay + (Math.random() * (this.session.delay_jitter || 0));
          await this.sleep(delay);
        }

        // Crawl the URL
        const result = await this.crawlUrl(urlRecord.url);
        
        if (result.status === 'success') {
          // Update URL with extracted content
          await this.updateUrlWithContent(urlRecord.id, result);
          await this.incrementSessionCounter('urls_completed');
          
          // Handle pagination if enabled
          if (this.session.enable_pagination && result.paginationInfo?.hasNextPage) {
            await this.handlePagination(urlRecord, result.paginationInfo);
          }
          
          // Extract and add new URLs if deep crawling is enabled
          if (this.session.enable_deep_crawl && result.links && result.links.length > 0) {
            await this.addDiscoveredUrls(result.links, urlRecord.depth + 1);
          }
        } else if (result.status === 'blocked') {
          await this.updateUrlStatus(urlRecord.id, 'blocked', result.error);
          await this.incrementSessionCounter('urls_blocked');
        } else {
          await this.updateUrlStatus(urlRecord.id, 'failed', result.error);
          await this.incrementSessionCounter('urls_failed');
        }
      } catch (error) {
        console.error(`Error processing URL ${urlRecord.url}:`, error);
        await this.updateUrlStatus(urlRecord.id, 'failed', error instanceof Error ? error.message : 'Unknown error');
        await this.incrementSessionCounter('urls_failed');
      }
    }
  }

  private async crawlUrl(url: string, options: CrawlOptions = {}): Promise<CrawlResult> {
    const startTime = Date.now();
    const userAgent = this.getRandomUserAgent();
    
    try {
      // Try direct fetch first
      let response = await this.fetchWithTimeout(url, {
        headers: {
          'User-Agent': userAgent,
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.5',
          'Accept-Encoding': 'gzip, deflate',
          'DNT': '1',
          'Connection': 'keep-alive',
          'Upgrade-Insecure-Requests': '1',
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache'
        },
        signal: this.abortController.signal
      });

      // If direct fetch fails, try CORS proxies
      if (!response.ok) {
        response = await this.fetchViaProxy(url, userAgent);
      }

      if (!response.ok) {
        return {
          url,
          status: response.status === 403 || response.status === 429 ? 'blocked' : 'failed',
          error: `HTTP ${response.status}: ${response.statusText}`,
          responseTime: Date.now() - startTime
        };
      }

      const html = await response.text();
      const responseTime = Date.now() - startTime;

      // Parse and extract content using Cheerio
      const result = await this.extractContentWithCheerio(url, html, options);
      
      return {
        ...result,
        status: 'success',
        responseTime
      };
    } catch (error) {
      return {
        url,
        status: 'failed',
        error: error instanceof Error ? error.message : 'Unknown error',
        responseTime: Date.now() - startTime
      };
    }
  }

  private async fetchWithTimeout(url: string, options: RequestInit, timeout: number = 30000): Promise<Response> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);
    
    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal
      });
      clearTimeout(timeoutId);
      return response;
    } catch (error) {
      clearTimeout(timeoutId);
      throw error;
    }
  }

  private async fetchViaProxy(url: string, userAgent: string): Promise<Response> {
    const errors: string[] = [];
    
    // Shuffle proxies for better distribution
    const shuffledProxies = [...EnhancedCrawlerEngine.CORS_PROXIES].sort(() => Math.random() - 0.5);
    
    for (const proxy of shuffledProxies) {
      try {
        const proxyUrl = proxy + encodeURIComponent(url);
        const response = await this.fetchWithTimeout(proxyUrl, {
          headers: {
            'User-Agent': userAgent
          },
          signal: this.abortController.signal
        }, 15000); // Shorter timeout for proxies
        
        if (response.ok) {
          return response;
        }
        errors.push(`${proxy}: HTTP ${response.status}`);
      } catch (error) {
        errors.push(`${proxy}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }
    
    throw new Error(`All proxies failed: ${errors.join(', ')}`);
  }

  private async extractContentWithCheerio(url: string, html: string, options: CrawlOptions = {}): Promise<Partial<CrawlResult>> {
    const result: Partial<CrawlResult> = { url, html };

    try {
      const $ = cheerio.load(html);
      
      // Extract title
      result.title = $('title').text().trim() || 
                    $('h1').first().text().trim() || 
                    $('meta[property="og:title"]').attr('content')?.trim();

      // Extract metadata
      const metadata: Record<string, any> = {};
      
      // Standard meta tags
      $('meta').each((_, elem) => {
        const $meta = $(elem);
        const name = $meta.attr('name') || $meta.attr('property') || $meta.attr('http-equiv');
        const content = $meta.attr('content');
        
        if (name && content) {
          metadata[name] = content;
        }
      });

      // JSON-LD structured data
      $('script[type="application/ld+json"]').each((_, elem) => {
        try {
          const jsonData = JSON.parse($(elem).html() || '');
          if (!metadata.structuredData) {
            metadata.structuredData = [];
          }
          metadata.structuredData.push(jsonData);
        } catch (e) {
          // Ignore invalid JSON-LD
        }
      });

      result.metadata = metadata;

      // Smart content cleaning - remove unwanted elements
      if (options.smartCleaning !== false && this.session.smart_cleaning !== false) {
        $('script, style, noscript, .ads, .advertisement, .social-share, .comments').remove();
      }

      if (options.removeAds !== false && this.session.remove_ads !== false) {
        $('[class*="ad"], [id*="ad"], [class*="banner"], [id*="banner"]').remove();
      }

      if (options.removeNavigation !== false && this.session.remove_navigation !== false) {
        $('nav, .navigation, .navbar, .menu, header, footer, .sidebar').remove();
      }

      // Extract links
      if (options.extractLinks || this.session.extract_links) {
        const links = new Set<string>();
        $('a[href]').each((_, elem) => {
          const href = $(elem).attr('href');
          if (href && !href.startsWith('#') && !href.startsWith('javascript:') && !href.startsWith('mailto:')) {
            try {
              const absoluteUrl = new URL(href, url).toString();
              if (absoluteUrl.startsWith('http://') || absoluteUrl.startsWith('https://')) {
                links.add(absoluteUrl);
              }
            } catch (e) {
              // Ignore invalid URLs
            }
          }
        });
        result.links = Array.from(links);
      }

      // Extract media
      if (options.extractMedia || this.session.extract_media) {
        const media = new Set<string>();
        $('img[src], video[src], source[src], picture source[srcset]').each((_, elem) => {
          const src = $(elem).attr('src') || $(elem).attr('srcset')?.split(' ')[0];
          if (src) {
            try {
              const absoluteUrl = new URL(src, url).toString();
              media.add(absoluteUrl);
            } catch (e) {
              // Ignore invalid URLs
            }
          }
        });
        result.media = Array.from(media);
      }

      // Extract main content with better algorithm
      const contentSelectors = [
        'main article',
        'article',
        '[role="main"]',
        '.main-content',
        '.content',
        '.post-content',
        '.entry-content',
        '#content',
        '#main'
      ];

      let $content = $();
      for (const selector of contentSelectors) {
        $content = $(selector);
        if ($content.length > 0) break;
      }

      // Fallback to body if no main content found
      if ($content.length === 0) {
        $content = $('body');
      }

      // Extract text content
      result.text = $content.text().replace(/\s+/g, ' ').trim().substring(0, 50000);

      // Generate markdown if requested
      if (options.generateMarkdown || this.session.generate_markdown) {
        result.markdown = this.turndownService.turndown($content.html() || '');
      }

      // Custom extraction schema
      if (options.extractionSchema && this.session.ai_extraction_schema) {
        try {
          const schema = JSON.parse(this.session.ai_extraction_schema);
          result.extractedData = this.applyExtractionSchema($, schema);
        } catch (e) {
          console.error('Error applying extraction schema:', e);
        }
      }

      // Detect pagination
      if (options.enablePagination || this.session.enable_pagination) {
        result.paginationInfo = this.detectPagination($, url);
      }

    } catch (error) {
      console.error('Content extraction error:', error);
      // Fallback to basic text extraction
      result.text = html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim().substring(0, 10000);
    }

    return result;
  }

  private applyExtractionSchema($: cheerio.CheerioAPI, schema: ExtractionSchema): any {
    const extractedData: any = {};

    // Extract individual fields
    if (schema.fields) {
      for (const field of schema.fields) {
        try {
          const elements = $(field.selector);
          
          if (field.multiple) {
            const values: any[] = [];
            elements.each((_, elem) => {
              const $elem = $(elem);
              const value = field.attribute === 'text' || !field.attribute 
                ? $elem.text().trim()
                : $elem.attr(field.attribute);
              
              if (value) values.push(value);
            });
            extractedData[field.name] = values;
          } else {
            const $elem = elements.first();
            const value = field.attribute === 'text' || !field.attribute 
              ? $elem.text().trim()
              : $elem.attr(field.attribute);
            
            if (value || !field.required) {
              extractedData[field.name] = value || null;
            }
          }
        } catch (e) {
          if (field.required) {
            console.error(`Failed to extract required field ${field.name}:`, e);
          }
        }
      }
    }

    // Extract list items
    if (schema.listItems) {
      const items: any[] = [];
      $(schema.listItems.container).each((_, container) => {
        const $container = $(container);
        const item: any = {};
        
        for (const field of schema.listItems.fields) {
          try {
            const $elem = $container.find(field.selector).first();
            const value = field.attribute === 'text' || !field.attribute 
              ? $elem.text().trim()
              : $elem.attr(field.attribute);
            
            item[field.name] = value || null;
          } catch (e) {
            item[field.name] = null;
          }
        }
        
        items.push(item);
      });
      extractedData.listItems = items;
    }

    return extractedData;
  }

  private detectPagination($: cheerio.CheerioAPI, baseUrl: string): PaginationInfo {
    const paginationInfo: PaginationInfo = { hasNextPage: false };

    // Use custom selector if provided
    if (this.session.pagination_selector) {
      try {
        const $next = $(this.session.pagination_selector);
        if ($next.length > 0) {
          const href = $next.attr('href');
          if (href) {
            paginationInfo.hasNextPage = true;
            paginationInfo.nextPageUrl = new URL(href, baseUrl).toString();
            paginationInfo.paginationMethod = 'css_selector';
            return paginationInfo;
          }
        }
      } catch (e) {
        console.error('Error with custom pagination selector:', e);
      }
    }

    // Auto-detect pagination patterns
    for (const pattern of EnhancedCrawlerEngine.PAGINATION_PATTERNS) {
      try {
        const $elem = $(pattern.selector);
        if ($elem.length > 0) {
          const href = $elem.attr('href') || $elem.data('href');
          if (href) {
            paginationInfo.hasNextPage = true;
            paginationInfo.nextPageUrl = new URL(href, baseUrl).toString();
            paginationInfo.paginationMethod = 'auto_detect';
            break;
          }
        }
      } catch (e) {
        // Continue to next pattern
      }
    }

    // Try to extract page numbers
    const pageMatch = baseUrl.match(/[?&]page=(\d+)/);
    if (pageMatch) {
      paginationInfo.currentPage = parseInt(pageMatch[1]);
    }

    return paginationInfo;
  }

  private async handlePagination(urlRecord: CrawlUrl, paginationInfo: PaginationInfo): Promise<void> {
    if (!paginationInfo.nextPageUrl) return;

    const currentPage = paginationInfo.currentPage || 1;
    const maxPages = this.session.max_pages || 10;

    if (currentPage >= maxPages) return;

    // Add delay between paginated requests
    if (this.session.page_delay) {
      await this.sleep(this.session.page_delay * 1000);
    }

    // Check if URL already exists
    const existing = await this.db.prepare(`
      SELECT id FROM crawl_urls WHERE session_id = ? AND url = ?
    `).bind(this.sessionId, paginationInfo.nextPageUrl).first();

    if (!existing) {
      await this.db.prepare(`
        INSERT INTO crawl_urls (session_id, url, depth, status, parent_url)
        VALUES (?, ?, ?, 'discovered', ?)
      `).bind(this.sessionId, paginationInfo.nextPageUrl, urlRecord.depth, urlRecord.url).run();

      await this.incrementSessionCounter('urls_discovered');
    }
  }

  // ... (rest of the methods remain the same as the original crawler engine)
  
  private getRandomUserAgent(): string {
    return EnhancedCrawlerEngine.USER_AGENTS[Math.floor(Math.random() * EnhancedCrawlerEngine.USER_AGENTS.length)];
  }

  private async updateSessionStatus(status: string): Promise<void> {
    await this.db.prepare(`
      UPDATE crawl_sessions 
      SET status = ?, updated_at = CURRENT_TIMESTAMP 
      WHERE id = ?
    `).bind(status, this.sessionId).run();
  }

  private async updateUrlStatus(urlId: number, status: string, error?: string): Promise<void> {
    await this.db.prepare(`
      UPDATE crawl_urls 
      SET status = ?, error_message = ?, updated_at = CURRENT_TIMESTAMP 
      WHERE id = ?
    `).bind(status, error || null, urlId).run();
  }

  private async updateUrlWithContent(urlId: number, result: CrawlResult): Promise<void> {
    await this.db.prepare(`
      UPDATE crawl_urls 
      SET 
        status = 'completed',
        title = ?, 
        content = ?, 
        markdown = ?, 
        metadata = ?, 
        links = ?, 
        media = ?,
        extracted_data = ?,
        response_time = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).bind(
      result.title || null,
      result.text || null,
      result.markdown || null,
      result.metadata ? JSON.stringify(result.metadata) : null,
      result.links ? JSON.stringify(result.links) : null,
      result.media ? JSON.stringify(result.media) : null,
      result.extractedData ? JSON.stringify(result.extractedData) : null,
      result.responseTime || null,
      urlId
    ).run();
  }

  private async incrementSessionCounter(counter: string): Promise<void> {
    await this.db.prepare(`
      UPDATE crawl_sessions 
      SET ${counter} = ${counter} + 1, updated_at = CURRENT_TIMESTAMP 
      WHERE id = ?
    `).bind(this.sessionId).run();
  }

  private async addDiscoveredUrls(urls: string[], depth: number): Promise<void> {
    if (depth > (this.session.max_depth || 3)) {
      return; // Don't go deeper than max depth
    }

    // Filter URLs based on domain strategy
    const filteredUrls = await this.filterUrlsByDomainStrategy(urls);
    
    // Check if URLs already exist in database
    const existingUrls = new Set();
    if (filteredUrls.length > 0) {
      const placeholders = filteredUrls.map(() => '?').join(',');
      const { results } = await this.db.prepare(`
        SELECT url FROM crawl_urls 
        WHERE session_id = ? AND url IN (${placeholders})
      `).bind(this.sessionId, ...filteredUrls).all();
      
      results.forEach((row: any) => existingUrls.add(row.url));
    }

    // Add new URLs
    const newUrls = filteredUrls.filter(url => !existingUrls.has(url));
    
    if (newUrls.length > 0) {
      const insertPromises = newUrls.map(url => 
        this.db.prepare(`
          INSERT INTO crawl_urls (session_id, url, depth, status)
          VALUES (?, ?, ?, 'discovered')
        `).bind(this.sessionId, url, depth).run()
      );
      
      await Promise.all(insertPromises);
      
      // Update session discovered count
      await this.db.prepare(`
        UPDATE crawl_sessions 
        SET urls_discovered = urls_discovered + ?, updated_at = CURRENT_TIMESTAMP 
        WHERE id = ?
      `).bind(newUrls.length, this.sessionId).run();
    }
  }

  private async filterUrlsByDomainStrategy(urls: string[]): Promise<string[]> {
    const strategy = this.session.domain_strategy || 'same-domain';
    
    if (strategy === 'any') {
      return urls;
    }

    // Get base domain from first discovered URL or session URLs
    const baseDomain = await this.getBaseDomain();
    if (!baseDomain) {
      return urls;
    }

    return urls.filter(url => {
      try {
        const urlObj = new URL(url);
        const urlDomain = urlObj.hostname;
        
        switch (strategy) {
          case 'same-domain':
            return urlDomain === baseDomain || urlDomain.endsWith('.' + baseDomain);
          case 'same-subdomain':
            return urlDomain === baseDomain;
          case 'whitelist':
            const whitelist = this.session.domain_whitelist ? JSON.parse(this.session.domain_whitelist) : [];
            return whitelist.some((domain: string) => 
              urlDomain === domain || urlDomain.endsWith('.' + domain)
            );
          default:
            return true;
        }
      } catch (e) {
        return false;
      }
    });
  }

  private async getBaseDomain(): Promise<string | null> {
    try {
      // Get the first URL from the crawl session to determine base domain
      const { results } = await this.db.prepare(`
        SELECT url FROM crawl_urls 
        WHERE session_id = ? 
        ORDER BY depth ASC, created_at ASC 
        LIMIT 1
      `).bind(this.sessionId).all();
      
      if (results.length > 0) {
        const firstUrl = results[0] as { url: string };
        try {
          const urlObj = new URL(firstUrl.url);
          // Extract the domain (without subdomain for same-domain strategy)
          const hostname = urlObj.hostname;
          const parts = hostname.split('.');
          
          // If it's likely a domain with subdomain (more than 2 parts and not an IP)
          if (parts.length > 2 && !hostname.match(/^\d+\.\d+\.\d+\.\d+$/)) {
            // Return the last two parts (domain.tld)
            return parts.slice(-2).join('.');
          }
          
          return hostname;
        } catch (urlError) {
          console.error('Error parsing base URL:', urlError);
          return null;
        }
      }
      
      return null;
    } catch (error) {
      console.error('Error getting base domain:', error);
      return null;
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}