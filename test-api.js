// Test script to verify API endpoints
async function testAPI() {
  try {
    // Test health endpoint
    console.log('Testing health endpoint...');
    const healthResponse = await fetch('http://localhost:3000/api/health');
    const healthData = await healthResponse.json();
    console.log('Health:', healthData);
    
    // Test simplified crawl session creation
    console.log('\nTesting simplified crawl session creation...');
    const sessionResponse = await fetch('http://localhost:3000/api/simplified-crawl/sessions/create-simplified', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
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
    
    console.log('Session creation status:', sessionResponse.status);
    if (sessionResponse.ok) {
      const sessionData = await sessionResponse.json();
      console.log('Session created:', sessionData);
    } else {
      const errorData = await sessionResponse.json();
      console.log('Session creation failed:', errorData);
    }
    
    // Test simplified AI URL discovery
    console.log('\nTesting simplified AI URL discovery...');
    const discoveryResponse = await fetch('http://localhost:3000/api/simplified-crawl/discover-urls-simplified', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        prompt: 'Find news articles',
        ai_api_key: 'test-key',
        ai_model: 'gemma2-9b-it'
      })
    });
    
    console.log('Discovery status:', discoveryResponse.status);
    if (discoveryResponse.ok) {
      const discoveryData = await discoveryResponse.json();
      console.log('Discovery response:', discoveryData);
    } else {
      const errorData = await discoveryResponse.json();
      console.log('Discovery failed:', errorData);
    }
    
  } catch (error) {
    console.error('Test failed:', error);
  }
}

testAPI();