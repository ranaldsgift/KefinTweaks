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
    const SECTION_EDITOR_MODAL_ID = 'kefin-homescreen-section-editor';
    const DISCOVERY_EDITOR_MODAL_ID = 'kefin-homescreen-discovery-editor';

    // Supported additional query options (matching configuration.js)
    const SUPPORTED_QUERY_OPTIONS = {
        Ids: { label: 'Item IDs', type: 'array', hint: 'Comma-separated GUIDs' },
        ParentId: { label: 'Parent ID', type: 'string', hint: 'GUID of parent item' },
        ExcludeItemIds: { label: 'Exclude Item IDs', type: 'array', hint: 'Comma-separated GUIDs' },
        GenreIds: { label: 'Genre IDs', type: 'array', hint: 'Comma-separated GUIDs' },
        PersonIds: { label: 'Person IDs', type: 'array', hint: 'Comma-separated GUIDs' },
        StudioIds: { label: 'Studio IDs', type: 'array', hint: 'Comma-separated GUIDs' },
        Fields: { label: 'Fields', type: 'array', hint: 'Comma-separated field names' },
        MinPremiereDate: { label: 'Min Premiere Date', type: 'date', hint: 'YYYY-MM-DD' },
        MaxPremiereDate: { label: 'Max Premiere Date', type: 'date', hint: 'YYYY-MM-DD' },
        MinDateLastSaved: { label: 'Min Date Last Saved', type: 'date', hint: 'YYYY-MM-DD' },
        MinDateLastSavedForUser: { label: 'Min Date Last Saved For User', type: 'date', hint: 'YYYY-MM-DD' },
        IndexNumber: { label: 'Index Number', type: 'number', hint: 'Episode/Season index' },
        ParentIndexNumber: { label: 'Parent Index Number', type: 'number', hint: 'Season index' },
        MinCommunityRating: { label: 'Min Community Rating', type: 'number', hint: '0-10' },
        MinCriticRating: { label: 'Min Critic Rating', type: 'number', hint: '0-10' },
        IsFavorite: { label: 'Is Favorite', type: 'boolean' },
        IsPlayed: { label: 'Is Played', type: 'boolean' },
        IsUnplayed: { label: 'Is Unplayed', type: 'boolean' },
        IsMissing: { label: 'Is Missing', type: 'boolean' },
        IsUnaired: { label: 'Is Unaired', type: 'boolean' },
        HasThemeSong: { label: 'Has Theme Song', type: 'boolean' },
        HasThemeVideo: { label: 'Has Theme Video', type: 'boolean' },
        HasSubtitles: { label: 'Has Subtitles', type: 'boolean' },
        HasSpecialFeature: { label: 'Has Special Feature', type: 'boolean' },
        HasTrailer: { label: 'Has Trailer', type: 'boolean' },
        HasParentalRating: { label: 'Has Parental Rating', type: 'boolean' },
        IsHd: { label: 'Is HD', type: 'boolean' },
        Is4K: { label: 'Is 4K', type: 'boolean' },
        HasOverview: { label: 'Has Overview', type: 'boolean' },
        HasOfficialRating: { label: 'Has Official Rating', type: 'boolean' },
        Recursive: { label: 'Recursive', type: 'boolean', default: true },
        MaxOfficialRating: { label: 'Max Official Rating', type: 'string', hint: 'e.g., PG-13, TV-MA' },
        MinOfficialRating: { label: 'Min Official Rating', type: 'string', hint: 'e.g., PG, TV-14' },
        NameStartsWith: { label: 'Name Starts With', type: 'string' },
        NameStartsWithOrGreater: { label: 'Name Starts With Or Greater', type: 'string' },
        NameLessThan: { label: 'Name Less Than', type: 'string' },
        LocationTypes: { label: 'Location Types', type: 'array', hint: 'FileSystem, Remote, Virtual, Offline' },
        ExcludeLocationTypes: { label: 'Exclude Location Types', type: 'array', hint: 'FileSystem, Remote, Virtual, Offline' },
        ExcludeItemTypes: { label: 'Exclude Item Types', type: 'array', hint: 'Movie, Series, Episode, etc.' },
        ImageTypes: { label: 'Image Types', type: 'array', hint: 'Primary, Backdrop, Thumb, Logo, etc.' },
        OfficialRatings: { label: 'Official Ratings', type: 'array', hint: 'PG, PG-13, R, etc.' },
        Studios: { label: 'Studios', type: 'array', hint: 'Pipe-delimited names' },
        Artists: { label: 'Artists', type: 'array', hint: 'Pipe-delimited names' },
        Albums: { label: 'Albums', type: 'array', hint: 'Pipe-delimited names' },
        SeriesStatus: { label: 'Series Status', type: 'array', hint: 'Continuing, Ended, Unreleased' },
        Years: { label: 'Years', type: 'array', hint: 'Comma-separated years' },
        EnableResumable: { label: 'Enable Resumable', type: 'boolean' },
        EnableUserData: { label: 'Enable User Data', type: 'boolean' }
    };

    const CARD_FORMATS = ['Poster', 'Thumb', 'Backdrop', 'Square', 'Random'];
    const SORT_ORDERS = ['Random', 'Name', 'DateCreated', 'PremiereDate', 'CommunityRating', 'CriticRating', 'DatePlayed', 'SortName', 'PlayCount', 'PlayedPercentage', 'StartDate', 'Runtime', 'ProductionYear', 'IsPlayed', 'IsUnplayed', 'ParentIndexNumber', 'IndexNumber'];
    const SORT_ORDER_DIRECTIONS = ['Ascending', 'Descending'];
    const RENDER_MODE_OPTIONS = [{ value: 'Normal', label: 'Normal' }, { value: 'Spotlight', label: 'Spotlight' }, { value: 'Random', label: 'Random' }];

    // Current config state
    let currentConfig = null;
    let mainModalInstance = null;
    let currentActiveTab = 'settings'; // Track the currently active tab

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
     * Verify and sync recently-added library sections with actual Jellyfin libraries
     * @param {Object} config - Current configuration object
     * @returns {Object} Updated configuration with synced recently-added sections
     */
    async function verifyRecentlyAddedInLibraryConfig(config) {
        try {
            if (!window.ApiClient || !window.ApiClient._loggedIn) {
                WARN('User not logged in, skipping recently-added verification');
                return config;
            }

            if (!window.dataHelper || !window.dataHelper.getLibraries) {
                WARN('dataHelper.getLibraries not available, skipping recently-added verification');
                return config;
            }

            // Get current libraries
            const libraries = await window.dataHelper.getLibraries();
            if (!libraries || libraries.length === 0) {
                LOG('No libraries found, skipping recently-added verification');
                return config;
            }

            // Flatten groups to get all sections
            const allSections = flattenSectionGroups(config.HOME_SECTION_GROUPS || []);
            
            // Extract existing recently-added sections
            const recentlyAddedSections = allSections.filter(s => s.id && s.id.startsWith('recently-added-'));
            const existingLibraryIds = new Set(recentlyAddedSections.map(s => s.id.replace('recently-added-', '')));
            
            // Get current library IDs
            const currentLibraryIds = new Set(libraries.map(l => l.Id));
            
            // Find sections to remove (libraries that no longer exist)
            const sectionsToRemove = recentlyAddedSections.filter(s => {
                const libId = s.id.replace('recently-added-', '');
                return !currentLibraryIds.has(libId);
            });
            
            // Find libraries to add (new libraries not in config)
            const librariesToAdd = libraries.filter(l => !existingLibraryIds.has(l.Id) && l.CollectionType && l.CollectionType !== 'boxsets' && l.CollectionType !== 'playlists');
            
            if (sectionsToRemove.length === 0 && librariesToAdd.length === 0) {
                LOG('Recently-added sections are in sync with libraries');
                return config;
            }
            
            LOG(`Syncing recently-added sections: Removing ${sectionsToRemove.length}, Adding ${librariesToAdd.length}`);
            
            // Remove sections for non-existent libraries
            const sectionsToRemoveIds = new Set(sectionsToRemove.map(s => s.id));
            
            // Update groups by removing sections
            const updatedGroups = (config.HOME_SECTION_GROUPS || []).map(group => {
                if (!group.sections) return group;
                const filteredSections = group.sections.filter(s => !sectionsToRemoveIds.has(s.id));
                return {
                    ...group,
                    sections: filteredSections
                };
            });
            
            // Add sections for new libraries
            librariesToAdd.forEach(library => {
                let viewMoreUrl = null;
                
                if (library.CollectionType === 'movies') {
                    viewMoreUrl = `#/movies.html?topParentId=${library.Id}&collectionType=movies&tab=1`;
                } else if (library.CollectionType === 'tvshows') {
                    viewMoreUrl = `#/tv.html?topParentId=${library.Id}&collectionType=tvshows&tab=1`;
                }
                
                const newSection = {
                    id: `recently-added-${library.Id}`,
                    name: `Recently Added ${library.Name}`,
                    enabled: false, // Default to disabled
                    order: 61,
                    cardFormat: 'Poster',
                    viewMoreUrl: viewMoreUrl,
                    queries: [{
                        path: '/Items/Latest',
                        queryOptions: {
                            ParentId: library.Id,
                            SortBy: 'DateCreated',
                            SortOrder: 'Descending',
                            Limit: 16
                        }
                    }]
                };
                
                // Find or create "Recently Added" group
                let recentlyAddedGroup = updatedGroups.find(g => g.name === 'Recently Added');
                if (!recentlyAddedGroup) {
                    recentlyAddedGroup = {
                        name: 'Recently Added',
                        sections: []
                    };
                    updatedGroups.push(recentlyAddedGroup);
                }
                
                recentlyAddedGroup.sections.push(newSection);
            });
            
            // Update config
            config.HOME_SECTION_GROUPS = updatedGroups;
            
            LOG('Recently-added sections synced successfully');
            return config;
        } catch (error) {
            ERR('Error verifying recently-added library config:', error);
            return config;
        }
    }

    /**
     * Load configuration from JS Injector and merge with defaults
     */
    async function loadConfig() {
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
                MERGE_NEXT_UP: existingConfig.MERGE_NEXT_UP ?? defaults.MERGE_NEXT_UP ?? false
            };

            // Verify and sync recently-added library sections
            await verifyRecentlyAddedInLibraryConfig(mergedConfig);

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
    async function getConfig() {
        return await loadConfig();
    }

    /**
     * Merge default groups with admin overrides
     * @param {Array} defaultGroups - Array of default HomeScreenSectionGroup objects
     * @param {Array} overrideGroups - Array of override HomeScreenSectionGroup objects
     * @param {string} sectionType - Type of section to merge (home, seasonal, discovery, custom)
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

        // Add the type to each section in the merged sections
        merged.forEach(group => {
            group.sections.forEach(section => {
                section.type = sectionType;
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

            const server = window.ApiClient._serverAddress;
            const token = window.ApiClient.accessToken();

            // Get plugins list
            const pluginsResponse = await fetch(`${server}/Plugins`, {
                headers: {
                    'X-Emby-Token': token
                }
            });

            if (!pluginsResponse.ok) {
                throw new Error(`Failed to get plugins: ${pluginsResponse.status} ${pluginsResponse.statusText}`);
            }

            const pluginsData = await pluginsResponse.json();
            const pluginsList = Array.isArray(pluginsData) ? pluginsData : (pluginsData.Items || []);
            
            // Find JavaScript Injector plugin
            const injectorPlugin = pluginsList.find(plugin => 
                plugin.Name === 'JavaScript Injector' || plugin.Name === 'JS Injector'
            );

            if (!injectorPlugin) {
                WARN('JavaScript Injector plugin not found, using window.KefinTweaksConfig as fallback');
                return window.KefinTweaksConfig || {};
            }

            // Get injector config
            const configResponse = await fetch(`${server}/Plugins/${injectorPlugin.Id}/Configuration`, {
                headers: {
                    'X-Emby-Token': token
                }
            });

            if (!configResponse.ok) {
                throw new Error(`Failed to get plugin config: ${configResponse.status} ${configResponse.statusText}`);
            }

            const injectorConfig = await configResponse.json();
            
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
        
        // Add any remaining saved sections that weren't in current (preserve them)
        savedSectionMap.forEach(savedSection => {
            if (!savedSection.deleted) {
                mergedSections.push(JSON.parse(JSON.stringify(savedSection)));
            }
        });
        
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
     * Merges partial configs with saved config to preserve existing data
     */
    async function saveConfig(config) {
        try {
            // Load saved config from JS Injector
            const savedConfig = await getSavedConfig();
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
                MERGE_NEXT_UP: config.MERGE_NEXT_UP !== undefined ? config.MERGE_NEXT_UP : (savedHomeScreenConfig.MERGE_NEXT_UP !== undefined ? savedHomeScreenConfig.MERGE_NEXT_UP : false)
            };
            
            // Ensure window.KefinTweaksConfig exists
            if (!window.KefinTweaksConfig) {
                window.KefinTweaksConfig = {};
            }

            // Update homeScreenConfig with merged result
            window.KefinTweaksConfig.homeScreenConfig = mergedHomeScreenConfig;
            currentConfig = mergedHomeScreenConfig;
            
            // Merge other top-level config properties (preserve existing)
            Object.keys(savedConfig).forEach(key => {
                if (key !== 'homeScreenConfig' && !window.KefinTweaksConfig.hasOwnProperty(key)) {
                    window.KefinTweaksConfig[key] = savedConfig[key];
                }
            });

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
    function buildCheckbox(id, checked, label) {
        return `
            <label class="checkboxContainer" style="display: flex; align-items: center; gap: 0.5em;">
                <input type="checkbox" id="${id}" ${checked ? 'checked' : ''}>
                <span class="listItemBodyText">${label}</span>
            </label>
        `;
    }

    /**
     * Build Jellyfin select/dropdown HTML
     */
    function buildSelect(id, options, selectedValue, label) {
        const optionsHTML = options.map(opt => {
            const value = typeof opt === 'string' ? opt : opt.value;
            const label = typeof opt === 'string' ? opt : opt.label;
            const selected = value === selectedValue ? 'selected' : '';
            return `<option value="${value}" ${selected}>${label}</option>`;
        }).join('');

        return `
            <div style="margin-bottom: 1em;">
                <label class="listItemBodyText" for="${id}" style="display: block; margin-bottom: 0.25em;">${label}</label>
                <select id="${id}" class="fld emby-select emby-select-withcolor">
                    ${optionsHTML}
                </select>
            </div>
        `;
    }

    /**
     * Build Jellyfin text input HTML
     */
    function buildTextInput(id, value, label, type = 'text', placeholder = '') {
        return `
            <div style="margin-bottom: 1em;">
                <label class="listItemBodyText" for="${id}" style="display: block; margin-bottom: 0.25em;">${label}</label>
                <input type="${type}" id="${id}" class="fld emby-input" value="${value || ''}" placeholder="${placeholder || ''}">
            </div>
        `;
    }

    /**
     * Build enabled toggle buttons (ENABLED/DISABLED)
     */
    function buildEnabledToggleButtons(id, enabled) {
        const isEnabled = enabled !== false;
        return `
            <div style="margin-bottom: 1.5em; display: flex; gap: 0.5em;">
                <button type="button" class="enabled-toggle-btn ${isEnabled ? 'active' : ''}" data-enabled="true" style="
                    flex: 1;
                    padding: 0.75em 1.5em;
                    border: 2px solid ${isEnabled ? 'rgba(0, 164, 220, 0.8)' : 'rgba(255,255,255,0.2)'};
                    border-radius: 4px;
                    background: ${isEnabled ? 'rgba(0, 164, 220, 0.2)' : 'transparent'};
                    color: ${isEnabled ? 'var(--theme-primary-color, #00a4dc)' : 'rgba(255,255,255,0.7)'};
                    font-weight: ${isEnabled ? '600' : '400'};
                    cursor: pointer;
                    transition: all 0.2s;
                    text-transform: uppercase;
                    letter-spacing: 0.5px;
                ">
                    Enabled
                </button>
                <button type="button" class="enabled-toggle-btn ${!isEnabled ? 'active' : ''}" data-enabled="false" style="
                    flex: 1;
                    padding: 0.75em 1.5em;
                    border: 2px solid ${!isEnabled ? 'rgba(158, 158, 158, 0.8)' : 'rgba(255,255,255,0.2)'};
                    border-radius: 4px;
                    background: ${!isEnabled ? 'rgba(158, 158, 158, 0.2)' : 'transparent'};
                    color: ${!isEnabled ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.7)'};
                    font-weight: ${!isEnabled ? '600' : '400'};
                    cursor: pointer;
                    transition: all 0.2s;
                    text-transform: uppercase;
                    letter-spacing: 0.5px;
                ">
                    Disabled
                </button>
            </div>
        `;
    }

    /**
     * Build toggle slider (ON/OFF switch) - generic function for both settings and sections
     * @param {string} id - ID for the toggle (used for hidden checkbox if includeHiddenCheckbox is true)
     * @param {boolean} checked - Initial checked/enabled state
     * @param {string} label - Label text (only used if wrapInLabel is true)
     * @param {object} options - Configuration options
     * @param {boolean} options.includeHiddenCheckbox - Whether to include hidden checkbox (for settings)
     * @param {object} options.dataAttributes - Data attributes object (e.g., {sectionId: '...', sectionType: '...'})
     * @param {string} options.cssClass - CSS class for toggle button (default: 'toggle-slider')
     * @param {boolean} options.wrapInLabel - Whether to wrap in label container (default: true)
     */
    function buildToggleSlider(id, checked, label, options = {}) {
        const {
            includeHiddenCheckbox = false,
            dataAttributes = {},
            cssClass = 'toggle-slider',
            wrapInLabel = true
        } = options;

        const isEnabled = checked !== false;
        const dataAttrsString = Object.entries(dataAttributes)
            .map(([key, value]) => `data-${key}="${value}"`)
            .join(' ');

        const toggleButton = `
            <button type="button" class="${cssClass}" ${dataAttrsString} ${includeHiddenCheckbox ? `data-checkbox-id="${id}"` : ''} data-enabled="${isEnabled}" style="
                position: relative;
                width: 60px;
                height: 28px;
                border-radius: 14px;
                border: none;
                background: ${isEnabled ? 'rgba(0, 164, 220, 0.8)' : 'rgba(158, 158, 158, 0.5)'};
                cursor: pointer;
                transition: background-color 0.3s ease;
                flex-shrink: 0;
                padding: 0;
                display: flex;
                align-items: center;
                box-shadow: 0 2px 4px rgba(0,0,0,0.2);
            ">
                <span style="
                    position: absolute;
                    left: ${isEnabled ? '8px' : '6px'};
                    font-size: 10px;
                    font-weight: 600;
                    color: white;
                    text-transform: uppercase;
                    letter-spacing: 0.5px;
                    transition: opacity 0.2s ease;
                    opacity: ${isEnabled ? '1' : '0'};
                    z-index: 1;
                    pointer-events: none;
                ">ON</span>
                <span style="
                    position: absolute;
                    right: ${isEnabled ? '6px' : '8px'};
                    font-size: 10px;
                    font-weight: 600;
                    color: rgba(255,255,255,0.7);
                    text-transform: uppercase;
                    letter-spacing: 0.5px;
                    transition: opacity 0.2s ease;
                    opacity: ${isEnabled ? '0' : '1'};
                    z-index: 1;
                    pointer-events: none;
                ">OFF</span>
                <span style="
                    position: absolute;
                    width: 22px;
                    height: 22px;
                    border-radius: 50%;
                    background: white;
                    left: ${isEnabled ? 'calc(100% - 26px)' : '3px'};
                    transition: left 0.3s ease;
                    box-shadow: 0 2px 4px rgba(0,0,0,0.3);
                    z-index: 2;
                    pointer-events: none;
                "></span>
            </button>
        `;

        const hiddenCheckbox = includeHiddenCheckbox ? `
            <input type="checkbox" id="${id}" ${isEnabled ? 'checked' : ''} style="display: none;">
        ` : '';

        if (wrapInLabel) {
            return `
                <label class="checkboxContainer" style="display: flex; align-items: center; gap: 0.5em;">
                    ${hiddenCheckbox}
                    ${toggleButton}
                    <span class="listItemBodyText">${label}</span>
                </label>
            `;
        } else {
            return hiddenCheckbox + toggleButton;
        }
    }

    /**
     * Update toggle slider UI programmatically
     * @param {HTMLElement} toggleButton - The toggle button element
     * @param {boolean} isEnabled - New enabled state
     */
    function updateToggleSliderUI(toggleButton, isEnabled) {
        if (!toggleButton) return;

        toggleButton.dataset.enabled = isEnabled;
        toggleButton.style.background = isEnabled ? 'rgba(0, 164, 220, 0.8)' : 'rgba(158, 158, 158, 0.5)';

        // Update ON text
        const onText = toggleButton.querySelector('span:first-of-type');
        if (onText) {
            onText.style.opacity = isEnabled ? '1' : '0';
            onText.style.left = isEnabled ? '8px' : '6px';
        }

        // Update OFF text
        const offText = toggleButton.querySelector('span:nth-of-type(2)');
        if (offText) {
            offText.style.opacity = isEnabled ? '0' : '1';
            offText.style.right = isEnabled ? '6px' : '8px';
        }

        // Update knob position
        const knob = toggleButton.querySelector('span:last-of-type');
        if (knob) {
            knob.style.left = isEnabled ? 'calc(100% - 26px)' : '3px';
        }

        // Update hidden checkbox if present
        const checkboxId = toggleButton.dataset.checkboxId;
        if (checkboxId) {
            const checkbox = document.getElementById(checkboxId);
            if (checkbox) {
                checkbox.checked = isEnabled;
            }
        }
    }

    /**
     * Build filter by played status toggle button
     */
    function buildFilterByPlayedStatusToggle(id, checked) {
        const isChecked = checked === true;
        return `
            <div style="margin-bottom: 1em;">
                <label class="listItemBodyText" style="display: block; margin-bottom: 0.5em;">Hide Watched Items</label>
                <button type="button" class="filter-played-toggle" data-checked="${isChecked}" style="
                    position: relative;
                    width: 60px;
                    height: 28px;
                    border-radius: 14px;
                    border: none;
                    background: ${isChecked ? 'rgba(0, 164, 220, 0.8)' : 'rgba(158, 158, 158, 0.5)'};
                    cursor: pointer;
                    transition: background-color 0.3s ease;
                    padding: 0;
                    display: flex;
                    align-items: center;
                    box-shadow: 0 2px 4px rgba(0,0,0,0.2);
                ">
                    <span style="
                        position: absolute;
                        left: ${isChecked ? '8px' : '6px'};
                        font-size: 10px;
                        font-weight: 600;
                        color: white;
                        text-transform: uppercase;
                        letter-spacing: 0.5px;
                        transition: opacity 0.2s ease;
                        opacity: ${isChecked ? '1' : '0'};
                        z-index: 1;
                    ">ON</span>
                    <span style="
                        position: absolute;
                        right: ${isChecked ? '6px' : '8px'};
                        font-size: 10px;
                        font-weight: 600;
                        color: rgba(255,255,255,0.7);
                        text-transform: uppercase;
                        letter-spacing: 0.5px;
                        transition: opacity 0.2s ease;
                        opacity: ${isChecked ? '0' : '1'};
                        z-index: 1;
                    ">OFF</span>
                    <span style="
                        position: absolute;
                        width: 22px;
                        height: 22px;
                        border-radius: 50%;
                        background: white;
                        left: ${isChecked ? 'calc(100% - 26px)' : '3px'};
                        transition: left 0.3s ease;
                        box-shadow: 0 2px 4px rgba(0,0,0,0.3);
                        z-index: 2;
                    "></span>
                </button>
            </div>
        `;
    }

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
            { id: 'custom', label: 'Custom Sections' },
            { id: 'create', label: 'Create New Section' }
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
     * Build group HTML with sections and toggle-all button
     */
    function buildGroupHTML(group, sectionType) {
        let sections = group.sections || [];
        if (sections.length === 0) return '';

        sections = sections.filter(s => s.hidden !== true);
        
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
        
        const mergeNextUp = currentConfig.MERGE_NEXT_UP || false;
        
        // Filter groups based on mergeNextUp setting
        const getFilteredGroups = (groups) => {
            if (mergeNextUp) {
                // Filter out groups containing nextUp or continueWatching sections when merged
                return groups.map(group => {
                    const filteredSections = (group.sections || []).filter(s => 
                        s.id !== 'nextUp' && s.id !== 'continueWatching'
                    );
                    return { ...group, sections: filteredSections };
                }).filter(group => group.sections.length > 0);
            } else {
                // Filter out continueWatchingAndNextUp section
                return groups.map(group => {
                    const filteredSections = (group.sections || []).filter(s => 
                        s.id !== 'continueWatchingAndNextUp'
                    );
                    return { ...group, sections: filteredSections };
                }).filter(group => group.sections.length > 0);
            }
        };

        switch (sectionType) {
            case 'home': {
                //const homeGroups = getFilteredGroups(currentConfig.HOME_SECTION_GROUPS || []);
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
                        <div class="listItemBodyText secondary" style="font-size: 0.85em; margin-bottom: 0.75em;">Customize your Custom Home Sections here. You can add, edit, and delete your own sections. You can also import sections from the community from the "Browse Community Sections" tab or import from a file you exported from the "Import / Export Sections" tab.</div>
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

        // Determine if settings should be expanded (expanded by default unless mobile)
        const settingsExpanded = !isMobile();
        
        // Use currentActiveTab to determine which tab/content should be displayed
        const activeTab = currentActiveTab || 'settings';

        return `
            <div style="max-width: 100%; width: calc(100vw - 4em); overflow: hidden;">
                <!-- Tab Navigation -->
                <div style="display: flex; border-bottom: 1px solid rgba(255,255,255,0.1); margin-bottom: 1em; flex-wrap: wrap; gap: 0.5em;">
                    <button class="config-tab-btn ${activeTab === 'settings' ? 'active' : ''}" data-tab="settings" style="padding: 0.75em 1.5em; background: none; border: none; border-bottom: 2px solid ${activeTab === 'settings' ? 'var(--theme-primary-color, #00a4dc)' : 'transparent'}; color: ${activeTab === 'settings' ? 'var(--theme-primary-color, #00a4dc)' : 'rgba(255,255,255,0.7)'}; cursor: pointer; font-weight: 500;">
                        Global Settings
                    </button>
                    <button class="config-tab-btn ${activeTab === 'sections' ? 'active' : ''}" data-tab="sections" style="padding: 0.75em 1.5em; background: none; border: none; border-bottom: 2px solid ${activeTab === 'sections' ? 'var(--theme-primary-color, #00a4dc)' : 'transparent'}; color: ${activeTab === 'sections' ? 'var(--theme-primary-color, #00a4dc)' : 'rgba(255,255,255,0.7)'}; cursor: pointer; font-weight: 500;">
                        Edit Sections
                    </button>
                    <button class="config-tab-btn ${activeTab === 'order' ? 'active' : ''}" data-tab="order" style="padding: 0.75em 1.5em; background: none; border: none; border-bottom: 2px solid ${activeTab === 'order' ? 'var(--theme-primary-color, #00a4dc)' : 'transparent'}; color: ${activeTab === 'order' ? 'var(--theme-primary-color, #00a4dc)' : 'rgba(255,255,255,0.7)'}; cursor: pointer; font-weight: 500;">
                        Order Sections
                    </button>
                    <button class="config-tab-btn ${activeTab === 'community' ? 'active' : ''}" data-tab="community" style="padding: 0.75em 1.5em; background: none; border: none; border-bottom: 2px solid ${activeTab === 'community' ? 'var(--theme-primary-color, #00a4dc)' : 'transparent'}; color: ${activeTab === 'community' ? 'var(--theme-primary-color, #00a4dc)' : 'rgba(255,255,255,0.7)'}; cursor: pointer; font-weight: 500;">
                        Browse Community Sections
                    </button>
                    <button class="config-tab-btn ${activeTab === 'import-export' ? 'active' : ''}" data-tab="import-export" style="padding: 0.75em 1.5em; background: none; border: none; border-bottom: 2px solid ${activeTab === 'import-export' ? 'var(--theme-primary-color, #00a4dc)' : 'transparent'}; color: ${activeTab === 'import-export' ? 'var(--theme-primary-color, #00a4dc)' : 'rgba(255,255,255,0.7)'}; cursor: pointer; font-weight: 500;">
                        Import / Export Sections
                    </button>
                </div>

                <!-- Global Settings Tab -->
                <div id="tab-settings" class="config-tab-content" style="display: ${activeTab === 'settings' ? 'block' : 'none'};">
                    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1em;">
                        <!-- General Settings -->
                        <details ${settingsExpanded ? 'open' : ''} style="border: 1px solid rgba(255,255,255,0.1); border-radius: 4px; padding: 0.75em;">
                            <summary class="listItemBodyText" style="font-weight: 500; cursor: pointer; margin-bottom: 0.5em;">General Settings</summary>
                            <div style="padding: 0.75em 0 0 0;">
                                ${buildGeneralSettingsHTML()}
                            </div>
                        </details>

                        <!-- Discovery Settings -->
                        <details ${settingsExpanded ? 'open' : ''} style="border: 1px solid rgba(255,255,255,0.1); border-radius: 4px; padding: 0.75em;">
                            <summary class="listItemBodyText" style="font-weight: 500; cursor: pointer; margin-bottom: 0.5em;">Discovery Settings</summary>
                            <div style="padding: 0.75em 0 0 0;">
                                ${buildDiscoverySettingsHTML()}
                            </div>
                        </details>

                        <!-- Cache Settings -->
                        <details ${settingsExpanded ? 'open' : ''} style="border: 1px solid rgba(255,255,255,0.1); border-radius: 4px; padding: 0.75em;">
                            <summary class="listItemBodyText" style="font-weight: 500; cursor: pointer; margin-bottom: 0.5em;">Cache Settings</summary>
                            <div style="padding: 0.75em 0 0 0;">
                                ${buildCacheSettingsHTML()}
                            </div>
                        </details>
                    </div>
                </div>

                <!-- Edit Sections Tab -->
                <div id="tab-sections" class="config-tab-content" style="display: ${activeTab === 'sections' ? 'block' : 'none'};">
                    <div style="display: grid; grid-template-columns: 200px 1fr; gap: 1.5em;">
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

                <!-- Browse Community Sections Tab -->
                <div id="tab-community" class="config-tab-content" style="display: ${activeTab === 'community' ? 'block' : 'none'};">
                    <div class="listItemBodyText" style="margin-bottom: 1em;">Browse and import curated home screen sections from the community.</div>
                    <div class="listItemBodyText secondary" style="margin-bottom: 1.5em;">Submit your own Home Screen Sections <a href="https://github.com/ranaldsgift/KefinTweaks/discussions/64" target="_blank" class="button-link">here.</a></div>
                    
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1.5em; min-height: 400px;">
                        <!-- Left Column: Collection Cards Grid -->
                        <div>
                            <div class="listItemBodyText" style="font-weight: 500; margin-bottom: 0.75em;">Collections</div>
                            <div id="communityCollectionsGrid" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 1em; max-height: 600px; overflow-y: auto; padding-right: 0.5em;">
                                <!-- Collection cards will be populated here -->
                            </div>
                        </div>
                        
                        <!-- Right Column: Sections List -->
                        <div>
                            <div class="listItemBodyText" style="font-weight: 500; margin-bottom: 0.75em;">Sections</div>
                            <div id="communitySectionsContainer" style="display: none;">
                                <div id="communitySectionsList" style="max-height: 500px; overflow-y: auto; padding-right: 0.5em;">
                                    <!-- Sections list will be populated here -->
                                </div>
                                <button type="button" class="emby-button raised block button-submit" id="confirmCommunityImportBtn" style="padding: 0.75em 2em; margin-top: 1em; display: none;">Import Selected</button>
                            </div>
                            <div id="communitySectionsEmpty" class="listItemBodyText secondary" style="padding: 2em; text-align: center; color: rgba(255,255,255,0.5);">
                                Select a collection to view its sections
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Import / Export Sections Tab -->
                <div id="tab-import-export" class="config-tab-content" style="display: ${activeTab === 'import-export' ? 'block' : 'none'};">
                    <div class="listItemBodyText" style="margin-bottom: 1em;">Share your custom home screen sections or import configurations from others.</div>
                    <div style="display: flex; gap: 1em; flex-wrap: wrap; margin-top: 1.5em;">
                        <button type="button" class="emby-button button-submit raised export-sections-btn" style="padding: 0.75em 1.5em;">
                            <span>Export Sections</span>
                        </button>
                        <button type="button" class="emby-button button-submit raised import-sections-btn" style="padding: 0.75em 1.5em;">
                            <span>Import Sections</span>
                        </button>
                    </div>
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
        return `
            <div style="display: grid; gap: 1em;">
                <div style="border: 1px solid rgba(255,255,255,0.1); border-radius: 4px; padding: 0.75em;">
                    ${buildToggleSlider('merge-next-up', currentConfig.MERGE_NEXT_UP === true, 'Merge Next Up with Continue Watching', { includeHiddenCheckbox: true })}
                </div>
                <div style="border: 1px solid rgba(255,255,255,0.1); border-radius: 4px; padding: 0.75em;">
                    ${buildToggleSlider('seasonal-enableSeasonalAnimations', seasonal.enableSeasonalAnimations !== false, 'Enable Seasonal Animations', { includeHiddenCheckbox: true })}
                </div>
                <div style="border: 1px solid rgba(255,255,255,0.1); border-radius: 4px; padding: 0.75em;">
                    ${buildToggleSlider('seasonal-enableSeasonalBackground', seasonal.enableSeasonalBackground !== false, 'Enable Seasonal Backgrounds', { includeHiddenCheckbox: true })}
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

        return `
            <div style="display: grid; gap: 1em;">
                <div style="border: 1px solid rgba(255,255,255,0.1); border-radius: 4px; padding: 0.75em;">
                    ${buildToggleSlider('discovery-enabled', discovery.enabled !== false, 'Enabled', { includeHiddenCheckbox: true })}
                    ${buildToggleSlider('discovery-infiniteScroll', discovery.infiniteScroll !== false, 'Infinite Scroll', { includeHiddenCheckbox: true })}
                    ${buildToggleSlider('discovery-renderSpotlightAboveMatching', discovery.renderSpotlightAboveMatching === true, 'Group Top Rated and Normal Sections', { includeHiddenCheckbox: true })}
                    ${buildToggleSlider('discovery-randomizeOrder', discovery.randomizeOrder === true, 'Randomize Order', { includeHiddenCheckbox: true })}
                    ${buildTextInput('discovery-minPeopleAppearances', discovery.minPeopleAppearances || 10, 'Min People Appearances', 'number')}
                    ${buildTextInput('discovery-minGenreMovieCount', discovery.minGenreMovieCount || 50, 'Min Genre Movie Count', 'number')}
                    ${buildTextInput('discovery-defaultItemLimit', discovery.defaultItemLimit || 16, 'Default Item Limit', 'number')}
                    ${buildSelect('discovery-defaultSortOrder', SORT_ORDERS, discovery.defaultSortOrder || 'Random', 'Default Sort Order')}
                    ${buildSelect('discovery-defaultCardFormat', CARD_FORMATS, discovery.defaultCardFormat || 'Poster', 'Default Card Format')}
                    ${buildTextInput('discovery-spotlightDiscoveryChance', discovery.spotlightDiscoveryChance || 0.5, 'Spotlight Discovery Chance (0-1)', 'number')}
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

    /**
     * Build cache settings HTML
     */
    function buildCacheSettingsHTML() {
        if (!currentConfig) return '';
        const cache = currentConfig.CACHE || {};

        return `
            <div style="display: grid; gap: 1em;">
                <div style="border: 1px solid rgba(255,255,255,0.1); border-radius: 4px; padding: 0.75em;">
                    <div class="listItemBodyText secondary" style="font-size: 0.85em; margin-bottom: 0.75em;">TTL values in minutes</div>
                    ${buildTextInput('cache-DEFAULT_TTL', msToMinutes(cache.DEFAULT_TTL || 1800000), 'Default TTL (minutes)', 'number')}
                    ${buildTextInput('cache-VERY_SHORT_TTL', msToMinutes(cache.VERY_SHORT_TTL || 60000), 'Very Short TTL (minutes)', 'number')}
                    ${buildTextInput('cache-SHORT_TTL', msToMinutes(cache.SHORT_TTL || 300000), 'Short TTL (minutes)', 'number')}
                    ${buildTextInput('cache-LONG_TTL', msToMinutes(cache.LONG_TTL || 86400000), 'Long TTL (minutes)', 'number')}
                    ${buildTextInput('cache-STATIC_TTL', msToMinutes(cache.STATIC_TTL || 604800000), 'Static TTL (minutes)', 'number')}
                    ${buildTextInput('cache-DISCOVERY_TTL', msToMinutes(cache.DISCOVERY_TTL || 3600000), 'Discovery TTL (minutes)', 'number')}
                </div>
            </div>
        `;
    }

    /**
     * Get field configuration for default sections
     */
    function getDefaultSectionFields(sectionId) {
        // Check all default groups (HOME, SEASONAL, DISCOVERY)
        const defaultHome = flattenSectionGroups(window.KefinHomeConfig2?.HOME_SECTION_GROUPS || []);
        const defaultSeasonal = flattenSectionGroups(window.KefinHomeConfig2?.SEASONAL_SECTION_GROUPS || []);
        const defaultDiscovery = flattenSectionGroups(window.KefinHomeConfig2?.DISCOVERY_SECTION_GROUPS || []);
        const allDefaultSections = [...defaultHome, ...defaultSeasonal, ...defaultDiscovery];
        const defaultIds = new Set(allDefaultSections.map(s => s.id));
        if (!defaultIds.has(sectionId) && !sectionId.startsWith('recently-added-')) {
            return null; // Not a default section
        }

        if (sectionId.startsWith('recently-added-')) {
            return {
                includeName: true,
                includeCardFormat: true,
                includeOrder: true,
                includeItemLimit: true,
                includeSortOrder: false,
                includeFilterByPlayedStatus: true,
            };
        }

        // Simplified sections (Next Up, Continue Watching, Upcoming)
        const simplifiedSections = ['nextUp', 'continueWatching', 'upcoming', 'continueWatchingAndNextUp'];
        if (simplifiedSections.includes(sectionId)) {
            return {
                includeName: true,
                includeCardFormat: true,
                includeOrder: true,
                includeItemLimit: true,
                includeSortOrder: false,
                includeFilterByPlayedStatus: sectionId === 'upcoming',
                includePremiereDays: false,
                includeMinimumShows: false
            };
        }

        // Recently Released sections
        if (sectionId.startsWith('recentlyReleased.')) {
            return {
                includeName: true,
                includeCardFormat: true,
                includeOrder: true,
                includeItemLimit: true,
                includeSortOrder: true,
                includeFilterByPlayedStatus: true,
                includePremiereDays: true,
                includeMinimumShows: false
            };
        }

        // Popular TV Networks
        if (sectionId === 'popularTVNetworks') {
            return {
                includeName: true,
                includeCardFormat: true,
                includeOrder: true,
                includeItemLimit: true,
                includeSortOrder: true,
                includeFilterByPlayedStatus: false,
                includePremiereDays: false,
                includeMinimumShows: true
            };
        }

        // Other default sections
        return {
            includeName: true,
            includeCardFormat: true,
            includeOrder: true,
            includeItemLimit: true,
            includeSortOrder: true,
            includeFilterByPlayedStatus: false,
            includePremiereDays: false,
            includeMinimumShows: false
        };
    }

    /**
     * Build section editor modal content
     */
    function buildSectionEditorHTML(section, isDiscovery = false) {
        if (isDiscovery) {
            return buildDiscoveryEditorHTML(section);
        }

        const queries = section.queries || [{}];
        const hasMultipleQueries = queries.length > 1;
        const defaultFields = getDefaultSectionFields(section.id);
        const isDefaultSection = defaultFields !== null;

        // Get current group name for this section (if editing existing)
        let currentGroupName = '';
        if (section.id) {
            // Check all groups to find where this section exists
            let found = findSectionInGroups(currentConfig.HOME_SECTION_GROUPS || [], section.id);
            if (!found) found = findSectionInGroups(currentConfig.SEASONAL_SECTION_GROUPS || [], section.id);
            if (!found) found = findSectionInGroups(currentConfig.DISCOVERY_SECTION_GROUPS || [], section.id);
            if (!found) found = findSectionInGroups(currentConfig.CUSTOM_SECTION_GROUPS || [], section.id);
            if (found) {
                currentGroupName = found.group.name || '';
            }
        }
        
        // Get all existing group names for dropdown (only for custom sections)
        let groupSelectHTML = '';
        if (!isDefaultSection) {
            // For custom sections, only show groups from CUSTOM_SECTION_GROUPS
            const allGroups = currentConfig.CUSTOM_SECTION_GROUPS || [];
            const existingGroupNames = [...new Set(allGroups.map(g => g.name).filter(Boolean))];
            const groupOptions = ['New...', ...existingGroupNames];
            const selectedGroupValue = currentGroupName || (existingGroupNames.length > 0 ? existingGroupNames[0] : 'New...');

            groupSelectHTML = `
                ${buildSelect('section-group', groupOptions, selectedGroupValue, 'Section Group')}
                <div id="section-group-new-container" style="display: ${selectedGroupValue === 'New...' ? 'block' : 'none'}; margin-bottom: 1em;">
                    ${buildTextInput('section-group-new', '', 'New Group Name')}
                </div>
            `;
        }

        // Build Basic Properties based on section type
        let basicPropertiesHTML = `
            <div class="listItemBodyText" style="font-weight: 500; margin-bottom: 0.75em;">Basic Properties</div>
            ${groupSelectHTML}
            ${buildTextInput('section-name', section.name || '', 'Section Name')}
        `;

        // For default sections, show simplified fields
        if (isDefaultSection) {
            if (defaultFields.includeCardFormat) {
                basicPropertiesHTML += buildSelect('section-cardFormat', CARD_FORMATS, section.cardFormat || 'Poster', 'Card Format');
            }
            if (defaultFields.includeOrder) {
                basicPropertiesHTML += buildTextInput('section-order', section.order || 0, 'Order', 'number');
            }
            if (defaultFields.includeItemLimit) {
                const itemLimit = section.queries?.[0]?.queryOptions?.Limit || 20;
                basicPropertiesHTML += buildTextInput('section-itemLimit', itemLimit, 'Item Limit', 'number');
            }
            if (defaultFields.includeFilterByPlayedStatus) {
                basicPropertiesHTML += buildFilterByPlayedStatusToggle('section-filterByPlayedStatus', section.queries?.[0]?.queryOptions?.IsUnplayed === true);
            }
        } else {
            // Custom sections - show full editor in flexbox layout
            basicPropertiesHTML += `
                <div style="display: flex; gap: 0.75em; flex-wrap: wrap; align-items: flex-end;">
                    <div style="min-width: 150px; align-self: start;">
                        ${buildSelect('section-renderMode', [
                            { value: 'Normal', label: 'Normal' },
                            { value: 'Spotlight', label: 'Spotlight' },
                            { value: 'Random', label: 'Random' }
                        ], section.renderMode || (section.spotlight ? 'Spotlight' : 'Normal'), 'Render Mode')}
                    </div>
                    <div style="min-width: 150px; align-self: start;">
                        ${buildTextInput('section-order', section.order || 0, 'Order', 'number')}
                    </div>
                    <div id="section-cardFormat-container" style="min-width: 150px; display: ${(section.renderMode === 'Spotlight' || section.spotlight) ? 'none' : 'block'}; align-self: start;">
                        ${buildSelect('section-cardFormat', CARD_FORMATS, section.cardFormat || 'Poster', 'Card Format')}
                    </div>
                    <div id="section-discoveryEnabled-container" style="min-width: 150px; display: block; align-self: start;">
                        <div class="listItemBodyText" style="font-weight: 500; margin-bottom: 0.75em;">Discovery Enabled</div>
                        ${buildToggleSlider('section-discoveryEnabled', section.discoveryEnabled === true, '', { 
                            dataAttributes: { 'section-id': section.id, 'section-type': 'custom' }, 
                            cssClass: 'toggle-slider section-toggle-switch section-discoveryEnabled-toggle', 
                            wrapInLabel: false 
                        })}
                    </div>
                    <div style="min-width: 150px; align-self: start;">
                        ${buildFilterByPlayedStatusToggle('section-filterByPlayedStatus', section.queries?.[0]?.queryOptions?.IsUnplayed === true)}
                    </div>
                </div>
            `;
        }

        // Additional fields for default sections
        let additionalFieldsHTML = '';
        if (isDefaultSection) {
            // Check if this is a seasonal section based on the section id and add the Start Date and End Date fields
            if (section.id.startsWith('seasonal.')) {
                additionalFieldsHTML += `
                    <div style="border: 1px solid rgba(255,255,255,0.1); border-radius: 4px; padding: 0.75em; margin-bottom: 1em;">
                        <div class="listItemBodyText" style="font-weight: 500; margin-bottom: 0.75em;">Seasonal</div>
                        ${buildTextInput('section-startDate', section.startDate || '', 'Start Date (MM-DD)', 'text')}
                        ${buildTextInput('section-endDate', section.endDate || '', 'End Date (MM-DD)', 'text')}
                    </div>
                `;
            }

            if (defaultFields.includeSortOrder) {
                const sortBy = section.queries?.[0]?.queryOptions?.SortBy || 'Random';
                const sortOrder = section.queries?.[0]?.queryOptions?.SortOrder || 'Ascending';
                additionalFieldsHTML += `
                    <div style="border: 1px solid rgba(255,255,255,0.1); border-radius: 4px; padding: 0.75em; margin-bottom: 1em;">
                        <div class="listItemBodyText" style="font-weight: 500; margin-bottom: 0.75em;">Sorting</div>
                        ${buildSelect('section-sortBy', SORT_ORDERS, sortBy, 'Sort By')}
                        ${buildSelect('section-sortOrder', SORT_ORDER_DIRECTIONS, sortOrder, 'Sort Order')}
                    </div>
                `;
            }
            if (defaultFields.includePremiereDays) {
                // Extract min/max age from query object (not queryOptions)
                const query = section.queries?.[0];
                let minAgeInDays = query?.minAge !== undefined ? query.minAge : 0;
                let maxAgeInDays = query?.maxAge !== undefined ? query.maxAge : 30;
                
                // Fallback: try to calculate from MinPremiereDate/MaxPremiereDate if minAge/maxAge not set
                if (query?.minAge === undefined && query?.maxAge === undefined) {
                    const minPremiereDate = query?.queryOptions?.MinPremiereDate;
                    const maxPremiereDate = query?.queryOptions?.MaxPremiereDate;
                    if (minPremiereDate || maxPremiereDate) {
                        const now = Date.now();
                        if (minPremiereDate) {
                            const minDate = new Date(minPremiereDate);
                            maxAgeInDays = Math.floor((now - minDate.getTime()) / (1000 * 60 * 60 * 24));
                        }
                        if (maxPremiereDate) {
                            const maxDate = new Date(maxPremiereDate);
                            minAgeInDays = Math.floor((now - maxDate.getTime()) / (1000 * 60 * 60 * 24));
                        }
                    }
                }
                additionalFieldsHTML += `
                    <div style="border: 1px solid rgba(255,255,255,0.1); border-radius: 4px; padding: 0.75em; margin-bottom: 1em;">
                        <div class="listItemBodyText" style="font-weight: 500; margin-bottom: 0.75em;">Premiere Date Range</div>
                        ${buildTextInput('section-minAgeInDays', minAgeInDays, 'Minimum Age (Days)', 'number')}
                        ${buildTextInput('section-maxAgeInDays', maxAgeInDays, 'Maximum Age (Days)', 'number')}
                    </div>
                `;
            }
            if (defaultFields.includeMinimumShows) {
                // For popularTVNetworks, we need to get this from somewhere - it's not in the section config directly
                // We'll store it in a custom property or query option
                const minimumShows = section.minimumShowsForNetwork || section.queries?.[0]?.queryOptions?.minimumShowsForNetwork || 5;
                additionalFieldsHTML += `
                    <div style="border: 1px solid rgba(255,255,255,0.1); border-radius: 4px; padding: 0.75em; margin-bottom: 1em;">
                        <div class="listItemBodyText" style="font-weight: 500; margin-bottom: 0.75em;">Network Settings</div>
                        ${buildTextInput('section-minimumShowsForNetwork', minimumShows, 'Minimum Shows to Appear', 'number')}
                    </div>
                `;
            }
        }

        return `
            <div style="max-width: 1000px; margin: 0 auto;">
                <!-- Enabled Toggle (at the very top) -->
                <div>
                    ${buildEnabledToggleButtons('section-enabled', section.enabled)}
                </div>
                
                <!-- Basic Properties -->
                <div style="border: 1px solid rgba(255,255,255,0.1); border-radius: 4px; padding: 0.75em; margin-bottom: 1em;">
                    ${basicPropertiesHTML}
                </div>
                ${additionalFieldsHTML}
                ${!isDefaultSection ? `
                <!-- Queries Array Editor -->
                <div style="border: 1px solid rgba(255,255,255,0.1); border-radius: 4px; padding: 0.75em; margin-bottom: 1em;">
                    <div style="display: flex; align-items: center; margin-bottom: 0.75em; gap: 0.5em;">
                        <div class="listItemBodyText" style="font-weight: 500;">Queries</div>
                        <a href="https://api.jellyfin.org/" target="_blank" style="color: inherit;" title="Use the Jellyfin API documentation for additional details.">
                            <span class="material-icons info"></span>
                        </a>
                    </div>
                    <div id="queries-list">
                        ${queries.map((query, index) => buildQueryEditor(query, index, queries.length > 1)).join('')}
                    </div>
                    <button type="button" class="emby-button add-query-btn raised" style="padding: 0.5em 1em; margin-top: 0.75em;">
                        <span>Add Query</span>
                    </button>
                    <div data-merge-sorting style="margin-top: 1em; padding-top: 1em; border-top: 1px solid rgba(255,255,255,0.1); display: ${hasMultipleQueries ? 'block' : 'none'};">
                        <div class="listItemBodyText" style="font-weight: 500; margin-bottom: 0.75em;">Merge Sorting (for multiple queries)</div>
                        ${buildSelect('section-sortBy', SORT_ORDERS, section.sortBy, 'Sort By')}
                        ${buildSelect('section-sortOrder', SORT_ORDER_DIRECTIONS, section.sortOrder || 'Descending', 'Sort Order')}
                    </div>
                </div>

                <!-- Advanced Options -->
                <details style="border: 1px solid rgba(255,255,255,0.1); border-radius: 4px; padding: 0.75em; margin-bottom: 1em;">
                    <summary class="listItemBodyText" style="font-weight: 500; cursor: pointer; margin-bottom: 0.5em;">Advanced Options</summary>
                    <div style="padding: 0.75em 0 0 0;">
                        ${buildTextInput('section-ttl', section.ttl !== undefined ? section.ttl : '', 'TTL (ms, leave empty for default)', 'number')}
                        ${buildCheckbox('section-flattenSeries', section.flattenSeries === true, 'Flatten Series')}
                        ${buildTextInput('section-minimumItems', section.minimumItems || '', 'Minimum Items', 'number')}
                        ${buildTextInput('section-startDate', section.startDate || '', 'Start Date (MM-DD)', 'text')}
                        ${buildTextInput('section-endDate', section.endDate || '', 'End Date (MM-DD)', 'text')}
                    </div>
                </details>
                ` : ''}
            </div>
        `;
    }

    /**
     * Build query editor HTML
     */
    function buildQueryEditor(query, index, canDelete) {
        const queryType = query.path ? 'custom' : (query.dataSource ? 'datasource' : 'standard');
        const pathDisplay = queryType === 'custom' ? 'block' : 'none';
        const dataSourceDisplay = queryType === 'datasource' ? 'block' : 'none';
        
        return `
            <div class="query-editor" data-query-index="${index}" style="border: 1px solid rgba(255,255,255,0.1); border-radius: 4px; padding: 0.75em; margin-bottom: 0.75em;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.75em;">
                    <div class="listItemBodyText" style="font-weight: 500;">Query ${index + 1}</div>
                    ${canDelete ? `
                        <button type="button" class="emby-button delete-query-btn raised" data-query-index="${index}" style="padding: 0.5em 1em; background: rgba(244, 67, 54, 0.2);">
                            <span>Delete</span>
                        </button>
                    ` : ''}
                </div>
                ${buildSelect(`query-${index}-type`, [
                    { value: 'standard', label: 'Standard Items Query' },
                    { value: 'custom', label: 'Custom Endpoint' },
                    { value: 'datasource', label: 'Data Source' }
                ], queryType, 'Query Type')}
                <div id="query-${index}-path-container" style="display: ${pathDisplay};">
                    ${buildTextInput(`query-${index}-path`, query.path || '', 'Endpoint Path', 'text', '/Genres, /Persons, /Shows/NextUp, /Items/Latest, etc')}
                </div>
                <div id="query-${index}-dataSource-container" style="display: ${dataSourceDisplay};">
                    ${buildTextInput(`query-${index}-dataSource`, query.dataSource || '', 'Data Source (e.g., MoviesCache.getImdbTop250Movies)')}
                </div>
                <div style="margin-top: 0.75em;">
                    <div class="listItemBodyText" style="font-weight: 500; margin-bottom: 0.5em;">Parent Options</div>
                    ${buildParentOptionsEditor(query, index)}
                </div>
                <div style="margin-top: 0.75em;">
                    <div class="listItemBodyText" style="font-weight: 500; margin-bottom: 0.5em;">Query Options</div>
                    ${buildQueryOptionsEditor(query.queryOptions || {}, index)}
                </div>
            </div>
        `;
    }

    /**
     * Build parent options editor
     */
    function buildParentOptionsEditor(query, queryIndex) {
        const queryOptions = query.queryOptions || {};
        // Determine parent item type from query level first, then fall back to queryOptions for backwards compatibility
        let parentItemType = query._parentItemType || '';
        
        // Backwards compatibility: check queryOptions._parentItemType
        if (!parentItemType && (queryOptions._parentItemType === 'Collection' || queryOptions._parentItemType === 'Playlist')) {
            parentItemType = queryOptions._parentItemType;
        } else if (!parentItemType && queryOptions.CollectionIds && (Array.isArray(queryOptions.CollectionIds) ? queryOptions.CollectionIds.length > 0 : queryOptions.CollectionIds)) {
            // Backwards compatibility: check old CollectionIds field
            parentItemType = 'Collection';
        } else if (!parentItemType && queryOptions.PlaylistIds && (Array.isArray(queryOptions.PlaylistIds) ? queryOptions.PlaylistIds.length > 0 : queryOptions.PlaylistIds)) {
            // Backwards compatibility: check old PlaylistIds field
            parentItemType = 'Playlist';
        } else if (!parentItemType && queryOptions.ParentId) {
            parentItemType = 'Generic Parent';
        }

        return `
            <div style="display: grid; gap: 0.75em;">
                <!-- Parent Item Dropdown -->
                ${buildSelect(`query-${queryIndex}-parentItemType`, [
                    { value: '', label: 'Select a Parent... (optional)' },
                    { value: 'Collection', label: 'Collection' },
                    { value: 'Playlist', label: 'Playlist' },
                    { value: 'Generic Parent', label: 'Generic Parent' }
                ], parentItemType, 'Parent Item')}
                
                <!-- Conditional Parent Item Fields -->
                <div id="query-${queryIndex}-Collections-container" data-query-index="${queryIndex}" data-type="Collections" style="display: ${parentItemType === 'Collection' ? 'block' : 'none'};"></div>
                <div id="query-${queryIndex}-Playlists-container" data-query-index="${queryIndex}" data-type="Playlists" style="display: ${parentItemType === 'Playlist' ? 'block' : 'none'};"></div>
                <div id="query-${queryIndex}-GenericParent-container" style="display: ${parentItemType === 'Generic Parent' ? 'block' : 'none'};">
                    ${buildTextInput(`query-${queryIndex}-ParentId`, queryOptions.ParentId || '', 'Parent ID (GUID)', 'text')}
                </div>
                
                <!-- Hidden field to store parent item type -->
                <input type="hidden" id="query-${queryIndex}-ParentItemType" value="${parentItemType}">
            </div>
        `;
    }

    /**
     * Build query options editor
     */
    function buildQueryOptionsEditor(queryOptions, queryIndex) {

        // Regular text/number fields
        const commonFields = [
            { key: 'SortBy', label: 'Sort By', value: queryOptions.SortBy || '', options: SORT_ORDERS },
            { key: 'SortOrder', label: 'Sort Order', value: queryOptions.SortOrder || '', options: SORT_ORDER_DIRECTIONS },
            { key: 'Limit', label: 'Limit', value: queryOptions.Limit || '', type: 'number' },
            { key: 'Filters', label: 'Filters', value: queryOptions.Filters || '' },
            { key: 'SearchTerm', label: 'Search Term', value: queryOptions.SearchTerm || '' }
        ];

        // Extract additional options (not in common fields or badge fields)
        const additionalOptions = [];
        const badgeFieldKeys = ['IncludeItemTypes', 'Genres', 'Tags', 'CollectionIds', 'PlaylistIds', 'ParentId'];
        Object.entries(queryOptions || {}).forEach(([key, value]) => {
            if (!commonFields.find(f => f.key === key) && !badgeFieldKeys.includes(key)) {
                // If the key doesn't start with an underscore, add it to additionalOptions
                if (!key.startsWith('_')) {
                    additionalOptions.push({ key, value });
                }
            }
        });

        return `
            <div style="display: grid; gap: 0.75em;">
                <!-- Badge fields grouped in flexbox: IncludeItemTypes, Genres, Tags -->
                <div style="display: flex; gap: 0.75em; flex-wrap: wrap;">
                    <div id="query-${queryIndex}-IncludeItemTypes-container" data-query-index="${queryIndex}" data-type="IncludeItemTypes" style="flex: 1; min-width: 250px;"></div>
                    <div id="query-${queryIndex}-Genres-container" data-query-index="${queryIndex}" data-type="Genres" style="flex: 1; min-width: 250px;"></div>
                    <div id="query-${queryIndex}-Tags-container" data-query-index="${queryIndex}" data-type="Tags" style="flex: 1; min-width: 250px;"></div>
                </div>
                
                <!-- Regular Fields in flexbox -->
                <div style="display: flex; gap: 0.75em; flex-wrap: wrap;">
                    ${commonFields.map(field => `
                        <div style="flex: 1; min-width: 150px;">
                        ${field.options ? buildSelect(`query-${queryIndex}-${field.key}`, field.options, field.value, field.label) : buildTextInput(`query-${queryIndex}-${field.key}`, field.value, field.label, field.type || 'text')}
                        </div>
                    `).join('')}
                </div>
                <details style="margin-top: 0.5em;">
                    <summary class="listItemBodyText" style="cursor: pointer; font-size: 0.9em;">Additional Options</summary>
                    <div style="padding: 0.5em 0;">
                        ${buildAdditionalOptionsControls(queryIndex)}
                        ${buildAdditionalOptionsList(queryIndex, additionalOptions)}
                    </div>
                </details>
            </div>
        `;
    }

    /**
     * Setup badge autocomplete for a query field
     */
    async function setupQueryBadgeAutocomplete(modalInstance, queryIndex, type, queryOptions = {}, includeItemTypes = null, parentItemType = null) {
        if (!window.KefinTweaksUI || !window.KefinTweaksUI.createAutoCompleteInput) {
            WARN('KefinTweaksUI.createAutoCompleteInput not available');
            return;
        }

        const container = modalInstance.dialogContent.querySelector(`#query-${queryIndex}-${type}-container`);
        if (!container) return;

        // Calculate itemTypesForFilters early (used for Genres/Tags)
        const rawItemTypes = includeItemTypes || queryOptions.IncludeItemTypes;
        const itemTypesForFilters = (type === 'Genres' || type === 'Tags') 
            ? (Array.isArray(rawItemTypes) ? rawItemTypes : [rawItemTypes])
            : null;

        // Extract current values from query options
        let currentValues = [];
        if (type === 'IncludeItemTypes') {
            currentValues = Array.isArray(queryOptions.IncludeItemTypes) ? queryOptions.IncludeItemTypes : (queryOptions.IncludeItemTypes ? [queryOptions.IncludeItemTypes] : []);
        } else if (type === 'Genres') {
            // Get selected genre names from queryOptions
            const selectedGenres = queryOptions.Genres || '';
            const selectedGenreNames = selectedGenres ? (Array.isArray(selectedGenres) ? selectedGenres : selectedGenres.split(',').map(s => s.trim()).filter(s => s)) : [];
            
            // Fetch available genres from dataHelper.getFilters() to validate/match selected values
            if (window.dataHelper && window.dataHelper.getFilters && itemTypesForFilters) {
                try {
                    const filters = await window.dataHelper.getFilters(itemTypesForFilters, true, false);
                    const availableGenres = filters?.Genres || [];
                    
                    // Match selected genre names against available genres (case-insensitive)
                    const genreMap = new Map(availableGenres.map(g => [g.toLowerCase(), g]));
                    currentValues = selectedGenreNames
                        .map(name => {
                            // Try exact match first, then case-insensitive
                            const exactMatch = availableGenres.find(g => g === name);
                            if (exactMatch) return exactMatch;
                            const caseInsensitiveMatch = genreMap.get(name.toLowerCase());
                            return caseInsensitiveMatch || name; // Fallback to original name if not found
                        })
                        .filter(Boolean);
                } catch (err) {
                    WARN('Error fetching genres from dataHelper:', err);
                    // Fallback to using selected values as-is
                    currentValues = selectedGenreNames;
                }
            } else {
                // Fallback to using selected values as-is
                currentValues = selectedGenreNames;
            }
        } else if (type === 'Tags') {
            // Get selected tag names from queryOptions
            const selectedTags = queryOptions.Tags || '';
            const selectedTagNames = selectedTags ? (Array.isArray(selectedTags) ? selectedTags : selectedTags.split(',').map(s => s.trim()).filter(s => s)) : [];
            
            // Fetch available tags from dataHelper.getFilters() to validate/match selected values
            if (window.dataHelper && window.dataHelper.getFilters && itemTypesForFilters) {
                try {
                    const filters = await window.dataHelper.getFilters(itemTypesForFilters, true, false);
                    const availableTags = filters?.Tags || [];
                    
                    // Match selected tag names against available tags (case-insensitive)
                    const tagMap = new Map(availableTags.map(t => [t.toLowerCase(), t]));
                    currentValues = selectedTagNames
                        .map(name => {
                            // Try exact match first, then case-insensitive
                            const exactMatch = availableTags.find(t => t === name);
                            if (exactMatch) return exactMatch;
                            const caseInsensitiveMatch = tagMap.get(name.toLowerCase());
                            return caseInsensitiveMatch || name; // Fallback to original name if not found
                        })
                        .filter(Boolean);
                } catch (err) {
                    WARN('Error fetching tags from dataHelper:', err);
                    // Fallback to using selected values as-is
                    currentValues = selectedTagNames;
                }
            } else {
                // Fallback to using selected values as-is
                currentValues = selectedTagNames;
            }
        } else if (type === 'Collections') {
            // Check if ParentId contains a collection ID (when _parentItemType is 'Collection')
            let collectionIds = [];
            // Check query level first, then queryOptions for backwards compatibility
            const effectiveParentItemType = parentItemType || queryOptions._parentItemType;
            if (effectiveParentItemType === 'Collection' && queryOptions.ParentId) {
                collectionIds = [queryOptions.ParentId];
            } else {
                // Backwards compatibility: check old CollectionIds field
                collectionIds = Array.isArray(queryOptions.CollectionIds) ? queryOptions.CollectionIds : (queryOptions.CollectionIds ? [queryOptions.CollectionIds] : []);
            }

            if (collectionIds.length ===0) {
                currentValues = [];
            } else {                
                // For Collections, we need to fetch names from IDs
                if (window.apiHelper && window.ApiClient) {
                    try {
                        const userId = window.ApiClient.getCurrentUserId();
                        const serverAddress = window.ApiClient.serverAddress();
                        if (userId && serverAddress) {
                            const data = await window.apiHelper.getItems(
                                {
                                    IncludeItemTypes: 'BoxSet,CollectionFolder',
                                    Recursive: true,
                                    Fields: 'ItemCounts',
                                    Ids: collectionIds.join(',')
                                },
                                true,
                                300000
                            );
                            // Convert to objects with id and name
                            currentValues = (data?.Items || []).map(item => ({
                                id: item.Id,
                                name: item.Name
                            }));
                            // Add any IDs that weren't found (shouldn't happen, but just in case)
                            const foundIds = new Set(currentValues.map(v => v.id));
                            collectionIds.forEach(id => {
                                if (!foundIds.has(id)) {
                                    currentValues.push({ id: id, name: id }); // Fallback to ID if not found
                                }
                            });
                        } else {
                            // Fallback: convert IDs to objects
                            currentValues = collectionIds.map(id => ({ id: id, name: id }));
                        }
                    } catch (err) {
                        WARN('Error fetching collection names:', err);
                        // Fallback: convert IDs to objects
                        currentValues = collectionIds.map(id => ({ id: id, name: id }));
                    }
                } else {
                    // Convert IDs to objects for consistency
                    currentValues = collectionIds.map(id => ({ id: id, name: id }));
                }
            }
        } else if (type === 'Playlists') {
            // Check if ParentId contains a playlist ID (when _parentItemType is 'Playlist')
            let playlistIds = [];
            // Check query level first, then queryOptions for backwards compatibility
            const effectiveParentItemType = parentItemType || queryOptions._parentItemType;
            if (effectiveParentItemType === 'Playlist' && queryOptions.ParentId) {
                playlistIds = [queryOptions.ParentId];
            } else {
                // Backwards compatibility: check old PlaylistIds field
                playlistIds = Array.isArray(queryOptions.PlaylistIds) ? queryOptions.PlaylistIds : (queryOptions.PlaylistIds ? [queryOptions.PlaylistIds] : []);
            }

            if (playlistIds.length ===0) {
                currentValues = [];
            } else {
                // For Playlists, we need to fetch names from IDs
                if (window.apiHelper && window.ApiClient) {
                    try {
                        const userId = window.ApiClient.getCurrentUserId();
                        const serverAddress = window.ApiClient.serverAddress();
                        if (userId && serverAddress) {
                            const data = await window.apiHelper.getItems(
                                {
                                    IncludeItemTypes: 'Playlist',
                                    Recursive: true,
                                    Fields: 'ItemCounts',
                                    Ids: playlistIds.join(',')
                                },
                                true,
                                300000
                            );
                            // Convert to objects with id and name
                            currentValues = (data?.Items || []).map(item => ({
                                id: item.Id,
                                name: item.Name
                            }));
                            // Add any IDs that weren't found
                            const foundIds = new Set(currentValues.map(v => v.id));
                            playlistIds.forEach(id => {
                                if (!foundIds.has(id)) {
                                    currentValues.push({ id: id, name: id }); // Fallback to ID if not found
                                }
                            });
                        } else {
                            // Fallback: convert IDs to objects
                            currentValues = playlistIds.map(id => ({ id: id, name: id }));
                        }
                    } catch (err) {
                        WARN('Error fetching playlist names:', err);
                        // Fallback: convert IDs to objects
                        currentValues = playlistIds.map(id => ({ id: id, name: id }));
                    }
                } else {
                    // Convert IDs to objects for consistency
                    currentValues = playlistIds.map(id => ({ id: id, name: id }));
                }                    
            }
        }

        // Get available item types for IncludeItemTypes
        const allAvailableItemTypes = [
            'AggregateFolder', 'Audio', 'AudioBook', 'BasePluginFolder', 'Book', 'BoxSet', 'Channel', 
            'ChannelFolderItem', 'CollectionFolder', 'Episode', 'Folder', 'Genre', 'ManualPlaylistsFolder', 
            'Movie', 'LiveTvChannel', 'LiveTvProgram', 'MusicAlbum', 'MusicArtist', 'MusicGenre', 'MusicVideo', 
            'Person', 'Photo', 'PhotoAlbum', 'Playlist', 'PlaylistsFolder', 'Program', 'Recording', 'Season', 
            'Series', 'Studio', 'Trailer', 'TvChannel', 'TvProgram', 'UserRootFolder', 'UserView', 'Video', 'Year'
        ];

        // Normalize type: Collections->Collection, Playlists->Playlist, Genres->Genre, Tags->Tag
        const normalizedType = type === 'IncludeItemTypes' ? 'IncludeItemTypes' 
            : (type === 'Collections' ? 'Collection' 
            : (type === 'Playlists' ? 'Playlist'
            : (type === 'Genres' ? 'Genre'
            : (type === 'Tags' ? 'Tag' : type))));
        
        const autocomplete = window.KefinTweaksUI.createAutoCompleteInput({
            type: normalizedType,
            prefix: 'query',
            sectionIndex: queryIndex,
            container: container,
            label: type === 'IncludeItemTypes' ? 'Include Item Types' : (type === 'Collections' ? 'Collections' : (type === 'Playlists' ? 'Playlists' : type)),
            currentValuesArray: currentValues, // Fixed: use currentValuesArray parameter name
            availableTypes: type === 'IncludeItemTypes' ? allAvailableItemTypes : null,
            includeItemTypes: itemTypesForFilters, // Pass for filter fetching (Genres/Tags only)
            onChange: (values) => {
                // Values are updated automatically via hidden inputs
            }
        });

        if (autocomplete && autocomplete.element) {
            container.innerHTML = '';
            container.appendChild(autocomplete.element);
            await autocomplete.setup();
        }
    }

    /**
     * Build additional options controls (dropdown + add button)
     */
    function buildAdditionalOptionsControls(queryIndex) {
        const dropdownOptions = Object.entries(SUPPORTED_QUERY_OPTIONS)
            .map(([key, meta]) => `<option value="${key}">${meta.label}</option>`)
            .join('');

        return `
            <div class="query-${queryIndex}-additional-options-controls" data-query-index="${queryIndex}" style="border: 1px solid rgba(255,255,255,0.1); border-radius: 4px; padding: 0.75em; margin-top: 0.5em;">
                <div class="listItemBodyText" style="margin-bottom: 0.5em;">Additional Options</div>
                <div style="display: flex; gap: 0.5em; align-items: center;">
                    <select class="fld emby-select emby-select-withcolor additional-option-select" data-query-index="${queryIndex}" style="flex: 1; margin: 0; min-width: 0;">
                        <option value="">Select an option to add...</option>
                        ${dropdownOptions}
                    </select>
                    <button type="button" class="raised emby-button add-additional-option" data-query-index="${queryIndex}" style="background: rgba(0, 164, 220, 0.2); min-width: auto; padding: 0.5em 1em;">
                        <span>Add</span>
                    </button>
                </div>
            </div>
        `;
    }

    /**
     * Build additional options list
     */
    function buildAdditionalOptionsList(queryIndex, currentOptions) {
        const optionsHtml = (currentOptions || []).map((option, index) => {
            const meta = SUPPORTED_QUERY_OPTIONS[option.key] || { label: option.key, type: 'string' };
            const inputId = `query-${queryIndex}-additionalOption-${index}`;
            
            let inputField = '';
            if (meta.type === 'boolean') {
                const isChecked = option.value === true || option.value === 'true';
                inputField = `
                    <div style="flex: 1;">
                        <label class="checkboxContainer" style="display: flex; align-items: center; gap: 0.5em;">
                            <input type="checkbox" id="${inputId}" class="additional-option-value" data-key="${option.key}" data-type="boolean" ${isChecked ? 'checked' : ''}>
                            <span class="listItemBodyText">${meta.label}</span>
                        </label>
                    </div>
                `;
            } else {
                const displayValue = Array.isArray(option.value) ? option.value.join(',') : (option.value || '');
                inputField = `
                    <div style="flex: 1;">
                        <div class="listItemBodyText" style="margin-bottom: 0.25em;">${meta.label}</div>
                        <input type="${meta.type === 'number' ? 'number' : (meta.type === 'date' ? 'date' : 'text')}" 
                               id="${inputId}" 
                               class="fld emby-input additional-option-value" 
                               value="${displayValue}" 
                               data-key="${option.key}" 
                               data-type="${meta.type}" 
                               placeholder="${meta.hint || ''}" 
                               style="width: 100%;">
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
            <div class="query-${queryIndex}-additional-options-list-container" data-query-index="${queryIndex}" style="margin-top: 0.75em;">
                <div class="additional-options-list" data-query-index="${queryIndex}">
                    ${optionsHtml}
                </div>
            </div>
        `;
    }

    /**
     * Build discovery section editor HTML (simplified)
     */
    function buildDiscoveryEditorHTML(section) {
        return `
            <div style="max-width: 100%;">
                <div class="listItemBodyText secondary" style="margin-bottom: 1em; padding: 0.75em; background: rgba(255,255,255,0.05); border-radius: 4px;">
                    <strong>Note:</strong> Discovery sections use dynamic sources that are determined at runtime. You can only modify basic settings here.
                </div>
                ${buildTextInput('discovery-name', section.name || '', 'Name Template (use placeholders like {Genre}, {Person}, {Title})')}
                ${buildCheckbox('discovery-enabled', section.enabled !== false, 'Enabled')}
                ${buildTextInput('discovery-itemLimit', section.itemLimit || 20, 'Item Limit', 'number')}
                ${buildSelect('discovery-sortOrder', SORT_ORDERS, section.sortOrder || 'Random', 'Sort Order')}
                ${section.sortOrderDirection ? buildSelect('discovery-sortOrderDirection', SORT_ORDER_DIRECTIONS, section.sortOrderDirection || 'Ascending', 'Sort Order Direction') : ''}
                ${buildSelect('discovery-cardFormat', CARD_FORMATS, section.cardFormat || 'Poster', 'Card Format')}
                ${buildTextInput('discovery-ttl', section.ttl !== undefined ? section.ttl : '', 'TTL (ms)', 'number')}                
                ${buildSelect('discovery-renderMode', RENDER_MODE_OPTIONS, section.renderMode || 'Normal', 'Render Mode')}
            </div>
        `;
    }

    /**
     * Collect form data from section editor
     * @param {boolean} isDiscovery - Whether this is a discovery section
     * @param {Object} originalSection - Original section data (for preserving hidden fields in default sections)
     */
    function collectSectionEditorData(isDiscovery = false, originalSection = null) {
        const dialog = document.querySelector(`.dialogContainer[data-modal-id="${SECTION_EDITOR_MODAL_ID}"]`) || document.querySelector(`.dialogContainer[data-modal-id="${DISCOVERY_EDITOR_MODAL_ID}"]`);
        if (!dialog) return null;

        if (isDiscovery) {
            const renderMode = dialog.querySelector('#discovery-renderMode')?.value || 'Normal';
            const filterByPlayedStatus = dialog.querySelector('#discovery-filterByPlayedStatus')?.checked === true;
            const isCollections = dialog.querySelector('#discovery-minimumItems') !== null;
            
            const discovery = {
                name: dialog.querySelector('#discovery-name')?.value || '',
                enabled: dialog.querySelector('#discovery-enabled')?.checked !== false,
                renderMode: renderMode,
                order: parseInt(dialog.querySelector('#discovery-order')?.value || '0', 10),
                itemLimit: parseInt(dialog.querySelector('#discovery-itemLimit')?.value || '20', 10),
                sortOrder: dialog.querySelector('#discovery-sortOrder')?.value || 'Random',
                sortOrderDirection: dialog.querySelector('#discovery-sortOrderDirection')?.value || undefined,
                ttl: dialog.querySelector('#discovery-ttl')?.value ? parseInt(dialog.querySelector('#discovery-ttl').value, 10) : undefined
            };
            
            // Only set cardFormat if renderMode is not Spotlight
            if (renderMode !== 'Spotlight') {
                discovery.cardFormat = dialog.querySelector('#discovery-cardFormat')?.value || 'Poster';
            }
            
            // Add IsUnplayed filter if enabled
            if (filterByPlayedStatus) {
                discovery.queryOptions = { IsUnplayed: true };
            }
            
            // Add minimumItems for Collections
            if (isCollections) {
                const minimumItems = dialog.querySelector('#discovery-minimumItems')?.value;
                if (minimumItems) {
                    discovery.minimumItems = parseInt(minimumItems, 10);
                }
            }
            
            return discovery;
        }

        // Check if this is a default section
        const sectionId = dialog.querySelector('.section-save-btn')?.dataset.sectionId;
        const defaultFields = sectionId ? getDefaultSectionFields(sectionId) : null;
        const isDefaultSection = defaultFields !== null;
        
        // For default sections, start with original data to preserve hidden fields
        let section;
        if (isDefaultSection && originalSection) {
            // Start with a deep copy of the original section
            section = JSON.parse(JSON.stringify(originalSection));
            
            // Now update only the editable fields from the UI
            section.name = dialog.querySelector('#section-name')?.value || section.name || '';
            // Get enabled state from toggle buttons
            const enabledBtn = dialog.querySelector('.enabled-toggle-btn.active[data-enabled="true"]');
            section.enabled = enabledBtn !== null;
            section.order = parseInt(dialog.querySelector('#section-order')?.value || '0', 10);
            
            if (defaultFields.includeCardFormat) {
                section.cardFormat = dialog.querySelector('#section-cardFormat')?.value || 'Poster';
            }
            
            // Ensure queries array exists
            if (!section.queries || section.queries.length === 0) {
                section.queries = [{ queryOptions: {} }];
            }
            
            // Update only the editable queryOptions fields
            if (defaultFields.includeItemLimit) {
                const itemLimit = parseInt(dialog.querySelector('#section-itemLimit')?.value || '20', 10);
                if (!section.queries[0].queryOptions) section.queries[0].queryOptions = {};
                section.queries[0].queryOptions.Limit = itemLimit;
            }
            
            if (defaultFields.includeSortOrder) {
                const sortBy = dialog.querySelector('#section-sortBy')?.value;
                const sortOrder = dialog.querySelector('#section-sortOrder')?.value;
                if (sortBy || sortOrder) {
                    if (!section.queries[0].queryOptions) section.queries[0].queryOptions = {};
                    if (sortBy) section.queries[0].queryOptions.SortBy = sortBy;
                    if (sortOrder) section.queries[0].queryOptions.SortOrder = sortOrder;
                }
            }
            
            if (defaultFields.includePremiereDays) {
                const minAgeInDays = parseInt(dialog.querySelector('#section-minAgeInDays')?.value || '0', 10);
                const maxAgeInDays = parseInt(dialog.querySelector('#section-maxAgeInDays')?.value || '30', 10);
                // Store minAge/maxAge at query level (not in queryOptions)
                section.queries[0].minAge = minAgeInDays;
                section.queries[0].maxAge = maxAgeInDays;
            }
            
            if (defaultFields.includeMinimumShows) {
                const minimumShows = parseInt(dialog.querySelector('#section-minimumShowsForNetwork')?.value || '5', 10);
                section.minimumShowsForNetwork = minimumShows;
            }
            
            // Handle IsUnplayed filter (from toggle button)
            // Apply to all queries to ensure toggle is source of truth
            const filterToggle = dialog.querySelector('.filter-played-toggle');
            const filterByPlayedStatus = filterToggle?.dataset.checked === 'true';
            if (defaultFields.includeFilterByPlayedStatus) {
                section.queries.forEach(query => {
                    if (!query.queryOptions) query.queryOptions = {};
                    if (filterByPlayedStatus) {
                        query.queryOptions.IsUnplayed = true;
                    } else {
                        // Remove IsUnplayed if unchecked (toggle is source of truth)
                        delete query.queryOptions.IsUnplayed;
                    }
                });
            }

            const discoveryEnabledToggle = dialog.querySelector('.section-discoveryEnabled-toggle');
            if (discoveryEnabledToggle) {
                section.discoveryEnabled = discoveryEnabledToggle.dataset.enabled === 'true';
            }

            // Check if this is a seasonal section based on the section id and add the Start Date and End Date fields
            if (section.id.startsWith('seasonal.')) {
                section.startDate = dialog.querySelector('#section-startDate')?.value || section.startDate;
                section.endDate = dialog.querySelector('#section-endDate')?.value || section.endDate;
            }
            
            return section;
        }
        
        // For custom sections, build from scratch (existing logic)
        // Get enabled state from toggle buttons
        const enabledBtn = dialog.querySelector('.enabled-toggle-btn.active[data-enabled="true"]');
        section = {
            name: dialog.querySelector('#section-name')?.value || '',
            enabled: enabledBtn !== null,
            order: parseInt(dialog.querySelector('#section-order')?.value || '0', 10),
        };
        
        // Custom sections - collect full editor data
        const renderMode = dialog.querySelector('#section-renderMode')?.value || 'Normal';
        // Get filter by played status from toggle button
        const filterToggle = dialog.querySelector('.filter-played-toggle');
        const filterByPlayedStatus = filterToggle?.dataset.checked === 'true';
        const discoveryEnabledToggle = dialog.querySelector('.section-discoveryEnabled-toggle');
        section.discoveryEnabled = discoveryEnabledToggle?.dataset.enabled === 'true';
        section.renderMode = renderMode;
        
        // Only set cardFormat if renderMode is not Spotlight
        if (renderMode !== 'Spotlight') {
            section.cardFormat = dialog.querySelector('#section-cardFormat')?.value || 'Poster';
        }

        // Collect queries
        const queryEditors = dialog.querySelectorAll('.query-editor');
        section.queries = Array.from(queryEditors).map((editor) => {
            const queryIndex = parseInt(editor.dataset.queryIndex, 10);
            const queryType = editor.querySelector(`#query-${queryIndex}-type`)?.value || 'standard';
            const query = {};

            if (queryType === 'custom') {
                const path = editor.querySelector(`#query-${queryIndex}-path`)?.value;
                if (path) query.path = path;
            } else if (queryType === 'datasource') {
                const dataSource = editor.querySelector(`#query-${queryIndex}-dataSource`)?.value;
                if (dataSource) query.dataSource = dataSource;
            }

            // Collect query options
            query.queryOptions = {};
            
            // Add IsUnplayed filter if Filter by Played Status is enabled
            if (filterByPlayedStatus) {
                query.queryOptions.IsUnplayed = true;
            }
            
            // Collect badge autocomplete values from hidden inputs
            const includeItemTypesHidden = editor.querySelector(`.query_includeItemTypes_hidden[data-section-index="${queryIndex}"]`) ||
                                           editor.closest('.query-editor')?.querySelector(`.query_includeItemTypes_hidden[data-section-index="${queryIndex}"]`);
            if (includeItemTypesHidden && includeItemTypesHidden.value) {
                query.queryOptions.IncludeItemTypes = includeItemTypesHidden.value.split(',').map(s => s.trim()).filter(s => s);
            }
            
            const genresHidden = editor.querySelector(`.query_genres_hidden[data-section-index="${queryIndex}"]`) ||
                                 editor.closest('.query-editor')?.querySelector(`.query_genres_hidden[data-section-index="${queryIndex}"]`);
            if (genresHidden && genresHidden.value) {
                query.queryOptions.Genres = genresHidden.value.split(',').map(s => s.trim()).filter(s => s).join(',');
            }
            
            const tagsHidden = editor.querySelector(`.query_tags_hidden[data-section-index="${queryIndex}"]`) ||
                               editor.closest('.query-editor')?.querySelector(`.query_tags_hidden[data-section-index="${queryIndex}"]`);
            if (tagsHidden && tagsHidden.value) {
                query.queryOptions.Tags = tagsHidden.value.split(',').map(s => s.trim()).filter(s => s).join(',');
            }
            
            // Handle parent item type - only one can be set per query
            const parentItemTypeSelect = editor.querySelector(`#query-${queryIndex}-parentItemType`);
            const parentItemType = parentItemTypeSelect?.value || '';
            
            if (parentItemType === 'Collection') {
                const collectionsHidden = editor.querySelector(`.query_collection_hidden[data-section-index="${queryIndex}"]`) ||
                                          editor.closest('.query-editor')?.querySelector(`.query_collection_hidden[data-section-index="${queryIndex}"]`);
                if (collectionsHidden && collectionsHidden.value) {
                    // Extract collection IDs and use the first one for ParentId
                    const collectionIds = collectionsHidden.value.split(',').map(s => s.trim()).filter(s => s);
                    if (collectionIds.length > 0) {
                        query.queryOptions.ParentId = collectionIds[0]; // Use first collection ID as ParentId
                        // Store at query level (not in queryOptions)
                        query._parentItemType = 'Collection';
                    }
                }
                // Clear other parent types
                delete query.queryOptions.PlaylistIds;
                delete query.queryOptions.CollectionIds;
                delete query.queryOptions._parentItemType; // Remove from queryOptions if it exists (backwards compatibility)
            } else if (parentItemType === 'Playlist') {
                const playlistsHidden = editor.querySelector(`.query_playlist_hidden[data-section-index="${queryIndex}"]`) ||
                                        editor.closest('.query-editor')?.querySelector(`.query_playlist_hidden[data-section-index="${queryIndex}"]`);
                if (playlistsHidden && playlistsHidden.value) {
                    // Extract playlist IDs and use the first one for ParentId
                    const playlistIds = playlistsHidden.value.split(',').map(s => s.trim()).filter(s => s);
                    if (playlistIds.length > 0) {
                        query.queryOptions.ParentId = playlistIds[0]; // Use first playlist ID as ParentId
                        // Store at query level (not in queryOptions)
                        query._parentItemType = 'Playlist';
                    }
                }
                // Clear other parent types
                delete query.queryOptions.CollectionIds;
                delete query.queryOptions.PlaylistIds;
                delete query.queryOptions._parentItemType; // Remove from queryOptions if it exists (backwards compatibility)
            } else if (parentItemType === 'Generic Parent') {
                const parentIdInput = editor.querySelector(`#query-${queryIndex}-ParentId`);
                if (parentIdInput && parentIdInput.value) {
                    query.queryOptions.ParentId = parentIdInput.value.trim();
                }
                // Clear other parent types and metadata
                delete query.queryOptions.CollectionIds;
                delete query.queryOptions.PlaylistIds;
                delete query._parentItemType;
                delete query.queryOptions._parentItemType; // Remove from queryOptions if it exists (backwards compatibility)
            } else {
                // No parent item selected - clear all parent types and metadata
                delete query.queryOptions.CollectionIds;
                delete query.queryOptions.PlaylistIds;
                delete query.queryOptions.ParentId;
                delete query._parentItemType;
                delete query.queryOptions._parentItemType; // Remove from queryOptions if it exists (backwards compatibility)
            }
            
            // Fallback: try to get from badge containers directly
            if (!includeItemTypesHidden) {
                const badgeContainer = editor.querySelector(`#query-${queryIndex}-IncludeItemTypes-container`);
                if (badgeContainer) {
                    const badges = badgeContainer.querySelectorAll('.tag-badge');
                    if (badges.length > 0) {
                        query.queryOptions.IncludeItemTypes = Array.from(badges).map(b => b.getAttribute('data-value')).filter(Boolean);
                    }
                }
            }
            if (!genresHidden) {
                const badgeContainer = editor.querySelector(`#query-${queryIndex}-Genres-container`);
                if (badgeContainer) {
                    const badges = badgeContainer.querySelectorAll('.tag-badge');
                    if (badges.length > 0) {
                        query.queryOptions.Genres = Array.from(badges).map(b => b.getAttribute('data-value')).filter(Boolean).join(',');
                    }
                }
            }
            if (!tagsHidden) {
                const badgeContainer = editor.querySelector(`#query-${queryIndex}-Tags-container`);
                if (badgeContainer) {
                    const badges = badgeContainer.querySelectorAll('.tag-badge');
                    if (badges.length > 0) {
                        query.queryOptions.Tags = Array.from(badges).map(b => b.getAttribute('data-value')).filter(Boolean).join(',');
                    }
                }
            }
/*             if (!collectionsHidden) {
                const badgeContainer = editor.querySelector(`#query-${queryIndex}-Collections-container`);
                if (badgeContainer) {
                    const badges = badgeContainer.querySelectorAll('.tag-badge');
                    if (badges.length > 0) {
                        query.queryOptions.CollectionIds = Array.from(badges).map(b => b.getAttribute('data-value')).filter(Boolean);
                    }
                }
            }
            if (!playlistsHidden) {
                const badgeContainer = editor.querySelector(`#query-${queryIndex}-Playlists-container`);
                if (badgeContainer) {
                    const badges = badgeContainer.querySelectorAll('.tag-badge');
                    if (badges.length > 0) {
                        query.queryOptions.PlaylistIds = Array.from(badges).map(b => b.getAttribute('data-value')).filter(Boolean);
                    }
                }
            } */

            ['SortBy', 'SortOrder', 'Filters', 'SearchTerm'].forEach(key => {
                const value = editor.querySelector(`#query-${queryIndex}-${key}`)?.value;
                if (value) query.queryOptions[key] = value;
            });

            const limit = editor.querySelector(`#query-${queryIndex}-Limit`)?.value;
            if (limit) query.queryOptions.Limit = parseInt(limit, 10);

            // Collect additional options from list
            const additionalOptionsList = editor.querySelector(`.additional-options-list[data-query-index="${queryIndex}"]`);
            if (additionalOptionsList) {
                const optionRows = additionalOptionsList.querySelectorAll('.additional-option-row');
                optionRows.forEach(row => {
                    const keyInput = row.querySelector('.additional-option-key');
                    const typeInput = row.querySelector('.additional-option-type');
                    const valueInput = row.querySelector('.additional-option-value');
                    
                    if (valueInput) {
                        const key = valueInput.dataset.key;
                        const type = valueInput.dataset.type || 'string';
                        
                        if (key) {
                            let value;
                            if (type === 'boolean') {
                                value = valueInput.checked === true;
                            } else if (type === 'number') {
                                value = valueInput.value ? parseFloat(valueInput.value) : undefined;
                            } else if (type === 'array') {
                                value = valueInput.value ? valueInput.value.split(',').map(s => s.trim()).filter(s => s) : [];
                            } else {
                                value = valueInput.value || undefined;
                            }
                            
                            if (value !== undefined && value !== null && value !== '') {
                                query.queryOptions[key] = value;
                            }
                        }
                    }
                });
            }
            
            // Ensure IsUnplayed is removed if toggle is OFF (toggle is source of truth)
            // This must happen after collecting all options to override any IsUnplayed from additional options
            if (!filterByPlayedStatus) {
                delete query.queryOptions.IsUnplayed;
            }
            
            // Ensure queryOptions exists even if empty
            if (Object.keys(query.queryOptions).length === 0 && !query.path && !query.dataSource) {
                query.queryOptions = {};
            }

            return query;
        });

        // Collect advanced options
        const ttl = dialog.querySelector('#section-ttl')?.value;
        if (ttl) section.ttl = parseInt(ttl, 10);

        section.flattenSeries = dialog.querySelector('#section-flattenSeries')?.checked === true;

        const minimumItems = dialog.querySelector('#section-minimumItems')?.value;
        if (minimumItems) section.minimumItems = parseInt(minimumItems, 10);

        const startDate = dialog.querySelector('#section-startDate')?.value;
        const endDate = dialog.querySelector('#section-endDate')?.value;
        if (startDate) section.startDate = startDate;
        if (endDate) section.endDate = endDate;

        // Multi-query sorting
        if (section.queries.length > 1) {
            const sortBy = dialog.querySelector('#section-sortBy')?.value;
            const sortOrder = dialog.querySelector('#section-sortOrder')?.value;
            if (sortBy) section.sortBy = sortBy;
            if (sortOrder) section.sortOrder = sortOrder;
        }

        // Populate the _targetGroupName with the group name specified in the section editor
        const targetGroupName = dialog.querySelector('select#section-group')?.value;
        if (targetGroupName) section._targetGroupName = targetGroupName;

        return section;
    }

    /**
     * Collect all settings from form
     */
    function collectGlobalSettings() {
        const dialog = document.querySelector(`.dialogContainer[data-modal-id="${MAIN_MODAL_ID}"]`);
        if (!dialog) return {};

        const discovery = {
            enabled: dialog.querySelector('#discovery-enabled')?.checked !== false,
            infiniteScroll: dialog.querySelector('#discovery-infiniteScroll')?.checked !== false,
            minPeopleAppearances: parseInt(dialog.querySelector('#discovery-minPeopleAppearances')?.value || '10', 10),
            minGenreMovieCount: parseInt(dialog.querySelector('#discovery-minGenreMovieCount')?.value || '50', 10),
            defaultItemLimit: parseInt(dialog.querySelector('#discovery-defaultItemLimit')?.value || '16', 10),
            defaultSortOrder: dialog.querySelector('#discovery-defaultSortOrder')?.value || 'Random',
            defaultCardFormat: dialog.querySelector('#discovery-defaultCardFormat')?.value || 'Poster',
            spotlightDiscoveryChance: parseFloat(dialog.querySelector('#discovery-spotlightDiscoveryChance')?.value || '0.5'),
            renderSpotlightAboveMatching: dialog.querySelector('#discovery-renderSpotlightAboveMatching')?.checked === true,
            randomizeOrder: dialog.querySelector('#discovery-randomizeOrder')?.checked === true
        };

        const seasonal = {
            enabled: dialog.querySelector('#seasonal-enabled')?.checked !== false,
            enableSeasonalAnimations: dialog.querySelector('#seasonal-enableSeasonalAnimations')?.checked !== false,
            enableSeasonalBackground: dialog.querySelector('#seasonal-enableSeasonalBackground')?.checked !== false,
            seasonToggles: (window.KefinHomeConfig2?.SEASONAL_THEME_SETTINGS?.seasonToggles || []).map(season => ({
                ...season,
                enabled: dialog.querySelector(`#seasonal-${season.id}`)?.checked === true
            }))
        };

        const cache = {
            DEFAULT_TTL: minutesToMs(parseInt(dialog.querySelector('#cache-DEFAULT_TTL')?.value || '30', 10)),
            VERY_SHORT_TTL: minutesToMs(parseInt(dialog.querySelector('#cache-VERY_SHORT_TTL')?.value || '1', 10)),
            SHORT_TTL: minutesToMs(parseInt(dialog.querySelector('#cache-SHORT_TTL')?.value || '5', 10)),
            LONG_TTL: minutesToMs(parseInt(dialog.querySelector('#cache-LONG_TTL')?.value || '1440', 10)),
            STATIC_TTL: minutesToMs(parseInt(dialog.querySelector('#cache-STATIC_TTL')?.value || '10080', 10)),
            DISCOVERY_TTL: minutesToMs(parseInt(dialog.querySelector('#cache-DISCOVERY_TTL')?.value || '60', 10)),
            FORCE_REFRESH_TTL: 0
        };

        const mergeNextUp = dialog.querySelector('#merge-next-up')?.checked === true;

        return {
            DISCOVERY_SETTINGS: discovery,
            SEASONAL_THEME_SETTINGS: seasonal,
            CACHE: cache,
            MERGE_NEXT_UP: mergeNextUp
        };
    }

    /**
     * Open section editor modal
     */
    async function openSectionEditor(section, type = 'home') {
        const isDiscovery = type === 'discovery';
        const modalId = isDiscovery ? DISCOVERY_EDITOR_MODAL_ID : SECTION_EDITOR_MODAL_ID;

        // Close if already open
        if (window.ModalSystem.isOpen(modalId)) {
            window.ModalSystem.close(modalId);
        }

        // Store original section for default sections (to preserve hidden fields)
        const originalSection = JSON.parse(JSON.stringify(section));

        const content = document.createElement('div');
        content.innerHTML = buildSectionEditorHTML(section, isDiscovery);

        const footer = document.createElement('div');
        footer.style.display = 'flex';
        footer.style.gap = '0.75em';
        footer.style.justifyContent = 'flex-end';
        footer.style.gap = '0.5em';
        footer.style.display = 'flex';
        footer.innerHTML = `
            <button class="emby-button raised section-preview-btn" data-section-id="${section.id}" data-section-type="${type}" style="background: rgba(0, 164, 220, 0.2);">Preview</button>
            <button class="emby-button raised" onclick="window.ModalSystem.close('${modalId}')">Cancel</button>
            <button class="emby-button raised block button-submit section-save-btn" data-section-id="${section.id}" data-section-type="${type}">Save</button>
        `;

        window.ModalSystem.create({
            id: modalId,
            title: `Edit Section: ${section.name || 'Unnamed'}`,
            content: content,
            footer: footer,
            closeOnBackdrop: false,
            closeOnEscape: true,
            showCloseButton: true,
            onOpen: (modalInstance) => {
                // Attach event listeners
                const saveBtn = modalInstance.dialogFooter.querySelector('.section-save-btn');
                if (saveBtn) {
                    saveBtn.addEventListener('click', async () => {
                        const sectionData = collectSectionEditorData(isDiscovery, originalSection);
                        if (!sectionData) {
                            showToast('Error collecting section data');
                            return;
                        }

                        // Preserve section ID
                        sectionData.id = section.id;

                        updateSectionInConfig(sectionData);

                        // Save immediately
                        await saveConfig(currentConfig);

                        // Close editor first
                        window.ModalSystem.close(modalId);

                        // Refresh main modal and restore tab functionality
                        refreshMainModal();
                    });
                }

                const updateSectionInConfig = (sectionData) => {
                    const found = findSectionInAllGroups(currentConfig, sectionData.id);
                    
                    // Handle group assignment
                    const targetGroupName = sectionData._targetGroupName;
                    delete sectionData._targetGroupName; // Remove metadata

                    if (found) {
                        // Check if the section is in the target group
                        if (targetGroupName && targetGroupName !== found.group.name) {
                            // Remove the section from the current group
                            found.group.sections.splice(found.sectionIndex, 1);
                            // Add the section to the target group
                            addSectionToGroup(currentConfig[found.groupType], targetGroupName, sectionData);
                            return;
                        }


                        // Update the current config with the updated section data
                        updateSectionInGroups(currentConfig[found.groupType], sectionData.id, sectionData);
                        return;
                    } 

                    // Add the section to the config
                    addSectionToGroup(currentConfig.CUSTOM_SECTION_GROUPS, 'Custom Sections', sectionData);
                }

                // Preview button handler
                const previewBtn = modalInstance.dialogFooter.querySelector('.section-preview-btn');
                if (previewBtn) {
                    previewBtn.addEventListener('click', async () => {
                        // Collect current section data from editor
                        const sectionData = collectSectionEditorData(isDiscovery, originalSection);
                        if (!sectionData) {
                            showToast('Error collecting section data for preview');
                            return;
                        }
                        
                        // Merge with original section to preserve ID and all queryOptions fields
                        const previewSectionConfig = { ...originalSection, ...sectionData };
                        await previewSection(previewSectionConfig, type, previewBtn);
                    });
                }

                // Add query button handler
                const addQueryBtn = modalInstance.dialogContent.querySelector('.add-query-btn');
                if (addQueryBtn) {
                    addQueryBtn.addEventListener('click', () => {
                        const queriesList = modalInstance.dialogContent.querySelector('#queries-list');
                        const newIndex = queriesList.querySelectorAll('.query-editor').length;
                        const newQueryHTML = buildQueryEditor({}, newIndex, true);
                        queriesList.insertAdjacentHTML('beforeend', newQueryHTML);
                        
                        // Setup additional options listeners for new query
                        setupAdditionalOptionsListeners(modalInstance, newIndex);
                        
                        // Setup badge autocomplete for new query
                        (async () => {
                            const emptyQueryOptions = {};
                            await setupQueryBadgeAutocomplete(modalInstance, newIndex, 'IncludeItemTypes', emptyQueryOptions);
                            await setupQueryBadgeAutocomplete(modalInstance, newIndex, 'Genres', emptyQueryOptions, ['Movie']);
                            await setupQueryBadgeAutocomplete(modalInstance, newIndex, 'Tags', emptyQueryOptions, ['Movie']);
                            // Collections/Playlists will be set up when parent item type is selected
                        })();
                        
                        // Setup query type change handler for new query
                        const newQueryEditor = queriesList.querySelector(`.query-editor[data-query-index="${newIndex}"]`);
                        if (newQueryEditor) {
                            const typeSelect = newQueryEditor.querySelector(`#query-${newIndex}-type`);
                            if (typeSelect) {
                                const pathContainer = newQueryEditor.querySelector(`#query-${newIndex}-path-container`);
                                const dataSourceContainer = newQueryEditor.querySelector(`#query-${newIndex}-dataSource-container`);
                                
                                typeSelect.addEventListener('change', () => {
                                    const newQueryType = typeSelect.value;
                                    if (pathContainer) pathContainer.style.display = newQueryType === 'custom' ? 'block' : 'none';
                                    if (dataSourceContainer) dataSourceContainer.style.display = newQueryType === 'datasource' ? 'block' : 'none';
                                });
                            }
                        }
                        
                        // Re-attach delete handlers for all queries
                        modalInstance.dialogContent.querySelectorAll('.delete-query-btn').forEach(btn => {
                            if (!btn.dataset.listenerAttached) {
                                btn.dataset.listenerAttached = 'true';
                                btn.addEventListener('click', () => {
                                    const index = parseInt(btn.dataset.queryIndex, 10);
                                    const queryEditor = modalInstance.dialogContent.querySelector(`.query-editor[data-query-index="${index}"]`);
                                    if (queryEditor) {
                                        queryEditor.remove();
                                        // Re-index remaining queries
                                        modalInstance.dialogContent.querySelectorAll('.query-editor').forEach((editor, newIndex) => {
                                            editor.dataset.queryIndex = newIndex;
                                            const titleEl = editor.querySelector('.listItemBodyText');
                                            if (titleEl) titleEl.textContent = `Query ${newIndex + 1}`;
                                        });
                                        // Show/hide merge sorting based on query count
                                        const queriesCount = modalInstance.dialogContent.querySelectorAll('.query-editor').length;
                                        const mergeSorting = modalInstance.dialogContent.querySelector('[data-merge-sorting]');
                                        if (mergeSorting) {
                                            mergeSorting.style.display = queriesCount > 1 ? 'block' : 'none';
                                        }
                                    }
                                });
                            }
                        });
                        
                        // Show merge sorting if multiple queries
                        const queriesCount = modalInstance.dialogContent.querySelectorAll('.query-editor').length;
                        const mergeSorting = modalInstance.dialogContent.querySelector('[data-merge-sorting]');
                        if (mergeSorting) {
                            mergeSorting.style.display = queriesCount > 1 ? 'block' : 'none';
                        }
                    });
                }

                // Delete query button handlers
                modalInstance.dialogContent.querySelectorAll('.delete-query-btn').forEach(btn => {
                    btn.addEventListener('click', () => {
                        const index = parseInt(btn.dataset.queryIndex, 10);
                        const queryEditor = modalInstance.dialogContent.querySelector(`.query-editor[data-query-index="${index}"]`);
                        if (queryEditor) {
                            queryEditor.remove();
                            // Re-index remaining queries
                            modalInstance.dialogContent.querySelectorAll('.query-editor').forEach((editor, newIndex) => {
                                editor.dataset.queryIndex = newIndex;
                                const titleEl = editor.querySelector('.listItemBodyText');
                                if (titleEl) titleEl.textContent = `Query ${newIndex + 1}`;
                                // Update all input IDs
                                editor.querySelectorAll('input, select, textarea').forEach(input => {
                                    const oldId = input.id;
                                    if (oldId && oldId.includes(`query-${index}-`)) {
                                        input.id = oldId.replace(`query-${index}-`, `query-${newIndex}-`);
                                        const label = editor.querySelector(`label[for="${oldId}"]`);
                                        if (label) label.setAttribute('for', input.id);
                                    }
                                });
                            });
                            // Show/hide merge sorting based on query count
                            const queriesCount = modalInstance.dialogContent.querySelectorAll('.query-editor').length;
                            const mergeSorting = modalInstance.dialogContent.querySelector('[data-merge-sorting]');
                            if (mergeSorting) {
                                mergeSorting.style.display = queriesCount > 1 ? 'block' : 'none';
                            }
                        }
                    });
                });
                
                // Handle query type changes to show/hide relevant fields
                modalInstance.dialogContent.querySelectorAll('[id^="query-"][id$="-type"]').forEach(select => {
                    const queryEditor = select.closest('.query-editor');
                    const queryIndex = queryEditor.dataset.queryIndex;
                    
                    // Set initial state
                    const queryType = select.value;
                    const pathContainer = queryEditor.querySelector(`#query-${queryIndex}-path-container`);
                    const dataSourceContainer = queryEditor.querySelector(`#query-${queryIndex}-dataSource-container`);
                    
                    if (pathContainer) pathContainer.style.display = queryType === 'custom' ? 'block' : 'none';
                    if (dataSourceContainer) dataSourceContainer.style.display = queryType === 'datasource' ? 'block' : 'none';
                    
                    // Handle changes
                    select.addEventListener('change', () => {
                        const newQueryType = select.value;
                        if (pathContainer) pathContainer.style.display = newQueryType === 'custom' ? 'block' : 'none';
                        if (dataSourceContainer) dataSourceContainer.style.display = newQueryType === 'datasource' ? 'block' : 'none';
                    });
                });

                // Handle parent item type dropdown changes
                modalInstance.dialogContent.querySelectorAll('[id^="query-"][id$="-parentItemType"]').forEach(select => {
                    const queryEditor = select.closest('.query-editor');
                    const queryIndex = parseInt(queryEditor.dataset.queryIndex, 10);
                    
                    const collectionsContainer = queryEditor.querySelector(`#query-${queryIndex}-Collections-container`);
                    const playlistsContainer = queryEditor.querySelector(`#query-${queryIndex}-Playlists-container`);
                    const genericParentContainer = queryEditor.querySelector(`#query-${queryIndex}-GenericParent-container`);
                    const hiddenParentItemType = queryEditor.querySelector(`#query-${queryIndex}-ParentItemType`);
                    
                    // Helper function to setup autocomplete for a container
                    const setupAutocompleteForType = async (containerType, container) => {
                        if (!container) {
                            WARN(`Container not found for ${containerType} at query index ${queryIndex}`);
                            return;
                        }
                        // Check if autocomplete is already set up by looking for the autocomplete input
                        const existingInput = container.querySelector('.autocomplete-input');
                        if (existingInput) {
                            LOG(`Autocomplete already set up for ${containerType} at query index ${queryIndex}`);
                            return; // Already set up
                        }
                        LOG(`Setting up autocomplete for ${containerType} at query index ${queryIndex}`);
                        
                        // Get query and queryOptions from the section's queries array (passed to openSectionEditor)
                        // Fallback to empty object if not available
                        const query = (section.queries && section.queries[queryIndex]) ? section.queries[queryIndex] : {};
                        const queryOptions = query.queryOptions || {};
                        const queryParentItemType = query._parentItemType || null;
                        await setupQueryBadgeAutocomplete(modalInstance, queryIndex, containerType, queryOptions, null, queryParentItemType);
                    };
                    
                    // Set initial state and setup autocomplete if needed
                    const parentItemType = select.value;

                    // Set parent item type data attribute
                    const parentElement = select.parentElement?.parentElement;
                    if (parentElement) {
                        parentElement.dataset.parentItemType = parentItemType;
                    }

                    // Set initial display states
                    if (collectionsContainer) {
                        collectionsContainer.style.display = parentItemType === 'Collection' ? 'block' : 'none';
                    }
                    if (playlistsContainer) {
                        playlistsContainer.style.display = parentItemType === 'Playlist' ? 'block' : 'none';
                    }
                    if (genericParentContainer) {
                        genericParentContainer.style.display = parentItemType === 'Generic Parent' ? 'block' : 'none';
                    }
                    if (hiddenParentItemType) hiddenParentItemType.value = parentItemType;

                    // Setup autocomplete for initially visible containers
                    if (collectionsContainer && parentItemType === 'Collection') {
                        setupAutocompleteForType('Collections', collectionsContainer).catch(err => {
                            ERR('Error setting up Collections autocomplete:', err);
                        });
                    }
                    if (playlistsContainer && parentItemType === 'Playlist') {
                        setupAutocompleteForType('Playlists', playlistsContainer).catch(err => {
                            ERR('Error setting up Playlists autocomplete:', err);
                        });
                    }
                    
                    // Handle changes
                    select.addEventListener('change', () => {
                        const newParentItemType = select.value;

                        // Select list immediate parent element
                        const parentElement = select.parentElement?.parentElement;
                        if (parentElement) {
                            parentElement.dataset.parentItemType = newParentItemType;
                        }

                        // Update display styles synchronously
                        if (collectionsContainer) {
                            collectionsContainer.style.display = newParentItemType === 'Collection' ? 'block' : 'none';
                        }
                        if (playlistsContainer) {
                            playlistsContainer.style.display = newParentItemType === 'Playlist' ? 'block' : 'none';
                        }
                        if (genericParentContainer) {
                            genericParentContainer.style.display = newParentItemType === 'Generic Parent' ? 'block' : 'none';
                        }
                        if (hiddenParentItemType) hiddenParentItemType.value = newParentItemType;
                        
                        // Force synchronous repaint by accessing layout property
                        if (collectionsContainer) void collectionsContainer.offsetHeight;
                        if (playlistsContainer) void playlistsContainer.offsetHeight;
                        if (genericParentContainer) void genericParentContainer.offsetHeight;
                        
                        // Defer async autocomplete setup to allow browser to paint first
                        requestAnimationFrame(async () => {
                            if (collectionsContainer && newParentItemType === 'Collection') {
                                await setupAutocompleteForType('Collections', collectionsContainer);
                            }
                            if (playlistsContainer && newParentItemType === 'Playlist') {
                                await setupAutocompleteForType('Playlists', playlistsContainer);
                            }
                        });
                    });
                });

                // Setup additional options listeners for all queries
                modalInstance.dialogContent.querySelectorAll('.query-editor').forEach(queryEditor => {
                    const queryIndex = parseInt(queryEditor.dataset.queryIndex, 10);
                    setupAdditionalOptionsListeners(modalInstance, queryIndex);
                });
                
                // Setup badge autocomplete for all queries (only for custom sections, not default sections)
                const queriesList = modalInstance.dialogContent.querySelector('#queries-list');
                if (queriesList && !isDiscovery) {
                    // This is a custom section with queries editor
                    const queries = section.queries || [{}];
                    queries.forEach(async (query, queryIndex) => {
                        const queryOptions = query.queryOptions || {};
                        const includeItemTypes = queryOptions.IncludeItemTypes;
                        // Always setup: IncludeItemTypes, Genres, Tags
                        await setupQueryBadgeAutocomplete(modalInstance, queryIndex, 'IncludeItemTypes', queryOptions, null, query._parentItemType);
                        await setupQueryBadgeAutocomplete(modalInstance, queryIndex, 'Genres', queryOptions, includeItemTypes, query._parentItemType);
                        await setupQueryBadgeAutocomplete(modalInstance, queryIndex, 'Tags', queryOptions, includeItemTypes, query._parentItemType);
                        
                        // Conditionally setup Collections/Playlists based on parent item type
                        const queryEditor = queriesList.querySelector(`.query-editor[data-query-index="${queryIndex}"]`);
                        
                        // Check query level first, then queryOptions for backwards compatibility
                        let parentItemType = query._parentItemType || queryOptions._parentItemType || '';
                        
                        if (parentItemType === 'Collection') {
                            await setupQueryBadgeAutocomplete(modalInstance, queryIndex, 'Collections', queryOptions, null, query._parentItemType);
                        } else if (parentItemType === 'Playlist') {
                            await setupQueryBadgeAutocomplete(modalInstance, queryIndex, 'Playlists', queryOptions, null, query._parentItemType);
                        }
                    });
                }
                
                // Render Mode dropdown - show/hide Card Format
                const renderModeSelect = modalInstance.dialogContent.querySelector('#section-renderMode');
                const cardFormatContainer = modalInstance.dialogContent.querySelector('#section-cardFormat-container');
                if (renderModeSelect && cardFormatContainer) {
                    const updateCardFormatVisibility = () => {
                        cardFormatContainer.style.display = renderModeSelect.value === 'Spotlight' ? 'none' : 'block';
                    };
                    renderModeSelect.addEventListener('change', updateCardFormatVisibility);
                    updateCardFormatVisibility(); // Set initial state
                }
                
                // Section Group dropdown - show/hide new group input
                const groupSelect = modalInstance.dialogContent.querySelector('#section-group');
                const newGroupContainer = modalInstance.dialogContent.querySelector('#section-group-new-container');
                if (groupSelect && newGroupContainer) {
                    // Set initial state
                    if (groupSelect.value === 'New...') {
                        newGroupContainer.style.display = 'block';
                    }
                    groupSelect.addEventListener('change', () => {
                        newGroupContainer.style.display = groupSelect.value === 'New...' ? 'block' : 'none';
                    });
                }

                // Enabled toggle buttons handler
                modalInstance.dialogContent.querySelectorAll('.enabled-toggle-btn').forEach(btn => {
                    btn.addEventListener('click', () => {
                        const enabled = btn.dataset.enabled === 'true';
                        // Update all buttons
                        modalInstance.dialogContent.querySelectorAll('.enabled-toggle-btn').forEach(b => {
                            const isActive = b.dataset.enabled === String(enabled);
                            b.classList.toggle('active', isActive);
                            if (isActive) {
                                b.style.borderColor = enabled ? 'rgba(0, 164, 220, 0.8)' : 'rgba(158, 158, 158, 0.8)';
                                b.style.background = enabled ? 'rgba(0, 164, 220, 0.2)' : 'rgba(158, 158, 158, 0.2)';
                                b.style.color = enabled ? 'var(--theme-primary-color, #00a4dc)' : 'rgba(255,255,255,0.9)';
                                b.style.fontWeight = '600';
                            } else {
                                b.style.borderColor = 'rgba(255,255,255,0.2)';
                                b.style.background = 'transparent';
                                b.style.color = 'rgba(255,255,255,0.7)';
                                b.style.fontWeight = '400';
                            }
                        });
                    });
                });

                // Filter by played status toggle handler
                const filterToggle = modalInstance.dialogContent.querySelector('.filter-played-toggle');
                if (filterToggle) {
                    filterToggle.addEventListener('click', () => {
                        const currentChecked = filterToggle.dataset.checked === 'true';
                        const newChecked = !currentChecked;
                        filterToggle.dataset.checked = newChecked;
                        
                        // Update toggle visual state
                        filterToggle.style.background = newChecked ? 'rgba(0, 164, 220, 0.8)' : 'rgba(158, 158, 158, 0.5)';
                        
                        const onText = filterToggle.querySelector('span:first-of-type');
                        if (onText) {
                            onText.style.opacity = newChecked ? '1' : '0';
                            onText.style.left = newChecked ? '8px' : '6px';
                        }
                        
                        const offText = filterToggle.querySelector('span:nth-of-type(2)');
                        if (offText) {
                            offText.style.opacity = newChecked ? '0' : '1';
                            offText.style.right = newChecked ? '6px' : '8px';
                        }
                        
                        const knob = filterToggle.querySelector('span:last-of-type');
                        if (knob) {
                            knob.style.left = newChecked ? 'calc(100% - 26px)' : '3px';
                        }
                    });
                }

                const discoveryEnabledToggle = modalInstance.dialogContent.querySelector('.section-discoveryEnabled-toggle');
                if (discoveryEnabledToggle) {
                    discoveryEnabledToggle.addEventListener('click', () => {
                        const currentChecked = discoveryEnabledToggle.dataset.enabled === 'true';
                        const newChecked = !currentChecked;
                        discoveryEnabledToggle.dataset.enabled = newChecked;

                        updateToggleSliderUI(discoveryEnabledToggle, newChecked);
                    });
                }
            }
        });
    }

    /**
     * Refresh main modal content
     */
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
        const savedActiveTab = currentActiveTab || 'settings';

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
     * Setup additional options add/remove listeners for a query
     */
    function setupAdditionalOptionsListeners(modalInstance, queryIndex) {
        const dialog = modalInstance.dialogContainer;
        const controls = dialog.querySelector(`.query-${queryIndex}-additional-options-controls[data-query-index="${queryIndex}"]`);
        const listContainer = dialog.querySelector(`.query-${queryIndex}-additional-options-list-container[data-query-index="${queryIndex}"]`);
        
        if (controls) {
            const addBtn = controls.querySelector('.add-additional-option');
            const select = controls.querySelector('.additional-option-select');
            const list = listContainer ? listContainer.querySelector('.additional-options-list') : null;
            
            if (addBtn && select && list) {
                addBtn.addEventListener('click', () => {
                    const key = select.value;
                    if (!key) return;
                    
                    const meta = SUPPORTED_QUERY_OPTIONS[key];
                    if (!meta) return;
                    
                    const index = list.children.length;
                    const inputId = `query-${queryIndex}-additionalOption-${Date.now()}_${index}`;
                    
                    let inputField = '';
                    if (meta.type === 'boolean') {
                        inputField = `
                            <div style="flex: 1;">
                                <label class="checkboxContainer" style="display: flex; align-items: center; gap: 0.5em;">
                                    <input type="checkbox" id="${inputId}" class="additional-option-value" data-key="${key}" data-type="boolean" ${meta.default === true ? 'checked' : ''}>
                                    <span class="listItemBodyText">${meta.label}</span>
                                </label>
                            </div>
                        `;
                    } else {
                        inputField = `
                            <div style="flex: 1;">
                                <div class="listItemBodyText" style="margin-bottom: 0.25em;">${meta.label}</div>
                                <input type="${meta.type === 'number' ? 'number' : (meta.type === 'date' ? 'date' : 'text')}" 
                                       id="${inputId}" 
                                       class="fld emby-input additional-option-value" 
                                       value="" 
                                       data-key="${key}" 
                                       data-type="${meta.type}" 
                                       placeholder="${meta.hint || ''}" 
                                       style="width: 100%;">
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
        if (listContainer) {
            listContainer.querySelectorAll('.remove-additional-option').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    const row = e.target.closest('.additional-option-row');
                    if (row) row.remove();
                });
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
            
            // Update the current active tab tracker
            currentActiveTab = targetTab;

            const tabButtons = dialog.querySelectorAll('.config-tab-btn');
            const tabContents = dialog.querySelectorAll('.config-tab-content');

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
                } else if (targetTab === 'community') {
                    // Community Sections tab - refresh community sections content
                    setupCommunityCollectionsTab(dialog);
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
    function attachMainModalListeners(modalInstance) {
        const dialog = modalInstance?.dialogContainer ?? document.querySelector(`.dialogContainer[data-modal-id="${MAIN_MODAL_ID}"]`);
        if (!dialog) return;

        if (dialog.dataset.mainModalListenersAttached === 'true') {
            return; // Listeners already attached, skip
        }
        dialog.dataset.mainModalListenersAttached = 'true';

        // Attach initial section row listeners
        attachSectionRowListeners(dialog);

        // Merge Next Up toggle - update currentConfig immediately and refresh sections tab
        // Use event delegation to prevent stacking listeners when switching tabs
        /* dialog.addEventListener('click', async (e) => {
            const btn = e.target.closest('#merge-next-up');
            if (!btn) return;
            currentConfig.MERGE_NEXT_UP = btn.checked;

            // Hide continue watching and next up sections if merge next up is enabled
            const continueWatchingGroup = currentConfig.HOME_SECTION_GROUPS.find(g => g.name === 'Continue Watching');
            if (continueWatchingGroup) {
                continueWatchingGroup.sections = continueWatchingGroup.sections.map(s => {
                    if (s.id === 'continueWatchingAndNextUp') {
                        s.enabled = currentConfig.MERGE_NEXT_UP;
                        s.hidden = !currentConfig.MERGE_NEXT_UP;
                    } else {
                        s.enabled = !currentConfig.MERGE_NEXT_UP;
                        s.hidden = currentConfig.MERGE_NEXT_UP;
                    }
                    return s;
                });
                
                // Update continueWatchingGroup in currentConfig
                currentConfig.HOME_SECTION_GROUPS = currentConfig.HOME_SECTION_GROUPS.map(g => {
                    if (g.name === 'Continue Watching') {
                        return continueWatchingGroup;
                    }
                    return g;
                });
            }

            await saveConfig(currentConfig);
            refreshMainModal();
        }); */

        /* const mergeNextUpCheckbox = dialog.querySelector('#merge-next-up');
        if (mergeNextUpCheckbox) {
            mergeNextUpCheckbox.addEventListener('change', async () => {
                currentConfig.MERGE_NEXT_UP = mergeNextUpCheckbox.checked;

                // Hide continue watching and next up sections if merge next up is enabled
                const continueWatchingGroup = currentConfig.HOME_SECTION_GROUPS.find(g => g.name === 'Continue Watching');
                if (continueWatchingGroup) {
                    continueWatchingGroup.sections = continueWatchingGroup.sections.map(s => {
                        if (s.id === 'continueWatchingAndNextUp') {
                            s.enabled = currentConfig.MERGE_NEXT_UP;
                            s.hidden = !currentConfig.MERGE_NEXT_UP;
                        } else {
                            s.enabled = !currentConfig.MERGE_NEXT_UP;
                            s.hidden = currentConfig.MERGE_NEXT_UP;
                        }
                        return s;
                    });
                    
                    // Update continueWatchingGroup in currentConfig
                    currentConfig.HOME_SECTION_GROUPS = currentConfig.HOME_SECTION_GROUPS.map(g => {
                        if (g.name === 'Continue Watching') {
                            return continueWatchingGroup;
                        }
                        return g;
                    });
                }

                await saveConfig(currentConfig);
                // Refresh sections tab if it's currently visible
                const sectionsTab = dialog.querySelector('#tab-sections');
                if (sectionsTab && sectionsTab.style.display !== 'none') {
                    const contentContainer = dialog.querySelector('#section-content');
                    if (contentContainer) {
                        const activeNavBtn = dialog.querySelector('.section-type-nav-btn.active');
                        const activeType = activeNavBtn ? activeNavBtn.dataset.sectionType : 'home';
                        contentContainer.innerHTML = buildSectionContentHTML(activeType);
                    }
                }
            });
        } */
        
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
            
            const newSection = {
                id: `custom-${Date.now()}`,
                name: 'New Custom Section',
                enabled: true,
                order: 100,
                cardFormat: 'Poster',
                queries: [{
                    queryOptions: {
                        SortBy: 'Random',
                        Limit: 20
                    }
                }]
            };
            openSectionEditor(newSection, 'custom');
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
                        // Trigger change event for any listeners (like merge-next-up)
                        checkbox.dispatchEvent(new Event('change', { bubbles: true }));
                        updateToggleSliderUI(btn, checkbox.checked);

                        if (checkboxId === 'merge-next-up') {
                            currentConfig.MERGE_NEXT_UP = checkbox.checked;
                
                            // Hide continue watching and next up sections if merge next up is enabled
                            const continueWatchingGroup = currentConfig.HOME_SECTION_GROUPS.find(g => g.name === 'Continue Watching');
                            if (continueWatchingGroup) {
                                continueWatchingGroup.sections = continueWatchingGroup.sections.map(s => {
                                    if (s.id === 'continueWatchingAndNextUp') {
                                        s.enabled = currentConfig.MERGE_NEXT_UP;
                                        s.hidden = !currentConfig.MERGE_NEXT_UP;
                                    } else {
                                        s.enabled = !currentConfig.MERGE_NEXT_UP;
                                        s.hidden = currentConfig.MERGE_NEXT_UP;
                                    }
                                    return s;
                                });
                                
                                // Update continueWatchingGroup in currentConfig
                                currentConfig.HOME_SECTION_GROUPS = currentConfig.HOME_SECTION_GROUPS.map(g => {
                                    if (g.name === 'Continue Watching') {
                                        return continueWatchingGroup;
                                    }
                                    return g;
                                });
                            }
                
                            await saveConfig(currentConfig);
                            refreshMainModal();
                        }
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
     * Setup community collections tab with card grid layout
     */
    function setupCommunityCollectionsTab(dialog) {
        // Ensure community config is available
        if (!window.KefinCommunityConfig) {
            const communityTab = dialog.querySelector('#tab-community');
            if (communityTab) {
                communityTab.innerHTML = '<div class="listItemBodyText" style="color: #f44336;">Community configuration not loaded. Please ensure homeScreenConfig-community.js is loaded.</div>';
            }
            return;
        }

        const communityCollections = window.KefinCommunityConfig.collections || [];
        
        if (communityCollections.length === 0) {
            const communityTab = dialog.querySelector('#tab-community');
            if (communityTab) {
                communityTab.innerHTML = '<div class="listItemBodyText">No community collections available.</div>';
            }
            return;
        }

        const collectionsGrid = dialog.querySelector('#communityCollectionsGrid');
        const sectionsContainer = dialog.querySelector('#communitySectionsContainer');
        const sectionsList = dialog.querySelector('#communitySectionsList');
        const sectionsEmpty = dialog.querySelector('#communitySectionsEmpty');
        const confirmBtn = dialog.querySelector('#confirmCommunityImportBtn');

        if (!collectionsGrid || !sectionsContainer || !sectionsList || !sectionsEmpty || !confirmBtn) {
            return;
        }

        let selectedCollection = null;
        let selectedCollectionIndex = null;

        // Build collection cards
        collectionsGrid.innerHTML = communityCollections.map((collection, index) => {
            const description = collection.description || 'No description available.';
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

        // Add click handlers to collection cards
        collectionsGrid.querySelectorAll('.community-collection-card').forEach((card, index) => {
            card.addEventListener('click', (e) => {
                // Don't trigger if clicking the info button
                if (e.target.closest('.community-collection-info-btn')) {
                    return;
                }

                // Remove previous selection
                collectionsGrid.querySelectorAll('.community-collection-card').forEach(c => {
                    c.style.borderColor = 'rgba(255,255,255,0.1)';
                    c.style.background = 'rgba(255,255,255,0.05)';
                });

                // Highlight selected card
                card.style.borderColor = 'rgba(0, 164, 220, 0.8)';
                card.style.background = 'rgba(0, 164, 220, 0.15)';

                selectedCollection = communityCollections[index];
                selectedCollectionIndex = index;

                // Render sections list
                renderSectionsList(selectedCollection, sectionsList, sectionsContainer, sectionsEmpty, confirmBtn);
            });
        });

        // Add info button handlers for popover
        collectionsGrid.querySelectorAll('.community-collection-info-btn').forEach((btn, index) => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const collection = communityCollections[index];
                const description = collection.description || 'No description available.';
                
                // Create and show popover
                showInfoPopover(btn, description, collection.name || 'Collection');
            });
        });

        // Import button handler
        confirmBtn.addEventListener('click', async () => {
            if (!selectedCollection) return;

            const selectedIndices = Array.from(dialog.querySelectorAll('.import-community-check:checked')).map(c => parseInt(c.dataset.index));
            
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
            }
        });
    }

    /**
     * Render sections list for selected collection
     */
    function renderSectionsList(collection, sectionsList, sectionsContainer, sectionsEmpty, confirmBtn) {
        if (!collection || !collection.sections || collection.sections.length === 0) {
            sectionsList.innerHTML = '<div class="listItemBodyText secondary">No sections found in this collection.</div>';
            sectionsContainer.style.display = 'block';
            sectionsEmpty.style.display = 'none';
            confirmBtn.style.display = 'none';
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

        sectionsContainer.style.display = 'block';
        sectionsEmpty.style.display = 'none';
        confirmBtn.style.display = 'inline-block';
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
            const config = await loadConfig();

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
                <button class="emby-button raised block button-submit" id="save-all-btn">Save</button>
            `;

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

                    // Save All button
                    const saveAllBtn = modalInstance.dialogFooter.querySelector('#save-all-btn');
                    if (saveAllBtn) {
                        saveAllBtn.addEventListener('click', async () => {
                            const globalSettings = collectGlobalSettings();
                            Object.assign(currentConfig, globalSettings);
                            
                            // If Order Sections tab was used, ensure order values are up to date
                            const orderList = modalInstance.dialogContent.querySelector('#order-sections-list');
                            if (orderList) {
                                const allRows = Array.from(orderList.querySelectorAll('.section-order-row'));
                                allRows.forEach((r, index) => {
                                    const sectionId = r.dataset.sectionId;
                                    if (sectionId) {
                                        const found = findSectionInAllGroups(currentConfig, sectionId);
                                        if (found?.section) {
                                            found.section.order = (index + 1) * 10;
                                        }
                                    }
                                });
                            }
                            
                            await saveConfig(currentConfig);
                            showToast('Configuration saved!');
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

            mainModalInstance.dialog.style.maxWidth = '90vw';
            mainModalInstance.dialog.style.width = '1400px';
            mainModalInstance.dialog.style.height = '90vh';

            LOG('Main configuration modal opened');
        } catch (error) {
            ERR('Error opening config modal:', error);
            showToast('Error opening configuration: ' + error.message);
        }
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
            const userId = ApiClient.getCurrentUserId();
            const serverUrl = ApiClient.serverAddress();

            if (!userId || !serverUrl) {
                showToast('Unable to get user ID or server URL');
                return;
            }

            // Build queries from section configuration
            const queries = section.queries || [];
            if (queries.length === 0) {
                showToast('Section has no queries to preview');
                return;
            }

            // Fetch items from all queries
            let allItems = [];
            for (const query of queries) {
                let queryUrl = null;
                
                // Build query URL using shared builder (handles minAge/maxAge conversion)
                if (query.dataSource) {
                    // Data source - skip for preview (would need special handling)
                    showToast('Data source queries cannot be previewed');
                    continue;
                } else if (window.apiHelper && window.apiHelper.buildQueryFromSection) {
                    // Use shared builder for consistency
                    queryUrl = window.apiHelper.buildQueryFromSection(query, userId, serverUrl);
                } else {
                    // Fallback to individual builders
                    if (query.path) {
                        queryUrl = buildCustomEndpointForPreview(query.path, query.queryOptions || {}, userId, serverUrl);
                    } else {
                        queryUrl = buildStandardQueryForPreview(query.queryOptions || {}, userId, serverUrl);
                    }
                }

                if (queryUrl && typeof queryUrl === 'string') {
                    try {
                        const result = await apiHelper.getQuery(queryUrl, { useCache: false });
                        const items = result.Items || result || [];
                        allItems = allItems.concat(items);
                    } catch (error) {
                        console.error('[Preview] Error fetching query:', error);
                        showToast(`Error fetching query: ${error.message}`);
                    }
                }
            }

            if (allItems.length === 0) {
                showToast('No items found for preview');

                // Additionally temporarily change the visual style of the Preview button
                // Change the text to "No Items" and give it a distinct red border or make it clear that it's not working   
                if (btn) {
                    btn.textContent = 'No Items';
                    btn.style.border = '1px solid #ff6b6b';
                    btn.style.color = '#ff6b6b';
                }
                // After a short period remove this style and restore the original text and color
                setTimeout(() => {
                    if (btn) {
                        btn.textContent = 'Preview';
                        btn.style.border = '1px solid #ccc';
                        btn.style.color = '#ccc';
                    }
                }, 3000);
                return;
            }

            // Apply limit if specified
            const limit = section.queries?.[0]?.queryOptions?.Limit || section.itemLimit || 20;
            allItems = window.cardBuilder.postProcessItems(section, allItems);
            const limitedItems = allItems.slice(0, parseInt(limit, 10));

            // Determine render mode
            const renderMode = section.renderMode || (section.spotlight ? 'Spotlight' : 'Normal');
            const useSpotlight = renderMode === 'Spotlight' || (renderMode === 'Random' && Math.random() < 0.5);

            // Determine card format
            let cardFormat = section.cardFormat || 'Poster';
            if (cardFormat === 'Random') {
                const formats = ['Poster', 'Thumb', 'Backdrop'];
                cardFormat = formats[Math.floor(Math.random() * formats.length)];
            }

            // Create preview modal
            const previewModalId = 'kefin-preview-section';
            const content = document.createElement('div');
            content.style.cssText = 'padding: 1em; max-width: 1400px; width: 100%;';
            content.innerHTML = `
                <div class="listItemBodyText" style="margin-bottom: 1em;">
                    Preview: ${section.name || 'Unnamed Section'} (${limitedItems.length} item${limitedItems.length !== 1 ? 's' : ''})
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
                onOpen: (modalInstance) => {
                    const container = modalInstance.dialogContent.querySelector('#preview-container');
                    modalInstance.dialog.style.width = '1400px';
                    
                    let previewElement = null;
                    if (useSpotlight && typeof window.cardBuilder.renderSpotlightSection === 'function') {
                        previewElement = window.cardBuilder.renderSpotlightSection(limitedItems, section.name || 'Preview', {
                            autoPlay: false,
                            showDots: true,
                            showNavButtons: true,
                            viewMoreUrl: null
                        });
                    } else if (typeof window.cardBuilder.renderCards === 'function') {
                        previewElement = window.cardBuilder.renderCards(
                            limitedItems,
                            section.name || 'Preview',
                            null,
                            true,
                            cardFormat,
                            section.sortOrder || null,
                            section.sortOrderDirection || null
                        );
                    }

                    if (previewElement) {
                        container.innerHTML = '';
                        container.appendChild(previewElement);
                    } else {
                        container.innerHTML = '<div style="opacity: 0.75; text-align: center;">Unable to render preview with the current configuration.</div>';
                    }
                }
            });

        } catch (error) {
            console.error('[Preview] Error:', error);
            showToast(`Preview error: ${error.message}`);
        } finally {
            Dashboard.hideLoadingMsg();
        }
    }

    /**
     * Build standard query URL for preview
     * Uses shared apiHelper.buildQueryFromSection for consistency
     */
    function buildStandardQueryForPreview(queryOptions, userId, serverUrl) {
        if (window.apiHelper && window.apiHelper.buildStandardQuery) {
            return window.apiHelper.buildStandardQuery(queryOptions, userId, serverUrl);
        }
        // Fallback if apiHelper not available
        // Fields that require pipe delimiter instead of comma
        const PIPE_DELIMITED_FIELDS = ['Genres', 'Tags', 'OfficialRatings', 'Studios', 'Artists', 'ExcludeArtistsIds', 'Albums', 'AlbumIds', 'StudioIds', 'GenreIds'];
        
        const params = new URLSearchParams({
            Recursive: 'true',
            Fields: 'PrimaryImageAspectRatio,DateCreated,Overview,Taglines,ProductionYear,RecursiveItemCount,ChildCount,UserData',
            ImageTypeLimit: '1',
            UserId: userId
        });

        Object.entries(queryOptions || {}).forEach(([key, value]) => {
            if (value !== undefined && value !== null) {
                if (Array.isArray(value)) {
                    // Use pipe delimiter for specific fields, comma for others
                    const delimiter = PIPE_DELIMITED_FIELDS.includes(key) ? '|' : ',';
                    params.set(key, value.join(delimiter));
                } else {
                    params.set(key, value);
                }
            }
        });

        return `${serverUrl}/Items?${params.toString()}`;
    }

    /**
     * Build custom endpoint URL for preview
     * Uses shared apiHelper.buildQueryFromSection for consistency
     */
    function buildCustomEndpointForPreview(path, queryOptions, userId, serverUrl) {
        if (window.apiHelper && window.apiHelper.buildCustomEndpoint) {
            return window.apiHelper.buildCustomEndpoint(path, queryOptions, userId, serverUrl);
        }
        // Fallback if apiHelper not available
        // Fields that require pipe delimiter instead of comma
        const PIPE_DELIMITED_FIELDS = ['Genres', 'Tags', 'OfficialRatings', 'Studios', 'Artists', 'ExcludeArtistsIds', 'Albums', 'AlbumIds', 'StudioIds', 'GenreIds'];
        
        const params = new URLSearchParams({
            UserId: userId
        });

        Object.entries(queryOptions || {}).forEach(([key, value]) => {
            if (value !== undefined && value !== null) {
                if (Array.isArray(value)) {
                    // Use pipe delimiter for specific fields, comma for others
                    const delimiter = PIPE_DELIMITED_FIELDS.includes(key) ? '|' : ',';
                    params.set(key, value.join(delimiter));
                } else {
                    params.set(key, value);
                }
            }
        });

        if (!params.has('Fields')) {
            params.set('Fields', 'PrimaryImageAspectRatio,DateCreated,MediaSourceCount,UserData');
        }
        if (!params.has('ImageTypeLimit')) {
            params.set('ImageTypeLimit', '1');
        }
        if (!params.has('EnableTotalRecordCount')) {
            params.set('EnableTotalRecordCount', 'false');
        }

        return `${serverUrl}${path}?${params.toString()}`;
    }
    
    window.KefinTweaksFeatureConfigs = window.KefinTweaksFeatureConfigs || {};
    window.KefinTweaksFeatureConfigs.homeScreen = { openConfigModal };

    // Export getConfig for use by other scripts
    window.KefinHomeScreen = window.KefinHomeScreen || {};
    window.KefinHomeScreen.getConfig = getConfig;

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
    setTimeout(loadUserConfigurationScript, 100);
    
})();