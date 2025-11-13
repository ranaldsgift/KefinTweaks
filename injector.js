// KefinTweaks Script Injector
// Dynamically loads scripts and CSS files based on user configuration
// Usage: Configuration is now managed in kefinTweaks.js - this script reads from window.KefinTweaksConfig

(function() {
    'use strict';

    console.log('[KefinTweaks Injector] Initializing...');
    const versionNumber = "0.2.2";
    
    // Configuration: Start with defaults, then merge user config
    // This allows new scripts to work out of the box without requiring config updates
    const ENABLED_SCRIPTS = {
        // UI and functional enhancements
        watchlist: true,          // Watchlist functionality
        homeScreen: true,         // Custom home screen sections
        search: true,             // Enhanced search functionality
        headerTabs: true,         // Header tab enhancements
        customMenuLinks: true,    // Custom menu links functionality
        exclusiveElsewhere: true, // Exclusive elsewhere branding
        updoot: false,             // Upvote functionality
        backdropLeakFix: true,    // Memory leak fixes
        dashboardButtonFix: true, // Dashboard button fix
        infiniteScroll: true,     // Infinite scroll functionality
        removeContinue: true,     // Remove from continue watching functionality
        subtitleSearch: true,     // Subtitle search functionality
        playlist: true,           // Playlist view page modifications
        itemDetailsCollections: true, // Add related collections to item details pages
        flattenSingleSeasonShows: true, // Flatten series with only 1 season to show episodes directly
        collections: true,         // Collection sorting functionality
        skinManager: true,        // Skin selection and management
        
        // Note: Core functionality scripts (utils, cardBuilder, localStorageCache, modal) 
        // are automatically enabled when needed by other scripts
        
        // Merge user config on top of defaults (allows users to override defaults)
        ...window.KefinTweaksConfig?.scripts
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
            name: 'userConfig',
            script: 'userConfig.js',
            css: null,
            dependencies: [],
            description: 'User-specific configuration for skins and other settings'
        },
        {
            name: 'skinManager',
            script: 'skinManager.js',
            css: 'defaultSkin.css',
            dependencies: ['utils', 'userConfig'],
            priority: true, // Load immediately after dependencies to reduce UI disruption
            description: 'Adds skin selection dropdown to display preferences page and manages skin CSS loading'
        },
        {
            name: 'cardBuilder',
            script: 'cardBuilder.js',
            css: null,
            dependencies: [],
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
            name: 'toaster',
            script: 'toaster.js',
            css: null,
            dependencies: [],
            description: 'Toast notification system using Jellyfin\'s existing toast functionality'
        },
        {
            name: 'watchlist',
            script: 'watchlist.js',
            css: 'watchlist.css',
            dependencies: ['cardBuilder', 'localStorageCache', 'modal', 'utils'],
            description: 'Adds watchlist functionality throughout Jellyfin interface'
        },
        {
            name: 'homeScreen',
            script: 'homeScreen.js',
            css: 'homeScreen.css',
            dependencies: ['cardBuilder', 'localStorageCache', 'utils'],
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
            name: 'exclusiveElsewhere',
            script: 'exclusiveElsewhere.js',
            css: null,
            dependencies: [],
            description: 'Modifies the behavior of the Jellyfin Enhanced Elsewhere functionality to add custom branding when items are not available on streaming services'
        },
        {
            name: 'backdropLeakFix',
            script: 'backdropLeakFix.js',
            css: null,
            dependencies: [],
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
            description: 'Fixes the dashboard button to redirect to the home page when the back button is clicked and there is no history to go back to'
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
            dependencies: ['cardBuilder', 'utils'],
            description: 'Modifies playlist view page behavior to navigate to item details instead of playing, and adds play button to playlist items'
        },
        {
            name: 'itemDetailsCollections',
            script: 'itemDetailsCollections.js',
            css: null,
            dependencies: ['indexedDBCache', 'utils', 'cardBuilder'],
            description: 'Adds related collections to item details pages showing which collections contain the current item'
        },
        {
            name: 'flattenSingleSeasonShows',
            script: 'flattenSingleSeasonShows.js',
            css: null,
            dependencies: ['cardBuilder', 'utils'],
            description: 'Flattens series with only 1 season to show episodes directly on the series details page'
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
    //const urlSuffix = '';
    const urlSuffix = `?v=${new Date().getTime()}`;
    
    // Fetch version date from GitHub releases API
    async function fetchVersionDate(version) {
        try {
            const response = await fetch(`https://api.github.com/repos/ranaldsgift/KefinTweaks/releases/tags/v${version}`);
            if (!response.ok) {
                // Try latest release if tag doesn't exist
                const latestResponse = await fetch(`https://api.github.com/repos/ranaldsgift/KefinTweaks/releases/latest`);
                if (!latestResponse.ok) throw new Error('Failed to fetch release data');
                const data = await latestResponse.json();
                return new Date(data.published_at);
            }
            const data = await response.json();
            return new Date(data.published_at);
        } catch (error) {
            console.warn('[KefinTweaks Injector] Failed to fetch version date from GitHub:', error);
            return null;
        }
    }

    // Inject dashboard drawer version badge CSS using dynamic version number
    function injectVersionBadgeCSS() {
        const styleId = 'kefinTweaks-version-css';
        if (document.getElementById(styleId)) return;
        const style = document.createElement('style');
        style.id = styleId;
        style.textContent = `
            body:not(:has(.libraryPage:not(.hide))) .MuiPaper-root.MuiDrawer-paperAnchorLeft::after {
                content: 'KefinTweaks v${versionNumber}';
                font-style: italic;
                text-align: center;
                margin-top: 10px;
                color: #b7b7b7;
                font-size: 0.9em;
                display: block;
                cursor: help;
            }
            `;
        document.head.appendChild(style);
    }

    // Auto-enable dependencies for enabled scripts
    function autoEnableDependencies() {
        let hasChanges = false;
        
        SCRIPT_DEFINITIONS.forEach(script => {
            if (ENABLED_SCRIPTS[script.name]) {
                script.dependencies.forEach(dep => {
                    if (!ENABLED_SCRIPTS[dep]) {
                        ENABLED_SCRIPTS[dep] = true;
                        hasChanges = true;
                        console.log(`[KefinTweaks Injector] Auto-enabled dependency '${dep}' for '${script.name}'`);
                    }
                });
            }
        });
        
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
    
    // Get the root path for scripts from configuration
    function getScriptRoot() {        
        return window.KefinTweaksConfig?.scriptRoot || 'https://ranaldsgift.github.io/KefinTweaks/';
    }
    
    // Load a CSS file
    function loadCSS(filename) {
        return new Promise((resolve, reject) => {
            // Check if CSS is already loaded (match by root and filename, ignore suffix)
            const existingLink = document.querySelector(`link[href*="${getScriptRoot()}${filename}"]`);
            if (existingLink) {
                console.log(`[KefinTweaks Injector] CSS already loaded: ${filename}`);
                resolve();
                return;
            }
            
            const link = document.createElement('link');
            link.rel = 'stylesheet';
            link.type = 'text/css';
            link.href = `${getScriptRoot()}${filename}${urlSuffix}`;
            
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
    function loadScript(filename) {
        return new Promise((resolve, reject) => {
            // Check if script is already loaded
            const existingScript = document.querySelector(`script[src*="${getScriptRoot()}${filename}"]`);
            if (existingScript) {
                console.log(`[KefinTweaks Injector] Script already loaded: ${filename}`);
                resolve();
                return;
            }
            
            const script = document.createElement('script');
            script.src = `${getScriptRoot()}${filename}${urlSuffix}`;
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
        // Check if already loaded (match by root and filename, ignore suffix)
        const isAlreadyLoaded = document.querySelector(`script[src*="${getScriptRoot()}${scriptDef.script}"]`);
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
    
    // Main initialization function
    async function initialize() {
        console.log(`[KefinTweaks Injector] Starting KefinTweaks v${versionNumber} initialization...`);
        
        // Validate configuration
        if (!validateConfiguration()) {
            console.error('[KefinTweaks Injector] Configuration validation failed. Aborting.');
            return;
        }
        
        // Get enabled scripts
        const enabledScripts = SCRIPT_DEFINITIONS.filter(script => ENABLED_SCRIPTS[script.name]);
        
        // Step 1: Collect all dependencies from all enabled scripts
        const allDependencyNames = new Set();
        for (const script of enabledScripts) {
            const deps = collectAllDependencies(script);
            deps.forEach(dep => allDependencyNames.add(dep));
        }
        
        // Step 2: Separate dependencies from non-dependencies
        const dependencyScripts = SCRIPT_DEFINITIONS.filter(script => 
            allDependencyNames.has(script.name) && ENABLED_SCRIPTS[script.name]
        );
        
        const nonDependencyScripts = enabledScripts.filter(script => 
            !allDependencyNames.has(script.name)
        );
        
        // Step 2.5: Separate priority scripts from regular non-dependency scripts
        const priorityScripts = nonDependencyScripts.filter(script => script.priority === true);
        const regularScripts = nonDependencyScripts.filter(script => !script.priority);
        
        console.log(`[KefinTweaks Injector] Found ${dependencyScripts.length} dependency scripts:`, 
                   dependencyScripts.map(s => s.name));
        console.log(`[KefinTweaks Injector] Found ${priorityScripts.length} priority scripts:`, 
                   priorityScripts.map(s => s.name));
        console.log(`[KefinTweaks Injector] Found ${regularScripts.length} regular scripts:`, 
                   regularScripts.map(s => s.name));
        
        try {
            // Step 3: Load all dependencies first
            console.log('[KefinTweaks Injector] Loading dependencies first...');
            console.log(`[KefinTweaks Injector] Dependency load order:`, dependencyScripts.map(s => s.name));
            
            let dependencyLoadPromises = [];
            dependencyLoadPromises.push(...dependencyScripts.map(script => loadScriptSync(script)));
            await Promise.all(dependencyLoadPromises);
            
            // Step 4: Load priority scripts immediately after dependencies
            if (priorityScripts.length > 0) {
                console.log('[KefinTweaks Injector] Loading priority scripts...');
                console.log(`[KefinTweaks Injector] Priority load order:`, priorityScripts.map(s => s.name));
                let priorityLoadPromises = [];
                priorityLoadPromises.push(...priorityScripts.map(script => loadScriptSync(script)));
                await Promise.all(priorityLoadPromises);
            }
            
            // Step 5: Load regular non-dependencies in parallel (their dependencies are already loaded)
            let loadPromises = [];
            console.log('[KefinTweaks Injector] Loading regular non-dependencies...');
            loadPromises.push(...regularScripts.map(script => loadScriptSync(script)));
            await Promise.all(loadPromises);
            
            console.log('[KefinTweaks Injector] All scripts loaded successfully!');
            
            // Dispatch custom event when all scripts are loaded
            const event = new CustomEvent('kefinTweaksLoaded', {
                detail: {
                    loadedScripts: enabledScripts.map(s => s.name),
                    timestamp: new Date().toISOString()
                }
            });
            document.dispatchEvent(event);
            
        } catch (error) {
            console.error('[KefinTweaks Injector] Error during initialization:', error);
        }
    }
    
    // Utility functions for debugging and configuration
    window.KefinTweaks = {
        // Get current configuration
        getConfig: () => ({ ...ENABLED_SCRIPTS }),
        
        // Get script definitions
        getScripts: () => [...SCRIPT_DEFINITIONS],
        
        // Check if a script is loaded
        isScriptLoaded: (scriptName) => {
            const scriptDef = SCRIPT_DEFINITIONS.find(s => s.name === scriptName);
            if (!scriptDef) return false;
            
            const scriptElement = document.querySelector(`script[src*="${scriptDef.script}"]`);
            return !!scriptElement;
        },
        
        // Reload all scripts (useful for development)
        reload: () => {
            console.log('[KefinTweaks Injector] Reloading all scripts...');
            initialize();
        },
        
        // Load a specific script (useful for dynamic loading)
        loadScript: async (scriptName) => {
            const scriptDef = SCRIPT_DEFINITIONS.find(s => s.name === scriptName);
            if (!scriptDef) {
                throw new Error(`Script '${scriptName}' not found`);
            }
            
            if (!ENABLED_SCRIPTS[scriptName]) {
                throw new Error(`Script '${scriptName}' is disabled in configuration`);
            }
            
            await loadScriptWithDependencies(scriptDef);
        }
    };
    
    // Start initialization when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            injectVersionBadgeCSS();
            initialize();
        });
    } else {
        injectVersionBadgeCSS();
        initialize();
    }
    
    console.log('[KefinTweaks Injector] Injector script loaded. Available at window.KefinTweaks');
    
})();
