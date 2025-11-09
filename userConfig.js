// KefinTweaks User Configuration
// User-specific settings and configurations for KefinTweaks features
// This file contains settings that users can customize for their specific needs

(function() {
    'use strict';
    
    // ============================================================================
    // USER CONFIGURATION
    // ============================================================================
    
    const USER_CONFIG = {
        // ============================================================================
        // SKIN CONFIGURATION
        // ============================================================================
        // Configure available skins for the display settings page
        // These skins will be merged with skins from the main KefinTweaks config
        // User-defined skins take priority over main config skins (no duplicates by name)
        // Each skin can have a single URL (string) or multiple URLs (array) for complex themes
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
                    'https://cdn.jsdelivr.net/gh/lscambo13/ElegantFin@main/Theme/ElegantFin-jellyfin-theme-build-latest-minified.css',
                    'https://cdn.jsdelivr.net/gh/lscambo13/ElegantFin@main/Theme/assets/add-ons/media-bar-plugin-support-latest-min.css',
                    'https://cdn.jsdelivr.net/gh/LitCastVlog/Flow@main/CSS/ScyFLow-RoundCastCrew.css',
                    'https://cdn.jsdelivr.net/gh/CTalvio/Ultrachromic/episodelist/episodes_grid.css',
                    `${KefinTweaksConfig.scriptRoot}skins/elegantKefin.css`
                ],
                colorSchemes: []
            },
            {
                name: 'NeutralFin',
                author: 'KartoffelChipss',
                url: [ 
                    'https://cdn.jsdelivr.net/gh/KartoffelChipss/NeutralFin@latest/theme/neutralfin-minified.css',
                    'https://cdn.jsdelivr.net/gh/KartoffelChipss/Jellyfin-Lucide@main/theme/jellyfin-lucide.css',
                    `${KefinTweaksConfig.scriptRoot}skins/neutralfin-kefin.css`
                 ],
                colorSchemes: []
            },
            {
                name: 'Jellypane',
                author: 'tedhinklater',
                url: 'https://cdn.jsdelivr.net/gh/tedhinklater/Jellypane@main/Jellypane.css',
                colorSchemes: []
            },
            {
                name: 'Jellyfish',
                author: 'n00bcodr',
                url: 'https://cdn.jsdelivr.net/gh/n00bcodr/jellyfish@main/theme.css',
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
                    'https://cdn.jsdelivr.net/gh/alexyle/jellyfin-theme@main/glassmorphism/theme.css',
                ],
                colorSchemes: []
            },
            {
                name: 'Zombie',
                author: 'MakD',
                url: 'https://cdn.jsdelivr.net/gh/MakD/zombie-release@latest/zombie_revived.css',
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
                    'https://cdn.jsdelivr.net/gh/JamsRepos/Jamfin@latest/theme/complete.css',
                    `${KefinTweaksConfig.scriptRoot}skins/jamfin-kefin.css`
                ],
                colorSchemes: []
            },
            {
                name: 'Scyfin',
                author: 'loof2736',
                url: [
                    'https://cdn.jsdelivr.net/gh/loof2736/scyfin@latest/CSS/scyfin-theme.css',
                    `${KefinTweaksConfig.scriptRoot}skins/scyfin-kefin.css`
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
                    }
                ]
            },
            {
                name: 'Catppuccin',
                author: 'Catppuccin',
                url: 'https://jellyfin.catppuccin.com/theme.css',
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
                    'https://cdn.jsdelivr.net/gh/LitCastVlog/Flow@main/CSS/ScyFlow-main.css',
                    `${KefinTweaksConfig.scriptRoot}skins/flow-kefin.css`
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
                    'https://cdn.jsdelivr.net/gh/CTalvio/Ultrachromic/presets/monochromic_preset.css',
                    `${KefinTweaksConfig.scriptRoot}skins/chromic-kefin.css`
                ],
                colorSchemes: []
            },
            {
                name: 'Kaleidochromic',
                author: 'CTalvio',
                url: [
                    'https://cdn.jsdelivr.net/gh/CTalvio/Ultrachromic/presets/kaleidochromic_preset.css',
                    `${KefinTweaksConfig.scriptRoot}skins/chromic-kefin.css`
                ],
                colorSchemes: []
            },
            {
                name: 'Novachromic',
                author: 'CTalvio',
                url: [
                    'https://cdn.jsdelivr.net/gh/CTalvio/Ultrachromic/presets/novachromic_preset.css',
                    `${KefinTweaksConfig.scriptRoot}skins/chromic-kefin.css`
                ],
                colorSchemes: []
            }
            // Add more skins here as needed
        ],
        
        // ============================================================================
        // THEME CONFIGURATION
        // ============================================================================
        // Configure available themes for color variations
        // These themes will be added as options to the existing select#selectTheme dropdown
        // When a custom theme is selected, the cssTheme link href will be updated to the custom URL
        // Each theme should have a name and URL pointing to a CSS file
        themes: [
        ]
    };
    
    // ============================================================================
    // CONFIGURATION EXPOSURE
    // ============================================================================
    // Make user configuration available to scripts
    window.KefinTweaksUserConfig = USER_CONFIG;
    
    console.log('[KefinTweaks UserConfig] User configuration loaded. Available at window.KefinTweaksUserConfig');
    
})();
