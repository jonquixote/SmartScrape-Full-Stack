// Test script to verify API routes
async function testAPIRoutes() {
  try {
    console.log('🔍 Testing SmartScrape API Routes...\n');
    
    // Test health endpoint
    console.log('1. Testing /api/health endpoint...');
    const healthResponse = await fetch('http://localhost:3000/api/health');
    console.log('   Status:', healthResponse.status);
    if (healthResponse.ok) {
      const healthData = await healthResponse.json();
      console.log('   Data:', healthData);
    } else {
      console.log('   Error:', await healthResponse.text());
    }
    
    // Test crawl sessions endpoint
    console.log('\n2. Testing /api/crawl/sessions endpoint...');
    const sessionsResponse = await fetch('http://localhost:3000/api/crawl/sessions');
    console.log('   Status:', sessionsResponse.status);
    if (sessionsResponse.ok) {
      const sessionsData = await sessionsResponse.json();
      console.log('   Data:', sessionsData);
    } else {
      console.log('   Error:', await sessionsResponse.text());
    }
    
    // Test simplified crawl sessions endpoint
    console.log('\n3. Testing /api/simplified-crawl/sessions endpoint...');
    const simplifiedSessionsResponse = await fetch('http://localhost:3000/api/simplified-crawl/sessions');
    console.log('   Status:', simplifiedSessionsResponse.status);
    if (simplifiedSessionsResponse.ok) {
      const simplifiedSessionsData = await simplifiedSessionsResponse.json();
      console.log('   Data:', simplifiedSessionsData);
    } else {
      console.log('   Error:', await simplifiedSessionsResponse.text());
    }
    
    console.log('\n📋 API route testing complete.');
    
  } catch (error) {
    console.error('❌ Error testing API routes:', error.message);
  }
}

testAPIRoutes();