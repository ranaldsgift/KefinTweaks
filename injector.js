// KefinTweaks Script Injector
// Dynamically loads scripts and CSS files based on user configuration
// Usage: Configuration is now managed in kefinTweaks.js - this script reads from window.KefinTweaksConfig

(function() {
    'use strict';

    console.log('[KefinTweaks Injector] Initializing...');    
    // Cache for resolved root URL (to avoid multiple API calls)
    let resolvedRootCache = null;
    // Cached Jellyfin major (10 / 11 / 12 …); null until resolved or if unavailable
    let cachedJellyfinMajorVersion = null;

    function getMajorServerVersion(version) {
        if (!version || typeof version !== 'string') return null;
        const versionParts = version.split('.');

        if (versionParts[0] !== '10') {
            const majorVersion = parseInt(versionParts[0], 10);
            return Number.isNaN(majorVersion) ? null : majorVersion;
        }

        if (versionParts.length >= 2) {
            const majorVersion = parseInt(versionParts[1], 10);
            if (!Number.isNaN(majorVersion)) {
                return majorVersion;
            }
        }
        return null;
    }

    /**
     * Resolve Jellyfin major version (e.g. 10 for 10.10.x, 11 for 10.11.x, 12 for 10.12.x).
     * Mirrors skinManager detection (Jellyfin Web app version, else server version with brief poll).
     * @returns {Promise<number|null>}
     */
    async function getCurrentMajorServerVersion() {
        try {
            if (cachedJellyfinMajorVersion !== null) {
                return cachedJellyfinMajorVersion;
            }

            // Brief wait — injector init can run before ApiClient version fields exist
            if (!window.ApiClient?._appVersion && !window.ApiClient?._serverVersion) {
                const startTime = Date.now();
                while (Date.now() - startTime < 5000) {
                    if (window.ApiClient?._appVersion || window.ApiClient?._serverVersion) {
                        break;
                    }
                    await new Promise(resolve => setTimeout(resolve, 200));
                }
            }

            if (!window.ApiClient) {
                return null;
            }

            if (window.ApiClient._appName === 'Jellyfin Web' && window.ApiClient._appVersion) {
                cachedJellyfinMajorVersion = getMajorServerVersion(window.ApiClient._appVersion);
                return cachedJellyfinMajorVersion;
            }

            if (!window.ApiClient._serverVersion) {
                const startTime = Date.now();
                while (Date.now() - startTime < 10000) {
                    if (window.ApiClient._serverVersion) {
                        break;
                    }
                    await new Promise(resolve => setTimeout(resolve, 500));
                }
            }

            cachedJellyfinMajorVersion = getMajorServerVersion(window.ApiClient._serverVersion);
            return cachedJellyfinMajorVersion;
        } catch (error) {
            console.warn('[KefinTweaks Injector] Error getting server version:', error);
            return null;
        }
    }

    function isScriptCompatible(scriptDef, majorVersion) {
        if (!scriptDef?.versions || !scriptDef.versions.length) return true;
        if (majorVersion == null) return false;
        return scriptDef.versions.includes(majorVersion);
    }

    function syncCachedMajorOnApi(majorVersion) {
        if (window.KefinTweaks) {
            window.KefinTweaks._jellyfinMajorVersion = majorVersion;
        }
    }
    
    /**
     * Extracts version string from root URL
     * @param {string} root - The root URL (e.g., "https://cdn.jsdelivr.net/gh/ranaldsgift/KefinTweaks@v0.3.3/")
     * @returns {string} Version string (e.g., "0.3.3", "latest", "development", or commit hash)
     */
    function extractVersionFromRoot(root) {
        if (!root) {
            return "Pending Install"; // Fallback
        }
        
        // Match version patterns: @commitHash, @latest, @main, @experimental, or @v0.3.3
        // Note: check for hash first to avoid partial numeric matches (e.g. hash starting with digits)
        const versionMatch = root.match(/@([a-f0-9]{7,}|latest|main|experimental|v?[\d.]+)/i);
        
        if (versionMatch) {
            const version = versionMatch[1];
            
            // Handle version tags (v0.3.3 -> 0.3.3)
            if (version.startsWith('v') && /^\d+\.\d+\.\d+/.test(version.substring(1))) {
                return version.substring(1); // Remove 'v' prefix
            }
            
            // Handle @main -> "development"
            if (version.toLowerCase() === 'main') {
                return 'development';
            }
            
            // Handle @experimental -> "experimental"
            if (version.toLowerCase() === 'experimental') {
                return 'experimental';
            }
            
            // Handle @latest -> "latest"
            if (version.toLowerCase() === 'latest') {
                return 'latest';
            }
            
            // Handle commit hash -> show as "Dev (#hash)"
            if (/^[a-f0-9]{7,}$/i.test(version)) {
                return `Dev (#${version.substring(0, 7)})`;
            }
            
            // Return as-is for other patterns
            return version;
        }
        
        // No version found in URL, this is a custom install
        return "Custom Install";
    }
    
    // Configuration: Start with defaults, then merge user config
    // This allows new scripts to work out of the box without requiring config updates
    const ENABLED_SCRIPTS = {
        // UI and functional enhancements
        watchlist: true,          // Watchlist functionality
        homeScreen: true,         // Custom home screen sections
        search: true,             // Enhanced search functionality
        headerTabs: true,         // Header tab enhancements
        customMenuLinks: true,    // Custom menu links functionality
        hamburgerMenu: false,      // Desktop v12 hamburger / left drawer
        updoot: false,             // Upvote functionality
        backdropLeakFix: true,    // Memory leak fixes
        dashboardButtonFix: true, // Dashboard button fix
        infiniteScroll: true,     // Infinite scroll functionality
        removeContinue: true,     // Remove from continue watching functionality
        subtitleSearch: true,     // Subtitle search functionality
        playlist: true,           // Playlist view page modifications
        itemDetailsCollections: true, // Add related collections to item details pages
        flattenSingleSeasonShows: true, // Flatten series with only 1 season to show episodes directly
        seriesInfo: true,         // Add series and season information to details pages
        versionPreferences: true, // Reorder/sanitize media source versions on details pages
        collections: true,         // Collection sorting functionality
        skinManager: true,        // Skin selection and management
        thumbnailScrubber: false,  // Trickplay thumbnail scrub on hover (bottom 20px of video cards)
        watchTogether: false,      // Sync playstate to Watch Together group accounts on this device
        userManager: false,        // User templates for new/existing accounts (admin dashboard)
        games: true,               // Sidebar Games link → pages/games.html hub
        
        // Note: Core functionality scripts (utils, cardBuilder, localStorageCache, modal) 
        // are automatically enabled when needed by other scripts
        
        // Merge user config on top of defaults (allows users to override defaults)
        ...window.KefinTweaksConfig?.scripts
    };

    // Third-party libraries. Relative paths load from {kefinTweaksRoot}/scripts/; http(s) URLs use the CDN loaders.
    const THIRD_PARTY_SCRIPTS = {
        pickr: {
            js: [
                'thirdparty/pickr/pickr.min.js'
            ],
            css: [
                'thirdparty/pickr/pickr-nano.min.css'
            ]
        },
        chartjs: {
            js: [
                'thirdparty/chartjs/chart.js'
            ],
            css: []
        }
    };
    
    // Script definitions with dependencies and metadata
    const SCRIPT_DEFINITIONS = [
        {
            name: 'utils',
            script: 'utils.js',
            css: null,
            dependencies: [],
            description: 'Common utilities for page view management and MutationObserver conversion'
        },
        {
            name: 'skinConfigLegacyDefaults',
            script: 'skinConfig-0.3.5-defaults.js',
            css: null,
            dependencies: [],
            description: 'Legacy skin defaults (v0.3.5) for duplicate detection'
        },
        {
            name: 'skinConfig',
            script: 'skinConfig.js',
            css: null,
            dependencies: [],
            description: 'Default skin configuration for KefinTweaks'
        },
        {
            name: 'ui',
            script: 'ui.js',
            css: null,
            dependencies: [],
            description: 'UI helper functions for KefinTweaks'
        },
        {
            name: 'homeScreenConfig',
            script: 'homeScreenConfig.js',
            css: null,
            dependencies: [],
            description: 'Default home screen configuration for KefinTweaks'
        },
        {
            name: 'homeScreenConfig2',
            script: 'homeScreenConfig2.js',
            css: null,
            dependencies: [],
            description: 'Default home screen configuration for KefinTweaks'
        },
        {
            name: 'homeScreen-migration',
            script: '../configuration/homeScreen-migration.js',
            css: null,
            dependencies: [],
            description: 'Home screen migration for KefinTweaks'
        },
        {
            name: 'homeScreen-user-configuration',
            script: '../configuration/homeScreen-user-configuration.js',
            css: null,
            dependencies: ['ui', 'utils'],
            description: 'User home screen section preferences and bulk order editor'
        },
        {
            name: 'homeScreenSectionConfigure',
            script: 'homeScreenSectionConfigure.js',
            css: null,
            dependencies: ['homeScreen-user-configuration', 'modal', 'ui', 'cardBuilder'],
            thirdParty: ['pickr'],
            description: 'Inline configure popover for user home screen sections'
        },
        {
            name: 'homeScreenPin',
            script: 'homeScreenPin.js',
            css: null,
            dependencies: ['homeScreen-user-configuration', 'modal', 'utils'],
            description: 'Pin items to the home screen from context menus'
        },
        {
            name: 'homeScreenCustomItemsEditor',
            script: '../configuration/homeScreenCustomItemsEditor.js',
            css: null,
            dependencies: [],
            description: 'Shared custom items editor (wizard + advanced)'
        },
        {
            name: 'homeScreenSectionEditor',
            script: '../configuration/homeScreenSectionEditor.js',
            css: '../configuration/homeScreenSectionEditor.css',
            dependencies: ['modal', 'toaster', 'utils', 'cardBuilder', 'ui', 'homeScreenCustomItemsEditor', 'homeScreenAdvancedEditor'],
            description: 'Home screen section editor (wizard + advanced)'
        },
        {
            name: 'homeScreenEditorProfiles',
            script: '../configuration/homeScreenEditorProfiles.js',
            css: null,
            dependencies: [],
            description: 'Editor profile registry for home screen section editor'
        },
        {
            name: 'homeScreenAdvancedEditor',
            script: '../configuration/homeScreenAdvancedEditor.js',
            css: '../configuration/homeScreenAdvancedEditor.css',
            dependencies: ['ui', 'homeScreenCustomItemsEditor', 'homeScreenEditorProfiles'],
            thirdParty: ['pickr'],
            description: 'Advanced section editor UI for custom sections'
        },
        {
            name: 'homescreenBenchmark',
            script: '../configuration/homescreenBenchmark.js',
            css: null,
            dependencies: ['apiHelper'],
            description: 'Home screen section query benchmarks for admin config'
        },
        {
            name: 'homeScreen-configuration',
            script: '../configuration/homeScreen-configuration.js',
            css: '../configuration/homeScreen-configuration.css',
            dependencies: ['modal', 'toaster', 'utils', 'cardBuilder', 'ui', 'homeScreenCustomItemsEditor', 'homeScreenSectionEditor', 'homescreenBenchmark', 'sectionHelper'],
            description: 'Home screen configuration for KefinTweaks'
        },
        {
            name: 'search-configuration',
            script: '../configuration/search-configuration.js',
            css: null,
            dependencies: ['modal', 'toaster', 'utils'],
            description: 'Search configuration for KefinTweaks'
        },
        {
            name: 'seriesEpisodes-configuration',
            script: '../configuration/seriesEpisodes-configuration.js',
            css: null,
            dependencies: ['modal', 'toaster', 'utils'],
            description: 'Series episodes configuration for KefinTweaks'
        },
        {
            name: 'seriesInfo-configuration',
            script: '../configuration/seriesInfo-configuration.js',
            css: null,
            dependencies: ['modal', 'toaster', 'utils'],
            description: 'Series info configuration for KefinTweaks'
        },
        {
            name: 'versionPreferences-configuration',
            script: '../configuration/versionPreferences-configuration.js',
            css: null,
            dependencies: ['modal', 'toaster', 'utils'],
            description: 'Item version preferences configuration for KefinTweaks'
        },
        {
            name: 'skinManager-configuration',
            script: '../configuration/skinManager-configuration.js',
            css: null,
            dependencies: ['modal', 'toaster', 'utils'],
            description: 'Skin manager configuration for KefinTweaks'
        },
        {
            name: 'customMenuLinks-configuration',
            script: '../configuration/customMenuLinks-configuration.js',
            css: null,
            dependencies: ['modal', 'toaster', 'utils'],
            description: 'Custom menu links configuration for KefinTweaks'
        },
        {
            name: 'homeScreenConfigCommunity',
            script: 'homeScreenConfig-community.js',
            css: null,
            dependencies: [],
            description: 'Community home screen sections for KefinTweaks'
        },
        {
            name: 'peopleCache',
            script: 'peopleCache.js',
            css: null,
            dependencies: ['libraryCacheUtils', 'userHelper', 'moviesCache', 'seriesCache', 'indexedDBCache', 'apiHelper'],
            description: 'People cache for KefinTweaks'
        },
        {
            name: 'studiosCache',
            script: 'studiosCache.js',
            css: null,
            dependencies: [],
            description: 'Studios cache for KefinTweaks'
        },
        {
            name: 'libraryCacheUtils',
            script: 'libraryCacheUtils.js',
            css: null,
            dependencies: [],
            description: 'Shared strip/provider helpers for library caches'
        },
        {
            name: 'moviesCache',
            script: 'moviesCache.js',
            css: null,
            dependencies: ['libraryCacheUtils', 'userHelper', 'indexedDBCache', 'apiHelper'],
            description: 'Movies library cache for KefinTweaks'
        },
        {
            name: 'seriesCache',
            script: 'seriesCache.js',
            css: null,
            dependencies: ['libraryCacheUtils', 'userHelper', 'indexedDBCache', 'apiHelper'],
            description: 'Series library cache for KefinTweaks'
        },
        {
            name: 'libraryCache',
            script: 'libraryCache.js',
            css: null,
            dependencies: ['moviesCache', 'seriesCache'],
            description: 'Library cache facade for KefinTweaks'
        },
        {
            name: 'skinManager',
            script: 'skinManager.js',
            css: 'defaultSkin.css',
            dependencies: ['utils', 'skinConfigLegacyDefaults', 'skinConfig', 'modal'],
            priority: true, // Load immediately after dependencies to reduce UI disruption
            description: 'Adds skin selection dropdown to display preferences page and manages skin CSS loading'
        },
        {
            name: 'apiHelper',
            script: 'apiHelper.js',
            css: null,
            dependencies: ['dataHelper'],
            description: 'API helper functions for common Jellyfin operations'
        },
        {
            name: 'sectionHelper',
            script: 'sectionHelper.js',
            css: null,
            dependencies: ['apiHelper', 'cardBuilder', 'peopleCache', 'studiosCache', 'moviesCache', 'seriesCache', 'libraryCache', 'homeScreenConfig2', 'dataHelper'],
            description: 'Section loading and progressive discovery resolve helpers'
        },
        {
            name: 'cardBuilder',
            script: 'cardBuilder.js',
            css: 'cardBuilder.css',
            dependencies: ['apiHelper', 'userHelper'],
            description: 'Core card building functionality (required by other scripts)'
        },
        {
            name: 'localStorageCache',
            script: 'localStorageCache.js',
            css: null,
            dependencies: [],
            description: 'localStorage-based caching layer with 24-hour TTL and manual refresh'
        },
        {
            name: 'indexedDBCache',
            script: 'indexedDBCache.js',
            css: null,
            dependencies: [],
            description: 'IndexedDB-based caching layer for large datasets with TTL support'
        },
        {
            name: 'modal',
            script: 'modal.js',
            css: 'modal.css',
            dependencies: [],
            description: 'Generic modal system for Jellyfin-style dialogs'
        },
        {
            name: 'userHelper',
            script: 'userHelper.js',
            css: null,
            dependencies: [],
            description: 'User helper functions for Jellyfin operations'
        },
        {
            name: 'dataHelper',
            script: '../helpers/dataHelper.js',
            css: null,
            dependencies: [],
            description: 'Data helper functions for Jellyfin operations'
        },
        {
            name: 'websocketHelper',
            script: '../helpers/websocketHelper.js',
            css: null,
            dependencies: [],
            description: 'WebSocket helper functions for Jellyfin operations'
        },
        {
            name: 'watchTogether-configuration',
            script: '../configuration/watchTogether-configuration.js',
            css: null,
            dependencies: ['modal', 'ui'],
            description: 'Configuration UI for Watch Together'
        },
        {
            name: 'watchTogether',
            script: 'watchTogether.js',
            css: null,
            dependencies: ['utils', 'modal', 'apiHelper', 'userHelper', 'websocketHelper', 'ui', 'watchTogether-configuration'],
            description: 'Watch Together: sync watched/in-progress state to selected group accounts'
        },
        {
            name: 'userManager-configuration',
            script: '../configuration/userManager-configuration.js',
            css: null,
            dependencies: ['modal', 'toaster', 'utils', 'apiHelper', 'ui'],
            description: 'Configuration UI for User Manager templates'
        },
        {
            name: 'userManager',
            script: 'userManager.js',
            css: 'userManager.css',
            dependencies: ['utils', 'modal', 'apiHelper', 'userHelper', 'toaster', 'userManager-configuration'],
            description: 'User Manager: apply policy templates on new user creation and bulk-edit existing users'
        },
        {
            name: 'toaster',
            script: 'toaster.js',
            css: null,
            dependencies: [],
            description: 'Toast notification system using Jellyfin\'s existing toast functionality'
        },
        {
            name: 'statistics',
            script: 'statistics.js',
            css: null,
            dependencies: [],
            description: 'Watchlist statistics charts and activity analytics'
        },
        {
            name: 'watchlist',
            script: 'watchlist.js',
            css: 'watchlist.css',
            dependencies: ['cardBuilder', 'localStorageCache', 'modal', 'utils', 'statistics'],
            thirdParty: ['chartjs'],
            description: 'Adds watchlist functionality throughout Jellyfin interface'
        },
        {
            name: 'homeScreen',
            script: 'homeScreen3.js',
            css: 'homeScreen.css',
            dependencies: ['cardBuilder', 'localStorageCache', 'utils', 'userHelper', 'homeScreenConfig2', 'homeScreen-configuration', 'peopleCache', 'studiosCache', 'moviesCache', 'seriesCache', 'libraryCache', 'libraryCacheUtils', 'indexedDBCache', 'homeScreenConfigCommunity', 'dataHelper', 'apiHelper', 'sectionHelper', 'homeScreen-migration', 'homeScreen-user-configuration', 'homeScreenSectionConfigure', 'homeScreenPin'],
            priority: true, // Load immediately after dependencies to reduce UI disruption
            description: 'Adds custom home screen sections'
        },
        {
            name: 'search',
            script: 'search.js',
            css: 'search.css',
            dependencies: ['cardBuilder', 'utils'],
            description: 'Enhanced search functionality'
        },
        {
            name: 'headerTabs',
            script: 'headerTabs.js',
            css: null,
            dependencies: [],
            description: 'Header tab improvements'
        },
        {
            name: 'customMenuLinks',
            script: 'customMenuLinks.js',
            css: null,
            dependencies: ['utils'],
            description: 'Load and add custom menu links from configuration'
        },
        {
            name: 'hamburgerMenu',
            script: 'hamburgerMenu.js',
            css: null,
            dependencies: ['utils'],
            versions: [12],
            description: 'Desktop hamburger button that opens a v12-style left navigation drawer'
        },
        {
            name: 'games',
            script: 'games.js',
            css: null,
            dependencies: ['utils'],
            description: 'Adds a Games sidebar link to the games hub page'
        },
        {
            name: 'backdropLeakFix',
            script: 'backdropLeakFix.js',
            css: null,
            dependencies: [],
            versions: [10, 11],
            description: 'Fixes issue that causes backdrop images to be continuously added to the page if the tab isn\'t focused.'
        },
        {
            name: 'updoot',
            script: 'updoot.js',
            css: null,
            dependencies: [],
            description: 'Upvote functionality provided by https://github.com/BobHasNoSoul/jellyfin-updoot'
        },
        {
            name: 'dashboardButtonFix',
            script: 'dashboardButtonFix.js',
            css: null,
            dependencies: [],
            versions: [10, 11],
            description: 'Fixes the dashboard button to redirect to the home page when the back button is clicked and there is no history to go back to'
        },
        {
            name: 'thumbnailScrubber-configuration',
            script: '../configuration/thumbnailScrubber-configuration.js',
            css: null,
            dependencies: ['modal', 'toaster', 'utils'],
            description: 'Thumbnail scrubber configuration for KefinTweaks'
        },
        {
            name: 'thumbnailScrubber',
            script: 'thumbnailScrubber.js',
            css: null,
            dependencies: ['thumbnailScrubber-configuration'],
            description: 'Shows trickplay thumbnail preview when hovering in the bottom 20px of a video card for 2+ seconds'
        },
        {
            name: 'infiniteScroll',
            script: 'infiniteScroll.js',
            css: null,
            dependencies: ['cardBuilder'],
            description: 'Adds infinite scroll functionality to media library pages'
        },
        {
            name: 'removeContinue',
            script: 'removeContinue.js',
            css: null,
            dependencies: [],
            description: 'Adds remove from continue watching functionality to cards with data-position-ticks'
        },
        {
            name: 'subtitleSearch',
            script: 'subtitleSearch.js',
            css: 'subtitleSearch.css',
            dependencies: ['toaster'],
            description: 'Adds subtitle search functionality to the video OSD, allowing users to search and download subtitles from remote sources'
        },
        {
            name: 'breadcrumbs',
            script: 'breadcrumbs.js',
            css: 'breadcrumbNav.css',
            dependencies: ['utils'],
            description: 'Adds breadcrumb navigation to item detail pages for Movies, Series, Seasons, Episodes, Music Artists, and Music Albums'
        },
        {
            name: 'playlist',
            script: 'playlist.js',
            css: null,
            dependencies: ['cardBuilder', 'utils', 'modal'],
            description: 'Modifies playlist view page behavior to navigate to item details instead of playing, adds play button to playlist items, and adds sorting functionality'
        },
        {
            name: 'itemDetailsCollections',
            script: 'itemDetailsCollections.js',
            css: null,
            dependencies: ['indexedDBCache', 'utils', 'cardBuilder'],
            versions: [10, 11],
            description: 'Adds related collections to item details pages showing which collections contain the current item'
        },
        {
            name: 'flattenSingleSeasonShows',
            script: 'seriesEpisodes.js',
            css: 'seriesEpisodes.css',
            dependencies: ['cardBuilder', 'utils'],
            description: 'Displays episodes directly on series page with season selection. Works for both single and multi-season shows when enabled.'
        },
        {
            name: 'seriesInfo',
            script: 'seriesInfo.js',
            css: null,
            dependencies: ['utils'],
            description: 'Adds series and season information (seasons count, episodes count, end time) to details pages'
        },
        {
            name: 'versionPreferences',
            script: 'versionPreferences.js',
            css: null,
            dependencies: ['utils'],
            description: 'Reorders and sanitizes media source version/edition options on item details pages'
        },
        {
            name: 'collections',
            script: 'collections.js',
            css: null,
            dependencies: ['utils', 'modal'],
            description: 'Adds sorting functionality to collection pages'
        },
    ];

    // Use this for development
    const urlSuffix = '';
    //const urlSuffix = `?v=${new Date().getTime()}`;

    // Inject dashboard drawer version badge CSS using dynamic version number
    async function injectVersionBadgeCSS() {
        const styleId = 'kefinTweaks-version-css';
        if (document.getElementById(styleId)) return;
        
        // Get version from root URL in config
        let displayVersion = "";
        try {
            const configRoot = window.KefinTweaksConfig?.kefinTweaksRoot || '';
            if (configRoot) {
                // Resolve the root to get the actual version (if @latest or @main)
                const resolvedRoot = await resolveRootVersion(configRoot);
                displayVersion = extractVersionFromRoot(resolvedRoot);
            }
        } catch (error) {
            console.warn('[KefinTweaks Injector] Could not extract version, using fallback:', error);
        }
        
        // Format version for display (add 'v' prefix if it's a version number, not for 'latest' or 'development')
        let versionDisplay = displayVersion;
        if (!displayVersion.startsWith('v') && 
            !displayVersion.includes('latest') && 
            !displayVersion.includes('development') &&
            /^\d+\.\d+/.test(displayVersion)) {
            versionDisplay = 'v' + displayVersion;
        }
        
        const style = document.createElement('style');
        style.id = styleId;
/*         style.textContent = `
            body:not(:has(.libraryPage:not(.hide))) .MuiPaper-root.MuiDrawer-paperAnchorLeft::after {
                content: 'KefinTweaks ${versionDisplay}';
                font-style: italic;
                text-align: center;
                margin-top: 10px;
                color: #b7b7b7;
                font-size: 0.9em;
                display: block;
            }
            `;
        document.head.appendChild(style); */
    }

    // Auto-enable dependencies for enabled scripts (iteratively to handle transitive dependencies)
    function autoEnableDependencies() {
        let hasChanges = false;
        let maxIterations = 10; // Prevent infinite loops
        let iterations = 0;
        
        // Keep running until no more dependencies need to be enabled
        while (iterations < maxIterations) {
            let iterationChanges = false;
            
            SCRIPT_DEFINITIONS.forEach(script => {
                if (ENABLED_SCRIPTS[script.name]) {
                    script.dependencies.forEach(dep => {
                        if (!ENABLED_SCRIPTS[dep]) {
                            ENABLED_SCRIPTS[dep] = true;
                            iterationChanges = true;
                            hasChanges = true;
                            console.log(`[KefinTweaks Injector] Auto-enabled dependency '${dep}' for '${script.name}'`);
                        }
                    });
                }
            });
            
            if (!iterationChanges) {
                break; // No more dependencies to enable
            }
            
            iterations++;
        }
        
        if (iterations >= maxIterations) {
            console.warn('[KefinTweaks Injector] Reached max iterations while auto-enabling dependencies');
        }
        
        return hasChanges;
    }
    
    // Configuration validation
    function validateConfiguration() {
        const errors = [];
        
        // Auto-enable dependencies first
        const dependenciesEnabled = autoEnableDependencies();
        if (dependenciesEnabled) {
            console.log('[KefinTweaks Injector] Auto-enabled required dependencies');
        }
        
        // Check dependencies - only validate if the script is enabled
        SCRIPT_DEFINITIONS.forEach(script => {
            if (ENABLED_SCRIPTS[script.name]) {
                script.dependencies.forEach(dep => {
                    if (!ENABLED_SCRIPTS[dep]) {
                        errors.push(`Script '${script.name}' requires '${dep}' to be enabled`);
                    }
                });
            }
        });
        
        if (errors.length > 0) {
            console.error('[KefinTweaks Injector] Configuration errors:', errors);
            return false;
        }
        
        return true;
    }
    
    // Resolve @latest, @main, or @experimental to actual version/commit hash (so user always loads latest from that ref)
    async function resolveRootVersion(root) {
        // Check if root contains @latest, @main, or @experimental
        const latestMatch = root.match(/@latest(\/|$)/);
        const mainMatch = root.match(/@main(\/|$)/);
        const experimentalMatch = root.match(/@experimental(\/|$)/);
        
        if (latestMatch) {
            // Fetch the latest release version number
            try {
                const response = await fetch('https://api.github.com/repos/ranaldsgift/KefinTweaks/releases/latest');
                if (response.ok) {
                    const data = await response.json();
                    if (data && data.tag_name) {
                        const versionTag = data.tag_name.startsWith('v') ? data.tag_name : 'v' + data.tag_name;
                        return root.replace('@latest', `@${versionTag}`);
                    } else {
                        console.warn('[KefinTweaks Injector] Could not fetch latest version, using @latest');
                        return root;
                    }
                } else {
                    console.warn('[KefinTweaks Injector] Failed to fetch latest version, using @latest');
                    return root;
                }
            } catch (error) {
                console.warn('[KefinTweaks Injector] Error fetching latest version:', error);
                return root;
            }
        } else if (mainMatch) {
            // Fetch the latest commit hash from the main branch
            try {
                const response = await fetch('https://api.github.com/repos/ranaldsgift/KefinTweaks/commits/main');
                if (response.ok) {
                    const commit = await response.json();
                    if (commit && commit.sha) {
                        return root.replace('@main', `@${commit.sha}`);
                    } else {
                        console.warn('[KefinTweaks Injector] Could not fetch commit hash, using @main');
                        return root;
                    }
                } else {
                    console.warn('[KefinTweaks Injector] Failed to fetch commit hash, using @main');
                    return root;
                }
            } catch (error) {
                console.warn('[KefinTweaks Injector] Error fetching commit hash:', error);
                return root;
            }
        } else if (experimentalMatch) {
            // Fetch the latest commit hash from the experimental branch
            try {
                const response = await fetch('https://api.github.com/repos/ranaldsgift/KefinTweaks/commits/experimental');
                if (response.ok) {
                    const commit = await response.json();
                    if (commit && commit.sha) {
                        return root.replace('@experimental', `@${commit.sha}`);
                    } else {
                        console.warn('[KefinTweaks Injector] Could not fetch experimental commit hash, using @experimental');
                        return root;
                    }
                } else {
                    console.warn('[KefinTweaks Injector] Failed to fetch experimental commit hash, using @experimental');
                    return root;
                }
            } catch (error) {
                console.warn('[KefinTweaks Injector] Error fetching experimental commit hash:', error);
                return root;
            }
        }
        
        // No resolution needed
        return root;
    }
    
    // Get the root path for scripts from configuration
    async function getScriptRoot() {
        const kefinTweaksRoot = window.KefinTweaksConfig?.kefinTweaksRoot;
        
        // If kefinTweaksRoot is not set or empty, return null (scripts should not load)
        if (!kefinTweaksRoot || kefinTweaksRoot === '') {
            console.warn('[KefinTweaks Injector] kefinTweaksRoot is not configured');
            return null;
        }
        
        // Ensure root ends with /
        let root = kefinTweaksRoot.endsWith('/') ? kefinTweaksRoot : kefinTweaksRoot + '/';
        
        // Resolve @latest, @main, or @experimental if needed (with caching)
        if (resolvedRootCache === null) {
            root = await resolveRootVersion(root);
            resolvedRootCache = root;
        } else {
            root = resolvedRootCache;
        }
        
        // Return scripts path
        return root + 'scripts/';
    }
    
    // Load a CSS file
    async function loadCSS(filename) {
        return new Promise(async (resolve, reject) => {
            const scriptRoot = await getScriptRoot();
            if (!scriptRoot) {
                reject(new Error('kefinTweaksRoot is not configured'));
                return;
            }
            
            // Check if CSS is already loaded (match by root and filename, ignore suffix)
            const existingLink = document.querySelector(`link[href*="${scriptRoot}${filename}"]`);
            if (existingLink) {
                console.log(`[KefinTweaks Injector] CSS already loaded: ${filename}`);
                resolve();
                return;
            }
            
            const link = document.createElement('link');
            link.rel = 'stylesheet';
            link.type = 'text/css';
            link.href = `${scriptRoot}${filename}${urlSuffix}`;
            
            link.onload = () => {
                console.log(`[KefinTweaks Injector] CSS loaded: ${filename}`);
                resolve();
            };
            
            link.onerror = () => {
                console.warn(`[KefinTweaks Injector] Failed to load CSS: ${filename}`);
                reject(new Error(`Failed to load CSS: ${filename}`));
            };
            
            document.head.appendChild(link);
        });
    }
    
    // Load a JavaScript file
    async function loadScript(filename) {
        return new Promise(async (resolve, reject) => {
            const scriptRoot = await getScriptRoot();
            if (!scriptRoot) {
                reject(new Error('kefinTweaksRoot is not configured'));
                return;
            }
            
            // Check if script is already loaded
            const existingScript = document.querySelector(`script[src*="${scriptRoot}${filename}"]`);
            if (existingScript) {
                console.log(`[KefinTweaks Injector] Script already loaded: ${filename}`);
                resolve();
                return;
            }
            
            const script = document.createElement('script');
            script.src = `${scriptRoot}${filename}${urlSuffix}`;
            script.async = true;
            
            script.onload = () => {
                console.log(`[KefinTweaks Injector] Script loaded: ${filename}`);
                resolve();
            };
            
            script.onerror = () => {
                console.error(`[KefinTweaks Injector] Failed to load script: ${filename}`);
                reject(new Error(`Failed to load script: ${filename}`));
            };
            
            document.head.appendChild(script);
        });
    }

    /**
     * Load an absolute-URL stylesheet (CDN / third-party). Dedupes via DOM.
     * @param {string} url
     */
    async function loadExternalCSS(url) {
        return new Promise((resolve, reject) => {
            if (!url) {
                resolve();
                return;
            }
            const existingLink = document.querySelector(`link[href="${url}"]`);
            if (existingLink) {
                console.log(`[KefinTweaks Injector] External CSS already loaded: ${url}`);
                resolve();
                return;
            }

            const link = document.createElement('link');
            link.rel = 'stylesheet';
            link.type = 'text/css';
            link.href = url;

            link.onload = () => {
                console.log(`[KefinTweaks Injector] External CSS loaded: ${url}`);
                resolve();
            };
            link.onerror = () => {
                console.warn(`[KefinTweaks Injector] Failed to load external CSS: ${url}`);
                reject(new Error(`Failed to load external CSS: ${url}`));
            };

            document.head.appendChild(link);
        });
    }

    /**
     * Load an absolute-URL script (CDN / third-party). Dedupes via DOM.
     * @param {string} url
     */
    async function loadExternalScript(url) {
        return new Promise((resolve, reject) => {
            if (!url) {
                resolve();
                return;
            }
            const existingScript = document.querySelector(`script[src="${url}"]`);
            if (existingScript) {
                console.log(`[KefinTweaks Injector] External script already loaded: ${url}`);
                resolve();
                return;
            }

            const script = document.createElement('script');
            script.src = url;
            script.async = true;

            script.onload = () => {
                console.log(`[KefinTweaks Injector] External script loaded: ${url}`);
                resolve();
            };
            script.onerror = () => {
                console.error(`[KefinTweaks Injector] Failed to load external script: ${url}`);
                reject(new Error(`Failed to load external script: ${url}`));
            };

            document.head.appendChild(script);
        });
    }

    function isAbsoluteUrl(url) {
        return /^https?:\/\//i.test(url);
    }

    /**
     * Load a named third-party library from THIRD_PARTY_SCRIPTS (css then js).
     * Relative paths load from the script root; http(s) URLs use the external loaders.
     * @param {string} name
     */
    async function loadThirdParty(name) {
        const def = THIRD_PARTY_SCRIPTS[name];
        if (!def) {
            console.warn(`[KefinTweaks Injector] Unknown thirdParty '${name}' — skipping`);
            return;
        }

        const cssUrls = Array.isArray(def.css) ? def.css : [];
        const jsUrls = Array.isArray(def.js) ? def.js : [];

        for (const url of cssUrls) {
            try {
                if (isAbsoluteUrl(url)) {
                    await loadExternalCSS(url);
                } else {
                    await loadCSS(url);
                }
            } catch (error) {
                console.warn(`[KefinTweaks Injector] Third-party CSS failed for '${name}':`, error);
            }
        }
        for (const url of jsUrls) {
            try {
                if (isAbsoluteUrl(url)) {
                    await loadExternalScript(url);
                } else {
                    await loadScript(url);
                }
            } catch (error) {
                console.warn(`[KefinTweaks Injector] Third-party script failed for '${name}':`, error);
            }
        }
    }
    
    // Recursively collect all dependencies for a given script
    function collectAllDependencies(scriptDef, collected = new Set(), visited = new Set()) {
        // Avoid infinite recursion
        if (visited.has(scriptDef.name)) {
            return collected;
        }
        visited.add(scriptDef.name);
        
        // For each dependency
        for (const depName of scriptDef.dependencies) {
            // Only process enabled dependencies
            if (!ENABLED_SCRIPTS[depName]) {
                continue;
            }
            
            const depScript = SCRIPT_DEFINITIONS.find(s => s.name === depName);
            if (!depScript) {
                continue;
            }
            
            // Add to collected if we haven't already
            if (!collected.has(depScript.name)) {
                collected.add(depScript.name);
                // Recursively collect this dependency's dependencies
                collectAllDependencies(depScript, collected, visited);
            }
        }
        
        return collected;
    }
    
    // Load a single script (assumes dependencies are already loaded)
    async function loadScriptSync(scriptDef) {
        const scriptRoot = await getScriptRoot();
        if (!scriptRoot) {
            throw new Error('kefinTweaksRoot is not configured');
        }

        for (const thirdPartyName of scriptDef.thirdParty || []) {
            await loadThirdParty(thirdPartyName);
        }
        
        // Check if already loaded (match by root and filename, ignore suffix)
        const isAlreadyLoaded = document.querySelector(`script[src*="${scriptRoot}${scriptDef.script}"]`);
        if (isAlreadyLoaded) {
            console.log(`[KefinTweaks Injector] Script already loaded: ${scriptDef.name}`);
            return;
        }
        
        // Load CSS if specified
        if (scriptDef.css) {
            await loadCSS(scriptDef.css);
        }
        
        // Load the script
        await loadScript(scriptDef.script);
        
        console.log(`[KefinTweaks Injector] Successfully loaded: ${scriptDef.name}`);
    }


    async function ensureKefinTweaksLoader(scriptRoot) {
        if (window.KefinTweaksLoader) return window.KefinTweaksLoader;
        const base = scriptRoot.endsWith('/') ? scriptRoot : scriptRoot + '/';
        const url = base + 'kefinTweaks-loader.js';
        await new Promise((resolve, reject) => {
            if (document.querySelector('script[src="' + url + '"]')) {
                const start = Date.now();
                const wait = () => {
                    if (window.KefinTweaksLoader) return resolve();
                    if (Date.now() - start > 15000) return reject(new Error('Timed out waiting for KefinTweaksLoader'));
                    setTimeout(wait, 50);
                };
                return wait();
            }
            const script = document.createElement('script');
            script.src = url;
            script.async = false;
            script.onload = () => resolve();
            script.onerror = () => reject(new Error('Failed to load kefinTweaks-loader.js'));
            document.head.appendChild(script);
        });
        if (!window.KefinTweaksLoader) throw new Error('KefinTweaksLoader not available');
        return window.KefinTweaksLoader;
    }

    async function loadConfigurationJS() {
        const configDependencyNames = ['modal', 'toaster', 'utils', 'homeScreenConfig2', 'ui', 'homeScreen-migration', 'homeScreen-configuration', 'search-configuration', 'seriesEpisodes-configuration', 'seriesInfo-configuration', 'versionPreferences-configuration', 'skinManager-configuration', 'customMenuLinks-configuration', 'thumbnailScrubber-configuration', 'watchTogether-configuration', 'userManager-configuration', 'apiHelper', 'sectionHelper'];
        for (const depName of configDependencyNames) {
            const depScript = SCRIPT_DEFINITIONS.find(script => script.name === depName);
            if (depScript) {
                try {
                    await loadScriptSync(depScript);
                } catch (error) {
                    console.warn(`[KefinTweaks Injector] Failed to load configuration dependency '${depName}':`, error);
                }
            }
        }
        
        // Load configuration UI so admins can re-enable KefinTweaks
        await loadScript('configuration.js');
        await loadCSS('configuration.css');
    }
    
    // Main initialization: live load plan (fills gaps vs baked preload) + stamp sync
    async function initialize() {
        console.log('[KefinTweaks Injector] Starting KefinTweaks initialization...');

        const scriptRoot = await getScriptRoot();
        if (!scriptRoot) {
            console.log('[KefinTweaks Injector] kefinTweaksRoot is not configured. Please configure KefinTweaks using the installer before scripts can be loaded.');
            return;
        }

        let Loader;
        try {
            Loader = await ensureKefinTweaksLoader(scriptRoot);
        } catch (err) {
            console.error('[KefinTweaks Injector] Failed to load kefinTweaks-loader.js:', err);
            return;
        }

        Loader.ensureKefinTweaksApi(Loader.SCRIPT_DEFINITIONS);
        const majorVersion = await window.KefinTweaks.getJellyfinMajorVersion();
        console.log('[KefinTweaks Injector] Jellyfin major version:', majorVersion ?? 'unknown');

        const config = window.KefinTweaksConfig || {};
        const root = Loader.getResolvedKefinRoot
            ? Loader.getResolvedKefinRoot(config)
            : Loader.normalizeRoot(config.kefinTweaksRoot || '');

        try {
            const plan = Loader.buildLoadPlan(config, majorVersion, {
                root,
                urlSuffix,
                configOnly: config.enabled === false
            });
            console.log('[KefinTweaks Injector] Applying ordered assets:', plan.assets.length, 'stamp=', plan.stamp);
            // Dedupe against tags already injected by baked KefinTweaks-injector
            Loader.applyAssetsToDocument(plan.assets);
            document.dispatchEvent(new CustomEvent('kefinTweaksLoaded', {
                detail: {
                    loadedScripts: plan.scriptNames,
                    stamp: plan.stamp,
                    timestamp: new Date().toISOString(),
                    live: true
                }
            }));
            console.log('[KefinTweaks Injector] Live ordered inject complete');

            if (typeof Loader.syncKefinTweaksInjector === 'function') {
                const syncResult = await Loader.syncKefinTweaksInjector(plan);
                if (syncResult?.synced) {
                    console.log('[KefinTweaks Injector] Baked KefinTweaks-injector synced to stamp:', syncResult.stamp);
                } else if (syncResult?.reason && syncResult.reason !== 'stamp match' && syncResult.reason !== 'not admin' && syncResult.reason !== 'not logged in') {
                    console.warn('[KefinTweaks Injector] Injector sync skipped:', syncResult.reason);
                } else {
                    console.log('[KefinTweaks Injector] Injector sync:', syncResult?.reason || 'done');
                }
            }
        } catch (error) {
            console.error('[KefinTweaks Injector] Error during initialization:', error);
        }
    }


    // Utility functions for debugging and configuration
    // Populated in initialize via KefinTweaksLoader.ensureKefinTweaksApi; stub for early callers
    window.KefinTweaks = window.KefinTweaks || {
        _jellyfinMajorVersion: null,
        parseMajorVersion: function (version) {
            if (!version || typeof version !== 'string') return null;
            const versionParts = version.split('.');
            if (versionParts[0] !== '10') {
                const majorVersion = parseInt(versionParts[0], 10);
                return Number.isNaN(majorVersion) ? null : majorVersion;
            }
            if (versionParts.length >= 2) {
                const majorVersion = parseInt(versionParts[1], 10);
                if (!Number.isNaN(majorVersion)) return majorVersion;
            }
            return null;
        },
        getJellyfinMajorVersion: async function () {
            if (window.KefinTweaksLoader) {
                window.KefinTweaksLoader.ensureKefinTweaksApi();
                return window.KefinTweaks.getJellyfinMajorVersion();
            }
            return this._jellyfinMajorVersion;
        },
        getScripts: function () {
            return (window.KefinTweaksLoader && window.KefinTweaksLoader.SCRIPT_DEFINITIONS)
                ? window.KefinTweaksLoader.SCRIPT_DEFINITIONS.slice()
                : (typeof SCRIPT_DEFINITIONS !== 'undefined' ? SCRIPT_DEFINITIONS.slice() : []);
        },
        reload: function () { initialize(); }
    };

    // Check if user is admin (with timeout for login)
    async function checkAdminWithTimeout(maxWaitMs = 5000) {
        const startTime = Date.now();
        const checkInterval = 100; // Check every 100ms
        
        return new Promise((resolve) => {
            const checkAdmin = async () => {
                try {
                    if (window.ApiClient && window.ApiClient.getCurrentUser) {
                        const user = await window.ApiClient.getCurrentUser();
                        if (user && user.Policy && user.Policy.IsAdministrator === true) {
                            console.log('[KefinTweaks Startup] User is admin');
                            resolve(true);
                            return;
                        }
                        // User is logged in but not admin
                        if (user) {
                            console.log('[KefinTweaks Startup] User is not admin');
                            resolve(false);
                            return;
                        }
                    }
                } catch (error) {
                    // User might not be logged in yet, continue waiting
                }
                
                // Check if we've exceeded max wait time
                if (Date.now() - startTime >= maxWaitMs) {
                    console.log('[KefinTweaks Startup] Timeout waiting for user login');
                    resolve(false);
                    return;
                }
                
                // Continue checking
                setTimeout(checkAdmin, checkInterval);
            };
            
            checkAdmin();
        });
    }

    // Find plugin by name
    async function findPlugin(pluginName) {
        try {
            if (!window.ApiClient || !window.ApiClient._serverAddress || !window.ApiClient.accessToken) {
                throw new Error('ApiClient not available');
            }

            const server = ApiClient._serverAddress;
            const token = ApiClient.accessToken();

            const response = await fetch(`${server}/Plugins`, {
                headers: {
                    'Authorization': window.apiHelper.getAuthHeader()
                }
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const plugins = await response.json();
            const pluginsList = Array.isArray(plugins) ? plugins : (plugins.Items || []);
            
            const plugin = pluginsList.find(p => p.Name === pluginName);
            return plugin ? plugin.Id : null;
        } catch (error) {
            console.error(`[KefinTweaks Startup] Error finding plugin ${pluginName}:`, error);
            return null;
        }
    }

    // Get plugin configuration
    async function getPluginConfig(pluginId) {
        try {
            if (!window.ApiClient || !window.ApiClient._serverAddress || !window.ApiClient.accessToken) {
                throw new Error('ApiClient not available');
            }

            const server = ApiClient._serverAddress;
            const token = ApiClient.accessToken();

            const response = await fetch(`${server}/Plugins/${pluginId}/Configuration`, {
                headers: {
                    'Authorization': window.apiHelper.getAuthHeader()
                }
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            return await response.json();
        } catch (error) {
            console.error('[KefinTweaks Startup] Error getting plugin config:', error);
            throw error;
        }
    }

    // Save plugin configuration
    async function savePluginConfig(pluginId, config) {
        try {
            if (!window.ApiClient || !window.ApiClient._serverAddress || !window.ApiClient.accessToken) {
                throw new Error('ApiClient not available');
            }

            const server = ApiClient._serverAddress;
            const token = ApiClient.accessToken();

            const response = await fetch(`${server}/Plugins/${pluginId}/Configuration`, {
                method: 'POST',
                headers: {
                    'Authorization': window.apiHelper.getAuthHeader(),
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(config)
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            return true;
        } catch (error) {
            console.error('[KefinTweaks Startup] Error saving plugin config:', error);
            throw error;
        }
    }


    // Ensure Watchlist tab exists in CustomTabs
    // Kept unused for now — Watchlist is hosted via addCustomPage('#/watchlist').
    async function ensureWatchlistTab() {
        try {
            if (!window.KefinTweaksConfig) {
                console.log('[KefinTweaks Startup] KefinTweaksConfig not found, skipping Watchlist tab check');
                return true;
            }

            // Check if Watchlist is enabled in the configuration and remove it if not
            if (!window.KefinTweaksConfig.scripts.watchlist) {
                console.log('[KefinTweaks Startup] Watchlist is disabled in configuration, removing Watchlist tab');
                const pluginId = await findPlugin('Custom Tabs');
                if (!pluginId) {
                    console.warn('[KefinTweaks Startup] CustomTabs plugin not found');
                    return false;
                }
                const config = await getPluginConfig(pluginId);

                // Filter based on the ContentHtml including div class=\"sections watchlist\"
                let tabs = config.Tabs.filter(tab => tab.ContentHtml !== '<div class="sections watchlist"></div>');

                await savePluginConfig(pluginId, { Tabs: tabs });
                console.log('[KefinTweaks Startup] Removed Watchlist tab from CustomTabs');
                return true;
            }

            console.log('[KefinTweaks Startup] Ensuring Watchlist tab exists in CustomTabs...');
            
            const pluginId = await findPlugin('Custom Tabs');
            if (!pluginId) {
                console.warn('[KefinTweaks Startup] CustomTabs plugin not found');
                return false;
            }

            // Get current CustomTabs config
            const server = ApiClient._serverAddress;
            const token = ApiClient.accessToken();
            
            const response = await fetch(`${server}/CustomTabs/Config`, {
                headers: {
                    'Authorization': window.apiHelper.getAuthHeader()
                }
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            let tabs = await response.json();
            if (!Array.isArray(tabs)) {
                tabs = [];
            }

            // Find watchlist tab by checking if the ContentHtml includes div class=\"sections watchlist\"
            const watchlistTab = tabs.find(tab => tab.ContentHtml.includes('sections watchlist'));
            
            if (watchlistTab) {
                console.log('[KefinTweaks Startup] Watchlist tab already exists with correct ContentHtml');
                return true;
            }

            // Add Watchlist tab
            tabs.push({
                Title: 'Watchlist',
                ContentHtml: '<div class="sections watchlist"></div>'
            });

            // Save updated config
            await savePluginConfig(pluginId, { Tabs: tabs });
            console.log('[KefinTweaks Startup] Added Watchlist tab to CustomTabs');
            return true;
        } catch (error) {
            console.error('[KefinTweaks Startup] Error ensuring Watchlist tab:', error);
            return false;
        }
    }

    /**
     * Remove the Watchlist Custom Tabs entry (exact ContentHtml match).
     * Watchlist is now hosted via addCustomPage('#/watchlist').
     */
    async function removeWatchlistFromCustomTabPlugin() {
        try {
            const pluginId = await findPlugin('Custom Tabs');
            if (!pluginId) {
                console.warn('[KefinTweaks Startup] CustomTabs plugin not found; nothing to remove');
                return false;
            }

            const config = await getPluginConfig(pluginId);
            const tabs = Array.isArray(config?.Tabs) ? config.Tabs : [];
            const watchlistHtml = '<div class="sections watchlist"></div>';
            const filtered = tabs.filter((tab) => tab.ContentHtml !== watchlistHtml);

            if (filtered.length === tabs.length) {
                console.log('[KefinTweaks Startup] No exact Watchlist Custom Tab to remove');
                return true;
            }

            await savePluginConfig(pluginId, { Tabs: filtered });
            console.log('[KefinTweaks Startup] Removed Watchlist tab from CustomTabs');
            return true;
        } catch (error) {
            console.error('[KefinTweaks Startup] Error removing Watchlist Custom Tab:', error);
            return false;
        }
    }

    // Startup task - runs only for admin users
    async function startupTask() {
        console.log('[KefinTweaks Startup] Starting startup task...');
        
        // Check if kefinTweaksRoot is configured - startup tasks only run after installation
        if (!window.KefinTweaksConfig?.kefinTweaksRoot || window.KefinTweaksConfig.kefinTweaksRoot === '') {
            console.log('[KefinTweaks Startup] kefinTweaksRoot is not configured, skipping startup tasks');
            return;
        }
        
        // Check if user is admin (wait up to 5s for login)
        const isAdmin = await checkAdminWithTimeout(5000);
        
        if (!isAdmin) {
            console.log('[KefinTweaks Startup] User is not admin or not logged in, skipping startup task');
            return;
        }

        try {
            // Fire-and-forget: remove leftover Watchlist Custom Tab (best-effort)
            //removeWatchlistFromCustomTabPlugin();
            
            console.log('[KefinTweaks Startup] Startup task completed successfully');
        } catch (error) {
            console.error('[KefinTweaks Startup] Error in startup task:', error);
        }
    }

    // Start initialization when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', async () => {
            await injectVersionBadgeCSS();
            initialize();
            // Run startup task after a short delay to ensure ApiClient is ready
            setTimeout(startupTask, 1000);
        });
    } else {
        (async () => {
            await injectVersionBadgeCSS();
            initialize();
            // Run startup task after a short delay to ensure ApiClient is ready
            setTimeout(startupTask, 1000);
        })();
    }
    
    console.log('[KefinTweaks Injector] Injector script loaded. Available at window.KefinTweaks');
    
})();
