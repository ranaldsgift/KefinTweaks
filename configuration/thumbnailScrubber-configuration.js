// KefinTweaks Thumbnail Scrubber Configuration UI
// Modular configuration modal for managing thumbnail scrubber settings

(function() {
    'use strict';

    const LOG = (...args) => console.log('[KefinTweaks ThumbnailScrubber Config]', ...args);
    const ERR = (...args) => console.error('[KefinTweaks ThumbnailScrubber Config]', ...args);

    const MODAL_ID = 'kefin-thumbnailscrubber-config';

    /**
     * Load configuration from window.KefinTweaksConfig
     */
    async function loadConfig() {
        const config = window.KefinTweaksConfig || {};
        return config.thumbnailScrubber || {};
    }

    /**
     * Save configuration to JS Injector
     */
    async function saveConfig(thumbnailScrubberConfig) {
        try {
            // Ensure window.KefinTweaksConfig exists
            if (!window.KefinTweaksConfig) {
                window.KefinTweaksConfig = {};
            }

            // Update thumbnailScrubber config
            window.KefinTweaksConfig.thumbnailScrubber = thumbnailScrubberConfig;

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
        const previewOnHover = config.PreviewOnHover === true;
        const hoverDelay = Number.isFinite(config.HOVER_PREVIEW_TIMEOUT_MS * 1)
            ? config.HOVER_PREVIEW_TIMEOUT_MS * 1
            : (Number.isFinite(config.HOVER_TIMEOUT * 1) ? config.HOVER_TIMEOUT * 1 : 800);
        const hoverSpeed = Number.isFinite(config.HOVER_PREVIEW_FRAME_MS * 1)
            ? config.HOVER_PREVIEW_FRAME_MS * 1
            : 250;
        const scrubDelay = Number.isFinite(config.SCRUB_ACTIVATION_DELAY_MS * 1)
            ? config.SCRUB_ACTIVATION_DELAY_MS * 1
            : 300;

        return `
            <div style="max-width: 800px;">
                <div class="listItem" style="border: 1px solid rgba(255,255,255,0.1); border-radius: 4px; padding: 0.75em; margin-bottom: 1em;">
                    <div class="listItemContent">
                        <div class="listItemBodyText" style="margin-bottom: 0.5em;">Preview On Hover</div>
                        <div class="listItemBodyText secondary" style="margin-bottom: 0.75em; font-size: 0.9em;">
                            When enabled, hovering over an eligible card will automatically cycle trickplay thumbnails
                            as the card background after a short delay, without needing to scrub in the progress zone.
                        </div>
                        <label class="checkboxContainer" style="display: flex; align-items: center; gap: 0.5em;">
                            <input type="checkbox" id="thumbnailScrubber_PreviewOnHover" ${previewOnHover ? 'checked' : ''}>
                            <span class="listItemBodyText">Enabled</span>
                        </label>
                    </div>
                </div>

                <div class="listItem" style="border: 1px solid rgba(255,255,255,0.1); border-radius: 4px; padding: 0.75em; margin-bottom: 1em;">
                    <div class="listItemContent">
                        <div class="listItemBodyText" style="margin-bottom: 0.5em;">Delay Before Previewing On Hover (ms)</div>
                        <div class="listItemBodyText secondary" style="margin-bottom: 0.75em; font-size: 0.9em;">
                            How long the cursor must stay over a card before the passive preview starts.
                            Set to 0 to start immediately when hovering a card.
                        </div>
                        <input type="number"
                               id="thumbnailScrubber_HOVER_PREVIEW_TIMEOUT_MS"
                               class="fld emby-input"
                               min="0"
                               step="50"
                               value="${hoverDelay}"
                               style="width: 120px;">
                    </div>
                </div>

                <div class="listItem" style="border: 1px solid rgba(255,255,255,0.1); border-radius: 4px; padding: 0.75em; margin-bottom: 1em;">
                    <div class="listItemContent">
                        <div class="listItemBodyText" style="margin-bottom: 0.5em;">Hover Preview Speed (ms between frames)</div>
                        <div class="listItemBodyText secondary" style="margin-bottom: 0.75em; font-size: 0.9em;">
                            Interval in milliseconds between each trickplay frame during hover preview.
                            Leave at 0 to use the default trickplay interval from the server.
                        </div>
                        <input type="number"
                               id="thumbnailScrubber_HOVER_PREVIEW_FRAME_MS"
                               class="fld emby-input"
                               min="0"
                               step="50"
                               value="${hoverSpeed}"
                               style="width: 120px;">
                    </div>
                </div>

                <div class="listItem" style="border: 1px solid rgba(255,255,255,0.1); border-radius: 4px; padding: 0.75em; margin-bottom: 1em;">
                    <div class="listItemContent">
                        <div class="listItemBodyText" style="margin-bottom: 0.5em;">Delay Before Activating Scrubbing (ms)</div>
                        <div class="listItemBodyText secondary" style="margin-bottom: 0.75em; font-size: 0.9em;">
                            How long the cursor must stay in the scrub zone at the bottom of the card before
                            the scrubber UI activates.
                        </div>
                        <input type="number"
                               id="thumbnailScrubber_SCRUB_ACTIVATION_DELAY_MS"
                               class="fld emby-input"
                               min="0"
                               step="50"
                               value="${scrubDelay}"
                               style="width: 120px;">
                    </div>
                </div>
            </div>
        `;
    }

    /**
     * Collect configuration from form
     */
    function collectConfig() {
        const previewOnHover = document.getElementById('thumbnailScrubber_PreviewOnHover')?.checked === true;
        const hoverDelayInput = document.getElementById('thumbnailScrubber_HOVER_PREVIEW_TIMEOUT_MS');
        const scrubDelayInput = document.getElementById('thumbnailScrubber_SCRUB_ACTIVATION_DELAY_MS');
        const hoverSpeedInput = document.getElementById('thumbnailScrubber_HOVER_PREVIEW_FRAME_MS');

        let hoverDelay = hoverDelayInput ? parseInt(hoverDelayInput.value, 10) : 800;
        if (!Number.isFinite(hoverDelay) || hoverDelay < 0) {
            hoverDelay = 800;
        }

        let scrubDelay = scrubDelayInput ? parseInt(scrubDelayInput.value, 10) : 300;
        if (!Number.isFinite(scrubDelay) || scrubDelay < 0) {
            scrubDelay = 300;
        }

        let hoverSpeed = hoverSpeedInput ? parseInt(hoverSpeedInput.value, 10) : 0;
        if (!Number.isFinite(hoverSpeed) || hoverSpeed < 0) {
            hoverSpeed = 0;
        }

        return {
            PreviewOnHover: previewOnHover,
            // Delay before previewing on hover
            HOVER_PREVIEW_TIMEOUT_MS: hoverDelay,
            HOVER_TIMEOUT: hoverDelay, // legacy key
            // Hover preview speed (ms between frames)
            HOVER_PREVIEW_FRAME_MS: hoverSpeed,
            // Scrub activation delay
            SCRUB_ACTIVATION_DELAY_MS: scrubDelay
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
                <button class="emby-button raised block button-submit" id="save-thumbnailscrubber-config-btn">Save</button>
            `;

            // Create modal
            const modalInstance = window.ModalSystem.create({
                id: MODAL_ID,
                title: 'Thumbnail Scrubber Configuration',
                content: content,
                footer: footer,
                closeOnBackdrop: true,
                closeOnEscape: true,
                showCloseButton: true,
                onOpen: (modal) => {
                    // Save button
                    const saveBtn = modal.dialogFooter.querySelector('#save-thumbnailscrubber-config-btn');
                    if (saveBtn) {
                        saveBtn.addEventListener('click', async () => {
                            const thumbnailScrubberConfig = collectConfig();
                            const success = await saveConfig(thumbnailScrubberConfig);
                            if (success) {
                                if (window.KefinTweaksToaster && window.KefinTweaksToaster.toast) {
                                    window.KefinTweaksToaster.toast('Thumbnail Scrubber configuration saved!');
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
            modalInstance.dialog.style.width = '800px';
            modalInstance.dialog.style.height = 'auto';

            LOG('Thumbnail Scrubber configuration modal opened');
        } catch (error) {
            ERR('Error opening thumbnail scrubber config modal:', error);
            alert('Error opening configuration: ' + error.message);
        }
    }

    // Export
    window.KefinTweaksFeatureConfigs = window.KefinTweaksFeatureConfigs || {};
    window.KefinTweaksFeatureConfigs.thumbnailScrubber = { openConfigModal };

    console.log('[KefinTweaks ThumbnailScrubber Config] Script loaded');

})();

