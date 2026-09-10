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
        return {
            customMenuLinks: Array.isArray(config.customMenuLinks) ? config.customMenuLinks : []
        };
    }

    /**
     * Save configuration to JS Injector
     */
    async function saveConfig(customMenuLinks) {
        try {
            if (!window.KefinTweaksConfig) {
                window.KefinTweaksConfig = {};
            }

            window.KefinTweaksConfig.customMenuLinks = customMenuLinks;
            // Placement is per-link; do not keep the legacy global top-nav flag
            delete window.KefinTweaksConfig.showCustomMenuLinksInTopNav;

            if (window.KefinTweaksUtils && window.KefinTweaksUtils.saveConfigToJavaScriptInjector) {
                await window.KefinTweaksUtils.saveConfigToJavaScriptInjector();
                LOG('Configuration saved to JS Injector');
                return true;
            } else if (window.KefinTweaksConfiguration && window.KefinTweaksConfiguration.findJavaScriptInjectorPlugin) {
                const pluginId = await window.KefinTweaksConfiguration.findJavaScriptInjectorPlugin();
                if (pluginId) {
                    await window.KefinTweaksConfiguration.saveConfigToJavaScriptInjector(window.KefinTweaksConfig);
                    LOG('Configuration saved to JS Injector (fallback)');
                    return true;
                }
                ERR('saveConfigToJavaScriptInjector not available');
                return false;
            } else {
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
                        <div class="listItemBodyText secondary" style="margin-bottom: 0.75em; font-size: 0.9em;">Add custom menu links with per-link placements. Require <code>name</code> and either <code>url</code> or <code>action</code> (a dotted path on <code>window</code>, e.g. <code>MyPlugin.openDialog</code>). Defaults: <code>sideMenu</code> true, <code>topNavigation</code> "none", <code>userMenu</code> false. Use <code>collapsed</code> with <code>topNavigation: "main"</code> on v12 to place under More. Optional <code>order</code> overrides top-nav position: for <code>main</code>, left-to-right child index (<code>0</code> = first); for <code>right</code>, right-to-left (<code>0</code> = last child).</div>
                        <div class="listItemBodyText secondary" style="margin-bottom: 0.75em; font-size: 0.9em;">These links are not added by modifying your config.json, so if you wish for these to appear on supported third party clients which don't use jellyfin-web, you will want to manually edit your config.json rather than adding the links here. You can find the information about doing that <a href="https://jellyfin.org/docs/general/clients/web-config/#custom-menu-links">here</a>.</div>
                        <textarea id="customMenuLinksJson" class="fld emby-textarea" rows="12" placeholder='[{"name":"Link Name","icon":"link","url":"#/..."}]' style="width: 100%; font-family: monospace; font-size: 0.9em; line-height: 1.5;">${JSON.stringify(config.customMenuLinks, null, 2)}</textarea>
                        <details style="margin-top: 0.75em;">
                            <summary class="listItemBodyText secondary" style="font-size: 0.9em; color: #4a9eff; cursor: pointer;">View Example Format</summary>
                            <pre style="background: rgba(0,0,0,0.3); padding: 1em; border-radius: 4px; margin-top: 0.5em; overflow-x: auto; font-size: 0.85em; line-height: 1.6;">[
  {
    "name": "My Custom Link",
    "icon": "link",
    "url": "#/userpluginsettings.html?pageUrl=https://domain.com/custom-page",
    "openInNewTab": false,
    "sideMenu": true,
    "topNavigation": "none",
    "userMenu": false,
    "collapsed": false
  },
  {
    "name": "Top Nav First",
    "icon": "star",
    "url": "#/home",
    "sideMenu": false,
    "topNavigation": "main",
    "order": 0
  },
  {
    "name": "Top Nav Link",
    "icon": "star",
    "url": "#/home",
    "sideMenu": false,
    "topNavigation": "main",
    "collapsed": true
  },
  {
    "name": "Header Right Near End",
    "icon": "extension",
    "action": "MyPlugin.openDialog",
    "sideMenu": false,
    "topNavigation": "right",
    "order": 1
  },
  {
    "name": "External Link",
    "icon": "open_in_new",
    "url": "https://example.com",
    "openInNewTab": true,
    "sideMenu": true,
    "topNavigation": "none"
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
            const customMenuLinks = JSON.parse(jsonText);
            return { customMenuLinks };
        } catch (e) {
            ERR('Error parsing custom menu links JSON:', e);
            alert('Invalid JSON format. Please check your input.');
            return null;
        }
    }

    /**
     * Open configuration modal
     */
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
                <button class="emby-button raised block button-submit" id="save-custommenulinks-config-btn">Save</button>
            `;

            const modalInstance = window.ModalSystem.create({
                id: MODAL_ID,
                title: 'Custom Menu Links Configuration',
                content: content,
                footer: footer,
                closeOnBackdrop: true,
                closeOnEscape: true,
                showCloseButton: true,
                onOpen: (modal) => {
                    const saveBtn = modal.dialogFooter.querySelector('#save-custommenulinks-config-btn');
                    if (saveBtn) {
                        saveBtn.addEventListener('click', async () => {
                            const collected = collectConfig();
                            if (!collected) return;
                            const success = await saveConfig(collected.customMenuLinks);
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

            if (window.innerWidth >= 900) {
                modalInstance.dialog.style.maxWidth = '90vw';
                modalInstance.dialog.style.width = '1400px';
                modalInstance.dialog.style.height = '90vh';
            }

            LOG('Custom Menu Links configuration modal opened');
        } catch (error) {
            ERR('Error opening custom menu links config modal:', error);
            alert('Error opening configuration: ' + error.message);
        }
    }

    window.KefinTweaksFeatureConfigs = window.KefinTweaksFeatureConfigs || {};
    window.KefinTweaksFeatureConfigs.customMenuLinks = { openConfigModal };

    console.log('[KefinTweaks CustomMenuLinks Config] Script loaded');

})();
