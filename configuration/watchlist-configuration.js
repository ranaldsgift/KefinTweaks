// KefinTweaks Watchlist Configuration UI

(function () {
    'use strict';

    const LOG = (...args) => console.log('[KefinTweaks Watchlist Config]', ...args);
    const ERR = (...args) => console.error('[KefinTweaks Watchlist Config]', ...args);

    const MODAL_ID = 'kefin-watchlist-config';

    const DEFAULTS = {
        sideMenu: true,
        topNavigation: true,
        userMenu: true
    };

    function normalizeConfig(raw) {
        const cfg = raw && typeof raw === 'object' ? raw : {};
        return {
            sideMenu: cfg.sideMenu !== false,
            topNavigation: cfg.topNavigation !== false && cfg.topNavigation !== 'none',
            userMenu: cfg.userMenu !== false
        };
    }

    async function loadConfig() {
        const config = window.KefinTweaksConfig || {};
        return normalizeConfig(config.watchlist);
    }

    async function saveConfig(watchlistConfig) {
        try {
            if (!window.KefinTweaksConfig) {
                window.KefinTweaksConfig = {};
            }
            window.KefinTweaksConfig.watchlist = watchlistConfig;

            if (window.KefinTweaksUtils && window.KefinTweaksUtils.saveConfigToJavaScriptInjector) {
                await window.KefinTweaksUtils.saveConfigToJavaScriptInjector();
                LOG('Configuration saved to JS Injector');
                return true;
            }
            if (window.KefinTweaksConfiguration && window.KefinTweaksConfiguration.findJavaScriptInjectorPlugin) {
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

    function buildToggleCard(id, checked, label, description) {
        if (typeof window.KefinTweaksUI?.buildToggleCard === 'function') {
            return window.KefinTweaksUI.buildToggleCard(id, checked, label, description);
        }
        return `
            <div class="listItem" style="border: 1px solid rgba(255,255,255,0.1); border-radius: 4px; padding: 0.75em; margin-bottom: 0.75em;">
                <label class="listItemBodyText" style="display:flex;align-items:center;gap:0.75em;">
                    <input type="checkbox" id="${id}" ${checked ? 'checked' : ''}>
                    <span>${label}</span>
                </label>
                ${description ? `<div class="listItemBodyText secondary" style="margin-top:0.35em;font-size:0.9em;">${description}</div>` : ''}
            </div>
        `;
    }

    function buildConfigHTML(config) {
        return `
            <div style="max-width: 640px;">
                ${buildToggleCard(
                    'wl-side-menu',
                    config.sideMenu,
                    'Side menu',
                    'Show a Watchlist link in the left navigation drawer.'
                )}
                ${buildToggleCard(
                    'wl-top-navigation',
                    config.topNavigation,
                    'Top navigation',
                    'Show Watchlist in the main top navigation bar (or via Custom Tabs when available).'
                )}
                ${buildToggleCard(
                    'wl-user-menu',
                    config.userMenu,
                    'User menu',
                    'Show a Watchlist link in the user settings menu.'
                )}
            </div>
        `;
    }

    function collectConfig() {
        const side = document.getElementById('wl-side-menu');
        const top = document.getElementById('wl-top-navigation');
        const user = document.getElementById('wl-user-menu');
        return {
            sideMenu: side ? side.checked : DEFAULTS.sideMenu,
            topNavigation: top ? top.checked : DEFAULTS.topNavigation,
            userMenu: user ? user.checked : DEFAULTS.userMenu
        };
    }

    function attachToggleHandlers(root) {
        if (typeof window.KefinTweaksUI?.bindToggleCards === 'function') {
            window.KefinTweaksUI.bindToggleCards(root);
            return;
        }
        root.querySelectorAll('.kefin-toggle-switch').forEach((btn) => {
            if (btn.dataset.kefinToggleBound === 'true') return;
            btn.dataset.kefinToggleBound = 'true';
            btn.addEventListener('click', () => {
                const next = btn.dataset.enabled !== 'true';
                btn.dataset.enabled = String(next);
                btn.setAttribute('aria-pressed', String(next));
                const checkboxId = btn.dataset.checkboxId;
                const checkbox = checkboxId ? document.getElementById(checkboxId) : null;
                if (checkbox) checkbox.checked = next;
            });
        });
    }

    async function openConfigModal() {
        try {
            const config = await loadConfig();
            const content = document.createElement('div');
            content.innerHTML = buildConfigHTML(config);

            const footer = document.createElement('div');
            footer.style.display = 'flex';
            footer.style.gap = '0.75em';
            footer.style.justifyContent = 'flex-end';
            footer.innerHTML = `
                <button class="emby-button raised" onclick="window.ModalSystem.close('${MODAL_ID}')">Close</button>
                <button class="emby-button raised block button-submit" id="save-watchlist-config-btn">Save</button>
            `;

            const modalInstance = window.ModalSystem.create({
                id: MODAL_ID,
                title: 'Watchlist',
                content,
                footer,
                closeOnBackdrop: true,
                closeOnEscape: true,
                showCloseButton: true,
                onOpen: (modal) => {
                    attachToggleHandlers(modal.dialogContent || content);
                    const saveBtn = modal.dialogFooter.querySelector('#save-watchlist-config-btn');
                    if (saveBtn) {
                        saveBtn.addEventListener('click', async () => {
                            const next = collectConfig();
                            const success = await saveConfig(next);
                            if (success) {
                                window.KefinTweaksToaster?.toast?.('Watchlist configuration saved!');
                                window.ModalSystem.close(MODAL_ID);
                            } else {
                                alert('Error saving configuration. Please ensure the JavaScript Injector plugin is installed and you have administrator permissions.');
                            }
                        });
                    }
                }
            });

            if (modalInstance?.dialog) {
                modalInstance.dialog.style.maxWidth = '90vw';
                modalInstance.dialog.style.width = '560px';
            }
            LOG('Watchlist configuration modal opened');
        } catch (error) {
            ERR('Error opening Watchlist config modal:', error);
            alert('Error opening configuration: ' + error.message);
        }
    }

    window.KefinTweaksFeatureConfigs = window.KefinTweaksFeatureConfigs || {};
    window.KefinTweaksFeatureConfigs.watchlist = { openConfigModal, DEFAULTS, normalizeConfig };

    console.log('[KefinTweaks Watchlist Config] Script loaded');
})();
