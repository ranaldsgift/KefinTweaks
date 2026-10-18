// Backdrop Leak Fix Script
// Fixes issue that causes backdrop images to be continuously added to the page if the tab isn't focused

(function() {
    'use strict';
    
    // Common logging function
    const LOG = (...args) => console.log('[KefinTweaks BackdropLeakFix]', ...args);
    
    LOG('Script loaded - JS Injector mode');

    function attachPruneObserver(container) {
        if (!container || container.dataset.kefinBackdropPrune === 'true') return;
        container.dataset.kefinBackdropPrune = 'true';

        LOG('Found .backdropContainer, attaching prune observer');
        const pruneObserver = new MutationObserver(() => {
            LOG('Mutation detected, checking children count:', container.children.length);
            while (container.children.length > 2) {
                LOG('Too many children (' + container.children.length + '), removing oldest');
                container.removeChild(container.firstElementChild);
            }
        });
        pruneObserver.observe(container, { childList: true });
        LOG('Prune observer is now active');
    }

    function startWait() {
        const utils = window.KefinTweaksUtils;
        const existing = document.querySelector('.backdropContainer');
        if (existing) {
            attachPruneObserver(existing);
            return;
        }

        if (utils?.waitForElement) {
            utils.waitForElement('.backdropContainer', { timeout: 60000, quiet: true }).then((container) => {
                if (container) attachPruneObserver(container);
                else WARN_MISSING();
            });
            return;
        }

        // Fallback if utils not ready yet
        setTimeout(startWait, 500);
    }

    function WARN_MISSING() {
        console.warn('[KefinTweaks BackdropLeakFix] .backdropContainer not found within timeout');
    }

    startWait();
    LOG('Waiting for .backdropContainer to appear...');
    LOG('Backdrop leak fix functionality initialized');
})();
