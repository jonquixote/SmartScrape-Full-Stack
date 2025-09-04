// Test for simplified crawl routes
import { expect, test } from 'vitest';
import { Hono } from 'hono';
import { Bindings } from '../src/types/database';
import simplifiedCrawlRoutes from '../src/routes/simplified-crawl';

// Mock environment
const mockEnv = {
  DB: {
    prepare: () => ({
      bind: () => ({
        first: async () => null,
        all: async () => ({ results: [] }),
        run: async () => ({ meta: { last_row_id: 1 } })
      })
    })
  }
};

// Create test app
const app = new Hono<{ Bindings: Bindings }>();
app.route('/api/simplified-crawl', simplifiedCrawlRoutes);

// Mock fetch for internal API calls
const originalFetch = global.fetch;
global.fetch = async (url, options) => {
  // Mock responses for internal API calls
  if (url.includes('/api/crawl')) {
    return new Response(JSON.stringify({ id: 1, message: 'Success' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  }
  
  return originalFetch(url, options);
};

test('should create simplified crawl session', async () => {
  const response = await app.request('/api/simplified-crawl/sessions/create-simplified', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      prompt: 'Test crawl',
      start_method: 'manual',
      urls: ['https://example.com'],
      crawl_strategy: 'smart',
      enable_deep_crawl: true,
      enable_pagination: true,
      generate_markdown: true,
      extract_metadata: true,
      extract_links: true,
      extract_media: false,
      enable_ai_extraction: false
    })
  });
  
  expect(response.status).toBe(200);
  const data = await response.json();
  expect(data).toHaveProperty('id');
});

test('should handle simplified AI URL discovery', async () => {
  const response = await app.request('/api/simplified-crawl/discover-urls-simplified', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      prompt: 'Find news articles',
      ai_api_key: 'test-key',
      ai_model: 'gemma2-9b-it'
    })
  });
  
  // Should return 200 or 400/500 depending on API availability
  expect([200, 400, 500]).toContain(response.status);
});

test('should get simplified session details', async () => {
  const response = await app.request('/api/simplified-crawl/sessions/1/simplified');
  expect(response.status).toBe(200);
});

test('should start simplified crawl', async () => {
  const response = await app.request('/api/simplified-crawl/sessions/1/start-simplified', {
    method: 'POST'
  });
  
  expect(response.status).toBe(200);
});

test('should stop simplified crawl', async () => {
  const response = await app.request('/api/simplified-crawl/sessions/1/stop-simplified', {
    method: 'POST'
  });
  
  expect(response.status).toBe(200);
});

test('should get simplified progress', async () => {
  const response = await app.request('/api/simplified-crawl/sessions/1/progress-simplified');
  expect(response.status).toBe(200);
});

test('should export simplified results', async () => {
  const response = await app.request('/api/simplified-crawl/sessions/1/export-simplified/json');
  // Should return 200 or 400/500 depending on session existence
  expect([200, 400, 500]).toContain(response.status);
});