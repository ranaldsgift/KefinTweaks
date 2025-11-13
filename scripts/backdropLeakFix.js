// Backdrop Leak Fix Script
// Fixes issue that causes backdrop images to be continuously added to the page if the tab isn't focused

(function() {
    'use strict';
    
    // Common logging function
    const LOG = (...args) => console.log('[KefinTweaks BackdropLeakFix]', ...args);
    
    LOG('Script loaded - JS Injector mode');

    // Step 1: watch for .backdropContainer to appear
    const waitForContainer = new MutationObserver(() => {
        const container = document.querySelector('.backdropContainer');
        if (!container) return;

        LOG('Found .backdropContainer, attaching prune observer');
        waitForContainer.disconnect();

        // Step 2: prune children as needed
        const pruneObserver = new MutationObserver(() => {
            LOG('Mutation detected, checking children count:', container.children.length);
            while (container.children.length > 2) {
                LOG('Too many children (' + container.children.length + '), removing oldest');
                container.removeChild(container.firstElementChild);
            }
        });

        pruneObserver.observe(container, { childList: true });
        LOG('Prune observer is now active');
    });

    waitForContainer.observe(document.body, {
        childList: true,
        subtree: true
    });

    LOG('Waiting for .backdropContainer to appear...');
    LOG('Backdrop leak fix functionality initialized');
})();
