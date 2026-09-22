// KefinTweaks Home Screen Section Editor Profiles

(function() {
    'use strict';

    const EDITOR_PROFILES = {
        full: {
            queryFields: 'all',
            advancedFields: 'all',
            lockVisibility: false,
            allowGroupChange: true,
            allowItemSourceChange: true
        },
        minimal: {
            queryFields: ['limit'],
            advancedFields: ['cache', 'useParentCard'],
            lockVisibility: true,
            allowGroupChange: false,
            allowItemSourceChange: false,
            hideCustomItems: true
        },
        postProcessing: {
            queryFields: ['limit'],
            advancedFields: ['cache', 'sectionSort', 'minimumItems', 'itemLimit', 'limitBeforeSort'],
            lockVisibility: true,
            allowGroupChange: false,
            allowItemSourceChange: false,
            hideCustomItems: true
        },
        normal: {
            queryFields: ['limit', 'sortBy', 'sortOrder'],
            advancedFields: ['cache', 'sectionSort', 'itemLimit', 'minimumItems', 'flattenSeries', 'limitBeforeSort'],
            lockVisibility: true,
            allowGroupChange: false,
            allowItemSourceChange: false
        },
        dateCutoffs: {
            queryFields: ['limit', 'sortBy', 'sortOrder'],
            advancedFields: ['cache', 'sectionSort', 'itemLimit', 'minimumItems', 'flattenSeries', 'limitBeforeSort', 'minAge', 'maxAge'],
            lockVisibility: true,
            allowGroupChange: false,
            allowItemSourceChange: false
        }
    };

    const SECTION_PROFILE_BY_ID = {
        'my-media': 'minimal',
        'my-media-small': 'minimal',
        'continueWatching': 'minimal',
        'nextUp': 'minimal',
        'continueWatchingAndNextUp': 'minimal',
        'continueListening': 'minimal',
        'continueReading': 'minimal',
        'upcoming': 'minimal',
        'thematic-story-origins': 'minimal',
        'thematic-core-concepts': 'minimal',
        'thematic-crime-stories': 'minimal',
        'thematic-character-perspective': 'minimal',
        'thematic-settings': 'minimal',
        'thematic-tone-style': 'minimal',
        'thematic-themes-topics': 'minimal',

        'popularTVStudios': 'postProcessing',
        'popularMovieStudios': 'postProcessing',
        'popularStudios': 'postProcessing',

        'recentlyReleased.movies': 'dateCutoffs',
        'recentlyReleased.episodes': 'dateCutoffs',

        'liveTv-recordings': 'normal',
        'liveTv-timers': 'normal',
        'liveTv-browse': 'normal',
        'liveTv-on-now': 'normal',
        'liveTv-programs': 'normal',
        'liveTv-channels': 'normal',
        'liveTv-series-on-now': 'normal',
        'liveTv-movies-on-now': 'normal',
        'liveTv-sports-on-now': 'normal',
        'liveTv-news-on-now': 'normal',
        'liveTv-kids-on-now': 'normal',
        'imdbTop250': 'normal',
        'watchAgain': 'normal',
        'watchlist': 'normal',
        'resumePlaylists': 'normal',
        'completeCollections': 'normal',
        'playlists': 'normal',
        'collections': 'normal',

        'seasonal.halloween.halloween-tag': 'normal',
        'seasonal.halloween.halloween-horror': 'normal',
        'seasonal.halloween.halloween-thriller': 'normal',
        'seasonal.christmas.christmas-movies': 'normal',
        'seasonal.christmas.christmas-episodes': 'normal',
        'seasonal.new-years.new-years-movies': 'normal',
        'seasonal.new-years.new-years-episodes': 'normal',
        'seasonal.valentines.valentines-movies': 'normal',
        'seasonal.valentines.valentines-episodes': 'normal',
        'seasonal.thanksgiving.thanksgiving-movies': 'normal',
        'seasonal.thanksgiving.thanksgiving-episodes': 'normal',

        'genreMovies': 'normal',
        'spotlightGenre': 'normal',
        'directedByTopDirector': 'normal',
        'writtenByTopWriter': 'normal',
        'starringTopActor': 'normal',
        'starringActorRecentlyWatched': 'normal',
        'directedByDirectorRecentlyWatched': 'normal',
        'writtenByWriterRecentlyWatched': 'normal',
        'becauseYouWatched': 'normal',
        'becauseYouRecentlyWatched': 'normal',
        'becauseYouLiked': 'normal',
        'studioShows': 'normal',
        'spotlightNetwork': 'normal'
    };

    const SECTION_PROFILE_BY_PREFIX = [
        { prefix: 'custom-', profile: 'full' },
        { prefix: 'recently-added-', profile: 'minimal' },
        { prefix: 'popular-genres-', profile: 'minimal' }
    ];

    function isKnownDefaultSection(sectionId) {
        if (!sectionId || sectionId.startsWith('custom-')) return false;
        if (SECTION_PROFILE_BY_ID[sectionId]) return true;
        return SECTION_PROFILE_BY_PREFIX.some((rule) => sectionId.startsWith(rule.prefix));
    }

    function resolveEditorProfile(section, context = {}) {
        const id = section?.id;
        if (!id) return 'full';

        if (SECTION_PROFILE_BY_ID[id]) {
            return SECTION_PROFILE_BY_ID[id];
        }

        const prefixRule = SECTION_PROFILE_BY_PREFIX.find((rule) => id.startsWith(rule.prefix));
        if (prefixRule) {
            return prefixRule.profile;
        }

        if (id === 'collections' && context.groupType === 'DISCOVERY_SECTION_GROUPS') {
            return 'normal';
        }

        if (context.isCustomSection) {
            return 'full';
        }

        console.warn('[KefinHomeScreenEditorProfiles] No profile for section:', id);
        return 'normal';
    }

    function getEditorProfileDefinition(profileKey) {
        return EDITOR_PROFILES[profileKey] || EDITOR_PROFILES.full;
    }

    window.KefinHomeScreenEditorProfiles = {
        EDITOR_PROFILES,
        SECTION_PROFILE_BY_ID,
        SECTION_PROFILE_BY_PREFIX,
        isKnownDefaultSection,
        resolveEditorProfile,
        getEditorProfileDefinition
    };
})();
