window.KefinTweaksDefaultConfig = {
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
    },
    {
      "name": "ElegantFin",
      "author": "lscambo13",
      "url": [
        {
          "majorServerVersions": [10, 11],
          "urls": [
            "https://cdn.jsdelivr.net/gh/lscambo13/ElegantFin@main/Theme/ElegantFin-jellyfin-theme-build-latest-minified.css",
            "https://cdn.jsdelivr.net/gh/lscambo13/ElegantFin@main/Theme/assets/add-ons/media-bar-plugin-support-nightly.css",
            "https://ranaldsgift.github.io/KefinTweaks/skins/elegantKefin.css"
          ]
        }
      ],
      "colorSchemes": [],
      "enabled": true,
      "hidden": true
    },
    {
      "name": "NeutralFin",
      "author": "KartoffelChipss",
      "url": [
        {
          "majorServerVersions": [10, 11],
          "urls": [
            "https://cdn.jsdelivr.net/gh/KartoffelChipss/NeutralFin@latest/theme/neutralfin-minified.css",
            "https://cdn.jsdelivr.net/gh/KartoffelChipss/Jellyfin-Lucide@main/theme/jellyfin-lucide.css",
            "https://ranaldsgift.github.io/KefinTweaks/skins/neutralfin-kefin.css"
          ]
        }
      ],
      "colorSchemes": [],
      "enabled": true,
      "hidden": true
    },
    {
      "name": "Jellypane",
      "author": "tedhinklater",
      "url": [
        {
          "majorServerVersions": [10],
          "urls": ["https://cdn.jsdelivr.net/gh/tedhinklater/Jellypane@main/Jellypane.css"]
        },
        {
          "majorServerVersions": [11],
          "urls": ["https://cdn.jsdelivr.net/gh/tedhinklater/Jellypane@main/Jellypane10.11.css"]
        }
      ],
      "colorSchemes": [],
      "enabled": true,
      "hidden": true
    },
    {
      "name": "Jellyfish",
      "author": "n00bcodr",
      "url": [
        {
          "majorServerVersions": [10],
          "urls": ["https://cdn.jsdelivr.net/gh/n00bcodr/jellyfish@main/theme.css"]
        },
        {
          "majorServerVersions": [11],
          "urls": [
            "https://cdn.jsdelivr.net/gh/n00bcodr/jellyfish@main/theme.css",
            "https://cdn.jsdelivr.net/gh/n00bcodr/jellyfish@main/10.11_fixes.css"
          ]
        }
      ],
      "colorSchemes": [
        {
          "name": "Default",
          "url": ""
        },
        {
          "name": "Banana",
          "url": "https://cdn.jsdelivr.net/gh/n00bcodr/Jellyfish/colors/banana.css"
        },
        {
          "name": "Coal",
          "url": "https://cdn.jsdelivr.net/gh/n00bcodr/Jellyfish/colors/coal.css"
        },
        {
          "name": "Coral",
          "url": "https://cdn.jsdelivr.net/gh/n00bcodr/Jellyfish/colors/coral.css"
        },
        {
          "name": "Grass",
          "url": "https://cdn.jsdelivr.net/gh/n00bcodr/Jellyfish/colors/grass.css"
        },
        {
          "name": "Jellyblue",
          "url": "https://cdn.jsdelivr.net/gh/n00bcodr/Jellyfish/colors/jellyblue.css"
        },
        {
          "name": "Jellyflix",
          "url": "https://cdn.jsdelivr.net/gh/n00bcodr/Jellyfish/colors/jellyflix.css"
        },
        {
          "name": "Lavender",
          "url": "https://cdn.jsdelivr.net/gh/n00bcodr/Jellyfish/colors/lavender.css"
        },
        {
          "name": "Mint",
          "url": "https://cdn.jsdelivr.net/gh/n00bcodr/Jellyfish/colors/mint.css"
        },
        {
          "name": "Ocean",
          "url": "https://cdn.jsdelivr.net/gh/n00bcodr/Jellyfish/colors/ocean.css"
        },
        {
          "name": "Peach",
          "url": "https://cdn.jsdelivr.net/gh/n00bcodr/Jellyfish/colors/peach.css"
        },
        {
          "name": "Watermelon",
          "url": "https://cdn.jsdelivr.net/gh/n00bcodr/Jellyfish/colors/watermelon.css"
        }
      ],
      "enabled": true,
      "hidden": true
    },
    {
      "name": "Glassmorphism",
      "author": "alexyle",
      "url": [
        {
          "majorServerVersions": [10, 11],
          "urls": ["https://cdn.jsdelivr.net/gh/alexyle/jellyfin-theme@main/glassmorphism/theme.css"]
        }
      ],
      "colorSchemes": [],
      "enabled": true,
      "hidden": true
    },
    {
      "name": "Zombie",
      "author": "MakD",
      "url": [
        {
          "majorServerVersions": [10],
          "urls": ["https://cdn.jsdelivr.net/gh/MakD/zombie-release@latest/zombie_revived.css"]
        }
      ],
      "colorSchemes": [
        {
          "name": "Default",
          "url": ""
        },
        {
          "name": "Amazon Prime",
          "url": "https://cdn.jsdelivr.net/gh/MakD/zombie-release@latest/color-schemes/amazon-prime.css"
        },
        {
          "name": "Apple TV",
          "url": "https://cdn.jsdelivr.net/gh/MakD/zombie-release@latest/color-schemes/apple-tv.css"
        },
        {
          "name": "Disney",
          "url": "https://cdn.jsdelivr.net/gh/MakD/zombie-release@latest/color-schemes/disney.css"
        },
        {
          "name": "HBO Max",
          "url": "https://cdn.jsdelivr.net/gh/MakD/zombie-release@latest/color-schemes/hbo-max.css"
        },
        {
          "name": "Hulu",
          "url": "https://cdn.jsdelivr.net/gh/MakD/zombie-release@latest/color-schemes/hulu.css"
        },
        {
          "name": "Netflix",
          "url": "https://cdn.jsdelivr.net/gh/MakD/zombie-release@latest/color-schemes/netflix.css"
        },
        {
          "name": "YouTube",
          "url": "https://cdn.jsdelivr.net/gh/MakD/zombie-release@latest/color-schemes/youtube.css"
        }
      ],
      "enabled": true,
      "hidden": true
    },
    {
      "name": "Jamfin",
      "author": "JamsRepos",
      "url": [
        {
          "majorServerVersions": [10],
          "urls": [
            "https://cdn.jsdelivr.net/gh/JamsRepos/Jamfin@latest/theme/complete.css",
            "https://ranaldsgift.github.io/KefinTweaks/skins/jamfin-kefin.css",
            "https://ranaldsgift.github.io/KefinTweaks/skins/jamfin-kefin-10.css"
          ]
        },
        {
          "majorServerVersions": [11],
          "urls": [
            "https://cdn.jsdelivr.net/gh/JamsRepos/Jamfin@latest/theme/complete.css",
            "https://ranaldsgift.github.io/KefinTweaks/skins/jamfin-kefin.css"
          ]
        }
      ],
      "colorSchemes": [],
      "enabled": true,
      "hidden": true
    },
    {
      "name": "Scyfin",
      "author": "loof2736",
      "url": [
        {
          "majorServerVersions": [10],
          "urls": [
            "https://cdn.jsdelivr.net/gh/loof2736/scyfin@v1.4.17/CSS/scyfin-theme.css",
            "https://ranaldsgift.github.io/KefinTweaks/skins/scyfin-kefin.css"
          ]
        },
        {
          "majorServerVersions": [11],
          "urls": [
            "https://cdn.jsdelivr.net/gh/loof2736/scyfin@latest/CSS/scyfin-theme.css",
            "https://ranaldsgift.github.io/KefinTweaks/skins/scyfin-kefin.css"
          ]
        }
      ],
      "colorSchemes": [
        {
          "name": "Default",
          "url": ""
        },
        {
          "name": "Seafoam",
          "url": "https://cdn.jsdelivr.net/gh/loof2736/scyfin@latest/CSS/theme-seafoam.css"
        },
        {
          "name": "Coral",
          "url": "https://cdn.jsdelivr.net/gh/loof2736/scyfin@latest/CSS/theme-coral.css"
        },
        {
          "name": "Snow",
          "url": "https://cdn.jsdelivr.net/gh/loof2736/scyfin@latest/CSS/theme-snow.css"
        },
        {
          "name": "OLED",
          "url": "https://cdn.jsdelivr.net/gh/loof2736/scyfin@latest/CSS/theme-oled.css"
        }
      ],
      "enabled": true,
      "hidden": true
    },
    {
      "name": "Catppuccin",
      "author": "Catppuccin",
      "url": [
        {
          "majorServerVersions": [10, 11],
          "urls": ["https://jellyfin.catppuccin.com/theme.css"]
        }
      ],
      "colorSchemes": [
        {
          "name": "Latte",
          "url": "https://jellyfin.catppuccin.com/catppuccin-latte.css"
        },
        {
          "name": "Frappé",
          "url": "https://jellyfin.catppuccin.com/catppuccin-frappe.css"
        },
        {
          "name": "Macchiato",
          "url": "https://jellyfin.catppuccin.com/catppuccin-macchiato.css"
        },
        {
          "name": "Mocha",
          "url": "https://jellyfin.catppuccin.com/catppuccin-mocha.css"
        }
      ],
      "enabled": true,
      "hidden": true
    },
    {
      "name": "Flow",
      "author": "LitCastVlog",
      "url": [
        {
          "majorServerVersions": [10],
          "urls": [
            "https://cdn.jsdelivr.net/gh/LitCastVlog/Flow@main/CSS/ScyFlow-oneliner.css",
            "https://ranaldsgift.github.io/KefinTweaks/skins/flow-kefin.css"
          ]
        },
        {
          "majorServerVersions": [11],
          "urls": [
            "https://cdn.jsdelivr.net/gh/LitCastVlog/Flow@main/CSS/ScyFlow-oneliner.css",
            "https://cdn.jsdelivr.net/gh/LitCastVlog/Flow@main/CSS/ScyFlow-Compatibility.css",
            "https://ranaldsgift.github.io/KefinTweaks/skins/flow-kefin.css"
          ]
        }
      ],
      "colorSchemes": [
        {
          "name": "Default",
          "url": ""
        },
        {
          "name": "Orange",
          "url": "https://cdn.jsdelivr.net/gh/LitCastVlog/Flow@main/CSS/Themes/ScyFlow-Orange.css"
        },
        {
          "name": "Pink",
          "url": "https://cdn.jsdelivr.net/gh/LitCastVlog/Flow@main/CSS/Themes/ScyFlow-Pink.css"
        },
        {
          "name": "Rainbow",
          "url": "https://cdn.jsdelivr.net/gh/LitCastVlog/Flow@main/CSS/Themes/ScyFlow-Rainbow.css"
        },
        {
          "name": "Red",
          "url": "https://cdn.jsdelivr.net/gh/LitCastVlog/Flow@main/CSS/Themes/ScyFlow-Red.css"
        },
        {
          "name": "White",
          "url": "https://cdn.jsdelivr.net/gh/LitCastVlog/Flow@main/CSS/Themes/ScyFlow-White.css"
        },
        {
          "name": "Blue",
          "url": "https://cdn.jsdelivr.net/gh/LitCastVlog/Flow@main/CSS/Themes/ScyFlow-Blue.css"
        },
        {
          "name": "Seafoam",
          "url": "https://cdn.jsdelivr.net/gh/loof2736/scyfin@latest/CSS/theme-seafoam.css"
        },
        {
          "name": "Coral",
          "url": "https://cdn.jsdelivr.net/gh/loof2736/scyfin@latest/CSS/theme-coral.css"
        },
        {
          "name": "Snow",
          "url": "https://cdn.jsdelivr.net/gh/loof2736/scyfin@latest/CSS/theme-snow.css"
        }
      ],
      "enabled": true,
      "hidden": true
    },
    {
      "name": "Monochromic",
      "author": "CTalvio",
      "url": [
        {
          "majorServerVersions": [10, 11],
          "urls": [
            "https://cdn.jsdelivr.net/gh/CTalvio/Ultrachromic/presets/monochromic_preset.css",
            "https://ranaldsgift.github.io/KefinTweaks/skins/chromic-kefin.css"
          ]
        }
      ],
      "colorSchemes": [],
      "enabled": true,
      "hidden": true
    },
    {
      "name": "Kaleidochromic",
      "author": "CTalvio",
      "url": [
        {
          "majorServerVersions": [10, 11],
          "urls": [
            "https://cdn.jsdelivr.net/gh/CTalvio/Ultrachromic/presets/kaleidochromic_preset.css",
            "https://ranaldsgift.github.io/KefinTweaks/skins/chromic-kefin.css"
          ]
        }
      ],
      "colorSchemes": [],
      "enabled": true,
      "hidden": true
    },
    {
      "name": "Novachromic",
      "author": "CTalvio",
      "url": [
        {
          "majorServerVersions": [10, 11],
          "urls": [
            "https://cdn.jsdelivr.net/gh/CTalvio/Ultrachromic/presets/novachromic_preset.css",
            "https://ranaldsgift.github.io/KefinTweaks/skins/chromic-kefin.css"
          ]
        }
      ],
      "colorSchemes": [],
      "enabled": true,
      "hidden": true
    }
  ],
  "defaultSkin": null,
  "themes": [],
  "customMenuLinks": []
};
