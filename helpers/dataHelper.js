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
            
            if (__libraries?.Items) {
                return __libraries.Items;
            }

            const response = await ApiClient.getItems();
            return response?.Items ?? [];
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
        },

        /**
         * Get watched or in progress movies from Jellyfin API
         * @returns {Promise<Array>} - Array of movies
         */
        getWatchedOrInProgressMovies: async function(options = {}) {

            const { watchedMoviesResult, inProgressMoviesResult } = await Promise.all([this.getWatchedMovies(options), this.getInProgressMovies(options)]);

            if (options.useCache) {
                const watchedMovies = watchedMoviesResult.data.Items;
                const inProgressMovies = inProgressMoviesResult.data.Items;
                let isStale = Promise.all([watchedMoviesResult.isStalePromise, inProgressMoviesResult.isStalePromise]).then(([isWatchedStale, isInProgressStale]) => {
                    return isStale = isWatchedStale || isInProgressStale ? true : false;
                });

                let dataPromise = Promise.all([watchedMoviesResult.dataPromise, inProgressMoviesResult.dataPromise]).then(([watchedMoviesData, inProgressMoviesData]) => {
                    return {
                        data: {
                            Items: [...watchedMoviesData.Items, ...inProgressMoviesData.Items]
                        }
                    };
                });

                return {
                    data: {
                        Items: [...watchedMovies, ...inProgressMovies]
                    },
                    isStalePromise: isStalePromise,
                    dataPromise: dataPromise
                };
            }

            // Otherwise, use the fetched data arrays directly
            return {
                Items: [...watchedMovies.Items, ...inProgressMovies.Items]
            };
        },

        /**
         * Get watched movies from Jellyfin API
         * @param {Object} options - Options
         * @param {boolean} options.useCache - Whether to use cache (default: false)
         * @returns {Promise<Array>|Array} - Array of movies
         */
        getWatchedMovies: async function(options = {}) {
            // default TTL is 1 day
            const { useCache = false, ttl = 24 * 60 * 60 * 1000 } = options;

            const serverUrl = ApiClient.serverAddress();
            const url = `${serverUrl}/Items?IncludeItemTypes=Movie&Recursive=true&Filters=IsPlayed&Fields=UserData,People,ProviderIds&ImageTypeLimit=1&SortBy=DatePlayed&SortOrder=Descending`;
            
            // Use apiHelper.getQuery to get the data
            if (!window.apiHelper) {
                ERR('apiHelper is not available');
                return [];
            }

            return window.apiHelper.getQuery(url, { useCache: useCache, ttl: ttl });
        },

        getInProgressMovies: async function(options = {}) {
            // default TTL is 1 day
            const { useCache = false, ttl = 24 * 60 * 60 * 1000 } = options;

            const serverUrl = ApiClient.serverAddress();
            const url = `${serverUrl}/Items?IncludeItemTypes=Movie&Recursive=true&Filters=IsResumable&Fields=UserData,People,ProviderIds&ImageTypeLimit=1&SortBy=DatePlayed&SortOrder=Descending`;

            if (!window.apiHelper) {
                ERR('apiHelper is not available');
                return [];
            }

            return window.apiHelper.getQuery(url, { useCache: useCache, ttl: ttl });
        },

        getCachedLibraries: function() {
            return __libraries?.Items ? __libraries.Items : null;
        }
    };

    async function initialize() {
        ensureApiClient();
        
        if (__libraries) {
            return;
        }
        
        const libraries = await ApiClient.getItems();
        __libraries = libraries;
    }

    let __libraries = null;

    initialize();
    
    // Expose dataHelper to global window object
    window.dataHelper = dataHelper;
    
    console.log('[KefinTweaks DataHelper] Module loaded and available at window.dataHelper');
})();