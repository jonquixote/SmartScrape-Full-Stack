/**
 * Crawl4AI Ultimate Pro - Full Stack Edition
 * Frontend JavaScript Application
 */

class Crawl4AIApp {
    constructor() {
        this.apiBaseUrl = '/api';
        this.currentTab = 'dashboard';
        this.refreshInterval = null;
        this.sessions = new Map();
        this.proxies = new Map();
        
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
        document.getElementById('discover-urls-btn').addEventListener('click', () => this.discoverUrls());
        document.getElementById('create-session-btn').addEventListener('click', () => this.createSession());
        document.getElementById('test-all-proxies-btn').addEventListener('click', () => this.testAllProxies());
        document.getElementById('add-proxies-btn').addEventListener('click', () => this.showAddProxiesModal());
        
        // AI discovery URL selection
        document.getElementById('select-all-urls').addEventListener('click', () => this.selectAllUrls(true));
        document.getElementById('deselect-all-urls').addEventListener('click', () => this.selectAllUrls(false));
        
        // Deep crawl and pagination toggles
        document.getElementById('enable-deep-crawl').addEventListener('change', (e) => {
            document.getElementById('deep-crawl-options').classList.toggle('hidden', !e.target.checked);
        });
        
        document.getElementById('enable-pagination').addEventListener('change', (e) => {
            document.getElementById('pagination-options').classList.toggle('hidden', !e.target.checked);
        });
        
        document.getElementById('domain-strategy').addEventListener('change', (e) => {
            document.getElementById('domain-whitelist-container').classList.toggle('hidden', e.target.value !== 'whitelist');
        });
        
        document.getElementById('pagination-strategy').addEventListener('change', (e) => {
            document.getElementById('custom-selector-options').classList.toggle('hidden', e.target.value !== 'custom-selector');
        });
    }

    async checkApiConnection() {
        try {
            const response = await axios.get(`${this.apiBaseUrl}/health`);
            if (response.data.status === 'ok') {
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
        document.getElementById(`${tab}-tab`).classList.add('active');

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
                // Create tab is static, no loading needed
                break;
        }
    }

    async loadDashboard() {
        try {
            // Load quick stats
            const [sessionsResponse, proxiesResponse] = await Promise.all([
                axios.get(`${this.apiBaseUrl}/crawl/sessions`),
                axios.get(`${this.apiBaseUrl}/proxies/stats`)
            ]);

            const sessions = sessionsResponse.data.sessions || [];
            const proxyStats = proxiesResponse.data.stats || {};

            // Update dashboard stats
            const activeSessions = sessions.filter(s => s.status === 'running').length;
            const totalUrls = sessions.reduce((sum, s) => sum + (s.urls_completed || 0), 0);
            const activeProxies = proxyStats.active || 0;

            document.getElementById('active-sessions-count').textContent = activeSessions;
            document.getElementById('total-urls-count').textContent = totalUrls;
            document.getElementById('active-proxies-count').textContent = activeProxies;

            // Show recent sessions
            this.renderRecentSessions(sessions.slice(0, 5));

        } catch (error) {
            console.error('Error loading dashboard:', error);
            this.showMessage('Failed to load dashboard data', 'error');
        }
    }

    renderRecentSessions(sessions) {
        const container = document.getElementById('recent-sessions');
        
        if (sessions.length === 0) {
            container.innerHTML = '<p class="text-gray-500 text-center py-8">No crawl sessions yet. <a href="#" onclick="app.switchTab(\'create\')" class="text-blue-500">Create your first session</a></p>';
            return;
        }

        const html = sessions.map(session => `
            <div class="crawl-card bg-white border rounded-lg p-4 mb-3 ${session.status}">
                <div class="flex items-center justify-between">
                    <div class="flex-1">
                        <h4 class="font-semibold text-gray-800">${this.escapeHtml(session.title)}</h4>
                        <p class="text-sm text-gray-600 mt-1">${session.description || 'No description'}</p>
                        <div class="flex items-center space-x-4 mt-2 text-sm text-gray-500">
                            <span><i class="fas fa-calendar mr-1"></i>${this.formatDate(session.created_at)}</span>
                            <span><i class="fas fa-link mr-1"></i>${session.urls_discovered || 0} URLs</span>
                            <span><i class="fas fa-check mr-1"></i>${session.urls_completed || 0} completed</span>
                        </div>
                    </div>
                    <div class="flex items-center space-x-3">
                        <span class="status-badge ${session.status}">${session.status}</span>
                        <button class="btn-secondary btn-sm" onclick="app.viewSession(${session.id})">
                            <i class="fas fa-eye"></i>
                        </button>
                    </div>
                </div>
            </div>
        `).join('');

        container.innerHTML = html;
    }

    async loadSessions() {
        try {
            this.showLoading('Loading sessions...');
            const response = await axios.get(`${this.apiBaseUrl}/crawl/sessions`);
            const sessions = response.data.sessions || [];
            
            this.sessions.clear();
            sessions.forEach(session => this.sessions.set(session.id, session));
            
            this.renderSessionsList(sessions);
        } catch (error) {
            console.error('Error loading sessions:', error);
            this.showMessage('Failed to load sessions', 'error');
        } finally {
            this.hideLoading();
        }
    }

    renderSessionsList(sessions) {
        const container = document.getElementById('sessions-list');
        
        if (sessions.length === 0) {
            container.innerHTML = '<p class="text-gray-500 text-center py-8">No crawl sessions found. <a href="#" onclick="app.switchTab(\'create\')" class="text-blue-500">Create your first session</a></p>';
            return;
        }

        const html = sessions.map(session => `
            <div class="crawl-card bg-white border rounded-lg p-6 mb-4 ${session.status}">
                <div class="flex items-start justify-between">
                    <div class="flex-1">
                        <h3 class="text-lg font-semibold text-gray-800 mb-2">${this.escapeHtml(session.title)}</h3>
                        <p class="text-gray-600 mb-3">${session.description || 'No description'}</p>
                        
                        <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                            <div class="text-center">
                                <p class="text-sm text-gray-500">Discovered</p>
                                <p class="text-lg font-semibold text-blue-600">${session.urls_discovered || 0}</p>
                            </div>
                            <div class="text-center">
                                <p class="text-sm text-gray-500">Completed</p>
                                <p class="text-lg font-semibold text-green-600">${session.urls_completed || 0}</p>
                            </div>
                            <div class="text-center">
                                <p class="text-sm text-gray-500">Failed</p>
                                <p class="text-lg font-semibold text-red-600">${session.urls_failed || 0}</p>
                            </div>
                            <div class="text-center">
                                <p class="text-sm text-gray-500">Blocked</p>
                                <p class="text-lg font-semibold text-yellow-600">${session.urls_blocked || 0}</p>
                            </div>
                        </div>

                        <div class="flex items-center space-x-4 text-sm text-gray-500">
                            <span><i class="fas fa-calendar mr-1"></i>Created: ${this.formatDate(session.created_at)}</span>
                            <span><i class="fas fa-cog mr-1"></i>Method: ${session.start_method}</span>
                        </div>
                    </div>
                    
                    <div class="flex flex-col items-end space-y-2">
                        <span class="status-badge ${session.status}">${session.status}</span>
                        <div class="flex space-x-2">
                            ${session.status === 'pending' ? `
                                <button class="btn-success btn-sm" onclick="app.startSession(${session.id})">
                                    <i class="fas fa-play mr-1"></i>Start
                                </button>
                            ` : ''}
                            ${session.status === 'running' ? `
                                <button class="btn-danger btn-sm" onclick="app.stopSession(${session.id})">
                                    <i class="fas fa-stop mr-1"></i>Stop
                                </button>
                            ` : ''}
                            <button class="btn-secondary btn-sm" onclick="app.viewSession(${session.id})">
                                <i class="fas fa-eye mr-1"></i>View
                            </button>
                            <button class="btn-danger btn-sm" onclick="app.deleteSession(${session.id})">
                                <i class="fas fa-trash mr-1"></i>Delete
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `).join('');

        container.innerHTML = html;
    }

    async loadProxies() {
        try {
            this.showLoading('Loading proxies...');
            const [proxiesResponse, statsResponse] = await Promise.all([
                axios.get(`${this.apiBaseUrl}/proxies`),
                axios.get(`${this.apiBaseUrl}/proxies/stats`)
            ]);
            
            const proxies = proxiesResponse.data.proxies || [];
            const stats = statsResponse.data.stats || {};
            
            this.proxies.clear();
            proxies.forEach(proxy => this.proxies.set(proxy.id, proxy));
            
            this.renderProxyStats(stats);
            this.renderProxiesList(proxies);
        } catch (error) {
            console.error('Error loading proxies:', error);
            this.showMessage('Failed to load proxies', 'error');
        } finally {
            this.hideLoading();
        }
    }

    renderProxyStats(stats) {
        const container = document.getElementById('proxy-stats');
        container.innerHTML = `
            <div class="text-center p-4 bg-blue-50 rounded-lg">
                <p class="text-sm text-gray-600">Total</p>
                <p class="text-2xl font-bold text-blue-600">${stats.total || 0}</p>
            </div>
            <div class="text-center p-4 bg-green-50 rounded-lg">
                <p class="text-sm text-gray-600">Active</p>
                <p class="text-2xl font-bold text-green-600">${stats.active || 0}</p>
            </div>
            <div class="text-center p-4 bg-red-50 rounded-lg">
                <p class="text-sm text-gray-600">Failed</p>
                <p class="text-2xl font-bold text-red-600">${stats.failed || 0}</p>
            </div>
            <div class="text-center p-4 bg-gray-50 rounded-lg">
                <p class="text-sm text-gray-600">Avg Latency</p>
                <p class="text-2xl font-bold text-gray-600">${stats.avg_latency ? Math.round(stats.avg_latency) + 'ms' : 'N/A'}</p>
            </div>
        `;
    }

    renderProxiesList(proxies) {
        const container = document.getElementById('proxies-list');
        
        if (proxies.length === 0) {
            container.innerHTML = '<p class="text-gray-500 text-center py-8">No proxies configured. Add some proxies to get started.</p>';
            return;
        }

        const html = `
            <div class="table-container">
                <table>
                    <thead>
                        <tr>
                            <th>Name</th>
                            <th>URL</th>
                            <th>Source</th>
                            <th>Status</th>
                            <th>Latency</th>
                            <th>Score</th>
                            <th>Success Rate</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${proxies.map(proxy => {
                            const successRate = proxy.total_requests > 0 ? 
                                Math.round((proxy.success_count / proxy.total_requests) * 100) : 0;
                            
                            return `
                                <tr>
                                    <td class="font-medium">${this.escapeHtml(proxy.name)}</td>
                                    <td class="font-mono text-sm">${this.escapeHtml(proxy.url)}</td>
                                    <td><span class="px-2 py-1 bg-gray-100 rounded text-xs">${proxy.source}</span></td>
                                    <td><span class="status-badge ${proxy.status}">${proxy.status}</span></td>
                                    <td>${proxy.latency ? proxy.latency + 'ms' : 'N/A'}</td>
                                    <td>
                                        <div class="flex items-center">
                                            <div class="w-12 h-2 bg-gray-200 rounded mr-2">
                                                <div class="h-full bg-blue-500 rounded" style="width: ${proxy.score}%"></div>
                                            </div>
                                            <span class="text-sm">${proxy.score}</span>
                                        </div>
                                    </td>
                                    <td>${successRate}% (${proxy.success_count}/${proxy.total_requests})</td>
                                    <td>
                                        <div class="flex space-x-1">
                                            <button class="btn-secondary btn-sm" onclick="app.testProxy(${proxy.id})">
                                                <i class="fas fa-flask"></i>
                                            </button>
                                            ${proxy.source !== 'static' ? `
                                                <button class="btn-danger btn-sm" onclick="app.deleteProxy(${proxy.id})">
                                                    <i class="fas fa-trash"></i>
                                                </button>
                                            ` : ''}
                                        </div>
                                    </td>
                                </tr>
                            `;
                        }).join('')}
                    </tbody>
                </table>
            </div>
        `;

        container.innerHTML = html;
    }

    async discoverUrls() {
        const prompt = document.getElementById('ai-prompt').value.trim();
        const apiKey = document.getElementById('groq-api-key').value.trim();
        const model = document.getElementById('groq-model').value;
        const button = document.getElementById('discover-urls-btn');

        if (!prompt) {
            this.showMessage('Please enter a discovery prompt', 'warning');
            return;
        }

        if (!apiKey) {
            this.showMessage('Please enter your Groq API key', 'warning');
            return;
        }

        try {
            button.disabled = true;
            button.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i>Searching...';

            const response = await axios.post(`${this.apiBaseUrl}/crawl/discover-urls`, {
                prompt,
                groq_api_key: apiKey,
                model
            });

            const urls = response.data.urls || [];
            
            if (urls.length === 0) {
                this.showMessage('No URLs found. Try refining your prompt.', 'warning');
                return;
            }

            // Show discovered URLs as checkable list
            this.showDiscoveredUrls(urls);
            this.showMessage(`AI discovered ${urls.length} URLs! Select which ones to crawl.`, 'success');

        } catch (error) {
            console.error('URL discovery error:', error);
            this.showMessage(error.response?.data?.error || 'Failed to discover URLs', 'error');
        } finally {
            button.disabled = false;
            button.innerHTML = '<i class="fas fa-search mr-2"></i>Discover URLs';
        }
    }

    showDiscoveredUrls(urls) {
        const container = document.getElementById('discovered-urls-list');
        const aiResultsDiv = document.getElementById('ai-results');
        
        // Show AI results section
        aiResultsDiv.classList.remove('hidden');
        
        // Generate checkboxes for each URL (only auto-select first one)
        container.innerHTML = urls.map((url, index) => `
            <label class="flex items-start space-x-3 p-2 border rounded hover:bg-gray-50 cursor-pointer">
                <input type="checkbox" class="discovered-url-checkbox mt-1" value="${this.escapeHtml(url)}" ${index === 0 ? 'checked' : ''}>
                <div class="flex-1">
                    <div class="text-sm font-medium text-gray-900 break-all">${this.escapeHtml(url)}</div>
                    <div class="text-xs text-gray-500">Click to toggle selection</div>
                </div>
            </label>
        `).join('');
    }

    selectAllUrls(select) {
        const checkboxes = document.querySelectorAll('.discovered-url-checkbox');
        checkboxes.forEach(checkbox => {
            checkbox.checked = select;
        });
    }

    getSelectedUrls() {
        const checkboxes = document.querySelectorAll('.discovered-url-checkbox:checked');
        return Array.from(checkboxes).map(checkbox => checkbox.value);
    }

    generateSessionTitle(startMethod) {
        if (startMethod === 'ai') {
            const prompt = document.getElementById('ai-prompt').value.trim();
            if (prompt) {
                // Clean up the prompt and make it a title
                return prompt.charAt(0).toUpperCase() + prompt.slice(1).replace(/[.!?]+$/, '');
            }
            return 'AI Discovery Session';
        } else {
            // For manual method, try to extract domain names
            const urlsText = document.getElementById('manual-urls').value.trim();
            const selectedUrls = this.getSelectedUrls();
            
            const urls = selectedUrls.length > 0 ? selectedUrls : 
                         urlsText.split('\n').map(url => url.trim()).filter(url => url.length > 0);
            
            if (urls.length > 0) {
                try {
                    const domains = urls.map(url => {
                        const urlObj = new URL(url.startsWith('http') ? url : 'https://' + url);
                        return urlObj.hostname.replace('www.', '');
                    });
                    const uniqueDomains = [...new Set(domains)];
                    
                    if (uniqueDomains.length === 1) {
                        return `Crawl ${uniqueDomains[0]}`;
                    } else if (uniqueDomains.length <= 3) {
                        return `Crawl ${uniqueDomains.join(', ')}`;
                    } else {
                        return `Crawl ${uniqueDomains.length} websites`;
                    }
                } catch (e) {
                    return `Manual Crawl Session`;
                }
            }
            return 'Manual Crawl Session';
        }
    }

    async createSession() {
        let title = document.getElementById('session-title').value.trim();
        const description = document.getElementById('session-description').value.trim();
        const startMethod = document.querySelector('input[name="start-method"]:checked').value;
        
        // Auto-generate title if not provided
        if (!title) {
            title = this.generateSessionTitle(startMethod);
            document.getElementById('session-title').value = title;
        }

        const sessionData = {
            title,
            description: description || undefined,
            start_method: startMethod,
            crawl_strategy: document.getElementById('crawl-strategy').value,
            
            // Deep crawl options
            enable_deep_crawl: document.getElementById('enable-deep-crawl').checked,
            max_depth: parseInt(document.getElementById('max-depth').value) || 3,
            max_urls: parseInt(document.getElementById('max-urls').value) || 50,
            domain_strategy: document.getElementById('domain-strategy').value,
            domain_whitelist: document.getElementById('domain-whitelist').value ? 
                document.getElementById('domain-whitelist').value.split(',').map(d => d.trim()) : null,
            respect_robots: document.getElementById('respect-robots').checked,
            parse_sitemaps: document.getElementById('parse-sitemaps').checked,
            discover_feeds: document.getElementById('discover-feeds').checked,
            include_patterns: document.getElementById('include-patterns').value || null,
            exclude_patterns: document.getElementById('exclude-patterns').value || null,
            
            // Pagination options
            enable_pagination: document.getElementById('enable-pagination').checked,
            pagination_strategy: document.getElementById('pagination-strategy').value,
            pagination_selector: document.getElementById('next-page-selector').value || null,
            max_pages: parseInt(document.getElementById('max-pages').value) || 10,
            page_delay: parseInt(document.getElementById('page-delay').value) || 2,
            deduplicate_paginated: document.getElementById('deduplicate-paginated').checked,
            
            // Output options
            generate_markdown: document.getElementById('generate-markdown').checked,
            extract_metadata: document.getElementById('extract-metadata').checked,
            extract_links: document.getElementById('extract-links').checked,
            extract_media: document.getElementById('extract-media').checked,
            
            // Content processing
            smart_cleaning: document.getElementById('smart-cleaning').checked,
            remove_ads: document.getElementById('remove-ads').checked,
            remove_navigation: document.getElementById('remove-navigation').checked,
            enable_ai_extraction: document.getElementById('enable-ai-extraction').checked
        };

        if (startMethod === 'ai') {
            sessionData.ai_prompt = document.getElementById('ai-prompt').value.trim();
            sessionData.groq_model = document.getElementById('groq-model').value;
            
            if (!sessionData.ai_prompt) {
                this.showMessage('Please enter an AI discovery prompt', 'warning');
                return;
            }
            
            // Check if URLs have been discovered and selected
            const selectedUrls = this.getSelectedUrls();
            if (selectedUrls.length > 0) {
                sessionData.urls = selectedUrls;
                sessionData.start_method = 'manual'; // Change to manual since we have specific URLs
            }
        } else {
            const urlsText = document.getElementById('manual-urls').value.trim();
            if (!urlsText) {
                this.showMessage('Please enter at least one URL to crawl', 'warning');
                return;
            }
            
            sessionData.urls = urlsText.split('\n')
                .map(url => url.trim())
                .filter(url => url.length > 0);
        }

        try {
            const button = document.getElementById('create-session-btn');
            button.disabled = true;
            button.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i>Creating...';

            const response = await axios.post(`${this.apiBaseUrl}/crawl/sessions`, sessionData);
            
            this.showMessage('Crawl session created successfully!', 'success');
            
            // Reset form
            document.getElementById('session-title').value = '';
            document.getElementById('session-description').value = '';
            document.getElementById('ai-prompt').value = '';
            document.getElementById('manual-urls').value = '';
            
            // Switch to sessions tab to show the new session
            setTimeout(() => {
                this.switchTab('sessions');
            }, 1000);

        } catch (error) {
            console.error('Session creation error:', error);
            this.showMessage(error.response?.data?.error || 'Failed to create session', 'error');
        } finally {
            const button = document.getElementById('create-session-btn');
            button.disabled = false;
            button.innerHTML = '<i class="fas fa-rocket mr-2"></i>Create Crawl Session';
        }
    }

    async startSession(sessionId) {
        try {
            await axios.post(`${this.apiBaseUrl}/crawl/sessions/${sessionId}/start`);
            this.showMessage('Crawl session started!', 'success');
            
            // Refresh sessions list
            if (this.currentTab === 'sessions') {
                this.loadSessions();
            }
        } catch (error) {
            console.error('Error starting session:', error);
            this.showMessage(error.response?.data?.error || 'Failed to start session', 'error');
        }
    }

    async stopSession(sessionId) {
        try {
            await axios.post(`${this.apiBaseUrl}/crawl/sessions/${sessionId}/stop`);
            this.showMessage('Crawl session stopped!', 'success');
            
            // Refresh sessions list
            if (this.currentTab === 'sessions') {
                this.loadSessions();
            }
        } catch (error) {
            console.error('Error stopping session:', error);
            this.showMessage(error.response?.data?.error || 'Failed to stop session', 'error');
        }
    }

    async deleteSession(sessionId) {
        if (!confirm('Are you sure you want to delete this crawl session? This action cannot be undone.')) {
            return;
        }

        try {
            await axios.delete(`${this.apiBaseUrl}/crawl/sessions/${sessionId}`);
            this.showMessage('Crawl session deleted!', 'success');
            
            // Remove from local cache and refresh
            this.sessions.delete(sessionId);
            if (this.currentTab === 'sessions') {
                this.loadSessions();
            }
        } catch (error) {
            console.error('Error deleting session:', error);
            this.showMessage(error.response?.data?.error || 'Failed to delete session', 'error');
        }
    }

    async viewSession(sessionId) {
        // In a full implementation, this would show a detailed view
        // For now, just switch to sessions tab
        this.switchTab('sessions');
        this.showMessage('Session details view coming soon!', 'info');
    }

    async testAllProxies() {
        try {
            const button = document.getElementById('test-all-proxies-btn');
            button.disabled = true;
            button.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i>Testing...';

            await axios.post(`${this.apiBaseUrl}/proxies/test`, { test_all: true });
            
            this.showMessage('Proxy testing started!', 'info');
            
            // Refresh proxies after a delay
            setTimeout(() => {
                this.loadProxies();
            }, 2000);

        } catch (error) {
            console.error('Error testing proxies:', error);
            this.showMessage(error.response?.data?.error || 'Failed to test proxies', 'error');
        } finally {
            const button = document.getElementById('test-all-proxies-btn');
            button.disabled = false;
            button.innerHTML = '<i class="fas fa-flask mr-2"></i>Test All';
        }
    }

    async testProxy(proxyId) {
        try {
            await axios.post(`${this.apiBaseUrl}/proxies/test`, { proxy_ids: [proxyId] });
            this.showMessage('Proxy test started!', 'info');
            
            // Refresh proxies after a delay
            setTimeout(() => {
                this.loadProxies();
            }, 1000);
        } catch (error) {
            console.error('Error testing proxy:', error);
            this.showMessage(error.response?.data?.error || 'Failed to test proxy', 'error');
        }
    }

    async deleteProxy(proxyId) {
        if (!confirm('Are you sure you want to delete this proxy?')) {
            return;
        }

        try {
            await axios.delete(`${this.apiBaseUrl}/proxies/${proxyId}`);
            this.showMessage('Proxy deleted!', 'success');
            
            // Remove from local cache and refresh
            this.proxies.delete(proxyId);
            this.loadProxies();
        } catch (error) {
            console.error('Error deleting proxy:', error);
            this.showMessage(error.response?.data?.error || 'Failed to delete proxy', 'error');
        }
    }

    showAddProxiesModal() {
        // Simple prompt for now - in a full implementation this would be a proper modal
        const proxiesText = prompt('Enter proxy URLs (one per line):\n\nExample:\nhttp://proxy1.example.com:8080\nhttp://proxy2.example.com:3128');
        
        if (proxiesText && proxiesText.trim()) {
            const proxies = proxiesText.split('\n')
                .map(p => p.trim())
                .filter(p => p.length > 0);
            
            this.addCustomProxies(proxies);
        }
    }

    async addCustomProxies(proxies) {
        try {
            await axios.post(`${this.apiBaseUrl}/proxies/custom`, { proxies });
            this.showMessage(`Added ${proxies.length} custom proxies!`, 'success');
            this.loadProxies();
        } catch (error) {
            console.error('Error adding proxies:', error);
            this.showMessage(error.response?.data?.error || 'Failed to add proxies', 'error');
        }
    }

    // Utility methods
    showLoading(message = 'Loading...') {
        const overlay = document.getElementById('loading-overlay');
        const messageEl = document.getElementById('loading-message');
        messageEl.textContent = message;
        overlay.classList.remove('hidden');
    }

    hideLoading() {
        document.getElementById('loading-overlay').classList.add('hidden');
    }

    showMessage(message, type = 'info') {
        const container = document.getElementById('message-container');
        const messageId = 'msg-' + Date.now();
        
        const messageEl = document.createElement('div');
        messageEl.id = messageId;
        messageEl.className = `notification message ${type} p-4 rounded-lg shadow-lg border`;
        messageEl.innerHTML = `
            <div class="flex items-start justify-between">
                <div class="flex items-start">
                    <i class="fas fa-${this.getMessageIcon(type)} mr-2 mt-0.5"></i>
                    <span>${this.escapeHtml(message)}</span>
                </div>
                <button onclick="app.dismissMessage('${messageId}')" class="ml-4 text-gray-400 hover:text-gray-600">
                    <i class="fas fa-times"></i>
                </button>
            </div>
        `;
        
        container.appendChild(messageEl);
        
        // Auto-dismiss after 5 seconds
        setTimeout(() => {
            this.dismissMessage(messageId);
        }, 5000);
    }

    dismissMessage(messageId) {
        const messageEl = document.getElementById(messageId);
        if (messageEl) {
            messageEl.classList.add('slide-out');
            setTimeout(() => {
                messageEl.remove();
            }, 300);
        }
    }

    getMessageIcon(type) {
        switch (type) {
            case 'success': return 'check-circle';
            case 'error': return 'exclamation-circle';
            case 'warning': return 'exclamation-triangle';
            case 'info': return 'info-circle';
            default: return 'info-circle';
        }
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    formatDate(dateString) {
        const date = new Date(dateString);
        return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
}

// Initialize the application when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.app = new Crawl4AIApp();
});