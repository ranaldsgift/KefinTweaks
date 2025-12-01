// KefinTweaks Legacy Skin Defaults (v0.3.5)
// Canonical snapshot of default skins for duplicate detection
// This file is used to identify and remove duplicate skins from admin configs
// DO NOT modify this file - it represents the canonical state at version 0.3.5

(function() {
    'use strict';
    
    // ============================================================================
    // LEGACY SKIN DEFAULTS (v0.3.5)
    // ============================================================================

    const getKefinTweaksRoot = () => {
        return window.KefinTweaksConfig?.kefinTweaksRoot || 'https://ranaldsgift.github.io/KefinTweaks/';
    }
    
    const KEFIN_TWEAKS_LEGACY_SKIN_DEFAULTS = {
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
                        majorServerVersions: [10, 11],
                        urls: [
                            'https://cdn.jsdelivr.net/gh/lscambo13/ElegantFin@main/Theme/ElegantFin-jellyfin-theme-build-latest-minified.css',
                            'https://cdn.jsdelivr.net/gh/lscambo13/ElegantFin@main/Theme/assets/add-ons/media-bar-plugin-support-nightly.css',
                            `${getKefinTweaksRoot()}skins/elegantKefin.css`
                        ]
                    }
                ],
                colorSchemes: []
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
                colorSchemes: []
            },
            {
                name: 'GlassFin',
                author: 'KBH-Reeper',
                url: [
                    {
                        majorServerVersions: [10, 11],
                        urls: [
                            'https://cdn.jsdelivr.net/gh/KBH-Reeper/GlassFin@main/Theme/GlassFin-Theme-latest-stable.css',
                            'https://cdn.jsdelivr.net/gh/KBH-Reeper/GlassFin@main/Theme/PluginStyling/MediaBar-Plugin-latest.css'
                        ]
                    }
                ],
                colorSchemes: [
                    {
                        name: 'Glass',
                        url: '@import url("https://cdn.jsdelivr.net/gh/KBH-Reeper/GlassFin@main/Theme/Styling/BadgeStyling/Glass.css");'
                    },
                    {
                        name: 'Faded',
                        url: '@import url("https://cdn.jsdelivr.net/gh/KBH-Reeper/GlassFin@main/Theme/Styling/BadgeStyling/Faded.css");'
                    },
                    {
                        name: 'Neon',
                        url: '@import url("https://cdn.jsdelivr.net/gh/KBH-Reeper/GlassFin@main/Theme/Styling/BadgeStyling/Neon.css");'
                    }
                ]
            },
            {
                name: 'Jellypane',
                author: 'tedhinklater',
                url: [
                    {
                        majorServerVersions: [10],
                        urls: ['https://cdn.jsdelivr.net/gh/tedhinklater/Jellypane@main/jellypane.css']
                    }
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
                colorSchemes: []
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
                            'https://cdn.jsdelivr.net/gh/JamsRepos/Jamfin@latest/theme/complete.css',
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
                colorSchemes: []
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
                name: 'Monochromic',
                author: 'CTalvio',
                url: [
                    {
                        majorServerVersions: [10, 11],
                        urls: [
                            'https://cdn.jsdelivr.net/gh/CTalvio/Ultrachromic/presets/monochromic_preset.css',
                            `${getKefinTweaksRoot()}skins/chromic-kefin.css`
                        ]
                    }
                ],
                colorSchemes: []
            },
            {
                name: 'Kaleidochromic',
                author: 'CTalvio',
                url: [
                    {
                        majorServerVersions: [10, 11],
                        urls: [
                            'https://cdn.jsdelivr.net/gh/CTalvio/Ultrachromic/presets/kaleidochromic_preset.css',
                            `${getKefinTweaksRoot()}skins/chromic-kefin.css`
                        ]
                    }
                ],
                colorSchemes: []
            },
            {
                name: 'Novachromic',
                author: 'CTalvio',
                url: [
                    {
                        majorServerVersions: [10, 11],
                        urls: [
                            'https://cdn.jsdelivr.net/gh/CTalvio/Ultrachromic/presets/novachromic_preset.css',
                            `${getKefinTweaksRoot()}skins/chromic-kefin.css`
                        ]
                    }
                ],
                colorSchemes: []
            }
        ]
    };
    
    // ============================================================================
    // CONFIGURATION EXPOSURE
    // ============================================================================
    // Make legacy skin defaults available for duplicate detection
    window.KefinTweaksLegacySkinDefaults = KEFIN_TWEAKS_LEGACY_SKIN_DEFAULTS;
    
    console.log('[KefinTweaks Legacy Skin Defaults] Canonical defaults (v0.3.5) loaded. Available at window.KefinTweaksLegacySkinDefaults');
    
})();

