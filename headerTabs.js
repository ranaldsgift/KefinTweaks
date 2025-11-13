// Header Tabs Script
// Enhances header tab functionality by updating URL parameters when tabs are clicked
// Maintains tab state in the URL for better navigation and bookmarking

(function() {
    'use strict';
    
    // Common logging function
    const LOG = (...args) => console.log('[KefinTweaks HeaderTabs]', ...args);
    const WARN = (...args) => console.warn('[KefinTweaks HeaderTabs]', ...args);
    const ERR = (...args) => console.error('[KefinTweaks HeaderTabs]', ...args);
    
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
    
    // Get parent ID from URL (topParentId or parentId)
    function getParentIdFromUrl() {
        const hash = window.location.hash;
        if (!hash.includes('?')) return null;
        
        const [hashPath, hashSearch] = hash.split('?');
        const params = new URLSearchParams(hashSearch);
        
        // Prefer topParentId, fall back to parentId
        return params.get('topParentId') || params.get('parentId') || null;
    }
    
    // Get current tab index from URL parameter
    // Returns null if no tab parameter is present (so we can fetch from preferences)
    function getCurrentTabFromUrl() {
        const hash = window.location.hash;
        if (!hash.includes('?')) return null;
        
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
        
        return null;
    }

    let _userDisplayPreferences = null;
    
    // Fetch display preferences and find matching tab based on landing preference
    // Returns the tab index if found, or null if no match/preference found
    // landingKey can be either a parentId (e.g., "f137a2dd21bbc1b99aa5c0f6bf02a805") or a page name (e.g., "livetv")
    async function getTabFromDisplayPreferences(landingKey) {
        if (!landingKey || !window.ApiClient) {
            LOG('No landingKey or ApiClient not available');
            return null;
        }
        
        try {
            const userId = window.ApiClient.getCurrentUserId();
            if (!userId) {
                LOG('No user ID available');
                return null;
            }

            if (!_userDisplayPreferences) {            
                const serverAddress = window.ApiClient._serverAddress;
                const accessToken = window.ApiClient.accessToken();
                
                if (!serverAddress || !accessToken) {
                    LOG('Server address or access token not available');
                    return null;
                }
                
                const response = await fetch(
                    `${serverAddress}/DisplayPreferences/usersettings?userId=${userId}&client=emby`,
                    {
                        headers: {
                            'X-Emby-Token': accessToken
                        }
                    }
                );
                
                if (!response.ok) {
                    WARN('Failed to fetch display preferences:', response.status);
                    return null;
                }
                
                _userDisplayPreferences = await response.json();
                LOG('Fetched display preferences for landing tab preference');
            }

            const customPrefs = _userDisplayPreferences.CustomPrefs || {};
            
            // Look for landing-{landingKey} in CustomPrefs
            const fullLandingKey = `landing-${landingKey}`;
            const landingValue = customPrefs[fullLandingKey];
            
            if (!landingValue) {
                LOG(`No landing preference found for ${fullLandingKey}`);
                return null;
            }
            
            LOG(`Found landing preference for ${fullLandingKey}:`, landingValue);
            
            // Find the tab button whose inner div text matches the landing value
            const headerTabs = document.querySelector('.headerTabs');
            if (!headerTabs) {
                LOG('Header tabs not found');
                return null;
            }
            
            const buttons = headerTabs.querySelectorAll('.emby-tab-button');
            for (const button of buttons) {
                const div = button.querySelector('div');
                if (div && div.innerText && div.innerText.replace(/\s+/g, '').trim().toLowerCase() === landingValue.replace(/\s+/g, '').trim().toLowerCase()) {
                    const tabIndex = parseInt(button.getAttribute('data-index') || '0', 10);
                    LOG(`Matched landing preference "${landingValue}" to tab index:`, tabIndex);
                    return tabIndex;
                }
            }
            
            LOG(`No tab button found matching landing preference "${landingValue}"`);
            return null;
            
        } catch (error) {
            ERR('Error fetching display preferences:', error);
            return null;
        }
    }
    
    // Update URL with tab parameter
    function updateUrlWithTab(tabIndex) {
        const currentHash = window.location.hash;
        const currentPage = getCurrentPage();
        
        if (!currentPage) return;
        
        // Check if there's a parentId - if not, don't add tab=0
        const parentId = getParentIdFromUrl();
        const shouldIncludeTab = tabIndex !== 0 || parentId !== null;
        
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
            
            if (shouldIncludeTab) {
                params.set('tab', tabIndex.toString());
            } else {
                // Remove tab parameter if it's tab 0 and no parentId
                params.delete('tab');
            }
            
            const paramString = params.toString();
            newHash = paramString ? `${hashPath}?${paramString}` : hashPath;
        } else {
            // Add tab parameter only if we should include it
            if (shouldIncludeTab) {
                newHash = `${currentHash}?tab=${tabIndex}`;
            } else {
                // Don't add tab parameter for tab 0 when no parentId
                newHash = currentHash;
            }
        }

        // Manually notify handlers for Header Tab navigation because it doesn't trigger normal Jellyfin navigation
        window.KefinTweaksUtils.notifyHandlers(currentPage, document, newHash);
        
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
    async function syncActiveTabState() {
        const headerTabs = document.querySelector('.headerTabs');
        if (!headerTabs) return;
        
        let currentTabFromUrl = getCurrentTabFromUrl();
        
        // If no tab parameter in URL, try to fetch from display preferences
        if (currentTabFromUrl === null) {
            const parentId = getParentIdFromUrl();
            let matchedTab = null;
            
            if (parentId) {
                // Try to get landing preference using parentId
                LOG('No tab parameter found, fetching from display preferences for parentId:', parentId);
                matchedTab = await getTabFromDisplayPreferences(parentId);
            } else {
                // No parentId, try to get landing preference using page name (e.g., "livetv", "home")
                const currentPage = getCurrentPage();
                if (currentPage) {
                    // Remove .html extension if present for the landing key
                    const pageName = currentPage.replace('.html', '');
                    LOG('No tab parameter and no parentId, fetching from display preferences for page:', pageName);
                    matchedTab = await getTabFromDisplayPreferences(pageName);
                }
            }
            
            if (matchedTab !== null) {
                // Only update URL if we successfully matched a landing preference
                currentTabFromUrl = matchedTab;
                updateUrlWithTab(matchedTab);
            } else {
                // No match found, use tab 0 for active state but don't update URL
                LOG('No landing preference match found, using tab 0 without updating URL');
                currentTabFromUrl = 0;
            }
        }

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
        if (activeTabContentIndex && activeTabContentIndex !== currentTabFromUrl.toString()) {
            activeTabContent.classList.remove('is-active');
        }

        // Add is-active class to the current tab content if it's not already active
        if (!activeTabContentIndex || activeTabContentIndex !== currentTabFromUrl.toString()) {
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
    async function addClickListeners() {
        const headerTabs = document.querySelector('.headerTabs');
        if (headerTabs) {
            const buttons = headerTabs.querySelectorAll('.emby-tab-button');
            let totalButtons = 2;
            buttons.forEach(button => {
                if (button.dataset.kefin === 'true') {
                    return;
                }
                button.addEventListener('click', handleTabClick);
                button.dataset.kefin = 'true';
            });

            const view = window.KefinTweaksUtils.getCurrentView();
            if (view === 'home' || view === 'home.html') {
                // Check for custom tabs
                
                const response = await fetch(`${ApiClient._serverAddress}/CustomTabs/Config`, {
                    method: "GET",
                    headers: {
                        "Content-Type": "application/json",
                        "X-Emby-Token": ApiClient._serverInfo.AccessToken || ApiClient.accessToken(),
                    },
                });
                const customTabs = await response.json();
                const customTabsCount = customTabs?.length || 0;
                totalButtons += customTabsCount;

                if (totalButtons > buttons.length && customTabsCount > 0) {
                    // Wait for custom tabs to be rendered and add click listeners to them
                    const tabsSlider = headerTabs.querySelector('.emby-tabs-slider');
                    if (tabsSlider) {
                        // Check if all custom tabs are already present
                        const checkAllTabsPresent = () => {
                            for (let i = 0; i < customTabsCount; i++) {
                                const customTabId = `customTabButton_${i}`;
                                if (!tabsSlider.querySelector(`#${customTabId}`)) {
                                    return false;
                                }
                            }
                            return true;
                        };

                        if (checkAllTabsPresent()) {
                            // All tabs already present, add listeners immediately
                            const newButtons = headerTabs.querySelectorAll('.emby-tab-button');
                            newButtons.forEach(button => {
                                if (button.dataset.kefin !== 'true') {
                                    button.addEventListener('click', handleTabClick);
                                    button.dataset.kefin = 'true';
                                }
                            });
                            LOG('All custom tabs already present, added click listeners');
                        } else {
                            // Wait for custom tabs using MutationObserver
                            LOG('Waiting for custom tabs to be rendered...');
                            const observer = new MutationObserver((mutations, obs) => {
                                if (checkAllTabsPresent()) {
                                    // All custom tabs are now present
                                    obs.disconnect();
                                    LOG('All custom tabs rendered, adding click listeners');
                                    syncActiveTabState();
                                    
                                    // Add click listeners to all buttons including the new custom tabs
                                    const allButtons = headerTabs.querySelectorAll('.emby-tab-button');
                                    allButtons.forEach(button => {
                                        if (button.dataset.kefin !== 'true') {
                                            button.addEventListener('click', handleTabClick);
                                            button.dataset.kefin = 'true';
                                        }
                                    });
                                }
                            });

                            // Start observing the tabs slider for child additions
                            observer.observe(tabsSlider, {
                                childList: true,
                                subtree: true
                            });

                            // Set a timeout to disconnect observer after a reasonable time (e.g., 10 seconds)
                            setTimeout(() => {
                                observer.disconnect();
                                LOG('MutationObserver timeout reached, stopped waiting for custom tabs');
                            }, 10000);
                        }
                        LOG('Synced active tab state after custom tabs were rendered');
                    }
                }
            }

            LOG('Added click listeners to', totalButtons, 'buttons');
        }
    }

    const MAX_INIT_ATTEMPTS = 10;
    let INIT_ATTEMPTS = 0;

    function initialize() {
        if (!window.KefinTweaksUtils || !window.KefinTweaksUtils.onViewPage) {
            WARN('KefinTweaksUtils not available, retrying in 1 second');
            if (INIT_ATTEMPTS < MAX_INIT_ATTEMPTS) {
                setTimeout(initialize, 1000);
                INIT_ATTEMPTS++;
            } else {
                ERR('KefinTweaksUtils not available after 10 seconds, giving up');
            }
            return;
        }
    
        // Register onViewPage handler to sync active tab state
        window.KefinTweaksUtils.onViewPage((view, element) => {
            LOG('onViewPage handler triggered for view:', view);
            addClickListeners();
            // Sync active tab state when page view changes
            syncActiveTabState().catch(err => {
                ERR('Error in syncActiveTabState:', err);
            });
        }, {
            pages: SUPPORTED_PAGES // Only trigger for supported pages
        });
        LOG('Registered onViewPage handler for syncActiveTabState');
        LOG('Header tabs functionality initialized');
   }
   
   initialize();        
})();