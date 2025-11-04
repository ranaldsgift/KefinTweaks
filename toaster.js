// KefinTweaks Toaster
// Provides toast notification functionality using Jellyfin's existing toast system
// Usage: window.KefinTweaksToaster.toast(message, duration)

(function() {
    'use strict';
    
    // Common logging function
    const LOG = (...args) => console.log('[KefinTweaks Toaster]', ...args);
    const WARN = (...args) => console.warn('[KefinTweaks Toaster]', ...args);
    const ERR = (...args) => console.error('[KefinTweaks Toaster]', ...args);
    
    LOG('Initializing');
    
    /**
     * Get the toast container
     * The container is the last child at the root of body with class toastContainer
     * @returns {HTMLElement|null} The toast container element or null if not found
     */
    function getToastContainer() {
        // Look for existing toastContainer at the root of body (last child)
        const container = document.querySelector('body > .toastContainer:last-child');
        if (container) {
            return container;
        }
        
        // Fallback: try to find any toastContainer
        const anyContainer = document.querySelector('.toastContainer');
        if (anyContainer) {
            return anyContainer;
        }
        
        return null;
    }
    
    /**
     * Convert duration to milliseconds
     * @param {string|number} duration - Duration in seconds (string like "3s") or milliseconds (number)
     * @returns {number} Duration in milliseconds
     */
    function parseDuration(duration) {
        if (typeof duration === 'number') {
            return duration;
        }
        
        if (typeof duration === 'string') {
            // Remove 's' if present and convert to number
            const seconds = parseFloat(duration.replace('s', ''));
            if (!isNaN(seconds)) {
                return seconds * 1000;
            }
        }
        
        // Default to 3 seconds
        return 3000;
    }
    
    /**
     * Display a toast message
     * @param {string} message - The message to display
     * @param {string|number} duration - Duration in seconds
     * @param {boolean} autoHide - Whether to automatically hide the toast after duration (default: true)
     */
    function toast(message, duration = '3', autoHide = true) {
        if (!message) {
            WARN('Toast message is required');
            return;
        }
        
        let container = getToastContainer();
        let customContainer = false;
        if (!container) {
            // Create a new toast container
            const newContainer = document.createElement('div');
            newContainer.className = 'toastContainer';
            document.body.appendChild(newContainer);
            container = newContainer;
            customContainer = true;
        }
        
        // Remove any existing toast element from the container
        const existingToast = container.querySelector('.toast');
        if (existingToast) {
            existingToast.remove();
            LOG('Removed existing toast to make room for new one');
        }
        
        // Create the toast element with just 'toast' class initially
        const toastElement = document.createElement('div');
        toastElement.className = 'toast';
        toastElement.textContent = message;
        
        // Add to container first
        container.appendChild(toastElement);
        LOG(`Displaying toast: "${message}"`);
        
        // Force a browser reflow by reading a layout property
        // This ensures the element is rendered with just 'toast' class before adding 'toastVisible'
        void toastElement.offsetHeight;
        
        // Now add toastVisible class - the browser will see the state change and apply the transition
        toastElement.classList.add('toastVisible');
        
        // Only set up auto-hide if enabled
        if (autoHide) {
            // Calculate duration in milliseconds
            const durationMs = parseDuration(duration);
            
            // After the duration, start the fade-out
            setTimeout(() => {
                if (!toastElement.parentNode) {
                    return; // Already removed
                }
                
                // Add toastHide class to trigger fade-out
                toastElement.classList.add('toastHide');
                
                // Wait 1 second for Jellyfin's CSS to handle the fade-out, then remove
                setTimeout(() => {
                    if (toastElement.parentNode) {
                        toastElement.parentNode.removeChild(toastElement);
                        LOG(`Removed toast: "${message}"`);
                        if (customContainer) {
                            container.remove();
                        }
                    }
                }, 3000);
            }, durationMs);
        }
    }
    
    // Expose toaster to global scope
    window.KefinTweaksToaster = {
        toast
    };
    
    LOG('Initialized successfully');
    LOG('Available at window.KefinTweaksToaster');
})();
