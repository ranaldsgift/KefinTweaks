// Header Tabs Script
// Enhances header tab functionality by updating URL parameters when tabs are clicked
// Maintains tab state in the URL for better navigation and bookmarking

(function() {
    'use strict';
    
    // Common logging function
    const LOG = (...args) => console.log('[HeaderTabs]', ...args);
    const WARN = (...args) => console.warn('[HeaderTabs]', ...args);
    const ERR = (...args) => console.error('[HeaderTabs]', ...args);
    
    LOG('Script loaded - JS Injector mode');
    
    const SUPPORTED_PAGES = ['home.html', 'tv.html', 'movies.html', 'music.html', 'livetv.html'];
    
    // Get current page from URL hash
    function getCurrentPage() {
        const hash = window.location.hash;
        const hashMatches = hash.match(/#\/([^?]+)/g);
        if (!hashMatches || hashMatches.length === 0) return null;
        
        for (const match of hashMatches) {
            const pageFromHash = match.replace('#/', '');
            if (SUPPORTED_PAGES.includes(pageFromHash)) {
                LOG('Current page detected:', pageFromHash);
                return pageFromHash;
            }
        }
        return null;
    }
    
    // Update URL with tab parameter
    function updateUrlWithTab(tabIndex) {
        const currentHash = window.location.hash;
        const currentPage = getCurrentPage();
        
        if (!currentPage) return;
        
        let newHash = currentHash;
        
        if (currentHash.includes('?')) {
            // Replace existing tab parameter
            const [hashPath, hashSearch] = currentHash.split('?');
            const params = new URLSearchParams(hashSearch);
            
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
            }
        }
        
        const newUrl = window.location.origin + window.location.pathname + '#' + newHash.substring(1);
        
        // Replace history entry instead of adding new one
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
            
            LOG('Tab clicked:', currentPage, tabIndex);
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
        }
    }
    
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
        
        function checkPageChange() {
            const newPage = getCurrentPage();
            if (newPage !== lastPage) {
                lastPage = newPage;
                if (newPage) {
                    LOG('Page change detected:', newPage);
                    // Setup observers when page changes
                    setupHeaderTabsObserver();
                    setupObserver();
                }
            }
        }
        
        // Check immediately
        checkPageChange();
        
        // Check on hash changes
        window.addEventListener('hashchange', checkPageChange);
        
        // Check periodically in case we miss something
        setInterval(checkPageChange, 1000);
    }
    
    // Initialize
    setupPageMonitor();
    
    LOG('Header tabs functionality initialized');
    
})();