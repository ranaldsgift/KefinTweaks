// KefinTweaks Collections
// Adds sorting functionality to collection pages
// Requires: utils.js, modal.js modules to be loaded before this script

(function() {
    'use strict';

    const LOG = (...args) => console.log('[KefinTweaks Collections]', ...args);
    const WARN = (...args) => console.warn('[KefinTweaks Collections]', ...args);
    const ERR = (...args) => console.error('[KefinTweaks Collections]', ...args);

    // localStorage key prefix
    const STORAGE_KEY_PREFIX_SORT = 'kefinTweaks_collectionSort_';
    const STORAGE_KEY_PREFIX_DIRECTION = 'kefinTweaks_collectionSortDirection_';

    // Sort options
    const SORT_OPTIONS = {
        'sortTitle': { label: 'Sort Title', field: 'SortName', defaultDirection: 'asc' },
        'releaseDate': { label: 'Release Date', field: 'PremiereDate', defaultDirection: 'asc' },
        'dateAdded': { label: 'Date Added', field: 'DateCreated', defaultDirection: 'desc' },
        'communityRating': { label: 'Community Rating', field: 'CommunityRating', defaultDirection: 'desc' },
        'criticRating': { label: 'Critic Rating', field: 'CriticRating', defaultDirection: 'desc' }
    };

    // Map DisplayOrder values to our sort keys
    const DISPLAY_ORDER_MAP = {
        'SortName': 'sortTitle',
        'PremiereDate': 'releaseDate',
        'Default': 'dateAdded'
    };

    // Store collection data per page
    const collectionData = new Map();
    
    // Single MutationObserver for the current collection (only one can exist at a time)
    let collectionObserver = null;

    /**
     * Get default sort from collection DisplayOrder property
     * @param {Object} collectionItem - Collection item with DisplayOrder property
     * @returns {string} Sort key
     */
    function getDefaultSortFromCollection(collectionItem) {
        if (!collectionItem || !collectionItem.DisplayOrder) {
            return 'sortTitle'; // Fallback default
        }
        
        const displayOrder = collectionItem.DisplayOrder;
        return DISPLAY_ORDER_MAP[displayOrder] || 'sortTitle';
    }

    /**
     * Get current sort preference from localStorage or collection default
     * @param {string} collectionId - Collection item ID
     * @param {string} defaultSort - Default sort key from collection DisplayOrder
     * @returns {string} Sort key
     */
    function getCurrentSort(collectionId, defaultSort) {
        const storageKey = STORAGE_KEY_PREFIX_SORT + collectionId;
        const savedSort = localStorage.getItem(storageKey);
        if (savedSort && SORT_OPTIONS[savedSort]) {
            return savedSort;
        }
        return defaultSort || 'sortTitle';
    }

    /**
     * Get current sort direction from localStorage
     * @param {string} collectionId - Collection item ID
     * @param {string} sortKey - Current sort key
     * @returns {string} 'asc' or 'desc'
     */
    function getCurrentSortDirection(collectionId, sortKey) {
        const storageKey = STORAGE_KEY_PREFIX_DIRECTION + collectionId;
        const savedDirection = localStorage.getItem(storageKey);
        if (savedDirection === 'asc' || savedDirection === 'desc') {
            return savedDirection;
        }
        // Default to the sort option's default direction
        return SORT_OPTIONS[sortKey].defaultDirection;
    }

    /**
     * Save sort preference to localStorage
     * @param {string} collectionId - Collection item ID
     * @param {string} sortKey - Sort key
     * @param {string} direction - 'asc' or 'desc'
     */
    function saveSortPreference(collectionId, sortKey, direction) {
        const sortStorageKey = STORAGE_KEY_PREFIX_SORT + collectionId;
        const directionStorageKey = STORAGE_KEY_PREFIX_DIRECTION + collectionId;
        localStorage.setItem(sortStorageKey, sortKey);
        localStorage.setItem(directionStorageKey, direction);
    }

    /**
     * Fetch collection children items
     * @param {string} collectionId - Collection item ID
     * @returns {Promise<Array>} Array of child items
     */
    async function fetchCollectionChildren(collectionId) {
        try {
            const userId = ApiClient.getCurrentUserId();
            const response = await ApiClient.getItems(userId, {
                ParentId: collectionId,
                Fields: 'PrimaryImageAspectRatio,DateCreated,CommunityRating,CriticRating,SortName,PremiereDate'
            });
            return response.Items || [];
        } catch (error) {
            ERR('Error fetching collection children:', error);
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
     * Reorder DOM cards to match sorted items order
     * @param {HTMLElement} itemsContainer - Container with .card elements
     * @param {Array} sortedItems - Sorted array of items
     */
    function reorderCards(itemsContainer, sortedItems) {
        if (!itemsContainer) {
            WARN('Items container not found');
            return;
        }

        const cards = Array.from(itemsContainer.querySelectorAll('.card'));
        if (cards.length === 0) {
            WARN('No cards found in container');
            return;
        }

        // Create a map of item ID to card element
        const cardMap = new Map();
        cards.forEach(card => {
            const itemId = card.getAttribute('data-id');
            if (itemId) {
                cardMap.set(itemId, card);
            }
        });

        // Check if reordering is needed by comparing current order with desired order
        const currentOrder = cards.map(card => card.getAttribute('data-id'));
        const desiredOrder = sortedItems.map(item => item.Id);
        
        // If order matches, no need to reorder
        if (currentOrder.length === desiredOrder.length && 
            currentOrder.every((id, index) => id === desiredOrder[index])) {
            LOG('Cards already in correct order');
            return;
        }

        // Remove all cards from DOM (but keep references in cardMap)
        cards.forEach(card => card.remove());

        // Reorder cards based on sorted items and append in correct order
        sortedItems.forEach((item) => {
            const card = cardMap.get(item.Id);
            if (card) {
                itemsContainer.appendChild(card);
            }
        });
    }

    /**
     * Sort collection items and update DOM
     * @param {string} collectionId - Collection item ID
     * @param {string} defaultSort - Default sort key from collection DisplayOrder
     */
    function sortCollectionItems(collectionId, defaultSort) {
        const data = collectionData.get(collectionId);
        if (!data || !data.items || !data.itemsContainer) {
            WARN('Collection data not found for:', collectionId);
            return;
        }

        const sortKey = getCurrentSort(collectionId, defaultSort);
        const direction = getCurrentSortDirection(collectionId, sortKey);

        LOG(`Sorting collection ${collectionId} by ${sortKey} (${direction})`);

        // Sort items
        const sortedItems = sortItems(data.items, sortKey, direction);

        // Update stored items
        data.items = sortedItems;

        // Reorder DOM
        reorderCards(data.itemsContainer, sortedItems);
    }

    /**
     * Show sort selection modal
     * @param {string} collectionId - Collection item ID
     * @param {string} defaultSort - Default sort key from collection DisplayOrder
     */
    function showSortModal(collectionId, defaultSort) {
        const currentSort = getCurrentSort(collectionId, defaultSort);
        const currentDirection = getCurrentSortDirection(collectionId, currentSort);

        // Build modal content matching watchlist sort modal structure
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
                                        <clipPath id="cutoff-collections-${key}">
                                            <circle cx="50%" cy="50%" r="50%"></circle>
                                        </clipPath>
                                    </defs>
                                    <circle class="mdl-radio__outer-circle" cx="50%" cy="50%" r="50%" fill="none" stroke="currentcolor" stroke-width="0.26em" clip-path="url(#cutoff-collections-${key})"></circle>
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
                                <clipPath id="cutoff-collections-asc">
                                    <circle cx="50%" cy="50%" r="50%"></circle>
                                </clipPath>
                            </defs>
                            <circle class="mdl-radio__outer-circle" cx="50%" cy="50%" r="50%" fill="none" stroke="currentcolor" stroke-width="0.26em" clip-path="url(#cutoff-collections-asc)"></circle>
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
                                <clipPath id="cutoff-collections-desc">
                                    <circle cx="50%" cy="50%" r="50%"></circle>
                                </clipPath>
                            </defs>
                            <circle class="mdl-radio__outer-circle" cx="50%" cy="50%" r="50%" fill="none" stroke="currentcolor" stroke-width="0.26em" clip-path="url(#cutoff-collections-desc)"></circle>
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
            id: 'kt-collections-sort-modal',
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
                        const direction = selectedDirection ? selectedDirection.value : getCurrentSortDirection(collectionId, selectedOption.value);
                        saveSortPreference(collectionId, selectedOption.value, direction);
                        sortCollectionItems(collectionId, defaultSort);
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
     * Create and add sort button to section title
     * @param {HTMLElement} sectionTitle - Section title element
     * @param {string} collectionId - Collection item ID
     * @param {string} defaultSort - Default sort key from collection DisplayOrder
     */
    function addSortButton(sectionTitle, collectionId, defaultSort) {
        // Check if button already exists
        if (sectionTitle.querySelector('.kt-collections-sort-btn')) {
            return;
        }

        // Create button
        const button = document.createElement('button');
        button.className = 'kt-collections-sort-btn paper-icon-button-light emby-button';
        button.setAttribute('is', 'paper-icon-button-light');
        button.title = 'Sort Collection';
        button.style.cssText = 'margin-left: 0.5em; cursor: pointer; font-size: 0.7em; padding: 0;';

        // Create icon
        const icon = document.createElement('span');
        icon.className = 'material-icons sort';
        icon.setAttribute('aria-hidden', 'true');

        button.appendChild(icon);

        // Add click handler
        button.onclick = (e) => {
            e.preventDefault();
            e.stopPropagation();
            showSortModal(collectionId, defaultSort);
        };

        // Append after existing span in sectionTitle
        const existingSpan = sectionTitle.querySelector('span');
        if (existingSpan) {
            existingSpan.insertAdjacentElement('afterend', button);
        } else {
            sectionTitle.appendChild(button);
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
     * @param {string} collectionId - Collection item ID
     * @param {HTMLElement} collectionItemsContainer - Collection items container
     * @param {string} defaultSort - Default sort key from collection DisplayOrder
     */
    async function reapplyCollectionSorting(collectionId, collectionItemsContainer, defaultSort) {
        // Poll for section title (up to 2 seconds, every 200ms) - shorter timeout since we know container exists
        const sectionTitle = await pollForElement(() => {
            return collectionItemsContainer.querySelector('.sectionTitle');
        }, 2000, 200);

        if (!sectionTitle) {
            WARN('Section title not found after re-render for collection:', collectionId);
            return;
        }

        // Find items container
        const itemsContainer = collectionItemsContainer.querySelector('.itemsContainer');
        if (!itemsContainer) {
            WARN('Items container not found after re-render for collection:', collectionId);
            return;
        }

        // Check if sort button exists, if not add it
        const sortButton = sectionTitle.querySelector('.kt-collections-sort-btn');
        if (!sortButton) {
            LOG('Sort button missing after re-render, re-adding for collection:', collectionId);
            addSortButton(sectionTitle, collectionId, defaultSort);
        }

        // Update stored items container reference (in case it was recreated)
        const data = collectionData.get(collectionId);
        if (data) {
            data.itemsContainer = itemsContainer;
            
            // Re-apply sort
            sortCollectionItems(collectionId, defaultSort);
        } else {
            WARN('Collection data not found for re-render:', collectionId);
        }
    }

    /**
     * Setup MutationObserver for collection items container
     * @param {string} collectionId - Collection item ID
     * @param {HTMLElement} collectionItemsContainer - Collection items container
     * @param {string} defaultSort - Default sort key from collection DisplayOrder
     */
    function setupCollectionObserver(collectionId, collectionItemsContainer, defaultSort) {
        // Disconnect existing observer if any
        if (collectionObserver) {
            collectionObserver.disconnect();
            collectionObserver = null;
        }

        // Debounce timer for re-apply
        let debounceTimer = null;

        collectionObserver = new MutationObserver((mutations) => {
            let shouldReapply = false;

            mutations.forEach((mutation) => {
                if (mutation.type === 'childList') {
                    // Check if nodes were added (indicating a re-render)
                    if (mutation.addedNodes.length > 0) {
                        // Check if any added node is a direct child or contains important elements
                        mutation.addedNodes.forEach((node) => {
                            if (node.nodeType === Node.ELEMENT_NODE) {
                                // If sectionTitle or itemsContainer was added, we need to reapply
                                if (node.classList?.contains('sectionTitle') || 
                                    node.classList?.contains('itemsContainer') ||
                                    node.querySelector?.('.sectionTitle') ||
                                    node.querySelector?.('.itemsContainer')) {
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
                    LOG('Collection container re-rendered, re-applying sort for:', collectionId);
                    reapplyCollectionSorting(collectionId, collectionItemsContainer, defaultSort);
                }, 300); // 300ms debounce
            }
        });

        // Observe only the collectionItems container with childList changes
        collectionObserver.observe(collectionItemsContainer, {
            childList: true,
            subtree: true
        });

        LOG('MutationObserver set up for collection:', collectionId);
    }

    /**
     * Add collection sorting functionality
     * @param {Object} item - Collection item (BoxSet)
     */
    async function addCollectionSorting(item) {
        if (!item || item.Type !== 'BoxSet' || !item.Id) {
            return;
        }

        const collectionId = item.Id;
        const activePage = document.querySelector('.libraryPage:not(.hide)');
        if (!activePage) {
            return;
        }

        // Find collection items container
        const collectionItemsContainer = activePage.querySelector('.collectionItems');
        if (!collectionItemsContainer) {
            WARN('Collection items container not found');
            return;
        }

        // Check if already processed (but allow re-processing if button is missing)
        const sortButton = collectionItemsContainer.querySelector('.kt-collections-sort-btn');
        if (activePage.dataset.collectionSortingAdded === 'true' && sortButton) {
            return;
        }

        // Poll for section title (up to 5 seconds, every 500ms)
        const sectionTitle = await pollForElement(() => {
            return collectionItemsContainer.querySelector('.sectionTitle');
        }, 5000, 100);

        if (!sectionTitle) {
            WARN('Section title not found after polling for 5 seconds');
            return;
        }

        // Find items container
        const itemsContainer = collectionItemsContainer.querySelector('.itemsContainer');
        if (!itemsContainer) {
            WARN('Items container not found');
            return;
        }

        LOG('Adding collection sorting for:', collectionId);

        // Fetch collection children
        const children = await fetchCollectionChildren(collectionId);
        if (children.length === 0) {
            WARN('No children found for collection:', collectionId);
            return;
        }

        // Get default sort from collection DisplayOrder
        const defaultSort = getDefaultSortFromCollection(item);

        // Store collection data
        collectionData.set(collectionId, {
            items: children,
            itemsContainer: itemsContainer,
            defaultSort: defaultSort
        });

        // Add sort button (only if it doesn't exist)
        if (!sortButton) {
            addSortButton(sectionTitle, collectionId, defaultSort);
        }

        // Apply initial sort on page load
        sortCollectionItems(collectionId, defaultSort);

        // Setup MutationObserver to handle re-renders
        setupCollectionObserver(collectionId, collectionItemsContainer, defaultSort);

        // Mark as processed
        activePage.dataset.collectionSortingAdded = 'true';
    }

    /**
     * Initialize collections hook
     */
    function initializeCollectionsHook() {
        if (!window.KefinTweaksUtils || !window.KefinTweaksUtils.onViewPage) {
            WARN('KefinTweaksUtils.onViewPage not available, retrying in 1 second');
            setTimeout(initializeCollectionsHook, 1000);
            return;
        }

        LOG('Registering collections handler with KefinTweaksUtils');

        window.KefinTweaksUtils.onViewPage(
            async (view, element, hash, itemPromise) => {
                // Only handle details pages
                const activePage = document.querySelector('.libraryPage:not(.hide)');
                if (!activePage) return;

                // Await the item promise to get the actual item data
                const item = await itemPromise;

                // Small delay to ensure details DOM is ready
                setTimeout(async () => {
                    if (item && item.Id) {
                        await addCollectionSorting(item);
                    }
                }, 100);
            },
            {
                pages: ['details']
            }
        );

        LOG('Collections hook initialized');
    }

    /**
     * Initialize script
     */
    function initialize() {
        if (!window.ApiClient || !window.ApiClient.getCurrentUserId) {
            WARN('ApiClient not available, retrying in 1 second');
            setTimeout(initialize, 1000);
            return;
        }

        // Initialize collections hook
        initializeCollectionsHook();
    }

    // Start initialization
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initialize);
    } else {
        initialize();
    }

    LOG('Script loaded successfully');
})();

