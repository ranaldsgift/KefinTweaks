// Custom Menu Links Script
// Loads custom menu links from configuration and adds them via utils.addCustomMenuLink
// Requires: utils.js module to be loaded before this script

(function() {
    'use strict';
    
    const LOG = (...args) => console.log('[KefinTweaks CustomMenuLinks]', ...args);
    const WARN = (...args) => console.warn('[KefinTweaks CustomMenuLinks]', ...args);
    const ERR = (...args) => console.error('[KefinTweaks CustomMenuLinks]', ...args);
    
    LOG('Script loaded - JS Injector mode');
    
    function getCustomMenuLinksConfig() {
        return window.KefinTweaksConfig?.customMenuLinks || [];
    }

    function normalizeTopNavigation(value) {
        const v = String(value || 'none').toLowerCase().trim();
        if (v === 'main' || v === 'right') return v;
        return 'none';
    }
    
    async function initializeCustomMenuLinks() {
        if (!window.KefinTweaksUtils || !window.KefinTweaksUtils.addCustomMenuLink) {
            ERR('KefinTweaksUtils.addCustomMenuLink not available');
            return;
        }

        if (typeof window.KefinTweaksUtils.ensureCustomMenuLinkStyles === 'function') {
            window.KefinTweaksUtils.ensureCustomMenuLinkStyles();
        }

        const customMenuLinks = getCustomMenuLinksConfig();
        
        if (!Array.isArray(customMenuLinks) || customMenuLinks.length === 0) {
            LOG('No custom menu links configured');
            return;
        }
        
        LOG(`Loading ${customMenuLinks.length} custom menu links`);
        
        // Sequential so drawer insert order matches config order
        let successCount = 0;
        for (let index = 0; index < customMenuLinks.length; index++) {
            const linkConfig = customMenuLinks[index];
            try {
                const name = linkConfig?.name;
                const url = linkConfig?.url != null ? String(linkConfig.url).trim() : '';
                const action = linkConfig?.action != null ? String(linkConfig.action).trim() : '';

                if (!name || (!url && !action)) {
                    WARN(`Custom menu link at index ${index} is missing required properties (name, and url or action)`);
                    continue;
                }
                
                const {
                    icon = 'link',
                    openInNewTab = false,
                    collapsed = false,
                    sideMenu = true,
                    userMenu = false,
                    isAdminLink = false
                } = linkConfig;

                const topNavigation = normalizeTopNavigation(linkConfig.topNavigation);
                const orderNum = Number(linkConfig.order);
                const order = Number.isFinite(orderNum) ? orderNum : undefined;
                
                LOG(`Adding custom menu link: ${name}`);
                
                const success = await window.KefinTweaksUtils.addCustomMenuLink(
                    name,
                    icon,
                    url,
                    openInNewTab,
                    {
                        collapsed: !!collapsed,
                        sideMenu: sideMenu !== false,
                        topNavigation,
                        userMenu: !!userMenu,
                        isAdminLink: !!isAdminLink,
                        action,
                        order
                    }
                );
                
                if (success) {
                    successCount += 1;
                    LOG(`Successfully added custom menu link: ${name}`);
                } else {
                    WARN(`Failed to add custom menu link: ${name}`);
                }
            } catch (error) {
                ERR(`Error adding custom menu link at index ${index}:`, error);
            }
        }
        
        LOG(`Custom menu links initialization complete: ${successCount}/${customMenuLinks.length} links added successfully`);
    }
    
    function waitForUtilsAndInitialize() {
        if (window.KefinTweaksUtils && window.KefinTweaksUtils.addCustomMenuLink) {
            LOG('Utils available, initializing custom menu links');
            initializeCustomMenuLinks();
            return;
        }
        
        LOG('Waiting for KefinTweaksUtils to be available');
        
        const checkInterval = setInterval(() => {
            if (window.KefinTweaksUtils && window.KefinTweaksUtils.addCustomMenuLink) {
                clearInterval(checkInterval);
                LOG('Utils available, initializing custom menu links');
                initializeCustomMenuLinks();
            }
        }, 100);
        
        setTimeout(() => {
            clearInterval(checkInterval);
            WARN('KefinTweaksUtils not available after 10 seconds');
        }, 10000);
    }
    
    waitForUtilsAndInitialize();
    
    LOG('Custom menu links functionality initialized');
})();
