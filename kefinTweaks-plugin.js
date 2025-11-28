// KefinTweaks Installer
// Entry point script for KefinTweaks installation and configuration
// Users paste this script into JS Injector instead of injector.js

(function() {
    'use strict';

    console.log('[KefinTweaks Installer] Initializing...');

    const MODAL_ID = 'kefinTweaksSourceModal';
    let versionsCache = null;

    // jsDelivr URL patterns
    const JSDELIVR_BASE = 'https://cdn.jsdelivr.net/gh/ranaldsgift/KefinTweaks';
    const GITHUB_REPO = 'ranaldsgift/KefinTweaks';
    const GITHUB_API_RELEASES = `https://api.github.com/repos/${GITHUB_REPO}/releases`;

    // Check if user is admin
    async function isAdmin() {
        try {
            if (window.ApiClient && window.ApiClient.getCurrentUser) {
                const user = await window.ApiClient.getCurrentUser();
                return user && user.Policy && user.Policy.IsAdministrator === true;
            }
        } catch (error) {
            console.warn('[KefinTweaks Installer] Could not check admin status:', error);
        }
        return false;
    }

    // Find JavaScript Injector plugin
    async function findJavaScriptInjectorPlugin() {
        try {
            if (!window.ApiClient || !window.ApiClient._serverAddress || !window.ApiClient.accessToken) {
                return null;
            }

            const server = ApiClient._serverAddress;
            const token = ApiClient.accessToken();

            const response = await fetch(`${server}/Plugins`, {
                headers: {
                    'X-Emby-Token': token
                }
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const plugins = await response.json();
            const pluginsList = Array.isArray(plugins) ? plugins : (plugins.Items || []);
            
            const injectorPlugin = pluginsList.find(plugin => 
                plugin.Name === 'JavaScript Injector' || plugin.Name === 'JS Injector'
            );

            if (!injectorPlugin) {
                throw new Error('JavaScript Injector plugin not found');
            }

            return injectorPlugin.Id;
        } catch (error) {
            console.error('[KefinTweaks Installer] Error finding JavaScript Injector plugin:', error);
            throw error;
        }
    }

    // Get current JavaScript Injector configuration
    async function getJavaScriptInjectorConfig(pluginId) {
        try {
            if (!window.ApiClient || !window.ApiClient._serverAddress || !window.ApiClient.accessToken) {
                return null;
            }

            const server = ApiClient._serverAddress;
            const token = ApiClient.accessToken();

            const response = await fetch(`${server}/Plugins/${pluginId}/Configuration`, {
                headers: {
                    'X-Emby-Token': token
                }
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            return await response.json();
        } catch (error) {
            console.error('[KefinTweaks Installer] Error getting JS Injector config:', error);
            throw error;
        }
    }

    // Get KefinTweaks config from JS Injector
    async function getKefinTweaksConfig() {
        try {            
            if (window.KefinTweaksConfig) {
                return window.KefinTweaksConfig;
            }

            const pluginId = await findJavaScriptInjectorPlugin();

            if (!pluginId) {
                return null;
            }

            const injectorConfig = await getJavaScriptInjectorConfig(pluginId);

            if (!injectorConfig) {
                return null;
            }
            
            const kefinTweaksScript = injectorConfig.CustomJavaScripts?.find(
                script => script.Name === 'KefinTweaks-Config'
            );
            
            if (kefinTweaksScript && kefinTweaksScript.Script) {
                const scriptMatch = kefinTweaksScript.Script.match(/window\.KefinTweaksConfig\s*=\s*({[\s\S]*});/);
                if (scriptMatch && scriptMatch[1]) {
                    try {
                        return JSON.parse(scriptMatch[1]);
                    } catch (parseError) {
                        console.error('[KefinTweaks Installer] Error parsing config:', parseError);
                    }
                }
            }
        } catch (error) {
            console.warn('[KefinTweaks Installer] Error getting config:', error);
        }
        return null;
    }

    // Load default config from URL
    async function loadDefaultConfig(rootUrl) {
        return new Promise((resolve, reject) => {
            try {
                const defaultConfigUrl = `${rootUrl}kefinTweaks-default-config.js`;
                
                if (window.KefinTweaksDefaultConfig) {
                    resolve(window.KefinTweaksDefaultConfig);
                    return;
                }
                
                const script = document.createElement('script');
                script.src = defaultConfigUrl;
                script.async = true;
                
                script.onload = () => {
                    if (window.KefinTweaksDefaultConfig) {
                        resolve(window.KefinTweaksDefaultConfig);
                    } else {
                        reject(new Error('Default config file loaded but window.KefinTweaksDefaultConfig is not defined'));
                    }
                };
                
                script.onerror = () => {
                    reject(new Error(`Failed to load default config file: ${defaultConfigUrl}`));
                };
                
                document.head.appendChild(script);
            } catch (error) {
                reject(error);
            }
        });
    }

    // Save configuration to JavaScript Injector
    async function saveConfigToJavaScriptInjector(config) {
        try {
            const pluginId = await findJavaScriptInjectorPlugin();
            const injectorConfig = await getJavaScriptInjectorConfig(pluginId);
                
            if (!injectorConfig.CustomJavaScripts) {
                injectorConfig.CustomJavaScripts = [];
            }

            const scriptContent = `// KefinTweaks Configuration
// This file is automatically generated by KefinTweaks Installer
// Do not edit manually unless you know what you're doing

window.KefinTweaksConfig = ${JSON.stringify(config, null, 2)};`;

            const existingScriptIndex = injectorConfig.CustomJavaScripts.findIndex(
                script => script.Name === 'KefinTweaks-Config'
            );

            if (existingScriptIndex !== -1) {
                injectorConfig.CustomJavaScripts[existingScriptIndex].Script = scriptContent;
            } else {
                injectorConfig.CustomJavaScripts.push({
                    Name: 'KefinTweaks-Config',
                    Script: scriptContent,
                    Enabled: true,
                    RequiresAuthentication: false
                });
            }

            const server = ApiClient._serverAddress;
            const token = ApiClient.accessToken();

            const response = await fetch(`${server}/Plugins/${pluginId}/Configuration`, {
                method: 'POST',
                headers: {
                    'X-Emby-Token': token,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(injectorConfig)
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            return true;
        } catch (error) {
            console.error('[KefinTweaks Installer] Error saving config:', error);
            throw error;
        }
    }

    const LATEST_RELEASE_NAME = 'Latest';
    const DEVELOPMENT_NAME = 'Development';
    const SELF_HOSTED_NAME = 'Self Hosted';

    // Parse source URL to determine source type and version
    function parseKefinTweaksSource(url) {
        if (!url || url === '') {
            return { sourceType: 'github', version: LATEST_RELEASE_NAME };
        }

        const match = url.match(/cdn\.jsdelivr\.net\/gh\/ranaldsgift\/KefinTweaks@([^\/]+)\//);
        
        if (!match) {
            return { sourceType: 'custom', version: null };
        }
        
        const version = match[1];
        if (version === 'latest') {
            return { sourceType: 'github', version: LATEST_RELEASE_NAME };
        } else if (version === 'main' || version === 'master') {
            return { sourceType: 'github', version: DEVELOPMENT_NAME };
        } else {
            return { sourceType: 'github', version: version.replace(/^v/, '') };
        }
    }

    // Fetch available versions from GitHub
    async function fetchVersions() {
        if (versionsCache) {
            return versionsCache;
        }

        try {
            const response = await fetch(GITHUB_API_RELEASES);
            if (!response.ok) {
                throw new Error('Failed to fetch releases');
            }

            const releases = await response.json();
            const versions = releases
                .map(release => release.tag_name.replace(/^v/, ''))
                .filter(tag => tag.match(/^\d+\.\d+\.\d+/)); // Only semantic versions

            versionsCache = [LATEST_RELEASE_NAME, DEVELOPMENT_NAME, ...versions];
            return versionsCache;
        } catch (error) {
            console.warn('[KefinTweaks Installer] Error fetching versions:', error);
            return [LATEST_RELEASE_NAME, DEVELOPMENT_NAME];
        }
    }

    // Build kefinTweaksRoot URL from selections
    function buildKefinTweaksRootUrl(sourceType, source) {
        if (sourceType === 'custom') {
            // Ensure URL ends with /
            return source.endsWith('/') ? source : source + '/';
        }

        // GitHub source
        let versionTag = 'latest';
        if (source === DEVELOPMENT_NAME) {
            versionTag = 'main';
        } else if (source !== LATEST_RELEASE_NAME) {
            versionTag = source.startsWith('v') ? source : 'v' + source;
        }

        return `${JSDELIVR_BASE}@${versionTag}/`;
    }

    // Simple modal creation (doesn't depend on modal.js)
    function createSimpleModal(id, title, content, footer) {
        // Remove existing modal
        const existing = document.getElementById(id);
        if (existing) {
            existing.remove();
        }

        const backdrop = document.createElement('div');
        backdrop.className = 'dialogBackdrop dialogBackdropOpened';
        backdrop.id = id + '-backdrop';

        const dialogContainer = document.createElement('div');
        dialogContainer.className = 'dialogContainer';
        dialogContainer.id = id;

        const dialog = document.createElement('div');
        dialog.className = 'focuscontainer dialog smoothScrollY ui-body-a background-theme-a formDialog centeredDialog opened';
        dialog.style.display = 'flex';
        dialog.style.flexDirection = 'column';
        dialog.style.maxHeight = '90vh';
        dialog.style.maxWidth = '600px';
        dialog.style.width = '90vw';

        if (title) {
            const header = document.createElement('div');
            header.className = 'formDialogHeader';
            header.style.display = 'flex';
            header.style.justifyContent = 'space-between';
            header.style.alignItems = 'center';
            header.style.padding = '1.25em 1.5em';
            header.style.borderBottom = '1px solid rgba(255,255,255,0.1)';

            const titleEl = document.createElement('h2');
            titleEl.style.margin = '0';
            titleEl.textContent = title;
            header.appendChild(titleEl);

            const closeBtn = document.createElement('button');
            closeBtn.setAttribute('is', 'paper-icon-button-light');
            closeBtn.className = 'btnCancel btnClose autoSize paper-icon-button-light';
            closeBtn.onclick = () => closeSimpleModal(id);
            const closeIcon = document.createElement('span');
            closeIcon.className = 'material-icons close';
            closeBtn.appendChild(closeIcon);
            header.appendChild(closeBtn);

            dialog.appendChild(header);
        }

        const contentDiv = document.createElement('div');
        contentDiv.style.padding = '1.25em 1.5em 8em';
        contentDiv.style.overflowY = 'auto';
        contentDiv.style.flex = '1';
        if (typeof content === 'string') {
            contentDiv.innerHTML = content;
        } else {
            contentDiv.appendChild(content);
        }
        dialog.appendChild(contentDiv);

        if (footer) {
            const footerDiv = document.createElement('div');
            footerDiv.className = 'formDialogFooter';
            footerDiv.style.padding = '1.25em 1.5em';
            footerDiv.style.borderTop = '1px solid rgba(255,255,255,0.1)';
            if (typeof footer === 'string') {
                footerDiv.innerHTML = footer;
            } else {
                footerDiv.appendChild(footer);
            }
            dialog.appendChild(footerDiv);
        }

        dialogContainer.appendChild(dialog);
        document.body.appendChild(backdrop);
        document.body.appendChild(dialogContainer);

        backdrop.onclick = (e) => {
            if (e.target === backdrop) {
                closeSimpleModal(id);
            }
        };

        // Close modal when clicking outside (on dialogContainer)
        dialogContainer.onclick = (e) => {
            if (e.target === dialogContainer) {
                closeSimpleModal(id);
            }
        };

        return { id, close: () => closeSimpleModal(id) };
    }

    function closeSimpleModal(id) {
        const backdrop = document.getElementById(id + '-backdrop');
        const dialog = document.getElementById(id);
        if (backdrop) backdrop.remove();
        if (dialog) dialog.remove();
    }

    /**
     * Show a confirmation modal
     * @param {string} message - Confirmation message
     * @param {Function} onConfirm - Callback when user confirms
     * @param {Function} onCancel - Optional callback when user cancels
     */
    function showConfirmationModal(message, onConfirm, onCancel = null) {
        const CONFIRM_MODAL_ID = 'kefinTweaksConfirmModal';
        
        const content = document.createElement('div');
        content.style.display = 'flex';
        content.style.flexDirection = 'column';
        content.style.gap = '1em';
        content.style.lineHeight = '1.6';
        content.innerHTML = `<p>${message}</p>`;

        const footer = document.createElement('div');
        footer.style.display = 'flex';
        footer.style.justifyContent = 'flex-end';
        footer.style.gap = '1em';

        const cancelBtn = document.createElement('button');
        cancelBtn.className = 'btnCancel raised emby-button button-cancel';
        cancelBtn.textContent = 'Cancel';
        cancelBtn.onclick = () => {
            closeSimpleModal(CONFIRM_MODAL_ID);
            if (onCancel) onCancel();
        };

        const confirmBtn = document.createElement('button');
        confirmBtn.className = 'btnSubmit raised emby-button button-submit';
        confirmBtn.textContent = 'Confirm';
        confirmBtn.onclick = () => {
            closeSimpleModal(CONFIRM_MODAL_ID);
            if (onConfirm) onConfirm();
        };

        footer.appendChild(cancelBtn);
        footer.appendChild(confirmBtn);

        createSimpleModal(CONFIRM_MODAL_ID, 'Confirm', content, footer);
    }

    /**
     * Show an alert/info modal
     * @param {string} title - Modal title
     * @param {string} message - Message content (can include HTML)
     */
    function showAlertModal(title, message) {
        const ALERT_MODAL_ID = 'kefinTweaksAlertModal';
        
        const content = document.createElement('div');
        content.style.display = 'flex';
        content.style.flexDirection = 'column';
        content.style.gap = '1em';
        content.style.lineHeight = '1.6';
        content.innerHTML = message;

        const footer = document.createElement('div');
        footer.style.display = 'flex';
        footer.style.justifyContent = 'flex-end';
        footer.style.gap = '1em';

        const okBtn = document.createElement('button');
        okBtn.className = 'btnSubmit raised emby-button button-submit';
        okBtn.textContent = 'OK';
        okBtn.onclick = () => {
            closeSimpleModal(ALERT_MODAL_ID);
        };

        footer.appendChild(okBtn);

        createSimpleModal(ALERT_MODAL_ID, title, content, footer);
    }

    /**
     * Show success modal after saving configuration
     * @param {boolean} isInitialInstall - Whether this is the initial installation
     * @param {string} version - Version number or source type
     */
    async function showSuccessModal(isInitialInstall, version) {
        const SUCCESS_MODAL_ID = 'kefinTweaksSuccessModal';
        
        const content = document.createElement('div');
        content.style.display = 'flex';
        content.style.flexDirection = 'column';
        content.style.lineHeight = '1.6';

        if (isInitialInstall) {
            // Initial installation message with support information
            content.innerHTML = `
                <p>Thanks so much for installing KefinTweaks!</p>
                <p>KefinTweaks is not maintained by the Jellyfin team, and as a result you are encouraged to seek support from me directly.</p>
                <p>Sadly, there is <i>currently</i> no place suitable for discussion of plugins built by community members or fan-made projects in the official Jellyfin Discord, so please visit the <a href="https://discord.gg/v7P9CAvCKZ" target="_blank" style="color: #00a4dc; text-decoration: underline;">Jellyfin Community Discord</a> to find me (username: HighImKevin) and other users who would be happy to help you out.</p>
                <p>Please also feel free to report bugs and request features from the <a href="https://github.com/ranaldsgift/KefinTweaks/issues" target="_blank" style="color: #00a4dc; text-decoration: underline;">Issues</a> page. The strength of this plugin relies on awesome community members like you, so thanks for using KefinTweaks!</p>
            `;
        } else {
            // Update message with refresh instruction
            content.innerHTML = `
                <p>KefinTweaks configuration has been successfully updated. Please refresh your page for the changes to take effect!</p>
            `;
        }

        // Add discord icon link to the bottom of the content use a background img on an element
        const kefinRoot = window.KefinTweaksConfig?.kefinTweaksRoot;

        if (kefinRoot) {
            // Wrapped in a link to the discord server
            const discordLinkWrapper = document.createElement('div');
            discordLinkWrapper.style.display = 'flex';
            discordLinkWrapper.style.justifyContent = 'center';

            const discordLink = document.createElement('a');
            discordLink.href = 'https://discord.gg/v7P9CAvCKZ';
            discordLink.target = '_blank';
            discordLink.style.display = 'inline-block';
            discordLink.style.width = '50px';


            const discordIcon = document.createElement('div');
            discordIcon.style.backgroundImage = `url(${kefinRoot}/pages/images/discord.png)`;
            discordIcon.style.backgroundSize = 'contain';
            discordIcon.style.backgroundPosition = 'center';
            discordIcon.style.backgroundRepeat = 'no-repeat';
            discordIcon.style.height = '35px';
            discordLink.appendChild(discordIcon);
            discordLinkWrapper.appendChild(discordLink);
            content.appendChild(discordLinkWrapper);
        }

        const footer = document.createElement('div');
        footer.style.display = 'flex';
        footer.style.justifyContent = 'flex-end';
        footer.style.gap = '1em';

        const okBtn = document.createElement('button');
        okBtn.className = 'btnSubmit raised emby-button button-submit';
        okBtn.textContent = 'OK';
        okBtn.onclick = () => {
            closeSimpleModal(SUCCESS_MODAL_ID);
            if (!isInitialInstall) {
                // Optionally auto-refresh on update (or let user do it manually)
                // window.location.reload();
            }
        };

        footer.appendChild(okBtn);

        createSimpleModal(SUCCESS_MODAL_ID, `${isInitialInstall ? 'Plugin Installed' : 'Plugin Updated'}`, content, footer);
    }

    // Open source configuration modal
    async function openKefinTweaksSourceModal() {
        const userIsAdmin = await isAdmin();
        if (!userIsAdmin) {
            showAlertModal('Access Denied', '<p>You must be an administrator to configure KefinTweaks.</p>');
            return;
        }

        const currentConfig = await getKefinTweaksConfig();
        const currentRoot = currentConfig?.kefinTweaksRoot || '';
        const sourceInfo = parseKefinTweaksSource(currentRoot);
        const versions = await fetchVersions();

        const content = document.createElement('div');
        content.style.display = 'flex';
        content.style.flexDirection = 'column';
        content.style.gap = '1.5em';

        // Enabled checkbox
        const isEnabled = currentConfig?.enabled !== false;
        const enabledContainer = document.createElement('div');
        enabledContainer.style.display = 'flex';
        enabledContainer.style.alignItems = 'center';
        enabledContainer.style.gap = '0.75em';
        
        const enabledCheckbox = document.createElement('input');
        enabledCheckbox.type = 'checkbox';
        enabledCheckbox.id = 'kefinTweaksEnabledModal';
        enabledCheckbox.className = 'checkbox';
        enabledCheckbox.checked = isEnabled;
        
        const enabledLabel = document.createElement('label');
        enabledLabel.setAttribute('for', 'kefinTweaksEnabledModal');
        enabledLabel.style.cursor = 'pointer';
        enabledLabel.style.margin = '0';
        enabledLabel.style.display = 'flex';
        enabledLabel.style.alignItems = 'center';
        enabledLabel.style.gap = '0.75em';
        
        const enabledText = document.createElement('span');
        enabledText.textContent = isEnabled ? 'Enabled' : 'Disabled';
        enabledText.id = 'kefinTweaksEnabledModalLabel';
        
        enabledLabel.appendChild(enabledCheckbox);
        enabledLabel.appendChild(enabledText);
        enabledContainer.appendChild(enabledLabel);
        
        // Update label text when checkbox changes
        enabledCheckbox.addEventListener('change', () => {
            enabledText.textContent = enabledCheckbox.checked ? 'Enabled' : 'Disabled';
        });
        
        content.appendChild(enabledContainer);

        // Source Type dropdown
        const sourceTypeLabel = document.createElement('label');
        sourceTypeLabel.textContent = 'Install From:';
        sourceTypeLabel.style.display = 'block';
        sourceTypeLabel.style.marginBottom = '0.5em';

        const sourceTypeSelect = document.createElement('select');
        sourceTypeSelect.className = 'fld emby-select emby-select-withcolor';
        sourceTypeSelect.id = 'kefinTweaksSourceType';
        sourceTypeSelect.innerHTML = `
            <option value="github" ${sourceInfo.sourceType === 'github' ? 'selected' : ''}>KefinTweaks GitHub</option>
            <option value="custom" ${sourceInfo.sourceType === 'custom' ? 'selected' : ''}>${SELF_HOSTED_NAME}</option>
        `;

        // Source dropdown (for GitHub)
        const sourceLabel = document.createElement('label');
        sourceLabel.textContent = 'Version:';
        sourceLabel.style.display = 'block';
        sourceLabel.style.marginBottom = '0.5em';

        const sourceSelect = document.createElement('select');
        sourceSelect.className = 'fld emby-select emby-select-withcolor';
        sourceSelect.id = 'kefinTweaksSource';
        sourceSelect.innerHTML = versions.map(v => 
            `<option value="${v}" ${v === sourceInfo.version ? 'selected' : ''}>${v}</option>`
        ).join('');

        // Custom URL input
        const customUrlInput = document.createElement('input');
        customUrlInput.type = 'text';
        customUrlInput.className = 'fld emby-input';
        customUrlInput.id = 'kefinTweaksCustomUrl';
        customUrlInput.placeholder = 'https://example.com/KefinTweaks/';
        customUrlInput.value = sourceInfo.sourceType === 'custom' ? currentRoot : '';
        customUrlInput.style.display = sourceInfo.sourceType === 'custom' ? 'block' : 'none';

        // Set initial visibility based on source type
        if (sourceInfo.sourceType === 'custom') {
            sourceSelect.style.display = 'none';
            sourceLabel.style.display = 'none';
            customUrlInput.style.display = 'block';
        } else {
            sourceSelect.style.display = 'block';
            sourceLabel.style.display = 'block';
            customUrlInput.style.display = 'none';
        }

        // Toggle visibility based on source type
        sourceTypeSelect.onchange = () => {
            if (sourceTypeSelect.value === 'custom') {
                sourceSelect.style.display = 'none';
                sourceLabel.style.display = 'none';
                customUrlInput.style.display = 'block';
            } else {
                sourceSelect.style.display = 'block';
                sourceLabel.style.display = 'block';
                customUrlInput.style.display = 'none';
            }
        };

        content.appendChild(sourceTypeLabel);
        content.appendChild(sourceTypeSelect);
        content.appendChild(sourceLabel);
        content.appendChild(sourceSelect);
        content.appendChild(customUrlInput);

        // Footer with buttons
        const footer = document.createElement('div');
        footer.style.display = 'flex';
        footer.style.justifyContent = 'flex-end';
        footer.style.gap = '1em';

        const cancelBtn = document.createElement('button');
        cancelBtn.className = 'btnCancel raised emby-button button-cancel';
        cancelBtn.textContent = 'Cancel';
        cancelBtn.onclick = () => closeSimpleModal(MODAL_ID);

        const saveBtn = document.createElement('button');
        saveBtn.className = 'btnSubmit raised emby-button button-submit';
        saveBtn.textContent = (!currentRoot || currentRoot.trim() === '') ? 'Install' : 'Save';
        saveBtn.onclick = async () => {
            try {
                const sourceType = sourceTypeSelect.value;
                const source = sourceType === 'custom' ? customUrlInput.value : sourceSelect.value;
                
                if (sourceType === 'custom' && (!source || source.trim() === '')) {
                    showAlertModal('Invalid URL', '<p>Please enter a valid URL for your self-hosted location.</p>');
                    return;
                }

                const kefinTweaksRoot = buildKefinTweaksRootUrl(sourceType, source);
                
                // Load default config from the selected root
                let defaultConfig;
                try {
                    defaultConfig = await loadDefaultConfig(kefinTweaksRoot);
                } catch (error) {
                    console.error('[KefinTweaks Installer] Error loading default config:', error);
                    // Create minimal config if loading fails
                    defaultConfig = {
                        kefinTweaksRoot: kefinTweaksRoot,
                        scripts: {},
                        homeScreen: {},
                        exclusiveElsewhere: {},
                        search: {},
                        skins: [],
                        defaultSkin: null,
                        themes: [],
                        customMenuLinks: []
                    };
                }

                // Get enabled state from checkbox
                const enabledState = enabledCheckbox.checked;
                
                // Merge with existing config to preserve user settings
                const mergedConfig = {
                    ...defaultConfig,
                    kefinTweaksRoot: kefinTweaksRoot,
                    ...(currentConfig || {}),
                    kefinTweaksRoot: kefinTweaksRoot, // Ensure root is updated
                    enabled: enabledState // Update enabled state
                };

                // Remove scriptRoot if it exists (legacy field)
                if (mergedConfig.scriptRoot) {
                    delete mergedConfig.scriptRoot;
                }

                await saveConfigToJavaScriptInjector(mergedConfig);
                
                // Update window.KefinTweaksConfig immediately so injector can use it
                window.KefinTweaksConfig = mergedConfig;
                window.KefinTweaksConfigEnabled = enabledState;
                
                closeSimpleModal(MODAL_ID);
                
                // Update the plugin card with new version/status
                await updateKefinTweaksPluginCard();
                
                // Determine if this is initial installation
                const isInitialInstall = !currentConfig || !currentConfig.kefinTweaksRoot || currentConfig.kefinTweaksRoot === '';
                
                // Get version for display
                const sourceInfo = parseKefinTweaksSource(kefinTweaksRoot);
                let versionDisplay = '';
                if (sourceInfo.sourceType === 'custom') {
                    versionDisplay = SELF_HOSTED_NAME;
                } else if (sourceInfo.version === DEVELOPMENT_NAME) {
                    versionDisplay = DEVELOPMENT_NAME;
                } else if (sourceInfo.version === LATEST_RELEASE_NAME) {
                    // Fetch the actual latest version number
                    try {
                        const response = await fetch('https://api.github.com/repos/ranaldsgift/KefinTweaks/releases/latest');
                        if (response.ok) {
                            const data = await response.json();
                            const versionNumber = data.tag_name.replace(/^v/, '');
                            versionDisplay = `${versionNumber} (${LATEST_RELEASE_NAME})`;
                        } else {
                            versionDisplay = LATEST_RELEASE_NAME;
                        }
                    } catch (error) {
                        console.warn('[KefinTweaks Installer] Error fetching latest version:', error);
                        versionDisplay = LATEST_RELEASE_NAME;
                    }
                } else {
                    versionDisplay = sourceInfo.version;
                }
                
                // Load injector.js from the configured root
                await loadInjectorFromRoot(kefinTweaksRoot);
                
                // Show success modal
                await showSuccessModal(isInitialInstall, versionDisplay);
            } catch (error) {
                console.error('[KefinTweaks Installer] Error saving configuration:', error);
                showAlertModal('Configuration Error', `<p>Error saving configuration: ${error.message}</p>`);
            }
        };
        
        const uninstallBtn = document.createElement('button');
        uninstallBtn.className = 'btnCancel raised emby-button button-cancel';
        uninstallBtn.textContent = 'Uninstall';
        uninstallBtn.style.marginRight = 'auto';
        // Hide uninstall button if KefinTweaks isn't installed yet (no root URL)
        if (!currentRoot || currentRoot.trim() === '') {
            uninstallBtn.style.display = 'none';
        }
        uninstallBtn.onclick = () => {
            closeSimpleModal(MODAL_ID);
            showConfirmationModal(
                'Are you sure you want to uninstall KefinTweaks?<br><br>This will disable the installer and backup your configuration.',
                async () => {
                    try {
                        await uninstallKefinTweaks();
                        // Remove the plugin card
                        removeKefinTweaksPluginCard();
                        showAlertModal(
                            'KefinTweaks Uninstalled',
                            '<p>KefinTweaks has been uninstalled. The installer has been disabled and your configuration has been backed up.<br><br>Please refresh your page.<br><br>You can re-enable KefinTweaks at any time from the JS Injector Plugin.'
                        );
                    } catch (error) {
                        console.error('[KefinTweaks Installer] Error uninstalling:', error);
                        showAlertModal(
                            'Uninstall Error',
                            `<p>Error uninstalling KefinTweaks: ${error.message}</p>`
                        );
                    }
                },
                () => {
                    // User cancelled, reopen the source modal
                    openKefinTweaksSourceModal();
                }
            );
        };

        footer.appendChild(saveBtn);
        footer.appendChild(cancelBtn);
        footer.appendChild(uninstallBtn);

        createSimpleModal(MODAL_ID, 'KefinTweaks Plugin Settings', content, footer);
    }

    /**
     * Uninstall KefinTweaks
     * 1. Renames KefinTweaks-Config to KefinTweaks-Config-Backup-Timestamp
     * 2. Disables the installer script (script containing kefinTweaks-plugin.js)
     */
    async function uninstallKefinTweaks() {
        try {
            const pluginId = await findJavaScriptInjectorPlugin();
            const injectorConfig = await getJavaScriptInjectorConfig(pluginId);
            
            if (!injectorConfig.CustomJavaScripts) {
                throw new Error('No custom scripts found in JS Injector configuration');
            }

            // Step 1: Rename KefinTweaks-Config to backup
            const configScriptIndex = injectorConfig.CustomJavaScripts.findIndex(
                script => script.Name === 'KefinTweaks-Config'
            );
            
            if (configScriptIndex !== -1) {
                const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
                injectorConfig.CustomJavaScripts[configScriptIndex].Name = `KefinTweaks-Config-Backup-${timestamp}`;
                injectorConfig.CustomJavaScripts[configScriptIndex].Enabled = false;
                console.log('[KefinTweaks Installer] Renamed KefinTweaks-Config to backup and disabled it');
            }

            // Step 2: Find and disable installer script
            // Look for script containing kefinTweaks-plugin.js (flexible pattern to match script.src*kefinTweaks-plugin.js)
            const installerScriptIndex = injectorConfig.CustomJavaScripts.findIndex(
                script => script.Script && /script\.src.*kefinTweaks-plugin\.js/i.test(script.Script)
            );
            
            if (installerScriptIndex !== -1) {
                injectorConfig.CustomJavaScripts[installerScriptIndex].Enabled = false;
                console.log('[KefinTweaks Installer] Disabled installer script');
            } else {
                console.warn('[KefinTweaks Installer] Installer script not found in CustomJavaScripts');
            }

            // Save the updated configuration
            const server = ApiClient._serverAddress;
            const token = ApiClient.accessToken();

            const response = await fetch(`${server}/Plugins/${pluginId}/Configuration`, {
                method: 'POST',
                headers: {
                    'X-Emby-Token': token,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(injectorConfig)
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            console.log('[KefinTweaks Installer] Uninstall completed successfully');
            return true;
        } catch (error) {
            console.error('[KefinTweaks Installer] Error uninstalling:', error);
            throw error;
        }
    }

    /**
     * Update the plugin card with new version and status information
     */
    async function updateKefinTweaksPluginCard() {
        const card = document.querySelector('[data-id="kefinTweaksPlugin"]');
        if (!card) {
            // Card doesn't exist yet, try to add it
            const pluginsPage = document.querySelector('#pluginsPage:not(.hide)');
            if (pluginsPage) {
                let installedPlugins = pluginsPage.querySelector('.installedPlugins');
                if (!installedPlugins) {
                    installedPlugins = document.querySelector('#pluginsPage:not(.hide)>div>div>div:last-child>div');
                }
                if (installedPlugins) {
                    addKefinTweaksPluginCard(installedPlugins);
                }
            }
            return;
        }

        try {
            const config = await getKefinTweaksConfig();
            const root = config?.kefinTweaksRoot || '';
            const sourceInfo = parseKefinTweaksSource(root);
            
            // Determine version display text
            let versionDisplay = 'Installation Pending';
            if (root) {
                if (sourceInfo.sourceType === 'custom') {
                    versionDisplay = SELF_HOSTED_NAME;
                } else if (sourceInfo.version === DEVELOPMENT_NAME) {
                    versionDisplay = DEVELOPMENT_NAME;
                } else if (sourceInfo.version === LATEST_RELEASE_NAME) {
                    // Fetch the actual latest version number
                    try {
                        const response = await fetch('https://api.github.com/repos/ranaldsgift/KefinTweaks/releases/latest');
                        if (response.ok) {
                            const data = await response.json();
                            const versionNumber = data.tag_name.replace(/^v/, '');
                            versionDisplay = `${versionNumber} (${LATEST_RELEASE_NAME})`;
                        } else {
                            versionDisplay = LATEST_RELEASE_NAME;
                        }
                    } catch (error) {
                        console.warn('[KefinTweaks Installer] Error fetching latest version:', error);
                        versionDisplay = LATEST_RELEASE_NAME;
                    }
                } else {
                    // Specific version
                    versionDisplay = sourceInfo.version;
                }
            }

            // Update data attributes
            card.setAttribute('data-version', versionDisplay);
            card.setAttribute('data-status', root ? 'Active' : 'Pending');

            // Check if this is a Material-UI card
            const isMuiCard = card.classList.contains('MuiGrid-root');
            
            if (isMuiCard) {
                // Handle Material-UI card structure
                const versionElement = card.querySelector('.MuiTypography-root.MuiTypography-body2');
                if (versionElement) {
                    versionElement.textContent = versionDisplay;
                }
            } else {
                // Handle standard card structure
                const cardTextElements = card.querySelectorAll('.cardText');
                if (cardTextElements.length > 0) {
                    // Update first cardText (plugin name with version)
                    const nameElement = cardTextElements[0];
                    const versionSpan = nameElement.querySelector('.cardText-secondary');
                    if (versionSpan) {
                        versionSpan.textContent = versionDisplay;
                    } else {
                        // If no secondary span exists, create one
                        nameElement.innerHTML = `KefinTweaks<span class="cardText cardText-secondary">${versionDisplay}</span>`;
                    }
                }

                // Determine status text
                const statusText = root ? 'Status Active' : 'Click to Install';

                // Update status text (usually last cardText)
                if (cardTextElements.length > 0) {
                    cardTextElements[cardTextElements.length - 1].textContent = statusText;
                }
            }
        } catch (error) {
            console.error('[KefinTweaks Installer] Error updating plugin card:', error);
        }
    }

    /**
     * Remove the plugin card from the DOM
     */
    function removeKefinTweaksPluginCard() {
        const card = document.querySelector('[data-id="kefinTweaksPlugin"]');
        if (card) {
            card.remove();
            console.log('[KefinTweaks Installer] Plugin card removed');
        }
    }

    // Make function globally accessible
    window.openKefinTweaksSourceModal = openKefinTweaksSourceModal;

    // Add plugin card to plugins page
    function addKefinTweaksPluginCard(installedPlugins) {
        if (!installedPlugins) {
            return;
        }

        // Check if card already exists in either container
        if (document.querySelector('[data-id="kefinTweaksPlugin"]')) {
            return;
        }

        const pluginsPage = document.querySelector('#pluginsPage:not(.hide)');
        if (!pluginsPage) {
            return;
        }

        // Find or create frontEndPlugins container
        let frontEndPlugins = pluginsPage.querySelector('.frontEndPlugins');
        
        if (!frontEndPlugins) {
            // Create the heading
            const heading = document.createElement('div');
            heading.className = 'sectionTitleContainer flex align-items-center';
            heading.innerHTML = '<h2 class="sectionTitle">Front End Plugins</h2>';
            heading.style.marginTop = '2em';
            
            // Create the frontEndPlugins container
            frontEndPlugins = document.createElement('div');
            frontEndPlugins.className = 'frontEndPlugins itemsContainer vertical-wrap';
            
            // Insert heading and container after installedPlugins
            if (installedPlugins.nextSibling) {
                installedPlugins.parentNode.insertBefore(heading, installedPlugins.nextSibling);
                installedPlugins.parentNode.insertBefore(frontEndPlugins, heading.nextSibling);
            } else {
                installedPlugins.parentNode.appendChild(heading);
                installedPlugins.parentNode.appendChild(frontEndPlugins);
            }
        }

        // Find an existing plugin card to clone
        // Try multiple selectors to find a plugin card
        const existingCard = installedPlugins.querySelector('.card[data-id]') || 
                             installedPlugins.querySelector(':first-child') ||
                             installedPlugins.firstElementChild;
        
        if (!existingCard) {
            // Set up MutationObserver to watch for plugin cards being added
            console.log('[KefinTweaks Installer] No existing plugin card found, setting up MutationObserver');
            
            const observer = new MutationObserver((mutations) => {
                // Check if any child was added
                for (const mutation of mutations) {
                    if (mutation.addedNodes.length > 0) {
                        // Check if we now have a card to clone
                        const cardToClone = installedPlugins.querySelector('.card[data-id]') || 
                                          installedPlugins.querySelector(':first-child') ||
                                          installedPlugins.firstElementChild;
                        
                        if (cardToClone) {
                            console.log('[KefinTweaks Installer] Plugin card detected, disconnecting observer');
                            observer.disconnect();
                            // Try adding our card again
                            addKefinTweaksPluginCard(installedPlugins);
                            return;
                        }
                    }
                }
            });
            
            // Observe child additions to the installedPlugins container
            observer.observe(installedPlugins, {
                childList: true,
                subtree: false
            });
            
            // Disconnect after 10 seconds if no cards appear
            setTimeout(() => {
                observer.disconnect();
                console.warn('[KefinTweaks Installer] MutationObserver timeout: No plugin cards appeared after 10 seconds');
            }, 10000);
            
            return;
        }

        // Get current config to determine version/status
        getKefinTweaksConfig().then(async config => {
            const root = config?.kefinTweaksRoot || '';
            const sourceInfo = parseKefinTweaksSource(root);
            
            // Determine version display text
            let versionDisplay = 'Installation Pending';
            if (root) {
                if (sourceInfo.sourceType === 'custom') {
                    versionDisplay = SELF_HOSTED_NAME;
                } else if (sourceInfo.version === DEVELOPMENT_NAME) {
                    versionDisplay = DEVELOPMENT_NAME;
                } else if (sourceInfo.version === LATEST_RELEASE_NAME) {
                    // Fetch the actual latest version number
                    try {
                        const response = await fetch('https://api.github.com/repos/ranaldsgift/KefinTweaks/releases/latest');
                        if (response.ok) {
                            const data = await response.json();
                            const versionNumber = data.tag_name.replace(/^v/, '');
                            versionDisplay = `${versionNumber} (${LATEST_RELEASE_NAME})`;
                        } else {
                            versionDisplay = LATEST_RELEASE_NAME;
                        }
                    } catch (error) {
                        console.warn('[KefinTweaks Installer] Error fetching latest version:', error);
                        versionDisplay = LATEST_RELEASE_NAME;
                    }
                } else {
                    // Specific version
                    versionDisplay = sourceInfo.version;
                }
            }

            // Clone the existing card
            const card = existingCard.cloneNode(true);
            
            // Update data attributes
            card.setAttribute('data-id', 'kefinTweaksPlugin');
            card.setAttribute('data-version', versionDisplay);
            card.setAttribute('data-name', 'KefinTweaks');
            card.setAttribute('data-removable', 'true');
            card.setAttribute('data-status', root ? 'Active' : 'Pending');

            // Check if this is a Material-UI card (MuiGrid-root)
            const isMuiCard = card.classList.contains('MuiGrid-root');
            
            if (isMuiCard) {
                // Handle Material-UI card structure
                const nameElement = card.querySelector('.MuiTypography-root.MuiTypography-body1');
                const versionElement = card.querySelector('.MuiTypography-root.MuiTypography-body2');
                
                if (nameElement) {
                    nameElement.textContent = 'KefinTweaks';
                }
                
                if (versionElement) {
                    versionElement.textContent = versionDisplay;
                }
            } else {
                // Handle standard card structure
                const cardTextElements = card.querySelectorAll('.cardText');
                if (cardTextElements.length > 0) {
                    // Update first cardText (plugin name with version)
                    const nameElement = cardTextElements[0];
                    const versionSpan = nameElement.querySelector('.cardText-secondary');
                    if (versionSpan) {
                        // Update existing version span
                        versionSpan.textContent = versionDisplay;
                        // Update the name part (text before the span)
                        if (nameElement.firstChild && nameElement.firstChild.nodeType === Node.TEXT_NODE) {
                            nameElement.firstChild.textContent = 'KefinTweaks';
                        } else {
                            // Insert name text before the version span
                            nameElement.insertBefore(document.createTextNode('KefinTweaks'), versionSpan);
                        }
                    } else {
                        // If no secondary span exists, create one
                        nameElement.innerHTML = `KefinTweaks<span class="cardText cardText-secondary">${versionDisplay}</span>`;
                    }
                }
            
                // Determine status text
                const statusText = root ? 'Status Active' : 'Click to Install';

                // Update status text (usually last cardText)
                if (cardTextElements.length > 0) {
                    cardTextElements[cardTextElements.length - 1].textContent = statusText;
                } else {
                    // Add status if it doesn't exist
                    const cardFooter = card.querySelector('.cardFooter');
                    if (cardFooter) {
                        const statusElement = document.createElement('div');
                        statusElement.className = 'cardText';
                        statusElement.textContent = statusText;
                        cardFooter.appendChild(statusElement);
                    }
                }
            }

            // Find and replace the anchor/link with a button that opens the modal
            // For Material-UI cards, the anchor might be structured differently
            let anchorElement = null;
            
            if (isMuiCard) {
                // For Material-UI cards, look for anchor in various possible locations
                anchorElement = card.querySelector('a[href]') || 
                               card.querySelector('.MuiCardActionArea') ||
                               card.querySelector('a');
            } else {
                // For standard cards, look for .cardImageContainer
                anchorElement = card.querySelector('.cardImageContainer');
            }
            
            if (anchorElement) {
                // Remove existing link attributes
                anchorElement.removeAttribute('href');
                anchorElement.removeAttribute('data-url');
                anchorElement.removeAttribute('target');
                
                // Convert to button if it's not already
                if (anchorElement.tagName.toLowerCase() !== 'button') {
                    const button = document.createElement('button');
                    // Copy all attributes (except link-specific ones)
                    Array.from(anchorElement.attributes).forEach(attr => {
                        if (attr.name !== 'href' && attr.name !== 'data-url' && attr.name !== 'target') {
                            button.setAttribute(attr.name, attr.value);
                        }
                    });
                    button.className = anchorElement.className;
                    
                    // For Material-UI, preserve Mui classes but add button behavior
                    if (isMuiCard) {
                        button.setAttribute('type', 'button');
                        // Preserve MuiCardActionArea if it exists
                        if (anchorElement.classList.contains('MuiCardActionArea')) {
                            button.classList.add('MuiCardActionArea');
                        }
                    } else {
                        button.setAttribute('is', 'emby-linkbutton');
                        button.style.margin = '0';
                        button.style.padding = '0';
                    }
                    
                    // Copy all child nodes
                    while (anchorElement.firstChild) {
                        button.appendChild(anchorElement.firstChild);
                    }
                    
                    // Replace the element
                    anchorElement.parentNode.replaceChild(button, anchorElement);
                    button.onclick = (e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        openKefinTweaksSourceModal();
                    };
                } else {
                    // It's already a button, just update onclick
                    anchorElement.onclick = (e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        openKefinTweaksSourceModal();
                    };
                }

                // Replace any existing img tag with icon div
                let img = card.querySelector('img');
    
                if (img) {
                    img.src = 'https://raw.githubusercontent.com/ranaldsgift/KefinTweaks/refs/heads/main/logo.png';
                    img.style.width = 'auto';
                    img.style.height = '100%';
                    img.parentNode.style.background = 'linear-gradient(to bottom, #202020, #101010)';
                } else {
                    img = document.createElement('div');
                    img.className = 'defaultCardBackground';
                    // give the gradient some color
                    img.style.background = 'url(https://raw.githubusercontent.com/ranaldsgift/KefinTweaks/refs/heads/main/logo.png), linear-gradient(to bottom, #202020, #101010)';
                    img.style.backgroundSize = 'contain';
                    img.style.backgroundPosition = 'center';
                    img.style.backgroundRepeat = 'no-repeat';
                    img.style.width = '100%';
                    img.style.height = '100%';
                    img.style.overflow = 'hidden';
                    img.style.display = 'flex';
                }

                let defaultCardBackground = card.querySelector('.defaultCardBackground') ?? card.querySelector('.MuiCardMedia-root');
                
                if (img && defaultCardBackground) {
                    // Replace the defaultCardBackground with the img
                    defaultCardBackground.parentNode.replaceChild(img, defaultCardBackground);
                }
            }

            // Find and handle menu button (btnCardMenu) if it exists
            const menuButton = card.querySelector('.btnCardMenu');
            if (menuButton) {
                // Remove existing click handlers by cloning
                const clonedMenuButton = menuButton.cloneNode(true);
                menuButton.parentNode.replaceChild(clonedMenuButton, menuButton);
                
                // Add click handler to open modal
                clonedMenuButton.onclick = (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    openKefinTweaksSourceModal();
                };
            }

            // Append to frontEndPlugins container instead of installedPlugins
            frontEndPlugins.appendChild(card);
        }).catch(err => {
            console.error('[KefinTweaks Installer] Error getting config for card:', err);
        });
    }

    // Check for plugins page and add card
    function checkForPluginsPage(view, element, hash) {

        if (hash && hash.includes('dashboard/plugins')) {
            const pluginsPage = document.querySelector('#pluginsPage:not(.hide)');
            if (!pluginsPage) {
                return;
            }

            let installedPlugins = pluginsPage.querySelector('.installedPlugins');

            if (!installedPlugins) {
                // Support for Jellyfin 10.11.X
                installedPlugins = document.querySelector('#pluginsPage:not(.hide)>div>div>div:last-child>div');
            }
            
            if (pluginsPage && installedPlugins) {
                // Small delay to ensure DOM is ready
                setTimeout(() => {
                    addKefinTweaksPluginCard(installedPlugins);
                }, 100);
            }
        }
    }

    // Check if user is logged in and admin
    async function checkUserAndSetup(retryCount = 0) {
        const maxRetries = 100; // 10 seconds (100 * 100ms)
        
        try {
            // Check if ApiClient is available and user is logged in
            if (!window.ApiClient || !window.ApiClient._loggedIn) {
                if (retryCount < maxRetries) {
                    setTimeout(() => {
                        checkUserAndSetup(retryCount + 1);
                    }, 100);
                    return;
                } else {
                    console.log('[KefinTweaks Installer] User not logged in after polling, skipping setup');
                    return;
                }
            }

            // Check if there is a valid config with a root url already, and load the injector if so
            checkAndLoadInjector();

            // Check if user is admin
            const userIsAdmin = await isAdmin();
            if (!userIsAdmin) {
                console.log('[KefinTweaks Installer] User is not admin, skipping setup');
                return;
            }

            // User is logged in and is admin, proceed with setup
            console.log('[KefinTweaks Installer] User is admin, setting up functionality');

            // Add CSS
            const css = document.createElement('style');
            css.textContent = `
                [data-id="kefinTweaksPlugin"] .cardImageContainer::after,
                [data-id="kefinTweaksPlugin"] .MuiButtonBase-root.MuiCardActionArea-root::after {
                    content: 'KefinTweaks';
                    position: absolute;
                    font-size: 2em;
                    top: 50%;
                    transform: translateY(-50%);
                }
            `;
            document.head.appendChild(css);
            
            // Hook into Emby.Page.onViewShow
            setupOnViewShow();
        } catch (error) {
            console.error('[KefinTweaks Installer] Error checking user:', error);
            // Retry on error
            if (retryCount < maxRetries) {
                setTimeout(() => {
                    checkUserAndSetup(retryCount + 1);
                }, 100);
            }
        }
    }

    // Hook into Emby.Page.onViewShow
    function setupOnViewShow() {
        const originalOnViewShow = window.Emby?.Page?.onViewShow;
        
        if (window.Emby && window.Emby.Page) {
            window.Emby.Page.onViewShow = function(...args) {
                // Call original handler if it exists
                if (originalOnViewShow) {
                    try {
                        originalOnViewShow.apply(this, args);
                    } catch (err) {
                        console.warn('[KefinTweaks Installer] Error in original onViewShow:', err);
                    }
                }
                
                // Check for plugins page
                const hash = window.location.hash;
                checkForPluginsPage(args[0], args[1], hash);
            };
            
            console.log('[KefinTweaks Installer] Hooked into Emby.Page.onViewShow');
        } else {
            // Retry if Emby.Page not ready yet
            setTimeout(setupOnViewShow, 100);
        }
    }

    // Initialize the installer
    function initialize() {
        // Start checking for logged in admin user
        checkUserAndSetup();
    }

    // Load injector.js from a specific root URL
    async function loadInjectorFromRoot(root) {
        if (!root || root === '') {
            console.warn('[KefinTweaks Installer] Cannot load injector: kefinTweaksRoot is empty');
            return false;
        }

        // Ensure root ends with /
        const rootUrl = root.endsWith('/') ? root : root + '/';
        const injectorUrl = `${rootUrl}injector.js`;
        
        // Check if injector is already loaded from this URL
        const existingScript = document.querySelector(`script[src="${injectorUrl}"]`);
        if (existingScript) {
            console.log('[KefinTweaks Installer] Injector already loaded from:', injectorUrl);
            return true;
        }

        console.log('[KefinTweaks Installer] Loading injector.js from:', injectorUrl);
        
        return new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = injectorUrl;
            script.async = true;
            
            script.onload = () => {
                console.log('[KefinTweaks Installer] Injector loaded successfully');
                resolve(true);
            };
            
            script.onerror = (error) => {
                console.error('[KefinTweaks Installer] Failed to load injector:', error);
                reject(new Error(`Failed to load injector.js from ${injectorUrl}`));
            };
            
            document.head.appendChild(script);
        });
    }

    // Check if config exists and load injector.js if ready
    async function checkAndLoadInjector() {
        try {
            const config = await getKefinTweaksConfig();
            const root = config?.kefinTweaksRoot || '';
            
            if (root && root !== '') {
                await loadInjectorFromRoot(root);
            } else {
                console.log('[KefinTweaks Installer] kefinTweaksRoot not configured. Please configure via the Plugins page.');
            }
        } catch (error) {
            console.error('[KefinTweaks Installer] Error checking config:', error);
        }
    }

    // Initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            initialize();
        });
    } else {
        initialize();
    }

    console.log('[KefinTweaks Installer] Installer script loaded');
})();

