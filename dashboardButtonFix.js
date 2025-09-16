// Dashboard Button Fix
// This is a workaround for a bug in the dashboard back button
// The dashboard back button currently leaves the Jellyfin app if the user navigates to the dashboard directly from the URL
// This script sends you to home.html in these scenarios instead of leaving the app

(function () {
    function attachHandler() {
        const btn = document.querySelector('button.MuiButtonBase-root');
        if (!btn) return;

        if (btn._backCheckAttached) return;
        btn._backCheckAttached = true;

        btn.addEventListener('click', function (e) {
            if (window.history.state?.idx === 0) {
                // Stop normal handlers
                e.stopImmediatePropagation();
                e.preventDefault();

                console.log("[DashboardButtonFix]: No history to go back. Redirecting to home page.");

                // Changes this to the page you'd like to return to by default
                Dashboard.navigate('/home.html');
            }
        }, true);
    }

    // Observe DOM in case button is recreated
    const obs = new MutationObserver(attachHandler);
    obs.observe(document.body, { childList: true, subtree: true });

    // Initial run
    attachHandler();
})();
