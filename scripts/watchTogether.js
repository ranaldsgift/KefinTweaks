/**
 * KefinTweaks Watch Together
 * Account-scoped roster in CustomPrefs.kefinTweaks.watchTogether;
 * device-local enabledUserIds + lastSelectionAt; sync primary playstate to enabled users.
 */
(function () {
    'use strict';

    const LOG = (...args) => console.log('[KefinTweaks WatchTogether]', ...args);
    const WARN = (...args) => console.warn('[KefinTweaks WatchTogether]', ...args);
    const ERR = (...args) => console.error('[KefinTweaks WatchTogether]', ...args);

    const DEVICE_STORAGE_PREFIX = 'kefinTweaks_watchTogether';
    const FEATURE_KEY = 'watchTogether';
    const MODAL_ID = 'kefin-watch-together-modal';
    const ADD_USER_MODAL_ID = 'kefin-watch-together-add-modal';
    const WATCH_TOGETHER_MODAL_ID = 'kefin-watch-together-prompt';
    const REMOVE_CONFIRM_MODAL_ID = 'kefin-watch-together-remove-confirm';
    const SYNC_DEBOUNCE_MS = 250;
    const DEFAULT_SESSION_TIMEOUT_MINUTES = 30;

    let syncStarted = false;
    let activeModal = null;
    let addUserModal = null;
    let watchTogetherModal = null;
    /** Refreshes the open Watch Together picker in place (avatars + pending selection). */
    let refreshWatchTogetherPicker = null;
    const syncDebounceTimers = new Map();

    /** Cached CustomPrefs roster: { users: [{ userId, name, accessToken }] } */
    let groupCache = { users: [] };
    let groupHydrated = false;

    let inContinuousVideoSession = false;
    let isAddingOsdButton = false;

    function getUi() {
        return window.KefinTweaksUI || {};
    }

    function injectStyles() {
        if (document.getElementById('kefin-watch-together-styles')) return;
        const style = document.createElement('style');
        style.id = 'kefin-watch-together-styles';
        style.textContent = `
            .mus-watch-together-avatars {
                display: flex;
                flex-wrap: wrap;
                gap: 1em;
                justify-content: center;
                padding-top: 1em;
            }
            .mus-watch-together-avatar-wrap {
                position: relative;
            }
            .mus-watch-together-avatar {
                display: flex;
                flex-direction: column;
                align-items: center;
                gap: 0.4em;
                cursor: pointer;
                background: none;
                border: none;
                padding: 0;
                color: inherit;
            }
            .mus-watch-together-avatar .mus-avatar-circle {
                width: 96px;
                height: 96px;
                border-radius: 50%;
                overflow: hidden;
                border: 3px solid transparent;
                box-sizing: border-box;
                background: rgba(255,255,255,0.12);
                display: flex;
                align-items: center;
                justify-content: center;
                transition: border-color 0.15s ease, opacity 0.15s ease, box-shadow 0.15s ease;
                opacity: 0.45;
            }
            .mus-watch-together-avatar.is-enabled .mus-avatar-circle {
                border-color: rgba(0, 164, 220, 0.95);
                box-shadow: 0 0 0 2px rgba(0, 164, 220, 0.35);
                opacity: 1;
            }
            .mus-watch-together-avatar .mus-avatar-circle img {
                width: 100%;
                height: 100%;
                object-fit: cover;
            }
            .mus-watch-together-avatar .mus-avatar-fallback {
                font-size: 28px;
                opacity: 0.85;
            }
            .mus-watch-together-avatar .mus-avatar-name {
                font-size: 0.75em;
                text-align: center;
                max-width: 72px;
                overflow: hidden;
                text-overflow: ellipsis;
                white-space: nowrap;
            }
            .mus-avatar-remove {
                position: absolute;
                top: -8px;
                right: -8px;
                width: 22px;
                height: 22px;
                border-radius: 50%;
                border: none;
                padding: 0;
                margin: 0;
                cursor: pointer;
                display: flex;
                align-items: center;
                justify-content: center;
                background: rgba(0, 0, 0, 0.75);
                color: #fff;
                z-index: 2;
                box-shadow: 0 1px 3px rgba(0,0,0,0.4);
                opacity: 0;
                pointer-events: none;
                transition: opacity 0.15s ease;
            }
            .mus-watch-together-avatar-wrap:hover .mus-avatar-remove {
                opacity: 1;
                pointer-events: auto;
            }
            .mus-avatar-remove .material-icons {
                font-size: 14px;
                line-height: 1;
            }
            .mus-wt-footer-actions {
                display: flex;
                flex-direction: row;
                flex-wrap: wrap;
                gap: 0.5em;
                width: 100%;
                justify-content: flex-end;
                align-items: center;
            }
            .mus-wt-footer-actions .emby-button {
                margin: 0;
            }
            .material-icons.group_off::before {
                content: "\\e747";
            }
            .skinHeader:not(.osdHeader) button.btnWatchTogether {
                display: none !important;
            }
            .skinHeader.osdHeader button.btnWatchTogether {
                margin: 0;
            }
        `;
        document.head.appendChild(style);
    }

    function escapeHtml(str) {
        if (typeof getUi().escapeHtml === 'function') return getUi().escapeHtml(str);
        return String(str || '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    function  getPrimaryUserId() {
        return (typeof ApiClient !== 'undefined' && ApiClient.getCurrentUserId)
            ? ApiClient.getCurrentUserId()
            : null;
    }

    function getPrimaryUserName() {
        if (typeof ApiClient !== 'undefined') {
            if (ApiClient._currentUser?.Name) return ApiClient._currentUser.Name;
            const id = getPrimaryUserId();
            if (id) return id;
        }
        return 'User';
    }

    function getDeviceStorageKey() {
        const serverId = (typeof ApiClient !== 'undefined' && ApiClient.serverId)
            ? (ApiClient.serverId() || '')
            : '';
        const primaryUserId = getPrimaryUserId() || '';
        if (!serverId || !primaryUserId) return null;
        return `${DEVICE_STORAGE_PREFIX}:${serverId}:${primaryUserId}`;
    }

    function readDeviceState() {
        const key = getDeviceStorageKey();
        if (!key) return { enabledUserIds: [], lastSelectionAt: 0 };
        try {
            const raw = localStorage.getItem(key);
            if (!raw) return { enabledUserIds: [], lastSelectionAt: 0 };
            const parsed = JSON.parse(raw);
            const enabledUserIds = Array.isArray(parsed?.enabledUserIds)
                ? parsed.enabledUserIds.filter(Boolean)
                : [];
            const lastSelectionAt = Number(parsed?.lastSelectionAt) || 0;
            return { enabledUserIds, lastSelectionAt };
        } catch (e) {
            WARN('Failed to read device watch-together state:', e);
            return { enabledUserIds: [], lastSelectionAt: 0 };
        }
    }

    function writeDeviceState(state) {
        const key = getDeviceStorageKey();
        if (!key) return false;
        try {
            const enabledUserIds = Array.isArray(state?.enabledUserIds)
                ? [...new Set(state.enabledUserIds.filter(Boolean))]
                : [];
            const lastSelectionAt = Number(state?.lastSelectionAt) || 0;
            localStorage.setItem(key, JSON.stringify({ enabledUserIds, lastSelectionAt }));
            updateHeaderWatchTogetherIndicator();
            updateSyncListenerState();
            return true;
        } catch (e) {
            ERR('Failed to write device watch-together state:', e);
            return false;
        }
    }

    function stampLastSelectionAt(enabledUserIds) {
        const current = readDeviceState();
        return writeDeviceState({
            enabledUserIds: enabledUserIds != null ? enabledUserIds : current.enabledUserIds,
            lastSelectionAt: Date.now()
        });
    }

    function normalizeWatchTogether(raw) {
        const users = Array.isArray(raw?.users) ? raw.users : [];
        return {
            users: users
                .filter((u) => u && u.userId && (u.accessToken || u.viaAdmin === true))
                .map((u) => {
                    const entry = {
                        userId: u.userId,
                        name: u.name || ''
                    };
                    if (u.viaAdmin === true) {
                        entry.viaAdmin = true;
                    } else if (u.accessToken) {
                        entry.accessToken = u.accessToken;
                    }
                    return entry;
                })
        };
    }

    async function hydrateGroupCache() {
        try {
            const raw = await window.userHelper?.getKefinTweaksFeature?.(FEATURE_KEY, { users: [] });
            groupCache = normalizeWatchTogether(raw);
            groupHydrated = true;
            return groupCache;
        } catch (e) {
            WARN('Failed to hydrate watchTogether group:', e);
            groupCache = { users: [] };
            groupHydrated = true;
            return groupCache;
        }
    }

    async function persistGroup(nextGroup) {
        const normalized = normalizeWatchTogether(nextGroup);
        const ok = await window.userHelper?.setKefinTweaksFeature?.(FEATURE_KEY, normalized);
        if (ok) {
            groupCache = normalized;
            groupHydrated = true;
            updateHeaderWatchTogetherIndicator();
            updateSyncListenerState();
        }
        return ok;
    }

    function getSessionUsers() {
        return (groupCache.users || []).slice();
    }

    function getEnabledSessionUsers() {
        const primaryId = getPrimaryUserId();
        const { enabledUserIds } = readDeviceState();
        const enabledSet = new Set(enabledUserIds);
        return getSessionUsers().filter(
            (u) => enabledSet.has(u.userId)
                && u.userId
                && u.userId !== primaryId
                && (u.accessToken || u.viaAdmin === true)
        );
    }

    async function upsertSessionUser(entry) {
        const users = getSessionUsers();
        const idx = users.findIndex((u) => u.userId === entry.userId);
        const next = {
            userId: entry.userId,
            name: entry.name || ''
        };
        if (entry.viaAdmin === true) {
            next.viaAdmin = true;
        } else if (entry.accessToken) {
            next.accessToken = entry.accessToken;
        } else {
            ERR('upsertSessionUser requires accessToken or viaAdmin');
            return false;
        }
        if (idx >= 0) users[idx] = next;
        else users.push(next);
        const ok = await persistGroup({ users });
        if (ok) {
            const device = readDeviceState();
            if (!device.enabledUserIds.includes(entry.userId)) {
                writeDeviceState({
                    enabledUserIds: [...device.enabledUserIds, entry.userId],
                    lastSelectionAt: device.lastSelectionAt
                });
            }
        }
        return ok;
    }

    function setUserEnabled(userId, enabled) {
        const device = readDeviceState();
        const set = new Set(device.enabledUserIds);
        if (enabled) set.add(userId);
        else set.delete(userId);
        return writeDeviceState({
            enabledUserIds: [...set],
            lastSelectionAt: device.lastSelectionAt
        });
    }

    async function removeSessionUser(userId) {
        const users = getSessionUsers().filter((u) => u.userId !== userId);
        const ok = await persistGroup({ users });
        const device = readDeviceState();
        writeDeviceState({
            enabledUserIds: device.enabledUserIds.filter((id) => id !== userId),
            lastSelectionAt: device.lastSelectionAt
        });
        return ok;
    }

    function getSessionTimeoutMs() {
        const minutes = window.KefinTweaksConfig?.watchTogether?.sessionTimeout;
        const n = Number(minutes);
        const use = Number.isFinite(n) && n > 0 ? n : DEFAULT_SESSION_TIMEOUT_MINUTES;
        return use * 60 * 1000;
    }

    function getHeaderUserButtonTitle() {
        const enabledUsers = getEnabledSessionUsers();
        if (!enabledUsers.length) return null;
        const others = enabledUsers.map((u) => u.name || u.userId).join(', ');
        return `${getPrimaryUserName()} and ${others}`;
    }

    function updateHeaderWatchTogetherIndicator() {
        const hasMulti = getEnabledSessionUsers().length > 0;
        const multiTitle = hasMulti ? getHeaderUserButtonTitle() : null;

        document.querySelectorAll('.headerUserButton').forEach((btn) => {
            if (hasMulti) {
                if (!btn.hasAttribute('data-wt-original-title')) {
                    const existing = btn.getAttribute('title');
                    if (existing) btn.setAttribute('data-wt-original-title', existing);
                }
                if (multiTitle) btn.setAttribute('title', multiTitle);
                btn.setAttribute('data-watch-together', 'true');
                btn.querySelectorAll('.material-icons.person').forEach((icon) => {
                    icon.setAttribute('data-watch-together', 'true');
                });
            } else {
                if (btn.hasAttribute('data-wt-original-title')) {
                    const original = btn.getAttribute('data-wt-original-title');
                    if (original) btn.setAttribute('title', original);
                    else btn.removeAttribute('title');
                    btn.removeAttribute('data-wt-original-title');
                }
                btn.removeAttribute('data-watch-together');
                btn.querySelectorAll('[data-watch-together]').forEach((el) => {
                    el.removeAttribute('data-watch-together');
                });
            }
        });
    }

    function authHeaderForToken(token) {
        if (window.apiHelper?.getAuthHeaderForToken) {
            return window.apiHelper.getAuthHeaderForToken(token);
        }
        return '';
    }

    /** Primary admin token for viaAdmin members; stored token for password-linked members. */
    function authHeaderForSessionUser(user) {
        if (user?.viaAdmin === true || !user?.accessToken) {
            if (window.apiHelper?.getAuthHeader) {
                return window.apiHelper.getAuthHeader();
            }
            return authHeaderForToken(
                typeof ApiClient !== 'undefined' && ApiClient.accessToken
                    ? ApiClient.accessToken()
                    : ''
            );
        }
        return authHeaderForToken(user.accessToken);
    }

    async function authenticateByName(username, password) {
        const serverUrl = ApiClient.serverAddress();
        if (!serverUrl) throw new Error('Server address unavailable');

        const response = await fetch(`${serverUrl}/Users/AuthenticateByName`, {
            method: 'POST',
            headers: {
                Authorization: authHeaderForToken(''),
                'Content-Type': 'application/json',
                Accept: 'application/json'
            },
            body: JSON.stringify({
                Username: username,
                Pw: password
            })
        });

        if (!response.ok) {
            let detail = `${response.status}`;
            try {
                const errBody = await response.json();
                if (errBody?.message || errBody?.Message) {
                    detail = errBody.message || errBody.Message;
                }
            } catch (_) { /* ignore */ }
            throw new Error(detail);
        }

        return response.json();
    }

    async function logoutSessionToken(accessToken) {
        if (!accessToken) return;
        try {
            const serverUrl = ApiClient.serverAddress();
            if (!serverUrl) return;
            await fetch(`${serverUrl}/Sessions/Logout`, {
                method: 'POST',
                headers: {
                    Authorization: authHeaderForToken(accessToken),
                    'Content-Type': 'application/json'
                }
            });
        } catch (e) {
            WARN('Best-effort logout failed:', e);
        }
    }

    function getSessionUserIds() {
        return new Set(getSessionUsers().map((u) => u.userId));
    }

    function isPrimaryUserDataEvent(msg) {
        const eventUserId = msg?.Data?.UserId;
        const primaryId = getPrimaryUserId();
        if (!primaryId || !eventUserId) return false;
        if (eventUserId !== primaryId) return false;
        return !getSessionUserIds().has(eventUserId);
    }

    async function markItemPlayed(user, itemId) {
        const serverUrl = ApiClient.serverAddress();
        const url = `${serverUrl}/Users/${encodeURIComponent(user.userId)}/PlayedItems/${encodeURIComponent(itemId)}`;
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                Authorization: authHeaderForSessionUser(user),
                'Content-Type': 'application/json'
            }
        });
        if (response.status === 401 || response.status === 403) {
            setUserEnabled(user.userId, false);
            WARN(`Disabled session user ${user.name || user.userId} after ${response.status} on PlayedItems`);
            return false;
        }
        if (!response.ok) {
            throw new Error(`PlayedItems ${response.status}`);
        }
        return true;
    }

    async function mirrorUserData(user, itemId, userData) {
        const serverUrl = ApiClient.serverAddress();
        const url = `${serverUrl}/Users/${encodeURIComponent(user.userId)}/Items/${encodeURIComponent(itemId)}/UserData`;
        const body = {
            PlaybackPositionTicks: userData.PlaybackPositionTicks ?? 0,
            PlayedPercentage: userData.PlayedPercentage,
            PlayCount: userData.PlayCount,
            IsFavorite: userData.IsFavorite,
            LastPlayedDate: userData.LastPlayedDate
        };
        if (userData.Played === true) {
            body.Played = true;
        }
        Object.keys(body).forEach((k) => {
            if (body[k] === undefined) delete body[k];
        });

        const response = await fetch(url, {
            method: 'POST',
            headers: {
                Authorization: authHeaderForSessionUser(user),
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(body)
        });
        if (response.status === 401 || response.status === 403) {
            setUserEnabled(user.userId, false);
            WARN(`Disabled session user ${user.name || user.userId} after ${response.status} on UserData`);
            return false;
        }
        if (!response.ok) {
            throw new Error(`UserData ${response.status}`);
        }
        return true;
    }

    async function syncUserDataToSessionUsers(userData) {
        if (!userData?.ItemId) return;
        const itemId = userData.ItemId;
        const targets = getEnabledSessionUsers();
        if (!targets.length) return;

        const hasProgress = typeof userData.PlaybackPositionTicks === 'number'
            && userData.PlaybackPositionTicks > 0;
        const shouldPushUserData = hasProgress
            || userData.PlaybackPositionTicks === 0
            || userData.PlayedPercentage != null;
        const shouldMarkPlayed = userData.Played === true;

        if (!shouldMarkPlayed && !shouldPushUserData) return;

        await Promise.all(targets.map(async (user) => {
            try {
                if (shouldMarkPlayed) {
                    await markItemPlayed(user, itemId);
                }
                if (shouldPushUserData) {
                    await mirrorUserData(user, itemId, userData);
                }
            } catch (e) {
                WARN(`Sync failed for ${user.name || user.userId}:`, e);
            }
        }));
    }

    function scheduleSyncUserData(userData) {
        if (!userData?.ItemId) return;
        const itemId = userData.ItemId;
        clearTimeout(syncDebounceTimers.get(itemId));
        syncDebounceTimers.set(itemId, setTimeout(() => {
            syncDebounceTimers.delete(itemId);
            syncUserDataToSessionUsers(userData).catch((e) => WARN('Debounced sync error:', e));
        }, SYNC_DEBOUNCE_MS));
    }

    function handleUserDataChangedMessage(msg) {
        if (!isPrimaryUserDataEvent(msg)) return;

        const list = msg?.Data?.UserDataList;
        if (!Array.isArray(list) || !list.length) return;
        if (!getEnabledSessionUsers().length) return;
        list.forEach((entry) => scheduleSyncUserData(entry));
    }

    function stopSync() {
        if (!syncStarted) return;
        if (window.websocketHelper?.unlisten) {
            window.websocketHelper.unlisten('UserDataChanged', handleUserDataChangedMessage);
        }
        syncStarted = false;
        syncDebounceTimers.forEach((timer) => clearTimeout(timer));
        syncDebounceTimers.clear();
        LOG('Playstate sync stopped (no enabled session users)');
    }

    function startSync() {
        if (syncStarted) return;
        if (!getEnabledSessionUsers().length) return;
        if (!window.websocketHelper?.listen) {
            WARN('websocketHelper not available; retrying sync start');
            setTimeout(updateSyncListenerState, 1000);
            return;
        }
        window.websocketHelper.listen('UserDataChanged', handleUserDataChangedMessage);
        syncStarted = true;
        LOG('Playstate sync listening for UserDataChanged');
    }

    function updateSyncListenerState() {
        if (getEnabledSessionUsers().length > 0) {
            startSync();
        } else {
            stopSync();
        }
        updateWatchTogetherOsdButtonActiveState();
    }

    function updateWatchTogetherOsdButtonActiveState() {
        const active = getEnabledSessionUsers().length > 0;
        document.querySelectorAll('button.btnWatchTogether').forEach((btn) => {
            btn.classList.toggle('buttonActive', active);
        });
    }

    function getUserAvatarUrl(userId) {
        const server = ApiClient?.serverAddress?.() || '';
        if (!server || !userId) return '';
        return `${server}/Users/${encodeURIComponent(userId)}/Images/Primary`;
    }

    /**
     * Shared Watch Together account picker UI (playback prompt + manage modal).
     * @param {Array} users
     * @param {string[]} enabledUserIds
     * @param {{ showRemove?: boolean }} [options]
     */
    function buildAvatarToggleHtml(users, enabledUserIds, options = {}) {
        const { showRemove = false } = options;
        const enabledSet = new Set(enabledUserIds);
        if (!users.length) {
            return `<div class="listItemBodyText secondary" style="text-align:center;padding:1em 0;">No accounts in your Watch Together group yet.</div>`;
        }
        const items = users.map((user) => {
            const enabled = enabledSet.has(user.userId);
            const name = escapeHtml(user.name || user.userId);
            const src = escapeHtml(getUserAvatarUrl(user.userId));
            const removeBtn = showRemove
                ? `<button type="button" class="mus-avatar-remove" data-user-id="${escapeHtml(user.userId)}" title="Remove ${name}" aria-label="Remove ${name}">
                        <span class="material-icons delete" aria-hidden="true"></span>
                   </button>`
                : '';
            return `
                <div class="mus-watch-together-avatar-wrap">
                    ${removeBtn}
                    <button type="button" class="mus-watch-together-avatar ${enabled ? 'is-enabled' : ''}"
                        data-user-id="${escapeHtml(user.userId)}" title="${name}" aria-pressed="${enabled}">
                        <span class="mus-avatar-circle">
                            <img src="${src}" alt="${name}" loading="lazy"
                                onerror="this.style.display='none';this.nextElementSibling.style.display='inline-block';">
                            <span class="material-icons person mus-avatar-fallback" aria-hidden="true" style="display:none;"></span>
                        </span>
                        <span class="mus-avatar-name listItemBodyText">${name}</span>
                    </button>
                </div>
            `;
        }).join('');
        return `<div class="mus-watch-together-avatars">${items}</div>`;
    }

    function buildWatchTogetherPickerBodyHtml(users, enabledUserIds, options = {}) {
        const { showRemove = false, hint = 'Tap accounts to include them in watch-state sync for this session.' } = options;
        return `
            <div class="mus-watch-together-prompt" style="padding: 0.25em 0;">
                <div class="listItemBodyText secondary" style="margin-bottom: 1em;">
                    ${escapeHtml(hint)}
                </div>
                <hr class="separator" aria-hidden="true"> 
                ${buildAvatarToggleHtml(users, enabledUserIds, { showRemove })}
            </div>
        `;
    }

    /**
     * @param {HTMLElement} root
     * @param {string[]} pendingEnabledIds - mutated in place for pending selection
     * @param {{ applyImmediately?: boolean, onRemove?: Function }} [options]
     */
    function bindAvatarToggleHandlers(root, pendingEnabledIds, options = {}) {
        const { applyImmediately = false, onRemove = null } = options;

        root.querySelectorAll('.mus-watch-together-avatar').forEach((btn) => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                const userId = btn.getAttribute('data-user-id');
                if (!userId) return;
                const idx = pendingEnabledIds.indexOf(userId);
                if (idx >= 0) pendingEnabledIds.splice(idx, 1);
                else pendingEnabledIds.push(userId);
                const enabled = pendingEnabledIds.includes(userId);
                btn.classList.toggle('is-enabled', enabled);
                btn.setAttribute('aria-pressed', String(enabled));
                if (applyImmediately) {
                    setUserEnabled(userId, enabled);
                    stampLastSelectionAt([...pendingEnabledIds]);
                }
            });
        });

        root.querySelectorAll('.mus-avatar-remove').forEach((btn) => {
            btn.addEventListener('click', async (e) => {
                e.preventDefault();
                e.stopPropagation();
                const userId = btn.getAttribute('data-user-id');
                if (!userId) return;
                const user = getSessionUsers().find((u) => u.userId === userId);
                const label = user?.name || userId;
                const readdHint = user?.viaAdmin
                    ? 'You can re-add them from the user list.'
                    : 'They will need to be authenticated again to re-add.';
                const confirmed = await confirmRemoveWatchTogetherUser(label, readdHint);
                if (!confirmed) return;
                const token = user?.accessToken;
                await removeSessionUser(userId);
                if (token) await logoutSessionToken(token);
                window.KefinTweaksToaster?.toast?.(`Removed ${label} from Watch Together group`);
                const idx = pendingEnabledIds.indexOf(userId);
                if (idx >= 0) pendingEnabledIds.splice(idx, 1);
                if (typeof onRemove === 'function') {
                    onRemove(userId);
                } else {
                    btn.closest('.mus-watch-together-avatar-wrap')?.remove();
                    if (!root.querySelector('.mus-watch-together-avatar-wrap')) {
                        const host = root.querySelector('.mus-watch-together-avatars');
                        if (host) {
                            host.outerHTML = buildAvatarToggleHtml([], [], { showRemove: true });
                        }
                    }
                }
            });
        });
    }

    /**
     * Jellyfin-style confirm for removing a Watch Together member.
     * @returns {Promise<boolean>}
     */
    function confirmRemoveWatchTogetherUser(label, readdHint) {
        return new Promise((resolve) => {
            let settled = false;
            const settle = (value) => {
                if (settled) return;
                settled = true;
                resolve(value);
            };

            if (!window.ModalSystem?.create) {
                settle(window.confirm(`Remove ${label} from Watch Together? ${readdHint}`));
                return;
            }

            if (window.ModalSystem.isOpen?.(REMOVE_CONFIRM_MODAL_ID)) {
                window.ModalSystem.close(REMOVE_CONFIRM_MODAL_ID);
            }

            const modal = window.ModalSystem.create({
                id: REMOVE_CONFIRM_MODAL_ID,
                title: 'Remove User',
                content: `
                    <div class="listItemBodyText">
                        Remove <strong>${escapeHtml(label)}</strong> from Watch Together?
                    </div>
                    <div class="listItemBodyText secondary" style="margin-top: 0.75em;">
                        ${escapeHtml(readdHint)}
                    </div>
                `,
                footer: `
                    <div class="mus-wt-footer-actions" style="display:flex;flex-direction:row;flex-wrap:wrap;gap:0.5em;width:100%;justify-content:flex-end;align-items:center;">
                        <button type="button" class="raised emby-button" id="mus-remove-cancel">Cancel</button>
                        <button type="button" class="raised button-submit emby-button" id="mus-remove-confirm">Remove</button>
                    </div>
                `,
                // Avoid Escape also closing the parent Watch Together modal (both listen on document).
                closeOnBackdrop: true,
                closeOnEscape: false,
                showCloseButton: true,
                onOpen: (modalInstance) => {
                    if (modalInstance?.dialog) {
                        modalInstance.dialog.style.maxWidth = '420px';
                        modalInstance.dialog.style.width = '90vw';
                    }
                    modalInstance.dialogFooter?.querySelector('#mus-remove-cancel')?.addEventListener('click', (e) => {
                        e.preventDefault();
                        settle(false);
                        modalInstance.close();
                    });
                    modalInstance.dialogFooter?.querySelector('#mus-remove-confirm')?.addEventListener('click', (e) => {
                        e.preventDefault();
                        settle(true);
                        modalInstance.close();
                    });
                }
            });
            if (modal) {
                modal.onClose = () => settle(false);
            }
        });
    }

    function openWatchTogetherPrompt(options = {}) {
        const {
            onComplete,
            title = 'Watch Together',
            showRemove = false,
            applyImmediately = false,
            hint = 'Watch state will sync to the selected accounts in your group as you watch new content. Tap an account to enable/disable it.'
        } = options;

        if (!window.ModalSystem?.create) {
            onComplete?.();
            return;
        }
        if (watchTogetherModal?.isOpen) {
            watchTogetherModal.close();
        }

        const users = getSessionUsers();
        // Manage / prefs entry can open with an empty group so users can add accounts.
        if (!users.length && !showRemove) {
            onComplete?.();
            return;
        }

        const pendingEnabledIds = readDeviceState().enabledUserIds
            .filter((id) => users.some((u) => u.userId === id));

        const contentHtml = buildWatchTogetherPickerBodyHtml(users, pendingEnabledIds, {
            showRemove,
            hint
        });

        const showAddUser = options.showAddUser !== false;
        const modalId = showRemove ? MODAL_ID : WATCH_TOGETHER_MODAL_ID;

        watchTogetherModal = window.ModalSystem.create({
            id: modalId,
            title,
            content: contentHtml,
            footer: showAddUser
                ? `
                <div class="mus-wt-footer-actions" style="display:flex;flex-direction:row;flex-wrap:wrap;gap:0.5em;width:100%;justify-content:flex-end;align-items:center;">
                    <button type="button" class="raised emby-button" id="mus-wt-add-user">Add User</button>
                    <button type="button" class="raised button-submit emby-button" id="mus-wt-ok">OK</button>                    
                </div>
            `
                : null,
            closeOnBackdrop: true,
            closeOnEscape: true,
            onOpen: (modalInstance) => {
                watchTogetherModal = modalInstance;
                if (showRemove) activeModal = modalInstance;
                if (modalInstance?.dialog) {
                    modalInstance.dialog.style.maxWidth = '480px';
                    modalInstance.dialog.style.width = '92vw';
                }
                const root = modalInstance.dialogContent;

                const rebind = () => {
                    const nextUsers = getSessionUsers();
                    const deviceEnabled = new Set(readDeviceState().enabledUserIds);
                    // Drop removed users from pending selection
                    for (let i = pendingEnabledIds.length - 1; i >= 0; i--) {
                        if (!nextUsers.some((u) => u.userId === pendingEnabledIds[i])) {
                            pendingEnabledIds.splice(i, 1);
                        }
                    }
                    // Pick up newly added / device-enabled users (e.g. after Add User)
                    nextUsers.forEach((u) => {
                        if (deviceEnabled.has(u.userId) && !pendingEnabledIds.includes(u.userId)) {
                            pendingEnabledIds.push(u.userId);
                        }
                    });
                    const body = root.querySelector('.mus-watch-together-prompt');
                    if (!body) return;
                    body.outerHTML = buildWatchTogetherPickerBodyHtml(nextUsers, pendingEnabledIds, {
                        showRemove,
                        hint
                    });
                    bindAvatarToggleHandlers(root, pendingEnabledIds, {
                        applyImmediately,
                        onRemove: () => rebind()
                    });
                };

                refreshWatchTogetherPicker = rebind;

                bindAvatarToggleHandlers(root, pendingEnabledIds, {
                    applyImmediately,
                    onRemove: () => rebind()
                });

                modalInstance.dialogFooter?.querySelector('#mus-wt-add-user')?.addEventListener('click', (e) => {
                    e.preventDefault();
                    openAddUserModal();
                });

                modalInstance.dialogFooter?.querySelector('#mus-wt-ok')?.addEventListener('click', (e) => {
                    e.preventDefault();
                    watchTogetherModal.close();
                });
            }
        });
        if (watchTogetherModal) {
            watchTogetherModal.onClose = () => {
                // Dismiss (X / backdrop / Escape) applies the current selection + session stamp.
                stampLastSelectionAt([...pendingEnabledIds]);
                watchTogetherModal = null;
                refreshWatchTogetherPicker = null;
                if (showRemove) activeModal = null;
                onComplete?.();
            };
        }
    }

    async function fetchCandidateUsersForAdmin() {
        const primaryId = getPrimaryUserId();
        const existing = getSessionUserIds();
        let users = [];
        try {
            if (typeof ApiClient?.getUsers === 'function') {
                users = await ApiClient.getUsers();
            } else {
                const serverUrl = ApiClient.serverAddress();
                const response = await fetch(`${serverUrl}/Users`, {
                    method: 'GET',
                    headers: {
                        Authorization: window.apiHelper?.getAuthHeader?.() || authHeaderForToken(ApiClient.accessToken?.() || ''),
                        Accept: 'application/json'
                    }
                });
                if (!response.ok) throw new Error(`Users ${response.status}`);
                users = await response.json();
            }
        } catch (e) {
            ERR('Failed to load users for admin Watch Together add:', e);
            throw e;
        }
        if (!Array.isArray(users)) users = [];
        return users
            .filter((u) => u?.Id && u.Id !== primaryId && !existing.has(u.Id))
            .map((u) => ({ userId: u.Id, name: u.Name || u.Id }))
            .sort((a, b) => String(a.name).localeCompare(String(b.name), undefined, { sensitivity: 'base' }));
    }

    function buildAddUserModalContentHtml() {
        const { buildTextInput } = getUi();
        const usernameField = typeof buildTextInput === 'function'
            ? buildTextInput('mus-add-username', '', 'Username', 'text')
            : '';
        const passwordField = typeof buildTextInput === 'function'
            ? buildTextInput('mus-add-password', '', 'Password', 'password')
            : '';

        return `
            <div class="mus-add-user-modal-body" style="padding: 0.25em 0;">
                ${usernameField}
                ${passwordField}
                <div id="mus-add-user-error" class="listItemBodyText" style="color: #f44336; display: none; margin: 0.5em 0;"></div>
                <div style="display: flex; gap: 0.5em; margin-top: 1em;">
                    <button type="button" class="raised button-submit block emby-button" id="mus-add-authenticate">Authenticate</button>
                    <button type="button" class="raised block emby-button" id="mus-add-cancel">Cancel</button>
                </div>
            </div>
        `;
    }

    function buildAdminAddUserModalContentHtml() {
        return `
            <div class="mus-add-user-modal-body" style="padding: 0.25em 0;">
                <div class="inputContainer">
                    <select id="mus-add-user-select" class="emby-select-withcolor emby-select" style="width: 100%;" disabled>
                        <option value="">Loading users…</option>
                    </select>
                </div>
                <div id="mus-add-user-error" class="listItemBodyText" style="color: #f44336; display: none; margin: 0.5em 0;"></div>
                <div style="display: flex; gap: 0.5em; margin-top: 1em;">
                    <button type="button" class="raised button-submit block emby-button" id="mus-add-admin-add" disabled>Add</button>
                    <button type="button" class="raised block emby-button" id="mus-add-cancel">Cancel</button>
                </div>
            </div>
        `;
    }

    function populateAdminUserSelect(root, candidates) {
        const select = root?.querySelector('#mus-add-user-select');
        const addBtn = root?.querySelector('#mus-add-admin-add');
        if (!select) return;
        select.innerHTML = '';
        if (!candidates.length) {
            const opt = document.createElement('option');
            opt.value = '';
            opt.textContent = 'No users available to add';
            select.appendChild(opt);
            select.disabled = true;
            if (addBtn) addBtn.disabled = true;
            return;
        }
        const placeholder = document.createElement('option');
        placeholder.value = '';
        placeholder.textContent = 'Select a user…';
        select.appendChild(placeholder);
        candidates.forEach((u) => {
            const opt = document.createElement('option');
            opt.value = u.userId;
            opt.textContent = u.name;
            opt.setAttribute('data-name', u.name);
            select.appendChild(opt);
        });
        select.disabled = false;
        if (addBtn) addBtn.disabled = false;
    }

    async function submitAdminAddUser(modalInstance) {
        const root = modalInstance?.dialogContent;
        if (!root) return;

        const select = root.querySelector('#mus-add-user-select');
        const errorEl = root.querySelector('#mus-add-user-error');
        const addBtn = root.querySelector('#mus-add-admin-add');
        const userId = select?.value || '';
        const name = select?.selectedOptions?.[0]?.getAttribute('data-name')
            || select?.selectedOptions?.[0]?.textContent
            || userId;

        if (errorEl) {
            errorEl.style.display = 'none';
            errorEl.textContent = '';
        }
        if (!userId) {
            if (errorEl) {
                errorEl.textContent = 'Select a user to add.';
                errorEl.style.display = 'block';
            }
            return;
        }
        if (userId === getPrimaryUserId()) {
            if (errorEl) {
                errorEl.textContent = 'Cannot add the currently signed-in user to the session';
                errorEl.style.display = 'block';
            }
            return;
        }

        if (addBtn) addBtn.disabled = true;
        try {
            await upsertSessionUser({ userId, name, viaAdmin: true });
            modalInstance.close();
            if (typeof refreshWatchTogetherPicker === 'function' && watchTogetherModal?.isOpen) {
                refreshWatchTogetherPicker();
            }
            window.KefinTweaksToaster?.toast?.(`Added ${name} to Watch Together group`);
        } catch (err) {
            if (errorEl) {
                errorEl.textContent = err?.message || 'Failed to add user';
                errorEl.style.display = 'block';
            }
            ERR('Admin add user failed:', err);
            if (addBtn) addBtn.disabled = false;
        }
    }

    async function submitAddUserAuth(modalInstance) {
        const root = modalInstance?.dialogContent;
        if (!root) return;

        const username = root.querySelector('#mus-add-username')?.value?.trim() || '';
        const password = root.querySelector('#mus-add-password')?.value ?? '';
        const errorEl = root.querySelector('#mus-add-user-error');
        const authBtn = root.querySelector('#mus-add-authenticate');

        if (errorEl) {
            errorEl.style.display = 'none';
            errorEl.textContent = '';
        }
        if (!username) {
            if (errorEl) {
                errorEl.textContent = 'Username is required.';
                errorEl.style.display = 'block';
            }
            return;
        }

        if (authBtn) authBtn.disabled = true;
        try {
            const result = await authenticateByName(username, password);
            const userId = result?.User?.Id || result?.UserId;
            const name = result?.User?.Name || username;
            const accessToken = result?.AccessToken || result?.accessToken;
            if (!userId || !accessToken) {
                throw new Error('Authentication response missing user or token');
            }
            if (userId === getPrimaryUserId()) {
                throw new Error('Cannot add the currently signed-in user to the session');
            }
            await upsertSessionUser({ userId, name, accessToken });
            const pwEl = root.querySelector('#mus-add-password');
            const userEl = root.querySelector('#mus-add-username');
            if (pwEl) pwEl.value = '';
            if (userEl) userEl.value = '';
            modalInstance.close();
            if (typeof refreshWatchTogetherPicker === 'function' && watchTogetherModal?.isOpen) {
                refreshWatchTogetherPicker();
            }
            window.KefinTweaksToaster?.toast?.(`Added ${name} to Watch Together group`);
        } catch (err) {
            if (errorEl) {
                errorEl.textContent = err?.message || 'Authentication failed';
                errorEl.style.display = 'block';
            }
            ERR('Add user failed:', err);
        } finally {
            if (authBtn) authBtn.disabled = false;
        }
    }

    function bindAddUserModalHandlers(modalInstance) {
        const root = modalInstance?.dialogContent;
        if (!root) return;

        root.querySelector('#mus-add-cancel')?.addEventListener('click', (e) => {
            e.preventDefault();
            modalInstance.close();
        });

        root.querySelector('#mus-add-authenticate')?.addEventListener('click', (e) => {
            e.preventDefault();
            submitAddUserAuth(modalInstance);
        });

        const handleEnter = (e) => {
            if (e.key !== 'Enter') return;
            e.preventDefault();
            submitAddUserAuth(modalInstance);
        };
        root.querySelector('#mus-add-username')?.addEventListener('keydown', handleEnter);
        root.querySelector('#mus-add-password')?.addEventListener('keydown', handleEnter);

        setTimeout(() => root.querySelector('#mus-add-username')?.focus(), 50);
    }

    function bindAdminAddUserModalHandlers(modalInstance) {
        const root = modalInstance?.dialogContent;
        if (!root) return;

        root.querySelector('#mus-add-cancel')?.addEventListener('click', (e) => {
            e.preventDefault();
            modalInstance.close();
        });

        root.querySelector('#mus-add-admin-add')?.addEventListener('click', (e) => {
            e.preventDefault();
            submitAdminAddUser(modalInstance);
        });

        root.querySelector('#mus-add-user-select')?.addEventListener('keydown', (e) => {
            if (e.key !== 'Enter') return;
            e.preventDefault();
            submitAdminAddUser(modalInstance);
        });
    }

    async function openAddUserModal() {
        if (!window.ModalSystem?.create) {
            alert('Modal system not available.');
            return;
        }
        if (addUserModal?.isOpen) {
            addUserModal.close();
        }

        let isAdminUser = false;
        try {
            isAdminUser = !!(await window.apiHelper?.isAdmin?.());
        } catch (_) {
            isAdminUser = false;
        }

        addUserModal = window.ModalSystem.create({
            id: ADD_USER_MODAL_ID,
            title: null,
            content: isAdminUser ? buildAdminAddUserModalContentHtml() : buildAddUserModalContentHtml(),
            footer: null,
            showCloseButton: false,
            closeOnBackdrop: true,
            closeOnEscape: true,
            onOpen: async (modalInstance) => {
                addUserModal = modalInstance;
                if (modalInstance?.dialog) {
                    modalInstance.dialog.style.maxWidth = '400px';
                    modalInstance.dialog.style.width = '90vw';
                }
                if (isAdminUser) {
                    bindAdminAddUserModalHandlers(modalInstance);
                    const errorEl = modalInstance.dialogContent?.querySelector('#mus-add-user-error');
                    try {
                        const candidates = await fetchCandidateUsersForAdmin();
                        populateAdminUserSelect(modalInstance.dialogContent, candidates);
                        setTimeout(() => modalInstance.dialogContent?.querySelector('#mus-add-user-select')?.focus(), 50);
                    } catch (err) {
                        populateAdminUserSelect(modalInstance.dialogContent, []);
                        if (errorEl) {
                            errorEl.textContent = err?.message || 'Failed to load users';
                            errorEl.style.display = 'block';
                        }
                    }
                } else {
                    bindAddUserModalHandlers(modalInstance);
                }
            }
        });
        if (addUserModal) {
            addUserModal.onClose = () => {
                addUserModal = null;
            };
        }
    }

    function openManageModal() {
        openWatchTogetherPrompt({
            title: 'Watch Together',
            showRemove: true,
            applyImmediately: true
        });
    }

    function removeLegacyPreferencesLinks() {
        document.querySelectorAll('[data-kefin-watch-state-sync], [data-kefin-add-user-session]').forEach((el) => {
            el.remove();
        });
    }

    async function registerUserMenuLink(attempt = 0) {
        removeLegacyPreferencesLinks();

        if (!window.KefinTweaksUtils?.addCustomMenuLink) {
            if (attempt < 20) {
                setTimeout(() => registerUserMenuLink(attempt + 1), 500);
            } else {
                WARN('addCustomMenuLink not available; Watch Together user menu link not registered');
            }
            return;
        }

        try {
            await window.KefinTweaksUtils.addCustomMenuLink(
                'Watch Together',
                'group',
                '#',
                false,
                {
                    userMenu: true,
                    sideMenu: false,
                    isUserLink: true,
                    action: 'KefinWatchTogether.openManageModal'
                }
            );
            LOG('Registered Watch Together user menu link');
        } catch (e) {
            ERR('Failed to register Watch Together user menu link:', e);
        }
    }

    function shouldPromptWatchTogether() {
        if (!getSessionUsers().length) return false;
        if (inContinuousVideoSession) return false;
        const { lastSelectionAt } = readDeviceState();
        if (lastSelectionAt && (Date.now() - lastSelectionAt) < getSessionTimeoutMs()) {
            return false;
        }
        return true;
    }

    function showWatchTogetherSessionToast() {
        const names = getEnabledSessionUsers()
            .map((u) => u.name || u.userId)
            .filter(Boolean);
        if (!names.length) return;
        const result = window.KefinTweaksToaster?.toast?.(`You are watching with ${names.join(', ')}`);
        if (result?.element) {
            // Sit above the video OSD controls
            result.element.style.marginBottom = '140px';
        }
    }

    function handleVideoPageEnter() {
        // If the WatchTogether button doesn't exist, show the toast as we can assume it's the start of a new session
        if (!watchTogetherOsdButtonExists()) {
            showWatchTogetherSessionToast();
            return;
        }

        addWatchTogetherOsdButton();

        if (!shouldPromptWatchTogether()) {
            updateSyncListenerState();
            return;
        }

        stampLastSelectionAt(getEnabledSessionUsers().map((u) => u.userId));
        updateSyncListenerState();
        addWatchTogetherOsdButton();
        inContinuousVideoSession = true;
    }

    function handleVideoPageLeave() {
        inContinuousVideoSession = false;
    }

    function watchTogetherOsdButtonExists() {
        return !!document.querySelector('.skinBody .skinHeader button.btnWatchTogether');
    }

    function createWatchTogetherOsdButton(anchor = null) {
        const button = document.createElement('button');
        button.type = 'button';
        button.title = 'Watch Together';

        const ariaControls = anchor?.getAttribute?.('aria-controls');
        const isMuiAnchor = ariaControls === 'app-sync-play-menu'
            || ariaControls === 'app-remote-play-menu';

        if (isMuiAnchor && anchor.className) {
            // v12: copy MuiIconButton + emotion hash (e.g. css-i2hxb6) from Sync/Cast
            button.className = `${anchor.className} btnWatchTogether`.trim();
            const icon = document.createElement('span');
            icon.className = 'material-icons';
            icon.setAttribute('aria-hidden', 'true');
            icon.textContent = 'group';
            button.appendChild(icon);
        } else {
            button.setAttribute('is', 'paper-icon-button-light');
            button.className = 'btnWatchTogether autoSize paper-icon-button-light';
            const icon = document.createElement('span');
            icon.className = 'xlargePaperIconButton material-icons group';
            icon.setAttribute('aria-hidden', 'true');
            button.appendChild(icon);
        }

        button.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            openManageModal();
        });
        return button;
    }

    function addWatchTogetherOsdButton() {
        if (isAddingOsdButton) return;

        isAddingOsdButton = true;

        // Drop any legacy bottom-OSD button from older builds
        const existingButtons = document.querySelectorAll('#videoOsdPage button.btnWatchTogether');
        if (existingButtons && existingButtons.length > 0) {
            isAddingOsdButton = false;
            return;
        }

        if (watchTogetherOsdButtonExists()) {
            updateWatchTogetherOsdButtonActiveState();
            isAddingOsdButton = false;
            return;
        }

        const osdHeader = document.querySelector('.skinBody .skinHeader.osdHeader, #reactRoot > div:not([style*="display: none"]) > .skinHeader.osdHeader');
        if (!osdHeader) {
            isAddingOsdButton = false;
            return;
        }

        try {
            // v10/v11: header*Button classes; v12 MUI: aria-controls menu ids
            const anchor = osdHeader.querySelector('.headerSyncButton, [aria-controls="app-sync-play-menu"]')
                || osdHeader.querySelector('.headerCastButton, [aria-controls="app-remote-play-menu"]')
                || osdHeader.querySelector('.headerSearchButton');

            const btn = createWatchTogetherOsdButton(anchor);
            if (anchor?.parentNode) {
                anchor.parentNode.insertBefore(btn, anchor);
            } else {
                const headerRight = osdHeader.querySelector('.headerRight');
                (headerRight || osdHeader).appendChild(btn);
            }
            updateWatchTogetherOsdButtonActiveState();
        } finally {
            isAddingOsdButton = false;
        }
    }

    function registerVideoPageHandler() {
        if (!window.KefinTweaksUtils?.onViewPage) {
            setTimeout(registerVideoPageHandler, 1000);
            return;
        }

        window.KefinTweaksUtils.onViewPage((view, element, hash, itemPromise, previousHash) => {
            const onVideo = hash && (hash.includes('#/video') || hash.includes('/video'));
            const previousOnVideo = previousHash && (previousHash.includes('#/video') || previousHash.includes('/video'));

            if (onVideo && !previousOnVideo) {
                handleVideoPageEnter();
                addWatchTogetherOsdButton();
            } else if (inContinuousVideoSession) {
                handleVideoPageLeave();
            }
        }, {
            pages: ['video']
        });

        if (window.location.hash.includes('#/video') || window.location.hash.includes('/video')) {
            handleVideoPageEnter();
        }

        LOG('Video onViewPage handler registered');
    }

    async function initialize() {
        try {
            LOG('initialize: start', { hash: window.location.hash });
            if (window.userHelper?.waitForLogin) {
                LOG('initialize: waiting for login');
                await window.userHelper.waitForLogin();
                LOG('initialize: login ready');
            } else {
                LOG('initialize: userHelper.waitForLogin unavailable, continuing');
            }
            injectStyles();
            LOG('initialize: hydrating group cache');
            await hydrateGroupCache();
            LOG('initialize: group hydrated', {
                groupHydrated,
                userCount: groupCache?.users?.length ?? 0
            });
            updateHeaderWatchTogetherIndicator();
            updateSyncListenerState();
            LOG('initialize: registering video page handler + user menu link');
            registerVideoPageHandler();
            LOG('Initialized');
        } catch (e) {
            ERR('Initialization failed:', e);
        }
    }

    window.KefinWatchTogether = {
        openManageModal,
        openWatchTogetherPrompt,
        getSessionUsers,
        getEnabledSessionUsers,
        updateSyncListenerState,
        hydrateGroupCache
    };

    initialize().then(() => {
        registerUserMenuLink();
    });
})();
