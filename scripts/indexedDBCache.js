// KefinTweaks IndexedDB Cache Manager
// Provides TTL caching with large storage capacity using IndexedDB
// Usage: For caches that exceed localStorage limits

(function() {
    'use strict';
    
    const LOG = (...args) => console.log('[KefinTweaks IndexedDBCache]', ...args);
    const WARN = (...args) => console.warn('[KefinTweaks IndexedDBCache]', ...args);
    const ERR = (...args) => console.error('[KefinTweaks IndexedDBCache]', ...args);
    
    const DB_NAME = 'KefinTweaksCache';
    const DB_VERSION = 1;
    const STORE_NAME = 'cache';
    
    // Generic IndexedDB cache manager
    class IndexedDBCache {
        constructor(prefix = 'kefinTweaks_', ttl = 24 * 60 * 60 * 1000) {
            this.prefix = prefix;
            this.ttl = ttl;
            this.db = null;
        }

        // Open database connection
        async openDB() {
            if (this.db) return this.db;
            
            return new Promise((resolve, reject) => {
                const request = indexedDB.open(DB_NAME, DB_VERSION);
                
                request.onerror = () => {
                    ERR('Failed to open IndexedDB:', request.error);
                    reject(request.error);
                };
                
                request.onsuccess = () => {
                    this.db = request.result;
                    resolve(this.db);
                };
                
                request.onupgradeneeded = (event) => {
                    const db = event.target.result;
                    if (!db.objectStoreNames.contains(STORE_NAME)) {
                        db.createObjectStore(STORE_NAME, { keyPath: 'key' });
                    }
                };
            });
        }

        // Generate cache key with user context
        getCacheKey(cacheName, userId = null) {
            const user = userId || window.ApiClient?.getCurrentUserId() || 'anonymous';
            return `${this.prefix}${cacheName}_${user}`;
        }

        // Check if cache is valid (not expired)
        async isCacheValid(cacheName, userId = null) {
            const key = this.getCacheKey(cacheName, userId);
            
            try {
                const db = await this.openDB();
                const transaction = db.transaction([STORE_NAME], 'readonly');
                const store = transaction.objectStore(STORE_NAME);
                const request = store.get(key);
                
                return new Promise((resolve) => {
                    request.onsuccess = () => {
                        const data = request.result;
                        if (!data) {
                            resolve(false);
                            return;
                        }
                        
                        const now = Date.now();
                        const ttl = data.ttl || this.ttl;
                        resolve((now - data.timestamp) < ttl);
                    };
                    
                    request.onerror = () => {
                        WARN('Error checking cache validity:', request.error);
                        resolve(false);
                    };
                });
            } catch (error) {
                ERR('Error in isCacheValid:', error);
                return false;
            }
        }

        // Get cached data if valid
        async get(cacheName, userId = null) {
            if (!(await this.isCacheValid(cacheName, userId))) {
                return null;
            }
            
            const key = this.getCacheKey(cacheName, userId);
            
            try {
                const db = await this.openDB();
                const transaction = db.transaction([STORE_NAME], 'readonly');
                const store = transaction.objectStore(STORE_NAME);
                const request = store.get(key);
                
                return new Promise((resolve) => {
                    request.onsuccess = () => {
                        const data = request.result;
                        resolve(data ? data.payload : null);
                    };
                    
                    request.onerror = () => {
                        WARN('Error getting cache:', request.error);
                        resolve(null);
                    };
                });
            } catch (error) {
                ERR('Error in get:', error);
                return null;
            }
        }

        // Store data with timestamp
        async set(cacheName, data, userId = null, customTtl = null) {
            const key = this.getCacheKey(cacheName, userId);
            const ttl = customTtl || this.ttl;
            const payload = {
                key: key,
                timestamp: Date.now(),
                ttl: ttl,
                payload: data
            };
            
            try {
                const db = await this.openDB();
                const transaction = db.transaction([STORE_NAME], 'readwrite');
                const store = transaction.objectStore(STORE_NAME);
                const request = store.put(payload);
                
                return new Promise((resolve) => {
                    request.onsuccess = () => {
                        LOG(`Cached data for ${cacheName}: ${Array.isArray(data) ? data.length : 'object'} items (TTL: ${ttl / (1000 * 60 * 60)}h)`);
                        resolve(true);
                    };
                    
                    request.onerror = () => {
                        WARN('Failed to store data:', request.error);
                        resolve(false);
                    };
                });
            } catch (error) {
                ERR('Error in set:', error);
                return false;
            }
        }

        // Clear specific cache
        async clear(cacheName, userId = null) {
            const key = this.getCacheKey(cacheName, userId);
            
            try {
                const db = await this.openDB();
                const transaction = db.transaction([STORE_NAME], 'readwrite');
                const store = transaction.objectStore(STORE_NAME);
                const request = store.delete(key);
                
                return new Promise((resolve) => {
                    request.onsuccess = () => {
                        LOG(`Cleared cache for ${cacheName}`);
                        resolve(true);
                    };
                    
                    request.onerror = () => {
                        WARN('Error clearing cache:', request.error);
                        resolve(false);
                    };
                });
            } catch (error) {
                ERR('Error in clear:', error);
                return false;
            }
        }

        // Clear all caches for current user
        async clearAll(userId = null) {
            const user = userId || window.ApiClient?.getCurrentUserId() || 'anonymous';
            const userSuffix = `_${user}`;
            
            try {
                const db = await this.openDB();
                const transaction = db.transaction([STORE_NAME], 'readwrite');
                const store = transaction.objectStore(STORE_NAME);
                const request = store.openCursor();
                
                return new Promise((resolve) => {
                    let count = 0;
                    
                    request.onsuccess = (event) => {
                        const cursor = event.target.result;
                        if (cursor) {
                            const key = cursor.value.key;
                            if (key.startsWith(this.prefix) && key.endsWith(userSuffix)) {
                                cursor.delete();
                                count++;
                            }
                            cursor.continue();
                        } else {
                            LOG(`Cleared all caches for user ${user}: ${count} entries`);
                            resolve(count);
                        }
                    };
                    
                    request.onerror = () => {
                        WARN('Error clearing all caches:', request.error);
                        resolve(0);
                    };
                });
            } catch (error) {
                ERR('Error in clearAll:', error);
                return false;
            }
        }
    }

    // Create global instance
    window.IndexedDBCache = IndexedDBCache;
    
    LOG('IndexedDBCache manager loaded');
    
})();

