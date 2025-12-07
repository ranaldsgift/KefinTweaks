// KefinTweaks Configuration UI
// Adds a configuration button to the Administration section in user preferences
// Opens configuration in a modal window

(function() {
    'use strict';

    console.log('[KefinTweaks Configuration] Initializing...');

    const MODAL_ID = 'kefinTweaksConfigModal';
    let currentLoadedConfig = null;

    const DISCOVERY_SECTION_DEFINITIONS = [
        { key: 'spotlightGenre', label: 'Spotlight Sections (Genre)', defaultName: 'Spotlight' },
        { key: 'spotlightNetwork', label: 'Spotlight Sections (Network)', defaultName: 'Spotlight' },
        { key: 'genreMovies', label: 'Genre Movies', defaultName: '[Genre] Movies' },
        { key: 'studioShows', label: 'Shows from [Studio]', defaultName: 'Shows from [Studio]' },
        { key: 'collections', label: 'Collection Spotlight', defaultName: '[Collection Name]', extras: { minimumItems: 10 } },
        { key: 'becauseYouWatched', label: 'Because you watched [Movie]', defaultName: 'Because you watched [Movie]' },
        { key: 'becauseYouLiked', label: 'Because you liked [Movie]', defaultName: 'Because you liked [Movie]' },
        { key: 'starringTopActor', label: 'Starring [Top Actor]', defaultName: 'Starring [Actor]' },
        { key: 'directedByTopDirector', label: 'Directed by [Top Director]', defaultName: 'Directed by [Director]' },
        { key: 'writtenByTopWriter', label: 'Written by [Top Writer]', defaultName: 'Written by [Writer]' },
        { key: 'becauseYouRecentlyWatched', label: 'Because you recently watched [Movie]', defaultName: 'Because you recently watched [Movie]' },
        { key: 'starringActorRecentlyWatched', label: 'Starring [Actor] because you recently watched [Movie]', defaultName: 'Starring [Actor] because you recently watched [Movie]' },
        { key: 'directedByDirectorRecentlyWatched', label: 'Directed by [Director] because you recently watched [Movie]', defaultName: 'Directed by [Director] because you recently watched [Movie]' },
        { key: 'writtenByWriterRecentlyWatched', label: 'Written by [Writer] because you recently watched [Movie]', defaultName: 'Written by [Writer] because you recently watched [Movie]' }
    ];

    const SUPPORTED_CUSTOM_SECTION_PARAMS = {
        filters: { label: 'Filters', type: 'array', hint: 'IsFolder, IsNotFolder, IsUnplayed, IsPlayed, IsFavorite, IsResumable, Likes, Dislikes' },
        isPlayed: { label: 'Is Played', type: 'boolean' },
        person: { label: 'Person Name', type: 'string' },
        personTypes: { label: 'Person Types', type: 'array', hint: 'Actor, Director, Writer, etc.' },
        years: { label: 'Years', type: 'array', hint: 'Comma-separated years' },
        
        // Dates (ISO 8601)
        minPremiereDate: { label: 'Min Premiere Date', type: 'date', hint: 'YYYY-MM-DD' },
        maxPremiereDate: { label: 'Max Premiere Date', type: 'date', hint: 'YYYY-MM-DD' },
        //minDateLastSaved: { label: 'Min Date Last Saved', type: 'date', hint: 'YYYY-MM-DD' },
        //minDateLastSavedForUser: { label: 'Min Date Last Saved For User', type: 'date', hint: 'YYYY-MM-DD' },
        
        // Numbers
        indexNumber: { label: 'Index Number', type: 'number' },
        parentIndexNumber: { label: 'Parent Index Number', type: 'number' },
        minCommunityRating: { label: 'Min Community Rating', type: 'number' },
        minCriticRating: { label: 'Min Critic Rating', type: 'number' },

        // Booleans
        isFavorite: { label: 'Is Favorite', type: 'boolean' },
        hasThemeSong: { label: 'Has Theme Song', type: 'boolean' },
        hasThemeVideo: { label: 'Has Theme Video', type: 'boolean' },
        hasSubtitles: { label: 'Has Subtitles', type: 'boolean' },
        hasSpecialFeature: { label: 'Has Special Feature', type: 'boolean' },
        hasTrailer: { label: 'Has Trailer', type: 'boolean' },
        hasParentalRating: { label: 'Has Parental Rating', type: 'boolean' },
        isHd: { label: 'Is HD', type: 'boolean' },
        is4K: { label: 'Is 4K', type: 'boolean' },
        isMissing: { label: 'Is Missing', type: 'boolean' },
        isUnaired: { label: 'Is Unaired', type: 'boolean' },
        //is3D: { label: 'Is 3D', type: 'boolean' },
        //isSeries: { label: 'Is Series (Live TV)', type: 'boolean' },
        hasOverview: { label: 'Has Overview', type: 'boolean' },
        hasOfficialRating: { label: 'Has Official Rating', type: 'boolean' },
        recursive: { label: 'Recursive', type: 'boolean', default: true },
        
        // Strings
        maxOfficialRating: { label: 'Max Official Rating', type: 'string', hint: 'e.g., PG-13, TV-MA' },
        minOfficialRating: { label: 'Min Official Rating', type: 'string', hint: 'e.g., PG, TV-14' },
        nameStartsWith: { label: 'Name Starts With', type: 'string' },
        nameStartsWithOrGreater: { label: 'Name Starts With Or Greater', type: 'string' },
        nameLessThan: { label: 'Name Less Than', type: 'string' },
        
        // Arrays (Comma-separated strings in UI)
        locationTypes: { label: 'Location Types', type: 'array', hint: 'FileSystem, Remote, Virtual, Offline' },
        excludeLocationTypes: { label: 'Exclude Location Types', type: 'array', hint: 'FileSystem, Remote, Virtual, Offline' },
        excludeItemIds: { label: 'Exclude Item IDs', type: 'array', hint: 'Comma-separated GUIDs' },
        excludeItemTypes: { label: 'Exclude Item Types', type: 'array', hint: 'Movie, Series, Episode, etc.' },
        imageTypes: { label: 'Image Types', type: 'array', hint: 'Primary, Backdrop, Thumb, Logo, etc.' },
        officialRatings: { label: 'Official Ratings', type: 'array', hint: 'PG, PG-13, R, etc.' },
        studios: { label: 'Studios', type: 'array', hint: 'Pipe-delimited names' },
        artists: { label: 'Artists', type: 'array', hint: 'Pipe-delimited names' },
        albums: { label: 'Albums', type: 'array', hint: 'Pipe-delimited names' },
        seriesStatus: { label: 'Series Status', type: 'array', hint: 'Continuing, Ended, Unreleased' },
        personIds: { label: 'Person IDs', type: 'array', hint: 'Comma-separated GUIDs' },
        studioIds: { label: 'Studio IDs', type: 'array', hint: 'Comma-separated GUIDs' },
        ids: { label: 'Item IDs', type: 'array', hint: 'Comma-separated GUIDs' }
    };

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
                    ? `${window.KefinTweaksConfig.kefinTweaksRoot}/kefinTweaks-default-config.js` : null;

                if (!defaultConfigUrl) {
                    reject(new Error('No default config URL found'));
                    return;
                }
                
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
                        // Store enabled state globally for use in modal (defaults to true if not set)
                        window.KefinTweaksConfigEnabled = config.enabled !== false;
                        console.log('[KefinTweaks Configuration] Loaded config from JS Injector:', config);
                        return config;
                    } catch (parseError) {
                        console.error('[KefinTweaks Configuration] Error parsing config from script:', parseError);
                    }
                }
        }

            // If no config found in JS Injector, load defaults
            console.log('[KefinTweaks Configuration] No config found in JS Injector, loading defaults');
        const rawDefaultConfig = await loadDefaultConfig();
        const defaultConfig = JSON.parse(JSON.stringify(rawDefaultConfig));

        const currentConfigSource = currentLoadedConfig || window.KefinTweaksCurrentConfig || window.KefinTweaksConfig || {};
        const currentKefinRoot = currentConfigSource.kefinTweaksRoot || defaultConfig.kefinTweaksRoot;
        defaultConfig.kefinTweaksRoot = currentKefinRoot;
        // Ensure enabled field is set (defaults to true if not present)
        if (defaultConfig.enabled === undefined) {
            defaultConfig.enabled = true;
        }
        // Store enabled state globally for use in modal
        window.KefinTweaksConfigEnabled = defaultConfig.enabled !== false;
        // Note: scriptRoot is no longer used - scripts are loaded from kefinTweaksRoot + '/scripts/'

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
                    kefinTweaksRoot: '',
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
                overflow: visible;
            }
            
            #${MODAL_ID} details summary:hover {
                opacity: 0.8;
            }
            
            #${MODAL_ID} pre {
                white-space: pre-wrap;
                word-wrap: break-word;
            }
            
            /* Custom section collapsible styling */
            #${MODAL_ID} .custom-section-summary {
                position: relative;
                list-style: none;
            }
            
            #${MODAL_ID} .custom-section-summary::-webkit-details-marker {
                display: none;
            }
            
            #${MODAL_ID} .custom-section-summary::marker {
                display: none;
            }
            
            #${MODAL_ID} details[open] .custom-section-summary .material-icons {
                transform: rotate(90deg);
            }
            
            #${MODAL_ID} .custom-section-summary .material-icons {
                transition: transform 0.2s ease;
            }
            
            /* Recently released subsection styling */
            #${MODAL_ID} .recently-released-subsection-summary {
                position: relative;
                list-style: none;
            }
            
            #${MODAL_ID} .recently-released-subsection-summary::-webkit-details-marker {
                display: none;
            }
            
            #${MODAL_ID} .recently-released-subsection-summary::marker {
                display: none;
            }
            
            #${MODAL_ID} details[open] .recently-released-subsection-summary .material-icons {
                transform: rotate(90deg);
            }
            
            #${MODAL_ID} .recently-released-subsection-summary .material-icons {
                transition: transform 0.2s ease;
            }
            
            /* Seasonal season collapsible styling */
            #${MODAL_ID} .seasonal-season-summary {
                position: relative;
                list-style: none;
            }
            
            #${MODAL_ID} .seasonal-season-summary::-webkit-details-marker {
                display: none;
            }
            
            #${MODAL_ID} .seasonal-season-summary::marker {
                display: none;
            }
            
            #${MODAL_ID} details[open] .seasonal-season-summary .material-icons {
                transform: rotate(90deg);
            }
            
            #${MODAL_ID} .seasonal-season-summary .material-icons {
                transition: transform 0.2s ease;
            }
            
            /* Seasonal section collapsible styling (sections within seasons) */
            #${MODAL_ID} .seasonal-section-summary {
                position: relative;
                list-style: none;
            }
            
            #${MODAL_ID} .seasonal-section-summary::-webkit-details-marker {
                display: none;
            }
            
            #${MODAL_ID} .seasonal-section-summary::marker {
                display: none;
            }
            
            #${MODAL_ID} details[open] .seasonal-section-summary .material-icons {
                transform: rotate(90deg);
            }
            
            #${MODAL_ID} .seasonal-section-summary .material-icons {
                transition: transform 0.2s ease;
            }
            
            /* Discovery section type collapsible styling */
            #${MODAL_ID} .discovery-section-type-summary {
                position: relative;
                list-style: none;
            }
            
            #${MODAL_ID} .discovery-section-type-summary::-webkit-details-marker {
                display: none;
            }
            
            #${MODAL_ID} .discovery-section-type-summary::marker {
                display: none;
            }
            
            #${MODAL_ID} details[open] .discovery-section-type-summary .material-icons {
                transform: rotate(90deg);
            }
            
            #${MODAL_ID} .discovery-section-type-summary .material-icons {
                transition: transform 0.2s ease;
            }
            
            /* Skins JSON collapsible styling */
            #${MODAL_ID} details.listItem[open] summary .material-icons {
                transform: rotate(90deg);
            }
            
            #${MODAL_ID} details.listItem summary .material-icons {
                transition: transform 0.2s ease;
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


    // Build the configuration page content
    function buildConfigPageContent(config, libraries = []) {
        const scripts = config.scripts || {};
        const homeScreen = config.homeScreen || {};
        const exclusiveElsewhere = config.exclusiveElsewhere || {};
        const search = config.search || {};
        const flattenSingleSeasonShows = config.flattenSingleSeasonShows || {};
        const customMenuLinks = config.customMenuLinks || [];
        // Reconstruct full skin list (enabled + disabled) for configuration
        // We can't use window.KefinTweaksSkinConfig directly because it filters out disabled skins
        const defaultSkins = window.KefinTweaksDefaultSkinsConfig?.skins || [];
        const adminSkins = config.skins || [];
        
        const mergedSkins = [];
        
        // 1. Add all default skins first
        defaultSkins.forEach(skin => {
            mergedSkins.push({ ...skin, enabled: true });
        });
        
        // 2. Override/Add with admin skins
        adminSkins.forEach(adminSkin => {
            const existingIndex = mergedSkins.findIndex(s => s.name === adminSkin.name);
            if (existingIndex >= 0) {
                // Override existing default skin
                mergedSkins[existingIndex] = { ...mergedSkins[existingIndex], ...adminSkin };
            } else {
                // Add new admin skin
                mergedSkins.push({ ...adminSkin });
            }
        });
        
        const skins = mergedSkins;
        const themes = config.themes || [];

        // Get all skin names for autocomplete
        const allSkinNames = skins.map(skin => skin.name).filter(Boolean);
        
        // Get skin source info for visual distinctions
        const skinSources = window.KefinTweaksSkinManager?.getAllSkinSources?.() || {};

        const isEnabled = window.KefinTweaksConfigEnabled !== false;
        
        return `
            <div class="paperList" style="margin-bottom: 2em;">
                <div class="listItem">
                    <div class="listItemContent" style="display: flex; gap: 1em; align-items: center; flex-wrap: wrap;">
                        <label class="checkboxContainer" style="display: flex; align-items: center; gap: 0.75em; cursor: pointer;">
                            <input type="checkbox" id="kefinTweaksEnabled" class="checkbox" ${isEnabled ? 'checked' : ''}>
                            <span id="kefinTweaksEnabledLabel" class="listItemBodyText" style="margin: 0;">${isEnabled ? 'Enabled' : 'Disabled'}</span>
                        </label>
                        <button class="emby-button raised" id="changeKefinTweaksSourceBtn" style="padding: 0.75em 2em; font-size: 1em;" title="Switch between the Latest, Development, Version specific branches or point to your own self hosted location!">
                            <span>Plugin Settings</span>
                        </button>
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
                <div style="display: grid; grid-template-columns: 1fr; gap: 0.5em;">
                    ${buildHomeScreenConfig(homeScreen, libraries)}
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

            <div class="paperList" id="configSection_flattenSingleSeasonShows" style="margin-bottom: 2em; ${scripts.flattenSingleSeasonShows === false ? 'display: none;' : ''}">
                <div class="listItem" style="border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 1em; margin-bottom: 1em;">
                    <div class="listItemContent">
                        <h3 class="listItemBodyText" style="margin-bottom: 0.25em;">Episodes On Series Page Configuration</h3>
                        <div class="listItemBodyText secondary">Configure episodes display on series pages</div>
                    </div>
                </div>
                ${buildFlattenShowsConfig(flattenSingleSeasonShows)}
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
                        <select id="defaultSkin" class="fld emby-select-withcolor emby-select emby-select-withcolor emby-select-withcolor" style="width: 100%; max-width: 400px;">
                            ${allSkinNames.map(name => `<option value="${name}" ${config.defaultSkin === name ? 'selected' : ''}>${name}</option>`).join('')}
                            ${allSkinNames.length === 0 ? '<option value="">No skins available</option>' : ''}
                        </select>
                        <div class="listItemBodyText secondary" style="margin-top: 0.5em; font-size: 0.9em;">Select a default skin for all users</div>
                    </div>
                </div>
                <div class="listItem" style="border: 1px solid rgba(255,255,255,0.1); border-radius: 4px; padding: 0.75em; margin-bottom: 1em;">
                    <div class="listItemContent" style="width: 100%;">
                        <h3 class="listItemBodyText" style="margin-bottom: 0.5em;">Enable/Disable Skins</h3>
                        <div class="listItemBodyText secondary" style="margin-bottom: 1em; font-size: 0.9em;">Disabled skins will not appear in the appearance dropdowns for users</div>
                        <div class="listItemBodyText secondary" style="margin-bottom: 1em; font-size: 0.85em; color: rgba(255,255,255,0.7); line-height: 1.5;">
                            All themes are created with love by community members like you. Don't forget to thank them for their work and time if you appreciate their creations.
                            KefinTweaks has not contributed to the creation of any of the skins below and is only attempting to facilitate their accessibility.
                        </div>
                        <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap: 0.5em;">
                            ${buildSkinToggles(skins, skinSources)}
                        </div>
                    </div>
                </div>
                ${(() => {
                    // Check if there are any overridden default skins
                    const hasOverriddenSkins = Object.values(skinSources).some(source => source === 'overridden');
                    if (hasOverriddenSkins) {
                        return `
                            <div class="listItem" style="border: 1px solid rgba(255,255,255,0.1); border-radius: 4px; padding: 0.75em; margin-bottom: 1em;">
                                <div class="listItemContent">
                                    <div class="listItemBodyText secondary" style="margin-bottom: 0.75em; font-size: 0.9em;">Some default skins have been overridden by custom configurations. Click the button below to remove custom skins that override defaults.</div>
                                    <button type="button" id="removeDuplicateDefaultsBtn" class="emby-button raised" style="padding: 0.5em 1.5em; font-size: 0.9em;">
                                        <span>Remove Custom Skins Overriding Defaults</span>
                                    </button>
                                </div>
                            </div>
                        `;
                    }
                    return '';
                })()}
                <div class="listItem" style="border: 1px solid rgba(255,255,255,0.1); border-radius: 4px; padding: 0.75em; margin-bottom: 1em;">
                    <div class="listItemContent">
                        <h3 class="listItemBodyText" style="margin-bottom: 0.25em;">Optional CSS Modules</h3>
                        <div class="listItemBodyText secondary" style="margin-bottom: 1em; font-size: 0.9em;">Configure default enabled/disabled state for optional CSS modules. These settings will be used when users haven't specified their own preferences.</div>
                        <div class="listItemBodyText" style="margin-bottom: 0.5em;">Select Skin</div>
                        <select id="optionalIncludesCategory" class="fld emby-select-withcolor emby-select emby-select-withcolor emby-select-withcolor" style="width: 100%; max-width: 400px; margin-bottom: 1em;">
                            <option value="global">Global (applies to all skins)</option>
                            ${buildOptionalIncludesSkinOptions(skins)}
                        </select>
                        <div id="optionalIncludesEditor" style="margin-top: 1em;">
                            ${buildOptionalIncludesEditor('global', config, skins)}
                        </div>
                    </div>
                </div>
                <details class="listItem" style="border: 1px solid rgba(255,255,255,0.1); border-radius: 4px; padding: 0; margin-bottom: 1em; display: grid;">
                    <summary class="listItemBodyText" style="font-weight: 500; cursor: pointer; padding: 0.75em; display: flex; align-items: center; gap: 0.5em; list-style: none; user-select: none;">
                        <span class="material-icons" style="font-size: 1.2em; transition: transform 0.2s;">chevron_right</span>
                        <span>Skins JSON</span>
                    </summary>
                    <div style="padding: 0.75em; border-top: 1px solid rgba(255,255,255,0.1);">
                        <div class="listItemContent">
                            <div class="listItemBodyText secondary" style="margin-bottom: 0.75em; font-size: 0.9em;">Add additional skins that will be available to all users. Each skin can have multiple CSS files for different server versions. You can override the Default skins from KefinTweaks by specifying a custom configuration with that Skin Name in the configuration JSON below. Any skins that appear in this JSON and are named the same as the KefinTweaks default skins will override the default functionality. Default skins are not shown here as they are managed separately.</div>
                            <textarea id="skinsJson" class="fld emby-textarea" rows="15" placeholder='[{"name":"Skin Name","author":"Author","url":[...]}]' style="width: 100%; font-family: monospace; font-size: 0.9em; line-height: 1.5;">${JSON.stringify(config.skins || [], null, 2)}</textarea>
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
                </details>
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
    /**
     * Build dropdown options for skins that have optional includes
     * @param {Array} skins - Array of skin configurations
     * @returns {string} HTML string for dropdown options
     */
    function buildOptionalIncludesSkinOptions(skins) {
        const skinsWithOptionalIncludes = skins.filter(skin => 
            skin.optionalIncludes && skin.optionalIncludes.length > 0
        );
        
        return skinsWithOptionalIncludes.map(skin => 
            `<option value="${skin.name}">${skin.name}</option>`
        ).join('');
    }
    
    /**
     * Extract author from URL (for display purposes)
     * @param {string} url - The URL
     * @returns {string} Author name or empty string
     */
    function extractAuthorFromUrl(url) {
        if (!url) return '';
        try {
            // Try to extract GitHub username from jsdelivr URLs
            const jsdelivrMatch = url.match(/cdn\.jsdelivr\.net\/gh\/([^\/]+)\//);
            if (jsdelivrMatch) {
                return jsdelivrMatch[1];
            }
        } catch (e) {
            // Ignore errors
        }
        return '';
    }
    
    /**
     * Generate optional include key (same format as skinManager)
     * @param {string} skinName - The skin name or "global"
     * @param {string} author - The author name
     * @param {string} url - The URL
     * @returns {string} The generated key
     */
    function generateOptionalIncludeKey(skinName, author, url) {
        const normalizedSkinName = skinName === 'global' ? 'global' : skinName.replace(/\s+/g, '_');
        const filename = url ? url.split('?')[0].split('#')[0].split('/').pop() : '';
        const normalizedAuthor = (author || '').replace(/\s+/g, '_');
        return `${normalizedSkinName}-${normalizedAuthor}-${filename}`;
    }
    
    /**
     * Extract filename from URL
     * @param {string} url - The URL
     * @returns {string} The filename
     */
    function extractFilenameFromUrl(url) {
        if (!url) return '';
        try {
            const urlWithoutParams = url.split('?')[0].split('#')[0];
            const pathParts = urlWithoutParams.split('/');
            return pathParts[pathParts.length - 1] || '';
        } catch (e) {
            return '';
        }
    }
    
    /**
     * Build the optional includes editor UI
     * @param {string} category - "global" or skin name
     * @param {Object} config - The KefinTweaksConfig object
     * @param {Array} skins - Array of all skins
     * @returns {string} HTML string for the editor
     */
    function buildOptionalIncludesEditor(category, config, skins) {
        let optionalIncludes = [];
        
        if (category === 'global') {
            // Get global optional includes from defaults + admin config
            const defaultGlobalIncludes = window.KefinTweaksDefaultSkinsConfig?.globalOptionalIncludes || [];
            optionalIncludes = defaultGlobalIncludes.map(include => ({ ...include }));
            
            // Merge with admin config (admin can override enabled state)
            const adminOptionalIncludes = config.optionalIncludes || [];
            adminOptionalIncludes.forEach(adminEntry => {
                if (typeof adminEntry === 'object' && adminEntry.key) {
                    // Extract info from key: global-author-filename
                    const keyParts = adminEntry.key.split('-');
                    if (keyParts[0] === 'global' && keyParts.length >= 3) {
                        const author = keyParts[1];
                        const filename = keyParts.slice(2).join('-');
                        
                        // Find matching include by URL
                        const matchingInclude = optionalIncludes.find(inc => {
                            const incAuthor = extractAuthorFromUrl(inc.url);
                            const incFilename = extractFilenameFromUrl(inc.url);
                            return incAuthor === author && incFilename === filename;
                        });
                        
                        if (matchingInclude) {
                            matchingInclude.enabled = adminEntry.enabled;
                        } else {
                            // Admin added a new include (we'd need URL, but for now just show it)
                            optionalIncludes.push({
                                name: filename.replace('.css', '').replace(/-/g, ' '),
                                url: '', // We don't have the URL stored, would need to enhance
                                enabled: adminEntry.enabled,
                                key: adminEntry.key
                            });
                        }
                    }
                }
            });
        } else {
            // Get skin-specific optional includes
            const skin = skins.find(s => s.name === category);
            if (skin && skin.optionalIncludes) {
                optionalIncludes = skin.optionalIncludes.map(include => {
                    const author = extractAuthorFromUrl(include.url);
                    const key = generateOptionalIncludeKey(category, author, include.url);
                    
                    // Check admin config for enabled state
                    const adminOptionalIncludes = config.optionalIncludes || [];
                    const adminEntry = adminOptionalIncludes.find(entry => 
                        typeof entry === 'object' && entry.key === key
                    );
                    
                    return {
                        ...include,
                        key: key,
                        enabled: adminEntry ? adminEntry.enabled : (include.enabled || false)
                    };
                });
            }
        }
        
        if (optionalIncludes.length === 0) {
            return `
                <div class="listItemBodyText secondary" style="padding: 1em; text-align: center; opacity: 0.7;">
                    No optional CSS modules available for ${category === 'global' ? 'global options' : category}.
                </div>
            `;
        }
        
        return `
            <div class="listItemBodyText secondary" style="margin-bottom: 0.75em; font-size: 0.9em;">
                Configure which optional CSS modules are enabled by default. Users can override these settings individually.
            </div>
            <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 0.5em;">
                ${optionalIncludes.map((include, index) => {
                    const author = extractAuthorFromUrl(include.url);
                    const key = include.key || generateOptionalIncludeKey(category, author, include.url);
                    const filename = include.url ? extractFilenameFromUrl(include.url) : '';
                    
                    return `
                        <div class="listItem" style="border: 1px solid rgba(255,255,255,0.1); border-radius: 4px; padding: 0.75em; background: rgba(255,255,255,0.02);">
                            <div class="listItemContent">
                                <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 0.5em; gap: 0.5em;">
                                    <div style="flex: 1; min-width: 0;">
                                        <div class="listItemBodyText" style="font-weight: 500; margin-bottom: 0.25em;">${include.name}</div>
                                        ${author ? `<div class="listItemBodyText secondary" style="font-size: 0.85em;">by <a href="https://github.com/${author}" target="_blank" rel="noopener noreferrer" style="color: inherit; text-decoration: underline; opacity: 0.8; transition: opacity 0.2s;" onmouseover="this.style.opacity='1'" onmouseout="this.style.opacity='0.8'">${author}</a></div>` : ''}
                                    </div>
                                    <input type="checkbox" 
                                           id="optionalInclude_${category}_${index}" 
                                           class="checkbox optionalIncludeCheckbox" 
                                           data-category="${category}"
                                           data-key="${key}"
                                           data-url="${include.url || ''}"
                                           ${include.enabled ? 'checked' : ''}
                                           style="width: 18px; height: 18px; cursor: pointer; flex-shrink: 0; margin-top: 0.125em;">
                                </div>
                                ${filename ? `<div class="listItemBodyText secondary" style="font-size: 0.75em; opacity: 0.5; text-align: right; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; direction: rtl;" title="${include.url}">${filename}</div>` : ''}
                            </div>
                        </div>
                    `;
                }).join('')}
            </div>
        `;
    }
    
    function buildSkinToggles(skins, skinSources = {}) {
        return skins.map(skin => {
            const isEnabled = skin.enabled !== false; // Default to true if not set
            const githubUrl = getSkinGitHubUrl(skin);
            const source = skinSources[skin.name] || 'default';
            
            // Determine styling based on source
            let borderStyle = '1px solid rgba(255,255,255,0.1)';
            let backgroundStyle = 'rgba(255,255,255,0.02)';
            let badgeText = '';
            let badgeStyle = '';
            let badgeIcon = '';
            
            if (source === 'default') {
                backgroundStyle = 'rgba(255,255,255,0.01)';
                badgeText = 'D';
                badgeStyle = 'background: rgba(0,122,255,0.2); color: rgba(0,122,255,0.9);';
            } else if (source === 'overridden') {
                borderStyle = '2px solid rgba(0, 122, 255, 0.5)';
                backgroundStyle = 'rgba(0,122,255,0.05)';
                badgeIcon = 'warning';
                badgeStyle = 'color: rgba(255,165,0,0.9);';
            } else if (source === 'custom') {
                // Custom skins use default styling
            }
            
            // Determine tooltip text
            let tooltipText = '';
            if (source === 'default') {
                tooltipText = 'This skin is included automatically by KefinTweaks';
            } else if (source === 'overridden') {
                tooltipText = 'This default skin has been overridden by a custom configuration';
            } else if (githubUrl) {
                tooltipText = 'View on GitHub';
            }
            
            return `
                <div class="listItem" data-skin-source="${source}" style="border: ${borderStyle}; border-radius: 4px; padding: 0.5em; background: ${backgroundStyle};" ${tooltipText ? `title="${tooltipText}"` : ''}>
                    <div class="listItemContent" style="display: flex; justify-content: space-between; align-items: center; gap: 0.5em;">
                        <div style="flex: 1; display: flex; align-items: center; gap: 0.5em; min-width: 0;">
                            ${githubUrl ? `
                                <a href="${githubUrl}" target="_blank" rel="noopener noreferrer" style="display: flex; align-items: center; gap: 0.4em; color: inherit; text-decoration: none; opacity: 0.85; transition: opacity 0.2s; min-width: 0;" title="View on GitHub" onmouseover="this.style.opacity='1'" onmouseout="this.style.opacity='0.85'">
                                    <span class="listItemBodyText" style="font-weight: 500; font-size: 0.9em; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${skin.name}</span>
                                    <span class="material-icons" style="font-size: 1em; flex-shrink: 0;">info</span>
                                </a>
                            ` : `
                                <div class="listItemBodyText" style="font-weight: 500; font-size: 0.9em; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${skin.name}</div>
                            `}
                            ${badgeIcon ? `<span class="material-icons" style="font-size: 1.1em; ${badgeStyle}" title="${tooltipText}">${badgeIcon}</span>` : ''}
                            ${badgeText ? `<span style="font-size: 0.75em; padding: 0.15em 0.4em; border-radius: 3px; ${badgeStyle}">${badgeText}</span>` : ''}
                        </div>
                        ${buildJellyfinCheckbox(`skin_${skin.name.replace(/[^a-zA-Z0-9]/g, '_')}`, isEnabled, '', { 'data-skin-name': skin.name })}
                </div>
            </div>
        `;
        }).join('');
    }

    // Build script toggle switches
    function buildScriptToggles(scripts) {
        const scriptNames = [
            { key: 'watchlist', label: 'Watchlist', desc: 'Allows your users to add items to their Watchlist. The Watchlist page shows an overview of all items on a user\'s Watchlist, as well as their Series Progress and Movie History. It also includes a Statistics page with an overview of your user watched stats.' },
            { key: 'homeScreen', label: 'Enhanced Home Screen', desc: 'Add custom home screen sections and a "discovery engine" to your Home Page. Create sections based on Genre, Tags, Playlists, Collections or Search Terms for specific Item Types. Use the "Spotlight" feature to highlight specific sections with an image carousel/slideshow.' },
            { key: 'search', label: 'Enhanced Search', desc: 'Search speed is improved by searching less content types by default. Provides options to specify which content type to search. Fully compatible with both the Jellysearch Search from Jellyfin Enhanced plugin and the Meilisearch plugin.' },
            { key: 'infiniteScroll', label: 'Infinite Scroll', desc: 'Adds infinite scrolling to the library pages for Movies and TV' },
            { key: 'removeContinue', label: 'Remove Continue', desc: 'Adds the ability to remove items from the Continue Watching sections' },
            { key: 'skinManager', label: 'Skin Manager', desc: 'Skin selection and management - adds skin dropdown to header and display preferences' },
            { key: 'headerTabs', label: 'Header Tabs', desc: 'Allows direct navigation to specific Tab sections of a given library page. Full support for default Jellyfin landing pages.' },
            { key: 'customMenuLinks', label: 'Custom Menu Links', desc: 'Add custom menu links to the left side navigation menu' },
            { key: 'breadcrumbs', label: 'Breadcrumbs', desc: 'Breadcrumb navigation for Movies, TV and Music. Allows quick navigation between Seasons/Episodes and Albums/Songs.' },
            { key: 'playlist', label: 'Playlist UX', desc: 'Improved Playlist page navigation: Items only play when the Play button is pressed. Clicking an item navigates to the item\'s page.' },
            { key: 'itemDetailsCollections', label: 'Collections on Details Page', desc: 'Displays collections on item details pages (Included In section)' },
            { key: 'flattenSingleSeasonShows', label: 'Episodes On Series Page', desc: 'Displays episodes directly on series page. For single-season shows, shows all episodes. For multi-season shows, shows episodes from the season with Next Up episode (or Season 1 if no Next Up).' },
            { key: 'seriesInfo', label: 'Series Info+', desc: 'Adds Season and Episode counts to the Series and Season pages. Also adds an "Ends at" time similar to the Episode page.' },
            { key: 'collections', label: 'Collection Sorting', desc: 'Collection sorting functionality on the Collection page' },
            { key: 'subtitleSearch', label: 'Subtitle Search', desc: 'Search and download subtitles directly from the video OSD' },
            { key: 'exclusiveElsewhere', label: 'Exclusive Elsewhere', desc: 'Custom branding when items aren\'t available on streaming services' },
            { key: 'backdropLeakFix', label: 'Backdrop Leak Fix', desc: 'Fixes memory leaks from backdrop images when tab isn\'t focused' },
            { key: 'dashboardButtonFix', label: 'Dashboard Button Fix', desc: 'Improved back button behavior on dashboard - prevents navigating back to the new tab browser page' }
        ];

        return scriptNames.map(script => {
            const isEnabled = scripts[script.key] !== false; // Default to true if not set
            return `
                <div class="listItem" style="border: 1px solid rgba(255,255,255,0.1); border-radius: 4px; padding: 0.75em; background: rgba(255,255,255,0.02);">
                    <div class="listItemContent">
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.75em;">
                            <div class="listItemBodyText" style="font-weight: 500;">${script.label}</div>
                            ${buildJellyfinCheckbox(`script_${script.key}`, isEnabled, '', { 'data-script-key': script.key })}
                        </div>
                        <div class="listItemBodyText secondary" style="font-size: 0.9em; line-height: 1.4; width: 100%;">${script.desc}</div>
                    </div>
                </div>
            `;
        }).join('');
    }

    // Helper function to build Include Item Types badge field
    function buildIncludeItemTypesField(prefix, sectionIndex, sanitizedPrefix, currentTypes, sourceType) {
        // All available item types
        const allAvailableTypes = [
            'AggregateFolder', 'Audio', 'AudioBook', 'BasePluginFolder', 'Book', 'BoxSet', 'Channel', 
            'ChannelFolderItem', 'CollectionFolder', 'Episode', 'Folder', 'Genre', 'ManualPlaylistsFolder', 
            'Movie', 'LiveTvChannel', 'LiveTvProgram', 'MusicAlbum', 'MusicArtist', 'MusicGenre', 'MusicVideo', 
            'Person', 'Photo', 'PhotoAlbum', 'Playlist', 'PlaylistsFolder', 'Program', 'Recording', 'Season', 
            'Series', 'Studio', 'Trailer', 'TvChannel', 'TvProgram', 'UserRootFolder', 'UserView', 'Video', 'Year'
        ];
        
        const selectionLabel = currentTypes.length ? `${currentTypes.length} selected` : 'Select item types';
        
        // Current types as badges
        const badgesHtml = currentTypes.map(typeName => `
            <span class="tag-badge" data-value="${typeName}" style="display: inline-flex; align-items: center; gap: 0.25em; background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.2); border-radius: 4px; padding: 0.25em 0.5em; margin: 0.25em; font-size: 0.9em;">
                ${typeName}
                <button type="button" class="tag-badge-remove" style="background: none; border: none; color: rgba(255,255,255,0.7); cursor: pointer; padding: 0; margin-left: 0.25em; font-size: 1.2em; line-height: 1; display: flex; align-items: center;" title="Remove">×</button>
            </span>
        `).join('');
        
        const dropdownOptions = allAvailableTypes.map(typeName => {
            const isChecked = currentTypes.includes(typeName);
            return `
                <label class="includeItemTypes-option-label" style="display: flex; align-items: center; gap: 0.5em; padding: 0.35em 0; font-size: 0.9em;">
                    <input type="checkbox" class="includeItemTypes-option" data-type="${typeName}" value="${typeName}" ${isChecked ? 'checked' : ''} style="accent-color: rgba(0,122,255,0.8);">
                    <span>${typeName}</span>
                </label>
            `;
        }).join('');
        
        return `
            <div class="${prefix}_section_includeItemTypes_container" data-section-index="${sectionIndex}" style="border: 1px solid rgba(255,255,255,0.1); border-radius: 4px; padding: 0.75em; position: static;">
                <div style="position: relative;">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5em;">
                        <div class="listItemBodyText">Include Item Types</div>
                        <button type="button" class="badge-clear-all" data-section-index="${sectionIndex}" data-field="includeItemTypes" style="background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.2); border-radius: 4px; padding: 0.25em 0.5em; color: rgba(255,255,255,0.87); cursor: pointer; font-size: 0.85em;" title="Clear All">Clear All</button>
                    </div>
                    <div class="tag-badge-container includeItemTypes-badge-container" data-section-index="${sectionIndex}" data-prefix="${prefix}" data-available-types="${allAvailableTypes.join(',')}" style="border: 1px solid rgba(255,255,255,0.2); border-radius: 4px; padding: 0.5em; margin-bottom: 0.5em; background: rgba(0,0,0,0.2); display: flex; flex-direction: column; gap: 0.5em; position: relative;">
                        <button type="button" class="includeItemTypes-dropdown-toggle" data-section-index="${sectionIndex}" style="display: inline-flex; align-items: center; justify-content: space-between; gap: 0.5em; background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.2); border-radius: 4px; padding: 0.35em 0.75em; color: rgba(255,255,255,0.87); cursor: pointer; font-size: 0.9em;">
                            <span class="includeItemTypes-toggle-label">${selectionLabel}</span>
                            <span class="material-icons" style="font-size: 1.1em;">arrow_drop_down</span>
                        </button>
                        <div class="includeItemTypes-dropdown" data-section-index="${sectionIndex}" style="display: none; position: absolute; top: 100%; left: 0; width: 100%; margin-top: 0.35em; z-index: 11000; background: rgba(26,26,26,0.98); border: 1px solid rgba(255,255,255,0.2); border-radius: 6px; padding: 0.75em; box-shadow: 0 4px 16px rgba(0,0,0,0.4); max-height: 260px; overflow-y: auto;">
                            <div style="display: flex; flex-direction: column; gap: 0.25em;">
                                ${dropdownOptions}
                            </div>
                        </div>
                        <input type="text" class="${prefix}_section_includeItemTypes fld emby-input includeItemTypes-input-proxy" data-section-index="${sectionIndex}" data-prefix="${prefix}" data-field="includeItemTypes" autocomplete="off" style="position: absolute; left: -9999px; width: 1px; height: 1px; opacity: 0; pointer-events: none;">
                        <div class="includeItemTypes-badges" style="flex: 1; min-height: 2.5em; min-width: 0; display: flex; flex-wrap: wrap; gap: 0.25em; align-items: flex-start; overflow-wrap: break-word;">
                            <span class="includeItemTypes-empty" ${currentTypes.length ? 'hidden' : ''} style="opacity: 0.6; font-size: 0.9em; margin: 0.25em;">No item types selected</span>
                            ${badgesHtml}
                        </div>
                    </div>
                    <input type="hidden" class="${prefix}_section_includeItemTypes_hidden" data-section-index="${sectionIndex}" value="${currentTypes.join(', ')}">
                </div>
            </div>
        `;
    }

    // Helper function to build Additional Options Controls (Dropdown + Add Button)
    function buildAdditionalOptionsControls(prefix, sectionIndex, sanitizedPrefix) {
        // Build dropdown options from supported params
        const dropdownOptions = Object.entries(SUPPORTED_CUSTOM_SECTION_PARAMS)
            //.sort((a, b) => a[1].label.localeCompare(b[1].label))
            .map(([key, meta]) => `<option value="${key}">${meta.label}</option>`)
            .join('');

        return `
            <div class="${prefix}_section_additionalOptions_controls" data-section-index="${sectionIndex}" style="border: 1px solid rgba(255,255,255,0.1); border-radius: 4px; padding: 0.75em; position: static;">
                <div class="listItemBodyText" style="margin-bottom: 0.5em;">Additional Options</div>
                <div style="display: flex; gap: 0.5em; align-items: center;">
                    <select class="fld emby-select-withcolor emby-select additional-option-select" style="flex: 1; margin: 0; min-width: 0;">
                        <option value="">Select an option to add...</option>
                        ${dropdownOptions}
                    </select>
                    <button type="button" class="raised emby-button add-additional-option" style="background: rgba(0, 164, 220, 0.2); min-width: auto; padding: 0.5em 1em;">
                        <span>Add</span>
                    </button>
                </div>
            </div>
        `;
    }

    // Helper function to build Additional Options List
    function buildAdditionalOptionsList(prefix, sectionIndex, sanitizedPrefix, currentOptions) {
        const optionsHtml = (currentOptions || []).map((option, index) => {
            const meta = SUPPORTED_CUSTOM_SECTION_PARAMS[option.key] || { label: option.key, type: 'string' };
            const inputId = `${sanitizedPrefix}_additionalOption_${index}`;
            
            let inputField = '';
            if (meta.type === 'boolean') {
                const isChecked = option.value === true || option.value === 'true';
                inputField = buildJellyfinCheckbox(inputId, isChecked, meta.label, { 
                    'data-key': option.key, 
                    'class': 'additional-option-value',
                    'data-type': 'boolean'
                });
            } else {
                inputField = `
                    <div style="flex: 1;">
                        <div class="listItemBodyText" style="margin-bottom: 0.25em;">${meta.label}</div>
                        <input type="text" id="${inputId}" class="fld emby-input additional-option-value" value="${option.value || ''}" data-key="${option.key}" data-type="${meta.type}" placeholder="${meta.hint || ''}" style="width: 100%;">
                    </div>
                `;
            }

            return `
                <div class="additional-option-row" style="display: flex; align-items: flex-end; gap: 0.5em; margin-top: 0.5em; padding: 0.5em; background: rgba(255,255,255,0.05); border-radius: 4px;">
                    ${inputField}
                    <button type="button" class="remove-additional-option" style="background: none; border: none; color: rgba(255,255,255,0.7); cursor: pointer; padding: 0.25em; display: flex; align-items: center;" title="Remove Option">
                        <span class="material-icons">close</span>
                    </button>
                </div>
            `;
        }).join('');

        return `
            <div class="${prefix}_section_additionalOptions_list_container" data-section-index="${sectionIndex}" style="margin-top: 0.75em;">
                <div class="additional-options-list">
                    ${optionsHtml}
                </div>
            </div>
        `;
    }

    // Helper function to build Jellyfin-style checkbox
    function buildJellyfinCheckbox(id, checked, label, dataAttributes = {}) {
        let className = 'emby-checkbox';
        const otherAttrs = {};
        
        for (const [key, value] of Object.entries(dataAttributes)) {
            if (key === 'class') {
                className += ' ' + value;
            } else {
                otherAttrs[key] = value;
            }
        }
        
        const dataAttrs = Object.entries(otherAttrs).map(([key, value]) => `${key}="${value}"`).join(' ');
        const checkedAttr = checked ? 'checked' : '';
        return `
            <div class="checkboxContainer">
                <label class="emby-checkbox-label">
                    <input is="emby-checkbox" type="checkbox" id="${id}" class="${className}" data-embycheckbox="true" ${checkedAttr} ${dataAttrs}>
                    <span class="checkboxLabel">${label}</span>
                    <span class="checkboxOutline">
                        <span class="material-icons checkboxIcon checkboxIcon-checked check" aria-hidden="true"></span>
                        <span class="material-icons checkboxIcon checkboxIcon-unchecked" aria-hidden="true"></span>
                    </span>
                </label>
            </div>
        `;
    }

    // Helper function to build a section UI (for nested sections in seasonal and custom sections)
    function buildSectionUI(prefix, section, sectionIndex, isSeasonalNested = false) {
        const sectionId = section.id || `${prefix}_section_${sectionIndex}`;
        const enabled = section.enabled !== false;
        const name = section.name || '';
        const type = section.type || 'Genre';
        const source = section.source || '';
        const itemLimit = section.itemLimit || 16;
        const sortOrder = section.sortOrder || 'Random';
        const sortOrderDirection = section.sortOrderDirection || 'Ascending';
        const cardFormat = section.cardFormat || 'Poster';
        const order = section.order || 100;
        const spotlightEnabled = section.spotlight === true;
        const renderMode = section.renderMode || (spotlightEnabled ? 'Spotlight' : 'Normal');
        const discoveryEnabled = section.discoveryEnabled === true;
        const searchTerm = section.searchTerm || '';
        const includeItemTypes = Array.isArray(section.includeItemTypes) ? section.includeItemTypes : (section.includeItemTypes ? section.includeItemTypes.split(',').map(s => s.trim()).filter(Boolean) : (type === 'Parent' ? [] : ['Movie']));
        const additionalQueryOptions = section.additionalQueryOptions || [];
        
        // Determine source field based on type
        let sourceFieldHtml = '';
        if (type === 'Parent') {
            // Parent type uses simple text input for parent IDs (comma-separated)
            const parentIds = source || '';
            sourceFieldHtml = `
                <div class="${prefix}_section_source_container" data-section-index="${sectionIndex}" style="border: 1px solid rgba(255,255,255,0.1); border-radius: 4px; padding: 0.75em; position: static;">
                    <div style="position: relative;">
                        <div class="listItemBodyText" style="margin-bottom: 0.5em;">Parent IDs (comma-separated, leave empty for "Any")</div>
                        <input type="text" class="${prefix}_section_source fld emby-input" data-section-index="${sectionIndex}" data-prefix="${prefix}" data-type="${type}" value="${parentIds}" placeholder="Enter parent IDs (e.g., collection-id, playlist-id) or leave empty" style="width: 100%;">
                        <input type="hidden" class="${prefix}_section_source_hidden" data-section-index="${sectionIndex}" value="${parentIds}">
                    </div>
                </div>
            `;
        } else if (type === 'Tag' || type === 'Genre' || type === 'Collection' || type === 'Playlist') {
            // Parse existing source (comma-separated) into array
            const sourceArray = source ? source.split(',').map(s => s.trim()).filter(Boolean) : [];
            
            // For Collections/Playlists, we'll show IDs initially and load names after
            // For Tags/Genres, show names directly
            let badgesHtml = '';
            if (type === 'Tag' || type === 'Genre') {
                badgesHtml = sourceArray.map(val => `
                    <span class="tag-badge" data-value="${val}" style="display: inline-flex; align-items: center; gap: 0.25em; background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.2); border-radius: 4px; padding: 0.25em 0.5em; margin: 0.25em; font-size: 0.9em;">
                        ${val}
                        <button type="button" class="tag-badge-remove" style="background: none; border: none; color: rgba(255,255,255,0.7); cursor: pointer; padding: 0; margin-left: 0.25em; font-size: 1.2em; line-height: 1; display: flex; align-items: center;" title="Remove">×</button>
                    </span>
                `).join('');
            } else {
                // Collections/Playlists: display IDs initially, will be replaced with names after fetch
                badgesHtml = sourceArray.map(id => `
                    <span class="tag-badge" data-value="${id}" data-loading="true" style="display: inline-flex; align-items: center; gap: 0.25em; background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.2); border-radius: 4px; padding: 0.25em 0.5em; margin: 0.25em; font-size: 0.9em;">
                        ${id}
                        <button type="button" class="tag-badge-remove" style="background: none; border: none; color: rgba(255,255,255,0.7); cursor: pointer; padding: 0; margin-left: 0.25em; font-size: 1.2em; line-height: 1; display: flex; align-items: center;" title="Remove">×</button>
                    </span>
                `).join('');
            }
            
            sourceFieldHtml = `
                <div class="${prefix}_section_source_container" data-section-index="${sectionIndex}" style="border: 1px solid rgba(255,255,255,0.1); border-radius: 4px; padding: 0.75em; position: static;">
                    <div style="position: relative;">
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5em;">
                            <div class="listItemBodyText">${type}</div>
                            <button type="button" class="badge-clear-all" data-section-index="${sectionIndex}" style="background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.2); border-radius: 4px; padding: 0.25em 0.5em; color: rgba(255,255,255,0.87); cursor: pointer; font-size: 0.85em;" title="Clear All">Clear All</button>
                        </div>
                        <div class="tag-badge-container" data-section-index="${sectionIndex}" data-prefix="${prefix}" data-type="${type}" style="min-height: 2.5em; border: 1px solid rgba(255,255,255,0.2); border-radius: 4px; padding: 0.5em; margin-bottom: 0.5em; background: rgba(0,0,0,0.2); display: flex; gap: 0.5em; align-items: flex-start; overflow: hidden;">
                            <input type="text" class="${prefix}_section_source fld emby-input autocomplete-input" data-section-index="${sectionIndex}" data-prefix="${prefix}" data-type="${type}" placeholder="Type to add ${type.toLowerCase()}..." autocomplete="off" style="flex: 0 0 auto; width: 120px; min-width: 200px; max-width: 120px; border: none; background: transparent; outline: none; color: rgba(255,255,255,0.87); padding: 0.25em;">
                            <div style="flex: 1; min-width: 0; display: flex; flex-wrap: wrap; gap: 0.25em; align-items: flex-start; overflow-wrap: break-word;">
                                ${badgesHtml}
                            </div>
                        </div>
                        <input type="hidden" class="${prefix}_section_source_hidden" data-section-index="${sectionIndex}" value="${source}">
                        <div class="autocomplete-suggestions" data-section-index="${sectionIndex}" style="display: none; position: absolute; z-index: 10000; background: #1a1a1a !important; color: rgba(255,255,255,0.87) !important; border: 1px solid rgba(255,255,255,0.2); border-radius: 4px; max-height: 200px; overflow-y: auto; margin-top: 2px; width: 100%; box-sizing: border-box; opacity: 1 !important; top: 100%; left: 0;"></div>
                    </div>
                </div>
            `;
        }
        
        // Build section fields HTML for right column
        const sanitizedSectionPrefix = `${prefix}_section_${sectionIndex.toString().replace(/[^a-zA-Z0-9]/g, '_')}`;
        const spotlightCheckboxId = `${sanitizedSectionPrefix}_spotlight`;
        const discoveryCheckboxId = `${sanitizedSectionPrefix}_discovery`;
        const sectionFieldsHtml = createSectionConfiguration(
            sanitizedSectionPrefix,
            section,
            {
                includeName: true,
                defaultName: name || 'Unnamed Section',
                nameInputAttributes: {
                    class: `${prefix}_section_name`,
                    'data-section-index': sectionIndex,
                    'data-prefix': prefix
                }
            }
        );
        
        // For custom sections and seasonal nested sections, use the improved layout
        const useImprovedLayout = prefix === 'customSection' || isSeasonalNested;
        
        // Build section content - improved layout for custom sections and seasonal nested sections
        let sectionContent;
        if (useImprovedLayout) {
            // Custom sections: Row 1 (checkboxes + type), Row 2 (source), Row 3+ (remaining fields in 3 columns)
            sectionContent = `
                <!-- Row 1: Enabled, Render Mode, Discovery, Type -->
                <div class="listItem" style="display: grid; grid-template-columns: auto auto auto 1fr; gap: 1em; align-items: end; margin: 0.75em 0; border: 1px solid rgba(255,255,255,0.1); border-radius: 4px; padding: 0.75em;">
                    <div>
                        <div class="listItemBodyText secondary" style="font-size: 0.85em; margin-bottom: 0.25em;">Enabled</div>
                        ${buildJellyfinCheckbox(`${prefix}_section_enabled_${sectionIndex}`, enabled, '', { 'data-section-index': sectionIndex, 'data-prefix': prefix, 'class': `${prefix}_section_enabled` })}
                    </div>
                    <div>
                        <div class="listItemBodyText secondary" style="font-size: 0.85em; margin-bottom: 0.25em;">Render Mode</div>
                        <select class="${prefix}_section_renderMode fld emby-select-withcolor emby-select" data-section-index="${sectionIndex}" data-prefix="${prefix}" style="width: 100%;">
                            <option value="Normal" ${renderMode === 'Normal' ? 'selected' : ''}>Normal</option>
                            <option value="Spotlight" ${renderMode === 'Spotlight' ? 'selected' : ''}>Spotlight</option>
                            <option value="Random" ${renderMode === 'Random' ? 'selected' : ''}>Random</option>
                        </select>
                    </div>
                    <div>
                        <div class="listItemBodyText secondary" style="font-size: 0.85em; margin-bottom: 0.25em;">Discovery</div>
                        ${buildJellyfinCheckbox(discoveryCheckboxId, discoveryEnabled, 'Enable as Discovery', { 'data-section-index': sectionIndex, 'data-prefix': prefix, 'class': `${prefix}_section_discovery` })}
                    </div>
                    <div>
                        <div class="listItemBodyText secondary" style="font-size: 0.85em; margin-bottom: 0.25em;">Type</div>
                        <select class="${prefix}_section_type fld emby-select-withcolor emby-select" data-section-index="${sectionIndex}" data-prefix="${prefix}" data-is-seasonal="${isSeasonalNested}" style="width: 100%;">
                            <option value="Tag" ${type === 'Tag' ? 'selected' : ''}>Tag</option>
                            <option value="Genre" ${type === 'Genre' ? 'selected' : ''}>Genre</option>
                            <option value="Playlist" ${type === 'Playlist' ? 'selected' : ''}>Playlist</option>
                            <option value="Collection" ${type === 'Collection' ? 'selected' : ''}>Collection</option>
                            <option value="Parent" ${type === 'Parent' ? 'selected' : ''}>Generic Query</option>
                        </select>
                    </div>
                </div>
                <!-- Row 2: Source picker (full width) -->
                <div style="margin-bottom: 0.75em;">
                    ${sourceFieldHtml}
                </div>
                <!-- Row 3+: Remaining fields in 3 columns -->
                <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 0.75em;">
                    ${sectionFieldsHtml}
                    <!-- Search Term field -->
                    <div class="listItem" style="border: 1px solid rgba(255,255,255,0.1); border-radius: 4px; padding: 0.75em;">
                        <div class="listItemContent">
                            <div class="listItemBodyText" style="margin-bottom: 0.5em;">Search Term</div>
                            <input type="text" id="${sanitizedSectionPrefix}_searchTerm" class="fld emby-input" value="${searchTerm}" placeholder="Optional search filter" style="width: 100%;">
                        </div>
                    </div>
                    <!-- Include Item Types field -->
                    ${buildIncludeItemTypesField(prefix, sectionIndex, sanitizedSectionPrefix, includeItemTypes, type)}
                    
                    <!-- Additional Options Controls -->
                    ${buildAdditionalOptionsControls(prefix, sectionIndex, sanitizedSectionPrefix)}
                </div>
                
                <!-- Additional Options List -->
                ${buildAdditionalOptionsList(prefix, sectionIndex, sanitizedSectionPrefix, additionalQueryOptions)}
            `;
        }
        
        // Wrap sections in collapsible details for both custom sections and seasonal nested sections
        if (useImprovedLayout) {
            // Determine summary class and name class based on prefix
            const summaryClass = prefix === 'customSection' ? 'custom-section-summary' : 'seasonal-section-summary';
            const nameClass = prefix === 'customSection' ? 'custom-section-name' : 'seasonal-section-name';
            const enabledClass = prefix === 'customSection' ? 'custom-section-enabled-display' : 'seasonal-section-enabled-display';
            const orderClass = prefix === 'customSection' ? 'custom-section-order' : 'seasonal-section-order';
            const showPreviewButton = prefix === 'customSection' || prefix === 'seasonal_season';
            const previewButtonHtml = showPreviewButton
                ? `<button class="emby-button preview-section-btn" data-prefix="${prefix}" data-section-index="${sectionIndex}" style="padding: 0.5em 1em; font-size: 0.9em; background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.2);">Preview</button>`
                : '';
            
            return `
                <details class="${prefix}_section_item" data-section-index="${sectionIndex}" data-section-id="${sectionId}" style="border: 1px solid rgba(255,255,255,0.15); border-radius: 4px; padding: 0; margin-bottom: 0.75em; background: rgba(255,255,255,0.03);">
                    <summary class="${summaryClass}" data-section-index="${sectionIndex}" style="display: flex; justify-content: space-between; align-items: center; padding: 1em; cursor: pointer; list-style: none; user-select: none;">
                        <div class="listItemBodyText" style="font-weight: 500; display: flex; align-items: center; gap: 0.5em;">
                            <span class="material-icons" style="font-size: 1.2em; transition: transform 0.2s;">chevron_right</span>
                        <span class="${nameClass}" data-section-index="${sectionIndex}">${name || 'Unnamed Section'}</span>
                        <span class="listItemBodyText secondary" style="font-size: 0.9em; font-weight: normal;">(<span class="${enabledClass}" data-section-index="${sectionIndex}">${enabled ? 'Enabled' : 'Disabled'}</span>, Order: <span class="${orderClass}" data-section-index="${sectionIndex}">${order}</span>)</span>
                        </div>
                        <div style="display: flex; gap: 0.5em;">
                            ${previewButtonHtml}
                            <button class="emby-button delete-section-btn" data-prefix="${prefix}" data-section-index="${sectionIndex}" data-is-seasonal="${isSeasonalNested}" style="padding: 0.5em 1em; font-size: 0.9em; background: rgba(255,0,0,0.2);">Delete</button>
                        </div>
                    </summary>
                    <div style="padding: 0 1em 1em 1em; border-top: 1px solid rgba(255,255,255,0.1); margin-top: 0;">
                        ${sectionContent}
                    </div>
                </details>
            `;
        } else {
            // Fallback for any other section types (shouldn't happen in current code)
            const showPreviewButton = prefix === 'customSection' || prefix === 'seasonal_season';
            const previewButtonHtml = showPreviewButton
                ? `<button class="emby-button preview-section-btn" data-prefix="${prefix}" data-section-index="${sectionIndex}" style="padding: 0.5em 1em; font-size: 0.9em; background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.2);">Preview</button>`
                : '';
            return `
                <div class="${prefix}_section_item" data-section-index="${sectionIndex}" data-section-id="${sectionId}" style="border: 1px solid rgba(255,255,255,0.15); border-radius: 4px; padding: 1em; margin-bottom: 0.75em; background: rgba(255,255,255,0.03);">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.75em;">
                        <div class="listItemBodyText" style="font-weight: 500;">${name || 'Unnamed Section'}</div>
                        <div style="display: flex; gap: 0.5em;">
                            ${previewButtonHtml}
                            <button class="emby-button delete-section-btn" data-prefix="${prefix}" data-section-index="${sectionIndex}" data-is-seasonal="${isSeasonalNested}" style="padding: 0.5em 1em; font-size: 0.9em; background: rgba(255,0,0,0.2);">Delete</button>
                        </div>
                    </div>
                    ${sectionContent}
                </div>
            `;
        }
    }

    function mergeAttributes(defaultAttrs = {}, customAttrs = {}) {
        const merged = { ...defaultAttrs };
        if (customAttrs && typeof customAttrs === 'object') {
            Object.entries(customAttrs).forEach(([key, value]) => {
                if (value === undefined || value === null) {
                    return;
                }
                if (key === 'class' && merged.class) {
                    merged.class = `${merged.class} ${value}`.trim();
                } else {
                    merged[key] = value;
                }
            });
        }
        return merged;
    }

    function attributesToString(attrs = {}) {
        return Object.entries(attrs)
            .map(([key, value]) => {
                if (value === undefined || value === null) return '';
                return `${key}="${value}"`;
            })
            .filter(Boolean)
            .join(' ');
    }

    function parseNumberOrFallback(value, fallback) {
        if (value === null || value === undefined || value === '') {
            return fallback;
        }
        const parsed = parseInt(value, 10);
        return Number.isFinite(parsed) ? parsed : fallback;
    }

    function normalizeDiscoverySectionConfigEntry(rawValue, definition, discovery, legacyName = '') {
        const defaultItemLimit = discovery.defaultItemLimit ?? 16;
        const defaultSortOrder = discovery.defaultSortOrder ?? 'Random';
        const defaultCardFormat = discovery.defaultCardFormat ?? 'Poster';
        const defaults = {
            enabled: true,
            name: legacyName || definition.defaultName || '',
            itemLimit: defaultItemLimit,
            sortOrder: defaultSortOrder,
            sortOrderDirection: 'Ascending',
            cardFormat: defaultCardFormat
        };

        if (definition.extras?.minimumItems !== undefined) {
            defaults.minimumItems = definition.extras.minimumItems;
        }

        let normalized = { ...defaults };

        if (rawValue === false) {
            normalized.enabled = false;
        } else if (rawValue && typeof rawValue === 'object') {
            normalized = { ...normalized, ...rawValue };
        } else if (rawValue === true) {
            normalized.enabled = true;
        }

        normalized.itemLimit = parseNumberOrFallback(normalized.itemLimit, defaultItemLimit);
        normalized.sortOrder = normalized.sortOrder || defaultSortOrder;
        normalized.sortOrderDirection = normalized.sortOrderDirection || 'Ascending';
        normalized.cardFormat = normalized.cardFormat || defaultCardFormat;
        normalized.name = normalized.name || definition.defaultName || '';

        if (definition.extras?.minimumItems !== undefined) {
            normalized.minimumItems = parseNumberOrFallback(
                normalized.minimumItems,
                definition.extras.minimumItems
            );
        }

        return normalized;
    }

    function getNormalizedDiscoverySectionConfigs(discovery = {}) {
        const sectionTypes = discovery.sectionTypes || {};
        const legacyNames = discovery.sectionNames || {};
        const normalized = {};

        DISCOVERY_SECTION_DEFINITIONS.forEach(def => {
            normalized[def.key] = normalizeDiscoverySectionConfigEntry(
                sectionTypes[def.key],
                def,
                discovery,
                legacyNames[def.key]
            );
        });

        return normalized;
    }

    // Helper function to build section configuration fields (Name, Item Limit, Sort Order, Card Format, Order)
    function createSectionConfiguration(prefix, config = {}, options = {}) {
        const {
            includeSortOrder = true,
            includeOrder = true,
            includeName = true,
            defaultName = '',
            nameLabel = 'Section Name',
            nameInputAttributes = {},
            includeCardFormat = true,
            includeItemLimit = true,
            includeIsPlayed = false,
            includePremiereDays = false
        } = options;

        const nameValue = config.name ?? defaultName ?? '';
        const itemLimit = config.itemLimit ?? options.defaultItemLimit ?? 16;
        const sortOrder = config.sortOrder ?? 'Random';
        const sortOrderDirection = config.sortOrderDirection ?? 'Ascending';
        const cardFormat = config.cardFormat ?? options.defaultCardFormat ?? 'Poster';
        const order = config.order ?? options.defaultOrder ?? 100;
        
        // IsPlayed logic
        // If isPlayed is undefined or null, it means the filter is disabled.
        // If it's true/false, the filter is enabled and set to that value.
        const isPlayedFilterEnabled = config.isPlayed !== undefined && config.isPlayed !== null;
        const isPlayedValue = config.isPlayed === true; // true if played, false if unplayed

        let html = '';

        if (includeName) {
            const nameAttrs = mergeAttributes(
                { id: `${prefix}_name`, class: 'fld emby-input' },
                nameInputAttributes
            );
            html += `
            <div class="listItem" style="border: 1px solid rgba(255,255,255,0.1); border-radius: 4px; padding: 0.75em;">
                <div class="listItemContent">
                    <div class="listItemBodyText" style="margin-bottom: 0.5em;">${nameLabel}</div>
                    <input type="text" ${attributesToString(nameAttrs)} value="${nameValue}" placeholder="${defaultName || ''}" style="width: 100%; max-width: 250px;">
                </div>
            </div>`;
        }

        if (includeCardFormat) {
            html += `
            <div class="listItem" style="border: 1px solid rgba(255,255,255,0.1); border-radius: 4px; padding: 0.75em;">
                <div class="listItemContent">
                    <div class="listItemBodyText" style="margin-bottom: 0.5em;">Card Format</div>
                    <select id="${prefix}_cardFormat" class="fld emby-select-withcolor emby-select" style="width: 100%; max-width: 200px;">
                        <option value="Random" ${cardFormat === 'Random' ? 'selected' : ''}>Random</option>
                        <option value="Backdrop" ${cardFormat === 'Backdrop' ? 'selected' : ''}>Backdrop</option>
                        <option value="Thumb" ${cardFormat === 'Thumb' ? 'selected' : ''}>Thumb</option>
                        <option value="Poster" ${cardFormat === 'Poster' ? 'selected' : ''}>Poster</option>
                    </select>
                </div>
            </div>`;
        }

        if (includeSortOrder) {
            html += `
            <div class="listItem" style="border: 1px solid rgba(255,255,255,0.1); border-radius: 4px; padding: 0.75em;">
                <div class="listItemContent">
                    <div class="listItemBodyText" style="margin-bottom: 0.5em;">Sort Order</div>
                    <select id="${prefix}_sortOrder" class="fld emby-select-withcolor emby-select" style="width: 100%; max-width: 200px;">
                        <option value="Random" ${sortOrder === 'Random' ? 'selected' : ''}>Random</option>
                        <option value="PremiereDate" ${sortOrder === 'PremiereDate' ? 'selected' : ''}>Premiere Date</option>
                        <option value="DateCreated" ${sortOrder === 'DateCreated' ? 'selected' : ''}>Date Created</option>
                        <option value="DateAdded" ${sortOrder === 'DateAdded' ? 'selected' : ''}>Date Added</option>
                        <option value="SortName" ${sortOrder === 'SortName' ? 'selected' : ''}>Sort Name</option>
                        <option value="Name" ${sortOrder === 'Name' ? 'selected' : ''}>Name</option>
                        <option value="CommunityRating" ${sortOrder === 'CommunityRating' ? 'selected' : ''}>Community Rating</option>
                        <option value="CriticRating" ${sortOrder === 'CriticRating' ? 'selected' : ''}>Critic Rating</option>
                        <option value="OfficialRating" ${sortOrder === 'OfficialRating' ? 'selected' : ''}>Official Rating</option>
                        <option value="ProductionYear" ${sortOrder === 'ProductionYear' ? 'selected' : ''}>Production Year</option>
                        <option value="PlayCount" ${sortOrder === 'PlayCount' ? 'selected' : ''}>Play Count</option>
                        <option value="Runtime" ${sortOrder === 'Runtime' ? 'selected' : ''}>Runtime</option>
                        <option value="Default" ${sortOrder === 'Default' ? 'selected' : ''}>Default</option>
                        <option value="AiredEpisodeOrder" ${sortOrder === 'AiredEpisodeOrder' ? 'selected' : ''}>Aired Episode Order</option>
                        <option value="DatePlayed" ${sortOrder === 'DatePlayed' ? 'selected' : ''}>Date Played</option>
                        <option value="StartDate" ${sortOrder === 'StartDate' ? 'selected' : ''}>Start Date</option>
                        <option value="IsFolder" ${sortOrder === 'IsFolder' ? 'selected' : ''}>Is Folder</option>
                        <option value="IsUnplayed" ${sortOrder === 'IsUnplayed' ? 'selected' : ''}>Is Unplayed</option>
                        <option value="IsPlayed" ${sortOrder === 'IsPlayed' ? 'selected' : ''}>Is Played</option>
                        <option value="SeriesSortName" ${sortOrder === 'SeriesSortName' ? 'selected' : ''}>Series Sort Name</option>
                        <option value="AirTime" ${sortOrder === 'AirTime' ? 'selected' : ''}>Air Time</option>
                        <option value="Studio" ${sortOrder === 'Studio' ? 'selected' : ''}>Studio</option>
                        <option value="IsFavoriteOrLiked" ${sortOrder === 'IsFavoriteOrLiked' ? 'selected' : ''}>Is Favorite Or Liked</option>
                        <option value="ParentIndexNumber" ${sortOrder === 'ParentIndexNumber' ? 'selected' : ''}>Parent Index Number</option>
                        <option value="IndexNumber" ${sortOrder === 'IndexNumber' ? 'selected' : ''}>Index Number</option>
                    </select>
                </div>
            </div>
            <div class="listItem" style="border: 1px solid rgba(255,255,255,0.1); border-radius: 4px; padding: 0.75em;">
                <div class="listItemContent">
                    <div class="listItemBodyText" style="margin-bottom: 0.5em;">Sort Order Direction</div>
                    <select id="${prefix}_sortOrderDirection" class="fld emby-select-withcolor emby-select" style="width: 100%; max-width: 200px;">
                        <option value="Ascending" ${sortOrderDirection === 'Ascending' ? 'selected' : ''}>Ascending</option>
                        <option value="Descending" ${sortOrderDirection === 'Descending' ? 'selected' : ''}>Descending</option>
                    </select>
                </div>
            </div>`;
        }

        if (includeOrder) {
            html += `
            <div class="listItem" style="border: 1px solid rgba(255,255,255,0.1); border-radius: 4px; padding: 0.75em;">
                <div class="listItemContent">
                    <div class="listItemBodyText" style="margin-bottom: 0.5em; display: flex; align-items: center; gap: 0.4em; overflow: visible;">
                        <span>Order</span>
                        <span class="material-icons info info-tooltip" tabindex="0" role="note" data-tooltip="Lower numbers appear first" aria-label="Lower numbers appear first"></span>
                    </div>
                    <input type="number" id="${prefix}_order" class="fld emby-input" value="${order}" min="0" style="width: 100%; max-width: 200px;">
                </div>
            </div>`;
        }

        if (includeItemLimit) {
            html += `
                <div class="listItem" style="border: 1px solid rgba(255,255,255,0.1); border-radius: 4px; padding: 0.75em;">
                    <div class="listItemContent">
                        <div class="listItemBodyText" style="margin-bottom: 0.5em;">Item Limit</div>
                        <input type="number" id="${prefix}_itemLimit" class="fld emby-input" value="${itemLimit}" min="1" style="width: 100%; max-width: 200px;">
                    </div>
                </div>`;
        }

        if (includePremiereDays) {
            const minAgeInDays = config.minAgeInDays ?? 0;
            const maxAgeInDays = config.maxAgeInDays ?? 30;
            html += `                
                <div class="listItem" style="border: 1px solid rgba(255,255,255,0.1); border-radius: 4px; padding: 0.75em;">
                    <div class="listItemContent">
                        <div class="listItemBodyText" style="margin-bottom: 0.5em;">Minimum Age (Days)</div>
                        <input type="number" id="${prefix}_minAgeInDays" class="fld emby-input" value="${minAgeInDays}" style="width: 100%;">
                        <div class="fieldDescription" style="margin-top: 0.25em;">Optional. Days since release (e.g. 0 for today).</div>
                    </div>
                </div>
                <div class="listItem" style="border: 1px solid rgba(255,255,255,0.1); border-radius: 4px; padding: 0.75em;">
                    <div class="listItemContent">
                        <div class="listItemBodyText" style="margin-bottom: 0.5em;">Maximum Age (Days)</div>
                        <input type="number" id="${prefix}_maxAgeInDays" class="fld emby-input" value="${maxAgeInDays}" style="width: 100%;">
                        <div class="fieldDescription" style="margin-top: 0.25em;">Optional. Max days old (e.g. 30).</div>
                    </div>
                </div>`;
        }

        if (includeIsPlayed) {
            html += `
            <div class="listItem" style="border: 1px solid rgba(255,255,255,0.1); border-radius: 4px; padding: 0.75em;">
                <div class="listItemContent">
                    ${buildJellyfinCheckbox(`${prefix}_isPlayed_enabled`, isPlayedFilterEnabled, 'Filter by Played Status')}
                    
                    <div id="${prefix}_isPlayed_options" style="margin-top: 0.5em; margin-left: 1.5em; display: ${isPlayedFilterEnabled ? 'block' : 'none'};">
                        <select id="${prefix}_isPlayed_value" class="fld emby-select-withcolor emby-select" style="width: 100%; max-width: 200px;">
                            <option value="false" ${!isPlayedValue ? 'selected' : ''}>Unplayed</option>
                            <option value="true" ${isPlayedValue ? 'selected' : ''}>Played</option>
                        </select>
                    </div>
                </div>
            </div>`;
        }

        return html;
    }

    // Build home screen configuration
    function buildHomeScreenConfig(homeScreen, libraries = []) {
        const recentlyReleased = homeScreen.recentlyReleased || {};
        const recentlyAddedInLibrary = homeScreen.recentlyAddedInLibrary || {};
        const trending = homeScreen.trending || {};
        const popularTVNetworks = homeScreen.popularTVNetworks || {};
        const watchlist = homeScreen.watchlist || {};
        const upcoming = homeScreen.upcoming || {};
        const imdbTop250 = homeScreen.imdbTop250 || {};
        const seasonal = homeScreen.seasonal || {};
        const watchAgain = homeScreen.watchAgain || {};
        const discovery = homeScreen.discovery || {};
        const customSections = homeScreen.customSections || [];
        const normalizedDiscoverySections = getNormalizedDiscoverySectionConfigs(discovery);
        
        // Build seasonal sections HTML
        const seasonalSectionsHtml = (seasonal.seasons || []).map((season, seasonIndex) => {
            const sections = season.sections || [];
            const sectionsHtml = sections.map((section, sectionIndex) => {
                return buildSectionUI('seasonal_season', section, `${seasonIndex}_${sectionIndex}`, true);
            }).join('');
        
        const seasonOrder = season.order || 100;
        return `
            <details class="seasonal-season-item" data-season-index="${seasonIndex}" style="border: 1px solid rgba(255,255,255,0.2); border-radius: 4px; padding: 0; margin-bottom: 1em; background: rgba(255,255,255,0.02);">
                <summary class="seasonal-season-summary" data-season-index="${seasonIndex}" style="display: flex; justify-content: space-between; align-items: center; padding: 1em; cursor: pointer; list-style: none; user-select: none;">
                    <div class="listItemBodyText" style="font-weight: 500; display: flex; align-items: center; gap: 0.5em;">
                        <span class="material-icons" style="font-size: 1.2em; transition: transform 0.2s;">chevron_right</span>
                        <span class="seasonal-season-name-display" data-season-index="${seasonIndex}">${season.name || 'Unnamed Season'}</span>
                        <span class="listItemBodyText secondary" style="font-size: 0.9em; font-weight: normal;">(<span class="seasonal-season-enabled-display" data-season-index="${seasonIndex}">${season.enabled !== false ? 'Enabled' : 'Disabled'}</span>, Order: <span class="seasonal-season-order" data-season-index="${seasonIndex}">${seasonOrder}</span>)</span>
                    </div>
                    <div style="display: flex; gap: 0.5em;">
                        <button class="emby-button" onclick="deleteSeasonalSeason(${seasonIndex})" style="padding: 0.5em 1em; font-size: 0.9em; background: rgba(255,0,0,0.2);">Delete</button>
                    </div>
                </summary>
                <div style="padding: 0 1em 1em 1em; border-top: 1px solid rgba(255,255,255,0.1);">
                    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 0.75em; margin-bottom: 0.75em; margin-top: 0.75em;">
                        <div>
                            <div class="listItemBodyText secondary" style="font-size: 0.85em; margin-bottom: 0.25em;">Enabled</div>
                            ${buildJellyfinCheckbox(`seasonal-season-enabled-${seasonIndex}`, season.enabled !== false, 'Enabled', { 'data-index': seasonIndex, 'class': 'seasonal-season-enabled' })}
                        </div>
                        <div>
                            <div class="listItemBodyText secondary" style="font-size: 0.85em; margin-bottom: 0.25em;">Name</div>
                            <input type="text" class="seasonal-season-name fld emby-input" data-index="${seasonIndex}" value="${season.name || ''}" style="width: 100%;">
                        </div>
                        <div>
                            <div class="listItemBodyText secondary" style="font-size: 0.85em; margin-bottom: 0.25em;">Start Date (MM-DD)</div>
                            <input type="text" class="seasonal-season-startDate fld emby-input" data-index="${seasonIndex}" value="${season.startDate || ''}" placeholder="10-01" style="width: 100%;">
                        </div>
                        <div>
                            <div class="listItemBodyText secondary" style="font-size: 0.85em; margin-bottom: 0.25em;">End Date (MM-DD)</div>
                            <input type="text" class="seasonal-season-endDate fld emby-input" data-index="${seasonIndex}" value="${season.endDate || ''}" placeholder="10-31" style="width: 100%;">
                        </div>
                        <div>
                            <div class="listItemBodyText secondary" style="font-size: 0.85em; margin-bottom: 0.25em; display: flex; align-items: center; gap: 0.4em;">Order</div>
                            <input type="number" class="seasonal-season-order-input fld emby-input" data-index="${seasonIndex}" value="${seasonOrder}" min="0" style="width: 100%;">
                        </div>
                    </div>
                    <div style="margin-top: 0.75em; margin-bottom: 0.75em;">
                        <div class="listItemBodyText" style="font-weight: 500; margin-bottom: 0.5em;">Sections</div>
                        <div class="seasonal_season_sections_list" data-season-index="${seasonIndex}">
                            ${sectionsHtml}
                        </div>
                        <button type="button" class="emby-button raised add-section-to-seasonal-btn" data-season-index="${seasonIndex}" style="padding: 0.75em 1.5em; margin-top: 0.5em;">
                            <span>Add Section</span>
                        </button>
                    </div>
                </div>
            </details>`;
        }).join('');
        
        // Build library sections HTML for "Recently Added in Library"
        let recentlyAddedInLibraryHtml = '';
        if (libraries && libraries.length > 0) {
            recentlyAddedInLibraryHtml = libraries.map(library => {
                const libConfig = recentlyAddedInLibrary[library.Id] || {};
                const prefix = `homeScreen_recentlyAddedInLibrary_${library.Id}`;
                const defaultName = `Recently Added in ${library.Name}`;
                
                return `
                    <details class="listItem" style="display: grid; border: 1px solid rgba(255,255,255,0.1); border-radius: 4px; padding: 0; gap: 0.5em;">
                        <summary class="recently-released-subsection-summary" style="display: flex; justify-content: space-between; align-items: center; padding: 0.75em; cursor: pointer; list-style: none; user-select: none;">
                            <div class="listItemBodyText" style="font-weight: 500; display: flex; align-items: center; gap: 0.5em;">
                                <span class="material-icons" style="font-size: 1.2em; transition: transform 0.2s;">chevron_right</span>
                                <span>${library.Name}</span>
                                <span class="listItemBodyText secondary" style="font-size: 0.9em; font-weight: normal;">(<span class="${prefix}_enabled_display">${libConfig.enabled !== false ? 'Enabled' : 'Disabled'}</span>, Order: <span class="${prefix}_order_display">${libConfig.order || 11}</span>)</span>
                            </div>
                        </summary>
                        <div style="padding: 0 0.75em 0.75em 0.75em; border-top: 1px solid rgba(255,255,255,0.1);">
                            <div style="margin-top: 0.75em; margin-bottom: 0.75em;">
                                ${buildJellyfinCheckbox(`${prefix}_enabled`, libConfig.enabled !== false, 'Enabled', { 'data-library-id': library.Id, 'class': 'recently-added-library-enabled' })}
                            </div>
                            <div class="listItemContent" style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 0.75em;">
                                ${createSectionConfiguration(prefix, libConfig, { 
                                    includeName: true, 
                                    defaultName: defaultName, 
                                    includeSortOrder: false, 
                                    includeOrder: true, 
                                    defaultOrder: 11,
                                    includeItemLimit: true,
                                    defaultItemLimit: 30,
                                    defaultCardFormat: library.CollectionType === 'tvshows' ? 'Thumb' : 'Poster'
                                })}
                            </div>
                        </div>
                    </details>
                `;
            }).join('');
        }

        // Check for orphaned sections (configured but library no longer exists)
        const activeLibraryIds = libraries.map(l => l.Id);
        const configuredLibraryIds = Object.keys(recentlyAddedInLibrary);
        const orphanedLibraryIds = configuredLibraryIds.filter(id => !activeLibraryIds.includes(id));
        
        if (orphanedLibraryIds.length > 0) {
            recentlyAddedInLibraryHtml += orphanedLibraryIds.map(id => {
                const libConfig = recentlyAddedInLibrary[id];
                const prefix = `homeScreen_recentlyAddedInLibrary_${id}`;
                const name = libConfig.name || `Unknown Library (${id})`;
                
                return `
                    <details class="listItem recently-added-library-item" style="display: grid; border: 1px solid rgba(244, 67, 54, 0.3); border-radius: 4px; padding: 0; gap: 0.5em; background: rgba(244, 67, 54, 0.05);">
                        <summary class="recently-released-subsection-summary" style="display: flex; justify-content: space-between; align-items: center; padding: 0.75em; cursor: pointer; list-style: none; user-select: none;">
                            <div class="listItemBodyText" style="font-weight: 500; display: flex; align-items: center; gap: 0.5em; color: #ff8a80;">
                                <span class="material-icons" style="font-size: 1.2em; transition: transform 0.2s;">warning</span>
                                <span>${name}</span>
                                <span class="listItemBodyText secondary" style="font-size: 0.9em; font-weight: normal;">(Library Missing)</span>
                            </div>
                            <button type="button" class="emby-button" onclick="this.closest('.recently-added-library-item').remove()" style="padding: 0.5em; min-width: auto; background: rgba(244, 67, 54, 0.1);">
                                <span class="material-icons" style="font-size: 1.2em; color: #ff8a80;">delete</span>
                            </button>
                        </summary>
                        <div style="padding: 0 0.75em 0.75em 0.75em; border-top: 1px solid rgba(244, 67, 54, 0.1);">
                            <div style="margin-top: 0.75em; margin-bottom: 0.75em;">
                                <div class="listItemBodyText" style="color: #ff8a80; font-size: 0.9em; margin-bottom: 0.5em;">
                                    This library is no longer available. You should remove this section.
                                </div>
                                ${buildJellyfinCheckbox(`${prefix}_enabled`, false, 'Enabled', { 'data-library-id': id, 'class': 'recently-added-library-enabled', 'disabled': 'true' })}
                            </div>
                        </div>
                    </details>
                `;
            }).join('');
        }

        return `
            <!-- Recently Added in Library Sections -->
            ${(libraries && libraries.length > 0) || orphanedLibraryIds.length > 0 ? `
            <details style="border: 1px solid rgba(255,255,255,0.1); border-radius: 4px; padding: 0.75em; margin-bottom: 1em;">
                <summary class="listItemBodyText" style="font-weight: 500; cursor: pointer; margin-bottom: 0.5em; display: flex; align-items: center; gap: 0.5em; border-radius: 0px !important;">
                    <span class="material-icons" style="font-size: 1.2em; transition: transform 0.2s;">chevron_right</span>
                    Recently Added in Library Sections
                </summary>
                <div style="padding: 0.75em 0 0 0;">
                    <div id="homeScreen_recentlyAddedInLibrary_container">
                        <div style="display: grid; grid-template-columns: 1fr; gap: 0.75em; margin-bottom: 0.75em;">
                            ${recentlyAddedInLibraryHtml}
                        </div>
                    </div>
                </div>
            </details>
            ` : ''}

            <!-- Recently Released Sections -->
            <details style="border: 1px solid rgba(255,255,255,0.1); border-radius: 4px; padding: 0.75em; margin-bottom: 1em;">
                <summary class="listItemBodyText" style="font-weight: 500; cursor: pointer; margin-bottom: 0.5em; display: flex; align-items: center; gap: 0.5em; border-radius: 0px !important;">
                    ${buildJellyfinCheckbox('homeScreen_recentlyReleased_enabled', recentlyReleased.enabled !== false, 'Recently Released Sections')}
                </summary>
                <div style="padding: 0.75em 0 0 0;">
                    <div id="homeScreen_recentlyReleased_container">
                        <div style="display: grid; grid-template-columns: 1fr; gap: 0.75em; margin-bottom: 0.75em;">
                            <details class="listItem" style="display: grid; border: 1px solid rgba(255,255,255,0.1); border-radius: 4px; padding: 0; gap: 0.5em;">
                                <summary class="recently-released-subsection-summary" style="display: flex; justify-content: space-between; align-items: center; padding: 0.75em; cursor: pointer; list-style: none; user-select: none;">
                                    <div class="listItemBodyText" style="font-weight: 500; display: flex; align-items: center; gap: 0.5em;">
                                        <span class="material-icons" style="font-size: 1.2em; transition: transform 0.2s;">chevron_right</span>
                                        <span>Recently Released Movies</span>
                                        <span class="listItemBodyText secondary" style="font-size: 0.9em; font-weight: normal;">(<span class="recently-released-movies-enabled">${(recentlyReleased.movies || {}).enabled !== false ? 'Enabled' : 'Disabled'}</span>, Order: <span class="recently-released-movies-order">${(recentlyReleased.movies || {}).order || 30}</span>)</span>
                                    </div>
                                </summary>
                                <div style="padding: 0 0.75em 0.75em 0.75em; border-top: 1px solid rgba(255,255,255,0.1);">
                                    <div style="margin-top: 0.75em; margin-bottom: 0.75em;">
                                        ${buildJellyfinCheckbox('homeScreen_recentlyReleased_movies_enabled', (recentlyReleased.movies || {}).enabled !== false, 'Enabled')}
                                    </div>
                                    <div class="listItemContent" style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 0.75em;">
                                        ${createSectionConfiguration('homeScreen_recentlyReleased_movies', recentlyReleased.movies || {}, { includeName: true, defaultName: 'Recently Released Movies', includeSortOrder: true, includeOrder: true, includeIsPlayed: true, includePremiereDays: true })}
                                    </div>
                                </div>
                            </details>
                            <details class="listItem" style="display: grid; border: 1px solid rgba(255,255,255,0.1); border-radius: 4px; padding: 0; gap: 0.5em;">
                                <summary class="recently-released-subsection-summary" style="display: flex; justify-content: space-between; align-items: center; padding: 0.75em; cursor: pointer; list-style: none; user-select: none;">
                                    <div class="listItemBodyText" style="font-weight: 500; display: flex; align-items: center; gap: 0.5em;">
                                        <span class="material-icons" style="font-size: 1.2em; transition: transform 0.2s;">chevron_right</span>
                                        <span>Recently Aired Episodes</span>
                                        <span class="listItemBodyText secondary" style="font-size: 0.9em; font-weight: normal;">(<span class="recently-released-episodes-enabled">${(recentlyReleased.episodes || {}).enabled !== false ? 'Enabled' : 'Disabled'}</span>, Order: <span class="recently-released-episodes-order">${(recentlyReleased.episodes || {}).order || 31}</span>)</span>
                                    </div>
                                </summary>
                                <div style="padding: 0 0.75em 0.75em 0.75em; border-top: 1px solid rgba(255,255,255,0.1);">
                                    <div style="margin-top: 0.75em; margin-bottom: 0.75em;">
                                        ${buildJellyfinCheckbox('homeScreen_recentlyReleased_episodes_enabled', (recentlyReleased.episodes || {}).enabled !== false, 'Enabled')}
                                    </div>
                                    <div class="listItemContent" style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 0.75em;">
                                        ${createSectionConfiguration('homeScreen_recentlyReleased_episodes', recentlyReleased.episodes || {}, { includeName: true, defaultName: 'Recently Aired Episodes', includeSortOrder: true, includeOrder: true, includeIsPlayed: true, includePremiereDays: true })}
                                    </div>
                                </div>
                            </details>
                        </div>
                    </div>
                </div>
            </details>
            
            <!-- Trending Sections -->
            <details style="border: 1px solid rgba(255,255,255,0.1); border-radius: 4px; padding: 0.75em; margin-bottom: 1em; display: none;">
                <summary class="listItemBodyText" style="font-weight: 500; cursor: pointer; margin-bottom: 0.5em; display: flex; align-items: center; gap: 0.5em; border-radius: 0px !important;">
                    ${buildJellyfinCheckbox('homeScreen_trending_enabled', trending.enabled === true, 'Trending Sections', { disabled: 'true' })}
                    <span class="listItemBodyText secondary" style="font-size: 0.9em; font-weight: normal; margin-left: auto;">(Order: <span class="home-section-order" data-prefix="homeScreen_trending">${trending.order || 100}</span>)</span>
                    <span class="listItemBodyText secondary" style="font-size: 0.85em; font-style: italic; opacity: 0.7;">Under development</span>
                </summary>
                <div style="padding: 0.75em 0 0 0;">
                    <div id="homeScreen_trending_container">
                        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 0.75em;">
                            ${createSectionConfiguration('homeScreen_trending', trending, { includeName: true, defaultName: 'Trending', includeIsPlayed: true })}
                        </div>
                    </div>
                </div>
            </details>
            
            <!-- Popular TV Networks Sections -->
            <details style="border: 1px solid rgba(255,255,255,0.1); border-radius: 4px; padding: 0.75em; margin-bottom: 1em;">
                <summary class="listItemBodyText" style="font-weight: 500; cursor: pointer; margin-bottom: 0.5em; display: flex; align-items: center; gap: 0.5em; border-radius: 0px !important;">
                    ${buildJellyfinCheckbox('homeScreen_popularTVNetworks_enabled', popularTVNetworks.enabled === true, 'Popular TV Networks Sections')}
                    <span class="listItemBodyText secondary" style="font-size: 0.9em; font-weight: normal; margin-left: auto;">(Order: <span class="home-section-order" data-prefix="homeScreen_popularTVNetworks">${popularTVNetworks.order || 100}</span>)</span>
                </summary>
                <div style="padding: 0.75em 0 0 0;">
                    <div id="homeScreen_popularTVNetworks_container">
                        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 0.75em;">
                            ${createSectionConfiguration('homeScreen_popularTVNetworks', popularTVNetworks, { includeName: true, defaultName: 'Popular TV Networks' })}
            <div class="listItem" style="border: 1px solid rgba(255,255,255,0.1); border-radius: 4px; padding: 0.75em;">
                <div class="listItemContent">
                                    <div class="listItemBodyText" style="margin-bottom: 0.5em;">Minimum Shows for Network to Appear</div>
                                    <input type="number" id="homeScreen_popularTVNetworks_minimumShowsForNetwork" class="fld emby-input" value="${popularTVNetworks.minimumShowsForNetwork || 5}" min="1" style="width: 100%; max-width: 200px;">
                </div>
            </div>
                </div>
            </div>
                </div>
            </details>
            
            <!-- Watchlist -->
            <details style="border: 1px solid rgba(255,255,255,0.1); border-radius: 4px; padding: 0.75em; margin-bottom: 1em;">
                <summary class="listItemBodyText" style="font-weight: 500; cursor: pointer; margin-bottom: 0.5em; display: flex; align-items: center; gap: 0.5em; border-radius: 0px !important;">
                    ${buildJellyfinCheckbox('homeScreen_watchlist_enabled', watchlist.enabled === true, 'Watchlist')}
                    <span class="listItemBodyText secondary" style="font-size: 0.9em; font-weight: normal; margin-left: auto;">(Order: <span class="home-section-order" data-prefix="homeScreen_watchlist">${watchlist.order || 100}</span>)</span>
                </summary>
                <div style="padding: 0.75em 0 0 0;">
                    <div id="homeScreen_watchlist_container">
                        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 0.75em;">
                            ${createSectionConfiguration('homeScreen_watchlist', watchlist, { includeName: true, defaultName: 'Watchlist' })}
                        </div>
                    </div>
                </div>
            </details>
            
            <!-- Upcoming -->
            <details style="border: 1px solid rgba(255,255,255,0.1); border-radius: 4px; padding: 0.75em; margin-bottom: 1em;">
                <summary class="listItemBodyText" style="font-weight: 500; cursor: pointer; margin-bottom: 0.5em; display: flex; align-items: center; gap: 0.5em; border-radius: 0px !important;">
                    ${buildJellyfinCheckbox('homeScreen_upcoming_enabled', upcoming.enabled !== false, 'Upcoming')}
                    <span class="listItemBodyText secondary" style="font-size: 0.9em; font-weight: normal; margin-left: auto;">(Order: <span class="home-section-order" data-prefix="homeScreen_upcoming">${upcoming.order || 100}</span>)</span>
                </summary>
                <div style="padding: 0.75em 0 0 0;">
                    <div id="homeScreen_upcoming_container">
                        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 0.75em;">
                            ${createSectionConfiguration('homeScreen_upcoming', upcoming, { includeName: true, defaultName: 'Upcoming', includeSortOrder: false })}
                        </div>
                    </div>
                </div>
            </details>
            
            <!-- IMDb Top 250 -->
            <details style="border: 1px solid rgba(255,255,255,0.1); border-radius: 4px; padding: 0.75em; margin-bottom: 1em;">
                <summary class="listItemBodyText" style="font-weight: 500; cursor: pointer; margin-bottom: 0.5em; display: flex; align-items: center; gap: 0.5em; border-radius: 0px !important;">
                    ${buildJellyfinCheckbox('homeScreen_imdbTop250_enabled', imdbTop250.enabled !== false, 'IMDb Top 250')}
                    <span class="listItemBodyText secondary" style="font-size: 0.9em; font-weight: normal; margin-left: auto;">(Order: <span class="home-section-order" data-prefix="homeScreen_imdbTop250">${imdbTop250.order || 100}</span>)</span>
                </summary>
                <div style="padding: 0.75em 0 0 0;">
                    <div id="homeScreen_imdbTop250_container">
                        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 0.75em;">
                            ${createSectionConfiguration('homeScreen_imdbTop250', imdbTop250, { includeName: true, defaultName: 'IMDb Top 250', includeIsPlayed: true })}
                        </div>
                    </div>
                </div>
            </details>
            
            <!-- Seasonal Sections -->
            <details style="border: 1px solid rgba(255,255,255,0.1); border-radius: 4px; padding: 0.75em; margin-bottom: 1em;">
                <summary class="listItemBodyText" style="font-weight: 500; cursor: pointer; margin-bottom: 0.5em; display: flex; align-items: center; gap: 0.5em; border-radius: 0px !important;">
                    ${buildJellyfinCheckbox('homeScreen_seasonal_enabled', seasonal.enabled !== false, 'Seasonal Sections')}
                </summary>
                <div style="padding: 0.75em 0 0 0;">
                    <div id="homeScreen_seasonal_container">
                            <div class="listItem" style="border: 1px solid rgba(255,255,255,0.1); border-radius: 4px; padding: 0.75em; margin-bottom: 1em;">
                                <div class="listItemContent">
                                    <div class="listItemBodyText" style="margin-bottom: 0.5em;">Enable Seasonal Animations</div>
                                    <div class="listItemBodyText secondary" style="margin-bottom: 0.75em; font-size: 0.9em;">Enable falling snow/leaves animations for seasonal themes</div>
                                    ${buildJellyfinCheckbox('homeScreen_seasonal_enableSeasonalAnimations', seasonal.enableSeasonalAnimations !== false, 'Enabled')}
                                </div>
                            </div>
                            <div class="listItem" style="border: 1px solid rgba(255,255,255,0.1); border-radius: 4px; padding: 0.75em; margin-bottom: 1em;">
                                <div class="listItemContent">
                                    <div class="listItemBodyText" style="margin-bottom: 0.5em;">Enable Christmas Background</div>
                                    <div class="listItemBodyText secondary" style="margin-bottom: 0.75em; font-size: 0.9em;">Enable the festive background image for the Christmas theme</div>
                                    ${buildJellyfinCheckbox('homeScreen_seasonal_enableSeasonalBackground', seasonal.enableSeasonalBackground !== false, 'Enabled')}
                                </div>
                            </div>
                        <div id="homeScreen_seasonal_seasons_list" style="margin-bottom: 1em;">
                            ${seasonalSectionsHtml}
                        </div>
                        <button class="emby-button raised" onclick="addNewSeasonalSeason()" style="padding: 0.75em 1.5em; margin-bottom: 1em;">
                            <span>Add New Season</span>
                        </button>
                    </div>
                </div>
            </details>
            
            <!-- Watch Again -->
            <details style="border: 1px solid rgba(255,255,255,0.1); border-radius: 4px; padding: 0.75em; margin-bottom: 1em;">
                <summary class="listItemBodyText" style="font-weight: 500; cursor: pointer; margin-bottom: 0.5em; display: flex; align-items: center; gap: 0.5em; border-radius: 0px !important;">
                    ${buildJellyfinCheckbox('homeScreen_watchAgain_enabled', watchAgain.enabled === true, 'Watch Again')}
                    <span class="listItemBodyText secondary" style="font-size: 0.9em; font-weight: normal; margin-left: auto;">(Order: <span class="home-section-order" data-prefix="homeScreen_watchAgain">${watchAgain.order || 100}</span>)</span>
                </summary>
                <div style="padding: 0.75em 0 0 0;">
                    <div id="homeScreen_watchAgain_container">
                        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 0.75em;">
                            ${createSectionConfiguration('homeScreen_watchAgain', watchAgain, { includeName: true, defaultName: 'Watch Again' })}
                        </div>
                    </div>
                </div>
            </details>
            
            <!-- Discovery Sections -->
            <details style="border: 1px solid rgba(255,255,255,0.1); border-radius: 4px; padding: 0.75em; margin-bottom: 1em;">
                <summary class="listItemBodyText" style="font-weight: 500; cursor: pointer; margin-bottom: 0.5em; display: flex; align-items: center; gap: 0.5em; border-radius: 0px !important;">
                    ${buildJellyfinCheckbox('homeScreen_discovery_enabled', discovery.enabled !== false, 'Discovery Sections')}
                </summary>
                <div style="padding: 0.75em 0 0 0;">
                    <div id="homeScreen_discovery_container">
                        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 0.75em; margin-bottom: 0.75em;">
            <div class="listItem" style="border: 1px solid rgba(255,255,255,0.1); border-radius: 4px; padding: 0.75em;">
                <div class="listItemContent">
                                    <div class="listItemBodyText" style="margin-bottom: 0.5em;">Infinite Scroll / Load More Button</div>
                                    ${buildJellyfinCheckbox('homeScreen_discovery_infiniteScroll', discovery.infiniteScroll !== false, 'Infinite Scroll')}
                </div>
            </div>
            <div class="listItem" style="border: 1px solid rgba(255,255,255,0.1); border-radius: 4px; padding: 0.75em;">
                <div class="listItemContent">
                                    <div class="listItemBodyText" style="margin-bottom: 0.5em;">Randomize Section Order</div>
                                    ${buildJellyfinCheckbox('homeScreen_discovery_randomizeOrder', discovery.randomizeOrder === true, 'Randomize Order')}
                </div>
            </div>
            <div class="listItem" style="border: 1px solid rgba(255,255,255,0.1); border-radius: 4px; padding: 0.75em;">
                <div class="listItemContent">
                                    <div class="listItemBodyText" style="margin-bottom: 0.5em;">Minimum Appearances for Top People</div>
                                    <input type="number" id="homeScreen_discovery_minPeopleAppearances" class="fld emby-input" value="${discovery.minPeopleAppearances || 10}" min="1" style="width: 100%; max-width: 200px;">
                </div>
            </div>
            <div class="listItem" style="border: 1px solid rgba(255,255,255,0.1); border-radius: 4px; padding: 0.75em;">
                <div class="listItemContent">
                                    <div class="listItemBodyText" style="margin-bottom: 0.5em;">Minimum Movie count for Genres</div>
                                    <input type="number" id="homeScreen_discovery_minGenreMovieCount" class="fld emby-input" value="${discovery.minGenreMovieCount || 50}" min="1" style="width: 100%; max-width: 200px;">
                </div>
            </div>
            <div class="listItem" style="border: 1px solid rgba(255,255,255,0.1); border-radius: 4px; padding: 0.75em;">
                <div class="listItemContent">
                                    <div class="listItemBodyText" style="margin-bottom: 0.5em;">Spotlight & Collection Spawn Chance</div>
                                    <input type="number" id="homeScreen_discovery_spotlightDiscoveryChance" class="fld emby-input" value="${discovery.spotlightDiscoveryChance ?? 0.5}" min="0" max="1" step="0.01" style="width: 100%; max-width: 200px;">
                                    <div class="listItemBodyText secondary" style="font-size: 0.85em; margin-top: 0.25em;">0.0 = never, 1.0 = always</div>
                </div>
            </div>
            <div class="listItem" style="border: 1px solid rgba(255,255,255,0.1); border-radius: 4px; padding: 0.75em; display: grid;">
                ${buildJellyfinCheckbox('homeScreen_discovery_renderSpotlightAboveMatching', discovery.renderSpotlightAboveMatching === true, 'Spotlight Grouping')}
                <div class="listItemBodyText secondary" style="font-size: 0.85em; margin-top: 0.25em; margin-left: 2em;">Render Spotlight discovery sections alongside the corresponding discovery section (e.g. Action Spotlight above Action Movies).</div>
            </div>
            ${createSectionConfiguration('homeScreen_discovery', discovery, { includeName: false, includeOrder: false, includeCardFormat: false, includeSortOrder: false, includeItemLimit: false })}
                        </div>
                        <div class="listItem" style="border: 1px solid rgba(255,255,255,0.1); border-radius: 4px; padding: 0.75em; margin-bottom: 0.75em;">
                            <div class="listItemContent">
                                <div class="listItemBodyText" style="margin-bottom: 0.25em; font-weight: 500;">Discovery Sections</div>
                                <div class="listItemBodyText secondary" style="font-size: 0.85em;">Section names support placeholders such as [Genre], [Director], [Writer], [Actor], [Movie], [Studio], [Collection Name]</div>
                                <div style="display: grid; gap: 0.75em; margin-top: 0.75em;">
                                    ${DISCOVERY_SECTION_DEFINITIONS.map(section => {
                                        const sectionConfig = normalizedDiscoverySections[section.key];
                                        const prefix = `homeScreen_discovery_sectionTypes_${section.key}`;
                                        const configHtml = createSectionConfiguration(prefix, sectionConfig, { includeName: true, includeOrder: true, includeSortOrder: false, defaultName: section.defaultName, includeIsPlayed: true });
                                        const extraFields = section.extras?.minimumItems !== undefined
                                            ? `
                                                <div class="listItem" style="border: 1px solid rgba(255,255,255,0.1); border-radius: 4px; padding: 0.75em;">
                                                    <div class="listItemContent">
                                                        <div class="listItemBodyText" style="margin-bottom: 0.5em;">Minimum Items</div>
                                                        <input type="number" id="${prefix}_minimumItems" class="fld emby-input" value="${sectionConfig.minimumItems ?? section.extras.minimumItems}" min="1" style="width: 100%; max-width: 200px;">
                                                    </div>
                                                </div>
                                            `
                                            : '';

                                        const discoveryOrder = sectionConfig.order || 100;
                                        return `
                                            <details class="discovery-section-type-item" data-section-key="${section.key}" style="border: 1px solid rgba(255,255,255,0.1); border-radius: 4px; padding: 0; margin-bottom: 0.75em; background: rgba(255,255,255,0.02);">
                                                <summary class="discovery-section-type-summary" data-section-key="${section.key}" style="display: flex; justify-content: space-between; align-items: center; padding: 0.75em; cursor: pointer; list-style: none; user-select: none;">
                                                    <div class="listItemBodyText" style="font-weight: 500; display: flex; align-items: center; gap: 0.5em;">
                                                        <span class="material-icons" style="font-size: 1.2em; transition: transform 0.2s;">chevron_right</span>
                                                        <span>${section.label}</span>
                                                        <span class="listItemBodyText secondary" style="font-size: 0.9em; font-weight: normal;">(<span class="discovery-section-type-enabled" data-section-key="${section.key}">${sectionConfig.enabled !== false ? 'Enabled' : 'Disabled'}</span>, Order: <span class="discovery-section-type-order" data-section-key="${section.key}">${discoveryOrder}</span>)</span>
                                                    </div>
                                                </summary>
                                                <div style="padding: 0 0.75em 0.75em 0.75em; border-top: 1px solid rgba(255,255,255,0.1);">
                                                    <div style="margin-top: 0.75em; margin-bottom: 0.75em;">
                                                        ${buildJellyfinCheckbox(`${prefix}_enabled`, sectionConfig.enabled !== false, 'Enabled')}
                                                    </div>
                                                    <div style="display: flex; gap: 0.5em;">
                                                        ${configHtml}
                                                        ${extraFields}
                                                    </div>
                                                </div>
                                            </details>
                                        `;
                                    }).join('')}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </details>
            
            <!-- Custom Sections -->
            <details style="border: 1px solid rgba(255,255,255,0.1); border-radius: 4px; padding: 0.75em; margin-bottom: 1em;">
                <summary class="listItemBodyText" style="font-weight: 500; cursor: pointer; margin-bottom: 0.5em;">Custom Sections</summary>
                <div style="padding: 0.75em 0 0 0;">
                    <div class="listItemBodyText" style="font-weight: 500; margin-bottom: 0.5em;">Sections</div>
                    <div id="customSections_list" style="margin-bottom: 1em;">
                        ${(customSections || []).map((section, index) => {
                            return buildSectionUI('customSection', section, index, false);
                        }).join('')}
                    </div>
                    <button type="button" class="emby-button raised add-custom-section-btn" style="padding: 0.75em 1.5em; margin-bottom: 1em;">
                        <span>Add Section</span>
                    </button>
            </div>
            </details>
        `;
    }

    // Build exclusive elsewhere configuration
    function buildExclusiveElsewhereConfig(exclusiveElsewhere) {
        return `
            <div class="listItem" style="border: 1px solid rgba(255,255,255,0.1); border-radius: 4px; padding: 0.75em;">
                <div class="listItemContent">
                    <div class="listItemBodyText" style="margin-bottom: 0.5em;">Hide Server Name</div>
                    <div class="listItemBodyText secondary" style="margin-bottom: 0.75em; font-size: 0.9em;">Set to true to hide server name, useful when you want to only show a logo or icon via CSS</div>
                    ${buildJellyfinCheckbox('exclusiveElsewhere_hideServerName', exclusiveElsewhere.hideServerName === true, 'Enabled')}
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
                    ${buildJellyfinCheckbox('search_enableJellyseerr', search.enableJellyseerr === true, 'Enabled')}
                </div>
            </div>
        `;
    }

    // Build flatten shows configuration
    function buildFlattenShowsConfig(flattenShows) {
        const hideSingleSeasonContainer = flattenShows?.hideSingleSeasonContainer === true;
        return `
            <div class="listItem" style="border: 1px solid rgba(255,255,255,0.1); border-radius: 4px; padding: 0.75em;">
                <div class="listItemContent">
                    <div class="listItemBodyText" style="margin-bottom: 0.5em;">Flatten Single Season Shows</div>
                    <div class="listItemBodyText secondary" style="margin-bottom: 0.75em; font-size: 0.9em;">When enabled, hides the season container section when a series has only one season, since episodes are already displayed directly.</div>
                    ${buildJellyfinCheckbox('flattenSingleSeasonShows_hideSingleSeasonContainer', hideSingleSeasonContainer, 'Enabled')}
                </div>
            </div>
        `;
    }

    // Open configuration modal
    // Fetch libraries (Movies and TV)
    async function fetchLibraries() {
        if (!window.ApiClient) return [];
        try {
            // Get user views (libraries)
            const result = await window.ApiClient.getUserViews({}, window.ApiClient.getCurrentUserId());
            if (result && result.Items) {
                // Filter for movies and tvshows
                return result.Items.filter(item => 
                    item.CollectionType === 'movies' || item.CollectionType === 'tvshows'
                ).map(item => ({
                    Id: item.Id,
                    Name: item.Name,
                    CollectionType: item.CollectionType
                }));
            }
            return [];
        } catch (error) {
            console.error('[KefinTweaks Configuration] Error fetching libraries:', error);
            return [];
        }
    }

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

        currentLoadedConfig = config;
        window.KefinTweaksCurrentConfig = config;

        // Fetch libraries for configuration
        const libraries = await fetchLibraries();

        // Build the content (without title, as ModalSystem adds it)
        const content = document.createElement('div');
        content.className = 'modal-content-wrapper';
        content.id = MODAL_ID;
        content.innerHTML = `
            <div class="kefin-config-wrapper">
                ${buildConfigPageContent(config, libraries)}
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
            <button class="emby-button raised" id="resetConfigBtn" style="padding: 0.75em 2em; font-size: 1em;">
                <span>Defaults</span>
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

    /**
     * Attach event handlers for optional includes checkboxes
     * @param {Object} modalInstance - The modal instance
     * @param {string} category - "global" or skin name
     * @param {Object} config - The current config
     */
    function attachOptionalIncludesCheckboxHandlers(modalInstance, category, config) {
        const checkboxes = modalInstance.dialogContent.querySelectorAll(`.optionalIncludeCheckbox[data-category="${category}"]`);
        checkboxes.forEach(checkbox => {
            // Remove existing listeners (if any) and add new one
            const newCheckbox = checkbox.cloneNode(true);
            checkbox.parentNode.replaceChild(newCheckbox, checkbox);
            
            newCheckbox.addEventListener('change', () => {
                // Update will be saved when user clicks Save button
                // No need to save immediately
            });
        });
    }
    
    // Set up event handlers for configuration modal
    function setupConfigModalHandlers(modalInstance, config) {
        // Enabled checkbox handler
        const enabledCheckbox = modalInstance.dialogContent.querySelector('#kefinTweaksEnabled');
        const enabledLabel = modalInstance.dialogContent.querySelector('#kefinTweaksEnabledLabel');
        if (enabledCheckbox) {
            // Function to update label text
            const updateLabel = () => {
                if (enabledLabel) {
                    enabledLabel.textContent = enabledCheckbox.checked ? 'Enabled' : 'Disabled';
                }
            };
            
            enabledCheckbox.addEventListener('change', async (e) => {
                const isEnabled = e.target.checked;
                // Update label immediately for better UX
                updateLabel();
                
                try {
                    // Update the config's enabled field
                    config.enabled = isEnabled;
                    
                    // Save the updated config to the injector
                    await saveConfigToJavaScriptInjector(config);
                    
                    window.KefinTweaksConfigEnabled = isEnabled;
                    console.log('[KefinTweaks Configuration] KefinTweaks', isEnabled ? 'enabled' : 'disabled');
                    
                    if (window.KefinTweaksToaster && window.KefinTweaksToaster.toast) {
                        window.KefinTweaksToaster.toast(`KefinTweaks ${isEnabled ? 'enabled' : 'disabled'}. Page refresh required.`);
                    }
                } catch (error) {
                    console.error('[KefinTweaks Configuration] Error toggling KefinTweaks:', error);
                    // Revert checkbox on error
                    enabledCheckbox.checked = !isEnabled;
                    updateLabel();
                    alert(`Failed to ${isEnabled ? 'enable' : 'disable'} KefinTweaks: ${error.message}`);
                }
            });
        }
        
        // Change KefinTweaks Source button handler
        const changeSourceBtn = modalInstance.dialogContent.querySelector('#changeKefinTweaksSourceBtn');
        if (changeSourceBtn) {
            changeSourceBtn.addEventListener('click', async () => {
                try {
                    // Check if the modal function is available
                    if (window.openKefinTweaksSourceModal) {
                        // Open the KefinTweaks source modal
                        window.openKefinTweaksSourceModal();
                    } else {
                        throw new Error('KefinTweaks source modal is not available. Please ensure kefinTweaks-plugin.js is loaded.');
                    }
                } catch (error) {
                    console.error('[KefinTweaks Configuration] Error opening source modal:', error);
                    alert(`Failed to open source configuration: ${error.message}`);
                }
            });
        }

        // No validation needed for default skin dropdown - it only allows valid options

        // Helper function to prevent click propagation on checkboxes (so they don't toggle details)
        function setupCheckboxPropagation(checkboxId) {
            const checkbox = modalInstance.dialogContent.querySelector(checkboxId);
            if (checkbox) {
                checkbox.addEventListener('click', (e) => {
                    e.stopPropagation();
                });
            }
        }

        // Helper function to toggle container visibility
        function setupToggleVisibility(checkboxId, containerId) {
            const checkbox = modalInstance.dialogContent.querySelector(checkboxId);
            const container = modalInstance.dialogContent.querySelector(containerId);
            if (checkbox && container) {
                const toggle = () => {
                    container.style.display = checkbox.checked ? '' : 'none';
                };
                checkbox.addEventListener('change', toggle);
                // Prevent details from toggling when clicking checkbox
                checkbox.addEventListener('click', (e) => {
                    e.stopPropagation();
                });
                toggle(); // Set initial state
            }
        }
        
        // Home Screen: Setup propagation prevention only (don't hide content when disabled)
        setupCheckboxPropagation('#homeScreen_recentlyReleased_enabled');
        setupCheckboxPropagation('#homeScreen_trending_enabled');
        setupCheckboxPropagation('#homeScreen_popularTVNetworks_enabled');
        setupCheckboxPropagation('#homeScreen_watchlist_enabled');
        setupCheckboxPropagation('#homeScreen_upcoming_enabled');
        setupCheckboxPropagation('#homeScreen_imdbTop250_enabled');
        setupCheckboxPropagation('#homeScreen_seasonal_enabled');
        setupCheckboxPropagation('#homeScreen_watchAgain_enabled');
        setupCheckboxPropagation('#homeScreen_discovery_enabled');
        
        // Discovery Sections IsPlayed Toggles
        ['recentlyReleased_movies', 'recentlyReleased_episodes', 'trending', 'popularTVNetworks', 'upcoming', 'imdbTop250'].forEach(key => {
            setupToggleVisibility(`#homeScreen_${key}_isPlayed_enabled`, `#homeScreen_${key}_isPlayed_options`);
        });
        
        // Dynamic Discovery Sections IsPlayed Toggles
        DISCOVERY_SECTION_DEFINITIONS.forEach(section => {
            const prefix = `homeScreen_discovery_sectionTypes_${section.key}`;
            setupToggleVisibility(`#${prefix}_isPlayed_enabled`, `#${prefix}_isPlayed_options`);
        });
        
        // Setup event listeners for section management
        // Add section to seasonal season
        modalInstance.dialogContent.addEventListener('click', (e) => {
            const addBtn = e.target.closest('.add-section-to-seasonal-btn');
            if (addBtn) {
                const seasonIndex = parseInt(addBtn.getAttribute('data-season-index'));
                addSectionToSeasonalSeason(seasonIndex);
            }
        });
        
        // Add custom section
        modalInstance.dialogContent.addEventListener('click', (e) => {
            const addBtn = e.target.closest('.add-custom-section-btn');
            if (addBtn) {
                addCustomSection();
            }
        });
        
        // Delete section
        modalInstance.dialogContent.addEventListener('click', (e) => {
            const deleteBtn = e.target.closest('.delete-section-btn');
            if (deleteBtn) {
                e.preventDefault();
                e.stopPropagation();
                console.log('[KefinTweaks Configuration] Checking for section to delete...');
                const prefix = deleteBtn.getAttribute('data-prefix');
                const sectionIndexRaw = deleteBtn.getAttribute('data-section-index');
                const isSeasonal = deleteBtn.getAttribute('data-is-seasonal') === 'true';
                console.log('[KefinTweaks Configuration] Prefix:', prefix);
                console.log('[KefinTweaks Configuration] Section Index Raw:', sectionIndexRaw);
                console.log('[KefinTweaks Configuration] Is Seasonal:', isSeasonal);
                if (prefix && sectionIndexRaw !== null) {
                    console.log('[KefinTweaks Configuration] Deleting section...');
                    // For seasonal sections, sectionIndex is a compound string like "0_1", don't parse it
                    const sectionIndex = isSeasonal || sectionIndexRaw.includes('_') ? sectionIndexRaw : parseInt(sectionIndexRaw);
                    deleteSection(prefix, sectionIndex, isSeasonal);
                }
            }
        });
        
        // Preview section
        modalInstance.dialogContent.addEventListener('click', (e) => {
            const previewBtn = e.target.closest('.preview-section-btn');
            if (previewBtn) {
                e.preventDefault();
                e.stopPropagation();
                const prefix = previewBtn.getAttribute('data-prefix');
                const sectionIndexRaw = previewBtn.getAttribute('data-section-index');
                if (prefix && sectionIndexRaw !== null) {
                    // For seasonal sections, sectionIndex is a compound string like "0_1", don't parse it
                    const isSeasonal = prefix === 'seasonal_season' || sectionIndexRaw.includes('_');
                    const sectionIndex = isSeasonal ? sectionIndexRaw : parseInt(sectionIndexRaw, 10);
                    previewSection(prefix, sectionIndex);
                }
            }
        });
        
        // Type dropdown change
        modalInstance.dialogContent.addEventListener('change', (e) => {
            const typeSelect = e.target.closest(`[class*="_section_type"]`);
            if (typeSelect && typeSelect.hasAttribute('data-prefix')) {
                const prefix = typeSelect.getAttribute('data-prefix');
                const sectionIndex = typeSelect.getAttribute('data-section-index');
                const isSeasonal = typeSelect.getAttribute('data-is-seasonal') === 'true';
                updateSectionSourceField(prefix, sectionIndex, isSeasonal);
            }
        });
        
        // Initialize autocomplete for all badge-based sections
        setTimeout(async () => {
            const badgeContainers = modalInstance.dialogContent.querySelectorAll('.tag-badge-container:not(.includeItemTypes-badge-container)');
            for (const container of badgeContainers) {
                const prefix = container.getAttribute('data-prefix');
                const sectionIndex = container.getAttribute('data-section-index');
                const type = container.getAttribute('data-type');
                if (prefix && sectionIndex && type) {
                    await setupBadgeAutocomplete(prefix, sectionIndex, type);
                    if (type === 'Collection' || type === 'Playlist') {
                        await loadBadgeNames(prefix, sectionIndex, type);
                    }
                }
            }
            
            // Initialize autocomplete for Include Item Types fields
            const includeItemTypesContainers = modalInstance.dialogContent.querySelectorAll('.includeItemTypes-badge-container');
            for (const container of includeItemTypesContainers) {
                const prefix = container.getAttribute('data-prefix');
                const sectionIndex = container.getAttribute('data-section-index');
                const availableTypes = container.getAttribute('data-available-types')?.split(',').filter(Boolean) || [];
                if (prefix && sectionIndex) {
                    setupIncludeItemTypesDropdown(prefix, sectionIndex, availableTypes);
                }
            }
            
            // Setup summary update listeners for existing custom sections
            // Setup summary listeners for custom sections
            const customSectionItems = modalInstance.dialogContent.querySelectorAll('.customSection_section_item');
            customSectionItems.forEach(sectionItem => {
                const sectionIndex = sectionItem.getAttribute('data-section-index');
                if (sectionIndex !== null) {
                    setupCustomSectionSummaryListeners(sectionItem, sectionIndex);
                }
            });
            
            // Setup summary listeners for seasonal nested sections
            const seasonalSectionItems = modalInstance.dialogContent.querySelectorAll('.seasonal_season_section_item');
            seasonalSectionItems.forEach(sectionItem => {
                const sectionIndex = sectionItem.getAttribute('data-section-index');
                if (sectionIndex !== null) {
                    setupCustomSectionSummaryListeners(sectionItem, sectionIndex);
                }
            });
            
            // Setup order update listeners for home screen sections
            setupHomeSectionOrderListeners();
            
            // Setup order update listeners for recently released subsections
            setupRecentlyReleasedOrderListeners();
            
            // Setup order update listeners for seasonal seasons
            setupSeasonalSeasonOrderListeners();
            
            // Setup order update listeners for discovery section types
            setupDiscoverySectionTypeOrderListeners();
            
            // Setup name update listeners for seasonal seasons
            setupSeasonalSeasonNameListeners();
        }, 100);
        
        // Setup event listeners to update home section order displays
        function setupHomeSectionOrderListeners() {
            const orderSpans = modalInstance.dialogContent.querySelectorAll('.home-section-order');
            orderSpans.forEach(span => {
                const prefix = span.getAttribute('data-prefix');
                if (prefix) {
                    const orderInput = modalInstance.dialogContent.querySelector(`#${prefix}_order`);
                    if (orderInput) {
                        orderInput.addEventListener('input', () => {
                            span.textContent = orderInput.value || '100';
                        });
                    }
                }
            });
        }
        
        // Setup event listeners to update recently released subsection order displays
        function setupRecentlyReleasedOrderListeners() {
            const moviesOrderSpan = modalInstance.dialogContent.querySelector('.recently-released-movies-order');
            const moviesOrderInput = modalInstance.dialogContent.querySelector('#homeScreen_recentlyReleased_movies_order');
            if (moviesOrderSpan && moviesOrderInput) {
                moviesOrderInput.addEventListener('input', () => {
                    moviesOrderSpan.textContent = moviesOrderInput.value || '30';
                });
            }
            
            const episodesOrderSpan = modalInstance.dialogContent.querySelector('.recently-released-episodes-order');
            const episodesOrderInput = modalInstance.dialogContent.querySelector('#homeScreen_recentlyReleased_episodes_order');
            if (episodesOrderSpan && episodesOrderInput) {
                episodesOrderInput.addEventListener('input', () => {
                    episodesOrderSpan.textContent = episodesOrderInput.value || '31';
                });
            }
            
            // Setup enabled status listeners
            const moviesEnabledSpan = modalInstance.dialogContent.querySelector('.recently-released-movies-enabled');
            const moviesEnabledCheckbox = modalInstance.dialogContent.querySelector('#homeScreen_recentlyReleased_movies_enabled');
            if (moviesEnabledSpan && moviesEnabledCheckbox) {
                moviesEnabledCheckbox.addEventListener('change', () => {
                    moviesEnabledSpan.textContent = moviesEnabledCheckbox.checked ? 'Enabled' : 'Disabled';
                });
            }
            
            const episodesEnabledSpan = modalInstance.dialogContent.querySelector('.recently-released-episodes-enabled');
            const episodesEnabledCheckbox = modalInstance.dialogContent.querySelector('#homeScreen_recentlyReleased_episodes_enabled');
            if (episodesEnabledSpan && episodesEnabledCheckbox) {
                episodesEnabledCheckbox.addEventListener('change', () => {
                    episodesEnabledSpan.textContent = episodesEnabledCheckbox.checked ? 'Enabled' : 'Disabled';
                });
            }
        }
        
        // Setup event listeners to update seasonal season order displays
        function setupSeasonalSeasonOrderListeners() {
            const orderInputs = modalInstance.dialogContent.querySelectorAll('.seasonal-season-order-input');
            orderInputs.forEach(input => {
                const seasonIndex = input.getAttribute('data-index');
                const orderSpan = modalInstance.dialogContent.querySelector(`.seasonal-season-order[data-season-index="${seasonIndex}"]`);
                if (orderSpan) {
                    input.addEventListener('input', () => {
                        orderSpan.textContent = input.value || '100';
                    });
                }
            });
            
            // Setup enabled status listeners
            const enabledCheckboxes = modalInstance.dialogContent.querySelectorAll('.seasonal-season-enabled');
            enabledCheckboxes.forEach(checkbox => {
                const seasonIndex = checkbox.getAttribute('data-index');
                const enabledSpan = modalInstance.dialogContent.querySelector(`.seasonal-season-enabled-display[data-season-index="${seasonIndex}"]`);
                if (enabledSpan) {
                    checkbox.addEventListener('change', () => {
                        enabledSpan.textContent = checkbox.checked ? 'Enabled' : 'Disabled';
                    });
                }
            });
        }
        
        // Setup event listeners to update discovery section type order displays
        function setupDiscoverySectionTypeOrderListeners() {
            DISCOVERY_SECTION_DEFINITIONS.forEach(section => {
                const prefix = `homeScreen_discovery_sectionTypes_${section.key}`;
                const orderInput = modalInstance.dialogContent.querySelector(`#${prefix}_order`);
                const orderSpan = modalInstance.dialogContent.querySelector(`.discovery-section-type-order[data-section-key="${section.key}"]`);
                if (orderInput && orderSpan) {
                    orderInput.addEventListener('input', () => {
                        orderSpan.textContent = orderInput.value || '100';
                    });
                }
                
                // Setup enabled status listeners
                const enabledCheckbox = modalInstance.dialogContent.querySelector(`#${prefix}_enabled`);
                const enabledSpan = modalInstance.dialogContent.querySelector(`.discovery-section-type-enabled[data-section-key="${section.key}"]`);
                if (enabledCheckbox && enabledSpan) {
                    enabledCheckbox.addEventListener('change', () => {
                        enabledSpan.textContent = enabledCheckbox.checked ? 'Enabled' : 'Disabled';
                    });
                }
            });
        }
        
        // Setup event listeners to update seasonal season name displays
        function setupSeasonalSeasonNameListeners() {
            const nameInputs = modalInstance.dialogContent.querySelectorAll('.seasonal-season-name');
            nameInputs.forEach(input => {
                const seasonIndex = input.getAttribute('data-index');
                const nameSpan = modalInstance.dialogContent.querySelector(`.seasonal-season-name-display[data-season-index="${seasonIndex}"]`);
                if (nameSpan) {
                    input.addEventListener('input', () => {
                        nameSpan.textContent = input.value || 'Unnamed Season';
                    });
                }
            });
        }
        
        // Section management functions
        async function addSectionToSeasonalSeason(seasonIndex) {
            const sectionsList = modalInstance.dialogContent.querySelector(`.seasonal_season_sections_list[data-season-index="${seasonIndex}"]`);
            if (!sectionsList) return;
            
            const sectionIndex = sectionsList.querySelectorAll('.seasonal_season_section_item').length;
            const fullIndex = `${seasonIndex}_${sectionIndex}`;
            const newSection = {
                id: `seasonal-${seasonIndex}-section-${sectionIndex}`,
                enabled: true,
                name: 'New Section',
                type: 'Genre',
                source: '',
                itemLimit: 16,
                sortOrder: 'Random',
                sortOrderDirection: 'Ascending',
                cardFormat: 'Poster',
                order: 100
            };
            
            const sectionHtml = buildSectionUI('seasonal_season', newSection, fullIndex, true);
            sectionsList.insertAdjacentHTML('beforeend', sectionHtml);
            
            // Initialize the new section's source field
            const newSectionItem = sectionsList.querySelector(`.seasonal_season_section_item[data-section-index="${fullIndex}"]`);
            if (newSectionItem) {
                // Setup summary listeners for the new section
                setupCustomSectionSummaryListeners(newSectionItem, fullIndex);
                
                const typeSelect = newSectionItem.querySelector('.seasonal_season_section_type');
                if (typeSelect) {
                    const type = typeSelect.value;
                    if (type === 'Parent') {
                        // Setup Parent type input sync
                        const parentInput = newSectionItem.querySelector(`.seasonal_season_section_source[data-section-index="${fullIndex}"]`);
                        const parentHidden = newSectionItem.querySelector(`.seasonal_season_section_source_hidden[data-section-index="${fullIndex}"]`);
                        if (parentInput && parentHidden) {
                            parentInput.addEventListener('input', () => {
                                parentHidden.value = parentInput.value;
                            });
                        }
                    } else {
                        await setupBadgeAutocomplete('seasonal_season', fullIndex, type);
                        if (type === 'Collection' || type === 'Playlist') {
                            await loadBadgeNames('seasonal_season', fullIndex, type);
                        }
                    }
                }
                
                // Initialize Include Item Types autocomplete
                const includeItemTypesContainer = newSectionItem.querySelector(`.includeItemTypes-badge-container[data-section-index="${fullIndex}"]`);
                if (includeItemTypesContainer) {
                    const availableTypes = includeItemTypesContainer.getAttribute('data-available-types')?.split(',').filter(Boolean) || [];
                    setupIncludeItemTypesDropdown('seasonal_season', fullIndex, availableTypes);
                }
            }
        };
        
        async function addCustomSection() {
            const sectionsList = modalInstance.dialogContent.querySelector('#customSections_list');
            if (!sectionsList) return;
            
            const sectionIndex = sectionsList.querySelectorAll('.customSection_section_item').length;
            const newSection = {
                id: `custom-section-${sectionIndex}`,
                enabled: true,
                name: 'New Custom Section',
                type: 'Collection',
                source: '',
                itemLimit: 16,
                sortOrder: 'Random',
                sortOrderDirection: 'Ascending',
                cardFormat: 'Poster',
                order: 100,
                spotlight: false,
                discoveryEnabled: false
            };
            
            const sectionHtml = buildSectionUI('customSection', newSection, sectionIndex, false);
            sectionsList.insertAdjacentHTML('beforeend', sectionHtml);
            
            // Initialize the new section's source field
            const newSectionItem = sectionsList.querySelector(`.customSection_section_item[data-section-index="${sectionIndex}"]`);
            if (newSectionItem) {
                const typeSelect = newSectionItem.querySelector('.customSection_section_type');
                if (typeSelect) {
                    const type = typeSelect.value;
                    if (type === 'Parent') {
                        // Setup Parent type input sync
                        const parentInput = newSectionItem.querySelector(`.customSection_section_source[data-section-index="${sectionIndex}"]`);
                        const parentHidden = newSectionItem.querySelector(`.customSection_section_source_hidden[data-section-index="${sectionIndex}"]`);
                        if (parentInput && parentHidden) {
                            parentInput.addEventListener('input', () => {
                                parentHidden.value = parentInput.value;
                            });
                        }
                    } else {
                        await setupBadgeAutocomplete('customSection', sectionIndex, type);
                        if (type === 'Collection' || type === 'Playlist') {
                            await loadBadgeNames('customSection', sectionIndex, type);
                        }
                    }
                }
                // Setup summary update listeners for custom sections
                setupCustomSectionSummaryListeners(newSectionItem, sectionIndex);
                
                // Initialize Include Item Types autocomplete
                const includeItemTypesContainer = newSectionItem.querySelector(`.includeItemTypes-badge-container[data-section-index="${sectionIndex}"]`);
                if (includeItemTypesContainer) {
                    const availableTypes = includeItemTypesContainer.getAttribute('data-available-types')?.split(',').filter(Boolean) || [];
                    setupIncludeItemTypesDropdown('customSection', sectionIndex, availableTypes);
                }
            }
        };
        
        // Setup event listeners to update section summary when name/order changes
        // Works for both custom sections and seasonal nested sections
        function setupCustomSectionSummaryListeners(sectionItem, sectionIndex) {
            const prefix = sectionItem.classList.contains('customSection_section_item') ? 'customSection' : 'seasonal_season';
            const sanitizedIndex = sectionIndex.toString().replace(/[^a-zA-Z0-9]/g, '_');
            
            // Find inputs based on prefix
            const nameInput = sectionItem.querySelector(`.${prefix}_section_name[data-section-index="${sectionIndex}"]`);
            const orderInput = sectionItem.querySelector(`#${prefix}_section_${sanitizedIndex}_order`);
            const enabledCheckbox = sectionItem.querySelector(`#${prefix}_section_enabled_${sanitizedIndex}`) || sectionItem.querySelector(`.${prefix}_section_enabled[data-section-index="${sectionIndex}"]`);
            
            // Find summary display spans based on prefix
            const nameClass = prefix === 'customSection' ? 'custom-section-name' : 'seasonal-section-name';
            const orderClass = prefix === 'customSection' ? 'custom-section-order' : 'seasonal-section-order';
            const enabledClass = prefix === 'customSection' ? 'custom-section-enabled-display' : 'seasonal-section-enabled-display';
            
            const nameSpan = sectionItem.querySelector(`.${nameClass}[data-section-index="${sectionIndex}"]`);
            const orderSpan = sectionItem.querySelector(`.${orderClass}[data-section-index="${sectionIndex}"]`);
            const enabledSpan = sectionItem.querySelector(`.${enabledClass}[data-section-index="${sectionIndex}"]`);
            
            if (nameInput && nameSpan) {
                nameInput.addEventListener('input', () => {
                    nameSpan.textContent = nameInput.value || 'Unnamed Section';
                });
            }
            
            if (orderInput && orderSpan) {
                orderInput.addEventListener('input', () => {
                    orderSpan.textContent = orderInput.value || '100';
                });
            }
            
            if (enabledCheckbox && enabledSpan) {
                enabledCheckbox.addEventListener('change', () => {
                    enabledSpan.textContent = enabledCheckbox.checked ? 'Enabled' : 'Disabled';
                });
            }

            // Setup additional options listeners
            const additionalOptionsControls = sectionItem.querySelector(`.${prefix}_section_additionalOptions_controls[data-section-index="${sectionIndex}"]`);
            const additionalOptionsListContainer = sectionItem.querySelector(`.${prefix}_section_additionalOptions_list_container[data-section-index="${sectionIndex}"]`);
            
            if (additionalOptionsControls) {
                const addBtn = additionalOptionsControls.querySelector('.add-additional-option');
                const select = additionalOptionsControls.querySelector('.additional-option-select');
                const list = additionalOptionsListContainer ? additionalOptionsListContainer.querySelector('.additional-options-list') : null;
                
                if (addBtn && select && list) {
                    addBtn.addEventListener('click', () => {
                        const key = select.value;
                        if (!key) return;
                        
                        const meta = SUPPORTED_CUSTOM_SECTION_PARAMS[key];
                        if (!meta) return;
                        
                        const index = list.children.length;
                        const sanitizedPrefix = `${prefix}_section_${sanitizedIndex}`;
                        const inputId = `${sanitizedPrefix}_additionalOption_${Date.now()}_${index}`;
                        
                        let inputField = '';
                        if (meta.type === 'boolean') {
                            inputField = buildJellyfinCheckbox(inputId, meta.default === true, meta.label, { 
                                'data-key': key, 
                                'class': 'additional-option-value',
                                'data-type': 'boolean'
                            });
                        } else {
                            inputField = `
                                <div style="flex: 1;">
                                    <div class="listItemBodyText" style="margin-bottom: 0.25em;">${meta.label}</div>
                                    <input type="text" id="${inputId}" class="fld emby-input additional-option-value" value="" data-key="${key}" data-type="${meta.type}" placeholder="${meta.hint || ''}" style="width: 100%;">
                                </div>
                            `;
                        }
                        
                        const row = document.createElement('div');
                        row.className = 'additional-option-row';
                        row.style.cssText = 'display: flex; align-items: flex-end; gap: 0.5em; margin-top: 0.5em; padding: 0.5em; background: rgba(255,255,255,0.05); border-radius: 4px;';
                        row.innerHTML = `
                            ${inputField}
                            <button type="button" class="remove-additional-option" style="background: none; border: none; color: rgba(255,255,255,0.7); cursor: pointer; padding: 0.25em; display: flex; align-items: center;" title="Remove Option">
                                <span class="material-icons">close</span>
                            </button>
                        `;
                        
                        // Add delete listener for new row
                        row.querySelector('.remove-additional-option').addEventListener('click', () => {
                            row.remove();
                        });
                        
                        list.appendChild(row);
                        
                        // Reset select
                        select.value = '';
                    });
                }
            }
            
            // Add listeners for existing delete buttons
            if (additionalOptionsListContainer) {
                additionalOptionsListContainer.querySelectorAll('.remove-additional-option').forEach(btn => {
                    btn.addEventListener('click', (e) => {
                        const row = e.target.closest('.additional-option-row');
                        if (row) row.remove();
                    });
                });
            }
        }
        
        function deleteSection(prefix, sectionIndex, isSeasonalNested) {
            console.log('[KefinTweaks Configuration] Deleting section:', prefix, sectionIndex, isSeasonalNested);
            // Try both string and number comparison for data-section-index
            const sectionItem = modalInstance.dialogContent.querySelector(
                `.${prefix}_section_item[data-section-index="${sectionIndex}"], .${prefix}_section_item[data-section-index='${sectionIndex}']`
            );
            if (sectionItem && confirm('Are you sure you want to delete this section?')) {
                sectionItem.remove();
                
                // For seasonal sections, sectionIndex is compound (e.g., "0_1"), need special handling
                if (isSeasonalNested && typeof sectionIndex === 'string' && sectionIndex.includes('_')) {
                    const [seasonIndex, deletedSectionIndex] = sectionIndex.split('_');
                    const sectionsList = modalInstance.dialogContent.querySelector(`.seasonal_season_sections_list[data-season-index="${seasonIndex}"]`);
                    if (sectionsList) {
                        // Re-index only sections within the same season
                        const remainingItems = Array.from(sectionsList.querySelectorAll(`.${prefix}_section_item`))
                            .sort((a, b) => {
                                const aIdx = a.getAttribute('data-section-index');
                                const bIdx = b.getAttribute('data-section-index');
                                if (!aIdx || !bIdx) return 0;
                                // Extract section index part (after underscore)
                                const aSectionIdx = aIdx.includes('_') ? parseInt(aIdx.split('_')[1]) : parseInt(aIdx);
                                const bSectionIdx = bIdx.includes('_') ? parseInt(bIdx.split('_')[1]) : parseInt(bIdx);
                                return aSectionIdx - bSectionIdx;
                            });
                        
                        remainingItems.forEach((item, newSectionIndex) => {
                            const newFullIndex = `${seasonIndex}_${newSectionIndex}`;
                            const oldIndex = item.getAttribute('data-section-index');
                            item.setAttribute('data-section-index', newFullIndex);
                            
                            // Update all inputs within this section
                            item.querySelectorAll(`[data-section-index="${oldIndex}"]`).forEach(el => {
                                el.setAttribute('data-section-index', newFullIndex);
                            });
                            
                            // Update summary displays
                            const summaryName = item.querySelector(`.seasonal-section-name[data-section-index="${oldIndex}"]`);
                            if (summaryName) {
                                summaryName.setAttribute('data-section-index', newFullIndex);
                            }
                            const summaryEnabled = item.querySelector(`.seasonal-section-enabled-display[data-section-index="${oldIndex}"]`);
                            if (summaryEnabled) {
                                summaryEnabled.setAttribute('data-section-index', newFullIndex);
                            }
                            const summaryOrder = item.querySelector(`.seasonal-section-order[data-section-index="${oldIndex}"]`);
                            if (summaryOrder) {
                                summaryOrder.setAttribute('data-section-index', newFullIndex);
                            }
                            
                            // Update delete and preview button data attributes
                            const deleteBtn = item.querySelector('.delete-section-btn');
                            if (deleteBtn) {
                                deleteBtn.setAttribute('data-section-index', newFullIndex);
                            }
                            const previewBtn = item.querySelector('.preview-section-btn');
                            if (previewBtn) {
                                previewBtn.setAttribute('data-section-index', newFullIndex);
                            }
                        });
                    }
                } else {
                    // Regular custom sections - simple re-indexing
                    const remainingItems = Array.from(modalInstance.dialogContent.querySelectorAll(`.${prefix}_section_item`))
                        .sort((a, b) => {
                            const aIndex = parseInt(a.getAttribute('data-section-index')) || 0;
                            const bIndex = parseInt(b.getAttribute('data-section-index')) || 0;
                            return aIndex - bIndex;
                        });
                    
                    remainingItems.forEach((item, newIndex) => {
                        const oldIndex = item.getAttribute('data-section-index');
                        item.setAttribute('data-section-index', newIndex);
                        
                        // Update all inputs within this section
                        item.querySelectorAll(`[data-section-index="${oldIndex}"]`).forEach(el => {
                            el.setAttribute('data-section-index', newIndex);
                        });
                        
                        // Update summary displays that reference section index
                        const summaryName = item.querySelector(`.custom-section-name[data-section-index="${oldIndex}"]`);
                        if (summaryName) {
                            summaryName.setAttribute('data-section-index', newIndex);
                        }
                        const summaryEnabled = item.querySelector(`.custom-section-enabled-display[data-section-index="${oldIndex}"]`);
                        if (summaryEnabled) {
                            summaryEnabled.setAttribute('data-section-index', newIndex);
                        }
                        const summaryOrder = item.querySelector(`.custom-section-order[data-section-index="${oldIndex}"]`);
                        if (summaryOrder) {
                            summaryOrder.setAttribute('data-section-index', newIndex);
                        }
                        
                        // Update delete button data attribute
                        const deleteBtn = item.querySelector('.delete-section-btn');
                        if (deleteBtn) {
                            deleteBtn.setAttribute('data-section-index', newIndex);
                        }
                        const previewBtn = item.querySelector('.preview-section-btn');
                        if (previewBtn) {
                            previewBtn.setAttribute('data-section-index', newIndex);
                        }
                    });
                }
            }
        };
        
        async function previewSection(prefix, sectionIndex) {
            if (!window.ModalSystem) {
                alert('Modal system not available. Please ensure modal.js is loaded.');
                return;
            }
            
            const sectionConfig = getSectionConfigFromUI(modalInstance.dialogContent, prefix, sectionIndex);
            if (!sectionConfig) {
                alert('Unable to build preview for this section. Please check the configuration values.');
                return;
            }
            
            const modalId = `sectionPreview_${prefix}_${sectionIndex}_${Date.now()}`;
            const contentId = `${modalId}_content`;
            
            const previewModal = window.ModalSystem.create({
                id: modalId,
                title: `Preview: ${sectionConfig.name || 'Custom Section'}`,
                content: `
                    <div id="${contentId}" class="preview-section-container" style="min-height: 320px; display: flex; align-items: center; justify-content: center; padding: 1.5em;>
                        <div style="opacity: 0.75;">Preparing preview...</div>
                    </div>
                `,
                footer: `
                    <button class="emby-button raised" id="${modalId}_closeBtn" style="padding: 0.75em 2em; font-size: 1em;">
                        <span>Close</span>
                    </button>
                `,
                closeOnBackdrop: true,
                closeOnEscape: true,
                size: 'large',
                onOpen: async (previewInstance) => {
                    previewInstance.dialogContent.style.width = '1400px';

                    const closeBtn = previewInstance.dialogFooter?.querySelector(`#${modalId}_closeBtn`);
                    if (closeBtn) {
                        closeBtn.addEventListener('click', () => previewInstance.close());
                    }
                    
                    const container = previewInstance.dialogContent.querySelector(`#${contentId}`);
                    if (!container) {
                        return;
                    }
                    
                    container.innerHTML = `<div style="opacity: 0.75;">Loading preview...</div>`;
                    
                    try {
                        const items = await fetchItemsForSectionPreview(sectionConfig);
                        if (!items || items.length === 0) {
                            container.innerHTML = `<div style="opacity: 0.75; text-align: center;">No items match this configuration yet.</div>`;
                            return;
                        }
                        
                        if (!window.cardBuilder) {
                            container.innerHTML = `<div style="color: #ff6b6b; text-align: center;">Card builder utilities are not available.</div>`;
                            return;
                        }
                        
                        let previewElement = null;
                        if (sectionConfig.spotlight && typeof window.cardBuilder.renderSpotlightSection === 'function') {
                            previewElement = window.cardBuilder.renderSpotlightSection(items, sectionConfig.name || 'Preview', {
                                autoPlay: false,
                                showDots: true,
                                showNavButtons: true,
                                viewMoreUrl: null
                            });
                        } else if (typeof window.cardBuilder.renderCards === 'function') {
                            previewElement = window.cardBuilder.renderCards(
                                items,
                                sectionConfig.name || 'Preview',
                                null,
                                true,
                                sectionConfig.cardFormat || 'Poster',
                                sectionConfig.sortOrder || 'Random',
                                sectionConfig.sortOrderDirection || 'Ascending'
                            );
                        }
                        
                        container.innerHTML = '';
                        if (previewElement) {
                            container.appendChild(previewElement);
                        } else {
                            container.innerHTML = `<div style="opacity: 0.75; text-align: center;">Unable to render preview with the current configuration.</div>`;
                        }
                    } catch (error) {
                        console.error('[KefinTweaks Configuration] Error rendering preview:', error);
                        container.innerHTML = `<div style="color: #ff6b6b; text-align: center;">Failed to load preview: ${error?.message || error}</div>`;
                    }
                }
            });
            
            previewModal.open();
        }
        
        async function updateSectionSourceField(prefix, sectionIndex, isSeasonalNested) {
            const sectionItem = modalInstance.dialogContent.querySelector(`.${prefix}_section_item[data-section-index="${sectionIndex}"]`);
            if (!sectionItem) {
                console.warn(`[KefinTweaks Configuration] Section item not found for prefix: ${prefix}, index: ${sectionIndex}`);
                return;
            }
            
            const typeSelect = sectionItem.querySelector(`.${prefix}_section_type[data-section-index="${sectionIndex}"]`);
            if (!typeSelect) {
                console.warn(`[KefinTweaks Configuration] Type select not found for prefix: ${prefix}, index: ${sectionIndex}`);
                return;
            }
            const type = typeSelect.value || 'Genre';
            
            // Find the source field container using the specific class
            const sourceContainer = sectionItem.querySelector(`.${prefix}_section_source_container[data-section-index="${sectionIndex}"]`);
            if (!sourceContainer) {
                console.warn(`[KefinTweaks Configuration] Source container not found for prefix: ${prefix}, index: ${sectionIndex}`);
                return;
            }
            
            // Get current source value
            const currentSourceInput = sectionItem.querySelector(`.${prefix}_section_source[data-section-index="${sectionIndex}"]`);
            const badgeContainer = sourceContainer?.querySelector(`.tag-badge-container[data-section-index="${sectionIndex}"][data-type]`) || null;
            let currentSource = '';
            
            if (badgeContainer) {
                // Extract from existing badges
                const badges = badgeContainer.querySelectorAll('.tag-badge');
                currentSource = Array.from(badges).map(badge => badge.getAttribute('data-value')).filter(Boolean).join(', ');
            } else if (currentSourceInput) {
                // Extract from dropdown/input
                currentSource = currentSourceInput.value || '';
            }
            
            // Clear badges whenever the source type changes
            // This ensures a clean state when switching between any types
            const currentType = currentSourceInput?.dataset?.type || badgeContainer?.dataset?.type;
            if (currentType && currentType !== type) {
                currentSource = '';
            }
            
            let newSourceHtml = '';
            
            if (type === 'Parent') {
                // Parent type uses simple text input
                newSourceHtml = `
                    <div style="position: relative;">
                        <div class="listItemBodyText" style="margin-bottom: 0.5em;">Parent IDs (comma-separated, leave empty for "Any")</div>
                        <input type="text" class="${prefix}_section_source fld emby-input" data-section-index="${sectionIndex}" data-prefix="${prefix}" data-type="${type}" value="${currentSource}" placeholder="Enter parent IDs (e.g., collection-id, playlist-id) or leave empty" style="width: 100%;">
                        <input type="hidden" class="${prefix}_section_source_hidden" data-section-index="${sectionIndex}" value="${currentSource}">
                    </div>
                `;
            } else {
                // Build new badge-based UI for other types
                const sourceArray = currentSource ? currentSource.split(',').map(s => s.trim()).filter(Boolean) : [];
                const badgesHtml = sourceArray.map(val => {
                    if (type === 'Tag' || type === 'Genre') {
                        return `<span class="tag-badge" data-value="${val}" style="display: inline-flex; align-items: center; gap: 0.25em; background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.2); border-radius: 4px; padding: 0.25em 0.5em; margin: 0.25em; font-size: 0.9em;">
                            ${val}
                            <button type="button" class="tag-badge-remove" style="background: none; border: none; color: rgba(255,255,255,0.7); cursor: pointer; padding: 0; margin-left: 0.25em; font-size: 1.2em; line-height: 1; display: flex; align-items: center;" title="Remove">×</button>
                        </span>`;
                    } else {
                        return `<span class="tag-badge" data-value="${val}" data-loading="true" style="display: inline-flex; align-items: center; gap: 0.25em; background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.2); border-radius: 4px; padding: 0.25em 0.5em; margin: 0.25em; font-size: 0.9em;">
                            ${val}
                            <button type="button" class="tag-badge-remove" style="background: none; border: none; color: rgba(255,255,255,0.7); cursor: pointer; padding: 0; margin-left: 0.25em; font-size: 1.2em; line-height: 1; display: flex; align-items: center;" title="Remove">×</button>
                        </span>`;
                    }
                }).join('');
                
                newSourceHtml = `
                    <div style="position: relative;">
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5em;">
                            <div class="listItemBodyText">${type}</div>
                            <button type="button" class="badge-clear-all" data-section-index="${sectionIndex}" style="background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.2); border-radius: 4px; padding: 0.25em 0.5em; color: rgba(255,255,255,0.87); cursor: pointer; font-size: 0.85em;" title="Clear All">Clear All</button>
                        </div>
                        <div class="tag-badge-container" data-section-index="${sectionIndex}" data-prefix="${prefix}" data-type="${type}" style="min-height: 2.5em; border: 1px solid rgba(255,255,255,0.2); border-radius: 4px; padding: 0.5em; margin-bottom: 0.5em; background: rgba(0,0,0,0.2); display: flex; gap: 0.5em; align-items: flex-start; overflow: hidden;">
                            <input type="text" class="${prefix}_section_source fld emby-input autocomplete-input" data-section-index="${sectionIndex}" data-prefix="${prefix}" data-type="${type}" placeholder="Type to add ${type.toLowerCase()}..." autocomplete="off" style="flex: 0 0 auto; width: 120px; min-width: 200px; max-width: 120px; border: none; background: transparent; outline: none; color: rgba(255,255,255,0.87); padding: 0.25em;">
                            <div style="flex: 1; min-width: 0; display: flex; flex-wrap: wrap; gap: 0.25em; align-items: flex-start; overflow-wrap: break-word;">
                                ${badgesHtml}
                            </div>
                        </div>
                        <input type="hidden" class="${prefix}_section_source_hidden" data-section-index="${sectionIndex}" value="${currentSource}">
                        <div class="autocomplete-suggestions" data-section-index="${sectionIndex}" style="display: none; position: absolute; z-index: 10000; background: #1a1a1a !important; color: rgba(255,255,255,0.87) !important; border: 1px solid rgba(255,255,255,0.2); border-radius: 4px; max-height: 200px; overflow-y: auto; margin-top: 2px; width: 100%; box-sizing: border-box; opacity: 1 !important; top: 100%; left: 0;"></div>
                    </div>
                `;
            }
            
            sourceContainer.innerHTML = newSourceHtml;
            
            // Setup event listener for Parent type to sync input with hidden field
            if (type === 'Parent') {
                const parentInput = sourceContainer.querySelector(`.${prefix}_section_source[data-section-index="${sectionIndex}"]`);
                const parentHidden = sourceContainer.querySelector(`.${prefix}_section_source_hidden[data-section-index="${sectionIndex}"]`);
                if (parentInput && parentHidden) {
                    parentInput.addEventListener('input', () => {
                        parentHidden.value = parentInput.value;
                    });
                }
            } else {
                // Initialize autocomplete for other types
                await setupBadgeAutocomplete(prefix, sectionIndex, type);
                
                // Load names for Collections/Playlists
                if (type === 'Collection' || type === 'Playlist') {
                    await loadBadgeNames(prefix, sectionIndex, type);
                }
            }
            
            // Update Include Item Types field to reflect available types based on source type
            const includeItemTypesContainer = sectionItem.querySelector(`.${prefix}_section_includeItemTypes_container[data-section-index="${sectionIndex}"]`);
            if (includeItemTypesContainer) {
                const currentBadges = includeItemTypesContainer.querySelectorAll('.tag-badge');
                const currentTypes = Array.from(currentBadges).map(badge => badge.getAttribute('data-value')).filter(Boolean);
                const availableTypes = type === 'Parent' 
                    ? ['Movie', 'Series', 'Season', 'Episode', 'MusicArtist', 'MusicAlbum', 'Audio', 'MusicVideo', 'Book', 'BoxSet', 'Playlist']
                    : ['Movie', 'Series', 'Season', 'Episode', 'MusicArtist', 'MusicAlbum', 'Audio', 'MusicVideo', 'Book'];
                
                // Remove invalid types (types not available for current source type)
                const validTypes = currentTypes.filter(t => availableTypes.includes(t));
                
                // Rebuild the Include Item Types field
                const sanitizedPrefix = `${prefix}_section_${sectionIndex.toString().replace(/[^a-zA-Z0-9]/g, '_')}`;
                const newIncludeItemTypesHtml = buildIncludeItemTypesField(prefix, sectionIndex, sanitizedPrefix, validTypes, type);
                includeItemTypesContainer.outerHTML = newIncludeItemTypesHtml;
                
                // Re-initialize autocomplete for Include Item Types
                const newContainer = sectionItem.querySelector(`.includeItemTypes-badge-container[data-section-index="${sectionIndex}"]`);
                if (newContainer) {
                    setupIncludeItemTypesDropdown(prefix, sectionIndex, availableTypes);
                }
            }
        }
        
        // Generic badge management system
        const BadgeSystem = {
            /**
             * Creates a badge element
             * @param {string} value - The value to store (ID for collections/playlists, name for tags/genres)
             * @param {string} displayText - The text to display
             * @returns {HTMLElement} Badge element
             */
            createBadge(value, displayText) {
                const badge = document.createElement('span');
                badge.className = 'tag-badge';
                badge.setAttribute('data-value', value);
                badge.style.cssText = 'display: inline-flex; align-items: center; gap: 0.25em; background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.2); border-radius: 4px; padding: 0.25em 0.5em; margin: 0.25em; font-size: 0.9em;';
                badge.innerHTML = `${displayText}<button type="button" class="tag-badge-remove" style="background: none; border: none; color: rgba(255,255,255,0.7); cursor: pointer; padding: 0; margin-left: 0.25em; font-size: 1.2em; line-height: 1; display: flex; align-items: center;" title="Remove">×</button>`;
                return badge;
            },
            
            /**
             * Adds a badge to the container
             */
            addBadge(prefix, sectionIndex, value, displayText, badgeContainer, input, hiddenInput) {
                // Check if badge already exists
                const existingBadges = badgeContainer.querySelectorAll('.tag-badge');
                const alreadyExists = Array.from(existingBadges).some(badge => 
                    badge.getAttribute('data-value') === value
                );
                if (alreadyExists) return;
                
                // Find the badges wrapper div (sibling of the input in new layout, or container in old layout)
                const badgesWrapper = input.nextElementSibling && input.nextElementSibling.matches('div') 
                    ? input.nextElementSibling 
                    : badgeContainer;
                
                const badge = this.createBadge(value, displayText);
                badgesWrapper.appendChild(badge);
                input.value = '';
                this.updateHiddenInput(prefix, sectionIndex, badgeContainer, hiddenInput);
            },
            
            /**
             * Removes a badge from the container
             */
            removeBadge(prefix, sectionIndex, badge, badgeContainer, hiddenInput) {
                badge.remove();
                this.updateHiddenInput(prefix, sectionIndex, badgeContainer, hiddenInput);
            },
            
            /**
             * Removes all badges from the container
             */
            clearAll(prefix, sectionIndex, badgeContainer, hiddenInput) {
                const badges = badgeContainer.querySelectorAll('.tag-badge');
                badges.forEach(badge => badge.remove());
                this.updateHiddenInput(prefix, sectionIndex, badgeContainer, hiddenInput);
            },
            
            /**
             * Updates hidden input from badges
             */
            updateHiddenInput(prefix, sectionIndex, badgeContainer, hiddenInput) {
                const badges = badgeContainer.querySelectorAll('.tag-badge');
                const values = Array.from(badges).map(badge => badge.getAttribute('data-value')).filter(Boolean);
                if (hiddenInput) {
                    hiddenInput.value = values.join(', ');
                }
            },
            
            /**
             * Gets existing badge values (for deduplication)
             */
            getExistingBadges(badgeContainer) {
                const badges = badgeContainer.querySelectorAll('.tag-badge');
                return Array.from(badges).map(badge => badge.getAttribute('data-value').toLowerCase());
            }
        };
        
        // Generic autocomplete setup for badge-based inputs
        // Supports: Tag, Genre, Collection, Playlist
        async function setupBadgeAutocomplete(prefix, sectionIndex, type) {
            const badgeContainer = modalInstance.dialogContent.querySelector(
                `.tag-badge-container[data-section-index="${sectionIndex}"][data-type="${type}"]`
            );
            const input = modalInstance.dialogContent.querySelector(
                `.${prefix}_section_source.autocomplete-input[data-section-index="${sectionIndex}"]`
            );
            const suggestionsDiv = modalInstance.dialogContent.querySelector(
                `.autocomplete-suggestions[data-section-index="${sectionIndex}"]`
            );
            const hiddenInput = modalInstance.dialogContent.querySelector(
                `.${prefix}_section_source_hidden[data-section-index="${sectionIndex}"]`
            );
            const clearAllBtn = modalInstance.dialogContent.querySelector(
                `.badge-clear-all[data-section-index="${sectionIndex}"]`
            );
            
            if (!badgeContainer || !input || !suggestionsDiv) return;
            
            // Setup badge remove handlers
            badgeContainer.addEventListener('click', (e) => {
                if (e.target.classList.contains('tag-badge-remove') || e.target.closest('.tag-badge-remove')) {
                    const badge = e.target.closest('.tag-badge');
                    if (badge) {
                        BadgeSystem.removeBadge(prefix, sectionIndex, badge, badgeContainer, hiddenInput);
                    }
                }
            });
            
            // Setup clear all button
            if (clearAllBtn) {
                clearAllBtn.addEventListener('click', () => {
                    BadgeSystem.clearAll(prefix, sectionIndex, badgeContainer, hiddenInput);
                });
            }
            
            // Fetch available options based on type
            let options = [];
            try {
                const userId = window.ApiClient.getCurrentUserId();
                const serverAddress = window.ApiClient.serverAddress();
                
                if (type === 'Tag' || type === 'Genre') {
                    const url = `${serverAddress}/Items/Filters?UserId=${userId}&IncludeItemTypes=Movie`;
                    const data = await window.apiHelper.getData(url, true);
                    options = type === 'Tag' ? (data.Tags || []) : (data.Genres || []);
                } else if (type === 'Collection' || type === 'Playlist') {
                    // Fetch Collections/Playlists using getItems with caching
                    const itemType = type === 'Playlist' ? 'Playlist' : 'BoxSet,CollectionFolder';
                    const data = await window.apiHelper.getItems(
                        {
                            IncludeItemTypes: itemType,
                            Recursive: true,
                            Fields: 'ItemCounts'
                        },
                        true,
                        300000
                    );
                    options = (data.Items || []).map(item => ({
                        id: item.Id,
                        name: item.Name
                    }));
                }
            } catch (err) {
                console.error('[KefinTweaks Configuration] Error fetching options:', err);
            }
            
            let currentSuggestions = [];
            let selectedIndex = -1;
            
            const getExistingBadges = () => BadgeSystem.getExistingBadges(badgeContainer);
            
            input.addEventListener('input', (e) => {
                const value = e.target.value.trim();
                if (value.length === 0) {
                    suggestionsDiv.style.display = 'none';
                    return;
                }
                
                const existing = getExistingBadges();
                
                // Filter options based on type
                if (type === 'Tag' || type === 'Genre') {
                    currentSuggestions = options.filter(opt => 
                        opt.toLowerCase().includes(value.toLowerCase()) &&
                        !existing.includes(opt.toLowerCase())
                    ).slice(0, 10);
                } else {
                    // Collections/Playlists: search by name, exclude by ID
                    currentSuggestions = options.filter(opt => 
                        opt.name.toLowerCase().includes(value.toLowerCase()) &&
                        !existing.includes(opt.id.toLowerCase())
                    ).slice(0, 10);
                }
                
                if (currentSuggestions.length > 0) {
                    suggestionsDiv.innerHTML = currentSuggestions.map((opt, idx) => {
                        const display = type === 'Tag' || type === 'Genre' ? opt : opt.name;
                        const dataValue = type === 'Tag' || type === 'Genre' ? opt : opt.id;
                        return `<div class="autocomplete-suggestion" data-index="${idx}" data-value="${dataValue}" data-display="${display}" style="padding: 0.5em; cursor: pointer; border-left: 3px solid transparent;">${display}</div>`;
                    }).join('');
                    suggestionsDiv.style.display = 'block';
                    selectedIndex = -1;
                    // Set up mouse event handlers for each suggestion
                    const suggestionItems = suggestionsDiv.querySelectorAll('.autocomplete-suggestion');
                    suggestionItems.forEach((item, idx) => {
                        item.addEventListener('mouseenter', () => {
                            // Clear keyboard selection
                            selectedIndex = -1;
                            updateSuggestionHighlight();
                            // Highlight hovered item
                            item.style.background = 'rgba(255,255,255,0.1)';
                        });
                        item.addEventListener('mouseleave', () => {
                            item.style.background = '';
                        });
                    });
                } else {
                    suggestionsDiv.style.display = 'none';
                }
            });
            
            // Handle suggestion clicks
            suggestionsDiv.addEventListener('click', (e) => {
                const suggestion = e.target.closest('.autocomplete-suggestion');
                if (!suggestion) return;
                
                const selectedValue = suggestion.getAttribute('data-value');
                const displayText = suggestion.getAttribute('data-display') || selectedValue;
                
                BadgeSystem.addBadge(prefix, sectionIndex, selectedValue, displayText, badgeContainer, input, hiddenInput);
                suggestionsDiv.style.display = 'none';
                selectedIndex = -1;
                input.focus();
            });
            
            // Function to show all available suggestions (excluding already selected)
            function showAllSuggestions() {
                const existing = getExistingBadges();
                
                // Filter options based on type, excluding already selected
                if (type === 'Tag' || type === 'Genre') {
                    currentSuggestions = options.filter(opt => 
                        !existing.includes(opt.toLowerCase())
                    ).slice(0, 30);
                } else {
                    // Collections/Playlists: exclude by ID
                    currentSuggestions = options.filter(opt => 
                        !existing.includes(opt.id.toLowerCase())
                    ).slice(0, 30);
                }
                
                if (currentSuggestions.length > 0) {
                    suggestionsDiv.innerHTML = currentSuggestions.map((opt, idx) => {
                        const display = type === 'Tag' || type === 'Genre' ? opt : opt.name;
                        const dataValue = type === 'Tag' || type === 'Genre' ? opt : opt.id;
                        return `<div class="autocomplete-suggestion" data-index="${idx}" data-value="${dataValue}" data-display="${display}" style="padding: 0.5em; cursor: pointer; border-left: 3px solid transparent;">${display}</div>`;
                    }).join('');
                    suggestionsDiv.style.display = 'block';
                    selectedIndex = 0;
                    updateSuggestionHighlight();
                    // Set up mouse event handlers for each suggestion
                    const suggestionItems = suggestionsDiv.querySelectorAll('.autocomplete-suggestion');
                    suggestionItems.forEach((item, idx) => {
                        item.addEventListener('mouseenter', () => {
                            // Clear keyboard selection
                            selectedIndex = -1;
                            updateSuggestionHighlight();
                            // Highlight hovered item
                            item.style.background = 'rgba(255,255,255,0.1)';
                        });
                        item.addEventListener('mouseleave', () => {
                            item.style.background = '';
                        });
                    });
                } else {
                    suggestionsDiv.style.display = 'none';
                }
            }
            
            // Handle keyboard navigation
            input.addEventListener('keydown', (e) => {
                if (e.key === 'ArrowDown') {
                    e.preventDefault();
                    // If input is empty and no suggestions shown, show all suggestions
                    if (input.value.trim().length === 0 && suggestionsDiv.style.display === 'none') {
                        showAllSuggestions();
                        return;
                    }
                    // If suggestions are shown, navigate
                    if (currentSuggestions.length > 0) {
                        selectedIndex = Math.min(selectedIndex + 1, currentSuggestions.length - 1);
                        updateSuggestionHighlight();
                    }
                } else if (e.key === 'ArrowUp') {
                    e.preventDefault();
                    if (currentSuggestions.length > 0) {
                        selectedIndex = Math.max(selectedIndex - 1, -1);
                        updateSuggestionHighlight();
                        // If we go above the first item, hide suggestions
                        if (selectedIndex < 0) {
                            suggestionsDiv.style.display = 'none';
                        }
                    }
                } else if (e.key === 'Enter') {
                    e.preventDefault();
                    if (selectedIndex >= 0 && currentSuggestions[selectedIndex]) {
                        const selected = currentSuggestions[selectedIndex];
                        const value = type === 'Tag' || type === 'Genre' ? selected : selected.id;
                        const display = type === 'Tag' || type === 'Genre' ? selected : selected.name;
                        BadgeSystem.addBadge(prefix, sectionIndex, value, display, badgeContainer, input, hiddenInput);
                        suggestionsDiv.style.display = 'none';
                        selectedIndex = -1;
                    }
                    // No free-form entry - require autocomplete selection
                } else if (e.key === 'Escape') {
                    suggestionsDiv.style.display = 'none';
                    selectedIndex = -1;
                } else if (e.key === 'Backspace' && input.value === '') {
                    const badges = badgeContainer.querySelectorAll('.tag-badge');
                    if (badges.length > 0) {
                        const lastBadge = badges[badges.length - 1];
                        BadgeSystem.removeBadge(prefix, sectionIndex, lastBadge, badgeContainer, hiddenInput);
                    }
                }
            });
            
            function updateSuggestionHighlight() {
                const items = suggestionsDiv.querySelectorAll('.autocomplete-suggestion');
                items.forEach((item, idx) => {
                    if (idx === selectedIndex) {
                        item.style.background = 'rgba(0, 122, 255, 0.3)';
                        item.style.borderLeft = '3px solid rgba(0, 122, 255, 0.8)';
                        item.style.fontWeight = '500';
                        // Scroll into view if needed
                        item.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
                    } else {
                        item.style.background = '';
                        item.style.borderLeft = '3px solid transparent';
                        item.style.fontWeight = '';
                    }
                });
            }
            
            // Hide suggestions when clicking outside
            document.addEventListener('click', (e) => {
                if (!badgeContainer.contains(e.target) && !suggestionsDiv.contains(e.target)) {
                    suggestionsDiv.style.display = 'none';
                }
            });
        }
        
        // Loads and updates badge display text for Collections/Playlists
        // Replaces IDs with names after fetching from API
        async function loadBadgeNames(prefix, sectionIndex, type) {
            if (type !== 'Collection' && type !== 'Playlist') return;
            
            const badgeContainer = modalInstance.dialogContent.querySelector(
                `.tag-badge-container[data-section-index="${sectionIndex}"][data-type="${type}"]`
            );
            if (!badgeContainer) return;
            
            const badges = badgeContainer.querySelectorAll('.tag-badge[data-loading="true"]');
            if (badges.length === 0) return;
            
            try {
                const itemType = type === 'Playlist' ? 'Playlist' : 'BoxSet,CollectionFolder';
                const data = await window.apiHelper.getItems(
                    {
                        IncludeItemTypes: itemType,
                        Recursive: true,
                        Fields: 'ItemCounts'
                    },
                    true,
                    300000
                );
                
                const items = data.Items || [];
                const itemMap = new Map(items.map(item => [item.Id, item]));
                
                badges.forEach(badge => {
                    const id = badge.getAttribute('data-value');
                    const item = itemMap.get(id);
                    if (item) {
                        const displayText = item.Name;
                        badge.innerHTML = `${displayText}<button type="button" class="tag-badge-remove" style="background: none; border: none; color: rgba(255,255,255,0.7); cursor: pointer; padding: 0; margin-left: 0.25em; font-size: 1.2em; line-height: 1; display: flex; align-items: center;" title="Remove">×</button>`;
                        badge.removeAttribute('data-loading');
                    } else {
                        // Item not found, keep ID display
                        badge.removeAttribute('data-loading');
                    }
                });
            } catch (err) {
                console.error('[KefinTweaks Configuration] Error loading badge names:', err);
                badges.forEach(badge => badge.removeAttribute('data-loading'));
            }
        }
        
        // Setup dropdown for Include Item Types field
        function setupIncludeItemTypesDropdown(prefix, sectionIndex, availableTypes) {
            const badgeContainer = modalInstance.dialogContent.querySelector(
                `.includeItemTypes-badge-container[data-section-index="${sectionIndex}"]`
            );
            const toggleButton = badgeContainer?.querySelector('.includeItemTypes-dropdown-toggle');
            const dropdown = badgeContainer?.querySelector('.includeItemTypes-dropdown');
            const checkboxNodes = badgeContainer ? Array.from(badgeContainer.querySelectorAll('.includeItemTypes-option')) : [];
            const proxyInput = modalInstance.dialogContent.querySelector(
                `.${prefix}_section_includeItemTypes[data-section-index="${sectionIndex}"]`
            );
            const hiddenInput = modalInstance.dialogContent.querySelector(
                `.${prefix}_section_includeItemTypes_hidden[data-section-index="${sectionIndex}"]`
            );
            const badgesWrapper = badgeContainer?.querySelector('.includeItemTypes-badges');
            const emptyState = badgeContainer?.querySelector('.includeItemTypes-empty');
            const clearAllBtn = modalInstance.dialogContent.querySelector(
                `.badge-clear-all[data-section-index="${sectionIndex}"][data-field="includeItemTypes"]`
            );
            const allowedTypeSet = new Set((availableTypes || []).map(type => type.toLowerCase()));
            
            if (!badgeContainer || !dropdown || !proxyInput || !hiddenInput || !badgesWrapper) return;
            
            const closeDropdown = () => {
                dropdown.style.display = 'none';
                toggleButton?.setAttribute('aria-expanded', 'false');
            };
            
            const openDropdown = () => {
                dropdown.style.display = 'block';
                toggleButton?.setAttribute('aria-expanded', 'true');
            };
            
            toggleButton?.addEventListener('click', (e) => {
                e.stopPropagation();
                const isOpen = dropdown.style.display === 'block';
                if (isOpen) {
                    closeDropdown();
                } else {
                    openDropdown();
                }
            });
            
            document.addEventListener('click', (e) => {
                if (!badgeContainer.contains(e.target)) {
                    closeDropdown();
                }
            });
            
            const updateEmptyState = () => {
                const hasBadges = badgesWrapper.querySelector('.tag-badge');
                if (hasBadges) {
                    emptyState?.setAttribute('hidden', 'true');
                } else {
                    emptyState?.removeAttribute('hidden');
                }
            };
            
            // Setup badge remove handlers
            badgeContainer.addEventListener('click', (e) => {
                if (e.target.classList.contains('tag-badge-remove') || e.target.closest('.tag-badge-remove')) {
                    const badge = e.target.closest('.tag-badge');
                    if (badge) {
                        const value = badge.getAttribute('data-value');
                        const checkbox = checkboxNodes.find(cb => cb.value === value);
                        if (checkbox) {
                            checkbox.checked = false;
                        }
                        BadgeSystem.removeBadge(prefix, sectionIndex, badge, badgeContainer, hiddenInput);
                        updateEmptyState();
                        syncToggleLabel();
                    }
                }
            });
            
            const syncToggleLabel = () => {
                const count = badgesWrapper.querySelectorAll('.tag-badge').length;
                if (toggleButton) {
                    const textSpan = toggleButton.querySelector('.includeItemTypes-toggle-label');
                    if (textSpan) {
                        textSpan.textContent = count > 0 ? `${count} selected` : 'Select item types';
                    }
                }
            };
            
            const handleCheckboxChange = (checkbox) => {
                const value = checkbox.value;
                if (!value || (allowedTypeSet.size && !allowedTypeSet.has(value.toLowerCase()))) return;
                
                if (checkbox.checked) {
                    BadgeSystem.addBadge(prefix, sectionIndex, value, value, badgeContainer, proxyInput, hiddenInput);
                } else {
                    const badge = badgesWrapper.querySelector(`.tag-badge[data-value="${value}"]`);
                    if (badge) {
                        BadgeSystem.removeBadge(prefix, sectionIndex, badge, badgeContainer, hiddenInput);
                    } else {
                        BadgeSystem.updateHiddenInput(prefix, sectionIndex, badgeContainer, hiddenInput);
                    }
                }
                updateEmptyState();
                syncToggleLabel();
            };
            
            checkboxNodes.forEach(checkbox => {
                checkbox.addEventListener('change', () => handleCheckboxChange(checkbox));
            });
            
            // Setup clear all button
            if (clearAllBtn) {
                clearAllBtn.addEventListener('click', () => {
                    checkboxNodes.forEach(cb => {
                        cb.checked = false;
                    });
                    BadgeSystem.clearAll(prefix, sectionIndex, badgeContainer, hiddenInput);
                    updateEmptyState();
                    syncToggleLabel();
                });
            }
            
            // Ensure badges match checked state on init
            checkboxNodes.forEach(cb => {
                if (cb.checked && !badgesWrapper.querySelector(`.tag-badge[data-value="${cb.value}"]`)) {
                    BadgeSystem.addBadge(prefix, sectionIndex, cb.value, cb.value, badgeContainer, proxyInput, hiddenInput);
                }
            });
            updateEmptyState();
            syncToggleLabel();
        }
        
        // Seasonal season management functions (exposed globally for onclick handlers)
        window.addNewSeasonalSeason = function() {
            const seasonsList = modalInstance.dialogContent.querySelector('#homeScreen_seasonal_seasons_list');
            if (!seasonsList) return;
            
            const newIndex = seasonsList.querySelectorAll('.seasonal-season-item').length;
            const newSeason = {
                id: `season-${newIndex}`,
                enabled: true,
                name: 'New Season',
                startDate: '',
                endDate: '',
                order: 100,
                sections: []
            };
            
            const newSeasonHtml = `
                <details class="seasonal-season-item" data-season-index="${newIndex}" style="border: 1px solid rgba(255,255,255,0.2); border-radius: 4px; padding: 0; margin-bottom: 1em; background: rgba(255,255,255,0.02);">
                    <summary class="seasonal-season-summary" data-season-index="${newIndex}" style="display: flex; justify-content: space-between; align-items: center; padding: 1em; cursor: pointer; list-style: none; user-select: none;">
                        <div class="listItemBodyText" style="font-weight: 500; display: flex; align-items: center; gap: 0.5em;">
                            <span class="material-icons" style="font-size: 1.2em; transition: transform 0.2s;">chevron_right</span>
                        <span class="seasonal-season-name-display" data-season-index="${newIndex}">New Season</span>
                        <span class="listItemBodyText secondary" style="font-size: 0.9em; font-weight: normal;">(<span class="seasonal-season-enabled-display" data-season-index="${newIndex}">Enabled</span>, Order: <span class="seasonal-season-order" data-season-index="${newIndex}">100</span>)</span>
                        </div>
                        <div style="display: flex; gap: 0.5em;">
                            <button class="emby-button" onclick="deleteSeasonalSeason(${newIndex})" style="padding: 0.5em 1em; font-size: 0.9em; background: rgba(255,0,0,0.2);">Delete</button>
                        </div>
                    </summary>
                    <div style="padding: 0 1em 1em 1em; border-top: 1px solid rgba(255,255,255,0.1);">
                        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 0.75em; margin-bottom: 0.75em; margin-top: 0.75em;">
                            <div>
                                <div class="listItemBodyText secondary" style="font-size: 0.85em; margin-bottom: 0.25em;">Enabled</div>
                                ${buildJellyfinCheckbox(`seasonal-season-enabled-${newIndex}`, true, 'Enabled', { 'data-index': newIndex, 'class': 'seasonal-season-enabled' })}
                            </div>
                            <div>
                                <div class="listItemBodyText secondary" style="font-size: 0.85em; margin-bottom: 0.25em;">Name</div>
                                <input type="text" class="seasonal-season-name fld emby-input" data-index="${newIndex}" value="" style="width: 100%;">
                            </div>
                            <div>
                                <div class="listItemBodyText secondary" style="font-size: 0.85em; margin-bottom: 0.25em;">Start Date (MM-DD)</div>
                                <input type="text" class="seasonal-season-startDate fld emby-input" data-index="${newIndex}" value="" placeholder="10-01" style="width: 100%;">
                            </div>
                            <div>
                                <div class="listItemBodyText secondary" style="font-size: 0.85em; margin-bottom: 0.25em;">End Date (MM-DD)</div>
                                <input type="text" class="seasonal-season-endDate fld emby-input" data-index="${newIndex}" value="" placeholder="10-31" style="width: 100%;">
                            </div>
                            <div>
                                <div class="listItemBodyText secondary" style="font-size: 0.85em; margin-bottom: 0.25em; display: flex; align-items: center; gap: 0.4em;">Order</div>
                                <input type="number" class="seasonal-season-order-input fld emby-input" data-index="${newIndex}" value="100" min="0" style="width: 100%;">
                            </div>
                        </div>
                        <div style="margin-top: 0.75em; margin-bottom: 0.75em;">
                            <div class="listItemBodyText" style="font-weight: 500; margin-bottom: 0.5em;">Sections</div>
                            <div class="seasonal_season_sections_list" data-season-index="${newIndex}">
                            </div>
                            <button type="button" class="emby-button raised add-section-to-seasonal-btn" data-season-index="${newIndex}" style="padding: 0.75em 1.5em; margin-top: 0.5em;">
                                <span>Add Section</span>
                            </button>
                        </div>
                    </div>
                </details>
            `;
            seasonsList.insertAdjacentHTML('beforeend', newSeasonHtml);
            
            // Setup listeners for the new season
            const newSeasonItem = seasonsList.querySelector(`.seasonal-season-item[data-season-index="${newIndex}"]`);
            if (newSeasonItem) {
                const nameInput = newSeasonItem.querySelector(`.seasonal-season-name[data-index="${newIndex}"]`);
                const nameSpan = newSeasonItem.querySelector(`.seasonal-season-name-display[data-season-index="${newIndex}"]`);
                const orderInput = newSeasonItem.querySelector(`.seasonal-season-order-input[data-index="${newIndex}"]`);
                const orderSpan = newSeasonItem.querySelector(`.seasonal-season-order[data-season-index="${newIndex}"]`);
                const enabledCheckbox = newSeasonItem.querySelector(`#seasonal-season-enabled-${newIndex}`) || newSeasonItem.querySelector(`.seasonal-season-enabled[data-index="${newIndex}"]`);
                const enabledSpan = newSeasonItem.querySelector(`.seasonal-season-enabled-display[data-season-index="${newIndex}"]`);
                
                if (nameInput && nameSpan) {
                    nameInput.addEventListener('input', () => {
                        nameSpan.textContent = nameInput.value || 'Unnamed Season';
                    });
                }
                
                if (orderInput && orderSpan) {
                    orderInput.addEventListener('input', () => {
                        orderSpan.textContent = orderInput.value || '100';
                    });
                }
                
                if (enabledCheckbox && enabledSpan) {
                    enabledCheckbox.addEventListener('change', () => {
                        enabledSpan.textContent = enabledCheckbox.checked ? 'Enabled' : 'Disabled';
                    });
                }
            }
        };
        
        // Collection and Playlist picker functions
        window.openCollectionPicker = async function(seasonIndex) {
            if (!window.ModalSystem) {
                alert('Modal system not available');
                return;
            }
            
            try {
                // Fetch collections from server
                const userId = window.ApiClient.getCurrentUserId();
                const serverAddress = window.ApiClient.serverAddress();
                const token = window.ApiClient.accessToken();
                
                const response = await fetch(`${serverAddress}/Users/${userId}/Items?IncludeItemTypes=BoxSet,CollectionFolder&Recursive=true&Fields=ItemCounts`, {
                    headers: { 'X-Emby-Token': token }
                });
                
                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                }
                
                const data = await response.json();
                const collections = data.Items || [];
                
                // Get currently selected collections
                const hiddenInput = modalInstance.dialogContent.querySelector(`.seasonal-season-collections[data-index="${seasonIndex}"]`);
                const selectedIds = hiddenInput ? JSON.parse(hiddenInput.value || '[]') : [];
                
                // Create picker modal
                let pickerModalInstanceRef = null;
                const pickerModal = window.ModalSystem.create({
                    id: 'collectionPickerModal',
                    title: 'Select Collections',
                    content: `
                        <div style="max-height: 60vh; overflow-y: auto;">
                            <div style="margin-bottom: 1em;">
                                <input type="text" id="collectionPickerSearch" class="fld emby-input" placeholder="Search collections..." style="width: 100%;">
                            </div>
                            <div id="collectionPickerList" style="display: flex; flex-direction: column; gap: 0.5em;">
                                ${collections.map(collection => {
                                    const isSelected = selectedIds.includes(collection.Id);
                                    return `
                                        <label class="checkboxContainer" style="padding: 0.75em; border: 1px solid rgba(255,255,255,0.1); border-radius: 4px; cursor: pointer;">
                                            <input type="checkbox" value="${collection.Id}" data-name="${collection.Name}" ${isSelected ? 'checked' : ''}>
                                            <span>${collection.Name} (${collection.ChildCount || 0} items)</span>
                                        </label>
                                    `;
                                }).join('')}
                            </div>
                        </div>
                    `,
                    footer: `
                        <button class="emby-button raised button-submit" id="collectionPickerConfirm" style="padding: 0.75em 2em;">
                            <span>Confirm</span>
                        </button>
                        <button class="emby-button raised" id="collectionPickerCancel" style="padding: 0.75em 2em;">
                            <span>Cancel</span>
                        </button>
                    `,
                    closeOnBackdrop: true,
                    closeOnEscape: true,
                    onOpen: (pickerModalInstance) => {
                        pickerModalInstanceRef = pickerModalInstance;
                        
                        // Set up search filter
                        const searchInput = pickerModalInstance.dialogContent.querySelector('#collectionPickerSearch');
                        if (searchInput) {
                            searchInput.addEventListener('input', (e) => {
                                const list = pickerModalInstance.dialogContent.querySelector('#collectionPickerList');
                                const items = list.querySelectorAll('label');
                                const term = e.target.value.toLowerCase();
                                
                                items.forEach(item => {
                                    const name = item.querySelector('span').textContent.toLowerCase();
                                    item.style.display = name.includes(term) ? '' : 'none';
                                });
                            });
                        }
                        
                        const confirmBtn = pickerModalInstance.dialogFooter?.querySelector('#collectionPickerConfirm');
                        const cancelBtn = pickerModalInstance.dialogFooter?.querySelector('#collectionPickerCancel');
                        
                        if (confirmBtn) {
                            confirmBtn.addEventListener('click', () => {
                                const checkboxes = pickerModalInstance.dialogContent.querySelectorAll('#collectionPickerList input[type="checkbox"]:checked');
                                const selectedIds = Array.from(checkboxes).map(cb => cb.value);
                                
                                // Update hidden input
                                if (hiddenInput) {
                                    hiddenInput.value = JSON.stringify(selectedIds);
                                    
                                    // Update button text and selected count
                                    const button = modalInstance.dialogContent.querySelector(`button[onclick="openCollectionPicker(${seasonIndex})"]`);
                                    const selectedDiv = modalInstance.dialogContent.querySelector(`.seasonal-season-collections-selected[data-index="${seasonIndex}"]`);
                                    
                                    if (button) {
                                        button.querySelector('span').textContent = `Select Collections (${selectedIds.length})`;
                                    }
                                    if (selectedDiv) {
                                        selectedDiv.textContent = selectedIds.length > 0 ? `Selected: ${selectedIds.length} collection(s)` : 'No collections selected';
                                    }
                                }
                                
                                pickerModalInstance.close();
                            });
                        }
                        
                        if (cancelBtn) {
                            cancelBtn.addEventListener('click', () => {
                                pickerModalInstance.close();
                            });
                        }
                    }
                });
                
            } catch (error) {
                console.error('[KefinTweaks Configuration] Error opening collection picker:', error);
                alert('Error loading collections. Please try again.');
            }
        };
        
        window.openPlaylistPicker = async function(seasonIndex) {
            if (!window.ModalSystem) {
                alert('Modal system not available');
                return;
            }
            
            try {
                // Fetch playlists from server
                const userId = window.ApiClient.getCurrentUserId();
                const serverAddress = window.ApiClient.serverAddress();
                const token = window.ApiClient.accessToken();
                
                const response = await fetch(`${serverAddress}/Users/${userId}/Items?IncludeItemTypes=Playlist&Recursive=true&Fields=ItemCounts`, {
                    headers: { 'X-Emby-Token': token }
                });
                
                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                }
                
                const data = await response.json();
                const playlists = data.Items || [];
                
                // Get currently selected playlists
                const hiddenInput = modalInstance.dialogContent.querySelector(`.seasonal-season-playlists[data-index="${seasonIndex}"]`);
                const selectedIds = hiddenInput ? JSON.parse(hiddenInput.value || '[]') : [];
                
                // Create picker modal
                let pickerModalInstanceRef = null;
                const pickerModal = window.ModalSystem.create({
                    id: 'playlistPickerModal',
                    title: 'Select Playlists',
                    content: `
                        <div style="max-height: 60vh; overflow-y: auto;">
                            <div style="margin-bottom: 1em;">
                                <input type="text" id="playlistPickerSearch" class="fld emby-input" placeholder="Search playlists..." style="width: 100%;">
                            </div>
                            <div id="playlistPickerList" style="display: flex; flex-direction: column; gap: 0.5em;">
                                ${playlists.map(playlist => {
                                    const isSelected = selectedIds.includes(playlist.Id);
                                    return `
                                        <label class="checkboxContainer" style="padding: 0.75em; border: 1px solid rgba(255,255,255,0.1); border-radius: 4px; cursor: pointer;">
                                            <input type="checkbox" value="${playlist.Id}" data-name="${playlist.Name}" ${isSelected ? 'checked' : ''}>
                                            <span>${playlist.Name} (${playlist.ChildCount || 0} items)</span>
                                        </label>
                                    `;
                                }).join('')}
                            </div>
                        </div>
                    `,
                    footer: `
                        <button class="emby-button raised button-submit" id="playlistPickerConfirm" style="padding: 0.75em 2em;">
                            <span>Confirm</span>
                        </button>
                        <button class="emby-button raised" id="playlistPickerCancel" style="padding: 0.75em 2em;">
                            <span>Cancel</span>
                        </button>
                    `,
                    closeOnBackdrop: true,
                    closeOnEscape: true,
                    onOpen: (pickerModalInstance) => {
                        pickerModalInstanceRef = pickerModalInstance;
                        
                        // Set up search filter
                        const searchInput = pickerModalInstance.dialogContent.querySelector('#playlistPickerSearch');
                        if (searchInput) {
                            searchInput.addEventListener('input', (e) => {
                                const list = pickerModalInstance.dialogContent.querySelector('#playlistPickerList');
                                const items = list.querySelectorAll('label');
                                const term = e.target.value.toLowerCase();
                                
                                items.forEach(item => {
                                    const name = item.querySelector('span').textContent.toLowerCase();
                                    item.style.display = name.includes(term) ? '' : 'none';
                                });
                            });
                        }
                        
                        const confirmBtn = pickerModalInstance.dialogFooter?.querySelector('#playlistPickerConfirm');
                        const cancelBtn = pickerModalInstance.dialogFooter?.querySelector('#playlistPickerCancel');
                        
                        if (confirmBtn) {
                            confirmBtn.addEventListener('click', () => {
                                const checkboxes = pickerModalInstance.dialogContent.querySelectorAll('#playlistPickerList input[type="checkbox"]:checked');
                                const selectedIds = Array.from(checkboxes).map(cb => cb.value);
                                
                                // Update hidden input
                                if (hiddenInput) {
                                    hiddenInput.value = JSON.stringify(selectedIds);
                                    
                                    // Update button text and selected count
                                    const button = modalInstance.dialogContent.querySelector(`button[onclick="openPlaylistPicker(${seasonIndex})"]`);
                                    const selectedDiv = modalInstance.dialogContent.querySelector(`.seasonal-season-playlists-selected[data-index="${seasonIndex}"]`);
                                    
                                    if (button) {
                                        button.querySelector('span').textContent = `Select Playlists (${selectedIds.length})`;
                                    }
                                    if (selectedDiv) {
                                        selectedDiv.textContent = selectedIds.length > 0 ? `Selected: ${selectedIds.length} playlist(s)` : 'No playlists selected';
                                    }
                                }
                                
                                pickerModalInstance.close();
                            });
                        }
                        
                        if (cancelBtn) {
                            cancelBtn.addEventListener('click', () => {
                                pickerModalInstance.close();
                            });
                        }
                    }
                });
                
            } catch (error) {
                console.error('[KefinTweaks Configuration] Error opening playlist picker:', error);
                alert('Error loading playlists. Please try again.');
            }
        };
        
        // Picker functions for sections (used in nested sections)
        async function openCollectionPickerForSection(prefix, sectionIndex, isSeasonalNested) {
            if (!window.ModalSystem) {
                alert('Modal system not available');
                return;
            }
            
            try {
                const userId = window.ApiClient.getCurrentUserId();
                const serverAddress = window.ApiClient.serverAddress();
                const token = window.ApiClient.accessToken();
                
                const response = await fetch(`${serverAddress}/Users/${userId}/Items?IncludeItemTypes=BoxSet,CollectionFolder&Recursive=true&Fields=ItemCounts`, {
                    headers: { 'X-Emby-Token': token }
                });
                
                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                }
                
                const data = await response.json();
                const collections = data.Items || [];
                
                const sectionItem = modalInstance.dialogContent.querySelector(`.${prefix}_section_item[data-section-index="${sectionIndex}"]`);
                const sourceInput = sectionItem?.querySelector(`.${prefix}_section_source[data-section-index="${sectionIndex}"]`);
                const currentSource = sourceInput ? sourceInput.value : '';
                const selectedId = currentSource || null;
                
                const pickerModal = window.ModalSystem.create({
                    id: 'collectionPickerForSectionModal',
                    title: 'Select Collection',
                    content: `
                        <div style="max-height: 60vh; overflow-y: auto;">
                            <div style="margin-bottom: 1em;">
                                <input type="text" id="collectionPickerForSectionSearch" class="fld emby-input" placeholder="Search collections..." style="width: 100%;">
                            </div>
                            <div id="collectionPickerForSectionList" style="display: flex; flex-direction: column; gap: 0.5em;">
                                ${collections.map(collection => {
                                    const isSelected = collection.Id === selectedId;
                                    return `
                                        <label class="checkboxContainer" style="padding: 0.75em; border: 1px solid rgba(255,255,255,0.1); border-radius: 4px; cursor: pointer;">
                                            <input type="radio" name="collectionPickerForSection" value="${collection.Id}" ${isSelected ? 'checked' : ''}>
                                            <span>${collection.Name} (${collection.ChildCount || 0} items)</span>
                                        </label>
                                    `;
                                }).join('')}
                            </div>
                        </div>
                    `,
                    footer: `
                        <button class="emby-button raised" id="collectionPickerForSectionClear" style="padding: 0.75em 2em; margin-right: 0.5em;">
                            <span>Clear</span>
                        </button>
                        <button class="emby-button raised button-submit" id="collectionPickerForSectionConfirm" style="padding: 0.75em 2em;">
                            <span>Confirm</span>
                        </button>
                        <button class="emby-button raised" id="collectionPickerForSectionCancel" style="padding: 0.75em 2em;">
                            <span>Cancel</span>
                        </button>
                    `,
                    closeOnBackdrop: true,
                    closeOnEscape: true,
                    onOpen: (pickerModalInstance) => {
                        const searchInput = pickerModalInstance.dialogContent.querySelector('#collectionPickerForSectionSearch');
                        if (searchInput) {
                            searchInput.addEventListener('input', (e) => {
                                const list = pickerModalInstance.dialogContent.querySelector('#collectionPickerForSectionList');
                                const items = list.querySelectorAll('label');
                                const term = e.target.value.toLowerCase();
                                items.forEach(item => {
                                    const name = item.querySelector('span').textContent.toLowerCase();
                                    item.style.display = name.includes(term) ? '' : 'none';
                                });
                            });
                        }
                        
                        const confirmBtn = pickerModalInstance.dialogFooter?.querySelector('#collectionPickerForSectionConfirm');
                        const clearBtn = pickerModalInstance.dialogFooter?.querySelector('#collectionPickerForSectionClear');
                        const cancelBtn = pickerModalInstance.dialogFooter?.querySelector('#collectionPickerForSectionCancel');
                        
                        if (confirmBtn) {
                            confirmBtn.addEventListener('click', () => {
                                const selected = pickerModalInstance.dialogContent.querySelector('#collectionPickerForSectionList input[type="radio"]:checked');
                                const selectedId = selected ? selected.value : '';
                                
                                if (sourceInput) {
                                    sourceInput.value = selectedId;
                                    
                                    const button = sectionItem?.querySelector(`button[onclick*="openCollectionPickerForSection"]`);
                                    const selectedDiv = sectionItem?.querySelector(`.${prefix}_section_collection_selected[data-section-index="${sectionIndex}"]`);
                                    
                                    if (button) {
                                        button.querySelector('span').textContent = `Select Collection ${selectedId ? '(1)' : ''}`;
                                    }
                                    if (selectedDiv) {
                                        selectedDiv.textContent = selectedId ? `Selected: 1 collection` : 'No collection selected';
                                    }
                                }
                                
                                pickerModalInstance.close();
                            });
                        }
                        
                        if (clearBtn) {
                            clearBtn.addEventListener('click', () => {
                                const radios = pickerModalInstance.dialogContent.querySelectorAll('#collectionPickerForSectionList input[type="radio"]');
                                radios.forEach(radio => radio.checked = false);
                                
                                if (sourceInput) {
                                    sourceInput.value = '';
                                    
                                    const button = sectionItem?.querySelector(`button[onclick*="openCollectionPickerForSection"]`);
                                    const selectedDiv = sectionItem?.querySelector(`.${prefix}_section_collection_selected[data-section-index="${sectionIndex}"]`);
                                    
                                    if (button) {
                                        button.querySelector('span').textContent = 'Select Collection';
                                    }
                                    if (selectedDiv) {
                                        selectedDiv.textContent = 'No collection selected';
                                    }
                                }
                                
                                pickerModalInstance.close();
                            });
                        }
                        
                        if (cancelBtn) {
                            cancelBtn.addEventListener('click', () => {
                                pickerModalInstance.close();
                            });
                        }
                    }
                });
            } catch (error) {
                console.error('[KefinTweaks Configuration] Error opening collection picker for section:', error);
                alert('Error loading collections. Please try again.');
            }
        };
        
        async function openPlaylistPickerForSection(prefix, sectionIndex, isSeasonalNested) {
            if (!window.ModalSystem) {
                alert('Modal system not available');
                return;
            }
            
            try {
                const userId = window.ApiClient.getCurrentUserId();
                const serverAddress = window.ApiClient.serverAddress();
                const token = window.ApiClient.accessToken();
                
                const response = await fetch(`${serverAddress}/Users/${userId}/Items?IncludeItemTypes=Playlist&Recursive=true&Fields=ItemCounts`, {
                    headers: { 'X-Emby-Token': token }
                });
                
                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                }
                
                const data = await response.json();
                const playlists = data.Items || [];
                
                const sectionItem = modalInstance.dialogContent.querySelector(`.${prefix}_section_item[data-section-index="${sectionIndex}"]`);
                const sourceInput = sectionItem?.querySelector(`.${prefix}_section_source[data-section-index="${sectionIndex}"]`);
                const currentSource = sourceInput ? sourceInput.value : '';
                const selectedId = currentSource || null;
                
                const pickerModal = window.ModalSystem.create({
                    id: 'playlistPickerForSectionModal',
                    title: 'Select Playlist',
                    content: `
                        <div style="max-height: 60vh; overflow-y: auto;">
                            <div style="margin-bottom: 1em;">
                                <input type="text" id="playlistPickerForSectionSearch" class="fld emby-input" placeholder="Search playlists..." style="width: 100%;">
                            </div>
                            <div id="playlistPickerForSectionList" style="display: flex; flex-direction: column; gap: 0.5em;">
                                ${playlists.map(playlist => {
                                    const isSelected = playlist.Id === selectedId;
                                    return `
                                        <label class="checkboxContainer" style="padding: 0.75em; border: 1px solid rgba(255,255,255,0.1); border-radius: 4px; cursor: pointer;">
                                            <input type="radio" name="playlistPickerForSection" value="${playlist.Id}" ${isSelected ? 'checked' : ''}>
                                            <span>${playlist.Name} (${playlist.ChildCount || 0} items)</span>
                                        </label>
                                    `;
                                }).join('')}
                            </div>
                        </div>
                    `,
                    footer: `
                        <button class="emby-button raised" id="playlistPickerForSectionClear" style="padding: 0.75em 2em; margin-right: 0.5em;">
                            <span>Clear</span>
                        </button>
                        <button class="emby-button raised button-submit" id="playlistPickerForSectionConfirm" style="padding: 0.75em 2em;">
                            <span>Confirm</span>
                        </button>
                        <button class="emby-button raised" id="playlistPickerForSectionCancel" style="padding: 0.75em 2em;">
                            <span>Cancel</span>
                        </button>
                    `,
                    closeOnBackdrop: true,
                    closeOnEscape: true,
                    onOpen: (pickerModalInstance) => {
                        const searchInput = pickerModalInstance.dialogContent.querySelector('#playlistPickerForSectionSearch');
                        if (searchInput) {
                            searchInput.addEventListener('input', (e) => {
                                const list = pickerModalInstance.dialogContent.querySelector('#playlistPickerForSectionList');
                                const items = list.querySelectorAll('label');
                                const term = e.target.value.toLowerCase();
                                items.forEach(item => {
                                    const name = item.querySelector('span').textContent.toLowerCase();
                                    item.style.display = name.includes(term) ? '' : 'none';
                                });
                            });
                        }
                        
                        const confirmBtn = pickerModalInstance.dialogFooter?.querySelector('#playlistPickerForSectionConfirm');
                        const clearBtn = pickerModalInstance.dialogFooter?.querySelector('#playlistPickerForSectionClear');
                        const cancelBtn = pickerModalInstance.dialogFooter?.querySelector('#playlistPickerForSectionCancel');
                        
                        if (confirmBtn) {
                            confirmBtn.addEventListener('click', () => {
                                const selected = pickerModalInstance.dialogContent.querySelector('#playlistPickerForSectionList input[type="radio"]:checked');
                                const selectedId = selected ? selected.value : '';
                                
                                if (sourceInput) {
                                    sourceInput.value = selectedId;
                                    
                                    const button = sectionItem?.querySelector(`button[onclick*="openPlaylistPickerForSection"]`);
                                    const selectedDiv = sectionItem?.querySelector(`.${prefix}_section_playlist_selected[data-section-index="${sectionIndex}"]`);
                                    
                                    if (button) {
                                        button.querySelector('span').textContent = `Select Playlist ${selectedId ? '(1)' : ''}`;
                                    }
                                    if (selectedDiv) {
                                        selectedDiv.textContent = selectedId ? `Selected: 1 playlist` : 'No playlist selected';
                                    }
                                }
                                
                                pickerModalInstance.close();
                            });
                        }
                        
                        if (clearBtn) {
                            clearBtn.addEventListener('click', () => {
                                const radios = pickerModalInstance.dialogContent.querySelectorAll('#playlistPickerForSectionList input[type="radio"]');
                                radios.forEach(radio => radio.checked = false);
                                
                                if (sourceInput) {
                                    sourceInput.value = '';
                                    
                                    const button = sectionItem?.querySelector(`button[onclick*="openPlaylistPickerForSection"]`);
                                    const selectedDiv = sectionItem?.querySelector(`.${prefix}_section_playlist_selected[data-section-index="${sectionIndex}"]`);
                                    
                                    if (button) {
                                        button.querySelector('span').textContent = 'Select Playlist';
                                    }
                                    if (selectedDiv) {
                                        selectedDiv.textContent = 'No playlist selected';
                                    }
                                }
                                
                                pickerModalInstance.close();
                            });
                        }
                        
                        if (cancelBtn) {
                            cancelBtn.addEventListener('click', () => {
                                pickerModalInstance.close();
                            });
                        }
                    }
                });
            } catch (error) {
                console.error('[KefinTweaks Configuration] Error opening playlist picker for section:', error);
                alert('Error loading playlists. Please try again.');
            }
        };
        
        window.editSeasonalSeason = function(index) {
            // For now, editing is done inline - this could open a modal in the future
            console.log('Edit seasonal season', index);
        };
        
        window.deleteSeasonalSeason = function(index) {
            const seasonsList = modalInstance.dialogContent.querySelector('#homeScreen_seasonal_seasons_list');
            if (!seasonsList) return;
            
            const seasonItem = seasonsList.querySelector(`.seasonal-season-item[data-season-index="${index}"]`);
            if (seasonItem && confirm('Are you sure you want to delete this season?')) {
                seasonItem.remove();
                // Re-index remaining items
                const remainingItems = seasonsList.querySelectorAll('.seasonal-season-item');
                remainingItems.forEach((item, newIndex) => {
                    item.setAttribute('data-season-index', newIndex);
                    item.querySelectorAll('[data-index]').forEach(el => {
                        el.setAttribute('data-index', newIndex);
                    });
                    const editBtn = item.querySelector('button[onclick*="editSeasonalSeason"]');
                    const deleteBtn = item.querySelector('button[onclick*="deleteSeasonalSeason"]');
                    if (editBtn) editBtn.setAttribute('onclick', `editSeasonalSeason(${newIndex})`);
                    if (deleteBtn) deleteBtn.setAttribute('onclick', `deleteSeasonalSeason(${newIndex})`);
                });
            }
        };

        // Toggle visibility of configuration sections based on script enable state
        const scriptCheckboxes = {
            search: modalInstance.dialogContent.querySelector('#script_search'),
            exclusiveElsewhere: modalInstance.dialogContent.querySelector('#script_exclusiveElsewhere'),
            skinManager: modalInstance.dialogContent.querySelector('#script_skinManager'),
            customMenuLinks: modalInstance.dialogContent.querySelector('#script_customMenuLinks'),
            flattenSingleSeasonShows: modalInstance.dialogContent.querySelector('#script_flattenSingleSeasonShows')
        };

        const configSections = {
            search: modalInstance.dialogContent.querySelector('#configSection_search'),
            exclusiveElsewhere: modalInstance.dialogContent.querySelector('#configSection_exclusiveElsewhere'),
            skin: modalInstance.dialogContent.querySelector('#configSection_skin'),
            theme: modalInstance.dialogContent.querySelector('#configSection_theme'),
            customMenuLinks: modalInstance.dialogContent.querySelector('#configSection_customMenuLinks'),
            flattenSingleSeasonShows: modalInstance.dialogContent.querySelector('#configSection_flattenSingleSeasonShows')
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
        
        // Initialize pending state for optional includes to track changes across category switches
        // Deep copy initial config to avoid mutating reference before save
        const pendingOptionalIncludes = JSON.parse(JSON.stringify(config.optionalIncludes || []));
        let currentOptionalIncludesCategory = 'global';

        // Optional includes category dropdown handler
        const optionalIncludesCategory = modalInstance.dialogContent.querySelector('#optionalIncludesCategory');
        if (optionalIncludesCategory) {
            optionalIncludesCategory.addEventListener('change', (e) => {
                const newCategory = e.target.value;
                
                // 1. Capture changes from the PREVIOUS category before switching
                const currentCheckboxes = modalInstance.dialogContent.querySelectorAll(`.optionalIncludeCheckbox[data-category="${currentOptionalIncludesCategory}"]`);
                currentCheckboxes.forEach(checkbox => {
                    const key = checkbox.getAttribute('data-key');
                    const enabled = checkbox.checked;
                    
                    const existingIndex = pendingOptionalIncludes.findIndex(item => item.key === key);
                    if (existingIndex >= 0) {
                        pendingOptionalIncludes[existingIndex].enabled = enabled;
                    } else {
                        pendingOptionalIncludes.push({ key, enabled });
                    }
                });

                // Update current category tracker
                currentOptionalIncludesCategory = newCategory;

                const editor = modalInstance.dialogContent.querySelector('#optionalIncludesEditor');
                if (editor) {
                    // Create a temporary config object that uses our pending state
                    // This ensures buildOptionalIncludesEditor renders checkboxes with the correct pending state
                    const currentConfig = { 
                        ...(window.KefinTweaksConfig || config), 
                        optionalIncludes: pendingOptionalIncludes 
                    };
                    
                    editor.innerHTML = buildOptionalIncludesEditor(newCategory, currentConfig, window.KefinTweaksSkinConfig || []);
                    // Re-attach checkbox handlers
                    attachOptionalIncludesCheckboxHandlers(modalInstance, newCategory, currentConfig);
                }
            });
        }
        
        // Attach initial checkbox handlers
        attachOptionalIncludesCheckboxHandlers(modalInstance, 'global', config);
        
        if (scriptCheckboxes.customMenuLinks) {
            scriptCheckboxes.customMenuLinks.addEventListener('change', () => toggleSectionVisibility('customMenuLinks', 'customMenuLinks'));
        }

        if (scriptCheckboxes.flattenSingleSeasonShows) {
            scriptCheckboxes.flattenSingleSeasonShows.addEventListener('change', () => toggleSectionVisibility('flattenSingleSeasonShows', 'flattenSingleSeasonShows'));
        }

        // Save button handler
        const saveBtn = modalInstance.dialogFooter?.querySelector('#saveConfigBtn');
        if (saveBtn) {
            saveBtn.addEventListener('click', () => {
                // Capture changes from the CURRENT category one last time
                const currentCheckboxes = modalInstance.dialogContent.querySelectorAll(`.optionalIncludeCheckbox[data-category="${currentOptionalIncludesCategory}"]`);
                currentCheckboxes.forEach(checkbox => {
                    const key = checkbox.getAttribute('data-key');
                    const enabled = checkbox.checked;
                    
                    const existingIndex = pendingOptionalIncludes.findIndex(item => item.key === key);
                    if (existingIndex >= 0) {
                        pendingOptionalIncludes[existingIndex].enabled = enabled;
                    } else {
                        pendingOptionalIncludes.push({ key, enabled });
                    }
                });

                handleSaveConfig(modalInstance, pendingOptionalIncludes);
            });
        }

        const resetBtn = modalInstance.dialogFooter?.querySelector('#resetConfigBtn');
        if (resetBtn) {
            resetBtn.addEventListener('click', () => handleResetConfig(modalInstance));
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

        // Remove duplicate defaults button handler
        const removeDuplicateDefaultsBtn = modalInstance.dialogContent.querySelector('#removeDuplicateDefaultsBtn');
        if (removeDuplicateDefaultsBtn) {
            removeDuplicateDefaultsBtn.addEventListener('click', () => handleRemoveDuplicateDefaults(modalInstance));
        }
    }
    
    // Handle removing custom skins that override defaults
    function handleRemoveDuplicateDefaults(modalInstance) {
        const skinsTextarea = modalInstance.dialogContent.querySelector('#skinsJson');
        if (!skinsTextarea) return;
        
        try {
            const currentSkins = JSON.parse(skinsTextarea.value || '[]');
            const defaultSkinNames = new Set((window.KefinTweaksDefaultSkinsConfig?.skins || []).map(s => s.name));
            
            // Filter out skins that match default names
            const filteredSkins = currentSkins.filter(skin => !defaultSkinNames.has(skin.name));
            const removedCount = currentSkins.length - filteredSkins.length;
            
            if (removedCount === 0) {
                if (window.KefinTweaksToaster && window.KefinTweaksToaster.toast) {
                    window.KefinTweaksToaster.toast('No duplicate default skins found in configuration');
                } else {
                    alert('No duplicate default skins found in configuration');
                }
                return;
            }
            
            // Update textarea
            skinsTextarea.value = JSON.stringify(filteredSkins, null, 2);
            
            // Show confirmation
            if (window.KefinTweaksToaster && window.KefinTweaksToaster.toast) {
                window.KefinTweaksToaster.toast(`Removed ${removedCount} custom skin${removedCount > 1 ? 's' : ''} that were overriding defaults`);
            } else {
                alert(`Removed ${removedCount} custom skin${removedCount > 1 ? 's' : ''} that were overriding defaults`);
            }
        } catch (error) {
            console.error('[KefinTweaks Configuration] Error removing duplicate defaults:', error);
            if (window.KefinTweaksToaster && window.KefinTweaksToaster.toast) {
                window.KefinTweaksToaster.toast('Error processing skins JSON', '5');
            } else {
                alert('Error processing skins JSON. Please check the format.');
            }
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

    function getSectionConfigFromUI(rootElement, prefix, sectionIndex) {
        const scope = rootElement || document;
        const sectionItem = scope.querySelector(`.${prefix}_section_item[data-section-index="${sectionIndex}"]`);
        if (!sectionItem) return null;
        
        const sanitizedIndex = sectionIndex.toString().replace(/[^a-zA-Z0-9]/g, '_');
        const sectionIdAttr = sectionItem.getAttribute('data-section-id') || `${prefix}-section-${sanitizedIndex}`;
        
        const enabledCheckbox = sectionItem.querySelector(`#${prefix}_section_enabled_${sanitizedIndex}`) || sectionItem.querySelector(`.${prefix}_section_enabled[data-section-index="${sectionIndex}"]`);
        const enabled = enabledCheckbox?.checked !== false;
        const name = sectionItem.querySelector(`.${prefix}_section_name[data-section-index="${sectionIndex}"]`)?.value || '';
        const type = sectionItem.querySelector(`.${prefix}_section_type[data-section-index="${sectionIndex}"]`)?.value || 'Genre';
        
        let source = '';
        const sourceContainer = sectionItem.querySelector(`.${prefix}_section_source_container[data-section-index="${sectionIndex}"]`);
        const badgeContainer = sourceContainer?.querySelector(`.tag-badge-container[data-section-index="${sectionIndex}"][data-type]`) || null;
        if (badgeContainer) {
            const badges = badgeContainer.querySelectorAll('.tag-badge');
            source = Array.from(badges).map(badge => badge.getAttribute('data-value')).filter(Boolean).join(', ');
        } else {
            const sourceInput = sectionItem.querySelector(`.${prefix}_section_source[data-section-index="${sectionIndex}"]`);
            source = sourceInput ? sourceInput.value : '';
        }
        
        const itemLimit = parseInt(sectionItem.querySelector(`#${prefix}_section_${sanitizedIndex}_itemLimit`)?.value || '16', 10);
        const sortOrder = sectionItem.querySelector(`#${prefix}_section_${sanitizedIndex}_sortOrder`)?.value || 'Random';
        const sortOrderDirection = sectionItem.querySelector(`#${prefix}_section_${sanitizedIndex}_sortOrderDirection`)?.value || 'Ascending';
        const cardFormat = sectionItem.querySelector(`#${prefix}_section_${sanitizedIndex}_cardFormat`)?.value || 'Poster';
        const order = parseInt(sectionItem.querySelector(`#${prefix}_section_${sanitizedIndex}_order`)?.value || '100', 10);
        
        const renderModeSelect = sectionItem.querySelector(`.${prefix}_section_renderMode[data-section-index="${sectionIndex}"]`);
        const renderMode = renderModeSelect ? renderModeSelect.value : 'Normal';
        const spotlight = renderMode === 'Spotlight'; // Legacy compatibility
        
        const discoveryCheckbox = sectionItem.querySelector(`#${prefix}_section_${sanitizedIndex}_discovery`) || sectionItem.querySelector(`.${prefix}_section_discovery[data-section-index="${sectionIndex}"]`);
        const discoveryEnabled = discoveryCheckbox?.checked === true;
        const searchTerm = sectionItem.querySelector(`#${prefix}_section_${sanitizedIndex}_searchTerm`)?.value?.trim() || '';
        
        let includeItemTypes = [];
        const includeItemTypesContainer = sectionItem.querySelector(`.includeItemTypes-badge-container[data-section-index="${sectionIndex}"]`);
        if (includeItemTypesContainer) {
            const badges = includeItemTypesContainer.querySelectorAll('.tag-badge');
            includeItemTypes = Array.from(badges).map(badge => badge.getAttribute('data-value')).filter(Boolean);
        }
        if (includeItemTypes.length === 0 && type !== 'Parent') {
            includeItemTypes = ['Movie'];
        }

        const additionalQueryOptions = [];
        const additionalOptionsContainer = sectionItem.querySelector(`.${prefix}_section_additionalOptions_list_container[data-section-index="${sectionIndex}"]`);
        if (additionalOptionsContainer) {
            const optionRows = additionalOptionsContainer.querySelectorAll('.additional-options-list .additional-option-row');
            optionRows.forEach(row => {
                const input = row.querySelector('.additional-option-value');
                if (input) {
                    const key = input.getAttribute('data-key');
                    const type = input.getAttribute('data-type');
                    let value;
                    if (type === 'boolean') {
                        value = input.checked;
                    } else {
                        value = input.value;
                    }
                    if (key) {
                        additionalQueryOptions.push({ key, value });
                    }
                }
            });
        }
        
        return {
            id: sectionIdAttr,
            enabled: enabled,
            name: name,
            type: type,
            source: source,
            itemLimit: itemLimit,
            sortOrder: sortOrder,
            sortOrderDirection: sortOrderDirection,
            cardFormat: cardFormat,
            order: order,
            renderMode: renderMode,
            spotlight: spotlight,
            discoveryEnabled: discoveryEnabled,
            searchTerm: searchTerm,
            includeItemTypes: includeItemTypes,
            additionalQueryOptions: additionalQueryOptions
        };
    }
    
    async function fetchItemsForSectionPreview(sectionConfig) {
        const apiClient = window.ApiClient;
        if (!apiClient) {
            throw new Error('ApiClient is not available');
        }
        
        const userId = apiClient.getCurrentUserId();
        const type = sectionConfig.type || 'Genre';
        const searchTerm = sectionConfig.searchTerm?.trim() || '';
        const includeItemTypes = Array.isArray(sectionConfig.includeItemTypes) && sectionConfig.includeItemTypes.length > 0
            ? sectionConfig.includeItemTypes.join(',')
            : (sectionConfig.includeItemTypes || 'Movie');
        const sortOrder = sectionConfig.sortOrder || 'Random';
        const sortOrderDirection = sectionConfig.sortOrderDirection || 'Ascending';
        const itemLimit = parseInt(sectionConfig.itemLimit, 10) || 16;
        const sources = (sectionConfig.source || '').split(',').map(s => s.trim()).filter(Boolean);
        const fields = 'PrimaryImageAspectRatio,DateCreated,Overview,ProductionYear,ImageTags,BackdropImageTags,ParentBackdropImageTags,ParentThumbImageTag,SeriesPrimaryImageTag';
        
        // Parse additional query options
        const additionalOptions = {};
        if (Array.isArray(sectionConfig.additionalQueryOptions)) {
            sectionConfig.additionalQueryOptions.forEach(option => {
                if (option && option.key) {
                    let value = option.value;
                    if (value === 'true' || value === true) value = true;
                    else if (value === 'false' || value === false) value = false;
                    additionalOptions[option.key] = value;
                }
            });
        }

        const dedupeAndLimit = (items = []) => {
            let working = Array.isArray(items) ? [...items] : [];
            if (sortOrder === 'Random') {
                working.sort(() => Math.random() - 0.5);
            } else if (window.cardBuilder?.sortItems) {
                working = window.cardBuilder.sortItems(working, sortOrder, sortOrderDirection);
            }
            const seen = new Set();
            const limited = [];
            for (const item of working) {
                if (!item || !item.Id || seen.has(item.Id)) continue;
                seen.add(item.Id);
                limited.push(item);
                if (limited.length >= itemLimit) break;
            }
            return limited;
        };
        
        try {
            const queryBase = {
                IncludeItemTypes: includeItemTypes,
                Recursive: true,
                Fields: fields,
                SortBy: sortOrder,
                SortOrder: sortOrderDirection,
                ...additionalOptions
            };

            if (type === 'Genre' || type === 'Tag') {
                if (sources.length === 0) {
                    return [];
                }
                const paramName = type === 'Genre' ? 'Genres' : 'Tags';
                // Genres use pipe delimiter usually, tags comma?
                // homeScreen.js uses pipe for Genres, comma for Tags.
                // apiClient handles array/string? usually string.
                const delimiter = type === 'Genre' ? '|' : ',';
                const valueParam = sources.join(delimiter); 
                
                const params = {
                    ...queryBase,
                    [paramName]: valueParam,
                    Limit: itemLimit
                };
                if (searchTerm) params.SearchTerm = searchTerm;
                
                const response = await apiClient.getItems(userId, params);
                return dedupeAndLimit(response.Items || []);
            }
            
            if (type === 'Collection' || type === 'Playlist' || type === 'Parent') {
                const existingIds = new Set();
                let collected = [];
                
                const runQuery = async (params) => {
                    const response = await apiClient.getItems(userId, params);
                    if (response?.Items?.length) {
                        response.Items.forEach(item => {
                            if (item && item.Id && !existingIds.has(item.Id)) {
                                existingIds.add(item.Id);
                                collected.push(item);
                            }
                        });
                    }
                };
                
                if (type === 'Parent' && sources.length === 0) {
                    const params = {
                        ...queryBase,
                        Limit: itemLimit * 2
                    };
                    if (searchTerm) params.SearchTerm = searchTerm;
                    await runQuery(params);
                } else {
                    const multiplier = Math.max(1, sources.length);
                    for (const parentId of sources) {
                        const params = {
                            ...queryBase,
                            ParentId: parentId,
                            Limit: itemLimit * multiplier
                        };
                        if (searchTerm) params.SearchTerm = searchTerm;
                        await runQuery(params);
                    }
                }
                
                return dedupeAndLimit(collected);
            }
            
            return [];
        } catch (error) {
            console.warn('[KefinTweaks Configuration] Preview fetch failed:', error);
            throw error;
        }
    }
    
    // Handle save configuration
    async function handleSaveConfig(modalInstance, overrideOptionalIncludes = null) {
        // Verify admin status before saving
        const userIsAdmin = await isAdmin();
        if (!userIsAdmin) {
            alert('You must be an administrator to save configuration.');
            return;
        }

        console.log('[KefinTweaks Configuration] Saving configuration...');
        
        // Collect all form values
        // Preserve existing kefinTweaksRoot from current config (no longer editable in UI)
        const currentConfig = window.KefinTweaksCurrentConfig || {};
        const config = {
            kefinTweaksRoot: currentConfig.kefinTweaksRoot || '',
            scripts: {},
            homeScreen: {},
            exclusiveElsewhere: {},
            search: {},
            defaultSkin: document.getElementById('defaultSkin')?.value || null,
            skins: [],
            themes: [],
            customMenuLinks: []
        };
        config.enabled = modalInstance.dialogContent.querySelector('#kefinTweaksEnabled')?.checked !== false;
        
        // Remove scriptRoot if it exists (legacy field, no longer used)
        if (config.scriptRoot) {
            delete config.scriptRoot;
        }

        // Collect script toggles
        document.querySelectorAll('[data-script-key]').forEach(checkbox => {
            const key = checkbox.getAttribute('data-script-key');
            config.scripts[key] = checkbox.checked;
        });

        // Helper function to get section config
        function getSectionConfig(prefix, includeSortOrderOrOptions = true, includeOrderFlag = true) {
            let includeSortOrder = true;
            let includeOrder = true;
            let includeName = false;
            let defaultName = '';

            if (typeof includeSortOrderOrOptions === 'object') {
                const opts = includeSortOrderOrOptions || {};
                includeSortOrder = opts.includeSortOrder !== undefined ? opts.includeSortOrder : true;
                includeOrder = opts.includeOrder !== undefined ? opts.includeOrder : true;
                includeName = opts.includeName === true;
                defaultName = opts.defaultName || '';
            } else {
                includeSortOrder = includeSortOrderOrOptions !== false;
                includeOrder = includeOrderFlag !== false;
            }

            const config = {
                itemLimit: parseInt(document.getElementById(`${prefix}_itemLimit`)?.value || '16', 10)
            };

            if (includeName) {
                config.name = document.getElementById(`${prefix}_name`)?.value || defaultName || '';
            }

            if (includeSortOrder) {
                config.sortOrder = document.getElementById(`${prefix}_sortOrder`)?.value || 'Random';
                config.sortOrderDirection = document.getElementById(`${prefix}_sortOrderDirection`)?.value || 'Ascending';
            }

            config.cardFormat = document.getElementById(`${prefix}_cardFormat`)?.value || 'Poster';

            if (includeOrder) {
                config.order = parseInt(document.getElementById(`${prefix}_order`)?.value || '100', 10);
            }

            // Check for IsPlayed configuration
            const isPlayedEnabledCheckbox = document.getElementById(`${prefix}_isPlayed_enabled`);
            if (isPlayedEnabledCheckbox) {
                if (isPlayedEnabledCheckbox.checked) {
                    const isPlayedValueSelect = document.getElementById(`${prefix}_isPlayed_value`);
                    config.isPlayed = isPlayedValueSelect?.value === 'true';
                } else {
                    config.isPlayed = null;
                }
            }

            // Handle Min/Max Age In Days for Recently Released
            if (prefix === 'homeScreen_recentlyReleased_movies') {
                const minAge = document.getElementById(`${prefix}_minAgeInDays`)?.value;
                const maxAge = document.getElementById(`${prefix}_maxAgeInDays`)?.value;
                config.minAgeInDays = minAge !== '' ? parseInt(minAge, 10) : null;
                config.maxAgeInDays = maxAge !== '' ? parseInt(maxAge, 10) : null;
            }
            if (prefix === 'homeScreen_recentlyReleased_episodes') {
                const minAge = document.getElementById(`${prefix}_minAgeInDays`)?.value;
                const maxAge = document.getElementById(`${prefix}_maxAgeInDays`)?.value;
                config.minAgeInDays = minAge !== '' ? parseInt(minAge, 10) : null;
                config.maxAgeInDays = maxAge !== '' ? parseInt(maxAge, 10) : null;
            }

            return config;
        }
        
        // Collect seasonal seasons
        function getSeasonalSeasons() {
            const seasons = [];
            const seasonItems = modalInstance.dialogContent.querySelectorAll('.seasonal-season-item');
            seasonItems.forEach((item, seasonIndex) => {
                // Try to find checkbox by ID first, then fall back to class selector
                const enabledCheckbox = item.querySelector(`#seasonal-season-enabled-${seasonIndex}`) || item.querySelector('.seasonal-season-enabled[data-index="${seasonIndex}"]');
                const enabled = enabledCheckbox?.checked !== false;
                const name = item.querySelector('.seasonal-season-name')?.value || '';
                const startDate = item.querySelector('.seasonal-season-startDate')?.value || '';
                const endDate = item.querySelector('.seasonal-season-endDate')?.value || '';
                const orderInput = item.querySelector(`.seasonal-season-order-input[data-index="${seasonIndex}"]`);
                const order = orderInput ? parseInt(orderInput.value || '100', 10) : 100;
                
                // Collect nested sections
                const sectionsList = item.querySelector(`.seasonal_season_sections_list[data-season-index="${seasonIndex}"]`);
                const sections = [];
                if (sectionsList) {
                    const sectionItems = sectionsList.querySelectorAll('.seasonal_season_section_item');
                    sectionItems.forEach((sectionItem, sectionItemIndex) => {
                        const fullIndex = `${seasonIndex}_${sectionItemIndex}`;
                        const sectionConfig = getSectionConfigFromUI(modalInstance.dialogContent, 'seasonal_season', fullIndex);
                        if (sectionConfig) {
                            sections.push(sectionConfig);
                        }
                    });
                }
                
                const seasonConfig = {
                    id: name.toLowerCase().replace(/\s+/g, '-') || `season-${seasonIndex}`,
                    name: name,
                    enabled: enabled,
                    startDate: startDate,
                    endDate: endDate,
                    order: order,
                    sections: sections
                };
                seasons.push(seasonConfig);
            });
            return seasons;
        }
        
        // Collect custom sections
        function getCustomSections() {
            const sectionsList = modalInstance.dialogContent.querySelector('#customSections_list');
            const sections = [];
            
            if (!sectionsList) {
                return sections;
            }
            
            const sectionItems = sectionsList.querySelectorAll('.customSection_section_item');
            sectionItems.forEach((sectionItem, index) => {
                const sectionIndex = sectionItem.getAttribute('data-section-index') ?? index;
                const sectionConfig = getSectionConfigFromUI(modalInstance.dialogContent, 'customSection', sectionIndex);
                if (sectionConfig) {
                    sections.push(sectionConfig);
                }
            });
            
            return sections;
        }

        // Collect home screen config
        config.homeScreen = {
            defaultItemLimit: 16,
            defaultSortOrder: 'Random',
            defaultCardFormat: 'Poster',
            recentlyReleased: {
                enabled: document.getElementById('homeScreen_recentlyReleased_enabled')?.checked !== false,
                movies: {
                    enabled: document.getElementById('homeScreen_recentlyReleased_movies_enabled')?.checked !== false,
                    ...getSectionConfig('homeScreen_recentlyReleased_movies', { includeName: true, defaultName: 'Recently Released Movies', includeSortOrder: true, includeOrder: true, includeIsPlayed: true, includePremiereDays: true })
                },
                episodes: {
                    enabled: document.getElementById('homeScreen_recentlyReleased_episodes_enabled')?.checked !== false,
                    ...getSectionConfig('homeScreen_recentlyReleased_episodes', { includeName: true, defaultName: 'Recently Aired Episodes', includeSortOrder: true, includeOrder: true, includeIsPlayed: true, includePremiereDays: true })
                }
            },
            recentlyAddedInLibrary: (() => {
                const libraryConfigs = {};
                const libraryCheckboxes = modalInstance.dialogContent.querySelectorAll('.recently-added-library-enabled');
                libraryCheckboxes.forEach(checkbox => {
                    const libraryId = checkbox.getAttribute('data-library-id');
                    if (libraryId) {
                        const prefix = `homeScreen_recentlyAddedInLibrary_${libraryId}`;
                        libraryConfigs[libraryId] = {
                            enabled: checkbox.checked !== false,
                            ...getSectionConfig(prefix, { 
                                includeName: true, 
                                defaultName: '', 
                                includeSortOrder: false, 
                                includeOrder: true
                            })
                        };
                    }
                });
                return libraryConfigs;
            })(),
            trending: {
                enabled: document.getElementById('homeScreen_trending_enabled')?.checked === true,
                ...getSectionConfig('homeScreen_trending', { includeName: true, defaultName: 'Trending' })
            },
            popularTVNetworks: {
                enabled: document.getElementById('homeScreen_popularTVNetworks_enabled')?.checked === true,
                minimumShowsForNetwork: parseInt(document.getElementById('homeScreen_popularTVNetworks_minimumShowsForNetwork')?.value || '5'),
                ...getSectionConfig('homeScreen_popularTVNetworks', { includeName: true, defaultName: 'Popular TV Networks' })
            },
            watchlist: {
                enabled: document.getElementById('homeScreen_watchlist_enabled')?.checked === true,
                ...getSectionConfig('homeScreen_watchlist', { includeName: true, defaultName: 'Watchlist' })
            },
            watchAgain: {
                enabled: document.getElementById('homeScreen_watchAgain_enabled')?.checked === true,
                ...getSectionConfig('homeScreen_watchAgain', { includeName: true, defaultName: 'Watch Again' })
            },
            upcoming: {
                enabled: document.getElementById('homeScreen_upcoming_enabled')?.checked !== false,
                ...getSectionConfig('homeScreen_upcoming', { includeSortOrder: false, includeName: true, defaultName: 'Upcoming' })
            },
            imdbTop250: {
                enabled: document.getElementById('homeScreen_imdbTop250_enabled')?.checked !== false,
                ...getSectionConfig('homeScreen_imdbTop250', { includeName: true, defaultName: 'IMDb Top 250' })
            },
            seasonal: {
                enabled: document.getElementById('homeScreen_seasonal_enabled')?.checked !== false,
                enableSeasonalAnimations: document.getElementById('homeScreen_seasonal_enableSeasonalAnimations')?.checked !== false,
                enableSeasonalBackground: document.getElementById('homeScreen_seasonal_enableSeasonalBackground')?.checked !== false,
                defaultItemLimit: 16,
                defaultSortOrder: 'Random',
                defaultCardFormat: 'Poster',
                seasons: getSeasonalSeasons()
            },
            discovery: {
                enabled: document.getElementById('homeScreen_discovery_enabled')?.checked !== false,
                infiniteScroll: document.getElementById('homeScreen_discovery_infiniteScroll')?.checked !== false,
                randomizeOrder: document.getElementById('homeScreen_discovery_randomizeOrder')?.checked === true,
                minPeopleAppearances: parseInt(document.getElementById('homeScreen_discovery_minPeopleAppearances')?.value || '10'),
                minGenreMovieCount: parseInt(document.getElementById('homeScreen_discovery_minGenreMovieCount')?.value || '50'),
                spotlightDiscoveryChance: parseFloat(document.getElementById('homeScreen_discovery_spotlightDiscoveryChance')?.value || '0.5'),
                renderSpotlightAboveMatching: document.getElementById('homeScreen_discovery_renderSpotlightAboveMatching')?.checked === true,
                defaultItemLimit: parseInt(document.getElementById('homeScreen_discovery_itemLimit')?.value || '16'),
                defaultSortOrder: document.getElementById('homeScreen_discovery_sortOrder')?.value || 'Random',
                defaultCardFormat: document.getElementById('homeScreen_discovery_cardFormat')?.value || 'Poster',
                sectionTypes: (() => {
                    const sectionConfigs = {};
                    DISCOVERY_SECTION_DEFINITIONS.forEach(section => {
                        const prefix = `homeScreen_discovery_sectionTypes_${section.key}`;
                        const collectedConfig = getSectionConfig(prefix, { includeName: true, includeOrder: true, includeSortOrder: false, defaultName: section.defaultName });
                        collectedConfig.enabled = document.getElementById(`${prefix}_enabled`)?.checked !== false;
                        if (section.extras?.minimumItems !== undefined) {
                            const minimumValue = parseInt(document.getElementById(`${prefix}_minimumItems`)?.value || `${section.extras.minimumItems}`, 10);
                            collectedConfig.minimumItems = Number.isFinite(minimumValue) ? minimumValue : section.extras.minimumItems;
                        }
                        sectionConfigs[section.key] = collectedConfig;
                    });
                    return sectionConfigs;
                })()
            },
            customSections: getCustomSections()
        };

        // Collect exclusive elsewhere config
        config.exclusiveElsewhere = {
            hideServerName: document.getElementById('exclusiveElsewhere_hideServerName')?.checked === true
        };

        // Collect search config
        config.search = {
            enableJellyseerr: document.getElementById('search_enableJellyseerr')?.checked === true
        };

        // Collect flattenSingleSeasonShows config
        config.flattenSingleSeasonShows = {
            hideSingleSeasonContainer: document.getElementById('flattenSingleSeasonShows_hideSingleSeasonContainer')?.checked === true
        };

        // Parse JSON fields
        const skinsFromJson = parseJSONField('skinsJson', []);
        config.themes = parseJSONField('themesJson', []);
        config.customMenuLinks = parseJSONField('customMenuLinksJson', []);
        
        // Collect optional includes configuration
        if (overrideOptionalIncludes) {
            config.optionalIncludes = overrideOptionalIncludes;
        } else {
            // Fallback: Use existing config.optionalIncludes to prevent data loss
            // DOM scraping caused partial overwrites because it only found visible checkboxes for the current category
            console.warn('[KefinTweaks Configuration] handleSaveConfig called without overrideOptionalIncludes - preserving existing optionalIncludes');
            if (!config.optionalIncludes) {
                config.optionalIncludes = [];
            }
        }

        // Collect skin enabled toggles and merge with JSON skins
        // Only save admin-configured skins (not defaults)
        // Get default skin names to filter them out
        const defaultSkinNames = new Set((window.KefinTweaksDefaultSkinsConfig?.skins || []).map(s => s.name));
        
        // Collect enabled states from toggles (for all skins, including defaults)
        const skinEnabledStates = {};
        modalInstance.dialogContent.querySelectorAll('[data-skin-name]').forEach(checkbox => {
            const skinName = checkbox.getAttribute('data-skin-name');
            skinEnabledStates[skinName] = checkbox.checked;
        });

        // Only save admin skins (from JSON textarea) - filter out any that match default names
        // This ensures we don't accidentally save default skins
        const customSkins = skinsFromJson
            .filter(skin => !defaultSkinNames.has(skin.name)) // Exclude defaults
            .map(skin => ({
                ...skin,
                enabled: skinEnabledStates[skin.name] !== false, // Default to true if not set
                hidden: false // Explicitly set for admin skins
            }));

        // Handle disabled default skins
        // We need to explicitly save them in config.skins with enabled: false to override the default
        const disabledDefaultSkins = [];
        defaultSkinNames.forEach(name => {
            // If explicitly disabled in UI
            if (skinEnabledStates[name] === false) {
                disabledDefaultSkins.push({
                    name: name,
                    enabled: false
                });
            }
        });

        // Combine custom skins and disabled default skins
        config.skins = [...customSkins, ...disabledDefaultSkins];
        
        // Note: Enabled states for default skins are collected but not saved in config.skins
        // Default skins will use their default enabled state from skinConfig.js
        // If we need to save enabled states for defaults, we'd need a separate field (future enhancement)

        // Handle defaultSkin
        if (config.defaultSkin === '') {
            config.defaultSkin = null;
        }

        console.log('[KefinTweaks Configuration] Configuration collected:', config);

        // Save to JavaScript Injector plugin
        try {
            await saveConfigToJavaScriptInjector(config);
            
            // Update global config objects so dropdown changes reflect saved values
            window.KefinTweaksConfig = config;
            window.KefinTweaksCurrentConfig = config;
            currentLoadedConfig = config;
            
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

    async function handleResetConfig(modalInstance) {
        const userIsAdmin = await isAdmin();
        if (!userIsAdmin) {
            alert('You must be an administrator to reset configuration.');
            return;
        }

        const confirmed = confirm('This will restore the KefinTweaks configuration to its defaults. It cannot be undone. Are you sure you want to continue?');
        if (!confirmed) {
            return;
        }

        try {
            const defaultConfig = await loadDefaultConfig();

            // Retain kefinTweaksRoot from existing config
            const existingConfig = await getKefinTweaksConfig();
            defaultConfig.kefinTweaksRoot = existingConfig.kefinTweaksRoot;
            // Note: scriptRoot is no longer used - scripts are loaded from kefinTweaksRoot + '/scripts/'

            await saveConfigToJavaScriptInjector(defaultConfig);

            if (window.KefinTweaksToaster && window.KefinTweaksToaster.toast) {
                window.KefinTweaksToaster.toast('Configuration reset to defaults.');
            } else {
                alert('Configuration reset to defaults.');
            }

            if (modalInstance && typeof modalInstance.close === 'function') {
                modalInstance.close();
            }
            openConfigurationModal();
        } catch (error) {
            console.error('[KefinTweaks Configuration] Error resetting config:', error);
            if (window.KefinTweaksToaster && window.KefinTweaksToaster.toast) {
                window.KefinTweaksToaster.toast(`Error resetting configuration: ${error.message}`, '5');
            } else {
                alert(`Error resetting configuration: ${error.message}`);
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
        const button = document.createElement('div');
        button.style.display = 'block';
        button.style.padding = '0';
        button.style.margin = '0';
        button.className = 'listItem-border emby-button kefin-config-button';
        button.setAttribute('data-kefintweaks-config-button', 'true');
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
            false,
            '.adminMenuOptions'
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
        const configButton = document.querySelector('.navMenuOption[data-name="configure"]');
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
