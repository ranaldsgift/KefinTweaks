// KefinTweaks Studios Cache Manager
// Handles fetching, processing, and caching of Popular TV Networks
(function() {
    'use strict';

    const LOG = (...args) => console.log('[KefinTweaks  Movies Cache]', ...args);
    const WARN = (...args) => console.warn('[KefinTweaks  Movies Cache]', ...args);
    const ERR = (...args) => console.error('[KefinTweaks  Movies Cache]', ...args);

    // 1 week
    const CACHE_TTL = 7 * 24 * 60 * 60 * 1000;
    const IMDB_TOP_250_CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours for ID list

    // State
    let movies = null;
    let imdbTop250Movies = null;
    let isInitializing = false;

    async function fetchAndCacheMovies() {
        // IndexedDBCache
        const cacheName = 'movies_library';
        const cache = window.IndexedDBCache;
        
        // Check cache first
        const cached = await cache.get(cacheName);
        if (cached) {
            LOG('Using cached Movies');
            return cached;
        }
        
        try {
            LOG('Fetching Movies...');          
            
            const allMoviesQuery = `${ApiClient.serverAddress()}/Items?IncludeItemTypes=Movie&Recursive=true&Fields=ProviderIds`;

            const movieResult = await apiHelper.getQuery(allMoviesQuery);

            // Resolve the data (cached or fresh)
            let allMovies = [];
            if (movieResult && movieResult.Items) {
                allMovies = movieResult.Items;
            }
            
            LOG(`Fetched ${allMovies.length} Movies`);
            
            // Cache the results
            const userId = ApiClient.getCurrentUserId();
            await cache.set(cacheName, allMovies, userId, CACHE_TTL);
            
            return allMovies;
        } catch (err) {
            ERR('Error fetching Movies:', err);
            return [];
        }
    }

    /**
     * Initializes the cache
     */
    async function initialize() {
        if (isInitializing) return;
        
        if (movies) return;

        isInitializing = true;
        try {
            movies = await fetchAndCacheMovies();
        } finally {
            isInitializing = false;
        }
    }        

    /**
     * Fetches IMDb Top 250 movies using client-side filtering
     * @returns {Promise<Array>} - List of matched Movie items
     */
    async function fetchImdbTop250Data() {
        const CACHE_KEY_IDS = 'kefinTweaks_imdbTop250_ids';
        
        let imdbIds = null;
        
        // 1. Get IDs (Local Cache or Fetch GitHub)
        try {
            const cachedIds = localStorage.getItem(CACHE_KEY_IDS);
            if (cachedIds) {
                const parsed = JSON.parse(cachedIds);
                if (Date.now() - parsed.timestamp < IMDB_TOP_250_CACHE_TTL) {
                    imdbIds = parsed.ids;
                }
            }
        } catch (e) { WARN('Error reading IMDb Top 250 cache:', e); }

        if (!imdbIds) {
            LOG('Fetching IMDb Top 250 list from GitHub...');
            try {
                const response = await fetch('https://raw.githubusercontent.com/theapache64/top250/master/top250_min.json');
                if (!response.ok) throw new Error('Failed to fetch Top 250 JSON');
                const data = await response.json();
                
                // Extract IDs
                imdbIds = data.map(entry => {
                    // entry.imdb_url e.g. "http://www.imdb.com/title/tt0111161/"
                    const match = entry.imdb_url && entry.imdb_url.match(/\/title\/(tt\d+)/);
                    return match ? match[1] : null;
                }).filter(Boolean);

                // Cache
                localStorage.setItem(CACHE_KEY_IDS, JSON.stringify({
                    timestamp: Date.now(),
                    ids: imdbIds
                }));
            } catch (err) {
                ERR('Failed to fetch IMDb Top 250 list:', err);
                return [];
            }
        }

        if (!imdbIds || imdbIds.length === 0) return [];

        return imdbIds;
    }

    async function getImdbTop250Movies() {
        const cacheName = 'imdbTop250Movies';
        const cache = window.IndexedDBCache;
        const cached = await cache.get(cacheName);
        if (cached) {
            return cached;
        }

        if (!imdbTop250Movies) {
            const imdbIds = await fetchImdbTop250Data();
            const allMovies = await getMovies();
    
            // 3. Client-side Match
            const matchedMovies = [];
            const idsSet = new Set(imdbIds); // Faster lookup
            
            for (const movie of allMovies) {
                if (movie.ProviderIds && movie.ProviderIds.Imdb && idsSet.has(movie.ProviderIds.Imdb)) {
                    matchedMovies.push(movie);
                }
            }
            imdbTop250Movies = matchedMovies;
        }
        const userId = ApiClient.getCurrentUserId();
        await cache.set(cacheName, imdbTop250Movies, userId, IMDB_TOP_250_CACHE_TTL);
        return imdbTop250Movies || [];
    }

    async function getMovies() {
        if (!movies) {
            movies = await fetchAndCacheMovies();
        }
        return movies || [];
    }

    // Expose API
    window.MoviesCache = {
        init: initialize,
        getMovies: getMovies,
        getImdbTop250Movies: getImdbTop250Movies,
        // Also expose the fetcher if we need to force refresh
        refresh: async () => {
            const cache = window.IndexedDBCache;
            cache.delete('movies_library');
            movies = await fetchAndCacheMovies();
            return movies;
        }
    };

    LOG('Module loaded');

})();
