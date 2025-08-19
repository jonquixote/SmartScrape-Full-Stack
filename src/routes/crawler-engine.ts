import { Bindings, CrawlSession, CrawlUrl } from '../types/database';

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
}

export class CrawlerEngine {
  private db: D1Database;
  private sessionId: number;
  private session: CrawlSession;
  private abortController: AbortController;
  private isRunning: boolean = false;
  
  // Static CORS proxies for reliable access
  private static CORS_PROXIES = [
    'https://api.allorigins.win/raw?url=',
    'https://corsproxy.io/?',
    'https://api.codetabs.com/v1/proxy?quest=',
    'https://thingproxy.freeboard.io/fetch/'
  ];

  // Default user agents for rotation
  private static USER_AGENTS = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:127.0) Gecko/20100101 Firefox/127.0',
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36'
  ];

  constructor(db: D1Database, sessionId: number, session: CrawlSession) {
    this.db = db;
    this.sessionId = sessionId;
    this.session = session;
    this.abortController = new AbortController();
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
        
        // Add crawl delay
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
          'Upgrade-Insecure-Requests': '1'
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

      // Parse and extract content
      const result = await this.extractContent(url, html, options);
      
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
    
    for (const proxy of CrawlerEngine.CORS_PROXIES) {
      try {
        const proxyUrl = proxy + encodeURIComponent(url);
        const response = await this.fetchWithTimeout(proxyUrl, {
          headers: {
            'User-Agent': userAgent
          },
          signal: this.abortController.signal
        });
        
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

  private async extractContent(url: string, html: string, options: CrawlOptions = {}): Promise<Partial<CrawlResult>> {
    const result: Partial<CrawlResult> = { url, html };

    try {
      // Extract title using regex
      const titleMatch = html.match(/<title[^>]*>([^<]*)<\/title>/i);
      result.title = titleMatch ? titleMatch[1].trim() : '';

      // Extract metadata using regex
      result.metadata = this.extractMetadataRegex(html);

      // Extract links if requested
      if (options.extractLinks || this.session.extract_links) {
        result.links = this.extractLinksRegex(html, url);
      }

      // Extract media if requested
      if (options.extractMedia || this.session.extract_media) {
        result.media = this.extractMediaRegex(html, url);
      }

      // Extract main text content
      result.text = this.extractMainContentRegex(html);

      // Generate markdown if requested
      if (options.generateMarkdown || this.session.generate_markdown) {
        result.markdown = this.convertToMarkdownRegex(html, result.title || '');
      }

    } catch (error) {
      console.error('Content extraction error:', error);
      // Fallback to basic text extraction
      result.text = html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim().substring(0, 10000);
    }

    return result;
  }

  private extractMetadataRegex(html: string): Record<string, any> {
    const metadata: Record<string, any> = {};

    // Extract meta tags using regex
    const metaTagRegex = /<meta\s+([^>]*?)>/gi;
    let match;
    
    while ((match = metaTagRegex.exec(html)) !== null) {
      const attrs = match[1];
      const nameMatch = attrs.match(/(?:name|property|http-equiv)=["']([^"']+)["']/i);
      const contentMatch = attrs.match(/content=["']([^"']+)["']/i);
      
      if (nameMatch && contentMatch) {
        metadata[nameMatch[1]] = contentMatch[1];
      }
    }

    // Extract JSON-LD structured data
    const jsonLdRegex = /<script[^>]*type=["']application\/ld\+json["'][^>]*>(.*?)<\/script>/gis;
    const structuredData: any[] = [];
    
    while ((match = jsonLdRegex.exec(html)) !== null) {
      try {
        const data = JSON.parse(match[1]);
        structuredData.push(data);
      } catch (e) {
        // Ignore invalid JSON-LD
      }
    }
    
    if (structuredData.length > 0) {
      metadata['structuredData'] = structuredData;
    }

    return metadata;
  }

  private extractLinksRegex(html: string, baseUrl: string): string[] {
    const links: Set<string> = new Set();
    const linkRegex = /<a\s+[^>]*href=["']([^"']+)["'][^>]*>/gi;
    let match;
    
    while ((match = linkRegex.exec(html)) !== null) {
      const href = match[1];
      if (href && !href.startsWith('#') && !href.startsWith('javascript:')) {
        try {
          const absoluteUrl = new URL(href, baseUrl).toString();
          if (absoluteUrl.startsWith('http://') || absoluteUrl.startsWith('https://')) {
            links.add(absoluteUrl);
          }
        } catch (e) {
          // Ignore invalid URLs
        }
      }
    }

    return Array.from(links);
  }

  private extractMediaRegex(html: string, baseUrl: string): string[] {
    const media: Set<string> = new Set();
    
    // Extract images
    const imgRegex = /<img\s+[^>]*src=["']([^"']+)["'][^>]*>/gi;
    let match;
    
    while ((match = imgRegex.exec(html)) !== null) {
      const src = match[1];
      if (src) {
        try {
          const absoluteUrl = new URL(src, baseUrl).toString();
          media.add(absoluteUrl);
        } catch (e) {
          // Ignore invalid URLs
        }
      }
    }

    // Extract videos
    const videoRegex = /<(?:video|source)\s+[^>]*src=["']([^"']+)["'][^>]*>/gi;
    
    while ((match = videoRegex.exec(html)) !== null) {
      const src = match[1];
      if (src) {
        try {
          const absoluteUrl = new URL(src, baseUrl).toString();
          media.add(absoluteUrl);
        } catch (e) {
          // Ignore invalid URLs
        }
      }
    }

    return Array.from(media);
  }

  private extractMainContentRegex(html: string): string {
    // Remove script and style tags
    let cleanHtml = html.replace(/<script[^>]*>.*?<\/script>/gis, '');
    cleanHtml = cleanHtml.replace(/<style[^>]*>.*?<\/style>/gis, '');
    
    // Try to find main content areas
    const contentSelectors = [
      /<main[^>]*>(.*?)<\/main>/gis,
      /<article[^>]*>(.*?)<\/article>/gis,
      /<div[^>]*(?:class|id)=["'][^"']*content[^"']*["'][^>]*>(.*?)<\/div>/gis,
      /<div[^>]*(?:class|id)=["'][^"']*main[^"']*["'][^>]*>(.*?)<\/div>/gis
    ];

    for (const regex of contentSelectors) {
      const match = regex.exec(cleanHtml);
      if (match && match[1]) {
        // Extract text content and clean up
        const textContent = match[1].replace(/<[^>]*>/g, ' ')
                                    .replace(/\s+/g, ' ')
                                    .trim();
        if (textContent.length > 100) {
          return textContent;
        }
      }
    }

    // Fallback: extract all text content
    return cleanHtml.replace(/<[^>]*>/g, ' ')
                    .replace(/\s+/g, ' ')
                    .trim()
                    .substring(0, 10000);
  }

  private convertToMarkdownRegex(html: string, title: string): string {
    let markdown = '';

    if (title) {
      markdown += `# ${title}\n\n`;
    }

    // Extract and convert headings
    const headingRegex = /<h([1-6])[^>]*>(.*?)<\/h[1-6]>/gi;
    let match;
    
    while ((match = headingRegex.exec(html)) !== null) {
      const level = parseInt(match[1]);
      const text = match[2].replace(/<[^>]*>/g, '').trim();
      if (text) {
        markdown += '#'.repeat(level) + ' ' + text + '\n\n';
      }
    }

    // Extract paragraphs
    const paragraphRegex = /<p[^>]*>(.*?)<\/p>/gi;
    
    while ((match = paragraphRegex.exec(html)) !== null) {
      const text = match[1].replace(/<[^>]*>/g, '').trim();
      if (text && text.length > 10) {
        markdown += text + '\n\n';
      }
    }

    // If no structured content found, use main content extraction
    if (markdown.length < 100) {
      const mainContent = this.extractMainContentRegex(html);
      const paragraphs = mainContent.split(/\n\s*\n/).filter(p => p.trim().length > 10);
      
      paragraphs.forEach(paragraph => {
        markdown += paragraph.trim() + '\n\n';
      });
    }

    return markdown.trim();
  }

  private getRandomUserAgent(): string {
    return CrawlerEngine.USER_AGENTS[Math.floor(Math.random() * CrawlerEngine.USER_AGENTS.length)];
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
    const filteredUrls = this.filterUrlsByDomainStrategy(urls);
    
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

  private filterUrlsByDomainStrategy(urls: string[]): string[] {
    const strategy = this.session.domain_strategy || 'same-domain';
    
    if (strategy === 'any') {
      return urls;
    }

    // Get base domain from first discovered URL or session URLs
    const baseDomain = this.getBaseDomain();
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

  private getBaseDomain(): string | null {
    // This would need to be implemented based on the session's initial URLs
    // For now, return null to disable domain filtering
    return null;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}