// KefinTweaks Studios Cache Manager
// Handles fetching, processing, and caching of Series Studios
(function() {
    'use strict';

    const LOG = (...args) => console.log('[KefinTweaks StudiosCache]', ...args);
    const WARN = (...args) => console.warn('[KefinTweaks StudiosCache]', ...args);
    const ERR = (...args) => console.error('[KefinTweaks StudiosCache]', ...args);

    // State
    let _seriesStudios = null;

    /**
     * Fetches and caches Series Studios using apiHelper.getQuery
     * Uses progressive loading: returns immediate cached data if available,
     * then updates in-memory cache when fresh data arrives
     */
    async function fetchAndCacheSeriesStudios() {
        if (!window.apiHelper) {
            ERR('apiHelper is not available');
            return [];
        }

        try {
            const apiClient = window.ApiClient;
            if (!apiClient) {
                ERR('ApiClient is not available');
                return [];
            }

            const serverUrl = apiClient.serverAddress();
            const url = `${serverUrl}/Studios?IncludeItemTypes=Series`;

            LOG('Fetching Series Studios...');
            const result = await window.apiHelper.getQuery(url, { useCache: true });

            // Extract immediate data (may be null/empty if uncached)
            const immediateData = result.data;
            const studios = immediateData?.Items || immediateData || [];

            // When dataPromise resolves, update in-memory cache
            result.dataPromise.then(freshData => {
                const freshStudios = freshData?.Items || freshData || [];
                _seriesStudios = freshStudios;
                LOG(`Updated in-memory cache with ${freshStudios.length} Series Studios`);
            }).catch(err => {
                WARN('Error updating in-memory cache from dataPromise:', err);
            });

            return studios;
        } catch (err) {
            ERR('Error fetching Series Studios:', err);
            return [];
        }
    }

    /**
     * Gets all Series Studios, using in-memory cache if available
     * Otherwise fetches and caches the data
     */
    async function getSeriesStudios() {
        if (_seriesStudios !== null) {
            return _seriesStudios;
        }

        // Fetch and cache, which will return immediate data and update cache when promise resolves
        const studios = await fetchAndCacheSeriesStudios();
        
        // Update in-memory cache with immediate data (even if empty) to avoid repeated calls
        if (_seriesStudios === null) {
            _seriesStudios = studios;
        }
        
        return studios;
    }

    /**
     * Initializes the cache
     */
    async function initialize() {
        await getSeriesStudios();
    }

    /**
     * Gets popular TV networks (studios) filtered by minimum series count
     * @param {number} minimumSeries - Minimum number of series required (default: 0, returns all)
     * @returns {Promise<Array>} - Array of studios meeting the minimum threshold
     */
    async function getPopularTVNetworks(minimumSeries) {
        if (!minimumSeries) {
            minimumSeries = window.KefinTweaksConfig?.HOME_SETTINGS?.minimumSeriesForPopularTVNetworks ?? window.KefinHomeConfig2?.HOME_SETTINGS?.minimumSeriesForPopularTVNetworks;
        }

        const studios = await getSeriesStudios();
        
        if (minimumSeries > 0) {
            return studios.filter(studio => 
                (studio.SeriesCount || studio.ChildCount || 0) >= minimumSeries
            );
        }
        
        return studios;
    }

    // Expose API
    window.StudiosCache = {
        init: initialize,
        getPopularTVNetworks: getPopularTVNetworks,
        getSeriesStudios: getSeriesStudios
    };

    LOG('Module loaded');

})();
