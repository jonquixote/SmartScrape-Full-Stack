/**
 * Crawl4AI Ultimate Pro - Enhanced Full Stack Edition
 * Frontend JavaScript Application with Real Crawling & Tree Visualization
 */

class Crawl4AIApp {
    constructor() {
        this.apiBaseUrl = '/api';
        this.currentTab = 'dashboard';
        this.refreshInterval = null;
        this.progressInterval = null;
        this.sessions = new Map();
        this.proxies = new Map();
        this.activePolling = new Set();
        this.treeChart = null;
        
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.loadDashboard();
        this.checkApiConnection();
        
        // Auto-refresh dashboard every 5 seconds
        this.refreshInterval = setInterval(() => {
            if (this.currentTab === 'dashboard') {
                this.loadDashboard();
            }
        }, 5000);
    }

    setupEventListeners() {
        // Tab navigation
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                this.switchTab(e.target.dataset.tab);
            });
        });

        // Start method toggle
        document.querySelectorAll('input[name="start-method"]').forEach(radio => {
            radio.addEventListener('change', (e) => {
                document.getElementById('ai-inputs').style.display = e.target.value === 'ai' ? 'block' : 'none';
                document.getElementById('manual-inputs').style.display = e.target.value === 'manual' ? 'block' : 'none';
            });
        });

        // Button event listeners
        document.getElementById('discover-urls-btn')?.addEventListener('click', () => this.discoverUrls());
        document.getElementById('create-session-btn')?.addEventListener('click', () => this.createSession());
        document.getElementById('test-all-proxies-btn')?.addEventListener('click', () => this.testAllProxies());
        document.getElementById('add-proxies-btn')?.addEventListener('click', () => this.showAddProxiesModal());
        
        // AI discovery URL selection
        document.getElementById('select-all-urls')?.addEventListener('click', () => this.selectAllUrls(true));
        document.getElementById('deselect-all-urls')?.addEventListener('click', () => this.selectAllUrls(false));
        
        // Deep crawl and pagination toggles
        document.getElementById('enable-deep-crawl')?.addEventListener('change', (e) => {
            document.getElementById('deep-crawl-options').classList.toggle('hidden', !e.target.checked);
        });
        
        document.getElementById('enable-pagination')?.addEventListener('change', (e) => {
            document.getElementById('pagination-options').classList.toggle('hidden', !e.target.checked);
        });
        
        document.getElementById('domain-strategy')?.addEventListener('change', (e) => {
            document.getElementById('domain-whitelist-container').classList.toggle('hidden', e.target.value !== 'whitelist');
        });
        
        document.getElementById('pagination-strategy')?.addEventListener('change', (e) => {
            document.getElementById('custom-selector-options').classList.toggle('hidden', e.target.value !== 'custom-selector');
        });
    }

    async checkApiConnection() {
        try {
            const response = await fetch(`${this.apiBaseUrl}/health`);
            const data = await response.json();
            
            if (data.status === 'ok') {
                document.getElementById('connection-status').innerHTML = '<i class="fas fa-check-circle text-green-500 mr-1"></i>Connected';
            } else {
                throw new Error('API not responding correctly');
            }
        } catch (error) {
            console.error('API connection error:', error);
            document.getElementById('connection-status').innerHTML = '<i class="fas fa-exclamation-circle text-red-500 mr-1"></i>Disconnected';
        }
    }

    switchTab(tab) {
        // Update active tab button
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.classList.remove('active');
            if (btn.dataset.tab === tab) {
                btn.classList.add('active');
            }
        });

        // Update active tab content
        document.querySelectorAll('.tab-content').forEach(content => {
            content.classList.remove('active');
        });

        document.getElementById(`${tab}-tab`)?.classList.add('active');
        this.currentTab = tab;

        // Load tab-specific content
        switch (tab) {
            case 'dashboard':
                this.loadDashboard();
                break;
            case 'sessions':
                this.loadSessions();
                break;
            case 'proxies':
                this.loadProxies();
                break;
            case 'create':
                this.resetCreateForm();
                break;
        }
    }

    async loadDashboard() {
        try {
            const response = await fetch(`${this.apiBaseUrl}/crawl/sessions`);
            const data = await response.json();
            
            if (data.sessions) {
                this.updateDashboardStats(data.sessions);
                this.updateRecentSessions(data.sessions.slice(0, 5));
            }
        } catch (error) {
            console.error('Error loading dashboard:', error);
            this.showNotification('error', 'Failed to load dashboard data');
        }
    }

    updateDashboardStats(sessions) {
        const stats = {
            active: sessions.filter(s => s.status === 'running').length,
            completed: sessions.filter(s => s.status === 'completed').length,
            totalUrls: sessions.reduce((sum, s) => sum + (s.urls_discovered || 0), 0),
            successfulUrls: sessions.reduce((sum, s) => sum + (s.urls_completed || 0), 0)
        };

        const successRate = stats.totalUrls > 0 ? Math.round((stats.successfulUrls / stats.totalUrls) * 100) : 0;

        const elements = {
            'active-sessions-count': stats.active,
            'completed-sessions-count': stats.completed,
            'total-urls-count': stats.totalUrls,
            'success-rate': `${successRate}%`
        };

        Object.entries(elements).forEach(([id, value]) => {
            const element = document.getElementById(id);
            if (element) {
                element.textContent = value;
            }
        });
    }

    updateRecentSessions(sessions) {
        const container = document.getElementById('recent-sessions');
        if (!container) return;

        container.innerHTML = '';
        
        sessions.forEach(session => {
            const sessionElement = document.createElement('div');
            sessionElement.className = 'bg-white rounded-lg p-4 shadow hover:shadow-md transition-shadow cursor-pointer';
            sessionElement.innerHTML = `
                <div class="flex items-center justify-between">
                    <div class="flex-1">
                        <h4 class="font-semibold text-gray-900">${this.escapeHtml(session.title)}</h4>
                        <p class="text-sm text-gray-600">${session.description || 'No description'}</p>
                        <div class="flex items-center mt-2 space-x-4 text-xs text-gray-500">
                            <span><i class="fas fa-calendar mr-1"></i>${new Date(session.created_at).toLocaleDateString()}</span>
                            <span><i class="fas fa-link mr-1"></i>${session.urls_discovered || 0} URLs</span>
                        </div>
                    </div>
                    <div class="text-right">
                        <div class="status-badge ${session.status}">${session.status}</div>
                        ${session.status === 'running' ? `
                            <div class="text-xs text-gray-500 mt-1">
                                ${Math.round(((session.urls_completed || 0) / (session.urls_discovered || 1)) * 100)}% complete
                            </div>
                        ` : ''}
                    </div>
                </div>
            `;
            
            sessionElement.addEventListener('click', () => {
                this.viewSession(session.id);
            });
            
            container.appendChild(sessionElement);
        });
    }

    async loadSessions() {
        try {
            const response = await fetch(`${this.apiBaseUrl}/crawl/sessions`);
            const data = await response.json();
            
            if (data.sessions) {
                this.renderSessionsList(data.sessions);
            }
        } catch (error) {
            console.error('Error loading sessions:', error);
            this.showNotification('error', 'Failed to load sessions');
        }
    }

    renderSessionsList(sessions) {
        const container = document.getElementById('sessions-list');
        if (!container) return;

        container.innerHTML = '';
        
        sessions.forEach(session => {
            const sessionCard = document.createElement('div');
            sessionCard.className = 'bg-white rounded-lg shadow p-6 hover:shadow-lg transition-shadow';
            sessionCard.innerHTML = `
                <div class="flex items-start justify-between">
                    <div class="flex-1">
                        <div class="flex items-center space-x-3">
                            <h3 class="text-lg font-semibold text-gray-900">${this.escapeHtml(session.title)}</h3>
                            <div class="status-badge ${session.status}">${session.status}</div>
                        </div>
                        <p class="text-gray-600 mt-1">${session.description || 'No description provided'}</p>
                        
                        <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
                            <div class="text-center">
                                <div class="text-xl font-bold text-blue-600">${session.urls_discovered || 0}</div>
                                <div class="text-xs text-gray-500">Discovered</div>
                            </div>
                            <div class="text-center">
                                <div class="text-xl font-bold text-green-600">${session.urls_completed || 0}</div>
                                <div class="text-xs text-gray-500">Completed</div>
                            </div>
                            <div class="text-center">
                                <div class="text-xl font-bold text-red-600">${session.urls_failed || 0}</div>
                                <div class="text-xs text-gray-500">Failed</div>
                            </div>
                            <div class="text-center">
                                <div class="text-xl font-bold text-yellow-600">${session.urls_blocked || 0}</div>
                                <div class="text-xs text-gray-500">Blocked</div>
                            </div>
                        </div>
                        
                        <div class="text-sm text-gray-500 mt-3">
                            <i class="fas fa-calendar mr-1"></i>Created ${new Date(session.created_at).toLocaleString()}
                        </div>
                    </div>
                    
                    <div class="flex flex-col space-y-2 ml-4">
                        <button onclick="app.viewSession(${session.id})" class="btn-primary px-3 py-1 text-sm">
                            <i class="fas fa-eye mr-1"></i>View
                        </button>
                        ${session.status === 'pending' ? `
                            <button onclick="app.startSession(${session.id})" class="btn-success px-3 py-1 text-sm">
                                <i class="fas fa-play mr-1"></i>Start
                            </button>
                        ` : ''}
                        ${session.status === 'running' ? `
                            <button onclick="app.stopSession(${session.id})" class="btn-danger px-3 py-1 text-sm">
                                <i class="fas fa-stop mr-1"></i>Stop
                            </button>
                        ` : ''}
                        <button onclick="app.deleteSession(${session.id})" class="btn-secondary px-3 py-1 text-sm">
                            <i class="fas fa-trash mr-1"></i>Delete
                        </button>
                    </div>
                </div>
            `;
            
            container.appendChild(sessionCard);
        });
    }

    async discoverUrls() {
        const prompt = document.getElementById('ai-prompt').value.trim();
        const apiKey = document.getElementById('groq-api-key').value.trim();
        const model = document.getElementById('ai-model').value;

        if (!prompt || !apiKey || !model) {
            this.showNotification('error', 'Please fill in all AI discovery fields');
            return;
        }

        const btn = document.getElementById('discover-urls-btn');
        const originalText = btn.innerHTML;
        btn.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i>Discovering...';
        btn.disabled = true;

        try {
            const response = await fetch(`${this.apiBaseUrl}/crawl/discover-urls`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ prompt, groq_api_key: apiKey, model })
            });

            const data = await response.json();

            if (response.ok && data.urls && data.urls.length > 0) {
                this.displayDiscoveredUrls(data.urls);
                this.showNotification('success', `Discovered ${data.urls.length} URLs`);
            } else {
                throw new Error(data.error || 'No URLs discovered');
            }
        } catch (error) {
            console.error('URL discovery error:', error);
            this.showNotification('error', `Discovery failed: ${error.message}`);
        } finally {
            btn.innerHTML = originalText;
            btn.disabled = false;
        }
    }

    displayDiscoveredUrls(urls) {
        const container = document.getElementById('discovered-urls-list');
        if (!container) return;

        container.innerHTML = '';
        
        urls.forEach((url, index) => {
            const urlElement = document.createElement('div');
            urlElement.className = 'flex items-center p-3 border rounded-lg hover:bg-gray-50';
            urlElement.innerHTML = `
                <input type="checkbox" class="mr-3 discovered-url-checkbox" data-url="${this.escapeHtml(url)}" checked>
                <div class="flex-1">
                    <div class="font-medium text-gray-900">${this.escapeHtml(url)}</div>
                    <div class="text-sm text-gray-500">URL ${index + 1}</div>
                </div>
            `;
            container.appendChild(urlElement);
        });

        document.getElementById('discovered-urls-section').classList.remove('hidden');
    }

    selectAllUrls(select) {
        document.querySelectorAll('.discovered-url-checkbox').forEach(checkbox => {
            checkbox.checked = select;
        });
    }

    async createSession() {
        const formData = this.gatherCreateFormData();
        
        if (!formData) return;

        const btn = document.getElementById('create-session-btn');
        const originalText = btn.innerHTML;
        btn.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i>Creating...';
        btn.disabled = true;

        try {
            const response = await fetch(`${this.apiBaseUrl}/crawl/sessions`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData)
            });

            const data = await response.json();

            if (response.ok) {
                this.showNotification('success', 'Crawl session created successfully');
                this.switchTab('sessions');
                
                // Auto-start if requested
                if (document.getElementById('auto-start-session')?.checked) {
                    await this.startSession(data.id);
                }
            } else {
                throw new Error(data.error || 'Failed to create session');
            }
        } catch (error) {
            console.error('Session creation error:', error);
            this.showNotification('error', `Creation failed: ${error.message}`);
        } finally {
            btn.innerHTML = originalText;
            btn.disabled = false;
        }
    }

    gatherCreateFormData() {
        const title = document.getElementById('session-title').value.trim();
        const description = document.getElementById('session-description').value.trim();
        const startMethod = document.querySelector('input[name="start-method"]:checked').value;

        if (!title) {
            this.showNotification('error', 'Please enter a session title');
            return null;
        }

        let urls = [];
        
        if (startMethod === 'ai') {
            // Get selected URLs from AI discovery
            urls = Array.from(document.querySelectorAll('.discovered-url-checkbox:checked'))
                       .map(cb => cb.dataset.url);
            
            if (urls.length === 0) {
                this.showNotification('error', 'Please discover and select URLs first');
                return null;
            }
        } else {
            // Get manual URLs
            const manualUrls = document.getElementById('manual-urls').value.trim();
            if (!manualUrls) {
                this.showNotification('error', 'Please enter URLs to crawl');
                return null;
            }
            urls = manualUrls.split('\n').map(url => url.trim()).filter(url => url);
        }

        return {
            title,
            description,
            start_method: startMethod,
            urls: startMethod === 'manual' ? urls : undefined,
            
            // AI settings (if used for discovery)
            ai_prompt: startMethod === 'ai' ? document.getElementById('ai-prompt').value : null,
            groq_model: startMethod === 'ai' ? document.getElementById('ai-model').value : null,
            
            // Crawl strategy
            crawl_strategy: document.getElementById('crawl-strategy').value,
            
            // Deep crawl settings
            enable_deep_crawl: document.getElementById('enable-deep-crawl').checked,
            max_depth: parseInt(document.getElementById('max-depth').value) || 3,
            max_urls: parseInt(document.getElementById('max-urls').value) || 50,
            domain_strategy: document.getElementById('domain-strategy').value,
            domain_whitelist: document.getElementById('domain-strategy').value === 'whitelist' ? 
                document.getElementById('domain-whitelist').value.split(',').map(d => d.trim()) : null,
            
            // Pagination settings
            enable_pagination: document.getElementById('enable-pagination').checked,
            pagination_strategy: document.getElementById('pagination-strategy').value,
            pagination_selector: document.getElementById('pagination-strategy').value === 'custom-selector' ?
                document.getElementById('pagination-selector').value : null,
            max_pages: parseInt(document.getElementById('max-pages').value) || 10,
            
            // Output options
            generate_markdown: document.getElementById('generate-markdown').checked,
            extract_metadata: document.getElementById('extract-metadata').checked,
            extract_links: document.getElementById('extract-links').checked,
            extract_media: document.getElementById('extract-media').checked,
            
            // Advanced settings
            crawl_delay: parseInt(document.getElementById('crawl-delay').value) || 1000,
            delay_jitter: parseInt(document.getElementById('delay-jitter').value) || 500,
            max_concurrent: parseInt(document.getElementById('max-concurrent').value) || 5,
            
            // Content processing
            smart_cleaning: document.getElementById('smart-cleaning').checked,
            remove_ads: document.getElementById('remove-ads').checked,
            remove_navigation: document.getElementById('remove-navigation').checked
        };
    }

    resetCreateForm() {
        document.getElementById('create-session-form')?.reset();
        document.getElementById('discovered-urls-section').classList.add('hidden');
        document.getElementById('ai-inputs').style.display = 'block';
        document.getElementById('manual-inputs').style.display = 'none';
    }

    async startSession(sessionId) {
        try {
            const response = await fetch(`${this.apiBaseUrl}/crawl/sessions/${sessionId}/start`, {
                method: 'POST'
            });

            const data = await response.json();

            if (response.ok) {
                this.showNotification('success', 'Crawl session started');
                this.startPollingSession(sessionId);
                
                // Refresh sessions list
                if (this.currentTab === 'sessions') {
                    this.loadSessions();
                }
            } else {
                throw new Error(data.error || 'Failed to start session');
            }
        } catch (error) {
            console.error('Error starting session:', error);
            this.showNotification('error', `Failed to start session: ${error.message}`);
        }
    }

    async stopSession(sessionId) {
        try {
            const response = await fetch(`${this.apiBaseUrl}/crawl/sessions/${sessionId}/stop`, {
                method: 'POST'
            });

            const data = await response.json();

            if (response.ok) {
                this.showNotification('success', 'Crawl session stopped');
                this.stopPollingSession(sessionId);
                
                // Refresh sessions list
                if (this.currentTab === 'sessions') {
                    this.loadSessions();
                }
            } else {
                throw new Error(data.error || 'Failed to stop session');
            }
        } catch (error) {
            console.error('Error stopping session:', error);
            this.showNotification('error', `Failed to stop session: ${error.message}`);
        }
    }

    async deleteSession(sessionId) {
        if (!confirm('Are you sure you want to delete this crawl session? This action cannot be undone.')) {
            return;
        }

        try {
            const response = await fetch(`${this.apiBaseUrl}/crawl/sessions/${sessionId}`, {
                method: 'DELETE'
            });

            const data = await response.json();

            if (response.ok) {
                this.showNotification('success', 'Crawl session deleted');
                this.stopPollingSession(sessionId);
                
                // Refresh sessions list
                if (this.currentTab === 'sessions') {
                    this.loadSessions();
                }
            } else {
                throw new Error(data.error || 'Failed to delete session');
            }
        } catch (error) {
            console.error('Error deleting session:', error);
            this.showNotification('error', `Failed to delete session: ${error.message}`);
        }
    }

    async viewSession(sessionId) {
        // Switch to a detailed session view
        // This would open a modal or navigate to a detailed page
        this.openSessionModal(sessionId);
    }

    async openSessionModal(sessionId) {
        try {
            // Fetch session details
            const [sessionResponse, treeResponse] = await Promise.all([
                fetch(`${this.apiBaseUrl}/crawl/sessions/${sessionId}`),
                fetch(`${this.apiBaseUrl}/crawl/sessions/${sessionId}/tree`)
            ]);

            const sessionData = await sessionResponse.json();
            const treeData = await treeResponse.json();

            if (sessionResponse.ok && treeResponse.ok) {
                this.renderSessionModal(sessionData, treeData);
                this.showSessionModal();
                
                // Start polling if session is running
                if (sessionData.session.status === 'running') {
                    this.startPollingSession(sessionId);
                }
            } else {
                throw new Error('Failed to fetch session details');
            }
        } catch (error) {
            console.error('Error opening session modal:', error);
            this.showNotification('error', 'Failed to load session details');
        }
    }

    renderSessionModal(sessionData, treeData) {
        const { session, urls } = sessionData;
        
        // Create modal if it doesn't exist
        let modal = document.getElementById('session-modal');
        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'session-modal';
            modal.className = 'fixed inset-0 bg-gray-900 bg-opacity-75 z-50 hidden';
            document.body.appendChild(modal);
        }
        
        modal.innerHTML = `
            <div class="flex items-center justify-center min-h-screen p-4">
                <div class="bg-white rounded-lg shadow-2xl w-full max-w-6xl max-h-[90vh] overflow-hidden">
                    <div class="flex items-center justify-between p-6 border-b">
                        <div>
                            <h2 class="text-2xl font-bold text-gray-900">${this.escapeHtml(session.title)}</h2>
                            <div class="status-badge ${session.status} mt-2">${session.status}</div>
                        </div>
                        <button onclick="app.closeSessionModal()" class="text-gray-500 hover:text-gray-700">
                            <i class="fas fa-times fa-lg"></i>
                        </button>
                    </div>
                    
                    <div class="flex h-[70vh]">
                        <!-- Left Panel: Session Info & Progress -->
                        <div class="w-1/3 p-6 border-r overflow-y-auto">
                            <div class="space-y-6">
                                <!-- Progress Stats -->
                                <div>
                                    <h3 class="text-lg font-semibold mb-3">Progress</h3>
                                    <div class="grid grid-cols-2 gap-4">
                                        <div class="text-center p-3 bg-blue-50 rounded">
                                            <div class="text-xl font-bold text-blue-600">${session.urls_discovered || 0}</div>
                                            <div class="text-xs text-blue-600">Discovered</div>
                                        </div>
                                        <div class="text-center p-3 bg-green-50 rounded">
                                            <div class="text-xl font-bold text-green-600">${session.urls_completed || 0}</div>
                                            <div class="text-xs text-green-600">Completed</div>
                                        </div>
                                        <div class="text-center p-3 bg-red-50 rounded">
                                            <div class="text-xl font-bold text-red-600">${session.urls_failed || 0}</div>
                                            <div class="text-xs text-red-600">Failed</div>
                                        </div>
                                        <div class="text-center p-3 bg-yellow-50 rounded">
                                            <div class="text-xl font-bold text-yellow-600">${session.urls_blocked || 0}</div>
                                            <div class="text-xs text-yellow-600">Blocked</div>
                                        </div>
                                    </div>
                                </div>
                                
                                <!-- Actions -->
                                <div>
                                    <h3 class="text-lg font-semibold mb-3">Actions</h3>
                                    <div class="space-y-2">
                                        ${session.status === 'pending' ? `
                                            <button onclick="app.startSession(${session.id})" class="btn-success w-full">
                                                <i class="fas fa-play mr-2"></i>Start Crawling
                                            </button>
                                        ` : ''}
                                        ${session.status === 'running' ? `
                                            <button onclick="app.stopSession(${session.id})" class="btn-danger w-full">
                                                <i class="fas fa-stop mr-2"></i>Stop Crawling
                                            </button>
                                        ` : ''}
                                        <button onclick="app.exportSession(${session.id}, 'json')" class="btn-secondary w-full">
                                            <i class="fas fa-download mr-2"></i>Export JSON
                                        </button>
                                        <button onclick="app.exportSession(${session.id}, 'csv')" class="btn-secondary w-full">
                                            <i class="fas fa-download mr-2"></i>Export CSV
                                        </button>
                                    </div>
                                </div>
                                
                                <!-- Session Details -->
                                <div>
                                    <h3 class="text-lg font-semibold mb-3">Details</h3>
                                    <div class="space-y-2 text-sm">
                                        <div><strong>Created:</strong> ${new Date(session.created_at).toLocaleString()}</div>
                                        <div><strong>Strategy:</strong> ${session.crawl_strategy || 'basic'}</div>
                                        <div><strong>Max Depth:</strong> ${session.max_depth || 3}</div>
                                        <div><strong>Max URLs:</strong> ${session.max_urls || 50}</div>
                                        <div><strong>Deep Crawl:</strong> ${session.enable_deep_crawl ? 'Yes' : 'No'}</div>
                                        <div><strong>Pagination:</strong> ${session.enable_pagination ? 'Yes' : 'No'}</div>
                                    </div>
                                </div>
                            </div>
                        </div>
                        
                        <!-- Right Panel: Crawl Tree & URL List -->
                        <div class="flex-1 flex flex-col">
                            <!-- Tab Navigation -->
                            <div class="flex border-b">
                                <button class="session-tab-btn flex-1 py-3 px-4 font-medium active" data-tab="tree">
                                    <i class="fas fa-sitemap mr-2"></i>Crawl Tree
                                </button>
                                <button class="session-tab-btn flex-1 py-3 px-4 font-medium" data-tab="urls">
                                    <i class="fas fa-list mr-2"></i>URL Details
                                </button>
                            </div>
                            
                            <!-- Tree View -->
                            <div id="session-tree-tab" class="session-tab-content flex-1 p-6 active">
                                <div class="h-full">
                                    <canvas id="tree-canvas" class="w-full h-full border rounded"></canvas>
                                </div>
                            </div>
                            
                            <!-- URLs List -->
                            <div id="session-urls-tab" class="session-tab-content flex-1 p-6 overflow-y-auto" style="display: none;">
                                <div id="session-urls-list" class="space-y-3">
                                    ${this.renderUrlsList(urls)}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        // Add session tab switching
        modal.querySelectorAll('.session-tab-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const tab = e.target.dataset.tab;
                
                // Update tab buttons
                modal.querySelectorAll('.session-tab-btn').forEach(b => b.classList.remove('active'));
                e.target.classList.add('active');
                
                // Update tab content
                modal.querySelectorAll('.session-tab-content').forEach(content => {
                    content.style.display = 'none';
                });
                modal.querySelector(`#session-${tab}-tab`).style.display = tab === 'tree' ? 'block' : 'block';
            });
        });
        
        // Initialize tree visualization
        this.initializeTreeVisualization(treeData);
    }

    renderUrlsList(urls) {
        return urls.map(url => `
            <div class="bg-gray-50 rounded-lg p-4 cursor-pointer hover:bg-gray-100" onclick="app.viewUrlDetails(${url.id})">
                <div class="flex items-center justify-between">
                    <div class="flex-1">
                        <div class="font-medium text-gray-900 truncate">${this.escapeHtml(url.url)}</div>
                        <div class="text-sm text-gray-600">${url.title || 'No title'}</div>
                        <div class="text-xs text-gray-500 mt-1">
                            Depth: ${url.depth || 0} | 
                            ${url.response_time ? `Response: ${url.response_time}ms` : 'No timing'}
                        </div>
                    </div>
                    <div class="status-badge ${url.status}">${url.status}</div>
                </div>
            </div>
        `).join('');
    }

    initializeTreeVisualization(treeData) {
        // Simple tree visualization using canvas
        setTimeout(() => {
            const canvas = document.getElementById('tree-canvas');
            if (!canvas) return;
            
            const ctx = canvas.getContext('2d');
            
            // Set canvas size
            canvas.width = canvas.offsetWidth;
            canvas.height = canvas.offsetHeight;
            
            // Draw simple tree representation
            this.drawCrawlTree(ctx, treeData.nodes);
        }, 100);
    }

    drawCrawlTree(ctx, nodes) {
        if (!nodes || nodes.length === 0) {
            ctx.fillStyle = '#666';
            ctx.font = '16px Arial';
            ctx.textAlign = 'center';
            ctx.fillText('No crawl data available', ctx.canvas.width / 2, ctx.canvas.height / 2);
            return;
        }

        // Clear canvas
        ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
        
        // Group nodes by depth
        const nodesByDepth = {};
        nodes.forEach(node => {
            const depth = node.depth || 0;
            if (!nodesByDepth[depth]) {
                nodesByDepth[depth] = [];
            }
            nodesByDepth[depth].push(node);
        });
        
        const maxDepth = Math.max(...Object.keys(nodesByDepth).map(Number));
        const levelHeight = ctx.canvas.height / (maxDepth + 2);
        
        // Draw nodes by depth level
        Object.keys(nodesByDepth).forEach(depth => {
            const levelNodes = nodesByDepth[depth];
            const y = levelHeight * (parseInt(depth) + 1);
            const nodeWidth = Math.min(120, ctx.canvas.width / (levelNodes.length + 1));
            
            levelNodes.forEach((node, index) => {
                const x = (ctx.canvas.width / (levelNodes.length + 1)) * (index + 1);
                
                // Draw node
                ctx.fillStyle = this.getNodeColor(node.status);
                ctx.fillRect(x - nodeWidth/2, y - 15, nodeWidth, 30);
                
                // Draw text
                ctx.fillStyle = '#fff';
                ctx.font = '12px Arial';
                ctx.textAlign = 'center';
                ctx.fillText(
                    this.truncateText(new URL(node.url).hostname, 15), 
                    x, 
                    y + 5
                );
                
                // Draw connections to parent level (simple version)
                if (parseInt(depth) > 0) {
                    ctx.strokeStyle = '#ccc';
                    ctx.lineWidth = 1;
                    ctx.beginPath();
                    ctx.moveTo(x, y - 15);
                    ctx.lineTo(ctx.canvas.width / 2, levelHeight * parseInt(depth));
                    ctx.stroke();
                }
            });
        });
        
        // Add legend
        ctx.fillStyle = '#333';
        ctx.font = '14px Arial';
        ctx.textAlign = 'left';
        ctx.fillText('Crawl Tree Visualization', 10, 20);
        
        // Status legend
        const statuses = ['success', 'failed', 'blocked', 'processing', 'discovered'];
        statuses.forEach((status, i) => {
            const x = 10 + i * 80;
            const y = ctx.canvas.height - 30;
            
            ctx.fillStyle = this.getNodeColor(status);
            ctx.fillRect(x, y, 12, 12);
            
            ctx.fillStyle = '#333';
            ctx.font = '10px Arial';
            ctx.fillText(status, x + 16, y + 9);
        });
    }

    getNodeColor(status) {
        const colors = {
            'success': '#10b981',
            'completed': '#10b981',
            'failed': '#ef4444',
            'blocked': '#f59e0b',
            'processing': '#8b5cf6',
            'discovered': '#3b82f6',
            'pending': '#6b7280'
        };
        return colors[status] || '#6b7280';
    }

    truncateText(text, maxLength) {
        return text.length > maxLength ? text.substring(0, maxLength - 3) + '...' : text;
    }

    showSessionModal() {
        document.getElementById('session-modal').classList.remove('hidden');
    }

    closeSessionModal() {
        document.getElementById('session-modal').classList.add('hidden');
        // Stop any active polling for this modal
        Object.keys(this.activePolling).forEach(sessionId => {
            this.stopPollingSession(sessionId);
        });
    }

    startPollingSession(sessionId) {
        if (this.activePolling.has(sessionId)) return;
        
        const pollInterval = setInterval(async () => {
            try {
                const response = await fetch(`${this.apiBaseUrl}/crawl/sessions/${sessionId}/progress`);
                const progress = await response.json();
                
                if (response.ok) {
                    this.updateSessionProgress(sessionId, progress);
                    
                    // Stop polling if session is no longer running
                    if (progress.status !== 'running') {
                        this.stopPollingSession(sessionId);
                    }
                }
            } catch (error) {
                console.error('Error polling session progress:', error);
            }
        }, 2000);
        
        this.activePolling.set(sessionId, pollInterval);
    }

    stopPollingSession(sessionId) {
        const pollInterval = this.activePolling.get(sessionId);
        if (pollInterval) {
            clearInterval(pollInterval);
            this.activePolling.delete(sessionId);
        }
    }

    updateSessionProgress(sessionId, progress) {
        // Update session progress in dashboard
        const sessionCard = document.querySelector(`[data-session-id="${sessionId}"]`);
        if (sessionCard) {
            // Update status
            const statusElement = sessionCard.querySelector('.session-status');
            if (statusElement) {
                statusElement.textContent = progress.status || 'Unknown';
                statusElement.className = `session-status px-2 py-1 rounded text-xs font-medium ${
                    progress.status === 'running' ? 'bg-yellow-100 text-yellow-800' :
                    progress.status === 'completed' ? 'bg-green-100 text-green-800' :
                    progress.status === 'failed' ? 'bg-red-100 text-red-800' :
                    'bg-gray-100 text-gray-800'
                }`;
            }
            
            // Update progress stats
            const statsElement = sessionCard.querySelector('.session-stats');
            if (statsElement) {
                const completed = progress.urls_completed || 0;
                const discovered = progress.urls_discovered || 0;
                const failed = progress.urls_failed || 0;
                const blocked = progress.urls_blocked || 0;
                const total = discovered;
                
                statsElement.innerHTML = `
                    <div class="text-sm text-gray-600">
                        <span class="text-green-600">${completed} completed</span> • 
                        <span class="text-red-600">${failed} failed</span> • 
                        <span class="text-yellow-600">${blocked} blocked</span> • 
                        <span class="text-blue-600">${total} total</span>
                    </div>
                    ${total > 0 ? `
                        <div class="w-full bg-gray-200 rounded-full h-2 mt-1">
                            <div class="bg-blue-600 h-2 rounded-full" style="width: ${Math.round((completed / total) * 100)}%"></div>
                        </div>
                    ` : ''}
                `;
            }
        }
        
        // Update modal if it's open for this session
        const modalElement = document.getElementById('session-modal');
        if (modalElement && !modalElement.classList.contains('hidden')) {
            const modalSessionId = modalElement.dataset.sessionId;
            if (modalSessionId === sessionId.toString()) {
                this.updateSessionModal(progress);
            }
        }
        
        // Update crawl tree if visible
        const treeContainer = document.getElementById('crawl-tree-container');
        if (treeContainer && !treeContainer.classList.contains('hidden')) {
            this.updateCrawlTree(sessionId, progress);
        }
        
        console.log('Session progress update:', sessionId, progress);
    }
    
    updateSessionModal(progress) {
        // Update modal progress indicators
        const progressStats = document.getElementById('modal-progress-stats');
        if (progressStats) {
            const completed = progress.urls_completed || 0;
            const discovered = progress.urls_discovered || 0;
            const failed = progress.urls_failed || 0;
            const blocked = progress.urls_blocked || 0;
            const total = discovered;
            
            progressStats.innerHTML = `
                <div class="grid grid-cols-4 gap-4 mb-4">
                    <div class="bg-green-50 p-3 rounded-lg">
                        <div class="text-2xl font-bold text-green-600">${completed}</div>
                        <div class="text-sm text-green-600">Completed</div>
                    </div>
                    <div class="bg-red-50 p-3 rounded-lg">
                        <div class="text-2xl font-bold text-red-600">${failed}</div>
                        <div class="text-sm text-red-600">Failed</div>
                    </div>
                    <div class="bg-yellow-50 p-3 rounded-lg">
                        <div class="text-2xl font-bold text-yellow-600">${blocked}</div>
                        <div class="text-sm text-yellow-600">Blocked</div>
                    </div>
                    <div class="bg-blue-50 p-3 rounded-lg">
                        <div class="text-2xl font-bold text-blue-600">${total}</div>
                        <div class="text-sm text-blue-600">Total</div>
                    </div>
                </div>
                ${total > 0 ? `
                    <div class="mb-4">
                        <div class="flex justify-between text-sm text-gray-600 mb-1">
                            <span>Progress</span>
                            <span>${Math.round((completed / total) * 100)}%</span>
                        </div>
                        <div class="w-full bg-gray-200 rounded-full h-2">
                            <div class="bg-blue-600 h-2 rounded-full transition-all duration-300" 
                                 style="width: ${Math.round((completed / total) * 100)}%"></div>
                        </div>
                    </div>
                ` : ''}
            `;
        }
        
        // Update status indicator
        const statusIndicator = document.getElementById('modal-status-indicator');
        if (statusIndicator) {
            statusIndicator.innerHTML = `
                <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                    progress.status === 'running' ? 'bg-yellow-100 text-yellow-800' :
                    progress.status === 'completed' ? 'bg-green-100 text-green-800' :
                    progress.status === 'failed' ? 'bg-red-100 text-red-800' :
                    'bg-gray-100 text-gray-800'
                }">
                    ${progress.status || 'Unknown'}
                </span>
            `;
        }
    }
    
    updateCrawlTree(sessionId, progress) {
        // Update the crawl tree visualization with new progress data
        // This would refresh the tree chart if it's currently displayed
        if (this.treeChart && document.getElementById('tree-session-id')?.value === sessionId.toString()) {
            // Trigger a refresh of the tree data
            this.loadCrawlTree(sessionId);
        }
    }

    async exportSession(sessionId, format) {
        try {
            const response = await fetch(`${this.apiBaseUrl}/crawl/sessions/${sessionId}/export/${format}`);
            
            if (response.ok) {
                if (format === 'csv') {
                    // Handle CSV download
                    const blob = await response.blob();
                    const url = window.URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `crawl-session-${sessionId}.csv`;
                    document.body.appendChild(a);
                    a.click();
                    window.URL.revokeObjectURL(url);
                    document.body.removeChild(a);
                } else {
                    // Handle JSON download
                    const data = await response.json();
                    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
                    const url = window.URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `crawl-session-${sessionId}.json`;
                    document.body.appendChild(a);
                    a.click();
                    window.URL.revokeObjectURL(url);
                    document.body.removeChild(a);
                }
                
                this.showNotification('success', `Session exported as ${format.toUpperCase()}`);
            } else {
                throw new Error('Export failed');
            }
        } catch (error) {
            console.error('Export error:', error);
            this.showNotification('error', `Export failed: ${error.message}`);
        }
    }

    async viewUrlDetails(urlId) {
        // Implementation for viewing detailed URL data
        console.log('View URL details:', urlId);
        this.showNotification('info', 'URL details feature coming soon');
    }

    async loadProxies() {
        try {
            const response = await fetch(`${this.apiBaseUrl}/proxies`);
            const data = await response.json();
            
            if (data.proxies) {
                this.renderProxyList(data.proxies);
            }
        } catch (error) {
            console.error('Error loading proxies:', error);
            this.showNotification('error', 'Failed to load proxies');
        }
    }

    renderProxyList(proxies) {
        const container = document.getElementById('proxy-list');
        if (!container) return;

        container.innerHTML = proxies.map(proxy => `
            <div class="bg-white rounded-lg p-4 shadow">
                <div class="flex items-center justify-between">
                    <div>
                        <div class="font-medium">${this.escapeHtml(proxy.name || proxy.url)}</div>
                        <div class="text-sm text-gray-600">${this.escapeHtml(proxy.url)}</div>
                    </div>
                    <div class="text-right">
                        <div class="status-badge ${proxy.status || 'unknown'}">${proxy.status || 'unknown'}</div>
                        ${proxy.latency ? `<div class="text-xs text-gray-500">${proxy.latency}ms</div>` : ''}
                    </div>
                </div>
            </div>
        `).join('');
    }

    async testAllProxies() {
        this.showNotification('info', 'Testing all proxies...');
        
        try {
            const response = await fetch(`${this.apiBaseUrl}/proxies/test`, {
                method: 'POST'
            });
            
            const data = await response.json();
            
            if (response.ok) {
                this.showNotification('success', 'Proxy testing completed');
                this.loadProxies();
            } else {
                throw new Error(data.error || 'Proxy testing failed');
            }
        } catch (error) {
            console.error('Proxy testing error:', error);
            this.showNotification('error', `Proxy testing failed: ${error.message}`);
        }
    }

    showAddProxiesModal() {
        this.showNotification('info', 'Add proxies feature coming soon');
    }

    showNotification(type, message) {
        // Create notification element
        const notification = document.createElement('div');
        notification.className = `fixed top-4 right-4 z-50 p-4 rounded-lg shadow-lg max-w-sm transition-all transform translate-x-full`;
        
        // Set notification style based on type
        const styles = {
            success: 'bg-green-500 text-white',
            error: 'bg-red-500 text-white',
            warning: 'bg-yellow-500 text-white',
            info: 'bg-blue-500 text-white'
        };
        
        notification.classList.add(...styles[type].split(' '));
        
        // Set notification content
        notification.innerHTML = `
            <div class="flex items-center">
                <i class="fas ${type === 'success' ? 'fa-check-circle' : type === 'error' ? 'fa-exclamation-circle' : type === 'warning' ? 'fa-exclamation-triangle' : 'fa-info-circle'} mr-2"></i>
                <span class="flex-1">${this.escapeHtml(message)}</span>
                <button onclick="this.parentElement.parentElement.remove()" class="ml-2 text-white hover:text-gray-200">
                    <i class="fas fa-times"></i>
                </button>
            </div>
        `;
        
        // Add to page
        document.body.appendChild(notification);
        
        // Animate in
        setTimeout(() => {
            notification.classList.remove('translate-x-full');
        }, 100);
        
        // Auto-remove after delay
        setTimeout(() => {
            notification.classList.add('translate-x-full');
            setTimeout(() => {
                if (notification.parentElement) {
                    notification.remove();
                }
            }, 300);
        }, type === 'error' ? 8000 : 5000);
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    destroy() {
        // Cleanup method
        if (this.refreshInterval) {
            clearInterval(this.refreshInterval);
        }
        
        this.activePolling.forEach(interval => {
            clearInterval(interval);
        });
        
        this.activePolling.clear();
    }
}

// Initialize app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.app = new Crawl4AIApp();
});

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
    if (window.app) {
        window.app.destroy();
    }
});