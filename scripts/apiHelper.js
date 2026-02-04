(function() {
    'use strict';
    
    const LOG = (...args) => console.log('[KefinTweaks APIHelper]', ...args);
    const WARN = (...args) => console.warn('[KefinTweaks APIHelper]', ...args);
    const ERR = (...args) => console.error('[KefinTweaks APIHelper]', ...args);
    
    /**
     * Ensure ApiClient is available before using helper methods
     */
    function ensureApiClient() {
        if (typeof ApiClient === 'undefined' || !ApiClient) {
            throw new Error('ApiClient is not available');
        }
    }
    
    /**
     * Retrieves the active playback session for this device
     * @returns {Promise<Object>} - Active session object
     */
    async function getActiveSession() {
        ensureApiClient();
        
        const token = ApiClient.accessToken();
        const serverUrl = ApiClient.serverAddress();
        const deviceId = ApiClient.deviceId();
        
        if (!deviceId) {
            throw new Error('Device ID not available');
        }
        
        if (!serverUrl) {
            throw new Error('Server URL not available');
        }
        
        LOG('Fetching active session for device:', deviceId);
        
        const response = await fetch(`${serverUrl}/Sessions?deviceId=${deviceId}`, {
            method: 'GET',
            headers: {
                'Accept': 'application/json',
                'Authorization': `MediaBrowser Token="${token}"`
            }
        });
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const sessions = await response.json();
        
        if (Array.isArray(sessions) && sessions.length > 0) {
            return sessions[0];
        }
        
        if (sessions && !Array.isArray(sessions)) {
            return sessions;
        }
        
        throw new Error('No active session found for device');
    }

    const MAX_PLAY_NOW_IDS = 200;
    
    /**
     * Sends a PlayNow command directly to the active session
     * @param {Array<string>} ids - Item IDs to play
     * @param {Object} options - Additional playback options
     */
    async function sendPlayNow(ids, options = {}) {
        const session = await getActiveSession();
        const sessionId = session.Id;
        
        const token = ApiClient.accessToken();
        const serverUrl = ApiClient.serverAddress();

        const limitedIds = ids.slice(0, MAX_PLAY_NOW_IDS);
        
        const params = new URLSearchParams({
            playCommand: options.playCommand || 'PlayNow',
            itemIds: limitedIds.join(',')
        });
        
        if (options.startPositionTicks !== undefined) {
            params.set('startPositionTicks', options.startPositionTicks.toString());
        }
        if (options.subtitleStreamIndex !== undefined) {
            params.set('subtitleStreamIndex', options.subtitleStreamIndex.toString());
        }
        if (options.audioStreamIndex !== undefined) {
            params.set('audioStreamIndex', options.audioStreamIndex.toString());
        }
        if (options.mediaSourceId) {
            params.set('mediaSourceId', options.mediaSourceId);
        }
        
        LOG('Sending PlayNow command:', {
            sessionId,
            params: params.toString()
        });
        
        const response = await fetch(`${serverUrl}/Sessions/${sessionId}/Playing?${params.toString()}`, {
            method: 'POST',
            headers: {
                'X-Emby-Token': token,
            }
        });
        
        if (!response.ok) {
            throw new Error(`PlayNow request failed with HTTP ${response.status}: ${response.statusText}`);
        }
    }

    async function sendPlayLast(ids) {
        const session = await getActiveSession();
        const sessionId = session.Id;
        
        const token = ApiClient.accessToken();
        const serverUrl = ApiClient.serverAddress();

        const params = new URLSearchParams({
            playCommand: 'PlayLast',
            itemIds: ids.join(',')
        });
        
        LOG('Sending PlayLast command:', {
            sessionId,
            params: params.toString()
        });

        const response = await fetch(`${serverUrl}/Sessions/${sessionId}/Playing?${params.toString()}`, {
            method: 'POST',
            headers: {
                'X-Emby-Token': token
            }
        });
        
        if (!response.ok) {
            throw new Error(`PlayLast request failed with HTTP ${response.status}: ${response.statusText}`);
        }        
    }    

    /**
     * Check if user is admin
     * @returns {Promise<boolean>} - True if user is admin, false otherwise
     */
    async function isAdmin() {
        try {
            if (window.ApiClient && window.ApiClient.getCurrentUser) {
                const user = await window.ApiClient.getCurrentUser();
                return user && user.Policy && user.Policy.IsAdministrator === true;
            }
        } catch (error) {
            console.warn('[KefinTweaks APIHelper] Could not check admin status:', error);
        }
        return false;
    }
    
    /**
     * Query cache for API responses
     * Key: stringified options object
     * Value: { data: response, timestamp: Date.now() }
     */
    const queryCache = new Map();
    
    /**
     * Generate a cache key from options object
     * @param {Object} options - Query options
     * @returns {string} - Cache key
     */
    function getCacheKey(options) {
        // Sort keys to ensure consistent cache keys regardless of property order
        const sorted = Object.keys(options).sort().reduce((acc, key) => {
            acc[key] = options[key];
            return acc;
        }, {});
        return JSON.stringify(sorted);
    }
    
    /**
     * Get cached query result if valid
     * @param {string} cacheKey - Cache key
     * @param {number} ttl - Time to live in milliseconds
     * @returns {Object|null} - Cached data or null if expired/missing
     */
    function getCachedQuery(cacheKey, ttl) {
        const entry = queryCache.get(cacheKey);
        if (!entry) return null;
        
        const age = Date.now() - entry.timestamp;
        if (age > ttl) {
            queryCache.delete(cacheKey);
            return null;
        }
        return entry.data;
    }
    
    /**
     * Store query result in cache
     * @param {string} cacheKey - Cache key
     * @param {Object} data - Response data to cache
     */
    function setCachedQuery(cacheKey, data) {
        queryCache.set(cacheKey, {
            data: data,
            timestamp: Date.now()
        });
    }
    
    /**
     * Build URL from options for getItems
     * @param {string} userId - User ID
     * @param {Object} options - Query options
     * @returns {string} - Constructed URL
     */
    function buildItemsUrl(userId, options) {
        const serverAddress = ApiClient.serverAddress();
        const params = new URLSearchParams();
        
        // Add all options as query parameters
        Object.keys(options).forEach(key => {
            const value = options[key];
            if (value !== undefined && value !== null) {
                params.append(key, value);
            }
        });
        
        return `${serverAddress}/Users/${userId}/Items?${params.toString()}`;
    }
    
    /**
     * API Helper functions for Jellyfin operations
     */
    const apiHelper = {
        /**
         * Generic data fetcher with universal caching and progressive loading support
         * @param {string} url - Full URL to fetch
         * @param {Object} options - Cache options
         * @param {boolean} options.useCache - Whether to return cached data first (default: false)
         * @param {number} options.ttl - Cache time to live in milliseconds (default: 300000)
         * @returns {Promise<Object>|Object} - If useCache is true, returns { data, dataPromise, isStalePromise }. Otherwise returns Promise<data>.
         */
        getQuery: function(url, options = {}) {
            ensureApiClient();
            
            const useCache = options.useCache || false;
            let ttl = 300000;
            if (Number(options.ttl) >= 0) {
                ttl = Number(options.ttl);
            }
            const forceRefresh = options.forceRefresh || false;
            const cacheKey = url;
            
            // Standard fetch function
            const fetchData = async () => {
                try {
                    const token = ApiClient.accessToken();
                    const response = await fetch(url, {
                        headers: {
                            'X-Emby-Token': token,
                            'Accept': 'application/json'
                        }
                    });
                    
                    if (!response.ok) {
                        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                    }
                    
                    const data = await response.json();
                    
                    // Always cache successful responses
                    if (data) {
                        setCachedQuery(cacheKey, data);
                        // Also persist to IndexedDB if available
                        if (window.IndexedDBCache) {
                            const cache = window.IndexedDBCache;
                            // We use the full URL as part of the key, but hashed or sanitized might be safer. 
                            // For now using URL as is common in this codebase.
                            // IndexedDBCache expects a "name" which it prefixes. 
                            // We'll use a hash of the URL to keep keys clean? 
                            // Or just pass the URL as the cacheName but it might get messy.
                            // Let's use a simple mapping or just stringify.
                            // Actually, let's just stick to the in-memory cache for 'getQuery' unless we want persistent storage for home screen.
                            // The requirement says "use existing indexeddbcache functionality". 
                            // So let's use it.
                            await cache.set(url, data, null, ttl);
                        }
                    }
                    
                    return data;
                } catch (error) {
                    ERR('Failed to fetch URL:', error);
                    throw error;
                }
            };

            // If not using cache, just fetch
            if (!useCache) {
                return fetchData();
            }

            // Progressive loading Logic
            const result = {
                data: null,
                dataPromise: null,
                isStalePromise: null
            };

            // 1. Get cached data immediately (async but fast)
            const cachePromise = (async () => {
                // Try memory cache first
                let cached = getCachedQuery(cacheKey, ttl);
                
                // If not in memory, try IndexedDB
                if (!cached && window.IndexedDBCache) {
                    const dbCache = window.IndexedDBCache;
                    const entry = await dbCache.getCacheEntry(url);
                    if (entry) {
                        cached = entry; // Keep structure { payload, timestamp, ttl }
                        LOG(`[Cache] Found in IndexedDB: ${url.substring(0, 60)}...`);
                    }
                } else if (cached) {
                    // Wrap memory cache to match structure
                    cached = { payload: cached, timestamp: Date.now(), ttl: ttl }; 
                    LOG(`[Cache] Found in Memory: ${url.substring(0, 60)}...`);
                } else {
                    LOG(`[Cache] Miss: ${url.substring(0, 60)}...`);
                }
                
                return cached;
            })();

            // 2. Define staleness check
            result.isStalePromise = cachePromise.then(async (entry) => {
                if (forceRefresh) {
                    LOG(`[StaleCheck] Force Refresh -> Stale`);
                    return true; // Force Refresh = stale
                }

                if (!entry) {
                    LOG(`[StaleCheck] No cache entry -> Stale`);
                    return true; // No cache = stale
                }
                
                const now = Date.now();
                const age = now - entry.timestamp;
                const isExpired = age > ttl;
                
                result.data = entry.payload;

                if (!isExpired) {
                    LOG(`[StaleCheck] Cache valid (${(age/1000).toFixed(1)}s old) -> Not Stale`);
                    return false; // Valid
                }

                LOG(`[StaleCheck] Cache expired (${(age/1000).toFixed(1)}s old). Validating...`);

                // Cache is expired, check if we can validate it
                // Logic: Check SortBy
                const urlObj = new URL(url);
                const sortBy = urlObj.searchParams.get('SortBy');
                const isRandom = !sortBy || sortBy.includes('Random');

                if (isRandom) {
                    LOG(`[StaleCheck] Random sort detected -> Stale (Force Refresh)`);
                    return true; // Random + Expired = Stale
                }

                // Fixed Sort: Fetch first 3 items
                try {
                    // Clone URL and modify params
                    const checkUrl = new URL(url);
                    checkUrl.searchParams.set('Limit', '3');
                    //checkUrl.searchParams.set('StartIndex', '0'); // Ensure start
                    
                    const token = ApiClient.accessToken();
                    const checkResponse = await fetch(checkUrl.toString(), {
                        headers: {
                            'X-Emby-Token': token,
                            'Accept': 'application/json'
                        }
                    });
                    
                    if (!checkResponse.ok) {
                        LOG(`[StaleCheck] Validation fetch failed -> Stale`);
                        return true; 
                    }
                    
                    const checkData = await checkResponse.json();
                    
                    // Compare IDs
                    const cachedItems = entry.payload.Items || entry.payload || [];
                    const freshItems = checkData.Items || checkData || [];
                    
                    if (freshItems.length === 0 && cachedItems.length === 0) {
                        LOG(`[StaleCheck] Both empty -> Not Stale`);
                        return false; 
                    }
                    if (freshItems.length !== Math.min(cachedItems.length, 3)) {
                        LOG(`[StaleCheck] Count mismatch (Fresh: ${freshItems.length}, Cached: ${Math.min(cachedItems.length, 3)}) -> Stale`);
                        return true; 
                    }

                    for (let i = 0; i < freshItems.length; i++) {
                        if (freshItems[i].Id !== cachedItems[i].Id) {
                            LOG(`[StaleCheck] Item mismatch at index ${i} -> Stale`);
                            return true; // Mismatch found
                        }

                        // Also check the UserData for the item
                        if (freshItems[i].UserData) {
                            // Check each key in the UserData object
                            for (const key in freshItems[i].UserData) {
                                if (freshItems[i].UserData[key] !== cachedItems[i].UserData[key]) {
                                    LOG(`[StaleCheck] UserData mismatch for key ${key} -> Stale`);
                                    return true; // Mismatch found
                                }
                            }
                        }

                        // Also check the ImageTags for the item
                        if (freshItems[i].ImageTags) {
                            // Check each key in the ImageTags object
                            for (const key in freshItems[i].ImageTags) {
                                if (freshItems[i].ImageTags[key] !== cachedItems[i].ImageTags[key]) {
                                    LOG(`[StaleCheck] ImageTags mismatch for key ${key} -> Stale`);
                                    return true; // Mismatch found
                                }
                            }
                        }
                    }

                    // Validation Successful: Update timestamp
                    LOG(`[StaleCheck] Content matches -> Not Stale (Updating Timestamp)`);
                    if (window.IndexedDBCache) {
                        const dbCache = window.IndexedDBCache;
                        // Update with new timestamp but same data
                        dbCache.set(url, entry.payload, null, ttl);
                    }
                    
                    result.data = entry.payload; // Use cached data
                    return false; // Not stale

                } catch (e) {
                    WARN('Error validating cache:', e);
                    return true; // Assume stale on error
                }
            });

            // 3. Define data promise
            result.dataPromise = result.isStalePromise.then(isStale => {
                if (isStale) {
                    LOG(`[Fetch] Refreshing data for: ${url.substring(0, 60)}...`);
                    return fetchData();
                } else {
                    LOG(`[Fetch] Using cached data for: ${url.substring(0, 60)}...`);
                    return result.data; // Should be set by isStalePromise logic if valid
                }
            });
            
            return (async () => {
                // Initial check for cached data
                const entry = await cachePromise;
                result.data = entry ? entry.payload : null;
                return result;
            })();
        },

        invalidateCache: function(url) {
            const dbCache = window.IndexedDBCache;
            if (dbCache) {
                dbCache.clear(url);
            }
            if (queryCache) {
                queryCache.delete(url);
            }
        },

        /**
         * Generic data fetcher with universal caching
         * Always caches successful responses, but only checks cache when useCache is true
         * @param {string} url - Full URL to fetch
         * @param {boolean} useCache - Whether to use cache (skip fetch if valid cache exists, default: false)
         * @param {number} ttl - Cache time to live in milliseconds (default: 300000 = 5 minutes)
         * @returns {Promise<Object>} - Parsed JSON response
         */
        getData: async function(url, useCache = false, ttl = 300000) {
            ensureApiClient();
            
            const cacheKey = url;
            
            // If useCache is true, check cache first
            if (useCache) {
                const cached = getCachedQuery(cacheKey, ttl);
                if (cached !== null) {
                    LOG('Cache hit for URL:', url.substring(0, 100));
                    return cached;
                }
            }
            
            // Fetch from API
            try {
                const token = ApiClient.accessToken();
                const response = await fetch(url, {
                    headers: {
                        'X-Emby-Token': token,
                        'Accept': 'application/json'
                    }
                });
                
                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                }
                
                const data = await response.json();
                
                // Always cache successful responses (regardless of useCache flag)
                if (data) {
                    setCachedQuery(cacheKey, data);
                    LOG('Cached data for URL:', url.substring(0, 100));
                }
                
                return data;
            } catch (error) {
                ERR('Failed to fetch URL:', error);
                throw error;
            }
        },

        getWatchlistItems: async function(options = {}, useCache = false) {
            // First fetch the Library Items that contain items of the supported types from ApiClient.getJSON(ApiClient.getUrl("Library/MediaFolders"))
            const libraryItems = await window.dataHelper.getLibraries();
            
            // We now want to include the library items with ColletionType "tvshows", or "movies"
            const supportedCollectionTypes = ['tvshows', 'movies', 'homevideos', 'boxsets', 'playlists'];
            const supportedLibraryItems = libraryItems.filter(item => supportedCollectionTypes.includes(item.CollectionType) || !item.CollectionType);

            // Now use these support library items as the parent ids for the Items query, since the Items endpoint doesn't support ParentIds as an array we need to make a different call for each library. Querying with the parent id will dramatically reduce the time for the request to return so this is fine
            let watchlistItems = [];
            for (const libraryItem of supportedLibraryItems.reverse()) {
                // Get the item types to include based on the library type. if its a Movies library only use the Movie type. If it's tvshows then use Series, Season and Episode
                let itemTypes = options.IncludeItemTypes.split(',');
                if (itemTypes.length > 1) { 
                    if (libraryItem.CollectionType === 'movies') {
                        itemTypes = options.IncludeItemTypes.split(',').filter(item => item === 'Movie');
                    } else if (libraryItem.CollectionType === 'tvshows') {
                        itemTypes = options.IncludeItemTypes.split(',').filter(item => item === 'Series' || item === 'Season' || item === 'Episode');
                    }
                }
                
                // Use getItems to fetch the items for the library item
                const data = await this.getItems({
                    ParentId: libraryItem.Id,
                    Filters: 'Likes',
                    IncludeItemTypes: itemTypes.join(','),
                    Recursive: true,
                    ImageTypeLimit: 1,
                    EnableImageTypes: 'Primary,Backdrop,Thumb',
                    ...options
                }, useCache);

                //const url = `${ApiClient.serverAddress()}/Items?Filters=Likes&IncludeItemTypes=${type}&UserId=${ApiClient.getCurrentUserId()}&Recursive=true&ImageTypeLimit=1&EnableImageTypes=Primary,Backdrop,Thumb&ParentId=${libraryItem.Id}`;
                //const data = await this.getData(url, useCache);
                watchlistItems.push(...data.Items);
            }

            // Deuplicate any duplicate Id's in the watchlistItems array
            watchlistItems = watchlistItems.filter((item, index, self) =>
                index === self.findIndex((t) => t.Id === item.Id)
            );

            return {
                Items: watchlistItems,
                TotalRecordCount: watchlistItems.length
            };
        },
        
        /**
         * Get items from Jellyfin API with optional caching
         * @param {Object} options - Query options (same as ApiClient.getItems)
         * @param {boolean} useCache - Whether to use cache (default: false)
         * @param {number} ttl - Cache time to live in milliseconds (default: 300000 = 5 minutes)
         * @returns {Promise<Object>} - API response
         */
        getItems: async function(options = {}, useCache = false, ttl = 300000) {
            ensureApiClient();
            
            const userId = ApiClient.getCurrentUserId();
            const url = buildItemsUrl(userId, options);
            
            // Use getData which handles caching
            return await this.getData(url, useCache, ttl);
        },
        
        /**
         * Fetch a URL with optional caching (deprecated - use getData instead)
         * @param {string} url - URL to fetch
         * @param {Object} fetchOptions - Fetch options (headers, method, etc.)
         * @param {boolean} useCache - Whether to use cache (default: false)
         * @param {number} ttl - Cache time to live in milliseconds (default: 300000 = 5 minutes)
         * @returns {Promise<Object>} - Parsed JSON response
         * @deprecated Use getData instead. This method is kept for backward compatibility.
         */
        fetchCached: async function(url, fetchOptions = {}, useCache = false, ttl = 300000) {
            ensureApiClient();
            
            const cacheKey = getCacheKey({ url, fetchOptions });
            
            // If useCache is true, check cache first
            if (useCache) {
                const cached = getCachedQuery(cacheKey, ttl);
                if (cached !== null) {
                    LOG('Cache hit for URL:', url.substring(0, 100));
                    return cached;
                }
            }
            
            // Fetch from API
            try {
                const response = await fetch(url, fetchOptions);
                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                }
                const data = await response.json();
                
                // Always cache successful responses
                if (data) {
                    setCachedQuery(cacheKey, data);
                    LOG('Cached fetch result:', url.substring(0, 100));
                }
                
                return data;
            } catch (error) {
                ERR('Failed to fetch URL:', error);
                throw error;
            }
        },
        
        /**
         * Sets user rating for an item
         * @param {string} itemId - The item ID
         * @param {number} rating - The rating value
         * @returns {Promise} - Promise that resolves when rating is set
         */
        setUserRating: async function(itemId, rating) {
            ensureApiClient();
            
            const userId = ApiClient.getCurrentUserId();
            return fetch(`${ApiClient._serverAddress}/Users/${userId}/Items/${itemId}/UserData`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Emby-Token': ApiClient.accessToken()
                },
                body: JSON.stringify({
                    Rating: rating,
                    Likes: false
                })
            })
            .then(r => r.ok ? r.json() : r.text().then(t => Promise.reject(t)))
            .then(response => {
                LOG('Rating updated for item:', itemId, response);
                return response;
            })
            .catch(error => {
                ERR('Failed to set rating:', error);
                throw error;
            });
        },
        
        /**
         * Plays an item using Jellyfin's playback system
         * @param {string|Array<string>} itemId - Single item ID or array of item IDs to play
         * @param {Object} options - Additional playback options
         * @returns {Promise} - Promise that resolves when play command is sent
         */
        playItem: async function(itemId, options = {}) {
            const ids = Array.isArray(itemId) ? itemId : [itemId];
            
            try {
                ensureApiClient();
                await sendPlayNow(ids, options);
                return;
            } catch (error) {
                WARN('PlayNow command failed, attempting fallbacks:', error);
            }
            
            try {
                if (typeof ApiClient !== 'undefined' && typeof ApiClient.play === 'function') {
                    await ApiClient.play({ ids: ids });
                    return;
                }
            } catch (fallbackError) {
                WARN('ApiClient.play fallback failed:', fallbackError);
            }
            
            if (typeof PlaybackManager !== 'undefined' && PlaybackManager.play) {
                await PlaybackManager.play({
                    ids: ids,
                    serverId: ApiClient.serverId()
                });
                return;
            }
            
            // Last resort: Navigate to item details page
            const itemUrl = `/web/#/details?id=${ids[0]}&serverId=${ApiClient.serverId()}`;
            window.location.href = `${ApiClient.serverAddress()}${itemUrl}`;
        },
        
        /**
         * Updates the NowPlayingQueue for the active session
         * @param {Array<string>} itemIds - Array of item IDs to set as the queue
         * @returns {Promise} - Promise that resolves when queue is updated
         */
        updateQueue: async function(itemIds) {
            if (!Array.isArray(itemIds) || itemIds.length === 0) {
                throw new Error('Item IDs array is required and cannot be empty');
            }
            
            ensureApiClient();
            
            const session = await getActiveSession();
            const sessionId = session?.Id;
            
            if (!sessionId) {
                throw new Error('No active session found');
            }
            
            const token = ApiClient.accessToken();
            const serverUrl = ApiClient.serverAddress();
            
            // Build NowPlayingQueue array - each item needs at least an Id
            const nowPlayingQueue = itemIds.map(id => ({
                Id: id
            }));
            
            const payload = {
                NowPlayingQueue: nowPlayingQueue
            };
            
            LOG('Updating playback queue:', {
                itemCount: itemIds.length
            });
            
            const response = await fetch(`${serverUrl}/Sessions/Playing`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `MediaBrowser Token="${token}"`
                },
                body: JSON.stringify(payload)
            });
            
            if (!response.ok) {
                const errorText = await response.text().catch(() => response.statusText);
                throw new Error(`Queue update failed with HTTP ${response.status}: ${errorText}`);
            }
            
            LOG('Queue updated successfully');
        },
        /**
         * Gets a genre ID from cached movie genres
         * @param {string} genreName - Name of the genre to find
         * @returns {Promise<string|null>} - Genre ID or null if not found
         */
        getGenreId: async function(genreName) {
            if (!cachedMovieGenres) {
                const url = `${ApiClient.serverAddress()}/Genres?IncludeItemTypes=Movie`;
                // Use getData to fetch the genres with caching
                const genres = await this.getData(url, true, GENRE_TTL);
                cachedMovieGenres = genres.Items;
            }
            
            // Find the genre by name (case insensitive)
            const genre = cachedMovieGenres.find(g => g.Name.toLowerCase() === genreName.toLowerCase());
            return genre ? genre.Id : null;
        },

        /**
         * Build query URL from section query configuration
         * Handles minAge/maxAge conversion to MinPremiereDate/MaxPremiereDate
         * @param {Object} query - Query object with optional path, dataSource, minAge, maxAge, and queryOptions
         * @param {string} userId - User ID
         * @param {string} serverUrl - Server URL
         * @returns {string|Object} - Query URL string or dataSource marker object
         */
        buildQueryFromSection: function(query, userId, serverUrl) {
            ensureApiClient();
            
            const queryOptions = { ...(query.queryOptions || {}) };
            
            // Convert minAge/maxAge to premiere date range
            if (query.minAge !== undefined || query.maxAge !== undefined) {
                const now = new Date();
                
                if (query.maxAge !== undefined) {
                    // maxAge days ago = minimum premiere date (oldest content)
                    const minDate = new Date(now);
                    minDate.setDate(minDate.getDate() - query.maxAge);
                    queryOptions.MinPremiereDate = minDate.toISOString().split('T')[0];
                }
                
                if (query.minAge !== undefined) {
                    // minAge days ago = maximum premiere date (newest content)
                    const maxDate = new Date(now);
                    maxDate.setDate(maxDate.getDate() - query.minAge);
                    queryOptions.MaxPremiereDate = maxDate.toISOString().split('T')[0];
                }
            }
            
            // Build query based on type
            if (query.path) {
                return this.buildCustomEndpoint(query.path, queryOptions, userId, serverUrl);
            }
            
            if (query.dataSource) {
                return { dataSource: query.dataSource, options: queryOptions };
            }
            
            // Standard /Items query
            return this.buildStandardQuery(queryOptions, userId, serverUrl);
        },

        /**
         * Build standard /Items query URL
         * @param {Object} queryOptions - Query options
         * @param {string} userId - User ID
         * @param {string} serverUrl - Server URL
         * @returns {string} - Query URL
         */
        buildStandardQuery: function(queryOptions, userId, serverUrl) {
            // Fields that require pipe delimiter instead of comma
            const PIPE_DELIMITED_FIELDS = ['Genres', 'Tags', 'OfficialRatings', 'Studios', 'Artists', 'ExcludeArtistsIds', 'Albums', 'AlbumIds', 'StudioIds', 'GenreIds'];
            
            const params = new URLSearchParams({
                Recursive: 'true',
                Fields: 'PrimaryImageAspectRatio,DateCreated,Overview,Taglines,ProductionYear,RecursiveItemCount,ChildCount,UserData',
                ImageTypeLimit: 1,
                UserId: userId
            });
            
            // Map all queryOptions to params
            Object.entries(queryOptions || {}).forEach(([key, value]) => {
                if (value !== undefined && value !== null) {
                    if (Array.isArray(value)) {
                        // Use pipe delimiter for specific fields, comma for others
                        const delimiter = PIPE_DELIMITED_FIELDS.includes(key) ? '|' : ',';
                        params.set(key, value.join(delimiter));
                    } else {
                        // If the key is Limit and the value is 0, do not set the param
                        if (key === 'Limit' && value === 0) {
                            return;
                        }
                        params.set(key, value);
                    }
                }
            });
            
            return `${serverUrl}/Items?${params.toString()}`;
        },

        /**
         * Build custom endpoint URL
         * @param {string} path - Custom endpoint path (e.g., '/Shows/NextUp')
         * @param {Object} queryOptions - Query options
         * @param {string} userId - User ID
         * @param {string} serverUrl - Server URL
         * @returns {string} - Query URL
         */
        buildCustomEndpoint: function(path, queryOptions, userId, serverUrl) {
            // Fields that require pipe delimiter instead of comma
            const PIPE_DELIMITED_FIELDS = ['Genres', 'Tags', 'OfficialRatings', 'Studios', 'Artists', 'ExcludeArtistsIds', 'Albums', 'AlbumIds', 'StudioIds', 'GenreIds'];
            
            const params = new URLSearchParams({
                UserId: userId
            });
            
            // Add query options to params
            Object.entries(queryOptions || {}).forEach(([key, value]) => {
                if (value !== undefined && value !== null) {
                    if (Array.isArray(value)) {
                        // Use pipe delimiter for specific fields, comma for others
                        const delimiter = PIPE_DELIMITED_FIELDS.includes(key) ? '|' : ',';
                        params.set(key, value.join(delimiter));
                    } else {
                        // If the key is Limit and the value is 0, do not set the param
                        if (key === 'Limit' && value === 0) {
                            return;
                        }
                        params.set(key, value);
                    }
                }
            });
            
            // Add default fields for custom endpoints if not specified
            if (!params.has('Fields')) {
                params.set('Fields', 'PrimaryImageAspectRatio,DateCreated,MediaSourceCount,UserData');
            }
            if (!params.has('ImageTypeLimit')) {
                params.set('ImageTypeLimit', '1');
            }
            if (!params.has('EnableTotalRecordCount')) {
                params.set('EnableTotalRecordCount', 'false');
            }
            
            return `${serverUrl}${path}?${params.toString()}`;
        },
        
        /**
         * Fetch from data source (cache-based)
         * @param {string} dataSource - Data source in format "CacheName.methodName"
         * @param {Object} options - Query options (sorting, limits, etc.)
         * @returns {Object} - Object with data, dataPromise, and isStalePromise
         */
        fetchFromDataSource: async function(dataSource, options, useCache = true) {
            const [cacheName, methodName] = dataSource.split('.');
            const cache = window[cacheName];
            
            if (!cache || !cache[methodName]) {
                WARN(`Data source not available: ${dataSource}`);
                return {
                    data: { Items: [] },
                    dataPromise: Promise.resolve({ Items: [] }),
                    isStalePromise: Promise.resolve(false)
                };
            }
            
            try {
                let dataPromise = cache[methodName]();
                dataPromise = dataPromise.then(data => {
                    if (!Array.isArray(data)) {
                        data = [];
                    }
                    
                    // Filter studios/networks with no thumb
                    if (cacheName === 'StudiosCache') {
                        data = data.filter(item => item.ImageTags?.Thumb);
                    }
                    
                    // Apply options (sorting, limits, etc.)
                    if (options.SortBy === 'Random') {
                        data = data.sort(() => Math.random() - 0.5);
                    } else if (options.SortBy) {
                        data = data.sort((a, b) => {
                            const aVal = a[options.SortBy];
                            const bVal = b[options.SortBy];
                            if (aVal === bVal) return 0;
                            const comparison = aVal > bVal ? 1 : -1;
                            return options.SortOrder === 'Descending' ? -comparison : comparison;
                        });
                    }
                    
                    if (options.Limit) {
                        data = data.slice(0, options.Limit);
                    }
                    return {
                        Items: data
                    };
                });

                if (!useCache) {
                    return await dataPromise;
                }
                
                return {
                    data: { Items: [] },
                    dataPromise: dataPromise,
                    isStalePromise: Promise.resolve(false)
                };
            } catch (error) {
                ERR(`Failed to fetch from ${dataSource}:`, error);
                return {
                    data: { Items: [] },
                    dataPromise: Promise.resolve({ Items: [] }),
                    isStalePromise: Promise.resolve(false)
                };
            }
        },

        /**
         * Merge results from multiple queries
         * @param {Array} results - Array of query result objects
         * @param {Object} sectionConfig - Section configuration object
         * @returns {Object} - Merged result object with config, result.data, result.dataPromise, result.isStalePromise
         */
        mergeMultiQueryResults: function(results, sectionConfig) {
            // Combine all items from all queries
            const allItems = [];
            const itemsByQuery = [];
            const allPromises = [];
            const promisesByQuery = [];
            
            results.forEach(result => {
                if (result.data?.Items) {
                    allItems.push(...result.data.Items);
                    itemsByQuery.push(result.data.Items);
                }
                allPromises.push(result.dataPromise);
                promisesByQuery.push(result.dataPromise);
            });
            
            // Sort merged items if sortBy specified
            /* if (sectionConfig.sortBy) {
                allItems.sort((a, b) => {
                    const aVal = a[sectionConfig.sortBy] || (a.UserData?.[sectionConfig.sortBy] ? new Date(a.UserData[sectionConfig.sortBy]).getTime() : 0);
                    const bVal = b[sectionConfig.sortBy] || (b.UserData?.[sectionConfig.sortBy] ? new Date(b.UserData[sectionConfig.sortBy]).getTime() : 0);
                    
                    // Handle DatePlayed specifically for merged Continue/NextUp
                    if (sectionConfig.sortBy === 'DatePlayed') {
                        const aDate = a.UserData?.LastPlayedDate ? new Date(a.UserData.LastPlayedDate).getTime() : 0;
                        const bDate = b.UserData?.LastPlayedDate ? new Date(b.UserData.LastPlayedDate).getTime() : 0;
                        const comparison = aDate > bDate ? 1 : aDate < bDate ? -1 : 0;
                        return sectionConfig.sortOrder === 'Descending' ? -comparison : comparison;
                    }
                    
                    const comparison = aVal > bVal ? 1 : aVal < bVal ? -1 : 0;
                    return sectionConfig.sortOrder === 'Descending' ? -comparison : comparison;
                });
            } */
            
            // Create merged data promise
            const dataPromisesByQuery = Promise.all(allPromises).then(allData => {
                const dataPromises = [];
                allData.forEach(data => {
                    if (data?.Items) {
                        dataPromises.push(data.Items);
                    }
                });
                
                // Sort merged results
                /* if (sectionConfig.sortBy) {
                    mergedItems.sort((a, b) => {
                        const aVal = a[sectionConfig.sortBy] || (a.UserData?.[sectionConfig.sortBy] ? new Date(a.UserData[sectionConfig.sortBy]).getTime() : 0);
                        const bVal = b[sectionConfig.sortBy] || (b.UserData?.[sectionConfig.sortBy] ? new Date(b.UserData[sectionConfig.sortBy]).getTime() : 0);
                        
                        if (sectionConfig.sortBy === 'DatePlayed') {
                            const aDate = a.UserData?.LastPlayedDate ? new Date(a.UserData.LastPlayedDate).getTime() : 0;
                            const bDate = b.UserData?.LastPlayedDate ? new Date(b.UserData.LastPlayedDate).getTime() : 0;
                            const comparison = aDate > bDate ? 1 : aDate < bDate ? -1 : 0;
                            return sectionConfig.sortOrder === 'Descending' ? -comparison : comparison;
                        }
                        
                        const comparison = aVal > bVal ? 1 : aVal < bVal ? -1 : 0;
                        return sectionConfig.sortOrder === 'Descending' ? -comparison : comparison;
                    });
                } */
                
                return dataPromises;
            });

            /* const dataPromisesByQuery = Promise.all(promisesByQuery).then(allData => {
                const dataPromises = [];
                allData.forEach(data => {
                    if (data?.Items) {
                        dataPromises.push(data.Items);
                    }
                });
                return dataPromises;
            }); */
            
            return {
                config: sectionConfig,
                result: {
                    data: { Items: window.cardBuilder.postProcessItemsByQuery(sectionConfig, itemsByQuery) },
                    dataPromise: dataPromisesByQuery.then(data => window.cardBuilder.postProcessItemsByQuery(sectionConfig, data)),
                    isStalePromise: Promise.all(results.map(r => r.isStalePromise || Promise.resolve(false)))
                        .then(staleFlags => staleFlags.some(s => s))
                }
            };
        },
        
        isAdmin: isAdmin
    };

    const GENRE_TTL = 24 * 60 * 60 * 1000; // 24 hours
    let cachedMovieGenres = null;
    
    // Expose apiHelper to global window object
    window.apiHelper = apiHelper;
    
    console.log('[KefinTweaks APIHelper] Module loaded and available at window.apiHelper');
})();