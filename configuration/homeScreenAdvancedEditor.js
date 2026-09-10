// KefinTweaks Home Screen Advanced Section Editor (custom sections)

(function() {
    'use strict';

    const SECTION_VISIBILITY_OPTIONS = [
        { value: 'normal', label: 'Normal' },
        { value: 'seasonal', label: 'Seasonal' },
        { value: 'discovery', label: 'Discovery' }
    ];


    const ENDPOINT_OPTIONS = [
        { value: 'Items', label: 'Items', path: '' },
        { value: 'Genres', label: 'Genres', path: '/Genres' },
        { value: 'Persons', label: 'Persons', path: '/Persons' },
        { value: 'Studios', label: 'Studios', path: '/Studios' },
        { value: 'Next Up', label: 'Next Up', path: '/Shows/NextUp' },
        { value: 'Latest', label: 'Latest', path: '/Items/Latest' },
        { value: 'Custom', label: 'Custom', path: null }
    ];

    const CACHE_SOURCE_OPTIONS = [
        { value: 'MoviesCache.getImdbTop250Movies', label: 'IMDb Top 250 Movies' },
        { value: 'StudiosCache.getPopularTVNetworks', label: 'Popular TV Networks' },
        { value: 'PeopleCache.getTopActors', label: 'Top Actors' },
        { value: 'PeopleCache.getTopDirectors', label: 'Top Directors' },
        { value: 'PeopleCache.getTopWriters', label: 'Top Writers' }
    ];

    const DEFAULT_SECTION_QUERY_LIMIT = window.KefinHomeScreenEditorConstants?.DEFAULT_SECTION_QUERY_LIMIT ?? 16;
    const LIMIT_ZERO_MODAL_ID = 'kefin-hsae-limit-zero';
    const LIMIT_ZERO_MESSAGE = 'Setting the limit to 0 can result in queries requesting a lot of items from the server and may result in slow response times. This is fine to use if you know there are only a few hundred results at maximum. If you expect thousands of results, this is probably not a good idea unless you use a fairly long cache time.';

    /** Live editor state for collectData (which only receives a dialog element). */
    let activeEditorState = null;

    function getLiveEditorState(dialog) {
        return dialog?._hsaeState
            || dialog?.closest?.('.dialogContainer')?._hsaeState
            || activeEditorState
            || null;
    }

    function createDefaultQuery() {
        return { queryOptions: { Limit: DEFAULT_SECTION_QUERY_LIMIT } };
    }

    /**
     * Confirm Limit = 0. Cancel / dismiss restores previous; OK keeps 0.
     * @param {{ onConfirm?: () => void, onCancel?: () => void }} opts
     */
    function openLimitZeroConfirm({ onConfirm, onCancel } = {}) {
        let settled = false;
        const finish = (ok) => {
            if (settled) return;
            settled = true;
            if (ok) onConfirm?.();
            else onCancel?.();
        };

        if (!window.ModalSystem?.create) {
            if (window.confirm(LIMIT_ZERO_MESSAGE)) finish(true);
            else finish(false);
            return;
        }

        if (window.ModalSystem.isOpen?.(LIMIT_ZERO_MODAL_ID)) {
            window.ModalSystem.close(LIMIT_ZERO_MODAL_ID);
        }

        const modalId = LIMIT_ZERO_MODAL_ID;
        const content = `<p class="listItemBodyText">${LIMIT_ZERO_MESSAGE}</p>`;
        const footer = `
            <button type="button" class="emby-button raised" id="kefin-hsae-limit-zero-cancel">Cancel</button>
            <button type="button" class="emby-button raised button-submit" id="kefin-hsae-limit-zero-confirm">OK</button>
        `;
        window.ModalSystem.create({
            id: modalId,
            title: 'Limit of 0',
            content,
            footer,
            closeOnBackdrop: true,
            closeOnEscape: true,
            showCloseButton: true,
            onClose: () => finish(false),
            onOpen: (modal) => {
                modal.dialogFooter?.querySelector('#kefin-hsae-limit-zero-confirm')?.addEventListener('click', () => {
                    finish(true);
                    window.ModalSystem.close(modalId);
                });
                modal.dialogFooter?.querySelector('#kefin-hsae-limit-zero-cancel')?.addEventListener('click', () => {
                    finish(false);
                    window.ModalSystem.close(modalId);
                });
            }
        });
    }

    function getLimitPrevValue(input) {
        return input?.dataset?.prevLimit ?? '';
    }

    function setLimitPrevValue(input, value) {
        if (!input) return;
        input.dataset.prevLimit = value == null ? '' : String(value);
    }

    /**
     * Enforce non-negative Limit; confirm before accepting 0.
     * @param {HTMLInputElement} input
     */
    function handleLimitFieldChange(input) {
        if (!input || input.dataset.limitConfirmOpen === 'true') return;

        const raw = String(input.value ?? '').trim();
        if (raw === '') {
            setLimitPrevValue(input, '');
            delete input.dataset.limitZeroAccepted;
            return;
        }

        // Incomplete / invalid intermediate values (e.g. "-", "e")
        if (raw === '-' || raw === '+' || raw === '.' || Number.isNaN(Number(raw))) {
            input.value = getLimitPrevValue(input);
            return;
        }

        const n = parseInt(raw, 10);
        if (!Number.isFinite(n)) {
            input.value = getLimitPrevValue(input);
            return;
        }

        if (n < 0) {
            input.value = getLimitPrevValue(input);
            return;
        }

        if (n === 0) {
            const prev = getLimitPrevValue(input);
            const prevN = prev === '' ? null : parseInt(prev, 10);
            if (prevN === 0 || input.dataset.limitZeroAccepted === 'true') {
                input.value = '0';
                setLimitPrevValue(input, '0');
                input.dataset.limitZeroAccepted = 'true';
                return;
            }

            // Revert until the user confirms zero
            input.value = prev;
            input.dataset.limitConfirmOpen = 'true';
            openLimitZeroConfirm({
                onConfirm: () => {
                    input.value = '0';
                    setLimitPrevValue(input, '0');
                    input.dataset.limitZeroAccepted = 'true';
                    delete input.dataset.limitConfirmOpen;
                },
                onCancel: () => {
                    input.value = prev;
                    delete input.dataset.limitZeroAccepted;
                    delete input.dataset.limitConfirmOpen;
                }
            });
            return;
        }

        input.value = String(n);
        setLimitPrevValue(input, String(n));
        delete input.dataset.limitZeroAccepted;
    }

    /**
     * Wire min/step and Limit validation for one query card.
     * @param {Element} editor
     * @param {number} queryIndex
     */
    function attachLimitFieldSafeguard(editor, queryIndex) {
        const limitInput = editor?.querySelector?.(`#query-${queryIndex}-Limit`);
        if (!limitInput || limitInput.dataset.limitSafeguardAttached === 'true') return;

        limitInput.dataset.limitSafeguardAttached = 'true';
        limitInput.min = '0';
        limitInput.step = '1';
        setLimitPrevValue(limitInput, limitInput.value ?? '');
        if (limitInput.value === '0' || parseInt(limitInput.value, 10) === 0) {
            limitInput.dataset.limitZeroAccepted = 'true';
        }

        limitInput.addEventListener('input', () => handleLimitFieldChange(limitInput));
        limitInput.addEventListener('change', () => handleLimitFieldChange(limitInput));
        limitInput.addEventListener('blur', () => handleLimitFieldChange(limitInput));
    }

    const FILTER_CHIP_OPTIONS = [
        { value: 'IsUnplayed', label: 'Unplayed' },
        { value: 'IsPlayed', label: 'Played' },
        { value: 'IsFavorite', label: 'Favorite' },
        { value: 'IsResumable', label: 'Resumable' },
        { value: 'Likes', label: 'Watchlist' },
        { value: 'Dislikes', label: 'Not on Watchlist' },
        { value: 'IsFavoriteOrLikes', label: 'Favorite or Watchlist' },
        { value: 'IsFolder', label: 'Folder' },
        { value: 'IsNotFolder', label: 'Not a Folder' }
    ];

    const PARENT_SELECTION_CARD_TYPES = [
        {
            type: 'Collection',
            label: 'Collection',
            description: 'Show items from a specific Collection in your library.',
            icon: 'collections_bookmark'
        },
        {
            type: 'Playlist',
            label: 'Playlist',
            description: 'Show items from a specific Playlist in your library.',
            icon: 'playlist_play'
        },
        {
            type: 'Library',
            label: 'Library',
            description: 'Show items from a specific Jellyfin Library.',
            icon: 'video_library'
        },
        {
            type: 'Custom',
            label: 'Custom',
            description: 'Show items from any Folder in your library.',
            icon: 'folder_open'
        }
    ];

    const FACET_SELECTION_CARD_TYPES = [
        {
            type: 'Genre',
            label: 'Genres',
            description: 'Show items that share a Genre, like Action or Comedy.',
            icon: 'theater_comedy',
            queryField: 'GenreIds'
        },
        {
            type: 'Tag',
            label: 'Tags',
            description: 'Show items that share a Tag, like Time Travel or Revenge.',
            icon: 'sell',
            queryField: 'Tags'
        },
        {
            type: 'Person',
            label: 'Persons',
            description: 'Show items that a specific Person has acted in or has directed, written, produced, etc.',
            icon: 'person',
            queryField: 'PersonIds'
        },
        {
            type: 'Studio',
            label: 'Studios',
            description: 'Show items from a specific Film Studio or TV Network.',
            icon: 'apartment',
            queryField: 'StudioIds'
        }
    ];

    const WIZARD_ITEM_TYPE_OPTIONS = ['Movie', 'Series', 'Episode', 'Season', 'MusicAlbum', 'Audio', 'MusicVideo', 'Book'];

    const FALLBACK_ALL_ITEM_TYPES = [
        'AggregateFolder', 'Audio', 'AudioBook', 'BasePluginFolder', 'Book', 'BoxSet', 'Channel',
        'ChannelFolderItem', 'CollectionFolder', 'Episode', 'Folder', 'Genre', 'ManualPlaylistsFolder',
        'Movie', 'LiveTvChannel', 'LiveTvProgram', 'MusicAlbum', 'MusicArtist', 'MusicGenre', 'MusicVideo',
        'Person', 'Photo', 'PhotoAlbum', 'Playlist', 'PlaylistsFolder', 'Program', 'Recording', 'Season',
        'Series', 'Studio', 'Trailer', 'TvChannel', 'TvProgram', 'UserRootFolder', 'UserView', 'Video', 'Year'
    ];

    const BORDER_STYLE_OPTIONS = [
        { value: '', label: 'Default' },
        { value: 'stairstep', label: 'Single' },
        { value: 'double', label: 'Double' },
        { value: 'triple', label: 'Triple' },
        { value: 'corner', label: 'Corner' },
        { value: 'square', label: 'Square' },
        { value: 'diamond', label: 'Diamond' },
        { value: 'retro-poster', label: 'Retro Poster' },
        { value: 'modern-poster', label: 'Modern Poster' },
        { value: 'picture-frame', label: 'Picture Frame' },
        { value: 'art-gallery', label: 'Art Gallery' },
        { value: 'vintage', label: 'Vintage' },
        { value: 'wood', label: 'Wood' },
        { value: 'film-reel', label: 'Film Reel' },
        { value: 'profile', label: 'Profile' }
    ];

    const CARD_TITLE_CAPITALIZATION_OPTIONS = [
        { value: 'normal', label: 'Normal' },
        { value: 'uppercase', label: 'Uppercase' },
        { value: 'lowercase', label: 'Lowercase' },
        { value: 'capitalize', label: 'Capitalize' }
    ];

    const CARD_TITLE_POSITION_OPTIONS = [
        { value: 'default', label: 'Default' },
        { value: 'left', label: 'Left' },
        { value: 'center', label: 'Center' },
        { value: 'right', label: 'Right' },
        { value: 'overlay-top-left', label: 'Overlay Top Left' },
        { value: 'overlay-top-center', label: 'Overlay Top Center' },
        { value: 'overlay-top-right', label: 'Overlay Top Right' },
        { value: 'overlay-center-left', label: 'Overlay Center Left' },
        { value: 'overlay-center', label: 'Overlay Center' },
        { value: 'overlay-center-right', label: 'Overlay Center Right' },
        { value: 'overlay-bottom-left', label: 'Overlay Bottom Left' },
        { value: 'overlay-bottom-center', label: 'Overlay Bottom Center' },
        { value: 'overlay-bottom-right', label: 'Overlay Bottom Right' }
    ];

    const CARD_TITLE_FONT_FAMILY_OPTIONS = [
        { value: 'default', label: 'Default' },
        { value: 'alfa-slab-one', label: 'Alfa Slab One' },
        { value: 'anton', label: 'Anton' },
        { value: 'changa-one', label: 'Changa One' },
        { value: 'exo', label: 'Exo' },
        { value: 'orbitron', label: 'Orbitron' },
        { value: 'oswald', label: 'Oswald' },
        { value: 'prata', label: 'Prata' },
        { value: 'roboto', label: 'Roboto' },
        { value: 'unbounded', label: 'Unbounded' },
        { value: 'vt323', label: 'VT323' },
        { value: 'verdana', label: 'Verdana' },
        { value: 'courier-new', label: 'Courier New' }
    ];

    const CARD_TITLE_FONT_SIZE_OPTIONS = [
        { value: 'normal', label: 'Normal' },
        { value: 'small', label: 'Small' },
        { value: 'large', label: 'Large' }
    ];

    const ITEMS_LAYOUT_OPTIONS = [
        { value: 'row', label: 'Row' },
        { value: 'grid', label: 'Grid' }
    ];

    const CARD_GAPS_OPTIONS = [
        { value: '', label: 'Default' },
        { value: 'none', label: 'No Gap' }
    ];

    const TTL_UNIT_OPTIONS = [
        { value: 'seconds', ms: 1000 },
        { value: 'minutes', ms: 60 * 1000 },
        { value: 'hours', ms: 60 * 60 * 1000 },
        { value: 'days', ms: 24 * 60 * 60 * 1000 }
    ];

    const CUSTOM_SOURCE_DESC = 'Show items with custom images, links and names.';

    const HIDE_WATCHED_TOGGLE_DESCRIPTIONS = {
        on: 'This section will not show watched items.',
        off: 'This section may include watched items.'
    };

    const HIDE_NAME_TOGGLE_DESCRIPTIONS = {
        on: 'The section name will not be visible.',
        off: 'The section name will be visible.'
    };

    const USER_TOGGLE_TOOLTIPS = {
        userEnabledByDefault: {
            on: 'Users will see this section enabled in their home settings.',
            off: 'Users will see this section disabled in their home settings.'
        },
        userConfigurable: {
            on: 'Users can enable or disable this section in their home settings.',
            off: 'Users cannot configure, and will only see this section if the Default Status is enabled.'
        }
    };

    const RENDER_MODE_CARDS = [
        { value: 'Normal', title: 'Normal', desc: 'Matches the default Jellyfin horizontal row of cards.' },
        { value: 'Spotlight', title: 'Spotlight', desc: 'A customizable, full-width, featured slideshow carousel.' },
        { value: 'Random', title: 'Random', desc: 'A random layout will be used when the section is loaded.' }
    ];

    const SPOTLIGHT_TOGGLE_DESCRIPTIONS = {
        'section-spotlight-panAnimation': 'Apply pan and zoom animations to each slide.',
        'section-spotlight-showNavButtons': 'Show previous and next navigation buttons on the carousel.',
        'section-spotlight-showClearArt': 'Display clear art logo overlay when available.',
        'section-spotlight-cycleBackdrops': 'Cycle through multiple backdrop images per slide.',
        'section-spotlight-autoPlay': 'Automatically advance slides after the timer interval.'
    };

    const ADVANCED_TOGGLE_DESCRIPTIONS = {
        'section-flattenSeries': 'Multiple episodes from the same series will be grouped into one item in the section.',
        'hsae-limit-before-sort': 'When enabled, the item limit is applied before section-level sort.',
        'hsae-hide-card-titles': 'Card titles for individual items in the section will not be shown.'
    };

    const RANDOM_QUERY_TOGGLE_DESCRIPTIONS = {
        on: 'Randomly picks a query from the defined queries instead of merging all query results. If Query Picker is enabled, the section will initially show a random query from the defined queries.',
        off: 'Merge results from all defined queries while respecting the sorting criteria specified below.'
    };

    const QUERY_PICKER_TOGGLE_DESCRIPTIONS = {
        on: 'Show a control to pick which query the section displays from the defined queries.',
        off: 'No control to pick which query the section displays from the defined queries.'
    };

    const USE_QUERY_NAMES_TOGGLE_DESCRIPTIONS = {
        on: 'Shows the name of the query in place of the section name.',
        off: 'Does not use the name of the query in place of the section name.'
    };

    function humanizeSortOrderLabel(value) {
        if (value == null || value === '') return '';
        return String(value)
            .replace(/([a-z])([A-Z])/g, '$1 $2')
            .replace(/([A-Z])([A-Z][a-z])/g, '$1 $2');
    }

    function toSortBySelectOptions(sortOrders) {
        return (sortOrders || []).map(value => ({
            value,
            label: humanizeSortOrderLabel(value)
        }));
    }

    function getSectionSortOrderDirectionOptions(directions) {
        return [
            { value: '', label: 'Default' },
            ...(directions || []).map((value) => ({ value, label: value }))
        ];
    }

    function resolveEditorProfileKey(section, context = {}) {
        if (context.editorProfile) return context.editorProfile;
        return window.KefinHomeScreenEditorProfiles?.resolveEditorProfile(section, context) || 'full';
    }

    function isDiscoverySection(section) {
        return !!(section?.discoveryType || section?.discoveryEnabled === true);
    }

    function isProfileFieldActive(root, el) {
        if (!el) return false;
        const gated = el.closest('[data-hsae-profiles]');
        if (!gated) return true;
        const profile = root?.dataset?.editorProfile || 'full';
        const allowed = (gated.dataset.hsaeProfiles || '').split(/\s+/).filter(Boolean);
        return allowed.includes(profile);
    }

    function applySectionLevelSort(section, sortBy, sortOrder) {
        const by = sortBy == null ? '' : String(sortBy).trim();
        const order = sortOrder == null ? '' : String(sortOrder).trim();

        if (!by || by === 'Default') delete section.sortBy;
        else section.sortBy = by;

        if (!order || order === 'Default') delete section.sortOrder;
        else section.sortOrder = order;
    }

    function resolvePremiereAgeFields(section) {
        const query = section?.queries?.[0] || {};
        const minAge = query.minAge !== undefined ? query.minAge : '';
        const maxAge = query.maxAge !== undefined ? query.maxAge : '';
        return { minAge, maxAge };
    }

    function applyDiscoveryAdvancedFields(section, dialog, root) {
        const itemLimitEl = dialog.querySelector('#hsae-section-itemLimit');
        if (isProfileFieldActive(root, itemLimitEl)) {
            const itemLimit = itemLimitEl?.value;
            if (itemLimit !== '' && itemLimit != null) {
                section.itemLimit = parseInt(itemLimit, 10);
            } else {
                delete section.itemLimit;
            }
        }

        const sortByEl = dialog.querySelector('#hsae-advanced-sortBy');
        if (isProfileFieldActive(root, sortByEl)) {
            const sortVal = sortByEl?.value;
            delete section.sortBy;
            if (sortVal && sortVal !== 'Default') section.sortOrder = sortVal;
            else delete section.sortOrder;
        }

        const sortDirEl = dialog.querySelector('#hsae-advanced-sortOrder');
        if (isProfileFieldActive(root, sortDirEl)) {
            const dirVal = sortDirEl?.value;
            if (dirVal && dirVal !== 'Default') section.sortOrderDirection = dirVal;
            else delete section.sortOrderDirection;
        }
    }

    function collectAdvancedOptionsFields(dialog, section, root) {
        const ttlPreset = dialog.querySelector('.hsae-cache-preset.hsae-active')?.dataset.presetKey || 'DEFAULT';
        const ttlState = {
            ttlPreset,
            ttlCustomValue: dialog.querySelector('#hsae-ttl-custom-value')?.value,
            ttlCustomUnit: dialog.querySelector('#hsae-ttl-custom-unit')?.value
        };
        const cacheSection = dialog.querySelector('.hsae-advanced-cache');
        if (isProfileFieldActive(root, cacheSection)) {
            const ttlMs = resolveTtlMs(ttlState);
            if (ttlMs !== undefined) section.ttl = ttlMs;
            else section.ttl = '';
        }

        const sortByEl = dialog.querySelector('#hsae-advanced-sortBy');
        const sortOrderEl = dialog.querySelector('#hsae-advanced-sortOrder');
        if (isProfileFieldActive(root, sortByEl) && !isDiscoverySection(section)) {
            if (section.useRandomQuery) {
                delete section.sortBy;
                delete section.sortOrder;
            } else {
                applySectionLevelSort(section, sortByEl?.value, sortOrderEl?.value);
            }
        }

        if (isDiscoverySection(section)) {
            applyDiscoveryAdvancedFields(section, dialog, root);
        }

        const minAgeEl = dialog.querySelector('#hsae-query-minAge');
        const maxAgeEl = dialog.querySelector('#hsae-query-maxAge');
        if (isProfileFieldActive(root, minAgeEl) && section.queries?.length) {
            const minAgeRaw = minAgeEl?.value?.trim();
            const maxAgeRaw = maxAgeEl?.value?.trim();
            if (minAgeRaw !== '') {
                const minAge = parseInt(minAgeRaw, 10);
                if (!Number.isNaN(minAge)) section.queries[0].minAge = minAge;
            } else {
                delete section.queries[0].minAge;
            }
            if (maxAgeRaw !== '') {
                const maxAge = parseInt(maxAgeRaw, 10);
                if (!Number.isNaN(maxAge)) section.queries[0].maxAge = maxAge;
            } else {
                delete section.queries[0].maxAge;
            }
        }

        const minimumItemsEl = dialog.querySelector('#section-minimumItems');
        if (isProfileFieldActive(root, minimumItemsEl)) {
            const minimumItems = minimumItemsEl?.value;
            if (minimumItems) section.minimumItems = parseInt(minimumItems, 10);
            else section.minimumItems = '';
        }

        const itemLimitEl = dialog.querySelector('#hsae-section-itemLimit');
        if (isProfileFieldActive(root, itemLimitEl) && !isDiscoverySection(section)) {
            const itemLimit = itemLimitEl?.value;
            if (itemLimit !== '' && itemLimit != null) {
                section.itemLimit = parseInt(itemLimit, 10);
            } else {
                delete section.itemLimit;
            }
        }

        const flattenEl = dialog.querySelector('#section-flattenSeries');
        if (isProfileFieldActive(root, flattenEl)) {
            if (flattenEl?.checked === true) section.flattenSeries = true;
            else delete section.flattenSeries;
        }

        const limitBeforeSortEl = dialog.querySelector('#hsae-limit-before-sort');
        if (isProfileFieldActive(root, limitBeforeSortEl)) {
            if (limitBeforeSortEl?.checked === true) section.limitBeforeSort = true;
            else delete section.limitBeforeSort;
        }
    }

    function escapeHtml(str) {
        if (str == null) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    function getApi() {
        const ui = window.KefinTweaksUI;
        const se = window.KefinHomeScreenSectionEditor;
        const constants = window.KefinHomeScreenEditorConstants;

        if (!ui?.buildSelect) {
            throw new Error('KefinTweaksUI form builders not loaded');
        }
        if (!constants) {
            throw new Error('KefinHomeScreenEditorConstants not loaded');
        }

        return {
            ...constants,
            buildSelect: ui.buildSelect,
            buildTextInput: ui.buildTextInput,
            buildToggleCard: ui.buildToggleCard,
            buildToggleSlider: ui.buildToggleSlider,
            buildCheckbox: ui.buildCheckbox,
            buildEnabledToggleButtons: ui.buildEnabledToggleButtons,
            updateToggleSwitchUI: ui.updateToggleSwitchUI,
            updateToggleSliderUI: ui.updateToggleSliderUI,
            collectSpotlightConfigFromDialog: se?.collectSpotlightConfigFromDialog,
            attachSpotlightSettingsListeners: se?.attachSpotlightSettingsListeners,
            setupAdditionalOptionsListeners: se?.setupAdditionalOptionsListeners,
            openSelectionPopover: se?.openSelectionPopover,
            openLibraryItemPickerPopover: se?.openLibraryItemPickerPopover,
            fetchSelectionItems: se?.fetchSelectionItems,
            resolveSelectionItemLabels: se?.resolveSelectionItemLabels,
            getSelectionTypeMeta: se?.getSelectionTypeMeta,
            ALL_ITEM_TYPES: se?.ALL_ITEM_TYPES || FALLBACK_ALL_ITEM_TYPES,
            PARENT_SELECTION_TYPES: se?.PARENT_SELECTION_TYPES,
            FACET_SELECTION_TYPES: se?.FACET_SELECTION_TYPES
        };
    }

    function getCustomItemsEditor() {
        return window.KefinHomeScreenCustomItemsEditor;
    }

    function getCachePresets() {
        const cache = window.KefinHomeConfig2?.CACHE || window.KefinHomeConfig2?.CACHE_CONFIG || {};
        return [
            { key: 'FORCE_REFRESH', label: 'Force Refresh', ms: cache.FORCE_REFRESH_TTL ?? 0 },
            { key: 'VERY_SHORT', label: 'Very Short (1 min)', ms: cache.VERY_SHORT_TTL ?? 60000 },
            { key: 'SHORT', label: 'Short (5 min)', ms: cache.SHORT_TTL ?? 300000 },
            { key: 'DEFAULT', label: 'Default (1 hour)', ms: cache.DEFAULT_TTL ?? 3600000 },
            { key: 'LONG', label: 'Long (24 hours)', ms: cache.LONG_TTL ?? 86400000 },
            { key: 'STATIC', label: 'Static (1 week)', ms: cache.STATIC_TTL ?? 604800000 },
            { key: 'DISCOVERY', label: 'Discovery (6 hours)', ms: cache.DISCOVERY_TTL ?? 21600000 },
            { key: 'CUSTOM', label: 'Custom', ms: null }
        ];
    }

    function inferItemSource(section) {
        if (section?.items?.length > 0 && (!section.queries?.length || section.queries.length === 0)) {
            return 'custom';
        }
        return 'jellyfin';
    }

    function sectionToVisibility(section) {
        if (section?.discoveryType || section?.discoveryEnabled === true) return 'discovery';
        if (section?.startDate?.trim() && section?.endDate?.trim()) return 'seasonal';
        return 'normal';
    }

    function applyVisibilityToSection(section, editorState) {
        const visibility = editorState.sectionVisibility || 'normal';
        const orderVal = editorState.order;
        const parsedOrder = orderVal !== '' && orderVal != null ? parseInt(orderVal, 10) : undefined;

        if (visibility === 'discovery') {
            section.discoveryEnabled = true;
            section.type = 'discovery';
            delete section.startDate;
            delete section.endDate;
            if (parsedOrder == null || Number.isNaN(parsedOrder)) {
                section.order = section.order || 100;
            } else {
                section.order = parsedOrder;
            }
        } else if (visibility === 'seasonal') {
            section.discoveryEnabled = false;
            section.type = 'seasonal';
            section.startDate = (editorState.startDate || '').trim();
            section.endDate = (editorState.endDate || '').trim();
            section.order = parsedOrder != null && !Number.isNaN(parsedOrder) ? parsedOrder : (section.order || 100);
        } else {
            section.discoveryEnabled = false;
            section.type = 'home';
            delete section.startDate;
            delete section.endDate;
            section.order = parsedOrder != null && !Number.isNaN(parsedOrder) ? parsedOrder : (section.order || 100);
        }
    }

    function inferQuerySourceType(query) {
        if (query?._sourceType === 'static') return 'static';
        if (query?.dataSource) return 'cache';
        return 'jellyfin';
    }

    function getQuerySourceBadgeLabel(sourceType) {
        if (sourceType === 'cache') return 'Client Cache';
        if (sourceType === 'static') return 'Static Items';
        return 'Jellyfin Server';
    }

    function getQueryStaticItems(query) {
        return normalizeSelectedItems(query?.queryOptions?.Ids);
    }

    function inferEndpointValue(query) {
        if (!query?.path) return 'Items';
        const match = ENDPOINT_OPTIONS.find(opt => opt.path && opt.path === query.path);
        return match ? match.value : 'Custom';
    }

    function inferParentItemType(query) {
        const queryOptions = query?.queryOptions || {};
        let parentItemType = query?._parentItemType || queryOptions._parentItemType || '';
        if (parentItemType === 'Generic Parent') parentItemType = 'Custom';
        if (!parentItemType && queryOptions.CollectionIds) parentItemType = 'Collection';
        if (!parentItemType && queryOptions.PlaylistIds) parentItemType = 'Playlist';
        if (!parentItemType && queryOptions.ParentId && queryOptions.Recursive === false) parentItemType = 'Library';
        if (!parentItemType && queryOptions.ParentId) parentItemType = 'Custom';
        return parentItemType;
    }

    function humanizeLabel(value) {
        if (!value || typeof value !== 'string') return value;
        return value
            .replace(/([a-z])([A-Z])/g, '$1 $2')
            .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2');
    }

    function normalizeSelectedItems(values) {
        if (!values) return [];
        if (Array.isArray(values)) {
            return values.map(v => {
                if (v && typeof v === 'object') {
                    return { id: String(v.id ?? v.Id ?? ''), name: String(v.name ?? v.Name ?? v.id ?? v.Id ?? '') };
                }
                return { id: String(v), name: String(v) };
            }).filter(v => v.id);
        }
        if (typeof values === 'string') {
            return values.split(',').map(s => s.trim()).filter(Boolean).map(s => ({ id: s, name: s }));
        }
        return [];
    }

    function getQueryParentSelection(query) {
        const queryOptions = query?.queryOptions || {};
        const parentType = inferParentItemType(query);
        if (!parentType) return { type: '', items: [] };

        if (parentType === 'Collection' && queryOptions.CollectionIds && !queryOptions.ParentId) {
            return { type: 'Collection', items: normalizeSelectedItems(queryOptions.CollectionIds) };
        }
        if (parentType === 'Playlist' && queryOptions.PlaylistIds && !queryOptions.ParentId) {
            return { type: 'Playlist', items: normalizeSelectedItems(queryOptions.PlaylistIds) };
        }
        if (queryOptions.ParentId) {
            return { type: parentType, items: [{ id: String(queryOptions.ParentId), name: String(queryOptions.ParentId) }] };
        }
        return { type: parentType, items: [] };
    }

    function getQueryFacetSelection(query, facetType) {
        const queryOptions = query?.queryOptions || {};
        if (facetType === 'Genre') {
            if (queryOptions.GenreIds) return normalizeSelectedItems(queryOptions.GenreIds);
            if (queryOptions.Genres) return normalizeSelectedItems(queryOptions.Genres);
            return [];
        }
        if (facetType === 'Tag') return normalizeSelectedItems(queryOptions.Tags);
        if (facetType === 'Person') return normalizeSelectedItems(queryOptions.PersonIds);
        if (facetType === 'Studio') return normalizeSelectedItems(queryOptions.StudioIds);
        return [];
    }

    function buildSelectionChipsHTML(items) {
        return (items || []).map(item => `
            <span class="hsae-select-chip" data-value="${escapeHtml(item.id)}">
                <span class="hsae-select-chip-label">${escapeHtml(item.name || item.id)}</span>
                <button type="button" class="hsae-select-chip-remove" data-hsae-action="remove-select-chip" title="Remove">
                    <span class="material-icons">close</span>
                </button>
            </span>
        `).join('');
    }

    function serializeSelectionItems(items) {
        return JSON.stringify((items || []).map(i => ({ id: i.id, name: i.name || i.id })));
    }

    function parseSelectionItems(json) {
        try {
            const parsed = JSON.parse(json || '[]');
            return Array.isArray(parsed) ? normalizeSelectedItems(parsed) : [];
        } catch {
            return [];
        }
    }

    function buildSelectCardHTML({
        queryIndex,
        kind,
        type,
        label,
        description,
        icon,
        items = [],
        active = false
    }) {
        const selectedJson = serializeSelectionItems(items);
        return `
            <div class="hsae-select-card${active || items.length ? ' hsae-active' : ''}" data-hsae-action="open-selection" data-select-kind="${escapeHtml(kind)}" data-select-type="${escapeHtml(type)}" data-query-index="${queryIndex}" role="button" tabindex="0">
                <div class="hsae-select-card-header">
                    <div class="hsae-select-card-text">
                        <div class="listItemBodyText hsae-select-card-label">
                            <span class="material-icons hsae-select-card-icon">${escapeHtml(icon || 'add')}</span>
                            ${escapeHtml(label)}
                        </div>
                        <div class="listItemBodyText secondary hsae-select-card-desc">${escapeHtml(description || '')}</div>
                    </div>
                    <button type="button" class="hsae-select-add-btn" data-hsae-action="open-selection" data-select-kind="${escapeHtml(kind)}" data-select-type="${escapeHtml(type)}" data-query-index="${queryIndex}" title="Add">
                        <span class="material-icons">add</span>
                    </button>
                </div>
                <div class="hsae-select-card-chips">${buildSelectionChipsHTML(items)}</div>
                <input type="hidden" class="hsae-select-card-value" value="${escapeHtml(selectedJson)}">
            </div>
        `;
    }

    function buildIncludeItemTypesHTML(queryIndex, selectedTypes) {
        const allTypes = getApi().ALL_ITEM_TYPES || FALLBACK_ALL_ITEM_TYPES;
        const selected = new Set(Array.isArray(selectedTypes) ? selectedTypes : (selectedTypes ? String(selectedTypes).split(',').map(s => s.trim()).filter(Boolean) : []));
        const defaultSet = new Set(WIZARD_ITEM_TYPE_OPTIONS);
        const hasExtraSelected = [...selected].some(type => !defaultSet.has(type));
        const showAll = hasExtraSelected;

        return `
            <div class="hsae-include-types" data-query-index="${queryIndex}" data-show-all="${showAll ? 'true' : 'false'}">
                <div class="hsae-include-types-header">
                    <div>
                        <div class="listItemBodyText hsae-subsection-label">Included Item Types</div>
                        <div class="listItemBodyText secondary hsae-field-hint">
                            ${selected.size === 0 ? 'None selected - all item types will be included.' : 'Only the selected item types will be included.'}
                        </div>
                    </div>
                    <button type="button" class="emby-button raised hsae-include-types-toggle" data-hsae-action="toggle-include-types-all" data-query-index="${queryIndex}">
                        ${showAll ? 'Show less' : 'Show all'}
                    </button>
                </div>
                <div class="hsae-chip-row hsae-include-type-chips" data-hsae-chips="query-${queryIndex}-include-types">
                    ${allTypes.map(type => {
                        const isDefault = defaultSet.has(type);
                        return `<button type="button" class="kefin-chip hsae-chip${selected.has(type) ? ' hsae-active' : ''}${isDefault ? '' : ' hsae-include-type-extra'}" data-chip-value="${escapeHtml(type)}"${isDefault || showAll ? '' : ' hidden'}>${escapeHtml(humanizeLabel(type))}</button>`;
                    }).join('')}
                </div>
                <input type="hidden" id="query-${queryIndex}-IncludeItemTypes" value="${escapeHtml([...selected].join(','))}">
            </div>
        `;
    }

    function updateIncludeItemTypesHint(container) {
        if (!container) return;
        const hiddenInput = container.querySelector('input[id$="-IncludeItemTypes"]');
        const hint = container.querySelector('.hsae-field-hint');
        if (!hiddenInput || !hint) return;

        const values = hiddenInput.value
            ? hiddenInput.value.split(',').map(s => s.trim()).filter(Boolean)
            : [];

        hint.textContent = values.length === 0
            ? 'None selected - all item types will be included.'
            : 'Only the selected item types will be included.';
    }

    function syncSelectCardUI(card) {
        if (!card) return;
        const hidden = card.querySelector('.hsae-select-card-value');
        const chips = card.querySelector('.hsae-select-card-chips');
        const items = parseSelectionItems(hidden?.value);
        if (chips) chips.innerHTML = buildSelectionChipsHTML(items);
        card.classList.toggle('hsae-active', items.length > 0);
    }

    function setSelectCardItems(card, items) {
        if (!card) return;
        const hidden = card.querySelector('.hsae-select-card-value');
        if (hidden) hidden.value = serializeSelectionItems(items);
        syncSelectCardUI(card);
    }

    function clearSiblingParentCards(editor, keepType) {
        editor.querySelectorAll('.hsae-select-card[data-select-kind="parent"]').forEach(card => {
            if (card.dataset.selectType === keepType) return;
            setSelectCardItems(card, []);
        });
    }

    function inferHideWatched(section) {
        const queries = section?.queries || [];
        if (!queries.length) return false;
        return queries.every(q => q?.queryOptions?.IsUnplayed === true);
    }

    function parseFiltersString(filters) {
        if (!filters) return [];
        return String(filters).split(',').map(s => s.trim()).filter(Boolean);
    }

    function matchTtlPreset(ttl) {
        if (ttl === undefined || ttl === null || ttl === '') {
            return { preset: 'DEFAULT', customValue: '', customUnit: 'minutes' };
        }
        const ms = parseInt(ttl, 10);
        const presets = getCachePresets().filter(p => p.key !== 'CUSTOM');
        const exact = presets.find(p => p.ms === ms);
        if (exact) return { preset: exact.key, customValue: '', customUnit: 'minutes' };
        const minutes = Math.round(ms / 60000);
        if (minutes > 0 && minutes * 60000 === ms) {
            return { preset: 'CUSTOM', customValue: String(minutes), customUnit: 'minutes' };
        }
        const seconds = Math.round(ms / 1000);
        return { preset: 'CUSTOM', customValue: String(seconds), customUnit: 'seconds' };
    }

    function resolveGroupSelection(section, context = {}) {
        const existingGroupNames = context.existingGroupNames || [];
        const currentGroupName = context.currentGroupName || section._targetGroupName || '';
        if (currentGroupName && currentGroupName !== 'New...' && existingGroupNames.includes(currentGroupName)) {
            return { groupSelect: currentGroupName, groupNew: '' };
        }
        if (currentGroupName && currentGroupName !== 'New...' && !existingGroupNames.includes(currentGroupName)) {
            return { groupSelect: 'New...', groupNew: currentGroupName };
        }
        if (existingGroupNames.includes('Custom Sections')) {
            return { groupSelect: 'Custom Sections', groupNew: '' };
        }
        return { groupSelect: existingGroupNames.length ? existingGroupNames[0] : 'New...', groupNew: '' };
    }

    function buildEditorStateFromSection(section, context = {}) {
        const { buildSelect, buildTextInput, CARD_FORMATS, RENDER_MODE_OPTIONS } = getApi();
        const customEditor = getCustomItemsEditor();
        const renderMode = section.renderMode || (section.spotlight ? 'Spotlight' : 'Normal');
        const ttlMatch = matchTtlPreset(section.ttl);
        const groupSelection = resolveGroupSelection(section, context);
        const isDiscovery = isDiscoverySection(section);
        const sectionSortBy = section.sortBy || (isDiscovery ? section.sortOrder : '') || '';
        const sectionSortOrder = isDiscovery ? (section.sortOrderDirection || '') : (section.sortOrder || '');

        return {
            section,
            context,
            editorProfile: resolveEditorProfileKey(section, context),
            lockVisibility: context.lockVisibility ?? window.KefinHomeScreenEditorProfiles?.getEditorProfileDefinition(resolveEditorProfileKey(section, context))?.lockVisibility === true,
            itemSource: inferItemSource(section),
            sectionVisibility: sectionToVisibility(section),
            startDate: section.startDate || '',
            endDate: section.endDate || '',
            order: section.order != null ? String(section.order) : '',
            renderMode,
            cardFormat: section.cardFormat || 'Poster',
            useRandomQuery: section.useRandomQuery === true,
            useMultiQueryPicker: section.useMultiQueryPicker === true,
            multiQueryPickerLabel: section.multiQueryPickerLabel || '',
            useQueryNamesForSection: section.useQueryNamesForSection === true,
            sortBy: sectionSortBy,
            sortOrder: sectionSortOrder,
            itemLimit: section.itemLimit != null ? String(section.itemLimit) : '',
            hideWatched: inferHideWatched(section),
            hideName: section.hideName === true,
            userEnabledByDefault: section.enabled !== false,
            userConfigurable: section.hidden !== true,
            groupSelect: groupSelection.groupSelect,
            groupNew: groupSelection.groupNew,
            queries: (section.queries?.length ? section.queries : [createDefaultQuery()]).map(q => ({ ...q })),
            customItems: customEditor ? customEditor.staticItemsToDrafts(section.items) : [],
            customItemEditorIndex: null,
            customItemAdditionalExpanded: {},
            ttlPreset: ttlMatch.preset,
            ttlCustomValue: ttlMatch.customValue,
            ttlCustomUnit: ttlMatch.customUnit,
            livePreviewUpdates: section.livePreviewUpdates === true,
            buildSelect,
            buildTextInput,
            CARD_FORMATS,
            RENDER_MODE_OPTIONS
        };
    }

    function collectStateFromForm(root, state) {
        if (!root || !state) return;

        const nameEl = root.querySelector('#section-name');
        const groupEl = root.querySelector('#section-group');
        const groupNewEl = root.querySelector('#section-group-new');
        const visibilityEl = root.querySelector('#hsae-section-visibility');
        const orderEl = root.querySelector('#section-order');
        const hideWatchedEl = root.querySelector('#hsae-hide-watched');
        const hideNameEl = root.querySelector('#hsae-hide-section-name');
        const startDateEl = root.querySelector('#section-startDate');
        const endDateEl = root.querySelector('#section-endDate');
        const userEnabledEl = root.querySelector('#hsae-user-enabled-by-default');
        const userConfigEl = root.querySelector('#hsae-user-configurable');
        const sortByEl = root.querySelector('#section-sortBy');
        const sortOrderEl = root.querySelector('#section-sortOrder');

        if (nameEl) state.sectionName = nameEl.value;
        if (groupEl) state.groupSelect = groupEl.value;
        if (groupNewEl) state.groupNew = groupNewEl.value;
        if (visibilityEl) state.sectionVisibility = visibilityEl.value;
        if (orderEl) state.order = orderEl.value;
        if (hideWatchedEl) state.hideWatched = hideWatchedEl.checked === true;
        if (hideNameEl) state.hideName = hideNameEl.checked === true;
        if (startDateEl) state.startDate = startDateEl.value;
        if (endDateEl) state.endDate = endDateEl.value;
        if (sortByEl) state.sortBy = sortByEl.value;
        if (sortOrderEl) state.sortOrder = sortOrderEl.value;

        const renderModeValue = root.querySelector('#hsae-render-mode-value')?.value;
        if (renderModeValue) {
            state.renderMode = renderModeValue;
        } else {
            const activeRenderMode = root.querySelector('.hsae-appearance-card.hsae-active[data-render-mode]');
            if (activeRenderMode) {
                state.renderMode = activeRenderMode.dataset.renderMode || state.renderMode;
            }
        }

        const cardFormatValue = root.querySelector('#hsae-card-format-value')?.value;
        if (cardFormatValue) {
            state.cardFormat = cardFormatValue;
        } else {
            const activeCardFormat = root.querySelector('.hsae-card-format-btn.hsae-active[data-card-format]');
            if (activeCardFormat) {
                state.cardFormat = activeCardFormat.dataset.cardFormat || state.cardFormat;
            }
        }

        const randomQueryEl = root.querySelector('#hsae-use-random-query');
        if (randomQueryEl) state.useRandomQuery = randomQueryEl.checked === true;
        const pickerEl = root.querySelector('#hsae-use-multi-query-picker');
        if (pickerEl) state.useMultiQueryPicker = pickerEl.checked === true;
        const pickerLabelEl = root.querySelector('#hsae-multi-query-picker-label');
        if (pickerLabelEl) state.multiQueryPickerLabel = pickerLabelEl.value;
        const useQueryNamesEl = root.querySelector('#hsae-use-query-names-for-section');
        if (useQueryNamesEl) state.useQueryNamesForSection = useQueryNamesEl.checked === true;

        if (userEnabledEl) state.userEnabledByDefault = userEnabledEl.checked === true;
        if (userConfigEl) state.userConfigurable = userConfigEl.checked === true;

        const activePreset = root.querySelector('.hsae-cache-preset.hsae-active');
        if (activePreset) {
            state.ttlPreset = activePreset.dataset.presetKey || 'DEFAULT';
        }
        const ttlCustomValueEl = root.querySelector('#hsae-ttl-custom-value');
        const ttlCustomUnitEl = root.querySelector('#hsae-ttl-custom-unit');
        if (ttlCustomValueEl) state.ttlCustomValue = ttlCustomValueEl.value;
        if (ttlCustomUnitEl) state.ttlCustomUnit = ttlCustomUnitEl.value;

        const customEditor = getCustomItemsEditor();
        if (customEditor && state.itemSource === 'custom') {
            customEditor.collectCustomItemsFromForm(root, state, customEditor.getCustomItemsOptions());
        }

        if (state.itemSource === 'jellyfin') {
            const hideWatched = root.querySelector('#hsae-hide-watched')?.checked === true;
            const editors = root.querySelectorAll('.query-editor');
            if (editors.length) {
                state.queryExpandedStates = Array.from(editors).map(editor => editor.open);
                state.queries = Array.from(editors).map(editor => {
                    const queryIndex = parseInt(editor.dataset.queryIndex, 10);
                    const originalQuery = state.section?.queries?.[queryIndex];
                    return collectQueryFromEditor(editor, queryIndex, hideWatched, root, originalQuery);
                });
            }
        }

        if (state.renderMode === 'Spotlight') {
            const { collectSpotlightConfigFromDialog } = getApi();
            if (typeof collectSpotlightConfigFromDialog === 'function') {
                state.section = state.section || {};
                state.section.spotlightConfig = collectSpotlightConfigFromDialog(root, 'section-spotlight-', { useIntervalSeconds: true });
            }
        }

        const borderColorText = root.querySelector('#hsae-border-color-text');
        if (borderColorText) {
            state.section = state.section || {};
            const borderColor = borderColorText.value.trim();
            if (borderColor) state.section.borderColor = borderColor;
            else delete state.section.borderColor;
        }

        const cardTitleColorText = root.querySelector('#hsae-card-title-color-text');
        if (cardTitleColorText) {
            state.section = state.section || {};
            const cardTitleColor = cardTitleColorText.value.trim();
            if (cardTitleColor) state.section.cardTitleColor = cardTitleColor;
            else delete state.section.cardTitleColor;
        }

        const livePreviewEl = root.querySelector('#hsae-live-preview-updates');
        if (livePreviewEl) state.livePreviewUpdates = livePreviewEl.checked === true;

        const cssClassEl = root.querySelector('#hsae-section-css-class');
        if (cssClassEl) {
            state.section = state.section || {};
            const cssClass = cssClassEl.value.trim();
            if (cssClass) state.section.sectionCssClass = cssClass;
            else delete state.section.sectionCssClass;
        }

        const borderStyleEl = root.querySelector('#hsae-border-style');
        if (borderStyleEl) {
            state.section = state.section || {};
            const borderStyle = borderStyleEl.value.trim();
            if (borderStyle) state.section.borderStyle = borderStyle;
            else delete state.section.borderStyle;
        }

        const itemsLayoutEl = root.querySelector('#hsae-items-layout');
        if (itemsLayoutEl) {
            state.section = state.section || {};
            const itemsLayout = itemsLayoutEl.value;
            if (itemsLayout === 'grid') state.section.itemsLayout = itemsLayout;
            else delete state.section.itemsLayout;
        }

        const cardGapsEl = root.querySelector('#hsae-card-gaps');
        if (cardGapsEl) {
            state.section = state.section || {};
            if (cardGapsEl.value === 'none') state.section.useGaplessCards = true;
            else delete state.section.useGaplessCards;
        }

        const hideCardTitlesEl = root.querySelector('#hsae-hide-card-titles');
        if (hideCardTitlesEl) {
            state.section = state.section || {};
            if (hideCardTitlesEl.checked === true) {
                state.section.cardTitleVisibility = 'hidden';
                state.section.hideCardTitles = true;
            } else {
                delete state.section.cardTitleVisibility;
                delete state.section.hideCardTitles;
            }
        }

        const cardTitlePositionEl = root.querySelector('#hsae-card-title-position');
        if (cardTitlePositionEl) {
            state.section = state.section || {};
            const cardTitlePosition = cardTitlePositionEl.value;
            if (cardTitlePosition && cardTitlePosition !== 'default') state.section.cardTitlePosition = cardTitlePosition;
            else delete state.section.cardTitlePosition;
        }

        const cardTitleCapEl = root.querySelector('#hsae-card-title-capitalization');
        if (cardTitleCapEl) {
            state.section = state.section || {};
            const cap = cardTitleCapEl.value;
            if (cap && cap !== 'normal') state.section.cardTitleCapitalization = cap;
            else delete state.section.cardTitleCapitalization;
        }

        const cardTitleFontFamilyEl = root.querySelector('#hsae-card-title-font-family');
        if (cardTitleFontFamilyEl) {
            state.section = state.section || {};
            const fontFamily = cardTitleFontFamilyEl.value;
            if (fontFamily && fontFamily !== 'default') state.section.cardTitleFontFamily = fontFamily;
            else delete state.section.cardTitleFontFamily;
        }

        const cardTitleFontSizeEl = root.querySelector('#hsae-card-title-font-size');
        if (cardTitleFontSizeEl) {
            state.section = state.section || {};
            const fontSize = cardTitleFontSizeEl.value;
            if (fontSize && fontSize !== 'normal') state.section.cardTitleFontSize = fontSize;
            else delete state.section.cardTitleFontSize;
        }
    }

    function buildChipRow(options, activeValues, attrName) {
        const active = new Set(Array.isArray(activeValues) ? activeValues : []);
        return `
            <div class="hsae-chip-row" data-hsae-chips="${escapeHtml(attrName)}">
                ${options.map(opt => `
                    <button type="button" class="kefin-chip hsae-chip${active.has(opt.value) ? ' hsae-active' : ''}" data-chip-value="${escapeHtml(opt.value)}">${escapeHtml(opt.label)}</button>
                `).join('')}
            </div>
        `;
    }

    function buildFilterChipsRow(queryIndex, queryOptions) {
        const active = parseFiltersString(queryOptions?.Filters);
        return `
            <div class="hsae-field-row">
                <div class="listItemBodyText hsae-subsection-label">Filters</div>
                <div class="listItemBodyText secondary hsae-field-hint">Use these quick filters to narrow the query results.</div>
                ${buildChipRow(FILTER_CHIP_OPTIONS, active, `query-${queryIndex}-filters`)}
                <input type="hidden" id="query-${queryIndex}-Filters" value="${escapeHtml((queryOptions?.Filters || ''))}">
            </div>
        `;
    }

    function buildAdditionalBooleanToggleHTML(inputId, key, label, checked) {
        const { buildToggleCard } = getApi();
        return buildToggleCard(inputId, checked, label, '', {
            checkboxClass: 'additional-option-value',
            checkboxDataAttributes: { key, type: 'boolean' }
        });
    }

    function getAdditionalOptionRowClass(type) {
        const classes = ['additional-option-row', 'hsae-additional-row'];
        if (type === 'custom') classes.push('hsae-additional-row-full');
        return classes.join(' ');
    }

    function buildAdditionalOptionsControls(queryIndex) {
        const { SUPPORTED_QUERY_OPTIONS } = getApi();
        const dropdownOptions = Object.entries(SUPPORTED_QUERY_OPTIONS || {})
            .map(([key, meta]) => `<option value="${escapeHtml(key)}">${escapeHtml(meta.label)}</option>`)
            .join('');

        return `
            <div class="query-${queryIndex}-additional-options-controls hsae-additional-controls" data-query-index="${queryIndex}">
                <div class="hsae-additional-toolbar">
                    <select class="fld emby-select emby-select-withcolor additional-option-select" data-query-index="${queryIndex}">
                        <option value="">Select an option to add...</option>
                        <option value="__custom__">Custom Option</option>
                        ${dropdownOptions}
                    </select>
                    <button type="button" class="emby-button raised hsae-add-additional-option" data-query-index="${queryIndex}">Add</button>
                </div>
            </div>
        `;
    }

    function buildAdditionalOptionsList(queryIndex, queryOptions) {
        const { SUPPORTED_QUERY_OPTIONS } = getApi();
        const badgeKeys = new Set([
            'IncludeItemTypes', 'Genres', 'Tags', 'GenreIds', 'PersonIds', 'StudioIds',
            'CollectionIds', 'PlaylistIds', 'ParentId', 'SortBy', 'SortOrder', 'Limit',
            'Filters', 'SearchTerm', 'IsUnplayed', 'Recursive'
        ]);
        const commonKeys = new Set(['SortBy', 'SortOrder', 'Limit', 'Filters', 'SearchTerm']);
        const additionalOptions = [];

        Object.entries(queryOptions || {}).forEach(([key, value]) => {
            if (key.startsWith('_') || badgeKeys.has(key) || commonKeys.has(key)) return;
            additionalOptions.push({ key, value });
        });

        const optionsHtml = additionalOptions.map((option, index) => {
            const meta = SUPPORTED_QUERY_OPTIONS?.[option.key] || { label: option.key, type: 'string' };
            const inputId = `query-${queryIndex}-additionalOption-${index}`;
            let inputField = '';

            if (meta.type === 'boolean') {
                const isChecked = option.value === true || option.value === 'true';
                inputField = buildAdditionalBooleanToggleHTML(inputId, option.key, meta.label, isChecked);
            } else {
                const displayValue = Array.isArray(option.value) ? option.value.join(',') : (option.value ?? '');
                inputField = `
                    <div class="hsae-additional-field">
                        <div class="listItemBodyText hsae-field-label">${escapeHtml(meta.label)}</div>
                        <input type="${meta.type === 'number' ? 'number' : (meta.type === 'date' ? 'date' : 'text')}"
                               id="${inputId}"
                               class="fld emby-input additional-option-value"
                               value="${escapeHtml(displayValue)}"
                               data-key="${escapeHtml(option.key)}"
                               data-type="${escapeHtml(meta.type || 'string')}"
                               placeholder="${escapeHtml(meta.hint || '')}">
                    </div>
                `;
            }

            return `
                <div class="${getAdditionalOptionRowClass(meta.type === 'boolean' ? 'boolean' : 'field')}">
                    ${inputField}
                    <button type="button" class="hsae-remove-additional-option" title="Remove Option">
                        <span class="material-icons">close</span>
                    </button>
                </div>
            `;
        }).join('');

        return `
            <div class="query-${queryIndex}-additional-options-list-container" data-query-index="${queryIndex}">
                <div class="additional-options-list hsae-additional-options-grid" data-query-index="${queryIndex}">
                    ${optionsHtml}
                </div>
            </div>
        `;
    }

    function buildStaticItemsListHTML(items) {
        if (!items.length) {
            return '<p class="listItemBodyText secondary hsae-static-items-empty">No items selected yet.</p>';
        }
        return items.map(item => `
            <div class="hsae-static-item-row" data-item-id="${escapeHtml(item.id)}">
                <span class="listItemBodyText hsae-static-item-label">${escapeHtml(item.name || item.id)}</span>
                <button type="button" class="hsae-static-item-remove" data-hsae-action="remove-static-item" data-item-id="${escapeHtml(item.id)}" title="Remove" aria-label="Remove ${escapeHtml(item.name || item.id)}">
                    <span class="material-icons">delete</span>
                </button>
            </div>
        `).join('');
    }

    function buildStaticItemsSectionHTML(queryIndex, items) {
        const selectedJson = serializeSelectionItems(items);
        return `
            <section class="hsae-static-items-section hsae-query-static-only">
                <div class="listItemBodyText hsae-subsection-label">Select Items</div>
                <div class="listItemBodyText secondary hsae-field-hint">Pick specific items from your library to appear in this section.</div>
                <div class="hsae-static-items-list" data-query-index="${queryIndex}">
                    ${buildStaticItemsListHTML(items)}
                </div>
                <button type="button" class="hsae-static-item-add-btn" data-hsae-action="add-static-item" data-query-index="${queryIndex}" title="Add Item" aria-label="Add Item">
                    <span class="material-icons">add</span>
                    <span class="listItemBodyText">Add Item</span>
                </button>
                <input type="hidden" class="hsae-static-items-value" id="query-${queryIndex}-staticItems" value="${escapeHtml(selectedJson)}">
            </section>
        `;
    }

    function buildEndpointSelectHTML(index, selectedValue, disabled = false) {
        const { buildSelect } = getApi();
        const html = buildSelect(
            `query-${index}-endpoint`,
            ENDPOINT_OPTIONS.map(o => ({ value: o.value, label: o.label })),
            selectedValue,
            'Endpoint'
        );
        if (!disabled) return html;
        return html.replace(
            `id="query-${index}-endpoint" class="fld emby-select emby-select-withcolor"`,
            `id="query-${index}-endpoint" class="fld emby-select emby-select-withcolor" disabled`
        );
    }

    function setStaticItemsInEditor(editor, queryIndex, items) {
        if (!editor) return;
        const hidden = editor.querySelector(`#query-${queryIndex}-staticItems`);
        if (hidden) hidden.value = serializeSelectionItems(items);
        const list = editor.querySelector(`.hsae-static-items-list[data-query-index="${queryIndex}"]`);
        if (list) list.innerHTML = buildStaticItemsListHTML(items);
    }

    function buildQueryCard(query, index, canDelete, isExpanded = true) {
        const { buildSelect, buildTextInput, SORT_ORDERS, SORT_ORDER_DIRECTIONS } = getApi();
        const queryOptions = query.queryOptions || {};
        const sourceType = inferQuerySourceType(query);
        const endpointValue = sourceType === 'static' ? 'Items' : inferEndpointValue(query);
        const customPathDisplay = endpointValue === 'Custom' && sourceType === 'jellyfin' ? 'block' : 'none';
        const cacheDisplay = sourceType === 'cache' ? 'block' : 'none';
        const endpointDisplay = sourceType === 'jellyfin' || sourceType === 'static' ? 'block' : 'none';
        const jellyfinDisplay = sourceType === 'jellyfin' ? 'block' : 'none';
        const staticDisplay = sourceType === 'static' ? 'block' : 'none';
        const staticItems = getQueryStaticItems(query);

        const parentSelection = getQueryParentSelection(query);
        const includeTypes = Array.isArray(queryOptions.IncludeItemTypes)
            ? queryOptions.IncludeItemTypes
            : (queryOptions.IncludeItemTypes ? String(queryOptions.IncludeItemTypes).split(',').map(s => s.trim()).filter(Boolean) : []);

        return `
            <details class="hsae-query-card query-editor" data-query-index="${index}"${isExpanded ? ' open' : ''}>
                <summary class="hsae-query-summary">
                    <span class="hsae-query-title-wrap" data-hsae-profiles="full">
                        <input
                            type="text"
                            class="hsae-query-name-input listItemBodyText"
                            id="query-${index}-name"
                            value="${escapeHtml(query.name || '')}"
                            placeholder="Query ${index + 1}"
                            aria-label="Query name"
                        >
                    </span>
                    <span class="hsae-query-badge" data-hsae-profiles="full">${escapeHtml(getQuerySourceBadgeLabel(sourceType))}</span>
                    ${canDelete ? `<button type="button" class="emby-button raised hsae-delete-query-btn" data-query-index="${index}" data-hsae-action="delete-query" data-hsae-profiles="full">Delete</button>` : ''}
                </summary>
                <div class="hsae-query-body">
                    <div class="hsae-query-divider hsae-query-header-divider" role="separator" aria-hidden="true" data-hsae-profiles="full"></div>
                    <div class="hsae-field-grid hsae-field-grid-2 hsae-query-row-a" data-hsae-profiles="full">
                        ${buildSelect(`query-${index}-sourceType`, [
                            { value: 'jellyfin', label: 'Jellyfin Server' },
                            { value: 'cache', label: 'Client Cache' },
                            { value: 'static', label: 'Static Items' }
                        ], sourceType, 'Query Type')}
                        <div class="hsae-endpoint-wrap hsae-jellyfin-endpoint-wrap" data-query-index="${index}" style="display:${endpointDisplay};">
                            ${buildEndpointSelectHTML(index, endpointValue, sourceType === 'static')}
                        </div>
                        <div class="hsae-cache-wrap" data-query-index="${index}" style="display:${cacheDisplay};">
                            ${buildSelect(`query-${index}-dataSource`, CACHE_SOURCE_OPTIONS, query.dataSource || CACHE_SOURCE_OPTIONS[0].value, 'Cache Source')}
                        </div>
                        <div id="query-${index}-path-container" class="hsae-custom-path hsae-query-jellyfin-only" style="display:${customPathDisplay};">
                            ${buildTextInput(`query-${index}-path`, query.path || '', 'Custom Endpoint Path', 'text', '/Shows/Upcoming, etc.')}
                        </div>
                    </div>

                    <div class="hsae-field-grid hsae-query-row-sort${sourceType === 'static' ? ' hsae-field-grid-2' : ''}">
                        <div class="hsae-query-sort-by" data-hsae-profiles="full normal dateCutoffs">
                            ${buildSelect(`query-${index}-SortBy`, toSortBySelectOptions(SORT_ORDERS), queryOptions.SortBy || '', 'Sort By')}
                        </div>
                        <div class="hsae-query-sort-order" data-hsae-profiles="full normal dateCutoffs">
                            ${buildSelect(`query-${index}-SortOrder`, SORT_ORDER_DIRECTIONS, queryOptions.SortOrder || '', 'Sort Order')}
                        </div>
                        <div class="hsae-query-limit hsae-query-jellyfin-only" data-hsae-profiles="full minimal postProcessing normal dateCutoffs" style="display:${jellyfinDisplay};">
                            ${buildTextInput(`query-${index}-Limit`, queryOptions.Limit ?? '', 'Limit', 'number', '', { min: 0, step: 1 })}
                        </div>
                        <div class="hsae-query-search hsae-query-jellyfin-only" data-hsae-profiles="full" style="display:${jellyfinDisplay};">
                            ${buildTextInput(`query-${index}-SearchTerm`, queryOptions.SearchTerm || '', 'Search Term')}
                        </div>
                    </div>

                    <div class="hsae-query-static-only" data-hsae-profiles="full" style="display:${staticDisplay};">
                        <div class="hsae-query-divider" role="separator" aria-hidden="true"></div>
                        ${buildStaticItemsSectionHTML(index, staticItems)}
                    </div>

                    <div class="hsae-query-jellyfin-only" data-hsae-profiles="full" style="display:${jellyfinDisplay};">
                        <div class="hsae-query-divider hsae-query-divider-before-include-types" role="separator" aria-hidden="true"></div>

                        <div class="hsae-query-row-b">
                            ${buildIncludeItemTypesHTML(index, includeTypes)}
                        </div>

                        <div class="hsae-query-divider hsae-query-divider-before-parent" role="separator" aria-hidden="true"></div>

                        <div class="hsae-query-row-c">
                            <div class="listItemBodyText hsae-subsection-label">Parent Item</div>
                            <div class="listItemBodyText secondary hsae-field-hint">Use this to show items that are children of a specific parent item. This could be a Collection, Playlist, Library, etc.</div>
                            <div class="hsae-select-card-grid" data-select-group="parent" data-query-index="${index}">
                                ${PARENT_SELECTION_CARD_TYPES.map(card => buildSelectCardHTML({
                                    queryIndex: index,
                                    kind: 'parent',
                                    type: card.type,
                                    label: card.label,
                                    description: card.description,
                                    icon: card.icon,
                                    items: parentSelection.type === card.type ? parentSelection.items : [],
                                    active: parentSelection.type === card.type
                                })).join('')}
                            </div>
                        </div>

                        <div class="hsae-query-divider hsae-query-divider-parent-filters" role="separator" aria-hidden="true"></div>

                        <div class="hsae-query-row-e">
                            ${buildFilterChipsRow(index, queryOptions)}
                        </div>

                        <div class="hsae-select-card-grid hsae-query-row-f" data-select-group="facet" data-query-index="${index}">
                            ${FACET_SELECTION_CARD_TYPES.map(card => buildSelectCardHTML({
                                queryIndex: index,
                                kind: 'facet',
                                type: card.type,
                                label: card.label,
                                description: card.description,
                                icon: card.icon,
                                items: getQueryFacetSelection(query, card.type)
                            })).join('')}
                        </div>

                        <div class="hsae-query-divider hsae-query-divider-before-additional" role="separator" aria-hidden="true"></div>

                        <details class="hsae-additional-details">
                            <summary class="hsae-details-summary">
                                <span class="material-icons hsae-advanced-chevron">expand_more</span>
                                <span class="listItemBodyText">Additional Options</span>
                            </summary>
                            <div class="hsae-additional-body">
                                ${buildAdditionalOptionsControls(index)}
                                ${buildAdditionalOptionsList(index, queryOptions)}
                            </div>
                        </details>
                    </div>
                </div>
            </details>
        `;
    }

    function buildBasicPropertiesHTML(state, context) {
        const { buildSelect, buildTextInput, buildToggleCard } = getApi();
        const section = state.section || {};
        const visibility = state.sectionVisibility || 'normal';
        const showSeasonal = visibility === 'seasonal';
        const lockVisibility = state.lockVisibility === true;
        const orderValue = visibility === 'discovery'
            ? 'Auto'
            : (state.order ?? section.order ?? '');
        const showHideWatched = state.itemSource === 'jellyfin';

        const existingGroupNames = context.existingGroupNames || [];
        const groupOptions = ['New...', ...existingGroupNames];
        const selectedGroup = state.groupSelect || groupOptions[0] || 'New...';
        let visibilitySelectHtml = buildSelect('hsae-section-visibility', SECTION_VISIBILITY_OPTIONS, visibility, 'Type');
        if (lockVisibility) {
            visibilitySelectHtml = visibilitySelectHtml.replace(
                'id="hsae-section-visibility" class="fld emby-select emby-select-withcolor"',
                'id="hsae-section-visibility" class="fld emby-select emby-select-withcolor" disabled'
            );
        }

        return `
            <section class="hsae-group hsae-basic-properties">
                <div class="hsae-group-header">
                    <div class="listItemBodyText hsae-group-title">Basic Properties</div>
                    <div class="listItemBodyText secondary hsae-group-desc">General configuration for this section</div>
                </div>
                <div class="hsae-card">
                    <div class="hsae-inline-row">
                        ${buildTextInput('section-name', section.name || state.sectionName || '', 'Section Name')}
                        <div data-hsae-profiles="full">
                            ${buildSelect('section-group', groupOptions, selectedGroup, 'Section Group')}
                            <div id="section-group-new-container" class="hsae-group-new" style="display:${selectedGroup === 'New...' ? 'block' : 'none'};">
                                ${buildTextInput('section-group-new', state.groupNew || '', 'New Group Name')}
                            </div>
                        </div>
                    </div>

                    <div class="hsae-field-grid hsae-field-grid-2 hsae-basic-dropdowns">
                        ${visibilitySelectHtml}
                        <div class="hsae-field-wrap">
                            <label class="listItemBodyText" for="section-order" style="display: block; margin-bottom: 0.25em;">Order</label>
                            <input
                                type="${visibility === 'discovery' ? 'text' : 'number'}"
                                id="section-order"
                                class="fld emby-input"
                                value="${escapeHtml(orderValue)}"
                                placeholder="Auto"
                                ${visibility === 'discovery' ? 'disabled' : ''}
                            >
                        </div>
                    </div>

                    ${showSeasonal ? `
                        <div class="hsae-field-grid hsae-seasonal-dates">
                            ${buildTextInput('section-startDate', state.startDate || '', 'Start Date (MM-DD)', 'text')}
                            ${buildTextInput('section-endDate', state.endDate || '', 'End Date (MM-DD)', 'text')}
                        </div>
                    ` : ''}

                    <div class="hsae-query-divider" role="separator" aria-hidden="true"></div>

                    <div class="hsae-toggle-card-grid">
                        ${buildToggleCard(
                            'hsae-user-enabled-by-default',
                            state.userEnabledByDefault !== false,
                            'Default Status',
                            USER_TOGGLE_TOOLTIPS.userEnabledByDefault[state.userEnabledByDefault !== false ? 'on' : 'off'],
                            { hintKey: 'userEnabledByDefault' }
                        )}
                        ${buildToggleCard(
                            'hsae-user-configurable',
                            state.userConfigurable !== false,
                            'User Configuration',
                            USER_TOGGLE_TOOLTIPS.userConfigurable[state.userConfigurable !== false ? 'on' : 'off'],
                            { hintKey: 'userConfigurable' }
                        )}
                    </div>

                    <div class="hsae-toggle-card-grid">
                        ${buildToggleCard(
                            'hsae-hide-section-name',
                            state.hideName === true,
                            'Hide Section Name',
                            HIDE_NAME_TOGGLE_DESCRIPTIONS[state.hideName === true ? 'on' : 'off'],
                            { hintKey: 'hideName' }
                        )}
                        ${showHideWatched ? buildToggleCard(
                            'hsae-hide-watched',
                            state.hideWatched === true,
                            'Hide Watched Items',
                            HIDE_WATCHED_TOGGLE_DESCRIPTIONS[state.hideWatched === true ? 'on' : 'off'],
                            { hintKey: 'hideWatched' }
                        ) : ''}
                    </div>
                </div>
            </section>
        `;
    }

    function buildItemSourceHTML(state) {
        const itemSource = state.itemSource || 'jellyfin';
        return `
            <section class="hsae-group hsae-item-source" data-hsae-profiles="full">
                <div class="hsae-group-header">
                    <div class="listItemBodyText hsae-group-title">Item Source</div>
                    <div class="listItemBodyText secondary hsae-group-desc">Choose where this section gets its items</div>
                </div>
                <div class="hsae-source-grid">
                    <button type="button" class="hsae-source-card${itemSource === 'jellyfin' ? ' hsae-active' : ''}" data-hsae-action="set-item-source" data-item-source="jellyfin">
                        <div class="hsae-source-card-text">
                            <div class="listItemBodyText hsae-source-title">
                                <span class="material-icons hsae-source-icon">dns</span>
                                Jellyfin Server
                            </div>
                            <div class="listItemBodyText secondary hsae-source-desc">Query items from your Jellyfin library</div>
                        </div>
                    </button>
                    <button type="button" class="hsae-source-card${itemSource === 'custom' ? ' hsae-active' : ''}" data-hsae-action="set-item-source" data-item-source="custom">
                        <div class="hsae-source-card-text">
                            <div class="listItemBodyText hsae-source-title">
                                <span class="material-icons hsae-source-icon">widgets</span>
                                Custom Items
                            </div>
                            <div class="listItemBodyText secondary hsae-source-desc">${escapeHtml(CUSTOM_SOURCE_DESC)}</div>
                        </div>
                    </button>
                </div>
            </section>
        `;
    }

    function buildQueriesHTML(state) {
        const queries = state.queries?.length ? state.queries : [createDefaultQuery()];
        const expandedStates = state.queryExpandedStates;
        const hasMultiple = queries.length >= 2;
        const { buildSelect, buildToggleCard, buildTextInput, SORT_ORDERS, SORT_ORDER_DIRECTIONS } = getApi();
        const useRandomQuery = state.useRandomQuery === true;
        const useMultiQueryPicker = state.useMultiQueryPicker === true;

        return `
            <section class="hsae-group hsae-queries-group">
                <div class="hsae-group-header hsae-queries-header">
                    <div class="hsae-queries-title-wrap">
                        <div class="listItemBodyText hsae-group-title">Queries</div>
                        <a href="https://api.jellyfin.org/" target="_blank" rel="noopener" class="hsae-info-link" title="Jellyfin API documentation">
                            <span class="material-icons info"></span>
                        </a>
                    </div>
                    <div class="listItemBodyText secondary hsae-group-desc">Define what content appears in this section</div>
                </div>
                <div id="queries-list" class="hsae-queries-list">
                    ${queries.map((query, index) => buildQueryCard(
                        query,
                        index,
                        queries.length > 1,
                        expandedStates ? expandedStates[index] !== false : true
                    )).join('')}
                </div>
                <button type="button" class="emby-button raised hsae-add-query-btn add-query-btn" data-hsae-profiles="full">Add Query</button>
                ${hasMultiple ? `
                    <section class="hsae-group hsae-multi-query-settings" data-hsae-profiles="full">
                        <div class="hsae-group-header">
                            <div class="listItemBodyText hsae-group-title">Multi-Query Settings</div>
                            <div class="listItemBodyText secondary hsae-group-desc">Control how the multiple queries are handled</div>
                        </div>
                        <div class="hsae-card">
                            <div class="hsae-toggle-card-grid hsae-multi-query-toggle-row">
                                ${buildToggleCard(
                                    'hsae-use-random-query',
                                    useRandomQuery,
                                    'Use Random Query',
                                    RANDOM_QUERY_TOGGLE_DESCRIPTIONS[useRandomQuery ? 'on' : 'off'],
                                    { hintKey: 'useRandomQuery' }
                                )}
                                ${buildToggleCard(
                                    'hsae-use-multi-query-picker',
                                    useMultiQueryPicker,
                                    'Query Picker',
                                    QUERY_PICKER_TOGGLE_DESCRIPTIONS[useMultiQueryPicker ? 'on' : 'off'],
                                    { hintKey: 'useMultiQueryPicker' }
                                )}
                            </div>
                            <div id="hsae-multi-query-picker-rows" style="display:${useMultiQueryPicker ? 'block' : 'none'};">
                                <div class="hsae-field-grid hsae-multi-query-picker-label-row">
                                    ${buildTextInput('hsae-multi-query-picker-label', state.multiQueryPickerLabel || '', 'Label for Multi Query Picker button', 'text', 'The multi-query picker control will use this label instead of the name of the query being displayed.')}
                                </div>
                                <div class="hsae-toggle-card-grid">
                                    ${buildToggleCard(
                                        'hsae-use-query-names-for-section',
                                        state.useQueryNamesForSection === true,
                                        'Use Query Names for the Section Name',
                                        USE_QUERY_NAMES_TOGGLE_DESCRIPTIONS[state.useQueryNamesForSection === true ? 'on' : 'off'],
                                        { hintKey: 'useQueryNamesForSection' }
                                    )}
                                </div>
                            </div>
                        </div>
                    </section>
                ` : ''}
            </section>
        `;
    }

    function buildCustomItemsHTML(state) {
        const customEditor = getCustomItemsEditor();
        const html = customEditor
            ? customEditor.renderCustomItemsHTML(state, customEditor.getCustomItemsOptions())
            : '<div class="listItemBodyText secondary">Custom items editor not available.</div>';

        return `
            <section class="hsae-group hsae-custom-items-group" data-hsae-profiles="full">
                <div class="hsae-group-header">
                    <div class="listItemBodyText hsae-group-title">Custom Items</div>
                    <div class="listItemBodyText secondary hsae-group-desc">Create cards with custom images and links</div>
                </div>
                <div class="hsae-custom-items-stage">${html}</div>
            </section>
        `;
    }

    function buildSpotlightInnerHTML(state, context) {
        const section = state.section || {};
        const {
            buildSelect, buildTextInput, buildToggleCard,
            SPOTLIGHT_LAYOUT_OPTIONS, SPOTLIGHT_SIZE_OPTIONS, SPOTLIGHT_TILE_COUNT_OPTIONS,
            SPOTLIGHT_ENTRANCE_OPTIONS, SPOTLIGHT_SLIDE_OPTIONS, SLIDE_STATE_OPTIONS
        } = getApi();

        const globalSpotlight = context.config?.SPOTLIGHT_SETTINGS || {};
        const spotlightDefaults = window.KefinHomeConfig2?.SPOTLIGHT_SETTINGS || {};
        const sectionSpotlight = section.spotlightConfig || {};
        const spotlightOpts = { ...spotlightDefaults, ...globalSpotlight, ...sectionSpotlight };
        const spotlightLayout = spotlightOpts.spotlightLayout ?? 'Border';
        const spotlightSize = spotlightOpts.spotlightSize ?? 'normal';
        const tileCount = Math.max(1, Math.min(3, parseInt(spotlightOpts.tileCount, 10) || 1));
        const tileCountStr = String(tileCount);
        const slideStateVal = spotlightOpts.showSlideState === false ? 'none' : (spotlightOpts.showDots === false ? 'numeric' : 'dots');
        const intervalSeconds = Math.round((spotlightOpts.interval ?? 10000) / 1000);
        const cycleBackdropsOn = spotlightOpts.cycleBackdrops === true;
        const rawBackdropsCount = spotlightOpts.backdropsCount ?? (spotlightOpts.cycleBackdropsTime && spotlightOpts.interval
            ? Math.max(1, Math.round(spotlightOpts.interval / spotlightOpts.cycleBackdropsTime))
            : 2);
        const backdropsCount = cycleBackdropsOn ? Math.max(2, parseInt(rawBackdropsCount, 10) || 2) : Math.max(1, parseInt(rawBackdropsCount, 10) || 1);
        const animateSlides = spotlightOpts.panAnimation !== false;

        function animRow(n) {
            const ord = n === 1 ? 'First' : n === 2 ? 'Second' : 'Third';
            return `
                <div class="hsae-field-grid hsae-field-grid-2 hsae-spotlight-anim-pair">
                    ${buildSelect('section-spotlight-entranceAnimation' + ord, SPOTLIGHT_ENTRANCE_OPTIONS, spotlightOpts['entranceAnimation' + ord] ?? 'fadeIn', 'Entrance animation ' + n)}
                    ${buildSelect('section-spotlight-slideAnimation' + ord, SPOTLIGHT_SLIDE_OPTIONS, spotlightOpts['slideAnimation' + ord] ?? 'kenBurnsZoomIn', 'Slide animation ' + n)}
                </div>
            `;
        }

        function spotlightToggle(id, checked, label) {
            return buildToggleCard(id, checked, label, SPOTLIGHT_TOGGLE_DESCRIPTIONS[id] || '');
        }

        return `
            <div id="section-spotlight-options-container" class="hsae-spotlight-inner">
                <div class="hsae-field-grid hsae-field-grid-4 hsae-spotlight-row-1">
                    ${buildSelect('section-spotlight-spotlightLayout', SPOTLIGHT_LAYOUT_OPTIONS, spotlightLayout, 'Layout')}
                    ${buildSelect('section-spotlight-spotlightSize', SPOTLIGHT_SIZE_OPTIONS, spotlightSize, 'Size')}
                    ${buildSelect('section-spotlight-tileCount', SPOTLIGHT_TILE_COUNT_OPTIONS, tileCountStr, 'Tiled Backdrops')}
                    ${buildSelect('section-spotlight-slideState', SLIDE_STATE_OPTIONS, slideStateVal, 'Slide State')}
                </div>
                <div class="hsae-toggle-card-grid hsae-spotlight-row-2">
                    ${spotlightToggle('section-spotlight-panAnimation', animateSlides, 'Animate Slides')}
                    ${spotlightToggle('section-spotlight-showNavButtons', spotlightOpts.showNavButtons !== false, 'Show Controls')}
                    ${spotlightToggle('section-spotlight-showClearArt', spotlightOpts.showClearArt === true, 'Show Clear Art')}
                    ${spotlightToggle('section-spotlight-cycleBackdrops', cycleBackdropsOn, 'Cycle Backdrops')}
                </div>
                <div id="section-spotlight-backdrops-row" class="hsae-spotlight-backdrops-row" style="display:${cycleBackdropsOn ? 'block' : 'none'};">
                    ${buildTextInput('section-spotlight-backdropsCount', backdropsCount, 'Backdrops Count', 'number')}
                </div>
                <div id="section-spotlight-animation-divider" class="hsae-query-divider" role="separator" aria-hidden="true" style="display:${animateSlides ? 'block' : 'none'};"></div>
                <div id="section-spotlight-animation-dropdowns" class="hsae-spotlight-animations hsae-spotlight-animations--${tileCount}" style="display:${animateSlides ? 'grid' : 'none'};">
                    <div id="section-spotlight-anim-first" class="hsae-spotlight-anim-group">${animRow(1)}</div>
                    <div id="section-spotlight-anim-second" class="hsae-spotlight-anim-group" style="display:${tileCount >= 2 ? 'block' : 'none'};">${animRow(2)}</div>
                    <div id="section-spotlight-anim-third" class="hsae-spotlight-anim-group" style="display:${tileCount >= 3 ? 'block' : 'none'};">${animRow(3)}</div>
                </div>
                <div class="hsae-field-grid hsae-field-grid-2 hsae-spotlight-row-autoplay">
                    ${spotlightToggle('section-spotlight-autoPlay', spotlightOpts.autoPlay !== false, 'Cycle Slides Automatically')}
                    ${buildTextInput('section-spotlight-interval', intervalSeconds, 'Slide Timer (seconds)', 'number')}
                </div>
            </div>
        `;
    }

    /**
     * Appearance-panel draft: same form→section path as save/Preview, forced to Normal cards.
     * @param {HTMLElement} dialog
     * @param {Object} originalSection
     * @returns {Object|null}
     */
    function buildAppearancePreviewDraft(dialog, originalSection) {
        const draft = collectData(dialog, originalSection);
        if (!draft) return null;
        return {
            ...draft,
            renderMode: 'Normal'
        };
    }

    function getAppearancePreviewFetchKeyFromDraft(draft) {
        return JSON.stringify({
            itemSource: inferItemSource(draft),
            queries: draft?.queries,
            items: draft?.items,
            hideWatched: Array.isArray(draft?.queries)
                && draft.queries.length > 0
                && draft.queries.every(q => q?.queryOptions?.IsUnplayed === true)
        });
    }

    function getAppearancePreviewRenderKeyFromDraft(draft) {
        return JSON.stringify({
            fetch: getAppearancePreviewFetchKeyFromDraft(draft),
            cardFormat: draft?.cardFormat,
            sortBy: draft?.sortBy,
            sortOrder: draft?.sortOrder,
            itemsLayout: draft?.itemsLayout,
            cardTitleVisibility: draft?.cardTitleVisibility,
            hideCardTitles: draft?.hideCardTitles,
            cardTitlePosition: draft?.cardTitlePosition,
            cardTitleCapitalization: draft?.cardTitleCapitalization,
            cardTitleFontFamily: draft?.cardTitleFontFamily,
            cardTitleFontSize: draft?.cardTitleFontSize,
            borderStyle: draft?.borderStyle,
            borderColor: draft?.borderColor,
            cardTitleColor: draft?.cardTitleColor,
            sectionCssClass: draft?.sectionCssClass,
            hideName: draft?.hideName
        });
    }

    const LIVE_PREVIEW_DEBOUNCE_MS = 1000;

    let appearancePreviewDebounceTimer = null;
    let appearancePreviewRequestId = 0;
    let appearancePreviewCache = { fetchKey: null, renderKey: null, items: null };

    function clearAppearancePreviewScheduling() {
        if (appearancePreviewDebounceTimer) {
            clearTimeout(appearancePreviewDebounceTimer);
            appearancePreviewDebounceTimer = null;
        }
        appearancePreviewRequestId += 1;
    }

    async function runAppearancePreview(modalInstance, options = {}) {
        const state = modalInstance?._hsaeState;
        if (!state || state.renderMode !== 'Normal') return;

        const root = modalInstance.dialogContent;
        const container = root?.querySelector('#hsae-appearance-preview-container');
        if (!container) return;

        const fetchPreview = window.KefinHomeScreen?.fetchSectionPreviewItems;
        const renderPreview = window.KefinHomeScreen?.renderSectionPreviewInto;
        if (typeof fetchPreview !== 'function' || typeof renderPreview !== 'function') {
            container.innerHTML = '<p class="listItemBodyText secondary hsae-preview-placeholder">Preview unavailable.</p>';
            return;
        }

        // Keep live editor UI state in sync; draft for fetch/render comes from collectData only.
        collectStateFromForm(root, state);

        const dialog = modalInstance.dialogContainer || modalInstance.dialogContent;
        const originalSection = state.section || {};
        const getDraftSection = () => buildAppearancePreviewDraft(dialog, originalSection);

        const draft = getDraftSection();
        if (!draft) {
            container.innerHTML = '<p class="listItemBodyText secondary hsae-preview-placeholder">Preview unavailable.</p>';
            return;
        }

        const fetchKey = getAppearancePreviewFetchKeyFromDraft(draft);
        const renderKey = getAppearancePreviewRenderKeyFromDraft(draft);
        const requestId = ++appearancePreviewRequestId;
        const forceFetch = options.forceFetch === true;
        const cacheHit = !forceFetch
            && appearancePreviewCache.fetchKey === fetchKey
            && appearancePreviewCache.items !== null;

        if (!cacheHit) {
            container.innerHTML = '<p class="listItemBodyText secondary hsae-preview-placeholder">Loading preview…</p>';
        }

        try {
            if (!cacheHit) {
                const { items } = await fetchPreview(draft);
                if (requestId !== appearancePreviewRequestId) return;
                appearancePreviewCache = { fetchKey, renderKey, items };
            } else {
                appearancePreviewCache.renderKey = renderKey;
            }

            if (requestId !== appearancePreviewRequestId) return;

            const previewItems = appearancePreviewCache.items || [];
            if (previewItems.length === 0) {
                container.innerHTML = '<p class="listItemBodyText secondary hsae-preview-placeholder">No items found for preview.</p>';
                return;
            }

            await renderPreview(getDraftSection(), previewItems, container, { getDraftSection });
        } catch (err) {
            if (requestId !== appearancePreviewRequestId) return;
            appearancePreviewCache = { fetchKey: null, renderKey: null, items: null };
            container.innerHTML = `<p class="listItemBodyText secondary hsae-preview-placeholder">${escapeHtml(err.message || 'Preview failed')}</p>`;
        }
    }

    function scheduleAppearancePreview(modalInstance, options = {}) {
        const state = modalInstance?._hsaeState;
        if (!state || state.renderMode !== 'Normal') return;

        const root = modalInstance.dialogContent;
        if (!root?.querySelector('#hsae-appearance-preview-container')) return;

        if (options.immediate) {
            if (appearancePreviewDebounceTimer) {
                clearTimeout(appearancePreviewDebounceTimer);
                appearancePreviewDebounceTimer = null;
            }
            runAppearancePreview(modalInstance, options);
            return;
        }

        if (!state.livePreviewUpdates) return;

        if (appearancePreviewDebounceTimer) clearTimeout(appearancePreviewDebounceTimer);
        appearancePreviewDebounceTimer = setTimeout(() => {
            appearancePreviewDebounceTimer = null;
            runAppearancePreview(modalInstance);
        }, LIVE_PREVIEW_DEBOUNCE_MS);
    }

    function buildAppearanceAdvancedHTML(state) {
        const { buildTextInput, buildToggleCard } = getApi();
        const section = state.section || {};
        const renderMode = state.renderMode || 'Normal';
        const showItemsLayout = renderMode === 'Normal' || renderMode === 'Random';
        const hideCardTitles = section.cardTitleVisibility === 'hidden' || section.hideCardTitles === true;
        const itemsLayout = section.itemsLayout === 'grid' ? 'grid' : 'row';
        const cardGaps = section.useGaplessCards === true ? 'none' : '';
        const borderColor = section.borderColor || '';
        const borderColorDefault = (borderColor && (/^#([0-9A-Fa-f]{3,4}|[0-9A-Fa-f]{6}|[0-9A-Fa-f]{8})$/i.test(borderColor) || /^(rgb|hsl)a?\(/i.test(borderColor)))
            ? borderColor
            : '#e8dab2';
        const cardTitleColor = section.cardTitleColor || '';
        const cardTitleColorDefault = (cardTitleColor && (/^#([0-9A-Fa-f]{3,4}|[0-9A-Fa-f]{6}|[0-9A-Fa-f]{8})$/i.test(cardTitleColor) || /^(rgb|hsl)a?\(/i.test(cardTitleColor)))
            ? cardTitleColor
            : '#ffffff';
        const cardTitlePosition = section.cardTitlePosition || 'default';

        return `
            <div class="hsae-query-divider" role="separator" aria-hidden="true"></div>
            <details class="hsae-appearance-advanced">
                <summary class="hsae-advanced-summary">
                    <div class="hsae-advanced-summary-left">
                        <span class="material-icons hsae-advanced-chevron">expand_more</span>
                        <span class="listItemBodyText hsae-group-title">More appearance options</span>
                    </div>
                    <span class="listItemBodyText secondary hsae-group-desc">Borders, titles, layout</span>
                </summary>
                <div class="hsae-appearance-advanced-body">
                    <div class="hsae-field-grid hsae-field-grid-2">
                        <div class="hsae-field-with-hint">
                            ${buildSelectFromOptions('hsae-border-style', BORDER_STYLE_OPTIONS, section.borderStyle || '', 'Border Style')}
                            <div class="listItemBodyText secondary hsae-field-hint">Adds a border to the card images in this section.</div>
                        </div>
                        <div class="hsae-field-with-hint">
                            <label class="inputLabel inputLabelUnfocused" for="hsae-border-color-text">Border Color</label>
                            <div class="hsae-color-input-row">
                                <div id="hsae-border-color-pickr" class="hsae-color-pickr-host hsae-border-color-pickr-host" aria-label="Border Color" style="--hsae-swatch-color:${escapeHtml(borderColorDefault)}" role="button" tabindex="0"></div>
                                <input type="text" id="hsae-border-color-text" class="emby-input" value="${escapeHtml(section.borderColor || '')}" placeholder="CSS color (optional)" aria-label="Border Color CSS" data-pickr-default="${escapeHtml(borderColorDefault)}">
                            </div>
                            <div class="listItemBodyText secondary hsae-field-hint">CSS color for card borders.</div>
                        </div>
                    </div>
                    <div class="hsae-toggle-card-grid">
                        ${buildToggleCard(
                            'hsae-hide-card-titles',
                            hideCardTitles,
                            'Hide Card Titles',
                            ADVANCED_TOGGLE_DESCRIPTIONS['hsae-hide-card-titles']
                        )}
                    </div>
                    <div id="hsae-card-title-options-row" style="display:${hideCardTitles ? 'none' : ''};">
                        <div class="hsae-field-grid hsae-field-grid-2">
                            ${buildSelectFromOptions('hsae-card-title-position', CARD_TITLE_POSITION_OPTIONS, cardTitlePosition, 'Card Title Position')}
                            ${buildSelectFromOptions('hsae-card-title-capitalization', CARD_TITLE_CAPITALIZATION_OPTIONS, section.cardTitleCapitalization || 'normal', 'Card Title Capitalization')}
                        </div>
                        <div class="hsae-field-grid hsae-field-grid-2">
                            ${buildSelectFromOptions('hsae-card-title-font-family', CARD_TITLE_FONT_FAMILY_OPTIONS, section.cardTitleFontFamily || 'default', 'Card Title Font Family')}
                            ${buildSelectFromOptions('hsae-card-title-font-size', CARD_TITLE_FONT_SIZE_OPTIONS, section.cardTitleFontSize || 'normal', 'Card Title Font Size')}
                        </div>
                    </div>
                    ${showItemsLayout ? `
                    <div class="hsae-field-grid hsae-field-grid-2">
                        <div class="hsae-field-with-hint">
                            ${buildSelectFromOptions('hsae-items-layout', ITEMS_LAYOUT_OPTIONS, itemsLayout, 'Layout')}
                            <div class="listItemBodyText secondary hsae-field-hint">Default items layout for this section.</div>
                        </div>
                        <div class="hsae-field-with-hint">
                            ${buildSelectFromOptions('hsae-card-gaps', CARD_GAPS_OPTIONS, cardGaps, 'Card Gaps')}
                            <div class="listItemBodyText secondary hsae-field-hint">Remove spacing between cards.</div>
                        </div>
                    </div>
                    ` : ''}
                    <div class="hsae-field-grid hsae-field-grid-2">
                        <div class="hsae-field-with-hint">
                            <label class="inputLabel inputLabelUnfocused" for="hsae-card-title-color-text">Card Title Color</label>
                            <div class="hsae-color-input-row">
                                <div id="hsae-card-title-color-pickr" class="hsae-color-pickr-host" aria-label="Card Title Color" style="--hsae-swatch-color:${escapeHtml(cardTitleColorDefault)}" role="button" tabindex="0"></div>
                                <input type="text" id="hsae-card-title-color-text" class="emby-input" value="${escapeHtml(section.cardTitleColor || '')}" placeholder="CSS color (optional)" aria-label="Card Title Color CSS" data-pickr-default="${escapeHtml(cardTitleColorDefault)}">
                            </div>
                            <div class="listItemBodyText secondary hsae-field-hint">CSS color for card titles in this section.</div>
                        </div>
                        <div class="hsae-field-with-hint">
                            ${buildTextInput('hsae-section-css-class', section.sectionCssClass || '', 'CSS Class')}
                            <div class="listItemBodyText secondary hsae-field-hint">Added to the section container when rendered.</div>
                        </div>
                    </div>
                </div>
            </details>
        `;
    }

    function buildAppearanceHTML(state, context) {
        const { CARD_FORMATS, buildCheckbox } = getApi();
        const renderMode = state.renderMode || 'Normal';
        const isNormal = renderMode === 'Normal';
        const isSpotlight = renderMode === 'Spotlight';

        return `
            <section class="hsae-group hsae-appearance-group">
                <div class="hsae-group-header">
                    <div class="listItemBodyText hsae-group-title">Appearance</div>
                    <div class="listItemBodyText secondary hsae-group-desc">Choose how this section is rendered on the home screen</div>
                </div>
                <div class="hsae-card">
                    <div class="hsae-appearance-grid">
                        ${RENDER_MODE_CARDS.map(m => `
                            <button type="button" class="hsae-appearance-card${renderMode === m.value ? ' hsae-active' : ''}" data-hsae-action="set-render-mode" data-render-mode="${escapeHtml(m.value)}">
                                <div class="listItemBodyText hsae-appearance-title">${escapeHtml(m.title)}</div>
                                <div class="listItemBodyText secondary hsae-appearance-desc">${escapeHtml(m.desc)}</div>
                            </button>
                        `).join('')}
                    </div>
                    <div class="hsae-query-divider" role="separator" aria-hidden="true"></div>
                    ${isNormal ? `
                        <div class="hsae-appearance-normal-row">
                            <div class="hsae-appearance-format-col">
                                <div class="listItemBodyText hsae-subsection-label">Card Format</div>
                                <div class="hsae-card-format-grid">
                                    ${CARD_FORMATS.map(fmt => `
                                        <button type="button" class="hsae-card-format-btn${state.cardFormat === fmt ? ' hsae-active' : ''}" data-hsae-action="set-card-format" data-card-format="${escapeHtml(fmt)}">
                                            <span class="listItemBodyText">${escapeHtml(fmt)}</span>
                                        </button>
                                    `).join('')}
                                </div>
                            </div>
                            <div class="hsae-appearance-preview-col">
                                <div class="listItemBodyText hsae-subsection-label">Preview</div>
                                <div id="hsae-appearance-preview-container" class="hsae-appearance-preview-container">
                                    <p class="listItemBodyText secondary hsae-preview-placeholder">Loading preview…</p>
                                </div>
                            </div>
                            <div class="hsae-appearance-live-preview-row">
                                ${buildCheckbox('hsae-live-preview-updates', state.livePreviewUpdates === true, 'Live Preview Updates')}
                            </div>
                        </div>
                    ` : ''}
                    ${isSpotlight ? `
                        <div>
                            <div class="listItemBodyText hsae-subsection-label">Spotlight options</div>
                            ${buildSpotlightInnerHTML(state, context)}
                        </div>
                    ` : ''}
                    ${buildAppearanceAdvancedHTML(state)}
                </div>
            </section>
        `;
    }

    function buildAdvancedOptionsHTML(state) {
        const { buildSelect, buildTextInput, buildToggleCard, SORT_ORDERS, SORT_ORDER_DIRECTIONS } = getApi();
        const section = state.section || {};
        const presets = getCachePresets();
        const ttlPreset = state.ttlPreset || 'DEFAULT';
        const isCustomTtl = ttlPreset === 'CUSTOM';
        const premiereAge = resolvePremiereAgeFields(section);

        return `
            <details class="hsae-group hsae-advanced-options">
                <summary class="hsae-advanced-summary">
                    <div class="hsae-advanced-summary-left">
                        <span class="material-icons hsae-advanced-chevron">expand_more</span>
                        <span class="listItemBodyText hsae-group-title">Advanced Options</span>
                    </div>
                    <span class="listItemBodyText secondary hsae-group-desc">For "real" server admins</span>
                </summary>
                <div class="hsae-card hsae-advanced-body">
                    <div class="hsae-advanced-cache hsae-cache-section" data-hsae-profiles="full minimal postProcessing normal dateCutoffs">
                        <div class="listItemBodyText hsae-field-label">Cache Duration</div>
                        <div class="hsae-chip-row hsae-cache-presets">
                            ${presets.map(p => `
                                <button type="button" class="kefin-chip hsae-chip hsae-cache-preset${ttlPreset === p.key ? ' hsae-active' : ''}" data-preset-key="${escapeHtml(p.key)}">${escapeHtml(p.label)}</button>
                            `).join('')}
                        </div>
                        <div id="hsae-ttl-custom-container" class="hsae-field-grid hsae-field-grid-2 hsae-ttl-custom" style="display:${isCustomTtl ? 'grid' : 'none'};">
                            ${buildTextInput('hsae-ttl-custom-value', state.ttlCustomValue || '', 'Custom Duration', 'number')}
                            ${buildSelectFromOptions('hsae-ttl-custom-unit', TTL_UNIT_OPTIONS.map(u => ({ value: u.value, label: u.value })), state.ttlCustomUnit || 'minutes', 'Unit')}
                        </div>
                    </div>

                    <div class="hsae-advanced-section-sort hsae-field-grid hsae-field-grid-2 hsae-advanced-sort-row" data-hsae-profiles="full postProcessing normal dateCutoffs">
                        ${buildSelect('hsae-advanced-sortBy', toSortBySelectOptions(SORT_ORDERS), state.sortBy || '', 'Sort By')}
                        ${buildSelect('hsae-advanced-sortOrder', getSectionSortOrderDirectionOptions(SORT_ORDER_DIRECTIONS), state.sortOrder || '', 'Sort Order')}
                    </div>

                    <div class="hsae-advanced-min-max-age hsae-field-grid hsae-field-grid-2 hsae-advanced-age-row" data-hsae-profiles="full dateCutoffs">
                        ${buildTextInput('hsae-query-minAge', premiereAge.minAge, 'Minimum Age (Days)', 'number')}
                        ${buildTextInput('hsae-query-maxAge', premiereAge.maxAge, 'Maximum Age (Days)', 'number')}
                    </div>

                    <div class="hsae-advanced-limits hsae-field-grid hsae-field-grid-2 hsae-advanced-limits-row" data-hsae-profiles="full postProcessing normal dateCutoffs">
                        <div class="hsae-field-with-hint">
                            ${buildTextInput('section-minimumItems', section.minimumItems ?? '', 'Minimum Items', 'number')}
                            <div class="listItemBodyText secondary hsae-field-hint">If the section has fewer items than this it will not be shown.</div>
                        </div>
                        <div class="hsae-field-with-hint">
                            ${buildTextInput('hsae-section-itemLimit', state.itemLimit ?? '', 'Item Limit', 'number')}
                            <div class="listItemBodyText secondary hsae-field-hint">Limits results from queries after they are fetched.</div>
                        </div>
                    </div>

                    <div class="hsae-toggle-card-grid hsae-advanced-toggles-row">
                        <div class="hsae-advanced-flatten" data-hsae-profiles="full normal dateCutoffs">
                            ${buildToggleCard(
                                'section-flattenSeries',
                                section.flattenSeries === true,
                                'Flatten Series',
                                ADVANCED_TOGGLE_DESCRIPTIONS['section-flattenSeries']
                            )}
                        </div>
                        <div class="hsae-advanced-limit-before-sort" data-hsae-profiles="full postProcessing normal dateCutoffs">
                            ${buildToggleCard(
                                'hsae-limit-before-sort',
                                section.limitBeforeSort === true,
                                'Limit Before Sort',
                                ADVANCED_TOGGLE_DESCRIPTIONS['hsae-limit-before-sort']
                            )}
                        </div>
                    </div>
                </div>
            </details>
        `;
    }

    function buildSelectFromOptions(id, options, selectedValue, label) {
        const { buildSelect } = getApi();
        return buildSelect(id, options, selectedValue, label);
    }

    function buildEditorBodyHTML(state, context) {
        return `
            ${buildBasicPropertiesHTML(state, context)}
            ${buildAppearanceHTML(state, context)}
            ${buildItemSourceHTML(state)}
            ${buildQueriesHTML(state)}
            ${buildCustomItemsHTML(state)}
            ${buildAdvancedOptionsHTML(state)}
        `;
    }

    function buildHTML(section, context = {}) {
        const state = buildEditorStateFromSection(section, context);
        const editorProfile = state.editorProfile || 'full';
        return `
            <div class="hsae-root" data-editor-profile="${escapeHtml(editorProfile)}" data-item-source="${escapeHtml(state.itemSource || 'jellyfin')}">
                <input type="hidden" id="hsae-render-mode-value" value="${escapeHtml(state.renderMode || 'Normal')}">
                <input type="hidden" id="hsae-card-format-value" value="${escapeHtml(state.cardFormat || 'Poster')}">
                <div class="hsae-editor-body">
                    ${buildEditorBodyHTML(state, context)}
                </div>
            </div>
        `;
    }

    function resolveTtlMs(state) {
        const presets = getCachePresets();
        const presetKey = state.ttlPreset || 'DEFAULT';
        if (presetKey !== 'CUSTOM') {
            const preset = presets.find(p => p.key === presetKey);
            if (preset && preset.ms != null) return preset.ms;
        }
        const value = parseFloat(state.ttlCustomValue);
        if (!value && value !== 0) return undefined;
        const unit = TTL_UNIT_OPTIONS.find(u => u.value === (state.ttlCustomUnit || 'minutes'));
        return Math.round(value * (unit?.ms || 60000));
    }

    function collectQueryFromEditor(editor, queryIndex, hideWatched, root, originalQuery) {
        const profile = root?.dataset?.editorProfile || 'full';
        const limitEl = editor.querySelector(`#query-${queryIndex}-Limit`);
        const sortByEl = editor.querySelector(`#query-${queryIndex}-SortBy`);

        if (profile !== 'full' && originalQuery) {
            const query = JSON.parse(JSON.stringify(originalQuery));
            if (!query.queryOptions) query.queryOptions = {};
            if (isProfileFieldActive(root, limitEl)) {
                const limit = limitEl?.value;
                if (limit !== '' && limit != null) {
                    const limitN = parseInt(limit, 10);
                    if (Number.isFinite(limitN) && limitN >= 0) {
                        query.queryOptions.Limit = limitN;
                    }
                }
            }
            if (isProfileFieldActive(root, sortByEl)) {
                const sortBy = sortByEl?.value;
                const sortOrder = editor.querySelector(`#query-${queryIndex}-SortOrder`)?.value;
                if (sortBy) query.queryOptions.SortBy = sortBy;
                else delete query.queryOptions.SortBy;
                if (sortOrder) query.queryOptions.SortOrder = sortOrder;
                else delete query.queryOptions.SortOrder;
            }
            if (hideWatched) query.queryOptions.IsUnplayed = true;
            else if (query.queryOptions) delete query.queryOptions.IsUnplayed;
            return query;
        }

        const query = {};
        const nameValue = editor.querySelector(`#query-${queryIndex}-name`)?.value?.trim();
        if (nameValue) query.name = nameValue;

        const sourceType = editor.querySelector(`#query-${queryIndex}-sourceType`)?.value || 'jellyfin';

        if (sourceType === 'static') {
            query._sourceType = 'static';
            query.queryOptions = {};
            const staticItems = parseSelectionItems(editor.querySelector(`#query-${queryIndex}-staticItems`)?.value);
            if (staticItems.length) {
                query.queryOptions.Ids = staticItems.map(item => item.id);
            }
            ['SortBy', 'SortOrder'].forEach(key => {
                const value = editor.querySelector(`#query-${queryIndex}-${key}`)?.value;
                if (value) query.queryOptions[key] = value;
            });
            return query;
        }

        if (sourceType === 'cache') {
            const dataSource = editor.querySelector(`#query-${queryIndex}-dataSource`)?.value;
            if (dataSource) query.dataSource = dataSource;
        } else {
            const endpoint = editor.querySelector(`#query-${queryIndex}-endpoint`)?.value || 'Items';
            const endpointMeta = ENDPOINT_OPTIONS.find(o => o.value === endpoint);
            if (endpoint === 'Custom') {
                const path = editor.querySelector(`#query-${queryIndex}-path`)?.value?.trim();
                if (path) query.path = path;
            } else if (endpointMeta?.path) {
                query.path = endpointMeta.path;
            }
        }

        query.queryOptions = {};

        if (hideWatched) {
            query.queryOptions.IsUnplayed = true;
        }

        const includeTypesValue = editor.querySelector(`#query-${queryIndex}-IncludeItemTypes`)?.value;
        if (includeTypesValue) {
            query.queryOptions.IncludeItemTypes = includeTypesValue.split(',').map(s => s.trim()).filter(Boolean);
        }

        const parentCard = Array.from(editor.querySelectorAll('.hsae-select-card[data-select-kind="parent"]'))
            .find(card => parseSelectionItems(card.querySelector('.hsae-select-card-value')?.value).length > 0);
        if (parentCard) {
            const parentType = parentCard.dataset.selectType;
            const parentItems = parseSelectionItems(parentCard.querySelector('.hsae-select-card-value')?.value);
            if (parentItems.length && parentType) {
                query.queryOptions.ParentId = parentItems[0].id;
                query._parentItemType = parentType;
                if (parentType === 'Library') {
                    query.queryOptions.Recursive = false;
                }
            }
        }

        FACET_SELECTION_CARD_TYPES.forEach(facet => {
            const card = editor.querySelector(`.hsae-select-card[data-select-kind="facet"][data-select-type="${facet.type}"]`);
            if (!card) return;
            const items = parseSelectionItems(card.querySelector('.hsae-select-card-value')?.value);
            if (!items.length) return;
            if (facet.type === 'Genre') {
                query.queryOptions.GenreIds = items.map(i => i.id);
            } else if (facet.type === 'Tag') {
                query.queryOptions.Tags = items.map(i => i.name || i.id);
            } else if (facet.type === 'Person') {
                query.queryOptions.PersonIds = items.map(i => i.id);
            } else if (facet.type === 'Studio') {
                query.queryOptions.StudioIds = items.map(i => i.id);
            }
        });

        delete query.queryOptions.Genres;
        delete query.queryOptions.CollectionIds;
        delete query.queryOptions.PlaylistIds;
        delete query.queryOptions._parentItemType;

        ['SortBy', 'SortOrder', 'Filters', 'SearchTerm'].forEach(key => {
            const value = editor.querySelector(`#query-${queryIndex}-${key}`)?.value;
            if (value) query.queryOptions[key] = value;
        });

        const limit = editor.querySelector(`#query-${queryIndex}-Limit`)?.value;
        if (limit !== '' && limit != null) {
            const limitN = parseInt(limit, 10);
            if (Number.isFinite(limitN) && limitN >= 0) {
                query.queryOptions.Limit = limitN;
            }
        }

        const additionalOptionsList = editor.querySelector(`.additional-options-list[data-query-index="${queryIndex}"]`);
        if (additionalOptionsList) {
            additionalOptionsList.querySelectorAll('.additional-option-row').forEach(row => {
                const valueInput = row.querySelector('.additional-option-value');
                if (!valueInput) return;
                const customKeyInput = row.querySelector('.hsae-custom-option-key');
                const key = (customKeyInput?.value?.trim()) || valueInput.dataset.key;
                const type = valueInput.dataset.type || 'string';
                if (!key) return;

                let value;
                if (type === 'boolean') value = valueInput.checked === true;
                else if (type === 'number') value = valueInput.value ? parseFloat(valueInput.value) : undefined;
                else if (type === 'array') value = valueInput.value ? valueInput.value.split(',').map(s => s.trim()).filter(Boolean) : [];
                else value = valueInput.value || undefined;

                if (value !== undefined && value !== null && value !== '') {
                    query.queryOptions[key] = value;
                }
            });
        }

        if (!hideWatched) delete query.queryOptions.IsUnplayed;

        delete query._sourceType;

        return query;
    }

    function collectData(dialog, originalSection) {
        if (!dialog) return null;

        const root = dialog.querySelector('.hsae-root') || dialog;
        const section = originalSection ? JSON.parse(JSON.stringify(originalSection)) : {};
        const userEnabledChecked = dialog.querySelector('#hsae-user-enabled-by-default')?.checked === true;
        const userConfigChecked = dialog.querySelector('#hsae-user-configurable')?.checked === true;

        section.name = dialog.querySelector('#section-name')?.value || '';
        section.enabled = userEnabledChecked;
        section.userConfigurable = userConfigChecked;

        const hideNameChecked = dialog.querySelector('#hsae-hide-section-name')?.checked === true;
        if (hideNameChecked) section.hideName = true;
        else section.hideName = '';

        const activeRenderMode = dialog.querySelector('.hsae-appearance-card.hsae-active[data-render-mode]');
        section.renderMode = activeRenderMode?.dataset.renderMode
            || dialog.querySelector('#hsae-render-mode-value')?.value
            || 'Normal';

        const editorState = {
            sectionVisibility: dialog.querySelector('#hsae-section-visibility')?.value || 'normal',
            order: dialog.querySelector('#section-order')?.value,
            startDate: dialog.querySelector('#section-startDate')?.value || '',
            endDate: dialog.querySelector('#section-endDate')?.value || ''
        };
        applyVisibilityToSection(section, editorState);

        if (section.renderMode !== 'Spotlight') {
            const activeCardFormat = dialog.querySelector('.hsae-card-format-btn.hsae-active[data-card-format]');
            section.cardFormat = activeCardFormat?.dataset.cardFormat
                || dialog.querySelector('#hsae-card-format-value')?.value
                || 'Poster';
            delete section.spotlightConfig;
        } else {
            const { collectSpotlightConfigFromDialog } = getApi();
            if (typeof collectSpotlightConfigFromDialog === 'function') {
                section.spotlightConfig = collectSpotlightConfigFromDialog(dialog, 'section-spotlight-', { useIntervalSeconds: true });
            } else {
                section.spotlightConfig = section.spotlightConfig || {};
            }
            delete section.cardFormat;
        }

        const itemSourceSection = dialog.querySelector('.hsae-item-source');
        const itemSource = isProfileFieldActive(root, itemSourceSection)
            ? (dialog.querySelector('.hsae-source-card.hsae-active[data-item-source]')?.dataset.itemSource || inferItemSource(section))
            : inferItemSource(originalSection || section);
        const hideWatched = dialog.querySelector('#hsae-hide-watched')?.checked === true;

        if (itemSource === 'custom') {
            const customEditor = getCustomItemsEditor();
            const liveState = getLiveEditorState(dialog);
            const customItemsGroup = dialog.querySelector('.hsae-custom-items-group');
            if (isProfileFieldActive(root, customItemsGroup) && customEditor && liveState?.customItems) {
                customEditor.collectCustomItemsFromForm(dialog, liveState, customEditor.getCustomItemsOptions());
                section.items = liveState.customItems.map(customEditor.buildStaticItemFromDraft).filter(Boolean);
            } else if (!Array.isArray(section.items)) {
                section.items = [];
            }
            section.queries = [];
        } else {
            delete section.items;
            const queryEditors = dialog.querySelectorAll('.query-editor');
            if (queryEditors.length > 0) {
                section.queries = Array.from(queryEditors).map(editor => {
                    const queryIndex = parseInt(editor.dataset.queryIndex, 10);
                    const originalQuery = originalSection?.queries?.[queryIndex];
                    return collectQueryFromEditor(editor, queryIndex, hideWatched, root, originalQuery);
                });
                if (section.queries.length > 1) {
                    section.useRandomQuery = dialog.querySelector('#hsae-use-random-query')?.checked === true;
                    section.useMultiQueryPicker = dialog.querySelector('#hsae-use-multi-query-picker')?.checked === true;

                    const pickerLabel = dialog.querySelector('#hsae-multi-query-picker-label')?.value?.trim();
                    if (pickerLabel) section.multiQueryPickerLabel = pickerLabel;
                    else delete section.multiQueryPickerLabel;

                    if (dialog.querySelector('#hsae-use-query-names-for-section')?.checked === true) {
                        section.useQueryNamesForSection = true;
                    } else {
                        delete section.useQueryNamesForSection;
                    }
                } else {
                    delete section.useRandomQuery;
                    delete section.useMultiQueryPicker;
                    delete section.multiQueryPickerLabel;
                    delete section.useQueryNamesForSection;
                }
            }
            // No query editors: keep cloned original queries (e.g. templates without query UI)
        }

        collectAdvancedOptionsFields(dialog, section, root);

        const cssClass = dialog.querySelector('#hsae-section-css-class')?.value?.trim();
        if (cssClass) section.sectionCssClass = cssClass;
        else section.sectionCssClass = '';

        const borderStyle = dialog.querySelector('#hsae-border-style')?.value?.trim();
        if (borderStyle) section.borderStyle = borderStyle;
        else section.borderStyle = '';

        const borderColor = dialog.querySelector('#hsae-border-color-text')?.value?.trim();
        if (borderColor) section.borderColor = borderColor;
        else section.borderColor = '';

        const cardTitleColor = dialog.querySelector('#hsae-card-title-color-text')?.value?.trim();
        if (cardTitleColor) section.cardTitleColor = cardTitleColor;
        else section.cardTitleColor = '';

        const itemsLayout = dialog.querySelector('#hsae-items-layout')?.value;
        if (itemsLayout === 'grid') section.itemsLayout = itemsLayout;
        else section.itemsLayout = '';
        const cardGaps = dialog.querySelector('#hsae-card-gaps')?.value;
        if (cardGaps === 'none') section.useGaplessCards = true;
        else section.useGaplessCards = false;

        const hideCardTitles = dialog.querySelector('#hsae-hide-card-titles')?.checked === true;
        if (hideCardTitles) section.cardTitleVisibility = 'hidden';
        else section.cardTitleVisibility = '';
        section.hideCardTitles = '';

        const cardTitlePosition = dialog.querySelector('#hsae-card-title-position')?.value;
        if (cardTitlePosition && cardTitlePosition !== 'default') section.cardTitlePosition = cardTitlePosition;
        else section.cardTitlePosition = '';

        const cardTitleCapitalization = dialog.querySelector('#hsae-card-title-capitalization')?.value;
        if (cardTitleCapitalization && cardTitleCapitalization !== 'normal') section.cardTitleCapitalization = cardTitleCapitalization;
        else section.cardTitleCapitalization = '';

        const cardTitleFontFamily = dialog.querySelector('#hsae-card-title-font-family')?.value;
        if (cardTitleFontFamily && cardTitleFontFamily !== 'default') section.cardTitleFontFamily = cardTitleFontFamily;
        else section.cardTitleFontFamily = '';

        const cardTitleFontSize = dialog.querySelector('#hsae-card-title-font-size')?.value;
        if (cardTitleFontSize && cardTitleFontSize !== 'normal') section.cardTitleFontSize = cardTitleFontSize;
        else section.cardTitleFontSize = '';

        const targetGroupName = dialog.querySelector('select#section-group')?.value;
        if (targetGroupName) {
            section._targetGroupName = targetGroupName === 'New...'
                ? (dialog.querySelector('#section-group-new')?.value || '').trim() || 'Custom Sections'
                : targetGroupName;
        }

        return section;
    }

    async function hydrateStaticItemsLabels(modalInstance, queryIndex) {
        const { resolveSelectionItemLabels } = getApi();
        if (!resolveSelectionItemLabels || !modalInstance) return;

        const root = modalInstance.dialogContent;
        const editor = root.querySelector(`.query-editor[data-query-index="${queryIndex}"]`);
        if (!editor) return;

        const sourceType = editor.querySelector(`#query-${queryIndex}-sourceType`)?.value
            || inferQuerySourceType(modalInstance._hsaeState?.queries?.[queryIndex]);
        if (sourceType !== 'static') return;

        const items = parseSelectionItems(editor.querySelector(`#query-${queryIndex}-staticItems`)?.value);
        if (!items.some(selectionItemNeedsLabel)) return;

        const resolved = await resolveSelectionItemLabels('LibraryItem', items);
        setStaticItemsInEditor(editor, queryIndex, resolved);
    }

    async function hydrateQuerySelectCardLabels(modalInstance, queryIndex) {
        const { resolveSelectionItemLabels } = getApi();
        if (!resolveSelectionItemLabels || !modalInstance) return;

        const root = modalInstance.dialogContent;
        const editor = root.querySelector(`.query-editor[data-query-index="${queryIndex}"]`);
        if (!editor) return;

        const includeTypesValue = editor.querySelector(`#query-${queryIndex}-IncludeItemTypes`)?.value;
        const includeItemTypes = includeTypesValue
            ? includeTypesValue.split(',').map(s => s.trim()).filter(Boolean)
            : [];

        const cards = editor.querySelectorAll('.hsae-select-card');
        for (const card of cards) {
            const type = card.dataset.selectType;
            const items = parseSelectionItems(card.querySelector('.hsae-select-card-value')?.value);
            if (!items.some(selectionItemNeedsLabel)) continue;

            const resolved = await resolveSelectionItemLabels(type, items, { includeItemTypes });
            setSelectCardItems(card, resolved);
        }
    }

    function selectionItemNeedsLabel(item) {
        return !!(item?.id && (!item.name || item.name === item.id));
    }

    async function setupQueryEditors(modalInstance, state) {
        const { setupAdditionalOptionsListeners } = getApi();
        const queries = state.queries?.length ? state.queries : [createDefaultQuery()];
        const root = modalInstance.dialogContent;

        for (let queryIndex = 0; queryIndex < queries.length; queryIndex++) {
            setupAdditionalOptionsListeners?.(modalInstance, queryIndex);
            attachQueryCardListeners(root, modalInstance, queryIndex);
            await hydrateQuerySelectCardLabels(modalInstance, queryIndex);
            await hydrateStaticItemsLabels(modalInstance, queryIndex);
        }
    }

    function attachQueryCardListeners(root, modalInstance, queryIndex) {
        const editor = root.querySelector(`.query-editor[data-query-index="${queryIndex}"]`);
        if (!editor) return;

        attachLimitFieldSafeguard(editor, queryIndex);

        const sourceSelect = editor.querySelector(`#query-${queryIndex}-sourceType`);
        const endpointSelect = editor.querySelector(`#query-${queryIndex}-endpoint`);
        const pathContainer = editor.querySelector(`#query-${queryIndex}-path-container`);
        const endpointWrap = editor.querySelector('.hsae-jellyfin-endpoint-wrap');
        const cacheWrap = editor.querySelector('.hsae-cache-wrap');
        const jellyfinOnlyBlocks = editor.querySelectorAll('.hsae-query-jellyfin-only');
        const staticOnlyBlocks = editor.querySelectorAll('.hsae-query-static-only');

        const updateSourceVisibility = () => {
            const sourceType = sourceSelect?.value || 'jellyfin';
            if (endpointWrap) endpointWrap.style.display = sourceType === 'jellyfin' || sourceType === 'static' ? 'block' : 'none';
            if (endpointSelect) {
                endpointSelect.disabled = sourceType === 'static';
                if (sourceType === 'static') endpointSelect.value = 'Items';
            }
            if (cacheWrap) cacheWrap.style.display = sourceType === 'cache' ? 'block' : 'none';
            jellyfinOnlyBlocks.forEach(block => {
                block.style.display = sourceType === 'jellyfin' ? '' : 'none';
            });
            staticOnlyBlocks.forEach(block => {
                block.style.display = sourceType === 'static' ? '' : 'none';
            });
        };

        const updateEndpointVisibility = () => {
            const endpoint = endpointSelect?.value || 'Items';
            if (pathContainer) pathContainer.style.display = endpoint === 'Custom' ? 'block' : 'none';
        };

        sourceSelect?.addEventListener('change', () => {
            refreshEditorBody(modalInstance);
        });
        endpointSelect?.addEventListener('change', updateEndpointVisibility);

        updateSourceVisibility();
        updateEndpointVisibility();
    }

    function openSelectionForCard(card, modalInstance) {
        const { openSelectionPopover } = getApi();
        if (!openSelectionPopover || !card) return;

        const kind = card.dataset.selectKind;
        const type = card.dataset.selectType;
        const queryIndex = card.dataset.queryIndex;
        const multi = kind === 'facet';
        const selected = parseSelectionItems(card.querySelector('.hsae-select-card-value')?.value);
        const editor = modalInstance.dialogContent.querySelector(`.query-editor[data-query-index="${queryIndex}"]`);
        const includeTypesValue = editor?.querySelector(`#query-${queryIndex}-IncludeItemTypes`)?.value;
        const includeItemTypes = includeTypesValue
            ? includeTypesValue.split(',').map(s => s.trim()).filter(Boolean)
            : [];

        openSelectionPopover({
            type,
            multi,
            selected,
            includeItemTypes,
            onConfirm: (items) => {
                const nextItems = multi ? items : (items.length ? [items[0]] : []);
                if (kind === 'parent' && nextItems.length) {
                    clearSiblingParentCards(editor, type);
                }
                setSelectCardItems(card, nextItems);
            }
        });
    }

    function attachChipRowListeners(root, row, hiddenInputId) {
        const hiddenInput = hiddenInputId ? root.querySelector(`#${hiddenInputId}`) : null;
        row.querySelectorAll('.hsae-chip').forEach(chip => {
            chip.addEventListener('click', () => {
                chip.classList.toggle('hsae-active');
                if (hiddenInput) {
                    const values = Array.from(row.querySelectorAll('.hsae-chip.hsae-active')).map(c => c.dataset.chipValue);
                    hiddenInput.value = values.join(',');
                    if (hiddenInputId.endsWith('-IncludeItemTypes')) {
                        updateIncludeItemTypesHint(hiddenInput.closest('.hsae-include-types'));
                    }
                }
            });
        });
    }

    function attachSpotlightListeners(root) {
        const { attachSpotlightSettingsListeners } = getApi();
        const container = root.querySelector('#section-spotlight-options-container');
        if (!container) return;

        attachSpotlightSettingsListeners(container, 'section-spotlight-');

        const panAnimation = root.querySelector('#section-spotlight-panAnimation');
        const animDropdowns = root.querySelector('#section-spotlight-animation-dropdowns');
        const animDivider = root.querySelector('#section-spotlight-animation-divider');
        const tileCountSelect = root.querySelector('#section-spotlight-tileCount');
        const animSecond = root.querySelector('#section-spotlight-anim-second');
        const animThird = root.querySelector('#section-spotlight-anim-third');
        const cycleBackdrops = root.querySelector('#section-spotlight-cycleBackdrops');
        const backdropsRow = root.querySelector('#section-spotlight-backdrops-row');
        const backdropsCountInput = root.querySelector('#section-spotlight-backdropsCount');

        const updateAnimateVisibility = () => {
            const checkbox = root.querySelector('#section-spotlight-panAnimation');
            const enabled = checkbox?.checked === true;
            if (animDropdowns) animDropdowns.style.display = enabled ? 'grid' : 'none';
            if (animDivider) animDivider.style.display = enabled ? 'block' : 'none';
        };

        const updateTileAnimVisibility = () => {
            const tc = parseInt(tileCountSelect?.value || '1', 10) || 1;
            if (animSecond) animSecond.style.display = tc >= 2 ? 'block' : 'none';
            if (animThird) animThird.style.display = tc >= 3 ? 'block' : 'none';
            if (animDropdowns) {
                animDropdowns.classList.remove('hsae-spotlight-animations--1', 'hsae-spotlight-animations--2', 'hsae-spotlight-animations--3');
                animDropdowns.classList.add(`hsae-spotlight-animations--${tc}`);
            }
        };

        const updateCycleBackdropsRow = () => {
            const on = cycleBackdrops?.checked === true;
            if (backdropsRow) backdropsRow.style.display = on ? 'block' : 'none';
            if (on && backdropsCountInput) {
                const val = parseInt(backdropsCountInput.value, 10);
                if (!val || val < 2) backdropsCountInput.value = '2';
                backdropsCountInput.min = '2';
            }
        };

        panAnimation?.addEventListener('change', updateAnimateVisibility);
        tileCountSelect?.addEventListener('change', updateTileAnimVisibility);
        cycleBackdrops?.addEventListener('change', updateCycleBackdropsRow);
        backdropsCountInput?.addEventListener('change', () => {
            if (cycleBackdrops?.checked === true) {
                const val = parseInt(backdropsCountInput.value, 10);
                if (!val || val < 2) backdropsCountInput.value = '2';
            }
        });
        updateAnimateVisibility();
        updateTileAnimVisibility();
        updateCycleBackdropsRow();
    }

    function attachAdditionalOptionCustomHandler(modalInstance, queryIndex) {
        const dialog = modalInstance.dialogContainer || modalInstance.dialogContent;
        const controls = dialog.querySelector(`.query-${queryIndex}-additional-options-controls[data-query-index="${queryIndex}"]`);
        const listContainer = dialog.querySelector(`.query-${queryIndex}-additional-options-list-container[data-query-index="${queryIndex}"]`);
        if (!controls || !listContainer) return;

        const addBtn = controls.querySelector('.hsae-add-additional-option');
        const select = controls.querySelector('.additional-option-select');
        const list = listContainer.querySelector('.additional-options-list');
        const { SUPPORTED_QUERY_OPTIONS } = getApi();

        if (!addBtn || !select || !list) return;

        addBtn.addEventListener('click', () => {
            const key = select.value;
            if (!key) return;

            const index = list.children.length;
            const inputId = `query-${queryIndex}-additionalOption-${Date.now()}_${index}`;
            let inputField = '';
            let rowType = 'field';

            if (key === '__custom__') {
                rowType = 'custom';
                inputField = `
                    <div class="hsae-custom-option-grid">
                        <input type="text" class="fld emby-input hsae-custom-option-key" placeholder="Option name" aria-label="Option name">
                        <input type="text" id="${inputId}" class="fld emby-input additional-option-value hsae-custom-option-value" placeholder="Option value" data-type="string" aria-label="Option value">
                    </div>
                `;
            } else {
                const meta = SUPPORTED_QUERY_OPTIONS[key];
                if (!meta) return;
                rowType = meta.type === 'boolean' ? 'boolean' : 'field';
                if (meta.type === 'boolean') {
                    inputField = buildAdditionalBooleanToggleHTML(
                        inputId,
                        key,
                        meta.label,
                        meta.default === true
                    );
                } else {
                    inputField = `
                        <div class="hsae-additional-field">
                            <div class="listItemBodyText hsae-field-label">${escapeHtml(meta.label)}</div>
                            <input type="${meta.type === 'number' ? 'number' : (meta.type === 'date' ? 'date' : 'text')}"
                                   id="${inputId}"
                                   class="fld emby-input additional-option-value"
                                   data-key="${escapeHtml(key)}"
                                   data-type="${escapeHtml(meta.type || 'string')}"
                                   placeholder="${escapeHtml(meta.hint || '')}">
                        </div>
                    `;
                }
            }

            const row = document.createElement('div');
            row.className = getAdditionalOptionRowClass(rowType);
            row.innerHTML = `
                ${inputField}
                <button type="button" class="hsae-remove-additional-option" title="Remove Option">
                    <span class="material-icons">close</span>
                </button>
            `;

            if (key === '__custom__') {
                const valueInput = row.querySelector('.hsae-custom-option-value');
                const keyInput = row.querySelector('.hsae-custom-option-key');
                keyInput?.addEventListener('input', () => {
                    if (valueInput) valueInput.dataset.key = keyInput.value.trim();
                });
            }

            row.querySelector('.hsae-remove-additional-option')?.addEventListener('click', () => row.remove());
            list.appendChild(row);
            select.value = '';
        });

        listContainer.querySelectorAll('.hsae-remove-additional-option').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.target.closest('.additional-option-row')?.remove();
            });
        });
    }

    function updateMultiQuerySettingsUI(root) {
        if (!root) return;

        const randomQueryEl = root.querySelector('#hsae-use-random-query');
        const pickerEl = root.querySelector('#hsae-use-multi-query-picker');
        const useNamesEl = root.querySelector('#hsae-use-query-names-for-section');

        const sortRow = root.querySelector('#section-query-sort-row');
        if (sortRow && randomQueryEl) {
            sortRow.style.display = randomQueryEl.checked ? 'none' : 'grid';
        }

        const pickerRows = root.querySelector('#hsae-multi-query-picker-rows');
        if (pickerRows && pickerEl) {
            pickerRows.style.display = pickerEl.checked ? 'block' : 'none';
        }

        const randomHint = root.querySelector('[data-hsae-hint="useRandomQuery"]');
        if (randomHint && randomQueryEl) {
            randomHint.textContent = RANDOM_QUERY_TOGGLE_DESCRIPTIONS[randomQueryEl.checked ? 'on' : 'off'];
        }

        const pickerHint = root.querySelector('[data-hsae-hint="useMultiQueryPicker"]');
        if (pickerHint && pickerEl) {
            pickerHint.textContent = QUERY_PICKER_TOGGLE_DESCRIPTIONS[pickerEl.checked ? 'on' : 'off'];
        }

        const useNamesHint = root.querySelector('[data-hsae-hint="useQueryNamesForSection"]');
        if (useNamesHint && useNamesEl) {
            useNamesHint.textContent = USE_QUERY_NAMES_TOGGLE_DESCRIPTIONS[useNamesEl.checked ? 'on' : 'off'];
        }
    }

    function updateToggleCardHints(root) {
        const toggles = [
            { key: 'hideName', checkboxId: 'hsae-hide-section-name', tooltips: HIDE_NAME_TOGGLE_DESCRIPTIONS },
            { key: 'hideWatched', checkboxId: 'hsae-hide-watched', tooltips: HIDE_WATCHED_TOGGLE_DESCRIPTIONS },
            { key: 'userEnabledByDefault', checkboxId: 'hsae-user-enabled-by-default', tooltips: USER_TOGGLE_TOOLTIPS.userEnabledByDefault },
            { key: 'userConfigurable', checkboxId: 'hsae-user-configurable', tooltips: USER_TOGGLE_TOOLTIPS.userConfigurable }
        ];

        toggles.forEach(({ key, checkboxId, tooltips }) => {
            const checkbox = root.querySelector(`#${checkboxId}`);
            const hint = root.querySelector(`[data-hsae-hint="${key}"]`);
            if (!checkbox || !hint) return;
            const enabled = checkbox.checked === true;
            hint.textContent = tooltips[enabled ? 'on' : 'off'];
        });

        updateMultiQuerySettingsUI(root);
    }

    function updateSectionNameBadge(modalInstance) {
        const badge = modalInstance?.dialogHeader?.querySelector('.hsae-section-name-badge');
        const nameInput = modalInstance?.dialogContent?.querySelector('#section-name');
        if (badge && nameInput) {
            badge.textContent = nameInput.value.trim() || 'Untitled';
        }
    }

    function getHsaePickrAppEl(pickr) {
        return pickr?._root?.app || null;
    }

    function destroyHsaeColorPickr(modalInstance, storageKey) {
        const pickr = modalInstance?.[storageKey];
        if (pickr) {
            try {
                // Prefer destroy() — destroyAndRemove() can delete useAsButton trigger nodes.
                if (typeof pickr.destroy === 'function') pickr.destroy();
                else if (typeof pickr.destroyAndRemove === 'function') pickr.destroyAndRemove();
            } catch (_) { /* ignore */ }
            modalInstance[storageKey] = null;
        }
        // Remove orphaned apps left on document.body after incomplete destroy / body refresh,
        // but keep any app still owned by the other appearance pickr.
        const keep = new Set();
        for (const key of ['_hsaeBorderPickr', '_hsaeCardTitleColorPickr']) {
            const app = getHsaePickrAppEl(modalInstance?.[key]);
            if (app) keep.add(app);
        }
        document.querySelectorAll('.pcr-app.kefin-pickr-app').forEach((el) => {
            if (keep.has(el)) return;
            try { el.remove(); } catch (__) { /* ignore */ }
        });
    }

    function destroyHsaeAppearancePickrs(modalInstance) {
        destroyHsaeColorPickr(modalInstance, '_hsaeBorderPickr');
        destroyHsaeColorPickr(modalInstance, '_hsaeCardTitleColorPickr');
    }

    /**
     * Lazy-wire a color Pickr: create on first host click, destroy when the picker hides
     * so .pcr-app is not left on document.body. Host is a permanent color swatch.
     */
    function attachHsaeColorPickr(modalInstance, { hostSelector, textSelector, storageKey, fallbackColor }) {
        destroyHsaeColorPickr(modalInstance, storageKey);
        const root = modalInstance?.dialogContent;
        if (!root || typeof window.Pickr?.create !== 'function') return;

        const host = root.querySelector(hostSelector);
        const colorText = root.querySelector(textSelector);
        if (!host) return;

        const otherKey = storageKey === '_hsaeBorderPickr'
            ? '_hsaeCardTitleColorPickr'
            : '_hsaeBorderPickr';

        const resolveSwatchColor = () => {
            const typed = colorText?.value?.trim();
            if (typed && (/^#([0-9A-Fa-f]{3,4}|[0-9A-Fa-f]{6}|[0-9A-Fa-f]{8})$/i.test(typed) || /^(rgb|hsl)a?\(/i.test(typed))) {
                return typed;
            }
            return colorText?.dataset.pickrDefault || fallbackColor;
        };

        const setSwatchColor = (css) => {
            host.style.setProperty('--hsae-swatch-color', css || fallbackColor);
        };

        setSwatchColor(resolveSwatchColor());

        const toCss = (color) => {
            if (!color) return '';
            try {
                return color.toHEXA().toString();
            } catch (_) {
                try {
                    return color.toRGBA().toString();
                } catch (__) {
                    return '';
                }
            }
        };

        const ensurePickr = () => {
            if (modalInstance[storageKey]) return modalInstance[storageKey];
            if (!host.isConnected) return null;

            // Only one appearance pickr open at a time.
            destroyHsaeColorPickr(modalInstance, otherKey);

            const defaultColor = resolveSwatchColor();

            let pickr;
            try {
                pickr = window.Pickr.create({
                    el: host,
                    theme: 'nano',
                    default: defaultColor,
                    defaultRepresentation: 'HEXA',
                    useAsButton: true,
                    appClass: 'kefin-pickr-app',
                    components: {
                        preview: true,
                        opacity: true,
                        hue: true,
                        interaction: {
                            hex: true,
                            rgba: true,
                            input: true,
                            save: true
                        }
                    }
                });
            } catch (_) {
                return null;
            }

            pickr.on('change', (color) => {
                const css = toCss(color);
                if (css) {
                    if (colorText) colorText.value = css;
                    setSwatchColor(css);
                }
            });
            pickr.on('save', (color) => {
                const css = toCss(color);
                if (css) {
                    if (colorText) colorText.value = css;
                    setSwatchColor(css);
                }
                pickr.hide();
            });
            // Destroy after hide so .pcr-app is removed; next open recreates.
            pickr.on('hide', () => {
                requestAnimationFrame(() => {
                    if (modalInstance[storageKey] === pickr) {
                        destroyHsaeColorPickr(modalInstance, storageKey);
                    }
                });
            });

            modalInstance[storageKey] = pickr;
            return pickr;
        };

        host.addEventListener('click', (ev) => {
            ev.stopPropagation();
            if (modalInstance[storageKey]) {
                // Instance open; Pickr useAsButton toggles show/hide.
                return;
            }
            const pickr = ensurePickr();
            // Same-event listeners added by Pickr won't run; open on next frame.
            requestAnimationFrame(() => pickr?.show());
        });
    }

    function attachHsaeBorderColorPickr(modalInstance) {
        attachHsaeColorPickr(modalInstance, {
            hostSelector: '#hsae-border-color-pickr',
            textSelector: '#hsae-border-color-text',
            storageKey: '_hsaeBorderPickr',
            fallbackColor: '#e8dab2'
        });
    }

    function attachHsaeCardTitleColorPickr(modalInstance) {
        attachHsaeColorPickr(modalInstance, {
            hostSelector: '#hsae-card-title-color-pickr',
            textSelector: '#hsae-card-title-color-text',
            storageKey: '_hsaeCardTitleColorPickr',
            fallbackColor: '#ffffff'
        });
    }

    function syncHsaeColorPickrFromText(modalInstance, storageKey, textInput, hostSelector, fallbackColor) {
        const v = textInput?.value?.trim();
        const root = modalInstance?.dialogContent;
        const host = hostSelector ? root?.querySelector(hostSelector) : null;
        const isValid = v && (/^#([0-9A-Fa-f]{3,4}|[0-9A-Fa-f]{6}|[0-9A-Fa-f]{8})$/i.test(v) || /^(rgb|hsl)a?\(/i.test(v));
        if (host) {
            const css = isValid ? v : (textInput?.dataset?.pickrDefault || fallbackColor);
            host.style.setProperty('--hsae-swatch-color', css || fallbackColor);
        }
        const pickr = modalInstance?.[storageKey];
        if (!pickr || !isValid) return;
        try { pickr.setColor(v, true); } catch (_) { /* ignore invalid for Pickr */ }
    }

    function refreshEditorBody(modalInstance, options = {}) {
        const state = modalInstance._hsaeState;
        const context = state?.context || {};
        if (!state) return;

        const root = modalInstance.dialogContent;
        const body = root.querySelector('.hsae-editor-body');
        if (!body) return;

        const scrollTop = body.scrollTop;
        if (!options.skipCollect) {
            collectStateFromForm(root, state);
        }

        destroyHsaeAppearancePickrs(modalInstance);
        body.innerHTML = buildEditorBodyHTML(state, context);

        const hsaeRoot = root.classList?.contains('hsae-root') ? root : root.querySelector('.hsae-root');
        if (hsaeRoot) {
            hsaeRoot.dataset.itemSource = state.itemSource || 'jellyfin';
        }

        const renderModeInput = root.querySelector('#hsae-render-mode-value');
        const cardFormatInput = root.querySelector('#hsae-card-format-value');
        if (renderModeInput) renderModeInput.value = state.renderMode || 'Normal';
        if (cardFormatInput) cardFormatInput.value = state.cardFormat || 'Poster';

        attachBodyListeners(modalInstance, context).then(() => {
            body.scrollTop = scrollTop;
        });
        updateSectionNameBadge(modalInstance);
    }

    function handleHsaeRootClick(e, modalInstance) {
        const root = modalInstance.dialogContent;
        const state = modalInstance._hsaeState;
        if (!root || !state) return;

        const toggleBtn = e.target.closest('.toggle-slider, .kefin-toggle-switch');
        if (toggleBtn && root.contains(toggleBtn)) {
            const checkboxId = toggleBtn.dataset.checkboxId;
            if (!checkboxId) return;
            e.preventDefault();
            e.stopPropagation();
            const checkbox = document.getElementById(checkboxId);
            if (checkbox && root.contains(checkbox)) {
                checkbox.checked = !checkbox.checked;
                checkbox.dispatchEvent(new Event('change', { bubbles: true }));
                if (toggleBtn.classList.contains('kefin-toggle-switch')) {
                    const { updateToggleSwitchUI } = getApi();
                    if (typeof updateToggleSwitchUI === 'function') {
                        updateToggleSwitchUI(toggleBtn, checkbox.checked);
                    }
                } else {
                    const { updateToggleSliderUI } = getApi();
                    if (typeof updateToggleSliderUI === 'function') {
                        updateToggleSliderUI(toggleBtn, checkbox.checked);
                    }
                }
            }
            return;
        }

        const actionEl = e.target.closest('[data-hsae-action]');
        if (!actionEl || !root.contains(actionEl)) return;

        const action = actionEl.getAttribute('data-hsae-action');

        if (action?.startsWith('hsae-')) {
            const customEditor = getCustomItemsEditor();
            if (customEditor && state.itemSource === 'custom') {
                customEditor.handleAction(action, actionEl, root, state, customEditor.getCustomItemsOptions(), () => refreshEditorBody(modalInstance));
            }
            return;
        }

        e.preventDefault();

        if (action === 'open-selection') {
            const card = actionEl.closest('.hsae-select-card');
            openSelectionForCard(card, modalInstance);
            return;
        }

        if (action === 'toggle-include-types-all') {
            const queryIndex = actionEl.dataset.queryIndex;
            const container = root.querySelector(`.hsae-include-types[data-query-index="${queryIndex}"]`);
            if (!container) return;
            const showAll = container.dataset.showAll !== 'true';
            container.dataset.showAll = showAll ? 'true' : 'false';
            container.querySelectorAll('.hsae-include-type-extra').forEach(chip => {
                chip.hidden = !showAll;
            });
            actionEl.textContent = showAll ? 'Show less' : 'Show all';
            return;
        }

        if (action === 'remove-select-chip') {
            e.stopPropagation();
            const chip = actionEl.closest('.hsae-select-chip');
            const card = actionEl.closest('.hsae-select-card');
            if (!chip || !card) return;
            const value = chip.dataset.value;
            const items = parseSelectionItems(card.querySelector('.hsae-select-card-value')?.value)
                .filter(item => item.id !== value);
            setSelectCardItems(card, items);
            return;
        }

        if (action === 'add-static-item') {
            const queryIndex = actionEl.dataset.queryIndex;
            const editor = root.querySelector(`.query-editor[data-query-index="${queryIndex}"]`);
            if (!editor) return;
            const { openLibraryItemPickerPopover } = getApi();
            if (!openLibraryItemPickerPopover) return;
            const existing = parseSelectionItems(editor.querySelector(`#query-${queryIndex}-staticItems`)?.value);
            openLibraryItemPickerPopover({
                selected: existing,
                onConfirm: (items) => {
                    setStaticItemsInEditor(editor, queryIndex, items);
                }
            });
            return;
        }

        if (action === 'remove-static-item') {
            const itemId = actionEl.dataset.itemId;
            const editor = actionEl.closest('.query-editor');
            if (!editor || !itemId) return;
            const queryIndex = editor.dataset.queryIndex;
            const items = parseSelectionItems(editor.querySelector(`#query-${queryIndex}-staticItems`)?.value)
                .filter(item => item.id !== itemId);
            setStaticItemsInEditor(editor, queryIndex, items);
            return;
        }

        if (action === 'set-render-mode') {
            const renderMode = actionEl.dataset.renderMode;
            if (!renderMode || state.renderMode === renderMode) return;
            collectStateFromForm(root, state);
            state.renderMode = renderMode;
            const renderModeInput = root.querySelector('#hsae-render-mode-value');
            if (renderModeInput) renderModeInput.value = renderMode;
            appearancePreviewCache = { fetchKey: null, renderKey: null, items: null };
            refreshEditorBody(modalInstance);
            return;
        }

        if (action === 'set-card-format') {
            const cardFormat = actionEl.dataset.cardFormat;
            if (!cardFormat) return;
            collectStateFromForm(root, state);
            state.cardFormat = cardFormat;
            root.querySelectorAll('.hsae-card-format-btn').forEach(btn => {
                btn.classList.toggle('hsae-active', btn.dataset.cardFormat === cardFormat);
            });
            const cardFormatInput = root.querySelector('#hsae-card-format-value');
            if (cardFormatInput) cardFormatInput.value = cardFormat;
            if (state.livePreviewUpdates) {
                scheduleAppearancePreview(modalInstance);
            }
            return;
        }

        if (action === 'set-item-source') {
            const newSource = actionEl.dataset.itemSource;
            if (!newSource || state.itemSource === newSource) return;

            // Keep both queries and customItems in memory while switching;
            // collectData clears the inactive source only on save/preview.
            collectStateFromForm(root, state);
            state.itemSource = newSource;
            if (newSource === 'custom') {
                const customEditor = getCustomItemsEditor();
                if (customEditor) customEditor.ensureCustomItemsInitialized(state);
            } else {
                state.queries = state.queries?.length ? state.queries : [createDefaultQuery()];
            }
            refreshEditorBody(modalInstance);
            return;
        }

        if (action === 'delete-query') {
            e.stopPropagation();
            const index = parseInt(actionEl.dataset.queryIndex, 10);
            if (!state.queries || state.queries.length <= 1) return;
            collectStateFromForm(root, state);
            state.queries.splice(index, 1);
            if (state.queryExpandedStates) state.queryExpandedStates.splice(index, 1);
            refreshEditorBody(modalInstance, { skipCollect: true });
        }
    }

    async function attachBodyListeners(modalInstance, context) {
        const root = modalInstance.dialogContent;
        const state = modalInstance._hsaeState;

        const groupSelect = root.querySelector('#section-group');
        const newGroupContainer = root.querySelector('#section-group-new-container');
        groupSelect?.addEventListener('change', () => {
            if (newGroupContainer) newGroupContainer.style.display = groupSelect.value === 'New...' ? 'block' : 'none';
        });

        const visibilitySelect = root.querySelector('#hsae-section-visibility');
        visibilitySelect?.addEventListener('change', () => {
            if (state) state.sectionVisibility = visibilitySelect.value;
            refreshEditorBody(modalInstance);
        });

        const hideCardTitlesCheckbox = root.querySelector('#hsae-hide-card-titles');
        const updateCardTitleOptionsRow = () => {
            const row = root.querySelector('#hsae-card-title-options-row');
            const hide = hideCardTitlesCheckbox?.checked === true;
            if (row) row.style.display = hide ? 'none' : '';
        };
        updateCardTitleOptionsRow();
        hideCardTitlesCheckbox?.addEventListener('change', updateCardTitleOptionsRow);

        const borderColorText = root.querySelector('#hsae-border-color-text');
        const cardTitleColorText = root.querySelector('#hsae-card-title-color-text');
        attachHsaeBorderColorPickr(modalInstance);
        attachHsaeCardTitleColorPickr(modalInstance);
        borderColorText?.addEventListener('input', () => {
            syncHsaeColorPickrFromText(modalInstance, '_hsaeBorderPickr', borderColorText, '#hsae-border-color-pickr', '#e8dab2');
        });
        cardTitleColorText?.addEventListener('input', () => {
            syncHsaeColorPickrFromText(modalInstance, '_hsaeCardTitleColorPickr', cardTitleColorText, '#hsae-card-title-color-pickr', '#ffffff');
        });

        root.querySelectorAll('[data-hsae-chips]').forEach(row => {
            const attr = row.dataset.hsaeChips;
            if (attr?.startsWith('query-') && attr.endsWith('-filters')) {
                const match = attr.match(/^query-(\d+)-filters$/);
                if (match) attachChipRowListeners(root, row, `query-${match[1]}-Filters`);
            } else if (attr?.startsWith('query-') && attr.endsWith('-include-types')) {
                const match = attr.match(/^query-(\d+)-include-types$/);
                if (match) attachChipRowListeners(root, row, `query-${match[1]}-IncludeItemTypes`);
            }
        });

        root.querySelectorAll('.hsae-cache-preset').forEach(chip => {
            chip.addEventListener('click', () => {
                root.querySelectorAll('.hsae-cache-preset').forEach(c => c.classList.remove('hsae-active'));
                chip.classList.add('hsae-active');
                const customContainer = root.querySelector('#hsae-ttl-custom-container');
                if (customContainer) customContainer.style.display = chip.dataset.presetKey === 'CUSTOM' ? 'grid' : 'none';
                if (state) state.ttlPreset = chip.dataset.presetKey;
            });
        });

        const addQueryBtn = root.querySelector('.hsae-add-query-btn');
        addQueryBtn?.addEventListener('click', async () => {
            if (!state) return;
            collectStateFromForm(root, state);
            state.queries = state.queries || [];
            state.queries.push(createDefaultQuery());
            if (!state.queryExpandedStates) {
                state.queryExpandedStates = state.queries.slice(0, -1).map(() => true);
            }
            state.queryExpandedStates.push(true);
            refreshEditorBody(modalInstance, { skipCollect: true });
        });

        if (state?.itemSource === 'jellyfin') {
            await setupQueryEditors(modalInstance, state);
            (state.queries || []).forEach((_, i) => attachAdditionalOptionCustomHandler(modalInstance, i));
        }

        attachSpotlightListeners(root);
        updateToggleCardHints(root);

        ['#hsae-use-random-query', '#hsae-use-multi-query-picker', '#hsae-use-query-names-for-section'].forEach((selector) => {
            root.querySelector(selector)?.addEventListener('change', () => {
                if (state) collectStateFromForm(root, state);
                updateMultiQuerySettingsUI(root);
            });
        });

        root.querySelectorAll('.hsae-query-name-input').forEach((input) => {
            input.addEventListener('click', (e) => e.stopPropagation());
            input.addEventListener('keydown', (e) => e.stopPropagation());
        });

        const customEditor = getCustomItemsEditor();
        customEditor?.refreshPreviews(root, state);

        if (!modalInstance._hsaePreviewInitialized) {
            modalInstance._hsaePreviewInitialized = true;
            scheduleAppearancePreview(modalInstance, { immediate: true });
        } else if (state) {
            collectStateFromForm(root, state);
            const dialog = modalInstance.dialogContainer || modalInstance.dialogContent;
            const draft = buildAppearancePreviewDraft(dialog, state.section || {});
            const fetchKey = draft ? getAppearancePreviewFetchKeyFromDraft(draft) : null;
            const container = root.querySelector('#hsae-appearance-preview-container');
            if (fetchKey && appearancePreviewCache.fetchKey === fetchKey && appearancePreviewCache.items?.length) {
                runAppearancePreview(modalInstance);
            } else if (state.livePreviewUpdates) {
                scheduleAppearancePreview(modalInstance);
            } else if (container) {
                container.innerHTML = '<p class="listItemBodyText secondary hsae-preview-placeholder">Preview outdated — refresh the section or enable Live Preview Updates.</p>';
            }
        }
    }

    function setupModalHeader(modalInstance, options = {}) {
        if (!modalInstance?.dialogHeader) return;
        if (modalInstance.dialogHeader.dataset.hsaeHeaderSetup === 'true') {
            const titleEl = modalInstance.dialogHeader.querySelector('.dialogTitle, h2');
            if (titleEl && options.title) {
                titleEl.textContent = options.title;
            }
            updateSectionNameBadge(modalInstance);
            return;
        }
        modalInstance.dialogHeader.dataset.hsaeHeaderSetup = 'true';

        const titleEl = modalInstance.dialogHeader.querySelector('h2, .dialogTitle');
        const closeBtn = modalInstance.dialogHeader.querySelector('.btnClose');

        const headerMain = document.createElement('div');
        headerMain.className = 'hsae-header-main';

        const titleWrap = document.createElement('div');
        titleWrap.className = 'hsae-header-title-wrap';

        if (titleEl) {
            titleEl.textContent = options.title || 'Edit Section';
            titleEl.classList.add('dialogTitle');
            titleWrap.appendChild(titleEl);
        }

        const badge = document.createElement('span');
        badge.className = 'hsae-section-name-badge';
        badge.textContent = modalInstance._hsaeState?.section?.name?.trim() || 'Untitled';
        titleWrap.appendChild(badge);

        headerMain.appendChild(titleWrap);

        if (closeBtn) {
            modalInstance.dialogHeader.insertBefore(headerMain, closeBtn);
        } else {
            modalInstance.dialogHeader.prepend(headerMain);
        }
    }

    function attachListeners(modalInstance, context, callbacks = {}) {
        clearAppearancePreviewScheduling();
        appearancePreviewCache = { fetchKey: null, renderKey: null, items: null };
        modalInstance._hsaePreviewInitialized = false;

        const section = context.section || {};
        modalInstance._hsaeState = buildEditorStateFromSection(section, context);

        const stateHost = modalInstance.dialogContainer || modalInstance.dialogContent;
        if (stateHost) stateHost._hsaeState = modalInstance._hsaeState;
        activeEditorState = modalInstance._hsaeState;

        setupModalHeader(modalInstance, { title: context.headerTitle });
        attachBodyListeners(modalInstance, context);

        const root = modalInstance.dialogContent;
        const { onSave, refreshQueries, updateSectionInConfig } = callbacks;

        if (typeof refreshQueries === 'function') {
            modalInstance._hsaeRefreshQueries = refreshQueries;
        }

        const saveBtn = modalInstance.dialogFooter?.querySelector('.section-save-btn');
        if (saveBtn && typeof onSave === 'function' && saveBtn.dataset.listenerAttached !== 'true') {
            saveBtn.dataset.listenerAttached = 'true';
            saveBtn.addEventListener('click', async () => {
                const dialog = modalInstance.dialogContainer || modalInstance.dialogContent;
                const originalSection = context.originalSection || section;
                const sectionData = collectData(dialog, originalSection);
                if (!sectionData) return;
                sectionData.id = section.id || originalSection.id;
                if (typeof updateSectionInConfig === 'function') {
                    updateSectionInConfig(sectionData);
                }
                await onSave(sectionData);
            });
        }

        if (!modalInstance._hsaeRootListenersAttached) {
            modalInstance._hsaeRootListenersAttached = true;

            root.addEventListener('click', (e) => {
                handleHsaeRootClick(e, modalInstance);
            });

            root.addEventListener('change', (e) => {
                const target = e.target;
                if (!root.contains(target)) return;

                if (target.id === 'hsae-live-preview-updates' && modalInstance._hsaeState) {
                    modalInstance._hsaeState.livePreviewUpdates = target.checked === true;
                    if (target.checked) {
                        scheduleAppearancePreview(modalInstance);
                    } else if (appearancePreviewDebounceTimer) {
                        clearTimeout(appearancePreviewDebounceTimer);
                        appearancePreviewDebounceTimer = null;
                    }
                    return;
                }

                if (modalInstance._hsaeState?.livePreviewUpdates) {
                    const editorBody = root.querySelector('.hsae-editor-body');
                    if (editorBody?.contains(target)) {
                        scheduleAppearancePreview(modalInstance);
                    }
                }

                if (target.id === 'hsae-hide-section-name' || target.id === 'hsae-hide-watched' || target.id === 'hsae-user-enabled-by-default' || target.id === 'hsae-user-configurable') {
                    updateToggleCardHints(root);
                }
            });

            root.addEventListener('input', (e) => {
                const target = e.target;
                if (!modalInstance._hsaeState?.livePreviewUpdates) return;
                if (!root.querySelector('.hsae-editor-body')?.contains(target)) return;
                scheduleAppearancePreview(modalInstance);
            });

            root.addEventListener('input', (e) => {
                const target = e.target;
                if (target?.id === 'section-name' && root.contains(target)) {
                    updateSectionNameBadge(modalInstance);
                }
            });
        }
    }

    function init() {
        // Deprecated no-op: API is resolved lazily via getApi().
    }

    window.KefinHomeScreenAdvancedEditor = {
        init,
        buildHTML,
        collectData,
        attachListeners,
        setupModalHeader,
        refreshEditorBody,
        destroyAppearancePickrs: destroyHsaeAppearancePickrs,
        inferItemSource,
        sectionToVisibility,
        applyVisibilityToSection,
        FILTER_CHIP_OPTIONS,
        ENDPOINT_OPTIONS,
        CACHE_SOURCE_OPTIONS,
        getCachePresets
    };
})();
