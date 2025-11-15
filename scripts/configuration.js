// KefinTweaks Configuration UI
// Adds a configuration button to the Administration section in user preferences
// Opens configuration in a modal window

(function() {
    'use strict';

    console.log('[KefinTweaks Configuration] Initializing...');

    const MODAL_ID = 'kefinTweaksConfigModal';

    // Check if user is admin
    async function isAdmin() {
        try {
            if (window.ApiClient && window.ApiClient.getCurrentUser) {
                const user = await window.ApiClient.getCurrentUser();
                return user && user.Policy && user.Policy.IsAdministrator === true;
            }
        } catch (error) {
            console.warn('[KefinTweaks Configuration] Could not check admin status:', error);
        }
        return false;
    }

    // Load default configuration from JS file
    async function loadDefaultConfig() {
        return new Promise((resolve, reject) => {
            try {
                const defaultConfigUrl = window.KefinTweaksConfig?.kefinTweaksRoot 
                    ? `${window.KefinTweaksConfig.kefinTweaksRoot}kefinTweaks-default-config.js`
                    : 'https://ranaldsgift.github.io/KefinTweaks/kefinTweaks-default-config.js';
                
                // Check if already loaded
                if (window.KefinTweaksDefaultConfig) {
                    console.log('[KefinTweaks Configuration] Using cached default config');
                    resolve(window.KefinTweaksDefaultConfig);
                    return;
                }
                
                // Create script element to load the JS file
                const script = document.createElement('script');
                script.src = defaultConfigUrl;
                script.async = true;
                
                script.onload = () => {
                    if (window.KefinTweaksDefaultConfig) {
                        console.log('[KefinTweaks Configuration] Loaded default config:', window.KefinTweaksDefaultConfig);
                        resolve(window.KefinTweaksDefaultConfig);
                    } else {
                        reject(new Error('Default config file loaded but window.KefinTweaksDefaultConfig is not defined'));
                    }
                };
                
                script.onerror = (error) => {
                    reject(new Error(`Failed to load default config file: ${defaultConfigUrl}`));
                };
                
                document.head.appendChild(script);
            } catch (error) {
                console.error('[KefinTweaks Configuration] Error loading default config:', error);
                reject(error);
            }
        });
    }

    // Get KefinTweaks configuration from JS Injector or load defaults
    async function getKefinTweaksConfig() {
        try {
            // First, try to get config from JS Injector
            const pluginId = await findJavaScriptInjectorPlugin();
            const injectorConfig = await getJavaScriptInjectorConfig(pluginId);
            
            // Find KefinTweaks-Config script
            const kefinTweaksScript = injectorConfig.CustomJavaScripts?.find(
                script => script.Name === 'KefinTweaks-Config'
            );
            
            if (kefinTweaksScript && kefinTweaksScript.Script) {
                // Extract config from script content
                // The script should contain: window.KefinTweaksConfig = {...};
                const scriptMatch = kefinTweaksScript.Script.match(/window\.KefinTweaksConfig\s*=\s*({[\s\S]*});/);
                if (scriptMatch && scriptMatch[1]) {
                    try {
                        const config = JSON.parse(scriptMatch[1]);
                        console.log('[KefinTweaks Configuration] Loaded config from JS Injector:', config);
                        return config;
                    } catch (parseError) {
                        console.error('[KefinTweaks Configuration] Error parsing config from script:', parseError);
                    }
                }
        }

            // If no config found in JS Injector, load defaults
            console.log('[KefinTweaks Configuration] No config found in JS Injector, loading defaults');
            const defaultConfig = await loadDefaultConfig();

            // Save defaults to JS Injector for future use
            await saveConfigToJavaScriptInjector(defaultConfig);
            
            return defaultConfig;
        } catch (error) {
            console.error('[KefinTweaks Configuration] Error getting config, falling back to defaults:', error);
            // Fallback to defaults if anything fails
            try {
                return await loadDefaultConfig();
            } catch (fallbackError) {
                console.error('[KefinTweaks Configuration] Error loading default config as fallback:', fallbackError);
                // Return empty config structure as last resort
                return {
                    kefinTweaksRoot: 'https://ranaldsgift.github.io/KefinTweaks/',
                    scriptRoot: 'https://ranaldsgift.github.io/KefinTweaks/scripts/',
                    scripts: {},
                    homeScreen: {},
                    exclusiveElsewhere: {},
                    search: {},
                    skins: [],
                    defaultSkin: null,
                    themes: [],
                    customMenuLinks: []
                };
            }
        }
    }

    // Inject responsive CSS for the configuration modal
    function injectConfigModalCSS() {
        const styleId = 'kefintweaks-config-modal-css';
        if (document.getElementById(styleId)) return;
        
        const style = document.createElement('style');
        style.id = styleId;
        style.textContent = `
            #${MODAL_ID} .modal-content-wrapper {
                max-width: 90vw;
                width: 1400px;
                max-height: 90vh;
                overflow-y: auto;
                background: var(--background-color, #1a1a1a);
                border-radius: 8px;
            }
            
            #${MODAL_ID} .content-primary {
                max-width: 1400px;
                margin: 0 auto;
                padding: 1.5em;
            }
            
            #${MODAL_ID} .paperList {
                background: rgba(255, 255, 255, 0.03);
                border-radius: 8px;
                padding: 1em;
            }
            
            #${MODAL_ID} .listItem {
                transition: background-color 0.2s ease;
            }
            
            #${MODAL_ID} .listItem:hover {
                background-color: rgba(255, 255, 255, 0.02);
            }
            
            #${MODAL_ID} textarea.fld {
                resize: vertical;
                min-height: 200px;
            }
            
            #${MODAL_ID} details summary {
                user-select: none;
            }
            
            #${MODAL_ID} details summary:hover {
                opacity: 0.8;
            }
            
            #${MODAL_ID} pre {
                white-space: pre-wrap;
                word-wrap: break-word;
            }
            
            /* Responsive design */
            @media (max-width: 768px) {
                #${MODAL_ID} .modal-content-wrapper {
                    width: 95vw;
                    max-height: 95vh;
                }
                
                #${MODAL_ID} .content-primary {
                    padding: 1em;
                }
                
                #${MODAL_ID} .paperList {
                    padding: 0.75em;
                }
                
                #${MODAL_ID} [style*="grid-template-columns"] {
                    grid-template-columns: 1fr !important;
                }
            }
            
            @media (max-width: 480px) {
                #${MODAL_ID} .content-primary {
                    padding: 0.75em;
                }
                
                #${MODAL_ID} .pageTitle {
                    font-size: 1.5em;
                }
                
                #${MODAL_ID} input.fld,
                #${MODAL_ID} textarea.fld {
                    font-size: 16px; /* Prevents zoom on iOS */
                }
            }
        `;
        document.head.appendChild(style);
    }

    // Show confirmation modal for editing script root configuration
    function showScriptRootEditConfirmation() {
        return new Promise((resolve) => {
            if (!window.ModalSystem) {
                resolve(false);
                return;
            }

            const modal = window.ModalSystem.create({
                id: 'scriptRootEditConfirmation',
                title: 'Edit Script Root URLs',
                content: `
                    <div class="listItemBodyText" style="margin-bottom: 1em; max-width: 600px;">
                        Editing the Root URLs is useful if you are hosting the scripts yourself or if you want to use a specific KefinTweaks version. There is no validation done for the URLs provided for these settings so please ensure they are valid. In any case, you can easily revert these settings.
                    </div>
                `,
                footer: `
                    <button class="emby-button raised button-submit" id="confirmEditScriptRoot" style="padding: 0.75em 2em; font-size: 1em; font-weight: 500; margin-right: 1em;">
                        <span>Continue</span>
                    </button>
                    <button class="emby-button raised" id="cancelEditScriptRoot" style="padding: 0.75em 2em; font-size: 1em;">
                        <span>Cancel</span>
                    </button>
                `,
                closeOnBackdrop: true,
                closeOnEscape: true,
                onOpen: (modalInstance) => {
                    const confirmBtn = modalInstance.dialogFooter?.querySelector('#confirmEditScriptRoot');
                    const cancelBtn = modalInstance.dialogFooter?.querySelector('#cancelEditScriptRoot');
                    
                    if (confirmBtn) {
                        confirmBtn.addEventListener('click', () => {
                            modalInstance.close();
                            resolve(true);
                        });
                    }
                    
                    if (cancelBtn) {
                        cancelBtn.addEventListener('click', () => {
                            modalInstance.close();
                            resolve(false);
                        });
                    }
                }
            });
        });
    }

    // Build the configuration page content
    function buildConfigPageContent(config) {
        const scripts = config.scripts || {};
        const homeScreen = config.homeScreen || {};
        const exclusiveElsewhere = config.exclusiveElsewhere || {};
        const search = config.search || {};
        const customMenuLinks = config.customMenuLinks || [];
        const skins = config.skins || [];
        const themes = config.themes || [];

        // Get all skin names for autocomplete
        const allSkinNames = skins.map(skin => skin.name).filter(Boolean);

        return `
            <div class="paperList" style="margin-bottom: 2em;">
                <div class="listItem" style="border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 1em; margin-bottom: 1em;">
                    <div class="listItemContent" style="display: flex; justify-content: space-between; align-items: center;">
                        <div>
                        <h3 class="listItemBodyText" style="margin-bottom: 0.25em;">Script Root Configuration</h3>
                        <div class="listItemBodyText secondary">Configure where KefinTweaks scripts are loaded from</div>
                    </div>
                        <button class="emby-button raised paper-icon-button-light" id="editScriptRootBtn" style="padding: 0.5em 1em;">
                            <span class="material-icons" aria-hidden="true">edit</span>
                        </button>
                </div>
                </div>
                <div id="scriptRootConfigContent" style="display: none;">
                <div class="listItem">
                    <div class="listItemContent">
                        <div class="listItemBodyText" style="margin-bottom: 0.5em;">KefinTweaks Root URL</div>
                            <input type="text" id="kefinTweaksRoot" class="fld emby-input" value="${config.kefinTweaksRoot || ''}" placeholder="https://ranaldsgift.github.io/KefinTweaks/" style="width: 100%; max-width: 600px;">
                        <div class="listItemBodyText secondary" style="margin-top: 0.5em; font-size: 0.9em;">Base URL for KefinTweaks resources</div>
                    </div>
                </div>
                <div class="listItem">
                    <div class="listItemContent">
                        <div class="listItemBodyText" style="margin-bottom: 0.5em;">Script Root URL</div>
                            <input type="text" id="scriptRoot" class="fld emby-input" value="${config.scriptRoot || ''}" placeholder="https://ranaldsgift.github.io/KefinTweaks/scripts/" style="width: 100%; max-width: 600px;">
                        <div class="listItemBodyText secondary" style="margin-top: 0.5em; font-size: 0.9em;">URL where individual script files are located</div>
                        </div>
                    </div>
                </div>
            </div>

            <div class="paperList" style="margin-bottom: 2em;">
                <div class="listItem" style="border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 1em; margin-bottom: 1em;">
                    <div class="listItemContent">
                        <h3 class="listItemBodyText" style="margin-bottom: 0.25em;">Feature Configuration</h3>
                        <div class="listItemBodyText secondary">Toggle individual KefinTweaks features on or off. Existing configurations are maintained when disabling features.</div>
                    </div>
                </div>
                <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 0.5em;">
                    ${buildScriptToggles(scripts)}
                </div>
            </div>

            <div class="paperList" style="margin-bottom: 2em;">
                <div class="listItem" style="border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 1em; margin-bottom: 1em;">
                    <div class="listItemContent">
                        <h3 class="listItemBodyText" style="margin-bottom: 0.25em;">Home Screen Configuration</h3>
                        <div class="listItemBodyText secondary">Configure custom home screen sections and discovery features</div>
                    </div>
                </div>
                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 0.5em;">
                    ${buildHomeScreenConfig(homeScreen)}
                </div>
            </div>

            <div class="paperList" id="configSection_exclusiveElsewhere" style="margin-bottom: 2em; ${scripts.exclusiveElsewhere === false ? 'display: none;' : ''}">
                <div class="listItem" style="border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 1em; margin-bottom: 1em;">
                    <div class="listItemContent">
                        <h3 class="listItemBodyText" style="margin-bottom: 0.25em;">Exclusive Elsewhere Configuration</h3>
                        <div class="listItemBodyText secondary">Configure exclusive elsewhere branding behavior</div>
                    </div>
                </div>
                ${buildExclusiveElsewhereConfig(exclusiveElsewhere)}
            </div>

            <div class="paperList" id="configSection_search" style="margin-bottom: 2em; ${scripts.search === false ? 'display: none;' : ''}">
                <div class="listItem" style="border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 1em; margin-bottom: 1em;">
                    <div class="listItemContent">
                        <h3 class="listItemBodyText" style="margin-bottom: 0.25em;">Search Configuration</h3>
                        <div class="listItemBodyText secondary">Configure search functionality</div>
                    </div>
                </div>
                ${buildSearchConfig(search)}
            </div>

            <div class="paperList" id="configSection_skin" style="margin-bottom: 2em; ${scripts.skinManager === false ? 'display: none;' : ''}">
                <div class="listItem" style="border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 1em; margin-bottom: 1em;">
                    <div class="listItemContent">
                        <h3 class="listItemBodyText" style="margin-bottom: 0.25em;">Skin Configuration</h3>
                        <div class="listItemBodyText secondary">Configure default skin and available skins for all users</div>
                    </div>
                </div>
                <div class="listItem" style="border: 1px solid rgba(255,255,255,0.1); border-radius: 4px; padding: 0.75em; margin-bottom: 1em;">
                    <div class="listItemContent">
                        <div class="listItemBodyText" style="margin-bottom: 0.5em;">Default Skin</div>
                        <select id="defaultSkin" class="fld emby-select emby-select-withcolor" style="width: 100%; max-width: 400px;">
                            ${allSkinNames.map(name => `<option value="${name}" ${config.defaultSkin === name ? 'selected' : ''}>${name}</option>`).join('')}
                        </select>
                        <div class="listItemBodyText secondary" style="margin-top: 0.5em; font-size: 0.9em;">Select a default skin for all users</div>
                    </div>
                </div>
                <div class="listItem" style="border: 1px solid rgba(255,255,255,0.1); border-radius: 4px; padding: 0.75em; margin-bottom: 1em;">
                    <div class="listItemContent" style="width: 100%;">
                        <h3 class="listItemBodyText" style="margin-bottom: 0.5em;">Enable/Disable Skins</h3>
                        <div class="listItemBodyText secondary" style="margin-bottom: 1em; font-size: 0.9em;">Disabled skins will not appear in the appearance dropdowns for users</div>
                        <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap: 0.5em;">
                            ${buildSkinToggles(skins)}
                        </div>
                    </div>
                </div>
                <div class="listItem" style="border: 1px solid rgba(255,255,255,0.1); border-radius: 4px; padding: 0.75em;">
                    <div class="listItemContent">
                        <div class="listItemBodyText" style="margin-bottom: 0.5em;">Skins JSON</div>
                        <div class="listItemBodyText secondary" style="margin-bottom: 0.75em; font-size: 0.9em;">Add additional skins that will be available to all users. Each skin can have multiple CSS files for different server versions. Hidden skins (included automatically by KefinTweaks) are not shown here.</div>
                        <textarea id="skinsJson" class="fld emby-textarea" rows="15" placeholder='[{"name":"Skin Name","author":"Author","url":[...]}]' style="width: 100%; font-family: monospace; font-size: 0.9em; line-height: 1.5;">${JSON.stringify(skins.filter(skin => !skin.hidden), null, 2)}</textarea>
                        <details style="margin-top: 0.75em;">
                            <summary class="listItemBodyText secondary" style="font-size: 0.9em; color: #4a9eff;">View Example Format</summary>
                            <pre style="background: rgba(0,0,0,0.3); padding: 1em; border-radius: 4px; margin-top: 0.5em; overflow-x: auto; font-size: 0.85em; line-height: 1.6;">[
  {
    "name": "Custom Skin",
    "author": "username",
    "url": [
      {
        "majorServerVersions": [10, 11],
        "urls": ["https://cdn.jsdelivr.net/gh/username/custom-theme.css"]
      }
    ],
    "colorSchemes": []
  },
  {
    "name": "Custom Skin 2",
    "author": "username 2",
    "url": [
      {
        "majorServerVersions": [10],
        "urls": ["https://cdn.jsdelivr.net/gh/username/custom-theme2.css"]
      }
    ],
    "colorSchemes": []
  }
]</pre>
                        </details>
                    </div>
                </div>
            </div>

            <div class="paperList" id="configSection_theme" style="margin-bottom: 2em; ${scripts.skinManager === false ? 'display: none;' : ''}">
                <div class="listItem" style="border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 1em; margin-bottom: 1em;">
                    <div class="listItemContent">
                        <h3 class="listItemBodyText" style="margin-bottom: 0.25em;">Theme Configuration</h3>
                        <div class="listItemBodyText secondary">Configure additional themes available to all users</div>
                    </div>
                </div>
                <div class="listItem" style="border: 1px solid rgba(255,255,255,0.1); border-radius: 4px; padding: 0.75em;">
                    <div class="listItemContent">
                        <div class="listItemBodyText" style="margin-bottom: 0.5em;">Themes JSON</div>
                        <div class="listItemBodyText secondary" style="margin-bottom: 0.75em; font-size: 0.9em;">Add additional themes that will be available to all users. Each theme should have a name and URL pointing to a CSS file.</div>
                        <textarea id="themesJson" class="fld emby-textarea" rows="12" placeholder='[{"name":"Theme Name","url":"https://..."}]' style="width: 100%; font-family: monospace; font-size: 0.9em; line-height: 1.5;">${JSON.stringify(themes, null, 2)}</textarea>
                        <details style="margin-top: 0.75em;">
                            <summary class="listItemBodyText secondary" style="font-size: 0.9em; color: #4a9eff;">View Example Format</summary>
                            <pre style="background: rgba(0,0,0,0.3); padding: 1em; border-radius: 4px; margin-top: 0.5em; overflow-x: auto; font-size: 0.85em; line-height: 1.6;">[
  {
    "name": "Custom Dark Theme",
    "url": "https://cdn.jsdelivr.net/gh/username/custom-dark-theme.css"
  },
  {
    "name": "Custom Light Theme",
    "url": "https://cdn.jsdelivr.net/gh/username/custom-light-theme.css"
  }
]</pre>
                        </details>
                    </div>
                </div>
            </div>

            <div class="paperList" id="configSection_customMenuLinks" style="margin-bottom: 2em; ${scripts.customMenuLinks === false ? 'display: none;' : ''}">
                <div class="listItem" style="border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 1em; margin-bottom: 1em;">
                    <div class="listItemContent">
                        <h3 class="listItemBodyText" style="margin-bottom: 0.25em;">Custom Menu Links</h3>
                        <div class="listItemBodyText secondary">Configure custom menu links to be added to the custom menu</div>
                    </div>
                </div>
                <div class="listItem" style="border: 1px solid rgba(255,255,255,0.1); border-radius: 4px; padding: 0.75em;">
                    <div class="listItemContent">
                        <div class="listItemBodyText" style="margin-bottom: 0.5em;">Custom Menu Links JSON</div>
                        <div class="listItemBodyText secondary" style="margin-bottom: 0.75em; font-size: 0.9em;">Add custom menu links that will appear in the custom menu. Use Material icon names for icons.</div>
                        <textarea id="customMenuLinksJson" class="fld emby-textarea" rows="12" placeholder='[{"name":"Link Name","icon":"link","url":"#/..."}]' style="width: 100%; font-family: monospace; font-size: 0.9em; line-height: 1.5;">${JSON.stringify(customMenuLinks, null, 2)}</textarea>
                        <details style="margin-top: 0.75em;">
                            <summary class="listItemBodyText secondary" style="font-size: 0.9em; color: #4a9eff;">View Example Format</summary>
                            <pre style="background: rgba(0,0,0,0.3); padding: 1em; border-radius: 4px; margin-top: 0.5em; overflow-x: auto; font-size: 0.85em; line-height: 1.6;">[
  {
    "name": "My Custom Link",
    "icon": "link",
    "url": "#/userpluginsettings.html?pageUrl=https://domain.com/custom-page",
    "openInNewTab": false
  },
  {
    "name": "External Link",
    "icon": "open_in_new",
    "url": "https://example.com",
    "openInNewTab": true
  }
]</pre>
                        </details>
                    </div>
                </div>
            </div>

        `;
    }

    // Extract GitHub repository URL from skin configuration
    function getSkinGitHubUrl(skin) {
        // Check if skin has explicit github field
        if (skin.github) {
            return skin.github;
        }
        
        // Try to extract from jsdelivr GitHub CDN URLs
        if (skin.url && Array.isArray(skin.url)) {
            for (const urlObj of skin.url) {
                if (urlObj.urls && Array.isArray(urlObj.urls)) {
                    for (const url of urlObj.urls) {
                        // Match pattern: https://cdn.jsdelivr.net/gh/{owner}/{repo}@...
                        const match = url.match(/https:\/\/cdn\.jsdelivr\.net\/gh\/([^\/]+)\/([^\/@]+)/);
                        if (match) {
                            const owner = match[1];
                            const repo = match[2];
                            return `https://github.com/${owner}/${repo}`;
                        }
                    }
                }
            }
        }
        
        return null;
    }

    // Build skin toggle switches
    function buildSkinToggles(skins) {
        return skins.map(skin => {
            const isEnabled = skin.enabled !== false; // Default to true if not set
            const isHidden = skin.hidden === true;
            const githubUrl = getSkinGitHubUrl(skin);
            
            // Determine tooltip text
            let tooltipText = '';
            if (isHidden) {
                tooltipText = 'This skin is included automatically by KefinTweaks';
            } else if (githubUrl) {
                tooltipText = 'View on GitHub';
            }
            
            return `
                <div class="listItem" style="border: 1px solid rgba(255,255,255,0.1); border-radius: 4px; padding: 0.5em; background: rgba(255,255,255,0.02);" ${tooltipText ? `title="${tooltipText}"` : ''}>
                    <div class="listItemContent" style="display: flex; justify-content: space-between; align-items: center; gap: 0.5em;">
                        <div style="flex: 1; display: flex; align-items: center; gap: 0.5em; min-width: 0;">
                            <div class="listItemBodyText" style="font-weight: 500; font-size: 0.9em; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${skin.name}</div>
                            ${githubUrl ? `<a href="${githubUrl}" target="_blank" rel="noopener noreferrer" style="flex-shrink: 0; display: flex; align-items: center; color: inherit; text-decoration: none; opacity: 0.6; transition: opacity 0.2s; cursor: pointer;" title="View on GitHub" onmouseover="this.style.opacity='1'" onmouseout="this.style.opacity='0.6'"><span class="material-icons" style="font-size: 1em;">info</span></a>` : ''}
                        </div>
                        <label class="checkboxContainer" style="flex-shrink: 0; margin: 0;">
                            <input type="checkbox" id="skin_${skin.name.replace(/[^a-zA-Z0-9]/g, '_')}" ${isEnabled ? 'checked' : ''} data-skin-name="${skin.name}">
                        </label>
                </div>
            </div>
        `;
        }).join('');
    }

    // Build script toggle switches
    function buildScriptToggles(scripts) {
        const scriptNames = [
            { key: 'homeScreen', label: 'Home Screen', desc: 'Custom home screen sections and discovery engine. These can be configured below.' },
            { key: 'search', label: 'Search', desc: 'Search speed is improved by searching less content types by default. Provides options to specify which content type to search. Fully compatible with Jellysearch Search from Jellyfin Enhanced plugin.' },
            { key: 'watchlist', label: 'Watchlist', desc: 'Allows your users to add items to their Watchlist. The Watchlist page shows an overview of all items on a user\'s Watchlist, as well as their Series Progress and Movie History. It also includes a Statistics page with an overview of your user watched stats.' },
            { key: 'headerTabs', label: 'Header Tabs', desc: 'Allows direct navigation to specific Tab sections of a given library page. Full support for default Jellyfin landing pages.' },
            { key: 'customMenuLinks', label: 'Custom Menu Links', desc: 'Add custom menu links to the left side navigation menu' },
            { key: 'breadcrumbs', label: 'Breadcrumbs', desc: 'Breadcrumb navigation for Movies, TV and Music. Allows quick navigation between Seasons/Episodes and Albums/Songs.' },
            { key: 'playlist', label: 'Playlist', desc: 'Improved Playlist page navigation: Items only play when the Play button is pressed. Clicking an item navigates to the item\'s page.' },
            { key: 'itemDetailsCollections', label: 'Item Details Collections', desc: 'Displays collections on item details pages (Included In section)' },
            { key: 'flattenSingleSeasonShows', label: 'Flatten Single Season Shows', desc: 'Flattens single-season shows to display episodes directly on series page' },
            { key: 'collections', label: 'Collections', desc: 'Collection sorting functionality on the Collection page' },
            { key: 'exclusiveElsewhere', label: 'Exclusive Elsewhere', desc: 'Custom branding when items aren\'t available on streaming services' },
            { key: 'backdropLeakFix', label: 'Backdrop Leak Fix', desc: 'Fixes memory leaks from backdrop images when tab isn\'t focused' },
            { key: 'dashboardButtonFix', label: 'Dashboard Button Fix', desc: 'Improved back button behavior on dashboard - prevents navigating back to the new tab browser page' },
            { key: 'infiniteScroll', label: 'Infinite Scroll', desc: 'Adds infinite scrolling to the library pages for Movies and TV' },
            { key: 'removeContinue', label: 'Remove Continue', desc: 'Adds the ability to remove items from the Continue Watching sections' },
            { key: 'subtitleSearch', label: 'Subtitle Search', desc: 'Search and download subtitles directly from the video OSD' },
            { key: 'skinManager', label: 'Skin Manager', desc: 'Skin selection and management - adds skin dropdown to header and display preferences' }
        ];

        return scriptNames.map(script => {
            const isEnabled = scripts[script.key] !== false; // Default to true if not set
            return `
                <div class="listItem" style="border: 1px solid rgba(255,255,255,0.1); border-radius: 4px; padding: 0.75em; background: rgba(255,255,255,0.02);">
                    <div class="listItemContent">
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.75em;">
                            <div class="listItemBodyText" style="font-weight: 500;">${script.label}</div>
                            <label class="checkboxContainer" style="flex-shrink: 0; margin: 0;">
                                <input type="checkbox" id="script_${script.key}" ${isEnabled ? 'checked' : ''} data-script-key="${script.key}">
                            </label>
                        </div>
                        <div class="listItemBodyText secondary" style="font-size: 0.9em; line-height: 1.4; width: 100%;">${script.desc}</div>
                    </div>
                </div>
            `;
        }).join('');
    }

    // Build home screen configuration
    function buildHomeScreenConfig(homeScreen) {
        const exampleCustomSections = `[
  {
    "name": "My Favorite Movies",
    "id": "acc84f03475eb51602b13cde158d21ad",
    "maxItems": 20,
    "order": 5
  },
  {
    "name": "Action Collection",
    "id": "bdd95f14586eb51703c24def269e32be",
    "maxItems": 15,
    "order": 10
  }
]`;
        
        return `
            <div class="listItem" style="border: 1px solid rgba(255,255,255,0.1); border-radius: 4px; padding: 0.75em;">
                <div class="listItemContent">
                    <div class="listItemBodyText" style="margin-bottom: 0.5em;">Enable New and Trending</div>
                    <label class="checkboxContainer">
                        <input type="checkbox" id="homeScreen_enableNewAndTrending" ${homeScreen.enableNewAndTrending !== false ? 'checked' : ''}>
                        <span>Enabled</span>
                    </label>
                </div>
            </div>
            <div class="listItem" id="homeScreen_newMoviesContainer" style="border: 1px solid rgba(255,255,255,0.1); border-radius: 4px; padding: 0.75em; ${homeScreen.enableNewAndTrending === false ? 'display: none;' : ''}">
                <div class="listItemContent">
                    <div class="listItemBodyText" style="margin-bottom: 0.5em;">Enable New Movies</div>
                    <label class="checkboxContainer">
                        <input type="checkbox" id="homeScreen_enableNewMovies" ${homeScreen.enableNewMovies !== false ? 'checked' : ''}>
                        <span>Enabled</span>
                    </label>
                </div>
            </div>
            <div class="listItem" id="homeScreen_newEpisodesContainer" style="border: 1px solid rgba(255,255,255,0.1); border-radius: 4px; padding: 0.75em; ${homeScreen.enableNewAndTrending === false ? 'display: none;' : ''}">
                <div class="listItemContent">
                    <div class="listItemBodyText" style="margin-bottom: 0.5em;">Enable New Episodes</div>
                    <label class="checkboxContainer">
                        <input type="checkbox" id="homeScreen_enableNewEpisodes" ${homeScreen.enableNewEpisodes !== false ? 'checked' : ''}>
                        <span>Enabled</span>
                    </label>
                </div>
            </div>
            <div class="listItem" id="homeScreen_trendingContainer" style="border: 1px solid rgba(255,255,255,0.1); border-radius: 4px; padding: 0.75em; ${homeScreen.enableNewAndTrending === false ? 'display: none;' : ''}">
                <div class="listItemContent">
                    <div class="listItemBodyText" style="margin-bottom: 0.5em;">Enable Trending</div>
                    <label class="checkboxContainer">
                        <input type="checkbox" id="homeScreen_enableTrending" ${homeScreen.enableTrending === true ? 'checked' : ''} disabled>
                        <span>Enabled</span>
                    </label>
                    <div class="listItemBodyText secondary" style="margin-top: 0.5em; font-size: 0.9em; font-style: italic; opacity: 0.7;">This feature is not yet implemented</div>
                </div>
            </div>
            <div class="listItem" style="border: 1px solid rgba(255,255,255,0.1); border-radius: 4px; padding: 0.75em;">
                <div class="listItemContent">
                    <div class="listItemBodyText" style="margin-bottom: 0.5em;">Enable Discovery</div>
                    <label class="checkboxContainer">
                        <input type="checkbox" id="homeScreen_enableDiscovery" ${homeScreen.enableDiscovery !== false ? 'checked' : ''}>
                        <span>Enabled</span>
                    </label>
                </div>
            </div>
            <div class="listItem" id="homeScreen_infiniteScrollContainer" style="border: 1px solid rgba(255,255,255,0.1); border-radius: 4px; padding: 0.75em; ${homeScreen.enableDiscovery === false ? 'display: none;' : ''}">
                <div class="listItemContent">
                    <div class="listItemBodyText" style="margin-bottom: 0.5em;">Enable Infinite Scroll</div>
                    <label class="checkboxContainer">
                        <input type="checkbox" id="homeScreen_enableInfiniteScroll" ${homeScreen.enableInfiniteScroll !== false ? 'checked' : ''}>
                        <span>Enabled</span>
                    </label>
                </div>
            </div>
            <div class="listItem" style="border: 1px solid rgba(255,255,255,0.1); border-radius: 4px; padding: 0.75em;">
                <div class="listItemContent">
                    <div class="listItemBodyText" style="margin-bottom: 0.5em;">Minimum People Appearances</div>
                    <input type="number" id="homeScreen_minPeopleAppearances" class="fld emby-input" value="${homeScreen.minPeopleAppearances || 10}" min="1" style="width: 100%; max-width: 200px;">
                    <div class="listItemBodyText secondary" style="margin-top: 0.5em; font-size: 0.9em;">Minimum movie appearances for people to be featured</div>
                </div>
            </div>
            <div class="listItem" style="border: 1px solid rgba(255,255,255,0.1); border-radius: 4px; padding: 0.75em;">
                <div class="listItemContent">
                    <div class="listItemBodyText" style="margin-bottom: 0.5em;">Minimum Genre Movie Count</div>
                    <input type="number" id="homeScreen_minGenreMovieCount" class="fld emby-input" value="${homeScreen.minGenreMovieCount || 50}" min="1" style="width: 100%; max-width: 200px;">
                    <div class="listItemBodyText secondary" style="margin-top: 0.5em; font-size: 0.9em;">Minimum movie count for genres to be included</div>
                </div>
            </div>
            <div class="listItem" style="border: 1px solid rgba(255,255,255,0.1); border-radius: 4px; padding: 0.75em;">
                <div class="listItemContent">
                    <div class="listItemBodyText" style="margin-bottom: 0.5em;">Minimum Shows For Network</div>
                    <input type="number" id="homeScreen_minimumShowsForNetwork" class="fld emby-input" value="${homeScreen.minimumShowsForNetwork || 5}" min="1" style="width: 100%; max-width: 200px;">
                    <div class="listItemBodyText secondary" style="margin-top: 0.5em; font-size: 0.9em;">Minimum show count for TV networks to be featured</div>
                </div>
            </div>
            <div class="listItem" style="border: 1px solid rgba(255,255,255,0.1); border-radius: 4px; padding: 0.75em;">
                <div class="listItemContent">
                    <div class="listItemBodyText" style="margin-bottom: 0.5em;">Enable Watchlist</div>
                    <label class="checkboxContainer">
                        <input type="checkbox" id="homeScreen_enableWatchlist" ${homeScreen.enableWatchlist !== false ? 'checked' : ''}>
                        <span>Enabled</span>
                    </label>
                </div>
            </div>
            <div class="listItem" style="border: 1px solid rgba(255,255,255,0.1); border-radius: 4px; padding: 0.75em;">
                <div class="listItemContent">
                    <div class="listItemBodyText" style="margin-bottom: 0.5em;">Enable Seasonal</div>
                    <label class="checkboxContainer">
                        <input type="checkbox" id="homeScreen_enableSeasonal" ${homeScreen.enableSeasonal !== false ? 'checked' : ''}>
                        <span>Enabled</span>
                    </label>
                </div>
            </div>
            <div class="listItem" style="border: 1px solid rgba(255,255,255,0.1); border-radius: 4px; padding: 0.75em;">
                <div class="listItemContent">
                    <div class="listItemBodyText" style="margin-bottom: 0.5em;">Seasonal Item Limit</div>
                    <input type="number" id="homeScreen_seasonalItemLimit" class="fld emby-input" value="${homeScreen.seasonalItemLimit || 16}" min="1" style="width: 100%; max-width: 200px;">
                    <div class="listItemBodyText secondary" style="margin-top: 0.5em; font-size: 0.9em;">Maximum items to show in seasonal sections</div>
                </div>
            </div>
            <div class="listItem" style="grid-column: 1 / -1; border: 1px solid rgba(255,255,255,0.1); border-radius: 4px; padding: 0.75em;">
                <div class="listItemContent">
                    <div class="listItemBodyText" style="margin-bottom: 0.5em;">Custom Sections JSON</div>
                    <div class="listItemBodyText secondary" style="margin-bottom: 0.75em; font-size: 0.9em;">Add custom playlist/collection-based sections. Get collection/playlist IDs from Jellyfin URLs.</div>
                    <textarea id="homeScreen_customSections" class="fld emby-textarea" rows="12" placeholder='${exampleCustomSections}' style="width: 100%; font-family: monospace; font-size: 0.9em; line-height: 1.5;">${JSON.stringify(homeScreen.customSections || [], null, 2)}</textarea>
                    <details style="margin-top: 0.75em;">
                        <summary class="listItemBodyText secondary" style="font-size: 0.9em; color: #4a9eff;">View Example Format</summary>
                        <pre style="background: rgba(0,0,0,0.3); padding: 1em; border-radius: 4px; margin-top: 0.5em; overflow-x: auto; font-size: 0.85em; line-height: 1.6;">${exampleCustomSections}</pre>
                    </details>
                </div>
            </div>
        `;
    }

    // Build exclusive elsewhere configuration
    function buildExclusiveElsewhereConfig(exclusiveElsewhere) {
        return `
            <div class="listItem" style="border: 1px solid rgba(255,255,255,0.1); border-radius: 4px; padding: 0.75em;">
                <div class="listItemContent">
                    <div class="listItemBodyText" style="margin-bottom: 0.5em;">Hide Server Name</div>
                    <div class="listItemBodyText secondary" style="margin-bottom: 0.75em; font-size: 0.9em;">Set to true to hide server name, useful when you want to only show a logo or icon via CSS</div>
                    <label class="checkboxContainer">
                        <input type="checkbox" id="exclusiveElsewhere_hideServerName" ${exclusiveElsewhere.hideServerName === true ? 'checked' : ''}>
                        <span>Enabled</span>
                    </label>
                </div>
            </div>
        `;
    }

    // Build search configuration
    function buildSearchConfig(search) {
        return `
            <div class="listItem" style="border: 1px solid rgba(255,255,255,0.1); border-radius: 4px; padding: 0.75em;">
                <div class="listItemContent">
                    <div class="listItemBodyText" style="margin-bottom: 0.5em;">Enable Jellyseerr</div>
                    <div class="listItemBodyText secondary" style="margin-bottom: 0.75em; font-size: 0.9em;">Enable Jellyseerr integration for request functionality</div>
                    <label class="checkboxContainer">
                        <input type="checkbox" id="search_enableJellyseerr" ${search.enableJellyseerr === true ? 'checked' : ''}>
                        <span>Enabled</span>
                    </label>
                </div>
            </div>
        `;
    }

    // Open configuration modal
    async function openConfigurationModal() {
        console.log('[KefinTweaks Configuration] Opening configuration modal...');

        // Inject CSS if not already injected
        injectConfigModalCSS();

        // Load configuration first
        let config;
        try {
            config = await getKefinTweaksConfig();
        } catch (error) {
            console.error('[KefinTweaks Configuration] Error loading config:', error);
            alert('Error loading configuration. Please try again.');
            return;
        }

        // Build the content (without title, as ModalSystem adds it)
        const content = document.createElement('div');
        content.className = 'modal-content-wrapper';
        content.id = MODAL_ID;
        content.innerHTML = `
            <div class="content-primary">
                ${buildConfigPageContent(config)}
            </div>
        `;

        // Create footer with save, export, and import buttons
        const footer = document.createElement('div');
        footer.style.display = 'flex';
        footer.style.gap = '0.75em';
        footer.style.alignItems = 'center';
        footer.innerHTML = `
            <button class="emby-button raised block button-submit" id="saveConfigBtn" style="padding: 0.75em 2em; font-size: 1em; font-weight: 500;">
                <span>Save</span>
            </button>
            <button class="emby-button raised" id="exportConfigBtn" style="padding: 0.75em 2em; font-size: 1em;">
                <span>Export</span>
            </button>
            <button class="emby-button raised" id="importConfigBtn" style="padding: 0.75em 2em; font-size: 1em;">
                <span>Import</span>
            </button>
        `;

        // Create modal using ModalSystem
        if (!window.ModalSystem) {
            console.error('[KefinTweaks Configuration] ModalSystem not available');
            alert('Modal system not available. Please ensure modal.js is loaded.');
            return;
                    }

        const modal = window.ModalSystem.create({
            id: MODAL_ID,
            title: 'KefinTweaks Configuration',
            content: content,
            footer: footer,
            closeOnBackdrop: true,
            closeOnEscape: true,
            onOpen: (modalInstance) => {
                // Update modal dialog styling for large size
                if (modalInstance && modalInstance.dialog) {
                    modalInstance.dialog.style.maxWidth = '90vw';
                    modalInstance.dialog.style.width = '1400px';
                    modalInstance.dialog.style.maxHeight = '90vh';
                }

                // Add event handlers
                setupConfigModalHandlers(modalInstance, config);
                }
            });
        }

    // Set up event handlers for configuration modal
    function setupConfigModalHandlers(modalInstance, config) {
        // Edit script root button handler
        const editBtn = modalInstance.dialogContent.querySelector('#editScriptRootBtn');
        if (editBtn) {
            editBtn.addEventListener('click', async () => {
                const confirmed = await showScriptRootEditConfirmation();
                if (confirmed) {
                    const contentDiv = modalInstance.dialogContent.querySelector('#scriptRootConfigContent');
                    if (contentDiv) {
                        contentDiv.style.display = 'block';
                    }
                }
            });
        }

        // No validation needed for default skin dropdown - it only allows valid options

        // Home Screen: Toggle visibility of New Movies/Episodes/Trending based on New and Trending
        const enableNewAndTrendingCheckbox = modalInstance.dialogContent.querySelector('#homeScreen_enableNewAndTrending');
        if (enableNewAndTrendingCheckbox) {
            const newMoviesContainer = modalInstance.dialogContent.querySelector('#homeScreen_newMoviesContainer');
            const newEpisodesContainer = modalInstance.dialogContent.querySelector('#homeScreen_newEpisodesContainer');
            const trendingContainer = modalInstance.dialogContent.querySelector('#homeScreen_trendingContainer');
            
            const toggleNewMoviesEpisodesTrendingVisibility = () => {
                const isEnabled = enableNewAndTrendingCheckbox.checked;
                if (newMoviesContainer) {
                    newMoviesContainer.style.display = isEnabled ? '' : 'none';
                }
                if (newEpisodesContainer) {
                    newEpisodesContainer.style.display = isEnabled ? '' : 'none';
                }
                if (trendingContainer) {
                    trendingContainer.style.display = isEnabled ? '' : 'none';
                }
            };
            
            enableNewAndTrendingCheckbox.addEventListener('change', toggleNewMoviesEpisodesTrendingVisibility);
        }

        // Home Screen: Toggle visibility of Infinite Scroll based on Discovery
        const enableDiscoveryCheckbox = modalInstance.dialogContent.querySelector('#homeScreen_enableDiscovery');
        if (enableDiscoveryCheckbox) {
            const infiniteScrollContainer = modalInstance.dialogContent.querySelector('#homeScreen_infiniteScrollContainer');
            
            const toggleInfiniteScrollVisibility = () => {
                const isEnabled = enableDiscoveryCheckbox.checked;
                if (infiniteScrollContainer) {
                    infiniteScrollContainer.style.display = isEnabled ? '' : 'none';
                }
            };
            
            enableDiscoveryCheckbox.addEventListener('change', toggleInfiniteScrollVisibility);
        }

        // Toggle visibility of configuration sections based on script enable state
        const scriptCheckboxes = {
            search: modalInstance.dialogContent.querySelector('#script_search'),
            exclusiveElsewhere: modalInstance.dialogContent.querySelector('#script_exclusiveElsewhere'),
            skinManager: modalInstance.dialogContent.querySelector('#script_skinManager'),
            customMenuLinks: modalInstance.dialogContent.querySelector('#script_customMenuLinks')
        };

        const configSections = {
            search: modalInstance.dialogContent.querySelector('#configSection_search'),
            exclusiveElsewhere: modalInstance.dialogContent.querySelector('#configSection_exclusiveElsewhere'),
            skin: modalInstance.dialogContent.querySelector('#configSection_skin'),
            theme: modalInstance.dialogContent.querySelector('#configSection_theme'),
            customMenuLinks: modalInstance.dialogContent.querySelector('#configSection_customMenuLinks')
        };

        // Function to toggle section visibility
        const toggleSectionVisibility = (scriptKey, sectionKey) => {
            const checkbox = scriptCheckboxes[scriptKey];
            const section = configSections[sectionKey];
            
            if (checkbox && section) {
                const isEnabled = checkbox.checked;
                section.style.display = isEnabled ? '' : 'none';
            }
        };

        // Set up event listeners for each script checkbox
        if (scriptCheckboxes.search) {
            scriptCheckboxes.search.addEventListener('change', () => toggleSectionVisibility('search', 'search'));
        }
        
        if (scriptCheckboxes.exclusiveElsewhere) {
            scriptCheckboxes.exclusiveElsewhere.addEventListener('change', () => toggleSectionVisibility('exclusiveElsewhere', 'exclusiveElsewhere'));
                }
        
        if (scriptCheckboxes.skinManager) {
            scriptCheckboxes.skinManager.addEventListener('change', () => {
                toggleSectionVisibility('skinManager', 'skin');
                toggleSectionVisibility('skinManager', 'theme');
        });
        }
        
        if (scriptCheckboxes.customMenuLinks) {
            scriptCheckboxes.customMenuLinks.addEventListener('change', () => toggleSectionVisibility('customMenuLinks', 'customMenuLinks'));
        }

        // Save button handler
        const saveBtn = modalInstance.dialogFooter?.querySelector('#saveConfigBtn');
        if (saveBtn) {
            saveBtn.addEventListener('click', () => handleSaveConfig(modalInstance));
        }

        // Export button handler
        const exportBtn = modalInstance.dialogFooter?.querySelector('#exportConfigBtn');
        if (exportBtn) {
            exportBtn.addEventListener('click', () => handleExportConfig(config));
        }

        // Import button handler
        const importBtn = modalInstance.dialogFooter?.querySelector('#importConfigBtn');
        if (importBtn) {
            importBtn.addEventListener('click', () => handleImportConfig(modalInstance));
        }
    }

    // Export configuration to clipboard
    async function handleExportConfig(config) {
        try {
            const configJson = JSON.stringify(config, null, 2);
            await navigator.clipboard.writeText(configJson);
            
            if (window.KefinTweaksToaster && window.KefinTweaksToaster.toast) {
                window.KefinTweaksToaster.toast('Configuration exported to clipboard!');
            } else {
                alert('Configuration exported to clipboard!');
            }
        } catch (error) {
            console.error('[KefinTweaks Configuration] Error exporting config:', error);
            
            if (window.KefinTweaksToaster && window.KefinTweaksToaster.toast) {
                window.KefinTweaksToaster.toast('Error exporting configuration to clipboard', '5');
            } else {
                alert('Error exporting configuration to clipboard');
            }
        }
    }

    // Import configuration from clipboard
    async function handleImportConfig(modalInstance) {
        if (!window.ModalSystem) {
            alert('Modal system not available');
            return;
        }

        // Show import modal with textarea
        const importModal = window.ModalSystem.create({
            id: 'importConfigModal',
            title: 'Import Configuration',
            content: `
                <div class="listItemBodyText" style="margin-bottom: 1em;">
                    Paste your configuration JSON below. This will completely replace your current configuration.
                </div>
                <textarea id="importConfigTextarea" class="fld emby-textarea" rows="20" placeholder='Paste your configuration JSON here...' style="width: 100%; font-family: monospace; font-size: 0.9em; line-height: 1.5;"></textarea>
            `,
            footer: `
                <button class="emby-button raised button-submit" id="confirmImportBtn" style="padding: 0.75em 2em; font-size: 1em; font-weight: 500; margin-right: 1em;">
                    <span>Import</span>
                </button>
                <button class="emby-button raised" id="cancelImportBtn" style="padding: 0.75em 2em; font-size: 1em;">
                    <span>Cancel</span>
                </button>
            `,
            closeOnBackdrop: true,
            closeOnEscape: true,
            onOpen: (importModalInstance) => {
                const confirmBtn = importModalInstance.dialogFooter?.querySelector('#confirmImportBtn');
                const cancelBtn = importModalInstance.dialogFooter?.querySelector('#cancelImportBtn');
                const textarea = importModalInstance.dialogContent.querySelector('#importConfigTextarea');
                
                // Focus textarea
                if (textarea) {
                    setTimeout(() => textarea.focus(), 100);
                }
                
                if (confirmBtn) {
                    confirmBtn.addEventListener('click', async () => {
                        const jsonText = textarea?.value.trim() || '';
                        
                        if (!jsonText) {
                            if (window.KefinTweaksToaster && window.KefinTweaksToaster.toast) {
                                window.KefinTweaksToaster.toast('Please paste configuration JSON', '3');
                            } else {
                                alert('Please paste configuration JSON');
                            }
                            return;
                        }

                        // Validate JSON
                        let importedConfig;
                        try {
                            importedConfig = JSON.parse(jsonText);
                        } catch (parseError) {
                            console.error('[KefinTweaks Configuration] Invalid JSON:', parseError);
                            if (window.KefinTweaksToaster && window.KefinTweaksToaster.toast) {
                                window.KefinTweaksToaster.toast(`Invalid JSON: ${parseError.message}`, '5');
                            } else {
                                alert(`Invalid JSON: ${parseError.message}`);
                            }
                            return;
                        }

                        // Validate config structure (basic check)
                        if (typeof importedConfig !== 'object' || importedConfig === null) {
                            if (window.KefinTweaksToaster && window.KefinTweaksToaster.toast) {
                                window.KefinTweaksToaster.toast('Invalid configuration format', '5');
                            } else {
                                alert('Invalid configuration format');
                            }
                            return;
                        }

                        // Show confirmation dialog
                        const confirmed = await showImportConfirmation();
                        if (!confirmed) {
                            return;
                        }

                        // Close import modal
                        importModalInstance.close();

                        // Apply imported config
                        try {
                            await applyImportedConfig(importedConfig, modalInstance);
                        } catch (error) {
                            console.error('[KefinTweaks Configuration] Error applying imported config:', error);
                            if (window.KefinTweaksToaster && window.KefinTweaksToaster.toast) {
                                window.KefinTweaksToaster.toast(`Error applying configuration: ${error.message}`, '5');
                            } else {
                                alert(`Error applying configuration: ${error.message}`);
                            }
                        }
                    });
                }
                
                if (cancelBtn) {
                    cancelBtn.addEventListener('click', () => {
                        importModalInstance.close();
                    });
                }
            }
        });
    }

    // Show confirmation dialog for import
    function showImportConfirmation() {
        return new Promise((resolve) => {
            if (!window.ModalSystem) {
                resolve(false);
                return;
            }

            const modal = window.ModalSystem.create({
                id: 'importConfirmation',
                title: 'Confirm Import',
                content: `
                    <div class="listItemBodyText" style="margin-bottom: 1em;">
                        This will completely overwrite your current configuration. All existing settings will be replaced with the imported configuration. This action cannot be undone.
                    </div>
                `,
                footer: `
                    <button class="emby-button raised button-submit" id="confirmImportConfirmBtn" style="padding: 0.75em 2em; font-size: 1em; font-weight: 500; margin-right: 1em;">
                        <span>Continue</span>
                    </button>
                    <button class="emby-button raised" id="cancelImportConfirmBtn" style="padding: 0.75em 2em; font-size: 1em;">
                        <span>Cancel</span>
                    </button>
                `,
                closeOnBackdrop: true,
                closeOnEscape: true,
                onOpen: (modalInstance) => {
                    const confirmBtn = modalInstance.dialogFooter?.querySelector('#confirmImportConfirmBtn');
                    const cancelBtn = modalInstance.dialogFooter?.querySelector('#cancelImportConfirmBtn');
                    
                    if (confirmBtn) {
                        confirmBtn.addEventListener('click', () => {
                            modalInstance.close();
                            resolve(true);
                        });
                    }
                    
                    if (cancelBtn) {
                        cancelBtn.addEventListener('click', () => {
                            modalInstance.close();
                            resolve(false);
                        });
                    }
                }
            });
        });
    }

    // Apply imported configuration
    async function applyImportedConfig(importedConfig, modalInstance) {
        // Save to JavaScript Injector
        await saveConfigToJavaScriptInjector(importedConfig);
        
        // Reload the modal with new config
        modalInstance.close();
        
        // Show success message
        if (window.KefinTweaksToaster && window.KefinTweaksToaster.toast) {
            window.KefinTweaksToaster.toast('Configuration imported successfully! Reloading...');
        }
        
        // Reopen modal with new config after a short delay
        setTimeout(() => {
            openConfigurationModal();
        }, 500);
    }

    // Find JavaScript Injector plugin
    async function findJavaScriptInjectorPlugin() {
        try {
            if (!window.ApiClient || !window.ApiClient._serverAddress || !window.ApiClient.accessToken) {
                throw new Error('ApiClient not available');
            }

            const server = ApiClient._serverAddress;
            const token = ApiClient.accessToken();

            const response = await fetch(`${server}/Plugins`, {
                headers: {
                    'X-Emby-Token': token
                }
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const plugins = await response.json();
            console.log('[KefinTweaks Configuration] Active Plugins:', plugins);

            // Handle both array and object with Items property
            const pluginsList = Array.isArray(plugins) ? plugins : (plugins.Items || []);
            
            // Find JavaScript Injector plugin
            const injectorPlugin = pluginsList.find(plugin => 
                plugin.Name === 'JavaScript Injector' || plugin.Name === 'JS Injector'
            );

            if (!injectorPlugin) {
                throw new Error('JavaScript Injector plugin not found. Please ensure it is installed.');
            }

            console.log('[KefinTweaks Configuration] Found JavaScript Injector plugin:', injectorPlugin);
            return injectorPlugin.Id;
        } catch (error) {
            console.error('[KefinTweaks Configuration] Error finding JavaScript Injector plugin:', error);
            throw error;
        }
    }

    // Get current JavaScript Injector configuration
    async function getJavaScriptInjectorConfig(pluginId) {
        try {
            if (!window.ApiClient || !window.ApiClient._serverAddress || !window.ApiClient.accessToken) {
                throw new Error('ApiClient not available');
            }

            const server = ApiClient._serverAddress;
            const token = ApiClient.accessToken();

            const response = await fetch(`${server}/Plugins/${pluginId}/Configuration`, {
                headers: {
                    'X-Emby-Token': token
                }
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const config = await response.json();
            console.log('[KefinTweaks Configuration] Current JS Injector config:', config);
            return config;
        } catch (error) {
            console.error('[KefinTweaks Configuration] Error getting JS Injector config:', error);
            throw error;
        }
    }

    // Save configuration to JavaScript Injector plugin
    async function saveConfigToJavaScriptInjector(config) {
        try {
            // Find the plugin
            const pluginId = await findJavaScriptInjectorPlugin();

            // Get fresh configuration data
            const injectorConfig = await getJavaScriptInjectorConfig(pluginId);
                
            // Ensure CustomJavaScripts array exists
            if (!injectorConfig.CustomJavaScripts) {
                injectorConfig.CustomJavaScripts = [];
            }

            // Create the script content
            const scriptContent = `// KefinTweaks Configuration
// This file is automatically generated by KefinTweaks Configuration UI
// Do not edit manually unless you know what you're doing

window.KefinTweaksConfig = ${JSON.stringify(config, null, 2)};`;

            // Check if KefinTweaks-Config already exists
            const existingScriptIndex = injectorConfig.CustomJavaScripts.findIndex(
                script => script.Name === 'KefinTweaks-Config'
            );

            if (existingScriptIndex !== -1) {
                // Update existing script
                console.log('[KefinTweaks Configuration] Updating existing KefinTweaks-Config script');
                injectorConfig.CustomJavaScripts[existingScriptIndex].Script = scriptContent;
                // Keep existing Enabled and RequiresAuthentication settings
            } else {
                // Add new script
                console.log('[KefinTweaks Configuration] Adding new KefinTweaks-Config script');
                injectorConfig.CustomJavaScripts.push({
                    Name: 'KefinTweaks-Config',
                    Script: scriptContent,
                    Enabled: true,
                    RequiresAuthentication: false
                });
            }

            // POST the updated configuration back
            const server = ApiClient._serverAddress;
            const token = ApiClient.accessToken();

            const response = await fetch(`${server}/Plugins/${pluginId}/Configuration`, {
                method: 'POST',
                headers: {
                    'X-Emby-Token': token,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(injectorConfig)
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            console.log('[KefinTweaks Configuration] Configuration saved successfully');
            return true;
        } catch (error) {
            console.error('[KefinTweaks Configuration] Error saving configuration:', error);
            throw error;
        }
    }

    // Handle save configuration
    async function handleSaveConfig(modalInstance) {
        // Verify admin status before saving
        const userIsAdmin = await isAdmin();
        if (!userIsAdmin) {
            alert('You must be an administrator to save configuration.');
            return;
        }

        console.log('[KefinTweaks Configuration] Saving configuration...');
        
        // Collect all form values
        const config = {
            kefinTweaksRoot: document.getElementById('kefinTweaksRoot')?.value || '',
            scriptRoot: document.getElementById('scriptRoot')?.value || '',
            scripts: {},
            homeScreen: {},
            exclusiveElsewhere: {},
            search: {},
            defaultSkin: document.getElementById('defaultSkin')?.value || null,
            skins: [],
            themes: [],
            customMenuLinks: []
        };

        // Collect script toggles
        document.querySelectorAll('[data-script-key]').forEach(checkbox => {
            const key = checkbox.getAttribute('data-script-key');
            config.scripts[key] = checkbox.checked;
        });

        // Collect home screen config
        config.homeScreen = {
            enableNewAndTrending: document.getElementById('homeScreen_enableNewAndTrending')?.checked !== false,
            enableNewMovies: document.getElementById('homeScreen_enableNewMovies')?.checked !== false,
            enableNewEpisodes: document.getElementById('homeScreen_enableNewEpisodes')?.checked !== false,
            enableTrending: document.getElementById('homeScreen_enableTrending')?.checked === true,
            enableDiscovery: document.getElementById('homeScreen_enableDiscovery')?.checked !== false,
            enableInfiniteScroll: document.getElementById('homeScreen_enableInfiniteScroll')?.checked !== false,
            minPeopleAppearances: parseInt(document.getElementById('homeScreen_minPeopleAppearances')?.value || '10'),
            minGenreMovieCount: parseInt(document.getElementById('homeScreen_minGenreMovieCount')?.value || '50'),
            minimumShowsForNetwork: parseInt(document.getElementById('homeScreen_minimumShowsForNetwork')?.value || '5'),
            enableWatchlist: document.getElementById('homeScreen_enableWatchlist')?.checked !== false,
            enableSeasonal: document.getElementById('homeScreen_enableSeasonal')?.checked !== false,
            seasonalItemLimit: parseInt(document.getElementById('homeScreen_seasonalItemLimit')?.value || '16'),
            customSections: parseJSONField('homeScreen_customSections', [])
        };

        // Collect exclusive elsewhere config
        config.exclusiveElsewhere = {
            hideServerName: document.getElementById('exclusiveElsewhere_hideServerName')?.checked === true
        };

        // Collect search config
        config.search = {
            enableJellyseerr: document.getElementById('search_enableJellyseerr')?.checked === true
        };

        // Parse JSON fields
        const skinsFromJson = parseJSONField('skinsJson', []);
        config.themes = parseJSONField('themesJson', []);
        config.customMenuLinks = parseJSONField('customMenuLinksJson', []);

        // Collect skin enabled toggles and merge with JSON skins
        // First, get the original config to preserve hidden skins
        const originalConfig = await getKefinTweaksConfig();
        const originalSkins = originalConfig.skins || [];
        const hiddenSkins = originalSkins.filter(skin => skin.hidden === true);
        
        // Collect enabled states from toggles
        const skinEnabledStates = {};
        modalInstance.dialogContent.querySelectorAll('[data-skin-name]').forEach(checkbox => {
            const skinName = checkbox.getAttribute('data-skin-name');
            skinEnabledStates[skinName] = checkbox.checked;
        });

        // Merge: start with hidden skins (preserve them), then add/update from JSON
        config.skins = [...hiddenSkins];
        
        // Add/update skins from JSON textarea
        skinsFromJson.forEach(skin => {
            const existingIndex = config.skins.findIndex(s => s.name === skin.name);
            if (existingIndex !== -1) {
                // Update existing skin (shouldn't happen for hidden, but just in case)
                config.skins[existingIndex] = {
                    ...config.skins[existingIndex],
                    ...skin,
                    enabled: skinEnabledStates[skin.name] !== false // Default to true if not set
                };
            } else {
                // Add new skin
                config.skins.push({
                    ...skin,
                    enabled: skinEnabledStates[skin.name] !== false,
                    hidden: false // Explicitly set for new skins
                });
            }
        });

        // Update enabled states for all skins (including hidden ones)
        config.skins.forEach(skin => {
            if (skinEnabledStates.hasOwnProperty(skin.name)) {
                skin.enabled = skinEnabledStates[skin.name];
            }
        });

        // Handle defaultSkin
        if (config.defaultSkin === '') {
            config.defaultSkin = null;
        }

        console.log('[KefinTweaks Configuration] Configuration collected:', config);

        // Save to JavaScript Injector plugin
        try {
            await saveConfigToJavaScriptInjector(config);
            
            // Show success toast
            if (window.KefinTweaksToaster && window.KefinTweaksToaster.toast) {
                window.KefinTweaksToaster.toast('KefinTweaks saved!');
            }
        } catch (error) {
            console.error('[KefinTweaks Configuration] Error saving configuration:', error);
            
            // Show error toast
            if (window.KefinTweaksToaster && window.KefinTweaksToaster.toast) {
                window.KefinTweaksToaster.toast(`Error saving configuration: ${error.message}. Please ensure the JavaScript Injector plugin is installed and you have administrator permissions.`, '5');
            } else {
                // Fallback to alert if toaster is not available
                alert(`Error saving configuration: ${error.message}\n\nPlease ensure the JavaScript Injector plugin is installed and you have administrator permissions.`);
            }
        }
    }

    // Helper to parse JSON fields safely
    function parseJSONField(fieldId, defaultValue) {
        try {
            const field = document.getElementById(fieldId);
            if (!field || !field.value.trim()) {
                return defaultValue;
            }
            return JSON.parse(field.value);
        } catch (error) {
            console.error(`[KefinTweaks Configuration] Error parsing JSON field ${fieldId}:`, error);
            alert(`Error parsing JSON in ${fieldId}: ${error.message}`);
            return defaultValue;
        }
    }

    // Create configuration button for Administration section
    function createConfigButton() {
        const button = document.createElement('a');
        button.setAttribute('is', 'emby-linkbutton');
        button.style.display = 'block';
        button.style.padding = '0';
        button.style.margin = '0';
        button.className = 'listItem-border emby-button';
        button.setAttribute('data-kefintweaks-config-button', 'true');
        button.href = '#';
        button.onclick = (e) => {
            e.preventDefault();
            openConfigurationModal();
        };

        button.innerHTML = `
            <div class="listItem">
                <span class="material-icons listItemIcon listItemIcon-transparent build" aria-hidden="true"></span>
                <div class="listItemBody">
                    <div class="listItemBodyText">Configure KefinTweaks</div>
                </div>
            </div>
        `;

        return button;
    }

    // Create dashboard side menu button
    function createDashboardConfigButton() {
        // Check if button already exists
        if (document.querySelector('[data-kefintweaks-dashboard-config-button]')) {
            return null;
        }

        const div = document.createElement('div');
        div.className = 'MuiButtonBase-root MuiListItemButton-root MuiListItemButton-gutters MuiListItemButton-root MuiListItemButton-gutters kefin-config-button';
        div.setAttribute('tabindex', '0');
        div.setAttribute('data-kefintweaks-dashboard-config-button', 'true');
        div.onclick = () => {
            openConfigurationModal();
        };
        
        // Create icon with Material icon
        const icon = document.createElement('div');
        icon.className = 'MuiListItemIcon-root css-37qkju';
        const iconSpan = document.createElement('span');
        iconSpan.className = 'material-icons build MuiSvgIcon-root MuiSvgIcon-fontSizeMedium';
        iconSpan.style.marginRight = '12px';
        iconSpan.setAttribute('aria-hidden', 'true');
        icon.appendChild(iconSpan);

        // Create text
        const text = document.createElement('div');
        text.className = 'MuiListItemText-root css-f696uz';
        const span = document.createElement('span');
        span.className = 'MuiTypography-root MuiTypography-body1 MuiListItemText-primary css-hlxkyz';
        span.textContent = 'KefinTweaks';
        text.appendChild(span);

        // Create ripple effect span
        const ripple = document.createElement('span');
        ripple.className = 'MuiTouchRipple-root css-w0pj6f';

        div.appendChild(icon);
        div.appendChild(text);
        div.appendChild(ripple);

        return div;
    }

    // Add configuration button to dashboard side menu
    function addConfigButtonToDashboard() {
        // Check if button already exists
        if (document.querySelector('[data-kefintweaks-dashboard-config-button]')) {
            return;
        }

        // Find the plugins section
        const pluginsSection = document.querySelector('ul[aria-labelledby="plugins-subheader"]');
        if (!pluginsSection) {
            console.log('[KefinTweaks Configuration] Plugins section not found, retrying...');
            setTimeout(addConfigButtonToDashboard, 500);
            return;
        }

        // Create the button
        const button = createDashboardConfigButton();
        if (!button) {
            return;
        }

        // Add button to the plugins section
        pluginsSection.appendChild(button);

        console.log('[KefinTweaks Configuration] Configuration button added to dashboard side menu');
    }

    // Add configuration button to Administration section
    function addConfigButtonToAdminSection() {
        // Check if button already exists (check for admin section button specifically)
        if (document.querySelector('.adminSection [data-kefintweaks-config-button]')) {
            return;
        }

        // Find the Administration section
        const adminSection = document.querySelector('.adminSection.verticalSection');
        if (!adminSection) {
            console.log('[KefinTweaks Configuration] Administration section not found, retrying...');
            setTimeout(addConfigButtonToAdminSection, 500);
            return;
        }

        // Create and add the button
        const button = createConfigButton();
        adminSection.appendChild(button);

        console.log('[KefinTweaks Configuration] Configuration button added to Administration section');
    }

    // Register onViewPage handler for mypreferencesmenu page and dashboard
    function registerViewPageHandler() {
        if (!window.KefinTweaksUtils || !window.KefinTweaksUtils.onViewPage) {
            console.log('[KefinTweaks Configuration] KefinTweaksUtils.onViewPage not available, retrying...');
            setTimeout(registerViewPageHandler, 1000);
            return;
        }

        // Handler for dashboard and preferences pages
        window.KefinTweaksUtils.onViewPage(async (view, element, hash) => {
            // Check if user is admin before adding buttons
            const userIsAdmin = await isAdmin();
            if (!userIsAdmin) {
                console.log('[KefinTweaks Configuration] User is not admin, not adding buttons');
                return;
            }

            // Check if we're on the mypreferencesmenu page
            if (hash && (hash.includes('mypreferencesmenu') || hash.includes('userpreferences') || hash.includes('preferences'))) {
                console.log('[KefinTweaks Configuration] Preferences page detected');
                // Wait a bit for the page to fully load
                setTimeout(() => {
                    addConfigButtonToAdminSection();
                }, 500);
            }

            // Check if we're on the dashboard page
            if (view === 'dashboard' || view === 'configurationpage' || hash.includes('dashboard') || hash.includes('configurationpage')) {
                console.log('[KefinTweaks Configuration] Dashboard page detected');
                // Wait a bit for the page to fully load
                    setTimeout(() => {
                    addConfigButtonToDashboard();
                    }, 500);
                }
        });

        console.log('[KefinTweaks Configuration] Registered onViewPage handler');
    }

    // Add configuration link to custom menu
    async function addConfigLinkToCustomMenu() {
        // Check if user is admin
        const userIsAdmin = await isAdmin();
        if (!userIsAdmin) {
            console.log('[KefinTweaks Configuration] User is not admin, not adding menu link');
            return;
        }

        // Check if utils is available
        if (!window.KefinTweaksUtils || !window.KefinTweaksUtils.addCustomMenuLink) {
            console.log('[KefinTweaks Configuration] KefinTweaksUtils.addCustomMenuLink not available, retrying...');
            setTimeout(addConfigLinkToCustomMenu, 1000);
            return;
        }

        // Use a special URL that we can intercept
        const configUrl = '#';
        
        // Add the menu link
        const success = await window.KefinTweaksUtils.addCustomMenuLink(
            'Configure',
            'build',
            configUrl,
            false
        );

        if (success) {
            console.log('[KefinTweaks Configuration] Configuration link added to custom menu');
            
            // Set up click handler to intercept navigation and open modal instead
            setupConfigLinkClickHandler();
        }
    }

    // Set up click handler for configuration menu link
    function setupConfigLinkClickHandler() {
        // Find the config button
        const configButton = document.querySelector('.navMenuOption:has(.build)');
        if (!configButton) {
            console.log('[KefinTweaks Configuration] Configuration button not found, retrying...');
            setTimeout(setupConfigLinkClickHandler, 1000);
            return;
        }

        // Add click handler to the config button
        configButton.addEventListener('click', (e) => {
            e.preventDefault();
            openConfigurationModal();
        });
    }

    // Handle direct navigation to config URL
    function handleDirectConfigNavigation() {
        if (window.location.hash === '#kefintweaks-config') {
            console.log('[KefinTweaks Configuration] Direct navigation to config URL detected');
            // Remove the hash to prevent navigation
            window.history.replaceState(null, '', window.location.pathname + window.location.search);
            // Open modal
            openConfigurationModal();
        }
    }

    // Set up hashchange listener for navigation after page load
    function setupHashChangeListener() {
        window.addEventListener('hashchange', () => {
            if (window.location.hash === '#kefintweaks-config') {
                console.log('[KefinTweaks Configuration] Hash change to config URL detected');
                // Remove the hash to prevent navigation
                window.history.replaceState(null, '', window.location.pathname + window.location.search);
                // Open modal
                openConfigurationModal();
            }
        });
    }

    // Initialize when DOM is ready
    async function initialize() {
        if (!window.ApiClient || !window.ApiClient._loggedIn) {
            setTimeout(initialize, 1000);
            return;
        }

        // Register view page handler
        registerViewPageHandler();

        // Add configuration link to custom menu
        addConfigLinkToCustomMenu();

        // Set up hashchange listener
        setupHashChangeListener();

        // Handle direct navigation to config URL
        handleDirectConfigNavigation();

        // Also check current page on initial load
        const hash = window.location.hash;
        const userIsAdmin = await isAdmin();
        
        if (userIsAdmin) {
            if (hash && (hash.includes('mypreferencesmenu') || hash.includes('userpreferences') || hash.includes('preferences'))) {
                setTimeout(() => {
                    addConfigButtonToAdminSection();
                }, 1000);
            }
            
            if (hash && hash.includes('dashboard')) {
        setTimeout(() => {
                    addConfigButtonToDashboard();
                }, 1000);
            }
        }
    }

    // Start initialization
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initialize);
    } else {
        initialize();
    }

    console.log('[KefinTweaks Configuration] Script loaded');
})();
