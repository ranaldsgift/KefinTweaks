// KefinTweaks People Cache
// Built from MoviesCache + SeriesCache; episode credits via /Shows/{id}/Episodes (not a global episode store).
(function() {
    'use strict';

    const LOG = (...args) => console.log('[KefinTweaks PeopleCache]', ...args);
    const WARN = (...args) => console.warn('[KefinTweaks PeopleCache]', ...args);
    const ERR = (...args) => console.error('[KefinTweaks PeopleCache]', ...args);

    const CACHE_NAME = 'library_top_people_v2';
    const DEFAULT_MIN = 10;
    const DEFAULT_PER_TYPE_MAX = 100;
    const EPISODE_FETCH_CONCURRENCY = 6;

    let peopleMap = null; // Map<personId, Person>
    let filteredLists = null; // { actors, directors, writers }
    let isComplete = false;
    let fetchPromise = null;
    let initPromise = null;

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

    function movieRoleCount(person, role) {
        const m = person.movies || {};
        if (role === 'Actor') return m.actorCount || 0;
        if (role === 'Director') return m.directorCount || 0;
        if (role === 'Writer') return m.writerCount || 0;
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

    function ensurePerson(map, person) {
        const key = person?.Id;
        if (!key) return null;
        if (!map.has(key)) {
            map.set(key, {
                Id: person.Id,
                Name: person.Name,
                movies: {
                    directorCount: 0,
                    writerCount: 0,
                    actorCount: 0,
                    directorItems: [],
                    writerItems: [],
                    actorItems: []
                },
                series: {
                    count: 0,
                    items: [],
                    actorCount: 0,
                    directorCount: 0,
                    writerCount: 0
                }
            });
        } else if (person.Name && !map.get(key).Name) {
            map.get(key).Name = person.Name;
        }
        return map.get(key);
    }

    function pushUniqueId(arr, id) {
        if (!id) return false;
        if (arr.includes(id)) return false;
        arr.push(id);
        return true;
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
        if (!movie?.People || !movie.Id) return;
        movie.People.forEach((person) => {
            const personData = ensurePerson(map, person);
            if (!personData) return;
            const m = personData.movies;
            if (person.Type === 'Director') {
                if (pushUniqueId(m.directorItems, movie.Id)) m.directorCount = m.directorItems.length;
            } else if (person.Type === 'Writer') {
                if (pushUniqueId(m.writerItems, movie.Id)) m.writerCount = m.writerItems.length;
            } else if (person.Type === 'Actor') {
                if (pushUniqueId(m.actorItems, movie.Id)) m.actorCount = m.actorItems.length;
            }
        });
    }

    function applySeriesPeople(map, seriesItem) {
        if (!seriesItem?.People || !seriesItem.Id) return;
        seriesItem.People.forEach((person) => {
            const personData = ensurePerson(map, person);
            if (!personData) return;
            if (pushUniqueId(personData.series.items, seriesItem.Id)) {
                personData.series.count = personData.series.items.length;
            }
        });
    }

    function applyEpisodePeople(map, seriesId, episode) {
        if (!episode?.People || !episode.Id || !seriesId) return;
        episode.People.forEach((person) => {
            const personData = ensurePerson(map, person);
            if (!personData) return;
            bumpEpisodeRole(personData.series, person.Type, 1);
        });
    }

    function decrementEpisodePeople(map, episode) {
        if (!episode?.People || !map) return;
        episode.People.forEach((person) => {
            const personData = person?.Id ? map.get(person.Id) : null;
            if (!personData) return;
            bumpEpisodeRole(personData.series, person.Type, -1);
        });
    }

    function removeMovieFromPeople(map, movieId) {
        if (!map || !movieId) return;
        map.forEach((person) => {
            const m = person.movies;
            ['directorItems', 'writerItems', 'actorItems'].forEach((key) => {
                const before = m[key].length;
                m[key] = m[key].filter((id) => id !== movieId);
                if (m[key].length !== before) {
                    if (key === 'directorItems') m.directorCount = m[key].length;
                    if (key === 'writerItems') m.writerCount = m[key].length;
                    if (key === 'actorItems') m.actorCount = m[key].length;
                }
            });
        });
    }

    function removeSeriesMembership(map, seriesId) {
        if (!map || !seriesId) return;
        map.forEach((person) => {
            person.series.items = person.series.items.filter((id) => id !== seriesId);
            person.series.count = person.series.items.length;
        });
    }

    async function fetchEpisodesForSeries(seriesId) {
        const api = window.apiHelper || window.ApiHelper;
        const server = window.ApiClient.serverAddress();
        const url = `${server}/Shows/${seriesId}/Episodes?Fields=People&EnableTotalRecordCount=false`;
        const data = await api.getQuery(url, { useCache: false });
        return data?.Items || [];
    }

    /**
     * Fetch episodes for many series with limited concurrency.
     * @param {Array<{Id: string}|string>} seriesList
     * @param {(seriesId: string, episodes: Array) => void} onSeriesEpisodes
     */
    async function fetchEpisodesForSeriesBatched(seriesList, onSeriesEpisodes) {
        const list = (seriesList || [])
            .map((s) => (typeof s === 'string' ? { Id: s } : s))
            .filter((s) => s?.Id);
        let completed = 0;
        for (let i = 0; i < list.length; i += EPISODE_FETCH_CONCURRENCY) {
            const chunk = list.slice(i, i + EPISODE_FETCH_CONCURRENCY);
            await Promise.all(chunk.map(async (s) => {
                try {
                    const episodes = await fetchEpisodesForSeries(s.Id);
                    onSeriesEpisodes(s.Id, episodes);
                } catch (e) {
                    WARN(`Failed episodes for series ${s.Id}:`, e);
                }
            }));
            completed += chunk.length;
            const prev = completed - chunk.length;
            if (completed === list.length || Math.floor(prev / 25) !== Math.floor(completed / 25)) {
                LOG(`Episode people progress: ${completed}/${list.length} series`);
            }
        }
    }

    async function subtractEpisodeCreditsForSeriesIds(map, seriesIds) {
        const ids = (seriesIds || []).filter(Boolean);
        if (!ids.length || !map) return;
        await fetchEpisodesForSeriesBatched(ids, (_seriesId, episodes) => {
            episodes.forEach((ep) => decrementEpisodePeople(map, ep));
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

    async function rebuildAllEpisodeRoleCounts(map) {
        clearEpisodeRoleCounts(map);
        const seriesList = await window.SeriesCache?.getSeries?.() || [];
        await fetchEpisodesForSeriesBatched(seriesList, (seriesId, episodes) => {
            episodes.forEach((ep) => applyEpisodePeople(map, seriesId, ep));
        });
    }

    function roleCount(person, role, itemType) {
        const movieCount = movieRoleCount(person, role);
        const seriesCount = person.series?.count || 0;
        const episodeCount = episodeRoleCount(person, role);
        if (itemType === 'Movie') return movieCount;
        if (itemType === 'Series') return seriesCount;
        if (itemType === 'Episode') return episodeCount;
        if (isAggregateItemType(itemType)) return movieCount + seriesCount + episodeCount;
        return 0;
    }

    function roleItems(person, role, itemType) {
        if (itemType === 'Movie') {
            if (role === 'Actor') return person.movies.actorItems || [];
            if (role === 'Director') return person.movies.directorItems || [];
            if (role === 'Writer') return person.movies.writerItems || [];
            return [];
        }
        if (itemType === 'Series') return person.series.items || [];
        if (itemType === 'Episode') return [];
        if (isAggregateItemType(itemType)) {
            const movieItems = roleItems(person, role, 'Movie');
            const seriesItems = person.series.items || [];
            return [...movieItems, ...seriesItems];
        }
        return [];
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
                    Id: person.Id,
                    Name: person.Name,
                    count,
                    items: roleItems(person, role, type),
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
            isComplete: true
        };
    }

    async function persistPeople() {
        const cache = window.IndexedDBCache;
        if (!cache || !peopleMap) return;
        prunePeopleMap(peopleMap);
        const userId = window.ApiClient.getCurrentUserId();
        const ttl = window.LibraryCacheUtils?.getLibraryCacheSettings?.().CACHE_TTL || (14 * 24 * 60 * 60 * 1000);
        const payload = {
            isComplete: true,
            loadPeopleEpisodeData: shouldLoadPeopleEpisodeData(),
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

                if (shouldLoadPeopleEpisodeData()) {
                    await fetchEpisodesForSeriesBatched(seriesList, (seriesId, episodes) => {
                        episodes.forEach((ep) => applyEpisodePeople(map, seriesId, ep));
                    });
                } else {
                    LOG('Skipping episode people fetch (loadPeopleEpisodeData disabled)');
                }

                peopleMap = map;
                prunePeopleMap(map);
                isComplete = true;
                rebuildFilteredLists();
                await persistPeople();
                LOG(`People cache complete: ${peopleMap.size} people`);
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
                        // Legacy caches (no flag) always included episode data
                        const cachedMode = typeof cached.loadPeopleEpisodeData === 'boolean'
                            ? cached.loadPeopleEpisodeData
                            : true;
                        if (cachedMode !== currentMode) {
                            LOG(`People cache episode mode mismatch (cached=${cachedMode}, current=${currentMode}); rebuilding`);
                            await cache.clear?.(CACHE_NAME, userId);
                        } else {
                            peopleMap = new Map(cached.peopleData);
                            const before = peopleMap.size;
                            prunePeopleMap(peopleMap);
                            isComplete = true;
                            rebuildFilteredLists();
                            LOG('Loaded people cache from IndexedDB');
                            if (peopleMap.size < before) {
                                await persistPeople();
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

    async function applyMovieDelta(changedMovies, removedIds) {
        if (!peopleMap) await initialize();
        if (!peopleMap) return;
        (removedIds || []).forEach((id) => removeMovieFromPeople(peopleMap, id));
        (changedMovies || []).forEach((movie) => {
            removeMovieFromPeople(peopleMap, movie.Id);
            applyMoviePeople(peopleMap, movie);
        });
        prunePeopleMap(peopleMap);
        rebuildFilteredLists();
        await persistPeople();
    }

    async function applySeriesDelta(changedSeries, removedIds) {
        if (!peopleMap) await initialize();
        if (!peopleMap) return;

        const removed = (removedIds || []).filter(Boolean);
        const changed = (changedSeries || []).filter((s) => s?.Id);
        const loadEpisodes = shouldLoadPeopleEpisodeData();

        if (removed.length) {
            removed.forEach((id) => removeSeriesMembership(peopleMap, id));
            changed.forEach((s) => {
                removeSeriesMembership(peopleMap, s.Id);
                applySeriesPeople(peopleMap, s);
            });
            if (loadEpisodes) {
                // Without per-series episode indexes, any removal requires a full episode recount.
                await rebuildAllEpisodeRoleCounts(peopleMap);
            } else {
                clearEpisodeRoleCounts(peopleMap);
            }
        } else {
            if (loadEpisodes) {
                // Changed-only: decrement this series' episode credits, refresh membership, re-apply episodes.
                await subtractEpisodeCreditsForSeriesIds(peopleMap, changed.map((s) => s.Id));
            }
            changed.forEach((s) => {
                removeSeriesMembership(peopleMap, s.Id);
                applySeriesPeople(peopleMap, s);
            });
            if (loadEpisodes) {
                await fetchEpisodesForSeriesBatched(changed, (seriesId, episodes) => {
                    episodes.forEach((ep) => applyEpisodePeople(peopleMap, seriesId, ep));
                });
            }
        }

        prunePeopleMap(peopleMap);
        rebuildFilteredLists();
        await persistPeople();
    }

    async function invalidate() {
        LOG('Invalidating people cache (in-memory + IndexedDB)');
        peopleMap = null;
        filteredLists = null;
        isComplete = false;
        fetchPromise = null;
        initPromise = null;
        try {
            const cache = window.IndexedDBCache;
            const userId = window.ApiClient?.getCurrentUserId?.();
            if (cache?.clear) {
                await cache.clear(CACHE_NAME, userId);
            }
        } catch (e) {
            WARN('Failed to clear people IDB cache:', e);
        }
        // Rebuild on next demand; kick off in background if caches are ready
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
            // Wait for library caches to finish first crawl
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
        bootstrap,
        scheduleBootstrap
    };

    scheduleBootstrap();
    LOG('Module loaded');
})();
