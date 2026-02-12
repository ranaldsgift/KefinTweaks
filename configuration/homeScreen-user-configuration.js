// KefinTweaks User Home Screen Configuration
// Allows users to customize their home screen by re-ordering and enabling/disabling sections

(function() {
    'use strict';

    const LOG = (...args) => console.log('[KefinTweaks User HomeScreen Config]', ...args);
    const WARN = (...args) => console.warn('[KefinTweaks User HomeScreen Config]', ...args);
    const ERR = (...args) => console.error('[KefinTweaks User HomeScreen Config]', ...args);

    // All Jellyfin home section base IDs (homesection0-8)
    const JELLYFIN_HOME_SECTIONS = [
        'smalllibrarytiles',
        'librarybuttons',
        'resume',
        'resumeaudio',
        'resumebook',
        'nextup',
        'latestmedia',
        'livetv',
        'activerecordings'
    ];

    // Map Jellyfin sections to their KefinTweaks equivalents
    // When a KefinTweaks section exists, it replaces the Jellyfin section in the UI
    const JELLYFIN_HOME_SECTIONS_MAP = {
        'resume': 'continueWatching',
        'nextup': 'nextUp',
        'latestmedia': 'recently-added*' // Pattern match - any section starting with 'recently-added-'
    };

    /**
     * Flatten section groups into a flat array
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
     * Get Jellyfin default sections from display preferences
     */
    function getJellyfinSectionsFromPrefs(displayPrefs) {
        const sections = [];
        const customPrefs = displayPrefs?.CustomPrefs || {};
        
        // Build a set of all base IDs that appear in any homesectionN field (0-8)
        const enabledBaseIds = new Set();
        for (let i = 0; i <= 8; i++) {
            const homesectionValue = customPrefs[`homesection${i}`];
            if (homesectionValue && homesectionValue !== '' && homesectionValue !== 'none') {
                enabledBaseIds.add(homesectionValue);
            }
        }
        
        // Parse kefinHomeScreen if it's a string (Jellyfin stores CustomPrefs as strings)
        let kefinHomeScreen = [];
        if (customPrefs.kefinHomeScreen) {
            if (typeof customPrefs.kefinHomeScreen === 'string') {
                try {
                    kefinHomeScreen = JSON.parse(customPrefs.kefinHomeScreen);
                } catch (e) {
                    // Ignore parse errors, use empty array
                }
            } else if (Array.isArray(customPrefs.kefinHomeScreen)) {
                kefinHomeScreen = customPrefs.kefinHomeScreen;
            }
        }
        
        // Process each Jellyfin section
        JELLYFIN_HOME_SECTIONS.forEach((baseId, index) => {
            const homesectionKey = `homesection${index}`;
            
            // Section is enabled if its base ID appears in ANY homesectionN field (0-8)
            const isEnabled = enabledBaseIds.has(baseId);
            
            // Get order and enabled status from kefinHomeScreen if available
            let order = 0;
            let enabledFromPrefs = isEnabled; // Default to homesectionN value
            
            if (Array.isArray(kefinHomeScreen) && kefinHomeScreen.length > 0) {
                // Look for section by base ID (new format) or homesectionKey (old format for backward compatibility)
                const sectionPref = kefinHomeScreen.find(s => 
                    s.id === baseId || s.id === homesectionKey
                );
                if (sectionPref) {
                    if (sectionPref.order !== undefined) {
                        order = sectionPref.order;
                    }
                    if (sectionPref.enabled !== undefined) {
                        enabledFromPrefs = sectionPref.enabled;
                    }
                }
            }
            
            sections.push({
                id: baseId, // Use base ID directly, no -jellyfin suffix
                name: getJellyfinSectionName(baseId),
                enabled: enabledFromPrefs,
                order: order,
                hidden: false,
                isJellyfin: true,
                jellyfinBaseId: baseId, // Track the Jellyfin base ID
                homesectionKey: homesectionKey // Keep for backward compatibility
            });
        });
        
        return sections;
    }

    /**
     * Get display name for Jellyfin section
     */
    function getJellyfinSectionName(baseId) {
        const names = {
            'smalllibrarytiles': 'My Media',
            'librarybuttons': 'My Media (small)',
            'resume': 'Resume',
            'resumeaudio': 'Resume Audio',
            'resumebook': 'Resume Book',
            'nextup': 'Next Up',
            'latestmedia': 'Latest Media',
            'livetv': 'Live TV',
            'activerecordings': 'Active Recordings'
        };
        return names[baseId] || baseId;
    }

    /**
     * Load user preferences from display preferences
     * @param {Object} displayPrefs - Optional display preferences object to use instead of fetching
     */
    async function loadUserPreferences(displayPrefs = null) {
        try {
            if (!displayPrefs) {
                if (!window.userHelper || !window.userHelper.getUserDisplayPreferences) {
                    WARN('userHelper not available');
                    return { kefinHomeScreen: [], homesections: {} };
                }

                const { promise } = await window.userHelper.getUserDisplayPreferences();
                displayPrefs = await promise;
            }
            
            if (!displayPrefs || !displayPrefs.CustomPrefs) {
                return { kefinHomeScreen: [], homesections: {} };
            }

            const customPrefs = displayPrefs.CustomPrefs;
            let kefinHomeScreen = [];
            
            // kefinHomeScreen is stored as a JSON string in CustomPrefs
            if (customPrefs.kefinHomeScreen) {
                if (typeof customPrefs.kefinHomeScreen === 'string') {
                    try {
                        kefinHomeScreen = JSON.parse(customPrefs.kefinHomeScreen);
                    } catch (e) {
                        WARN('Failed to parse kefinHomeScreen:', e);
                        kefinHomeScreen = [];
                    }
                } else if (Array.isArray(customPrefs.kefinHomeScreen)) {
                    // Handle legacy format (direct array)
                    kefinHomeScreen = customPrefs.kefinHomeScreen;
                }
            }
            
            // Extract homesectionN values
            const homesections = {};
            for (let i = 0; i <= 8; i++) {
                const key = `homesection${i}`;
                homesections[key] = customPrefs[key] || 'none';
            }

            return {
                kefinHomeScreen: Array.isArray(kefinHomeScreen) ? kefinHomeScreen : [],
                homesections: homesections
            };
        } catch (error) {
            ERR('Error loading user preferences:', error);
            return { kefinHomeScreen: [], homesections: {} };
        }
    }

    /**
     * Merge user preferences with sections
     * @param {Array} sections - Sections from config
     * @param {Object} userPrefs - User preferences object
     * @param {Object} mergedConfig - Merged config from getConfig() for fallback defaults
     * @param {Object} displayPrefs - Display preferences object to check homesectionN fields
     */
    function mergeUserPreferences(sections, userPrefs, mergedConfig = null, displayPrefs = null) {
        const kefinHomeScreen = userPrefs.kefinHomeScreen || [];
        const customPrefs = displayPrefs?.CustomPrefs || {};
        
        // Create maps of section-id -> order and enabled status
        const orderMap = new Map();
        const enabledMap = new Map();
        kefinHomeScreen.forEach(pref => {
            if (pref.id) {
                if (pref.order !== undefined) {
                    orderMap.set(pref.id, pref.order);
                }
                if (pref.enabled !== undefined) {
                    enabledMap.set(pref.id, pref.enabled);
                }
            }
        });

        // Build set of base IDs that appear in ANY homesectionN field (0-8) for Jellyfin sections
        const enabledJellyfinBaseIds = new Set();
        for (let i = 0; i <= 8; i++) {
            const homesectionValue = customPrefs[`homesection${i}`];
            if (homesectionValue && homesectionValue !== '' && homesectionValue !== 'none') {
                enabledJellyfinBaseIds.add(homesectionValue);
            }
        }

        // Helper to get default enabled status from config
        const getDefaultEnabled = (sectionId) => {
            if (!mergedConfig) return true; // Default to enabled if no config
            
            // Search through all section groups
            const allGroups = [
                ...(mergedConfig.HOME_SECTION_GROUPS || []),
                ...(mergedConfig.SEASONAL_SECTION_GROUPS || []),
                ...(mergedConfig.DISCOVERY_SECTION_GROUPS || []),
                ...(mergedConfig.CUSTOM_SECTION_GROUPS || [])
            ];
            
            for (const group of allGroups) {
                if (group.sections) {
                    const section = group.sections.find(s => s.id === sectionId);
                    if (section) {
                        return section.enabled !== false;
                    }
                }
            }
            
            return true; // Default to enabled if not found
        };

        // Helper to check if a section ID is a Jellyfin section
        const isJellyfinSection = (sectionId) => {
            return JELLYFIN_HOME_SECTIONS.includes(sectionId);
        };

        // Helper to get the Jellyfin base ID for a KefinTweaks section that maps to Jellyfin
        const getMappedJellyfinId = (sectionId) => {
            // Check if this KefinTweaks section maps to a Jellyfin section
            for (const [jellyfinId, kefinId] of Object.entries(JELLYFIN_HOME_SECTIONS_MAP)) {
                if (jellyfinId === 'latestmedia' && sectionId.startsWith('recently-added-')) {
                    return jellyfinId;
                }
                if (kefinId === sectionId) {
                    return jellyfinId;
                }
            }
            return null;
        };

        // Update sections with user preferences
        return sections.map(section => {
            const sectionId = section.id;
            let isEnabled;
            
            // For Jellyfin sections, check if base ID appears in any homesectionN field
            if (section.isJellyfin || isJellyfinSection(sectionId)) {
                const baseId = section.jellyfinBaseId || sectionId;
                isEnabled = enabledJellyfinBaseIds.has(baseId);
            } else {
                // For KefinTweaks sections, check if user has explicit enabled/disabled preference, otherwise use default from config
                // But also check homesectionN if this section maps to a Jellyfin section
                const mappedJellyfinId = getMappedJellyfinId(sectionId);
                if (mappedJellyfinId && enabledJellyfinBaseIds.has(mappedJellyfinId)) {
                    // If mapped Jellyfin section is enabled in homesectionN, use that
                    isEnabled = true;
                } else {
                    const hasUserEnabledPref = enabledMap.has(sectionId);
                    isEnabled = hasUserEnabledPref 
                        ? enabledMap.get(sectionId)
                        : getDefaultEnabled(sectionId);
                }
            }
            
            const userOrder = orderMap.get(sectionId);
            
            return {
                ...section,
                enabled: isEnabled,
                order: userOrder !== undefined ? userOrder : (section.order || 0)
            };
        });
    }

    /**
     * Save user preferences to display preferences
     */
    async function saveUserPreferences(sections) {
        try {
            if (!window.userHelper || !window.userHelper.getUserDisplayPreferences || !window.userHelper.updateDisplayPreferences) {
                ERR('userHelper not available');
                return false;
            }

            // Get current display preferences
            const { promise } = await window.userHelper.getUserDisplayPreferences();
            const displayPrefs = await promise;
            
            if (!displayPrefs) {
                ERR('Could not load display preferences');
                return false;
            }

            if (!displayPrefs.CustomPrefs) {
                displayPrefs.CustomPrefs = {};
            }

            const customPrefs = displayPrefs.CustomPrefs;

            // Helper to check if a section ID is a Jellyfin section
            const isJellyfinSection = (sectionId) => {
                if (JELLYFIN_HOME_SECTIONS.includes(sectionId)) {
                    return true;
                }
                return getMappedJellyfinId(sectionId) !== null;
            };

            // Helper to get the Jellyfin base ID for a KefinTweaks section that maps to Jellyfin
            const getMappedJellyfinId = (sectionId) => {
                for (const [jellyfinId, kefinId] of Object.entries(JELLYFIN_HOME_SECTIONS_MAP)) {
                    if (jellyfinId === 'latestmedia' && sectionId.startsWith('recently-added-')) {
                        return jellyfinId;
                    }
                    if (kefinId === sectionId) {
                        return jellyfinId;
                    }
                }
                return null;
            };

            // Build kefinHomeScreen array with all sections (including enabled status)
            // Use section IDs directly, no homesectionKey
            const kefinHomeScreen = sections.map(section => ({
                id: section.id,
                order: section.order || 0,
                enabled: section.enabled !== false
            }));

            // Jellyfin expects CustomPrefs values to be JSON strings
            customPrefs.kefinHomeScreen = JSON.stringify(kefinHomeScreen);

            // Update homesectionN properties for Jellyfin sections
            // First, clear all homesectionN (0-9)
            for (let i = 0; i <= 9; i++) {
                customPrefs[`homesection${i}`] = 'none';
            }

            // Collect sections that should be saved to homesectionN fields
            const sectionsForHomesectionN = [];

            // Add non-mapped Jellyfin sections
            sections.forEach(section => {
                if (section.enabled === true && (section.isJellyfin || isJellyfinSection(section.id) || section.mapsToJellyfin)) {
                    const baseId = section.mapsToJellyfin || section.jellyfinBaseId || section.id;
                    sectionsForHomesectionN.push({
                        jellyfinBaseId: baseId,
                        order: section.order || 0
                    });
                }
                if (section.enabled === true && section.id === 'continueWatchingAndNextUp') {
                    sectionsForHomesectionN.push({
                        jellyfinBaseId: 'resume',
                        order: section.order || 0
                    });
                    sectionsForHomesectionN.push({
                        jellyfinBaseId: 'nextup',
                        order: section.order || 0
                    });
                }
            });

            // Ensure each section has a unique jellyfinBaseId
            const uniqueHomeSections = sectionsForHomesectionN.filter((section, index, self) =>
                index === self.findIndex(s => s.jellyfinBaseId === section.jellyfinBaseId)
            );

            // Sort all sections by order
            uniqueHomeSections.sort((a, b) => (a.order || 0) - (b.order || 0));

            // Assign each section to homesectionN sequentially
            for (let i = 0; i <= 9; i++) {
                const selectHomeSection = document.querySelector(`.homeScreenSettingsContainer #selectHomeSection${i+1}`);
                if (i <= uniqueHomeSections.length - 1) {
                    const selectedSection = uniqueHomeSections[i].jellyfinBaseId;
                    customPrefs[`homesection${i}`] = selectedSection;

                    const selectedOption = selectHomeSection.querySelector(`option[value="${selectedSection}"]`);
                    if (selectedOption) {
                        selectHomeSection.value = selectedOption.value;
                    } else {
                        selectHomeSection.value = '';
                    }
                } else {
                    customPrefs[`homesection${i}`] = 'none';

                    // Find the value of the "None" option label, some have value="none" and some have no value at all
                    const noneOption = selectHomeSection.querySelector('option[value="none"]');
                    if (noneOption) {
                        selectHomeSection.value = noneOption.value;
                    } else {
                        selectHomeSection.value = '';
                    }
                }
            }

            // Save
            const success = await window.userHelper.updateDisplayPreferences(displayPrefs);
            if (success) {
                LOG('User preferences saved successfully');
            } else {
                ERR('Failed to save user preferences');
            }
            return success;
        } catch (error) {
            ERR('Error saving user preferences:', error);
            return false;
        }
    }

    /**
     * Render user home sections editor
     */
    async function renderUserHomeSectionsEditor(container) {
        if (!container) {
            ERR('Container not provided');
            return;
        }

        try {
            // Check dependencies
            if (!window.KefinHomeScreen || !window.KefinHomeScreen.getConfig) {
                ERR('KefinHomeScreen.getConfig not available');
                return;
            }

            if (!window.KefinTweaksUI || !window.KefinTweaksUI.renderHomeSectionsOrderEditor) {
                ERR('KefinTweaksUI.renderHomeSectionsOrderEditor not available');
                return;
            }

            // Get merged config
            const mergedConfig = await window.KefinHomeScreen.getConfig();
            
            // Flatten all section groups
            const allGroups = [
                ...(mergedConfig.HOME_SECTION_GROUPS || []),
                ...(mergedConfig.SEASONAL_SECTION_GROUPS || []),
                /* ...(mergedConfig.DISCOVERY_SECTION_GROUPS || []), */
                ...(mergedConfig.CUSTOM_SECTION_GROUPS || [])
            ];
            
            let kefinSections = flattenSectionGroups(allGroups);
            
            // Filter out hidden sections
            kefinSections = kefinSections.filter(s => !s.hidden);

            // Filter out disabled sections
            kefinSections = kefinSections.filter(s => s.enabled !== false);

            // Filter out discovery sections
            kefinSections = kefinSections.filter(s => s.type !== 'discovery');

            // Filter out discovery sections
            kefinSections = kefinSections.filter(s => s.discoveryEnabled !== true);

            // Get display preferences once
            if (!window.userHelper || !window.userHelper.getUserDisplayPreferences) {
                ERR('userHelper not available');
                container.innerHTML = '<div class="listItemBodyText secondary">User helper not available.</div>';
                return;
            }

            const { promise } = await window.userHelper.getUserDisplayPreferences();
            const displayPrefs = await promise;
            
            // Load user preferences using the fetched displayPrefs
            const userPrefs = await loadUserPreferences(displayPrefs);
            
            // Get Jellyfin sections from display preferences
            let jellyfinSections = getJellyfinSectionsFromPrefs(displayPrefs);

            // Mark KefinTweaks sections that map to Jellyfin sections
            kefinSections = kefinSections.map(section => {
                const mappedJellyfinId = Object.entries(JELLYFIN_HOME_SECTIONS_MAP).find(([jellyfinId, kefinId]) => {
                    if (jellyfinId === 'latestmedia' && section.id && section.id.startsWith('recently-added-')) {
                        return true;
                    }
                    return kefinId === section.id;
                });
                
                if (mappedJellyfinId) {
                    return {
                        ...section,
                        mapsToJellyfin: mappedJellyfinId[0] // Store the Jellyfin base ID
                    };
                }
                return section;
            });

            // Filter out mapped Jellyfin sections if their KefinTweaks equivalent exists
            const kefinSectionIds = new Set(kefinSections.map(s => s.id));

            const adminKefinSections = window.KefinHomeScreen.getConfig().ENABLED_NORMAL_SECTIONS;
            const isKefinNextUpEnabled = adminKefinSections.some(s => s.id && s.id === 'nextUp' && s.enabled === true);
            const isKefinContinueWatchingEnabled = adminKefinSections.some(s => s.id && s.id === 'continueWatching' && s.enabled === true);
            const isKefinMergeNextUpEnabled = adminKefinSections.some(s => s.id && s.id === 'continueWatchingAndNextUp' && s.enabled === true);
            const isKefinRecentlyAddedEnabled = adminKefinSections.some(s => s.id && s.id.startsWith('recently-added-') && s.enabled === true);

            jellyfinSections = jellyfinSections.filter(jellyfinSection => {
                const baseId = jellyfinSection.jellyfinBaseId || jellyfinSection.id;
                const mappedKefinId = JELLYFIN_HOME_SECTIONS_MAP[baseId];
                
                // For latestmedia, check if any recently-added-* section exists
                if (baseId === 'latestmedia') {
                    return !isKefinRecentlyAddedEnabled; // Remove if any recently-added exists
                }

                if (baseId === 'nextup') {
                    return !isKefinNextUpEnabled && !isKefinMergeNextUpEnabled;
                }

                if (baseId === 'resume') {
                    return !isKefinContinueWatchingEnabled && !isKefinMergeNextUpEnabled;
                }
                
                // For other mapped sections, check if the mapped KefinTweaks section exists
                if (mappedKefinId) {
                    return !kefinSectionIds.has(mappedKefinId); // Remove if mapped Kefin section exists
                }
                
                return true; // Keep non-mapped sections
            });

            // Combine all sections
            let allSections = [...kefinSections, ...jellyfinSections];

            // Merge user preferences (pass mergedConfig for fallback defaults and displayPrefs for homesectionN checks)
            allSections = mergeUserPreferences(allSections, userPrefs, mergedConfig, displayPrefs);

            // Sort by order
            allSections.sort((a, b) => (a.order || 0) - (b.order || 0));

            // Set any section types that aren't "seasonal" to "home"
            allSections.forEach(section => {
                if (section.type && section.type.toLowerCase() !== 'seasonal') {
                    section.type = 'home';
                }
            });

            // Create editor HTML
            const editorHTML = window.KefinTweaksUI.renderHomeSectionsOrderEditor(allSections, {
                showUpDownButtons: true
            });

            container.innerHTML = `
                <div class="verticalSection verticalSection-extrabottompadding">
                    <h2 class="sectionTitle">Home Sections Order</h2>
                    ${editorHTML}
                </div>
            `;

            // Setup event listeners
            // Find the sections-container which wraps both enabled and disabled lists
            const editorContainer = container.querySelector('.sections-container') || container.querySelector('.group-sections-list');
            if (editorContainer && window.KefinTweaksUI.setupOrderEditorListeners) {
                // Track current section state
                let currentSections = [...allSections];
                let isSaving = false;

                // Extract save logic into reusable function
                const performSave = async () => {
                    if (isSaving) return; // Prevent concurrent saves
                    isSaving = true;
                    
                    try {
                        // Read DOM order and update sections array
                        // Only read order from enabled sections list (disabled sections preserve their order)
                        const enabledList = container.querySelector('.enabled-sections-list') || editorContainer.querySelector('.enabled-sections-list');
                        const sectionIdToOrder = new Map();
                        
                        if (enabledList) {
                            // Get all section rows in enabled list in their current DOM order
                            const sectionRows = Array.from(enabledList.querySelectorAll('.section-row'));
                            
                            // Assign order values starting from 1, incrementing by 1 for each section in DOM order
                            sectionRows.forEach((row, index) => {
                                const sectionId = row.dataset.sectionId;
                                if (sectionId) {
                                    sectionIdToOrder.set(sectionId, index + 1);
                                }
                            });
                        }
                        
                        // Update order values in currentSections based on DOM order (only for enabled sections)
                        currentSections.forEach(section => {
                            const domOrder = sectionIdToOrder.get(section.id);
                            if (domOrder !== undefined) {
                                // Only update order if section is in enabled list
                                section.order = domOrder;
                            }
                            // Disabled sections keep their existing order value (not updated)
                        });
                        
                        await saveUserPreferences(currentSections);
                    } finally {
                        isSaving = false;
                    }
                };

                const handleToggleChange = async (sectionId, enabled) => {
                    const section = currentSections.find(s => (s.id || '') === sectionId);
                    if (section) {
                        section.enabled = enabled;
                    }
                    // Auto-save when toggle changes
                    await performSave();
                };

                // Setup listeners with auto-save on order changes
                window.KefinTweaksUI.setupOrderEditorListeners(editorContainer, {
                    onOrderChange: null, // Don't update order values during drag/drop, we'll read from DOM
                    onToggleChange: handleToggleChange,
                    getSectionOrder: null, // Not needed since we're not calculating orders
                    sections: currentSections,
                    onSave: performSave // Pass save function to be called on drag/drop and up/down
                });
            }

            LOG('User home sections editor rendered');
        } catch (error) {
            ERR('Error rendering user home sections editor:', error);
            container.innerHTML = '<div class="listItemBodyText secondary">Error loading editor. Please refresh the page.</div>';
        }
    }

    // Register onViewPage handler for mypreferenceshome page
    function registerPreferencesPageHandler() {
        if (!window.KefinTweaksUtils || !window.KefinTweaksUtils.onViewPage) {
            setTimeout(registerPreferencesPageHandler, 1000);
            return;
        }

        window.KefinTweaksUtils.onViewPage(async (view, element, hash) => {
            // Check if we're on the mypreferenceshome page
            LOG('Preferences home page detected');

            const form = document.querySelector('.libraryPage:not(.hide) .homeScreenSettingsContainer > form');
            if (form && form.firstChild) {
                // Check if editor already rendered
                if (form.querySelector('#kefin-user-home-sections-editor')) {
                    return;
                }

                // Create container for editor
                const editorContainer = document.createElement('div');
                editorContainer.id = 'kefin-user-home-sections-editor';

                // Insert as last child of the form
                form.appendChild(editorContainer);

                // Render editor
                await renderUserHomeSectionsEditor(editorContainer);
            }
        }, {
            pages: ['mypreferenceshome', 'userpreferences']
        });

        LOG('Registered preferences page handler');
    }

    // Initialize
    registerPreferencesPageHandler();

    // Expose render function globally
    window.KefinUserHomeScreenConfig = {
        renderUserHomeSectionsEditor
    };

    LOG('User Home Screen Configuration loaded');

})();
