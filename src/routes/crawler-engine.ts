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
      // Use HTMLRewriter for robust HTML parsing
      const extractedData = await this.extractWithHTMLRewriter(html, url, options);
      
      result.title = extractedData.title;
      result.metadata = extractedData.metadata;
      
      if (options.extractLinks || this.session.extract_links) {
        result.links = extractedData.links;
      }
      
      if (options.extractMedia || this.session.extract_media) {
        result.media = extractedData.media;
      }
      
      result.text = extractedData.text;
      
      if (options.generateMarkdown || this.session.generate_markdown) {
        result.markdown = extractedData.markdown;
      }

    } catch (error) {
      console.error('Content extraction error:', error);
      // Fallback to basic text extraction
      result.text = html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim().substring(0, 10000);
    }

    return result;
  }

  private async extractWithHTMLRewriter(html: string, baseUrl: string, options: CrawlOptions = {}): Promise<{
    title: string;
    metadata: Record<string, any>;
    links: string[];
    media: string[];
    text: string;
    markdown: string;
  }> {
    let title = '';
    const metadata: Record<string, any> = {};
    const links = new Set<string>();
    const media = new Set<string>();
    const textContent: string[] = [];
    const markdownParts: string[] = [];
    let currentHeading = '';
    
    const response = new Response(html, {
      headers: { 'Content-Type': 'text/html' }
    });
    
    const rewriter = new HTMLRewriter()
      // Extract title
      .on('title', {
        text(text) {
          title += text.text;
        }
      })
      
      // Extract metadata from meta tags
      .on('meta', {
        element(element) {
          const name = element.getAttribute('name') || 
                      element.getAttribute('property') || 
                      element.getAttribute('http-equiv');
          const content = element.getAttribute('content');
          
          if (name && content) {
            metadata[name] = content;
          }
        }
      })
      
      // Extract JSON-LD structured data
      .on('script[type="application/ld+json"]', {
        text(text) {
          try {
            const data = JSON.parse(text.text);
            if (!metadata.structuredData) {
              metadata.structuredData = [];
            }
            metadata.structuredData.push(data);
          } catch (e) {
            // Ignore invalid JSON-LD
          }
        }
      })
      
      // Extract links
      .on('a[href]', {
        element(element) {
          if (options.extractLinks || this.session.extract_links) {
            const href = element.getAttribute('href');
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
        }
      })
      
      // Extract media
      .on('img[src], video[src], source[src]', {
        element(element) {
          if (options.extractMedia || this.session.extract_media) {
            const src = element.getAttribute('src');
            if (src) {
              try {
                const absoluteUrl = new URL(src, baseUrl).toString();
                media.add(absoluteUrl);
              } catch (e) {
                // Ignore invalid URLs
              }
            }
          }
        }
      })
      
      // Extract text content and build markdown
      .on('h1, h2, h3, h4, h5, h6', {
        text(text) {
          currentHeading += text.text;
        },
        element(element) {
          if (currentHeading.trim()) {
            const level = parseInt(element.tagName.slice(1));
            const markdownHeading = '#'.repeat(level) + ' ' + currentHeading.trim();
            markdownParts.push(markdownHeading);
            textContent.push(currentHeading.trim());
            currentHeading = '';
          }
        }
      })
      
      .on('p, div.content, article, main', {
        text(text) {
          const cleanText = text.text.trim();
          if (cleanText.length > 10) {
            textContent.push(cleanText);
            if (options.generateMarkdown || this.session.generate_markdown) {
              markdownParts.push(cleanText);
            }
          }
        }
      })
      
      // Remove script and style content
      .on('script, style', {
        element(element) {
          element.remove();
        }
      });
    
    await rewriter.transform(response).text();
    
    return {
      title: title.trim(),
      metadata,
      links: Array.from(links),
      media: Array.from(media),
      text: textContent.join(' ').trim().substring(0, 10000),
      markdown: this.formatMarkdown(title.trim(), markdownParts)
    };
  }

  private formatMarkdown(title: string, parts: string[]): string {
    let markdown = '';
    
    if (title) {
      markdown += `# ${title}\n\n`;
    }
    
    parts.forEach(part => {
      if (part.trim()) {
        markdown += part + '\n\n';
      }
    });
    
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