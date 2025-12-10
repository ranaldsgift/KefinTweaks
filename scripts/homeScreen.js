// Jellyfin Home Screen Script
// Adds custom scrollable sections to the home screen
// Home screen sections are generated from playlists
// All playlists used for the home screen sections must be public
// Requires: cardBuilder.js, localStorageCache.js, utils.js modules to be loaded before this script

(function() {
    'use strict';
    
    // Common logging function
    const LOG = (...args) => console.log('[KefinTweaks HomeScreen]', ...args);
    const WARN = (...args) => console.warn('[KefinTweaks HomeScreen]', ...args);
    const ERR = (...args) => console.error('[KefinTweaks HomeScreen]', ...args);
    
    LOG('Initializing...');
    
    // Add CSS for discovery section loading indicator
    function addDiscoveryLoadingCSS() {
        const styleId = 'discovery-loading-styles';
        
        // Check if style already exists
        if (document.getElementById(styleId)) {
            return;
        }
        
        const style = document.createElement('style');
        style.id = styleId;
        style.textContent = `
            /* Discovery section loading indicator */
            .discovery-loading-indicator {
                flex-direction: column;
                gap: 10px;
                justify-content: center;
                align-items: center;
                padding: 20px;
                border-radius: 8px;
                font-size: 14px;
                color: #666;
                transition: opacity 0.3s ease;
                order: 99999 !important;
                position: relative;
            }
            
            .discovery-loading-indicator.show {
                opacity: 1;
                display: flex;
            }
            
            .discovery-loading-indicator .spinner {
                width: 20px;
                height: 20px;
                border: 2px solid #f3f3f3;
                border-top: 2px solid #3498db;
                border-radius: 50%;
                animation: discovery-spin 1s linear infinite;
            }
            
            @keyframes discovery-spin {
                0% { transform: rotate(0deg); }
                100% { transform: rotate(360deg); }
            }
            
            /* Discovery section smooth reveal animation */
            .discovery-section-reveal {
                opacity: 0;
                transform: translateY(20px);
                transition: opacity 0.5s cubic-bezier(0.4, 0, 0.2, 1), 
                            transform 0.5s cubic-bezier(0.4, 0, 0.2, 1);
            }
            
            /* When section enters viewport, trigger animation */
            .discovery-section-reveal.in-viewport {
                opacity: 1;
                transform: translateY(0);
            }
        `;
        
        document.head.appendChild(style);
        LOG('Added discovery loading CSS styles');
    }
    
    // Create loading indicator element
    function createDiscoveryLoadingIndicator() {
        let loadingDiv = document.querySelector('.libraryPage:not(.hide) #discovery-loading-indicator');
        if (loadingDiv) {
            return loadingDiv;
        }

        loadingDiv = document.createElement('div');
        loadingDiv.className = 'discovery-loading-indicator';
        loadingDiv.id = 'discovery-loading-indicator';
        loadingDiv.style.visibility = 'hidden';
        loadingDiv.innerHTML = `
            <div class="spinner"></div>
        `;
            
        // Find the home sections container and append the loading indicator
        const container = document.querySelector('.libraryPage:not(.hide) .homeSectionsContainer');
        if (container) {
            container.appendChild(loadingDiv);
        }

        return loadingDiv;
    }
    
    // Show loading indicator
    function showDiscoveryLoadingIndicator() {
        let loadingIndicator = document.querySelector('.libraryPage:not(.hide) #discovery-loading-indicator');
        
        if (!loadingIndicator) {
            createDiscoveryLoadingIndicator();
        }
        
        loadingIndicator.classList.add('show');
        loadingIndicator.style.visibility = 'visible';
        loadingIndicator.style.display = 'flex';
        LOG('Discovery loading indicator shown');
    }
    
    // Hide loading indicator
    function hideDiscoveryLoadingIndicator() {
        const loadingIndicator = document.querySelector('.libraryPage:not(.hide) #discovery-loading-indicator');
        if (loadingIndicator) {
            loadingIndicator.classList.remove('show');     
            loadingIndicator.style.visibility = 'hidden';

            if (!enableInfiniteScroll) {
                loadingIndicator.style.display = 'none';
            }

            LOG('Discovery loading indicator hidden');
        }
    }
    
    // Body class management for home page and themes
    function manageBodyClasses() {
        const body = document.body;
        const currentView = window.KefinTweaksUtils?.getCurrentView();
        const isHomePage = currentView === 'home' || currentView === 'home.html';
        
        // Get seasonal animation setting
        const homeScreenConfig = window.KefinTweaksConfig?.homeScreen || {};
        const seasonalConfig = homeScreenConfig.seasonal || {};
        const enableSeasonalAnimations = seasonalConfig.enableSeasonalAnimations !== false;
        const enableSeasonalBackground = seasonalConfig.enableSeasonalBackground !== false;
        
        // Manage home-screen class
        if (isHomePage && body) {
            body.classList.add('home-screen');
        } else {
            body.classList.remove('home-screen');
        }
        
        // Manage theme classes (only on home page)
        if (isHomePage) {
            // Remove all existing theme classes
            const themeClasses = ['halloween-theme', 'christmas-theme', 'valentines-theme', 'newyear-theme', 'with-background'];
            themeClasses.forEach(themeClass => body.classList.remove(themeClass));
            
            // Add appropriate theme class based on current date
            if (isHalloweenPeriod()) {
                body.classList.add('halloween-theme');
            } else if (isChristmasPeriod()) {
                body.classList.add('christmas-theme');

                if (enableSeasonalBackground) {
                    body.classList.add('with-background');
                }

                if (enableSeasonalAnimations) {
                    // Check if snowverlay script is already added
                    const snowverlayScript = document.querySelector('script[src*="snowverlay.js"]');
                    
                    if (!snowverlayScript) {
                        // Use the snowverlay.js script to add snowflakes to the background
                        const snowverlayScriptSrc = (window.KefinTweaksConfig.kefinTweaksRoot || '') + 'scripts/snowverlay.js';
                        const snowverlayScript = document.createElement('script');
                        snowverlayScript.src = snowverlayScriptSrc;
                        document.head.appendChild(snowverlayScript);
                    }
                }

            } else if (isValentinesPeriod()) {
                body.classList.add('valentines-theme');
            } else if (isNewYearsPeriod()) {
                body.classList.add('newyear-theme');
            }
        } else {
            // Remove all theme classes when not on home page
            const themeClasses = ['halloween-theme', 'christmas-theme', 'valentines-theme', 'newyear-theme', 'with-background'];
            themeClasses.forEach(themeClass => body.classList.remove(themeClass));
        }
    }
    
    // Initialize body class management
    manageBodyClasses();
    
    // Initialize discovery loading CSS
    addDiscoveryLoadingCSS();
    
    // Set up page view monitoring
    if (window.KefinTweaksUtils) {
        window.KefinTweaksUtils.onViewPage(manageBodyClasses, {
            pages: []
        });
        LOG('Registered body class management for home page');
    } else {
        WARN('KefinTweaksUtils not available, body class management may not work correctly');
    }
    
    /**
     * Migrates old homeScreen config format to new format
     * Small, transparent function that runs automatically
     */
    async function migrateHomeScreenConfig() {
        if (!window.KefinTweaksConfig || !window.KefinTweaksConfig.homeScreen) {
            return;
        }
        
        const old = window.KefinTweaksConfig.homeScreen;
        const migrated = {};
        let needsMigration = false;
        
        // Check if old format exists (has enableNewAndTrending, etc.)
        if (old.enableNewAndTrending !== undefined || old.enableNewMovies !== undefined) {
            needsMigration = true;
            
            // Migrate recently released
            migrated.recentlyReleased = {
                enabled: old.enableNewAndTrending !== false,
                order: 30,
                movies: {
                    enabled: old.enableNewMovies !== false,
                    itemLimit: 16,
                    sortOrder: "ReleaseDate",
                    sortOrderDirection: "Descending",
                    cardFormat: "Poster",
                    order: 30
                },
                episodes: {
                    enabled: old.enableNewEpisodes !== false,
                    itemLimit: 16,
                    sortOrder: "PremiereDate",
                    sortOrderDirection: "Descending",
                    cardFormat: "Backdrop",
                    order: 31
                }
            };
            
            // Migrate trending
            if (old.enableTrending !== undefined) {
                migrated.trending = {
                    enabled: old.enableTrending || false,
                    itemLimit: 16,
                    sortOrder: "Random",
                    sortOrderDirection: "Ascending",
                    cardFormat: "Poster",
                    order: 32
                };
            }
            
            // Migrate popular TV networks
            if (old.minimumShowsForNetwork !== undefined) {
                migrated.popularTVNetworks = {
                    enabled: false,
                    minimumShowsForNetwork: old.minimumShowsForNetwork || 5,
                    itemLimit: 16,
                    sortOrder: "Random",
                    sortOrderDirection: "Ascending",
                    cardFormat: "Poster",
                    order: 61
                };
            }
            
            // Migrate watchlist
            if (old.enableWatchlist !== undefined) {
                migrated.watchlist = {
                    enabled: old.enableWatchlist || false,
                    itemLimit: 16,
                    sortOrder: "DateAdded",
                    sortOrderDirection: "Descending",
                    cardFormat: "Poster",
                    order: 60
                };
            }
            
            // Migrate seasonal
            if (old.enableSeasonal !== undefined) {
                const seasons = [];
                
                // Check if old format has seasons array
                if (old.seasonal && old.seasonal.seasons && Array.isArray(old.seasonal.seasons)) {
                    // Migrate each season from old format to new format
                    for (const oldSeason of old.seasonal.seasons) {
                        const sections = [];
                        
                        // Migrate genres to Genre sections
                        if (oldSeason.genres && Array.isArray(oldSeason.genres)) {
                            for (const genre of oldSeason.genres) {
                                sections.push({
                                    id: `${oldSeason.id || 'season'}-genre-${genre.toLowerCase().replace(/\s+/g, '-')}`,
                                    enabled: true,
                                    name: `${genre} Movies`,
                                    type: "Genre",
                                    source: genre,
                                    itemLimit: oldSeason.itemLimit || old.seasonalItemLimit || 16,
                                    sortOrder: oldSeason.sortOrder || "Random",
                                    sortOrderDirection: oldSeason.sortOrderDirection || "Ascending",
                                    cardFormat: oldSeason.cardFormat || "Poster",
                                    order: sections.length + 50
                                });
                            }
                        }
                        
                        // Migrate tags to Tag sections
                        if (oldSeason.tags && Array.isArray(oldSeason.tags)) {
                            for (const tag of oldSeason.tags) {
                                sections.push({
                                    id: `${oldSeason.id || 'season'}-tag-${tag.toLowerCase().replace(/\s+/g, '-')}`,
                                    enabled: true,
                                    name: `${tag} Movies`,
                                    type: "Tag",
                                    source: tag,
                                    itemLimit: oldSeason.itemLimit || old.seasonalItemLimit || 16,
                                    sortOrder: oldSeason.sortOrder || "Random",
                                    sortOrderDirection: oldSeason.sortOrderDirection || "Ascending",
                                    cardFormat: oldSeason.cardFormat || "Poster",
                                    order: sections.length + 50
                                });
                            }
                        }
                        
                        // Migrate collections to Collection sections
                        if (oldSeason.collections && Array.isArray(oldSeason.collections)) {
                            for (const collectionId of oldSeason.collections) {
                                sections.push({
                                    id: `${oldSeason.id || 'season'}-collection-${collectionId}`,
                                    enabled: true,
                                    name: "Collection",
                                    type: "Collection",
                                    source: collectionId,
                                    itemLimit: oldSeason.itemLimit || old.seasonalItemLimit || 16,
                                    sortOrder: oldSeason.sortOrder || "Random",
                                    sortOrderDirection: oldSeason.sortOrderDirection || "Ascending",
                                    cardFormat: oldSeason.cardFormat || "Poster",
                                    order: sections.length + 50
                                });
                            }
                        }
                        
                        // Migrate playlists to Playlist sections
                        if (oldSeason.playlists && Array.isArray(oldSeason.playlists)) {
                            for (const playlistId of oldSeason.playlists) {
                                sections.push({
                                    id: `${oldSeason.id || 'season'}-playlist-${playlistId}`,
                                    enabled: true,
                                    name: "Playlist",
                                    type: "Playlist",
                                    source: playlistId,
                                    itemLimit: oldSeason.itemLimit || old.seasonalItemLimit || 16,
                                    sortOrder: oldSeason.sortOrder || "Random",
                                    sortOrderDirection: oldSeason.sortOrderDirection || "Ascending",
                                    cardFormat: oldSeason.cardFormat || "Poster",
                                    order: sections.length + 50
                                });
                            }
                        }
                        
                        // If no sections were created, create a default one from genres if available
                        if (sections.length === 0 && oldSeason.genres && oldSeason.genres.length > 0) {
                            sections.push({
                                id: `${oldSeason.id || 'season'}-default`,
                                enabled: true,
                                name: oldSeason.name || "Seasonal Movies",
                                type: "Genre",
                                source: oldSeason.genres.join(', '),
                                itemLimit: oldSeason.itemLimit || old.seasonalItemLimit || 16,
                                sortOrder: oldSeason.sortOrder || "Random",
                                sortOrderDirection: oldSeason.sortOrderDirection || "Ascending",
                                cardFormat: oldSeason.cardFormat || "Poster",
                                order: 50
                            });
                        }
                        
                        seasons.push({
                            id: oldSeason.id || "halloween",
                            name: oldSeason.name || "Halloween",
                            enabled: oldSeason.enabled !== false,
                            startDate: oldSeason.startDate || "10-01",
                            endDate: oldSeason.endDate || "10-31",
                            sections: sections
                        });
                    }
                } else {
                    // Default migration: create Halloween and Christmas seasons
                    seasons.push({
                        id: "halloween",
                        name: "Halloween",
                        enabled: true,
                        startDate: "10-01",
                        endDate: "10-31",
                        sections: [
                            {
                                id: "halloween-horror",
                                enabled: true,
                                name: "Horror Movies",
                                type: "Genre",
                                source: "Horror",
                                itemLimit: old.seasonalItemLimit || 16,
                                sortOrder: "Random",
                                sortOrderDirection: "Ascending",
                                cardFormat: "Poster",
                                order: 50
                            },
                            {
                                id: "halloween-thriller",
                                enabled: true,
                                name: "Thriller Movies",
                                type: "Genre",
                                source: "Thriller",
                                itemLimit: old.seasonalItemLimit || 16,
                                sortOrder: "Random",
                                sortOrderDirection: "Ascending",
                                cardFormat: "Poster",
                                order: 51
                            }
                        ]
                    });
                    seasons.push({
                        id: "christmas",
                        name: "Christmas",
                        enabled: true,
                        startDate: "12-01",
                        endDate: "12-31",
                        sections: [
                            {
                                id: "christmas-genre",
                                enabled: true,
                                name: "Christmas Movies",
                                type: "Genre",
                                source: "Christmas",
                                itemLimit: old.seasonalItemLimit || 16,
                                sortOrder: "Random",
                                sortOrderDirection: "Ascending",
                                cardFormat: "Poster",
                                order: 60
                            },
                            {
                                id: "christmas-family",
                                enabled: true,
                                name: "Family Movies",
                                type: "Genre",
                                source: "Family",
                                itemLimit: old.seasonalItemLimit || 16,
                                sortOrder: "Random",
                                sortOrderDirection: "Ascending",
                                cardFormat: "Poster",
                                order: 61
                            }
                        ]
                    });
                }
                
                migrated.seasonal = {
                    enabled: old.enableSeasonal !== false,
                    defaultItemLimit: old.seasonalItemLimit || 16,
                    defaultSortOrder: "Random",
                    defaultCardFormat: "Poster",
                    seasons: seasons
                };
            }
            
            // Migrate existing seasonal config if it's in new format but old structure
            if (old.seasonal && old.seasonal.seasons && Array.isArray(old.seasonal.seasons)) {
                const needsRestructure = old.seasonal.seasons.some(season => 
                    season.genres || season.tags || season.collections || season.playlists
                );
                
                if (needsRestructure && !migrated.seasonal) {
                    // Already handled above, but ensure we don't lose it
                    migrated.seasonal = migrated.seasonal || {
                        enabled: old.seasonal.enabled !== false,
                        defaultItemLimit: old.seasonal.defaultItemLimit || 16,
                        defaultSortOrder: old.seasonal.defaultSortOrder || "Random",
                        defaultCardFormat: old.seasonal.defaultCardFormat || "Poster",
                        seasons: []
                    };
                }
            }
            
            // Migrate discovery
            if (old.enableDiscovery !== undefined || old.minPeopleAppearances !== undefined) {
                migrated.discovery = {
                    enabled: old.enableDiscovery !== false,
                    infiniteScroll: old.enableInfiniteScroll !== false,
                    minPeopleAppearances: old.minPeopleAppearances || 10,
                    minGenreMovieCount: old.minGenreMovieCount || 50,
                    defaultItemLimit: 16,
                    defaultSortOrder: "Random",
                    defaultCardFormat: "Poster",
                    sectionTypes: {
                        spotlightGenre: true,
                        spotlightNetwork: true,
                        genreMovies: true,
                        studioShows: true,
                        collections: {
                            enabled: true,
                            minimumItems: 10,
                            itemLimit: null,
                            sortOrder: null,
                            sortOrderDirection: null,
                            cardFormat: null
                        },
                        becauseYouWatched: true,
                        becauseYouLiked: true,
                        starringTopActor: true,
                        directedByTopDirector: true,
                        writtenByTopWriter: true,
                        becauseYouRecentlyWatched: true,
                        starringActorRecentlyWatched: true,
                        directedByDirectorRecentlyWatched: true,
                        writtenByWriterRecentlyWatched: true
                    }
                };
            }
            
            // Migrate custom sections
            if (old.customSections && Array.isArray(old.customSections)) {
                migrated.customSections = old.customSections.map(section => {
                    // If already in new format (has type and source), keep as is
                    if (section.type && section.source !== undefined) {
                        return section;
                    }
                    
                    // Migrate from old format (sourceId) to new format
                    const sourceId = section.sourceId || section.id;
                    if (!sourceId) {
                        return section; // Can't migrate without sourceId
                    }
                    
                    // Try to determine type from existing data or default to Collection
                    let type = section.type || 'Collection';
                    let source = section.source || sourceId;
                    
                    // If no type specified, we'll auto-detect in renderCustomSection
                    // But for migration, default to Collection
                    return {
                        id: section.id || `custom-${Math.random().toString(36).substr(2, 9)}`,
                        enabled: section.enabled !== false,
                        name: section.name || 'Custom Section',
                        type: type,
                        source: source,
                        itemLimit: section.itemLimit || 16,
                        sortOrder: section.sortOrder || 'Random',
                        sortOrderDirection: section.sortOrderDirection || 'Ascending',
                        cardFormat: section.cardFormat || 'Poster',
                        order: section.order || 100,
                        spotlight: section.spotlight === true,
                        discoveryEnabled: section.discoveryEnabled === true
                    };
                });
            }
            
            // Add new sections that didn't exist in old format (use defaults if not already present)
            // These sections are new and won't be in old configs, so we add them with default values
            if (!window.KefinTweaksConfig.homeScreen.upcoming) {
                migrated.upcoming = {
                    enabled: true,
                    itemLimit: 48,
                    cardFormat: "Thumb",
                    order: 20
                };
            }
            
            if (!window.KefinTweaksConfig.homeScreen.imdbTop250) {
                migrated.imdbTop250 = {
                    enabled: true,
                    itemLimit: 16,
                    sortOrder: "Random",
                    sortOrderDirection: "Ascending",
                    cardFormat: "Poster",
                    order: 21
                };
            }
            
            if (!window.KefinTweaksConfig.homeScreen.watchAgain) {
                migrated.watchAgain = {
                    enabled: false,
                    itemLimit: 16,
                    sortOrder: "Random",
                    sortOrderDirection: "Ascending",
                    cardFormat: "Poster",
                    order: 62
                };
            }
            
            // Merge migrated config with existing (new format takes precedence)
            window.KefinTweaksConfig.homeScreen = {
                ...migrated,
                ...window.KefinTweaksConfig.homeScreen
            };
            
            LOG('Migrated homeScreen config from old format to new format');
            
            // Save migrated config back to JS Injector plugin (async, don't block)
            if (window.KefinTweaksUtils && window.KefinTweaksUtils.saveConfigToJavaScriptInjector) {
                window.KefinTweaksUtils.saveConfigToJavaScriptInjector().catch(err => {
                    ERR('Failed to save migrated config to JS Injector:', err);
                });
            } else {
                WARN('KefinTweaksUtils.saveConfigToJavaScriptInjector not available, config migration not persisted');
            }
        }

        // --- NEW UPDATE LOGIC ---
        // Runs even if no major migration was needed, to catch specific updates
        
        // 1. Ensure Recently Released date fields exist (Migration Logic)
        let configChanged = false;
        // Use the current config (which might have been just migrated)
        const currentConfig = window.KefinTweaksConfig.homeScreen;
        
        if (currentConfig.recentlyReleased) {
            // Migrate movies config to minAgeInDays / maxAgeInDays
            if (currentConfig.recentlyReleased.movies) {
                // If old fields exist, remove them and replace with new defaults if not set
                if (currentConfig.recentlyReleased.movies.minPremiereDate !== undefined || currentConfig.recentlyReleased.movies.maxPremiereDate !== undefined) {
                    delete currentConfig.recentlyReleased.movies.minPremiereDate;
                    delete currentConfig.recentlyReleased.movies.maxPremiereDate;
                    configChanged = true;
                }
                
                if (currentConfig.recentlyReleased.movies.minAgeInDays === undefined) {
                    currentConfig.recentlyReleased.movies.minAgeInDays = null;
                    configChanged = true;
                }
                if (currentConfig.recentlyReleased.movies.maxAgeInDays === undefined) {
                    currentConfig.recentlyReleased.movies.maxAgeInDays = null;
                    configChanged = true;
                }
            }

            // Migrate episodes config to minAgeInDays / maxAgeInDays
            if (currentConfig.recentlyReleased.episodes) {
                if (currentConfig.recentlyReleased.episodes.minPremiereDate !== undefined || currentConfig.recentlyReleased.episodes.maxPremiereDate !== undefined) {
                    delete currentConfig.recentlyReleased.episodes.minPremiereDate;
                    delete currentConfig.recentlyReleased.episodes.maxPremiereDate;
                    configChanged = true;
                }

                if (currentConfig.recentlyReleased.episodes.minAgeInDays === undefined) {
                    currentConfig.recentlyReleased.episodes.minAgeInDays = null;
                    configChanged = true;
                }
                if (currentConfig.recentlyReleased.episodes.maxAgeInDays === undefined) {
                    currentConfig.recentlyReleased.episodes.maxAgeInDays = null;
                    configChanged = true;
                }
            }
        }

        // 2. Update Seasonal Sections (Christmas/Halloween legacy IDs)
        if (currentConfig.seasonal && Array.isArray(currentConfig.seasonal.seasons)) {
            // Helper function to update a section if it matches an old ID
            const updateSectionIfMatch = (season, oldId, newConfig) => {
                if (!season.sections || !Array.isArray(season.sections)) return false;
                const index = season.sections.findIndex(s => s.id === oldId);
                if (index !== -1) {
                    season.sections[index] = newConfig;
                    return true;
                }
                return false;
            };

            // Iterate ALL seasons to find legacy sections, regardless of season ID/Name
            for (const season of currentConfig.seasonal.seasons) {
                if (!season.sections || !Array.isArray(season.sections)) continue;

                // Update old "Christmas Movies" (genre) to new "Christmas Movies" (tag)
                if (updateSectionIfMatch(season, 'christmas-genre', {
                    "id": "seasonal-1-section-0",
                    "enabled": true,
                    "name": "Christmas Movies",
                    "type": "Tag",
                    "source": "christmas",
                    "itemLimit": 16,
                    "sortOrder": "Random",
                    "sortOrderDirection": "Ascending",
                    "cardFormat": "Poster",
                    "order": 50,
                    "spotlight": true,
                    "discoveryEnabled": false,
                    "searchTerm": "",
                    "includeItemTypes": ["Movie"],
                    "additionalQueryOptions": []
                })) {
                    configChanged = true;
                }

                // Update old "Family Movies" (genre) to new "Christmas Episodes" (parent/search)
                if (updateSectionIfMatch(season, 'christmas-family', {
                    "id": "seasonal-1-section-1",
                    "enabled": true,
                    "name": "Christmas Episodes",
                    "type": "Parent",
                    "source": "",
                    "itemLimit": 16,
                    "sortOrder": "Random",
                    "sortOrderDirection": "Ascending",
                    "cardFormat": "Thumb",
                    "order": 51,
                    "spotlight": false,
                    "discoveryEnabled": false,
                    "searchTerm": "christmas",
                    "includeItemTypes": ["Episode"],
                    "additionalQueryOptions": []
                })) {
                    configChanged = true;
                }

                 // Update Halloween Horror (ensure correct config)
                 if (updateSectionIfMatch(season, 'halloween-horror', {
                    "id": "halloween-horror",
                    "enabled": true,
                    "name": "Horror Genre",
                    "type": "Genre",
                    "source": "Horror",
                    "itemLimit": 16,
                    "sortOrder": "Random",
                    "sortOrderDirection": "Ascending",
                    "cardFormat": "Poster",
                    "order": 51
                })) {
                     configChanged = true;
                }
                 // Update Halloween Thriller (ensure correct config)
                 if (updateSectionIfMatch(season, 'halloween-thriller', {
                    "id": "halloween-thriller",
                    "enabled": true,
                    "name": "Thriller Genre",
                    "type": "Genre",
                    "source": "Thriller",
                    "itemLimit": 16,
                    "sortOrder": "Random",
                    "sortOrderDirection": "Ascending",
                    "cardFormat": "Poster",
                    "order": 52
                })) {
                    configChanged = true;
                }
            }
        }

        // Migrate Recently Added in Library
        if (!old.recentlyAddedInLibrary) {
            old.recentlyAddedInLibrary = {};
        }

        try {
            // We always check for new libraries to add them as disabled
            const userId = ApiClient.getCurrentUserId();
            const result = await window.ApiClient.getUserViews({}, userId);
            
            if (result && result.Items) {
                const libraries = result.Items.filter(item => 
                    item.CollectionType === 'movies' || item.CollectionType === 'tvshows'
                );
                
                libraries.forEach(lib => {
                    if (!old.recentlyAddedInLibrary[lib.Id]) {
                        old.recentlyAddedInLibrary[lib.Id] = {
                            enabled: false, // Default to disabled for new libraries
                            order: 11,
                            itemLimit: 30,
                            name: `Recently Added in ${lib.Name}`,
                            cardFormat: lib.CollectionType === 'tvshows' ? 'Thumb' : 'Poster'
                        };
                        configChanged = true;
                    }
                });
            }
        } catch (e) {
            WARN('Error checking libraries for migration', e);
        }
        
        if (configChanged && !needsMigration) {
            LOG('Applied specific configuration updates');
            // Save updated config back to JS Injector plugin
            if (window.KefinTweaksUtils && window.KefinTweaksUtils.saveConfigToJavaScriptInjector) {
                await window.KefinTweaksUtils.saveConfigToJavaScriptInjector();
            }
        }
    }
    
    // Run migration before reading config
    migrateHomeScreenConfig();
    
    // Read new config structure
    const homeScreenConfig = window.KefinTweaksConfig?.homeScreen || {};
    const defaultItemLimit = homeScreenConfig.defaultItemLimit || 16;
    const defaultSortOrder = homeScreenConfig.defaultSortOrder || 'Random';
    const defaultCardFormat = homeScreenConfig.defaultCardFormat || 'Poster';
    
    // Spotlight configuration
    const spotlightConfig = homeScreenConfig.spotlight || {};
    const spotlightAutoPlay = spotlightConfig.autoPlay || true;
    const spotlightInterval = spotlightConfig.interval || 5000;
    const spotlightShowDots = spotlightConfig.showDots || true;
    const spotlightShowNavButtons = spotlightConfig.showNavButtons || true;
    const spotlightShowClearArt = spotlightConfig.showClearArt || true;
    
    // Custom home sections configuration
    const customHomeSections = homeScreenConfig.customSections || [];

    // Recently Added in Library configuration
    const recentlyAddedInLibraryConfig = homeScreenConfig.recentlyAddedInLibrary || {};

    // Recently Released sections configuration
    const recentlyReleasedConfig = homeScreenConfig.recentlyReleased || {};
    const enableNewAndTrending = recentlyReleasedConfig.enabled !== false;
    const newMoviesConfig = recentlyReleasedConfig.movies || {};
    const enableNewMovies = newMoviesConfig.enabled !== false;
    const newEpisodesConfig = recentlyReleasedConfig.episodes || {};
    const enableNewEpisodes = newEpisodesConfig.enabled !== false;
    
    // Trending sections configuration
    const trendingConfig = homeScreenConfig.trending || {};
    const enableTrending = trendingConfig.enabled || false;
    
    // Popular TV Networks configuration
    const popularTVNetworksConfig = homeScreenConfig.popularTVNetworks || {};
    const minimumShowsForNetwork = popularTVNetworksConfig.minimumShowsForNetwork || 5;
    
    // Watchlist configuration
    const watchlistConfig = homeScreenConfig.watchlist || {};
    const enableWatchlist = watchlistConfig.enabled || false;
    
    // Watch Again configuration
    const watchAgainConfig = homeScreenConfig.watchAgain || {};
    const enableWatchAgain = watchAgainConfig.enabled || false;
    
    // Upcoming configuration
    const upcomingConfig = homeScreenConfig.upcoming || {};
    const enableUpcoming = upcomingConfig.enabled !== false;
    
    // IMDb Top 250 configuration
    const imdbTop250Config = homeScreenConfig.imdbTop250 || {};
    const enableImdbTop250 = imdbTop250Config.enabled !== false;
    
    // Seasonal configuration
    const seasonalConfig = homeScreenConfig.seasonal || {};
    const enableSeasonal = seasonalConfig.enabled !== false;
    const enableSeasonalAnimations = seasonalConfig.enableSeasonalAnimations !== false;
    const SEASONAL_ITEM_LIMIT = seasonalConfig.defaultItemLimit || 16;
    
    // Discovery sections configuration
    const discoveryConfig = homeScreenConfig.discovery || {};
    const enableDiscovery = discoveryConfig.enabled !== false;
    const enableInfiniteScroll = discoveryConfig.infiniteScroll !== false;
    const minPeopleAppearances = discoveryConfig.minPeopleAppearances || 10;
    const minGenreMovieCount = discoveryConfig.minGenreMovieCount || 50;
    const DISCOVERY_ORDER = 1000; // Discovery sections use dynamic ordering

    const DISCOVERY_SECTION_DEFINITIONS = [
        { key: 'spotlightGenre', defaultName: 'Spotlight' },
        { key: 'spotlightNetwork', defaultName: 'Spotlight' },
        { key: 'genreMovies', defaultName: '[Genre] Movies' },
        { key: 'studioShows', defaultName: 'Shows from [Studio]' },
        { key: 'collections', defaultName: '[Collection Name]', minimumItems: 10 },
        { key: 'becauseYouWatched', defaultName: 'Because you watched [Movie]' },
        { key: 'becauseYouLiked', defaultName: 'Because you liked [Movie]' },
        { key: 'starringTopActor', defaultName: 'Starring [Actor]' },
        { key: 'directedByTopDirector', defaultName: 'Directed by [Director]' },
        { key: 'writtenByTopWriter', defaultName: 'Written by [Writer]' },
        { key: 'becauseYouRecentlyWatched', defaultName: 'Because you recently watched [Movie]' },
        { key: 'starringActorRecentlyWatched', defaultName: 'Starring [Actor] because you recently watched [Movie]' },
        { key: 'directedByDirectorRecentlyWatched', defaultName: 'Directed by [Director] because you recently watched [Movie]' },
        { key: 'writtenByWriterRecentlyWatched', defaultName: 'Written by [Writer] because you recently watched [Movie]' }
    ];

    const discoverySectionDefinitionMap = DISCOVERY_SECTION_DEFINITIONS.reduce((map, definition) => {
        map[definition.key] = definition;
        return map;
    }, {});

    const discoverySectionTypeMap = {
        'genre': 'genreMovies',
        'director': 'directedByTopDirector',
        'writer': 'writtenByTopWriter',
        'actor': 'starringTopActor',
        'watched': 'becauseYouWatched',
        'liked': 'becauseYouLiked',
        'studio': 'studioShows',
        'watched-recent': 'becauseYouRecentlyWatched',
        'actor-recent': 'starringActorRecentlyWatched',
        'director-recent': 'directedByDirectorRecentlyWatched',
        'writer-recent': 'writtenByWriterRecentlyWatched',
        'spotlight-genre': 'spotlightGenre',
        'spotlight-network': 'spotlightNetwork',
        'collection': 'collections'
    };

    const discoverySectionSettingsCache = {};

    /**
     * Helper to get IsPlayed filter string from config
     * @param {Object} config - Section configuration object
     * @returns {string|null} - 'IsPlayed', 'IsUnplayed', or null
     */
    function getIsPlayedFilter(config) {
        if (config && config.isPlayed === true) return 'IsPlayed';
        if (config && config.isPlayed === false) return 'IsUnplayed';
        return null;
    }

    let collectionsData = null;
    async function getCollectionsData() {
        if (collectionsData !== null) {
            return collectionsData;
        }

        collectionsData = await ApiClient.getItems(ApiClient.getCurrentUserId(), {
            IncludeItemTypes: 'BoxSet',
            Recursive: true,
            Fields: 'RecursiveItemCount,ChildCount'
        });
        return collectionsData;
    }

    if (!discoveryConfig.sectionTypes) {
        discoveryConfig.sectionTypes = {};
    }

    if (discoveryConfig.collectionSection) {
        const legacySection = discoveryConfig.collectionSection;
        const existingCollectionEntry = discoveryConfig.sectionTypes.collections;
        if (!existingCollectionEntry || typeof existingCollectionEntry !== 'object') {
            discoveryConfig.sectionTypes.collections = {
                enabled: legacySection.enabled !== false,
                name: legacySection.name || discoveryConfig.sectionNames?.collections || '[Collection Name]',
                minimumItems: legacySection.minimumItems ?? 10,
                itemLimit: legacySection.itemLimit ?? null,
                sortOrder: legacySection.sortOrder ?? null,
                sortOrderDirection: legacySection.sortOrderDirection ?? null,
                cardFormat: legacySection.cardFormat ?? null,
                order: legacySection.order ?? 50
            };
        } else if (legacySection.minimumItems !== undefined && existingCollectionEntry.minimumItems === undefined) {
            existingCollectionEntry.minimumItems = legacySection.minimumItems;
        }
        delete discoveryConfig.collectionSection;
    }

    function parseDiscoveryNumber(value, fallback) {
        if (value === null || value === undefined || value === '') {
            return fallback;
        }
        const parsed = parseInt(value, 10);
        return Number.isFinite(parsed) ? parsed : fallback;
    }

    function getDiscoverySectionKeyFromType(sectionType) {
        return discoverySectionTypeMap[sectionType] || null;
    }

    function getDiscoverySectionSettings(sectionKey) {
        if (!sectionKey) return null;
        if (discoverySectionSettingsCache[sectionKey]) {
            return discoverySectionSettingsCache[sectionKey];
        }

        const definition = discoverySectionDefinitionMap[sectionKey] || {};
        const rawConfig = discoveryConfig.sectionTypes?.[sectionKey];
        const legacyNames = discoveryConfig.sectionNames || {};

        const defaultItemLimitForDiscovery = discoveryConfig.defaultItemLimit ?? defaultItemLimit;
        const defaultSortOrderForDiscovery = discoveryConfig.defaultSortOrder ?? defaultSortOrder;
        const defaultCardFormatForDiscovery = discoveryConfig.defaultCardFormat ?? defaultCardFormat;

        let normalized = {
            enabled: true,
            name: legacyNames[sectionKey] || definition.defaultName || '',
            itemLimit: defaultItemLimitForDiscovery,
            sortOrder: defaultSortOrderForDiscovery,
            sortOrderDirection: 'Ascending',
            cardFormat: defaultCardFormatForDiscovery
        };

        if (definition.minimumItems !== undefined) {
            normalized.minimumItems = definition.minimumItems;
        }

        if (rawConfig === false) {
            normalized.enabled = false;
        } else if (rawConfig && typeof rawConfig === 'object') {
            normalized = { ...normalized, ...rawConfig };
        } else if (rawConfig === true) {
            normalized.enabled = true;
        }

        normalized.name = normalized.name || definition.defaultName || '';
        normalized.itemLimit = parseDiscoveryNumber(normalized.itemLimit, defaultItemLimitForDiscovery);
        normalized.sortOrder = normalized.sortOrder || defaultSortOrderForDiscovery;
        normalized.sortOrderDirection = normalized.sortOrderDirection || 'Ascending';
        normalized.cardFormat = normalized.cardFormat || defaultCardFormatForDiscovery;
        if (normalized.minimumItems !== undefined) {
            normalized.minimumItems = parseDiscoveryNumber(normalized.minimumItems, definition.minimumItems ?? 10);
        }

        discoverySectionSettingsCache[sectionKey] = normalized;
        return normalized;
    }

    function applyDiscoverySectionOrdering(items, sectionConfig) {
        if (!Array.isArray(items)) return [];
        
        // Filter by IsPlayed if configured
        let filteredItems = items;
        const isPlayedFilter = sectionConfig?.isPlayed;
        
        if (isPlayedFilter === true) {
            filteredItems = items.filter(item => item.UserData && item.UserData.Played);
        } else if (isPlayedFilter === false) {
            filteredItems = items.filter(item => !item.UserData || !item.UserData.Played);
        }
        
        const sortOrder = sectionConfig?.sortOrder || discoveryConfig.defaultSortOrder || defaultSortOrder;
        const sortDirection = sectionConfig?.sortOrderDirection || 'Ascending';
        let sortedItems = filteredItems;

        if (sortOrder === 'Random') {
            sortedItems = [...filteredItems].sort(() => Math.random() - 0.5);
        } else if (window.cardBuilder && typeof window.cardBuilder.sortItems === 'function') {
            sortedItems = window.cardBuilder.sortItems(filteredItems, sortOrder, sortDirection);
        }

        const limit = parseDiscoveryNumber(
            sectionConfig?.itemLimit,
            discoveryConfig.defaultItemLimit ?? defaultItemLimit
        );

        return sortedItems.slice(0, limit);
    }

    // Processing flag to prevent parallel execution
    let isProcessing = false;
    let isLoadingDiscoveryGroup = false;
    
    // Seasonal data storage
    let halloweenMovies = [];
    let horrorMovies = [];
    let thrillerMovies = [];
    let halloweenViewMoreUrls = {
        horror: null,
        thriller: null
    };

    // Discovery sections data storage
    let moviesTopPeople = null;
    let renderedSections = new Set(); // Track rendered sections to avoid duplicates
    let isGeneratingDiscoverySections = false; // Prevent parallel generation (legacy)
    let isRenderingDiscoveryGroup = false; // Prevent parallel rendering from buffer
    let isInitializingPeopleCache = false; // Prevent parallel people cache initialization
    let isPeopleCacheComplete = false; // Track if all people data has been loaded
    let preloadedSections = []; // Preloaded sections ready for instant rendering
    
    // Track rendered items to avoid duplicates
    let renderedActors = new Set(); // Track rendered actor IDs
    let renderedDirectors = new Set(); // Track rendered director IDs
    let renderedWriters = new Set(); // Track rendered writer IDs
    let renderedStudios = new Set(); // Track rendered studio IDs
    let renderedWatchedMovies = new Set(); // Track rendered watched movie IDs for "Because you watched" sections
    let renderedGenres = new Set(); // Track rendered genre IDs for spotlight sections
    let renderedNetworks = new Set(); // Track rendered network IDs for spotlight sections
    let renderedCollections = new Set(); // Track rendered collection IDs
    let renderedCustomDiscoverySections = new Set(); // Track custom sections used in discovery
    let cachedQualifyingGenres = null; // Cache qualifying genres to avoid refetching
    let isCachingQualifyingGenres = false; // Prevent parallel caching
    let renderedFavoriteMovies = new Set(); // Track rendered favorite movie IDs
    let renderedStarringWatchedMovies = new Set(); // Track movies used for "Starring X since you watched Y" sections
    let renderedDirectedWatchedMovies = new Set(); // Track movies used for "Directed by X since you watched Y" sections
    let renderedWrittenWatchedMovies = new Set(); // Track movies used for "Written by X since you watched Y" sections
    
    // Pre-rendered sections waiting to be revealed
    let hiddenDiscoverySections = []; // Array of pre-rendered section DOM elements
    
    // Discovery buffer system
    let discoveryBuffer = []; // Buffer holding groups of discovery items (always 2 groups)
    let additionalDiscoveryContent = true; // Flag indicating if more discovery content is available
    let preloadedSectionElements = []; // Preloaded section DOM elements (hidden)
    let isPreloadingSections = false; // Prevent parallel preloading
    let discoveryScrollHandler = null; // Reference to scroll handler for cleanup
    let discoveryWheelHandler = null; // Reference to wheel handler for cleanup
    let discoveryTouchStartHandler = null; // Reference to touchstart handler for cleanup
    let discoveryTouchMoveHandler = null; // Reference to touchmove handler for cleanup

    /************ Helpers ************/

    /**
     * Fetches collection data from Jellyfin API
     * @param {string} collectionId - The collection ID to fetch
     * @returns {Promise<Object>} - Collection data with Items array
     */
    async function fetchCollectionData(collectionId) {
        const apiClient = window.ApiClient;
        const serverUrl = apiClient.serverAddress();
        const token = apiClient.accessToken();
        const userId = apiClient.getCurrentUserId();
        
        const url = `${serverUrl}/Users/${userId}/Items?ParentId=${collectionId}&Fields=ItemCounts%2CPrimaryImageAspectRatio%2CCanDelete%2CMediaSourceCount%2COverview%2CTaglines`;
        
        try {
            const response = await fetch(url, {
                headers: {
                    "Authorization": `MediaBrowser Token="${token}"`
                }
            });
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            const data = await response.json();
            return data;
        } catch (err) {
            ERR(`Failed to fetch collection data for ${collectionId}:`, err);
            return { Items: [] };
        }
    }

    async function loadItemsForSectionConfig(sectionConfig) {
        const apiClient = window.ApiClient;
        const serverAddress = apiClient.serverAddress();
        const token = apiClient.accessToken();
        const userId = apiClient.getCurrentUserId();
        const type = sectionConfig.type || 'Genre';
        const source = sectionConfig.source || '';
        const searchTerm = sectionConfig.searchTerm || '';
        const includeItemTypes = Array.isArray(sectionConfig.includeItemTypes) && sectionConfig.includeItemTypes.length > 0 
            ? sectionConfig.includeItemTypes.join(',') 
            : (sectionConfig.includeItemTypes || 'Movie');
        const sortOrder = sectionConfig.sortOrder || defaultSortOrder;
        const sortOrderDirection = sectionConfig.sortOrderDirection || 'Ascending';
        const itemLimit = sectionConfig.itemLimit || defaultItemLimit;
        
        // Parse additional query options
        const additionalOptions = {};
        if (Array.isArray(sectionConfig.additionalQueryOptions)) {
            sectionConfig.additionalQueryOptions.forEach(option => {
                if (option && option.key) {
                    let value = option.value;
                    // Handle booleans
                    if (value === 'true' || value === true) value = true;
                    else if (value === 'false' || value === false) value = false;
                    
                    additionalOptions[option.key] = value;
                }
            });
        }
        
        if (Object.keys(additionalOptions).length > 0) {
            LOG('Applied additional query options:', additionalOptions);
        }

        let allItems = [];

        const sources = source.split(',').map(s => s.trim()).filter(Boolean);
        // For Parent type, empty sources is valid (means "Any")
        if (sources.length === 0 && type !== 'Parent') {
            return allItems;
        }

        try {
            // Base parameters that apply to all queries
            // Use defaults if not overridden by additionalOptions
            const baseParams = {
                userId: userId,
                Recursive: true,
                ...additionalOptions
            };

            // Add search term if provided and not already in additional options
            if (searchTerm && !baseParams.SearchTerm) {
                baseParams.SearchTerm = searchTerm;
            }

            if (type === 'Genre') {
                // Combine all genres into a single query
                const genresParam = sources.map(s => encodeURIComponent(s)).join('|');

                const options = {
                    Genres: genresParam,
                    IncludeItemTypes: includeItemTypes,
                    Fields: 'PrimaryImageAspectRatio,DateCreated,Overview,Taglines,ProductionYear,RecursiveItemCount,ChildCount',
                    Limit: itemLimit,
                    SortBy: sortOrder,
                    SortOrder: sortOrderDirection,
                    ...baseParams
                }

                const data = await window.apiHelper.getItems(options, true);
                allItems = data.Items || [];
            } else if (type === 'Tag') {
                // Combine all tags into a single query
                const tagsParam = sources.map(s => encodeURIComponent(s)).join(',');

                const options = {
                    Tags: tagsParam,
                    IncludeItemTypes: includeItemTypes,
                    Fields: 'PrimaryImageAspectRatio,DateCreated,Overview,Taglines,ProductionYear,RecursiveItemCount,ChildCount',
                    Limit: itemLimit,
                    SortBy: sortOrder,
                    SortOrder: sortOrderDirection,
                    ...baseParams
                }

                const data = await window.apiHelper.getItems(options, true);
                allItems = data.Items || [];
            } else if (type === 'Collection') {
                // For collections, we need to query each collection separately as they use ParentId
                // But we can still use a single approach by collecting all items first
                const existingIds = new Set();
                for (const collectionId of sources) {
                    try {
                        const queryParams = {
                            ParentId: collectionId,
                            IncludeItemTypes: includeItemTypes,
                            Fields: 'ItemCounts,Overview,Taglines',
                            Limit: itemLimit,
                            SortBy: sortOrder,
                            SortOrder: sortOrderDirection,
                            ...baseParams
                        };
                        
                        const collectionData = await window.apiHelper.getItems(queryParams, true);
                        if (collectionData.Items && collectionData.Items.length > 0) {
                            collectionData.Items.forEach(item => {
                                if (item && item.Id && !existingIds.has(item.Id)) {
                                    allItems.push(item);
                                    existingIds.add(item.Id);
                                }
                            });
                        }
                    } catch (err) {
                        WARN(`Error fetching collection ${collectionId}:`, err);
                    }
                }
                
                // Apply sorting and limit after collecting all items
                if (sortOrder === 'Random') {
                    allItems.sort(() => Math.random() - 0.5);
                } else if (window.cardBuilder && typeof window.cardBuilder.sortItems === 'function') {
                    allItems = window.cardBuilder.sortItems(allItems, sortOrder, sortOrderDirection);
                }
                allItems = allItems.slice(0, itemLimit);
            } else if (type === 'Playlist') {
                // For playlists, similar to collections - query each separately
                const existingIds = new Set();
                for (const playlistId of sources) {
                    try {
                        const queryParams = {
                            ParentId: playlistId,
                            IncludeItemTypes: includeItemTypes,
                            Fields: 'Overview,Taglines',
                            Limit: itemLimit,
                            SortBy: sortOrder,
                            SortOrder: sortOrderDirection,
                            ...baseParams
                        };
                        
                        const playlistData = await window.apiHelper.getItems(queryParams, true);
                        if (playlistData.Items && playlistData.Items.length > 0) {
                            playlistData.Items.forEach(item => {
                                if (item && item.Id && !existingIds.has(item.Id)) {
                                    allItems.push(item);
                                    existingIds.add(item.Id);
                                }
                            });
                        }
                    } catch (err) {
                        WARN(`Error fetching playlist ${playlistId}:`, err);
                    }
                }
                
                // Apply sorting and limit after collecting all items
                if (sortOrder === 'Random') {
                    allItems.sort(() => Math.random() - 0.5);
                } else if (window.cardBuilder && typeof window.cardBuilder.sortItems === 'function') {
                    allItems = window.cardBuilder.sortItems(allItems, sortOrder, sortOrderDirection);
                }
                allItems = allItems.slice(0, itemLimit);
            } else if (type === 'Parent') {
                // Parent type: query with ParentId(s) or without if source is empty ("Any")
                const existingIds = new Set();
                
                if (sources.length === 0) {
                    // No parent IDs specified - query all items (no ParentId filter)
                    try {
                        const queryParams = {
                            IncludeItemTypes: includeItemTypes,
                            Fields: 'PrimaryImageAspectRatio,DateCreated,Overview,ProductionYear',
                            Limit: itemLimit,
                            SortBy: sortOrder,
                            SortOrder: sortOrderDirection,
                            ...baseParams
                        };
                        
                        const response = await window.apiHelper.getItems(queryParams, true);
                        if (response.Items && response.Items.length > 0) {
                            allItems = response.Items;
                        }
                    } catch (err) {
                        WARN(`Error fetching items (Parent type, no ParentId):`, err);
                    }
                } else {
                    // Query each parent ID separately
                    for (const parentId of sources) {
                        try {
                            const queryParams = {
                                ParentId: parentId,
                                IncludeItemTypes: includeItemTypes,
                                Fields: 'PrimaryImageAspectRatio,DateCreated,Overview,ProductionYear',
                                Limit: itemLimit * sources.length,
                                SortBy: sortOrder,
                                SortOrder: sortOrderDirection,
                                ...baseParams
                            };
                            
                            const parentData = await window.apiHelper.getItems(queryParams, true);
                            if (parentData.Items && parentData.Items.length > 0) {
                                parentData.Items.forEach(item => {
                                    if (item && item.Id && !existingIds.has(item.Id)) {
                                        allItems.push(item);
                                        existingIds.add(item.Id);
                                    }
                                });
                            }
                        } catch (err) {
                            WARN(`Error fetching items for parent ${parentId}:`, err);
                        }
                    }
                    
                    // Apply sorting and limit after collecting all items
                    if (sortOrder === 'Random') {
                        allItems.sort(() => Math.random() - 0.5);
                    } else if (window.cardBuilder && typeof window.cardBuilder.sortItems === 'function') {
                        allItems = window.cardBuilder.sortItems(allItems, sortOrder, sortOrderDirection);
                    }
                    allItems = allItems.slice(0, itemLimit);
                }
            }
        } catch (err) {
            WARN('Error loading items for section config:', err);
        }

        return allItems;
    }

    /**
     * Renders a custom home section
     * @param {Object} section - Section configuration object
     * @param {HTMLElement} container - Container to append the section to
     * @returns {boolean} - Success status
     */
    async function renderCustomSection(section, container) {
        try {
            // Support legacy structure (sourceId/id without source)
            // Create a copy to avoid mutating the original config object
            const sectionConfig = { ...section };
            
/*             if (!sectionConfig.source && (sectionConfig.sourceId || sectionConfig.id)) {
                sectionConfig.source = sectionConfig.sourceId || sectionConfig.id;
            } */
            
            // Ensure ID exists for renderSection
            if (!sectionConfig.id) {
                sectionConfig.id = sectionConfig.source;
            }
            
            return await renderSection(sectionConfig, container, 'custom');            
        } catch (err) {
            ERR(`Error rendering section ${section.name}:`, err);
            return false;
        }
    }

    /**
     * Renders all custom home sections
     * @param {HTMLElement} container - Container to append sections to
     */
    async function renderAllCustomSections(container) {
        const results = await Promise.all(
            customHomeSections.map(section => {
                if (section.discoveryEnabled ) {
                    return false;
                }

                // Check if section is already on the page
                const sectionContainer = container.querySelector(`[data-custom-section-id="${section.id}"]`);
                if (sectionContainer) {
                    LOG(`Section ${section.name} already on the page, skipping...`);
                    return false;
                }

                return renderCustomSection(section, container);
            })
        );
        
        const successCount = results.filter(Boolean).length;
        LOG(`Rendered ${successCount}/${customHomeSections.length} custom sections`);
    }

    /**
     * Renders trending movies section (stub for future implementation)
     * @param {HTMLElement} container - Container to append the section to
     * @returns {boolean} - Success status
     */
    function renderTrendingMoviesSection(container) {
        // TODO: Implement trending movies section
        LOG('Trending Movies section not yet implemented');
        return false;
    }

    /**
     * Renders trending series section (stub for future implementation)
     * @param {HTMLElement} container - Container to append the section to
     * @returns {boolean} - Success status
     */
    function renderTrendingSeriesSection(container) {
        // TODO: Implement trending series section
        LOG('Trending Series section not yet implemented');
        return false;
    }

    /**
     * Renders all new and trending sections
     * @param {HTMLElement} container - Container to append sections to
     */
    async function renderAllNewAndTrendingSections(container) {
        if (!enableNewAndTrending) {
            LOG('New and Trending sections disabled, skipping...');
            return;
        }
        
        const sectionsToRender = [];
        
        // Add new movies section if enabled and not already on the page
        const newMoviesContainer = container.querySelector('[data-custom-section-id="new-movies"]');

        if (enableNewMovies && !newMoviesContainer) {   
            sectionsToRender.push(renderNewMoviesSection(container));
        }
        
        // Add new episodes section if enabled and not already on the page
        const newEpisodesContainer = container.querySelector('[data-custom-section-id="new-episodes"]');

        if (enableNewEpisodes && !newEpisodesContainer) {
            sectionsToRender.push(renderNewEpisodesSection(container));
        }
        
        if (sectionsToRender.length === 0) {
            return;
        }
        
        const results = await Promise.all(sectionsToRender);
        const successCount = results.filter(Boolean).length;
        LOG(`Rendered ${successCount}/${sectionsToRender.length} new and trending sections`);
    }

    /**
     * Renders Recently Added in Library sections
     * @param {HTMLElement} container - Container to append sections to
     */
    async function renderAllRecentlyAddedInLibrarySections(container) {
        // Read fresh config to ensure migration updates are picked up
        const config = window.KefinTweaksConfig?.homeScreen?.recentlyAddedInLibrary || {};

        if (Object.keys(config).length === 0) {
            return;
        }

        const libraryIds = Object.keys(config);
        const sectionsToRender = [];

        libraryIds.forEach(libraryId => {
            const sectionConfig = config[libraryId];
            if (sectionConfig && sectionConfig.enabled !== false) {
                // Check if already rendered
                const sectionId = `recently-added-${libraryId}`;
                if (!container.querySelector(`[data-custom-section-id="${sectionId}"]`)) {
                    sectionsToRender.push(renderRecentlyAddedInLibrarySection(libraryId, sectionConfig, container));
                }
            }
        });

        if (sectionsToRender.length === 0) {
            return;
        }

        const results = await Promise.all(sectionsToRender);
        const successCount = results.filter(Boolean).length;
        LOG(`Rendered ${successCount}/${sectionsToRender.length} recently added library sections`);
    }

    /**
     * Renders a single Recently Added in Library section
     * @param {string} libraryId - The library ID
     * @param {Object} sectionConfig - Configuration for this section
     * @param {HTMLElement} container - Container to append section to
     */
    async function renderRecentlyAddedInLibrarySection(libraryId, sectionConfig, container) {
        if (sectionConfig.enabled === false) return false;

        const userId = ApiClient.getCurrentUserId();
        const itemLimit = sectionConfig.itemLimit || 30;
        
        // Determine IncludeItemTypes and viewMoreUrl based on library type
        let includeItemTypes = 'Movie,Episode'; // Default fallback
        let viewMoreUrl = `#/list.html?parentId=${libraryId}&serverId=${ApiClient.serverId()}`; // Default fallback

        try {
            const library = await window.ApiClient.getItem(userId, libraryId);
            if (library) {
                if (library.CollectionType === 'movies') {
                    includeItemTypes = 'Movie';
                    viewMoreUrl = `#/movies.html?topParentId=${libraryId}&collectionType=movies&tab=1`;
                } else if (library.CollectionType === 'tvshows') {
                    includeItemTypes = 'Episode';
                    viewMoreUrl = `#/tv.html?topParentId=${libraryId}&collectionType=tvshows&tab=1`;
                }
            }
        } catch (e) {
            WARN(`Failed to fetch library info for ${libraryId}`, e);
        }
        
        // Use Users/Items/Latest endpoint logic
        // Since apiHelper might not have a dedicated getLatestItems, we construct query
        const params = {
            Limit: itemLimit,
            ParentId: libraryId,
            ImageTypeLimit: 1,
            EnableImageTypes: 'Primary,Backdrop,Thumb',
            IncludeItemTypes: includeItemTypes
        };
        
        const queryParams = Object.entries(params)
            .map(([key, value]) => `${key}=${encodeURIComponent(value)}`)
            .join('&');
            
        const url = `${ApiClient.serverAddress()}/Users/${userId}/Items/Latest?${queryParams}`;
        
        try {
            const response = await fetch(url, {
                headers: {
                    'Authorization': `MediaBrowser Token="${ApiClient.accessToken()}"`
                }
            });
            
            if (!response.ok) throw new Error(`Fetch failed: ${response.status}`);
            const items = await response.json();
            
            if (!items || items.length === 0) return false;
            
            // Render section
            if (!window.cardBuilder || !window.cardBuilder.renderCards) {
                WARN("cardBuilder.renderCards not available");
                return false;
            }
            
            const cardContainer = window.cardBuilder.renderCards(
                items,
                sectionConfig.name || `Recently Added`,
                viewMoreUrl,
                true, // overflowCard (use standard overflow style for horizontal scroll)
                sectionConfig.cardFormat || 'Poster',
                false, // sortOrder (already sorted)
                'Ascending'
            );
            
            const sectionId = `recently-added-${libraryId}`;
            cardContainer.setAttribute('data-custom-section-id', sectionId);
            cardContainer.setAttribute('data-custom-section-name', sectionConfig.name || `Recently Added`);
            cardContainer.style.order = sectionConfig.order || 11;
            
            container.appendChild(cardContainer);
            return true;
            
        } catch (err) {
            ERR(`Error rendering recently added library section ${libraryId}:`, err);
            return false;
        }
    }

    /************ Seasonal Section Helpers ************/

    /**
     * Checks if current date is within Halloween period (Oct 1-31)
     * @returns {boolean} - True if within Halloween period
     */
    function isHalloweenPeriod() {
        const now = new Date();
        const month = now.getMonth() + 1; // getMonth() returns 0-11
        const day = now.getDate();
        return month === 10 && day >= 1 && day <= 31;
    }

    /**
     * Checks if current date is within Christmas period (Dec 1-30)
     * @returns {boolean} - True if within Christmas period
     */
    function isChristmasPeriod() {
        const now = new Date();
        const month = now.getMonth() + 1;
        const day = now.getDate();
        return month === 12 && day >= 1 && day <= 30;
    }

    /**
     * Checks if current date is within New Years period (Dec 31 + Jan 1)
     * @returns {boolean} - True if within New Years period
     */
    function isNewYearsPeriod() {
        const now = new Date();
        const month = now.getMonth() + 1;
        const day = now.getDate();
        return (month === 12 && day === 31) || (month === 1 && day === 1);
    }

    /**
     * Checks if current date is within Valentine's Day period (Feb 14)
     * @returns {boolean} - True if within Valentine's Day period
     */
    function isValentinesPeriod() {
        const now = new Date();
        const month = now.getMonth() + 1;
        const day = now.getDate();
        return month === 2 && day === 14;
    }

    /**
     * Fetches all movie genres from Jellyfin API and caches them
     * @returns {Promise<Array>} - Array of genre objects with Name, ImageTags, and Id
     */
    async function fetchAndCacheMovieGenres() {
        const apiClient = window.ApiClient;
        const serverUrl = apiClient.serverAddress();
        const token = apiClient.accessToken();
        
        try {
            const response = await fetch(`${serverUrl}/Genres?IncludeItemTypes=Movie`, {
                headers: {
                    "Authorization": `MediaBrowser Token="${token}"`
                }
            });
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            const data = await response.json();
            const genres = data.Items || [];
            
            // Optimize genres to only include essential fields
            const optimizedGenres = genres.map(genre => ({
                Id: genre.Id,
                Name: genre.Name,
                ImageTags: genre.ImageTags || {},
                MovieCount: genre.MovieCount
            }));
            
            // Cache the optimized genres
            const cache = new window.LocalStorageCache();
            cache.set('movieGenres', optimizedGenres);
            LOG(`Cached ${optimizedGenres.length} movie genres`);
            
            return optimizedGenres;
        } catch (err) {
            ERR('Failed to fetch movie genres:', err);
            return [];
        }
    }

    /**
     * Gets a genre ID from cached movie genres
     * @param {string} genreName - Name of the genre to find
     * @returns {Promise<string|null>} - Genre ID or null if not found
     */
    async function getGenreId(genreName) {
        const cache = new window.LocalStorageCache();
        
        // Try to get from cache first
        let movieGenres = cache.get('movieGenres');
        
        // If not in cache or cache is invalid, fetch and cache
        if (!movieGenres || movieGenres.length === 0) {
            LOG('Movie genres not in cache, fetching...');
            movieGenres = await fetchAndCacheMovieGenres();
        }
        
        // Find the genre by name (case insensitive)
        const genre = movieGenres.find(g => g.Name.toLowerCase() === genreName.toLowerCase());
        return genre ? genre.Id : null;
    }

    /**
     * Fetches Halloween movie data from Jellyfin API
     * @returns {Promise<Object>} - Object containing halloween, horror, and thriller movies
     */
    async function fetchHalloweenMovieData() {
        const apiClient = window.ApiClient;
        const serverUrl = apiClient.serverAddress();
        const token = apiClient.accessToken();
        const userId = apiClient.getCurrentUserId();
        const serverId = apiClient.serverId();
        
        // No longer fetching people data for Halloween
        const fieldsParam = '';
        
        // Fetch genre IDs for ViewMore URLs
        const [horrorGenreId, thrillerGenreId] = await Promise.all([
            getGenreId('Horror'),
            getGenreId('Thriller')
        ]);
        
        const queries = [
            {
                name: 'halloween',
                url: `${serverUrl}/Items?userId=${userId}&Tags=halloween&IncludeItemTypes=Movie&Recursive=true&Limit=200${fieldsParam}`,
                viewMoreUrl: null
            },
            {
                name: 'horror',
                url: `${serverUrl}/Items?userId=${userId}&Genres=Horror&IncludeItemTypes=Movie&Recursive=true&SortBy=Random&Limit=200${fieldsParam}`,
                viewMoreUrl: horrorGenreId ? `/web/#/list.html?genreId=${horrorGenreId}&serverId=${serverId}` : null
            },
            {
                name: 'thriller',
                url: `${serverUrl}/Items?userId=${userId}&Genres=Thriller&IncludeItemTypes=Movie&Recursive=true&SortBy=Random&Limit=200${fieldsParam}`,
                viewMoreUrl: thrillerGenreId ? `/web/#/list.html?genreId=${thrillerGenreId}&serverId=${serverId}` : null
            }
        ];
        
        try {
            const results = await Promise.all(
                queries.map(async (query) => {
                    const response = await fetch(query.url, {
                        headers: {
                            "Authorization": `MediaBrowser Token="${token}"`
                        }
                    });
                    
                    if (!response.ok) {
                        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                    }
                    
                    const data = await response.json();
                    return {
                        name: query.name,
                        items: data.Items || []
                    };
                })
            );
            
            // Process results
            const halloweenItems = results.find(r => r.name === 'halloween')?.items || [];
            const horrorItems = results.find(r => r.name === 'horror')?.items || [];
            const thrillerItems = results.find(r => r.name === 'thriller')?.items || [];
            
            // Combine all items into halloweenMovies, removing duplicates by ID
            const allItems = [...halloweenItems];
            const existingIds = new Set(halloweenItems.map(item => item.Id));
            
            // Add horror items that aren't already in halloween
            horrorItems.forEach(item => {
                if (!existingIds.has(item.Id)) {
                    allItems.push(item);
                    existingIds.add(item.Id);
                }
            });
            
            // Add thriller items that aren't already in halloween or horror
            thrillerItems.forEach(item => {
                if (!existingIds.has(item.Id)) {
                    allItems.push(item);
                    existingIds.add(item.Id);
                }
            });
            
            return {
                allHalloweenMovies: allItems,
                halloweenMovies: halloweenItems,
                horrorMovies: horrorItems,
                thrillerMovies: thrillerItems,
                viewMoreUrls: {
                    horror: queries.find(q => q.name === 'horror')?.viewMoreUrl || null,
                    thriller: queries.find(q => q.name === 'thriller')?.viewMoreUrl || null
                }
            };
            
        } catch (err) {
            ERR('Failed to fetch Halloween movie data:', err);
            return {
                allHalloweenMovies: [],
                halloweenMovies: [],
                horrorMovies: [],
                thrillerMovies: [],
                viewMoreUrls: {
                    horror: null,
                    thriller: null
                }
            };
        }
    }



    /**
     * Fetches and processes top people data from all movies using pagination
     * @returns {Promise<Object|null>} - Top people data or null if failed
     */
    async function fetchTopPeople() {
        const apiClient = window.ApiClient;
        const serverUrl = apiClient.serverAddress();
        const token = apiClient.accessToken();
        const userId = apiClient.getCurrentUserId();
        const cache = new window.LocalStorageCache();
        const indexedDBCache = new window.IndexedDBCache();
        
        try {
            LOG('Starting paginated fetch of movies for people data processing...');
            
            let startIndex = 0;
            const limit = 500;
            let hasMoreData = true;
            let peopleMap = null; // Will hold raw (unfiltered) people data
            
            // Load existing raw people data if available (for resuming) - use IndexedDB
            const existingRawData = await indexedDBCache.get('movies_top_people_raw', userId);
            if (existingRawData && !existingRawData.isComplete) {
                const moviesProcessed = existingRawData.moviesProcessedCount;
                if (moviesProcessed > 0) {
                    startIndex = moviesProcessed;
                    // Reconstruct Map from cached array
                    peopleMap = new Map(existingRawData.peopleData || []);
                    LOG(`Resuming from existing data: ${moviesProcessed} movies already processed, ${peopleMap.size} people in cache`);
                }
            }
            
            // Fetch movies in chunks of 500
            while (hasMoreData) {
                const url = `${serverUrl}/Items?userId=${userId}&IncludeItemTypes=Movie&Recursive=true&Fields=People&Limit=${limit}&StartIndex=${startIndex}`;
                
                LOG(`Fetching movies ${startIndex} to ${startIndex + limit - 1}...`);
                
                const response = await fetch(url, {
                    headers: {
                        "Authorization": `MediaBrowser Token="${token}"`
                    }
                });
                
                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                }
                
                const data = await response.json();
                const movies = data.Items || [];
                
                if (movies.length === 0) {
                    hasMoreData = false;
                    LOG('No more movies to fetch');
                } else {
                    // Process new movies and merge with existing people data
                    peopleMap = processPeopleDataRaw(movies, peopleMap);
                    startIndex += movies.length;
                    
                    LOG(`Fetched ${movies.length} movies, total processed: ${startIndex}, people tracked: ${peopleMap ? peopleMap.size : 0}`);
                    
                    // Filter for display (but cache raw data)
                    const filteredData = filterPeopleData(peopleMap);
                    if (filteredData) {
                        // Update the global moviesTopPeople immediately so discovery sections can use it
                        moviesTopPeople = filteredData;
                        LOG(`Updated moviesTopPeople with partial data: ${filteredData.actors.length} actors, ${filteredData.directors.length} directors, ${filteredData.writers.length} writers (${startIndex} movies processed)`);
                    }
                    
                    // Cache RAW (unfiltered) data for resuming - use IndexedDB for large data
                    // Convert Map to array for JSON serialization
                    const rawDataToCache = {
                        isComplete: movies.length < limit,
                        moviesProcessedCount: startIndex,
                        peopleData: Array.from(peopleMap.entries())
                    };
                    await indexedDBCache.set('movies_top_people_raw', rawDataToCache, userId, 7 * 24 * 60 * 60 * 1000);
                    
                    // If we got less than the limit, we've reached the end
                    if (movies.length < limit) {
                        hasMoreData = false;
                        isPeopleCacheComplete = true;
                        LOG('Reached end of movies, people cache is complete');
                    }
                }
            }
            
            // Final processing: filter the complete raw data
            LOG(`Final filtering of people data from ${startIndex} movies...`);
            const finalPeopleData = filterPeopleData(peopleMap);
            
            if (finalPeopleData) {
                // Mark as complete
                finalPeopleData.isComplete = true;
                
                // Update global variable
                moviesTopPeople = finalPeopleData;
                
                // Cache final filtered data (for quick loading) - use IndexedDBCache for larger data with items
                await indexedDBCache.set('movies_top_people', finalPeopleData, userId, 7 * 24 * 60 * 60 * 1000);
                
                // Also remove raw cache since we're complete (optional, saves space)
                await indexedDBCache.clear('movies_top_people_raw', userId);
                
                LOG(`Final cached people data: ${finalPeopleData.actors.length} actors, ${finalPeopleData.directors.length} directors, ${finalPeopleData.writers.length} writers`);
            }
            
            return finalPeopleData;
            
        } catch (err) {
            ERR('Failed to fetch top people data:', err);
            return null;
        }
    }

    /**
     * Extracts necessary item data for caching (similar to watchlist format)
     * @param {Object} item - Full Jellyfin item object
     * @returns {Object} - Optimized item data for storage
     */
    function extractItemDataForCache(item) {
        return {
            Id: item.Id,
            Type: item.Type,
            MediaType: item.MediaType,
            Name: item.Name,
            SeriesId: item.SeriesId,
            SeriesName: item.SeriesName,
            SeriesPrimaryImageTag: item.SeriesPrimaryImageTag,
            ParentBackdropItemId: item.ParentBackdropItemId,
            ParentBackdropImageTags: item.ParentBackdropImageTags,
            ParentThumbImageTag: item.ParentPrimaryImageTags,
            IndexNumber: item.IndexNumber,
            ParentIndexNumber: item.ParentIndexNumber,
            ImageTags: item.ImageTags,
            BackdropImageTags: item.BackdropImageTags,
            PremiereDate: item.PremiereDate,
            ProductionYear: item.ProductionYear,
            UserData: {
                IsFavorite: item.UserData?.IsFavorite || false,
                Played: item.UserData?.Played || false,
                LastPlayedDate: item.UserData?.LastPlayedDate || null,
                PlayCount: item.UserData?.PlayCount || 0,
                Likes: item.UserData?.Likes || false
            }
        };
    }

    /**
     * Processes people data from movies array and returns RAW data (all people, unfiltered)
     * @param {Array} movies - Array of movie objects with People data
     * @param {Map} existingPeopleMap - Optional existing people map to merge with
     * @returns {Map|null} - Map of all people data (unfiltered) or null if failed
     */
    function processPeopleDataRaw(movies, existingPeopleMap = null) {
        try {
            const peopleMap = existingPeopleMap ? new Map(existingPeopleMap) : new Map();
            
            movies.forEach(movie => {
                // Extract item data for caching
                const itemData = extractItemDataForCache(movie);
                
                if (movie.People) {
                    movie.People.forEach(person => {
                        const key = person.Id;
                        if (!peopleMap.has(key)) {
                            peopleMap.set(key, {
                                id: person.Id,
                                name: person.Name,
                                directorCount: 0,
                                writerCount: 0,
                                actorCount: 0,
                                directorItems: [],
                                writerItems: [],
                                actorItems: []
                            });
                        }
                        
                        const personData = peopleMap.get(key);
                        if (person.Type === 'Director') {
                            personData.directorCount++;
                            // Check if item already exists by Id
                            if (!personData.directorItems.some(item => item.Id === movie.Id)) {
                                personData.directorItems.push(itemData);
                            }
                        } else if (person.Type === 'Writer') {
                            personData.writerCount++;
                            if (!personData.writerItems.some(item => item.Id === movie.Id)) {
                                personData.writerItems.push(itemData);
                            }
                        } else if (person.Type === 'Actor') {
                            personData.actorCount++;
                            if (!personData.actorItems.some(item => item.Id === movie.Id)) {
                                personData.actorItems.push(itemData);
                            }
                        }
                    });
                }
            });
            
            return peopleMap;
            
        } catch (err) {
            ERR('Failed to process people data:', err);
            return null;
        }
    }

    /**
     * Filters and sorts raw people data by minPeopleAppearances, returning top 100 per category
     * @param {Map} peopleMap - Map of all people data (unfiltered)
     * @returns {Object|null} - Filtered and sorted people data or null if failed
     */
    function filterPeopleData(peopleMap) {
        try {
            if (!peopleMap) {
                return null;
            }
            
            const allPeople = Array.from(peopleMap.values());
            
            const topDirectors = allPeople
                .filter(person => person.directorCount >= minPeopleAppearances)
                .sort((a, b) => b.directorCount - a.directorCount)
                .slice(0, 100)
                .map(person => ({
                    id: person.id,
                    name: person.name,
                    count: person.directorCount,
                    items: person.directorItems || []
                }));
                
            const topWriters = allPeople
                .filter(person => person.writerCount >= minPeopleAppearances)
                .sort((a, b) => b.writerCount - a.writerCount)
                .slice(0, 100)
                .map(person => ({   
                    id: person.id,
                    name: person.name,
                    count: person.writerCount,
                    items: person.writerItems || []
                }));
                
            const topActors = allPeople
                .filter(person => person.actorCount >= minPeopleAppearances)
                .sort((a, b) => b.actorCount - a.actorCount)
                .slice(0, 100)
                .map(person => ({   
                    id: person.id,
                    name: person.name,
                    count: person.actorCount,
                    items: person.actorItems || []
                }));
            
            return {
                actors: topActors,
                directors: topDirectors,
                writers: topWriters
            };
            
        } catch (err) {
            ERR('Failed to filter people data:', err);
            return null;
        }
    }

    /**
     * Processes people data from movies array (legacy function, now uses raw processing + filtering)
     * @param {Array} movies - Array of movie objects with People data
     * @returns {Object|null} - Processed people data or null if failed
     */
    function processPeopleData(movies) {
        const peopleMap = processPeopleDataRaw(movies);
        return filterPeopleData(peopleMap);
    }


    /**
     * Initializes the people cache in the background
     */
    async function initializePeopleCache() {
        // Prevent concurrent initialization
        if (isInitializingPeopleCache) {
            LOG('People cache initialization already in progress, skipping...');
            return;
        }
        
        // Check if we already have complete data
        if (moviesTopPeople !== null && isPeopleCacheComplete) {
            LOG('People cache already loaded and complete');
            return;
        }
        
        const indexedDBCache = new window.IndexedDBCache();
        const apiClient = window.ApiClient;
        const userId = apiClient.getCurrentUserId();
        
        // First, check if we have valid complete filtered data (in IndexedDBCache)
        if (await indexedDBCache.isCacheValid('movies_top_people', userId)) {
            const cachedData = await indexedDBCache.get('movies_top_people', userId);
            
            // Check if data is complete
            if (cachedData && cachedData.isComplete) {
                moviesTopPeople = cachedData;
                isPeopleCacheComplete = true;
                LOG('Loaded complete top people data from IndexedDB cache');
                return;
            }
        }
        
        // If no complete data, check for raw partial data (in IndexedDBCache)
        if (await indexedDBCache.isCacheValid('movies_top_people_raw', userId)) {
            const rawCachedData = await indexedDBCache.get('movies_top_people_raw', userId);
            
            if (rawCachedData && rawCachedData.peopleData) {
                // Reconstruct Map and filter for immediate display
                const peopleMap = new Map(rawCachedData.peopleData);
                const filteredData = filterPeopleData(peopleMap);
                
                if (filteredData) {
                    moviesTopPeople = filteredData;
                    isPeopleCacheComplete = rawCachedData.isComplete || false;
                    LOG(`Loaded partial top people data from raw cache (${rawCachedData.moviesProcessedCount || 0} movies), ${filteredData.actors.length} actors, ${filteredData.directors.length} directors, ${filteredData.writers.length} writers`);
                    
                    // If incomplete, we'll continue fetching in background
                    if (!isPeopleCacheComplete) {
                        // Continue in background
                    } else {
                        // It's marked complete but wasn't in filtered cache, update filtered cache
                        filteredData.isComplete = true;
                        await indexedDBCache.set('movies_top_people', filteredData, userId, 7 * 24 * 60 * 60 * 1000);
                        await indexedDBCache.clear('movies_top_people_raw', userId);
                        return;
                    }
                }
            }
        }
        
        // Set flag to prevent concurrent calls
        isInitializingPeopleCache = true;
        
        try {
            // Fetch/continue fetching data in the background
            LOG('Fetching/continuing top people data in background...');
            const result = await fetchTopPeople();
            if (result) {
                moviesTopPeople = result;
                isPeopleCacheComplete = result.isComplete || false;
            }
        } finally {
            // Always reset the flag
            isInitializingPeopleCache = false;
        }
    }

    /**
     * Navigates to the watchlist tab by clicking the appropriate tab button
     */
    async function getWatchlistUrl() {
        let homePageSuffix = '.html';
        if (ApiClient._serverInfo.Version?.split('.')[1] > 10) {
            homePageSuffix = '';
        }

        if (!window.KefinTweaksUtils || !window.KefinTweaksUtils.getWatchlistTabIndex || !window.KefinTweaksUtils.getWatchlistTabIndex()) {
            WARN('KefinTweaksUtils not available');
            return null;
        }

        const visibleWatchlistTabIndex = await window.KefinTweaksUtils.getWatchlistTabIndex();

        if (visibleWatchlistTabIndex) {
            return `#/home${homePageSuffix}?tab=${visibleWatchlistTabIndex}`;
        } else {
            WARN('Watchlist tab not found');
            return null;
        }
    }

    /************ Discovery Section Helpers ************/

    /**
     * Fetches similar content for a movie or series
     * @param {string} itemId - The item ID
     * @param {string} type - 'Movie' or 'Series'
     * @returns {Promise<Array>} - Array of similar items
     */
    async function fetchSimilarContent(itemId, type) {
        const apiClient = window.ApiClient;
        const serverUrl = apiClient.serverAddress();
        const token = apiClient.accessToken();
        
        const endpoint = type === 'Movie' ? 'Movies' : 'Shows';
        // Double the limit to account for filtering out played items
        // Sadly Jellyfin API doesn't seem to support filtering out played items in the Similar endpoint
        const url = `${serverUrl}/${endpoint}/${itemId}/Similar?limit=32`;
        
        try {
            const response = await fetch(url, {
                headers: {
                    "Authorization": `MediaBrowser Token="${token}"`
                }
            });
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            const data = await response.json();
            const allItems = data.Items || [];
            
            // Return all items, filtering will happen in applyDiscoverySectionOrdering if needed
            // (shuffled to avoid always showing the same items)
            return [...allItems].sort(() => Math.random() - 0.5);
            
        } catch (err) {
            ERR(`Failed to fetch similar content for ${type} ${itemId}:`, err);
            return [];
        }
    }

    /**
     * Fetches items with IsFavorite filter
     * @param {string} includeItemTypes - Item types to include (e.g., 'Movie,Series')
     * @returns {Promise<Array>} - Array of favorite items
     */
    async function fetchFavoriteItems(includeItemTypes = 'Movie,Series') {
        const apiClient = window.ApiClient;
        const serverUrl = apiClient.serverAddress();
        const token = apiClient.accessToken();
        const userId = apiClient.getCurrentUserId();
        
        const url = `${serverUrl}/Items?userId=${userId}&IncludeItemTypes=${includeItemTypes}&SortBy=DatePlayed&SortOrder=Descending&Recursive=true&Limit=16&Filters=IsFavorite`;
        
        try {
            const response = await fetch(url, {
                headers: {
                    "Authorization": `MediaBrowser Token="${token}"`
                }
            });
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            const data = await response.json();
            return data.Items || [];
        } catch (err) {
            ERR(`Failed to fetch favorite items:`, err);
            return [];
        }
    }

    /**
     * Gets random item from array
     * @param {Array} items - Array of items
     * @param {Set} trackingSet - Optional set to track and filter out already rendered items
     * @returns {Object|null} - Random item or null if array is empty or all items are already rendered
     */
    function getRandomItem(items, trackingSet = null) {
        if (!items || items.length === 0) return null;
        
        // If tracking set provided, filter out already rendered items
        let availableItems = items;
        if (trackingSet) {
            availableItems = items.filter(item => {
                const name = item.Name || item.name;
                return name && !trackingSet.has(name);
            });
        }
        
        // Check if we have any available items
        if (availableItems.length === 0) return null;
        
        // Get random item from available items
        const randomItem = availableItems[Math.floor(Math.random() * availableItems.length)];
        
        // Track the item if tracking set provided
        if (trackingSet && randomItem) {
            const name = randomItem.Name || randomItem.name;
            if (name) {
                trackingSet.add(name);
            }
        }
        
        return randomItem;
    }

    /**
     * Shuffles an array and returns a new shuffled copy
     * @param {Array} array - Array to shuffle
     * @returns {Array} - New shuffled array
     */
    function shuffleArray(array) {
        if (!array || array.length === 0) return [];
        const shuffled = [...array];
        for (let i = shuffled.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
        }
        return shuffled;
    }

    /**
     * Gets top N most frequent people from movie history
     * @param {Array} movies - Array of movie objects
     * @param {string} personType - 'Director' or 'Actor'
     * @param {number} limit - Number of top people to return
     * @returns {Array} - Array of person objects with counts
     */
    function getTopPeople(movies, personType, limit = 25) {
        const personCounts = {};
        
        movies.forEach(movie => {
            if (movie.People) {
                movie.People.forEach(person => {
                    if (person.Type === personType) {
                        const key = person.Id;
                        if (!personCounts[key]) {
                            personCounts[key] = {
                                ...person,
                                count: 0
                            };
                        }
                        personCounts[key].count++;
                    }
                });
            }
        });
        
        return Object.values(personCounts)
            .sort((a, b) => b.count - a.count)
            .slice(0, limit);
    }

    /**
     * Gets watchlist data from localStorageCache
     * @returns {Array} - Combined watchlist items (movies + series)
     */
    async function getWatchlistData() {
        const watchlistData = await window.apiHelper.getWatchlistItems({ IncludeItemTypes: 'Movie,Series,Season,Episode' }, true);
        
        return watchlistData.Items.sort((a, b) => {
            const dateA = new Date(a.PremiereDate || 0);
            const dateB = new Date(b.PremiereDate || 0);
            return dateB - dateA;    
        });
    }

    /**
     * Gets movie history data from localStorageCache
     * @returns {Array} - Array of watched movies
     */
    function getMovieHistoryData() {
        if (typeof window.LocalStorageCache === 'undefined') {
            WARN('LocalStorageCache not available');
            return [];
        }
        
        const cache = new window.LocalStorageCache();
        return cache.get('movies') || [];
    }

    /**
     * Gets series progress data from localStorageCache
     * @returns {Array} - Array of series with progress data
     */
    function getSeriesProgressData() {
        if (typeof window.LocalStorageCache === 'undefined') {
            WARN('LocalStorageCache not available');
            return [];
        }
        
        const cache = new window.LocalStorageCache();
        return cache.getChunked('progress') || [];
    }

    /**
     * Gets random watched movie from history (last 25 by DatePlayed)
     * @returns {Object|null} - Random watched movie or null
     */
    function getRandomWatchedMovie() {
        const movies = getMovieHistoryData();
        if (movies.length === 0) return null;
        
        // Sort by DatePlayed descending and take last 25
        const sortedMovies = movies
            .filter(movie => movie.UserData && movie.UserData.Played)
            .sort((a, b) => new Date(b.UserData.LastPlayedDate || 0) - new Date(a.UserData.LastPlayedDate || 0))
            .slice(0, 25);
        
        // Filter out already rendered movies
        const availableMovies = sortedMovies.filter(movie => 
            movie.Id && !renderedWatchedMovies.has(movie.Id)
        );
        
        if (availableMovies.length === 0) return null;
        
        const randomMovie = getRandomItem(availableMovies);
        
        // Track rendered movie
        if (randomMovie && randomMovie.Id) {
            renderedWatchedMovies.add(randomMovie.Id);
        }
        
        return randomMovie;
    }

    /**
     * Gets random watched series from progress (last 25 by lastWatchedEpisode date)
     * @returns {Object|null} - Random watched series or null
     */
    function getRandomWatchedSeries() {
        const series = getSeriesProgressData();
        if (series.length === 0) return null;
        
        // Sort by lastWatchedEpisode date and take last 25
        const sortedSeries = series
            .filter(s => s.lastWatchedEpisode && s.lastWatchedEpisode.UserData && s.lastWatchedEpisode.UserData.Played)
            .sort((a, b) => new Date(b.lastWatchedEpisode.UserData.LastPlayedDate || 0) - new Date(a.lastWatchedEpisode.UserData.LastPlayedDate || 0))
            .slice(0, 25);
        
        const randomSeries = getRandomItem(sortedSeries);

        return randomSeries ? randomSeries.series : null;
    }

    /**
     * Gets random favorite movie
     * @returns {Promise<Object|null>} - Random favorite movie or null
     */
    async function getRandomFavoriteMovie() {
        const favorites = await fetchFavoriteItems('Movie');
        if (!favorites || favorites.length === 0) return null;
        
        // Filter out already rendered movies
        const availableMovies = favorites.filter(movie => 
            movie.Id && !renderedFavoriteMovies.has(movie.Id)
        );
        
        if (availableMovies.length === 0) return null;
        
        const randomMovie = getRandomItem(availableMovies);
        
        // Track rendered movie
        if (randomMovie && randomMovie.Id) {
            renderedFavoriteMovies.add(randomMovie.Id);
        }
        
        return randomMovie;
    }

    /**
     * Gets random favorite series
     * @returns {Promise<Object|null>} - Random favorite series or null
     */
    async function getRandomFavoriteSeries() {
        const favorites = await fetchFavoriteItems('Series');
        return getRandomItem(favorites);
    }

    /**
     * Gets random recently watched movie with heavy weighting for first 5
     * @param {Set} trackingSet - Optional set to track rendered movies (defaults to renderedWatchedMovies)
     * @returns {Object|null} - Random recently watched movie or null
     */
    function getRandomRecentlyWatchedMovie(trackingSet = null) {
        const movies = getMovieHistoryData();
        if (movies.length === 0) return null;
        
        // Sort by LastPlayedDate descending and take top 10
        const sortedMovies = movies
            .filter(movie => movie.UserData && movie.UserData.Played && movie.UserData.LastPlayedDate)
            .sort((a, b) => new Date(b.UserData.LastPlayedDate) - new Date(a.UserData.LastPlayedDate))
            .slice(0, 10);
        
        if (sortedMovies.length === 0) return null;
        
        // Use provided tracking set or default to renderedWatchedMovies
        const usedTrackingSet = trackingSet || renderedWatchedMovies;
        
        // Filter out already rendered movies based on the tracking set
        const availableMovies = sortedMovies.filter(movie => 
            movie.Id && !usedTrackingSet.has(movie.Id)
        );
        
        if (availableMovies.length === 0) return null;
        
        // Heavy weighting: 70% chance for first 5, 30% for rest
        let selectedMovie;
        if (Math.random() < 0.7 && availableMovies.length >= 5) {
            // Pick from first 5
            const firstFive = availableMovies.slice(0, 5);
            selectedMovie = firstFive[Math.floor(Math.random() * firstFive.length)];
        } else {
            // Pick from all available
            selectedMovie = availableMovies[Math.floor(Math.random() * availableMovies.length)];
        }
        
        // Track rendered movie in the appropriate set
        if (selectedMovie && selectedMovie.Id) {
            usedTrackingSet.add(selectedMovie.Id);
        }
        
        return selectedMovie;
    }

    /**
     * Fetches and caches Popular TV Networks (studios) from all TV show libraries
     * @returns {Promise<Array>} - Array of studio objects sorted by ChildCount (descending)
     */
    async function fetchAndCachePopularTVNetworks() {
        const cache = new window.LocalStorageCache();
        const cacheKey = 'popularTVNetworks';
        
        // Check cache first
        const cached = cache.get(cacheKey);
        if (cached) {
            LOG('Using cached Popular TV Networks');
            return cached;
        }
        
        try {
            LOG('Fetching Popular TV Networks...');
            const apiClient = window.ApiClient;
            const serverUrl = apiClient.serverAddress();
            const token = apiClient.accessToken();
            const userId = apiClient.getCurrentUserId();
            
            // Get root libraries
            const librariesResponse = await apiClient.getItems();
            const libraries = librariesResponse.Items || [];
            
            // Filter for TV show libraries
            const tvLibraries = libraries.filter(lib => lib.CollectionType === 'tvshows');
            
            if (tvLibraries.length === 0) {
                LOG('No TV show libraries found');
                return [];
            }
            
            // Fetch studios from all TV libraries
            const allStudios = [];
            const isPlayedFilter = getIsPlayedFilter(popularTVNetworksConfig);
            const filterParam = isPlayedFilter ? `&Filters=${isPlayedFilter}` : '';

            for (const library of tvLibraries) {
                try {
                    const studiosUrl = `${serverUrl}/Studios?SortBy=SortName&SortOrder=Ascending&IncludeItemTypes=Series&Recursive=true&Fields=DateCreated%2CPrimaryImageAspectRatio&StartIndex=0&ParentId=${library.Id}&userId=${userId}${filterParam}`;
                    const response = await fetch(studiosUrl, {
                        headers: {
                            "Authorization": `MediaBrowser Token="${token}"`
                        }
                    });
                    
                    if (!response.ok) {
                        WARN(`Failed to fetch studios for library ${library.Name}: ${response.status}`);
                        continue;
                    }
                    
                    const data = await response.json();
                    const studios = data.Items || [];
                    allStudios.push(...studios);
                } catch (err) {
                    ERR(`Error fetching studios for library ${library.Name}:`, err);
                }
            }
            
            // Deduplicate studios by Id
            const uniqueStudios = [];
            const seenIds = new Set();
            for (const studio of allStudios) {
                if (!seenIds.has(studio.Id)) {
                    seenIds.add(studio.Id);
                    uniqueStudios.push(studio);
                }
            }
            
            // Sort by ChildCount (descending)
            uniqueStudios.sort((a, b) => (b.ChildCount || 0) - (a.ChildCount || 0));
            
            // Filter by minimum shows
            const filteredStudios = uniqueStudios.filter(studio => 
                (studio.ChildCount || 0) >= minimumShowsForNetwork
            );
            
            LOG(`Fetched ${filteredStudios.length} Popular TV Networks (filtered from ${uniqueStudios.length})`);
            
            // Cache the results
            cache.set(cacheKey, filteredStudios);
            
            return filteredStudios;
        } catch (err) {
            ERR('Error fetching Popular TV Networks:', err);
            return [];
        }
    }

    /**
     * Gets Popular TV Networks from cache or fetches if not cached
     * @returns {Promise<Array>} - Array of studio objects
     */
    async function getPopularTVNetworks() {
        const cache = new window.LocalStorageCache();
        const cacheKey = 'popularTVNetworks';
        
        const cached = cache.get(cacheKey);
        if (cached && cached.length > 0) {
            return cached;
        }
        
        return await fetchAndCachePopularTVNetworks();
    }

    /**
     * Fetches items (Series) by studio ID
     * @param {string} studioId - Studio ID
     * @returns {Promise<Array>} - Array of series items
     */
    async function fetchItemsByStudio(studioId) {
        try {
            const apiClient = window.ApiClient;
            const serverUrl = apiClient.serverAddress();
            const token = apiClient.accessToken();
            const userId = apiClient.getCurrentUserId();
            
            // Use Items endpoint with StudioIds parameter, sort by random
            const url = `${serverUrl}/Items?IncludeItemTypes=Series&Recursive=true&SortBy=Random&Fields=PrimaryImageAspectRatio%2CDateCreated%2COverview%2CProductionYear%2CPeople&StudioIds=${studioId}&userId=${userId}&Limit=32`;
            
            const response = await fetch(url, {
                headers: {
                    "Authorization": `MediaBrowser Token="${token}"`
                }
            });
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            const data = await response.json();
            return data.Items || [];
        } catch (err) {
            ERR(`Error fetching items by studio ${studioId}:`, err);
            return [];
        }
    }

    /**
     * Fetches items by person ID (for actors, directors, writers)
     * @param {string} personId - Person ID
     * @param {string} includeItemTypes - Item types to include (default: 'Movie')
     * @returns {Promise<Array>} - Array of items
     */
    async function fetchItemsByPersonId(personId, includeItemTypes = 'Movie') {
        try {
            const apiClient = window.ApiClient;
            const serverUrl = apiClient.serverAddress();
            const token = apiClient.accessToken();
            const userId = apiClient.getCurrentUserId();
            
            // Use Items endpoint with PersonIds parameter, sort by random, include People field
            const url = `${serverUrl}/Items?IncludeItemTypes=${includeItemTypes}&PersonIds=${personId}&Recursive=true&SortBy=Random&Fields=PrimaryImageAspectRatio%2CDateCreated%2COverview%2CProductionYear%2CPeople%2CUserData&userId=${userId}&Limit=32`;
            
            const response = await fetch(url, {
                headers: {
                    "Authorization": `MediaBrowser Token="${token}"`
                }
            });
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            const data = await response.json();
            return data.Items || [];
        } catch (err) {
            ERR(`Error fetching items by person ${personId}:`, err);
            return [];
        }
    }

    /**
     * Filters items to only include those where the person has the specified type (Actor, Director, Writer)
     * @param {Array} items - Array of items with People field
     * @param {string} personId - Person ID to check
     * @param {string} personType - Type to filter by ('Actor', 'Director', 'Writer')
     * @returns {Array} - Filtered array of items
     */
    function filterPeopleByType(items, personId, personType) {
        return items.filter(item => {
            if (!item.People || !Array.isArray(item.People)) return false;
            return item.People.some(person => 
                person.Id === personId && person.Type === personType
            );
        });
    }

    /**
     * Fetches newest movies from Jellyfin API
     * @returns {Promise<Array>} - Array of newest movie items
     */
    async function fetchNewMovies() {        
        // Calculate date range based on configuration
        const minAgeInDays = newMoviesConfig.minAgeInDays !== null && newMoviesConfig.minAgeInDays !== undefined ? newMoviesConfig.minAgeInDays : 0;
        const maxAgeInDays = newMoviesConfig.maxAgeInDays !== null && newMoviesConfig.maxAgeInDays !== undefined ? newMoviesConfig.maxAgeInDays : 30; // Default 30 days old max

        // Calculate actual dates:
        // MaxPremiereDate (latest allowed date) = Today - minAgeInDays
        // MinPremiereDate (earliest allowed date) = Today - maxAgeInDays
        
        const today = new Date();
        
        const maxDateObj = new Date(today);
        maxDateObj.setDate(today.getDate() - minAgeInDays);
        const maxPremiereDate = maxDateObj.toISOString().split('T')[0];

        const minDateObj = new Date(today);
        minDateObj.setDate(today.getDate() - maxAgeInDays);
        const minPremiereDate = minDateObj.toISOString().split('T')[0];

        const options = {
            IncludeItemTypes: 'Movie',
            SortBy: 'PremiereDate',
            SortOrder: newMoviesConfig.sortOrderDirection === 'Ascending' ? 'Ascending' : 'Descending',
            Limit: 16,
            Fields: 'PremiereDate',
            Recursive: true,
            MinPremiereDate: minPremiereDate,
            MaxPremiereDate: maxPremiereDate
        }

        const isPlayedFilter = getIsPlayedFilter(newMoviesConfig);
        if (isPlayedFilter) {
            options.Filters = isPlayedFilter;
        }

        // Add UserData to Fields if IsPlayed filter is active or generally useful
        if (!options.Fields.includes('UserData')) {
             options.Fields += ',UserData';
        }

        const data = await window.apiHelper.getItems(options, true);
        return data.Items || [];
    }

    /**
     * Fetches newest episodes from the last 7 days
     * Deduplicates episodes from the same series that aired on the same date,
     * keeping only the episode with the lowest index number
     * @returns {Promise<Array>} - Array of deduplicated newest episode items
     */
    async function fetchNewEpisodes() {        
        // Calculate date range based on configuration
        const minAgeInDays = newEpisodesConfig.minAgeInDays !== null && newEpisodesConfig.minAgeInDays !== undefined ? newEpisodesConfig.minAgeInDays : 0;
        const maxAgeInDays = newEpisodesConfig.maxAgeInDays !== null && newEpisodesConfig.maxAgeInDays !== undefined ? newEpisodesConfig.maxAgeInDays : 7; // Default 7 days old max

        const today = new Date();
        
        const maxDateObj = new Date(today);
        maxDateObj.setDate(today.getDate() - minAgeInDays);
        const maxPremiereDate = maxDateObj.toISOString().split('T')[0];

        const minDateObj = new Date(today);
        minDateObj.setDate(today.getDate() - maxAgeInDays);
        const minPremiereDate = minDateObj.toISOString().split('T')[0];

        const options = {
            IncludeItemTypes: 'Episode',
            LocationTypes: 'FileSystem',
            Recursive: true,
            SortBy: 'PremiereDate',
            SortOrder: newEpisodesConfig.sortOrderDirection === 'Ascending' ? 'Ascending' : 'Descending',
            MinPremiereDate: minPremiereDate,
            MaxPremiereDate: maxPremiereDate,
            Limit: 100,
            Fields: 'PremiereDate,SeriesName,ParentIndexNumber,IndexNumber,ProviderIds,Path'
        }

        const isPlayedFilter = getIsPlayedFilter(newEpisodesConfig);
        if (isPlayedFilter) {
            options.Filters = isPlayedFilter;
        }

        // Add UserData to Fields if IsPlayed filter is active or generally useful
        if (!options.Fields.includes('UserData')) {
             options.Fields += ',UserData';
        }

        const data = await window.apiHelper.getItems(options, true);
        const episodes = data.Items || [];
        
        // Deduplicate episodes from the same series that aired on the same date
        const deduplicatedEpisodes = deduplicateEpisodesBySeriesAndDate(episodes);
        
        LOG(`Fetched ${episodes.length} episodes, deduplicated to ${deduplicatedEpisodes.length} episodes`);
        return deduplicatedEpisodes;
    }

    /**
     * Deduplicates episodes from the same series that aired on the same date
     * Keeps only the episode with the lowest index number (first episode of season)
     * @param {Array} episodes - Array of episode objects
     * @returns {Array} - Deduplicated array of episodes
     */
    function deduplicateEpisodesBySeriesAndDate(episodes) {
        if (!episodes || episodes.length === 0) return [];
        
        // Group episodes by series name and premiere date
        const groupedEpisodes = new Map();
        
        episodes.forEach(episode => {
            const seriesName = episode.SeriesName || 'Unknown Series';
            const premiereDate = episode.PremiereDate || '';
            const key = `${seriesName}|${premiereDate}`;
            
            if (!groupedEpisodes.has(key)) {
                groupedEpisodes.set(key, []);
            }
            
            groupedEpisodes.get(key).push(episode);
        });
        
        // For each group, keep only the episode with the lowest index number
        const deduplicatedEpisodes = [];
        
        groupedEpisodes.forEach(episodeGroup => {
            if (episodeGroup.length === 1) {
                // Only one episode for this series/date, keep it
                deduplicatedEpisodes.push(episodeGroup[0]);
            } else {
                // Multiple episodes for this series/date, find the one with lowest ParentIndexNumber and IndexNumber
                const episodeWithLowestIndex = episodeGroup.reduce((lowest, current) => {
                    const currentParentIndex = current.ParentIndexNumber ?? 999999;
                    const lowestParentIndex = lowest.ParentIndexNumber ?? 999999;
                    const currentIndex = current.IndexNumber ?? 999999;
                    const lowestIndex = lowest.IndexNumber ?? 999999;
                    
                    // First compare by ParentIndexNumber (season number)
                    if (currentParentIndex < lowestParentIndex) {
                        return current;
                    } else if (currentParentIndex > lowestParentIndex) {
                        return lowest;
                    } else {
                        // Same season, compare by IndexNumber (episode number)
                        return currentIndex < lowestIndex ? current : lowest;
                    }
                });
                
                deduplicatedEpisodes.push(episodeWithLowestIndex);
                
                LOG(`Deduplicated ${episodeGroup.length} episodes from "${episodeGroup[0].SeriesName}" on ${episodeGroup[0].PremiereDate}, kept S${episodeWithLowestIndex.ParentIndexNumber ?? '?'}E${episodeWithLowestIndex.IndexNumber ?? '?'}`);
            }
        });
        
        return deduplicatedEpisodes;
    }

    /**
     * Renders New Movies section
     * @param {HTMLElement} container - Container to append the section to
     * @returns {Promise<boolean>} - Success status
     */
    async function renderNewMoviesSection(container) {
        try {
            const movies = await fetchNewMovies();
            
            if (movies.length === 0) {
                return false; // Auto-hide empty sections
            }
            
            // Check if cardBuilder is available
            if (typeof window.cardBuilder === 'undefined' || !window.cardBuilder.renderCards) {
                WARN("cardBuilder not available, skipping New Movies section");
                return false;
            }
            
            // Get config values
            const itemLimit = newMoviesConfig.itemLimit ?? defaultItemLimit;
            const cardFormat = newMoviesConfig.cardFormat ?? defaultCardFormat;
            const order = newMoviesConfig.order ?? 30;
            const sectionName = newMoviesConfig.name || 'Recently Released Movies';
            
            // Apply limit
            const limitedMovies = movies.slice(0, itemLimit);
            
            // Render the scrollable container
            const scrollableContainer = window.cardBuilder.renderCards(
                limitedMovies,
                sectionName,
                null,
                true,
                cardFormat
            );
            
            // Add data attributes to track rendered sections
            scrollableContainer.setAttribute('data-custom-section-id', 'new-movies');
            scrollableContainer.setAttribute('data-custom-section-name', sectionName);
            scrollableContainer.style.order = order;
            
            // Append to container
            container.appendChild(scrollableContainer);
            
            return true;
            
        } catch (err) {
            ERR('Error rendering New Movies section:', err);
            return false;
        }
    }

    /**
     * Renders New Episodes section
     * @param {HTMLElement} container - Container to append the section to
     * @returns {Promise<boolean>} - Success status
     */
    async function renderNewEpisodesSection(container) {
        try {
            const episodes = await fetchNewEpisodes();
            
            if (episodes.length === 0) {
                return false; // Auto-hide empty sections
            }
            
            // Check if cardBuilder is available
            if (typeof window.cardBuilder === 'undefined' || !window.cardBuilder.renderCards) {
                WARN("cardBuilder not available, skipping New Episodes section");
                return false;
            }
            
            // Get config values
            const itemLimit = newEpisodesConfig.itemLimit ?? defaultItemLimit;
            const cardFormat = newEpisodesConfig.cardFormat ?? defaultCardFormat;
            const order = newEpisodesConfig.order ?? 31;
            const sectionName = newEpisodesConfig.name || 'Recently Aired Episodes';
            
            // Apply limit
            const limitedEpisodes = episodes.slice(0, itemLimit);
            const viewMoreUrl = `#/tv.html?collectionType=tvshows&tab=2`;
            
            // Render the scrollable container
            const scrollableContainer = window.cardBuilder.renderCards(
                limitedEpisodes,
                sectionName,
                viewMoreUrl,
                true,
                cardFormat
            );
            
            // Add data attributes to track rendered sections
            scrollableContainer.setAttribute('data-custom-section-id', 'new-episodes');
            scrollableContainer.setAttribute('data-custom-section-name', sectionName);
            scrollableContainer.style.order = order;
            
            // Append to container
            container.appendChild(scrollableContainer);
            
            return true;
            
        } catch (err) {
            ERR('Error rendering New Episodes section:', err);
            return false;
        }
    }

    /**
     * Renders watchlist section
     * @param {HTMLElement} container - Container to append the section to
     * @returns {boolean} - Success status
     */
    async function renderWatchlistSection(container) {
        try {
            // Check if section is already on the page
            const sectionContainer = container.querySelector('[data-custom-section-id="watchlist"]');
            if (sectionContainer) {
                LOG('Watchlist section already on the page, skipping...');
                return false;
            }

            const watchlistItems = await getWatchlistData();
            
            if (watchlistItems.length === 0) {
                return false; // Auto-hide empty sections
            }
            
            // Get config values
            const itemLimit = watchlistConfig.itemLimit ?? defaultItemLimit;
            const sortOrder = watchlistConfig.sortOrder ?? defaultSortOrder;
            const sortOrderDirection = watchlistConfig.sortOrderDirection ?? 'Descending';
            const cardFormat = watchlistConfig.cardFormat ?? defaultCardFormat;
            const order = watchlistConfig.order ?? 60;
            const sectionName = watchlistConfig.name || 'Watchlist';
            
            // Apply sorting and limit
            let sortedItems = watchlistItems;
            if (sortOrder === 'Random') {
                sortedItems = [...watchlistItems].sort(() => Math.random() - 0.5);
            } else {
                // Use cardBuilder sort helper if available
                if (window.cardBuilder && typeof window.cardBuilder.sortItems === 'function') {
                    sortedItems = window.cardBuilder.sortItems(watchlistItems, sortOrder, sortOrderDirection);
                }
            }
            const limitedItems = sortedItems.slice(0, itemLimit);
            
            if (limitedItems.length === 0) {
                return false; // Auto-hide empty sections
            }
            
            // Check if cardBuilder is available
            if (typeof window.cardBuilder === 'undefined' || !window.cardBuilder.renderCards) {
                WARN("cardBuilder not available, skipping watchlist section");
                return false;
            }

            // Render the scrollable container with function-based navigation
            const scrollableContainer = window.cardBuilder.renderCards(
                limitedItems,
                sectionName,
                await getWatchlistUrl(),
                true,
                cardFormat,
                sortOrder,
                sortOrderDirection
            );
            
            // Add data attribute to track rendered sections
            scrollableContainer.setAttribute('data-custom-section-id', 'watchlist');
            scrollableContainer.setAttribute('data-custom-section-name', sectionName);
            scrollableContainer.style.order = order;
            
            // Append to container
            container.appendChild(scrollableContainer);
            
            return true;
            
        } catch (err) {
            ERR('Error rendering watchlist section:', err);
            return false;
        }
    }

    /**
     * Formats air date for display
     * @param {string} premiereDate - ISO date string
     * @returns {string} - Formatted date string (MM/DD/YYYY)
     */
    function formatAirDate(premiereDate) {
        if (!premiereDate) return '';
        try {
            const date = new Date(premiereDate);
            const month = String(date.getMonth() + 1).padStart(2, '0');
            const day = String(date.getDate()).padStart(2, '0');
            const year = date.getFullYear();
            return `${month}/${day}/${year}`;
        } catch (e) {
            return '';
        }
    }

    /**
     * Renders Upcoming section (upcoming TV episodes)
     * @param {HTMLElement} container - Container to append the section to
     * @returns {Promise<boolean>} - Success status
     */
    async function renderUpcomingSection(container) {
        try {
            if (!enableUpcoming) {
                return false;
            }
            
            // Check if section is already on the page
            const sectionContainer = container.querySelector('[data-custom-section-id="upcoming"]');
            if (sectionContainer) {
                LOG('Upcoming section already on the page, skipping...');
                return false;
            }
            
            const userId = ApiClient.getCurrentUserId();
            const serverAddress = ApiClient.serverAddress();
            const itemLimit = upcomingConfig.itemLimit || 48;
            const cardFormat = upcomingConfig.cardFormat || 'Backdrop';
            const order = upcomingConfig.order || 20;
            const sectionName = upcomingConfig.name || 'Upcoming';

            // Get the parent id from the root libraryies with CollectionType: "tvshows"
            const libraries = await ApiClient.getItems();
            const parentIds = libraries.Items.filter(lib => lib.CollectionType === 'tvshows')?.map(lib => lib.Id);

            let url = `${serverAddress}/Shows/Upcoming?Limit=${itemLimit}&Fields=AirTime,SeriesName,ParentIndexNumber,IndexNumber&UserId=${userId}&ImageTypeLimit=1&EnableImageTypes=Primary,Backdrop,Banner,Thumb&EnableTotalRecordCount=false&ParentIds=${parentIds.join(',')}`;

            const isPlayedFilter = getIsPlayedFilter(upcomingConfig);
            if (isPlayedFilter) {
                url += `&Filters=${isPlayedFilter}`;
            }

            const data = await window.apiHelper.getData(url, true);
            let episodes = data.Items || [];
            
            // Filter out episodes that have already aired (before today)
            const today = new Date();
            today.setHours(0, 0, 0, 0); // Set to start of today
            
            episodes = episodes.filter(ep => {
                if (!ep.PremiereDate) return false;
                const airDate = new Date(ep.PremiereDate);
                airDate.setHours(0, 0, 0, 0); // Set to start of air date
                return airDate >= today; // Only include today and future dates
            });
            
            // Deduplicate episodes from the same series that air on the same date
            // Keeps only the episode with the lowest ParentIndexNumber and IndexNumber
            episodes = deduplicateEpisodesBySeriesAndDate(episodes);
            
            if (episodes.length === 0) {
                return false; // Auto-hide empty sections after deduplication
            }
            
            // Format air dates for display
            episodes.forEach(ep => {
                ep._displayAirDate = formatAirDate(ep.PremiereDate);
            });
            
            // Check if cardBuilder is available
            if (typeof window.cardBuilder === 'undefined' || !window.cardBuilder.renderCards) {
                WARN("cardBuilder not available, skipping Upcoming section");
                return false;
            }

            const viewMoreUrl = `#/tv.html?collectionType=tvshows&tab=2`;
            const itemsContainer = window.cardBuilder.renderCards(episodes, sectionName, viewMoreUrl, true, cardFormat);
            
            itemsContainer.setAttribute('data-custom-section-id', 'upcoming');
            itemsContainer.setAttribute('data-custom-section-name', sectionName);
            itemsContainer.style.order = order;
            
            container.appendChild(itemsContainer);
            
            return true;
            
        } catch (err) {
            ERR('Error rendering Upcoming section:', err);
            return false;
        }
    }

    /**
     * Caches IMDb IDs in localStorage
     * @param {Array<string>} imdbIds - Array of IMDb IDs
     */
    function cacheImdbIds(imdbIds) {
        try {
            localStorage.setItem('kefinTweaks_imdbIds', JSON.stringify({ 
                ids: imdbIds, 
                timestamp: Date.now() 
            }));
        } catch (err) {
            WARN('Failed to cache IMDb IDs:', err);
        }
    }

    /**
     * Gets cached IMDb IDs from localStorage
     * @returns {Object|null} - Cached data with ids and timestamp
     */
    function getCachedImdbIds() {
        try {
            const cached = localStorage.getItem('kefinTweaks_imdbIds');
            return cached ? JSON.parse(cached) : null;
        } catch (err) {
            WARN('Failed to get cached IMDb IDs:', err);
            return null;
        }
    }

    /**
     * Checks if cache is expired (older than 24 hours)
     * @param {number} timestamp - Cache timestamp
     * @param {number} maxAge - Max age in milliseconds (default: 24 hours)
     * @returns {boolean} - True if expired
     */
    function isCacheExpired(timestamp, maxAge = 24 * 60 * 60 * 1000) {
        return !timestamp || (Date.now() - timestamp) > maxAge;
    }

    /**
     * Renders IMDb Top 250 section
     * @param {HTMLElement} container - Container to append the section to
     * @returns {Promise<boolean>} - Success status
     */
    async function renderImdbTop250Section(container) {
        try {
            if (!enableImdbTop250) {
                return false;
            }
            
            // Check if section is already on the page
            const sectionContainer = container.querySelector('[data-custom-section-id="imdb-top250"]');
            if (sectionContainer) {
                LOG('IMDb Top 250 section already on the page, skipping...');
                return false;
            }
            
            const itemLimit = imdbTop250Config.itemLimit ?? defaultItemLimit;
            const sortOrder = imdbTop250Config.sortOrder ?? 'Random';
            const sortOrderDirection = imdbTop250Config.sortOrderDirection ?? 'Ascending';
            const cardFormat = imdbTop250Config.cardFormat ?? defaultCardFormat;
            const order = imdbTop250Config.order ?? 21;
            const sectionName = imdbTop250Config.name || 'IMDb Top 250';
            
            // Get cached IMDb IDs (refresh daily)
            let cachedData = getCachedImdbIds();
            let imdbIds = null;
            
            if (!cachedData || isCacheExpired(cachedData.timestamp, 24 * 60 * 60 * 1000)) {
                // Fetch Top 250 list
                const top250Response = await fetch('https://raw.githubusercontent.com/theapache64/top250/master/top250_min.json');
                if (!top250Response.ok) {
                    throw new Error(`Failed to fetch IMDb Top 250: ${top250Response.statusText}`);
                }
                
                const top250 = await top250Response.json();
                
                // Extract IMDb IDs
                imdbIds = top250.map(entry => {
                    const match = entry.imdb_url?.match(/\/title\/(tt\d+)\//);
                    return match ? match[1] : null;
                }).filter(Boolean);
                
                // Cache IDs
                cacheImdbIds(imdbIds);
            } else {
                imdbIds = cachedData.ids;
            }
            
            if (!imdbIds || imdbIds.length === 0) {
                WARN('No IMDb IDs available');
                return false;
            }
            
            // Fetch all movies and match by IMDb ID
            const userId = ApiClient.getCurrentUserId();
            const options = {
                IncludeItemTypes: 'Movie',
                Recursive: true,
                Fields: 'ProviderIds'
            };

            const isPlayedFilter = getIsPlayedFilter(imdbTop250Config);
            if (isPlayedFilter) {
                options.Filters = isPlayedFilter;
            }

            const allMoviesResponse = await ApiClient.getItems(userId, options);
            
            const allMovies = allMoviesResponse.Items || [];
            const matchedMovies = [];
            
            for (const imdbId of imdbIds) {
                const movie = allMovies.find(m => m.ProviderIds?.Imdb === imdbId);
                if (movie) {
                    matchedMovies.push(movie);
                }
            }
            
            if (matchedMovies.length === 0) {
                return false; // Auto-hide empty sections
            }
            
            // Apply sort order (Random only, no rank data available)
            let sortedMovies = matchedMovies;
            if (sortOrder === 'Random') {
                sortedMovies = [...matchedMovies].sort(() => Math.random() - 0.5);
            }
            
            // Apply limit
            const limited = sortedMovies.slice(0, itemLimit);
            
            if (limited.length === 0) {
                return false; // Auto-hide empty sections
            }
            
            // Check if cardBuilder is available
            if (typeof window.cardBuilder === 'undefined' || !window.cardBuilder.renderCards) {
                WARN("cardBuilder not available, skipping IMDb Top 250 section");
                return false;
            }
            
            const scrollableContainer = window.cardBuilder.renderCards(
                limited,
                sectionName,
                null,
                true,
                cardFormat,
                sortOrder,
                sortOrderDirection
            );
            
            scrollableContainer.setAttribute('data-custom-section-id', 'imdb-top250');
            scrollableContainer.setAttribute('data-custom-section-name', sectionName);
            scrollableContainer.style.order = order;
            
            container.appendChild(scrollableContainer);
            
            return true;
            
        } catch (err) {
            ERR('Error rendering IMDb Top 250 section:', err);
            return false;
        }
    }

    /**
     * Renders Watch Again section (random watched movies)
     * @param {HTMLElement} container - Container to append the section to
     * @returns {Promise<boolean>} - Success status
     */
    async function renderWatchAgainSection(container) {
        try {
            if (!enableWatchAgain) {
                return false;
            }
            
            // Check if section is already on the page
            const sectionContainer = container.querySelector('[data-custom-section-id="watch-again"]');
            if (sectionContainer) {
                LOG('Watch Again section already on the page, skipping...');
                return false;
            }
            
            const userId = ApiClient.getCurrentUserId();
            const itemLimit = watchAgainConfig.itemLimit ?? defaultItemLimit;
            const sortOrder = watchAgainConfig.sortOrder ?? 'Random';
            const sortOrderDirection = watchAgainConfig.sortOrderDirection ?? 'Ascending';
            const cardFormat = watchAgainConfig.cardFormat ?? defaultCardFormat;
            const order = watchAgainConfig.order ?? 62;
            const sectionName = watchAgainConfig.name || 'Watch Again';
            
            // Fetch watched movies
            const watchedMoviesResponse = await ApiClient.getItems(userId, {
                IncludeItemTypes: 'Movie',
                Filters: 'IsPlayed',
                SortBy: 'Random',
                Recursive: true,
                Limit: itemLimit
            });
            
            const watchedMovies = watchedMoviesResponse.Items || [];
            
            if (watchedMovies.length === 0) {
                return false; // Auto-hide empty sections
            }
            
            // Apply sort order
            let sortedMovies = watchedMovies;
            if (sortOrder !== 'Random') {
                // Use cardBuilder sort if available
                if (window.cardBuilder && typeof window.cardBuilder.sortItems === 'function') {
                    sortedMovies = window.cardBuilder.sortItems(watchedMovies, sortOrder, sortOrderDirection);
                }
            }
            
            // Apply limit
            const limited = sortedMovies.slice(0, itemLimit);
            
            if (limited.length === 0) {
                return false; // Auto-hide empty sections
            }
            
            // Check if cardBuilder is available
            if (typeof window.cardBuilder === 'undefined' || !window.cardBuilder.renderCards) {
                WARN("cardBuilder not available, skipping Watch Again section");
                return false;
            }
            
            const scrollableContainer = window.cardBuilder.renderCards(
                limited,
                sectionName,
                null,
                true,
                cardFormat,
                sortOrder,
                sortOrderDirection
            );
            
            scrollableContainer.setAttribute('data-custom-section-id', 'watch-again');
            scrollableContainer.setAttribute('data-custom-section-name', sectionName);
            scrollableContainer.style.order = order;
            
            container.appendChild(scrollableContainer);
            
            return true;
            
        } catch (err) {
            ERR('Error rendering Watch Again section:', err);
            return false;
        }
    }

    /**
     * Renders Popular TV Networks section
     * @param {HTMLElement} container - Container to append the section to
     * @returns {Promise<boolean>} - Success status
     */
    async function renderPopularTVNetworksSection(container) {
        try {
            // Check if section is already on the page
            const sectionContainer = container.querySelector('[data-custom-section-id="popular-tv-networks"]');
            if (sectionContainer) {
                LOG('Popular TV Networks section already on the page, skipping...');
                return false;
            }

            let networks = await getPopularTVNetworks();
            
            if (networks.length === 0) {
                return false; // Auto-hide empty sections
            }

            // Remove any networks without Thumb images
            networks = networks.filter(network => network.ImageTags?.Thumb);
            
            // Get config values
            const itemLimit = popularTVNetworksConfig.itemLimit ?? defaultItemLimit;
            const sortOrder = popularTVNetworksConfig.sortOrder ?? defaultSortOrder;
            const sortOrderDirection = popularTVNetworksConfig.sortOrderDirection ?? 'Ascending';
            const cardFormat = popularTVNetworksConfig.cardFormat ?? defaultCardFormat;
            const order = popularTVNetworksConfig.order ?? 61;
            const sectionName = popularTVNetworksConfig.name || 'Popular TV Networks';
            
            // Apply sort order
            let sortedNetworks = networks;
            if (sortOrder === 'Random') {
                sortedNetworks = [...networks].sort(() => Math.random() - 0.5);
            } else if (window.cardBuilder && typeof window.cardBuilder.sortItems === 'function') {
                sortedNetworks = window.cardBuilder.sortItems(networks, sortOrder, sortOrderDirection);
            }
            
            // Apply limit
            const limitedNetworks = sortedNetworks.slice(0, itemLimit);
            
            if (limitedNetworks.length === 0) {
                return false; // Auto-hide empty sections
            }
            
            // Check if cardBuilder is available
            if (typeof window.cardBuilder === 'undefined' || !window.cardBuilder.renderCards) {
                WARN("cardBuilder not available, skipping Popular TV Networks section");
                return false;
            }

            // Render the scrollable container with the network/studio items
            const scrollableContainer = window.cardBuilder.renderCards(
                limitedNetworks,
                sectionName,
                null,
                true,
                cardFormat,
                sortOrder,
                sortOrderDirection
            );
            
            // Add data attribute to track rendered sections
            scrollableContainer.setAttribute('data-custom-section-id', 'popular-tv-networks');
            scrollableContainer.setAttribute('data-custom-section-name', sectionName);
            scrollableContainer.style.order = order;
            
            // Append to container
            container.appendChild(scrollableContainer);
            
            return true;
            
        } catch (err) {
            ERR('Error rendering Popular TV Networks section:', err);
            return false;
        }
    }

    /**
     * Fetches full item objects from API using item IDs
     * @param {Array<string>} itemIds - Array of item IDs to fetch
     * @returns {Promise<Array>} Array of full item objects
     */
    async function fetchItemsByIds(itemIds) {
        try {
            if (!itemIds || itemIds.length === 0) return [];
            
            const userId = ApiClient.getCurrentUserId();
            const serverId = ApiClient.serverId();
            
            // Use the Items endpoint to fetch multiple items by IDs
            const idsParam = itemIds.join(',');
            const url = `${ApiClient.serverAddress()}/Items?Ids=${idsParam}&UserId=${userId}&EnableTotalRecordCount=false&EnableImageTypes=Primary,Backdrop,Thumb,Logo`;
            
            const response = await ApiClient.fetch({ url, method: 'GET' });
            const data = await response.json();
            
            return data.Items || [];
            
        } catch (err) {
            ERR('Error fetching items by IDs:', err);
            return [];
        }
    }

    /**
     * Generates a single group of discovery sections (6 sections total)
     * @returns {Promise<Array>} Array of section data objects
     */
    async function generateDiscoveryGroup() {
        try {
            LOG('Generating single discovery group...');

            const spotlightChance = discoveryConfig.spotlightDiscoveryChance ?? 0.5;
            const renderSpotlightAboveMatching = discoveryConfig.renderSpotlightAboveMatching === true;

            let renderGenresSpotlight = false;
            let renderNetworksSpotlight = false;
            let renderCollectionsSpotlight = false;

            // Pre-selected data for forced matching
            let forcedGenre = null;
            let forcedNetwork = null;

            if (Math.random() < spotlightChance) {
                // Randomly pick one of the spotlight sections to render
                const spotlightSections = ['spotlight-genre', 'spotlight-network', 'spotlight-collection'];
                const selectedSpotlightSection = spotlightSections[Math.floor(Math.random() * spotlightSections.length)];
                renderGenresSpotlight = selectedSpotlightSection === 'spotlight-genre';
                renderNetworksSpotlight = selectedSpotlightSection === 'spotlight-network';
                renderCollectionsSpotlight = selectedSpotlightSection === 'spotlight-collection';

                // If forcing matching, pre-select content now
                if (renderSpotlightAboveMatching) {
                    if (renderGenresSpotlight) {
                        try {
                            forcedGenre = await getRandomGenre();
                            if (!forcedGenre) renderGenresSpotlight = false;
                        } catch (e) {
                            ERR('Error pre-selecting genre for forced matching:', e);
                            renderGenresSpotlight = false;
                        }
                    } else if (renderNetworksSpotlight) {
                        try {
                            const networks = await getPopularTVNetworks();
                            if (networks && networks.length > 0) {
                                // Find one that hasn't been used in either context
                                const availableNetworks = networks.filter(network => 
                                    network.Id && 
                                    !renderedStudios.has(network.Id) && 
                                    !renderedNetworks.has(network.Id)
                                );
                                
                                if (availableNetworks.length > 0) {
                                    forcedNetwork = availableNetworks[Math.floor(Math.random() * availableNetworks.length)];
                                    // Reserve it immediately
                                    renderedStudios.add(forcedNetwork.Id);
                                    renderedNetworks.add(forcedNetwork.Id);
                                } else {
                                    renderNetworksSpotlight = false;
                                }
                            } else {
                                renderNetworksSpotlight = false;
                            }
                        } catch (e) {
                            ERR('Error pre-selecting network for forced matching:', e);
                            renderNetworksSpotlight = false;
                        }
                    }
                }
            }
            
            // Run all async operations in parallel for maximum speed
            const preloadPromises = [
                // 1. [Genre] Movies
                (async () => {
                    const sectionConfig = getDiscoverySectionSettings('genreMovies');
                    if (!sectionConfig || !sectionConfig.enabled) return null;

                    let randomGenre = null;
                    if (forcedGenre) {
                        randomGenre = forcedGenre;
                    } else {
                        randomGenre = await getRandomGenre();
                    }

                    if (randomGenre) {
                        const genreData = await preloadGenreSection(
                            randomGenre,
                            sectionConfig.itemLimit ?? (discoveryConfig.defaultItemLimit ?? defaultItemLimit)
                        );
                        if (genreData) {
                            return {
                                type: 'genre',
                                sectionKey: 'genreMovies',
                                config: sectionConfig,
                                data: randomGenre,
                                items: genreData.items,
                                viewMoreUrl: genreData.viewMoreUrl
                            };
                        }
                    }
                    return null;
                })(),
                
                // 2. Directed by [Director] (use cached items directly)
                (async () => {
                    const sectionConfig = getDiscoverySectionSettings('directedByTopDirector');
                    if (!sectionConfig || !sectionConfig.enabled) return null;
                    if (moviesTopPeople && moviesTopPeople.directors.length > 0) {
                        const randomDirector = getRandomItem(moviesTopPeople.directors, renderedDirectors);
                        if (randomDirector && randomDirector.items && randomDirector.items.length > 0) {
                            const limit = sectionConfig.itemLimit ?? (discoveryConfig.defaultItemLimit ?? defaultItemLimit);
                            const shuffledItems = shuffleArray(randomDirector.items).slice(0, limit);
                            
                            if (shuffledItems && shuffledItems.length > 0) {
                                return {
                                    type: 'director',
                                    sectionKey: 'directedByTopDirector',
                                    config: sectionConfig,
                                    data: randomDirector,
                                    items: shuffledItems,
                                    viewMoreUrl: `#/details?id=${randomDirector.id}&serverId=${ApiClient.serverId()}`
                                };
                            }
                        }
                    }
                    return null;
                })(),
                
                // 3. Written by [Writer] (use cached items directly)
                (async () => {
                    const sectionConfig = getDiscoverySectionSettings('writtenByTopWriter');
                    if (!sectionConfig || !sectionConfig.enabled) return null;
                    if (moviesTopPeople && moviesTopPeople.writers.length > 0) {
                        const randomWriter = getRandomItem(moviesTopPeople.writers, renderedWriters);
                        if (randomWriter && randomWriter.items && randomWriter.items.length > 0) {
                            const limit = sectionConfig.itemLimit ?? (discoveryConfig.defaultItemLimit ?? defaultItemLimit);
                            const shuffledItems = shuffleArray(randomWriter.items).slice(0, limit);
                            
                            if (shuffledItems && shuffledItems.length > 0) {
                                return {
                                    type: 'writer',
                                    sectionKey: 'writtenByTopWriter',
                                    config: sectionConfig,
                                    data: randomWriter,
                                    items: shuffledItems,
                                    viewMoreUrl: `#/details?id=${randomWriter.id}&serverId=${ApiClient.serverId()}`
                                };
                            }
                        }
                    }
                    return null;
                })(),
                
                // 4. Starring [Actor] (use cached items directly)
                (async () => {
                    const sectionConfig = getDiscoverySectionSettings('starringTopActor');
                    if (!sectionConfig || !sectionConfig.enabled) return null;
                    if (moviesTopPeople && moviesTopPeople.actors.length > 0) {
                        const randomActor = getRandomItem(moviesTopPeople.actors, renderedActors);
                        if (randomActor && randomActor.items && randomActor.items.length > 0) {
                            const limit = sectionConfig.itemLimit ?? (discoveryConfig.defaultItemLimit ?? defaultItemLimit);
                            const shuffledItems = shuffleArray(randomActor.items).slice(0, limit);
                            
                            if (shuffledItems && shuffledItems.length > 0) {
                                return {
                                    type: 'actor',
                                    sectionKey: 'starringTopActor',
                                    config: sectionConfig,
                                    data: randomActor,
                                    items: shuffledItems,
                                    viewMoreUrl: `#/details?id=${randomActor.id}&serverId=${ApiClient.serverId()}`
                                };
                            }
                        }
                    }
                    return null;
                })(),
                
                // 5. Because you watched [Movie]
                (async () => {
                    const sectionConfig = getDiscoverySectionSettings('becauseYouWatched');
                    if (!sectionConfig || !sectionConfig.enabled) return null;
                    const randomWatchedMovie = getRandomWatchedMovie();
                    if (randomWatchedMovie) {
                        const watchedData = await preloadBecauseYouWatchedSection(
                            randomWatchedMovie,
                            sectionConfig.itemLimit ?? (discoveryConfig.defaultItemLimit ?? defaultItemLimit)
                        );
                        if (watchedData) {
                            return {
                                type: 'watched',
                                sectionKey: 'becauseYouWatched',
                                config: sectionConfig,
                                data: randomWatchedMovie,
                                items: watchedData.items
                            };
                        }
                    }
                    return null;
                })(),
                
                // 6. Because you liked [Movie]
                (async () => {
                    const sectionConfig = getDiscoverySectionSettings('becauseYouLiked');
                    if (!sectionConfig || !sectionConfig.enabled) return null;
                    const randomLikedMovie = await getRandomFavoriteMovie();
                    if (randomLikedMovie) {
                        const likedData = await preloadBecauseYouLikedSection(
                            randomLikedMovie,
                            sectionConfig.itemLimit ?? (discoveryConfig.defaultItemLimit ?? defaultItemLimit)
                        );
                        if (likedData) {
                            return {
                                type: 'liked',
                                sectionKey: 'becauseYouLiked',
                                config: sectionConfig,
                                data: randomLikedMovie,
                                items: likedData.items
                            };
                        }
                    }
                    return null;
                })(),
                
                // 7. Shows from [Studio Name]
                (async () => {
                    const sectionConfig = getDiscoverySectionSettings('studioShows');
                    if (!sectionConfig || !sectionConfig.enabled) return null;
                    
                    let randomNetwork = null;

                    if (forcedNetwork) {
                        randomNetwork = forcedNetwork;
                    } else {
                        const networks = await getPopularTVNetworks();
                        if (networks && networks.length > 0) {
                            // Filter out already rendered studios
                            const availableNetworks = networks.filter(network => 
                                network.Id && !renderedStudios.has(network.Id)
                            );
                            
                            if (availableNetworks.length > 0) {
                                randomNetwork = availableNetworks[Math.floor(Math.random() * availableNetworks.length)];
                                renderedStudios.add(randomNetwork.Id);
                            }
                        }
                    }

                    if (randomNetwork) {
                        const items = await fetchItemsByStudio(randomNetwork.Id);
                        const viewMoreUrl = `#/list.html?studioId=${randomNetwork.Id}&serverId=${ApiClient.serverId()}`;
                        
                        if (items && items.length > 0) {
                            
                            const orderedItems = applyDiscoverySectionOrdering(items, sectionConfig);
                            if (orderedItems.length === 0) {
                                return null;
                            }
                            
                            return {
                                type: 'studio',
                                sectionKey: 'studioShows',
                                config: sectionConfig,
                                data: randomNetwork,
                                items: orderedItems,
                                viewMoreUrl: viewMoreUrl
                            };
                        }
                    }
                    return null;
                })(),
                
                // 8. Because you recently watched [Movie Name]
                (async () => {
                    const sectionConfig = getDiscoverySectionSettings('becauseYouRecentlyWatched');
                    if (!sectionConfig || !sectionConfig.enabled) return null;
                    const randomRecentMovie = getRandomRecentlyWatchedMovie();
                    if (randomRecentMovie) {
                        const watchedData = await preloadBecauseYouWatchedSection(
                            randomRecentMovie,
                            sectionConfig.itemLimit ?? (discoveryConfig.defaultItemLimit ?? defaultItemLimit)
                        );
                        if (watchedData) {
                            return {
                                type: 'watched-recent',
                                sectionKey: 'becauseYouRecentlyWatched',
                                config: sectionConfig,
                                data: randomRecentMovie,
                                items: watchedData.items
                            };
                        }
                    }
                    return null;
                })(),
                
                // 9. Starring [Actor Name] since you recently watched [Movie Name]
                (async () => {
                    const sectionConfig = getDiscoverySectionSettings('starringActorRecentlyWatched');
                    if (!sectionConfig || !sectionConfig.enabled) return null;
                    const recentMovie = getRandomRecentlyWatchedMovie(renderedStarringWatchedMovies);
                    if (!recentMovie) return null;
                    
                    // Fetch the movie with People field included
                    try {
                        const apiClient = window.ApiClient;
                        const serverUrl = apiClient.serverAddress();
                        const token = apiClient.accessToken();
                        const userId = apiClient.getCurrentUserId();
                        
                        const movieUrl = `${serverUrl}/Users/${userId}/Items/${recentMovie.Id}?Fields=People`;
                        const movieResponse = await fetch(movieUrl, {
                            headers: {
                                "Authorization": `MediaBrowser Token="${token}"`
                            }
                        });
                        
                        if (!movieResponse.ok) return null;
                        
                        const movieData = await movieResponse.json();
                        if (!movieData.People || !Array.isArray(movieData.People)) return null;
                        
                        // Get first 3 actors
                        const actors = movieData.People.filter(p => p.Type === 'Actor').slice(0, 3);
                        if (actors.length === 0) return null;
                        
                        // Pick random actor
                        const selectedActor = actors[Math.floor(Math.random() * actors.length)];
                        
                        // Fetch items for this actor
                        const items = await fetchItemsByPersonId(selectedActor.Id, 'Movie');
                        
                        // Remove the source movie and filter for items where person is Actor
                        const filteredItems = filterPeopleByType(items, selectedActor.Id, 'Actor')
                            .filter(item => item.Id !== recentMovie.Id);
                        
                        if (filteredItems.length > 0) {
                            const orderedItems = applyDiscoverySectionOrdering(filteredItems, sectionConfig);
                            if (orderedItems.length === 0) return null;
                            return {
                                type: 'actor-recent',
                                sectionKey: 'starringActorRecentlyWatched',
                                config: sectionConfig,
                                data: {
                                    person: selectedActor,
                                    movie: recentMovie
                                },
                                items: orderedItems,
                                viewMoreUrl: `#/details?id=${selectedActor.Id}&serverId=${ApiClient.serverId()}`
                            };
                        }
                    } catch (err) {
                        ERR('Error generating actor-recent section:', err);
                    }
                    
                    return null;
                })(),
                
                // 10. Directed by [Director Name] since you recently watched [Movie Name]
                (async () => {
                    const sectionConfig = getDiscoverySectionSettings('directedByDirectorRecentlyWatched');
                    if (!sectionConfig || !sectionConfig.enabled) return null;
                    const recentMovie = getRandomRecentlyWatchedMovie(renderedDirectedWatchedMovies);
                    if (!recentMovie) return null;
                    
                    // Fetch the movie with People field included
                    try {
                        const apiClient = window.ApiClient;
                        const serverUrl = apiClient.serverAddress();
                        const token = apiClient.accessToken();
                        const userId = apiClient.getCurrentUserId();
                        
                        const movieUrl = `${serverUrl}/Users/${userId}/Items/${recentMovie.Id}?Fields=People`;
                        const movieResponse = await fetch(movieUrl, {
                            headers: {
                                "Authorization": `MediaBrowser Token="${token}"`
                            }
                        });
                        
                        if (!movieResponse.ok) return null;
                        
                        const movieData = await movieResponse.json();
                        if (!movieData.People || !Array.isArray(movieData.People)) return null;
                        
                        // Get directors
                        const directors = movieData.People.filter(p => p.Type === 'Director');
                        if (directors.length === 0) return null;
                        
                        // Pick random director
                        const selectedDirector = directors[Math.floor(Math.random() * directors.length)];
                        
                        // Check if already rendered (use same set as regular directors)
                        if (renderedDirectors.has(selectedDirector.Name)) return null;
                        
                        // Fetch items for this director
                        const items = await fetchItemsByPersonId(selectedDirector.Id, 'Movie');
                        
                        // Remove the source movie and filter for items where person is Director
                        const filteredItems = filterPeopleByType(items, selectedDirector.Id, 'Director')
                            .filter(item => item.Id !== recentMovie.Id);
                        
                        if (filteredItems.length > 0) {
                            renderedDirectors.add(selectedDirector.Name);
                            
                            const orderedItems = applyDiscoverySectionOrdering(filteredItems, sectionConfig);
                            if (orderedItems.length === 0) return null;
                            
                            return {
                                type: 'director-recent',
                                sectionKey: 'directedByDirectorRecentlyWatched',
                                config: sectionConfig,
                                data: {
                                    person: selectedDirector,
                                    movie: recentMovie
                                },
                                items: orderedItems,
                                viewMoreUrl: `#/details?id=${selectedDirector.Id}&serverId=${ApiClient.serverId()}`
                            };
                        }
                    } catch (err) {
                        ERR('Error generating director-recent section:', err);
                    }
                    
                    return null;
                })(),
                
                // 11. Written by [Writer Name] since you recently watched [Movie Name]
                (async () => {
                    const sectionConfig = getDiscoverySectionSettings('writtenByWriterRecentlyWatched');
                    if (!sectionConfig || !sectionConfig.enabled) return null;
                    const recentMovie = getRandomRecentlyWatchedMovie(renderedWrittenWatchedMovies);
                    if (!recentMovie) return null;
                    
                    // Fetch the movie with People field included
                    try {
                        const apiClient = window.ApiClient;
                        const serverUrl = apiClient.serverAddress();
                        const token = apiClient.accessToken();
                        const userId = apiClient.getCurrentUserId();
                        
                        const movieUrl = `${serverUrl}/Users/${userId}/Items/${recentMovie.Id}?Fields=People`;
                        const movieResponse = await fetch(movieUrl, {
                            headers: {
                                "Authorization": `MediaBrowser Token="${token}"`
                            }
                        });
                        
                        if (!movieResponse.ok) return null;
                        
                        const movieData = await movieResponse.json();
                        if (!movieData.People || !Array.isArray(movieData.People)) return null;
                        
                        // Get writers
                        const writers = movieData.People.filter(p => p.Type === 'Writer');
                        if (writers.length === 0) return null;
                        
                        // Pick random writer
                        const selectedWriter = writers[Math.floor(Math.random() * writers.length)];
                        
                        // Check if already rendered (use same set as regular writers)
                        if (renderedWriters.has(selectedWriter.Name)) return null;
                        
                        // Fetch items for this writer
                        const items = await fetchItemsByPersonId(selectedWriter.Id, 'Movie');
                        
                        // Remove the source movie and filter for items where person is Writer
                        const filteredItems = filterPeopleByType(items, selectedWriter.Id, 'Writer')
                            .filter(item => item.Id !== recentMovie.Id);
                        
                        if (filteredItems.length > 0) {
                            renderedWriters.add(selectedWriter.Name);
                            
                            const orderedItems = applyDiscoverySectionOrdering(filteredItems, sectionConfig);
                            if (orderedItems.length === 0) return null;
                            
                            return {
                                type: 'writer-recent',
                                sectionKey: 'writtenByWriterRecentlyWatched',
                                config: sectionConfig,
                                data: {
                                    person: selectedWriter,
                                    movie: recentMovie
                                },
                                items: orderedItems,
                                viewMoreUrl: `#/details?id=${selectedWriter.Id}&serverId=${ApiClient.serverId()}`
                            };
                        }
                    } catch (err) {
                        ERR('Error generating writer-recent section:', err);
                    }
                    
                    return null;
                })(),
                
                // 12. Spotlight: Top Rated from [Genre]
                (async () => {
                    if (!renderGenresSpotlight) return null;
                    const sectionConfig = getDiscoverySectionSettings('spotlightGenre');
                    if (!sectionConfig || !sectionConfig.enabled) return null;
                    
                    try {
                        let selectedGenre = null;
                        
                        if (forcedGenre) {
                            selectedGenre = forcedGenre;
                            // Ensure it's marked as rendered in spotlight tracking (if not already)
                            renderedGenres.add(selectedGenre.Id);
                        } else {
                            // Get qualifying genres (cached)
                            const allQualifyingGenres = await getQualifyingGenres();
                            if (allQualifyingGenres.length === 0) return null;
                            
                            // Filter out already rendered genres
                            const availableGenres = allQualifyingGenres.filter(genre => 
                                !renderedGenres.has(genre.Id)
                            );
                            
                            if (availableGenres.length === 0) return null;
                            
                            // Pick random genre
                            selectedGenre = availableGenres[Math.floor(Math.random() * availableGenres.length)];
                            
                            // Track rendered genre
                            renderedGenres.add(selectedGenre.Id);
                        }
                        
                        const itemLimit = sectionConfig.itemLimit ?? (discoveryConfig.defaultItemLimit ?? defaultItemLimit);
                        const moviesResponse = await ApiClient.getItems(ApiClient.getCurrentUserId(), {
                            Genres: selectedGenre.Name,
                            IncludeItemTypes: 'Movie',
                            Recursive: true,
                            SortBy: 'CommunityRating',
                            SortOrder: 'Descending',
                            Limit: itemLimit,
                            Fields: 'BackdropImageTags,ImageTags,People,Genres,Overview,Taglines,ProductionYear,RecursiveItemCount,ChildCount'
                        });
                        
                        const movies = moviesResponse.Items || [];
                        if (movies.length === 0) return null;
                        
                        return {
                            type: 'spotlight-genre',
                            sectionKey: 'spotlightGenre',
                            config: sectionConfig,
                            data: selectedGenre,
                            items: movies,
                            viewMoreUrl: `${ApiClient.serverAddress()}/web/#/list.html?genreId=${selectedGenre.Id}&serverId=${ApiClient.serverId()}`
                        };
                    } catch (err) {
                        ERR('Error generating spotlight genre section:', err);
                        return null;
                    }
                })(),
                
                // 13. Spotlight: Top Rated from [TV Network]
                (async () => {
                    if (!renderNetworksSpotlight) return null;
                    const sectionConfig = getDiscoverySectionSettings('spotlightNetwork');
                    if (!sectionConfig || !sectionConfig.enabled) return null;
                    
                    try {
                        let selectedNetwork = null;

                        if (forcedNetwork) {
                            selectedNetwork = forcedNetwork;
                            // Ensure it's marked as rendered in spotlight tracking
                            renderedNetworks.add(selectedNetwork.Id);
                        } else {
                            // Get popular TV networks
                            const networks = await getPopularTVNetworks();
                            if (networks.length === 0) return null;
                            
                            // Filter out already rendered networks
                            const availableNetworks = networks.filter(network => 
                                network.Id && !renderedNetworks.has(network.Id)
                            );
                            
                            if (availableNetworks.length === 0) return null;
                            
                            // Pick random network
                            selectedNetwork = availableNetworks[Math.floor(Math.random() * availableNetworks.length)];
                            
                            // Track rendered network
                            renderedNetworks.add(selectedNetwork.Id);
                        }
                        
                        const itemLimit = sectionConfig.itemLimit ?? (discoveryConfig.defaultItemLimit ?? defaultItemLimit);
                        const showsResponse = await ApiClient.getItems(ApiClient.getCurrentUserId(), {
                            StudioIds: selectedNetwork.Id,
                            IncludeItemTypes: 'Series',
                            Recursive: true,
                            SortBy: 'CommunityRating',
                            SortOrder: 'Descending',
                            Limit: itemLimit,
                            Fields: 'BackdropImageTags,ImageTags,Overview,Taglines,ProductionYear,RecursiveItemCount,ChildCount'
                        });
                        
                        const shows = showsResponse.Items || [];
                        if (shows.length === 0) return null;
                        
                        return {
                            type: 'spotlight-network',
                            sectionKey: 'spotlightNetwork',
                            config: sectionConfig,
                            data: selectedNetwork,
                            items: shows,
                            viewMoreUrl: `${ApiClient.serverAddress()}/web/#/list.html?studioId=${selectedNetwork.Id}&serverId=${ApiClient.serverId()}`
                        };
                    } catch (err) {
                        ERR('Error generating spotlight network section:', err);
                        return null;
                    }
                })(),
                
                // 14. Collection section
                (async () => {
                    if (!renderCollectionsSpotlight) return null;
                    const sectionConfig = getDiscoverySectionSettings('collections');
                    if (!sectionConfig || !sectionConfig.enabled) return null;
                    
                    try {
                        const minItems = sectionConfig.minimumItems ?? 10;
                        const userId = ApiClient.getCurrentUserId();
                        
                        const itemLimit = sectionConfig.itemLimit ?? (discoveryConfig.defaultItemLimit ?? defaultItemLimit);
                        const sortOrder = sectionConfig.sortOrder ?? discoveryConfig.defaultSortOrder ?? defaultSortOrder;
                        const sortOrderDirection = sectionConfig.sortOrderDirection ?? 'Ascending';
                        
                        // Fetch all collections (BoxSet items) with total record count
                        const collectionsData = await getCollectionsData();
                        if (!collectionsData) return null;
                        
                        // Filter by minimum item count using TotalRecordCount and exclude already rendered
                        const qualifyingCollections = collectionsData.Items.filter(collection => {
                            // Skip if already rendered
                            if (renderedCollections.has(collection.Id)) return false;
                            
                            // Check if collection has enough items using TotalRecordCount
                            // TotalRecordCount is available when EnableTotalRecordCount=true
                            const itemCount = collection.TotalRecordCount ?? collection.RecursiveChildCount ?? collection.ChildCount ?? 0;
                            return itemCount >= minItems;
                        });
                        
                        if (qualifyingCollections.length === 0) return null;
                        
                        // Randomly select one collection
                        const selectedCollection = qualifyingCollections[Math.floor(Math.random() * qualifyingCollections.length)];
                        
                        // Now fetch the items for the selected collection
                        const itemsData = await fetchCollectionData(selectedCollection.Id);
                        const items = itemsData.Items || [];
                        
                        if (items.length === 0) return null;
                        
                        // Apply sort order
                        let sortedItems = items;
                        if (sortOrder === 'Random') {
                            sortedItems = [...items].sort(() => Math.random() - 0.5);
                        } else if (window.cardBuilder && typeof window.cardBuilder.sortItems === 'function') {
                            sortedItems = window.cardBuilder.sortItems(items, sortOrder, sortOrderDirection);
                        }
                        
                        // Apply limit
                        const limited = sortedItems.slice(0, itemLimit);
                        if (limited.length === 0) return null;
                        
                        // Track rendered collection
                        renderedCollections.add(selectedCollection.Id);
                        
                        return {
                            type: 'collection',
                            sectionKey: 'collections',
                            config: sectionConfig,
                            data: selectedCollection,
                            items: limited,
                            viewMoreUrl: `/web/#/collection.html?id=${selectedCollection.Id}`,
                            sortOrder: sortOrder,
                            sortOrderDirection: sortOrderDirection,
                            cardFormat: sectionConfig.cardFormat ?? discoveryConfig.defaultCardFormat ?? defaultCardFormat
                        };
                    } catch (err) {
                        ERR('Error generating collection section:', err);
                        return null;
                    }
                })(),

                // 15. Custom discovery section
                (async () => {
                    const eligibleCustomSections = (customHomeSections || []).filter(section => section.enabled !== false && section.discoveryEnabled === true);
                    if (eligibleCustomSections.length === 0) return null;

                    let availableSections = eligibleCustomSections.filter(section => section.id && !renderedCustomDiscoverySections.has(section.id));
                    if (availableSections.length === 0) {
                        LOG('No eligible custom sections for discovery group remaining');
                        return null;
                    }

                    const selectedSection = availableSections[Math.floor(Math.random() * availableSections.length)];
                    if (!selectedSection) return null;

                    if (selectedSection.id) {
                        renderedCustomDiscoverySections.add(selectedSection.id);
                    }

                    return {
                        type: 'custom-discovery',
                        data: { ...selectedSection }
                    };
                })()
            ];
            
            // Wait for all parallel operations to complete
            const preloadResults = await Promise.all(preloadPromises);
            
            // Filter out null results and collect valid sections
            let sections = preloadResults.filter(section => section !== null);

            if (discoveryConfig.randomizeOrder) {
                sections = shuffleArray(sections);
            } else {
                sections.sort((a, b) => {
                    // Use explicit order on object if available (set by our matching logic), fallback to config order
                    const orderA = typeof a.order === 'number' ? a.order : (typeof a.config?.order === 'number' ? a.config.order : DISCOVERY_ORDER);
                    const orderB = typeof b.order === 'number' ? b.order : (typeof b.config?.order === 'number' ? b.config.order : DISCOVERY_ORDER);
                    return orderA - orderB;
                });
            }

            // Logic to position forced spotlight sections directly above their content
            // We run this AFTER randomization to force adjacency
            if (renderSpotlightAboveMatching) {
                // Adjust orders to ensure spotlight is right above content
                if (forcedGenre) {
                    const genreSectionIndex = sections.findIndex(s => s.type === 'genre' && s.data.Id === forcedGenre.Id);
                    const genreSpotlightIndex = sections.findIndex(s => s.type === 'spotlight-genre' && s.data.Id === forcedGenre.Id);
                    
                    if (genreSectionIndex !== -1 && genreSpotlightIndex !== -1) {
                        // Both exist in the array.
                        // Remove spotlight from its current position
                        const [spotlight] = sections.splice(genreSpotlightIndex, 1);
                        
                        // Find the new index of the content section (it might have shifted)
                        const newGenreSectionIndex = sections.findIndex(s => s.type === 'genre' && s.data.Id === forcedGenre.Id);
                        
                        // Insert spotlight immediately before the content section
                        sections.splice(newGenreSectionIndex, 0, spotlight);
                    }
                }

                if (forcedNetwork) {
                    const studioSectionIndex = sections.findIndex(s => s.type === 'studio' && s.data.Id === forcedNetwork.Id);
                    const networkSpotlightIndex = sections.findIndex(s => s.type === 'spotlight-network' && s.data.Id === forcedNetwork.Id);
                    
                    if (studioSectionIndex !== -1 && networkSpotlightIndex !== -1) {
                        // Both exist.
                        // Remove spotlight
                        const [spotlight] = sections.splice(networkSpotlightIndex, 1);
                        
                        // Find new content index
                        const newStudioSectionIndex = sections.findIndex(s => s.type === 'studio' && s.data.Id === forcedNetwork.Id);
                        
                        // Insert spotlight immediately before
                        sections.splice(newStudioSectionIndex, 0, spotlight);
                    }
                }
            }
            
            LOG(`Generated discovery group with ${sections.length} sections`);
            return sections;
            
        } catch (err) {
            ERR('Error generating discovery group:', err);
            return [];
        }
    }

    /**
     * Ensures the discovery buffer has 2 groups of discovery items
     * Simple approach: always maintain 2 groups in buffer
     */
    async function ensureDiscoveryBuffer() {
        const targetBufferSize = 2;
        
        if (discoveryBuffer.length >= targetBufferSize) {
            LOG(`Discovery buffer already has ${discoveryBuffer.length} groups (target: ${targetBufferSize})`);
            // Manage UI state based on buffer content
            manageDiscoveryUIState().catch(err => ERR('Error managing UI state:', err));
            return;
        }

        // Don't block recursive calls - only block if actively generating a group
        if (isLoadingDiscoveryGroup) {
            LOG('Discovery group already loading, waiting...');
            return;
        }

        isLoadingDiscoveryGroup = true;
        
        LOG(`Generating next discovery group (current: ${discoveryBuffer.length}/${targetBufferSize})`);
        
        try {
            // Generate one group at a time
            const newGroup = await generateDiscoveryGroup();
            
            // Add non-empty group to buffer
            if (newGroup && newGroup.length > 0) {
                discoveryBuffer.push(newGroup);
                LOG(`Added group to discovery buffer (total: ${discoveryBuffer.length})`);
                
                // Mark that additional content is available
                additionalDiscoveryContent = true;
                
                // Update UI state after adding first group (enables handlers earlier)
                manageDiscoveryUIState().catch(err => ERR('Error managing UI state:', err));
                
                // Recursively call to get more groups if needed
                if (discoveryBuffer.length < targetBufferSize) {
                    isLoadingDiscoveryGroup = false; // Allow recursive call
                    await ensureDiscoveryBuffer();
                }
            } else {
                // Couldn't generate any new group, mark that additional content is not available
                additionalDiscoveryContent = false;
                LOG('No additional discovery content available');
                manageDiscoveryUIState().catch(err => ERR('Error managing UI state:', err));
            }
        } catch (err) {
            ERR('Error ensuring discovery buffer:', err);
            additionalDiscoveryContent = false;
            manageDiscoveryUIState().catch(e => ERR('Error managing UI state:', e));
        } finally {
            isLoadingDiscoveryGroup = false;
        }
    }

    /**
     * Manages the UI state (handlers and button visibility) based on buffer content
     */
    async function manageDiscoveryUIState() {
        const homeSectionsContainer = document.querySelector('.libraryPage:not(.hide) .homeSectionsContainer');
        
        if (discoveryBuffer.length > 0) {
            // Buffer has content - set up handlers
            if (homeSectionsContainer) {
                setupInfiniteLoading(homeSectionsContainer);
                
                // Pre-render first group to prepare for smooth reveal
                if (hiddenDiscoverySections.length === 0) {
                    const firstGroup = discoveryBuffer[0];
                    if (firstGroup) {
                        LOG('Pre-rendering first discovery group for smooth reveal');
                        preRenderDiscoveryGroup(discoveryBuffer.shift()).then(preRendered => {
                            hiddenDiscoverySections.push(...preRendered);
                            LOG(`Pre-rendered first group: ${preRendered.length} sections ready`);
                        }).catch(err => {
                            ERR('Error pre-rendering first group:', err);
                        });
                    }
                }
            }
            LOG(`UI state updated: handlers enabled (buffer has ${discoveryBuffer.length} groups)`);
        } else {
            // Buffer empty - remove handlers and hide button
            removeScrollBasedLoading();
            const loadMoreButton = document.querySelector('.libraryPage:not(.hide) .load-more-discovery-btn');
            if (loadMoreButton) {
                loadMoreButton.style.display = 'none';
            }
            LOG('UI state updated: handlers removed, button hidden (buffer empty)');
        }
    }

    /**
     * Preloads the next batch of discovery sections in the background
     * Uses the new buffer-based system for better performance
     */
    async function preloadNextSections() {
        if (isPreloadingSections) {
            LOG('Preloading already in progress, skipping...');
            return;
        }
        
        isPreloadingSections = true;
        
        try {
            LOG('Preloading discovery sections using buffer system...');
            
            // Ensure buffer has 2 groups (simple constant buffer)
            await ensureDiscoveryBuffer();

            if (discoveryBuffer.length === 0) {
                LOG('No discovery sections to preload');
                hideDiscoveryLoadingIndicator();
                return;
            }
            
            LOG(`Discovery buffer populated with ${discoveryBuffer.length} groups`);
            
        } catch (err) {
            ERR('Error preloading discovery sections:', err);
        } finally {
            isPreloadingSections = false;
        }
    }

    /**
     * Renders the next group of discovery sections from the buffer
     * This is the unified function used by both infinite scroll and load more button
     * Uses pre-rendered sections with smooth sequential animation
     * @param {HTMLElement} container - Container to render sections into
     * @param {HTMLElement} loadMoreButton - Optional load more button to update state
     * @returns {Promise<boolean>} - Success status
     */
    async function renderNextDiscoveryGroup(container, loadMoreButton = null) {
        if (isRenderingDiscoveryGroup) {
            LOG('Discovery group rendering already in progress, skipping...');
            return false;
        }
        
        try {
            LOG('Rendering next discovery group from buffer');

            const loadMoreButton = container.querySelector('.load-more-discovery-btn');

            if (loadMoreButton) {
                loadMoreButton.remove();
            }
            
            // Show loading indicator
            showDiscoveryLoadingIndicator();

            isRenderingDiscoveryGroup = true;
            
            LOG(`Rendering group from buffer (${discoveryBuffer.length} groups available)`);

            setTimeout(async () => {
                async function renderDiscoveryGroup() {            
                    // Check if we have pre-rendered sections ready to reveal
                    if (hiddenDiscoverySections.length > 0) {
                        LOG(`Revealing ${hiddenDiscoverySections.length} pre-rendered sections with animation`);
                        const sectionsToReveal = hiddenDiscoverySections.splice(0); // Take all sections
                        
                        // Reveal sections with smooth animation
                        const revealedCount = await revealSectionsSequentially(container, sectionsToReveal);
                        
                        if (revealedCount > 0) {
                            LOG(`Successfully revealed ${revealedCount} pre-rendered sections`);
                            
                            // Pre-render next group from buffer in background
                            if (discoveryBuffer.length > 0) {
                                const nextGroup = discoveryBuffer.shift();
                                if (nextGroup) {
                                    const preRendered = await preRenderDiscoveryGroup(nextGroup);
                                    hiddenDiscoverySections.push(...preRendered);
                                }
                            }
                            
                            // Trigger background refill of buffer to update UI state
                            ensureDiscoveryBuffer().catch(err => {
                                ERR('Error refilling discovery buffer:', err);
                            });
                    
                            // Hide loading indicator
                            hideDiscoveryLoadingIndicator();
                            
                            return revealedCount > 0;
                        }
                    }
                    
                    // Fallback: if no pre-rendered sections, render directly from buffer (legacy behavior)
                    const groupToRender = discoveryBuffer.shift();
                    if (groupToRender && groupToRender.length > 0) {
                        // Remove loading indicator from DOM before rendering sections to prevent scroll jump
                        const loadingIndicator = document.querySelector('.libraryPage:not(.hide) #discovery-loading-indicator');
                        let loadingIndicatorClone = null;
                        if (loadingIndicator && loadingIndicator.parentNode) {
                            loadingIndicatorClone = loadingIndicator.cloneNode(true);
                            loadingIndicator.remove();
                            LOG('Removed loading indicator from DOM before rendering sections (fallback path)');
                        }
                        
                        let renderedCount = 0;
                        
                        // Render sections from the group (including spotlight and collection sections via generateDiscoveryGroup)
                        for (const sectionData of groupToRender) {
                            try {
                                const success = await renderDiscoverySection(sectionData, container);
                                if (success) {
                                    renderedCount++;
                                }
                            } catch (err) {
                                ERR(`Error rendering section ${sectionData.type}:`, err);
                            }
                        }
                        
                        LOG(`Rendered ${renderedCount}/${groupToRender.length} sections directly from buffer`);
                        
                        // Re-add loading indicator at the end of the container
                        if (loadingIndicatorClone) {
                            container.appendChild(loadingIndicatorClone);
                            LOG('Re-added loading indicator at the end of sections (fallback path)');
                        }
                        
                        // Trigger background refill of buffer to update UI state
                        ensureDiscoveryBuffer().catch(err => {
                            ERR('Error refilling discovery buffer:', err);
                        });
                    
                        // Hide loading indicator
                        hideDiscoveryLoadingIndicator();
                        
                        return renderedCount > 0;
                    }

                    return false;
                }

                await renderDiscoveryGroup();

                if (!enableInfiniteScroll) {
                    setupLoadMoreButton(container);
                }
                
                // Scroll down a tiny bit with a smooth animation to start revealing the sections
                window.scrollBy({
                    top: 100,
                    behavior: 'smooth'
                });
                isRenderingDiscoveryGroup = false;
            }, 100);

            return false;
            
        } catch (err) {
            ERR('Error rendering next discovery group:', err);
            return false;
        } finally {
            isRenderingDiscoveryGroup = false;
        }
    }

    /**
     * Handles the "Discover More" button click using the buffer system
     * @param {HTMLElement} loadMoreButton - The button element
     */
    async function handleDiscoverMoreClick(loadMoreButton) {
        try {
            LOG('Discover More button clicked');
            
            const homeSectionsContainer = document.querySelector('.libraryPage:not(.hide) .homeSectionsContainer');
            if (homeSectionsContainer) {
                await renderNextDiscoveryGroup(homeSectionsContainer, loadMoreButton);
            } else {
                ERR('Home sections container not found');
            }
            
        } catch (err) {
            ERR('Error handling Discover More click:', err);
        }
    }

    /**
     * Pre-renders a discovery group as DOM fragments (not yet in DOM)
     * @param {Array} group - Array of section data from buffer
     * @returns {Promise<Array>} - Array of DOM elements for each section
     */
    async function preRenderDiscoveryGroup(group) {
        if (!group || group.length === 0) return [];
        
        LOG(`Pre-rendering discovery group with ${group.length} sections`);
        
        const preRenderedSections = [];
        
        for (const sectionData of group) {
            try {
                const sectionElement = await buildDiscoverySectionElement(sectionData);
                if (sectionElement) {
                    preRenderedSections.push(sectionElement);
                }
            } catch (err) {
                ERR(`Error pre-rendering section ${sectionData.type}:`, err);
            }
        }
        
        LOG(`Pre-rendered ${preRenderedSections.length}/${group.length} sections`);
        return preRenderedSections;
    }

    /**
     * Builds a single discovery section DOM element without appending to DOM
     * @param {Object} sectionData - Section data object
     * @returns {Promise<HTMLElement>} - Section DOM element
     */
    async function buildDiscoverySectionElement(sectionData) {
        // Use a temporary container that we'll remove from DOM after extracting elements
        const tempContainer = document.createElement('div');
        tempContainer.style.display = 'none'; // Hide container
        
        // Build the section using existing renderDiscoverySection logic
        const success = await renderDiscoverySection(sectionData, tempContainer);
        
        if (!success || tempContainer.children.length === 0) {
            return null;
        }
        
        // Extract the first child (the section element)
        const sectionElement = tempContainer.firstElementChild;
        
        // Remove from temp container
        tempContainer.removeChild(sectionElement);
        
        return sectionElement;
    }

    /**
     * Reveals pre-rendered sections with scroll-triggered viewport animation
     * @param {HTMLElement} container - Container to append sections to
     * @param {Array} sections - Array of DOM elements to reveal
     * @returns {Promise<number>} - Number of sections revealed
     */
    async function revealSectionsSequentially(container, sections) {
        if (!sections || sections.length === 0) return 0;
        
        LOG(`Revealing ${sections.length} pre-rendered sections with scroll-triggered animation`);
        
        // Remove loading indicator from DOM before revealing sections to prevent scroll jump
        // We'll re-add it at the end after sections are revealed
        const loadingIndicator = document.querySelector('.libraryPage:not(.hide) #discovery-loading-indicator');
        let loadingIndicatorClone = null;
        if (loadingIndicator && loadingIndicator.parentNode) {
            loadingIndicatorClone = loadingIndicator.cloneNode(true);
            loadingIndicator.remove();
            LOG('Removed loading indicator from DOM before revealing sections');
        }
        
        // Add all sections to DOM with initial animation class (hidden)
        sections.forEach(section => {
            section.style.display = 'none';
            section.classList.add('discovery-section-reveal');
            container.appendChild(section);
        });
        
        // Create intersection observer for scroll-triggered animations
        const observerOptions = {
            threshold: 0.1, // Trigger when 10% of section is visible
            rootMargin: '0px 0px -50px 0px' // Trigger slightly before fully in view
        };
        
        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    // Add in-viewport class to trigger animation
                    entry.target.classList.add('in-viewport');
                    // Unobserve after animation is triggered
                    observer.unobserve(entry.target);
                }
            });
        }, observerOptions);
        
        // Remove display: none and observe sections
        sections.forEach(section => {
            section.style.display = '';            
            // Observe section for viewport entry
            observer.observe(section);
        });
        
        // Re-add loading indicator at the end of the container (now it's at the end in DOM order too)
        if (loadingIndicatorClone) {
            container.appendChild(loadingIndicatorClone);
            LOG('Re-added loading indicator at the end of sections');
        }
        
        LOG(`Revealed ${sections.length} sections with scroll-triggered animation`);
        return sections.length;
    }

    /**
     * Preloads genre section data
     * @param {Object} genre - Genre object
     * @returns {Promise<Object|null>} - Genre data with items and viewMoreUrl
     */
    async function preloadGenreSection(genre, limit = 16) {
        try {
            const apiClient = window.ApiClient;
            const serverUrl = apiClient.serverAddress();
            const token = apiClient.accessToken();
            const userId = apiClient.getCurrentUserId();
            const serverId = apiClient.serverId();
            
            const url = `${serverUrl}/Items?userId=${userId}&Genres=${encodeURIComponent(genre.Name)}&IncludeItemTypes=Movie&Recursive=true&SortBy=Random&Fields=UserData&Limit=${limit}`;
            
            const response = await fetch(url, {
                headers: {
                    "Authorization": `MediaBrowser Token="${token}"`
                }
            });
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            const data = await response.json();
            const items = data.Items || [];
            
            if (items.length === 0) return null;
            
            const viewMoreUrl = `/web/#/list.html?genreId=${genre.Id}&serverId=${serverId}`;
            
            return {
                items: items,
                viewMoreUrl: viewMoreUrl,
                hasFullItems: true
            };
            
        } catch (err) {
            ERR(`Error preloading genre section for ${genre.Name}:`, err);
            return null;
        }
    }

    /**
     * Preloads "because you watched" section data
     * @param {Object} movie - Movie object
     * @returns {Promise<Object|null>} - Similar content data
     */
    async function preloadBecauseYouWatchedSection(movie, limit = 16) {
        try {
            const items = await fetchSimilarContent(movie.Id, 'Movie');
            if (items.length === 0) return null;
            
            return {
                items: items, // Return all items, let render logic handle limit
                hasFullItems: true
            };
            
        } catch (err) {
            ERR(`Error preloading because you watched section for ${movie.Name}:`, err);
            return null;
        }
    }

    /**
     * Preloads "because you liked" section data
     * @param {Object} movie - Movie object
     * @returns {Promise<Object|null>} - Similar content data
     */
    async function preloadBecauseYouLikedSection(movie, limit = 16) {
        try {
            const items = await fetchSimilarContent(movie.Id, 'Movie');
            if (items.length === 0) return null;
            
            return {
                items: items, // Return all items, let render logic handle limit
                hasFullItems: true
            };
            
        } catch (err) {
            ERR(`Error preloading because you liked section for ${movie.Name}:`, err);
            return null;
        }
    }

    /**
     * Renders a discovery section (unified function for both preloaded and dynamic sections)
     * @param {Object|string} sectionData - Preloaded section data object OR section type string
     * @param {HTMLElement} container - Container to append section to
     * @returns {Promise<boolean>} - Success status
     */
    async function renderDiscoverySection(sectionData, container) {
        try {
            let sectionName = '';
            let items = [];
            let viewMoreUrl = null;
            let sectionId = '';
            let order = DISCOVERY_ORDER + renderedSections.size;
            let sectionConfig = null;
            let sectionKey = null;

            if (typeof sectionData === 'object' && sectionData.type === 'custom-discovery') {
                const baseSection = sectionData.data || {};
                const clonedSection = JSON.parse(JSON.stringify(baseSection));
                const uniqueSuffix = `${Date.now()}-${Math.floor(Math.random() * 1000)}`;
                clonedSection.id = `${clonedSection.id || clonedSection.name || 'custom'}-discovery-${uniqueSuffix}`;
                clonedSection.order = DISCOVERY_ORDER + renderedSections.size;
                const success = await renderCustomSection(clonedSection, container);
                if (success) {
                    renderedSections.add(clonedSection.id);
                }
                return success;
            }
            
            // Handle preloaded section data
            if (typeof sectionData === 'object' && sectionData.type) {
                if (!sectionData.items || sectionData.items.length === 0) return false;
                
                sectionKey = sectionData.sectionKey || getDiscoverySectionKeyFromType(sectionData.type);
                sectionConfig = sectionData.config || getDiscoverySectionSettings(sectionKey);
                if (!sectionConfig || sectionConfig.enabled === false) return false;
                items = sectionData.items;
                viewMoreUrl = sectionData.viewMoreUrl || null;
                items = applyDiscoverySectionOrdering(items, sectionConfig);
                if (!items || items.length === 0) return false;
                
                // Helper function to format section names with placeholders
                function formatSectionName(template, replacements) {
                    let name = template;
                    for (const [key, value] of Object.entries(replacements)) {
                        name = name.replace(new RegExp(`\\[${key}\\]`, 'gi'), value || '');
                    }
                    return name;
                }
                
                switch (sectionData.type) {
                    case 'genre':
                        const genreTemplate = sectionConfig?.name || '[Genre] Movies';
                        sectionName = formatSectionName(genreTemplate, { Genre: sectionData.data.Name });
                        sectionId = `genre-${sectionData.data.Name.toLowerCase()}`;
                        break;
                    case 'director':
                        const directorTemplate = sectionConfig?.name || 'Directed by [Director]';
                        sectionName = formatSectionName(directorTemplate, { Director: sectionData.data.name });
                        sectionId = `director-${sectionData.data.name.toLowerCase().replace(/\s+/g, '-')}`;
                        break;
                    case 'writer':
                        const writerTemplate = sectionConfig?.name || 'Written by [Writer]';
                        sectionName = formatSectionName(writerTemplate, { Writer: sectionData.data.name });
                        sectionId = `writer-${sectionData.data.name.toLowerCase().replace(/\s+/g, '-')}`;
                        break;
                    case 'actor':
                        const actorTemplate = sectionConfig?.name || 'Starring [Actor]';
                        sectionName = formatSectionName(actorTemplate, { Actor: sectionData.data.name });
                        sectionId = `actor-${sectionData.data.name.toLowerCase().replace(/\s+/g, '-')}`;
                        break;
                    case 'watched':
                        const watchedTemplate = sectionConfig?.name || 'Because you watched [Movie]';
                        const watchedMovieName = `${sectionData.data.Name}${sectionData.data.ProductionYear ? ` (${sectionData.data.ProductionYear})` : ''}`;
                        sectionName = formatSectionName(watchedTemplate, { Movie: watchedMovieName });
                        sectionId = `watched-${sectionData.data.Id}`;
                        break;
                    case 'liked':
                        const likedTemplate = sectionConfig?.name || 'Because you liked [Movie]';
                        const likedMovieName = `${sectionData.data.Name}${sectionData.data.ProductionYear ? ` (${sectionData.data.ProductionYear})` : ''}`;
                        sectionName = formatSectionName(likedTemplate, { Movie: likedMovieName });
                        sectionId = `liked-${sectionData.data.Id}`;
                        break;
                    case 'studio':
                        const studioTemplate = sectionConfig?.name || 'Shows from [Studio]';
                        sectionName = formatSectionName(studioTemplate, { Studio: sectionData.data.Name });
                        sectionId = `studio-${sectionData.data.Id}`;
                        break;
                    case 'watched-recent':
                        const watchedRecentTemplate = sectionConfig?.name || 'Because you recently watched [Movie]';
                        const watchedRecentMovieName = `${sectionData.data.Name}${sectionData.data.ProductionYear ? ` (${sectionData.data.ProductionYear})` : ''}`;
                        sectionName = formatSectionName(watchedRecentTemplate, { Movie: watchedRecentMovieName });
                        sectionId = `watched-recent-${sectionData.data.Id}`;
                        break;
                    case 'actor-recent':
                        const actorRecentTemplate = sectionConfig?.name || 'Starring [Actor] because you recently watched [Movie]';
                        const actorRecentMovieName = `${sectionData.data.movie.Name}${sectionData.data.movie.ProductionYear ? ` (${sectionData.data.movie.ProductionYear})` : ''}`;
                        sectionName = formatSectionName(actorRecentTemplate, { 
                            Actor: sectionData.data.person.Name, 
                            Movie: actorRecentMovieName 
                        });
                        sectionId = `actor-recent-${sectionData.data.person.Id}-${sectionData.data.movie.Id}`;
                        break;
                    case 'director-recent':
                        const directorRecentTemplate = sectionConfig?.name || 'Directed by [Director] because you recently watched [Movie]';
                        const directorRecentMovieName = `${sectionData.data.movie.Name}${sectionData.data.movie.ProductionYear ? ` (${sectionData.data.movie.ProductionYear})` : ''}`;
                        sectionName = formatSectionName(directorRecentTemplate, { 
                            Director: sectionData.data.person.Name, 
                            Movie: directorRecentMovieName 
                        });
                        sectionId = `director-recent-${sectionData.data.person.Id}-${sectionData.data.movie.Id}`;
                        break;
                    case 'writer-recent':
                        const writerRecentTemplate = sectionConfig?.name || 'Written by [Writer] because you recently watched [Movie]';
                        const writerRecentMovieName = `${sectionData.data.movie.Name}${sectionData.data.movie.ProductionYear ? ` (${sectionData.data.movie.ProductionYear})` : ''}`;
                        sectionName = formatSectionName(writerRecentTemplate, { 
                            Writer: sectionData.data.person.Name, 
                            Movie: writerRecentMovieName 
                        });
                        sectionId = `writer-recent-${sectionData.data.person.Id}-${sectionData.data.movie.Id}`;
                        break;
                    case 'spotlight-genre':
                        // Handle spotlight genre section - render as spotlight
                        if (!window.cardBuilder || !window.cardBuilder.renderSpotlightSection) {
                            WARN("cardBuilder.renderSpotlightSection not available");
                            return false;
                        }
                        const spotlightGenreTemplate = sectionConfig?.name || 'Spotlight';
                        sectionName = formatSectionName(spotlightGenreTemplate, { Genre: sectionData.data.Name });
                        sectionId = `spotlight-genre-${sectionData.data.Id}`;
                        const spotlightGenreContainer = window.cardBuilder.renderSpotlightSection(
                            items,
                            sectionName,
                            {
                                autoPlay: true,
                                interval: 5000,
                                showDots: true,
                                showNavButtons: true,
                                showClearArt: true
                            },
                        );
                        spotlightGenreContainer.setAttribute('data-custom-section-id', sectionId);
                        spotlightGenreContainer.setAttribute('data-custom-section-name', sectionName);
                        spotlightGenreContainer.style.order = order;
                        container.appendChild(spotlightGenreContainer);
                        renderedSections.add(sectionId);
                        return true;
                    case 'spotlight-network':
                        // Handle spotlight network section - render as spotlight
                        if (!window.cardBuilder || !window.cardBuilder.renderSpotlightSection) {
                            WARN("cardBuilder.renderSpotlightSection not available");
                            return false;
                        }
                        const spotlightNetworkTemplate = sectionConfig?.name || 'Spotlight';
                        sectionName = formatSectionName(spotlightNetworkTemplate, { Studio: sectionData.data.Name });
                        sectionId = `spotlight-network-${sectionData.data.Id}`;
                        const spotlightNetworkContainer = window.cardBuilder.renderSpotlightSection(
                            items,
                            sectionName,
                            {
                                autoPlay: true,
                                interval: 5000,
                                showDots: true,
                                showNavButtons: true,
                                showClearArt: true
                            }
                        );
                        spotlightNetworkContainer.setAttribute('data-custom-section-id', sectionId);
                        spotlightNetworkContainer.setAttribute('data-custom-section-name', sectionName);
                        spotlightNetworkContainer.style.order = order;
                        container.appendChild(spotlightNetworkContainer);
                        renderedSections.add(sectionId);
                        return true;
                    case 'collection':
                        // Handle collection section - use provided config
                        const collectionTemplate = sectionConfig?.name || '[Collection Name]';
                        sectionName = formatSectionName(collectionTemplate, { 'Collection Name': sectionData.data.Name || 'Collection' });
                        sectionId = `collection-${sectionData.data.Id}`;
                        const collectionItemLimit = sectionConfig?.itemLimit ?? (discoveryConfig.defaultItemLimit ?? defaultItemLimit);
                        const collectionSortOrder = sectionConfig?.sortOrder ?? discoveryConfig.defaultSortOrder ?? defaultSortOrder;
                        const collectionSortOrderDirection = sectionConfig?.sortOrderDirection ?? 'Ascending';
                        const collectionCardFormat = sectionConfig?.cardFormat ?? discoveryConfig.defaultCardFormat ?? defaultCardFormat;
                        
                        // Apply sort order if needed
                        let collectionItems = items;
                        if (collectionSortOrder === 'Random') {
                            collectionItems = [...items].sort(() => Math.random() - 0.5);
                        } else if (window.cardBuilder && typeof window.cardBuilder.sortItems === 'function') {
                            collectionItems = window.cardBuilder.sortItems(items, collectionSortOrder, collectionSortOrderDirection);
                        }
                        
                        // Apply limit
                        const limitedCollectionItems = collectionItems.slice(0, collectionItemLimit);
                        if (limitedCollectionItems.length === 0) {
                            return false;
                        }

                        let collectionContainer = null;

                        if (window.cardBuilder && window.cardBuilder.renderSpotlightSection) {
                            collectionContainer = window.cardBuilder.renderSpotlightSection(
                                limitedCollectionItems,
                                sectionName,
                                {
                                    autoPlay: true,
                                    interval: 5000,
                                    showDots: true,
                                    showNavButtons: true,
                                    showClearArt: true
                                }
                            );
                        }
                        
                        if (!collectionContainer && window.cardBuilder && window.cardBuilder.renderCards) {
                            collectionContainer = window.cardBuilder.renderCards(
                                limitedCollectionItems,
                                sectionName,
                                sectionData.viewMoreUrl || `/web/#/collection.html?id=${sectionData.data.Id}`,
                                true,
                                collectionCardFormat,
                                collectionSortOrder,
                                collectionSortOrderDirection
                            );
                        }
                        
                        collectionContainer.setAttribute('data-custom-section-id', sectionId);
                        collectionContainer.setAttribute('data-custom-section-name', sectionName);
                        collectionContainer.style.order = order;
                        container.appendChild(collectionContainer);
                        renderedSections.add(sectionId);
                        return true;
                    default:
                        return false;
                }
            } else if (typeof sectionData === 'string') {
                sectionKey = getDiscoverySectionKeyFromType(sectionData);
                sectionConfig = getDiscoverySectionSettings(sectionKey);
                if (!sectionConfig || sectionConfig.enabled === false) {
                    return false;
                }
                if (items && items.length > 0) {
                    items = applyDiscoverySectionOrdering(items, sectionConfig);
                }
                if (!sectionName) {
                    sectionName = sectionConfig.name || sectionName;
                }
            }        
            
            if (items.length === 0) {
                return false; // Auto-hide empty sections
            }
            
            const activeSectionConfig = sectionConfig || (sectionKey ? getDiscoverySectionSettings(sectionKey) : null);
            const itemLimit = activeSectionConfig?.itemLimit ?? (discoveryConfig.defaultItemLimit ?? defaultItemLimit);
            const sortOrder = activeSectionConfig?.sortOrder ?? discoveryConfig.defaultSortOrder ?? defaultSortOrder;
            const sortOrderDirection = activeSectionConfig?.sortOrderDirection ?? 'Ascending';
            const cardFormat = activeSectionConfig?.cardFormat ?? discoveryConfig.defaultCardFormat ?? defaultCardFormat;
            
            const limitedItems = activeSectionConfig ? items : items.slice(0, itemLimit);
            
            if (limitedItems.length === 0) {
                return false; // Auto-hide empty sections
            }
            
            // Check if cardBuilder is available
            if (typeof window.cardBuilder === 'undefined') {
                WARN("cardBuilder not available, skipping discovery section");
                return false;
            }
            
            // Determine if we have full items or just IDs
            const hasFullItems = limitedItems.length > 0 && limitedItems[0] && typeof limitedItems[0] === 'object' && limitedItems[0].Id;
            
            let scrollableContainer;
            if (hasFullItems) {
                // Use renderCards for full item objects
                if (!window.cardBuilder.renderCards) {
                    WARN("cardBuilder.renderCards not available, skipping discovery section");
                    return false;
                }
                scrollableContainer = window.cardBuilder.renderCards(
                    limitedItems, 
                    sectionName, 
                    viewMoreUrl, 
                    true,
                    cardFormat,
                    sortOrder,
                    sortOrderDirection
                );
            } else {
                // Use renderCardsFromIds for ID arrays
                if (!window.cardBuilder.renderCardsFromIds) {
                    WARN("cardBuilder.renderCardsFromIds not available, skipping discovery section");
                    return false;
                }
                scrollableContainer = await window.cardBuilder.renderCardsFromIds(
                    limitedItems, 
                    sectionName, 
                    viewMoreUrl, 
                    true,
                    cardFormat,
                    sortOrder,
                    sortOrderDirection
                );
            }
            
            // Add data attributes to track rendered sections
            scrollableContainer.setAttribute('data-custom-section-id', sectionId);
            scrollableContainer.setAttribute('data-custom-section-name', sectionName);
            scrollableContainer.style.order = order;
            
            // Append to container
            container.appendChild(scrollableContainer);
            
            // Track rendered section for preloaded sections
            if (typeof sectionData === 'object') {
                renderedSections.add(sectionId);
            }
            
            return true;
            
        } catch (err) {
            ERR(`Error rendering discovery section:`, err);
            return false;
        }
    }


    /**
     * Sets up infinite loading for discovery sections
     * @param {HTMLElement} container - Container to watch for scroll
     */
    function setupInfiniteLoading(container) {
        const homePage = document.querySelector('.homePage:not(.hide)');

        if (!homePage || homePage.dataset.discoveryReady === 'true') {
            LOG('Home page not found or already discovery ready, skipping...');
            LOG('homePage:', homePage);
            return;
        }

        homePage.dataset.discoveryReady = 'true';

        if (enableInfiniteScroll) {
            homePage.dataset.infiniteScroll = 'true';
            setupScrollBasedLoading(container);
        } else {
            setupLoadMoreButton(container);
        }
    }

    /**
     * Removes scroll-based infinite loading handler
     */
    function removeScrollBasedLoading() {
        // Fade out message for "loading more"
        const loadingIndicator = document.querySelector('.libraryPage:not(.hide) #discovery-loading-indicator');

        if (discoveryScrollHandler) {
            window.removeEventListener('scroll', discoveryScrollHandler);
            discoveryScrollHandler = null;
            LOG('Scroll-based infinite loading for discovery sections removed');
        }
        if (discoveryWheelHandler) {
            window.removeEventListener('wheel', discoveryWheelHandler);
            discoveryWheelHandler = null;
            LOG('Wheel-based trigger for discovery sections removed');
        }
        if (discoveryTouchStartHandler) {
            window.removeEventListener('touchstart', discoveryTouchStartHandler);
            discoveryTouchStartHandler = null;
        }
        if (discoveryTouchMoveHandler) {
            window.removeEventListener('touchmove', discoveryTouchMoveHandler);
            discoveryTouchMoveHandler = null;
            LOG('Touch-based trigger for discovery sections removed');
        }
    }

    /**
     * Sets up scroll-based infinite loading
     * @param {HTMLElement} container - Container to watch for scroll
     */
    function setupScrollBasedLoading(container) {        
        // Remove existing handler if present (make idempotent)
        removeScrollBasedLoading();
        
        let lastScrollTop = 0;
        let scrollTimeout = null;
        let lastTouchY = null;
        
        const handleScroll = () => {
            // Ensure we're on the home page before proceeding
            const currentView = window.KefinTweaksUtils?.getCurrentView();
            const isHomePage = currentView === 'home' || currentView === 'home.html';
            
            // Only enable scroll-based loading on the home page
            if (!isHomePage) {
                return;
            }

            // Only enable scroll-based loading on the home page first tab
            const activeTab = document.querySelector('.headerTabs .emby-tab-button-active').getAttribute('data-index');
            if (activeTab !== '0') {
                return;
            }

            if (isRenderingDiscoveryGroup) return;

            const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
            lastScrollTop = scrollTop;
        };
        
        // Store handler reference and add scroll listener
        discoveryScrollHandler = handleScroll;
        window.addEventListener('scroll', handleScroll, { passive: true });

        // Also trigger when user attempts to scroll down while already at the bottom
        const handleWheel = (event) => {
            // Ensure we're on the home page before proceeding
            const currentView = window.KefinTweaksUtils?.getCurrentView();
            const isHomePage = currentView === 'home' || currentView === 'home.html';
            if (!isHomePage) return;

            // Only on first tab
            const activeTab = document.querySelector('.headerTabs .emby-tab-button-active').getAttribute('data-index');
            if (activeTab !== '0') return;

            if (isRenderingDiscoveryGroup) return;

            // Only react to downward scroll attempts
            if (event.deltaY <= 0) return; 

            const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
            const windowHeight = window.innerHeight;
            const documentHeight = document.documentElement.scrollHeight;

            const atBottom = scrollTop + windowHeight >= documentHeight - 2;
            if (!atBottom) return;

            if (scrollTimeout) {
                clearTimeout(scrollTimeout);
            }
            scrollTimeout = setTimeout(async () => {
                LOG('User attempted to scroll past bottom; loading next discovery group...');
                const homeScreenSectionsContainer = document.querySelector('.libraryPage:not(.hide) .homeSectionsContainer');
                await renderNextDiscoveryGroup(homeScreenSectionsContainer);
            }, 200);
        };

        discoveryWheelHandler = handleWheel;
        window.addEventListener('wheel', handleWheel, { passive: true });

        // Touch support: trigger when user swipes up (scroll down) while already at bottom
        const handleTouchStart = (event) => {
            const touch = event.touches && event.touches[0];
            lastTouchY = touch ? touch.clientY : null;
        };

        const handleTouchMove = (event) => {
            // Ensure we're on the home page before proceeding
            const currentView = window.KefinTweaksUtils?.getCurrentView();
            const isHomePage = currentView === 'home' || currentView === 'home.html';
            if (!isHomePage) return;

            // Only on first tab
            const activeTab = document.querySelector('.headerTabs .emby-tab-button-active').getAttribute('data-index');
            if (activeTab !== '0') return;

            if (isRenderingDiscoveryGroup) return;

            const touch = event.touches && event.touches[0];
            if (!touch) return;

            if (lastTouchY == null) {
                lastTouchY = touch.clientY;
                return;
            }

            const deltaY = touch.clientY - lastTouchY; // negative when swiping up (scrolling down)
            lastTouchY = touch.clientY;

            // Only react to upward swipe which scrolls content down
            if (deltaY >= 0) return;

            const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
            const windowHeight = window.innerHeight;
            const documentHeight = document.documentElement.scrollHeight;

            const atBottom = scrollTop + windowHeight >= documentHeight - 2;
            if (!atBottom) return;

            if (scrollTimeout) {
                clearTimeout(scrollTimeout);
            }
            scrollTimeout = setTimeout(async () => {
                LOG('User swiped up at bottom; loading next discovery group...');
                await renderNextDiscoveryGroup(container);
            }, 200);
        };

        discoveryTouchStartHandler = handleTouchStart;
        discoveryTouchMoveHandler = handleTouchMove;
        window.addEventListener('touchstart', handleTouchStart, { passive: true });
        window.addEventListener('touchmove', handleTouchMove, { passive: true });
        
        LOG('Scroll-based infinite loading for discovery sections enabled');
    }

    /**
     * Sets up load more button for discovery sections
     * @param {HTMLElement} container - Container to append button to
     */
    function setupLoadMoreButton(container) {
        let loadMoreButton = document.querySelector('.libraryPage:not(.hide) .load-more-discovery-btn');
        
        if (!loadMoreButton) {
            // Create load more button
            loadMoreButton = document.createElement('button');
            loadMoreButton.textContent = 'Discover More';
            loadMoreButton.className = 'load-more-discovery-btn raised button-submit emby-button';
            loadMoreButton.style.cssText = `
                order: 9998 !important;
                display: block;
                width: 100%;
                max-width: 400px;
                margin: 20px auto;
                padding: 12px 24px;
                background: #673AB7;
                color: white;
                border: none;
                border-radius: 6px;
                font-size: 16px;
                font-weight: 600;
                cursor: pointer;
                transition: all 0.2s ease;
            `;
            
            // Add hover effects
            loadMoreButton.addEventListener('mouseenter', () => {
                loadMoreButton.style.transform = 'translateY(-2px)';
                loadMoreButton.style.boxShadow = '0 4px 12px rgba(0, 164, 220, 0.4)';
            });
            
            loadMoreButton.addEventListener('mouseleave', () => {
                loadMoreButton.style.transform = 'translateY(0)';
                loadMoreButton.style.boxShadow = '0 2px 8px rgba(0, 164, 220, 0.3)';
            });
            
            // Add click handler using new buffer system
            loadMoreButton.addEventListener('click', async () => {
                await handleDiscoverMoreClick(loadMoreButton);
            });
            
            // Append button to container
            container.appendChild(loadMoreButton);
            
            LOG('Load more button for discovery sections created');
        }
        
        // Update visibility based on buffer state
        updateLoadMoreButtonVisibility();
    }

    /**
     * Updates the visibility of the load more button based on buffer state
     */
    function updateLoadMoreButtonVisibility() {
        const loadMoreButton = document.querySelector('.libraryPage:not(.hide) .load-more-discovery-btn');
        if (!loadMoreButton) return;
        
        if (discoveryBuffer.length > 0 || additionalDiscoveryContent) {
            loadMoreButton.textContent = 'Discover More';
            loadMoreButton.style.display = 'block';
            loadMoreButton.disabled = false;
            LOG('Load more button shown');
        } else {
            loadMoreButton.style.display = 'none';
            LOG('Load more button hidden');
        }
    }

    /**
     * Gets a random genre that hasn't been rendered yet
     * @returns {Promise<Object|null>} - Random genre or null
     */
    /**
     * Gets qualifying genres (genres with enough movies) with caching
     * @returns {Promise<Array>} Array of qualifying genre objects
     */
    async function getQualifyingGenres() {
        // Return cached if available
        if (cachedQualifyingGenres !== null) {
            return cachedQualifyingGenres;
        }
        
        // Prevent parallel caching
        if (isCachingQualifyingGenres) {
            // Wait for the other call to complete
            while (isCachingQualifyingGenres) {
                await new Promise(resolve => setTimeout(resolve, 100));
            }
            return cachedQualifyingGenres || [];
        }
        
        isCachingQualifyingGenres = true;
        
        try {
            LOG('Fetching and caching qualifying genres...');
            
            // Get all genres
            const serverAddress = ApiClient.serverAddress();
            const token = ApiClient.accessToken();
            const genresResponse = await fetch(`${serverAddress}/Genres?IncludeItemTypes=Movie`, {
                headers: { "Authorization": `MediaBrowser Token="${token}"` }
            });
            
            if (!genresResponse.ok) {
                ERR(`Failed to fetch genres: ${genresResponse.statusText}`);
                isCachingQualifyingGenres = false;
                return [];
            }
            
            const genresData = await genresResponse.json();
            const genres = genresData.Items || [];
            const qualifyingGenres = [];
            
            // Check each genre to see if it has enough movies
            for (const genre of genres) {
                if (genre.MovieCount < minGenreMovieCount) continue;
                qualifyingGenres.push(genre);
            }
            
            // Cache the results
            cachedQualifyingGenres = qualifyingGenres;
            LOG(`Cached ${qualifyingGenres.length} qualifying genres`);
            console.log(qualifyingGenres);
            
            return qualifyingGenres;
        } catch (err) {
            ERR('Error fetching qualifying genres:', err);
            isCachingQualifyingGenres = false;
            return [];
        } finally {
            isCachingQualifyingGenres = false;
        }
    }

    async function getRandomGenre() {
        const cache = new window.LocalStorageCache();
        let movieGenres = cache.get('movieGenres');
        
        if (!movieGenres || movieGenres.length === 0) {
            movieGenres = await fetchAndCacheMovieGenres();
        }
        
        if (movieGenres.length === 0) return null;
        
        // Filter out already rendered genres and genres with insufficient movie count
        const availableGenres = movieGenres.filter(genre => 
            !renderedSections.has(`genre-${genre.Name.toLowerCase()}`) &&
            (genre.MovieCount || 0) >= minGenreMovieCount
        );
        
        if (availableGenres.length === 0) return null;
        
        const randomGenre = getRandomItem(availableGenres);
        if (randomGenre) {
            renderedSections.add(`genre-${randomGenre.Name.toLowerCase()}`);
        }
        
        return randomGenre;
    }

    /**
     * Renders Halloween Movies section
     * @param {HTMLElement} container - Container to append the section to
     * @returns {boolean} - Success status
     */
    function renderHalloweenMoviesSection(container) {
        try {
            if (halloweenMovies.length === 0) return false;
            
            const shuffled = [...halloweenMovies].sort(() => Math.random() - 0.5);
            const limitedItems = shuffled.slice(0, SEASONAL_ITEM_LIMIT);
            
            if (limitedItems.length === 0) return false;
            
            // Check if cardBuilder is available
            if (typeof window.cardBuilder === 'undefined' || !window.cardBuilder.renderCards) {
                WARN("cardBuilder not available, skipping Halloween Movies section");
                return false;
            }
            
            // Render the scrollable container
            const scrollableContainer = window.cardBuilder.renderCards(
                limitedItems,
                'Halloween Movies',
                null,
                true
            );
            
            scrollableContainer.setAttribute('data-custom-section-id', 'halloween-movies');
            scrollableContainer.setAttribute('data-custom-section-name', 'Halloween Movies');
            scrollableContainer.style.order = 50;
            
            container.appendChild(scrollableContainer);
            return true;
            
        } catch (err) {
            ERR('Error rendering Halloween Movies section:', err);
            return false;
        }
    }

    /**
     * Renders Horror Movies section
     * @param {HTMLElement} container - Container to append the section to
     * @returns {boolean} - Success status
     */
    function renderHorrorMoviesSection(container) {
        try {
            if (horrorMovies.length === 0) return false;
            
            const shuffled = [...horrorMovies].sort(() => Math.random() - 0.5);
            const limitedItems = shuffled.slice(0, SEASONAL_ITEM_LIMIT);
            
            if (limitedItems.length === 0) return false;
            
            // Check if cardBuilder is available
            if (typeof window.cardBuilder === 'undefined' || !window.cardBuilder.renderCards) {
                WARN("cardBuilder not available, skipping Horror Movies section");
                return false;
            }
            
            // Render the scrollable container
            const scrollableContainer = window.cardBuilder.renderCards(
                limitedItems,
                'Horror Movies',
                halloweenViewMoreUrls.horror,
                true
            );
            
            scrollableContainer.setAttribute('data-custom-section-id', 'horror-movies');
            scrollableContainer.setAttribute('data-custom-section-name', 'Horror Movies');
            scrollableContainer.style.order = 51;
            
            container.appendChild(scrollableContainer);
            return true;
            
        } catch (err) {
            ERR('Error rendering Horror Movies section:', err);
            return false;
        }
    }

    /**
     * Renders Thriller Movies section
     * @param {HTMLElement} container - Container to append the section to
     * @returns {boolean} - Success status
     */
    function renderThrillerMoviesSection(container) {
        try {
            if (thrillerMovies.length === 0) return false;
            
            const shuffled = [...thrillerMovies].sort(() => Math.random() - 0.5);
            const limitedItems = shuffled.slice(0, SEASONAL_ITEM_LIMIT);
            
            if (limitedItems.length === 0) return false;
            
            // Check if cardBuilder is available
            if (typeof window.cardBuilder === 'undefined' || !window.cardBuilder.renderCards) {
                WARN("cardBuilder not available, skipping Thriller Movies section");
                return false;
            }
            
            // Render the scrollable container
            const scrollableContainer = window.cardBuilder.renderCards(
                limitedItems,
                'Thriller Movies',
                halloweenViewMoreUrls.thriller,
                true
            );
            
            scrollableContainer.setAttribute('data-custom-section-id', 'thriller-movies');
            scrollableContainer.setAttribute('data-custom-section-name', 'Thriller Movies');
            scrollableContainer.style.order = 52;
            
            container.appendChild(scrollableContainer);
            return true;
            
        } catch (err) {
            ERR('Error rendering Thriller Movies section:', err);
            return false;
        }
    }


    /**
     * Renders all Halloween sections
     * @param {HTMLElement} container - Container to append sections to
     */
    async function renderAllHalloweenSections(container) {
        if (!isHalloweenPeriod()) {
            LOG('Not in Halloween period, skipping Halloween sections');
            return;
        }
        
        try {
            // Fetch Halloween data if not already loaded
            if (halloweenMovies.length === 0) {
                LOG('Fetching Halloween movie data...');
                const movieData = await fetchHalloweenMovieData();
                halloweenMovies = movieData.halloweenMovies;
                horrorMovies = movieData.horrorMovies;
                thrillerMovies = movieData.thrillerMovies;
                halloweenViewMoreUrls = movieData.viewMoreUrls;                
            }

            let sectionsToRender = [];

            if (halloweenMovies.length > 0) {
                if (!container.querySelector('[data-custom-section-id="halloween-movies"]')) {
                    sectionsToRender.push(renderHalloweenMoviesSection(container));
                }
                if (!container.querySelector('[data-custom-section-id="horror-movies"]')) {
                    sectionsToRender.push(renderHorrorMoviesSection(container));
                }
                if (!container.querySelector('[data-custom-section-id="thriller-movies"]')) {
                    sectionsToRender.push(renderThrillerMoviesSection(container));
                }
            }

            if (sectionsToRender.length === 0) {
                LOG('No Halloween sections to render, skipping...');
                return;
            }
            
            const results = await Promise.all(sectionsToRender);
            
            const successCount = results.filter(Boolean).length;
            LOG(`Rendered ${successCount}/${results.length} Halloween sections`);
            return successCount === results.length;
            
        } catch (err) {
            ERR('Error rendering Halloween sections:', err);
        }
    }

    /**
     * Renders all Christmas sections (stub for future implementation)
     * @param {HTMLElement} container - Container to append sections to
     */
    async function renderAllChristmasSections(container) {
        if (!isChristmasPeriod()) {
            LOG('Not in Christmas period, skipping Christmas sections');
            return;
        }
        
        // TODO: Implement Christmas sections
        LOG('Christmas sections not yet implemented');
    }

    /**
     * Renders all New Years sections (stub for future implementation)
     * @param {HTMLElement} container - Container to append sections to
     */
    async function renderAllNewYearsSections(container) {
        if (!isNewYearsPeriod()) {
            LOG('Not in New Years period, skipping New Years sections');
            return;
        }
        
        // TODO: Implement New Years sections
        LOG('New Years sections not yet implemented');
    }

    /**
     * Renders all Valentine's Day sections (stub for future implementation)
     * @param {HTMLElement} container - Container to append sections to
     */
    async function renderAllValentinesSections(container) {
        if (!isValentinesPeriod()) {
            LOG('Not in Valentine\'s Day period, skipping Valentine\'s Day sections');
            return;
        }
        
        // TODO: Implement Valentine's Day sections
        LOG('Valentine\'s Day sections not yet implemented');
    }

    /**
     * Checks if current date is within a seasonal period
     * @param {string} startDate - Start date in MM-DD format
     * @param {string} endDate - End date in MM-DD format
     * @returns {boolean} - True if within period
     */
    function isInSeasonalPeriod(startDate, endDate) {
        const now = new Date();
        const currentMonth = now.getMonth() + 1; // 1-12
        const currentDay = now.getDate();
        
        const [startMonth, startDay] = startDate.split('-').map(Number);
        const [endMonth, endDay] = endDate.split('-').map(Number);
        
        const currentDateNum = currentMonth * 100 + currentDay;
        const startDateNum = startMonth * 100 + startDay;
        const endDateNum = endMonth * 100 + endDay;
        
        if (startDateNum <= endDateNum) {
            // Normal range (e.g., 10-01 to 10-31)
            return currentDateNum >= startDateNum && currentDateNum <= endDateNum;
        } else {
            // Wraps around year (e.g., 12-01 to 01-31)
            return currentDateNum >= startDateNum || currentDateNum <= endDateNum;
        }
    }

    /**
     * Renders a seasonal section based on config
     * @param {Object} seasonConfig - Season configuration
     * @param {HTMLElement} container - Container to append section to
     * @returns {Promise<boolean>} - Success status
     */
    /**
     * Renders a single section (used by both seasonal and custom sections)
     * @param {Object} sectionConfig - Section configuration
     * @param {HTMLElement} container - Container to append the section to
     * @param {string} sectionIdPrefix - Prefix for section ID
     * @returns {Promise<boolean>} - Success status
     */
    async function renderSection(sectionConfig, container, sectionIdPrefix) {
        try {
            if (!sectionConfig.enabled) {
                return false;
            }
            
            const sectionId = `${sectionIdPrefix}-${sectionConfig.id}`;
            if (container.querySelector(`[data-custom-section-id="${sectionId}"]`)) {
                return false;
            }
            
            // Get config values
            const itemLimit = sectionConfig.itemLimit ?? seasonalConfig?.defaultItemLimit ?? defaultItemLimit;
            const sortOrder = sectionConfig.sortOrder ?? seasonalConfig?.defaultSortOrder ?? defaultSortOrder;
            const sortOrderDirection = sectionConfig.sortOrderDirection ?? 'Ascending';
            const cardFormat = sectionConfig.cardFormat ?? seasonalConfig?.defaultCardFormat ?? defaultCardFormat;
            const order = sectionConfig.order ?? 100;
            
            const allItems = await loadItemsForSectionConfig(sectionConfig, itemLimit);
            if (!allItems || allItems.length === 0) {
                return false; // Auto-hide empty sections
            }
            
            // Apply sort order
            let sortedItems = allItems;
            if (sortOrder === 'Random') {
                sortedItems = [...allItems].sort(() => Math.random() - 0.5);
            } /* else if (window.cardBuilder && typeof window.cardBuilder.sortItems === 'function') {
                sortedItems = window.cardBuilder.sortItems(allItems, sortOrder, sortOrderDirection);
            } */
            
            // Apply limit
            const limited = sortedItems.slice(0, itemLimit);
            
            if (limited.length === 0) {
                return false; // Auto-hide empty sections
            }

            const type = sectionConfig.type;
            const source = sectionConfig.source;
            let viewMoreUrl = null;
            if (source && source !== '') {
                switch (type) {
                    case 'Genre':
                        viewMoreUrl = `#/list.html?genreId=${source}&serverId=${ApiClient.serverId()}`;
                        break;
                    case 'Studio':
                        viewMoreUrl = `#/list.html?studioId=${source}&serverId=${ApiClient.serverId()}`;
                        break;
                    case 'Playlist':
                    case 'BoxSet':
                        viewMoreUrl = `#/details?id=${source}&serverId=${ApiClient.serverId()}`;
                        break;
                    case 'Parent':
                        viewMoreUrl = `#/list.html?parentId=${source}&serverId=${ApiClient.serverId()}`;
                        break;
                    case 'Tag':
                        viewMoreUrl = `#/list.html?type=tag&tag=${source}&serverId=${ApiClient.serverId()}`;
                        break;
                    default:
                        viewMoreUrl = null;
                        break;
                }
            }

            let cardContainer = null;

            // Render Mode Logic
            const renderMode = sectionConfig.renderMode || (sectionConfig.spotlight ? 'Spotlight' : 'Normal');
            let useSpotlight = renderMode === 'Spotlight';
            
            if (renderMode === 'Random') {
                useSpotlight = Math.random() < 0.5;
            }

            if (useSpotlight) {
                if (!window.cardBuilder || !window.cardBuilder.renderSpotlightSection) {
                    WARN("cardBuilder.renderSpotlightSection not available");
                    return false;
                }

                // Use global spotlight config if available
                const homeScreenConfig = window.KefinTweaksConfig?.homeScreen || {};
                const spotlightConfig = homeScreenConfig.spotlight || {};

                cardContainer = window.cardBuilder.renderSpotlightSection(
                    limited,
                    sectionConfig.name,
                    {
                        autoPlay: spotlightConfig.autoPlay ?? true,
                        interval: spotlightConfig.interval ?? 5000,
                        showDots: spotlightConfig.showDots ?? true,
                        showNavButtons: spotlightConfig.showNavButtons ?? true,
                        showClearArt: spotlightConfig.showClearArt ?? true,
                        viewMoreUrl: viewMoreUrl
                    }
                );
            } else {            
                if (!window.cardBuilder || !window.cardBuilder.renderCards) {
                    WARN("cardBuilder.renderCards not available");
                    return false;
                }
                
                cardContainer = window.cardBuilder.renderCards(
                    limited,
                    sectionConfig.name,
                    viewMoreUrl,
                    true,
                    cardFormat,
                    sortOrder,
                    sortOrderDirection
                );
            }
            
            cardContainer.setAttribute('data-custom-section-id', sectionId);
            cardContainer.setAttribute('data-custom-section-name', sectionConfig.name);
            if (sectionConfig.type) {
                cardContainer.setAttribute('data-custom-section-type', sectionConfig.type);
            }
            cardContainer.style.order = order;
            
            container.appendChild(cardContainer);
            
            return true;
        } catch (err) {
            ERR(`Error rendering section ${sectionConfig.name}:`, err);
            return false;
        }
    }

    /**
     * Renders a seasonal section (which contains nested sections)
     * @param {Object} seasonConfig - Seasonal section configuration
     * @param {HTMLElement} container - Container to append sections to
     * @returns {Promise<boolean>} - Success status
     */
    async function renderSeasonalSection(seasonConfig, container) {
        try {
            if (!seasonConfig.enabled) {
                return false;
            }
            
            // Check if in seasonal period
            if (!isInSeasonalPeriod(seasonConfig.startDate, seasonConfig.endDate)) {
                return false;
            }
            
            // Render each nested section
            const sections = seasonConfig.sections || [];
            let anyRendered = false;
            
            for (const section of sections) {
                if (section.enabled) {
                    const rendered = await renderSection(section, container, `seasonal-${seasonConfig.id}`);
                    if (rendered) {
                        anyRendered = true;
                    }
                }
            }
            
            return anyRendered;
        } catch (err) {
            ERR(`Error rendering seasonal section ${seasonConfig.name}:`, err);
            return false;
        }
    }

    /**
     * Renders all seasonal sections based on current date and config
     * @param {HTMLElement} container - Container to append sections to
     */
    async function renderAllSeasonalSections(container) {
        const seasons = seasonalConfig.seasons || [];
        const sectionsToRender = [];
        
        // Render each configured season if it's in its period
        for (const season of seasons) {
            if (season.enabled && isInSeasonalPeriod(season.startDate, season.endDate)) {
                sectionsToRender.push(renderSeasonalSection(season, container));
            }
        }
        
        if (sectionsToRender.length === 0) {
            LOG('No seasonal periods active, skipping seasonal sections');
            return;
        }
        
        const results = await Promise.all(sectionsToRender);
        const successCount = results.filter(Boolean).length;
        LOG(`Rendered ${successCount}/${sectionsToRender.length} seasonal sections`);
    }

    /************ Home Screen Observer ************/

    /**
     * Checks if custom sections are already rendered and renders them if not
     */
    async function checkAndRenderCustomSections() {        
        // Try to find the home sections container with retry logic
        // Retry every 100ms for up to 3 seconds
        let homeSectionsContainer = null;
        const maxRetries = 100;
        let retries = 0;
        
        while (!homeSectionsContainer && retries < maxRetries) {
            homeSectionsContainer = document.querySelector('.libraryPage:not(.hide) .homeSectionsContainer');
            
            if (!homeSectionsContainer) {
                retries++;
                await new Promise(resolve => setTimeout(resolve, 100));
            }
        }
        
        if (!homeSectionsContainer) {
            LOG('Home sections container not found after 3 seconds');
            return;
        }

        // Check if already processing to prevent parallel execution
        if (isProcessing && homeSectionsContainer.dataset.customSectionsRendered === 'true') {
            LOG('Already processing, skipping...');
            return;
        }
        
        // Check if sections are already rendered
        if (homeSectionsContainer.dataset.customSectionsRendered === 'true') {
            return;
        }

        createDiscoveryLoadingIndicator();
        
        // Set processing flag to prevent parallel execution
        isProcessing = true;
        homeSectionsContainer.dataset.customSectionsRendered = 'true';
        
        try {
            LOG('Starting parallel initialization of home screen sections...');
            
            // Run all initialization functions in parallel for faster loading
            let initPromises = [];

            // Add people cache and preloading if discovery is enabled
            LOG('Checking Discovery section');
            if (enableDiscovery) {
                initPromises.push(initializePeopleCache());
                initPromises.push(preloadNextSections());
            }

            // Add Upcoming section (always rendered when enabled)
            LOG('Checking Upcoming section');
            if (enableUpcoming) {
                LOG('Rendering Upcoming section');
                initPromises.push(renderUpcomingSection(homeSectionsContainer));
            }

            // Add IMDb Top 250 section (always rendered when enabled)
            if (enableImdbTop250) {
                initPromises.push(renderImdbTop250Section(homeSectionsContainer));
            }

            // Add custom sections if enabled
            if (customHomeSections && customHomeSections.length > 0) {
                initPromises.push(renderAllCustomSections(homeSectionsContainer));
            }

            // Add Recently Added in Library sections
            if (recentlyAddedInLibraryConfig && Object.keys(recentlyAddedInLibraryConfig).length > 0) {
                initPromises.push(renderAllRecentlyAddedInLibrarySections(homeSectionsContainer));
            }

            // Add new and trending sections if enabled
            if (enableNewAndTrending) {
                initPromises.push(renderAllNewAndTrendingSections(homeSectionsContainer));
            }

            // Add seasonal sections if enabled
            if (enableSeasonal) {
                initPromises.push(renderAllSeasonalSections(homeSectionsContainer));
            }

            // Add watchlist section if enabled
            if (enableWatchlist) {
                initPromises.push(renderWatchlistSection(homeSectionsContainer));
            }

            // Add Watch Again section if enabled
            if (enableWatchAgain) {
                initPromises.push(renderWatchAgainSection(homeSectionsContainer));
            }
            
            // Add popular TV networks section if enabled
            if (popularTVNetworksConfig.enabled) {
                initPromises.push(renderPopularTVNetworksSection(homeSectionsContainer));
            }
            
            // Wait for all parallel operations to complete
            await Promise.all(initPromises);
            
            LOG('All custom sections rendered successfully');
        } catch (error) {
            ERR('Error rendering custom sections:', error);
        } finally {
            // Always reset the processing flag
            isProcessing = false;
        }
    }

    if (window.KefinTweaksUtils) {
        LOG('Registering home screen handler with KefinTweaksUtils');
        
        // Register handler for all pages (breadcrumbs can appear on any detail page)
        window.KefinTweaksUtils.onViewPage((view, element) => {
            try {
                // Run our custom code
                checkAndRenderCustomSections();
            } catch (err) {
                ERR('Home screen page change handler failed:', err);
            }
        }, {
            pages: ['home', 'home.html']
        });
    } else {
        ERR('KefinTweaksUtils not available, breadcrumbs may not work correctly');
    }

    checkAndRenderCustomSections();

    // Debug functions for troubleshooting (available in console)
    window.debugHomeScreen = function() {
        LOG('Manual debug trigger called');
        checkAndRenderCustomSections();
    };

    window.debugCustomSections = function() {
        LOG('Custom sections configuration:', customHomeSections);
        LOG('New and Trending configuration - enableNewAndTrending:', enableNewAndTrending, 'enableNewMovies:', enableNewMovies, 'enableNewEpisodes:', enableNewEpisodes, 'enableTrending:', enableTrending);
        LOG('Discovery configuration - enableWatchlist:', enableWatchlist, 'enableDiscovery:', enableDiscovery, 'enableSeasonal:', enableSeasonal);
        LOG('Seasonal configuration - seasonalItemLimit:', SEASONAL_ITEM_LIMIT);
        LOG('Processing flag status:', isProcessing);
        
        // Check multiple selectors
        const selectors = [
            '.libraryPage:not(.hide) .homeSectionsContainer',
            '.homeSectionsContainer',
            '.homeSectionsContainer:not(.hide)',
            '[class*="homeSections"]'
        ];
        
        selectors.forEach(selector => {
            const element = document.querySelector(selector);
            LOG(`Selector "${selector}":`, element ? 'FOUND' : 'NOT FOUND', element);
        });
        
        // Log all elements with "home" or "section" in class name
        const allElements = document.querySelectorAll('*');
        const relevantElements = Array.from(allElements).filter(el => 
            el.className && typeof el.className === 'string' && 
            (el.className.toLowerCase().includes('home') || el.className.toLowerCase().includes('section'))
        );
        
        LOG('Elements with "home" or "section" in class:', relevantElements.map(el => ({
            tagName: el.tagName,
            className: el.className,
            id: el.id
        })));
        
        // Check if cardBuilder is available
        LOG('cardBuilder available:', typeof window.cardBuilder !== 'undefined');
        LOG('renderCardsFromIds available:', typeof window.cardBuilder?.renderCardsFromIds === 'function');
        
        // Check if LocalStorageCache is available
        LOG('LocalStorageCache available:', typeof window.LocalStorageCache !== 'undefined');
        
        // Check discovery section data availability
        if (enableWatchlist) {
            const watchlistData = getWatchlistData();
            LOG('Watchlist data available:', watchlistData.length, 'items');
        }
        
        if (enableDiscovery) {
            const movieHistory = getMovieHistoryData();
            const seriesProgress = getSeriesProgressData();
            LOG('Movie history available:', movieHistory.length, 'items');
            LOG('Series progress available:', seriesProgress.length, 'items');
        }
    };


    // Debug function for seasonal sections
    window.debugSeasonalSections = function() {
        LOG('=== Seasonal Sections Debug ===');
        LOG('Configuration - enableSeasonal:', enableSeasonal, 'seasonalItemLimit:', SEASONAL_ITEM_LIMIT);
        
        LOG('Date checks:');
        LOG('- Halloween period:', isHalloweenPeriod());
        LOG('- Christmas period:', isChristmasPeriod());
        LOG('- New Years period:', isNewYearsPeriod());
        LOG('- Valentine\'s Day period:', isValentinesPeriod());
        
        if (enableSeasonal) {
            LOG('Halloween data:');
            LOG('- Halloween movies:', halloweenMovies.length);
            LOG('- Horror movies:', horrorMovies.length);
            LOG('- Thriller movies:', thrillerMovies.length);
            LOG('- Halloween people:', halloweenPeople.length);
            LOG('- ViewMore URLs:', halloweenViewMoreUrls);
            
            if (halloweenPeople.length > 0) {
                const directors = halloweenPeople.filter(p => p.directorCount >= 2);
                const actors = halloweenPeople.filter(p => p.actorCount >= 2);
                const writers = halloweenPeople.filter(p => p.writerCount >= 2);
                LOG('- Directors with 2+ movies:', directors.length);
                LOG('- Actors with 2+ movies:', actors.length);
                LOG('- Writers with 2+ movies:', writers.length);
            }
        }
    };

    // Debug function for movie genres cache
    window.debugMovieGenres = async function() {
        LOG('=== Movie Genres Cache Debug ===');
        
        const cache = new window.LocalStorageCache();
        const movieGenres = cache.get('movieGenres');
        
        if (movieGenres && movieGenres.length > 0) {
            LOG(`Cached genres: ${movieGenres.length}`);
            LOG('Sample genres:', movieGenres.slice(0, 5).map(g => ({ name: g.Name, id: g.Id })));
            
            // Test genre lookups
            const horrorId = await getGenreId('Horror');
            const thrillerId = await getGenreId('Thriller');
            LOG('Horror genre ID:', horrorId);
            LOG('Thriller genre ID:', thrillerId);
        } else {
            LOG('No genres in cache, fetching...');
            const genres = await fetchAndCacheMovieGenres();
            LOG(`Fetched and cached ${genres.length} genres`);
        }
        
        // Show cache age
        const cacheAge = cache.getCacheAge('movieGenres');
        if (cacheAge !== null) {
            LOG(`Cache age: ${cacheAge.toFixed(2)} hours`);
        }
    };

    // Debug function for discovery sections
    window.debugDiscoverySections = function() {
        LOG('=== Discovery Sections Debug ===');
        LOG('Configuration - enableDiscovery:', enableDiscovery);
        LOG('Configuration - enableInfiniteScroll:', enableInfiniteScroll);
        LOG('Configuration - minPeopleAppearances:', minPeopleAppearances);
        LOG('Configuration - minGenreMovieCount:', minGenreMovieCount);
        LOG('Movies top people loaded:', moviesTopPeople !== null);
        LOG('People cache complete:', isPeopleCacheComplete);
        LOG('Is initializing people cache:', isInitializingPeopleCache);
        LOG('Rendered sections count:', renderedSections.size);
        LOG('Rendered sections:', Array.from(renderedSections));
        LOG('Is generating discovery sections:', isGeneratingDiscoverySections);
        LOG('Preloaded sections count:', preloadedSections.length);
        LOG('Preloaded section elements count:', preloadedSectionElements.length);
        LOG('Is preloading sections:', isPreloadingSections);
        
        if (moviesTopPeople) {
            LOG('Top people data:');
            LOG('- Actors:', moviesTopPeople.actors.length);
            LOG('- Directors:', moviesTopPeople.directors.length);
            LOG('- Writers:', moviesTopPeople.writers.length);
            
            if (moviesTopPeople.actors.length > 0) {
                LOG('Sample actor:', moviesTopPeople.actors[0]);
            }
            if (moviesTopPeople.directors.length > 0) {
                LOG('Sample director:', moviesTopPeople.directors[0]);
            }
            if (moviesTopPeople.writers.length > 0) {
                LOG('Sample writer:', moviesTopPeople.writers[0]);
            }
        }
        
        // Test genre availability
        const cache = new window.LocalStorageCache();
        const movieGenres = cache.get('movieGenres');
        LOG('Available genres:', movieGenres ? movieGenres.length : 0);
        
        if (movieGenres && movieGenres.length > 0) {
            const genresWithEnoughMovies = movieGenres.filter(genre => 
                (genre.MovieCount || 0) >= minGenreMovieCount
            );
            LOG(`Genres with ${minGenreMovieCount}+ movies:`, genresWithEnoughMovies.length);
            
            if (genresWithEnoughMovies.length > 0) {
                LOG('Sample qualifying genres:', genresWithEnoughMovies.slice(0, 5).map(g => ({ 
                    name: g.Name, 
                    movieCount: g.MovieCount 
                })));
            }
        }
        
        // Test watchlist data
        const watchlistData = getWatchlistData();
        LOG('Watchlist data available:', watchlistData.length, 'items');
        
        // Test movie history
        const movieHistory = getMovieHistoryData();
        LOG('Movie history available:', movieHistory.length, 'items');
        
        // Test favorites
        fetchFavoriteItems('Movie').then(favorites => {
            LOG('Favorite movies available:', favorites.length, 'items');
        });
    };

    // Function to manually trigger discovery sections rendering from buffer
    window.generateDiscoverySections = async function() {
        LOG('Manually triggering discovery sections rendering from buffer...');
        const homeSectionsContainer = document.querySelector('.homeSectionsContainer');
        if (homeSectionsContainer) {
            const result = await renderNextDiscoveryGroup(homeSectionsContainer);
            LOG('Discovery sections rendering result:', result);
        } else {
            LOG('Home sections container not found');
        }
    };

    // Function to manually trigger preloading
    window.preloadDiscoverySections = async function() {
        LOG('Manually triggering discovery sections preloading...');
        await preloadNextSections();
        LOG('Preloading completed. Preloaded sections:', preloadedSections.length);
    };

    // Function to manually continue loading people data
    window.continueLoadingPeopleData = async function() {
        LOG('Manually continuing people data loading...');
        if (isInitializingPeopleCache) {
            LOG('People cache initialization already in progress');
            return;
        }
        
        isInitializingPeopleCache = true;
        try {
            const result = await fetchTopPeople();
            if (result) {
                moviesTopPeople = result;
                isPeopleCacheComplete = result.isComplete || false;
                LOG('People data loading result:', result.isComplete ? 'Complete' : 'Partial');
            }
        } finally {
            isInitializingPeopleCache = false;
        }
    };

    // Function to manually refresh movie genres cache
    window.refreshMovieGenres = async function() {
        LOG('Manually refreshing movie genres cache...');
        const cache = new window.LocalStorageCache();
        cache.clear('movieGenres');
        const genres = await fetchAndCacheMovieGenres();
        LOG(`Refreshed cache with ${genres.length} genres`);
        return genres;
    };

    // Function to manually unhide preloaded sections for testing
    window.unhidePreloadedSections = function() {
        LOG('Manually unhiding preloaded sections...');
        const hiddenSections = document.querySelectorAll('[data-preloaded="true"]');
        LOG(`Found ${hiddenSections.length} hidden preloaded sections`);
        
        let unhiddenCount = 0;
        hiddenSections.forEach(section => {
            section.style.display = '';
            section.removeAttribute('data-preloaded');
            unhiddenCount++;
        });
        
        LOG(`Unhid ${unhiddenCount} preloaded sections`);
        return unhiddenCount;
    };

    // Function to test new movies section
    window.testNewMovies = async function() {
        LOG('Testing New Movies section...');
        const movies = await fetchNewMovies();
        LOG(`Found ${movies.length} new movies:`, movies.map(m => ({ name: m.Name, premiereDate: m.PremiereDate })));
        return movies;
    };

    // Function to test new episodes section
    window.testNewEpisodes = async function() {
        LOG('Testing New Episodes section...');
        const episodes = await fetchNewEpisodes();
        LOG(`Found ${episodes.length} new episodes from last 7 days (after deduplication):`, episodes.map(e => ({ 
            name: e.Name, 
            series: e.SeriesName, 
            episode: `S${e.ParentIndexNumber?.toString().padStart(2,'0') ?? '--'}E${e.IndexNumber?.toString().padStart(2,'0') ?? '--'}`,
            premiereDate: e.PremiereDate 
        })));
        
        // Group by series to show deduplication effect
        const seriesGroups = {};
        episodes.forEach(episode => {
            const series = episode.SeriesName || 'Unknown';
            if (!seriesGroups[series]) {
                seriesGroups[series] = [];
            }
            seriesGroups[series].push(episode);
        });
        
        LOG('Episodes grouped by series:', Object.keys(seriesGroups).map(series => ({
            series: series,
            episodeCount: seriesGroups[series].length,
            episodes: seriesGroups[series].map(e => `S${e.ParentIndexNumber?.toString().padStart(2,'0') ?? '--'}E${e.IndexNumber?.toString().padStart(2,'0') ?? '--'}`)
        })));
        
        return episodes;
    };

    // Function to test deduplication logic with sample data
    window.testDeduplication = function() {
        LOG('Testing episode deduplication logic...');
        
        // Create sample episodes for testing
        const sampleEpisodes = [
            { Name: 'Episode 1', SeriesName: 'Test Series A', PremiereDate: '2024-01-15', IndexNumber: 1, ParentIndexNumber: 1 },
            { Name: 'Episode 2', SeriesName: 'Test Series A', PremiereDate: '2024-01-15', IndexNumber: 2, ParentIndexNumber: 1 },
            { Name: 'Episode 3', SeriesName: 'Test Series A', PremiereDate: '2024-01-15', IndexNumber: 3, ParentIndexNumber: 1 },
            { Name: 'Episode 1', SeriesName: 'Test Series B', PremiereDate: '2024-01-16', IndexNumber: 1, ParentIndexNumber: 1 },
            { Name: 'Episode 1', SeriesName: 'Test Series A', PremiereDate: '2024-01-17', IndexNumber: 1, ParentIndexNumber: 2 },
            { Name: 'Episode 2', SeriesName: 'Test Series A', PremiereDate: '2024-01-17', IndexNumber: 2, ParentIndexNumber: 2 }
        ];
        
        LOG('Original episodes:', sampleEpisodes.map(e => ({ 
            series: e.SeriesName, 
            episode: `S${e.ParentIndexNumber}E${e.IndexNumber}`, 
            date: e.PremiereDate 
        })));
        
        const deduplicated = deduplicateEpisodesBySeriesAndDate(sampleEpisodes);
        
        LOG('After deduplication:', deduplicated.map(e => ({ 
            series: e.SeriesName, 
            episode: `S${e.ParentIndexNumber}E${e.IndexNumber}`, 
            date: e.PremiereDate 
        })));
        
        LOG(`Deduplication result: ${sampleEpisodes.length} episodes → ${deduplicated.length} episodes`);
        
        return deduplicated;
    };

    window.discoveryBuffer = function() {
        return discoveryBuffer;
    };

    LOG('Home screen functionality initialized');
})();
