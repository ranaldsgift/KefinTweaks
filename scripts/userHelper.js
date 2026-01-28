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
     * API Helper functions for Jellyfin operations
     */
    const userHelper = {
        getUserDisplayPreferences: async function() {
            ensureApiClient();

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
                            'X-Emby-Token': ApiClient.accessToken()
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
            const { promise, cached } = await this.getUserDisplayPreferences();
            const userDisplayPreferences = await promise;
            if (!userDisplayPreferences) {
                LOG('No user display preferences found');
                return false;
            }
            return userDisplayPreferences.CustomPrefs?.useEpisodeImagesInNextUpAndResume === 'true';
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
            const serverAddress = ApiClient.serverAddress();
            const accessToken = ApiClient.accessToken();
            const url = `${serverAddress}/DisplayPreferences/usersettings?userId=${userId}&client=emby`;
            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Emby-Token': accessToken
                },
                body: JSON.stringify(prefs)
            });
            return response.ok;
        }
    };

    // TODO -- Update this whenever the user display preferences are updated
    let __userDisplayPreferences = null;
    
    // Expose userHelper to global window object
    window.userHelper = userHelper;
    
    console.log('[KefinTweaks UserHelper] Module loaded and available at window.userHelper');
})();