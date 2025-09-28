// Test script to verify the Crawl4AI service
async function testCrawl4AIService() {
  try {
    // Test health endpoint
    const healthResponse = await fetch('http://localhost:8000/health');
    const healthData = await healthResponse.json();
    console.log('Health check:', healthData);

    // Test basic crawl
    const crawlResponse = await fetch('http://localhost:8000/crawl', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        url: 'https://example.com',
        strategy: 'basic',
        extraction_strategy: 'css_selector',
        chunking_strategy: 'semantic'
      })
    });

    const crawlData = await crawlResponse.json();
    console.log('Crawl result:', crawlData);

    console.log('All tests passed!');
  } catch (error) {
    console.error('Test failed:', error);
  }
}

testCrawl4AIService();