// KefinTweaks Skin Manager
// Manages skin selection and CSS loading for the display settings page
// Adds a skin dropdown to mypreferencesdisplay.html and handles skin switching
// Requires: utils.js, skinConfig.js modules to be loaded before this script

(function() {
    'use strict';
    
    // Common logging function
    const LOG = (...args) => console.log('[KefinTweaks SkinManager]', ...args);
    const WARN = (...args) => console.warn('[KefinTweaks SkinManager]', ...args);
    const ERR = (...args) => console.error('[KefinTweaks SkinManager]', ...args);
    
    LOG('Initializing...');
    
    // Configuration from user config
    let SKINS_CONFIG = [];
    let THEMES_CONFIG = [];
    const STORAGE_KEY = 'kefinTweaks_selectedSkin';
    const THEME_STORAGE_KEY = 'kefinTweaks_selectedTheme';
    const COLOR_SCHEMES_STORAGE_KEY = 'kefinTweaks_selectedColorScheme';
    
    // Cached server version for synchronous access
    let cachedServerVersion = null;
    let versionPollingStarted = false;

    function getMajorServerVersion(version) {
        const versionParts = version.split('.');
        if (versionParts.length >= 2) {
            const majorVersion = parseInt(versionParts[1], 10);
            if (!isNaN(majorVersion)) {
                return majorVersion;
            }
        }
        return null;
    }
    
    /**
     * Get the current major server version from ApiClient
     * Polls every 500ms for up to 5 seconds in the background if not immediately available
     * @returns {number|null} The major version number (e.g., 10 for "10.10.X", 11 for "10.11.X"), or null if unavailable
     */
    async function getCurrentMajorServerVersion() {
        try {            
            // If we have a cached value, return it
            if (cachedServerVersion !== null) {
                return cachedServerVersion;
            }

            if (!window.ApiClient || !window.ApiClient._appName || !window.ApiClient._appVersion) {
                return null;
            }

            if (window.ApiClient._appName === 'Jellyfin Web' && window.ApiClient._appVersion) {
                cachedServerVersion = getMajorServerVersion(window.ApiClient._appVersion);
                return cachedServerVersion;
            }

            // Check the server version instead of app version
            if (!window.ApiClient._serverVersion) {
                // Wait 10s to see if it becomes ready, check every 500ms
                const startTime = Date.now();
                while (Date.now() - startTime < 10000) {
                    if (window.ApiClient._serverVersion) {
                        break;
                    }
                    await new Promise(resolve => setTimeout(resolve, 500));
                }
            }

            cachedServerVersion = getMajorServerVersion(window.ApiClient._serverVersion);
            return cachedServerVersion;
        } catch (error) {
            WARN('Error getting server version:', error);
            return null;
        }
    }
    
    /**
     * Extract URLs from skin configuration based on current server version
     * Supports both new structure (array of objects) and old structure (string/array of strings)
     * @param {Object} skin - The skin configuration object
     * @returns {Array<string>|null} Array of URLs to load, or null if no URLs
     */
    async function getSkinUrlsForCurrentVersion(skin) {
        if (!skin.url) {
            return null;
        }
        
        const currentMajorVersion = await getCurrentMajorServerVersion();
        
        // New structure: array of objects with majorServerVersions and urls
        if (Array.isArray(skin.url) && skin.url.length > 0 && typeof skin.url[0] === 'object' && skin.url[0].majorServerVersions) {
            // Find all URL objects that match the current server version
            const matchingUrlObjects = skin.url.filter(urlObj => {
                if (!urlObj.majorServerVersions || !Array.isArray(urlObj.majorServerVersions)) {
                    return false;
                }
                return currentMajorVersion !== null && urlObj.majorServerVersions.includes(currentMajorVersion);
            });
            
            if (matchingUrlObjects.length === 0) {
                if (currentMajorVersion !== null) {
                    LOG(`No URL configuration found for skin '${skin.name}' on server version ${currentMajorVersion}`);
                }
                return null;
            }
            
            // Merge all URLs from matching objects
            const allUrls = [];
            matchingUrlObjects.forEach(urlObj => {
                if (Array.isArray(urlObj.urls)) {
                    allUrls.push(...urlObj.urls);
                } else if (urlObj.urls) {
                    allUrls.push(urlObj.urls);
                }
            });
            
            return allUrls.length > 0 ? allUrls : null;
        }
        
        // Old structure: string or array of strings (backward compatibility)
        if (typeof skin.url === 'string') {
            return [skin.url];
        }
        if (Array.isArray(skin.url)) {
            return skin.url;
        }
        
        return null;
    }
    
    /**
     * Filter skins based on the current server version
     * Checks majorServerVersions in the URL structure
     * @param {Array} skins - Array of skin configuration objects
     * @returns {Array} Filtered array of skins compatible with current server version
     */
    async function filterSkinsByServerVersion(skins) {
        const currentMajorVersion = await getCurrentMajorServerVersion();
        
        // If we can't determine the server version, include all skins (backward compatibility)
        if (currentMajorVersion === null) {
            WARN('Could not determine server version, showing all skins');
            return skins;
        }
        
        return skins.filter(skin => {
            // Check if skin has URL configuration
            if (!skin.url) {
                // Skin with no URL (like Default) - check old majorServerVersions field for backward compatibility
                if (skin.majorServerVersions && Array.isArray(skin.majorServerVersions)) {
                    const isSupported = skin.majorServerVersions.includes(currentMajorVersion);
                    if (!isSupported) {
                        LOG(`Skin '${skin.name}' is not supported for server version ${currentMajorVersion} (supports: ${skin.majorServerVersions.join(', ')})`);
                    }
                    return isSupported;
                }
                // No version info, include for backward compatibility
                return true;
            }
            
            // New structure: check majorServerVersions in URL objects
            if (Array.isArray(skin.url) && skin.url.length > 0 && typeof skin.url[0] === 'object' && skin.url[0].majorServerVersions) {
                // Check if any URL object supports the current version
                const hasMatchingVersion = skin.url.some(urlObj => {
                    if (!urlObj.majorServerVersions || !Array.isArray(urlObj.majorServerVersions)) {
                        return false;
                    }
                    return urlObj.majorServerVersions.includes(currentMajorVersion);
                });
                
                if (!hasMatchingVersion) {
                    LOG(`Skin '${skin.name}' is not supported for server version ${currentMajorVersion}`);
                }
                return hasMatchingVersion;
            }
            
            // Old structure: check top-level majorServerVersions field (backward compatibility)
            if (skin.majorServerVersions && Array.isArray(skin.majorServerVersions)) {
                const isSupported = skin.majorServerVersions.includes(currentMajorVersion);
                if (!isSupported) {
                    LOG(`Skin '${skin.name}' is not supported for server version ${currentMajorVersion} (supports: ${skin.majorServerVersions.join(', ')})`);
                }
                return isSupported;
            }
            
            // No version info specified, include for backward compatibility
            LOG(`Skin '${skin.name}' has no version information, including it for backward compatibility`);
            return true;
        });
    }
    
    /**
     * Normalize a single URL string for comparison
     * URLs pointing to /KefinTweaks/skins/{filename}.css are normalized to just the filename
     * This allows matching across different root domains (self-hosted, GitHub, jsdelivr, etc.)
     * @param {string} urlString - URL string to normalize
     * @returns {string} Normalized URL (filename if it's a KefinTweaks skin, otherwise original URL)
     */
    function normalizeSingleUrl(urlString) {
        if (!urlString || typeof urlString !== 'string') {
            return urlString;
        }
        
        // Remove query parameters and fragments for comparison
        let normalized = urlString.split('?')[0].split('#')[0];
        
        // Match pattern: .../KefinTweaks/skins/{filename}.css
        // This works for various formats:
        // - https://ranaldsgift.github.io/KefinTweaks/skins/elegantKefin.css
        // - https://cdn.jsdelivr.net/gh/ranaldsgift/KefinTweaks@main/skins/elegantKefin.css
        // - https://selfhosted.com/KefinTweaks/skins/elegantKefin.css
        const kefinTweaksSkinPattern = /\/KefinTweaks\/skins\/([^\/\?]+\.css)(?:\?.*)?$/i;
        const match = normalized.match(kefinTweaksSkinPattern);
        
        if (match) {
            // Extract just the filename (e.g., "elegantKefin.css")
            return match[1].toLowerCase();
        }
        
        // For other URLs, normalize by removing trailing slashes and normalizing the URL
        // Remove trailing slash
        normalized = normalized.replace(/\/$/, '');
        
        // Return normalized URL (lowercase for case-insensitive comparison)
        return normalized.toLowerCase();
    }
    
    /**
     * Deep compare two skin configurations to check if they are materially identical
     * Compares URLs and colorSchemes, ignoring other properties like enabled/hidden
     * URLs pointing to /KefinTweaks/skins/{filename}.css are normalized to just the filename
     * @param {Object} skin1 - First skin configuration
     * @param {Object} skin2 - Second skin configuration
     * @returns {boolean} True if skins match exactly in URLs and colorSchemes
     */
    function skinsMatchExactly(skin1, skin2) {
        if (!skin1 || !skin2 || skin1.name !== skin2.name) {
            return false;
        }
        
        // Normalize URLs for comparison
        const normalizeUrls = (url) => {
            if (!url) return null;
            // New format: array of objects with majorServerVersions and urls
            if (Array.isArray(url) && url.length > 0 && typeof url[0] === 'object' && url[0].majorServerVersions) {
                // Sort by majorServerVersions for consistent comparison
                const sorted = [...url].sort((a, b) => {
                    const aVersions = Array.isArray(a.majorServerVersions) ? a.majorServerVersions.sort().join(',') : '';
                    const bVersions = Array.isArray(b.majorServerVersions) ? b.majorServerVersions.sort().join(',') : '';
                    return aVersions.localeCompare(bVersions);
                });
                return JSON.stringify(sorted.map(u => ({
                    majorServerVersions: Array.isArray(u.majorServerVersions) ? [...u.majorServerVersions].sort() : u.majorServerVersions,
                    urls: Array.isArray(u.urls) 
                        ? [...u.urls].map(normalizeSingleUrl).sort() 
                        : normalizeSingleUrl(u.urls)
                })));
            }
            // Old format: string or array of strings
            if (typeof url === 'string') {
                return JSON.stringify([normalizeSingleUrl(url)]);
            }
            if (Array.isArray(url)) {
                return JSON.stringify([...url].map(normalizeSingleUrl).sort());
            }
            return JSON.stringify(url);
        };
        
        // Normalize colorSchemes for comparison
        const normalizeColorSchemes = (colorSchemes) => {
            if (!colorSchemes || !Array.isArray(colorSchemes)) return '[]';
            const sorted = [...colorSchemes].sort((a, b) => {
                const aName = (a.name || '').toLowerCase();
                const bName = (b.name || '').toLowerCase();
                return aName.localeCompare(bName);
            });
            return JSON.stringify(sorted.map(cs => {
                let normalizedUrl = cs.url;
                if (normalizedUrl) {
                    // Handle @import url(...) format - extract the URL
                    const importMatch = normalizedUrl.match(/@import\s+url\(["']?([^"']+)["']?\)/i);
                    if (importMatch) {
                        normalizedUrl = importMatch[1];
                    }
                    normalizedUrl = normalizeSingleUrl(normalizedUrl);
                }
                return {
                    name: cs.name,
                    url: normalizedUrl
                };
            }));
        };
        
        const urls1 = normalizeUrls(skin1.url);
        const urls2 = normalizeUrls(skin2.url);
        const schemes1 = normalizeColorSchemes(skin1.colorSchemes);
        const schemes2 = normalizeColorSchemes(skin2.colorSchemes);
        
        return urls1 === urls2 && schemes1 === schemes2;
    }
    
    /**
     * Check if a Jellypane skin contains the old URL from the default config
     * @param {Object} skin - Skin configuration to check
     * @returns {boolean} True if it's Jellypane with the old URL
     */
    function isJellypaneWithOldUrlFormat(skin) {
        if (!skin || skin.name !== 'Jellypane') {
            return false;
        }
        
        if (!skin.url) return false;
        
        const oldJellypaneUrl = 'https://cdn.jsdelivr.net/gh/tedhinklater/Jellypane@main/Jellypane.css';
        
        // Check if the old URL exists in the skin config
        // Handle new format: array of objects with majorServerVersions and urls
        if (Array.isArray(skin.url) && skin.url.length > 0 && typeof skin.url[0] === 'object' && skin.url[0].majorServerVersions) {
            // Check all url objects for the old URL
            for (const urlObj of skin.url) {
                if (Array.isArray(urlObj.urls)) {
                    if (urlObj.urls.includes(oldJellypaneUrl)) {
                        return true;
                    }
                } else if (urlObj.urls === oldJellypaneUrl) {
                    return true;
                }
            }
            return false;
        }
        
        // Handle old format: string or array of strings
        if (typeof skin.url === 'string') {
            return skin.url === oldJellypaneUrl;
        }
        
        if (Array.isArray(skin.url)) {
            return skin.url.includes(oldJellypaneUrl);
        }
        
        return false;
    }

    /**
     * Create a backup of the current KefinTweaksConfig in JS Injector
     * @param {Object} configToBackup - The config object to backup
     * @returns {Promise<boolean>} True if backup was successful
     */
    async function createConfigBackup(configToBackup) {
        try {
            if (!window.ApiClient || !window.ApiClient._serverAddress || !window.ApiClient.accessToken) {
                WARN('ApiClient not available, cannot create backup');
                return false;
            }
            
            const server = window.ApiClient._serverAddress;
            const token = window.ApiClient.accessToken();
            
            // Find JavaScript Injector plugin
            const pluginsResponse = await fetch(`${server}/Plugins`, {
                headers: { 'X-Emby-Token': token }
            });
            
            if (!pluginsResponse.ok) {
                WARN(`Failed to get plugins for backup: ${pluginsResponse.statusText}`);
                return false;
            }
            
            const pluginsData = await pluginsResponse.json();
            const pluginsList = Array.isArray(pluginsData) ? pluginsData : (pluginsData.Items || []);
            const plugin = pluginsList.find(p => p.Name === 'JavaScript Injector' || p.Name === 'JS Injector');
            
            if (!plugin) {
                WARN('JavaScript Injector plugin not found, cannot create backup');
                return false;
            }
            
            const pluginId = plugin.Id;
            
            // Get current injector config
            const configUrl = `${server}/Plugins/${pluginId}/Configuration`;
            const configResponse = await fetch(configUrl, {
                headers: { 'X-Emby-Token': token }
            });
            
            if (!configResponse.ok) {
                WARN(`Failed to get plugin config for backup: ${configResponse.statusText}`);
                return false;
            }
            
            const injectorConfig = await configResponse.json();
            
            // Ensure CustomJavaScripts array exists
            if (!injectorConfig.CustomJavaScripts) {
                injectorConfig.CustomJavaScripts = [];
            }
            
            // Create backup script name with timestamp
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5); // Format: 2024-01-01T12-30-45
            const backupName = `KefinTweaks-Config-[SkinConflictsRemoved-${timestamp}]`;
            
            // Create the backup script content
            const backupScriptContent = `// KefinTweaks Configuration Backup
// This backup was automatically created when skin conflicts were removed
// Created: ${new Date().toISOString()}
// Do not edit manually

window.KefinTweaksConfig = ${JSON.stringify(configToBackup, null, 2)};`;
            
            // Add backup script (disabled by default so it doesn't interfere)
            injectorConfig.CustomJavaScripts.push({
                Name: backupName,
                Script: backupScriptContent,
                Enabled: false, // Disabled so it doesn't interfere with the main config
                RequiresAuthentication: false
            });
            
            // Save the updated configuration with backup
            const saveResponse = await fetch(configUrl, {
                method: 'POST',
                headers: {
                    'X-Emby-Token': token,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(injectorConfig)
            });
            
            if (!saveResponse.ok) {
                WARN(`Failed to save backup: ${saveResponse.statusText}`);
                return false;
            }
            
            LOG(`Created backup: ${backupName}`);
            return true;
        } catch (error) {
            ERR('Error creating config backup:', error);
            return false;
        }
    }

    // Load and merge skin configurations
    async function loadSkinConfig() {
        // Load default skins from skinConfig.js (for merging)
        const defaultSkins = window.KefinTweaksDefaultSkinsConfig?.skins || [];
        
        // Load legacy defaults for duplicate detection (canonical v0.3.5 snapshot)
        const legacyDefaults = window.KefinTweaksLegacySkinDefaults?.skins || [];
        
        // Load admin-configured skins from window.KefinTweaksConfig (from JS Injector)
        let adminSkins = window.KefinTweaksConfig?.skins || [];
        
        // Clean up admin skins: remove exact duplicates of legacy defaults and old Jellypane format
        const cleanedAdminSkins = [];
        const skinsToRemove = new Set();
        
        adminSkins.forEach(adminSkin => {
            // Check for exact match with any legacy default skin (canonical comparison)
            const matchingLegacyDefault = legacyDefaults.find(legacySkin => {
                if (adminSkin.name !== legacySkin.name) {
                    return false;
                }
                const matches = skinsMatchExactly(adminSkin, legacySkin);
                if (!matches) {
                    // Debug: Log why skins with same name don't match
                    LOG(`[Skin Match Debug] Skin '${adminSkin.name}' found in both configs but URLs/colorSchemes differ. Admin: ${JSON.stringify({url: adminSkin.url, colorSchemes: adminSkin.colorSchemes})}, Legacy Default: ${JSON.stringify({url: legacySkin.url, colorSchemes: legacySkin.colorSchemes})}`);
                }
                return matches;
            });
            
            if (matchingLegacyDefault) {
                // Exact match found - remove from admin config
                LOG(`Removing exact duplicate of legacy default skin '${adminSkin.name}' from admin config`);
                skinsToRemove.add(adminSkin.name);
                return; // Skip adding to cleanedAdminSkins
            }
            
            // Special case: Jellypane with old URL format
            if (isJellypaneWithOldUrlFormat(adminSkin)) {
                LOG(`Removing Jellypane with old URL format from admin config`);
                skinsToRemove.add(adminSkin.name);
                return; // Skip adding to cleanedAdminSkins
            }
            
            // Keep this admin skin
            cleanedAdminSkins.push(adminSkin);
        });
        
        // If we removed any skins, create backup and save cleaned config
        if (skinsToRemove.size > 0 && window.KefinTweaksConfig) {
            // Create a deep copy of the original config for backup
            const originalConfig = JSON.parse(JSON.stringify(window.KefinTweaksConfig));
            
            // Create backup before modifying
            const backupCreated = await createConfigBackup(originalConfig);
            if (!backupCreated) {
                WARN('Failed to create backup, but continuing with cleanup');
            }
            
            // Update KefinTweaksConfig with cleaned skins
            window.KefinTweaksConfig.skins = cleanedAdminSkins;
            
            // Save the cleaned config back to JS Injector
            if (window.KefinTweaksUtils && window.KefinTweaksUtils.saveConfigToJavaScriptInjector) {
                const saveSuccess = await window.KefinTweaksUtils.saveConfigToJavaScriptInjector(window.KefinTweaksConfig, { waitForLogin: false });
                if (saveSuccess) {
                    LOG(`Successfully saved cleaned config (removed ${skinsToRemove.size} duplicate/old-format skin(s): ${Array.from(skinsToRemove).join(', ')})`);
                } else {
                    WARN('Failed to save cleaned config to JS Injector');
                }
            } else {
                WARN('KefinTweaksUtils.saveConfigToJavaScriptInjector not available, cannot save cleaned config');
            }
            
            LOG(`Cleaned up ${skinsToRemove.size} duplicate/old-format skin(s) from admin config: ${Array.from(skinsToRemove).join(', ')}`);
        }
        
        adminSkins = cleanedAdminSkins;

        // Merge: Start with defaults, then override/add from admin config
        // Admin config takes precedence for duplicate names
        const mergedSkins = [];
        const adminSkinNames = new Set(adminSkins.map(s => s.name));
        
        // First, add all default skins
        defaultSkins.forEach(skin => {
            mergedSkins.push({ ...skin });
        });
        
        // Then, add/override with admin skins
        adminSkins.forEach(adminSkin => {
            const existingIndex = mergedSkins.findIndex(s => s.name === adminSkin.name);
            if (existingIndex >= 0) {
                // Override existing default skin with admin version
                mergedSkins[existingIndex] = { ...adminSkin };
            } else {
                // Add new admin skin
                mergedSkins.push({ ...adminSkin });
            }
        });

        // Filter to only include enabled skins (enabled !== false)
        // Default to enabled if the property is not set
        SKINS_CONFIG = mergedSkins.filter(skin => {
            // Include skin if enabled is not explicitly false
            // If enabled is undefined/null, treat as enabled (true)
            return skin.enabled !== false;
        });
        
        // Ensure we always have at least a default skin
        if (SKINS_CONFIG.length === 0) {
            SKINS_CONFIG = [
                {
                    name: 'Default',
                    url: null
                }
            ];
        }
        
        // Filter skins based on current server version
        const skinsBeforeFilter = SKINS_CONFIG.length;
        SKINS_CONFIG = await filterSkinsByServerVersion(SKINS_CONFIG);
        const skinsAfterFilter = SKINS_CONFIG.length;
        
        if (skinsBeforeFilter !== skinsAfterFilter) {
            LOG(`Filtered skins by server version: ${skinsBeforeFilter} -> ${skinsAfterFilter} (removed ${skinsBeforeFilter - skinsAfterFilter} incompatible skins)`);
        }
        
        // Expose merged config globally for use by other scripts
        window.KefinTweaksSkinConfig = SKINS_CONFIG;
        
        const enabledCount = mergedSkins.filter(s => s.enabled !== false).length;
        const disabledCount = mergedSkins.length - enabledCount;
        LOG(`Loaded ${SKINS_CONFIG.length} enabled skins (${enabledCount} enabled, ${disabledCount} disabled). Merged config available at window.KefinTweaksSkinConfig`);
    }
    
    /**
     * Get the source information for a skin (default, custom, or overridden)
     * @param {string} skinName - Name of the skin to check
     * @returns {string} 'default', 'custom', or 'overridden'
     */
    function getSkinSourceInfo(skinName) {
        if (!skinName) return 'default';
        
        const defaultSkins = window.KefinTweaksDefaultSkinsConfig?.skins || [];
        const adminSkins = window.KefinTweaksConfig?.skins || [];
        
        const isDefault = defaultSkins.some(s => s.name === skinName);
        const isAdmin = adminSkins.some(s => s.name === skinName);
        
        if (isDefault && isAdmin) {
            return 'overridden';
        } else if (isAdmin) {
            return 'custom';
        } else {
            return 'default';
        }
    }
    
    /**
     * Get source information for all skins in the merged config
     * @returns {Object} Map of skin names to their source ('default', 'custom', or 'overridden')
     */
    function getAllSkinSources() {
        const sourceMap = {};
        const mergedSkins = window.KefinTweaksSkinConfig || SKINS_CONFIG || [];
        
        mergedSkins.forEach(skin => {
            if (skin.name) {
                sourceMap[skin.name] = getSkinSourceInfo(skin.name);
            }
        });
        
        return sourceMap;
    }
    
    // Expose helper functions globally
    window.KefinTweaksSkinManager = window.KefinTweaksSkinManager || {};
    window.KefinTweaksSkinManager.getSkinSourceInfo = getSkinSourceInfo;
    window.KefinTweaksSkinManager.getAllSkinSources = getAllSkinSources;
    
    // Load and merge theme configurations
    async function loadThemeConfig() {
        // Load themes from admin config only (no default themes support for now)
        const adminThemes = window.KefinTweaksConfig?.themes || [];
        
        // Start with admin themes
        THEMES_CONFIG = [...adminThemes];
        
        LOG(`Loaded ${THEMES_CONFIG.length} themes from admin config`);
    }
    
    
    // Track loaded skin CSS URLs
    let loadedSkinUrls = new Set();
    
    // Track loaded optional includes CSS URLs
    let loadedOptionalIncludesUrls = new Set();
    
    // Storage key for user config
    const USER_CONFIG_STORAGE_KEY = 'kefinTweaksUserConfig';
    
    /**
     * Extract filename from a URL
     * @param {string} url - The URL to extract filename from
     * @returns {string} The filename (e.g., "custom-media-covers-latest-min.css")
     */
    function extractFilenameFromUrl(url) {
        if (!url) return '';
        
        try {
            // Remove query parameters and fragments
            const urlWithoutParams = url.split('?')[0].split('#')[0];
            
            // Extract the last path segment
            const pathParts = urlWithoutParams.split('/');
            const filename = pathParts[pathParts.length - 1];
            
            return filename || '';
        } catch (e) {
            ERR('Error extracting filename from URL:', e);
            return '';
        }
    }
    
    /**
     * Normalize skin name for use in keys (replace spaces with underscores)
     * @param {string} skinName - The skin name
     * @returns {string} Normalized skin name
     */
    function normalizeSkinNameForKey(skinName) {
        if (!skinName) return '';
        return skinName.replace(/\s+/g, '_');
    }
    
    /**
     * Generate a key for an optional include
     * Format: [skin_name]-[author]-[css-filename]
     * @param {string} skinName - The skin name (or "global" for global includes)
     * @param {string} author - The author name
     * @param {string} url - The URL to extract filename from
     * @returns {string} The generated key
     */
    function generateOptionalIncludeKey(skinName, author, url) {
        const normalizedSkinName = skinName === 'global' ? 'global' : normalizeSkinNameForKey(skinName);
        const filename = extractFilenameFromUrl(url);
        const normalizedAuthor = (author || '').replace(/\s+/g, '_');
        
        return `${normalizedSkinName}-${normalizedAuthor}-${filename}`;
    }
    
    /**
     * Get the user config from localStorage
     * @returns {Object} User config object with optionalIncludes array of { key, enabled } objects
     */
    function getUserConfig() {
        try {
            const saved = localStorage.getItem(USER_CONFIG_STORAGE_KEY);
            if (saved) {
                const parsed = JSON.parse(saved);
                // Migrate old format (array of keys) to new format (array of objects)
                if (parsed.optionalIncludes && parsed.optionalIncludes.length > 0) {
                    const firstItem = parsed.optionalIncludes[0];
                    if (typeof firstItem === 'string') {
                        // Old format: array of keys (all enabled)
                        parsed.optionalIncludes = parsed.optionalIncludes.map(key => ({ key, enabled: true }));
                    }
                }
                return parsed;
            }
        } catch (e) {
            ERR('Error parsing user config:', e);
        }
        return { optionalIncludes: [] };
    }
    
    /**
     * Save the user config to localStorage
     * @param {Object} userConfig - User config object
     */
    function saveUserConfig(userConfig) {
        try {
            localStorage.setItem(USER_CONFIG_STORAGE_KEY, JSON.stringify(userConfig));
        } catch (e) {
            ERR('Error saving user config:', e);
        }
    }
    
    /**
     * Check if an optional include is enabled based on precedence:
     * 1. User localStorage config (highest priority) - objects with { key, enabled }
     * 2. Admin config (KefinTweaksConfig.optionalIncludes) - objects with { key, enabled }
     * 3. Default config (lowest priority) - defaultEnabled parameter
     * @param {string} key - The optional include key
     * @param {boolean} defaultEnabled - Default enabled state from config
     * @returns {boolean} Whether the include is enabled
     */
    function isOptionalIncludeEnabled(key, defaultEnabled = false) {
        // Check user localStorage first (highest priority)
        const userConfig = getUserConfig();
        const userOptionalIncludes = userConfig.optionalIncludes || [];
        
        // Check if user has explicitly set this key
        const userEntry = userOptionalIncludes.find(entry => {
            if (typeof entry === 'string') {
                // Legacy format: just a key (enabled)
                return entry === key;
            }
            if (typeof entry === 'object' && entry.key) {
                return entry.key === key;
            }
            return false;
        });
        
        if (userEntry !== undefined) {
            // User has explicitly configured this key
            if (typeof userEntry === 'string') {
                return true; // Legacy format: key string means enabled
            }
            return userEntry.enabled === true;
        }
        
        // User hasn't configured this key, check admin config
        const adminOptionalIncludes = window.KefinTweaksConfig?.optionalIncludes || [];
        
        if (Array.isArray(adminOptionalIncludes) && adminOptionalIncludes.length > 0) {
            // Check if admin has configured this key
            const adminEntry = adminOptionalIncludes.find(entry => {
                if (typeof entry === 'string') {
                    // Legacy format: just a key (enabled)
                    return entry === key;
                }
                if (typeof entry === 'object' && entry.key) {
                    return entry.key === key;
                }
                return false;
            });
            
            if (adminEntry !== undefined) {
                // Admin has configured this key
                if (typeof adminEntry === 'string') {
                    return true; // Legacy format: key string means enabled
                }
                return adminEntry.enabled === true;
            }
        }
        
        // Neither user nor admin has configured this key, fall back to default
        return defaultEnabled;
    }
    
    /**
     * Get enabled optional includes for a skin from user config
     * @param {string} skinName - The skin name (or "global" for global includes)
     * @param {Array} defaultOptionalIncludes - Default optional includes from skin config
     * @returns {Array} Array of enabled optional includes with their enabled state
     */
    function getOptionalIncludesEnabledState(skinName, defaultOptionalIncludes = []) {
        if (!skinName || !defaultOptionalIncludes || defaultOptionalIncludes.length === 0) {
            return [];
        }
        
        // Map default optional includes to enabled state based on key-based checks
        return defaultOptionalIncludes.map(include => {
            const author = extractAuthorFromUrl(include.url);
            const key = generateOptionalIncludeKey(skinName, author, include.url);
            const enabled = isOptionalIncludeEnabled(key, include.enabled || false);
            
            return {
                ...include,
                enabled: enabled,
                key: key // Store key for later use
            };
        });
    }
    
    /**
     * Save a single optional include state to user config
     * Only saves the specific key that was toggled, maintaining existing entries
     * @param {string} key - The optional include key
     * @param {boolean} enabled - Whether the include is enabled
     */
    function saveOptionalIncludeState(key, enabled) {
        if (!key) {
            return;
        }
        
        const userConfig = getUserConfig();
        const currentEntries = userConfig.optionalIncludes || [];
        
        // Find existing entry for this key
        const existingIndex = currentEntries.findIndex(entry => {
            const entryKey = typeof entry === 'string' ? entry : entry.key;
            return entryKey === key;
        });
        
        if (existingIndex >= 0) {
            // Update existing entry
            if (typeof currentEntries[existingIndex] === 'string') {
                // Legacy format: replace with object
                currentEntries[existingIndex] = { key: key, enabled: enabled };
            } else {
                // Update enabled state
                currentEntries[existingIndex].enabled = enabled;
            }
        } else {
            // Add new entry
            currentEntries.push({ key: key, enabled: enabled });
        }
        
        // Update user config
        userConfig.optionalIncludes = currentEntries;
        
        // Save updated config
        saveUserConfig(userConfig);
    }
    
    /**
     * Save enabled optional includes state to user config (legacy function for bulk updates)
     * @param {string} skinName - The skin name (or "global" for global includes)
     * @param {Array} optionalIncludes - Array of optional includes with enabled state
     * @deprecated Use saveOptionalIncludeState for individual updates
     */
    function saveOptionalIncludesEnabledState(skinName, optionalIncludes) {
        if (!skinName || !optionalIncludes) {
            return;
        }
        
        const userConfig = getUserConfig();
        
        // Get array of optional include entries with { key, enabled }
        const entries = optionalIncludes.map(include => {
            // Use stored key if available, otherwise generate it
            const key = include.key || (() => {
                const author = extractAuthorFromUrl(include.url);
                return generateOptionalIncludeKey(skinName, author, include.url);
            })();
            
            return {
                key: key,
                enabled: include.enabled === true
            };
        });
        
        // Get all current entries (from other skins/global)
        const currentEntries = userConfig.optionalIncludes || [];
        
        // Remove entries for this skin/global (to replace with new ones)
        const prefix = skinName === 'global' ? 'global-' : `${normalizeSkinNameForKey(skinName)}-`;
        const otherEntries = currentEntries.filter(entry => {
            const entryKey = typeof entry === 'string' ? entry : entry.key;
            return !entryKey.startsWith(prefix);
        });
        
        // Combine other entries with new entries
        const allEntries = [...otherEntries, ...entries];
        
        // Update user config
        userConfig.optionalIncludes = allEntries;
        
        // Save updated config
        saveUserConfig(userConfig);
    }
    
    /**
     * Get merged global optional includes
     * Merges default global includes with admin configuration
     * @returns {Array} Array of optional include objects
     */
    function getMergedGlobalOptionalIncludes() {
        // Get default global optional includes from skinConfig.js
        // We only support toggling existing defaults defined in skinConfig.js
        // User/Admin enabled states are applied via isOptionalIncludeEnabled()
        return (window.KefinTweaksDefaultSkinsConfig?.globalOptionalIncludes || []).map(include => ({ ...include }));
    }
    
    /**
     * Load optional includes CSS for a skin based on userConfig
     * Includes both global and skin-specific optional includes
     * @param {Object} skin - The skin configuration object
     */
    function loadOptionalIncludes(skin) {
        if (!skin) {
            return;
        }
        
        // Get merged global optional includes
        const globalOptionalIncludes = getMergedGlobalOptionalIncludes();
        
        // Load enabled global optional includes
        // This explicitly checks user localStorage config first via isOptionalIncludeEnabled
        globalOptionalIncludes.forEach(include => {
            const author = extractAuthorFromUrl(include.url);
            const key = generateOptionalIncludeKey('global', author, include.url);
            
            // Check enabled state (User Config > Admin Config > Default)
            const isEnabled = isOptionalIncludeEnabled(key, include.enabled || false);
            
            if (isEnabled && include.url) {
                loadOptionalIncludeCSS(include.url, 'global');
            }
        });
        
        // Load enabled skin-specific optional includes
        if (skin.optionalIncludes && skin.optionalIncludes.length > 0) {
            skin.optionalIncludes.forEach(include => {
                const author = extractAuthorFromUrl(include.url);
                const key = generateOptionalIncludeKey(skin.name, author, include.url);
                
                // Check enabled state (User Config > Admin Config > Default)
                const isEnabled = isOptionalIncludeEnabled(key, include.enabled || false);
                
                if (isEnabled && include.url) {
                    loadOptionalIncludeCSS(include.url, skin.name);
                }
            });
        }
    }
    
    /**
     * Unload all optional includes CSS for a specific skin
     * @param {string} skinName - The skin name to unload includes for (or 'global' for global includes)
     */
    function unloadOptionalIncludesForSkin(skinName) {
        const optionalIncludeLinks = document.querySelectorAll('link[data-kefin-optional-include="true"]');
        optionalIncludeLinks.forEach(link => {
            if (link.getAttribute('data-skin') === skinName) {
                if (link.parentNode) {
                    link.parentNode.removeChild(link);
                }
                const url = link.href;
                loadedOptionalIncludesUrls.delete(url);
            }
        });
    }
    
    /**
     * Unload all optional includes CSS (both global and skin-specific)
     */
    function unloadAllOptionalIncludes() {
        const optionalIncludeLinks = document.querySelectorAll('link[data-kefin-optional-include="true"]');
        optionalIncludeLinks.forEach(link => {
            if (link.parentNode) {
                link.parentNode.removeChild(link);
            }
            const url = link.href;
            loadedOptionalIncludesUrls.delete(url);
        });
    }
    
    /**
     * Load CSS for an optional include
     * @param {string} url - The CSS URL
     * @param {string} skinName - The skin name
     */
    function loadOptionalIncludeCSS(url, skinName) {
        // Check if this CSS is already loaded
        if (loadedOptionalIncludesUrls.has(url)) {
            LOG(`Optional include CSS already loaded: ${url}`);
            return;
        }

        if (!url || url === '') {
            LOG(`Invalid optional include CSS URL: ${url}, skipping`);
            return;
        }
        
        const link = document.createElement('link');
        link.id = `cssOptionalInclude-${Date.now()}-${Math.random()}`;
        link.rel = 'stylesheet';
        link.type = 'text/css';
        link.href = url;
        link.setAttribute('data-kefin-optional-include', 'true');
        link.setAttribute('data-skin', skinName);
        
        // Insert after the last skin link
        const skinLinks = document.querySelectorAll('link[data-kefin-skin="true"]');
        let insertAfter = null;
        
        if (skinLinks.length > 0) {
            insertAfter = skinLinks[skinLinks.length - 1];
        } else {
            insertAfter = document.getElementById('cssTheme');
        }
        
        if (insertAfter && insertAfter.parentNode) {
            insertAfter.parentNode.insertBefore(link, insertAfter.nextSibling);
        } else {
            document.head.appendChild(link);
        }
        
        loadedOptionalIncludesUrls.add(url);
        LOG(`Loaded optional include CSS: ${url}`);
    }
    
    // Tooltip management
    let currentTooltip = null;
    
    // Store unregister functions for handlers
    let unregisterDisplayPreferencesHandler = null;
    let unregisterAnyPageHandler = null;
    
    /**
     * Create and show a tooltip
     * @param {string} text - The tooltip text
     * @param {Element} target - The target element to position the tooltip near
     */
    function showTooltip(text, target) {
        // Remove existing tooltip
        hideTooltip();
        
        // Create tooltip element
        currentTooltip = document.createElement('div');
        currentTooltip.className = 'kefin-tooltip';
        currentTooltip.textContent = text;
        
        // Add tooltip styles
        currentTooltip.style.cssText = `
            position: absolute;
            background: rgba(0, 0, 0, 0.9);
            color: white;
            padding: 8px 12px;
            border-radius: 6px;
            font-size: 12px;
            font-family: inherit;
            z-index: 10000;
            pointer-events: none;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
            max-width: 200px;
            word-wrap: break-word;
            opacity: 0;
            transition: opacity 0.2s ease;
        `;
        
        // Add to document
        document.body.appendChild(currentTooltip);
        
        // Position tooltip
        positionTooltip(target);
        
        // Fade in
        setTimeout(() => {
            if (currentTooltip) {
                currentTooltip.style.opacity = '1';
            }
        }, 10);
    }
    
    /**
     * Position the tooltip relative to the target element
     * @param {Element} target - The target element
     */
    function positionTooltip(target) {
        if (!currentTooltip || !target) return;
        
        const rect = target.getBoundingClientRect();
        const tooltipRect = currentTooltip.getBoundingClientRect();
        
        // Position above the target element
        let left = rect.left + (rect.width / 2) - (tooltipRect.width / 2);
        let top = rect.top - tooltipRect.height - 8;
        
        // Adjust if tooltip would go off screen
        if (left < 8) {
            left = 8;
        } else if (left + tooltipRect.width > window.innerWidth - 8) {
            left = window.innerWidth - tooltipRect.width - 8;
        }
        
        if (top < 8) {
            // Position below if no room above
            top = rect.bottom + 8;
        }
        
        currentTooltip.style.left = `${left}px`;
        currentTooltip.style.top = `${top}px`;
    }
    
    /**
     * Hide and remove the current tooltip
     */
    function hideTooltip() {
        if (currentTooltip) {
            currentTooltip.style.opacity = '0';
            setTimeout(() => {
                if (currentTooltip && currentTooltip.parentNode) {
                    currentTooltip.parentNode.removeChild(currentTooltip);
                }
                currentTooltip = null;
            }, 200);
        }
    }
    
    /**
     * Verify that the current skin/scheme/theme is properly applied
     * @returns {boolean} True if verification passes, false otherwise
     */
    function verifySkinApplication() {
        const selectedSkinName = localStorage.getItem(STORAGE_KEY) || getDefaultSkinName();
        const selectedSkin = SKINS_CONFIG.find(skin => skin.name === selectedSkinName);
        
        if (!selectedSkin) {
            ERR('Selected skin not found, reverting to default skin');
            const defaultSkinName = getDefaultSkinName();
            const defaultSkin = SKINS_CONFIG.find(skin => skin.name === defaultSkinName);
            if (defaultSkin) {
                loadSkin(defaultSkin);
            }
            return true;
        }
        
        // Check if skin CSS is properly loaded
        if (selectedSkin.url) {
            const skinLinks = document.querySelectorAll('link[data-kefin-skin="true"]');
            const hasCorrectSkin = Array.from(skinLinks).some(link => 
                link.getAttribute('data-skin') === selectedSkinName
            );
            
            if (!hasCorrectSkin) {
                WARN(`Skin verification failed: Expected skin '${selectedSkinName}' not found in DOM`);
                return false;
            }
        }
        
        // Check if theme is properly applied
        const selectedThemeValue = localStorage.getItem(THEME_STORAGE_KEY);
        if (selectedThemeValue) {
            const selectedTheme = THEMES_CONFIG.find(theme => theme.name === selectedThemeValue);
            if (selectedTheme) {
                const cssThemeLink = document.getElementById('cssTheme');
                if (!cssThemeLink || !cssThemeLink.hasAttribute('data-kefin-custom-theme')) {
                    WARN(`Theme verification failed: Custom theme '${selectedThemeValue}' not properly applied`);
                    return false;
                }
            }
        }
        
        // Check if color scheme is properly applied
        const selectedColorSchemeName = localStorage.getItem(COLOR_SCHEMES_STORAGE_KEY);
        if (selectedColorSchemeName && selectedSkin.colorSchemes) {
            const selectedColorScheme = selectedSkin.colorSchemes.find(scheme => scheme.name === selectedColorSchemeName);
            if (selectedColorScheme && selectedColorScheme.url) {
                const cssColorSchemesLink = document.getElementById('cssColorSchemes');
                if (!cssColorSchemesLink || !cssColorSchemesLink.hasAttribute('data-kefin-color-schemes')) {
                    WARN(`Color scheme verification failed: Color scheme '${selectedColorSchemeName}' not properly applied`);
                    return false;
                }
            }
        }
        
        LOG('Skin application verification passed');
        return true;
    }
    
    /**
     * Initialize the skin manager with verification and retry logic
     */
    function initialize(retryCount = 0) {
        const MAX_RETRIES = 10;
        
        if (!window.KefinTweaksUtils) {
            ERR('KefinTweaksUtils not available - skin manager cannot initialize');
            return;
        }
        
        // Load and merge skin configurations
        loadSkinConfig();
        
        // Load and merge theme configurations
        loadThemeConfig();

        loadSelectedSkin();
        loadSelectedTheme();
        loadSelectedColorScheme();
        
        LOG('SkinManager initializing...');
        
        // Verify skin application after a short delay to allow CSS to load
        setTimeout(() => {
            if (!verifySkinApplication()) {
                if (retryCount < MAX_RETRIES) {
                    WARN(`Skin application verification failed, retrying... (attempt ${retryCount + 1}/${MAX_RETRIES})`);
                    setTimeout(() => {
                        initialize(retryCount + 1);
                    }, 500); // Wait 500ms before retry
                } else {
                    ERR(`Skin application verification failed after ${MAX_RETRIES} attempts - giving up`);
                    // Register handlers even if verification failed (give up case)
                    registerHandlers();
                }
            } else {
                LOG('Skin application verified successfully');
                // Register handlers after successful verification
                registerHandlers();
            }
        }, 200); // Wait 200ms for CSS to load before verification
    }
    
    /**
     * Register the onViewPage handlers
     */
    function registerHandlers() {
        // Only register if not already registered
        if (unregisterDisplayPreferencesHandler) {
            LOG('Handlers already registered, skipping');
            return;
        }
        
        // Register for the display preferences page
        unregisterDisplayPreferencesHandler = window.KefinTweaksUtils.onViewPage(handleDisplayPreferencesPage, {
            pages: ['mypreferencesdisplay']
        });
        
        // Register for all pages to add the appearance button
        unregisterAnyPageHandler = window.KefinTweaksUtils.onViewPage(handleAnyPage, {
            pages: []
        });
        
        LOG('SkinManager handlers registered');
    }
    
    /**
     * Handle the display preferences page
     * @param {string} view - The view name
     * @param {Element} element - The view element
     */
    function handleDisplayPreferencesPage(view, element) {
        LOG('Display preferences page detected');
        
        // Wait for the page to be fully loaded
        setTimeout(() => {
            addSkinDropdown();
            loadSelectedSkin();
            addColorSchemesDropdown();
            loadSelectedColorScheme();
            addThemeOptions();
            loadSelectedTheme();
        }, 100);
    }
    
    /**
     * Handle any page to add the appearance button
     * @param {string} view - The view name
     * @param {Element} element - The view element
     */
    function handleAnyPage(view, element) {
        // Skip the display preferences page as it's handled separately
        if (view === 'mypreferencesdisplay') {
            return;
        }
        
        // Wait for the page to be fully loaded
        setTimeout(() => {
            addAppearanceButton();
        }, 100);
    }
    
    /**
     * Add the appearance button to the header
     */
    function addAppearanceButton() {
        const headerRight = document.querySelector('.headerRight');
        if (!headerRight) {
            WARN('Header right section not found');
            return;
        }
        
        // Check if appearance button already exists
        if (headerRight.querySelector('.headerAppearanceButton')) {
            LOG('Appearance button already exists');
            return;
        }
        
        // Create the appearance button
        const appearanceButton = document.createElement('button');
        appearanceButton.type = 'button';
        appearanceButton.setAttribute('is', 'paper-icon-button-light');
        appearanceButton.className = 'headerButton headerButtonRight headerAppearanceButton paper-icon-button-light';
        appearanceButton.title = 'Appearance';
        
        // Create the icon span
        const iconSpan = document.createElement('span');
        iconSpan.className = 'material-icons palette';
        iconSpan.setAttribute('aria-hidden', 'true');
        
        appearanceButton.appendChild(iconSpan);
        
        // Add click event listener
        appearanceButton.addEventListener('click', toggleAppearancePopover);
        
        // Insert before the search button (or at the end if no search button)
        const searchButton = headerRight.querySelector('.headerSearchButton');
        if (searchButton) {
            headerRight.insertBefore(appearanceButton, searchButton);
        } else {
            headerRight.appendChild(appearanceButton);
        }
        
        LOG('Appearance button added successfully');
        
        // Unregister the handleAnyPage handler since button is now added and persistent
        if (unregisterAnyPageHandler) {
            unregisterAnyPageHandler();
            unregisterAnyPageHandler = null;
            LOG('Unregistered handleAnyPage handler - button is now persistent');
        }
    }
    
    /**
     * Toggle the appearance popover
     */
    function toggleAppearancePopover(event) {
        event.preventDefault();
        event.stopPropagation();
        
        // Remove existing popover if it exists
        const existingPopover = document.querySelector('.kefin-appearance-popover');
        if (existingPopover) {
            existingPopover.remove();
            return;
        }
        
        // Create the popover
        createAppearancePopover(event.target);
    }
    
    /**
     * Create the appearance popover with skin and color scheme dropdowns
     * @param {Element} button - The button that triggered the popover
     */
    function createAppearancePopover(button) {
        // Create backdrop
        const backdrop = document.createElement('div');
        backdrop.className = 'dialogBackdrop dialogBackdropOpened';
        backdrop.setAttribute('data-modal-id', 'appearance-popover');
        backdrop.style.position = 'fixed';
        backdrop.style.top = '0';
        backdrop.style.left = '0';
        backdrop.style.width = '100%';
        backdrop.style.height = '100%';
        backdrop.style.zIndex = '9999';
        backdrop.style.backgroundColor = 'transparent';
        
        // Create dialog container
        const dialogContainer = document.createElement('div');
        dialogContainer.className = 'dialogContainer';
        dialogContainer.setAttribute('data-modal-id', 'appearance-popover');
        dialogContainer.style.position = 'fixed';
        dialogContainer.style.top = '0';
        dialogContainer.style.left = '0';
        dialogContainer.style.width = '100%';
        dialogContainer.style.height = '100%';
        dialogContainer.style.zIndex = '10000';
        dialogContainer.style.pointerEvents = 'none';
        
        // Create dialog (popover)
        const dialog = document.createElement('div');
        dialog.className = 'focuscontainer dialog smoothScrollY ui-body-a background-theme-a formDialog';
        dialog.style.position = 'absolute';
        dialog.style.minWidth = '280px';
        dialog.style.pointerEvents = 'auto';
        dialog.style.animation = '160ms ease-out 0s 1 normal both running scaleup';
        
        // Create dialog content
        const dialogContent = document.createElement('div');
        dialogContent.style.margin = '0';
        dialogContent.style.padding = '1.25em 1.5em 1.5em';
        dialogContent.style.display = 'flex';
        dialogContent.style.flexDirection = 'column';
        dialogContent.style.gap = '0.8em';
        
        // Create skin dropdown
        const skinContainer = createDropdown({
            label: 'Skin',
            id: 'selectSkinPopover',
            options: SKINS_CONFIG.map(skin => ({
                value: skin.name,
                text: skin.name,
                author: skin.author
            })),
            changeHandler: handleSkinChange,
            isPopover: true
        });
        dialogContent.appendChild(skinContainer);
        
        // Create color schemes dropdown
        const colorSchemesContainer = createDropdown({
            label: 'Color Schemes',
            id: 'selectColorSchemesPopover',
            options: [], // Will be populated by updatePopoverColorSchemes
            changeHandler: handleColorSchemeChange,
            isPopover: true
        });
        dialogContent.appendChild(colorSchemesContainer);
        
        // Assemble dialog
        dialog.appendChild(dialogContent);
        dialogContainer.appendChild(dialog);
        
        // Position the popover
        positionPopover(dialog, button);
        
        // Add to document
        document.body.appendChild(backdrop);
        document.body.appendChild(dialogContainer);
        
        // Set current values from localStorage
        const skinSelect = document.getElementById('selectSkinPopover');
        const colorSchemesSelect = document.getElementById('selectColorSchemesPopover');
        
        if (skinSelect) {
            const currentSkin = localStorage.getItem(STORAGE_KEY) || getDefaultSkinName();
            skinSelect.value = currentSkin;
        }
        
        // Update color schemes dropdown based on current skin
        updatePopoverColorSchemes();
        updateSkinAuthorLabel();
        
        // Add click outside to close
        setTimeout(() => {
            document.addEventListener('click', handlePopoverClickOutside);
        }, 10);
        
        LOG('Appearance popover created with Jellyfin styling');
    }
    
    /**
     * Create a generic dropdown with Jellyfin styling
     * @param {Object} config - Configuration object
     * @param {string} config.label - The dropdown label
     * @param {string} config.id - The dropdown ID
     * @param {Array} config.options - The dropdown options
     * @param {Function} config.changeHandler - The change event handler
     * @param {boolean} config.isPopover - Whether this is for a popover (affects styling)
     * @param {Function} config.hoverHandler - Optional hover handler for tooltips
     * @param {Function} config.focusHandler - Optional focus handler for tooltips
     * @param {Function} config.blurHandler - Optional blur handler for tooltips
     * @returns {Element} The dropdown container
     */
    function createDropdown(config) {
        const {
            label,
            id,
            options = [],
            changeHandler,
            isPopover = false,
            hoverHandler,
            focusHandler,
            blurHandler
        } = config;
        
        const container = document.createElement('div');
        
        // Create label
        const labelElement = document.createElement('label');
        if (isPopover) {
            labelElement.style.cssText = `
                display: block;
                margin-bottom: 8px;
                font-size: 14px;
                color: var(--main-color, var(--accent, #fff));
            `;
        } else {
            labelElement.className = 'selectLabel';
        }
        labelElement.textContent = label;
        labelElement.setAttribute('for', id);
        container.appendChild(labelElement);
        
        // Create select container with Jellyfin styling
        const selectContainer = document.createElement('div');
        selectContainer.className = 'selectContainer';
        if (isPopover) {
            selectContainer.style.marginBottom = '0px';
        }
        
        // Create select
        const select = document.createElement('select');
        select.id = id;
        select.setAttribute('is', 'emby-select');
        select.setAttribute('label', label);
        select.className = 'emby-select-withcolor emby-select';
        
        // Add options
        options.forEach(option => {
            const optionElement = document.createElement('option');
            optionElement.value = option.value;
            optionElement.textContent = option.text;
            if (option.author) {
                optionElement.setAttribute('data-author', option.author);
            }
            if (option.url) {
                optionElement.setAttribute('data-scheme-url', option.url);
            }
            select.appendChild(optionElement);
        });
        
        // Create the arrow container
        const arrowContainer = document.createElement('div');
        arrowContainer.className = 'selectArrowContainer';
        
        const hiddenDiv = document.createElement('div');
        hiddenDiv.style.visibility = 'hidden';
        hiddenDiv.style.display = 'none';
        hiddenDiv.textContent = '0';
        
        const arrow = document.createElement('span');
        arrow.className = 'selectArrow material-icons keyboard_arrow_down';
        arrow.setAttribute('aria-hidden', 'true');
        arrow.style.marginTop = '.2em';
        
        arrowContainer.appendChild(hiddenDiv);
        arrowContainer.appendChild(arrow);
        
        // Assemble the select container
        selectContainer.appendChild(select);
        selectContainer.appendChild(arrowContainer);
        
        // Add event handlers
        if (changeHandler) {
            select.addEventListener('change', changeHandler);
        }
        if (hoverHandler) {
            select.addEventListener('mouseover', hoverHandler);
            select.addEventListener('mouseout', hideTooltip);
        }
        if (focusHandler) {
            select.addEventListener('focus', focusHandler);
            select.addEventListener('blur', blurHandler || hideTooltip);
        }
        
        container.appendChild(selectContainer);
        return container;
    }
    
    /**
     * Create a dropdown for the popover (wrapper for createDropdown)
     * @param {string} label - The dropdown label
     * @param {string} id - The dropdown ID
     * @param {Array} options - The dropdown options
     * @param {Function} changeHandler - The change event handler
     * @returns {Element} The dropdown container
     */
    function createPopoverDropdown(label, id, options, changeHandler) {
        return createDropdown({
            label,
            id,
            options,
            changeHandler,
            isPopover: true
        });
    }
    
    /**
     * Handle skin change (unified for both popover and display page)
     * @param {Event} event - The change event
     */
    function handleSkinChange(event) {
        const selectedSkinName = event.target.value;
        const selectedSkin = SKINS_CONFIG.find(skin => skin.name === selectedSkinName);
        
        if (!selectedSkin) {
            ERR('Selected skin not found in configuration');
            return;
        }
        
        LOG(`Skin changed to: ${selectedSkin.name}`);
        
        // Save skin selection to localStorage
        localStorage.setItem(STORAGE_KEY, selectedSkinName);
        
        // Load the new skin
        loadSkin(selectedSkin);
        
        // Set default color scheme for the new skin
        const defaultColorScheme = getDefaultColorScheme(selectedSkin);
        if (defaultColorScheme) {
            localStorage.setItem(COLOR_SCHEMES_STORAGE_KEY, defaultColorScheme);
            syncAllColorSchemeDropdowns();
            
            // Load the default color scheme
            const defaultScheme = selectedSkin.colorSchemes.find(scheme => scheme.name === defaultColorScheme);
            if (defaultScheme) {
                updateColorSchemesCSS(defaultScheme.url);
            }
        } else {
            localStorage.removeItem(COLOR_SCHEMES_STORAGE_KEY);
            syncAllColorSchemeDropdowns();
            updateColorSchemesCSS(null);
        }
        
        // Update author display in popover if it exists
        updateSkinAuthorLabel();
        
        // Update author display in display preferences if it exists
        updateDisplayPreferencesSkinLabel();
    }
    
    /**
     * Update the author info section in the display preferences page
     */
    function updateDisplayPreferencesSkinLabel() {
        const labelElement = document.querySelector('label[for="selectSkin"]');
        if (!labelElement) {
            return;
        }
        
        const skinSelect = document.getElementById('selectSkin');
        const selectedSkinName = skinSelect?.value || localStorage.getItem(STORAGE_KEY) || getDefaultSkinName();
        const selectedSkin = SKINS_CONFIG.find(skin => skin.name === selectedSkinName);
        
        // Find existing gear icon and remove it
        const existingGear = labelElement.querySelector('.material-icons[data-optional-includes-gear]');
        if (existingGear) {
            existingGear.remove();
        }
        
        // Add gear icon for all skins (global optional includes apply to all)
        if (selectedSkin) {
            const gearIcon = document.createElement('span');
            gearIcon.className = 'material-icons';
            gearIcon.setAttribute('data-optional-includes-gear', 'true');
            gearIcon.textContent = 'settings';
            gearIcon.style.cssText = 'font-size: 1em; margin-left: 0.5em; cursor: pointer; opacity: 0.7; transition: opacity 0.2s; vertical-align: middle;';
            gearIcon.title = 'Configure additional skin options';
            gearIcon.addEventListener('mouseenter', () => {
                gearIcon.style.opacity = '1';
            });
            gearIcon.addEventListener('mouseleave', () => {
                gearIcon.style.opacity = '0.7';
            });
            gearIcon.addEventListener('click', (e) => {
                e.stopPropagation();
                openOptionalIncludesModal(selectedSkin);
            });
            labelElement.appendChild(gearIcon);
        }
    }
    
    /**
     * Handle color scheme change (unified for both popover and display page)
     * @param {Event} event - The change event
     */
    function handleColorSchemeChange(event) {
        const selectedColorSchemeName = event.target.value;
        const selectedOption = event.target.selectedOptions[0];
        
        LOG(`Color scheme changed to: ${selectedColorSchemeName}`);
        
        // Save color scheme selection to localStorage
        localStorage.setItem(COLOR_SCHEMES_STORAGE_KEY, selectedColorSchemeName);
        
        const schemeUrl = selectedOption.getAttribute('data-scheme-url');
        updateColorSchemesCSS(schemeUrl);
    }
    
    /**
     * Update the color schemes dropdown in the popover
     */
    function updatePopoverColorSchemes() {
        const colorSchemesSelect = document.getElementById('selectColorSchemesPopover');
        if (!colorSchemesSelect) return;
        
        const selectedSkinName = localStorage.getItem(STORAGE_KEY) || getDefaultSkinName();
        const selectedSkin = SKINS_CONFIG.find(skin => skin.name === selectedSkinName);
        
        // Get the color schemes container to show/hide it
        // We need to go up to the container that holds both label and select
        const selectContainer = colorSchemesSelect.closest('.selectContainer');
        const colorSchemesContainer = selectContainer ? selectContainer.parentNode : colorSchemesSelect.closest('div');
        
        // Clear existing options
        const options = colorSchemesSelect.querySelectorAll('option');
        options.forEach(option => {
            option.remove();
        });
        
        // Show/hide color schemes dropdown based on whether skin has color schemes
        if (selectedSkin && selectedSkin.colorSchemes && selectedSkin.colorSchemes.length > 0) {
            // Show the container
            colorSchemesContainer.style.display = '';
            
            // Add color scheme options
            selectedSkin.colorSchemes.forEach(scheme => {
                const option = document.createElement('option');
                option.value = scheme.name;
                option.textContent = scheme.name;
                option.setAttribute('data-scheme-url', scheme.url);
                colorSchemesSelect.appendChild(option);
            });
            
            // Set the current selection
            const storedColorScheme = localStorage.getItem(COLOR_SCHEMES_STORAGE_KEY);
            if (storedColorScheme) {
                colorSchemesSelect.value = storedColorScheme;
            } else {
                // Use the default color scheme for this skin
                const defaultColorScheme = getDefaultColorScheme(selectedSkin);
                if (defaultColorScheme) {
                    colorSchemesSelect.value = defaultColorScheme;
                }
            }
        } else {
            // Hide the container if no color schemes
            colorSchemesContainer.style.display = 'none';
        }
    }

    /**
     * Try to determine the GitHub repository URL for a skin
     * @param {Object} skin
     * @returns {string|null}
     */
    function getSkinRepositoryUrl(skin) {
        if (!skin) return null;
        
        if (skin.github) return skin.github;
        if (skin.repo) return skin.repo;
        if (skin.repository) return skin.repository;
        
        if (skin.url) {
            const candidateUrls = Array.isArray(skin.url) ? skin.url : [skin.url];
            for (const entry of candidateUrls) {
                if (typeof entry === 'string') {
                    const repoUrl = extractRepoFromUrl(entry);
                    if (repoUrl) return repoUrl;
                } else if (entry && Array.isArray(entry.urls)) {
                    for (const nestedUrl of entry.urls) {
                        const repoUrl = extractRepoFromUrl(nestedUrl);
                        if (repoUrl) return repoUrl;
                    }
                }
            }
        }
        return null;
    }

    function extractRepoFromUrl(url) {
        if (typeof url !== 'string') return null;
        const match = url.match(/https:\/\/cdn\.jsdelivr\.net\/gh\/([^\/]+)\/([^\/@]+)/i);
        if (match) {
            const owner = match[1];
            const repo = match[2];
            return `https://github.com/${owner}/${repo}`;
        }
        return null;
    }

    /**
     * Extract author name from GitHub URL
     * @param {string} url - The URL to extract author from
     * @returns {string|null} Author name or null
     */
    function extractAuthorFromUrl(url) {
        if (!url || typeof url !== 'string') return null;
        const match = url.match(/https:\/\/cdn\.jsdelivr\.net\/gh\/([^\/]+)\//i);
        if (match) {
            return match[1];
        }
        return null;
    }
    
    /**
     * Open modal for configuring optional includes for a skin
     * Shows both global and skin-specific optional includes
     * @param {Object} skin - The skin configuration object
     */
    function openOptionalIncludesModal(skin) {
        if (!skin) {
            return;
        }
        
        if (!window.ModalSystem) {
            ERR('ModalSystem not available');
            return;
        }
        
        // Get merged global optional includes (defaults + admin config)
        const mergedGlobalOptionalIncludes = getMergedGlobalOptionalIncludes();
        
        // Get enabled state for global includes (using key-based checks)
        const enabledGlobalIncludes = mergedGlobalOptionalIncludes.map(include => {
            const author = extractAuthorFromUrl(include.url);
            const key = generateOptionalIncludeKey('global', author, include.url);
            const enabled = isOptionalIncludeEnabled(key, include.enabled || false);
            
            return {
                ...include,
                enabled: enabled,
                key: key
            };
        });
        
        // Get skin-specific optional includes
        const skinOptionalIncludes = skin.optionalIncludes || [];
        
        // Get current enabled state for skin-specific includes
        const enabledSkinIncludes = getOptionalIncludesEnabledState(skin.name, skinOptionalIncludes);
        
        const modalId = `optional-includes-${skin.name.replace(/[^a-zA-Z0-9]/g, '-')}`;
        
        // Create content
        const content = document.createElement('div');
        
        // Description
        const description = document.createElement('div');
        description.className = 'listItemBodyText secondary';
        description.textContent = 'Enable or disable additional CSS modules. Global options apply to all skins:';
        description.style.cssText = 'margin-bottom: 1em; font-size: 0.9em; opacity: 0.8;';
        content.appendChild(description);
        
        // Create checkboxes container
        const checkboxesContainer = document.createElement('div');
        checkboxesContainer.style.cssText = 'display: flex; flex-direction: column; gap: 0.75em;';
        
        // Check if there are any optional includes at all
        if (enabledGlobalIncludes.length === 0 && enabledSkinIncludes.length === 0) {
            const noOptionsMessage = document.createElement('div');
            noOptionsMessage.className = 'listItemBodyText secondary';
            noOptionsMessage.textContent = 'No additional options available for this skin.';
            noOptionsMessage.style.cssText = 'text-align: center; padding: 1em; opacity: 0.6;';
            checkboxesContainer.appendChild(noOptionsMessage);
        }
        
        // Add global optional includes first
        if (enabledGlobalIncludes.length > 0) {
            const globalSection = document.createElement('div');
            globalSection.style.cssText = 'margin-bottom: 1em;';
            
            const globalHeader = document.createElement('div');
            globalHeader.className = 'listItemBodyText';
            globalHeader.textContent = 'Global Options';
            globalHeader.style.cssText = 'font-weight: 500; margin-bottom: 0.5em; font-size: 0.95em;';
            globalSection.appendChild(globalHeader);
            
            enabledGlobalIncludes.forEach((include, index) => {
                const checkboxItem = document.createElement('div');
                checkboxItem.style.cssText = 'display: flex; flex-direction: column; gap: 0.25em; padding: 0.5em; border-radius: 4px; background: rgba(255, 255, 255, 0.05);';
                
                const checkboxRow = document.createElement('div');
                checkboxRow.style.cssText = 'display: flex; align-items: center; gap: 0.75em;';
                
                const checkbox = document.createElement('input');
                checkbox.type = 'checkbox';
                checkbox.id = `globalOptionalInclude_${index}`;
                checkbox.checked = include.enabled;
                checkbox.setAttribute('data-include-name', include.name);
                checkbox.setAttribute('data-include-url', include.url);
                checkbox.setAttribute('data-is-global', 'true');
                checkbox.style.cssText = 'width: 18px; height: 18px; cursor: pointer;';
                
                const label = document.createElement('label');
                label.htmlFor = checkbox.id;
                label.style.cssText = 'flex: 1; cursor: pointer; user-select: none;';
                
                const nameSpan = document.createElement('span');
                nameSpan.textContent = include.name;
                nameSpan.style.cssText = 'font-weight: 500;';
                label.appendChild(nameSpan);
                
                // Add author name if available
                const author = extractAuthorFromUrl(include.url);
                if (author) {
                    const authorSpan = document.createElement('span');
                    authorSpan.textContent = ' by ';
                    authorSpan.style.cssText = 'font-size: 0.85em; opacity: 0.7; margin-left: 0.25em;';
                    
                    const authorLink = document.createElement('a');
                    authorLink.href = `https://github.com/${author}`;
                    authorLink.target = '_blank';
                    authorLink.rel = 'noopener noreferrer';
                    authorLink.textContent = author;
                    authorLink.style.cssText = 'color: inherit; text-decoration: underline; opacity: 0.8; transition: opacity 0.2s;';
                    authorLink.addEventListener('mouseenter', () => {
                        authorLink.style.opacity = '1';
                    });
                    authorLink.addEventListener('mouseleave', () => {
                        authorLink.style.opacity = '0.8';
                    });
                    
                    authorSpan.appendChild(authorLink);
                    label.appendChild(authorSpan);
                }
                
                checkboxRow.appendChild(checkbox);
                checkboxRow.appendChild(label);
                checkboxItem.appendChild(checkboxRow);
                globalSection.appendChild(checkboxItem);
            });
            
            checkboxesContainer.appendChild(globalSection);
        }
        
        // Add skin-specific optional includes
        if (enabledSkinIncludes.length > 0) {
            const skinSection = document.createElement('div');
            
            const skinHeader = document.createElement('div');
            skinHeader.className = 'listItemBodyText';
            skinHeader.textContent = `${skin.name} Skin Options`;
            skinHeader.style.cssText = 'font-weight: 500; margin-bottom: 0.5em; font-size: 0.95em;';
            skinSection.appendChild(skinHeader);
            
            enabledSkinIncludes.forEach((include, index) => {
                const checkboxItem = document.createElement('div');
                checkboxItem.style.cssText = 'display: flex; flex-direction: column; gap: 0.25em; padding: 0.5em; border-radius: 4px; background: rgba(255, 255, 255, 0.05);';
                
                const checkboxRow = document.createElement('div');
                checkboxRow.style.cssText = 'display: flex; align-items: center; gap: 0.75em;';
                
                const checkbox = document.createElement('input');
                checkbox.type = 'checkbox';
                checkbox.id = `skinOptionalInclude_${skin.name}_${index}`;
                checkbox.checked = include.enabled;
                checkbox.setAttribute('data-include-name', include.name);
                checkbox.setAttribute('data-include-url', include.url);
                checkbox.setAttribute('data-is-global', 'false');
                checkbox.style.cssText = 'width: 18px; height: 18px; cursor: pointer;';
                
                const label = document.createElement('label');
                label.htmlFor = checkbox.id;
                label.style.cssText = 'flex: 1; cursor: pointer; user-select: none;';
                
                const nameSpan = document.createElement('span');
                nameSpan.textContent = include.name;
                nameSpan.style.cssText = 'font-weight: 500;';
                label.appendChild(nameSpan);
                
                // Add author name if available
                const author = extractAuthorFromUrl(include.url);
                if (author) {
                    const authorSpan = document.createElement('span');
                    authorSpan.textContent = ' by ';
                    authorSpan.style.cssText = 'font-size: 0.85em; opacity: 0.7; margin-left: 0.25em;';
                    
                    const authorLink = document.createElement('a');
                    authorLink.href = `https://github.com/${author}`;
                    authorLink.target = '_blank';
                    authorLink.rel = 'noopener noreferrer';
                    authorLink.textContent = author;
                    authorLink.style.cssText = 'color: inherit; text-decoration: underline; opacity: 0.8; transition: opacity 0.2s;';
                    authorLink.addEventListener('mouseenter', () => {
                        authorLink.style.opacity = '1';
                    });
                    authorLink.addEventListener('mouseleave', () => {
                        authorLink.style.opacity = '0.8';
                    });
                    
                    authorSpan.appendChild(authorLink);
                    label.appendChild(authorSpan);
                }
                
                checkboxRow.appendChild(checkbox);
                checkboxRow.appendChild(label);
                checkboxItem.appendChild(checkboxRow);
                skinSection.appendChild(checkboxItem);
            });
            
            // Prepend child instead so that it appears first
            checkboxesContainer.prepend(skinSection);
        }
        
        content.appendChild(checkboxesContainer);
        
        // Create modal using ModalSystem (no footer - auto-save on change)
        const modal = window.ModalSystem.create({
            id: modalId,
            title: `Optional CSS Modules`,
            content: content,
            footer: null,
            closeOnBackdrop: true,
            closeOnEscape: true,
            onOpen: (modalInstance) => {
                // Focus first checkbox
                const firstCheckbox = modalInstance.dialog.querySelector('input[type="checkbox"]');
                if (firstCheckbox) {
                    setTimeout(() => firstCheckbox.focus(), 100);
                }
                
                // Add change event listeners to all checkboxes for auto-save and real-time updates
                const allCheckboxes = modalInstance.dialog.querySelectorAll('input[type="checkbox"]');
                allCheckboxes.forEach(checkbox => {
                    checkbox.addEventListener('change', () => {
                        const isGlobal = checkbox.getAttribute('data-is-global') === 'true';
                        
                        if (isGlobal) {
                            // Handle global optional includes - save to user localStorage (highest priority)
                            const includeUrl = checkbox.getAttribute('data-include-url');
                            const author = extractAuthorFromUrl(includeUrl);
                            const key = generateOptionalIncludeKey('global', author, includeUrl);
                            const enabled = checkbox.checked;
                            
                            // Save only this specific key to user config
                            saveOptionalIncludeState(key, enabled);
                            
                            // Apply changes immediately
                            const currentSkinName = localStorage.getItem(STORAGE_KEY) || getDefaultSkinName();
                            const currentSkin = SKINS_CONFIG.find(s => s.name === currentSkinName);
                            
                            if (currentSkin) {
                                // Unload and reload global optional includes
                                unloadOptionalIncludesForSkin('global');
                                // Reload based on updated config (will reload both global and skin-specific)
                                loadOptionalIncludes(currentSkin);
                            }
                            
                            LOG(`Updated global optional include: ${key}`);
                        } else {
                            // Handle skin-specific optional includes
                            const includeUrl = checkbox.getAttribute('data-include-url');
                            const author = extractAuthorFromUrl(includeUrl);
                            const key = generateOptionalIncludeKey(skin.name, author, includeUrl);
                            const enabled = checkbox.checked;
                            
                            // Save only this specific key (Option 1: only save what user toggled)
                            saveOptionalIncludeState(key, enabled);
                            
                            // Check if this is the currently active skin
                            const currentSkinName = localStorage.getItem(STORAGE_KEY) || getDefaultSkinName();
                            if (currentSkinName === skin.name) {
                                // Reload skin-specific optional includes based on updated userConfig
                                // First, unload current skin-specific optional includes
                                unloadOptionalIncludesForSkin(skin.name);
                                
                                // Then reload based on userConfig (will reload both global and skin-specific)
                                loadOptionalIncludes(skin);
                                
                                LOG(`Updated optional includes for ${skin.name} in real-time`);
                            }
                        }
                    });
                });
            }
        });
    }
    
    /**
     * Update the author info section within the popover
     */
    function updateSkinAuthorLabel() {
        const labelElement = document.querySelector('label[for="selectSkinPopover"]');
        if (!labelElement) {
            return;
        }
        
        const skinSelect = document.getElementById('selectSkinPopover');
        const selectedSkinName = skinSelect?.value || localStorage.getItem(STORAGE_KEY) || getDefaultSkinName();
        const selectedSkin = SKINS_CONFIG.find(skin => skin.name === selectedSkinName);
        
        labelElement.innerHTML = '';
        if (!selectedSkin || (!selectedSkin.author && !getSkinRepositoryUrl(selectedSkin))) {
            labelElement.textContent = 'Skin';
            return;
        }
        
        const prefix = document.createElement('span');
        prefix.textContent = 'Skin by ';
        labelElement.appendChild(prefix);
        
        const authorName = selectedSkin.author || 'View Repository';
        const repoUrl = getSkinRepositoryUrl(selectedSkin);
        
        if (repoUrl) {
            const link = document.createElement('a');
            link.href = repoUrl;
            link.target = '_blank';
            link.rel = 'noopener noreferrer';
            link.textContent = authorName;
            link.style.color = 'var(--accent, #4a9eff)';
            link.style.textDecoration = 'none';
            link.style.marginLeft = '2px';
            labelElement.appendChild(link);
        } else {
            const authorSpan = document.createElement('span');
            authorSpan.textContent = authorName;
            labelElement.appendChild(authorSpan);
        }
        
        // Add gear icon for all skins (global optional includes apply to all)
        if (selectedSkin) {
            const gearIcon = document.createElement('span');
            gearIcon.className = 'material-icons';
            gearIcon.textContent = 'settings';
            gearIcon.style.fontSize = '1em';
            gearIcon.style.marginLeft = '0.5em';
            gearIcon.style.cursor = 'pointer';
            gearIcon.style.opacity = '0.7';
            gearIcon.style.transition = 'opacity 0.2s';
            gearIcon.title = 'Configure additional skin options';
            gearIcon.addEventListener('mouseenter', () => {
                gearIcon.style.opacity = '1';
            });
            gearIcon.addEventListener('mouseleave', () => {
                gearIcon.style.opacity = '0.7';
            });
            gearIcon.addEventListener('click', (e) => {
                e.stopPropagation();
                openOptionalIncludesModal(selectedSkin);
            });
            labelElement.appendChild(gearIcon);
        }
    }
    
    /**
     * Position the popover relative to the button
     * @param {Element} popover - The popover element
     * @param {Element} button - The button element
     */
    function positionPopover(popover, button) {
        const rect = button.getBoundingClientRect();
        const popoverRect = popover.getBoundingClientRect();
        
        // Position below the button, right-aligned using right property
        let currentPos = rect.right - popoverRect.width;
        let top = rect.bottom + 16; // Increased from 8 to 16 for more spacing
        
        // Adjust if popover would go off screen
        if (currentPos < 8) {
            currentPos = 8;
        } else if (currentPos + popoverRect.width > window.innerWidth - 8) {
            currentPos = window.innerWidth - popoverRect.width - 8;
        }
        
        if (top + popoverRect.height > window.innerHeight - 8) {
            // Position above if no room below
            top = rect.top - popoverRect.height - 8;
        }
        
        popover.style.right = `calc(100% - ${currentPos}px - 50px)`;
        popover.style.top = `${top}px`;
    }
    
    /**
     * Handle clicks outside the popover to close it
     * @param {Event} event - The click event
     */
    function handlePopoverClickOutside(event) {
        const backdrop = document.querySelector('.dialogBackdrop[data-modal-id]');
        const dialogContainer = document.querySelector('.dialogContainer[data-modal-id]');
        
        if (backdrop && dialogContainer && 
            !dialogContainer.contains(event.target) && 
            !event.target.closest('.headerAppearanceButton')) {
            
            // Remove backdrop and dialog container
            if (backdrop.parentNode) {
                backdrop.parentNode.removeChild(backdrop);
            }
            if (dialogContainer.parentNode) {
                dialogContainer.parentNode.removeChild(dialogContainer);
            }
            
            document.removeEventListener('click', handlePopoverClickOutside);
        }
    }
    
    /**
     * Add the skin dropdown to the display preferences page
     */
    function addSkinDropdown() {
        const settingsContainer = document.querySelector('.settingsContainer');
        if (!settingsContainer) {
            WARN('Settings container not found');
            return;
        }
        
        const form = settingsContainer.querySelector('form');
        if (!form) {
            WARN('Settings form not found');
            return;
        }
        
        const displayModeField = form.querySelector('.fldDisplayMode');
        if (!displayModeField) {
            WARN('Display mode field not found');
            return;
        }
        
        // Check if skin dropdown already exists
        if (form.querySelector('.fldSkin')) {
            LOG('Skin dropdown already exists');
            return;
        }
        
        // Create the skin dropdown container
        const skinContainer = document.createElement('div');
        skinContainer.className = 'fldSkin';
        
        // Create the dropdown using the generic function
        const dropdown = createDropdown({
            label: 'Skin',
            id: 'selectSkin',
            options: SKINS_CONFIG.map(skin => ({
                value: skin.name,
                text: skin.name,
                author: skin.author
            })),
            changeHandler: handleSkinChange,
            hoverHandler: handleSkinSelectHover,
            focusHandler: handleSkinSelectFocus
        });
        
        // Add to skin container
        skinContainer.appendChild(dropdown);
        
        // Insert after the display mode field
        displayModeField.parentNode.insertBefore(skinContainer, displayModeField.nextSibling);
        
        // Set the current selection
        const selectedSkinName = localStorage.getItem(STORAGE_KEY) || getDefaultSkinName();
        const select = document.getElementById('selectSkin');
        if (select) {
            select.value = selectedSkinName;
        }
        
        // Update label with gear icon
        updateDisplayPreferencesSkinLabel();
        
        LOG('Skin dropdown added successfully');
    }
    
    /**
     * Handle hover events on the skin select dropdown
     * @param {Event} event - The mouseover event
     */
    function handleSkinSelectHover(event) {
        const select = event.target;
        const selectedSkinName = select.value;
        const selectedSkin = SKINS_CONFIG.find(skin => skin.name === selectedSkinName);
        
        if (selectedSkin && selectedSkin.author) {
            let tooltipText = `Author: ${selectedSkin.author}`;
            if (selectedSkin.colorSchemes && selectedSkin.colorSchemes.length > 0) {
                tooltipText += `\nColor Schemes: ${selectedSkin.colorSchemes.length}`;
            }
            showTooltip(tooltipText, select);
        }
    }
    
    /**
     * Handle focus events on the skin select dropdown
     * @param {Event} event - The focus event
     */
    function handleSkinSelectFocus(event) {
        const select = event.target;
        const selectedSkinName = select.value;
        const selectedSkin = SKINS_CONFIG.find(skin => skin.name === selectedSkinName);
        
        if (selectedSkin && selectedSkin.author) {
            let tooltipText = `Author: ${selectedSkin.author}`;
            if (selectedSkin.colorSchemes && selectedSkin.colorSchemes.length > 0) {
                tooltipText += `\nColor Schemes: ${selectedSkin.colorSchemes.length}`;
            }
            showTooltip(tooltipText, select);
        }
    }
    
    /**
     * Add the color schemes dropdown to the display preferences page
     */
    function addColorSchemesDropdown() {
        const settingsContainer = document.querySelector('.settingsContainer');
        if (!settingsContainer) {
            WARN('Settings container not found');
            return;
        }
        
        const form = settingsContainer.querySelector('form');
        if (!form) {
            WARN('Settings form not found');
            return;
        }
        
        const skinField = form.querySelector('.fldSkin');
        if (!skinField) {
            WARN('Skin field not found - color schemes dropdown requires skin field');
            return;
        }
        
        // Check if color schemes dropdown already exists
        if (form.querySelector('.fldColorSchemes')) {
            LOG('Color schemes dropdown already exists');
            return;
        }
        
        // Create the color schemes dropdown container
        const colorSchemesContainer = document.createElement('div');
        colorSchemesContainer.className = 'fldColorSchemes';
        
        // Create the dropdown using the generic function
        const dropdown = createDropdown({
            label: 'Color Schemes',
            id: 'selectColorSchemes',
            options: [], // Will be populated by updateColorSchemesDropdown
            changeHandler: handleColorSchemeChange
        });
        
        // Add to color schemes container
        colorSchemesContainer.appendChild(dropdown);
        
        // Insert after the skin field
        skinField.parentNode.insertBefore(colorSchemesContainer, skinField.nextSibling);
        
        // Update color schemes based on current skin selection
        updateColorSchemesDropdown();
        
        LOG('Color schemes dropdown added successfully');
    }
    
    /**
     * Synchronize all color scheme dropdowns with the current skin and localStorage
     * This ensures both popover and display page dropdowns stay in sync
     */
    function syncAllColorSchemeDropdowns() {
        const selectedSkinName = localStorage.getItem(STORAGE_KEY) || getDefaultSkinName();
        const selectedSkin = SKINS_CONFIG.find(skin => skin.name === selectedSkinName);
        
        // Get all color scheme dropdowns
        const displayDropdown = document.getElementById('selectColorSchemes');
        const popoverDropdown = document.getElementById('selectColorSchemesPopover');
        
        // Update display page dropdown
        if (displayDropdown) {
            updateColorSchemesDropdown();
        }
        
        // Update popover dropdown
        if (popoverDropdown) {
            updatePopoverColorSchemes();
        }
        
        // Ensure localStorage has a valid color scheme for the current skin
        const storedColorScheme = localStorage.getItem(COLOR_SCHEMES_STORAGE_KEY);
        if (selectedSkin && selectedSkin.colorSchemes && selectedSkin.colorSchemes.length > 0) {
            // Check if stored color scheme is valid for current skin
            const isValidScheme = selectedSkin.colorSchemes.some(scheme => scheme.name === storedColorScheme);
            if (!isValidScheme) {
                // Remove invalid color scheme from localStorage
                localStorage.removeItem(COLOR_SCHEMES_STORAGE_KEY);
                LOG('Removed invalid color scheme from localStorage');
            }
        } else {
            // No color schemes available, remove from localStorage
            localStorage.removeItem(COLOR_SCHEMES_STORAGE_KEY);
        }
    }
    
    /**
     * Update the color schemes dropdown based on the selected skin
     */
    function updateColorSchemesDropdown() {
        const select = document.getElementById('selectColorSchemes');
        if (!select) {
            return;
        }
        
        // Get the currently selected skin
        const skinSelect = document.getElementById('selectSkin');
        if (!skinSelect) {
            return;
        }
        
        const selectedSkinName = skinSelect.value;
        const selectedSkin = SKINS_CONFIG.find(skin => skin.name === selectedSkinName);
        
        // Clear existing options
        const options = select.querySelectorAll('option');
        options.forEach(option => {
            option.remove();
        });
        
        // Show/hide the color schemes dropdown based on whether the skin has color schemes
        const colorSchemesContainer = select.closest('.fldColorSchemes');
        if (colorSchemesContainer) {
            if (selectedSkin && selectedSkin.colorSchemes && selectedSkin.colorSchemes.length > 0) {
                // Add color scheme options
                selectedSkin.colorSchemes.forEach(scheme => {
                    const option = document.createElement('option');
                    option.value = scheme.name;
                    option.textContent = scheme.name;
                    option.setAttribute('data-scheme-url', scheme.url);
                    select.appendChild(option);
                });
                
                // Show the dropdown
                colorSchemesContainer.style.display = '';
                LOG(`Updated color schemes dropdown with ${selectedSkin.colorSchemes.length} options for skin: ${selectedSkinName}`);
            } else {
                // Hide the dropdown if no color schemes
                colorSchemesContainer.style.display = 'none';
                LOG(`Hiding color schemes dropdown - skin '${selectedSkinName}' has no color schemes`);
            }
        }
        
        // Set the selected color scheme
        const selectedColorSchemeName = localStorage.getItem(COLOR_SCHEMES_STORAGE_KEY);
        if (selectedColorSchemeName) {
        select.value = selectedColorSchemeName;
        } else {
            // Use the default color scheme for this skin
            const defaultColorScheme = getDefaultColorScheme(selectedSkin);
            if (defaultColorScheme) {
                select.value = defaultColorScheme;
            }
        }
    }
    
    /**
     * Add custom theme options to the existing select#selectTheme dropdown
     */
    function addThemeOptions() {
        const themeSelect = document.getElementById('selectTheme');
        if (!themeSelect) {
            WARN('Theme select dropdown not found');
            return;
        }
        
        // Check if custom themes have already been added
        if (themeSelect.hasAttribute('data-kefin-themes-added')) {
            LOG('Custom theme options already added');
            return;
        }
        
        // Check if Jellyfin has already added its options
        if (themeSelect.options.length > 0) {
            addCustomThemeOptions(themeSelect);
        } else {
            // Wait for Jellyfin to add its options using MutationObserver
            LOG('Waiting for Jellyfin theme options to load...');
            const observer = new MutationObserver((mutations) => {
                mutations.forEach((mutation) => {
                    if (mutation.type === 'childList' && themeSelect.options.length > 0) {
                        LOG('Jellyfin theme options detected, adding custom options');
                        addCustomThemeOptions(themeSelect);
                        observer.disconnect(); // Stop observing once we've added our options
                    }
                });
            });
            
            observer.observe(themeSelect, { childList: true });
            
            // Fallback timeout in case MutationObserver doesn't trigger
            setTimeout(() => {
                if (!themeSelect.hasAttribute('data-kefin-themes-added') && themeSelect.options.length > 0) {
                    LOG('Fallback: Adding custom theme options after timeout');
                    addCustomThemeOptions(themeSelect);
                }
                observer.disconnect();
            }, 2000);
        }
    }
    
    /**
     * Add the actual custom theme options to the select element
     * @param {HTMLSelectElement} themeSelect - The theme select element
     */
    function addCustomThemeOptions(themeSelect) {
        // Add custom theme options
        THEMES_CONFIG.forEach(theme => {
            const option = document.createElement('option');
            option.value = theme.name;
            option.textContent = theme.name;
            option.setAttribute('data-theme-url', theme.url);
            option.setAttribute('data-custom-theme', 'true');
            themeSelect.appendChild(option);
        });
        
        // Mark as processed
        themeSelect.setAttribute('data-kefin-themes-added', 'true');
        
        // Add event listener for theme changes
        themeSelect.addEventListener('change', handleThemeChange);
        
        // Set the selected value from localStorage cache
        const cachedTheme = localStorage.getItem(THEME_STORAGE_KEY);
        if (cachedTheme) {
            themeSelect.value = cachedTheme;
            LOG(`Restored theme selection from cache: ${cachedTheme}`);
        }
        
        LOG(`Added ${THEMES_CONFIG.length} custom theme options`);
    }
    
    /**
     * Handle theme selection change
     * @param {Event} event - The change event
     */
    function handleThemeChange(event) {
        const selectedOption = event.target.selectedOptions[0];
        const selectedThemeValue = event.target.value;
        
        if (selectedOption) {
            
            LOG(`Custom theme changed to: ${selectedThemeValue}`);
            
            // Save selection to localStorage
            localStorage.setItem(THEME_STORAGE_KEY, selectedThemeValue);
            
            // Custom theme selected
            const themeUrl = selectedOption.getAttribute('data-theme-url') ?? `themes/${selectedThemeValue}/theme.css`;
                
            if (themeUrl) {
                // Update the cssTheme link href
                updateThemeCSS(themeUrl);
            }
        } else {
            // Default Jellyfin theme selected
            LOG(`Default theme changed to: ${selectedThemeValue}`);
            
            // Save selection to localStorage
            localStorage.setItem(THEME_STORAGE_KEY, selectedThemeValue);
            
            // Reset to default Jellyfin theme behavior
            resetThemeCSS();
        }
    }
    
    /**
     * Update the cssTheme link href to a custom theme URL
     * @param {string} url - The custom theme URL
     */
    function updateThemeCSS(url) {
        let cssThemeLink = document.getElementById('cssTheme');
        
        if (!cssThemeLink) {
            // Create the cssTheme link if it doesn't exist
            cssThemeLink = document.createElement('link');
            cssThemeLink.id = 'cssTheme';
            cssThemeLink.rel = 'stylesheet';
            cssThemeLink.type = 'text/css';
            cssThemeLink.setAttribute('data-kefin-custom-theme', 'true');
            document.head.appendChild(cssThemeLink);
            LOG('Created cssTheme link');
        }
        
        cssThemeLink.href = url;
        LOG(`Updated cssTheme link to: ${url}`);
    }
    
    /**
     * Reset the cssTheme link to default Jellyfin behavior
     */
    function resetThemeCSS() {
        const cssThemeLink = document.getElementById('cssTheme');
        
        if (cssThemeLink && cssThemeLink.hasAttribute('data-kefin-custom-theme')) {
            // Only remove if we created it
            cssThemeLink.remove();
            LOG('Removed custom cssTheme link');
        }
    }
    
    /**
     * Load the currently selected theme
     */
    function loadSelectedTheme() {
        const selectedThemeValue = localStorage.getItem(THEME_STORAGE_KEY);
        
        if (selectedThemeValue) {
            const selectedTheme = THEMES_CONFIG.find(theme => theme.name === selectedThemeValue);
            
            if (selectedTheme) {
                LOG(`Loading selected custom theme: ${selectedTheme.name}`);
                updateThemeCSS(selectedTheme.url);
                
                // Set the dropdown selection
                const themeSelect = document.getElementById('selectTheme');
                if (themeSelect) {
                    themeSelect.value = selectedThemeValue;
                }
            } else {
                // Check if it's a default Jellyfin theme
                const themeSelect = document.getElementById('selectTheme');
                if (themeSelect) {
                    const option = themeSelect.querySelector(`option[value="${selectedThemeValue}"]`);
                    if (option && !option.hasAttribute('data-custom-theme')) {
                        LOG(`Loading selected default theme: ${selectedThemeValue}`);
                        themeSelect.value = selectedThemeValue;
                        resetThemeCSS();
                    } else {
                        WARN(`Selected theme '${selectedThemeValue}' not found`);
                    }
                }
            }
        }
    }

    function removeColorSchemesCSS() {
        const cssColorSchemesLink = document.getElementById('cssColorSchemes');
        if (cssColorSchemesLink && cssColorSchemesLink.hasAttribute('data-kefin-color-schemes')) {
            cssColorSchemesLink.remove();
            LOG('Removed cssColorSchemes link');
        }
    }
    
    
    /**
     * Update the cssColorSchemes link href to a custom color scheme URL
     * @param {string|null} url - The color scheme URL, or null/empty to remove CSS
     */
    function updateColorSchemesCSS(url) {
        // Handle reset case (null or empty URL)
        if (!url) {
            removeColorSchemesCSS();            
            return;
        }
        
        let cssColorSchemesLink = document.getElementById('cssColorSchemes');
        
        if (!cssColorSchemesLink) {
            // Create the cssColorSchemes link if it doesn't exist
            cssColorSchemesLink = document.createElement('link');
            cssColorSchemesLink.id = 'cssColorSchemes';
            cssColorSchemesLink.rel = 'stylesheet';
            cssColorSchemesLink.type = 'text/css';
            cssColorSchemesLink.setAttribute('data-kefin-color-schemes', 'true');
            
            // Find the best insertion point to maintain CSS cascade order:
            // cssTheme -> cssSkin(s) -> cssColorSchemes
            const skinLinks = document.querySelectorAll('link[data-kefin-skin="true"]');
            let insertAfter = null;
            
            if (skinLinks.length > 0) {
                // Insert after the last skin CSS link
                insertAfter = skinLinks[skinLinks.length - 1];
            } else {
                // No skin CSS, insert after cssTheme
                insertAfter = document.getElementById('cssTheme');
            }
            
            if (insertAfter && insertAfter.parentNode) {
                insertAfter.parentNode.insertBefore(cssColorSchemesLink, insertAfter.nextSibling);
            } else {
                // Fallback to appending to head if no reference point found
                document.head.appendChild(cssColorSchemesLink);
            }
            LOG('Created cssColorSchemes link');
        }
        
        // Find the scheme by URL and update localStorage
        const selectedSkinName = localStorage.getItem(STORAGE_KEY) || getDefaultSkinName();
        const selectedSkin = SKINS_CONFIG.find(skin => skin.name === selectedSkinName);
        
        if (selectedSkin && selectedSkin.colorSchemes) {
            const matchingScheme = selectedSkin.colorSchemes.find(scheme => scheme.url === url);
            if (matchingScheme) {
                LOG(`Updated cssColorSchemes link to: ${url} for skin: ${selectedSkinName}`);
                
                // Update all color scheme dropdowns to match the applied scheme
                const displayDropdown = document.getElementById('selectColorSchemes');
                const popoverDropdown = document.getElementById('selectColorSchemesPopover');
                
                if (displayDropdown && matchingScheme) {
                    displayDropdown.value = matchingScheme.name;
                    LOG(`Updated display color scheme dropdown to: ${matchingScheme.name}`);
                }
                
                if (popoverDropdown && matchingScheme) {
                    popoverDropdown.value = matchingScheme.name;
                    LOG(`Updated popover color scheme dropdown to: ${matchingScheme.name}`);
                }

                if (cssColorSchemesLink) {
                    cssColorSchemesLink.href = url;
                    LOG(`Updated cssColorSchemes link to: ${url}`);
                }
                return;
            }
        }
        // If no skin or no color schemes, reset to default
        LOG('No skin or color schemes available, removing cssColorSchemes link');
        removeColorSchemesCSS();
    }
    
    
    /**
     * Load the currently selected color scheme
     */
    function loadSelectedColorScheme() {
        const selectedColorSchemeName = localStorage.getItem(COLOR_SCHEMES_STORAGE_KEY);
        
        if (selectedColorSchemeName) {
            // Get the currently selected skin
            const selectedSkinName = localStorage.getItem(STORAGE_KEY) || getDefaultSkinName();
            const selectedSkin = SKINS_CONFIG.find(skin => skin.name === selectedSkinName);
            
            if (selectedSkin && selectedSkin.colorSchemes) {
                const selectedColorScheme = selectedSkin.colorSchemes.find(scheme => scheme.name === selectedColorSchemeName);
            
            if (selectedColorScheme) {
                LOG(`Loading selected color scheme: ${selectedColorScheme.name}`);
                updateColorSchemesCSS(selectedColorScheme.url);
            } else {
                    LOG(`Selected color scheme '${selectedColorSchemeName}' not found for skin '${selectedSkinName}', using default`);
                    // Use the default color scheme for this skin
                    const defaultColorScheme = getDefaultColorScheme(selectedSkin);
                    if (defaultColorScheme) {
                        const defaultScheme = selectedSkin.colorSchemes.find(scheme => scheme.name === defaultColorScheme);
                        if (defaultScheme) {
                            updateColorSchemesCSS(defaultScheme.url);
                        }
                    } else {
                        updateColorSchemesCSS(null);
                    }
                }
            } else {
                WARN(`No color schemes available for skin '${selectedSkinName}'`);
            }
        } else {
            // No color scheme stored, use default for current skin
            const selectedSkinName = localStorage.getItem(STORAGE_KEY) || getDefaultSkinName();
        const selectedSkin = SKINS_CONFIG.find(skin => skin.name === selectedSkinName);
        
            if (selectedSkin) {
                const defaultColorScheme = getDefaultColorScheme(selectedSkin);
                if (defaultColorScheme) {
                    const defaultScheme = selectedSkin.colorSchemes.find(scheme => scheme.name === defaultColorScheme);
                    if (defaultScheme) {
                        LOG(`Loading default color scheme for skin '${selectedSkinName}': ${defaultScheme.name}`);
                        updateColorSchemesCSS(defaultScheme.url);
                    }
                } else {
                    LOG(`No default color scheme for skin '${selectedSkinName}', removing CSS`);
                    updateColorSchemesCSS(null);
                }
            }
        }
    }
    
    
    /**
     * Get the default color scheme for a skin
     * @param {Object} skin - The skin configuration object
     * @returns {string|null} The default color scheme name, or null if no schemes
     */
    function getDefaultColorScheme(skin) {
        if (!skin || !skin.colorSchemes || skin.colorSchemes.length === 0) {
            return null;
        }
        return skin.colorSchemes[0].name;
    }
    
    /**
     * Get the default skin name from configuration
     * @returns {string} The default skin name
     */
    function getDefaultSkinName() {
        // Check if a default skin is specified in the main configuration
        const configDefaultSkin = window.KefinTweaksConfig?.defaultSkin;
        if (configDefaultSkin) {
            LOG(`Using configured default skin: ${configDefaultSkin}`);
            return configDefaultSkin;
        }
        
        // Fall back to 'Default' if no configuration is specified
        return 'Default';
    }
    
    /**
     * Load the currently selected skin
     */
    function loadSelectedSkin() {
        const selectedSkinName = localStorage.getItem(STORAGE_KEY) || getDefaultSkinName();
        const selectedSkin = SKINS_CONFIG.find(skin => skin.name === selectedSkinName);
        
        if (selectedSkin) {
            LOG(`Loading selected skin: ${selectedSkin.name}`);
            loadSkin(selectedSkin);
            
            // Update color schemes dropdown after skin is loaded
            setTimeout(() => {
                syncAllColorSchemeDropdowns();
            }, 100);
        } else {
            const defaultSkinName = getDefaultSkinName();
            WARN(`Selected skin '${selectedSkinName}' not found, falling back to ${defaultSkinName}`);
            const defaultSkin = SKINS_CONFIG.find(skin => skin.name === defaultSkinName);
            if (defaultSkin) {
                loadSkin(defaultSkin);
                
                // Update color schemes dropdown after default skin is loaded
                setTimeout(() => {
                    syncAllColorSchemeDropdowns();
                }, 100);
            }
        }
    }
    
    /**
     * Load a specific skin
     * @param {Object} skin - The skin configuration object
     */
    function loadSkin(skin) {
        // Check if this skin is already loaded by looking at the DOM
        const currentSkinLink = document.querySelector('link[data-kefin-skin="true"]');
        const currentSkinName = currentSkinLink ? currentSkinLink.getAttribute('data-skin') : null;
        
        if (currentSkinName === skin.name) {
            LOG(`Skin '${skin.name}' is already loaded - skipping`);
            return;
        }
        
        // Use requestAnimationFrame to avoid blocking
        requestAnimationFrame(() => {
            removeAllSkinCSS();
            // Unload skin-specific optional includes for the current skin (if switching)
            if (currentSkinName) {
                unloadOptionalIncludesForSkin(currentSkinName);
            }
        });
        
        // Performance optimization: Load new CSS first, then remove old CSS
        // This prevents the double-reflow/recalc that causes UI freezing
        
        // Step 1: Load the new CSS first (gets cached and starts loading)
        requestAnimationFrame(async () => {
            const cssUrls = await getSkinUrlsForCurrentVersion(skin);
            
            if (!cssUrls || cssUrls.length === 0) {
                LOG(`No CSS URLs found for skin: ${skin.name}`);
                return;
            }
            
            LOG(`Loading skin with ${cssUrls.length} CSS files: ${skin.name}`);
            cssUrls.forEach(url => {
                if (url) { // Skip null/empty URLs
                    loadSkinCSS(url, skin.name);
                }
            });
            
            // Load optional includes for this skin
            loadOptionalIncludes(skin);
        });
    }
    
    /**
     * Load CSS for a specific skin using link tags
     * @param {string} url - The CSS URL
     * @param {string} skinName - The skin name
     */
    function loadSkinCSS(url, skinName) {
        // Check if this CSS is already loaded
        if (loadedSkinUrls.has(url)) {
            LOG(`Skin CSS already loaded: ${url}`);
            return;
        }

        if (!url || url === '') {
            LOG(`Invalid skin CSS URL: ${url}, skipping`);
            return;
        }
        
        const link = document.createElement('link');
        link.id = `cssSkin-${Date.now()}-${Math.random()}`; // Unique ID to prevent conflicts
        link.rel = 'stylesheet';
        link.type = 'text/css';
        link.href = url;
        link.setAttribute('data-kefin-skin', 'true');
        link.setAttribute('data-skin', skinName);
        
        // Find the insertion point: after the last skin link, or after cssTheme if no skin links exist
        // This ensures CSS files are loaded in the order they appear in the config array
        const skinLinks = document.querySelectorAll('link[data-kefin-skin="true"]');
        let insertAfter = null;
        
        if (skinLinks.length > 0) {
            // Insert after the last skin link to maintain order
            insertAfter = skinLinks[skinLinks.length - 1];
        } else {
            // No skin links yet, insert after cssTheme
            insertAfter = document.getElementById('cssTheme');
        }
        
        if (insertAfter && insertAfter.parentNode) {
            insertAfter.parentNode.insertBefore(link, insertAfter.nextSibling);
        } else {
            // Fallback to appending to head if reference point not found
            document.getElementById('reactRoot').after(link);
        }
        
        loadedSkinUrls.add(url);
        LOG(`Skin CSS loaded via link tag: ${url}`);
        
        // Defer expensive DOM operations (cssColorSchemes repositioning)
        // to avoid blocking during the initial CSS load
        requestAnimationFrame(() => {
            const cssColorSchemesLink = document.getElementById('cssColorSchemes');
            if (cssColorSchemesLink && cssColorSchemesLink.parentNode) {
                // Only reposition if it's not already in the right position
                const skinLinks = document.querySelectorAll('link[data-kefin-skin="true"]');
                const lastSkinLink = skinLinks[skinLinks.length - 1];
                
                if (lastSkinLink && lastSkinLink.nextSibling !== cssColorSchemesLink) {
                    // Remove it from its current position
                    cssColorSchemesLink.remove();
                    // Insert it after the last skin CSS link
                    lastSkinLink.parentNode.insertBefore(cssColorSchemesLink, lastSkinLink.nextSibling);
                    LOG('Repositioned cssColorSchemes after skin CSS');
                }
            }
        });
    }
    
    /**
     * Remove all previously loaded skin CSS
     */
    function removeAllSkinCSS() {
        const skinLinks = document.querySelectorAll('link[data-kefin-skin="true"]');
        
        skinLinks.forEach(link => {
            const url = link.href;
            loadedSkinUrls.delete(url);
            link.remove();
            LOG(`Removed skin CSS link: ${url}`);
        });
        
        // Clear the tracking set
        loadedSkinUrls.clear();
    }
    
    // Initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initialize);
    } else {
        initialize();
    }

    LOG('Initialized successfully');
})();
