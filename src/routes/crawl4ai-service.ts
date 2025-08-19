import { Bindings } from '../types/database';

export interface Crawl4AIRequest {
  url: string;
  strategy?: 'basic' | 'smart' | 'ai_extraction';
  extraction_strategy?: 'css_selector' | 'xpath' | 'llm_based' | 'mixed';
  extraction_schema?: any;
  enable_pagination?: boolean;
  pagination_strategy?: 'auto' | 'css_selector' | 'ai_guided';
  javascript_enabled?: boolean;
  wait_for_selector?: string;
  screenshot?: boolean;
  user_agent?: string;
  proxy?: string;
  session_id?: string;
  chunking_strategy?: 'semantic' | 'fixed_length' | 'sliding_window';
  max_length?: number;
  overlap?: number;
}

export interface Crawl4AIResponse {
  success: boolean;
  url: string;
  title?: string;
  markdown?: string;
  html?: string;
  extracted_content?: any;
  links?: string[];
  media?: string[];
  metadata?: Record<string, any>;
  chunks?: Array<{
    content: string;
    metadata: Record<string, any>;
    index: number;
  }>;
  pagination_info?: {
    has_next: boolean;
    next_url?: string;
    current_page?: number;
    total_pages?: number;
  };
  performance_metrics?: {
    response_time: number;
    content_size: number;
    dom_elements: number;
    images_count: number;
    links_count: number;
  };
  error?: string;
  screenshot_url?: string;
}

export class Crawl4AIService {
  private apiEndpoint: string;
  private apiKey?: string;

  constructor(apiEndpoint: string = 'http://localhost:8000', apiKey?: string) {
    this.apiEndpoint = apiEndpoint;
    this.apiKey = apiKey;
  }

  async crawlUrl(request: Crawl4AIRequest): Promise<Crawl4AIResponse> {
    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'User-Agent': 'SmartScrape-Full-Stack/1.0'
      };

      if (this.apiKey) {
        headers['Authorization'] = `Bearer ${this.apiKey}`;
      }

      const response = await fetch(`${this.apiEndpoint}/crawl`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          ...request,
          user_agent: request.user_agent || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36'
        }),
        signal: AbortSignal.timeout(120000) // 2 minute timeout
      });

      if (!response.ok) {
        throw new Error(`Crawl4AI API error: ${response.status} ${response.statusText}`);
      }

      const result = await response.json() as Crawl4AIResponse;
      return result;
    } catch (error) {
      console.error('Crawl4AI service error:', error);
      return {
        success: false,
        url: request.url,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  async batchCrawl(requests: Crawl4AIRequest[]): Promise<Crawl4AIResponse[]> {
    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'User-Agent': 'SmartScrape-Full-Stack/1.0'
      };

      if (this.apiKey) {
        headers['Authorization'] = `Bearer ${this.apiKey}`;
      }

      const response = await fetch(`${this.apiEndpoint}/batch-crawl`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ requests }),
        signal: AbortSignal.timeout(300000) // 5 minute timeout for batch
      });

      if (!response.ok) {
        throw new Error(`Crawl4AI batch API error: ${response.status} ${response.statusText}`);
      }

      const result = await response.json();
      return result.results || [];
    } catch (error) {
      console.error('Crawl4AI batch service error:', error);
      // Return error responses for all requests
      return requests.map(req => ({
        success: false,
        url: req.url,
        error: error instanceof Error ? error.message : 'Unknown error'
      }));
    }
  }

  async extractWithAI(url: string, instruction: string, model: string = 'gpt-4'): Promise<Crawl4AIResponse> {
    return this.crawlUrl({
      url,
      strategy: 'ai_extraction',
      extraction_strategy: 'llm_based',
      extraction_schema: {
        instruction,
        model,
        response_format: 'json'
      }
    });
  }

  async detectPageStructure(url: string): Promise<{
    selectors: Record<string, string[]>;
    patterns: Record<string, any>;
    suggestions: Array<{
      name: string;
      selector: string;
      description: string;
      confidence: number;
    }>;
  }> {
    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json'
      };

      if (this.apiKey) {
        headers['Authorization'] = `Bearer ${this.apiKey}`;
      }

      const response = await fetch(`${this.apiEndpoint}/analyze-structure`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ url }),
        signal: AbortSignal.timeout(60000)
      });

      if (!response.ok) {
        throw new Error(`Structure analysis error: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Structure detection error:', error);
      return {
        selectors: {},
        patterns: {},
        suggestions: []
      };
    }
  }

  async testPagination(url: string, strategy?: string): Promise<{
    has_pagination: boolean;
    pagination_type: string;
    next_page_url?: string;
    selectors: string[];
    confidence: number;
  }> {
    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json'
      };

      if (this.apiKey) {
        headers['Authorization'] = `Bearer ${this.apiKey}`;
      }

      const response = await fetch(`${this.apiEndpoint}/test-pagination`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ url, strategy }),
        signal: AbortSignal.timeout(60000)
      });

      if (!response.ok) {
        throw new Error(`Pagination test error: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Pagination test error:', error);
      return {
        has_pagination: false,
        pagination_type: 'none',
        selectors: [],
        confidence: 0
      };
    }
  }

  async getServiceHealth(): Promise<{
    status: 'healthy' | 'unhealthy';
    version?: string;
    features?: string[];
    uptime?: number;
  }> {
    try {
      const response = await fetch(`${this.apiEndpoint}/health`, {
        method: 'GET',
        signal: AbortSignal.timeout(10000)
      });

      if (!response.ok) {
        return { status: 'unhealthy' };
      }

      const health = await response.json();
      return {
        status: 'healthy',
        ...health
      };
    } catch (error) {
      return { status: 'unhealthy' };
    }
  }
}

// Factory function to create service instances
export function createCrawl4AIService(env?: any): Crawl4AIService {
  const endpoint = env?.CRAWL4AI_ENDPOINT || 'http://localhost:8000';
  const apiKey = env?.CRAWL4AI_API_KEY;
  
  return new Crawl4AIService(endpoint, apiKey);
}

// Fallback crawler for when Crawl4AI service is not available
export class FallbackCrawlerService {
  static async crawlUrl(url: string): Promise<Crawl4AIResponse> {
    try {
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36'
        },
        signal: AbortSignal.timeout(30000)
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const html = await response.text();
      
      // Basic parsing with Cheerio
      const cheerio = await import('cheerio');
      const $ = cheerio.load(html);

      // Extract basic information
      const title = $('title').text().trim();
      const links: string[] = [];
      const media: string[] = [];

      $('a[href]').each((_, elem) => {
        const href = $(elem).attr('href');
        if (href && !href.startsWith('#') && !href.startsWith('javascript:')) {
          try {
            const absoluteUrl = new URL(href, url).toString();
            links.push(absoluteUrl);
          } catch (e) {
            // Ignore invalid URLs
          }
        }
      });

      $('img[src]').each((_, elem) => {
        const src = $(elem).attr('src');
        if (src) {
          try {
            const absoluteUrl = new URL(src, url).toString();
            media.push(absoluteUrl);
          } catch (e) {
            // Ignore invalid URLs
          }
        }
      });

      // Remove script and style tags
      $('script, style').remove();
      const text = $('body').text().replace(/\s+/g, ' ').trim();

      return {
        success: true,
        url,
        title,
        html,
        extracted_content: { text: text.substring(0, 50000) },
        links: links.slice(0, 100), // Limit to 100 links
        media: media.slice(0, 50), // Limit to 50 media items
        metadata: {
          description: $('meta[name="description"]').attr('content'),
          keywords: $('meta[name="keywords"]').attr('content'),
          'og:title': $('meta[property="og:title"]').attr('content'),
          'og:description': $('meta[property="og:description"]').attr('content')
        },
        performance_metrics: {
          response_time: Date.now(),
          content_size: html.length,
          dom_elements: $('*').length,
          images_count: media.length,
          links_count: links.length
        }
      };
    } catch (error) {
      return {
        success: false,
        url,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }
}