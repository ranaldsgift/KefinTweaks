// KefinTweaks Series Episodes Configuration UI
// Modular configuration modal for managing series episodes settings

(function() {
    'use strict';

    const LOG = (...args) => console.log('[KefinTweaks SeriesInfo Config]', ...args);
    const ERR = (...args) => console.error('[KefinTweaks SeriesInfo Config]', ...args);

    const MODAL_ID = 'kefin-seriesinfo-config';

    /**
     * Load configuration from window.KefinTweaksConfig
     */
    async function loadConfig() {
        const config = window.KefinTweaksConfig || {};
        return config.seriesInfo || {};
    }

    /**
     * Save configuration to JS Injector
     */
    async function saveConfig(seriesInfoConfig) {
        try {
            // Ensure window.KefinTweaksConfig exists
            if (!window.KefinTweaksConfig) {
                window.KefinTweaksConfig = {};
            }

            // Update flattenSingleSeasonShows config
            window.KefinTweaksConfig.seriesInfo = seriesInfoConfig;

            // Save to JS Injector using utils
            if (window.KefinTweaksUtils && window.KefinTweaksUtils.saveConfigToJavaScriptInjector) {
                await window.KefinTweaksUtils.saveConfigToJavaScriptInjector();
                LOG('Configuration saved to JS Injector');
                return true;
            } else {
                // Fallback: use findJavaScriptInjectorPlugin and saveConfigToJavaScriptInjector from configuration.js
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
            }
        } catch (error) {
            ERR('Error saving config:', error);
            return false;
        }
    }

    /**
     * Build configuration HTML
     */
    function buildConfigHTML(config) {
        const use24HourTimeFormat = config.use24HourTimeFormat === true;
        return `
            <div style="max-width: 800px;">
                <div class="listItem" style="border: 1px solid rgba(255,255,255,0.1); border-radius: 4px; padding: 0.75em; margin-bottom: 1em;">
                    <div class="listItemContent">
                        <div class="listItemBodyText" style="margin-bottom: 0.5em;">Use 24 Hour Time Format</div>
                        <div class="listItemBodyText secondary" style="margin-bottom: 0.75em; font-size: 0.9em;">When enabled, uses a 24 hour time format for the series info.</div>
                        <label class="checkboxContainer" style="display: flex; align-items: center; gap: 0.5em;">
                            <input type="checkbox" id="seriesInfo_use24HourTimeFormat" ${use24HourTimeFormat ? 'checked' : ''}>
                            <span class="listItemBodyText">Enabled</span>
                        </label>
                    </div>
                </div>
            </div>
        `;
    }

    /**
     * Collect configuration from form
     */
    function collectConfig() {
        const use24HourTimeFormat = document.getElementById('seriesInfo_use24HourTimeFormat')?.checked === true;
        return {
            use24HourTimeFormat: use24HourTimeFormat
        };
    }

    /**
     * Open configuration modal
     */
    async function openConfigModal() {
        try {
            // Load config
            const config = await loadConfig();

            // Build content
            const content = document.createElement('div');
            content.innerHTML = buildConfigHTML(config);

            // Build footer
            const footer = document.createElement('div');
            footer.style.display = 'flex';
            footer.style.gap = '0.75em';
            footer.style.justifyContent = 'flex-end';
            footer.innerHTML = `
                <button class="emby-button raised" onclick="window.ModalSystem.close('${MODAL_ID}')">Close</button>
                <button class="emby-button raised block button-submit" id="save-seriesinfo-config-btn">Save</button>
            `;

            // Create modal
            const modalInstance = window.ModalSystem.create({
                id: MODAL_ID,
                title: 'Series Info Configuration',
                content: content,
                footer: footer,
                closeOnBackdrop: true,
                closeOnEscape: true,
                showCloseButton: true,
                onOpen: (modal) => {
                    // Save button
                    const saveBtn = modal.dialogFooter.querySelector('#save-seriesinfo-config-btn');
                    if (saveBtn) {
                        saveBtn.addEventListener('click', async () => {
                            const seriesInfoConfig = collectConfig();
                            const success = await saveConfig(seriesInfoConfig);
                            if (success) {
                                if (window.KefinTweaksToaster && window.KefinTweaksToaster.toast) {
                                    window.KefinTweaksToaster.toast('Configuration saved!');
                                }
                                window.ModalSystem.close(MODAL_ID);
                            } else {
                                alert('Error saving configuration. Please ensure the JavaScript Injector plugin is installed and you have administrator permissions.');
                            }
                        });
                    }
                }
            });
            
            modalInstance.dialog.style.maxWidth = '90vw';
            modalInstance.dialog.style.width = '1400px';
            modalInstance.dialog.style.height = '90vh';

            LOG('Series Info configuration modal opened');
        } catch (error) {
            ERR('Error opening series info config modal:', error);
            alert('Error opening configuration: ' + error.message);
        }
    }

    // Export
    window.KefinTweaksFeatureConfigs = window.KefinTweaksFeatureConfigs || {};
    window.KefinTweaksFeatureConfigs.seriesInfo = { openConfigModal };

    console.log('[KefinTweaks SeriesInfo Config] Script loaded');

})();

