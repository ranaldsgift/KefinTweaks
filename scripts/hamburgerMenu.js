// KefinTweaks Desktop Hamburger Menu (Jellyfin v12)
// Exposes a desktop Open Menu button + left drawer matching the native mobile nav.
// Requires: utils.js

(function () {
    'use strict';

    const LOG = (...args) => console.log('[KefinTweaks HamburgerMenu]', ...args);
    const WARN = (...args) => console.warn('[KefinTweaks HamburgerMenu]', ...args);
    const ERR = (...args) => console.error('[KefinTweaks HamburgerMenu]', ...args);

    const FAVORITES_HREF = '#/home?tab=1';
    const STYLE_ID = 'kefin-hamburger-menu-styles';
    const BTN_ATTR = 'data-kefin-desktop-hamburger';
    const DRAWER_ATTR = 'data-kefin-desktop-drawer';

    const FALLBACK_BTN_CLASS =
        'MuiButtonBase-root MuiIconButton-root MuiIconButton-colorInherit MuiIconButton-sizeLarge css-i2hxb6';
    const FALLBACK_SVG_CLASS = 'MuiSvgIcon-root MuiSvgIcon-fontSizeMedium css-iguwhy';
    const FALLBACK_LI_CLASS = 'MuiListItem-root MuiListItem-gutters css-1ohqk82';
    const FALLBACK_A_CLASS =
        'MuiButtonBase-root MuiListItemButton-root MuiListItemButton-gutters MuiListItemButton-root MuiListItemButton-gutters css-yknuxp';
    const FALLBACK_ICON_WRAP = 'MuiListItemIcon-root css-5pks8q';
    const FALLBACK_TEXT_WRAP = 'MuiListItemText-root css-t3p1a1';
    const FALLBACK_TEXT_PRIMARY =
        'MuiTypography-root MuiTypography-body1 MuiListItemText-primary css-pl8nxc';
    const FALLBACK_BRAND_ICON_WRAP = 'MuiListItemIcon-root css-c9a5tz';
    const FALLBACK_BRAND_TEXT_WRAP =
        'MuiListItemText-root MuiListItemText-multiline css-9ac84v';
    const FALLBACK_BRAND_PRIMARY =
        'MuiTypography-root MuiTypography-h6 MuiListItemText-primary css-1y7q0ly';
    const FALLBACK_BRAND_SECONDARY =
        'MuiTypography-root MuiTypography-body2 MuiListItemText-secondary css-xxlzys';

    let toolbarObserver = null;
    let openDrawerEl = null;
    let escapeHandler = null;
    let viewsCache = null;
    let viewsCacheAt = 0;

    LOG('Script loaded');

    function ensureStyles() {
        let style = document.getElementById(STYLE_ID);
        if (!style) {
            style = document.createElement('style');
            style.id = STYLE_ID;
            (document.head || document.documentElement).appendChild(style);
        }
        style.textContent = `
[${BTN_ATTR}] {
	position: fixed !important;
	left: 8px;
	top: 1px;
	z-index: 1200;
}
@media (max-width: 899px) {
	[${BTN_ATTR}] {
		display: none !important;
	}
}
.MuiDrawer-root[${DRAWER_ATTR}] {
	z-index: 1300;
	position: fixed;
	inset: 0px;
	z-index: var(--jf-zIndex-drawer);
}
.MuiDrawer-root[${DRAWER_ATTR}] .MuiBackdrop-root {
	opacity: 0;
	transition: opacity 225ms cubic-bezier(0.4, 0, 0.2, 1);
}
.MuiDrawer-root[${DRAWER_ATTR}][data-kefin-drawer-open="true"] .MuiBackdrop-root {
	opacity: 1;
	transition: opacity 225ms cubic-bezier(0.4, 0, 0.2, 1);
	position: fixed;
	display: flex;
	-moz-box-align: center;
	align-items: center;
	-moz-box-pack: center;
	justify-content: center;
	inset: 0px;
	background-color: rgba(0, 0, 0, 0.5);
	z-index: -1;
}
.MuiDrawer-root[${DRAWER_ATTR}] .MuiDrawer-paper {
	transform: translateX(-100%);
	transition: transform 225ms cubic-bezier(0, 0, 0.2, 1);
	outline: 0px;
	background-color: var(--jf-palette-background-paper);
	color: var(--jf-palette-text-primary);
	box-shadow: var(--Paper-shadow);
	background-image: var(--Paper-overlay);
	overflow-y: auto;
	display: flex;
	flex-direction: column;
	height: 100%;
	width: 280px;
	max-width: 100%;
	flex: 1 0 auto;
	z-index: var(--jf-zIndex-drawer);
	position: fixed;
	top: 0px;
	left: 0px;
}
.MuiDrawer-root[${DRAWER_ATTR}][data-kefin-drawer-open="true"] .MuiDrawer-paper {
	transform: none;
}
[${DRAWER_ATTR}] .MuiListItem-root.MuiListItem-gutters.css-1ohqk82 {
	display: flex;
	-moz-box-pack: start;
	justify-content: flex-start;
	-moz-box-align: center;
	align-items: center;
	position: relative;
	text-decoration: none;
	width: 100%;
	box-sizing: border-box;
	text-align: left;
}
[${DRAWER_ATTR}] .MuiList-root {
	list-style: none;
	margin: 0px;
	padding-right: 0px;
	padding-left: 0px;
	position: relative;
	padding-bottom: 8px;
	padding-top: calc(0 * var(--jf-spacing));
}
[${DRAWER_ATTR}] .MuiTypography-root {
	margin: 0px;
	font-family: "Noto Sans", sans-serif;
	font-weight: 400;
	font-size: 1rem;
	line-height: 1.5;
	color: var(--jf-palette-text-primary);
}
[${DRAWER_ATTR}] .MuiButtonBase-root.MuiListItemButton-root.MuiListItemButton-gutters {
	background-color: transparent;
	outline: 0px;
	border: 0px;
	margin: 0px;
	border-radius: 0px;
	cursor: pointer;
	user-select: none;
	vertical-align: middle;
	appearance: none;
	color: inherit;
	display: flex;
	-moz-box-flex: 1;
	flex-grow: 1;
	-moz-box-pack: start;
	justify-content: flex-start;
	-moz-box-align: center;
	align-items: center;
	position: relative;
	text-decoration: none;
	min-width: 0px;
	box-sizing: border-box;
	text-align: left;
	padding: 8px 16px;
	transition: background-color 150ms cubic-bezier(0.4, 0, 0.2, 1);
}
[${DRAWER_ATTR}] .MuiButtonBase-root.MuiListItemButton-root.Mui-selected {
	background-color: var(--jf-palette-action-selected, rgba(255, 255, 255, 0.08));
}
[${DRAWER_ATTR}] .MuiButtonBase-root:first-child {
	color: var(--jf-palette-action-active);
	flex-shrink: 0;
	display: inline-flex;
	min-width: 36px;
}
[${DRAWER_ATTR}] .MuiBox-root {
	height: 2.5rem;
}
[${DRAWER_ATTR}] .MuiListItemIcon-root:last-child,
[${DRAWER_ATTR}] .MuiListItemIcon-root.css-c9a5tz {
	color: var(--jf-palette-action-active);
	flex-shrink: 0;
	display: inline-flex;
	min-width: 56px;
}
[${DRAWER_ATTR}] a:hover {
  background: #4e4e4e !important;
}
`;
    }

    function findDesktopToolbar() {
        const toolbars = document.querySelectorAll('.MuiToolbar-root.MuiToolbar-dense');
        for (const toolbar of toolbars) {
            if (toolbar.querySelector(`:scope > button[aria-label="Open Menu"]`)) continue;
            if (toolbar.querySelector(`:scope > [${BTN_ATTR}]`)) return toolbar;
            const hasFavorites = toolbar.querySelector(`.MuiStack-root a[href="${FAVORITES_HREF}"]`);
            if (hasFavorites) return toolbar;
        }
        return null;
    }

    function findNativeOpenMenuButton() {
        return document.querySelector('button[aria-label="Open Menu"]:not([data-kefin-desktop-hamburger])');
    }

    function menuIconSvg(className) {
        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.setAttribute('class', className || FALLBACK_SVG_CLASS);
        svg.setAttribute('focusable', 'false');
        svg.setAttribute('aria-hidden', 'true');
        svg.setAttribute('viewBox', '0 0 24 24');
        svg.setAttribute('data-testid', 'MenuIcon');
        const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        path.setAttribute('d', 'M3 18h18v-2H3zm0-5h18v-2H3zm0-7v2h18V6z');
        svg.appendChild(path);
        return svg;
    }

    function materialSvg(testId, pathD, className) {
        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.setAttribute('class', className || FALLBACK_SVG_CLASS);
        svg.setAttribute('focusable', 'false');
        svg.setAttribute('aria-hidden', 'true');
        svg.setAttribute('viewBox', '0 0 24 24');
        if (testId) svg.setAttribute('data-testid', testId);
        const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        path.setAttribute('d', pathD);
        svg.appendChild(path);
        return svg;
    }

    const ICONS = {
        home: {
            testId: 'HomeIcon',
            d: 'M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z'
        },
        favorite: {
            testId: 'FavoriteIcon',
            d: 'm12 21.35-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54z'
        },
        tv: {
            testId: 'TvIcon',
            d: 'M21 3H3c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h5v2h8v-2h5c1.1 0 1.99-.9 1.99-2L23 5c0-1.1-.9-2-2-2m0 14H3V5h18z'
        },
        folder: {
            testId: 'FolderIcon',
            d: 'M10 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8z'
        },
        queue: {
            testId: 'QueueIcon',
            d: 'M4 6H2v14c0 1.1.9 2 2 2h14v-2H4zm16-4H8c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2m-1 9h-4v4h-2v-4H9V9h4V5h2v4h4z'
        },
        movie: {
            testId: 'MovieIcon',
            d: 'm18 4 2 4h-3l-2-4h-2l2 4h-3l-2-4H8l2 4H7L5 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V4zm-6.75 11.25L10 18l-1.25-2.75L6 14l2.75-1.25L10 10l1.25 2.75L14 14z'
        },
        music: {
            testId: 'LibraryMusicIcon',
            d: 'M20 2H8c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2m-2 5h-3v5.5c0 1.38-1.12 2.5-2.5 2.5S10 13.88 10 12.5s1.12-2.5 2.5-2.5c.57 0 1.08.19 1.5.5V5h4zM2 6v14c0 1.1.9 2 2 2h14v-2H4V6z'
        },
        livetv: {
            testId: 'LiveTvIcon',
            d: 'M21 6h-7.59l3.29-3.29L16 2l-4 4-4-4-.71.71L10.59 6H3c-1.1 0-2 .89-2 2v12c0 1.1.9 2 2 2h18c1.1 0 2-.9 2-2V8c0-1.11-.9-2-2-2m0 14H3V8h18zM9 10v8l7-4z'
        }
    };

    function createHamburgerButton() {
        const native = findNativeOpenMenuButton();
        let btn;
        if (native) {
            btn = native.cloneNode(true);
            btn.querySelectorAll('.MuiTouchRipple-root').forEach((el) => el.remove());
        } else {
            btn = document.createElement('button');
            btn.type = 'button';
            btn.className = FALLBACK_BTN_CLASS;
            btn.tabIndex = 0;
            btn.setAttribute('aria-label', 'Open Menu');
            btn.appendChild(menuIconSvg());
        }
        btn.setAttribute(BTN_ATTR, 'true');
        btn.type = 'button';
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            openDrawer();
        });
        return btn;
    }

    function ensureHamburgerButton() {
        ensureStyles();
        const toolbar = findDesktopToolbar();
        if (!toolbar) return false;

        let btn = toolbar.querySelector(`[${BTN_ATTR}]`);
        if (btn) return true;

        btn = createHamburgerButton();
        toolbar.insertBefore(btn, toolbar.firstChild);
        return true;
    }

    function getServerDisplayName() {
        try {
            const brand = document.querySelector(
                `.MuiToolbar-root .MuiStack-root > a[href="#/"], .MuiToolbar-root .MuiStack-root > a[href="#/home"]`
            );
            if (brand) {
                const text = Array.from(brand.childNodes)
                    .filter((n) => n.nodeType === Node.TEXT_NODE)
                    .map((n) => n.textContent.trim())
                    .filter(Boolean)
                    .join(' ');
                if (text) return text;
            }
        } catch (_) { /* ignore */ }
        try {
            return window.ApiClient?.serverName?.() || window.ApiClient?._serverInfo?.Name || 'Jellyfin';
        } catch (_) {
            return 'Jellyfin';
        }
    }

    function getServerVersionLabel() {
        try {
            const v = window.ApiClient?._serverVersion || window.ApiClient?.serverVersion?.();
            if (v) {
                const m = String(v).match(/^(\d+\.\d+)/);
                return m ? m[1] : String(v);
            }
        } catch (_) { /* ignore */ }
        return '';
    }

    function getBrandIconSrc() {
        const img = document.querySelector(
            `.MuiToolbar-root .MuiStack-root a[href="#/"] img, .MuiToolbar-root .MuiStack-root a[href="#/home"] img`
        );
        return img?.getAttribute('src') || null;
    }

    function libraryHref(item) {
        const serverId = window.ApiClient?.serverId?.() || '';
        const id = item.Id;
        const type = String(item.CollectionType || '').toLowerCase();
        switch (type) {
            case 'movies':
                return `#/movies?topParentId=${id}&collectionType=movies`;
            case 'tvshows':
                return `#/tv?topParentId=${id}&collectionType=tvshows`;
            case 'music':
                return `#/music?topParentId=${id}&collectionType=music`;
            case 'playlists':
                return `#/playlists?topParentId=${id}&collectionType=playlists`;
            case 'livetv':
                return `#/livetv?collectionType=livetv`;
            case 'boxsets':
                return `#/list?parentId=${id}&serverId=${serverId}`;
            default:
                return `#/list?parentId=${id}&serverId=${serverId}`;
        }
    }

    function libraryIconKey(item) {
        switch (String(item.CollectionType || '').toLowerCase()) {
            case 'movies':
                return 'movie';
            case 'tvshows':
                return 'tv';
            case 'music':
                return 'music';
            case 'playlists':
                return 'queue';
            case 'livetv':
                return 'livetv';
            default:
                return 'folder';
        }
    }

    async function fetchUserViews() {
        const now = Date.now();
        if (viewsCache && now - viewsCacheAt < 60000) return viewsCache;
        if (!window.ApiClient?.getUserViews) {
            WARN('ApiClient.getUserViews not available');
            return [];
        }
        try {
            const userId = window.ApiClient.getCurrentUserId();
            const result = await window.ApiClient.getUserViews({}, userId);
            viewsCache = Array.isArray(result?.Items) ? result.Items : [];
            viewsCacheAt = now;
            return viewsCache;
        } catch (e) {
            ERR('Failed to fetch UserViews', e);
            return [];
        }
    }

    function getCurrentNavHash() {
        const hash = window.location.hash || '#/';
        return hash.startsWith('#') ? hash : `#${hash}`;
    }

    function parseHashParts(hash) {
        const raw = String(hash || '#/').replace(/^#/, '') || '/';
        const qIndex = raw.indexOf('?');
        const path = (qIndex >= 0 ? raw.slice(0, qIndex) : raw) || '/';
        const query = qIndex >= 0 ? raw.slice(qIndex + 1) : '';
        const params = new URLSearchParams(query);
        return { path: path.startsWith('/') ? path : `/${path}`, params };
    }

    function hrefMatchScore(href, currentHash) {
        if (!href || /^https?:/i.test(href)) return -1;
        const targetHash = href.startsWith('#') ? href : `#${href}`;
        const current = parseHashParts(currentHash);
        const target = parseHashParts(targetHash);

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

        // Prefer more specific links (more query params / longer href)
        let score = 100 + targetHash.length;
        score += [...target.params.keys()].length * 10;

        // Home without tab should not win over Favorites (?tab=1)
        if (target.path === '/home' && !target.params.has('tab') && current.params.has('tab')) {
            return -1;
        }

        return score;
    }

    function applySelectedState(drawerRoot) {
        if (!drawerRoot) return;
        const currentHash = getCurrentNavHash();
        const links = Array.from(drawerRoot.querySelectorAll('.MuiDrawer-paper a[href]'));
        let best = null;
        let bestScore = -1;
        links.forEach((a) => {
            a.classList.remove('Mui-selected');
            a.removeAttribute('aria-current');
            const score = hrefMatchScore(a.getAttribute('href') || '', currentHash);
            if (score > bestScore) {
                bestScore = score;
                best = a;
            }
        });
        if (best && bestScore >= 0) {
            best.classList.add('Mui-selected');
            best.setAttribute('aria-current', 'page');
        }
    }

    function createListItem({ href, label, iconKey, brand, secondary, imgSrc }) {
        const li = document.createElement('li');
        li.className = FALLBACK_LI_CLASS;

        const a = document.createElement('a');
        a.className = FALLBACK_A_CLASS;
        a.tabIndex = 0;
        a.href = href;

        const iconWrap = document.createElement('div');
        iconWrap.className = brand ? FALLBACK_BRAND_ICON_WRAP : FALLBACK_ICON_WRAP;

        if (imgSrc) {
            const img = document.createElement('img');
            img.className = 'MuiBox-root css-1j3tjfb';
            img.src = imgSrc;
            img.alt = '';
            iconWrap.appendChild(img);
        } else if (iconKey && ICONS[iconKey]) {
            iconWrap.appendChild(materialSvg(ICONS[iconKey].testId, ICONS[iconKey].d));
        }

        const textWrap = document.createElement('div');
        if (brand) {
            textWrap.className = FALLBACK_BRAND_TEXT_WRAP;
            const h6 = document.createElement('h6');
            h6.className = FALLBACK_BRAND_PRIMARY;
            h6.textContent = label;
            textWrap.appendChild(h6);
            if (secondary) {
                const p = document.createElement('p');
                p.className = FALLBACK_BRAND_SECONDARY;
                p.textContent = secondary;
                textWrap.appendChild(p);
            }
        } else {
            textWrap.className = FALLBACK_TEXT_WRAP;
            const span = document.createElement('span');
            span.className = FALLBACK_TEXT_PRIMARY;
            span.textContent = label;
            textWrap.appendChild(span);
        }

        a.appendChild(iconWrap);
        a.appendChild(textWrap);
        a.addEventListener('click', () => {
            // Allow navigation; close drawer shortly after
            setTimeout(closeDrawer, 0);
        });
        li.appendChild(a);
        return li;
    }

    function buildDrawerShell(mainList, librariesList) {
        const root = document.createElement('div');
        root.setAttribute('role', 'presentation');
        root.className = 'MuiDrawer-root MuiDrawer-anchorLeft MuiDrawer-modal MuiModal-root css-k3j2mn';
        root.setAttribute(DRAWER_ATTR, 'true');

        const backdrop = document.createElement('div');
        backdrop.setAttribute('aria-hidden', 'true');
        backdrop.className = 'MuiBackdrop-root MuiModal-backdrop css-14dl35y';
        backdrop.addEventListener('click', closeDrawer);

        const sentinelStart = document.createElement('div');
        sentinelStart.tabIndex = 0;
        sentinelStart.setAttribute('data-testid', 'sentinelStart');

        const paper = document.createElement('div');
        paper.className =
            'MuiPaper-root MuiPaper-elevation MuiPaper-elevation16 MuiDrawer-paper MuiDrawer-paperAnchorLeft css-epnusv';
        paper.tabIndex = -1;
        paper.style.setProperty('--Paper-shadow', 'var(--jf-shadows-16)');
        paper.style.setProperty('--Paper-overlay', 'var(--jf-overlays-16)');

        const box = document.createElement('div');
        box.className = 'MuiBox-root css-0';
        box.setAttribute('role', 'presentation');

        box.appendChild(mainList);

        const hr = document.createElement('hr');
        hr.className = 'MuiDivider-root MuiDivider-fullWidth css-14093q0';
        box.appendChild(hr);
        box.appendChild(librariesList);

        paper.appendChild(box);

        const sentinelEnd = document.createElement('div');
        sentinelEnd.tabIndex = 0;
        sentinelEnd.setAttribute('data-testid', 'sentinelEnd');

        root.appendChild(backdrop);
        root.appendChild(sentinelStart);
        root.appendChild(paper);
        root.appendChild(sentinelEnd);
        return root;
    }

    async function buildDrawer() {
        const mainList = document.createElement('ul');
        mainList.className = 'MuiList-root MuiList-padding css-hbss32';

        const serverName = getServerDisplayName();
        const version = getServerVersionLabel();
        const brandSrc = getBrandIconSrc();

        mainList.appendChild(
            createListItem({
                href: '#/',
                label: serverName,
                brand: true,
                secondary: version || undefined,
                imgSrc: brandSrc
            })
        );
        mainList.appendChild(
            createListItem({ href: '#/home', label: 'Home', iconKey: 'home' })
        );
        mainList.appendChild(
            createListItem({ href: FAVORITES_HREF, label: 'Favorites', iconKey: 'favorite' })
        );

        const librariesList = document.createElement('ul');
        librariesList.className = 'MuiList-root MuiList-padding MuiList-subheader css-q9gyaw';
        librariesList.setAttribute('aria-labelledby', 'libraries-subheader');

        const subheader = document.createElement('div');
        subheader.className =
            'MuiListSubheader-root MuiListSubheader-gutters MuiListSubheader-sticky css-18qy2xf';
        subheader.id = 'libraries-subheader';
        subheader.textContent = 'Libraries';
        librariesList.appendChild(subheader);

        const views = await fetchUserViews();
        views.forEach((item) => {
            if (!item?.Id || !item?.Name) return;
            librariesList.appendChild(
                createListItem({
                    href: libraryHref(item),
                    label: item.Name,
                    iconKey: libraryIconKey(item)
                })
            );
        });

        return buildDrawerShell(mainList, librariesList);
    }

    function closeDrawer() {
        if (escapeHandler) {
            document.removeEventListener('keydown', escapeHandler);
            escapeHandler = null;
        }
        const drawer = openDrawerEl;
        openDrawerEl = null;
        document.body.style.removeProperty('overflow');
        if (!drawer) return;

        drawer.removeAttribute('data-kefin-drawer-open');
        const paper = drawer.querySelector('.MuiDrawer-paper');
        let finished = false;
        const finish = () => {
            if (finished) return;
            finished = true;
            drawer.remove();
        };
        if (paper) {
            paper.addEventListener('transitionend', (e) => {
                if (e.target === paper && e.propertyName === 'transform') finish();
            }, { once: true });
        }
        setTimeout(finish, 280);
    }

    async function openDrawer() {
        if (openDrawerEl) {
            closeDrawer();
            return;
        }
        try {
            const drawer = await buildDrawer();
            drawer.removeAttribute('data-kefin-drawer-open');
            document.body.appendChild(drawer);
            openDrawerEl = drawer;

            escapeHandler = (e) => {
                if (e.key === 'Escape') closeDrawer();
            };
            document.addEventListener('keydown', escapeHandler);

            applySelectedState(drawer);
            // Force closed paint, then open so translateX animates
            drawer.offsetWidth;
            requestAnimationFrame(() => {
                drawer.setAttribute('data-kefin-drawer-open', 'true');
                applySelectedState(drawer);
                setTimeout(() => applySelectedState(drawer), 100);
            });
        } catch (e) {
            ERR('Failed to open drawer', e);
            closeDrawer();
        }
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

    /** @returns {boolean|null} true if >= 12.0.0, false if older, null if unknown */
    function isAppVersionAtLeast12() {
        const version = window.ApiClient?._appVersion;
        if (!version) return null;
        const parts = parseVersionParts(version);
        const major = parts[0] ?? 0;
        const minor = parts[1] ?? 0;
        const patch = parts[2] ?? 0;
        if (major > 12) return true;
        if (major < 12) return false;
        if (minor > 0) return true;
        if (minor < 0) return false;
        return patch >= 0;
    }

    async function waitForAppVersion(timeoutMs = 10000) {
        const start = Date.now();
        while (Date.now() - start < timeoutMs) {
            const ready = isAppVersionAtLeast12();
            if (ready !== null) return ready;
            await new Promise((r) => setTimeout(r, 250));
        }
        return isAppVersionAtLeast12();
    }

    function ensureToolbarObserver() {
        if (toolbarObserver || typeof MutationObserver === 'undefined' || !document.body) return;
        let scheduled = false;
        toolbarObserver = new MutationObserver(() => {
            if (scheduled) return;
            scheduled = true;
            requestAnimationFrame(() => {
                scheduled = false;
                ensureHamburgerButton();
            });
        });
        toolbarObserver.observe(document.body, { childList: true, subtree: true });
    }

    function start() {
        ensureStyles();
        ensureHamburgerButton();
        ensureToolbarObserver();
        // Retry briefly for late toolbar mount
        let tries = 0;
        const poll = setInterval(() => {
            tries += 1;
            if (ensureHamburgerButton() || tries >= 40) clearInterval(poll);
        }, 250);
        LOG('Desktop hamburger menu initialized');
    }

    async function boot() {
        const ok = await waitForAppVersion();
        // v12+ modern desktop UI only
        if (ok !== true) {
            LOG(
                'Skipping desktop hamburger menu; requires ApiClient._appVersion >= 12.0.0',
                window.ApiClient?._appVersion || '(unavailable)'
            );
            return;
        }
        start();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            boot();
        });
    } else {
        boot();
    }
})();
