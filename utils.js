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
                notifyHandlers(args[0], args[1]);
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
                immediate: false, // Call immediately if on matching page
                pages: [], // Specific pages to watch (empty = all pages)
                ...options
            }
        };
        
        handlers.push(handlerConfig);
        LOG(`Registered onViewPage handler (total: ${handlers.length})`);
        
        // Call immediately if requested and we're on a matching page
        if (handlerConfig.options.immediate) {
            const currentView = getCurrentView();
            if (currentView && shouldCallHandler(handlerConfig, currentView)) {
                try {
                    // Pass the promise (not awaited) for consistency with notifyHandlers
                    const itemPromise = getCurrentItem();
                    callback(currentView, document, itemPromise);
                } catch (err) {
                    ERR('Error in immediate handler call:', err);
                }
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
        if (!itemId || !window.ApiClient || !window.ApiClient.getItem || !window.ApiClient.getCurrentUserId) {
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
    function notifyHandlers(view, element) {
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
        LOG('Getting current item for ID:', currentItemId);
        const itemPromise = getCurrentItem();

        handlers.forEach((config) => {
            if (shouldCallHandler(config, view)) {
                try {
                    // Pass the promise as third parameter - handlers can await if needed
                    config.callback(view, element, itemPromise);
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
     * @returns {Promise<boolean>} - True if successfully added, false otherwise
     */
    function addCustomMenuLink(name, icon, url, openInNewTab = false) {
        return new Promise((resolve) => {
            // Check if menu container already exists
            const existingContainer = document.querySelector('.customMenuOptions');
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
                            if (node.matches?.('.customMenuOptions') || node.querySelector?.('.customMenuOptions')) {
                                const container = node.matches?.('.customMenuOptions') ? node : node.querySelector('.customMenuOptions');
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

    // Expose utilities to global scope
    window.KefinTweaksUtils = {
        onViewPage,
        notifyHandlers,
        getCurrentView,
        getHandlerCount,
        clearHandlers,
        addCustomMenuLink
    };
    
    LOG('Initialized successfully');
    LOG('Available at window.KefinTweaksUtils');
})();
