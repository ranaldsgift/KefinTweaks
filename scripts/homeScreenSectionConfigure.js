// Inline home section configure popover
(function() {
    'use strict';

    const LOG = (...args) => console.log('[KefinTweaks HomeSectionConfigure]', ...args);
    const WARN = (...args) => console.warn('[KefinTweaks HomeSectionConfigure]', ...args);

    const runtime = new Map();
    let activePopover = null;
    let saveTimeout = null;
    let pendingHomeScreen = null;
    const pendingSaves = new Map();
    /** @type {{ entry: object, parent: Node, nextSibling: Node|null, serverDefaults: object }|null} */
    let pendingHideStash = null;
    const OPTION_MENU_MODAL_ID = 'kefin-section-option-menu';
    const CARD_TITLE_MENU_MODAL_ID = 'kefin-section-card-title-menu';
    const RESTORE_SECTION_MODAL_ID = 'kefin-section-restore-defaults';
    const PUBLISH_SECTION_MODAL_ID = 'kefin-section-publish-defaults';

    /** True when the current pointer gesture started inside a Pickr app (drag may end outside). */
    let pickrGestureFromApp = false;

    function isPickrAppEventTarget(target) {
        return !!target?.closest?.('.pcr-app, .kefin-pickr-app');
    }

    function onPickrGesturePointerDown(e) {
        if (!activePopover) return;
        pickrGestureFromApp = isPickrAppEventTarget(e.target);
    }

    function onPickrGesturePointerUp() {
        if (!activePopover) {
            pickrGestureFromApp = false;
            return;
        }
        // click fires after mouseup/pointerup; clear after that turn so capture click still sees the flag
        setTimeout(() => {
            pickrGestureFromApp = false;
        }, 0);
    }

    /**
     * Drag in Pickr + release outside synthesizes a click whose target is outside .pcr-app.
     * Stop that click so configure outsideHandler and Pickr's own dismiss do not run.
     */
    function onPickrGestureClickCapture(e) {
        if (!activePopover || !pickrGestureFromApp) return;
        if (isPickrAppEventTarget(e.target)) return;
        e.stopImmediatePropagation();
        e.preventDefault();
    }

    document.addEventListener('pointerdown', onPickrGesturePointerDown, true);
    document.addEventListener('pointerup', onPickrGesturePointerUp, true);
    document.addEventListener('pointercancel', onPickrGesturePointerUp, true);
    document.addEventListener('click', onPickrGestureClickCapture, true);

    /** Accept hex (3/4/6/8), rgb(a), hsl(a), or other non-empty CSS color strings. */
    function isCssColorString(value) {
        if (value == null) return false;
        const v = String(value).trim();
        if (!v) return false;
        return /^(#([0-9A-Fa-f]{3,4}|[0-9A-Fa-f]{6}|[0-9A-Fa-f]{8})|rgba?\(|hsla?\(|[a-zA-Z][\w-]*)$/i.test(v)
            || /^(rgb|hsl)a?\(/i.test(v);
    }

    function destroyPickrInstance(pickr) {
        if (!pickr) return;
        try {
            // Prefer destroy() — destroyAndRemove() can delete useAsButton trigger nodes.
            if (typeof pickr.destroy === 'function') pickr.destroy();
            else if (typeof pickr.destroyAndRemove === 'function') pickr.destroyAndRemove();
        } catch (_) { /* ignore */ }
        // Remove any orphaned Pickr apps left after a hard close mid-interaction.
        document.querySelectorAll('.pcr-app.kefin-pickr-app').forEach((el) => {
            try { el.remove(); } catch (__) { /* ignore */ }
        });
    }

    /**
     * Create a nano-theme Pickr on el. Returns null if Pickr is unavailable.
     * @param {HTMLElement} el
     * @param {{ defaultColor?: string, useAsButton?: boolean, onChange?: (css: string) => void, onSave?: (css: string) => void }} opts
     */
    function createPickrInstance(el, opts = {}) {
        if (!el || typeof window.Pickr?.create !== 'function') {
            WARN('Pickr unavailable');
            return null;
        }
        // Pickr needs a laid-out anchor; zero-size / detached hosts crash in _rePositioningPicker.
        if (!el.isConnected) {
            WARN('Pickr host is not connected');
            return null;
        }
        const defaultColor = isCssColorString(opts.defaultColor) ? String(opts.defaultColor).trim() : '#e8dab2';
        let pickr;
        try {
            pickr = window.Pickr.create({
                el,
                theme: 'nano',
                default: defaultColor,
                defaultRepresentation: 'HEXA',
                useAsButton: opts.useAsButton === true,
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
        } catch (error) {
            WARN('Pickr.create failed', error);
            return null;
        }

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

        pickr.on('change', (color) => {
            const css = toCss(color);
            if (css) opts.onChange?.(css);
        });
        pickr.on('save', (color) => {
            const css = toCss(color);
            if (css) opts.onSave?.(css);
            pickr.hide();
        });

        // Keep our anchored menus from eating Pickr clicks (transparent modal backdrop / outside handler).
        if (typeof opts.onShow === 'function' || typeof opts.onHide === 'function') {
            pickr.on('show', () => opts.onShow?.(pickr));
            pickr.on('hide', () => opts.onHide?.(pickr));
        }

        return pickr;
    }

    function setAnchoredMenuBackdropPassThrough(modalInstance, passThrough) {
        if (!modalInstance) return;
        if (modalInstance.backdrop) {
            modalInstance.backdrop.style.pointerEvents = passThrough ? 'none' : '';
        }
        if (modalInstance.dialogContainer) {
            // Anchored menus already use none; when Pickr is open keep that and ensure it stays none.
            if (passThrough) modalInstance.dialogContainer.style.pointerEvents = 'none';
        }
    }

    function getUserSettings() {
        return window.KefinTweaksConfig?.homeScreenConfig?.USER_HOME_SCREEN_SETTINGS || {};
    }

    function isEnabled() {
        return getUserSettings().inlineConfigure !== false;
    }

    function getConfigApi() {
        return window.KefinUserHomeScreenConfig;
    }

    function getCachePresetOptions() {
        const presets = window.KefinHomeScreenAdvancedEditor?.getCachePresets?.()
            || buildFallbackCachePresets();
        return presets.filter(p => p.key !== 'CUSTOM' && p.ms != null && Number.isFinite(Number(p.ms)));
    }

    function findCachePresetForTtl(ttl) {
        if (ttl == null || ttl === '') return null;
        const ttlNum = Number(ttl);
        if (!Number.isFinite(ttlNum)) return null;
        const presets = getCachePresetOptions();
        const exact = presets.find(p => Number(p.ms) === ttlNum);
        if (exact) return exact;

        // Same human label as a preset (e.g. both round to "6 hours") → treat as that preset.
        // Prefer the closest ms when multiple presets share a label.
        const label = formatDurationLabel(ttlNum);
        const sameLabel = presets.filter(p => formatDurationLabel(Number(p.ms)) === label);
        if (!sameLabel.length) return null;
        return sameLabel.reduce((best, p) => (
            Math.abs(Number(p.ms) - ttlNum) < Math.abs(Number(best.ms) - ttlNum) ? p : best
        ));
    }

    function buildCacheSelectOptionsHtml(currentTtl) {
        const presets = getCachePresetOptions();
        const matched = findCachePresetForTtl(currentTtl);
        const ttlNum = currentTtl == null || currentTtl === '' ? NaN : Number(currentTtl);
        let html = presets
            .map((preset) => {
                const selected = matched && Number(preset.ms) === Number(matched.ms) ? ' selected' : '';
                return `<option value="${Number(preset.ms)}"${selected}>${escapeHtml(formatDurationLabel(preset.ms))}</option>`;
            })
            .join('');
        // Only show Custom when the value doesn't correspond to any preset (exact or same label).
        if (Number.isFinite(ttlNum) && !matched) {
            html += `<option value="${ttlNum}" selected>Custom (${escapeHtml(formatDurationLabel(ttlNum))})</option>`;
        }
        return html;
    }

    function buildFallbackCachePresets() {
        const cache = window.KefinHomeConfig2?.CACHE || {};
        return [
            { key: 'FORCE_REFRESH', label: 'No Cache', ms: cache.FORCE_REFRESH_TTL ?? 0 },
            { key: 'VERY_SHORT', label: 'Very Short (1 min)', ms: cache.VERY_SHORT_TTL ?? 60000 },
            { key: 'SHORT', label: 'Short (5 min)', ms: cache.SHORT_TTL ?? 300000 },
            { key: 'DEFAULT', label: 'Default (1 hour)', ms: cache.DEFAULT_TTL ?? 3600000 },
            { key: 'LONG', label: 'Long (24 hours)', ms: cache.LONG_TTL ?? 86400000 },
            { key: 'STATIC', label: 'Static (1 week)', ms: cache.STATIC_TTL ?? 604800000 },
            { key: 'DISCOVERY', label: 'Discovery (6 hours)', ms: cache.DISCOVERY_TTL ?? 21600000 }
        ];
    }

    function pluralUnit(count, singular, plural) {
        return count === 1 ? singular : plural;
    }

    function formatDurationLabel(ms) {
        if (ms == null) return 'Default';
        if (ms === 0) return 'No Cache';
        if (ms < 60000) {
            const n = Math.round(ms / 1000);
            return `${n} ${pluralUnit(n, 'second', 'seconds')}`;
        }
        if (ms < 3600000) {
            const n = Math.round(ms / 60000);
            return `${n} ${pluralUnit(n, 'minute', 'minutes')}`;
        }
        if (ms < 86400000) {
            const n = Math.round(ms / 3600000);
            return `${n} ${pluralUnit(n, 'hour', 'hours')}`;
        }
        const n = Math.round(ms / 86400000);
        return `${n} ${pluralUnit(n, 'day', 'days')}`;
    }

    function buildMinimalToggleSwitch(id, checked) {
        if (window.KefinTweaksUI?.buildToggleSlider) {
            return window.KefinTweaksUI.buildToggleSlider(id, checked, '', {
                includeHiddenCheckbox: true,
                wrapInLabel: false,
                cssClass: 'kefin-toggle-switch',
                knob: 'css'
            });
        }
        const isEnabled = checked !== false;
        const safeId = escapeHtml(id);
        return `
            <input type="checkbox" id="${safeId}" ${isEnabled ? 'checked' : ''} style="display:none;">
            <button type="button" class="kefin-toggle-switch" data-checkbox-id="${safeId}" data-enabled="${isEnabled}" aria-pressed="${isEnabled}"></button>
        `;
    }

    function bindToggleSwitch(toggleBtn, onChange) {
        if (!toggleBtn) return;
        toggleBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            const next = toggleBtn.getAttribute('data-enabled') !== 'true';
            if (window.KefinTweaksUI?.updateToggleSwitchUI) {
                window.KefinTweaksUI.updateToggleSwitchUI(toggleBtn, next);
            } else {
                toggleBtn.dataset.enabled = String(next);
                toggleBtn.setAttribute('aria-pressed', String(next));
                const checkboxId = toggleBtn.dataset.checkboxId;
                if (checkboxId) {
                    const checkbox = document.getElementById(checkboxId);
                    if (checkbox) checkbox.checked = next;
                }
            }
            onChange(next);
        });
    }

    function registerRuntime(entry) {
        runtime.set(entry.sectionId, entry);
    }

    function getRuntime(sectionId) {
        return runtime.get(sectionId);
    }

    function updateRuntimeItemsLayout(sectionId, layout) {
        const entry = getRuntime(sectionId);
        if (!entry?.effectiveConfig) return;
        const resolved = layout === 'grid' ? 'grid'
            : (layout === true ? 'grid' : 'row');
        if (resolved === 'row') {
            delete entry.effectiveConfig.itemsLayout;
            delete entry.effectiveConfig.gridExpanded;
        } else {
            entry.effectiveConfig.itemsLayout = resolved;
            entry.effectiveConfig.gridExpanded = true;
        }
    }

    function updateRuntimeUseGaplessCards(sectionId, useGaplessCards) {
        const entry = getRuntime(sectionId);
        if (!entry?.effectiveConfig) return;
        if (useGaplessCards === true) entry.effectiveConfig.useGaplessCards = true;
        else delete entry.effectiveConfig.useGaplessCards;
    }

    /** @deprecated Use updateRuntimeItemsLayout */
    function updateRuntimeGridExpanded(sectionId, expanded) {
        updateRuntimeItemsLayout(sectionId, expanded === true ? 'grid' : 'row');
    }

    window.KefinHomeScreenSectionRuntime = {
        register: registerRuntime,
        get: getRuntime,
        unregister(sectionId) { runtime.delete(sectionId); },
        getAll() { return [...runtime.values()]; }
    };

    async function loadHomeScreen() {
        if (pendingHomeScreen) return pendingHomeScreen;
        const api = getConfigApi();
        if (!window.userHelper?.getUserDisplayPreferences) {
            return api.createEmptyHomeScreen();
        }
        const { promise } = await window.userHelper.getUserDisplayPreferences();
        const displayPrefs = await promise;
        return api.parseKefinTweaksHomeScreen(displayPrefs?.CustomPrefs);
    }

    function buildPrefOverrides(cfg) {
        const spotlight = cfg.spotlightConfig || {};
        return {
            order: cfg.order,
            ttl: cfg.ttl,
            cardFormat: cfg.cardFormat,
            animationEnabled: spotlight.panAnimation,
            hideName: cfg.hideName === true,
            hideCardTitles: cfg.cardTitleVisibility === 'hidden' || cfg.hideCardTitles === true,
            cardTitlePosition: cfg.cardTitlePosition,
            borderStyle: cfg.borderStyle,
            borderColor: cfg.borderColor,
            spotlightLayout: spotlight.spotlightLayout,
            spotlightSize: spotlight.spotlightSize,
            spotlightTileCount: spotlight.tileCount,
            itemsLayout: cfg.itemsLayout === 'grid' || cfg.itemsLayout === 'row'
                ? cfg.itemsLayout
                : (cfg.gridExpanded === true ? 'grid' : 'row'),
            useGaplessCards: cfg.useGaplessCards === true,
            cardTitleCapitalization: cfg.cardTitleCapitalization,
            cardTitleFontFamily: cfg.cardTitleFontFamily,
            cardTitleFontSize: cfg.cardTitleFontSize,
            cardTitleColor: cfg.cardTitleColor
        };
    }

    function resolveStoredSectionPrefId(sectionId, effectiveConfig) {
        const api = getConfigApi();
        if (api?.getStoredSectionPrefId && effectiveConfig) {
            return api.getStoredSectionPrefId({ ...effectiveConfig, id: sectionId });
        }
        return sectionId;
    }

    function sectionHasUserOverrides(entry, serverDefaults) {
        const api = getConfigApi();
        const cfg = entry?.effectiveConfig;
        const defaults = serverDefaults || entry?.serverDefaults || {};
        if (!api?.serializeSectionPref || !cfg) return false;
        const prefStr = api.serializeSectionPref(
            resolveStoredSectionPrefId(entry.sectionId, cfg),
            cfg.enabled !== false,
            buildPrefOverrides(cfg),
            defaults
        );
        const parts = String(prefStr || '').split(';');
        if (parts[1] === 'false') return true;
        return parts.slice(2).some((part) => part !== '');
    }

    function applyServerDefaultsToConfig(cfg, defaults) {
        if (!cfg || !defaults) return;
        cfg.order = defaults.order;
        cfg.ttl = defaults.ttl;
        cfg.cardFormat = defaults.cardFormat;
        cfg.cardTitlePosition = defaults.cardTitlePosition;
        cfg.cardTitleCapitalization = defaults.cardTitleCapitalization;
        cfg.cardTitleFontFamily = defaults.cardTitleFontFamily;
        cfg.cardTitleFontSize = defaults.cardTitleFontSize;
        cfg.enabled = true;

        if (defaults.hideName) cfg.hideName = true;
        else delete cfg.hideName;

        if (defaults.hideCardTitles) {
            cfg.cardTitleVisibility = 'hidden';
            delete cfg.hideCardTitles;
        } else {
            delete cfg.cardTitleVisibility;
            delete cfg.hideCardTitles;
        }

        if (defaults.borderStyle) cfg.borderStyle = defaults.borderStyle;
        else delete cfg.borderStyle;

        if (defaults.borderColor) cfg.borderColor = defaults.borderColor;
        else delete cfg.borderColor;

        if (defaults.cardTitleColor) cfg.cardTitleColor = defaults.cardTitleColor;
        else delete cfg.cardTitleColor;

        if (defaults.itemsLayout && defaults.itemsLayout !== 'row') {
            cfg.itemsLayout = defaults.itemsLayout === 'grid' ? 'grid' : 'row';
            if (cfg.itemsLayout === 'grid') cfg.gridExpanded = true;
            else delete cfg.gridExpanded;
        } else {
            delete cfg.itemsLayout;
            delete cfg.gridExpanded;
        }

        if (defaults.useGaplessCards === true) cfg.useGaplessCards = true;
        else delete cfg.useGaplessCards;

        cfg.spotlightConfig = {
            ...(cfg.spotlightConfig || {}),
            panAnimation: defaults.animationEnabled !== false && defaults.panAnimation !== false,
            spotlightLayout: defaults.spotlightLayout ?? 'Border',
            spotlightSize: defaults.spotlightSize ?? 'normal',
            tileCount: defaults.spotlightTileCount || 1
        };
    }

    function syncRestoreDefaultsButton(btn, dirty) {
        if (!btn) return;
        btn.disabled = !dirty;
        btn.classList.toggle('is-disabled', !dirty);
        btn.setAttribute('aria-disabled', String(!dirty));
    }

    function openRestoreSectionDefaultsConfirm(onConfirm) {
        if (!window.ModalSystem?.create) {
            WARN('ModalSystem unavailable for restore confirm');
            return null;
        }
        closeCardTitleMenu();
        if (window.ModalSystem.isOpen?.(RESTORE_SECTION_MODAL_ID)) {
            window.ModalSystem.close(RESTORE_SECTION_MODAL_ID);
        }
        const modalId = RESTORE_SECTION_MODAL_ID;
        const content = `<p class="listItemBodyText">This will restore the default settings for this section. Would you like to continue?</p>`;
        const footer = `
            <button type="button" class="emby-button raised" onclick="window.ModalSystem.close('${modalId}')">Cancel</button>
            <button type="button" class="emby-button raised button-submit" id="kefin-section-restore-defaults-confirm">OK</button>
        `;
        return window.ModalSystem.create({
            id: modalId,
            title: 'Restore Defaults',
            content,
            footer,
            closeOnBackdrop: true,
            closeOnEscape: true,
            showCloseButton: true,
            onOpen: (modal) => {
                const confirmBtn = modal.dialogFooter?.querySelector('#kefin-section-restore-defaults-confirm');
                confirmBtn?.addEventListener('click', async () => {
                    confirmBtn.disabled = true;
                    try {
                        await onConfirm?.();
                        window.ModalSystem.close(modalId);
                    } catch (e) {
                        WARN('Failed to restore section defaults:', e);
                        confirmBtn.disabled = false;
                    }
                });
            }
        });
    }

    function openPublishSectionDefaultsConfirm({ onUpdate, onOk }) {
        if (!window.ModalSystem?.create) {
            WARN('ModalSystem unavailable for publish confirm');
            return null;
        }
        closeCardTitleMenu();
        if (window.ModalSystem.isOpen?.(PUBLISH_SECTION_MODAL_ID)) {
            window.ModalSystem.close(PUBLISH_SECTION_MODAL_ID);
        }
        const modalId = PUBLISH_SECTION_MODAL_ID;
        const content = `<p class="listItemBodyText">Apply these settings as the section's default?</p>`;
        const footer = `
            <button type="button" class="emby-button raised" onclick="window.ModalSystem.close('${modalId}')">Cancel</button>
            <button type="button" class="emby-button raised" id="kefin-section-publish-update" title="Apply these settings to all users.">Update</button>
            <button type="button" class="emby-button raised button-submit" id="kefin-section-publish-ok" title="Apply these settings to new users only.">OK</button>
        `;
        return window.ModalSystem.create({
            id: modalId,
            title: 'Publish Defaults',
            content,
            footer,
            closeOnBackdrop: true,
            closeOnEscape: true,
            showCloseButton: true,
            onOpen: (modal) => {
                const updateBtn = modal.dialogFooter?.querySelector('#kefin-section-publish-update');
                const okBtn = modal.dialogFooter?.querySelector('#kefin-section-publish-ok');
                const run = async (fn, btn) => {
                    if (updateBtn) updateBtn.disabled = true;
                    if (okBtn) okBtn.disabled = true;
                    try {
                        await fn?.();
                        window.ModalSystem.close(modalId);
                    } catch (e) {
                        WARN('Failed to publish section defaults:', e);
                        if (updateBtn) updateBtn.disabled = false;
                        if (okBtn) okBtn.disabled = false;
                    }
                };
                updateBtn?.addEventListener('click', () => run(onUpdate, updateBtn));
                okBtn?.addEventListener('click', () => run(onOk, okBtn));
            }
        });
    }

    async function restoreSectionToServerDefaults(entry, serverDefaults) {
        const defaults = serverDefaults || entry.serverDefaults || {};
        applyServerDefaultsToConfig(entry.effectiveConfig, defaults);

        pendingSaves.delete(entry.sectionId);
        clearTimeout(saveTimeout);
        saveTimeout = null;

        const api = getConfigApi();
        let homeScreen = await loadHomeScreen();
        if (pendingSaves.size > 0) {
            pendingSaves.forEach(({ effectiveConfig, serverDefaults: sd }, id) => {
                const prefStr = api.serializeSectionPref(
                    resolveStoredSectionPrefId(id, effectiveConfig),
                    effectiveConfig.enabled !== false,
                    buildPrefOverrides(effectiveConfig),
                    sd
                );
                homeScreen = api.upsertSectionPref(homeScreen, prefStr);
            });
            pendingSaves.clear();
        }
        const storedId = resolveStoredSectionPrefId(entry.sectionId, entry.effectiveConfig);
        homeScreen.sections = (homeScreen.sections || []).filter(
            (s) => api.parseSectionPrefString?.(s)?.id !== storedId
        );
        pendingHomeScreen = homeScreen;
        await api.saveKefinTweaksHomeScreen(homeScreen);
        pendingHomeScreen = null;

        if (entry.element && defaults.order != null) {
            entry.element.style.order = defaults.order;
            entry.element.dataset.order = String(defaults.order);
        }

        applyPresentationToElement(entry);
        rerenderSection(entry);
        closePopover();
    }

    function scheduleSave(sectionId, effectiveConfig, serverDefaults) {
        pendingSaves.set(sectionId, { effectiveConfig, serverDefaults });
        clearTimeout(saveTimeout);
        saveTimeout = setTimeout(async () => {
            const batch = new Map(pendingSaves);
            pendingSaves.clear();
            try {
                const api = getConfigApi();
                let homeScreen = await loadHomeScreen();
                batch.forEach(({ effectiveConfig, serverDefaults }, id) => {
                    const prefStr = api.serializeSectionPref(
                        resolveStoredSectionPrefId(id, effectiveConfig),
                        effectiveConfig.enabled !== false,
                        buildPrefOverrides(effectiveConfig),
                        serverDefaults
                    );
                    homeScreen = api.upsertSectionPref(homeScreen, prefStr);
                });
                pendingHomeScreen = homeScreen;
                await api.saveKefinTweaksHomeScreen(homeScreen);
                pendingHomeScreen = null;
            } catch (e) {
                WARN('Failed to save section preferences:', e);
            }
        }, 300);
    }

    const HIDE_NAME_DESCRIPTIONS = {
        on: 'The section name will not be visible.',
        off: 'The section name will be visible.'
    };

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

    function getEditorConstants() {
        return window.KefinHomeScreenEditorConstants || {};
    }

    function getCardFormats() {
        return getEditorConstants().CARD_FORMATS
            || ['Poster', 'Thumb', 'Series Thumb', 'Series Poster', 'Backdrop', 'Square', 'Random', 'Button', 'Banner', 'Logo', 'Clear Art', 'Disc'];
    }

    function getCardTitleHorizontalAlignOptions() {
        return [
            { value: 'default', label: 'Default' },
            { value: 'left', label: 'Left' },
            { value: 'center', label: 'Center' },
            { value: 'right', label: 'Right' }
        ];
    }

    function getCardTitleVerticalAlignOptions() {
        return [
            { value: 'default', label: 'Default' },
            { value: 'top', label: 'Top' },
            { value: 'center', label: 'Center' },
            { value: 'bottom', label: 'Bottom' }
        ];
    }

    function parseCardTitleAlign(position) {
        const p = position && String(position).trim() ? String(position).trim() : '';
        if (!p || p === 'default') {
            return { vertical: 'default', horizontal: 'default' };
        }
        if (!p.startsWith('overlay-')) {
            const horizontal = (p === 'left' || p === 'center' || p === 'right') ? p : 'default';
            return { vertical: 'default', horizontal };
        }
        const rest = p.slice('overlay-'.length);
        if (rest === 'center') {
            return { vertical: 'center', horizontal: 'center' };
        }
        const parts = rest.split('-');
        if (parts.length >= 2) {
            const vertical = parts[0];
            const horizontal = parts.slice(1).join('-');
            return {
                vertical: (vertical === 'top' || vertical === 'center' || vertical === 'bottom') ? vertical : 'default',
                horizontal: (horizontal === 'center' || horizontal === 'right') ? horizontal : 'left'
            };
        }
        return { vertical: 'default', horizontal: 'left' };
    }

    function composeCardTitlePosition(horizontal, vertical) {
        const v = (vertical === 'top' || vertical === 'center' || vertical === 'bottom') ? vertical : 'default';
        if (v === 'default') {
            if (horizontal === 'default' || !horizontal) return '';
            if (horizontal === 'left') return 'left';
            if (horizontal === 'center' || horizontal === 'right') return horizontal;
            return '';
        }
        const h = (horizontal === 'center' || horizontal === 'right') ? horizontal : 'left';
        if (v === 'center' && h === 'center') return 'overlay-center';
        return `overlay-${v}-${h}`;
    }

    function setCardTitlePositionFromAlign(cfg, horizontal, vertical) {
        let h = horizontal;
        const v = vertical;
        if (v !== 'default' && h === 'default') {
            h = 'left';
        }
        const next = composeCardTitlePosition(h, v);
        if (next) cfg.cardTitlePosition = next;
        else delete cfg.cardTitlePosition;
    }

    function getCardTitleCapitalizationOptions() {
        return [
            { value: 'normal', label: 'Normal' },
            { value: 'uppercase', label: 'Uppercase' },
            { value: 'lowercase', label: 'Lowercase' },
            { value: 'capitalize', label: 'Capitalize' }
        ];
    }

    function getCardTitleFontFamilyOptions() {
        return [
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
    }

    function getCardTitleFontSizeOptions() {
        return [
            { value: 'normal', label: 'Normal' },
            { value: 'small', label: 'Small' },
            { value: 'large', label: 'Large' }
        ];
    }

    function getSpotlightLayoutOptions() {
        return getEditorConstants().SPOTLIGHT_LAYOUT_OPTIONS || [
            { value: 'Border', label: 'Border' },
            { value: 'Borderless', label: 'Borderless' }
        ];
    }

    function getSpotlightSizeOptions() {
        return getEditorConstants().SPOTLIGHT_SIZE_OPTIONS || [
            { value: 'normal', label: 'Normal' },
            { value: 'large', label: 'Large' },
            { value: 'full', label: 'Full' }
        ];
    }

    function isSpotlightSection(cfg) {
        return cfg?.renderMode === 'Spotlight' || cfg?.spotlight === true;
    }

    function applyPresentationToElement(entry) {
        const cfg = entry.effectiveConfig;
        const el = entry.element;
        if (!el || !cfg) return;

        const titleContainer = el.querySelector('.sectionTitleContainer, .spotlight-section-title-container');
        if (titleContainer && titleContainer.style.display === 'none') {
            titleContainer.style.display = '';
        }
        if (cfg.hideName === true) {
            el.dataset.hideSectionName = 'true';
        } else {
            delete el.dataset.hideSectionName;
        }
        // Prefer the explicit attribute name used by CSS; clear any legacy attr.
        delete el.dataset.hideName;

        const hideTitles = cfg.cardTitleVisibility === 'hidden' || cfg.hideCardTitles === true;
        if (hideTitles) {
            el.dataset.cardTitleVisibility = 'hidden';
        } else {
            delete el.dataset.cardTitleVisibility;
        }

        if (cfg.borderStyle) {
            el.dataset.border = cfg.borderStyle;
            el.dataset.borderStyle = cfg.borderStyle;
        } else {
            delete el.dataset.border;
            delete el.dataset.borderStyle;
        }
        const borderColor = cfg.borderColor && String(cfg.borderColor).trim();
        if (borderColor) {
            el.style.setProperty('--kefin-card-border-color', borderColor);
        } else {
            el.style.removeProperty('--kefin-card-border-color');
        }
        if (window.cardBuilder?.ensureCardBorders) {
            window.cardBuilder.ensureCardBorders(el);
        }

        const titleColor = cfg.cardTitleColor && String(cfg.cardTitleColor).trim();
        if (titleColor) {
            el.style.setProperty('--kefin-card-title-color', titleColor);
        } else {
            el.style.removeProperty('--kefin-card-title-color');
        }

        if (cfg.cardTitlePosition) {
            el.dataset.cardTitlePosition = cfg.cardTitlePosition;
        } else {
            delete el.dataset.cardTitlePosition;
        }

        if (cfg.cardTitleCapitalization && cfg.cardTitleCapitalization !== 'normal') {
            el.dataset.cardTitleCapitalization = cfg.cardTitleCapitalization;
        } else {
            delete el.dataset.cardTitleCapitalization;
        }

        if (cfg.cardTitleFontFamily && cfg.cardTitleFontFamily !== 'default') {
            el.dataset.fontFamily = cfg.cardTitleFontFamily;
        } else {
            delete el.dataset.fontFamily;
        }

        if (cfg.cardTitleFontSize && cfg.cardTitleFontSize !== 'normal') {
            el.dataset.fontSize = cfg.cardTitleFontSize;
        } else {
            delete el.dataset.fontSize;
        }

        if (isSpotlightSection(cfg)) {
            const spotlight = cfg.spotlightConfig || {};
            if (spotlight.spotlightLayout) {
                el.dataset.layout = spotlight.spotlightLayout;
            }
            if (spotlight.spotlightSize) {
                el.dataset.size = spotlight.spotlightSize;
            }
            if (spotlight.tileCount != null) {
                el.dataset.tileCount = String(spotlight.tileCount);
            }
            el.querySelectorAll('.spotlight-overlay').forEach(overlay => {
                const hasVisibleTitle = cfg.hideName !== true
                    && !!el.querySelector('.spotlight-section-title');
                overlay.classList.toggle('has-title', hasVisibleTitle);
            });
        }
    }

    function replaceSectionElement(entry, newContent) {
        const cfg = entry.effectiveConfig;
        const isSpotlight = isSpotlightSection(cfg);
        let preservedLayout = null;
        let preservedGapless = null;
        if (!isSpotlight) {
            const oldItemsContainer = entry.element.querySelector('.itemsContainer');
            const layoutFromDom = oldItemsContainer?.getAttribute('data-layout');
            preservedLayout = (layoutFromDom === 'grid' || layoutFromDom === 'row')
                ? layoutFromDom
                : (window.cardBuilder?.resolveItemsLayout?.(cfg) || 'row');
            preservedGapless = oldItemsContainer?.getAttribute('data-gapless') === 'true'
                || cfg.useGaplessCards === true
                || window.cardBuilder?.resolveUseGaplessCards?.(cfg) === true;
        }

        newContent.style.cssText = entry.element.style.cssText;
        newContent.className = entry.element.className;
        Array.from(entry.element.attributes).forEach(attr => {
            newContent.setAttribute(attr.name, attr.value);
        });
        if (cfg.order != null) {
            newContent.dataset.order = String(cfg.order);
            newContent.style.order = cfg.order;
        }
        if (cfg.cardFormat) {
            newContent.setAttribute('data-card-format', cfg.cardFormat);
        }
        entry.element.replaceWith(newContent);
        entry.element = newContent;
        registerRuntime(entry);
        applyPresentationToElement(entry);

        if (!isSpotlight && window.cardBuilder?.applyItemsLayoutState) {
            window.cardBuilder.invalidateLastRowPadding?.(newContent.querySelector('.itemsContainer'));
            window.cardBuilder.applyItemsLayoutState(newContent, preservedLayout || 'row', !!preservedGapless);
        }

        const titleContainer = newContent.querySelector('.sectionTitleContainer, .spotlight-section-title-container');
        if (titleContainer && window.cardBuilder?.attachSectionControlButtons) {
            window.cardBuilder.attachSectionControlButtons(cfg, newContent, entry.cachedItems);
        }
        if (activePopover?.entry?.sectionId === entry.sectionId) {
            activePopover.entry = entry;
            activePopover.sectionElement = entry.element;
            activePopover.anchorButton = getConfigureAnchorButton(entry);
            const mountElement = preparePopoverMount(activePopover.anchorButton, entry.element);
            activePopover.mountElement = mountElement;
            if (activePopover.popover.parentElement !== mountElement) {
                mountElement.appendChild(activePopover.popover);
            }
            requestAnimationFrame(() => repositionActivePopover());
        }
    }

    function rerenderSection(entry) {
        const cfg = entry.effectiveConfig;
        const items = entry.cachedItems;
        if (!items?.length) {
            applyPresentationToElement(entry);
            return;
        }

        let newContent = null;
        if (isSpotlightSection(cfg) && window.cardBuilder?.renderSpotlightSection) {
            const activeSlide = entry.element?.querySelector('.spotlight-item[data-active]');
            const initialIndex = parseInt(activeSlide?.getAttribute('data-index'), 10);
            newContent = window.cardBuilder.renderSpotlightSection(items, cfg.name, {
                viewMoreUrl: cfg.viewMoreUrl,
                ...(cfg.spotlightConfig || {}),
                initialIndex: Number.isNaN(initialIndex) ? 0 : initialIndex
            });
        } else if (window.cardBuilder?.renderCards) {
            newContent = window.cardBuilder.renderCards(
                items,
                cfg.name,
                cfg.viewMoreUrl,
                cfg.overflowCard,
                cfg.cardFormat,
                null,
                'Ascending'
            );
        }
        if (!newContent) return;
        replaceSectionElement(entry, newContent);
    }

    function positionFormatMenu(menu, anchorButton) {
        const btnRect = anchorButton.getBoundingClientRect();
        const menuHeight = menu.offsetHeight;
        const gap = 4;
        const margin = 8;
        const spaceBelow = window.innerHeight - btnRect.bottom;
        const spaceAbove = btnRect.top;

        let top;
        if (spaceBelow >= menuHeight + gap || spaceBelow >= spaceAbove) {
            top = btnRect.bottom + gap;
        } else {
            top = btnRect.top - menuHeight - gap;
        }
        top = Math.min(Math.max(top, margin), window.innerHeight - menuHeight - margin);

        let left = btnRect.left;
        const maxLeft = window.innerWidth - menu.offsetWidth - margin;
        left = Math.min(Math.max(left, margin), maxLeft);

        menu.style.top = `${top}px`;
        menu.style.left = `${left}px`;
    }

    function styleAnchoredPopoverDialog(modal, anchorBtn) {
        if (!modal?.dialog || !anchorBtn) return;
        modal.dialog.classList.remove('centeredDialog', 'formDialog', 'smoothScrollY');
        modal.dialog.style.position = 'fixed';
        modal.dialog.style.margin = '0';
        modal.dialog.style.maxHeight = 'none';
        modal.dialog.style.minWidth = '8rem';
        modal.dialog.style.width = 'auto';
        modal.dialog.style.animation = '160ms ease-out 0s 1 normal both running scaleup';
        if (modal.dialogContent) {
            modal.dialogContent.style.padding = '0.25em 0';
            modal.dialogContent.style.overflow = 'hidden';
            modal.dialogContent.style.minHeight = '0';
        }
        if (modal.backdrop) {
            modal.backdrop.style.background = 'transparent';
        }
        if (modal.dialogContainer) {
            modal.dialogContainer.style.pointerEvents = 'none';
        }
        modal.dialog.style.pointerEvents = 'auto';
        requestAnimationFrame(() => positionFormatMenu(modal.dialog, anchorBtn));
    }

    function closeActiveFormatMenu() {
        if (window.ModalSystem?.isOpen?.(OPTION_MENU_MODAL_ID)) {
            window.ModalSystem.close(OPTION_MENU_MODAL_ID);
        }
        if (activePopover) {
            activePopover.formatMenu = null;
            activePopover.formatMenuAnchor = null;
            activePopover.formatMenuModalId = null;
        }
    }

    function closeCardTitleMenuOnly() {
        if (window.ModalSystem?.isOpen?.(CARD_TITLE_MENU_MODAL_ID)) {
            window.ModalSystem.close(CARD_TITLE_MENU_MODAL_ID);
        }
        if (activePopover) {
            activePopover.cardTitleMenu = null;
            activePopover.cardTitleMenuAnchor = null;
            activePopover.cardTitleMenuModalId = null;
        }
    }

    function closeCardTitleMenu() {
        closeActiveFormatMenu();
        closeCardTitleMenuOnly();
    }

    function trackFormatMenu(modal, anchorBtn, modalId) {
        if (!activePopover) return;
        activePopover.formatMenu = modal?.dialog || null;
        activePopover.formatMenuAnchor = anchorBtn;
        activePopover.formatMenuModalId = modalId;
        if (modal) {
            modal.onClose = () => {
                if (activePopover?.formatMenuModalId === modalId) {
                    activePopover.formatMenu = null;
                    activePopover.formatMenuAnchor = null;
                    activePopover.formatMenuModalId = null;
                }
            };
        }
    }

    function trackCardTitleMenu(modal, anchorBtn) {
        if (!activePopover) return;
        activePopover.cardTitleMenu = modal?.dialog || null;
        activePopover.cardTitleMenuAnchor = anchorBtn;
        activePopover.cardTitleMenuModalId = CARD_TITLE_MENU_MODAL_ID;
        if (modal) {
            modal.onClose = () => {
                closeActiveFormatMenu();
                if (activePopover?.cardTitleMenuModalId === CARD_TITLE_MENU_MODAL_ID) {
                    activePopover.cardTitleMenu = null;
                    activePopover.cardTitleMenuAnchor = null;
                    activePopover.cardTitleMenuModalId = null;
                }
            };
        }
    }

    /**
     * Anchored option menu (card format, border style, spotlight size/tiles) via ModalSystem.
     * @param {HTMLElement} anchorBtn
     * @param {Array<{value:string,label:string}>} options
     * @param {{
     *   activeValue?: string,
     *   onSelect: (value: string) => void,
     *   colorControls?: {
     *     value?: string,
     *     onChange: (value: string) => void,
     *     onClear: () => void
     *   }
     * }} opts
     */
    function openOptionMenu(anchorBtn, options, opts) {
        if (!window.ModalSystem?.create) {
            WARN('ModalSystem unavailable for option menu');
            return null;
        }
        closeActiveFormatMenu();
        if (!opts?.preserveCardTitleMenu) {
            closeCardTitleMenuOnly();
        }
        const active = opts?.activeValue != null ? String(opts.activeValue) : '';
        const colorControls = opts?.colorControls;
        const gaplessControls = opts?.gaplessControls;
        const colorEnabled = !!active;
        const colorValue = colorControls?.value && isCssColorString(colorControls.value)
            ? String(colorControls.value).trim()
            : '#e8dab2';

        const renderOption = (opt) => `
                    <button type="button" class="kefin-section-format-option${String(opt.value) === active ? ' is-active' : ''}" data-value="${escapeHtml(opt.value)}">
                        ${escapeHtml(opt.label)}
                    </button>`;

        let optionsHtml;
        if (colorControls) {
            const headerOpt = (options || [])[0];
            const listOpts = (options || []).slice(1);
            optionsHtml = `
                <div class="kefin-section-format-menu-header">
                    ${headerOpt ? renderOption(headerOpt) : ''}
                    <div class="kefin-section-format-color-row${colorEnabled ? '' : ' is-disabled'}">
                        <button type="button" class="kefin-section-color-swatch" title="Border color" aria-label="Border color" style="--kefin-swatch-color:${escapeHtml(colorValue)}"${colorEnabled ? '' : ' disabled'}></button>
                        <button type="button" class="paper-icon-button-light emby-button kefin-section-color-reset${colorControls.value ? '' : ' is-hidden'}" title="Reset border color" aria-label="Reset border color"${colorEnabled ? '' : ' disabled'}>
                            <span class="material-icons" aria-hidden="true">settings_backup_restore</span>
                        </button>
                    </div>
                </div>
                <div class="kefin-section-format-menu-options">
                    ${listOpts.map(renderOption).join('')}
                </div>`;
        } else if (gaplessControls) {
            const gaplessChecked = gaplessControls.value === true;
            optionsHtml = `
                <div class="kefin-section-format-menu-header">
                    <button type="button" class="kefin-section-format-option${active === '' ? ' is-active' : ''}" data-value="" data-kefin-format-default="true">
                        Default
                    </button>
                    <label class="kefin-section-format-gapless">
                        <input type="checkbox" class="kefin-section-format-gapless-input"${gaplessChecked ? ' checked' : ''}>
                        <span>No Gaps</span>
                    </label>
                </div>
                <div class="kefin-section-format-menu-options">
                    ${(options || []).map(renderOption).join('')}
                </div>`;
        } else {
            optionsHtml = (options || []).map(renderOption).join('');
        }

        const content = `
            <div class="kefin-section-format-menu-body${colorControls || gaplessControls ? ' has-color-controls' : ''}">
                ${optionsHtml}
            </div>
        `;

        let borderPickr = null;

        const modal = window.ModalSystem.create({
            id: OPTION_MENU_MODAL_ID,
            title: null,
            content,
            footer: null,
            showCloseButton: false,
            closeOnBackdrop: true,
            closeOnEscape: true,
            onOpen: (modalInstance) => {
                styleAnchoredPopoverDialog(modalInstance, anchorBtn);
                const root = modalInstance.dialogContent;
                const colorRow = root?.querySelector('.kefin-section-format-color-row');
                const colorSwatch = root?.querySelector('.kefin-section-color-swatch');
                const colorReset = root?.querySelector('.kefin-section-color-reset');

                const syncColorRowEnabled = (styleValue) => {
                    if (!colorRow) return;
                    const enabled = !!styleValue;
                    colorRow.classList.toggle('is-disabled', !enabled);
                    if (colorReset) colorReset.disabled = !enabled;
                    if (colorSwatch) colorSwatch.disabled = !enabled;
                    if (borderPickr) {
                        if (enabled) borderPickr.enable();
                        else borderPickr.disable();
                    }
                };

                const syncColorResetVisibility = (hasCustomColor) => {
                    colorReset?.classList.toggle('is-hidden', !hasCustomColor);
                };

                const setSwatchColor = (css) => {
                    if (colorSwatch) colorSwatch.style.setProperty('--kefin-swatch-color', css || '#e8dab2');
                };

                // Lazy-init Pickr on first swatch click so opening the menu never depends on Pickr layout.
                const ensureBorderPickr = () => {
                    if (borderPickr || !colorSwatch) return borderPickr;
                    borderPickr = createPickrInstance(colorSwatch, {
                        defaultColor: colorValue,
                        useAsButton: true,
                        onChange: (css) => {
                            setSwatchColor(css);
                            syncColorResetVisibility(true);
                            colorControls.onChange?.(css);
                        },
                        onSave: (css) => {
                            setSwatchColor(css);
                            syncColorResetVisibility(true);
                            colorControls.onChange?.(css);
                        },
                        onShow: () => setAnchoredMenuBackdropPassThrough(modalInstance, true),
                        onHide: () => setAnchoredMenuBackdropPassThrough(modalInstance, false)
                    });
                    if (!colorEnabled) borderPickr?.disable();
                    return borderPickr;
                };

                colorSwatch?.addEventListener('click', (ev) => {
                    ev.stopPropagation();
                    if (colorSwatch.disabled) return;
                    if (!borderPickr) {
                        const pickr = ensureBorderPickr();
                        // Same-event listeners added by Pickr won't run; open on next frame.
                        requestAnimationFrame(() => pickr?.show());
                    }
                    // After init, Pickr's useAsButton handler toggles open/close.
                });

                root?.querySelectorAll('.kefin-section-format-option').forEach((optionBtn) => {
                    optionBtn.addEventListener('click', (ev) => {
                        ev.stopPropagation();
                        const value = optionBtn.dataset.value ?? '';
                        root.querySelectorAll('.kefin-section-format-option').forEach((btn) => {
                            btn.classList.toggle('is-active', (btn.dataset.value ?? '') === value);
                        });
                        if (colorControls) {
                            syncColorRowEnabled(value);
                            if (!value) {
                                setSwatchColor('#e8dab2');
                                try { borderPickr?.setColor('#e8dab2', true); } catch (_) { /* ignore */ }
                                syncColorResetVisibility(false);
                            }
                        }
                        opts?.onSelect?.(value);
                    });
                });

                if (colorControls) {
                    colorReset?.addEventListener('click', (ev) => {
                        ev.stopPropagation();
                        if (colorReset.disabled) return;
                        setSwatchColor('#e8dab2');
                        try { borderPickr?.setColor('#e8dab2', true); } catch (_) { /* ignore */ }
                        syncColorResetVisibility(false);
                        colorControls.onClear?.();
                    });
                }

                const gaplessInput = root?.querySelector('.kefin-section-format-gapless-input');
                gaplessInput?.addEventListener('change', (ev) => {
                    ev.stopPropagation();
                    gaplessControls?.onChange?.(!!gaplessInput.checked);
                });
                gaplessInput?.addEventListener('click', (ev) => ev.stopPropagation());
            }
        });
        trackFormatMenu(modal, anchorBtn, OPTION_MENU_MODAL_ID);
        const prevFormatOnClose = modal.onClose;
        modal.onClose = () => {
            destroyPickrInstance(borderPickr);
            borderPickr = null;
            prevFormatOnClose?.();
        };
        return modal;
    }

    function areCardTitlesVisible(cfg) {
        return !(cfg?.cardTitleVisibility === 'hidden' || cfg?.hideCardTitles === true);
    }

    function syncCardTitleVisibilityButton(btn, visible) {
        if (!btn) return;
        const isOn = visible !== false;
        const icon = btn.querySelector('.material-icons');
        if (icon) icon.textContent = isOn ? 'visibility' : 'visibility_off';
        btn.classList.toggle('is-hidden-visibility', !isOn);
        const label = isOn ? 'Hide card titles' : 'Show card titles';
        btn.title = label;
        btn.setAttribute('aria-label', label);
        btn.setAttribute('aria-pressed', String(isOn));
    }

    /**
     * Anchored Card Title options menu: visibility + color, then nested icon option menus.
     */
    function openCardTitleOptionsMenu(anchorBtn, entry, serverDefaults) {
        if (!window.ModalSystem?.create) {
            WARN('ModalSystem unavailable for card title options');
            return null;
        }
        closeCardTitleMenu();

        const cfg = entry.effectiveConfig;
        const titlesVisible = areCardTitlesVisible(cfg);
        const titleColor = cfg.cardTitleColor && isCssColorString(cfg.cardTitleColor)
            ? String(cfg.cardTitleColor).trim()
            : '#ffffff';
        const hasCustomColor = !!(cfg.cardTitleColor && String(cfg.cardTitleColor).trim());

        const content = `
            <div class="kefin-section-card-title-menu-body">
                <div class="kefin-section-card-title-menu-icons">
                    <button type="button" is="paper-icon-button-light" class="paper-icon-button-light emby-button kefin-section-card-title-visibility-btn${titlesVisible ? '' : ' is-hidden-visibility'}" title="${titlesVisible ? 'Hide card titles' : 'Show card titles'}" aria-label="${titlesVisible ? 'Hide card titles' : 'Show card titles'}" aria-pressed="${titlesVisible}">
                        <span class="material-icons" aria-hidden="true">${titlesVisible ? 'visibility' : 'visibility_off'}</span>
                    </button>
                    <button type="button" is="paper-icon-button-light" class="paper-icon-button-light emby-button kefin-section-card-title-font-btn" title="Font Family" aria-label="Font Family">
                        <span class="material-icons" aria-hidden="true">font_download</span>
                    </button>
                    <button type="button" is="paper-icon-button-light" class="paper-icon-button-light emby-button kefin-section-card-title-size-btn" title="Size" aria-label="Size">
                        <span class="material-icons" aria-hidden="true">format_size</span>
                    </button>
                    <div class="kefin-section-format-color-row kefin-section-card-title-color-row${titlesVisible ? '' : ' is-disabled'}">
                        <button type="button" is="paper-icon-button-light" class="paper-icon-button-light emby-button kefin-section-card-title-color-btn" title="Font color" aria-label="Font color"${titlesVisible ? '' : ' disabled'}>
                            <span class="material-icons" aria-hidden="true">text_format</span>
                        </button>
                        <button type="button" class="paper-icon-button-light emby-button kefin-section-color-reset kefin-section-card-title-color-reset${hasCustomColor ? '' : ' is-hidden'}" title="Reset font color" aria-label="Reset font color"${titlesVisible ? '' : ' disabled'}>
                            <span class="material-icons" aria-hidden="true">settings_backup_restore</span>
                        </button>
                    </div>
                    <button type="button" is="paper-icon-button-light" class="paper-icon-button-light emby-button kefin-section-card-title-horizontal-btn" title="Horizontal align" aria-label="Horizontal align">
                        <span class="material-icons" aria-hidden="true">horizontal_distribute</span>
                    </button>
                    <button type="button" is="paper-icon-button-light" class="paper-icon-button-light emby-button kefin-section-card-title-vertical-btn" title="Vertical align" aria-label="Vertical align">
                        <span class="material-icons" aria-hidden="true">vertical_distribute</span>
                    </button>
                    <button type="button" is="paper-icon-button-light" class="paper-icon-button-light emby-button kefin-section-card-title-caps-btn" title="Capitalization" aria-label="Capitalization">
                        <span class="material-icons" aria-hidden="true">title</span>
                    </button>
                </div>
            </div>
        `;

        let titlePickr = null;

        const modal = window.ModalSystem.create({
            id: CARD_TITLE_MENU_MODAL_ID,
            title: null,
            content,
            footer: null,
            showCloseButton: false,
            closeOnBackdrop: true,
            closeOnEscape: true,
            onOpen: (modalInstance) => {
                styleAnchoredPopoverDialog(modalInstance, anchorBtn);
                const root = modalInstance.dialogContent;
                const visibilityBtn = root?.querySelector('.kefin-section-card-title-visibility-btn');
                const colorRow = root?.querySelector('.kefin-section-card-title-color-row');
                const colorBtn = root?.querySelector('.kefin-section-card-title-color-btn');
                const colorReset = root?.querySelector('.kefin-section-card-title-color-reset');

                const syncColorEnabled = (visible) => {
                    if (!colorRow || !colorReset) return;
                    colorRow.classList.toggle('is-disabled', !visible);
                    colorReset.disabled = !visible;
                    if (colorBtn) colorBtn.disabled = !visible;
                    if (titlePickr) {
                        if (visible) titlePickr.enable();
                        else titlePickr.disable();
                    }
                };

                const syncColorResetVisibility = (hasColor) => {
                    colorReset?.classList.toggle('is-hidden', !hasColor);
                };

                const applyTitleChange = () => {
                    persistAndApply(entry, serverDefaults, () => applyPresentationToElement(entry));
                };

                // Lazy-init on click — creating Pickr during onOpen was breaking the popover.
                const ensureTitlePickr = () => {
                    if (titlePickr || !colorBtn) return titlePickr;
                    titlePickr = createPickrInstance(colorBtn, {
                        defaultColor: titleColor,
                        useAsButton: true,
                        onChange: (css) => {
                            entry.effectiveConfig.cardTitleColor = css;
                            syncColorResetVisibility(true);
                            applyTitleChange();
                        },
                        onSave: (css) => {
                            entry.effectiveConfig.cardTitleColor = css;
                            syncColorResetVisibility(true);
                            applyTitleChange();
                        },
                        onShow: () => setAnchoredMenuBackdropPassThrough(modalInstance, true),
                        onHide: () => setAnchoredMenuBackdropPassThrough(modalInstance, false)
                    });
                    if (!titlesVisible) titlePickr?.disable();
                    return titlePickr;
                };

                visibilityBtn?.addEventListener('click', (ev) => {
                    ev.stopPropagation();
                    closeActiveFormatMenu();
                    const nextVisible = !areCardTitlesVisible(entry.effectiveConfig);
                    if (nextVisible) {
                        delete entry.effectiveConfig.cardTitleVisibility;
                        delete entry.effectiveConfig.hideCardTitles;
                    } else {
                        entry.effectiveConfig.cardTitleVisibility = 'hidden';
                        delete entry.effectiveConfig.hideCardTitles;
                    }
                    syncCardTitleVisibilityButton(visibilityBtn, nextVisible);
                    syncColorEnabled(nextVisible);
                    applyTitleChange();
                });

                colorBtn?.addEventListener('click', (ev) => {
                    ev.stopPropagation();
                    closeActiveFormatMenu();
                    if (colorBtn.disabled) return;
                    if (!titlePickr) {
                        const pickr = ensureTitlePickr();
                        requestAnimationFrame(() => pickr?.show());
                    }
                    // After init, Pickr's useAsButton handler toggles open/close.
                });

                colorReset?.addEventListener('click', (ev) => {
                    ev.stopPropagation();
                    closeActiveFormatMenu();
                    if (colorReset.disabled) return;
                    try { titlePickr?.setColor('#ffffff', true); } catch (_) { /* ignore */ }
                    delete entry.effectiveConfig.cardTitleColor;
                    syncColorResetVisibility(false);
                    applyTitleChange();
                });

                const openNested = (btn, options, getActiveValue, applyValue) => {
                    if (!btn) return;
                    btn.addEventListener('click', (ev) => {
                        ev.stopPropagation();
                        openOptionMenu(btn, options, {
                            preserveCardTitleMenu: true,
                            activeValue: getActiveValue(),
                            onSelect: (value) => {
                                applyValue(value);
                                applyTitleChange();
                            }
                        });
                    });
                };

                openNested(
                    root?.querySelector('.kefin-section-card-title-font-btn'),
                    getCardTitleFontFamilyOptions(),
                    () => entry.effectiveConfig.cardTitleFontFamily || 'default',
                    (value) => {
                        if (value && value !== 'default') entry.effectiveConfig.cardTitleFontFamily = value;
                        else delete entry.effectiveConfig.cardTitleFontFamily;
                    }
                );
                openNested(
                    root?.querySelector('.kefin-section-card-title-size-btn'),
                    getCardTitleFontSizeOptions(),
                    () => entry.effectiveConfig.cardTitleFontSize || 'normal',
                    (value) => {
                        if (value && value !== 'normal') entry.effectiveConfig.cardTitleFontSize = value;
                        else delete entry.effectiveConfig.cardTitleFontSize;
                    }
                );
                openNested(
                    root?.querySelector('.kefin-section-card-title-horizontal-btn'),
                    getCardTitleHorizontalAlignOptions(),
                    () => parseCardTitleAlign(entry.effectiveConfig.cardTitlePosition).horizontal,
                    (value) => {
                        const align = parseCardTitleAlign(entry.effectiveConfig.cardTitlePosition);
                        setCardTitlePositionFromAlign(entry.effectiveConfig, value, align.vertical);
                    }
                );
                openNested(
                    root?.querySelector('.kefin-section-card-title-vertical-btn'),
                    getCardTitleVerticalAlignOptions(),
                    () => parseCardTitleAlign(entry.effectiveConfig.cardTitlePosition).vertical,
                    (value) => {
                        const align = parseCardTitleAlign(entry.effectiveConfig.cardTitlePosition);
                        setCardTitlePositionFromAlign(entry.effectiveConfig, align.horizontal, value);
                    }
                );
                openNested(
                    root?.querySelector('.kefin-section-card-title-caps-btn'),
                    getCardTitleCapitalizationOptions(),
                    () => entry.effectiveConfig.cardTitleCapitalization || 'normal',
                    (value) => {
                        if (value && value !== 'normal') entry.effectiveConfig.cardTitleCapitalization = value;
                        else delete entry.effectiveConfig.cardTitleCapitalization;
                    }
                );
            }
        });
        trackCardTitleMenu(modal, anchorBtn);
        const prevCardTitleOnClose = modal.onClose;
        modal.onClose = () => {
            destroyPickrInstance(titlePickr);
            titlePickr = null;
            prevCardTitleOnClose?.();
        };
        return modal;
    }

    function syncSpotlightLayoutButton(btn, layout) {
        if (!btn) return;
        const isBorderless = layout === 'Borderless';
        const icon = btn.querySelector('.material-icons');
        if (icon) icon.textContent = isBorderless ? 'crop_landscape' : 'fullscreen';
        const nextLabel = isBorderless ? 'Switch to Border layout' : 'Switch to Borderless layout';
        btn.title = nextLabel;
        btn.setAttribute('aria-label', nextLabel);
        btn.dataset.layout = isBorderless ? 'Borderless' : 'Border';
    }

    function normalizeSpotlightTileCount(tileCount) {
        const n = parseInt(tileCount, 10);
        return n === 2 || n === 3 ? n : 1;
    }

    function nextSpotlightTileCount(tileCount) {
        const current = normalizeSpotlightTileCount(tileCount);
        return current === 1 ? 2 : current === 2 ? 3 : 1;
    }

    function syncSpotlightTilesButton(btn, tileCount) {
        if (!btn) return;
        const current = normalizeSpotlightTileCount(tileCount);
        const next = nextSpotlightTileCount(current);
        const icon = btn.querySelector('.material-icons');
        if (icon) {
            icon.textContent = next === 1 ? 'looks_one' : next === 2 ? 'looks_two' : 'looks_3';
        }
        const label = next === 1 ? '1 tile' : `${next} tiles`;
        btn.title = label;
        btn.setAttribute('aria-label', label);
        btn.dataset.tileCount = String(current);
    }

    function syncVisibilityButton(btn, enabled) {
        if (!btn) return;
        const isOn = enabled !== false;
        const icon = btn.querySelector('.material-icons');
        if (icon) icon.textContent = isOn ? 'visibility' : 'visibility_off';
        btn.classList.toggle('is-hidden-visibility', !isOn);
        const label = isOn ? 'Hide section' : 'Show section';
        btn.title = label;
        btn.setAttribute('aria-label', label);
        btn.setAttribute('aria-pressed', String(isOn));
    }

    function buildSelectOptionsHtml(options, selectedValue) {
        return options.map(opt => `
            <option value="${escapeHtml(opt.value)}" ${String(opt.value) === String(selectedValue) ? 'selected' : ''}>
                ${escapeHtml(opt.label)}
            </option>
        `).join('');
    }

    function buildConfigureRow(label, controlHtml, descriptionHtml = '', options = {}) {
        const { stacked = false, controlId = '' } = options;
        if (stacked) {
            const labelFor = controlId ? ` for="${escapeHtml(controlId)}"` : '';
            return `
                <div class="kefin-section-configure-field">
                    <label class="listItemBodyText kefin-section-configure-field-label"${labelFor}>${escapeHtml(label)}</label>
                    ${descriptionHtml ? `<div class="listItemBodyText secondary kefin-section-configure-field-desc">${descriptionHtml}</div>` : ''}
                    <div class="kefin-section-configure-field-control">${controlHtml}</div>
                </div>
            `;
        }
        return `
            <div class="kefin-section-configure-row">
                <div class="kefin-section-configure-row-copy">
                    <span class="listItemBodyText kefin-section-configure-row-label">${escapeHtml(label)}</span>
                    ${descriptionHtml ? `<span class="listItemBodyText secondary kefin-section-configure-row-desc">${descriptionHtml}</span>` : ''}
                </div>
                <div class="kefin-section-configure-row-control">${controlHtml}</div>
            </div>
        `;
    }

    function buildToggleRow(id, label, checked, descriptionOn, descriptionOff) {
        const description = checked ? descriptionOn : descriptionOff;
        return `
            <div class="kefin-section-configure-toggle-card" data-toggle-row="${escapeHtml(id)}">
                <div class="kefin-section-configure-toggle-card-text">
                    <div class="listItemBodyText kefin-section-configure-toggle-card-label">${escapeHtml(label)}</div>
                    ${description ? `<div class="listItemBodyText secondary kefin-section-configure-row-desc kefin-section-configure-toggle-card-desc">${escapeHtml(description)}</div>` : ''}
                </div>
                <div class="kefin-section-configure-toggle" data-toggle-for="${escapeHtml(id)}"></div>
            </div>
        `;
    }

    function persistAndApply(entry, serverDefaults, applyFn) {
        scheduleSave(entry.sectionId, entry.effectiveConfig, serverDefaults);
        if (typeof applyFn === 'function') applyFn();
        if (activePopover?.entry === entry) {
            syncRestoreDefaultsButton(
                activePopover.popover?.querySelector('.kefin-section-restore-defaults-btn'),
                sectionHasUserOverrides(entry, serverDefaults)
            );
        }
    }

    function readSectionOrder(el) {
        const fromDataset = parseInt(el.dataset.order, 10);
        if (!Number.isNaN(fromDataset)) return fromDataset;
        const fromStyle = parseInt(el.style.order, 10);
        if (!Number.isNaN(fromStyle)) return fromStyle;
        return 0;
    }

    function getSectionsInVisualOrder(sectionElement) {
        const container = sectionElement?.parentElement;
        if (!container) return [];
        return [...container.querySelectorAll('[data-section-id]')]
            .map(el => ({
                element: el,
                sectionId: el.dataset.sectionId,
                order: readSectionOrder(el),
                runtime: runtime.get(el.dataset.sectionId)
            }))
            .sort((a, b) => {
                const topDiff = a.element.getBoundingClientRect().top - b.element.getBoundingClientRect().top;
                if (Math.abs(topDiff) > 0.5) return topDiff;
                const position = a.element.compareDocumentPosition(b.element);
                if (position & Node.DOCUMENT_POSITION_FOLLOWING) return -1;
                if (position & Node.DOCUMENT_POSITION_PRECEDING) return 1;
                return 0;
            });
    }

    function applySequentialOrders(orderedSections) {
        orderedSections.forEach((section, idx) => {
            section.element.style.order = idx;
            section.element.dataset.order = String(idx);
            if (!section.runtime) return;
            section.runtime.effectiveConfig.order = idx;
            scheduleSave(
                section.sectionId,
                section.runtime.effectiveConfig,
                section.runtime.serverDefaults
            );
        });
        if (activePopover?.entry) {
            syncRestoreDefaultsButton(
                activePopover.popover?.querySelector('.kefin-section-restore-defaults-btn'),
                sectionHasUserOverrides(activePopover.entry, activePopover.entry.serverDefaults)
            );
        }
    }

    function findPageScrollRoot(sectionElement) {
        const start = sectionElement?.closest('.homeSectionsContainer')?.parentElement
            || sectionElement?.parentElement;
        let node = start;
        while (node && node !== document.body) {
            const style = getComputedStyle(node);
            if (/(auto|scroll|overlay)/.test(style.overflowY) && node.scrollHeight > node.clientHeight + 1) {
                return node;
            }
            node = node.parentElement;
        }
        return null;
    }

    function resolveScrollRoot(sectionElement) {
        return findPageScrollRoot(sectionElement) || window;
    }

    function getScrollY(root) {
        if (!root || root === window) {
            return window.scrollY || window.pageYOffset || document.documentElement.scrollTop || 0;
        }
        return root.scrollTop || 0;
    }

    function setScrollY(root, y) {
        const top = Math.max(0, y);
        if (!root || root === window) {
            try {
                window.scrollTo({ top, left: 0, behavior: 'instant' });
            } catch (_) {
                // Older engines may not accept the options object / 'instant'.
                window.scrollTo(0, top);
            }
            return;
        }
        root.scrollTop = top;
    }

    function easeOutCubic(t) {
        return 1 - Math.pow(1 - t, 3);
    }

    function prefersReducedMotion() {
        return window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches === true;
    }

    function captureSectionRects(elements) {
        return new Map(elements.map(el => [el, el.getBoundingClientRect()]));
    }

    function setOverflowAnchorNone(elements) {
        elements.forEach((el) => {
            if (!el) return;
            if (!el.hasAttribute('data-kefin-overflow-anchor')) {
                el.setAttribute('data-kefin-overflow-anchor', el.style.overflowAnchor || '');
            }
            el.style.overflowAnchor = 'none';
        });
    }

    function clearOverflowAnchorNone(elements) {
        elements.forEach((el) => {
            if (!el?.hasAttribute('data-kefin-overflow-anchor')) return;
            const prev = el.getAttribute('data-kefin-overflow-anchor') || '';
            el.style.overflowAnchor = prev;
            el.removeAttribute('data-kefin-overflow-anchor');
        });
    }

    function setSectionFlipStyles(el, invertY, isPrimary) {
        el.style.willChange = 'transform';
        el.style.transition = 'none';
        el.style.transform = `translateY(${invertY}px)`;
        el.style.position = 'relative';
        el.style.zIndex = isPrimary ? '3' : '2';
    }

    function clearSectionFlipStyles(el) {
        el.style.transform = '';
        el.style.transition = '';
        el.style.willChange = '';
        el.style.position = '';
        el.style.zIndex = '';
    }

    function animateSectionReorderFlip({ primaryEl, elements, firstRects, scrollRoot, startScroll, anchorEls }) {
        void primaryEl.offsetHeight;

        const invertPrimary = firstRects.get(primaryEl).top - primaryEl.getBoundingClientRect().top;
        const scrollDelta = -invertPrimary;
        const duration = 320;
        const flipItems = (elements || [])
            .filter(Boolean)
            .map((el) => ({
                el,
                invertY: firstRects.get(el).top - el.getBoundingClientRect().top,
                isPrimary: el === primaryEl
            }))
            .filter(({ invertY, isPrimary }) => isPrimary || Math.abs(invertY) > 0.5);

        flipItems.forEach(({ el, invertY, isPrimary }) => setSectionFlipStyles(el, invertY, isPrimary));
        if (activePopover) activePopover.isAnimating = true;

        const startTime = performance.now();

        return new Promise((resolve) => {
            let finished = false;
            const finish = () => {
                if (finished) return;
                finished = true;
                flipItems.forEach(({ el }) => clearSectionFlipStyles(el));
                clearOverflowAnchorNone(anchorEls || []);
                if (activePopover) activePopover.isAnimating = false;
                resolve();
            };

            const frame = (now) => {
                if (finished) return;
                const t = Math.min(1, (now - startTime) / duration);
                const eased = easeOutCubic(t);

                flipItems.forEach(({ el, invertY }) => {
                    el.style.transform = `translateY(${invertY * (1 - eased)}px)`;
                });
                setScrollY(scrollRoot, startScroll + scrollDelta * eased);

                if (t < 1) requestAnimationFrame(frame);
                else finish();
            };

            // First sample immediately so transform + scroll stay locked from frame 0.
            //frame(startTime);
            requestAnimationFrame(frame);
        });
    }

    function swapSectionOrder(sectionId, direction) {
        const entry = getRuntime(sectionId);
        if (!entry?.element) return;
        if (activePopover?.isAnimating) return;

        const ordered = getSectionsInVisualOrder(entry.element);
        const index = ordered.findIndex(s => s.sectionId === sectionId);
        if (index === -1) return;

        const swapIndex = direction === 'up' ? index - 1 : index + 1;
        if (swapIndex < 0 || swapIndex >= ordered.length) return;

        const currentEl = ordered[index].element;
        const partnerEl = ordered[swapIndex].element;
        const container = currentEl.parentElement;
        const scrollRoot = resolveScrollRoot(currentEl);
        const startScroll = getScrollY(scrollRoot);
        const anchorEls = [container, currentEl, partnerEl].filter(Boolean);

        const firstRects = captureSectionRects([currentEl, partnerEl]);

        setOverflowAnchorNone(anchorEls);
        [ordered[index], ordered[swapIndex]] = [ordered[swapIndex], ordered[index]];
        applySequentialOrders(ordered);

        if (prefersReducedMotion()) {
            const delta = firstRects.get(currentEl).top - currentEl.getBoundingClientRect().top;
            setScrollY(scrollRoot, getScrollY(scrollRoot) - delta);
            void currentEl.offsetHeight;
            clearOverflowAnchorNone(anchorEls);
            return;
        }

        animateSectionReorderFlip({
            primaryEl: currentEl,
            elements: [currentEl, partnerEl],
            firstRects,
            scrollRoot,
            startScroll,
            anchorEls
        });
    }

    function isDiscoverySectionElement(el) {
        return el?.dataset?.discoverySection === 'true';
    }

    function moveSectionToBoundary(sectionId, boundary) {
        const entry = getRuntime(sectionId);
        if (!entry?.element) return;
        if (activePopover?.isAnimating) return;

        const ordered = getSectionsInVisualOrder(entry.element);
        const index = ordered.findIndex(s => s.sectionId === sectionId);
        if (index === -1) return;

        const next = ordered.slice();
        const [item] = next.splice(index, 1);
        if (!item) return;

        if (boundary === 'top') {
            next.unshift(item);
        } else {
            let lastNonDiscovery = -1;
            for (let i = 0; i < next.length; i++) {
                if (isDiscoverySectionElement(next[i].element)) continue;
                lastNonDiscovery = i;
            }
            next.splice(lastNonDiscovery + 1, 0, item);
        }

        const targetIndex = next.findIndex(s => s.sectionId === sectionId);
        if (targetIndex === index) return;

        const currentEl = item.element;
        const movingEls = next.map(s => s.element).filter(Boolean);
        const container = currentEl.parentElement;
        const scrollRoot = resolveScrollRoot(currentEl);
        const startScroll = getScrollY(scrollRoot);
        const anchorEls = [container, ...movingEls].filter(Boolean);
        const firstRects = captureSectionRects(movingEls);

        setOverflowAnchorNone(anchorEls);
        applySequentialOrders(next);

        if (prefersReducedMotion()) {
            const delta = firstRects.get(currentEl).top - currentEl.getBoundingClientRect().top;
            setScrollY(scrollRoot, getScrollY(scrollRoot) - delta);
            void currentEl.offsetHeight;
            clearOverflowAnchorNone(anchorEls);
            return;
        }

        animateSectionReorderFlip({
            primaryEl: currentEl,
            elements: movingEls,
            firstRects,
            scrollRoot,
            startScroll,
            anchorEls
        });
    }

    const LONG_PRESS_MS = 450;

    function bindOrderButton(button, { onClick, onLongPress }) {
        if (!button) return;
        let timer = null;
        let longPressed = false;
        let activePointerId = null;

        const clearTimer = () => {
            if (timer != null) {
                clearTimeout(timer);
                timer = null;
            }
        };

        button.addEventListener('pointerdown', (e) => {
            if (e.pointerType === 'mouse' && e.button !== 0) return;
            longPressed = false;
            activePointerId = e.pointerId;
            clearTimer();
            timer = setTimeout(() => {
                timer = null;
                longPressed = true;
                try {
                    button.setPointerCapture?.(e.pointerId);
                } catch (_) { /* ignore */ }
                onLongPress?.(e);
            }, LONG_PRESS_MS);
        });

        const endPress = (e) => {
            if (activePointerId != null && e.pointerId !== activePointerId) return;
            clearTimer();
            activePointerId = null;
            try {
                if (button.hasPointerCapture?.(e.pointerId)) {
                    button.releasePointerCapture(e.pointerId);
                }
            } catch (_) { /* ignore */ }
        };

        button.addEventListener('pointerup', endPress);
        button.addEventListener('pointercancel', endPress);
        button.addEventListener('lostpointercapture', endPress);
        button.addEventListener('click', (e) => {
            e.stopPropagation();
            e.preventDefault();
            if (longPressed) {
                longPressed = false;
                return;
            }
            onClick?.(e);
        });
    }

    function rerenderNormalSection(entry) {
        rerenderSection(entry);
    }

    function setSpotlightAnimation(entry, enabled) {
        entry.effectiveConfig.spotlightConfig = {
            ...(entry.effectiveConfig.spotlightConfig || {}),
            panAnimation: enabled
        };
        entry.element.dataset.panAnimation = enabled ? 'true' : 'false';

        const imgs = entry.element.querySelectorAll('.spotlight-background-layer img, .spotlight-background-single img');
        imgs.forEach(img => {
            img.style.transform = '';
            img.classList.remove('animate');
            if (enabled) {
                img.classList.add('animate');
            }
        });
    }

    async function refreshSectionCache(entry) {
        if (!window.cardBuilder?.refreshSectionQueries) return;
        try {
            entry.element.dataset.refreshing = 'true';
            const freshItems = await window.cardBuilder.refreshSectionQueries(entry.effectiveConfig);
            entry.cachedItems = freshItems;
            entry.effectiveConfig.ttl = entry.effectiveConfig.ttl;
            rerenderSection(entry);
            entry.element.dataset.refreshing = 'false';
        } catch (e) {
            WARN('Cache refresh failed:', e);
            entry.element.dataset.refreshing = 'false';
        }
    }

    function getConfigureAnchorButton(entry) {
        return entry?.element?.querySelector('.section-configure-button') || null;
    }

    function resolvePopoverMount(anchorButton, sectionElement) {
        return anchorButton?.closest(
            '.sectionTitleContainer, .spotlight-section-title-container'
        ) || sectionElement;
    }

    function preparePopoverMount(anchorButton, sectionElement) {
        const mountElement = resolvePopoverMount(anchorButton, sectionElement);
        mountElement.classList.add('kefin-section-has-configure-popover');
        sectionElement?.classList.add('kefin-section-configure-popover-open');
        return mountElement;
    }

    function cleanupPopoverMount(mountElement, sectionElement) {
        mountElement?.classList.remove('kefin-section-has-configure-popover');
        sectionElement?.classList.remove('kefin-section-configure-popover-open');
    }

    function repositionActivePopover() {
        if (!activePopover || activePopover.isAnimating) return;
        // Once placed, never move — scrolling/resize/reorder must not shift targets mid-click.
        if (activePopover.placementLocked) return;
        const anchor = activePopover.anchorButton || getConfigureAnchorButton(activePopover.entry);
        const mount = activePopover.mountElement
            || resolvePopoverMount(anchor, activePopover.entry?.element);
        if (!anchor || !mount || !document.body.contains(anchor) || !document.body.contains(mount)) return;
        activePopover.anchorButton = anchor;
        activePopover.mountElement = mount;
        if (activePopover.entry?.element) {
            activePopover.entry.element = anchor.closest('[data-section-id]') || activePopover.entry.element;
            activePopover.sectionElement = activePopover.entry.element;
        }
        positionConfigurePopover(activePopover.popover, anchor, mount);
        activePopover.placementLocked = true;
        if (activePopover.formatMenu && activePopover.formatMenuAnchor) {
            positionFormatMenu(activePopover.formatMenu, activePopover.formatMenuAnchor);
        }
    }

    function startPopoverTracking() {
        // Placement is fixed for the life of the open popover.
        return () => {};
    }

    function closePopover() {
        if (!activePopover) return;
        closeCardTitleMenu();
        if (window.ModalSystem?.isOpen?.(RESTORE_SECTION_MODAL_ID)) {
            window.ModalSystem.close(RESTORE_SECTION_MODAL_ID);
        }
        if (window.ModalSystem?.isOpen?.(PUBLISH_SECTION_MODAL_ID)) {
            window.ModalSystem.close(PUBLISH_SECTION_MODAL_ID);
        }
        const { popover, entry, stopTracking, mountElement, sectionElement } = activePopover;
        stopTracking?.();
        popover.remove();
        cleanupPopoverMount(mountElement, sectionElement || entry?.element);
        document.removeEventListener('click', activePopover.outsideHandler, true);
        pickrGestureFromApp = false;
        activePopover = null;
    }

    /**
     * Fade out, remove from DOM, stash for undo, and show restore toast.
     */
    function hideSectionFromHome(entry, serverDefaults) {
        const el = entry?.element;
        if (!el) return;
        const parent = el.parentNode;
        const nextSibling = el.nextSibling;
        const defaults = serverDefaults || entry.serverDefaults;
        el.style.transition = 'opacity 0.35s ease';
        el.style.opacity = '0';
        setTimeout(() => {
            if (parent) {
                pendingHideStash = {
                    entry,
                    parent,
                    nextSibling,
                    serverDefaults: defaults
                };
            }
            el.remove();
            runtime.delete(entry.sectionId);
            showHiddenSectionToast(entry, defaults);
        }, 350);
    }

    function navigateToHomeScreenPreferences() {
        const href = 'mypreferenceshome.html';
        if (window.Dashboard?.navigate) {
            window.Dashboard.navigate(href);
            return;
        }
        window.location.hash = `#/${href}`;
    }

    function showHiddenSectionToast(entry, serverDefaults) {
        const toaster = window.KefinTweaksToaster;
        if (!toaster?.toast) return;
        const handle = toaster.toast(
            'You can restore this section in your user Home Screen settings.',
            '8',
            true,
            {
                link: {
                    label: 'user Home Screen settings',
                    href: 'mypreferenceshome.html',
                    onClick: navigateToHomeScreenPreferences
                },
                action: {
                    icon: 'undo',
                    label: 'Undo',
                    onClick: () => {
                        undoHiddenSection(entry, serverDefaults);
                        handle?.dismiss?.();
                    }
                }
            }
        );
    }

    function undoHiddenSection(entry, serverDefaults) {
        if (!entry?.effectiveConfig) return;
        const defaults = serverDefaults || entry.serverDefaults || {};
        entry.effectiveConfig.enabled = true;
        scheduleSave(entry.sectionId, entry.effectiveConfig, defaults);

        const stash = pendingHideStash?.entry?.sectionId === entry.sectionId
            ? pendingHideStash
            : null;
        pendingHideStash = null;

        const el = entry.element;
        if (!el) {
            window.homeScreen3?.refreshHomeSections?.();
            return;
        }

        el.style.transition = '';
        el.style.opacity = '1';

        const parent = stash?.parent;
        const nextSibling = stash?.nextSibling;
        const parentStillValid = parent && document.contains(parent);
        if (parentStillValid) {
            if (nextSibling && nextSibling.parentNode === parent) {
                parent.insertBefore(el, nextSibling);
            } else {
                parent.appendChild(el);
            }
            registerRuntime(entry);
            return;
        }

        scheduleSave(entry.sectionId, entry.effectiveConfig, defaults);
        window.homeScreen3?.refreshHomeSections?.();
    }

    function getPopoverPlacementHeight(popover, expanded) {
        const footer = popover.querySelector('.kefin-section-configure-footer');
        const inner = popover.querySelector('.kefin-section-configure-more-panel-inner');
        const separator = popover.querySelector('.kefin-section-configure-separator');
        const styles = getComputedStyle(popover);
        const paddingV = (parseFloat(styles.paddingTop) || 0) + (parseFloat(styles.paddingBottom) || 0);
        const footerHeight = footer?.offsetHeight || 0;
        let moreHeight = 0;
        if (expanded && inner) {
            const fontSize = parseFloat(styles.fontSize) || 16;
            moreHeight = inner.scrollHeight + (0.65 * fontSize);
            if (separator) {
                const sepStyles = getComputedStyle(separator);
                moreHeight += (separator.offsetHeight || 0)
                    + (parseFloat(sepStyles.marginTop) || 0)
                    + (parseFloat(sepStyles.marginBottom) || 0);
            }
        }
        return paddingV + footerHeight + moreHeight;
    }

    function positionConfigurePopover(popover, anchorButton, mountElement) {
        const sectionElement = mountElement.closest('[data-section-id]')
            || activePopover?.entry?.element
            || mountElement;
        const mountRect = mountElement.getBoundingClientRect();
        const sectionRect = sectionElement.getBoundingClientRect();
        const buttonRect = anchorButton.getBoundingClientRect();
        const popoverWidth = popover.offsetWidth || popover.getBoundingClientRect().width;
        const margin = 8;
        const gap = 8;

        // Center on the configure button in viewport space first.
        let leftViewport = buttonRect.left + (buttonRect.width / 2) - (popoverWidth / 2);

        // Keep inside the section when possible; always keep inside the viewport.
        const minLeft = Math.max(sectionRect.left + margin, margin);
        const maxLeft = Math.min(sectionRect.right - popoverWidth - margin, window.innerWidth - popoverWidth - margin);

        if (maxLeft >= minLeft) {
            leftViewport = Math.min(Math.max(leftViewport, minLeft), maxLeft);
        } else {
            // Section narrower than popover (common when section name is hidden):
            // pin to the section's left edge, then clamp to the viewport.
            leftViewport = Math.min(
                Math.max(sectionRect.left + margin, margin),
                Math.max(margin, window.innerWidth - popoverWidth - margin)
            );
        }

        popover.style.left = `${leftViewport - mountRect.left}px`;

        // Spotlights: always open below so the popover stays inside the banner
        // (overflow/mask on .spotlight-banner-container would clip anything above).
        // Normal sections: decide once from expanded height; never flip after open.
        let placeBelow;
        if (activePopover?.anchorMode === 'above' || activePopover?.anchorMode === 'below') {
            placeBelow = activePopover.anchorMode === 'below';
        } else {
            const isSpotlight = !!mountElement.closest('.spotlight-section')
                || activePopover?.entry?.element?.classList.contains('spotlight-section');
            const expandedHeight = getPopoverPlacementHeight(popover, true);
            const spaceAbove = mountRect.top - margin;
            placeBelow = isSpotlight || spaceAbove < expandedHeight + gap;
            if (activePopover) activePopover.anchorMode = placeBelow ? 'below' : 'above';
        }

        popover.classList.toggle('is-below', placeBelow);
        popover.style.top = '';
        popover.style.bottom = '';
    }

    function openConfigurePopover(sectionConfig, sectionElement, anchorButton) {
        if (!isEnabled()) return;
        closePopover();

        const api = getConfigApi();
        const serverDefaults = sectionConfig._userPrefDefaults
            || api.getServerSectionDefaults(sectionConfig);
        const entry = getRuntime(sectionConfig.id) || {
            sectionId: sectionConfig.id,
            element: sectionElement,
            serverConfig: { ...sectionConfig },
            effectiveConfig: { ...sectionConfig },
            cachedItems: null,
            serverDefaults
        };
        if (!entry.effectiveConfig.spotlightConfig) {
            entry.effectiveConfig.spotlightConfig = { ...(sectionConfig.spotlightConfig || {}) };
        }
        entry.serverDefaults = serverDefaults;
        registerRuntime(entry);

        const cfg = entry.effectiveConfig;
        const spotlight = cfg.spotlightConfig || {};
        const isSpotlight = isSpotlightSection(cfg);
        const isPinnedParent = sectionConfig.id?.startsWith('pinned-parent-');
        const sectionDirty = sectionHasUserOverrides(entry, serverDefaults);

        const currentTtl = cfg.ttl ?? serverDefaults.ttl;
        const cacheOptions = buildCacheSelectOptionsHtml(currentTtl);

        const moreModeRows = `
            <div class="kefin-section-configure-toggle-card kefin-section-configure-cache-card">
                <div class="kefin-section-configure-toggle-card-text">
                    <label class="listItemBodyText kefin-section-configure-toggle-card-label" for="kefin-cfg-cache-${escapeHtml(sectionConfig.id)}">Cache Time</label>
                </div>
                <div class="kefin-section-configure-cache-control">
                    <select id="kefin-cfg-cache-${escapeHtml(sectionConfig.id)}" class="emby-select emby-select-withcolor kefin-section-cache-select" aria-label="Cache Time">${cacheOptions}</select>
                </div>
            </div>
            ${buildToggleRow(
                'hide-section-name',
                'Hide Section Name',
                cfg.hideName === true,
                HIDE_NAME_DESCRIPTIONS.on,
                HIDE_NAME_DESCRIPTIONS.off
            )}
            ${isSpotlight
                ? buildToggleRow(
                    'spotlight-animate',
                    'Animate Slides',
                    spotlight.panAnimation !== false,
                    'Apply pan and zoom animations to each slide.',
                    'Slides will remain static without animation.'
                )
                : ''}
        `;

        const spotlightLayout = spotlight.spotlightLayout || 'Border';
        const spotlightTileCount = normalizeSpotlightTileCount(spotlight.tileCount);
        const spotlightNextTileCount = nextSpotlightTileCount(spotlightTileCount);
        const spotlightTilesIcon = spotlightNextTileCount === 1
            ? 'looks_one'
            : spotlightNextTileCount === 2
                ? 'looks_two'
                : 'looks_3';
        const spotlightTilesLabel = spotlightNextTileCount === 1
            ? '1 tile'
            : `${spotlightNextTileCount} tiles`;
        const popover = document.createElement('div');
        popover.className = 'kefin-section-configure-popover dialog';
        popover.innerHTML = `
            <div class="kefin-section-configure-title-container">
                <div class="kefin-section-configure-title-row">
                    <h3>${escapeHtml(sectionConfig.name)}</h3>
                    <button type="button" is="paper-icon-button-light" class="paper-icon-button-light emby-button kefin-section-publish-btn" title="Apply to all users" aria-label="Apply to all users" hidden>
                        <span class="material-icons" aria-hidden="true">publish</span>
                    </button>
                    <button type="button" is="paper-icon-button-light" class="paper-icon-button-light emby-button kefin-section-open-editor-btn" title="Open Editor" aria-label="Open Editor" hidden>
                        <span class="material-icons" aria-hidden="true">edit</span>
                    </button>
                </div>
                <hr class="kefin-section-configure-separator" aria-hidden="true">
            </div>
            <div class="kefin-section-configure-more-panel">
                <div class="kefin-section-configure-more-panel-inner">
                    ${moreModeRows}
                </div>
            </div>
            <hr class="kefin-section-configure-separator" aria-hidden="true">
            <div class="kefin-section-configure-footer">
                <div class="kefin-section-configure-primary-row">
                    <div class="kefin-section-configure-order">
                        <button type="button" is="paper-icon-button-light" class="paper-icon-button-light emby-button kefin-section-order-up" title="Move section up. Long press to move to top." aria-label="Move section up"><span class="material-icons" aria-hidden="true">arrow_upward</span></button>
                        <button type="button" is="paper-icon-button-light" class="paper-icon-button-light emby-button kefin-section-order-down" title="Move section down. Long press to move to bottom." aria-label="Move section down"><span class="material-icons" aria-hidden="true">arrow_downward</span></button>
                    </div>
                    <button type="button" is="paper-icon-button-light" class="paper-icon-button-light emby-button kefin-section-visibility-btn${cfg.enabled !== false ? '' : ' is-hidden-visibility'}" title="${cfg.enabled !== false ? 'Hide section' : 'Show section'}" aria-label="${cfg.enabled !== false ? 'Hide section' : 'Show section'}" aria-pressed="${cfg.enabled !== false}">
                        <span class="material-icons" aria-hidden="true">${cfg.enabled !== false ? 'visibility' : 'visibility_off'}</span>
                    </button>
                    ${!isSpotlight ? `
                    <button type="button" is="paper-icon-button-light" class="paper-icon-button-light emby-button kefin-section-format-btn" title="Card Format" aria-label="Card Format">
                        <span class="material-icons" aria-hidden="true">image</span>
                    </button>
                    <button type="button" is="paper-icon-button-light" class="paper-icon-button-light emby-button kefin-section-border-style-btn" title="Border Style" aria-label="Border Style">
                        <span class="material-icons" aria-hidden="true">border_style</span>
                    </button>
                    <button type="button" is="paper-icon-button-light" class="paper-icon-button-light emby-button kefin-section-card-title-btn" title="Card Title options" aria-label="Card Title options">
                        <span class="material-icons" aria-hidden="true">text_fields</span>
                    </button>` : `
                    <button type="button" is="paper-icon-button-light" class="paper-icon-button-light emby-button kefin-section-spotlight-layout-btn" title="Spotlight Layout" aria-label="Spotlight Layout" data-layout="${escapeHtml(spotlightLayout)}">
                        <span class="material-icons" aria-hidden="true">${spotlightLayout === 'Borderless' ? 'crop_landscape' : 'fullscreen'}</span>
                    </button>
                    <button type="button" is="paper-icon-button-light" class="paper-icon-button-light emby-button kefin-section-spotlight-size-btn" title="Size" aria-label="Size">
                        <span class="material-icons" aria-hidden="true">aspect_ratio</span>
                    </button>
                    <button type="button" is="paper-icon-button-light" class="paper-icon-button-light emby-button kefin-section-spotlight-tiles-btn" title="${escapeHtml(spotlightTilesLabel)}" aria-label="${escapeHtml(spotlightTilesLabel)}" data-tile-count="${spotlightTileCount}">
                        <span class="material-icons" aria-hidden="true">${spotlightTilesIcon}</span>
                    </button>`}
                    ${isPinnedParent ? `
                    <button type="button" is="paper-icon-button-light" class="paper-icon-button-light emby-button kefin-section-unpin-button" title="Unpin" aria-label="Unpin from Home Screen">
                        <span class="material-icons" aria-hidden="true">push_pin</span>
                    </button>` : ''}
                    <button type="button" is="paper-icon-button-light" class="paper-icon-button-light emby-button kefin-section-restore-defaults-btn${sectionDirty ? '' : ' is-disabled'}" title="Restore defaults" aria-label="Restore defaults" ${sectionDirty ? '' : 'disabled'} aria-disabled="${sectionDirty ? 'false' : 'true'}">
                        <span class="material-icons" aria-hidden="true">settings_backup_restore</span>
                    </button>
                    <button type="button" is="paper-icon-button-light" class="paper-icon-button-light emby-button kefin-section-more-toggle" title="More options" aria-label="More options" aria-expanded="false">
                        <span class="material-icons" aria-hidden="true">more_horiz</span>
                    </button>
                </div>
            </div>
        `;

        const mountElement = preparePopoverMount(anchorButton, sectionElement);
        mountElement.appendChild(popover);
        applyPresentationToElement(entry);

        const openEditorBtn = popover.querySelector('.kefin-section-open-editor-btn');
        const publishBtn = popover.querySelector('.kefin-section-publish-btn');
        if (openEditorBtn) {
            openEditorBtn.addEventListener('click', async (e) => {
                e.preventDefault();
                e.stopPropagation();
                closePopover();
                try {
                    await window.KefinHomeScreen?.openSectionEditorForId?.(sectionConfig.id);
                } catch (err) {
                    WARN('Open section editor failed:', err);
                }
            });
        }
        if (publishBtn) {
            publishBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                const presentation = buildPrefOverrides(entry.effectiveConfig);
                const storedId = resolveStoredSectionPrefId(sectionConfig.id, entry.effectiveConfig);
                openPublishSectionDefaultsConfirm({
                    onOk: async () => {
                        const ok = await window.KefinHomeScreen?.publishSectionPresentationDefaults?.(storedId, presentation);
                        if (!ok) throw new Error('Failed to publish section defaults');
                        closePopover();
                    },
                    onUpdate: async () => {
                        const ok = await window.KefinHomeScreen?.publishSectionPresentationDefaults?.(storedId, presentation);
                        if (!ok) throw new Error('Failed to publish section defaults');
                        await getConfigApi()?.updateUserHomeScreenSectionConfiguration?.(storedId);
                        closePopover();
                    }
                });
            });
        }
        void (async () => {
            try {
                const canEdit = await window.KefinHomeScreen?.canOpenSectionEditor?.(sectionConfig.id);
                if (!canEdit) return;
                if (openEditorBtn?.isConnected) openEditorBtn.hidden = false;
                if (publishBtn?.isConnected) publishBtn.hidden = false;
            } catch (err) {
                WARN('Section editor eligibility check failed:', err);
            }
        })();

        const updateToggleRowDescription = (toggleKey, descriptions, enabled) => {
            const row = popover.querySelector(`[data-toggle-row="${toggleKey}"]`)
                || popover.querySelector(`[data-toggle-for="${toggleKey}"]`)?.closest('.kefin-section-configure-toggle-card, .kefin-section-configure-row');
            const desc = row?.querySelector('.kefin-section-configure-row-desc, .kefin-section-configure-toggle-card-desc');
            if (desc) desc.textContent = enabled ? descriptions.on : descriptions.off;
        };

        const bindRowToggle = (toggleKey, getValue, setValue, descriptions, onApply) => {
            const container = popover.querySelector(`[data-toggle-for="${toggleKey}"]`);
            if (!container) return;
            const toggleId = `kefin-cfg-${toggleKey}-${sectionConfig.id}`;
            container.innerHTML = buildMinimalToggleSwitch(toggleId, getValue());
            bindToggleSwitch(container.querySelector('.kefin-toggle-switch'), (next) => {
                setValue(next);
                if (descriptions) updateToggleRowDescription(toggleKey, descriptions, next);
                persistAndApply(entry, serverDefaults, onApply);
            });
        };

        popover.querySelector('.kefin-section-visibility-btn')?.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            const willEnable = entry.effectiveConfig.enabled === false;
            entry.effectiveConfig.enabled = willEnable;
            scheduleSave(sectionConfig.id, entry.effectiveConfig, serverDefaults);

            if (!willEnable) {
                closePopover();
                hideSectionFromHome(entry, serverDefaults);
                return;
            }

            syncVisibilityButton(popover.querySelector('.kefin-section-visibility-btn'), true);
            syncRestoreDefaultsButton(
                popover.querySelector('.kefin-section-restore-defaults-btn'),
                sectionHasUserOverrides(entry, serverDefaults)
            );
        });

        bindRowToggle(
            'hide-section-name',
            () => cfg.hideName === true,
            (next) => { entry.effectiveConfig.hideName = next ? true : undefined; if (!next) delete entry.effectiveConfig.hideName; },
            HIDE_NAME_DESCRIPTIONS,
            () => applyPresentationToElement(entry)
        );

        bindRowToggle(
            'spotlight-animate',
            () => spotlight.panAnimation !== false,
            (next) => {
                entry.effectiveConfig.spotlightConfig = {
                    ...(entry.effectiveConfig.spotlightConfig || {}),
                    panAnimation: next
                };
            },
            null,
            () => setSpotlightAnimation(entry, entry.effectiveConfig.spotlightConfig.panAnimation !== false)
        );

        const cacheSelect = popover.querySelector('.kefin-section-cache-select');
        if (cacheSelect && currentTtl != null) {
            const matched = findCachePresetForTtl(currentTtl);
            cacheSelect.value = String(matched ? Number(matched.ms) : Number(currentTtl));
        }
        cacheSelect?.addEventListener('change', () => {
            entry.effectiveConfig.ttl = parseInt(cacheSelect.value, 10);
            persistAndApply(entry, serverDefaults, () => refreshSectionCache(entry));
        });

        const formatBtn = popover.querySelector('.kefin-section-format-btn');
        formatBtn?.addEventListener('click', (e) => {
            e.stopPropagation();
            openOptionMenu(
                formatBtn,
                getCardFormats().map((fmt) => ({ value: fmt, label: fmt })),
                {
                    activeValue: entry.effectiveConfig.cardFormat || '',
                    onSelect: (value) => {
                        if (value) entry.effectiveConfig.cardFormat = value;
                        else delete entry.effectiveConfig.cardFormat;
                        persistAndApply(entry, serverDefaults, () => rerenderSection(entry));
                    },
                    gaplessControls: {
                        value: entry.effectiveConfig.useGaplessCards === true,
                        onChange: (checked) => {
                            if (checked) entry.effectiveConfig.useGaplessCards = true;
                            else delete entry.effectiveConfig.useGaplessCards;
                            updateRuntimeUseGaplessCards(entry.sectionId, checked === true);
                            persistAndApply(entry, serverDefaults, () => {
                                const layout = window.cardBuilder?.resolveItemsLayout?.(entry.effectiveConfig) || 'row';
                                window.cardBuilder?.applyItemsLayoutState?.(entry.element, layout, checked === true);
                            });
                        }
                    }
                }
            );
        });

        const borderStyleBtn = popover.querySelector('.kefin-section-border-style-btn');
        borderStyleBtn?.addEventListener('click', (e) => {
            e.stopPropagation();
            openOptionMenu(borderStyleBtn, BORDER_STYLE_OPTIONS, {
                activeValue: entry.effectiveConfig.borderStyle || '',
                onSelect: (value) => {
                    if (value) entry.effectiveConfig.borderStyle = value;
                    else {
                        delete entry.effectiveConfig.borderStyle;
                        delete entry.effectiveConfig.borderColor;
                    }
                    persistAndApply(entry, serverDefaults, () => applyPresentationToElement(entry));
                },
                colorControls: {
                    value: entry.effectiveConfig.borderColor || '',
                    onChange: (value) => {
                        entry.effectiveConfig.borderColor = value;
                        persistAndApply(entry, serverDefaults, () => applyPresentationToElement(entry));
                    },
                    onClear: () => {
                        delete entry.effectiveConfig.borderColor;
                        persistAndApply(entry, serverDefaults, () => applyPresentationToElement(entry));
                    }
                }
            });
        });

        const cardTitleBtn = popover.querySelector('.kefin-section-card-title-btn');
        cardTitleBtn?.addEventListener('click', (e) => {
            e.stopPropagation();
            openCardTitleOptionsMenu(cardTitleBtn, entry, serverDefaults);
        });

        const spotlightLayoutBtn = popover.querySelector('.kefin-section-spotlight-layout-btn');
        if (spotlightLayoutBtn) {
            syncSpotlightLayoutButton(
                spotlightLayoutBtn,
                entry.effectiveConfig.spotlightConfig?.spotlightLayout || 'Border'
            );
            spotlightLayoutBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                const current = entry.effectiveConfig.spotlightConfig?.spotlightLayout || 'Border';
                const next = current === 'Borderless' ? 'Border' : 'Borderless';
                entry.effectiveConfig.spotlightConfig = {
                    ...(entry.effectiveConfig.spotlightConfig || {}),
                    spotlightLayout: next
                };
                syncSpotlightLayoutButton(spotlightLayoutBtn, next);
                persistAndApply(entry, serverDefaults, () => applyPresentationToElement(entry));
            });
        }

        const spotlightSizeBtn = popover.querySelector('.kefin-section-spotlight-size-btn');
        spotlightSizeBtn?.addEventListener('click', (e) => {
            e.stopPropagation();
            openOptionMenu(spotlightSizeBtn, getSpotlightSizeOptions(), {
                activeValue: entry.effectiveConfig.spotlightConfig?.spotlightSize || 'normal',
                onSelect: (value) => {
                    entry.effectiveConfig.spotlightConfig = {
                        ...(entry.effectiveConfig.spotlightConfig || {}),
                        spotlightSize: value
                    };
                    persistAndApply(entry, serverDefaults, () => applyPresentationToElement(entry));
                }
            });
        });

        const spotlightTilesBtn = popover.querySelector('.kefin-section-spotlight-tiles-btn');
        if (spotlightTilesBtn) {
            syncSpotlightTilesButton(
                spotlightTilesBtn,
                entry.effectiveConfig.spotlightConfig?.tileCount || 1
            );
            spotlightTilesBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                const current = normalizeSpotlightTileCount(
                    entry.effectiveConfig.spotlightConfig?.tileCount
                );
                const next = nextSpotlightTileCount(current);
                entry.effectiveConfig.spotlightConfig = {
                    ...(entry.effectiveConfig.spotlightConfig || {}),
                    tileCount: next
                };
                syncSpotlightTilesButton(spotlightTilesBtn, next);
                persistAndApply(entry, serverDefaults, () => rerenderSection(entry));
            });
        }

        bindOrderButton(popover.querySelector('.kefin-section-order-up'), {
            onClick: () => swapSectionOrder(sectionConfig.id, 'up'),
            onLongPress: () => moveSectionToBoundary(sectionConfig.id, 'top')
        });
        bindOrderButton(popover.querySelector('.kefin-section-order-down'), {
            onClick: () => swapSectionOrder(sectionConfig.id, 'down'),
            onLongPress: () => moveSectionToBoundary(sectionConfig.id, 'bottomNonDiscovery')
        });

        popover.querySelector('.kefin-section-unpin-button')?.addEventListener('click', async (e) => {
            e.stopPropagation();
            const btn = e.currentTarget;
            btn.disabled = true;
            try {
                closePopover();
                const ok = window.KefinHomeScreenPin?.unpinParentSection
                    && await window.KefinHomeScreenPin.unpinParentSection(sectionConfig.id, entry.element);
                if (!ok) {
                    btn.disabled = false;
                }
            } catch (err) {
                WARN('Unpin failed:', err);
                btn.disabled = false;
            }
        });

        popover.querySelector('.kefin-section-restore-defaults-btn')?.addEventListener('click', (e) => {
            e.stopPropagation();
            if (!sectionHasUserOverrides(entry, serverDefaults)) return;
            openRestoreSectionDefaultsConfirm(() => restoreSectionToServerDefaults(entry, serverDefaults));
        });

        popover.querySelector('.kefin-section-more-toggle')?.addEventListener('click', (e) => {
            e.stopPropagation();
            const willExpand = !popover.classList.contains('is-expanded');
            popover.classList.toggle('is-expanded', willExpand);
            const moreBtn = popover.querySelector('.kefin-section-more-toggle');
            if (moreBtn) moreBtn.setAttribute('aria-expanded', String(willExpand));
        });

        const outsideHandler = (e) => {
            // Drag started in Pickr but released outside — not a real dismiss click
            if (pickrGestureFromApp) return;
            if (popover.contains(e.target) || anchorButton.contains(e.target)) return;
            // Pickr mounts its app on document.body (outside our modals)
            if (e.target.closest?.('.pcr-app, .pickr, .kefin-pickr-app')) return;
            const modalHost = e.target.closest?.('[data-modal-id]');
            const modalId = modalHost?.getAttribute('data-modal-id');
            if (modalId === OPTION_MENU_MODAL_ID || modalId === CARD_TITLE_MENU_MODAL_ID || modalId === RESTORE_SECTION_MODAL_ID || modalId === PUBLISH_SECTION_MODAL_ID) return;
            if (e.target.closest(
                '.kefin-section-format-btn, .kefin-section-border-style-btn, .kefin-section-card-title-btn, .kefin-section-spotlight-layout-btn, .kefin-section-spotlight-size-btn, .kefin-section-spotlight-tiles-btn'
            )) return;
            closePopover();
        };
        setTimeout(() => document.addEventListener('click', outsideHandler, true), 0);

        const stopTracking = startPopoverTracking();

        activePopover = {
            popover,
            entry,
            anchorButton,
            mountElement,
            sectionElement,
            outsideHandler,
            stopTracking,
            formatMenu: null,
            formatMenuAnchor: null,
            formatMenuModalId: null,
            placementLocked: false,
            anchorMode: null
        };

        requestAnimationFrame(() => repositionActivePopover());
    }

    function escapeHtml(str) {
        return String(str || '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    function createConfigureButton(sectionConfig, sectionElement) {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'section-configure-button material-icons settings';
        button.title = 'Configure Section';
        button.setAttribute('aria-label', 'Configure Section');
        button.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            openConfigurePopover(sectionConfig, sectionElement, button);
        });
        return button;
    }

    function getConfigureSectionControl(sectionConfig, sectionElement, cachedItems) {
        if (!isEnabled() || sectionConfig.userConfigurable === false) return null;

        const api = getConfigApi();
        const serverDefaults = sectionConfig._userPrefDefaults
            || api.getServerSectionDefaults(sectionConfig);

        registerRuntime({
            sectionId: sectionConfig.id,
            element: sectionElement,
            serverConfig: { ...sectionConfig },
            effectiveConfig: { ...sectionConfig },
            cachedItems: cachedItems || null,
            serverDefaults
        });

        return {
            id: 'configure',
            icon: 'settings',
            label: 'Configure Section',
            className: 'section-configure-button',
            isVisible: () => true,
            onClick: (e, anchorButton) => {
                e.preventDefault();
                e.stopPropagation();
                openConfigurePopover(sectionConfig, sectionElement, anchorButton);
            }
        };
    }

    function attachSectionControls(sectionConfig, sectionElement, cachedItems, mountContainer) {
        if (!isEnabled() || sectionConfig.userConfigurable === false) return;
        getConfigureSectionControl(sectionConfig, sectionElement, cachedItems);
    }

    const style = document.createElement('style');
    style.textContent = `
        .custom-scroller-container:hover .show-all-button,
        .custom-scroller-container:hover .section-refresh-button,
        .custom-scroller-container:hover .section-configure-button,
        .custom-scroller-container:hover .section-controls-more,
        .emby-scroller-container:hover .show-all-button,
        .emby-scroller-container:hover .section-refresh-button,
        .emby-scroller-container:hover .section-configure-button,
        .emby-scroller-container:hover .section-controls-more,
        .spotlight-section:hover .section-configure-button,
        .spotlight-section:hover .section-refresh-button,
        .spotlight-section:hover .section-controls-more {
            opacity: 0.65;
            visibility: visible;
            pointer-events: auto;
            z-index: 1;
            transition:
                opacity 0.25s ease,
                visibility 0s linear 0s,
                transform 0.3s ease,
                color 0.3s ease,
                background 0.2s ease;
        }
        .spotlight-section .section-refresh-button,
        .spotlight-section .section-configure-button {
            opacity: 0;
            visibility: hidden;
            pointer-events: none;
        }
        .kefin-section-configure-popover-open {
            overflow: visible;
        }
        .kefin-section-configure-popover {
            position: absolute;
            bottom: calc(100% - 15px);
            top: auto;
            z-index: 12000;
            box-sizing: border-box;
            display: flex;
            flex-direction: column;
            width: auto;
            min-width: 14rem;
            max-width: min(100vw - 16px, 380px);
            padding: 0.5em;
            overflow: hidden;
        }
        .kefin-section-configure-popover.is-below {
            top: 55px;
            bottom: auto;
            flex-direction: column-reverse;
        }            
        .kefin-section-configure-popover.is-below .kefin-section-configure-title-container {
            order: 1;
        }
        .kefin-section-configure-title-container hr {
            display: block;
        }
        .kefin-section-configure-footer {
            flex-shrink: 0;
        }
        .kefin-section-configure-separator {
            display: none;
            width: 100%;
            margin: 0.35em 0;
            border: none;
            border-top: 1px solid rgba(255, 255, 255, 0.14);
        }
        .kefin-section-configure-popover.is-expanded .kefin-section-configure-separator {
            display: block;
        }
        .kefin-section-configure-more-panel {
            flex-shrink: 0;
            display: grid;
            grid-template-rows: 0fr;
            transition: grid-template-rows 0.25s ease;
        }
        .kefin-section-configure-popover.is-expanded .kefin-section-configure-more-panel {
            grid-template-rows: 1fr;
        }
        .kefin-section-configure-more-panel-inner {
            min-height: 0;
            overflow: hidden;
            display: flex;
            flex-direction: column;
            gap: 0.75em;
            padding-bottom: 0;
            padding-top: 0;
            transition: padding-bottom 0.25s ease, padding-top 0.25s ease;
        }
        .kefin-section-configure-popover.is-expanded:not(.is-below) .kefin-section-configure-more-panel-inner {
            padding: 0.35em;
        }
        .kefin-section-configure-popover.is-expanded.is-below .kefin-section-configure-more-panel-inner {
            padding: 0.35em;
        }
        .kefin-section-configure-primary-row {
            display: flex;
            align-items: center;
            gap: 0.2em;
        }
        .kefin-section-configure-order {
            display: flex;
            gap: 0;
            align-items: center;
        }
        .kefin-section-configure-primary-row .paper-icon-button-light {
            margin: 0;
            min-width: 2.25rem;
            width: 2.25rem;
            height: 2.25rem;
            padding: 0;
            display: inline-flex;
            align-items: center;
            justify-content: center;
        }
        .kefin-section-configure-primary-row .paper-icon-button-light .material-icons {
            font-size: 1.25rem;
        }
        .kefin-section-configure-primary-row .kefin-section-restore-defaults-btn {
            margin-left: auto;
        }
        .kefin-section-visibility-btn.is-hidden-visibility {
            opacity: 0.45;
        }
        .kefin-section-restore-defaults-btn.is-disabled,
        .kefin-section-restore-defaults-btn:disabled {
            opacity: 0.4;
            pointer-events: none;
        }
        .kefin-section-more-toggle[aria-expanded="true"] {
            opacity: 1;
        }
        .kefin-section-configure-field {
            display: flex;
            flex-direction: column;
            gap: 0.25em;
            width: 100%;
            min-width: 0;
        }
        .kefin-section-configure-field-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 0.65em 0.75em;
            width: 100%;
        }
        .kefin-section-configure-field-label {
            display: block;
            margin-bottom: 0;
            font-size: 0.9em;
            line-height: 1.25;
        }
        .kefin-section-configure-field-desc {
            font-size: 0.78em;
            line-height: 1.35;
        }
        .kefin-section-configure-field-control {
            width: 100%;
        }
        .kefin-section-configure-field-control .emby-input,
        .kefin-section-configure-field-control .emby-select {
            width: 100%;
            min-width: 0;
            box-sizing: border-box;
        }
        .kefin-section-configure-toggle-card {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 0.75em;
            width: 100%;
            box-sizing: border-box;
            padding: 0.85em;
            border: 1px solid rgba(255, 255, 255, 0.12);
            border-radius: 10px;
            background: rgba(255, 255, 255, 0.03);
        }
        .kefin-section-configure-toggle-card-text {
            display: flex;
            flex-direction: column;
            min-width: 0;
            flex: 1;
        }
        .kefin-section-configure-toggle-card-label {
            font-weight: 500;
            line-height: 1.35;
        }
        .kefin-section-configure-toggle-card-desc,
        .kefin-section-configure-row-desc {
            font-size: 0.8125rem;
            margin-top: 0.25em;
            line-height: 1.45;
        }
        .kefin-section-configure-cache-control {
            flex: 0 0 auto;
            min-width: 7.5rem;
            max-width: 11rem;
            display: flex;
            align-items: center;
            justify-content: flex-end;
        }
        .kefin-section-configure-cache-control .emby-input,
        .kefin-section-configure-cache-control .kefin-section-cache-select {
            width: 100%;
            min-width: 0;
            box-sizing: border-box;
        }
        .kefin-section-configure-row {
            display: flex;
            align-items: flex-start;
            justify-content: space-between;
            gap: 0.75em;
        }
        .kefin-section-configure-row-copy {
            display: flex;
            flex-direction: column;
            gap: 0.15em;
            min-width: 0;
            flex: 1 1 auto;
        }
        .kefin-section-configure-row-label {
            font-size: 0.9em;
            line-height: 1.25;
        }
        .kefin-section-configure-row-control {
            flex: 0 0 auto;
            min-width: 7.5rem;
            display: flex;
            align-items: center;
            justify-content: flex-end;
        }
        .kefin-section-configure-row-control .emby-input {
            width: 100%;
            min-width: 0;
        }
        .kefin-section-configure-toggle {
            display: flex;
            align-items: center;
            min-height: 28px;
            flex-shrink: 0;
        }
        .kefin-section-format-menu-body {
            min-width: 8rem;
            padding: 0.15em 0;
        }
        .kefin-section-format-menu-body.has-color-controls {
            display: flex;
            flex-direction: column;
            max-height: none;
            padding-bottom: 0.25em;
        }
        .kefin-section-format-menu-header {
            padding-bottom: 0.15em;
            border-bottom: 1px solid rgba(255, 255, 255, 0.1);
            display: grid;
            grid-template-columns: 1fr 1fr;
            align-items: center;
        }
        .kefin-section-format-menu-options {
            padding: 0.15em 0;
            display: grid;
            grid-template-columns: 1fr 1fr;
        }
        .kefin-section-format-gapless {
            display: flex;
            align-items: center;
            gap: 0.4em;
            padding: 0.35em 0.75em;
            margin: 0;
            cursor: pointer;
            font: inherit;
            color: inherit;
            user-select: none;
        }
        .kefin-section-format-gapless-input {
            margin: 0;
            cursor: pointer;
        }
        .kefin-section-format-option {
            display: block;
            width: 100%;
            padding: 0.45em 0.75em;
            border: none;
            background: transparent;
            color: inherit;
            text-align: left;
            cursor: pointer;
            font: inherit;
        }
        .kefin-section-format-option:hover,
        .kefin-section-format-option.is-active {
            background: rgba(0, 164, 220, 0.15);
        }
        .kefin-section-format-color-row {
            display: flex;
            align-items: center;
            gap: 0.35em;
            padding: 0.35em 0.75em 0.45em;
        }
        .kefin-section-color-swatch {
            width: 1.5rem;
            height: 1.5rem;
            padding: 0;
            border: 1px solid rgba(255,255,255,0.2);
            border-radius: 4px;
            background: var(--kefin-swatch-color, #e8dab2);
            cursor: pointer;
            flex-shrink: 0;
        }
        .kefin-section-color-swatch:disabled {
            cursor: not-allowed;
        }
        .kefin-section-card-title-menu-body {
            min-width: auto;
            padding: 0.25em 0.35em;
            display: flex;
            flex-direction: column;
            gap: 0;
        }
        .kefin-section-card-title-menu-icons {
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 0.1em;
        }
        .kefin-section-card-title-menu-icons .kefin-section-format-color-row {
            padding: 0;
            gap: 0.1em;
        }
        .kefin-pickr-app,
        .pcr-app.kefin-pickr-app {
            z-index: 2147483000 !important;
            pointer-events: auto !important;
        }
        .kefin-section-card-title-menu-icons .paper-icon-button-light {
            margin: 0;
            min-width: 2.25rem;
            width: 2.25rem;
            height: 2.25rem;
            padding: 0;
            display: inline-flex;
            align-items: center;
            justify-content: center;
        }
        .kefin-section-card-title-menu-icons .paper-icon-button-light .material-icons {
            font-size: 1.25rem;
        }
        .kefin-section-card-title-visibility-btn.is-hidden-visibility {
            opacity: 0.45;
        }
        .kefin-section-format-color-row.is-disabled {
            opacity: 0.4;
            pointer-events: none;
        }
        .kefin-section-color-reset {
            min-width: auto;
            padding: 0;
            display: inline-flex;
            align-items: center;
            justify-content: center;
        }
        .kefin-section-color-reset.is-hidden {
            display: none !important;
        }
        .kefin-section-configure-title-container h3 {
            margin: 0;
            flex: 1 1 auto;
            min-width: 0;
        }
        .kefin-section-configure-title-row {
            display: flex;
            align-items: center;
            gap: 0.15rem;
            margin: 0 0 0.5rem 0.5rem;
        }
        .kefin-section-configure-title-row .kefin-section-open-editor-btn,
        .kefin-section-configure-title-row .kefin-section-publish-btn {
            flex: 0 0 auto;
            opacity: 0.85;
            padding: 0;
            margin: 0;
            width: 2.25rem;
            height: 2.25rem;
        }
        .kefin-section-configure-title-row .kefin-section-open-editor-btn .material-icons,
        .kefin-section-configure-title-row .kefin-section-publish-btn .material-icons {
            font-size: 1.25rem;
        }
        .kefin-section-configure-title-row .kefin-section-open-editor-btn[hidden],
        .kefin-section-configure-title-row .kefin-section-publish-btn[hidden] {
            display: none !important;
        }
        .kefin-section-configure-title-row .kefin-section-open-editor-btn:hover,
        .kefin-section-configure-title-row .kefin-section-publish-btn:hover {
            opacity: 1;
        }
    `;
    document.head.appendChild(style);

    window.KefinHomeScreenSectionConfigure = {
        isEnabled,
        attachSectionControls,
        createConfigureButton,
        getConfigureSectionControl,
        updateRuntimeItemsLayout,
        updateRuntimeGridExpanded
    };

    LOG('Module loaded');
})();
