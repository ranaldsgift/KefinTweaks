// KefinTweaks Series Library Cache
// Chunked per-user archive of series (no UserData / MediaStreams / Chapters / Trickplay).
(function() {
    'use strict';

    const LOG = (...args) => console.log('[KefinTweaks Series Cache]', ...args);
    const WARN = (...args) => console.warn('[KefinTweaks Series Cache]', ...args);
    const ERR = (...args) => console.error('[KefinTweaks Series Cache]', ...args);

    const CACHE_NAME = 'series_library';
    const PARTIAL_CACHE_NAME = 'series_library_partial';
    const LAST_FETCH_KEY_PREFIX = 'kefinTweaks_lastDateFetchedSeriesCache_';
    const SERIES_FIELDS = [
        'ProviderIds', 'People', 'Studios', 'Taglines', 'Genres', 'Overview',
        'PrimaryImageAspectRatio', 'ChildCount', 'RecursiveItemCount'
    ].join(',');

    let series = null;
    let isComplete = false;
    let fetchPromise = null;

    function utils() {
        return window.LibraryCacheUtils || {};
    }

    function getTtl() {
        return utils().getLibraryCacheSettings?.().CACHE_TTL || (14 * 24 * 60 * 60 * 1000);
    }

    function getChunkSize() {
        return utils().getLibraryCacheSettings?.().seriesChunkSize || 1000;
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
            WARN('Failed to store lastDateFetchedSeriesCache:', e);
        }
    }

    function getApiHelper() {
        return window.apiHelper || window.ApiHelper;
    }

    function buildItemsUrl({ startIndex, limit, extraParams = {} }) {
        const server = window.ApiClient.serverAddress();
        const params = new URLSearchParams({
            IncludeItemTypes: 'Series',
            Recursive: 'true',
            Fields: SERIES_FIELDS,
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
        return (await api.getQuery(url, { useCache: false })) || { Items: [], TotalRecordCount: 0 };
    }

    async function stripChunk(items) {
        if (utils().stripItemsAsync) {
            return utils().stripItemsAsync(items, 'Series');
        }
        return (items || []).map((item) => utils().stripSeriesForCache?.(item) || item).filter(Boolean);
    }

    async function fetchAndCacheSeries() {
        const cache = window.IndexedDBCache;
        if (!cache) {
            ERR('IndexedDBCache unavailable');
            return [];
        }

        const userId = window.ApiClient.getCurrentUserId();
        const complete = await cache.get(CACHE_NAME, userId);
        if (complete && Array.isArray(complete)) {
            series = complete;
            isComplete = true;
            LOG(`Using complete cached series (${series.length})`);
            return series;
        }

        const chunkSize = getChunkSize();
        let startIndex = 0;
        let collected = [];

        const partial = await cache.get(PARTIAL_CACHE_NAME, userId);
        if (partial && Array.isArray(partial.items) && partial.isComplete !== true) {
            collected = partial.items;
            startIndex = partial.startIndex || collected.length;
            LOG(`Resuming series crawl from index ${startIndex}`);
        }

        try {
            let hasMore = true;
            while (hasMore) {
                const data = await queryItems(buildItemsUrl({ startIndex, limit: chunkSize }));
                const batch = data.Items || [];
                collected = collected.concat(await stripChunk(batch));
                startIndex += batch.length;
                await cache.set(PARTIAL_CACHE_NAME, {
                    isComplete: false,
                    startIndex,
                    items: collected
                }, userId, getTtl());
                LOG(`Series crawl progress: ${collected.length}${data.TotalRecordCount != null ? ` / ${data.TotalRecordCount}` : ''}`);
                if (batch.length < chunkSize) hasMore = false;
                else await yieldToMain();
            }

            series = collected;
            isComplete = true;
            await cache.set(CACHE_NAME, series, userId, getTtl());
            await cache.clear(PARTIAL_CACHE_NAME, userId);
            setLastDateFetched(new Date().toISOString());
            LOG(`Series crawl complete: ${series.length} items`);
            return series;
        } catch (err) {
            ERR('Error fetching series:', err);
            return series || collected || [];
        }
    }

    async function syncSeriesCache() {
        if (!isComplete || !series) {
            LOG('Skip syncSeriesCache: complete cache not ready');
            return series || [];
        }
        const lastFetched = getLastDateFetched();
        if (!lastFetched) return series;

        const cache = window.IndexedDBCache;
        const userId = window.ApiClient.getCurrentUserId();
        const chunkSize = getChunkSize();
        const server = window.ApiClient.serverAddress();

        try {
            let startIndex = 0;
            let incoming = [];
            let hasMore = true;
            while (hasMore) {
                const data = await queryItems(buildItemsUrl({
                    startIndex,
                    limit: chunkSize,
                    extraParams: {
                        MinDateLastSaved: lastFetched,
                        MinDateLastSavedForUser: lastFetched,
                        SortBy: 'DateLastContentAdded',
                        SortOrder: 'Descending'
                    }
                }));
                const batch = data.Items || [];
                incoming = incoming.concat(await stripChunk(batch));
                startIndex += batch.length;
                if (batch.length < chunkSize) hasMore = false;
            }

            const beforeIds = new Set((series || []).map((s) => s.Id).filter(Boolean));
            let removedIds = [];

            if (incoming.length) {
                series = utils().upsertById?.(series, incoming) || series;
                LOG(`Synced ${incoming.length} series upserts`);
            }

            const countParams = new URLSearchParams({
                IncludeItemTypes: 'Series',
                Recursive: 'true',
                ExcludeLocationTypes: 'Virtual',
                EnableTotalRecordCount: 'true',
                Limit: '1',
                StartIndex: '0'
            });
            const countData = await queryItems(`${server}/Items?${countParams.toString()}`);
            const serverCount = countData.TotalRecordCount;
            if (typeof serverCount === 'number' && serverCount !== series.length) {
                LOG(`Series count mismatch cache=${series.length} server=${serverCount}`);
                const serverIds = new Set();
                let idx = 0;
                let more = true;
                while (more) {
                    const idParams = new URLSearchParams({
                        IncludeItemTypes: 'Series',
                        Recursive: 'true',
                        ExcludeLocationTypes: 'Virtual',
                        EnableTotalRecordCount: 'false',
                        Limit: String(chunkSize),
                        StartIndex: String(idx)
                    });
                    const idData = await queryItems(`${server}/Items?${idParams.toString()}`);
                    const batch = idData.Items || [];
                    batch.forEach((item) => {
                        if (item?.Id) serverIds.add(item.Id);
                    });
                    idx += batch.length;
                    if (batch.length < chunkSize) more = false;
                }
                removedIds = [...beforeIds].filter((id) => !serverIds.has(id));
                series = series.filter((s) => s?.Id && serverIds.has(s.Id));
                const cachedIds = new Set(series.map((s) => s.Id));
                const missing = [...serverIds].filter((id) => !cachedIds.has(id));
                for (let i = 0; i < missing.length; i += chunkSize) {
                    const slice = missing.slice(i, i + chunkSize);
                    const byIdParams = new URLSearchParams({
                        Ids: slice.join(','),
                        Fields: SERIES_FIELDS,
                        EnableTotalRecordCount: 'false'
                    });
                    const byIdData = await queryItems(`${server}/Items?${byIdParams.toString()}`);
                    const stripped = await stripChunk(byIdData.Items || []);
                    series = utils().upsertById?.(series, stripped) || series;
                    incoming = incoming.concat(stripped);
                }
            }

            await cache.set(CACHE_NAME, series, userId, getTtl());
            setLastDateFetched(new Date().toISOString());

            if ((incoming.length || removedIds.length) && window.PeopleCache?.applySeriesDelta) {
                try {
                    await window.PeopleCache.applySeriesDelta(incoming, removedIds);
                } catch (e) {
                    WARN('PeopleCache.applySeriesDelta failed:', e);
                }
            }
            return series;
        } catch (err) {
            ERR('syncSeriesCache failed:', err);
            return series || [];
        }
    }

    async function getSeries() {
        if (series && isComplete) return series;
        if (fetchPromise) return fetchPromise;
        fetchPromise = (async () => {
            await fetchAndCacheSeries();
            return series || [];
        })().finally(() => {
            fetchPromise = null;
        });
        return fetchPromise;
    }

    async function getCompletedSeries() {
        const list = await getSeries();
        return (list || []).filter(item => item?.UserData?.Played === true && Number(item.UserData.PlayedPercentage) === 100);
    }

    function isCacheComplete() {
        return isComplete === true && Array.isArray(series);
    }

    async function getSeriesByProviderIds(ids) {
        const list = await getSeries();
        const idSet = new Set();
        (ids || []).forEach((id) => {
            (utils().normalizeProviderKeys?.(id) || []).forEach((k) => idSet.add(k));
        });
        if (!idSet.size) return [];
        return list.filter((item) => utils().itemMatchesProviderIds?.(item, idSet));
    }

    async function initialize() {
        await getSeries();
        if (isCacheComplete() && getLastDateFetched()) {
            await syncSeriesCache();
        }
        return series || [];
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

    window.SeriesCache = {
        init: initialize,
        getSeries,
        getCompletedSeries,
        getSeriesByProviderIds,
        syncSeriesCache,
        fetchAndCacheSeries,
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
            series = null;
            isComplete = false;
            return fetchAndCacheSeries();
        }
    };

    scheduleBootstrap();
    LOG('Module loaded');
})();
