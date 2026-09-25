// KefinTweaks Library Cache Facade
// Routes provider-id lookups and readiness checks to MoviesCache / SeriesCache
(function() {
    'use strict';

    const LOG = (...args) => console.log('[KefinTweaks LibraryCache]', ...args);

    function normalizeType(type) {
        const t = String(type || '').toLowerCase();
        if (t === 'movie' || t === 'movies') return 'Movie';
        if (t === 'series' || t === 'show' || t === 'shows' || t === 'tv') return 'Series';
        return type;
    }

    async function isComplete(type) {
        const t = normalizeType(type);
        if (t === 'Movie') return (await window.MoviesCache?.isComplete?.()) === true;
        if (t === 'Series') return window.SeriesCache?.isComplete?.() === true;
        return false;
    }

    async function isReady(type) {
        return isComplete(type);
    }

    async function getByProviderIds(type, ids) {
        const t = normalizeType(type);
        if (t === 'Movie') {
            return window.MoviesCache?.getMoviesByProviderIds?.(ids) || [];
        }
        if (t === 'Series') {
            return window.SeriesCache?.getSeriesByProviderIds?.(ids) || [];
        }
        LOG('Unknown type for getByProviderIds:', type);
        return [];
    }

    /**
     * Whether a dataSource string depends on an incomplete Movies/Series/People cache.
     */
    async function dataSourceDependsOnIncompleteCache(dataSource) {
        const ds = typeof dataSource === 'string' ? dataSource : '';
        if (!ds) return false;
        if (ds.startsWith('MoviesCache.') && !(await isComplete('Movie'))) return true;
        if (ds.startsWith('SeriesCache.') && !(await isComplete('Series'))) return true;
        if (ds.startsWith('PeopleCache.') && window.PeopleCache?.isComplete && !window.PeopleCache.isComplete()) {
            return true;
        }
        return false;
    }

    /**
     * Whether a home section depends on a library/people/external cache that is not ready.
     */
    async function sectionDependsOnIncompleteCache(section) {
        if (!section) return false;
        if (Array.isArray(section.externalListUrls) && section.externalListUrls.length) {
            return !((await isComplete('Movie')) && (await isComplete('Series')));
        }
        if (await dataSourceDependsOnIncompleteCache(section.discoverySourceQuery?.dataSource)) {
            return true;
        }
        const queries = section.queries || [];
        for (const q of queries) {
            if (await dataSourceDependsOnIncompleteCache(q?.dataSource)) return true;
        }
        return false;
    }

    window.LibraryCache = {
        getByProviderIds,
        isReady,
        isComplete,
        sectionDependsOnIncompleteCache
    };

    LOG('Module loaded');
})();
