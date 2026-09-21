// KefinTweaks Enhanced Search
// Enhanced search functionality with better UI and Jellyseerr integration
// Requires: cardBuilder.js, utils.js modules to be loaded before this script

(function() {
    'use strict';
    const LOG = (...args) => console.log('[KefinTweaks Search]', ...args);
    const WARN = (...args) => console.warn('[KefinTweaks Search]', ...args);
    const ERR = (...args) => console.error('[KefinTweaks Search]', ...args);
    
    LOG('Initializing...');

/*     const originalOpen = XMLHttpRequest.prototype.open;
    const originalSend = XMLHttpRequest.prototype.send;

    XMLHttpRequest.prototype.open = function (method, url, ...args) {
        this.__url = url;
        return originalOpen.apply(this, [method, url, ...args]);
    };

    XMLHttpRequest.prototype.send = function (...args) {
        const url = this.__url || '';
        const isSearchPage = location.hash.startsWith('#/search');

        const isBlockedSearch =
            isSearchPage &&
            url.includes('/Items?') &&
            url.includes('searchTerm=');

        if (!isBlockedSearch) {
            return originalSend.apply(this, args);
        }

        LOG('Blocking default Jellyfin search request:', url);
        Dashboard.hideLoadingMsg();

        // Async success without touching internal state
        queueMicrotask(() => {
            this.onload?.();
            this.onreadystatechange?.();
        });
    }; */

    // Configuration
    const CONFIG = window.KefinTweaksConfig?.search || {
        enableJellyseerr: false  // Toggle for Jellyseerr integration
    };

    // config
    const CORE_TYPES = ['Movie', 'Series', 'Episode', 'Person'];
    const MUSIC_TYPES = ['MusicAlbum', 'Audio', 'MusicArtist', 'MusicVideo'];
    const BOOKS_TYPES = ['Book', 'AudioBook'];
    const OTHER_TYPES = ['Playlist', 'Photo', 'PhotoAlbum', 'LiveTvChannel', 'LiveTvProgram', 'TvChannel', 'TvProgram', 'BoxSet'];
    const SEARCH_CACHE_TTL = 60000;
    const SEARCH_ITEM_FIELDS = 'PrimaryImageAspectRatio,DateCreated,ProductionYear,RecursiveItemCount,ChildCount,ProviderIds,MediaSourceCount';

    // Live UI search type for stale-paint guards (`videos` maps to internal `core`)
    let activeSearchType = 'videos';

    function toInternalSearchType(uiOrInternalType) {
        if (!uiOrInternalType || uiOrInternalType === 'videos') return 'core';
        return uiOrInternalType;
    }

    function getLiveSearchTerm() {
        return (document.getElementById('searchTextInput')?.value || '').trim();
    }

    /** True when this run's term+type still match what the user has selected. */
    function isSearchStillWanted(term, searchType) {
        const liveTerm = getLiveSearchTerm();
        if (!term || !liveTerm || term !== liveTerm) return false;
        return toInternalSearchType(searchType) === toInternalSearchType(activeSearchType);
    }

    // Function to clear search results except jellyseerr-section
    function clearSearchResultsExceptJellyseerr() {
        LOG('Clearing search results except jellyseerr-section');
        
        // Clear the smart search results container
        const resultsContainer = document.getElementById('smart-search-results');
        if (resultsContainer) {
            resultsContainer.innerHTML = '';
        }
    }

    function getTypeGroups(searchType) {
        if (searchType === 'music') return MUSIC_TYPES;
        if (searchType === 'books') return BOOKS_TYPES;
        if (searchType === 'all') return [...CORE_TYPES, ...MUSIC_TYPES, ...BOOKS_TYPES, ...OTHER_TYPES];
        return CORE_TYPES;
    }

    function postProcessSearchItems(itemType, data) {
        const items = Array.isArray(data)
            ? data.slice()
            : (Array.isArray(data?.Items) ? data.Items.slice() : []);
        if (!items.length) return items;

        if (itemType === 'MusicArtist') {
            return items.sort((a, b) => {
                const aIsFolder = a.IsFolder ? 1 : 0;
                const bIsFolder = b.IsFolder ? 1 : 0;
                return bIsFolder - aIsFolder;
            });
        }

        return items.sort((a, b) => {
            const aHasImage = a.ImageTags?.Primary ? 1 : 0;
            const bHasImage = b.ImageTags?.Primary ? 1 : 0;
            return bHasImage - aHasImage;
        });
    }

    function buildSearchQueryDef(itemType, searchTerm) {
        const term = searchTerm.trim();
        if (itemType === 'MusicArtist') {
            return {
                path: '/Artists',
                queryOptions: {
                    Limit: 100,
                    SearchTerm: term,
                    Fields: 'PrimaryImageAspectRatio',
                    ImageTypeLimit: 1,
                    EnableTotalRecordCount: false
                }
            };
        }
        if (itemType === 'Person') {
            return {
                path: '/Persons',
                queryOptions: {
                    Limit: 100,
                    SearchTerm: term,
                    Fields: 'PrimaryImageAspectRatio',
                    ImageTypeLimit: 1,
                    EnableTotalRecordCount: false
                }
            };
        }
        return {
            queryOptions: {
                SearchTerm: term,
                IncludeItemTypes: itemType,
                Recursive: true,
                Limit: 100,
                Fields: SEARCH_ITEM_FIELDS,
                ImageTypeLimit: 1,
                EnableTotalRecordCount: false
            }
        };
    }

    async function buildSearchSection(itemType, searchTerm, order) {
        const apiHelper = window.apiHelper;
        if (!apiHelper?.getQuery || !apiHelper?.buildQueryFromSection) {
            throw new Error('apiHelper.getQuery / buildQueryFromSection unavailable');
        }

        const userId = ApiClient.getCurrentUserId();
        const serverUrl = ApiClient.serverAddress();
        const query = buildSearchQueryDef(itemType, searchTerm);
        const url = apiHelper.buildQueryFromSection(query, userId, serverUrl);
        if (typeof url !== 'string') {
            throw new Error(`Invalid search query URL for ${itemType}`);
        }

        const queryResult = await apiHelper.getQuery(url, {
            useCache: true,
            ttl: SEARCH_CACHE_TTL
        });

        const termKey = searchTerm.toLowerCase().trim().replace(/[^a-z0-9]+/gi, '-').slice(0, 48);
        const sectionConfig = {
            id: `search-${itemType}-${termKey}`,
            name: getTypeDisplayName(itemType),
            enabled: true,
            order,
            queries: [query],
            ttl: SEARCH_CACHE_TTL,
            userConfigurable: false
        };

        let mappedDataPromise = null;
        const ensureData = () => {
            if (!mappedDataPromise) {
                const raw = typeof queryResult.ensureData === 'function'
                    ? queryResult.ensureData()
                    : queryResult.dataPromise;
                mappedDataPromise = Promise.resolve(raw)
                    .then((data) => postProcessSearchItems(itemType, data))
                    .catch((err) => {
                        WARN('search ensureData failed for', itemType, err);
                        return [];
                    });
            }
            return mappedDataPromise;
        };

        const result = {
            data: postProcessSearchItems(itemType, queryResult.data),
            isStale: queryResult.isStale === true,
            isStalePromise: queryResult.isStalePromise,
            ensureData
        };
        Object.defineProperty(result, 'dataPromise', {
            configurable: true,
            enumerable: true,
            get() {
                return ensureData();
            }
        });

        return { config: sectionConfig, result };
    }

    // styles (dedupe by id)
    function addCustomStyles() {
        if (document.getElementById('smart-search-styles')) return;
        LOG('adding styles');
        const style = document.createElement('style');
        style.id = 'smart-search-styles';
        style.textContent = `
            .smart-search-input { width:100%; padding:8px; border-radius:4px; box-sizing:border-box; }
            .smart-search-buttons { display:flex; gap:8px; margin-top:8px; flex-wrap:wrap; justify-content: center; }
            .smart-search-btn { padding:8px 12px; border:none; border-radius:4px; cursor:pointer; background:#444; color:#fff; }
            .smart-search-results { margin-top:12px; }
            .smart-search-stats { color:#999; font-size:12px; margin-top:6px; display: none; }
            #persistent-toggle-btn { display:none; position:relative; padding:8px 12px; background:#00a4dc; color:#fff; border:none; border-radius:4px; cursor:pointer; }
            .smart-search-mode .searchfields-icon {
                top: 50%;
                transform: translateY(-50%);
                position: absolute;
                z-index: 1;
                right: 0;
                cursor: pointer;
                font-size: 2em;
            }
        `;
        document.head.appendChild(style);
    }

    // update search URL helper
    function updateSearchUrl(searchTerm, searchType = 'videos') {
        try {
            // Jellyfin uses hash-based routing, so we need to update the hash
            const urlSuffix = ApiClient._appVersion.split('.')[1] > 10 ? '' : '.html';
            const baseHash = `#/search${urlSuffix}`;
            const params = new URLSearchParams();
            const trimmed = searchTerm.trim();
            
            if (trimmed) {
                params.set('query', trimmed);
            }
            params.set('type', searchType);
            const newHash = `${baseHash}?${params.toString()}`;
            window.history.replaceState({}, '', window.location.pathname + newHash);
            LOG('Updated search URL hash:', newHash);
        } catch (e) {
            ERR('updateSearchUrl error', e);
        }
    }

    function getTypeDisplayName(itemType) {
        const typeMap = {
            'Movie': 'Movies',
            'Series': 'TV Shows',
            'Episode': 'Episodes',
            'Person': 'People',
            'MusicAlbum': 'Albums',
            'Audio': 'Songs',
            'MusicArtist': 'Artists',
            'MusicVideo': 'Music Videos',
            'Playlist': 'Playlists',
            'Book': 'Books',
            'AudioBook': 'Audiobooks',
            'Photo': 'Photos',
            'PhotoAlbum': 'Photo Albums',
            'TvChannel': 'TV Channels',
            'TvProgram': 'TV Programs',
            'LiveTvChannel': 'Live TV Channels',
            'LiveTvProgram': 'Live TV',
            'BoxSet': 'Collections'
        };
        return typeMap[itemType] || itemType;
    }

    // Create smart search results container lazily when needed
    function ensureSmartResultsContainer() {
        let smartResults = document.getElementById('smart-search-results');
        if (!smartResults) {
            LOG('Creating smart-search-results container');
            smartResults = document.createElement('div');
            smartResults.id = 'smart-search-results';
            smartResults.className = 'smart-search-results emby-scroller searchResults, padded-top, padded-bottom-page';
            const searchPage = document.getElementById('searchPage');
            if (searchPage) {
                searchPage.appendChild(smartResults);
            } else {
                // Fallback to body if #searchPage not found
                document.body.appendChild(smartResults);
            }
        }
        return smartResults;
    }

    // perform smart search via progressive sections (Request/Jellyseerr stays separate)
    async function performSmartSearch(searchTerm, searchType = 'core') {
        LOG('performSmartSearch()', { searchTerm, searchType });

        const searchPage = document.getElementById('searchPage');
        if (!searchPage) {
            ERR('searchPage not found');
            return;
        }

        const trimmed = (searchTerm || '').trim();
        const internalType = toInternalSearchType(searchType);
        const resultsContainer = ensureSmartResultsContainer();

        // Hide search suggestions while searching
        const searchSuggestions = searchPage.querySelector('.searchSuggestions');
        if (searchSuggestions) {
            searchSuggestions.style.display = trimmed ? 'none' : 'block';
        }

        let noItemsMessage = searchPage.querySelector('.noItemsMessage.dummy-section');
        if (!noItemsMessage) {
            noItemsMessage = document.createElement('div');
            noItemsMessage.className = 'noItemsMessage dummy-section';
            noItemsMessage.style.display = 'none';
            searchPage.appendChild(noItemsMessage);
        }

        // Update URL with search query and type
        const urlType = internalType === 'core' ? 'videos' : internalType;
        updateSearchUrl(trimmed, urlType);

        // Handle Jellyseerr-only search
        if (internalType === 'request' || searchType === 'request') {
            return;
        }

        if (!trimmed) {
            resultsContainer.innerHTML = '';
            return;
        }

        // Drop previous results as soon as a new search is committed
        resultsContainer.innerHTML = '';

        if (!window.cardBuilder?.renderProgressiveSections) {
            ERR('cardBuilder.renderProgressiveSections unavailable');
            return;
        }

        if (!isSearchStillWanted(trimmed, internalType)) {
            LOG('Skipping search; UI already changed', { trimmed, internalType });
            return;
        }

        try {
            const typeGroups = getTypeGroups(internalType);
            const sectionPromises = typeGroups.map((itemType, index) =>
                buildSearchSection(itemType, trimmed, index).catch((err) => {
                    WARN('Failed to build search section for', itemType, err);
                    return null;
                })
            );

            // Resolve section setup (cache lookup / getQuery shell) before paint
            const sections = await Promise.all(sectionPromises);
            if (!isSearchStillWanted(trimmed, internalType)) {
                LOG('Skipping stale search render after fetch', { trimmed, internalType });
                return;
            }

            const validSections = sections.filter(Boolean).map((section) => Promise.resolve(section));
            if (!isSearchStillWanted(trimmed, internalType)) {
                LOG('Skipping stale search paint', { trimmed, internalType });
                return;
            }

            resultsContainer.innerHTML = '';
            await window.cardBuilder.renderProgressiveSections(resultsContainer, validSections, {
                showStaleDataBeforeRefresh: true
            });

            if (!isSearchStillWanted(trimmed, internalType)) {
                LOG('Search superseded after paint; leaving newer owner in charge', { trimmed, internalType });
                // Empty clear owns the DOM — remove anything this run may have painted
                if (!getLiveSearchTerm()) {
                    resultsContainer.innerHTML = '';
                }
            }
        } catch (e) {
            ERR('performSmartSearch error', e);
        }
    }

    // main init
    async function initSmartSearch() {
        if (typeof ApiClient === 'undefined') { setTimeout(initSmartSearch, 500); return; }

        const originalInput = document.getElementById('searchTextInput');
        if (!originalInput) { setTimeout(initSmartSearch, 500); return; }

        addCustomStyles();

        // Handle URL query parameter on page load
        // Parse query from hash since Jellyfin uses hash-based routing
        let queryFromUrl = null;
        if (window.location.hash.includes('#/search') && window.location.hash.includes('query=')) {
            const hashQuery = window.location.hash.split('query=')[1];
            if (hashQuery) {
                queryFromUrl = hashQuery.split('&')[0]; // Get query before any other params
                queryFromUrl = decodeURIComponent(queryFromUrl).replace(/\+/g, ' ');
            }
        }
        LOG('initSmartSearch - URL query:', queryFromUrl);
        LOG('initSmartSearch - originalInput exists:', !!originalInput);
        if (originalInput) {
            LOG('initSmartSearch - originalInput value:', originalInput.value);
        }
        
        if (queryFromUrl) {
            LOG('initSmartSearch - URL query detected, leaving input alone');
        }

        // Replace original search input with our smart search input
        let wrapper = document.getElementById('smart-search-wrapper');
        if (!wrapper) {
            wrapper = document.createElement('div');
            wrapper.id = 'smart-search-wrapper';
            wrapper.className = 'smart-search-wrapper';

            // Create the search icon element
            const searchIcon = document.createElement('span');
            searchIcon.className = 'searchfields-icon material-icons search';
            searchIcon.setAttribute('aria-hidden', 'true');

            // Replace the original input with our smart search input
            const input = originalInput.cloneNode(true);
            input.id = 'searchTextInput'; // Use the same ID as original
            input.className = 'smart-search-input emby-input searchfields-txtSearch';
            input.type = 'text';
            input.placeholder = 'Search...';
            input.value = ''; // Clear any existing value
            input.removeAttribute('data-jellyseerr-listener');

            const btnRow = document.createElement('div');
            btnRow.className = 'smart-search-buttons';

            const smartSearchButtonClass = 'smart-search-btn emby-button flat';
            const btnAll = document.createElement('button');
            btnAll.id = 'smart-search-all';
            btnAll.className = smartSearchButtonClass;
            btnAll.textContent = 'All';
            const btnCore = document.createElement('button');
            btnCore.id = 'smart-search-core';
            btnCore.className = smartSearchButtonClass + ' button-submit active';
            btnCore.textContent = 'Movies/TV';
            const btnMusic = document.createElement('button');
            btnMusic.id = 'smart-search-music';
            btnMusic.className = smartSearchButtonClass;
            btnMusic.textContent = 'Music';
            const btnBooks = document.createElement('button');
            btnBooks.id = 'smart-search-books';
            btnBooks.className = smartSearchButtonClass;
            btnBooks.textContent = 'Books';

            const libraries = await window.dataHelper.getLibraries();

            const hasVideoLibraries = libraries.some(library => library.CollectionType === 'movies' || library.CollectionType === 'tvshows' || library.CollectionType === 'homevideos');
            const hasMusicLibraries = libraries.some(library => library.CollectionType === 'music' || library.CollectionType === 'musicvideos');
            const hasBookLibraries = libraries.some(library => library.CollectionType === 'books');

            btnRow.appendChild(btnAll);
            
            if (hasVideoLibraries) {
                btnRow.appendChild(btnCore);
            }
            if (hasMusicLibraries) {
                btnRow.appendChild(btnMusic);
            }
            if (hasBookLibraries) {
                btnRow.appendChild(btnBooks);
            }
            
            if (CONFIG.enableJellyseerr) {
                const btnRequest = document.createElement('button');
                btnRequest.id = 'smart-search-request';
                btnRequest.className = smartSearchButtonClass;
                btnRequest.textContent = 'Request';
    
                btnRow.appendChild(btnRequest);
            }

            const stats = document.createElement('div');
            stats.id = 'smart-search-stats';
            stats.className = 'smart-search-stats';

            // Create input wrapper
            const inputWrapper = document.createElement('div');
            inputWrapper.className = 'input-wrapper';

            inputWrapper.appendChild(searchIcon);
            inputWrapper.appendChild(input);

            wrapper.appendChild(inputWrapper);
            wrapper.appendChild(btnRow);
            wrapper.appendChild(stats);

            // Insert the wrapper before the original input
            originalInput.parentElement.insertBefore(wrapper, originalInput);
            originalInput.remove();
            input.focus();
        }

        // Smart results container will be created lazily when needed

        const smartInput = document.getElementById('searchTextInput');
        const smartCoreBtn = document.getElementById('smart-search-core');
        const smartMusicBtn = document.getElementById('smart-search-music');
        const smartBooksBtn = document.getElementById('smart-search-books');
        const smartAllBtn = document.getElementById('smart-search-all');
        const smartRequestBtn = document.getElementById('smart-search-request');
        
        // Track current search type
        let currentSearchType = 'videos';

        // Function to update button states
        function updateButtonStates(activeType) {
            // Remove active class from all buttons
            smartAllBtn.classList.remove('active','button-submit');
            smartCoreBtn.classList.remove('active','button-submit');
            smartMusicBtn.classList.remove('active','button-submit');
            smartBooksBtn.classList.remove('active','button-submit');

            if (smartRequestBtn) {
                smartRequestBtn.classList.remove('active','button-submit');
            }
            
            // Add active class to the selected button
            if (activeType === 'all') {
                smartAllBtn.classList.add('active','button-submit');
            } else if (activeType === 'videos') {
                smartCoreBtn.classList.add('active','button-submit');
            } else if (activeType === 'music') {
                smartMusicBtn.classList.add('active','button-submit');
            } else if (activeType === 'books') {
                smartBooksBtn.classList.add('active','button-submit');
            } else if (activeType === 'request' && smartRequestBtn) {
                smartRequestBtn.classList.add('active','button-submit');
            }
        }


        // Function to handle search type toggle
        function setSearchType(type) {
            LOG('setSearchType called:', { type, currentSearchType });
            currentSearchType = type;
            activeSearchType = type;
            updateButtonStates(type);

            const searchTerm = smartInput.value.trim();
            LOG('Search term from input:', searchTerm);
            if (!searchTerm) return;

            const internalType = toInternalSearchType(type);
            LOG('Internal type mapping:', { type, internalType });

            if (type === 'request') {
                LOG('Request type - clearing results and performing fresh Jellyseerr search');
                clearSearchResultsExceptJellyseerr();
                performSmartSearch(searchTerm, 'request');
                return;
            }

            performSmartSearch(searchTerm, internalType);
        }

        if (!wrapper.dataset.initialized) {
            wrapper.dataset.initialized = 'true';
            let timer = null;
            const doSmartSearchDebounced = () => {
                if (timer) clearTimeout(timer);
                const term = (smartInput.value || '').trim();
                if (!term) {
                    timer = null;
                    const resultsContainer = ensureSmartResultsContainer();
                    resultsContainer.innerHTML = '';
                    updateSearchUrl('', currentSearchType);

                    // Show search suggestions
                    const searchSuggestions = document.querySelector('.searchSuggestions');
                    if (searchSuggestions) {
                        searchSuggestions.style.display = 'block';
                    }

                    return;
                }
                const internalType = toInternalSearchType(currentSearchType);
                timer = setTimeout(() => performSmartSearch(term, internalType), 300);
            };

            smartInput.addEventListener('input', doSmartSearchDebounced);
            smartInput.addEventListener('keydown', (e)=>{ 
                if(e.key==='Enter'){ 
                    e.preventDefault(); 
                    if (timer) clearTimeout(timer);
                    const internalType = toInternalSearchType(currentSearchType);
                    performSmartSearch((smartInput.value||'').trim(), internalType); 
                }
            });
            smartCoreBtn?.addEventListener('click', ()=>setSearchType('videos'));
            smartMusicBtn?.addEventListener('click', ()=>setSearchType('music'));
            smartBooksBtn?.addEventListener('click', ()=>setSearchType('books'));
            smartAllBtn.addEventListener('click', ()=>setSearchType('all'));
            if (smartRequestBtn) {
                smartRequestBtn.addEventListener('click', ()=>setSearchType('request'));
            }

            // Parse type parameter from URL
            let typeFromUrl = 'videos'; // default
            if (window.location.hash.includes('type=')) {
                const typeMatch = window.location.hash.match(/type=([^&]+)/);
                if (typeMatch) {
                    typeFromUrl = typeMatch[1];
                }
            }
            
            // Set initial search type and update UI
            currentSearchType = typeFromUrl;
            activeSearchType = typeFromUrl;
            updateButtonStates(typeFromUrl);
            
            // Handle URL query parameter - populate smart search and trigger search
            if (queryFromUrl) {
                smartInput.value = queryFromUrl;
                // Trigger immediate search with the URL query
                const internalType = toInternalSearchType(typeFromUrl);
                performSmartSearch(queryFromUrl, internalType);
            }
        }

        // persistent toggle button
        let toggleBtn = document.getElementById('persistent-toggle-btn');
        if (!toggleBtn) {
            toggleBtn = document.createElement('button');
            toggleBtn.id = 'persistent-toggle-btn';
            toggleBtn.textContent = 'Switch to Default Search';
            const searchFields = document.querySelector('.searchFields');
            if (searchFields) {
                searchFields.appendChild(toggleBtn);
            } else {
                // Fallback to body if .searchFields not found
                document.body.appendChild(toggleBtn);
            }
        }

        let smartMode = true;
        const setMode = (isSmart) => {
            smartMode = isSmart;
            LOG('setMode', smartMode);
            if (smartMode) {
                wrapper.style.display = '';
                // Hide search results containers (be more specific to avoid affecting other pages)
                const searchResults = document.querySelectorAll('#searchPage .searchResults, #searchPage .padded-top, #searchPage .padded-bottom-page');
                searchResults.forEach(sr => sr.style.display = 'none');
                const resultsContainer = ensureSmartResultsContainer();
                resultsContainer.style.display = '';
                toggleBtn.textContent='Switch to Default Search';
                // Add smart-search-mode class to body for CSS targeting
                document.body.classList.add('smart-search-mode');
            } else {
                wrapper.style.display = 'none';
                // Show search results containers (be more specific to avoid affecting other pages)
                const searchResults = document.querySelectorAll('#searchPage .searchResults, #searchPage .padded-top, #searchPage .padded-bottom-page');
                searchResults.forEach(sr => sr.style.display = '');
                const resultsContainer = ensureSmartResultsContainer();
                resultsContainer.style.display = 'none';
                toggleBtn.textContent='Switch to Smart Search';
                // Remove smart-search-mode class from body
                document.body.classList.remove('smart-search-mode');
                
                // Note: We don't restore the original input since we replaced it entirely
            }
        };

        toggleBtn.addEventListener('click', ()=>setMode(!smartMode));

        // initial mode
        setMode(true);
    }

    // Initialize search hook using utils
    function initializeSearchHook() {
        if (!window.KefinTweaksUtils) {
            WARN('KefinTweaksUtils not available, retrying in 1 second');
            setTimeout(initializeSearchHook, 1000);
            return;
        }
        
        LOG('Registering search page handler with KefinTweaksUtils');
        
        // Register handler for search page
        window.KefinTweaksUtils.onViewPage((view, element) => {
            LOG('Search page detected via utils');
            // Small delay to ensure DOM is ready
            setTimeout(() => {
                const searchInput = document.getElementById('searchTextInput');
                if (searchInput && !document.getElementById('smart-search-wrapper')) {
                    LOG('Search input found, initializing smart search');
                    initSmartSearch();
                }
            }, 100);
        }, {
            pages: ['search']
        });
        
        LOG('Search hook initialized successfully');
    }

    // Initialize the hook when the script loads
    //initializeSearchHook();
    
    if (document.readyState==='loading') { 
        document.addEventListener('DOMContentLoaded', () => {
            initializeSearchHook();
        }); 
    } else { 
        initializeSearchHook(); 
    }
    LOG('Initialized successfully');
})();
