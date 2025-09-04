import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { serveStatic } from '@hono/node-server/serve-static'
import { Bindings } from './types/database'
import crawlRoutes from './routes/crawl'
import enhancedCrawlRoutes from './routes/enhanced-crawl'
import proxyRoutes from './routes/enhanced-proxies'
import simplifiedCrawlRoutes from './routes/simplified-crawl'

const app = new Hono<{ Bindings: Bindings }>()

// Enable CORS for API routes
app.use('/api/*', cors())

// API Routes - make sure these are handled first
app.get('/api/health', (c) => {
  console.log('API Health endpoint hit')
  return c.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    version: '2.0.0 - Enhanced Edition'
  })
})

app.route('/api/crawl', crawlRoutes)
app.route('/api/enhanced-crawl', enhancedCrawlRoutes)
app.route('/api/proxies', proxyRoutes)
app.route('/api/simplified-crawl', simplifiedCrawlRoutes)

// Special routes - serve specific HTML files
app.get('/comprehensive', serveStatic({ path: './public/comprehensive_ui.html' }))
app.get('/full-features', serveStatic({ path: './public/full_feature_ui.html' }))
app.get('/simplified', serveStatic({ path: './public/real_simplified_index.html' }))
app.get('/mock-ui', serveStatic({ path: './public/simplified_index.html' }))

// Serve static files - more specific routes first
app.get('/static/*', serveStatic({ root: './public' }))

// Serve the comprehensive UI as the main page
app.get('/', serveStatic({ path: './public/comprehensive_ui.html' }))

// For all other routes that are not API routes, serve the comprehensive UI
app.get('*', (c) => {
  const path = c.req.path
  console.log('Catch-all route hit for path:', path)
  // Explicitly check if this is an API route
  if (path.startsWith('/api/')) {
    console.log('API route requested but not caught by specific handler')
    return c.notFound()
  }
  return serveStatic({ path: './public/comprehensive_ui.html' })(c)
})

export default app