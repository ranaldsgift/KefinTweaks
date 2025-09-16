// Jellyfin Smart Search - Dual Input + Persistent Toggle + Query Copy
(function() {
    'use strict';
    const LOG = (...args) => console.log('[SmartSearch]', ...args);
    const WARN = (...args) => console.warn('[SmartSearch]', ...args);
    const ERR = (...args) => console.error('[SmartSearch]', ...args);

    // Configuration
    const CONFIG = {
        enableJellyseerr: false, // Toggle for Jellyseerr integration
    };

    LOG('script load start');

    // Monitor network requests to see what's happening
    const originalFetch = window.fetch;
    const originalXHR = window.XMLHttpRequest;
    
    // Track if we should block XHR requests (only for the initial URL query)
    let shouldBlockXHR = false;
    let hasBlockedInitialSearch = false;
    
    // Override fetch to log our requests
    window.fetch = function(...args) {
        LOG('FETCH request:', args[0]);
        return originalFetch.apply(this, args);
    };
    
    // Override XHR to log and potentially block default search requests
    const OriginalXHR = window.XMLHttpRequest;
    window.XMLHttpRequest = function() {
        const xhr = new OriginalXHR();
        const originalOpen = xhr.open;
        const originalSend = xhr.send;
        
        xhr.open = function(method, url, ...args) {
            LOG('XHR request:', method, url);
            
            // Check if this is a search request we want to block
            // Our smart search uses fetch(), so any XHR search request should be blocked
            const isSearchRequest = url.includes('/Items?') && 
                                  (url.includes('searchTerm=') || url.includes('query='));
            
            if (isSearchRequest && shouldBlockXHR && !hasBlockedInitialSearch) {
                LOG('Blocking initial default search XHR request:', url);
                hasBlockedInitialSearch = true;
                // Disable blocking after this first request
                shouldBlockXHR = false;
                LOG('XHR blocking disabled after initial search');
                
                // Override send to do nothing
                xhr.send = function() {
                    LOG('Initial default search XHR blocked');
                    // Simulate a successful response
                    setTimeout(() => {
                        xhr.readyState = 4;
                        xhr.status = 200;
                        xhr.responseText = '{"Items":[],"TotalRecordCount":0}';
                        if (xhr.onreadystatechange) {
                            xhr.onreadystatechange();
                        }
                    }, 100);
                };
            }
            
            return originalOpen.apply(this, [method, url, ...args]);
        };
        
        xhr.send = function(...args) {
            LOG('XHR sending:', args);
            return originalSend.apply(this, args);
        };
        
        return xhr;
    };

    // Immediate interception for URL queries - run this as early as possible
    (function() {
        // Parse query from hash since Jellyfin uses hash-based routing
        let queryFromUrl = null;
        if (window.location.hash.includes('search.html') && window.location.hash.includes('query=')) {
            const hashQuery = window.location.hash.split('query=')[1];
            if (hashQuery) {
                queryFromUrl = hashQuery.split('&')[0]; // Get query before any other params
            }
        }
        
        LOG('Early interception - URL query:', queryFromUrl);
        LOG('Current pathname:', window.location.pathname);
        LOG('Current hash:', window.location.hash);
        
        if (queryFromUrl && (window.location.pathname.includes('search.html') || window.location.hash.includes('search'))) {
            LOG('URL query detected, setting up protection');
            shouldBlockXHR = true; // Enable XHR blocking for initial URL query
            
            // Just enable XHR blocking - don't touch the input
            LOG('XHR blocking enabled for initial search');
        }
    })();

    // config
    const CORE_TYPES = ['Movie', 'Series', 'Episode', 'Person'];
    const MUSIC_TYPES = ['MusicAlbum', 'Audio', 'Artist'];
    const BOOKS_TYPES = ['Book', 'AudioBook'];
    const OTHER_TYPES = ['Playlist', 'Photo', 'PhotoAlbum', 'TvChannel', 'LiveTvProgram', 'BoxSet'];

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

    // styles (dedupe by id)
    function addCustomStyles() {
        if (document.getElementById('smart-search-styles')) return;
        LOG('adding styles');
        const style = document.createElement('style');
        style.id = 'smart-search-styles';
        style.textContent = `
            .smart-search-wrapper { margin: 12px 0 20px 0; }
            .smart-search-input { width:100%; padding:8px; border-radius:4px; box-sizing:border-box; }
            .smart-search-buttons { display:flex; gap:8px; margin-top:8px; flex-wrap:wrap; justify-content: center; }
            .smart-search-primary, .smart-search-secondary { padding:8px 12px; border:none; border-radius:4px; cursor:pointer; }
            .smart-search-primary { background:#00a4dc; color:#fff; }
            .smart-search-secondary { background:#444; color:#fff; }
            .smart-search-results { margin-top:12px; }
            .smart-search-stats { color:#999; font-size:12px; margin-top:6px; display: none; }
            #persistent-toggle-btn { display:none; position:relative; padding:8px 12px; background:#00a4dc; color:#fff; border:none; border-radius:4px; cursor:pointer; }
            
            /* Smart search mode - hide search icon */
            .smart-search-mode .searchfields-icon {
                top: 37px;
                position: absolute;
                z-index: 1;
                right: 0;
            }
        `;
        document.head.appendChild(style);
    }

    // update search URL helper
    function updateSearchUrl(searchTerm, searchType = 'videos') {
        try {
            // Jellyfin uses hash-based routing, so we need to update the hash
            const baseHash = '#/search.html';
            const params = new URLSearchParams();
            
            if (searchTerm && searchTerm.trim()) {
                params.set('query', searchTerm.trim());
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
                searchTerm,
                fields: 'PrimaryImageAspectRatio,CanDelete,MediaSourceCount',
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

    // Show/hide loading spinner
    function setLoadingSpinner(show) {
        const spinner = document.querySelector('.docspinner.mdl-spinner');
        if (spinner) {
            if (show) {
                spinner.classList.add('mdlSpinnerActive');
                LOG('Loading spinner shown');
            } else {
                spinner.classList.remove('mdlSpinnerActive');
                LOG('Loading spinner hidden');
            }
        }
    }

    // Fetch Jellyseerr results
    async function fetchJellyseerrResults(searchTerm) {
        try {
            const jellyseerrUrl = `${ApiClient.serverAddress()}/JellyfinEnhanced/jellyseerr/search?query=${encodeURIComponent(searchTerm)}`;
            LOG('Fetching Jellyseerr results:', jellyseerrUrl);
            
            const response = await ApiClient.fetch({ 
                url: jellyseerrUrl, 
                method: 'GET',
                headers: {
                    'Accept': 'application/json',
                    'X-Jellyfin-User-Id': ApiClient.getCurrentUserId()
                }
            });
            const data = await response.json();
            
            LOG('Jellyseerr response:', data);
            return data;
        } catch (err) {
            WARN('Jellyseerr fetch failed', err);
            return { movies: [], tv: [] };
        }
    }

    // Convert Jellyseerr item to our format
    function convertJellyseerrItem(item, type) {
        return {
            Id: `jellyseerr_${item.id}`,
            Name: item.title || item.name,
            Type: type === 'movie' ? 'Movie' : 'Series',
            MediaType: 'Video',
            ImageTags: item.posterPath ? { Primary: item.posterPath } : null,
            ProductionYear: item.releaseDate ? new Date(item.releaseDate).getFullYear() : null,
            Overview: item.overview,
            // Jellyseerr specific data
            JellyseerrId: item.id,
            JellyseerrType: type,
            ExternalId: item.tmdbId || item.tvdbId,
            IsJellyseerr: true
        };
    }

    // perform smart search
    async function performSmartSearch(searchTerm, searchType = 'core') {
        LOG('performSmartSearch()', { searchTerm, searchType });
        const results = { groupedItems: {}, total: 0 };
        
        // Hide search suggestions
        const searchSuggestions = document.querySelector('.searchSuggestions');
        if (searchSuggestions) {
            searchSuggestions.style.display = 'none';
        }
        
        // Show loading spinner
        setLoadingSpinner(true);
        
        try {
            const typeGroups = searchType === 'music'
                ? MUSIC_TYPES
                : (searchType === 'books' 
                    ? BOOKS_TYPES 
                    : (searchType === 'all' ? [...CORE_TYPES, ...MUSIC_TYPES, ...BOOKS_TYPES, ...OTHER_TYPES] : CORE_TYPES));

            const promises = typeGroups.map(type => {
                let url;
                if (type === 'Artist') {
                    // Use dedicated Artists endpoint for better results
                    const userId = ApiClient.getCurrentUserId();
                    const baseUrl = ApiClient.serverAddress();
                    url = `${baseUrl}/Artists?limit=100&searchTerm=${encodeURIComponent(searchTerm)}&fields=PrimaryImageAspectRatio&fields=CanDelete&fields=MediaSourceCount&imageTypeLimit=1&userId=${userId}&enableTotalRecordCount=false`;
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

            // Add Jellyseerr search for core types (if enabled)
            if (CONFIG.enableJellyseerr && (searchType === 'core' || searchType === 'all')) {
                promises.push(fetchJellyseerrResults(searchTerm));
            } else {
                promises.push(Promise.resolve({ movies: [], tv: [] }));
            }

            const start = performance.now();
            const responses = await Promise.all(promises);
            const end = performance.now();

            // Group results by type
            responses.forEach((r, idx) => {
                if (idx < typeGroups.length) {
                    // Regular Jellyfin results
                    const type = typeGroups[idx];
                    if (r && r.Items && r.Items.length > 0) {
                        // For Artists, use all items (they often don't have primary images)
                        // For other types, filter to show only those with images
                        let filteredItems;
                        if (type === 'Artist') {
                            // Artists: show all items, they often don't have primary images
                            filteredItems = r.Items;
                        } else {
                            // Other types: filter to show only those with images
                            filteredItems = r.Items.filter(item => item.ImageTags?.Primary);
                        }
                        
                        results.groupedItems[type] = filteredItems;
                        results.total += filteredItems.length;
                    }
                } else {
                    // Jellyseerr results
                    if (r && (r.movies || r.tv)) {
                        // Process Jellyseerr movies
                        if (r.movies && r.movies.length > 0) {
                            const jellyseerrMovies = r.movies.map(item => convertJellyseerrItem(item, 'movie'));
                            if (results.groupedItems['Movie']) {
                                results.groupedItems['Movie'] = [...results.groupedItems['Movie'], ...jellyseerrMovies];
                            } else {
                                results.groupedItems['Movie'] = jellyseerrMovies;
                            }
                            results.total += jellyseerrMovies.length;
                        }
                        
                        // Process Jellyseerr TV shows
                        if (r.tv && r.tv.length > 0) {
                            const jellyseerrTv = r.tv.map(item => convertJellyseerrItem(item, 'tv'));
                            if (results.groupedItems['Series']) {
                                results.groupedItems['Series'] = [...results.groupedItems['Series'], ...jellyseerrTv];
                            } else {
                                results.groupedItems['Series'] = jellyseerrTv;
                            }
                            results.total += jellyseerrTv.length;
                        }
                    }
                }
            });

            displaySmartResults(results, Math.round(end - start));
            
            // Cache the results
            cacheResults(searchTerm, searchType, results);
            
            // Update URL with search query and type
            const urlType = searchType === 'core' ? 'videos' : searchType;
            updateSearchUrl(searchTerm, urlType);
            
            // Hide loading spinner
            setLoadingSpinner(false);
            
            return results;
        } catch (e) {
            ERR('performSmartSearch error', e);
            // Hide loading spinner on error too
            setLoadingSpinner(false);
            return results;
        }
    }


    function createSmartItemElement(item) {
        const serverId = ApiClient.serverId();
        const div = document.createElement('div');
        div.className = 'smart-search-item';

        const img = document.createElement('img');
        img.src = item.ImageTags?.Primary
            ? `${ApiClient.serverAddress()}/Items/${item.Id}/Images/Primary?tag=${item.ImageTags.Primary}&maxWidth=300`
            : '/web/assets/img/icon-transparent.png';
        img.alt = item.Name || 'Unknown';
        img.onerror = () => { img.src = '/web/assets/img/icon-transparent.png'; };

        const h = document.createElement('h3');
        h.textContent = item.Name || 'Unknown';
        h.title = h.textContent;

        const p = document.createElement('p');
        p.textContent = `${item.Type}${item.ProductionYear ? ` (${item.ProductionYear})` : ''}`;
        p.title = p.textContent;

        div.appendChild(img);
        div.appendChild(h);
        div.appendChild(p);

        div.addEventListener('click', () => {
            LOG('item click', { id: item.Id, name: item.Name });
            try { Dashboard.navigate(`#!/details?id=${item.Id}&serverId=${serverId}`); } catch(e){ ERR(e); }
        });

        return div;
    }


    function getTypeDisplayName(itemType) {
        const typeMap = {
            'Movie': 'Movies',
            'Series': 'TV Shows',
            'Episode': 'Episodes',
            'Person': 'People',
            'MusicAlbum': 'Albums',
            'Audio': 'Songs',
            'Artist': 'Artists',
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
            smartResults.className = 'smart-search-results emby-scroller';
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
        const sectionOrder = ['Movie', 'Series', 'Episode', 'Person', 'MusicAlbum', 'Audio', 'Artist', 'Playlist', 'Book', 'AudioBook', 'Photo', 'PhotoAlbum', 'TvChannel', 'LiveTvProgram', 'BoxSet'];
        
        sectionOrder.forEach((itemType, index) => {
            if (results.groupedItems[itemType] && results.groupedItems[itemType].length > 0) {
                const items = results.groupedItems[itemType];
                const title = getTypeDisplayName(itemType);
                const section = window.cardBuilder.renderCards(items, title, index);
                frag.appendChild(section);
                totalShown += items.length;
            }
        });

        resultsContainer.appendChild(frag);
        stats.textContent = `Search completed in ${ms}ms - ${results.total} results found`;
    }

    // main init
    function initDualSearch() {
        if (typeof ApiClient === 'undefined') { setTimeout(initDualSearch, 500); return; }

        const originalInput = document.getElementById('searchTextInput');
        if (!originalInput) { setTimeout(initDualSearch, 500); return; }

        addCustomStyles();

        // Handle URL query parameter on page load
        // Parse query from hash since Jellyfin uses hash-based routing
        let queryFromUrl = null;
        if (window.location.hash.includes('search.html') && window.location.hash.includes('query=')) {
            const hashQuery = window.location.hash.split('query=')[1];
            if (hashQuery) {
                queryFromUrl = hashQuery.split('&')[0]; // Get query before any other params
            }
        }
        LOG('initDualSearch - URL query:', queryFromUrl);
        LOG('initDualSearch - originalInput exists:', !!originalInput);
        if (originalInput) {
            LOG('initDualSearch - originalInput value:', originalInput.value);
        }
        
        if (queryFromUrl) {
            LOG('initDualSearch - URL query detected, leaving input alone');
        }

        // create Smart search UI if not exist
        let wrapper = document.getElementById('smart-search-wrapper');
        if (!wrapper) {
            wrapper = document.createElement('div');
            wrapper.id = 'smart-search-wrapper';
            wrapper.className = 'smart-search-wrapper';

            const input = document.createElement('input');
            input.id = 'smart-search-input';
            input.className = 'smart-search-input emby-input searchfields-txtSearch';
            input.type = 'text';
            input.placeholder = 'Smart Search...';

            const btnRow = document.createElement('div');
            btnRow.className = 'smart-search-buttons';

            const btnAll = document.createElement('button');
            btnAll.id = 'smart-search-all';
            btnAll.className = 'smart-search-secondary emby-button';
            btnAll.textContent = 'All';
            const btnCore = document.createElement('button');
            btnCore.id = 'smart-search-core';
            btnCore.className = 'smart-search-primary emby-button';
            btnCore.textContent = 'Movies/TV';
            const btnMusic = document.createElement('button');
            btnMusic.id = 'smart-search-music';
            btnMusic.className = 'smart-search-secondary emby-button';
            btnMusic.textContent = 'Music';
            const btnBooks = document.createElement('button');
            btnBooks.id = 'smart-search-books';
            btnBooks.className = 'smart-search-secondary emby-button';
            btnBooks.textContent = 'Books';

            btnRow.appendChild(btnAll);
            btnRow.appendChild(btnCore);
            btnRow.appendChild(btnMusic);
            btnRow.appendChild(btnBooks);

            const stats = document.createElement('div');
            stats.id = 'smart-search-stats';
            stats.className = 'smart-search-stats';

            wrapper.appendChild(input);
            wrapper.appendChild(btnRow);
            wrapper.appendChild(stats);

            originalInput.parentElement.insertBefore(wrapper, originalInput);
        }

        // Smart results container will be created lazily when needed

        const smartInput = document.getElementById('smart-search-input');
        const smartCoreBtn = document.getElementById('smart-search-core');
        const smartMusicBtn = document.getElementById('smart-search-music');
        const smartBooksBtn = document.getElementById('smart-search-books');
        const smartAllBtn = document.getElementById('smart-search-all');
        
        // Track current search type
        let currentSearchType = 'videos';

        // Function to update button states
        function updateButtonStates(activeType) {
            // Remove active class from all buttons
            smartAllBtn.classList.remove('smart-search-primary');
            smartAllBtn.classList.add('smart-search-secondary');
            smartCoreBtn.classList.remove('smart-search-primary');
            smartCoreBtn.classList.add('smart-search-secondary');
            smartMusicBtn.classList.remove('smart-search-primary');
            smartMusicBtn.classList.add('smart-search-secondary');
            smartBooksBtn.classList.remove('smart-search-primary');
            smartBooksBtn.classList.add('smart-search-secondary');
            
            // Add active class to the selected button
            if (activeType === 'all') {
                smartAllBtn.classList.remove('smart-search-secondary');
                smartAllBtn.classList.add('smart-search-primary');
            } else if (activeType === 'videos') {
                smartCoreBtn.classList.remove('smart-search-secondary');
                smartCoreBtn.classList.add('smart-search-primary');
            } else if (activeType === 'music') {
                smartMusicBtn.classList.remove('smart-search-secondary');
                smartMusicBtn.classList.add('smart-search-primary');
            } else if (activeType === 'books') {
                smartBooksBtn.classList.remove('smart-search-secondary');
                smartBooksBtn.classList.add('smart-search-primary');
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
                    setLoadingSpinner(false); // Hide spinner when clearing results
                    return; 
                }
                if (timer) clearTimeout(timer);
                const internalType = currentSearchType === 'videos' ? 'core' : currentSearchType;
                timer = setTimeout(() => performSmartSearch(term, internalType), 300);
            };

            smartInput.addEventListener('input', doSmartSearchDebounced);
            smartInput.addEventListener('keydown', (e)=>{ if(e.key==='Enter'){ e.preventDefault(); const internalType = currentSearchType === 'videos' ? 'core' : currentSearchType; performSmartSearch((smartInput.value||'').trim(), internalType); }});
            smartCoreBtn.addEventListener('click', ()=>setSearchType('videos'));
            smartMusicBtn.addEventListener('click', ()=>setSearchType('music'));
            smartBooksBtn.addEventListener('click', ()=>setSearchType('books'));
            smartAllBtn.addEventListener('click', ()=>setSearchType('all'));

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
                originalInput.style.display = 'none';
                // Hide all search results containers
                const searchResults = document.querySelectorAll('.searchResults,.padded-top,.padded-bottom-page');
                searchResults.forEach(sr => sr.style.display = 'none');
                const resultsContainer = ensureSmartResultsContainer();
                resultsContainer.style.display = '';
                toggleBtn.textContent='Switch to Default Search';
                // Keep XHR blocking enabled for smart mode
                shouldBlockXHR = true;
                // Add smart-search-mode class to body for CSS targeting
                document.body.classList.add('smart-search-mode');
            } else {
                wrapper.style.display = 'none';
                originalInput.style.display = '';
                // Show all search results containers
                const searchResults = document.querySelectorAll('.searchResults,.padded-top,.padded-bottom-page');
                searchResults.forEach(sr => sr.style.display = '');
                const resultsContainer = ensureSmartResultsContainer();
                resultsContainer.style.display = 'none';
                toggleBtn.textContent='Switch to Smart Search';
                // Disable XHR blocking for default search mode
                shouldBlockXHR = false;
                LOG('Disabled XHR blocking for default search mode');
                // Remove smart-search-mode class from body
                document.body.classList.remove('smart-search-mode');
                
                // Input is left alone - let it keep its value
            }
        };

        toggleBtn.addEventListener('click', ()=>setMode(!smartMode));

        // initial mode
        setMode(true);
    }

    function init() {
        LOG('init() called');
        LOG('Pathname:', window.location.pathname);
        LOG('Hash:', window.location.hash);
        
        if (window.location.pathname.includes('search.html') || window.location.hash.includes('search')) {
            LOG('Search page detected');
            
            // Check for URL query parameter and prevent default search early
            // Parse query from hash since Jellyfin uses hash-based routing
            let queryFromUrl = null;
            if (window.location.hash.includes('search.html') && window.location.hash.includes('query=')) {
                const hashQuery = window.location.hash.split('query=')[1];
                if (hashQuery) {
                    queryFromUrl = hashQuery.split('&')[0]; // Get query before any other params
                }
            }
            LOG('URL query in init:', queryFromUrl);
            
        if (queryFromUrl) {
            LOG('Query detected in init, enabling XHR blocking');
            shouldBlockXHR = true;
            
            // Also try to prevent search form submission
            const searchForm = document.querySelector('form[action*="search"]');
            LOG('Search form found:', !!searchForm);
            if (searchForm) {
                searchForm.addEventListener('submit', (e) => {
                    LOG('Search form submission prevented');
                    e.preventDefault();
                    e.stopPropagation();
                    return false;
                });
            }
            
            // Try to hide search results containers immediately
            const hideSearchResults = () => {
                const searchResults = document.querySelectorAll('.searchResults,.padded-top,.padded-bottom-page');
                LOG('Found search results containers:', searchResults.length);
                searchResults.forEach(sr => {
                    sr.style.display = 'none';
                    LOG('Hidden search result container');
                });
            };
            
            // Hide immediately and on DOM changes
            hideSearchResults();
            document.addEventListener('DOMContentLoaded', hideSearchResults);
            
            // Use mutation observer to hide any new search results
            const hideObserver = new MutationObserver(() => {
                hideSearchResults();
            });
            hideObserver.observe(document.body, { childList: true, subtree: true });
            
            // Stop observing after 10 seconds
            setTimeout(() => {
                LOG('Stopping hide observer after 10 seconds');
                hideObserver.disconnect();
            }, 10000);
        }
            
            LOG('Calling initDualSearch');
            initDualSearch();
        }
    }

    // Mutation observer to detect when search page content is loaded dynamically
    function setupMutationObserver() {
        const observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                if (mutation.type === 'childList') {
                    // Check if search input appears in the DOM
                    const searchInput = document.getElementById('searchTextInput');
                    if (searchInput && !document.getElementById('smart-search-wrapper')) {
                        LOG('Search input detected via mutation observer');
                        initDualSearch();
                    }
                }
            });
        });

        // Observe the entire document for changes
        observer.observe(document.body, {
            childList: true,
            subtree: true
        });

        LOG('Mutation observer setup complete');
    }

    if (document.readyState==='loading') { 
        document.addEventListener('DOMContentLoaded', () => {
            init();
            setupMutationObserver();
        }); 
    } else { 
        init(); 
        setupMutationObserver();
    }
    LOG('script load end');
})();
