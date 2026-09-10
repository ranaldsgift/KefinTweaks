// Shared Custom Items editor (wizard + advanced section editor)

(function() {
    'use strict';

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

    function escapeHtml(str) {
        if (str == null) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    function renderMaterialIcon(name, className = '') {
        return `<span class="material-icons${className ? ' ' + className : ''}" aria-hidden="true">${escapeHtml(name)}</span>`;
    }

    function getOptions(options = {}) {
        return {
            idPrefix: options.idPrefix || 'hsse-custom',
            actionAttr: options.actionAttr || 'data-hsse-action',
            actions: {
                openEditor: 'wizard-open-custom-item-editor',
                closeEditor: 'wizard-close-custom-item-editor',
                addItem: 'wizard-add-custom-item',
                removeItem: 'wizard-remove-custom-item',
                toggleImages: 'wizard-toggle-custom-images',
                ...(options.actions || {})
            },
            intro: options.intro !== false
        };
    }

    function actionAttr(options, action) {
        return `${options.actionAttr}="${escapeHtml(options.actions[action])}"`;
    }

    function fieldId(options, index, key) {
        return `${options.idPrefix}-${index}-${key}`;
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

    function staticItemToDraft(item) {
        if (!item) return createBlankCustomItem();
        const draft = createBlankCustomItem();
        draft.name = item.Name || item.name || '';
        draft.cardFooter = item.cardFooter || '';
        draft.cardUrl = item.cardUrl || '';
        draft.posterUrl = item.posterUrl || item.imageUrl || '';
        draft.thumbUrl = item.thumbUrl || '';
        draft.backdropUrl = item.backdropUrl || '';
        draft.squareUrl = item.squareUrl || '';
        draft.bannerUrl = item.bannerUrl || '';
        draft.logoUrl = item.logoUrl || '';
        return draft;
    }

    function staticItemsToDrafts(items) {
        const list = (items || []).map(staticItemToDraft).filter(Boolean);
        return list.length ? list : [createBlankCustomItem()];
    }

    function ensureCustomItemsInitialized(state) {
        if (!state.customItems?.length) {
            state.customItems = [createBlankCustomItem()];
        }
    }

    function hasAdditionalCustomImages(item) {
        return CUSTOM_ADDITIONAL_IMAGE_FIELDS.some(field => item[field.key]?.trim());
    }

    function isCustomItemAdditionalExpanded(state, index, item) {
        const explicit = state.customItemAdditionalExpanded?.[index];
        if (explicit === true) return true;
        if (explicit === false) return false;
        return hasAdditionalCustomImages(item);
    }

    function reindexCustomItemAdditionalExpanded(state, removedIndex) {
        if (!state.customItemAdditionalExpanded) return;
        const next = {};
        Object.entries(state.customItemAdditionalExpanded).forEach(([key, value]) => {
            const i = parseInt(key, 10);
            if (Number.isNaN(i) || value === undefined) return;
            if (i < removedIndex) next[i] = value;
            else if (i > removedIndex) next[i - 1] = value;
        });
        state.customItemAdditionalExpanded = next;
    }

    function hasValidCustomItems(items) {
        return (items || []).some(item => item.name?.trim() && item.posterUrl?.trim());
    }

    function hasCustomItemContent(item) {
        if (!item) return false;
        return [
            item.name, item.cardFooter, item.cardUrl, item.posterUrl,
            item.thumbUrl, item.backdropUrl, item.squareUrl, item.bannerUrl, item.logoUrl
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

    function collectCustomItemFromForm(root, state, index, options) {
        if (!root || !state.customItems?.[index]) return;
        const opts = getOptions(options);
        const item = state.customItems[index];
        const nameEl = root.querySelector(`#${fieldId(opts, index, 'name')}`);
        const cardFooterEl = root.querySelector(`#${fieldId(opts, index, 'cardFooter')}`);
        const cardUrlEl = root.querySelector(`#${fieldId(opts, index, 'cardUrl')}`);
        if (nameEl) item.name = nameEl.value;
        if (cardFooterEl) item.cardFooter = cardFooterEl.value;
        if (cardUrlEl) item.cardUrl = cardUrlEl.value;
        CUSTOM_IMAGE_FIELDS.forEach(field => {
            const el = root.querySelector(`#${fieldId(opts, index, field.key)}`);
            if (el) item[field.key] = el.value;
        });
    }

    function collectCustomItemsFromForm(root, state, options) {
        if (!root || !state.customItems) return;
        const editorIndex = state.customItemEditorIndex;
        if (editorIndex != null && !Number.isNaN(editorIndex)) {
            collectCustomItemFromForm(root, state, editorIndex, options);
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

    function refreshPreviews(root, state, options) {
        if (!root || !state.customItems) return;
        state.customItems.forEach((item, index) => {
            const tileImg = root.querySelector(`img[data-tile-index="${index}"]`);
            updateCustomImagePreview(tileImg, item.posterUrl);
        });
        root.querySelectorAll('[data-hsse-custom-preview], [data-hsae-custom-preview]').forEach(input => {
            const img = root.querySelector(`img[data-preview-for="${input.id}"]`);
            updateCustomImagePreview(img, input.value);
        });
    }

    function buildCustomImageFieldHTML(index, field, value, options, fieldOptions = {}) {
        const opts = getOptions(options);
        const { isPoster = false } = fieldOptions;
        const requiredMark = field.required ? ' <span class="hsse-required-mark">*</span>' : '';
        const inputId = fieldId(opts, index, field.key);
        const previewAttr = isPoster ? ' data-hsse-custom-preview="true" data-hsae-custom-preview="true"' : '';
        const posterHint = isPoster
            ? `<p class="listItemBodyText secondary hsse-field-hint hsse-custom-image-field-hint">You can place images in your &quot;Jellyfin\\Server\\jellyfin-web&quot; folder and use the &quot;/web/image_name.png&quot; path to access them.</p>`
            : '';
        return `
            <div class="hsse-field hsse-custom-image-field${isPoster ? '' : ' hsse-custom-image-field-compact'}">
                <label class="listItemBodyText hsse-section-label hsse-custom-field-label" for="${inputId}">${escapeHtml(field.label)}${requiredMark}</label>
                <input type="url" id="${inputId}" class="fld emby-input hsse-custom-image-input" value="${escapeHtml(value)}" placeholder="https://..." aria-label="${escapeHtml(field.label)}"${previewAttr}>
                ${posterHint}
            </div>
        `;
    }

    function renderCustomItemEditorHTML(index, item, state, options) {
        const opts = getOptions(options);
        const additionalExpanded = isCustomItemAdditionalExpanded(state, index, item);
        const posterInputId = fieldId(opts, index, 'posterUrl');

        return `
            <div class="hsse-custom-item-main">
                <div class="hsse-custom-item-fields">
                    <div class="hsse-field hsse-custom-field">
                        <label class="listItemBodyText hsse-section-label hsse-custom-field-label" for="${fieldId(opts, index, 'name')}">Name <span class="hsse-required-mark">*</span></label>
                        <input type="text" id="${fieldId(opts, index, 'name')}" class="fld emby-input" value="${escapeHtml(item.name)}" placeholder="Item name" aria-label="Item name">
                    </div>
                    <div class="hsse-field hsse-custom-field">
                        <label class="listItemBodyText hsse-section-label hsse-custom-field-label" for="${fieldId(opts, index, 'cardFooter')}">Card Footer</label>
                        <input type="text" id="${fieldId(opts, index, 'cardFooter')}" class="fld emby-input" value="${escapeHtml(item.cardFooter || '')}" placeholder="Optional footer text" aria-label="Card footer">
                    </div>
                    <div class="hsse-field hsse-custom-field">
                        <label class="listItemBodyText hsse-section-label hsse-custom-field-label" for="${fieldId(opts, index, 'cardUrl')}">Link URL</label>
                        <input type="url" id="${fieldId(opts, index, 'cardUrl')}" class="fld emby-input" value="${escapeHtml(item.cardUrl)}" placeholder="#/movies.html or https://..." aria-label="Link URL">
                    </div>
                    ${buildCustomImageFieldHTML(index, CUSTOM_POSTER_FIELD, item.posterUrl || '', opts, { isPoster: true })}
                </div>
                <div class="hsse-custom-item-preview-col" aria-hidden="true">
                    <div class="hsse-image-preview hsse-item-main-preview">
                        <img class="hsse-image-preview-img" alt="" data-preview-for="${posterInputId}">
                    </div>
                </div>
            </div>
            <div class="hsse-custom-image-toggle-wrap">
                <button type="button" class="emby-button raised hsse-custom-image-toggle" ${actionAttr(opts, 'toggleImages')} data-item-index="${index}" aria-expanded="${additionalExpanded ? 'true' : 'false'}">
                    ${additionalExpanded ? 'Hide Additional Image Types' : 'Configure Additional Image Types'}
                </button>
            </div>
            <div class="hsse-field-grid hsse-custom-image-grid hsse-custom-image-additional${additionalExpanded ? '' : ' hsse-collapsed'}"${additionalExpanded ? '' : ' hidden'}>
                ${CUSTOM_ADDITIONAL_IMAGE_FIELDS.map(field => buildCustomImageFieldHTML(index, field, item[field.key] || '', opts)).join('')}
            </div>
        `;
    }

    function renderCustomItemTileHTML(index, item, canRemove, options) {
        const opts = getOptions(options);
        const label = item.name?.trim() || `Item ${index + 1}`;
        return `
            <div class="hsse-custom-item-tile" data-custom-item-index="${index}">
                <button type="button" class="hsse-custom-item-tile-image hsse-image-preview hsse-item-tile-preview" ${actionAttr(opts, 'openEditor')} data-item-index="${index}" aria-label="Edit ${escapeHtml(label)}">
                    <img class="hsse-image-preview-img" alt="" data-tile-index="${index}">
                    <span class="hsse-custom-item-edit-badge">${renderMaterialIcon('edit')}</span>
                </button>
                <div class="listItemBodyText hsse-custom-item-tile-label">${escapeHtml(label)}</div>
                <button type="button" class="emby-button raised hsse-custom-item-trash" ${actionAttr(opts, 'removeItem')} data-item-index="${index}"${canRemove ? '' : ' disabled'} aria-label="Remove ${escapeHtml(label)}">
                    ${renderMaterialIcon('delete', 'hsse-custom-item-trash-icon')}
                </button>
            </div>
        `;
    }

    function renderCustomItemEditorPanelHTML(state, options) {
        const opts = getOptions(options);
        const editorIndex = state.customItemEditorIndex;
        if (editorIndex == null || Number.isNaN(editorIndex)) return '';
        const item = state.customItems?.[editorIndex];
        if (!item) return '';

        const title = item.name?.trim()
            ? `Edit: ${item.name.trim()}`
            : `Edit Item ${editorIndex + 1}`;

        return `
            <div class="hsse-custom-item-editor-overlay">
                <button type="button" class="hsse-custom-item-editor-backdrop" ${actionAttr(opts, 'closeEditor')} aria-label="Close editor"></button>
                <div class="hsse-custom-item-editor-panel dialog" role="dialog" aria-modal="true" aria-label="${escapeHtml(title)}">
                    <div class="hsse-custom-item-editor-header">
                        <div class="listItemBodyText hsse-custom-item-editor-title">${escapeHtml(title)}</div>
                    </div>
                    <div class="hsse-custom-item-editor-body">
                        ${renderCustomItemEditorHTML(editorIndex, item, state, opts)}
                    </div>
                    <div class="hsse-custom-item-editor-footer">
                        <button type="button" class="emby-button raised" ${actionAttr(opts, 'closeEditor')} data-discard="true">Cancel</button>
                        <button type="button" class="emby-button raised button-submit" ${actionAttr(opts, 'closeEditor')}>Done</button>
                    </div>
                </div>
            </div>
        `;
    }

    function renderCustomItemsHTML(state, options) {
        const opts = getOptions(options);
        ensureCustomItemsInitialized(state);
        const items = state.customItems;
        const canRemove = items.length > 1;

        return `
            <div class="hsse-custom-items-stage">
                ${opts.intro ? `
                <div class="hsse-section-block hsse-custom-items-intro">
                    <div class="listItemBodyText hsse-section-label">Custom Items</div>
                    <p class="listItemBodyText secondary hsse-field-hint">Name and poster required. Link and other images optional.</p>
                </div>` : ''}
                <div class="hsse-custom-items-grid">
                    ${items.map((item, index) => renderCustomItemTileHTML(index, item, canRemove, opts)).join('')}
                    <button type="button" class="hsse-custom-item-add-tile" ${actionAttr(opts, 'addItem')} aria-label="Add item">
                        ${renderMaterialIcon('add', 'hsse-custom-item-add-icon')}
                    </button>
                </div>
                ${renderCustomItemEditorPanelHTML(state, opts)}
            </div>
        `;
    }

    function handleAction(action, el, root, state, options, onRefresh) {
        const opts = getOptions(options);
        const actions = opts.actions;

        switch (action) {
            case actions.openEditor: {
                const openIndex = parseInt(el.dataset.itemIndex, 10);
                if (Number.isNaN(openIndex)) break;
                if (state.customItemEditorIndex != null && state.customItemEditorIndex !== openIndex) {
                    collectCustomItemFromForm(root, state, state.customItemEditorIndex, opts);
                }
                state.customItemEditorIndex = openIndex;
                if (typeof onRefresh === 'function') onRefresh(root);
                break;
            }
            case actions.closeEditor: {
                const discard = el.dataset.discard === 'true';
                if (!discard && state.customItemEditorIndex != null) {
                    collectCustomItemFromForm(root, state, state.customItemEditorIndex, opts);
                }
                state.customItemEditorIndex = null;
                if (typeof onRefresh === 'function') onRefresh(root);
                break;
            }
            case actions.addItem: {
                collectCustomItemsFromForm(root, state, opts);
                state.customItems.push(createBlankCustomItem());
                state.customItemEditorIndex = state.customItems.length - 1;
                if (typeof onRefresh === 'function') onRefresh(root);
                break;
            }
            case actions.removeItem: {
                const removeIndex = parseInt(el.dataset.itemIndex, 10);
                if (state.customItems.length <= 1 || Number.isNaN(removeIndex)) break;
                if (state.customItemEditorIndex === removeIndex) {
                    collectCustomItemFromForm(root, state, removeIndex, opts);
                } else {
                    collectCustomItemsFromForm(root, state, opts);
                }
                const itemToRemove = state.customItems[removeIndex];
                if (hasCustomItemContent(itemToRemove) && !confirm('Are you sure you want to remove this item?')) {
                    break;
                }
                state.customItems.splice(removeIndex, 1);
                reindexCustomItemAdditionalExpanded(state, removeIndex);
                if (state.customItemEditorIndex === removeIndex) {
                    state.customItemEditorIndex = null;
                } else if (state.customItemEditorIndex > removeIndex) {
                    state.customItemEditorIndex -= 1;
                }
                if (typeof onRefresh === 'function') onRefresh(root);
                break;
            }
            case actions.toggleImages: {
                const toggleIndex = parseInt(el.dataset.itemIndex, 10);
                if (Number.isNaN(toggleIndex)) break;
                collectCustomItemFromForm(root, state, toggleIndex, opts);
                if (!state.customItemAdditionalExpanded) state.customItemAdditionalExpanded = {};
                const item = state.customItems[toggleIndex];
                const currentlyExpanded = isCustomItemAdditionalExpanded(state, toggleIndex, item);
                state.customItemAdditionalExpanded[toggleIndex] = !currentlyExpanded;
                if (typeof onRefresh === 'function') onRefresh(root);
                break;
            }
            default:
                break;
        }
    }

    window.KefinHomeScreenCustomItemsEditor = {
        CUSTOM_IMAGE_FIELDS,
        createBlankCustomItem,
        staticItemToDraft,
        staticItemsToDrafts,
        ensureCustomItemsInitialized,
        hasValidCustomItems,
        hasCustomItemContent,
        buildStaticItemFromDraft,
        collectCustomItemsFromForm,
        collectCustomItemFromForm,
        renderCustomItemsHTML,
        refreshPreviews,
        handleAction,
        reindexCustomItemAdditionalExpanded,
        getCustomItemsOptions: (overrides = {}) => getOptions({
            idPrefix: 'hsae-custom',
            actionAttr: 'data-hsae-action',
            actions: {
                openEditor: 'hsae-open-custom-item-editor',
                closeEditor: 'hsae-close-custom-item-editor',
                addItem: 'hsae-add-custom-item',
                removeItem: 'hsae-remove-custom-item',
                toggleImages: 'hsae-toggle-custom-images'
            },
            ...overrides
        })
    };
})();
