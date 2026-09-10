// KefinTweaks Item Details Collections
(function() {
    'use strict';

    const LOG = (...args) => console.log('[KefinTweaks ItemDetailsCollections]', ...args);
    const WARN = (...args) => console.warn('[KefinTweaks ItemDetailsCollections]', ...args);
    const ERR = (...args) => console.error('[KefinTweaks ItemDetailsCollections]', ...args);

    const COLLECTIONS_CHILD_COUNT_KEY = `kefinTweaks_${ApiClient.getCurrentUserId()}_allCollectionsChildCount`;
    const CACHE_NAME = 'collections';
    const COLLECTION_FETCH_CHUNK_SIZE = 8;

    const state = {
        allCollections: null,
        populateInFlight: null
    };

    /**
     * Yields execution to allow the UI to repaint and respond to user inputs.
     * Prefers the modern scheduler.yield API when available.
     */
    function yieldToMain() {
        if ('scheduler' in window && typeof window.scheduler.yield === 'function') {
            return window.scheduler.yield();
        }
        return new Promise((resolve) => setTimeout(resolve, 0));
    }

    function buildCacheEntries(results) {
        const cacheData = [];
        for (const { collection: coll, items } of results) {
            const itemIds = (items?.Items || []).map((item) => item.Id);
            if (itemIds.length === 0) continue;
            cacheData.push({
                CollectionItem: {
                    Id: coll.Id,
                    Type: coll.Type,
                    Name: coll.Name,
                    ParentIndexNumber: coll.ParentIndexNumber,
                    IndexNumber: coll.IndexNumber,
                    ImageTags: coll.ImageTags,
                    BackdropImageTags: coll.BackdropImageTags,
                    ProductionYear: coll.ProductionYear,
                    PremiereDate: coll.PremiereDate
                },
                ItemIds: itemIds
            });
        }
        return cacheData;
    }

    async function fetchCollectionChildren(coll) {
        try {
            const items = await ApiClient.getItems(ApiClient.getCurrentUserId(), {
                ParentId: coll.Id
            });
            return { collection: coll, items };
        } catch (err) {
            WARN(`Failed to fetch items for collection ${coll.Id}`, err);
            return { collection: coll, items: { Items: [] } };
        }
    }

    async function fetchCollectionChildrenBatched(collections) {
        const results = [];
        const items = collections || [];
        
        for (let i = 0; i < items.length; i += COLLECTION_FETCH_CHUNK_SIZE) {
            const chunk = items.slice(i, i + COLLECTION_FETCH_CHUNK_SIZE);
            const chunkResults = await Promise.all(chunk.map(fetchCollectionChildren));
            results.push(...chunkResults);
            
            // Yield back to the browser to paint frames & maintain high FPS
            if (i + COLLECTION_FETCH_CHUNK_SIZE < items.length) {
                await yieldToMain();
            }
        }
        return results;
    }

    async function writeCollectionsCache(cache, collections) {
        const startTime = performance.now();
        const collectionResults = await fetchCollectionChildrenBatched(collections);
        const cacheData = buildCacheEntries(collectionResults);
        await cache.set(CACHE_NAME, cacheData);
        const duration = performance.now() - startTime;
        LOG(`Collections cache populated: ${cacheData.length} collections in ${duration.toFixed(2)}ms`);
        return cacheData;
    }

    async function populateCollectionsCache(invalidate = false) {
        if (ApiClient._loggedIn === false) return;

        const cache = window.IndexedDBCache;
        if (!cache) {
            WARN('IndexedDBCache instance not available');
            return;
        }

        if (!state.allCollections) {
            state.allCollections = await ApiClient.getItems(ApiClient.getCurrentUserId(), {
                IncludeItemTypes: 'BoxSet,CollectionFolder',
                Recursive: true,
                Fields: 'ChildCount'
            });
        }

        const allCollectionsChildCount = (state.allCollections.Items || [])
            .reduce((sum, coll) => sum + (coll.ChildCount || 0), 0);

        const cachedAllCollectionsChildCount = Number(localStorage.getItem(COLLECTIONS_CHILD_COUNT_KEY));

        if (allCollectionsChildCount !== cachedAllCollectionsChildCount) {
            localStorage.setItem(COLLECTIONS_CHILD_COUNT_KEY, allCollectionsChildCount);
            invalidate = true;
            LOG('Collections Child Count has changed, invalidating cache');
        }
        
        if (!invalidate && await cache.isCacheValid(CACHE_NAME)) {
            LOG('Collections cache is still valid');
            return;
        }

        const currentCacheData = await cache.get(CACHE_NAME);
        const hasExistingCache = Array.isArray(currentCacheData) && currentCacheData.length > 0;

        if (state.populateInFlight) {
            if (hasExistingCache) return;
            return state.populateInFlight;
        }

        LOG(hasExistingCache
            ? 'Refreshing collections cache in background'
            : 'Populating collections cache (First run)...');

        const work = writeCollectionsCache(cache, state.allCollections.Items)
            .catch((error) => {
                ERR('Error populating collections cache:', error);
            })
            .finally(() => {
                state.populateInFlight = null;
            });

        state.populateInFlight = work;

        if (hasExistingCache) return;
        await work; // Wait on initial load so caller can render right after
    }

    async function getParentCollections(itemId) {
        const cache = window.IndexedDBCache;
        if (!cache) return [];
        
        const cacheData = await cache.get(CACHE_NAME);
        if (!cacheData || !Array.isArray(cacheData)) return [];

        return cacheData
            .filter(entry => entry.ItemIds && entry.ItemIds.includes(itemId))
            .map(entry => entry.CollectionItem);
    }

    async function renderCollectionsSection(item) {
        if (!item || !item.Id) return;

        const activePage = document.querySelector('.libraryPage:not(.hide)');
        if (!activePage) return;

        // Prevent redundant runs on the same page element
        if (activePage.dataset.collectionsChecked === 'true') return;

        const parentCollectionItems = await getParentCollections(item.Id);
        if (!parentCollectionItems || parentCollectionItems.length === 0) return;

        if (!window.cardBuilder || !window.cardBuilder.renderCards) {
            WARN('cardBuilder.renderCards not available');
            return;
        }

        const detailPageContent = activePage.querySelector('.detailPageContent');
        if (!detailPageContent) return;

        // Ensure we don't render duplicate sections
        if (activePage.querySelector('.collections-section')) return;

        try {
            const collectionsSection = window.cardBuilder.renderCards(
                parentCollectionItems,
                'Included In',
                null,
                true,
                null
            );

            collectionsSection.classList.add('collections-section');
            collectionsSection.setAttribute('data-collections-section', 'true');

            const scrollerContainer = collectionsSection.querySelector('.emby-scroller');
            if (scrollerContainer) scrollerContainer.classList.add('no-padding');

            const sectionTitleContainer = collectionsSection.querySelector('.sectionTitleContainer');
            if (sectionTitleContainer) sectionTitleContainer.classList.add('no-padding');

            const similarSection = detailPageContent.querySelector('#similarCollapsible');
            if (similarSection) {
                similarSection.before(collectionsSection);
            } else {
                detailPageContent.appendChild(collectionsSection);
            }

            activePage.dataset.collectionsChecked = 'true';
            LOG(`Rendered ${parentCollectionItems.length} collection(s) for item ${item.Id}`);
        } catch (error) {
            ERR('Error rendering collections section:', error);
        }
    }

    function initializeCollectionsHook() {
        if (!window.KefinTweaksUtils || !window.KefinTweaksUtils.onViewPage) {
            WARN('KefinTweaksUtils.onViewPage not available, retrying in 1 second');
            setTimeout(initializeCollectionsHook, 1000);
            return;
        }

        LOG('Registering collections handler with KefinTweaksUtils');

        window.KefinTweaksUtils.onViewPage(
            async (view, element, hash, itemPromise) => {
                if (ApiClient._loggedIn === false) return;

                const activePage = document.querySelector('.libraryPage:not(.hide)');
                if (!activePage) return;

                const item = await itemPromise;
                const supportedTypes = ['Movie', 'Series', 'Season', 'Episode', 'MusicArtist', 'MusicAlbum', 'Audio', 'Book', 'AudioBook', 'MusicVideo'];

                if (!supportedTypes.includes(item?.Type)) return;

                // 1. Populate/Update cache (waits on first load, runs in background on updates)
                await populateCollectionsCache();

                // 2. Render cards using populated IndexedDB cache
                if (item && item.Id) {
                    await renderCollectionsSection(item);
                }
            },
            {
                pages: ['details'],
                triggerOnSameHash: false
            }
        );

        LOG('Collections hook initialized');
    }

    function initialize() {
        if (!window.ApiClient) {
            setTimeout(initialize, 1000);
            return;
        }
        initializeCollectionsHook();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initialize);
    } else {
        initialize();
    }
})();