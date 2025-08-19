// Enhanced Crawl4AI Ultimate Pro - Real-time Web Application
class CrawlApp {
    constructor() {
        this.currentTab = 'dashboard';
        this.sessions = [];
        this.proxies = [];
        this.selectedUrls = new Set();
        this.refreshInterval = null;
        this.connectionStatus = 'connecting';
        
        this.init();
    }

    async init() {
        console.log('🚀 Initializing Enhanced Crawl4AI Ultimate Pro...');
        
        // Setup event listeners
        this.setupEventListeners();
        
        // Check API connection
        await this.checkConnection();
        
        // Load initial data
        await this.loadDashboard();
        await this.loadSessions();
        await this.loadProxies();
        
        // Start real-time updates
        this.startRealTimeUpdates();
        
        console.log('✅ Application initialized successfully!');
    }

    setupEventListeners() {
        // Tab navigation
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const tab = e.target.closest('.tab-btn').dataset.tab;
                this.switchTab(tab);
            });
        });

        // Start method radio buttons
        document.querySelectorAll('input[name="start-method"]').forEach(radio => {
            radio.addEventListener('change', this.updateStartMethodUI.bind(this));
        });

        // Deep crawl checkbox
        document.getElementById('enable-deep-crawl')?.addEventListener('change', (e) => {
            document.getElementById('deep-crawl-options').classList.toggle('hidden', !e.target.checked);
        });

        // Pagination checkbox
        document.getElementById('enable-pagination')?.addEventListener('change', (e) => {
            document.getElementById('pagination-options').classList.toggle('hidden', !e.target.checked);
        });

        // Pagination strategy
        document.getElementById('pagination-strategy')?.addEventListener('change', (e) => {
            document.getElementById('custom-selector-options').classList.toggle('hidden', e.target.value !== 'custom-selector');
        });

        // Domain strategy
        document.getElementById('domain-strategy')?.addEventListener('change', (e) => {
            document.getElementById('domain-whitelist-container').classList.toggle('hidden', e.target.value !== 'whitelist');
        });

        // Discover URLs button
        document.getElementById('discover-urls-btn')?.addEventListener('click', this.discoverUrls.bind(this));

        // URL selection buttons
        document.getElementById('select-all-urls')?.addEventListener('click', this.selectAllUrls.bind(this));
        document.getElementById('deselect-all-urls')?.addEventListener('click', this.deselectAllUrls.bind(this));

        // Create session button
        document.getElementById('create-session-btn')?.addEventListener('click', this.createSession.bind(this));

        // Proxy management buttons
        document.getElementById('test-all-proxies-btn')?.addEventListener('click', this.testAllProxies.bind(this));
        document.getElementById('add-proxies-btn')?.addEventListener('click', this.showAddProxiesModal.bind(this));
    }

    async checkConnection() {
        try {
            const response = await fetch('/api/health');
            const data = await response.json();
            
            if (data.status === 'ok') {
                this.connectionStatus = 'connected';
                document.getElementById('connection-status').textContent = 'Connected';
                document.getElementById('connection-status').className = 'text-green-600';
            } else {
                throw new Error('Health check failed');
            }
        } catch (error) {
            this.connectionStatus = 'error';
            document.getElementById('connection-status').textContent = 'Connection Error';
            document.getElementById('connection-status').className = 'text-red-600';
            
            this.showNotification('Connection Error', 'Failed to connect to the API server', 'error');
        }
    }

    switchTab(tabName) {
        // Update tab buttons
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');

        // Update tab content
        document.querySelectorAll('.tab-content').forEach(content => {
            content.classList.remove('active');
        });
        document.getElementById(`${tabName}-tab`).classList.add('active');

        this.currentTab = tabName;

        // Load tab-specific data
        if (tabName === 'dashboard') {
            this.loadDashboard();
        } else if (tabName === 'sessions') {
            this.loadSessions();
        } else if (tabName === 'proxies') {
            this.loadProxies();
        }
    }

    async loadDashboard() {
        try {
            // Load dashboard statistics
            const [sessionsResponse, proxiesResponse] = await Promise.all([
                fetch('/api/crawl/sessions'),
                fetch('/api/proxies')
            ]);

            const sessionsData = await sessionsResponse.json();
            const proxiesData = await proxiesResponse.json();

            this.sessions = sessionsData.sessions || [];
            this.proxies = proxiesData.proxies || [];

            // Update dashboard metrics
            this.updateDashboardMetrics();
            this.updateRecentSessions();
        } catch (error) {
            console.error('Failed to load dashboard:', error);
            this.showNotification('Dashboard Error', 'Failed to load dashboard data', 'error');
        }
    }

    updateDashboardMetrics() {
        const activeSessions = this.sessions.filter(s => s.status === 'running').length;
        const completedSessions = this.sessions.filter(s => s.status === 'completed').length;
        const totalUrls = this.sessions.reduce((sum, s) => sum + (s.urls_discovered || 0), 0);
        const completedUrls = this.sessions.reduce((sum, s) => sum + (s.urls_completed || 0), 0);
        const successRate = totalUrls > 0 ? Math.round((completedUrls / totalUrls) * 100) : 0;

        document.getElementById('active-sessions-count').textContent = activeSessions;
        document.getElementById('completed-sessions-count').textContent = completedSessions;
        document.getElementById('total-urls-count').textContent = totalUrls;
        document.getElementById('success-rate').textContent = `${successRate}%`;
    }

    updateRecentSessions() {
        const recentSessionsContainer = document.getElementById('recent-sessions');
        const recentSessions = this.sessions.slice(0, 5);

        if (recentSessions.length === 0) {
            recentSessionsContainer.innerHTML = `
                <div class="text-center text-gray-500 py-8">
                    <i class="fas fa-search text-4xl mb-4 text-gray-300"></i>
                    <p>No crawl sessions yet. Create your first session to get started!</p>
                </div>
            `;
            return;
        }

        recentSessionsContainer.innerHTML = recentSessions.map(session => `
            <div class="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50 transition-colors">
                <div class="flex-1">
                    <div class="flex items-center space-x-3">
                        <h4 class="font-medium text-gray-900">${session.title}</h4>
                        <span class="status-badge ${session.status}">${session.status}</span>
                    </div>
                    <p class="text-sm text-gray-600 mt-1">${session.description || 'No description'}</p>
                    <div class="flex items-center space-x-4 mt-2 text-xs text-gray-500">
                        <span><i class="fas fa-globe mr-1"></i>${session.urls_discovered || 0} URLs</span>
                        <span><i class="fas fa-check mr-1"></i>${session.urls_completed || 0} completed</span>
                        <span><i class="fas fa-clock mr-1"></i>${this.formatDate(session.created_at)}</span>
                    </div>
                </div>
                <div class="flex items-center space-x-2">
                    ${this.getSessionActionButtons(session)}
                </div>
            </div>
        `).join('');
    }

    updateStartMethodUI() {
        const selectedMethod = document.querySelector('input[name="start-method"]:checked').value;
        
        if (selectedMethod === 'ai') {
            document.getElementById('ai-inputs').style.display = 'block';
            document.getElementById('manual-inputs').style.display = 'none';
        } else {
            document.getElementById('ai-inputs').style.display = 'none';
            document.getElementById('manual-inputs').style.display = 'block';
        }
    }

    async discoverUrls() {
        const btn = document.getElementById('discover-urls-btn');
        const prompt = document.getElementById('ai-prompt').value.trim();
        const apiKey = document.getElementById('groq-api-key').value.trim();
        const model = document.getElementById('ai-model').value;

        if (!prompt || !apiKey) {
            this.showNotification('Missing Information', 'Please provide both an AI prompt and Groq API key', 'warning');
            return;
        }

        btn.disabled = true;
        btn.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i>Discovering...';

        try {
            const response = await fetch('/api/crawl/discover-urls', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ prompt, groq_api_key: apiKey, model })
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Discovery failed');
            }

            this.displayDiscoveredUrls(data.urls);
            this.showNotification('Success', `Discovered ${data.urls.length} URLs!`, 'success');
        } catch (error) {
            console.error('URL discovery failed:', error);
            this.showNotification('Discovery Failed', error.message, 'error');
        } finally {
            btn.disabled = false;
            btn.innerHTML = '<i class="fas fa-search mr-2"></i>Discover URLs';
        }
    }

    displayDiscoveredUrls(urls) {
        const section = document.getElementById('discovered-urls-section');
        const list = document.getElementById('discovered-urls-list');

        this.selectedUrls.clear();
        urls.forEach(url => this.selectedUrls.add(url));

        list.innerHTML = urls.map(url => `
            <label class="flex items-center p-2 border rounded hover:bg-white transition-colors cursor-pointer">
                <input type="checkbox" class="mr-3 discovered-url-checkbox" value="${url}" checked>
                <span class="text-sm font-mono text-gray-700 truncate flex-1">${url}</span>
                <i class="fas fa-external-link-alt text-gray-400 text-xs ml-2"></i>
            </label>
        `).join('');

        // Add event listeners to checkboxes
        list.querySelectorAll('.discovered-url-checkbox').forEach(checkbox => {
            checkbox.addEventListener('change', (e) => {
                if (e.target.checked) {
                    this.selectedUrls.add(e.target.value);
                } else {
                    this.selectedUrls.delete(e.target.value);
                }
            });
        });

        section.classList.remove('hidden');
    }

    selectAllUrls() {
        document.querySelectorAll('.discovered-url-checkbox').forEach(checkbox => {
            checkbox.checked = true;
            this.selectedUrls.add(checkbox.value);
        });
    }

    deselectAllUrls() {
        document.querySelectorAll('.discovered-url-checkbox').forEach(checkbox => {
            checkbox.checked = false;
            this.selectedUrls.delete(checkbox.value);
        });
    }

    async createSession() {
        const btn = document.getElementById('create-session-btn');
        const startMethod = document.querySelector('input[name="start-method"]:checked').value;

        // Collect form data
        const formData = {
            title: document.getElementById('session-title').value.trim(),
            description: document.getElementById('session-description').value.trim(),
            start_method: startMethod,
            
            // URLs
            urls: startMethod === 'manual' 
                ? document.getElementById('manual-urls').value.split('\n').filter(url => url.trim())
                : Array.from(this.selectedUrls),
            
            // AI settings
            ai_prompt: startMethod === 'ai' ? document.getElementById('ai-prompt').value.trim() : null,
            groq_model: document.getElementById('ai-model').value,
            
            // Crawl strategy
            crawl_strategy: document.getElementById('crawl-strategy').value,
            crawl_delay: parseInt(document.getElementById('crawl-delay').value) || 1000,
            delay_jitter: parseInt(document.getElementById('delay-jitter').value) || 500,
            max_concurrent: parseInt(document.getElementById('max-concurrent').value) || 5,
            
            // Deep crawl settings
            enable_deep_crawl: document.getElementById('enable-deep-crawl').checked,
            max_depth: parseInt(document.getElementById('max-depth').value) || 3,
            max_urls: parseInt(document.getElementById('max-urls').value) || 50,
            domain_strategy: document.getElementById('domain-strategy').value,
            domain_whitelist: document.getElementById('domain-strategy').value === 'whitelist' 
                ? document.getElementById('domain-whitelist').value.split(',').map(d => d.trim())
                : null,
            
            // Pagination settings
            enable_pagination: document.getElementById('enable-pagination').checked,
            pagination_strategy: document.getElementById('pagination-strategy').value,
            pagination_selector: document.getElementById('pagination-strategy').value === 'custom-selector' 
                ? document.getElementById('pagination-selector').value.trim() 
                : null,
            max_pages: parseInt(document.getElementById('max-pages').value) || 10,
            
            // Output options
            generate_markdown: document.getElementById('generate-markdown').checked,
            extract_metadata: document.getElementById('extract-metadata').checked,
            extract_links: document.getElementById('extract-links').checked,
            extract_media: document.getElementById('extract-media').checked,
            
            // Content processing
            smart_cleaning: document.getElementById('smart-cleaning').checked,
            remove_ads: document.getElementById('remove-ads').checked,
            remove_navigation: document.getElementById('remove-navigation').checked
        };

        // Validation
        if (!formData.title) {
            this.showNotification('Validation Error', 'Please provide a session title', 'warning');
            return;
        }

        if (!formData.urls || formData.urls.length === 0) {
            this.showNotification('Validation Error', 'Please provide URLs to crawl', 'warning');
            return;
        }

        btn.disabled = true;
        btn.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i>Creating...';

        try {
            const response = await fetch('/api/crawl/sessions', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData)
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Session creation failed');
            }

            this.showNotification('Success', 'Crawl session created successfully!', 'success');

            // Auto-start if requested
            if (document.getElementById('auto-start-session').checked) {
                await this.startSession(data.id);
            }

            // Reset form and switch to sessions tab
            this.resetCreateForm();
            this.switchTab('sessions');
        } catch (error) {
            console.error('Session creation failed:', error);
            this.showNotification('Creation Failed', error.message, 'error');
        } finally {
            btn.disabled = false;
            btn.innerHTML = '<i class="fas fa-plus mr-2"></i>Create Session';
        }
    }

    async loadSessions() {
        try {
            const response = await fetch('/api/crawl/sessions');
            const data = await response.json();
            
            this.sessions = data.sessions || [];
            this.updateSessionsList();
        } catch (error) {
            console.error('Failed to load sessions:', error);
            this.showNotification('Sessions Error', 'Failed to load crawl sessions', 'error');
        }
    }

    updateSessionsList() {
        const container = document.getElementById('sessions-list');
        
        if (this.sessions.length === 0) {
            container.innerHTML = `
                <div class="text-center text-gray-500 py-8">
                    <i class="fas fa-search text-4xl mb-4 text-gray-300"></i>
                    <p>No crawl sessions found. Create your first session to get started!</p>
                    <button onclick="app.switchTab('create')" class="btn-primary mt-4">
                        <i class="fas fa-plus mr-2"></i>Create First Session
                    </button>
                </div>
            `;
            return;
        }

        container.innerHTML = this.sessions.map(session => `
            <div class="border rounded-lg p-6 hover:shadow-md transition-shadow">
                <div class="flex items-start justify-between">
                    <div class="flex-1">
                        <div class="flex items-center space-x-3 mb-2">
                            <h3 class="text-lg font-semibold text-gray-900">${session.title}</h3>
                            <span class="status-badge ${session.status}">${session.status}</span>
                        </div>
                        <p class="text-gray-600 mb-3">${session.description || 'No description provided'}</p>
                        
                        <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                            <div class="text-center">
                                <div class="text-2xl font-bold text-blue-600">${session.urls_discovered || 0}</div>
                                <div class="text-xs text-gray-500">Discovered</div>
                            </div>
                            <div class="text-center">
                                <div class="text-2xl font-bold text-green-600">${session.urls_completed || 0}</div>
                                <div class="text-xs text-gray-500">Completed</div>
                            </div>
                            <div class="text-center">
                                <div class="text-2xl font-bold text-red-600">${session.urls_failed || 0}</div>
                                <div class="text-xs text-gray-500">Failed</div>
                            </div>
                            <div class="text-center">
                                <div class="text-2xl font-bold text-yellow-600">${session.urls_blocked || 0}</div>
                                <div class="text-xs text-gray-500">Blocked</div>
                            </div>
                        </div>

                        <div class="flex items-center space-x-4 text-xs text-gray-500">
                            <span><i class="fas fa-calendar mr-1"></i>Created ${this.formatDate(session.created_at)}</span>
                            <span><i class="fas fa-clock mr-1"></i>Updated ${this.formatDate(session.updated_at)}</span>
                        </div>
                    </div>
                    
                    <div class="flex items-center space-x-2 ml-4">
                        ${this.getSessionActionButtons(session)}
                    </div>
                </div>
            </div>
        `).join('');
    }

    getSessionActionButtons(session) {
        let buttons = [];

        if (session.status === 'pending' || session.status === 'stopped') {
            buttons.push(`
                <button onclick="app.startSession(${session.id})" class="btn-success text-sm">
                    <i class="fas fa-play mr-1"></i>Start
                </button>
            `);
        }

        if (session.status === 'running') {
            buttons.push(`
                <button onclick="app.stopSession(${session.id})" class="btn-danger text-sm">
                    <i class="fas fa-stop mr-1"></i>Stop
                </button>
            `);
        }

        buttons.push(`
            <button onclick="app.viewSession(${session.id})" class="btn-secondary text-sm">
                <i class="fas fa-eye mr-1"></i>View
            </button>
        `);

        if (session.status !== 'running') {
            buttons.push(`
                <button onclick="app.deleteSession(${session.id})" class="btn-danger text-sm">
                    <i class="fas fa-trash mr-1"></i>Delete
                </button>
            `);
        }

        return buttons.join('');
    }

    async startSession(sessionId) {
        try {
            const response = await fetch(`/api/crawl/sessions/${sessionId}/start`, {
                method: 'POST'
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Failed to start session');
            }

            this.showNotification('Session Started', 'Crawling session has been started successfully', 'success');
            this.loadSessions();
            this.loadDashboard();
        } catch (error) {
            console.error('Failed to start session:', error);
            this.showNotification('Start Failed', error.message, 'error');
        }
    }

    async stopSession(sessionId) {
        try {
            const response = await fetch(`/api/crawl/sessions/${sessionId}/stop`, {
                method: 'POST'
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Failed to stop session');
            }

            this.showNotification('Session Stopped', 'Crawling session has been stopped', 'info');
            this.loadSessions();
            this.loadDashboard();
        } catch (error) {
            console.error('Failed to stop session:', error);
            this.showNotification('Stop Failed', error.message, 'error');
        }
    }

    async deleteSession(sessionId) {
        if (!confirm('Are you sure you want to delete this crawl session? This action cannot be undone.')) {
            return;
        }

        try {
            const response = await fetch(`/api/crawl/sessions/${sessionId}`, {
                method: 'DELETE'
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Failed to delete session');
            }

            this.showNotification('Session Deleted', 'Crawl session has been deleted successfully', 'success');
            this.loadSessions();
            this.loadDashboard();
        } catch (error) {
            console.error('Failed to delete session:', error);
            this.showNotification('Delete Failed', error.message, 'error');
        }
    }

    async viewSession(sessionId) {
        // Implement session detail view
        console.log('Viewing session:', sessionId);
        // For now, just show a placeholder
        this.showNotification('Feature Coming Soon', 'Detailed session view is coming soon!', 'info');
    }

    async loadProxies() {
        try {
            const response = await fetch('/api/proxies');
            const data = await response.json();
            
            this.proxies = data.proxies || [];
            this.updateProxiesList();
        } catch (error) {
            console.error('Failed to load proxies:', error);
            this.showNotification('Proxies Error', 'Failed to load proxy information', 'error');
        }
    }

    updateProxiesList() {
        const container = document.getElementById('proxy-list');
        
        if (this.proxies.length === 0) {
            container.innerHTML = `
                <div class="text-center text-gray-500 py-8">
                    <i class="fas fa-shield-alt text-4xl mb-4 text-gray-300"></i>
                    <p>No proxies configured. Add some proxies to improve crawling reliability.</p>
                    <button onclick="app.showAddProxiesModal()" class="btn-primary mt-4">
                        <i class="fas fa-plus mr-2"></i>Add First Proxy
                    </button>
                </div>
            `;
            return;
        }

        // Group proxies by status for better organization
        const activeProxies = this.proxies.filter(p => p.status === 'active');
        const inactiveProxies = this.proxies.filter(p => p.status === 'inactive');
        const bannedProxies = this.proxies.filter(p => p.status === 'banned');

        container.innerHTML = `
            ${activeProxies.length > 0 ? `
                <div class="mb-6">
                    <h3 class="text-lg font-semibold text-green-800 mb-3">
                        <i class="fas fa-check-circle mr-2"></i>Active Proxies (${activeProxies.length})
                    </h3>
                    <div class="grid gap-4">
                        ${activeProxies.map(proxy => this.renderProxyCard(proxy)).join('')}
                    </div>
                </div>
            ` : ''}
            
            ${inactiveProxies.length > 0 ? `
                <div class="mb-6">
                    <h3 class="text-lg font-semibold text-gray-800 mb-3">
                        <i class="fas fa-pause-circle mr-2"></i>Inactive Proxies (${inactiveProxies.length})
                    </h3>
                    <div class="grid gap-4">
                        ${inactiveProxies.map(proxy => this.renderProxyCard(proxy)).join('')}
                    </div>
                </div>
            ` : ''}
            
            ${bannedProxies.length > 0 ? `
                <div class="mb-6">
                    <h3 class="text-lg font-semibold text-red-800 mb-3">
                        <i class="fas fa-ban mr-2"></i>Banned Proxies (${bannedProxies.length})
                    </h3>
                    <div class="grid gap-4">
                        ${bannedProxies.map(proxy => this.renderProxyCard(proxy)).join('')}
                    </div>
                </div>
            ` : ''}
        `;
    }

    renderProxyCard(proxy) {
        const statusColor = {
            'active': 'text-green-600 bg-green-100',
            'inactive': 'text-gray-600 bg-gray-100',
            'banned': 'text-red-600 bg-red-100'
        };

        return `
            <div class="border rounded-lg p-4 hover:shadow-md transition-shadow">
                <div class="flex items-center justify-between">
                    <div class="flex-1">
                        <div class="flex items-center space-x-3 mb-2">
                            <span class="font-medium text-gray-900">${proxy.name}</span>
                            <span class="px-2 py-1 text-xs rounded-full ${statusColor[proxy.status]}">${proxy.status}</span>
                            <span class="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded">${proxy.type}</span>
                        </div>
                        <p class="text-sm font-mono text-gray-600 mb-2">${proxy.url}</p>
                        <div class="flex items-center space-x-4 text-xs text-gray-500">
                            <span><i class="fas fa-tachometer-alt mr-1"></i>Score: ${proxy.score || 0}</span>
                            <span><i class="fas fa-clock mr-1"></i>Latency: ${proxy.latency || 'N/A'}ms</span>
                            <span><i class="fas fa-exclamation-triangle mr-1"></i>Errors: ${proxy.error_count || 0}</span>
                            <span><i class="fas fa-calendar mr-1"></i>Last tested: ${proxy.last_tested_at ? this.formatDate(proxy.last_tested_at) : 'Never'}</span>
                        </div>
                    </div>
                    <div class="flex items-center space-x-2 ml-4">
                        <button onclick="app.testProxy(${proxy.id})" class="btn-secondary text-sm">
                            <i class="fas fa-flask mr-1"></i>Test
                        </button>
                        <button onclick="app.deleteProxy(${proxy.id})" class="btn-danger text-sm">
                            <i class="fas fa-trash mr-1"></i>Delete
                        </button>
                    </div>
                </div>
            </div>
        `;
    }

    async testAllProxies() {
        const btn = document.getElementById('test-all-proxies-btn');
        
        btn.disabled = true;
        btn.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i>Testing...';

        try {
            const response = await fetch('/api/proxies/test', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ test_all: true })
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Proxy testing failed');
            }

            this.showNotification('Proxy Test Complete', 
                `Tested ${data.summary.tested} proxies. ${data.summary.successful} successful, ${data.summary.failed} failed.`, 
                'success'
            );
            
            this.loadProxies();
        } catch (error) {
            console.error('Proxy testing failed:', error);
            this.showNotification('Test Failed', error.message, 'error');
        } finally {
            btn.disabled = false;
            btn.innerHTML = '<i class="fas fa-flask mr-2"></i>Test All';
        }
    }

    async testProxy(proxyId) {
        try {
            const response = await fetch('/api/proxies/test', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ proxy_ids: [proxyId] })
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Proxy test failed');
            }

            const result = data.results[0];
            const message = result.success 
                ? `Proxy test successful! Latency: ${result.latency}ms`
                : `Proxy test failed: ${result.error_message}`;

            this.showNotification('Proxy Test Result', message, result.success ? 'success' : 'error');
            this.loadProxies();
        } catch (error) {
            console.error('Proxy test failed:', error);
            this.showNotification('Test Failed', error.message, 'error');
        }
    }

    async deleteProxy(proxyId) {
        if (!confirm('Are you sure you want to delete this proxy?')) {
            return;
        }

        try {
            const response = await fetch('/api/proxies/batch', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    action: 'delete',
                    proxy_ids: [proxyId]
                })
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Failed to delete proxy');
            }

            this.showNotification('Proxy Deleted', 'Proxy has been deleted successfully', 'success');
            this.loadProxies();
        } catch (error) {
            console.error('Failed to delete proxy:', error);
            this.showNotification('Delete Failed', error.message, 'error');
        }
    }

    showAddProxiesModal() {
        // Simple implementation - could be enhanced with a proper modal
        const proxies = prompt('Enter proxy URLs (one per line):\n\nExamples:\nhttp://proxy1.com:8080\nsocks4://proxy2.com:1080');
        
        if (proxies) {
            this.addCustomProxies(proxies.split('\n').filter(p => p.trim()));
        }
    }

    async addCustomProxies(proxyList) {
        try {
            const response = await fetch('/api/proxies/custom', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    proxies: proxyList,
                    source: 'manual'
                })
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Failed to add proxies');
            }

            this.showNotification('Proxies Added', `Successfully added ${data.count} proxies`, 'success');
            this.loadProxies();
        } catch (error) {
            console.error('Failed to add proxies:', error);
            this.showNotification('Add Failed', error.message, 'error');
        }
    }

    startRealTimeUpdates() {
        // Update every 5 seconds when on dashboard or sessions tab
        this.refreshInterval = setInterval(async () => {
            if (this.currentTab === 'dashboard') {
                await this.loadDashboard();
            } else if (this.currentTab === 'sessions') {
                await this.loadSessions();
            }
        }, 5000);
    }

    resetCreateForm() {
        document.getElementById('create-session-form').reset();
        document.getElementById('discovered-urls-section').classList.add('hidden');
        document.getElementById('deep-crawl-options').classList.add('hidden');
        document.getElementById('pagination-options').classList.add('hidden');
        document.getElementById('custom-selector-options').classList.add('hidden');
        document.getElementById('domain-whitelist-container').classList.add('hidden');
        this.selectedUrls.clear();
        this.updateStartMethodUI();
    }

    showNotification(title, message, type = 'info') {
        // Simple notification system - could be enhanced with a proper toast library
        const colors = {
            success: 'bg-green-500',
            error: 'bg-red-500',
            warning: 'bg-yellow-500',
            info: 'bg-blue-500'
        };

        const notification = document.createElement('div');
        notification.className = `fixed top-4 right-4 ${colors[type]} text-white px-6 py-4 rounded-lg shadow-lg z-50 max-w-sm`;
        notification.innerHTML = `
            <div class="flex items-start">
                <div class="flex-1">
                    <h4 class="font-semibold">${title}</h4>
                    <p class="text-sm mt-1">${message}</p>
                </div>
                <button class="ml-4 text-white hover:text-gray-200" onclick="this.parentElement.parentElement.remove()">
                    <i class="fas fa-times"></i>
                </button>
            </div>
        `;

        document.body.appendChild(notification);

        // Auto-remove after 5 seconds
        setTimeout(() => {
            if (notification.parentElement) {
                notification.remove();
            }
        }, 5000);
    }

    formatDate(dateString) {
        if (!dateString) return 'N/A';
        
        try {
            const date = new Date(dateString);
            const now = new Date();
            const diffMs = now - date;
            const diffMins = Math.floor(diffMs / (1000 * 60));
            const diffHours = Math.floor(diffMins / 60);
            const diffDays = Math.floor(diffHours / 24);

            if (diffMins < 1) return 'Just now';
            if (diffMins < 60) return `${diffMins}m ago`;
            if (diffHours < 24) return `${diffHours}h ago`;
            if (diffDays < 7) return `${diffDays}d ago`;
            
            return date.toLocaleDateString();
        } catch (e) {
            return 'Invalid date';
        }
    }
}

// Initialize the application
const app = new CrawlApp();

// Make app globally available for onclick handlers
window.app = app;