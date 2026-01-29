// KefinTweaks UI Utilities
// Shared UI components for configuration interfaces
// Provides badge autocomplete system for Tags, Genres, Collections, Playlists, and Include Item Types

(function() {
    'use strict';

    const LOG = (...args) => console.log('[KefinTweaks UI]', ...args);
    const WARN = (...args) => console.warn('[KefinTweaks UI]', ...args);
    const ERR = (...args) => console.error('[KefinTweaks UI]', ...args);

    /**
     * Badge System - Manages badge creation, addition, removal, and updates
     */
    const BadgeSystem = {
        /**
         * Creates a badge element
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
            
            // Find the badges wrapper div - look for the div with class tag-badge-wrapper
            let badgesWrapper = badgeContainer.querySelector('.tag-badge-wrapper');
            if (!badgesWrapper) {
                // Fallback: look for includeItemTypes-badges (for IncludeItemTypes type)
                badgesWrapper = badgeContainer.querySelector('.includeItemTypes-badges');
            }
            if (!badgesWrapper) {
                // For standard autocomplete, find the div that's a sibling of the input container div
                if (input && input.parentElement) {
                    const inputContainer = input.parentElement;
                    // The badges wrapper is the next sibling div after the input container
                    badgesWrapper = inputContainer.nextElementSibling;
                    // Verify it's a div
                    if (!badgesWrapper || !badgesWrapper.matches('div')) {
                        // Look for any div sibling that might contain badges
                        badgesWrapper = Array.from(badgeContainer.children).find(child => 
                            child.matches('div') && 
                            child !== inputContainer && 
                            (child.querySelector('.tag-badge') || child.style.display === 'flex' || child.style.flexWrap === 'wrap')
                        );
                    }
                }
                // Final fallback
                if (!badgesWrapper) {
                    badgesWrapper = badgeContainer;
                }
            }
            
            const badge = this.createBadge(value, displayText);
            badgesWrapper.appendChild(badge);
            if (input) input.value = '';
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

    /**
     * Creates an autocomplete input with badge system
     * @param {Object} options - Configuration options
     * @param {string} options.type - Type of autocomplete: 'Tag', 'Genre', 'Collection', 'Playlist', 'IncludeItemTypes'
     * @param {string} options.prefix - Prefix for element IDs (e.g., 'query', 'section')
     * @param {string|number} options.sectionIndex - Section/query index for unique IDs
     * @param {HTMLElement} options.container - Container element where the autocomplete will be inserted
     * @param {string} options.label - Label text for the field
     * @param {Array<string>} options.currentValues - Current selected values
     * @param {Array<string>} options.availableTypes - For IncludeItemTypes: list of available types
     * @param {Function} options.onChange - Callback when values change (receives array of values)
     * @returns {Object} - { element: HTMLElement, setup: Function } - The created element and setup function
     */
    function createAutoCompleteInput(options) {
        const {
            type,
            prefix,
            sectionIndex,
            container,
            label = type,
            currentValuesArray = [],
            availableTypes = null,
            includeItemTypes = null,
            onChange = null
        } = options;

        if (!type || !prefix || sectionIndex === undefined || !container) {
            ERR('createAutoCompleteInput: Missing required options (type, prefix, sectionIndex, container)');
            return null;
        }

        const sanitizedPrefix = prefix.replace(/[^a-zA-Z0-9]/g, '_');
        const uniqueId = `${sanitizedPrefix}_${sectionIndex}`;
        
        // Build HTML based on type - all types now use text input with autocomplete
        let html = '';
        const allAvailableItemTypes = availableTypes || [
            'AggregateFolder', 'Audio', 'AudioBook', 'BasePluginFolder', 'Book', 'BoxSet', 'Channel', 
            'ChannelFolderItem', 'CollectionFolder', 'Episode', 'Folder', 'Genre', 'ManualPlaylistsFolder', 
            'Movie', 'LiveTvChannel', 'LiveTvProgram', 'MusicAlbum', 'MusicArtist', 'MusicGenre', 'MusicVideo', 
            'Person', 'Photo', 'PhotoAlbum', 'Playlist', 'PlaylistsFolder', 'Program', 'Recording', 'Season', 
            'Series', 'Studio', 'Trailer', 'TvChannel', 'TvProgram', 'UserRootFolder', 'UserView', 'Video', 'Year'
        ];

        let currentValues = currentValuesArray;
        
        // For IncludeItemTypes, normalize currentValues to strings
        if (type === 'IncludeItemTypes') {
            currentValues = currentValues.map(v => typeof v === 'string' ? v : String(v));
        }
        
        // Tag, Genre, Collection, Playlist, IncludeItemTypes all use text input with autocomplete
        const badgesHtml = currentValues.map(val => {
            const displayText = (type === 'Collection' || type === 'Playlist') && typeof val === 'object' ? val.name : val;
            const value = (type === 'Collection' || type === 'Playlist') && typeof val === 'object' ? val.id : val;
            return `
                <span class="tag-badge" data-value="${value}" ${(type === 'Collection' || type === 'Playlist') ? 'data-loading="true"' : ''} style="display: inline-flex; align-items: center; gap: 0.25em; background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.2); border-radius: 4px; padding: 0.25em 0.5em; margin: 0.25em; font-size: 0.9em;">
                    ${displayText}
                    <button type="button" class="tag-badge-remove" style="background: none; border: none; color: rgba(255,255,255,0.7); cursor: pointer; padding: 0; margin-left: 0.25em; font-size: 1.2em; line-height: 1; display: flex; align-items: center;" title="Remove">×</button>
                </span>
            `;
        }).join('');

        const typeKey = type === 'IncludeItemTypes' ? 'includeItemTypes' : type.toLowerCase();
        const placeholderText = type === 'IncludeItemTypes' ? 'Type to add item type...' : `Type to add ${type.toLowerCase()}...`;

        // Determine if refresh button should be shown (for cached data types)
        const showRefresh = (type === 'Tag' || type === 'Genre' || type === 'Collection' || type === 'Playlist');
        
        // Determine if badges should appear below input (for IncludeItemTypes, Genres, Tags)
        // Check for both singular and plural forms since type may be normalized
        const badgesBelowInput = (type === 'IncludeItemTypes' || type === 'Genres' || type === 'Tags' || type === 'Genre' || type === 'Tag');
        
        html = `
            <div class="${prefix}_${typeKey}_container" data-section-index="${sectionIndex}" style="border: 1px solid rgba(255,255,255,0.1); border-radius: 4px; padding: 0.75em; position: static;">
                <div style="position: relative;">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5em;">
                        <div class="listItemBodyText">${label}</div>
                        <div style="display: flex; gap: 0.5em;">
                            ${showRefresh ? `<button type="button" class="badge-refresh" data-section-index="${sectionIndex}" data-type="${type}" style="background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.2); border-radius: 4px; padding: 0.25em 0.5em; color: rgba(255,255,255,0.87); cursor: pointer; font-size: 0.85em;" title="Refresh Data">🔄</button>` : ''}
                            <button type="button" class="badge-clear-all" data-section-index="${sectionIndex}" data-type="${type}" style="background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.2); border-radius: 4px; padding: 0.25em 0.5em; color: rgba(255,255,255,0.87); cursor: pointer; font-size: 0.85em;" title="Clear All">Clear All</button>
                        </div>
                    </div>
                    <div class="tag-badge-container" data-section-index="${sectionIndex}" data-prefix="${prefix}" data-type="${type}" ${type === 'IncludeItemTypes' ? `data-available-types="${allAvailableItemTypes.join(',')}"` : ''} style="min-height: 2.5em; border: 1px solid rgba(255,255,255,0.2); border-radius: 4px; padding: 0.5em; margin-bottom: 0.5em; background: rgba(0,0,0,0.2); ${badgesBelowInput ? 'display: block;' : 'display: flex; gap: 0.5em; align-items: flex-start;'} overflow: hidden; position: relative;">
                        <div style="display: flex; align-items: center; gap: 0.25em; ${badgesBelowInput ? 'width: 100%; margin-bottom: 0.5em;' : 'flex: 0 0 auto; width: 200px; min-width: 200px;'}">
                            <input type="text" class="${prefix}_${typeKey} fld emby-input autocomplete-input" data-section-index="${sectionIndex}" data-prefix="${prefix}" data-type="${type}" placeholder="${placeholderText}" autocomplete="off" style="flex: 1; border: none; background: transparent; outline: none; color: rgba(255,255,255,0.87); padding: 0.25em;">
                            <button type="button" class="autocomplete-chevron" data-section-index="${sectionIndex}" data-type="${type}" style="background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.2); border-radius: 4px; padding: 0.25em; color: rgba(255,255,255,0.87); cursor: pointer; display: flex; align-items: center; justify-content: center; width: 28px; height: 28px;" title="Show All Options">
                                <span class="material-icons" style="font-size: 18px;">keyboard_arrow_down</span>
                            </button>
                        </div>
                        <div class="tag-badge-wrapper" style="${badgesBelowInput ? 'width: 100%;' : 'flex: 1; min-width: 0;'} display: flex; flex-wrap: wrap; gap: 0.25em; align-items: flex-start; overflow-wrap: break-word;">
                            ${badgesHtml}
                        </div>
                    </div>
                    <input type="hidden" class="${prefix}_${typeKey}_hidden" data-section-index="${sectionIndex}" value="${currentValues.map(v => typeof v === 'object' ? v.id : v).join(', ')}">
                    <div class="autocomplete-suggestions" data-section-index="${sectionIndex}" style="display: none; position: absolute; z-index: 10000; background: #1a1a1a !important; color: rgba(255,255,255,0.87) !important; border: 1px solid rgba(255,255,255,0.2); border-radius: 4px; max-height: 200px; overflow-y: auto; margin-top: 2px; width: 100%; box-sizing: border-box; opacity: 1 !important; top: 100%; left: 0;"></div>
                </div>
            </div>
        `;

        // Create wrapper element
        const wrapper = document.createElement('div');
        wrapper.innerHTML = html;
        const element = wrapper.firstElementChild;

        // Setup function to initialize autocomplete behavior
        const setup = async () => {
            // All types now use standard autocomplete (text input)
            return setupStandardAutocomplete(element, prefix, sectionIndex, type, onChange, availableTypes, includeItemTypes);
        };

        return { element, setup };
    }

    /**
     * Setup Include Item Types autocomplete (dropdown with checkboxes)
     */
    async function setupIncludeItemTypesAutocomplete(container, prefix, sectionIndex, availableTypes, onChange) {
        const badgeContainer = container.querySelector('.includeItemTypes-badge-container');
        const toggleButton = badgeContainer?.querySelector('.includeItemTypes-dropdown-toggle');
        const dropdown = badgeContainer?.querySelector('.includeItemTypes-dropdown');
        const checkboxNodes = badgeContainer ? Array.from(badgeContainer.querySelectorAll('.includeItemTypes-option')) : [];
        const proxyInput = container.querySelector(`.${prefix}_includeItemTypes`);
        const hiddenInput = container.querySelector(`.${prefix}_includeItemTypes_hidden`);
        const badgesWrapper = badgeContainer?.querySelector('.includeItemTypes-badges');
        const emptyState = badgeContainer?.querySelector('.includeItemTypes-empty');
        const clearAllBtn = container.querySelector('.badge-clear-all[data-field="includeItemTypes"]');
        const allowedTypeSet = new Set((availableTypes || []).map(type => type.toLowerCase()));
        
        if (!badgeContainer || !dropdown || !proxyInput || !hiddenInput || !badgesWrapper) {
            WARN('IncludeItemTypes autocomplete: Missing required elements');
            return;
        }
        
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
        
        const syncToggleLabel = () => {
            const count = badgesWrapper.querySelectorAll('.tag-badge').length;
            if (toggleButton) {
                const textSpan = toggleButton.querySelector('.includeItemTypes-toggle-label');
                if (textSpan) {
                    textSpan.textContent = count > 0 ? `${count} selected` : 'Select item types';
                }
            }
        };

        const notifyChange = () => {
            if (onChange) {
                const badges = badgesWrapper.querySelectorAll('.tag-badge');
                const values = Array.from(badges).map(badge => badge.getAttribute('data-value')).filter(Boolean);
                onChange(values);
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
                    notifyChange();
                }
            }
        });
        
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
            notifyChange();
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
                notifyChange();
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

    /**
     * Setup standard autocomplete (Tag, Genre, Collection, Playlist)
     */
    async function setupStandardAutocomplete(container, prefix, sectionIndex, type, onChange, availableTypes = null, includeItemTypes = null, forceRefresh = false) {
        const badgeContainer = container.querySelector(`.tag-badge-container[data-type="${type}"]`);
        const input = container.querySelector(`.autocomplete-input[data-type="${type}"]`);
        const suggestionsDiv = container.querySelector(`.autocomplete-suggestions[data-section-index="${sectionIndex}"]`);
        const typeKey = type === 'IncludeItemTypes' ? 'includeItemTypes' : type.toLowerCase();
        const hiddenInput = container.querySelector(`.${prefix}_${typeKey}_hidden`);
        const clearAllBtn = container.querySelector(`.badge-clear-all[data-type="${type}"]`);
        const refreshBtn = container.querySelector(`.badge-refresh[data-type="${type}"]`);
        const chevronBtn = container.querySelector(`.autocomplete-chevron[data-type="${type}"]`);
        
        if (!badgeContainer || !input || !suggestionsDiv) {
            WARN(`Standard autocomplete (${type}): Missing required elements`);
            return;
        }
        
        // Setup badge remove handlers
        badgeContainer.addEventListener('click', (e) => {
            if (e.target.classList.contains('tag-badge-remove') || e.target.closest('.tag-badge-remove')) {
                const badge = e.target.closest('.tag-badge');
                if (badge) {
                    BadgeSystem.removeBadge(prefix, sectionIndex, badge, badgeContainer, hiddenInput);
                    notifyChange();
                }
            }
        });
        
        // Setup clear all button
        if (clearAllBtn) {
            clearAllBtn.addEventListener('click', () => {
                BadgeSystem.clearAll(prefix, sectionIndex, badgeContainer, hiddenInput);
                notifyChange();
            });
        }
        
        // Fetch available options based on type
        let options = [];
        let fetchOptions = async (refresh = false) => {
            // IncludeItemTypes doesn't need API - use provided list, container data attribute, or default
            if (type === 'IncludeItemTypes') {
                // Try to get from parameter first, then from container data attribute, then default
                if (availableTypes && availableTypes.length > 0) {
                    options = availableTypes;
                } else if (badgeContainer && badgeContainer.dataset.availableTypes) {
                    options = badgeContainer.dataset.availableTypes.split(',').map(s => s.trim()).filter(s => s);
                } else {
                    options = [
                        'AggregateFolder', 'Audio', 'AudioBook', 'BasePluginFolder', 'Book', 'BoxSet', 'Channel', 
                        'ChannelFolderItem', 'CollectionFolder', 'Episode', 'Folder', 'Genre', 'ManualPlaylistsFolder', 
                        'Movie', 'LiveTvChannel', 'LiveTvProgram', 'MusicAlbum', 'MusicArtist', 'MusicGenre', 'MusicVideo', 
                        'Person', 'Photo', 'PhotoAlbum', 'Playlist', 'PlaylistsFolder', 'Program', 'Recording', 'Season', 
                        'Series', 'Studio', 'Trailer', 'TvChannel', 'TvProgram', 'UserRootFolder', 'UserView', 'Video', 'Year'
                    ];
                }
            } else {
                // Tag, Genre, Collection, Playlist need API
                try {
                    const userId = window.ApiClient?.getCurrentUserId();
                    const serverAddress = window.ApiClient?.serverAddress();
                    
                    if (!userId || !serverAddress) {
                        WARN('ApiClient not available for fetching options');
                        return;
                    }
                    
                    if (type === 'Tag' || type === 'Genre') {
                        // Use dataHelper.getFilters with includeItemTypes
                        const itemTypes = includeItemTypes || ['Movie'];
                        if (window.dataHelper && window.dataHelper.getFilters) {
                            const filters = await window.dataHelper.getFilters(itemTypes, !refresh, refresh);
                            options = type === 'Tag' ? (filters?.Tags || []) : (filters?.Genres || []);
                        } else {
                            // Fallback to old method
                            const url = `${serverAddress}/Items/Filters?UserId=${userId}&IncludeItemTypes=${Array.isArray(itemTypes) ? itemTypes.join(',') : itemTypes}`;
                            const data = await window.apiHelper?.getData(url, !refresh);
                            options = type === 'Tag' ? (data?.Tags || []) : (data?.Genres || []);
                        }
                    } else if (type === 'Collection' || type === 'Playlist') {
                        // Fetch Collections/Playlists using apiHelper.getQuery with daily cache
                        const itemType = type === 'Playlist' ? 'Playlist' : 'BoxSet,CollectionFolder';
                        const userId = window.ApiClient.getCurrentUserId();
                        const serverAddress = window.ApiClient.serverAddress();
                        const url = `${serverAddress}/Users/${userId}/Items?IncludeItemTypes=${itemType}&Recursive=true&Fields=ItemCounts`;
                        
                        if (window.apiHelper && window.apiHelper.getQuery) {
                            const cacheOptions = {
                                useCache: !refresh,
                                ttl: 24 * 60 * 60 * 1000, // 24 hours
                                forceRefresh: refresh
                            };
                            const data = await window.apiHelper.getQuery(url, cacheOptions);
                            const items = (data && data.data) ? data.data : data;
                            options = (items?.Items || []).map(item => ({
                                id: item.Id,
                                name: item.Name
                            }));
                        } else {
                            // Fallback to getItems
                            const data = await window.apiHelper?.getItems(
                                {
                                    IncludeItemTypes: itemType,
                                    Recursive: true,
                                    Fields: 'ItemCounts'
                                },
                                !refresh,
                                24 * 60 * 60 * 1000 // 24 hours
                            );
                            options = (data?.Items || []).map(item => ({
                                id: item.Id,
                                name: item.Name
                            }));
                        }
                        
                        // Load names for existing badges
                        await loadBadgeNames(container, prefix, sectionIndex, type);
                    }
                } catch (err) {
                    ERR(`Error fetching ${type} options:`, err);
                }
            }
        };
        
        // Initial fetch
        await fetchOptions(forceRefresh);
        
        let currentSuggestions = [];
        let selectedIndex = -1;
        
        const getExistingBadges = () => BadgeSystem.getExistingBadges(badgeContainer);
        
        const notifyChange = () => {
            if (onChange) {
                const badges = badgeContainer.querySelectorAll('.tag-badge');
                const values = Array.from(badges).map(badge => badge.getAttribute('data-value')).filter(Boolean);
                onChange(values);
            }
        };
        
        input.addEventListener('input', (e) => {
            const value = e.target.value.trim();
            if (value.length === 0) {
                suggestionsDiv.style.display = 'none';
                return;
            }
            
            const existing = getExistingBadges();
            
            // Filter options based on type
            if (type === 'Tag' || type === 'Genre' || type === 'IncludeItemTypes') {
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
                    // Fix: IncludeItemTypes is a string, not an object
                    const display = (type === 'Tag' || type === 'Genre' || type === 'IncludeItemTypes') ? opt : opt.name;
                    const dataValue = (type === 'Tag' || type === 'Genre' || type === 'IncludeItemTypes') ? opt : opt.id;
                    return `<div class="autocomplete-suggestion" data-index="${idx}" data-value="${dataValue}" data-display="${display}" style="padding: 0.5em; cursor: pointer; border-left: 3px solid transparent;">${display}</div>`;
                }).join('');
                suggestionsDiv.style.display = 'block';
                selectedIndex = -1;
                // Set up mouse event handlers for each suggestion
                const suggestionItems = suggestionsDiv.querySelectorAll('.autocomplete-suggestion');
                suggestionItems.forEach((item, idx) => {
                    item.addEventListener('mouseenter', () => {
                        selectedIndex = -1;
                        updateSuggestionHighlight();
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
            notifyChange();
        });
        
        // Function to show all available suggestions (excluding already selected)
        function showAllSuggestions() {
            const existing = getExistingBadges();
            
            // Filter options based on type, excluding already selected
            if (type === 'Tag' || type === 'Genre' || type === 'IncludeItemTypes') {
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
                    const display = (type === 'Tag' || type === 'Genre' || type === 'IncludeItemTypes') ? opt : opt.name;
                    const dataValue = (type === 'Tag' || type === 'Genre' || type === 'IncludeItemTypes') ? opt : opt.id;
                    return `<div class="autocomplete-suggestion" data-index="${idx}" data-value="${dataValue}" data-display="${display}" style="padding: 0.5em; cursor: pointer; border-left: 3px solid transparent;">${display}</div>`;
                }).join('');
                suggestionsDiv.style.display = 'block';
                selectedIndex = 0;
                updateSuggestionHighlight();
                // Set up mouse event handlers for each suggestion
                const suggestionItems = suggestionsDiv.querySelectorAll('.autocomplete-suggestion');
                suggestionItems.forEach((item, idx) => {
                    item.addEventListener('mouseenter', () => {
                        selectedIndex = -1;
                        updateSuggestionHighlight();
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
                    const value = (type === 'Tag' || type === 'Genre' || type === 'IncludeItemTypes') ? selected : selected.id;
                    const display = (type === 'Tag' || type === 'Genre' || type === 'IncludeItemTypes') ? selected : selected.name;
                    BadgeSystem.addBadge(prefix, sectionIndex, value, display, badgeContainer, input, hiddenInput);
                    suggestionsDiv.style.display = 'none';
                    selectedIndex = -1;
                    notifyChange();
                }
            } else if (e.key === 'Escape') {
                suggestionsDiv.style.display = 'none';
                selectedIndex = -1;
            } else if (e.key === 'Backspace' && input.value === '') {
                const badges = badgeContainer.querySelectorAll('.tag-badge');
                if (badges.length > 0) {
                    const lastBadge = badges[badges.length - 1];
                    BadgeSystem.removeBadge(prefix, sectionIndex, lastBadge, badgeContainer, hiddenInput);
                    notifyChange();
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
        
        // Setup chevron button (triggers dropdown like down arrow)
        if (chevronBtn) {
            chevronBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                // Toggle dropdown: if already open, close it; otherwise open it
                if (suggestionsDiv.style.display === 'block' || suggestionsDiv.style.display === '') {
                    // Dropdown is open, close it
                    suggestionsDiv.style.display = 'none';
                    selectedIndex = -1;
                } else {
                    // Dropdown is closed, open it
                    if (input.value.trim().length === 0) {
                        showAllSuggestions();
                    } else {
                        // Trigger input event to show filtered suggestions
                        input.dispatchEvent(new Event('input', { bubbles: true }));
                    }
                }
            });
        }
        
        // Setup refresh button (bypasses cache)
        if (refreshBtn) {
            refreshBtn.addEventListener('click', async (e) => {
                e.stopPropagation();
                refreshBtn.disabled = true;
                refreshBtn.textContent = '⏳';
                try {
                    await fetchOptions(true); // Force refresh
                    // Re-trigger input to update suggestions if input has value
                    if (input.value.trim().length > 0) {
                        input.dispatchEvent(new Event('input', { bubbles: true }));
                    }
                } catch (err) {
                    ERR(`Error refreshing ${type} options:`, err);
                } finally {
                    refreshBtn.disabled = false;
                    refreshBtn.textContent = '🔄';
                }
            });
        }
    }

    /**
     * Loads and updates badge display text for Collections/Playlists
     * Replaces IDs with names after fetching from API
     */
    async function loadBadgeNames(container, prefix, sectionIndex, type) {
        if (type !== 'Collection' && type !== 'Playlist') return;
        
        const badgeContainer = container.querySelector(
            `.tag-badge-container[data-section-index="${sectionIndex}"][data-type="${type}"]`
        );
        if (!badgeContainer) return;
        
        const badges = badgeContainer.querySelectorAll('.tag-badge[data-loading="true"]');
        if (badges.length === 0) return;
        
        try {
            const itemType = type === 'Playlist' ? 'Playlist' : 'BoxSet,CollectionFolder';
            const data = await window.apiHelper?.getItems(
                {
                    IncludeItemTypes: itemType,
                    Recursive: true,
                    Fields: 'ItemCounts'
                },
                true,
                300000
            );
            
            const items = data?.Items || [];
            const itemMap = new Map(items.map(item => [item.Id, item]));
            
            badges.forEach(badge => {
                const id = badge.getAttribute('data-value');
                const item = itemMap.get(id);
                if (item) {
                    badge.removeAttribute('data-loading');
                    badge.innerHTML = `${item.Name}<button type="button" class="tag-badge-remove" style="background: none; border: none; color: rgba(255,255,255,0.7); cursor: pointer; padding: 0; margin-left: 0.25em; font-size: 1.2em; line-height: 1; display: flex; align-items: center;" title="Remove">×</button>`;
                }
            });
        } catch (err) {
            ERR(`Error loading ${type} names:`, err);
        }
    }

    /**
     * Get section type toggle states from localStorage
     * @returns {Object} Object mapping section types (lowercase) to their enabled state (boolean)
     */
    function getSectionTypeToggleStates() {
        try {
            const stored = localStorage.getItem('kefinTweaks-sectionTypeToggles');
            if (stored) {
                return JSON.parse(stored);
            }
        } catch (e) {
            // Ignore parse errors, return defaults
        }
        return {};
    }

    /**
     * Save section type toggle states to localStorage
     * @param {Object} states - Object mapping section types (lowercase) to their enabled state (boolean)
     */
    function saveSectionTypeToggleStates(states) {
        try {
            localStorage.setItem('kefinTweaks-sectionTypeToggles', JSON.stringify(states));
        } catch (e) {
            // Ignore storage errors (e.g., quota exceeded)
        }
    }

    /**
     * Render section type toggle buttons
     * @param {Array<string>} sectionTypes - Array of unique section types
     * @param {Array<string>} enabledTypes - Array of types that should be initially enabled (defaults to all)
     * @returns {string} HTML string
     */
    function renderSectionTypeToggles(sectionTypes, enabledTypes = null) {
        if (!sectionTypes || sectionTypes.length === 0) return '';
        
        // If enabledTypes not provided, all types are enabled by default
        const enabledSet = enabledTypes ? new Set(enabledTypes.map(t => t.toLowerCase())) : new Set(sectionTypes.map(t => t.toLowerCase()));
        
        // Helper to capitalize first letter for display
        const capitalize = (str) => str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
        
        return `
            <div class="section-type-toggles" style="display: flex; gap: 0.5em; margin-bottom: 1em;">
                ${sectionTypes.map(type => {
                    const typeLower = type.toLowerCase();
                    const isEnabled = enabledSet.has(typeLower);
                    const buttonClasses = `emby-button section-type-toggle-btn raised block${isEnabled ? ' button-submit' : ''}`;
                    return `
                    <button type="button" 
                            class="${buttonClasses}" 
                            data-section-type="${typeLower}"
                            style="padding: 0.5em 1em; font-size: 0.9em;">
                        ${capitalize(typeLower)}
                    </button>
                `;
                }).join('')}
            </div>
        `;
    }

    /**
     * Build toggle slider HTML (simplified version for user editor)
     */
    function buildToggleSliderHTML(checked, sectionId, onToggle) {
        const isEnabled = checked !== false;
        return `
            <button type="button" class="toggle-slider section-toggle-switch" data-section-id="${sectionId}" data-enabled="${isEnabled}" style="
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
                    left: ${isEnabled ? '32px' : '2px'};
                    width: 24px;
                    height: 24px;
                    border-radius: 50%;
                    background: white;
                    transition: left 0.3s ease;
                    box-shadow: 0 2px 4px rgba(0,0,0,0.3);
                "></span>
            </button>
        `;
    }

    /**
     * Build section row HTML for order editor
     */
    function buildSectionRowHTMLForEditor(section, options = {}) {
        const { showUpDownButtons = false, isFirst = false, isLast = false } = options;
        const isEnabled = section.enabled !== false;
        const sectionId = section.id || '';
        const sectionName = section.name || 'Unnamed Section';
        const isJellyfin = sectionId.endsWith('-jellyfin') || section.isJellyfin === true;
        
        // Determine section type (always lowercase for consistency with CSS)
        let sectionType = section.type ? section.type.toLowerCase() : null;
        if (!sectionType) {
            sectionType = 'home';
        }

        // Disabled sections should not be draggable
        const draggableAttr = isEnabled ? 'draggable="true"' : '';

        // Build data attributes for first/last state
        const dataAttrs = [];
        if (isFirst) dataAttrs.push('data-is-first="true"');
        if (isLast) dataAttrs.push('data-is-last="true"');
        const dataAttrsStr = dataAttrs.join(' ');

        return `
            <div class="listItem viewItem section-row" data-section-id="${sectionId}" data-section-type="${sectionType}" ${draggableAttr} ${dataAttrsStr}>
                <span class="material-icons drag_handle"></span>
                ${buildToggleSliderHTML(isEnabled, sectionId)}
                <div class="listItemBody">
                    <div style="display: flex; align-items: center; gap: 0.5em;">
                        <span>${sectionName.replace(/"/g, '&quot;')}</span>
                    </div>
                </div>
                ${showUpDownButtons ? `
                    <button type="button" is="paper-icon-button-light" class="btnViewItemUp btnViewItemMove autoSize paper-icon-button-light section-move-up-btn" data-section-id="${sectionId}" title="Up">
                        <span class="material-icons keyboard_arrow_up" aria-hidden="true"></span>
                    </button>
                    <button type="button" is="paper-icon-button-light" class="btnViewItemDown btnViewItemMove autoSize paper-icon-button-light section-move-down-btn" data-section-id="${sectionId}" title="Down">
                        <span class="material-icons keyboard_arrow_down" aria-hidden="true"></span>
                    </button>
                ` : ''}
            </div>
        `;
    }

    /**
     * Build group HTML for order editor
     * @param {Array} enabledSections - Enabled sections to render in reorderable list
     * @param {Array} disabledSections - Disabled sections to render in non-reorderable list
     * @param {Object} options - Options object
     */
    function buildGroupHTMLForEditor(enabledSections, disabledSections = [], options = {}) {
        const { showUpDownButtons = false } = options;
        
        const sortedEnabled = [...(enabledSections || [])].sort((a, b) => (a.order || 0) - (b.order || 0));
        const sortedDisabled = [...(disabledSections || [])].sort((a, b) => (a.order || 0) - (b.order || 0));

        let html = '';
        
        // Enabled sections list (reorderable)
        if (sortedEnabled.length > 0) {
            html += `
                <div class="paperList viewOrderList enabled-sections-list">
                    ${sortedEnabled.map((section, index) => 
                        buildSectionRowHTMLForEditor(section, {
                            showUpDownButtons,
                            isFirst: index === 0,
                            isLast: index === sortedEnabled.length - 1
                        })
                    ).join('')}
                </div>
            `;
        }
        
        // Disabled sections list (non-reorderable)
        // Buttons are always rendered, CSS hides them for disabled sections
        if (sortedDisabled.length > 0) {
            html += `
                <div style="margin-top: 2em;">
                    <div class="listItemBodyText" style="font-weight: 500; margin-bottom: 0.75em; opacity: 0.7;">Disabled Sections</div>
                    <div class="paperList viewOrderList disabled-sections-list">
                        ${sortedDisabled.map((section) => 
                            buildSectionRowHTMLForEditor(section, {
                                showUpDownButtons: showUpDownButtons, // Use same setting as enabled sections
                                isFirst: false,
                                isLast: false
                            })
                        ).join('')}
                    </div>
                </div>
            `;
        }
        
        return html;
    }

    /**
     * Calculate new order with enhanced logic for same-order sections
     */
    function calculateNewOrderEnhanced(draggedElement, targetElement, dropPosition, getSectionOrder) {
        const container = targetElement.parentElement;
        const allRows = Array.from(container.querySelectorAll('.section-row'));
        
        // Find the target's position in the DOM
        const targetIndex = allRows.indexOf(targetElement);
        const draggedIndex = allRows.indexOf(draggedElement);
        
        if (dropPosition === 'above') {
            // Dropped above target element
            if (targetIndex === 0) {
                // Dropped at the beginning - use first section order - 1
                const firstSectionId = targetElement.dataset.sectionId;
                const firstOrder = getSectionOrder(firstSectionId);
                return Math.max(0, firstOrder - 1);
            } else {
                // Get preceding and following sections
                const precedingElement = allRows[targetIndex - 1];
                const followingElement = targetElement;
                
                if (precedingElement && followingElement) {
                    const precedingId = precedingElement.dataset.sectionId;
                    const followingId = followingElement.dataset.sectionId;
                    const precedingOrder = getSectionOrder(precedingId);
                    const followingOrder = getSectionOrder(followingId);
                    
                    // If same order, use that order
                    if (precedingOrder === followingOrder) {
                        return precedingOrder;
                    }
                }
                
                // Different orders or missing - use target's order - 1
                const targetSectionId = targetElement.dataset.sectionId;
                const targetOrder = getSectionOrder(targetSectionId);
                return Math.max(0, targetOrder - 1);
            }
        } else {
            // dropPosition === 'below'
            if (targetIndex === allRows.length - 1) {
                // Dropped at the end - use last section order + 1
                const lastSectionId = targetElement.dataset.sectionId;
                const lastOrder = getSectionOrder(lastSectionId);
                return lastOrder + 1;
            } else {
                // Get preceding and following sections
                const precedingElement = targetElement;
                const followingElement = allRows[targetIndex + 1];
                
                if (precedingElement && followingElement && followingElement !== draggedElement) {
                    const precedingId = precedingElement.dataset.sectionId;
                    const followingId = followingElement.dataset.sectionId;
                    const precedingOrder = getSectionOrder(precedingId);
                    const followingOrder = getSectionOrder(followingId);
                    
                    // If same order, use that order
                    if (precedingOrder === followingOrder) {
                        return precedingOrder;
                    }
                }
                
                // Different orders or missing - use following section order - 1, or preceding + 1
                if (followingElement && followingElement !== draggedElement) {
                    const nextSectionId = followingElement.dataset.sectionId;
                    const nextOrder = getSectionOrder(nextSectionId);
                    return Math.max(0, nextOrder - 1);
                } else {
                    const targetSectionId = targetElement.dataset.sectionId;
                    const targetOrder = getSectionOrder(targetSectionId);
                    return targetOrder + 1;
                }
            }
        }
    }

    /**
     * Render home sections order editor
     * @param {Array} sections - Array of section objects
     * @param {Object} options - Options object
     * @param {boolean} options.showUpDownButtons - Show up/down buttons on hover
     * @param {Function} options.onOrderChange - Callback when order changes (sectionId, newOrder)
     * @param {Function} options.onToggleChange - Callback when toggle changes (sectionId, enabled)
     * @param {Function} options.getSectionOrder - Function to get current order of a section
     * @returns {string} HTML string
     */
    function renderHomeSectionsOrderEditor(sections, options = {}) {
        if (!sections || !Array.isArray(sections)) {
            return '<div class="listItemBodyText secondary">No sections found.</div>';
        }

        const {
            showUpDownButtons = false,
            onOrderChange = null,
            onToggleChange = null,
            getSectionOrder = (id) => {
                const section = sections.find(s => (s.id || '') === id);
                return section?.order || 0;
            }
        } = options;

        const filteredSections = sections.filter(s => !s.hidden);

        // Determine section types for each section and collect unique types
        const sectionTypesSet = new Set();
        const sectionsWithTypes = filteredSections.map(section => {
            let sectionType = section.type;
            if (!sectionType) {
                sectionType = 'home';
            }
            sectionTypesSet.add(sectionType);
            return { ...section, _computedType: sectionType };
        });

        // Split into enabled and disabled sections
        const enabledSections = sectionsWithTypes.filter(s => s.enabled !== false);
        const disabledSections = sectionsWithTypes.filter(s => s.enabled === false);

        if (enabledSections.length === 0 && disabledSections.length === 0) {
            return '<div class="listItemBodyText secondary">No sections to order.</div>';
        }

        // Get unique section types (sorted for consistent display) all in lowercase
        const renderedSectionTypes = Array.from(sectionTypesSet).sort().map(type => type.toLowerCase());

        // Preferred Section Types order in array: Jellyfin, Home, Seasonal, Discovery, Custom
        let sectionTypes = ['jellyfin', 'home', 'seasonal', 'discovery', 'custom'];
        sectionTypes = sectionTypes.filter(type => renderedSectionTypes.includes(type));

        // Load saved toggle states from localStorage
        const savedToggleStates = getSectionTypeToggleStates();
        
        // Build data attributes for type filtering
        // Use saved states if available, otherwise use defaults (seasonal = false, others = true)
        const typeFilterAttrs = sectionTypes.map(type => {
            const typeLower = type.toLowerCase();
            // Check if we have a saved state for this type
            const hasSavedState = savedToggleStates.hasOwnProperty(typeLower);
            let isEnabled;
            if (hasSavedState) {
                // Use saved state
                isEnabled = savedToggleStates[typeLower] ? 'true' : 'false';
            } else {
                // Use default: seasonal is hidden by default, all others are visible
                isEnabled = typeLower === 'seasonal' ? 'false' : 'true';
            }
            return `data-section-type-${typeLower}="${isEnabled}"`;
        }).join(' ');
        
        // Determine which types should have their toggle buttons initially enabled
        const enabledTypes = sectionTypes.filter(type => {
            const typeLower = type.toLowerCase();
            const hasSavedState = savedToggleStates.hasOwnProperty(typeLower);
            if (hasSavedState) {
                return savedToggleStates[typeLower];
            }
            // Default: seasonal is off, others are on
            return typeLower !== 'seasonal';
        });

        return `
            <div class="sections-container" ${typeFilterAttrs}>
                ${sectionTypes.length > 1 ? renderSectionTypeToggles(sectionTypes, enabledTypes) : ''}
                ${buildGroupHTMLForEditor(enabledSections, disabledSections, { showUpDownButtons })}
            </div>
        `;
    }

    /**
     * Setup event listeners for the order editor
     * @param {HTMLElement} container - Container element containing the editor
     * @param {Object} options - Options object
     */
    function setupOrderEditorListeners(container, options = {}) {
        const {
            onOrderChange = null,
            onToggleChange = null,
            getSectionOrder = null,
            sections = [],
            onSave = null
        } = options;

        if (!container) return;

        const getOrder = (id) => {
            if (getSectionOrder) return getSectionOrder(id);
            const section = sections.find(s => (s.id || '') === id);
            return section?.order || 0;
        };

        // Helper function to update first/last data attributes for enabled list
        const updateFirstLastAttributes = (enabledList) => {
            if (!enabledList) return;
            const rows = Array.from(enabledList.querySelectorAll('.section-row'));
            // Filter to only visible rows
            const visibleRows = rows.filter(row => {
                const computedStyle = window.getComputedStyle(row);
                return computedStyle.display !== 'none';
            });
            
            visibleRows.forEach((row, index) => {
                if (index === 0) {
                    row.setAttribute('data-is-first', 'true');
                    row.removeAttribute('data-is-last');
                } else if (index === visibleRows.length - 1) {
                    row.setAttribute('data-is-last', 'true');
                    row.removeAttribute('data-is-first');
                } else {
                    row.removeAttribute('data-is-first');
                    row.removeAttribute('data-is-last');
                }
            });
        };

        // Add CSS for hover effects, toggle positioning, type filtering, and disabled sections
        if (!document.getElementById('kefin-order-editor-styles')) {
            const style = document.createElement('style');
            style.id = 'kefin-order-editor-styles';
            style.textContent = `
                .section-row {
                    display: flex;
                    align-items: center;
                    gap: 0.5em;
                }
                /* Type filtering - hide sections when their type toggle is off */
                /* This will be dynamically generated for each section type, but we include common ones */
                .sections-container[data-section-type-jellyfin="false"] .section-row[data-section-type="jellyfin"],
                .sections-container[data-section-type-custom="false"] .section-row[data-section-type="custom"],
                .sections-container[data-section-type-home="false"] .section-row[data-section-type="home"],
                .sections-container[data-section-type-seasonal="false"] .section-row[data-section-type="seasonal"],
                .sections-container[data-section-type-discovery="false"] .section-row[data-section-type="discovery"] {
                    display: none !important;
                }
                /* Disabled sections styling */
                .disabled-sections-list .section-row {
                    opacity: 0.6;
                    cursor: default !important;
                }
                .disabled-sections-list .section-row[draggable] {
                    cursor: default !important;
                    pointer-events: none;
                }
                /* Hide up/down buttons for disabled sections */
                .disabled-sections-list .section-row .section-move-up-btn,
                .disabled-sections-list .section-row .section-move-down-btn {
                    display: none !important;
                }
                .disabled-sections-list .section-row .section-toggle-switch {
                    pointer-events: auto;
                    cursor: pointer;
                }
                /* Disable/grey-out up button for first item in enabled list */
                .enabled-sections-list .section-row[data-is-first="true"] .section-move-up-btn {
                    opacity: 0.4;
                    pointer-events: none;
                    cursor: not-allowed;
                }
                /* Disable/grey-out down button for last item in enabled list */
                .enabled-sections-list .section-row[data-is-last="true"] .section-move-down-btn {
                    opacity: 0.4;
                    pointer-events: none;
                    cursor: not-allowed;
                }
            `;
            document.head.appendChild(style);
        }

        // Up/Down button handlers
        container.addEventListener('click', (e) => {
            const upBtn = e.target.closest('.section-move-up-btn');
            const downBtn = e.target.closest('.section-move-down-btn');
            
            if (upBtn || downBtn) {
                e.preventDefault();
                e.stopPropagation();
                
                // Check if button is disabled (via CSS pointer-events: none)
                const btn = upBtn || downBtn;
                const btnStyle = window.getComputedStyle(btn);
                if (btnStyle.pointerEvents === 'none') {
                    return; // Button is disabled, don't process click
                }
                
                const sectionRow = (upBtn || downBtn).closest('.section-row');
                if (!sectionRow) return;
                
                // Only operate on enabled sections list
                const enabledList = container.querySelector('.enabled-sections-list') 
                    || container.closest('.sections-container')?.querySelector('.enabled-sections-list');
                if (!enabledList || !enabledList.contains(sectionRow)) return;
                
                // Get all rows in enabled list and filter to only visible ones
                const allRows = Array.from(enabledList.querySelectorAll('.section-row'));
                const visibleRows = allRows.filter(row => {
                    const computedStyle = window.getComputedStyle(row);
                    return computedStyle.display !== 'none';
                });
                
                const currentIndex = visibleRows.indexOf(sectionRow);
                
                if (upBtn && currentIndex > 0) {
                    // Move up - find previous visible section
                    const targetRow = visibleRows[currentIndex - 1];
                    
                    // Update order values only if onOrderChange is provided
                    if (onOrderChange) {
                        const sectionId = sectionRow.dataset.sectionId;
                        const targetSectionId = targetRow.dataset.sectionId;
                        const targetOrder = getOrder(targetSectionId);
                        const currentOrder = getOrder(sectionId);
                        
                        // Swap orders
                        onOrderChange(sectionId, targetOrder);
                        onOrderChange(targetSectionId, currentOrder);
                    }
                    
                    // Update DOM position
                    sectionRow.parentElement.insertBefore(sectionRow, targetRow);
                    
                    // Update first/last attributes after moving
                    updateFirstLastAttributes(enabledList);
                    
                    // Auto-save after reordering
                    if (onSave) {
                        onSave().catch(err => {
                            console.error('Error auto-saving after up/down:', err);
                        });
                    }
                } else if (downBtn && currentIndex < visibleRows.length - 1) {
                    // Move down - find next visible section
                    const targetRow = visibleRows[currentIndex + 1];
                    
                    // Update order values only if onOrderChange is provided
                    if (onOrderChange) {
                        const sectionId = sectionRow.dataset.sectionId;
                        const targetSectionId = targetRow.dataset.sectionId;
                        const targetOrder = getOrder(targetSectionId);
                        const currentOrder = getOrder(sectionId);
                        
                        // Swap orders
                        onOrderChange(sectionId, targetOrder);
                        onOrderChange(targetSectionId, currentOrder);
                    }
                    
                    // Update DOM position
                    sectionRow.parentElement.insertBefore(targetRow, sectionRow);
                    
                    // Update first/last attributes after moving
                    updateFirstLastAttributes(enabledList);
                    
                    // Auto-save after reordering
                    if (onSave) {
                        onSave().catch(err => {
                            console.error('Error auto-saving after up/down:', err);
                        });
                    }
                }
            }
        });

        // Toggle switch handlers
        container.addEventListener('click', (e) => {
            const toggle = e.target.closest('.toggle-slider');
            if (!toggle) return;
            
            e.stopPropagation();
            const sectionId = toggle.dataset.sectionId;
            const currentEnabled = toggle.dataset.enabled === 'true';
            const newEnabled = !currentEnabled;
            
            const sectionRow = toggle.closest('.section-row');
            if (!sectionRow) return;
            
            // Find the sections container (might be the container itself or a parent)
            const sectionsContainer = container.classList.contains('sections-container') 
                ? container 
                : (container.closest('.sections-container') || container.querySelector('.sections-container'));
            
            // Find the lists (might be direct children or descendants)
            const enabledList = container.querySelector('.enabled-sections-list') 
                || sectionsContainer?.querySelector('.enabled-sections-list');
            const disabledList = container.querySelector('.disabled-sections-list') 
                || sectionsContainer?.querySelector('.disabled-sections-list');
            
            if (!enabledList || !disabledList) {
                // Fallback to old behavior if lists don't exist
                toggle.dataset.enabled = newEnabled;
                toggle.style.background = newEnabled ? 'rgba(0, 164, 220, 0.8)' : 'rgba(158, 158, 158, 0.5)';
                const span = toggle.querySelector('span');
                if (span) {
                    span.style.left = newEnabled ? '32px' : '2px';
                }
                if (onToggleChange) {
                    onToggleChange(sectionId, newEnabled);
                }
                return;
            }
            
            // Update toggle UI
            toggle.dataset.enabled = newEnabled;
            toggle.style.background = newEnabled ? 'rgba(0, 164, 220, 0.8)' : 'rgba(158, 158, 158, 0.5)';
            const span = toggle.querySelector('span');
            if (span) {
                span.style.left = newEnabled ? '32px' : '2px';
            }
            
            // Move section between lists
            if (newEnabled) {
                // Moving from disabled to enabled - insert based on order
                const sectionOrder = getOrder(sectionId);
                const enabledRows = Array.from(enabledList.querySelectorAll('.section-row'));
                
                // Find the correct position based on order
                let insertBefore = null;
                for (const row of enabledRows) {
                    const rowId = row.dataset.sectionId;
                    const rowOrder = getOrder(rowId);
                    if (rowOrder > sectionOrder) {
                        insertBefore = row;
                        break;
                    }
                }
                
                // Update section row to be draggable (buttons are always rendered, CSS handles visibility)
                sectionRow.setAttribute('draggable', 'true');
                
                // Move to enabled list
                if (insertBefore) {
                    enabledList.insertBefore(sectionRow, insertBefore);
                } else {
                    enabledList.appendChild(sectionRow);
                }
                
                // Update first/last data attributes after moving
                updateFirstLastAttributes(enabledList);
            } else {
                // Moving from enabled to disabled
                // Remove drag (buttons are always rendered, CSS handles visibility)
                sectionRow.removeAttribute('draggable');
                
                // Move to disabled list
                disabledList.appendChild(sectionRow);
                
                // Update first/last data attributes after moving
                updateFirstLastAttributes(enabledList);
            }
            
            if (onToggleChange) {
                onToggleChange(sectionId, newEnabled);
            }
        });
        
        // Section type toggle handlers
        container.addEventListener('click', (e) => {
            const toggleBtn = e.target.closest('.section-type-toggle-btn');
            if (!toggleBtn) return;
            
            e.stopPropagation();
            const sectionType = toggleBtn.dataset.sectionType;
            const sectionTypeLower = sectionType.toLowerCase();
            
            // Find the sections container (might be the container itself or a parent)
            const sectionsContainer = container.classList.contains('sections-container')
                ? container
                : (container.closest('.sections-container') || container.querySelector('.sections-container'));
            if (!sectionsContainer) return;
            
            // Get current state and toggle it
            const attrName = `data-section-type-${sectionTypeLower}`;
            const currentState = sectionsContainer.getAttribute(attrName);
            const newState = currentState === 'false' ? 'true' : 'false';
            const newStateBool = newState === 'true';
            
            // Update container attribute
            sectionsContainer.setAttribute(attrName, newState);
            
            // Update button appearance
            if (newStateBool) {
                toggleBtn.classList.add('button-submit');
            } else {
                toggleBtn.classList.remove('button-submit');
            }
            
            // Save the new state to localStorage
            const savedToggleStates = getSectionTypeToggleStates();
            savedToggleStates[sectionTypeLower] = newStateBool;
            saveSectionTypeToggleStates(savedToggleStates);
        });

        // Drag and drop handlers - only work within enabled sections list
        let draggedElement = null;
        let dropPosition = 'below';

        container.addEventListener('dragstart', (e) => {
            const row = e.target.closest('.section-row');
            if (!row) return;
            
            // Only allow dragging from enabled list
            const enabledList = container.querySelector('.enabled-sections-list')
                || container.closest('.sections-container')?.querySelector('.enabled-sections-list');
            if (!enabledList || !enabledList.contains(row)) {
                e.preventDefault();
                return;
            }
            
            draggedElement = row;
            e.dataTransfer.effectAllowed = 'move';
        });

        container.addEventListener('dragover', (e) => {
            const row = e.target.closest('.section-row');
            if (!row || row === draggedElement) return;
            
            // Only allow dropping in enabled list
            const enabledList = container.querySelector('.enabled-sections-list')
                || container.closest('.sections-container')?.querySelector('.enabled-sections-list');
            if (!enabledList || !enabledList.contains(row) || !enabledList.contains(draggedElement)) {
                return;
            }
            
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';
            
            const rect = row.getBoundingClientRect();
            const midpoint = rect.top + rect.height / 2;
            dropPosition = e.clientY < midpoint ? 'above' : 'below';
            
            // Visual feedback
            row.style.borderTop = dropPosition === 'above' ? '2px solid var(--theme-primary-color, #00a4dc)' : 'none';
            row.style.borderBottom = dropPosition === 'below' ? '2px solid var(--theme-primary-color, #00a4dc)' : 'none';
        });

        container.addEventListener('dragleave', (e) => {
            const row = e.target.closest('.section-row');
            if (row) {
                row.style.borderTop = '';
                row.style.borderBottom = '';
            }
        });

        container.addEventListener('drop', (e) => {
            const row = e.target.closest('.section-row');
            if (!row || !draggedElement || row === draggedElement) return;
            
            // Only allow dropping in enabled list
            const enabledList = container.querySelector('.enabled-sections-list')
                || container.closest('.sections-container')?.querySelector('.enabled-sections-list');
            if (!enabledList || !enabledList.contains(row) || !enabledList.contains(draggedElement)) {
                return;
            }
            
            e.preventDefault();
            
            // Clear visual feedback
            row.style.borderTop = '';
            row.style.borderBottom = '';
            
            // Update order values only if onOrderChange is provided
            // Otherwise, we'll derive order from DOM position when saving
            if (onOrderChange) {
                const draggedSectionId = draggedElement.dataset.sectionId;
                const newOrder = calculateNewOrderEnhanced(draggedElement, row, dropPosition, getOrder);
                onOrderChange(draggedSectionId, newOrder);
            }
            
            // Update DOM position (always do this, regardless of onOrderChange)
            if (dropPosition === 'above') {
                row.parentElement.insertBefore(draggedElement, row);
            } else {
                row.parentElement.insertBefore(draggedElement, row.nextSibling);
            }
            
            // Update first/last attributes after moving
            updateFirstLastAttributes(enabledList);
            
            // Auto-save after drag/drop reordering
            if (onSave) {
                onSave().catch(err => {
                    console.error('Error auto-saving after drag/drop:', err);
                });
            }
            
            draggedElement = null;
        });
        
        // Initialize first/last attributes on page load
        const initEnabledList = container.querySelector('.enabled-sections-list')
            || container.closest('.sections-container')?.querySelector('.enabled-sections-list');
        if (initEnabledList) {
            updateFirstLastAttributes(initEnabledList);
        }
    }

    // Expose to global scope
    window.KefinTweaksUI = {
        createAutoCompleteInput,
        BadgeSystem,
        renderHomeSectionsOrderEditor,
        setupOrderEditorListeners
    };

    LOG('UI utilities loaded');
    LOG('Available at window.KefinTweaksUI');

})();

