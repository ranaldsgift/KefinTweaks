// Exclusive Elsewhere Script
// Modifies the behavior of the Jellyfin Enhanced Elsewhere functionality
// Adds custom branding when the item is not available on any selected streaming services
//
// If you want to add an icon to the text you can do so by targeting the "exclusive" class.
//
// For example:
// .streaming-lookup-container a.exclusive::after {
//     content: '';
//     background: url(/path/to/icon.png);
//     background-size: contain;
//     background-repeat: no-repeat;
//     width: 25px;
//     height: 25px;
//     display: inline-block;
//     margin-left: 0.5rem;
// } 

(function() {
    'use strict';
    
    // Common logging function
    const LOG = (...args) => console.log('[KefinTweaks ExclusiveElsewhere]', ...args);
    const WARN = (...args) => console.warn('[KefinTweaks ExclusiveElsewhere]', ...args);
    const ERR = (...args) => console.error('[KefinTweaks ExclusiveElsewhere]', ...args);
    
    LOG('Script loaded - JS Injector mode');
    
    // Get configuration from global config
    const config = window.KefinTweaksConfig?.exclusiveElsewhere || {
        hideServerName: false // Default fallback
    };
    
    const observer = new MutationObserver(() => {
        const elsewhereContainer = document.querySelector('.itemDetailPage:not(.hide) .streaming-lookup-container>div');
        if (elsewhereContainer && elsewhereContainer.children && elsewhereContainer.children.length > 2) {
            return;
        }

        const serverName = config.hideServerName ? '' : ApiClient.serverName();

        const link = document.querySelector('.itemDetailPage:not(.hide) .streaming-lookup-container>div>div:first-child a');
        if (link && !link.classList.contains('exclusive')) {
            LOG('Modifying elsewhere link to show exclusive branding');
            link.innerHTML = `Only available on ${serverName}`;
            link.classList.add("exclusive");
            link.title = "Exclusive";
            link.disable = true;
        }
    });

    observer.observe(document.body, {
        childList: true,
        subtree: true
    });
    
    LOG('Exclusive elsewhere functionality initialized');
})();