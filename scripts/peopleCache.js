// KefinTweaks People Cache
// Built from MoviesCache + SeriesCache; episode credits via global /Items?IncludeItemTypes=Episode pager.
(function() {
    'use strict';

    const LOG = (...args) => console.log('[KefinTweaks PeopleCache]', ...args);
    const WARN = (...args) => console.warn('[KefinTweaks PeopleCache]', ...args);
    const ERR = (...args) => console.error('[KefinTweaks PeopleCache]', ...args);

    const CACHE_NAME = 'library_top_people_v3';
    const DEFAULT_MIN = 10;
    const DEFAULT_PER_TYPE_MAX = 100;
    const EPISODE_CHUNK_SIZE = 500;
    const EPISODE_APPLY_YIELD_EVERY = 50;
    const CREDIT_ONLY_KEYS = new Set(['Type', 'Role']);

    let peopleMap = null; // Map<personId, Person>
    let filteredLists = null; // { actors, directors, writers }
    let isComplete = false;
    let episodePeopleComplete = false;
    let episodePeopleWatermark = null;
    let episodeCrawl = null; // { startIndex, newestAt, oldestApplied } while partial
    let lastEpisodeSyncAt = null;
    let fetchPromise = null;
    let initPromise = null;
    let episodeSyncPromise = null;
    let episodeSyncPendingForceFull = false;

    function getHomeSettings() {
        return window.KefinHomeScreen?.getConfig?.()?.HOME_SETTINGS
            || window.KefinHomeConfig2?.HOME_SETTINGS
            || {};
    }

    function getMins() {
        const home = getHomeSettings();
        return {
            total: home.minPeopleAppearancesTotal ?? DEFAULT_MIN,
            movies: home.minPeopleAppearancesMovies ?? DEFAULT_MIN,
            series: home.minPeopleAppearancesSeries ?? DEFAULT_MIN,
            episodes: home.minPeopleAppearancesEpisodes ?? DEFAULT_MIN
        };
    }

    function getPerTypeMaxCount() {
        const max = getHomeSettings().maxPeopleCount;
        const n = parseInt(max, 10);
        if (Number.isFinite(n) && n > 0) return Math.min(n, DEFAULT_PER_TYPE_MAX);
        return DEFAULT_PER_TYPE_MAX;
    }

    function shouldLoadPeopleEpisodeData() {
        return getHomeSettings().loadPeopleEpisodeData === true;
    }

    function isAggregateItemType(itemType) {
        return itemType == null || itemType === '' || itemType === 'All';
    }

    function emptyMovieCounts() {
        return { directorCount: 0, writerCount: 0, actorCount: 0 };
    }

    function emptySeriesCounts() {
        return { count: 0, actorCount: 0, directorCount: 0, writerCount: 0 };
    }

    function movieRoleCount(person, role) {
        const m = person.movies || {};
        if (role === 'Actor') return m.actorCount || 0;
        if (role === 'Director') return m.directorCount || 0;
        if (role === 'Writer') return m.writerCount || 0;
        return 0;
    }

    function seriesRoleCount(person, role) {
        const s = person.series || {};
        if (role === 'Actor') return s.count || 0;
        if (role === 'Director') return episodeRoleCount(person, role);
        if (role === 'Writer') return episodeRoleCount(person, role);
        return 0;
    }

    function episodeRoleCount(person, role) {
        const s = person.series || {};
        if (role === 'Actor') return s.actorCount || 0;
        if (role === 'Director') return s.directorCount || 0;
        if (role === 'Writer') return s.writerCount || 0;
        return 0;
    }

    function totalAppearances(person) {
        const m = person.movies || {};
        const s = person.series || {};
        return (m.actorCount || 0)
            + (m.directorCount || 0)
            + (m.writerCount || 0)
            + (s.count || 0)
            + (s.actorCount || 0)
            + (s.directorCount || 0)
            + (s.writerCount || 0);
    }

    function personMeetsMin(person, mins) {
        const m = person.movies || {};
        const s = person.series || {};
        const episodeMax = Math.max(s.actorCount || 0, s.directorCount || 0, s.writerCount || 0);
        return (m.actorCount >= mins.movies)
            || (m.directorCount >= mins.movies)
            || (m.writerCount >= mins.movies)
            || ((s.count || 0) >= mins.series)
            || (episodeMax >= mins.episodes)
            || (totalAppearances(person) >= mins.total);
    }

    function prunePeopleMap(map) {
        if (!map) return map;
        const mins = getMins();
        const beforeMin = map.size;
        for (const [id, person] of map) {
            if (!personMeetsMin(person, mins)) map.delete(id);
        }
        if (beforeMin !== map.size) {
            LOG(`People prune (mins): ${beforeMin} → ${map.size}`);
        }

        const maxPerBucket = getPerTypeMaxCount();
        const keepIds = new Set();
        const itemTypes = ['Movie', 'Series', 'Episode', null];
        const roles = ['Actor', 'Director', 'Writer'];
        for (const itemType of itemTypes) {
            for (const role of roles) {
                filterRoleList(role, itemType).slice(0, maxPerBucket).forEach((p) => keepIds.add(p.Id));
            }
        }
        const beforeMax = map.size;
        for (const id of Array.from(map.keys())) {
            if (!keepIds.has(id)) map.delete(id);
        }
        if (beforeMax !== map.size) {
            LOG(`People prune (per-type max ${maxPerBucket}): ${beforeMax} → ${map.size}`);
        }
        return map;
    }

    function personIdentityFields(person) {
        const out = {};
        if (!person || typeof person !== 'object') return out;
        Object.keys(person).forEach((key) => {
            if (key === 'movies' || key === 'series') return;
            if (CREDIT_ONLY_KEYS.has(key)) return;
            out[key] = person[key];
        });
        return out;
    }

    function ensurePerson(map, person) {
        const key = person?.Id;
        if (!key) return null;
        if (!map.has(key)) {
            map.set(key, {
                ...personIdentityFields(person),
                Id: person.Id,
                Name: person.Name,
                movies: emptyMovieCounts(),
                series: emptySeriesCounts()
            });
        } else {
            const existing = map.get(key);
            const incoming = personIdentityFields(person);
            Object.keys(incoming).forEach((keyName) => {
                if (keyName === 'Id') return;
                const value = incoming[keyName];
                if (value == null || value === '') return;
                if (existing[keyName] == null || existing[keyName] === '') {
                    existing[keyName] = value;
                }
            });
        }
        return map.get(key);
    }

    function bumpMovieRole(movies, type) {
        if (!movies) return;
        if (type === 'Director') movies.directorCount = (movies.directorCount || 0) + 1;
        else if (type === 'Writer') movies.writerCount = (movies.writerCount || 0) + 1;
        else if (type === 'Actor') movies.actorCount = (movies.actorCount || 0) + 1;
    }

    function bumpEpisodeRole(series, type, delta) {
        if (!series || !delta) return;
        if (type === 'Director') {
            series.directorCount = Math.max(0, (series.directorCount || 0) + delta);
        } else if (type === 'Writer') {
            series.writerCount = Math.max(0, (series.writerCount || 0) + delta);
        } else if (type === 'Actor') {
            series.actorCount = Math.max(0, (series.actorCount || 0) + delta);
        }
    }

    function applyMoviePeople(map, movie) {
        if (!movie?.People) return;
        movie.People.forEach((person) => {
            const personData = ensurePerson(map, person);
            if (!personData) return;
            bumpMovieRole(personData.movies, person.Type);
        });
    }

    function applySeriesPeople(map, seriesItem) {
        if (!seriesItem?.People) return;
        seriesItem.People.forEach((person) => {
            const personData = ensurePerson(map, person);
            if (!personData) return;
            personData.series.count = (personData.series.count || 0) + 1;
        });
    }

    function applyEpisodePeople(map, episode) {
        if (!episode?.People) return;
        episode.People.forEach((person) => {
            const personData = ensurePerson(map, person);
            if (!personData) return;
            bumpEpisodeRole(personData.series, person.Type, 1);
        });
    }

    function clearMovieCounts(map) {
        if (!map) return;
        map.forEach((person) => {
            person.movies = emptyMovieCounts();
        });
    }

    function clearSeriesMembershipCounts(map) {
        if (!map) return;
        map.forEach((person) => {
            person.series.count = 0;
        });
    }

    function clearEpisodeRoleCounts(map) {
        if (!map) return;
        map.forEach((person) => {
            person.series.actorCount = 0;
            person.series.directorCount = 0;
            person.series.writerCount = 0;
        });
    }

    async function recountMoviePeopleFromCache(map) {
        clearMovieCounts(map);
        const movies = await window.MoviesCache?.getMovies?.() || [];
        (movies || []).forEach((movie) => applyMoviePeople(map, movie));
    }

    async function recountSeriesMembershipFromCache(map) {
        clearSeriesMembershipCounts(map);
        const seriesList = await window.SeriesCache?.getSeries?.() || [];
        (seriesList || []).forEach((s) => applySeriesPeople(map, s));
    }

    function roleCount(person, role, itemType) {
        const movieCount = movieRoleCount(person, role);
        const seriesCount = seriesRoleCount(person, role);
        const episodeCount = episodeRoleCount(person, role);
        if (itemType === 'Movie') return movieCount;
        if (itemType === 'Series') return seriesCount;
        if (itemType === 'Episode') return episodeCount;
        if (isAggregateItemType(itemType)) return movieCount + seriesCount + episodeCount;
        return 0;
    }

    function filterRoleList(role, itemType, minCount) {
        if (!peopleMap) return [];
        const mins = getMins();
        const type = isAggregateItemType(itemType) ? null : itemType;
        let threshold = minCount;
        if (threshold == null) {
            if (type === 'Movie') threshold = mins.movies;
            else if (type === 'Series') threshold = mins.series;
            else if (type === 'Episode') threshold = mins.episodes;
            else threshold = mins.total;
        }
        return Array.from(peopleMap.values())
            .map((person) => {
                const count = roleCount(person, role, type);
                return {
                    ...person,
                    count,
                    movies: person.movies,
                    series: person.series
                };
            })
            .filter((p) => p.count >= threshold)
            .sort((a, b) => b.count - a.count);
    }

    function rebuildFilteredLists() {
        filteredLists = {
            actors: filterRoleList('Actor', null),
            directors: filterRoleList('Director', null),
            writers: filterRoleList('Writer', null),
            isComplete: true,
            episodePeopleComplete: episodePeopleComplete === true
        };
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

    async function waitWhileCacheNetworkPaused() {
        const wait = window.LibraryCacheUtils?.waitWhileCacheNetworkPaused;
        if (typeof wait === 'function') {
            await wait();
            return;
        }
        // Fallback if utils not loaded yet
        while (typeof document !== 'undefined' && document.hidden) {
            await new Promise((resolve) => setTimeout(resolve, 1000));
        }
    }

    function getApiHelper() {
        return window.apiHelper || window.ApiHelper;
    }

    function buildEpisodePeopleUrl(startIndex) {
        const server = window.ApiClient.serverAddress();
        const params = new URLSearchParams({
            IncludeItemTypes: 'Episode',
            Recursive: 'true',
            Fields: 'People',
            ExcludeLocationTypes: 'Virtual',
            EnableTotalRecordCount: 'false',
            SortBy: 'DateCreated',
            SortOrder: 'Descending',
            StartIndex: String(startIndex || 0),
            Limit: String(EPISODE_CHUNK_SIZE)
        });
        return `${server}/Items?${params.toString()}`;
    }

    async function fetchEpisodePeoplePage(startIndex) {
        const api = getApiHelper();
        const url = buildEpisodePeopleUrl(startIndex);
        const data = await api.getQuery(url, { useCache: false });
        return data?.Items || [];
    }

    function compareIsoDates(a, b) {
        if (!a && !b) return 0;
        if (!a) return -1;
        if (!b) return 1;
        if (a === b) return 0;
        return a < b ? -1 : 1;
    }

    async function applyEpisodeBatchWithYield(map, episodes) {
        for (let i = 0; i < episodes.length; i++) {
            applyEpisodePeople(map, episodes[i]);
            if ((i + 1) % EPISODE_APPLY_YIELD_EVERY === 0) {
                await yieldToMain();
            }
        }
    }

    function clearEpisodeCrawl() {
        episodeCrawl = null;
    }

    function setEpisodeCrawl(startIndex, newestAt, oldestApplied) {
        episodeCrawl = {
            startIndex: Math.max(0, Number(startIndex) || 0),
            newestAt: newestAt || null,
            oldestApplied: oldestApplied || null
        };
        episodePeopleComplete = false;
    }

    /**
     * Apply episodes newer than newestAt from the head of the DateCreated-desc list.
     * @returns {{ applied: number, newestAt: string|null }}
     */
    async function runEpisodeHeadCatchup(newestAt) {
        let startIndex = 0;
        let applied = 0;
        let page0Newest = null;

        while (true) {
            await waitWhileCacheNetworkPaused();
            let batch = [];
            try {
                batch = await fetchEpisodePeoplePage(startIndex);
            } catch (e) {
                ERR('Episode head catchup page failed:', e);
                break;
            }
            if (!batch.length) break;

            if (!page0Newest && batch[0]?.DateCreated) {
                page0Newest = batch[0].DateCreated;
            }

            const toApply = [];
            let hitBoundary = false;
            for (const ep of batch) {
                const created = ep?.DateCreated;
                if (newestAt && created && compareIsoDates(created, newestAt) <= 0) {
                    hitBoundary = true;
                    break;
                }
                toApply.push(ep);
            }

            if (toApply.length) {
                await applyEpisodeBatchWithYield(peopleMap, toApply);
                applied += toApply.length;
            }

            await yieldToMain();
            if (hitBoundary || batch.length < EPISODE_CHUNK_SIZE) break;
            startIndex += batch.length;
        }

        return { applied, newestAt: page0Newest || newestAt || null };
    }

    /**
     * Full descending crawl, or resume from episodeCrawl (after optional head catchup).
     */
    async function runEpisodeFullOrResumeCrawl({ resume }) {
        let startIndex = 0;
        let newestAt = null;
        let oldestApplied = null;
        let stillSkipping = false;

        if (resume && episodeCrawl) {
            startIndex = episodeCrawl.startIndex || 0;
            newestAt = episodeCrawl.newestAt || null;
            oldestApplied = episodeCrawl.oldestApplied || null;
            stillSkipping = !!oldestApplied;

            LOG(`Episode people sync: resume (startIndex=${startIndex}, newestAt=${newestAt}, oldestApplied=${oldestApplied})`);

            if (newestAt) {
                const head = await runEpisodeHeadCatchup(newestAt);
                if (head.applied > 0) {
                    startIndex += head.applied;
                    LOG(`Episode head catchup applied ${head.applied}; startIndex → ${startIndex}`);
                }
                if (head.newestAt) newestAt = head.newestAt;
                setEpisodeCrawl(startIndex, newestAt, oldestApplied);
                await persistPeople({ prune: false });
            }
        } else {
            LOG('Episode people sync: full crawl…');
            startIndex = 0;
            newestAt = null;
            oldestApplied = null;
            stillSkipping = false;
        }

        let pages = 0;
        let applied = 0;

        while (true) {
            await waitWhileCacheNetworkPaused();
            let batch = [];
            try {
                batch = await fetchEpisodePeoplePage(startIndex);
            } catch (e) {
                ERR('Episode people page failed:', e);
                setEpisodeCrawl(startIndex, newestAt, oldestApplied);
                await persistPeople({ prune: false });
                return;
            }
            pages += 1;

            if (!batch.length) break;

            if (!newestAt && batch[0]?.DateCreated) {
                newestAt = batch[0].DateCreated;
            }

            const toApply = [];
            for (const ep of batch) {
                const created = ep?.DateCreated;
                if (stillSkipping && oldestApplied && created) {
                    if (compareIsoDates(created, oldestApplied) >= 0) {
                        continue;
                    }
                    stillSkipping = false;
                }
                toApply.push(ep);
            }

            if (toApply.length) {
                await applyEpisodeBatchWithYield(peopleMap, toApply);
                applied += toApply.length;
                const last = toApply[toApply.length - 1];
                if (last?.DateCreated) oldestApplied = last.DateCreated;
            }

            startIndex += batch.length;
            setEpisodeCrawl(startIndex, newestAt, oldestApplied);
            await persistPeople({ prune: false });
            await yieldToMain();

            if (pages % 5 === 0) {
                LOG(`Episode people progress: applied=${applied}, page=${pages}, startIndex=${startIndex}`);
            }

            if (batch.length < EPISODE_CHUNK_SIZE) break;
        }

        episodePeopleWatermark = newestAt;
        clearEpisodeCrawl();
        episodePeopleComplete = true;
        lastEpisodeSyncAt = new Date().toISOString();
        prunePeopleMap(peopleMap);
        rebuildFilteredLists();
        await persistPeople({ prune: true });
        LOG(`Episode people sync done: applied=${applied}, pages=${pages}, watermark=${episodePeopleWatermark}`);
    }

    /** Incremental update when a prior full crawl completed (watermark set, no partial cursor). */
    async function runEpisodeIncrementalSync() {
        const watermark = episodePeopleWatermark;
        LOG(`Episode people sync: incremental (watermark=${watermark})…`);

        let startIndex = 0;
        let newestSeen = null;
        let pages = 0;
        let applied = 0;

        while (true) {
            await waitWhileCacheNetworkPaused();
            let batch = [];
            try {
                batch = await fetchEpisodePeoplePage(startIndex);
            } catch (e) {
                ERR('Episode people page failed:', e);
                break;
            }
            pages += 1;

            if (!batch.length) break;

            if (!newestSeen && batch[0]?.DateCreated) {
                newestSeen = batch[0].DateCreated;
            }

            const toApply = [];
            let hitWatermark = false;
            for (const ep of batch) {
                const created = ep?.DateCreated;
                if (watermark && created && compareIsoDates(created, watermark) <= 0) {
                    hitWatermark = true;
                    break;
                }
                toApply.push(ep);
            }

            if (toApply.length) {
                await applyEpisodeBatchWithYield(peopleMap, toApply);
                applied += toApply.length;
            }

            await yieldToMain();

            if (hitWatermark || batch.length < EPISODE_CHUNK_SIZE) break;
            startIndex += batch.length;
        }

        if (newestSeen) {
            episodePeopleWatermark = newestSeen;
        }
        clearEpisodeCrawl();
        episodePeopleComplete = true;
        lastEpisodeSyncAt = new Date().toISOString();
        prunePeopleMap(peopleMap);
        rebuildFilteredLists();
        await persistPeople({ prune: true });
        LOG(`Episode people incremental done: applied=${applied}, pages=${pages}, watermark=${episodePeopleWatermark}`);
    }

    async function runEpisodePeopleSync(options = {}) {
        if (!shouldLoadPeopleEpisodeData()) {
            clearEpisodeRoleCounts(peopleMap);
            clearEpisodeCrawl();
            episodePeopleComplete = true;
            episodePeopleWatermark = null;
            lastEpisodeSyncAt = new Date().toISOString();
            rebuildFilteredLists();
            await persistPeople({ prune: true });
            return;
        }
        if (!peopleMap) return;

        const forceFull = options.forceFull === true;

        if (forceFull) {
            clearEpisodeRoleCounts(peopleMap);
            clearEpisodeCrawl();
            episodePeopleWatermark = null;
            episodePeopleComplete = false;
            await runEpisodeFullOrResumeCrawl({ resume: false });
            return;
        }

        if (episodeCrawl && !episodePeopleComplete) {
            await runEpisodeFullOrResumeCrawl({ resume: true });
            return;
        }

        if (episodePeopleWatermark) {
            await runEpisodeIncrementalSync();
            return;
        }

        // No watermark and no partial cursor: start a fresh full crawl
        clearEpisodeRoleCounts(peopleMap);
        clearEpisodeCrawl();
        episodePeopleComplete = false;
        await runEpisodeFullOrResumeCrawl({ resume: false });
    }

    function scheduleEpisodePeopleSync(options = {}) {
        if (!shouldLoadPeopleEpisodeData()) {
            if (peopleMap) {
                clearEpisodeRoleCounts(peopleMap);
                clearEpisodeCrawl();
                episodePeopleComplete = true;
                episodePeopleWatermark = null;
            }
            return Promise.resolve();
        }

        if (options.forceFull) {
            episodeSyncPendingForceFull = true;
        }

        if (episodeSyncPromise) {
            return episodeSyncPromise;
        }

        episodeSyncPromise = (async () => {
            try {
                do {
                    const forceFull = episodeSyncPendingForceFull;
                    episodeSyncPendingForceFull = false;
                    await runEpisodePeopleSync({ forceFull });
                } while (episodeSyncPendingForceFull);
            } catch (e) {
                ERR('Episode people sync failed:', e);
            } finally {
                episodeSyncPromise = null;
            }
        })();

        return episodeSyncPromise;
    }

    async function persistPeople(options = {}) {
        const cache = window.IndexedDBCache;
        if (!cache || !peopleMap) return;
        const doPrune = options.prune !== false;
        if (doPrune) {
            prunePeopleMap(peopleMap);
        }
        const userId = window.ApiClient.getCurrentUserId();
        const ttl = window.LibraryCacheUtils?.getLibraryCacheSettings?.().CACHE_TTL || (14 * 24 * 60 * 60 * 1000);
        const payload = {
            isComplete: true,
            loadPeopleEpisodeData: shouldLoadPeopleEpisodeData(),
            episodePeopleComplete: episodePeopleComplete === true,
            episodePeopleWatermark,
            episodeCrawl: episodeCrawl
                ? {
                    startIndex: episodeCrawl.startIndex,
                    newestAt: episodeCrawl.newestAt,
                    oldestApplied: episodeCrawl.oldestApplied
                }
                : null,
            lastEpisodeSyncAt,
            peopleData: Array.from(peopleMap.entries())
        };
        try {
            await cache.set(CACHE_NAME, payload, userId, ttl);
        } catch (e) {
            WARN('Failed to persist people cache:', e);
        }
    }

    async function fetchAndCachePeople() {
        if (fetchPromise) return fetchPromise;
        fetchPromise = (async () => {
            try {
                LOG('Building people cache from movies + series…');
                const movies = await window.MoviesCache.getMovies();
                const seriesList = await window.SeriesCache.getSeries();
                const map = new Map();

                (movies || []).forEach((movie) => applyMoviePeople(map, movie));
                (seriesList || []).forEach((s) => applySeriesPeople(map, s));

                peopleMap = map;
                prunePeopleMap(map);
                isComplete = true;
                episodePeopleComplete = !shouldLoadPeopleEpisodeData();
                episodePeopleWatermark = null;
                clearEpisodeCrawl();
                lastEpisodeSyncAt = null;
                rebuildFilteredLists();
                await persistPeople({ prune: true });
                LOG(`People cache Phase A complete: ${peopleMap.size} people`);

                if (shouldLoadPeopleEpisodeData()) {
                    scheduleEpisodePeopleSync({ forceFull: true });
                } else {
                    LOG('Skipping episode people fetch (loadPeopleEpisodeData disabled)');
                }

                return filteredLists;
            } catch (err) {
                ERR('fetchAndCachePeople failed:', err);
                return null;
            } finally {
                fetchPromise = null;
            }
        })();
        return fetchPromise;
    }

    async function initialize() {
        if (isComplete && peopleMap) return;
        if (initPromise) return initPromise;
        initPromise = (async () => {
            try {
                const cache = window.IndexedDBCache;
                const userId = window.ApiClient.getCurrentUserId();
                if (cache && await cache.isCacheValid(CACHE_NAME, userId)) {
                    const cached = await cache.get(CACHE_NAME, userId);
                    if (cached?.isComplete && Array.isArray(cached.peopleData)) {
                        const currentMode = shouldLoadPeopleEpisodeData();
                        const cachedMode = typeof cached.loadPeopleEpisodeData === 'boolean'
                            ? cached.loadPeopleEpisodeData
                            : false;
                        if (cachedMode !== currentMode) {
                            LOG(`People cache episode mode mismatch (cached=${cachedMode}, current=${currentMode}); rebuilding`);
                            await cache.clear?.(CACHE_NAME, userId);
                        } else {
                            peopleMap = new Map(cached.peopleData);
                            episodePeopleWatermark = cached.episodePeopleWatermark || null;
                            lastEpisodeSyncAt = cached.lastEpisodeSyncAt || null;
                            if (cached.episodeCrawl
                                && typeof cached.episodeCrawl === 'object'
                                && cached.episodePeopleComplete !== true) {
                                episodeCrawl = {
                                    startIndex: Math.max(0, Number(cached.episodeCrawl.startIndex) || 0),
                                    newestAt: cached.episodeCrawl.newestAt || null,
                                    oldestApplied: cached.episodeCrawl.oldestApplied || null
                                };
                                episodePeopleComplete = false;
                            } else {
                                clearEpisodeCrawl();
                                episodePeopleComplete = cached.episodePeopleComplete === true
                                    || !currentMode;
                            }
                            const before = peopleMap.size;
                            // Avoid pruning away mid-crawl people that only meet mins after more pages
                            if (episodePeopleComplete) {
                                prunePeopleMap(peopleMap);
                            }
                            isComplete = true;
                            rebuildFilteredLists();
                            LOG('Loaded people cache from IndexedDB'
                                + (episodeCrawl ? ` (partial episode crawl startIndex=${episodeCrawl.startIndex})` : ''));
                            if (episodePeopleComplete && peopleMap.size < before) {
                                await persistPeople({ prune: true });
                            }
                            if (currentMode) {
                                // Resume partial, incremental watermark, or start full — never wipe on missing watermark alone
                                scheduleEpisodePeopleSync();
                            }
                            return;
                        }
                    }
                }
                await fetchAndCachePeople();
            } finally {
                initPromise = null;
            }
        })();
        return initPromise;
    }

    async function applyMovieDelta(_changedMovies, _removedIds) {
        if (!peopleMap) await initialize();
        if (!peopleMap) return;
        await recountMoviePeopleFromCache(peopleMap);
        prunePeopleMap(peopleMap);
        rebuildFilteredLists();
        await persistPeople({ prune: true });
    }

    async function applySeriesDelta(_changedSeries, removedIds) {
        if (!peopleMap) await initialize();
        if (!peopleMap) return;

        const removed = (removedIds || []).filter(Boolean);
        await recountSeriesMembershipFromCache(peopleMap);

        if (!shouldLoadPeopleEpisodeData()) {
            clearEpisodeRoleCounts(peopleMap);
            clearEpisodeCrawl();
            episodePeopleComplete = true;
            episodePeopleWatermark = null;
        } else if (removed.length) {
            scheduleEpisodePeopleSync({ forceFull: true });
        } else {
            scheduleEpisodePeopleSync({ forceFull: false });
        }

        prunePeopleMap(peopleMap);
        rebuildFilteredLists();
        await persistPeople({ prune: true });
    }

    async function invalidate() {
        LOG('Invalidating people cache (in-memory + IndexedDB)');
        peopleMap = null;
        filteredLists = null;
        isComplete = false;
        episodePeopleComplete = false;
        episodePeopleWatermark = null;
        clearEpisodeCrawl();
        lastEpisodeSyncAt = null;
        fetchPromise = null;
        initPromise = null;
        episodeSyncPromise = null;
        episodeSyncPendingForceFull = false;
        try {
            const cache = window.IndexedDBCache;
            const userId = window.ApiClient?.getCurrentUserId?.();
            if (cache?.clear) {
                await cache.clear(CACHE_NAME, userId);
            }
        } catch (e) {
            WARN('Failed to clear people IDB cache:', e);
        }
        try {
            initialize();
        } catch (e) {
            WARN('People cache rebuild after invalidate failed to start:', e);
        }
    }

    async function getTopPeople() {
        if (!filteredLists) await initialize();
        return filteredLists;
    }

    function parseRoleListArgs(itemTypeOrOptions, minCount) {
        if (itemTypeOrOptions && typeof itemTypeOrOptions === 'object') {
            return {
                itemType: itemTypeOrOptions.ItemType || itemTypeOrOptions.itemType || null,
                minCount: itemTypeOrOptions.MinCount ?? itemTypeOrOptions.minCount
            };
        }
        return { itemType: itemTypeOrOptions, minCount };
    }

    async function getTopActors(itemTypeOrOptions = null, minCount) {
        if (!peopleMap) await initialize();
        const { itemType, minCount: min } = parseRoleListArgs(itemTypeOrOptions, minCount);
        return filterRoleList('Actor', itemType, min);
    }

    async function getTopDirectors(itemTypeOrOptions = null, minCount) {
        if (!peopleMap) await initialize();
        const { itemType, minCount: min } = parseRoleListArgs(itemTypeOrOptions, minCount);
        return filterRoleList('Director', itemType, min);
    }

    async function getTopWriters(itemTypeOrOptions = null, minCount) {
        if (!peopleMap) await initialize();
        const { itemType, minCount: min } = parseRoleListArgs(itemTypeOrOptions, minCount);
        return filterRoleList('Writer', itemType, min);
    }

    async function resolveDiscoveryPeople(queryOptions = {}) {
        if (!peopleMap) await initialize();
        const personType = queryOptions.PersonType || queryOptions.personType || 'Actor';
        const itemType = queryOptions.ItemType || queryOptions.itemType || null;
        const limit = queryOptions.Limit || 100;
        let list = [];
        if (personType === 'Director') list = filterRoleList('Director', itemType);
        else if (personType === 'Writer') list = filterRoleList('Writer', itemType);
        else list = filterRoleList('Actor', itemType);
        return list.slice(0, limit).map((p) => ({ Id: p.Id, Name: p.Name, Type: 'Person' }));
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

    let bootstrapStarted = false;
    let bootstrapScheduled = false;

    async function bootstrap() {
        if (bootstrapStarted) return;
        bootstrapStarted = true;
        try {
            await waitForLoginReady();
            if (window.MoviesCache?.getMovies) await window.MoviesCache.getMovies();
            if (window.SeriesCache?.getSeries) await window.SeriesCache.getSeries();
            await initialize();
        } catch (e) {
            ERR('Bootstrap failed:', e);
        }
    }

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

    window.PeopleCache = {
        init: initialize,
        fetchAndCachePeople,
        getTopPeople,
        getTopActors,
        getTopDirectors,
        getTopWriters,
        resolveDiscoveryPeople,
        applyMovieDelta,
        applySeriesDelta,
        invalidate,
        isComplete: () => isComplete === true,
        isEpisodePeopleComplete: () => episodePeopleComplete === true,
        scheduleEpisodePeopleSync,
        bootstrap,
        scheduleBootstrap
    };

    scheduleBootstrap();
    LOG('Module loaded');
})();
