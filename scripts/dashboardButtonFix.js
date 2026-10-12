// Dashboard Button Fix
// This is a workaround for a bug in the dashboard back button
// The dashboard back button currently leaves the Jellyfin app if the user navigates to the dashboard directly from the URL
// This script sends you to home.html in these scenarios instead of leaving the app

(function () {
    'use strict';

    function attachHandler(btn) {
        if (!btn || btn._backCheckAttached) return true;
        btn._backCheckAttached = true;

        btn.addEventListener('click', function (e) {
            if (window.history.state?.idx === 0) {
                e.stopImmediatePropagation();
                e.preventDefault();

                console.log('[KefinTweaks DashboardButtonFix]: No history to go back. Redirecting to home page.');

                const homeUrl = ApiClient.serverVersion().split('.')[1] > 10 ? 'home' : 'home.html';
                Dashboard.navigate(`/${homeUrl}`);
            }
        }, true);
        return true;
    }

    function tryAttach() {
        const btn = document.querySelector('button.MuiButtonBase-root');
        return attachHandler(btn);
    }

    function armForDashboard() {
        if (tryAttach()) return;

        const utils = window.KefinTweaksUtils;
        if (utils?.waitForElement) {
            utils.waitForElement('button.MuiButtonBase-root', {
                timeout: 15000,
                quiet: true,
                predicate: (el) => !el._backCheckAttached
            }).then((btn) => {
                if (btn) attachHandler(btn);
            });
            return;
        }
        if (utils?.pollUntil) {
            utils.pollUntil(() => (tryAttach() ? true : null), { intervalMs: 200, timeoutMs: 15000 });
            return;
        }
        setTimeout(armForDashboard, 500);
    }

    function start() {
        const utils = window.KefinTweaksUtils;
        if (!utils?.onViewPage) {
            setTimeout(start, 500);
            return;
        }
        utils.onViewPage(() => {
            armForDashboard();
        }, { pages: ['dashboard', 'configurationpage'] });
        // Also try immediately (direct load)
        armForDashboard();
    }

    start();
})();
