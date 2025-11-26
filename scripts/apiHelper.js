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
            const libraryItems = await ApiClient.getItems();
            
            // We now want to include the library items with ColletionType "tvshows", or "movies"
            const supportedLibraryItems = libraryItems.Items.filter(item => item.CollectionType === 'tvshows' || item.CollectionType === 'movies');

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
        }
    };
    
    // Expose apiHelper to global window object
    window.apiHelper = apiHelper;
    
    console.log('[KefinTweaks APIHelper] Module loaded and available at window.apiHelper');
})();