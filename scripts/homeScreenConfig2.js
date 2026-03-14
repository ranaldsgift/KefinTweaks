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
                },
                {
                    id: 'continueListening',
                    name: 'Continue Listening',
                    enabled: false,
                    hidden: false,
                    order: 10,
                    cardFormat: 'Square',
                    ttl: CACHE_CONFIG.FORCE_REFRESH_TTL,
                    queries: [
                        {
                            path: '/UserItems/Resume',
                            queryOptions: {
                                MediaTypes: 'Audio',
                                Limit: 16
                            }
                        }
                    ]
                },
                {
                    id: 'continueReading',
                    name: 'Continue Reading',
                    enabled: false,
                    hidden: false,
                    order: 10,
                    cardFormat: 'Poster',
                    ttl: CACHE_CONFIG.FORCE_REFRESH_TTL,
                    queries: [
                        {
                            path: '/UserItems/Resume',
                            queryOptions: {
                                MediaTypes: 'Book',
                                Limit: 16
                            }
                        }
                    ]
                },
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
        // Recently Added (sections added by verifyLibrarySectionsConfig from server libraries)
        {
            id: 'home-recently-added',
            name: 'Recently Added',
            sections: []
        },
        // Live TV
        {
            id: 'home-live-tv',
            name: 'Live TV',
            sections: [
                {
                    id: 'liveTv-recordings',
                    name: 'Recordings',
                    enabled: false,
                    order: 90,
                    cardFormat: 'Poster',
                    ttl: CACHE_CONFIG.SHORT_TTL,
                    queries: [
                        {
                            path: '/LiveTv/Recordings',
                            queryOptions: {
                                Limit: 20,
                            }
                        }
                    ]
                },
                {
                    id: 'liveTv-timers',
                    name: 'Scheduled Recordings',
                    enabled: false,
                    order: 91,
                    cardFormat: 'Poster',
                    ttl: CACHE_CONFIG.SHORT_TTL,
                    queries: [
                        {
                            path: '/LiveTv/Timers',
                            queryOptions: {
                                IsActive: false,
                                IsScheduled: true,
                                Limit: 20,
                            }
                        }
                    ]
                },
                {
                    id: 'liveTv-browse',
                    name: 'Live TV',
                    enabled: false,
                    order: 91,
                    cardFormat: 'Button',
                    items: [
                        {
                            Name: 'Programs',
                            cardUrl: '#/livetv.html?tab=0',
                        },
                        {
                            Name: 'Guide',
                            cardUrl: '#/livetv.html?tab=1',
                        },
                        {
                            Name: 'Channels',
                            cardUrl: '#/livetv.html?tab=2',
                        },
                        {
                            Name: 'Recordings',
                            cardUrl: '#/livetv.html?tab=3',
                        },
                        {
                            Name: 'Schedule',
                            cardUrl: '#/livetv.html?tab=4',
                        },
                        {
                            Name: 'Series',
                            cardUrl: '#/livetv.html?tab=5',
                        }
                    ]
                },
                {
                    id: 'liveTv-on-now',
                    name: 'On Now',
                    enabled: false,
                    order: 92,
                    cardFormat: 'Poster',
                    ttl: CACHE_CONFIG.VERY_SHORT_TTL,
                    queries: [
                        {
                            path: '/LiveTv/Programs/Recommended',
                            queryOptions: {
                                IsAiring: true,
                                Limit: 24,
                            }
                        }
                    ]
                },
                {
                    id: 'liveTv-programs',
                    name: 'Programs',
                    enabled: false,
                    order: 92,
                    cardFormat: 'Poster',
                    ttl: CACHE_CONFIG.VERY_SHORT_TTL,
                    queries: [
                        {
                            path: '/LiveTv/Programs',
                            queryOptions: {
                                Limit: 20,
                                SortBy: 'Random',
                                HasAired: false,
                            }
                        }
                    ]
                },
                {
                    id: 'liveTv-channels',
                    name: 'Channels',
                    enabled: false,
                    order: 92,
                    cardFormat: 'Thumb',
                    hideCardFooter: true,
                    ttl: CACHE_CONFIG.LONG_TTL,
                    queries: [
                        {
                            path: '/LiveTv/Channels',
                            queryOptions: {
                                Limit: 20,
                                SortBy: 'Random',
                            }
                        }
                    ]
                },
                {
                    id: 'liveTv-series-on-now',
                    name: 'Shows From Live TV',
                    enabled: false,
                    order: 92,
                    cardFormat: 'Poster',
                    ttl: CACHE_CONFIG.VERY_SHORT_TTL,
                    queries: [
                        {
                            path: '/LiveTv/Programs',
                            queryOptions: {
                                Limit: 10,
                                SortBy: 'Random',
                                HasAired: false,
                                IsSeries: true,
                                IsMovie: false,
                                IsSports: false,
                                IsNews: false,
                                IsKids: false,
                            }
                        }
                    ]
                },
                {
                    id: 'liveTv-movies-on-now',
                    name: 'Movies From Live TV',
                    enabled: false,
                    order: 92,
                    cardFormat: 'Poster',
                    ttl: CACHE_CONFIG.VERY_SHORT_TTL,
                    queries: [
                        {
                            path: '/LiveTv/Programs',
                            queryOptions: {
                                Limit: 10,
                                SortBy: 'Random',
                                HasAired: false,
                                IsMovie: true,
                            }
                        }
                    ]
                },
                {
                    id: 'liveTv-sports-on-now',
                    name: 'Sports From Live TV',
                    enabled: false,
                    order: 92,
                    cardFormat: 'Poster',
                    ttl: CACHE_CONFIG.VERY_SHORT_TTL,
                    queries: [
                        {
                            path: '/LiveTv/Programs',
                            queryOptions: {
                                Limit: 10,
                                SortBy: 'Random',
                                HasAired: false,
                                IsSports: true,
                            }
                        }
                    ]
                },
                {
                    id: 'liveTv-news-on-now',
                    name: 'News From Live TV',
                    enabled: false,
                    order: 92,
                    cardFormat: 'Poster',
                    ttl: CACHE_CONFIG.VERY_SHORT_TTL,
                    queries: [
                        {
                            path: '/LiveTv/Programs',
                            queryOptions: {
                                Limit: 10,
                                SortBy: 'Random',
                                HasAired: false,
                                IsNews: true,
                            }
                        }
                    ]
                },
                {
                    id: 'liveTv-kids-on-now',
                    name: 'Kids From Live TV',
                    enabled: false,
                    order: 92,
                    cardFormat: 'Poster',
                    ttl: CACHE_CONFIG.VERY_SHORT_TTL,
                    queries: [
                        {
                            path: '/LiveTv/Programs',
                            queryOptions: {
                                Limit: 10,
                                SortBy: 'Random',
                                HasAired: false,
                                IsKids: true,
                            }
                        }
                    ]
                },
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
            id: 'home-popular-studios',
            name: 'Popular Studios',
            sections: [
                {
                    id: 'popularTVStudios',
                    name: 'Popular TV Studios',
                    enabled: true,
                    order: 72,
                    cardFormat: 'Thumb',
                    ttl: CACHE_CONFIG.LONG_TTL,
                    itemLimit: 20,
                    sortBy: 'Random',
                    limitBeforeSort: true,
                    hideCardFooter: true,
                    queries: [
                        {
                            path: '/Studios',
                            queryOptions: {
                                IncludeItemTypes: ['Series'],
                                SortBy: 'ChildCount',
                                SortOrder: 'Descending',
                                Limit: 0
                            }
                        }
                    ]
                },
                {
                    id: 'popularMovieStudios',
                    name: 'Popular Movie Studios',
                    enabled: true,
                    order: 72,
                    cardFormat: 'Thumb',
                    ttl: CACHE_CONFIG.LONG_TTL,
                    itemLimit: 20,
                    sortBy: 'Random',
                    limitBeforeSort: true,
                    hideCardFooter: true,
                    queries: [
                        {
                            path: '/Studios',
                            queryOptions: {
                                IncludeItemTypes: ['Movie'],
                                SortBy: 'ChildCount',
                                SortOrder: 'Descending',
                                Limit: 0,
                            }
                        }
                    ]
                },
                {
                    id: 'popularStudios',
                    name: 'Popular Studios',
                    enabled: false,
                    order: 72,
                    cardFormat: 'Thumb',
                    ttl: CACHE_CONFIG.LONG_TTL,
                    itemLimit: 20,
                    sortBy: 'Random',
                    limitBeforeSort: true,
                    hideCardFooter: true,
                    queries: [
                        {
                            path: '/Studios',
                            queryOptions: {
                                IncludeItemTypes: ['Movie', 'Series'],
                                SortBy: 'ChildCount',
                                SortOrder: 'Descending',
                                Limit: 0,
                            }
                        }
                    ]
                }
            ]
        },
        // Popular Genres (sections added by verifyLibrarySectionsConfig from server libraries)
        {
            id: 'home-popular-genres',
            name: 'Popular Genres',
            sections: []
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
            id: 'home-playlists-collections',
            name: 'Playlists & Collections',
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
                },
                {
                    id: 'playlists',
                    name: 'Browse by Playlist',
                    enabled: false,
                    order: 76,
                    cardFormat: 'Poster',
                    ttl: CACHE_CONFIG.DEFAULT_TTL,
                    queries: [
                        {
                            queryOptions: {
                                IncludeItemTypes: ['Playlist'],
                                SortBy: 'Random',
                                Limit: 20
                            }
                        }
                    ]
                },
                {
                    id: 'collections',
                    name: 'Browse by Collection',
                    enabled: false,
                    order: 77,
                    cardFormat: 'Poster',
                    ttl: CACHE_CONFIG.DEFAULT_TTL,
                    queries: [
                        {
                            queryOptions: {
                                IncludeItemTypes: ['BoxSet'],
                                SortBy: 'Random',
                                Limit: 20
                            }
                        }
                    ]
                }
            ]
        },
        // Thematic Picks (static items – no remote query)
        {
            id: 'home-thematic-picks',
            name: 'Thematic Picks',
            sections: [
                {
                    id: 'thematic-story-origins',
                    name: 'Story Origins',
                    enabled: false,
                    order: 81,
                    cardFormat: 'Poster',
                    sortBy: 'Random',
                    items: [
                        { Name: 'Based on a True Story', imageUrl: '${kefinTweaksRoot}pages/images/collections/based-on-true-story.jpg', cardUrl: '#/list.html?type=tag&tag=based%20on%20a%20true%20story|based%20on%20true%20story&serverId=${serverId}' },
                        { Name: 'Based on a Novel', imageUrl: '${kefinTweaksRoot}pages/images/collections/based-on-novel.jpg', cardUrl: '#/list.html?type=tag&tag=based%20on%20novel%20or%20book&serverId=${serverId}' },
                        { Name: 'Based on a Comic Book', imageUrl: '${kefinTweaksRoot}pages/images/collections/based-on-comic-book.jpg', cardUrl: '#/list.html?type=tag&tag=based%20on%20comic|comic%20book&serverId=${serverId}' },
                        { Name: 'Based on a Video Game', imageUrl: '${kefinTweaksRoot}pages/images/collections/based-on-video-game.jpg', cardUrl: '#/list.html?type=tag&tag=based%20on%20video%20game|video%20game&serverId=${serverId}' },
                        { Name: 'Based on a Play or Musical', imageUrl: '${kefinTweaksRoot}pages/images/collections/based-on-play-musical.jpg', cardUrl: '#/list.html?type=tag&tag=based%20on%20play%20or%20musical&serverId=${serverId}' },
                        { Name: 'Based on a Memoir', imageUrl: '${kefinTweaksRoot}pages/images/collections/based-on-memoir.jpg', cardUrl: '#/list.html?type=tag&tag=based%20on%20memoir%20or%20autobiography&serverId=${serverId}' },
                        { Name: 'Biography', imageUrl: '${kefinTweaksRoot}pages/images/collections/biography.jpg', cardUrl: '#/list.html?type=tag&tag=biography&serverId=${serverId}' },
                        { Name: 'Remake / Reboot', imageUrl: '${kefinTweaksRoot}pages/images/collections/remake-reboot.jpg', cardUrl: '#/list.html?type=tag&tag=remake|reboot&serverId=${serverId}' }
                    ]
                },
                {
                    id: 'thematic-core-concepts',
                    name: 'Core Concepts',
                    enabled: false,
                    order: 82,
                    cardFormat: 'Poster',
                    sortBy: 'Random',
                    items: [
                        { Name: 'Superhero', imageUrl: '${kefinTweaksRoot}pages/images/collections/superhero.jpg', cardUrl: '#/list.html?type=tag&tag=superhero&serverId=${serverId}' },
                        { Name: 'Super Power', imageUrl: '${kefinTweaksRoot}pages/images/collections/super-power.jpg', cardUrl: '#/list.html?type=tag&tag=super%20power&serverId=${serverId}' },
                        { Name: 'Time Travel', imageUrl: '${kefinTweaksRoot}pages/images/collections/time-travel.jpg', cardUrl: '#/list.html?type=tag&tag=time%20travel&serverId=${serverId}' },
                        { Name: 'Time Loop', imageUrl: '${kefinTweaksRoot}pages/images/collections/time-loop.jpg', cardUrl: '#/list.html?type=tag&tag=time%20loop&serverId=${serverId}' },
                        { Name: 'Dystopia', imageUrl: '${kefinTweaksRoot}pages/images/collections/dystopia.jpg', cardUrl: '#/list.html?type=tag&tag=dystopia&serverId=${serverId}' },
                        { Name: 'Post-Apocalyptic Future', imageUrl: '${kefinTweaksRoot}pages/images/collections/post-apocalyptic.jpg', cardUrl: '#/list.html?type=tag&tag=post-apocalyptic%20future&serverId=${serverId}' },
                        { Name: 'Cyberpunk', imageUrl: '${kefinTweaksRoot}pages/images/collections/cyberpunk.jpg', cardUrl: '#/list.html?type=tag&tag=cyberpunk&serverId=${serverId}' },
                        { Name: 'Parallel Universe', imageUrl: '${kefinTweaksRoot}pages/images/collections/parallel-universe.jpg', cardUrl: '#/list.html?type=tag&tag=parallel%20universe&serverId=${serverId}' },
                        { Name: 'Alternative Reality', imageUrl: '${kefinTweaksRoot}pages/images/collections/alternative-reality.jpg', cardUrl: '#/list.html?type=tag&tag=alternative%20reality&serverId=${serverId}' },
                        { Name: 'Virtual Reality', imageUrl: '${kefinTweaksRoot}pages/images/collections/virtual-reality.jpg', cardUrl: '#/list.html?type=tag&tag=virtual%20reality&serverId=${serverId}' },
                        { Name: 'Artificial Intelligence', imageUrl: '${kefinTweaksRoot}pages/images/collections/artificial-intelligence.jpg', cardUrl: '#/list.html?type=tag&tag=artificial%20intelligence|artificial%20intelligence%20(a.i.)&serverId=${serverId}' },
                        { Name: 'Zombie', imageUrl: '${kefinTweaksRoot}pages/images/collections/zombie.jpg', cardUrl: '#/list.html?type=tag&tag=zombie|zombie%20apocalypse&serverId=${serverId}' },
                        { Name: 'Kaiju / Giant Monster', imageUrl: '${kefinTweaksRoot}pages/images/collections/kaiju.jpg', cardUrl: '#/list.html?type=tag&tag=kaiju|giant%20monster&serverId=${serverId}' },
                        { Name: 'Alien', imageUrl: '${kefinTweaksRoot}pages/images/collections/alien.jpg', cardUrl: '#/list.html?type=tag&tag=alien&serverId=${serverId}' },
                        { Name: 'Vampire', imageUrl: '${kefinTweaksRoot}pages/images/collections/vampire.jpg', cardUrl: '#/list.html?type=tag&tag=vampire&serverId=${serverId}' },
                        { Name: 'Werewolf', imageUrl: '${kefinTweaksRoot}pages/images/collections/werewolf.jpg', cardUrl: '#/list.html?type=tag&tag=werewolf&serverId=${serverId}' },
                        { Name: 'Witchcraft', imageUrl: '${kefinTweaksRoot}pages/images/collections/witchcraft.jpg', cardUrl: '#/list.html?type=tag&tag=witchcraft&serverId=${serverId}' },
                        { Name: 'Supernatural', imageUrl: '${kefinTweaksRoot}pages/images/collections/supernatural.jpg', cardUrl: '#/list.html?type=tag&tag=supernatural&serverId=${serverId}' },
                        { Name: 'Ghost', imageUrl: '${kefinTweaksRoot}pages/images/collections/ghost.jpg', cardUrl: '#/list.html?type=tag&tag=ghost&serverId=${serverId}' },
                        { Name: 'Mythology', imageUrl: '${kefinTweaksRoot}pages/images/collections/mythology.jpg', cardUrl: '#/list.html?type=tag&tag=mythology&serverId=${serverId}' },
                        { Name: 'Magic', imageUrl: '${kefinTweaksRoot}pages/images/collections/magic.jpg', cardUrl: '#/list.html?type=tag&tag=magic&serverId=${serverId}' }
                    ]
                },
                {
                    id: 'thematic-crime-stories',
                    name: 'Crime Stories',
                    enabled: false,
                    order: 83,
                    cardFormat: 'Poster',
                    sortBy: 'Random',
                    items: [
                        { Name: 'Heist', imageUrl: '${kefinTweaksRoot}pages/images/collections/heist.jpg', cardUrl: '#/list.html?type=tag&tag=heist|robbery&serverId=${serverId}' },
                        { Name: 'True Crime', imageUrl: '${kefinTweaksRoot}pages/images/collections/true-crime.jpg', cardUrl: '#/list.html?type=tag&tag=true%20crime&serverId=${serverId}' },
                        { Name: 'Serial Killer', imageUrl: '${kefinTweaksRoot}pages/images/collections/serial-killer.jpg', cardUrl: '#/list.html?type=tag&tag=serial%20killer&serverId=${serverId}' },
                        { Name: 'Murder', imageUrl: '${kefinTweaksRoot}pages/images/collections/murder.jpg', cardUrl: '#/list.html?type=tag&tag=murder&serverId=${serverId}' },
                        { Name: 'Organized Crime', imageUrl: '${kefinTweaksRoot}pages/images/collections/organized-crime.jpg', cardUrl: '#/list.html?type=tag&tag=organized%20crime&serverId=${serverId}' },
                        { Name: 'Criminal Mastermind', imageUrl: '${kefinTweaksRoot}pages/images/collections/criminal-mastermind.jpg', cardUrl: '#/list.html?type=tag&tag=criminal%20mastermind&serverId=${serverId}' },
                        { Name: 'Mafia / Mobster', imageUrl: '${kefinTweaksRoot}pages/images/collections/mafia.jpg', cardUrl: '#/list.html?type=tag&tag=mafia|mobster&serverId=${serverId}' },
                        { Name: 'Gangster', imageUrl: '${kefinTweaksRoot}pages/images/collections/gangster.jpg', cardUrl: '#/list.html?type=tag&tag=gangster&serverId=${serverId}' },
                        { Name: 'Prison', imageUrl: '${kefinTweaksRoot}pages/images/collections/prison.jpg', cardUrl: '#/list.html?type=tag&tag=prison&serverId=${serverId}' },
                        { Name: 'Vigilante Justice', imageUrl: '${kefinTweaksRoot}pages/images/collections/vigilante.jpg', cardUrl: '#/list.html?type=tag&tag=vigilante%20justice|vigilante&serverId=${serverId}' },
                        { Name: 'Conspiracy', imageUrl: '${kefinTweaksRoot}pages/images/collections/conspiracy.jpg', cardUrl: '#/list.html?type=tag&tag=conspiracy&serverId=${serverId}' },
                        { Name: 'Courtroom Drama', imageUrl: '${kefinTweaksRoot}pages/images/collections/courtroom.jpg', cardUrl: '#/list.html?type=tag&tag=courtroom%20drama|courtroom&serverId=${serverId}' },
                        { Name: 'Spy / Espionage', imageUrl: '${kefinTweaksRoot}pages/images/collections/spy.jpg', cardUrl: '#/list.html?type=tag&tag=spy|espionage&serverId=${serverId}' }
                    ]
                },
                {
                    id: 'thematic-character-perspective',
                    name: 'Character Perspective',
                    enabled: false,
                    order: 84,
                    cardFormat: 'Poster',
                    sortBy: 'Random',
                    items: [
                        { Name: 'Anti Hero', imageUrl: '${kefinTweaksRoot}pages/images/collections/anti-hero.jpg', cardUrl: '#/list.html?type=tag&tag=anti%20hero&serverId=${serverId}' },
                        { Name: 'Female Protagonist', imageUrl: '${kefinTweaksRoot}pages/images/collections/female-protagonist.jpg', cardUrl: '#/list.html?type=tag&tag=female%20protagonist&serverId=${serverId}' },
                        { Name: 'Family', imageUrl: '${kefinTweaksRoot}pages/images/collections/family.jpg', cardUrl: '#/list.html?type=tag&tag=family&serverId=${serverId}' },
                        { Name: 'Dysfunctional Family', imageUrl: '${kefinTweaksRoot}pages/images/collections/dysfunctional-family.jpg', cardUrl: '#/list.html?type=tag&tag=dysfunctional%20family&serverId=${serverId}' },
                        { Name: 'LGBTQ+', imageUrl: '${kefinTweaksRoot}pages/images/collections/lgbtq.jpg', cardUrl: '#/list.html?type=tag&tag=lgbtq%2B|lgbtq|lgbt&serverId=${serverId}' },
                        { Name: 'Unreliable Narrator', imageUrl: '${kefinTweaksRoot}pages/images/collections/unreliable-narrator.jpg', cardUrl: '#/list.html?type=tag&tag=unreliable%20narrator&serverId=${serverId}' },
                        { Name: 'Underdog', imageUrl: '${kefinTweaksRoot}pages/images/collections/underdog.jpg', cardUrl: '#/list.html?type=tag&tag=underdog&serverId=${serverId}' },
                        { Name: 'Mentor-Protégé', imageUrl: '${kefinTweaksRoot}pages/images/collections/mentor.jpg', cardUrl: '#/list.html?type=tag&tag=mentor%20prot%C3%A9g%C3%A9%20relationship|mentor&serverId=${serverId}' },
                        { Name: 'Friendship', imageUrl: '${kefinTweaksRoot}pages/images/collections/friendship.jpg', cardUrl: '#/list.html?type=tag&tag=friendship&serverId=${serverId}' },
                        { Name: 'Villain', imageUrl: '${kefinTweaksRoot}pages/images/collections/villain.jpg', cardUrl: '#/list.html?type=tag&tag=villain&serverId=${serverId}' }
                    ]
                },
                {
                    id: 'thematic-settings',
                    name: 'Settings',
                    enabled: false,
                    order: 85,
                    cardFormat: 'Poster',
                    sortBy: 'Random',
                    items: [
                        { Name: 'High School', imageUrl: '${kefinTweaksRoot}pages/images/collections/high-school.jpg', cardUrl: '#/list.html?type=tag&tag=high%20school&serverId=${serverId}' },
                        { Name: 'Workplace', imageUrl: '${kefinTweaksRoot}pages/images/collections/workplace.jpg', cardUrl: '#/list.html?type=tag&tag=workplace|workplace%20comedy|workplace%20romance&serverId=${serverId}' },
                        { Name: 'Small Town', imageUrl: '${kefinTweaksRoot}pages/images/collections/small-town.jpg', cardUrl: '#/list.html?type=tag&tag=small%20town&serverId=${serverId}' },
                        { Name: 'Road Trip', imageUrl: '${kefinTweaksRoot}pages/images/collections/road-trip.jpg', cardUrl: '#/list.html?type=tag&tag=road%20trip&serverId=${serverId}' },
                        { Name: 'Island', imageUrl: '${kefinTweaksRoot}pages/images/collections/island.jpg', cardUrl: '#/list.html?type=tag&tag=island&serverId=${serverId}' },
                        { Name: 'Period Piece', imageUrl: '${kefinTweaksRoot}pages/images/collections/period-piece.jpg', cardUrl: '#/list.html?type=tag&tag=period%20piece|period%20drama&serverId=${serverId}' },
                        { Name: 'Victorian Era', imageUrl: '${kefinTweaksRoot}pages/images/collections/victorian-era.jpg', cardUrl: '#/list.html?type=tag&tag=victorian%20era|victorian%20england&serverId=${serverId}' },
                        { Name: 'Medieval', imageUrl: '${kefinTweaksRoot}pages/images/collections/medieval.jpg', cardUrl: '#/list.html?type=tag&tag=medieval&serverId=${serverId}' },
                        { Name: 'Western', imageUrl: '${kefinTweaksRoot}pages/images/collections/western.jpg', cardUrl: '#/list.html?type=tag&tag=western&serverId=${serverId}' },
                        { Name: 'War', imageUrl: '${kefinTweaksRoot}pages/images/collections/war.jpg', cardUrl: '#/list.html?type=tag&tag=war|world%20war%20i|world%20war%20ii&serverId=${serverId}' },
                        { Name: 'Space', imageUrl: '${kefinTweaksRoot}pages/images/collections/space.jpg', cardUrl: '#/list.html?type=tag&tag=space|spacecraft|space%20station|spaceship&serverId=${serverId}' }
                    ]
                },
                {
                    id: 'thematic-tone-style',
                    name: 'Tone & Style',
                    enabled: false,
                    order: 86,
                    cardFormat: 'Poster',
                    sortBy: 'Random',
                    items: [
                        { Name: 'Dark Comedy', imageUrl: '${kefinTweaksRoot}pages/images/collections/dark-comedy.jpg', cardUrl: '#/list.html?type=tag&tag=dark%20comedy|black%20comedy&serverId=${serverId}' },
                        { Name: 'Psychological Thriller', imageUrl: '${kefinTweaksRoot}pages/images/collections/psychological-thriller.jpg', cardUrl: '#/list.html?type=tag&tag=psychological%20thriller&serverId=${serverId}' },
                        { Name: 'Camp', imageUrl: '${kefinTweaksRoot}pages/images/collections/camp.jpg', cardUrl: '#/list.html?type=tag&tag=camp&serverId=${serverId}' },
                        { Name: 'Satire', imageUrl: '${kefinTweaksRoot}pages/images/collections/satire.jpg', cardUrl: '#/list.html?type=tag&tag=satire&serverId=${serverId}' },
                        { Name: 'Mockumentary', imageUrl: '${kefinTweaksRoot}pages/images/collections/mockumentary.jpg', cardUrl: '#/list.html?type=tag&tag=mockumentary&serverId=${serverId}' },
                        { Name: 'Neo-Noir', imageUrl: '${kefinTweaksRoot}pages/images/collections/neo-noir.jpg', cardUrl: '#/list.html?type=tag&tag=neo-noir&serverId=${serverId}' },
                        { Name: 'Film Noir', imageUrl: '${kefinTweaksRoot}pages/images/collections/film-noir.jpg', cardUrl: '#/list.html?type=tag&tag=film%20noir|noir&serverId=${serverId}' },
                        { Name: 'Surrealism', imageUrl: '${kefinTweaksRoot}pages/images/collections/surrealism.jpg', cardUrl: '#/list.html?type=tag&tag=surrealism&serverId=${serverId}' }
                    ]
                },
                {
                    id: 'thematic-themes-topics',
                    name: 'Themes & Topics',
                    enabled: false,
                    order: 87,
                    cardFormat: 'Poster',
                    sortBy: 'Random',
                    items: [
                        { Name: 'Coming of Age', imageUrl: '${kefinTweaksRoot}pages/images/collections/coming-of-age.jpg', cardUrl: '#/list.html?type=tag&tag=coming%20of%20age&serverId=${serverId}' },
                        { Name: 'Revenge', imageUrl: '${kefinTweaksRoot}pages/images/collections/revenge.jpg', cardUrl: '#/list.html?type=tag&tag=revenge&serverId=${serverId}' },
                        { Name: 'Redemption', imageUrl: '${kefinTweaksRoot}pages/images/collections/redemption.jpg', cardUrl: '#/list.html?type=tag&tag=redemption&serverId=${serverId}' },
                        { Name: 'Survival', imageUrl: '${kefinTweaksRoot}pages/images/collections/survival.jpg', cardUrl: '#/list.html?type=tag&tag=survival&serverId=${serverId}' },
                        { Name: 'Sports', imageUrl: '${kefinTweaksRoot}pages/images/collections/sports.jpg', cardUrl: '#/list.html?type=tag&tag=sports&serverId=${serverId}' },
                        { Name: 'Identity', imageUrl: '${kefinTweaksRoot}pages/images/collections/identity.jpg', cardUrl: '#/list.html?type=tag&tag=identity|secret%20identity|fake%20identity|mistaken%20identity&serverId=${serverId}' },
                        { Name: 'Mental Health', imageUrl: '${kefinTweaksRoot}pages/images/collections/mental-health.jpg', cardUrl: '#/list.html?type=tag&tag=mental%20health&serverId=${serverId}' },
                        { Name: 'Addiction', imageUrl: '${kefinTweaksRoot}pages/images/collections/addiction.jpg', cardUrl: '#/list.html?type=tag&tag=addiction|drug%20addiction|sex%20addiction&serverId=${serverId}' },
                        { Name: 'Class Differences', imageUrl: '${kefinTweaksRoot}pages/images/collections/class-differences.jpg', cardUrl: '#/list.html?type=tag&tag=class%20differences|upper%20class|working%20class&serverId=${serverId}' },
                        { Name: 'Faith / Religion', imageUrl: '${kefinTweaksRoot}pages/images/collections/faith-religion.jpg', cardUrl: '#/list.html?type=tag&tag=faith|religion&serverId=${serverId}' }
                    ]
                }
            ]
        },
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
                    startDate: '02-07',
                    endDate: '02-14',
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
                    startDate: '02-07',
                    endDate: '02-14',
                    order: 51,
                    cardFormat: 'Thumb',
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
        randomizeOrder: false,
        fadeInSections: false,
    }

    const SEASONAL_THEME_SETTINGS = {
        enabled: false,
        enableSeasonalAnimations: false,
        enableSeasonalBackground: false,
        seasonalThemes: {
            'seasonal-halloween': {
                animation: 'snowverlay',
                backgroundImage: 'url(../pages/images/halloween.jpg)'
            },
            'seasonal-christmas': {
                animation: 'snowverlay',
                backgroundImage: 'url(../pages/images/christmas.jpg)'
            },
            'seasonal-new-years': {
                animation: 'snowverlay',
                backgroundImage: 'url(../pages/images/new-years.jpg)'
            },
            'seasonal-valentines': {
                animation: 'valentinesOverlay',
                backgroundImage: 'url(../pages/images/valentines.jpg)'
            }
        }
    }
    const HOME_SETTINGS = {
        minimumSeriesForPopularTVNetworks: 10,
        fadeInSections: false,
        ensureThumbsForPopularTVNetworks: false,
    }

    const SPOTLIGHT_SETTINGS = {
        autoPlay: true,
        interval: 10000,
        showDots: true,
        showNavButtons: true,
        showClearArt: false,
        panAnimation: true
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
        SEASONAL_THEME_SETTINGS: SEASONAL_THEME_SETTINGS,
        SPOTLIGHT_SETTINGS: SPOTLIGHT_SETTINGS
    };

    console.log('[KefinTweaks HomeConfig2] Configuration loaded');

})();