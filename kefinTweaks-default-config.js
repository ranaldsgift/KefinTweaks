window.KefinTweaksDefaultConfig = {
  "kefinTweaksRoot": "https://ranaldsgift.github.io/KefinTweaks/",
  "scriptRoot": "https://ranaldsgift.github.io/KefinTweaks/scripts/",
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
    "enableNewAndTrending": true,
    "enableNewMovies": true,
    "enableNewEpisodes": true,
    "enableTrending": false,
    "enableDiscovery": true,
    "enableInfiniteScroll": true,
    "minPeopleAppearances": 10,
    "minGenreMovieCount": 50,
    "minimumShowsForNetwork": 5,
    "enableWatchlist": true,
    "enableSeasonal": true,
    "seasonalItemLimit": 16,
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
