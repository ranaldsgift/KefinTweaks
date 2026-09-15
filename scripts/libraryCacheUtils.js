// KefinTweaks Library Cache Utils
// Shared strip / provider-id helpers for moviesCache, seriesCache, peopleCache
(function() {
    'use strict';

    function stripPerson(person) {
        if (!person) return null;
        return {
            Name: person.Name,
            Id: person.Id,
            Role: person.Role,
            Type: person.Type
        };
    }

    function stripChapter(chapter) {
        if (!chapter) return null;
        return {
            Name: chapter.Name,
            ImageTag: chapter.ImageTag
        };
    }

    function stripMediaStream(stream) {
        if (!stream) return null;
        return {
            Height: stream.Height,
            Width: stream.Width,
            DisplayTitle: stream.DisplayTitle,
            Language: stream.Language,
            Type: stream.Type
        };
    }

    function stripStudio(studio) {
        if (!studio) return null;
        return {
            Name: studio.Name,
            Id: studio.Id
        };
    }

    function stripGenreItem(genre) {
        if (!genre) return null;
        return {
            Name: genre.Name,
            Id: genre.Id
        };
    }

    /**
     * Strip a movie item to the durable library-cache allowlist (no UserData).
     */
    function stripMovieForCache(item) {
        if (!item) return null;
        return {
            Name: item.Name,
            Id: item.Id,
            HasSubtitles: item.HasSubtitles,
            PremiereDate: item.PremiereDate,
            CriticRating: item.CriticRating,
            OfficialRating: item.OfficialRating,
            Overview: item.Overview,
            Taglines: item.Taglines,
            CommunityRating: item.CommunityRating,
            RunTimeTicks: item.RunTimeTicks,
            ProductionYear: item.ProductionYear,
            ProviderIds: item.ProviderIds || {},
            Type: item.Type || 'Movie',
            People: Array.isArray(item.People) ? item.People.map(stripPerson).filter(Boolean) : [],
            Studios: Array.isArray(item.Studios) ? item.Studios.map(stripStudio).filter(Boolean) : [],
            GenreItems: Array.isArray(item.GenreItems) ? item.GenreItems.map(stripGenreItem).filter(Boolean) : [],
            MediaStreams: Array.isArray(item.MediaStreams) ? item.MediaStreams.map(stripMediaStream).filter(Boolean) : [],
            ImageTags: item.ImageTags || {},
            BackdropImageTags: item.BackdropImageTags || [],
            Chapters: Array.isArray(item.Chapters) ? item.Chapters.map(stripChapter).filter(Boolean) : [],
            Trickplay: item.Trickplay || undefined,
            DateCreated: item.DateCreated,
            DateLastSaved: item.DateLastSaved,
            UserData: item.UserData || {}
        };
    }

    /**
     * Strip a series item (no MediaStreams/Chapters/Trickplay).
     */
    function stripSeriesForCache(item) {
        if (!item) return null;
        return {
            Name: item.Name,
            Id: item.Id,
            PremiereDate: item.PremiereDate,
            CriticRating: item.CriticRating,
            OfficialRating: item.OfficialRating,
            Overview: item.Overview,
            Taglines: item.Taglines,
            CommunityRating: item.CommunityRating,
            RunTimeTicks: item.RunTimeTicks,
            ProductionYear: item.ProductionYear,
            ProviderIds: item.ProviderIds || {},
            Type: item.Type || 'Series',
            People: Array.isArray(item.People) ? item.People.map(stripPerson).filter(Boolean) : [],
            Studios: Array.isArray(item.Studios) ? item.Studios.map(stripStudio).filter(Boolean) : [],
            GenreItems: Array.isArray(item.GenreItems) ? item.GenreItems.map(stripGenreItem).filter(Boolean) : [],
            ImageTags: item.ImageTags || {},
            BackdropImageTags: item.BackdropImageTags || [],
            ChildCount: item.ChildCount,
            RecursiveItemCount: item.RecursiveItemCount,
            DateCreated: item.DateCreated,
            DateLastContentAdded: item.DateLastContentAdded,
            DateLastSaved: item.DateLastSaved,
            UserData: item.UserData || {}
        };
    }

    function stripItemsForCache(items, kind) {
        const strip = kind === 'Series' ? stripSeriesForCache : stripMovieForCache;
        return (items || []).map(strip).filter(Boolean);
    }

    /**
     * Normalize provider id keys for matching (Imdb/Tmdb/Tvdb).
     * @param {string|Object} idOrObj
     * @returns {string[]} normalized keys like "imdb:tt123", "tmdb:456"
     */
    function normalizeProviderKeys(idOrObj) {
        const keys = [];
        if (!idOrObj) return keys;
        if (typeof idOrObj === 'string') {
            const s = idOrObj.trim();
            if (!s) return keys;
            if (/^tt\d+$/i.test(s)) keys.push(`imdb:${s.toLowerCase()}`);
            else if (/^\d+$/.test(s)) {
                keys.push(`tmdb:${s}`);
                keys.push(`tvdb:${s}`);
            } else keys.push(s.toLowerCase());
            return keys;
        }
        const p = idOrObj.ProviderIds || idOrObj;
        if (p.Imdb) keys.push(`imdb:${String(p.Imdb).toLowerCase()}`);
        if (p.Tmdb) keys.push(`tmdb:${String(p.Tmdb)}`);
        if (p.Tvdb) keys.push(`tvdb:${String(p.Tvdb)}`);
        return keys;
    }

    function itemMatchesProviderIds(item, idSet) {
        if (!item || !idSet || idSet.size === 0) return false;
        return normalizeProviderKeys(item).some(k => idSet.has(k));
    }

    function buildProviderIdIndex(items) {
        const index = Object.create(null);
        (items || []).forEach((item) => {
            if (!item?.Id) return;
            normalizeProviderKeys(item).forEach((key) => {
                if (!index[key]) index[key] = [];
                if (!index[key].includes(item.Id)) index[key].push(item.Id);
            });
        });
        return index;
    }

    function getLibraryCacheSettings() {
        const fromHome = window.KefinHomeScreen?.getConfig?.()?.LIBRARY_CACHE;
        const fromDefault = window.KefinHomeConfig2?.LIBRARY_CACHE;
        return {
            movieChunkSize: 1000,
            seriesChunkSize: 1000,
            mdblistApiKey: '',
            CACHE_TTL: 14 * 24 * 60 * 60 * 1000,
            ...(fromDefault || {}),
            ...(fromHome || {})
        };
    }

    /**
     * Run strip on main thread; yields between microtasks for UI breathing room.
     * Worker path: Blob worker when available (same strip logic inlined).
     */
    async function stripItemsAsync(items, kind) {
        if (!items || !items.length) return [];
        if (typeof Worker === 'undefined') {
            return stripItemsForCache(items, kind);
        }
        try {
            return await stripItemsInWorker(items, kind);
        } catch (e) {
            console.warn('[KefinTweaks LibraryCacheUtils] Worker strip failed, using main thread:', e);
            return stripItemsForCache(items, kind);
        }
    }

    function stripItemsInWorker(items, kind) {
        return new Promise((resolve, reject) => {
            const workerSource = `
                ${stripPerson.toString()}
                ${stripChapter.toString()}
                ${stripMediaStream.toString()}
                ${stripStudio.toString()}
                ${stripGenreItem.toString()}
                ${stripMovieForCache.toString()}
                ${stripSeriesForCache.toString()}
                ${stripItemsForCache.toString()}
                self.onmessage = function(e) {
                    try {
                        const { items, kind } = e.data;
                        const result = stripItemsForCache(items, kind);
                        self.postMessage({ ok: true, result });
                    } catch (err) {
                        self.postMessage({ ok: false, error: String(err && err.message || err) });
                    }
                };
            `;
            const blob = new Blob([workerSource], { type: 'application/javascript' });
            const url = URL.createObjectURL(blob);
            const worker = new Worker(url);
            const timer = setTimeout(() => {
                worker.terminate();
                URL.revokeObjectURL(url);
                reject(new Error('Worker strip timeout'));
            }, 30000);
            worker.onmessage = (e) => {
                clearTimeout(timer);
                worker.terminate();
                URL.revokeObjectURL(url);
                if (e.data?.ok) resolve(e.data.result);
                else reject(new Error(e.data?.error || 'Worker strip failed'));
            };
            worker.onerror = (err) => {
                clearTimeout(timer);
                worker.terminate();
                URL.revokeObjectURL(url);
                reject(err);
            };
            worker.postMessage({ items, kind });
        });
    }

    function upsertById(existingItems, incomingItems) {
        const map = new Map();
        (existingItems || []).forEach((item) => {
            if (item?.Id) map.set(item.Id, item);
        });
        (incomingItems || []).forEach((item) => {
            if (item?.Id) map.set(item.Id, item);
        });
        return Array.from(map.values());
    }

    function removeByIds(existingItems, removeIds) {
        if (!removeIds || !removeIds.size) return existingItems || [];
        return (existingItems || []).filter((item) => item?.Id && !removeIds.has(item.Id));
    }

    window.LibraryCacheUtils = {
        stripMovieForCache,
        stripSeriesForCache,
        stripPerson,
        stripItemsForCache,
        stripItemsAsync,
        normalizeProviderKeys,
        itemMatchesProviderIds,
        buildProviderIdIndex,
        getLibraryCacheSettings,
        upsertById,
        removeByIds
    };
})();
