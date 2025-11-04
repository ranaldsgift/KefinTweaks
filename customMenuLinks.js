// Custom Menu Links Script
// Loads custom menu links from configuration and adds them to the custom menu
// Uses utils.addCustomMenuLink to add each configured link
// Requires: utils.js module to be loaded before this script

(function() {
    'use strict';
    
    // Common logging function
    const LOG = (...args) => console.log('[KefinTweaks CustomMenuLinks]', ...args);
    const WARN = (...args) => console.warn('[KefinTweaks CustomMenuLinks]', ...args);
    const ERR = (...args) => console.error('[KefinTweaks CustomMenuLinks]', ...args);
    
    LOG('Script loaded - JS Injector mode');
    
    // Get custom menu links configuration
    function getCustomMenuLinksConfig() {
        return window.KefinTweaksConfig?.customMenuLinks || [];
    }
    
    // Initialize custom menu links
    async function initializeCustomMenuLinks() {
        const customMenuLinks = getCustomMenuLinksConfig();
        
        if (!Array.isArray(customMenuLinks) || customMenuLinks.length === 0) {
            LOG('No custom menu links configured');
            return;
        }
        
        LOG(`Loading ${customMenuLinks.length} custom menu links`);
        
        // Check if utils is available
        if (!window.KefinTweaksUtils || !window.KefinTweaksUtils.addCustomMenuLink) {
            ERR('KefinTweaksUtils.addCustomMenuLink not available');
            return;
        }
        
        // Add each custom menu link
        const addPromises = customMenuLinks.map(async (linkConfig, index) => {
            try {
                // Validate link configuration
                if (!linkConfig.name || !linkConfig.url) {
                    WARN(`Custom menu link at index ${index} is missing required properties (name, url)`);
                    return false;
                }
                
                const {
                    name,
                    icon = 'link', // Default icon
                    url,
                    openInNewTab = false
                } = linkConfig;
                
                LOG(`Adding custom menu link: ${name}`);
                
                const success = await window.KefinTweaksUtils.addCustomMenuLink(
                    name,
                    icon,
                    url,
                    openInNewTab
                );
                
                if (success) {
                    LOG(`Successfully added custom menu link: ${name}`);
                } else {
                    WARN(`Failed to add custom menu link: ${name}`);
                }
                
                return success;
            } catch (error) {
                ERR(`Error adding custom menu link at index ${index}:`, error);
                return false;
            }
        });
        
        // Wait for all links to be processed
        const results = await Promise.all(addPromises);
        const successCount = results.filter(Boolean).length;
        
        LOG(`Custom menu links initialization complete: ${successCount}/${customMenuLinks.length} links added successfully`);
    }
    
    // Wait for utils to be available and then initialize
    function waitForUtilsAndInitialize() {
        if (window.KefinTweaksUtils && window.KefinTweaksUtils.addCustomMenuLink) {
            LOG('Utils available, initializing custom menu links');
            initializeCustomMenuLinks();
            return;
        }
        
        LOG('Waiting for KefinTweaksUtils to be available');
        
        // Poll for utils availability
        const checkInterval = setInterval(() => {
            if (window.KefinTweaksUtils && window.KefinTweaksUtils.addCustomMenuLink) {
                clearInterval(checkInterval);
                LOG('Utils available, initializing custom menu links');
                initializeCustomMenuLinks();
            }
        }, 100);
        
        // Fallback timeout after 10 seconds
        setTimeout(() => {
            clearInterval(checkInterval);
            WARN('KefinTweaksUtils not available after 10 seconds');
        }, 10000);
    }
    
    // Start initialization
    waitForUtilsAndInitialize();
    
    LOG('Custom menu links functionality initialized');
})();