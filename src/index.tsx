import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { serveStatic } from 'hono/cloudflare-workers'
import { Bindings } from './types/database'
import crawlRoutes from './routes/crawl'
import enhancedCrawlRoutes from './routes/enhanced-crawl'
import proxyRoutes from './routes/enhanced-proxies'

const app = new Hono<{ Bindings: Bindings }>()

// Enable CORS for API routes
app.use('/api/*', cors())

// Serve static files from public directory
app.use('/*', serveStatic({ root: './public' }))

// API Routes
app.route('/api/crawl', crawlRoutes)
app.route('/api/enhanced-crawl', enhancedCrawlRoutes)
app.route('/api/proxies', proxyRoutes)

// Health check endpoint
app.get('/api/health', (c) => {
  return c.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    version: '2.0.0 - Enhanced Edition'
  })
})



export default app