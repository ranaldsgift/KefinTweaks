// KefinTweaks Utilities
// Provides standardized functionality for hooking into Emby.Page.onViewShow
// while maintaining original Jellyfin functionality

(function() {
    'use strict';
    
    // Common logging function
    const LOG = (...args) => console.log('[KefinTweaks Utils]', ...args);
    const WARN = (...args) => console.warn('[KefinTweaks Utils]', ...args);
    const ERR = (...args) => console.error('[KefinTweaks Utils]', ...args);
    
    LOG('Initializing');
    
    // Store the original onViewShow function
    let originalOnViewShow = null;
    const state = {
        previousHash: null,
    }
    
    // Initialize the utils by hooking into Emby.Page.onViewShow
    function initialize() {
        // Store the original onViewShow if it exists
        if (window.Emby && window.Emby.Page && window.Emby.Page.onViewShow) {
            originalOnViewShow = window.Emby.Page.onViewShow;
            LOG('Stored original Emby.Page.onViewShow');
        }
        
        // Override onViewShow to maintain original functionality
        if (window.Emby && window.Emby.Page) {
            window.Emby.Page.onViewShow = function (...args) {
                // Call original handler if it exists
                if (originalOnViewShow) {
                    try {
                        originalOnViewShow.apply(this, ...args);
                    } catch (err) {
                        ERR('Error in original onViewShow handler:', err);
                    }
                }

                const view = getCurrentView() ?? args[0];
                
                // Call our registered handlers
                notifyHandlers(view, args[1], window.location.hash, state.previousHash);
                state.previousHash = window.location.hash;
            };
            
            LOG('Hooked into Emby.Page.onViewShow');
        } else {
            WARN('Emby.Page.onViewShow not found - utils may not work correctly');
        }
    }

    /**
     * Build MediaBrowser Authorization header
     * @returns {string} - Authorization header
     */
    function getAuthHeader() {
        const token = ApiClient.accessToken();
        const client = typeof ApiClient.applicationName === 'function' ? ApiClient.applicationName() : 'Jellyfin Web';
        const device = typeof ApiClient.deviceName === 'function' ? ApiClient.deviceName() : (navigator.userAgent.includes('Chrome') ? 'Chrome' : 'Browser');
        const deviceId = typeof ApiClient.deviceId === 'function' ? ApiClient.deviceId() : '';
        const version = ApiClient._appVersion || ApiClient._serverVersion || '';
        const parts = [
            `Client="${encodeURIComponent(client)}"`,
            `Device="${encodeURIComponent(device)}"`,
            `DeviceId="${encodeURIComponent(deviceId)}"`,
            `Version="${encodeURIComponent(version)}"`,
            `Token="${encodeURIComponent(token)}"`
        ];
        return `MediaBrowser ${parts.join(', ')}`;
    }
    
    // Array to store registered handlers
    const handlers = [];
    
    // Cache item per page view to avoid multiple fetches
    let cachedItem = null;
    let cachedItemId = null;
    let fetchInProgress = null; // Track the promise of an in-progress fetch
    let fetchItemId = null; // Track which item ID is currently being fetched
    
    /**
     * Register a callback to be called when page view changes
     * @param {Function} callback - Function to call when page view changes
     * @param {Object} options - Options for the handler
     */
    function onViewPage(callback, options = {}) {
        if (typeof callback !== 'function') {
            ERR('Callback must be a function');
            return;
        }
        
        const handlerConfig = {
            callback,
            options: {
                pages: [], // Specific pages to watch (empty = all pages)
                ...options
            }
        };
        
        handlers.push(handlerConfig);
        LOG(`Registered onViewPage handler (total: ${handlers.length})`);
        
        // Test if this is causing issues
        const currentView = getCurrentView();
        if (currentView && shouldCallHandler(handlerConfig, currentView)) {
            try {
                // Pass the promise (not awaited) for consistency with notifyHandlers
                const itemPromise = getCurrentItem();
                callback(currentView, document, window.location.hash, itemPromise);
            } catch (err) {
                ERR('Error in immediate handler call:', err);
            }
        }
        
        // Return a function to unregister this handler
        return () => {
            const index = handlers.indexOf(handlerConfig);
            if (index !== -1) {
                handlers.splice(index, 1);
                LOG(`Unregistered onViewPage handler (remaining: ${handlers.length})`);
            }
        };
    }
    
    /**
     * Get item ID from URL parameters
     * Works with both hash-based routing and traditional query strings
     * @returns {string|null} Item ID or null if not found
     */
    function getItemIdFromUrl() {
        try {
            const match = window.location.href.match(/[\?&]id=([^&]+)/);
            return match ? match[1] : null;
        } catch {
            return null;
        }
    }

    /**
     * Fetch item by ID
     * @param {string} itemId - The item ID
     * @returns {Promise<Object|null>} The item object or null if not found
     */
    async function fetchItemById(itemId) {
        if (!itemId || !window.ApiClient || !window.ApiClient.getItem || !window.ApiClient.getCurrentUserId || !window.ApiClient._loggedIn) {
            return null;
        }

        try {
            const userId = window.ApiClient.getCurrentUserId();
            const item = await window.ApiClient.getItem(userId, itemId);
            return item;
        } catch (error) {
            WARN('Error fetching item:', error);
            return null;
        }
    }
    
    /**
     * Get current item from URL, using cache if available
     * @returns {Promise<Object|null>} The item object or null if not found
     */
    async function getCurrentItem() {
        const itemId = getItemIdFromUrl();
        
        // If no item ID, return null
        if (!itemId) {
            return null;
        }
        
        // If we have a cached item for this ID, return it
        if (cachedItem && cachedItemId === itemId) {
            return cachedItem;
        }
        
        // If a fetch is already in progress for this item, wait for it
        if (fetchInProgress && fetchItemId === itemId) {
            LOG('Fetch already in progress for this item, waiting for it to complete');
            return await fetchInProgress;
        }
        
        // Start a new fetch and store the promise
        fetchItemId = itemId;
        fetchInProgress = (async () => {
            try {
                LOG('Fetching item:', itemId);
                const item = await fetchItemById(itemId);
                cachedItem = item;
                cachedItemId = itemId;
                return item;
            } finally {
                // Clear the in-progress flag when done (only if still for this item)
                if (fetchItemId === itemId) {
                    fetchInProgress = null;
                    fetchItemId = null;
                }
            }
        })();
        
        LOG('Fetch in progress for item:', itemId);
        return await fetchInProgress;
    }

    /**
     * Notify all registered handlers of a view change
     * @param {string} view - The view name
     * @param {Element} element - The view element
     */
    function notifyHandlers(view, element, hash, previousHash) {
        // Clear cache when view changes to ensure fresh data
        const currentItemId = getItemIdFromUrl();
        if (cachedItemId !== currentItemId) {
            LOG('Clearing cache for new item:', currentItemId);
            cachedItem = null;
            cachedItemId = null;
            fetchInProgress = null; // Clear any in-progress fetch for previous item
            fetchItemId = null;
        }
        
        // Get the item promise once - will be shared across all handlers
        // The promise is cached/fetched by getCurrentItem(), ensuring only one API call
        const itemPromise = getCurrentItem();

        handlers.forEach((config) => {
            if (shouldCallHandler(config, view)) {
                try {
                    // Pass the promise as third parameter - handlers can await if needed
                    config.callback(view, element, hash, itemPromise, previousHash);
                } catch (err) {
                    ERR('Error in onViewPage handler:', err);
                }
            }
        });
    }
    
    /**
     * Check if a handler should be called for a given view
     * @param {Object} config - Handler configuration
     * @param {string} view - The view name
     * @returns {boolean} Whether the handler should be called
     */
    function shouldCallHandler(config, view) {
        const { pages, triggerOnSameHash = true } = config.options;
        
        if (state.previousHash === window.location.hash && !triggerOnSameHash) {
            return false;
        }

        // If no specific pages are specified, call for all pages
        if (pages.length === 0) return true;
        
        // Get current URL hash to determine actual page
        const currentUrl = window.location.hash;
        
        // Check if the current URL matches any of the specified pages
        return pages.some(page => {
            if (typeof page === 'string') {
                // Check if URL hash contains the page pattern
                return currentUrl.includes(`/${page}.html`) || currentUrl.includes(`/${page}`) || currentUrl.includes(page);
            } else if (page instanceof RegExp) {
                return page.test(currentUrl);
            }
            return false;
        });
    }
    
    /**
     * Get the current view name
     * @returns {string|null} Current view name or null if not available
     */
    function getCurrentView() {
        const hash = window.location.hash;
        if (hash) {
            // Extract page name from hash - match part after #/ and before ? or /
            // This handles both .html pages (old) and pages without .html (Jellyfin 10.11+)
            const pageMatch = hash.match(/#\/([^\/\?]+)/);
            if (pageMatch) {
                return pageMatch[1];
            }
        }
        
        return null;
    }
    
    /**
     * Get the number of registered handlers
     * @returns {number} Number of registered handlers
     */
    function getHandlerCount() {
        return handlers.length;
    }
    
    /**
     * Clear all handlers
     */
    function clearHandlers() {
        handlers.length = 0;
        LOG('Cleared all onViewPage handlers');
    }
    
    // Initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initialize);
    } else {
        initialize();
    }
    
    // ----- Custom menu links (placements: side / top main|right / userMenu) -----
    const customMenuLinkRegistry = [];
    let customMenuLinkObserver = null;
    const FAVORITES_HREF = '#/home?tab=1';
    const DEFAULT_CUSTOM_MENU_SELECTOR = '.customMenuOptions';
    const ADMIN_MENU_SELECTOR = '.adminMenuOptions';
    const USER_MENU_SELECTOR = '.userMenuOptions';

    function findByDataAttr(root, attr, value) {
        if (!root) return null;
        return Array.from(root.querySelectorAll(`[${attr}]`)).find(
            (el) => el.getAttribute(attr) === value
        ) || null;
    }

    function customMenuLinkKey(name, url, action) {
        const n = String(name || '').trim();
        const u = String(url || '').trim();
        if (u) return `${n}||${u}`;
        const a = String(action || '').trim();
        return `${n}||action:${a}`;
    }

    function entryKey(entry) {
        return customMenuLinkKey(entry?.name, entry?.url, entry?.action);
    }

    function normalizeTopNavigation(value) {
        const v = String(value || 'none').toLowerCase().trim();
        if (v === 'main' || v === 'right') return v;
        return 'none';
    }

    function parseVersionParts(version) {
        return String(version || '')
            .split(/[.+-]/)
            .filter(Boolean)
            .map((p) => {
                const n = parseInt(p, 10);
                return Number.isFinite(n) ? n : 0;
            });
    }

    function isJellyfinWebAtLeast12() {
        const version = window.ApiClient?._appVersion;
        if (version) {
            const parts = parseVersionParts(version);
            const major = parts[0] ?? 0;
            return major >= 12;
        }
        return !!(
            document.querySelector('.MuiDrawer-paper')
            || document.getElementById('app-user-menu')
            || document.querySelector(`.MuiStack-root a[href="${FAVORITES_HREF}"]`)
        );
    }

    function resolveWindowAction(path) {
        const parts = String(path || '').split('.').filter(Boolean);
        let cur = window;
        for (const part of parts) {
            if (cur == null) return null;
            cur = cur[part];
        }
        return typeof cur === 'function' ? cur : null;
    }

    function getCustomMenuLinkHref(entry) {
        if (entry?.action && String(entry.action).trim()) return '#';
        return String(entry?.url || '').trim() || '#';
    }

    function bindCustomMenuLinkActivation(el, entry) {
        if (!el || el.__kefinCmlBound) return;
        const actionPath = entry?.action && String(entry.action).trim();
        if (!actionPath) return;

        el.__kefinCmlBound = true;
        el.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            const fn = resolveWindowAction(actionPath);
            if (!fn) {
                WARN(`Custom menu link action not found or not a function: ${actionPath}`);
                return;
            }
            try {
                fn.call(null, e);
            } catch (err) {
                ERR(`Error running custom menu link action ${actionPath}:`, err);
            }
        });
    }

    function parseCustomMenuLinkOrder(value) {
        if (value == null || value === '') return undefined;
        const n = Number(value);
        return Number.isFinite(n) ? n : undefined;
    }

    function parseCustomMenuLinkOptions(fifthArg) {
        if (fifthArg && typeof fifthArg === 'object' && !Array.isArray(fifthArg)) {
            const action = fifthArg.action != null ? String(fifthArg.action).trim() : '';
            let containerSelector = DEFAULT_CUSTOM_MENU_SELECTOR;
            
            if (fifthArg.containerSelector) {
                containerSelector = fifthArg.containerSelector;
            } else if (fifthArg.isAdminLink) {
                containerSelector = ADMIN_MENU_SELECTOR;
            } else if (fifthArg.isUserLink) {
                containerSelector = USER_MENU_SELECTOR;
            }

            return {
                containerSelector: containerSelector,
                collapsed: !!fifthArg.collapsed,
                sideMenu: fifthArg.sideMenu !== false,
                topNavigation: normalizeTopNavigation(fifthArg.topNavigation),
                userMenu: !!fifthArg.userMenu,
                isAdminLink: !!fifthArg.isAdminLink,
                isUserLink: !!fifthArg.isUserLink,
                action: action || '',
                order: parseCustomMenuLinkOrder(fifthArg.order)
            };
        }

        return {
            containerSelector: typeof fifthArg === 'string' ? fifthArg : DEFAULT_CUSTOM_MENU_SELECTOR,
            collapsed: false,
            sideMenu: true,
            topNavigation: 'none',
            userMenu: false,
            isAdminLink: false,
            isUserLink: false,
            action: '',
            order: undefined
        };
    }

    async function isCurrentUserAdmin() {
        try {
            if (window.apiHelper && typeof window.apiHelper.isAdmin === 'function') {
                return !!(await window.apiHelper.isAdmin());
            }
            if (window.ApiClient && typeof window.ApiClient.getCurrentUser === 'function') {
                const user = await window.ApiClient.getCurrentUser();
                return !!(user && user.Policy && user.Policy.IsAdministrator === true);
            }
        } catch (err) {
            WARN('Could not determine admin status for custom menu link:', err);
        }
        return false;
    }

    function upsertCustomMenuLinkRegistry(entry) {
        const key = entryKey(entry);
        const idx = customMenuLinkRegistry.findIndex(e => entryKey(e) === key);
        if (idx >= 0) {
            customMenuLinkRegistry[idx] = entry;
        } else {
            customMenuLinkRegistry.push(entry);
        }
    }

    function findFavoritesDrawerLi() {
        const drawer = document.querySelector('.MuiDrawer-paper');
        if (!drawer) return null;
        const fav = drawer.querySelector(`a[href="${FAVORITES_HREF}"]`);
        if (!fav) return null;
        return fav.closest('li') || fav.parentElement;
    }

    function findTopNavStack() {
        const fav = document.querySelector(`.MuiStack-root a[href="${FAVORITES_HREF}"]`);
        if (!fav) return null;
        return fav.closest('.MuiStack-root');
    }

    function applyOpenInNewTab(anchor, openInNewTab) {
        if (!openInNewTab) return;
        anchor.setAttribute('rel', 'noopener noreferrer');
        anchor.setAttribute('target', '_blank');
    }

    function getNativeTopNavAnchor(stack) {
        if (!stack) return null;
        const fav = stack.querySelector(`a[href="${FAVORITES_HREF}"]`);
        if (fav && !fav.hasAttribute('data-kefin-custom-menu-top-link')) return fav;
        return Array.from(stack.querySelectorAll(':scope > a')).find(
            (a) => !a.hasAttribute('data-kefin-custom-menu-top-link')
                && !a.hasAttribute('data-kefin-custom-menu-more')
        ) || null;
    }

    function sanitizeClonedNavItem(root) {
        if (!root) return;
        const clear = (el) => {
            if (!el || !el.classList) return;
            el.classList.remove('Mui-selected', 'Mui-focusVisible', 'selected');
            el.removeAttribute('aria-current');
            el.removeAttribute('aria-selected');
        };
        clear(root);
        root.querySelectorAll('.Mui-selected, .Mui-focusVisible, [aria-current], [aria-selected]')
            .forEach(clear);
    }

    function applyMaterialIcon(root, iconName) {
        const icon = iconName || 'link';
        const existingMaterial = root.querySelector('.material-icons');
        if (existingMaterial) {
            existingMaterial.textContent = icon;
            return true;
        }

        const svg = root.querySelector('svg');
        if (svg) {
            const span = document.createElement('span');
            const svgClass = svg.getAttribute('class') || '';
            span.className = svgClass;
            if (!span.classList.contains('material-icons')) {
                span.classList.add('material-icons');
            }
            span.setAttribute('aria-hidden', svg.getAttribute('aria-hidden') || 'true');
            span.textContent = icon;
            svg.replaceWith(span);
            return true;
        }

        return false;
    }

    function applyAnchorLabel(anchor, name) {
        const primary = anchor.querySelector(
            '.MuiListItemText-primary, .MuiTypography-root, .navMenuOptionText'
        );
        if (primary) {
            primary.textContent = name;
            return;
        }

        const textNodes = [];
        const walker = document.createTreeWalker(anchor, NodeFilter.SHOW_TEXT);
        let node;
        while ((node = walker.nextNode())) {
            const parent = node.parentElement;
            if (!parent) continue;
            if (parent.closest('svg, .material-icons')) continue;
            if (!String(node.textContent || '').trim()) continue;
            textNodes.push(node);
        }
        if (!textNodes.length) {
            anchor.appendChild(document.createTextNode(name));
            return;
        }
        textNodes[textNodes.length - 1].textContent = name;
        for (let i = 0; i < textNodes.length - 1; i++) {
            textNodes[i].textContent = '';
        }
    }

    function retargetClonedAnchor(anchor, entry, dataAttr, key) {
        if (!anchor || !entry) return false;
        sanitizeClonedNavItem(anchor);
        anchor.href = getCustomMenuLinkHref(entry);
        anchor.setAttribute(dataAttr, key);
        anchor.removeAttribute('target');
        anchor.removeAttribute('rel');
        if (!entry.action) {
            applyOpenInNewTab(anchor, entry.openInNewTab);
        }
        applyMaterialIcon(anchor, entry.icon);
        applyAnchorLabel(anchor, entry.name);
        bindCustomMenuLinkActivation(anchor, entry);
        return true;
    }

    /**
     * Clone Favorites drawer <li> and retarget for a custom link.
     * @returns {HTMLElement|null}
     */
    function createMuiDrawerListItem(entry, referenceLi) {
        if (!referenceLi || !entry) return null;
        const referenceAnchor = referenceLi.querySelector('a');
        if (!referenceAnchor) return null;

        const key = entryKey(entry);
        const li = referenceLi.cloneNode(true);
        sanitizeClonedNavItem(li);
        li.setAttribute('data-kefin-custom-menu-link', key);

        const a = li.querySelector('a');
        if (!retargetClonedAnchor(a, entry, 'data-kefin-custom-menu-link', key)) {
            return null;
        }
        return li;
    }

    function injectIntoV12Drawer(entry) {
        const favLi = findFavoritesDrawerLi();
        if (!favLi || !favLi.parentElement) return false;

        const key = entryKey(entry);
        if (findByDataAttr(favLi.parentElement, 'data-kefin-custom-menu-link', key)) {
            return true;
        }

        let insertAfter = favLi;
        let next = favLi.nextElementSibling;
        while (next && next.querySelector?.('[data-kefin-custom-menu-link]')) {
            insertAfter = next;
            next = next.nextElementSibling;
        }

        const li = createMuiDrawerListItem(entry, favLi);
        if (!li) return false;
        insertAfter.insertAdjacentElement('afterend', li);
        return true;
    }

    /**
     * Clone a native top-nav <a> and retarget for a custom link.
     * @returns {HTMLElement|null}
     */
    function createMuiTopNavButton(entry, referenceAnchor) {
        if (!referenceAnchor || !entry) return null;

        const key = entryKey(entry);
        const a = referenceAnchor.cloneNode(true);
        if (!retargetClonedAnchor(a, entry, 'data-kefin-custom-menu-top-link', key)) {
            return null;
        }
        a.classList.add('kefin-custom-menu-top-link');
        return a;
    }

    function ensureTopNavDivider(stack) {
        let divider = stack.querySelector('[data-kefin-custom-menu-top-divider]');
        if (divider) return divider;

        divider = document.createElement('div');
        divider.className = 'kefin-custom-menu-top-divider';
        divider.setAttribute('data-kefin-custom-menu-top-divider', 'true');
        divider.setAttribute('role', 'separator');
        divider.setAttribute('aria-hidden', 'true');

        const anchors = Array.from(stack.querySelectorAll(':scope > a')).filter(
            a => !a.hasAttribute('data-kefin-custom-menu-top-link')
                && !a.hasAttribute('data-kefin-custom-menu-more')
        );
        const lastNative = anchors[anchors.length - 1];
        if (lastNative) {
            lastNative.insertAdjacentElement('afterend', divider);
        } else {
            stack.appendChild(divider);
        }
        return divider;
    }

    const USER_VIEW_OVERFLOW_MENU_ID = 'user-view-overflow-menu';

    function findNativeTopNavMoreButton(stack) {
        if (!stack) return null;
        const byAria = Array.from(
            stack.querySelectorAll(`button[aria-controls="${USER_VIEW_OVERFLOW_MENU_ID}"]`)
        ).find((btn) => !btn.hasAttribute('data-kefin-custom-menu-more'));
        if (byAria) return byAria;
        return Array.from(stack.querySelectorAll(':scope > button')).find(
            (btn) => !btn.hasAttribute('data-kefin-custom-menu-more')
                && /more/i.test((btn.textContent || '').trim())
        ) || null;
    }

    function findTopNavMoreButton(stack) {
        return findNativeTopNavMoreButton(stack)
            || stack?.querySelector('[data-kefin-custom-menu-more]')
            || null;
    }

    function getUserViewOverflowMenu() {
        return document.getElementById(USER_VIEW_OVERFLOW_MENU_ID);
    }

    function getUserViewOverflowMenuList(menuRoot = getUserViewOverflowMenu()) {
        if (!menuRoot) return null;
        return menuRoot.querySelector('ul[role="menu"]');
    }

    function isUserViewOverflowMenuOpen(menuRoot = getUserViewOverflowMenu()) {
        return !!(menuRoot && !menuRoot.classList.contains('MuiModal-hidden'));
    }

    function closeUserViewOverflowMenu() {
        const menu = getUserViewOverflowMenu();
        if (!menu) return;
        menu.classList.add('MuiModal-hidden');
        const kefinMore = document.querySelector('[data-kefin-custom-menu-more]');
        if (kefinMore) kefinMore.setAttribute('aria-expanded', 'false');
    }

    function openUserViewOverflowMenu(anchorBtn) {
        const menu = ensureUserViewOverflowMenu();
        if (!menu) return;
        menu.classList.remove('MuiModal-hidden');

        const paper = menu.querySelector('.MuiPopover-paper, .MuiMenu-paper');
        if (paper && anchorBtn) {
            const rect = anchorBtn.getBoundingClientRect();
            paper.style.top = `${Math.round(rect.bottom + 4)}px`;
            paper.style.left = `${Math.round(rect.left)}px`;
            paper.style.transformOrigin = '0px 0px 0px';
        }

        if (anchorBtn?.hasAttribute('data-kefin-custom-menu-more')) {
            anchorBtn.setAttribute('aria-expanded', 'true');
        }
    }

    function ensureUserViewOverflowMenu() {
        let menu = getUserViewOverflowMenu();
        if (menu) return menu;

        menu = document.createElement('div');
        menu.id = USER_VIEW_OVERFLOW_MENU_ID;
        menu.setAttribute('role', 'presentation');
        menu.className = 'MuiPopover-root MuiMenu-root MuiModal-root MuiModal-hidden';
        menu.setAttribute('data-kefin-custom-overflow-menu', 'true');

        const backdrop = document.createElement('div');
        backdrop.setAttribute('aria-hidden', 'true');
        backdrop.className = 'MuiBackdrop-root MuiBackdrop-invisible MuiModal-backdrop';

        const sentinelStart = document.createElement('div');
        sentinelStart.tabIndex = 0;
        sentinelStart.setAttribute('data-testid', 'sentinelStart');

        const paper = document.createElement('div');
        paper.className = 'MuiPaper-root MuiPaper-elevation MuiPaper-rounded MuiPaper-elevation8 MuiPopover-paper MuiMenu-paper';
        paper.tabIndex = -1;

        const list = document.createElement('ul');
        list.className = 'MuiList-root MuiList-padding MuiMenu-list';
        list.setAttribute('role', 'menu');
        list.tabIndex = -1;
        paper.appendChild(list);

        const sentinelEnd = document.createElement('div');
        sentinelEnd.tabIndex = 0;
        sentinelEnd.setAttribute('data-testid', 'sentinelEnd');

        menu.appendChild(backdrop);
        menu.appendChild(sentinelStart);
        menu.appendChild(paper);
        menu.appendChild(sentinelEnd);
        document.body.appendChild(menu);

        backdrop.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            closeUserViewOverflowMenu();
        });

        return menu;
    }

    function bindKefinMoreButtonToggle(moreBtn) {
        if (!moreBtn || moreBtn.__kefinMoreToggleBound) return;
        moreBtn.__kefinMoreToggleBound = true;

        moreBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            const menu = ensureUserViewOverflowMenu();
            if (isUserViewOverflowMenuOpen(menu)) {
                closeUserViewOverflowMenu();
            } else {
                openUserViewOverflowMenu(moreBtn);
            }
        });

        if (!window.__kefinCustomMenuMoreDocClickBound) {
            window.__kefinCustomMenuMoreDocClickBound = true;
            document.addEventListener('click', (e) => {
                const menu = getUserViewOverflowMenu();
                if (!menu || !menu.hasAttribute('data-kefin-custom-overflow-menu')) return;
                if (!isUserViewOverflowMenuOpen(menu)) return;
                const btn = document.querySelector('[data-kefin-custom-menu-more]');
                if (menu.contains(e.target) || (btn && btn.contains(e.target))) return;
                closeUserViewOverflowMenu();
            });
            document.addEventListener('keydown', (e) => {
                if (e.key !== 'Escape') return;
                const menu = getUserViewOverflowMenu();
                if (!menu || !menu.hasAttribute('data-kefin-custom-overflow-menu')) return;
                if (!isUserViewOverflowMenuOpen(menu)) return;
                closeUserViewOverflowMenu();
            });
        }
    }

    function createKefinTopNavMoreButton(stack) {
        // Prefer class list from Favorites top-nav link (includes emotion css-* tokens).
        const favAnchor = (stack && stack.querySelector(`a[href="${FAVORITES_HREF}"]`))
            || document.querySelector(`.MuiStack-root a[href="${FAVORITES_HREF}"]`)
            || getNativeTopNavAnchor(stack);

        const moreBtn = document.createElement('button');
        moreBtn.type = 'button';
        moreBtn.tabIndex = 0;
        if (favAnchor?.className) {
            moreBtn.className = favAnchor.className;
            sanitizeClonedNavItem(moreBtn);
        } else {
            moreBtn.className = 'MuiButtonBase-root MuiButton-root MuiButton-text MuiButton-textInherit MuiButton-sizeMedium MuiButton-textSizeMedium MuiButton-colorInherit';
        }
        moreBtn.setAttribute('data-kefin-custom-menu-more', 'true');
        moreBtn.setAttribute('aria-controls', USER_VIEW_OVERFLOW_MENU_ID);
        moreBtn.setAttribute('aria-haspopup', 'true');
        moreBtn.setAttribute('aria-expanded', 'false');
        moreBtn.appendChild(document.createTextNode('More'));

        const endIcon = document.createElement('span');
        endIcon.className = 'MuiButton-icon MuiButton-endIcon MuiButton-iconSizeMedium';
        endIcon.innerHTML = '<svg class="MuiSvgIcon-root MuiSvgIcon-fontSizeMedium" focusable="false" aria-hidden="true" viewBox="0 0 24 24" data-testid="ArrowDropDownIcon"><path d="m7 10 5 5 5-5z"></path></svg>';
        moreBtn.appendChild(endIcon);

        const ripple = document.createElement('span');
        ripple.className = 'MuiTouchRipple-root';
        moreBtn.appendChild(ripple);

        return moreBtn;
    }

    function removeLegacyKefinMorePopover() {
        const legacy = document.getElementById('kefin-custom-menu-more-popover');
        if (legacy) legacy.remove();
    }

    function ensureTopNavMoreButton(stack, divider) {
        removeLegacyKefinMorePopover();
        ensureCustomMenuLinkStyles();

        const nativeMore = findNativeTopNavMoreButton(stack);
        if (nativeMore) {
            // Native React More owns open/close and usually mounts the menu on demand.
            return nativeMore;
        }

        ensureUserViewOverflowMenu();

        let moreBtn = stack.querySelector('[data-kefin-custom-menu-more]');
        if (moreBtn) {
            bindKefinMoreButtonToggle(moreBtn);
            return moreBtn;
        }

        moreBtn = createKefinTopNavMoreButton(stack);
        bindKefinMoreButtonToggle(moreBtn);

        if (divider) {
            divider.insertAdjacentElement('beforebegin', moreBtn);
        } else {
            stack.appendChild(moreBtn);
        }
        return moreBtn;
    }

    function createOverflowMenuItem(entry, menuList, stack) {
        const key = entryKey(entry);
        const nativeItem = menuList.querySelector('a[role="menuitem"]:not([data-kefin-custom-menu-top-link])');
        if (nativeItem) {
            const item = nativeItem.cloneNode(true);
            if (!retargetClonedAnchor(item, entry, 'data-kefin-custom-menu-top-link', key)) {
                return null;
            }
            item.addEventListener('click', () => {
                closeUserViewOverflowMenu();
            });
            return item;
        }

        const stackRef = getNativeTopNavAnchor(stack);
        if (stackRef) {
            const item = stackRef.cloneNode(true);
            if (!retargetClonedAnchor(item, entry, 'data-kefin-custom-menu-top-link', key)) {
                return null;
            }
            item.setAttribute('role', 'menuitem');
            item.classList.add('MuiMenuItem-root', 'MuiMenuItem-gutters');
            item.addEventListener('click', () => {
                closeUserViewOverflowMenu();
            });
            return item;
        }

        const item = document.createElement('a');
        item.className = 'MuiButtonBase-root MuiMenuItem-root MuiMenuItem-gutters';
        item.setAttribute('role', 'menuitem');
        item.tabIndex = -1;
        item.href = getCustomMenuLinkHref(entry);
        item.setAttribute('data-kefin-custom-menu-top-link', key);
        if (!entry.action) {
            applyOpenInNewTab(item, entry.openInNewTab);
        }

        const icon = document.createElement('div');
        icon.className = 'MuiListItemIcon-root';
        const iconSpan = document.createElement('span');
        iconSpan.className = 'material-icons MuiSvgIcon-root MuiSvgIcon-fontSizeMedium';
        iconSpan.setAttribute('aria-hidden', 'true');
        iconSpan.textContent = entry.icon || 'link';
        icon.appendChild(iconSpan);

        const text = document.createElement('div');
        text.className = 'MuiListItemText-root';
        const span = document.createElement('span');
        span.className = 'MuiTypography-root MuiTypography-body1 MuiListItemText-primary';
        span.textContent = entry.name;
        text.appendChild(span);

        item.appendChild(icon);
        item.appendChild(text);
        bindCustomMenuLinkActivation(item, entry);
        item.addEventListener('click', () => {
            closeUserViewOverflowMenu();
        });
        return item;
    }

    function insertByMainOrder(parent, el, order) {
        const idx = Math.max(0, Math.floor(order));
        const ref = parent.children[idx];
        if (ref) parent.insertBefore(el, ref);
        else parent.appendChild(el);
    }

    function insertByRightOrder(parent, el, order) {
        const n = Math.max(0, Math.floor(order));
        if (isModernUI()) {
            if (n === 0) {
                parent.appendChild(el);
                return;
            }
            const idx = Math.max(0, parent.children.length - n);
            const ref = parent.children[idx];
            if (ref) parent.insertBefore(el, ref);
            else parent.insertBefore(el, parent.firstChild);
            return;
        }

        // Legacy headerRight: last two children are cast/user controls — keep them rightmost
        const reserved = 2;
        const idx = parent.children.length - reserved - n;
        if (idx <= 0) {
            parent.insertBefore(el, parent.firstChild);
            return;
        }
        const ref = parent.children[idx];
        if (ref) parent.insertBefore(el, ref);
        else parent.insertBefore(el, parent.firstChild);
    }

    function injectIntoTopNavV12(entry) {
        const stack = findTopNavStack();
        if (!stack) return false;

        const key = entryKey(entry);
        const hasOrder = Number.isFinite(entry.order);

        const divider = ensureTopNavDivider(stack);

        if (entry.collapsed) {
            ensureTopNavMoreButton(stack, divider);
            let menu = getUserViewOverflowMenu();
            if (!menu) {
                // Create shell only when we own the More button; otherwise wait for React.
                if (stack.querySelector('[data-kefin-custom-menu-more]')) {
                    menu = ensureUserViewOverflowMenu();
                } else {
                    return false;
                }
            }
            const menuList = getUserViewOverflowMenuList(menu);
            if (!menuList) return false;

            if (findByDataAttr(menuList, 'data-kefin-custom-menu-top-link', key)
                || findByDataAttr(menu, 'data-kefin-custom-menu-top-link', key)) {
                return true;
            }

            const item = createOverflowMenuItem(entry, menuList, stack);
            if (!item) return false;
            menuList.appendChild(item);
            return true;
        }

        if (findByDataAttr(stack, 'data-kefin-custom-menu-top-link', key)) {
            return true;
        }

        const btn = createMuiTopNavButton(entry, getNativeTopNavAnchor(stack));
        if (!btn) return false;

        if (hasOrder) {
            insertByMainOrder(stack, btn, entry.order);
            return true;
        }

        const moreBtn = findTopNavMoreButton(stack);
        if (moreBtn) {
            moreBtn.insertAdjacentElement('beforebegin', btn);
        } else {
            let insertAfter = divider;
            let next = divider.nextElementSibling;
            while (next && next.hasAttribute?.('data-kefin-custom-menu-top-link')) {
                insertAfter = next;
                next = next.nextElementSibling;
            }
            insertAfter.insertAdjacentElement('afterend', btn);
        }
        return true;
    }

    function findLegacyTabsSlider() {
        return document.querySelector('.headerTabs.sectionTabs .emby-tabs-slider')
            || document.querySelector('.emby-tabs-slider');
    }

    function getNativeLegacyTabButton(slider) {
        if (!slider) return null;
        return Array.from(slider.querySelectorAll('.emby-tab-button')).find(
            (btn) => !btn.hasAttribute('data-kefin-custom-menu-top-link')
        ) || null;
    }

    function injectIntoTopNavLegacyTabs(entry) {
        const slider = findLegacyTabsSlider();
        if (!slider) return false;

        const key = entryKey(entry);
        if (findByDataAttr(slider, 'data-kefin-custom-menu-top-link', key)) {
            return true;
        }

        const reference = getNativeLegacyTabButton(slider);
        if (!reference) return false;

        const btn = reference.cloneNode(true);
        sanitizeClonedNavItem(btn);
        btn.classList.remove('emby-tab-button-active');
        btn.removeAttribute('href');
        btn.setAttribute('data-kefin-custom-menu-top-link', key);
        btn.classList.add('kefin-custom-menu-top-link');

        let nextIndex = slider.children.length;
        let maxIndex = -1;
        for (const child of slider.children) {
            const v = parseInt(child.getAttribute('data-index'), 10);
            if (Number.isFinite(v) && v > maxIndex) maxIndex = v;
        }
        if (maxIndex >= 0) nextIndex = maxIndex + 1;
        btn.setAttribute('data-index', String(nextIndex));

        const foreground = btn.querySelector('.emby-button-foreground') || btn;
        if (foreground === btn) {
            btn.textContent = entry.name;
        } else {
            foreground.textContent = entry.name;
        }

        if (btn.tagName === 'A') {
            btn.href = getCustomMenuLinkHref(entry);
            if (!entry.action) {
                applyOpenInNewTab(btn, entry.openInNewTab);
            }
            bindCustomMenuLinkActivation(btn, entry);
        } else {
            bindCustomMenuLinkActivation(btn, entry);
            if (!entry.action) {
                btn.addEventListener('click', (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    const href = String(entry.url || '').trim();
                    if (!href) return;
                    if (entry.openInNewTab) {
                        window.open(href, '_blank', 'noopener,noreferrer');
                    } else if (href.startsWith('#')) {
                        window.location.hash = href.slice(1);
                    } else {
                        window.location.href = href;
                    }
                });
            }
        }

        if (Number.isFinite(entry.order)) {
            insertByMainOrder(slider, btn, entry.order);
        } else {
            slider.appendChild(btn);
        }
        return true;
    }

    function isModernUI() {
        return document.querySelector('.MuiBox-root') !== null;
    }

    function injectIntoTopNavMain(entry) {
        if (isModernUI()) {
            return injectIntoTopNavV12(entry);
        }
        return injectIntoTopNavLegacyTabs(entry);
    }

    function injectIntoTopNavRightLegacy(entry) {
        const headerRight = document.querySelector('.headerRight');
        if (!headerRight) return false;

        const key = entryKey(entry);
        if (findByDataAttr(headerRight, 'data-kefin-custom-menu-top-right', key)) {
            return true;
        }

        const button = document.createElement('button');
        button.type = 'button';
        button.setAttribute('is', 'paper-icon-button-light');
        button.className = 'headerButton headerButtonRight paper-icon-button-light kefin-custom-menu-top-right';
        button.title = entry.name;
        button.setAttribute('aria-label', entry.name);
        button.setAttribute('data-kefin-custom-menu-top-right', key);

        const iconSpan = document.createElement('span');
        iconSpan.className = `material-icons ${entry.icon || 'link'}`;
        iconSpan.setAttribute('aria-hidden', 'true');
        button.appendChild(iconSpan);

        bindCustomMenuLinkActivation(button, entry);
        if (!entry.action) {
            button.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                const href = String(entry.url || '').trim();
                if (!href) return;
                if (entry.openInNewTab) {
                    window.open(href, '_blank', 'noopener,noreferrer');
                } else if (href.startsWith('#')) {
                    window.location.hash = href.slice(1);
                } else {
                    window.location.href = href;
                }
            });
        }

        const searchButton = headerRight.querySelector('.headerSearchButton');
        if (Number.isFinite(entry.order)) {
            insertByRightOrder(headerRight, button, entry.order);
        } else if (searchButton) {
            headerRight.insertBefore(button, searchButton);
        } else {
            headerRight.appendChild(button);
        }
        return true;
    }

    function injectIntoTopNavRightV12(entry) {
        const search = document.querySelector('.headerRight a[href*="#/search"]')
            || document.querySelector('.MuiToolbar-root a[href*="#/search"]')
            || document.querySelector('a[href*="#/search"]');
        if (!search || !search.parentElement) return false;

        const parent = search.parentElement;
        const key = entryKey(entry);
        if (findByDataAttr(parent, 'data-kefin-custom-menu-top-right', key)
            || findByDataAttr(document, 'data-kefin-custom-menu-top-right', key)) {
            return true;
        }

        let el;
        if (search.tagName === 'A' || search.querySelector?.('a')) {
            const ref = search.tagName === 'A' ? search : search.querySelector('a');
            el = ref.cloneNode(true);
            sanitizeClonedNavItem(el);
            el.href = getCustomMenuLinkHref(entry);
            el.setAttribute('data-kefin-custom-menu-top-right', key);
            el.classList.add('kefin-custom-menu-top-right');
            el.title = entry.name;
            el.setAttribute('aria-label', entry.name);
            el.removeAttribute('target');
            el.removeAttribute('rel');
            if (!entry.action) {
                applyOpenInNewTab(el, entry.openInNewTab);
            }
            applyMaterialIcon(el, entry.icon || 'link');
            bindCustomMenuLinkActivation(el, entry);
        } else {
            el = document.createElement('button');
            el.type = 'button';
            el.className = search.className || '';
            el.classList.add('kefin-custom-menu-top-right');
            el.title = entry.name;
            el.setAttribute('aria-label', entry.name);
            el.setAttribute('data-kefin-custom-menu-top-right', key);
            const iconSpan = document.createElement('span');
            iconSpan.className = 'material-icons';
            iconSpan.setAttribute('aria-hidden', 'true');
            iconSpan.textContent = entry.icon || 'link';
            el.appendChild(iconSpan);
            bindCustomMenuLinkActivation(el, entry);
            if (!entry.action) {
                el.addEventListener('click', (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    const href = String(entry.url || '').trim();
                    if (!href) return;
                    if (entry.openInNewTab) {
                        window.open(href, '_blank', 'noopener,noreferrer');
                    } else if (href.startsWith('#')) {
                        window.location.hash = href.slice(1);
                    } else {
                        window.location.href = href;
                    }
                });
            }
        }

        if (Number.isFinite(entry.order)) {
            insertByRightOrder(parent, el, entry.order);
        } else {
            // Default: as first child of the parent element
            parent.insertBefore(el, parent.firstChild);
        }
        return true;
    }

    function injectIntoTopNavRight(entry) {
        if (isModernUI()) {
            return injectIntoTopNavRightV12(entry);
        }
        return injectIntoTopNavRightLegacy(entry);
    }

    function closeAppUserMenu() {
        const menu = document.getElementById('app-user-menu');
        if (!menu) return;
        const backdrop = menu.querySelector('.MuiBackdrop-root, .MuiModal-backdrop');
        if (backdrop) {
            backdrop.click();
            return;
        }
        document.dispatchEvent(new KeyboardEvent('keydown', {
            key: 'Escape',
            code: 'Escape',
            keyCode: 27,
            which: 27,
            bubbles: true
        }));
    }

    function getNativeUserMenuAnchor(menuList) {
        if (!menuList) return null;
        return Array.from(menuList.querySelectorAll('a[role="menuitem"]')).find(
            (a) => !a.hasAttribute('data-kefin-custom-user-menu-link')
                && !a.hasAttribute('data-kefintweaks-user-menu-config-button')
        ) || null;
    }

    function createAppUserMenuLink(entry, referenceAnchor) {
        if (!entry || !referenceAnchor) return null;

        const key = entryKey(entry);
        const link = referenceAnchor.cloneNode(true);
        if (!retargetClonedAnchor(link, entry, 'data-kefin-custom-user-menu-link', key)) {
            return null;
        }

        link.addEventListener('click', () => {
            closeAppUserMenu();
        });
        return link;
    }

    function getUserMenuDividers(menuList) {
        if (!menuList) return [];
        return Array.from(menuList.children).filter(
            (el) => el.matches && (el.matches('hr') || el.classList.contains('MuiDivider-root'))
        );
    }

    function injectIntoUserMenuV12(entry) {
        const appUserMenu = document.getElementById('app-user-menu');
        if (!appUserMenu) return false;

        const menuList = appUserMenu.querySelector('ul[role="menu"]');
        if (!menuList) return false;

        const key = entryKey(entry);
        const existing = findByDataAttr(menuList, 'data-kefin-custom-user-menu-link', key);
        if (existing) {
            // Upgrade hand-built items that lack MUI emotion classes
            if (/\bcss-/.test(existing.className)) {
                return true;
            }
            existing.remove();
        }

        const dividers = getUserMenuDividers(menuList);
        let insertBefore = null;
        let insertAfter = null;
        if (entry.isAdminLink) {
            // Admin section: before the second divider (fallback: last divider / Dashboard-adjacent)
            insertBefore = dividers[1] || dividers[dividers.length - 1] || null;
            if (!insertBefore) {
                const dashboardLink = menuList.querySelector('a[href="#/dashboard"]')
                    || menuList.querySelector('a[href*="#/dashboard"]');
                if (!dashboardLink) return false;
                let divider = dashboardLink.nextElementSibling;
                while (divider && !(divider.matches('hr') || divider.classList.contains('MuiDivider-root'))) {
                    divider = divider.nextElementSibling;
                }
                insertBefore = divider;
            }
        } else if (entry.isUserLink) {
            // User section: after the last divider
            insertAfter = dividers[dividers.length - 1] || null;
            if (!insertAfter) {
                const signOutButton = menuList.querySelector('a[href="#/signout"]')
                    || menuList.querySelector('a[href*="#/signout"]');
                if (!signOutButton) return false;
                insertAfter = signOutButton.previousElementSibling;
            }
        } else {
            // User section: before the first divider
            insertBefore = dividers[0] || null;
        }
        if (!insertBefore && !insertAfter) return false;

        const reference = getNativeUserMenuAnchor(menuList)
            || menuList.querySelector('a[role="menuitem"]');
        const link = createAppUserMenuLink(entry, reference);
        if (!link) return false;

        if (insertAfter) {
            insertAfter.after(link);
        } else {
            menuList.insertBefore(link, insertBefore);
        }
        return true;
    }

    function findPreferencesAdminSection() {
        return document.querySelector('.userPreferencesPage:not(.hide) .adminSection');
    }

    function findPreferencesDefaultSection() {
        const page = document.querySelector('.userPreferencesPage:not(.hide)')
            || document.querySelector('.userPreferencesPage');
        if (!page) return null;
        const withUsername = Array.from(page.querySelectorAll('.verticalSection')).find(
            (section) => section.querySelector('.headerUsername')
        );
        return withUsername || null;
    }

    function findPreferencesUserSection() {
        return document.querySelector('.userPreferencesPage:not(.hide) .userSection');
    }

    function createPreferencesUserMenuLink(entry) {
        const key = entryKey(entry);
        const link = document.createElement('a');
        link.setAttribute('data-ripple', 'false');
        link.href = getCustomMenuLinkHref(entry);
        link.style.cssText = 'display:block;padding:0;margin:0';
        link.className = 'listItem-border emby-button';
        link.setAttribute('data-kefin-custom-user-menu-link', key);

        if (!entry.action) {
            applyOpenInNewTab(link, entry.openInNewTab);
        }

        const iconName = entry.icon || 'link';
        link.innerHTML = `
            <div class="listItem">
                <span class="material-icons listItemIcon listItemIcon-transparent ${iconName}" aria-hidden="true"></span>
                <div class="listItemBody">
                    <div class="listItemBodyText"></div>
                </div>
            </div>
        `;
        const titleEl = link.querySelector('.listItemBodyText');
        if (titleEl) titleEl.textContent = entry.name;

        bindCustomMenuLinkActivation(link, entry);
        return link;
    }

    function injectIntoUserMenuLegacy(entry) {
        const section = entry.isUserLink ? findPreferencesUserSection() : entry.isAdminLink ? findPreferencesAdminSection() : findPreferencesDefaultSection();
        if (!section) return false;

        const key = entryKey(entry);
        if (findByDataAttr(section, 'data-kefin-custom-user-menu-link', key)) {
            return true;
        }

        const link = createPreferencesUserMenuLink(entry);
        const header = section.querySelector('.headerUsername');
        if (header) {
            header.after(link);
        } else {
            section.appendChild(link);
        }
        return true;
    }

    function injectIntoUserMenu(entry) {
        if (isModernUI()) {
            return injectIntoUserMenuV12(entry);
        }
        return injectIntoUserMenuLegacy(entry);
    }

    function injectOneCustomMenuLink(entry) {
        let anyOk = false;

        if (entry.sideMenu !== false) {
            const drawerOk = injectIntoV12Drawer(entry);
            const legacyContainer = document.querySelector(entry.containerSelector || DEFAULT_CUSTOM_MENU_SELECTOR);
            const legacyOk = legacyContainer ? addLinkToContainer(legacyContainer, entry) : false;
            anyOk = drawerOk || legacyOk || anyOk;
        }

        if (entry.topNavigation === 'main') {
            anyOk = injectIntoTopNavMain(entry) || anyOk;
        } else if (entry.topNavigation === 'right') {
            anyOk = injectIntoTopNavRight(entry) || anyOk;
        }

        if (entry.userMenu) {
            anyOk = injectIntoUserMenu(entry) || anyOk;
        }

        if (entry.topNavigation === 'main') {
            syncCustomTopNavActiveState();
        }

        return anyOk;
    }

    function reapplyAllCustomMenuLinks() {
        customMenuLinkRegistry.forEach((entry) => {
            try {
                injectOneCustomMenuLink(entry);
            } catch (err) {
                ERR('Error re-applying custom menu link:', entry?.name, err);
            }
        });
        syncCustomTopNavActiveState();
    }

    function parseNavHashParts(hash) {
        const raw = String(hash || '#/').replace(/^#/, '') || '/';
        const qIndex = raw.indexOf('?');
        const path = (qIndex >= 0 ? raw.slice(0, qIndex) : raw) || '/';
        const query = qIndex >= 0 ? raw.slice(qIndex + 1) : '';
        const params = new URLSearchParams(query);
        return { path: path.startsWith('/') ? path : `/${path}`, params };
    }

    function customTopNavHrefMatchScore(href, currentHash) {
        if (!href || /^https?:/i.test(href)) return -1;
        const targetHash = href.startsWith('#') ? href : `#${href}`;
        const current = parseNavHashParts(currentHash);
        const target = parseNavHashParts(targetHash);

        if (
            targetHash === currentHash
            || decodeURIComponent(targetHash) === decodeURIComponent(currentHash)
        ) {
            return 1000 + targetHash.length;
        }

        if (target.path !== current.path) return -1;

        for (const [key, value] of target.params.entries()) {
            if (current.params.get(key) !== value) return -1;
        }

        let score = 100 + targetHash.length;
        score += [...target.params.keys()].length * 10;

        if (target.path === '/home' && !target.params.has('tab') && current.params.has('tab')) {
            return -1;
        }

        return score;
    }

    function resolveCustomTopNavHref(el) {
        if (!el) return '';
        const attrHref = el.getAttribute('href');
        if (attrHref) return attrHref;
        const key = el.getAttribute('data-kefin-custom-menu-top-link');
        if (!key) return '';
        const entry = customMenuLinkRegistry.find((e) => entryKey(e) === key);
        return entry ? getCustomMenuLinkHref(entry) : '';
    }

    function syncCustomTopNavActiveState() {
        const links = Array.from(document.querySelectorAll('[data-kefin-custom-menu-top-link]'));
        if (!links.length) return;

        const currentHash = window.location.hash || '#/';
        const normalizedHash = currentHash.startsWith('#') ? currentHash : `#${currentHash}`;
        let bestScore = -1;
        const winners = [];

        links.forEach((el) => {
            el.classList.remove('active');
            const score = customTopNavHrefMatchScore(resolveCustomTopNavHref(el), normalizedHash);
            if (score < 0) return;
            if (score > bestScore) {
                bestScore = score;
                winners.length = 0;
                winners.push(el);
            } else if (score === bestScore) {
                winners.push(el);
            }
        });

        winners.forEach((el) => el.classList.add('active'));
    }

    let customTopNavActiveSyncBound = false;
    function ensureCustomTopNavActiveSync() {
        if (customTopNavActiveSyncBound) return;
        customTopNavActiveSyncBound = true;
        window.addEventListener('hashchange', syncCustomTopNavActiveState);
        onViewPage(() => {
            syncCustomTopNavActiveState();
        }, { pages: [] });
        syncCustomTopNavActiveState();
    }

    function ensureCustomMenuLinkObserver() {
        if (customMenuLinkObserver || typeof MutationObserver === 'undefined' || !document.body) {
            return;
        }

        let scheduled = false;
        customMenuLinkObserver = new MutationObserver(() => {
            if (scheduled) return;
            scheduled = true;
            requestAnimationFrame(() => {
                scheduled = false;
                reapplyAllCustomMenuLinks();
            });
        });

        customMenuLinkObserver.observe(document.body, {
            childList: true,
            subtree: true
        });
    }

    /**
     * Inject top-nav custom menu link styles once.
     */
    function ensureCustomMenuLinkStyles() {
        if (!document.getElementById('kefin-custom-menu-links-styles')) {
            const style = document.createElement('style');
            style.id = 'kefin-custom-menu-links-styles';
            style.textContent = `
.kefin-custom-menu-top-divider {
	width: 1px;
	align-self: stretch;
	margin: 0.5em 0.35em;
	flex-shrink: 0;
	background: currentColor;
	opacity: 0.25;
	height: 30px;
	align-self: center;
}
.kefin-custom-menu-top-divider:not(:has(+ *)) {
  display: none;
}
.kefin-custom-menu-top-link {
	text-transform: none;
	white-space: nowrap;
}
[data-kefin-custom-menu-top-link].active {
	display: inline-flex;
	-moz-box-align: center;
	align-items: center;
	-moz-box-pack: center;
	justify-content: center;
	position: relative;
	box-sizing: border-box;
	outline: 0;
	margin: 0;
	cursor: pointer;
	user-select: none;
	vertical-align: middle;
	appearance: none;
	text-decoration: none;
	font-family: "Noto Sans", sans-serif;
	font-weight: 500;
	font-size: 0.875rem;
	line-height: 1.75;
	text-transform: none;
	min-width: 64px;
	border: 0;
	border-radius: var(--jf-shape-borderRadius);
	padding: 6px 8px;
	color: var(--variant-textColor);
	background-color: var(--variant-textBg);
	--variant-textColor: var(--jf-palette-primary-main);
	--variant-outlinedColor: var(--jf-palette-primary-main);
	--variant-outlinedBorder: rgba(var(--jf-palette-primary-mainChannel) / 0.5);
	--variant-containedColor: var(--jf-palette-primary-contrastText);
	--variant-containedBg: var(--jf-palette-primary-main);
	transition: background-color 250ms cubic-bezier(0.4, 0, 0.2, 1), box-shadow 250ms cubic-bezier(0.4, 0, 0.2, 1), border-color 250ms cubic-bezier(0.4, 0, 0.2, 1);
}
.userPreferencesPage .readOnlyContent > * {
  display: flex;
  flex-direction: column; 
}
.userPreferencesPage .readOnlyContent > *:not(.userSection) > :not([data-kefin-custom-user-menu-link]) {
  order: -1;
}
`;
            (document.head || document.documentElement).appendChild(style);
        }

        // Explicit More-button styles (native emotion classes unavailable when More is absent)
        if (!document.getElementById('kefin-custom-menu-more-styles')) {
            const moreStyle = document.createElement('style');
            moreStyle.id = 'kefin-custom-menu-more-styles';
            moreStyle.textContent = `
button[data-kefin-custom-menu-more].MuiButtonBase-root {
	display: inline-flex;
	-moz-box-align: center;
	align-items: center;
	-moz-box-pack: center;
	justify-content: center;
	position: relative;
	box-sizing: border-box;
	outline: 0;
	margin: 0;
	cursor: pointer;
	user-select: none;
	vertical-align: middle;
	appearance: none;
	text-decoration: none;
	font-family: "Noto Sans", sans-serif;
	font-weight: 500;
	font-size: 0.875rem;
	line-height: 1.75;
	text-transform: none;
	min-width: 64px;
	border: 0;
	border-radius: var(--jf-shape-borderRadius);
	padding: 6px 8px;
	background-color: var(--variant-textBg);
	color: inherit;
	--variant-containedBg: var(--jf-palette-Button-inheritContainedBg);
	transition: background-color 250ms cubic-bezier(0.4, 0, 0.2, 1), box-shadow 250ms cubic-bezier(0.4, 0, 0.2, 1), border-color 250ms cubic-bezier(0.4, 0, 0.2, 1);
}
button[data-kefin-custom-menu-more] .MuiButton-icon {
	display: inherit;
	margin-right: -4px;
	margin-left: 8px;
}
button[data-kefin-custom-menu-more] .MuiTouchRipple-root {
	overflow: hidden;
	pointer-events: none;
	position: absolute;
	z-index: 0;
	inset: 0;
	border-radius: inherit;
}
button[data-kefin-custom-menu-more] .MuiSvgIcon-root {
	user-select: none;
	width: 1em;
	height: 1em;
	display: inline-block;
	flex-shrink: 0;
	transition: fill 300ms cubic-bezier(0.4, 0, 0.2, 1);
	fill: currentcolor;
	font-size: 20px;
}
`;
            (document.head || document.documentElement).appendChild(moreStyle);
        }

        // Kefin-owned overflow menu styles (only when we created #user-view-overflow-menu)
        if (!document.getElementById('kefin-custom-overflow-menu-styles')) {
            const overflowStyle = document.createElement('style');
            overflowStyle.id = 'kefin-custom-overflow-menu-styles';
            overflowStyle.textContent = `
#user-view-overflow-menu[data-kefin-custom-overflow-menu] {
	position: fixed;
	z-index: var(--jf-zIndex-modal);
	inset: 0;
}
#user-view-overflow-menu[data-kefin-custom-overflow-menu].MuiModal-hidden {
	visibility: hidden;
	pointer-events: none;
}
#user-view-overflow-menu[data-kefin-custom-overflow-menu] .MuiBackdrop-root {
	position: fixed;
	display: flex;
	-moz-box-align: center;
	align-items: center;
	-moz-box-pack: center;
	justify-content: center;
	inset: 0;
	background-color: transparent;
	z-index: -1;
}
#user-view-overflow-menu[data-kefin-custom-overflow-menu] .MuiPaper-root {
	background-color: var(--jf-palette-background-paper);
	color: var(--jf-palette-text-primary);
	border-radius: 4px;
	box-shadow: var(--Paper-shadow);
	background-image: var(--Paper-overlay);
	position: absolute;
	overflow: hidden auto;
	min-width: 16px;
	min-height: 16px;
	max-width: calc(100% - 32px);
	outline: 0;
	max-height: calc(100% - 96px);
	--Paper-shadow: var(--jf-shadows-8);
	--Paper-overlay: var(--jf-overlays-8);
	opacity: 0;
	transform: scale(0.75, 0.5625);
	transition: opacity 299ms cubic-bezier(0.4, 0, 0.2, 1), transform 199ms cubic-bezier(0.4, 0, 0.2, 1) 100ms;
	transform-origin: 0 0 0;
	visibility: hidden;
}
#user-view-overflow-menu[data-kefin-custom-overflow-menu]:not(.MuiModal-hidden) .MuiPaper-root {
	opacity: 1;
	visibility: visible;
	transform: none;
	transition: opacity 299ms cubic-bezier(0.4, 0, 0.2, 1), transform 199ms cubic-bezier(0.4, 0, 0.2, 1);
}
#user-view-overflow-menu[data-kefin-custom-overflow-menu] .MuiList-root {
	list-style: none;
	margin: 0;
	padding: 8px 0;
	position: relative;
	outline: 0;
}
#user-view-overflow-menu[data-kefin-custom-overflow-menu] .MuiButtonBase-root {
	background-color: transparent;
	outline: 0;
	border: 0;
	margin: 0;
	border-radius: 0;
	cursor: pointer;
	user-select: none;
	vertical-align: middle;
	appearance: none;
	color: inherit;
	font-family: "Noto Sans", sans-serif;
	font-weight: 400;
	font-size: 1rem;
	line-height: 1.5;
	display: flex;
	-moz-box-pack: start;
	justify-content: flex-start;
	-moz-box-align: center;
	align-items: center;
	position: relative;
	text-decoration: none;
	min-height: 48px;
	padding: 6px 16px;
	box-sizing: border-box;
	white-space: nowrap;
}
#user-view-overflow-menu[data-kefin-custom-overflow-menu] .MuiListItemIcon-root {
	color: var(--jf-palette-action-active);
	flex-shrink: 0;
	display: inline-flex;
}
#user-view-overflow-menu[data-kefin-custom-overflow-menu] .MuiSvgIcon-root,
#user-view-overflow-menu[data-kefin-custom-overflow-menu] .material-icons.MuiSvgIcon-root {
	user-select: none;
	width: 1em;
	height: 1em;
	display: inline-block;
	flex-shrink: 0;
	transition: fill 300ms cubic-bezier(0.4, 0, 0.2, 1);
	fill: currentcolor;
	font-size: 1.5rem;
}
#user-view-overflow-menu[data-kefin-custom-overflow-menu] .MuiTypography-root {
	margin: 0;
	font-family: "Noto Sans", sans-serif;
	font-weight: 400;
	font-size: 1rem;
	line-height: 1.5;
}
#user-view-overflow-menu[data-kefin-custom-overflow-menu] .MuiTouchRipple-root {
	overflow: hidden;
	pointer-events: none;
	position: absolute;
	z-index: 0;
	inset: 0;
	border-radius: inherit;
}
`;
            (document.head || document.documentElement).appendChild(overflowStyle);
        }

        removeLegacyKefinMorePopover();
    }

    /**
     * Add a custom menu link with per-link placements.
     * @param {string} name - Display name for the menu item
     * @param {string} icon - Material icon name
     * @param {string} [url] - URL to navigate to (optional when options.action is set)
     * @param {boolean} openInNewTab - Whether to open in new tab (default: false)
     * @param {string|Object} [containerSelectorOrOptions] - Legacy selector string, or options:
     *   { containerSelector, collapsed, sideMenu, topNavigation, userMenu, isAdminLink, isUserLink, action, order }
     * @returns {Promise<boolean>}
     */
    async function addCustomMenuLink(name, icon, url, openInNewTab = false, containerSelectorOrOptions = DEFAULT_CUSTOM_MENU_SELECTOR) {
        ensureCustomMenuLinkStyles();
        ensureCustomTopNavActiveSync();
        const options = parseCustomMenuLinkOptions(containerSelectorOrOptions);
        const trimmedUrl = url != null ? String(url).trim() : '';
        const action = options.action || '';

        if (!name || (!trimmedUrl && !action)) {
            WARN('addCustomMenuLink requires name and either url or action');
            return false;
        }

        if (options.isAdminLink) {
            const admin = await isCurrentUserAdmin();
            if (!admin) {
                LOG(`Skipping admin-only custom menu link (not admin): ${name}`);
                return false;
            }
        }

        let containerSelector = DEFAULT_CUSTOM_MENU_SELECTOR;
        if (options.containerSelector) {
            containerSelector = options.containerSelector;
        } else if (options.isAdminLink) {
            containerSelector = ADMIN_MENU_SELECTOR;
        } else if (options.isUserLink) {
            containerSelector = USER_MENU_SELECTOR;
        }

        const entry = {
            name,
            icon: icon || 'link',
            url: trimmedUrl,
            action,
            openInNewTab: !!openInNewTab,
            collapsed: !!options.collapsed,
            sideMenu: options.sideMenu !== false,
            topNavigation: options.topNavigation || 'none',
            userMenu: !!options.userMenu,
            isAdminLink: !!options.isAdminLink,
            isUserLink: !!options.isUserLink,
            order: options.order,
            containerSelector: containerSelector
        };

        // Explicit legacy selector (e.g. Configure → .adminMenuOptions): side-only path
        if (typeof containerSelectorOrOptions === 'string'
            && containerSelectorOrOptions !== DEFAULT_CUSTOM_MENU_SELECTOR) {
            entry.sideMenu = true;
            entry.topNavigation = 'none';
            entry.userMenu = false;
        }

        upsertCustomMenuLinkRegistry(entry);
        ensureCustomMenuLinkObserver();

        return new Promise((resolve) => {
            const success = injectOneCustomMenuLink(entry);
            if (success) {
                resolve(true);
                return;
            }
        });
    }

    /**
     * Add the link to the existing container
     * @param {Element} container - The custom menu options container
     * @param {Object} entry - Link entry
     * @returns {boolean} - True if successfully added
     */
    function addLinkToContainer(container, entry) {
        try {
            const name = entry.name;
            const icon = entry.icon || 'link';
            const key = entryKey(entry);

            if (findByDataAttr(container, 'data-kefin-custom-menu-link', key)) {
                return true;
            }

            const existingByText = Array.from(container.querySelectorAll('.navMenuOptionText'))
                .find(el => el.textContent === name);
            if (existingByText) {
                return true;
            }

            const link = document.createElement('a');
            link.className = 'emby-button navMenuOption lnkMediaFolder';
            link.dataset.name = String(name).toLowerCase().replace(/\s+/g, '-');

            const href = getCustomMenuLinkHref(entry);            
            link.href = href;

            link.setAttribute('data-kefin-custom-menu-link', key);

            if (!entry.action) {
                applyOpenInNewTab(link, entry.openInNewTab);
                if (isNativeJellyfinMenuHref(href)) {
                    link.setAttribute('is', 'emby-linkbutton');
                }
            }

            const iconSpan = document.createElement('span');
            iconSpan.className = `material-icons navMenuOptionIcon ${icon}`;
            iconSpan.setAttribute('aria-hidden', 'true');

            const textSpan = document.createElement('span');
            textSpan.className = 'navMenuOptionText';
            textSpan.textContent = name;

            link.appendChild(iconSpan);
            link.appendChild(textSpan);
            bindCustomMenuLinkActivation(link, entry);
            container.appendChild(link);

            LOG(`Successfully added custom menu link: ${name}`);
            return true;
        } catch (err) {
            ERR(`Error adding custom menu link ${entry?.name}:`, err);
            return false;
        }
    }

    /**
     * Waits for ApiClient to be available
     * @param {number} maxWaitMs - Maximum time to wait in milliseconds (default: 10000 = 10 seconds)
     * @param {number} checkInterval - Interval between checks in milliseconds (default: 100)
     * @returns {Promise<Object|null>} - ApiClient object or null if timeout
     */ 
    async function waitForApiClient(maxWaitMs = 5000, checkInterval = 100) {
        const startTime = Date.now();
        while (Date.now() - startTime < maxWaitMs) {
            await new Promise(resolve => setTimeout(resolve, checkInterval));
            if (window.ApiClient) {
                return window.ApiClient;
            }
        }
        return null;
    }

    /**
     * Waits for user to be logged in
     * @param {number} maxWaitMs - Maximum time to wait in milliseconds (default: 10000 = 10 seconds)
     * @param {number} checkInterval - Interval between checks in milliseconds (default: 500)
     * @returns {Promise<boolean>} - True if logged in, false if timeout
     */
    async function waitForLogin(maxWaitMs = 10000, checkInterval = 500) {
        const startTime = Date.now();
        
        while (Date.now() - startTime < maxWaitMs) {
            if (window.ApiClient && 
                window.ApiClient._loggedIn && 
                window.ApiClient.accessToken && 
                window.ApiClient.serverAddress) {
                try {
                    const token = window.ApiClient.accessToken();
                    if (token) {
                        LOG('User is logged in');
                        return true;
                    }
                } catch (e) {
                    // Token not available yet
                }
            }
            
            await new Promise(resolve => setTimeout(resolve, checkInterval));
        }
        
        WARN('Timeout waiting for user login');
        return false;
    }

    // Page-lifetime cache: normalized name/guid key → plugin Id
    const pluginIdCache = new Map();
    const JS_INJECTOR_ALIASES = ['JavaScript Injector', 'JS Injector'];

    function normalizePluginKey(value) {
        return String(value || '').trim().toLowerCase();
    }

    function looksLikeGuid(value) {
        return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(value || '').trim());
    }

    /**
     * Clear cached plugin id(s). Omit argument to clear all.
     * @param {string|string[]} [nameOrGuid]
     */
    function clearPluginIdCache(nameOrGuid) {
        if (nameOrGuid == null) {
            pluginIdCache.clear();
            return;
        }

        const keys = Array.isArray(nameOrGuid) ? nameOrGuid : [nameOrGuid];
        const idsToClear = new Set();

        for (const key of keys) {
            const normalized = normalizePluginKey(key);
            const cachedId = pluginIdCache.get(normalized);
            pluginIdCache.delete(normalized);
            if (cachedId) idsToClear.add(cachedId);
            if (looksLikeGuid(key)) idsToClear.add(String(key).trim());
        }

        if (idsToClear.size === 0) return;

        for (const [k, v] of [...pluginIdCache.entries()]) {
            if (idsToClear.has(v) || idsToClear.has(k)) {
                pluginIdCache.delete(k);
            }
        }
        for (const id of idsToClear) {
            pluginIdCache.delete(normalizePluginKey(id));
        }
    }

    /**
     * Resolve a Jellyfin plugin Id by name or GUID (cached for the page lifetime).
     * @param {string|string[]} nameOrGuid - Plugin name, GUID, or alias list tried in order
     * @returns {Promise<string|null>}
     */
    async function resolvePluginId(nameOrGuid) {
        const aliases = (Array.isArray(nameOrGuid) ? nameOrGuid : [nameOrGuid])
            .filter(a => a != null && String(a).trim() !== '');

        if (aliases.length === 0) {
            return null;
        }

        for (const alias of aliases) {
            const cached = pluginIdCache.get(normalizePluginKey(alias));
            if (cached) return cached;
        }

        const api = window.apiHelper;
        if (!api || typeof api.getPlugins !== 'function') {
            throw new Error('apiHelper.getPlugins is not available');
        }

        const pluginsData = await api.getPlugins();
        const pluginsList = Array.isArray(pluginsData) ? pluginsData : (pluginsData.Items || []);

        for (const alias of aliases) {
            const normalized = normalizePluginKey(alias);
            const isGuid = looksLikeGuid(alias);
            const plugin = pluginsList.find(p => {
                if (isGuid) return normalizePluginKey(p.Id) === normalized;
                return normalizePluginKey(p.Name) === normalized;
            });

            if (plugin && plugin.Id) {
                pluginIdCache.set(normalizePluginKey(plugin.Id), plugin.Id);
                for (const a of aliases) {
                    pluginIdCache.set(normalizePluginKey(a), plugin.Id);
                }
                return plugin.Id;
            }
        }

        return null;
    }

    async function fetchPluginConfigurationResponse(pluginId) {
        const server = ApiClient._serverAddress;
        return fetch(`${server}/Plugins/${pluginId}/Configuration`, {
            headers: { 'Authorization': getAuthHeader() }
        });
    }

    /**
     * GET /Plugins/{id}/Configuration for a plugin resolved by name or GUID.
     * On 404, clears cached id(s), re-resolves once, and retries once.
     * @param {string|string[]} nameOrGuid
     * @returns {Promise<Object>}
     */
    async function getPluginConfiguration(nameOrGuid) {
        let pluginId = await resolvePluginId(nameOrGuid);
        if (!pluginId) {
            throw new Error('Plugin not found');
        }

        let response = await fetchPluginConfigurationResponse(pluginId);

        if (response.status === 404) {
            clearPluginIdCache(nameOrGuid);
            clearPluginIdCache(pluginId);
            pluginId = await resolvePluginId(nameOrGuid);
            if (!pluginId) {
                throw new Error('Plugin not found after cache clear');
            }
            response = await fetchPluginConfigurationResponse(pluginId);
        }

        if (!response.ok) {
            throw new Error(`Failed to get plugin config: ${response.status} ${response.statusText}`);
        }

        return response.json();
    }

    /**
     * Saves the current KefinTweaksConfig back to JS Injector plugin
     * @param {Object} config - Optional config object to save. If not provided, uses window.KefinTweaksConfig
     * @param {Object} options - Options for saving
     * @param {boolean} options.waitForLogin - Whether to wait for login if not logged in (default: true)
     * @param {number} options.loginWaitTime - Maximum time to wait for login in ms (default: 10000)
     * @returns {Promise<boolean>} - Success status
     */
    async function saveConfigToJavaScriptInjector(config = null, options = {}) {
        try {
            const { waitForLogin: shouldWaitForLogin = true, loginWaitTime = 10000 } = options;
            
            // Check if ApiClient is available
            if (!window.ApiClient) {
                if (shouldWaitForLogin) {
                    LOG('ApiClient not available, waiting for initialization...');
                    const apiClient = await waitForApiClient(loginWaitTime);
                    if (!apiClient) {
                        WARN('ApiClient not available after waiting, cannot save config');
                        return false;
                    }
                } else {
                    throw new Error('ApiClient not available');
                }
            }
            
            // Check if user is logged in
            const isLoggedIn = window.ApiClient._loggedIn && 
                               window.ApiClient.accessToken && 
                               window.ApiClient.serverAddress;
            
            if (!isLoggedIn) {
                if (shouldWaitForLogin) {
                    LOG('User not logged in, waiting for login...');
                    const loggedIn = await waitForLogin(loginWaitTime);
                    if (!loggedIn) {
                        WARN('User not logged in after waiting, cannot save config');
                        return false;
                    }
                } else {
                    throw new Error('User not logged in');
                }
            }
            
            // Use provided config or fall back to window.KefinTweaksConfig
            const configToSave = config || window.KefinTweaksConfig;
            if (!configToSave) {
                throw new Error('No config provided and window.KefinTweaksConfig is not available');
            }

            const pluginId = await resolvePluginId(JS_INJECTOR_ALIASES);
            if (!pluginId) {
                WARN('JavaScript Injector plugin not found, cannot save config');
                return false;
            }

            const injectorConfig = await getPluginConfiguration(pluginId);
            const server = ApiClient._serverAddress;
            const configUrl = `${server}/Plugins/${pluginId}/Configuration`;
            
            // Ensure CustomJavaScripts array exists
            if (!injectorConfig.CustomJavaScripts) {
                injectorConfig.CustomJavaScripts = [];
            }
            
            // Create the script content
            const scriptContent = `// KefinTweaks Configuration
// This file is automatically generated by KefinTweaks Configuration UI
// Do not edit manually unless you know what you're doing

window.KefinTweaksConfig = ${JSON.stringify(configToSave, null, 2)};`;

            // Build / refresh KefinTweaks-injector preload entry (same POST)
            let injectorScriptContent = null;
            try {
                const resolvedOrSymbolic = configToSave.kefinTweaksRootResolved || configToSave.kefinTweaksRoot || '';
                const root = resolvedOrSymbolic.endsWith('/')
                    ? resolvedOrSymbolic
                    : resolvedOrSymbolic + '/';
                if (root && root !== '/') {
                    if (!window.KefinTweaksLoader) {
                        await new Promise((resolve, reject) => {
                            const url = `${root}scripts/kefinTweaks-loader.js`;
                            const existing = document.querySelector(`script[src="${url}"]`);
                            if (existing && window.KefinTweaksLoader) {
                                resolve();
                                return;
                            }
                            const script = document.createElement('script');
                            script.src = url;
                            script.async = false;
                            script.onload = () => resolve();
                            script.onerror = () => reject(new Error('Failed to load kefinTweaks-loader.js'));
                            document.head.appendChild(script);
                        });
                    }
                    const Loader = window.KefinTweaksLoader;
                    if (Loader) {
                        Loader.ensureKefinTweaksApi(Loader.SCRIPT_DEFINITIONS);
                        const major = await window.KefinTweaks.getJellyfinMajorVersion();
                        const planRoot = Loader.getResolvedKefinRoot
                            ? Loader.getResolvedKefinRoot(configToSave)
                            : root;
                        const plan = Loader.buildLoadPlan(configToSave, major, {
                            root: planRoot,
                            configOnly: configToSave.enabled === false
                        });
                        injectorScriptContent = Loader.buildInjectorScript(plan);
                        LOG(`Built KefinTweaks-injector (${plan.assets.length} assets, major=${major})`);
                    }
                }
            } catch (loaderErr) {
                WARN('Could not build KefinTweaks-injector entry:', loaderErr);
            }

            injectorConfig.CustomJavaScripts = (window.KefinTweaksLoader
                ? window.KefinTweaksLoader.upsertInjectorEntries(injectorConfig.CustomJavaScripts, {
                    configScriptContent: scriptContent,
                    injectorScriptContent: injectorScriptContent
                })
                : (() => {
                    // Fallback: Config-only upsert if loader unavailable
                    const list = injectorConfig.CustomJavaScripts || [];
                    const idx = list.findIndex((s) => s.Name === 'KefinTweaks-Config');
                    const entry = {
                        Name: 'KefinTweaks-Config',
                        Script: scriptContent,
                        Enabled: true,
                        RequiresAuthentication: false
                    };
                    if (idx !== -1) list[idx] = { ...list[idx], ...entry };
                    else list.push(entry);
                    return list;
                })());
            
            // Save the updated configuration
            const saveResponse = await fetch(configUrl, {
                method: 'POST',
                headers: {
                    'Authorization': getAuthHeader(),
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(injectorConfig)
            });
            
            if (!saveResponse.ok) {
                throw new Error(`Failed to save plugin config: ${saveResponse.statusText}`);
            }
            
            LOG('Successfully saved config (+ injector preload) to JS Injector plugin');
            return true;
        } catch (err) {
            ERR('Error saving config to JS Injector:', err);
            return false;
        }
    }

    let _watchlistTabIndex = null;

    async function fetchWatchlistTabIndex() {
        // Fetch the tab index as we do in addCustomMenuLink
        try {
            const response = await fetch(`${ApiClient._serverAddress}/CustomTabs/Config`, {
                method: "GET",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": getAuthHeader(),
                },
            });
            const data = await response.json();
            let tabIndex = null;
            data.forEach((tab, index) => {
                if (tab.ContentHtml.indexOf('sections watchlist') !== -1) {
                    tabIndex = index + 2;
                }
            });
            return tabIndex;
        } catch (err) {
            WARN('CustomTabs plugin not found.');
            return null;
        }
    }

	/**
	 * Get watchlist tab index, fetching if not yet set
	 * @returns {number|null} The watchlist tab index or null if not found
	 */
	async function getWatchlistTabIndex() {
		if (_watchlistTabIndex !== null) {
			return _watchlistTabIndex;
		}

        // Check if the tab index is already stored in local storage
        const storedTabIndex = localStorage.getItem(`kefinTweaks_watchlistTabIndex_${ApiClient.serverId()}`);
        if (storedTabIndex) {
            _watchlistTabIndex = Number(storedTabIndex);
            LOG('Loaded watchlist tab index from local storage:', _watchlistTabIndex);

            // Fetch tab in the background in case it has changed
            fetchWatchlistTabIndex();
            return _watchlistTabIndex;
        }

        _watchlistTabIndex = await fetchWatchlistTabIndex();

        // Save to local storage
        localStorage.setItem(`kefinTweaks_watchlistTabIndex_${ApiClient.serverId()}`, _watchlistTabIndex);
		return _watchlistTabIndex;
	}

    // ----- Custom pages (hash routes → .customPage in skinBody) -----
    const DISALLOWED_CUSTOM_PAGE_SEGMENTS = new Set([
        'home', 'shows', 'movies', 'list', 'playlists', 'collections', 'books', 'livetv', 'music'
    ]);
    /** @type {Map<string, { hrefPath: string, title: string, contentHtml: string, pageEl: HTMLElement|null, safeTitle: string }>} */
    const customPageRegistry = new Map();
    let customPageViewHandlerUnregister = null;
    let customPageHashChangeBound = false;
    /** @type {string|null} */
    let activeCustomPageTitle = null;
    let customPageTitleGuardObserver = null;
    let customPageTitleGuardApplying = false;

    function normalizeCustomPageHref(href) {
        let raw = String(href || '').trim();
        if (!raw) return null;
        if (!raw.startsWith('#')) raw = `#${raw}`;
        if (!raw.startsWith('#/')) raw = `#/${raw.slice(1).replace(/^\//, '')}`;
        // Path only (no query)
        const path = raw.split('?')[0];
        // Collapse trailing slash except "#/"
        const normalized = path.length > 2 && path.endsWith('/') ? path.slice(0, -1) : path;
        return normalized;
    }

    function getCustomPagePathFromHash(hash = window.location.hash) {
        const h = String(hash || '').split('?')[0];
        if (!h.startsWith('#/')) return null;
        const normalized = h.length > 2 && h.endsWith('/') ? h.slice(0, -1) : h;
        return normalized;
    }

    function getCustomPageSegment(hrefPath) {
        const match = String(hrefPath || '').match(/^#\/([^\/\?]+)/);
        return match ? match[1].toLowerCase() : null;
    }

    function isNativeJellyfinMenuHref(url) {
        const path = normalizeCustomPageHref(url);
        let segment = getCustomPageSegment(path);
        if (!segment) return false;
        if (segment.endsWith('.html')) segment = segment.slice(0, -5);
        return DISALLOWED_CUSTOM_PAGE_SEGMENTS.has(segment);
    }

    function slugifyCustomPageTitle(title) {
        const slug = String(title || 'page')
            .trim()
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-+|-+$/g, '');
        return slug || 'page';
    }

    /** Idempotent fallback if plugin did not early-inject #kefin-custom-page-styles. */
    function ensureCustomPageStyles() {
        if (document.getElementById('kefin-custom-page-styles')) return;
        const style = document.createElement('style');
        style.id = 'kefin-custom-page-styles';
        style.textContent = `
#reactRoot .skinBody:has(.customPage:not(.hide)) #fallbackPage {
	display: none;
}

#reactRoot:not(:has(.skinBody .customPage:not(.hide))) .pageTitle {
    display: none !important;
}

#reactRoot .skinBody:not(:has(.customPage:not(.hide))) #fallbackPage > * {
    display: none;
}

#reactRoot:not(:has(.skinBody .customPage:not(.hide))) #fallbackPage::after {
	content:'';
	display: inline-block;
	width: 20px;
	height: 20px;
	border: 3px solid #f3f3f3;
	border-top: 3px solid #4ecdc4;
	border-radius: 50%;
	animation: spin 1s linear infinite;  
	position: relative;
	left: 50%;
	transform: translateX(-50%);
	top: 1em;
}

`;
        (document.head || document.documentElement).appendChild(style);
    }

    function findCustomPageHost() {
        return document.querySelector('.skinBody:not(.mainAnimatedPages):has(.page:not(.hide))')
            || document.querySelector('.skinBody:not(.mainAnimatedPages)');
    }

    function applyCustomPageTitles(title) {
        const t = String(title || '').trim();
        if (!t) return;
        customPageTitleGuardApplying = true;
        try {
            try {
                document.title = t;
            } catch (_) { /* ignore */ }
            document.querySelectorAll('h3.pageTitle').forEach((el) => {
                if (el.textContent !== t) el.textContent = t;
            });
        } finally {
            customPageTitleGuardApplying = false;
        }
    }

    function customPageTitlesNeedSync(expected) {
        if (!expected) return false;
        if (document.title !== expected) return true;
        const pageTitles = document.querySelectorAll('h3.pageTitle');
        for (const el of pageTitles) {
            if (el.textContent !== expected) return true;
        }
        return false;
    }

    function stopCustomPageTitleGuard() {
        if (customPageTitleGuardObserver) {
            customPageTitleGuardObserver.disconnect();
            customPageTitleGuardObserver = null;
        }
        activeCustomPageTitle = null;
    }

    function ensureCustomPageTitleGuard(title) {
        const t = String(title || '').trim();
        if (!t) {
            stopCustomPageTitleGuard();
            return;
        }
        activeCustomPageTitle = t;
        applyCustomPageTitles(t);

        if (customPageTitleGuardObserver) return;

        const syncIfNeeded = () => {
            if (customPageTitleGuardApplying || !activeCustomPageTitle) return;
            if (customPageTitlesNeedSync(activeCustomPageTitle)) {
                applyCustomPageTitles(activeCustomPageTitle);
            }
        };

        customPageTitleGuardObserver = new MutationObserver(() => {
            syncIfNeeded();
        });

        const titleEl = document.querySelector('head > title') || (() => {
            const el = document.createElement('title');
            (document.head || document.documentElement).appendChild(el);
            return el;
        })();
        customPageTitleGuardObserver.observe(titleEl, {
            childList: true,
            characterData: true,
            subtree: true
        });

        // childList only: Jellyfin typically replaces pageTitle text via textContent (childList)
        const root = document.getElementById('reactRoot') || document.body || document.documentElement;
        if (root) {
            customPageTitleGuardObserver.observe(root, {
                childList: true,
                subtree: true
            });
        }

        document.querySelectorAll('h3.pageTitle').forEach((el) => {
            customPageTitleGuardObserver.observe(el, {
                childList: true,
                characterData: true,
                subtree: true
            });
        });
    }

    function reviveScriptsInRoot(root) {
        if (!root || root.getAttribute('data-kefin-scripts-revived') === 'true') return;
        const scripts = Array.from(root.querySelectorAll('script'));
        scripts.forEach((oldScript) => {
            const neo = document.createElement('script');
            Array.from(oldScript.attributes).forEach((attr) => {
                neo.setAttribute(attr.name, attr.value);
            });
            if (!oldScript.src) {
                neo.textContent = oldScript.textContent;
            }
            oldScript.parentNode.replaceChild(neo, oldScript);
        });
        root.setAttribute('data-kefin-scripts-revived', 'true');
    }

    function ensureCustomPageElement(entry) {
        if (entry.pageEl && document.body.contains(entry.pageEl)) {
            return entry.pageEl;
        }

        const existing = document.getElementById(`customPage-${entry.safeTitle}`);
        if (existing) {
            entry.pageEl = existing;
            return existing;
        }

        const host = findCustomPageHost();
        if (!host) return null;

        const page = document.createElement('div');
        page.id = `customPage-${entry.safeTitle}`;
        page.setAttribute('data-role', 'page');
        page.className = 'page customPage mainAnimatedPage libraryPage hide';
        page.setAttribute('data-title', entry.title);
        page.setAttribute('data-backbutton', 'true');
        page.setAttribute('data-menubutton', 'false');
        page.setAttribute('data-kefin-custom-page', entry.hrefPath);

        const padded = document.createElement('div');
        padded.className = 'padded-left padded-right';
        padded.innerHTML = entry.contentHtml || '';
        page.appendChild(padded);

        host.appendChild(page);
        // innerHTML does not execute scripts — re-create them in order once
        reviveScriptsInRoot(padded);
        entry.pageEl = page;
        return page;
    }

    function showCustomPageEntry(entry) {
        ensureCustomPageStyles();
        const page = ensureCustomPageElement(entry);
        if (!page) return false;
        page.classList.remove('hide');
        page.setAttribute('data-title', entry.title);
        ensureCustomPageTitleGuard(entry.title);
        return true;
    }

    function hideCustomPageEntry(entry) {
        let page = entry.pageEl;
        if (!page || !document.body.contains(page)) {
            page = document.getElementById(`customPage-${entry.safeTitle}`);
        }
        if (!page) {
            page = Array.from(document.querySelectorAll('[data-kefin-custom-page]')).find(
                (el) => el.getAttribute('data-kefin-custom-page') === entry.hrefPath
            ) || null;
        }
        if (!page) return;
        page.classList.add('hide');
        entry.pageEl = page;
    }

    function syncAllCustomPages() {
        const currentPath = getCustomPagePathFromHash();
        let matched = null;
        customPageRegistry.forEach((entry) => {
            if (currentPath && currentPath === entry.hrefPath) {
                matched = entry;
                showCustomPageEntry(entry);
            } else {
                hideCustomPageEntry(entry);
            }
        });
        if (!matched) {
            stopCustomPageTitleGuard();
        }
    }

    function syncCustomPagesAndTopNavActive() {
        syncAllCustomPages();
        syncCustomTopNavActiveState();
    }

    function ensureCustomPageViewHandler() {
        if (customPageViewHandlerUnregister) return;
        // onViewShow misses custom→custom hash changes (no real Jellyfin view);
        // hashchange covers those; both are fine when they double-fire.
        const unregView = onViewPage(() => {
            syncCustomPagesAndTopNavActive();
        }, { pages: [] });
        if (!customPageHashChangeBound) {
            window.addEventListener('hashchange', syncCustomPagesAndTopNavActive);
            customPageHashChangeBound = true;
        }
        customPageViewHandlerUnregister = () => {
            if (typeof unregView === 'function') unregView();
            if (customPageHashChangeBound) {
                window.removeEventListener('hashchange', syncCustomPagesAndTopNavActive);
                customPageHashChangeBound = false;
            }
        };
    }

    /**
     * Register a custom hash-route page rendered into .skinBody.
     * @param {string} href - e.g. "#/watchlist" (exact path match; query ignored)
     * @param {string} title - document / page title
     * @param {string} contentHtml - HTML string for the padded content area
     * @returns {Function|null} unregister function, or null if rejected
     */
    function addCustomPage(href, title, contentHtml) {
        const hrefPath = normalizeCustomPageHref(href);
        if (!hrefPath) {
            WARN('addCustomPage: invalid href');
            return null;
        }

        const segment = getCustomPageSegment(hrefPath);
        if (!segment || DISALLOWED_CUSTOM_PAGE_SEGMENTS.has(segment)) {
            WARN(`addCustomPage: disallowed route "${hrefPath}"`);
            return null;
        }

        if (contentHtml == null || typeof contentHtml !== 'string') {
            WARN('addCustomPage: contentHtml must be a string');
            return null;
        }

        const pageTitle = String(title || segment).trim() || segment;
        const safeTitle = slugifyCustomPageTitle(pageTitle);

        const existing = customPageRegistry.get(hrefPath);
        if (existing) {
            existing.title = pageTitle;
            existing.contentHtml = contentHtml;
            existing.safeTitle = safeTitle;
            // Do not rewrite innerHTML on update if page already mounted (JS may have rendered into it)
            if (existing.pageEl) {
                existing.pageEl.setAttribute('data-title', pageTitle);
            }
            ensureCustomPageViewHandler();
            syncAllCustomPages();
            return () => {
                const entry = customPageRegistry.get(hrefPath);
                if (!entry) return;
                hideCustomPageEntry(entry);
                customPageRegistry.delete(hrefPath);
                if (customPageRegistry.size === 0) {
                    stopCustomPageTitleGuard();
                    if (customPageViewHandlerUnregister) {
                        customPageViewHandlerUnregister();
                        customPageViewHandlerUnregister = null;
                    }
                } else {
                    syncAllCustomPages();
                }
            };
        }

        const entry = {
            hrefPath,
            title: pageTitle,
            contentHtml,
            pageEl: null,
            safeTitle
        };
        customPageRegistry.set(hrefPath, entry);
        ensureCustomPageStyles();
        ensureCustomPageViewHandler();
        syncAllCustomPages();

        LOG(`Registered custom page: ${hrefPath} ("${pageTitle}")`);

        return () => {
            const current = customPageRegistry.get(hrefPath);
            if (!current) return;
            hideCustomPageEntry(current);
            customPageRegistry.delete(hrefPath);
            if (customPageRegistry.size === 0) {
                stopCustomPageTitleGuard();
                if (customPageViewHandlerUnregister) {
                    customPageViewHandlerUnregister();
                    customPageViewHandlerUnregister = null;
                }
            } else {
                syncAllCustomPages();
            }
        };
    }

    // Expose utilities to global scope
    window.KefinTweaksUtils = {
        onViewPage,
        notifyHandlers,
        getCurrentView,
        getHandlerCount,
        clearHandlers,
        addCustomMenuLink,
        ensureCustomMenuLinkStyles,
        addCustomPage,
        saveConfigToJavaScriptInjector,
        resolvePluginId,
        getPluginConfiguration,
        clearPluginIdCache,
        getWatchlistTabIndex,
        waitForApiClient,
        waitForLogin
    };
    
    LOG('Initialized successfully');
    LOG('Available at window.KefinTweaksUtils');
})();
