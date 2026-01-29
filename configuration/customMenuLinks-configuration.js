// KefinTweaks Custom Menu Links Configuration UI
// Modular configuration modal for managing custom menu links

(function() {
    'use strict';

    const LOG = (...args) => console.log('[KefinTweaks CustomMenuLinks Config]', ...args);
    const ERR = (...args) => console.error('[KefinTweaks CustomMenuLinks Config]', ...args);

    const MODAL_ID = 'kefin-custommenulinks-config';

    /**
     * Load configuration from window.KefinTweaksConfig
     */
    async function loadConfig() {
        const config = window.KefinTweaksConfig || {};
        return config.customMenuLinks || [];
    }

    /**
     * Save configuration to JS Injector
     */
    async function saveConfig(customMenuLinks) {
        try {
            // Ensure window.KefinTweaksConfig exists
            if (!window.KefinTweaksConfig) {
                window.KefinTweaksConfig = {};
            }

            // Update customMenuLinks config
            window.KefinTweaksConfig.customMenuLinks = customMenuLinks;

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
        return `
            <div style="max-width: 800px;">
                <div class="listItem" style="border: 1px solid rgba(255,255,255,0.1); border-radius: 4px; padding: 0.75em; margin-bottom: 1em;">
                    <div class="listItemContent">
                        <div class="listItemBodyText" style="margin-bottom: 0.5em;">Custom Menu Links JSON</div>
                        <div class="listItemBodyText secondary" style="margin-bottom: 0.75em; font-size: 0.9em;">Add custom menu links that will appear in the custom menu. Use Material icon names for icons.</div>
                        <textarea id="customMenuLinksJson" class="fld emby-textarea" rows="12" placeholder='[{"name":"Link Name","icon":"link","url":"#/..."}]' style="width: 100%; font-family: monospace; font-size: 0.9em; line-height: 1.5;">${JSON.stringify(config, null, 2)}</textarea>
                        <details style="margin-top: 0.75em;">
                            <summary class="listItemBodyText secondary" style="font-size: 0.9em; color: #4a9eff; cursor: pointer;">View Example Format</summary>
                            <pre style="background: rgba(0,0,0,0.3); padding: 1em; border-radius: 4px; margin-top: 0.5em; overflow-x: auto; font-size: 0.85em; line-height: 1.6;">[
  {
    "name": "My Custom Link",
    "icon": "link",
    "url": "#/userpluginsettings.html?pageUrl=https://domain.com/custom-page",
    "openInNewTab": false
  },
  {
    "name": "External Link",
    "icon": "open_in_new",
    "url": "https://example.com",
    "openInNewTab": true
  }
]</pre>
                        </details>
                    </div>
                </div>
            </div>
        `;
    }

    /**
     * Collect configuration from form
     */
    function collectConfig() {
        try {
            const jsonText = document.getElementById('customMenuLinksJson')?.value || '[]';
            return JSON.parse(jsonText);
        } catch (e) {
            ERR('Error parsing custom menu links JSON:', e);
            alert('Invalid JSON format. Please check your input.');
            return [];
        }
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
                <button class="emby-button raised block button-submit" id="save-custommenulinks-config-btn">Save</button>
            `;

            // Create modal
            const modalInstance = window.ModalSystem.create({
                id: MODAL_ID,
                title: 'Custom Menu Links Configuration',
                content: content,
                footer: footer,
                closeOnBackdrop: true,
                closeOnEscape: true,
                showCloseButton: true,
                onOpen: (modal) => {
                    // Save button
                    const saveBtn = modal.dialogFooter.querySelector('#save-custommenulinks-config-btn');
                    if (saveBtn) {
                        saveBtn.addEventListener('click', async () => {
                            const customMenuLinks = collectConfig();
                            const success = await saveConfig(customMenuLinks);
                            if (success) {
                                if (window.KefinTweaksToaster && window.KefinTweaksToaster.toast) {
                                    window.KefinTweaksToaster.toast('Custom Menu Links configuration saved!');
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

            LOG('Custom Menu Links configuration modal opened');
        } catch (error) {
            ERR('Error opening custom menu links config modal:', error);
            alert('Error opening configuration: ' + error.message);
        }
    }

    // Export
    window.KefinTweaksFeatureConfigs = window.KefinTweaksFeatureConfigs || {};
    window.KefinTweaksFeatureConfigs.customMenuLinks = { openConfigModal };

    console.log('[KefinTweaks CustomMenuLinks Config] Script loaded');

})();

