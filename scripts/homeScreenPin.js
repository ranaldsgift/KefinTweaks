// Pin items to home screen via context menu
(function() {
    'use strict';

    const LOG = (...args) => console.log('[KefinTweaks HomeScreenPin]', ...args);
    const WARN = (...args) => console.warn('[KefinTweaks HomeScreenPin]', ...args);

    const PARENT_PIN_TYPES = new Set([
        'CollectionFolder',
        'BoxSet',
        'Playlist',
        'Series',
        'Season',
        'MusicAlbum',
        'MusicArtist',
        'MusicGenre',
        'Genre',
        'Studio',
        'Person',
        'Tag'
    ]);

    let capturedItemId = null;
    let capturedCard = null;
    let pendingUnpinStash = null;
    const UNPIN_FADE_MS = 350;
    const LAST_PINNED_LIST_KEY = 'kefinTweaks_lastPinnedList';

    function getLastPinnedListKey() {
        const serverId = typeof ApiClient !== 'undefined' && ApiClient?.serverId
            ? ApiClient.serverId()
            : '';
        const userId = typeof ApiClient !== 'undefined' && ApiClient?.getCurrentUserId
            ? ApiClient.getCurrentUserId()
            : '';
        return `${LAST_PINNED_LIST_KEY}_${serverId}_${userId}`;
    }

    function getLastPinnedList() {
        try {
            return localStorage.getItem(getLastPinnedListKey()) || '';
        } catch {
            return '';
        }
    }

    function setLastPinnedList(listName) {
        if (!listName) return;
        try {
            localStorage.setItem(getLastPinnedListKey(), listName);
        } catch {
            /* ignore quota / private mode */
        }
    }

    function getUserSettings() {
        return window.KefinTweaksConfig?.homeScreenConfig?.USER_HOME_SCREEN_SETTINGS || {};
    }

    function isEnabled() {
        return getUserSettings().pinning !== false;
    }

    function getConfigApi() {
        return window.KefinUserHomeScreenConfig;
    }

    async function loadHomeScreen() {
        const api = getConfigApi();
        if (!window.userHelper?.getUserDisplayPreferences) {
            return api.createEmptyHomeScreen();
        }
        const { promise } = await window.userHelper.getUserDisplayPreferences();
        const displayPrefs = await promise;
        return api.parseKefinTweaksHomeScreen(displayPrefs?.CustomPrefs);
    }

    async function saveHomeScreen(homeScreen, { refreshHome = true } = {}) {
        const ok = await getConfigApi().saveKefinTweaksHomeScreen(homeScreen);
        if (ok && refreshHome && window.homeScreen3?.refreshHomeSections) {
            await window.homeScreen3.refreshHomeSections();
        } else if (ok && refreshHome && window.KefinTweaksToaster?.toast) {
            window.KefinTweaksToaster.toast('Pinned — refresh home to see changes.');
        }
        return ok;
    }

    function cloneHomeScreen(homeScreen) {
        const hs = homeScreen || {};
        return {
            sections: [...(hs.sections || [])],
            pinnedLists: [...(hs.pinnedLists || [])],
            pinnedParents: [...(hs.pinnedParents || [])]
        };
    }

    function getSectionDisplayName(sectionEl, fallback) {
        const title = sectionEl?.querySelector?.(
            '.sectionTitle, .sectionTitle-cards, .spotlight-section-title'
        )?.textContent?.trim();
        return title || fallback || 'Pinned';
    }

    function getCardDisplayName(card, fallback) {
        const fromAria = card?.querySelector?.('.cardImageContainer')?.getAttribute('aria-label')?.trim();
        const fromTitle = card?.querySelector?.('.cardText-first, .cardText')?.textContent?.trim();
        return fromAria || fromTitle || fallback || 'item';
    }

    function fadeOutSection(el) {
        return new Promise((resolve) => {
            if (!el) {
                resolve({ parent: null, nextSibling: null });
                return;
            }
            const parent = el.parentNode;
            const nextSibling = el.nextSibling;
            el.style.transition = `opacity ${UNPIN_FADE_MS}ms ease`;
            el.style.opacity = '0';
            setTimeout(() => resolve({ parent, nextSibling }), UNPIN_FADE_MS);
        });
    }

    function fadeInSection(el) {
        if (!el) return;
        el.style.transition = `opacity ${UNPIN_FADE_MS}ms ease`;
        el.style.opacity = '0';
        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                el.style.opacity = '1';
            });
        });
    }

    function showUnpinnedToast(name, onUndo) {
        const toaster = window.KefinTweaksToaster;
        if (!toaster?.toast) return null;
        const handle = toaster.toast(
            `Unpinned ${name}`,
            '8',
            true,
            {
                action: {
                    icon: 'undo',
                    label: 'Undo',
                    onClick: () => {
                        onUndo?.();
                        handle?.dismiss?.();
                    }
                }
            }
        );
        return handle;
    }

    async function undoUnpin() {
        const stash = pendingUnpinStash;
        pendingUnpinStash = null;
        if (!stash?.restoreHomeScreen) {
            window.homeScreen3?.refreshHomeSections?.();
            return;
        }

        const ok = await saveHomeScreen(stash.restoreHomeScreen, { refreshHome: false });
        if (!ok) {
            window.homeScreen3?.refreshHomeSections?.();
            return;
        }

        const el = stash.element;
        const parentStillValid = stash.parent && document.contains(stash.parent);
        if (el && parentStillValid) {
            el.style.transition = '';
            el.style.opacity = '0';
            if (stash.nextSibling && stash.nextSibling.parentNode === stash.parent) {
                stash.parent.insertBefore(el, stash.nextSibling);
            } else {
                stash.parent.appendChild(el);
            }
            if (stash.runtimeEntry) {
                stash.runtimeEntry.element = el;
                window.KefinHomeScreenSectionRuntime?.register?.(stash.runtimeEntry);
            }
            el.querySelectorAll?.('.unpin-item-button[disabled]')?.forEach((btn) => {
                btn.disabled = false;
            });
            fadeInSection(el);
            const itemsContainer = el.classList?.contains('card')
                ? el.closest?.('.itemsContainer')
                : el.querySelector?.('.itemsContainer');
            if (itemsContainer) updateAllReorderChevrons(itemsContainer);
            return;
        }

        window.homeScreen3?.refreshHomeSections?.();
    }

    async function beginSectionUnpin({ sectionId, sectionEl, sectionName, restoreHomeScreen }) {
        const runtimeEntry = window.KefinHomeScreenSectionRuntime?.get?.(sectionId) || null;
        const { parent, nextSibling } = await fadeOutSection(sectionEl);
        pendingUnpinStash = {
            sectionId,
            sectionName,
            element: sectionEl,
            parent,
            nextSibling,
            restoreHomeScreen,
            runtimeEntry
        };
        sectionEl?.remove();
        window.KefinHomeScreenSectionRuntime?.unregister?.(sectionId);
        showUnpinnedToast(sectionName || 'section', () => {
            void undoUnpin();
        });
    }

    async function beginItemUnpin({ card, itemName, restoreHomeScreen }) {
        const { parent, nextSibling } = await fadeOutSection(card);
        pendingUnpinStash = {
            sectionId: null,
            sectionName: itemName,
            element: card,
            parent,
            nextSibling,
            restoreHomeScreen,
            runtimeEntry: null
        };
        card?.remove();
        showUnpinnedToast(itemName || 'item', () => {
            void undoUnpin();
        });
    }

    function findMoreMenuButton(element) {
        return element?.closest?.('button[data-action="menu"], button.btnMoreCommands.detailButton') || null;
    }

    function clearCapturedPinTarget() {
        capturedItemId = null;
        capturedCard = null;
    }

    function isItemActionSheet(actionSheetContent) {
        if (!actionSheetContent) return false;
        return !!(
            actionSheetContent.querySelector('button[data-id="multiSelect"]')
            || actionSheetContent.querySelector('button[data-id="resume"]')
            || actionSheetContent.querySelector('button[data-id="addtoplaylist"]')
        );
    }

    function getDetailPageItemId(detailButtons) {
        if (!detailButtons) return null;
        const itemBtn = detailButtons.querySelector('button.btnPlaystate[data-id], button.btnUserRating[data-id]');
        return itemBtn?.getAttribute('data-id') || itemBtn?.dataset?.id || null;
    }

    function capturePinTargetFromTrigger(trigger) {
        if (!trigger) {
            clearCapturedPinTarget();
            return false;
        }

        const menuBtn = findMoreMenuButton(trigger);
        const contextEl = menuBtn || trigger;
        const card = contextEl.closest?.('.card[data-id]');
        if (card) {
            capturedCard = card;
            capturedItemId = card.getAttribute('data-id');
            if (capturedItemId) return true;
            clearCapturedPinTarget();
            return false;
        }

        const detailButtons = contextEl.closest?.('.mainDetailButtons');
        const detailItemId = getDetailPageItemId(detailButtons);
        if (detailItemId) {
            capturedCard = null;
            capturedItemId = detailItemId;
            return true;
        }

        clearCapturedPinTarget();
        return false;
    }

    function captureFromEvent(e) {
        if (e.target.closest('.actionSheetContent')) return;
        capturePinTargetFromTrigger(e.target);
    }

    function getListNames(homeScreen) {
        const names = (homeScreen.pinnedLists || [])
            .map(str => getConfigApi().parsePinnedListString(str)?.name)
            .filter(Boolean);
        if (!names.includes(getConfigApi().DEFAULT_PINNED_LIST_NAME)) {
            names.unshift(getConfigApi().DEFAULT_PINNED_LIST_NAME);
        }
        return [...new Set(names)];
    }

    function upsertPinnedList(homeScreen, listName, itemId) {
        const api = getConfigApi();
        const idx = (homeScreen.pinnedLists || []).findIndex(str => {
            const parsed = api.parsePinnedListString(str);
            return parsed?.name === listName;
        });
        if (idx >= 0) {
            const parsed = api.parsePinnedListString(homeScreen.pinnedLists[idx]);
            const ids = [...new Set([...(parsed?.ids || []), itemId])];
            homeScreen.pinnedLists[idx] = api.serializePinnedList(listName, ids);
        } else {
            homeScreen.pinnedLists.push(api.serializePinnedList(listName, [itemId]));
        }
        return homeScreen;
    }

    function upsertPinnedParent(homeScreen, listName, parentId, parentType) {
        const api = getConfigApi();
        const idx = (homeScreen.pinnedParents || []).findIndex(str => {
            const parsed = api.parsePinnedParentString(str);
            return parsed?.parentId === parentId;
        });
        const entry = api.serializePinnedParent(listName, parentId, parentType);
        if (idx >= 0) homeScreen.pinnedParents[idx] = entry;
        else homeScreen.pinnedParents.push(entry);
        return homeScreen;
    }

    function removeItemFromPinnedList(homeScreen, listName, itemId) {
        const api = getConfigApi();
        homeScreen.pinnedLists = (homeScreen.pinnedLists || []).map(str => {
            const parsed = api.parsePinnedListString(str);
            if (!parsed || parsed.name !== listName) return str;
            const ids = parsed.ids.filter(id => id !== itemId);
            return ids.length ? api.serializePinnedList(listName, ids) : null;
        }).filter(Boolean);
        return homeScreen;
    }

    function removePinnedParent(homeScreen, parentId) {
        homeScreen.pinnedParents = (homeScreen.pinnedParents || []).filter(str => {
            const parsed = getConfigApi().parsePinnedParentString(str);
            return parsed?.parentId !== parentId;
        });
        return homeScreen;
    }

    function getHomeSectionsContainer() {
        return document.querySelector('.homePage:not(.hide) #homeTab .sections');
    }

    function findSectionById(container, sectionId) {
        if (!container || !sectionId) return null;
        return container.querySelector(`[data-section-id="${CSS.escape(sectionId)}"]`);
    }

    function scrollToHomeSection(el) {
        if (!el) return;
        try {
            el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        } catch (_) {
            el.scrollIntoView(true);
        }
    }

    function getPinnedDefaultOrder() {
        const value = parseInt(getConfigApi()?.PINNED_DEFAULT_ORDER, 10);
        return Number.isFinite(value) ? value : 5;
    }

    function readSectionOrder(el) {
        const fromData = parseInt(el?.dataset?.order, 10);
        if (Number.isFinite(fromData)) return fromData;
        const fromStyle = parseInt(el?.style?.order, 10);
        if (Number.isFinite(fromStyle)) return fromStyle;
        return 0;
    }

    /**
     * Shift live DOM/runtime section orders at or above slot by +1.
     */
    function shiftSectionsAtOrAbove(container, slot) {
        if (!container) return;
        container.querySelectorAll('[data-section-id]').forEach((el) => {
            const order = readSectionOrder(el);
            if (order < slot) return;
            const next = order + 1;
            el.dataset.order = String(next);
            el.style.order = String(next);
            const runtime = window.KefinHomeScreenSectionRuntime?.get?.(el.dataset.sectionId);
            if (runtime?.effectiveConfig) runtime.effectiveConfig.order = next;
        });
    }

    /**
     * Mutate homeScreen prefs: bump order for every section at/above slot, then
     * assign the new pinned section order = slot. Uses DOM orders when a section
     * has no saved pref yet.
     */
    function prepareNewPinnedSectionOrder(homeScreen, container, newSectionId) {
        const api = getConfigApi();
        const slot = getPinnedDefaultOrder();
        let hs = homeScreen || api.createEmptyHomeScreen();
        if (!Array.isArray(hs.sections)) hs.sections = [];

        const prefMap = new Map();
        hs.sections.forEach((str) => {
            const pref = api.parseSectionPrefString(str);
            if (pref?.id) prefMap.set(pref.id, pref);
        });

        const sectionOrders = new Map();
        prefMap.forEach((pref, id) => {
            if (pref.order !== undefined) sectionOrders.set(id, pref.order);
        });
        container?.querySelectorAll?.('[data-section-id]')?.forEach((el) => {
            const id = el.dataset.sectionId;
            if (!id || id === newSectionId) return;
            if (!sectionOrders.has(id)) sectionOrders.set(id, readSectionOrder(el));
        });

        sectionOrders.forEach((order, id) => {
            if (id === newSectionId || order < slot) return;
            const existing = prefMap.get(id);
            const next = existing
                ? { ...existing, order: order + 1 }
                : { id, enabled: true, order: order + 1 };
            hs = api.upsertSectionPref(hs, next);
            prefMap.set(id, next);
        });

        hs = api.upsertSectionPref(hs, {
            id: newSectionId,
            enabled: true,
            order: slot
        });
        return hs;
    }

    function mountPinnedSection(container, config, items) {
        if (!container || !config || !window.cardBuilder?.renderCards) return null;
        if (!items?.length) return null;

        const el = window.cardBuilder.renderCards(
            items,
            config.name,
            config.viewMoreUrl || null,
            true,
            config.cardFormat || 'Poster',
            null,
            'Ascending'
        );
        if (!el) return null;

        el.setAttribute('data-section-id', config.id);
        el.dataset.order = String(config.order);
        el.style.order = String(config.order);

        container.appendChild(el);
        fadeInSection(el);
        window.cardBuilder.attachSectionControlButtons?.(config, el, items);
        return el;
    }

    function updateRuntimeAfterListPin(sectionId, item, ids) {
        const entry = window.KefinHomeScreenSectionRuntime?.get?.(sectionId);
        if (!entry) return;
        if (Array.isArray(entry.cachedItems) && item && !entry.cachedItems.some(i => i?.Id === item.Id)) {
            entry.cachedItems = [...entry.cachedItems, item];
        }
        if (Array.isArray(ids) && Array.isArray(entry.cachedItems)) {
            const byId = new Map(entry.cachedItems.filter(Boolean).map((i) => [String(i.Id), i]));
            entry.cachedItems = ids.map((id) => byId.get(String(id))).filter(Boolean);
        }
        const query = entry.effectiveConfig?.queries?.[0];
        if (query?.queryOptions && Array.isArray(ids)) {
            query.queryOptions.Ids = [...ids];
        }
    }

    async function applyPinItInline(item, listName, homeScreen) {
        const container = getHomeSectionsContainer();
        if (!container || !item?.Id) return;

        const api = getConfigApi();
        const sectionId = api.getPinnedListSectionId(listName);
        const existing = findSectionById(container, sectionId);

        if (existing) {
            const itemsContainer = existing.querySelector('.itemsContainer');
            if (itemsContainer && !itemsContainer.querySelector(`.card[data-id="${CSS.escape(item.Id)}"]`)) {
                const cardFormat = existing.getAttribute('data-card-format')
                    || window.KefinHomeScreenSectionRuntime?.get?.(sectionId)?.effectiveConfig?.cardFormat
                    || 'Poster';
                const card = window.cardBuilder?.buildCard?.(item, true, cardFormat);
                if (card) {
                    itemsContainer.appendChild(card);
                    window.cardBuilder?.invalidateLastRowPadding?.(itemsContainer);
                    addUnpinButton(card);
                    addReorderButtons(card);
                    updateAllReorderChevrons(itemsContainer);
                }
            }
            const listEntry = (homeScreen.pinnedLists || []).find(str => {
                const parsed = api.parsePinnedListString(str);
                return parsed && api.getPinnedListSectionId(parsed.name) === sectionId;
            });
            const parsed = api.parsePinnedListString(listEntry);
            updateRuntimeAfterListPin(sectionId, item, parsed?.ids);
            scrollToHomeSection(existing);
            return;
        }

        const configs = api.buildPinnedSectionConfigs(homeScreen) || [];
        const config = configs.find(c => c.id === sectionId);
        if (!config) return;
        const slot = getPinnedDefaultOrder();
        shiftSectionsAtOrAbove(container, slot);
        config.order = slot;
        const el = mountPinnedSection(container, config, [item]);
        scrollToHomeSection(el);
    }

    async function applyPinChildrenInline(item, homeScreen) {
        const container = getHomeSectionsContainer();
        if (!container || !item?.Id) return;

        const api = getConfigApi();
        const sectionId = api.getPinnedParentSectionId(item.Id);
        const existing = findSectionById(container, sectionId);
        if (existing) {
            scrollToHomeSection(existing);
            return;
        }

        const configs = api.buildPinnedSectionConfigs(homeScreen) || [];
        const config = configs.find(c => c.id === sectionId);
        if (!config) return;
        const slot = getPinnedDefaultOrder();
        shiftSectionsAtOrAbove(container, slot);
        config.order = slot;

        const parent = {
            name: (item.Name || '').trim() || config.name,
            parentId: item.Id,
            parentType: item.Type || null
        };
        config.viewMoreUrl = api.buildPinnedParentViewMoreUrl?.(parent, ApiClient.serverId())
            || `#/details?id=${encodeURIComponent(item.Id)}&serverId=${encodeURIComponent(ApiClient.serverId())}`;

        const queryOptions = api.buildPinnedParentQueryOptions?.(parent) || {
            ParentId: item.Id,
            Limit: 16,
            SortBy: 'Random'
        };

        let items = [];
        try {
            const result = await ApiClient.getItems(ApiClient.getCurrentUserId(), queryOptions);
            items = result?.Items || [];
        } catch (err) {
            WARN('Failed to load pinned parent children:', err);
            return;
        }
        if (!items.length) return;

        const el = mountPinnedSection(container, config, items);
        scrollToHomeSection(el);
    }

    function openPinItModal(item) {
        const modalId = 'kefin-pin-it-modal';
        loadHomeScreen().then(homeScreen => {
            const listNames = getListNames(homeScreen);
            const lastList = getLastPinnedList();
            const defaultList = listNames.includes(lastList)
                ? lastList
                : (listNames[0] || getConfigApi().DEFAULT_PINNED_LIST_NAME);
            const options = listNames.map((name) => {
                const selected = name === defaultList ? ' selected' : '';
                return `<option value="${escapeAttr(name)}"${selected}>${escapeHtml(name)}</option>`;
            }).join('')
                + '<option value="__new__">New...</option>';

            const content = `
                <div class="kefin-pin-it-flow">
                    <label class="listItemBodyText secondary">List</label>
                    <select id="kefin-pin-list-select" class="emby-input" style="width:100%;margin-top:0.35em;">${options}</select>
                    <div id="kefin-pin-new-list-wrap" style="display:none;margin-top:0.75em;">
                        <label class="listItemBodyText secondary">New list name</label>
                        <input type="text" id="kefin-pin-new-list-name" class="emby-input" style="width:100%;margin-top:0.35em;" placeholder="List name">
                    </div>
                    <div class="kefin-pin-it-actions">
                        <button type="button" class="emby-button raised" onclick="window.ModalSystem.close('${modalId}')">Cancel</button>
                        <button type="button" class="emby-button raised button-submit" id="kefin-pin-it-confirm">Pin</button>
                    </div>
                </div>
            `;

            window.ModalSystem.create({
                id: modalId,
                content,
                closeOnBackdrop: true,
                closeOnEscape: true,
                onOpen: (modal) => {
                    const select = modal.dialogContent.querySelector('#kefin-pin-list-select');
                    const newWrap = modal.dialogContent.querySelector('#kefin-pin-new-list-wrap');
                    select?.addEventListener('change', () => {
                        if (newWrap) newWrap.style.display = select.value === '__new__' ? 'block' : 'none';
                    });
                    modal.dialogContent.querySelector('#kefin-pin-it-confirm')?.addEventListener('click', async () => {
                        let listName = select?.value || getConfigApi().DEFAULT_PINNED_LIST_NAME;
                        if (listName === '__new__') {
                            listName = modal.dialogContent.querySelector('#kefin-pin-new-list-name')?.value?.trim();
                            if (!listName) return;
                        }
                        const api = getConfigApi();
                        const sectionId = api.getPinnedListSectionId(listName);
                        const container = getHomeSectionsContainer();
                        let hs = await loadHomeScreen();
                        const listAlreadyExists = (hs.pinnedLists || []).some((str) => {
                            const parsed = api.parsePinnedListString(str);
                            return parsed
                                && api.getPinnedListSectionId(parsed.name) === sectionId
                                && parsed.ids.length > 0;
                        });
                        const isNewSection = !findSectionById(container, sectionId) && !listAlreadyExists;
                        hs = upsertPinnedList(hs, listName, item.Id);
                        if (isNewSection) {
                            hs = prepareNewPinnedSectionOrder(hs, container, sectionId);
                        }
                        const ok = await saveHomeScreen(hs, { refreshHome: false });
                        if (ok) {
                            setLastPinnedList(listName);
                            window.ModalSystem.close(modalId);
                            if (window.KefinTweaksToaster?.toast) {
                                window.KefinTweaksToaster.toast(`Pinned to ${listName}`);
                            }
                            try {
                                await applyPinItInline(item, listName, hs);
                            } catch (err) {
                                WARN('Inline pin list update failed:', err);
                            }
                        }
                    });
                }
            });
        });
    }

    async function pinChildrenImmediate(item, modalIdToClose = null) {
        if (!item?.Id) return false;
        if (modalIdToClose) window.ModalSystem.close(modalIdToClose);

        const api = getConfigApi();
        const name = (item.Name || '').trim() || 'Pinned Items';
        const sectionId = api.getPinnedParentSectionId(item.Id);
        const container = getHomeSectionsContainer();
        let hs = await loadHomeScreen();
        const parentAlreadyExists = (hs.pinnedParents || []).some((str) => {
            const parsed = api.parsePinnedParentString(str);
            return parsed?.parentId === item.Id;
        });
        const isNewSection = !findSectionById(container, sectionId) && !parentAlreadyExists;
        hs = upsertPinnedParent(hs, name, item.Id, item.Type);
        if (isNewSection) {
            hs = prepareNewPinnedSectionOrder(hs, container, sectionId);
        }
        const ok = await saveHomeScreen(hs, { refreshHome: false });
        if (ok && window.KefinTweaksToaster?.toast) {
            window.KefinTweaksToaster.toast(`Pinned children as "${name}"`);
        }
        if (ok) {
            try {
                await applyPinChildrenInline(item, hs);
            } catch (err) {
                WARN('Inline pin children update failed:', err);
            }
        }
        return ok;
    }

    function openPinChoiceModal(item) {
        const modalId = 'kefin-pin-choice-modal';
        const content = `
            <div class="kefin-pin-choice-flow">
                <div class="kefin-pin-choice-grid">
                    <button type="button" class="kefin-pin-choice-card" id="kefin-pin-choice-it">
                        <h2 class="listItemBodyText kefin-pin-choice-title">Pin ${item.Name}</h2>
                        <p class="listItemBodyText secondary kefin-pin-choice-desc">Pin this item to a list on your home screen.</p>
                    </button>
                    <button type="button" class="kefin-pin-choice-card" id="kefin-pin-choice-children">
                        <h2 class="listItemBodyText kefin-pin-choice-title">Pin ${item.Name}&apos;s Children</h2>
                        <p class="listItemBodyText secondary kefin-pin-choice-desc">Show this item&apos;s children in a home section.</p>
                    </button>
                </div>
            </div>
        `;
        window.ModalSystem.create({
            id: modalId,
            title: `Pin To Home Screen`,
            content,
            closeOnBackdrop: true,
            closeOnEscape: true,
            onOpen: (modal) => {
                modal.dialogContent.querySelector('#kefin-pin-choice-it')?.addEventListener('click', () => {
                    window.ModalSystem.close(modalId);
                    openPinItModal(item);
                });
                modal.dialogContent.querySelector('#kefin-pin-choice-children')?.addEventListener('click', async () => {
                    await pinChildrenImmediate(item, modalId);
                });
            }
        });
    }

    async function handlePinAction() {
        if (!capturedItemId || !window.ApiClient?.getItem) return;
        try {
            const item = await window.ApiClient.getItem(window.ApiClient.getCurrentUserId(), capturedItemId);
            if (!item) return;
            if (PARENT_PIN_TYPES.has(item.Type)) {
                openPinChoiceModal(item);
            } else {
                openPinItModal(item);
            }
        } catch (e) {
            WARN('Failed to load item for pin:', e);
        }
    }

    function insertPinActionSheetItem(actionSheetContent, pinButton) {
        const scroller = actionSheetContent.querySelector('.actionSheetScroller') || actionSheetContent;
        const dividers = scroller.querySelectorAll('.actionsheetDivider, .actionSheetDivider');

        if (dividers.length >= 2) {
            scroller.insertBefore(pinButton, dividers[1]);
            return;
        }

        if (dividers.length >= 1) {
            scroller.insertBefore(pinButton, dividers[0]);
            return;
        }

        const menuButtons = scroller.querySelectorAll('button.actionSheetMenuItem');
        if (menuButtons.length > 0) {
            const lastButton = menuButtons[menuButtons.length - 1];
            if (lastButton.nextSibling) {
                scroller.insertBefore(pinButton, lastButton.nextSibling);
            } else {
                scroller.appendChild(pinButton);
            }
            return;
        }

        scroller.appendChild(pinButton);
    }

    function offsetActionSheetForPinButton(actionSheetContent, pinButton) {
        const dialog = actionSheetContent.closest('.focuscontainer.dialog.actionSheet')
            || actionSheetContent.closest('.focuscontainer.dialog');
        if (!dialog || !pinButton) return;

        const clampToViewport = () => {
            const margin = 8;
            const maxBottom = window.innerHeight - margin;
            const availableHeight = Math.max(0, window.innerHeight - (margin * 2));

            const scroller = actionSheetContent.querySelector('.actionSheetScroller') || actionSheetContent;
            let rect = dialog.getBoundingClientRect();

            // If taller than the viewport, scroll internally so top/bottom stay on-screen
            if (rect.height > availableHeight && availableHeight > 0) {
                const chrome = Math.max(0, rect.height - scroller.clientHeight);
                const scrollerMax = Math.max(40, availableHeight - chrome);
                scroller.style.maxHeight = `${scrollerMax}px`;
                scroller.style.overflowY = 'auto';
                rect = dialog.getBoundingClientRect();
            }

            let top = parseFloat(dialog.style.top);
            if (Number.isNaN(top)) top = rect.top;

            // Prefer keeping the bottom in view after the pin row grew the menu
            if (rect.bottom > maxBottom) {
                top -= (rect.bottom - maxBottom);
            }
            if (top < margin) {
                top = margin;
            }

            dialog.style.top = `${top}px`;

            // Re-check after applying top (height may still overflow if max-height wasn't needed earlier)
            rect = dialog.getBoundingClientRect();
            if (rect.bottom > maxBottom) {
                top -= (rect.bottom - maxBottom);
                if (top < margin) top = margin;
                dialog.style.top = `${top}px`;
            }
            if (rect.top < margin || dialog.getBoundingClientRect().top < margin) {
                dialog.style.top = `${margin}px`;
            }
        };

        // Double rAF so pin button height is included in layout before measuring
        requestAnimationFrame(() => {
            requestAnimationFrame(clampToViewport);
        });
    }

    function closeOpenActionSheet(fromEl) {
        const dialog = fromEl?.closest?.('.focuscontainer.dialog')
            || fromEl?.closest?.('.dialog');
        if (!dialog) return;
        window.Dashboard?.dialogHelper?.close?.(dialog);
    }

    function injectPinActionSheetItem(actionSheetContent) {
        if (!isEnabled()) return;
        if (!isItemActionSheet(actionSheetContent)) {
            clearCapturedPinTarget();
            return;
        }
        if (!capturedItemId) return;
        if (actionSheetContent.querySelector('[data-kefin-pin-action]')) return;

        const pinButton = document.createElement('button');
        pinButton.setAttribute('is', 'emby-button');
        pinButton.type = 'button';
        pinButton.className = 'listItem listItem-button actionSheetMenuItem emby-button';
        pinButton.setAttribute('data-kefin-pin-action', 'true');
        pinButton.innerHTML = `
            <span class="actionsheetMenuItemIcon listItemIcon listItemIcon-transparent material-icons push_pin" aria-hidden="true"></span>
            <div class="listItemBody actionsheetListItemBody">
                <div class="listItemBodyText actionSheetItemText">Pin to Home Screen</div>
            </div>
        `;
        pinButton.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            closeOpenActionSheet(pinButton);
            handlePinAction();
        });

        insertPinActionSheetItem(actionSheetContent, pinButton);
        offsetActionSheetForPinButton(actionSheetContent, pinButton);
    }

    function setupContextMenuCapture() {
        document.addEventListener('mousedown', (e) => {
            const menuBtn = findMoreMenuButton(e.target);
            if (menuBtn) {
                capturePinTargetFromTrigger(menuBtn);
            } else if (!e.target.closest?.('.actionSheetContent')) {
                // Opening a non-item menu should not reuse a previous item id
                clearCapturedPinTarget();
            }
        }, true);

        document.addEventListener('contextmenu', captureFromEvent, true);

        const observer = new MutationObserver((mutations) => {
            mutations.forEach(mutation => {
                mutation.addedNodes.forEach(node => {
                    if (node.nodeType !== Node.ELEMENT_NODE) return;
                    const sheets = node.matches?.('.actionSheetContent')
                        ? [node]
                        : [...(node.querySelectorAll?.('.actionSheetContent') || [])];
                    sheets.forEach(injectPinActionSheetItem);
                });
            });
        });
        observer.observe(document.body, { childList: true, subtree: true });
    }

    function isPinnedSectionId(sectionId) {
        return sectionId?.startsWith('pinned-list-') || sectionId?.startsWith('pinned-parent-');
    }

    function isPinnedListSectionId(sectionId) {
        return sectionId?.startsWith('pinned-list-');
    }

    function getRealPinnedCards(itemsContainer) {
        if (!itemsContainer) return [];
        return [...itemsContainer.querySelectorAll(':scope > .card[data-id]:not(.card-layout-dummy)')];
    }

    function updateReorderChevronState(card) {
        if (!card) return;
        const itemsContainer = card.closest('.itemsContainer');
        const cards = getRealPinnedCards(itemsContainer);
        const idx = cards.indexOf(card);
        const left = card.querySelector('.pin-reorder-left');
        const right = card.querySelector('.pin-reorder-right');
        if (left) {
            const hide = idx <= 0;
            left.hidden = hide;
            left.disabled = hide;
            left.setAttribute('aria-hidden', hide ? 'true' : 'false');
        }
        if (right) {
            const hide = idx < 0 || idx >= cards.length - 1;
            right.hidden = hide;
            right.disabled = hide;
            right.setAttribute('aria-hidden', hide ? 'true' : 'false');
        }
    }

    function updateAllReorderChevrons(itemsContainer) {
        getRealPinnedCards(itemsContainer).forEach(updateReorderChevronState);
    }

    async function persistPinnedListOrder(sectionEl) {
        const sectionId = sectionEl?.dataset?.sectionId;
        if (!isPinnedListSectionId(sectionId)) return false;

        const itemsContainer = sectionEl.querySelector('.itemsContainer');
        const orderedIds = getRealPinnedCards(itemsContainer)
            .map((c) => c.getAttribute('data-id'))
            .filter(Boolean);
        if (!orderedIds.length) return false;

        const api = getConfigApi();
        let hs = await loadHomeScreen();
        const idx = (hs.pinnedLists || []).findIndex((str) => {
            const parsed = api.parsePinnedListString(str);
            return parsed && api.getPinnedListSectionId(parsed.name) === sectionId;
        });
        if (idx < 0) return false;

        const parsed = api.parsePinnedListString(hs.pinnedLists[idx]);
        hs.pinnedLists[idx] = api.serializePinnedList(parsed.name, orderedIds);
        const ok = await saveHomeScreen(hs, { refreshHome: false });
        if (ok) {
            updateRuntimeAfterListPin(sectionId, null, orderedIds);
            window.cardBuilder?.invalidateLastRowPadding?.(itemsContainer);
        }
        return ok;
    }

    async function movePinnedCard(card, direction) {
        const sectionEl = card?.closest?.('[data-section-id]');
        const itemsContainer = card?.closest?.('.itemsContainer');
        if (!sectionEl || !itemsContainer) return;

        const cards = getRealPinnedCards(itemsContainer);
        const idx = cards.indexOf(card);
        const swapIdx = direction === 'left' ? idx - 1 : idx + 1;
        if (idx < 0 || swapIdx < 0 || swapIdx >= cards.length) return;

        const other = cards[swapIdx];
        if (direction === 'left') {
            itemsContainer.insertBefore(card, other);
        } else {
            itemsContainer.insertBefore(card, other.nextSibling);
        }

        updateAllReorderChevrons(itemsContainer);
        try {
            await persistPinnedListOrder(sectionEl);
        } catch (err) {
            WARN('Pinned list reorder save failed:', err);
        }
    }

    function addReorderButtons(cardOrOverlay) {
        if (!isEnabled()) return;

        const card = cardOrOverlay?.classList?.contains('card')
            ? cardOrOverlay
            : cardOrOverlay?.closest?.('.card');
        if (!card || card.classList.contains('card-layout-dummy')) return;
        if (card.querySelector(':scope > .pin-reorder-left')) return;

        const sectionEl = card.closest('[data-section-id]');
        const sectionId = sectionEl?.dataset?.sectionId;
        if (!isPinnedListSectionId(sectionId)) return;
        if (!card.getAttribute('data-id')) return;

        const makeBtn = (cls, iconName, title, direction) => {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = `pin-reorder-btn paper-icon-button-light ${cls}`;
            btn.setAttribute('data-action', 'none');
            btn.title = title;
            btn.setAttribute('aria-label', title);
            const icon = document.createElement('span');
            icon.className = 'material-icons';
            icon.textContent = iconName;
            icon.setAttribute('aria-hidden', 'true');
            btn.appendChild(icon);
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                if (btn.disabled || btn.hidden) return;
                void movePinnedCard(card, direction);
            });
            return btn;
        };

        const leftBtn = makeBtn('pin-reorder-left', 'chevron_left', 'Move left', 'left');
        const rightBtn = makeBtn('pin-reorder-right', 'chevron_right', 'Move right', 'right');
        // Attach to the card host so edges stay correct with large border styles
        card.appendChild(leftBtn);
        card.appendChild(rightBtn);
        updateReorderChevronState(card);
    }

    function addUnpinButton(cardOrOverlay) {
        if (!isEnabled()) return;

        const card = cardOrOverlay?.classList?.contains('card')
            ? cardOrOverlay
            : cardOrOverlay?.closest?.('.card');
        if (!card || card.classList.contains('card-layout-dummy')) return;
        if (card.querySelector(':scope > .unpin-item-button')) return;

        const sectionEl = card.closest('[data-section-id]');
        const sectionId = sectionEl?.dataset?.sectionId;
        if (!isPinnedSectionId(sectionId)) return;
        if (sectionId.startsWith('pinned-parent-')) return;

        const itemId = card.getAttribute('data-id');
        if (!itemId) return;

        const removeButton = document.createElement('button');
        removeButton.type = 'button';
        removeButton.className = 'unpin-item-button paper-icon-button-light';
        removeButton.setAttribute('data-action', 'none');
        removeButton.title = 'Unpin from Home Screen';
        removeButton.setAttribute('aria-label', 'Unpin from Home Screen');

        const icon = document.createElement('span');
        icon.className = 'material-icons';
        icon.textContent = 'push_pin';
        icon.setAttribute('aria-hidden', 'true');
        removeButton.appendChild(icon);

        removeButton.addEventListener('click', async (e) => {
            e.preventDefault();
            e.stopPropagation();
            removeButton.disabled = true;
            try {
                const api = getConfigApi();
                let hs = await loadHomeScreen();
                const restoreHomeScreen = cloneHomeScreen(hs);
                const realCards = sectionEl
                    ? [...sectionEl.querySelectorAll('.itemsContainer > .card[data-id]:not(.card-layout-dummy)')]
                    : [];
                const isLastInSection = realCards.length <= 1;
                let listName = null;

                if (sectionId.startsWith('pinned-list-')) {
                    const listEntry = (hs.pinnedLists || []).find(str => {
                        const parsed = api.parsePinnedListString(str);
                        return parsed && api.getPinnedListSectionId(parsed.name) === sectionId;
                    });
                    const parsed = api.parsePinnedListString(listEntry);
                    if (parsed) {
                        listName = parsed.name;
                        hs = removeItemFromPinnedList(hs, parsed.name, itemId);
                    }
                } else if (sectionId.startsWith('pinned-parent-')) {
                    const parentId = sectionId.replace('pinned-parent-', '');
                    hs = removePinnedParent(hs, parentId);
                }

                const ok = await saveHomeScreen(hs, { refreshHome: false });
                if (!ok) {
                    removeButton.disabled = false;
                    return;
                }

                if (isLastInSection && sectionEl) {
                    const sectionName = getSectionDisplayName(sectionEl, listName);
                    await beginSectionUnpin({
                        sectionId,
                        sectionEl,
                        sectionName,
                        restoreHomeScreen
                    });
                } else {
                    const itemName = getCardDisplayName(card, 'item');
                    await beginItemUnpin({
                        card,
                        itemName,
                        restoreHomeScreen
                    });
                    const itemsContainer = sectionEl?.querySelector('.itemsContainer');
                    if (itemsContainer) updateAllReorderChevrons(itemsContainer);
                }
            } catch (err) {
                WARN('Unpin failed:', err);
                removeButton.disabled = false;
            }
        });

        card.appendChild(removeButton);
    }

    function setupUnpinObserver() {
        const style = document.createElement('style');
        style.textContent = `
            .unpin-item-button {
                position: absolute !important;
                top: 8px !important;
                right: 8px !important;
                z-index: 20 !important;
                width: 32px !important;
                height: 32px !important;
                display: flex !important;
                align-items: center !important;
                justify-content: center !important;
                cursor: pointer !important;
                transition: all 0.2s ease !important;
                opacity: 0 !important;
                transform: scale(0.8) !important;
                padding: 0 !important;
                pointer-events: auto !important;
            }
            .card:hover > .unpin-item-button,
            .unpin-item-button:focus-visible {
                opacity: 1 !important;
                transform: scale(1) !important;
            }
            .unpin-item-button:hover {
                background: rgba(0, 0, 0, 0.15) !important;
                transform: scale(1.1) !important;
            }
            .unpin-item-button .material-icons {
                font-size: 18px !important;
            }
            .pin-reorder-btn {
                position: absolute !important;
                top: 50% !important;
                z-index: 20 !important;
                margin-top: -14px !important;
                width: 28px !important;
                height: 28px !important;
                display: flex !important;
                align-items: center !important;
                justify-content: center !important;
                cursor: pointer !important;
                transition: opacity 0.2s ease, transform 0.2s ease, background 0.2s ease !important;
                opacity: 0 !important;
                transform: scale(0.85) !important;
                padding: 0 !important;
                pointer-events: auto !important;
            }
            [data-section-id^="pinned-list-"] .card[data-id]:not(.card-layout-dummy) {
                position: relative !important;
            }
            .pin-reorder-left {
                left: 6px !important;
            }
            .pin-reorder-right {
                right: 6px !important;
            }
            .card:hover > .pin-reorder-btn:not([hidden]),
            .pin-reorder-btn:focus-visible:not([hidden]) {
                opacity: 0.92 !important;
                transform: scale(1) !important;
            }
            .pin-reorder-btn:hover:not([hidden]):not(:disabled) {
                background: rgba(0, 0, 0, 0.15) !important;
                opacity: 1 !important;
                transform: scale(1.08) !important;
            }
            .pin-reorder-btn[hidden] {
                display: none !important;
            }
            .pin-reorder-btn .material-icons {
                font-size: 20px !important;
                line-height: 1 !important;
            }
            [data-modal-id="kefin-pin-choice-modal"] .formDialog {
                min-width: min(92vw, 28rem);
            }
            [data-modal-id="kefin-pin-it-modal"] .formDialog {
                min-width: min(92vw, 18rem);
            }
            [data-modal-id="kefin-pin-it-modal"] .kefin-pin-it-actions {
                display: flex;
                justify-content: flex-end;
                gap: 0.5em;
                margin-top: 1em;
            }
            [data-modal-id="kefin-pin-choice-modal"] .kefin-pin-choice-grid {
                display: flex;
                flex-direction: column;
                gap: 1em;
            }
            [data-modal-id="kefin-pin-choice-modal"] .kefin-pin-choice-card {
                display: flex;
                flex-direction: column;
                align-items: flex-start;
                text-align: left;
                width: 100%;
                padding: 1.75em 1.75em 2.25em;
                border: 1px solid rgba(255, 255, 255, 0.12);
                border-radius: 12px;
                background: rgba(255, 255, 255, 0.03);
                cursor: pointer;
                transition: border-color 0.2s, background 0.2s;
                font-family: inherit;
                color: inherit;
            }
            [data-modal-id="kefin-pin-choice-modal"] .kefin-pin-choice-card:hover {
                border-color: rgba(0, 164, 220, 0.5);
                background: rgba(0, 164, 220, 0.08);
            }
            [data-modal-id="kefin-pin-choice-modal"] .kefin-pin-choice-title {
                margin: 0 0 0.5em;
                font-size: 1.125rem;
                font-weight: 600;
                line-height: 1.25;
            }
            [data-modal-id="kefin-pin-choice-modal"] .kefin-pin-choice-desc {
                margin: 0;
                font-size: 0.9375rem;
                line-height: 1.6;
            }
        `;
        document.head.appendChild(style);

        const processOverlay = (overlayContainer) => {
            if (overlayContainer?.querySelector?.('.cardOverlayButton-br') || overlayContainer?.classList?.contains('cardOverlayContainer')) {
                const card = overlayContainer.closest?.('.card');
                if (card) {
                    addUnpinButton(card);
                    addReorderButtons(card);
                }
            }
        };

        const processCard = (card) => {
            if (!card?.classList?.contains('card')) return;
            addUnpinButton(card);
            addReorderButtons(card);
        };

        document.querySelectorAll('.cardOverlayContainer').forEach(processOverlay);
        document.querySelectorAll('[data-section-id^="pinned-list-"] .card[data-id]:not(.card-layout-dummy)').forEach(processCard);

        const observer = new MutationObserver((mutations) => {
            mutations.forEach(mutation => {
                mutation.addedNodes.forEach(node => {
                    if (node.nodeType !== Node.ELEMENT_NODE) return;
                    if (node.classList?.contains('cardOverlayContainer')) processOverlay(node);
                    node.querySelectorAll?.('.cardOverlayContainer').forEach(processOverlay);
                    if (node.classList?.contains('card')) processCard(node);
                    node.querySelectorAll?.('.card[data-id]').forEach(processCard);
                });
            });
        });
        observer.observe(document.body, { childList: true, subtree: true });
    }

    function isPinnedParentSection(sectionId) {
        return sectionId?.startsWith('pinned-parent-');
    }

    async function unpinParentSection(sectionId, sectionElement) {
        if (!isPinnedParentSection(sectionId)) return false;
        const parentId = sectionId.replace('pinned-parent-', '');
        try {
            let hs = await loadHomeScreen();
            const restoreHomeScreen = cloneHomeScreen(hs);
            const parentEntry = (hs.pinnedParents || []).find((str) => {
                const parsed = getConfigApi().parsePinnedParentString(str);
                return parsed?.parentId === parentId;
            });
            const parsedParent = getConfigApi().parsePinnedParentString(parentEntry);
            const sectionName = getSectionDisplayName(sectionElement, parsedParent?.name);

            hs = removePinnedParent(hs, parentId);
            const ok = await saveHomeScreen(hs, { refreshHome: false });
            if (!ok) return false;

            if (sectionElement) {
                await beginSectionUnpin({
                    sectionId,
                    sectionEl: sectionElement,
                    sectionName,
                    restoreHomeScreen
                });
            } else {
                window.KefinHomeScreenSectionRuntime?.unregister?.(sectionId);
            }
            return true;
        } catch (err) {
            WARN('Unpin parent failed:', err);
            return false;
        }
    }

    async function unpinPinnedListSection(sectionId, sectionElement) {
        if (!sectionId?.startsWith('pinned-list-')) return false;
        try {
            const api = getConfigApi();
            let hs = await loadHomeScreen();
            const restoreHomeScreen = cloneHomeScreen(hs);
            const listEntry = (hs.pinnedLists || []).find((str) => {
                const parsed = api.parsePinnedListString(str);
                return parsed && api.getPinnedListSectionId(parsed.name) === sectionId;
            });
            const parsed = api.parsePinnedListString(listEntry);
            if (!parsed) return false;
            const sectionName = getSectionDisplayName(sectionElement, parsed.name);
            hs.pinnedLists = (hs.pinnedLists || []).filter((str) => {
                const p = api.parsePinnedListString(str);
                return !(p && api.getPinnedListSectionId(p.name) === sectionId);
            });
            const ok = await saveHomeScreen(hs, { refreshHome: !sectionElement });
            if (!ok) return false;
            if (sectionElement) {
                await beginSectionUnpin({
                    sectionId,
                    sectionEl: sectionElement,
                    sectionName,
                    restoreHomeScreen
                });
            } else {
                window.KefinHomeScreenSectionRuntime?.unregister?.(sectionId);
                window.homeScreen3?.refreshHomeSections?.();
            }
            return true;
        } catch (err) {
            WARN('Unpin pinned list failed:', err);
            return false;
        }
    }

    function escapeHtml(str) {
        return String(str || '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    function escapeAttr(str) {
        return escapeHtml(str).replace(/'/g, '&#39;');
    }

    if (isEnabled()) {
        setupContextMenuCapture();
        setupUnpinObserver();
    }

    window.KefinHomeScreenPin = {
        isEnabled,
        isPinnedParentSection,
        unpinParentSection,
        unpinPinnedListSection
    };

    LOG('Module loaded');
})();
