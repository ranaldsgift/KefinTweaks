// KefinTweaks localStorage Cache Manager
// Provides 24-hour TTL caching with manual refresh functionality
// Usage: Integrates with existing cache system to add persistence

(function() {
    'use strict';
    
    // Common logging function
    const LOG = (...args) => console.log('[KefinTweaks LocalStorageCache]', ...args);
    const WARN = (...args) => console.warn('[KefinTweaks LocalStorageCache]', ...args);
    const ERR = (...args) => console.error('[KefinTweaks LocalStorageCache]', ...args);
    
    // Generic localStorage cache manager with chunked storage support
    class LocalStorageCache {
        constructor(prefix = 'kefinTweaks_', ttl = 24 * 60 * 60 * 1000, chunkSize = 10) { // 24 hours, 10 items per chunk
            this.prefix = prefix;
            this.ttl = ttl;
            this.chunkSize = chunkSize;
        }

        // Generate cache key with user context
        getCacheKey(cacheName, userId = null) {
            const user = userId || window.ApiClient?.getCurrentUserId() || 'anonymous';
            return `${this.prefix}${cacheName}_${user}`;
        }

        // Check if cache is valid (not expired)
        isCacheValid(cacheName, userId = null) {
            const key = this.getCacheKey(cacheName, userId);
            const cached = localStorage.getItem(key);
            if (!cached) return false;
            
            try {
                const data = JSON.parse(cached);
                const now = Date.now();
                const ttl = data.ttl || this.ttl; // Use stored TTL or default
                return (now - data.timestamp) < ttl;
            } catch {
                return false;
            }
        }

        // Get cached data if valid
        get(cacheName, userId = null) {
            if (!this.isCacheValid(cacheName, userId)) {
                return null;
            }
            
            const key = this.getCacheKey(cacheName, userId);
            try {
                const cached = localStorage.getItem(key);
                const data = JSON.parse(cached);
                return data.payload;
            } catch {
                return null;
            }
        }

        // Store data with timestamp
        set(cacheName, data, userId = null, customTtl = null) {
            const key = this.getCacheKey(cacheName, userId);
            const ttl = customTtl || this.ttl;
            const payload = {
                timestamp: Date.now(),
                ttl: ttl,
                payload: data
            };
            
            try {
                localStorage.setItem(key, JSON.stringify(payload));
                LOG(`Cached data for ${cacheName}: ${Array.isArray(data) ? data.length : 'object'} items (TTL: ${ttl / (1000 * 60 * 60)}h)`);
                return true;
            } catch (error) {
                WARN('Failed to store data:', error);
                return false;
            }
        }

        // Clear specific cache
        clear(cacheName, userId = null) {
            const key = this.getCacheKey(cacheName, userId);
            localStorage.removeItem(key);
            LOG(`Cleared cache for ${cacheName}`);
        }

        // Clear all caches for current user
        clearAll(userId = null) {
            const user = userId || window.ApiClient?.getCurrentUserId() || 'anonymous';
            const keys = Object.keys(localStorage).filter(key => 
                key.startsWith(this.prefix) && key.endsWith(`_${user}`)
            );
            keys.forEach(key => localStorage.removeItem(key));
            LOG(`Cleared all caches for user ${user}: ${keys.length} entries`);
        }

        // Get cache age in hours
        getCacheAge(cacheName, userId = null) {
            const key = this.getCacheKey(cacheName, userId);
            const cached = localStorage.getItem(key);
            if (!cached) return null;
            
            try {
                const data = JSON.parse(cached);
                return (Date.now() - data.timestamp) / (1000 * 60 * 60); // hours
            } catch {
                return null;
            }
        }

        // Get cache size in bytes (approximate)
        getCacheSize(cacheName, userId = null) {
            const key = this.getCacheKey(cacheName, userId);
            const cached = localStorage.getItem(key);
            return cached ? cached.length : 0;
        }

        // Get all cache names for current user
        getAllCacheNames(userId = null) {
            const user = userId || window.ApiClient?.getCurrentUserId() || 'anonymous';
            const keys = Object.keys(localStorage).filter(key => 
                key.startsWith(this.prefix) && key.endsWith(`_${user}`)
            );
            return keys.map(key => key.replace(this.prefix, '').replace(`_${user}`, ''));
        }

        // Chunked storage methods for large datasets
        setChunked(cacheName, data, userId = null) {
            if (!Array.isArray(data)) {
                WARN('Chunked storage requires array data');
                return false;
            }

            if (data.length === 0) {
                LOG(`No data to chunk for ${cacheName}`);
                return true;
            }

            try {
                const chunks = this.chunkArray(data, this.chunkSize);
                const chunkCount = chunks.length;
                
                LOG(`Storing ${data.length} items in ${chunkCount} chunks for ${cacheName}`);
                
                // Store each chunk
                for (let i = 0; i < chunks.length; i++) {
                    const chunkKey = `${cacheName}_chunk_${i}`;
                    const chunkData = {
                        chunkIndex: i,
                        totalChunks: chunkCount,
                        data: chunks[i],
                        timestamp: Date.now()
                    };
                    
                    if (!this.set(chunkKey, chunkData, userId)) {
                        WARN(`Failed to store chunk ${i} for ${cacheName}`);
                        return false;
                    }
                }
                
                // Store metadata
                const metadata = {
                    totalChunks: chunkCount,
                    totalItems: data.length,
                    timestamp: Date.now(),
                    chunkSize: this.chunkSize
                };
                
                if (!this.set(`${cacheName}_meta`, metadata, userId)) {
                    WARN(`Failed to store metadata for ${cacheName}`);
                    return false;
                }
                
                LOG(`Successfully stored ${data.length} items in ${chunkCount} chunks for ${cacheName}`);
                return true;
                
            } catch (error) {
                ERR(`Error storing chunked data for ${cacheName}:`, error);
                return false;
            }
        }

        // Load chunked data
        getChunked(cacheName, userId = null) {
            try {
                const meta = this.get(`${cacheName}_meta`, userId);
                if (!meta) {
                    LOG(`No metadata found for chunked cache ${cacheName}`);
                    return null;
                }

                if (!this.isCacheValid(`${cacheName}_meta`, userId)) {
                    LOG(`Chunked cache ${cacheName} has expired`);
                    return null;
                }

                const allData = [];
                let missingChunks = 0;
                
                for (let i = 0; i < meta.totalChunks; i++) {
                    const chunk = this.get(`${cacheName}_chunk_${i}`, userId);
                    if (chunk && chunk.data) {
                        allData.push(...chunk.data);
                    } else {
                        missingChunks++;
                        WARN(`Missing chunk ${i} for ${cacheName}`);
                    }
                }
                
                if (missingChunks > 0) {
                    WARN(`Missing ${missingChunks} chunks for ${cacheName}, returning null`);
                    return null;
                }
                
                if (allData.length !== meta.totalItems) {
                    WARN(`Data length mismatch for ${cacheName}: expected ${meta.totalItems}, got ${allData.length}`);
                    return null;
                }
                
                LOG(`Successfully loaded ${allData.length} items from ${meta.totalChunks} chunks for ${cacheName}`);
                return allData;
                
            } catch (error) {
                ERR(`Error loading chunked data for ${cacheName}:`, error);
                return null;
            }
        }

        // Clear chunked cache
        clearChunked(cacheName, userId = null) {
            try {
                const meta = this.get(`${cacheName}_meta`, userId);
                if (meta) {
                    // Clear all chunks
                    for (let i = 0; i < meta.totalChunks; i++) {
                        this.clear(`${cacheName}_chunk_${i}`, userId);
                    }
                    // Clear metadata
                    this.clear(`${cacheName}_meta`, userId);
                    LOG(`Cleared chunked cache ${cacheName} (${meta.totalChunks} chunks)`);
                } else {
                    LOG(`No chunked cache found for ${cacheName}`);
                }
            } catch (error) {
                ERR(`Error clearing chunked cache ${cacheName}:`, error);
            }
        }

        // Utility method to chunk arrays
        chunkArray(array, size) {
            const chunks = [];
            for (let i = 0; i < array.length; i += size) {
                chunks.push(array.slice(i, i + size));
            }
            return chunks;
        }

        // Check if a cache is chunked
        isChunked(cacheName, userId = null) {
            const meta = this.get(`${cacheName}_meta`, userId);
            return meta && meta.totalChunks > 1;
        }
    }

    // Create global instance
    window.LocalStorageCache = LocalStorageCache;
    
    LOG('LocalStorageCache manager loaded');
    
})();
