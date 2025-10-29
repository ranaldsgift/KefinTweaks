// Header Tabs Script
// Enhances header tab functionality by updating URL parameters when tabs are clicked
// Maintains tab state in the URL for better navigation and bookmarking

(function() {
    'use strict';
    
    // Common logging function
    const LOG = (...args) => console.log('[HeaderTabs]', ...args);
    const WARN = (...args) => console.warn('[HeaderTabs]', ...args);
    const ERR = (...args) => console.error('[HeaderTabs]', ...args);
    
    LOG('Initializing...');
    
    const SUPPORTED_PAGES = ['home', 'home.html', 'tv', 'tv.html', 'movies', 'movies.html', 'music', 'music.html', 'livetv', 'livetv.html'];
    
    // Get current page from URL hash
    function getCurrentPage() {
        const hash = window.location.hash;
        const hashMatches = hash.match(/#\/([^?]+)/g);
        if (!hashMatches || hashMatches.length === 0) return null;
        
        for (const match of hashMatches) {
            const pageFromHash = match.replace('#/', '');
            if (SUPPORTED_PAGES.includes(pageFromHash)) {
                return pageFromHash;
            }
        }
        return null;
    }
    
    // Get current tab index from URL parameter
    function getCurrentTabFromUrl() {
        const hash = window.location.hash;
        if (!hash.includes('?')) return 0;
        
        const [hashPath, hashSearch] = hash.split('?');
        const params = new URLSearchParams(hashSearch);
        const tabParam = params.get('tab');
        
        if (tabParam) {
            const tabIndex = parseInt(tabParam, 10);
            if (!isNaN(tabIndex) && tabIndex >= 0) {
                LOG('Current tab from URL:', tabIndex);
                return tabIndex;
            }
        }
        
        return 0;
    }
    
    // Update URL with tab parameter
    function updateUrlWithTab(tabIndex) {
        const currentHash = window.location.hash;
        const currentPage = getCurrentPage();
        
        if (!currentPage) return;
        
        let newHash = currentHash;
        
        if (currentHash.includes('?')) {
            // Replace existing tab parameter and clear watchlist-specific params
            const [hashPath, hashSearch] = currentHash.split('?');
            const params = new URLSearchParams(hashSearch);
            
            // Clear watchlist-specific parameters when switching header tabs
            params.delete('pageTab');
            params.delete('page');
            params.delete('sort');
            params.delete('sortDirection');
            params.delete('movieSort');
            params.delete('movieSortDirection');
            
            if (tabIndex === 0) {
                params.delete('tab');
            } else {
                params.set('tab', tabIndex.toString());
            }
            
            const paramString = params.toString();
            newHash = paramString ? `${hashPath}?${paramString}` : hashPath;
        } else {
            // Add tab parameter
            if (tabIndex !== 0) {
                newHash = `${currentHash}?tab=${tabIndex}`;
            } else {
                newHash = `${currentHash}`;
            }
        }

        // Manually notify handlers for Header Tab navigation because it doesn't trigger normal Jellyfin navigation
        window.KefinTweaksUtils.notifyHandlers(currentPage, document);
        
        // Replace history entry instead of adding new one
        const newUrl = window.location.origin + window.location.pathname + '#' + newHash.substring(1);
        window.history.replaceState(null, '', newUrl);
        LOG('Updated URL with tab:', tabIndex, newUrl);
    }
    
    // Handle tab button clicks
    function handleTabClick(event) {
        const clickedButton = event.currentTarget;
        const tabIndex = parseInt(clickedButton.getAttribute('data-index') || '0', 10);
        const currentPage = getCurrentPage();
        
        if (currentPage) {
            updateUrlWithTab(tabIndex);
            
            // Clean up tab content - ensure only the clicked tab has is-active
            const libraryPage = document.querySelector('.libraryPage:not(.hide)');
            if (libraryPage) {
                const tabContents = libraryPage.querySelectorAll('.pageTabContent');
                
                // Remove is-active class from all tab contents
                tabContents.forEach(content => {
                    content.classList.remove('is-active');
                });
                
                // Add is-active class to the clicked tab content
                const targetContent = libraryPage.querySelector(`.pageTabContent[data-index="${tabIndex}"]`);
                if (targetContent) {
                    targetContent.classList.add('is-active');
                    LOG('Set active tab content:', tabIndex);
                } else {
                    WARN('Target tab content not found for index:', tabIndex);
                }
            }
            
            window.scrollTo(0, 0);
            LOG('Tab clicked:', currentPage, tabIndex);
        }
    }
    
    // Synchronize active tab state with URL parameter
    function syncActiveTabState() {
        const headerTabs = document.querySelector('.headerTabs');
        if (!headerTabs) return;
        
        const currentTabFromUrl = getCurrentTabFromUrl();

        // Patch for media bar because it usually reacts slowly and hides later
        // Hide media bar slideshow if we aren't specifically on the home page first tab
        const currentPage = getCurrentPage();
        if (currentPage !== 'home' && currentPage !== 'home.html' || currentTabFromUrl !== 0) {
            const mediaBarSlideshow = document.getElementById('slides-container');
            if (mediaBarSlideshow) {
                mediaBarSlideshow.style.display = 'none';
            }
        }

        const buttons = headerTabs.querySelectorAll('.emby-tab-button');
        const activeButton = headerTabs.querySelector('.emby-tab-button-active');

        const activeTabContent = document.querySelector('.libraryPage:not(.hide) .pageTabContent.is-active');
        const activeTabContentIndex = activeTabContent ? activeTabContent.getAttribute('data-index') : null;

        // Remove is-active class from the active tab content if it's not the current tab
        if (activeTabContentIndex && activeTabContentIndex !== currentTabFromUrl) {
            activeTabContent.classList.remove('is-active');
        }

        // Add is-active class to the current tab content if it's not already active
        if (!activeTabContentIndex || activeTabContentIndex !== currentTabFromUrl) {
            const targetContent = document.querySelector(`.libraryPage:not(.hide) .pageTabContent[data-index="${currentTabFromUrl}"]`);
            if (targetContent) {
                targetContent.classList.add('is-active');
                LOG('Set active tab content:', currentTabFromUrl);
            }
        }

        if (activeButton && activeButton.getAttribute('data-index') === currentTabFromUrl.toString()) {
            return;
        }
        
        // Remove active class from all buttons
        buttons.forEach(button => {
            button.classList.remove('emby-tab-button-active');
        });
        
        // Find the button with the correct data-index
        const correctButton = Array.from(buttons).find(button => {
            const buttonIndex = parseInt(button.getAttribute('data-index') || '0', 10);
            return buttonIndex === currentTabFromUrl;
        });
        
        if (correctButton) {
            correctButton.classList.add('emby-tab-button-active');
            LOG('Set active tab button to index:', currentTabFromUrl);
        }
    }
    
    // Add click listeners to tab buttons
    function addClickListeners() {
        const headerTabs = document.querySelector('.headerTabs');
        if (headerTabs) {
            const buttons = headerTabs.querySelectorAll('.emby-tab-button');
            buttons.forEach(button => {
                button.removeEventListener('click', handleTabClick);
                button.addEventListener('click', handleTabClick);
            });
            LOG('Added click listeners to', buttons.length, 'buttons');
            
            // Synchronize active tab state with URL parameter
            syncActiveTabState();
        }
    }
    
    // TODO - Replace the MutationObservers with a less taxing alternative
    // Setup observer to watch for emby-tab-button additions
    function setupHeaderTabsObserver() {
        const headerTabs = document.querySelector('.headerTabs');
        if (!headerTabs) {
            LOG('No .headerTabs found, will retry...');
            setTimeout(setupHeaderTabsObserver, 500);
            return;
        }
        
        LOG('Setting up headerTabs observer');
        
        const observer = new MutationObserver(function(mutations) {
            let shouldReinit = false;
            
            mutations.forEach(mutation => {
                if (mutation.type === 'childList') {
                    const addedNodes = Array.from(mutation.addedNodes);
                    const removedNodes = Array.from(mutation.removedNodes);
                    
                    const hasTabButtons = addedNodes.some(node => 
                        node.nodeType === Node.ELEMENT_NODE && 
                        (node.classList.contains('emby-tab-button') || 
                         node.querySelector && node.querySelector('.emby-tab-button'))
                    ) || removedNodes.some(node => 
                        node.nodeType === Node.ELEMENT_NODE && 
                        (node.classList.contains('emby-tab-button') || 
                         node.querySelector && node.querySelector('.emby-tab-button'))
                    );
                    
                    if (hasTabButtons) {
                        shouldReinit = true;
                    }
                }
            });
            
            if (shouldReinit) {
                LOG('Tab buttons changed, reinitializing...');
                setTimeout(addClickListeners, 100);
            }
        });
        
        observer.observe(headerTabs, {
            childList: true,
            subtree: true
        });
        
        // Initial setup
        addClickListeners();
    }
    
    // Setup observer to watch for pageTabContent changes
    function setupObserver() {
        // Find the library page container
        const libraryPage = document.querySelector('.libraryPage:not(.hide)');
        if (!libraryPage) {
            LOG('No library page found, will retry...');
            setTimeout(setupObserver, 500);
            return;
        }
        
        LOG('Setting up observer on library page');
        
        const observer = new MutationObserver(function(mutations) {
            let shouldReinit = false;
            
            mutations.forEach(mutation => {
                // Check if pageTabContent elements were added/removed
                if (mutation.type === 'childList') {
                    const addedNodes = Array.from(mutation.addedNodes);
                    const removedNodes = Array.from(mutation.removedNodes);
                    
                    const hasPageTabContent = addedNodes.some(node => 
                        node.nodeType === Node.ELEMENT_NODE && 
                        (node.classList.contains('pageTabContent') || 
                         node.querySelector && node.querySelector('.pageTabContent'))
                    ) || removedNodes.some(node => 
                        node.nodeType === Node.ELEMENT_NODE && 
                        (node.classList.contains('pageTabContent') || 
                         node.querySelector && node.querySelector('.pageTabContent'))
                    );
                    
                    if (hasPageTabContent) {
                        shouldReinit = true;
                    }
                }
            });
            
            if (shouldReinit) {
                LOG('pageTabContent changed, reinitializing...');
                setTimeout(addClickListeners, 100);
            }
        });
        
        observer.observe(libraryPage, {
            childList: true,
            subtree: true
        });
    }
    
    // Monitor for page changes
    function setupPageMonitor() {
        let lastPage = null;
        let lastUrl = window.location.href;
        
        function checkPageChange() {
            const newPage = getCurrentPage();
            const currentUrl = window.location.href;
            
            // Check if page changed OR if URL changed (including query params)
            if (newPage !== lastPage || currentUrl !== lastUrl) {
                lastPage = newPage;
                lastUrl = currentUrl;
                if (newPage) {
                    LOG('Page change detected:', newPage);
                    // Setup observers when page changes
                    setupHeaderTabsObserver();
                    setupObserver();
                    // Sync active tab state after page change
                    setTimeout(syncActiveTabState, 100);
                }
            }
        }
        
        // Check immediately
        checkPageChange();
        
        // Check on hash changes
        window.addEventListener('hashchange', checkPageChange);
    }
    
    // Register onViewPage handler to sync active tab state
    if (window.KefinTweaksUtils && window.KefinTweaksUtils.onViewPage) {
        window.KefinTweaksUtils.onViewPage((view, element) => {
            LOG('onViewPage handler triggered for view:', view);
            // Sync active tab state when page view changes
            syncActiveTabState();
        }, {
            pages: SUPPORTED_PAGES, // Only trigger for supported pages
            immediate: false
        });
        LOG('Registered onViewPage handler for syncActiveTabState');
    } else {
        WARN('KefinTweaksUtils.onViewPage not available');
    }
    
    // Initialize
    setupPageMonitor();
    setupHeaderTabsObserver();
    
    LOG('Header tabs functionality initialized');
    
})();