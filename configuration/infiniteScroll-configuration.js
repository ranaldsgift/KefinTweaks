// KefinTweaks Infinite Scroll Configuration UI

(function() {
    'use strict';

    const LOG = (...args) => console.log('[KefinTweaks InfiniteScroll Config]', ...args);
    const ERR = (...args) => console.error('[KefinTweaks InfiniteScroll Config]', ...args);

    const MODAL_ID = 'kefin-infinitescroll-config';

    function defaultOptions() {
        return {
            hidePageControls: false,
            onlyShowTotalItemCount: false,
            showFollowingAlphaLetters: false
        };
    }

    async function loadConfig() {
        const config = window.KefinTweaksConfig?.infiniteScroll;
        if (!config || typeof config !== 'object' || Array.isArray(config)) {
            return defaultOptions();
        }
        return {
            hidePageControls: config.hidePageControls === true,
            onlyShowTotalItemCount: config.onlyShowTotalItemCount === true,
            showFollowingAlphaLetters: config.showFollowingAlphaLetters === true
        };
    }

    async function saveConfig(infiniteScrollConfig) {
        try {
            if (!window.KefinTweaksConfig) {
                window.KefinTweaksConfig = {};
            }

            window.KefinTweaksConfig.infiniteScroll = infiniteScrollConfig;

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

    const TOGGLE_DESCRIPTIONS = {
        infiniteScroll_hidePageControls: {
            on: 'Left and Right page buttons will be hidden on Library pages with infinite scroll support',
            off: 'Left and Right page buttons are unchanged on Library pages.'
        },
        infiniteScroll_onlyShowTotalItemCount: {
            on: 'The "1 of 100" text will be hidden in favor of just showing the total item count of the library',
            off: 'The paginated item count is unchanged.'
        },
        infiniteScroll_showFollowingAlphaLetters: {
            on: 'The Alpha Picker loads items from the Letter chosen, and all following letters.',
            off: 'The Alpha Picker filters to only show items whose name starts with the chosen letter.'
        }
    };

    function toggleDescription(id, checked) {
        const entry = TOGGLE_DESCRIPTIONS[id];
        if (!entry) return '';
        return checked ? entry.on : entry.off;
    }

    function buildToggleCard(id, checked, label) {
        const description = toggleDescription(id, checked);
        if (typeof window.KefinTweaksUI?.buildToggleCard === 'function') {
            return window.KefinTweaksUI.buildToggleCard(id, checked, label, description);
        }
        return `
            <div class="kefin-toggle-card">
                <div class="kefin-toggle-card-text">
                    <div class="listItemBodyText kefin-toggle-card-label">${label}</div>
                    <div class="listItemBodyText secondary kefin-toggle-card-desc">${description}</div>
                </div>
                <input type="checkbox" id="${id}" ${checked ? 'checked' : ''}>
            </div>
        `;
    }

    function syncToggleDescriptions(root) {
        if (!root) return;
        Object.keys(TOGGLE_DESCRIPTIONS).forEach((id) => {
            const checkbox = root.querySelector('#' + id);
            const desc = checkbox?.closest('.kefin-toggle-card')?.querySelector('.kefin-toggle-card-desc');
            if (!checkbox || !desc) return;
            desc.textContent = toggleDescription(id, checkbox.checked);
        });
    }

    function buildConfigHTML(config) {
        return `
            <div style="max-width: 800px; display: grid; gap: 1em;">
                ${buildToggleCard(
                    'infiniteScroll_hidePageControls',
                    config.hidePageControls === true,
                    'Hide Page Controls'
                )}
                ${buildToggleCard(
                    'infiniteScroll_onlyShowTotalItemCount',
                    config.onlyShowTotalItemCount === true,
                    'Only Show Total Item Count'
                )}
                ${buildToggleCard(
                    'infiniteScroll_showFollowingAlphaLetters',
                    config.showFollowingAlphaLetters === true,
                    'Show items from Letters following the one selected in the Alpha Picker'
                )}
            </div>
        `;
    }

    function collectConfig() {
        return {
            hidePageControls: document.getElementById('infiniteScroll_hidePageControls')?.checked === true,
            onlyShowTotalItemCount: document.getElementById('infiniteScroll_onlyShowTotalItemCount')?.checked === true,
            showFollowingAlphaLetters: document.getElementById('infiniteScroll_showFollowingAlphaLetters')?.checked === true
        };
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
                <button class="emby-button raised block button-submit" id="save-infinitescroll-config-btn">Save</button>
            `;

            window.ModalSystem.create({
                id: MODAL_ID,
                title: 'Infinite Scroll Configuration',
                content: content,
                footer: footer,
                closeOnBackdrop: true,
                closeOnEscape: true,
                showCloseButton: true,
                dialogStyle: window.innerWidth >= 900
                    ? { maxWidth: '90vw', width: '500px', height: 'auto' }
                    : undefined,
                onOpen: (modal) => {
                    const root = modal.dialogContent || content;
                    window.KefinTweaksUI?.bindToggleCards?.(root);
                    syncToggleDescriptions(root);
                    root.addEventListener('change', (e) => {
                        if (e.target?.id && TOGGLE_DESCRIPTIONS[e.target.id]) {
                            syncToggleDescriptions(root);
                        }
                    });
                    const saveBtn = modal.dialogFooter.querySelector('#save-infinitescroll-config-btn');
                    if (!saveBtn) return;
                    saveBtn.addEventListener('click', async () => {
                        const infiniteScrollConfig = collectConfig();
                        const success = await saveConfig(infiniteScrollConfig);
                        if (success) {
                            if (window.KefinTweaksToaster && window.KefinTweaksToaster.toast) {
                                window.KefinTweaksToaster.toast('Infinite Scroll configuration saved!');
                            }
                            window.ModalSystem.close(MODAL_ID);
                        } else {
                            alert('Error saving configuration. Please ensure the JavaScript Injector plugin is installed and you have administrator permissions.');
                        }
                    });
                }
            });

            LOG('Infinite Scroll configuration modal opened');
        } catch (error) {
            ERR('Error opening infinite scroll config modal:', error);
            alert('Error opening configuration: ' + error.message);
        }
    }

    window.KefinTweaksFeatureConfigs = window.KefinTweaksFeatureConfigs || {};
    window.KefinTweaksFeatureConfigs.infiniteScroll = { openConfigModal };

    console.log('[KefinTweaks InfiniteScroll Config] Script loaded');
})();
