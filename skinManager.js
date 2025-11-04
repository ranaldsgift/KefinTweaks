// KefinTweaks Skin Manager
// Manages skin selection and CSS loading for the display settings page
// Adds a skin dropdown to mypreferencesdisplay.html and handles skin switching
// Requires: utils.js, userConfig.js modules to be loaded before this script

(function() {
    'use strict';
    
    // Common logging function
    const LOG = (...args) => console.log('[KefinTweaks SkinManager]', ...args);
    const WARN = (...args) => console.warn('[KefinTweaks SkinManager]', ...args);
    const ERR = (...args) => console.error('[KefinTweaks SkinManager]', ...args);
    
    LOG('Initializing...');
    
    // Configuration from user config
    let SKINS_CONFIG = [];
    let THEMES_CONFIG = [];
    const STORAGE_KEY = 'kefinTweaks_selectedSkin';
    const THEME_STORAGE_KEY = 'kefinTweaks_selectedTheme';
    const COLOR_SCHEMES_STORAGE_KEY = 'kefinTweaks_selectedColorScheme';
    
    // Load and merge skin configurations
    function loadSkinConfig() {
        const userSkins = window.KefinTweaksUserConfig?.skins || [];
        const additionalSkins = window.KefinTweaksConfig?.skins || [];
        
        // Start with user skins (these take priority)
        SKINS_CONFIG = [...userSkins];
        
        // Add additional skins from main config, avoiding duplicates by name
        additionalSkins.forEach(skin => {
            const exists = SKINS_CONFIG.some(existingSkin => existingSkin.name === skin.name);
            if (!exists) {
                SKINS_CONFIG.push(skin);
            }
        });
        
        // Ensure we always have at least a default skin
        if (SKINS_CONFIG.length === 0) {
            SKINS_CONFIG = [
                {
                    name: 'Default',
                    url: null
                }
            ];
        }
        
        LOG(`Loaded ${SKINS_CONFIG.length} skins (${userSkins.length} user + ${additionalSkins.length} additional)`);
    }
    
    // Load and merge theme configurations
    function loadThemeConfig() {
        const userThemes = window.KefinTweaksUserConfig?.themes || [];
        const additionalThemes = window.KefinTweaksConfig?.themes || [];
        
        // Start with user themes (these take priority)
        THEMES_CONFIG = [...userThemes];
        
        // Add additional themes from main config, avoiding duplicates by name
        additionalThemes.forEach(theme => {
            const exists = THEMES_CONFIG.some(existingTheme => existingTheme.name === theme.name);
            if (!exists) {
                THEMES_CONFIG.push(theme);
            }
        });
        
        LOG(`Loaded ${THEMES_CONFIG.length} themes (${userThemes.length} user + ${additionalThemes.length} additional)`);
    }
    
    
    // Track loaded skin CSS URLs
    let loadedSkinUrls = new Set();
    
    // Tooltip management
    let currentTooltip = null;
    
    // Store unregister functions for handlers
    let unregisterDisplayPreferencesHandler = null;
    let unregisterAnyPageHandler = null;
    
    /**
     * Create and show a tooltip
     * @param {string} text - The tooltip text
     * @param {Element} target - The target element to position the tooltip near
     */
    function showTooltip(text, target) {
        // Remove existing tooltip
        hideTooltip();
        
        // Create tooltip element
        currentTooltip = document.createElement('div');
        currentTooltip.className = 'kefin-tooltip';
        currentTooltip.textContent = text;
        
        // Add tooltip styles
        currentTooltip.style.cssText = `
            position: absolute;
            background: rgba(0, 0, 0, 0.9);
            color: white;
            padding: 8px 12px;
            border-radius: 6px;
            font-size: 12px;
            font-family: inherit;
            z-index: 10000;
            pointer-events: none;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
            max-width: 200px;
            word-wrap: break-word;
            opacity: 0;
            transition: opacity 0.2s ease;
        `;
        
        // Add to document
        document.body.appendChild(currentTooltip);
        
        // Position tooltip
        positionTooltip(target);
        
        // Fade in
        setTimeout(() => {
            if (currentTooltip) {
                currentTooltip.style.opacity = '1';
            }
        }, 10);
    }
    
    /**
     * Position the tooltip relative to the target element
     * @param {Element} target - The target element
     */
    function positionTooltip(target) {
        if (!currentTooltip || !target) return;
        
        const rect = target.getBoundingClientRect();
        const tooltipRect = currentTooltip.getBoundingClientRect();
        
        // Position above the target element
        let left = rect.left + (rect.width / 2) - (tooltipRect.width / 2);
        let top = rect.top - tooltipRect.height - 8;
        
        // Adjust if tooltip would go off screen
        if (left < 8) {
            left = 8;
        } else if (left + tooltipRect.width > window.innerWidth - 8) {
            left = window.innerWidth - tooltipRect.width - 8;
        }
        
        if (top < 8) {
            // Position below if no room above
            top = rect.bottom + 8;
        }
        
        currentTooltip.style.left = `${left}px`;
        currentTooltip.style.top = `${top}px`;
    }
    
    /**
     * Hide and remove the current tooltip
     */
    function hideTooltip() {
        if (currentTooltip) {
            currentTooltip.style.opacity = '0';
            setTimeout(() => {
                if (currentTooltip && currentTooltip.parentNode) {
                    currentTooltip.parentNode.removeChild(currentTooltip);
                }
                currentTooltip = null;
            }, 200);
        }
    }
    
    /**
     * Verify that the current skin/scheme/theme is properly applied
     * @returns {boolean} True if verification passes, false otherwise
     */
    function verifySkinApplication() {
        const selectedSkinName = localStorage.getItem(STORAGE_KEY) || getDefaultSkinName();
        const selectedSkin = SKINS_CONFIG.find(skin => skin.name === selectedSkinName);
        
        if (!selectedSkin) {
            ERR('Selected skin not found during verification');
            return false;
        }
        
        // Check if skin CSS is properly loaded
        if (selectedSkin.url) {
            const skinLinks = document.querySelectorAll('link[data-kefin-skin="true"]');
            const hasCorrectSkin = Array.from(skinLinks).some(link => 
                link.getAttribute('data-skin') === selectedSkinName
            );
            
            if (!hasCorrectSkin) {
                WARN(`Skin verification failed: Expected skin '${selectedSkinName}' not found in DOM`);
                return false;
            }
        }
        
        // Check if theme is properly applied
        const selectedThemeValue = localStorage.getItem(THEME_STORAGE_KEY);
        if (selectedThemeValue) {
            const selectedTheme = THEMES_CONFIG.find(theme => theme.name === selectedThemeValue);
            if (selectedTheme) {
                const cssThemeLink = document.getElementById('cssTheme');
                if (!cssThemeLink || !cssThemeLink.hasAttribute('data-kefin-custom-theme')) {
                    WARN(`Theme verification failed: Custom theme '${selectedThemeValue}' not properly applied`);
                    return false;
                }
            }
        }
        
        // Check if color scheme is properly applied
        const selectedColorSchemeName = localStorage.getItem(COLOR_SCHEMES_STORAGE_KEY);
        if (selectedColorSchemeName && selectedSkin.colorSchemes) {
            const selectedColorScheme = selectedSkin.colorSchemes.find(scheme => scheme.name === selectedColorSchemeName);
            if (selectedColorScheme && selectedColorScheme.url) {
                const cssColorSchemesLink = document.getElementById('cssColorSchemes');
                if (!cssColorSchemesLink || !cssColorSchemesLink.hasAttribute('data-kefin-color-schemes')) {
                    WARN(`Color scheme verification failed: Color scheme '${selectedColorSchemeName}' not properly applied`);
                    return false;
                }
            }
        }
        
        LOG('Skin application verification passed');
        return true;
    }
    
    /**
     * Initialize the skin manager with verification and retry logic
     */
    function initialize(retryCount = 0) {
        const MAX_RETRIES = 10;
        
        if (!window.KefinTweaksUtils) {
            ERR('KefinTweaksUtils not available - skin manager cannot initialize');
            return;
        }
        
        // Load and merge skin configurations
        loadSkinConfig();
        
        // Load and merge theme configurations
        loadThemeConfig();

        loadSelectedSkin();
        loadSelectedTheme();
        loadSelectedColorScheme();
        
        LOG('SkinManager initializing...');
        
        // Verify skin application after a short delay to allow CSS to load
        setTimeout(() => {
            if (!verifySkinApplication()) {
                if (retryCount < MAX_RETRIES) {
                    WARN(`Skin application verification failed, retrying... (attempt ${retryCount + 1}/${MAX_RETRIES})`);
                    setTimeout(() => {
                        initialize(retryCount + 1);
                    }, 500); // Wait 500ms before retry
                } else {
                    ERR(`Skin application verification failed after ${MAX_RETRIES} attempts - giving up`);
                    // Register handlers even if verification failed (give up case)
                    registerHandlers();
                }
            } else {
                LOG('Skin application verified successfully');
                // Register handlers after successful verification
                registerHandlers();
            }
        }, 200); // Wait 200ms for CSS to load before verification
    }
    
    /**
     * Register the onViewPage handlers
     */
    function registerHandlers() {
        // Only register if not already registered
        if (unregisterDisplayPreferencesHandler) {
            LOG('Handlers already registered, skipping');
            return;
        }
        
        // Register for the display preferences page
        unregisterDisplayPreferencesHandler = window.KefinTweaksUtils.onViewPage(handleDisplayPreferencesPage, {
            pages: ['mypreferencesdisplay'],
            immediate: true
        });
        
        // Register for all pages to add the appearance button
        unregisterAnyPageHandler = window.KefinTweaksUtils.onViewPage(handleAnyPage, {
            pages: [],
            immediate: true
        });
        
        LOG('SkinManager handlers registered');
    }
    
    /**
     * Handle the display preferences page
     * @param {string} view - The view name
     * @param {Element} element - The view element
     */
    function handleDisplayPreferencesPage(view, element) {
        LOG('Display preferences page detected');
        
        // Wait for the page to be fully loaded
        setTimeout(() => {
            addSkinDropdown();
            loadSelectedSkin();
            addColorSchemesDropdown();
            loadSelectedColorScheme();
            addThemeOptions();
            loadSelectedTheme();
        }, 100);
    }
    
    /**
     * Handle any page to add the appearance button
     * @param {string} view - The view name
     * @param {Element} element - The view element
     */
    function handleAnyPage(view, element) {
        // Skip the display preferences page as it's handled separately
        if (view === 'mypreferencesdisplay') {
            return;
        }
        
        // Wait for the page to be fully loaded
        setTimeout(() => {
            addAppearanceButton();
        }, 100);
    }
    
    /**
     * Add the appearance button to the header
     */
    function addAppearanceButton() {
        const headerRight = document.querySelector('.headerRight');
        if (!headerRight) {
            WARN('Header right section not found');
            return;
        }
        
        // Check if appearance button already exists
        if (headerRight.querySelector('.headerAppearanceButton')) {
            LOG('Appearance button already exists');
            return;
        }
        
        // Create the appearance button
        const appearanceButton = document.createElement('button');
        appearanceButton.type = 'button';
        appearanceButton.setAttribute('is', 'paper-icon-button-light');
        appearanceButton.className = 'headerButton headerButtonRight headerAppearanceButton paper-icon-button-light';
        appearanceButton.title = 'Appearance';
        
        // Create the icon span
        const iconSpan = document.createElement('span');
        iconSpan.className = 'material-icons palette';
        iconSpan.setAttribute('aria-hidden', 'true');
        
        appearanceButton.appendChild(iconSpan);
        
        // Add click event listener
        appearanceButton.addEventListener('click', toggleAppearancePopover);
        
        // Insert before the search button (or at the end if no search button)
        const searchButton = headerRight.querySelector('.headerSearchButton');
        if (searchButton) {
            headerRight.insertBefore(appearanceButton, searchButton);
        } else {
            headerRight.appendChild(appearanceButton);
        }
        
        LOG('Appearance button added successfully');
        
        // Unregister the handleAnyPage handler since button is now added and persistent
        if (unregisterAnyPageHandler) {
            unregisterAnyPageHandler();
            unregisterAnyPageHandler = null;
            LOG('Unregistered handleAnyPage handler - button is now persistent');
        }
    }
    
    /**
     * Toggle the appearance popover
     */
    function toggleAppearancePopover(event) {
        event.preventDefault();
        event.stopPropagation();
        
        // Remove existing popover if it exists
        const existingPopover = document.querySelector('.kefin-appearance-popover');
        if (existingPopover) {
            existingPopover.remove();
            return;
        }
        
        // Create the popover
        createAppearancePopover(event.target);
    }
    
    /**
     * Create the appearance popover with skin and color scheme dropdowns
     * @param {Element} button - The button that triggered the popover
     */
    function createAppearancePopover(button) {
        // Create backdrop
        const backdrop = document.createElement('div');
        backdrop.className = 'dialogBackdrop dialogBackdropOpened';
        backdrop.setAttribute('data-modal-id', 'appearance-popover');
        backdrop.style.position = 'fixed';
        backdrop.style.top = '0';
        backdrop.style.left = '0';
        backdrop.style.width = '100%';
        backdrop.style.height = '100%';
        backdrop.style.zIndex = '9999';
        backdrop.style.backgroundColor = 'transparent';
        
        // Create dialog container
        const dialogContainer = document.createElement('div');
        dialogContainer.className = 'dialogContainer';
        dialogContainer.setAttribute('data-modal-id', 'appearance-popover');
        dialogContainer.style.position = 'fixed';
        dialogContainer.style.top = '0';
        dialogContainer.style.left = '0';
        dialogContainer.style.width = '100%';
        dialogContainer.style.height = '100%';
        dialogContainer.style.zIndex = '10000';
        dialogContainer.style.pointerEvents = 'none';
        
        // Create dialog (popover)
        const dialog = document.createElement('div');
        dialog.className = 'focuscontainer dialog smoothScrollY ui-body-a background-theme-a formDialog';
        dialog.style.position = 'absolute';
        dialog.style.minWidth = '280px';
        dialog.style.pointerEvents = 'auto';
        dialog.style.animation = '160ms ease-out 0s 1 normal both running scaleup';
        
        // Create dialog content
        const dialogContent = document.createElement('div');
        dialogContent.style.margin = '0';
        dialogContent.style.padding = '1.25em 1.5em 1.5em';
        dialogContent.style.display = 'flex';
        dialogContent.style.flexDirection = 'column';
        dialogContent.style.gap = '0.8em';
        
        // Create skin dropdown
        const skinContainer = createDropdown({
            label: 'Skin',
            id: 'selectSkinPopover',
            options: SKINS_CONFIG.map(skin => ({
                value: skin.name,
                text: skin.name,
                author: skin.author
            })),
            changeHandler: handleSkinChange,
            isPopover: true
        });
        dialogContent.appendChild(skinContainer);
        
        // Create color schemes dropdown
        const colorSchemesContainer = createDropdown({
            label: 'Color Schemes',
            id: 'selectColorSchemesPopover',
            options: [], // Will be populated by updatePopoverColorSchemes
            changeHandler: handleColorSchemeChange,
            isPopover: true
        });
        dialogContent.appendChild(colorSchemesContainer);
        
        // Assemble dialog
        dialog.appendChild(dialogContent);
        dialogContainer.appendChild(dialog);
        
        // Position the popover
        positionPopover(dialog, button);
        
        // Add to document
        document.body.appendChild(backdrop);
        document.body.appendChild(dialogContainer);
        
        // Set current values from localStorage
        const skinSelect = document.getElementById('selectSkinPopover');
        const colorSchemesSelect = document.getElementById('selectColorSchemesPopover');
        
        if (skinSelect) {
            const currentSkin = localStorage.getItem(STORAGE_KEY) || getDefaultSkinName();
            skinSelect.value = currentSkin;
        }
        
        // Update color schemes dropdown based on current skin
        updatePopoverColorSchemes();
        
        // Add click outside to close
        setTimeout(() => {
            document.addEventListener('click', handlePopoverClickOutside);
        }, 10);
        
        LOG('Appearance popover created with Jellyfin styling');
    }
    
    /**
     * Create a generic dropdown with Jellyfin styling
     * @param {Object} config - Configuration object
     * @param {string} config.label - The dropdown label
     * @param {string} config.id - The dropdown ID
     * @param {Array} config.options - The dropdown options
     * @param {Function} config.changeHandler - The change event handler
     * @param {boolean} config.isPopover - Whether this is for a popover (affects styling)
     * @param {Function} config.hoverHandler - Optional hover handler for tooltips
     * @param {Function} config.focusHandler - Optional focus handler for tooltips
     * @param {Function} config.blurHandler - Optional blur handler for tooltips
     * @returns {Element} The dropdown container
     */
    function createDropdown(config) {
        const {
            label,
            id,
            options = [],
            changeHandler,
            isPopover = false,
            hoverHandler,
            focusHandler,
            blurHandler
        } = config;
        
        const container = document.createElement('div');
        
        // Create label
        const labelElement = document.createElement('label');
        if (isPopover) {
            labelElement.style.cssText = `
                display: block;
                margin-bottom: 8px;
                font-size: 14px;
                color: var(--main-color, var(--accent, #fff));
            `;
        } else {
            labelElement.className = 'selectLabel';
        }
        labelElement.textContent = label;
        labelElement.setAttribute('for', id);
        container.appendChild(labelElement);
        
        // Create select container with Jellyfin styling
        const selectContainer = document.createElement('div');
        selectContainer.className = 'selectContainer';
        if (isPopover) {
            selectContainer.style.marginBottom = '0px';
        }
        
        // Create select
        const select = document.createElement('select');
        select.id = id;
        select.setAttribute('is', 'emby-select');
        select.setAttribute('label', label);
        select.className = 'emby-select-withcolor emby-select';
        
        // Add options
        options.forEach(option => {
            const optionElement = document.createElement('option');
            optionElement.value = option.value;
            optionElement.textContent = option.text;
            if (option.author) {
                optionElement.setAttribute('data-author', option.author);
            }
            if (option.url) {
                optionElement.setAttribute('data-scheme-url', option.url);
            }
            select.appendChild(optionElement);
        });
        
        // Create the arrow container
        const arrowContainer = document.createElement('div');
        arrowContainer.className = 'selectArrowContainer';
        
        const hiddenDiv = document.createElement('div');
        hiddenDiv.style.visibility = 'hidden';
        hiddenDiv.style.display = 'none';
        hiddenDiv.textContent = '0';
        
        const arrow = document.createElement('span');
        arrow.className = 'selectArrow material-icons keyboard_arrow_down';
        arrow.setAttribute('aria-hidden', 'true');
        arrow.style.marginTop = '.2em';
        
        arrowContainer.appendChild(hiddenDiv);
        arrowContainer.appendChild(arrow);
        
        // Assemble the select container
        selectContainer.appendChild(select);
        selectContainer.appendChild(arrowContainer);
        
        // Add event handlers
        if (changeHandler) {
            select.addEventListener('change', changeHandler);
        }
        if (hoverHandler) {
            select.addEventListener('mouseover', hoverHandler);
            select.addEventListener('mouseout', hideTooltip);
        }
        if (focusHandler) {
            select.addEventListener('focus', focusHandler);
            select.addEventListener('blur', blurHandler || hideTooltip);
        }
        
        container.appendChild(selectContainer);
        return container;
    }
    
    /**
     * Create a dropdown for the popover (wrapper for createDropdown)
     * @param {string} label - The dropdown label
     * @param {string} id - The dropdown ID
     * @param {Array} options - The dropdown options
     * @param {Function} changeHandler - The change event handler
     * @returns {Element} The dropdown container
     */
    function createPopoverDropdown(label, id, options, changeHandler) {
        return createDropdown({
            label,
            id,
            options,
            changeHandler,
            isPopover: true
        });
    }
    
    /**
     * Handle skin change (unified for both popover and display page)
     * @param {Event} event - The change event
     */
    function handleSkinChange(event) {
        const selectedSkinName = event.target.value;
        const selectedSkin = SKINS_CONFIG.find(skin => skin.name === selectedSkinName);
        
        if (!selectedSkin) {
            ERR('Selected skin not found in configuration');
            return;
        }
        
        LOG(`Skin changed to: ${selectedSkin.name}`);
        
        // Save skin selection to localStorage
        localStorage.setItem(STORAGE_KEY, selectedSkinName);
        
        // Load the new skin
        loadSkin(selectedSkin);
        
        // Set default color scheme for the new skin
        const defaultColorScheme = getDefaultColorScheme(selectedSkin);
        if (defaultColorScheme) {
            localStorage.setItem(COLOR_SCHEMES_STORAGE_KEY, defaultColorScheme);
            syncAllColorSchemeDropdowns();
            
            // Load the default color scheme
            const defaultScheme = selectedSkin.colorSchemes.find(scheme => scheme.name === defaultColorScheme);
            if (defaultScheme) {
                updateColorSchemesCSS(defaultScheme.url);
            }
        } else {
            localStorage.removeItem(COLOR_SCHEMES_STORAGE_KEY);
            syncAllColorSchemeDropdowns();
            updateColorSchemesCSS(null);
        }
    }
    
    /**
     * Handle color scheme change (unified for both popover and display page)
     * @param {Event} event - The change event
     */
    function handleColorSchemeChange(event) {
        const selectedColorSchemeName = event.target.value;
        const selectedOption = event.target.selectedOptions[0];
        
        LOG(`Color scheme changed to: ${selectedColorSchemeName}`);
        
        // Save color scheme selection to localStorage
        localStorage.setItem(COLOR_SCHEMES_STORAGE_KEY, selectedColorSchemeName);
        
        const schemeUrl = selectedOption.getAttribute('data-scheme-url');
        updateColorSchemesCSS(schemeUrl);
    }
    
    /**
     * Update the color schemes dropdown in the popover
     */
    function updatePopoverColorSchemes() {
        const colorSchemesSelect = document.getElementById('selectColorSchemesPopover');
        if (!colorSchemesSelect) return;
        
        const selectedSkinName = localStorage.getItem(STORAGE_KEY) || getDefaultSkinName();
        const selectedSkin = SKINS_CONFIG.find(skin => skin.name === selectedSkinName);
        
        // Get the color schemes container to show/hide it
        // We need to go up to the container that holds both label and select
        const selectContainer = colorSchemesSelect.closest('.selectContainer');
        const colorSchemesContainer = selectContainer ? selectContainer.parentNode : colorSchemesSelect.closest('div');
        
        // Clear existing options
        const options = colorSchemesSelect.querySelectorAll('option');
        options.forEach(option => {
            option.remove();
        });
        
        // Show/hide color schemes dropdown based on whether skin has color schemes
        if (selectedSkin && selectedSkin.colorSchemes && selectedSkin.colorSchemes.length > 0) {
            // Show the container
            colorSchemesContainer.style.display = '';
            
            // Add color scheme options
            selectedSkin.colorSchemes.forEach(scheme => {
                const option = document.createElement('option');
                option.value = scheme.name;
                option.textContent = scheme.name;
                option.setAttribute('data-scheme-url', scheme.url);
                colorSchemesSelect.appendChild(option);
            });
            
            // Set the current selection
            const storedColorScheme = localStorage.getItem(COLOR_SCHEMES_STORAGE_KEY);
            if (storedColorScheme) {
                colorSchemesSelect.value = storedColorScheme;
            } else {
                // Use the default color scheme for this skin
                const defaultColorScheme = getDefaultColorScheme(selectedSkin);
                if (defaultColorScheme) {
                    colorSchemesSelect.value = defaultColorScheme;
                }
            }
        } else {
            // Hide the container if no color schemes
            colorSchemesContainer.style.display = 'none';
        }
    }
    
    /**
     * Position the popover relative to the button
     * @param {Element} popover - The popover element
     * @param {Element} button - The button element
     */
    function positionPopover(popover, button) {
        const rect = button.getBoundingClientRect();
        const popoverRect = popover.getBoundingClientRect();
        
        // Position below the button, right-aligned using right property
        let currentPos = rect.right - popoverRect.width;
        let top = rect.bottom + 16; // Increased from 8 to 16 for more spacing
        
        // Adjust if popover would go off screen
        if (currentPos < 8) {
            currentPos = 8;
        } else if (currentPos + popoverRect.width > window.innerWidth - 8) {
            currentPos = window.innerWidth - popoverRect.width - 8;
        }
        
        if (top + popoverRect.height > window.innerHeight - 8) {
            // Position above if no room below
            top = rect.top - popoverRect.height - 8;
        }
        
        popover.style.right = `calc(100% - ${currentPos}px - 50px)`;
        popover.style.top = `${top}px`;
    }
    
    /**
     * Handle clicks outside the popover to close it
     * @param {Event} event - The click event
     */
    function handlePopoverClickOutside(event) {
        const backdrop = document.querySelector('.dialogBackdrop[data-modal-id]');
        const dialogContainer = document.querySelector('.dialogContainer[data-modal-id]');
        
        if (backdrop && dialogContainer && 
            !dialogContainer.contains(event.target) && 
            !event.target.closest('.headerAppearanceButton')) {
            
            // Remove backdrop and dialog container
            if (backdrop.parentNode) {
                backdrop.parentNode.removeChild(backdrop);
            }
            if (dialogContainer.parentNode) {
                dialogContainer.parentNode.removeChild(dialogContainer);
            }
            
            document.removeEventListener('click', handlePopoverClickOutside);
        }
    }
    
    /**
     * Add the skin dropdown to the display preferences page
     */
    function addSkinDropdown() {
        const settingsContainer = document.querySelector('.settingsContainer');
        if (!settingsContainer) {
            WARN('Settings container not found');
            return;
        }
        
        const form = settingsContainer.querySelector('form');
        if (!form) {
            WARN('Settings form not found');
            return;
        }
        
        const displayModeField = form.querySelector('.fldDisplayMode');
        if (!displayModeField) {
            WARN('Display mode field not found');
            return;
        }
        
        // Check if skin dropdown already exists
        if (form.querySelector('.fldSkin')) {
            LOG('Skin dropdown already exists');
            return;
        }
        
        // Create the skin dropdown container
        const skinContainer = document.createElement('div');
        skinContainer.className = 'fldSkin';
        
        // Create the dropdown using the generic function
        const dropdown = createDropdown({
            label: 'Skin',
            id: 'selectSkin',
            options: SKINS_CONFIG.map(skin => ({
                value: skin.name,
                text: skin.name,
                author: skin.author
            })),
            changeHandler: handleSkinChange,
            hoverHandler: handleSkinSelectHover,
            focusHandler: handleSkinSelectFocus
        });
        
        // Add to skin container
        skinContainer.appendChild(dropdown);
        
        // Insert after the display mode field
        displayModeField.parentNode.insertBefore(skinContainer, displayModeField.nextSibling);
        
        // Set the current selection
        const selectedSkinName = localStorage.getItem(STORAGE_KEY) || getDefaultSkinName();
        const select = document.getElementById('selectSkin');
        if (select) {
        select.value = selectedSkinName;
        }
        
        LOG('Skin dropdown added successfully');
    }
    
    /**
     * Handle hover events on the skin select dropdown
     * @param {Event} event - The mouseover event
     */
    function handleSkinSelectHover(event) {
        const select = event.target;
        const selectedSkinName = select.value;
        const selectedSkin = SKINS_CONFIG.find(skin => skin.name === selectedSkinName);
        
        if (selectedSkin && selectedSkin.author) {
            let tooltipText = `Author: ${selectedSkin.author}`;
            if (selectedSkin.colorSchemes && selectedSkin.colorSchemes.length > 0) {
                tooltipText += `\nColor Schemes: ${selectedSkin.colorSchemes.length}`;
            }
            showTooltip(tooltipText, select);
        }
    }
    
    /**
     * Handle focus events on the skin select dropdown
     * @param {Event} event - The focus event
     */
    function handleSkinSelectFocus(event) {
        const select = event.target;
        const selectedSkinName = select.value;
        const selectedSkin = SKINS_CONFIG.find(skin => skin.name === selectedSkinName);
        
        if (selectedSkin && selectedSkin.author) {
            let tooltipText = `Author: ${selectedSkin.author}`;
            if (selectedSkin.colorSchemes && selectedSkin.colorSchemes.length > 0) {
                tooltipText += `\nColor Schemes: ${selectedSkin.colorSchemes.length}`;
            }
            showTooltip(tooltipText, select);
        }
    }
    
    /**
     * Add the color schemes dropdown to the display preferences page
     */
    function addColorSchemesDropdown() {
        const settingsContainer = document.querySelector('.settingsContainer');
        if (!settingsContainer) {
            WARN('Settings container not found');
            return;
        }
        
        const form = settingsContainer.querySelector('form');
        if (!form) {
            WARN('Settings form not found');
            return;
        }
        
        const skinField = form.querySelector('.fldSkin');
        if (!skinField) {
            WARN('Skin field not found - color schemes dropdown requires skin field');
            return;
        }
        
        // Check if color schemes dropdown already exists
        if (form.querySelector('.fldColorSchemes')) {
            LOG('Color schemes dropdown already exists');
            return;
        }
        
        // Create the color schemes dropdown container
        const colorSchemesContainer = document.createElement('div');
        colorSchemesContainer.className = 'fldColorSchemes';
        
        // Create the dropdown using the generic function
        const dropdown = createDropdown({
            label: 'Color Schemes',
            id: 'selectColorSchemes',
            options: [], // Will be populated by updateColorSchemesDropdown
            changeHandler: handleColorSchemeChange
        });
        
        // Add to color schemes container
        colorSchemesContainer.appendChild(dropdown);
        
        // Insert after the skin field
        skinField.parentNode.insertBefore(colorSchemesContainer, skinField.nextSibling);
        
        // Update color schemes based on current skin selection
        updateColorSchemesDropdown();
        
        LOG('Color schemes dropdown added successfully');
    }
    
    /**
     * Synchronize all color scheme dropdowns with the current skin and localStorage
     * This ensures both popover and display page dropdowns stay in sync
     */
    function syncAllColorSchemeDropdowns() {
        const selectedSkinName = localStorage.getItem(STORAGE_KEY) || getDefaultSkinName();
        const selectedSkin = SKINS_CONFIG.find(skin => skin.name === selectedSkinName);
        
        // Get all color scheme dropdowns
        const displayDropdown = document.getElementById('selectColorSchemes');
        const popoverDropdown = document.getElementById('selectColorSchemesPopover');
        
        // Update display page dropdown
        if (displayDropdown) {
            updateColorSchemesDropdown();
        }
        
        // Update popover dropdown
        if (popoverDropdown) {
            updatePopoverColorSchemes();
        }
        
        // Ensure localStorage has a valid color scheme for the current skin
        const storedColorScheme = localStorage.getItem(COLOR_SCHEMES_STORAGE_KEY);
        if (selectedSkin && selectedSkin.colorSchemes && selectedSkin.colorSchemes.length > 0) {
            // Check if stored color scheme is valid for current skin
            const isValidScheme = selectedSkin.colorSchemes.some(scheme => scheme.name === storedColorScheme);
            if (!isValidScheme) {
                // Remove invalid color scheme from localStorage
                localStorage.removeItem(COLOR_SCHEMES_STORAGE_KEY);
                LOG('Removed invalid color scheme from localStorage');
            }
        } else {
            // No color schemes available, remove from localStorage
            localStorage.removeItem(COLOR_SCHEMES_STORAGE_KEY);
        }
    }
    
    /**
     * Update the color schemes dropdown based on the selected skin
     */
    function updateColorSchemesDropdown() {
        const select = document.getElementById('selectColorSchemes');
        if (!select) {
            return;
        }
        
        // Get the currently selected skin
        const skinSelect = document.getElementById('selectSkin');
        if (!skinSelect) {
            return;
        }
        
        const selectedSkinName = skinSelect.value;
        const selectedSkin = SKINS_CONFIG.find(skin => skin.name === selectedSkinName);
        
        // Clear existing options
        const options = select.querySelectorAll('option');
        options.forEach(option => {
            option.remove();
        });
        
        // Show/hide the color schemes dropdown based on whether the skin has color schemes
        const colorSchemesContainer = select.closest('.fldColorSchemes');
        if (colorSchemesContainer) {
            if (selectedSkin && selectedSkin.colorSchemes && selectedSkin.colorSchemes.length > 0) {
                // Add color scheme options
                selectedSkin.colorSchemes.forEach(scheme => {
                    const option = document.createElement('option');
                    option.value = scheme.name;
                    option.textContent = scheme.name;
                    option.setAttribute('data-scheme-url', scheme.url);
                    select.appendChild(option);
                });
                
                // Show the dropdown
                colorSchemesContainer.style.display = '';
                LOG(`Updated color schemes dropdown with ${selectedSkin.colorSchemes.length} options for skin: ${selectedSkinName}`);
            } else {
                // Hide the dropdown if no color schemes
                colorSchemesContainer.style.display = 'none';
                LOG(`Hiding color schemes dropdown - skin '${selectedSkinName}' has no color schemes`);
            }
        }
        
        // Set the selected color scheme
        const selectedColorSchemeName = localStorage.getItem(COLOR_SCHEMES_STORAGE_KEY);
        if (selectedColorSchemeName) {
        select.value = selectedColorSchemeName;
        } else {
            // Use the default color scheme for this skin
            const defaultColorScheme = getDefaultColorScheme(selectedSkin);
            if (defaultColorScheme) {
                select.value = defaultColorScheme;
            }
        }
    }
    
    /**
     * Add custom theme options to the existing select#selectTheme dropdown
     */
    function addThemeOptions() {
        const themeSelect = document.getElementById('selectTheme');
        if (!themeSelect) {
            WARN('Theme select dropdown not found');
            return;
        }
        
        // Check if custom themes have already been added
        if (themeSelect.hasAttribute('data-kefin-themes-added')) {
            LOG('Custom theme options already added');
            return;
        }
        
        // Check if Jellyfin has already added its options
        if (themeSelect.options.length > 0) {
            addCustomThemeOptions(themeSelect);
        } else {
            // Wait for Jellyfin to add its options using MutationObserver
            LOG('Waiting for Jellyfin theme options to load...');
            const observer = new MutationObserver((mutations) => {
                mutations.forEach((mutation) => {
                    if (mutation.type === 'childList' && themeSelect.options.length > 0) {
                        LOG('Jellyfin theme options detected, adding custom options');
                        addCustomThemeOptions(themeSelect);
                        observer.disconnect(); // Stop observing once we've added our options
                    }
                });
            });
            
            observer.observe(themeSelect, { childList: true });
            
            // Fallback timeout in case MutationObserver doesn't trigger
            setTimeout(() => {
                if (!themeSelect.hasAttribute('data-kefin-themes-added') && themeSelect.options.length > 0) {
                    LOG('Fallback: Adding custom theme options after timeout');
                    addCustomThemeOptions(themeSelect);
                }
                observer.disconnect();
            }, 2000);
        }
    }
    
    /**
     * Add the actual custom theme options to the select element
     * @param {HTMLSelectElement} themeSelect - The theme select element
     */
    function addCustomThemeOptions(themeSelect) {
        // Add custom theme options
        THEMES_CONFIG.forEach(theme => {
            const option = document.createElement('option');
            option.value = theme.name;
            option.textContent = theme.name;
            option.setAttribute('data-theme-url', theme.url);
            option.setAttribute('data-custom-theme', 'true');
            themeSelect.appendChild(option);
        });
        
        // Mark as processed
        themeSelect.setAttribute('data-kefin-themes-added', 'true');
        
        // Add event listener for theme changes
        themeSelect.addEventListener('change', handleThemeChange);
        
        // Set the selected value from localStorage cache
        const cachedTheme = localStorage.getItem(THEME_STORAGE_KEY);
        if (cachedTheme) {
            themeSelect.value = cachedTheme;
            LOG(`Restored theme selection from cache: ${cachedTheme}`);
        }
        
        LOG(`Added ${THEMES_CONFIG.length} custom theme options`);
    }
    
    /**
     * Handle theme selection change
     * @param {Event} event - The change event
     */
    function handleThemeChange(event) {
        const selectedOption = event.target.selectedOptions[0];
        const selectedThemeValue = event.target.value;
        
        if (selectedOption) {
            
            LOG(`Custom theme changed to: ${selectedThemeValue}`);
            
            // Save selection to localStorage
            localStorage.setItem(THEME_STORAGE_KEY, selectedThemeValue);
            
            // Custom theme selected
            const themeUrl = selectedOption.getAttribute('data-theme-url') ?? `themes/${selectedThemeValue}/theme.css`;
                
            if (themeUrl) {
                // Update the cssTheme link href
                updateThemeCSS(themeUrl);
            }
        } else {
            // Default Jellyfin theme selected
            LOG(`Default theme changed to: ${selectedThemeValue}`);
            
            // Save selection to localStorage
            localStorage.setItem(THEME_STORAGE_KEY, selectedThemeValue);
            
            // Reset to default Jellyfin theme behavior
            resetThemeCSS();
        }
    }
    
    /**
     * Update the cssTheme link href to a custom theme URL
     * @param {string} url - The custom theme URL
     */
    function updateThemeCSS(url) {
        let cssThemeLink = document.getElementById('cssTheme');
        
        if (!cssThemeLink) {
            // Create the cssTheme link if it doesn't exist
            cssThemeLink = document.createElement('link');
            cssThemeLink.id = 'cssTheme';
            cssThemeLink.rel = 'stylesheet';
            cssThemeLink.type = 'text/css';
            cssThemeLink.setAttribute('data-kefin-custom-theme', 'true');
            document.head.appendChild(cssThemeLink);
            LOG('Created cssTheme link');
        }
        
        cssThemeLink.href = url;
        LOG(`Updated cssTheme link to: ${url}`);
    }
    
    /**
     * Reset the cssTheme link to default Jellyfin behavior
     */
    function resetThemeCSS() {
        const cssThemeLink = document.getElementById('cssTheme');
        
        if (cssThemeLink && cssThemeLink.hasAttribute('data-kefin-custom-theme')) {
            // Only remove if we created it
            cssThemeLink.remove();
            LOG('Removed custom cssTheme link');
        }
    }
    
    /**
     * Load the currently selected theme
     */
    function loadSelectedTheme() {
        const selectedThemeValue = localStorage.getItem(THEME_STORAGE_KEY);
        
        if (selectedThemeValue) {
            const selectedTheme = THEMES_CONFIG.find(theme => theme.name === selectedThemeValue);
            
            if (selectedTheme) {
                LOG(`Loading selected custom theme: ${selectedTheme.name}`);
                updateThemeCSS(selectedTheme.url);
                
                // Set the dropdown selection
                const themeSelect = document.getElementById('selectTheme');
                if (themeSelect) {
                    themeSelect.value = selectedThemeValue;
                }
            } else {
                // Check if it's a default Jellyfin theme
                const themeSelect = document.getElementById('selectTheme');
                if (themeSelect) {
                    const option = themeSelect.querySelector(`option[value="${selectedThemeValue}"]`);
                    if (option && !option.hasAttribute('data-custom-theme')) {
                        LOG(`Loading selected default theme: ${selectedThemeValue}`);
                        themeSelect.value = selectedThemeValue;
                        resetThemeCSS();
                    } else {
                        WARN(`Selected theme '${selectedThemeValue}' not found`);
                    }
                }
            }
        }
    }

    function removeColorSchemesCSS() {
        const cssColorSchemesLink = document.getElementById('cssColorSchemes');
        if (cssColorSchemesLink && cssColorSchemesLink.hasAttribute('data-kefin-color-schemes')) {
            cssColorSchemesLink.remove();
            LOG('Removed cssColorSchemes link');
        }
    }
    
    
    /**
     * Update the cssColorSchemes link href to a custom color scheme URL
     * @param {string|null} url - The color scheme URL, or null/empty to remove CSS
     */
    function updateColorSchemesCSS(url) {
        // Handle reset case (null or empty URL)
        if (!url) {
            removeColorSchemesCSS();            
            return;
        }
        
        let cssColorSchemesLink = document.getElementById('cssColorSchemes');
        
        if (!cssColorSchemesLink) {
            // Create the cssColorSchemes link if it doesn't exist
            cssColorSchemesLink = document.createElement('link');
            cssColorSchemesLink.id = 'cssColorSchemes';
            cssColorSchemesLink.rel = 'stylesheet';
            cssColorSchemesLink.type = 'text/css';
            cssColorSchemesLink.setAttribute('data-kefin-color-schemes', 'true');
            
            // Find the best insertion point to maintain CSS cascade order:
            // cssTheme -> cssSkin(s) -> cssColorSchemes
            const skinLinks = document.querySelectorAll('link[data-kefin-skin="true"]');
            let insertAfter = null;
            
            if (skinLinks.length > 0) {
                // Insert after the last skin CSS link
                insertAfter = skinLinks[skinLinks.length - 1];
            } else {
                // No skin CSS, insert after cssTheme
                insertAfter = document.getElementById('cssTheme');
            }
            
            if (insertAfter && insertAfter.parentNode) {
                insertAfter.parentNode.insertBefore(cssColorSchemesLink, insertAfter.nextSibling);
            } else {
                // Fallback to appending to head if no reference point found
                document.head.appendChild(cssColorSchemesLink);
            }
            LOG('Created cssColorSchemes link');
        }
        
        // Find the scheme by URL and update localStorage
        const selectedSkinName = localStorage.getItem(STORAGE_KEY) || getDefaultSkinName();
        const selectedSkin = SKINS_CONFIG.find(skin => skin.name === selectedSkinName);
        
        if (selectedSkin && selectedSkin.colorSchemes) {
            const matchingScheme = selectedSkin.colorSchemes.find(scheme => scheme.url === url);
            if (matchingScheme) {
                LOG(`Updated cssColorSchemes link to: ${url} for skin: ${selectedSkinName}`);
                
                // Update all color scheme dropdowns to match the applied scheme
                const displayDropdown = document.getElementById('selectColorSchemes');
                const popoverDropdown = document.getElementById('selectColorSchemesPopover');
                
                if (displayDropdown && matchingScheme) {
                    displayDropdown.value = matchingScheme.name;
                    LOG(`Updated display color scheme dropdown to: ${matchingScheme.name}`);
                }
                
                if (popoverDropdown && matchingScheme) {
                    popoverDropdown.value = matchingScheme.name;
                    LOG(`Updated popover color scheme dropdown to: ${matchingScheme.name}`);
                }

                if (cssColorSchemesLink) {
                    cssColorSchemesLink.href = url;
                    LOG(`Updated cssColorSchemes link to: ${url}`);
                }
                return;
            }
        }
        // If no skin or no color schemes, reset to default
        LOG('No skin or color schemes available, removing cssColorSchemes link');
        removeColorSchemesCSS();
    }
    
    
    /**
     * Load the currently selected color scheme
     */
    function loadSelectedColorScheme() {
        const selectedColorSchemeName = localStorage.getItem(COLOR_SCHEMES_STORAGE_KEY);
        
        if (selectedColorSchemeName) {
            // Get the currently selected skin
            const selectedSkinName = localStorage.getItem(STORAGE_KEY) || getDefaultSkinName();
            const selectedSkin = SKINS_CONFIG.find(skin => skin.name === selectedSkinName);
            
            if (selectedSkin && selectedSkin.colorSchemes) {
                const selectedColorScheme = selectedSkin.colorSchemes.find(scheme => scheme.name === selectedColorSchemeName);
            
            if (selectedColorScheme) {
                LOG(`Loading selected color scheme: ${selectedColorScheme.name}`);
                updateColorSchemesCSS(selectedColorScheme.url);
            } else {
                    LOG(`Selected color scheme '${selectedColorSchemeName}' not found for skin '${selectedSkinName}', using default`);
                    // Use the default color scheme for this skin
                    const defaultColorScheme = getDefaultColorScheme(selectedSkin);
                    if (defaultColorScheme) {
                        const defaultScheme = selectedSkin.colorSchemes.find(scheme => scheme.name === defaultColorScheme);
                        if (defaultScheme) {
                            updateColorSchemesCSS(defaultScheme.url);
                        }
                    } else {
                        updateColorSchemesCSS(null);
                    }
                }
            } else {
                WARN(`No color schemes available for skin '${selectedSkinName}'`);
            }
        } else {
            // No color scheme stored, use default for current skin
            const selectedSkinName = localStorage.getItem(STORAGE_KEY) || getDefaultSkinName();
        const selectedSkin = SKINS_CONFIG.find(skin => skin.name === selectedSkinName);
        
            if (selectedSkin) {
                const defaultColorScheme = getDefaultColorScheme(selectedSkin);
                if (defaultColorScheme) {
                    const defaultScheme = selectedSkin.colorSchemes.find(scheme => scheme.name === defaultColorScheme);
                    if (defaultScheme) {
                        LOG(`Loading default color scheme for skin '${selectedSkinName}': ${defaultScheme.name}`);
                        updateColorSchemesCSS(defaultScheme.url);
                    }
                } else {
                    LOG(`No default color scheme for skin '${selectedSkinName}', removing CSS`);
                    updateColorSchemesCSS(null);
                }
            }
        }
    }
    
    
    /**
     * Get the default color scheme for a skin
     * @param {Object} skin - The skin configuration object
     * @returns {string|null} The default color scheme name, or null if no schemes
     */
    function getDefaultColorScheme(skin) {
        if (!skin || !skin.colorSchemes || skin.colorSchemes.length === 0) {
            return null;
        }
        return skin.colorSchemes[0].name;
    }
    
    /**
     * Get the default skin name from configuration
     * @returns {string} The default skin name
     */
    function getDefaultSkinName() {
        // Check if a default skin is specified in the main configuration
        const configDefaultSkin = window.KefinTweaksConfig?.defaultSkin;
        if (configDefaultSkin) {
            LOG(`Using configured default skin: ${configDefaultSkin}`);
            return configDefaultSkin;
        }
        
        // Fall back to 'Default' if no configuration is specified
        return 'Default';
    }
    
    /**
     * Load the currently selected skin
     */
    function loadSelectedSkin() {
        const selectedSkinName = localStorage.getItem(STORAGE_KEY) || getDefaultSkinName();
        const selectedSkin = SKINS_CONFIG.find(skin => skin.name === selectedSkinName);
        
        if (selectedSkin) {
            LOG(`Loading selected skin: ${selectedSkin.name}`);
            loadSkin(selectedSkin);
            
            // Update color schemes dropdown after skin is loaded
            setTimeout(() => {
                syncAllColorSchemeDropdowns();
            }, 100);
        } else {
            const defaultSkinName = getDefaultSkinName();
            WARN(`Selected skin '${selectedSkinName}' not found, falling back to ${defaultSkinName}`);
            const defaultSkin = SKINS_CONFIG.find(skin => skin.name === defaultSkinName);
            if (defaultSkin) {
                loadSkin(defaultSkin);
                
                // Update color schemes dropdown after default skin is loaded
                setTimeout(() => {
                    syncAllColorSchemeDropdowns();
                }, 100);
            }
        }
    }
    
    /**
     * Load a specific skin
     * @param {Object} skin - The skin configuration object
     */
    function loadSkin(skin) {
        // Check if this skin is already loaded by looking at the DOM
        const currentSkinLink = document.querySelector('link[data-kefin-skin="true"]');
        const currentSkinName = currentSkinLink ? currentSkinLink.getAttribute('data-skin') : null;
        
        if (currentSkinName === skin.name) {
            LOG(`Skin '${skin.name}' is already loaded - skipping`);
            return;
        }
        
        // Use requestAnimationFrame to avoid blocking
        requestAnimationFrame(() => {
            removeAllSkinCSS();
        });
        
        // Performance optimization: Load new CSS first, then remove old CSS
        // This prevents the double-reflow/recalc that causes UI freezing
        
        // Step 1: Load the new CSS first (gets cached and starts loading)
        requestAnimationFrame(() => {
            let cssUrls = [];
            if (Array.isArray(skin.url)) {
                LOG(`Loading skin with ${skin.url.length} CSS files: ${skin.name}`);
                cssUrls = skin.url;
                skin.url.forEach(url => loadSkinCSS(url, skin.name));
            } else {
                LOG(`Loading skin with single CSS file: ${skin.name}`);
                cssUrls = [skin.url];
                loadSkinCSS(skin.url, skin.name);
            }
        });
    }
    
    /**
     * Load CSS for a specific skin using link tags
     * @param {string} url - The CSS URL
     * @param {string} skinName - The skin name
     */
    function loadSkinCSS(url, skinName) {
        // Check if this CSS is already loaded
        if (loadedSkinUrls.has(url)) {
            LOG(`Skin CSS already loaded: ${url}`);
            return;
        }
        
        const link = document.createElement('link');
        link.id = `cssSkin-${Date.now()}-${Math.random()}`; // Unique ID to prevent conflicts
        link.rel = 'stylesheet';
        link.type = 'text/css';
        link.href = url;
        link.setAttribute('data-kefin-skin', 'true');
        link.setAttribute('data-skin', skinName);
        
        // Insert after the cssTheme link to ensure skins take precedence over themes
        const cssThemeLink = document.getElementById('cssTheme');
        if (cssThemeLink && cssThemeLink.parentNode) {
            cssThemeLink.parentNode.insertBefore(link, cssThemeLink.nextSibling);
        } else {
            // Fallback to appending to head if cssTheme link not found
            document.getElementById('reactRoot').after(link);
        }
        
        loadedSkinUrls.add(url);
        LOG(`Skin CSS loaded via link tag: ${url}`);
        
        // Defer expensive DOM operations (cssColorSchemes repositioning)
        // to avoid blocking during the initial CSS load
        requestAnimationFrame(() => {
            const cssColorSchemesLink = document.getElementById('cssColorSchemes');
            if (cssColorSchemesLink && cssColorSchemesLink.parentNode) {
                // Only reposition if it's not already in the right position
                const skinLinks = document.querySelectorAll('link[data-kefin-skin="true"]');
                const lastSkinLink = skinLinks[skinLinks.length - 1];
                
                if (lastSkinLink && lastSkinLink.nextSibling !== cssColorSchemesLink) {
                    // Remove it from its current position
                    cssColorSchemesLink.remove();
                    // Insert it after the last skin CSS link
                    lastSkinLink.parentNode.insertBefore(cssColorSchemesLink, lastSkinLink.nextSibling);
                    LOG('Repositioned cssColorSchemes after skin CSS');
                }
            }
        });
    }
    
    /**
     * Remove all previously loaded skin CSS
     */
    function removeAllSkinCSS() {
        const skinLinks = document.querySelectorAll('link[data-kefin-skin="true"]');
        
        skinLinks.forEach(link => {
            const url = link.href;
            loadedSkinUrls.delete(url);
            link.remove();
            LOG(`Removed skin CSS link: ${url}`);
        });
        
        // Clear the tracking set
        loadedSkinUrls.clear();
    }
    
    // Initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initialize);
    } else {
        initialize();
    }

    LOG('Initialized successfully');
})();
