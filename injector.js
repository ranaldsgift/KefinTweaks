// KefinTweaks Script Injector
// Dynamically loads scripts and CSS files based on user configuration
// Usage: Modify the ENABLED_SCRIPTS array below to enable/disable features

(function() {
    'use strict';
    
    // Configuration: Set which scripts to load
    // Set to true to enable, false to disable
    const ENABLED_SCRIPTS = {
        // Core functionality (required for other scripts)
        cardBuilder: true,        // Required by watchlist, homeScreen and search
        
        // UI and functional enhancements
        watchlist: true,          // Watchlist functionality
        homeScreen: true,         // Custom home screen sections
        search: true,             // Enhanced search functionality

        headerTabs: true,         // Header tab enhancements
        customMenu: true,         // Custom menu functionality
        exclusiveElsewhere: true, // Exclusive elsewhere branding

        // Scripts with additional backend requirements
        updoot: false,              // Upvote functionality from https://github.com/BobHasNoSoul/jellyfin-updoot
        
        // Utility scripts
        backdropLeakFix: true,    // Memory leak fixes
        dashboardButtonFix: true, // Dashboard button fix
    };
    
    // Script definitions with dependencies and metadata
    const SCRIPT_DEFINITIONS = [
        {
            name: 'cardBuilder',
            script: 'cardBuilder.js',
            css: null,
            dependencies: [],
            description: 'Core card building functionality (required by other scripts)'
        },
        {
            name: 'watchlist',
            script: 'watchlist.js',
            css: 'watchlist.css',
            dependencies: ['cardBuilder'],
            description: 'Adds watchlist functionality throughout Jellyfin interface'
        },
        {
            name: 'homeScreen',
            script: 'homeScreen.js',
            css: 'homeScreen.css',
            dependencies: ['cardBuilder'],
            description: 'Adds custom home screen sections'
        },
        {
            name: 'search',
            script: 'search.js',
            css: 'search.css',
            dependencies: [],
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
            name: 'customMenu',
            script: 'custom-menu.js',
            css: null,
            dependencies: [],
            description: 'Remove target="_blank" from custom menu links'
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
            script: 'backdrop-leak-fix.js',
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
        }
    ];
    
    // Configuration validation
    function validateConfiguration() {
        const errors = [];
        
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
    
    // Get the root path for scripts (adjust this based on your setup)
    function getScriptRoot() {        
        return 'https://cdn.jsdelivr.net/gh/ranaldsgift/KefinTweaks/';
    }
    
    // Load a CSS file
    function loadCSS(filename) {
        return new Promise((resolve, reject) => {
            // Check if CSS is already loaded
            const existingLink = document.querySelector(`link[href*="${filename}"]`);
            if (existingLink) {
                console.log(`[KefinTweaks Injector] CSS already loaded: ${filename}`);
                resolve();
                return;
            }
            
            const link = document.createElement('link');
            link.rel = 'stylesheet';
            link.type = 'text/css';
            link.href = `${getScriptRoot()}${filename}`;
            
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
            const existingScript = document.querySelector(`script[src*="${filename}"]`);
            if (existingScript) {
                console.log(`[KefinTweaks Injector] Script already loaded: ${filename}`);
                resolve();
                return;
            }
            
            const script = document.createElement('script');
            script.src = `${getScriptRoot()}${filename}`;
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
    
    // Load a script and its dependencies
    async function loadScriptWithDependencies(scriptDef) {
        try {
            // Load dependencies first - only if they are enabled
            for (const depName of scriptDef.dependencies) {
                const depScript = SCRIPT_DEFINITIONS.find(s => s.name === depName);
                if (depScript && ENABLED_SCRIPTS[depName]) {
                    await loadScriptWithDependencies(depScript);
                } else if (depScript && !ENABLED_SCRIPTS[depName]) {
                    console.warn(`[KefinTweaks Injector] Dependency '${depName}' is disabled, skipping for '${scriptDef.name}'`);
                }
            }
            
            // Load CSS if specified
            if (scriptDef.css) {
                await loadCSS(scriptDef.css);
            }
            
            // Load the script
            await loadScript(scriptDef.script);
            
            console.log(`[KefinTweaks Injector] Successfully loaded: ${scriptDef.name}`);
            
        } catch (error) {
            console.error(`[KefinTweaks Injector] Error loading ${scriptDef.name}:`, error);
            throw error;
        }
    }
    
    // Main initialization function
    async function initialize() {
        console.log('[KefinTweaks Injector] Starting initialization...');
        
        // Validate configuration
        if (!validateConfiguration()) {
            console.error('[KefinTweaks Injector] Configuration validation failed. Aborting.');
            return;
        }
        
        // Get enabled scripts in dependency order
        const enabledScripts = SCRIPT_DEFINITIONS.filter(script => ENABLED_SCRIPTS[script.name]);
        
        console.log(`[KefinTweaks Injector] Loading ${enabledScripts.length} scripts:`, 
                   enabledScripts.map(s => s.name));
        
        // Load all enabled scripts
        const loadPromises = enabledScripts.map(script => loadScriptWithDependencies(script));
        
        try {
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
        document.addEventListener('DOMContentLoaded', initialize);
    } else {
        initialize();
    }
    
    console.log('[KefinTweaks Injector] Injector script loaded. Available at window.KefinTweaks');
    
})();
