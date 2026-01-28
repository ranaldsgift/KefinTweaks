(function() {
    'use strict';
    
    const LOG = (...args) => console.log('[KefinTweaks DataHelper]', ...args);
    const WARN = (...args) => console.warn('[KefinTweaks DataHelper]', ...args);
    const ERR = (...args) => console.error('[KefinTweaks DataHelper]', ...args);
    
    /**
     * Ensure ApiClient is available before using helper methods
     */
    function ensureApiClient() {
        if (typeof ApiClient === 'undefined' || !ApiClient) {
            throw new Error('ApiClient is not available');
        }
    }
    
    /**
     * API Helper functions for Jellyfin operations
     */
    const dataHelper = {
        getLibraries: async function() {
            ensureApiClient();
            
            if (__libraries) {
                return __libraries;
            }

            const response = await ApiClient.getItems();
            return response.Items;
        },

        /**
         * Get filter data (Genres, Tags, OfficialRatings, Years) for specified item types
         * @param {string|Array<string>} includeItemTypes - Item types to filter (e.g., 'Movie', ['Movie', 'Episode'])
         * @param {boolean} useCache - Whether to use cached data (default: true)
         * @param {boolean} forceRefresh - Whether to bypass cache (default: false)
         * @returns {Promise<Object>} - Object with Genres, Tags, OfficialRatings, Years arrays
         */
        getFilters: async function(includeItemTypes, useCache = true, forceRefresh = false) {
            ensureApiClient();
            
            if (!window.apiHelper) {
                throw new Error('apiHelper is not available');
            }

            const userId = ApiClient.getCurrentUserId();
            const serverAddress = ApiClient.serverAddress();
            
            if (!userId || !serverAddress) {
                throw new Error('User ID or server address not available');
            }

            // Normalize includeItemTypes to comma-separated string
            const itemTypesStr = Array.isArray(includeItemTypes) 
                ? includeItemTypes.join(',') 
                : (includeItemTypes || 'Movie');

            // Build URL
            let url = `${serverAddress}/Items/Filters?UserId=${userId}`;
            if (itemTypesStr) {
                url += `&IncludeItemTypes=${itemTypesStr}`;
            }
            
            // Use apiHelper.getQuery with 24-hour cache (86400000 ms)
            const cacheOptions = {
                useCache: useCache && !forceRefresh,
                ttl: 24 * 60 * 60 * 1000, // 24 hours
                forceRefresh: forceRefresh
            };

            const data = await window.apiHelper.getQuery(url, cacheOptions);
            
            // Handle both direct response and promise response
            const filters = (data && data.data) ? data.data : data;
            
            return {
                Genres: filters?.Genres || [],
                Tags: filters?.Tags || [],
                OfficialRatings: filters?.OfficialRatings || [],
                Years: filters?.Years || []
            };
        }
    };

    let __libraries = null;
    
    // Expose dataHelper to global window object
    window.dataHelper = dataHelper;
    
    console.log('[KefinTweaks DataHelper] Module loaded and available at window.dataHelper');
})();