// Custom Menu Script
// Removes target="_blank" from custom menu links to prevent opening in new tabs
// Ensures all custom menu links open in the same tab for better user experience

(function() {
    'use strict';
    
    // Common logging function
    const LOG = (...args) => console.log('[CustomMenu]', ...args);
    const WARN = (...args) => console.warn('[CustomMenu]', ...args);
    const ERR = (...args) => console.error('[CustomMenu]', ...args);
    
    LOG('Script loaded - JS Injector mode');
    
    function initMenuWatcher() {
        const menuContainer = document.querySelector('.customMenuOptions');
        if (!menuContainer) return false;

        LOG('Custom menu container found, initializing watcher');

        const cleanLinks = (node) => {
            if (node.matches?.('a.navMenuOption[target="_blank"]')) {
                LOG('Removing target="_blank" from menu link');
                node.removeAttribute('target');
            }
            node.querySelectorAll?.('a.navMenuOption[target="_blank"]').forEach(link => {
                LOG('Removing target="_blank" from nested menu link');
                link.removeAttribute('target');
            });
        };

        // Clean existing links
        cleanLinks(menuContainer);

        // Watch for new/changed nodes
        const observer = new MutationObserver((mutations) => {
            for (const mutation of mutations) {
                mutation.addedNodes.forEach(node => cleanLinks(node));
                if (mutation.type === 'attributes' && mutation.target.matches('a.navMenuOption')) {
                    cleanLinks(mutation.target);
                }
            }
        });

        observer.observe(menuContainer, { 
            childList: true, 
            subtree: true, 
            attributes: true, 
            attributeFilter: ['target'] 
        });

        LOG('Menu watcher initialized successfully');
        return true;
    }

    // Watch for menu container to appear
    const waitForMenu = () => {
        const menuContainer = document.querySelector('.customMenuOptions');
        if (menuContainer) {
            initMenuWatcher();
            return;
        }

        LOG('Custom menu container not found, waiting for it to appear');

        // Use MutationObserver to watch for the menu container
        const observer = new MutationObserver((mutations) => {
            for (const mutation of mutations) {
                mutation.addedNodes.forEach(node => {
                    if (node.nodeType === Node.ELEMENT_NODE) {
                        // Check if the added node is the menu or contains it
                        if (node.matches?.('.customMenuOptions') || node.querySelector?.('.customMenuOptions')) {
                            LOG('Custom menu container detected, initializing watcher');
                            observer.disconnect();
                            initMenuWatcher();
                            return;
                        }
                    }
                });
            }
        });

        observer.observe(document.body, { 
            childList: true, 
            subtree: true 
        });

        // Fallback timeout after 10 seconds
        setTimeout(() => {
            observer.disconnect();
            WARN('Menu not found after 10 seconds');
        }, 10000);
    };

    // Start watching
    waitForMenu();
    
    LOG('Custom menu functionality initialized');
})();
