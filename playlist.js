// Jellyfin Playlist Script
// Modifies playlist view page behavior to navigate to item details instead of playing
// Adds play button to playlist items
// Requires: utils.js, cardBuilder.js module to be loaded before this script

(function() {
    'use strict';
    
    // Common logging function
    const LOG = (...args) => console.log('[KefinTweaks Playlist]', ...args);
    const WARN = (...args) => console.warn('[KefinTweaks Playlist]', ...args);
    const ERR = (...args) => console.error('[KefinTweaks Playlist]', ...args);
    
    LOG('Initializing...');
    
    /**
     * Modifies playlist item click behavior to navigate to details page
     */
    function modifyPlaylistItemClicks() {
        const libraryPage = document.querySelector('.libraryPage:not(.hide)');
        if (!libraryPage) {
            WARN('Library page not found');
            return;
        }
        
        let childrenItemsContainer = libraryPage.querySelector('.childrenItemsContainer');
        if (!childrenItemsContainer) {
            childrenItemsContainer = libraryPage.querySelector('#listChildrenCollapsible');
            if (!childrenItemsContainer) {
                WARN('Children items container not found');
                return;
            }
        }
        
        const playlistItems = childrenItemsContainer.querySelectorAll('.listItem[data-playlistitemid]');
        LOG(`Found ${playlistItems.length} playlist items`);
        
        playlistItems.forEach((item, index) => {
            if (item.dataset.customPlaylistButton === 'true') {
                LOG(`Playlist item ${index} already has a custom button, skipping`);
                return;
            }

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
                handlePlaylistItemClick(e, item, playlistItemId, serverId);
            });

            item.dataset.customPlaylistButton = 'true';
        });
    }

    function handlePlaylistItemClick(e, item, playlistItemId, serverId) {
        // Check if the click target is within the listViewUserDataButtons container
        const buttonsContainer = item.querySelector('.listViewUserDataButtons');
        if (buttonsContainer && buttonsContainer.contains(e.target)) {
            LOG(`Click on button detected, not navigating for item: ${playlistItemId}`);
            return; // Don't navigate when clicking on buttons
        }
        
        e.preventDefault();
        e.stopPropagation();
        
        const detailsUrl = `/details?id=${playlistItemId}&serverId=${serverId}`;
        LOG(`Navigating to: ${detailsUrl}`);
        
        // Use Jellyfin's navigation method
        if (Dashboard) {
            Dashboard.navigate(detailsUrl);
        } else {
            // Fallback to direct navigation
            const fullDetailsUrl = `${ApiClient.serverAddress()}/web/#${detailsUrl}`;
            window.location.href = fullDetailsUrl;
        }
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
        
        let childrenItemsContainer = libraryPage.querySelector('.childrenItemsContainer');
        if (!childrenItemsContainer) {
            childrenItemsContainer = libraryPage.querySelector('#listChildrenCollapsible');
            if (!childrenItemsContainer) {
                WARN('Children items container not found for play buttons');
                return;
            }
        }
        
        const playlistItems = childrenItemsContainer.querySelectorAll('.listItem[data-playlistitemid]');
        LOG(`Found ${playlistItems.length} playlist items to add play buttons to`);
        
        playlistItems.forEach((item, index) => {
            const playlistItemId = item.getAttribute('data-playlistitemid');
            
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
        });
        
        LOG(`Added play buttons to ${playlistItems.length} playlist items`);
    }
    
    /**
     * Main function to modify the playlist page
     * @param {string} itemId - The playlist item ID
     */
    async function modifyPlaylistPage() {
        if (document.querySelector('.libraryPage:not(.hide)')?.dataset?.kefinPlaylist === 'true') {
            LOG('Playlist page already modified, skipping');
            return;
        }
        
        // Poll for page elements to be ready (every 100ms for up to 10 seconds)
        const pollInterval = 100;
        const maxAttempts = 100; // 100ms * 100 = 10 seconds
        let attempts = 0;
        
        const pollForElements = () => {
            attempts++;
            
            const libraryPage = document.querySelector('.libraryPage:not(.hide)');
            if (!libraryPage) {
                if (attempts < maxAttempts) {
                    setTimeout(pollForElements, pollInterval);
                } else {
                    WARN('Library page not found after 10 seconds');
                }
                return;
            }
            
            let childrenItemsContainer = libraryPage.querySelector('.childrenItemsContainer');
            if (!childrenItemsContainer) {
                childrenItemsContainer = libraryPage.querySelector('#listChildrenCollapsible');
                if (!childrenItemsContainer) {
                    if (attempts < maxAttempts) {
                        setTimeout(pollForElements, pollInterval);
                    } else {
                        WARN('Children items container not found after 10 seconds');
                    }
                    return;
                }
            }

            const playlistItems = childrenItemsContainer.querySelectorAll('.listItem[data-playlistitemid]');
            if (playlistItems.length === 0) {
                if (attempts < maxAttempts) {
                    setTimeout(pollForElements, pollInterval);
                } else {
                    WARN('No playlist items found after 10 seconds');
                }
                return;
            }

            if (libraryPage.dataset.kefinPlaylist === 'true') {
                LOG('Playlist page already modified, skipping');
                return;
            }
            
            // Elements found, proceed with modifications
            libraryPage.dataset.kefinPlaylist = 'true';
            modifyPlaylistItemClicks();
            addPlayButtons();
            LOG('Playlist page modifications complete');
        };
        
        pollForElements();
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
        window.KefinTweaksUtils.onViewPage(async (view, element, itemPromise) => {
            // Await the item promise to get the actual item data
            const item = await itemPromise;
            if (item && item.Type === 'Playlist') {
                modifyPlaylistPage();
                return;
            }
        }, {
            immediate: true,
            pages: ['details']
        });
        
        LOG('Playlist hook initialized successfully');
    }
    
    // Initialize the hook when the script loads
    initializePlaylistHook();
    
    console.log('[KefinTweaks Playlist] Module loaded and ready');
})();
