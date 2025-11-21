// KefinTweaks Enhanced Search
// Enhanced search functionality with better UI and Jellyseerr integration
// Requires: cardBuilder.js, utils.js modules to be loaded before this script

(function() {
    'use strict';
    const LOG = (...args) => console.log('[KefinTweaks Search]', ...args);
    const WARN = (...args) => console.warn('[KefinTweaks Search]', ...args);
    const ERR = (...args) => console.error('[KefinTweaks Search]', ...args);
    
    LOG('Initializing...');

    // Configuration
    const CONFIG = window.KefinTweaksConfig?.search || {
        enableJellyseerr: false  // Toggle for Jellyseerr integration
    };
    
    // Override XHR to block automatic search requests from direct URL navigation
    const OriginalXHR = window.XMLHttpRequest;
    window.XMLHttpRequest = function() {
        const xhr = new OriginalXHR();
        const originalOpen = xhr.open;
        const originalSend = xhr.send;
        
        xhr.open = function(method, url, ...args) {            
            // Check if this is a search request we want to block
            const isSearchRequest = url.includes('/Items?') && 
                                  (url.includes('searchTerm=') || url.includes('query='));

            const isSearchPage = window.location.hash.includes('#/search');
            
            if (isSearchRequest && isSearchPage) {
                LOG('Blocking default Jellyfin search request:', url);
                
                // Override send to do nothing
                xhr.send = function() {
                    // Simulate a successful response
                    setTimeout(() => {
                        // Use Object.defineProperty to override read-only properties
                        Object.defineProperty(xhr, 'readyState', {
                            value: 4,
                            writable: true,
                            configurable: true
                        });
                        Object.defineProperty(xhr, 'status', {
                            value: 200,
                            writable: true,
                            configurable: true
                        });
                        Object.defineProperty(xhr, 'responseText', {
                            value: '{"Items":[],"TotalRecordCount":0}',
                            writable: true,
                            configurable: true
                        });
                        
                        // Trigger the event handlers
                        if (xhr.onreadystatechange) {
                            xhr.onreadystatechange();
                        }
                        if (xhr.onload) {
                            xhr.onload();
                        }
                    }, 100);
                };
            } else {
                // Use original send for non-blocked requests
                xhr.send = function(...args) {
                    return originalSend.apply(this, args);
                };
            }
            
            return originalOpen.apply(this, [method, url, ...args]);
        };
        
        return xhr;
    };

    // config
    const CORE_TYPES = ['Movie', 'Series', 'Episode', 'Person'];
    const MUSIC_TYPES = ['MusicAlbum', 'Audio', 'MusicArtist', 'MusicVideo'];
    const BOOKS_TYPES = ['Book', 'AudioBook'];
    const OTHER_TYPES = ['Playlist', 'Photo', 'PhotoAlbum', 'LiveTvChannel', 'LiveTvProgram', 'TvChannel', 'TvProgram', 'BoxSet'];

    // Cache for search results by search term and type
    const searchCache = new Map();

    // Function to generate cache key
    function getCacheKey(searchTerm, searchType) {
        return `${searchTerm.toLowerCase().trim()}_${searchType}`;
    }

    // Function to check cache and return cached results if available
    function getCachedResults(searchTerm, searchType) {
        const cacheKey = getCacheKey(searchTerm, searchType);
        const cached = searchCache.get(cacheKey);
        LOG('Cache check:', { searchTerm, searchType, cacheKey, cached: !!cached });
        return cached;
    }

    // Function to cache results
    function cacheResults(searchTerm, searchType, results) {
        const cacheKey = getCacheKey(searchTerm, searchType);
        searchCache.set(cacheKey, results);
        LOG('Cached results:', { searchTerm, searchType, cacheKey, resultCount: results.total });
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

    // styles (dedupe by id)
    function addCustomStyles() {
        if (document.getElementById('smart-search-styles')) return;
        LOG('adding styles');
        const style = document.createElement('style');
        style.id = 'smart-search-styles';
        style.textContent = `
            .smart-search-wrapper { margin: 20px 0; }
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

    // build URL helper
    function buildSearchUrl(searchTerm, itemTypes, additionalParams = {}) {
        try {
            const userId = ApiClient.getCurrentUserId();
            const baseUrl = ApiClient.serverAddress();
            const params = new URLSearchParams({
                userId,
                limit: '100',
                recursive: 'true',
                searchTerm: searchTerm.trim(),
                fields: 'PrimaryImageAspectRatio,CanDelete',
                imageTypeLimit: '1',
                enableTotalRecordCount: 'false',
                ...additionalParams
            });
            itemTypes.forEach(t => params.append('includeItemTypes', t));
            const url = `${baseUrl}/Items?${params.toString()}`;
            LOG('buildSearchUrl ->', url);
            return url;
        } catch (e) {
            ERR('buildSearchUrl error', e);
            throw e;
        }
    }

    // perform smart search
    async function performSmartSearch(searchTerm, searchType = 'core') {
        LOG('performSmartSearch()', { searchTerm, searchType });
        let results = { groupedItems: {}, total: 0 };

        const searchPage = document.getElementById('searchPage');
        if (!searchPage) {
            ERR('searchPage not found');
            return results;
        }
        
        // Hide search suggestions
        const searchSuggestions = searchPage.querySelector('.searchSuggestions');
        if (searchSuggestions) {
            searchSuggestions.remove();
        }

        const noItemsMessage = searchPage.querySelector('.noItemsMessage.dummy-section');
        if (!noItemsMessage) {
            const noItemsMessage = document.createElement('div');
            noItemsMessage.className = 'noItemsMessage dummy-section';
            noItemsMessage.style.display = 'none';
            searchPage.appendChild(noItemsMessage);
        }
            
        // Update URL with search query and type
        const urlType = searchType === 'core' ? 'videos' : searchType;
        updateSearchUrl(searchTerm, urlType);
        
        // Handle Jellyseerr-only search
        if (searchType === 'request') {
            return results;
        }
        
        // Show loading spinner
        Dashboard.showLoadingMsg();
        
        try {
            const typeGroups = searchType === 'music'
                ? MUSIC_TYPES
                : (searchType === 'books' 
                    ? BOOKS_TYPES 
                    : (searchType === 'all' ? [...CORE_TYPES, ...MUSIC_TYPES, ...BOOKS_TYPES, ...OTHER_TYPES] : CORE_TYPES));

            const promises = typeGroups.map(type => {
                let url;
                const userId = ApiClient.getCurrentUserId();
                const baseUrl = ApiClient.serverAddress();
                if (type === 'MusicArtist') {
                    // Use dedicated Artists endpoint for better results
                    url = `${baseUrl}/Artists?limit=100&searchTerm=${encodeURIComponent(searchTerm)}&fields=PrimaryImageAspectRatio&fields=CanDelete&imageTypeLimit=1&userId=${userId}&enableTotalRecordCount=false`;
                } else if (type === 'Person') {
                    url = `${baseUrl}/Persons?limit=100&searchTerm=${encodeURIComponent(searchTerm)}&fields=PrimaryImageAspectRatio&fields=CanDelete&&imageTypeLimit=1&userId=${userId}&enableTotalRecordCount=false`;
                } else {
                    url = buildSearchUrl(searchTerm, [type]);
                }
                
                return ApiClient.fetch({ url, method: 'GET' })
                    .then(resp => resp.json())
                    .catch(err => {
                        WARN('fetch failed for', type, err);
                        return { Items: [] };
                    });
            });

            const start = performance.now();
            const responses = await Promise.all(promises);
            const end = performance.now();

            // Group results by type
            responses.forEach(async (r, idx) => {
                if (idx < typeGroups.length) {
                    // Regular Jellyfin results
                    const type = typeGroups[idx];
                    if (r && r.Items && r.Items.length > 0) {
                        // For Artists, use all items (they often don't have primary images)
                        // For other types, filter to show only those with images
                        let filteredItems;
                        if (type === 'MusicArtist') {
                            // Artists: show all items, they often don't have primary images
                            // Instead, sort the artists by IsFolder
                            filteredItems = r.Items.sort((a, b) => {
                                const aIsFolder = a.IsFolder ? 1 : 0;
                                const bIsFolder = b.IsFolder ? 1 : 0;
                                return bIsFolder - aIsFolder;
                            });
                        } else {
                            // Other types: sort so items with images appear first
                            filteredItems = r.Items.sort((a, b) => {
                                const aHasImage = a.ImageTags?.Primary ? 1 : 0;
                                const bHasImage = b.ImageTags?.Primary ? 1 : 0;
                                return bHasImage - aHasImage; // Items with images first
                            });
                        }
                        
                        results.groupedItems[type] = filteredItems;
                        results.total += filteredItems.length;
                    }
                }
            });

            displaySmartResults(results, Math.round(end - start));
            
            // Cache the results
            cacheResults(searchTerm, searchType, results);
            
            return results;
        } catch (e) {
            ERR('performSmartSearch error', e);
            return results;
        } finally {            
            // Hide loading spinner
            Dashboard.hideLoadingMsg()
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
            'Playlist': 'Playlists',
            'Book': 'Books',
            'AudioBook': 'Audiobooks',
            'Photo': 'Photos',
            'PhotoAlbum': 'Photo Albums',
            'TvChannel': 'TV Channels',
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

    function displaySmartResults(results, ms) {
        const resultsContainer = ensureSmartResultsContainer();
        const stats = document.getElementById('smart-search-stats');

        if (!stats) return;

        resultsContainer.innerHTML = '';
        
        // Check if we have any grouped results
        if (!results.groupedItems || Object.keys(results.groupedItems).length === 0) {
            resultsContainer.innerHTML = '<p style="color:#999;text-align:center;">No results found</p>';
            stats.textContent = `Search completed in ${ms}ms - 0 results`;
            return;
        }

        // Create sections for each item type that has results
        const frag = document.createDocumentFragment();
        let totalShown = 0;
        
        // Add hidden dummy section for testing/placeholder
        const dummySection = document.createElement('div');
        dummySection.className = 'verticalSection emby-scroller-container';
        dummySection.style.display = 'none'; // Hidden dummy section
        dummySection.setAttribute('data-dummy', 'true');
        
        const dummyTitle = document.createElement('h2');
        dummyTitle.className = 'sectionTitle sectionTitle-cards focuscontainer-x padded-left padded-right';
        dummyTitle.textContent = 'Hidden Dummy Section';
        dummySection.appendChild(dummyTitle);
        
        frag.appendChild(dummySection);
        
        // Define the order to display sections
        const sectionOrder = ['Movie', 'Series', 'Episode', 'Person', 'MusicArtist', 'MusicAlbum', 'Audio', 'Book', 'AudioBook', 'Photo', 'PhotoAlbum', 'BoxSet', 'Playlist', 'TvChannel', 'TvProgram', 'LiveTvChannel', 'LiveTvProgram'];
        
        sectionOrder.forEach((itemType) => {
            if (results.groupedItems[itemType] && results.groupedItems[itemType].length > 0) {
                const items = results.groupedItems[itemType];
                const title = getTypeDisplayName(itemType);
                const section = window.cardBuilder.renderCards(items, title, null);
                frag.appendChild(section);
                totalShown += items.length;
            }
        });

        resultsContainer.appendChild(frag);
        stats.textContent = `Search completed in ${ms}ms - ${results.total} results found`;
    }

    // main init
    function initSmartSearch() {
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

            const btnAll = document.createElement('button');
            btnAll.id = 'smart-search-all';
            btnAll.className = 'smart-search-btn emby-button';
            btnAll.textContent = 'All';
            const btnCore = document.createElement('button');
            btnCore.id = 'smart-search-core';
            btnCore.className = 'smart-search-btn emby-button raised button-submit active';
            btnCore.textContent = 'Movies/TV';
            const btnMusic = document.createElement('button');
            btnMusic.id = 'smart-search-music';
            btnMusic.className = 'smart-search-btn emby-button';
            btnMusic.textContent = 'Music';
            const btnBooks = document.createElement('button');
            btnBooks.id = 'smart-search-books';
            btnBooks.className = 'smart-search-btn emby-button';
            btnBooks.textContent = 'Books';

            btnRow.appendChild(btnAll);
            btnRow.appendChild(btnCore);
            btnRow.appendChild(btnMusic);
            btnRow.appendChild(btnBooks);
            
            if (CONFIG.enableJellyseerr) {
                const btnRequest = document.createElement('button');
                btnRequest.id = 'smart-search-request';
                btnRequest.className = 'smart-search-btn emby-button';
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

            // Replace the original input with our wrapper
            originalInput.parentElement.insertBefore(wrapper, originalInput);
            originalInput.remove(); // Remove the original input
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
            smartAllBtn.classList.remove('active','button-submit','raised');
            smartCoreBtn.classList.remove('active','button-submit','raised');
            smartMusicBtn.classList.remove('active','button-submit','raised');
            smartBooksBtn.classList.remove('active','button-submit','raised');

            if (smartRequestBtn) {
                smartRequestBtn.classList.remove('active','button-submit','raised');
            }
            
            // Add active class to the selected button
            if (activeType === 'all') {
                smartAllBtn.classList.add('active','button-submit','raised');
            } else if (activeType === 'videos') {
                smartCoreBtn.classList.add('active','button-submit','raised');
            } else if (activeType === 'music') {
                smartMusicBtn.classList.add('active','button-submit','raised');
            } else if (activeType === 'books') {
                smartBooksBtn.classList.add('active','button-submit','raised');
            } else if (activeType === 'request' && smartRequestBtn) {
                smartRequestBtn.classList.add('active','button-submit','raised');
            }
        }


        // Function to handle search type toggle
        function setSearchType(type) {
            LOG('setSearchType called:', { type, currentSearchType });
            currentSearchType = type;
            updateButtonStates(type);
            
            // If there's a search term, check cache first
            const searchTerm = smartInput.value.trim();
            LOG('Search term from input:', searchTerm);
            if (searchTerm) {
                // Map URL type to internal type
                const internalType = type === 'videos' ? 'core' : type;
                LOG('Internal type mapping:', { type, internalType });
                
                // For request type, don't use cache and always perform fresh search
                if (type === 'request') {
                    LOG('Request type - clearing results and performing fresh Jellyseerr search');
                    // Clear existing search results except jellyseerr-section
                    clearSearchResultsExceptJellyseerr();
                    performSmartSearch(searchTerm, 'request');
                    return;
                }
                
                // Check if we have cached results for this search term and type
                const cachedResults = getCachedResults(searchTerm, internalType);
                if (cachedResults) {
                    LOG('Using cached results for', searchTerm, internalType);
                    displaySmartResults(cachedResults, 0); // 0ms since it's cached
                    
                    // Update URL with search query and type even for cached results
                    const urlType = type === 'videos' ? 'videos' : type;
                    updateSearchUrl(searchTerm, urlType);
                    return;
                }
                
                // No cache hit, perform new search
                LOG('No cache hit, performing new search');
                performSmartSearch(searchTerm, internalType);
            }
        }

        if (!wrapper.dataset.initialized) {
            wrapper.dataset.initialized = 'true';
            let timer = null;
            const doSmartSearchDebounced = () => {
                const term = (smartInput.value || '').trim();
                if (!term) { 
                    const resultsContainer = ensureSmartResultsContainer();
                    resultsContainer.innerHTML='';
                    Dashboard.hideLoadingMsg();
                    return; 
                }
                if (timer) clearTimeout(timer);
                const internalType = currentSearchType === 'videos' ? 'core' : currentSearchType;
                timer = setTimeout(() => performSmartSearch(term, internalType), 300);
            };

            smartInput.addEventListener('input', doSmartSearchDebounced);
            smartInput.addEventListener('keydown', (e)=>{ 
                if(e.key==='Enter'){ 
                    e.preventDefault(); 
                    const internalType = currentSearchType === 'videos' ? 'core' : currentSearchType;
                    performSmartSearch((smartInput.value||'').trim(), internalType); 
                }
            });
            smartCoreBtn.addEventListener('click', ()=>setSearchType('videos'));
            smartMusicBtn.addEventListener('click', ()=>setSearchType('music'));
            smartBooksBtn.addEventListener('click', ()=>setSearchType('books'));
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
            updateButtonStates(typeFromUrl);
            
            // Handle URL query parameter - populate smart search and trigger search
            if (queryFromUrl) {
                smartInput.value = queryFromUrl;
                // Trigger immediate search with the URL query
                const internalType = typeFromUrl === 'videos' ? 'core' : typeFromUrl;
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
