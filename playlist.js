// Jellyfin Playlist Script
// Modifies playlist view page behavior to navigate to item details instead of playing
// Adds play button to playlist items
// Requires: cardBuilder.js module to be loaded before this script

(function() {
    'use strict';
    
    // Common logging function
    const LOG = (...args) => console.log('[Playlist]', ...args);
    const WARN = (...args) => console.warn('[Playlist]', ...args);
    const ERR = (...args) => console.error('[Playlist]', ...args);
    
    LOG('Script loaded - JS Injector mode');
    
    let currentPlaylistId = null;
    
    /**
     * Dynamically checks if playlist items have already been modified
     * @returns {boolean} - True if playlist items have been modified
     */
    function isPlaylistPageModified() {
        const libraryPage = document.querySelector('.libraryPage:not(.hide)');
        if (!libraryPage) {
            return false;
        }
        
        const childrenItemsContainer = libraryPage.querySelector('.childrenItemsContainer');
        if (!childrenItemsContainer) {
            return false;
        }
        
        const playlistItems = childrenItemsContainer.querySelectorAll('.listItem[data-playlistitemid]');
        if (playlistItems.length === 0) {
            return false;
        }
        
        // Check if any playlist item has a play button (indicating modification)
        for (const item of playlistItems) {
            const buttonsContainer = item.querySelector('.listViewUserDataButtons');
            if (buttonsContainer && buttonsContainer.querySelector('.playBtn')) {
                return true;
            }
        }
        
        return false;
    }
    
    /**
     * Checks if the current page is a playlist page by fetching the item details
     * @param {string} itemId - The item ID from the URL
     * @returns {Promise<boolean>} - True if the item is a Playlist
     */
    async function isPlaylistPage(itemId) {
        try {
            const apiClient = window.ApiClient;
            const serverUrl = apiClient.serverAddress();
            const token = apiClient.accessToken();
            
            const url = `${serverUrl}/Items/${itemId}`;
            
            const response = await fetch(url, {
                headers: {
                    "Authorization": `MediaBrowser Token="${token}"`
                }
            });
            
            if (!response.ok) {
                WARN(`Failed to fetch item details: ${response.status}`);
                return false;
            }
            
            const item = await response.json();
            LOG(`Item type: ${item.Type}, Name: ${item.Name}`);
            
            return item.Type === 'Playlist';
        } catch (error) {
            ERR('Error checking if item is playlist:', error);
            return false;
        }
    }
    
    /**
     * Modifies playlist item click behavior to navigate to details page
     */
    function modifyPlaylistItemClicks() {
        const libraryPage = document.querySelector('.libraryPage:not(.hide)');
        if (!libraryPage) {
            WARN('Library page not found');
            return;
        }
        
        const childrenItemsContainer = libraryPage.querySelector('.childrenItemsContainer');
        if (!childrenItemsContainer) {
            WARN('Children items container not found');
            return;
        }
        
        const playlistItems = childrenItemsContainer.querySelectorAll('.listItem[data-playlistitemid]');
        LOG(`Found ${playlistItems.length} playlist items`);
        
        playlistItems.forEach((item, index) => {
            const playlistItemId = item.getAttribute('data-playlistitemid');
            const serverId = ApiClient.serverId();
            
            if (!playlistItemId) {
                WARN(`Playlist item ${index} has no data-playlistitemid`);
                return;
            }
            
            // Remove existing click handlers
            item.removeAttribute('data-action');
            item.style.cursor = 'pointer';
            
            // Add new click handler to navigate to details page
            item.addEventListener('click', (e) => {
                // Check if the click target is within the listViewUserDataButtons container
                const buttonsContainer = item.querySelector('.listViewUserDataButtons');
                if (buttonsContainer && buttonsContainer.contains(e.target)) {
                    LOG(`Click on button detected, not navigating for item: ${playlistItemId}`);
                    return; // Don't navigate when clicking on buttons
                }
                
                e.preventDefault();
                e.stopPropagation();
                
                const detailsUrl = `#/details?id=${playlistItemId}&serverId=${serverId}`;
                LOG(`Navigating to: ${detailsUrl}`);
                
                // Use Jellyfin's navigation method
                if (window.Emby && window.Emby.Page) {
                    window.Emby.Page.show(detailsUrl);
                } else {
                    // Fallback to direct navigation
                    window.location.hash = detailsUrl;
                }
            });
            
            LOG(`Modified click handler for playlist item: ${playlistItemId}`);
        });
    }
    
    /**
     * Adds play button to each playlist item's listViewUserDataButtons container
     */
    function addPlayButtons() {
        const libraryPage = document.querySelector('.libraryPage:not(.hide)');
        if (!libraryPage) {
            WARN('Library page not found for play buttons');
            return;
        }
        
        const childrenItemsContainer = libraryPage.querySelector('.childrenItemsContainer');
        if (!childrenItemsContainer) {
            WARN('Children items container not found');
            return;
        }
        
        const playlistItems = childrenItemsContainer.querySelectorAll('.listItem[data-playlistitemid]');
        LOG(`Found ${playlistItems.length} playlist items to add play buttons to`);
        
        playlistItems.forEach((item, index) => {
            const playlistItemId = item.getAttribute('data-playlistitemid');
            const serverId = ApiClient.serverId();
            
            if (!playlistItemId) {
                WARN(`Playlist item ${index} has no data-playlistitemid`);
                return;
            }
            
            const buttonsContainer = item.querySelector('.listViewUserDataButtons');
            if (!buttonsContainer) {
                WARN(`No listViewUserDataButtons container found for playlist item ${index}`);
                return;
            }
            
            // Check if play button already exists for this item
            const existingPlayButton = buttonsContainer.querySelector('.playlist-play-button');
            if (existingPlayButton) {
                LOG(`Play button already exists for item ${index}`);
                return;
            }
            
            // Create play button following the same pattern as other buttons
            // Play button
            const playButton = document.createElement('button');
            playButton.setAttribute('is', 'paper-icon-button-light');
            playButton.className = 'itemAction paper-icon-button-light playBtn';
            playButton.setAttribute('data-action', 'resume');
            
            const playIcon = document.createElement('span');
            playIcon.className = 'material-icons play_arrow';
            playIcon.setAttribute('aria-hidden', 'true');
            playButton.appendChild(playIcon);
            
            // Prepend the play button to the container
            buttonsContainer.insertBefore(playButton, buttonsContainer.firstChild);
            
            LOG(`Added play button to playlist item ${index}: ${playlistItemId}`);
        });
        
        LOG(`Added play buttons to ${playlistItems.length} playlist items`);
    }
    
    /**
     * Main function to modify the playlist page
     * @param {string} itemId - The playlist item ID
     */
    async function modifyPlaylistPage(itemId) {
        if (isPlaylistPageModified()) {
            LOG('Playlist page already modified, skipping');
            return;
        }
        
        LOG(`Modifying playlist page for item: ${itemId}`);
        currentPlaylistId = itemId;
        
        // Wait a bit for the page to fully load
        setTimeout(() => {
            modifyPlaylistItemClicks();
            addPlayButtons();
            LOG('Playlist page modifications complete');
        }, 500);
    }
    
    /**
     * Resets the current playlist ID when navigating away from playlist page
     */
    function resetModificationState() {
        currentPlaylistId = null;
        LOG('Reset playlist modification state');
    }
    
    /**
     * Initialize playlist hook using utils
     */
    function initializePlaylistHook() {
        if (!window.KefinTweaksUtils) {
            WARN('KefinTweaksUtils not available, retrying in 1 second');
            setTimeout(initializePlaylistHook, 1000);
            return;
        }
        
        LOG('Registering playlist handler with KefinTweaksUtils');
        
        // Register handler for details pages
        window.KefinTweaksUtils.onViewPage((view, element) => {
            LOG('Details page detected via utils');
            
            // Check if we're on a details page
            const currentUrl = window.location.hash;
            if (currentUrl.includes('#/details')) {
                const urlParams = new URLSearchParams(currentUrl.split('?')[1]);
                const itemId = urlParams.get('id');
                
                if (itemId) {
                    LOG(`Details page detected with item ID: ${itemId}`);
                    
                    // Reset state when navigating to a new page
                    resetModificationState();
                    
                    // Check if this is a playlist page
                    isPlaylistPage(itemId).then(isPlaylist => {
                        if (isPlaylist) {
                            LOG(`Playlist page detected: ${itemId}`);
                            modifyPlaylistPage(itemId);
                        } else {
                            LOG(`Not a playlist page: ${itemId}`);
                        }
                    }).catch(error => {
                        ERR('Error checking playlist page:', error);
                    });
                }
            } else {
                // Not on a details page, reset state
                resetModificationState();
            }
        }, {
            immediate: true,
            pages: ['details']
        });
        
        LOG('Playlist hook initialized successfully');
    }
    
    // Initialize the hook when the script loads
    initializePlaylistHook();
    
    // Also check current page on script load in case we're already on a playlist page
    const currentUrl = window.location.hash;
    if (currentUrl.includes('#/details')) {
        const urlParams = new URLSearchParams(currentUrl.split('?')[1]);
        const itemId = urlParams.get('id');
        
        if (itemId) {
            LOG(`Script loaded on details page with item ID: ${itemId}`);
            isPlaylistPage(itemId).then(isPlaylist => {
                if (isPlaylist) {
                    LOG(`Already on playlist page: ${itemId}`);
                    modifyPlaylistPage(itemId);
                }
            }).catch(error => {
                ERR('Error checking current playlist page:', error);
            });
        }
    }
    
    console.log('[Playlist] Module loaded and ready');
})();
