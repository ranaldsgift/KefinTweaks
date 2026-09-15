// KefinTweaks External List (MDBList) — match provider IDs against library caches
(function() {
    'use strict';

    const LOG = (...args) => console.log('[KefinTweaks ExternalList]', ...args);
    const WARN = (...args) => console.warn('[KefinTweaks ExternalList]', ...args);
    const ERR = (...args) => console.error('[KefinTweaks ExternalList]', ...args);

    function getMdblistApiKey() {
        const settings = window.LibraryCacheUtils?.getLibraryCacheSettings?.() || {};
        return (settings.mdblistApiKey || '').trim();
    }

    function appendApiKey(url, apiKey) {
        if (!apiKey) return url;
        try {
            const u = new URL(url);
            if (!u.searchParams.has('apikey') && !u.searchParams.has('api_key')) {
                u.searchParams.set('apikey', apiKey);
            }
            return u.toString();
        } catch (_) {
            const join = url.includes('?') ? '&' : '?';
            return `${url}${join}apikey=${encodeURIComponent(apiKey)}`;
        }
    }

    /**
     * Normalize mdblist (or similar) JSON into { mediaType, imdb?, tmdb? }[].
     */
    function normalizeExternalListPayload(data) {
        const rows = [];
        const list = Array.isArray(data) ? data
            : Array.isArray(data?.movies) || Array.isArray(data?.shows) || Array.isArray(data?.items)
                ? [...(data.movies || []), ...(data.shows || []), ...(data.items || [])]
                : [];

        list.forEach((entry) => {
            if (!entry || typeof entry !== 'object') return;
            const mediaType = /show|series|tv/i.test(String(entry.mediatype || entry.media_type || entry.type || ''))
                ? 'Series'
                : 'Movie';
            const imdb = entry.imdb_id || entry.imdbid || entry.ids?.imdb || entry.Imdb || null;
            const tmdb = entry.tmdb_id || entry.tmdbid || entry.ids?.tmdb || entry.Tmdb || null;
            if (imdb || tmdb) {
                rows.push({ mediaType, imdb: imdb ? String(imdb) : undefined, tmdb: tmdb ? String(tmdb) : undefined });
            }
        });
        return rows;
    }

    async function fetchExternalListUrl(url) {
        const apiKey = getMdblistApiKey();
        const fetchUrl = appendApiKey(url, apiKey);
        const response = await fetch(fetchUrl, { headers: { Accept: 'application/json' } });
        if (!response.ok) {
            throw new Error(`External list HTTP ${response.status}`);
        }
        return response.json();
    }

    async function resolveExternalListItems(sectionConfig) {
        const urls = sectionConfig?.externalListUrls || [];
        if (!urls.length) return { Items: [] };

        if (!getMdblistApiKey()) {
            WARN('MDBList API key not configured');
        }

        const allRows = [];
        for (const url of urls) {
            if (!url) continue;
            try {
                const data = await fetchExternalListUrl(url);
                allRows.push(...normalizeExternalListPayload(data));
            } catch (e) {
                ERR('Failed to fetch external list:', url, e);
            }
        }

        const movieIds = [];
        const seriesIds = [];
        allRows.forEach((row) => {
            const keys = [];
            if (row.imdb) keys.push(row.imdb);
            if (row.tmdb) keys.push(row.tmdb);
            if (row.mediaType === 'Series') seriesIds.push(...keys);
            else movieIds.push(...keys);
        });

        const movies = movieIds.length
            ? await (window.LibraryCache?.getByProviderIds('Movie', movieIds)
                || window.MoviesCache?.getMoviesByProviderIds?.(movieIds)
                || [])
            : [];
        const series = seriesIds.length
            ? await (window.LibraryCache?.getByProviderIds('Series', seriesIds)
                || window.SeriesCache?.getSeriesByProviderIds?.(seriesIds)
                || [])
            : [];

        const items = [...movies, ...series];
        LOG(`External list matched ${items.length} library items from ${allRows.length} rows`);
        return { Items: items };
    }

    window.KefinExternalList = {
        getMdblistApiKey,
        resolveExternalListItems,
        normalizeExternalListPayload
    };

    LOG('Module loaded');
})();
