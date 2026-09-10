// KefinTweaks User Manager — dashboard hooks for user templates

(function () {
    'use strict';

    const LOG = (...args) => console.log('[KefinTweaks UserManager]', ...args);
    const ERR = (...args) => console.error('[KefinTweaks UserManager]', ...args);
    const WARN = (...args) => console.warn('[KefinTweaks UserManager]', ...args);

    const BULK_MODAL_ID = 'kefin-usermanager-bulk';
    const NONE = 'None';
    const MARKER_ADD = 'data-um-add-injected';
    const MARKER_BULK = 'data-um-bulk-injected';

    function clonePolicy(policy) {
        if (window.KefinUserManagerConfig?.clonePolicy) {
            return window.KefinUserManagerConfig.clonePolicy(policy);
        }
        return JSON.parse(JSON.stringify(policy ?? {}));
    }

    function loadConfig() {
        if (window.KefinUserManagerConfig?.loadConfig) {
            return window.KefinUserManagerConfig.loadConfig();
        }
        const raw = window.KefinTweaksConfig?.userManager || {};
        return {
            defaultTemplateName: raw.defaultTemplateName || '',
            templates: Array.isArray(raw.templates) ? raw.templates : []
        };
    }

    function getAuthHeader() {
        return window.apiHelper?.getAuthHeader?.() || '';
    }

    async function apiJson(url, options = {}) {
        const response = await fetch(url, {
            ...options,
            headers: {
                Authorization: getAuthHeader(),
                Accept: 'application/json',
                ...(options.body ? { 'Content-Type': 'application/json' } : {}),
                ...(options.headers || {})
            }
        });
        if (!response.ok) {
            let detail = `${response.status}`;
            try {
                const body = await response.json();
                detail = body?.message || body?.Message || detail;
            } catch (_) {
                try {
                    const text = await response.text();
                    if (text) detail = text;
                } catch (__) { /* ignore */ }
            }
            throw new Error(detail);
        }
        if (response.status === 204) return null;
        const text = await response.text();
        if (!text) return null;
        try {
            return JSON.parse(text);
        } catch (_) {
            return text;
        }
    }

    async function createUser(name, password) {
        const url = ApiClient.getUrl('Users/New');
        return apiJson(url, {
            method: 'POST',
            body: JSON.stringify({ Name: name, Password: password })
        });
    }

    async function applyPolicy(userId, policy) {
        const url = ApiClient.getUrl(`Users/${userId}/Policy`);
        return apiJson(url, {
            method: 'POST',
            body: JSON.stringify(policy)
        });
    }

    async function fetchUsers() {
        if (typeof ApiClient?.getUsers === 'function') {
            const users = await ApiClient.getUsers();
            return Array.isArray(users) ? users : [];
        }
        const users = await apiJson(ApiClient.getUrl('Users'), { method: 'GET' });
        return Array.isArray(users) ? users : [];
    }

    function toast(msg) {
        window.KefinTweaksToaster?.toast?.(msg);
    }

    function isAddUserPage(hash) {
        const h = hash || window.location.hash || '';
        return /\/dashboard\/users\/usernew\b/i.test(h) || /\/dashboard\/users\/add\b/i.test(h);
    }

    function isUsersListPage(hash) {
        const h = hash || window.location.hash || '';
        if (isAddUserPage(h)) return false;
        if (/\/dashboard\/users\/user\b/i.test(h)) return false;
        return /\/dashboard\/users\/?(\?|$|#|$)/i.test(h) || /#\/dashboard\/users\/?$/i.test(h);
    }

    function getNewUserPage() {
        return document.querySelector('#newUserPage')
            || document.querySelector('.newUserPage')
            || document.querySelector('[data-role="page"].newUserPage');
    }

    function waitForElement(getter, timeoutMs = 8000, intervalMs = 100) {
        return new Promise((resolve) => {
            const start = Date.now();
            const tick = () => {
                const el = getter();
                if (el) {
                    resolve(el);
                    return;
                }
                if (Date.now() - start >= timeoutMs) {
                    resolve(null);
                    return;
                }
                setTimeout(tick, intervalMs);
            };
            tick();
        });
    }

    function getTemplateOptionsHtml(config, includeNone) {
        const names = (config.templates || []).map((t) => t.name);
        const options = [];
        if (includeNone) {
            options.push(`<option value="${NONE}">${NONE}</option>`);
        }
        names.forEach((name) => {
            options.push(`<option value="${escapeAttr(name)}">${escapeHtml(name)}</option>`);
        });
        return options.join('');
    }

    function escapeHtml(str) {
        return String(str ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    function escapeAttr(str) {
        return escapeHtml(str).replace(/'/g, '&#39;');
    }

    function findNativeSaveButton(page) {
        return page.querySelector('.newUserProfileForm .emby-button.button-submit:not(.um-kefin-save)')
            || page.querySelector('form .emby-button.button-submit:not(.um-kefin-save)')
            || page.querySelector('.button-submit:not(.um-kefin-save)');
    }

    function updateSaveVisibility(page, templateName) {
        const useTemplate = templateName && templateName !== NONE;
        page.setAttribute('data-user-template', useTemplate ? templateName : NONE);

        const nativeSave = findNativeSaveButton(page);
        const kefinSave = page.querySelector('.um-kefin-save');
        if (nativeSave) {
            nativeSave.style.display = useTemplate ? 'none' : '';
        }
        if (kefinSave) {
            kefinSave.style.display = useTemplate ? '' : 'none';
        }
    }

    async function handleKefinSave(page) {
        const select = page.querySelector('#um-template-select');
        const templateName = select?.value || NONE;
        if (templateName === NONE) return;

        const config = loadConfig();
        const template = config.templates.find((t) => t.name === templateName);
        if (!template?.policy) {
            toast('Selected template was not found');
            return;
        }

        const nameInput = page.querySelector('#txtUsername')
            || page.querySelector('input[type="text"]');
        const passwordInput = page.querySelector('#txtPassword')
            || page.querySelector('input[type="password"]');
        const name = (nameInput?.value || '').trim();
        const password = passwordInput?.value || '';

        if (!name) {
            toast('Username is required');
            nameInput?.focus();
            return;
        }

        const kefinSave = page.querySelector('.um-kefin-save');
        if (kefinSave) kefinSave.disabled = true;

        try {
            const created = await createUser(name, password);
            const userId = created?.Id || created?.id;
            if (!userId) throw new Error('User created but no Id returned');

            await applyPolicy(userId, clonePolicy(template.policy));
            toast(`User "${name}" created with template "${templateName}"`);
            window.location.hash = '#/dashboard/users';
        } catch (e) {
            ERR('Failed to create user with template', e);
            toast(`Failed to create user: ${e.message || e}`);
        } finally {
            if (kefinSave) kefinSave.disabled = false;
        }
    }

    async function injectAddUserPage() {
        const page = await waitForElement(getNewUserPage);
        if (!page) {
            WARN('New user page not found');
            return;
        }
        if (page.getAttribute(MARKER_ADD) === '1') {
            // Refresh template options in case config changed
            refreshAddUserTemplateSelect(page);
            return;
        }

        const passwordField = await waitForElement(() =>
            page.querySelector('#txtPassword')
            || page.querySelector('input[type="password"]')
        );
        if (!passwordField) {
            WARN('Password field not found on new user page');
            return;
        }

        const config = loadConfig();
        const defaultName = config.defaultTemplateName && config.templates.some((t) => t.name === config.defaultTemplateName)
            ? config.defaultTemplateName
            : NONE;

        const templatesContainer = document.createElement('div');
        templatesContainer.className = 'um-template-field inputContainer';
        templatesContainer.innerHTML = `
            <div class="um-template-field-row">
                <div class="selectContainer">
                    <label class="selectLabel" for="um-template-select">Template</label>
                    <select is="emby-select" id="um-template-select" class="emby-select-withcolor emby-select">
                        ${getTemplateOptionsHtml(config, true)}
                    </select>
                </div>
            </div>
        `;

        const editTemplatesContainer = document.createElement('div');
        editTemplatesContainer.className = 'um-template-field inputContainer';
        editTemplatesContainer.innerHTML = `
            <div class="um-template-field-row">
                <button type="button" class="emby-button raised um-edit-templates-btn block" title="Edit Templates">
                    Edit Templates
                </button>
            </div>
        `;

        const passwordContainer = passwordField.closest('.inputContainer') || passwordField.parentElement;
        if (passwordContainer?.parentElement) {
            passwordContainer.parentElement.insertBefore(templatesContainer, passwordContainer.nextSibling);
            passwordContainer.parentElement.insertBefore(editTemplatesContainer, templatesContainer.nextSibling);
        } else {
            passwordField.insertAdjacentElement('afterend', templatesContainer);
            passwordField.insertAdjacentElement('afterend', editTemplatesContainer);
        }

        const select = templatesContainer.querySelector('#um-template-select');
        if (select) {
            select.value = defaultName;
            if (![...select.options].some((o) => o.value === defaultName)) {
                select.value = NONE;
            }
        }

        editTemplatesContainer.querySelector('.um-edit-templates-btn')?.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            if (window.KefinUserManagerConfig?.openConfigModal) {
                window.KefinUserManagerConfig.openConfigModal();
            } else if (window.KefinTweaksFeatureConfigs?.userManager?.openConfigModal) {
                window.KefinTweaksFeatureConfigs.userManager.openConfigModal();
            } else {
                toast('User Manager configuration is not available');
            }
        });

        select?.addEventListener('change', () => {
            updateSaveVisibility(page, select.value || NONE);
        });

        // Kefin Save button next to native submit
        const nativeSave = await waitForElement(() => findNativeSaveButton(page), 5000);
        const kefinSave = document.createElement('button');
        kefinSave.type = 'button';
        kefinSave.className = 'raised button-submit block emby-button um-kefin-save';
        kefinSave.textContent = 'Save';
        kefinSave.style.display = 'none';
        kefinSave.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            handleKefinSave(page);
        });

        if (nativeSave?.parentElement) {
            nativeSave.parentElement.insertBefore(kefinSave, nativeSave.nextSibling);
        } else {
            const form = page.querySelector('form') || page;
            form.appendChild(kefinSave);
        }

        page.setAttribute(MARKER_ADD, '1');
        updateSaveVisibility(page, select?.value || NONE);
        LOG('Injected template controls on add-user page');
    }

    function refreshAddUserTemplateSelect(page) {
        const select = page.querySelector('#um-template-select');
        if (!select) return;
        const prev = select.value;
        const config = loadConfig();
        select.innerHTML = getTemplateOptionsHtml(config, true);
        if ([...select.options].some((o) => o.value === prev)) {
            select.value = prev;
        } else if (config.defaultTemplateName && [...select.options].some((o) => o.value === config.defaultTemplateName)) {
            select.value = config.defaultTemplateName;
        } else {
            select.value = NONE;
        }
        updateSaveVisibility(page, select.value || NONE);
    }

    async function openBulkEditor() {
        if (!window.ModalSystem?.create) {
            toast('Modal system not available');
            return;
        }

        const config = loadConfig();
        if (!config.templates.length) {
            toast('Create a user template first in Features → User Manager');
            return;
        }

        let users = [];
        try {
            users = await fetchUsers();
        } catch (e) {
            ERR('Failed to load users', e);
            toast(`Failed to load users: ${e.message || e}`);
            return;
        }

        users = users
            .filter((u) => u?.Id && u.Name)
            .sort((a, b) => String(a.Name).localeCompare(String(b.Name), undefined, { sensitivity: 'base' }));

        const defaultTemplate = config.defaultTemplateName && config.templates.some((t) => t.name === config.defaultTemplateName)
            ? config.defaultTemplateName
            : config.templates[0].name;

        const content = document.createElement('div');
        content.className = 'um-bulk-root';
        content.innerHTML = `
            <div class="selectContainer">
                <label class="selectLabel" for="um-bulk-template">Template</label>
                <select is="emby-select" id="um-bulk-template" class="emby-select-withcolor emby-select">
                    ${getTemplateOptionsHtml(config, false)}
                </select>
            </div>
            <div class="um-bulk-toolbar">
                <button type="button" class="emby-button raised" id="um-bulk-select-all">Select all</button>
                <button type="button" class="emby-button raised" id="um-bulk-select-none">Select none</button>
            </div>
            <div class="um-bulk-user-list">
                ${users.map((u) => `
                    <label class="um-bulk-user-item">
                        <input type="checkbox" class="um-bulk-user-check" value="${escapeAttr(u.Id)}" data-name="${escapeAttr(u.Name)}" />
                        <span>${escapeHtml(u.Name)}</span>
                    </label>
                `).join('') || '<div style="padding:0.75em;opacity:0.7;">No users found</div>'}
            </div>
            <div class="um-bulk-status" id="um-bulk-status"></div>
        `;

        const templateSelect = content.querySelector('#um-bulk-template');
        if (templateSelect) templateSelect.value = defaultTemplate;

        content.querySelector('#um-bulk-select-all')?.addEventListener('click', () => {
            content.querySelectorAll('.um-bulk-user-check').forEach((cb) => { cb.checked = true; });
            syncApplyEnabled();
        });
        content.querySelector('#um-bulk-select-none')?.addEventListener('click', () => {
            content.querySelectorAll('.um-bulk-user-check').forEach((cb) => { cb.checked = false; });
            syncApplyEnabled();
        });
        content.querySelectorAll('.um-bulk-user-check').forEach((cb) => {
            cb.addEventListener('change', syncApplyEnabled);
        });

        const footer = document.createElement('div');
        footer.style.cssText = 'display:flex;gap:0.75em;justify-content:flex-end;';
        footer.innerHTML = `
            <button type="button" class="emby-button raised" id="um-bulk-cancel">Cancel</button>
            <button type="button" class="emby-button raised button-submit" id="um-bulk-apply" disabled>Apply</button>
        `;

        function syncApplyEnabled() {
            const any = !!content.querySelector('.um-bulk-user-check:checked');
            const applyBtn = footer.querySelector('#um-bulk-apply');
            if (applyBtn) applyBtn.disabled = !any;
        }

        footer.querySelector('#um-bulk-cancel')?.addEventListener('click', () => {
            window.ModalSystem.close(BULK_MODAL_ID);
        });

        footer.querySelector('#um-bulk-apply')?.addEventListener('click', async () => {
            const applyBtn = footer.querySelector('#um-bulk-apply');
            const statusEl = content.querySelector('#um-bulk-status');
            const templateName = templateSelect?.value;
            const template = loadConfig().templates.find((t) => t.name === templateName);
            if (!template?.policy) {
                toast('Selected template was not found');
                return;
            }

            const selected = [...content.querySelectorAll('.um-bulk-user-check:checked')].map((cb) => ({
                id: cb.value,
                name: cb.dataset.name || cb.value
            }));
            if (!selected.length) return;

            if (applyBtn) applyBtn.disabled = true;
            let ok = 0;
            let fail = 0;
            for (let i = 0; i < selected.length; i++) {
                const user = selected[i];
                if (statusEl) {
                    statusEl.textContent = `Applying (${i + 1}/${selected.length}): ${user.name}`;
                }
                try {
                    await applyPolicy(user.id, clonePolicy(template.policy));
                    ok++;
                } catch (e) {
                    fail++;
                    ERR(`Failed policy apply for ${user.name}`, e);
                }
            }

            const summary = fail
                ? `Applied template to ${ok} user(s); ${fail} failed`
                : `Applied template to ${ok} user(s)`;
            if (statusEl) statusEl.textContent = summary;
            toast(summary);
            if (applyBtn) applyBtn.disabled = false;
            if (!fail) {
                window.ModalSystem.close(BULK_MODAL_ID);
            }
        });

        const modal = window.ModalSystem.create({
            id: BULK_MODAL_ID,
            title: 'Bulk edit user accounts',
            content,
            footer,
            closeOnBackdrop: true,
            closeOnEscape: true,
            showCloseButton: true
        });
        if (modal?.dialog) {
            modal.dialog.style.maxWidth = '720px';
            modal.dialog.style.width = '90vw';
        }
        syncApplyEnabled();
    }

    async function injectUsersListPage() {
        const addBtn = await waitForElement(() =>
            document.querySelector('#btnAddUser')
            || document.querySelector('button[title*="Add user" i]')
            || document.querySelector('.btnAddUser')
        );
        if (!addBtn) {
            WARN('Add user button not found on users list');
            return;
        }

        const parent = addBtn.parentElement || addBtn.closest('.fabSection') || addBtn.closest('.sectionTitleContainer');
        if (!parent) return;
        if (parent.querySelector('.um-bulk-fab') || parent.getAttribute(MARKER_BULK) === '1') return;

        const fab = document.createElement('button');
        fab.type = 'button';
        fab.className = 'fab btnFloating um-bulk-fab sectionTitleButton';
        fab.title = 'Bulk edit user accounts';
        fab.setAttribute('is', 'emby-button');
        fab.innerHTML = '<span class="material-icons edit" aria-hidden="true"></span>';
        fab.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            openBulkEditor();
        });

        // Place next to add-user fab
        if (addBtn.nextSibling) {
            parent.insertBefore(fab, addBtn.nextSibling);
        } else {
            parent.appendChild(fab);
        }
        parent.setAttribute(MARKER_BULK, '1');
        LOG('Injected bulk-edit fab on users list');
    }

    async function handleView(hash) {
        try {
            const admin = !!(await window.apiHelper?.isAdmin?.());
            if (!admin) return;

            if (isAddUserPage(hash)) {
                await injectAddUserPage();
            } else if (isUsersListPage(hash)) {
                await injectUsersListPage();
            }
        } catch (e) {
            ERR('onViewPage handler error', e);
        }
    }

    function register() {
        if (!window.KefinTweaksUtils?.onViewPage) {
            WARN('onViewPage unavailable, retrying...');
            setTimeout(register, 500);
            return;
        }

        window.KefinTweaksUtils.onViewPage((view, element, hash) => {
            // Defer slightly so Jellyfin finishes painting the form
            setTimeout(() => handleView(hash || window.location.hash), 250);
        }, {
            pages: ['dashboard/users']
        });

        // Immediate check for already-open page
        setTimeout(() => handleView(window.location.hash), 400);
        LOG('User Manager handlers registered');
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', register);
    } else {
        register();
    }
})();
