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

    function ensureLoggedIn() {
        if (typeof ApiClient === 'undefined' || !ApiClient) {
            throw new Error('ApiClient is not available');
        }
        if (!ApiClient._loggedIn) {
            throw new Error('User is not logged in');
        }
    }

    // Poll until ApiClient reports logged in. Uses one Promise so callers always settle.
    // requestIdleCallback (with setTimeout fallback) avoids busy-looping the main thread.
    async function waitForLogin(maxWaitMs = 60000) {
        const startTime = Date.now();
        const schedule = (fn) => {
            if (typeof requestIdleCallback === 'function') {
                requestIdleCallback(fn);
            } else {
                setTimeout(fn, 0);
            }
        };

        return new Promise((resolve) => {
            const tick = () => {
                if (window.ApiClient && window.ApiClient._loggedIn) {
                    LOG('waitForLogin: logged in');
                    resolve(true);
                    return;
                }
                if (Date.now() - startTime >= maxWaitMs) {
                    WARN('waitForLogin: timed out after', maxWaitMs, 'ms');
                    resolve(false);
                    return;
                }
                setTimeout(() => schedule(tick), 100);
            };
            schedule(tick);
        });
    }
    
    /**
     * API Helper functions for Jellyfin operations
     */
    const userHelper = {
        getUserDisplayPreferences: async function() {
            ensureApiClient();
            ensureLoggedIn();

            let cachedDisplayPreferences = null;
            
            if (__userDisplayPreferences) {
                cachedDisplayPreferences = __userDisplayPreferences;
            } else if (window.LocalStorageCache) {
                const cache = new window.LocalStorageCache();
                const displayPreferencesData = cache.get('userDisplayPreferences');
                if (displayPreferencesData) {
                    cachedDisplayPreferences = displayPreferencesData;
                }
            }

            // Wrap this in a promise to return with the cached data
            const userDisplayPreferencesPromise = new Promise(async (resolve, reject) => {
                try {
                    // Fetch the user display preferences
                    LOG('Fetching user display preferences');
                    const response = await fetch(`${ApiClient.serverAddress()}/DisplayPreferences/usersettings?userId=${ApiClient.getCurrentUserId()}&client=emby`, {
                        headers: {
                            'Authorization': window.apiHelper.getAuthHeader()
                        }
                    });
                    if (!response.ok) {
                        reject(new Error(`Failed to fetch display preferences: ${response.status}`));
                        return;
                    }
                    const data = await response.json();
                    __userDisplayPreferences = data;
                    // Save the display preferences to localStorage
                    if (window.LocalStorageCache) {
                        const cache = new window.LocalStorageCache();
                        cache.set('userDisplayPreferences', data, ApiClient.getCurrentUserId(), 24 * 60 * 60 * 1000);
                    }
                    resolve(data);
                } catch (error) {
                    reject(error);
                }
            });

            return { promise: userDisplayPreferencesPromise, cached: cachedDisplayPreferences };
        },
        useEpisodeImages: async function() {
            try {
                ensureApiClient();
                ensureLoggedIn();
                const { promise, cached } = await this.getUserDisplayPreferences();
                const userDisplayPreferences = await promise;
                return userDisplayPreferences.CustomPrefs?.useEpisodeImagesInNextUpAndResume === 'true';
            } catch (error) {
                WARN('Failed to load user display preferences for useEpisodeImages:', error);
                return false;
            }
        },
        updateCustomPrefsByKey: async function(key, value) {
            const { promise, cached } = await this.getUserDisplayPreferences();
            const userDisplayPreferences = await promise;
            if (!userDisplayPreferences) {
                LOG('No user display preferences found');
                return false;
            }   
            userDisplayPreferences.CustomPrefs[key] = value;
            return await this.updateDisplayPreferences(userDisplayPreferences);
        },
        updateDisplayPreferences: async function(prefs) {
            ensureApiClient();
            const userId = ApiClient.getCurrentUserId();
            return await this.updateDisplayPreferencesForUser(userId, prefs, { updateCache: true });
        },

        /**
         * Fetch display preferences for an arbitrary user (admin).
         * @param {string} userId
         * @returns {Promise<object>}
         */
        getUserDisplayPreferencesForUser: async function(userId) {
            ensureApiClient();
            if (!userId) throw new Error('userId is required');
            const response = await fetch(
                `${ApiClient.serverAddress()}/DisplayPreferences/usersettings?userId=${encodeURIComponent(userId)}&client=emby`,
                { headers: { 'Authorization': window.apiHelper.getAuthHeader() } }
            );
            if (!response.ok) {
                throw new Error(`Failed to fetch display preferences for ${userId}: ${response.status}`);
            }
            return response.json();
        },

        /**
         * Persist display preferences for an arbitrary user (admin).
         * @param {string} userId
         * @param {object} prefs
         * @param {{ updateCache?: boolean }} [options]
         * @returns {Promise<boolean>}
         */
        updateDisplayPreferencesForUser: async function(userId, prefs, options = {}) {
            ensureApiClient();
            if (!userId) throw new Error('userId is required');
            const serverAddress = ApiClient.serverAddress();
            const url = `${serverAddress}/DisplayPreferences/usersettings?userId=${encodeURIComponent(userId)}&client=emby`;
            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': window.apiHelper.getAuthHeader()
                },
                body: JSON.stringify(prefs)
            });
            if (response.ok && options.updateCache && userId === ApiClient.getCurrentUserId()) {
                __userDisplayPreferences = prefs;
                if (window.LocalStorageCache) {
                    try {
                        const cache = new window.LocalStorageCache();
                        cache.set('userDisplayPreferences', prefs, userId, 24 * 60 * 60 * 1000);
                    } catch (_) { /* ignore */ }
                }
            }
            return response.ok;
        },

        /**
         * Parse CustomPrefs.kefinTweaks (JSON string or object) into a plain object.
         * @param {object|string|null} customPrefsOrPrefs - CustomPrefs object, full display prefs, or raw kefinTweaks value
         * @returns {object}
         */
        parseKefinTweaks: function(customPrefsOrPrefs) {
            if (!customPrefsOrPrefs) return {};
            let raw = customPrefsOrPrefs;
            if (customPrefsOrPrefs.CustomPrefs) {
                raw = customPrefsOrPrefs.CustomPrefs.kefinTweaks;
            } else if (customPrefsOrPrefs.kefinTweaks !== undefined) {
                raw = customPrefsOrPrefs.kefinTweaks;
            }
            if (!raw) return {};
            if (typeof raw === 'object') return { ...raw };
            try {
                const parsed = JSON.parse(raw);
                return parsed && typeof parsed === 'object' ? parsed : {};
            } catch (e) {
                WARN('Failed to parse CustomPrefs.kefinTweaks:', e);
                return {};
            }
        },

        /**
         * Load a single feature blob from CustomPrefs.kefinTweaks.<featureKey>.
         * @param {string} featureKey
         * @param {*} [defaultValue=null]
         * @returns {Promise<*>}
         */
        getKefinTweaksFeature: async function(featureKey, defaultValue = null) {
            if (!featureKey) return defaultValue;
            try {
                const { promise } = await this.getUserDisplayPreferences();
                const prefs = await promise;
                const kefin = this.parseKefinTweaks(prefs);
                return Object.prototype.hasOwnProperty.call(kefin, featureKey)
                    ? kefin[featureKey]
                    : defaultValue;
            } catch (e) {
                WARN(`getKefinTweaksFeature(${featureKey}) failed:`, e);
                return defaultValue;
            }
        },

        /**
         * Replace CustomPrefs.kefinTweaks.<featureKey> while preserving sibling keys.
         * @param {string} featureKey
         * @param {*} value
         * @returns {Promise<boolean>}
         */
        setKefinTweaksFeature: async function(featureKey, value) {
            if (!featureKey) return false;
            try {
                const { promise } = await this.getUserDisplayPreferences();
                const prefs = await promise;
                if (!prefs) return false;
                if (!prefs.CustomPrefs) prefs.CustomPrefs = {};
                const kefin = this.parseKefinTweaks(prefs);
                kefin[featureKey] = value;
                prefs.CustomPrefs.kefinTweaks = JSON.stringify(kefin);
                return await this.updateDisplayPreferences(prefs);
            } catch (e) {
                ERR(`setKefinTweaksFeature(${featureKey}) failed:`, e);
                return false;
            }
        },

        /**
         * Update CustomPrefs.kefinTweaks.<featureKey> via object merge or updater function.
         * @param {string} featureKey
         * @param {object|Function} patchOrFn - Partial object to merge, or (current) => nextValue
         * @returns {Promise<boolean>}
         */
        updateKefinTweaksFeature: async function(featureKey, patchOrFn) {
            if (!featureKey) return false;
            try {
                const { promise } = await this.getUserDisplayPreferences();
                const prefs = await promise;
                if (!prefs) return false;
                if (!prefs.CustomPrefs) prefs.CustomPrefs = {};
                const kefin = this.parseKefinTweaks(prefs);
                const current = Object.prototype.hasOwnProperty.call(kefin, featureKey)
                    ? kefin[featureKey]
                    : null;
                let next;
                if (typeof patchOrFn === 'function') {
                    next = patchOrFn(current);
                } else if (patchOrFn && typeof patchOrFn === 'object' && !Array.isArray(patchOrFn)
                    && current && typeof current === 'object' && !Array.isArray(current)) {
                    next = { ...current, ...patchOrFn };
                } else {
                    next = patchOrFn;
                }
                kefin[featureKey] = next;
                prefs.CustomPrefs.kefinTweaks = JSON.stringify(kefin);
                return await this.updateDisplayPreferences(prefs);
            } catch (e) {
                ERR(`updateKefinTweaksFeature(${featureKey}) failed:`, e);
                return false;
            }
        },

        waitForLogin: waitForLogin
    };

    // TODO -- Update this whenever the user display preferences are updated
    let __userDisplayPreferences = null;
    
    // Expose userHelper to global window object
    window.userHelper = userHelper;
    
    console.log('[KefinTweaks UserHelper] Module loaded and available at window.userHelper');
})();