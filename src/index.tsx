import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { serveStatic } from 'hono/cloudflare-workers'
import { Bindings } from './types/database'
import crawlRoutes from './routes/crawl'
import proxyRoutes from './routes/enhanced-proxies'

const app = new Hono<{ Bindings: Bindings }>()

// Enable CORS for API routes
app.use('/api/*', cors())

// Serve static files from public directory
app.use('/static/*', serveStatic({ root: './public' }))

// API Routes
app.route('/api/crawl', crawlRoutes)
app.route('/api/proxies', proxyRoutes)

// Health check endpoint
app.get('/api/health', (c) => {
  return c.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    version: '2.0.0 - Enhanced Edition'
  })
})

// Main application page
app.get('/', (c) => {
  return c.html(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Crawl4AI Ultimate Pro - Enhanced Full Stack Edition</title>
        <link href="https://cdn.jsdelivr.net/npm/tailwindcss@2.2.19/dist/tailwind.min.css" rel="stylesheet">
        <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css">
        <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
        <style>
            /* Enhanced Styling & Layout */
            .tab-content { display: none; }
            .tab-content.active { display: block; }
            .session-tab-content { display: none; }
            .session-tab-content.active { display: block; }
            
            /* Glassmorphism & Gradients */
            .glass-effect {
                background: rgba(255, 255, 255, 0.95);
                backdrop-filter: blur(10px);
                border: 1px solid rgba(255, 255, 255, 0.2);
            }
            .gradient-text {
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                -webkit-background-clip: text;
                -webkit-text-fill-color: transparent;
                background-clip: text;
            }

            /* Buttons */
            .btn-primary {
                background: linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%);
                color: white; font-weight: 500; padding: 0.75rem 1rem;
                border-radius: 0.5rem; border: none; cursor: pointer; transition: all 0.2s;
            }
            .btn-primary:hover:not(:disabled) {
                background: linear-gradient(135deg, #2563eb 0%, #7c3aed 100%);
                transform: translateY(-1px); box-shadow: 0 4px 12px rgba(59, 130, 246, 0.3);
            }
            .btn-primary:disabled { opacity: 0.5; cursor: not-allowed; transform: none; box-shadow: none; }
            .btn-secondary { background: #6b7280; color: white; font-weight: 500; padding: 0.5rem 1rem; border-radius: 0.5rem; border: none; cursor: pointer; transition: all 0.2s; }
            .btn-secondary:hover:not(:disabled) { background: #4b5563; }
            .btn-danger { background: #ef4444; color: white; font-weight: 500; padding: 0.5rem 1rem; border-radius: 0.5rem; border: none; cursor: pointer; transition: all 0.2s; }
            .btn-danger:hover:not(:disabled) { background: #dc2626; }
            .btn-success { background: #10b981; color: white; font-weight: 500; padding: 0.5rem 1rem; border-radius: 0.5rem; border: none; cursor: pointer; transition: all 0.2s; }
            .btn-success:hover:not(:disabled) { background: #059669; }

            /* Status Badges */
            .status-badge {
                display: inline-block; padding: 0.25rem 0.5rem; border-radius: 0.375rem; 
                font-size: 0.75rem; font-weight: 500; text-transform: uppercase;
            }
            .status-badge.pending { background: #e5e7eb; color: #374151; }
            .status-badge.running { background: #dbeafe; color: #1e40af; }
            .status-badge.completed { background: #d1fae5; color: #065f46; }
            .status-badge.failed { background: #fee2e2; color: #991b1b; }
            .status-badge.stopped { background: #fef3c7; color: #92400e; }
            .status-badge.blocked { background: #fef3c7; color: #92400e; }
            .status-badge.processing { background: #ede9fe; color: #6b21a8; }
            .status-badge.discovered { background: #dbeafe; color: #1d4ed8; }
            .status-badge.success { background: #d1fae5; color: #065f46; }

            /* Tab Styling */
            .tab-btn {
                transition: all 0.2s ease;
            }
            .tab-btn.active {
                background: white;
                color: #3b82f6;
                box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
            }
            .session-tab-btn {
                transition: all 0.2s ease;
                border-bottom: 2px solid transparent;
            }
            .session-tab-btn.active {
                border-bottom-color: #3b82f6;
                color: #3b82f6;
            }

            /* Form Elements */
            .form-input, .form-select {
                width: 100%; padding: 0.75rem; border: 1px solid #d1d5db;
                border-radius: 0.5rem; outline: none; transition: border-color 0.2s, box-shadow 0.2s;
            }
            .form-input:focus, .form-select:focus {
                border-color: #3b82f6; box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
            }

            /* Metric Cards */
            .metric-card {
                background: linear-gradient(135deg, rgba(59, 130, 246, 0.1), rgba(139, 92, 246, 0.1));
                border: 1px solid rgba(59, 130, 246, 0.2);
            }
            
            /* Animations */
            .pulse-ring { animation: pulse-ring 1.5s ease-out infinite; }
            @keyframes pulse-ring { 0% { transform: scale(.33); opacity: 1; } 80%, 100% { opacity: 0; transform: scale(1.5); } }
            
            /* Tree Canvas */
            #tree-canvas {
                background: #f9fafb;
                border: 1px solid #e5e7eb;
            }
        </style>
    </head>
    <body class="bg-gray-50">
        <!-- Header -->
        <div class="glass-effect shadow-lg mb-6 sticky top-0 z-40">
            <div class="container mx-auto px-4 py-4">
                <div class="flex items-center justify-between">
                    <div class="flex items-center space-x-3">
                        <div class="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center relative">
                            <i class="fas fa-spider text-white text-lg"></i>
                            <div class="absolute -top-1 -right-1 w-3 h-3 bg-green-500 rounded-full pulse-ring"></div>
                        </div>
                        <div>
                            <h1 class="text-xl font-bold gradient-text">Crawl4AI Ultimate Pro</h1>
                            <p class="text-sm text-gray-600">Enhanced Full Stack Edition - Real Crawling Engine</p>
                        </div>
                    </div>
                    <div class="flex items-center space-x-4">
                        <div class="text-sm text-gray-600">
                            <i class="fas fa-server mr-1"></i>
                            <span id="connection-status">Connecting...</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <!-- Navigation Tabs -->
        <div class="container mx-auto px-4 mb-6">
            <div class="flex space-x-1 bg-gray-200 rounded-lg p-1">
                <button class="tab-btn flex-1 py-2 px-4 rounded-md font-medium transition-all active" data-tab="dashboard">
                    <i class="fas fa-tachometer-alt mr-2"></i>Dashboard
                </button>
                <button class="tab-btn flex-1 py-2 px-4 rounded-md font-medium transition-all" data-tab="create">
                    <i class="fas fa-plus mr-2"></i>New Crawl
                </button>
                <button class="tab-btn flex-1 py-2 px-4 rounded-md font-medium transition-all" data-tab="sessions">
                    <i class="fas fa-list mr-2"></i>Sessions
                </button>
                <button class="tab-btn flex-1 py-2 px-4 rounded-md font-medium transition-all" data-tab="proxies">
                    <i class="fas fa-shield-alt mr-2"></i>Proxies
                </button>
            </div>
        </div>

        <!-- Tab Content -->
        <div class="container mx-auto px-4">
            <!-- Dashboard Tab -->
            <div id="dashboard-tab" class="tab-content active">
                <div class="grid grid-cols-1 lg:grid-cols-4 gap-6 mb-6">
                    <!-- Quick Stats -->
                    <div class="metric-card p-6 rounded-xl">
                        <div class="flex items-center justify-between">
                            <div>
                                <p class="text-sm text-gray-600">Active Sessions</p>
                                <p class="text-2xl font-bold text-blue-600" id="active-sessions-count">0</p>
                            </div>
                            <i class="fas fa-play-circle text-2xl text-blue-500"></i>
                        </div>
                    </div>
                    
                    <div class="metric-card p-6 rounded-xl">
                        <div class="flex items-center justify-between">
                            <div>
                                <p class="text-sm text-gray-600">Completed</p>
                                <p class="text-2xl font-bold text-green-600" id="completed-sessions-count">0</p>
                            </div>
                            <i class="fas fa-check-circle text-2xl text-green-500"></i>
                        </div>
                    </div>
                    
                    <div class="metric-card p-6 rounded-xl">
                        <div class="flex items-center justify-between">
                            <div>
                                <p class="text-sm text-gray-600">Total URLs</p>
                                <p class="text-2xl font-bold text-purple-600" id="total-urls-count">0</p>
                            </div>
                            <i class="fas fa-globe text-2xl text-purple-500"></i>
                        </div>
                    </div>
                    
                    <div class="metric-card p-6 rounded-xl">
                        <div class="flex items-center justify-between">
                            <div>
                                <p class="text-sm text-gray-600">Success Rate</p>
                                <p class="text-2xl font-bold text-indigo-600" id="success-rate">0%</p>
                            </div>
                            <i class="fas fa-chart-line text-2xl text-indigo-500"></i>
                        </div>
                    </div>
                </div>

                <!-- Recent Sessions -->
                <div class="bg-white rounded-xl shadow-lg p-6">
                    <h2 class="text-xl font-semibold text-gray-800 mb-4">
                        <i class="fas fa-clock mr-2 text-blue-600"></i>Recent Sessions
                    </h2>
                    <div id="recent-sessions" class="space-y-4">
                        <div class="text-center text-gray-500 py-8">
                            <i class="fas fa-search text-4xl mb-4 text-gray-300"></i>
                            <p>No crawl sessions yet. Create your first session to get started!</p>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Other tabs will be loaded dynamically -->
            <div id="create-tab" class="tab-content">
                <div class="bg-white rounded-xl shadow-lg p-6">
                    <h2 class="text-xl font-semibold text-gray-800 mb-4">Create New Crawl Session</h2>
                    <p class="text-gray-600">Create crawl session functionality will be loaded here...</p>
                </div>
            </div>

            <div id="sessions-tab" class="tab-content">
                <div class="bg-white rounded-xl shadow-lg p-6">
                    <h2 class="text-xl font-semibold text-gray-800 mb-4">Crawl Sessions</h2>
                    <div id="sessions-list" class="space-y-4">
                        <div class="text-center text-gray-500 py-8">
                            <i class="fas fa-search text-4xl mb-4 text-gray-300"></i>
                            <p>Loading sessions...</p>
                        </div>
                    </div>
                </div>
            </div>

            <div id="proxies-tab" class="tab-content">
                <div class="bg-white rounded-xl shadow-lg p-6">
                    <h2 class="text-xl font-semibold text-gray-800 mb-4">Proxy Management</h2>
                    <div id="proxy-list" class="space-y-4">
                        <div class="text-center text-gray-500 py-8">
                            <i class="fas fa-shield-alt text-4xl mb-4 text-gray-300"></i>
                            <p>Loading proxy information...</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <!-- Enhanced JavaScript -->
        <script src="/static/enhanced-app.js"></script>
    </body>
    </html>
  `)
})

export default app