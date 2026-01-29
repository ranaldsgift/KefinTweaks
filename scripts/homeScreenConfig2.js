// KefinTweaks Home Screen Configuration 2
// Streamlined configuration with queries array format
// Defines default sections, discovery templates, and cache settings
(function() {
    'use strict';

    // Default Cache Configuration (times in milliseconds)
    const CACHE_CONFIG = {
        DEFAULT_TTL: 60 * 60 * 1000,           // 1 hour
        VERY_SHORT_TTL: 1 * 60 * 1000,         // 1 minute
        SHORT_TTL: 5 * 60 * 1000,              // 5 minutes
        LONG_TTL: 24 * 60 * 60 * 1000,          // 24 hours
        STATIC_TTL: 7 * 24 * 60 * 60 * 1000,   // 1 week
        DISCOVERY_TTL: 6 * 60 * 60 * 1000,      // 6 hours
        FORCE_REFRESH_TTL: 0                    // 0
    };

    // Standard Home Sections (non-seasonal)
    // New streamlined format with queries array, organized into groups
    const KEFINTWEAKS_HOME_SECTION_GROUPS = [
        // Continue Watching Group
        {
            id: 'home-continue-watching',
            name: 'Continue Watching',
            sections: [
                {
                    id: 'continueWatching',
                    name: 'Resume',
                    enabled: false,
                    hidden: false,
                    order: 10,
                    cardFormat: 'Thumb',
                    ttl: CACHE_CONFIG.FORCE_REFRESH_TTL,
                    queries: [
                        {
                            queryOptions: {
                                SortBy: 'DatePlayed',
                                SortOrder: 'Descending',
                                Filters: 'IsResumable',
                                IncludeItemTypes: ['Episode', 'Movie'],
                                Limit: 24
                            }
                        }
                    ]
                },
                {
                    id: 'nextUp',
                    name: 'Next Up',
                    enabled: false,
                    hidden: false,
                    order: 11,
                    cardFormat: 'Thumb',
                    ttl: CACHE_CONFIG.FORCE_REFRESH_TTL,
                    queries: [
                        {
                            path: '/Shows/NextUp',
                            queryOptions: {
                                Limit: 24,
                                EnableResumable: 'false'
                            }
                        }
                    ]
                },
                {
                    id: 'continueWatchingAndNextUp',
                    name: 'Continue Watching',
                    enabled: false, // Disabled by default - only used when merge setting is enabled
                    order: 10,
                    hidden: true,
                    cardFormat: 'Thumb',
                    ttl: CACHE_CONFIG.FORCE_REFRESH_TTL,
                    sortBy: 'DatePlayed',      // Used to sort merged results from both queries
                    sortOrder: 'Descending',   // Most recent first
                    queries: [
                        {
                            // Continue Watching (Movies only when merged)
                            queryOptions: {
                                SortBy: 'DatePlayed',
                                SortOrder: 'Descending',
                                Filters: 'IsResumable',
                                IncludeItemTypes: ['Movie'],
                                Limit: 24
                            }
                        },
                        {
                            // Next Up (Episodes)
                            path: '/Shows/NextUp',
                            queryOptions: {
                                Limit: 24,
                                EnableResumable: 'true'
                            }
                        }
                    ]
                }
            ]
        },
        // Upcoming Group
        {
            id: 'home-upcoming',
            name: 'Upcoming',
            sections: [
                {
                    id: 'upcoming',
                    name: 'Coming Soon',
                    enabled: true,
                    order: 60,
                    cardFormat: 'Thumb',
                    flattenSeries: true,
                    ttl: CACHE_CONFIG.LONG_TTL,
                    queries: [
                        {
                            path: '/Shows/Upcoming',
                            queryOptions: {
                                Limit: 48,
                            }
                        }
                    ]
                }
            ]
        },
        // Recently Released Group
        {
            id: 'home-recently-released',
            name: 'Recently Released',
            sections: [
                {
                    id: 'recentlyReleased.movies',
                    name: 'Recently Released Movies',
                    enabled: true,
                    order: 20,
                    cardFormat: 'Poster',
                    ttl: CACHE_CONFIG.DEFAULT_TTL,
                    queries: [
                        {
                            minAge: 0,
                            maxAge: 30,
                            queryOptions: {
                                IncludeItemTypes: ['Movie'],
                                SortBy: 'PremiereDate',
                                SortOrder: 'Descending',
                                Limit: 16,
                                Fields: 'PremiereDate'
                            }
                        }
                    ]
                },
                {
                    id: 'recentlyReleased.episodes',
                    name: 'Recently Aired Episodes',
                    enabled: true,
                    order: 21,
                    cardFormat: 'Thumb',
                    flattenSeries: true,
                    ttl: CACHE_CONFIG.DEFAULT_TTL,
                    queries: [
                        {
                            minAge: 0,
                            maxAge: 7,
                            queryOptions: {
                                IncludeItemTypes: ['Episode'],
                                IsMissing: 'false',
                                SortBy: 'PremiereDate',
                                SortOrder: 'Descending',
                                Limit: 100 // Fetch more for dedupe
                            }
                        }
                    ]
                }
            ]
        },
        // IMDb Top 250 Group
        {
            id: 'home-imdb-top-250',
            name: 'IMDb Top 250',
            sections: [
                {
                    id: 'imdbTop250',
                    name: 'IMDb Top 250',
                    enabled: true,
                    order: 70,
                    cardFormat: 'Poster',
                    ttl: CACHE_CONFIG.LONG_TTL,
                    queries: [
                        {
                            dataSource: 'MoviesCache.getImdbTop250Movies',
                            queryOptions: {
                                Limit: 20,
                                SortBy: 'Random',
                                IncludeItemTypes: ['Movie']
                            }
                        }
                    ]
                }
            ]
        },
        // Popular TV Networks Group
        {
            id: 'home-popular-tv-networks',
            name: 'Popular TV Networks',
            sections: [
                {
                    id: 'popularTVNetworks',
                    name: 'Popular TV Networks',
                    enabled: true,
                    order: 72,
                    cardFormat: 'Thumb',
                    ttl: CACHE_CONFIG.STATIC_TTL,
                    queries: [
                        {
                            dataSource: 'StudiosCache.getPopularTVNetworks',
                            queryOptions: {
                                SortBy: 'SortName',
                                Limit: 20
                            }
                        }
                    ]
                }
            ]
        },
        // Watch Again Group
        {
            id: 'home-watch-again',
            name: 'Watch Again',
            sections: [
                {
                    id: 'watchAgain',
                    name: 'Watch Again',
                    enabled: true,
                    order: 73,
                    cardFormat: 'Random',
                    ttl: CACHE_CONFIG.DEFAULT_TTL,
                    queries: [
                        {
                            queryOptions: {
                                Filters: 'IsPlayed',
                                IncludeItemTypes: ['Movie'],
                                SortBy: 'Random',
                                Limit: 20
                            }
                        }
                    ]
                }
            ]
        },
        // Watchlist Group
        {
            id: 'home-watchlist',
            name: 'Watchlist',
            sections: [
                {
                    id: 'watchlist',
                    name: 'Watchlist',
                    enabled: true,
                    order: 71,
                    cardFormat: 'Poster',
                    ttl: CACHE_CONFIG.DEFAULT_TTL,
                    queries: [
                        {
                            queryOptions: {
                                Filters: 'Likes',
                                SortBy: 'DateCreated',
                                SortOrder: 'Descending',
                                Limit: 20
                            }
                        }
                    ]
                }
            ]
        },
        // Resume Playlists Group
        {
            id: 'home-resume-playlists',
            name: 'Pick Up Where You Left Off',
            sections: [
                {
                    id: 'resumePlaylists',
                    name: 'Continue Watching Your Playlists',
                    enabled: false,
                    order: 74,
                    cardFormat: 'Poster',
                    ttl: CACHE_CONFIG.DEFAULT_TTL,
                    queries: [
                        {
                            queryOptions: {
                                IsUnplayed: true,
                                IncludeItemTypes: ['Playlist'],
                                SortBy: 'PlayedPercentage',
                                SortOrder: 'Descending',
                                Limit: 0
                            }
                        }
                    ]
                },
                {
                    id: 'completeCollections',
                    name: 'Finish Watching Your Collections',
                    enabled: false,
                    order: 75,
                    cardFormat: 'Poster',
                    ttl: CACHE_CONFIG.DEFAULT_TTL,
                    queries: [
                        {
                            queryOptions: {
                                IsUnplayed: true,
                                IncludeItemTypes: ['BoxSet'],
                                SortBy: 'PlayedPercentage',
                                SortOrder: 'Descending'
                            }
                        }
                    ]
                }
            ]
        }
    ];

    // Seasonal Sections
    // Sections that only appear during specific date ranges
    const KEFINTWEAKS_SEASONAL_SECTION_GROUPS = [
        // Seasonal Sections - Halloween
        {
            id: 'seasonal-halloween',
            name: 'Halloween',
            sections: [
                {
                    id: 'seasonal.halloween.halloween-tag',
                    name: 'Halloween Movies',
                    enabled: true,
                    startDate: '10-01',
                    endDate: '10-31',
                    order: 50,
                    cardFormat: 'Poster',
                    queries: [
                        {
                            queryOptions: {
                                Tags: 'halloween',
                                IncludeItemTypes: ['Movie'],
                                SortBy: 'Random',
                                Limit: 20
                            }
                        }
                    ]
                },
                {
                    id: 'seasonal.halloween.halloween-horror',
                    name: 'Horror Movies',
                    enabled: true,
                    startDate: '10-01',
                    endDate: '10-31',
                    order: 51,
                    cardFormat: 'Poster',
                    queries: [
                        {
                            queryOptions: {
                                Genres: 'Horror',
                                IncludeItemTypes: ['Movie'],
                                SortBy: 'Random',
                                Limit: 20
                            }
                        }
                    ]
                },
                {
                    id: 'seasonal.halloween.halloween-thriller',
                    name: 'Thriller Movies',
                    enabled: true,
                    startDate: '10-01',
                    endDate: '10-31',
                    order: 52,
                    cardFormat: 'Poster',
                    queries: [
                        {
                            queryOptions: {
                                Genres: 'Thriller',
                                IncludeItemTypes: ['Movie'],
                                SortBy: 'Random',
                                Limit: 20
                            }
                        }
                    ]
                }
            ]
        },
        // Seasonal Sections - Christmas
        {
            id: 'seasonal-christmas',
            name: 'Christmas',
            sections: [
                {
                    id: 'seasonal.christmas.christmas-movies',
                    name: 'Christmas Movies',
                    enabled: true,
                    startDate: '12-01',
                    endDate: '12-31',
                    order: 50,
                    cardFormat: 'Poster',
                    renderMode: 'Spotlight',
                    queries: [
                        {
                            queryOptions: {
                                Tags: 'christmas',
                                IncludeItemTypes: ['Movie'],
                                SortBy: 'Random',
                                Limit: 20
                            }
                        }
                    ]
                },
                {
                    id: 'seasonal.christmas.christmas-episodes',
                    name: 'Christmas Episodes',
                    enabled: true,
                    startDate: '12-01',
                    endDate: '12-31',
                    order: 51,
                    cardFormat: 'Thumb',
                    queries: [
                        {
                            queryOptions: {
                                SearchTerm: 'christmas',
                                IncludeItemTypes: ['Episode'],
                                SortBy: 'Random',
                                Limit: 20
                            }
                        }
                    ]
                }
            ]
        },
        // Seasonal Sections - New Year's
        {
            id: 'seasonal-new-years',
            name: 'New Year\'s',
            sections: [
                {
                    id: 'seasonal.new-years.new-years-movies',
                    name: 'New Year\'s Movies',
                    enabled: true,
                    startDate: '01-01',
                    endDate: '01-02',
                    order: 50,
                    cardFormat: 'Poster',
                    queries: [
                        {
                            queryOptions: {
                                Tags: 'new year\'s eve',
                                IncludeItemTypes: ['Movie'],
                                SortBy: 'Random',
                                Limit: 20
                            }
                        }
                    ]
                },
                {
                    id: 'seasonal.new-years.new-years-episodes',
                    name: 'New Year\'s Episodes',
                    enabled: true,
                    startDate: '01-01',
                    endDate: '01-02',
                    order: 51,
                    cardFormat: 'Thumb',
                    queries: [
                        {
                            queryOptions: {
                                SearchTerm: 'new year',
                                IncludeItemTypes: ['Episode'],
                                SortBy: 'Random',
                                Limit: 20
                            }
                        }
                    ]
                }
            ]
        },
        // Seasonal Sections - Valentine's
        {
            id: 'seasonal-valentines',
            name: 'Valentine\'s',
            sections: [
                {
                    id: 'seasonal.valentines.valentines-movies',
                    name: 'Valentine\'s Movies',
                    enabled: true,
                    startDate: '02-01',
                    endDate: '02-15',
                    order: 50,
                    cardFormat: 'Poster',
                    queries: [
                        {
                            queryOptions: {
                                Tags: 'valentine\'s day',
                                IncludeItemTypes: ['Movie'],
                                SortBy: 'Random',
                                Limit: 20
                            }
                        }
                    ]
                },
                {
                    id: 'seasonal.valentines.valentines-episodes',
                    name: 'Valentine\'s Episodes',
                    enabled: true,
                    startDate: '02-01',
                    endDate: '02-15',
                    order: 51,
                    cardFormat: 'Poster',
                    queries: [
                        {
                            queryOptions: {
                                SearchTerm: 'valentine',
                                IncludeItemTypes: ['Episode'],
                                SortBy: 'Random',
                                Limit: 20
                            }
                        }
                    ]
                }
            ]
        },
        // Seasonal Sections - Thanksgiving
        {
            id: 'seasonal-thanksgiving',
            name: 'Thanksgiving',
            sections: [
                {
                    id: 'seasonal.thanksgiving.thanksgiving-movies',
                    name: 'Thanksgiving Movies',
                    enabled: true,
                    startDate: '11-20',
                    endDate: '11-30',
                    order: 50,
                    cardFormat: 'Poster',
                    queries: [
                        {
                            queryOptions: {
                                Tags: 'thanksgiving',
                                IncludeItemTypes: ['Movie'],
                                SortBy: 'Random',
                                Limit: 20
                            }
                        }
                    ]
                },
                {
                    id: 'seasonal.thanksgiving.thanksgiving-episodes',
                    name: 'Thanksgiving Episodes',
                    enabled: true,
                    startDate: '11-20',
                    endDate: '11-30',
                    order: 51,
                    cardFormat: 'Poster',
                    queries: [
                        {
                            queryOptions: {
                                SearchTerm: 'thanksgiving',
                                IncludeItemTypes: ['Episode'],
                                SortBy: 'Random',
                                Limit: 20
                            }
                        }
                    ]
                }
            ]
        }
    ];

    // Discovery Templates
    // These use "Dynamic" types where 'source' is determined at runtime
    // Organized into groups
    const KEFINTWEAKS_DISCOVERY_SECTION_GROUPS = [
        // Genre Movies Group
        {
            id: 'discovery-genre-movies',
            name: 'Genre Movies',
            sections: [
                {
                    id: 'genreMovies',
                    type: 'Genre',
                    source: 'Dynamic', // Will be filled with a random Genre ID/Name
                    name: '{Genre} Movies',
                    enabled: true,
                    itemLimit: 20,
                    sortOrder: 'Random',
                    cardFormat: 'Poster',
                    includeItemTypes: ['Movie'],
                    ttl: CACHE_CONFIG.DISCOVERY_TTL
                },
                {
                    id: 'spotlightGenre',
                    type: 'Genre',
                    source: 'Dynamic',
                    name: 'Top Rated {Genre}',
                    enabled: true,
                    itemLimit: 20,
                    sortOrder: 'CommunityRating',
                    sortOrderDirection: 'Descending',
                    includeItemTypes: ['Movie'],
                    renderMode: 'Spotlight', // Replaces 'type: spotlight-genre' with attribute
                    ttl: CACHE_CONFIG.DISCOVERY_TTL
                }
            ]
        },
        // People Movies Group
        {
            id: 'discovery-people-movies',
            name: 'People Movies',
            sections: [
                {
                    id: 'directedByTopDirector',
                    type: 'Person',
                    source: 'Dynamic', // Random Director ID
                    personType: 'Director', // Extra metadata for dynamic logic
                    name: 'Directed by {Person}',
                    enabled: true,
                    itemLimit: 20,
                    sortOrder: 'Random',
                    cardFormat: 'Poster',
                    includeItemTypes: ['Movie'],
                    ttl: CACHE_CONFIG.DISCOVERY_TTL
                },
                {
                    id: 'writtenByTopWriter',
                    type: 'Person',
                    source: 'Dynamic', // Random Writer ID
                    personType: 'Writer',
                    name: 'Written by {Person}',
                    enabled: true,
                    itemLimit: 20,
                    sortOrder: 'Random',
                    cardFormat: 'Poster',
                    includeItemTypes: ['Movie'],
                    ttl: CACHE_CONFIG.DISCOVERY_TTL
                },
                {
                    id: 'starringTopActor',
                    type: 'Person',
                    source: 'Dynamic', // Random Actor ID
                    personType: 'Actor',
                    name: 'Starring {Person}',
                    enabled: true,
                    itemLimit: 20,
                    sortOrder: 'Random',
                    cardFormat: 'Poster',
                    includeItemTypes: ['Movie'],
                    ttl: CACHE_CONFIG.DISCOVERY_TTL
                }
            ]
        },
        // Recently Watched People Group
        {
            id: 'discovery-recently-watched-people',
            name: 'Recently Watched People',
            sections: [
                {
                    id: 'starringActorRecentlyWatched',
                    type: 'Person',
                    source: 'Dynamic', // Actor from Recently Watched
                    personType: 'Actor',
                    sourceType: 'watched-recent', // Hint for source generator
                    name: 'Starring {Person} since you watched {Title}',
                    enabled: true,
                    itemLimit: 20,
                    sortOrder: 'Random',
                    cardFormat: 'Poster',
                    includeItemTypes: ['Movie'],
                    ttl: CACHE_CONFIG.DISCOVERY_TTL
                },
                {
                    id: 'directedByDirectorRecentlyWatched',
                    type: 'Person',
                    source: 'Dynamic', // Director from Recently Watched
                    personType: 'Director',
                    sourceType: 'watched-recent',
                    name: 'Directed by {Person} since you watched {Title}',
                    enabled: true,
                    itemLimit: 20,
                    sortOrder: 'Random',
                    cardFormat: 'Poster',
                    includeItemTypes: ['Movie'],
                    ttl: CACHE_CONFIG.DISCOVERY_TTL
                },
                {
                    id: 'writtenByWriterRecentlyWatched',
                    type: 'Person',
                    source: 'Dynamic',
                    personType: 'Writer',
                    sourceType: 'watched-recent',
                    name: 'Written by {Person} since you watched {Title}',
                    enabled: true,
                    itemLimit: 20,
                    sortOrder: 'Random',
                    cardFormat: 'Poster',
                    includeItemTypes: ['Movie'],
                    ttl: CACHE_CONFIG.DISCOVERY_TTL
                }
            ]
        },
        // Similar to Watched Group
        {
            id: 'discovery-similar-to-watched',
            name: 'Similar to Watched',
            sections: [
                {
                    id: 'becauseYouWatched',
                    type: 'Similar',
                    source: 'Dynamic', // Random Watched Item ID
                    sourceType: 'watched',
                    name: 'Because you watched {Title}',
                    enabled: true,
                    itemLimit: 20,
                    sortOrder: 'Random', // Typically 'Similarity' but usually returned sorted by API
                    includeItemTypes: ['Movie'],
                    ttl: CACHE_CONFIG.DISCOVERY_TTL
                },
                {
                    id: 'becauseYouRecentlyWatched',
                    type: 'Similar',
                    source: 'Dynamic', // Random Recently Watched ID
                    sourceType: 'watched-recent',
                    name: 'Because you recently watched {Title}',
                    enabled: true,
                    itemLimit: 20,
                    sortOrder: 'Random',
                    cardFormat: 'Poster',
                    includeItemTypes: ['Movie'],
                    ttl: CACHE_CONFIG.DISCOVERY_TTL
                }
            ]
        },
        // Liked Group
        {
            id: 'discovery-liked',
            name: 'Liked',
            sections: [
                {
                    id: 'becauseYouLiked',
                    type: 'Similar',
                    source: 'Dynamic', // Random Favorite Item ID
                    sourceType: 'liked',
                    name: 'Because you liked {Title}',
                    enabled: true,
                    itemLimit: 20,
                    sortOrder: 'Random',
                    cardFormat: 'Poster',
                    includeItemTypes: ['Movie'],
                    ttl: CACHE_CONFIG.DISCOVERY_TTL
                }
            ]
        },
        // Studios Group
        {
            id: 'discovery-studios',
            name: 'Studios',
            sections: [
                {
                    id: 'studioShows',
                    type: 'Studio',
                    source: 'Dynamic', // Random Studio ID
                    name: 'Shows from {Studio}',
                    enabled: true,
                    itemLimit: 20,
                    sortOrder: 'Random',
                    cardFormat: 'Poster',
                    includeItemTypes: ['Series'],
                    ttl: CACHE_CONFIG.DISCOVERY_TTL
                },
                {
                    id: 'spotlightNetwork',
                    type: 'Studio',
                    source: 'Dynamic',
                    name: 'Top Rated from {Studio}',
                    enabled: true,
                    itemLimit: 20,
                    sortOrder: 'CommunityRating',
                    sortOrderDirection: 'Descending',
                    includeItemTypes: ['Series'],
                    renderMode: 'Spotlight',
                    ttl: CACHE_CONFIG.DISCOVERY_TTL
                }
            ]
        },
        // Collections Group
        {
            id: 'discovery-collections',
            name: 'Collections',
            sections: [
                {
                    id: 'collections',
                    type: 'Collection', // Standard type, but source is dynamic here
                    source: 'Dynamic',
                    name: '{Collection}',
                    enabled: true,
                    itemLimit: 20,
                    sortOrder: 'Random', // Order within the collection
                    includeItemTypes: ['Movie', 'Series'],
                    ttl: CACHE_CONFIG.DISCOVERY_TTL
                }
            ]
        }
    ];

    const DISCOVERY_SETTINGS = {
        enabled: true,
        infiniteScroll: true,
        minPeopleAppearances: 10,
        minGenreMovieCount: 50,
        defaultItemLimit: 16,
        defaultSortOrder: "Random",
        defaultCardFormat: "Poster",
        spotlightDiscoveryChance: 0.5,
        renderSpotlightAboveMatching: false,
        spotlight: {
            autoPlay: true,
            interval: 5000,
            showDots: true,
            showNavButtons: true,
            showClearArt: true
        },
        randomizeOrder: false
    }

    const SEASONAL_THEME_SETTINGS = {
        enabled: true,
        enableSeasonalAnimations: true,
        enableSeasonalBackground: true,
        seasonToggles: [
            {
                id: 'halloween',
                name: 'Halloween',
                enabled: false
            },
            {
                id: 'christmas',
                name: 'Christmas',
                enabled: false
            },
            {
                id: 'new-years',
                name: 'New Year\'s',
                enabled: false
            },
            {
                id: 'valentines',
                name: 'Valentine\'s Day',
                enabled: false
            }
        ]
    }
    const HOME_SETTINGS = {
        minimumSeriesForPopularTVNetworks: 10,
    }

    // Expose configuration
    window.KefinHomeConfig2 = {
        CACHE: CACHE_CONFIG,
        HOME_SECTION_GROUPS: KEFINTWEAKS_HOME_SECTION_GROUPS,
        SEASONAL_SECTION_GROUPS: KEFINTWEAKS_SEASONAL_SECTION_GROUPS,
        DISCOVERY_SECTION_GROUPS: KEFINTWEAKS_DISCOVERY_SECTION_GROUPS,
        CUSTOM_SECTION_GROUPS: [], // Empty by default - user-created/imported sections
        REMOVE_CONFLICTING_SECTIONS: true,
        MERGE_NEXT_UP: false,
        HOME_SETTINGS: HOME_SETTINGS,
        DISCOVERY_SETTINGS: DISCOVERY_SETTINGS,
        SEASONAL_THEME_SETTINGS: SEASONAL_THEME_SETTINGS
    };

    console.log('[KefinTweaks HomeConfig2] Configuration loaded');

})();