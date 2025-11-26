// KefinTweaks Item Details Collections
// Adds related collections to item details pages
// Requires: indexedDBCache.js, utils.js, cardBuilder.js modules to be loaded before this script

(function() {
    'use strict';

    const LOG = (...args) => console.log('[KefinTweaks ItemDetailsCollections]', ...args);
    const WARN = (...args) => console.warn('[KefinTweaks ItemDetailsCollections]', ...args);
    const ERR = (...args) => console.error('[KefinTweaks ItemDetailsCollections]', ...args);

    const CACHE_NAME = 'collections';
    const CACHE_TTL = 60 * 60 * 1000; // 1 hour

    // Populate collections cache
    async function populateCollectionsCache(invalidate = false) {
        // Check if user is logged in and poll for 5 seconds if not
        if (ApiClient._loggedIn === false) {
            return;
        }


        if (!window.IndexedDBCache) {
            WARN('IndexedDBCache not available');
            return;
        }

        const cache = new window.IndexedDBCache('kefinTweaks_', CACHE_TTL);
        
        // Check if cache is valid
        if (!invalidate && await cache.isCacheValid(CACHE_NAME)) {
            LOG('Collections cache is still valid');
            return;
        }

        LOG('Populating collections cache...');
        
        try {

            const allCollections = await ApiClient.getItems(ApiClient.getCurrentUserId(), {
                IncludeItemTypes: 'BoxSet,CollectionFolder',
                Recursive: true
            });

            // Fetch all collection items in parallel
            const collectionPromises = allCollections.Items.map(coll => 
                ApiClient.getItems(ApiClient.getCurrentUserId(), {
                    ParentId: coll.Id,
                }).then(items => ({
                    collection: coll,
                    items: items
                }))
            );

            // Check if cache already contains data
            // If so, process the cache refresh in parallel and return the currently cached data instead of waiting
            // If no cache exists, wait for all fetches to complete
            const currentCacheData = await cache.get(CACHE_NAME);

            if (currentCacheData && currentCacheData.length > 0) {
                // Refreshing the cache Collections cache in the background
                LOG('Refreshing collections cache in the background');
                Promise.all(collectionPromises);
                return;
            }

            // Setup performance timer
            const startTime = performance.now();

            // Wait for all fetches to complete
            const collectionResults = await Promise.all(collectionPromises);

            const endTime = performance.now();
            const duration = endTime - startTime;
            LOG(`Collections cache populated in ${duration.toFixed(2)}ms`);

            const cacheData = [];

            // Process all results
            for (const { collection: coll, items } of collectionResults) {
                // Store collection item data needed for renderCards
                const collectionItemData = {
                    Id: coll.Id,
                    Type: coll.Type,
                    Name: coll.Name,
                    ParentIndexNumber: coll.ParentIndexNumber,
                    IndexNumber: coll.IndexNumber,
                    ImageTags: coll.ImageTags,
                    BackdropImageTags: coll.BackdropImageTags,
                    ProductionYear: coll.ProductionYear,
                    PremiereDate: coll.PremiereDate
                };
                
                // Store item IDs in this collection for lookup
                const itemIds = items.Items.map(item => item.Id);
                
                if (itemIds.length > 0) {
                    cacheData.push({
                        CollectionItem: collectionItemData,
                        ItemIds: itemIds
                    });
                }
            }

            await cache.set(CACHE_NAME, cacheData);
            LOG(`Collections cache populated: ${cacheData.length} collections`);
        } catch (error) {
            ERR('Error populating collections cache:', error);
        }
    }

    // Get parent collections for an item ID (returns collection items that can be passed to renderCards)
    async function getParentCollections(itemId) {
        if (!window.IndexedDBCache) {
            WARN('IndexedDBCache not available');
            return [];
        }

        const cache = new window.IndexedDBCache('kefinTweaks_', CACHE_TTL);
        const cacheData = await cache.get(CACHE_NAME);

        if (!cacheData || !Array.isArray(cacheData)) {
            return [];
        }

        // Find collections that contain this item and return the collection item objects
        return cacheData
            .filter(entry => entry.ItemIds && entry.ItemIds.includes(itemId))
            .map(entry => entry.CollectionItem);
    }

    // Render collections section on details page
    async function renderCollectionsSection(item) {
        if (!item || !item.Id) {
            return;
        }

        const activePage = document.querySelector('.libraryPage:not(.hide)');
        if (!activePage) {
            return;
        }

        if (activePage.dataset.collectionsChecked === 'true') {
            return;
        }

        activePage.dataset.collectionsChecked = 'true';

        // Check if section already rendered
        const existingSection = activePage.querySelector('.collections-section');
        if (existingSection) {
            return;
        }

        // Get parent collections (returns collection item objects)
        const parentCollectionItems = await getParentCollections(item.Id);
        if (!parentCollectionItems || parentCollectionItems.length === 0) {
            return;
        }

        // Check for cardBuilder
        if (!window.cardBuilder || !window.cardBuilder.renderCards) {
            WARN('cardBuilder.renderCards not available');
            return;
        }

        // Find detailPageContent
        const detailPageContent = activePage.querySelector('.detailPageContent');
        if (!detailPageContent) {
            WARN('detailPageContent not found');
            return;
        }

        try {
            // Render collections section using renderCards with cached item data
            const collectionsSection = window.cardBuilder.renderCards(
                parentCollectionItems,
                'Included In',
                null,
                true,
                null
            );

            // Mark as collections section
            collectionsSection.classList.add('collections-section');
            collectionsSection.setAttribute('data-collections-section', 'true');

            const scrollerContainer = collectionsSection.querySelector('.emby-scroller');
            if (scrollerContainer) {
                scrollerContainer.classList.add('no-padding');
            }

            const sectionTitleContainer = collectionsSection.querySelector('.sectionTitleContainer');
            if (sectionTitleContainer) {
                sectionTitleContainer.classList.add('no-padding');
            }

            // Add to detailPageContent
            const similarSection = detailPageContent.querySelector('#similarCollapsible');
            if (similarSection) {
                similarSection.before(collectionsSection);
            } else {
                detailPageContent.appendChild(collectionsSection);
            }

            LOG(`Rendered ${parentCollectionItems.length} collection(s) for item ${item.Id}`);
        } catch (error) {
            ERR('Error rendering collections section:', error);
        }
    }

    // Initialize onViewPage hook
    function initializeCollectionsHook() {
        if (!window.KefinTweaksUtils || !window.KefinTweaksUtils.onViewPage) {
            WARN('KefinTweaksUtils.onViewPage not available, retrying in 1 second');
            setTimeout(initializeCollectionsHook, 1000);
            return;
        }

        LOG('Registering collections handler with KefinTweaksUtils');

        window.KefinTweaksUtils.onViewPage(
            async (view, element, hash, itemPromise) => {
                if (ApiClient._loggedIn === false) {
                    return;
                }

                // Only handle details pages
                const activePage = document.querySelector('.libraryPage:not(.hide)');
                if (!activePage) return;

                // Await the item promise to get the actual item data
                const item = await itemPromise;

                const supportedTypes = ['Movie', 'Series', 'Season', 'Episode', 'MusicArtist', 'MusicAlbum', 'Audio', 'Book', 'AudioBook', 'MusicVideo' ];

                if (!supportedTypes.includes(item.Type)) {
                    LOG(`Item type ${item.Type} not supported for collections, skipping...`);
                    return;
                }

                await populateCollectionsCache();

                // Small delay to ensure details DOM is ready
                setTimeout(async () => {
                    if (item && item.Id) {
                        await renderCollectionsSection(item);
                    }
                }, 100);
            },
            {
                pages: ['details']
            }
        );

        LOG('Collections hook initialized');
    }

    const maxInitAttempts = 10;
    let initAttempts = 0;

    // Initialize cache population on script load
    function initialize() {
        if (!window.ApiClient) {
            WARN('Dependencies not available, retrying in 1 second');
            if (initAttempts < maxInitAttempts) {
                setTimeout(initialize, 1000);
                initAttempts++;
            } else {
                ERR('Dependencies not available after 10 seconds, giving up');
            }
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

