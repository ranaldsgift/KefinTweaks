(function() {
    'use strict';
    
    const KEFIN_TWEAKS_CONFIG = {
        kefinTweaksRoot: 'https://ranaldsgift.github.io/KefinTweaks/',
        scriptRoot: 'https://ranaldsgift.github.io/KefinTweaks/scripts/',
        
        scripts: {
            collections: true,
            homeScreen: true,
            search: true,
            watchlist: true,
            headerTabs: true,
            customMenuLinks: true,
            breadcrumbs: true,
            playlist: true,
            itemDetailsCollections: true,
            flattenSingleSeasonShows: true,
            exclusiveElsewhere: false,
            backdropLeakFix: true,
            dashboardButtonFix: true,
            infiniteScroll: true,
            removeContinue: true,
            subtitleSearch: true,
            skinManager: true
        },
        homeScreen: {
            enableNewAndTrending: true,
            enableNewMovies: true,
            enableNewEpisodes: true,
            enableTrending: false,
            enableDiscovery: true,
            enableInfiniteScroll: true,
            minPeopleAppearances: 10,
            minGenreMovieCount: 50,
            minimumShowsForNetwork: 5,
            enableWatchlist: true,
            enableSeasonal: true,
            seasonalItemLimit: 16,
            customSections: [],
        },
        exclusiveElsewhere: {
            hideServerName: false
        },
        search: {
            enableJellyseerr: false
        },
        skins: [],
        defaultSkin: null,
        themes: [],
        customMenuLinks: [],
    };
    
    window.KefinTweaksConfig = KEFIN_TWEAKS_CONFIG;
    
    const script = document.createElement("script");
    script.src = `${KEFIN_TWEAKS_CONFIG.kefinTweaksRoot}injector.js?v=${new Date().getTime()}`;
    script.async = true;
    document.head.appendChild(script);
    
    console.log('[KefinTweaks] Central configuration loaded. Available at window.KefinTweaksConfig');    
})();

