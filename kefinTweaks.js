// KefinTweaks - Central Configuration and Script Loader
// Copy this entire file into your Jellyfin JS injector plugin
// Modify the configuration below to enable/disable features and customize settings
//
// VERSION: 0.2.0 
// Full compatibility with Jellyfin 10.10.7
// Untested compatibility with Jellyfin 10.11+
// 
// FEATURES OVERVIEW:
// =================
// For a detailed feature overview see README.md at https://github.com/ranaldsgift/KefinTweaks
//
// PREREQUISITES:
// ============
// - JS Injector plugin https://github.com/n00bcodr/Jellyfin-JavaScript-Injector
// - Custom Tabs plugin for watchlist functionality https://github.com/IAmParadox27/jellyfin-plugin-custom-tabs
// - JellyfinEnhanced plugin for Jellyseerr search functionality and ExclusiveElsewhere https://github.com/n00bcodr/Jellyfin-Enhanced
//
// INSTALLATION:
// ============
// 0. Install required prerequisites listed above
// 1. Add a new script to your JS Injector plugin
// 2. Copy this entire file into the new script
// (Optional) Enable/disable features, or customize their configuration by editing the script below
// 3. Ensure the script is enabled
// 4. Save your changes
//
// CONFIGURATION GUIDE:
// ===================
// - Scripts: Enable/disable individual features
// - Home Screen: Configure custom sections and discovery settings
// - Exclusive Elsewhere: Only useful if you want to display an icon or logo instead of text
// - Search: Enable Jellyseerr integration adds an option to search for Jellyseerr results only
//
// Considerations for the home screen sections:
// 1. Custom sections (order 1-29) - Your playlist-based sections
// 2. New and Trending sections (order 30-49) - Newest movies and episodes
// 3. Seasonal sections (order 50+) - Holiday-themed content
// 4. Discovery sections (order 200+) - Intelligent recommendations based on your library

(function() {
    'use strict';
    
    // ============================================================================
    // CENTRAL CONFIGURATION
    // ============================================================================
    
    const KEFIN_TWEAKS_CONFIG = {
        // ============================================================================
        // SCRIPT ROOT CONFIGURATION
        // ============================================================================
        // Configure where scripts are loaded from
        scriptRoot: 'https://ranaldsgift.github.io/KefinTweaks/',
        
        // ============================================================================
        // SCRIPT ENABLE/DISABLE FLAGS
        // ============================================================================
        // Toggle individual features on/off. Dependencies are automatically managed.
        scripts: {
            // Major feature enhancements
            homeScreen: true,         // Custom home screen sections and discovery engine
            search: true,             // Enhanced search with better UI and Jellyseerr integration
            // REQUIREMENTS: Watchlist requires Custom Tabs plugin https://github.com/IAmParadox27/jellyfin-plugin-custom-tabs
            watchlist: true,          // Complete watchlist management with progress tracking
            
            // UI and navigation improvements
            headerTabs: true,         // Improved header tab functionality and behavior
            customMenuLinks: true,    // Load and add custom menu links from configuration
            breadcrumbs: true,        // Breadcrumb navigation for Movies, Series, Seasons, Episodes, Music
            playlist: true,           // Enhanced playlist view with better navigation
            itemDetailsCollections: true, // Shows collections on item details pages (Included In section)
            flattenSingleSeasonShows: true, // Flattens single-season shows to display episodes directly on series page
            
            // Reviews and recommendations
            // updoot: false,             // This is unsupported for now but will be worked on in the future

            // Branding and external integrations
            // REQUIRES: ExclusiveElsewhere requires JellyfinEnhanced plugin https://github.com/n00bcodr/Jellyfin-Enhanced
            exclusiveElsewhere: false, // Custom branding when items aren't available on streaming services
            
            // Performance and stability improvements
            backdropLeakFix: true,    // Fixes memory leaks from backdrop images when tab isn't focused
            dashboardButtonFix: true, // Proper back button behavior on dashboard
            infiniteScroll: true,     // Smooth infinite scrolling. Supports Movie and TV libraries. Music to be added in the future.
            
            // Quality of life improvements
            removeContinue: true,     // Add "Remove from Continue Watching" functionality
            subtitleSearch: true,     // Search and download subtitles directly from video OSD
            
            // UI customization
            skinManager: true         // Skin selection and management - adds skin dropdown to header and display preferences
        },
        
        // ============================================================================
        // HOME SCREEN CONFIGURATION
        // ============================================================================
        // Configure custom home screen sections and discovery features
        homeScreen: {            
            // NEW AND TRENDING SECTIONS
            // Automatically curated sections showing latest content
            enableNewAndTrending: true,   // Master toggle for new and trending sections
            enableNewMovies: true,        // Show newest movies section
            enableNewEpisodes: true,      // Show newest episodes from last 7 days
            enableTrending: false,        // Show trending sections (currently stubs, order 32-33)
            
            // DISCOVERY SECTIONS
            // Intelligent recommendations based on your library content
            // Includes:
            // - [Genre] Movies (random genres with sufficient movie count)
            // - Directed by [Director] (top directors from your library)
            // - Written by [Writer] (top writers from your library)  
            // - Starring [Actor] (top actors from your library)
            // - Because you watched [Movie] (similar content based on watch history)
            // - Because you liked [Movie] (similar content based on favorites)
            enableDiscovery: true,        // Enables discovery sections on the home screen
            
            // Discovery section behavior and filtering
            enableInfiniteScroll: false,   // Use infinite scroll vs Load More button
            minPeopleAppearances: 10,     // Minimum movie appearances for people to be featured
            minGenreMovieCount: 50,      // Minimum movie count for genres to be included
            minimumShowsForNetwork: 5,    // Minimum show count for TV networks to be featured

            // WATCHLIST SECTION
            // Requires watchlist script to be enabled
            enableWatchlist: true,        // Show watchlist section on home screen

            // SEASONAL SECTIONS
            // Holiday-themed content sections
            enableSeasonal: true,         // Master toggle for seasonal sections
            seasonalItemLimit: 16,        // Maximum items to show in seasonal sections
            
            // CUSTOM SECTIONS 
            // Add your own playlist/collection-based sections
            customSections: [
                // Add more custom sections here
                /* Example:
                {
                    // Optionally provide a name, otherwise the name of the playlist/collection will be used
                    name: 'Your Custom Section', 

                    // The ID of the playlist/collection to display in the section, get this from Jellyfin playlist/collection URL
                    id: 'acc84f03475eb51602b13cde158d21ad',

                    // The maximum number of items to display in the section on the home screen
                    maxItems: 20,
                    
                    // The order of the section for it to appear on the home screen
                    order: 5
                },
                */
            ],
        },
        
        // ============================================================================
        // EXCLUSIVE ELSEWHERE CONFIGURATION
        // ============================================================================
        // Configure exclusive elsewhere branding behavior
        exclusiveElsewhere: {
            hideServerName: false  // Set to true to hide server name, useful when you want to only show a logo or icon via CSS
        },
        
        // ============================================================================
        // SEARCH CONFIGURATION
        // ============================================================================
        // Configure search functionality
        search: {
            enableJellyseerr: false  // Enable Jellyseerr integration for request functionality
        },
        
        // ============================================================================
        // SKIN CONFIGURATION
        // ============================================================================
        // Configure additional skins available in the skin manager
        // These will be merged with skins from userConfig.js
        // Each skin can have a single URL (string) or multiple URLs (array) for complex themes
        // Each skin can also have colorSchemes array for color variations specific to that skin
        // Each skin should have an author field indicating who created the skin
        skins: [
            // Add additional skins here that will be available to all users
            // These are example skins - replace with your own or remove if not needed
            /* Example of adding more skins:
            {
                name: 'Custom Theme',
                author: 'username',
                url: 'https://cdn.jsdelivr.net/gh/username/custom-theme.css',
                colorSchemes: []
            },
            {
                name: 'Multi-file Theme',
                author: 'username',
                url: [
                    'https://cdn.jsdelivr.net/gh/username/theme-base.css',
                    'https://cdn.jsdelivr.net/gh/username/theme-extensions.css'
                ],
                colorSchemes: [
                    {
                        name: 'Dark Blue',
                        url: 'https://cdn.jsdelivr.net/gh/username/theme-dark-blue.css'
                    },
                    {
                        name: 'Light Green',
                        url: 'https://cdn.jsdelivr.net/gh/username/theme-light-green.css'
                    }
                ]
            },
            */
        ],
        
        // Default skin to use when no skin is selected
        // This overrides the default selection from userConfig.js
        defaultSkin: null, // Set to skin name (e.g., 'ElegantFin') or null to use userConfig default
        
        
        // ============================================================================
        // THEME CONFIGURATION
        // ============================================================================
        // Configure additional themes available in the theme manager
        // These will be merged with themes from userConfig.js
        // Each theme should have a name and URL pointing to a CSS file
        themes: [
            // Add additional themes here that will be available to all users
            // These are example themes - replace with your own or remove if not needed
            /* Example of adding more themes:
            {
                name: 'Custom Dark Theme',
                url: 'https://cdn.jsdelivr.net/gh/username/custom-dark-theme.css'
            },
            {
                name: 'Custom Light Theme',
                url: 'https://cdn.jsdelivr.net/gh/username/custom-light-theme.css'
            },
            */
        ],
        
        // ============================================================================
        // CUSTOM MENU LINKS CONFIGURATION
        // ============================================================================
        // Configure custom menu links to be added to the custom menu
        customMenuLinks: [
            // Add your custom menu links here
            /* Example:
            {
                name: 'My Custom Link',        // Display name for the menu item
                icon: 'link',                  // Material icon name (optional, defaults to 'link')
                url: '#/userpluginsettings.html?pageUrl=https://domain.com/custom-page', // URL to navigate to
                openInNewTab: false           // Whether to open in new tab (optional, defaults to false)
            },
            {
                name: 'External Link',
                icon: 'open_in_new',
                url: 'https://example.com',
                openInNewTab: true
            },
            */
        ],
    };
    
    // ============================================================================
    // CONFIGURATION EXPOSURE
    // ============================================================================
    // Make configuration available to individual scripts
    window.KefinTweaksConfig = KEFIN_TWEAKS_CONFIG;
    
    // ============================================================================
    // SCRIPT LOADER INITIALIZATION
    // ============================================================================
    // Load the injector script which handles loading individual scripts based on configuration
    const script = document.createElement("script");
    script.src = `${KEFIN_TWEAKS_CONFIG.scriptRoot}injector.js?v=${new Date().getTime()}`;
    script.async = true;
    document.head.appendChild(script);
    
    console.log('[KefinTweaks] Central configuration loaded. Available at window.KefinTweaksConfig');
    console.log('[KefinTweaks] Version 0.2.0 - Compatible with Jellyfin 10.10.7');
    
})();

