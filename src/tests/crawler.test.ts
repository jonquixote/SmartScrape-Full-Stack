// Test suite for crawler functionality
// This would be used with a testing framework like Jest or Vitest

interface TestResult {
  name: string;
  passed: boolean;
  error?: string;
  duration?: number;
}

interface TestSuite {
  name: string;
  tests: TestResult[];
  passed: number;
  failed: number;
  total: number;
}

export class CrawlerTestSuite {
  private baseUrl: string;
  private results: TestSuite[] = [];

  constructor(baseUrl: string = 'http://localhost:3000') {
    this.baseUrl = baseUrl;
  }

  async runAllTests(): Promise<{ suites: TestSuite[]; summary: { passed: number; failed: number; total: number } }> {
    console.log('🧪 Starting Crawler Test Suite...\n');

    // Run all test suites
    await this.testBasicCrawling();
    await this.testAdvancedExtraction();
    await this.testPaginationHandling();
    await this.testProxyFunctionality();
    await this.testErrorHandling();
    await this.testPerformance();

    // Calculate summary
    const summary = this.results.reduce(
      (acc, suite) => ({
        passed: acc.passed + suite.passed,
        failed: acc.failed + suite.failed,
        total: acc.total + suite.total
      }),
      { passed: 0, failed: 0, total: 0 }
    );

    console.log('\n📊 Test Summary:');
    console.log(`✅ Passed: ${summary.passed}`);
    console.log(`❌ Failed: ${summary.failed}`);
    console.log(`📋 Total: ${summary.total}`);
    console.log(`🎯 Success Rate: ${Math.round((summary.passed / summary.total) * 100)}%`);

    return { suites: this.results, summary };
  }

  private async testBasicCrawling(): Promise<void> {
    const suite: TestSuite = {
      name: 'Basic Crawling',
      tests: [],
      passed: 0,
      failed: 0,
      total: 0
    };

    // Test 1: Create crawl session
    await this.runTest(suite, 'Create crawl session', async () => {
      const response = await fetch(`${this.baseUrl}/api/crawl/sessions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: 'Test Crawl Session',
          description: 'Automated test session',
          start_method: 'manual',
          urls: ['https://httpbin.org/html'],
          generate_markdown: true,
          extract_metadata: true,
          extract_links: true
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();
      if (!result.id || result.status !== 'pending') {
        throw new Error('Invalid session creation response');
      }

      // Store session ID for cleanup
      (this as any).testSessionId = result.id;
      return result;
    });

    // Test 2: Start crawling session
    if ((this as any).testSessionId) {
      await this.runTest(suite, 'Start crawling session', async () => {
        const sessionId = (this as any).testSessionId;
        const response = await fetch(`${this.baseUrl}/api/crawl/sessions/${sessionId}/start`, {
          method: 'POST'
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const result = await response.json();
        if (result.status !== 'running') {
          throw new Error('Session did not start properly');
        }

        return result;
      });

      // Test 3: Check crawl progress
      await this.runTest(suite, 'Check crawl progress', async () => {
        const sessionId = (this as any).testSessionId;
        
        // Wait a bit for crawling to start
        await new Promise(resolve => setTimeout(resolve, 2000));

        const response = await fetch(`${this.baseUrl}/api/crawl/sessions/${sessionId}/progress`);

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const result = await response.json();
        if (typeof result.progress_percentage !== 'number') {
          throw new Error('Invalid progress response');
        }

        return result;
      });

      // Test 4: Get session details
      await this.runTest(suite, 'Get session details', async () => {
        const sessionId = (this as any).testSessionId;
        const response = await fetch(`${this.baseUrl}/api/crawl/sessions/${sessionId}`);

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const result = await response.json();
        if (!result.session || !result.urls) {
          throw new Error('Invalid session details response');
        }

        return result;
      });
    }

    this.results.push(suite);
  }

  private async testAdvancedExtraction(): Promise<void> {
    const suite: TestSuite = {
      name: 'Advanced Extraction',
      tests: [],
      passed: 0,
      failed: 0,
      total: 0
    };

    // Test 1: Test extraction schema
    await this.runTest(suite, 'Test extraction schema', async () => {
      const extractionSchema = {
        fields: [
          { name: 'title', selector: 'h1', attribute: 'text' },
          { name: 'links', selector: 'a[href]', attribute: 'href', multiple: true }
        ]
      };

      const response = await fetch(`${this.baseUrl}/api/crawl/test-extraction`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: 'https://httpbin.org/html',
          extraction_schema: extractionSchema
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();
      if (result.status !== 'success') {
        throw new Error('Extraction test failed');
      }

      return result;
    });

    // Test 2: Suggest selectors
    await this.runTest(suite, 'Suggest selectors', async () => {
      const response = await fetch(`${this.baseUrl}/api/crawl/suggest-selectors`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: 'https://httpbin.org/html'
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();
      if (!result.suggestions) {
        throw new Error('No suggestions returned');
      }

      return result;
    });

    this.results.push(suite);
  }

  private async testPaginationHandling(): Promise<void> {
    const suite: TestSuite = {
      name: 'Pagination Handling',
      tests: [],
      passed: 0,
      failed: 0,
      total: 0
    };

    // Test 1: Create session with pagination enabled
    await this.runTest(suite, 'Create paginated crawl session', async () => {
      const response = await fetch(`${this.baseUrl}/api/crawl/sessions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: 'Pagination Test Session',
          start_method: 'manual',
          urls: ['https://httpbin.org/html'],
          enable_pagination: true,
          pagination_strategy: 'auto',
          max_pages: 3
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();
      (this as any).paginationSessionId = result.id;
      return result;
    });

    this.results.push(suite);
  }

  private async testProxyFunctionality(): Promise<void> {
    const suite: TestSuite = {
      name: 'Proxy Functionality',
      tests: [],
      passed: 0,
      failed: 0,
      total: 0
    };

    // Test 1: List available proxies
    await this.runTest(suite, 'List available proxies', async () => {
      const response = await fetch(`${this.baseUrl}/api/proxies`);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();
      if (!Array.isArray(result.proxies)) {
        throw new Error('Invalid proxies response');
      }

      return result;
    });

    // Test 2: Test proxy health
    await this.runTest(suite, 'Test proxy health', async () => {
      const response = await fetch(`${this.baseUrl}/api/proxies/test`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          test_url: 'https://httpbin.org/ip'
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();
      return result;
    });

    this.results.push(suite);
  }

  private async testErrorHandling(): Promise<void> {
    const suite: TestSuite = {
      name: 'Error Handling',
      tests: [],
      passed: 0,
      failed: 0,
      total: 0
    };

    // Test 1: Handle invalid URL
    await this.runTest(suite, 'Handle invalid URL', async () => {
      const response = await fetch(`${this.baseUrl}/api/crawl/sessions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: 'Invalid URL Test',
          start_method: 'manual',
          urls: ['not-a-valid-url']
        })
      });

      // Should still create session, but crawling should fail gracefully
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();
      return result;
    });

    // Test 2: Handle non-existent session
    await this.runTest(suite, 'Handle non-existent session', async () => {
      const response = await fetch(`${this.baseUrl}/api/crawl/sessions/99999`);

      if (response.status !== 404) {
        throw new Error('Should return 404 for non-existent session');
      }

      return { status: 'correctly_handled' };
    });

    this.results.push(suite);
  }

  private async testPerformance(): Promise<void> {
    const suite: TestSuite = {
      name: 'Performance Tests',
      tests: [],
      passed: 0,
      failed: 0,
      total: 0
    };

    // Test 1: Measure API response time
    await this.runTest(suite, 'API response time', async () => {
      const startTime = Date.now();
      
      const response = await fetch(`${this.baseUrl}/api/health`);
      
      const endTime = Date.now();
      const responseTime = endTime - startTime;

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      if (responseTime > 5000) { // 5 seconds
        throw new Error(`Slow response time: ${responseTime}ms`);
      }

      return { responseTime };
    });

    // Test 2: Concurrent session creation
    await this.runTest(suite, 'Concurrent session creation', async () => {
      const promises = Array.from({ length: 5 }, (_, i) =>
        fetch(`${this.baseUrl}/api/crawl/sessions`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: `Concurrent Test ${i}`,
            start_method: 'manual',
            urls: ['https://httpbin.org/html']
          })
        })
      );

      const results = await Promise.all(promises);
      
      for (const response of results) {
        if (!response.ok) {
          throw new Error(`Concurrent request failed: ${response.status}`);
        }
      }

      return { concurrentRequests: results.length };
    });

    this.results.push(suite);
  }

  private async runTest(suite: TestSuite, testName: string, testFn: () => Promise<any>): Promise<void> {
    const startTime = Date.now();
    
    try {
      console.log(`  🔄 Running: ${testName}`);
      
      const result = await testFn();
      const duration = Date.now() - startTime;
      
      suite.tests.push({
        name: testName,
        passed: true,
        duration
      });
      
      suite.passed++;
      console.log(`  ✅ Passed: ${testName} (${duration}ms)`);
    } catch (error) {
      const duration = Date.now() - startTime;
      
      suite.tests.push({
        name: testName,
        passed: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        duration
      });
      
      suite.failed++;
      console.log(`  ❌ Failed: ${testName} - ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
    
    suite.total++;
  }

  // Cleanup method to remove test sessions
  async cleanup(): Promise<void> {
    console.log('\n🧹 Cleaning up test data...');
    
    const sessionIds = [
      (this as any).testSessionId,
      (this as any).paginationSessionId
    ].filter(Boolean);

    for (const sessionId of sessionIds) {
      try {
        await fetch(`${this.baseUrl}/api/crawl/sessions/${sessionId}`, {
          method: 'DELETE'
        });
        console.log(`  🗑️  Deleted session ${sessionId}`);
      } catch (error) {
        console.log(`  ⚠️  Failed to delete session ${sessionId}`);
      }
    }
  }
}

// Export function to run tests
export async function runCrawlerTests(baseUrl?: string): Promise<void> {
  const testSuite = new CrawlerTestSuite(baseUrl);
  
  try {
    await testSuite.runAllTests();
  } finally {
    await testSuite.cleanup();
  }
}

// Simple test runner for development
if (typeof window === 'undefined' && require.main === module) {
  runCrawlerTests().catch(console.error);
}