// KefinTweaks Utilities
// Provides standardized functionality for hooking into Emby.Page.onViewShow
// while maintaining original Jellyfin functionality

(function() {
    'use strict';
    
    // Common logging function
    const LOG = (...args) => console.log('[KefinTweaks Utils]', ...args);
    const WARN = (...args) => console.warn('[KefinTweaks Utils]', ...args);
    const ERR = (...args) => console.error('[KefinTweaks Utils]', ...args);
    
    LOG('Initializing');
    
    // Store the original onViewShow function
    let originalOnViewShow = null;
    
    // Initialize the utils by hooking into Emby.Page.onViewShow
    function initialize() {
        // Store the original onViewShow if it exists
        if (window.Emby && window.Emby.Page && window.Emby.Page.onViewShow) {
            originalOnViewShow = window.Emby.Page.onViewShow;
            LOG('Stored original Emby.Page.onViewShow');
        }
        
        // Override onViewShow to maintain original functionality
        if (window.Emby && window.Emby.Page) {
            window.Emby.Page.onViewShow = function (...args) {
                // Call original handler if it exists
                if (originalOnViewShow) {
                    try {
                        originalOnViewShow.apply(this, ...args);
                    } catch (err) {
                        ERR('Error in original onViewShow handler:', err);
                    }
                }
                
                // Call our registered handlers
                notifyHandlers(args[0], args[1], window.location.hash);
            };
            
            LOG('Hooked into Emby.Page.onViewShow');
        } else {
            WARN('Emby.Page.onViewShow not found - utils may not work correctly');
        }
    }
    
    // Array to store registered handlers
    const handlers = [];
    
    // Cache item per page view to avoid multiple fetches
    let cachedItem = null;
    let cachedItemId = null;
    let fetchInProgress = null; // Track the promise of an in-progress fetch
    let fetchItemId = null; // Track which item ID is currently being fetched
    
    /**
     * Register a callback to be called when page view changes
     * @param {Function} callback - Function to call when page view changes
     * @param {Object} options - Options for the handler
     */
    function onViewPage(callback, options = {}) {
        if (typeof callback !== 'function') {
            ERR('Callback must be a function');
            return;
        }
        
        const handlerConfig = {
            callback,
            options: {
                pages: [], // Specific pages to watch (empty = all pages)
                ...options
            }
        };
        
        handlers.push(handlerConfig);
        LOG(`Registered onViewPage handler (total: ${handlers.length})`);
        
        // Test if this is causing issues
        const currentView = getCurrentView();
        if (currentView && shouldCallHandler(handlerConfig, currentView)) {
            try {
                // Pass the promise (not awaited) for consistency with notifyHandlers
                const itemPromise = getCurrentItem();
                callback(currentView, document, window.location.hash, itemPromise);
            } catch (err) {
                ERR('Error in immediate handler call:', err);
            }
        }
        
        // Return a function to unregister this handler
        return () => {
            const index = handlers.indexOf(handlerConfig);
            if (index !== -1) {
                handlers.splice(index, 1);
                LOG(`Unregistered onViewPage handler (remaining: ${handlers.length})`);
            }
        };
    }
    
    /**
     * Get item ID from URL parameters
     * Works with both hash-based routing and traditional query strings
     * @returns {string|null} Item ID or null if not found
     */
    function getItemIdFromUrl() {
        try {
            const match = window.location.href.match(/[\?&]id=([^&]+)/);
            return match ? match[1] : null;
        } catch {
            return null;
        }
    }

    /**
     * Fetch item by ID
     * @param {string} itemId - The item ID
     * @returns {Promise<Object|null>} The item object or null if not found
     */
    async function fetchItemById(itemId) {
        if (!itemId || !window.ApiClient || !window.ApiClient.getItem || !window.ApiClient.getCurrentUserId || !window.ApiClient._loggedIn) {
            return null;
        }

        try {
            const userId = window.ApiClient.getCurrentUserId();
            const item = await window.ApiClient.getItem(userId, itemId);
            return item;
        } catch (error) {
            WARN('Error fetching item:', error);
            return null;
        }
    }
    
    /**
     * Get current item from URL, using cache if available
     * @returns {Promise<Object|null>} The item object or null if not found
     */
    async function getCurrentItem() {
        const itemId = getItemIdFromUrl();
        
        // If no item ID, return null
        if (!itemId) {
            return null;
        }
        
        // If we have a cached item for this ID, return it
        if (cachedItem && cachedItemId === itemId) {
            return cachedItem;
        }
        
        // If a fetch is already in progress for this item, wait for it
        if (fetchInProgress && fetchItemId === itemId) {
            LOG('Fetch already in progress for this item, waiting for it to complete');
            return await fetchInProgress;
        }
        
        // Start a new fetch and store the promise
        fetchItemId = itemId;
        fetchInProgress = (async () => {
            try {
                LOG('Fetching item:', itemId);
                const item = await fetchItemById(itemId);
                cachedItem = item;
                cachedItemId = itemId;
                return item;
            } finally {
                // Clear the in-progress flag when done (only if still for this item)
                if (fetchItemId === itemId) {
                    fetchInProgress = null;
                    fetchItemId = null;
                }
            }
        })();
        
        LOG('Fetch in progress for item:', itemId);
        return await fetchInProgress;
    }

    /**
     * Notify all registered handlers of a view change
     * @param {string} view - The view name
     * @param {Element} element - The view element
     */
    function notifyHandlers(view, element, hash) {
        // Clear cache when view changes to ensure fresh data
        const currentItemId = getItemIdFromUrl();
        if (cachedItemId !== currentItemId) {
            LOG('Clearing cache for new item:', currentItemId);
            cachedItem = null;
            cachedItemId = null;
            fetchInProgress = null; // Clear any in-progress fetch for previous item
            fetchItemId = null;
        }
        
        // Get the item promise once - will be shared across all handlers
        // The promise is cached/fetched by getCurrentItem(), ensuring only one API call
        const itemPromise = getCurrentItem();

        handlers.forEach((config) => {
            if (shouldCallHandler(config, view)) {
                try {
                    // Pass the promise as third parameter - handlers can await if needed
                    config.callback(view, element, hash, itemPromise);
                } catch (err) {
                    ERR('Error in onViewPage handler:', err);
                }
            }
        });
    }
    
    /**
     * Check if a handler should be called for a given view
     * @param {Object} config - Handler configuration
     * @param {string} view - The view name
     * @returns {boolean} Whether the handler should be called
     */
    function shouldCallHandler(config, view) {
        const { pages } = config.options;
        
        // If no specific pages are specified, call for all pages
        if (pages.length === 0) return true;
        
        // Get current URL hash to determine actual page
        const currentUrl = window.location.hash;
        
        // Check if the current URL matches any of the specified pages
        return pages.some(page => {
            if (typeof page === 'string') {
                // Check if URL hash contains the page pattern
                return currentUrl.includes(`/${page}.html`) || currentUrl.includes(`/${page}`) || currentUrl.includes(page);
            } else if (page instanceof RegExp) {
                return page.test(currentUrl);
            }
            return false;
        });
    }
    
    /**
     * Get the current view name
     * @returns {string|null} Current view name or null if not available
     */
    function getCurrentView() {
        const hash = window.location.hash;
        if (hash) {
            // Extract page name from hash - match part after #/ and before ? or /
            // This handles both .html pages (old) and pages without .html (Jellyfin 10.11+)
            const pageMatch = hash.match(/#\/([^\/\?]+)/);
            if (pageMatch) {
                return pageMatch[1];
            }
        }
        
        return null;
    }
    
    /**
     * Get the number of registered handlers
     * @returns {number} Number of registered handlers
     */
    function getHandlerCount() {
        return handlers.length;
    }
    
    /**
     * Clear all handlers
     */
    function clearHandlers() {
        handlers.length = 0;
        LOG('Cleared all onViewPage handlers');
    }
    
    // Initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initialize);
    } else {
        initialize();
    }
    
    /**
     * Add a custom menu link to the custom menu options
     * @param {string} name - Display name for the menu item
     * @param {string} icon - Material icon name
     * @param {string} url - URL to navigate to
     * @param {boolean} openInNewTab - Whether to open in new tab (default: false)
     * @param {string} containerSelector - CSS selector for the container to add the link to (default: '.customMenuOptions')
     * @returns {Promise<boolean>} - True if successfully added, false otherwise
     */
    function addCustomMenuLink(name, icon, url, openInNewTab = false, containerSelector = '.customMenuOptions') {
        return new Promise((resolve) => {
            // Check if menu container already exists
            const existingContainer = document.querySelector(containerSelector);
            if (existingContainer) {
                const success = addLinkToContainer(existingContainer, name, icon, url, openInNewTab);
                resolve(success);
                return;
            }

            LOG(`Custom menu container not found, waiting for it to appear for link: ${name}`);

            // Use MutationObserver to watch for the menu container
            const observer = new MutationObserver((mutations) => {
                for (const mutation of mutations) {
                    mutation.addedNodes.forEach(node => {
                        if (node.nodeType === Node.ELEMENT_NODE) {
                            // Check if the added node is the menu or contains it
                            if (node.matches?.(containerSelector) || node.querySelector?.(containerSelector)) {
                                const container = node.matches?.(containerSelector) ? node : node.querySelector(containerSelector);
                                LOG(`Custom menu container detected, adding link: ${name}`);
                                observer.disconnect();
                                
                                const success = addLinkToContainer(container, name, icon, url, openInNewTab);
                                resolve(success);
                                return;
                            }
                        }
                    });
                }
            });

            observer.observe(document.body, { 
                childList: true, 
                subtree: true 
            });
        });
    }

    /**
     * Waits for user to be logged in
     * @param {number} maxWaitMs - Maximum time to wait in milliseconds (default: 10000 = 10 seconds)
     * @param {number} checkInterval - Interval between checks in milliseconds (default: 500)
     * @returns {Promise<boolean>} - True if logged in, false if timeout
     */
    async function waitForLogin(maxWaitMs = 10000, checkInterval = 500) {
        const startTime = Date.now();
        
        while (Date.now() - startTime < maxWaitMs) {
            if (window.ApiClient && 
                window.ApiClient._loggedIn && 
                window.ApiClient.accessToken && 
                window.ApiClient.serverAddress) {
                try {
                    const token = window.ApiClient.accessToken();
                    if (token) {
                        LOG('User is logged in');
                        return true;
                    }
                } catch (e) {
                    // Token not available yet
                }
            }
            
            await new Promise(resolve => setTimeout(resolve, checkInterval));
        }
        
        WARN('Timeout waiting for user login');
        return false;
    }

    /**
     * Saves the current KefinTweaksConfig back to JS Injector plugin
     * @param {Object} config - Optional config object to save. If not provided, uses window.KefinTweaksConfig
     * @param {Object} options - Options for saving
     * @param {boolean} options.waitForLogin - Whether to wait for login if not logged in (default: true)
     * @param {number} options.loginWaitTime - Maximum time to wait for login in ms (default: 10000)
     * @returns {Promise<boolean>} - Success status
     */
    async function saveConfigToJavaScriptInjector(config = null, options = {}) {
        try {
            const { waitForLogin: shouldWaitForLogin = true, loginWaitTime = 10000 } = options;
            
            // Check if ApiClient is available
            if (!window.ApiClient) {
                if (shouldWaitForLogin) {
                    LOG('ApiClient not available, waiting for initialization...');
                    const loggedIn = await waitForLogin(loginWaitTime);
                    if (!loggedIn) {
                        WARN('ApiClient not available after waiting, cannot save config');
                        return false;
                    }
                } else {
                    throw new Error('ApiClient not available');
                }
            }
            
            // Check if user is logged in
            const isLoggedIn = window.ApiClient._loggedIn && 
                               window.ApiClient.accessToken && 
                               window.ApiClient.serverAddress;
            
            if (!isLoggedIn) {
                if (shouldWaitForLogin) {
                    LOG('User not logged in, waiting for login...');
                    const loggedIn = await waitForLogin(loginWaitTime);
                    if (!loggedIn) {
                        WARN('User not logged in after waiting, cannot save config');
                        return false;
                    }
                } else {
                    throw new Error('User not logged in');
                }
            }
            
            // Use provided config or fall back to window.KefinTweaksConfig
            const configToSave = config || window.KefinTweaksConfig;
            if (!configToSave) {
                throw new Error('No config provided and window.KefinTweaksConfig is not available');
            }
            
            // Find JavaScript Injector plugin
            const server = window.ApiClient.serverAddress();
            const token = window.ApiClient.accessToken();
            
            if (!server || !token) {
                throw new Error('Server address or access token not available');
            }
            
            let pluginsResponse = await fetch(`${server}/Plugins`, {
                headers: { 'X-Emby-Token': token }
            });
            
            // Handle 401 Unauthorized - retry once after waiting if waitForLogin is enabled
            if (pluginsResponse.status === 401 && shouldWaitForLogin) {
                WARN('Received 401 Unauthorized, waiting for login and retrying...');
                const loggedIn = await waitForLogin(5000); // Wait up to 5 more seconds
                if (loggedIn) {
                    // Retry with fresh token
                    const freshToken = window.ApiClient.accessToken();
                    pluginsResponse = await fetch(`${server}/Plugins`, {
                        headers: { 'X-Emby-Token': freshToken }
                    });
                }
            }
            
            if (!pluginsResponse.ok) {
                if (pluginsResponse.status === 401) {
                    throw new Error('Unauthorized - user may not be logged in or session expired');
                }
                throw new Error(`Failed to get plugins: ${pluginsResponse.status} ${pluginsResponse.statusText}`);
            }
            
            const pluginsData = await pluginsResponse.json();
            const pluginsList = Array.isArray(pluginsData) ? pluginsData : (pluginsData.Items || []);
            
            const plugin = pluginsList.find(p => p.Name === 'JavaScript Injector' || p.Name === 'JS Injector');
            if (!plugin) {
                WARN('JavaScript Injector plugin not found, cannot save config');
                return false;
            }
            
            const pluginId = plugin.Id;
            
            // Get current injector config
            const configUrl = `${server}/Plugins/${pluginId}/Configuration`;
            const configResponse = await fetch(configUrl, {
                headers: { 'X-Emby-Token': token }
            });
            
            if (!configResponse.ok) {
                throw new Error(`Failed to get plugin config: ${configResponse.statusText}`);
            }
            
            const injectorConfig = await configResponse.json();
            
            // Ensure CustomJavaScripts array exists
            if (!injectorConfig.CustomJavaScripts) {
                injectorConfig.CustomJavaScripts = [];
            }
            
            // Create the script content
            const scriptContent = `// KefinTweaks Configuration
// This file is automatically generated by KefinTweaks Configuration UI
// Do not edit manually unless you know what you're doing

window.KefinTweaksConfig = ${JSON.stringify(configToSave, null, 2)};`;
            
            // Find or create KefinTweaks-Config script
            const existingScriptIndex = injectorConfig.CustomJavaScripts.findIndex(
                script => script.Name === 'KefinTweaks-Config'
            );
            
            if (existingScriptIndex !== -1) {
                // Update existing script
                injectorConfig.CustomJavaScripts[existingScriptIndex].Script = scriptContent;
            } else {
                // Add new script
                injectorConfig.CustomJavaScripts.push({
                    Name: 'KefinTweaks-Config',
                    Script: scriptContent,
                    Enabled: true,
                    RequiresAuthentication: false
                });
            }
            
            // Save the updated configuration
            const saveResponse = await fetch(configUrl, {
                method: 'POST',
                headers: {
                    'X-Emby-Token': token,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(injectorConfig)
            });
            
            if (!saveResponse.ok) {
                throw new Error(`Failed to save plugin config: ${saveResponse.statusText}`);
            }
            
            LOG('Successfully saved config to JS Injector plugin');
            return true;
        } catch (err) {
            ERR('Error saving config to JS Injector:', err);
            return false;
        }
    }

    /**
     * Add the link to the existing container
     * @param {Element} container - The custom menu options container
     * @param {string} name - Display name for the menu item
     * @param {string} icon - Material icon name
     * @param {string} url - URL to navigate to
     * @param {boolean} openInNewTab - Whether to open in new tab
     * @returns {boolean} - True if successfully added
     */
    function addLinkToContainer(container, name, icon, url, openInNewTab) {
        try {
            // Check if link already exists to prevent duplicates
            const existingLinks = container.querySelectorAll('a[href="' + url + '"]');
            const existingByText = Array.from(container.querySelectorAll('.navMenuOptionText')).find(el => el.textContent === name);

            if (existingLinks.length > 0 || existingByText) {
                LOG(`Custom menu link already exists, skipping: ${name}`);
                return true;
            }
            
            // Create the menu link element
            const link = document.createElement('a');
            link.setAttribute('is', 'emby-linkbutton');
            link.className = 'emby-button navMenuOption lnkMediaFolder';
            link.dataset.name = name.toLowerCase().replace(' ', '-');
            link.href = url;
            
            if (openInNewTab) {
                link.setAttribute('rel', 'noopener noreferrer');
                link.setAttribute('target', '_blank');
            }

            // Create the icon span
            const iconSpan = document.createElement('span');
            iconSpan.className = `material-icons navMenuOptionIcon ${icon}`;
            iconSpan.setAttribute('aria-hidden', 'true');

            // Create the text span
            const textSpan = document.createElement('span');
            textSpan.className = 'navMenuOptionText';
            textSpan.textContent = name;

            // Append icon and text to link
            link.appendChild(iconSpan);
            link.appendChild(textSpan);

            // Append link to container
            container.appendChild(link);

            LOG(`Successfully added custom menu link: ${name}`);
            return true;
        } catch (err) {
            ERR(`Error adding custom menu link ${name}:`, err);
            return false;
        }
    }

    let _watchlistTabIndex = null;

	/**
	 * Get watchlist tab index, fetching if not yet set
	 * @returns {number|null} The watchlist tab index or null if not found
	 */
	async function getWatchlistTabIndex() {
		if (_watchlistTabIndex !== null) {
			return _watchlistTabIndex;
		}

		// Fetch the tab index as we do in addCustomMenuLink
		try {
			const response = await fetch(`${ApiClient._serverAddress}/CustomTabs/Config`, {
				method: "GET",
				headers: {
					"Content-Type": "application/json",
					"X-Emby-Token": ApiClient._serverInfo.AccessToken || ApiClient.accessToken(),
				},
			});
			const data = await response.json();
			data.forEach((tab, index) => {
				if (tab.ContentHtml.indexOf('sections watchlist') !== -1) {
					_watchlistTabIndex = index + 2;
					LOG('Fetched and stored watchlist tab index:', _watchlistTabIndex);
				}
			});
		} catch (err) {
			ERR('Failed to fetch watchlist tab index:', err);
		}

		return _watchlistTabIndex;
	}

    // Expose utilities to global scope
    window.KefinTweaksUtils = {
        onViewPage,
        notifyHandlers,
        getCurrentView,
        getHandlerCount,
        clearHandlers,
        addCustomMenuLink,
        saveConfigToJavaScriptInjector,
        getWatchlistTabIndex
    };
    
    LOG('Initialized successfully');
    LOG('Available at window.KefinTweaksUtils');
})();
