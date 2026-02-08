// KefinTweaks Home Screen v3 (Config-Driven & Streamlined)
(function() {
    'use strict';

    const LOG = (...args) => console.log('[KefinTweaks HomeScreen3]', ...args);
    const WARN = (...args) => console.warn('[KefinTweaks HomeScreen3]', ...args);
    const ERR = (...args) => console.error('[KefinTweaks HomeScreen3]', ...args);

    // Configuration
    const PRE_FETCH_DISCOVERY_DATA = false; // If true, fetches first discovery group immediately. If false, waits for scroll/click.

    // Dependencies
    const ApiHelper = window.apiHelper;
    const Config = window.KefinHomeConfig2; // Updated to use Config2
    const PeopleCache = window.PeopleCache;
    const StudiosCache = window.StudiosCache;

    if (!Config) {
        ERR('Configuration not found! Ensure homeScreenConfig2.js is loaded.');
        return;
    }

    /**
     * Flatten section groups into a flat array of sections
     * @param {Array} groups - Array of HomeScreenSectionGroup objects
     * @returns {Array} Flat array of all sections
     */
    function flattenSectionGroups(groups) {
        if (!Array.isArray(groups)) return [];
        const flattened = [];
        groups.forEach(group => {
            if (group && Array.isArray(group.sections)) {
                flattened.push(...group.sections);
            }
        });
        return flattened;
    }

    // State
    const state = {
        renderedSections: new Set(),
        renderedDiscoveryIds: {
            genres: new Set(),
            networks: new Set(),
            collections: new Set(),
            studios: new Set(),
            people: new Set(),
            actors: new Set(),
            directors: new Set(),
            writers: new Set(),
            watchedMovies: new Set(),
            likedMovies: new Set(),
            customDiscoverySections: new Set()
        },
        currentDiscoveryGenre: null,
        currentDiscoveryStudio: null,
        cachedFavorites: null,
        isPeopleCacheComplete: false,
        discoveryGroupIndex: 0,
        isRenderingDiscovery: false,
        discoveryEnabled: true,
        discoveryBufferPromise: null,
        discoveryBuffer: [],
        discoverySectionOrder: 1000,
        discoverySectionsRemain: true,
        ensuringDiscoveryBuffer: false,
        infiniteScrollHandler: null,
        userDisplayPreferences: null,
        firstDiscoveryBuffer: null,
        getDisplayPrefernces: fetchDisplayPreferences,
        kefinNextUp: false,
        kefinContinueWatching: false,
        kefinLatestMedia: false,
        jellyfinOrders: {}
    };

    const performanceTimer = {
        loadTimeStart: null,
        loadTimeEnd: null,
    };

    // Cache used to support re-rendering our sections after Jellyfin overwrites the container
    const sectionCache = {
        renderedSections: [],      // Array of section configs + results
        fragmentCache: null,       // Reserved for future use if we cache DOM fragments
        isInitialRender: true,     // Track if this is first render for the current view
        jellyfinHasRendered: false, // Track if Jellyfin has rendered native home sections
        pendingJellyfinSectionObservers: []
    };

    // Basic performance metrics for measuring initial and recovery renders
    const performanceMetrics = {
        initialRenderStart: null,
        initialRenderEnd: null,
        jellyfinDetected: null,
        recoveryRenderEnd: null
    };

    // Create loading indicator element
    function createDiscoveryLoadingIndicator(container) {
        let loadingDiv = document.querySelector('.homePage:not(.hide) #discovery-loading-indicator');
        if (loadingDiv) {
            return loadingDiv;
        }

        // Prefer the provided container, but fall back to the standard sections container
        if (!container) {
            container = document.querySelector('.homePage:not(.hide) #homeTab .sections');
        }

        if (!container) {
            WARN('Discovery loading indicator: sections container not found');
            return null;
        }

        loadingDiv = document.createElement('div');
        loadingDiv.className = 'discovery-loading-indicator';
        loadingDiv.id = 'discovery-loading-indicator';
        loadingDiv.style.order = '99999';
        loadingDiv.innerHTML = `
            <div class="spinner"></div>
        `;

        container.appendChild(loadingDiv);
        LOG('Created discovery loading indicator inside sections container');
        
        return loadingDiv;
    }

    // Legacy helper kept for compatibility – no longer used in the main flow
    async function waitForHomeSectionsContainer() {

        const maxAttempts = 50;
        let attempts = 0;
        let homeSectionsContainer = null;
        while (attempts < maxAttempts && !homeSectionsContainer) {
            homeSectionsContainer = document.querySelector('.homePage:not(.hide) #homeTab .homeSectionsContainer');
            if (homeSectionsContainer) {
                break;
            }
            attempts++;
            await new Promise(resolve => setTimeout(resolve, 50));
        }

        if (!homeSectionsContainer) {
            LOG('Home sections container not found');
            return false;
        }

        return homeSectionsContainer;
    }

    // Observe the home sections container so we can react when Jellyfin renders
    function observeContainerMutations(container, onJellyfinRender) {
        if (!container || typeof MutationObserver === 'undefined') {
            return null;
        }

        const observer = new MutationObserver((mutations) => {
            for (const mutation of mutations) {
                // Check if .homeSectionsContainer class was added
                if (mutation.type === 'attributes' &&
                    mutation.attributeName === 'class' &&
                    container.classList.contains('homeSectionsContainer')) {

                    LOG('Jellyfin rendered homeSectionsContainer, re-rendering custom sections');
                    sectionCache.jellyfinHasRendered = true;
                    performanceMetrics.jellyfinDetected = performance.now();
                    observer.disconnect();
                    if (typeof onJellyfinRender === 'function') {
                        onJellyfinRender();
                    }
                    break;
                }

                // Check for childList changes (innerHTML overwrite before class is applied)
                if (mutation.type === 'childList' &&
                    !sectionCache.jellyfinHasRendered) {

                    const hasKefinSections = Array.from(container.children)
                        .some(el => el.dataset && el.dataset.sectionId);

                    if (!hasKefinSections && sectionCache.renderedSections.length > 0) {
                        LOG('Home sections container content cleared; awaiting Jellyfin homeSectionsContainer class.');
                        // We intentionally keep observing for the class change.
                    }
                }
            }
        });

        observer.observe(container, {
            childList: true,
            attributes: true,
            attributeFilter: ['class']
        });

        return observer;
    }

    /**
     * Get section index N from a .sectionN element (e.g. section0 -> 0).
     * Returns -1 if no matching class.
     */
    function getSectionIndexFromElement(sectionEl) {
        const sectionClass = Array.from(sectionEl.classList || []).find(c => /^section\d+$/.test(c));
        if (!sectionClass) return -1;
        const match = sectionClass.match(/^section(\d+)$/);
        return match ? parseInt(match[1], 10) : -1;
    }

    /**
     * True when the section is ready to clone: either there are no .itemsContainer descendants,
     * or every .itemsContainer in the section has at least one child (items have been rendered).
     */
    function sectionHasAllItemsContainersPopulated(sectionEl) {
        const itemsContainers = sectionEl.querySelectorAll ? sectionEl.querySelectorAll('.itemsContainer') : [];
        if (itemsContainers.length === 0) return false;
        return Array.from(itemsContainers).every(container => container.children.length > 0);
    }

    /**
     * Observe a Jellyfin section node until every .itemsContainer in it has children, then clone and append to kefinHome once.
     * Observer is stored in sectionCache.pendingJellyfinSectionObservers so handleJellyfinRender can disconnect it on re-run.
     */
    function observeSectionUntilChildrenThenClone(sectionEl, kefinHome) {
        if (!sectionEl || typeof MutationObserver === 'undefined') return;
        const observer = new MutationObserver(() => {
            if (!sectionHasAllItemsContainersPopulated(sectionEl)) return;
            const target = document.querySelector('.homePage:not(.hide) #homeTab .kefinHomeSectionsContainer');
            if (!target) {
                observer.disconnect();
                const idx = sectionCache.pendingJellyfinSectionObservers.indexOf(observer);
                if (idx !== -1) sectionCache.pendingJellyfinSectionObservers.splice(idx, 1);
                return;
            }
            const clone = sectionEl.cloneNode(true);
            clone.dataset.jellyfinSectionClone = 'true';
            target.appendChild(clone);
            observer.disconnect();
            const idx = sectionCache.pendingJellyfinSectionObservers.indexOf(observer);
            if (idx !== -1) sectionCache.pendingJellyfinSectionObservers.splice(idx, 1);
        });
        sectionCache.pendingJellyfinSectionObservers.push(observer);
        observer.observe(sectionEl, { childList: true, subtree: true });
    }

    async function manageBodyClasses() {
        
        const homeScreenConfig = await window.KefinHomeScreen.getConfig();
        const seasonalSectionGroups = homeScreenConfig.SEASONAL_SECTION_GROUPS || [];
        const seasonalConfig = homeScreenConfig.SEASONAL_THEME_SETTINGS || {};
        const enableSeasonalAnimations = seasonalConfig.enableSeasonalAnimations !== false;
        const enableSeasonalBackground = seasonalConfig.enableSeasonalBackground !== false;
        const seasonalThemes = seasonalConfig.seasonalThemes || {};

        if (!enableSeasonalBackground && !enableSeasonalAnimations) {
            LOG('Seasonal background and animations are disabled');
            return;
        }

        const body = document.body;
        const currentView = window.KefinTweaksUtils?.getCurrentView ? window.KefinTweaksUtils.getCurrentView() : null;
        const isHomePage = currentView === 'home' || currentView === 'home.html' || window.location.href.includes('home.html');

        // Get the active Seasonal groups by checking if any section in the group is enabled and where the current date falls within the StartDate and EndDate of the section
        const activeSeasonalGroups = seasonalSectionGroups.filter(sectionGroup => {
            return sectionGroup.sections.some(s => s.enabled && isInSeasonalPeriod(s.startDate, s.endDate));
        });
        
        if (activeSeasonalGroups.length === 0) {
            LOG('No active seasonal groups found');
            return;
        }

        let activeSeasonalThemeGroup;
        if (enableSeasonalBackground && enableSeasonalAnimations) {
            activeSeasonalThemeGroup = activeSeasonalGroups.find(sectionGroup => {
                const theme = seasonalThemes[sectionGroup.id] || {};
                return theme.backgroundImage && theme.animation;
            });
        } else {
            activeSeasonalThemeGroup = activeSeasonalGroups.find(sectionGroup => {
                const theme = seasonalThemes[sectionGroup.id] || {};
                return (enableSeasonalBackground && theme.backgroundImage)
                    || (enableSeasonalAnimations && theme.animation);
            });
        }

        if (!activeSeasonalThemeGroup) {
            LOG('No seasonal theme found');
            return;
        }
        
        document.body.dataset.seasonalTheme = activeSeasonalThemeGroup.id;

        if (enableSeasonalBackground && !document.body.dataset.seasonalBackground) {
            document.body.dataset.seasonalBackground = 'true';

            // Add the background image as a css variable to the body
            const backgroundImage = seasonalThemes[activeSeasonalThemeGroup.id]?.backgroundImage;
            if (backgroundImage) {
                document.body.style.setProperty('--seasonal-background-image', backgroundImage);
            }
        }

        if (enableSeasonalAnimations && !document.body.dataset.seasonalAnimations) {
            document.body.dataset.seasonalAnimations = 'true';

            // Add the animation script to the head
            const animation = seasonalThemes[activeSeasonalThemeGroup.id]?.animation;
            if (animation) {
                const animationScript = document.querySelector(`script[src*="${animation}.js"]`);
                if (!animationScript) {
                    const animationScriptSrc = (window.KefinTweaksConfig.kefinTweaksRoot || '') + `scripts/seasonal/${animation}.js`;
                    const script = document.createElement('script');
                    script.src = animationScriptSrc;
                    document.head.appendChild(script);
                }
            }
        }
    }

    async function handleUserDataChanged(event, nextupSectionConfig, continueWatchingSectionConfig, continueWatchingAndNextUpSectionConfig) {
        LOG('UserDataChanged event received:', event);
        const userData = event.Data?.UserDataList?.[0];
        const parentItemUserData = event.Data?.UserDataList?.[1];

        if (parentItemUserData.Key.includes('MusicAlbum')) {
            return;
        }

        if (userData?.ItemId) {
            LOG(`Detected UserDataChanged for item: ${userData.ItemId}, Played: ${userData.Played}`);
            
            // Invalidate cache for Next Up section
            if (nextupSectionConfig && nextupSectionConfig.enabled && nextupSectionConfig.queries) {
                for (const query of nextupSectionConfig.queries) {
                    if (query.path || !query.dataSource) {
                        const queryUrl = ApiHelper.buildQueryFromSection(query, ApiClient.getCurrentUserId(), ApiClient.serverAddress());
                        if (queryUrl && typeof queryUrl === 'string') {
                            ApiHelper.invalidateCache(queryUrl);
                        }
                    }
                }
            }

            // Invalidate cache for Continue Watching section
            if (continueWatchingSectionConfig && continueWatchingSectionConfig.enabled && continueWatchingSectionConfig.queries) {
                for (const query of continueWatchingSectionConfig.queries) {
                    if (query.path || !query.dataSource) {
                        const queryUrl = ApiHelper.buildQueryFromSection(query, ApiClient.getCurrentUserId(), ApiClient.serverAddress());
                        if (queryUrl && typeof queryUrl === 'string') {
                            ApiHelper.invalidateCache(queryUrl);
                        }
                    }
                }
            }

            // Invalidate cache for Continue Watching and Next Up section
            if (continueWatchingAndNextUpSectionConfig && continueWatchingAndNextUpSectionConfig.enabled && continueWatchingAndNextUpSectionConfig.queries) {
                for (const query of continueWatchingAndNextUpSectionConfig.queries) {
                    if (query.path || !query.dataSource) {
                        const queryUrl = ApiHelper.buildQueryFromSection(query, ApiClient.getCurrentUserId(), ApiClient.serverAddress());
                        if (queryUrl && typeof queryUrl === 'string') {
                            ApiHelper.invalidateCache(queryUrl);
                        }
                    }
                }
            }
        }
    }

    /**
     * Main Entry Point
     */
    async function enhanceHomeScreen() {
        LOG('Initializing Home Screen v3...');
        performanceTimer.loadTimeStart = performance.now();
        performanceMetrics.initialRenderStart = performance.now();

        // Reset cache/metrics for a new initialization cycle
        sectionCache.renderedSections = [];
        sectionCache.fragmentCache = null;
        sectionCache.isInitialRender = true;
        sectionCache.jellyfinHasRendered = false;
        performanceMetrics.initialRenderEnd = null;
        performanceMetrics.jellyfinDetected = null;
        performanceMetrics.recoveryRenderEnd = null;

        // Run migration if needed (check for legacy homeScreen config)
        if (window.migrateHomeScreenConfig) {
            await window.migrateHomeScreenConfig();
        }
        
        const container = document.querySelector('.homePage:not(.hide) #homeTab .sections');
        if (!container) {
            LOG('Home sections container not found');
            return;
        }

        // Create Kefin home sections container as a sibling of the Jellyfin sections container
        let kefinHomeSectionsContainer = document.querySelector('.homePage:not(.hide) #homeTab .kefinHomeSectionsContainer');
        if (!kefinHomeSectionsContainer) {
            kefinHomeSectionsContainer = document.createElement('div');
            kefinHomeSectionsContainer.className = 'sections homeSectionsContainer kefinHomeSectionsContainer';
            if (container.parentNode) {
                container.parentNode.insertBefore(kefinHomeSectionsContainer, container.nextSibling);
            } else {
                LOG('Sections container has no parent node; appending Kefin container to body as fallback');
                document.body.appendChild(kefinHomeSectionsContainer);
            }
        }

        // If we've already initialized and Jellyfin has completed its render, avoid re-running
        if (container.dataset.kefinHomeScreen || kefinHomeSectionsContainer.dataset.kefinHomeScreen) {
            LOG('Home screen already initialized and Jellyfin has rendered');
            return;
        }

        let performanceStartTime = performance.now();
        
        // Fetch display preferences
        //state.userDisplayPreferences = await fetchDisplayPreferences();
        
        let performanceEndTime = performance.now();
        let performanceDuration = performanceEndTime - performanceStartTime;
        LOG(`Home Screen v3 Fetch display preferences initialization time: ${performanceDuration.toFixed(2)}ms`);

        performanceStartTime = performance.now();
        
        // Merge configs - flatten groups first
        const defaultHomeSections = flattenSectionGroups(Config.HOME_SECTION_GROUPS || []);
        const mergedHomeSections = await mergeHomeSectionConfigs(defaultHomeSections);
        
        performanceEndTime = performance.now();
        performanceDuration = performanceEndTime - performanceStartTime;
        LOG(`Home Screen v3 Merge home section configs initialization time: ${performanceDuration.toFixed(2)}ms`);

        performanceStartTime = performance.now();


        const nextupSectionConfig = mergedHomeSections.find(s => s.id === 'nextUp');
        const continueWatchingSectionConfig = mergedHomeSections.find(s => s.id === 'continueWatching');
        const continueWatchingAndNextUpSectionConfig = mergedHomeSections.find(s => s.id === 'continueWatchingAndNextUp');
        const recentlyAddedSectionConfig = mergedHomeSections.find(s => s.id.startsWith('recently-added-') && s.enabled === true);
        state.kefinNextUp = nextupSectionConfig?.enabled === true;
        state.kefinContinueWatching = continueWatchingSectionConfig?.enabled === true;
        state.kefinLatestMedia = recentlyAddedSectionConfig?.enabled === true;

        // Setup event listener for UserDataChanged
        if (window.ApiClient && window.ApiClient.addEventListener) {
            window.ApiClient.addEventListener('userdatachanged', (event) => {
                handleUserDataChanged(event, nextupSectionConfig, continueWatchingSectionConfig, continueWatchingAndNextUpSectionConfig);
            });
        }

        performanceEndTime = performance.now();
        performanceDuration = performanceEndTime - performanceStartTime;
        LOG(`Home Screen v3 Setup event listener initialization time: ${performanceDuration.toFixed(2)}ms`);

        // Load user preferences and apply filtering/ordering
        performanceStartTime = performance.now();

        let userHomeScreenSections = await loadUserHomeScreenSections();

        let filteredHomeSections = mergedHomeSections.map(section => {
            const userSection = userHomeScreenSections.find(s => s.id === section.id);
            if (userSection) {
                section.enabled = userSection.enabled;
                section.order = userSection.order;
            }
            return section;
        });

        performanceEndTime = performance.now();
        performanceDuration = performanceEndTime - performanceStartTime;
        LOG(`Home Screen v3 Load user home screen sections initialization time: ${performanceDuration.toFixed(2)}ms`);

        // Set up mutation observer BEFORE rendering, so we can react when Jellyfin renders home sections
        const handleJellyfinRender = async () => {
            const jellyHome = document.querySelector('.homePage:not(.hide) #homeTab .homeSectionsContainer');
            const kefinHome = document.querySelector('.homePage:not(.hide) #homeTab .kefinHomeSectionsContainer');

            if (!jellyHome || !kefinHome) {
                LOG('Jellyfin render detected but required containers not found; skipping Jellyfin section mirroring');
                return;
            }

            // Disconnect any pending "wait for children" observers from a previous run
            sectionCache.pendingJellyfinSectionObservers.forEach(obs => { try { obs.disconnect(); } catch (_) {} });
            sectionCache.pendingJellyfinSectionObservers = [];

            // Remove any previously cloned Jellyfin sections from our container
            kefinHome.querySelectorAll('[data-jellyfin-section-clone="true"]').forEach(el => el.remove());

            // Copy Jellyfin .sectionN containers into the Kefin container (clone now if has children; else observe until children appear if in jellyfinOrders)
            const jellySections = jellyHome.querySelectorAll('.section0, .section1, .section2, .section3, .section4, .section5, .section6, .section7, .section8');

            jellySections.forEach(sectionEl => {
                const sectionIndex = getSectionIndexFromElement(sectionEl);
                const homesectionKey = sectionIndex >= 0 ? `homesection${sectionIndex}` : null;
                if (sectionHasAllItemsContainersPopulated(sectionEl)) {
                    const clone = sectionEl.cloneNode(true);
                    clone.dataset.jellyfinSectionClone = 'true';
                    kefinHome.appendChild(clone);
                } else if (homesectionKey && state.jellyfinOrders[homesectionKey] !== undefined) {
                    observeSectionUntilChildrenThenClone(sectionEl, kefinHome);
                }
            });

            performanceMetrics.recoveryRenderEnd = performance.now();
            if (performanceMetrics.jellyfinDetected) {
                LOG(`Home Screen v3 Jellyfin section mirroring duration: ${(performanceMetrics.recoveryRenderEnd - performanceMetrics.jellyfinDetected).toFixed(2)}ms`);
            }
        };

        let containerForRender = container;

        if (!container.classList.contains('homeSectionsContainer')) {
            const observer = observeContainerMutations(container, handleJellyfinRender);
            containerForRender = kefinHomeSectionsContainer;
        }

        // Set flag to indicate we've started initializing this container
        containerForRender.dataset.kefinHomeScreen = 'true';

        // Initial render directly into Kefin container (no waiting for Jellyfin)
        performanceStartTime = performance.now();
        LOG('Rendering Standard/Seasonal Sections (initial render)...');
        await renderHomeSections(filteredHomeSections, containerForRender, false);
        performanceEndTime = performance.now();
        performanceDuration = performanceEndTime - performanceStartTime;
        LOG(`Home Screen v3 Render home sections (initial) initialization time: ${performanceDuration.toFixed(2)}ms`);

        performanceMetrics.initialRenderEnd = performanceEndTime;

        performanceTimer.loadTimeEnd = performance.now();
        LOG(`Home Screen v3 load time initialization: ${(performanceTimer.loadTimeEnd - performanceTimer.loadTimeStart).toFixed(2)}ms`);
        
        LOG('Initializing Discovery Sections...');
        await setupDiscoveryInteraction(containerForRender);

        /* // If Jellyfin hasn't rendered after 5 seconds, assume it won't and clean up the observer
        setTimeout(() => {
            if (!sectionCache.jellyfinHasRendered && observer) {
                LOG('Jellyfin render timeout - assuming native sections disabled');
                sectionCache.jellyfinHasRendered = true;
                observer.disconnect();
            }
        }, 5000); */
    }

    function getHomeScreenConfig() {
        const userConfig = window.KefinTweaksConfig && window.KefinTweaksConfig.homeScreen;
        if (!userConfig) {
            return Config;
        }

        const defaultHomeSections = flattenSectionGroups(Config.HOME_SECTION_GROUPS || []);
        const homeSections = mergeHomeSectionConfigs(defaultHomeSections);
    }

    /**
     * Merges default Home Sections with Admin/User Config overrides
     * Now reads from all 4 groups: HOME, SEASONAL, DISCOVERY, CUSTOM
     */
    async function mergeHomeSectionConfigs(defaultSections) {
        const userConfig = window.KefinTweaksConfig && window.KefinTweaksConfig.homeScreen;
        const homeScreenConfig = window.KefinTweaksConfig && window.KefinTweaksConfig.homeScreenConfig;
        
        const merged = [];

        // Helper function to merge sections with user config overrides
        const mergeSectionWithUserConfig = (section) => {
            let userSectionConfig = null;

            if (section.id.includes('.')) {
                const parts = section.id.split('.');
                if (userConfig && userConfig[parts[0]] && userConfig[parts[0]][parts[1]]) {
                    userSectionConfig = userConfig[parts[0]][parts[1]];
                }
            } else if (userConfig) {
                userSectionConfig = userConfig[section.id];
            }

            if (userSectionConfig) {
                return {
                    ...section,
                    ...userSectionConfig,
                    id: section.id
                };
            }
            return section;
        };

        // Process HOME_SECTION_GROUPS (default + admin overrides)
        const defaultHome = flattenSectionGroups(Config.HOME_SECTION_GROUPS || []);
        const adminHome = homeScreenConfig ? flattenSectionGroups(homeScreenConfig.HOME_SECTION_GROUPS || []) : [];
        const defaultHomeIds = new Set(defaultHome.map(s => s.id));
        
        // Merge default home sections with user config
        defaultHome.forEach(section => {
            merged.push(mergeSectionWithUserConfig(section));
        });
        
        // Add admin overrides for home sections (including recently-added)
        adminHome.forEach(section => {
            const existingIndex = merged.findIndex(s => s.id === section.id);
            if (existingIndex !== -1) {
                // Update existing section
                merged[existingIndex] = { ...merged[existingIndex], ...section };
            } else if (!defaultHomeIds.has(section.id)) {
                // New section from admin config (e.g., recently-added)
                merged.push(section);
            }
        });

        // Process SEASONAL_SECTION_GROUPS (default + admin overrides)
        const defaultSeasonal = flattenSectionGroups(Config.SEASONAL_SECTION_GROUPS || []);
        const adminSeasonal = homeScreenConfig ? flattenSectionGroups(homeScreenConfig.SEASONAL_SECTION_GROUPS || []) : [];
        const defaultSeasonalIds = new Set(defaultSeasonal.map(s => s.id));
        
        // Merge default seasonal sections with user config
        defaultSeasonal.forEach(section => {
            merged.push(mergeSectionWithUserConfig(section));
        });
        
        // Add admin overrides for seasonal sections
        adminSeasonal.forEach(section => {
            const existingIndex = merged.findIndex(s => s.id === section.id);
            if (existingIndex !== -1) {
                // Update existing section
                merged[existingIndex] = { ...merged[existingIndex], ...section };
            } else if (!defaultSeasonalIds.has(section.id)) {
                // New seasonal section from admin config
                merged.push(section);
            }
        });

        // Process CUSTOM_SECTION_GROUPS (user-created/imported sections)
        const customSections = homeScreenConfig ? flattenSectionGroups(homeScreenConfig.CUSTOM_SECTION_GROUPS || []) : [];
        customSections.forEach(section => {
            if (section.discoveryEnabled === true) {
                // Skip if discovery is enabled, the section will be rendered in the discovery sections
                return;
            }
            if (!merged.find(s => s.id === section.id)) {
                merged.push(section);
            }
        });
        
        // Legacy support: Also check old recentlyAddedInLibrary location for backward compatibility
        if (isRecentlyAddedEnabled() && userConfig) {
            const libraryIds = Object.keys(userConfig.recentlyAddedInLibrary || {});
            const libraries = await window.dataHelper.getLibraries();
            
            libraryIds.forEach(libId => {
                const libConfig = userConfig.recentlyAddedInLibrary[libId];
                const sectionId = `recently-added-${libId}`;
                
                // Skip if already added from HOME_SECTION_GROUPS
                if (merged.find(s => s.id === sectionId)) {
                    return;
                }

                if (libConfig && libConfig.enabled !== false) {
                    const library = libraries.find(l => l.Id === libId);

                    if (!library) {
                        LOG(`Library not found: ${libId}`);
                        return;
                    }

                    if (library.CollectionType &&
                        library.CollectionType !== 'movies' && 
                        library.CollectionType !== 'tvshows' && 
                        library.CollectionType !== 'music' && 
                        library.CollectionType !== 'homevideos' &&
                        library.CollectionType !== 'musicvideos' &&
                        library.CollectionType !== 'musicvideos' &&
                        library.CollectionType !== 'books') {
                        LOG(`Skipping library: ${library.CollectionType}`);
                        return;
                    }

                    let viewMoreUrl = null;
                    if (library.CollectionType === 'movies') {
                        viewMoreUrl = `#/movies.html?topParentId=${libId}&collectionType=movies&tab=1`;
                    } else if (library.CollectionType === 'tvshows') {
                        viewMoreUrl = `#/tv.html?topParentId=${libId}&collectionType=tvshows&tab=1`;
                    }

                    // Convert to new format with queries array
                    const newSection = {
                        id: sectionId,
                        name: libConfig.name || 'Recently Added',
                        enabled: true,
                        order: libConfig.order || 61,
                        cardFormat: libConfig.cardFormat || 'Poster',
                        viewMoreUrl: viewMoreUrl,
                        queries: [{
                            path: `/Items/Latest`,
                            queryOptions: {
                                ParentId: libId,
                                SortBy: 'DateCreated',
                                SortOrder: 'Descending',
                                Limit: libConfig.itemLimit || 16
                            }
                        }]
                    }

                    merged.push(newSection);
                }
            });
        }

        // Handle MergeNextUp setting - check if continueWatchingAndNextUp should be enabled
        const mergeNextUp = getMergeNextUpSetting();
        if (mergeNextUp) {
            // Find and disable nextUp and continueWatching sections when merged
            const nextUpIndex = merged.findIndex(s => s.id === 'nextUp');
            const continueWatchingIndex = merged.findIndex(s => s.id === 'continueWatching');
            if (nextUpIndex !== -1) {
                merged[nextUpIndex].enabled = false;
            }
            if (continueWatchingIndex !== -1) {
                merged[continueWatchingIndex].enabled = false;
            }
            // Enable the merged section
            const mergedIndex = merged.findIndex(s => s.id === 'continueWatchingAndNextUp');
            if (mergedIndex !== -1) {
                merged[mergedIndex].enabled = true;
                LOG('MergeNextUp enabled: Using continueWatchingAndNextUp section');
            }
        } else {
            // Disable merged section if merge is not enabled
            const mergedIndex = merged.findIndex(s => s.id === 'continueWatchingAndNextUp');
            if (mergedIndex !== -1) {
                merged[mergedIndex].enabled = false;
            }
        }

        // Filter seasonal sections based on date
        const filteredMerged = merged.filter(section => {
            if (section.startDate && section.endDate) {
                if (section.enabled === false) {
                    LOG(`Skipping disabled seasonal section: ${section.id}`);
                    return false;
                }
                if (!isInSeasonalPeriod(section.startDate, section.endDate)) {
                    LOG(`Skipping seasonal section (out of date): ${section.id}`);
                    return false;
                }
            }
            return true;
        });
        
        // Legacy support: Also check old customSections location
        if (userConfig && userConfig.customSections) {
            Object.keys(userConfig.customSections).forEach(key => {
                if (!filteredMerged.find(s => s.id === key)) {
                    filteredMerged.push(userConfig.customSections[key]);
                }
            });
        }
        
        // Legacy support: Also check old seasonal location
        if (userConfig && userConfig.seasonal?.seasons) {
            const seasonalSections = userConfig.seasonal.seasons.flatMap(s => s.sections.map(section => ({
                ...section,
                startDate: s.startDate,
                endDate: s.endDate
            })));
            seasonalSections.forEach(section => {
                if (!filteredMerged.find(s => s.id === section.id)) {
                    if (section.enabled === false) {
                        LOG(`Skipping disabled seasonal section: ${section.id}`);
                        return;
                    }
                    if (section.startDate && section.endDate) {
                        if (!isInSeasonalPeriod(section.startDate, section.endDate)) {
                            LOG(`Skipping seasonal section (out of date): ${section.id}`);
                            return;
                        }
                    }
                    filteredMerged.push(section);
                }
            });
        }

        return filteredMerged;
    }

    function getDiscoverySections() {
        const settings = getDiscoverySettings();

        if (!settings || settings.enabled === false) {
            LOG('Discovery is disabled');
            return [];
        }

        const homeScreenConfig = window.KefinTweaksConfig && window.KefinTweaksConfig.homeScreenConfig;
        
        // Get default discovery sections
        const defaultDiscovery = flattenSectionGroups(Config.DISCOVERY_SECTION_GROUPS || []);
        
        // Get admin overrides for discovery sections
        const adminDiscoverySections = window.KefinTweaksConfig && window.KefinTweaksConfig.homeScreenConfig && window.KefinTweaksConfig.homeScreenConfig.DISCOVERY_SECTION_GROUPS && flattenSectionGroups(window.KefinTweaksConfig.homeScreenConfig.DISCOVERY_SECTION_GROUPS);
        const mappedSections = Object.keys(adminDiscoverySections || {}).map(key => ({
            id: key,
            ...adminDiscoverySections[key]
        }));

        // Merge default discovery sections with admin overrides
        const mergedSections = defaultDiscovery.map(section => {
            const mappedSection = mappedSections.find(s => s.id === section.id);
            if (mappedSection) {
                return { ...section, ...mappedSection, type: section.type };
            }
            return section;
        });

        // Get custom discovery sections from CUSTOM_SECTION_GROUPS
        // Filter for sections that have discovery-related properties (type, source: 'Dynamic', etc.)
        const customSections = homeScreenConfig ? flattenSectionGroups(homeScreenConfig.CUSTOM_SECTION_GROUPS || []) : [];
        const customDiscoverySections = customSections.filter(section => {
            return section.discoveryEnabled === true && section.enabled === true;
        });

        // Add one additional custom discovery section that hasn't been rendered yet
        if (customDiscoverySections.length > 0) {
            const availableSections = customDiscoverySections.filter(section => !state.renderedDiscoveryIds.customDiscoverySections.has(section.id));
            if (availableSections.length > 0) {
                const selectedSection = availableSections[Math.floor(Math.random() * availableSections.length)];
                if (selectedSection) {
                    mergedSections.push(selectedSection);
                    state.renderedDiscoveryIds.customDiscoverySections.add(selectedSection.id);
                }
            }
        }

        // Legacy support: Also check old customSections location
        const legacyCustomSections = window.KefinTweaksConfig?.homeScreen?.customSections || [];
        if (legacyCustomSections.length > 0) {
            legacyCustomSections.forEach(section => {
                if (section.enabled && section.discoveryEnabled) {
                    if (state.renderedDiscoveryIds.customDiscoverySections.has(section.id)) {
                        return;
                    }
                    mergedSections.push(section);
                    state.renderedDiscoveryIds.customDiscoverySections.add(section.id);
                }
            });
        }

        return mergedSections;
    }

    function getDiscoverySettings() {
        const userConfig = window.KefinTweaksConfig && window.KefinTweaksConfig.homeScreenConfig;
        if (!userConfig) {
            return Config.DISCOVERY_SETTINGS;
        }

        return {
            ...Config.DISCOVERY_SETTINGS,
            ...userConfig.DISCOVERY_SETTINGS
        };
    }

    /**
     * Load user home screen preferences
     */
    async function loadUserHomeScreenSections() {
        try {
            //if (!state.userDisplayPreferences) {
            //    state.userDisplayPreferences = await fetchDisplayPreferences();
            //}
            const userDisplayPreferences = await state.getDisplayPrefernces();

            const customPrefs = userDisplayPreferences?.CustomPrefs || {};
            const kefinHomeScreen = JSON.parse(customPrefs.kefinHomeScreen || '[]');

            // Create a homesectionN : order value mapping for the custom CSS orders to be applied
            const jellyfinOrders = {};
            for (let i = 0; i <= 8; i++) {
                const homeSection = customPrefs[`homesection${i}`];

                if (!homeSection) {
                    continue;
                }
                if (homeSection.toLowerCase() === 'nextup' && state.kefinNextUp) {
                    continue;
                }
                if (homeSection.toLowerCase() === 'resume' && state.kefinContinueWatching) {
                    continue;
                }
                if (homeSection.toLowerCase() === 'latestmedia' && state.kefinLatestMedia) {
                    continue;
                }

                // Match to homeSection in kefinHomeScreen with .toLowerCase() id
                let kefinHomeScreenSection = kefinHomeScreen.find(s => s.id.toLowerCase() === homeSection.toLowerCase());

                if (!kefinHomeScreenSection) {
                    // Check if it's "latestmedia"
                    if (homeSection.toLowerCase() === 'latestmedia' && !state.kefinLatestMedia) {
                        kefinHomeScreenSection = kefinHomeScreen.find(s => s.id.toLowerCase().startsWith('recently-added'));
                    }
                }

                if (kefinHomeScreenSection) {
                    jellyfinOrders[`homesection${i}`] = kefinHomeScreenSection.order;
                }
            }

            state.jellyfinOrders = jellyfinOrders;

            addUserHomeScreenOrderCSS(jellyfinOrders); 

            return kefinHomeScreen;
            
            /* if (!Array.isArray(kefinHomeScreen)) {
                return { enabledSectionIds: new Set(), orderMap: new Map(), jellyfinOrders: {} };
            }

            // Create set of enabled section IDs
            const enabledSectionIds = new Set(kefinHomeScreen.map(s => s['section-id']));
            
            // Create map of section-id -> order
            const orderMap = new Map();
            kefinHomeScreen.forEach(pref => {
                if (pref['section-id'] && pref.order !== undefined) {
                    orderMap.set(pref['section-id'], pref.order);
                }
            });

            // Get Jellyfin section orders (homesectionN -> order mapping)
            const jellyfinOrders = {};
            kefinHomeScreen.forEach(pref => {
                const sectionId = pref['section-id'];
                if (sectionId && sectionId.startsWith('homesection') && pref.order !== undefined) {
                    jellyfinOrders[sectionId] = pref.order;
                }
            });

            return { enabledSectionIds, orderMap, jellyfinOrders }; */
        } catch (error) {
            ERR('Error loading user home screen preferences:', error);
            return null;
        }
    }

    /**
     * Add CSS for user-defined section ordering
     */
    function addUserHomeScreenOrderCSS(jellyfinOrders) {        
        // Remove existing style tag if present
        const existingStyle = document.getElementById('kefin-user-homescreen-order-css');

        // Create new style tag
        const style = document.createElement('style');
        style.id = 'kefin-user-homescreen-order-css';
        
        let css = '';

        // Add CSS for Jellyfin sections
        Object.entries(jellyfinOrders).forEach(([homesectionKey, order]) => {
            // Map homesectionN to class selector
            const classSelector = `.${homesectionKey.replace('home','')}`;
            css += `${classSelector} { order: ${order} !important; }\n`;
        });

        // Add display: none to all .homeectionN not in jellyfinOrders
        for (let i = 0; i <= 8; i++) {
            const homesectionKey = `homesection${i}`;
            if (!jellyfinOrders[homesectionKey]) {
                const classSelector = `.${homesectionKey.replace('home','')}`;
                css += `${classSelector} { display: none !important; }\n`;
            }
        }

        style.textContent = css;
        if (existingStyle) {
            existingStyle.remove();
        }
        document.head.appendChild(style);
        
        LOG('User home screen order CSS applied');
    }

    /**
     * Filter sections based on user preferences
     */
    function filterSectionsByUserPreferences(sections, userPrefs) {
        const { enabledSectionIds } = userPrefs;
        
        // If no user preferences, return all sections
        if (enabledSectionIds.size === 0) {
            return sections;
        }

        // Filter out disabled sections (not in enabledSectionIds)
        return sections.filter(section => {
            const sectionId = section.id;
            return enabledSectionIds.has(sectionId);
        });
    }

    /**
     * Apply user-defined orders to sections
     */
    function applyUserSectionOrders(sections, userPrefs) {
        const { orderMap } = userPrefs;
        
        return sections.map(section => {
            const sectionId = section.id;
            const userOrder = orderMap.get(sectionId);
            
            if (userOrder !== undefined) {
                return {
                    ...section,
                    order: userOrder
                };
            }
            
            return section;
        });
    }

    async function renderHomeSections(sections, container, useCache = false) {
        if (!container) {
            WARN('renderHomeSections called without a valid container');
            return;
        }

        // Skip if we've already rendered into this container for this cycle and we're not explicitly re-using the cache
        if (container.dataset.sectionsRendered && !useCache) return;

        // Check if children with [data-section-id] are present
        const children = container.children;
        const hasSections = Array.from(children).some(child => child.dataset && child.dataset.sectionId);
        if (hasSections) {
            LOG('Sections already rendered, skipping');
            return;
        }

        container.dataset.sectionsRendered = 'true';

        const sectionsToRender = [];

        if (useCache && sectionCache.renderedSections.length > 0) {
            LOG('Re-rendering home sections from cache');
            sectionsToRender.push(...sectionCache.renderedSections);
        } else {
            const sortedSections = [...sections].sort((a, b) => (a.order || 99) - (b.order || 99));
            const sectionPromises = [];

            let performanceStartTime = performance.now();
            let performanceEndTime;
            let performanceDuration;

            const performanceTimes = [];
            for (const sectionConfig of sortedSections) {
                const loopStartTime = performance.now();
                if (sectionConfig.enabled === false) {
                    LOG(`Skipping disabled section: ${sectionConfig.id}`);
                    continue;
                }
                
                if (sectionConfig.startDate && sectionConfig.endDate) {
                    if (!isInSeasonalPeriod(sectionConfig.startDate, sectionConfig.endDate)) {
                        LOG(`Skipping seasonal section (out of date): ${sectionConfig.id}`);
                        continue;
                    }
                }

                const existingSection = container.querySelector(`[data-section-id="${sectionConfig.id}"]`);

                if (existingSection && !useCache) {
                    LOG(`Section already rendered: ${sectionConfig.id}`);
                    continue;
                }
                
                // Check merge setting for continueWatchingAndNextUp
                if (sectionConfig.id === 'continueWatchingAndNextUp' && !getMergeNextUpSetting()) {
                    LOG(`Skipping continueWatchingAndNextUp: merge not enabled`);
                    continue;
                }
                
                // Skip individual sections when merge is enabled
                if (getMergeNextUpSetting() && 
                    (sectionConfig.id === 'continueWatching' || sectionConfig.id === 'nextUp')) {
                    LOG(`Skipping ${sectionConfig.id}: merge enabled, using continueWatchingAndNextUp`);
                    continue;
                }
                
                sectionPromises.push(loadSectionForRendering(sectionConfig));

                const loopEndTime = performance.now();
                const loopDuration = loopEndTime - loopStartTime;
                performanceTimes.push(loopDuration);
                LOG(`Section ${sectionConfig.id} initialization time: ${loopDuration.toFixed(2)}ms`);
            }

            performanceEndTime = performance.now();
            performanceDuration = performanceEndTime - performanceStartTime;
            LOG(`Render home sections configs loaded initialization time: ${performanceDuration.toFixed(2)}ms`);

            LOG(`Total performance time: ${performanceTimes.reduce((a, b) => a + b, 0).toFixed(2)}ms`);

            performanceStartTime = performance.now();

            // Resolve all section promises
            let sectionResults = await Promise.all(sectionPromises);
            sectionResults = sectionResults.filter(result => result !== null);
            sectionsToRender.push(...sectionResults);

            performanceEndTime = performance.now();
            performanceDuration = performanceEndTime - performanceStartTime;
            LOG(`Home Screen v3 Resolve all section promises initialization time: ${performanceDuration.toFixed(2)}ms`);

            // Cache the rendered sections for potential re-render after Jellyfin overwrites the container
            sectionCache.renderedSections = sectionsToRender.slice();
        }

        const targetContainer = container;

        const renderStartTime = performance.now();
        await window.cardBuilder.renderProgressiveSections(targetContainer, sectionsToRender);
        const renderEndTime = performance.now();
        const renderDuration = renderEndTime - renderStartTime;
        LOG(`Home Screen v3 Render progressive sections initialization time: ${renderDuration.toFixed(2)}ms`);

        // Check if target container is homeSectionsContainer
        if (!targetContainer.classList.contains('homeSectionsContainer')) {
            targetContainer.dataset.sectionsPrerendered = 'true';
        }
    }

    function flattenSeriesEpisodes(items) {
        if (!items || items.length === 0) return items;

        // Keep only the first item in the array for any given series
        const seriesMap = new Map();
        items.forEach(item => {
            if (item.Type !== 'Episode') {
                return;
            }

            if (seriesMap.has(item.SeriesId)) {
                return;
            }

            seriesMap.set(item.SeriesId, item);
        });
        
        return Array.from(seriesMap.values());
    }

    function formatAirDate(premiereDate) {
        if (!premiereDate) return '';

        // Ignore timezone offset
        const date = new Date(premiereDate.replace('Z', ''));

        // Use format: Tues Jan 4
        const options = { weekday: 'short', month: 'short', day: 'numeric' };
        return date.toLocaleDateString('en-US', options);
    }

    function getMergeNextUpSetting() {
        const userConfig = window.KefinTweaksConfig?.homeScreen;
        const defaultConfig = Config?.MERGE_NEXT_UP;
        
        if (userConfig?.mergeNextUp !== undefined) {
            return userConfig.mergeNextUp;
        }
        return defaultConfig !== false;
    }

    let _displayPreferencesPromise = null;

    async function fetchDisplayPreferences() {
        try {
            const { promise, cached } = await window.userHelper.getUserDisplayPreferences();
            return await promise;
/*             if (state.userDisplayPreferences) {
                return state.userDisplayPreferences;
            }

            const { promise, cached } = await window.userHelper.getUserDisplayPreferences();
            state.userDisplayPreferences = cached;

            _displayPreferencesPromise = promise;

            _displayPreferencesPromise.then(data => {
                state.userDisplayPreferences = data;
            });

            return state.userDisplayPreferences; */
        } catch (e) {
            ERR('Failed to fetch display preferences:', e);
            return null;
        }
    }

    async function removeConflictingSection() {
        return; // Disabled - kept for compatibility
    }

    function isNextUpEnabled() {
        const userConfig = window.KefinTweaksConfig?.homeScreen;
        const homeSections = flattenSectionGroups(Config.HOME_SECTION_GROUPS || []);
        const defaultConfig = homeSections.find(s => s.id === 'nextUp');
        
        if (userConfig?.nextUp) {
            return userConfig.nextUp.enabled !== false;
        }
        return defaultConfig?.enabled !== false;
    }

    function isContinueWatchingEnabled() {
        const userConfig = window.KefinTweaksConfig?.homeScreen;
        const homeSections = flattenSectionGroups(Config.HOME_SECTION_GROUPS || []);
        const defaultConfig = homeSections.find(s => s.id === 'continueWatching');
        
        if (userConfig?.continueWatching) {
            return userConfig.continueWatching.enabled !== false;
        }
        return defaultConfig?.enabled !== false;
    }

    function isRecentlyAddedEnabled() {
        const userConfig = window.KefinTweaksConfig?.homeScreen;
        return userConfig?.recentlyAddedInLibrary && Object.keys(userConfig.recentlyAddedInLibrary).length > 0;
    }

    /**
     * DEPRECATED: Use ApiHelper.buildQueryFromSection() instead
     * Kept for backward compatibility
     */
    function buildQueryFromConfig(query, userId, serverUrl) {
        return ApiHelper.buildQueryFromSection(query, userId, serverUrl);
    }

    /**
     * DEPRECATED: Use ApiHelper.buildCustomEndpoint() instead
     * Kept for backward compatibility
     */
    function buildCustomEndpoint(path, queryOptions, userId) {
        return ApiHelper.buildCustomEndpoint(path, queryOptions, userId, ApiClient.serverAddress());
    }

    /**
     * Refactored: Load section for rendering using queries array
     */
    async function loadSectionForRendering(sectionConfig) {
        LOG(`Loading Section for Rendering: ${sectionConfig.id} (${sectionConfig.name})`);  

        const loadSectionTimerStart = performance.now();

        // Prepare section (template replacements, view more URL, etc.)
        const viewMoreUrl = await resolveViewMoreUrl(sectionConfig);
        const cardFormat = resolveCardFormat(sectionConfig);
        const sectionName = fillTemplate(sectionConfig.name, sectionConfig.metadata);
/*         const viewMoreUrl = '';
        const cardFormat = '';
        const sectionName = ''; */

        sectionConfig.overflowCard = true;
        
        if (viewMoreUrl) {
            sectionConfig.viewMoreUrl = viewMoreUrl;
        }
        if (cardFormat) {
            sectionConfig.cardFormat = cardFormat;
        }
        if (sectionName) {
            sectionConfig.name = sectionName;
        }

        // Check for forced image type preference
        let forcedImageType = null;
        if ((sectionConfig.id === 'nextUp' || sectionConfig.id === 'continueWatching' || sectionConfig.id === 'continueWatchingAndNextUp')) {
            const userDisplayPreferences = await state.getDisplayPrefernces();
            if (userDisplayPreferences && userDisplayPreferences.CustomPrefs && userDisplayPreferences.CustomPrefs.useEpisodeImagesInNextUpAndResume === 'true') {
                forcedImageType = 'Primary';
            }
        }

        if (forcedImageType) {
            sectionConfig.forcedImageType = forcedImageType;
        }

        // Check renderMode first (preferred), fallback to spotlight boolean for backward compatibility
        const shouldRenderSpotlight = sectionConfig.renderMode === 'Spotlight' || sectionConfig.renderMode === 'Random' || sectionConfig.spotlight === true;
        if (shouldRenderSpotlight) {
            const spotlightConfig = { ...Config.DISCOVERY_SETTINGS.spotlight, ...window.KefinTweaksConfig?.homeScreen?.spotlight };
            sectionConfig.spotlightConfig = {
                ...spotlightConfig
            };
            // Set renderMode if not already set (for backward compatibility)
            if (!sectionConfig.renderMode && sectionConfig.spotlight) {
                sectionConfig.renderMode = 'Spotlight';
            }
        }

        // Ensure queries array exists
        if (!sectionConfig.queries || !Array.isArray(sectionConfig.queries) || sectionConfig.queries.length === 0) {
            WARN(`Section ${sectionConfig.id} has no queries array`);
            return null;
        }

        const userId = ApiClient.getCurrentUserId();
        const serverUrl = ApiClient.serverAddress();
        const results = [];

        // Process each query in the queries array
        for (const query of sectionConfig.queries) {
            let queryResult;
            
            if (query.dataSource) {
                // Handle cache-based data sources
                queryResult = await ApiHelper.fetchFromDataSource(query.dataSource, query.queryOptions || {});
            } else {
                // Build and execute query
                const queryUrl = ApiHelper.buildQueryFromSection(query, userId, serverUrl);
                
                if (typeof queryUrl === 'string') {
                    // Standard query
                    let sectionTtl = Config.CACHE.DEFAULT_TTL;
                    if (Number(sectionConfig.ttl) >= 0) {
                        sectionTtl = Number(sectionConfig.ttl);
                    }

                    queryResult = await ApiHelper.getQuery(queryUrl, {
                        useCache: true,
                        ttl: sectionTtl
                    });
                } else {
                    WARN(`Invalid query URL for section ${sectionConfig.id}`);
                    continue;
                }
            }
            
            results.push(queryResult);
        }

        // If multiple queries, merge results using section-level sortBy/sortOrder
        if (results.length > 1) {
            const loadSectionTimerEnd = performance.now();
            const loadSectionDuration = loadSectionTimerEnd - loadSectionTimerStart;
            LOG(`Section ${sectionConfig.id} loaded for rendering in time: ${loadSectionDuration.toFixed(2)}ms`);
            return ApiHelper.mergeMultiQueryResults(results, sectionConfig);
        }

        const loadSectionTimerEnd = performance.now();
        const loadSectionDuration = loadSectionTimerEnd - loadSectionTimerStart;
        LOG(`Section ${sectionConfig.id} loaded for rendering in time: ${loadSectionDuration.toFixed(2)}ms`);
        
        // Single query result
        return {
            config: sectionConfig,
            queryUrl: null,
            result: {
                data: window.cardBuilder.postProcessItems(sectionConfig, results[0].data),
                dataPromise: results[0].dataPromise.then(data => window.cardBuilder.postProcessItems(sectionConfig, data)),
                isStalePromise: results[0].isStalePromise
            }
        };
    }

    function deduplicateItems(items) {
        const deduplicated = [];
        const ids = new Set();
        for (const item of items) {
            if (!item.ProviderIds) {
                deduplicated.push(item);
                continue;
            }

            if (item.ProviderIds.Imdb && ids.has(item.ProviderIds.Imdb)) continue;
            if (item.ProviderIds.Tmdb && ids.has(item.ProviderIds.Tmdb)) continue;
            if (item.ProviderIds.Tvdb && ids.has(item.ProviderIds.Tvdb)) continue;

            deduplicated.push(item);
            ids.add(item.ProviderIds.Imdb);
            ids.add(item.ProviderIds.Tmdb);
            ids.add(item.ProviderIds.Tvdb);
        }
        return deduplicated;
    }

    let _getWatchlistUrlPromise = null;

    async function getWatchlistUrl() {
        const watchlistTabIndex = localStorage.getItem(`kefinTweaks_watchlistTabIndex_${ApiClient.serverId()}`);

        if (watchlistTabIndex) {
            return `#/home.html?tab=${watchlistTabIndex}`;
        }

        LOG('Watchlist tab index not found in local storage');
        // Fetch the tab in the background so that next time it's available
        window.KefinTweaksUtils.getWatchlistTabIndex();
        return null;


        let homePageSuffix = '.html';
        if (window.ApiClient && window.ApiClient.serverInfo && window.ApiClient.serverInfo().Version?.split('.')[1] > 10) {
             homePageSuffix = '';
        }

        if (!window.KefinTweaksUtils || !window.KefinTweaksUtils.getWatchlistTabIndex) {
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

    /**
     * Updated: Resolve view more URL from queryOptions
     */
    async function resolveViewMoreUrl(sectionConfig) {
        if (sectionConfig.viewMoreUrl) return sectionConfig.viewMoreUrl;

        const { id } = sectionConfig;

        // Handle specific section IDs
        if (id === 'continueWatching') {
            return `#/tv.html?collectionType=tvshows&tab=1&serverId=${ApiClient.serverId()}`;
        }

        if (id === 'popularTVNetworks') {
            return `#/tv.html?collectionType=tvshows&tab=4&serverId=${ApiClient.serverId()}`;
        }
        
        if (id === 'upcoming' || id === 'recentlyReleased.episodes') {
             return `#/tv.html?collectionType=tvshows&tab=2&serverId=${ApiClient.serverId()}`;
        }

        if (id === 'nextUp') {
            return `#/list.html?type=nextup&serverId=${ApiClient.serverId()}`;
        }

        if (id === 'watchlist') {
            return await getWatchlistUrl();
        }

        if (id === 'watchAgain') {
            const watchlistUrl = await getWatchlistUrl();

            if (watchlistUrl) { 
                return `${watchlistUrl}&pageTab=history`;
            }
            return null;
        }

        // Infer from queries array
        if (sectionConfig.queries && sectionConfig.queries.length > 0) {
            const firstQuery = sectionConfig.queries[0];
            const queryOptions = firstQuery.queryOptions || {};
            const serverId = window.ApiClient ? window.ApiClient.serverId() : '';

            // Check for Tags
            if (queryOptions.Tags) {
                return `#/list.html?type=tag&tag=${encodeURIComponent(queryOptions.Tags)}&serverId=${serverId}`;
            }

            // Check for Genres
            if (queryOptions.Genres) {
                let genreId = queryOptions.Genres;
                if (typeof genreId === 'string' && !genreId.match(/^\d+$/)) {
                    const id = await ApiHelper.getGenreId(genreId);
                    if (id) {
                        genreId = id;
                    }
                }
                return `#/list.html?genreId=${genreId}&serverId=${serverId}`;
            }

            // Check for GenreIds
            if (queryOptions.GenreIds) {
                return `#/list.html?genreId=${queryOptions.GenreIds.join(',')}&serverId=${serverId}`;
            }

            // Check for PersonIds
            if (queryOptions.PersonIds) {
                return `#/details?id=${queryOptions.PersonIds.join(',')}&serverId=${serverId}`;
            }

            // Check for StudioIds
            if (queryOptions.StudioIds) {
                return `#/list.html?studioId=${queryOptions.StudioIds.join(',')}&serverId=${serverId}`;
            }

            // Check for Studios
/*             if (queryOptions.Studios) {
                return `#/list.html?studioId=${queryOptions.Studios}&serverId=${serverId}`;
            } */

            // Check for ParentId
            if (queryOptions.ParentId) {
                if (sectionConfig.type === 'Collection' || sectionConfig.type === 'Playlist') {
                    return `#/details?id=${queryOptions.ParentId}&serverId=${serverId}`;
                }

                return `#/list.html?parentId=${queryOptions.ParentId}&serverId=${serverId}`;
            }

            // Check for custom path
            if (firstQuery.path) {
                // Derive URL from path if possible
                if (firstQuery.path.includes('NextUp')) {
                    return `#/tv.html?collectionType=tvshows&tab=1`;
                }
                if (firstQuery.path.includes('Upcoming')) {
                    return `#/tv.html?collectionType=tvshows&tab=2`;
                }
                // If query path is Items/itemid/Similar then return the details page for the item
                if (firstQuery.path.includes('Similar')) {
                    const itemId = firstQuery.path.split('/')[2];
                    return `#/details?id=${itemId}&serverId=${serverId}`;
                }
            }
        }
        
        return null;
    }

    function postProcessItems(sectionConfig, itemsData) {
        let processed = itemsData?.Items || itemsData || [];
                 
        // Flatten Series Episodes
        if (sectionConfig.flattenSeries === true) {
            processed = flattenSeriesEpisodes(processed);
        }

        if (sectionConfig.id === 'upcoming') {
            // Remove items which aired before today
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            processed = processed.filter(item => {
                if (!item.PremiereDate || item.LocationType !== 'Virtual')
                    return false;
                const premiereDate = new Date(item.PremiereDate);
                premiereDate.setHours(0, 0, 0, 0);
                return premiereDate >= today;
            });
        }

        // Add Custom Secondary Text for Recently Released Movies
        if (sectionConfig.id === 'recentlyReleased.movies' || sectionConfig.id === 'upcoming' || sectionConfig.id === 'recentlyReleased.episodes') {
            processed.forEach(item => {
                if (item.PremiereDate) {
                    item.CustomFooterText = formatAirDate(item.PremiereDate);
                }
            });
        }

        // Apply local limits for non-API sources
        if (sectionConfig.itemLimit) {
            processed = processed.slice(0, sectionConfig.itemLimit);
        }

        // Deduplicate items based on ProviderIds. Look for match imdb, tmdb or tvdb ids
        processed = deduplicateItems(processed);

        return processed;
    }
    
    function resolveCardFormat(sectionConfig) {
        return sectionConfig.cardFormat || 'Poster';
    }

    /**
     * Logic to determine the "Source" for dynamic sections
     * Returns { id, name, metadata: {} }
     */
    async function resolveDynamicSource(config) {
        switch (config.type) {
            case 'Genre':
                const genre = await getRandomGenre();
                return genre ? { id: genre.Id, name: genre.Name, metadata: { Genre: genre.Name } } : null;
                
            case 'Person':
                if (config.sourceType && config.sourceType.includes('watched')) {
                    const result = await getRandomPersonFromHistory(config.personType, config.sourceType);
                    if (!result) return null;
                    
                    return {
                        id: result.person.id,
                        name: result.person.name,
                        excludeItemId: result.sourceItem.Id,
                        metadata: {
                            Person: result.person.name,
                            Actor: result.person.name,
                            Director: result.person.name,
                            Writer: result.person.name,
                            Title: result.sourceItem.Name,
                            Movie: result.sourceItem.Name
                        }
                    };
                }
                
                const person = await getRandomPerson(config.personType);
                return person ? { 
                    id: person.id, 
                    name: person.name, 
                    metadata: { 
                        Person: person.name,
                        Actor: person.name,
                        Director: person.name,
                        Writer: person.name
                    } 
                } : null;
                
            case 'Studio':
                const networks = await StudiosCache.getPopularTVNetworks(); // getPopularTVNetworks();
                if (!networks || !networks.length) return null;
                const network = networks[Math.floor(Math.random() * networks.length)];
                return { id: network.Id, name: network.Name, metadata: { Studio: network.Name } };
                
            case 'Similar':
                if (config.sourceType === 'watched') {
                    const m = getRandomWatchedMovie();
                    return m ? { 
                        id: m.Id,
                        metadata: { 
                            Title: m.Name,
                            Movie: m.Name
                        } 
                    } : null;
                }
                if (config.sourceType === 'liked') {
                    const m = await getRandomFavoriteMovie();
                    return m ? {
                        id: m.Id,
                        metadata: {
                            Title: m.Name,
                            Movie: m.Name
                        }
                    } : null;
                }
                if (config.sourceType === 'watched-recent') {
                     const m = getRandomWatchedMovie();
                     return m ? { 
                        id: m.Id, 
                        metadata: { 
                            Title: m.Name,
                            Movie: m.Name 
                        } 
                    } : null;
                }
                return null;
                
            case 'Collection':
                 const selectedCollection = await getRandomCollectionForDiscovery(config.minimumItems || 3);
                 if (!selectedCollection) return null;
                 
                 return {
                     id: selectedCollection.Id,
                     name: selectedCollection.Name,
                     metadata: { Collection: selectedCollection.Name, "Collection Name": selectedCollection.Name }
                 };
        }
        
        return null;
    }

    function fillTemplate(template, data) {
        if (!data || !template) return template;

        // Support both {Key} and [Key] formats, allowing spaces in keys
        return template.replace(/\{([^}]+)\}|\[([^\]]+)\]/g, (match, key1, key2) => {
            const key = key1 || key2;
            return data[key] || match;
        });
    }

    function disconnectDiscoveryInteraction() {
        // If we are using infinite scroll, disconnect the scroll event listener
        if (state.infiniteScrollHandler) {
            window.removeEventListener('scroll', state.infiniteScrollHandler);
            state.infiniteScrollHandler = null;
        } else {
            const loadMoreButton = document.querySelector('.libraryPage:not(.hide) .load-more-discovery-btn');
            if (loadMoreButton) {
                loadMoreButton.remove();
            }
        }

        // Remove the discovery loading indicator
        const loadingIndicator = document.querySelector('.libraryPage:not(.hide) #discovery-loading-indicator');
        if (loadingIndicator) {
            loadingIndicator.remove();
        }
    }

    /**
     * Ensures discovery buffer is populated (pre-fetches next group)
     */
    async function ensureDiscoveryBuffer() {
        if (state.ensuringDiscoveryBuffer) {
            LOG('Already ensuring discovery buffer...');

            while (state.ensuringDiscoveryBuffer) {
                LOG('Waiting for discovery buffer to be populated...');
                await new Promise(resolve => setTimeout(resolve, 100));
            }

            return;
        }
        LOG('Ensuring discovery buffer...');

        state.ensuringDiscoveryBuffer = true;

        if (state.discoveryBuffer && state.discoveryBuffer.length > 0) {
            LOG('Discovery buffer already exists...');
            state.ensuringDiscoveryBuffer = false;
            return state.discoveryBuffer;
        }

        LOG('Fetching next discovery group data...');

        const groupSections = await generateDiscoveryGroup();

        if (!groupSections || groupSections.length === 0) {
            LOG('No more discovery sections available for buffer.');
            state.ensuringDiscoveryBuffer = false;
            state.discoverySectionsRemain = false;
            disconnectDiscoveryInteraction();
            return;
        }

        state.discoveryBuffer = await Promise.all(groupSections.map(async (sectionConfig) => {
            // Use loadSectionForRendering which handles all queries, multi-query merging, and post-processing
            return await loadSectionForRendering(sectionConfig);
        }));

        // Filter out any null results
        state.discoveryBuffer = state.discoveryBuffer.filter(result => result !== null);

        state.ensuringDiscoveryBuffer = false;
        return state.discoveryBuffer;
    }


    async function setupDiscoveryInteraction(container) {
        const userConfig = getDiscoverySettings();
        
        if (userConfig && userConfig.enabled === false) {
             LOG('Discovery sections disabled in config.');
             state.discoveryEnabled = false;
             return;
        }

        // Ensure at least 1 discovery section is enabled
        const discoverySections = getDiscoverySections();
        if (!discoverySections || discoverySections.length === 0 || discoverySections.every(section => section.enabled === false)) {
            LOG('No discovery sections enabled in config.');
            state.discoveryEnabled = false;
            return;
        }

        if (!container) {
            WARN('setupDiscoveryInteraction called without a valid container');
            return;
        }

        if (PRE_FETCH_DISCOVERY_DATA) {
            ensureDiscoveryBuffer();
        }

        createDiscoveryLoadingIndicator(container);

        const useInfiniteScroll = userConfig ? (userConfig.infiniteScroll !== false) : true;
        
        if (useInfiniteScroll) {
            setupInfiniteScroll(container);
        } else {
            setupLoadMoreButton(container);
        }
    }

    async function renderNextDiscoveryGroup(container) {
        if (state.isRenderingDiscovery) return;
        state.isRenderingDiscovery = true;
        container.dataset.loadingDiscovery = 'true';

        await new Promise(resolve => requestAnimationFrame(resolve));
        await new Promise(resolve => setTimeout(resolve, 0));

        try {
            await ensureDiscoveryBuffer();
            
            const bufferedSections = state.discoveryBuffer;
            
            if (!bufferedSections || bufferedSections.length === 0) {
                LOG('No more discovery sections available.');
                state.discoveryBuffer = null;
                return;
            }

            LOG(`Rendering Discovery Group ${state.discoveryGroupIndex + 1} (${bufferedSections.length} sections)...`);

            await window.cardBuilder.renderProgressiveSections(container, bufferedSections);

            if (!getDiscoverySettings().infiniteScroll) {
                setupLoadMoreButton(container);
            }

            container.dataset.loadingDiscovery = 'false';
            container.classList.remove('loading-discovery');
            
            state.discoveryGroupIndex++;

            state.discoveryBuffer = null;
            if (PRE_FETCH_DISCOVERY_DATA) {
                ensureDiscoveryBuffer();
            }

        } catch (e) {
            ERR('Error rendering discovery group:', e);
            state.discoveryBuffer = null;
        } finally {
            state.isRenderingDiscovery = false;
            updateLoadMoreButtonVisibility(); 
        }
    }

    /**
     * Generates a balanced group of discovery sections
     */
    async function generateDiscoveryGroup() {
/*         if (state.firstDiscoveryBuffer) {
            const firstBufferConfig = state.firstDiscoveryBuffer;
            delete state.firstDiscoveryBuffer;
            localCache.clear('firstDiscoveryBuffer');

            firstBufferConfig.forEach(config => {
                config.order = state.discoverySectionOrder++;
            });

            return firstBufferConfig;
        } */

/*         let discoveryTemplates = flattenSectionGroups(Config.DISCOVERY_SECTION_GROUPS || []);
        const userDiscoverySectionGroups = window.KefinTweaksConfig && window.KefinTweaksConfig.homeScreenConfig && window.KefinTweaksConfig.homeScreenConfig.DISCOVERY_SECTION_GROUPS;
        const userDiscoverySections = userDiscoverySectionGroups ? flattenSectionGroups(userDiscoverySectionGroups) : [];

        if (userDiscoverySections.length > 0) {
             discoveryTemplates = discoveryTemplates.map(tpl => {
                 const userSection = userDiscoverySections.find(s => s.id === tpl.id);
                 if (userSection) {
                     return { ...tpl, ...userSection };
                 }
                 return tpl;
             });
        } */

        const selectedConfigs = [];
        
        let discoveryTemplates = getDiscoverySections();
        
        if (getDiscoverySettings().randomizeOrder) {
            discoveryTemplates = [...discoveryTemplates].sort(() => 0.5 - Math.random());
        }
        
        for (const template of discoveryTemplates) {
            if (template.enabled === false) continue;

            if (template.queries && template.queries.length > 0) {
                selectedConfigs.push(template);
                continue;
            }
            
            const instanceConfig = { 
                ...template, 
                id: `${template.id}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            };
            
            const dynamicResult = await resolveDynamicSource(instanceConfig);
            if (dynamicResult) {
                instanceConfig.source = dynamicResult.id || dynamicResult.name;
                instanceConfig.metadata = dynamicResult.metadata;
                instanceConfig.excludeItemId = dynamicResult.excludeItemId;

                if (getDiscoverySettings().renderSpotlightAboveMatching) {
                    const configId = instanceConfig.id.split('-')[0];

                    if (configId === 'genreMovies' || configId === 'spotlightGenre') {
                        if (state.currentDiscoveryGenre) {
                            instanceConfig.source = state.currentDiscoveryGenre.id;
                            dynamicResult.metadata = state.currentDiscoveryGenre.metadata;
                            state.currentDiscoveryGenre = null;
                        }
                        else {
                            state.currentDiscoveryGenre = dynamicResult;
                        }
                    }
                    if (configId === 'studioShows' || configId === 'spotlightNetwork') {
                        if (state.currentDiscoveryStudio) {
                            instanceConfig.source = state.currentDiscoveryStudio.id;
                            dynamicResult.metadata = state.currentDiscoveryStudio.metadata;
                            state.currentDiscoveryStudio = null;
                        }
                        else {
                            state.currentDiscoveryStudio = dynamicResult;
                        }
                    }
                }
            
                // Create queries array with proper queryOptions
                const queryOptions = {
                    Recursive: 'true',
                    Limit: instanceConfig.itemLimit || 20
                };

                // Add IncludeItemTypes if specified
                if (instanceConfig.includeItemTypes && instanceConfig.includeItemTypes.length) {
                    queryOptions.IncludeItemTypes = instanceConfig.includeItemTypes;
                }

                // Add SortBy and SortOrder if specified
                if (instanceConfig.sortOrder) {
                    queryOptions.SortBy = instanceConfig.sortOrder;
                }
                if (instanceConfig.sortOrderDirection) {
                    queryOptions.SortOrder = instanceConfig.sortOrderDirection;
                }

                    // Handle type-specific query options
                    const resolvedSource = instanceConfig.source;
                    if (instanceConfig.type === 'Similar') {
                        // Similar type uses custom path
                        instanceConfig.queries = [{
                            path: `/Items/${resolvedSource}/Similar`,
                            queryOptions: {
                                Limit: instanceConfig.itemLimit || 20,
                                Fields: 'PrimaryImageAspectRatio,DateCreated,Overview,Taglines,ProductionYear,RecursiveItemCount,ChildCount,UserData'
                            }
                        }];
                    } else {
                        // Standard query types
                        switch (instanceConfig.type) {
                            case 'Genre':
                                if (resolvedSource && resolvedSource.match(/^[a-f0-9]{32}$/)) {
                                    queryOptions.GenreIds = [resolvedSource];
                                } else if (resolvedSource) {
                                    queryOptions.Genres = resolvedSource;
                                }
                                break;
                            case 'Tag':
                                if (resolvedSource) {
                                    queryOptions.Tags = resolvedSource;
                                }
                                break;
                            case 'Person':
                                if (resolvedSource) {
                                    queryOptions.PersonIds = [resolvedSource];
                                }
                                if (instanceConfig.excludeItemId) {
                                    queryOptions.ExcludeItemIds = Array.isArray(instanceConfig.excludeItemId) 
                                        ? instanceConfig.excludeItemId 
                                        : [instanceConfig.excludeItemId];
                                }
                                break;
                            case 'Studio':
                                if (resolvedSource && resolvedSource.match(/^[a-f0-9]{32}$/)) {
                                    queryOptions.StudioIds = [resolvedSource];
                                } else if (resolvedSource) {
                                    queryOptions.Studios = resolvedSource;
                                }
                                break;
                            case 'Collection':
                            case 'Parent':
                                if (resolvedSource) {
                                    queryOptions.ParentId = resolvedSource;
                                }
                                break;
                        }

                    // Add spotlight fields if needed
                    if (instanceConfig.spotlight || instanceConfig.renderMode === 'Spotlight') {
                        queryOptions.Fields = 'PrimaryImageAspectRatio,DateCreated,Overview,Taglines,ProductionYear,RecursiveItemCount,ChildCount,UserData,People,Genres';
                    } else {
                        queryOptions.Fields = 'PrimaryImageAspectRatio,DateCreated,Overview,Taglines,ProductionYear,RecursiveItemCount,ChildCount,UserData';
                    }

                    instanceConfig.queries = [{
                        queryOptions: queryOptions
                    }];
                }

                const sectionName = fillTemplate(instanceConfig.name, dynamicResult.metadata);
                const cardFormat = resolveCardFormat(instanceConfig);
                const viewMoreUrl = await resolveViewMoreUrl(instanceConfig);

                instanceConfig.name = sectionName;
                instanceConfig.cardFormat = cardFormat;
                instanceConfig.viewMoreUrl = viewMoreUrl;

                selectedConfigs.push(instanceConfig);
            }
        }

        if (getDiscoverySettings().renderSpotlightAboveMatching) {
            const spotlightGenreSection = selectedConfigs.find(section => section.id.split('-')[0] === 'spotlightGenre');
            const spotlightNetworkSection = selectedConfigs.find(section => section.id.split('-')[0] === 'spotlightNetwork');

            if (spotlightGenreSection) {
                const genreSection = selectedConfigs.find(section => section.id.split('-')[0] === 'genreMovies');
                if (genreSection) {
                    const genreSectionIndex = selectedConfigs.indexOf(genreSection);
                    const spotlightGenreSectionIndex = selectedConfigs.indexOf(spotlightGenreSection);
                    
                    if (genreSectionIndex < spotlightGenreSectionIndex) {
                        selectedConfigs.splice(genreSectionIndex, 1);
                        selectedConfigs.splice(spotlightGenreSectionIndex, 0, genreSection);
                    } else if (genreSectionIndex > spotlightGenreSectionIndex) {
                        selectedConfigs.splice(genreSectionIndex, 1);
                        selectedConfigs.splice(spotlightGenreSectionIndex + 1, 0, genreSection);
                    }
                }
            }
            if (spotlightNetworkSection) {
                const studioSection = selectedConfigs.find(section => section.id.split('-')[0] === 'studioShows');
                if (studioSection) {
                    const studioSectionIndex = selectedConfigs.indexOf(studioSection);
                    const spotlightNetworkSectionIndex = selectedConfigs.indexOf(spotlightNetworkSection);
                    if (studioSectionIndex < spotlightNetworkSectionIndex) {
                        selectedConfigs.splice(studioSectionIndex, 1);
                        selectedConfigs.splice(spotlightNetworkSectionIndex, 0, studioSection);
                    } else if (studioSectionIndex > spotlightNetworkSectionIndex) {
                        selectedConfigs.splice(studioSectionIndex, 1);
                        selectedConfigs.splice(spotlightNetworkSectionIndex + 1, 0, studioSection);
                    }
                }
            }
        }

        selectedConfigs.forEach((section) => {
            section.order = state.discoverySectionOrder++;
        });

        //localCache.set('discoveryBuffer', selectedConfigs);

        return selectedConfigs;
    }

    function setupInfiniteScroll(container) {
        if (container.dataset.discoveryHandler) return;
        container.dataset.discoveryHandler = 'true';

        state.infiniteScrollHandler = window.addEventListener('scroll', () => {
            // Check if the user is on the home page
            const currentView = window.KefinTweaksUtils?.getCurrentView();
            const isHomePage = currentView === 'home' || currentView === 'home.html';
            if (!isHomePage) return;

            // Check if the user is on the first tab
            const activeTab = document.querySelector('.headerTabs .emby-tab-button-active').getAttribute('data-index');
            if (activeTab !== '0') return;

            if (!container.dataset.sectionsRendered) return;

            if (state.isRenderingDiscovery) return;
             
            const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
            const windowHeight = window.innerHeight;
            const documentHeight = document.documentElement.scrollHeight;
            
            const threshold = windowHeight * 1.5;
            
            if (scrollTop + windowHeight >= documentHeight - threshold) { 
                renderNextDiscoveryGroup(container);
            }
        }, { passive: true });
        LOG('Infinite scroll enabled for discovery.');
    }

    function setupLoadMoreButton(container) {
        const loadMoreButton = container.querySelector('.load-more-discovery-btn');
        if (loadMoreButton) return;

        let btn = document.createElement('button');
        btn.className = 'raised button-submit emby-button load-more-discovery-btn';
        btn.textContent = 'Discover More';
        btn.onclick = () => {
            btn.remove();
            renderNextDiscoveryGroup(container)
        };
        container.appendChild(btn);
        LOG('Load More button enabled for discovery.');
    }
    
    function updateLoadMoreButtonVisibility() {
        const btn = document.querySelector('.load-more-discovery-btn');
        if (btn) {
            btn.style.display = 'block';
        }
    }

    function isInSeasonalPeriod(start, end) {
        const now = new Date();
        const currentYear = now.getFullYear();
        const startDate = new Date(`${start}-${currentYear}`);

        let endDate = new Date(`${end}-${currentYear}`);
        if (endDate < startDate) endDate.setFullYear(currentYear + 1);
        else if (endDate > startDate) endDate.setFullYear(currentYear);

        return now >= startDate && now <= endDate;
    }

    function isHalloweenPeriod() {
        return isInSeasonalPeriod('10-01', '10-31');
    }
    
    function isChristmasPeriod() {
        return isInSeasonalPeriod('12-01', '12-31');
    }
    
    function isNewYearsPeriod() {
        return isInSeasonalPeriod('01-01', '01-05');
    }
    
    async function isValentinesPeriod() {
        const homeScreenConfig = await window.KefinHomeScreen.getConfig();
        const valentinesConfig = homeScreenConfig.SEASONAL_SECTION_GROUPS.find(s => s.id === 'seasonal-valentines');
        if (!valentinesConfig) { 
            return false;
        }

        const activeSection = valentinesConfig.sections.find(s => s.enabled);

        if (!activeSection) {
            return false;
        }

        return isInSeasonalPeriod(activeSection.startDate, activeSection.endDate);        
    }

    const localCache = new window.LocalStorageCache();

    async function getRandomGenre() {
        let movieGenres = localCache.get('movieGenres');
        if (!movieGenres) movieGenres = await fetchAndCacheMovieGenres();
        if (!movieGenres || !movieGenres.length) return null;
        
        const minCount = (Config.DISCOVERY_SETTINGS && Config.DISCOVERY_SETTINGS.minGenreMovieCount) 
                         || (window.KefinTweaksConfig && window.KefinTweaksConfig.homeScreen && window.KefinTweaksConfig.homeScreen.discovery && window.KefinTweaksConfig.homeScreen.discovery.minGenreMovieCount)
                         || 50;

        const valid = movieGenres.filter(g => !state.renderedDiscoveryIds.genres.has(g.Id) && (g.MovieCount || 0) > minCount);
        if (!valid.length) return null;
        
        const selected = valid[Math.floor(Math.random() * valid.length)];
        state.renderedDiscoveryIds.genres.add(selected.Id);
        return selected;
    }

    async function fetchAndCacheMovieGenres() {
        try {
            const userId = ApiClient.getCurrentUserId();
            const response = await fetch(`${ApiClient.serverAddress()}/Genres?IncludeItemTypes=Movie`, {
                headers: { 'X-Emby-Token': ApiClient.accessToken() }
            });
            const data = await response.json();
            const genres = (data.Items || []).map(g => ({ Id: g.Id, Name: g.Name, MovieCount: g.MovieCount }));
            localCache.set('movieGenres', genres);
            return genres;
        } catch (e) {
            ERR('Failed to fetch genres', e);
            return [];
        }
    }

    async function getRandomCollectionForDiscovery(minimumItems) {
        const collections = await getCollectionsData();
        if (!collections || !collections.length) return null;
        const unrenderedCollections = collections.filter(c => !state.renderedDiscoveryIds.collections.has(c.Id));
        const eligibleCollections = unrenderedCollections.filter(c => c.TotalRecordCount ?? c.RecursiveItemCount ?? c.ChildCount ?? 0 >= minimumItems);
        if (!eligibleCollections.length) return null;
        const selected = eligibleCollections[Math.floor(Math.random() * eligibleCollections.length)];
        state.renderedDiscoveryIds.collections.add(selected.Id);
        return selected;
    }

    async function getCollectionsData() {
        const query = `${ApiClient.serverAddress()}/Items?IncludeItemTypes=BoxSet&Recursive=true&Fields=RecursiveItemCount,ChildCount,TotalRecordCount&StartIndex=0&Limit=500&SortBy=TotalRecordCount`;
        
        try {
            const result = await ApiHelper.getQuery(query, {
                useCache: true,
                ttl: Config.CACHE.LONG_TTL
            });
            
            let items = [];
            if (result.data && result.data.Items) {
                items = result.data.Items;
            } else {
                const fresh = await result.dataPromise;
                items = fresh.Items || [];
            }
            return items;
        } catch (e) {
            ERR('Failed to fetch collections', e);
            return [];
        }
    }

    async function getRandomPersonFromHistory(personType, sourceType) {
        let sourceItems = [];
        if (sourceType === 'watched-recent') {
            sourceItems = localCache.get('movies') || [];
            if (sourceItems.length === 0) return null;

            sourceItems = sourceItems.sort((a, b) => new Date(b.UserData.LastPlayedDate) - new Date(a.UserData.LastPlayedDate)).slice(0, 5);
        } else if (sourceType === 'watched') {
             sourceItems = localCache.get('movies') || []; 
             if (sourceItems.length === 0) return null;
             sourceItems = sourceItems.sort(() => 0.5 - Math.random()).slice(0, 20);
        }

        if (!sourceItems.length) return null;

        sourceItems.sort(() => 0.5 - Math.random());

        for (const item of sourceItems) {
            if (!item.People || !item.People.length) continue;
            
            const candidates = item.People.filter(p => p.Type === personType);
            if (!candidates.length) continue;
            
            const person = candidates[Math.floor(Math.random() * candidates.length)];
            
            let trackedSet = null;
            if (personType === 'Director') trackedSet = state.renderedDiscoveryIds.directors;
            else if (personType === 'Actor') trackedSet = state.renderedDiscoveryIds.actors;
            else if (personType === 'Writer') trackedSet = state.renderedDiscoveryIds.writers;
            
            if (trackedSet && !trackedSet.has(person.Id)) {
                trackedSet.add(person.Id);
                return {
                    person: { id: person.Id, name: person.Name },
                    sourceItem: item
                };
            }
        }
        
        return null;
    }

    async function getRandomPerson(type) {
        if (!PeopleCache) return null;
        PeopleCache.init();
        
        const peopleData = await PeopleCache.getTopPeople();
        if (!peopleData) return null;
        
        let list = [];
        let trackedSet = null;

        if (type === 'Director') {
            list = peopleData.directors;
            trackedSet = state.renderedDiscoveryIds.directors;
        } else if (type === 'Actor') {
            list = peopleData.actors;
            trackedSet = state.renderedDiscoveryIds.actors;
        } else if (type === 'Writer') {
            list = peopleData.writers;
            trackedSet = state.renderedDiscoveryIds.writers;
        }
        
        if (!list || !list.length || !trackedSet) return null;
        
        const valid = list.filter(p => !trackedSet.has(p.id));
        if (!valid.length) return null;
        
        const selected = valid[Math.floor(Math.random() * valid.length)];
        trackedSet.add(selected.id);
        return selected;
    }

    function getRandomWatchedMovie() {
        const movies = localCache.get('movies') || [];
        if (!movies.length) return null;
        const valid = movies.filter(m => !state.renderedDiscoveryIds.watchedMovies.has(m.Id));
        if (!valid.length) return null;
        const selected = valid[Math.floor(Math.random() * Math.min(valid.length, 10))];
        state.renderedDiscoveryIds.watchedMovies.add(selected.Id);
        return selected;
    }

    async function getRandomFavoriteMovie() {
        if (state.cachedFavorites) {
            const valid = state.cachedFavorites.filter(m => !state.renderedDiscoveryIds.likedMovies.has(m.Id));
            if (valid.length > 0) {
                const selected = valid[Math.floor(Math.random() * valid.length)];
                state.renderedDiscoveryIds.likedMovies.add(selected.Id);
                return selected;
            }
        }
        const userId = ApiClient.getCurrentUserId();
        try {
            const response = await ApiClient.getItems(userId, { IncludeItemTypes: 'Movie', Filters: 'IsFavorite', Limit: 50, SortBy: 'Random', Recursive: true });
            const items = response.Items || [];
            if (!items.length) return null;
            state.cachedFavorites = items;
            const valid = items.filter(m => !state.renderedDiscoveryIds.likedMovies.has(m.Id));
            if (!valid.length) return null;
            const selected = valid[0];
            state.renderedDiscoveryIds.likedMovies.add(selected.Id);
            return selected;
        } catch (e) {
            ERR('Failed to get favorite movies:', e);
            return null;
        }
    }

    async function getPopularTVNetworks() {
        if (!StudiosCache) return [];

        // Get Minimum Series Count from config
        
        await StudiosCache.init();
        return StudiosCache.getPopularTVNetworks();
    }

    window.homeScreen3 = { init: enhanceHomeScreen };

    if (window.KefinTweaksUtils && typeof window.KefinTweaksUtils.onViewPage === 'function') {
        window.KefinTweaksUtils.onViewPage((view, element, hash) => {
            // Get selected tab from hash
            const hashParams = hash.includes('?') ? hash.split('?')[1] : '';
            const urlParams = new URLSearchParams(hashParams);
            const currentTab = urlParams.get('tab');
            const currentTabIndex = currentTab ? parseInt(currentTab, 10) : 0;

            // If the tab isn't 0, don't render the home screen
            if (currentTabIndex !== 0) {
                return;
            }

            try { 
                manageBodyClasses();
                enhanceHomeScreen();
            } catch (err) { ERR('Home screen page change handler failed:', err); }
        }, { pages: ['home', 'home.html'] });
    }

    /* if (window.KefinTweaksUtils && typeof window.KefinTweaksUtils.onViewPage === 'function') {
        window.KefinTweaksUtils.onViewPage(manageBodyClasses, { pages: [] });
    } */

})();

