// KefinTweaks HomeScreen Configuration Migration
// Migrates legacy KefinTweaksConfig.homeScreen to new KefinTweaksConfig.homeScreenConfig format
(function() {
    'use strict';

    const LOG = (...args) => console.log('[KefinTweaks HomeScreen Migration]', ...args);
    const WARN = (...args) => console.warn('[KefinTweaks HomeScreen Migration]', ...args);
    const ERR = (...args) => console.error('[KefinTweaks HomeScreen Migration]', ...args);

    /**
     * Check if migration is needed and perform migration
     * @returns {Promise<boolean>} True if migration was performed, false otherwise
     */
    async function migrateHomeScreenConfig() {
        // Check if migration is needed
        if (!window.KefinTweaksConfig) {
            LOG('KefinTweaksConfig not found, skipping migration');
            return false;
        }

        // If homeScreenConfig already exists, skip migration
        if (window.KefinTweaksConfig.homeScreenConfig) {
            LOG('homeScreenConfig already exists, skipping migration');
            return false;
        }

        // If homeScreen doesn't exist, nothing to migrate
        if (!window.KefinTweaksConfig.homeScreen) {
            LOG('No legacy homeScreen config found, skipping migration');
            return false;
        }

        // Check if KefinHomeConfig2 defaults are available
        if (!window.KefinHomeConfig2) {
            WARN('KefinHomeConfig2 defaults not available, cannot perform migration');
            return false;
        }

        LOG('Starting migration from legacy homeScreen to homeScreenConfig...');

        try {
            const legacyHomeScreen = window.KefinTweaksConfig.homeScreen;
            const defaults = window.KefinHomeConfig2;

            // Initialize new config structure with defaults
            const newHomeScreenConfig = {
                HOME_SECTION_GROUPS: JSON.parse(JSON.stringify(defaults.HOME_SECTION_GROUPS || [])),
                SEASONAL_SECTION_GROUPS: JSON.parse(JSON.stringify(defaults.SEASONAL_SECTION_GROUPS || [])),
                DISCOVERY_SECTION_GROUPS: JSON.parse(JSON.stringify(defaults.DISCOVERY_SECTION_GROUPS || [])),
                CUSTOM_SECTION_GROUPS: [],
                REMOVE_CONFLICTING_SECTIONS: legacyHomeScreen.removeConflictingSections !== false,
                MERGE_NEXT_UP: false,
                DISCOVERY_SETTINGS: JSON.parse(JSON.stringify(defaults.DISCOVERY_SETTINGS || {})),
                SEASONAL_THEME_SETTINGS: JSON.parse(JSON.stringify(defaults.SEASONAL_THEME_SETTINGS || {}))
            };

            // Migrate discovery settings
            migrateDiscoverySettings(legacyHomeScreen, newHomeScreenConfig);

            // Migrate seasonal theme settings
            migrateSeasonalThemeSettings(legacyHomeScreen, newHomeScreenConfig);

            // Migrate HOME sections
            migrateHomeSections(legacyHomeScreen, newHomeScreenConfig);

            // Migrate SEASONAL sections
            migrateSeasonalSections(legacyHomeScreen, newHomeScreenConfig);

            // Migrate DISCOVERY sections
            migrateDiscoverySections(legacyHomeScreen, newHomeScreenConfig);

            // Migrate CUSTOM sections
            migrateCustomSections(legacyHomeScreen, newHomeScreenConfig);

            // Save migrated config to JS Injector plugin
            window.KefinTweaksConfig.homeScreenConfig = newHomeScreenConfig;
            if (window.KefinTweaksUtils && window.KefinTweaksUtils.saveConfigToJavaScriptInjector) {
                window.KefinTweaksUtils.saveConfigToJavaScriptInjector().catch(err => {
                    ERR('Failed to save migrated config to JS Injector:', err);
                });
            } else {
                WARN('KefinTweaksUtils.saveConfigToJavaScriptInjector not available, config migration not persisted');
            }
            LOG('Migration completed successfully');
        } catch (error) {
            ERR('Migration failed:', error);
        } finally {
            return newHomeScreenConfig;
        }
    }

    /**
     * Migrate discovery settings
     */
    function migrateDiscoverySettings(legacyHomeScreen, newConfig) {
        if (!legacyHomeScreen.discovery) return;

        const discovery = legacyHomeScreen.discovery;
        const settings = newConfig.DISCOVERY_SETTINGS;

        LOG('Migrating discovery settings...');

        if (discovery.enabled !== undefined) settings.enabled = discovery.enabled;
        if (discovery.infiniteScroll !== undefined) settings.infiniteScroll = discovery.infiniteScroll;
        if (discovery.minPeopleAppearances !== undefined) settings.minPeopleAppearances = discovery.minPeopleAppearances;
        if (discovery.minGenreMovieCount !== undefined) settings.minGenreMovieCount = discovery.minGenreMovieCount;
        if (discovery.defaultItemLimit !== undefined) settings.defaultItemLimit = discovery.defaultItemLimit;
        if (discovery.defaultSortOrder !== undefined) settings.defaultSortOrder = discovery.defaultSortOrder;
        if (discovery.defaultCardFormat !== undefined) settings.defaultCardFormat = discovery.defaultCardFormat;
        if (discovery.spotlightDiscoveryChance !== undefined) settings.spotlightDiscoveryChance = discovery.spotlightDiscoveryChance;
        if (discovery.renderSpotlightAboveMatching !== undefined) settings.renderSpotlightAboveMatching = discovery.renderSpotlightAboveMatching;
        if (discovery.randomizeOrder !== undefined) settings.randomizeOrder = discovery.randomizeOrder;
        if (discovery.spotlight && typeof discovery.spotlight === 'object') {
            Object.assign(settings.spotlight, discovery.spotlight);
        }
    }

    /**
     * Migrate seasonal theme settings
     */
    function migrateSeasonalThemeSettings(legacyHomeScreen, newConfig) {
        if (!legacyHomeScreen.seasonal) return;

        const seasonal = legacyHomeScreen.seasonal;
        const settings = newConfig.SEASONAL_THEME_SETTINGS;

        LOG('Migrating seasonal theme settings...');

        if (seasonal.enabled !== undefined) settings.enabled = seasonal.enabled;
        if (seasonal.enableSeasonalAnimations !== undefined) settings.enableSeasonalAnimations = seasonal.enableSeasonalAnimations;
        if (seasonal.enableSeasonalBackground !== undefined) settings.enableSeasonalBackground = seasonal.enableSeasonalBackground;
    }

    /**
     * Find section in default groups by ID
     */
    function findSectionInDefaults(sectionId, groups) {
        for (const group of groups) {
            if (group.sections) {
                const section = group.sections.find(s => s.id === sectionId);
                if (section) {
                    return { section, group, sectionIndex: group.sections.indexOf(section) };
                }
            }
        }
        return null;
    }

    /**
     * Find seasonal section using matching algorithm
     */
    function findSeasonalSectionByMatch(legacySection, seasonGroup, seasonId) {
        if (!seasonGroup || !seasonGroup.sections) return null;

        const sections = seasonGroup.sections;

        // Try exact ID match (for descriptive IDs like halloween-tag)
        if (legacySection.id && !legacySection.id.startsWith('seasonal-')) {
            const exactMatch = sections.find(s => {
                const expectedId = `seasonal.${seasonId}.${legacySection.id}`;
                return s.id === expectedId || s.id.endsWith(`.${legacySection.id}`);
            });
            if (exactMatch) {
                LOG(`  Matched section by exact ID: ${legacySection.id} → ${exactMatch.id}`);
                return exactMatch;
            }
        }

        // Try name match
        if (legacySection.name) {
            const nameMatch = sections.find(s => s.name === legacySection.name);
            if (nameMatch) {
                LOG(`  Matched section by name: "${legacySection.name}" → ${nameMatch.id}`);
                return nameMatch;
            }
        }

        // Try type + source pattern match
        if (legacySection.type && legacySection.source !== undefined) {
            const typeSourceMatch = sections.find(s => {
                if (!s.queries || !s.queries[0] || !s.queries[0].queryOptions) return false;
                const queryOptions = s.queries[0].queryOptions;
                
                if (legacySection.type === 'Tag' && queryOptions.Tags === legacySection.source) return true;
                if (legacySection.type === 'Genre' && (queryOptions.Genres === legacySection.source || queryOptions.GenreIds === legacySection.source)) return true;
                if (legacySection.type === 'Parent' && queryOptions.ParentId === legacySection.source) return true;
                return false;
            });
            if (typeSourceMatch) {
                LOG(`  Matched section by type+source: ${legacySection.type}/${legacySection.source} → ${typeSourceMatch.id}`);
                return typeSourceMatch;
            }
        }

        return null;
    }

    /**
     * Find discovery section by ID
     */
    function findDiscoverySectionById(sectionId, groups) {
        for (const group of groups) {
            if (group.sections) {
                const section = group.sections.find(s => s.id === sectionId);
                if (section) {
                    return { section, group, sectionIndex: group.sections.indexOf(section) };
                }
            }
        }
        return null;
    }

    /**
     * Merge legacy section config into default section
     */
    function mergeSectionConfig(defaultSection, legacyConfig) {
        const merged = JSON.parse(JSON.stringify(defaultSection));

        // Map root fields
        if (legacyConfig.enabled !== undefined) merged.enabled = legacyConfig.enabled;
        if (legacyConfig.name !== undefined) merged.name = legacyConfig.name;
        if (legacyConfig.order !== undefined) merged.order = legacyConfig.order;
        if (legacyConfig.cardFormat !== undefined) merged.cardFormat = legacyConfig.cardFormat;
        if (legacyConfig.startDate !== undefined) merged.startDate = legacyConfig.startDate;
        if (legacyConfig.endDate !== undefined) merged.endDate = legacyConfig.endDate;
        if (legacyConfig.discoveryEnabled !== undefined) merged.discoveryEnabled = legacyConfig.discoveryEnabled;
        
        // RenderMode mapping: only use spotlight if renderMode doesn't exist
        if (legacyConfig.renderMode !== undefined) {
            merged.renderMode = legacyConfig.renderMode;
        } else if (legacyConfig.spotlight === true) {
            merged.renderMode = 'Spotlight';
        }
        
        if (legacyConfig.spotlightConfig !== undefined) merged.spotlightConfig = legacyConfig.spotlightConfig;
        if (legacyConfig.overflowCard !== undefined) merged.overflowCard = legacyConfig.overflowCard;
        if (legacyConfig.minimumShowsForNetwork !== undefined) merged.minimumShowsForNetwork = legacyConfig.minimumShowsForNetwork;
        if (legacyConfig.flattenSeries !== undefined) merged.flattenSeries = legacyConfig.flattenSeries;
        if (legacyConfig.viewMoreUrl !== undefined) merged.viewMoreUrl = legacyConfig.viewMoreUrl;

        // Map query options fields
        if (merged.queries && merged.queries.length > 0) {
            const query = merged.queries[0];
            if (!query.queryOptions) query.queryOptions = {};

            if (legacyConfig.itemLimit !== undefined) query.queryOptions.Limit = legacyConfig.itemLimit;
            if (legacyConfig.sortOrder !== undefined) query.queryOptions.SortBy = legacyConfig.sortOrder;
            if (legacyConfig.sortOrderDirection !== undefined) query.queryOptions.SortOrder = legacyConfig.sortOrderDirection;
            if (legacyConfig.searchTerm !== undefined && legacyConfig.searchTerm) query.queryOptions.SearchTerm = legacyConfig.searchTerm;
            if (legacyConfig.includeItemTypes !== undefined) {
                query.queryOptions.IncludeItemTypes = Array.isArray(legacyConfig.includeItemTypes)
                    ? legacyConfig.includeItemTypes
                    : legacyConfig.includeItemTypes.split(',').map(s => s.trim()).filter(Boolean);
            }
            if (legacyConfig.isPlayed !== undefined && legacyConfig.isPlayed !== null) {
                query.queryOptions.IsUnplayed = legacyConfig.isPlayed === false;
            }
            if (legacyConfig.minAgeInDays !== undefined && legacyConfig.minAgeInDays !== null) {
                query.minAge = legacyConfig.minAgeInDays;
            }
            if (legacyConfig.maxAgeInDays !== undefined && legacyConfig.maxAgeInDays !== null) {
                query.maxAge = legacyConfig.maxAgeInDays;
            }

            // Merge additionalQueryOptions
            if (legacyConfig.additionalQueryOptions && Array.isArray(legacyConfig.additionalQueryOptions)) {
                legacyConfig.additionalQueryOptions.forEach(opt => {
                    if (opt && opt.key && opt.value !== undefined) {
                        query.queryOptions[opt.key] = opt.value;
                    }
                });
            }
        }

        return merged;
    }

    /**
     * Convert legacy Type/source to queries array
     */
    function convertLegacyTypeToQuery(type, source, legacySection) {
        const query = {
            queryOptions: {}
        };

        // Build base queryOptions from legacy section fields
        if (legacySection.itemLimit !== undefined) query.queryOptions.Limit = legacySection.itemLimit;
        if (legacySection.sortOrder !== undefined) query.queryOptions.SortBy = legacySection.sortOrder;
        if (legacySection.sortOrderDirection !== undefined) query.queryOptions.SortOrder = legacySection.sortOrderDirection;
        if (legacySection.searchTerm !== undefined && legacySection.searchTerm) query.queryOptions.SearchTerm = legacySection.searchTerm;
        if (legacySection.includeItemTypes !== undefined) {
            query.queryOptions.IncludeItemTypes = Array.isArray(legacySection.includeItemTypes)
                ? legacySection.includeItemTypes
                : legacySection.includeItemTypes.split(',').map(s => s.trim()).filter(Boolean);
        }
        if (legacySection.isPlayed !== undefined && legacySection.isPlayed !== null) {
            query.queryOptions.IsUnplayed = legacySection.isPlayed === false;
        }
        if (legacySection.minAgeInDays !== undefined && legacySection.minAgeInDays !== null) {
            query.minAge = legacySection.minAgeInDays;
        }
        if (legacySection.maxAgeInDays !== undefined && legacySection.maxAgeInDays !== null) {
            query.maxAge = legacySection.maxAgeInDays;
        }

        // Convert Type/source to queryOptions
        if (type === 'Playlist' || type === 'Collection' || type === 'Parent') {
            if (source && source.trim()) {
                query.queryOptions.ParentId = source.trim();
            }
        } else if (type === 'Genre') {
            const genreSource = source ? source.trim() : '';
            if (genreSource) {
                // Check if it's a 32-char hex ID
                if (/^[a-f0-9]{32}$/i.test(genreSource)) {
                    query.queryOptions.GenreIds = genreSource;
                } else {
                    // Comma-separated genre names
                    query.queryOptions.Genres = genreSource;
                }
            }
        } else if (type === 'Tag') {
            if (source && source.trim()) {
                query.queryOptions.Tags = source.trim();
            }
        }

        // Merge additionalQueryOptions
        if (legacySection.additionalQueryOptions && Array.isArray(legacySection.additionalQueryOptions)) {
            legacySection.additionalQueryOptions.forEach(opt => {
                if (opt && opt.key && opt.value !== undefined) {
                    query.queryOptions[opt.key] = opt.value;
                }
            });
        }

        return query;
    }

    /**
     * Migrate HOME sections
     */
    function migrateHomeSections(legacyHomeScreen, newConfig) {
        LOG('Migrating HOME sections...');

        // Migrate recentlyReleased.movies
        if (legacyHomeScreen.recentlyReleased?.movies) {
            const found = findSectionInDefaults('recentlyReleased.movies', newConfig.HOME_SECTION_GROUPS);
            if (found) {
                const moviesConfig = legacyHomeScreen.recentlyReleased.movies;
                const parentEnabled = legacyHomeScreen.recentlyReleased.enabled !== false;
                const merged = mergeSectionConfig(found.section, {
                    ...moviesConfig,
                    enabled: moviesConfig.enabled !== undefined ? moviesConfig.enabled : parentEnabled
                });
                Object.assign(found.section, merged);
                LOG('  Migrated recentlyReleased.movies');
            }
        }

        // Migrate recentlyReleased.episodes
        if (legacyHomeScreen.recentlyReleased?.episodes) {
            const found = findSectionInDefaults('recentlyReleased.episodes', newConfig.HOME_SECTION_GROUPS);
            if (found) {
                const episodesConfig = legacyHomeScreen.recentlyReleased.episodes;
                const parentEnabled = legacyHomeScreen.recentlyReleased.enabled !== false;
                const merged = mergeSectionConfig(found.section, {
                    ...episodesConfig,
                    enabled: episodesConfig.enabled !== undefined ? episodesConfig.enabled : parentEnabled
                });
                Object.assign(found.section, merged);
                LOG('  Migrated recentlyReleased.episodes');
            }
        }

        // Migrate recentlyAddedInLibrary
        if (legacyHomeScreen.recentlyAddedInLibrary && typeof legacyHomeScreen.recentlyAddedInLibrary === 'object') {
            const libraryConfigs = legacyHomeScreen.recentlyAddedInLibrary;
            let recentlyAddedGroup = newConfig.HOME_SECTION_GROUPS.find(g => g.name === 'Recently Added' || g.id === 'home-recently-added');
            
            if (!recentlyAddedGroup) {
                recentlyAddedGroup = {
                    id: 'home-recently-added',
                    name: 'Recently Added',
                    sections: []
                };
                newConfig.HOME_SECTION_GROUPS.push(recentlyAddedGroup);
            }

            Object.entries(libraryConfigs).forEach(([libraryId, libConfig]) => {
                const sectionId = `recently-added-${libraryId}`;
                let includeItemTypes = ['Movie', 'Episode'];

                if (libConfig.includeItemTypes) {
                    includeItemTypes = Array.isArray(libConfig.includeItemTypes)
                        ? libConfig.includeItemTypes
                        : libConfig.includeItemTypes.split(',').map(s => s.trim()).filter(Boolean);
                }

                const newSection = {
                    id: sectionId,
                    name: libConfig.name || `Recently Added Media`,
                    enabled: libConfig.enabled !== false,
                    order: libConfig.order || 61,
                    cardFormat: libConfig.cardFormat || 'Poster',
                    queries: [{
                        path: '/Items/Latest',
                        queryOptions: {
                            ParentId: libraryId,
                            IncludeItemTypes: includeItemTypes,
                            SortBy: 'DateCreated',
                            SortOrder: 'Descending',
                            Limit: libConfig.itemLimit || 16
                        }
                    }]
                };

                recentlyAddedGroup.sections.push(newSection);
                LOG(`  Migrated recentlyAddedInLibrary[${libraryId}]`);
            });
        }

        // Migrate other home sections
        const sectionMappings = {
            watchAgain: 'watchAgain',
            watchlist: 'watchlist',
            upcoming: 'upcoming',
            imdbTop250: 'imdbTop250',
            popularTVNetworks: 'popularTVNetworks'
        };

        Object.entries(sectionMappings).forEach(([legacyKey, sectionId]) => {
            if (legacyHomeScreen[legacyKey]) {
                const found = findSectionInDefaults(sectionId, newConfig.HOME_SECTION_GROUPS);
                if (found) {
                    const merged = mergeSectionConfig(found.section, legacyHomeScreen[legacyKey]);
                    Object.assign(found.section, merged);
                    LOG(`  Migrated ${legacyKey}`);
                }
            }
        });
    }

    /**
     * Migrate SEASONAL sections
     */
    function migrateSeasonalSections(legacyHomeScreen, newConfig) {
        if (!legacyHomeScreen.seasonal?.seasons || !Array.isArray(legacyHomeScreen.seasonal.seasons)) {
            return;
        }

        LOG('Migrating SEASONAL sections...');

        legacyHomeScreen.seasonal.seasons.forEach(legacySeason => {
            const seasonId = legacySeason.id || legacySeason.name?.toLowerCase().replace(/\s+/g, '-');
            if (!seasonId) {
                WARN('  Skipping season without id or name');
                return;
            }

            // Find matching seasonal group
            const seasonalGroup = newConfig.SEASONAL_SECTION_GROUPS.find(g => {
                const groupId = g.id || g.name?.toLowerCase().replace(/\s+/g, '-');
                return groupId === `seasonal-${seasonId}` || groupId === seasonId;
            });

            if (!seasonalGroup) {
                WARN(`  No matching seasonal group found for season: ${seasonId}`);
                return;
            }

            LOG(`  Processing season: ${seasonId}`);

            if (legacySeason.sections && Array.isArray(legacySeason.sections)) {
                legacySeason.sections.forEach(legacySection => {
                    // Try to find matching section
                    const matchedSection = findSeasonalSectionByMatch(legacySection, seasonalGroup, seasonId);

                    if (matchedSection) {
                        // Merge legacy config into matched section
                        const merged = mergeSectionConfig(matchedSection, {
                            ...legacySection,
                            startDate: legacySeason.startDate || matchedSection.startDate,
                            endDate: legacySeason.endDate || matchedSection.endDate
                        });
                        Object.assign(matchedSection, merged);
                        LOG(`    Migrated section: ${legacySection.id || legacySection.name} → ${matchedSection.id}`);
                    } else {
                        LOG(`Converting generic section to custom: ${legacySection.id}`);
                        convertSeasonalSectionToCustom(legacySection, legacySeason, newConfig);
                    }
                });
            }
        });
    }

    /**
     * Convert seasonal section with generic ID to custom section
     */
    function convertSeasonalSectionToCustom(legacySection, legacySeason, newConfig) {
        const query = convertLegacyTypeToQuery(legacySection.type, legacySection.source, legacySection);

        const customSection = {
            id: `custom-${Date.now()}-${Math.random()}`,
            name: legacySection.name || 'Custom Section',
            enabled: legacySection.enabled !== false,
            order: legacySection.order,
            cardFormat: legacySection.cardFormat || 'Poster',
            queries: [query]
        };

        // Map _parentItemType based on type
        if (legacySection.type === 'Playlist') {
            customSection._parentItemType = 'Playlist';
        } else if (legacySection.type === 'Collection') {
            customSection._parentItemType = 'Collection';
        } else if (legacySection.type === 'Parent') {
            customSection._parentItemType = 'Generic Parent';
        }
        // Tag and Genre don't need _parentItemType

        // Map additional fields
        if (legacySection.renderMode !== undefined) {
            customSection.renderMode = legacySection.renderMode;
        } else if (legacySection.spotlight === true) {
            customSection.renderMode = 'Spotlight';
        }
        if (legacySection.discoveryEnabled !== undefined) customSection.discoveryEnabled = legacySection.discoveryEnabled;
        if (legacySection.spotlightConfig !== undefined) customSection.spotlightConfig = legacySection.spotlightConfig;
        if (legacySection.overflowCard !== undefined) customSection.overflowCard = legacySection.overflowCard;

        const startDate = legacySection.startDate || legacySeason.startDate;
        const endDate = legacySection.endDate || legacySeason.endDate;
        if (startDate !== undefined) customSection.startDate = startDate;
        if (endDate !== undefined) customSection.endDate = endDate;

        // Add to custom sections group
        let customGroup = newConfig.CUSTOM_SECTION_GROUPS.find(g => g.name === 'Custom Sections' || g.id === 'custom-sections');
        if (!customGroup) {
            customGroup = {
                id: 'custom-sections',
                name: 'Custom Sections',
                sections: []
            };
            newConfig.CUSTOM_SECTION_GROUPS.push(customGroup);
        }

        customGroup.sections.push(customSection);
        LOG(`      Added as custom section: ${customSection.id}`);
    }

    /**
     * Migrate DISCOVERY sections
     */
    function migrateDiscoverySections(legacyHomeScreen, newConfig) {
        if (!legacyHomeScreen.discovery?.sectionTypes) {
            return;
        }

        LOG('Migrating DISCOVERY sections...');

        const discoverySectionTypes = legacyHomeScreen.discovery.sectionTypes;
        Object.entries(discoverySectionTypes).forEach(([sectionKey, legacySectionConfig]) => {
            // Use the key as the section ID
            const found = findDiscoverySectionById(sectionKey, newConfig.DISCOVERY_SECTION_GROUPS);

            if (found) {
                // Discovery sections still use legacy format, so we map fields directly
                if (legacySectionConfig.enabled !== undefined) found.section.enabled = legacySectionConfig.enabled;
                if (legacySectionConfig.name !== undefined) found.section.name = legacySectionConfig.name;
                if (legacySectionConfig.itemLimit !== undefined) found.section.itemLimit = legacySectionConfig.itemLimit;
                if (legacySectionConfig.cardFormat !== undefined) found.section.cardFormat = legacySectionConfig.cardFormat;
                if (legacySectionConfig.isPlayed !== undefined && legacySectionConfig.isPlayed !== null) {
                    found.section.isPlayed = legacySectionConfig.isPlayed;
                }
                if (legacySectionConfig.minimumItems !== undefined) found.section.minimumItems = legacySectionConfig.minimumItems;
                if (legacySectionConfig.sortOrder !== undefined) found.section.sortOrder = legacySectionConfig.sortOrder;
                if (legacySectionConfig.sortOrderDirection !== undefined) found.section.sortOrderDirection = legacySectionConfig.sortOrderDirection;

                LOG(`  Migrated discovery section: ${sectionKey}`);
            } else {
                WARN(`  Discovery section not found in defaults: ${sectionKey}`);
            }
        });
    }

    /**
     * Migrate CUSTOM sections
     */
    function migrateCustomSections(legacyHomeScreen, newConfig) {
        if (!legacyHomeScreen.customSections || !Array.isArray(legacyHomeScreen.customSections)) {
            return;
        }

        LOG('Migrating CUSTOM sections...');

        let customGroup = newConfig.CUSTOM_SECTION_GROUPS.find(g => g.name === 'Custom Sections' || g.id === 'custom-sections');
        if (!customGroup) {
            customGroup = {
                id: 'custom-sections',
                name: 'Custom Sections',
                sections: []
            };
            newConfig.CUSTOM_SECTION_GROUPS.push(customGroup);
        }

        legacyHomeScreen.customSections.forEach(legacySection => {
            const query = convertLegacyTypeToQuery(legacySection.type, legacySection.source, legacySection);

            const customSection = {
                id: `custom-${Date.now()}-${Math.random()}`,
                name: legacySection.name || 'Custom Section',
                enabled: legacySection.enabled !== false,
                order: legacySection.order,
                cardFormat: legacySection.cardFormat || 'Poster',
                queries: [query]
            };

            // Map _parentItemType based on type
            if (legacySection.type === 'Playlist') {
                customSection._parentItemType = 'Playlist';
            } else if (legacySection.type === 'Collection') {
                customSection._parentItemType = 'Collection';
            } else if (legacySection.type === 'Parent') {
                customSection._parentItemType = 'Generic Parent';
            }
            // Tag and Genre don't need _parentItemType

            // Map additional fields
            if (legacySection.renderMode !== undefined) {
                customSection.renderMode = legacySection.renderMode;
            } else if (legacySection.spotlight === true) {
                customSection.renderMode = 'Spotlight';
            }
            if (legacySection.discoveryEnabled !== undefined) customSection.discoveryEnabled = legacySection.discoveryEnabled;
            if (legacySection.spotlightConfig !== undefined) customSection.spotlightConfig = legacySection.spotlightConfig;
            if (legacySection.overflowCard !== undefined) customSection.overflowCard = legacySection.overflowCard;

            customGroup.sections.push(customSection);
            LOG(`  Migrated custom section: ${customSection.id}`);
        });
    }

    // Expose migration function
    window.migrateHomeScreenConfig = migrateHomeScreenConfig;

    LOG('HomeScreen migration module loaded');

})();
