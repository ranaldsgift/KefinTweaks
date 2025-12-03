// Jellyfin Playlist Script
// Modifies playlist view page behavior to navigate to item details instead of playing
// Adds play button to playlist items
// Adds sorting functionality to playlist pages
// Requires: utils.js, cardBuilder.js, modal.js modules to be loaded before this script

(function() {
    'use strict';
    
    // Common logging function
    const LOG = (...args) => console.log('[KefinTweaks Playlist]', ...args);
    const WARN = (...args) => console.warn('[KefinTweaks Playlist]', ...args);
    const ERR = (...args) => console.error('[KefinTweaks Playlist]', ...args);
    
    LOG('Initializing...');

    // ========== SORTING FUNCTIONALITY ==========
    
    // localStorage key prefix
    const STORAGE_KEY_PREFIX_SORT = 'kefinTweaks_playlistSort_';
    const STORAGE_KEY_PREFIX_DIRECTION = 'kefinTweaks_playlistSortDirection_';

    // Sort options
    const SORT_OPTIONS = {
        'sortTitle': { label: 'Sort Title', field: 'SortName', defaultDirection: 'asc' },
        'releaseDate': { label: 'Release Date', field: 'PremiereDate', defaultDirection: 'asc' },
        'dateAdded': { label: 'Date Added', field: 'DateCreated', defaultDirection: 'desc' },
        'communityRating': { label: 'Community Rating', field: 'CommunityRating', defaultDirection: 'desc' },
        'criticRating': { label: 'Critic Rating', field: 'CriticRating', defaultDirection: 'desc' }
    };

    // Store playlist data per page
    const playlistData = new Map();
    
    // Single MutationObserver for the current playlist (only one can exist at a time)
    let playlistObserver = null;

    /**
     * Get current sort preference from localStorage
     * @param {string} playlistId - Playlist item ID
     * @returns {string} Sort key
     */
    function getCurrentSort(playlistId) {
        const storageKey = STORAGE_KEY_PREFIX_SORT + playlistId;
        const savedSort = localStorage.getItem(storageKey);
        if (savedSort && SORT_OPTIONS[savedSort]) {
            return savedSort;
        }
        return 'sortTitle'; // Default sort
    }

    /**
     * Get current sort direction from localStorage
     * @param {string} playlistId - Playlist item ID
     * @param {string} sortKey - Current sort key
     * @returns {string} 'asc' or 'desc'
     */
    function getCurrentSortDirection(playlistId, sortKey) {
        const storageKey = STORAGE_KEY_PREFIX_DIRECTION + playlistId;
        const savedDirection = localStorage.getItem(storageKey);
        if (savedDirection === 'asc' || savedDirection === 'desc') {
            return savedDirection;
        }
        // Default to the sort option's default direction
        return SORT_OPTIONS[sortKey].defaultDirection;
    }

    /**
     * Save sort preference to localStorage
     * @param {string} playlistId - Playlist item ID
     * @param {string} sortKey - Sort key
     * @param {string} direction - 'asc' or 'desc'
     */
    function saveSortPreference(playlistId, sortKey, direction) {
        const sortStorageKey = STORAGE_KEY_PREFIX_SORT + playlistId;
        const directionStorageKey = STORAGE_KEY_PREFIX_DIRECTION + playlistId;
        localStorage.setItem(sortStorageKey, sortKey);
        localStorage.setItem(directionStorageKey, direction);
    }

    /**
     * Fetch playlist children items with server-side sorting
     * @param {string} playlistId - Playlist item ID
     * @returns {Promise<Array>} Array of child items (already sorted by server)
     */
    async function fetchPlaylistChildren(playlistId) {
        try {
            const userId = ApiClient.getCurrentUserId();
            
            // Get current sort preferences
            const sortKey = getCurrentSort(playlistId);
            const direction = getCurrentSortDirection(playlistId, sortKey);
            
            // Map sort key to Jellyfin API SortBy parameter
            const sortOption = SORT_OPTIONS[sortKey];
            const sortBy = sortOption ? sortOption.field : 'SortName';
            
            // Map direction to Jellyfin API SortOrder parameter
            const sortOrder = direction === 'asc' ? 'Ascending' : 'Descending';
            
            const response = await ApiClient.getItems(userId, {
                ParentId: playlistId,
                Fields: 'PrimaryImageAspectRatio,DateCreated,CommunityRating,CriticRating,SortName,PremiereDate,UserData',
                SortBy: sortBy,
                SortOrder: sortOrder
            });
            return response.Items || [];
        } catch (error) {
            ERR('Error fetching playlist children:', error);
            return [];
        }
    }

    /**
     * Sort items array based on current sort criteria
     * @param {Array} items - Array of item objects
     * @param {string} sortKey - Sort key
     * @param {string} direction - 'asc' or 'desc'
     * @returns {Array} Sorted array
     */
    function sortItems(items, sortKey, direction) {
        const sortOption = SORT_OPTIONS[sortKey];
        if (!sortOption) {
            WARN('Invalid sort key:', sortKey);
            return items;
        }

        const field = sortOption.field;
        const sorted = [...items].sort((a, b) => {
            let valueA = a[field];
            let valueB = b[field];

            // Handle null/undefined values
            if (valueA == null && valueB == null) return 0;
            if (valueA == null) return 1;
            if (valueB == null) return -1;

            // Handle dates
            if (field === 'PremiereDate' || field === 'DateCreated') {
                valueA = valueA ? new Date(valueA).getTime() : 0;
                valueB = valueB ? new Date(valueB).getTime() : 0;
            }

            // Handle numbers (ratings)
            if (field === 'CommunityRating' || field === 'CriticRating') {
                valueA = valueA || 0;
                valueB = valueB || 0;
            }

            // Handle strings (sort title)
            if (typeof valueA === 'string' && typeof valueB === 'string') {
                valueA = valueA.toLowerCase();
                valueB = valueB.toLowerCase();
            }

            // Compare values
            if (valueA < valueB) return direction === 'asc' ? -1 : 1;
            if (valueA > valueB) return direction === 'asc' ? 1 : -1;
            return 0;
        });

        return sorted;
    }

    /**
     * Reorder DOM list items to match sorted items order
     * @param {HTMLElement} itemsContainer - Container with .listItem elements
     * @param {Array} sortedItems - Sorted array of items
     */
    function reorderListItems(itemsContainer, sortedItems) {
        if (!itemsContainer) {
            WARN('Items container not found');
            return;
        }

        const listItems = Array.from(itemsContainer.querySelectorAll('.listItem[data-playlistitemid]'));
        if (listItems.length === 0) {
            WARN('No list items found in container');
            return;
        }

        // Create a map of item ID to list item element
        const itemMap = new Map();
        listItems.forEach(listItem => {
            const itemId = listItem.getAttribute('data-playlistitemid');
            if (itemId) {
                itemMap.set(itemId, listItem);
            }
        });

        // Check if reordering is needed by comparing current order with desired order
        const currentOrder = listItems.map(item => item.getAttribute('data-playlistitemid'));
        const desiredOrder = sortedItems.map(item => item.Id);
        
        // If order matches, no need to reorder
        if (currentOrder.length === desiredOrder.length && 
            currentOrder.every((id, index) => id === desiredOrder[index])) {
            LOG('List items already in correct order');
            return;
        }

        // Reorder list items in-place without removing/re-adding them all
        let lastInserted = null;
        sortedItems.forEach((item) => {
            const listItem = itemMap.get(item.Id);
            if (listItem) {
                // Only move if not already in correct position
                if (lastInserted === null) {
                    // Should be first child
                    if (itemsContainer.firstChild !== listItem) {
                        itemsContainer.insertBefore(listItem, itemsContainer.firstChild);
                    }
                } else {
                    // Should come right after lastInserted
                    if (lastInserted.nextSibling !== listItem) {
                        itemsContainer.insertBefore(listItem, lastInserted.nextSibling);
                    }
                }
                lastInserted = listItem;
            }
        });
    }

    /**
     * Sort playlist items and update DOM
     * @param {string} playlistId - Playlist item ID
     */
    function sortPlaylistItems(playlistId) {
        const data = playlistData.get(playlistId);
        if (!data || !data.items || !data.itemsContainer) {
            WARN('Playlist data not found for:', playlistId);
            return;
        }

        const sortKey = getCurrentSort(playlistId);
        const direction = getCurrentSortDirection(playlistId, sortKey);

        LOG(`Sorting playlist ${playlistId} by ${sortKey} (${direction})`);

        // Sort items
        const sortedItems = sortItems(data.items, sortKey, direction);

        // Update stored items
        data.items = sortedItems;

        // Reorder DOM
        reorderListItems(data.itemsContainer, sortedItems);
        
        // Update play button text and "Play from beginning" button visibility in case first item changed
        const activePage = document.querySelector('.libraryPage:not(.hide)');
        if (activePage) {
            const mainDetailButtons = activePage.querySelector('.mainDetailButtons');
            if (mainDetailButtons) {
                const playButton = mainDetailButtons.querySelector('.btnPlay') ||
                                 mainDetailButtons.querySelector('button[data-kt-playlist-sorting-overridden="true"]');
                if (playButton) {
                    updatePlayButtonText(playButton, playlistId);
                }
                // Update "Play from beginning" button visibility
                addResumeButton(mainDetailButtons, playlistId);
            }
        }
    }

    /**
     * Show sort selection modal
     * @param {string} playlistId - Playlist item ID
     */
    function showSortModal(playlistId) {
        const currentSort = getCurrentSort(playlistId);
        const currentDirection = getCurrentSortDirection(playlistId, currentSort);

        // Build modal content matching collections sort modal structure
        const sortOptionsContent = `
            <h2 style="margin: 0 0 .5em;">Sort By</h2>
            <div>
                ${Object.entries(SORT_OPTIONS).map(([key, option]) => {
                    const checked = key === currentSort ? 'checked=""' : '';
                    return `
                        <label class="radio-label-block mdl-radio mdl-js-radio mdl-js-ripple-effect show-focus">
                            <input type="radio" is="emby-radio" name="sortOption" data-id="${key}" value="${key}" class="menuSortBy mdl-radio__button" data-radio="true" ${checked}>
                            <div class="mdl-radio__circles">
                                <svg>
                                    <defs>
                                        <clipPath id="cutoff-playlist-${key}">
                                            <circle cx="50%" cy="50%" r="50%"></circle>
                                        </clipPath>
                                    </defs>
                                    <circle class="mdl-radio__outer-circle" cx="50%" cy="50%" r="50%" fill="none" stroke="currentcolor" stroke-width="0.26em" clip-path="url(#cutoff-playlist-${key})"></circle>
                                    <circle class="mdl-radio__inner-circle" cx="50%" cy="50%" r="25%" fill="currentcolor"></circle>
                                </svg>
                                <div class="mdl-radio__focus-circle"></div>
                            </div>
                            <span class="radioButtonLabel mdl-radio__label">${option.label}</span>
                        </label>
                    `;
                }).join('')}
            </div>
            <h2 style="margin: 1em 0 .5em;">Sort Order</h2>
            <div>
                <label class="radio-label-block mdl-radio mdl-js-radio mdl-js-ripple-effect show-focus">
                    <input type="radio" is="emby-radio" name="sortDirection" value="asc" class="menuSortOrder mdl-radio__button" data-radio="true" ${currentDirection === 'asc' ? 'checked=""' : ''}>
                    <div class="mdl-radio__circles">
                        <svg>
                            <defs>
                                <clipPath id="cutoff-playlist-asc">
                                    <circle cx="50%" cy="50%" r="50%"></circle>
                                </clipPath>
                            </defs>
                            <circle class="mdl-radio__outer-circle" cx="50%" cy="50%" r="50%" fill="none" stroke="currentcolor" stroke-width="0.26em" clip-path="url(#cutoff-playlist-asc)"></circle>
                            <circle class="mdl-radio__inner-circle" cx="50%" cy="50%" r="25%" fill="currentcolor"></circle>
                        </svg>
                        <div class="mdl-radio__focus-circle"></div>
                    </div>
                    <span class="radioButtonLabel mdl-radio__label">Ascending</span>
                </label>
                <label class="radio-label-block mdl-radio mdl-js-radio mdl-js-ripple-effect show-focus">
                    <input type="radio" is="emby-radio" name="sortDirection" value="desc" class="menuSortOrder mdl-radio__button" data-radio="true" ${currentDirection === 'desc' ? 'checked=""' : ''}>
                    <div class="mdl-radio__circles">
                        <svg>
                            <defs>
                                <clipPath id="cutoff-playlist-desc">
                                    <circle cx="50%" cy="50%" r="50%"></circle>
                                </clipPath>
                            </defs>
                            <circle class="mdl-radio__outer-circle" cx="50%" cy="50%" r="50%" fill="none" stroke="currentcolor" stroke-width="0.26em" clip-path="url(#cutoff-playlist-desc)"></circle>
                            <circle class="mdl-radio__inner-circle" cx="50%" cy="50%" r="25%" fill="currentcolor"></circle>
                        </svg>
                        <div class="mdl-radio__focus-circle"></div>
                    </div>
                    <span class="radioButtonLabel mdl-radio__label">Descending</span>
                </label>
            </div>
        `;

        // Create modal using the generic modal system
        const modal = window.ModalSystem.create({
            id: 'kt-playlist-sort-modal',
            content: sortOptionsContent,
            onOpen: (modalInstance) => {
                // Set current selection
                const currentRadio = modalInstance.dialog.querySelector(`input[value="${currentSort}"]`);
                const currentDirectionRadio = modalInstance.dialog.querySelector(`input[value="${currentDirection}"]`);
                if (currentRadio) {
                    currentRadio.checked = true;
                }
                if (currentDirectionRadio) {
                    currentDirectionRadio.checked = true;
                }

                // Add event listeners for radio button changes
                const sortOptions = modalInstance.dialog.querySelectorAll('input[name="sortOption"]');
                const sortDirections = modalInstance.dialog.querySelectorAll('input[name="sortDirection"]');
                
                // Apply changes immediately when radio buttons change
                const applyChanges = () => {
                    const selectedOption = modalInstance.dialog.querySelector('input[name="sortOption"]:checked');
                    const selectedDirection = modalInstance.dialog.querySelector('input[name="sortDirection"]:checked');
                    if (selectedOption) {
                        const direction = selectedDirection ? selectedDirection.value : getCurrentSortDirection(playlistId, selectedOption.value);
                        saveSortPreference(playlistId, selectedOption.value, direction);
                        sortPlaylistItems(playlistId);
                    }
                };
                
                sortOptions.forEach(option => {
                    option.addEventListener('change', applyChanges);
                });
                
                sortDirections.forEach(direction => {
                    direction.addEventListener('change', applyChanges);
                });
            }
        });
    }

    /**
     * Get sorted playlist item IDs for playback
     * Items are already sorted by the server via fetchPlaylistChildren
     * @param {string} playlistId - Playlist item ID
     * @param {boolean} resume - If true, filter out played items from the start
     * @returns {Promise<Array<string>>} Array of sorted item IDs
     */
    async function getSortedPlaylistItemIds(playlistId, resume = false) {
        // Check if we have cached data
        const data = playlistData.get(playlistId);
        let items = data?.items;

        // If no cached data, fetch it (already sorted by server)
        if (!items || items.length === 0) {
            items = await fetchPlaylistChildren(playlistId);
            if (items.length === 0) {
                WARN('No items found for playlist:', playlistId);
                return [];
            }
        }

        // Items are already sorted by the server, no need to sort client-side

        // If resume mode, filter out played items from the start
        if (resume) {
            // Find the first unplayed item
            let firstUnplayedIndex = -1;
            for (let i = 0; i < items.length; i++) {
                const isPlayed = items[i].UserData?.Played === true;
                if (!isPlayed) {
                    firstUnplayedIndex = i;
                    break;
                }
            }

            // If we found an unplayed item, return from that index onwards (includes all remaining items)
            if (firstUnplayedIndex >= 0) {
                items = items.slice(firstUnplayedIndex);
                LOG(`Resume mode: Starting from item ${firstUnplayedIndex + 1} (${items.length} items remaining)`);
            } else {
                // All items are played, return empty array
                LOG('Resume mode: All items are already played');
                return [];
            }
        }

        // Extract IDs
        return items.map(item => item.Id);
    }

    /**
     * Update play button text to "Resume" if first item is played
     * @param {HTMLElement} playButton - The play button element
     * @param {string} playlistId - Playlist item ID
     */
    async function updatePlayButtonText(playButton, playlistId) {
        try {
            // Check if we have cached data
            const data = playlistData.get(playlistId);
            let items = data?.items;

            // If no cached data, fetch it (already sorted by server)
            if (!items || items.length === 0) {
                items = await fetchPlaylistChildren(playlistId);
            }

            if (items && items.length > 0) {
                const firstItem = items[0];
                const isFirstItemPlayed = firstItem.UserData?.Played === true;
                
                if (isFirstItemPlayed) {
                    // Update button title/text to "Resume"
                    playButton.title = 'Resume';
                    
                    // Also update any text content if present
                    const textSpan = playButton.querySelector('.detailButton-text, .buttonText');
                    if (textSpan) {
                        textSpan.textContent = 'Resume';
                    }
                    
                    LOG('First item is played, updated Play button to Resume');
                } else {
                    // Ensure it says "Play"
                    playButton.title = playButton.title || 'Play';
                    
                    const textSpan = playButton.querySelector('.detailButton-text, .buttonText');
                    if (textSpan) {
                        textSpan.textContent = 'Play';
                    }
                }
            }
        } catch (error) {
            WARN('Error updating play button text:', error);
        }
    }

    /**
     * Override play button to use sorted playlist items
     * @param {HTMLElement} mainDetailButtons - Main detail buttons container
     * @param {string} playlistId - Playlist item ID
     */
    function overridePlayButton(mainDetailButtons, playlistId) {
        // Find the play button - try multiple selectors
        let playButton = mainDetailButtons.querySelector('.btnPlay') ||
                        mainDetailButtons.querySelector('button[data-action="play"]');
        
        // If not found, search for button with play icon
        if (!playButton) {
            const buttons = mainDetailButtons.querySelectorAll('button');
            playButton = Array.from(buttons).find(btn => {
                const icon = btn.querySelector('.material-icons');
                if (icon) {
                    const iconText = icon.textContent.trim();
                    return iconText === 'play_arrow' || iconText === 'play';
                }
                return false;
            });
        }

        if (!playButton) {
            WARN('Play button not found in mainDetailButtons');
            return;
        }

        // Check if already overridden
        if (playButton.dataset.ktPlaylistSortingOverridden === 'true') {
            return;
        }

        LOG('Overriding play button for playlist:', playlistId);

        // Forcefully clear all existing event listeners by cloning the node
        // This removes all event listeners attached via addEventListener
        const clonedButton = playButton.cloneNode(true);
        
        // Preserve important attributes and classes
        clonedButton.className = playButton.className;
        clonedButton.id = playButton.id;
        clonedButton.title = playButton.title;
        clonedButton.setAttribute('is', playButton.getAttribute('is') || '');
        clonedButton.type = playButton.type || 'button';
        
        // Remove data-action and other attributes that might trigger default handlers
        clonedButton.removeAttribute('data-action');
        clonedButton.removeAttribute('onclick');
        
        // Clear any onclick property
        clonedButton.onclick = null;
        
        // Replace the original button with the cloned one (this removes all event listeners)
        playButton.parentNode.replaceChild(clonedButton, playButton);
        
        // Check if first item is played and update button text accordingly
        updatePlayButtonText(clonedButton, playlistId);
        
        // Now add our custom click handler - Play button now defaults to Resume behavior
        clonedButton.onclick = async (e) => {
            e.preventDefault();
            e.stopPropagation();
            e.stopImmediatePropagation(); // Prevent any other handlers

            try {
                // Get sorted item IDs with resume mode (skip played items from start)
                const sortedIds = await getSortedPlaylistItemIds(playlistId, true);
                
                if (sortedIds.length === 0) {
                    WARN('No items to resume for playlist:', playlistId);
                    return;
                }
                

                LOG(`Resuming ${sortedIds.length} sorted items from playlist:`, playlistId);

                // Use apiHelper if available, otherwise fallback to ApiClient
                if (window.apiHelper && window.apiHelper.playItem) {
                    await window.apiHelper.playItem(sortedIds);
                } else {
                    ERR('No play method available');
                }
            } catch (error) {
                ERR('Error resuming sorted playlist:', error);
            }
        };

        // Mark as overridden
        clonedButton.dataset.ktPlaylistSortingOverridden = 'true';
    }

    /**
     * Create and add sort button to mainDetailButtons container (after Favorite button)
     * @param {HTMLElement} mainDetailButtons - Main detail buttons container
     * @param {string} playlistId - Playlist item ID
     */
    function addSortButton(mainDetailButtons, playlistId) {
        // Check if button already exists
        if (mainDetailButtons.querySelector('.kt-playlist-sort-btn')) {
            return;
        }

        // Find Favorite button to insert after it
        const favoriteButton = mainDetailButtons.querySelector('button[data-isfavorite]') ||
                              mainDetailButtons.querySelector('button[is="emby-ratingbutton"]') ||
                              Array.from(mainDetailButtons.querySelectorAll('button')).find(btn => {
                                  const icon = btn.querySelector('.material-icons');
                                  return icon && icon.textContent.trim() === 'favorite';
                              });

        // Create button using emby-playstatebutton format
        const button = document.createElement('button');
        button.setAttribute('is', 'emby-playstatebutton');
        button.type = 'button';
        button.className = 'button-flat btnPlaystate detailButton emby-button kt-playlist-sort-btn';
        button.title = 'Sort Playlist';

        // Create detailButton-content wrapper
        const contentWrapper = document.createElement('div');
        contentWrapper.className = 'detailButton-content';

        // Create icon
        const icon = document.createElement('span');
        icon.className = 'material-icons detailButton-icon sort';
        icon.setAttribute('aria-hidden', 'true');

        contentWrapper.appendChild(icon);
        button.appendChild(contentWrapper);

        // Add click handler
        button.onclick = (e) => {
            e.preventDefault();
            e.stopPropagation();
            showSortModal(playlistId);
        };

        // Insert after Favorite button, or append if not found
        if (favoriteButton && favoriteButton.nextSibling) {
            mainDetailButtons.insertBefore(button, favoriteButton.nextSibling);
        } else if (favoriteButton) {
            favoriteButton.insertAdjacentElement('afterend', button);
        } else {
            // Fallback: append to container
            mainDetailButtons.appendChild(button);
        }
    }

    /**
     * Create and add "Play from beginning" button next to play button
     * Only shows if the first item is already played
     * @param {HTMLElement} mainDetailButtons - Main detail buttons container
     * @param {string} playlistId - Playlist item ID
     */
    async function addResumeButton(mainDetailButtons, playlistId) {
        // Check if button already exists - if so, update its visibility
        const existingButton = mainDetailButtons.querySelector('.kt-playlist-resume-btn');
        
        // Check if first item is played
        let isFirstItemPlayed = false;
        try {
            const data = playlistData.get(playlistId);
            let items = data?.items;

            // If no cached data, fetch it (already sorted by server)
            if (!items || items.length === 0) {
                items = await fetchPlaylistChildren(playlistId);
            }

            if (items && items.length > 0) {
                const firstItem = items[0];
                isFirstItemPlayed = firstItem.UserData?.Played === true;
            }
        } catch (error) {
            WARN('Error checking first item played status:', error);
        }

        // If first item is not played, hide or remove the button
        if (!isFirstItemPlayed) {
            if (existingButton) {
                existingButton.style.display = 'none';
            }
            return;
        }

        // If button exists and first item is played, show it
        if (existingButton) {
            existingButton.style.display = '';
            return;
        }

        // Find the play button to insert after it
        let playButton = mainDetailButtons.querySelector('.btnPlay') ||
                        mainDetailButtons.querySelector('button[data-action="play"]');
        
        if (!playButton) {
            const buttons = mainDetailButtons.querySelectorAll('button');
            playButton = Array.from(buttons).find(btn => {
                const icon = btn.querySelector('.material-icons');
                if (icon) {
                    const iconText = icon.textContent.trim();
                    return iconText === 'play_arrow' || iconText === 'play';
                }
                return false;
            });
        }

        if (!playButton) {
            WARN('Play button not found, cannot add play from beginning button');
            return;
        }

        // Create "Play from beginning" button using emby-playstatebutton format
        const button = document.createElement('button');
        button.setAttribute('is', 'emby-playstatebutton');
        button.type = 'button';
        button.className = 'button-flat btnPlaystate detailButton emby-button kt-playlist-resume-btn';
        button.title = 'Play from Beginning';

        // Create detailButton-content wrapper
        const contentWrapper = document.createElement('div');
        contentWrapper.className = 'detailButton-content';

        // Create icon - using refresh/replay icon for "play from beginning"
        const icon = document.createElement('span');
        icon.className = 'material-icons detailButton-icon replay';
        icon.setAttribute('aria-hidden', 'true');

        contentWrapper.appendChild(icon);
        button.appendChild(contentWrapper);

        // Add click handler - play all items from beginning (no resume filtering)
        button.onclick = async (e) => {
            e.preventDefault();
            e.stopPropagation();
            e.stopImmediatePropagation();

            try {
                // Get sorted item IDs without resume mode (play all items from beginning)
                const sortedIds = await getSortedPlaylistItemIds(playlistId, false);
                
                if (sortedIds.length === 0) {
                    WARN('No items to play for playlist:', playlistId);
                    return;
                }

                LOG(`Playing from beginning ${sortedIds.length} items from playlist:`, playlistId);

                // Use apiHelper if available, otherwise fallback to ApiClient
                if (window.apiHelper && window.apiHelper.playItem) {
                    await window.apiHelper.playItem(sortedIds);
                } else if (window.ApiClient && typeof window.ApiClient.play === 'function') {
                    await window.ApiClient.play({ ids: sortedIds });
                } else if (window.PlaybackManager && window.PlaybackManager.play) {
                    await window.PlaybackManager.play({
                        ids: sortedIds,
                        serverId: window.ApiClient.serverId()
                    });
                } else {
                    ERR('No play method available');
                }
            } catch (error) {
                ERR('Error playing from beginning:', error);
            }
        };

        // Insert after play button
        if (playButton.nextSibling) {
            mainDetailButtons.insertBefore(button, playButton.nextSibling);
        } else {
            playButton.insertAdjacentElement('afterend', button);
        }
    }

    /**
     * Poll for an element to appear in the DOM
     * @param {Function} selectorFn - Function that returns the element or null
     * @param {number} maxWaitTime - Maximum time to wait in milliseconds (default: 5000)
     * @param {number} pollInterval - Interval between checks in milliseconds (default: 500)
     * @returns {Promise<HTMLElement|null>} The element if found, null otherwise
     */
    async function pollForElement(selectorFn, maxWaitTime = 5000, pollInterval = 500) {
        const startTime = Date.now();
        
        while (Date.now() - startTime < maxWaitTime) {
            const element = selectorFn();
            if (element) {
                return element;
            }
            await new Promise(resolve => setTimeout(resolve, pollInterval));
        }
        
        return null;
    }

    /**
     * Re-apply sorting after container re-render
     * @param {string} playlistId - Playlist item ID
     * @param {HTMLElement} playlistItemsContainer - Playlist items container
     */
    async function reapplyPlaylistSorting(playlistId, playlistItemsContainer) {
        // Find items container
        const itemsContainer = playlistItemsContainer.classList.contains('itemsContainer') ? playlistItemsContainer : playlistItemsContainer.querySelector('.childrenItemsContainer') || 
                              playlistItemsContainer.querySelector('#listChildrenCollapsible');

        if (!itemsContainer) {
            WARN('Items container not found after re-render for playlist:', playlistId);
            return;
        }

        // Check if sort button exists in mainDetailButtons, if not add it
        const activePage = document.querySelector('.libraryPage:not(.hide)');
        if (activePage) {
            const mainDetailButtons = activePage.querySelector('.mainDetailButtons');
            if (mainDetailButtons) {
                const sortButton = mainDetailButtons.querySelector('.kt-playlist-sort-btn');
                if (!sortButton) {
                    LOG('Sort button missing after re-render, re-adding for playlist:', playlistId);
                    addSortButton(mainDetailButtons, playlistId);
                }
                // Re-add resume button in case it was recreated
                await addResumeButton(mainDetailButtons, playlistId);
                // Re-override play button in case it was recreated
                overridePlayButton(mainDetailButtons, playlistId);
            }
        }

        // Update stored items container reference (in case it was recreated)
        const data = playlistData.get(playlistId);
        if (data) {
            data.itemsContainer = itemsContainer;
            
            // Re-apply sort
            sortPlaylistItems(playlistId);
        } else {
            WARN('Playlist data not found for re-render:', playlistId);
        }
    }

    /**
     * Setup MutationObserver for playlist items container
     * @param {string} playlistId - Playlist item ID
     * @param {HTMLElement} playlistItemsContainer - Playlist items container
     */
    function setupPlaylistObserver(playlistId, playlistItemsContainer) {
        // Disconnect existing observer if any
        if (playlistObserver) {
            playlistObserver.disconnect();
            playlistObserver = null;
        }

        // Debounce timer for re-apply
        let debounceTimer = null;

        playlistObserver = new MutationObserver((mutations) => {
            let shouldReapply = false;

            mutations.forEach((mutation) => {
                if (mutation.type === 'childList') {
                    // Check if nodes were added (indicating a re-render)
                    if (mutation.addedNodes.length > 0) {
                        // Check if any added node is a direct child or contains important elements
                        mutation.addedNodes.forEach((node) => {
                            if (node.nodeType === Node.ELEMENT_NODE) {
                                // If listItem was added, we need to reapply
                                if (node.classList?.contains('listItem') || 
                                    node.classList?.contains('childrenItemsContainer') ||
                                    node.classList?.contains('listChildrenCollapsible') ||
                                    node.querySelector?.('.listItem[data-playlistitemid]') ||
                                    node.querySelector?.('.childrenItemsContainer') ||
                                    node.querySelector?.('#listChildrenCollapsible')) {
                                    shouldReapply = true;
                                }
                            }
                        });
                    }
                }
            });

            if (shouldReapply) {
                // Debounce to avoid multiple rapid re-applications
                clearTimeout(debounceTimer);
                debounceTimer = setTimeout(() => {
                    LOG('Playlist container re-rendered, re-applying sort for:', playlistId);
                    reapplyPlaylistSorting(playlistId, playlistItemsContainer);
                }, 300); // 300ms debounce
            }
        });

        // Observe the playlist items container with childList changes
        playlistObserver.observe(playlistItemsContainer, {
            childList: true,
            subtree: true
        });

        LOG('MutationObserver set up for playlist:', playlistId);
    }

    /**
     * Add playlist sorting functionality
     * @param {Object} item - Playlist item
     */
    async function addPlaylistSorting(item) {
        if (!item || item.Type !== 'Playlist' || !item.Id) {
            return;
        }

        const playlistId = item.Id;
        const activePage = document.querySelector('.libraryPage:not(.hide)');
        if (!activePage) {
            return;
        }

        // Find playlist items container
        let playlistItemsContainer = activePage.querySelector('.childrenItemsContainer');
        if (!playlistItemsContainer) {
            playlistItemsContainer = activePage.querySelector('#listChildrenCollapsible');
            if (!playlistItemsContainer) {
                WARN('Playlist items container not found');
                return;
            }
        }

        // Check if already processed (but allow re-processing if button is missing)
        const mainDetailButtons = activePage.querySelector('.mainDetailButtons');
        const sortButton = mainDetailButtons?.querySelector('.kt-playlist-sort-btn');
        if (activePage.dataset.playlistSortingAdded === 'true' && sortButton) {
            return;
        }

        // Poll for mainDetailButtons (up to 5 seconds, every 100ms)
        const detailButtons = await pollForElement(() => {
            return activePage.querySelector('.mainDetailButtons');
        }, 5000, 100);

        if (!detailButtons) {
            WARN('Main detail buttons not found after polling for 5 seconds');
            return;
        }

        // Find items container
        const itemsContainer = playlistItemsContainer.querySelector('.childrenItemsContainer') || 
                              playlistItemsContainer.querySelector('#listChildrenCollapsible') ||
                              playlistItemsContainer;
        
        if (!itemsContainer) {
            WARN('Items container not found');
            return;
        }

        LOG('Adding playlist sorting for:', playlistId);

        // Fetch playlist children
        const children = await fetchPlaylistChildren(playlistId);
        if (children.length === 0) {
            WARN('No children found for playlist:', playlistId);
            return;
        }

        // Store playlist data
        playlistData.set(playlistId, {
            items: children,
            itemsContainer: itemsContainer
        });

        // Add sort button (only if it doesn't exist)
        if (!sortButton) {
            addSortButton(detailButtons, playlistId);
        }

        // Add resume button (only if it doesn't exist)
        await addResumeButton(detailButtons, playlistId);

        // Override play button to use sorted items
        overridePlayButton(detailButtons, playlistId);

        // Apply initial sort on page load
        sortPlaylistItems(playlistId);

        // Setup MutationObserver to handle re-renders
        setupPlaylistObserver(playlistId, playlistItemsContainer);

        // Mark as processed
        activePage.dataset.playlistSortingAdded = 'true';
    }

    // ========== ORIGINAL PLAYLIST FUNCTIONALITY ==========

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
            playButton.className = 'itemAction paper-icon-button-light playBtn playlist-play-button';
            // Don't use data-action="resume" - we'll handle it ourselves
            
            const playIcon = document.createElement('span');
            playIcon.className = 'material-icons play_arrow';
            playIcon.setAttribute('aria-hidden', 'true');
            playButton.appendChild(playIcon);
            
            // Add custom click handler to queue next 200 items
            playButton.addEventListener('click', async (e) => {
                e.preventDefault();
                e.stopPropagation();
                e.stopImmediatePropagation();
                
                try {
                    // Get the clicked item's data-id
                    const clickedItemId = playlistItemId;
                    
                    // Get all playlist items in the container
                    const allPlaylistItems = Array.from(childrenItemsContainer.querySelectorAll('.listItem[data-playlistitemid]'));
                    
                    // Find the index of the clicked item
                    const clickedIndex = allPlaylistItems.findIndex(listItem => {
                        return listItem.getAttribute('data-playlistitemid') === clickedItemId;
                    });
                    
                    if (clickedIndex === -1) {
                        WARN(`Could not find clicked item in playlist: ${clickedItemId}`);
                        return;
                    }
                    
                    // Get the next 200 items (including the clicked one)
                    const itemsToQueue = allPlaylistItems.slice(clickedIndex, clickedIndex + 200);
                    
                    // Extract item IDs
                    const itemIds = itemsToQueue.map(listItem => listItem.getAttribute('data-playlistitemid')).filter(id => id);
                    
                    if (itemIds.length === 0) {
                        WARN('No item IDs found to queue');
                        return;
                    }
                    
                    LOG(`Queueing ${itemIds.length} items starting from index ${clickedIndex} (item: ${clickedItemId})`);
                    
                    // Use apiHelper if available, otherwise fallback to ApiClient
                    if (window.apiHelper && window.apiHelper.playItem) {
                        await window.apiHelper.playItem(itemIds);
                    } else if (window.ApiClient && typeof window.ApiClient.play === 'function') {
                        await window.ApiClient.play({ ids: itemIds });
                    } else {
                        ERR('No play method available');
                    }
                } catch (error) {
                    ERR('Error queueing playlist items:', error);
                }
            });
            
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
        window.KefinTweaksUtils.onViewPage(async (view, element, hash, itemPromise) => {
            // Await the item promise to get the actual item data
            const testItem = Emby.Page.promiseShow ? await Emby.Page.promiseShow() : null;
            const item = await itemPromise;
            if (item && item.Type === 'Playlist') {
                // Run both original functionality and sorting functionality
                modifyPlaylistPage();
                
                // Small delay to ensure details DOM is ready for sorting
                setTimeout(async () => {
                    if (item && item.Id) {
                        await addPlaylistSorting(item);
                    }
                }, 100);
                return;
            }
        }, {
            pages: ['details']
        });
        
        LOG('Playlist hook initialized successfully');
    }
    
    // Initialize the hook when the script loads
    initializePlaylistHook();
    
    console.log('[KefinTweaks Playlist] Module loaded and ready');
})();
