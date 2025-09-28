import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { serveStatic } from '@hono/node-server/serve-static'
import { Bindings } from './types/database'

const app = new Hono<{ Bindings: Bindings }>()

// Enable CORS for API routes
app.use('/api/*', cors())

// API Routes - simple health check
app.get('/api/health', (c) => {
  console.log('API Health endpoint hit')
  return c.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    version: '2.0.0 - Enhanced Edition'
  })
})

// Serve static files from public directory
app.get('/static/*', serveStatic({ root: './public' }))

// Serve the unified UI as the main page
app.get('/', serveStatic({ path: './public/index.html' }))

// For all other routes that are not API routes, serve the unified UI
app.get('*', serveStatic({ root: './public', path: '/index.html' }))

export default app