// Jellyfin Home Screen Script
// Adds custom scrollable sections to the home screen
// Requires: cardBuilder.js module to be loaded before this script

(function() {
    'use strict';
    
    // Common logging function
    const LOG = (...args) => console.log('[HomeScreen]', ...args);
    const WARN = (...args) => console.warn('[HomeScreen]', ...args);
    const ERR = (...args) => console.error('[HomeScreen]', ...args);
    
    LOG('Script loaded - JS Injector mode');
    
    // Custom home sections configuration
    const customHomeSections = [
        // Add home screen sections here with the following format:
        /* {
            name: 'Section Name',
            id: 'playlistId', <- Make sure the playlist is Public
            maxItems: 16, <- Maximum number of items to display on the home screen
            order: 3 <- Order of the section on the home screen
        }, */
    ];

    // Processing flag to prevent parallel execution
    let isProcessing = false;

/************ Helpers ************/

/**
 * Fetches playlist data from Jellyfin API
 * @param {string} playlistId - The playlist ID to fetch
 * @returns {Promise<Object>} - Playlist data with ItemIds array
 */
async function fetchPlaylistData(playlistId) {
    const apiClient = window.ApiClient;
    const serverUrl = apiClient.serverAddress();
    const token = apiClient.accessToken();
    
    const url = `${serverUrl}/Playlists/${playlistId}`;
    
    try {
        const response = await fetch(url, {
            headers: {
                "Authorization": `MediaBrowser Token="${token}"`
            }
        });
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const data = await response.json();
        return data;
    } catch (err) {
        ERR(`Failed to fetch playlist data for ${playlistId}:`, err);
        return { ItemIds: [] };
    }
}

/**
 * Generates the view more URL for a playlist
 * @param {string} playlistId - The playlist ID
 * @returns {string} - The complete URL for the playlist page
 */
function generateViewMoreUrl(playlistId) {
    const apiClient = window.ApiClient;
    const serverId = apiClient.serverId();
    return `/web/#/list.html?parentId=${playlistId}&serverId=${serverId}`;
}

/**
 * Renders a custom home section
 * @param {Object} section - Section configuration object
 * @param {HTMLElement} container - Container to append the section to
 * @returns {Promise<boolean>} - Success status
 */
async function renderCustomSection(section, container) {
    try {
        // Fetch playlist data
        const playlistData = await fetchPlaylistData(section.id);
        const itemIds = playlistData.ItemIds || [];
        
        // Limit to maxItems
        const limitedItemIds = itemIds.slice(0, section.maxItems);
        
        if (limitedItemIds.length === 0) {
            return false;
        }
        
        // Generate view more URL
        const viewMoreUrl = generateViewMoreUrl(section.id);
        
        // Check if cardBuilder is available
        if (typeof window.cardBuilder === 'undefined' || !window.cardBuilder.renderCardsFromIds) {
            WARN("cardBuilder not available, skipping section:", section.name);
            return false;
        }
        
        // Render the scrollable container
        const scrollableContainer = await window.cardBuilder.renderCardsFromIds(
            limitedItemIds,
            section.name,
            viewMoreUrl
        );
        
        // Add data attribute to track rendered sections
        scrollableContainer.setAttribute('data-custom-section-id', section.id);
        scrollableContainer.setAttribute('data-custom-section-name', section.name);

        if (section.order) {
            scrollableContainer.style.order = section.order;
        }
        
        // Append to container
        container.appendChild(scrollableContainer);
        
        return true;
        
    } catch (err) {
        ERR(`Error rendering section ${section.name}:`, err);
        return false;
    }
}

/**
 * Renders all custom home sections
 * @param {HTMLElement} container - Container to append sections to
 */
async function renderAllCustomSections(container) {
    const results = await Promise.all(
        customHomeSections.map(section => renderCustomSection(section, container))
    );
    
    const successCount = results.filter(Boolean).length;
    LOG(`Rendered ${successCount}/${customHomeSections.length} custom sections`);
}

/************ Home Screen Observer ************/

/**
 * Checks if custom sections are already rendered and renders them if not
 */
async function checkAndRenderCustomSections() {
    // Check if already processing to prevent parallel execution
    if (isProcessing) {
        return;
    }
    
    // Try multiple selectors to find the container
    const selectors = [
        '.itemDetailPage:not(.hide) .homeSectionsContainer',
        '.homeSectionsContainer',
        '.homeSectionsContainer:not(.hide)',
        '[class*="homeSections"]'
    ];
    
    let homeSectionsContainer = null;
    for (const selector of selectors) {
        homeSectionsContainer = document.querySelector(selector);
        if (homeSectionsContainer) {
            break;
        }
    }
    
    if (!homeSectionsContainer) {
        return;
    }
    
    // Check if sections are already rendered
    const hasRenderedSections = customHomeSections.some(section => 
        homeSectionsContainer.querySelector(`[data-custom-section-id="${section.id}"]`)
    );
    
    if (hasRenderedSections) {
        return;
    }
    
    // Set processing flag to prevent parallel execution
    isProcessing = true;
    
    try {
        await renderAllCustomSections(homeSectionsContainer);
        LOG('Custom sections rendered successfully');
    } catch (error) {
        ERR('Error rendering custom sections:', error);
    } finally {
        // Always reset the processing flag
        isProcessing = false;
    }
}

/**
 * Sets up observer to watch for home sections container
 */
function setupHomeScreenObserver() {
    // Check immediately in case the element already exists
    checkAndRenderCustomSections();
    
    // Set up MutationObserver to watch for home sections container
    const observer = new MutationObserver((mutations) => {
        let shouldCheck = false;
        
        mutations.forEach((mutation) => {
            if (mutation.type === 'childList') {
                mutation.addedNodes.forEach((node) => {
                    if (node.nodeType === Node.ELEMENT_NODE) {
                        // Check if the added node contains home sections container
                        if (node.querySelector && node.querySelector('.homeSectionsContainer')) {
                            shouldCheck = true;
                        }
                        
                        // Also check if the added node is the home sections container itself
                        if (node.classList && node.classList.contains('homeSectionsContainer')) {
                            shouldCheck = true;
                        }
                        
                        // Check for any class containing "home" or "section"
                        if (node.classList) {
                            for (const className of node.classList) {
                                if (className.toLowerCase().includes('home') || className.toLowerCase().includes('section')) {
                                    shouldCheck = true;
                                    break;
                                }
                            }
                        }
                    }
                });
            }
            
            // Also check on attribute changes (like class changes)
            if (mutation.type === 'attributes' && mutation.attributeName === 'class') {
                const target = mutation.target;
                if (target.classList && (target.classList.contains('homeSectionsContainer') || 
                    Array.from(target.classList).some(cls => cls.toLowerCase().includes('home') || cls.toLowerCase().includes('section')))) {
                    shouldCheck = true;
                }
            }
        });
        
        if (shouldCheck) {
            setTimeout(checkAndRenderCustomSections, 100); // Small delay to ensure DOM is ready
        }
    });
    
    // Start observing
    observer.observe(document.body, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ['class']
    });
    
    LOG('Home screen observer initialized');
}

// Initialize the home screen observer
setupHomeScreenObserver();

// Fallback: Check periodically in case mutation observer misses something
let checkInterval = null;
const startPeriodicCheck = () => {
    if (checkInterval) return;
    
    checkInterval = setInterval(() => {
        // Skip if already processing
        if (isProcessing) {
            return;
        }
        
        const homeSectionsContainer = document.querySelector('.homeSectionsContainer');
        if (homeSectionsContainer && !homeSectionsContainer.querySelector('[data-custom-section-id]')) {
            checkAndRenderCustomSections();
        }
    }, 2000); // Check every 2 seconds
};

// Start periodic check after a short delay
setTimeout(startPeriodicCheck, 1000);

// Debug functions for troubleshooting (available in console)
window.debugHomeScreen = function() {
    LOG('Manual debug trigger called');
    checkAndRenderCustomSections();
};

window.debugCustomSections = function() {
    LOG('Custom sections configuration:', customHomeSections);
    LOG('Processing flag status:', isProcessing);
    
    // Check multiple selectors
    const selectors = [
        '.itemDetailPage:not(.hide) .homeSectionsContainer',
        '.homeSectionsContainer',
        '.homeSectionsContainer:not(.hide)',
        '[class*="homeSections"]'
    ];
    
    selectors.forEach(selector => {
        const element = document.querySelector(selector);
        LOG(`Selector "${selector}":`, element ? 'FOUND' : 'NOT FOUND', element);
    });
    
    // Log all elements with "home" or "section" in class name
    const allElements = document.querySelectorAll('*');
    const relevantElements = Array.from(allElements).filter(el => 
        el.className && typeof el.className === 'string' && 
        (el.className.toLowerCase().includes('home') || el.className.toLowerCase().includes('section'))
    );
    
    LOG('Elements with "home" or "section" in class:', relevantElements.map(el => ({
        tagName: el.tagName,
        className: el.className,
        id: el.id
    })));
    
    // Check if cardBuilder is available
    LOG('cardBuilder available:', typeof window.cardBuilder !== 'undefined');
    LOG('renderCardsFromIds available:', typeof window.cardBuilder?.renderCardsFromIds === 'function');
};

LOG('Home screen functionality initialized');
LOG('Debug functions available: window.debugHomeScreen(), window.debugCustomSections()');

})();
