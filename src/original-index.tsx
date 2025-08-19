import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { serveStatic } from 'hono/cloudflare-workers'
import { Bindings } from './types/database'
import crawlRoutes from './routes/crawl'
import proxyRoutes from './routes/proxies'

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
    version: '1.0.0'
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
        <title>Crawl4AI Ultimate Pro - Full Stack Edition</title>
        <link href="https://cdn.jsdelivr.net/npm/tailwindcss@2.2.19/dist/tailwind.min.css" rel="stylesheet">
        <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css">
        <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
        <script src="https://unpkg.com/turndown/dist/turndown.js"></script>
        <link href="/static/styles.css" rel="stylesheet">
    </head>
    <body class="bg-gray-50">
        <!-- Header -->
        <div class="glass-effect shadow-lg mb-6 sticky top-0 z-50">
            <div class="container mx-auto px-4 py-4">
                <div class="flex items-center justify-between">
                    <div class="flex items-center space-x-3">
                        <div class="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
                            <i class="fas fa-spider text-white text-lg"></i>
                        </div>
                        <div>
                            <h1 class="text-xl font-bold gradient-text">Crawl4AI Ultimate Pro</h1>
                            <p class="text-sm text-gray-600">Full Stack Edition - Powered by Cloudflare</p>
                        </div>
                    </div>
                    <div class="flex items-center space-x-4">
                        <div class="text-sm text-gray-600">
                            <i class="fas fa-server mr-1"></i>
                            <span id="connection-status">Connected</span>
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
                <button class="tab-btn flex-1 py-2 px-4 rounded-md font-medium transition-all" data-tab="settings">
                    <i class="fas fa-cog mr-2"></i>Settings
                </button>
            </div>
        </div>

        <!-- Tab Content -->
        <div class="container mx-auto px-4">
            <!-- Dashboard Tab -->
            <div id="dashboard-tab" class="tab-content active">
                <div class="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
                    <!-- Quick Stats -->
                    <div class="metric-card p-6 rounded-xl">
                        <div class="flex items-center justify-between">
                            <div>
                                <p class="text-sm text-gray-600">Active Sessions</p>
                                <p class="text-2xl font-bold" id="active-sessions-count">0</p>
                            </div>
                            <i class="fas fa-play-circle text-blue-500 text-2xl"></i>
                        </div>
                    </div>
                    <div class="metric-card p-6 rounded-xl">
                        <div class="flex items-center justify-between">
                            <div>
                                <p class="text-sm text-gray-600">Total URLs Crawled</p>
                                <p class="text-2xl font-bold" id="total-urls-count">0</p>
                            </div>
                            <i class="fas fa-link text-green-500 text-2xl"></i>
                        </div>
                    </div>
                    <div class="metric-card p-6 rounded-xl">
                        <div class="flex items-center justify-between">
                            <div>
                                <p class="text-sm text-gray-600">Active Proxies</p>
                                <p class="text-2xl font-bold" id="active-proxies-count">0</p>
                            </div>
                            <i class="fas fa-shield-alt text-purple-500 text-2xl"></i>
                        </div>
                    </div>
                </div>

                <!-- Recent Sessions -->
                <div class="bg-white rounded-xl shadow-sm p-6">
                    <div class="flex items-center justify-between mb-4">
                        <h3 class="text-lg font-semibold">Recent Crawl Sessions</h3>
                        <button class="btn-primary text-sm" onclick="app.switchTab('create')">
                            <i class="fas fa-plus mr-1"></i>New Session
                        </button>
                    </div>
                    <div id="recent-sessions">
                        <p class="text-gray-500 text-center py-8">Loading recent sessions...</p>
                    </div>
                </div>
            </div>

            <!-- Create Crawl Tab -->
            <div id="create-tab" class="tab-content">
                <div class="bg-white rounded-xl shadow-sm p-6 mb-6">
                    <h2 class="text-xl font-bold mb-6">Create New Crawl Session</h2>
                    
                    <div id="create-form">
                        <!-- Session Info -->
                        <div class="mb-6">
                            <label class="block text-sm font-medium text-gray-700 mb-2">Session Title</label>
                            <input type="text" id="session-title" class="form-input" placeholder="Enter a descriptive title for your crawl session">
                        </div>
                        
                        <div class="mb-6">
                            <label class="block text-sm font-medium text-gray-700 mb-2">Description (Optional)</label>
                            <textarea id="session-description" class="form-input" rows="2" placeholder="Brief description of what you're crawling for"></textarea>
                        </div>

                        <!-- Start Method -->
                        <div class="mb-6">
                            <label class="block text-sm font-medium text-gray-700 mb-3">How would you like to start?</label>
                            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <label class="flex items-center p-4 border-2 border-gray-200 rounded-lg cursor-pointer hover:border-blue-300 transition-colors">
                                    <input type="radio" name="start-method" value="ai" class="mr-3" checked>
                                    <div>
                                        <div class="font-medium">AI Discovery</div>
                                        <div class="text-sm text-gray-600">Let AI find URLs based on your description</div>
                                    </div>
                                </label>
                                <label class="flex items-center p-4 border-2 border-gray-200 rounded-lg cursor-pointer hover:border-blue-300 transition-colors">
                                    <input type="radio" name="start-method" value="manual" class="mr-3">
                                    <div>
                                        <div class="font-medium">Manual URLs</div>
                                        <div class="text-sm text-gray-600">Provide specific URLs to crawl</div>
                                    </div>
                                </label>
                            </div>
                        </div>

                        <!-- AI Discovery Inputs -->
                        <div id="ai-inputs" class="mb-6">
                            <div class="mb-4">
                                <label class="block text-sm font-medium text-gray-700 mb-2">Groq API Key</label>
                                <input type="password" id="groq-api-key" class="form-input" placeholder="Enter your Groq API key">
                                <p class="text-xs text-gray-600 mt-1">Get your free API key from <a href="https://groq.com" target="_blank" class="text-blue-500">groq.com</a></p>
                            </div>
                            <div class="mb-4">
                                <label class="block text-sm font-medium text-gray-700 mb-2">Model</label>
                                <select id="groq-model" class="form-select">
                                    <option value="llama3-70b-8192" selected>LLaMA Scout</option>
                                    <option value="gemma2-9b-it">Maverick</option>
                                    <option value="llama-3.1-70b-versatile">LLaMA 3.1 70B</option>
                                    <option value="llama-3.1-8b-instant">LLaMA 3.1 8B (Fast)</option>
                                    <option value="llama3-8b-8192">LLaMA 3 8B (8k)</option>
                                    <option value="gemma-7b-it">Gemma 7B</option>
                                    <option value="mixtral-8x7b-32768">Mixtral 8x7B</option>
                                    <option value="whisper-large-v3">Whisper V3 (Audio Transcription)</option>
                                </select>
                            </div>
                            <div class="mb-4">
                                <label class="block text-sm font-medium text-gray-700 mb-2">Discovery Prompt</label>
                                <textarea id="ai-prompt" class="form-input" rows="3" placeholder="Describe what you want to find. Example: 'Find news websites about artificial intelligence' or 'E-commerce sites selling electronics'"></textarea>
                            </div>
                            <button type="button" id="discover-urls-btn" class="btn-primary">
                                <i class="fas fa-search mr-2"></i>Discover URLs
                            </button>
                        </div>

                        <!-- AI Discovery Results -->
                        <div id="ai-results" class="mb-6 hidden">
                            <div class="flex items-center justify-between mb-3">
                                <label class="block text-sm font-medium text-gray-700">Discovered URLs</label>
                                <div class="flex space-x-2">
                                    <button type="button" id="select-all-urls" class="text-xs text-blue-600 hover:underline">Select All</button>
                                    <button type="button" id="deselect-all-urls" class="text-xs text-gray-600 hover:underline">Deselect All</button>
                                </div>
                            </div>
                            <div id="discovered-urls-list" class="max-h-64 overflow-y-auto border rounded-lg p-3 space-y-2">
                                <!-- URLs will be populated here -->
                            </div>
                        </div>

                        <!-- Manual URL Inputs -->
                        <div id="manual-inputs" class="mb-6 hidden">
                            <label class="block text-sm font-medium text-gray-700 mb-2">URLs to Crawl</label>
                            <textarea id="manual-urls" class="form-input" rows="6" placeholder="Enter URLs, one per line:
https://example.com/page1
https://example.com/page2"></textarea>
                            <p class="text-xs text-gray-600 mt-1">Enter one URL per line</p>
                        </div>

                        <!-- Configuration Options -->
                        <div class="border-t pt-6 mt-6">
                            <h3 class="text-lg font-semibold mb-4">Configuration Options</h3>
                            
                            <!-- Crawl Strategy -->
                            <div class="mb-6">
                                <label class="block text-sm font-medium text-gray-700 mb-2">Crawl Strategy</label>
                                <select id="crawl-strategy" class="form-select">
                                    <option value="basic">Basic Crawl</option>
                                    <option value="smart" selected>Smart Mode</option>
                                    <option value="magic">Magic Mode (AI Enhanced)</option>
                                    <option value="comprehensive">Comprehensive</option>
                                    <option value="adaptive">Adaptive Crawling</option>
                                    <option value="deep">Deep Discovery</option>
                                </select>
                            </div>

                            <!-- Deep Crawl Options -->
                            <div class="mb-6">
                                <label class="flex items-center mb-3">
                                    <input type="checkbox" id="enable-deep-crawl" class="mr-2">
                                    <span class="font-medium">Enable Deep Crawling</span>
                                </label>
                                <div id="deep-crawl-options" class="hidden pl-6 space-y-4 border-l-2 border-gray-200">
                                    <div class="grid grid-cols-2 gap-4">
                                        <div>
                                            <label class="block text-sm font-medium text-gray-700 mb-1">Max Depth</label>
                                            <input type="number" id="max-depth" class="form-input" value="3" min="1" max="10">
                                        </div>
                                        <div>
                                            <label class="block text-sm font-medium text-gray-700 mb-1">Max URLs</label>
                                            <input type="number" id="max-urls" class="form-input" value="50" min="1" max="1000">
                                        </div>
                                    </div>
                                    <div>
                                        <label class="block text-sm font-medium text-gray-700 mb-1">Domain Strategy</label>
                                        <select id="domain-strategy" class="form-select">
                                            <option value="same-domain" selected>Same Domain</option>
                                            <option value="same-subdomain">Same Subdomain</option>
                                            <option value="whitelist">Whitelist Domains</option>
                                            <option value="any">Any Domain</option>
                                        </select>
                                    </div>
                                    <div id="domain-whitelist-container" class="hidden">
                                        <label class="block text-sm font-medium text-gray-700 mb-1">Allowed Domains (comma-separated)</label>
                                        <input type="text" id="domain-whitelist" class="form-input" placeholder="example.com, subdomain.example.com">
                                    </div>
                                    <div class="space-y-2">
                                        <label class="flex items-center">
                                            <input type="checkbox" id="respect-robots" class="mr-2" checked>
                                            <span class="text-sm">Respect robots.txt</span>
                                        </label>
                                        <label class="flex items-center">
                                            <input type="checkbox" id="parse-sitemaps" class="mr-2" checked>
                                            <span class="text-sm">Parse Sitemaps</span>
                                        </label>
                                        <label class="flex items-center">
                                            <input type="checkbox" id="discover-feeds" class="mr-2">
                                            <span class="text-sm">Discover RSS/Atom Feeds</span>
                                        </label>
                                    </div>
                                    <div class="grid grid-cols-2 gap-4">
                                        <div>
                                            <label class="block text-sm font-medium text-gray-700 mb-1">Include Patterns</label>
                                            <input type="text" id="include-patterns" class="form-input" placeholder="/blog/*, /articles/*, *.html">
                                        </div>
                                        <div>
                                            <label class="block text-sm font-medium text-gray-700 mb-1">Exclude Patterns</label>
                                            <input type="text" id="exclude-patterns" class="form-input" placeholder="/admin/*, /login/*, *.pdf">
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <!-- Pagination Options -->
                            <div class="mb-6">
                                <label class="flex items-center mb-3">
                                    <input type="checkbox" id="enable-pagination" class="mr-2">
                                    <span class="font-medium">Enable Pagination Crawling</span>
                                </label>
                                <div id="pagination-options" class="hidden pl-6 space-y-4 border-l-2 border-gray-200">
                                    <div>
                                        <label class="block text-sm font-medium text-gray-700 mb-1">Detection Strategy</label>
                                        <select id="pagination-strategy" class="form-select">
                                            <option value="auto" selected>Auto-Detect (Smart)</option>
                                            <option value="next-link">"Next" Links</option>
                                            <option value="numbered">Numbered Pages</option>
                                            <option value="infinite-scroll">Infinite Scroll (Experimental)</option>
                                            <option value="custom-selector">Custom CSS Selector</option>
                                        </select>
                                    </div>
                                    <div id="custom-selector-options" class="hidden">
                                        <label class="block text-sm font-medium text-gray-700 mb-1">Next Page CSS Selector</label>
                                        <input type="text" id="next-page-selector" class="form-input" placeholder="a.next, .pagination-next, [rel='next']">
                                    </div>
                                    <div class="grid grid-cols-2 gap-4">
                                        <div>
                                            <label class="block text-sm font-medium text-gray-700 mb-1">Max Pages</label>
                                            <input type="number" id="max-pages" class="form-input" value="10" min="1" max="100">
                                        </div>
                                        <div>
                                            <label class="block text-sm font-medium text-gray-700 mb-1">Page Delay (seconds)</label>
                                            <input type="number" id="page-delay" class="form-input" value="2" min="1" max="30">
                                        </div>
                                    </div>
                                    <label class="flex items-center">
                                        <input type="checkbox" id="deduplicate-paginated" class="mr-2" checked>
                                        <span class="text-sm">Remove Duplicate Content</span>
                                    </label>
                                </div>
                            </div>
                            
                            <!-- Basic Options -->
                            <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div>
                                    <h4 class="font-medium mb-3">Output Options</h4>
                                    <label class="flex items-center mb-3">
                                        <input type="checkbox" id="generate-markdown" class="mr-2" checked>
                                        <span class="font-medium">Generate Markdown</span>
                                    </label>
                                    <label class="flex items-center mb-3">
                                        <input type="checkbox" id="extract-metadata" class="mr-2" checked>
                                        <span class="font-medium">Extract Metadata</span>
                                    </label>
                                    <label class="flex items-center mb-3">
                                        <input type="checkbox" id="extract-links" class="mr-2" checked>
                                        <span class="font-medium">Extract Links</span>
                                    </label>
                                    <label class="flex items-center mb-3">
                                        <input type="checkbox" id="extract-media" class="mr-2">
                                        <span class="font-medium">Extract Media Files</span>
                                    </label>
                                </div>
                                <div>
                                    <h4 class="font-medium mb-3">Content Processing</h4>
                                    <label class="flex items-center mb-3">
                                        <input type="checkbox" id="smart-cleaning" class="mr-2" checked>
                                        <span class="font-medium">Smart Content Cleaning</span>
                                    </label>
                                    <label class="flex items-center mb-3">
                                        <input type="checkbox" id="remove-ads" class="mr-2" checked>
                                        <span class="font-medium">Remove Ads & Trackers</span>
                                    </label>
                                    <label class="flex items-center mb-3">
                                        <input type="checkbox" id="remove-navigation" class="mr-2" checked>
                                        <span class="font-medium">Remove Navigation</span>
                                    </label>
                                    <label class="flex items-center mb-3">
                                        <input type="checkbox" id="enable-ai-extraction" class="mr-2">
                                        <span class="font-medium">Enable AI Extraction</span>
                                    </label>
                                </div>
                            </div>
                        </div>

                        <!-- Submit Button -->
                        <div class="border-t pt-6 mt-6">
                            <button type="button" id="create-session-btn" class="btn-primary">
                                <i class="fas fa-rocket mr-2"></i>Create Crawl Session
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Sessions Tab -->
            <div id="sessions-tab" class="tab-content">
                <div class="bg-white rounded-xl shadow-sm p-6">
                    <div class="flex items-center justify-between mb-6">
                        <h2 class="text-xl font-bold">Crawl Sessions</h2>
                        <button class="btn-primary" onclick="app.loadSessions()">
                            <i class="fas fa-sync mr-2"></i>Refresh
                        </button>
                    </div>
                    <div id="sessions-list">
                        <p class="text-gray-500 text-center py-8">Loading sessions...</p>
                    </div>
                </div>
            </div>

            <!-- Proxies Tab -->
            <div id="proxies-tab" class="tab-content">
                <div class="bg-white rounded-xl shadow-sm p-6">
                    <div class="flex items-center justify-between mb-6">
                        <h2 class="text-xl font-bold">Proxy Management</h2>
                        <div class="flex space-x-2">
                            <button class="btn-secondary" id="test-all-proxies-btn">
                                <i class="fas fa-flask mr-2"></i>Test All
                            </button>
                            <button class="btn-primary" id="add-proxies-btn">
                                <i class="fas fa-plus mr-2"></i>Add Proxies
                            </button>
                        </div>
                    </div>
                    
                    <!-- Proxy Stats -->
                    <div class="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6" id="proxy-stats">
                        <!-- Will be populated by JavaScript -->
                    </div>

                    <!-- Proxy List -->
                    <div id="proxies-list">
                        <p class="text-gray-500 text-center py-8">Loading proxies...</p>
                    </div>
                </div>
            </div>

            <!-- Settings Tab -->
            <div id="settings-tab" class="tab-content">
                <div class="bg-white rounded-xl shadow-sm p-6">
                    <h2 class="text-xl font-bold mb-6">Settings</h2>
                    <div class="space-y-6">
                        <div>
                            <h3 class="text-lg font-semibold mb-3">Application Settings</h3>
                            <div class="space-y-3">
                                <div>
                                    <label class="block text-sm font-medium text-gray-700 mb-1">Default Crawl Delay (ms)</label>
                                    <input type="number" class="form-input" value="1000" min="100" max="10000">
                                </div>
                                <div>
                                    <label class="block text-sm font-medium text-gray-700 mb-1">Max Concurrent Requests</label>
                                    <input type="number" class="form-input" value="5" min="1" max="20">
                                </div>
                            </div>
                        </div>
                        
                        <div>
                            <h3 class="text-lg font-semibold mb-3">API Configuration</h3>
                            <div class="space-y-3">
                                <div>
                                    <label class="block text-sm font-medium text-gray-700 mb-1">Default Groq Model</label>
                                    <select class="form-select" id="default-groq-model">
                                        <option value="llama3-70b-8192" selected>LLaMA Scout</option>
                                        <option value="gemma2-9b-it">Maverick</option>
                                        <option value="llama-3.1-70b-versatile">LLaMA 3.1 70B</option>
                                        <option value="llama-3.1-8b-instant">LLaMA 3.1 8B (Fast)</option>
                                        <option value="llama3-8b-8192">LLaMA 3 8B (8k)</option>
                                        <option value="gemma-7b-it">Gemma 7B</option>
                                        <option value="mixtral-8x7b-32768">Mixtral 8x7B</option>
                                        <option value="whisper-large-v3">Whisper V3 (Audio Transcription)</option>
                                    </select>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <!-- Loading Overlay -->
        <div id="loading-overlay" class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 hidden">
            <div class="bg-white rounded-lg p-6 max-w-sm mx-4">
                <div class="flex items-center space-x-3">
                    <i class="fas fa-spinner fa-spin text-blue-500 text-xl"></i>
                    <span class="text-lg font-medium">Processing...</span>
                </div>
                <p class="text-gray-600 mt-2" id="loading-message">Please wait...</p>
            </div>
        </div>

        <!-- Success/Error Messages -->
        <div id="message-container" class="fixed top-4 right-4 z-50 space-y-2">
            <!-- Messages will be inserted here dynamically -->
        </div>

        <script src="https://cdn.jsdelivr.net/npm/axios@1.6.0/dist/axios.min.js"></script>
        <script src="/static/app.js"></script>
    </body>
    </html>
  `)
})

export default app
