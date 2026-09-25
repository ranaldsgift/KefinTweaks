// KefinTweaks Movies Library Cache
// Chunked per-user archive of movies (no UserData). Startup after login + incremental sync.
(function() {
    'use strict';

    const LOG = (...args) => console.log('[KefinTweaks Movies Cache]', ...args);
    const WARN = (...args) => console.warn('[KefinTweaks Movies Cache]', ...args);
    const ERR = (...args) => console.error('[KefinTweaks Movies Cache]', ...args);

    const CACHE_NAME = 'movies_library';
    const PARTIAL_CACHE_NAME = 'movies_library_partial';
    const LAST_FETCH_KEY_PREFIX = 'kefinTweaks_lastDateFetchedMovieCache_';
    const IMDB_TOP_250_CACHE_TTL = 24 * 60 * 60 * 1000;
    const MOVIE_FIELDS = [
        'ProviderIds', 'People', 'Studios', 'Taglines', 'Genres', 'Overview', 'PrimaryImageAspectRatio',
        'DateCreated', 'DateLastMediaAdded'
    ].join(',');

    let movies = null;
    let isComplete = false;
    let imdbTop250Movies = null;
    let fetchPromise = null;
    let providerIndex = null;

    function utils() {
        return window.LibraryCacheUtils || {};
    }

    function getTtl() {
        return utils().getLibraryCacheSettings?.().CACHE_TTL || (14 * 24 * 60 * 60 * 1000);
    }

    function getChunkSize() {
        return utils().getLibraryCacheSettings?.().movieChunkSize || 1000;
    }

    function lastFetchStorageKey() {
        const userId = window.ApiClient?.getCurrentUserId?.() || 'anonymous';
        return `${LAST_FETCH_KEY_PREFIX}${userId}`;
    }

    function getLastDateFetched() {
        try {
            return localStorage.getItem(lastFetchStorageKey()) || null;
        } catch (_) {
            return null;
        }
    }

    function setLastDateFetched(iso) {
        try {
            localStorage.setItem(lastFetchStorageKey(), iso || new Date().toISOString());
        } catch (e) {
            WARN('Failed to store lastDateFetchedMovieCache:', e);
        }
    }

    /** Max DateLastMediaAdded || DateCreated among movies; null if none usable. */
    function watermarkFromMovies(list) {
        let best = null;
        for (const m of list || []) {
            const raw = m?.DateLastMediaAdded || m?.DateCreated;
            if (!raw) continue;
            const t = new Date(raw).getTime();
            if (!Number.isFinite(t)) continue;
            if (best == null || t > best) best = t;
        }
        return best != null ? new Date(best).toISOString() : null;
    }

    function setLastDateFetchedFromMovies(list) {
        const iso = watermarkFromMovies(list);
        if (iso) setLastDateFetched(iso);
    }

    function getApiHelper() {
        return window.apiHelper || window.ApiHelper;
    }

    function buildItemsUrl({ startIndex, limit, extraParams = {} }) {
        const server = window.ApiClient.serverAddress();
        const params = new URLSearchParams({
            IncludeItemTypes: 'Movie',
            Recursive: 'true',
            Fields: MOVIE_FIELDS,
            ExcludeLocationTypes: 'Virtual',
            EnableTotalRecordCount: 'true',
            SortBy: 'SortName',
            SortOrder: 'Ascending',
            StartIndex: String(startIndex || 0),
            Limit: String(limit)
        });
        Object.entries(extraParams).forEach(([k, v]) => {
            if (v !== undefined && v !== null && v !== '') params.set(k, String(v));
        });
        return `${server}/Items?${params.toString()}`;
    }

    async function queryItems(url) {
        await window.LibraryCacheUtils?.waitWhileCacheNetworkPaused?.();
        const api = getApiHelper();
        if (!api?.getQuery) throw new Error('apiHelper.getQuery unavailable');
        const result = await api.getQuery(url, { useCache: false });
        return result || { Items: [], TotalRecordCount: 0 };
    }

    async function stripChunk(items) {
        if (utils().stripItemsAsync) {
            return utils().stripItemsAsync(items, 'Movie');
        }
        return (items || []).map((item) => utils().stripMovieForCache?.(item) || item).filter(Boolean);
    }

    function rebuildProviderIndex(list) {
        providerIndex = utils().buildProviderIdIndex?.(list) || null;
    }

    /**
     * Full crawl with partial resume. Commits to movies_library only when complete.
     */
    async function fetchAndCacheMovies() {
        const cache = window.IndexedDBCache;
        if (!cache) {
            ERR('IndexedDBCache unavailable');
            return [];
        }

        const userId = window.ApiClient.getCurrentUserId();
        const complete = await cache.get(CACHE_NAME, userId);
        if (complete && Array.isArray(complete)) {
            movies = complete;
            isComplete = true;
            rebuildProviderIndex(movies);
            LOG(`Using complete cached movies (${movies.length})`);
            return movies;
        }

        const chunkSize = getChunkSize();
        let startIndex = 0;
        let collected = [];

        const partial = await cache.get(PARTIAL_CACHE_NAME, userId);
        if (partial && Array.isArray(partial.items) && partial.isComplete !== true) {
            collected = partial.items;
            startIndex = partial.startIndex || collected.length;
            LOG(`Resuming movie crawl from index ${startIndex} (${collected.length} items)`);
        }

        try {
            let hasMore = true;
            while (hasMore) {
                const url = buildItemsUrl({ startIndex, limit: chunkSize });
                const data = await queryItems(url);
                const batch = data.Items || [];
                const stripped = await stripChunk(batch);
                collected = collected.concat(stripped);
                startIndex += batch.length;

                await cache.set(PARTIAL_CACHE_NAME, {
                    isComplete: false,
                    startIndex,
                    items: collected
                }, userId, getTtl());

                LOG(`Movie crawl progress: ${collected.length}${data.TotalRecordCount != null ? ` / ${data.TotalRecordCount}` : ''}`);

                if (batch.length < chunkSize) {
                    hasMore = false;
                } else {
                    await yieldToMain();
                }
            }

            movies = collected;
            isComplete = true;
            rebuildProviderIndex(movies);
            await cache.set(CACHE_NAME, movies, userId, getTtl());
            await cache.clear(PARTIAL_CACHE_NAME, userId);
            setLastDateFetchedFromMovies(movies);
            LOG(`Movie crawl complete: ${movies.length} items`);
            return movies;
        } catch (err) {
            ERR('Error fetching movies:', err);
            return movies || collected || [];
        }
    }

    /**
     * Incremental sync: upsert by MinDateLastSaved, remove orphans via TotalRecordCount + Id list.
     */
    async function syncMoviesCache() {
        if (!isComplete || !movies) {
            LOG('Skip syncMoviesCache: complete cache not ready');
            return movies || [];
        }
        const lastFetched = getLastDateFetched();
        if (!lastFetched) {
            LOG('Skip syncMoviesCache: no lastDateFetched');
            return movies;
        }

        const cache = window.IndexedDBCache;
        const userId = window.ApiClient.getCurrentUserId();
        const chunkSize = getChunkSize();

        try {
            // Additions / metadata refreshes
            let startIndex = 0;
            let incoming = [];
            let hasMore = true;
            while (hasMore) {
                const url = buildItemsUrl({
                    startIndex,
                    limit: chunkSize,
                    extraParams: {
                        MinDateLastSaved: lastFetched,
                        MinDateLastSavedForUser: lastFetched,
                        SortBy: 'DateCreated',
                        SortOrder: 'Descending'
                    }
                });
                const data = await queryItems(url);
                const batch = data.Items || [];
                incoming = incoming.concat(await stripChunk(batch));
                startIndex += batch.length;
                if (batch.length < chunkSize) hasMore = false;
            }

            const beforeIds = new Set((movies || []).map((m) => m.Id).filter(Boolean));
            let removedIds = [];

            if (incoming.length) {
                movies = utils().upsertById?.(movies, incoming) || movies;
                LOG(`Synced ${incoming.length} movie upserts`);
            }

            // Count check
            const countUrl = buildItemsUrl({
                startIndex: 0,
                limit: 1,
                extraParams: {
                    Fields: '',
                    EnableTotalRecordCount: 'true'
                }
            });
            // Rebuild without heavy Fields for count
            const server = window.ApiClient.serverAddress();
            const countParams = new URLSearchParams({
                IncludeItemTypes: 'Movie',
                Recursive: 'true',
                ExcludeLocationTypes: 'Virtual',
                EnableTotalRecordCount: 'true',
                Limit: '1',
                StartIndex: '0'
            });
            const countData = await queryItems(`${server}/Items?${countParams.toString()}`);
            const serverCount = countData.TotalRecordCount;
            if (typeof serverCount === 'number' && serverCount !== movies.length) {
                LOG(`Count mismatch cache=${movies.length} server=${serverCount}; reconciling ids`);
                const serverIds = new Set();
                let idx = 0;
                let more = true;
                while (more) {
                    const idParams = new URLSearchParams({
                        IncludeItemTypes: 'Movie',
                        Recursive: 'true',
                        ExcludeLocationTypes: 'Virtual',
                        EnableTotalRecordCount: 'false',
                        Limit: String(chunkSize),
                        StartIndex: String(idx),
                        Fields: ''
                    });
                    const idData = await queryItems(`${server}/Items?${idParams.toString()}`);
                    const batch = idData.Items || [];
                    batch.forEach((item) => {
                        if (item?.Id) serverIds.add(item.Id);
                    });
                    idx += batch.length;
                    if (batch.length < chunkSize) more = false;
                }
                const before = movies.length;
                removedIds = [...beforeIds].filter((id) => !serverIds.has(id));
                movies = movies.filter((m) => m?.Id && serverIds.has(m.Id));
                // Add any missing ids not in cache (light fetch would lack fields — full upsert via Id list)
                const cachedIds = new Set(movies.map((m) => m.Id));
                const missing = [...serverIds].filter((id) => !cachedIds.has(id));
                if (missing.length) {
                    WARN(`${missing.length} movies on server missing from cache after reconcile; fetching by Ids`);
                    for (let i = 0; i < missing.length; i += chunkSize) {
                        const slice = missing.slice(i, i + chunkSize);
                        const byIdParams = new URLSearchParams({
                            Ids: slice.join(','),
                            Fields: MOVIE_FIELDS,
                            EnableTotalRecordCount: 'false'
                        });
                        const byIdData = await queryItems(`${server}/Items?${byIdParams.toString()}`);
                        const stripped = await stripChunk(byIdData.Items || []);
                        movies = utils().upsertById?.(movies, stripped) || movies;
                        incoming = incoming.concat(stripped);
                    }
                }
                LOG(`Reconcile complete: ${before} → ${movies.length}`);
            }

            rebuildProviderIndex(movies);
            await cache.set(CACHE_NAME, movies, userId, getTtl());
            setLastDateFetchedFromMovies(movies);
            // Notify people cache of deltas when available
            if ((incoming.length || removedIds.length) && window.PeopleCache?.applyMovieDelta) {
                try {
                    await window.PeopleCache.applyMovieDelta(incoming, removedIds);
                } catch (e) {
                    WARN('PeopleCache.applyMovieDelta failed:', e);
                }
            }
            return movies;
        } catch (err) {
            ERR('syncMoviesCache failed:', err);
            return movies || [];
        }
    }

    async function getMovies() {
        if (movies && isComplete) return movies;
        if (fetchPromise) return fetchPromise;
        fetchPromise = (async () => {
            await fetchAndCacheMovies();
            return movies || [];
        })().finally(() => {
            fetchPromise = null;
        });
        return fetchPromise;
    }

    async function isCacheComplete() {
        if (isComplete === true && Array.isArray(movies)) return true;
        const cache = window.IndexedDBCache;
        const userId = window.ApiClient?.getCurrentUserId?.();
        if (!cache || !userId) return false;
        const complete = await cache.get(CACHE_NAME, userId);
        if (complete && Array.isArray(complete)) {
            if (!movies) {
                movies = complete;
                rebuildProviderIndex(movies);
            }
            isComplete = true;
            return true;
        }
        return false;
    }

    async function getMoviesByProviderIds(ids) {
        const list = await getMovies();
        const idSet = new Set();
        (ids || []).forEach((id) => {
            (utils().normalizeProviderKeys?.(id) || []).forEach((k) => idSet.add(k));
        });
        if (!idSet.size) return [];
        return list.filter((item) => utils().itemMatchesProviderIds?.(item, idSet));
    }

    async function fetchImdbTop250Data() {
        const CACHE_KEY_IDS = 'kefinTweaks_imdbTop250_ids';
        let imdbIds = null;
        try {
            const cachedIds = localStorage.getItem(CACHE_KEY_IDS);
            if (cachedIds) {
                const parsed = JSON.parse(cachedIds);
                if (Date.now() - parsed.timestamp < IMDB_TOP_250_CACHE_TTL) {
                    imdbIds = parsed.ids;
                }
            }
        } catch (e) {
            WARN('Error reading IMDb Top 250 cache:', e);
        }

        if (!imdbIds) {
            LOG('Fetching IMDb Top 250 list from GitHub...');
            try {
                const response = await fetch('https://raw.githubusercontent.com/theapache64/top250/master/top250_min.json');
                if (!response.ok) throw new Error('Failed to fetch Top 250 JSON');
                const data = await response.json();
                imdbIds = data.map((entry) => {
                    const match = entry.imdb_url && entry.imdb_url.match(/\/title\/(tt\d+)/);
                    return match ? match[1] : null;
                }).filter(Boolean);
                localStorage.setItem(CACHE_KEY_IDS, JSON.stringify({
                    timestamp: Date.now(),
                    ids: imdbIds
                }));
            } catch (err) {
                ERR('Failed to fetch IMDb Top 250 list:', err);
                return [];
            }
        }
        return imdbIds || [];
    }

    async function getImdbTop250Movies() {
        const cacheName = 'imdbTop250Movies';
        const cache = window.IndexedDBCache;
        const cached = await cache.get(cacheName);
        if (cached) return cached;

        if (!imdbTop250Movies) {
            if (!(await isCacheComplete())) {
                LOG('IMDb Top 250 waiting for movie cache…');
            }
            const imdbIds = await fetchImdbTop250Data();
            const allMovies = await getMovies();
            const idsSet = new Set(imdbIds);
            imdbTop250Movies = allMovies.filter(
                (movie) => movie.ProviderIds?.Imdb && idsSet.has(movie.ProviderIds.Imdb)
            );
        }
        const userId = window.ApiClient.getCurrentUserId();
        await cache.set(cacheName, imdbTop250Movies, userId, IMDB_TOP_250_CACHE_TTL);
        return imdbTop250Movies || [];
    }

    async function initialize() {
        await getMovies();
        if ((await isCacheComplete()) && getLastDateFetched()) {
            await syncMoviesCache();
        }
        return movies || [];
    }

    async function waitForLoginReady(maxWaitMs = 60000) {
        const start = Date.now();
        while (!window.userHelper?.waitForLogin) {
            if (Date.now() - start >= maxWaitMs) {
                ERR('Timed out waiting for userHelper');
                return false;
            }
            await new Promise((r) => setTimeout(r, 100));
        }
        return window.userHelper.waitForLogin(maxWaitMs);
    }

    function yieldToMain() {
        return new Promise((resolve) => {
            if (typeof requestIdleCallback === 'function') {
                requestIdleCallback(() => resolve(), { timeout: 500 });
            } else {
                requestAnimationFrame(() => setTimeout(resolve, 0));
            }
        });
    }

    let bootstrapStarted = false;
    let bootstrapScheduled = false;

    async function bootstrap() {
        if (bootstrapStarted) return;
        bootstrapStarted = true;
        try {
            await waitForLoginReady();
            await initialize();
        } catch (e) {
            ERR('Bootstrap failed:', e);
        }
    }

    /** Defer crawl until home has painted (or 3s after login) so home getQuery is not starved. */
    function scheduleBootstrap() {
        if (bootstrapScheduled) return;
        bootstrapScheduled = true;

        const start = () => { bootstrap(); };

        const onPainted = () => {
            document.removeEventListener('kefinTweaksHomePainted', onPainted);
            start();
        };
        document.addEventListener('kefinTweaksHomePainted', onPainted);

        waitForLoginReady().then((ok) => {
            if (!ok) {
                document.removeEventListener('kefinTweaksHomePainted', onPainted);
                start();
                return;
            }
            setTimeout(() => {
                document.removeEventListener('kefinTweaksHomePainted', onPainted);
                start();
            }, 3000);
        });
    }

    window.MoviesCache = {
        init: initialize,
        getMovies,
        getImdbTop250Movies,
        getMoviesByProviderIds,
        syncMoviesCache,
        fetchAndCacheMovies,
        isComplete: isCacheComplete,
        getLastDateFetched,
        bootstrap,
        scheduleBootstrap,
        refresh: async () => {
            const cache = window.IndexedDBCache;
            const userId = window.ApiClient?.getCurrentUserId?.();
            if (cache) {
                await cache.clear(CACHE_NAME, userId);
                await cache.clear(PARTIAL_CACHE_NAME, userId);
            }
            movies = null;
            isComplete = false;
            providerIndex = null;
            imdbTop250Movies = null;
            return fetchAndCacheMovies();
        }
    };

    scheduleBootstrap();
    LOG('Module loaded');
})();
