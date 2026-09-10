// KefinTweaks Home Screen Configuration UI
// Modular configuration modal for managing home screen sections
// Uses the new HomeScreenSection format with queries array

(function() {
    'use strict';

    const LOG = (...args) => console.log('[KefinTweaks HomeScreen Config]', ...args);
    const WARN = (...args) => console.warn('[KefinTweaks HomeScreen Config]', ...args);
    const ERR = (...args) => console.error('[KefinTweaks HomeScreen Config]', ...args);

    // Modal IDs
    const MAIN_MODAL_ID = 'kefin-homescreen-config-main';
    const PREVIEW_DEFAULT_LIMIT = window.KefinHomeScreenEditorConstants?.DEFAULT_SECTION_QUERY_LIMIT ?? 16;

    function withPreviewQueryOptions(query) {
        const queryOptions = { ...(query?.queryOptions || {}) };
        if (queryOptions.Limit == null || queryOptions.Limit === '') {
            queryOptions.Limit = PREVIEW_DEFAULT_LIMIT;
        }
        return { ...query, queryOptions };
    }

    function se() { return window.KefinHomeScreenSectionEditor || {}; }
    function buildCheckbox(id, checked, label) { return se().buildCheckbox?.(id, checked, label) || ''; }
    function buildSelect(id, options, selectedValue, label) { return se().buildSelect?.(id, options, selectedValue, label) || ''; }
    function buildTextInput(id, value, label, type, placeholder) { return se().buildTextInput?.(id, value, label, type, placeholder) || ''; }
    function buildToggleSlider(id, checked, label, options) { return se().buildToggleSlider?.(id, checked, label, options) || ''; }
    function buildToggleCard(id, checked, label, description, options) {
        return se().buildToggleCard?.(id, checked, label, description, options) || '';
    }
    function updateToggleSliderUI(btn, checked) { return se().updateToggleSliderUI?.(btn, checked); }
    function updateToggleSwitchUI(btn, checked) { return se().updateToggleSwitchUI?.(btn, checked); }
    const SORT_ORDERS = (window.KefinHomeScreenEditorConstants?.SORT_ORDERS) || ['Default', 'Random', 'Name'];
    const CARD_FORMATS = (window.KefinHomeScreenEditorConstants?.CARD_FORMATS) || ['Poster'];

    const GENERAL_TOGGLE_DESCRIPTIONS = {
        'userHome-inlineConfigure': {
            on: 'Allows Home Screen sections to be configured directly from the Home Screen.',
            off: 'Sections can only be configured from the User > Home preferences page.'
        },
        'userHome-pinning': {
            on: 'Allows users to create pinned sections on their Home Screen from library items by adding a "Pin To Home" button in the item context menu.',
            off: 'Users cannot pin items to their Home Screen.'
        },
        'home-fadeInSections': {
            on: 'Sections will be hidden when they are rendered and will fade up and in as they enter the window when you scroll.',
            off: 'Sections will be rendered normally without any fade in animation.'
        },
        'home-showStaleDataBeforeRefresh': {
            on: 'Sections will show stale items before being refreshed and existing items will be updated in place when new data is ready.',
            off: 'Sections will show loading skeleton cards whenever section data is stale.'
        },
        'seasonal-enableSeasonalAnimations': {
            on: 'Animated seasonal overlays will appear in the UI based on the seasonal sections that are enabled.',
            off: 'No animated seasonal overlays will appear in the UI regardless of which seasonal sections are enabled.'
        },
        'seasonal-enableSeasonalBackground': {
            on: 'The Home Screen background will be replaced by an appropriate Seasonal Background during the corresponding season.',
            off: 'Seasonal Backgrounds will not appear at all.'
        },
        'home-ensureThumbsForPopularTVNetworks': {
            on: 'Only Studios with a valid image will be rendered in Popular Studios sections.',
            off: 'Studios without any image may be rendered in Popular Studios sections. You can enable the Optional CSS Module "Studio Thumbnails" to overlay a background with the Studio Name on items without an image.'
        }
    };

    const DISCOVERY_TOGGLE_DESCRIPTIONS = {
        'discovery-enabled': {
            on: 'Discovery Sections will be generated per-user and rendered dynamically as the user scrolls down the Home Screen.',
            off: 'No Discovery Sections will be generated.'
        },
        'discovery-infiniteScroll': {
            on: 'Discovery Sections will render automatically when the user scrolls near the bottom of the page.',
            off: 'Discovery Sections will only be rendered when the user presses the "Load More" button.'
        },
        'discovery-renderSpotlightAboveMatching': {
            on: 'Top Rated Genre/Studio and regular Genre/Studio sections will appear next to each other',
            off: 'Top Rated Genre/Studio and regular Genre/Studio sections will not necessarily appear next to each other'
        },
        'discovery-randomizeOrder': {
            on: 'Discovery Sections will be rendered in a random order.',
            off: 'Discovery Sections will always appear in the same order.'
        },
        'discovery-fadeInSections': {
            on: 'Sections will be hidden when they are rendered and will fade up and in as they enter the window when you scroll.',
            off: 'Sections will be rendered normally without any fade in animation.'
        }
    };

    function toggleDesc(map, id, checked) {
        const entry = map[id];
        if (!entry) return '';
        return checked ? entry.on : entry.off;
    }

    function hscToggleCard(id, checked, label, descMap) {
        return buildToggleCard(id, checked, label, toggleDesc(descMap, id, checked), { hintKey: id });
    }

    function updateHscToggleCardHints(root, descMap) {
        if (!root || !descMap) return;
        Object.keys(descMap).forEach((id) => {
            const checkbox = root.querySelector('#' + id);
            const descEl = checkbox?.closest('.kefin-toggle-card')?.querySelector('.kefin-toggle-card-desc');
            if (!descEl || !checkbox) return;
            descEl.textContent = toggleDesc(descMap, id, checkbox.checked);
        });
    }    // Current config state
    let currentConfig = null;
    let mainModalInstance = null;
    let currentActiveTab = 'settings'; // Track the currently active tab
    let currentGlobalSettingsSubTab = 'general'; // Track active sub-tab in Global Settings (general, spotlight, discovery, cache)
    let globalSettingsSaveTimer = null;
    const UPDATE_ALL_CONFIRM_MODAL_ID = 'kefin-homescreen-config-update-all-confirm';
    const COMMUNITY_IMPORT_MODAL_ID = 'kefin-homescreen-community-import';
    const TTL_UNIT_OPTIONS = [
        { value: 'seconds', ms: 1000 },
        { value: 'minutes', ms: 60000 },
        { value: 'hours', ms: 3600000 },
        { value: 'days', ms: 86400000 }
    ];

    function normalizeActiveTab(tab) {
        if (tab === 'community') return 'import-export';
        if (tab === 'benchmark') return 'troubleshoot';
        return tab || 'settings';
    }

    /**
     * Show toast notification
     */
    function showToast(message, duration = '3') {
        if (window.KefinTweaksToaster && window.KefinTweaksToaster.toast) {
            window.KefinTweaksToaster.toast(message, duration);
        } else {
            // Fallback to alert if toaster not available
            alert(message);
        }
    }

    /**
     * Flatten section groups into a flat array of sections
     * @param {Array} groups - Array of HomeScreenSectionGroup objects
     * @returns {Array} Flat array of all sections
     */
    function flattenSectionGroups(groups) {
        if (!Array.isArray(groups)) return [];
        const flattened = [];
        groups.forEach(group => {
            if (group && Array.isArray(group.sections)) {
                flattened.push(...group.sections);
            }
        });
        return flattened;
    }

    const CONTINUE_WATCHING_SECTION_IDS = new Set([
        'continueWatching',
        'nextUp',
        'continueWatchingAndNextUp'
    ]);

    /**
     * Clear MERGE_NEXT_UP-era hidden flags so CW / Next Up / combined are independent sections.
     */
    function normalizeContinueWatchingVisibility(config) {
        if (!config) return;
        const groupKeys = ['HOME_SECTION_GROUPS', 'SEASONAL_SECTION_GROUPS', 'DISCOVERY_SECTION_GROUPS', 'CUSTOM_SECTION_GROUPS'];
        groupKeys.forEach((key) => {
            (config[key] || []).forEach((group) => {
                (group.sections || []).forEach((section) => {
                    if (section?.id && CONTINUE_WATCHING_SECTION_IDS.has(section.id)) {
                        section.hidden = false;
                    }
                });
            });
        });
        delete config.MERGE_NEXT_UP;
    }

    /**
     * Collect discovery-enabled sections from custom groups, stamping pageNumber
     * per group (1..N among discovery sections only, in group order).
     * @param {Array} groups - CUSTOM_SECTION_GROUPS
     * @param {{ isSectionActive: Function, isInSeasonalPeriod: Function }} options
     * @returns {Array}
     */
    function collectCustomDiscoverySections(groups, { isSectionActive, isInSeasonalPeriod }) {
        const out = [];
        (groups || []).forEach((group) => {
            let pageNumber = 0;
            (group.sections || []).forEach((section) => {
                if (!isSectionActive(section)) return;
                if (section.discoveryEnabled !== true) return;
                if (section.startDate && section.endDate && !isInSeasonalPeriod(section.startDate, section.endDate)) return;
                pageNumber += 1;
                out.push({ ...section, pageNumber, isCustom: true });
            });
        });
        return out;
    }

    /**
     * Get all sections from groups with metadata about which group they belong to
     * @param {Array} groups - Array of HomeScreenSectionGroup objects
     * @returns {Array} Array of objects with section and groupName
     */
    function getAllSectionsFromGroups(groups) {
        if (!Array.isArray(groups)) return [];
        const result = [];
        groups.forEach(group => {
            if (group && Array.isArray(group.sections)) {
                group.sections.forEach(section => {
                    result.push({
                        section: section,
                        groupName: group.name || 'Unnamed Group',
                        groupAuthor: group.author,
                        groupDescription: group.description
                    });
                });
            }
        });
        return result;
    }

    /**
     * Render section groups with group-level and section-level checkboxes
     * Used by import and export modals to display sections within their groups
     * @param {HTMLElement} container - Container element to render into
     * @param {Array} sectionGroups - Array of section group objects { name, author?, description?, sections: [] }
     * @param {Object} options - Options object
     * @param {string} options.checkboxClass - CSS class for section checkboxes (e.g., 'export-custom-check', 'import-custom-check')
     * @param {string} options.groupCheckboxClass - CSS class for group checkboxes (optional, defaults to checkboxClass + '-group')
     */
    function renderSectionGroupsCheckboxList(container, sectionGroups, options = {}) {
        if (!Array.isArray(sectionGroups) || sectionGroups.length === 0) {
            container.innerHTML = '<div class="listItemBodyText secondary">No section groups found.</div>';
            return;
        }

        const checkboxClass = options.checkboxClass || 'section-check';
        const groupCheckboxClass = options.groupCheckboxClass || checkboxClass + '-group';

        let html = '<div style="background: rgba(0,0,0,0.2); border-radius: 4px; padding: 0.5em;">';
        
        sectionGroups.forEach((group, groupIndex) => {
            if (!group || !Array.isArray(group.sections) || group.sections.length === 0) {
                return;
            }

            const groupName = group.name || 'Unnamed Group';
            
            // Group checkbox row
            html += `
                <div style="margin-bottom: 0.5em; padding: 0.5em; background: rgba(255,255,255,0.05); border-radius: 4px;">
                    <label class="checkboxContainer" style="display: flex; align-items: center; padding: 0.25em 0;">
                        <input type="checkbox" class="${groupCheckboxClass}" data-group-index="${groupIndex}" checked>
                        <span class="listItemBodyText" style="margin-left: 0.5em; font-weight: 500;">${groupName}</span>
                    </label>
                    <div style="margin-left: 1.5em; margin-top: 0.25em;">
            `;

            // Section checkboxes (indented)
            group.sections.forEach((section, sectionIndex) => {
                html += `
                    <label class="checkboxContainer" style="display: flex; align-items: center; padding: 0.25em 0;">
                        <input type="checkbox" class="${checkboxClass}" data-group-index="${groupIndex}" data-section-index="${sectionIndex}" checked>
                        <span class="listItemBodyText" style="margin-left: 0.5em;">${section.name || 'Unnamed Section'}</span>
                    </label>
                `;
            });

            html += `
                    </div>
                </div>
            `;
        });

        html += '</div>';
        container.innerHTML = html;

        // Wire up group checkboxes to toggle all section checkboxes in that group
        container.querySelectorAll(`.${groupCheckboxClass}`).forEach(groupCheckbox => {
            groupCheckbox.addEventListener('change', (e) => {
                const groupIndex = parseInt(e.target.dataset.groupIndex);
                const isChecked = e.target.checked;
                container.querySelectorAll(`.${checkboxClass}[data-group-index="${groupIndex}"]`).forEach(sectionCheckbox => {
                    sectionCheckbox.checked = isChecked;
                });
            });
        });
    }

    /**
     * Find a section by ID in groups
     * @param {Array} groups - Array of HomeScreenSectionGroup objects
     * @param {string} sectionId - Section ID to find
     * @returns {Object|null} Object with section, group, and groupIndex, or null if not found
     */
    function findSectionInGroups(groups, sectionId) {
        if (!Array.isArray(groups)) return null;
        for (let groupIndex = 0; groupIndex < groups.length; groupIndex++) {
            const group = groups[groupIndex];
            if (group && Array.isArray(group.sections)) {
                const sectionIndex = group.sections.findIndex(s => s.id === sectionId);
                if (sectionIndex !== -1) {
                    return {
                        section: group.sections[sectionIndex],
                        group: group,
                        groupIndex: groupIndex,
                        sectionIndex: sectionIndex
                    };
                }
            }
        }
        return null;
    }

    /**
     * Find a section by ID across all section groups (HOME, SEASONAL, DISCOVERY, CUSTOM)
     * @param {Object} config - Configuration object
     * @param {string} sectionId - Section ID to find
     * @returns {Object|null} Object with section, group, groupIndex, sectionIndex, and groupType, or null if not found
     */
    function findSectionInAllGroups(config, sectionId) {
        if (!config) return null;
        
        // Check HOME_SECTION_GROUPS
        let found = findSectionInGroups(config.HOME_SECTION_GROUPS || [], sectionId);
        if (found) {
            found.groupType = 'HOME_SECTION_GROUPS';
            return found;
        }
        
        // Check SEASONAL_SECTION_GROUPS
        found = findSectionInGroups(config.SEASONAL_SECTION_GROUPS || [], sectionId);
        if (found) {
            found.groupType = 'SEASONAL_SECTION_GROUPS';
            return found;
        }
        
        // Check DISCOVERY_SECTION_GROUPS
        found = findSectionInGroups(config.DISCOVERY_SECTION_GROUPS || [], sectionId);
        if (found) {
            found.groupType = 'DISCOVERY_SECTION_GROUPS';
            return found;
        }
        
        // Check CUSTOM_SECTION_GROUPS
        found = findSectionInGroups(config.CUSTOM_SECTION_GROUPS || [], sectionId);
        if (found) {
            found.groupType = 'CUSTOM_SECTION_GROUPS';
            return found;
        }
        
        return null;
    }

    /**
     * True when a section property should be omitted from JS Injector persistence
     * (same meaning as a blank CustomPrefs segment).
     * @param {*} value
     * @returns {boolean}
     */
    function isEmptySectionValue(value) {
        return value === '' || value === null || value === undefined;
    }

    /**
     * Remove empty properties from a section (and nested plain objects) before injector save.
     * Empty = '' / null / undefined. Does not strip false, 0, or [].
     * @param {Object} section
     * @returns {Object}
     */
    function omitEmptySectionProps(section) {
        if (!section || typeof section !== 'object' || Array.isArray(section)) return section;
        Object.keys(section).forEach((key) => {
            const value = section[key];
            if (isEmptySectionValue(value)) {
                delete section[key];
                return;
            }
            if (value && typeof value === 'object' && !Array.isArray(value)) {
                omitEmptySectionProps(value);
                if (Object.keys(value).length === 0) delete section[key];
            }
        });
        return section;
    }

    /**
     * Strip empty props from every section in group arrays (mutates in place).
     * @param {Array} groups
     */
    function omitEmptyPropsFromGroups(groups) {
        if (!Array.isArray(groups)) return;
        groups.forEach((group) => {
            if (!group || !Array.isArray(group.sections)) return;
            group.sections.forEach((section) => omitEmptySectionProps(section));
        });
    }

    /**
     * Apply user-editable presentation fields onto a server section (no queries/paths/items).
     * Cleared Default/Normal/left/empty values are written as '' so mergeSection overwrites
     * stale injector values; omitEmptySectionProps then drops them on save.
     * @param {Object} section
     * @param {Object} presentation - buildPrefOverrides-shaped object
     */
    function applyPresentationDefaultsToSection(section, presentation) {
        if (!section || !presentation) return section;
        if (presentation.order != null && presentation.order !== '') {
            const order = parseInt(presentation.order, 10);
            if (!Number.isNaN(order)) section.order = order;
        }
        if (presentation.ttl != null && presentation.ttl !== '') {
            const ttl = parseInt(presentation.ttl, 10);
            if (!Number.isNaN(ttl)) section.ttl = ttl;
        }
        if (presentation.cardFormat) section.cardFormat = presentation.cardFormat;

        if (presentation.hideName === true) section.hideName = true;
        else if (presentation.hideName === false) section.hideName = '';

        if (presentation.hideCardTitles === true) {
            section.cardTitleVisibility = 'hidden';
            section.hideCardTitles = true;
        } else {
            section.hideCardTitles = '';
            if (section.cardTitleVisibility === 'hidden') section.cardTitleVisibility = '';
        }

        if (presentation.cardTitlePosition) {
            section.cardTitlePosition = presentation.cardTitlePosition;
        } else {
            section.cardTitlePosition = '';
        }

        if (presentation.cardTitleCapitalization && presentation.cardTitleCapitalization !== 'normal') {
            section.cardTitleCapitalization = presentation.cardTitleCapitalization;
        } else {
            section.cardTitleCapitalization = '';
        }

        if (presentation.cardTitleFontFamily && presentation.cardTitleFontFamily !== 'default') {
            section.cardTitleFontFamily = presentation.cardTitleFontFamily;
        } else {
            section.cardTitleFontFamily = '';
        }

        if (presentation.cardTitleFontSize && presentation.cardTitleFontSize !== 'normal') {
            section.cardTitleFontSize = presentation.cardTitleFontSize;
        } else {
            section.cardTitleFontSize = '';
        }

        if (presentation.cardTitleColor) section.cardTitleColor = presentation.cardTitleColor;
        else section.cardTitleColor = '';

        if (presentation.borderStyle) section.borderStyle = presentation.borderStyle;
        else section.borderStyle = '';

        if (presentation.borderColor) section.borderColor = presentation.borderColor;
        else section.borderColor = '';

        const isSpotlight = section.renderMode === 'Spotlight' || section.spotlight === true;
        if (isSpotlight) {
            section.spotlightConfig = section.spotlightConfig || {};
            if (presentation.animationEnabled === false) section.spotlightConfig.panAnimation = false;
            else if (presentation.animationEnabled === true) section.spotlightConfig.panAnimation = true;

            if (presentation.spotlightLayout) section.spotlightConfig.spotlightLayout = presentation.spotlightLayout;
            if (presentation.spotlightSize) section.spotlightConfig.spotlightSize = presentation.spotlightSize;
            if (presentation.spotlightTileCount != null && presentation.spotlightTileCount !== '') {
                const tileCount = parseInt(presentation.spotlightTileCount, 10);
                if (!Number.isNaN(tileCount)) section.spotlightConfig.tileCount = tileCount;
            }
        }

        return section;
    }

    /**
     * Copy presentation defaults onto the server section and persist.
     * @param {string} sectionId
     * @param {Object} presentation
     * @returns {Promise<boolean>}
     */
    async function publishSectionPresentationDefaults(sectionId, presentation) {
        getConfig();
        if (!currentConfig || !sectionId) return false;
        const found = findSectionInAllGroups(currentConfig, sectionId);
        if (!found?.section) {
            WARN(`publishSectionPresentationDefaults: section not found: ${sectionId}`);
            return false;
        }
        applyPresentationDefaultsToSection(found.section, presentation || {});
        await saveConfig(currentConfig);
        return true;
    }

    /**
     * Update a section in groups
     * @param {Array} groups - Array of HomeScreenSectionGroup objects
     * @param {string} sectionId - Section ID to update
     * @param {Object} updatedSection - Updated section data
     * @returns {boolean} True if section was found and updated
     */
    function updateSectionInGroups(groups, sectionId, updatedSection) {
        const found = findSectionInGroups(groups, sectionId);
        if (found) {
            found.group.sections[found.sectionIndex] = { ...found.section, ...updatedSection };
            return true;
        }
        return false;
    }

    /**
     * Add a section to a group
     * @param {Array} groups - Array of HomeScreenSectionGroup objects
     * @param {string} groupName - Name of the group to add to
     * @param {Object} section - Section to add
     * @param {string} author - Optional author for custom groups
     */
    function addSectionToGroup(groups, groupName, section, author) {
        if (!Array.isArray(groups)) return;
        
        // Find existing group
        let targetGroup = groups.find(g => {
            if (author) {
                return g.name === groupName && g.author === author;
            }
            return g.name === groupName && !g.author;
        });
        
        // Create group if it doesn't exist
        if (!targetGroup) {
            targetGroup = {
                name: groupName,
                sections: []
            };
            if (author) {
                targetGroup.author = author;
            }
            groups.push(targetGroup);
        }
        
        // Add section
        if (!targetGroup.sections) {
            targetGroup.sections = [];
        }
        targetGroup.sections.push(section);
        
        // Sort sections by order
        targetGroup.sections.sort((a, b) => (a.order || 0) - (b.order || 0));
    }

    /**
     * Remove a section from groups
     * @param {Array} groups - Array of HomeScreenSectionGroup objects
     * @param {string} sectionId - Section ID to remove
     * @returns {boolean} True if section was found and removed
     */
    function removeSectionFromGroups(groups, sectionId) {
        if (!Array.isArray(groups)) return false;
        for (let groupIndex = 0; groupIndex < groups.length; groupIndex++) {
            const group = groups[groupIndex];
            if (group && Array.isArray(group.sections)) {
                const sectionIndex = group.sections.findIndex(s => s.id === sectionId);
                if (sectionIndex !== -1) {
                    group.sections.splice(sectionIndex, 1);
                    // Remove empty groups (except default groups)
                    if (group.sections.length === 0 && !group.author) {
                        groups.splice(groupIndex, 1);
                    }
                    return true;
                }
            }
        }
        return false;
    }

    /**
     * Verify and sync library-based section groups (Recently Added, Popular Genres, etc.) with actual Jellyfin libraries
     * @param {Object} config - Current configuration object
     * @returns {Object} Updated configuration with synced library-based sections
     */
    async function verifyLibrarySectionsConfig(config) {
        try {
            if (!window.ApiClient || !window.ApiClient._loggedIn) {
                WARN('User not logged in, skipping library sections verification');
                return { config, hasChanges: false };
            }

            if (!window.dataHelper || !window.dataHelper.getLibraries) {
                WARN('dataHelper.getLibraries not available, skipping library sections verification');
                return { config, hasChanges: false };
            }

            const libraries = await window.dataHelper.getLibraries();
            if (!libraries || libraries.length === 0) {
                LOG('No libraries found, skipping library sections verification');
                return { config, hasChanges: false };
            }

            // Filter out boxsets and playlists; all templates apply to this list
            const filteredLibraries = libraries.filter(l => l.CollectionType && l.CollectionType !== 'boxsets' && l.CollectionType !== 'playlists');
            const currentLibraryIds = new Set(filteredLibraries.map(l => l.Id));

            const libraryTemplates = [
                {
                    idPrefix: 'recently-added-',
                    groupId: 'home-recently-added',
                    groupName: 'Recently Added',
                    sectionTemplate: {
                        enabled: false,
                        order: 61,
                        cardFormat: 'Poster',
                        buildSection: function (library) {
                            let viewMoreUrl = null;
                            if (library.CollectionType === 'movies') {
                                viewMoreUrl = `#/movies.html?topParentId=${library.Id}&collectionType=movies&tab=1`;
                            } else if (library.CollectionType === 'tvshows') {
                                viewMoreUrl = `#/tv.html?topParentId=${library.Id}&collectionType=tvshows&tab=1`;
                            }
                            return {
                                id: `recently-added-${library.Id}`,
                                name: `Recently Added ${library.Name}`,
                                viewMoreUrl: viewMoreUrl,
                                jellyfinId: 'latestmedia',
                                userConfigurable: true,
                                queries: [{
                                    path: '/Items/Latest',
                                    queryOptions: {
                                        ParentId: library.Id,
                                        Fields: 'PrimaryImageAspectRatio,Path',
                                        Limit: 16,
                                        ImageTypeLimit: 1,
                                        EnableImageTypes: 'Primary,Backdrop,Thumb',
                                    }
                                }]
                            };
                        }
                    }
                },
                {
                    idPrefix: 'popular-genres-',
                    groupId: 'home-popular-genres',
                    groupName: 'Popular Genres',
                    sectionTemplate: {
                        enabled: false,
                        order: 81,
                        cardFormat: 'Thumb',
                        ttl: 604800000,
                        buildSection: function (library) {
                            const ct = (library.CollectionType || '').toLowerCase();
                            let includeItemTypes = ['Movie', 'Series', 'Video', 'MusicArtist', 'Book', 'AudioBook'];
                            if (ct === 'music') includeItemTypes = ['MusicArtist'];
                            else if (ct === 'tvshows') includeItemTypes = ['Series'];
                            else if (ct === 'movies') includeItemTypes = ['Movie'];
                            else if (ct === 'books') includeItemTypes = ['Book', 'AudioBook'];
                            else if (ct === 'homevideos') includeItemTypes = ['Video'];
                            return {
                                id: `popular-genres-${library.Id}`,
                                name: `Popular ${library.Name} Genres`,
                                userConfigurable: true,
                                queries: [{
                                    path: '/Genres',
                                    ParentId: library.Id,
                                    queryOptions: {
                                        ParentId: library.Id,
                                        IncludeItemTypes: includeItemTypes,
                                        SortBy: 'ChildCount',
                                        SortOrder: 'Descending',
                                        Limit: 20
                                    }
                                }]
                            };
                        }
                    }
                }
            ];

            const groups = config.HOME_SECTION_GROUPS || [];
            let updatedGroups = groups.map(g => ({ ...g, sections: Array.isArray(g.sections) ? [...g.sections] : [] }));
            let hasChanges = false;

            for (const template of libraryTemplates) {
                let group = updatedGroups.find(g => g.id === template.groupId || g.name === template.groupName);
                if (!group) {
                    group = {
                        id: template.groupId,
                        name: template.groupName,
                        sections: []
                    };
                    updatedGroups.push(group);
                    hasChanges = true;
                } else if (!group.id) {
                    group.id = template.groupId;
                    hasChanges = true;
                }

                const groupSections = group.sections || [];
                const templateSectionIds = groupSections.filter(s => s.id && s.id.startsWith(template.idPrefix)).map(s => s.id);
                const existingLibraryIdsForTemplate = new Set(templateSectionIds.map(id => id.replace(template.idPrefix, '')));

                const sectionsToRemove = groupSections.filter(s => {
                    if (!s.id || !s.id.startsWith(template.idPrefix)) return false;
                    const libId = s.id.replace(template.idPrefix, '');
                    return !currentLibraryIds.has(libId);
                });
                const sectionsToRemoveIds = new Set(sectionsToRemove.map(s => s.id));
                const librariesToAdd = filteredLibraries.filter(l => !existingLibraryIdsForTemplate.has(l.Id));

                if (sectionsToRemoveIds.size > 0 || librariesToAdd.length > 0) hasChanges = true;

                group.sections = groupSections.filter(s => !sectionsToRemoveIds.has(s.id));

                librariesToAdd.forEach(library => {
                    const base = template.sectionTemplate.buildSection(library);
                    const newSection = {
                        ...template.sectionTemplate,
                        ...base,
                        id: base.id,
                        name: base.name,
                        queries: base.queries
                    };
                    delete newSection.buildSection;
                    group.sections.push(newSection);
                });
            }

            // Remove stale library sections from any HOME group (e.g. misplaced sections)
            for (const group of updatedGroups) {
                const beforeCount = (group.sections || []).length;
                group.sections = (group.sections || []).filter(s => {
                    if (!s?.id) return true;
                    for (const template of libraryTemplates) {
                        if (s.id.startsWith(template.idPrefix)) {
                            const libId = s.id.replace(template.idPrefix, '');
                            return currentLibraryIds.has(libId);
                        }
                    }
                    return true;
                });
                if (group.sections.length !== beforeCount) {
                    hasChanges = true;
                }
            }

            if (!hasChanges) {
                LOG('Library-based sections are in sync with libraries');
                return { config, hasChanges: false };
            }

            config.HOME_SECTION_GROUPS = updatedGroups;
            LOG('Library-based sections synced successfully');
            return { config, hasChanges: true };
        } catch (error) {
            ERR('Error verifying library sections config:', error);
            return { config, hasChanges: false };
        }
    }

    const NATIVE_QUERY_SYNC_KEYS = {
        queryLevel: ['path'],
        queryOptions: ['Fields', 'Filters', 'IncludeItemTypes', 'MediaTypes', 'IsActive', 'IsScheduled', 'IsAiring', 'HasAired', 'IsInProgress'],
    };

    function buildCanonicalHomeSectionMap() {
        const defaults = window.KefinHomeConfig2;
        const map = new Map();
        if (!defaults?.HOME_SECTION_GROUPS) return map;
        flattenSectionGroups(defaults.HOME_SECTION_GROUPS).forEach(section => {
            if (section?.id) map.set(section.id, section);
        });
        return map;
    }

    function getRecentlyAddedCanonicalQuery() {
        return {
            path: '/Items/Latest',
            queryOptions: {
                Fields: 'PrimaryImageAspectRatio,Path',
                Limit: 16,
                ImageTypeLimit: 1,
                EnableImageTypes: 'Primary,Backdrop,Thumb',
            },
        };
    }

    function syncQueryFromCanonical(savedQuery, canonicalQuery) {
        if (!savedQuery || !canonicalQuery) return false;
        let changed = false;

        for (const key of NATIVE_QUERY_SYNC_KEYS.queryLevel) {
            if (canonicalQuery[key] !== undefined && savedQuery[key] !== canonicalQuery[key]) {
                savedQuery[key] = canonicalQuery[key];
                changed = true;
            }
        }

        if (!savedQuery.queryOptions) savedQuery.queryOptions = {};
        const savedOpts = savedQuery.queryOptions;
        const canonicalOpts = canonicalQuery.queryOptions || {};

        for (const key of NATIVE_QUERY_SYNC_KEYS.queryOptions) {
            if (canonicalOpts[key] !== undefined) {
                const canonicalVal = canonicalOpts[key];
                const savedVal = savedOpts[key];
                const arraysEqual = Array.isArray(canonicalVal) && Array.isArray(savedVal)
                    && canonicalVal.length === savedVal.length
                    && canonicalVal.every((v, i) => v === savedVal[i]);
                if (canonicalVal !== savedVal && !arraysEqual) {
                    savedOpts[key] = Array.isArray(canonicalVal) ? [...canonicalVal] : canonicalVal;
                    changed = true;
                }
            }
        }

        if (canonicalOpts.Filters === undefined && savedOpts.Filters === 'IsResumable') {
            delete savedOpts.Filters;
            changed = true;
        }

        return changed;
    }

    function syncKefinTweaksDefaultSections(config) {
        const canonicalMap = buildCanonicalHomeSectionMap();
        const recentlyAddedTemplate = getRecentlyAddedCanonicalQuery();
        let hasChanges = false;

        const groups = config.HOME_SECTION_GROUPS || [];
        for (const group of groups) {
            for (const section of group.sections || []) {
                if (!section?.id) continue;

                let canonical = canonicalMap.get(section.id);
                if (!canonical && section.id.startsWith('recently-added-')) {
                    canonical = { queries: [recentlyAddedTemplate] };
                }
                if (!canonical?.queries?.length) continue;

                if (!Array.isArray(section.queries)) section.queries = [];

                for (let i = 0; i < canonical.queries.length; i++) {
                    if (!section.queries[i]) {
                        section.queries[i] = { queryOptions: {} };
                    }
                    if (syncQueryFromCanonical(section.queries[i], canonical.queries[i])) {
                        hasChanges = true;
                    }
                }
            }
        }

        return hasChanges;
    }

    async function ensureKefinTweaksDefaultSections() {
        try {
            if (!window.ApiClient || !window.ApiClient._loggedIn) {
                return;
            }

            let admin = false;
            try {
                admin = await window.apiHelper?.isAdmin?.();
            } catch {
                return;
            }
            if (!admin) return;

            const config = loadConfig();
            const { hasChanges: libraryChanges } = await verifyLibrarySectionsConfig(config);
            const queryChanges = syncKefinTweaksDefaultSections(config);

            if (libraryChanges || queryChanges) {
                await saveConfig(config);
                LOG('KefinTweaks default home sections synced on startup');
            }
        } catch (error) {
            ERR('Error ensuring KefinTweaks default sections:', error);
        }
    }

    let startupSyncDone = false;

    async function runStartupDefaultSectionSync() {
        if (startupSyncDone) return;

        if (window.userHelper?.waitForLogin) {
            const loggedIn = await window.userHelper.waitForLogin();
            if (!loggedIn) return;
        } else if (!window.ApiClient?._loggedIn) {
            return;
        }

        startupSyncDone = true;

        try {
            if (window.migrateHomeScreenConfig) {
                await window.migrateHomeScreenConfig();
            }
            await ensureKefinTweaksDefaultSections();
        } catch (error) {
            ERR('Startup default section sync failed:', error);
        }
    }

    /**
     * Load configuration from JS Injector and merge with defaults
     */
    function loadConfig() {
        try {
            // Get existing config from window.KefinTweaksConfig
            const existingConfig = (window.KefinTweaksConfig && window.KefinTweaksConfig.homeScreenConfig) || {};
            
            // Get defaults from homeScreenConfig2.js
            const defaults = window.KefinHomeConfig2;
            if (!defaults) {
                throw new Error('KefinHomeConfig2 not found. Ensure homeScreenConfig2.js is loaded.');
            }

            // Merge configs - now using 4 groups
            const mergedConfig = {
                HOME_SECTION_GROUPS: mergeGroupDefaults(
                    defaults.HOME_SECTION_GROUPS || [],
                    existingConfig.HOME_SECTION_GROUPS || [],
                    'home'
                ),
                SEASONAL_SECTION_GROUPS: mergeGroupDefaults(
                    defaults.SEASONAL_SECTION_GROUPS || [],
                    existingConfig.SEASONAL_SECTION_GROUPS || [],
                    'seasonal'
                ),
                DISCOVERY_SECTION_GROUPS: mergeGroupDefaults(
                    defaults.DISCOVERY_SECTION_GROUPS || [],
                    existingConfig.DISCOVERY_SECTION_GROUPS || [],
                    'discovery'
                ),
                CUSTOM_SECTION_GROUPS: mergeGroupDefaults(
                    defaults.CUSTOM_SECTION_GROUPS || [],
                    existingConfig.CUSTOM_SECTION_GROUPS || [], 
                    'custom'
                ),
                DISCOVERY_SETTINGS: { ...defaults.DISCOVERY_SETTINGS, ...(existingConfig.DISCOVERY_SETTINGS || {}) },
                SEASONAL_THEME_SETTINGS: { ...defaults.SEASONAL_THEME_SETTINGS, ...(existingConfig.SEASONAL_THEME_SETTINGS || {}) },
                CACHE: { ...defaults.CACHE, ...(existingConfig.CACHE || {}) },
                SPOTLIGHT_SETTINGS: { ...defaults.SPOTLIGHT_SETTINGS, ...(existingConfig.SPOTLIGHT_SETTINGS || {}) },
                HOME_SETTINGS: { ...defaults.HOME_SETTINGS, ...(existingConfig.HOME_SETTINGS || {}) },
                USER_HOME_SCREEN_SETTINGS: { ...defaults.USER_HOME_SCREEN_SETTINGS, ...(existingConfig.USER_HOME_SCREEN_SETTINGS || {}) }
            };

            normalizeContinueWatchingVisibility(mergedConfig);

            // Add ENABLED_NORMAL_SECTIONS and ENABLED_DISCOVERY_SECTIONS
            // ENABLED_NORMAL_SECTIONS is all enabled sections from HOME_SECTION_GROUPS, SEASONAL_SECTION_GROUPS, and CUSTOM_SECTION_GROUPS that aren't discovery sections
            // If they have a start/end date the current date must fall within that date range
            // ENABLED_DISCOVERY_SECTIONS is all enabled sections from DISCOVERY_SECTION_GROUPS and CUSTOM_SECTION_GROUPS that are discovery sections
            // If they have a start/end date the current date must fall within that date range

            const isInSeasonalPeriod = (startDate, endDate) => {
                const currentDate = new Date();
                const start = new Date(startDate);
                const end = new Date(endDate);

                // Ensure the years are the same as the current date year
                start.setFullYear(currentDate.getFullYear());
                end.setFullYear(currentDate.getFullYear());

                return currentDate >= start && currentDate <= end;
            };

            const enabledHomeSections = flattenSectionGroups(mergedConfig.HOME_SECTION_GROUPS).filter(s => s.enabled === true && s.discoveryEnabled !== true && (s.startDate && s.endDate ? isInSeasonalPeriod(s.startDate, s.endDate) : true));
            const enabledSeasonalSections = flattenSectionGroups(mergedConfig.SEASONAL_SECTION_GROUPS).filter(s => s.enabled === true && s.discoveryEnabled !== true && isInSeasonalPeriod(s.startDate, s.endDate));
            const enabledCustomSections = flattenSectionGroups(mergedConfig.CUSTOM_SECTION_GROUPS).filter(s => s.enabled === true && s.discoveryEnabled !== true && (s.startDate && s.endDate ? isInSeasonalPeriod(s.startDate, s.endDate) : true));
            const enabledDiscoverySections = flattenSectionGroups(mergedConfig.DISCOVERY_SECTION_GROUPS).filter(s => s.enabled === true && (s.startDate && s.endDate ? isInSeasonalPeriod(s.startDate, s.endDate) : true));
            const enabledCustomDiscoverySections = collectCustomDiscoverySections(mergedConfig.CUSTOM_SECTION_GROUPS, {
                isSectionActive: (s) => s.enabled === true,
                isInSeasonalPeriod
            });

            mergedConfig.ENABLED_NORMAL_SECTIONS = [...enabledHomeSections, ...enabledSeasonalSections, ...enabledCustomSections];
            mergedConfig.ENABLED_DISCOVERY_SECTIONS = [...enabledDiscoverySections, ...enabledCustomDiscoverySections];

            // Verify and sync recently-added library sections
            //await verifyLibrarySectionsConfig(mergedConfig);

            currentConfig = mergedConfig;
            return mergedConfig;
        } catch (error) {
            ERR('Error loading config:', error);
            throw error;
        }
    }

    /**
     * Get merged home screen config (exported for use by other scripts)
     * @returns {Promise<Object>} Merged configuration object
     */
    function getConfig(forceReload = false) {
        if (currentConfig && !forceReload) {
            return currentConfig;
        }
        let config = loadConfig();
        return config;
    }

    /**
     * Get enabled home sections and discovery sections
     * @returns {Object} Object with enabledHomeSections and enabledDiscoverySections
     */
    function getSections() {

        const config = getConfig();

        const isInSeasonalPeriod = (startDate, endDate) => {
            const currentDate = new Date();
            const start = new Date(startDate);
            const end = new Date(endDate);

            // Ensure the years are the same as the current date year
            start.setFullYear(currentDate.getFullYear());
            end.setFullYear(currentDate.getFullYear());

            return currentDate >= start && currentDate <= end;
        };

        const enabledHomeSections = flattenSectionGroups(config.HOME_SECTION_GROUPS).filter(s => (s.enabled || s.userConfigurable || s.userConfigurable === undefined) && s.discoveryEnabled !== true && (s.startDate && s.endDate ? isInSeasonalPeriod(s.startDate, s.endDate) : true));
        const enabledSeasonalSections = flattenSectionGroups(config.SEASONAL_SECTION_GROUPS).filter(s => (s.enabled || s.userConfigurable || s.userConfigurable === undefined) && s.discoveryEnabled !== true && isInSeasonalPeriod(s.startDate, s.endDate));
        const enabledCustomSections = flattenSectionGroups(config.CUSTOM_SECTION_GROUPS).filter(s => (s.enabled || s.userConfigurable || s.userConfigurable === undefined) && s.discoveryEnabled !== true && (s.startDate && s.endDate ? isInSeasonalPeriod(s.startDate, s.endDate) : true));
        const enabledDiscoverySections = flattenSectionGroups(config.DISCOVERY_SECTION_GROUPS).filter(s => (s.enabled || s.userConfigurable || s.userConfigurable === undefined) && (s.startDate && s.endDate ? isInSeasonalPeriod(s.startDate, s.endDate) : true));
        const enabledCustomDiscoverySections = collectCustomDiscoverySections(config.CUSTOM_SECTION_GROUPS, {
            isSectionActive: (s) => s.enabled || s.userConfigurable || s.userConfigurable === undefined,
            isInSeasonalPeriod
        });


        return {
            enabledHomeSections: [...enabledHomeSections, ...enabledSeasonalSections, ...enabledCustomSections],
            enabledDiscoverySections: [...enabledDiscoverySections, ...enabledCustomDiscoverySections]
        }
    }

    /**
     * Merge default groups with admin overrides
     * @param {Array} defaultGroups - Array of default HomeScreenSectionGroup objects
     * @param {Array} overrideGroups - Array of override HomeScreenSectionGroup objects
     * @param {string} sectionType - Surface type to stamp: home | seasonal | discovery, or custom (derives surface + isCustom)
     * @returns {Array} Merged groups
     */
    function mergeGroupDefaults(defaultGroups, overrideGroups, sectionType = 'home') {
        const merged = [];
        const overrideGroupMapById = new Map();
        const overrideGroupMapByName = new Map();
        const overrideGroupByOriginalName = new Map();
        
        // Create maps of override groups by id, name/author, and _originalName
        overrideGroups.forEach(overrideGroup => {
            // Map by id (preferred method)
            if (overrideGroup.id) {
                overrideGroupMapById.set(overrideGroup.id, overrideGroup);
            }
            
            // Map by name/author (fallback for backward compatibility)
            const nameKey = overrideGroup.author ? `${overrideGroup.name}::${overrideGroup.author}` : overrideGroup.name || 'Unnamed';
            overrideGroupMapByName.set(nameKey, overrideGroup);
            
            // Also create a map by _originalName if it exists (for renamed default groups)
            if (overrideGroup._originalName) {
                const originalKey = overrideGroup.author ? `${overrideGroup._originalName}::${overrideGroup.author}` : overrideGroup._originalName || 'Unnamed';
                overrideGroupByOriginalName.set(originalKey, overrideGroup);
            }
        });

        // Merge default groups with overrides
        defaultGroups.forEach(defaultGroup => {
            let overrideGroup = null;
            let matchedBy = null;
            
            // Try to match by id first (preferred)
            if (defaultGroup.id) {
                overrideGroup = overrideGroupMapById.get(defaultGroup.id);
                if (overrideGroup) {
                    matchedBy = 'id';
                }
            }
            
            // If no match by id, try matching by name/author (backward compatibility)
            if (!overrideGroup) {
                const nameKey = defaultGroup.author ? `${defaultGroup.name}::${defaultGroup.author}` : defaultGroup.name || 'Unnamed';
                overrideGroup = overrideGroupMapByName.get(nameKey);
                if (overrideGroup) {
                    matchedBy = 'name';
                }
            }
            
            // If still no match, try matching by _originalName
            if (!overrideGroup) {
                const nameKey = defaultGroup.author ? `${defaultGroup.name}::${defaultGroup.author}` : defaultGroup.name || 'Unnamed';
                overrideGroup = overrideGroupByOriginalName.get(nameKey);
                if (overrideGroup) {
                    matchedBy = 'originalName';
                }
            }
            
            if (overrideGroup) {
                // Merge sections within the group
                const mergedSections = mergeSectionsInGroup(
                    defaultGroup.sections || [],
                    overrideGroup.sections || []
                );
                
                merged.push({
                    ...defaultGroup,
                    ...overrideGroup,
                    sections: mergedSections
                });
                
                // Remove from maps using the keys that were used to store them
                if (overrideGroup.id && matchedBy === 'id') {
                    overrideGroupMapById.delete(overrideGroup.id);
                }
                const currentNameKey = overrideGroup.author ? `${overrideGroup.name}::${overrideGroup.author}` : overrideGroup.name || 'Unnamed';
                overrideGroupMapByName.delete(currentNameKey);
                
                if (overrideGroup._originalName) {
                    const originalNameKey = overrideGroup.author ? `${overrideGroup._originalName}::${overrideGroup.author}` : overrideGroup._originalName || 'Unnamed';
                    overrideGroupByOriginalName.delete(originalNameKey);
                }
            } else {
                merged.push(defaultGroup);
            }
        });

        // Add any custom groups (not in defaults)
        overrideGroupMapById.forEach(overrideGroup => {
            merged.push(overrideGroup);
        });
        overrideGroupMapByName.forEach(overrideGroup => {
            // Only add if not already added via id map
            if (!overrideGroup.id || !overrideGroupMapById.has(overrideGroup.id)) {
                merged.push(overrideGroup);
            }
        });

        // Stamp surface type on each section (never type=custom; authorship is isCustom)
        merged.forEach(group => {
            group.sections.forEach(section => {
                if (sectionType === 'custom') {
                    section.isCustom = true;
                    const existing = String(section.type || '').toLowerCase();
                    if (['home', 'seasonal', 'discovery'].includes(existing)) {
                        // keep configured surface type
                    } else if (section.discoveryEnabled === true || section.discoveryType) {
                        section.type = 'discovery';
                    } else if (section.startDate && section.endDate) {
                        section.type = 'seasonal';
                    } else {
                        section.type = 'home';
                    }
                } else {
                    section.type = sectionType;
                }
            });
        });

        return merged;
    }

    /**
     * Merge sections within a group
     * @param {Array} defaultSections - Default sections
     * @param {Array} overrideSections - Override sections
     * @returns {Array} Merged sections
     */
    function mergeSectionsInGroup(defaultSections, overrideSections) {
        const merged = [];
        const overrideMap = new Map();
        
        // Create map of overrides by id
        overrideSections.forEach(override => {
            overrideMap.set(override.id, override);
        });

        // Merge defaults with overrides
        defaultSections.forEach(defaultSection => {
            const override = overrideMap.get(defaultSection.id);
            if (override) {
                // Deep merge: override takes precedence but preserve queries structure
                merged.push({
                    ...defaultSection,
                    ...override,
                    queries: override.queries || defaultSection.queries || []
                });
                overrideMap.delete(defaultSection.id);
            } else {
                merged.push(defaultSection);
            }
        });

        // Add any custom sections (not in defaults)
        overrideMap.forEach(override => {
            merged.push(override);
        });

        // Sort by order
        return merged.sort((a, b) => (a.order || 0) - (b.order || 0));
    }

    /**
     * Get saved config from JS Injector
     * @returns {Promise<Object>} Saved full KefinTweaksConfig object
     */
    async function getSavedConfig() {
        try {
            if (!window.ApiClient || !window.ApiClient._serverAddress || !window.ApiClient.accessToken) {
                WARN('ApiClient not available, using window.KefinTweaksConfig as fallback');
                return window.KefinTweaksConfig || {};
            }

            let injectorConfig;
            if (window.KefinTweaksUtils && typeof window.KefinTweaksUtils.getPluginConfiguration === 'function') {
                try {
                    injectorConfig = await window.KefinTweaksUtils.getPluginConfiguration([
                        'JavaScript Injector',
                        'JS Injector'
                    ]);
                } catch (pluginError) {
                    WARN('JavaScript Injector plugin not found, using window.KefinTweaksConfig as fallback');
                    return window.KefinTweaksConfig || {};
                }
            } else {
                WARN('KefinTweaksUtils.getPluginConfiguration not available, using window.KefinTweaksConfig as fallback');
                return window.KefinTweaksConfig || {};
            }

            // Find KefinTweaks-Config script
            const kefinTweaksScript = injectorConfig.CustomJavaScripts?.find(
                script => script.Name === 'KefinTweaks-Config'
            );

            if (kefinTweaksScript && kefinTweaksScript.Script) {
                // Extract config from script content
                const scriptMatch = kefinTweaksScript.Script.match(/window\.KefinTweaksConfig\s*=\s*({[\s\S]*});/);
                if (scriptMatch && scriptMatch[1]) {
                    try {
                        const config = JSON.parse(scriptMatch[1]);
                        return config || {};
                    } catch (parseError) {
                        ERR('Error parsing config from script:', parseError);
                    }
                }
            }

            // Fallback: use window.KefinTweaksConfig if available
            return window.KefinTweaksConfig || {};
        } catch (error) {
            ERR('Error getting saved config:', error);
            // Fallback: use window.KefinTweaksConfig if available
            return window.KefinTweaksConfig || {};
        }
    }

    /**
     * Deep merge queryOptions objects, preserving properties from savedQuery
     * @param {Object} savedQuery - Query from saved config
     * @param {Object} currentQuery - Query from current config
     * @returns {Object} Merged query object
     */
    function mergeQueryOptions(savedQuery, currentQuery) {
        if (!savedQuery && !currentQuery) return {};
        if (!savedQuery) return JSON.parse(JSON.stringify(currentQuery));
        if (!currentQuery) return JSON.parse(JSON.stringify(savedQuery));
        
        const merged = JSON.parse(JSON.stringify(savedQuery));
        
        // Deep merge queryOptions
        if (currentQuery.queryOptions) {
            merged.queryOptions = {
                ...(savedQuery.queryOptions || {}),
                ...currentQuery.queryOptions
            };
        } else if (savedQuery.queryOptions) {
            merged.queryOptions = JSON.parse(JSON.stringify(savedQuery.queryOptions));
        }
        
        // Merge other query-level properties (current takes precedence)
        Object.keys(currentQuery).forEach(key => {
            if (key !== 'queryOptions') {
                merged[key] = currentQuery[key];
            }
        });
        
        return merged;
    }

    /**
     * Merge queries arrays by index, preserving queryOptions from saved queries
     * @param {Array} savedQueries - Queries from saved config
     * @param {Array} currentQueries - Queries from current config
     * @returns {Array} Merged queries array
     */
    function mergeQueries(savedQueries, currentQueries) {
        if (!savedQueries || savedQueries.length === 0) {
            return currentQueries ? JSON.parse(JSON.stringify(currentQueries)) : [];
        }
        if (!currentQueries || currentQueries.length === 0) {
            return JSON.parse(JSON.stringify(savedQueries));
        }
        
        const merged = [];
        const maxLength = Math.max(savedQueries.length, currentQueries.length);
        
        for (let i = 0; i < maxLength; i++) {
            const savedQuery = savedQueries[i];
            const currentQuery = currentQueries[i];
            
            if (savedQuery && currentQuery) {
                // Both exist - merge them
                merged.push(mergeQueryOptions(savedQuery, currentQuery));
            } else if (currentQuery) {
                // Only current exists - use it
                merged.push(JSON.parse(JSON.stringify(currentQuery)));
            } else if (savedQuery) {
                // Only saved exists - preserve it
                merged.push(JSON.parse(JSON.stringify(savedQuery)));
            }
        }
        
        return merged;
    }

    /**
     * Merge section objects, preserving properties from savedSection
     * @param {Object} savedSection - Section from saved config
     * @param {Object} currentSection - Section from current config
     * @returns {Object} Merged section object
     */
    function mergeSection(savedSection, currentSection) {
        if (!savedSection && !currentSection) return null;
        if (!savedSection) return JSON.parse(JSON.stringify(currentSection));
        if (!currentSection) return JSON.parse(JSON.stringify(savedSection));
        
        const merged = JSON.parse(JSON.stringify(savedSection));
        
        // Merge section properties (current takes precedence for editable fields)
        Object.keys(currentSection).forEach(key => {
            if (key === 'queries') {
                // Special handling for queries array
                merged.queries = mergeQueries(savedSection.queries, currentSection.queries);
            } else {
                // For other properties, current config takes precedence
                merged[key] = currentSection[key];
            }
        });
        
        // Ensure id is preserved from currentSection
        if (currentSection.id) {
            merged.id = currentSection.id;
        }
        
        return merged;
    }

    const LIBRARY_SYNC_GROUP_IDS = new Set(['home-recently-added', 'home-popular-genres']);

    /**
     * Merge group objects, matching sections by id
     * @param {Object} savedGroup - Group from saved config
     * @param {Object} currentGroup - Group from current config
     * @returns {Object} Merged group object
     */
    function mergeGroup(savedGroup, currentGroup) {
        if (!savedGroup && !currentGroup) return null;
        if (!savedGroup) return JSON.parse(JSON.stringify(currentGroup));
        if (!currentGroup) return JSON.parse(JSON.stringify(savedGroup));
        
        const merged = JSON.parse(JSON.stringify(savedGroup));
        
        // Update group properties from current (name, author, etc.)
        Object.keys(currentGroup).forEach(key => {
            if (key !== 'sections') {
                merged[key] = currentGroup[key];
            }
        });
        
        // Merge sections by id
        const mergedSections = [];
        const savedSections = savedGroup.sections || [];
        const currentSections = currentGroup.sections || [];
        const savedSectionMap = new Map();
        
        // Create map of saved sections by id
        savedSections.forEach(section => {
            if (section.id && !section.deleted) {
                savedSectionMap.set(section.id, section);
            }
        });
        
        // Process current sections (merge or add)
        currentSections.forEach(currentSection => {
            if (currentSection.deleted) {
                // Skip deleted sections from current config
                return;
            }
            
            const savedSection = savedSectionMap.get(currentSection.id);
            if (savedSection) {
                // Section exists in both - merge them
                mergedSections.push(mergeSection(savedSection, currentSection));
                savedSectionMap.delete(currentSection.id);
            } else {
                // New section - add it
                mergedSections.push(JSON.parse(JSON.stringify(currentSection)));
            }
        });

        // Library template groups: current list is authoritative (verify may have pruned sections)
        const groupId = currentGroup.id || savedGroup.id;
        if (!LIBRARY_SYNC_GROUP_IDS.has(groupId)) {
            savedSectionMap.forEach(savedSection => {
                if (!savedSection.deleted) {
                    mergedSections.push(JSON.parse(JSON.stringify(savedSection)));
                }
            });
        }
        
        merged.sections = mergedSections;
        return merged;
    }

    /**
     * Merge home screen group configs, matching groups by id
     * @param {Array} currentGroups - Groups from current config
     * @param {Array} savedGroups - Groups from saved config
     * @returns {Array} Merged groups array
     */
    function mergeHomeScreenGroupConfig(currentGroups, savedGroups) {
        if (!currentGroups || currentGroups.length === 0) {
            // Filter out deleted groups from saved config
            return (savedGroups || []).filter(g => !g.deleted).map(g => JSON.parse(JSON.stringify(g)));
        }
        if (!savedGroups || savedGroups.length === 0) {
            return JSON.parse(JSON.stringify(currentGroups));
        }
        
        const merged = [];
        const savedGroupMap = new Map();
        
        // Create map of saved groups by id (with fallback to name for backward compatibility)
        savedGroups.forEach(group => {
            if (group.deleted) return;
            
            const key = group.id || group.name;
            if (key) {
                savedGroupMap.set(key, group);
            }
        });
        
        // Process current groups (merge or add)
        currentGroups.forEach(currentGroup => {
            if (currentGroup.deleted) {
                // Skip deleted groups from current config
                return;
            }
            
            const key = currentGroup.id || currentGroup.name;
            const savedGroup = key ? savedGroupMap.get(key) : null;
            
            if (savedGroup) {
                // Group exists in both - merge them
                merged.push(mergeGroup(savedGroup, currentGroup));
                savedGroupMap.delete(key);
            } else {
                // New group - add it
                merged.push(JSON.parse(JSON.stringify(currentGroup)));
            }
        });
        
        // Add any remaining saved groups that weren't in current (preserve them)
        savedGroupMap.forEach(savedGroup => {
            if (!savedGroup.deleted) {
                merged.push(JSON.parse(JSON.stringify(savedGroup)));
            }
        });
        
        return merged;
    }

    /**
     * Save configuration to JS Injector
     * Merges partial configs with in-memory window.KefinTweaksConfig to preserve existing data.
     * Utils performs the single injector Configuration GET + POST.
     */
    async function saveConfig(config) {
        try {
            // Ensure window.KefinTweaksConfig exists (modal already syncs this; cold path only)
            if (!window.KefinTweaksConfig) {
                window.KefinTweaksConfig = {};
            }

            const savedConfig = window.KefinTweaksConfig;
            const savedHomeScreenConfig = savedConfig.homeScreenConfig || {};
            
            // Create merged config
            const mergedHomeScreenConfig = {
                // Merge default groups (HOME, SEASONAL, DISCOVERY) using deep merge
                HOME_SECTION_GROUPS: mergeHomeScreenGroupConfig(
                    config.HOME_SECTION_GROUPS || [],
                    savedHomeScreenConfig.HOME_SECTION_GROUPS || []
                ),
                SEASONAL_SECTION_GROUPS: mergeHomeScreenGroupConfig(
                    config.SEASONAL_SECTION_GROUPS || [],
                    savedHomeScreenConfig.SEASONAL_SECTION_GROUPS || []
                ),
                DISCOVERY_SECTION_GROUPS: mergeHomeScreenGroupConfig(
                    config.DISCOVERY_SECTION_GROUPS || [],
                    savedHomeScreenConfig.DISCOVERY_SECTION_GROUPS || []
                ),
                // Custom groups are replaced entirely (UI is source of truth)
                CUSTOM_SECTION_GROUPS: config.CUSTOM_SECTION_GROUPS || [],
                // Merge other top-level properties (shallow merge)
                DISCOVERY_SETTINGS: {
                    ...(savedHomeScreenConfig.DISCOVERY_SETTINGS || {}),
                    ...(config.DISCOVERY_SETTINGS || {})
                },
                SEASONAL_THEME_SETTINGS: {
                    ...(savedHomeScreenConfig.SEASONAL_THEME_SETTINGS || {}),
                    ...(config.SEASONAL_THEME_SETTINGS || {})
                },
                CACHE: {
                    ...(savedHomeScreenConfig.CACHE || {}),
                    ...(config.CACHE || {})
                },
                SPOTLIGHT_SETTINGS: {
                    ...(savedHomeScreenConfig.SPOTLIGHT_SETTINGS || {}),
                    ...(config.SPOTLIGHT_SETTINGS || {})
                },
                HOME_SETTINGS: {
                    ...(savedHomeScreenConfig.HOME_SETTINGS || {}),
                    ...(config.HOME_SETTINGS || {})
                },
                USER_HOME_SCREEN_SETTINGS: {
                    ...(savedHomeScreenConfig.USER_HOME_SCREEN_SETTINGS || {}),
                    ...(config.USER_HOME_SCREEN_SETTINGS || {})
                }
            };

            normalizeContinueWatchingVisibility(mergedHomeScreenConfig);

            // Empty values (= blank CustomPrefs segments) must not persist to JS Injector
            omitEmptyPropsFromGroups(mergedHomeScreenConfig.HOME_SECTION_GROUPS);
            omitEmptyPropsFromGroups(mergedHomeScreenConfig.SEASONAL_SECTION_GROUPS);
            omitEmptyPropsFromGroups(mergedHomeScreenConfig.DISCOVERY_SECTION_GROUPS);
            omitEmptyPropsFromGroups(mergedHomeScreenConfig.CUSTOM_SECTION_GROUPS);

            // Update homeScreenConfig with merged result (other top-level keys already on window.KefinTweaksConfig)
            window.KefinTweaksConfig.homeScreenConfig = mergedHomeScreenConfig;
            currentConfig = mergedHomeScreenConfig;

            // Save to JS Injector using utils
            if (window.KefinTweaksUtils && window.KefinTweaksUtils.saveConfigToJavaScriptInjector) {
                await window.KefinTweaksUtils.saveConfigToJavaScriptInjector();
                LOG('Configuration saved to JS Injector');
                return true;
            } else {
                // Fallback: try to use configuration.js functions
                if (typeof window.KefinTweaksConfiguration !== 'undefined' && window.KefinTweaksConfiguration.saveConfigToJavaScriptInjector) {
                    await window.KefinTweaksConfiguration.saveConfigToJavaScriptInjector(window.KefinTweaksConfig);
                    LOG('Configuration saved to JS Injector (fallback)');
                    return true;
                }
                WARN('saveConfigToJavaScriptInjector not available');
                return false;
            }
        } catch (error) {
            ERR('Error saving config:', error);
            return false;
        }
    }

    /**
     * Build Jellyfin checkbox HTML
     */

    /**
     * Build compact section row HTML
     */
    function buildSectionRowHTML(section, type = 'home', groupName = null) {
        const isEnabled = section.enabled !== false;
        const isSeasonal = section.startDate && section.endDate;
        const isSpotlight = section.renderMode === 'Spotlight';
        const isDiscovery = section.discoveryEnabled === true;
        const isCustom = type.toLowerCase() === 'custom' || section.id.startsWith('custom');

        return `
            <div class="listItem section-row" data-section-id="${section.id}" data-section-type="${type}" draggable="true" style="border: 1px solid rgba(255,255,255,0.1); border-radius: 4px; padding: 0.75em; margin-bottom: 0.5em; display: flex; align-items: center; justify-content: space-between; cursor: pointer; transition: background-color 0.2s;" onmouseover="this.style.backgroundColor='rgba(255,255,255,0.05)'" onmouseout="this.style.backgroundColor=''">
                <div style="flex: 1; display: flex; align-items: center; gap: 1em;">
                    <!-- Toggle Switch -->
                    ${buildToggleSlider('', isEnabled, '', { 
                        dataAttributes: { 'section-id': section.id, 'section-type': type }, 
                        cssClass: 'toggle-slider section-toggle-switch', 
                        wrapInLabel: false 
                    })}
                    <!-- Section Info -->
                    <div style="flex: 1;">
                        <input type="text" class="listItemBodyText editable-section-name" data-section-id="${section.id}" value="${(section.name || 'Unnamed Section').replace(/"/g, '&quot;')}" size="${Math.max((section.name || 'Unnamed Section').length, 15)}" style="font-weight: 500; margin-bottom: 0.25em; cursor: text; padding: 0.25em 0.5em; border-radius: 3px; transition: background-color 0.2s; display: inline-block; border: none; outline: none; background: transparent; font-family: inherit; font-size: inherit; color: inherit;" onmouseover="this.style.backgroundColor='rgba(255,255,255,0.05)'" onmouseout="this.style.backgroundColor='transparent'" onfocus="this.style.backgroundColor='rgba(255,255,255,0.1)'" onblur="this.style.backgroundColor='transparent'" onclick="event.stopPropagation();" oninput="this.size=Math.max(this.value.length,15)" />
                        <div style="display: flex; gap: 1em; align-items: center; flex-wrap: wrap;">
                            ${groupName ? `<span class="listItemBodyText secondary" style="font-size: 0.8em; background: rgba(255,255,255,0.1); padding: 0.2em 0.5em; border-radius: 3px;">${groupName}</span>` : ''}
                            <span class="listItemBodyText secondary" style="font-size: 0.85em;">Order: ${section.order || 0}</span>
                            ${section.cardFormat && !isSpotlight ? `<span class="listItemBodyText secondary" style="font-size: 0.85em;">${section.cardFormat}</span>` : ''}
                            ${isSpotlight ? `<span class="listItemBodyText secondary spotlight-tag" style="font-size: 0.85em;">Spotlight</span>` : ''}
                            ${isSeasonal ? `<span class="listItemBodyText secondary seasonal-tag" style="font-size: 0.85em;">Active from: ${section.startDate} - ${section.endDate}</span>` : ''}
                            ${isDiscovery ? `<span class="listItemBodyText secondary discovery-tag" style="font-size: 0.85em;">Discovery</span>` : ''}
                        </div>
                    </div>
                </div>
                <div style="display: flex; gap: 0.5em; align-items: center;">
                    <button type="button" class="emby-button section-preview-btn raised" data-section-id="${section.id}" data-section-type="${type}" style="padding: 0.5em 1em; background: rgba(0, 164, 220, 0.2); opacity: 0; transition: opacity 0.2s; pointer-events: none;">
                        <span>Preview</span>
                    </button>
                    <button type="button" class="emby-button section-edit-btn raised" data-section-id="${section.id}" data-section-type="${type}" style="padding: 0.5em 1em; opacity: 0; transition: opacity 0.2s; pointer-events: none;">
                        <span>Edit</span>
                    </button>
                    ${isCustom ? `
                        <button type="button" class="emby-button section-delete-btn raised" data-section-id="${section.id}" style="padding: 0.5em 1em; background: rgba(244, 67, 54, 0.2); opacity: 0; transition: opacity 0.2s; pointer-events: none;">
                            <span>Delete</span>
                        </button>
                    ` : ''}
                </div>
            </div>
        `;
    }

    /**
     * Check if device is mobile
     */
    function isMobile() {
        return window.innerWidth <= 768;
    }

    function toggleSectionType(e) {
        const sectionType = e.target.dataset.sectionType;
        const groupContainer = e.target.closest('.section-group');
        if (!groupContainer) return;

        // Get data-section-type-sectionType attribute from the group container
        const sectionTypeAttribute = groupContainer.getAttribute(`data-section-type-${sectionType}`);
        const newState = sectionTypeAttribute === 'false' ? 'true' : 'false';

        if (newState === 'true') {
            e.target.classList.add('button-submit');
        } else {
            e.target.classList.remove('button-submit');
        }

        groupContainer.setAttribute(`data-section-type-${sectionType}`, newState);
    }

    function renderSectionTypeToggles(sectionTypes) {
        const sectionTypeTogglesContainer = document.createElement('div');
        sectionTypeTogglesContainer.style.display = 'flex';
        sectionTypeTogglesContainer.style.gap = '0.5em';

        for (const type of sectionTypes) {
            const button = document.createElement('button');
            button.type = 'button';
            button.textContent = type;
            button.classList.add('emby-button');
            button.classList.add('section-type-toggle-btn');
            button.classList.add('raised');
            button.classList.add('block');
            button.classList.add('button-submit');
            button.dataset.sectionType = type;
            button.style.padding = '0.5em 1em';
            button.style.fontSize = '0.9em';
            // Event handler is attached via event delegation in attachMainModalListeners
            sectionTypeTogglesContainer.appendChild(button);
        }

        return sectionTypeTogglesContainer.outerHTML;
    }

    /**
     * Build section navigation HTML (left column)
     */
    function buildSectionNavigationHTML(activeType = 'home') {
        const types = [
            { id: 'home', label: 'Home Sections' },
            { id: 'seasonal', label: 'Seasonal Sections' },
            { id: 'discovery', label: 'Discovery Sections' },
            { id: 'custom', label: 'Custom Sections' }
        ];

        return `
            <div style="display: flex; flex-direction: column; gap: 0.5em;">
                ${types.map(type => `
                    <button type="button" 
                            class="section-type-nav-btn ${activeType === type.id ? 'active' : ''}" 
                            data-section-type="${type.id}"
                            style="padding: 0.75em 1em; text-align: left; background: ${activeType === type.id ? 'rgba(0, 164, 220, 0.2)' : 'rgba(255,255,255,0.05)'}; border: 1px solid ${activeType === type.id ? 'rgba(0, 164, 220, 0.5)' : 'rgba(255,255,255,0.1)'}; border-radius: 4px; color: ${activeType === type.id ? 'var(--theme-primary-color, #00a4dc)' : 'inherit'}; cursor: pointer; transition: all 0.2s;">
                        <span class="listItemBodyText" style="font-weight: ${activeType === type.id ? '500' : '400'};">${type.label}</span>
                    </button>
                `).join('')}
            </div>
        `;
    }

    /**
     * Build global settings sub-navigation HTML (left column, same style as Edit Sections nav)
     */
    function buildGlobalSettingsNavigationHTML(activeSubTab = 'general') {
        const tabs = [
            { id: 'general', label: 'General Settings' },
            { id: 'spotlight', label: 'Spotlight Settings' },
            { id: 'discovery', label: 'Discovery Settings' },
            { id: 'cache', label: 'Cache Settings' }
        ];
        return `
            <div style="display: flex; flex-direction: column; gap: 0.5em;">
                ${tabs.map(tab => `
                    <button type="button"
                            class="global-settings-nav-btn ${activeSubTab === tab.id ? 'active' : ''}"
                            data-global-settings-tab="${tab.id}"
                            style="padding: 0.75em 1em; text-align: left; background: ${activeSubTab === tab.id ? 'rgba(0, 164, 220, 0.2)' : 'rgba(255,255,255,0.05)'}; border: 1px solid ${activeSubTab === tab.id ? 'rgba(0, 164, 220, 0.5)' : 'rgba(255,255,255,0.1)'}; border-radius: 4px; color: ${activeSubTab === tab.id ? 'var(--theme-primary-color, #00a4dc)' : 'inherit'}; cursor: pointer; transition: all 0.2s;">
                        <span class="listItemBodyText" style="font-weight: ${activeSubTab === tab.id ? '500' : '400'};">${tab.label}</span>
                    </button>
                `).join('')}
            </div>
        `;
    }

    /**
     * Build global settings panel content for the given sub-tab
     */
    function buildGlobalSettingsPanelContent(subTab) {
        switch (subTab) {
            case 'general': return buildGeneralSettingsHTML();
            case 'spotlight': return se().buildGlobalSpotlightSettingsHTML?.(currentConfig) || '';
            case 'discovery': return buildDiscoverySettingsHTML();
            case 'cache': return buildCacheSettingsHTML();
            default: return buildGeneralSettingsHTML();
        }
    }

    /**
     * Build group HTML with sections and toggle-all button
     */
    function buildGroupHTML(group, sectionType) {
        let sections = group.sections || [];
        if (sections.length === 0) return '';
        
        const allEnabled = sections.every(s => s.enabled !== false);
        const groupId = `group-${group.name || 'unnamed'}-${group.author || ''}`.replace(/[^a-zA-Z0-9-]/g, '-');

        // Get unique section types
        const sectionTypes = [...new Set(sections.map(s => s.sectionType))];
        
        return `
            <div class="section-group" data-group-id="${groupId}" data-group-name="${group.name || 'Unnamed Group'}" style="margin-bottom: 1.5em; border: 1px solid rgba(255,255,255,0.1); border-radius: 4px; padding: 1em;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.75em;">
                    <div>
                        <input type="text" class="listItemBodyText editable-group-name" data-group-id="${groupId}" value="${(group.name || 'Unnamed Group').replace(/"/g, '&quot;')}" size="${Math.max((group.name || 'Unnamed Group').length, 15)}" style="font-weight: 500; font-size: 1.1em; cursor: text; padding: 0.25em 0.5em; border-radius: 3px; transition: background-color 0.2s; border: none; outline: none; background: transparent; font-family: inherit; color: inherit;" onmouseover="this.style.backgroundColor='rgba(255,255,255,0.05)'" onmouseout="this.style.backgroundColor='transparent'" onfocus="this.style.backgroundColor='rgba(255,255,255,0.1)'" onblur="this.style.backgroundColor='transparent'" oninput="this.size=Math.max(this.value.length,15)" />
                        ${group.description ? `<div class="listItemBodyText secondary" style="font-size: 0.85em; margin-top: 0.25em;">${group.description}</div>` : ''}
                        ${group.author ? `<div class="listItemBodyText secondary" style="font-size: 0.8em; margin-top: 0.25em; color: rgba(255,255,255,0.5);">by ${group.author}</div>` : ''}
                    </div>
                    ${sectionTypes.length > 1 ? `<div class="listItemBodyText secondary" style="font-size: 0.85em; margin-top: 0.25em;">${renderSectionTypeToggles(sectionTypes)}</div>` : ''}
                    <button type="button" class="emby-button group-toggle-all-btn raised" data-group-id="${groupId}" data-enabled="${allEnabled}" style="padding: 0.5em 1em; font-size: 0.9em;">
                        <span>${allEnabled ? 'Disable All' : 'Enable All'}</span>
                    </button>
                </div>
                <div class="group-sections-list" data-group-id="${groupId}">
                    ${sections.map(s => buildSectionRowHTML(s, s.sectionType ?? sectionType, s.sectionType)).join('')}
                </div>
            </div>
        `;
    }

    /**
     * Build section content HTML (right column)
     */
    function buildSectionContentHTML(sectionType) {
        // Always use currentConfig as source of truth
        if (!currentConfig) return '<div class="listItemBodyText secondary">No configuration loaded.</div>';

        switch (sectionType) {
            case 'home': {
                const homeGroups = currentConfig.HOME_SECTION_GROUPS || [];
                
                return `
                    <div>
                        <div class="listItemBodyText" style="font-weight: 500; margin-bottom: 1em;">Home Sections</div>
                        <div class="listItemBodyText secondary" style="font-size: 0.85em; margin-bottom: 0.75em;">Customize the default Home Sections provided by KefinTweaks.</div>
                        <div id="home-sections-list">
                            ${homeGroups.map(g => buildGroupHTML(g, 'home')).join('')}
                        </div>
                    </div>
                `;
            }
            case 'seasonal': {
                const seasonalGroups = currentConfig.SEASONAL_SECTION_GROUPS || [];
                
                return `
                    <div>
                        <div class="listItemBodyText" style="font-weight: 500; margin-bottom: 1em;">Seasonal Sections</div>
                        <div class="listItemBodyText secondary" style="font-size: 0.85em; margin-bottom: 0.75em;">Customize the default Seasonal Home Sections provided by KefinTweaks. These sections only appear between the specified start and end dates.</div>
                        <div id="seasonal-sections-list">
                            ${seasonalGroups.map(g => buildGroupHTML(g, 'home')).join('')}
                        </div>
                    </div>
                `;
            }
            case 'discovery': {
                const discoveryGroups = currentConfig.DISCOVERY_SECTION_GROUPS || [];
                
                return `
                    <div>
                        <div class="listItemBodyText" style="font-weight: 500; margin-bottom: 1em;">Discovery Sections</div>
                        <div class="listItemBodyText secondary" style="font-size: 0.85em; margin-bottom: 0.75em;">Discovery sections will appear dynamically on the home screen as the user scrolls down. They are pre-fetched and cached in the background to ensure a smooth experience. You can customize their settings here.</div>
                        <div id="discovery-sections-list">
                            ${discoveryGroups.map(g => buildGroupHTML(g, 'discovery')).join('')}
                        </div>
                    </div>
                `;
            }
            case 'custom': {
                const customGroups = currentConfig.CUSTOM_SECTION_GROUPS || [];
                
                return `
                    <div>
                        <div class="listItemBodyText" style="font-weight: 500; margin-bottom: 1em;">Custom Sections</div>
                        <div class="listItemBodyText secondary" style="font-size: 0.85em; margin-bottom: 0.75em;">Customize your Custom Home Sections here. You can add, edit, and delete your own sections. You can also import community collections or a file you exported from the Import / Export tab.</div>
                        <div id="custom-sections-list">
                            ${customGroups.map(g => buildGroupHTML(g, 'custom')).join('')}
                        </div>
                        <button type="button" class="emby-button button-submit raised add-custom-section-btn" style="padding: 0.75em 1.5em; margin-top: 0.75em;">
                            <span>Add Custom Section</span>
                        </button>
                    </div>
                `;
            }
            default:
                return '<div class="listItemBodyText secondary">Unknown section type</div>';
        }
    }

    /**
     * Build main configuration modal content
     */
    function buildMainConfigHTML() {
        // Always use currentConfig as source of truth
        if (!currentConfig) return '<div class="listItemBodyText secondary">No configuration loaded.</div>';

        // Use currentActiveTab to determine which tab/content should be displayed
        const activeTab = normalizeActiveTab(currentActiveTab);
        currentActiveTab = activeTab;

        return `
            <div style="max-width: 100%; width: calc(100vw - 4em); overflow: hidden;">
                <!-- Toolbar -->
                <div class="hsc-config-toolbar" style="display: flex; gap: 0.5em; flex-wrap: wrap; margin-bottom: 0.75em;">
                    <button type="button" class="emby-button raised hsc-toolbar-new-section-btn" title="Create a new section">
                        <span class="material-icons" style="margin-right: 0.35em; font-size: 1.1em; vertical-align: middle;">add</span>
                        <span>New Section</span>
                    </button>
                    <button type="button" class="emby-button raised hsc-toolbar-update-btn" title="Save and apply these settings to all users.">
                        <span class="material-icons" style="margin-right: 0.35em; font-size: 1.1em; vertical-align: middle;">sync</span>
                        <span>Update</span>
                    </button>
                </div>

                <!-- Tab Navigation -->
                <div class="config-tab-nav">
                    <button type="button" class="config-tab-btn ${activeTab === 'settings' ? 'active' : ''}" data-tab="settings" title="Global Settings">
                        <span class="material-icons config-tab-icon" aria-hidden="true">settings</span>
                        <span class="config-tab-label">Global Settings</span>
                    </button>
                    <button type="button" class="config-tab-btn ${activeTab === 'sections' ? 'active' : ''}" data-tab="sections" title="Edit Sections">
                        <span class="material-icons config-tab-icon" aria-hidden="true">edit</span>
                        <span class="config-tab-label">Edit Sections</span>
                    </button>
                    <button type="button" class="config-tab-btn ${activeTab === 'order' ? 'active' : ''}" data-tab="order" title="Order Sections">
                        <span class="material-icons config-tab-icon" aria-hidden="true">reorder</span>
                        <span class="config-tab-label">Order Sections</span>
                    </button>
                    <button type="button" class="config-tab-btn ${activeTab === 'import-export' ? 'active' : ''}" data-tab="import-export" title="Import / Export">
                        <span class="material-icons config-tab-icon" aria-hidden="true">swap_horiz</span>
                        <span class="config-tab-label">Import / Export</span>
                    </button>
                    <button type="button" class="config-tab-btn ${activeTab === 'troubleshoot' ? 'active' : ''}" data-tab="troubleshoot" title="Troubleshoot">
                        <span class="material-icons config-tab-icon" aria-hidden="true">troubleshoot</span>
                        <span class="config-tab-label">Troubleshoot</span>
                    </button>
                </div>

                <!-- Global Settings Tab (left nav + right content, same layout as Edit Sections) -->
                <div id="tab-settings" class="config-tab-content" style="display: ${activeTab === 'settings' ? 'block' : 'none'};">
                    <div class="hsc-split-pane">
                        <!-- Left Column: Sub-tab navigation -->
                        <div id="global-settings-navigation">
                            ${buildGlobalSettingsNavigationHTML(currentGlobalSettingsSubTab)}
                        </div>
                        <!-- Right Column: Content for selected sub-tab -->
                        <div id="global-settings-content">
                            ${buildGlobalSettingsPanelContent(currentGlobalSettingsSubTab)}
                        </div>
                    </div>
                </div>

                <!-- Edit Sections Tab -->
                <div id="tab-sections" class="config-tab-content" style="display: ${activeTab === 'sections' ? 'block' : 'none'};">
                    <div class="hsc-split-pane">
                        <!-- Left Column: Navigation -->
                        <div id="section-navigation">
                            ${buildSectionNavigationHTML('home')}
                        </div>
                        <!-- Right Column: Content -->
                        <div id="section-content">
                            ${buildSectionContentHTML('home')}
                        </div>
                    </div>
                </div>

                <!-- Order Sections Tab -->
                <div id="tab-order" class="config-tab-content" style="display: ${activeTab === 'order' ? 'block' : 'none'};">
                    <div id="order-sections-container">
                    </div>
                </div>

                <!-- Import / Export Sections Tab (includes community collections) -->
                <div id="tab-import-export" class="config-tab-content" style="display: ${activeTab === 'import-export' ? 'block' : 'none'};">
                    <div class="listItemBodyText" style="margin-bottom: 1em;">Share your custom home screen sections or import configurations from others.</div>
                    <div style="display: flex; gap: 1em; flex-wrap: wrap; margin-top: 0.5em; margin-bottom: 1.5em;">
                        <button type="button" class="emby-button button-submit raised export-sections-btn" style="padding: 0.75em 1.5em;">
                            <span>Export Sections</span>
                        </button>
                        <button type="button" class="emby-button button-submit raised import-sections-btn" style="padding: 0.75em 1.5em;">
                            <span>Import Sections</span>
                        </button>
                    </div>
                    <div class="listItemBodyText" style="margin-bottom: 0.5em; font-weight: 500;">Browse Community Sections</div>
                    <div class="listItemBodyText" style="margin-bottom: 0.5em;">Browse and import curated home screen sections from the community.</div>
                    <div class="listItemBodyText secondary" style="margin-bottom: 1em;">Submit your own Home Screen Sections <a href="https://github.com/ranaldsgift/KefinTweaks/discussions/64" target="_blank" class="button-link">here.</a></div>
                    <div id="communityCollectionsHost">
                        <div id="communityCollectionsGrid"></div>
                    </div>
                </div>

                <!-- Troubleshoot Tab -->
                <div id="tab-troubleshoot" class="config-tab-content" style="display: ${activeTab === 'troubleshoot' ? 'block' : 'none'};">
                    <div id="home-screen-benchmark-root"></div>
                </div>
            </div>
            <style>
                .section-row:hover .section-preview-btn,
                .section-row:hover .section-edit-btn,
                .section-row:hover .section-delete-btn {
                    opacity: 1 !important;
                    pointer-events: auto !important;
                }
                .toggle-slider:hover {
                    opacity: 0.9;
                    transform: scale(1.02);
                }
                .toggle-slider[data-enabled="true"]:hover {
                    background: rgba(0, 164, 220, 1) !important;
                }
                .toggle-slider[data-enabled="false"]:hover {
                    background: rgba(158, 158, 158, 0.7) !important;
                }
            </style>
        `;
    }

    /**
     * Build general settings HTML
     */
    function buildGeneralSettingsHTML() {
        if (!currentConfig) return '';
        const seasonal = currentConfig.SEASONAL_THEME_SETTINGS || {};
        const homeSettings = currentConfig.HOME_SETTINGS || {};
        const userHomeScreen = currentConfig.USER_HOME_SCREEN_SETTINGS || {};
        const D = GENERAL_TOGGLE_DESCRIPTIONS;
        return `
            <div class="hsc-settings-grid hsc-settings-grid-2">
                ${hscToggleCard('userHome-inlineConfigure', userHomeScreen.inlineConfigure !== false, 'Inline Section Configuration', D)}
                ${hscToggleCard('userHome-pinning', userHomeScreen.pinning !== false, 'Pin To Home', D)}
                ${hscToggleCard('home-fadeInSections', homeSettings.fadeInSections === true, 'Fade In Sections', D)}
                ${hscToggleCard('home-showStaleDataBeforeRefresh', homeSettings.SHOW_STALE_DATA_BEFORE_REFRESH === true, 'Show Stale Items', D)}
                ${hscToggleCard('seasonal-enableSeasonalAnimations', seasonal.enableSeasonalAnimations !== false, 'Seasonal Animations', D)}
                ${hscToggleCard('seasonal-enableSeasonalBackground', seasonal.enableSeasonalBackground !== false, 'Seasonal Backgrounds', D)}
                <div class="hsc-settings-span-2">
                    ${hscToggleCard('home-ensureThumbsForPopularTVNetworks', homeSettings.ensureThumbsForPopularTVNetworks === true, 'Require Studio Thumbs', D)}
                </div>
            </div>
        `;
    }

    /**
     * Build discovery settings HTML
     */
    function buildDiscoverySettingsHTML() {
        if (!currentConfig) return '';
        const discovery = currentConfig.DISCOVERY_SETTINGS || {};
        const D = DISCOVERY_TOGGLE_DESCRIPTIONS;

        return `
            <div class="hsc-settings-panel">
                <div class="hsc-settings-desc listItemBodyText secondary">
                    <p>Discovery Sections are Home Screen sections that are dynamically created when a user scrolls down the Home Screen. When Discovery Sections are requested, KefinTweaks will dynamically build a Discovery Group from the list of enabled Discovery Sections. It will render the Discovery Group and then when the user reaches the bottom of the page again, a new Discovery Group will be generated and rendered.</p>
                    <p>KefinTweaks provides many default Discovery Sections, but you may also create your own static Discovery Sections. If you create multiple Discovery Sections within the same Group, KefinTweaks will select the first unrendered section from that Group when it builds the next Discovery Group.</p>
                </div>
                <div class="hsc-settings-grid hsc-settings-grid-2">
                    ${hscToggleCard('discovery-enabled', discovery.enabled !== false, 'Enabled', D)}
                    ${hscToggleCard('discovery-infiniteScroll', discovery.infiniteScroll !== false, 'Infinite Scroll', D)}
                    ${hscToggleCard('discovery-renderSpotlightAboveMatching', discovery.renderSpotlightAboveMatching === true, 'Group Related Sections', D)}
                    ${hscToggleCard('discovery-randomizeOrder', discovery.randomizeOrder === true, 'Randomize Order', D)}
                    ${hscToggleCard('discovery-fadeInSections', discovery.fadeInSections === true, 'Fade In Sections', D)}
                    ${buildTextInput('discovery-spotlightDiscoveryChance', discovery.spotlightDiscoveryChance ?? 0.5, 'Spotlight Discovery Chance (0-1)', 'number')}
                    ${buildTextInput('discovery-minPeopleAppearances', discovery.minPeopleAppearances || 10, 'Top Person Appearance Count', 'number')}
                    ${buildTextInput('discovery-minGenreMovieCount', discovery.minGenreMovieCount || 50, 'Genre Movie Count', 'number')}
                </div>
            </div>
        `;
    }

    /**
     * Build seasonal settings HTML (deprecated - moved to General Settings)
     */
    function buildSeasonalSettingsHTML() {
        return '';
    }

    /**
     * Convert milliseconds to minutes
     */
    function msToMinutes(ms) {
        return Math.round(ms / 60000);
    }

    /**
     * Convert minutes to milliseconds
     */
    function minutesToMs(minutes) {
        return minutes * 60000;
    }

    function getDefaultTtlPresets() {
        const presets = window.KefinHomeScreenAdvancedEditor?.getCachePresets?.();
        if (Array.isArray(presets) && presets.length) {
            return presets.filter((p) => p.key !== 'FORCE_REFRESH');
        }
        const cache = currentConfig?.CACHE || window.KefinHomeConfig2?.CACHE || {};
        return [
            { key: 'VERY_SHORT', label: 'Very Short (1 min)', ms: cache.VERY_SHORT_TTL ?? 60000 },
            { key: 'SHORT', label: 'Short (5 min)', ms: cache.SHORT_TTL ?? 300000 },
            { key: 'DEFAULT', label: 'Default (1 hour)', ms: cache.DEFAULT_TTL ?? 3600000 },
            { key: 'LONG', label: 'Long (24 hours)', ms: cache.LONG_TTL ?? 86400000 },
            { key: 'STATIC', label: 'Static (1 week)', ms: cache.STATIC_TTL ?? 604800000 },
            { key: 'DISCOVERY', label: 'Discovery (6 hours)', ms: cache.DISCOVERY_TTL ?? 21600000 },
            { key: 'CUSTOM', label: 'Custom', ms: null }
        ];
    }

    function matchDefaultTtlPreset(ms) {
        const value = Number(ms);
        if (!Number.isFinite(value)) {
            return { preset: 'DEFAULT', customValue: '', customUnit: 'minutes' };
        }
        const exact = getDefaultTtlPresets().find((p) => p.key !== 'CUSTOM' && p.ms === value);
        if (exact) return { preset: exact.key, customValue: '', customUnit: 'minutes' };
        const minutes = Math.round(value / 60000);
        if (minutes > 0 && minutes * 60000 === value) {
            return { preset: 'CUSTOM', customValue: String(minutes), customUnit: 'minutes' };
        }
        const seconds = Math.round(value / 1000);
        return { preset: 'CUSTOM', customValue: String(seconds), customUnit: 'seconds' };
    }

    function resolveDefaultTtlMsFromForm(root) {
        const presetEl = root.querySelector('#cache-DEFAULT_TTL-preset');
        if (!presetEl) return null;
        const presetKey = presetEl.value || 'DEFAULT';
        if (presetKey === 'CUSTOM') {
            const raw = parseFloat(root.querySelector('#cache-DEFAULT_TTL-custom-value')?.value || '');
            const unit = root.querySelector('#cache-DEFAULT_TTL-custom-unit')?.value || 'minutes';
            const unitMs = TTL_UNIT_OPTIONS.find((u) => u.value === unit)?.ms || 60000;
            if (!Number.isFinite(raw) || raw < 0) return 0;
            return Math.round(raw * unitMs);
        }
        const preset = getDefaultTtlPresets().find((p) => p.key === presetKey);
        return preset?.ms ?? (currentConfig?.CACHE?.DEFAULT_TTL ?? 3600000);
    }

    /**
     * Build cache settings HTML
     */
    function buildCacheSettingsHTML() {
        if (!currentConfig) return '';
        const cache = currentConfig.CACHE || {};
        const defaultMatch = matchDefaultTtlPreset(cache.DEFAULT_TTL ?? 1800000);
        const isCustomDefault = defaultMatch.preset === 'CUSTOM';
        const presetOptions = getDefaultTtlPresets().map((p) => ({
            value: p.key,
            label: p.label
        }));

        return `
            <div class="hsc-settings-panel">
                <div class="hsc-settings-desc listItemBodyText secondary">
                    <p>Every Home Screen Section has a cache expiration time associated to it. If the section has no explicitly defined cache value, it will use the Default setting below.</p>
                    <p>When a Section is being loaded, if the cache has not expired, the cached items will be rendered instead of requesting new data. If a Section has "No Cache" set, it will always request new data from the server.</p>
                    <p>The Cache settings listed below will appear as options when creating or editing a Home Screen Section in the "Advanced Options" at the bottom of the editor.</p>
                </div>
                <div class="hsc-settings-grid hsc-settings-grid-3">
                    <div class="hsc-default-ttl-field">
                        ${buildSelect('cache-DEFAULT_TTL-preset', presetOptions, defaultMatch.preset, 'Default')}
                        <div id="cache-DEFAULT_TTL-custom-row" class="hsc-default-ttl-custom" style="display:${isCustomDefault ? 'grid' : 'none'}; grid-template-columns: 1fr 1fr; gap: 0.75em; margin-top: 0.75em;">
                            ${buildTextInput('cache-DEFAULT_TTL-custom-value', defaultMatch.customValue || '', 'Custom Duration', 'number')}
                            ${buildSelect('cache-DEFAULT_TTL-custom-unit', TTL_UNIT_OPTIONS.map((u) => ({ value: u.value, label: u.value })), defaultMatch.customUnit || 'minutes', 'Unit')}
                        </div>
                    </div>
                    ${buildTextInput('cache-VERY_SHORT_TTL', msToMinutes(cache.VERY_SHORT_TTL || 60000), 'Very Short (minutes)', 'number')}
                    ${buildTextInput('cache-SHORT_TTL', msToMinutes(cache.SHORT_TTL || 300000), 'Short (minutes)', 'number')}
                    ${buildTextInput('cache-LONG_TTL', msToMinutes(cache.LONG_TTL || 86400000), 'Long (minutes)', 'number')}
                    ${buildTextInput('cache-STATIC_TTL', msToMinutes(cache.STATIC_TTL || 604800000), 'Static (minutes)', 'number')}
                    ${buildTextInput('cache-DISCOVERY_TTL', msToMinutes(cache.DISCOVERY_TTL || 3600000), 'Discovery (minutes)', 'number')}
                </div>
            </div>
        `;
    }

    /**
     * Collect settings present in the currently rendered Global Settings panel into currentConfig.
     * Missing panels are left unchanged (avoids resetting values when switching sub-tabs).
     */
    function applyGlobalSettingsFromForm({ save = true, immediate = false } = {}) {
        if (!currentConfig) return;
        const dialog = document.querySelector(`.dialogContainer[data-modal-id="${MAIN_MODAL_ID}"]`);
        const root = dialog?.querySelector('#global-settings-content') || dialog;
        if (!root) return;

        if (root.querySelector('#discovery-enabled')) {
            currentConfig.DISCOVERY_SETTINGS = {
                ...(currentConfig.DISCOVERY_SETTINGS || {}),
                enabled: root.querySelector('#discovery-enabled')?.checked !== false,
                infiniteScroll: root.querySelector('#discovery-infiniteScroll')?.checked !== false,
                minPeopleAppearances: parseInt(root.querySelector('#discovery-minPeopleAppearances')?.value || '10', 10),
                minGenreMovieCount: parseInt(root.querySelector('#discovery-minGenreMovieCount')?.value || '50', 10),
                spotlightDiscoveryChance: parseFloat(root.querySelector('#discovery-spotlightDiscoveryChance')?.value || '0.5'),
                renderSpotlightAboveMatching: root.querySelector('#discovery-renderSpotlightAboveMatching')?.checked === true,
                randomizeOrder: root.querySelector('#discovery-randomizeOrder')?.checked === true,
                fadeInSections: root.querySelector('#discovery-fadeInSections')?.checked === true
            };
        }

        if (root.querySelector('#seasonal-enableSeasonalAnimations')
            || root.querySelector('#home-fadeInSections')
            || root.querySelector('#userHome-inlineConfigure')) {
            currentConfig.SEASONAL_THEME_SETTINGS = {
                ...(currentConfig.SEASONAL_THEME_SETTINGS || {}),
                enableSeasonalAnimations: root.querySelector('#seasonal-enableSeasonalAnimations')?.checked !== false,
                enableSeasonalBackground: root.querySelector('#seasonal-enableSeasonalBackground')?.checked !== false,
                seasonToggles: (window.KefinHomeConfig2?.SEASONAL_THEME_SETTINGS?.seasonToggles || []).map(season => ({
                    ...season,
                    enabled: root.querySelector(`#seasonal-${season.id}`)
                        ? root.querySelector(`#seasonal-${season.id}`)?.checked === true
                        : season.enabled
                }))
            };
            currentConfig.HOME_SETTINGS = {
                ...(currentConfig.HOME_SETTINGS || {}),
                fadeInSections: root.querySelector('#home-fadeInSections')?.checked === true,
                ensureThumbsForPopularTVNetworks: root.querySelector('#home-ensureThumbsForPopularTVNetworks')?.checked === true,
                SHOW_STALE_DATA_BEFORE_REFRESH: root.querySelector('#home-showStaleDataBeforeRefresh')?.checked === true
            };
            currentConfig.USER_HOME_SCREEN_SETTINGS = {
                ...(currentConfig.USER_HOME_SCREEN_SETTINGS || {}),
                inlineConfigure: root.querySelector('#userHome-inlineConfigure')?.checked !== false,
                pinning: root.querySelector('#userHome-pinning')?.checked !== false
            };
        }

        if (root.querySelector('#cache-DEFAULT_TTL-preset') || root.querySelector('#cache-VERY_SHORT_TTL')) {
            const defaultTtl = resolveDefaultTtlMsFromForm(root);
            currentConfig.CACHE = {
                ...(currentConfig.CACHE || {}),
                DEFAULT_TTL: defaultTtl != null ? defaultTtl : (currentConfig.CACHE?.DEFAULT_TTL ?? 1800000),
                VERY_SHORT_TTL: minutesToMs(parseInt(root.querySelector('#cache-VERY_SHORT_TTL')?.value || '1', 10)),
                SHORT_TTL: minutesToMs(parseInt(root.querySelector('#cache-SHORT_TTL')?.value || '5', 10)),
                LONG_TTL: minutesToMs(parseInt(root.querySelector('#cache-LONG_TTL')?.value || '1440', 10)),
                STATIC_TTL: minutesToMs(parseInt(root.querySelector('#cache-STATIC_TTL')?.value || '10080', 10)),
                DISCOVERY_TTL: minutesToMs(parseInt(root.querySelector('#cache-DISCOVERY_TTL')?.value || '60', 10)),
                FORCE_REFRESH_TTL: 0
            };
        }

        if (root.querySelector('#spotlight-cycleBackdrops') || root.querySelector('[id^="spotlight-"]')) {
            const spotlight = se().collectSpotlightConfigFromDialog?.(root, 'spotlight-', { useIntervalSeconds: true });
            if (spotlight && typeof spotlight === 'object') {
                currentConfig.SPOTLIGHT_SETTINGS = spotlight;
            }
        }

        if (!save) return;

        const runSave = () => saveConfig(currentConfig);
        if (immediate) {
            clearTimeout(globalSettingsSaveTimer);
            globalSettingsSaveTimer = null;
            return runSave();
        }
        clearTimeout(globalSettingsSaveTimer);
        globalSettingsSaveTimer = setTimeout(() => {
            globalSettingsSaveTimer = null;
            runSave();
        }, 300);
    }

    /** @deprecated Prefer applyGlobalSettingsFromForm — kept for callers that expect a return object */
    function collectGlobalSettings() {
        applyGlobalSettingsFromForm({ save: false });
        return {
            DISCOVERY_SETTINGS: currentConfig?.DISCOVERY_SETTINGS,
            SEASONAL_THEME_SETTINGS: currentConfig?.SEASONAL_THEME_SETTINGS,
            CACHE: currentConfig?.CACHE,
            SPOTLIGHT_SETTINGS: currentConfig?.SPOTLIGHT_SETTINGS,
            HOME_SETTINGS: currentConfig?.HOME_SETTINGS,
            USER_HOME_SCREEN_SETTINGS: currentConfig?.USER_HOME_SCREEN_SETTINGS
        };
    }

    const GROUP_TYPE_BY_SECTION_TYPE = {
        home: 'HOME_SECTION_GROUPS',
        seasonal: 'SEASONAL_SECTION_GROUPS',
        discovery: 'DISCOVERY_SECTION_GROUPS',
        custom: 'CUSTOM_SECTION_GROUPS'
    };

    function resolveEditorKind() {
        return 'advanced';
    }

    function buildGroupContext(section) {
        const found = findSectionInAllGroups(currentConfig, section.id);
        let currentGroupName = found?.group?.name || '';
        if (!currentGroupName && section._targetGroupName && section._targetGroupName !== 'New...') {
            currentGroupName = section._targetGroupName;
        }
        const allGroups = currentConfig.CUSTOM_SECTION_GROUPS || [];
        const existingGroupNames = [...new Set(allGroups.map(g => g.name).filter(Boolean))];
        return { currentGroupName, existingGroupNames, found };
    }

    /**
     * Refresh main modal content
     */

    async function openSectionEditor(section, sectionType = 'home', options = {}) {
        const found = findSectionInAllGroups(currentConfig, section.id);
        const isExisting = !!found;
        const isNewCustom = sectionType === 'custom' && !isExisting
            && !window.KefinHomeScreenEditorProfiles?.isKnownDefaultSection(section.id);

        const editCtxBase = {
            sectionType,
            config: currentConfig,
            onSave: async (sectionData) => {
                const targetGroupName = sectionData._targetGroupName;
                delete sectionData._targetGroupName;

                const found = findSectionInAllGroups(currentConfig, sectionData.id);
                const savingToCustom = !found || found.groupType === 'CUSTOM_SECTION_GROUPS'
                    || (targetGroupName && !found);
                if (savingToCustom || sectionData.isCustom) {
                    sectionData.isCustom = true;
                }
                const surface = String(sectionData.type || '').toLowerCase();
                if (!['home', 'seasonal', 'discovery'].includes(surface)) {
                    if (sectionData.discoveryEnabled === true || sectionData.discoveryType) {
                        sectionData.type = 'discovery';
                    } else if (sectionData.startDate && sectionData.endDate) {
                        sectionData.type = 'seasonal';
                    } else {
                        sectionData.type = 'home';
                    }
                }

                if (found) {
                    if (targetGroupName && targetGroupName !== found.group.name) {
                        found.group.sections.splice(found.sectionIndex, 1);
                        addSectionToGroup(currentConfig[found.groupType], targetGroupName, sectionData);
                    } else {
                        updateSectionInGroups(currentConfig[found.groupType], sectionData.id, sectionData);
                    }
                } else {
                    addSectionToGroup(currentConfig.CUSTOM_SECTION_GROUPS, targetGroupName || 'Custom Sections', sectionData);
                }

                await saveConfig(currentConfig);
                showToast(found ? 'Section saved' : 'Saved new Home Screen Section');
                refreshMainModal();
                if (options.refreshHomeOnSave && !mainModalInstance) {
                    try {
                        await window.homeScreen3?.refreshHomeSections?.();
                    } catch (e) {
                        WARN('Failed to refresh home after section save:', e);
                    }
                }
            },
            onPreview: async (sectionData, type, btn) => {
                await previewSection(sectionData, type, btn);
            }
        };

        if (isNewCustom && window.KefinHomeScreenSectionEditor?.openCreateSection) {
            return window.KefinHomeScreenSectionEditor.openCreateSection(section, editCtxBase);
        }

        if (!window.KefinHomeScreenSectionEditor?.openEditSection) {
            showToast('Section editor not available');
            return;
        }

        const originalSection = JSON.parse(JSON.stringify(section));
        const groupType = found?.groupType || GROUP_TYPE_BY_SECTION_TYPE[sectionType] || null;
        const isCustomSection = groupType === 'CUSTOM_SECTION_GROUPS';
        const editorProfile = window.KefinHomeScreenEditorProfiles?.resolveEditorProfile(section, {
            groupType,
            isCustomSection
        }) || 'full';
        const lockVisibility = window.KefinHomeScreenEditorProfiles?.getEditorProfileDefinition(editorProfile)?.lockVisibility === true;

        return window.KefinHomeScreenSectionEditor.openEditSection(section, {
            ...editCtxBase,
            editorKind: resolveEditorKind(),
            editorProfile,
            groupType,
            lockVisibility,
            originalSection,
            groupContext: buildGroupContext(section)
        });
    }

    const GROUP_TYPE_TO_SECTION_TYPE = {
        HOME_SECTION_GROUPS: 'home',
        SEASONAL_SECTION_GROUPS: 'seasonal',
        DISCOVERY_SECTION_GROUPS: 'discovery',
        CUSTOM_SECTION_GROUPS: 'custom'
    };

    /**
     * Whether the Section Editor can open this section (admin + in config + not pinned).
     * @param {string} sectionId
     * @returns {Promise<boolean>}
     */
    async function canOpenSectionEditor(sectionId) {
        if (!sectionId || String(sectionId).startsWith('pinned-')) return false;
        try {
            const admin = await window.apiHelper?.isAdmin?.();
            if (!admin) return false;
        } catch {
            return false;
        }
        getConfig();
        return !!findSectionInAllGroups(currentConfig, sectionId);
    }

    /**
     * Open the Section Editor for a section id (same path as clicking a row in admin config).
     * @param {string} sectionId
     * @returns {Promise<boolean>}
     */
    async function openSectionEditorForId(sectionId) {
        if (!(await canOpenSectionEditor(sectionId))) return false;
        getConfig();
        const found = findSectionInAllGroups(currentConfig, sectionId);
        if (!found?.section) return false;
        const sectionType = GROUP_TYPE_TO_SECTION_TYPE[found.groupType] || 'home';
        await openSectionEditor(found.section, sectionType, { refreshHomeOnSave: true });
        return true;
    }


    function refreshMainModal() {
        if (!mainModalInstance) return;
        
        // Store current section type if on sections tab
        let currentSectionType = 'home';
        if (currentActiveTab === 'sections') {
            const activeNavBtn = mainModalInstance.dialogContent.querySelector('.section-type-nav-btn.active');
            if (activeNavBtn) {
                currentSectionType = activeNavBtn.dataset.sectionType;
            }
        }

        // Store current active tab before refresh
        const savedActiveTab = normalizeActiveTab(currentActiveTab);

        const content = document.createElement('div');
        content.innerHTML = buildMainConfigHTML();
        mainModalInstance.updateContent(content);

        // Reset the listeners flag so they can be re-attached to the new content
/*         if (mainModalInstance.dialog) {
            delete mainModalInstance.dialog.dataset.mainModalListenersAttached;
            delete mainModalInstance.dialog.dataset.sectionListenersAttached;
        }

        // Re-attach event listeners (including tab listeners)
        attachMainModalListeners();
        attachTabListeners(mainModalInstance); */
        
        // Restore active tab
        if (savedActiveTab) {
            const dialog = mainModalInstance.dialogContainer;
            if (dialog) {
                const tabBtn = dialog.querySelector(`.config-tab-btn[data-tab="${savedActiveTab}"]`);
                if (tabBtn) {
                    tabBtn.click();
                }
            }
        }
        
        // If we were on sections tab, restore the section type navigation
        if (currentActiveTab === 'sections') {
            const dialog = mainModalInstance.dialogContainer;
            const navBtns = dialog.querySelectorAll('.section-type-nav-btn');
            navBtns.forEach(btn => {
                if (btn.dataset.sectionType === currentSectionType) {
                    btn.click();
                }
            });
        }
    }


    /**
     * Render home sections order editor
     * @param {Array} sections - Flattened array of sections from HOME_SECTIONS, SEASONAL_SECTIONS, CUSTOM_SECTIONS
     */
    function renderHomeSectionsOrderEditor(sections) {
        if (!sections || !Array.isArray(sections)) {
            return '<div class="listItemBodyText secondary">No sections found.</div>';
        }

        const filteredSections = sections.filter(s => !s.hidden);

        // Verify sections are ordered by .order value and sort if needed
        const sortedSections = [...filteredSections].sort((a, b) => {
            const orderA = a.order || 0;
            const orderB = b.order || 0;
            return orderA - orderB;
        });

        if (sortedSections.length === 0) {
            return '<div class="listItemBodyText secondary">No sections to order.</div>';
        }

        // Create a dummy group with all sections to reuse buildGroupHTML
        const dummyGroup = {
            name: 'All Home Sections',
            sections: sortedSections,
            author: ''
        };

        return `
            ${buildGroupHTML(dummyGroup, 'all')}
        `;
    }


    /**
     * Mount / refresh the Benchmark tab UI (cancels any in-flight run).
     */
    function initBenchmarkTab(modalInstance) {
        const dialog = modalInstance?.dialogContainer || modalInstance?.dialogContent;
        const root = dialog?.querySelector('#home-screen-benchmark-root');
        if (!root) return;
        if (window.KefinHomeScreenBenchmark?.cancelActiveRun) {
            window.KefinHomeScreenBenchmark.cancelActiveRun(true);
        }
        if (window.KefinHomeScreenBenchmark?.renderHomeScreenBenchmarkUI) {
            window.KefinHomeScreenBenchmark.renderHomeScreenBenchmarkUI(root, {
                getConfig: () => currentConfig
            });
        } else {
            root.innerHTML = '<p class="listItemBodyText secondary">Benchmark module not loaded.</p>';
        }
    }

    /**
     * Attach tab switching listeners
     */
    function attachTabListeners(modalInstance) {
        const dialog = modalInstance.dialogContainer;
        if (!dialog) return;

        // Use event delegation to prevent stacking listeners when switching tabs
        dialog.addEventListener('click', (e) => {
            const btn = e.target.closest('.config-tab-btn');
            if (!btn) return;
            const targetTab = btn.dataset.tab;

            // Persist Global Settings before leaving the settings tab / switching away
            if (currentActiveTab === 'settings' && targetTab !== 'settings') {
                applyGlobalSettingsFromForm({ save: true, immediate: true });
            }
            
            // Update the current active tab tracker
            currentActiveTab = normalizeActiveTab(targetTab);

            const tabButtons = dialog.querySelectorAll('.config-tab-btn');
            const tabContents = dialog.querySelectorAll('.config-tab-content');

            // Update button states
            tabButtons.forEach(b => {
                b.classList.toggle('active', b === btn);
            });

            // Update tab content visibility
            tabContents.forEach(content => {
                content.style.display = 'none';
            });
            const targetContent = dialog.querySelector(`#tab-${currentActiveTab}`);
            if (targetContent) {
                targetContent.style.display = 'block';
                
                // Refresh tab content based on currentConfig when switching tabs
                if (currentActiveTab === 'order') {
                    // Order Sections tab - refresh with current config
                    const container = targetContent.querySelector('#order-sections-container');
                    if (container) {
                        const allSections = [
                            ...flattenSectionGroups(currentConfig.HOME_SECTION_GROUPS || []).map(s => ({ ...s, sectionType: 'Default' })),
                            ...flattenSectionGroups(currentConfig.SEASONAL_SECTION_GROUPS || []).map(s => ({ ...s, sectionType: 'Seasonal' })),
                            ...flattenSectionGroups(currentConfig.CUSTOM_SECTION_GROUPS || []).map(s => ({ ...s, sectionType: 'Custom' }))
                        ];
                        container.innerHTML = renderHomeSectionsOrderEditor(allSections);
                    }
                } else if (currentActiveTab === 'sections') {
                    // Edit Sections tab - refresh section content based on current active section type
                    const contentContainer = dialog.querySelector('#section-content');
                    if (contentContainer) {
                        // Get the currently active section type navigation button
                        const activeNavBtn = dialog.querySelector('.section-type-nav-btn.active');
                        const activeType = activeNavBtn ? activeNavBtn.dataset.sectionType : 'home';
                        
                        // Re-render the section content with current config
                        contentContainer.innerHTML = buildSectionContentHTML(activeType);
                    }
                } else if (currentActiveTab === 'import-export') {
                    setupCommunityCollectionsTab(dialog);
                } else if (currentActiveTab === 'troubleshoot') {
                    initBenchmarkTab(modalInstance);
                }
            }
        });

/*         const tabButtons = dialog.querySelectorAll('.config-tab-btn');
        const tabContents = dialog.querySelectorAll('.config-tab-content');

        tabButtons.forEach(btn => {
            btn.addEventListener('click', () => {
                const targetTab = btn.dataset.tab;
                
                // Update the current active tab tracker
                currentActiveTab = targetTab;

                // Update button states
                tabButtons.forEach(b => {
                    b.classList.remove('active');
                    b.style.borderBottomColor = 'transparent';
                    b.style.color = 'rgba(255,255,255,0.7)';
                });
                btn.classList.add('active');
                btn.style.borderBottomColor = 'var(--theme-primary-color, #00a4dc)';
                btn.style.color = 'var(--theme-primary-color, #00a4dc)';

                // Update tab content visibility
                tabContents.forEach(content => {
                    content.style.display = 'none';
                });
                const targetContent = dialog.querySelector(`#tab-${targetTab}`);
                if (targetContent) {
                    targetContent.style.display = 'block';
                    
                    // Refresh tab content based on currentConfig when switching tabs
                    if (targetTab === 'order') {
                        // Order Sections tab - refresh with current config
                        const container = targetContent.querySelector('#order-sections-container');
                        if (container) {
                            const allSections = [
                                ...flattenSectionGroups(currentConfig.HOME_SECTION_GROUPS || []).map(s => ({ ...s, sectionType: 'Default' })),
                                ...flattenSectionGroups(currentConfig.SEASONAL_SECTION_GROUPS || []).map(s => ({ ...s, sectionType: 'Seasonal' })),
                                ...flattenSectionGroups(currentConfig.CUSTOM_SECTION_GROUPS || []).map(s => ({ ...s, sectionType: 'Custom' }))
                            ];
                            container.innerHTML = renderHomeSectionsOrderEditor(allSections);
                        }
                    } else if (targetTab === 'sections') {
                        // Edit Sections tab - refresh section content based on current active section type
                        const contentContainer = dialog.querySelector('#section-content');
                        if (contentContainer) {
                            // Get the currently active section type navigation button
                            const activeNavBtn = dialog.querySelector('.section-type-nav-btn.active');
                            const activeType = activeNavBtn ? activeNavBtn.dataset.sectionType : 'home';
                            
                            // Re-render the section content with current config
                            contentContainer.innerHTML = buildSectionContentHTML(activeType);
                        }
                    }
                }
            });
        }); */
    }

    /**
     * Attach event listeners to main modal
     */
    function syncDefaultTtlCustomRow(contentRoot) {
        const root = contentRoot || document.querySelector(`.dialogContainer[data-modal-id="${MAIN_MODAL_ID}"] #global-settings-content`);
        if (!root) return;
        const preset = root.querySelector('#cache-DEFAULT_TTL-preset');
        const row = root.querySelector('#cache-DEFAULT_TTL-custom-row');
        if (!row || !preset) return;
        row.style.display = preset.value === 'CUSTOM' ? 'grid' : 'none';
    }

    function wireGlobalSettingsPanelListeners(contentRoot) {
        if (!contentRoot) return;
        syncDefaultTtlCustomRow(contentRoot);
        window.KefinTweaksUI?.bindToggleCards?.(contentRoot);
        updateHscToggleCardHints(contentRoot, GENERAL_TOGGLE_DESCRIPTIONS);
        updateHscToggleCardHints(contentRoot, DISCOVERY_TOGGLE_DESCRIPTIONS);
    }

    function ensureGlobalSettingsLiveSync(dialog) {
        if (!dialog || dialog.dataset.hscGlobalSettingsWired === 'true') return;
        dialog.dataset.hscGlobalSettingsWired = 'true';

        dialog.addEventListener('change', (e) => {
            if (!e.target?.closest?.('#global-settings-content')) return;
            if (e.target.id === 'cache-DEFAULT_TTL-preset') syncDefaultTtlCustomRow();
            const content = dialog.querySelector('#global-settings-content');
            updateHscToggleCardHints(content, GENERAL_TOGGLE_DESCRIPTIONS);
            updateHscToggleCardHints(content, DISCOVERY_TOGGLE_DESCRIPTIONS);
            applyGlobalSettingsFromForm({ save: true });
        });
        dialog.addEventListener('input', (e) => {
            if (!e.target?.closest?.('#global-settings-content')) return;
            applyGlobalSettingsFromForm({ save: true });
        });
        dialog.addEventListener('click', (e) => {
            const toggle = e.target.closest?.('.toggle-slider, .kefin-toggle-switch');
            if (!toggle || !toggle.closest('#global-settings-content')) return;

            if (toggle.classList.contains('kefin-toggle-switch')) {
                const checkboxId = toggle.dataset.checkboxId;
                const checkbox = checkboxId ? document.getElementById(checkboxId) : null;
                if (checkbox && toggle.dataset.kefinToggleBound !== 'true') {
                    checkbox.checked = !checkbox.checked;
                    checkbox.dispatchEvent(new Event('change', { bubbles: true }));
                    updateToggleSwitchUI(toggle, checkbox.checked);
                }
            }

            setTimeout(() => {
                const content = dialog.querySelector('#global-settings-content');
                updateHscToggleCardHints(content, GENERAL_TOGGLE_DESCRIPTIONS);
                updateHscToggleCardHints(content, DISCOVERY_TOGGLE_DESCRIPTIONS);
                applyGlobalSettingsFromForm({ save: true });
            }, 0);
        });
    }

    function openNewCustomSectionEditor() {
        const defaultTtl = Number(currentConfig?.CACHE?.DEFAULT_TTL);
        const newSection = {
            id: `custom-${Date.now()}`,
            name: 'New Custom Section',
            enabled: true,
            order: 100,
            cardFormat: 'Poster',
            ...(Number.isFinite(defaultTtl) ? { ttl: defaultTtl } : {}),
            queries: [{
                queryOptions: {
                    SortBy: 'Random',
                    Limit: window.KefinHomeScreenEditorConstants?.DEFAULT_SECTION_QUERY_LIMIT ?? 16
                }
            }]
        };
        openSectionEditor(newSection, 'custom');
    }

    function applyOrderListFromForm(dialogRoot) {
        const orderList = dialogRoot?.querySelector('#order-sections-list');
        if (!orderList) return;
        const allRows = Array.from(orderList.querySelectorAll('.section-order-row'));
        allRows.forEach((r, index) => {
            const sectionId = r.dataset.sectionId;
            if (!sectionId) return;
            const found = findSectionInAllGroups(currentConfig, sectionId);
            if (found?.section) {
                found.section.order = (index + 1) * 10;
            }
        });
    }

    async function collectAndSaveConfig(modalInstance) {
        clearTimeout(globalSettingsSaveTimer);
        globalSettingsSaveTimer = null;
        applyGlobalSettingsFromForm({ save: false });
        applyOrderListFromForm(modalInstance?.dialogContent);
        await saveConfig(currentConfig);
    }

    function confirmAndUpdateAllUsers() {
        if (!window.ModalSystem) {
            ERR('ModalSystem not available for update confirmation');
            return;
        }
        if (window.ModalSystem.isOpen(UPDATE_ALL_CONFIRM_MODAL_ID)) {
            window.ModalSystem.close(UPDATE_ALL_CONFIRM_MODAL_ID);
        }

        const content = document.createElement('div');
        content.innerHTML = `
            <div class="listItemBodyText" style="line-height: 1.5;">
                WARNING: This will forcefully update the KefinTweaks Home Screen user preferences for all accounts on your server. Any changes those users have made to customize their home screen will be lost.
            </div>
        `;
        const footer = document.createElement('div');
        footer.style.display = 'flex';
        footer.style.gap = '0.5em';
        footer.style.justifyContent = 'flex-end';
        footer.innerHTML = `
            <button type="button" class="emby-button raised" id="hsc-update-all-cancel">Cancel</button>
            <button type="button" class="emby-button raised block button-submit" id="hsc-update-all-confirm">Update All Users</button>
        `;

        window.ModalSystem.create({
            id: UPDATE_ALL_CONFIRM_MODAL_ID,
            title: 'Update All Users',
            content,
            footer,
            closeOnBackdrop: true,
            closeOnEscape: true,
            showCloseButton: true,
            fixedSize: true,
            onOpen: (modal) => {
                modal.dialogFooter?.querySelector('#hsc-update-all-cancel')?.addEventListener('click', () => {
                    window.ModalSystem.close(UPDATE_ALL_CONFIRM_MODAL_ID);
                });
                modal.dialogFooter?.querySelector('#hsc-update-all-confirm')?.addEventListener('click', async () => {
                    const confirmBtn = modal.dialogFooter.querySelector('#hsc-update-all-confirm');
                    if (confirmBtn) confirmBtn.disabled = true;
                    try {
                        await collectAndSaveConfig(mainModalInstance);
                        window.ModalSystem.close(UPDATE_ALL_CONFIRM_MODAL_ID);
                        showToast('Configuration saved. Updating users…');
                        await window.KefinUserHomeScreenConfig?.updateUserHomeScreenConfiguration?.();
                    } catch (e) {
                        ERR('Error updating configuration for all users:', e);
                        showToast('Error updating users');
                    } finally {
                        if (confirmBtn) confirmBtn.disabled = false;
                    }
                });
            }
        });
    }

    function attachMainModalListeners(modalInstance) {
        const dialog = modalInstance?.dialogContainer ?? document.querySelector(`.dialogContainer[data-modal-id="${MAIN_MODAL_ID}"]`);
        if (!dialog) return;

        if (dialog.dataset.mainModalListenersAttached === 'true') {
            return; // Listeners already attached, skip
        }
        dialog.dataset.mainModalListenersAttached = 'true';

        // Attach initial section row listeners
        attachSectionRowListeners(dialog);
        
        // Group toggle-all buttons
        // Use event delegation to prevent stacking listeners when switching tabs
        dialog.addEventListener('click', async (e) => {
            const btn = e.target.closest('.group-toggle-all-btn');
            if (!btn) return;
            
            e.stopPropagation();
            const groupId = btn.dataset.groupId;
            const currentEnabled = btn.dataset.enabled === 'true';
            const newEnabled = !currentEnabled;
            
            const groupElement = dialog.querySelector(`.section-group[data-group-id="${groupId}"]`);
            if (!groupElement) return;
            
            const sectionsList = groupElement.querySelector('.group-sections-list');
            if (!sectionsList) return;
            
            // Find all sections in this group and update them
            const sectionRows = sectionsList.querySelectorAll('.section-row');
            const sectionIds = Array.from(sectionRows).map(row => row.dataset.sectionId);
            
            // Update all sections in the group
            sectionIds.forEach(sectionId => {
                const found = findSectionInAllGroups(currentConfig, sectionId);
                if (found && found.section) {
                    found.section.enabled = newEnabled;
                }
            });
            
            await saveConfig(currentConfig);
            
            // Update UI
            btn.dataset.enabled = newEnabled;
            btn.querySelector('span').textContent = newEnabled ? 'Disable All' : 'Enable All';
            
            // Update all toggle switches in the group
            sectionRows.forEach(row => {
                const toggleBtn = row.querySelector('.toggle-slider');
                if (toggleBtn) {
                    updateToggleSliderUI(toggleBtn, newEnabled);
                }
            });
        });
        /* dialog.querySelectorAll('.group-toggle-all-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                e.stopPropagation();
                const groupId = btn.dataset.groupId;
                const currentEnabled = btn.dataset.enabled === 'true';
                const newEnabled = !currentEnabled;
                
                const groupElement = dialog.querySelector(`.section-group[data-group-id="${groupId}"]`);
                if (!groupElement) return;
                
                const sectionsList = groupElement.querySelector('.group-sections-list');
                if (!sectionsList) return;
                
                // Find all sections in this group and update them
                const sectionRows = sectionsList.querySelectorAll('.section-row');
                const sectionIds = Array.from(sectionRows).map(row => row.dataset.sectionId);
                
                // Update all sections in the group
                sectionIds.forEach(sectionId => {
                    const found = findSectionInAllGroups(currentConfig, sectionId);
                    if (found && found.section) {
                        found.section.enabled = newEnabled;
                    }
                });
                
                await saveConfig(currentConfig);
                
                // Update UI
                btn.dataset.enabled = newEnabled;
                btn.querySelector('span').textContent = newEnabled ? 'Disable All' : 'Enable All';
                
                // Update all toggle switches in the group
                sectionRows.forEach(row => {
                    const toggleBtn = row.querySelector('.toggle-slider');
                    if (toggleBtn) {
                        updateToggleSliderUI(toggleBtn, newEnabled);
                    }
                });
            });
        }); */

        // Add custom section button - use event delegation
        dialog.addEventListener('click', (e) => {
            const btn = e.target.closest('.add-custom-section-btn') || e.target.closest('.section-type-nav-btn[data-section-type="create"]');
            if (!btn) return;
            openNewCustomSectionEditor();
        });

        // Section type toggle buttons - use event delegation
        dialog.addEventListener('click', (e) => {
            const btn = e.target.closest('.section-type-toggle-btn');
            if (!btn) return;
            toggleSectionType(e);
        });

        // Section type navigation buttons
        // Use event delegation to prevent stacking listeners when switching tabs
        dialog.addEventListener('click', (e) => {
            const btn = e.target.closest('.section-type-nav-btn:not([data-section-type="create"])');
            if (!btn) return;
            const sectionType = btn.dataset.sectionType;
                
                // Update active button
            dialog.querySelectorAll('.section-type-nav-btn').forEach(b => {
                b.classList.remove('active');
                b.style.background = 'rgba(255,255,255,0.05)';
                b.style.borderColor = 'rgba(255,255,255,0.1)';
                b.style.color = 'inherit';
                const label = b.querySelector('.listItemBodyText');
                if (label) label.style.fontWeight = '400';
            });
            btn.classList.add('active');
            btn.style.background = 'rgba(0, 164, 220, 0.2)';
            btn.style.borderColor = 'rgba(0, 164, 220, 0.5)';
            btn.style.color = 'var(--theme-primary-color, #00a4dc)';
            const label = btn.querySelector('.listItemBodyText');
            if (label) label.style.fontWeight = '500';
            
            // Update content
            const contentContainer = dialog.querySelector('#section-content');
            if (contentContainer) {
                contentContainer.innerHTML = buildSectionContentHTML(sectionType);
            }
        });

        // Global Settings sub-tab navigation (left nav in Global Settings tab)
        dialog.addEventListener('click', (e) => {
            const btn = e.target.closest('.global-settings-nav-btn');
            if (!btn) return;
            const subTab = btn.dataset.globalSettingsTab;
            if (!subTab) return;

            applyGlobalSettingsFromForm({ save: true, immediate: true });

            currentGlobalSettingsSubTab = subTab;

            dialog.querySelectorAll('.global-settings-nav-btn').forEach(b => {
                b.classList.remove('active');
                b.style.background = 'rgba(255,255,255,0.05)';
                b.style.borderColor = 'rgba(255,255,255,0.1)';
                b.style.color = 'inherit';
                const label = b.querySelector('.listItemBodyText');
                if (label) label.style.fontWeight = '400';
            });
            btn.classList.add('active');
            btn.style.background = 'rgba(0, 164, 220, 0.2)';
            btn.style.borderColor = 'rgba(0, 164, 220, 0.5)';
            btn.style.color = 'var(--theme-primary-color, #00a4dc)';
            const label = btn.querySelector('.listItemBodyText');
            if (label) label.style.fontWeight = '500';

            const contentContainer = dialog.querySelector('#global-settings-content');
            if (contentContainer) {
                contentContainer.innerHTML = buildGlobalSettingsPanelContent(subTab);
                if (subTab === 'spotlight') se().attachGlobalSpotlightSettings?.(contentContainer, currentConfig);
                wireGlobalSettingsPanelListeners(contentContainer);
            }
        });

        ensureGlobalSettingsLiveSync(dialog);

        const globalSettingsContent = dialog.querySelector('#global-settings-content');
        if (globalSettingsContent) {
            if (currentGlobalSettingsSubTab === 'spotlight') {
                se().attachGlobalSpotlightSettings?.(globalSettingsContent, currentConfig);
            }
            wireGlobalSettingsPanelListeners(globalSettingsContent);
        }

        dialog.addEventListener('click', (e) => {
            if (e.target.closest('.hsc-toolbar-new-section-btn')) {
                openNewCustomSectionEditor();
                return;
            }
            if (e.target.closest('.hsc-toolbar-update-btn')) {
                confirmAndUpdateAllUsers();
            }
        });
        /* dialog.querySelectorAll('.section-type-nav-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const sectionType = btn.dataset.sectionType;
                
                // Update active button
                dialog.querySelectorAll('.section-type-nav-btn').forEach(b => {
                    b.classList.remove('active');
                    b.style.background = 'rgba(255,255,255,0.05)';
                    b.style.borderColor = 'rgba(255,255,255,0.1)';
                    b.style.color = 'inherit';
                    const label = b.querySelector('.listItemBodyText');
                    if (label) label.style.fontWeight = '400';
                });
                btn.classList.add('active');
                btn.style.background = 'rgba(0, 164, 220, 0.2)';
                btn.style.borderColor = 'rgba(0, 164, 220, 0.5)';
                btn.style.color = 'var(--theme-primary-color, #00a4dc)';
                const label = btn.querySelector('.listItemBodyText');
                if (label) label.style.fontWeight = '500';
                
                // Update content
                const contentContainer = dialog.querySelector('#section-content');
                if (contentContainer) {
                    contentContainer.innerHTML = buildSectionContentHTML(sectionType);
                }
            });
        }); */

        // Community Collections tab setup
        setupCommunityCollectionsTab(dialog);

        // Export Sections button
        const exportSectionsBtn = dialog.querySelector('.export-sections-btn');
        if (exportSectionsBtn) {
            exportSectionsBtn.addEventListener('click', () => {
                showExportDialog();
            });
        }

        // Import Sections button
        const importSectionsBtn = dialog.querySelector('.import-sections-btn');
        if (importSectionsBtn) {
            importSectionsBtn.addEventListener('click', () => {
                showImportDialog();
            });
        }
    }

    /**
     * Get section order value from config by section ID
     */
    function getSectionOrder(sectionId) {
        const found = findSectionInAllGroups(currentConfig, sectionId);
        return found?.section?.order || 0;
    }

    /**
     * Update section position in place without refreshing the entire modal
     * This preserves scroll position and provides a smoother UX
     */
    function updateSectionPositionInPlace(draggedElement, container) {
        if (!draggedElement || !container) return;
        
        // Get all section rows in the container
        const allRows = Array.from(container.querySelectorAll('.section-row'));
        if (allRows.length === 0) return;
        
        // Store scroll position - try to find the scrollable parent
        const scrollableParent = container.closest('.dialogContent') || container.closest('.dialog') || container.parentElement;
        const scrollTop = scrollableParent?.scrollTop || 0;
        
        // Sort rows by their order value from config
        allRows.sort((a, b) => {
            const aId = a.dataset.sectionId;
            const bId = b.dataset.sectionId;
            const aOrder = getSectionOrder(aId);
            const bOrder = getSectionOrder(bId);
            return aOrder - bOrder;
        });
        
        // Re-append rows in sorted order and update order display
        allRows.forEach(row => {
            container.appendChild(row);
            
            // Update the order display in the row
            const sectionId = row.dataset.sectionId;
            const order = getSectionOrder(sectionId);
            
            // Find all secondary text spans and update the one that shows Order
            const secondarySpans = row.querySelectorAll('.listItemBodyText.secondary');
            secondarySpans.forEach(span => {
                const text = span.textContent.trim();
                if (text.startsWith('Order:')) {
                    span.textContent = `Order: ${order}`;
                }
            });
        });
        
        // Restore scroll position
        if (scrollableParent && scrollableParent.scrollTop !== undefined) {
            scrollableParent.scrollTop = scrollTop;
        }
    }

    /**
     * Calculate new order value based on drag position using DOM elements
     * New logic: if section after dropped position exists, use its order - 1; if not, use preceding section order + 1
     */
    function calculateNewOrder(draggedElement, targetElement, dropPosition) {
        const container = targetElement.parentElement;
        const allRows = Array.from(container.querySelectorAll('.section-row'));
        
        // Find the target's position in the DOM
        const targetIndex = allRows.indexOf(targetElement);
        
        if (dropPosition === 'above') {
            // Dropped above target element
            if (targetIndex === 0) {
                // Dropped at the beginning - use first section order - 1
                const firstSectionId = targetElement.dataset.sectionId;
                const firstOrder = getSectionOrder(firstSectionId);
                return Math.max(0, firstOrder - 1);
            } else {
                // Dropped between elements - use target's order - 1 (section after dropped position)
                const targetSectionId = targetElement.dataset.sectionId;
                const targetOrder = getSectionOrder(targetSectionId);
                return Math.max(0, targetOrder - 1);
            }
        } else {
            // dropPosition === 'below'
            if (targetIndex === allRows.length - 1) {
                // Dropped at the end - use last section order + 1 (preceding section + 1)
                const lastSectionId = targetElement.dataset.sectionId;
                const lastOrder = getSectionOrder(lastSectionId);
                return lastOrder + 1;
            } else {
                // Dropped between elements - check if section after exists
                const nextElement = allRows[targetIndex + 1];
                if (nextElement && nextElement !== draggedElement) {
                    // Section after exists - use its order - 1
                    const nextSectionId = nextElement.dataset.sectionId;
                    const nextOrder = getSectionOrder(nextSectionId);
                    return Math.max(0, nextOrder - 1);
                } else {
                    // No section after - use preceding section (target) order + 1
                    const targetSectionId = targetElement.dataset.sectionId;
                    const targetOrder = getSectionOrder(targetSectionId);
                    return targetOrder + 1;
                }
            }
        }
    }

    /**
     * Attach listeners to section rows (helper for dynamic content)
     * Uses event delegation to prevent stacking listeners when switching tabs
     */
    function attachSectionRowListeners(dialog) {
        // Check if listeners have already been attached using a data attribute
        if (dialog.dataset.sectionListenersAttached === 'true') {
            return; // Listeners already attached, skip
        }
        
        // Mark that listeners have been attached
        dialog.dataset.sectionListenersAttached = 'true';
        
        const defaultSections = flattenSectionGroups(window.KefinHomeConfig2?.HOME_SECTION_GROUPS || []);
        const defaultIds = new Set(defaultSections.map(s => s.id));
        
        // Consolidated handler for editable section and group names - use event delegation
        dialog.addEventListener('blur', async (e) => {
            // Handle section names
            const sectionNameEl = e.target.closest('.editable-section-name');
            if (sectionNameEl) {
                const sectionId = sectionNameEl.dataset.sectionId;
                const newName = sectionNameEl.value.trim();
                
                if (!newName) {
                    showToast('Section name cannot be empty');
                    // Restore old name
                    const found = findSectionInAllGroups(currentConfig, sectionId);
                    if (found?.section) {
                        sectionNameEl.value = found.section.name || 'Unnamed Section';
                    }
                    return;
                }
                
                // Update section name in config
                const found = findSectionInAllGroups(currentConfig, sectionId);
                if (found?.section && found.section.name !== newName) {
                    found.section.name = newName;
                    await saveConfig(currentConfig);
                    showToast(`Section renamed to "${newName}"`);
                }
                return;
            }
            
            // Handle group names
            const groupNameEl = e.target.closest('.editable-group-name');
            if (groupNameEl) {
                const groupId = groupNameEl.dataset.groupId;
                const newName = groupNameEl.value.trim();
                const groupElement = dialog.querySelector(`.section-group[data-group-id="${groupId}"]`);
                const oldName = groupElement?.dataset.groupName;
                
                if (!newName) {
                    showToast('Group name cannot be empty');
                    // Restore old name
                    groupNameEl.value = oldName || 'Unnamed Group';
                    return;
                }
                
                if (oldName === newName) {
                    return; // No change
                }
                
                // Find and update group in config
                let groupFound = false;
                let foundGroup = null;
                let groupArrayType = null;
                const allGroupArrays = [
                    { groups: currentConfig.HOME_SECTION_GROUPS, type: 'HOME_SECTION_GROUPS' },
                    { groups: currentConfig.SEASONAL_SECTION_GROUPS, type: 'SEASONAL_SECTION_GROUPS' },
                    { groups: currentConfig.DISCOVERY_SECTION_GROUPS, type: 'DISCOVERY_SECTION_GROUPS' },
                    { groups: currentConfig.CUSTOM_SECTION_GROUPS, type: 'CUSTOM_SECTION_GROUPS' }
                ];
                
                for (const { groups, type } of allGroupArrays) {
                    if (!groups) continue;
                    const group = groups.find(g => {
                        const gId = `group-${g.name || 'unnamed'}-${g.author || ''}`.replace(/[^a-zA-Z0-9-]/g, '-');
                        return gId === groupId;
                    });
                    if (group) {
                        foundGroup = group;
                        groupArrayType = type;
                        groupFound = true;
                        break;
                    }
                }
                
                if (groupFound && foundGroup) {
                    // Check if this is a default group (not CUSTOM) and handle _originalName
                    if (groupArrayType !== 'CUSTOM_SECTION_GROUPS') {
                        // If _originalName is not set, check if this is a default group
                        if (!foundGroup._originalName) {
                            const defaults = window.KefinHomeConfig2;
                            if (defaults) {
                                const defaultGroups = defaults[groupArrayType] || [];
                                const isDefaultGroup = defaultGroups.some(dg => {
                                    const dgKey = dg.author ? `${dg.name}::${dg.author}` : dg.name || 'Unnamed';
                                    const currentKey = foundGroup.author ? `${oldName}::${foundGroup.author}` : oldName || 'Unnamed';
                                    return dgKey === currentKey;
                                });
                                
                                // If it's a default group, store the original name
                                if (isDefaultGroup) {
                                    foundGroup._originalName = oldName;
                                }
                            }
                        }
                        // If _originalName is already set, preserve it (don't overwrite)
                    }
                    
                    // Update the group name
                    foundGroup.name = newName;
                    
                    // Update data attribute
                    groupElement.dataset.groupName = newName;
                    await saveConfig(currentConfig);
                    showToast(`Group renamed to "${newName}"`);
                } else {
                    showToast('Could not find group to rename');
                    groupNameEl.value = oldName || 'Unnamed Group';
                }
            }
        }, true); // Use capture phase
        
        // Consolidated handler for Enter key - prevents default behavior and blurs input
        dialog.addEventListener('keydown', (e) => {
            const nameEl = e.target.closest('.editable-section-name, .editable-group-name');
            if (!nameEl) return;
            
            if (e.key === 'Enter') {
                e.preventDefault();
                nameEl.blur();
            }
        }, true);
        
        // Drag and drop handlers - use event delegation
        let draggedElement = null;
        let dropPosition = 'above'; // Store drop position for drop handler
        
        dialog.addEventListener('dragstart', (e) => {
            const row = e.target.closest('.section-row');
            if (!row) return;
            
            draggedElement = row;
            e.dataTransfer.effectAllowed = 'move';
            e.dataTransfer.setData('text/html', row.innerHTML);
            row.style.opacity = '0.5';
        });
        
        dialog.addEventListener('dragend', (e) => {
            const row = e.target.closest('.section-row');
            if (!row) return;
            
            row.style.opacity = '1';
            // Remove drag-over styling from all rows
            dialog.querySelectorAll('.section-row').forEach(r => {
                r.style.borderTop = '';
            });
        });
        
        dialog.addEventListener('dragover', (e) => {
            const row = e.target.closest('.section-row');
            if (!row) return;
            
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';
            
            // Calculate drop position based on cursor Y position relative to element center
            const rect = row.getBoundingClientRect();
            const elementCenterY = rect.top + rect.height / 2;
            dropPosition = e.clientY < elementCenterY ? 'above' : 'below';
            
            // Visual feedback: show drop indicator
            dialog.querySelectorAll('.section-row').forEach(r => {
                r.style.borderTop = '';
            });
            
            // Show indicator on the target row based on drop position
            row.style.borderTop = '2px solid var(--theme-primary-color, #00a4dc)';
        });
        
        dialog.addEventListener('drop', async (e) => {
            const row = e.target.closest('.section-row');
            if (!row) return;
            e.preventDefault();
            
            if (!draggedElement || draggedElement === row) return;
            
            const sectionType = row.dataset.sectionType;
            const draggedSectionId = draggedElement.dataset.sectionId;
            const draggedSectionType = draggedElement.dataset.sectionType;
            
            // Check if we're on the Order Sections tab
            const isOrderTab = currentActiveTab === 'order';
            
            // If on sections tab, restrict dragging within same group
            if (!isOrderTab) {
                // Find which group the dragged section belongs to
                const draggedFound = findSectionInAllGroups(currentConfig, draggedSectionId);
                const targetFound = findSectionInAllGroups(currentConfig, row.dataset.sectionId);
                
                // Only allow drop if both sections are in the same group
                if (!draggedFound || !targetFound || draggedFound.group !== targetFound.group) {
                    return;
                }
            }
            
            // Calculate new order using DOM elements
            const newOrder = calculateNewOrder(draggedElement, row, dropPosition);
            
            // Update order in config - find section across all groups
            const found = findSectionInAllGroups(currentConfig, draggedSectionId);
            if (found) {
                found.section.order = newOrder;
                // Sort sections within the group by order
                found.group.sections.sort((a, b) => (a.order || 0) - (b.order || 0));
            }
            
            await saveConfig(currentConfig);
            
            // Update section position in place instead of refreshing entire modal
            // This preserves scroll position
            let container = e.target.closest('.group-sections-list');
            
            if (container) {
                updateSectionPositionInPlace(draggedElement, container);
            } else {
                // Fallback to refresh if container not found
                refreshMainModal();
            }
        });
        
        // Unified toggle slider click handler - handles both section toggles and settings toggles
        dialog.addEventListener('click', async (e) => {
            // Check if click is on toggle slider button or its children
            const btn = e.target.closest('.toggle-slider');
            if (!btn) return;
            
            // Stop propagation to prevent section row click handler from firing
            e.stopPropagation();
            
            // Check if this is a section toggle (has data-section-id)
            const sectionId = btn.dataset.sectionId;
            if (sectionId) {
                // Section toggle: update section config and save
                const sectionType = btn.dataset.sectionType;
                const found = findSectionInAllGroups(currentConfig, sectionId);
                const section = found?.section;
                
                if (section) {
                    section.enabled = !section.enabled;
                    await saveConfig(currentConfig);
                    
                    // Update the toggle switch UI
                    updateToggleSliderUI(btn, section.enabled);
                }
            } else {
                // Settings toggle: toggle hidden checkbox and update UI
                const checkboxId = btn.dataset.checkboxId;
                if (checkboxId) {
                    const checkbox = document.getElementById(checkboxId);
                    if (checkbox) {
                        checkbox.checked = !checkbox.checked;
                        checkbox.dispatchEvent(new Event('change', { bubbles: true }));
                        updateToggleSliderUI(btn, checkbox.checked);
                    }
                } else {
                    // Fallback: just toggle the visual state
                    const currentState = btn.dataset.enabled === 'true';
                    updateToggleSliderUI(btn, !currentState);
                }
            }
        });
        
        // Group toggle-all buttons - use event delegation
        dialog.addEventListener('click', async (e) => {
            const btn = e.target.closest('.group-toggle-all-btn');
            if (!btn) return;
            e.stopPropagation();
            const groupId = btn.dataset.groupId;
            const currentEnabled = btn.dataset.enabled === 'true';
            const newEnabled = !currentEnabled;
            
            const groupElement = dialog.querySelector(`.section-group[data-group-id="${groupId}"]`);
            if (!groupElement) return;
            
            const sectionsList = groupElement.querySelector('.group-sections-list');
            if (!sectionsList) return;
            
            // Find all sections in this group and update them
            const sectionRows = sectionsList.querySelectorAll('.section-row');
            const sectionIds = Array.from(sectionRows).map(row => row.dataset.sectionId);
            
            // Update all sections in the group
            sectionIds.forEach(sectionId => {
                const found = findSectionInAllGroups(currentConfig, sectionId);
                if (found && found.section) {
                    found.section.enabled = newEnabled;
                }
            });
            
            await saveConfig(currentConfig);
            
            // Update UI
            btn.dataset.enabled = newEnabled;
            btn.querySelector('span').textContent = newEnabled ? 'Disable All' : 'Enable All';
            
                // Update all toggle switches in the group
                sectionRows.forEach(row => {
                    const toggleBtn = row.querySelector('.toggle-slider');
                    if (toggleBtn) {
                        updateToggleSliderUI(toggleBtn, newEnabled);
                    }
                });
        });
        
        // Preview section buttons - use event delegation
        dialog.addEventListener('click', async (e) => {
            const btn = e.target.closest('.section-preview-btn');
            if (!btn) return;
            e.stopPropagation();
            const sectionId = btn.dataset.sectionId;
            const sectionType = btn.dataset.sectionType;
            
            // Find section across all groups
            const found = findSectionInAllGroups(currentConfig, sectionId);
            const section = found?.section;

            if (section) {
                await previewSection(section, sectionType, btn);
            }
        });
        
        // Click on section row to edit - use event delegation
        dialog.addEventListener('click', (e) => {
            const row = e.target.closest('.section-row');
            if (!row) return;
            
            // Don't trigger if clicking on delete button, toggle switch, preview button, or editable name
            if (e.target.closest('.section-delete-btn') || 
                e.target.closest('.toggle-slider') || 
                e.target.closest('.section-preview-btn') ||
                e.target.closest('.editable-section-name')) {
                return;
            }
            
            const sectionId = row.dataset.sectionId;
            const sectionType = row.dataset.sectionType;
            
            // Find section across all groups
            const found = findSectionInAllGroups(currentConfig, sectionId);
            const section = found?.section;

            if (section) {
                openSectionEditor(section, sectionType);
            }
        });
        
        // Delete custom section buttons - use event delegation
        dialog.addEventListener('click', async (e) => {
            const btn = e.target.closest('.section-delete-btn');
            if (!btn) return;
            e.stopPropagation();
            const sectionId = btn.dataset.sectionId;
            const groups = currentConfig.CUSTOM_SECTION_GROUPS || [];
            const found = findSectionInGroups(groups, sectionId);
            const sectionName = found?.section?.name || sectionId;
            if (confirm(`Delete section "${sectionName}"?`)) {
                removeSectionFromGroups(groups, sectionId);
                await saveConfig(currentConfig);
                showToast(`Section "${sectionName}" deleted`);
                refreshMainModal();
            }
        });
    }

    /**
     * Setup community collections grid (Import / Export tab).
     * Selecting a collection opens a secondary import modal.
     */
    function setupCommunityCollectionsTab(dialog) {
        const host = dialog.querySelector('#communityCollectionsHost')
            || dialog.querySelector('#tab-import-export');
        let collectionsGrid = dialog.querySelector('#communityCollectionsGrid');

        if (!host) {
            return;
        }

        if (!window.KefinCommunityConfig) {
            host.innerHTML = '<div class="listItemBodyText" style="color: #f44336;">Community configuration not loaded. Please ensure homeScreenConfig-community.js is loaded.</div>';
            return;
        }

        const communityCollections = window.KefinCommunityConfig.collections || [];

        if (communityCollections.length === 0) {
            host.innerHTML = '<div class="listItemBodyText">No community collections available.</div>';
            return;
        }

        if (!collectionsGrid) {
            host.innerHTML = '<div id="communityCollectionsGrid"></div>';
            collectionsGrid = dialog.querySelector('#communityCollectionsGrid');
        }
        if (!collectionsGrid) return;

        collectionsGrid.innerHTML = communityCollections.map((collection, index) => {
            return `
                <div class="community-collection-card" data-collection-index="${index}" style="
                    background: rgba(255,255,255,0.05);
                    border: 2px solid rgba(255,255,255,0.1);
                    border-radius: 8px;
                    padding: 1em;
                    cursor: pointer;
                    transition: all 0.2s ease;
                    position: relative;
                ">
                    <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 0.5em;">
                        <div style="flex: 1;">
                            <div class="listItemBodyText" style="font-weight: 500; margin-bottom: 0.25em;">${collection.name || 'Unnamed Collection'}</div>
                            <div class="listItemBodyText secondary" style="font-size: 0.85em; color: rgba(255,255,255,0.6);">by ${collection.author || 'Anonymous'}</div>
                        </div>
                        <button type="button" class="community-collection-info-btn" data-collection-index="${index}" style="
                            background: rgba(255,255,255,0.1);
                            border: 1px solid rgba(255,255,255,0.2);
                            border-radius: 4px;
                            padding: 0.25em 0.5em;
                            color: rgba(255,255,255,0.87);
                            cursor: pointer;
                            font-size: 0.85em;
                            display: flex;
                            align-items: center;
                            gap: 0.25em;
                        " title="View description">
                            <span class="material-icons" style="font-size: 1.1em;">info</span>
                        </button>
                    </div>
                    <div class="listItemBodyText secondary" style="font-size: 0.8em; color: rgba(255,255,255,0.5);">
                        ${collection.sections ? collection.sections.length : 0} section${collection.sections && collection.sections.length !== 1 ? 's' : ''}
                    </div>
                </div>
            `;
        }).join('');

        collectionsGrid.querySelectorAll('.community-collection-card').forEach((card, index) => {
            card.addEventListener('click', (e) => {
                if (e.target.closest('.community-collection-info-btn')) {
                    return;
                }
                openCommunityImportModal(communityCollections[index]);
            });
        });

        collectionsGrid.querySelectorAll('.community-collection-info-btn').forEach((btn, index) => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const collection = communityCollections[index];
                const description = collection.description || 'No description available.';
                showInfoPopover(btn, description, collection.name || 'Collection');
            });
        });
    }

    /**
     * Open secondary modal to pick sections from a community collection and import them.
     */
    function openCommunityImportModal(collection) {
        if (!collection) return;
        if (!window.ModalSystem?.create) {
            showToast('Modal system not available');
            return;
        }

        const content = document.createElement('div');
        content.innerHTML = `
            <div class="listItemBodyText secondary" style="margin-bottom: 1em;">Select sections to import from this collection.</div>
            <div id="communitySectionsContainer">
                <div id="communitySectionsList"></div>
            </div>
            <div id="communitySectionsEmpty" class="listItemBodyText secondary" style="display: none; padding: 1em; text-align: center;"></div>
        `;

        const footer = document.createElement('div');
        footer.style.display = 'flex';
        footer.style.gap = '0.5em';
        footer.style.justifyContent = 'flex-end';
        footer.innerHTML = `
            <button type="button" class="emby-button raised" id="community-import-cancel">Cancel</button>
            <button type="button" class="emby-button raised block button-submit" id="confirmCommunityImportBtn">Import Selected</button>
        `;

        window.ModalSystem.create({
            id: COMMUNITY_IMPORT_MODAL_ID,
            title: collection.name || 'Import Collection',
            content,
            footer,
            closeOnBackdrop: true,
            closeOnEscape: true,
            showCloseButton: true,
            fixedSize: true,
            onOpen: (modal) => {
                const dialog = modal.dialogContent || content;
                const sectionsList = dialog.querySelector('#communitySectionsList');
                const sectionsContainer = dialog.querySelector('#communitySectionsContainer');
                const sectionsEmpty = dialog.querySelector('#communitySectionsEmpty');
                const confirmBtn = modal.dialogFooter?.querySelector('#confirmCommunityImportBtn')
                    || dialog.querySelector('#confirmCommunityImportBtn');

                renderSectionsList(collection, sectionsList, sectionsContainer, sectionsEmpty, confirmBtn);

                modal.dialogFooter?.querySelector('#community-import-cancel')?.addEventListener('click', () => {
                    window.ModalSystem.close(COMMUNITY_IMPORT_MODAL_ID);
                });

                confirmBtn?.addEventListener('click', async () => {
                    const selectedIndices = Array.from(dialog.querySelectorAll('.import-community-check:checked'))
                        .map(c => parseInt(c.dataset.index, 10));

                    if (selectedIndices.length === 0) {
                        showToast('Please select at least one section to import.');
                        return;
                    }

                    if (!currentConfig.CUSTOM_SECTION_GROUPS) currentConfig.CUSTOM_SECTION_GROUPS = [];

                    const selectedSections = selectedIndices.map(i => {
                        const section = JSON.parse(JSON.stringify(collection.sections[i]));
                        return convertToHomeScreenSection(section);
                    });

                    const importedGroup = {
                        name: collection.name || 'Imported Collection',
                        author: collection.author,
                        description: collection.description,
                        sections: selectedSections.map(section => {
                            if (section.id && sectionIdExists(currentConfig, section.id)) {
                                section.id = `${section.id}_community_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
                            }
                            return section;
                        })
                    };

                    currentConfig.CUSTOM_SECTION_GROUPS.push(importedGroup);
                    const importedCount = selectedSections.length;

                    if (importedCount > 0) {
                        confirmBtn.disabled = true;
                        try {
                            await saveConfig(currentConfig);
                            window.ModalSystem.close(COMMUNITY_IMPORT_MODAL_ID);
                            showToast(`Successfully imported ${importedCount} sections. Refreshing...`);
                            refreshMainModal();
                        } catch (e) {
                            ERR('Error importing community sections:', e);
                            showToast('Error importing sections');
                            confirmBtn.disabled = false;
                        }
                    }
                });
            }
        });
    }

    /**
     * Render sections list for selected collection
     */
    function renderSectionsList(collection, sectionsList, sectionsContainer, sectionsEmpty, confirmBtn) {
        if (!sectionsList) return;

        if (!collection || !collection.sections || collection.sections.length === 0) {
            sectionsList.innerHTML = '<div class="listItemBodyText secondary">No sections found in this collection.</div>';
            if (sectionsContainer) sectionsContainer.style.display = 'block';
            if (sectionsEmpty) sectionsEmpty.style.display = 'none';
            if (confirmBtn) confirmBtn.style.display = 'none';
            return;
        }

        sectionsList.innerHTML = `
            <div style="background: rgba(0,0,0,0.2); border-radius: 4px; padding: 0.5em;">
                ${collection.sections.map((s, i) => `
                    <label class="checkboxContainer" style="display: flex; align-items: center; padding: 0.5em; margin-bottom: 0.25em;">
                        <input type="checkbox" class="import-community-check" data-index="${i}" checked>
                        <span class="listItemBodyText" style="margin-left: 0.5em;">${s.name || 'Unnamed'}</span>
                    </label>
                `).join('')}
            </div>
        `;

        if (sectionsContainer) sectionsContainer.style.display = 'block';
        if (sectionsEmpty) sectionsEmpty.style.display = 'none';
        if (confirmBtn) confirmBtn.style.display = 'inline-block';
    }

    /**
     * Show info popover for collection description
     */
    function showInfoPopover(triggerElement, description, title) {
        // Remove any existing popover
        const existingPopover = document.querySelector('.community-info-popover');
        if (existingPopover) {
            existingPopover.remove();
        }

        // Create popover element
        const popover = document.createElement('div');
        popover.className = 'community-info-popover';
        popover.style.cssText = `
            position: absolute;
            background: rgba(26,26,26,0.98);
            border: 1px solid rgba(255,255,255,0.2);
            border-radius: 8px;
            padding: 1em;
            box-shadow: 0 4px 16px rgba(0,0,0,0.4);
            z-index: 10000;
            max-width: 400px;
            min-width: 250px;
        `;
        popover.innerHTML = `
            <div class="listItemBodyText" style="font-weight: 500; margin-bottom: 0.5em;">${title}</div>
            <div class="listItemBodyText secondary" style="line-height: 1.5;">${description}</div>
            <button type="button" class="community-popover-close" style="
                position: absolute;
                top: 0.5em;
                right: 0.5em;
                background: none;
                border: none;
                color: rgba(255,255,255,0.7);
                cursor: pointer;
                padding: 0.25em;
                display: flex;
                align-items: center;
            " title="Close">
                <span class="material-icons" style="font-size: 1.2em;">close</span>
            </button>
        `;

        // Position popover relative to trigger
        const rect = triggerElement.getBoundingClientRect();
        const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
        const scrollLeft = window.pageXOffset || document.documentElement.scrollLeft;
        
        popover.style.top = `${rect.bottom + scrollTop + 8}px`;
        popover.style.left = `${rect.left + scrollLeft}px`;

        // Add close button handler
        popover.querySelector('.community-popover-close').addEventListener('click', () => {
            popover.remove();
        });

        // Close on outside click
        const closeOnOutsideClick = (e) => {
            if (!popover.contains(e.target) && e.target !== triggerElement) {
                popover.remove();
                document.removeEventListener('click', closeOnOutsideClick);
            }
        };
        setTimeout(() => {
            document.addEventListener('click', closeOnOutsideClick);
        }, 0);

        document.body.appendChild(popover);
    }

    /**
     * Convert legacy section format to HomeScreenSection format
     */
    function convertToHomeScreenSection(section) {
        // If already in new format, return as-is
        if (section.queries && Array.isArray(section.queries)) {
            return section;
        }

        // Convert legacy format
        const newSection = {
            id: section.id,
            name: section.name,
            enabled: section.enabled !== false,
            order: section.order || 100,
            cardFormat: section.cardFormat || 'Poster',
            itemLimit: section.itemLimit || 20,
            queries: []
        };

        // Build query from legacy fields
        const query = {
            queryOptions: {}
        };

        if (section.path) {
            query.path = section.path;
        }
        if (section.dataSource) {
            query.dataSource = section.dataSource;
        }

        // Copy all other fields to queryOptions
        Object.keys(section).forEach(key => {
            if (!['id', 'name', 'enabled', 'order', 'cardFormat', 'itemLimit', 'path', 'dataSource', 'queries', 'type'].includes(key)) {
                query.queryOptions[key] = section[key];
            }
        });

        newSection.queries.push(query);
        return newSection;
    }

    /**
     * Check if section ID exists in config
     */
    function sectionIdExists(config, sectionId) {
        const allHomeSections = flattenSectionGroups(config.HOME_SECTION_GROUPS || []);
        const allSeasonalSections = flattenSectionGroups(config.SEASONAL_SECTION_GROUPS || []);
        const allDiscoverySections = flattenSectionGroups(config.DISCOVERY_SECTION_GROUPS || []);
        const allCustomSections = flattenSectionGroups(config.CUSTOM_SECTION_GROUPS || []);
        const allIds = [
            ...allHomeSections.map(s => s.id),
            ...allSeasonalSections.map(s => s.id),
            ...allDiscoverySections.map(s => s.id),
            ...allCustomSections.map(s => s.id)
        ];
        return allIds.includes(sectionId);
    }

    /**
     * Show community import dialog
     */
    async function showCommunityImportDialog() {
        // Ensure community config is available
        if (!window.KefinCommunityConfig) {
            showToast('Community configuration not loaded. Please ensure homeScreenConfig-community.js is loaded.');
            return;
        }

        const communityCollections = window.KefinCommunityConfig.collections || [];
        
        if (communityCollections.length === 0) {
            showToast('No community collections available.');
            return;
        }

        const content = document.createElement('div');
        content.innerHTML = `
            <div class="content-primary">
                <div class="listItemBodyText" style="margin-bottom: 1em;">Select Home Screen Sections to import:</div>
                <div class="listItemBodyText" style="margin-bottom: 1em;">These sections are created and submitted by community members like you!</div>
                <div class="listItemBodyText secondary" style="margin-bottom: 1.5em;">Submit your own Home Screen Sections <a href="https://github.com/ranaldsgift/KefinTweaks/discussions/64" target="_blank" class="button-link">here.</a></div>
                
                <div style="margin-bottom: 1.5em;">
                    <select id="communityCollectionSelect" class="emby-select-withcolor emby-select" style="width: 100%; padding: 0.5em; background: rgba(255,255,255,0.1); color: inherit; border: 1px solid rgba(255,255,255,0.1); border-radius: 4px;">
                        <option value="">Select a collection...</option>
                        ${communityCollections.map((c, i) => `<option value="${i}">${c.name} by ${c.author}</option>`).join('')}
                    </select>
                </div>
                
                <div id="collectionDescription" style="margin-bottom: 1.5em; font-style: italic; color: #ccc; display: none; padding: 1em; background: rgba(0,0,0,0.2); border-radius: 4px;"></div>

                <div id="importSelectionContainer" style="display: none; border-top: 1px solid rgba(255,255,255,0.1); padding-top: 1em;">
                    <div class="listItemBodyText" style="margin-bottom: 1em; font-weight: bold;">Sections in this collection:</div>
                    <div id="importSelectionList"></div>
                </div>
            </div>
        `;

        const footer = document.createElement('div');
        footer.style.display = 'flex';
        footer.style.gap = '0.75em';
        footer.innerHTML = `
            <button class="emby-button raised block button-submit" id="confirmCommunityImportBtn" style="padding: 0.75em 2em; display: none;">Import Selected</button>
            <button class="emby-button raised" onclick="window.ModalSystem.close('kefinCommunityImportModal')">Cancel</button>
        `;

        let selectedCollection = null;

        window.ModalSystem.create({
            id: 'kefinCommunityImportModal',
            title: 'Import Community Sections',
            content: content,
            footer: footer,
            closeOnBackdrop: false,
            closeOnEscape: true,
            onOpen: (modalInstance) => {
                const select = content.querySelector('#communityCollectionSelect');
                const descContainer = content.querySelector('#collectionDescription');
                const selectionContainer = content.querySelector('#importSelectionContainer');
                const selectionList = content.querySelector('#importSelectionList');
                const confirmBtn = modalInstance.dialogFooter.querySelector('#confirmCommunityImportBtn');

                select.addEventListener('change', () => {
                    const index = select.value;
                    if (index === '') {
                        selectedCollection = null;
                        descContainer.style.display = 'none';
                        selectionContainer.style.display = 'none';
                        confirmBtn.style.display = 'none';
                        return;
                    }

                    selectedCollection = communityCollections[parseInt(index)];
                    
                    // Show description
                    descContainer.textContent = selectedCollection.description || 'No description.';
                    descContainer.style.display = 'block';

                    // Render sections list
                    let html = '';
                    if (selectedCollection.sections && selectedCollection.sections.length > 0) {
                        html += `
                            <div style="background: rgba(0,0,0,0.2); border-radius: 4px; padding: 0.5em;">
                                ${selectedCollection.sections.map((s, i) => `
                                    <label class="checkboxContainer" style="display: flex; align-items: center; padding: 0.5em;">
                                        <input type="checkbox" class="import-community-check" data-index="${i}" checked>
                                        <span class="listItemBodyText" style="margin-left: 0.5em;">${s.name || 'Unnamed'}</span>
                                    </label>
                                `).join('')}
                            </div>`;
                    } else {
                        html = '<div class="listItemBodyText secondary">No sections found in this collection.</div>';
                    }

                    selectionList.innerHTML = html;
                    selectionContainer.style.display = 'block';
                    confirmBtn.style.display = 'inline-block';
                });

                confirmBtn.addEventListener('click', async () => {
                    if (!selectedCollection) return;

                    const selectedIndices = Array.from(content.querySelectorAll('.import-community-check:checked')).map(c => parseInt(c.dataset.index));
                    
                    if (selectedIndices.length === 0) {
                        showToast('Please select at least one section to import.');
                        return;
                    }

                    // Import logic - import entire groups to CUSTOM_SECTION_GROUPS
                    if (!currentConfig.CUSTOM_SECTION_GROUPS) currentConfig.CUSTOM_SECTION_GROUPS = [];
                    
                    const selectedSections = selectedIndices.map(i => {
                        const section = JSON.parse(JSON.stringify(selectedCollection.sections[i])); // Deep copy
                        return convertToHomeScreenSection(section);
                    });
                    
                    // Create a group from the collection
                    const importedGroup = {
                        name: selectedCollection.name || 'Imported Collection',
                        author: selectedCollection.author,
                        description: selectedCollection.description,
                        sections: selectedSections.map(section => {
                            // Check for ID collision - only regenerate if needed
                            if (section.id && sectionIdExists(currentConfig, section.id)) {
                                section.id = `${section.id}_community_${Date.now()}_${Math.floor(Math.random()*1000)}`;
                            }
                            return section;
                        })
                    };
                    
                    currentConfig.CUSTOM_SECTION_GROUPS.push(importedGroup);
                    const importedCount = selectedSections.length;

                    if (importedCount > 0) {
                        await saveConfig(currentConfig);
                        showToast(`Successfully imported ${importedCount} sections. Refreshing...`);
                        refreshMainModal();
                        window.ModalSystem.close('kefinCommunityImportModal');
                    } else {
                        window.ModalSystem.close('kefinCommunityImportModal');
                    }
                });
            }
        });
    }

    /**
     * Show export dialog
     */
    async function showExportDialog() {
        const sectionGroups = currentConfig.CUSTOM_SECTION_GROUPS || [];
        
        if (sectionGroups.length === 0 || !sectionGroups.some(g => g.sections && g.sections.length > 0)) {
            alert('No custom sections found to export.');
            return;
        }

        const content = document.createElement('div');
        content.innerHTML = `
            <div class="content-primary">                
                <div style="margin-bottom: 1.5em;">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5em;">
                        <button type="button" class="emby-button raised" onclick="this.closest('.content-primary').querySelectorAll('.export-custom-check').forEach(c => c.checked = true)" style="font-size: 0.9em;">Select All</button>
                        <button type="button" class="emby-button raised" onclick="this.closest('.content-primary').querySelectorAll('.export-custom-check').forEach(c => c.checked = false)" style="font-size: 0.9em;">Deselect All</button>
                    </div>
                    <div id="exportSectionGroupsList"></div>
                </div>
                
                <div id="exportOutputContainer" style="display: none; margin-top: 1.5em;">
                    <div class="listItemBodyText" style="margin-bottom: 0.5em;">Export JSON:</div>
                    <textarea id="exportOutput" class="fld emby-textarea" readonly style="width: 100%; height: 200px; font-family: monospace;"></textarea>
                    <div style="display: flex; gap: 1em; margin-top: 0.5em;">
                        <button type="button" class="emby-button raised" id="copyExportBtn">Copy to Clipboard</button>
                        <button type="button" class="emby-button raised" id="downloadExportBtn">Download .json</button>
                    </div>
                </div>
            </div>
        `;

        const footer = document.createElement('div');
        footer.style.display = 'flex';
        footer.style.gap = '0.75em';
        footer.innerHTML = `
            <button class="emby-button raised hide" onclick="window.ModalSystem.close('kefinExportModal')">Close</button>
            <button class="emby-button raised block button-submit" id="generateExportBtn" style="padding: 0.75em 2em;">Generate JSON</button>
        `;

        window.ModalSystem.create({
            id: 'kefinExportModal',
            title: 'Export Custom Sections',
            content: content,
            footer: footer,
            closeOnBackdrop: true,
            closeOnEscape: true,
            onOpen: (modalInstance) => {
                const sectionGroupsList = content.querySelector('#exportSectionGroupsList');
                renderSectionGroupsCheckboxList(sectionGroupsList, sectionGroups, {
                    checkboxClass: 'export-custom-check',
                    groupCheckboxClass: 'export-custom-group-check'
                });

                const generateBtn = modalInstance.dialogFooter.querySelector('#generateExportBtn');
                generateBtn.addEventListener('click', () => {
                    // Collect selected sections by group
                    const selectedGroups = [];
                    
                    sectionGroups.forEach((group, groupIndex) => {
                        if (!group || !Array.isArray(group.sections)) return;
                        
                        const selectedSections = [];
                        group.sections.forEach((section, sectionIndex) => {
                            const checkbox = content.querySelector(`.export-custom-check[data-group-index="${groupIndex}"][data-section-index="${sectionIndex}"]`);
                            if (checkbox && checkbox.checked) {
                                selectedSections.push(section);
                            }
                        });

                        // Only include groups that have at least one section selected
                        if (selectedSections.length > 0) {
                            selectedGroups.push({
                                name: group.name,
                                author: group.author,
                                description: group.description,
                                sections: selectedSections
                            });
                        }
                    });
                    
                    if (selectedGroups.length === 0) {
                        alert('Please select at least one section to export.');
                        return;
                    }

                    // Export as array of section groups
                    const json = JSON.stringify(selectedGroups, null, 2);
                    const outputContainer = content.querySelector('#exportOutputContainer');
                    const output = content.querySelector('#exportOutput');
                    
                    output.value = json;
                    outputContainer.style.display = 'block';
                    generateBtn.style.display = 'none';
                    
                    content.querySelector('#copyExportBtn').addEventListener('click', () => {
                        output.select();
                        document.execCommand('copy');
                        if (window.KefinTweaksToaster && window.KefinTweaksToaster.toast) {
                            window.KefinTweaksToaster.toast('Copied to clipboard');
                        } else {
                            alert('Copied to clipboard');
                        }
                    });
                    
                    content.querySelector('#downloadExportBtn').addEventListener('click', () => {
                        const blob = new Blob([json], { type: 'application/json' });
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.href = url;
                        a.download = `kefin-tweaks-export-${new Date().toISOString().slice(0,10)}.json`;
                        document.body.appendChild(a);
                        a.click();
                        document.body.removeChild(a);
                        URL.revokeObjectURL(url);
                    });
                });
            }
        });
    }

    /**
     * Show import dialog
     */
    async function showImportDialog() {
        const content = document.createElement('div');
        content.innerHTML = `
            <div class="content-primary">
                <div class="listItemBodyText" style="margin-bottom: 1em;">Paste JSON content or a URL (Raw GitHub, Gist, Pastebin):</div>
                <textarea id="importInput" class="fld emby-textarea" style="width: 100%; height: 150px; font-family: monospace;" placeholder='[{ "name": "...", "sections": [...] }, ...] or { "sectionGroups": [...] } or https://...'></textarea>
                
                <div id="importSelectionContainer" style="display: none; margin-top: 1.5em; border-top: 1px solid rgba(255,255,255,0.1); padding-top: 1em;">
                    <div class="listItemBodyText" style="margin-bottom: 1em; font-weight: bold;">Found items to import:</div>
                    <div id="importSelectionList"></div>
                </div>
            </div>
        `;

        const footer = document.createElement('div');
        footer.style.display = 'flex';
        footer.style.gap = '0.75em';
        footer.innerHTML = `
            <button class="emby-button raised" onclick="window.ModalSystem.close('kefinImportModal')">Close</button>
            <button class="emby-button raised block button-submit" id="loadImportBtn" style="padding: 0.75em 2em;">Load</button>
            <button class="emby-button raised block button-submit" id="confirmImportBtn" style="padding: 0.75em 2em; display: none;">Import Selected</button>
        `;

        let parsedData = null;
        let sectionGroups = null;

        window.ModalSystem.create({
            id: 'kefinImportModal',
            title: 'Import Custom Sections',
            content: content,
            footer: footer,
            closeOnBackdrop: false,
            closeOnEscape: true,
            onOpen: (modalInstance) => {
                const loadBtn = modalInstance.dialogFooter.querySelector('#loadImportBtn');
                const confirmBtn = modalInstance.dialogFooter.querySelector('#confirmImportBtn');
                const input = content.querySelector('#importInput');
                const selectionContainer = content.querySelector('#importSelectionContainer');
                const selectionList = content.querySelector('#importSelectionList');

                loadBtn.addEventListener('click', async () => {
                    const rawInput = input.value.trim();
                    if (!rawInput) return;

                    loadBtn.disabled = true;
                    loadBtn.textContent = 'Loading...';

                    try {
                        let jsonStr = rawInput;
                        // Check if URL
                        if (rawInput.startsWith('http://') || rawInput.startsWith('https://')) {
                            const res = await fetch(rawInput);
                            if (!res.ok) throw new Error(`Failed to fetch URL: ${res.status}`);
                            jsonStr = await res.text();
                        }

                        parsedData = JSON.parse(jsonStr);
                        
                        // Accept array of section groups or object with sectionGroups property
                        if (Array.isArray(parsedData)) {
                            sectionGroups = parsedData;
                        } else if (parsedData.sectionGroups && Array.isArray(parsedData.sectionGroups)) {
                            sectionGroups = parsedData.sectionGroups;
                        } else {
                            throw new Error('Invalid format: Expected array of section groups or object with sectionGroups property.');
                        }

                        if (!sectionGroups || sectionGroups.length === 0) {
                            throw new Error('No section groups found.');
                        }

                        // Render selection using shared helper
                        renderSectionGroupsCheckboxList(selectionList, sectionGroups, {
                            checkboxClass: 'import-custom-check',
                            groupCheckboxClass: 'import-custom-group-check'
                        });

                        selectionContainer.style.display = 'block';
                        confirmBtn.style.display = 'inline-block';
                    } catch (error) {
                        showToast(`Error loading data: ${error.message}`);
                    } finally {
                        loadBtn.disabled = false;
                        loadBtn.textContent = 'Load';
                    }
                });

                confirmBtn.addEventListener('click', async () => {
                    if (!sectionGroups || sectionGroups.length === 0) return;

                    // Collect selected sections by group
                    const groupsToImport = [];
                    
                    sectionGroups.forEach((group, groupIndex) => {
                        if (!group || !Array.isArray(group.sections)) return;
                        
                        const selectedSections = [];
                        group.sections.forEach((section, sectionIndex) => {
                            const checkbox = content.querySelector(`.import-custom-check[data-group-index="${groupIndex}"][data-section-index="${sectionIndex}"]`);
                            if (checkbox && checkbox.checked) {
                                const sectionCopy = JSON.parse(JSON.stringify(section)); // Deep copy
                                const convertedSection = convertToHomeScreenSection(sectionCopy);
                                
                                // Check for ID collision
                                if (convertedSection.id && sectionIdExists(currentConfig, convertedSection.id)) {
                                    convertedSection.id = `${convertedSection.id}_imported_${Date.now()}_${Math.floor(Math.random()*1000)}`;
                                }
                                
                                selectedSections.push(convertedSection);
                            }
                        });

                        // Only include groups that have at least one section selected
                        if (selectedSections.length > 0) {
                            groupsToImport.push({
                                name: group.name,
                                author: group.author,
                                description: group.description,
                                sections: selectedSections
                            });
                        }
                    });
                    
                    if (groupsToImport.length === 0) {
                        showToast('Please select at least one section to import.');
                        return;
                    }

                    if (!currentConfig.CUSTOM_SECTION_GROUPS) currentConfig.CUSTOM_SECTION_GROUPS = [];
                    
                    // Append groups to CUSTOM_SECTION_GROUPS
                    groupsToImport.forEach(group => {
                        currentConfig.CUSTOM_SECTION_GROUPS.push(group);
                    });
                    
                    const importedCount = groupsToImport.reduce((sum, g) => sum + g.sections.length, 0);

                    if (importedCount > 0) {
                        await saveConfig(currentConfig);
                        showToast(`Successfully imported ${importedCount} sections in ${groupsToImport.length} group${groupsToImport.length !== 1 ? 's' : ''}. Refreshing...`);
                        refreshMainModal();
                        window.ModalSystem.close('kefinImportModal');
                    } else {
                        window.ModalSystem.close('kefinImportModal');
                    }
                });
            }
        });

        // Community Collections tab setup
        setupCommunityCollectionsTab(dialog);

        // Export Sections button
        const exportSectionsBtn = dialog.querySelector('.export-sections-btn');
        if (exportSectionsBtn) {
            exportSectionsBtn.addEventListener('click', () => {
                showExportDialog();
            });
        }

        // Import Sections button
        const importSectionsBtn = dialog.querySelector('.import-sections-btn');
        if (importSectionsBtn) {
            importSectionsBtn.addEventListener('click', () => {
                showImportDialog();
            });
        }
    }

    /**
     * Open main configuration modal
     */
    async function openConfigModal() {
        try {
            // Load config
            const config = loadConfig();

            const { hasChanges } = await verifyLibrarySectionsConfig(config);
            if (hasChanges) {
                await saveConfig(config);
            }

            // Build content
            const content = document.createElement('div');
            content.innerHTML = buildMainConfigHTML();

            // Build footer
            const footer = document.createElement('div');
            footer.style.display = 'flex';
            footer.style.gap = '0.75em';
            footer.style.justifyContent = 'flex-end';

            footer.innerHTML = `
                <button class="emby-button raised" onclick="window.ModalSystem.close('${MAIN_MODAL_ID}')">Close</button>
            `;

            /* footer.innerHTML = `
                <button class="emby-button raised" onclick="window.ModalSystem.close('${MAIN_MODAL_ID}')">Close</button>
                <button class="emby-button raised" id="update-all-btn" title="Save and apply these settings to all users.">Update</button>
                <button class="emby-button raised block button-submit" id="save-all-btn" title="Save and apply these settings to new users only.">OK</button>
            `; */

            // Create modal
            mainModalInstance = window.ModalSystem.create({
                id: MAIN_MODAL_ID,
                title: 'Home Screen Configuration',
                content: content,
                footer: footer,
                closeOnBackdrop: true,
                closeOnEscape: true,
                showCloseButton: true,
                onOpen: (modalInstance) => {
                    // Attach tab switching
                    attachTabListeners(modalInstance);

                    // Attach event listeners
                    attachMainModalListeners(modalInstance);

                    if (normalizeActiveTab(currentActiveTab) === 'troubleshoot') {
                        initBenchmarkTab(modalInstance);
                    }

                    const saveAllBtn = modalInstance.dialogFooter.querySelector('#save-all-btn');
                    if (saveAllBtn) {
                        saveAllBtn.addEventListener('click', async () => {
                            saveAllBtn.disabled = true;
                            try {
                                await collectAndSaveConfig(modalInstance);
                                showToast('Configuration saved!');
                            } catch (e) {
                                ERR('Error saving configuration:', e);
                                showToast('Error saving configuration');
                            } finally {
                                saveAllBtn.disabled = false;
                            }
                        });
                    }

                    const updateAllBtn = modalInstance.dialogFooter.querySelector('#update-all-btn');
                    if (updateAllBtn) {
                        updateAllBtn.addEventListener('click', () => {
                            confirmAndUpdateAllUsers();
                        });
                    }
                    
                    // Populate Order Sections tab if it's the active tab
                    if (currentActiveTab === 'order') {
                        const orderContainer = modalInstance.dialogContent.querySelector('#order-sections-container');
                        if (orderContainer && orderContainer.children.length === 0) {
                            const allSections = [
                                ...flattenSectionGroups(currentConfig.HOME_SECTION_GROUPS || []).map(s => ({ ...s, sectionType: 'Default' })),
                                ...flattenSectionGroups(currentConfig.SEASONAL_SECTION_GROUPS || []).map(s => ({ ...s, sectionType: 'Seasonal' })),
                                ...flattenSectionGroups(currentConfig.CUSTOM_SECTION_GROUPS || []).map(s => ({ ...s, sectionType: 'Custom' }))
                            ];
                            orderContainer.innerHTML = renderHomeSectionsOrderEditor(allSections);
                        }
                    }
                }
            });

            if (window.innerWidth >= 900) {
                mainModalInstance.dialog.style.maxWidth = '90vw';
                mainModalInstance.dialog.style.width = '1400px';
                mainModalInstance.dialog.style.height = '90vh';
            }

            LOG('Main configuration modal opened');
        } catch (error) {
            ERR('Error opening config modal:', error);
            showToast('Error opening configuration: ' + error.message);
        }
    }

    /**
     * Fetch items for a section preview (shared by modal preview and wizard inline preview).
     * @param {Object} section
     * @param {Object} [options]
     * @param {boolean} [options.useSpotlightFields] - Request spotlight-grade Fields regardless of renderMode
     * @returns {Promise<{ items: Array, limit: number }>}
     */
    async function fetchSectionPreviewItems(section, options = {}) {
        if (!window.ApiClient || !window.apiHelper || !window.cardBuilder) {
            throw new Error('Required dependencies not available for preview');
        }

        const userId = ApiClient.getCurrentUserId();
        const serverUrl = ApiClient.serverAddress();

        if (!userId || !serverUrl) {
            throw new Error('Unable to get user ID or server URL');
        }

        const queries = section.queries || [];
        if (section.items?.length) {
            const kefinTweaksRoot = window.KefinTweaksConfig?.kefinTweaksRoot || '';
            const serverId = ApiClient.serverId();
            const normalizeTemplate = (value) => (value || '')
                .replace(/\$\{kefinTweaksRoot\}/g, kefinTweaksRoot)
                .replace(/\$\{serverId\}/g, serverId);

            const items = section.items.map((item, index) => {
                const posterUrl = normalizeTemplate(item.posterUrl);
                const thumbUrl = normalizeTemplate(item.thumbUrl);
                const squareUrl = normalizeTemplate(item.squareUrl);
                const imageUrl = normalizeTemplate(item.imageUrl);
                const cardUrl = normalizeTemplate(item.cardUrl);
                const backdropUrl = normalizeTemplate(item.backdropUrl);
                const bannerUrl = normalizeTemplate(item.bannerUrl);
                const logoUrl = normalizeTemplate(item.logoUrl);

                return {
                    Name: item.Name,
                    Id: item.Id || 'static-preview-' + (section.id || 'draft') + '-' + index,
                    Type: item.Type || 'Folder',
                    posterUrl,
                    thumbUrl,
                    squareUrl,
                    imageUrl,
                    cardUrl,
                    backdropUrl,
                    bannerUrl,
                    logoUrl,
                    CustomFooterText: item.cardFooter || undefined
                };
            });

            const processed = window.cardBuilder.postProcessItems
                ? window.cardBuilder.postProcessItems(section, items)
                : items;
            return { items: processed, limit: processed.length };
        }

        if (queries.length === 0) {
            throw new Error('Section has no queries to preview');
        }

        const useSpotlightFields = options.useSpotlightFields === true
            || section.renderMode === 'Spotlight';

        let allItems = [];
        for (const query of queries) {
            const previewQuery = withPreviewQueryOptions(query);
            let queryUrl = null;

            if (previewQuery.dataSource) {
                queryUrl = null;
            } else {
                queryUrl = window.apiHelper.buildQueryFromSection(previewQuery, userId, serverUrl, useSpotlightFields, { sectionType: section.type });
            }

            try {
                let items = [];
                if (previewQuery.dataSource) {
                    const response = await window.apiHelper.fetchFromDataSource(previewQuery.dataSource, previewQuery.queryOptions, false);
                    items = response.Items || response || [];
                } else if (queryUrl && typeof queryUrl === 'string') {
                    const result = await apiHelper.getQuery(queryUrl, { useCache: false });
                    items = result.Items || result || [];
                }
                allItems = allItems.concat(items);
            } catch (error) {
                console.error('[Preview] Error fetching query:', error);
                throw new Error(`Error fetching query: ${error.message}`);
            }
        }

        if (allItems.length === 0) {
            return { items: [], limit: 0 };
        }

        const limit = withPreviewQueryOptions(queries[0]).queryOptions.Limit
            || section.itemLimit
            || PREVIEW_DEFAULT_LIMIT;
        allItems = window.cardBuilder.postProcessItems(section, allItems);
        const limitedItems = allItems.slice(0, parseInt(limit, 10));

        return { items: limitedItems, limit: parseInt(limit, 10) };
    }

    const EDITOR_PREVIEW_SECTION_ID = 'hsae-editor-preview';

    function normalizeEditorPreviewConfig(draftSection) {
        return {
            ...draftSection,
            id: EDITOR_PREVIEW_SECTION_ID,
            enabled: true,
            order: 0,
            userConfigurable: false,
            renderMode: draftSection.renderMode || 'Normal'
        };
    }

    function buildEditorPreviewProgressiveSection(draftSection, initialItems) {
        const config = normalizeEditorPreviewConfig(draftSection);
        const items = Array.isArray(initialItems) ? initialItems : [];

        let mappedDataPromise = null;
        const ensureData = () => {
            if (!mappedDataPromise) {
                mappedDataPromise = Promise.resolve(items);
            }
            return mappedDataPromise;
        };

        const result = {
            data: items,
            isStale: false,
            isStalePromise: Promise.resolve(false),
            ensureData
        };

        Object.defineProperty(result, 'dataPromise', {
            configurable: true,
            enumerable: true,
            get() {
                return ensureData();
            }
        });

        return { config, result };
    }

    function attachEditorPreviewRefresh(containerEl, getDraftSection) {
        if (!containerEl || typeof getDraftSection !== 'function') return;

        const refreshBtn = containerEl.querySelector('.section-refresh-button');
        if (!refreshBtn) return;

        const newBtn = refreshBtn.cloneNode(true);
        refreshBtn.replaceWith(newBtn);

        newBtn.addEventListener('click', async (e) => {
            e.preventDefault();
            e.stopPropagation();

            const sectionEl = newBtn.closest('.emby-scroller-container')
                || containerEl.querySelector('.emby-scroller-container');
            if (sectionEl) sectionEl.dataset.refreshing = 'true';

            try {
                const draft = getDraftSection();
                const { items } = await fetchSectionPreviewItems(draft);
                await renderSectionPreviewInto(draft, items, containerEl, { getDraftSection });
            } catch (err) {
                console.error('[Preview] Refresh failed:', err);
                containerEl.innerHTML = `<p class="listItemBodyText secondary" style="text-align:center;padding:1.5em 0;">${err.message || 'Preview refresh failed'}</p>`;
            } finally {
                if (sectionEl) delete sectionEl.dataset.refreshing;
            }
        });
    }

    /**
     * Render section preview into a DOM container (no modal).
     * @returns {Promise<boolean>}
     */
    async function renderSectionPreviewInto(section, items, containerEl, options = {}) {
        if (!containerEl) return false;
        if (!window.cardBuilder) return false;

        if (!items || items.length === 0) {
            containerEl.innerHTML = '<p class="listItemBodyText secondary" style="text-align:center;padding:1.5em 0;">No items found for preview.</p>';
            return false;
        }

        const renderMode = section.renderMode || (section.spotlight ? 'Spotlight' : 'Normal');
        const useSpotlight = renderMode === 'Spotlight' || (renderMode === 'Random' && Math.random() < 0.5);

        if (useSpotlight && typeof window.cardBuilder.renderSpotlightSection === 'function') {
            const spotlightCfg = section.spotlightConfig || {};
            const previewElement = window.cardBuilder.renderSpotlightSection(items, section.name || 'Preview', {
                autoPlay: false,
                showDots: true,
                showNavButtons: true,
                viewMoreUrl: null,
                panAnimation: spotlightCfg.panAnimation !== false,
                spotlightLayout: spotlightCfg.spotlightLayout,
                spotlightSize: spotlightCfg.spotlightSize,
                tileCount: spotlightCfg.tileCount
            });

            if (previewElement) {
                containerEl.innerHTML = '';
                containerEl.appendChild(previewElement);
                return true;
            }

            containerEl.innerHTML = '<p class="listItemBodyText secondary" style="text-align:center;padding:1.5em 0;">Unable to render preview with the current configuration.</p>';
            return false;
        }

        if (typeof window.cardBuilder.renderProgressiveSections !== 'function') {
            containerEl.innerHTML = '<p class="listItemBodyText secondary" style="text-align:center;padding:1.5em 0;">Preview unavailable.</p>';
            return false;
        }

        containerEl.innerHTML = '';
        const progressiveSection = buildEditorPreviewProgressiveSection(section, items);
        await window.cardBuilder.renderProgressiveSections(
            containerEl,
            [Promise.resolve(progressiveSection)],
            { showStaleDataBeforeRefresh: true }
        );

        const getDraftSection = options.getDraftSection;
        if (typeof getDraftSection === 'function') {
            attachEditorPreviewRefresh(containerEl, getDraftSection);
        }

        return true;
    }

    /**
     * Preview section by fetching items and rendering them
     */
    async function previewSection(section, sectionType, btn) {
        if (!window.ApiClient || !window.apiHelper || !window.cardBuilder) {
            showToast('Required dependencies not available for preview');
            return;
        }

        Dashboard.showLoadingMsg();

        try {
            const { items } = await fetchSectionPreviewItems(section);

            if (items.length === 0) {
                showToast('No items found for preview');

                if (btn) {
                    btn.textContent = 'No Items';
                    btn.style.border = '1px solid #ff6b6b';
                    btn.style.color = '#ff6b6b';
                }
                setTimeout(() => {
                    if (btn) {
                        btn.textContent = 'Preview';
                        btn.style.border = '1px solid #ccc';
                        btn.style.color = '#ccc';
                    }
                }, 3000);
                return;
            }

            const previewModalId = 'kefin-preview-section';
            const content = document.createElement('div');
            content.style.cssText = 'padding: 1em; max-width: 1400px; width: 100%;';
            content.innerHTML = `
                <div class="listItemBodyText" style="margin-bottom: 1em;">
                    Preview: ${section.name || 'Unnamed Section'} (${items.length} item${items.length !== 1 ? 's' : ''})
                </div>
                <div id="preview-container" style="min-height: 400px;"></div>
            `;

            const footer = document.createElement('div');
            footer.innerHTML = `<button class="emby-button raised" onclick="window.ModalSystem.close('${previewModalId}')">Close</button>`;

            window.ModalSystem.create({
                id: previewModalId,
                title: 'Section Preview',
                content: content,
                footer: footer,
                size: 'large',
                closeOnBackdrop: true,
                closeOnEscape: true,
                onOpen: async (modalInstance) => {
                    const container = modalInstance.dialogContent.querySelector('#preview-container');
                    modalInstance.dialog.style.width = '1400px';
                    await renderSectionPreviewInto(section, items, container);
                }
            });

        } catch (error) {
            console.error('[Preview] Error:', error);
            showToast(`Preview error: ${error.message}`);
        } finally {
            Dashboard.hideLoadingMsg();
        }
    }

    window.KefinTweaksFeatureConfigs = window.KefinTweaksFeatureConfigs || {};
    window.KefinTweaksFeatureConfigs.homeScreen = { openConfigModal };

    // Export getConfig for use by other scripts
    window.KefinHomeScreen = window.KefinHomeScreen || {};
    window.KefinHomeScreen.getConfig = getConfig;
    window.KefinHomeScreen.getSections = getSections;
    window.KefinHomeScreen.fetchSectionPreviewItems = fetchSectionPreviewItems;
    window.KefinHomeScreen.renderSectionPreviewInto = renderSectionPreviewInto;
    window.KefinHomeScreen.buildEditorPreviewProgressiveSection = buildEditorPreviewProgressiveSection;
    window.KefinHomeScreen.canOpenSectionEditor = canOpenSectionEditor;
    window.KefinHomeScreen.openSectionEditorForId = openSectionEditorForId;
    window.KefinHomeScreen.publishSectionPresentationDefaults = publishSectionPresentationDefaults;
    window.KefinHomeScreen.findSectionInAllGroups = findSectionInAllGroups;
    window.KefinHomeScreen.ensureKefinTweaksDefaultSections = ensureKefinTweaksDefaultSections;
    window.KefinHomeScreen.collectCustomDiscoverySections = collectCustomDiscoverySections;


    LOG('Home Screen Configuration UI loaded');
    
    // Load user configuration script after this script is initialized
    function loadUserConfigurationScript() {
        try {
            const root = window.KefinTweaksConfig?.kefinTweaksRoot;
            if (!root) {
                WARN('kefinTweaksRoot not configured, cannot load user configuration script');
                return;
            }

            // Check if script is already loaded
            if (document.querySelector('script[data-kefin-user-homescreen-config]')) {
                LOG('User home screen configuration script already loaded');
                return;
            }

            const scriptUrl = `${root}configuration/homeScreen-user-configuration.js`;
            const script = document.createElement('script');
            script.src = scriptUrl;
            script.async = true;
            script.setAttribute('data-kefin-user-homescreen-config', 'true');
            
            script.onload = () => {
                LOG('User home screen configuration script loaded successfully');
            };
            
            script.onerror = (error) => {
                ERR('Failed to load user home screen configuration script:', scriptUrl, error);
            };
            
            document.head.appendChild(script);
        } catch (error) {
            ERR('Error loading user configuration script:', error);
        }
    }

    // Load user config script after a short delay to ensure this script is fully initialized
    //setTimeout(loadUserConfigurationScript, 100);

    runStartupDefaultSectionSync().catch(err => ERR('Startup default section sync failed:', err));
    
})();