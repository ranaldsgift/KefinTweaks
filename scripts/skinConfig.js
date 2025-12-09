// KefinTweaks Default Skin Configuration
// Default skins provided by KefinTweaks
// These skins will be merged with admin-configured skins from KefinTweaksConfig
// Admin-configured skins take priority over default skins (no duplicates by name)

(function() {
    'use strict';
    
    // ============================================================================
    // DEFAULT SKIN CONFIGURATION
    // ============================================================================

    const getKefinTweaksRoot = () => {
        return window.KefinTweaksConfig?.kefinTweaksRoot || 'https://ranaldsgift.github.io/KefinTweaks/';
    }
    
    const KEFIN_TWEAKS_DEFAULT_SKINS_CONFIG = {
        // ============================================================================
        // GLOBAL OPTIONAL INCLUDES
        // ============================================================================
        // Global optional includes that apply to all skins
        // These will be merged with admin-configured global optional includes from KefinTweaksConfig
        globalOptionalIncludes: [
            {
                name: 'Custom Media Covers',
                url: 'https://cdn.jsdelivr.net/gh/lscambo13/ElegantFin@main/Theme/assets/add-ons/custom-media-covers-latest-min.css',
                enabled: false
            },
            {
                name: 'Center My Media',
                url: 'https://cdn.jsdelivr.net/gh/JamsRepos/Jamfin@latest/theme/modules/central-libraries-small.css',
                enabled: false
            },
            {
                name: 'Hide My Media Label',
                url: 'https://cdn.jsdelivr.net/gh/JamsRepos/Jamfin@latest/theme/modules/hide-my-media.css',
                enabled: false
            },
            {
                name: 'Smaller Cast Images',
                url: 'https://cdn.jsdelivr.net/gh/JamsRepos/Jamfin@latest/theme/modules/smaller-cast.css',
                enabled: false
            },
            {
                name: 'Episode Grid',
                url: 'https://cdn.jsdelivr.net/gh/LitCastVlog/Flow@main/CSS/ScyFlow-EpisodeGrid.css',
                enabled: false
            },
            {
                name: 'Round Cast',
                url: 'https://cdn.jsdelivr.net/gh/LitCastVlog/Flow@main/CSS/ScyFLow-RoundCastCrew.css',
                enabled: false
            },
            {
                name: 'Smaller Cast',
                url: 'https://cdn.jsdelivr.net/gh/CTalvio/Ultrachromic/smallercast.css',
                enabled: false
            },
            {
                name: 'Compact Episode List',
                url: 'https://cdn.jsdelivr.net/gh/CTalvio/Ultrachromic/episodelist/episodes_compactlist.css',
                enabled: false
            },
            {
                name: 'Episode Grid',
                url: 'https://cdn.jsdelivr.net/gh/CTalvio/Ultrachromic/episodelist/episodes_grid.css',
                enabled: false
            },
            {
                name: 'Pan Animation',
                url: 'https://cdn.jsdelivr.net/gh/CTalvio/Ultrachromic/effects/pan-animation.css',
                enabled: false
            },
            {
                name: 'Animated Overlay',
                url: 'https://cdn.jsdelivr.net/gh/LitCastVlog/Flow@main/CSS/ScyFlow-AnimatedOverlay.css',
                enabled: false
            }
        ],
        
        // ============================================================================
        // SKIN CONFIGURATION
        // ============================================================================
        // Configure available skins for the display settings page
        // These skins will be merged with skins from the main KefinTweaks config
        // Admin-configured skins take priority over default skins (no duplicates by name)
        // Each skin's url field should be an array of objects with majorServerVersions and urls arrays
        // Example: url: [{ majorServerVersions: [10, 11], urls: ['url1.css', 'url2.css'] }]
        // Each skin can also have colorSchemes array for color variations specific to that skin
        // Each skin should have an author field indicating who created the skin
        skins: [
            {
                name: 'Default',
                author: 'Jellyfin',
                url: null,  // null means no additional CSS (default Jellyfin theme)
                colorSchemes: []
            },
            {
                name: 'ElegantFin',
                author: 'lscambo13',
                url: [
                    {
                        majorServerVersions: [10],
                        urls: [
                            'https://cdn.jsdelivr.net/gh/lscambo13/ElegantFin@main/Theme/ElegantFin-jellyfin-theme-build-latest-minified.css',
                            `${getKefinTweaksRoot()}skins/elegant-kefin.css`
                        ]
                    },
                    {
                        majorServerVersions: [11],
                        urls: [
                            'https://cdn.jsdelivr.net/gh/lscambo13/ElegantFin@main/Theme/ElegantFin-jellyfin-theme-build-latest-minified.css',
                            `${getKefinTweaksRoot()}skins/elegant-kefin.css`,                            
                            `${getKefinTweaksRoot()}skins/fin-kefin-10.11.css`
                        ]
                    }
                ],
                colorSchemes: [],
                optionalIncludes: [
                    {
                        name: 'Media Bar Support',
                        url: 'https://cdn.jsdelivr.net/gh/lscambo13/ElegantFin@main/Theme/assets/add-ons/media-bar-plugin-support-latest-min.css',
                        enabled: true
                    },
                    {
                        name: 'Media Bar Support (Nightly Version)',
                        url: 'https://cdn.jsdelivr.net/gh/lscambo13/ElegantFin@main/Theme/assets/add-ons/media-bar-plugin-support-nightly.css',
                        enabled: false
                    },
                    {
                        name: 'Disable Card Hover Effect',
                        url: `${getKefinTweaksRoot()}skins/optional/ElegantFin/cardHoverEffect.css`,
                        enabled: false
                    },
                    {
                        name: 'Center Overlay Play Button',
                        url: `${getKefinTweaksRoot()}skins/optional/ElegantFin/centerPlayButton.css`,
                        enabled: false
                    },
                    {
                        name: 'Extra Overlay Buttons',
                        url: `${getKefinTweaksRoot()}skins/optional/ElegantFin/extraOverlayButtons.css`,
                        enabled: false
                    },
                    {
                        name: 'Library Label Visibility',
                        url: `${getKefinTweaksRoot()}skins/optional/ElegantFin/libraryLabelVisibility.css`,
                        enabled: false
                    },
                    {
                        name: 'Solid App Bar',
                        url: `${getKefinTweaksRoot()}skins/optional/ElegantFin/solidAppBar.css`,
                        enabled: false
                    }
                ]
            },
            {
                name: 'NeutralFin',
                author: 'KartoffelChipss',
                url: [
                    {
                        majorServerVersions: [10, 11],
                        urls: [
                            'https://cdn.jsdelivr.net/gh/KartoffelChipss/NeutralFin@latest/theme/neutralfin-minified.css',
                            'https://cdn.jsdelivr.net/gh/KartoffelChipss/Jellyfin-Lucide@main/theme/jellyfin-lucide.css',
                            `${getKefinTweaksRoot()}skins/neutralfin-kefin.css`
                        ]
                    }
                ],
                colorSchemes: [],
                optionalIncludes: [
                    {
                        name: 'Media Bar Support',
                        url: 'https://cdn.jsdelivr.net/gh/lscambo13/ElegantFin@main/Theme/assets/add-ons/media-bar-plugin-support-latest-min.css',
                        enabled: true
                    },
                    {
                        name: 'Media Bar Support (Nightly Version)',
                        url: 'https://cdn.jsdelivr.net/gh/lscambo13/ElegantFin@main/Theme/assets/add-ons/media-bar-plugin-support-nightly.css',
                        enabled: false
                    },
                    {
                        name: 'Disable Card Hover Effect',
                        url: `${getKefinTweaksRoot()}skins/optional/ElegantFin/cardHoverEffect.css`,
                        enabled: false
                    },
                    {
                        name: 'Center Overlay Play Button',
                        url: `${getKefinTweaksRoot()}skins/optional/ElegantFin/centerPlayButton.css`,
                        enabled: false
                    },
                    {
                        name: 'Extra Overlay Buttons',
                        url: `${getKefinTweaksRoot()}skins/optional/ElegantFin/extraOverlayButtons.css`,
                        enabled: false
                    },
                    {
                        name: 'Library Label Visibility',
                        url: `${getKefinTweaksRoot()}skins/optional/ElegantFin/libraryLabelVisibility.css`,
                        enabled: false
                    },
                    {
                        name: 'Solid App Bar',
                        url: `${getKefinTweaksRoot()}skins/optional/ElegantFin/solidAppBar.css`,
                        enabled: false
                    }
                ]
            },
            {
                name: 'GlassFin',
                author: 'KBH-Reeper',
                url: [
                    {
                        majorServerVersions: [10, 11],
                        urls: [
                            'https://cdn.jsdelivr.net/gh/KBH-Reeper/GlassFin@latest/Theme/GlassFin-Theme-latest-stable.css',
                            'https://cdn.jsdelivr.net/gh/KBH-Reeper/GlassFin@latest/Theme/PluginStyling/MediaBar-Plugin-latest.css',
                            `${getKefinTweaksRoot()}skins/glassfin-kefin.css`
                        ]
                    }
                ],
                colorSchemes: [
                    {
                        name: 'Glass',
                        url: 'https://cdn.jsdelivr.net/gh/KBH-Reeper/GlassFin@main/Theme/Styling/BadgeStyling/Glass.css'
                    },
                    {
                        name: 'Faded',
                        url: 'https://cdn.jsdelivr.net/gh/KBH-Reeper/GlassFin@main/Theme/Styling/BadgeStyling/Faded.css'
                    },
                    {
                        name: 'Neon',
                        url: 'https://cdn.jsdelivr.net/gh/KBH-Reeper/GlassFin@main/Theme/Styling/BadgeStyling/Neon.css'
                    },
                    {
                        name: 'PurpleGlass',
                        url: 'https://cdn.jsdelivr.net/gh/KBH-Reeper/GlassFin@main/Theme/Styling/BadgeStyling/PurpleGlass.css'
                    },
                    {
                        name: 'PurpleStainedGlass',
                        url: 'https://cdn.jsdelivr.net/gh/KBH-Reeper/GlassFin@main/Theme/Styling/BadgeStyling/PurpleStainedGlass.css'
                    },
                    {
                        name: 'RedGlass',
                        url: 'https://cdn.jsdelivr.net/gh/KBH-Reeper/GlassFin@main/Theme/Styling/BadgeStyling/RedGlass.css'
                    },
                    {
                        name: 'BlueGlass',
                        url: 'https://cdn.jsdelivr.net/gh/KBH-Reeper/GlassFin@main/Theme/Styling/BadgeStyling/BlueGlass.css'
                    }
                ],
                optionalIncludes: [
                    {
                        name: 'Media Bar Support',
                        url: 'https://cdn.jsdelivr.net/gh/KBH-Reeper/GlassFin@main/Theme/PluginStyling/MediaBar-Plugin-latest.css',
                        enabled: false
                    },
                    {
                        name: 'Additional Poster Buttons',
                        url: 'https://cdn.jsdelivr.net/gh/KBH-Reeper/GlassFin@main/Theme/Stylings/CardButtons.css',
                        enabled: false
                    },
                    {
                        name: 'Watched Status Badges',
                        url: 'https://cdn.jsdelivr.net/gh/KBH-Reeper/GlassFin@main/Theme/Styling/ActivateBadges.css',
                        enabled: false
                    },
                    {
                        name: 'Disable Card Hover Effect',
                        url: `${getKefinTweaksRoot()}skins/optional/ElegantFin/cardHoverEffect.css`,
                        enabled: false
                    },
                    {
                        name: 'Center Overlay Play Button',
                        url: `${getKefinTweaksRoot()}skins/optional/ElegantFin/centerPlayButton.css`,
                        enabled: false
                    },
                    {
                        name: 'Library Label Visibility',
                        url: `${getKefinTweaksRoot()}skins/optional/ElegantFin/libraryLabelVisibility.css`,
                        enabled: false
                    },
                    {
                        name: 'Solid App Bar',
                        url: `${getKefinTweaksRoot()}skins/optional/ElegantFin/solidAppBar.css`,
                        enabled: false
                    }
                ]
            },
            {
                name: 'Jellypane',
                author: 'tedhinklater',
                url: [ // TODO: Update this when we get the specific 10.10.X / 10.11.X versions
                    {
                        majorServerVersions: [10],
                        urls: ['https://cdn.jsdelivr.net/gh/ranaldsgift/Jellypane@main/jellypane.css']
                    },
                    {
                        majorServerVersions: [11],
                        urls: ['https://cdn.jsdelivr.net/gh/tedhinklater/Jellypane@main/jellypane.css']
                    },
                ],
                colorSchemes: []
            },
            {
                name: 'Finimalism',
                author: 'tedhinklater',
                url: [
                    {
                        majorServerVersions: [10],
                        urls: ['https://cdn.jsdelivr.net/gh/tedhinklater/finimalism@main/finimalism7.css']
                    },
                    {
                        majorServerVersions: [11],
                        urls: ['https://cdn.jsdelivr.net/gh/tedhinklater/finimalism@main/finimalism10.11.css']
                    }
                ],
                colorSchemes: [],
                optionalIncludes: [
                    {
                        name: 'No Animations',
                        url: 'https://cdn.jsdelivr.net/gh/tedhinklater/finimalism@main/no-animation.css',
                        enabled: false
                    },
                    {
                        name: 'Horizontal Scrolling',
                        url: 'https://cdn.jsdelivr.net/gh/tedhinklater/finimalism@main/horizontal-scrolling.css',
                        enabled: false
                    }
                ]
            },
            {
                name: 'Jellyfish',
                author: 'n00bcodr',
                url: [
                    {
                        majorServerVersions: [10],
                        urls: ['https://cdn.jsdelivr.net/gh/n00bcodr/jellyfish@main/theme.css']
                    },
                    {
                        majorServerVersions: [11],
                        urls: [
                            'https://cdn.jsdelivr.net/gh/n00bcodr/jellyfish@main/theme.css',
                            'https://cdn.jsdelivr.net/gh/n00bcodr/jellyfish@main/10.11_fixes.css'
                        ]
                    }
                ],
                optionalIncludes: [
                    {
                        name: 'Floating Progress Bar',
                        url: 'https://cdn.jsdelivr.net/gh/n00bcodr/Jellyfish/progress_bar.css',
                        enabled: false
                    },
                    {
                        name: 'Watched Indicators',
                        url: 'https://cdn.jsdelivr.net/gh/n00bcodr/Jellyfish/indicators.css',
                        enabled: false
                    },
                    {
                        name: 'Text instead of icons for buttons on item page',
                        url: 'https://cdn.jsdelivr.net/gh/n00bcodr/Jellyfish/icontext.css',
                        enabled: false
                    },
                    {
                        name: 'Colored Parental Ratings',
                        url: 'https://cdn.jsdelivr.net/gh/n00bcodr/Jellyfish/ratings.css',
                        enabled: false
                    },
                    {
                        name: 'Streamberry logo',
                        url: 'https://cdn.jsdelivr.net/gh/n00bcodr/Jellyfish/streamberry_logo.css',
                        enabled: false
                    }
                ],
                colorSchemes: [
                    {
                        name: 'Default',
                        url: ''
                    },
                    {
                        name: 'Banana',
                        url: 'https://cdn.jsdelivr.net/gh/n00bcodr/Jellyfish/colors/banana.css'
                    },
                    {
                        name: 'Coal',
                        url: 'https://cdn.jsdelivr.net/gh/n00bcodr/Jellyfish/colors/coal.css'
                    },
                    {
                        name: 'Coral',
                        url: 'https://cdn.jsdelivr.net/gh/n00bcodr/Jellyfish/colors/coral.css'
                    },
                    {
                        name: 'Grass',
                        url: 'https://cdn.jsdelivr.net/gh/n00bcodr/Jellyfish/colors/grass.css'
                    },
                    {
                        name: 'Jellyblue',
                        url: 'https://cdn.jsdelivr.net/gh/n00bcodr/Jellyfish/colors/jellyblue.css'
                    },
                    {
                        name: 'Jellyflix',
                        url: 'https://cdn.jsdelivr.net/gh/n00bcodr/Jellyfish/colors/jellyflix.css'
                    },
                    {
                        name: 'Lavender',
                        url: 'https://cdn.jsdelivr.net/gh/n00bcodr/Jellyfish/colors/lavender.css'
                    },
                    {
                        name: 'Mint',
                        url: 'https://cdn.jsdelivr.net/gh/n00bcodr/Jellyfish/colors/mint.css'
                    },
                    {
                        name: 'Ocean',
                        url: 'https://cdn.jsdelivr.net/gh/n00bcodr/Jellyfish/colors/ocean.css'
                    },
                    {
                        name: 'Peach',
                        url: 'https://cdn.jsdelivr.net/gh/n00bcodr/Jellyfish/colors/peach.css'
                    },
                    {
                        name: 'Watermelon',
                        url: 'https://cdn.jsdelivr.net/gh/n00bcodr/Jellyfish/colors/watermelon.css'
                    }
                ]
            },
            {
                name: 'Glassmorphism',
                author: 'alexyle',
                url: [
                    {
                        majorServerVersions: [10, 11],
                        urls: ['https://cdn.jsdelivr.net/gh/alexyle/jellyfin-theme@main/glassmorphism/theme.css']
                    }
                ],
                colorSchemes: []
            },
            {
                name: 'Zombie',
                author: 'MakD',
                url: [
                    {
                        majorServerVersions: [10],
                        urls: ['https://cdn.jsdelivr.net/gh/MakD/zombie-release@latest/zombie_revived.css']
                    }
                ],
                colorSchemes: [
                    {
                        name: 'Default',
                        url: ''
                    },
                    {
                        name: 'Amazon Prime',
                        url: 'https://cdn.jsdelivr.net/gh/MakD/zombie-release@latest/color-schemes/amazon-prime.css'
                    },
                    {
                        name: 'Apple TV',
                        url: 'https://cdn.jsdelivr.net/gh/MakD/zombie-release@latest/color-schemes/apple-tv.css'
                    },
                    {
                        name: 'Disney',
                        url: 'https://cdn.jsdelivr.net/gh/MakD/zombie-release@latest/color-schemes/disney.css'
                    },
                    {
                        name: 'HBO Max',
                        url: 'https://cdn.jsdelivr.net/gh/MakD/zombie-release@latest/color-schemes/hbo-max.css'
                    },
                    {
                        name: 'Hulu',
                        url: 'https://cdn.jsdelivr.net/gh/MakD/zombie-release@latest/color-schemes/hulu.css'
                    },
                    {
                        name: 'Netflix',
                        url: 'https://cdn.jsdelivr.net/gh/MakD/zombie-release@latest/color-schemes/netflix.css'
                    },
                    {
                        name: 'YouTube',
                        url: 'https://cdn.jsdelivr.net/gh/MakD/zombie-release@latest/color-schemes/youtube.css'
                    }
                ]
            },
            {
                name: 'Jamfin',
                author: 'JamsRepos',
                url: [
                    {
                        majorServerVersions: [10],
                        urls: [
                            'https://cdn.jsdelivr.net/gh/JamsRepos/Jamfin@latest/theme/base.css',
                            `${getKefinTweaksRoot()}skins/jamfin-kefin.css`,
                            `${getKefinTweaksRoot()}skins/jamfin-kefin-10.css`
                        ]
                    },
                    {
                        majorServerVersions: [11],
                        urls: [
                            'https://cdn.jsdelivr.net/gh/JamsRepos/Jamfin@latest/theme/complete.css',
                            `${getKefinTweaksRoot()}skins/jamfin-kefin.css`
                        ]
                    }
                ],
                colorSchemes: [],
                optionalIncludes: [
                    {
                        name: 'Watched Indicators',
                        url: 'https://cdn.jsdelivr.net/gh/JamsRepos/Jamfin@latest/theme/modules/count-indicators.css',
                        enabled: false
                    },
                    {
                        name: 'Floating Progress Bar',
                        url: 'https://cdn.jsdelivr.net/gh/JamsRepos/Jamfin@latest/theme/modules/floating-progress.css',
                        enabled: false
                    },
                    {
                        name: 'Hide Forgot Password',
                        url: 'https://cdn.jsdelivr.net/gh/JamsRepos/Jamfin@latest/theme/modules/forgot-password.css',
                        enabled: false
                    },
                    {
                        name: 'Hover Animation',
                        url: 'https://cdn.jsdelivr.net/gh/JamsRepos/Jamfin@latest/theme/modules/moving-cards.css',
                        enabled: false
                    },
                    {
                        name: 'Static Sidebar',
                        url: 'https://cdn.jsdelivr.net/gh/JamsRepos/Jamfin@latest/theme/modules/static-sidebar.css',
                        enabled: false
                    }
                ]
            },
            {
                name: 'Scyfin',
                author: 'loof2736',
                url: [
                    {
                        majorServerVersions: [10],
                        urls: [
                            'https://cdn.jsdelivr.net/gh/loof2736/scyfin@v1.4.17/CSS/scyfin-theme.css',
                            `${getKefinTweaksRoot()}skins/scyfin-kefin.css`
                        ]
                    },
                    {
                        majorServerVersions: [11],
                        urls: [
                            'https://cdn.jsdelivr.net/gh/loof2736/scyfin@latest/CSS/scyfin-theme.css',
                            `${getKefinTweaksRoot()}skins/scyfin-kefin.css`
                        ]
                    }
                ],
                optionalIncludes: [
                    {
                        name: 'Disable Static Drawer',
                        url: 'https://cdn.jsdelivr.net/gh/loof2736/scyfin@latest/CSS/disable-static-drawer.css',
                        enabled: false
                    }
                ],
                colorSchemes: [
                    {
                        name: 'Default',
                        url: ''
                    },
                    {
                        name: 'Seafoam',
                        url: 'https://cdn.jsdelivr.net/gh/loof2736/scyfin@latest/CSS/theme-seafoam.css'
                    },
                    {
                        name: 'Coral',
                        url: 'https://cdn.jsdelivr.net/gh/loof2736/scyfin@latest/CSS/theme-coral.css'
                    },
                    {
                        name: 'Snow',
                        url: 'https://cdn.jsdelivr.net/gh/loof2736/scyfin@latest/CSS/theme-snow.css'
                    },
                    {
                        name: 'OLED',
                        url: 'https://cdn.jsdelivr.net/gh/loof2736/scyfin@latest/CSS/theme-oled.css'
                    }
                ]
            },
            {
                name: 'Catppuccin',
                author: 'Catppuccin',
                url: [
                    {
                        majorServerVersions: [10, 11],
                        urls: ['https://jellyfin.catppuccin.com/theme.css']
                    }
                ],
                colorSchemes: [
                    {
                        name: 'Latte',
                        url: 'https://jellyfin.catppuccin.com/catppuccin-latte.css'
                    },
                    {
                        name: 'Frappé',
                        url: 'https://jellyfin.catppuccin.com/catppuccin-frappe.css'
                    },
                    {
                        name: 'Macchiato',
                        url: 'https://jellyfin.catppuccin.com/catppuccin-macchiato.css'
                    },
                    {
                        name: 'Mocha',
                        url: 'https://jellyfin.catppuccin.com/catppuccin-mocha.css'
                    }
                ]
            },
            {
                name: 'Flow',
                author: 'LitCastVlog',
                url: [
                    {
                        majorServerVersions: [10],
                        urls: [
                            'https://cdn.jsdelivr.net/gh/LitCastVlog/Flow@main/CSS/ScyFlow-oneliner.css',
                            `${getKefinTweaksRoot()}skins/flow-kefin.css`
                        ]
                    },
                    {
                        majorServerVersions: [11],
                        urls: [
                            'https://cdn.jsdelivr.net/gh/LitCastVlog/Flow@main/CSS/ScyFlow-oneliner.css',
                            'https://cdn.jsdelivr.net/gh/LitCastVlog/Flow@main/CSS/ScyFlow-Compatibility.css',
                            `${getKefinTweaksRoot()}skins/flow-kefin.css`
                        ]
                    }
                ],
                optionalIncludes: [
                    {
                        name: 'B/W Logo, Smaller Cast & Crew, Hide Upcoming on TV + Next Up in Season View',
                        url: 'https://cdn.jsdelivr.net/gh/LitCastVlog/Flow@main/CSS/ScyFlow-Extras.css',
                        enabled: false
                    },
                    {
                        name: 'Collapsible Side Drawer',
                        url: 'https://cdn.jsdelivr.net/gh/LitCastVlog/Flow@main/CSS/ScyFlow-Drawer-Toggle.css',
                        enabled: false
                    },
                    {
                        name: 'Bigger Logo',
                        url: 'https://cdn.jsdelivr.net/gh/LitCastVlog/Flow@main/CSS/ScyFlow-HighDPIExtras.css',
                        enabled: false
                    },
                    {
                        name: 'Darker Icons/Accents',
                        url: 'https://cdn.jsdelivr.net/gh/LitCastVlog/Flow@main/CSS/Themes/ScyFlow-Dark.css',
                        enabled: false
                    },
                    {
                        name: 'Episode Grid Outline/Dim on Hover',
                        url: 'https://cdn.jsdelivr.net/gh/LitCastVlog/Flow@main/CSS/ScyFlow-EpisodeGrid-outline.css',
                        enabled: false
                    },
                    {
                        name: 'Horizontal Scroll Episodes',
                        url: 'https://cdn.jsdelivr.net/gh/LitCastVlog/Flow@main/CSS/ScyFlow-Scrollable-Episodes-WIP.css',
                        enabled: false
                    },
                    {
                        name: 'Horizontal Scroll Episodes with Controls Overlayed',
                        url: 'https://cdn.jsdelivr.net/gh/LitCastVlog/Flow@main/CSS/ScyFlow-Scrollable-Episodes-ALT.css',
                        enabled: false
                    },
                    {
                        name: 'Nyan Progress Bar',
                        url: 'https://cdn.jsdelivr.net/gh/LitCastVlog/Flow@main/CSS/Themes/NyanProgress.css',
                        enabled: false
                    },
                    {
                        name: 'Left Aligned Font / Poster Spacing / Watched Indicators',
                        url: 'https://cdn.jsdelivr.net/gh/LitCastVlog/Flow@main/CSS/ScyFlow-FontTweaks.css',
                        enabled: false
                    }
                ],
                colorSchemes: [
                    {
                        name: 'Default',
                        url: ''
                    },
                    {
                        name: 'Orange',
                        url: 'https://cdn.jsdelivr.net/gh/LitCastVlog/Flow@main/CSS/Themes/ScyFlow-Orange.css'
                    },
                    {
                        name: 'Pink',
                        url: 'https://cdn.jsdelivr.net/gh/LitCastVlog/Flow@main/CSS/Themes/ScyFlow-Pink.css'
                    },
                    {
                        name: 'Rainbow',
                        url: 'https://cdn.jsdelivr.net/gh/LitCastVlog/Flow@main/CSS/Themes/ScyFlow-Rainbow.css'
                    },
                    {
                        name: 'Red',
                        url: 'https://cdn.jsdelivr.net/gh/LitCastVlog/Flow@main/CSS/Themes/ScyFlow-Red.css'
                    },
                    {
                        name: 'White',
                        url: 'https://cdn.jsdelivr.net/gh/LitCastVlog/Flow@main/CSS/Themes/ScyFlow-White.css'
                    },
                    {
                        name: 'Blue',
                        url: 'https://cdn.jsdelivr.net/gh/LitCastVlog/Flow@main/CSS/Themes/ScyFlow-Blue.css'
                    },
                    {
                        name: 'Seafoam',
                        url: 'https://cdn.jsdelivr.net/gh/loof2736/scyfin@latest/CSS/theme-seafoam.css'
                    },
                    {
                        name: 'Coral',
                        url: 'https://cdn.jsdelivr.net/gh/loof2736/scyfin@latest/CSS/theme-coral.css'
                    },
                    {
                        name: 'Snow',
                        url: 'https://cdn.jsdelivr.net/gh/loof2736/scyfin@latest/CSS/theme-snow.css'
                    }
                ]
            },
            {
                name: 'Ultrachromic',
                author: 'CTalvio',
                url: [
                    {
                        majorServerVersions: [10, 11],
                        urls: [
                            'https://cdn.jsdelivr.net/gh/CTalvio/Ultrachromic/base.css',
                            'https://cdn.jsdelivr.net/gh/CTalvio/Ultrachromic/accentlist.css',
                            'https://cdn.jsdelivr.net/gh/CTalvio/Ultrachromic/fixes.css',
                            'https://cdn.jsdelivr.net/gh/CTalvio/Ultrachromic/jf_font.css',
                            `${getKefinTweaksRoot()}skins/chromic-kefin.css`
                        ]
                    }
                ],
                optionalIncludes: [,
                    {
                        name: 'Dark',
                        url: 'https://cdn.jsdelivr.net/gh/CTalvio/Ultrachromic/type/dark.css'
                    },
                    {
                        name: 'Light',
                        url: 'https://cdn.jsdelivr.net/gh/CTalvio/Ultrachromic/type/light.css'
                    },
                    {
                        name: 'Colorful',
                        url: 'https://cdn.jsdelivr.net/gh/CTalvio/Ultrachromic/type/colorful.css'
                    },
                    {
                        name: 'Dark with Accent',
                        url: 'https://cdn.jsdelivr.net/gh/CTalvio/Ultrachromic/type/dark_withaccent.css'
                    },
                    {
                        name: 'Round UI Corners',
                        url: 'https://cdn.jsdelivr.net/gh/CTalvio/Ultrachromic/rounding.css',
                        enabled: false
                    },
                    {
                        name: 'Round UI with circle accent on hover',
                        url: 'https://cdn.jsdelivr.net/gh/CTalvio/Ultrachromic/rounding_circlehover.css',
                        enabled: false
                    },
                    {
                        name: 'Login Screen Minimal',
                        url: 'https://cdn.jsdelivr.net/gh/CTalvio/Ultrachromic/login/login_minimalistic.css',
                        enabled: false
                    },
                    {
                        name: 'Login Screen Full',
                        url: 'https://cdn.jsdelivr.net/gh/CTalvio/Ultrachromic/login/login_frame.css',
                        enabled: false
                    },
                    {
                        name: 'Input Fields with Border',
                        url: 'https://cdn.jsdelivr.net/gh/CTalvio/Ultrachromic/fields/fields_border.css',
                        enabled: false
                    },
                    {
                        name: 'Input Fields without Border',
                        url: 'https://cdn.jsdelivr.net/gh/CTalvio/Ultrachromic/fields/fields_noborder.css',
                        enabled: false
                    },
                    {
                        name: 'Floating Watched Indicators',
                        url: 'https://cdn.jsdelivr.net/gh/CTalvio/Ultrachromic/cornerindicator/indicator_floating.css',
                        enabled: false
                    },
                    {
                        name: 'Corner Watched Indicators',
                        url: 'https://cdn.jsdelivr.net/gh/CTalvio/Ultrachromic/cornerindicator/indicator_corner.css',
                        enabled: false
                    },
                    {
                        name: 'Simple Titles',
                        url: 'https://cdn.jsdelivr.net/gh/CTalvio/Ultrachromic/titlepage/title_simple.css',
                        enabled: false
                    },
                    {
                        name: 'Logo Titles',
                        url: 'https://cdn.jsdelivr.net/gh/CTalvio/Ultrachromic/titlepage/title_simple-logo.css',
                        enabled: false
                    },
                    {
                        name: 'Banner Titles',
                        url: 'https://cdn.jsdelivr.net/gh/CTalvio/Ultrachromic/titlepage/title_banner.css',
                        enabled: false
                    },
                    {
                        name: 'Banner Logo Titles',
                        url: 'https://cdn.jsdelivr.net/gh/CTalvio/Ultrachromic/titlepage/title_banner-logo.css',
                        enabled: false
                    },
                    {
                        name: 'Progress Bar',
                        url: 'https://cdn.jsdelivr.net/gh/CTalvio/Ultrachromic/overlayprogress.css',
                        enabled: false
                    },
                    {
                        name: 'Bottom Progress Bar',
                        url: 'https://cdn.jsdelivr.net/gh/CTalvio/Ultrachromic/bottombarprogress.css',
                        enabled: false
                    },
                    {
                        name: 'Floating Progress Bar',
                        url: 'https://cdn.jsdelivr.net/gh/CTalvio/Ultrachromic/progress/floating.css',
                        enabled: false
                    },
                    {
                        name: 'Hoverglow Effect',
                        url: 'https://cdn.jsdelivr.net/gh/CTalvio/Ultrachromic/effects/hoverglow.css',
                        enabled: false
                    },
                    {
                        name: 'Glassy Effect',
                        url: 'https://cdn.jsdelivr.net/gh/CTalvio/Ultrachromic/effects/glassy.css',
                        enabled: false
                    },
                    {
                        name: 'Mobile Backdrop "Hack"',
                        url: 'https://ctalvio.github.io/Monochromic/backdrop-hack_style.css',
                        enabled: false
                    }
                ],
                colorSchemes: [
                    {
                        name: 'Monochromic',
                        url: 'https://cdn.jsdelivr.net/gh/CTalvio/Ultrachromic/presets/monochromic_preset.css',
                        enabled: false
                    },
                    {
                        name: 'Kaleidochromic',
                        url: 'https://cdn.jsdelivr.net/gh/CTalvio/Ultrachromic/presets/kaleidochromic_preset.css',
                        enabled: false
                    },
                    {
                        name: 'Novachromic',
                        url: 'https://cdn.jsdelivr.net/gh/CTalvio/Ultrachromic/presets/novachromic_preset.css',
                        enabled: false
                    }
                ]
            }
            // Add more skins here as needed
        ]
    };
    
    // ============================================================================
    // CONFIGURATION EXPOSURE
    // ============================================================================
    // Make default skin configuration available to scripts
    window.KefinTweaksDefaultSkinsConfig = KEFIN_TWEAKS_DEFAULT_SKINS_CONFIG;
    
    console.log('[KefinTweaks SkinConfig] Default skin configuration loaded. Available at window.KefinTweaksDefaultSkinsConfig');
    
})();

