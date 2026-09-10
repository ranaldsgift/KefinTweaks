// KefinTweaks Item Version Preferences Configuration UI

(function () {
    'use strict';

    const LOG = (...args) => console.log('[KefinTweaks VersionPreferences Config]', ...args);
    const ERR = (...args) => console.error('[KefinTweaks VersionPreferences Config]', ...args);

    const MODAL_ID = 'kefin-versionpreferences-config';
    const NONE_SENTINEL = 'None';

    const DEFAULT_VERSIONS = ['4k', '2160p', '1080p', '720p', '576p', '480p', '360p', NONE_SENTINEL];
    const DEFAULT_EDITIONS = ['Theatrical', "Director's Cut", 'Extended Edition', 'Fan Edit', NONE_SENTINEL];

    function escapeHtml(str) {
        return String(str ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    function isNoneSentinel(term) {
        return typeof term === 'string' && term.trim().toLowerCase() === NONE_SENTINEL.toLowerCase();
    }

    function ensureNoneSentinel(list) {
        const out = [];
        let noneSeen = false;
        (Array.isArray(list) ? list : []).forEach((term) => {
            if (typeof term !== 'string' || !term.trim()) return;
            if (isNoneSentinel(term)) {
                if (!noneSeen) {
                    out.push(NONE_SENTINEL);
                    noneSeen = true;
                }
                return;
            }
            out.push(term.trim());
        });
        if (!noneSeen) out.push(NONE_SENTINEL);
        return out;
    }

    function getDefaults() {
        return {
            versions: DEFAULT_VERSIONS.slice(),
            editions: DEFAULT_EDITIONS.slice(),
            showVersionBeforeEdition: false
        };
    }

    async function loadConfig() {
        const defaults = getDefaults();
        const cfg = window.KefinTweaksConfig?.versionPreferences || {};
        return {
            versions: ensureNoneSentinel(
                Array.isArray(cfg.versions) ? cfg.versions : defaults.versions
            ),
            editions: ensureNoneSentinel(
                Array.isArray(cfg.editions) ? cfg.editions : defaults.editions
            ),
            showVersionBeforeEdition: cfg.showVersionBeforeEdition === true
        };
    }

    async function saveConfig(versionPreferences) {
        try {
            if (!window.KefinTweaksConfig) {
                window.KefinTweaksConfig = {};
            }
            window.KefinTweaksConfig.versionPreferences = {
                versions: ensureNoneSentinel(versionPreferences.versions),
                editions: ensureNoneSentinel(versionPreferences.editions),
                showVersionBeforeEdition: versionPreferences.showVersionBeforeEdition === true
            };

            if (window.KefinTweaksUtils?.saveConfigToJavaScriptInjector) {
                await window.KefinTweaksUtils.saveConfigToJavaScriptInjector();
                LOG('Configuration saved to JS Injector');
                return true;
            }

            if (window.KefinTweaksConfiguration?.findJavaScriptInjectorPlugin) {
                const pluginId = await window.KefinTweaksConfiguration.findJavaScriptInjectorPlugin();
                if (pluginId) {
                    await window.KefinTweaksConfiguration.saveConfigToJavaScriptInjector(window.KefinTweaksConfig);
                    LOG('Configuration saved to JS Injector (fallback)');
                    return true;
                }
            }

            ERR('saveConfigToJavaScriptInjector not available');
            return false;
        } catch (error) {
            ERR('Error saving config:', error);
            return false;
        }
    }

    function buildTermRowHTML(term, index, listKey) {
        const isNone = isNoneSentinel(term);
        const termCell = isNone
            ? `<span class="listItemBodyText kefin-vp-none-label" style="flex: 1; min-width: 0; font-weight: 600;"
                    data-list="${escapeHtml(listKey)}" data-index="${index}" data-term="${escapeHtml(NONE_SENTINEL)}">
                    ${escapeHtml(NONE_SENTINEL)}
                    <span class="listItemBodyText secondary" style="font-weight: 400; font-size: 0.85em; margin-left: 0.5em;">(no match)</span>
               </span>`
            : `<input type="text" class="emby-input kefin-vp-term-input" value="${escapeHtml(term)}"
                    data-list="${escapeHtml(listKey)}" data-index="${index}"
                    style="flex: 1; min-width: 0;" aria-label="Term ${index + 1}" />`;

        const removeBtn = isNone
            ? ''
            : `<button type="button" class="emby-button raised kefin-vp-remove" data-list="${escapeHtml(listKey)}" data-index="${index}"
                    title="Remove" style="min-width: auto; padding: 0.35em 0.5em;">
                    <span class="material-icons" style="font-size: 1.1em; vertical-align: middle;">delete</span>
                </button>`;

        return `
            <div class="listItem kefin-vp-term-row${isNone ? ' kefin-vp-none-row' : ''}"
                data-list="${escapeHtml(listKey)}" data-index="${index}" data-is-none="${isNone ? 'true' : 'false'}"
                style="border: 1px solid rgba(255,255,255,0.1); border-radius: 4px; padding: 0.5em 0.65em; margin-bottom: 0.4em; display: flex; align-items: center; gap: 0.5em;${isNone ? ' background: rgba(255,255,255,0.04);' : ''}">
                <span class="listItemBodyText secondary" style="min-width: 1.5em; text-align: right;">${index + 1}.</span>
                ${termCell}
                <button type="button" class="emby-button raised kefin-vp-move-up" data-list="${escapeHtml(listKey)}" data-index="${index}"
                    title="Move up" style="min-width: auto; padding: 0.35em 0.5em;" ${index === 0 ? 'disabled' : ''}>
                    <span class="material-icons" style="font-size: 1.1em; vertical-align: middle;">arrow_upward</span>
                </button>
                <button type="button" class="emby-button raised kefin-vp-move-down" data-list="${escapeHtml(listKey)}" data-index="${index}"
                    title="Move down" style="min-width: auto; padding: 0.35em 0.5em;">
                    <span class="material-icons" style="font-size: 1.1em; vertical-align: middle;">arrow_downward</span>
                </button>
                ${removeBtn}
            </div>
        `;
    }

    function buildListSectionHTML(title, hint, listKey, terms) {
        return `
            <div class="listItem kefin-vp-list-section" style="border: 1px solid rgba(255,255,255,0.1); border-radius: 4px; padding: 0.75em; margin: 0; min-width: 0;">
                <div class="listItemContent">
                    <div class="listItemBodyText" style="margin-bottom: 0.35em; font-weight: 500;">${escapeHtml(title)}</div>
                    <div class="listItemBodyText secondary" style="margin-bottom: 0.5em; font-size: 0.9em;">${escapeHtml(hint)}</div>
                    <div class="listItemBodyText secondary" style="margin-bottom: 0.75em; font-size: 0.85em;">
                        None = sources with no matching terms in this list. It cannot be edited or deleted, but you can change its priority.
                    </div>
                    <div class="kefin-vp-term-list" data-list="${escapeHtml(listKey)}">
                        ${terms.map((term, i) => buildTermRowHTML(term, i, listKey)).join('')}
                    </div>
                    <div style="display: flex; gap: 0.5em; margin-top: 0.65em; flex-wrap: wrap;">
                        <input type="text" class="emby-input kefin-vp-add-input" data-list="${escapeHtml(listKey)}"
                            placeholder="Add a term…" style="flex: 1; min-width: 140px;" />
                        <button type="button" class="emby-button raised button-submit kefin-vp-add-btn" data-list="${escapeHtml(listKey)}">
                            Add
                        </button>
                    </div>
                </div>
            </div>
        `;
    }

    function ensureLayoutStyles() {
        if (document.getElementById('kefin-vp-config-styles')) return;
        const style = document.createElement('style');
        style.id = 'kefin-vp-config-styles';
        style.textContent = `
            .kefin-vp-lists-grid {
                display: grid;
                grid-template-columns: 1fr 1fr;
                gap: 1em;
                align-items: start;
                height: calc(100% - 40px);
            }
            @media (max-width: 900px) {
                .kefin-vp-lists-grid {
                    grid-template-columns: 1fr;
                }
            }
            [data-name="kefin-modal-content"]:has(.kefin-vp-lists-grid) > div {
                height: 100% !important;
            }

            [data-name="kefin-modal-content"]:has(.kefin-vp-lists-grid) > div > div {
                height: 100%;
            }
            .listItem.kefin-vp-list-section {
                height: calc(100% - 1.5em);
                align-items: start;
            }
            .kefin-vp-label-order-card {
                display: flex;
                align-items: center;
                gap: 1em;
                border: 1px solid rgba(255,255,255,0.1);
                border-radius: 4px;
                padding: 0.85em 1em;
                margin-bottom: 1em;
            }
            .kefin-vp-label-order-text {
                flex: 1;
                min-width: 0;
            }
            .kefin-vp-label-order-card .kefin-vp-toggle-switch {
                position: relative;
                width: 52px;
                height: 28px;
                border-radius: 14px;
                border: none;
                background: rgba(158, 158, 158, 0.5);
                cursor: pointer;
                flex-shrink: 0;
                padding: 0;
                transition: background-color 0.3s ease;
            }
            .kefin-vp-label-order-card .kefin-vp-toggle-switch[data-enabled="true"] {
                background: rgba(0, 164, 220, 0.8);
            }
            .kefin-vp-label-order-card .kefin-vp-toggle-switch::after {
                content: "";
                position: absolute;
                width: 22px;
                height: 22px;
                border-radius: 50%;
                background: white;
                top: 3px;
                left: 3px;
                transition: left 0.3s ease;
                box-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
            }
            .kefin-vp-label-order-card .kefin-vp-toggle-switch[data-enabled="true"]::after {
                left: calc(100% - 25px);
            }
        `;
        document.head.appendChild(style);
    }

    function getLabelOrderDescription(showVersionBeforeEdition) {
        return showVersionBeforeEdition
            ? 'Version will be listed before the edition (1080p - Theatrical)'
            : 'Edition will be listed before the version (Theatrical - 1080p)';
    }

    function buildLabelOrderToggleHTML(showVersionBeforeEdition) {
        const enabled = showVersionBeforeEdition === true;
        return `
            <div class="kefin-vp-label-order-card">
                <input type="checkbox" id="kefin-vp-show-version-before-edition" style="display: none;"
                    ${enabled ? 'checked' : ''} />
                <div class="kefin-vp-label-order-text">
                    <div class="listItemBodyText" style="font-weight: 500;">List Version Before Edition</div>
                    <div class="listItemBodyText secondary kefin-vp-label-order-desc" style="margin-top: 0.35em; font-size: 0.9em;">
                        ${escapeHtml(getLabelOrderDescription(enabled))}
                    </div>
                </div>
                <button type="button" class="kefin-vp-toggle-switch" data-checkbox-id="kefin-vp-show-version-before-edition"
                    data-enabled="${enabled}" aria-pressed="${enabled}"></button>
            </div>
        `;
    }

    function updateLabelOrderToggleUI(root, checked) {
        const checkbox = root.querySelector('#kefin-vp-show-version-before-edition');
        const toggleBtn = root.querySelector('.kefin-vp-toggle-switch');
        const desc = root.querySelector('.kefin-vp-label-order-desc');
        if (checkbox) checkbox.checked = checked === true;
        if (toggleBtn) {
            toggleBtn.dataset.enabled = checked === true;
            toggleBtn.setAttribute('aria-pressed', String(checked === true));
        }
        if (desc) desc.textContent = getLabelOrderDescription(checked === true);
    }

    function buildConfigHTML(config) {
        return `
            <div style="max-width: 100%;">
                <div class="listItemBodyText secondary" style="margin-bottom: 1em;">
                    Manage how different versions and editions of your items are displayed.
                    Terms are matched as case-insensitive substrings of the media source label.
                    Higher list positions are prioritized first.
                </div>
                ${buildLabelOrderToggleHTML(config.showVersionBeforeEdition)}
                <div class="kefin-vp-lists-grid">
                    ${buildListSectionHTML(
                        'Version Terms',
                        'Resolution / quality labels (e.g. 4k, 1080p). Order is priority.',
                        'versions',
                        config.versions
                    )}
                    ${buildListSectionHTML(
                        'Edition Terms',
                        'Edition labels (e.g. Theatrical, Director\'s Cut). Order is priority.',
                        'editions',
                        config.editions
                    )}
                </div>
            </div>
        `;
    }

    function readTermsFromDom(root, listKey) {
        const rows = root.querySelectorAll(`.kefin-vp-term-row[data-list="${listKey}"]`);
        const terms = [];
        rows.forEach((row) => {
            if (row.dataset.isNone === 'true') {
                terms.push(NONE_SENTINEL);
                return;
            }
            const input = row.querySelector('.kefin-vp-term-input');
            const value = input?.value?.trim();
            if (value) terms.push(value);
        });
        return ensureNoneSentinel(terms);
    }

    function syncStateFromDom(root, state) {
        state.versions = readTermsFromDom(root, 'versions');
        state.editions = readTermsFromDom(root, 'editions');
        const checkbox = root.querySelector('#kefin-vp-show-version-before-edition');
        state.showVersionBeforeEdition = checkbox?.checked === true;
    }

    function refreshList(root, state, listKey) {
        const listEl = root.querySelector(`.kefin-vp-term-list[data-list="${listKey}"]`);
        if (!listEl) return;
        state[listKey] = ensureNoneSentinel(state[listKey] || []);
        const terms = state[listKey];
        listEl.innerHTML = terms.map((term, i) => buildTermRowHTML(term, i, listKey)).join('');
        const rows = listEl.querySelectorAll('.kefin-vp-term-row');
        rows.forEach((row, i) => {
            const down = row.querySelector('.kefin-vp-move-down');
            if (down) down.disabled = i === rows.length - 1;
            const up = row.querySelector('.kefin-vp-move-up');
            if (up) up.disabled = i === 0;
        });
    }

    function collectConfig(root) {
        return {
            versions: readTermsFromDom(root, 'versions'),
            editions: readTermsFromDom(root, 'editions'),
            showVersionBeforeEdition: root.querySelector('#kefin-vp-show-version-before-edition')?.checked === true
        };
    }

    function bindLabelOrderToggle(root, state) {
        root.addEventListener('click', (e) => {
            const toggleBtn = e.target.closest('.kefin-vp-toggle-switch');
            if (!toggleBtn || !root.contains(toggleBtn)) return;
            e.preventDefault();
            const checkbox = root.querySelector('#kefin-vp-show-version-before-edition');
            if (!checkbox) return;
            checkbox.checked = !checkbox.checked;
            state.showVersionBeforeEdition = checkbox.checked;
            updateLabelOrderToggleUI(root, checkbox.checked);
        });
    }

    function bindListActions(root, state) {
        root.addEventListener('click', (e) => {
            const addBtn = e.target.closest('.kefin-vp-add-btn');
            if (addBtn) {
                const listKey = addBtn.dataset.list;
                const input = root.querySelector(`.kefin-vp-add-input[data-list="${listKey}"]`);
                const term = input?.value?.trim();
                if (!term) return;
                if (isNoneSentinel(term)) {
                    window.KefinTweaksToaster?.toast?.('"None" is a built-in priority slot and cannot be added as a term.');
                    if (input) input.value = '';
                    return;
                }
                syncStateFromDom(root, state);
                state[listKey].push(term);
                state[listKey] = ensureNoneSentinel(state[listKey]);
                if (input) input.value = '';
                refreshList(root, state, listKey);
                return;
            }

            const removeBtn = e.target.closest('.kefin-vp-remove');
            if (removeBtn) {
                const listKey = removeBtn.dataset.list;
                const index = parseInt(removeBtn.dataset.index, 10);
                syncStateFromDom(root, state);
                if (Number.isNaN(index)) return;
                if (isNoneSentinel(state[listKey][index])) return;
                state[listKey].splice(index, 1);
                state[listKey] = ensureNoneSentinel(state[listKey]);
                refreshList(root, state, listKey);
                return;
            }

            const upBtn = e.target.closest('.kefin-vp-move-up');
            if (upBtn) {
                const listKey = upBtn.dataset.list;
                const index = parseInt(upBtn.dataset.index, 10);
                syncStateFromDom(root, state);
                if (Number.isNaN(index) || index <= 0) return;
                const list = state[listKey];
                [list[index - 1], list[index]] = [list[index], list[index - 1]];
                refreshList(root, state, listKey);
                return;
            }

            const downBtn = e.target.closest('.kefin-vp-move-down');
            if (downBtn) {
                const listKey = downBtn.dataset.list;
                const index = parseInt(downBtn.dataset.index, 10);
                syncStateFromDom(root, state);
                if (Number.isNaN(index) || index >= state[listKey].length - 1) return;
                const list = state[listKey];
                [list[index], list[index + 1]] = [list[index + 1], list[index]];
                refreshList(root, state, listKey);
            }
        });

        root.addEventListener('keydown', (e) => {
            if (e.key !== 'Enter') return;
            const addInput = e.target.closest('.kefin-vp-add-input');
            if (!addInput) return;
            e.preventDefault();
            const listKey = addInput.dataset.list;
            const btn = root.querySelector(`.kefin-vp-add-btn[data-list="${listKey}"]`);
            btn?.click();
        });
    }

    async function openConfigModal() {
        try {
            ensureLayoutStyles();
            const config = await loadConfig();
            const state = {
                versions: config.versions.slice(),
                editions: config.editions.slice(),
                showVersionBeforeEdition: config.showVersionBeforeEdition === true
            };

            const content = document.createElement('div');
            content.innerHTML = buildConfigHTML(state);
            bindLabelOrderToggle(content, state);
            bindListActions(content, state);
            refreshList(content, state, 'versions');
            refreshList(content, state, 'editions');

            const footer = document.createElement('div');
            footer.style.display = 'flex';
            footer.style.gap = '0.75em';
            footer.style.justifyContent = 'flex-end';
            footer.innerHTML = `
                <button class="emby-button raised" onclick="window.ModalSystem.close('${MODAL_ID}')">Close</button>
                <button class="emby-button raised block button-submit" id="save-versionpreferences-config-btn">Save</button>
            `;

            const modalInstance = window.ModalSystem.create({
                id: MODAL_ID,
                title: 'Item Version Preferences',
                content,
                footer,
                closeOnBackdrop: true,
                closeOnEscape: true,
                showCloseButton: true,
                onOpen: (modal) => {
                    const saveBtn = modal.dialogFooter.querySelector('#save-versionpreferences-config-btn');
                    saveBtn?.addEventListener('click', async () => {
                        const root = modal.dialogContent || content;
                        syncStateFromDom(root, state);
                        const toSave = collectConfig(root);
                        const success = await saveConfig(toSave);
                        if (success) {
                            window.KefinTweaksToaster?.toast?.('Configuration saved!');
                            window.ModalSystem.close(MODAL_ID);
                        } else {
                            alert('Error saving configuration. Please ensure the JavaScript Injector plugin is installed and you have administrator permissions.');
                        }
                    });
                }
            });

            if (window.innerWidth >= 900) {
                modalInstance.dialog.style.maxWidth = '90vw';
                modalInstance.dialog.style.width = '1400px';
                modalInstance.dialog.style.height = '90vh';
            }

            LOG('Version Preferences configuration modal opened');
        } catch (error) {
            ERR('Error opening version preferences config modal:', error);
            alert('Error opening configuration: ' + error.message);
        }
    }

    window.KefinTweaksFeatureConfigs = window.KefinTweaksFeatureConfigs || {};
    window.KefinTweaksFeatureConfigs.versionPreferences = { openConfigModal };

    console.log('[KefinTweaks VersionPreferences Config] Script loaded');
})();
