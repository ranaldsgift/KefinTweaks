window.KefinTweaksConfig = {
    "kefinTweaksRoot": "",
    "scripts": {
        "homeScreen": true,
        "search": true,
        "watchlist": true,
        "headerTabs": true,
        "customMenuLinks": true,
        "breadcrumbs": true,
        "playlist": true,
        "itemDetailsCollections": true,
        "flattenSingleSeasonShows": true,
        "collections": true,
        "exclusiveElsewhere": false,
        "backdropLeakFix": true,
        "dashboardButtonFix": true,
        "infiniteScroll": true,
        "removeContinue": true,
        "subtitleSearch": true,
        "skinManager": true
    },
    "homeScreen": {
        "defaultItemLimit": 16,
        "defaultSortOrder": "Random",
        "defaultCardFormat": "Poster",
        "recentlyReleased": {
            "enabled": true,
            "order": 30,
            "movies": {
                "name": "Recently Released Movies",
                "enabled": true,
                "itemLimit": 16,
                "sortOrder": "ReleaseDate",
                "sortOrderDirection": "Descending",
                "cardFormat": "Poster",
                "order": 30
            },
            "episodes": {
                "name": "Recently Aired Episodes",
                "enabled": true,
                "itemLimit": 16,
                "sortOrder": "PremiereDate",
                "sortOrderDirection": "Descending",
                "cardFormat": "Backdrop",
                "order": 31
            }
        },
        "trending": {
            "name": "Trending",
            "enabled": false,
            "itemLimit": 16,
            "sortOrder": "Random",
            "sortOrderDirection": "Ascending",
            "cardFormat": "Poster",
            "order": 32
        },
        "popularTVNetworks": {
            "name": "Popular TV Networks",
            "enabled": true,
            "minimumShowsForNetwork": 5,
            "itemLimit": 16,
            "sortOrder": "Random",
            "sortOrderDirection": "Ascending",
            "cardFormat": "Poster",
            "order": 61
        },
        "watchlist": {
            "name": "Watchlist",
            "enabled": true,
            "itemLimit": 16,
            "sortOrder": "DateAdded",
            "sortOrderDirection": "Descending",
            "cardFormat": "Poster",
            "order": 60
        },
        "watchAgain": {
            "name": "Watch Again",
            "enabled": true,
            "itemLimit": 16,
            "sortOrder": "Random",
            "sortOrderDirection": "Ascending",
            "cardFormat": "Poster",
            "order": 62
        },
        "upcoming": {
            "name": "Upcoming",
            "enabled": true,
            "itemLimit": 48,
            "cardFormat": "Thumb",
            "order": 20
        },
        "imdbTop250": {
            "name": "IMDb Top 250",
            "enabled": true,
            "itemLimit": 16,
            "sortOrder": "Random",
            "sortOrderDirection": "Ascending",
            "cardFormat": "Poster",
            "order": 21
        },
        "seasonal": {
            "enabled": true,
            "defaultItemLimit": 16,
            "defaultSortOrder": "Random",
            "defaultCardFormat": "Poster",
            "seasons": [
                {
                    "id": "halloween",
                    "name": "Halloween",
                    "enabled": true,
                    "startDate": "10-01",
                    "endDate": "10-31",
                    "sections": [
                        {
                            "id": "halloween-tag",
                            "enabled": true,
                            "name": "Halloween Movies",
                            "type": "Tag",
                            "source": "halloween",
                            "itemLimit": 16,
                            "sortOrder": "Random",
                            "sortOrderDirection": "Ascending",
                            "cardFormat": "Poster",
                            "order": 50
                        },
                        {
                            "id": "halloween-horror",
                            "enabled": true,
                            "name": "Horror Genre",
                            "type": "Genre",
                            "source": "Horror",
                            "itemLimit": 16,
                            "sortOrder": "Random",
                            "sortOrderDirection": "Ascending",
                            "cardFormat": "Poster",
                            "order": 51
                        },
                        {
                            "id": "halloween-thriller",
                            "enabled": true,
                            "name": "Thriller Genre",
                            "type": "Genre",
                            "source": "Thriller",
                            "itemLimit": 16,
                            "sortOrder": "Random",
                            "sortOrderDirection": "Ascending",
                            "cardFormat": "Poster",
                            "order": 52
                        }
                    ]
                },
                {
                    "id": "thanksgiving",
                    "name": "Thanksgiving",
                    "enabled": true,
                    "startDate": "11-20",
                    "endDate": "11-30",
                    "order": 50,
                    "sections": [
                        {
                            "id": "seasonal-2-section-0",
                            "enabled": true,
                            "name": "Thanksgiving Movies",
                            "type": "Tag",
                            "source": "thanksgiving",
                            "itemLimit": 16,
                            "sortOrder": "Random",
                            "sortOrderDirection": "Ascending",
                            "cardFormat": "Poster",
                            "order": 50,
                            "spotlight": true,
                            "discoveryEnabled": false,
                            "searchTerm": "",
                            "includeItemTypes": [
                                "Movie"
                            ]
                        },
                        {
                            "id": "seasonal-2-section-1",
                            "enabled": true,
                            "name": "Thanksgiving Episodes",
                            "type": "Parent",
                            "source": "",
                            "itemLimit": 16,
                            "sortOrder": "Random",
                            "sortOrderDirection": "Ascending",
                            "cardFormat": "Thumb",
                            "order": 51,
                            "spotlight": false,
                            "discoveryEnabled": false,
                            "searchTerm": "thanksgiving",
                            "includeItemTypes": [
                                "Episode"
                            ]
                        }
                    ]
                },
                {
                    "id": "christmas",
                    "name": "Christmas",
                    "enabled": true,
                    "startDate": "12-01",
                    "endDate": "12-31",
                    "sections": [
                        {
                            "id": "christmas-genre",
                            "enabled": true,
                            "name": "Christmas Movies",
                            "type": "Genre",
                            "source": "Christmas",
                            "itemLimit": 16,
                            "sortOrder": "Random",
                            "sortOrderDirection": "Ascending",
                            "cardFormat": "Poster",
                            "order": 60
                        },
                        {
                            "id": "christmas-family",
                            "enabled": true,
                            "name": "Family Movies",
                            "type": "Genre",
                            "source": "Family",
                            "itemLimit": 16,
                            "sortOrder": "Random",
                            "sortOrderDirection": "Ascending",
                            "cardFormat": "Poster",
                            "order": 61
                        }
                    ]
                }
            ]
        },
        "discovery": {
            "enabled": true,
            "infiniteScroll": true,
            "minPeopleAppearances": 10,
            "minGenreMovieCount": 50,
            "defaultItemLimit": 16,
            "defaultSortOrder": "Random",
            "defaultCardFormat": "Poster",
            "sectionTypes": {
                "spotlightGenre": {
                    "enabled": true,
                    "name": "Top Rated [Genre] Movies",
                    "itemLimit": 16,
                    "sortOrder": "Random",
                    "sortOrderDirection": "Ascending",
                    "cardFormat": "Poster"
                },
                "spotlightNetwork": {
                    "enabled": true,
                    "name": "Top Rated Shows from [Studio]",
                    "itemLimit": 16,
                    "sortOrder": "Random",
                    "sortOrderDirection": "Ascending",
                    "cardFormat": "Poster"
                },
                "genreMovies": {
                    "enabled": true,
                    "name": "[Genre] Movies",
                    "itemLimit": 16,
                    "sortOrder": "Random",
                    "sortOrderDirection": "Ascending",
                    "cardFormat": "Poster"
                },
                "studioShows": {
                    "enabled": true,
                    "name": "Shows from [Studio]",
                    "itemLimit": 16,
                    "sortOrder": "Random",
                    "sortOrderDirection": "Ascending",
                    "cardFormat": "Poster"
                },
                "collections": {
                    "enabled": true,
                    "name": "[Collection Name]",
                    "itemLimit": 16,
                    "sortOrder": "Random",
                    "sortOrderDirection": "Ascending",
                    "cardFormat": "Poster",
                    "minimumItems": 10
                },
                "becauseYouWatched": {
                    "enabled": true,
                    "name": "Because you watched [Movie]",
                    "itemLimit": 16,
                    "sortOrder": "Random",
                    "sortOrderDirection": "Ascending",
                    "cardFormat": "Poster"
                },
                "becauseYouLiked": {
                    "enabled": true,
                    "name": "Because you liked [Movie]",
                    "itemLimit": 16,
                    "sortOrder": "Random",
                    "sortOrderDirection": "Ascending",
                    "cardFormat": "Poster"
                },
                "starringTopActor": {
                    "enabled": true,
                    "name": "Starring [Actor]",
                    "itemLimit": 16,
                    "sortOrder": "Random",
                    "sortOrderDirection": "Ascending",
                    "cardFormat": "Poster"
                },
                "directedByTopDirector": {
                    "enabled": true,
                    "name": "Directed by [Director]",
                    "itemLimit": 16,
                    "sortOrder": "Random",
                    "sortOrderDirection": "Ascending",
                    "cardFormat": "Poster"
                },
                "writtenByTopWriter": {
                    "enabled": true,
                    "name": "Written by [Writer]",
                    "itemLimit": 16,
                    "sortOrder": "Random",
                    "sortOrderDirection": "Ascending",
                    "cardFormat": "Poster"
                },
                "becauseYouRecentlyWatched": {
                    "enabled": true,
                    "name": "Because you recently watched [Movie]",
                    "itemLimit": 16,
                    "sortOrder": "Random",
                    "sortOrderDirection": "Ascending",
                    "cardFormat": "Poster"
                },
                "starringActorRecentlyWatched": {
                    "enabled": true,
                    "name": "Starring [Actor] because you recently watched [Movie]",
                    "itemLimit": 16,
                    "sortOrder": "Random",
                    "sortOrderDirection": "Ascending",
                    "cardFormat": "Poster"
                },
                "directedByDirectorRecentlyWatched": {
                    "enabled": true,
                    "name": "Directed by [Director] because you recently watched [Movie]",
                    "itemLimit": 16,
                    "sortOrder": "Random",
                    "sortOrderDirection": "Ascending",
                    "cardFormat": "Poster"
                },
                "writtenByWriterRecentlyWatched": {
                    "enabled": true,
                    "name": "Written by [Writer] because you recently watched [Movie]",
                    "itemLimit": 16,
                    "sortOrder": "Random",
                    "sortOrderDirection": "Ascending",
                    "cardFormat": "Poster"
                }
            },
            "spotlightDiscoveryChance": 0.5,
            "spotlight": {
                "autoPlay": true,
                "interval": 5000,
                "showDots": true,
                "showNavButtons": true,
                "showClearArt": true
            },
            "randomizeOrder": false
        },
        "customSections": []
    },
    "exclusiveElsewhere": {
        "hideServerName": false
    },
    "search": {
        "enableJellyseerr": false
    },
    "skins": [
        {
            "name": "Default",
            "author": "Jellyfin",
            "url": null,
            "colorSchemes": [],
            "enabled": true,
            "hidden": true
        }
    ],
    "defaultSkin": null,
    "themes": [],
    "customMenuLinks": []
};