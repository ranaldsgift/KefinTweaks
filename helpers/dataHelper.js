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

    /** @type {Map<string, { Genres: Array, Tags: Array, OfficialRatings: Array, Years: Array }>} */
    const filtersMemoryCache = new Map();

    function parseMajorVersion(version) {
        if (!version || typeof version !== 'string') return 0;
        const major = parseInt(version.split('.')[0], 10);
        return Number.isNaN(major) ? 0 : major;
    }

    function getServerMajorVersion() {
        ensureApiClient();
        const version = ApiClient._serverVersion || ApiClient._appVersion || '';
        return parseMajorVersion(version);
    }

    function normalizeIncludeItemTypesKey(includeItemTypes) {
        if (includeItemTypes == null) return 'ALL';
        const list = Array.isArray(includeItemTypes)
            ? includeItemTypes.map(t => String(t).trim()).filter(Boolean)
            : String(includeItemTypes).split(',').map(s => s.trim()).filter(Boolean);
        if (list.length === 0) return 'ALL';
        return [...list].sort().join(',');
    }

    function buildIncludeItemTypesParam(includeItemTypes) {
        const key = normalizeIncludeItemTypesKey(includeItemTypes);
        if (key === 'ALL') return '';
        return key;
    }

    async function unwrapGetQueryResult(result) {
        if (!result) return null;
        if (typeof result.ensureData === 'function' || result.dataPromise != null) {
            if (result.data != null) return result.data;
            return await (typeof result.ensureData === 'function'
                ? result.ensureData()
                : result.dataPromise);
        }
        return result;
    }

    function normalizeGenreEntry(entry) {
        if (entry == null) return null;
        if (typeof entry === 'string') {
            const name = entry.trim();
            return name ? { id: name, name } : null;
        }
        const id = entry.Id ?? entry.id;
        const name = entry.Name ?? entry.name;
        if (id != null && name != null) {
            return { id: String(id), name: String(name) };
        }
        if (name != null) {
            const n = String(name);
            return { id: n, name: n };
        }
        return null;
    }

    function normalizeTagEntry(entry) {
        if (entry == null) return null;
        if (typeof entry === 'string') {
            const name = entry.trim();
            return name ? { id: name, name } : null;
        }
        const name = entry.Name ?? entry.name ?? entry.Id ?? entry.id;
        if (name == null) return null;
        const n = String(name);
        return { id: n, name: n };
    }

    function normalizeFiltersPayload(raw) {
        const genres = (Array.isArray(raw?.Genres) ? raw.Genres : [])
            .map(normalizeGenreEntry)
            .filter(Boolean);
        const tags = (Array.isArray(raw?.Tags) ? raw.Tags : [])
            .map(normalizeTagEntry)
            .filter(Boolean);
        return {
            Genres: genres,
            Tags: tags,
            OfficialRatings: Array.isArray(raw?.OfficialRatings) ? raw.OfficialRatings : [],
            Years: Array.isArray(raw?.Years) ? raw.Years : []
        };
    }

    function buildFiltersUrl(serverAddress, userId, includeItemTypes) {
        const typesParam = buildIncludeItemTypesParam(includeItemTypes);
        const useFilters2 = getServerMajorVersion() >= 12;
        const path = useFilters2 ? '/Items/Filters2' : '/Items/Filters';
        const params = new URLSearchParams({ UserId: userId });
        if (useFilters2) {
            params.set('recursive', 'true');
        }
        if (typesParam) {
            params.set('IncludeItemTypes', typesParam);
        }
        return `${serverAddress}${path}?${params.toString()}`;
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

            const cacheKey = normalizeIncludeItemTypesKey(includeItemTypes);
            if (forceRefresh) {
                filtersMemoryCache.delete(cacheKey);
            }
            if (useCache && !forceRefresh && filtersMemoryCache.has(cacheKey)) {
                return filtersMemoryCache.get(cacheKey);
            }

            const url = buildFiltersUrl(serverAddress, userId, includeItemTypes);
            
            const cacheOptions = {
                useCache: useCache && !forceRefresh,
                ttl: 24 * 60 * 60 * 1000,
                forceRefresh: forceRefresh
            };

            const result = await window.apiHelper.getQuery(url, cacheOptions);
            const raw = await unwrapGetQueryResult(result);
            const normalized = normalizeFiltersPayload(raw);
            filtersMemoryCache.set(cacheKey, normalized);
            return normalized;
        },

        getFilterGenreItems: async function(includeItemTypes, options = {}) {
            const { useCache = true, forceRefresh = false } = options;
            const filters = await this.getFilters(includeItemTypes, useCache, forceRefresh);
            return filters.Genres || [];
        },

        getFilterTagItems: async function(includeItemTypes, options = {}) {
            const { useCache = true, forceRefresh = false } = options;
            const filters = await this.getFilters(includeItemTypes, useCache, forceRefresh);
            return filters.Tags || [];
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