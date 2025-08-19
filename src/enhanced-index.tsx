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
// Import enhanced routes
import enhancedProxyRoutes from './routes/enhanced-proxies'

app.route('/api/proxies', enhancedProxyRoutes)

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

            <!-- Create Crawl Tab -->
            <div id="create-tab" class="tab-content">
                <form id="create-session-form" class="bg-white rounded-xl shadow-lg p-6">
                    <h2 class="text-xl font-semibold text-gray-800 mb-6">
                        <i class="fas fa-plus-circle mr-2 text-green-600"></i>Create New Crawl Session
                    </h2>
                    
                    <!-- Basic Info -->
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                        <div>
                            <label class="block text-sm font-medium text-gray-700 mb-2">Session Title *</label>
                            <input type="text" id="session-title" class="form-input" placeholder="e.g., News Sites Crawl" required>
                        </div>
                        <div>
                            <label class="block text-sm font-medium text-gray-700 mb-2">Description</label>
                            <input type="text" id="session-description" class="form-input" placeholder="Brief description of this crawl">
                        </div>
                    </div>

                    <!-- Start Method -->
                    <div class="mb-6">
                        <label class="block text-sm font-medium text-gray-700 mb-3">How would you like to discover URLs?</label>
                        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <label class="flex items-center p-4 border-2 rounded-lg cursor-pointer hover:bg-blue-50 has-[:checked]:bg-blue-50 has-[:checked]:border-blue-500">
                                <input type="radio" name="start-method" value="ai" class="mr-3" checked>
                                <div>
                                    <p class="font-medium text-gray-900">AI-Powered Discovery</p>
                                    <p class="text-sm text-gray-600">Describe what you want to crawl and let AI find the URLs</p>
                                </div>
                            </label>
                            <label class="flex items-center p-4 border-2 rounded-lg cursor-pointer hover:bg-blue-50 has-[:checked]:bg-blue-50 has-[:checked]:border-blue-500">
                                <input type="radio" name="start-method" value="manual" class="mr-3">
                                <div>
                                    <p class="font-medium text-gray-900">Manual URL List</p>
                                    <p class="text-sm text-gray-600">Provide your own list of URLs to crawl</p>
                                </div>
                            </label>
                        </div>
                    </div>

                    <!-- AI Discovery Inputs -->
                    <div id="ai-inputs" class="mb-6 p-4 bg-blue-50 rounded-lg">
                        <h3 class="font-semibold text-gray-800 mb-3">AI Discovery Settings</h3>
                        <div class="space-y-4">
                            <div>
                                <label class="block text-sm font-medium text-gray-700 mb-2">What would you like to crawl? *</label>
                                <textarea id="ai-prompt" class="form-input" rows="3" placeholder="e.g., 'Top 10 technology news websites' or 'E-commerce sites selling electronics'"></textarea>
                            </div>
                            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label class="block text-sm font-medium text-gray-700 mb-2">Groq API Key *</label>
                                    <input type="password" id="groq-api-key" class="form-input" placeholder="gsk_...">
                                </div>
                                <div>
                                    <label class="block text-sm font-medium text-gray-700 mb-2">AI Model</label>
                                    <select id="ai-model" class="form-select">
                                        <option value="llama3-70b-8192">LLaMA 3 70B (Recommended)</option>
                                        <option value="gemma2-9b-it">Gemma 2 9B</option>
                                        <option value="mixtral-8x7b-32768">Mixtral 8x7B</option>
                                    </select>
                                </div>
                            </div>
                            <button type="button" id="discover-urls-btn" class="btn-primary">
                                <i class="fas fa-search mr-2"></i>Discover URLs
                            </button>
                        </div>
                    </div>

                    <!-- Manual URL Inputs -->
                    <div id="manual-inputs" class="mb-6 p-4 bg-gray-50 rounded-lg" style="display: none;">
                        <h3 class="font-semibold text-gray-800 mb-3">Manual URL List</h3>
                        <div>
                            <label class="block text-sm font-medium text-gray-700 mb-2">URLs to Crawl (one per line) *</label>
                            <textarea id="manual-urls" class="form-input" rows="8" placeholder="https://example.com
https://another-site.com/page
https://third-site.org/articles"></textarea>
                        </div>
                    </div>

                    <!-- Discovered URLs (Hidden by default) -->
                    <div id="discovered-urls-section" class="mb-6 p-4 bg-green-50 rounded-lg hidden">
                        <div class="flex items-center justify-between mb-3">
                            <h3 class="font-semibold text-gray-800">Discovered URLs</h3>
                            <div class="space-x-2">
                                <button type="button" id="select-all-urls" class="btn-secondary text-sm">Select All</button>
                                <button type="button" id="deselect-all-urls" class="btn-secondary text-sm">Deselect All</button>
                            </div>
                        </div>
                        <div id="discovered-urls-list" class="max-h-64 overflow-y-auto space-y-2">
                            <!-- URLs will be populated here -->
                        </div>
                    </div>

                    <!-- Crawl Configuration -->
                    <div class="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
                        <!-- Left Column -->
                        <div class="space-y-6">
                            <!-- Basic Settings -->
                            <div>
                                <h3 class="font-semibold text-gray-800 mb-3">Crawl Strategy</h3>
                                <div class="space-y-3">
                                    <div>
                                        <label class="block text-sm font-medium text-gray-700 mb-2">Strategy</label>
                                        <select id="crawl-strategy" class="form-select">
                                            <option value="basic">Basic Crawl</option>
                                            <option value="smart" selected>Smart Mode</option>
                                            <option value="comprehensive">Comprehensive</option>
                                            <option value="adaptive">Adaptive</option>
                                        </select>
                                    </div>
                                    <div class="grid grid-cols-2 gap-3">
                                        <div>
                                            <label class="block text-sm font-medium text-gray-700 mb-2">Crawl Delay (ms)</label>
                                            <input type="number" id="crawl-delay" class="form-input" value="1000" min="100">
                                        </div>
                                        <div>
                                            <label class="block text-sm font-medium text-gray-700 mb-2">Delay Jitter (ms)</label>
                                            <input type="number" id="delay-jitter" class="form-input" value="500" min="0">
                                        </div>
                                    </div>
                                    <div>
                                        <label class="block text-sm font-medium text-gray-700 mb-2">Max Concurrent Requests</label>
                                        <input type="number" id="max-concurrent" class="form-input" value="5" min="1" max="10">
                                    </div>
                                </div>
                            </div>

                            <!-- Deep Crawl Settings -->
                            <div>
                                <div class="flex items-center mb-3">
                                    <input type="checkbox" id="enable-deep-crawl" class="mr-2">
                                    <h3 class="font-semibold text-gray-800">Deep Crawling</h3>
                                </div>
                                <div id="deep-crawl-options" class="hidden space-y-3 pl-4 border-l-2 border-blue-200">
                                    <div class="grid grid-cols-2 gap-3">
                                        <div>
                                            <label class="block text-sm font-medium text-gray-700 mb-1">Max Depth</label>
                                            <input type="number" id="max-depth" class="form-input" value="3" min="1">
                                        </div>
                                        <div>
                                            <label class="block text-sm font-medium text-gray-700 mb-1">Max URLs</label>
                                            <input type="number" id="max-urls" class="form-input" value="50" min="1">
                                        </div>
                                    </div>
                                    <div>
                                        <label class="block text-sm font-medium text-gray-700 mb-1">Domain Strategy</label>
                                        <select id="domain-strategy" class="form-select">
                                            <option value="same-domain" selected>Same Domain Only</option>
                                            <option value="same-subdomain">Same Subdomain</option>
                                            <option value="whitelist">Whitelist Domains</option>
                                            <option value="any">Any Domain</option>
                                        </select>
                                    </div>
                                    <div id="domain-whitelist-container" class="hidden">
                                        <label class="block text-sm font-medium text-gray-700 mb-1">Allowed Domains</label>
                                        <input type="text" id="domain-whitelist" class="form-input" placeholder="example.com, subdomain.example.com">
                                    </div>
                                </div>
                            </div>
                        </div>

                        <!-- Right Column -->
                        <div class="space-y-6">
                            <!-- Pagination Settings -->
                            <div>
                                <div class="flex items-center mb-3">
                                    <input type="checkbox" id="enable-pagination" class="mr-2">
                                    <h3 class="font-semibold text-gray-800">Pagination Crawling</h3>
                                </div>
                                <div id="pagination-options" class="hidden space-y-3 pl-4 border-l-2 border-green-200">
                                    <div>
                                        <label class="block text-sm font-medium text-gray-700 mb-1">Strategy</label>
                                        <select id="pagination-strategy" class="form-select">
                                            <option value="auto" selected>Auto-Detect</option>
                                            <option value="next-link">Next Links</option>
                                            <option value="numbered">Numbered Pages</option>
                                            <option value="custom-selector">Custom Selector</option>
                                        </select>
                                    </div>
                                    <div id="custom-selector-options" class="hidden">
                                        <label class="block text-sm font-medium text-gray-700 mb-1">Next Page CSS Selector</label>
                                        <input type="text" id="pagination-selector" class="form-input" placeholder="a.next, .pagination-next">
                                    </div>
                                    <div>
                                        <label class="block text-sm font-medium text-gray-700 mb-1">Max Pages</label>
                                        <input type="number" id="max-pages" class="form-input" value="10" min="1">
                                    </div>
                                </div>
                            </div>

                            <!-- Output Options -->
                            <div>
                                <h3 class="font-semibold text-gray-800 mb-3">Output Options</h3>
                                <div class="space-y-2">
                                    <label class="flex items-center">
                                        <input type="checkbox" id="generate-markdown" class="mr-2" checked>
                                        <span class="text-sm">Generate Markdown</span>
                                    </label>
                                    <label class="flex items-center">
                                        <input type="checkbox" id="extract-metadata" class="mr-2" checked>
                                        <span class="text-sm">Extract Metadata</span>
                                    </label>
                                    <label class="flex items-center">
                                        <input type="checkbox" id="extract-links" class="mr-2" checked>
                                        <span class="text-sm">Extract Links</span>
                                    </label>
                                    <label class="flex items-center">
                                        <input type="checkbox" id="extract-media" class="mr-2">
                                        <span class="text-sm">Extract Media Files</span>
                                    </label>
                                </div>
                            </div>

                            <!-- Content Processing -->
                            <div>
                                <h3 class="font-semibold text-gray-800 mb-3">Content Processing</h3>
                                <div class="space-y-2">
                                    <label class="flex items-center">
                                        <input type="checkbox" id="smart-cleaning" class="mr-2" checked>
                                        <span class="text-sm">Smart Content Cleaning</span>
                                    </label>
                                    <label class="flex items-center">
                                        <input type="checkbox" id="remove-ads" class="mr-2" checked>
                                        <span class="text-sm">Remove Ads & Trackers</span>
                                    </label>
                                    <label class="flex items-center">
                                        <input type="checkbox" id="remove-navigation" class="mr-2" checked>
                                        <span class="text-sm">Remove Navigation</span>
                                    </label>
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- Action Buttons -->
                    <div class="flex items-center justify-between pt-6 border-t">
                        <label class="flex items-center">
                            <input type="checkbox" id="auto-start-session" class="mr-2">
                            <span class="text-sm text-gray-600">Start crawling immediately after creation</span>
                        </label>
                        <div class="space-x-3">
                            <button type="button" onclick="app.resetCreateForm()" class="btn-secondary">
                                <i class="fas fa-undo mr-2"></i>Reset Form
                            </button>
                            <button type="button" id="create-session-btn" class="btn-primary">
                                <i class="fas fa-plus mr-2"></i>Create Session
                            </button>
                        </div>
                    </div>
                </form>
            </div>

            <!-- Sessions Tab -->
            <div id="sessions-tab" class="tab-content">
                <div class="bg-white rounded-xl shadow-lg p-6">
                    <div class="flex items-center justify-between mb-6">
                        <h2 class="text-xl font-semibold text-gray-800">
                            <i class="fas fa-list mr-2 text-blue-600"></i>Crawl Sessions
                        </h2>
                        <button onclick="app.switchTab('create')" class="btn-primary">
                            <i class="fas fa-plus mr-2"></i>New Session
                        </button>
                    </div>
                    <div id="sessions-list" class="space-y-4">
                        <div class="text-center text-gray-500 py-8">
                            <i class="fas fa-search text-4xl mb-4 text-gray-300"></i>
                            <p>Loading sessions...</p>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Proxies Tab -->
            <div id="proxies-tab" class="tab-content">
                <div class="bg-white rounded-xl shadow-lg p-6">
                    <div class="flex items-center justify-between mb-6">
                        <h2 class="text-xl font-semibold text-gray-800">
                            <i class="fas fa-shield-alt mr-2 text-yellow-600"></i>Proxy Management
                        </h2>
                        <div class="space-x-2">
                            <button id="test-all-proxies-btn" class="btn-secondary">
                                <i class="fas fa-flask mr-2"></i>Test All
                            </button>
                            <button id="add-proxies-btn" class="btn-primary">
                                <i class="fas fa-plus mr-2"></i>Add Proxies
                            </button>
                        </div>
                    </div>
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