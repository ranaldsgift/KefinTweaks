// KefinTweaks Toaster
// Provides toast notification functionality using Jellyfin's existing toast system
// Usage: window.KefinTweaksToaster.toast(message, duration, autoHide, options)

(function() {
    'use strict';
    
    // Common logging function
    const LOG = (...args) => console.log('[KefinTweaks Toaster]', ...args);
    const WARN = (...args) => console.warn('[KefinTweaks Toaster]', ...args);
    const ERR = (...args) => console.error('[KefinTweaks Toaster]', ...args);
    
    LOG('Initializing');

    let stylesInjected = false;

    function ensureToastStyles() {
        if (stylesInjected) return;
        stylesInjected = true;
        const style = document.createElement('style');
        style.textContent = `
            .toast.kefin-toast-rich {
                display: flex;
                align-items: center;
                gap: 0.75em;
                max-width: min(28rem, calc(100vw - 2rem));
            }
            .toast.kefin-toast-rich .kefin-toast-message {
                flex: 1 1 auto;
                min-width: 0;
                line-height: 1.35;
            }
            .toast.kefin-toast-rich .kefin-toast-link {
                color: inherit;
                text-decoration: underline;
                cursor: pointer;
            }
            .toast.kefin-toast-rich .kefin-toast-action {
                flex: 0 0 auto;
                display: inline-flex;
                align-items: center;
                justify-content: center;
                width: 2rem;
                height: 2rem;
                padding: 0;
                margin: 0;
                border: none;
                border-radius: 50%;
                background: transparent;
                color: inherit;
                cursor: pointer;
            }
            .toast.kefin-toast-rich .kefin-toast-action:hover {
                background: rgba(255, 255, 255, 0.12);
            }
            .toast.kefin-toast-rich .kefin-toast-action .material-icons {
                font-size: 1.25rem;
            }
        `;
        document.head.appendChild(style);
    }
    
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

    function dismissToastElement(toastElement, container, customContainer) {
        if (!toastElement?.parentNode) return;
        toastElement.classList.add('toastHide');
        setTimeout(() => {
            if (toastElement.parentNode) {
                toastElement.parentNode.removeChild(toastElement);
            }
            if (customContainer && container && !container.querySelector('.toast')) {
                container.remove();
            }
        }, 3000);
    }

    function buildToastContent(toastElement, message, options) {
        const link = options?.link;
        const action = options?.action;
        const rich = !!(link || action);
        if (!rich) {
            toastElement.textContent = message;
            return;
        }

        ensureToastStyles();
        toastElement.classList.add('kefin-toast-rich');

        const messageEl = document.createElement('span');
        messageEl.className = 'kefin-toast-message';

        if (link?.label && typeof message === 'string' && message.includes(link.label)) {
            const idx = message.indexOf(link.label);
            if (idx > 0) {
                messageEl.appendChild(document.createTextNode(message.slice(0, idx)));
            }
            const anchor = document.createElement('a');
            anchor.className = 'kefin-toast-link';
            anchor.href = link.href || '#';
            anchor.textContent = link.label;
            anchor.addEventListener('click', (ev) => {
                ev.preventDefault();
                ev.stopPropagation();
                if (typeof link.onClick === 'function') {
                    link.onClick();
                } else if (link.href) {
                    if (window.Dashboard?.navigate) {
                        window.Dashboard.navigate(link.href);
                    } else {
                        window.location.hash = link.href.startsWith('#') ? link.href : `#/${link.href}`;
                    }
                }
            });
            messageEl.appendChild(anchor);
            const after = message.slice(idx + link.label.length);
            if (after) {
                messageEl.appendChild(document.createTextNode(after));
            }
        } else {
            messageEl.textContent = message;
            if (link?.label) {
                messageEl.appendChild(document.createTextNode(' '));
                const anchor = document.createElement('a');
                anchor.className = 'kefin-toast-link';
                anchor.href = link.href || '#';
                anchor.textContent = link.label;
                anchor.addEventListener('click', (ev) => {
                    ev.preventDefault();
                    ev.stopPropagation();
                    if (typeof link.onClick === 'function') link.onClick();
                    else if (link.href && window.Dashboard?.navigate) {
                        window.Dashboard.navigate(link.href);
                    }
                });
                messageEl.appendChild(anchor);
            }
        }

        toastElement.appendChild(messageEl);

        if (action && typeof action.onClick === 'function') {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'kefin-toast-action';
            btn.title = action.label || 'Undo';
            btn.setAttribute('aria-label', action.label || 'Undo');
            const icon = document.createElement('span');
            icon.className = 'material-icons';
            icon.setAttribute('aria-hidden', 'true');
            icon.textContent = action.icon || 'undo';
            btn.appendChild(icon);
            btn.addEventListener('click', (ev) => {
                ev.preventDefault();
                ev.stopPropagation();
                try {
                    action.onClick();
                } catch (e) {
                    ERR('Toast action failed:', e);
                }
            });
            toastElement.appendChild(btn);
        }
    }
    
    /**
     * Display a toast message
     * @param {string} message - The message to display
     * @param {string|number} duration - Duration in seconds
     * @param {boolean} autoHide - Whether to automatically hide the toast after duration (default: true)
     * @param {{ link?: { label: string, href?: string, onClick?: Function }, action?: { icon?: string, label?: string, onClick: Function } }} [options]
     * @returns {{ dismiss: Function, element: HTMLElement }|undefined}
     */
    function toast(message, duration = '3', autoHide = true, options = null) {
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
        buildToastContent(toastElement, message, options || {});
        
        // Add to container first
        container.appendChild(toastElement);
        LOG(`Displaying toast: "${message}"`);
        
        // Force a browser reflow by reading a layout property
        // This ensures the element is rendered with just 'toast' class before adding 'toastVisible'
        void toastElement.offsetHeight;
        
        // Now add toastVisible class - the browser will see the state change and apply the transition
        toastElement.classList.add('toastVisible');

        const dismiss = () => dismissToastElement(toastElement, container, customContainer);
        
        // Only set up auto-hide if enabled
        if (autoHide) {
            // Calculate duration in milliseconds
            const durationMs = parseDuration(duration);
            
            // After the duration, start the fade-out
            setTimeout(() => {
                dismiss();
            }, durationMs);
        }

        return { dismiss, element: toastElement };
    }
    
    // Expose toaster to global scope
    window.KefinTweaksToaster = {
        toast
    };
    
    LOG('Initialized successfully');
    LOG('Available at window.KefinTweaksToaster');
})();
