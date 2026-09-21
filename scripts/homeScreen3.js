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
            genresSeries: new Set(),
            seriesStudios: new Set(),
            seriesStudiosTopRated: new Set(),
            collections: new Set(),
            people: new Set(),
            similar: new Set(),
            watchlist: new Set(),
            customDiscoverySections: new Set()
        },
        currentDiscoveryGenre: null,
        currentDiscoveryStudio: null,
        isPeopleCacheComplete: false,
        discoveryGroupIndex: 0,
        isRenderingDiscovery: false,
        discoveryEnabled: true,
        discoveryBufferPromise: null,
        discoveryBuffer: [],
        discoverySectionOrder: 100000000,
        discoverySectionsRemain: true,
        ensuringDiscoveryBuffer: false,
        discoveryNeedsMoreScroll: false,
        discoveryMode: null, // 'infinite' | 'chevron'
        infiniteScrollHandler: null,
        discoveryWheelHandler: null,
        discoveryTouchStartHandler: null,
        discoveryTouchMoveHandler: null,
        discoveryScrollDebounceTimer: null,
        userDisplayPreferences: null,
        firstDiscoveryBuffer: null,
        getDisplayPrefernces: null,
        kefinNextUp: false,
        kefinContinueWatching: false,
        kefinLatestMedia: false,
        jellyfinOrders: {},
        homePaintedEventFired: false,
        isRenderingHome: false
    };

    async function fetchDisplayPreferences() {
        if (!window.userHelper?.getUserDisplayPreferences) {
            WARN('userHelper.getUserDisplayPreferences unavailable');
            return null;
        }
        const { promise, cached } = await window.userHelper.getUserDisplayPreferences({ cacheOnly: true });
        const prefs = cached || await promise;
        state.userDisplayPreferences = prefs;
        return prefs;
    }
    state.getDisplayPrefernces = fetchDisplayPreferences;

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
        let loadingDiv = document.querySelector('.homePage:not(.hide) #discovery-loading-indicator')
            || document.querySelector('.libraryPage:not(.hide) #discovery-loading-indicator');
        if (loadingDiv) {
            return loadingDiv;
        }

        // Prefer the provided container, but fall back to the standard sections container
        if (!container) {
            container = document.querySelector('.homePage:not(.hide) #homeTab .sections')
                || document.querySelector('.libraryPage:not(.hide) .homeSectionsContainer');
        }

        if (!container) {
            WARN('Discovery loading indicator: sections container not found');
            return null;
        }

        loadingDiv = document.createElement('div');
        loadingDiv.className = 'discovery-loading-indicator';
        loadingDiv.id = 'discovery-loading-indicator';
        loadingDiv.style.order = '1000000000';
        loadingDiv.innerHTML = `
            <div class="spinner"></div>
        `;

        container.appendChild(loadingDiv);
        LOG('Created discovery loading indicator inside sections container');
        
        return loadingDiv;
    }

    function getDiscoveryHomePageEl() {
        return document.querySelector('#indexPage')
            || document.querySelector('.homePage:not(.hide)')
            || document.querySelector('.libraryPage:not(.hide)');
    }

    function setDiscoveryPageAttrs({ ready = false, infinite = false, exhausted = false } = {}) {
        const page = getDiscoveryHomePageEl();
        if (!page) return;
        if (ready) page.dataset.discoveryReady = 'true';
        else delete page.dataset.discoveryReady;
        if (infinite) page.dataset.infiniteScroll = 'true';
        else delete page.dataset.infiniteScroll;
        if (exhausted) page.dataset.discoveryExhausted = 'true';
        else delete page.dataset.discoveryExhausted;
    }

    function showDiscoveryLoadingIndicator() {
        const loadingIndicator = createDiscoveryLoadingIndicator(
            document.querySelector('.libraryPage:not(.hide) .homeSectionsContainer')
        );
        if (!loadingIndicator) return;
        loadingIndicator.classList.add('show');
        loadingIndicator.style.visibility = 'visible';
        loadingIndicator.style.display = 'flex';
    }

    function hideDiscoveryLoadingIndicator() {
        const loadingIndicator = document.querySelector('.libraryPage:not(.hide) #discovery-loading-indicator');
        if (!loadingIndicator) return;
        loadingIndicator.classList.remove('show');
        // Chevron / exhausted idle UI is shown via data-discovery-ready CSS
        if (state.discoveryMode === 'chevron' || state.discoverySectionsRemain === false) {
            loadingIndicator.style.visibility = '';
            loadingIndicator.style.display = '';
        } else {
            loadingIndicator.style.visibility = 'hidden';
            loadingIndicator.style.display = 'none';
        }
    }

    function isDiscoveryHomeContext() {
        const currentView = window.KefinTweaksUtils?.getCurrentView();
        const isHomePage = currentView === 'home' || currentView === 'home.html';
        if (!isHomePage) return false;
        const activeTab = document.querySelector('.headerTabs .emby-tab-button-active');
        if (!activeTab || activeTab.getAttribute('data-index') !== '0') return false;
        return true;
    }

    function removeDiscoveryScrollListeners() {
        if (state.discoveryScrollDebounceTimer) {
            clearTimeout(state.discoveryScrollDebounceTimer);
            state.discoveryScrollDebounceTimer = null;
        }
        if (state.infiniteScrollHandler) {
            window.removeEventListener('scroll', state.infiniteScrollHandler);
            state.infiniteScrollHandler = null;
        }
        if (state.discoveryWheelHandler) {
            window.removeEventListener('wheel', state.discoveryWheelHandler);
            state.discoveryWheelHandler = null;
        }
        if (state.discoveryTouchStartHandler) {
            window.removeEventListener('touchstart', state.discoveryTouchStartHandler);
            state.discoveryTouchStartHandler = null;
        }
        if (state.discoveryTouchMoveHandler) {
            window.removeEventListener('touchmove', state.discoveryTouchMoveHandler);
            state.discoveryTouchMoveHandler = null;
        }
        const container = document.querySelector('.libraryPage:not(.hide) .homeSectionsContainer');
        if (container) delete container.dataset.discoveryHandler;
    }

    function markDiscoveryExhausted() {
        state.discoverySectionsRemain = false;
        state.discoveryBuffer = null;
        removeDiscoveryScrollListeners();
        setDiscoveryPageAttrs({ ready: true, infinite: false, exhausted: true });
        const loadingIndicator = createDiscoveryLoadingIndicator(
            document.querySelector('.libraryPage:not(.hide) .homeSectionsContainer')
        );
        if (loadingIndicator) {
            loadingIndicator.classList.remove('show');
            loadingIndicator.style.visibility = '';
            loadingIndicator.style.display = '';
        }
        LOG('Discovery exhausted — No More Content to Discover');
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

    const HOME_SECTIONS_SELECTOR = '.homePage:not(.hide) #homeTab .sections';
    let homeSectionsReadyObserver = null;

    function disconnectHomeSectionsReadyObserver() {
        if (!homeSectionsReadyObserver) return;
        homeSectionsReadyObserver.disconnect();
        homeSectionsReadyObserver = null;
        LOG('Disconnected home sections ready observer');
    }

    function connectHomeSectionsReadyObserver() {
        if (homeSectionsReadyObserver) {
            LOG('Home sections ready observer already connected');
            return;
        }

        const existing = document.querySelector(HOME_SECTIONS_SELECTOR);
        if (existing) {
            LOG('Home sections container already present; enhancing');
            enhanceHomeScreen();
            return;
        }

        if (typeof MutationObserver === 'undefined') {
            WARN('MutationObserver unavailable; cannot wait for home sections container');
            return;
        }

        homeSectionsReadyObserver = new MutationObserver(() => {
            if (!document.querySelector(HOME_SECTIONS_SELECTOR)) return;
            LOG('Home sections container appeared; enhancing');
            enhanceHomeScreen();
        });
        homeSectionsReadyObserver.observe(document.documentElement, {
            childList: true,
            subtree: true
        });
        LOG('Connected home sections ready observer');
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
    

    /**
     * Main Entry Point
     */
    async function enhanceHomeScreen() {
        LOG('Initializing Home Screen v3...');
        performanceTimer.loadTimeStart = performance.now();
        performanceMetrics.initialRenderStart = performance.now();

        mountCreateSectionButton();
        mountCategoryRail();
        syncHomeScreenChromeVisibility();

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
        
        const container = document.querySelector(HOME_SECTIONS_SELECTOR);
        if (!container) {
            LOG('Home sections container not found');
            connectHomeSectionsReadyObserver();
            return;
        }

        disconnectHomeSectionsReadyObserver();

        // Create Kefin home sections container as a sibling of the Jellyfin sections container
/*         let kefinHomeSectionsContainer = document.querySelector('.homePage:not(.hide) #homeTab .kefinHomeSectionsContainer');
        if (!kefinHomeSectionsContainer) {
            kefinHomeSectionsContainer = document.createElement('div');
            kefinHomeSectionsContainer.className = 'sections homeSectionsContainer kefinHomeSectionsContainer';
            if (container.parentNode) {
                container.parentNode.insertBefore(kefinHomeSectionsContainer, container.nextSibling);
            } else {
                LOG('Sections container has no parent node; appending Kefin container to body as fallback');
                document.body.appendChild(kefinHomeSectionsContainer);
            }
        } */

        // If we've already initialized and Jellyfin has completed its render, avoid re-running
        const kefinTweaksHomeSections = document.querySelectorAll('.homePage:not(.hide) #homeTab .homeSectionsContainer [data-section-id]');
        if (kefinTweaksHomeSections.length > 0) {
            LOG('Home screen already initialized and Jellyfin has rendered');
            return;
        }

        // Check if another page container exists with an already rendered KefinTweaks home screen
        const otherPageContainer = document.querySelector('.pageContainer:not(.hide) .homeSectionsContainer[data-sections-rendered="true"]');
        if (otherPageContainer) {
            // Copy the existing home sections with [data-section-id] from that container into our target container instead of re-rendering it
            const otherPageSections = otherPageContainer.querySelectorAll('[data-section-id]');
            const homeScreenFragment = document.createDocumentFragment();
            otherPageSections.forEach(section => {
                homeScreenFragment.appendChild(section.cloneNode(true));
            });
            container.appendChild(homeScreenFragment);
            LOG('Cloned existing home sections from a previous container');
            return;
        }

        let performanceStartTime = performance.now();
        
        // Fetch display preferences
        //state.userDisplayPreferences = await fetchDisplayPreferences();
        
        let performanceEndTime = performance.now();
        let performanceDuration = performanceEndTime - performanceStartTime;
        LOG(`Home Screen v3 Fetch display preferences initialization time: ${performanceDuration.toFixed(2)}ms`);

        // Load user preferences and apply filtering/ordering
        performanceStartTime = performance.now();

        const userHomeConfig = window.KefinUserHomeScreenConfig;
        let filteredHomeSections;
        let homeScreen;
        let userDisplayPreferences = null;

        if (typeof userHomeConfig?.getConfig === 'function') {
            const userConfig = await userHomeConfig.getConfig();
            filteredHomeSections = userConfig.sections || [];
            homeScreen = userConfig.homeScreen;
            userDisplayPreferences = await state.getDisplayPrefernces();
            //addUserHomeScreenOrderCSS(userDisplayPreferences, homeScreen);
        } else {
            const mergedHomeSections = await mergeHomeSectionConfigs();
            userDisplayPreferences = await state.getDisplayPrefernces();
            const customPrefs = userDisplayPreferences?.CustomPrefs || {};
            homeScreen = userHomeConfig.parseKefinTweaksHomeScreen(customPrefs);
            const pinnedSections = userHomeConfig.buildPinnedSectionConfigs(homeScreen);
            //addUserHomeScreenOrderCSS(userDisplayPreferences, homeScreen);

            const serverSectionsById = new Map();
            mergedHomeSections.forEach(section => {
                if (section?.id) serverSectionsById.set(section.id, section);
            });

            filteredHomeSections = [...mergedHomeSections, ...pinnedSections];
            filteredHomeSections = userHomeConfig.applyUserSectionOverrides(filteredHomeSections, homeScreen, { serverSectionsById });
            filteredHomeSections = filteredHomeSections.filter(section => section.enabled !== false);
        }

        updatePinnedCategoryAvailability(filteredHomeSections, homeScreen);

        performanceEndTime = performance.now();
        performanceDuration = performanceEndTime - performanceStartTime;
        LOG(`Home Screen v3 Load user home screen sections initialization time: ${performanceDuration.toFixed(2)}ms`);

        const nextupSectionConfig = filteredHomeSections.find(s => s.id === 'nextUp');
        const continueWatchingSectionConfig = filteredHomeSections.find(s => s.id === 'continueWatching');
        const continueWatchingAndNextUpSectionConfig = filteredHomeSections.find(s => s.id === 'continueWatchingAndNextUp');
        const recentlyAddedSectionConfig = filteredHomeSections.find(s => s.id?.startsWith?.('recently-added-') && s.enabled === true);
        state.kefinNextUp = nextupSectionConfig?.enabled === true || continueWatchingAndNextUpSectionConfig?.enabled === true;
        state.kefinContinueWatching = continueWatchingSectionConfig?.enabled === true || continueWatchingAndNextUpSectionConfig?.enabled === true;
        state.kefinLatestMedia = recentlyAddedSectionConfig?.enabled === true;

        // Set up mutation observer BEFORE rendering, so we can react when Jellyfin renders home sections
/*         const handleJellyfinRender = async () => {
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
        }; */

        //let containerForRender = container;

/*         if (!container.classList.contains('homeSectionsContainer')) {
            const observer = observeContainerMutations(container, handleJellyfinRender);
            containerForRender = kefinHomeSectionsContainer;
        } */

        // Set flag to indicate we've started initializing this container
        //containerForRender.dataset.kefinHomeScreen = 'true';

        // Initial render directly into Kefin container (no waiting for Jellyfin)
        performanceStartTime = performance.now();
        LOG('Rendering Standard/Seasonal Sections (initial render)...');
        await renderHomeSections(filteredHomeSections, container, false);
        performanceEndTime = performance.now();
        performanceDuration = performanceEndTime - performanceStartTime;
        LOG(`Home Screen v3 Render home sections (initial) initialization time: ${performanceDuration.toFixed(2)}ms`);

        performanceMetrics.initialRenderEnd = performanceEndTime;

        performanceTimer.loadTimeEnd = performance.now();
        LOG(`Home Screen v3 load time initialization: ${(performanceTimer.loadTimeEnd - performanceTimer.loadTimeStart).toFixed(2)}ms`);
        
        LOG('Initializing Discovery Sections...');
        setupDiscoveryInteraction(container);

        try {
            refreshHomeCategoryChrome();
        } catch (err) {
            ERR('Failed to refresh home category chrome after home render:', err);
        }

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

        const performanceStartTime = performance.now();
        const kefinSections = await window.KefinHomeScreen.getSections();
        const performanceEndTime = performance.now();
        const performanceDuration = performanceEndTime - performanceStartTime;
        LOG(`Home Screen v3 Get kefin home screen config initialization time: ${performanceDuration.toFixed(2)}ms`);

        return kefinSections.enabledHomeSections;

        // Return all enabled sections from HOME_SECTION_GROUPS
        const homeSections = flattenSectionGroups(kefinHomeScreenConfig.HOME_SECTION_GROUPS).filter(s => s.enabled === true);
        // Return all enabled sections from SEASONAL_SECTION_GROUPS that fall within the current date
        const seasonalSections = flattenSectionGroups(kefinHomeScreenConfig.SEASONAL_SECTION_GROUPS).filter(s => s.enabled === true && isInSeasonalPeriod(s.startDate, s.endDate));
        // Return all enabled sections from CUSTOM_SECTION_GROUPS that aren't discovery sections and if they have a start/end date that also fall within that date range
        const customSections = flattenSectionGroups(kefinHomeScreenConfig.CUSTOM_SECTION_GROUPS).filter(s => s.enabled === true && s.discoveryEnabled !== true && (s.startDate && s.endDate ? isInSeasonalPeriod(s.startDate, s.endDate) : true));

        const mergedSections = [...homeSections, ...seasonalSections, ...customSections];

        return mergedSections.sort((a, b) => a.order - b.order);

        /* const userConfig = window.KefinTweaksConfig && window.KefinTweaksConfig.homeScreen;
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
                        jellyfinId: 'latestmedia',
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

        return filteredMerged; */
    }

    async function getDiscoverySections() {
        const settings = getDiscoverySettings();

        if (!settings || settings.enabled === false) {
            LOG('Discovery is disabled');
            return [];
        }

        const page = state.discoveryGroupIndex + 1;

        const filterByDiscoveryPage = (sections) => (sections || []).filter((section) => {
            if (section.pageNumber == null) return true; // native discovery templates
            return Number(section.pageNumber) === page;
        });

        const userHomeScreenConfig = await window.KefinUserHomeScreenConfig.getConfig();
        if (userHomeScreenConfig) {
            return filterByDiscoveryPage(userHomeScreenConfig.enabledDiscoverySections);
        }

        const homeScreenConfig = window.KefinHomeScreen.getConfig();
        
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

        const isInSeasonalPeriod = (startDate, endDate) => {
            const currentDate = new Date();
            const start = new Date(startDate);
            const end = new Date(endDate);
            start.setFullYear(currentDate.getFullYear());
            end.setFullYear(currentDate.getFullYear());
            return currentDate >= start && currentDate <= end;
        };

        const customGroups = homeScreenConfig?.CUSTOM_SECTION_GROUPS
            || window.KefinTweaksConfig?.homeScreenConfig?.CUSTOM_SECTION_GROUPS
            || [];
        const collect = window.KefinHomeScreen?.collectCustomDiscoverySections;
        const customDiscoverySections = typeof collect === 'function'
            ? collect(customGroups, {
                isSectionActive: (s) => s.enabled === true,
                isInSeasonalPeriod
            })
            : [];

        mergedSections.push(...filterByDiscoveryPage(customDiscoverySections));

        // Legacy support: Also check old customSections location
        const legacyCustomSections = window.KefinTweaksConfig?.homeScreen?.customSections || [];
        if (legacyCustomSections.length > 0) {
            legacyCustomSections.forEach(section => {
                if (section.enabled && section.discoveryEnabled) {
                    const legacyPage = section.pageNumber == null ? 1 : Number(section.pageNumber);
                    if (legacyPage !== page) return;
                    const customDedupe = window.sectionHelper?.getDiscoveryState?.()?.renderedDiscoveryIds?.customDiscoverySections;
                    if (customDedupe?.has(section.id)) {
                        return;
                    }
                    mergedSections.push(section);
                    customDedupe?.add(section.id);
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
    function loadUserHomeScreenSections(userDisplayPreferences) {
        try {
            //if (!state.userDisplayPreferences) {
            //    state.userDisplayPreferences = await fetchDisplayPreferences();
            //}

            const customPrefs = userDisplayPreferences?.CustomPrefs || {};
            const kefinHomeScreen = JSON.parse(customPrefs.kefinHomeScreen || '[]');

            return kefinHomeScreen;

            /* // Create a homesectionN : order value mapping for the custom CSS orders to be applied
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
                if (homeSection.toLowerCase() === 'continuewatchingandnextup' && state.kefinNextUp && state.kefinContinueWatching) {
                    continue;
                }
                if (homeSection.toLowerCase() === 'latestmedia' && state.kefinLatestMedia) {
                    continue;
                }

                // Match to homeSection in kefinHomeScreen with .toLowerCase() id
                let kefinHomeScreenSection = kefinHomeScreen.find(s => s.id.toLowerCase() === homeSection.toLowerCase() && s.enabled === true);

                if (!kefinHomeScreenSection) {
                    // Check if it's "latestmedia"
                    if (homeSection.toLowerCase() === 'latestmedia' && !state.kefinLatestMedia) {
                        kefinHomeScreenSection = kefinHomeScreen.find(s => s.id.toLowerCase().startsWith('recently-added') && s.enabled === true);
                    }
                }

                if (kefinHomeScreenSection) {
                    jellyfinOrders[`homesection${i}`] = kefinHomeScreenSection.order;
                }
            }

            state.jellyfinOrders = jellyfinOrders;

            addUserHomeScreenOrderCSS(jellyfinOrders); 

            return kefinHomeScreen; */
            
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
    function addUserHomeScreenOrderCSS(userDisplayPreferences, homeScreen = null) {
        const customPrefs = userDisplayPreferences?.CustomPrefs || {};
        const parsedHomeScreen = homeScreen || window.KefinUserHomeScreenConfig.parseKefinTweaksHomeScreen(customPrefs);
        const kefinHomeScreen = window.KefinUserHomeScreenConfig.homeScreenToLegacyArray(parsedHomeScreen);

        // Create a homesectionN : order value mapping for the custom CSS orders to be applied
        const jellyfinOrders = {};
        for (let i = 0; i <= 8; i++) {
            const homeSection = customPrefs[`homesection${i}`];

            if (!homeSection) {
                continue;
            }

            // Match to homeSection in kefinHomeScreen with .toLowerCase() id
            let kefinHomeScreenSection = kefinHomeScreen.find(s => s.id.toLowerCase() === homeSection.toLowerCase() && s.enabled === true);

            if (!kefinHomeScreenSection) {
                // Check if it's "latestmedia"
                if (homeSection.toLowerCase() === 'latestmedia' && !state.kefinLatestMedia) {
                    kefinHomeScreenSection = kefinHomeScreen.find(s => s.id.toLowerCase().startsWith('recently-added') && s.enabled === true);
                }
            }

            if (kefinHomeScreenSection) {
                jellyfinOrders[`homesection${i}`] = kefinHomeScreenSection.order;
            } else {
                jellyfinOrders[`homesection${i}`] = 999;
            }
        }        
        
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
            if (jellyfinOrders[homesectionKey] && isNaN(jellyfinOrders[homesectionKey])) {
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

        // Check if children with [data-section-id] are present
        const children = container.children;
        const hasSections = Array.from(children).some(child => child.dataset && child.dataset.sectionId);
        if (hasSections) {
            LOG('Sections already rendered, skipping');
            return;
        }

        container.dataset.sectionsRendered = 'true';
        applyActiveHomeCategory(homeChromeActiveCategory || 'none');
        syncHomeScreenChromeVisibility();

        const sectionsToRender = [];

        if (useCache && sectionCache.renderedSections.length > 0) {
            LOG('Re-rendering home sections from cache');
            sectionsToRender.push(...sectionCache.renderedSections);
        } else {
            const sortedSections = [...sections].sort((a, b) => {
                const orderA = (a.order !== undefined && a.order !== null) ? a.order : 99;
                const orderB = (b.order !== undefined && b.order !== null) ? b.order : 99;
                return orderA - orderB;
            });
    
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

                if (existingSection) {
                    LOG(`Section already rendered: ${sectionConfig.id}`);
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
            sectionCache.renderedSections = [...sectionsToRender];
        }

        const homeConfig = await window.KefinHomeScreen.getConfig();
        const showStaleDataBeforeRefresh = homeConfig?.HOME_SETTINGS?.showStaleDataBeforeRefresh === true;

        const targetContainer = container;

        const kefinSections = Array.from(children).some(child => child.dataset && child.dataset.sectionId);
        if (kefinSections) {
            LOG('Sections already rendered, skipping');
            return;
        }

        if (!state.isRenderingHome && !kefinSections) {
            const renderStartTime = performance.now();
            state.isRenderingHome = true;

            await window.cardBuilder.renderProgressiveSections(targetContainer, sectionsToRender, {
                waitForContainerClass: 'homeSectionsContainer',
                enhanceOnVisible: true,
                showStaleDataBeforeRefresh
            });

            state.isRenderingHome = false;

            const renderEndTime = performance.now();
            const renderDuration = renderEndTime - renderStartTime;
            LOG(`Home Screen v3 Render progressive sections initialization time: ${renderDuration.toFixed(2)}ms`);
            
            // If MediaBar plugin is in use, call LayoutSync.update() to update the layout
            if (typeof LayoutSync !== 'undefined' && LayoutSync && typeof LayoutSync.update === 'function') {
                LayoutSync.update();
            }

            // Allow deferred library-cache crawls to start (movies/series/people scheduleBootstrap)
            if (!state.homePaintedEventFired) {
                state.homePaintedEventFired = true;
                try {
                    document.dispatchEvent(new CustomEvent('kefinTweaksHomePainted'));
                } catch (_) { /* ignore */ }
            }
    
            // Check if target container is homeSectionsContainer
            if (!targetContainer.classList.contains('homeSectionsContainer')) {
                targetContainer.dataset.sectionsPrerendered = 'true';
            }
        }
    }

    function isRecentlyAddedEnabled() {
        const userConfig = window.KefinTweaksConfig?.homeScreen;
        return userConfig?.recentlyAddedInLibrary && Object.keys(userConfig.recentlyAddedInLibrary).length > 0;
    }

    async function loadSectionForRendering(sectionConfig) {
        return window.sectionHelper.loadSectionForRendering(sectionConfig);
    }

    async function buildDiscoverySectionInstance(template, options = {}) {
        return window.sectionHelper.buildDiscoverySectionInstance(template, options);
    }

    function disconnectDiscoveryInteraction() {
        removeDiscoveryScrollListeners();

        const loadMoreButton = document.querySelector('.libraryPage:not(.hide) .load-more-discovery-btn');
        if (loadMoreButton) {
            loadMoreButton.remove();
        }

        // Remove the discovery loading indicator (exhausted path keeps it via markDiscoveryExhausted)
        if (state.discoverySectionsRemain !== false) {
            const loadingIndicator = document.querySelector('.libraryPage:not(.hide) #discovery-loading-indicator');
            if (loadingIndicator) {
                loadingIndicator.remove();
            }
            setDiscoveryPageAttrs({ ready: false, infinite: false, exhausted: false });
        }

        state.discoveryMode = null;
    }

    /**
     * Ensures discovery buffer is populated (pre-fetches next group)
     */
    async function ensureDiscoveryBuffer() {
        if (!isDiscoveryAllowedForActiveCategory()) {
            LOG('Discovery buffer skipped: active category does not allow discovery');
            return state.discoveryBuffer;
        }
        if (state.ensuringDiscoveryBuffer) {
            LOG('Already ensuring discovery buffer...');

            while (state.ensuringDiscoveryBuffer) {
                LOG('Waiting for discovery buffer to be populated...');
                await new Promise(resolve => setTimeout(resolve, 100));
            }

            return state.discoveryBuffer;
        }
        LOG('Ensuring discovery buffer...');

        state.ensuringDiscoveryBuffer = true;

        try {
            if (state.discoveryBuffer && state.discoveryBuffer.length > 0) {
                LOG('Discovery buffer already exists...');
                return state.discoveryBuffer;
            }

            LOG('Fetching next discovery group data...');

            const groupSections = await generateDiscoveryGroup();

            if (!groupSections || groupSections.length === 0) {
                LOG('No more discovery sections available for buffer.');
                state.discoveryBuffer = [];
                state.discoverySectionsRemain = false;
                return state.discoveryBuffer;
            }

            state.discoveryBuffer = await Promise.all(groupSections.map(async (sectionConfig) => {
                const isDynamic = !!(sectionConfig.discoveryType || sectionConfig.source === 'Dynamic');
                if (isDynamic) {
                    // Sync stub + lazy resolve; do not await ensureData here
                    return window.sectionHelper.buildDiscoverySectionPromise(sectionConfig, {
                        order: sectionConfig.order,
                        pairSpotlight: true
                    });
                }
                return await loadSectionForRendering(sectionConfig);
            }));

            // Filter hard failures only; progressive stubs that later return empty are removed by cardBuilder enhance
            state.discoveryBuffer = state.discoveryBuffer.filter(result => result !== null);

            if (!state.discoveryBuffer.length) {
                state.discoverySectionsRemain = false;
            }

            return state.discoveryBuffer;
        } finally {
            state.ensuringDiscoveryBuffer = false;
        }
    }


    async function setupDiscoveryInteraction(container) {
        const userConfig = getDiscoverySettings();
        
        if (userConfig && userConfig.enabled === false) {
             LOG('Discovery sections disabled in config.');
             state.discoveryEnabled = false;
             return;
        }

        // Ensure at least 1 discovery section is enabled
        const discoverySections = await getDiscoverySections();
        if (!discoverySections || discoverySections.length === 0 || discoverySections.every(section => section.enabled === false)) {
            LOG('No discovery sections enabled in config.');
            state.discoveryEnabled = false;
            return;
        }

        if (!container) {
            WARN('setupDiscoveryInteraction called without a valid container');
            return;
        }

        // getDiscoverySections() above may mark legacy customDiscoverySections; clear only that
        // so generateDiscoveryGroup can claim them without wiping genre/person/similar dedupe.
        window.sectionHelper?.getDiscoveryState?.()?.renderedDiscoveryIds?.customDiscoverySections?.clear?.();
        state.discoverySectionsRemain = true;
        state.discoveryNeedsMoreScroll = false;

        if (PRE_FETCH_DISCOVERY_DATA) {
            ensureDiscoveryBuffer();
        }

        await waitForHomeSectionsContainer(container);

        createDiscoveryLoadingIndicator(container);

        const useInfiniteScroll = userConfig ? (userConfig.infiniteScroll !== false) : true;
        
        if (useInfiniteScroll) {
            state.discoveryMode = 'infinite';
            setDiscoveryPageAttrs({ ready: false, infinite: true, exhausted: false });
            setupInfiniteScroll(container);
        } else {
            state.discoveryMode = 'chevron';
            setDiscoveryPageAttrs({ ready: true, infinite: false, exhausted: false });
            setupChevronDiscoverMore(container);
        }
    }

    async function renderNextDiscoveryGroup() {
        const container = document.querySelector('.libraryPage:not(.hide) .homeSectionsContainer');
        if (!container) return;

        if (!isDiscoveryAllowedForActiveCategory()) {
            LOG('Discovery render skipped: active category does not allow discovery');
            return;
        }

        // Single-flight: set synchronously before any await
        if (state.isRenderingDiscovery) return;
        if (state.discoverySectionsRemain === false) return;

        state.isRenderingDiscovery = true;
        // Require another user scroll before auto-loading the next group (infinite mode)
        state.discoveryNeedsMoreScroll = true;
        container.dataset.loadingDiscovery = 'true';
        container.classList.add('loading-discovery');
        showDiscoveryLoadingIndicator();

        // Chevron mode: nudge scroll so newly appended sections start entering the viewport
        if (state.discoveryMode === 'chevron') {
            window.scrollBy({ top: 100, behavior: 'smooth' });
        }

        try {
            await new Promise(resolve => requestAnimationFrame(resolve));
            await new Promise(resolve => setTimeout(resolve, 0));

            await ensureDiscoveryBuffer();
            
            let bufferedSections = state.discoveryBuffer;
            
            if (!bufferedSections || bufferedSections.length === 0) {
                LOG('No more discovery sections available.');
                markDiscoveryExhausted();
                return;
            }

            // Stable append: honor pre-assigned section.order after parallel loads
            bufferedSections = bufferedSections.slice().sort((a, b) => {
                const ao = Number(a?.config?.order);
                const bo = Number(b?.config?.order);
                return (Number.isFinite(ao) ? ao : 0) - (Number.isFinite(bo) ? bo : 0);
            });

            LOG(`Rendering Discovery Group ${state.discoveryGroupIndex + 1} (${bufferedSections.length} sections)...`);

            const config = await window.KefinHomeScreen.getConfig();
            const revealSectionsSequentially = config.DISCOVERY_SETTINGS?.fadeInSections === true;
            await window.cardBuilder.renderProgressiveSections(container, bufferedSections, {
                revealSectionsSequentially,
                enhanceOnVisible: true,
                showStaleDataBeforeRefresh: config.HOME_SETTINGS?.showStaleDataBeforeRefresh === true
            });

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
            if (state.discoverySectionsRemain !== false) {
                hideDiscoveryLoadingIndicator();
                container.dataset.loadingDiscovery = 'false';
                container.classList.remove('loading-discovery');
            }
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
        
        let discoveryTemplates = await getDiscoverySections();
        
        if (getDiscoverySettings().randomizeOrder) {
            discoveryTemplates = [...discoveryTemplates].sort(() => 0.5 - Math.random());
        }
        
        // Collect enabled templates unresolved — progressive resolve happens in ensureDiscoveryBuffer
        for (const template of discoveryTemplates) {
            if (template.enabled === false) continue;
            selectedConfigs.push(template);
        }

        if (getDiscoverySettings().renderSpotlightAboveMatching) {
            const spotlightGenreSection = selectedConfigs.find((section) => {
                const id = section.id.split('-')[0];
                return id === 'spotlightGenre' || id === 'spotlightGenreSeries';
            });
            const spotlightNetworkSection = selectedConfigs.find(section => section.id.split('-')[0] === 'spotlightNetwork');

            if (spotlightGenreSection) {
                const spotlightBaseId = spotlightGenreSection.id.split('-')[0];
                const genreBaseId = spotlightBaseId === 'spotlightGenreSeries' ? 'genreSeries' : 'genreMovies';
                const genreSection = selectedConfigs.find(section => section.id.split('-')[0] === genreBaseId);
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

        // Apply user prefs keyed by template prefix for non-custom discovery variants
        try {
            const userHomeConfig = window.KefinUserHomeScreenConfig;
            if (userHomeConfig?.applyUserSectionOverrides && selectedConfigs.length) {
                const prefs = state.getDisplayPrefernces
                    ? await state.getDisplayPrefernces()
                    : null;
                const homeScreen = userHomeConfig.parseKefinTweaksHomeScreen?.(prefs?.CustomPrefs)
                    || userHomeConfig.createEmptyHomeScreen?.()
                    || { sections: [] };
                const serverSectionsById = new Map();
                selectedConfigs.forEach((section) => {
                    const storedId = userHomeConfig.getStoredSectionPrefId?.(section) || section.id;
                    if (storedId && !serverSectionsById.has(storedId)) {
                        serverSectionsById.set(storedId, { ...section, id: storedId });
                    }
                });
                const overridden = userHomeConfig.applyUserSectionOverrides(
                    selectedConfigs,
                    homeScreen,
                    { serverSectionsById }
                );
                selectedConfigs.length = 0;
                selectedConfigs.push(...overridden.filter(s => s.enabled !== false));
            }
        } catch (e) {
            WARN('Failed to apply user overrides to discovery sections:', e);
        }

        selectedConfigs.forEach((section) => {
            section.order = state.discoverySectionOrder++;
            // Mark discovery render set so section roots get data-discovery-section
            // (templated discovery rows use Genre/Studio/etc. as type, not "discovery").
            section.discoverySection = true;
        });

        //localCache.set('discoveryBuffer', selectedConfigs);

        return selectedConfigs;
    }

    function setupInfiniteScroll(container) {
        const target = container
            || document.querySelector('.libraryPage:not(.hide) .homeSectionsContainer');
        if (!target) return;

        removeDiscoveryScrollListeners();
        target.dataset.discoveryHandler = 'true';

        let lastScrollTop = window.pageYOffset || document.documentElement.scrollTop || 0;

        const handleScroll = () => {
            if (!isDiscoveryHomeContext()) return;
            if (!target.dataset.sectionsRendered) return;
            if (state.isRenderingDiscovery) return;
            if (state.discoverySectionsRemain === false) return;

            const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
            const delta = Math.abs(scrollTop - lastScrollTop);
            lastScrollTop = scrollTop;

            // After a group loads, ignore threshold until the user scrolls again
            if (state.discoveryNeedsMoreScroll) {
                if (delta < 2) return;
                state.discoveryNeedsMoreScroll = false;
            }

            const windowHeight = window.innerHeight;
            const documentHeight = document.documentElement.scrollHeight;
            const threshold = windowHeight * 1.5;

            if (scrollTop + windowHeight < documentHeight - threshold) return;

            if (state.discoveryScrollDebounceTimer) {
                clearTimeout(state.discoveryScrollDebounceTimer);
            }
            state.discoveryScrollDebounceTimer = setTimeout(() => {
                state.discoveryScrollDebounceTimer = null;
                if (state.isRenderingDiscovery || state.discoveryNeedsMoreScroll) return;
                if (!isDiscoveryHomeContext()) return;
                const st = window.pageYOffset || document.documentElement.scrollTop;
                const wh = window.innerHeight;
                const dh = document.documentElement.scrollHeight;
                if (st + wh >= dh - wh * 1.5) {
                    renderNextDiscoveryGroup();
                }
            }, 200);
        };

        state.infiniteScrollHandler = handleScroll;
        window.addEventListener('scroll', handleScroll, { passive: true });
        LOG('Infinite scroll enabled for discovery (debounced + scroll-gated re-arm).');
    }

    /**
     * infiniteScroll=false: Discover More + chevron; load when user scrolls again at bottom.
     */
    function setupChevronDiscoverMore(container) {
        const target = container
            || document.querySelector('.libraryPage:not(.hide) .homeSectionsContainer');
        if (!target) return;

        removeDiscoveryScrollListeners();
        target.dataset.discoveryHandler = 'true';
        createDiscoveryLoadingIndicator(target);
        hideDiscoveryLoadingIndicator();

        let lastTouchY = null;

        const scheduleLoadFromBottomGesture = () => {
            if (state.isRenderingDiscovery) return;
            if (state.discoverySectionsRemain === false) return;
            if (state.discoveryScrollDebounceTimer) {
                clearTimeout(state.discoveryScrollDebounceTimer);
            }
            state.discoveryScrollDebounceTimer = setTimeout(() => {
                state.discoveryScrollDebounceTimer = null;
                if (state.isRenderingDiscovery) return;
                if (!isDiscoveryHomeContext()) return;
                LOG('User scrolled at bottom (chevron mode); loading next discovery group...');
                renderNextDiscoveryGroup();
            }, 200);
        };

        const isAtDocumentBottom = () => {
            const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
            const windowHeight = window.innerHeight;
            const documentHeight = document.documentElement.scrollHeight;
            return scrollTop + windowHeight >= documentHeight - 2;
        };

        const handleWheel = (event) => {
            if (!isDiscoveryHomeContext()) return;
            if (!target.dataset.sectionsRendered) return;
            if (state.isRenderingDiscovery) return;
            if (event.deltaY <= 0) return;
            if (!isAtDocumentBottom()) return;
            scheduleLoadFromBottomGesture();
        };

        const handleTouchStart = (event) => {
            const touch = event.touches && event.touches[0];
            lastTouchY = touch ? touch.clientY : null;
        };

        const handleTouchMove = (event) => {
            if (!isDiscoveryHomeContext()) return;
            if (!target.dataset.sectionsRendered) return;
            if (state.isRenderingDiscovery) return;

            const touch = event.touches && event.touches[0];
            if (!touch) return;

            if (lastTouchY == null) {
                lastTouchY = touch.clientY;
                return;
            }

            const deltaY = touch.clientY - lastTouchY;
            lastTouchY = touch.clientY;

            // Upward swipe scrolls content down
            if (deltaY >= 0) return;
            if (!isAtDocumentBottom()) return;
            scheduleLoadFromBottomGesture();
        };

        state.discoveryWheelHandler = handleWheel;
        state.discoveryTouchStartHandler = handleTouchStart;
        state.discoveryTouchMoveHandler = handleTouchMove;
        window.addEventListener('wheel', handleWheel, { passive: true });
        window.addEventListener('touchstart', handleTouchStart, { passive: true });
        window.addEventListener('touchmove', handleTouchMove, { passive: true });
        LOG('Chevron Discover More enabled for discovery (scroll-again at bottom).');
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

    async function getPopularTVNetworks() {
        if (!StudiosCache) return [];

        // Get Minimum Series Count from config
        
        await StudiosCache.init();
        return StudiosCache.getPopularTVNetworks();
    }

    async function refreshHomeSections() {
        const container = document.querySelector('.homePage:not(.hide) #homeTab .sections');
        if (!container) {
            LOG('refreshHomeSections: container not found');
            return;
        }

        container.querySelectorAll('[data-section-id]').forEach(el => el.remove());
        delete container.dataset.sectionsRendered;
        delete container.dataset.kefinHomeScreen;

        sectionCache.renderedSections = [];
        sectionCache.fragmentCache = null;
        sectionCache.isInitialRender = true;

        await enhanceHomeScreen();
    }

    const HOME_CHROME_CREATE_ID = 'kefin-home-create-section-btn';
    const HOME_CHROME_CATEGORY_RAIL_ID = 'kefin-home-category-rail';
    const HOME_CHROME_CATEGORY_STYLE_ID = 'kefin-home-category-filter-styles';
    const HOME_CHROME_CLASSIC_RAIL_CLASSES = 'skinHeader skinHeader-withBackground emby-tab-button';
    let homeChromeActiveCategory = 'none';
    let homeChromeCreateMounted = false;
    let homeChromeCategoryMounted = false;
    let homeChromeHasPinnedContent = false;
    let homeChromeVisibilityObserver = null;
    let homeChromeMuiAppBarObserver = null;

    function getHomeSettings() {
        return window.KefinTweaksConfig?.homeScreenConfig?.HOME_SETTINGS
            || window.KefinHomeConfig2?.HOME_SETTINGS
            || {};
    }

    function getConfiguredCategories() {
        const defaults = window.KefinHomeConfig2?.HOME_SETTINGS?.categories || [];
        const configured = getHomeSettings().categories;
        if (Array.isArray(configured) && configured.length) return configured;
        return defaults;
    }

    function sectionIsPinnedCategory(section) {
        const id = String(section?.id || '');
        return id.startsWith('pinned-list-')
            || id.startsWith('pinned-parent-')
            || section?.category === 'pinned';
    }

    function updatePinnedCategoryAvailability(sections, homeScreen) {
        const userHomeConfig = window.KefinUserHomeScreenConfig;
        const fromUserPins = (userHomeConfig?.buildPinnedSectionConfigs?.(homeScreen) || []).length > 0;
        const fromSections = (sections || []).some(sectionIsPinnedCategory);
        homeChromeHasPinnedContent = fromUserPins || fromSections;
    }

    function getRailCategories() {
        return getConfiguredCategories().filter((cat) => {
            if (cat?.id === 'pinned') return homeChromeHasPinnedContent;
            return true;
        });
    }

    function isModernUIChrome() {
        return document.querySelector('.MuiBox-root') !== null || localStorage.getItem('layout')?.length === 0;
    }

    function getCategoryRailNativeClasses() {
        const base = 'kefin-home-chrome kefin-home-category-rail';
        if (isModernUIChrome()) {
            let appBar = document.querySelector('.MuiAppBar-root');       

            if (appBar?.className) {
                return `${base} ${appBar.className}`;
            }
        }
        return `${base} ${HOME_CHROME_CLASSIC_RAIL_CLASSES}`;
    }

    function ensureMuiAppBarClassObserver() {
        if (!isModernUIChrome() || homeChromeMuiAppBarObserver) return;
        if (document.querySelector('.MuiAppBar-root')) return;
        homeChromeMuiAppBarObserver = new MutationObserver(() => {
            if (!document.querySelector('.MuiAppBar-root')) return;
            try { homeChromeMuiAppBarObserver?.disconnect(); } catch (_) { /* ignore */ }
            homeChromeMuiAppBarObserver = null;
            const inner = document.querySelector(`#${HOME_CHROME_CATEGORY_RAIL_ID} .kefin-home-category-rail`);
            if (inner) inner.className = getCategoryRailNativeClasses();
        });
        homeChromeMuiAppBarObserver.observe(document.body, { childList: true, subtree: true });
    }

    function isHomePageVisible() {
        return !!document.querySelector('.homePage:not(.hide)');
    }

    function syncHomeScreenChromeVisibility() {
        const onHome = isHomePageVisible();
        const createBtn = document.getElementById(HOME_CHROME_CREATE_ID);
        if (createBtn) {
            createBtn.hidden = !onHome;
            createBtn.setAttribute('aria-hidden', onHome ? 'false' : 'true');
        }
        const showFilters = getHomeSettings().showCategoryFilters !== false;
        const rail = document.getElementById(HOME_CHROME_CATEGORY_RAIL_ID);
        if (rail) {
            const visible = onHome && showFilters;
            rail.hidden = !visible;
            rail.setAttribute('aria-hidden', visible ? 'false' : 'true');
        }
        if (onHome) {
            applyActiveHomeCategory(homeChromeActiveCategory || 'none');
        }
    }

    function ensureHomeChromeVisibilityObserver() {
        if (homeChromeVisibilityObserver) return;
        homeChromeVisibilityObserver = new MutationObserver(() => syncHomeScreenChromeVisibility());
        homeChromeVisibilityObserver.observe(document.body, {
            childList: true,
            subtree: true,
            attributes: true,
            attributeFilter: ['class']
        });
    }

    async function mountCreateSectionButton() {
        if (homeChromeCreateMounted || document.getElementById(HOME_CHROME_CREATE_ID)) {
            homeChromeCreateMounted = true;
            return;
        }
        if (getHomeSettings().showCreateSectionButtonOnHome !== true) return;
        try {
            const isAdmin = !!(await window.apiHelper?.isAdmin?.());
            if (!isAdmin) return;
        } catch {
            return;
        }

        const wrap = document.createElement('div');
        wrap.id = HOME_CHROME_CREATE_ID;
        wrap.className = 'kefin-home-chrome kefin-home-create-section';
        wrap.hidden = !isHomePageVisible();
        wrap.innerHTML = `
            <button type="button" class="paper-icon-button-light emby-button kefin-home-create-section-btn" title="Create Section" aria-label="Create Section">
                <span class="material-icons" aria-hidden="true">add_circle</span>
            </button>
        `;
        wrap.querySelector('button')?.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            try {
                window.KefinHomeScreen?.openNewCustomSection?.({ refreshHomeOnSave: true });
            } catch (err) {
                ERR('Failed to open create section from home:', err);
            }
        });
        document.body.appendChild(wrap);
        homeChromeCreateMounted = true;
    }

    function buildCategoryFilterStyles(categories) {
        const rules = [];
        rules.push(`
.homeSectionsContainer[data-render-categories-separately="true"][data-category="none"] > [data-section-id]:not([data-category="none"]) {
    display: none !important;
}
`);
        (categories || []).forEach((cat) => {
            const id = String(cat?.id || '').trim();
            if (!id || id === 'none') return;
            const safe = CSS.escape(id);
            rules.push(`
.homeSectionsContainer[data-category="${safe}"] > [data-section-id]:not([data-category="${safe}"]) {
    display: none !important;
}
`);
        });
        return rules.join('\n');
    }

    function ensureCategoryFilterStyles() {
        let styleEl = document.getElementById(HOME_CHROME_CATEGORY_STYLE_ID);
        if (!styleEl) {
            styleEl = document.createElement('style');
            styleEl.id = HOME_CHROME_CATEGORY_STYLE_ID;
            document.head.appendChild(styleEl);
        }
        styleEl.textContent = buildCategoryFilterStyles(getConfiguredCategories());
    }

    function applyActiveHomeCategory(categoryId) {
        const categories = getRailCategories();
        const next = categories.some((c) => c.id === categoryId) ? categoryId : 'none';
        const prev = homeChromeActiveCategory || 'none';
        homeChromeActiveCategory = next;
        const separate = getHomeSettings().renderCategoriesSeparately === true;

        document.querySelectorAll('.homeSectionsContainer').forEach((container) => {
            container.dataset.category = next;
            container.dataset.renderCategoriesSeparately = separate ? 'true' : 'false';
        });

        const rail = document.getElementById(HOME_CHROME_CATEGORY_RAIL_ID);
        if (rail) {
            rail.querySelectorAll('.kefin-home-category-btn').forEach((btn) => {
                const active = btn.dataset.categoryId === next;
                btn.classList.toggle('is-active', active);
                btn.setAttribute('aria-pressed', active ? 'true' : 'false');
            });
        }

        if (next === 'discovery' && prev !== 'discovery' && isDiscoveryAllowedForActiveCategory()) {
            const container = document.querySelector('.libraryPage:not(.hide) .homeSectionsContainer, .homePage:not(.hide) .homeSectionsContainer');
            if (container) {
                const hasDiscovery = !!(
                    container.querySelector('[data-discovery-section="true"], [data-category="discovery"]')
                );
                if (!hasDiscovery) {
                    try {
                        renderNextDiscoveryGroup();
                    } catch (err) {
                        ERR('Failed to bootstrap discovery group for Discover category:', err);
                    }
                }
            }
        }
    }

    function isDiscoveryAllowedForActiveCategory() {
        const separate = getHomeSettings().renderCategoriesSeparately === true;
        const active = homeChromeActiveCategory || 'none';
        if (separate) return active === 'discovery';
        return active === 'none' || active === 'discovery';
    }

    function mountCategoryRail() {
        if (getHomeSettings().showCategoryFilters === false) {
            const existing = document.getElementById(HOME_CHROME_CATEGORY_RAIL_ID);
            if (existing) existing.remove();
            homeChromeCategoryMounted = false;
            ensureCategoryFilterStyles();
            homeChromeActiveCategory = 'none';
            applyActiveHomeCategory('none');
            return;
        }

        if (homeChromeCategoryMounted && document.getElementById(HOME_CHROME_CATEGORY_RAIL_ID)) {
            ensureCategoryFilterStyles();
            applyActiveHomeCategory(homeChromeActiveCategory || 'none');
            return;
        }

        const categories = getRailCategories();
        ensureCategoryFilterStyles();

        const desiredCategory = categories.some((c) => c.id === homeChromeActiveCategory)
            ? homeChromeActiveCategory
            : 'none';

        const outer = document.createElement('div');
        outer.id = HOME_CHROME_CATEGORY_RAIL_ID;
        outer.className = 'sectionTabs';
        outer.hidden = !isHomePageVisible();
        outer.setAttribute('role', 'toolbar');
        outer.setAttribute('aria-label', 'Home categories');
        outer.setAttribute('aria-hidden', outer.hidden ? 'true' : 'false');

        const inner = document.createElement('div');
        inner.className = getCategoryRailNativeClasses();
        inner.innerHTML = categories.map((cat) => {
            const id = escapeHtmlChrome(cat.id);
            const name = escapeHtmlChrome(cat.name || cat.id);
            const icon = escapeHtmlChrome(cat.icon || 'label');
            const active = desiredCategory === cat.id;
            return `
                <button type="button"
                    class="paper-icon-button-light emby-button kefin-home-category-btn${active ? ' is-active' : ''}"
                    data-category-id="${id}"
                    title="${name}"
                    aria-label="${name}"
                    aria-pressed="${active ? 'true' : 'false'}">
                    <span class="material-icons" aria-hidden="true">${icon}</span>
                </button>
            `;
        }).join('');

        outer.appendChild(inner);
        outer.addEventListener('click', (e) => {
            const btn = e.target.closest('.kefin-home-category-btn');
            if (!btn) return;
            e.preventDefault();
            e.stopPropagation();
            applyActiveHomeCategory(btn.dataset.categoryId || 'none');
        });

        document.body.appendChild(outer);
        homeChromeCategoryMounted = true;
        ensureMuiAppBarClassObserver();
        applyActiveHomeCategory(desiredCategory);
    }

    function refreshHomeCategoryChrome() {
        ensureCategoryFilterStyles();
        const rail = document.getElementById(HOME_CHROME_CATEGORY_RAIL_ID);
        if (rail) rail.remove();
        homeChromeCategoryMounted = false;
        mountCategoryRail();
        syncHomeScreenChromeVisibility();
    }

    function escapeHtmlChrome(value) {
        return String(value ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    async function initHomeScreenChrome() {
        ensureHomeChromeVisibilityObserver();
        await mountCreateSectionButton();
        mountCategoryRail();
        syncHomeScreenChromeVisibility();
    }

    window.homeScreen3 = {
        init: enhanceHomeScreen,
        refreshHomeSections,
        resolveDiscoverySection: buildDiscoverySectionInstance,
        sectionHelper: () => window.sectionHelper,
        getActiveHomeCategory: () => homeChromeActiveCategory || 'none',
        isDiscoveryAllowedForActiveCategory,
        refreshHomeCategoryChrome
    };

    //enhanceHomeScreen();
    connectHomeSectionsReadyObserver();
    //initHomeScreenChrome();

    if (window.KefinTweaksUtils && typeof window.KefinTweaksUtils.onViewPage === 'function') {
        window.KefinTweaksUtils.onViewPage((view, element, hash) => {
            // Get selected tab from hash
            const hashParams = hash.includes('?') ? hash.split('?')[1] :     '';
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
                syncHomeScreenChromeVisibility();
            } catch (err) { ERR('Home screen page change handler failed:', err); }
        }, { pages: ['home', 'home.html'] });
    }

    /* if (window.KefinTweaksUtils && typeof window.KefinTweaksUtils.onViewPage === 'function') {
        window.KefinTweaksUtils.onViewPage(manageBodyClasses, { pages: [] });
    } */

})();

