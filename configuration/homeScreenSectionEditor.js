// KefinTweaks Home Screen Section Editor
// Creation flow (mode select + wizard) and routing to the legacy advanced editor

(function() {
    'use strict';

    const LOG = (...args) => console.log('[KefinTweaks Section Editor]', ...args);

    const CREATE_FLOW_MODAL_ID = 'kefin-homescreen-section-create-flow';
    const DEFAULT_SECTION_QUERY_LIMIT = 16;

    const QUERY_WIZARD_STEPS = ['type', 'parent', 'query', 'settings', 'appearance', 'confirm'];
    const CUSTOM_WIZARD_STEPS = ['type', 'customItems', 'settings', 'appearance', 'confirm'];
    const WIZARD_STEP_LABELS = {
        type: 'Type',
        parent: 'Selection',
        query: 'Query',
        customItems: 'Create Items',
        appearance: 'Appearance',
        settings: 'Settings',
        confirm: 'Confirm'
    };

    const CUSTOM_TYPE = {
        type: 'Custom',
        label: 'Custom Item Section',
        description: 'Show items with custom images, links and names. These items can link to existing Jellyfin pages or to external websites. Use this to link your other services, share client download locations, provide help information, etc.',
        icon: 'widgets'
    };

    const CUSTOM_IMAGE_FIELDS = [
        { key: 'posterUrl', label: 'Poster URL', required: true },
        { key: 'thumbUrl', label: 'Thumb URL' },
        { key: 'backdropUrl', label: 'Backdrop URL' },
        { key: 'squareUrl', label: 'Square URL' },
        { key: 'bannerUrl', label: 'Banner URL' },
        { key: 'logoUrl', label: 'Logo URL' }
    ];
    const CUSTOM_POSTER_FIELD = CUSTOM_IMAGE_FIELDS[0];
    const CUSTOM_ADDITIONAL_IMAGE_FIELDS = CUSTOM_IMAGE_FIELDS.slice(1);

    const SECTION_VISIBILITY_OPTIONS = [
        { value: 'normal', title: 'Normal', desc: 'These sections are loaded every time the home page loads.' },
        { value: 'seasonal', title: 'Seasonal', desc: 'These sections will only appear between the specified start and end date every time the home page loads.' },
        { value: 'discovery', title: 'Discovery', desc: 'These sections will appear randomly after scrolling to the bottom of the home page when loading new sections.' }
    ];

    const WIZARD_PARENT_DATA = {
        PERSON_RESULT_LIMIT: 500,
        SEARCH_DEBOUNCE_MS: 300,
        APPEARANCE_PREVIEW_DEBOUNCE_MS: 400
    };

    const PARENT_TYPES = [
        { type: 'Genre', label: 'Genre', plural: 'genres', description: 'Show items that share a Genre, like Action or Comedy.', icon: 'theater_comedy', queryField: 'GenreIds' },
        { type: 'Collection', label: 'Collection', plural: 'collections', description: 'Show items from a specific Collection in your library.', icon: 'collections_bookmark', queryField: 'ParentId' },
        { type: 'Playlist', label: 'Playlist', plural: 'playlists', description: 'Show items from a specific Playlist in your library.', icon: 'playlist_play', queryField: 'ParentId' },
        { type: 'Studio', label: 'Studio', plural: 'studios', description: 'Show items from a specific Film Studio or TV Network.', icon: 'apartment', queryField: 'StudioIds' },
        { type: 'Person', label: 'Person', plural: 'people', description: 'Show items that a specific Person has acted in or has directed, written, produced, etc.', icon: 'person', queryField: 'PersonIds' },
        { type: 'Tag', label: 'Tag', plural: 'tags', description: 'Show items that share a Tag, like Time Travel or Revenge.', icon: 'sell', queryField: 'Tags' }
    ];

    const MULTI_SELECT_TYPES = new Set(['Genre', 'Tag', 'Person', 'Studio']);

    function isMultiSelectType(type) {
        return MULTI_SELECT_TYPES.has(type);
    }

    function getPrimaryParent(state) {
        return state.parents?.[0] ?? null;
    }

    function pickRandom(items) {
        return items[Math.floor(Math.random() * items.length)];
    }

    // --- Wizard parent data (live Jellyfin API) ---

    function getWizardSteps(state) {
        return state?.parentType === 'Custom' ? CUSTOM_WIZARD_STEPS : QUERY_WIZARD_STEPS;
    }

    function isCustomType(state) {
        return state?.parentType === 'Custom';
    }

    function getStepIndex(step, state) {
        return getWizardSteps(state).indexOf(step);
    }

    function createBlankCustomItem() {
        return {
            name: '',
            cardFooter: '',
            cardUrl: '',
            posterUrl: '',
            thumbUrl: '',
            backdropUrl: '',
            squareUrl: '',
            bannerUrl: '',
            logoUrl: ''
        };
    }

    function getWizardCustomItemsOptions() {
        return window.KefinHomeScreenCustomItemsEditor?.getCustomItemsOptions({
            idPrefix: 'hsse-custom',
            actionAttr: 'data-hsse-action',
            actions: {
                openEditor: 'wizard-open-custom-item-editor',
                closeEditor: 'wizard-close-custom-item-editor',
                addItem: 'wizard-add-custom-item',
                removeItem: 'wizard-remove-custom-item',
                toggleImages: 'wizard-toggle-custom-images'
            }
        });
    }

    function ensureCustomItemsInitialized(state) {
        if (!state.customItems?.length) {
            state.customItems = [createBlankCustomItem()];
        }
    }

    function hasAdditionalCustomImages(item) {
        return CUSTOM_ADDITIONAL_IMAGE_FIELDS.some(field => item[field.key]?.trim());
    }

    function isCustomItemAdditionalExpanded(wizardState, index, item) {
        const explicit = wizardState.customItemAdditionalExpanded?.[index];
        if (explicit === true) return true;
        if (explicit === false) return false;
        return hasAdditionalCustomImages(item);
    }

    function reindexCustomItemAdditionalExpanded(wizardState, removedIndex) {
        if (!wizardState.customItemAdditionalExpanded) return;
        const next = {};
        Object.entries(wizardState.customItemAdditionalExpanded).forEach(([key, value]) => {
            const i = parseInt(key, 10);
            if (Number.isNaN(i) || value === undefined) return;
            if (i < removedIndex) next[i] = value;
            else if (i > removedIndex) next[i - 1] = value;
        });
        wizardState.customItemAdditionalExpanded = next;
    }

    function hasValidCustomItems(items) {
        return (items || []).some(item => item.name?.trim() && item.posterUrl?.trim());
    }

    function hasCustomItemContent(item) {
        if (!item) return false;
        return [
            item.name,
            item.cardFooter,
            item.cardUrl,
            item.posterUrl,
            item.thumbUrl,
            item.backdropUrl,
            item.squareUrl,
            item.bannerUrl,
            item.logoUrl
        ].some(value => value?.trim());
    }

    function buildStaticItemFromDraft(draft) {
        const name = draft.name?.trim();
        const posterUrl = draft.posterUrl?.trim();
        if (!name || !posterUrl) return null;

        const imageKeys = ['posterUrl', 'thumbUrl', 'backdropUrl', 'squareUrl', 'bannerUrl', 'logoUrl'];
        const provided = {};
        imageKeys.forEach(key => {
            const value = draft[key]?.trim();
            if (value) provided[key] = value;
        });

        const item = { Name: name, Type: 'Folder' };
        const cardUrl = draft.cardUrl?.trim();
        if (cardUrl) item.cardUrl = cardUrl;
        const cardFooter = draft.cardFooter?.trim();
        if (cardFooter) item.cardFooter = cardFooter;

        const keys = Object.keys(provided);
        if (keys.length === 1 && provided.posterUrl) {
            item.imageUrl = provided.posterUrl;
        } else {
            Object.assign(item, provided);
        }
        return item;
    }

    function collectCustomItemFromForm(root, wizardState, index) {
        if (!root || !wizardState.customItems?.[index]) return;
        const item = wizardState.customItems[index];
        const nameEl = root.querySelector(`#hsse-custom-${index}-name`);
        const cardFooterEl = root.querySelector(`#hsse-custom-${index}-cardFooter`);
        const cardUrlEl = root.querySelector(`#hsse-custom-${index}-cardUrl`);
        if (nameEl) item.name = nameEl.value;
        if (cardFooterEl) item.cardFooter = cardFooterEl.value;
        if (cardUrlEl) item.cardUrl = cardUrlEl.value;
        CUSTOM_IMAGE_FIELDS.forEach(field => {
            const el = root.querySelector(`#hsse-custom-${index}-${field.key}`);
            if (el) item[field.key] = el.value;
        });
    }

    function collectCustomItemsFromForm(root, wizardState) {
        if (!root || !wizardState.customItems) return;
        const editorIndex = wizardState.customItemEditorIndex;
        if (editorIndex != null && !Number.isNaN(editorIndex)) {
            collectCustomItemFromForm(root, wizardState, editorIndex);
        }
    }

    function updateCustomImagePreview(imgEl, url) {
        if (!imgEl) return;
        const trimmed = (url || '').trim();
        if (!trimmed) {
            imgEl.removeAttribute('src');
            imgEl.style.display = 'none';
            imgEl.dataset.previewState = 'empty';
            return;
        }
        imgEl.style.display = '';
        imgEl.dataset.previewState = 'loading';
        imgEl.onerror = () => {
            imgEl.style.display = 'none';
            imgEl.dataset.previewState = 'error';
        };
        imgEl.onload = () => {
            imgEl.style.display = '';
            imgEl.dataset.previewState = 'loaded';
        };
        imgEl.src = trimmed;
    }

    function markStepReached(wizardState, stepIndex) {
        if (stepIndex > wizardState.maxReachedStepIndex) {
            wizardState.maxReachedStepIndex = stepIndex;
        }
    }

    function syncCurrentStepFromForm(root, wizardState) {
        if (!root) return;
        switch (wizardState.step) {
            case 'query':
                collectQueryStepFromForm(root, wizardState);
                break;
            case 'customItems':
                collectCustomItemsFromForm(root, wizardState);
                break;
            case 'appearance':
                collectAppearanceStepFromForm(root, wizardState);
                break;
            case 'settings':
                collectSettingsFromForm(root, wizardState);
                break;
            default:
                break;
        }
    }

    function filterParentItemsBySearch(items, search) {
        const q = (search || '').trim().toLowerCase();
        if (!q) return items;
        return items.filter(i => i.name.toLowerCase().includes(q));
    }

    function formatItemCountMeta(count) {
        if (count == null || Number.isNaN(count)) return '';
        const n = parseInt(count, 10);
        return n === 1 ? '1 item' : `${n} items`;
    }

    async function fetchGenres(includeItemTypes) {
        const itemTypes = (includeItemTypes && includeItemTypes.length > 0)
            ? includeItemTypes
            : ['Movie'];
        const serverAddress = window.ApiClient?.serverAddress();
        if (!serverAddress) return [];

        const typesParam = Array.isArray(itemTypes) ? itemTypes.join(',') : itemTypes;
        const url = `${serverAddress}/Genres?IncludeItemTypes=${typesParam}`;
        let data;
        if (window.apiHelper?.getData) {
            data = await window.apiHelper.getData(url, true, 24 * 60 * 60 * 1000);
        } else if (window.ApiClient?.fetch) {
            const resp = await window.ApiClient.fetch({ url, method: 'GET' });
            data = await resp.json();
        } else {
            return [];
        }
        return (data?.Items || []).map(item => ({ id: item.Id, name: item.Name }));
    }

    async function fetchTags(includeItemTypes) {
        const itemTypes = (includeItemTypes && includeItemTypes.length > 0)
            ? includeItemTypes
            : ['Movie'];
        if (window.dataHelper?.getFilters) {
            const filters = await window.dataHelper.getFilters(itemTypes, true, false);
            const list = filters?.Tags || [];
            return list.map(name => ({ id: name, name }));
        }
        const userId = window.ApiClient?.getCurrentUserId();
        const serverAddress = window.ApiClient?.serverAddress();
        if (!userId || !serverAddress || !window.apiHelper?.getData) return [];
        const url = `${serverAddress}/Items/Filters?UserId=${userId}&IncludeItemTypes=${Array.isArray(itemTypes) ? itemTypes.join(',') : itemTypes}`;
        const data = await window.apiHelper.getData(url, true);
        const list = data?.Tags || [];
        return list.map(name => ({ id: name, name }));
    }

    async function fetchCollectionsOrPlaylists(parentType) {
        if (!window.apiHelper?.getItems) return [];
        const itemType = parentType === 'Playlist' ? 'Playlist' : 'BoxSet,CollectionFolder';
        const data = await window.apiHelper.getItems(
            { IncludeItemTypes: itemType, Recursive: true, Fields: 'ItemCounts' },
            true,
            24 * 60 * 60 * 1000
        );
        return (data?.Items || []).map(item => ({
            id: item.Id,
            name: item.Name,
            meta: formatItemCountMeta(item.ChildCount ?? item.UserData?.UnplayedItemCount ?? item.RecursiveItemCount)
        }));
    }

    async function fetchStudios() {
        const userId = window.ApiClient?.getCurrentUserId();
        const serverAddress = window.ApiClient?.serverAddress();
        if (!userId || !serverAddress || !window.apiHelper?.getQuery) return [];
        const url = `${serverAddress}/Studios?UserId=${userId}&Fields=PrimaryImageAspectRatio`;
        const result = await window.apiHelper.getQuery(url, { useCache: true, ttl: 24 * 60 * 60 * 1000 });
        const data = (result && result.data) ? result.data : result;
        const items = data?.Items || data || [];
        return items.map(item => ({
            id: item.Id,
            name: item.Name,
            meta: formatItemCountMeta(item.ChildCount ?? item.SeriesCount)
        })).filter(item => item.id);
    }

    async function fetchPersons(search) {
        const userId = window.ApiClient?.getCurrentUserId();
        const serverAddress = window.ApiClient?.serverAddress();
        if (!userId || !serverAddress) return [];

        const params = new URLSearchParams({
            UserId: userId,
            Limit: String(WIZARD_PARENT_DATA.PERSON_RESULT_LIMIT),
            Fields: 'PrimaryImageAspectRatio,ProductionYear',
            EnableTotalRecordCount: 'false'
        });

        const trimmed = (search || '').trim();
        if (trimmed.length === 1) {
            params.set('NameStartsWith', trimmed);
        } else if (trimmed.length > 1) {
            params.set('SearchTerm', trimmed);
        }

        const url = `${serverAddress}/Persons?${params.toString()}`;
        let data;
        if (window.apiHelper?.getQuery) {
            const result = await window.apiHelper.getQuery(url, { useCache: false });
            data = (result && result.data) ? result.data : result;
        } else if (window.ApiClient?.fetch) {
            const resp = await window.ApiClient.fetch({ url, method: 'GET' });
            data = await resp.json();
        } else {
            return [];
        }

        return (data?.Items || []).map(item => ({
            id: item.Id,
            name: item.Name,
            meta: item.ProductionYear ? String(item.ProductionYear) : ''
        }));
    }

    async function fetchLibraries() {
        const userId = window.ApiClient?.getCurrentUserId();
        if (!userId) return [];

        try {
            if (window.ApiClient?.getUserViews) {
                const result = await window.ApiClient.getUserViews({}, userId);
                const items = result?.Items || result || [];
                return items.map(item => ({
                    id: item.Id,
                    name: item.Name,
                    meta: item.CollectionType ? humanizeLabel(item.CollectionType) : ''
                })).filter(item => item.id);
            }

            const serverAddress = window.ApiClient?.serverAddress();
            if (!serverAddress || !window.apiHelper?.getQuery) return [];
            const url = `${serverAddress}/UserViews?UserId=${userId}`;
            const result = await window.apiHelper.getQuery(url, { useCache: true, ttl: 24 * 60 * 60 * 1000 });
            const data = (result && result.data) ? result.data : result;
            const items = data?.Items || data || [];
            return items.map(item => ({
                id: item.Id,
                name: item.Name,
                meta: item.CollectionType ? humanizeLabel(item.CollectionType) : ''
            })).filter(item => item.id);
        } catch (err) {
            console.warn('[KefinTweaks Section Editor] Failed to fetch libraries:', err);
            return [];
        }
    }

    async function fetchWizardParentItems(parentType, options = {}) {
        const { search = '', includeItemTypes = [] } = options;
        if (!window.ApiClient?.getCurrentUserId?.()) {
            throw new Error('Server connection not available');
        }

        switch (parentType) {
            case 'Genre':
                return fetchGenres(includeItemTypes);
            case 'Tag':
                return fetchTags(includeItemTypes);
            case 'Collection':
            case 'Playlist':
                return fetchCollectionsOrPlaylists(parentType);
            case 'Studio':
                return fetchStudios();
            case 'Person':
                return fetchPersons(search);
            case 'Library':
                return fetchLibraries();
            default:
                return [];
        }
    }

    const ALL_ITEM_TYPES = [
        'Movie', 'Series', 'Episode', 'Season',
        'AggregateFolder', 'Audio', 'AudioBook', 'BasePluginFolder', 'Book', 'BoxSet', 'Channel',
        'ChannelFolderItem', 'CollectionFolder',  'Folder', 'Genre', 'ManualPlaylistsFolder',
        'LiveTvChannel', 'LiveTvProgram', 'MusicAlbum', 'MusicArtist', 'MusicGenre', 'MusicVideo',
        'Person', 'Photo', 'PhotoAlbum', 'Playlist', 'PlaylistsFolder', 'Program', 'Recording', 
        'Studio', 'Trailer', 'TvChannel', 'TvProgram', 'UserRootFolder', 'UserView', 'Video', 'Year'
    ];

    const LIBRARY_TYPE_META = {
        type: 'Library',
        label: 'Library',
        plural: 'libraries',
        description: 'Show items from a specific Library in your collection.',
        icon: 'video_library',
        queryField: 'ParentId'
    };

    const CUSTOM_PARENT_META = {
        type: 'Custom',
        label: 'Custom',
        plural: 'custom parents',
        description: 'Show items from a custom parent item from your collection including specific folders within your libraries.',
        icon: 'folder_open',
        queryField: 'ParentId'
    };

    const LIBRARY_ITEM_META = {
        type: 'LibraryItem',
        label: 'Item',
        plural: 'items',
        description: 'Search your library for specific items.',
        icon: 'movie',
        queryField: 'Ids'
    };

    const LIBRARY_ITEM_TYPE_OPTIONS = ['Movie', 'Series', 'Episode', 'Season', 'MusicAlbum', 'Audio', 'MusicVideo', 'Book'];

    const PARENT_SELECTION_TYPES = ['Collection', 'Playlist', 'Library', 'Custom'];
    const FACET_SELECTION_TYPES = ['Genre', 'Tag', 'Person', 'Studio'];

    function getSelectionTypeMeta(type) {
        if (type === 'Library') return LIBRARY_TYPE_META;
        if (type === 'Custom') return CUSTOM_PARENT_META;
        if (type === 'LibraryItem') return LIBRARY_ITEM_META;
        return PARENT_TYPES.find(t => t.type === type) || null;
    }

    async function fetchLibrarySearchItems(options = {}) {
        const { search = '', includeItemTypes = [], limit = 100 } = options;
        if (!window.apiHelper?.getItems || !window.ApiClient?.getCurrentUserId?.()) {
            return [];
        }

        const params = {
            Recursive: true,
            SortBy: 'SortName',
            SortOrder: 'Ascending',
            Fields: 'PrimaryImageAspectRatio,ProductionYear,Type',
            Limit: limit
        };
        const trimmed = (search || '').trim();
        if (trimmed) params.SearchTerm = trimmed;
        if (includeItemTypes.length) params.IncludeItemTypes = includeItemTypes.join(',');

        const data = await window.apiHelper.getItems(params, false, 60000);
        return (data?.Items || []).map(item => ({
            id: item.Id,
            name: item.Name,
            type: item.Type,
            meta: item.ProductionYear
                ? String(item.ProductionYear)
                : (item.Type ? humanizeLabel(item.Type) : '')
        })).filter(item => item.id);
    }

    function fetchSelectionItems(type, options = {}) {
        return fetchWizardParentItems(type, options);
    }

    function selectionItemNeedsLabel(item) {
        return !!(item?.id && (!item.name || item.name === item.id));
    }

    async function resolveItemsByGetItems(ids, includeItemTypes, idToName) {
        if (!ids.length || !window.apiHelper?.getItems || !window.ApiClient?.getCurrentUserId?.()) return;

        const options = {
            Ids: ids.join(','),
            Recursive: true,
            Fields: 'PrimaryImageAspectRatio'
        };
        if (includeItemTypes) {
            options.IncludeItemTypes = includeItemTypes;
        }

        const data = await window.apiHelper.getItems(options, true, 300000);
        (data?.Items || []).forEach(item => {
            if (item?.Id && item?.Name) {
                idToName.set(String(item.Id), item.Name);
            }
        });
    }

    /**
     * Resolve human-readable labels for selection chips saved with IDs only.
     * @param {string} type - Collection|Playlist|Library|Custom|Genre|Tag|Person|Studio
     * @param {Array<{id:string,name?:string}>} items
     * @param {Object} [options]
     * @param {string[]} [options.includeItemTypes]
     * @returns {Promise<Array<{id:string,name:string}>>}
     */
    async function resolveSelectionItemLabels(type, items, options = {}) {
        if (!Array.isArray(items) || items.length === 0) return items;

        const unresolved = items.filter(selectionItemNeedsLabel);
        if (unresolved.length === 0) return items;

        const idToName = new Map();
        const ids = unresolved.map(item => item.id);
        const includeItemTypes = options.includeItemTypes || [];

        try {
            switch (type) {
                case 'Collection':
                    await resolveItemsByGetItems(ids, 'BoxSet,CollectionFolder', idToName);
                    break;
                case 'Playlist':
                    await resolveItemsByGetItems(ids, 'Playlist', idToName);
                    break;
                case 'Library':
                    (await fetchLibraries()).forEach(item => idToName.set(item.id, item.name));
                    await resolveItemsByGetItems(ids.filter(id => !idToName.has(id)), null, idToName);
                    break;
                case 'Custom':
                    await resolveItemsByGetItems(ids, null, idToName);
                    break;
                case 'Genre': {
                    (await fetchGenres(includeItemTypes.length ? includeItemTypes : ['Movie']))
                        .forEach(item => idToName.set(item.id, item.name));
                    const remaining = ids.filter(id => !idToName.has(id));
                    if (remaining.length) {
                        await resolveItemsByGetItems(remaining, 'Genre', idToName);
                    }
                    break;
                }
                case 'Tag':
                    (await fetchTags(includeItemTypes.length ? includeItemTypes : ['Movie']))
                        .forEach(item => idToName.set(item.id, item.name));
                    break;
                case 'Person':
                    await resolveItemsByGetItems(ids, 'Person', idToName);
                    break;
                case 'Studio': {
                    (await fetchStudios()).forEach(item => idToName.set(item.id, item.name));
                    const remaining = ids.filter(id => !idToName.has(id));
                    if (remaining.length) {
                        await resolveItemsByGetItems(remaining, 'Studio', idToName);
                    }
                    break;
                }
                case 'LibraryItem':
                    await resolveItemsByGetItems(ids, null, idToName);
                    break;
                default:
                    await resolveItemsByGetItems(ids, null, idToName);
                    break;
            }
        } catch (err) {
            WARN('Error resolving selection labels:', err);
        }

        return items.map(item => {
            const resolvedName = idToName.get(item.id);
            if (resolvedName) {
                return { ...item, name: resolvedName };
            }
            return item;
        });
    }

    /**
     * Render a searchable selection list (shared by wizard Selection step and advanced popovers).
     */
    function renderSelectionListHTML({
        type,
        items = [],
        selected = [],
        search = '',
        status = 'idle',
        error = '',
        actionAttr = 'data-hsse-action',
        selectAction = 'wizard-select-parent',
        retryAction = 'wizard-retry-parent-load'
    } = {}) {
        const meta = getSelectionTypeMeta(type);
        const selectedIds = new Set((selected || []).map(s => (typeof s === 'object' ? s.id : s)));

        if (status === 'loading') {
            return `<div class="listItemBodyText secondary hsse-empty">Loading ${escapeHtml(meta?.plural || 'items')}…</div>`;
        }
        if (status === 'error') {
            return `
                <div class="listItemBodyText secondary hsse-empty">${escapeHtml(error || 'Failed to load items.')}</div>
                <button type="button" class="emby-button raised" ${actionAttr}="${retryAction}" style="margin-top:0.75em;">Retry</button>
            `;
        }
        if (items.length === 0) {
            const emptyMsg = search
                ? `No ${meta?.plural || 'items'} match &ldquo;${escapeHtml(search)}&rdquo;`
                : `No ${meta?.plural || 'items'} found`;
            return `<div class="listItemBodyText secondary hsse-empty">${emptyMsg}</div>`;
        }

        return items.map(item => {
            const isSelected = selectedIds.has(item.id);
            const icon = item.type
                ? (window.cardBuilder?.getItemMaterialIcon?.({ Type: item.type }) || meta?.icon || 'folder')
                : (meta?.icon || 'folder');
            return `
            <button type="button" class="hsse-parent-item${isSelected ? ' hsse-active' : ''}" ${actionAttr}="${selectAction}" data-parent-id="${escapeHtml(item.id)}" data-parent-name="${escapeHtml(item.name)}">
                ${renderMaterialIcon(icon, 'hsse-parent-icon')}
                <div style="flex:1;min-width:0;">
                    <div class="listItemBodyText hsse-parent-name">${escapeHtml(item.name)}</div>
                    ${item.meta ? `<div class="listItemBodyText secondary hsse-parent-meta">${escapeHtml(item.meta)}</div>` : ''}
                </div>
            </button>
        `;
        }).join('');
    }

    function renderParentListHTML(wizardState) {
        const items = wizardState.parentType === 'Person'
            ? (wizardState.personSearchResults || [])
            : filterParentItemsBySearch(wizardState.parentItemsByType[wizardState.parentType] || [], wizardState.search);

        return renderSelectionListHTML({
            type: wizardState.parentType,
            items,
            selected: wizardState.parents || [],
            search: wizardState.search,
            status: wizardState.parentListStatus,
            error: wizardState.parentListError,
            actionAttr: 'data-hsse-action',
            selectAction: 'wizard-select-parent',
            retryAction: 'wizard-retry-parent-load'
        });
    }

    /**
     * Open a Selection popover (same UX as wizard Selection step).
     * @param {Object} options
     * @param {string} options.type - Collection|Playlist|Library|Custom|Genre|Tag|Person|Studio
     * @param {boolean} options.multi - multi-select mode
     * @param {Array<{id:string,name:string}>} options.selected - initially selected items
     * @param {string[]} [options.includeItemTypes]
     * @param {Function} options.onConfirm - called with selected items array
     */
    function openSelectionPopover(options = {}) {
        const {
            type,
            multi = false,
            selected = [],
            includeItemTypes = [],
            onConfirm
        } = options;

        const meta = getSelectionTypeMeta(type);
        const modalId = 'kefin-selection-popover';
        if (window.ModalSystem?.isOpen?.(modalId)) {
            window.ModalSystem.close(modalId);
        }

        let draftSelected = (selected || []).map(s => (typeof s === 'object' ? { ...s } : { id: s, name: s }));
        let search = '';
        let itemsCache = [];
        let personResults = [];
        let listStatus = type === 'Custom' ? 'idle' : 'loading';
        let listError = '';
        let searchTimer = null;
        let loadRequestId = 0;

        const content = document.createElement('div');
        content.className = 'hsse-selection-popover';

        const footer = document.createElement('div');
        footer.style.display = 'flex';
        footer.style.gap = '0.5em';
        footer.style.justifyContent = 'flex-end';
        footer.innerHTML = `
            <button type="button" class="emby-button raised" data-sel-action="cancel">Cancel</button>
            <button type="button" class="emby-button raised block button-submit" data-sel-action="confirm">Confirm</button>
        `;

        function getVisibleItems() {
            if (type === 'Person') return personResults;
            return filterParentItemsBySearch(itemsCache, search);
        }

        function renderBody(options = {}) {
            const preserveScroll = options.preserveScroll === true;
            const prevList = preserveScroll ? content.querySelector('#hsse-selection-list') : null;
            const prevScrollTop = prevList ? prevList.scrollTop : 0;
            if (type === 'Custom') {
                const currentGuid = draftSelected[0]?.id || '';
                content.innerHTML = `
                    <div class="hsse-section-block">
                        <div class="listItemBodyText hsse-section-label">Parent Item ID</div>
                        <div class="listItemBodyText secondary hsse-field-hint" style="margin-bottom:0.5em;">Enter the GUID of a library folder or other parent item.</div>
                        <input type="text" id="hsse-selection-guid" class="fld emby-input" value="${escapeHtml(currentGuid)}" placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx" autocomplete="off">
                    </div>
                `;
                return;
            }

            content.innerHTML = `
                <div class="hsse-section-block">
                    <input type="text" id="hsse-selection-search" class="fld emby-input" value="${escapeHtml(search)}" placeholder="Search..." aria-label="Search ${escapeHtml(meta?.plural || 'items')}">
                </div>
                <div class="hsse-parent-list" id="hsse-selection-list">
                    ${renderSelectionListHTML({
                        type,
                        items: getVisibleItems(),
                        selected: draftSelected,
                        search,
                        status: listStatus,
                        error: listError,
                        actionAttr: 'data-sel-action',
                        selectAction: 'select-item',
                        retryAction: 'retry-load'
                    })}
                </div>
            `;

            if (preserveScroll) {
                const nextList = content.querySelector('#hsse-selection-list');
                if (nextList) nextList.scrollTop = prevScrollTop;
            }
        }

        async function loadItems(forceSearch) {
            if (type === 'Custom') return;
            const requestId = ++loadRequestId;
            listStatus = 'loading';
            listError = '';
            renderBody();

            try {
                const fetched = await fetchSelectionItems(type, {
                    search: forceSearch != null ? forceSearch : search,
                    includeItemTypes
                });
                if (requestId !== loadRequestId) return;
                if (type === 'Person') {
                    personResults = fetched;
                } else {
                    itemsCache = fetched;
                }
                listStatus = 'idle';
            } catch (err) {
                if (requestId !== loadRequestId) return;
                listStatus = 'error';
                listError = err?.message || 'Failed to load items.';
            }
            renderBody();
        }

        function toggleItem(id, name) {
            const existing = draftSelected.findIndex(p => p.id === id);
            if (multi) {
                if (existing >= 0) draftSelected.splice(existing, 1);
                else draftSelected.push({ id, name });
            } else {
                draftSelected = existing >= 0 ? [] : [{ id, name }];
            }
            renderBody({ preserveScroll: true });
            const searchEl = content.querySelector('#hsse-selection-search');
            if (searchEl) {
                searchEl.focus();
                const len = searchEl.value.length;
                searchEl.setSelectionRange(len, len);
            }
        }

        window.ModalSystem.create({
            id: modalId,
            title: meta ? `Select ${meta.label}` : 'Select',
            content,
            footer,
            closeOnBackdrop: true,
            closeOnEscape: true,
            showCloseButton: true,
            onOpen: (modalInstance) => {
                const root = modalInstance.dialogContent;
                const foot = modalInstance.dialogFooter;

                renderBody();
                if (type !== 'Custom') loadItems();

                root.addEventListener('click', (e) => {
                    const actionEl = e.target.closest('[data-sel-action]');
                    if (!actionEl || !root.contains(actionEl)) return;
                    const action = actionEl.dataset.selAction;
                    if (action === 'select-item') {
                        toggleItem(actionEl.dataset.parentId, actionEl.dataset.parentName);
                    } else if (action === 'retry-load') {
                        loadItems();
                    }
                });

                root.addEventListener('input', (e) => {
                    if (e.target.id === 'hsse-selection-search') {
                        search = e.target.value;
                        if (searchTimer) clearTimeout(searchTimer);
                        if (type === 'Person') {
                            searchTimer = setTimeout(() => loadItems(search), WIZARD_PARENT_DATA.SEARCH_DEBOUNCE_MS);
                        } else {
                            renderBody();
                            const searchEl = content.querySelector('#hsse-selection-search');
                            if (searchEl) {
                                searchEl.focus();
                                const len = searchEl.value.length;
                                searchEl.setSelectionRange(len, len);
                            }
                        }
                    } else if (e.target.id === 'hsse-selection-guid') {
                        const guid = e.target.value.trim();
                        draftSelected = guid ? [{ id: guid, name: guid }] : [];
                    }
                });

                foot.addEventListener('click', (e) => {
                    const actionEl = e.target.closest('[data-sel-action]');
                    if (!actionEl) return;
                    if (actionEl.dataset.selAction === 'cancel') {
                        window.ModalSystem.close(modalId);
                        return;
                    }
                    if (actionEl.dataset.selAction === 'confirm') {
                        if (type === 'Custom') {
                            const guidInput = root.querySelector('#hsse-selection-guid');
                            const guid = guidInput?.value?.trim() || '';
                            draftSelected = guid ? [{ id: guid, name: guid }] : [];
                        }
                        if (typeof onConfirm === 'function') {
                            onConfirm(draftSelected.slice());
                        }
                        window.ModalSystem.close(modalId);
                    }
                });
            }
        });
    }

    /**
     * Open a library item picker for static query items.
     * @param {Object} options
     * @param {Array<{id:string,name:string}>} [options.selected]
     * @param {Function} options.onConfirm
     */
    function openLibraryItemPickerPopover(options = {}) {
        const { selected = [], onConfirm } = options;
        const modalId = 'kefin-library-item-picker';
        const meta = LIBRARY_ITEM_META;

        if (window.ModalSystem?.isOpen?.(modalId)) {
            window.ModalSystem.close(modalId);
        }

        let draftSelected = (selected || []).map(s => (typeof s === 'object' ? { ...s } : { id: s, name: s }));
        let search = '';
        let activeItemTypes = [];
        let itemsCache = [];
        let listStatus = 'loading';
        let listError = '';
        let searchTimer = null;
        let loadRequestId = 0;

        const content = document.createElement('div');
        content.className = 'hsse-selection-popover hsse-library-item-picker';

        const footer = document.createElement('div');
        footer.style.display = 'flex';
        footer.style.gap = '0.5em';
        footer.style.justifyContent = 'flex-end';
        footer.innerHTML = `
            <button type="button" class="emby-button raised" data-libpick-action="cancel">Cancel</button>
            <button type="button" class="emby-button raised block button-submit" data-libpick-action="confirm">Confirm</button>
        `;

        function renderTypeChipsHTML() {
            return LIBRARY_ITEM_TYPE_OPTIONS.map(type => `
                <button type="button" class="kefin-chip hsse-chip${activeItemTypes.includes(type) ? ' hsse-active' : ''}" data-libpick-action="toggle-type" data-item-type="${escapeHtml(type)}">${escapeHtml(humanizeLabel(type))}</button>
            `).join('');
        }

        function renderBody(options = {}) {
            const preserveScroll = options.preserveScroll === true;
            const prevList = preserveScroll ? content.querySelector('#hsse-library-item-list') : null;
            const prevScrollTop = prevList ? prevList.scrollTop : 0;

            content.innerHTML = `
                <div class="hsse-section-block">
                    <input type="text" id="hsse-library-item-search" class="fld emby-input" value="${escapeHtml(search)}" placeholder="Search your library..." aria-label="Search library items">
                </div>
                <div class="hsse-section-block">
                    <div class="listItemBodyText secondary hsae-field-hint">Filter by item type (optional)</div>
                    <div class="hsse-chip-row hsse-library-item-type-chips">
                        ${renderTypeChipsHTML()}
                    </div>
                </div>
                <div class="hsse-parent-list" id="hsse-library-item-list">
                    ${renderSelectionListHTML({
                        type: 'LibraryItem',
                        items: itemsCache,
                        selected: draftSelected,
                        search,
                        status: listStatus,
                        error: listError,
                        actionAttr: 'data-libpick-action',
                        selectAction: 'select-item',
                        retryAction: 'retry-load'
                    })}
                </div>
            `;

            if (preserveScroll) {
                const nextList = content.querySelector('#hsse-library-item-list');
                if (nextList) nextList.scrollTop = prevScrollTop;
            }
        }

        async function loadItems() {
            const requestId = ++loadRequestId;
            listStatus = 'loading';
            listError = '';
            renderBody();

            try {
                const fetched = await fetchLibrarySearchItems({
                    search,
                    includeItemTypes: activeItemTypes
                });
                if (requestId !== loadRequestId) return;
                itemsCache = fetched;
                listStatus = 'idle';
            } catch (err) {
                if (requestId !== loadRequestId) return;
                listStatus = 'error';
                listError = err?.message || 'Failed to load items.';
            }
            renderBody();
        }

        function toggleItem(id, name) {
            const existing = draftSelected.findIndex(p => p.id === id);
            if (existing >= 0) draftSelected.splice(existing, 1);
            else draftSelected.push({ id, name });
            renderBody({ preserveScroll: true });
            const searchEl = content.querySelector('#hsse-library-item-search');
            if (searchEl) {
                searchEl.focus();
                const len = searchEl.value.length;
                searchEl.setSelectionRange(len, len);
            }
        }

        function toggleItemType(type) {
            const idx = activeItemTypes.indexOf(type);
            if (idx >= 0) activeItemTypes.splice(idx, 1);
            else activeItemTypes.push(type);
            loadItems();
        }

        window.ModalSystem.create({
            id: modalId,
            title: 'Select Items',
            content,
            footer,
            closeOnBackdrop: true,
            closeOnEscape: true,
            showCloseButton: true,
            onOpen: (modalInstance) => {
                const root = modalInstance.dialogContent;
                const foot = modalInstance.dialogFooter;

                renderBody();
                loadItems();

                root.addEventListener('click', (e) => {
                    const actionEl = e.target.closest('[data-libpick-action]');
                    if (!actionEl || !root.contains(actionEl)) return;
                    const action = actionEl.dataset.libpickAction;
                    if (action === 'select-item') {
                        toggleItem(actionEl.dataset.parentId, actionEl.dataset.parentName);
                    } else if (action === 'toggle-type') {
                        toggleItemType(actionEl.dataset.itemType);
                    } else if (action === 'retry-load') {
                        loadItems();
                    }
                });

                root.addEventListener('input', (e) => {
                    if (e.target.id !== 'hsse-library-item-search') return;
                    search = e.target.value;
                    if (searchTimer) clearTimeout(searchTimer);
                    searchTimer = setTimeout(() => loadItems(), WIZARD_PARENT_DATA.SEARCH_DEBOUNCE_MS);
                });

                foot.addEventListener('click', (e) => {
                    const actionEl = e.target.closest('[data-libpick-action]');
                    if (!actionEl) return;
                    if (actionEl.dataset.libpickAction === 'cancel') {
                        window.ModalSystem.close(modalId);
                        return;
                    }
                    if (actionEl.dataset.libpickAction === 'confirm') {
                        if (typeof onConfirm === 'function') {
                            onConfirm(draftSelected.slice());
                        }
                        window.ModalSystem.close(modalId);
                    }
                });
            }
        });
    }

    function renderAppearancePreviewHTML() {
        return `
            <div class="hsse-section-block hsse-appearance-preview">
                <div class="listItemBodyText hsse-section-label">Preview</div>
                <div id="hsse-appearance-preview-container" class="hsse-appearance-preview-container">
                    <p class="listItemBodyText secondary" style="text-align:center;padding:1.5em 0;">Loading preview…</p>
                </div>
            </div>
        `;
    }

    function getAppearancePreviewQueryKey(wizardState) {
        if (isCustomType(wizardState)) {
            return JSON.stringify({
                parentType: 'Custom',
                customItems: (wizardState.customItems || []).map(item => ({
                    name: item.name,
                    cardFooter: item.cardFooter,
                    cardUrl: item.cardUrl,
                    posterUrl: item.posterUrl,
                    thumbUrl: item.thumbUrl,
                    backdropUrl: item.backdropUrl,
                    squareUrl: item.squareUrl,
                    bannerUrl: item.bannerUrl,
                    logoUrl: item.logoUrl
                }))
            });
        }
        const parents = wizardState.parents || [];
        return JSON.stringify({
            parentType: wizardState.parentType,
            parentIds: parents.map(p => p.id).sort(),
            parentNames: parents.map(p => p.name).sort(),
            includeItemTypes: [...(wizardState.includeItemTypes || [])].sort(),
            sortBy: wizardState.sortBy,
            sortOrder: wizardState.sortOrder,
            unwatchedOnly: wizardState.unwatchedOnly === true
        });
    }

    const ITEM_TYPE_OPTIONS = ['Movie', 'Series', 'Episode', 'Season', 'MusicAlbum', 'Audio', 'MusicVideo', 'Book'];

    function getIncludedItemTypesHintText(includeItemTypes) {
        if (!includeItemTypes || includeItemTypes.length === 0) {
            return 'None selected - all item types will be included.';
        }
        const selected = ITEM_TYPE_OPTIONS.filter(type => includeItemTypes.includes(type));
        return `This section will display items with the following types: ${formatItemTypesLabel(selected)}`;
    }

    function updateIncludedItemTypesHint(root, includeItemTypes) {
        const hint = root?.querySelector('#hsse-item-types-hint');
        if (hint) hint.textContent = getIncludedItemTypesHintText(includeItemTypes);
    }

    const FALLBACK_SORT_ORDERS = ['Default', 'Random', 'SortName', 'DateCreated', 'CommunityRating'];
    const FALLBACK_SORT_ORDER_DIRECTIONS = ['Ascending', 'Descending'];
    const FALLBACK_CARD_FORMATS = ['Poster', 'Thumb', 'Series Thumb', 'Series Poster', 'Backdrop', 'Square', 'Random', 'Button', 'Banner', 'Logo', 'Clear Art', 'Disc'];
    const FALLBACK_SPOTLIGHT_LAYOUT_OPTIONS = [{ value: 'Border', label: 'Border' }, { value: 'Borderless', label: 'Borderless' }];
    const FALLBACK_SPOTLIGHT_SIZE_OPTIONS = [{ value: 'normal', label: 'Normal' }, { value: 'large', label: 'Large' }, { value: 'full', label: 'Full' }];
    const FALLBACK_SPOTLIGHT_TILE_COUNT_OPTIONS = [{ value: '1', label: '1' }, { value: '2', label: '2' }, { value: '3', label: '3' }];

    function getEditorConstants() {
        return window.KefinHomeScreenEditorConstants || {};
    }

    function getSortOrders() {
        return getEditorConstants().SORT_ORDERS || FALLBACK_SORT_ORDERS;
    }

    function getSortOrderDirections() {
        return getEditorConstants().SORT_ORDER_DIRECTIONS || FALLBACK_SORT_ORDER_DIRECTIONS;
    }

    function getCardFormats() {
        return getEditorConstants().CARD_FORMATS || FALLBACK_CARD_FORMATS;
    }

    function getSpotlightLayoutOptions() {
        return getEditorConstants().SPOTLIGHT_LAYOUT_OPTIONS || FALLBACK_SPOTLIGHT_LAYOUT_OPTIONS;
    }

    function getSpotlightSizeOptions() {
        return getEditorConstants().SPOTLIGHT_SIZE_OPTIONS || FALLBACK_SPOTLIGHT_SIZE_OPTIONS;
    }

    function getSpotlightTileCountOptions() {
        return getEditorConstants().SPOTLIGHT_TILE_COUNT_OPTIONS || FALLBACK_SPOTLIGHT_TILE_COUNT_OPTIONS;
    }

    function applyRandomAppearanceOptions(state) {
        const formats = getCardFormats().filter(f => f !== 'Random');
        state.cardFormat = pickRandom(formats.length ? formats : ['Poster']);
        const layouts = getSpotlightLayoutOptions();
        const sizes = getSpotlightSizeOptions();
        state.spotlightLayout = pickRandom(layouts).value;
        state.spotlightSize = pickRandom(sizes).value;
        const maxTiles = state.spotlightSize === 'full' ? 1
            : state.spotlightSize === 'large' ? 2 : 3;
        state.tileCount = String(1 + Math.floor(Math.random() * maxTiles));
        state.panAnimation = Math.random() < 0.5;
    }

    function escapeHtml(str) {
        return String(str ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    function humanizeLabel(value) {
        if (!value || typeof value !== 'string') return value;
        return value
            .replace(/([a-z])([A-Z])/g, '$1 $2')
            .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2');
    }

    function formatItemTypesLabel(types) {
        return (types || []).map(humanizeLabel).join(', ');
    }

    function renderMaterialIcon(name, className = '') {
        return `<span class="material-icons${className ? ' ' + className : ''}" aria-hidden="true">${escapeHtml(name)}</span>`;
    }

    function scrollSelectedParentIntoView(root) {
        root?.querySelector('.hsse-parent-item.hsse-active')
            ?.scrollIntoView({ block: 'nearest', behavior: 'instant' });
    }

    function buildFieldLabel(label, labelTooltip) {
        if (labelTooltip) {
            return `<div class="listItemBodyText hsse-section-label hsse-label-with-info">
                ${escapeHtml(label)}
                <span class="material-icons hsse-info-icon" title="${escapeHtml(labelTooltip)}" aria-label="${escapeHtml(labelTooltip)}">info</span>
            </div>`;
        }
        return `<div class="listItemBodyText hsse-section-label">${escapeHtml(label)}</div>`;
    }

    function hsseBuildSelect(id, options, selectedValue, label, labelTooltip) {
        const optionsHTML = options.map(opt => {
            const value = typeof opt === 'string' ? opt : opt.value;
            const optLabel = typeof opt === 'string' ? humanizeLabel(opt) : opt.label;
            const selected = value === selectedValue ? 'selected' : '';
            return `<option value="${escapeHtml(value)}" ${selected}>${escapeHtml(optLabel)}</option>`;
        }).join('');

        return `
            <div class="hsse-field">
                ${buildFieldLabel(label, labelTooltip)}
                <select id="${escapeHtml(id)}" class="fld emby-select emby-select-withcolor" aria-label="${escapeHtml(label)}">
                    ${optionsHTML}
                </select>
            </div>
        `;
    }

    function hsseBuildTextInput(id, value, label, type = 'text', placeholder = '') {
        return `
            <div class="hsse-section-block">
                ${buildFieldLabel(label)}
                <input type="${escapeHtml(type)}" id="${escapeHtml(id)}" class="fld emby-input" value="${escapeHtml(value)}" placeholder="${escapeHtml(placeholder)}" aria-label="${escapeHtml(label)}">
            </div>
        `;
    }

    function hsseBuildToggleSlider(id, checked, label, labelTooltip) {
        const isEnabled = checked === true;
        const checkboxId = id ? `${id}-checkbox` : `toggle-${Math.random().toString(36).slice(2)}-checkbox`;
        const labelHtml = labelTooltip
            ? `<div class="listItemBodyText hsse-label-with-info">
                <label for="${escapeHtml(checkboxId)}" style="cursor: pointer;">${escapeHtml(label)}</label>
                <span class="material-icons hsse-info-icon" title="${escapeHtml(labelTooltip)}" aria-label="${escapeHtml(labelTooltip)}">info</span>
               </div>`
            : `<label class="listItemBodyText" for="${escapeHtml(checkboxId)}" style="cursor: pointer;">${escapeHtml(label)}</label>`;

        return `
            <div class="hsse-section-block" style="display: flex; align-items: center; justify-content: space-between; padding: 0.75em 1em; border: 1px solid rgba(255,255,255,0.1); border-radius: 8px;">
                ${labelHtml}
                <input type="checkbox" id="${escapeHtml(checkboxId)}" class="hide" ${isEnabled ? 'checked' : ''} data-hsse-toggle="${escapeHtml(id || checkboxId)}">
                <button type="button" class="toggle-slider" data-checkbox-id="${escapeHtml(checkboxId)}" data-enabled="${isEnabled}" aria-pressed="${isEnabled}" style="
                    position: relative; width: 52px; height: 28px; border-radius: 14px; border: none; cursor: pointer;
                    background: ${isEnabled ? 'rgba(0, 164, 220, 0.8)' : 'rgba(158, 158, 158, 0.5)'};
                ">
                    <span style="position:absolute; top:50%; left:${isEnabled ? '8px' : '6px'}; transform:translateY(-50%); font-size:9px; font-weight:700; color:white; opacity:${isEnabled ? '1' : '0'};">ON</span>
                    <span style="position:absolute; top:50%; right:${isEnabled ? '6px' : '8px'}; transform:translateY(-50%); font-size:9px; font-weight:700; color:white; opacity:${isEnabled ? '0' : '1'};">OFF</span>
                    <span style="position:absolute; top:3px; left:${isEnabled ? 'calc(100% - 26px)' : '3px'}; width:22px; height:22px; border-radius:50%; background:white; transition:left 0.2s;"></span>
                </button>
            </div>
        `;
    }

    function updateToggleSliderUI(btn, checked) {
        const isOn = checked === true;
        btn.dataset.enabled = isOn;
        btn.setAttribute('aria-pressed', String(isOn));
        btn.style.background = isOn ? 'rgba(0, 164, 220, 0.8)' : 'rgba(158, 158, 158, 0.5)';
        const spans = btn.querySelectorAll('span');
        if (spans[0]) spans[0].style.opacity = isOn ? '1' : '0';
        if (spans[1]) spans[1].style.opacity = isOn ? '0' : '1';
        if (spans[2]) spans[2].style.left = isOn ? 'calc(100% - 26px)' : '3px';
    }

    function getExistingGroupNames(config) {
        const groups = config?.CUSTOM_SECTION_GROUPS || [];
        return [...new Set(groups.map(g => g.name).filter(Boolean))];
    }

    function getDefaultGroupSelect(config) {
        const existing = getExistingGroupNames(config);
        if (existing.includes('Custom Sections')) return 'Custom Sections';
        return existing.length > 0 ? existing[0] : 'New...';
    }

    function resolveGroupName(wizardState, config) {
        const select = wizardState.sectionGroupSelect || getDefaultGroupSelect(config);
        if (select === 'New...') {
            return (wizardState.sectionGroupNew || '').trim() || 'Custom Sections';
        }
        return select;
    }

    function buildSectionGroupHTML(config, wizardState) {
        const existing = getExistingGroupNames(config);
        const options = ['New...', ...existing];
        const selected = wizardState.sectionGroupSelect || getDefaultGroupSelect(config);
        const showNew = selected === 'New...';

        return `
            <div class="hsse-section-block">
                ${hsseBuildSelect('hsse-wizard-sectionGroup', options, selected, 'Section Group')}
                <div id="hsse-wizard-sectionGroup-new-container" style="display:${showNew ? 'block' : 'none'};">
                    ${buildFieldLabel('New Group Name')}
                    <input type="text" id="hsse-wizard-sectionGroup-new" class="fld emby-input" value="${escapeHtml(wizardState.sectionGroupNew || '')}" aria-label="New Group Name">
                </div>
            </div>
        `;
    }

    function getSectionVisibilityLabel(value) {
        return SECTION_VISIBILITY_OPTIONS.find(o => o.value === value)?.title || value || 'Normal';
    }

    function hasValidSeasonalDates(wizardState) {
        return !!(wizardState.startDate?.trim() && wizardState.endDate?.trim());
    }

    function applySectionVisibilityToSection(section, wizardState, baseSection) {
        const visibility = wizardState.sectionVisibility || 'normal';
        const { order, startDate, endDate } = wizardState;

        if (visibility === 'discovery') {
            section.discoveryEnabled = true;
            section.type = 'discovery';
            delete section.startDate;
            delete section.endDate;
            section.order = baseSection.order || 100;
        } else if (visibility === 'seasonal') {
            section.discoveryEnabled = false;
            section.type = 'seasonal';
            section.startDate = (startDate || '').trim();
            section.endDate = (endDate || '').trim();
            section.order = order ? parseInt(order, 10) : (baseSection.order || 100);
        } else {
            section.discoveryEnabled = false;
            section.type = 'home';
            delete section.startDate;
            delete section.endDate;
            section.order = order ? parseInt(order, 10) : (baseSection.order || 100);
        }
    }

    function renderSectionVisibilityHTML(wizardState) {
        const visibility = wizardState.sectionVisibility || 'normal';
        const showSeasonalDates = visibility === 'seasonal';
        const showOrder = visibility !== 'discovery';

        return `
            <div class="hsse-section-block">
                <div class="listItemBodyText hsse-section-label">Section Type</div>
                <div class="hsse-appearance-grid">
                    ${SECTION_VISIBILITY_OPTIONS.map(opt => `
                        <button type="button" class="hsse-appearance-card${visibility === opt.value ? ' hsse-active' : ''}" data-hsse-action="wizard-set-section-visibility" data-visibility="${escapeHtml(opt.value)}">
                            <div class="listItemBodyText hsse-appearance-title">${escapeHtml(opt.title)}</div>
                            <div class="listItemBodyText secondary hsse-appearance-desc">${escapeHtml(opt.desc)}</div>
                        </button>
                    `).join('')}
                </div>
            </div>
            ${showSeasonalDates ? `
                <div class="hsse-section-block hsse-seasonal-dates">
                    <div class="hsse-field-grid">
                        ${hsseBuildTextInput('hsse-wizard-startDate', wizardState.startDate, 'Start Date (MM-DD)')}
                        ${hsseBuildTextInput('hsse-wizard-endDate', wizardState.endDate, 'End Date (MM-DD)')}
                    </div>
                </div>
            ` : ''}
            ${showOrder ? `
                <div id="hsse-wizard-order-container">
                    ${hsseBuildTextInput('hsse-wizard-order', wizardState.order, 'Order', 'number', 'Auto')}
                </div>
            ` : ''}
        `;
    }

    function collectSettingsFromForm(root, wizardState) {
        const nameEl = root.querySelector('#hsse-wizard-sectionName');
        const groupSelect = root.querySelector('#hsse-wizard-sectionGroup');
        const groupNew = root.querySelector('#hsse-wizard-sectionGroup-new');
        const orderEl = root.querySelector('#hsse-wizard-order');
        const startDateEl = root.querySelector('#hsse-wizard-startDate');
        const endDateEl = root.querySelector('#hsse-wizard-endDate');
        if (nameEl) wizardState.sectionName = nameEl.value;
        if (groupSelect) wizardState.sectionGroupSelect = groupSelect.value;
        if (groupNew) wizardState.sectionGroupNew = groupNew.value;
        if (startDateEl) wizardState.startDate = startDateEl.value;
        if (endDateEl) wizardState.endDate = endDateEl.value;
        if (orderEl && wizardState.sectionVisibility !== 'discovery') wizardState.order = orderEl.value;
    }

    function collectQueryStepFromForm(root, wizardState) {
        const sortByEl = root.querySelector('#hsse-wizard-sortBy');
        const sortOrderEl = root.querySelector('#hsse-wizard-sortOrder');
        const unwatchedEl = root.querySelector('#hsse-wizard-unwatched-checkbox');
        if (sortByEl) wizardState.sortBy = sortByEl.value;
        if (sortOrderEl) wizardState.sortOrder = sortOrderEl.value;
        if (unwatchedEl) wizardState.unwatchedOnly = unwatchedEl.checked;
    }

    function collectAppearanceStepFromForm(root, wizardState) {
        if (wizardState.renderMode !== 'Spotlight') return;
        const layoutEl = root.querySelector('#hsse-wizard-spotlightLayout');
        const sizeEl = root.querySelector('#hsse-wizard-spotlightSize');
        const tileEl = root.querySelector('#hsse-wizard-tileCount');
        const animatedEl = root.querySelector('#hsse-wizard-animated-checkbox');
        if (layoutEl) wizardState.spotlightLayout = layoutEl.value;
        if (sizeEl) wizardState.spotlightSize = sizeEl.value;
        if (tileEl) wizardState.tileCount = tileEl.value;
        if (animatedEl) wizardState.panAnimation = animatedEl.checked;
    }

    function renderConfirmOverview(wizardState, config) {
        const isCustom = isCustomType(wizardState);
        const meta = isCustom ? CUSTOM_TYPE : PARENT_TYPES.find(t => t.type === wizardState.parentType);
        const parents = wizardState.parents || [];
        const selectionLabel = isCustom
            ? ((wizardState.customItems || []).map(i => i.name?.trim()).filter(Boolean).join(', ') || '—')
            : (parents.length ? parents.map(p => p.name).join(', ') : '—');
        const rows = [
            ['Section Name', wizardState.sectionName || '—'],
            ['Section Group', resolveGroupName(wizardState, config)],
            ['Based On', meta?.label || wizardState.parentType || '—'],
            [isCustom ? 'Items' : 'Selection', selectionLabel]
        ];

        if (!isCustom) {
            rows.push(
                ['Item Types', wizardState.includeItemTypes.length ? formatItemTypesLabel(wizardState.includeItemTypes) : 'All types'],
                ['Sort By', wizardState.sortBy === 'Default' ? 'Default' : `${humanizeLabel(wizardState.sortBy)} (${wizardState.sortOrder})`],
                ['Hide Watched Items', wizardState.unwatchedOnly ? 'Yes' : 'No']
            );
        }

        rows.push(['Render Mode', wizardState.renderMode || 'Normal']);

        if (wizardState.renderMode === 'Normal') {
            rows.push(['Card Format', wizardState.cardFormat || 'Poster']);
        }

        if (wizardState.renderMode === 'Spotlight') {
            const layoutLabel = getSpotlightLayoutOptions().find(o => o.value === wizardState.spotlightLayout)?.label || wizardState.spotlightLayout;
            const sizeLabel = getSpotlightSizeOptions().find(o => o.value === wizardState.spotlightSize)?.label || wizardState.spotlightSize;
            rows.push(['Spotlight Layout', layoutLabel || '—']);
            rows.push(['Spotlight Size', sizeLabel || '—']);
            rows.push(['Tiled Backdrops', wizardState.tileCount || '1']);
            rows.push(['Animated Transitions', wizardState.panAnimation ? 'Yes' : 'No']);
        }

        if (wizardState.renderMode === 'Random') {
            const layoutLabel = getSpotlightLayoutOptions().find(o => o.value === wizardState.spotlightLayout)?.label || wizardState.spotlightLayout;
            const sizeLabel = getSpotlightSizeOptions().find(o => o.value === wizardState.spotlightSize)?.label || wizardState.spotlightSize;
            rows.push(['Card Format (random)', wizardState.cardFormat || 'Poster']);
            rows.push(['Spotlight (random)', `${layoutLabel || '—'}, ${sizeLabel || '—'}, ${wizardState.tileCount || '1'} tiles, ${wizardState.panAnimation ? 'animated' : 'static'}`]);
        }

        const visibility = wizardState.sectionVisibility || 'normal';
        rows.push(['Section Type', getSectionVisibilityLabel(visibility)]);
        if (visibility === 'seasonal') {
            rows.push(['Start Date', wizardState.startDate?.trim() || '—']);
            rows.push(['End Date', wizardState.endDate?.trim() || '—']);
        }
        if (visibility !== 'discovery') {
            rows.push(['Order', wizardState.order ? wizardState.order : 'Auto']);
        }

        return `
            <div class="hsse-section-block">
                <div class="listItemBodyText hsse-section-label">Section Overview</div>
            </div>
            <dl class="hsse-confirm-list">
                ${rows.map(([label, value]) => `
                    <div class="hsse-confirm-row">
                        <dt class="listItemBodyText secondary">${escapeHtml(label)}</dt>
                        <dd class="listItemBodyText">${escapeHtml(String(value))}</dd>
                    </div>
                `).join('')}
            </dl>
        `;
    }

    function buildSectionName(parentType, items) {
        const list = Array.isArray(items) ? items : (items ? [items] : []);
        if (list.length === 0) return '';
        const names = list.map(i => i.name).join(' & ');
        switch (parentType) {
            case 'Genre': return `${names} Picks`;
            case 'Collection':
            case 'Playlist': return list[0].name;
            case 'Studio': return `More from ${names}`;
            case 'Person': return `Starring ${names}`;
            case 'Tag': return `${names} Collection`;
            default: return names;
        }
    }

    /**
     * Map wizard state to a HomeScreenSection-shaped draft object.
     */
    function wizardStateToSection(wizardState, baseSection) {
        const {
            parentType,
            parents = [],
            customItems = [],
            includeItemTypes,
            sortBy,
            sortOrder,
            unwatchedOnly,
            renderMode,
            cardFormat,
            spotlightLayout,
            spotlightSize,
            tileCount,
            panAnimation,
            sectionName,
            order
        } = wizardState;

        if (parentType === 'Custom') {
            const items = customItems.map(buildStaticItemFromDraft).filter(Boolean);
            const section = {
                ...baseSection,
                id: baseSection.id,
                name: sectionName || 'Custom Section',
                enabled: true,
                isCustom: true,
                renderMode: renderMode || 'Normal',
                cardFormat: renderMode === 'Spotlight' ? undefined : (cardFormat || 'Poster'),
                items,
                queries: []
            };

            applySectionVisibilityToSection(section, wizardState, baseSection);

            const targetGroup = resolveGroupName(wizardState, wizardState._config);
            if (targetGroup) {
                section._targetGroupName = targetGroup;
            }

            if (renderMode === 'Spotlight' || renderMode === 'Random') {
                section.spotlightConfig = {
                    spotlightLayout: spotlightLayout || 'Border',
                    spotlightSize: spotlightSize || 'normal',
                    tileCount: Math.max(1, Math.min(3, parseInt(tileCount, 10) || 1)),
                    panAnimation: panAnimation !== false
                };
            }

            return section;
        }

        const queryOptions = {
            Limit: DEFAULT_SECTION_QUERY_LIMIT
        };

        if (includeItemTypes && includeItemTypes.length > 0) {
            queryOptions.IncludeItemTypes = includeItemTypes;
        }

        if (sortBy && sortBy !== 'Default') {
            queryOptions.SortBy = sortBy;
            queryOptions.SortOrder = sortOrder || 'Descending';
        }

        if (unwatchedOnly) {
            queryOptions.IsUnplayed = true;
        }

        if (parentType && parents.length > 0) {
            const meta = PARENT_TYPES.find(t => t.type === parentType);
            const field = meta?.queryField;
            switch (field) {
                case 'GenreIds':
                    queryOptions.GenreIds = parents.map(p => p.id);
                    break;
                case 'StudioIds':
                    queryOptions.StudioIds = parents.map(p => p.id);
                    break;
                case 'PersonIds':
                    queryOptions.PersonIds = parents.map(p => p.id);
                    break;
                case 'Tags':
                    queryOptions.Tags = parents.map(p => p.name);
                    break;
                case 'ParentId':
                    queryOptions.ParentId = parents[0].id;
                    break;
                default:
                    break;
            }
        }

        const section = {
            ...baseSection,
            id: baseSection.id,
            name: sectionName || (parents.length ? buildSectionName(parentType, parents) : baseSection.name),
            enabled: true,
            isCustom: true,
            renderMode: renderMode || 'Normal',
            cardFormat: renderMode === 'Spotlight' ? undefined : (cardFormat || 'Poster'),
            queries: [{ queryOptions }]
        };

        applySectionVisibilityToSection(section, wizardState, baseSection);

        if (section.type === 'discovery' && parentType && parentType !== 'Custom') {
            section.discoveryType = parentType;
        }

        const targetGroup = resolveGroupName(wizardState, wizardState._config);
        if (targetGroup) {
            section._targetGroupName = targetGroup;
        }

        if (renderMode === 'Spotlight' || renderMode === 'Random') {
            section.spotlightConfig = {
                spotlightLayout: spotlightLayout || 'Border',
                spotlightSize: spotlightSize || 'normal',
                tileCount: Math.max(1, Math.min(3, parseInt(tileCount, 10) || 1)),
                panAnimation: panAnimation !== false
            };
        }

        return section;
    }

    function renderModeSelectHTML() {
        return `
            <div class="hsse-flow">
                <p class="listItemBodyText secondary hsse-subtitle">Choose how you&apos;d like to get started</p>
                <div class="hsse-flow-body">
                    <div class="hsse-mode-grid">
                        <button type="button" class="hsse-mode-card hsse-wizard" data-hsse-action="select-wizard">
                            <div class="hsse-mode-card-header">
                                <div class="hsse-mode-icon">${renderMaterialIcon('auto_fix_high')}</div>
                                <span class="hsse-badge">Recommended</span>
                            </div>
                            <h2 class="listItemBodyText hsse-mode-title">Wizard</h2>
                            <p class="listItemBodyText secondary hsse-mode-desc">Build a section from a pre-existing template with the ability to customize the general appearance and settings.</p>
                            <ul class="hsse-tag-list">
                                <li class="listItemBodyText secondary">Streamlined</li>
                                <li class="listItemBodyText secondary">Limited Options</li>
                            </ul>
                            <span class="hsse-mode-action">Start Wizard →</span>
                        </button>
                        <button type="button" class="hsse-mode-card" data-hsse-action="select-advanced">
                            <div class="hsse-mode-card-header">
                                <div class="hsse-mode-icon">${renderMaterialIcon('tune')}</div>
                            </div>
                            <h2 class="listItemBodyText hsse-mode-title">Advanced</h2>
                            <p class="listItemBodyText secondary hsse-mode-desc">Use the advanced editor to build a section from scratch with complete control over queries, filters, display and cache options.</p>
                            <ul class="hsse-tag-list">
                                <li class="listItemBodyText secondary">Multi-Query</li>
                                <li class="listItemBodyText secondary">Advanced Options</li>
                            </ul>
                            <span class="hsse-mode-action">Open Editor →</span>
                        </button>
                    </div>
                </div>
            </div>
        `;
    }

    function renderSingleWizardStepHTML(step, i, wizardState) {
        const currentStep = wizardState.step;
        const maxReachedStepIndex = wizardState.maxReachedStepIndex;
        const currentIndex = getStepIndex(currentStep, wizardState);
        const isActive = step === currentStep;
        const isDone = i < currentIndex;
        const isClickable = i <= maxReachedStepIndex && !isActive;
        const classes = [
            'hsse-step',
            isActive ? 'hsse-active' : '',
            isDone ? 'hsse-done' : '',
            isClickable ? 'hsse-clickable' : ''
        ].filter(Boolean).join(' ');

        const inner = `
            <span class="hsse-step-num">${isDone ? '✓' : i + 1}</span>
            <span class="listItemBodyText${isActive ? '' : ' secondary'}">${WIZARD_STEP_LABELS[step]}</span>
        `;

        if (isClickable) {
            return `<button type="button" class="${classes}" data-hsse-action="wizard-navigate-step" data-step="${escapeHtml(step)}">${inner}</button>`;
        }
        return `<div class="${classes}">${inner}</div>`;
    }

    function renderWizardStepsHTML(wizardState) {
        const steps = getWizardSteps(wizardState);
        const parts = [];
        steps.forEach((step, i) => {
            if (i > 0) {
                parts.push('<span class="hsse-step-sep listItemBodyText secondary" aria-hidden="true">&gt;</span>');
            }
            parts.push(renderSingleWizardStepHTML(step, i, wizardState));
        });
        return parts.join('');
    }

    function buildCustomImageFieldHTML(index, field, value, options = {}) {
        const { isPoster = false } = options;
        const requiredMark = field.required ? ' <span class="hsse-required-mark">*</span>' : '';
        const posterHint = isPoster
            ? `<p class="listItemBodyText secondary hsse-field-hint hsse-custom-image-field-hint">You can place images in your &quot;Jellyfin\\Server\\jellyfin-web&quot; folder and use the &quot;/web/image_name.png&quot; path to access them.</p>`
            : '';
        return `
            <div class="hsse-field hsse-custom-image-field${isPoster ? '' : ' hsse-custom-image-field-compact'}">
                <label class="listItemBodyText hsse-section-label hsse-custom-field-label" for="hsse-custom-${index}-${field.key}">${escapeHtml(field.label)}${requiredMark}</label>
                <input type="url" id="hsse-custom-${index}-${field.key}" class="fld emby-input hsse-custom-image-input" value="${escapeHtml(value)}" placeholder="https://..." aria-label="${escapeHtml(field.label)}"${isPoster ? ' data-hsse-custom-preview="true"' : ''}>
                ${posterHint}
            </div>
        `;
    }

    function renderCustomItemEditorHTML(index, item, wizardState) {
        const additionalExpanded = isCustomItemAdditionalExpanded(wizardState, index, item);
        const posterInputId = `hsse-custom-${index}-posterUrl`;

        return `
            <div class="hsse-custom-item-main">
                <div class="hsse-custom-item-fields">
                    <div class="hsse-field hsse-custom-field">
                        <label class="listItemBodyText hsse-section-label hsse-custom-field-label" for="hsse-custom-${index}-name">Name <span class="hsse-required-mark">*</span></label>
                        <input type="text" id="hsse-custom-${index}-name" class="fld emby-input" value="${escapeHtml(item.name)}" placeholder="Item name" aria-label="Item name">
                    </div>
                    <div class="hsse-field hsse-custom-field">
                        <label class="listItemBodyText hsse-section-label hsse-custom-field-label" for="hsse-custom-${index}-cardFooter">Card Footer</label>
                        <input type="text" id="hsse-custom-${index}-cardFooter" class="fld emby-input" value="${escapeHtml(item.cardFooter || '')}" placeholder="Optional footer text" aria-label="Card footer">
                    </div>
                    <div class="hsse-field hsse-custom-field">
                        <label class="listItemBodyText hsse-section-label hsse-custom-field-label" for="hsse-custom-${index}-cardUrl">Link URL</label>
                        <input type="url" id="hsse-custom-${index}-cardUrl" class="fld emby-input" value="${escapeHtml(item.cardUrl)}" placeholder="#/movies.html or https://..." aria-label="Link URL" title="Jellyfin hash routes or full external URLs">
                    </div>
                    ${buildCustomImageFieldHTML(index, CUSTOM_POSTER_FIELD, item.posterUrl || '', { isPoster: true })}
                </div>
                <div class="hsse-custom-item-preview-col" aria-hidden="true">
                    <div class="hsse-image-preview hsse-item-main-preview">
                        <img class="hsse-image-preview-img" alt="" data-preview-for="${posterInputId}">
                    </div>
                </div>
            </div>
            <div class="hsse-custom-image-toggle-wrap">
                <button type="button" class="emby-button raised hsse-custom-image-toggle" data-hsse-action="wizard-toggle-custom-images" data-item-index="${index}" aria-expanded="${additionalExpanded ? 'true' : 'false'}">
                    ${additionalExpanded ? 'Hide Additional Image Types' : 'Configure Additional Image Types'}
                </button>
            </div>
            <div class="hsse-field-grid hsse-custom-image-grid hsse-custom-image-additional${additionalExpanded ? '' : ' hsse-collapsed'}"${additionalExpanded ? '' : ' hidden'}>
                ${CUSTOM_ADDITIONAL_IMAGE_FIELDS.map(field => buildCustomImageFieldHTML(index, field, item[field.key] || '')).join('')}
            </div>
        `;
    }

    function renderCustomItemTileHTML(index, item, canRemove) {
        const label = item.name?.trim() || `Item ${index + 1}`;
        return `
            <div class="hsse-custom-item-tile" data-custom-item-index="${index}">
                <button type="button" class="hsse-custom-item-tile-image hsse-image-preview hsse-item-tile-preview" data-hsse-action="wizard-open-custom-item-editor" data-item-index="${index}" aria-label="Edit ${escapeHtml(label)}">
                    <img class="hsse-image-preview-img" alt="" data-tile-index="${index}">
                    <span class="hsse-custom-item-edit-badge">${renderMaterialIcon('edit')}</span>
                </button>
                <div class="listItemBodyText hsse-custom-item-tile-label">${escapeHtml(label)}</div>
                <button type="button" class="emby-button raised hsse-custom-item-trash" data-hsse-action="wizard-remove-custom-item" data-item-index="${index}"${canRemove ? '' : ' disabled'} aria-label="Remove ${escapeHtml(label)}">
                    ${renderMaterialIcon('delete', 'hsse-custom-item-trash-icon')}
                </button>
            </div>
        `;
    }

    function renderCustomItemEditorPanelHTML(wizardState) {
        const editorIndex = wizardState.customItemEditorIndex;
        if (editorIndex == null || Number.isNaN(editorIndex)) return '';
        const item = wizardState.customItems?.[editorIndex];
        if (!item) return '';

        const title = item.name?.trim()
            ? `Edit: ${item.name.trim()}`
            : `Edit Item ${editorIndex + 1}`;

        return `
            <div class="hsse-custom-item-editor-overlay">
                <button type="button" class="hsse-custom-item-editor-backdrop" data-hsse-action="wizard-close-custom-item-editor" aria-label="Close editor"></button>
                <div class="hsse-custom-item-editor-panel" role="dialog" aria-modal="true" aria-label="${escapeHtml(title)}">
                    <div class="hsse-custom-item-editor-header">
                        <div class="listItemBodyText hsse-custom-item-editor-title">${escapeHtml(title)}</div>
                    </div>
                    <div class="hsse-custom-item-editor-body">
                        ${renderCustomItemEditorHTML(editorIndex, item, wizardState)}
                    </div>
                    <div class="hsse-custom-item-editor-footer">
                        <button type="button" class="emby-button raised" data-hsse-action="wizard-close-custom-item-editor" data-discard="true">Cancel</button>
                        <button type="button" class="emby-button raised button-submit" data-hsse-action="wizard-close-custom-item-editor">Done</button>
                    </div>
                </div>
            </div>
        `;
    }

    function renderCustomItemsHTML(wizardState) {
        const shared = window.KefinHomeScreenCustomItemsEditor;
        if (shared) {
            return shared.renderCustomItemsHTML(wizardState, getWizardCustomItemsOptions());
        }
        ensureCustomItemsInitialized(wizardState);
        const items = wizardState.customItems;
        const canRemove = items.length > 1;

        return `
            <div class="hsse-custom-items-stage">
                <div class="hsse-section-block hsse-custom-items-intro">
                    <div class="listItemBodyText hsse-section-label">Custom Items</div>
                    <p class="listItemBodyText secondary hsse-field-hint">Name and poster required. Link and other images optional.</p>
                </div>
                <div class="hsse-custom-items-grid">
                    ${items.map((item, index) => renderCustomItemTileHTML(index, item, canRemove)).join('')}
                    <button type="button" class="hsse-custom-item-add-tile" data-hsse-action="wizard-add-custom-item" aria-label="Add item">
                        ${renderMaterialIcon('add', 'hsse-custom-item-add-icon')}
                    </button>
                </div>
                ${renderCustomItemEditorPanelHTML(wizardState)}
            </div>
        `;
    }

    function renderWizardBodyHTML(wizardState, config) {
        const step = wizardState.step;

        if (step === 'type') {
            return `
                <div class="hsse-type-grid">
                    ${PARENT_TYPES.map(t => `
                        <button type="button" class="hsse-type-card${wizardState.parentType === t.type ? ' hsse-active' : ''}" data-hsse-action="wizard-select-type" data-type="${escapeHtml(t.type)}">
                            ${renderMaterialIcon(t.icon, 'hsse-type-icon')}
                            <div>
                                <div class="listItemBodyText hsse-type-label">${escapeHtml(t.label)}</div>
                                <div class="listItemBodyText secondary hsse-type-desc">${escapeHtml(t.description)}</div>
                            </div>
                        </button>
                    `).join('')}
                    <button type="button" class="hsse-type-card hsse-type-card-span${wizardState.parentType === 'Custom' ? ' hsse-active' : ''}" data-hsse-action="wizard-select-type" data-type="Custom">
                        ${renderMaterialIcon(CUSTOM_TYPE.icon, 'hsse-type-icon')}
                        <div>
                            <div class="listItemBodyText hsse-type-label">${escapeHtml(CUSTOM_TYPE.label)}</div>
                            <div class="listItemBodyText secondary hsse-type-desc">${escapeHtml(CUSTOM_TYPE.description)}</div>
                        </div>
                    </button>
                </div>
            `;
        }

        if (step === 'customItems') {
            return renderCustomItemsHTML(wizardState);
        }

        if (step === 'parent') {
            const meta = PARENT_TYPES.find(t => t.type === wizardState.parentType);

            return `
                <div class="hsse-section-block">
                    <input type="text" id="hsse-parent-search" class="fld emby-input" value="${escapeHtml(wizardState.search)}" placeholder="Search..." aria-label="Search ${escapeHtml(meta?.plural || 'items')}">
                </div>
                <div class="hsse-parent-list" id="hsse-parent-list">
                    ${renderParentListHTML(wizardState)}
                </div>
            `;
        }

        if (step === 'query') {
            return `
                <div class="hsse-section-block">
                    <div class="listItemBodyText hsse-section-label">Included Item Types</div>
                    <p id="hsse-item-types-hint" class="listItemBodyText secondary hsse-field-hint">${escapeHtml(getIncludedItemTypesHintText(wizardState.includeItemTypes))}</p>
                    <div class="hsse-chip-row">
                        ${ITEM_TYPE_OPTIONS.map(type => {
                            const active = wizardState.includeItemTypes.includes(type);
                            return `<button type="button" class="kefin-chip hsse-chip listItemBodyText${active ? ' hsse-active' : ''}" data-hsse-action="wizard-toggle-item-type" data-item-type="${escapeHtml(type)}">${escapeHtml(humanizeLabel(type))}</button>`;
                        }).join('')}
                    </div>
                </div>
                <div class="hsse-section-block">
                    <div class="hsse-field-grid">
                        ${hsseBuildSelect('hsse-wizard-sortBy', getSortOrders(), wizardState.sortBy, 'Sort by')}
                        ${hsseBuildSelect('hsse-wizard-sortOrder', getSortOrderDirections(), wizardState.sortOrder, 'Sort order')}
                    </div>
                </div>
                ${hsseBuildToggleSlider('hsse-wizard-unwatched', wizardState.unwatchedOnly, 'Hide Watched Items')}
            `;
        }

        if (step === 'appearance') {
            const modes = [
                { value: 'Normal', title: 'Normal', desc: 'Matches the default Jellyfin horizontal row of cards.' },
                { value: 'Spotlight', title: 'Spotlight', desc: 'A customizable, full-width, featured slideshow carousel.' },
                { value: 'Random', title: 'Random', desc: 'A random layout will be used when the section is loaded.' }
            ];
            return `
                <div class="hsse-section-block">
                    <div class="listItemBodyText hsse-section-label">Appearance</div>
                    <div class="hsse-appearance-grid">
                        ${modes.map(m => `
                            <button type="button" class="hsse-appearance-card${wizardState.renderMode === m.value ? ' hsse-active' : ''}" data-hsse-action="wizard-set-render-mode" data-render-mode="${escapeHtml(m.value)}">
                                <div class="listItemBodyText hsse-appearance-title">${escapeHtml(m.title)}</div>
                                <div class="listItemBodyText secondary hsse-appearance-desc">${escapeHtml(m.desc)}</div>
                            </button>
                        `).join('')}
                    </div>
                </div>
                ${wizardState.renderMode === 'Normal' ? `
                    <div class="hsse-section-block">
                        <div class="listItemBodyText hsse-section-label">Card format</div>
                        <div class="hsse-card-format-grid">
                            ${getCardFormats().map(fmt => `
                                <button type="button" class="hsse-card-format-btn${wizardState.cardFormat === fmt ? ' hsse-active' : ''}" data-hsse-action="wizard-set-card-format" data-card-format="${escapeHtml(fmt)}"><span class="listItemBodyText">${escapeHtml(fmt)}</span></button>
                            `).join('')}
                        </div>
                    </div>
                ` : ''}
                ${wizardState.renderMode === 'Spotlight' ? `
                    <div class="hsse-section-block">
                        <div class="hsse-spotlight-options-grid">
                            ${hsseBuildSelect('hsse-wizard-spotlightLayout', getSpotlightLayoutOptions(), wizardState.spotlightLayout, 'Spotlight Layout')}
                            ${hsseBuildSelect('hsse-wizard-spotlightSize', getSpotlightSizeOptions(), wizardState.spotlightSize, 'Spotlight Size')}
                            ${hsseBuildSelect('hsse-wizard-tileCount', getSpotlightTileCountOptions(), wizardState.tileCount, 'Tiled Backdrop Count', 'Set the number of backdrops that will be tiled next to each other in a single slide of the Spotlight.')}
                        </div>
                    </div>
                    ${hsseBuildToggleSlider('hsse-wizard-animated', wizardState.panAnimation, 'Animated Slides')}
                ` : ''}
                ${renderAppearancePreviewHTML()}
            `;
        }

        if (step === 'settings') {
            return `
                ${hsseBuildTextInput('hsse-wizard-sectionName', wizardState.sectionName, 'Section Name')}
                ${buildSectionGroupHTML(config, wizardState)}
                ${renderSectionVisibilityHTML(wizardState)}
            `;
        }

        if (step === 'confirm') {
            return renderConfirmOverview(wizardState, config);
        }

        return '';
    }

    function renderWizardHTML(wizardState, config) {
        return `
            <div class="hsse-flow">
                <div class="hsse-steps">${renderWizardStepsHTML(wizardState)}</div>
                <div class="hsse-flow-body">${renderWizardBodyHTML(wizardState, config)}</div>
            </div>
        `;
    }

    function getModalTitle(stage, wizardState) {
        if (stage === 'mode' || stage === 'advanced') return 'Create a Section';
        if (stage === 'wizard') {
            if (wizardState.step === 'confirm') return 'Review Section';
            if (wizardState.step === 'parent' && wizardState.parentType) {
                const meta = PARENT_TYPES.find(t => t.type === wizardState.parentType);
                return `Choose a ${meta?.label?.toLowerCase() || 'item'}`;
            }
            if (wizardState.step === 'customItems') return 'Create Items';
            return 'Create a Home Screen Section';
        }
        return 'Create a Section';
    }

    function getFooterHintText(wizardState) {
        if (wizardState.step === 'type') {
            return 'Select a type to continue';
        }
        if (wizardState.step === 'parent' && !isMultiSelectType(wizardState.parentType)) {
            const meta = PARENT_TYPES.find(t => t.type === wizardState.parentType);
            const label = (meta?.label || 'item').toLowerCase();
            return `Select a ${label} to continue`;
        }
        return '';
    }

    function buildWizardFooterHTML(wizardState) {
        const step = wizardState.step;
        const parentUsesContinue = step === 'parent' && isMultiSelectType(wizardState.parentType);

        let endContent = '';
        if (step === 'type' || (step === 'parent' && !parentUsesContinue)) {
            endContent = `<span class="listItemBodyText secondary hsse-footer-hint">${escapeHtml(getFooterHintText(wizardState))}</span>`;
        } else if (step === 'confirm') {
            endContent = `<button type="button" class="emby-button raised button-submit" data-hsse-action="wizard-finish">Create Section</button>`;
        } else {
            endContent = `<button type="button" class="emby-button raised button-submit" data-hsse-action="wizard-continue">Continue</button>`;
        }

        const backLabel = step === 'type' ? 'Back to start' : 'Back';

        return `
            <div class="hsse-footer">
                <button type="button" class="hsse-footer-back" data-hsse-action="wizard-back" title="${escapeHtml(backLabel)}" aria-label="${escapeHtml(backLabel)}">${renderMaterialIcon('arrow_back')}</button>
                <div class="hsse-footer-end">${endContent}</div>
            </div>
        `;
    }

    function buildAdvancedCreateFooterHTML(sectionType = 'custom') {
        return `
            <div class="hsse-footer">
                <button type="button" class="hsse-footer-back" data-hsse-action="advanced-back" title="Back to start" aria-label="Back to start">${renderMaterialIcon('arrow_back')}</button>
                <div class="hsse-footer-end">
                    <button type="button" class="emby-button raised section-preview-btn" data-section-type="${escapeHtml(sectionType)}" style="background: rgba(0, 164, 220, 0.2);">Preview</button>
                    <button type="button" class="emby-button raised button-submit section-save-btn" data-section-type="${escapeHtml(sectionType)}">Create Section</button>
                </div>
            </div>
        `;
    }

    function getFooterHTML(stage, wizardState, options = {}) {
        if (stage === 'mode') {
            return `<button type="button" class="emby-button raised" data-hsse-action="cancel">Cancel</button>`;
        }

        if (stage === 'wizard') {
            return buildWizardFooterHTML(wizardState);
        }

        if (stage === 'advanced') {
            return buildAdvancedCreateFooterHTML(options.sectionType || 'custom');
        }

        return '';
    }

    function attachToggleHandlers(root) {
        if (root.dataset.hsseToggleHandlersAttached === 'true') return;
        root.dataset.hsseToggleHandlersAttached = 'true';

        root.addEventListener('click', (e) => {
            const btn = e.target.closest('.toggle-slider');
            if (!btn || !root.contains(btn)) return;
            const checkboxId = btn.dataset.checkboxId;
            if (!checkboxId) return;
            e.preventDefault();
            e.stopPropagation();
            const checkbox = document.getElementById(checkboxId);
            if (checkbox && root.contains(checkbox)) {
                checkbox.checked = !checkbox.checked;
                checkbox.dispatchEvent(new Event('change', { bubbles: true }));
                updateToggleSliderUI(btn, checkbox.checked);
            }
        });

        root.addEventListener('change', (e) => {
            const checkbox = e.target;
            if (!checkbox.matches('input[type="checkbox"][data-hsse-toggle]') || !root.contains(checkbox)) return;
            const btn = root.querySelector(`.toggle-slider[data-checkbox-id="${checkbox.id}"]`);
            if (btn) updateToggleSliderUI(btn, checkbox.checked);
        });
    }

    /**
     * Open the create flow (mode select or wizard) for new custom sections.
     * @param {Object} section - Base section (new section stub)
     * @param {Object} options
     * @param {Function} options.onOpenAdvanced - Opens legacy advanced editor with section draft
     * @param {Function} options.onSaveWizardSection - Saves wizard-created section via JS Injector
     */
    // --- Migrated section edit modal (from homeScreen-configuration.js) ---

    const WARN = (...args) => console.warn('[KefinTweaks Section Editor]', ...args);
    const ERR = (...args) => console.error('[KefinTweaks Section Editor]', ...args);

    const SECTION_EDITOR_MODAL_ID = 'kefin-homescreen-section-editor';
    const DISCOVERY_EDITOR_MODAL_ID = 'kefin-homescreen-discovery-editor';

    // Supported additional query options (matching configuration.js)
    const SUPPORTED_QUERY_OPTIONS = {
        Ids: { label: 'Item IDs', type: 'array', hint: 'Comma-separated GUIDs' },
        ParentId: { label: 'Parent ID', type: 'string', hint: 'GUID of parent item' },
        ExcludeItemIds: { label: 'Exclude Item IDs', type: 'array', hint: 'Comma-separated GUIDs' },
        GenreIds: { label: 'Genre IDs', type: 'array', hint: 'Comma-separated GUIDs' },
        Person: { label: 'Person', type: 'string', hint: 'Person name' },
        PersonIds: { label: 'Person IDs', type: 'array', hint: 'Comma-separated GUIDs' },
        PersonTypes: { label: 'Person Types', type: 'array', hint: 'Actor, Director, Writer, etc.' },
        ExcludePersonTypes: { label: 'Exclude Person Types', type: 'array', hint: 'Actor, Director, Writer, etc.' },
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
        EnableRewatching: { label: 'Enable Rewatching', type: 'boolean' },
        EnableUserData: { label: 'Enable User Data', type: 'boolean' }
    };

    const CARD_FORMATS = ['Poster', 'Thumb', 'Backdrop', 'Square', 'Random', 'Button', 'Banner', 'Logo', 'Clear Art', 'Disc', 'Series Thumb', 'Series Poster'];
    const BADGE_FIELD_DESCRIPTIONS = {
        IncludeItemTypes: 'Limit results to these item types.',
        Genres: 'Filter results to items matching these genres.',
        Tags: 'Filter results to items with these tags.',
        Collections: 'Limit results to items in these collections.',
        Playlists: 'Limit results to items in these playlists.'
    };
    const SORT_ORDERS = ['Default', 'Random', 'Name', 'SortName', 'DateCreated', 'PremiereDate', 'CommunityRating', 'CriticRating', 'DatePlayed', 'SortName', 'PlayCount', 'PlayedPercentage', 'StartDate', 'Runtime', 'ProductionYear', 'IsPlayed', 'IsUnplayed', 'ParentIndexNumber', 'IndexNumber', 'IsFolder', 'SimilarityScore', 'SearchScore', 'DateLastContentAdded', 'SeriesDatePlayed', 'ChildCount'];
    const SORT_ORDER_DIRECTIONS = ['Ascending', 'Descending'];
    const RENDER_MODE_OPTIONS = [{ value: 'Normal', label: 'Normal' }, { value: 'Spotlight', label: 'Spotlight' }, { value: 'Random', label: 'Random' }];
    const SLIDE_STATE_OPTIONS = [
        { value: 'none', label: 'None' },
        { value: 'dots', label: 'Dots' },
        { value: 'numeric', label: 'Numeric' }
    ];

    const SPOTLIGHT_LAYOUT_OPTIONS = [
        { value: 'Border', label: 'Border' },
        { value: 'Borderless', label: 'Borderless' }
    ];
    const SPOTLIGHT_SIZE_OPTIONS = [
        { value: 'normal', label: 'Normal' },
        { value: 'large', label: 'Large' },
        { value: 'full', label: 'Full' }
    ];
    const SPOTLIGHT_TILE_COUNT_OPTIONS = [
        { value: '1', label: '1' },
        { value: '2', label: '2' },
        { value: '3', label: '3' }
    ];
    const SPOTLIGHT_ENTRANCE_OPTIONS = [
        { value: 'fadeIn', label: 'Fade in' },
        { value: 'fadeInUp', label: 'Fade in up' },
        { value: 'fadeInDown', label: 'Fade in down' }
    ];
    const SPOTLIGHT_SLIDE_OPTIONS = [
        { value: 'kenBurnsZoomIn', label: 'Ken Burns zoom in' },
        { value: 'kenBurnsZoomOut', label: 'Ken Burns zoom out' },
        { value: 'kenBurnsZoomInFullscreen', label: 'Ken Burns zoom in (fullscreen)' },
        { value: 'kenBurnsZoomOutFullscreen', label: 'Ken Burns zoom out (fullscreen)' },
        { value: 'kenBurnsPanRight', label: 'Ken Burns pan right' },
        { value: 'kenBurnsPanLeft', label: 'Ken Burns pan left' },
        { value: 'kenBurnsPanUp', label: 'Ken Burns pan up' },
        { value: 'kenBurnsDiagonal', label: 'Ken Burns diagonal' },
        { value: 'fadeInScale', label: 'Fade in scale' },
        { value: 'parallaxFloat', label: 'Parallax float' },
        { value: 'depthPulse', label: 'Depth pulse' },
        { value: 'slowRotate', label: 'Slow rotate' },
        { value: 'breathe', label: 'Breathe' },
        { value: 'heatHaze', label: 'Heat haze' },
        { value: 'colorWash', label: 'Color wash' },
        { value: 'vignetteIn', label: 'Vignette in' }
    ];

    let activeEditCtx = null;
    function getActiveConfig() { return activeEditCtx?.config || null; }

    function sectionEditorShowToast(message, duration = '3') {
        if (window.KefinTweaksToaster?.toast) {
            window.KefinTweaksToaster.toast(message, duration);
        } else {
            alert(message);
        }
    }

    function findSectionInGroupsForEditor(groups, sectionId) {
        if (!Array.isArray(groups)) return null;
        for (let groupIndex = 0; groupIndex < groups.length; groupIndex++) {
            const group = groups[groupIndex];
            if (group?.sections) {
                const sectionIndex = group.sections.findIndex(s => s.id === sectionId);
                if (sectionIndex !== -1) {
                    return { section: group.sections[sectionIndex], group, groupIndex, sectionIndex };
                }
            }
        }
        return null;
    }

    function buildCheckbox(id, checked, label) {
        return window.KefinTweaksUI.buildCheckbox(id, checked, label);
    }

    function buildSelect(id, options, selectedValue, label) {
        return window.KefinTweaksUI.buildSelect(id, options, selectedValue, label);
    }

    function buildTextInput(id, value, label, type = 'text', placeholder = '') {
        return window.KefinTweaksUI.buildTextInput(id, value, label, type, placeholder);
    }

    function buildToggleCard(id, checked, label, description, options = {}) {
        return window.KefinTweaksUI.buildToggleCard(id, checked, label, description, options);
    }

    function updateToggleSwitchUI(btn, checked) {
        return window.KefinTweaksUI.updateToggleSwitchUI(btn, checked);
    }

    function buildEnabledToggleButtons(id, enabled) {
        return window.KefinTweaksUI.buildEnabledToggleButtons(id, enabled);
    }

    function buildToggleSlider(id, checked, label, options = {}) {
        return window.KefinTweaksUI.buildToggleSlider(id, checked, label, options);
    }

    function updateToggleSliderUI(toggleButton, isEnabled) {
        return window.KefinTweaksUI.updateToggleSliderUI(toggleButton, isEnabled);
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
     * Resolve backdrops count from spotlight config (migrates legacy cycleBackdropsTime).
     */
    function resolveSpotlightBackdropsCount(spotlightOpts = {}) {
        if (spotlightOpts.backdropsCount != null) {
            return Math.max(1, parseInt(spotlightOpts.backdropsCount, 10) || 1);
        }
        if (spotlightOpts.cycleBackdropsTime > 0 && spotlightOpts.interval > 0) {
            return Math.max(1, Math.round(spotlightOpts.interval / spotlightOpts.cycleBackdropsTime));
        }
        return 1;
    }

    const SPOTLIGHT_TOGGLE_DESCRIPTIONS = {
        panAnimation: 'Apply pan and zoom animations to each slide.',
        showNavButtons: 'Show previous and next navigation buttons on the carousel.',
        showClearArt: 'Display clear art logo overlay when available.',
        cycleBackdrops: 'Cycle through multiple backdrop images per slide.',
        autoPlay: 'Automatically advance slides after the timer interval.'
    };

    /**
     * Collect spotlightConfig from dialog fields.
     */
    function collectSpotlightConfigFromDialog(dialog, idPrefix, options = {}) {
        const useIntervalSeconds = options.useIntervalSeconds === true;
        const slideStateVal = dialog.querySelector('#' + idPrefix + 'slideState')?.value || 'dots';
        const tileCountVal = Math.max(1, Math.min(3, parseInt(dialog.querySelector('#' + idPrefix + 'tileCount')?.value || '1', 10)));
        const intervalRaw = dialog.querySelector('#' + idPrefix + 'interval')?.value;
        const intervalMs = useIntervalSeconds
            ? Math.round((parseFloat(intervalRaw || '10') || 10) * 1000)
            : parseInt(intervalRaw || '10000', 10);

        return {
            spotlightLayout: dialog.querySelector('#' + idPrefix + 'spotlightLayout')?.value || 'Border',
            spotlightSize: dialog.querySelector('#' + idPrefix + 'spotlightSize')?.value || 'normal',
            tileCount: tileCountVal,
            autoPlay: dialog.querySelector('#' + idPrefix + 'autoPlay')?.checked !== false,
            interval: intervalMs,
            showSlideState: slideStateVal !== 'none',
            showDots: slideStateVal === 'dots',
            showNavButtons: dialog.querySelector('#' + idPrefix + 'showNavButtons')?.checked !== false,
            showClearArt: dialog.querySelector('#' + idPrefix + 'showClearArt')?.checked === true,
            panAnimation: dialog.querySelector('#' + idPrefix + 'panAnimation')?.checked !== false,
            entranceAnimationFirst: dialog.querySelector('#' + idPrefix + 'entranceAnimationFirst')?.value || 'fadeIn',
            entranceAnimationSecond: dialog.querySelector('#' + idPrefix + 'entranceAnimationSecond')?.value || 'fadeIn',
            entranceAnimationThird: dialog.querySelector('#' + idPrefix + 'entranceAnimationThird')?.value || 'fadeIn',
            slideAnimationFirst: dialog.querySelector('#' + idPrefix + 'slideAnimationFirst')?.value || 'kenBurnsZoomIn',
            slideAnimationSecond: dialog.querySelector('#' + idPrefix + 'slideAnimationSecond')?.value || 'kenBurnsZoomIn',
            slideAnimationThird: dialog.querySelector('#' + idPrefix + 'slideAnimationThird')?.value || 'kenBurnsZoomIn',
            cycleBackdrops: dialog.querySelector('#' + idPrefix + 'cycleBackdrops')?.checked === true,
            backdropsCount: Math.max(1, parseInt(dialog.querySelector('#' + idPrefix + 'backdropsCount')?.value || '1', 10))
        };
    }

    /**
     * Shared spotlight settings fields HTML (advanced-editor layout).
     */
    function buildSharedSpotlightFieldsHTML(spotlightOpts, idPrefix, options = {}) {
        const useIntervalSeconds = options.useIntervalSeconds === true;
        const spotlightLayout = spotlightOpts.spotlightLayout ?? (spotlightOpts.fullScreen === true ? 'Borderless' : 'Border');
        const spotlightSize = spotlightOpts.spotlightSize ?? (spotlightOpts.fullScreen === true ? 'full' : 'normal');
        const tileCount = Math.max(1, Math.min(3, parseInt(
            spotlightOpts.tileCount ?? (spotlightSize === 'full' ? 1 : spotlightSize === 'large' ? 2 : 3),
            10
        ) || 1));
        const tileCountStr = String(tileCount);
        const slideStateVal = spotlightOpts.showSlideState === false ? 'none' : (spotlightOpts.showDots === false ? 'numeric' : 'dots');
        const intervalValue = useIntervalSeconds
            ? Math.round((spotlightOpts.interval ?? 10000) / 1000)
            : (spotlightOpts.interval ?? 10000);
        const intervalLabel = useIntervalSeconds ? 'Slide Timer (seconds)' : 'Auto-play interval (ms)';
        const cycleBackdropsOn = spotlightOpts.cycleBackdrops === true;
        const rawBackdropsCount = spotlightOpts.backdropsCount ?? resolveSpotlightBackdropsCount(spotlightOpts);
        const backdropsCount = cycleBackdropsOn
            ? Math.max(2, parseInt(rawBackdropsCount, 10) || 2)
            : Math.max(1, parseInt(rawBackdropsCount, 10) || 1);
        const animateSlides = spotlightOpts.panAnimation !== false;

        function animRow(n) {
            const ord = n === 1 ? 'First' : n === 2 ? 'Second' : 'Third';
            return `
                <div class="hsae-field-grid hsae-field-grid-2 hsae-spotlight-anim-pair">
                    ${buildSelect(idPrefix + 'entranceAnimation' + ord, SPOTLIGHT_ENTRANCE_OPTIONS, spotlightOpts['entranceAnimation' + ord] ?? 'fadeIn', 'Entrance animation ' + n)}
                    ${buildSelect(idPrefix + 'slideAnimation' + ord, SPOTLIGHT_SLIDE_OPTIONS, spotlightOpts['slideAnimation' + ord] ?? 'kenBurnsZoomIn', 'Slide animation ' + n)}
                </div>`;
        }

        function spotlightToggle(key, checked, label) {
            return buildToggleCard(idPrefix + key, checked, label, SPOTLIGHT_TOGGLE_DESCRIPTIONS[key] || '');
        }

        return `
            <div class="hsae-spotlight-inner">
                <div class="hsae-field-grid hsae-field-grid-4 hsae-spotlight-row-1">
                    ${buildSelect(idPrefix + 'spotlightLayout', SPOTLIGHT_LAYOUT_OPTIONS, spotlightLayout, 'Layout')}
                    ${buildSelect(idPrefix + 'spotlightSize', SPOTLIGHT_SIZE_OPTIONS, spotlightSize, 'Size')}
                    ${buildSelect(idPrefix + 'tileCount', SPOTLIGHT_TILE_COUNT_OPTIONS, tileCountStr, 'Tiled Backdrops')}
                    ${buildSelect(idPrefix + 'slideState', SLIDE_STATE_OPTIONS, slideStateVal, 'Slide State')}
                </div>
                <div class="hsae-toggle-card-grid hsae-spotlight-row-2">
                    ${spotlightToggle('panAnimation', animateSlides, 'Animate Slides')}
                    ${spotlightToggle('showNavButtons', spotlightOpts.showNavButtons !== false, 'Show Controls')}
                    ${spotlightToggle('showClearArt', spotlightOpts.showClearArt === true, 'Show Clear Art')}
                    ${spotlightToggle('cycleBackdrops', cycleBackdropsOn, 'Cycle Backdrops')}
                </div>
                <div id="${idPrefix}backdrops-row" class="hsae-spotlight-backdrops-row" style="display:${cycleBackdropsOn ? 'block' : 'none'};">
                    ${buildTextInput(idPrefix + 'backdropsCount', backdropsCount, 'Backdrops Count', 'number')}
                </div>
                <div id="${idPrefix}animation-divider" class="hsae-query-divider" role="separator" aria-hidden="true" style="display:${animateSlides ? 'block' : 'none'};"></div>
                <div id="${idPrefix}animation-dropdowns" class="hsae-spotlight-animations hsae-spotlight-animations--${tileCount}" style="display:${animateSlides ? 'grid' : 'none'};">
                    <div id="${idPrefix}anim-first" class="hsae-spotlight-anim-group">${animRow(1)}</div>
                    <div id="${idPrefix}anim-second" class="hsae-spotlight-anim-group" style="display:${tileCount >= 2 ? 'block' : 'none'};">${animRow(2)}</div>
                    <div id="${idPrefix}anim-third" class="hsae-spotlight-anim-group" style="display:${tileCount >= 3 ? 'block' : 'none'};">${animRow(3)}</div>
                </div>
                <div class="hsae-field-grid hsae-field-grid-2 hsae-spotlight-row-autoplay">
                    ${spotlightToggle('autoPlay', spotlightOpts.autoPlay !== false, 'Cycle Slides Automatically')}
                    ${buildTextInput(idPrefix + 'interval', intervalValue, intervalLabel, 'number')}
                </div>
            </div>
        `;
    }

    /**
     * Build spotlight settings HTML for a section editor (custom or discovery).
     * Shown only when Render Mode is Spotlight; call from buildSectionEditorHTML when the editor includes render mode.
     * @param {Object} section - Section or discovery config (for spotlightConfig / defaults)
     * @param {string} idPrefix - Input id prefix, e.g. 'section-' or 'discovery-'
     * @param {boolean} isSpotlight - Initial visibility (true = show)
     * @returns {string} HTML for the spotlight options container
     */
    function buildSectionEditorSpotlightHTML(section, idPrefix, isSpotlight) {
        const globalSpotlight = getActiveConfig()?.SPOTLIGHT_SETTINGS || {};
        const spotlightDefaults = window.KefinHomeConfig2?.SPOTLIGHT_SETTINGS || {};
        const sectionSpotlight = section.spotlightConfig || {};
        const spotlightOpts = { ...spotlightDefaults, ...globalSpotlight, ...sectionSpotlight };
        const containerId = idPrefix + 'spotlight-options-container';
        const fieldPrefix = idPrefix + 'spotlight-';
        return `
                <div id="${containerId}" class="hsae-spotlight-legacy-wrap" style="border: 1px solid rgba(255,255,255,0.1); border-radius: 4px; padding: 0.75em; margin-bottom: 1em; display: ${isSpotlight ? 'block' : 'none'};">
                    <div class="listItemBodyText" style="font-weight: 500; margin-bottom: 0.75em;">Spotlight Options</div>
                    ${buildSharedSpotlightFieldsHTML(spotlightOpts, fieldPrefix, { useIntervalSeconds: true })}
                </div>
        `;
    }

    /**
     * Attach event listeners for spotlight settings (Size -> tileCount, tileCount -> cycle row + animation dropdown visibility).
     * @param {HTMLElement} container - Container that has the spotlight form (e.g. #global-settings-content or spotlight options div)
     * @param {string} idPrefix - Prefix for input ids, e.g. 'spotlight-' or 'section-spotlight-' or 'discovery-spotlight-'
     */
    function attachSpotlightSettingsListeners(container, idPrefix) {
        if (!container) return;
        window.KefinTweaksUI?.bindToggleCards?.(container);

        const sizeSelect = container.querySelector('#' + idPrefix + 'spotlightSize');
        const tileCountSelect = container.querySelector('#' + idPrefix + 'tileCount');
        const panAnimation = container.querySelector('#' + idPrefix + 'panAnimation');
        const animDropdowns = container.querySelector('#' + idPrefix + 'animation-dropdowns');
        const animDivider = container.querySelector('#' + idPrefix + 'animation-divider');
        const animSecond = container.querySelector('#' + idPrefix + 'anim-second');
        const animThird = container.querySelector('#' + idPrefix + 'anim-third');
        const cycleBackdrops = container.querySelector('#' + idPrefix + 'cycleBackdrops');
        const backdropsRow = container.querySelector('#' + idPrefix + 'backdrops-row');
        const backdropsCountInput = container.querySelector('#' + idPrefix + 'backdropsCount');

        function updateFromTileCount(tc) {
            const t = parseInt(tc, 10) || 1;
            if (animSecond) animSecond.style.display = t >= 2 ? 'block' : 'none';
            if (animThird) animThird.style.display = t >= 3 ? 'block' : 'none';
            if (animDropdowns) {
                animDropdowns.classList.remove('hsae-spotlight-animations--1', 'hsae-spotlight-animations--2', 'hsae-spotlight-animations--3');
                animDropdowns.classList.add(`hsae-spotlight-animations--${t}`);
            }
        }
        function updateAnimateVisibility() {
            const enabled = panAnimation?.checked !== false;
            if (animDropdowns) animDropdowns.style.display = enabled ? 'grid' : 'none';
            if (animDivider) animDivider.style.display = enabled ? 'block' : 'none';
        }
        function updateCycleBackdropsRow() {
            const on = cycleBackdrops?.checked === true;
            if (backdropsRow) backdropsRow.style.display = on ? 'block' : 'none';
            if (on && backdropsCountInput) {
                const val = parseInt(backdropsCountInput.value, 10);
                if (!val || val < 2) backdropsCountInput.value = '2';
                backdropsCountInput.min = '2';
            }
        }
        if (sizeSelect) {
            sizeSelect.addEventListener('change', () => {
                if (!tileCountSelect) return;
                const v = sizeSelect.value;
                tileCountSelect.value = v === 'full' ? '1' : v === 'large' ? '2' : '3';
                updateFromTileCount(tileCountSelect.value);
            });
        }
        if (tileCountSelect) {
            tileCountSelect.addEventListener('change', () => updateFromTileCount(tileCountSelect.value));
            updateFromTileCount(tileCountSelect.value);
        }
        if (panAnimation) {
            panAnimation.addEventListener('change', updateAnimateVisibility);
            updateAnimateVisibility();
        }
        if (cycleBackdrops) {
            cycleBackdrops.addEventListener('change', updateCycleBackdropsRow);
            updateCycleBackdropsRow();
        }
        backdropsCountInput?.addEventListener('change', () => {
            if (cycleBackdrops?.checked === true) {
                const val = parseInt(backdropsCountInput.value, 10);
                if (!val || val < 2) backdropsCountInput.value = '2';
            }
        });

        // Toggle cards flip checkbox without always firing change; sync conditional UI after click
        container.querySelectorAll('.kefin-toggle-switch').forEach((btn) => {
            btn.addEventListener('click', () => {
                setTimeout(() => {
                    updateAnimateVisibility();
                    updateCycleBackdropsRow();
                }, 0);
            });
        });
    }

    function resolveAdvancedEditorBuildContext(section) {
        let currentGroupName = activeEditCtx?.groupContext?.currentGroupName || '';
        let groupType = activeEditCtx?.groupType || null;

        if (section.id && !currentGroupName) {
            const config = getActiveConfig();
            if (config) {
                const groupTypes = ['HOME_SECTION_GROUPS', 'SEASONAL_SECTION_GROUPS', 'DISCOVERY_SECTION_GROUPS', 'CUSTOM_SECTION_GROUPS'];
                for (const gt of groupTypes) {
                    const found = findSectionInGroupsForEditor(config[gt] || [], section.id);
                    if (found) {
                        currentGroupName = found.group.name || '';
                        if (!groupType) groupType = gt;
                        break;
                    }
                }
            }
        }

        if (!currentGroupName && section._targetGroupName && section._targetGroupName !== 'New...') {
            currentGroupName = section._targetGroupName;
        }

        const allGroups = getActiveConfig()?.CUSTOM_SECTION_GROUPS || [];
        const existingGroupNames = [...new Set(allGroups.map(g => g.name).filter(Boolean))];
        const editorProfile = activeEditCtx?.editorProfile
            || window.KefinHomeScreenEditorProfiles?.resolveEditorProfile(section, {
                groupType,
                isCustomSection: groupType === 'CUSTOM_SECTION_GROUPS' || activeEditCtx?.sectionType === 'custom'
            })
            || 'full';
        const lockVisibility = activeEditCtx?.lockVisibility
            ?? window.KefinHomeScreenEditorProfiles?.getEditorProfileDefinition(editorProfile)?.lockVisibility === true;

        return {
            currentGroupName,
            existingGroupNames,
            config: getActiveConfig(),
            editorProfile,
            groupType,
            lockVisibility
        };
    }

    function buildSectionEditorHTML(section) {
        if (!window.KefinHomeScreenAdvancedEditor?.buildHTML) {
            return '<div class="listItemBodyText secondary">Advanced section editor is not available.</div>';
        }
        return window.KefinHomeScreenAdvancedEditor.buildHTML(section, resolveAdvancedEditorBuildContext(section));
    }

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
            { key: 'Filters', label: 'Filters', value: queryOptions.Filters || '', placeholder: 'IsUnplayed,IsResumable,IsNotFolder' },
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
                        ${field.options ? buildSelect(`query-${queryIndex}-${field.key}`, field.options, field.value, field.label) : buildTextInput(`query-${queryIndex}-${field.key}`, field.value, field.label, field.type || 'text', field.placeholder || '')}
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
            description: BADGE_FIELD_DESCRIPTIONS[type] || '',
            currentValuesArray: currentValues,
            availableTypes: type === 'IncludeItemTypes' ? allAvailableItemTypes : null,
            includeItemTypes: itemTypesForFilters,
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
        const isDiscoverySpotlight = section.renderMode === 'Spotlight';
        const discoverySpotlightHTML = buildSectionEditorSpotlightHTML(section, 'discovery-', isDiscoverySpotlight);
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
                <!-- Spotlight Options (visible only when Render Mode = Spotlight) -->
                ${discoverySpotlightHTML}
            </div>
        `;
    }

    /**
     * Collect form data from section editor
     * @param {Object} originalSection - Original section data (for preserving hidden fields in default sections)
     */
    function collectSectionEditorData(originalSection = null) {
        const dialog = document.querySelector(`.dialogContainer[data-modal-id="${SECTION_EDITOR_MODAL_ID}"]`) || document.querySelector(`.dialogContainer[data-modal-id="${DISCOVERY_EDITOR_MODAL_ID}"]`);
        if (!dialog) return null;

        if (dialog.querySelector('.hsae-root') && window.KefinHomeScreenAdvancedEditor?.collectData) {
            const sectionData = window.KefinHomeScreenAdvancedEditor.collectData(dialog, originalSection);
            if (!sectionData) return null;

            const groupSelect = dialog.querySelector('#section-group');
            const groupNew = dialog.querySelector('#section-group-new');
            if (groupSelect) {
                const selectedGroup = groupSelect.value;
                if (selectedGroup === 'New...' && groupNew?.value?.trim()) {
                    sectionData._targetGroupName = groupNew.value.trim();
                } else if (selectedGroup && selectedGroup !== 'New...') {
                    sectionData._targetGroupName = selectedGroup;
                }
            }

            if (sectionData.renderMode !== 'Spotlight') {
                delete sectionData.spotlightConfig;
            }

            if (sectionData.ttl === '') {
                sectionData.ttl = undefined;
            }

            return sectionData;
        }

        console.warn('[KefinTweaks Section Editor] Advanced editor markup not found');
        return null;
    }

    function openSectionEditorModal(section, ctx) {
        const modalId = SECTION_EDITOR_MODAL_ID;

        // Close if already open
        if (window.ModalSystem.isOpen(modalId)) {
            window.ModalSystem.close(modalId);
        }

        const originalSection = ctx.originalSection || JSON.parse(JSON.stringify(section));

        const content = document.createElement('div');
        content.innerHTML = buildSectionEditorHTML(section);

        const footer = document.createElement('div');
        footer.style.display = 'flex';
        footer.style.gap = '0.75em';
        footer.style.justifyContent = 'flex-end';
        footer.style.gap = '0.5em';
        footer.style.display = 'flex';
        footer.innerHTML = `
            <button class="emby-button raised section-preview-btn" data-section-id="${section.id}" data-section-type="${ctx.sectionType}" style="background: rgba(0, 164, 220, 0.2);">Preview</button>
            <button class="emby-button raised" onclick="window.ModalSystem.close('${modalId}')">Cancel</button>
            <button class="emby-button raised section-update-btn" data-section-id="${section.id}" data-section-type="${ctx.sectionType}" title="Save and apply these settings to all users.">Update</button>
            <button class="emby-button raised block button-submit section-save-btn" data-section-id="${section.id}" data-section-type="${ctx.sectionType}" title="Save and apply these settings to new users only.">OK</button>
        `;

        const modalInstance = window.ModalSystem.create({
            id: modalId,
            title: `Edit Section: ${section.name || 'Unnamed'}`,
            content: content,
            footer: footer,
            closeOnBackdrop: false,
            closeOnEscape: true,
            showCloseButton: true,
            onClose: () => {
                window.KefinHomeScreenAdvancedEditor?.destroyAppearancePickrs?.(modalInstance);
                activeEditCtx = null;
            },
            onOpen: (modalInstance) => {
                if (modalInstance.dialogContent?.querySelector('.hsae-root') && window.KefinHomeScreenAdvancedEditor) {
                    window.KefinHomeScreenAdvancedEditor.setupModalHeader(modalInstance);
                    let currentGroupName = activeEditCtx?.groupContext?.currentGroupName || '';
                    if (!currentGroupName && section.id) {
                        const config = getActiveConfig();
                        let found = null;
                        if (config) {
                            const groupTypes = ['HOME_SECTION_GROUPS', 'SEASONAL_SECTION_GROUPS', 'DISCOVERY_SECTION_GROUPS', 'CUSTOM_SECTION_GROUPS'];
                            for (const gt of groupTypes) {
                                found = findSectionInGroupsForEditor(config[gt] || [], section.id);
                                if (found) break;
                            }
                        }
                        if (found) currentGroupName = found.group.name || '';
                    }
                    if (!currentGroupName && section._targetGroupName) currentGroupName = section._targetGroupName;
                    const allGroups = getActiveConfig()?.CUSTOM_SECTION_GROUPS || [];
                    const existingGroupNames = [...new Set(allGroups.map(g => g.name).filter(Boolean))];
                    window.KefinHomeScreenAdvancedEditor.attachListeners(modalInstance, { section, ...(activeEditCtx?.groupContext || {}) });
                }

                // Attach event listeners
                const saveSectionFromEditor = async () => {
                    const sectionData = collectSectionEditorData(originalSection);
                    if (!sectionData) {
                        sectionEditorShowToast('Error collecting section data');
                        return null;
                    }
                    sectionData.id = section.id;
                    if (typeof ctx.onSave === 'function') {
                        await ctx.onSave(sectionData);
                    }
                    return sectionData;
                };

                const saveBtn = modalInstance.dialogFooter.querySelector('.section-save-btn');
                if (saveBtn) {
                    saveBtn.addEventListener('click', async () => {
                        saveBtn.disabled = true;
                        try {
                            const sectionData = await saveSectionFromEditor();
                            if (!sectionData) return;
                            window.ModalSystem.close(modalId);
                        } finally {
                            saveBtn.disabled = false;
                        }
                    });
                }

                const updateBtn = modalInstance.dialogFooter.querySelector('.section-update-btn');
                if (updateBtn) {
                    updateBtn.addEventListener('click', async () => {
                        updateBtn.disabled = true;
                        if (saveBtn) saveBtn.disabled = true;
                        try {
                            const sectionData = await saveSectionFromEditor();
                            if (!sectionData) return;
                            const storedId = window.KefinUserHomeScreenConfig?.getStoredSectionPrefId?.(sectionData)
                                || sectionData.id;
                            sectionEditorShowToast('Section saved. Updating users…');
                            await window.KefinUserHomeScreenConfig?.updateUserHomeScreenSectionConfiguration?.(storedId);
                            window.ModalSystem.close(modalId);
                        } catch (e) {
                            console.warn('[KefinTweaks] Failed to update section for all users:', e);
                            sectionEditorShowToast('Error updating users');
                        } finally {
                            updateBtn.disabled = false;
                            if (saveBtn) saveBtn.disabled = false;
                        }
                    });
                }

                // Delegated toggle-slider handler for section editor (Spotlight Options, Discovery Enabled, etc.)
                // Single listener on content root so it works when controls are re-rendered and is not re-added
                const contentRoot = modalInstance.dialogContent;
                if (contentRoot) {
                    contentRoot.addEventListener('click', (e) => {
                        const btn = e.target.closest('.toggle-slider');
                        if (!btn || !contentRoot.contains(btn)) return;
                        // Advanced editor attaches its own toggle handlers on .hsae-root
                        if (btn.closest('.hsae-root')) return;
                        const checkboxId = btn.dataset.checkboxId;
                        if (!checkboxId) return;
                        e.stopPropagation();
                        const checkbox = document.getElementById(checkboxId);
                        if (checkbox && contentRoot.contains(checkbox)) {
                            checkbox.checked = !checkbox.checked;
                            checkbox.dispatchEvent(new Event('change', { bubbles: true }));
                            updateToggleSliderUI(btn, checkbox.checked);
                        }
                    });
                }

                // Preview button handler
                const previewBtn = modalInstance.dialogFooter.querySelector('.section-preview-btn');
                if (previewBtn && typeof ctx.onPreview === 'function') {
                    previewBtn.addEventListener('click', async () => {
                        const sectionData = collectSectionEditorData(originalSection);
                        if (!sectionData) {
                            sectionEditorShowToast('Error collecting section data for preview');
                            return;
                        }
                        sectionData.id = sectionData.id || originalSection?.id || section.id;
                        await ctx.onPreview(sectionData, ctx.sectionType, previewBtn);
                    });
                }

                // Add query button handler (legacy editor only; advanced editor uses .hsae-add-query-btn)
                const addQueryBtn = modalInstance.dialogContent.querySelector('.add-query-btn');
                if (addQueryBtn && !modalInstance.dialogContent.querySelector('.hsae-root')) {
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
                if (queriesList) {
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
                
                // Render Mode dropdown - show/hide Card Format and Spotlight Options (section editor)
                const renderModeSelect = modalInstance.dialogContent.querySelector('#section-renderMode');
                const cardFormatContainer = modalInstance.dialogContent.querySelector('#section-cardFormat-container');
                const spotlightOptionsContainer = modalInstance.dialogContent.querySelector('#section-spotlight-options-container');
                if (renderModeSelect) {
                    const updateRenderModeDependentVisibility = () => {
                        const isSpotlight = renderModeSelect.value === 'Spotlight';
                        if (cardFormatContainer) cardFormatContainer.style.display = isSpotlight ? 'none' : 'block';
                        if (spotlightOptionsContainer) spotlightOptionsContainer.style.display = isSpotlight ? 'block' : 'none';
                        if (isSpotlight && spotlightOptionsContainer) attachSpotlightSettingsListeners(spotlightOptionsContainer, 'section-spotlight-');
                    };
                    renderModeSelect.addEventListener('change', updateRenderModeDependentVisibility);
                    updateRenderModeDependentVisibility(); // Set initial state
                }

                // Render Mode dropdown - show/hide Spotlight Options (discovery editor)
                const discoveryRenderModeSelect = modalInstance.dialogContent.querySelector('#discovery-renderMode');
                const discoverySpotlightOptionsContainer = modalInstance.dialogContent.querySelector('#discovery-spotlight-options-container');
                if (discoveryRenderModeSelect && discoverySpotlightOptionsContainer) {
                    const updateDiscoverySpotlightVisibility = () => {
                        const isSpotlight = discoveryRenderModeSelect.value === 'Spotlight';
                        discoverySpotlightOptionsContainer.style.display = isSpotlight ? 'block' : 'none';
                        if (isSpotlight) attachSpotlightSettingsListeners(discoverySpotlightOptionsContainer, 'discovery-spotlight-');
                    };
                    discoveryRenderModeSelect.addEventListener('change', updateDiscoverySpotlightVisibility);
                    updateDiscoverySpotlightVisibility(); // Set initial state
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

    function buildGlobalSpotlightSettingsHTML(config) {
        if (!config) return '';
        const spotlight = config.SPOTLIGHT_SETTINGS || {};
        const defaults = window.KefinHomeConfig2?.SPOTLIGHT_SETTINGS || {};
        const spotlightOpts = { ...defaults, ...spotlight };
        return `
            <div class="hsc-settings-panel">
                <div class="hsc-settings-desc listItemBodyText secondary">
                    <p>Default behavior for spotlight sections on the home screen. Per-section overrides can be set when editing a section.</p>
                </div>
                ${buildSharedSpotlightFieldsHTML(spotlightOpts, 'spotlight-', { useIntervalSeconds: true })}
            </div>
        `;
    }

    function attachGlobalSpotlightSettings(container, config) {
        if (!container) return;
        container.innerHTML = buildGlobalSpotlightSettingsHTML(config);
        attachSpotlightSettingsListeners(container, 'spotlight-');
    }

    function openEditSection(section, ctx) {
        activeEditCtx = ctx;
        return openSectionEditorModal(section, ctx);
    }

    function openCreateSection(section, ctx = {}) {
        if (!window.ModalSystem) {
            console.error('[KefinTweaks Section Editor] ModalSystem not available');
            return null;
        }

        const { sectionType = 'custom', config = {}, onSave, onPreview } = ctx;
        
        if (typeof onSave !== 'function') {
            console.error('[KefinTweaks Section Editor] onSave callback is required');
            return null;
        }

        if (window.ModalSystem.isOpen(CREATE_FLOW_MODAL_ID)) {
            window.ModalSystem.close(CREATE_FLOW_MODAL_ID);
        }

        let stage = 'mode';
        let modalInstance = null;

        const wizardState = {
            step: 'type',
            maxReachedStepIndex: 0,
            parentType: null,
            parents: [],
            search: '',
            parentItemsByType: {},
            parentListStatus: 'idle',
            parentListError: null,
            personSearchResults: [],
            customItems: [],
            customItemAdditionalExpanded: {},
            customItemEditorIndex: null,
            includeItemTypes: [],
            sortBy: 'Default',
            sortOrder: 'Descending',
            unwatchedOnly: false,
            renderMode: 'Normal',
            cardFormat: 'Poster',
            spotlightLayout: 'Border',
            spotlightSize: 'normal',
            tileCount: '1',
            panAnimation: true,
            sectionName: '',
            sectionGroupSelect: '',
            sectionGroupNew: '',
            order: '',
            sectionVisibility: 'normal',
            startDate: '',
            endDate: '',
            _config: config
        };

        let parentSearchDebounceTimer = null;
        let customImagePreviewTimer = null;
        let appearancePreviewDebounceTimer = null;
        let appearancePreviewRequestId = 0;
        let parentLoadRequestId = 0;
        let appearancePreviewCache = { queryKey: null, items: null };

        async function loadParentItemsForType(wizardState, root) {
            if (!wizardState.parentType) return;

            const requestId = ++parentLoadRequestId;
            wizardState.parentListStatus = 'loading';
            wizardState.parentListError = null;

            const list = root?.querySelector('#hsse-parent-list');
            if (list) list.innerHTML = renderParentListHTML(wizardState);

            try {
                if (wizardState.parentType === 'Person') {
                    const results = await fetchPersons(wizardState.search);
                    if (requestId !== parentLoadRequestId) return;
                    wizardState.personSearchResults = results;
                } else {
                    const items = await fetchWizardParentItems(wizardState.parentType, {
                        includeItemTypes: wizardState.includeItemTypes
                    });
                    if (requestId !== parentLoadRequestId) return;
                    wizardState.parentItemsByType[wizardState.parentType] = items;
                }
                wizardState.parentListStatus = 'idle';
            } catch (err) {
                if (requestId !== parentLoadRequestId) return;
                wizardState.parentListStatus = 'error';
                wizardState.parentListError = err.message || 'Failed to load items';
                console.error('[KefinTweaks Section Editor] Parent load error:', err);
            }

            const listEl = root?.querySelector('#hsse-parent-list');
            if (listEl) listEl.innerHTML = renderParentListHTML(wizardState);
            if (wizardState.parents?.length) scrollSelectedParentIntoView(root);
        }

        function refreshParentListDisplay(root) {
            const list = root?.querySelector('#hsse-parent-list');
            if (list) list.innerHTML = renderParentListHTML(wizardState);
        }

        function scheduleParentSearch(root) {
            if (parentSearchDebounceTimer) clearTimeout(parentSearchDebounceTimer);

            if (wizardState.parentType === 'Person') {
                parentSearchDebounceTimer = setTimeout(() => {
                    loadParentItemsForType(wizardState, root);
                }, WIZARD_PARENT_DATA.SEARCH_DEBOUNCE_MS);
            } else {
                refreshParentListDisplay(root);
            }
        }

        function scheduleAppearancePreview(root) {
            if (wizardState.step !== 'appearance') return;
            if (appearancePreviewDebounceTimer) clearTimeout(appearancePreviewDebounceTimer);

            appearancePreviewDebounceTimer = setTimeout(async () => {
                const container = root?.querySelector('#hsse-appearance-preview-container');
                if (!container) return;

                const fetchPreview = window.KefinHomeScreen?.fetchSectionPreviewItems;
                const renderPreview = window.KefinHomeScreen?.renderSectionPreviewInto;
                if (typeof fetchPreview !== 'function' || typeof renderPreview !== 'function') {
                    container.innerHTML = '<p class="listItemBodyText secondary" style="text-align:center;padding:1.5em 0;">Preview unavailable.</p>';
                    return;
                }

                syncCurrentStepFromForm(root, wizardState);
                const draft = wizardStateToSection(wizardState, section);
                const queryKey = getAppearancePreviewQueryKey(wizardState);
                const requestId = ++appearancePreviewRequestId;
                const cacheHit = appearancePreviewCache.queryKey === queryKey
                    && appearancePreviewCache.items !== null;

                if (!cacheHit) {
                    container.innerHTML = '<p class="listItemBodyText secondary" style="text-align:center;padding:1.5em 0;">Loading preview…</p>';
                }

                try {
                    if (!cacheHit) {
                        const { items } = await fetchPreview(draft, { useSpotlightFields: true });
                        if (requestId !== appearancePreviewRequestId) return;
                        appearancePreviewCache = { queryKey, items };
                    }

                    if (requestId !== appearancePreviewRequestId) return;
                    renderPreview(draft, appearancePreviewCache.items, container);
                } catch (err) {
                    if (requestId !== appearancePreviewRequestId) return;
                    appearancePreviewCache = { queryKey: null, items: null };
                    container.innerHTML = `<p class="listItemBodyText secondary" style="text-align:center;padding:1.5em 0;">${escapeHtml(err.message || 'Preview failed')}</p>`;
                }
            }, WIZARD_PARENT_DATA.APPEARANCE_PREVIEW_DEBOUNCE_MS);
        }

        function navigateToStep(root, targetStep) {
            const targetIndex = getStepIndex(targetStep, wizardState);
            if (targetIndex < 0 || targetIndex > wizardState.maxReachedStepIndex) return;
            if (targetStep === wizardState.step) return;

            syncCurrentStepFromForm(root, wizardState);
            if (wizardState.step === 'customItems' && targetStep !== 'customItems') {
                wizardState.customItemEditorIndex = null;
            }
            wizardState.step = targetStep;
            refreshModal(root);
        }

        function advanceToStep(root, nextStep) {
            if (wizardState.step === 'customItems' && nextStep !== 'customItems') {
                wizardState.customItemEditorIndex = null;
            }
            const nextIndex = getStepIndex(nextStep, wizardState);
            markStepReached(wizardState, nextIndex);
            wizardState.step = nextStep;
            refreshModal(root);
        }

        function resetModalHeader() {
            if (!modalInstance?.dialogHeader) return;

            const header = modalInstance.dialogHeader;
            const closeBtn = header.querySelector('.btnClose');
            const titleText = header.querySelector('.dialogTitle, h2')?.textContent || 'Create a Section';

            header.querySelector('.hsse-header-main')?.remove();
            header.querySelector('.hsae-header-main')?.remove();
            delete header.dataset.hsseHeaderSetup;
            delete header.dataset.hsaeHeaderSetup;

            if (!header.querySelector('h2')) {
                const titleEl = document.createElement('h2');
                titleEl.className = 'dialogTitle';
                titleEl.textContent = titleText;
                if (closeBtn) {
                    header.insertBefore(titleEl, closeBtn);
                } else {
                    header.prepend(titleEl);
                }
            }
        }

        function buildAdvancedGroupContext(sectionDraft) {
            return {
                currentGroupName: sectionDraft._targetGroupName || '',
                existingGroupNames: getExistingGroupNames(config),
                config,
                editorProfile: 'full',
                lockVisibility: false
            };
        }

        function persistAdvancedDraft() {
            const adv = window.KefinHomeScreenAdvancedEditor;
            if (!adv?.collectData || stage !== 'advanced' || !modalInstance) return;

            const dialog = modalInstance.dialogContainer || modalInstance.dialogContent;
            const collected = adv.collectData(dialog, section);
            if (collected) {
                Object.assign(section, collected);
            }
        }

        function mountAdvancedStage(root) {
            const adv = window.KefinHomeScreenAdvancedEditor;
            if (!adv?.buildHTML || !modalInstance) return;

            stage = 'advanced';
            resetModalHeader();

            const groupContext = buildAdvancedGroupContext(section);
            const originalSection = JSON.parse(JSON.stringify(section));

            modalInstance.dialogContent.innerHTML = adv.buildHTML(section, groupContext);

            if (modalInstance.dialogFooter) {
                modalInstance.dialogFooter.innerHTML = buildAdvancedCreateFooterHTML(sectionType);
                modalInstance.dialogFooter.style.display = 'flex';
            }

            adv.attachListeners(modalInstance, {
                section,
                ...groupContext,
                originalSection,
                headerTitle: 'Create a Section'
            }, {
                onSave: async (sectionData) => {
                    Object.assign(section, sectionData);
                    await onSave(sectionData);
                    window.ModalSystem.close(CREATE_FLOW_MODAL_ID);
                }
            });

            const previewBtn = modalInstance.dialogFooter?.querySelector('.section-preview-btn');
            if (previewBtn && typeof onPreview === 'function' && previewBtn.dataset.listenerAttached !== 'true') {
                previewBtn.dataset.listenerAttached = 'true';
                previewBtn.addEventListener('click', async () => {
                    const dialog = modalInstance.dialogContainer || modalInstance.dialogContent;
                    const sectionData = adv.collectData(dialog, section);
                    if (!sectionData) return;
                    await onPreview(sectionData, sectionType, previewBtn);
                });
            }
        }

        function setupModalHeader() {
            if (!modalInstance?.dialogHeader) return;
            if (modalInstance.dialogHeader.dataset.hsseHeaderSetup === 'true') return;
            modalInstance.dialogHeader.dataset.hsseHeaderSetup = 'true';

            const titleEl = modalInstance.dialogHeader.querySelector('h2');
            const closeBtn = modalInstance.dialogHeader.querySelector('.btnClose');

            const headerMain = document.createElement('div');
            headerMain.className = 'hsse-header-main';

            const titleWrap = document.createElement('div');
            titleWrap.className = 'hsse-header-title-wrap';
            if (titleEl) {
                titleEl.classList.add('dialogTitle');
                titleWrap.appendChild(titleEl);
            }

            headerMain.appendChild(titleWrap);

            if (closeBtn) {
                modalInstance.dialogHeader.insertBefore(headerMain, closeBtn);
            } else {
                modalInstance.dialogHeader.prepend(headerMain);
            }
        }

        function updateModalHeader() {
            if (!modalInstance?.dialogHeader) return;
            setupModalHeader();

            const titleEl = modalInstance.dialogHeader.querySelector('.dialogTitle, h2');
            if (titleEl) titleEl.textContent = getModalTitle(stage, wizardState);
        }

        function refreshModal(root) {
            if (!modalInstance) return;

            const content = document.createElement('div');
            content.className = 'hsse-root';
            content.innerHTML = stage === 'mode' ? renderModeSelectHTML() : renderWizardHTML(wizardState, config);

            modalInstance.dialogContent.innerHTML = '';
            modalInstance.dialogContent.appendChild(content);

            updateModalHeader();

            if (modalInstance.dialogFooter) {
                const footerHTML = getFooterHTML(stage, wizardState);
                modalInstance.dialogFooter.innerHTML = footerHTML;
                modalInstance.dialogFooter.style.display = footerHTML.trim() ? 'flex' : 'none';
            }

            const activeRoot = root || modalInstance.dialogContent;
            attachToggleHandlers(activeRoot);

            if (stage === 'wizard' && wizardState.step === 'parent' && wizardState.parentType) {
                const cached = wizardState.parentItemsByType[wizardState.parentType];
                const needsLoad = wizardState.parentType === 'Person'
                    ? wizardState.parentListStatus === 'idle' && wizardState.personSearchResults.length === 0
                    : !cached && wizardState.parentListStatus !== 'loading';
                if (needsLoad || wizardState.parentListStatus === 'error') {
                    loadParentItemsForType(wizardState, activeRoot);
                } else if (wizardState.parents?.length) {
                    scrollSelectedParentIntoView(activeRoot);
                }
            }

            if (stage === 'wizard' && wizardState.step === 'appearance') {
                scheduleAppearancePreview(activeRoot);
            }

            if (stage === 'wizard' && wizardState.step === 'customItems') {
                window.KefinHomeScreenCustomItemsEditor?.refreshPreviews(activeRoot, wizardState, getWizardCustomItemsOptions());
            }
        }

        function handleAction(action, el, root) {
            const wizardCustomActions = new Set([
                'wizard-open-custom-item-editor',
                'wizard-close-custom-item-editor',
                'wizard-add-custom-item',
                'wizard-remove-custom-item',
                'wizard-toggle-custom-images'
            ]);
            if (wizardCustomActions.has(action) && window.KefinHomeScreenCustomItemsEditor) {
                window.KefinHomeScreenCustomItemsEditor.handleAction(
                    action,
                    el,
                    root,
                    wizardState,
                    getWizardCustomItemsOptions(),
                    () => refreshModal(root)
                );
                return;
            }

            switch (action) {
                case 'cancel':
                    window.ModalSystem.close(CREATE_FLOW_MODAL_ID);
                    break;

                case 'select-wizard':
                    stage = 'wizard';
                    wizardState.step = 'type';
                    wizardState.maxReachedStepIndex = 0;
                    refreshModal(root);
                    break;

                case 'select-advanced':
                    mountAdvancedStage(root);
                    break;

                case 'advanced-back':
                    persistAdvancedDraft();
                    resetModalHeader();
                    delete modalInstance._hsaeState;
                    stage = 'mode';
                    refreshModal(root);
                    break;

                case 'wizard-select-type': {
                    const selected = el.dataset.type;
                    if (selected !== wizardState.parentType) {
                        wizardState.parentType = selected;
                        wizardState.parents = [];
                        wizardState.search = '';
                        wizardState.parentListStatus = 'idle';
                        wizardState.parentListError = null;
                        wizardState.personSearchResults = [];
                        wizardState.maxReachedStepIndex = 0;
                        if (selected === 'Custom') {
                            wizardState.customItems = [createBlankCustomItem()];
                            wizardState.customItemEditorIndex = null;
                            advanceToStep(root, 'customItems');
                        } else {
                            wizardState.customItems = [];
                            advanceToStep(root, 'parent');
                        }
                    } else if (selected === 'Custom') {
                        wizardState.customItemEditorIndex = null;
                        advanceToStep(root, 'customItems');
                    } else {
                        advanceToStep(root, 'parent');
                    }
                    break;
                }

                case 'wizard-open-custom-item-editor': {
                    const openIndex = parseInt(el.dataset.itemIndex, 10);
                    if (Number.isNaN(openIndex)) break;
                    if (wizardState.customItemEditorIndex != null && wizardState.customItemEditorIndex !== openIndex) {
                        collectCustomItemFromForm(root, wizardState, wizardState.customItemEditorIndex);
                    }
                    wizardState.customItemEditorIndex = openIndex;
                    refreshModal(root);
                    break;
                }

                case 'wizard-close-custom-item-editor': {
                    const discard = el.dataset.discard === 'true';
                    if (!discard && wizardState.customItemEditorIndex != null) {
                        collectCustomItemFromForm(root, wizardState, wizardState.customItemEditorIndex);
                    }
                    wizardState.customItemEditorIndex = null;
                    refreshModal(root);
                    break;
                }

                case 'wizard-add-custom-item': {
                    collectCustomItemsFromForm(root, wizardState);
                    wizardState.customItems.push(createBlankCustomItem());
                    wizardState.customItemEditorIndex = wizardState.customItems.length - 1;
                    refreshModal(root);
                    break;
                }

                case 'wizard-remove-custom-item': {
                    const removeIndex = parseInt(el.dataset.itemIndex, 10);
                    if (wizardState.customItems.length <= 1 || Number.isNaN(removeIndex)) break;
                    if (wizardState.customItemEditorIndex === removeIndex) {
                        collectCustomItemFromForm(root, wizardState, removeIndex);
                    } else {
                        collectCustomItemsFromForm(root, wizardState);
                    }
                    const itemToRemove = wizardState.customItems[removeIndex];
                    if (hasCustomItemContent(itemToRemove) && !confirm('Are you sure you want to remove this item?')) {
                        break;
                    }
                    wizardState.customItems.splice(removeIndex, 1);
                    reindexCustomItemAdditionalExpanded(wizardState, removeIndex);
                    if (wizardState.customItemEditorIndex === removeIndex) {
                        wizardState.customItemEditorIndex = null;
                    } else if (wizardState.customItemEditorIndex > removeIndex) {
                        wizardState.customItemEditorIndex -= 1;
                    }
                    refreshModal(root);
                    break;
                }

                case 'wizard-toggle-custom-images': {
                    const toggleIndex = parseInt(el.dataset.itemIndex, 10);
                    if (Number.isNaN(toggleIndex)) break;
                    collectCustomItemFromForm(root, wizardState, toggleIndex);
                    if (!wizardState.customItemAdditionalExpanded) {
                        wizardState.customItemAdditionalExpanded = {};
                    }
                    const item = wizardState.customItems[toggleIndex];
                    const currentlyExpanded = isCustomItemAdditionalExpanded(wizardState, toggleIndex, item);
                    wizardState.customItemAdditionalExpanded[toggleIndex] = !currentlyExpanded;
                    refreshModal(root);
                    break;
                }

                case 'wizard-select-parent': {
                    const parentId = el.dataset.parentId;
                    const parentName = el.dataset.parentName;
                    const item = { id: parentId, name: parentName };

                    if (isMultiSelectType(wizardState.parentType)) {
                        const idx = wizardState.parents.findIndex(p => p.id === parentId);
                        if (idx >= 0) {
                            wizardState.parents.splice(idx, 1);
                        } else {
                            wizardState.parents.push(item);
                        }
                        el.classList.toggle('hsse-active');
                        break;
                    }

                    if (wizardState.parents[0]?.id === parentId) {
                        advanceToStep(root, 'query');
                        break;
                    }
                    wizardState.parents = [item];
                    wizardState.sectionName = buildSectionName(wizardState.parentType, wizardState.parents);
                    advanceToStep(root, 'query');
                    break;
                }

                case 'wizard-retry-parent-load':
                    loadParentItemsForType(wizardState, root);
                    break;

                case 'wizard-navigate-step':
                    navigateToStep(root, el.dataset.step);
                    break;

                case 'wizard-toggle-item-type': {
                    const type = el.dataset.itemType;
                    const idx = wizardState.includeItemTypes.indexOf(type);
                    if (idx >= 0) {
                        wizardState.includeItemTypes.splice(idx, 1);
                    } else {
                        wizardState.includeItemTypes.push(type);
                    }
                    el.classList.toggle('hsse-active');
                    updateIncludedItemTypesHint(root, wizardState.includeItemTypes);
                    break;
                }

                case 'wizard-set-render-mode':
                    wizardState.renderMode = el.dataset.renderMode;
                    if (wizardState.renderMode === 'Random') {
                        applyRandomAppearanceOptions(wizardState);
                    }
                    refreshModal(root);
                    if (wizardState.step === 'appearance') {
                        scheduleAppearancePreview(root);
                    }
                    break;

                case 'wizard-set-section-visibility':
                    syncCurrentStepFromForm(root, wizardState);
                    wizardState.sectionVisibility = el.dataset.visibility || 'normal';
                    refreshModal(root);
                    break;

                case 'wizard-set-card-format':
                    wizardState.cardFormat = el.dataset.cardFormat;
                    root.querySelectorAll('[data-hsse-action="wizard-set-card-format"]').forEach(btn => {
                        btn.classList.toggle('hsse-active', btn === el);
                    });
                    scheduleAppearancePreview(root);
                    break;

                case 'wizard-back':
                    syncCurrentStepFromForm(root, wizardState);
                    if (wizardState.step === 'type') {
                        stage = 'mode';
                        refreshModal(root);
                    } else {
                        const steps = getWizardSteps(wizardState);
                        const idx = getStepIndex(wizardState.step, wizardState);
                        const prevStep = steps[idx - 1];
                        if (wizardState.step === 'customItems') {
                            wizardState.customItemEditorIndex = null;
                        }
                        wizardState.step = prevStep;
                        refreshModal(root);
                    }
                    break;

                case 'wizard-continue': {
                    syncCurrentStepFromForm(root, wizardState);
                    if (wizardState.step === 'parent' && isMultiSelectType(wizardState.parentType)) {
                        if (!wizardState.parents.length) break;
                        wizardState.sectionName = buildSectionName(wizardState.parentType, wizardState.parents);
                    }
                    if (wizardState.step === 'customItems') {
                        if (!hasValidCustomItems(wizardState.customItems)) break;
                        if (!wizardState.sectionName?.trim()) {
                            wizardState.sectionName = 'Custom Section';
                        }
                    }
                    if (wizardState.step === 'settings' && wizardState.sectionVisibility === 'seasonal') {
                        if (!hasValidSeasonalDates(wizardState)) break;
                    }
                    const steps = getWizardSteps(wizardState);
                    const idx = getStepIndex(wizardState.step, wizardState);
                    if (idx < steps.length - 1) {
                        advanceToStep(root, steps[idx + 1]);
                    }
                    break;
                }

                case 'wizard-finish': {
                    syncCurrentStepFromForm(root, wizardState);
                    const draft = wizardStateToSection(wizardState, section);
                    Promise.resolve(onSave(draft)).then(() => {
                        if (modalInstance) {
                            window.ModalSystem.close(CREATE_FLOW_MODAL_ID);
                        }
                    }).catch(err => {
                        console.error('[KefinTweaks Section Editor] Save failed:', err);
                    });
                    break;
                }

                default:
                    break;
            }
        }

        const content = document.createElement('div');
        content.className = 'hsse-root';
        content.innerHTML = renderModeSelectHTML();

        const footer = document.createElement('div');
        footer.style.display = 'flex';
        footer.style.gap = '0.5em';
        footer.style.justifyContent = 'flex-end';
        footer.innerHTML = getFooterHTML('mode', wizardState);

        modalInstance = window.ModalSystem.create({
            id: CREATE_FLOW_MODAL_ID,
            title: getModalTitle('mode', wizardState),
            content: content,
            footer: footer,
            closeOnBackdrop: false,
            closeOnEscape: true,
            showCloseButton: true,
            onClose: () => {
                window.KefinHomeScreenAdvancedEditor?.destroyAppearancePickrs?.(modalInstance);
            },
            onOpen: (instance) => {
                const root = instance.dialogContent;

                attachToggleHandlers(root);
                setupModalHeader();
                updateModalHeader();

                root.addEventListener('click', (e) => {
                    const actionEl = e.target.closest('[data-hsse-action]');
                    if (!actionEl || !root.contains(actionEl)) return;
                    handleAction(actionEl.dataset.hsseAction, actionEl, root);
                });

                root.addEventListener('change', (e) => {
                    if (e.target.id === 'hsse-wizard-sectionGroup') {
                        const container = root.querySelector('#hsse-wizard-sectionGroup-new-container');
                        if (container) {
                            container.style.display = e.target.value === 'New...' ? 'block' : 'none';
                        }
                    }
                    if (wizardState.step === 'appearance' && (
                        e.target.id === 'hsse-wizard-spotlightLayout' ||
                        e.target.id === 'hsse-wizard-spotlightSize' ||
                        e.target.id === 'hsse-wizard-tileCount' ||
                        e.target.id === 'hsse-wizard-animated-checkbox'
                    )) {
                        collectAppearanceStepFromForm(root, wizardState);
                        scheduleAppearancePreview(root);
                    }
                });

                root.addEventListener('input', (e) => {
                    if (e.target.id === 'hsse-parent-search') {
                        wizardState.search = e.target.value;
                        scheduleParentSearch(root);
                    }
                    if (e.target.matches('[data-hsse-custom-preview]')) {
                        clearTimeout(customImagePreviewTimer);
                        const input = e.target;
                        customImagePreviewTimer = setTimeout(() => {
                            const img = root.querySelector(`img[data-preview-for="${input.id}"]`);
                            updateCustomImagePreview(img, input.value);
                        }, 300);
                    }
                });

                instance.dialogFooter.addEventListener('click', (e) => {
                    const actionEl = e.target.closest('[data-hsse-action]');
                    if (!actionEl) return;
                    handleAction(actionEl.dataset.hsseAction, actionEl, root);
                });

                instance.dialogHeader.addEventListener('click', (e) => {
                    const actionEl = e.target.closest('[data-hsse-action]');
                    if (!actionEl) return;
                    handleAction(actionEl.dataset.hsseAction, actionEl, root);
                });
            }
        });

        LOG('Create flow opened for section', section.id);
        return modalInstance;
    }

    window.KefinHomeScreenSectionEditor = {
        openCreateSection,
        openEditSection,
        renderHomeScreenSectionEditor: openCreateSection,
        attachGlobalSpotlightSettings,
        buildGlobalSpotlightSettingsHTML,
        collectSpotlightConfigFromDialog,
        attachSpotlightSettingsListeners,
        setupAdditionalOptionsListeners,
        openSelectionPopover,
        openLibraryItemPickerPopover,
        fetchLibrarySearchItems,
        fetchSelectionItems,
        resolveSelectionItemLabels,
        getSelectionTypeMeta,
        ALL_ITEM_TYPES,
        PARENT_SELECTION_TYPES,
        FACET_SELECTION_TYPES,
        buildSelect,
        buildTextInput,
        buildToggleSlider,
        buildToggleCard,
        buildCheckbox,
        updateToggleSliderUI,
        updateToggleSwitchUI
    };

    window.KefinHomeScreenEditorConstants = {
        DEFAULT_SECTION_QUERY_LIMIT,
        SORT_ORDERS,
        SORT_ORDER_DIRECTIONS,
        CARD_FORMATS,
        RENDER_MODE_OPTIONS,
        SPOTLIGHT_LAYOUT_OPTIONS,
        SPOTLIGHT_SIZE_OPTIONS,
        SPOTLIGHT_TILE_COUNT_OPTIONS,
        SPOTLIGHT_ENTRANCE_OPTIONS,
        SPOTLIGHT_SLIDE_OPTIONS,
        SLIDE_STATE_OPTIONS,
        SUPPORTED_QUERY_OPTIONS
    };

    LOG('Home Screen Section Editor loaded');

})();
