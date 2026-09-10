// KefinTweaks Watch Together Configuration UI

(function () {
    'use strict';

    const LOG = (...args) => console.log('[KefinTweaks WatchTogether Config]', ...args);
    const ERR = (...args) => console.error('[KefinTweaks WatchTogether Config]', ...args);

    const MODAL_ID = 'kefin-watchtogether-config';
    const DEFAULT_SESSION_TIMEOUT_MINUTES = 30;

    async function loadConfig() {
        const config = window.KefinTweaksConfig || {};
        return config.watchTogether || {};
    }

    async function saveConfig(watchTogetherConfig) {
        try {
            if (!window.KefinTweaksConfig) {
                window.KefinTweaksConfig = {};
            }
            window.KefinTweaksConfig.watchTogether = watchTogetherConfig;

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

    function buildConfigHTML(config) {
        const timeout = Number.isFinite(config.sessionTimeout * 1)
            ? config.sessionTimeout * 1
            : DEFAULT_SESSION_TIMEOUT_MINUTES;

        return `
            <div style="max-width: 640px;">
                <div class="listItem" style="border: 1px solid rgba(255,255,255,0.1); border-radius: 4px; padding: 0.75em; margin-bottom: 1em;">
                    <div class="listItemContent">
                        <div class="listItemBodyText" style="margin-bottom: 0.5em;">Session timeout (minutes)</div>
                        <div class="listItemBodyText secondary" style="margin-bottom: 0.75em; font-size: 0.9em;">
                            After selecting who is watching, skip the Watch Together prompt for this many minutes
                            when starting another item on this device. Playback that continues on the video OSD
                            (autoplay) never re-prompts.
                        </div>
                        <div class="hsae-field-wrap">
                            <input type="number" id="wt-session-timeout" class="fld emby-input"
                                min="1" step="1" value="${timeout}">
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    function collectConfig() {
        const raw = parseInt(document.querySelector('#wt-session-timeout')?.value || String(DEFAULT_SESSION_TIMEOUT_MINUTES), 10);
        const sessionTimeout = Number.isFinite(raw) && raw > 0 ? raw : DEFAULT_SESSION_TIMEOUT_MINUTES;
        return { sessionTimeout };
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
                <button class="emby-button raised block button-submit" id="save-watchtogether-config-btn">Save</button>
            `;

            const modalInstance = window.ModalSystem.create({
                id: MODAL_ID,
                title: 'Watch Together',
                content,
                footer,
                closeOnBackdrop: true,
                closeOnEscape: true,
                showCloseButton: true,
                onOpen: (modal) => {
                    const saveBtn = modal.dialogFooter.querySelector('#save-watchtogether-config-btn');
                    if (saveBtn) {
                        saveBtn.addEventListener('click', async () => {
                            const next = collectConfig();
                            const success = await saveConfig(next);
                            if (success) {
                                window.KefinTweaksToaster?.toast?.('Watch Together configuration saved!');
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
            LOG('Watch Together configuration modal opened');
        } catch (error) {
            ERR('Error opening Watch Together config modal:', error);
            alert('Error opening configuration: ' + error.message);
        }
    }

    window.KefinTweaksFeatureConfigs = window.KefinTweaksFeatureConfigs || {};
    window.KefinTweaksFeatureConfigs.watchTogether = { openConfigModal };

    console.log('[KefinTweaks WatchTogether Config] Script loaded');
})();
