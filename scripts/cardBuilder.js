// Jellyfin Card Builder
// This module provides a main entry point function to build Jellyfin cards
// Usage: window.cardBuilder.buildCard(jellyfinItem)

(function() {
    'use strict';

    // Global toggle for progressive section fade-in.
    // Developers can set this to false to disable the behavior.
    const FADE_IN_SECTIONS = true;

    // Sliding window: render current slide + 4 prev + 4 next (9 total). As user navigates, remove/add slides.
    const SPOTLIGHT_WINDOW_PREV = 4;
    const SPOTLIGHT_WINDOW_NEXT = 4;

    const state = {
        defaultCardBackgroundNumber: 1,
        useBlurhash: false
    }

    function getSpotlightWindowIndices(currentIndex, totalLength) {
        if (totalLength <= 9) {
            return Array.from({ length: totalLength }, (_, i) => i);
        }
        const indices = new Set();
        for (let i = -SPOTLIGHT_WINDOW_PREV; i <= SPOTLIGHT_WINDOW_NEXT; i++) {
            const idx = (currentIndex + i + totalLength) % totalLength;
            indices.add(idx);
        }
        return Array.from(indices);
    }
    
    /**
     * Helper function to shuffle array (Fisher-Yates)
     */
    function shuffle(array) {
        const arr = [...array];
        for (let i = arr.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [arr[i], arr[j]] = [arr[j], arr[i]];
        }
        return arr;
    }

    /** Cream deco border styles that need injected child pieces on `.cardBorder`. */
    const CARD_BORDER_DECO_CHILDREN = {
        triple: ['cardBorder-tall', 'cardBorder-mid', 'cardBorder-wide'],
        stairstep: [
            'cardBorder-outer-left', 'cardBorder-outer-right',
            'cardBorder-mid-left', 'cardBorder-mid-right',
            'cardBorder-mid-top', 'cardBorder-mid-bottom',
            'cardBorder-inner-top', 'cardBorder-inner-bottom'
        ],
        square: [
            'cardBorder-inner',
            'cardBorder-square-left-top', 'cardBorder-square-left-bottom',
            'cardBorder-square-right-top', 'cardBorder-square-right-bottom',
            'cardBorder-tall', 'cardBorder-wide'
        ],
        diamond: [
            'cardBorder-square-left-top', 'cardBorder-square-left-bottom',
            'cardBorder-square-right-top', 'cardBorder-square-right-bottom',
            'cardBorder-tall-outer', 'cardBorder-tall-inner',
            'cardBorder-wide-outer', 'cardBorder-wide-inner'
        ],
        corner: [
            'cardBorder-corner cardBorder-corner-tl',
            'cardBorder-corner cardBorder-corner-tr',
            'cardBorder-corner cardBorder-corner-bl',
            'cardBorder-corner cardBorder-corner-br'
        ],
        'picture-frame': ['cardBorder-pf-inner']
    };

    /** Legacy art-deco / slim-fancy / vintage-wide prefs map onto current equivalents. */
    const CARD_BORDER_ALIASES = {
        'art-deco': 'stairstep',
        'art-deco-2': 'square',
        'slim-fancy': 'double',
        'vintage-wide': 'vintage'
    };

    const CARD_BORDER_CSS_ONLY = new Set([
        'fancy',
        'slim',
        'double',
        'modern-poster',
        'film-reel',
        'profile',
        'wood',
        'art-gallery'
    ]);

    function normalizeCardBorderStyle(style) {
        if (!style) return '';
        return CARD_BORDER_ALIASES[style] || style;
    }

    function getCardBorderAssetUrl(filename) {
        const root = String(window.KefinTweaksConfig?.kefinTweaksRoot || '').replace(/\/$/, '');
        return `${root}/pages/images/${filename}`;
    }

    function getRetroPosterMarqueeLabel(item) {
        if (item?.PremiereDate) {
            const premiere = new Date(item.PremiereDate);
            if (!Number.isNaN(premiere.getTime()) && premiere.getTime() > Date.now()) {
                return 'COMING SOON';
            }
        }
        return 'NOW PLAYING';
    }

    function createCardBorderHost() {
        const host = document.createElement('div');
        host.className = 'cardBorder';
        host.setAttribute('aria-hidden', 'true');
        return host;
    }

    function ensureRetroPosterMarquee(scalable) {
        if (!scalable) return;
        const card = scalable.closest('.card');
        let marquee = scalable.querySelector(':scope > .retroPosterMarquee');
        if (!marquee) {
            marquee = document.createElement('div');
            marquee.className = 'retroPosterMarquee';
            marquee.setAttribute('aria-hidden', 'true');
            const label = document.createElement('span');
            label.className = 'retroPosterMarquee-label';
            marquee.appendChild(label);
            const border = scalable.querySelector(':scope > .cardBorder');
            if (border) scalable.insertBefore(marquee, border);
            else scalable.appendChild(marquee);
        }
        const labelEl = marquee.querySelector('.retroPosterMarquee-label');
        if (labelEl) {
            labelEl.textContent = card?.dataset.retroMarquee || 'NOW PLAYING';
        }
    }

    function removeRetroPosterMarquee(scalable) {
        scalable?.querySelector(':scope > .retroPosterMarquee')?.remove();
    }

    function fillVintageBorder(host) {
        host.style.setProperty(
            '--v-corner-deco',
            `url("${getCardBorderAssetUrl('corner-decoration.svg')}")`
        );

        const outer = document.createElement('div');
        outer.className = 'cardBorder-v-outer';
        const mid = document.createElement('div');
        mid.className = 'cardBorder-v-mid';
        const inner = document.createElement('div');
        inner.className = 'cardBorder-v-inner';

        ['tl', 'tr', 'br', 'bl'].forEach((pos) => {
            const corner = document.createElement('div');
            corner.className = `cardBorder-v-corner cardBorder-v-corner-${pos}`;
            inner.appendChild(corner);
        });

        mid.appendChild(inner);
        outer.appendChild(mid);
        host.appendChild(outer);
    }

    const SVG_NS = 'http://www.w3.org/2000/svg';
    /** Target px between bulb centers along each edge. */
    const RP_BULB_PITCH = 16;
    const RP_BULB_LAYERS = [
        { cls: 'cardBorder-rp-bulb-glow', r: 5.5 },
        { cls: 'cardBorder-rp-bulb-mid', r: 3.5 },
        { cls: 'cardBorder-rp-bulb-core', r: 1.75 }
    ];
    const RP_DEFAULT_THIN = 2;
    const RP_DEFAULT_BAND = 16;
    /** Cards to sync bulbs for per animation frame (keeps style switches snappy). */
    const RP_SYNC_BATCH = 3;

    let rpBulbSyncQueue = [];
    let rpBulbSyncRaf = 0;

    function disconnectRetroPosterBulbs(host) {
        if (!host) return;
        if (host._rpRoRaf) {
            cancelAnimationFrame(host._rpRoRaf);
            host._rpRoRaf = 0;
        }
        if (host._rpBulbRo) {
            host._rpBulbRo.disconnect();
            host._rpBulbRo = null;
        }
        host._rpBulbPending = false;
        host._rpBulbW = null;
        host._rpBulbH = null;
        if (rpBulbSyncQueue.length) {
            rpBulbSyncQueue = rpBulbSyncQueue.filter((svg) => svg?.parentElement !== host);
        }
    }

    function getRetroPosterBandMetrics(sectionEl) {
        if (sectionEl?._rpBandMetrics) return sectionEl._rpBandMetrics;
        let thin = RP_DEFAULT_THIN;
        let band = RP_DEFAULT_BAND;
        try {
            const cs = getComputedStyle(sectionEl || document.documentElement);
            const t = parseFloat(cs.getPropertyValue('--rp-thin'));
            const b = parseFloat(cs.getPropertyValue('--rp-band'));
            if (Number.isFinite(t) && t > 0) thin = t;
            if (Number.isFinite(b) && b > 0) band = b;
        } catch {
            /* keep defaults */
        }
        const metrics = { thin, band };
        if (sectionEl) sectionEl._rpBandMetrics = metrics;
        return metrics;
    }

    function enqueueRetroPosterBulbSync(svg) {
        if (!svg?.isConnected) return;
        const host = svg.parentElement;
        if (!host || host._rpBulbPending) return;
        host._rpBulbPending = true;
        rpBulbSyncQueue.push(svg);
        if (!rpBulbSyncRaf) {
            rpBulbSyncRaf = requestAnimationFrame(flushRetroPosterBulbSyncQueue);
        }
    }

    function flushRetroPosterBulbSyncQueue() {
        rpBulbSyncRaf = 0;
        let n = 0;
        while (n < RP_SYNC_BATCH && rpBulbSyncQueue.length) {
            const svg = rpBulbSyncQueue.shift();
            const host = svg?.parentElement;
            if (host) host._rpBulbPending = false;
            if (svg?.isConnected && host?.dataset?.style === 'retro-poster') {
                syncRetroPosterBulbs(svg);
            }
            n += 1;
        }
        if (rpBulbSyncQueue.length) {
            rpBulbSyncRaf = requestAnimationFrame(flushRetroPosterBulbSyncQueue);
        }
    }

    function syncRetroPosterBulbs(svg) {
        const host = svg?.parentElement;
        if (!host) return;
        const w = host.clientWidth;
        const h = host.clientHeight;
        if (w < 8 || h < 8) return;

        // Skip rebuild when size unchanged and bulbs already exist
        if (host._rpBulbW === w && host._rpBulbH === h && svg.querySelector('circle')) return;
        host._rpBulbW = w;
        host._rpBulbH = h;

        const sectionEl = host.closest('[data-border], [data-border-style]');
        const { thin, band } = getRetroPosterBandMetrics(sectionEl);
        const mid = thin + band / 2;
        const x1 = mid;
        const y1 = mid;
        const x2 = w - mid;
        const y2 = h - mid;
        const rw = Math.max(0, x2 - x1);
        const rh = Math.max(0, y2 - y1);

        svg.setAttribute('viewBox', `0 0 ${w} ${h}`);

        /* Independent edge spacing so each side has a corner bulb + even steps between. */
        const kW = Math.max(1, Math.round(rw / RP_BULB_PITCH));
        const kH = Math.max(1, Math.round(rh / RP_BULB_PITCH));
        const sW = rw / kW;
        const sH = rh / kH;

        const points = [
            [x1, y1], [x2, y1], [x2, y2], [x1, y2]
        ];
        for (let i = 1; i < kW; i++) {
            points.push([x1 + i * sW, y1], [x1 + i * sW, y2]);
        }
        for (let i = 1; i < kH; i++) {
            points.push([x1, y1 + i * sH], [x2, y1 + i * sH]);
        }

        RP_BULB_LAYERS.forEach(({ cls, r }) => {
            const g = svg.querySelector(`g.${cls}`);
            if (!g) return;
            const frag = document.createDocumentFragment();
            points.forEach(([cx, cy]) => {
                const circle = document.createElementNS(SVG_NS, 'circle');
                circle.setAttribute('cx', String(cx));
                circle.setAttribute('cy', String(cy));
                circle.setAttribute('r', String(r));
                frag.appendChild(circle);
            });
            g.replaceChildren(frag);
        });
    }

    function fillRetroPosterBorder(host) {
        disconnectRetroPosterBulbs(host);

        const svg = document.createElementNS(SVG_NS, 'svg');
        svg.setAttribute('class', 'cardBorder-rp-bulbs');
        svg.setAttribute('aria-hidden', 'true');

        RP_BULB_LAYERS.forEach(({ cls }) => {
            const g = document.createElementNS(SVG_NS, 'g');
            g.setAttribute('class', cls);
            svg.appendChild(g);
        });

        host.appendChild(svg);

        // Coalesce RO storms; do not sync synchronously on attach (causes border-switch hitch).
        const ro = new ResizeObserver(() => {
            if (host._rpRoRaf) return;
            host._rpRoRaf = requestAnimationFrame(() => {
                host._rpRoRaf = 0;
                host._rpBulbW = null;
                host._rpBulbH = null;
                enqueueRetroPosterBulbSync(svg);
            });
        });
        ro.observe(host);
        host._rpBulbRo = ro;
        enqueueRetroPosterBulbSync(svg);
    }

    function fillCardBorder(host, style) {
        if (!host) return;
        const next = normalizeCardBorderStyle(style);
        const isVintage = next === 'vintage';
        const isRetro = next === 'retro-poster';
        const needsChildren = next
            && !CARD_BORDER_CSS_ONLY.has(next)
            && (isVintage || isRetro || !!CARD_BORDER_DECO_CHILDREN[next]);
        if (host.dataset.style === next) {
            const vintageNeedsRefresh = isVintage && !host.style.getPropertyValue('--v-corner-deco');
            if (!vintageNeedsRefresh && (!needsChildren || host.childElementCount > 0)) return;
        }
        disconnectRetroPosterBulbs(host);
        host.dataset.style = next;
        host.replaceChildren();
        if (!needsChildren) return;

        if (isVintage) {
            fillVintageBorder(host);
            return;
        }

        if (isRetro) {
            fillRetroPosterBorder(host);
            return;
        }

        for (const cls of CARD_BORDER_DECO_CHILDREN[next]) {
            const piece = document.createElement('div');
            piece.className = cls;
            host.appendChild(piece);
        }
    }

    /**
     * Sync `.cardBorder` hosts under a section from its data-border / data-border-style.
     * Creates hosts when missing; removes them when border is cleared.
     */
    function ensureCardBorders(sectionEl) {
        if (!sectionEl) return;
        const raw = sectionEl.dataset.border || sectionEl.dataset.borderStyle || '';
        const style = normalizeCardBorderStyle(raw);
        if (style && style !== raw) {
            sectionEl.dataset.border = style;
            sectionEl.dataset.borderStyle = style;
        }
        // Refresh cached band metrics when (re)applying so CSS vars stay current
        delete sectionEl._rpBandMetrics;

        if (style === 'wood') {
            sectionEl.style.setProperty(
                '--wood-vert-img',
                `url("${getCardBorderAssetUrl('wood.png')}")`
            );
        } else {
            sectionEl.style.removeProperty('--wood-vert-img');
        }
        const cards = sectionEl.querySelectorAll('.card:not(.card-layout-dummy) .cardScalable');
        cards.forEach((scalable) => {
            let host = scalable.querySelector(':scope > .cardBorder');
            if (!style) {
                if (host) {
                    disconnectRetroPosterBulbs(host);
                    host.remove();
                }
                removeRetroPosterMarquee(scalable);
                return;
            }
            if (!host) {
                host = createCardBorderHost();
                scalable.appendChild(host);
            }
            fillCardBorder(host, style);
            if (style === 'retro-poster') ensureRetroPosterMarquee(scalable);
            else removeRetroPosterMarquee(scalable);
        });
    }

    /** Skin-wide card corner radius; measured once and exposed as --kefin-card-radius. */
    let cachedCardRadius = null;

    const SQUARE_CARD_BORDER_STYLES = new Set([
        'retro-poster',
        'modern-poster',
        'picture-frame',
        'art-gallery',
        'wood',
        'profile',
        'film-reel'
    ]);

    function sectionHasSquareCardBorder(el) {
        const section = el?.closest?.('[data-border], [data-border-style]');
        if (!section) return false;
        const style = section.dataset.borderStyle || section.dataset.border || '';
        return SQUARE_CARD_BORDER_STYLES.has(style);
    }

    function getCardRadius() {
        if (cachedCardRadius != null) return cachedCardRadius;

        const candidates = document.querySelectorAll(
            '.card:not(.card-layout-dummy) .cardScalable, .card:not(.card-layout-dummy) .cardContent, .card:not(.card-layout-dummy)'
        );
        let sample = null;
        for (const el of candidates) {
            if (!sectionHasSquareCardBorder(el)) {
                sample = el;
                break;
            }
        }

        if (!sample) return '0px';

        const style = getComputedStyle(sample);
        let radius = (style.borderBottomLeftRadius || style.borderRadius || '').trim();
        if (!radius || radius === '0' || radius === '0px') {
            const themeRound =
                (style.getPropertyValue('--theme-roundness') ||
                    getComputedStyle(document.documentElement).getPropertyValue('--theme-roundness') ||
                    '').trim();
            radius = themeRound || radius || '0px';
        }

        cachedCardRadius = radius;
        return cachedCardRadius;
    }

    function ensureCardRadiusCssVar() {
        document.documentElement.style.setProperty('--kefin-card-radius', getCardRadius());
    }

    function invalidateCardRadiusCache() {
        cachedCardRadius = null;
        document.documentElement.style.removeProperty('--kefin-card-radius');
    }

    function applySectionPresentationAttrs(element, sectionConfig) {
        if (!element || !sectionConfig) return;

        if (sectionConfig.sectionCssClass) {
            sectionConfig.sectionCssClass.split(/\s+/).filter(Boolean).forEach(cls => element.classList.add(cls));
        }

        const border = sectionConfig.borderStyle;
        if (border) {
            element.dataset.border = border;
            element.dataset.borderStyle = border;
        } else {
            delete element.dataset.border;
            delete element.dataset.borderStyle;
        }
        const borderColor = sectionConfig.borderColor && String(sectionConfig.borderColor).trim();
        if (borderColor) {
            element.style.setProperty('--kefin-card-border-color', borderColor);
        } else {
            element.style.removeProperty('--kefin-card-border-color');
        }
        ensureCardBorders(element);

        const titleColor = sectionConfig.cardTitleColor && String(sectionConfig.cardTitleColor).trim();
        if (titleColor) {
            element.style.setProperty('--kefin-card-title-color', titleColor);
        } else {
            element.style.removeProperty('--kefin-card-title-color');
        }

        if (sectionConfig.hideName === true || sectionConfig.hideName === 'true') {
            element.dataset.hideSectionName = 'true';
        } else {
            delete element.dataset.hideSectionName;
        }
        delete element.dataset.hideName;

        const titleVisibility = sectionConfig.cardTitleVisibility
            || (sectionConfig.hideCardTitles === true ? 'hidden' : null);
        if (titleVisibility && titleVisibility !== 'visible') {
            element.dataset.cardTitleVisibility = titleVisibility;
        }
        if (sectionConfig.cardTitlePosition) {
            element.dataset.cardTitlePosition = sectionConfig.cardTitlePosition;
        } else {
            delete element.dataset.cardTitlePosition;
        }
        if (sectionConfig.cardTitleCapitalization && sectionConfig.cardTitleCapitalization !== 'normal') {
            element.dataset.cardTitleCapitalization = sectionConfig.cardTitleCapitalization;
        } else {
            delete element.dataset.cardTitleCapitalization;
        }
        if (sectionConfig.cardTitleFontFamily && sectionConfig.cardTitleFontFamily !== 'default') {
            element.dataset.fontFamily = sectionConfig.cardTitleFontFamily;
        } else {
            delete element.dataset.fontFamily;
        }
        if (sectionConfig.cardTitleFontSize && sectionConfig.cardTitleFontSize !== 'normal') {
            element.dataset.fontSize = sectionConfig.cardTitleFontSize;
        } else {
            delete element.dataset.fontSize;
        }

        const itemsLayout = resolveItemsLayout(sectionConfig);
        applyItemsLayoutState(element, itemsLayout, resolveUseGaplessCards(sectionConfig));

        const sectionType = String(sectionConfig.type || '').toLowerCase();
        const isCustomSection = sectionConfig.isCustom === true
            || sectionType === 'custom'
            || sectionType === 'custom-discovery'
            || String(sectionConfig.id || '').startsWith('custom');
        const isDiscoverySection = sectionConfig.discoveryEnabled === true
            || sectionConfig.discoverySection === true
            || sectionType === 'discovery'
            || sectionType === 'custom-discovery'
            || !!sectionConfig.discoveryType;

        if (sectionConfig.type) {
            element.setAttribute('data-section-type', sectionConfig.type);
        } else {
            element.removeAttribute('data-section-type');
        }

        const resolvedCategory = resolveSectionCategory(sectionConfig);
        if (resolvedCategory) {
            element.setAttribute('data-category', resolvedCategory);
        } else {
            element.removeAttribute('data-category');
        }

        if (isCustomSection) element.dataset.customSection = 'true';
        else delete element.dataset.customSection;

        if (isDiscoverySection) element.dataset.discoverySection = 'true';
        else delete element.dataset.discoverySection;
    }

    function resolveSectionCategory(sectionConfig) {
        if (!sectionConfig) return 'none';
        const id = String(sectionConfig.id || '');
        if (id.startsWith('pinned-list-') || id.startsWith('pinned-parent-')) return 'pinned';
        const sectionType = String(sectionConfig.type || '').toLowerCase();
        const isDiscovery = sectionConfig.discoveryEnabled === true
            || sectionConfig.discoverySection === true
            || sectionType === 'discovery'
            || sectionType === 'custom-discovery'
            || !!sectionConfig.discoveryType;
        if (isDiscovery) return 'discovery';
        return sectionConfig.category || 'none';
    }

    /**
     * Updates the scroll buttons for a scrollable container
     * @param {HTMLElement} scroller - The scroller element
     */
    function updateScrollableContainerScrollButtons(scroller) {
        const verticalSection = scroller.parentElement;
        if (!verticalSection) return;

        const scrollButtons = verticalSection.querySelector('.emby-scrollbuttons');
        if (!scrollButtons) return;

        const leftButton = scrollButtons.querySelector('button[data-direction="left"]');
        const rightButton = scrollButtons.querySelector('button[data-direction="right"]');
        if (!leftButton || !rightButton) return;

        const currentPosition = Math.abs(new DOMMatrixReadOnly(window.getComputedStyle(scroller).transform)?.m41 || 0);
        const maxPosition = scroller.scrollWidth - scroller.clientWidth;
        leftButton.disabled = currentPosition === 0;
        rightButton.disabled = currentPosition >= maxPosition;
    }
    
    /**
     * Sorts items based on sort order and direction
     * @param {Array} items - Array of Jellyfin items
     * @param {string} sortOrder - Sort order: Random, ReleaseDate, CriticRating, CommunityRating, SortTitle, DateAdded
     * @param {string} sortOrderDirection - Direction: Ascending or Descending
     * @returns {Array} - Sorted array
     */
    function sortItems(items, sortOrder = 'Random', sortOrderDirection = 'Ascending') {
        if (!items || items.length === 0) return items;
        
        const ascending = sortOrderDirection === 'Ascending';
        const sorted = [...items];
        
        switch(sortOrder) {
            case 'Random':
                return shuffle(sorted);
            case 'ReleaseDate':
                return sorted.sort((a, b) => {
                    const dateA = new Date(a.PremiereDate || a.ProductionYear || 0);
                    const dateB = new Date(b.PremiereDate || b.ProductionYear || 0);
                    return ascending ? dateA - dateB : dateB - dateA;
                });
            case 'CriticRating':
                return sorted.sort((a, b) => {
                    const ratingA = a.CriticRating || 0;
                    const ratingB = b.CriticRating || 0;
                    return ascending ? ratingA - ratingB : ratingB - ratingA;
                });
            case 'CommunityRating':
                return sorted.sort((a, b) => {
                    const ratingA = a.CommunityRating || 0;
                    const ratingB = b.CommunityRating || 0;
                    return ascending ? ratingA - ratingB : ratingB - ratingA;
                });
            case 'SortTitle':
                return sorted.sort((a, b) => {
                    const titleA = (a.SortTitle || a.Name || '').toLowerCase();
                    const titleB = (b.SortTitle || b.Name || '').toLowerCase();
                    return ascending ? titleA.localeCompare(titleB) : titleB.localeCompare(titleA);
                });
            case 'DateAdded':
                return sorted.sort((a, b) => {
                    const dateA = new Date(a.DateCreated || 0);
                    const dateB = new Date(b.DateCreated || 0);
                    return ascending ? dateA - dateB : dateB - dateA;
                });
            default:
                return sorted;
        }
    }
    
    /**
     * Picks a random card format for a section
     * @returns {string} - Random card format: 'portrait', 'thumb'
     */
    function getRandomCardFormat() {
        const formats = ['portrait', 'thumb'];
        return formats[Math.floor(Math.random() * formats.length)];
    }

    function sectionHasRandomQuerySort(sectionConfig) {
        // Treat as random if any query has an undefined/null/non-existent SortBy without a path
        if (String(sectionConfig?.sortBy || '').toLowerCase() === 'random') {
            return true;
        }

        if (sectionConfig?.queries?.some((q) => !q.queryOptions?.SortBy && !q.path)) {
            return true;
        }
        return (sectionConfig?.queries || []).some((q) =>
            String(q.queryOptions?.SortBy || '').toLowerCase() === 'random');
    }

    function flattenSeriesEpisodes(items) {
        if (!items || items.length === 0) return items;

        // Keep only the first item in the array for any given series
        const seriesMap = new Map();
        items.forEach(item => {
            if (item.Type !== 'Episode') {
                return;
            }

            if (seriesMap.has(item.SeriesId)) {
                return;
            }

            seriesMap.set(item.SeriesId, item);
        });
        
        return Array.from(seriesMap.values());
    }

    function formatAirDate(premiereDate) {
        if (!premiereDate) return '';

        // Ignore timezone offset
        const date = new Date(premiereDate.replace('Z', ''));

        // Use format: Tues Jan 4
        const options = { weekday: 'short', month: 'short', day: 'numeric' };
        return date.toLocaleDateString('en-US', options);
    }

    function countAvailableArtwork(item) {
        let count = 0;
        const tags = item?.ImageTags;
        if (tags && typeof tags === 'object') {
            for (const value of Object.values(tags)) {
                if (value) count++;
            }
        }
        if (item?.SeriesPrimaryImageTag) count++;
        if (item?.ParentBackdropImageTags?.length) count++;
        if (item?.ParentThumbImageTag) count++;
        if (item?.ParentLogoImageTag) count++;
        return count;
    }

    function getProviderKeys(item) {
        const ids = item?.ProviderIds;
        if (!ids) return [];
        return [ids.Imdb, ids.Tmdb, ids.Tvdb].filter(Boolean);
    }

    function deduplicateItems(items) {
        const deduplicated = [];
        const idToIndex = new Map();

        for (const item of items) {
            const keys = getProviderKeys(item);
            if (keys.length === 0) {
                deduplicated.push(item);
                continue;
            }

            let existingIndex = -1;
            for (const key of keys) {
                if (idToIndex.has(key)) {
                    existingIndex = idToIndex.get(key);
                    break;
                }
            }

            if (existingIndex === -1) {
                const index = deduplicated.length;
                deduplicated.push(item);
                for (const key of keys) {
                    idToIndex.set(key, index);
                }
                continue;
            }

            const existing = deduplicated[existingIndex];
            if (countAvailableArtwork(item) > countAvailableArtwork(existing)) {
                deduplicated[existingIndex] = item;
            }
            for (const key of keys) {
                idToIndex.set(key, existingIndex);
            }
        }

        return deduplicated;
    }

    /**
     * Merges NextUp and ContinueWatching items chronologically by LastPlayedDate
     * Preserves NextUp's internal order and assigns LastPlayedDate to items without it
     * @param {Array} nextUpItems - Array of Episode items from NextUp endpoint (already ordered)
     * @param {Array} continueWatchingItems - Array of Movie items from Continue Watching endpoint
     * @returns {Array} - Merged array sorted by LastPlayedDate (descending)
     */
    function mergeNextUpAndContinueWatching(nextUpItems, continueWatchingItems) {
        if (!nextUpItems || nextUpItems.length === 0) {
            return continueWatchingItems || [];
        }
        if (!continueWatchingItems || continueWatchingItems.length === 0) {
            return nextUpItems || [];
        }

        // 1. Assign LastPlayedDate to NextUp items without it
        // Items without LastPlayedDate inherit the date from the next item that has one
        const processedNextUp = [...nextUpItems];
        for (let i = processedNextUp.length - 1; i >= 0; i--) {
            const item = processedNextUp[i];
            if (!item.UserData || !item.UserData.LastPlayedDate) {
                // Look ahead to find next item with LastPlayedDate
                for (let j = i + 1; j < processedNextUp.length; j++) {
                    if (processedNextUp[j].UserData && processedNextUp[j].UserData.LastPlayedDate) {
                        // Assign the date from the next item
                        if (!item.UserData) item.UserData = {};
                        item.UserData.LastPlayedDate = processedNextUp[j].UserData.LastPlayedDate;
                        break;
                    }
                }
                // If no date found ahead, assign null (will be placed at end)
                if (!item.UserData || !item.UserData.LastPlayedDate) {
                    if (!item.UserData) item.UserData = {};
                    item.UserData.LastPlayedDate = null;
                }
            }
        }

        // 2. Sort ContinueWatching items by LastPlayedDate (descending)
        const sortedContinueWatching = [...continueWatchingItems, ...processedNextUp].sort((a, b) => {
            const dateA = a.UserData?.LastPlayedDate ? new Date(a.UserData.LastPlayedDate).getTime() : 0;
            const dateB = b.UserData?.LastPlayedDate ? new Date(b.UserData.LastPlayedDate).getTime() : 0;
            return dateB - dateA; // Descending
        });

        return sortedContinueWatching;
    }

    function postProcessItemsByQuery(sectionConfig, queryResults) {
        let processed = [];
        for (let i = 0; i < queryResults.length; i++) {
            const queryConfig = sectionConfig.queries[i];
            const queryResult = queryResults[i];
            const items = queryResult?.Items || queryResult || [];
            processed.push(...postProcessItems(queryConfig, items));
        }

        if (sectionConfig.id === 'continueWatchingAndNextUp') {
            // Get the movies from the items, and the rest as the episodes, then use mergeNextUpAndContinueWatching to merge them
            const movies = processed.filter(item => item.Type === 'Movie');
            const episodes = processed.filter(item => item.Type !== 'Movie');
            processed = mergeNextUpAndContinueWatching(episodes, movies);
        }

        return processed;
    }

    function postProcessItems(sectionConfig, itemsData) {
        let processed = itemsData?.Items || itemsData || [];

        //Check if imageTypes is used in the query to ensure only items with these image types are included
        const imageTypes = sectionConfig.queries?.[0]?.queryOptions?.ImageTypes;
        if (imageTypes && Array.isArray(imageTypes)) {
            // Filter out items which do not have any of the image types
            processed = processed.filter(item => {
                const itemImageTypes = imageTypes.filter(imageType => item.ImageTags?.[imageType] || (imageType === 'Backdrop' && item.BackdropImageTags?.[0]));
                return itemImageTypes.length > 0;
            });
        }

        // When ParentId is on the query (e.g. Popular Genres per library), assign it to each item for genre card links
        const queryParentId = sectionConfig.queries?.[0]?.ParentId;
        if (queryParentId && Array.isArray(processed)) {
            processed.forEach(item => { item.ParentId = queryParentId; });
        }

        // Check if the IsUnplayed filter is set on any of the queries
        const isUnplayedFilter = sectionConfig.queries?.some(query => query.queryOptions?.IsUnplayed === true || query.queryOptions?.Filters?.includes('IsUnplayed'));
        if (isUnplayedFilter) {
            processed = processed.filter(item => item.UserData?.Played === false);
        }

        // Check if the IsPlayed filter is set on any of the queries
        const isPlayedFilter = sectionConfig.queries?.some(query => query.queryOptions?.IsPlayed === true || query.queryOptions?.Filters?.includes('IsPlayed'));
        if (isPlayedFilter) {
            processed = processed.filter(item => item.UserData?.Played === true);
        }

        // Check if the IsResumable filter is set on any of the queries
        const isResumableFilter = sectionConfig.queries?.some(query => query.queryOptions?.IsResumable === true || query.queryOptions?.Filters?.includes('IsResumable'));
        if (isResumableFilter) {
            processed = processed.filter(item => item.UserData?.PlayedPercentage && item.UserData?.PlayedPercentage !== 100 && item.UserData?.PlayedPercentage > 0);
        }

        // Check if the MinPlayCount filter is set on any of the queries
        const minPlayCount = sectionConfig.minPlayCount || sectionConfig.queries?.[0]?.queryOptions?.MinPlayCount || 0;
        if (minPlayCount > 0) {
            processed = processed.filter(item => item.UserData?.PlayCount && item.UserData?.PlayCount >= minPlayCount);
        }

        // Check if the MaxPlayCount filter is set on any of the queries
        const maxPlayCount = sectionConfig.maxPlayCount || sectionConfig.queries?.[0]?.queryOptions?.MaxPlayCount || 0;
        if (maxPlayCount > 0) {
            processed = processed.filter(item => item.UserData?.PlayCount && item.UserData?.PlayCount <= maxPlayCount);
        }
                 
        // Flatten Series Episodes
        if (sectionConfig.flattenSeries === true) {
            processed = flattenSeriesEpisodes(processed);
        }

        if (sectionConfig.type === 'series-episodes' && Array.isArray(processed)) {
            processed = [...processed].sort((a, b) => (a.IndexNumber || 0) - (b.IndexNumber || 0));
        }

/*         if (sectionConfig.id === 'popularTVNetworks') {
            // Sort items randomly
            processed = shuffle(processed);
        } */

        if (sectionConfig.id === 'continueWatchingAndNextUp') {
            // Get the movies from the items, and the rest as the episodes, then use mergeNextUpAndContinueWatching to merge them
            const movies = processed.filter(item => item.Type === 'Movie');
            const episodes = processed.filter(item => item.Type !== 'Movie');
            processed = mergeNextUpAndContinueWatching(episodes, movies);
        }

        if (sectionConfig.id === 'upcoming') {
            // Remove items which aired before today
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            processed = processed.filter(item => {
                if (!item.PremiereDate || item.LocationType !== 'Virtual')
                    return false;
                const premiereDate = new Date(item.PremiereDate);
                premiereDate.setHours(0, 0, 0, 0);
                return premiereDate >= today;
            });
        }

        // Add Custom Secondary Text for Recently Released Movies
        if (sectionConfig.id === 'recentlyReleased.movies' || sectionConfig.id === 'upcoming' || sectionConfig.id === 'recentlyReleased.episodes') {
            processed.forEach(item => {
                if (item.PremiereDate) {
                    item.CustomFooterText = formatAirDate(item.PremiereDate);
                }
            });
        }

        // Sort items by UserData.PlayedPercentage if PlayedPercentage is set as the SortBy
        if (sectionConfig.queries?.[0]?.queryOptions?.SortBy === 'PlayedPercentage') {
            processed = processed.sort((a, b) => {
                const playedPercentageA = a.UserData?.PlayedPercentage || 0;
                const playedPercentageB = b.UserData?.PlayedPercentage || 0;
                return playedPercentageB - playedPercentageA;
            });

            // Remove any items which have no UserData.PlayedPercentage
            processed = processed.filter(item => item.UserData?.PlayedPercentage && item.UserData?.PlayedPercentage > 0);
        }

        // Check for SortBy ChildCount and use ChildCount to sort the items
        // ChildCount = ChildCount + SeriesCount + EpisodeCount + AlbumCount + ArtistCount + ProgramCount + MovieCount + SongCount 
        if (sectionConfig.queries?.[0]?.queryOptions?.SortBy === 'ChildCount') {
            processed = processed.sort((a, b) => {
                const childCountA = (a.ChildCount || 0) + (a.SeriesCount || 0) + (a.EpisodeCount || 0) + (a.AlbumCount || 0) + (a.ArtistCount || 0) + (a.ProgramCount || 0) + (a.MovieCount || 0) + (a.SongCount || 0);
                const childCountB = (b.ChildCount || 0) + (b.SeriesCount || 0) + (b.EpisodeCount || 0) + (b.AlbumCount || 0) + (b.ArtistCount || 0) + (b.ProgramCount || 0) + (b.MovieCount || 0) + (b.SongCount || 0);

                if (sectionConfig.queries?.[0]?.queryOptions?.SortOrder === 'Descending') {
                    return childCountB - childCountA;
                }
                return childCountA - childCountB;
            });
        }

        const limit = sectionConfig.itemLimit || sectionConfig.queries?.[0]?.queryOptions?.Limit || 0;

        if (sectionConfig.queries?.[0]?.queryOptions?.SortBy === 'Random' || sectionConfig.sortBy === 'Random') {        
            if (limit > 0 && sectionConfig.limitBeforeSort === true) {
                processed = processed.slice(0, limit);
            }
            processed = shuffle(processed);
        }

        // Apply local limits for non-API sources
        if (limit > 0) {
            processed = processed.slice(0, limit);
        }

        // Deduplicate items based on ProviderIds. Look for match imdb, tmdb or tvdb ids
        processed = deduplicateItems(processed);

        return processed;
    }

    function getQueryDisplayName(query, index) {
        const trimmed = query?.name?.trim?.();
        if (trimmed) return trimmed;
        return `Query ${index + 1}`;
    }

    function resolveActiveQueryIndex(sectionConfig, options = {}) {
        const queries = sectionConfig?.queries || [];
        if (queries.length <= 1) return 0;

        const stored = sectionConfig._selectedQueryIndex;
        if (Number.isInteger(stored) && stored >= 0 && stored < queries.length) {
            return stored;
        }

        if (options.initialize !== false) {
            let index = 0;
            if (sectionConfig.useRandomQuery === true) {
                index = Math.floor(Math.random() * queries.length);
            }
            sectionConfig._selectedQueryIndex = index;
            return index;
        }

        return 0;
    }

    function resolveQueriesToLoad(sectionConfig, options = {}) {
        const queries = sectionConfig?.queries || [];
        if (queries.length <= 1) return queries;

        if (sectionConfig.useMultiQueryPicker === true) {
            const index = resolveActiveQueryIndex(sectionConfig, options);
            return [queries[index]];
        }

        if (sectionConfig.useRandomQuery === true) {
            const randomIndex = Math.floor(Math.random() * queries.length);
            return [queries[randomIndex]];
        }

        return queries;
    }

    function getMultiQueryPickerButtonLabel(sectionConfig) {
        const customLabel = sectionConfig?.multiQueryPickerLabel?.trim?.();
        if (customLabel) return customLabel;

        const queries = sectionConfig?.queries || [];
        if (queries.length <= 1) return getQueryDisplayName(queries[0], 0);

        const index = resolveActiveQueryIndex(sectionConfig, { initialize: false });
        return getQueryDisplayName(queries[index], index);
    }

    function getSectionTitleForMultiQuery(sectionConfig) {
        if (sectionConfig?.useMultiQueryPicker === true
            && sectionConfig?.useQueryNamesForSection === true
            && (sectionConfig?.queries?.length || 0) > 1) {
            const index = resolveActiveQueryIndex(sectionConfig, { initialize: true });
            return getQueryDisplayName(sectionConfig.queries[index], index);
        }
        return sectionConfig?.name || '';
    }

    function getActiveViewMoreUrl(sectionConfig) {
        const queries = sectionConfig?.queries || [];
        if (sectionConfig?.useMultiQueryPicker === true && queries.length > 1) {
            const index = resolveActiveQueryIndex(sectionConfig, { initialize: true });
            const queryUrl = queries[index]?.viewMoreUrl;
            if (queryUrl) return queryUrl;
        }
        return sectionConfig?.viewMoreUrl || null;
    }

    function getSectionCaption(sectionConfig) {
        return sectionConfig?.caption?.trim() || null;
    }

    function getSectionCaptionUrl(sectionConfig) {
        return sectionConfig?.captionUrl || null;
    }

    function updateSectionTitleText(sectionElement, titleText, captionText) {
        if (!sectionElement) return;
        if (titleText != null) {
            const titleEl = sectionElement.querySelector('.sectionTitleContainer .sectionTitle.sectionTitle-cards');
            if (titleEl) titleEl.textContent = titleText;
        }
        if (captionText != null) {
            const captionEl = sectionElement.querySelector('.sectionTitle.sectionCaption');
            if (captionEl) captionEl.textContent = captionText;
        }
    }

    function updateSectionViewMoreLink(sectionElement, url) {
        if (!sectionElement) return;
        const titleLink = sectionElement.querySelector('a.sectionTitle-link');
        if (!titleLink) return;
        if (url) {
            titleLink.href = url;
            return;
        }
        titleLink.removeAttribute('href');
    }

    function resolveSectionQueryTtl(sectionConfig) {
        if (Number(sectionConfig?.ttl) >= 0) return Number(sectionConfig.ttl);
        const fromConfig2 = window.KefinHomeConfig2?.CACHE?.DEFAULT_TTL;
        if (Number(fromConfig2) >= 0) return Number(fromConfig2);
        const fromConfig = window.KefinHomeConfig?.CACHE?.DEFAULT_TTL;
        if (Number(fromConfig) >= 0) return Number(fromConfig);
        return 60 * 60 * 1000;
    }

    function extractItemsFromQueryPayload(data) {
        if (!data) return [];
        if (Array.isArray(data)) return data;
        if (Array.isArray(data.Items)) return data.Items;
        return [];
    }

    /**
     * Cache-aware load of the active query set (multi-query picker switches).
     * Respects section TTL — does not force-bypass cache.
     * @param {Object} sectionConfig
     * @returns {Promise<{ items: Array, canPaintCached: boolean, itemsPromise: Promise<Array> }>}
     */
    async function loadActiveSectionQueryItems(sectionConfig) {
        if (!sectionConfig.queries || !Array.isArray(sectionConfig.queries) || sectionConfig.queries.length === 0) {
            console.warn(`[KefinTweaks CardBuilder] Section ${sectionConfig.id} has no queries array`);
            return {
                items: [],
                canPaintCached: false,
                itemsPromise: Promise.resolve([])
            };
        }

        const userId = ApiClient.getCurrentUserId();
        const serverUrl = ApiClient.serverAddress();
        const ApiHelper = window.apiHelper;
        const results = [];
        const queriesToLoad = resolveQueriesToLoad(sectionConfig, { initialize: false });
        const sectionTtl = resolveSectionQueryTtl(sectionConfig);

        for (const query of queriesToLoad) {
            let queryResult;

            if (query.dataSource) {
                queryResult = await ApiHelper.fetchFromDataSource(query.dataSource, query.queryOptions || {});
            } else {
                const queryUrl = ApiHelper.buildQueryFromSection(
                    query,
                    userId,
                    serverUrl,
                    sectionConfig.renderMode === 'Spotlight',
                    { sectionType: sectionConfig.type }
                );

                if (typeof queryUrl === 'string') {
                    queryResult = await ApiHelper.getQuery(queryUrl, {
                        useCache: true,
                        ttl: sectionTtl
                    });
                } else {
                    console.warn(`[KefinTweaks CardBuilder] Invalid query URL for section ${sectionConfig.id}`);
                    continue;
                }
            }

            results.push(queryResult);
        }

        const resolveFreshItems = async () => {
            if (results.length > 1) {
                const merged = ApiHelper.mergeMultiQueryResults(results, sectionConfig);
                const raw = typeof merged.result?.ensureData === 'function'
                    ? await merged.result.ensureData()
                    : await (merged.result?.dataPromise ?? merged.result?.data);
                return extractItemsFromQueryPayload(raw);
            }
            if (results.length === 1) {
                const qr = results[0];
                const raw = typeof qr.ensureData === 'function'
                    ? await qr.ensureData()
                    : await (qr.dataPromise ?? qr.data);
                return postProcessItems(sectionConfig, extractItemsFromQueryPayload(raw));
            }
            return [];
        };

        if (results.length > 1) {
            const merged = ApiHelper.mergeMultiQueryResults(results, sectionConfig);
            const syncItems = extractItemsFromQueryPayload(merged.result?.data);
            // Multi-merge is usable only when every source reported a fresh cache hit.
            const canPaintCached = results.every((r) => r && r.isStale === false && r.data != null);
            return {
                items: canPaintCached ? syncItems : [],
                canPaintCached,
                itemsPromise: canPaintCached ? Promise.resolve(syncItems) : resolveFreshItems()
            };
        }

        if (results.length === 1) {
            const qr = results[0];
            const syncItems = postProcessItems(sectionConfig, extractItemsFromQueryPayload(qr?.data));
            // Strict: only paint when apiHelper reported a non-stale cache hit with a payload.
            const canPaintCached = qr?.isStale === false && qr?.data != null;
            return {
                items: canPaintCached ? syncItems : [],
                canPaintCached,
                itemsPromise: canPaintCached ? Promise.resolve(syncItems) : resolveFreshItems()
            };
        }

        return {
            items: [],
            canPaintCached: false,
            itemsPromise: Promise.resolve([])
        };
    }

    /**
     * Refresh section queries by re-executing them without cache
     * @param {Object} sectionConfig - Section configuration with queries array
     * @returns {Promise<Array>} - Processed items array
     */
    async function refreshSectionQueries(sectionConfig) {
        if (!sectionConfig.queries || !Array.isArray(sectionConfig.queries) || sectionConfig.queries.length === 0) {
            console.warn(`[KefinTweaks CardBuilder] Section ${sectionConfig.id} has no queries array`);
            return [];
        }

        const userId = ApiClient.getCurrentUserId();
        const serverUrl = ApiClient.serverAddress();
        const ApiHelper = window.apiHelper;
        const results = [];
        const queriesToLoad = resolveQueriesToLoad(sectionConfig, { initialize: false });

        // Process each query in the active set
        for (const query of queriesToLoad) {
            let queryResult;
            
            if (query.dataSource) {
                // Handle cache-based data sources
                queryResult = await ApiHelper.fetchFromDataSource(query.dataSource, query.queryOptions || {}, false);
            } else {
                // Build and execute query
                const queryUrl = ApiHelper.buildQueryFromSection(query, userId, serverUrl, sectionConfig.renderMode === 'Spotlight', { sectionType: sectionConfig.type });
                
                if (typeof queryUrl === 'string') {
                    // Standard query - use useCache: false to bypass cache
                    // When useCache is false, getQuery returns a Promise<data> directly
                    const data = await ApiHelper.getQuery(queryUrl, {
                        useCache: false
                    });
                    // Wrap in expected format for consistency
                    queryResult = {
                        data: data,
                        dataPromise: Promise.resolve(data),
                        isStalePromise: Promise.resolve(false)
                    };
                } else {
                    console.warn(`[KefinTweaks CardBuilder] Invalid query URL for section ${sectionConfig.id}`);
                    continue;
                }
            }
            
            results.push(queryResult);
        }

        // If multiple queries, merge results using section-level sortBy/sortOrder
        let finalResult;
        if (results.length > 1) {
            finalResult = ApiHelper.mergeMultiQueryResults(results, sectionConfig);
            // Extract items from merged result
            const items = finalResult.result?.data?.Items || finalResult.result?.data || [];
            return items;
        } else if (results.length === 1) {
            // Single query result
            const data = results[0].data || results[0];
            const items = data?.Items || data || [];
            return postProcessItems(sectionConfig, items);
        }

        return [];
    }

    /**
     * Show checkmark icon temporarily, then revert to refresh icon
     * @param {HTMLElement} button - The refresh button element
     */
    async function showRefreshComplete(button) {
        // Wait a brief moment for the spinning animation to complete smoothly
        // This ensures the transition from spinning to checkmark looks natural
        await new Promise(resolve => requestAnimationFrame(resolve));
        
        // Fade out current icon
/*         button.classList.add('icon-fade-out');
        
        // Wait for fade out to complete
        await new Promise(resolve => setTimeout(resolve, 200));*/
        
        // Change to checkmark icon
        button.classList.remove('refresh', 'icon-fade-out'); 
        button.classList.add('check_circle', 'icon-fade-in');
        
        await new Promise(resolve => requestAnimationFrame(resolve));
        await new Promise(resolve => setTimeout(resolve, 0));
        
        // Wait for fade in to complete
        await new Promise(resolve => setTimeout(resolve, 200));
        button.classList.remove('icon-fade-in');
        
        // After 1.5 seconds, fade out checkmark and fade in refresh icon
        setTimeout(async () => {
            // Fade out checkmark
            button.classList.add('icon-fade-out');
            await new Promise(resolve => setTimeout(resolve, 200));
            
            // Change to refresh icon
            button.classList.remove('check_circle', 'icon-fade-out');
            button.classList.add('refresh', 'icon-fade-in');
            
            // Wait for fade in to complete
            await new Promise(resolve => setTimeout(resolve, 200));
            button.classList.remove('icon-fade-in');
        }, 1500);
    }

    async function replaceSectionContent(sectionConfig, sectionElement, freshItems) {
        if (freshItems.length === 0) {
            sectionElement.remove();
            return null;
        }

        let finalCardFormat = sectionConfig.cardFormat;
        const currentCardFormat = sectionElement.getAttribute('data-card-format');
        if (currentCardFormat) {
            finalCardFormat = currentCardFormat;
        }

        const displayTitle = getSectionTitleForMultiQuery(sectionConfig);
        const activeViewMoreUrl = getActiveViewMoreUrl(sectionConfig);

        if (sectionConfig.spotlight || sectionConfig.renderMode === 'Spotlight') {
            const refreshed = refreshSpotlight(sectionElement, freshItems, {
                name: displayTitle,
                viewMoreUrl: activeViewMoreUrl,
                spotlightConfig: sectionConfig.spotlightConfig,
                dataItems: [],
                keepCurrentSlide: false,
                sectionConfig
            });
            const content = refreshed.content;
            ensureCardBorders(content);
            content.dataset.refreshing = 'false';
            attachSectionControlButtons(sectionConfig, content, freshItems);
            return content;
        }

        const content = createScrollableContainer(
            freshItems,
            displayTitle,
            activeViewMoreUrl,
            sectionConfig.overflowCard,
            finalCardFormat,
            sectionConfig
        );
        content.style.cssText = sectionElement.style.cssText;
        content.className = sectionElement.className;
        Array.from(sectionElement.attributes).forEach(attr => {
            content.setAttribute(attr.name, attr.value);
        });

        const oldItemsContainer = sectionElement.querySelector('.itemsContainer');
        const layoutFromDom = oldItemsContainer?.getAttribute('data-layout');
        const layout = (layoutFromDom === 'grid' || layoutFromDom === 'row')
            ? layoutFromDom
            : resolveItemsLayout(sectionConfig);
        const gapless = oldItemsContainer
            ? oldItemsContainer.getAttribute('data-gapless') === 'true'
            : resolveUseGaplessCards(sectionConfig);
        invalidateLastRowPadding(sectionElement.querySelector('.itemsContainer'));
        sectionElement.replaceWith(content);
        applyItemsLayoutState(content, layout, gapless);
        ensureCardBorders(content);
        attachSectionControlButtons(sectionConfig, content, freshItems);
        content.dataset.refreshing = 'false';
        return content;
    }

    /**
     * Immediately swap section body to skeleton cards while a query fetch is in flight.
     * @returns {HTMLElement} The skeleton section element now in the DOM
     */
    function showSectionQuerySkeletons(sectionConfig, sectionElement) {
        let finalCardFormat = sectionConfig.cardFormat;
        const currentCardFormat = sectionElement.getAttribute('data-card-format');
        if (currentCardFormat) {
            finalCardFormat = currentCardFormat;
        }
        if (finalCardFormat === 'random' || finalCardFormat === 'Random') {
            finalCardFormat = getRandomCardFormat();
        }

        const displayTitle = getSectionTitleForMultiQuery(sectionConfig);
        const activeViewMoreUrl = getActiveViewMoreUrl(sectionConfig);

        let skeleton;
        if (sectionConfig.spotlight || sectionConfig.renderMode === 'Spotlight') {
            const spotlightSettings = { ...(sectionConfig.spotlightConfig || {}) };
            if (activeViewMoreUrl) spotlightSettings.viewMoreUrl = activeViewMoreUrl;
            spotlightSettings.discoveryPending = sectionConfig.discoveryPending === true;
            spotlightSettings.caption = sectionConfig.caption;
            skeleton = createSkeletonSpotlightSection(displayTitle, spotlightSettings);
        } else {
            skeleton = createProgressivelyEnhancedScrollableContainer(
                displayTitle,
                activeViewMoreUrl,
                finalCardFormat,
                sectionConfig.overflowCard,
                sectionConfig
            );
        }

        skeleton.style.cssText = sectionElement.style.cssText;
        skeleton.className = sectionElement.className;
        Array.from(sectionElement.attributes).forEach(attr => {
            skeleton.setAttribute(attr.name, attr.value);
        });
        if (finalCardFormat) {
            skeleton.setAttribute('data-card-format', finalCardFormat);
        }
        applySectionPresentationAttrs(skeleton, sectionConfig);
        skeleton.dataset.refreshing = 'true';

        const oldItemsContainer = sectionElement.querySelector('.itemsContainer');
        const layoutFromDom = oldItemsContainer?.getAttribute('data-layout');
        const layout = (layoutFromDom === 'grid' || layoutFromDom === 'row')
            ? layoutFromDom
            : resolveItemsLayout(sectionConfig);
        const gapless = oldItemsContainer
            ? oldItemsContainer.getAttribute('data-gapless') === 'true'
            : resolveUseGaplessCards(sectionConfig);

        sectionElement.replaceWith(skeleton);
        applyItemsLayoutState(skeleton, layout, gapless);
        attachSectionControlButtons(sectionConfig, skeleton, []);
        return skeleton;
    }

    function attachMultiQueryPicker(sectionConfig, sectionElement, titleContainer) {
        const queries = sectionConfig?.queries || [];
        if (queries.length <= 1 || sectionConfig.useMultiQueryPicker !== true) {
            titleContainer.querySelectorAll('.multi-query-picker-button').forEach((btn) => btn.remove());
            return;
        }

        titleContainer.querySelectorAll('.multi-query-picker-button').forEach((btn) => btn.remove());

        resolveActiveQueryIndex(sectionConfig, { initialize: true });
        updateSectionTitleText(sectionElement, getSectionTitleForMultiQuery(sectionConfig), getSectionCaption(sectionConfig));
        updateSectionViewMoreLink(sectionElement, getActiveViewMoreUrl(sectionConfig));

        const selectButton = document.createElement('button');
        selectButton.type = 'button';
        selectButton.className = 'emby-button raised multi-query-picker-button';
        selectButton.textContent = getMultiQueryPickerButtonLabel(sectionConfig);
        selectButton.style.cssText = 'margin-left: 1em; padding: 0.5em 1em; font-size: 0.9em;';
        selectButton.setAttribute('aria-label', 'Select query');

        const controlsMount = titleContainer.querySelector('.section-controls');
        const titleLink = titleContainer.querySelector('a.sectionTitle-link');
        const sectionTitle = titleContainer.querySelector('.sectionTitle');
        if (controlsMount) {
            titleContainer.insertBefore(selectButton, controlsMount);
        } else if (titleLink?.parentNode) {
            titleLink.parentNode.insertBefore(selectButton, titleLink.nextSibling);
        } else if (sectionTitle?.parentNode) {
            sectionTitle.parentNode.insertBefore(selectButton, sectionTitle.nextSibling);
        } else {
            titleContainer.appendChild(selectButton);
        }

        let activePopover = null;
        const closePopover = () => {
            if (activePopover) {
                activePopover.remove();
                activePopover = null;
            }
        };

        if (!document.getElementById('kefinTweaks-multiQueryPopover-style')) {
            const styleElement = document.createElement('style');
            styleElement.id = 'kefinTweaks-multiQueryPopover-style';
            styleElement.textContent = `
                .multiQueryPopover {
                    background-color: rgba(0, 0, 0, 0.95);
                    position: absolute !important;
                    z-index: 1001;
                    display: block;
                }
            `;
            document.head.appendChild(styleElement);
        }

        selectButton.addEventListener('click', (e) => {
            e.stopPropagation();
            e.preventDefault();

            if (activePopover) {
                closePopover();
                return;
            }

            const popover = document.createElement('div');
            popover.className = 'kefinTweaks-popover multiQueryPopover itemDetailsGroup';
            const selectedIndex = resolveActiveQueryIndex(sectionConfig, { initialize: false });
            let selectedItemElement = null;

            queries.forEach((query, index) => {
                const itemElement = document.createElement('div');
                itemElement.className = 'kefinTweaks-popover-item detailsGroupItem';
                if (index === selectedIndex) {
                    itemElement.classList.add('selected');
                    selectedItemElement = itemElement;
                }
                itemElement.textContent = getQueryDisplayName(query, index);
                itemElement.addEventListener('click', async () => {
                    closePopover();
                    if (index === resolveActiveQueryIndex(sectionConfig, { initialize: false })) {
                        return;
                    }

                    sectionConfig._selectedQueryIndex = index;

                    const sectionIdAttr = (typeof CSS !== 'undefined' && typeof CSS.escape === 'function')
                        ? CSS.escape(String(sectionConfig.id))
                        : String(sectionConfig.id).replace(/\\/g, '\\\\').replace(/"/g, '\\"');

                    // Prefer the live section node (may have been replaced by a prior switch).
                    let activeSectionEl = document.querySelector(
                        `.verticalSection[data-section-id="${sectionIdAttr}"], .spotlight-section[data-section-id="${sectionIdAttr}"]`
                    ) || sectionElement;

                    const livePicker = activeSectionEl.querySelector('.multi-query-picker-button');
                    if (livePicker) {
                        livePicker.textContent = getMultiQueryPickerButtonLabel(sectionConfig);
                    }
                    updateSectionTitleText(activeSectionEl, getSectionTitleForMultiQuery(sectionConfig), getSectionCaption(sectionConfig));
                    updateSectionViewMoreLink(activeSectionEl, getActiveViewMoreUrl(sectionConfig));
                    activeSectionEl.dataset.refreshing = 'true';

                    try {
                        const loaded = await loadActiveSectionQueryItems(sectionConfig);
                        let newContent = null;

                        if (loaded.canPaintCached) {
                            newContent = await replaceSectionContent(sectionConfig, activeSectionEl, loaded.items);
                        } else {
                            // Skeletons before awaiting network — cache check already finished above.
                            activeSectionEl = showSectionQuerySkeletons(sectionConfig, activeSectionEl);
                            const freshItems = await loaded.itemsPromise;
                            newContent = await replaceSectionContent(sectionConfig, activeSectionEl, freshItems);
                        }

                        if (typeof sectionConfig._onMultiQueryChange === 'function') {
                            sectionConfig._onMultiQueryChange(index, sectionConfig, newContent);
                        }
                    } catch (error) {
                        console.error('[KefinTweaks CardBuilder] Error switching query:', error);
                        const live = document.querySelector(
                            `.verticalSection[data-section-id="${sectionIdAttr}"], .spotlight-section[data-section-id="${sectionIdAttr}"]`
                        ) || activeSectionEl;
                        if (live) live.dataset.refreshing = 'false';
                    }
                });
                popover.appendChild(itemElement);
            });

            titleContainer.style.position = 'relative';
            selectButton.parentNode.insertBefore(popover, selectButton.nextSibling);
            const buttonRect = selectButton.getBoundingClientRect();
            const containerRect = titleContainer.getBoundingClientRect();
            popover.style.left = `${Math.max(0, buttonRect.left - containerRect.left)}px`;
            popover.style.top = '100%';
            popover.style.bottom = 'auto';
            popover.style.marginTop = '8px';
            popover.style.marginBottom = '0';
            activePopover = popover;

            if (selectedItemElement) {
                setTimeout(() => {
                    selectedItemElement.scrollIntoView({
                        behavior: 'instant',
                        block: 'nearest',
                        inline: 'nearest'
                    });
                }, 10);
            }

            const closeHandler = (ev) => {
                if (!popover.contains(ev.target) && !selectButton.contains(ev.target)) {
                    closePopover();
                    document.removeEventListener('click', closeHandler);
                }
            };
            setTimeout(() => {
                document.addEventListener('click', closeHandler);
            }, 100);
        });
    }

    function ensureSectionControlsMount(titleContainer) {
        const wrapper = titleContainer.querySelector(':scope > .sectionTitle-wrapper');
        const mountParent = wrapper || titleContainer;

        let controls = mountParent.querySelector(':scope > .section-controls');
        if (!controls) {
            controls = titleContainer.querySelector(':scope > .section-controls');
        }

        if (!controls) {
            controls = document.createElement('div');
            controls.className = 'section-controls';

            const inline = document.createElement('div');
            inline.className = 'section-controls-inline';

            const moreButton = document.createElement('button');
            moreButton.type = 'button';
            moreButton.className = 'section-controls-more material-icons more_vert';
            moreButton.title = 'More';
            moreButton.setAttribute('aria-label', 'More');

            controls.appendChild(inline);
            controls.appendChild(moreButton);
            mountParent.appendChild(controls);
        } else if (controls.parentNode !== mountParent) {
            mountParent.appendChild(controls);
        }

        return {
            controls,
            inline: controls.querySelector('.section-controls-inline'),
            moreButton: controls.querySelector('.section-controls-more')
        };
    }

    function normalizeStaticSectionItems(sectionConfig) {
        const kefinTweaksRoot = window.KefinTweaksConfig?.kefinTweaksRoot || '';
        const serverId = typeof ApiClient !== 'undefined' && typeof ApiClient.serverId === 'function'
            ? ApiClient.serverId()
            : '';
        const normalizeTemplate = (value) => (value || '')
            .replace(/\$\{kefinTweaksRoot\}/g, kefinTweaksRoot)
            .replace(/\$\{serverId\}/g, serverId);

        return sectionConfig.items.map((item, index) => ({
            Name: item.Name,
            Id: item.Id || 'static-' + sectionConfig.id + '-' + index,
            Type: item.Type || 'Folder',
            posterUrl: normalizeTemplate(item.posterUrl),
            thumbUrl: normalizeTemplate(item.thumbUrl),
            squareUrl: normalizeTemplate(item.squareUrl),
            imageUrl: normalizeTemplate(item.imageUrl),
            cardUrl: normalizeTemplate(item.cardUrl),
            backdropUrl: normalizeTemplate(item.backdropUrl),
            bannerUrl: normalizeTemplate(item.bannerUrl),
            logoUrl: normalizeTemplate(item.logoUrl),
            CustomFooterText: item.cardFooter || undefined
        }));
    }

    /**
     * Refresh section content in place (used by section control registry).
     * @returns {Promise<HTMLElement|null>} refresh button on the new section, if any
     */
    async function executeSectionRefresh(sectionConfig, sectionElement) {
        sectionElement.dataset.refreshing = 'true';

        try {
            const hasStaticItems = Array.isArray(sectionConfig.items) && sectionConfig.items.length > 0;
            let freshItems;

            if (hasStaticItems) {
                if (!sectionHasRandomQuerySort(sectionConfig)) {
                    sectionElement.dataset.refreshing = 'false';
                    const refreshButton = sectionElement.querySelector('.section-refresh-button');
                    if (refreshButton) {
                        showRefreshComplete(refreshButton);
                    }
                    return refreshButton || null;
                }

                freshItems = postProcessItems(sectionConfig, normalizeStaticSectionItems(sectionConfig));
                if (freshItems.length === 0) {
                    sectionElement.dataset.refreshing = 'false';
                    return null;
                }
            } else {
                freshItems = await refreshSectionQueries(sectionConfig);
                if (freshItems.length === 0) {
                    sectionElement.remove();
                    return null;
                }
            }

            let finalCardFormat = sectionConfig.cardFormat;
            const currentCardFormat = sectionElement.getAttribute('data-card-format');
            if (currentCardFormat) {
                finalCardFormat = currentCardFormat;
            }

            let content = null;
            if (sectionConfig.spotlight || sectionConfig.renderMode === 'Spotlight') {
                const refreshed = refreshSpotlight(sectionElement, freshItems, {
                    name: getSectionTitleForMultiQuery(sectionConfig),
                    viewMoreUrl: getActiveViewMoreUrl(sectionConfig),
                    spotlightConfig: sectionConfig.spotlightConfig,
                    dataItems: [],
                    keepCurrentSlide: false,
                    sectionConfig
                });
                content = refreshed.content;
                ensureCardBorders(content);
                content.dataset.refreshing = 'false';
                const newButton = attachSectionControlButtons(sectionConfig, content, freshItems);
                if (newButton) {
                    showRefreshComplete(newButton);
                }
                return newButton;
            }

            content = createScrollableContainer(
                freshItems,
                getSectionTitleForMultiQuery(sectionConfig),
                getActiveViewMoreUrl(sectionConfig),
                sectionConfig.overflowCard,
                finalCardFormat,
                sectionConfig
            );

            content.style.cssText = sectionElement.style.cssText;
            content.className = sectionElement.className;
            Array.from(sectionElement.attributes).forEach(attr => {
                content.setAttribute(attr.name, attr.value);
            });

            const oldItemsContainer = sectionElement.querySelector('.itemsContainer');
            const layoutFromDom = oldItemsContainer?.getAttribute('data-layout');
            const layout = (layoutFromDom === 'grid' || layoutFromDom === 'row')
                ? layoutFromDom
                : resolveItemsLayout(sectionConfig);
            const gapless = oldItemsContainer
                ? oldItemsContainer.getAttribute('data-gapless') === 'true'
                : resolveUseGaplessCards(sectionConfig);
            invalidateLastRowPadding(content.querySelector('.itemsContainer'));

            sectionElement.replaceWith(content);
            applyItemsLayoutState(content, layout, gapless);
            ensureCardBorders(content);

            const newButton = attachSectionControlButtons(sectionConfig, content, freshItems);
            content.dataset.refreshing = 'false';
            if (newButton) {
                showRefreshComplete(newButton);
            }
            return newButton;
        } catch (error) {
            console.error('[KefinTweaks CardBuilder] Error refreshing section:', error);
            sectionElement.dataset.refreshing = 'false';
            return null;
        }
    }

    function attachSectionControlButtons(sectionConfig, sectionElement, cachedItems) {
        const titleContainer = sectionElement.querySelector('.sectionTitleContainer')
            || sectionElement.querySelector('.spotlight-section-title-container');
        if (!titleContainer) return null;

        titleContainer.querySelectorAll(
            ':scope > .show-all-button, :scope > .section-refresh-button, :scope > .section-configure-button'
        ).forEach((el) => el.remove());

        ensureSectionControlsMount(titleContainer);
        const definitions = getSectionControlDefinitions(sectionConfig, sectionElement, cachedItems);
        const refreshButton = renderSectionControls(sectionConfig, sectionElement, titleContainer, definitions);

        const itemsContainer = sectionElement.querySelector('.itemsContainer');
        const layout = itemsContainer?.getAttribute('data-layout') || resolveItemsLayout(sectionConfig);
        const showAllBtn = titleContainer.querySelector('.show-all-button');
        if (showAllBtn) {
            const resolved = layout === 'grid' ? layout : 'row';
            showAllBtn.title = ITEMS_LAYOUT_NEXT_TITLE[resolved] || ITEMS_LAYOUT_NEXT_TITLE.row;
            showAllBtn.setAttribute('aria-label', showAllBtn.title);
            setShowAllIcon(showAllBtn, nextItemsLayout(resolved));
        }

        attachMultiQueryPicker(sectionConfig, sectionElement, titleContainer);
        return refreshButton;
    }

    let cardUserDataListenerStarted = false;

    function getPrimaryUserIdForCardSync() {
        return (typeof ApiClient !== 'undefined' && typeof ApiClient.getCurrentUserId === 'function')
            ? ApiClient.getCurrentUserId()
            : null;
    }

    function extractUserDataChangePayload(event) {
        const data = event?.detail ?? event;
        const userId = data?.Data?.UserId ?? data?.UserId ?? null;
        const list = data?.Data?.UserDataList ?? data?.UserDataList;
        if (!Array.isArray(list)) return { userId, entries: [] };
        return { userId, entries: list };
    }

    function isPrimaryUserDataChange(userId) {
        const primaryId = getPrimaryUserIdForCardSync();
        if (!primaryId) return false;
        if (!userId) return true;
        return userId === primaryId;
    }

    /**
     * Keep data-positionticks on visible cards aligned with primary-user playstate.
     * Driven by UserDataChanged (same event Jellyfin uses for progress bars) — not DOM observation.
     */
    function updateCardResumeAttributes(itemId, userData) {
        if (!itemId || !userData) return;

        const escapedId = typeof CSS !== 'undefined' && CSS.escape
            ? CSS.escape(itemId)
            : itemId.replace(/["\\]/g, '\\$&');
        const cards = document.querySelectorAll(`.card[data-id="${escapedId}"]`);
        if (!cards.length) return;

        const ticks = userData.PlaybackPositionTicks;

        cards.forEach((card) => {
            if (userData.Played === true) {
                card.removeAttribute('data-positionticks');
                return;
            }
            if (typeof ticks === 'number' && ticks > 0) {
                card.setAttribute('data-positionticks', String(ticks));
            } else {
                card.removeAttribute('data-positionticks');
            }
        });
    }

    function updateCardWatchlistButtons(itemId, userData) {
        if (!itemId || !userData || !('Likes' in userData)) return;

        const isLiked = userData.Likes === true;
        const likedHelper = window.KefinWatchlistLikedIds;
        if (likedHelper?.set) {
            likedHelper.set(itemId, isLiked);
        }

        const escapedId = typeof CSS !== 'undefined' && CSS.escape
            ? CSS.escape(itemId)
            : itemId.replace(/["\\]/g, '\\$&');
        document.querySelectorAll(`.watchlist-button[data-id="${escapedId}"]`).forEach((button) => {
            button.dataset.active = isLiked ? 'true' : 'false';
            button.title = isLiked ? 'Remove from Watchlist' : 'Add to Watchlist';
        });
    }

    function applyUserDataEntriesToCards(entries, userId) {
        if (!isPrimaryUserDataChange(userId)) return;
        entries.forEach((entry) => {
            if (entry?.ItemId) {
                updateCardResumeAttributes(entry.ItemId, entry);
                updateCardWatchlistButtons(entry.ItemId, entry);
            }
        });
    }

    function handleCardUserDataChangedEvent(event) {
        const { userId, entries } = extractUserDataChangePayload(event);
        if (!entries.length) return;
        applyUserDataEntriesToCards(entries, userId);
    }

    function startCardUserDataListener() {
        if (cardUserDataListenerStarted) return;

        let registered = false;

        if (window.ApiClient?.addEventListener) {
            window.ApiClient.addEventListener('userdatachanged', handleCardUserDataChangedEvent);
            registered = true;
        }

        if (window.websocketHelper?.listen) {
            window.websocketHelper.listen('UserDataChanged', (msg) => {
                const userId = msg?.Data?.UserId;
                const entries = msg?.Data?.UserDataList;
                if (!Array.isArray(entries) || !entries.length) return;
                applyUserDataEntriesToCards(entries, userId);
            });
            registered = true;
        }

        if (registered) {
            cardUserDataListenerStarted = true;
            console.log('[KefinTweaks CardBuilder] Listening for UserDataChanged to sync card resume attributes');
            return;
        }

        setTimeout(startCardUserDataListener, 1000);
    }
    
    // Main card builder object
    const cardBuilder = {
        /**
         * Post-processes items for a section
         * @param {Object} sectionConfig - Section configuration
         * @param {Array} itemsData - Array of Jellyfin items
         * @returns {Array} - Post-processed array of Jellyfin items
         */
        postProcessItems: postProcessItems,
        postProcessItemsByQuery: postProcessItemsByQuery,
        getQueryDisplayName: getQueryDisplayName,
        resolveActiveQueryIndex: resolveActiveQueryIndex,
        resolveQueriesToLoad: resolveQueriesToLoad,
        getSectionTitleForMultiQuery: getSectionTitleForMultiQuery,
        getActiveViewMoreUrl: getActiveViewMoreUrl,
        refreshSectionQueries: refreshSectionQueries,
        loadActiveSectionQueryItems: loadActiveSectionQueryItems,
        attachSectionControlButtons: attachSectionControlButtons,
        ensureCardBorders: ensureCardBorders,
        applyItemsLayoutState: applyItemsLayoutState,
        resolveItemsLayout: resolveItemsLayout,
        resolveUseGaplessCards: resolveUseGaplessCards,
        invalidateLastRowPadding: invalidateLastRowPadding,
        invalidateCardRadiusCache: invalidateCardRadiusCache,
        ensureCardRadiusCssVar: ensureCardRadiusCssVar,
        getScrollerPosition: getScrollerPosition,
        setScrollerPosition: setScrollerPosition,
        getItemMaterialIcon: getItemMaterialIcon,
        createLibraryButtonElement: createLibraryButtonElement,
        /**
         * Main entry point function to build a Jellyfin card
         * @param {Object} item - The Jellyfin item object
         * @param {boolean} overflowCard - Use overflow card classes instead of normal card classes
         * @param {string} cardFormat - Override card format: 'portrait', 'backdrop', 'thumb', or 'square'
         * @param {string} customFooterText - Optional custom footer text (e.g., air date for episodes)
         * @param {boolean} useParentCard - When true, the parent item will be rendered as the card image and link
         * @returns {HTMLElement} - The constructed card element
         */
        buildCard: function(item, overflowCard = false, cardFormat = null, customFooterText = null, useParentCard = false) {
            return createJellyfinCardElement(item, overflowCard, cardFormat, customFooterText, useParentCard);
        },
        
        /**
         * Renders a scrollable container with cards
         * @param {Array} items - Array of Jellyfin item objects
         * @param {string} title - Title for the scrollable container
         * @param {string|Function} viewMoreUrl - Optional URL to make title clickable, or function to call on click
         * @param {boolean} overflowCard - Use overflow card classes instead of normal card classes
         * @param {string} cardFormat - Override card format: 'portrait', 'backdrop', 'thumb', 'square', or 'random'
         * @param {string} sortOrder - Sort order: 'Random', 'ReleaseDate', 'CriticRating', 'CommunityRating', 'SortTitle', 'DateAdded'
         * @param {string} sortOrderDirection - Direction: 'Ascending' or 'Descending'
         * @returns {HTMLElement} - The constructed scrollable container
         */
        renderCards: function(items, title, viewMoreUrl = null, overflowCard = false, cardFormat = null, sortOrder = null, sortOrderDirection = 'Ascending') {
            let finalCardFormat = cardFormat;
            if (cardFormat === 'random' || cardFormat === 'Random') {
                finalCardFormat = getRandomCardFormat();
            }

            let sortedItems = items;
            if (sortOrder && sortOrder !== 'Random') {
                sortedItems = sortItems(items, sortOrder, sortOrderDirection);
            } else if (sortOrder === 'Random') {
                sortedItems = shuffle([...items]);
            }

            const container = createScrollableContainer(sortedItems, title, viewMoreUrl, overflowCard, finalCardFormat);
            return container;
        },

        renderSpotlightSection: function(items, title, options = {}) {
            return createSpotlightSection(items, title, options);
        },

        /**
         * Renders a scrollable container with cards from item IDs
         * @param {Array} itemIds - Array of Jellyfin item IDs
         * @param {string} title - Title for the scrollable container
         * @param {string} viewMoreUrl - Optional URL to make title clickable
         * @param {boolean} overflowCard - Use overflow card classes instead of normal card classes
         * @param {string} cardFormat - Override card format: 'portrait', 'backdrop', 'thumb', 'square', or 'random'
         * @param {string} sortOrder - Sort order: 'Random', 'ReleaseDate', 'CriticRating', 'CommunityRating', 'SortTitle', 'DateAdded'
         * @param {string} sortOrderDirection - Direction: 'Ascending' or 'Descending'
         * @returns {Promise<HTMLElement>} - The constructed scrollable container
         */
        /**
         * Renders cards progressively with skeleton loading state
         * @param {Promise<Array>} itemsPromise - Promise that resolves to array of Jellyfin items
         * @param {string} title - Title for the scrollable container
         * @param {string|Function} viewMoreUrl - Optional URL to make title clickable
         * @param {boolean} overflowCard - Use overflow card classes instead of normal card classes
         * @param {string} cardFormat - Override card format: 'portrait', 'backdrop', 'thumb', 'square', or 'random'
         * @param {string} sortOrder - Sort order: 'Random', 'ReleaseDate', 'CriticRating', 'CommunityRating', 'SortTitle', 'DateAdded'
         * @param {string} sortOrderDirection - Direction: 'Ascending' or 'Descending'
         * @returns {HTMLElement} - The constructed scrollable container (initially with skeletons)
         */
        renderProgressivelyEnhancedCards: async function(itemsPromise, title, viewMoreUrl = null, overflowCard = false, cardFormat = null, sortOrder = null, sortOrderDirection = 'Ascending', minimumItems = -1) {
            // Handle Random card format - Must resolve ONCE for both skeleton and real cards
            let resolvedFormat = cardFormat;
            if (cardFormat === 'random' || cardFormat === 'Random') {
                resolvedFormat = getRandomCardFormat();
            }

            // Check if promise is already fulfilled
            if (await promiseState(itemsPromise) === 'fulfilled') {
                // Resolve the promise and get the items
                const items = await itemsPromise;
                // Replace the skeleton with the real cards
                const container = createScrollableContainer(items, title, viewMoreUrl, overflowCard, resolvedFormat);
                return container;
            }

            // Create skeleton container immediately using the resolved format
            const skeletonContainer = createProgressivelyEnhancedScrollableContainer(title, viewMoreUrl, resolvedFormat, overflowCard);
            const randomId = Math.random().toString(36).substring(2, 15);
            skeletonContainer.setAttribute('data-skeleton-id', randomId);
            
            // When promise resolves, replace skeletons with real cards
            itemsPromise.then(async items => {
                // Remove the skeleton container if it exists
                let skeletonContaineElement = document.querySelector(`[data-skeleton-id="${randomId}"]`);

                // Let's try to find the skeleton 20 times every 100ms
                for (let i = 0; i < 20; i++) {
                    skeletonContaineElement = document.querySelector(`[data-skeleton-id="${randomId}"]`);
                    if (skeletonContaineElement) {
                        break;
                    }
                    await new Promise(resolve => setTimeout(resolve, 150));
                }

                if (!items || items.length === 0) {
                    // Remove container if no items
                    skeletonContaineElement.remove();
                    return;
                }

                if (items.length < minimumItems) {
                    // Remove container if not enough items
                    skeletonContaineElement.remove();
                    return;
                }

                // Sort items if needed
                let sortedItems = items;
                if (sortOrder && sortOrder !== 'Random') {
                    sortedItems = sortItems(items, sortOrder, sortOrderDirection);
                } else if (sortOrder === 'Random') {
                    sortedItems = shuffle([...items]);
                }

                // Generate real cards container (off-DOM) using the SAME resolved format
                const realContainer = createScrollableContainer(sortedItems, title, viewMoreUrl, overflowCard, resolvedFormat);

                // Copy critical attributes to preserve layout/order
                if (skeletonContaineElement.style.order) {
                    realContainer.style.order = skeletonContainer.style.order;
                }
                if (skeletonContaineElement.hasAttribute('data-section-id')) {
                    realContainer.setAttribute('data-section-id', skeletonContainer.getAttribute('data-section-id'));
                }
                if (skeletonContaineElement.dataset.border) {
                    realContainer.dataset.border = skeletonContaineElement.dataset.border;
                    realContainer.dataset.borderStyle = skeletonContaineElement.dataset.borderStyle
                        || skeletonContaineElement.dataset.border;
                }

                // Replace content of skeleton container with real content
                // This preserves the container element itself and its layout properties (like order)
                skeletonContaineElement.replaceWith(realContainer);
                ensureCardBorders(realContainer);
            }).catch(error => {
                console.error('[KefinTweaks CardBuilder] Error loading items for progressive enhancement:', error);
                // Optionally remove skeleton on error or show error state
                if (skeletonContaineElement) {
                    skeletonContaineElement.remove();
                }
            });

            return skeletonContainer;
        },

        /**
         * Renders a progressive section (Cards or Spotlight)
         * @param {HTMLElement} container - The parent container to append the section to
         * @param {Array|Promise} itemsOrPromises - Data array or Promise resolving to items
         * @param {string} title - Section title
         * @param {Object} options - Configuration options
         */
        renderProgressiveSections: async function(container, sections, options = {}) {
            const {
                revealSectionsSequentially = false,
                waitForContainerClass = null,
                enhanceOnVisible = false,
                enhanceRootMargin = '30% 0px 30% 0px',
                showStaleDataBeforeRefresh = true
            } = options;

            const renderProgressiveSectionsStartTime = performance.now();

            const sectionEnhancementTargets = [];
            const fragment = document.createDocumentFragment();
            for (const sectionPromise of sections) {
                const sectionPromiseStartTime = performance.now();
                const section = await sectionPromise;
                const sectionPromiseEndTime = performance.now();
                const sectionPromiseDuration = sectionPromiseEndTime - sectionPromiseStartTime;
                console.log(`Section promise initialization time: ${sectionPromiseDuration.toFixed(2)}ms`);
                
                const sectionStartTime = performance.now();

                const sectionConfig = section.config;

                // Skip if the section is not enabled
                if (!sectionConfig.enabled) {
                    console.log(`[KefinTweaks CardBuilder] Section ${sectionConfig.id} is not enabled, skipping...`);
                    continue;
                }

                // Handle Random card format - pick one format for entire section
                let finalCardFormat = sectionConfig.cardFormat;
                if (finalCardFormat === 'random' || finalCardFormat === 'Random') {
                    finalCardFormat = getRandomCardFormat();
                }

                let dataItems = section.result?.data?.Items ?? section.result?.data;
                const isRandomQuerySort = sectionHasRandomQuerySort(sectionConfig);

                // If the section has items, it is a static query
                const isStaticQuery = Array.isArray(sectionConfig.items) && sectionConfig.items.length > 0;
                    
                const renderCachedData = (isStaticQuery || (!section.result?.isStale && !isRandomQuerySort) || (showStaleDataBeforeRefresh && (!isRandomQuerySort || sectionConfig.renderMode === 'Spotlight'))) && dataItems.length > 0;

                // Paint cached cards when valid, or when stale display is opted in
                if (renderCachedData) {
                    let content = null;

                    if (sectionConfig.spotlight || sectionConfig.renderMode === 'Spotlight') {
                        content = createSpotlightSection(dataItems, getSectionTitleForMultiQuery(sectionConfig), { 
                            viewMoreUrl: getActiveViewMoreUrl(sectionConfig), 
                            progressiveEnhancement: true,
                            ...sectionConfig.spotlightConfig
                        });
                    } else {
                        content = createScrollableContainer(dataItems, getSectionTitleForMultiQuery(sectionConfig), getActiveViewMoreUrl(sectionConfig), sectionConfig.overflowCard, finalCardFormat, sectionConfig);
                    }

                    content.setAttribute('data-section-id', sectionConfig.id);
                    content.style.order = sectionConfig.order;
                    content.dataset.order = sectionConfig.order;

                    if (sectionConfig.hideCardFooter === true) {
                        content.dataset.hideCardFooter = 'true';
                    }
                    applySectionPresentationAttrs(content, sectionConfig);
                    
                    // Add section control buttons to rendered section
                    attachSectionControlButtons(sectionConfig, content, dataItems);
                    
                    sectionEnhancementTargets.push({ element: content, section });
                    //container.appendChild(content);
                    //content.style.contentVisibility = 'hidden';

                    if (revealSectionsSequentially) {
                        content.classList.add('cardbuilder-section-reveal');
                        content.style.display = 'none';
                    }

                    fragment.appendChild(content);
                    const sectionEndTime = performance.now();
                    const sectionDuration = sectionEndTime - sectionStartTime;
                    console.log(`Section ${sectionConfig.id} progressive initialization time: ${sectionDuration.toFixed(2)}ms`);
                    continue;
                }

                // Otherwise, we need to create a skeleton section

                let sectionElement = null;
                if (sectionConfig.spotlight || sectionConfig.renderMode === 'Spotlight') {
                    const spotlightSettings = sectionConfig.spotlightConfig ?? {};
                    if (getActiveViewMoreUrl(sectionConfig)) {
                        spotlightSettings.viewMoreUrl = getActiveViewMoreUrl(sectionConfig);
                    }
                    spotlightSettings.discoveryPending = sectionConfig.discoveryPending === true;
                    spotlightSettings.caption = sectionConfig.caption;
                    sectionElement = createSkeletonSpotlightSection(getSectionTitleForMultiQuery(sectionConfig), spotlightSettings);
                } else {
                    sectionElement = createProgressivelyEnhancedScrollableContainer(getSectionTitleForMultiQuery(sectionConfig), getActiveViewMoreUrl(sectionConfig), finalCardFormat, sectionConfig.overflowCard, sectionConfig);
                }
                sectionElement.setAttribute('data-section-id', sectionConfig.id);
                sectionElement.style.order = sectionConfig.order;

                if (sectionConfig.hideCardFooter === true) {
                    sectionElement.dataset.hideCardFooter = 'true';
                }
                applySectionPresentationAttrs(sectionElement, sectionConfig);
                //container.appendChild(sectionElement);
                
                // set section element content-visibility to hidden
                //sectionElement.style.contentVisibility = 'hidden';

                if (revealSectionsSequentially) {
                    sectionElement.classList.add('cardbuilder-section-reveal');
                    sectionElement.style.display = 'none';
                }

                sectionEnhancementTargets.push({ element: sectionElement, section });
                fragment.appendChild(sectionElement);
                const sectionEndTime = performance.now();
                const sectionDuration = sectionEndTime - sectionStartTime;
                console.log(`Section ${sectionConfig.id} progressive initialization time: ${sectionDuration.toFixed(2)}ms`);
            }

            // Wait for the container to have the class specified in waitForContainerClass with a timeout of 10 seconds
            // Append the container to the page for now invisibly so that Jellyfin handles enhancing it with the typical Scroller functionality
            // Finally when the container has the class specified in waitForContainerClass, we can move the pre-rendered sections into the container
            if (waitForContainerClass && !container.classList.contains(waitForContainerClass)) {
                // Wait for the container to have the class specified in waitForContainerClass with a timeout of 10 seconds
                console.log(`Waiting for container to have class ${waitForContainerClass}...`);
                const maxAttempts = 100;
                let attempts = 0;
                while (!container.classList.contains(waitForContainerClass) && attempts < maxAttempts) {
                    attempts++;
                    await new Promise(resolve => setTimeout(resolve, 100));
                    if (container.classList.contains(waitForContainerClass)) {
                        break;
                    }
                }
                if (!container.classList.contains(waitForContainerClass)) {
                    console.log(`Container did not have class ${waitForContainerClass} after ${maxAttempts} attempts, continuing...`);
                }    
            }

            // Append one section per frame so scroll/compositor get frames between paints.
            // Build already happened in the fragment; only the container append is paced.
            /* const sectionNodes = Array.from(fragment.childNodes);
            for (let i = 0; i < sectionNodes.length; i++) {
                container.appendChild(sectionNodes[i]);
                if (i + 1 < sectionNodes.length) {
                    await new Promise((resolve) => requestAnimationFrame(resolve));
                }
            } */
            container.appendChild(fragment);
            syncAttachedGridTilesLayouts(container);

            // Update the scroll buttons for all scrollable containers
            /* const scrollableContainers = container.querySelectorAll('.emby-scroller');
            for (const scroller of scrollableContainers) {
                updateScrollableContainerScrollButtons(scroller);
            } */


            // Batch append sections to avoid Jellyfin emby-scroller processing
            // all at once (causes render lag when many sections are added)
            /* const BATCH_SIZE = 4;
            const sectionNodes = Array.from(fragment.childNodes);
            for (let i = 0; i < sectionNodes.length; i += BATCH_SIZE) {
                const batch = sectionNodes.slice(i, i + BATCH_SIZE);
                const batchFragment = document.createDocumentFragment();
                batch.forEach(node => batchFragment.appendChild(node));
                container.appendChild(batchFragment);
                if (i + BATCH_SIZE < sectionNodes.length) {
                    await new Promise(resolve => requestAnimationFrame(resolve));
                    await new Promise(resolve => setTimeout(resolve, 0));
                }
            } */

            /* for (const sectionElement of sectionElements) {
                container.appendChild(sectionElement);
                await new Promise(resolve => requestAnimationFrame(resolve));
                await new Promise(resolve => setTimeout(resolve, 0));
            } */

            /* for (const sectionElement of sectionElements) {
                sectionElement.style.contentVisibility = 'hidden';
                container.appendChild(sectionElement);
                await new Promise(resolve => requestAnimationFrame(resolve));
                await new Promise(resolve => setTimeout(resolve, 0));
            } */

/*             for (const sectionElement of sectionElements) {
                container.appendChild(sectionElement);
            } */

            // Append all of the section elements to the container at once
            //container.append(...sectionElements);

            // Wait 5 seconds
            //await new Promise(resolve => setTimeout(resolve, 500));

            // Set up section reveal animations if enabled
            if (revealSectionsSequentially) {
                initializeSectionRevealObserver();
                sectionEnhancementTargets.forEach(({ element }) => {
                    element.style.display = '';
                    observeSectionForReveal(element);
                });
            }

            const enhanceOptions = {
                enhanceOnVisible,
                enhanceRootMargin,
                revealSectionsSequentially
            };

            for (let index = 0; index < sectionEnhancementTargets.length; index++) {
                const sectionStartTime = performance.now();
                const { element: sectionElement, section } = sectionEnhancementTargets[index];

                if (Array.isArray(section.config.items) && section.config.items.length > 0) {
                    continue;
                }
                scheduleSectionProgressiveEnhancement(sectionElement, section, enhanceOptions);

                const sectionEndTime = performance.now();
                const sectionDuration = sectionEndTime - sectionStartTime;
                console.log(`Section ${index} progressive initialization time: ${sectionDuration.toFixed(2)}ms`);
            }
            const renderProgressiveSectionsEndTime = performance.now();
            const renderProgressiveSectionsDuration = renderProgressiveSectionsEndTime - renderProgressiveSectionsStartTime;
            console.log(`Render progressive sections initialization time: ${renderProgressiveSectionsDuration.toFixed(2)}ms`);
        },       

        /**
         * Unified function to render progressive sections (Cards or Spotlight)
         * @param {HTMLElement} container - The parent container to append the section to
         * @param {Array|Promise} itemsOrPromise - Data array or Promise resolving to items
         * @param {string} title - Section title
         * @param {Object} options - Configuration options
         */
        renderProgressiveCards: function(container, itemsOrPromise, title, options = {}) {
            const {
                spotlight = false,
                viewMoreUrl = null,
                cardFormat = null,
                overflowCard = false,
                sortOrder = null,
                sortOrderDirection = 'Ascending',
                sectionId = null,
                order = null,
                expectedItemType = null,
                minimumItems = 1
            } = options;

            // Handle Random card format once
            let resolvedFormat = cardFormat;
            if (cardFormat === 'random' || cardFormat === 'Random') {
                resolvedFormat = getRandomCardFormat();
            }

            // Function to setup attributes
            const setupElement = (el) => {
                if (sectionId) el.setAttribute('data-section-id', sectionId);
                if (order !== null) el.style.order = order;
                // Stamp resolved format for consistency on updates
                if (resolvedFormat && !spotlight) el.setAttribute('data-card-format', resolvedFormat);
            };

            // Helper to render final content
            const renderContent = (items) => {
                if (!items || items.length < minimumItems) return null;

                // Sort items
                let sortedItems = items;
                if (sortOrder && sortOrder !== 'Random') {
                    sortedItems = sortItems(items, sortOrder, sortOrderDirection);
                } else if (sortOrder === 'Random') {
                    sortedItems = shuffle([...items]);
                }

                if (spotlight) {
                    return createSpotlightSection(sortedItems, title, { viewMoreUrl });
                } else {
                    return createScrollableContainer(sortedItems, title, viewMoreUrl, overflowCard, resolvedFormat);
                }
            };

            // Handle Promise
            if (itemsOrPromise && typeof itemsOrPromise.then === 'function') {
                // Render Skeleton
                let skeleton;
                if (spotlight) {
                    skeleton = createSkeletonSpotlightSection(title, { viewMoreUrl });
                } else {
                    skeleton = createProgressivelyEnhancedScrollableContainer(title, viewMoreUrl, resolvedFormat, overflowCard);
                }
                setupElement(skeleton);
                container.appendChild(skeleton);

                // Handle Resolution
                itemsOrPromise.then(items => {
                    const content = renderContent(items);
                    if (content) {
                        setupElement(content);
                        // Copy of any existing data attributes to the new content
                        Array.from(skeleton.attributes).forEach(attr => {
                            content.setAttribute(attr.name, attr.value);
                        });
                        skeleton.replaceWith(content);
                        ensureCardBorders(content);
                    } else {
                        skeleton.remove();
                    }
                }).catch(err => {
                    console.error('[CardBuilder] Error loading items:', err);
                    skeleton.remove();
                });

                return skeleton;
            } 
            
            // Handle Direct Array
            else {
                const items = Array.isArray(itemsOrPromise) ? itemsOrPromise : [];
                const content = renderContent(items);
                if (content) {
                    setupElement(content);
                    container.appendChild(content);
                    return content;
                }
            }
        },

        renderCardsFromIds: async function(itemIds, title, viewMoreUrl = null, overflowCard = false, cardFormat = null, sortOrder = null, sortOrderDirection = 'Ascending') {
            const LOG = (...args) => console.log('[KefinTweaks CardBuilder]', ...args);
            
            if (!itemIds || itemIds.length === 0) {
                LOG(`No item IDs provided for section: ${title}`);
                return createScrollableContainer([], title, viewMoreUrl, overflowCard, cardFormat);
            }

            try {
                // Fetch all items at once
                const response = await ApiClient.getItems(ApiClient.getCurrentUserId(), {
                    Ids: itemIds.join(','),
                    Recursive: false
                });
                const items = response.Items;
                
                LOG(`Fetched ${items.length} items for section: ${title}`);
                
                // Handle Random card format - pick one format for entire section
                let finalCardFormat = cardFormat;
                if (cardFormat === 'random' || cardFormat === 'Random') {
                    finalCardFormat = getRandomCardFormat();
                }
                
                // Sort items if sortOrder is provided
                let sortedItems = items;
                if (sortOrder && sortOrder !== 'Random') {
                    sortedItems = sortItems(items, sortOrder, sortOrderDirection);
                } else if (sortOrder === 'Random') {
                    sortedItems = shuffle([...items]);
                }
                
                const container = createScrollableContainer(sortedItems, title, viewMoreUrl, overflowCard, finalCardFormat);
                return container;
            } catch (error) {
                console.error('[KefinTweaks CardBuilder] Error fetching items:', error);
                return createScrollableContainer([], title, viewMoreUrl, overflowCard, cardFormat);
            }
        },
        
        /**
         * Renders a spotlight section (Netflix-style slim banner carousel)
         * @param {Array|Promise<Array>} items - Array of Jellyfin item objects or Promise resolving to array
         * @param {string} title - Title for the spotlight section
         * @param {Object} options - Options for the spotlight carousel
         * @param {boolean} options.progressiveEnhancement - If true and items is a Promise, render skeleton first
         * @returns {HTMLElement} - The constructed spotlight container
         */
        renderSpotlightSection: function(items, title, options = {}) {
            const { progressiveEnhancement = false } = options;
            
            // If progressive enhancement is enabled and items is a Promise
            if (progressiveEnhancement && items && typeof items.then === 'function') {
                // Create skeleton spotlight section immediately
                const skeletonSpotlightContainer = createSkeletonSpotlightSection(title, options);

                // Add identifying data-id
                const randomId = Math.random().toString(36).substring(2, 15);
                skeletonSpotlightContainer.setAttribute('data-skeleton-id', randomId);
                
                // When promise resolves, replace skeleton with real spotlight
                items.then(async items => {
                    // Remove the skeleton container if it exists
                    let skeletonContainerElement = document.querySelector(`[data-skeleton-id="${randomId}"]`);
    
                    // Let's try to find the skeleton 20 times every 100ms
                    for (let i = 0; i < 20; i++) {
                        skeletonContainerElement = document.querySelector(`[data-skeleton-id="${randomId}"]`);
                        if (skeletonContainerElement) {
                            break;
                        }
                        await new Promise(resolve => setTimeout(resolve, 150));
                    }

                    // Generate real spotlight section
                    const realContainer = createSpotlightSection(items, title, options);
                    
                    // Copy critical attributes to preserve layout/order
                    if (skeletonContainerElement.style.order) {
                        realContainer.style.order = skeletonContainer.style.order;
                    }
                    if (skeletonContainerElement.hasAttribute('data-section-id')) {
                        realContainer.setAttribute('data-section-id', skeletonContainerElement.getAttribute('data-section-id'));
                    }
                    
                    // Replace skeleton container with real container
                    skeletonContainerElement.replaceWith(realContainer);
                }).catch(error => {
                    console.error('[KefinTweaks CardBuilder] Error loading items for spotlight progressive enhancement:', error);
                    // Optionally remove skeleton on error or show error state
                    skeletonSpotlightContainer.remove();
                });

                return skeletonSpotlightContainer;
            }
            
            // Normal rendering (items is already an array)
            const container = createSpotlightSection(items, title, options);
            return container;
        },
        
        /**
         * Sorts items based on sort order and direction (exposed for use in homeScreen)
         * @param {Array} items - Array of Jellyfin items
         * @param {string} sortOrder - Sort order
         * @param {string} sortOrderDirection - Direction
         * @returns {Array} - Sorted array
         */
        sortItems: function(items, sortOrder, sortOrderDirection) {
            return sortItems(items, sortOrder, sortOrderDirection);
        },

        updateCardResumeAttributes: updateCardResumeAttributes,
        
    };

    /**
     * Blurhash base83 character set (must match official blurhash package: includes comma and period)
     * https://github.com/woltapp/blurhash/blob/master/TypeScript/src/base83.ts
     */
    const BLURHASH_B83 = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz#$%*+,-.:;=?@[]^_{|}~';

    function blurhashDecode83(str, from, length) {
        if (from + length > str.length) return NaN;
        let value = 0;
        for (let i = 0; i < length; i++) {
            const idx = BLURHASH_B83.indexOf(str[from + i]);
            if (idx < 0) return NaN;
            value = value * 83 + idx;
        }
        return value;
    }

    function blurhashSignPow(val, exp) {
        const sign = val < 0 ? -1 : 1;
        return sign * Math.pow(Math.abs(val), exp);
    }

    function blurhashLinearToSrgb(value) {
        const v = Math.max(0, Math.min(1, value));
        return v <= 0.0031308 ? Math.trunc(v * 12.92 * 255 + 0.5) : Math.trunc((1.055 * Math.pow(v, 1 / 2.4) - 0.055) * 255 + 0.5);
    }

    function blurhashSrgbToLinear(value) {
        const v = value / 255;
        return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
    }

    /**
     * Decode a blurhash string to RGBA pixel data (Uint8ClampedArray).
     * Matches the official blurhash package (same as Jellyfin's worker uses).
     * Layout: 1 char size, 1 char quantised max, 4 chars DC (24-bit), then 2 chars per AC (base-19 packed).
     */
    function blurhashDecode(blurhash, width, height) {
        if (!blurhash || blurhash.length < 6) return null;
        try {
            const sizeVal = blurhashDecode83(blurhash, 0, 1);
            if (isNaN(sizeVal)) return null;
            const numX = (sizeVal % 9) + 1;
            const numY = Math.floor(sizeVal / 9) + 1;
            const expectedLen = 4 + 2 * numX * numY;
            if (blurhash.length !== expectedLen) return null;

            const quantisedMax = blurhashDecode83(blurhash, 1, 1);
            if (isNaN(quantisedMax)) return null;
            const maxVal = (quantisedMax + 1) / 166;

            const components = [];
            for (let i = 0; i < numX * numY; i++) {
                if (i === 0) {
                    const dc = blurhashDecode83(blurhash, 2, 4);
                    if (isNaN(dc)) return null;
                    const intR = dc >> 16;
                    const intG = (dc >> 8) & 255;
                    const intB = dc & 255;
                    components.push([
                        blurhashSrgbToLinear(intR),
                        blurhashSrgbToLinear(intG),
                        blurhashSrgbToLinear(intB)
                    ]);
                } else {
                    const acVal = blurhashDecode83(blurhash, 4 + i * 2, 2);
                    if (isNaN(acVal)) return null;
                    const quantR = Math.floor(acVal / (19 * 19));
                    const quantG = Math.floor(acVal / 19) % 19;
                    const quantB = acVal % 19;
                    components.push([
                        blurhashSignPow((quantR - 9) / 9, 2) * maxVal,
                        blurhashSignPow((quantG - 9) / 9, 2) * maxVal,
                        blurhashSignPow((quantB - 9) / 9, 2) * maxVal
                    ]);
                }
            }

            const pixels = new Uint8ClampedArray(width * height * 4);
            for (let y = 0; y < height; y++) {
                for (let x = 0; x < width; x++) {
                    let r = 0, g = 0, b = 0;
                    for (let j = 0; j < numY; j++) {
                        const basisY = Math.cos((Math.PI * y * j) / height);
                        for (let i = 0; i < numX; i++) {
                            const basis = Math.cos((Math.PI * x * i) / width) * basisY;
                            const color = components[i + j * numX];
                            r += color[0] * basis;
                            g += color[1] * basis;
                            b += color[2] * basis;
                        }
                    }
                    const off = (y * width + x) * 4;
                    pixels[off] = blurhashLinearToSrgb(r);
                    pixels[off + 1] = blurhashLinearToSrgb(g);
                    pixels[off + 2] = blurhashLinearToSrgb(b);
                    pixels[off + 3] = 255;
                }
            }
            return pixels;
        } catch (e) {
            return null;
        }
    }

    /**
     * Draw decoded blurhash into an existing canvas (e.g. 20x20).
     * @param {HTMLCanvasElement} canvas - Canvas to draw into
     * @param {string} blurhashString - Blurhash string
     * @returns {boolean} - True if drawn successfully
     */
    function drawBlurhashToCanvas(canvas, blurhashString) {
        if (!canvas || !blurhashString) return false;
        const w = canvas.width || 20;
        const h = canvas.height || 20;
        const cacheKey = blurhashCacheKey(blurhashString, w, h);
        let pixels = blurhashCacheGet(cacheKey);
        if (!pixels) {
            pixels = blurhashDecode(blurhashString, w, h);
            if (pixels) blurhashCacheSet(cacheKey, pixels);
        }
        if (!pixels) return false;
        return applyBlurhashPixelsToCanvas(canvas, pixels);
    }

    // --- Deferred blurhash: cache + worker + near-viewport filler ---
    const BLURHASH_CACHE_MAX = 200;
    const blurhashPixelCache = new Map();
    let blurhashFillObserver = null;
    let blurhashWorker = null;
    let blurhashWorkerReqId = 0;
    const blurhashWorkerPending = new Map();
    const blurhashIdleQueue = [];
    let blurhashIdleScheduled = false;

    function blurhashCacheKey(blurhash, width, height) {
        return blurhash + '|' + width + 'x' + height;
    }

    function blurhashCacheGet(key) {
        if (!blurhashPixelCache.has(key)) return null;
        const val = blurhashPixelCache.get(key);
        blurhashPixelCache.delete(key);
        blurhashPixelCache.set(key, val);
        return val;
    }

    function blurhashCacheSet(key, pixels) {
        if (blurhashPixelCache.has(key)) blurhashPixelCache.delete(key);
        blurhashPixelCache.set(key, pixels);
        while (blurhashPixelCache.size > BLURHASH_CACHE_MAX) {
            const oldest = blurhashPixelCache.keys().next().value;
            blurhashPixelCache.delete(oldest);
        }
    }

    function shouldSkipBlurhashDecode() {
        try {
            if (navigator.connection && navigator.connection.saveData === true) return true;
        } catch (e) { /* ignore */ }
        try {
            if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return true;
        } catch (e) { /* ignore */ }
        return false;
    }

    function getBlurhashFillRootMargin() {
        return isMobileLayout() ? '120px' : '200px';
    }

    /**
     * Put pixels on canvas and show blurhash until the real image loads.
     * @returns {boolean}
     */
    function applyBlurhashPixelsToCanvas(canvas, pixels) {
        if (!canvas || !pixels || !canvas.isConnected) return false;
        const w = canvas.width || 20;
        const h = canvas.height || 20;
        const ctx = canvas.getContext('2d');
        if (!ctx) return false;

        const imageData = ctx.createImageData(w, h);
        imageData.data.set(pixels);
        ctx.putImageData(imageData, 0, 0);
        canvas.removeAttribute('data-blurhash-pending');

        const cardImageContainer = canvas.nextElementSibling;
        const imageAlreadyLoaded = cardImageContainer
            && cardImageContainer.classList
            && cardImageContainer.classList.contains('lazy-loaded');

        if (imageAlreadyLoaded) {
            canvas.classList.add('lazy-hidden');
            return true;
        }

        canvas.classList.remove('lazy-hidden');
        if (cardImageContainer && cardImageContainer.classList.contains('cardImageContainer')) {
            cardImageContainer.classList.add('lazy-hidden');
        }
        return true;
    }

    function getBlurhashWorkerSource() {
        return [
            'const BLURHASH_B83 = ' + JSON.stringify(BLURHASH_B83) + ';',
            blurhashDecode83.toString(),
            blurhashSignPow.toString(),
            blurhashLinearToSrgb.toString(),
            blurhashSrgbToLinear.toString(),
            blurhashDecode.toString(),
            'self.onmessage = function(e) {',
            '  var data = e.data || {};',
            '  var id = data.id;',
            '  try {',
            '    var pixels = blurhashDecode(data.blurhash, data.width || 20, data.height || 20);',
            '    if (!pixels) { self.postMessage({ id: id, ok: false }); return; }',
            '    self.postMessage({ id: id, ok: true, pixels: pixels.buffer }, [pixels.buffer]);',
            '  } catch (err) {',
            '    self.postMessage({ id: id, ok: false, error: String(err && err.message || err) });',
            '  }',
            '};'
        ].join('\n');
    }

    function ensureBlurhashWorker() {
        if (blurhashWorker) return blurhashWorker;
        if (typeof Worker === 'undefined') return null;
        try {
            const blob = new Blob([getBlurhashWorkerSource()], { type: 'application/javascript' });
            const url = URL.createObjectURL(blob);
            const worker = new Worker(url);
            worker.onmessage = (e) => {
                const data = e.data || {};
                const pending = blurhashWorkerPending.get(data.id);
                blurhashWorkerPending.delete(data.id);
                if (!pending) return;
                if (!data.ok || !data.pixels) {
                    pending.reject(new Error(data.error || 'Blurhash worker decode failed'));
                    return;
                }
                pending.resolve(new Uint8ClampedArray(data.pixels));
            };
            worker.onerror = (err) => {
                console.warn('[KefinTweaks CardBuilder] Blurhash worker error:', err);
                blurhashWorkerPending.forEach((p) => p.reject(err));
                blurhashWorkerPending.clear();
                try { worker.terminate(); } catch (e) { /* ignore */ }
                try { URL.revokeObjectURL(url); } catch (e) { /* ignore */ }
                blurhashWorker = null;
            };
            blurhashWorker = worker;
            return worker;
        } catch (e) {
            console.warn('[KefinTweaks CardBuilder] Could not create blurhash worker:', e);
            return null;
        }
    }

    function decodeBlurhashInWorker(blurhash, width, height) {
        return new Promise((resolve, reject) => {
            const worker = ensureBlurhashWorker();
            if (!worker) {
                reject(new Error('Blurhash worker unavailable'));
                return;
            }
            const id = ++blurhashWorkerReqId;
            blurhashWorkerPending.set(id, { resolve, reject });
            try {
                worker.postMessage({ id, blurhash, width, height });
            } catch (e) {
                blurhashWorkerPending.delete(id);
                reject(e);
            }
        });
    }

    function scheduleIdleBlurhashDrain() {
        if (blurhashIdleScheduled) return;
        blurhashIdleScheduled = true;
        const run = (deadline) => {
            blurhashIdleScheduled = false;
            let n = 0;
            while (blurhashIdleQueue.length && n < 4) {
                if (deadline && typeof deadline.timeRemaining === 'function' && deadline.timeRemaining() <= 0 && n > 0) {
                    break;
                }
                const job = blurhashIdleQueue.shift();
                n++;
                if (!job || !job.canvas || !job.canvas.isConnected) continue;
                if (!job.canvas.hasAttribute('data-blurhash-pending')) continue;
                const cacheKey = blurhashCacheKey(job.blurhash, job.w, job.h);
                let pixels = blurhashCacheGet(cacheKey);
                if (!pixels) {
                    pixels = blurhashDecode(job.blurhash, job.w, job.h);
                    if (pixels) blurhashCacheSet(cacheKey, pixels);
                }
                if (pixels) applyBlurhashPixelsToCanvas(job.canvas, pixels);
                else job.canvas.removeAttribute('data-blurhash-pending');
            }
            if (blurhashIdleQueue.length) scheduleIdleBlurhashDrain();
        };
        if (typeof requestIdleCallback === 'function') {
            requestIdleCallback(run, { timeout: 500 });
        } else {
            requestAnimationFrame(() => run({ timeRemaining: () => 5 }));
        }
    }

    function enqueueIdleBlurhashDecode(canvas, blurhash, width, height) {
        blurhashIdleQueue.push({ canvas, blurhash, w: width, h: height });
        scheduleIdleBlurhashDrain();
    }

    async function fillBlurhashCanvas(canvas) {
        if (!canvas || !canvas.isConnected) return;
        const blurhash = canvas.getAttribute('data-blurhash-pending');
        if (!blurhash) return;
        if (shouldSkipBlurhashDecode()) {
            canvas.removeAttribute('data-blurhash-pending');
            canvas.classList.add('lazy-hidden');
            return;
        }

        const w = canvas.width || 20;
        const h = canvas.height || 20;
        const cacheKey = blurhashCacheKey(blurhash, w, h);
        const cached = blurhashCacheGet(cacheKey);
        if (cached) {
            applyBlurhashPixelsToCanvas(canvas, cached);
            return;
        }

        try {
            const pixels = await decodeBlurhashInWorker(blurhash, w, h);
            if (!canvas.isConnected || canvas.getAttribute('data-blurhash-pending') !== blurhash) return;
            blurhashCacheSet(cacheKey, pixels);
            applyBlurhashPixelsToCanvas(canvas, pixels);
        } catch (e) {
            enqueueIdleBlurhashDecode(canvas, blurhash, w, h);
        }
    }

    function observeBlurhashCanvas(canvas) {
        if (!canvas || !canvas.hasAttribute('data-blurhash-pending')) return;
        if (shouldSkipBlurhashDecode()) {
            canvas.removeAttribute('data-blurhash-pending');
            canvas.classList.add('lazy-hidden');
            return;
        }
        initBlurhashFillObserver();
        if (blurhashFillObserver) {
            blurhashFillObserver.observe(canvas);
        } else {
            fillBlurhashCanvas(canvas);
        }
    }

    function initBlurhashFillObserver() {
        if (blurhashFillObserver) return;
        if (typeof IntersectionObserver === 'undefined') return;

        blurhashFillObserver = new IntersectionObserver((entries) => {
            entries.forEach((entry) => {
                if (!entry.isIntersecting) return;
                const canvas = entry.target;
                blurhashFillObserver.unobserve(canvas);
                fillBlurhashCanvas(canvas);
            });
        }, {
            threshold: 0,
            rootMargin: getBlurhashFillRootMargin()
        });
    }

    function observePendingBlurhashInNode(node) {
        if (!node || node.nodeType !== 1) return;
        if (node.matches && node.matches('canvas.blurhash-canvas[data-blurhash-pending]')) {
            observeBlurhashCanvas(node);
        }
        if (node.querySelectorAll) {
            node.querySelectorAll('canvas.blurhash-canvas[data-blurhash-pending]').forEach(observeBlurhashCanvas);
        }
    }

    /**
     * Get blurhash string for the card image when the image is from the current item.
     * Mirrors the image URL logic; returns undefined when image comes from parent/series (we don't have their ImageBlurHashes).
     * @param {Object} item - Jellyfin item
     * @param {string|null} cardFormat - 'backdrop'|'square'|'portrait'|'poster'|'thumb'|'series thumb'|'series poster'|null
     * @returns {string|undefined} - Blurhash string or undefined
     */
    function getBlurhashForCard(item, cardFormat) {
        const hashes = item.ImageBlurHashes;
        if (!hashes || typeof hashes !== 'object') return undefined;
        cardFormat = cardFormat?.toLowerCase() || null;

        if (cardFormat === 'backdrop') {
            if (item.BackdropImageTags && item.BackdropImageTags[0])
                return hashes.Backdrop?.[item.BackdropImageTags[0]];
            if (item.ImageTags?.Thumb) return hashes.Thumb?.[item.ImageTags.Thumb];
            if (item.ImageTags?.Primary) return hashes.Primary?.[item.ImageTags.Primary];
            return undefined;
        }
        if (cardFormat === 'square') {
            if (item.Type === 'Season' || item.Type === 'Series' || item.Type === 'Movie') {
                if (item.BackdropImageTags && item.BackdropImageTags[0])
                    return hashes.Backdrop?.[item.BackdropImageTags[0]];
                if (item.ImageTags?.Primary) return hashes.Primary?.[item.ImageTags.Primary];
                return undefined;
            }
            if (item.ImageTags?.Primary) return hashes.Primary?.[item.ImageTags.Primary];
            if (item.BackdropImageTags && item.BackdropImageTags[0])
                return hashes.Backdrop?.[item.BackdropImageTags[0]];
            if (item.ImageTags?.Thumb) return hashes.Thumb?.[item.ImageTags.Thumb];
            return undefined;
        }
        if (cardFormat === 'portrait' || cardFormat === 'poster') {
            if (item.Type === 'Episode' && item.SeriesPrimaryImageTag) return undefined;
            if (item.ImageTags?.Primary) return hashes.Primary?.[item.ImageTags.Primary];
            if (item.PrimaryImageTag) return hashes.Primary?.[item.PrimaryImageTag];
            if (item.ImageTags?.Thumb) return hashes.Thumb?.[item.ImageTags.Thumb];
            return undefined;
        }
        if (cardFormat === 'series poster') {
            if (item.SeriesPrimaryImageTag) return undefined;
            if (item.ImageTags?.Primary) return hashes.Primary?.[item.ImageTags.Primary];
            return undefined;
        }
        if (cardFormat === 'series thumb') {
            if (item.ParentThumbImageTag) return undefined;
            if (item.ParentBackdropImageTags && item.ParentBackdropImageTags[0]) return undefined;
            if (item.ImageTags?.Thumb) return hashes.Thumb?.[item.ImageTags.Thumb];
            if (item.BackdropImageTags && item.BackdropImageTags[0])
                return hashes.Backdrop?.[item.BackdropImageTags[0]];
            if (item.ImageTags?.Primary) return hashes.Primary?.[item.ImageTags.Primary];
            return undefined;
        }
        if (cardFormat === 'thumb') {
            if (item.Type === 'Episode') {
                if (item.ImageTags?.Primary) return hashes.Primary?.[item.ImageTags.Primary];
                if (item.PrimaryImageTag) return hashes.Primary?.[item.PrimaryImageTag];
                if (item.ImageTags?.Thumb) return hashes.Thumb?.[item.ImageTags.Thumb];
                return undefined;
            }
            if (item.ImageTags?.Thumb) return hashes.Thumb?.[item.ImageTags.Thumb];
            if (item.ImageTags?.Primary) return hashes.Primary?.[item.ImageTags.Primary];
            return undefined;
        }
        if (item.IsJellyseerr) return undefined;
        if (item.ImageTags?.Primary) return hashes.Primary?.[item.ImageTags.Primary];
        if (item.ImageTags?.Thumb) return hashes.Thumb?.[item.ImageTags.Thumb];
        if (item.BackdropImageTags && item.BackdropImageTags.length > 0)
            return hashes.Backdrop?.[item.BackdropImageTags[0]];
        return undefined;
    }

    function useEpisodeImagesInNextUpAndResume(userId) {
        return localStorage.getItem(`${userId}-useEpisodeImagesInNextUpAndResume`) === 'true';
    }

    function getItemMaterialIcon(item) {
        const itemType = item?.Type;
        if (itemType === 'CollectionFolder' || item?.CollectionType) {
            switch ((item.CollectionType || '').toLowerCase()) {
                case 'tvshows': return 'tv';
                case 'movies': return 'movie';
                case 'boxsets': return 'video_library';
                case 'playlists': return 'queue';
                case 'books': return 'book';
                case 'music': return 'music_note';
                case 'homevideos': return 'photo';
                case 'folders': return 'folder';
                case 'livetv': return 'live_tv';
                default: return 'folder';
            }
        }
        if (itemType === 'Movie') return 'movie';
        if (itemType === 'Series') return 'tv';
        if (itemType === 'Episode') return 'play_circle';
        if (itemType === 'Person') return 'person';
        if (itemType === 'MusicAlbum') return 'album';
        if (itemType === 'Audio') return 'music_note';
        if (itemType === 'Artist' || itemType === 'MusicArtist') return 'person';
        return 'folder';
    }

    function buildCollectionFolderHref(item, serverId, options = {}) {
        const { useHtmlExtension = false } = options;
        if (!item?.Id || (item.Type !== 'CollectionFolder' && !item.CollectionType)) return null;

        const id = item.Id;
        const ext = useHtmlExtension ? '.html' : '';
        switch ((item.CollectionType || '').toLowerCase()) {
            case 'movies':
                return `#/movies${ext}?topParentId=${id}&collectionType=movies`;
            case 'tvshows':
                return `#/tv${ext}?topParentId=${id}&collectionType=tvshows`;
            case 'music':
                return `#/music${ext}?topParentId=${id}&collectionType=music`;
            case 'livetv':
                return `#/livetv${ext}?collectionType=livetv`;
            default:
                return `#/list${ext}?parentId=${id}&serverId=${serverId}`;
        }
    }

    function getCollectionFolderUrl(item, serverId) {
        return buildCollectionFolderHref(item, serverId, { useHtmlExtension: false });
    }

    function createLibraryButtonElement(item) {
        const serverId = ApiClient.serverId();
        const icon = getItemMaterialIcon(item);
        const href = item.cardUrl
            || getCollectionFolderUrl(item, serverId)
            || `#/details?id=${item.Id}&serverId=${serverId}`;

        const link = document.createElement('a');
        link.setAttribute('is', 'emby-linkbutton');
        link.href = href;
        link.className = 'raised homeLibraryButton emby-button';
        if (item.Id) {
            link.setAttribute('data-id', item.Id);
        }

        const iconSpan = document.createElement('span');
        iconSpan.className = `material-icons homeLibraryIcon ${icon}`;
        iconSpan.setAttribute('aria-hidden', 'true');

        const textSpan = document.createElement('span');
        textSpan.className = 'homeLibraryText';
        textSpan.textContent = item.Name || '';

        link.appendChild(iconSpan);
        link.appendChild(textSpan);
        return link;
    }

    /**
     * Creates a Jellyfin card element from an item
     * @param {Object} item - The Jellyfin item object
     * @param {boolean} overflowCard - Use overflow card classes instead of normal card classes
     * @param {string} cardFormat - Override card format: 'portrait', 'backdrop', 'thumb', 'square', 'series thumb', 'series poster'
     * @param {string} customFooterText - Optional custom footer text (e.g., air date for episodes)
     * @param {boolean} useParentCard - When true, the parent item will be rendered as the card image and link
     * @returns {HTMLElement} - The constructed card element
     */
    function createJellyfinCardElement(item, overflowCard = false, cardFormat = null, customFooterText = null, useParentCard = false) {
        cardFormat = cardFormat?.toLowerCase() || null;
        if (cardFormat === 'button') {
            return createLibraryButtonElement(item);
        }

        const serverId = ApiClient.serverId();
        const serverAddress = ApiClient.serverAddress();
        const itemId = item.Id || '';
        const itemType = item.Type || 'Folder';
        const isCustomCard = !!(item.cardUrl || item.posterUrl || item.thumbUrl || item.squareUrl || item.imageUrl);
        let parentItem = null;

        if (item.Type === 'Timer') {
            parentItem = item;
            item = parentItem.ProgramInfo;
        }

        // Determine card type based on cardFormat override or item type
        let cardClass, padderClass, imageParams;

        // Use custom footer text from item property if not explicitly provided
        if (!customFooterText && item.CustomFooterText) {
            customFooterText = item.CustomFooterText;
        }

        if (cardFormat) {
            // Use specified cardFormat
            if (cardFormat === 'backdrop' || cardFormat === 'thumb' || cardFormat === 'series thumb' || cardFormat === 'logo' || cardFormat === 'clear art') {
                cardClass = overflowCard ? 'overflowBackdropCard' : 'backdropCard';
                padderClass = 'cardPadder-backdrop';
                imageParams = 'fillHeight=267&fillWidth=474';
            } else if (cardFormat === 'square' || cardFormat === 'disc') {
                cardClass = overflowCard ? 'overflowSquareCard' : 'squareCard';
                padderClass = 'cardPadder-square';
                imageParams = 'fillHeight=297&fillWidth=297';
            } else if (cardFormat === 'banner') {
                cardClass = overflowCard ? 'overflowBannerCard' : 'bannerCard';
                padderClass = 'cardPadder-banner';
                imageParams = 'fillHeight=100&fillWidth=540';
            } else {
                // portrait / poster / series poster (default)
                cardClass = overflowCard ? 'overflowPortraitCard' : 'portraitCard';
                padderClass = 'cardPadder-portrait';
                imageParams = 'fillHeight=446&fillWidth=297';
            }
        } else {
            // Use item type to determine card type
            if (itemType === 'Episode' || itemType === 'TvChannel') {
                cardClass = overflowCard ? 'overflowBackdropCard' : 'backdropCard';
                padderClass = 'cardPadder-backdrop';
                imageParams = 'fillHeight=267&fillWidth=474';
            } else if (['MusicAlbum', 'Audio', 'Artist', 'MusicArtist'].includes(itemType)) {
                cardClass = overflowCard ? 'overflowSquareCard' : 'squareCard';
                padderClass = 'cardPadder-square';
                imageParams = 'fillHeight=297&fillWidth=297';
            } else {
                // Default poster style for Movies, Series, etc.
                cardClass = overflowCard ? 'overflowPortraitCard' : 'portraitCard';
                padderClass = 'cardPadder-portrait';
                imageParams = 'fillHeight=446&fillWidth=297';
            }
        }

        const cardLinkId = useParentCard && (item.SeriesId || item.ParentId) ? (item.SeriesId || item.ParentId) : itemId;
        
        // Create the main card container
        const card = document.createElement('div');
        card.className = `card ${cardClass} card-hoverable card-withuserdata`;
        card.setAttribute('data-index', '0');
        card.setAttribute('data-isfolder', itemType === 'MusicAlbum' || itemType === 'Artist' || item.IsFolder ? 'true' : 'false');
        card.setAttribute('data-serverid', serverId);
        if (!isCustomCard) card.setAttribute('data-id', cardLinkId);
        if (isCustomCard) card.setAttribute('data-custom-card', 'true');
        card.setAttribute('data-type', itemType);
        card.setAttribute('data-retro-marquee', getRetroPosterMarqueeLabel(item));
        const mediaType = item.MediaType === 'Unknown' && item.ChannelId ? 'Video' : item.MediaType;
        card.setAttribute('data-mediatype', mediaType || 'Video');
        
        if (item.CollectionType) {
            card.setAttribute('data-collectiontype', item.CollectionType);
        }

        if (item.IsFolder && item.Path) {
            card.setAttribute('data-path', item.Path);
        }

        if (item.ChannelId) {
            card.setAttribute('data-channelid', item.ChannelId);
        }

        if (item.StartDate) {
            card.setAttribute('data-startdate', item.StartDate);
        }

        if (item.EndDate) {
            card.setAttribute('data-enddate', item.EndDate);
        }

        card.setAttribute('data-prefix', item.Name?.startsWith('The ') ? 'THE' : '');

        if (item.UserData?.PlaybackPositionTicks && item.UserData?.PlaybackPositionTicks > 0) {
            card.setAttribute('data-positionticks', item.UserData?.PlaybackPositionTicks);
        }

        // Card box container
        const cardBox = document.createElement('div');
        cardBox.className = `cardBox cardBox-bottompadded ${cardFormat === 'button' ? 'emby-button emby-button-foreground raised' : ''}`;

        // Card scalable container
        const cardScalable = document.createElement('div');
        cardScalable.className = 'cardScalable';

        // Card padder with icon
        const cardPadder = document.createElement('div');
        cardPadder.className = `cardPadder ${padderClass} lazy-hidden-children`;
        
        const cardIcon = document.createElement('span');
        cardIcon.className = 'cardImageIcon material-icons';
        cardIcon.setAttribute('aria-hidden', 'true');
        
        // Set icon based on item type
        cardIcon.textContent = getItemMaterialIcon(item);
        
        cardPadder.appendChild(cardIcon);

        // Blurhash canvas (placeholder) – will be filled and shown when we have a blurhash
        const blurhashCanvas = document.createElement('canvas');
        blurhashCanvas.setAttribute('aria-hidden', 'true');
        blurhashCanvas.width = 20;
        blurhashCanvas.height = 20;
        // lazy-hidden only when we have no blurhash (grey card until image loads)
        blurhashCanvas.className = 'blurhash-canvas';

        let libraryUrl = '';
        if (item.Type === 'CollectionFolder') {
            libraryUrl = buildCollectionFolderHref(item, serverId, { useHtmlExtension: true }) || '';
        }

        let cardUrl = item.cardUrl || libraryUrl || `#/details?id=${cardLinkId}&serverId=${serverId}`;

        if (!item.cardUrl && itemType === 'Genre') {
            const parentParam = item.ParentId ? `&parentId=${item.ParentId}` : '';
            cardUrl = `#/list.html?genreId=${item.Id}&serverId=${serverId}${parentParam}`;
        }

        let imageUrl = '';

        const hasCustomImages = item.posterUrl || item.thumbUrl || item.squareUrl || item.imageUrl
            || item.backdropUrl || item.bannerUrl || item.logoUrl;

        const imageItem = item.Type === 'Timer' ? item.ProgramInfo : item;

        if (hasCustomImages) {
            if (cardFormat === 'backdrop' || cardFormat === 'thumb' || cardFormat === 'series thumb') {
                imageUrl = `${item.backdropUrl || item.thumbUrl || item.imageUrl || item.posterUrl || item.squareUrl}`;
            } else if (cardFormat === 'banner') {
                imageUrl = `${item.bannerUrl || item.backdropUrl || item.thumbUrl || item.imageUrl || item.posterUrl || item.squareUrl}`;
            } else if (cardFormat === 'logo' || cardFormat === 'clear art') {
                imageUrl = `${item.logoUrl || item.imageUrl || item.posterUrl || item.thumbUrl || item.squareUrl}`;
            } else if (cardFormat === 'square') {
                imageUrl = `${item.squareUrl || item.imageUrl || item.posterUrl || item.thumbUrl}`;
            } else {
                // portrait/poster/series poster or default
                imageUrl = `${item.posterUrl || item.imageUrl || item.thumbUrl || item.squareUrl}`;
            }
        } else if (cardFormat === 'backdrop') {
            if (useParentCard && item.ParentBackdropImageTags && item.ParentBackdropImageTags[0]) {
                imageUrl = `${serverAddress}/Items/${item.ParentBackdropItemId}/Images/Backdrop?${imageParams}&quality=96&tag=${item.ParentBackdropImageTags[0]}`;
            } else if (useParentCard && item.ParentThumbImageTag) {
                imageUrl = `${serverAddress}/Items/${item.ParentThumbItemId}/Images/Thumb?${imageParams}&quality=96&tag=${item.ParentThumbImageTag}`;
            } else if (useParentCard && item.SeriesPrimaryImageTag) {
                imageUrl = `${serverAddress}/Items/${item.SeriesId}/Images/Primary?${imageParams}&quality=96&tag=${item.SeriesPrimaryImageTag}`;
            } else if (item.BackdropImageTags[0]) {
                imageUrl = `${serverAddress}/Items/${item.Id}/Images/Backdrop?${imageParams}&quality=96&tag=${item.BackdropImageTags[0]}`;
            } else if (item.ParentBackdropImageTags && item.ParentBackdropImageTags[0]) {
                imageUrl = `${serverAddress}/Items/${item.ParentBackdropItemId}/Images/Backdrop?${imageParams}&quality=96&tag=${item.ParentBackdropImageTags[0]}`;
            } else if (item.ImageTags?.Thumb) {
                imageUrl = `${serverAddress}/Items/${item.Id}/Images/Thumb?${imageParams}&quality=96&tag=${item.ImageTags?.Thumb}`;
            } else {
                imageUrl = `${serverAddress}/Items/${item.Id}/Images/Primary?${imageParams}&quality=96&tag=${item.ImageTags?.Primary}`;
            }
        } else if (cardFormat === 'square') {
            if (useParentCard && item.ParentBackdropImageTags && item.ParentBackdropImageTags[0]) {
                imageUrl = `${serverAddress}/Items/${item.ParentBackdropItemId}/Images/Backdrop?${imageParams}&quality=96&tag=${item.ParentBackdropImageTags[0]}`;
            } else if (useParentCard && item.ParentThumbImageTag) {
                imageUrl = `${serverAddress}/Items/${item.ParentThumbItemId}/Images/Thumb?${imageParams}&quality=96&tag=${item.ParentThumbImageTag}`;
            } else if (useParentCard && item.SeriesPrimaryImageTag) {
                imageUrl = `${serverAddress}/Items/${item.SeriesId}/Images/Primary?${imageParams}&quality=96&tag=${item.SeriesPrimaryImageTag}`;
            } else if (item.Type === 'Season' || item.Type === 'Series' || item.Type === 'Movie') {
                imageUrl = item.BackdropImageTags && item.BackdropImageTags[0] ? `${serverAddress}/Items/${item.Id}/Images/Backdrop?${imageParams}&quality=96&tag=${item.BackdropImageTags[0]}` : item.ImageTags?.Primary ? `${serverAddress}/Items/${item.Id}/Images/Primary?${imageParams}&quality=96&tag=${item.ImageTags?.Primary}` : '';
            } else if (item.ImageTags?.Primary) {
                imageUrl = `${serverAddress}/Items/${item.Id}/Images/Primary?${imageParams}&quality=96&tag=${item.ImageTags?.Primary}`;
            } else if (item.PrimaryImageTag && item.Type === 'Episode') { 
                imageUrl = `${serverAddress}/Items/${item.Id}/Images/Primary?${imageParams}&quality=96&tag=${item.PrimaryImageTag}`;
            } else if (item.BackdropImageTags && item.BackdropImageTags[0]) {
                imageUrl = `${serverAddress}/Items/${item.Id}/Images/Backdrop?${imageParams}&quality=96&tag=${item.BackdropImageTags[0]}`;
            } else if (item.ParentBackdropImageTags && item.ParentBackdropImageTags[0]) {
                imageUrl = `${serverAddress}/Items/${item.ParentBackdropItemId}/Images/Backdrop?${imageParams}&quality=96&tag=${item.ParentBackdropImageTags[0]}`;
            } else if (item.ImageTags?.Thumb) {
                imageUrl = `${serverAddress}/Items/${item.Id}/Images/Thumb?${imageParams}&quality=96&tag=${item.ImageTags?.Thumb}`;
            } else if (item.ParentThumbImageTag) {
                imageUrl = `${serverAddress}/Items/${item.ParentThumbItemId}/Images/Thumb?${imageParams}&quality=96&tag=${item.ParentThumbImageTag}`;
            } else if (item.SeriesPrimaryImageTag) {
                imageUrl = `${serverAddress}/Items/${item.SeriesId}/Images/Primary?${imageParams}&quality=96&tag=${item.SeriesPrimaryImageTag}`;
            } else if (item.PrimaryImageTag) { 
                imageUrl = `${serverAddress}/Items/${item.Id}/Images/Primary?${imageParams}&quality=96&tag=${item.PrimaryImageTag}`;
            } 
        } else if (cardFormat === 'portrait' || cardFormat === 'poster') {
            if ((useParentCard || item.Type === 'Episode') && item.SeriesPrimaryImageTag) {
                imageUrl = `${serverAddress}/Items/${item.SeriesId}/Images/Primary?${imageParams}&quality=96&tag=${item.SeriesPrimaryImageTag}`;                
            } else if (item.ImageTags?.Primary) {
                imageUrl = `${serverAddress}/Items/${item.Id}/Images/Primary?${imageParams}&quality=96&tag=${item.ImageTags?.Primary}`;
            } else if (item.PrimaryImageTag) {
                imageUrl = `${serverAddress}/Items/${item.Id}/Images/Primary?${imageParams}&quality=96&tag=${item.PrimaryImageTag}`;
            } else if (item.ImageTags?.Thumb) {
                imageUrl = `${serverAddress}/Items/${item.Id}/Images/Thumb?${imageParams}&quality=96&tag=${item.ImageTags?.Thumb}`;
            }
        } else if (cardFormat === 'series poster') {
            if (item.SeriesPrimaryImageTag) {
                imageUrl = `${serverAddress}/Items/${item.SeriesId}/Images/Primary?${imageParams}&quality=96&tag=${item.SeriesPrimaryImageTag}`;
            } else if (item.ImageTags?.Primary) {
                imageUrl = `${serverAddress}/Items/${item.Id}/Images/Primary?${imageParams}&quality=96&tag=${item.ImageTags.Primary}`;
            }
        } else if (cardFormat === 'series thumb') {
            if (item.ParentThumbImageTag) {
                imageUrl = `${serverAddress}/Items/${item.ParentThumbItemId || item.SeriesId}/Images/Thumb?${imageParams}&quality=96&tag=${item.ParentThumbImageTag}`;
            } else if (item.ParentBackdropImageTags && item.ParentBackdropImageTags[0]) {
                imageUrl = `${serverAddress}/Items/${item.ParentBackdropItemId}/Images/Backdrop?${imageParams}&quality=96&tag=${item.ParentBackdropImageTags[0]}`;
            } else if (item.ImageTags?.Thumb) {
                imageUrl = `${serverAddress}/Items/${item.Id}/Images/Thumb?${imageParams}&quality=96&tag=${item.ImageTags.Thumb}`;
            } else if (item.BackdropImageTags && item.BackdropImageTags[0]) {
                imageUrl = `${serverAddress}/Items/${item.Id}/Images/Backdrop?${imageParams}&quality=96&tag=${item.BackdropImageTags[0]}`;
            } else if (item.ImageTags?.Primary) {
                imageUrl = `${serverAddress}/Items/${item.Id}/Images/Primary?${imageParams}&quality=96&tag=${item.ImageTags.Primary}`;
            }
        } else if (cardFormat === 'thumb') {
            if (item.Type === 'Episode' && !useParentCard) {
                if (item.ImageTags?.Primary) {
                    imageUrl = `${serverAddress}/Items/${item.Id}/Images/Primary?${imageParams}&quality=96&tag=${item.ImageTags.Primary}`;
                } else if (item.PrimaryImageTag) {
                    imageUrl = `${serverAddress}/Items/${item.Id}/Images/Primary?${imageParams}&quality=96&tag=${item.PrimaryImageTag}`;
                } else if (item.ImageTags?.Thumb) {
                    imageUrl = `${serverAddress}/Items/${item.Id}/Images/Thumb?${imageParams}&quality=96&tag=${item.ImageTags.Thumb}`;
                } else if (item.ParentThumbImageTag) {
                    imageUrl = `${serverAddress}/Items/${item.ParentThumbItemId || item.SeriesId}/Images/Thumb?${imageParams}&quality=96&tag=${item.ParentThumbImageTag}`;
                } else if (item.ParentBackdropImageTags && item.ParentBackdropImageTags[0]) {
                    imageUrl = `${serverAddress}/Items/${item.ParentBackdropItemId}/Images/Backdrop?${imageParams}&quality=96&tag=${item.ParentBackdropImageTags[0]}`;
                } else if (item.SeriesPrimaryImageTag) {
                    imageUrl = `${serverAddress}/Items/${item.SeriesId}/Images/Primary?${imageParams}&quality=96&tag=${item.SeriesPrimaryImageTag}`;
                }
            } else if (useParentCard && item.ParentThumbImageTag) {
                imageUrl = `${serverAddress}/Items/${item.ParentThumbItemId}/Images/Thumb?${imageParams}&quality=96&tag=${item.ParentThumbImageTag}`;
            } else if (useParentCard && item.ParentBackdropImageTags && item.ParentBackdropImageTags[0]) {
                imageUrl = `${serverAddress}/Items/${item.ParentBackdropItemId}/Images/Backdrop?${imageParams}&quality=96&tag=${item.ParentBackdropImageTags[0]}`;
            } else if (item.ImageTags?.Thumb) {
                // Prefer explicit thumb on the item
                imageUrl = `${serverAddress}/Items/${item.Id}/Images/Thumb?${imageParams}&quality=96&tag=${item.ImageTags?.Thumb}`;
            } else if (item.ParentThumbImageTag) {
                // Fall back to a parent thumb (e.g. series thumb for episodes)
                imageUrl = `${serverAddress}/Items/${item.SeriesId}/Images/Thumb?${imageParams}&quality=96&tag=${item.ParentThumbImageTag}`;
            } else {
                // No item or parent thumb – decide between primary vs backdrop based on primary orientation
                const primaryAspect = typeof item.PrimaryImageAspectRatio === 'number' ? item.PrimaryImageAspectRatio : null;
                const hasPrimary = !!item.ImageTags?.Primary;
                const primaryLooksLikeThumb = hasPrimary && primaryAspect !== null && primaryAspect >= 1.5;

                if (primaryLooksLikeThumb) {
                    // Primary is a wide (e.g. 16:9) thumbnail – use it directly
                    imageUrl = `${serverAddress}/Items/${item.Id}/Images/Primary?${imageParams}&quality=96&tag=${item.ImageTags.Primary}`;
                } else if (item.BackdropImageTags && item.BackdropImageTags.length > 0) {
                    // Primary looks like a poster – prefer the item's backdrop
                    imageUrl = `${serverAddress}/Items/${item.Id}/Images/Backdrop?${imageParams}&quality=96&tag=${item.BackdropImageTags[0]}`;
                } else if (item.ParentBackdropImageTags && item.ParentBackdropImageTags.length > 0) {
                    // Fall back to a parent backdrop if the item has none
                    imageUrl = `${serverAddress}/Items/${item.ParentBackdropItemId}/Images/Backdrop?${imageParams}&quality=96&tag=${item.ParentBackdropImageTags[0]}`;
                } else if (hasPrimary) {
                    // No usable backdrop – final fallback to the item's primary (likely poster)
                    imageUrl = `${serverAddress}/Items/${item.Id}/Images/Primary?${imageParams}&quality=96&tag=${item.ImageTags.Primary}`;
                } else if (item.SeriesPrimaryImageTag) {
                    // As an absolute last resort, try the series primary
                    imageUrl = `${serverAddress}/Items/${item.SeriesId}/Images/Primary?${imageParams}&quality=96&tag=${item.SeriesPrimaryImageTag}`;
                }
            }
        } else if (cardFormat === 'logo' && (item.ImageTags?.Logo || item.ParentLogoImageTag)) {
            const logoTag = item.ImageTags?.Logo || item.ParentLogoImageTag;
            const itemId = item.ImageTags?.Logo ? item.Id : item.ParentLogoItemId;
            imageUrl = `${serverAddress}/Items/${itemId}/Images/Logo?${imageParams}&quality=96&tag=${logoTag}`;
        } else if (cardFormat === 'clear art' && item.ImageTags?.Art) {
            imageUrl = `${serverAddress}/Items/${item.Id}/Images/Art?${imageParams}&quality=96&tag=${item.ImageTags.Art}`;
        } else if (cardFormat === 'banner') {
            if (item.ImageTags?.Banner) {
                imageUrl = `${serverAddress}/Items/${item.Id}/Images/Banner?${imageParams}&quality=96&tag=${item.ImageTags.Banner}`;
            } else {
                imageUrl = `${serverAddress}/Items/${item.SeriesId || item.ParentId}/Images/Banner?${imageParams}&quality=96`;
            }
        } else if (cardFormat === 'disc' && item.ImageTags?.Disc) {
            imageUrl = `${serverAddress}/Items/${item.Id}/Images/Disc?${imageParams}&quality=96&tag=${item.ImageTags.Disc}`;
        } else if (item.ImageTags?.Primary) {
            if (item.IsJellyseerr) {
                // Jellyseerr items use external image URLs
                imageUrl = item.ImageTags.Primary.startsWith('http') 
                    ? item.ImageTags.Primary 
                    : `https://image.tmdb.org/t/p/w500${item.ImageTags.Primary}`;
            } else {
                // Regular Jellyfin items
                imageUrl = `${serverAddress}/Items/${item.Id}/Images/Primary?${imageParams}&quality=96&tag=${item.ImageTags.Primary}`;
            }
        } else if (item.ImageTags?.Thumb) {
            imageUrl = `${serverAddress}/Items/${item.Id}/Images/Thumb?${imageParams}&quality=96&tag=${item.ImageTags.Thumb}`;
        } else if ((item.Type === 'Season') && item.SeriesPrimaryImageTag) {
            imageUrl = `${serverAddress}/Items/${item.Id}/Images/Primary?${imageParams}&quality=96&tag=${item.SeriesPrimaryImageTag}`;
        } else if ((item.Type === 'Episode') && item.ParentThumbImageTag) {
            imageUrl = `${serverAddress}/Items/${item.ParentThumbItemId}/Images/Thumb?${imageParams}&quality=96&tag=${item.ParentThumbImageTag}`;
        } else if (item.BackdropImageTags && item.BackdropImageTags.length > 0) {
            imageUrl = `${serverAddress}/Items/${item.Id}/Images/Backdrop?${imageParams}&quality=96&tag=${item.BackdropImageTags[0]}`;
        } else if (item.ParentBackdropImageTags && item.ParentBackdropImageTags.length > 0) {
            imageUrl = `${serverAddress}/Items/${item.ParentBackdropItemId}/Images/Backdrop?${imageParams}&quality=96&tag=${item.ParentBackdropImageTags[0]}`;
        }

        // Card image container
        const cardImageContainer = document.createElement('a');
        cardImageContainer.href = cardUrl;
        cardImageContainer.className = `cardImageContainer ${!imageUrl ? 'defaultCardBackground' + state.defaultCardBackgroundNumber++ : ''} coveredImage cardContent itemAction lazy blurhashed lazy-image-fadein-fast`;
        cardImageContainer.setAttribute('data-action', 'link');
        cardImageContainer.setAttribute('aria-label', item.Name || 'Unknown');

        if (state.defaultCardBackgroundNumber > 5) {
            state.defaultCardBackgroundNumber = 1;
        }
        
        // No image - add icon as inner element
        if (!imageUrl) {
            const iconSpan = document.createElement('span');
            iconSpan.className = 'cardImageIcon material-icons';
            iconSpan.setAttribute('aria-hidden', 'true');
        
            // Set icon based on item type
            iconSpan.textContent = getItemMaterialIcon(item);            
            cardImageContainer.appendChild(iconSpan);
        }

        const blurhashStr = !item.imageUrl ? getBlurhashForCard(item, cardFormat) : null;
        if (!blurhashStr || cardFormat === 'logo' || cardFormat === 'clear art' || cardFormat === 'disc') {
            blurhashCanvas.classList.add('lazy-hidden');
        } else if (shouldSkipBlurhashDecode()) {
            // Skip CPU decode; keep default chrome / lazy image path only
            blurhashCanvas.classList.add('lazy-hidden');
        } else {
            // Defer decode off the construction path — near-viewport filler paints later
            blurhashCanvas.classList.add('lazy-hidden');
            blurhashCanvas.setAttribute('data-blurhash-pending', blurhashStr);
        }

        if (imageUrl) {
            // Use data-src for lazy loading instead of immediate backgroundImage
            cardImageContainer.setAttribute('data-src', imageUrl);
            if (blurhashStr
                && cardFormat !== 'logo'
                && cardFormat !== 'clear art'
                && cardFormat !== 'disc') {
                cardImageContainer.setAttribute('data-blurhash', blurhashStr);
            }
            // Add lazy class for styling/selection
            cardImageContainer.classList.add('lazy');
        }
        //countIndicator indicator

        if (!isCustomCard) {
            const cardIndicators = document.createElement('div');
            cardIndicators.className = 'cardIndicators';

            if (item.UserData?.UnplayedItemCount && item.UserData?.UnplayedItemCount > 0) {
                const unplayedIndicator = document.createElement('div');
                unplayedIndicator.className = 'countIndicator indicator';
                unplayedIndicator.textContent = item.UserData?.UnplayedItemCount;
                cardIndicators.appendChild(unplayedIndicator);
            }

            if (item.LocationType === 'Virtual') {
                if (item.PremiereDate && new Date(item.PremiereDate) > new Date()) {
                    const premiereIndicator = document.createElement('div');
                    premiereIndicator.className = 'unairedIndicator';
                    premiereIndicator.textContent = 'Unaired';
                    cardIndicators.appendChild(premiereIndicator);
                } else {
                    const virtualIndicator = document.createElement('div');
                    virtualIndicator.className = 'missingIndicator';
                    virtualIndicator.textContent = 'Missing';
                    cardIndicators.appendChild(virtualIndicator);
                }
            }

            if (item.UserData?.Played) {
                const playedIndicator = document.createElement('div');
                playedIndicator.className = 'playedIndicator indicator';
                const playedIndicatorIcon = document.createElement('span');
                playedIndicatorIcon.className = 'material-icons indicatorIcon check';
                playedIndicatorIcon.setAttribute('aria-hidden', 'true');
                playedIndicator.appendChild(playedIndicatorIcon);
                cardIndicators.appendChild(playedIndicator);
            }

            if (parentItem && parentItem.Type === 'Timer') {
                const timerIndicator = document.createElement('span');
                timerIndicator.className = 'material-icons timerIndicator indicatorIcon fiber_manual_record';
                timerIndicator.setAttribute('aria-hidden', 'true');
                cardIndicators.appendChild(timerIndicator);
            }

            if (cardIndicators.childElementCount > 0) {
                cardImageContainer.appendChild(cardIndicators);
            }

            if (item.MediaSourceCount > 1) {
                const mediaSourceIndicator = document.createElement('div');
                mediaSourceIndicator.className = 'mediaSourceIndicator';
                mediaSourceIndicator.textContent = item.MediaSourceCount;
                cardImageContainer.appendChild(mediaSourceIndicator);
            }

            if (item.UserData?.PlayedPercentage && item.UserData?.PlayedPercentage > 0) {
                const innerCardFooter = document.createElement('div');
                innerCardFooter.className = 'innerCardFooter fullInnerCardFooter innerCardFooterClear';
                cardBox.appendChild(innerCardFooter);
                const itemProgressBar = document.createElement('div');
                itemProgressBar.className = 'itemProgressBar';
                const itemProgressBarForeground = document.createElement('div');
                itemProgressBarForeground.className = 'itemProgressBarForeground';
                itemProgressBarForeground.style.width = `${item.UserData?.PlayedPercentage}%`;
                itemProgressBar.appendChild(itemProgressBarForeground);
                innerCardFooter.appendChild(itemProgressBar);
                cardImageContainer.appendChild(innerCardFooter);
            }

            if (item.ChannelId && item.StartDate && item.RunTimeTicks && (Date.now() >= new Date(item.StartDate).getTime() && Date.now() <= new Date(item.EndDate).getTime())) {
                // Get current progress based on current time and StartDate + EndDate
                const progress = (new Date().getTime() - new Date(item.StartDate).getTime()) / (new Date(item.EndDate).getTime() - new Date(item.StartDate).getTime());
                const progressPercentage = progress * 100;

                const innerCardFooter = document.createElement('div');
                innerCardFooter.className = 'innerCardFooter fullInnerCardFooter innerCardFooterClear';
                cardBox.appendChild(innerCardFooter);
                const itemProgressBar = document.createElement('div');
                itemProgressBar.className = 'itemProgressBar';
                const itemProgressBarForeground = document.createElement('div');
                itemProgressBarForeground.className = 'itemProgressBarForeground';
                itemProgressBarForeground.style.width = `${progressPercentage}%`;
                itemProgressBar.appendChild(itemProgressBarForeground);
                innerCardFooter.appendChild(itemProgressBar);
                cardImageContainer.appendChild(innerCardFooter);
            }
        }

        // Card overlay container
        const cardOverlayContainer = document.createElement('div');
        cardOverlayContainer.className = 'cardOverlayContainer itemAction';
        cardOverlayContainer.setAttribute('data-action', 'link');

        // Overlay link (first so it sits under buttons)
        const overlayLink = document.createElement('a');
        overlayLink.href = cardUrl;
        overlayLink.className = 'cardImageContainer';
        cardOverlayContainer.appendChild(overlayLink);

        if (!isCustomCard) {
            // Play button
            const playButton = document.createElement('button');
            playButton.setAttribute('is', 'paper-icon-button-light');
            playButton.className = 'cardOverlayButton cardOverlayButton-hover itemAction paper-icon-button-light cardOverlayFab-primary';
            playButton.setAttribute('data-action', 'resume');

            const playIcon = document.createElement('span');
            playIcon.className = 'material-icons cardOverlayButtonIcon cardOverlayButtonIcon-hover play_arrow';
            playIcon.setAttribute('aria-hidden', 'true');
            playButton.appendChild(playIcon);

            // Button container for additional overlay buttons (watchlist, etc.)
            const buttonContainer = document.createElement('div');
            buttonContainer.className = 'cardOverlayButton-br flex';

            // Watchlist button (active state from UserData.Likes; click bound by watchlist.js)
            const watchlistSupportedTypes = ['Movie', 'Series', 'Season', 'Episode', 'BoxSet', 'Playlist', 'Video'];
            if (watchlistSupportedTypes.includes(itemType)) {
                const isLiked = item.UserData?.Likes === true;
                const watchlistButton = document.createElement('button');
                watchlistButton.type = 'button';
                watchlistButton.className = 'watchlist-button cardOverlayButton cardOverlayButton-hover itemAction paper-icon-button-light emby-button button-flat';
                watchlistButton.setAttribute('data-action', 'none');
                watchlistButton.setAttribute('data-id', itemId);
                watchlistButton.setAttribute('data-active', isLiked ? 'true' : 'false');
                watchlistButton.title = isLiked ? 'Remove from Watchlist' : 'Add to Watchlist';

                const watchlistIcon = document.createElement('span');
                watchlistIcon.className = 'material-icons cardOverlayButtonIcon cardOverlayButtonIcon-hover watchlist';
                watchlistIcon.setAttribute('aria-hidden', 'true');
                watchlistButton.appendChild(watchlistIcon);
                buttonContainer.appendChild(watchlistButton);
            }

            // Watched button
            const watchedButton = document.createElement('button');
            watchedButton.setAttribute('is', 'emby-playstatebutton');
            watchedButton.type = 'button';
            watchedButton.setAttribute('data-action', 'none');
            watchedButton.className = 'cardOverlayButton cardOverlayButton-hover itemAction paper-icon-button-light emby-button';
            watchedButton.setAttribute('data-id', itemId);
            watchedButton.setAttribute('data-serverid', serverId);
            watchedButton.setAttribute('data-itemtype', itemType);
            watchedButton.setAttribute('data-played', item.UserData?.Played || 'false');
            watchedButton.title = 'Mark played';

            const watchedIcon = document.createElement('span');
            watchedIcon.className = 'material-icons cardOverlayButtonIcon cardOverlayButtonIcon-hover check playstatebutton-icon-unplayed';
            watchedIcon.setAttribute('aria-hidden', 'true');
            watchedButton.appendChild(watchedIcon);
            buttonContainer.appendChild(watchedButton);

            // Favorite button
            const favoriteButton = document.createElement('button');
            favoriteButton.setAttribute('is', 'emby-ratingbutton');
            favoriteButton.type = 'button';
            favoriteButton.setAttribute('data-action', 'none');
            favoriteButton.className = 'cardOverlayButton cardOverlayButton-hover itemAction paper-icon-button-light emby-button';
            favoriteButton.setAttribute('data-id', itemId);
            favoriteButton.setAttribute('data-serverid', serverId);
            favoriteButton.setAttribute('data-itemtype', itemType);
            favoriteButton.setAttribute('data-likes', '');
            favoriteButton.setAttribute('data-isfavorite', item.UserData?.IsFavorite || 'false');
            favoriteButton.title = 'Add to favorites';

            const favoriteIcon = document.createElement('span');
            favoriteIcon.className = 'material-icons cardOverlayButtonIcon cardOverlayButtonIcon-hover favorite';
            favoriteIcon.setAttribute('aria-hidden', 'true');
            favoriteButton.appendChild(favoriteIcon);
            buttonContainer.appendChild(favoriteButton);

            const moreButton = document.createElement('button');
            moreButton.setAttribute('is', 'paper-icon-button-light');
            moreButton.className = 'cardOverlayButton cardOverlayButton-hover itemAction paper-icon-button-light';
            moreButton.setAttribute('data-action', 'menu');
            moreButton.title = 'More';
            const moreIcon = document.createElement('span');
            moreIcon.className = 'material-icons cardOverlayButtonIcon cardOverlayButtonIcon-hover more_vert';
            moreIcon.setAttribute('aria-hidden', 'true');
            moreButton.appendChild(moreIcon);

            buttonContainer.appendChild(moreButton);

            if (item.Type !== 'CollectionFolder' && item.Type !== 'Folder' && item.Type !== 'UserView') {
                cardOverlayContainer.appendChild(playButton);
            }
            cardOverlayContainer.appendChild(buttonContainer);
        }

        // Card text container - different structure for episodes
        const cardTextFragment = document.createDocumentFragment();

        const cardTextContainer = document.createElement('div');
        cardTextContainer.className = 'cardText cardTextCentered cardText-first';

        if (parentItem && parentItem.Type === 'Timer') {
            const cardFooter = document.createElement('div');
            cardFooter.className = 'cardFooter cardFooter-withlogo';
            const cardFooterLogo = document.createElement('div');
            cardFooterLogo.className = 'lazy cardFooterLogo lazy-image-fadein-fast';
            const imageUrl = `${serverAddress}/Items/${parentItem.ChannelId}/Images/Primary?height=40&tag=${parentItem.ChannelPrimaryImageTag}&quality=90`;
            cardFooterLogo.style.backgroundImage = `url(${imageUrl})`;
            cardFooter.appendChild(cardFooterLogo);

            const cardFooterText = document.createElement('div');
            cardFooterText.className = 'cardText cardText-first';
            cardFooterText.textContent = item.Name || 'Unknown';
            cardFooter.appendChild(cardFooterText);

            const cardFooterSecondaryText = document.createElement('div');
            cardFooterSecondaryText.className = 'cardText cardText-secondary';
            // format the start and end time to 12:21 AM - 2:39 AM
            const startTime = new Date(parentItem.StartDate).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
            const endTime = new Date(parentItem.EndDate).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
            cardFooterSecondaryText.textContent = startTime + ' - ' + endTime;
            cardFooter.appendChild(cardFooterSecondaryText);

            cardTextFragment.appendChild(cardFooter);
        } else if (itemType === 'Episode') {
            // Episodes: Series name as primary, episode title as secondary
            const seriesLink = document.createElement('a');
            seriesLink.href = `${ApiClient._serverAddress}/web/#/details?id=${item.SeriesId || itemId}&serverId=${serverId}`;
            seriesLink.className = 'itemAction textActionButton';
            if (!isCustomCard) seriesLink.setAttribute('data-id', item.SeriesId || itemId);
            seriesLink.setAttribute('data-serverid', serverId);
            seriesLink.setAttribute('data-type', 'Series');
            seriesLink.setAttribute('data-mediatype', 'undefined');
            seriesLink.setAttribute('data-channelid', 'undefined');
            seriesLink.setAttribute('data-isfolder', 'true');
            seriesLink.setAttribute('data-action', 'link');
            seriesLink.title = item.SeriesName || 'Unknown Series';
            seriesLink.textContent = item.SeriesName || 'Unknown Series';

            const seriesBdi = document.createElement('bdi');
            seriesBdi.appendChild(seriesLink);
            cardTextContainer.appendChild(seriesBdi);
            cardTextFragment.appendChild(cardTextContainer);

            // Episode title as secondary
            const secondaryText = document.createElement('div');
            secondaryText.className = 'cardText cardTextCentered cardText-secondary';
            const episodeLink = document.createElement('a');
            const episodeName = item.IndexNumber && item.ParentIndexNumber ? `S${item.ParentIndexNumber}:E${item.IndexNumber} - ${item.Name}` : item.Name;
            episodeLink.href = `${ApiClient._serverAddress}/web/#/details?id=${itemId}&serverId=${serverId}`;
            episodeLink.className = 'itemAction textActionButton';
            if (!isCustomCard) episodeLink.setAttribute('data-id', itemId);
            episodeLink.setAttribute('data-serverid', serverId);
            episodeLink.setAttribute('data-type', 'Episode');
            episodeLink.setAttribute('data-mediatype', 'undefined');
            episodeLink.setAttribute('data-channelid', 'undefined');
            episodeLink.setAttribute('data-isfolder', 'false');
            episodeLink.setAttribute('data-action', 'link');
            episodeLink.title = episodeName;
            episodeLink.textContent = episodeName;

            const episodeBdi = document.createElement('bdi');
            episodeBdi.appendChild(episodeLink);
            secondaryText.appendChild(episodeBdi);
            cardTextFragment.appendChild(secondaryText);
            
            // Add custom footer text if provided (e.g., air date)
            if (customFooterText) {
                const footerText = document.createElement('div');
                footerText.className = 'cardText cardTextCentered cardText-secondary';
                const footerBdi = document.createElement('bdi');
                footerBdi.textContent = customFooterText;
                footerText.appendChild(footerBdi);
                cardTextFragment.appendChild(footerText);
            }
        } else {
            // Default: Item name as primary, year as secondary
            const titleLink = document.createElement('a');
            titleLink.href = cardUrl;
            titleLink.className = 'itemAction textActionButton';
            if (!isCustomCard) titleLink.setAttribute('data-id', itemId);
            titleLink.setAttribute('data-serverid', serverId);
            titleLink.setAttribute('data-type', itemType);
            titleLink.setAttribute('data-mediatype', 'undefined');
            titleLink.setAttribute('data-channelid', 'undefined');
            titleLink.setAttribute('data-isfolder', itemType === 'MusicAlbum' || itemType === 'Artist' || itemType === 'MusicArtist' || item.IsFolder ? 'true' : 'false');
            
            if (item.CollectionType) {
                titleLink.setAttribute('data-collectiontype', item.CollectionType);
            }

            titleLink.setAttribute('data-action', 'link');
            titleLink.title = item.Name || 'Unknown';
            titleLink.textContent = item.Name || 'Unknown';

            const titleBdi = document.createElement('bdi');
            titleBdi.appendChild(titleLink);
            cardTextContainer.appendChild(titleBdi);
            cardTextFragment.appendChild(cardTextContainer);

            // Secondary text (year)
            const secondaryTextContent = item.ProductionYear || item.PremiereDate?.substring(0, 4) || '';
            const secondaryText = document.createElement('div');
            secondaryText.className = 'cardText cardTextCentered cardText-secondary';
            const yearBdi = document.createElement('bdi');
            yearBdi.textContent = secondaryTextContent || item.CustomFooterText;
            secondaryText.appendChild(yearBdi);
            cardTextFragment.appendChild(secondaryText);

            if (secondaryTextContent && item.CustomFooterText) {
                const footerText = document.createElement('div');
                footerText.className = 'cardText cardTextCentered cardText-secondary';
                const footerBdi = document.createElement('bdi');
                footerBdi.textContent = item.CustomFooterText;
                footerText.appendChild(footerBdi);
                cardTextFragment.appendChild(footerText);
            }
        }

        // Assemble card (blurhash already drawn above when blurhashStr was set)
        cardScalable.appendChild(cardPadder);
        cardScalable.appendChild(blurhashCanvas);
        cardScalable.appendChild(cardImageContainer);
        cardScalable.appendChild(cardOverlayContainer);
        cardScalable.appendChild(createCardBorderHost());

        cardBox.appendChild(cardScalable);
        if (cardTextFragment.childNodes.length) {
            const cardTextStack = document.createElement('div');
            cardTextStack.className = 'cardTextStack';
            cardTextStack.appendChild(cardTextFragment);
            cardBox.appendChild(cardTextStack);
        } else {
            cardBox.appendChild(cardTextFragment);
        }
        
        card.appendChild(cardBox);

        ensureCardRadiusCssVar();
        if (cachedCardRadius == null) {
            requestAnimationFrame(() => ensureCardRadiusCssVar());
        }

        return card;
    }

    /**
     * Renders a spotlight section (Netflix-style slim banner carousel)
     * @param {Array} items - Array of Jellyfin item objects
     * @param {string} title - Title for the spotlight section
     * @param {Object} options - Options for the spotlight carousel
     * @param {boolean} options.autoPlay - Auto-cycle through items (default: true)
     * @param {number} options.interval - Auto-play interval in ms (default: 10000)
     * @param {boolean} options.showSlideState - Show slide state container (dots or numeric) (default: true)
     * @param {boolean} options.showDots - When showSlideState is true: true = dots (max 5), false = numeric "N / X" (default: true)
     * @param {boolean} options.showNavButtons - Show prev/next buttons (default: true)
     * @param {boolean} options.pauseOnHover - Pause auto-cycle when cursor is over spotlight (default: true, false when fullScreen)
     * @returns {HTMLElement} - The constructed spotlight container
     */
    function createSpotlightSection(items, title, options = {}) {
        if (!items || items.length === 0) {
            return document.createElement('div');
        }

        const {
            autoPlay = true,
            interval = 10000,
            showSlideState = true,
            showDots = true,
            showNavButtons = true,
            showClearArt = false,
            panAnimation = true,
            spotlightLayout,
            spotlightSize,
            tileCount: tileCountOpt,
            cycleBackdrops = false,
            cycleBackdropsTime,
            backdropsCount: backdropsCountOpt,
            entranceAnimationFirst = 'fadeIn',
            entranceAnimationSecond = 'fadeIn',
            entranceAnimationThird = 'fadeIn',
            slideAnimationFirst = 'kenBurnsZoomIn',
            slideAnimationSecond = 'kenBurnsZoomIn',
            slideAnimationThird = 'kenBurnsZoomIn',
            viewMoreUrl = null,
            initialIndex = 0
        } = options;
        // Backward compat: derive layout/size from fullScreen if new keys missing
        const fullScreen = options.fullScreen === true;
        const layout = spotlightLayout ?? (fullScreen ? 'Borderless' : 'Border');
        const size = spotlightSize ?? (fullScreen ? 'full' : 'normal');
        let tileCount = tileCountOpt;
        if (tileCount == null || tileCount < 1 || tileCount > 3) {
            tileCount = size === 'full' ? 1 : size === 'large' ? 2 : 3;
        }
        tileCount = Math.max(1, Math.min(3, Math.floor(tileCount)));
        let backdropsCount = backdropsCountOpt;
        if (backdropsCount == null && cycleBackdropsTime > 0 && interval > 0) {
            backdropsCount = Math.max(1, Math.round(interval / cycleBackdropsTime));
        }
        backdropsCount = Math.max(1, parseInt(backdropsCount, 10) || 1);
        const perBackdropMs = Math.max(500, Math.round(interval / backdropsCount));
        const serverId = ApiClient.serverId();
        const serverAddress = ApiClient.serverAddress();
        const sectionKey = 'spotlight_' + Date.now() + '_' + Math.random().toString(36).slice(2, 9);
        const cycleBackdropMap = new Map();
        let currentIndex = Math.max(0, Math.min(items.length - 1, parseInt(initialIndex, 10) || 0));
        let autoPlayTimer = null;
        let cycleBackdropTimer = null;
        let advanceDue = false;
        let isPaused = false;
        let isVisible = true; // updated by Intersection Observer; start true so initial startAutoPlay runs
        let currentSlideAnimationComplete = false;

        function shuffleArray(arr) {
            const a = arr.slice();
            for (let i = a.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [a[i], a[j]] = [a[j], a[i]];
            }
            return a;
        }

        // Create main container
        const container = document.createElement('div');
        container.className = 'spotlight-section padded-left';
        
        // Create banner container
        const bannerContainer = document.createElement('div');
        bannerContainer.className = 'spotlight-banner-container';
        
        // Title container hosts section name + refresh/configure controls.
        // Always create it so controls can attach even when the section has no name.
        {
            const sectionTitleContainer = document.createElement('div');
            sectionTitleContainer.className = 'spotlight-section-title-container';

            if (title) {
                let sectionTitleEl;

                if (viewMoreUrl) {
                    const titleLink = document.createElement('a');
                    titleLink.className = 'emby-tab-button emby-tab-button-active';
                    titleLink.textContent = title;
                    titleLink.title = 'See All';
                    titleLink.style.textDecoration = 'none';

                    if (typeof viewMoreUrl === 'function') {
                        titleLink.addEventListener('click', (e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            viewMoreUrl();
                        });
                    } else {
                        titleLink.href = viewMoreUrl;
                        titleLink.addEventListener('click', (e) => {
                            e.stopPropagation();
                        });
                    }

                    sectionTitleEl = titleLink;
                } else {
                    sectionTitleEl = document.createElement('div');
                    sectionTitleEl.className = 'emby-tab-button emby-tab-button-active emby-button-foreground';
                    sectionTitleEl.textContent = title;
                }

                const sectionTitleWrapper = document.createElement('div');
                sectionTitleWrapper.className = `spotlight-section-title ${viewMoreUrl ? '' : 'spotlight-title-link '}headerTabs sectionTabs`;
                sectionTitleWrapper.appendChild(sectionTitleEl);
                sectionTitleContainer.appendChild(sectionTitleWrapper);
            }

            bannerContainer.appendChild(sectionTitleContainer);
        }
        
        // Create items container (for fade transitions)
        const itemsContainer = document.createElement('div');
        itemsContainer.className = 'spotlight-items-container';

        function applyAnimationToImg(img, entranceName, slideName) {
            img.style.setProperty('--spotlight-entrance-animation', entranceName);
            img.style.setProperty('--spotlight-slide-animation', slideName);
            img.setAttribute('data-entrance-animation', entranceName);
            img.setAttribute('data-slide-animation', slideName);
        }

        // Sliding window: render current + 4 prev + 4 next (9 slides). Update DOM as user navigates.
        let currentWindowIndices = getSpotlightWindowIndices(currentIndex, items.length);

        function createAndAppendSlide(item, index, eagerLoadImages) {
            const itemType = item.Type || 'Movie';
            
            const itemDiv = document.createElement('div');
            itemDiv.className = 'spotlight-item';
            itemDiv.setAttribute('data-id', item.Id);
            itemDiv.setAttribute('data-index', String(index));
            itemDiv.setAttribute('data-item-type', itemType);

            let imageUrl = '';

            // Build list of available backdrop sources for this item
            let backdropSources = [];

            if (item.Type === 'Episode' && Array.isArray(item.ParentBackdropImageTags) && item.ParentBackdropImageTags.length) {
                backdropSources = item.ParentBackdropImageTags.map(tag => ({
                    itemId: item.ParentBackdropItemId,
                    tag
                }));
            } else if (Array.isArray(item.BackdropImageTags) && item.BackdropImageTags.length) {
                backdropSources = item.BackdropImageTags.map(tag => ({
                    itemId: item.Id,
                    tag
                }));
            }

            // Set backdrop width based on client width either 1920 or 1280, 640 is the minimum
            const clientWidth = window.innerWidth;
            let backdropWidth = 1920;
            if (clientWidth < 1280) {
                backdropWidth = 1280;
            } else if (clientWidth < 640) {
                backdropWidth = 640;
            }

            const buildBackdropUrl = (src, idx) =>
                `${serverAddress}/Items/${src.itemId}/Images/Backdrop/${idx}?fillWidth=${backdropWidth}&quality=96&tag=${src.tag}`;

            /* Cap layers by available backdrops so we never build dual/triple with undefined sources. */
            const effectiveTileCount = Math.min(tileCount, Math.max(1, backdropSources.length));

            if (effectiveTileCount >= 2 && backdropSources.length >= 2) {
                const indices = shuffleArray(backdropSources.map((_, i) => i));
                const pick = (i) => backdropSources[indices[i]];
                const dualBackgroundContainer = document.createElement('div');
                dualBackgroundContainer.className = 'spotlight-background-dual';

                const leftLayer = document.createElement('div');
                leftLayer.className = 'spotlight-background-layer spotlight-background-layer-left';
                const leftImg = document.createElement('img');
                const leftUrl = buildBackdropUrl(pick(0), indices[0]);
                leftImg.setAttribute('data-src', leftUrl);
                leftImg.alt = '';
                leftImg.draggable = false;
                applyAnimationToImg(leftImg, entranceAnimationFirst, slideAnimationFirst);
                if (eagerLoadImages) {
                    leftImg.src = leftUrl;
                    leftImg.loading = 'eager';
                }
                leftLayer.appendChild(leftImg);
                dualBackgroundContainer.appendChild(leftLayer);

                if (effectiveTileCount >= 3) {
                    const centerLayer = document.createElement('div');
                    centerLayer.className = 'spotlight-background-layer spotlight-background-layer-center';
                    const centerImg = document.createElement('img');
                    const centerUrl = buildBackdropUrl(pick(1), indices[1]);
                    centerImg.setAttribute('data-src', centerUrl);
                    centerImg.alt = '';
                    centerImg.draggable = false;
                    applyAnimationToImg(centerImg, entranceAnimationSecond, slideAnimationSecond);
                    if (eagerLoadImages) {
                        centerImg.src = centerUrl;
                        centerImg.loading = 'eager';
                    }
                    centerLayer.appendChild(centerImg);
                    dualBackgroundContainer.appendChild(centerLayer);
                }

                const rightLayer = document.createElement('div');
                rightLayer.className = 'spotlight-background-layer spotlight-background-layer-right';
                const rightImg = document.createElement('img');
                const rightIdx = effectiveTileCount >= 3 ? 2 : 1;
                const rightUrl = buildBackdropUrl(pick(rightIdx), indices[rightIdx]);
                rightImg.setAttribute('data-src', rightUrl);
                rightImg.alt = '';
                rightImg.draggable = false;
                applyAnimationToImg(rightImg, effectiveTileCount >= 3 ? entranceAnimationThird : entranceAnimationSecond, effectiveTileCount >= 3 ? slideAnimationThird : slideAnimationSecond);
                if (eagerLoadImages) {
                    rightImg.src = rightUrl;
                    rightImg.loading = 'eager';
                }
                rightLayer.appendChild(rightImg);
                dualBackgroundContainer.appendChild(rightLayer);
                itemDiv.appendChild(dualBackgroundContainer);
            } else {
                let singleUrl = '';
                if (cycleBackdrops && tileCount === 1 && backdropSources.length > 0) {
                    const shuffled = shuffleArray(backdropSources.map((s, i) => ({ src: s, idx: i })));
                    const urls = shuffled.map(({ src, idx }) => `${serverAddress}/Items/${src.itemId}/Images/Backdrop/${idx}?fillWidth=${backdropWidth}&quality=96&tag=${src.tag}`);
                    const mapKey = sectionKey + '_' + item.Id;
                    cycleBackdropMap.set(mapKey, { shuffledUrls: urls, currentIndex: 0 });
                    singleUrl = urls[0];
                } else if (backdropSources.length) {
                    const first = backdropSources[0];
                    singleUrl = `${serverAddress}/Items/${first.itemId}/Images/Backdrop?fillWidth=${backdropWidth}&quality=96&tag=${first.tag}`;
                } else if (item.ImageTags?.Primary) {
                    singleUrl = `${serverAddress}/Items/${item.Id}/Images/Primary?fillWidth=${backdropWidth}&quality=96&tag=${item.ImageTags.Primary}`;
                }
                if (singleUrl) {
                    const singleBackdropContainer = document.createElement('div');
                    singleBackdropContainer.className = 'spotlight-background-single' + (cycleBackdrops && tileCount === 1 && backdropSources.length > 0 ? ' cycle-backdrops' : '');
                    const singleImg = document.createElement('img');
                    singleImg.setAttribute('data-src', singleUrl);
                    singleImg.alt = '';
                    singleImg.draggable = false;
                    applyAnimationToImg(singleImg, entranceAnimationFirst, slideAnimationFirst);
                    if (eagerLoadImages) {
                        singleImg.src = singleUrl;
                        singleImg.loading = 'eager';
                    }
                    singleBackdropContainer.appendChild(singleImg);
                    if (cycleBackdrops && tileCount === 1 && backdropSources.length > 0) {
                        const singleImgNext = document.createElement('img');
                        singleImgNext.setAttribute('data-src', singleUrl);
                        singleImgNext.alt = '';
                        singleImgNext.draggable = false;
                        singleImgNext.style.opacity = '0';
                        applyAnimationToImg(singleImgNext, entranceAnimationFirst, slideAnimationFirst);
                        singleBackdropContainer.appendChild(singleImgNext);
                    }
                    itemDiv.appendChild(singleBackdropContainer);
                }
            }
            
            // Create left overlay (40-50% width, dark semi-transparent)
            // Add top padding to prevent content from overlapping with section title
            const overlay = document.createElement('div');
            overlay.className = 'spotlight-overlay' + (title ? ' has-title' : '');
            
            // Item title or logo
            let titleEl = null;
            const hasLogo = item.ImageTags?.Logo;
            
            if (hasLogo) {
                // Use logo image instead of text title
                const logoHeight = size === 'full' ? '300' : (size === 'large' ? '250' : '200');
                const logoUrl = `${serverAddress}/Items/${item.Id}/Images/Logo?fillHeight=${logoHeight}&quality=96&tag=${item.ImageTags.Logo}`;
                titleEl = document.createElement('div');
                titleEl.className = 'spotlight-item-logo';
                titleEl.setAttribute('data-background-url', logoUrl);
                if (eagerLoadImages) titleEl.style.backgroundImage = `url("${logoUrl}")`;
                titleEl.alt = item.Name || 'Unknown';
            } else {
                // Use text title as fallback
                titleEl = document.createElement('div');
                titleEl.className = 'spotlight-item-title';
                titleEl.textContent = item.Name || 'Unknown';
            }
            
            // Helper: wrap content in native Jellyfin itemDetailsGroup > detailsGroupItem structure
            // icon: optional Material Icons name (e.g. 'schedule') - same pattern as genres/director/writer
            function createMetadataItem(content, tag = 'span', extraClasses = '', icon = null) {
                const group = document.createElement('div');
                group.className = 'headerTabs sectionTabs emby-tabs-slider';
                const item = document.createElement(tag);
                item.className = 'emby-tab-button emby-button-foreground' + (extraClasses ? ' ' + extraClasses : '');
                if (icon) item.setAttribute('data-icon', icon);
                if (typeof content === 'string') {
                    item.textContent = content;
                } else {
                    item.appendChild(content);
                }
                group.appendChild(item);
                return group;
            }

            // Combined: Year + Time + Ends At + Genres (all on one line)
            const metadataRow = document.createElement('div');
            metadataRow.className = 'spotlight-metadata-row';
            
            // Year
            const year = item.ProductionYear || (item.PremiereDate ? new Date(item.PremiereDate).getFullYear() : null);
            if (year) {
                metadataRow.appendChild(createMetadataItem(String(year)));
            }
            
            // Runtime and estimated end time (Movies only - not for Series/Season/Episode)
            const isSeriesType = itemType === 'Series' || itemType === 'Season' || itemType === 'Episode';
            if (!isSeriesType && item.RunTimeTicks) {
                const runtimeMinutes = Math.round(item.RunTimeTicks / 10000000 / 60);
                const hours = Math.floor(runtimeMinutes / 60);
                const minutes = runtimeMinutes % 60;
                let runtimeText = '';
                if (hours > 0) {
                    runtimeText = `${hours}h ${minutes > 0 ? minutes + 'm' : ''}`.trim();
                } else {
                    runtimeText = `${minutes}m`;
                }
                
                metadataRow.appendChild(createMetadataItem(runtimeText));
                
                // End time (when it would end if started now)
                const now = new Date();
                const runtimeMs = item.RunTimeTicks / 10000;
                const endTime = new Date(now.getTime() + runtimeMs);
                const endTimeItem = createMetadataItem(endTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }), 'span', 'spotlight-end-time', 'schedule');
                metadataRow.appendChild(endTimeItem);
            }
            
            // Genres - merged into single container, max 3 visible, tooltip shows full list on hover
            if (item.Genres && item.Genres.length > 0 && item.GenreItems && item.GenreItems.length > 0) {
                const genreContainer = createTruncatedList('', item.GenreItems, 3, false, 'theater_comedy', 'genre');
                if (genreContainer) {
                    metadataRow.appendChild(genreContainer);
                }
            }
            
            // Helper function to create truncated list with tooltip for overflow items
            // items can be array of strings (names) or array of objects with Name and Id
            // icon: optional Material Icons name for full-screen display (e.g. 'movie', 'edit')
            // linkType: 'person' | 'genre' | 'studio' | null - when set, create links
            function createTruncatedList(label, items, maxItems = 3, isPeople = false, icon = null, linkType = null) {                
                const container = document.createElement('div');
                container.className = 'spotlight-truncated-list headerTabs sectionTabs emby-tabs-slider';
                container.setAttribute('data-label', label);
                if (icon) container.setAttribute('data-icon', icon);

                if (!items || items.length === 0) {
                    return container;
                }
                
                const displayContainer = document.createElement('span');
                displayContainer.className = 'emby-tab-button emby-button-foreground';
                if (icon) displayContainer.setAttribute('data-icon', icon);
                if (label) {
                    const labelSpan = document.createElement('span');
                    labelSpan.className = 'spotlight-truncated-list-label';
                    labelSpan.textContent = `${label} `;
                    displayContainer.appendChild(labelSpan);
                }
                
                // Extract names and IDs from items (handle both strings and objects)
                const itemsData = items.map(item => {
                    if (typeof item === 'string') {
                        return { name: item, id: null };
                    } else if (item && typeof item === 'object') {
                        return { 
                            name: item.Name || item.name || null, 
                            id: item.Id || item.id || null 
                        };
                    }
                    return container;
                }).filter(item => item && item.name);
                
                if (itemsData.length === 0) return null;
                
                const hasMore = itemsData.length > maxItems;
                
                // Resolve link type: explicit linkType, or fall back to isPeople for person links
                const usePersonLinks = linkType === 'person' || (linkType !== 'genre' && linkType !== 'studio' && isPeople);
                const useGenreLinks = linkType === 'genre';
                const useStudioLinks = linkType === 'studio';
                
                // Create spans for visible names only (no layout-shifting expand)
                itemsData.forEach((itemData, index) => {
                    if (index >= maxItems) return;
                    let nameElement;
                    
                    if (usePersonLinks && itemData.id) {
                        nameElement = document.createElement('a');
                        nameElement.className = 'spotlight-person-link';
                        nameElement.href = `${serverAddress}/web/#/details?id=${itemData.id}&serverId=${serverId}`;
                        nameElement.textContent = itemData.name;
                        nameElement.addEventListener('click', (e) => {
                            e.stopPropagation();
                        });
                    } else if (useGenreLinks && itemData.id) {
                        nameElement = document.createElement('a');
                        nameElement.className = 'spotlight-genre-link';
                        nameElement.href = `${serverAddress}/web/#/list.html?genreId=${itemData.id}&serverId=${serverId}`;
                        nameElement.textContent = itemData.name;
                        nameElement.addEventListener('click', (e) => e.stopPropagation());
                    } else if (useStudioLinks && itemData.id) {
                        nameElement = document.createElement('a');
                        nameElement.className = 'spotlight-studio-link';
                        nameElement.href = `${serverAddress}/web/#/list.html?studioId=${itemData.id}&serverId=${serverId}`;
                        nameElement.textContent = itemData.name;
                        nameElement.addEventListener('click', (e) => e.stopPropagation());
                    } else {
                        nameElement = document.createElement('span');
                        nameElement.textContent = itemData.name;
                    }
                    
                    nameElement.setAttribute('data-name-index', index);
                    
                    displayContainer.appendChild(nameElement);
                    
                    // Bullet separator (except for last visible item - use actual count when fewer than maxItems)
                    const lastVisibleIndex = Math.min(maxItems, itemsData.length) - 1;
                    if (index < lastVisibleIndex) {
                        const separator = document.createElement('span');
                        separator.className = 'spotlight-list-separator';
                        separator.textContent = '•';
                        displayContainer.appendChild(separator);
                    }
                });
                
                // Tooltip when more items exist (full list on hover)
                if (hasMore) {
                    // Tooltip: full list as vertical stack with clickable links (no layout shift)
                    const tooltip = document.createElement('div');
                    tooltip.className = 'spotlight-truncated-list-tooltip';
                    if (label) {
                        const labelSpan = document.createElement('span');
                        labelSpan.className = 'spotlight-truncated-list-tooltip-label';
                        labelSpan.textContent = label + ' ';
                        tooltip.appendChild(labelSpan);
                    }
                    const listWrapper = document.createElement('div');
                    listWrapper.className = 'spotlight-truncated-list-tooltip-items';
                    itemsData.forEach((itemData) => {
                        const itemRow = document.createElement('div');
                        itemRow.className = 'spotlight-truncated-list-tooltip-item';
                        let linkEl;
                        if (usePersonLinks && itemData.id) {
                            linkEl = document.createElement('a');
                            linkEl.href = `${serverAddress}/web/#/details?id=${itemData.id}&serverId=${serverId}`;
                            linkEl.className = 'spotlight-person-link';
                            linkEl.textContent = itemData.name;
                            linkEl.addEventListener('click', (e) => e.stopPropagation());
                        } else if (useGenreLinks && itemData.id) {
                            linkEl = document.createElement('a');
                            linkEl.href = `${serverAddress}/web/#/list.html?genreId=${itemData.id}&serverId=${serverId}`;
                            linkEl.className = 'spotlight-genre-link';
                            linkEl.textContent = itemData.name;
                            linkEl.addEventListener('click', (e) => e.stopPropagation());
                        } else if (useStudioLinks && itemData.id) {
                            linkEl = document.createElement('a');
                            linkEl.href = `${serverAddress}/web/#/list.html?studioId=${itemData.id}&serverId=${serverId}`;
                            linkEl.className = 'spotlight-studio-link';
                            linkEl.textContent = itemData.name;
                            linkEl.addEventListener('click', (e) => e.stopPropagation());
                        } else {
                            linkEl = document.createElement('span');
                            linkEl.textContent = itemData.name;
                        }
                        itemRow.appendChild(linkEl);
                        listWrapper.appendChild(itemRow);
                    });
                    tooltip.appendChild(listWrapper);
                    container.appendChild(tooltip);
                    container.style.position = 'relative';
                    
                    const TOOLTIP_DELAY_MS = 600;
                    const HIDE_DELAY_MS = 150;
                    let tooltipTimer = null;
                    let hideTimer = null;
                    
                    const showTooltip = () => {
                        tooltip.classList.add('visible');
                        tooltipTimer = null;
                    };
                    const hideTooltip = () => {
                        tooltip.classList.remove('visible');
                        if (tooltipTimer) {
                            clearTimeout(tooltipTimer);
                            tooltipTimer = null;
                        }
                        if (hideTimer) {
                            clearTimeout(hideTimer);
                            hideTimer = null;
                        }
                    };
                    const scheduleHide = () => {
                        if (hideTimer) clearTimeout(hideTimer);
                        hideTimer = setTimeout(hideTooltip, HIDE_DELAY_MS);
                    };
                    
                    container.addEventListener('mouseenter', () => {
                        if (hideTimer) {
                            clearTimeout(hideTimer);
                            hideTimer = null;
                        }
                        tooltipTimer = setTimeout(showTooltip, TOOLTIP_DELAY_MS);
                    });
                    container.addEventListener('mouseleave', () => {
                        scheduleHide();
                    });
                    tooltip.addEventListener('mouseenter', () => {
                        if (hideTimer) {
                            clearTimeout(hideTimer);
                            hideTimer = null;
                        }
                    });
                    tooltip.addEventListener('mouseleave', () => {
                        hideTooltip();
                    });
                }
                
                container.appendChild(displayContainer);
                return container;
            }
            
            // Studios - show 1 visible, rest in tooltip with links (like directors/writers)
            const studiosData = Array.isArray(item.Studios) && item.Studios.length > 0
                ? item.Studios
                : (typeof item.Studio === 'string' && item.Studio)
                    ? item.Studio.split('|').map(s => ({ Name: s.trim(), Id: null })).filter(x => x.Name)
                    : [];
            const studioContainer = studiosData.length > 0
                ? createTruncatedList('Produced by', studiosData, 1, false, 'apartment', 'studio')
                : null;

            // For Series: show seasons/episodes. For Movies: show director/writer
            let directorContainer = null;
            let writerContainer = null;
            let combinedContainer = null;
                
            // Create series info container (seasons/episodes count)
            const seriesInfoContainer = document.createElement('div');
            seriesInfoContainer.className = 'spotlight-metadata-row spotlight-series-info';
            
            if (itemType === 'Series') {
                // Studio first (before seasons/episodes)
                if (studioContainer) seriesInfoContainer.appendChild(studioContainer);
                // For Series, show seasons and episodes count
                const seasonsCount = item.ChildCount || 0;
                if (seasonsCount > 1) {
                    const seasonsText = `${seasonsCount} ${seasonsCount === 1 ? 'season' : 'seasons'}`;
                    seriesInfoContainer.appendChild(createMetadataItem(seasonsText));
                }
                const episodesCount = item.RecursiveItemCount || 0;
                if (episodesCount > 0) {
                    const episodesText = `${episodesCount} ${episodesCount === 1 ? 'episode' : 'episodes'}`;
                    seriesInfoContainer.appendChild(createMetadataItem(episodesText));
                }
            } else if (itemType === 'Movie') {
                // For Movies, show director/writer (existing logic)
                if (item.People && Array.isArray(item.People)) {
                    const directors = item.People.filter(p => p.Type === 'Director');
                    const writers = item.People.filter(p => p.Type === 'Writer');
                    
                    // Extract names for comparison
                    const directorNames = directors.map(p => p.Name);
                    const writerNames = writers.map(p => p.Name);
                    
                    // Check if directors and writers are identical (same length and same names)
                    const areIdentical = directorNames.length === writerNames.length && 
                                        directorNames.length > 0 &&
                                        directorNames.every((name, index) => name === writerNames[index]);
                    
                    if (areIdentical) {
                        // Combine into single "Directed and Written by" row (with person objects for links)
                        combinedContainer = createTruncatedList('Directed and Written by', directors, 1, true, 'movie');
                        // Add empty writer container to maintain spacing
                        writerContainer = document.createElement('div');
                        writerContainer.className = 'spotlight-empty-writer-container';
                    } else {
                        // Show separately (with person objects for links)
                        if (directors.length > 0) {
                            directorContainer = createTruncatedList('Directed by', directors, 1, true, 'movie');
                        }
                        if (writers.length > 0) {
                            writerContainer = createTruncatedList('Written by', writers, 1, true, 'edit');
                        }
                    }
                }
            } else if (itemType === 'Season') {
                // Studio first (before episodes)
                if (studioContainer) seriesInfoContainer.appendChild(studioContainer);
                // For Seasons, show episodes count
                const episodesCount = item.RecursiveItemCount || 0;
                const episodesText = `${episodesCount} ${episodesCount === 1 ? 'episode' : 'episodes'}`;
                seriesInfoContainer.appendChild(createMetadataItem(episodesText));
            } else if (itemType === 'Episode') {
                // Studio first (before season/episode)
                if (studioContainer) seriesInfoContainer.appendChild(studioContainer);
                // For Episodes, show episode number
                const seasonNumber = item.ParentIndexNumber || 0;
                const seasonText = `Season ${seasonNumber}`;
                const episodeNumber = item.IndexNumber || 0;
                const episodeText = `Episode ${episodeNumber}`;
                seriesInfoContainer.appendChild(createMetadataItem(`${seasonText} - ${episodeText}`));
            }
            
            // Tagline (tagline only) and Overview (separate element) - show/hide via CSS based on spotlight type
            const taglineEl = document.createElement('p');
            taglineEl.className = 'emby-tab-button emby-tab-button-active';
            const tagline = (item.Taglines && Array.isArray(item.Taglines) && item.Taglines.length > 0)
                ? item.Taglines[0] : '';
            if (tagline) taglineEl.textContent = tagline;

            const overviewEl = document.createElement('p');
            overviewEl.className = 'spotlight-overview';
            if (item.Overview) overviewEl.textContent = item.Overview;
            
            // Buttons container
            const buttonsContainer = document.createElement('div');
            buttonsContainer.className = 'spotlight-buttons-container mainDetailButtons';
            
            // Play button (material icon span button)
            const playButton = document.createElement('button');
            playButton.className = 'emby-button raised button-flat btnPlay detailButton';
            playButton.title = 'Play';
            const playIcon = document.createElement('span');
            playIcon.className = 'material-icons';
            playIcon.textContent = 'play_arrow';
            playButton.appendChild(playIcon);
            playButton.addEventListener('click', async (e) => {
                e.stopPropagation();
                try {
                    // TODO - this needs to be updated to use the data-action resume to play the item natively, if possible
                    if (window.apiHelper && window.apiHelper.playItem) {
                        await window.apiHelper.playItem(item.Id);
                    } else {
                        // Fallback to ApiClient.play if apiHelper is not available
                        if (window.ApiClient && typeof window.ApiClient.play === 'function') {
                            window.ApiClient.play({ ids: [item.Id] });
                        } else {
                            console.error('[KefinTweaks CardBuilder] No play method available');
                        }
                    }
                } catch (error) {
                    console.error('[KefinTweaks CardBuilder] Error playing item:', error);
                }
            });
            
            // Watchlist button (material icon span button with bookmark icon)
            const watchlistButton = document.createElement('button');
            watchlistButton.className = 'emby-button button-flat btnWatchlist';
            
            // Check watchlist status - try to get from cache or API
            let isInWatchlist = false;
            const sectionName = itemType === 'Movie' ? 'movies' : 
                               itemType === 'Series' ? 'series' : 
                               itemType === 'Season' ? 'seasons' : 
                               itemType === 'Episode' ? 'episodes' : null;
            
            // Check watchlist cache if available
            if (sectionName && typeof window.watchlistCache !== 'undefined' && window.watchlistCache[sectionName]?.data) {
                isInWatchlist = window.watchlistCache[sectionName].data.some(watchlistItem => watchlistItem.Id === item.Id);
            }
            
            const watchlistIcon = document.createElement('span');
            watchlistIcon.className = 'material-icons';
            watchlistIcon.textContent = 'bookmark';
            watchlistIcon.title = isInWatchlist ? 'Remove from Watchlist' : 'Add to Watchlist';
            watchlistButton.appendChild(watchlistIcon);
            if (isInWatchlist) {
                watchlistButton.classList.add('watchlisted');
            }
            watchlistButton.addEventListener('click', async (e) => {
                e.stopPropagation();
                const userId = ApiClient.getCurrentUserId();
                const newStatus = !isInWatchlist;
                
                try {
                    // Update watchlist status using proper API
                    await ApiClient.updateUserItemRating(userId, item.Id, newStatus ? 'true' : 'false');
                    
                    // Update local state
                    isInWatchlist = newStatus;
                    
                    // Update button class
                    if (isInWatchlist) {
                        watchlistButton.classList.add('watchlisted');
                    } else {
                        watchlistButton.classList.remove('watchlisted');
                    }
                    
                    // Update watchlist cache if available
                    if (sectionName && typeof window.updateWatchlistCacheOnToggle === 'function') {
                        await window.updateWatchlistCacheOnToggle(item.Id, itemType, isInWatchlist);
                    }
                } catch (err) {
                    console.error('Failed to update watchlist status:', err);
                }
            });
            
            // Info button (shows overview on hover)
            const infoButton = document.createElement('button');
            infoButton.className = 'emby-button button-flat spotlight-info-button';
            const infoIcon = document.createElement('span');
            infoIcon.className = 'material-icons';
            infoIcon.textContent = 'info';
            infoIcon.title = 'Go To Item';
            infoButton.appendChild(infoIcon);
            
            // Overview tooltip (hidden by default, shown on hover)
            if (item.Overview) {
                const overviewTooltip = document.createElement('div');
                overviewTooltip.className = 'spotlight-overview-tooltip';
                overviewTooltip.textContent = item.Overview;
                infoButton.appendChild(overviewTooltip);
            }
            
            buttonsContainer.appendChild(playButton);
            buttonsContainer.appendChild(watchlistButton);
            buttonsContainer.appendChild(infoButton);
            
            // Rating with star icon
            const rating = item.CommunityRating || item.CriticRating;

            if (rating && typeof rating === 'number') {
                const ratingContainer = document.createElement('div');
                ratingContainer.className = 'emby-button button-flat starRatingContainer mediaInfoItem spotlight-rating-container';
                
                const starIcon = document.createElement('span');
                starIcon.className = 'material-icons starIcon star spotlight-rating-star';

                if (rating && typeof rating === 'number') {   
                    ratingContainer.innerText = rating.toFixed(1);
                    ratingContainer.prepend(starIcon);
                    buttonsContainer.appendChild(ratingContainer);
                }
            }
            
            // Build overlay content in order: Name, Rating, Year+Time+EndsAt+Genres, Directed by, Written by, Taglines, Buttons
            overlay.appendChild(titleEl);

            const metadataContainer = document.createElement('div');
            metadataContainer.className = 'metadata-container';

            if (metadataRow.children.length > 0) {
                metadataContainer.appendChild(metadataRow);
            }
            // For Series, show seasons/episodes. For Movies, show director/writer
            if (itemType === 'Series' || itemType === 'Season' || itemType === 'Episode') {
                if (seriesInfoContainer) {
                    metadataContainer.appendChild(seriesInfoContainer);
                }
            } else {
                let emptyDirectorContainer = document.createElement('div');
                emptyDirectorContainer.className = 'spotlight-empty-director-container';

                let emptyWriterContainer = document.createElement('div');
                emptyWriterContainer.className = 'spotlight-empty-writer-container';

                if (combinedContainer) {
                    const creditsRow = document.createElement('div');
                    creditsRow.className = 'spotlight-metadata-row spotlight-credits-row';
                    if (studioContainer) creditsRow.appendChild(studioContainer);
                    creditsRow.appendChild(combinedContainer);
                    metadataContainer.appendChild(creditsRow);
                } else if (directorContainer || writerContainer) {
                    const creditsRow = document.createElement('div');
                    creditsRow.className = 'spotlight-metadata-row spotlight-credits-row';
                    if (studioContainer) creditsRow.appendChild(studioContainer);
                    if (directorContainer) creditsRow.appendChild(directorContainer);
                    if (writerContainer) creditsRow.appendChild(writerContainer);
                    metadataContainer.appendChild(creditsRow);
                } else if (studioContainer) {
                    const studioRow = document.createElement('div');
                    studioRow.className = 'spotlight-metadata-row spotlight-credits-row';
                    studioRow.appendChild(studioContainer);
                    metadataContainer.appendChild(studioRow);
                }
            }
            // Fixed 4-section grid: Logo, Metadata, Overview, Buttons (always render all to prevent layout shift)
            const logoSection = document.createElement('div');
            logoSection.className = 'spotlight-logo-section';
            logoSection.appendChild(titleEl);

            const metadataSection = document.createElement('div');
            metadataSection.className = 'spotlight-metadata-section';
            metadataSection.appendChild(metadataContainer);

            const overviewSection = document.createElement('div');
            overviewSection.className = 'spotlight-overview-section';
            if (overviewEl.textContent) overviewSection.appendChild(overviewEl);

            const buttonsSection = document.createElement('div');
            buttonsSection.className = 'spotlight-buttons-section';
            buttonsSection.appendChild(buttonsContainer);

            overlay.appendChild(logoSection);
            overlay.appendChild(metadataSection);
            overlay.appendChild(overviewSection);
            overlay.appendChild(buttonsSection);

            itemDiv.appendChild(overlay);
            if (taglineEl.textContent) {
                const taglineContainer = document.createElement('div');
                taglineContainer.className = 'spotlight-tagline headerTabs sectionTabs';
                taglineContainer.appendChild(taglineEl);
                itemDiv.appendChild(taglineContainer);
            }
            
            // ClearArt image (bottom right corner, if enabled and available)
            if (showClearArt && item.ImageTags?.Art) {
                const clearArtUrl = `${serverAddress}/Items/${item.Id}/Images/Art?fillHeight=300&quality=96&tag=${item.ImageTags.Art}`;
                const clearArtEl = document.createElement('img');
                clearArtEl.className = 'spotlight-clearart';
                clearArtEl.setAttribute('data-src', clearArtUrl);
                if (eagerLoadImages) clearArtEl.src = clearArtUrl;
                clearArtEl.alt = item.Name || 'Unknown';
                itemDiv.appendChild(clearArtEl);
            }
            
            itemsContainer.appendChild(itemDiv);
            return itemDiv;
        }

        // Initial render: create slides for window around currentIndex
        currentWindowIndices.forEach((idx) => {
            createAndAppendSlide(items[idx], idx, idx === currentIndex);
        });
        
        bannerContainer.appendChild(itemsContainer);

        // Mark the initially visible slide as active so only it is shown
        const firstItemActive = bannerContainer.querySelector(`.spotlight-item[data-index="${currentIndex}"]`);
        if (firstItemActive) {
            firstItemActive.setAttribute('data-active', 'true');
        }

        // Delegated handler: info button click -> navigate to item details for the current slide
        bannerContainer.addEventListener('click', (e) => {
            const infoBtn = e.target.closest('.spotlight-info-button');
            if (!infoBtn || !bannerContainer.contains(infoBtn)) return;

            e.preventDefault();
            e.stopPropagation();

            const slide = infoBtn.closest('.spotlight-item');
            if (!slide) return;

            const itemId = slide.getAttribute('data-id');
            if (!itemId) return;

            const detailsUrl = `#/details?id=${itemId}&serverId=${serverId}`;
            if (typeof Dashboard !== 'undefined' && Dashboard && typeof Dashboard.navigate === 'function') {
                Dashboard.navigate(detailsUrl);
            } else {
                const fullDetailsUrl = `${serverAddress}/web/#${detailsUrl}`;
                window.location.href = fullDetailsUrl;
            }
        });

        // Apply initial pan animation to the starting slide (helper also sets up completion tracking)
        if (panAnimation && items.length > 0) {
            const firstItemPan = bannerContainer.querySelector(`.spotlight-item[data-index="${currentIndex}"]`);
            if (firstItemPan) {
                applyPanAnimationToSlide(firstItemPan);
                startCycleBackdropTimer(firstItemPan, items[currentIndex].Id);
            }
        }
        
        // Navigation buttons (top right)
        if (showNavButtons && items.length > 1) {
            const navButtonsContainer = document.createElement('div');
            navButtonsContainer.className = 'spotlight-nav-buttons-container emby-tab-button emby-tab-button-active';
            
            const prevButton = document.createElement('button');
            prevButton.className = 'spotlight-nav-button spotlight-nav-prev emby-button';
            const prevIcon = document.createElement('span');
            prevIcon.className = 'material-icons';
            prevIcon.textContent = 'chevron_left';
            prevButton.appendChild(prevIcon);
            prevButton.addEventListener('click', (e) => {
                e.stopPropagation();
                // Reset timer when manually navigating
                goToItem((currentIndex - 1 + items.length) % items.length, true);
            });
            
            const nextButton = document.createElement('button');
            nextButton.className = 'spotlight-nav-button spotlight-nav-next emby-button';
            const nextIcon = document.createElement('span');
            nextIcon.className = 'material-icons';
            nextIcon.textContent = 'chevron_right';
            nextButton.appendChild(nextIcon);
            nextButton.addEventListener('click', (e) => {
                e.stopPropagation();
                // Reset timer when manually navigating
                goToItem((currentIndex + 1) % items.length, true);
            });
            
            navButtonsContainer.appendChild(prevButton);
            navButtonsContainer.appendChild(nextButton);

            const navContainer = document.createElement('div');
            navContainer.className = 'spotlight-nav-container headerTabs sectionTabs';
            navContainer.appendChild(navButtonsContainer);

            bannerContainer.appendChild(navContainer);
        }
        
        // Pause button (bottom right) — only when nav chrome exists (showNavButtons)
        if (autoPlay && items.length > 1) {
            const navButtonsContainer = bannerContainer.querySelector('.spotlight-nav-container .spotlight-nav-buttons-container');
            if (navButtonsContainer) {
                const pauseButton = document.createElement('button');
                pauseButton.className = 'spotlight-pause-button spotlight-nav-button emby-button';
                const pauseIcon = document.createElement('span');
                pauseIcon.className = 'material-icons';
                pauseIcon.textContent = 'pause';
                pauseButton.appendChild(pauseIcon);
                pauseButton.addEventListener('click', (e) => {
                    e.stopPropagation();
                    isPaused = !isPaused;
                    if (isPaused) {
                        if (autoPlayTimer) {
                            clearTimeout(autoPlayTimer);
                            autoPlayTimer = null;
                        }
                        pauseIcon.textContent = 'play_arrow';
                    } else {
                        startAutoPlay();
                        pauseIcon.textContent = 'pause';
                    }
                });

                navButtonsContainer.insertBefore(pauseButton, navButtonsContainer.firstChild);
            }
        }
        
        // Slide state container (dots or numeric "N / X")
        const MAX_DOTS = 5;
        if (showSlideState && items.length > 1) {
            const dotsContainer = document.createElement('div');
            dotsContainer.className = 'spotlight-dots' + (showDots ? '' : ' spotlight-dots-numeric');
            dotsContainer.setAttribute('data-index', String(currentIndex + 1)); /* 1-based for "N / X" display */
            dotsContainer.setAttribute('data-total-items', String(items.length));
            
            if (showDots) {
                const numDots = Math.min(items.length, MAX_DOTS);
                const activeDotIndex = currentIndex % numDots;
                for (let i = 0; i < numDots; i++) {
                    const dot = document.createElement('button');
                    dot.className = 'spotlight-dot' + (i === activeDotIndex ? ' active' : '');
                    dot.setAttribute('data-dot-index', i);
                    dot.addEventListener('click', (e) => {
                        e.stopPropagation();
                        const windowStart = Math.floor(currentIndex / numDots) * numDots;
                        const targetIndex = Math.min(windowStart + i, items.length - 1);
                        goToItem(targetIndex, true);
                    });
                    dotsContainer.appendChild(dot);
                }
            }
            
            bannerContainer.appendChild(dotsContainer);
        }
        
        // Load images for a slide (and optionally preload next). Only sets src/backgroundImage from data-* so browser loads on demand.
        function ensureSlideImagesLoaded(slideIndex) {
            if (slideIndex < 0 || slideIndex >= items.length) return;
            const itemEl = bannerContainer.querySelector(`.spotlight-item[data-index="${slideIndex}"]`);
            if (!itemEl) return;
            itemEl.querySelectorAll('img[data-src]').forEach(img => {
                const url = img.getAttribute('data-src');
                if (url && !img.src) img.src = url;
            });
            const bgUrl = itemEl.getAttribute('data-background-url');
            if (bgUrl && !itemEl.style.backgroundImage) itemEl.style.backgroundImage = `url("${bgUrl}")`;
            const logoEl = itemEl.querySelector('.spotlight-item-logo[data-background-url]');
            if (logoEl) {
                const logoUrl = logoEl.getAttribute('data-background-url');
                if (logoUrl && !logoEl.style.backgroundImage) logoEl.style.backgroundImage = `url("${logoUrl}")`;
            }
        }

        // Apply pan animation to a slide and track when it completes (for re-trigger on viewport re-entry)
        const SLIDE_ANIMATION_NAMES = new Set([
            'kenBurnsZoomOut', 'kenBurnsZoomIn', 'kenBurnsZoomOutFullscreen', 'kenBurnsZoomInFullscreen',
            'kenBurnsPanRight', 'kenBurnsPanLeft', 'kenBurnsPanUp', 'kenBurnsDiagonal', 'fadeInScale',
            'parallaxFloat', 'depthPulse', 'slowRotate', 'breathe', 'heatHaze', 'colorWash', 'vignetteIn'
        ]);
        const SLIDE_ANIMATION_FINAL_TRANSFORM = {
            kenBurnsZoomIn: 'scale3d(1.12, 1.12, 1)',
            kenBurnsZoomOut: 'scale3d(1.02, 1.02, 1)',
            kenBurnsZoomInFullscreen: 'scale3d(1.12, 1.12, 1)',
            kenBurnsZoomOutFullscreen: 'scale3d(1.08, 1.08, 1)',
            kenBurnsPanRight: 'scale3d(1.1, 1.1, 1) translateX(5%)',
            kenBurnsPanLeft: 'scale3d(1.1, 1.1, 1) translateX(-5%)',
            kenBurnsPanUp: 'scale3d(1.1, 1.1, 1) translateY(-5%)',
            kenBurnsDiagonal: 'scale3d(1.13, 1.13, 1) translate(5%, -5%)',
            fadeInScale: 'scale3d(1, 1, 1)',
            parallaxFloat: 'scale3d(1, 1, 1) translateY(0)',
            depthPulse: 'scale3d(1, 1, 1)',
            slowRotate: 'scale3d(1.15, 1.15, 1) rotate(3deg)',
            breathe: 'scale3d(1, 1, 1)',
            heatHaze: 'scale3d(1.05, 1.05, 1) skewX(0deg)'
        };
        function applyPanAnimationToSlide(slideElement) {
            if (!slideElement || !panAnimation) return;
            const imgs = slideElement.querySelectorAll('.spotlight-background-layer img, .spotlight-background-single img');
            if (!imgs.length) return;
            currentSlideAnimationComplete = false;
            let finishedCount = 0;
            const checkAllDone = () => {
                finishedCount++;
                if (finishedCount >= imgs.length) currentSlideAnimationComplete = true;
            };
            imgs.forEach(img => {
                img.style.transform = '';
                img.classList.remove('animate');
                img.classList.add('animate');
                const slideName = img.getAttribute('data-slide-animation') || '';
                const handler = (e) => {
                    if (e.animationName === slideName || SLIDE_ANIMATION_NAMES.has(e.animationName)) {
                        img.removeEventListener('animationend', handler);
                        checkAllDone();
                        var finalTransform = SLIDE_ANIMATION_FINAL_TRANSFORM[e.animationName];
                        if (finalTransform) {
                            requestAnimationFrame(() => { img.style.transform = finalTransform; });
                        }
                    }
                };
                img.addEventListener('animationend', handler);
            });
        }

        function startCycleBackdropTimer(slideElement, itemId) {
            if (cycleBackdropTimer) {
                clearInterval(cycleBackdropTimer);
                cycleBackdropTimer = null;
            }
            if (!cycleBackdrops || tileCount !== 1 || !isVisible) return;
            const container = slideElement.querySelector('.spotlight-background-single.cycle-backdrops');
            const imgs = container ? container.querySelectorAll('img') : [];
            const mapKey = sectionKey + '_' + itemId;
            const entry = cycleBackdropMap.get(mapKey);
            if (!entry || !entry.shuffledUrls.length) return;
            var cycleCount = 0;
            var maxCycles = Math.max(0, backdropsCount - 1);
            if (imgs.length >= 2) {
                const bottomImg = imgs[0];
                const topImg = imgs[1];
                const crossfadeDuration = '0.8s';
                cycleBackdropTimer = setInterval(() => {
                    if (!isVisible) return;
                    if (cycleCount >= maxCycles) {
                        if (cycleBackdropTimer) {
                            clearInterval(cycleBackdropTimer);
                            cycleBackdropTimer = null;
                        }
                        return;
                    }
                    cycleCount++;
                    entry.currentIndex = (entry.currentIndex + 1) % entry.shuffledUrls.length;
                    const nextUrl = entry.shuffledUrls[entry.currentIndex];
                    const preload = new Image();
                    preload.onload = () => {
                        topImg.src = nextUrl;
                        topImg.setAttribute('data-src', nextUrl);
                        topImg.style.transition = 'opacity ' + crossfadeDuration + ' ease-in-out';
                        topImg.style.opacity = '0';
                        requestAnimationFrame(() => {
                            requestAnimationFrame(() => { topImg.style.opacity = '1'; });
                        });
                        const handler = (e) => {
                            if (e.propertyName !== 'opacity') return;
                            topImg.removeEventListener('transitionend', handler);
                            bottomImg.src = nextUrl;
                            bottomImg.setAttribute('data-src', nextUrl);
                            topImg.style.opacity = '0';
                        };
                        topImg.addEventListener('transitionend', handler);
                    };
                    preload.src = nextUrl;
                }, perBackdropMs);
            } else {
                const img = slideElement.querySelector('.spotlight-background-single img');
                if (!img) return;
                cycleBackdropTimer = setInterval(() => {
                    if (!isVisible) return;
                    if (cycleCount >= maxCycles) {
                        if (cycleBackdropTimer) {
                            clearInterval(cycleBackdropTimer);
                            cycleBackdropTimer = null;
                        }
                        return;
                    }
                    cycleCount++;
                    entry.currentIndex = (entry.currentIndex + 1) % entry.shuffledUrls.length;
                    const nextUrl = entry.shuffledUrls[entry.currentIndex];
                    const preload = new Image();
                    preload.onload = () => {
                        img.style.opacity = '0';
                        img.style.transition = 'opacity 0.8s ease-in-out';
                        requestAnimationFrame(() => {
                            img.src = nextUrl;
                            img.setAttribute('data-src', nextUrl);
                            requestAnimationFrame(() => { img.style.opacity = '1'; });
                        });
                    };
                    preload.src = nextUrl;
                }, perBackdropMs);
            }
        }

        // Go to item function (crossfade transition, then only active slide is visible)
        function goToItem(index, resetTimer = true) {
            if (index === currentIndex) return;
            if (cycleBackdropTimer) {
                clearInterval(cycleBackdropTimer);
                cycleBackdropTimer = null;
            }
            const newWindowIndices = getSpotlightWindowIndices(index, items.length);
            const indexToRemove = currentWindowIndices.find(i => !newWindowIndices.includes(i));
            const indexToAdd = newWindowIndices.find(i => !currentWindowIndices.includes(i));
            
            var slideToRemove = undefined;
            if (indexToRemove !== undefined) {
                slideToRemove = bannerContainer.querySelector(`.spotlight-item[data-index="${indexToRemove}"]`);
            }
            if (indexToAdd !== undefined) {
                createAndAppendSlide(items[indexToAdd], indexToAdd, false);
            }
            currentWindowIndices = newWindowIndices;
            
            ensureSlideImagesLoaded(index);
            ensureSlideImagesLoaded((index + 1) % items.length);
            
            const currentItem = bannerContainer.querySelector(`.spotlight-item[data-index="${currentIndex}"]`);
            const nextItem = bannerContainer.querySelector(`.spotlight-item[data-index="${index}"]`);

            // Prune the slide that left the window so the container never exceeds 9 items.
            // If it's not the one we're fading out, remove it now; otherwise remove it in onFadeOutEnd.
            if (slideToRemove && slideToRemove.parentNode && slideToRemove !== currentItem) {
                slideToRemove.remove();
            }
            
            if (currentItem && nextItem) {
                // Start crossfade: outgoing stays visible but fades out; incoming becomes visible and fades in
                currentItem.removeAttribute('data-active');
                currentItem.setAttribute('data-fade-out', 'true');
                nextItem.setAttribute('data-active', 'true');
                nextItem.setAttribute('data-entering', 'true');
                applyPanAnimationToSlide(nextItem);
                startCycleBackdropTimer(nextItem, items[index].Id);

                // After next frame, remove data-entering so incoming slide transitions from 0 to 1
                requestAnimationFrame(() => {
                    requestAnimationFrame(() => {
                        nextItem.removeAttribute('data-entering');
                    });
                });

                // When outgoing slide opacity transition ends, clear its fade-out state and prune if it left the window
                const onFadeOutEnd = (e) => {
                    if (e.propertyName !== 'opacity') return;
                    currentItem.removeEventListener('transitionend', onFadeOutEnd);
                    currentItem.removeAttribute('data-fade-out');
                    if (slideToRemove && slideToRemove.parentNode) {
                        slideToRemove.remove();
                    }
                };
                currentItem.addEventListener('transitionend', onFadeOutEnd);
            } else if (slideToRemove && slideToRemove.parentNode) {
                slideToRemove.remove();
            }
            currentIndex = index;
            
            // Update slide state (dots or data attrs for numeric)
            if (showSlideState) {
                const dotsContainer = bannerContainer.querySelector('.spotlight-dots');
                if (dotsContainer) {
                    dotsContainer.setAttribute('data-index', String(index + 1)); // 1-based for display
                }
                if (showDots) {
                    const dots = bannerContainer.querySelectorAll('.spotlight-dot');
                    const numDots = dots.length;
                    const activeDotIndex = numDots > 0 ? (index % numDots) : 0;
                    dots.forEach((dot, i) => {
                        if (i === activeDotIndex) {
                            dot.classList.add('active');
                        } else {
                            dot.classList.remove('active');
                        }
                    });
                }
            }
            
            // Reset auto-play timer when manually navigating (always reset delay)
            if (resetTimer && autoPlay && !isPaused) {
                if (autoPlayTimer) {
                    clearTimeout(autoPlayTimer);
                    autoPlayTimer = null;
                }
                advanceDue = false;
                startAutoPlay();
            }
        }
        
        // Auto-play: single-timeout per slide, controlled only by pause/visibility (hover is ignored)
        function startAutoPlay() {
            if (autoPlayTimer) {
                clearTimeout(autoPlayTimer);
                autoPlayTimer = null;
            }
            if (!autoPlay || items.length <= 1 || isPaused || !isVisible) return;
            autoPlayTimer = setTimeout(onAutoPlayTimerFired, interval);
        }

        function onAutoPlayTimerFired() {
            autoPlayTimer = null;
            if (isPaused) {
                advanceDue = true;
                return;
            }
            if (!autoPlay || !isVisible || items.length <= 1) return;
            goToItem((currentIndex + 1) % items.length, false);
            advanceDue = false;
            // Schedule next slide timer for the new current slide
            if (autoPlay && !isPaused && isVisible && items.length > 1) {
                autoPlayTimer = setTimeout(onAutoPlayTimerFired, interval);
            }
        }
        
        // Only cycle when spotlight is in view: stop when off-screen to avoid loading images unnecessarily
        const visibilityObserver = new IntersectionObserver(
            (entries) => {
                const entry = entries[0];
                if (!entry) return;
                const wasVisible = isVisible;
                isVisible = entry.isIntersecting;
                if (!isVisible) {
                    if (autoPlayTimer) {
                        clearTimeout(autoPlayTimer);
                        autoPlayTimer = null;
                    }
                    if (cycleBackdropTimer) {
                        clearInterval(cycleBackdropTimer);
                        cycleBackdropTimer = null;
                    }
                } else {
                    // Re-entering viewport: schedule a fresh timer for the current slide
                    if (autoPlay && !isPaused) {
                        startAutoPlay();
                    }
                }
            },
            { root: null, rootMargin: '0px', threshold: 0 }
        );
        visibilityObserver.observe(container);
        
        document.addEventListener('visibilitychange', () => {
            if (document.hidden) {
                if (autoPlayTimer) {
                    clearTimeout(autoPlayTimer);
                    autoPlayTimer = null;
                }
            } else {
                if (autoPlay && !isPaused && isVisible) {
                    startAutoPlay();
                }
            }
        });
        
        // Start auto-play (will no-op if container not yet in DOM or not visible once observer runs)
        if (autoPlay) {
            startAutoPlay();
        }

        // Preload next slide soon after mount so transition has no pop
        if (items.length > 1) {
            requestAnimationFrame(() => ensureSlideImagesLoaded(1));
        }

        // Touch swipe handling
        let touchStartX = 0;
        let touchStartY = 0;
        
        bannerContainer.addEventListener('touchstart', (e) => {
            touchStartX = e.touches[0].clientX;
            touchStartY = e.touches[0].clientY;
        }, { passive: true });
        
        bannerContainer.addEventListener('touchmove', (e) => {
            if (!e.touches[0]) return;
            
            const touchX = e.touches[0].clientX;
            const touchY = e.touches[0].clientY;
            
            const deltaX = touchX - touchStartX;
            const deltaY = touchY - touchStartY;
            
            // If horizontal movement is dominant, prevent vertical scrolling and propagation
            if (Math.abs(deltaX) > Math.abs(deltaY)) {
                if (e.cancelable) {
                    e.preventDefault();
                    e.stopPropagation();
                }
            }
        }, { passive: false });
        
        bannerContainer.addEventListener('touchend', (e) => {
            if (!e.changedTouches[0]) return;
            
            const touchEndX = e.changedTouches[0].clientX;
            const touchEndY = e.changedTouches[0].clientY;
            
            const deltaX = touchEndX - touchStartX;
            const deltaY = touchEndY - touchStartY;
            
            // Threshold for swipe (50px)
            if (Math.abs(deltaX) > 50 && Math.abs(deltaX) > Math.abs(deltaY)) {
                // Stop propagation to prevent parent handlers (like tab switching)
                e.stopPropagation();
                
                if (deltaX > 0) {
                    // Swipe right (previous)
                    goToItem((currentIndex - 1 + items.length) % items.length, true);
                } else {
                    // Swipe left (next)
                    goToItem((currentIndex + 1) % items.length, true);
                }
            }
        }, { passive: true });
        
        container.appendChild(bannerContainer);

        container.dataset.layout = layout;
        container.dataset.size = size;
        container.dataset.tileCount = String(tileCount);

        return container;
    }

    const ITEMS_LAYOUT_CYCLE = ['row', 'grid'];
    const ITEMS_LAYOUT_ICONS = {
        row: 'view_array',
        grid: 'grid_view'
    };
    const ITEMS_LAYOUT_NEXT_TITLE = {
        row: 'Grid layout',
        grid: 'Row layout'
    };

    function resolveItemsLayout(sectionConfig) {
        if (!sectionConfig) return 'row';
        if (sectionConfig.itemsLayout === 'grid') return 'grid';
        if (sectionConfig.itemsLayout === 'row') return 'row';
        if (sectionConfig.gridExpanded === true) return 'grid';
        return 'row';
    }

    function resolveUseGaplessCards(sectionConfig) {
        return sectionConfig?.useGaplessCards === true;
    }

    function nextItemsLayout(current) {
        const idx = ITEMS_LAYOUT_CYCLE.indexOf(current);
        return ITEMS_LAYOUT_CYCLE[(idx < 0 ? 0 : idx + 1) % ITEMS_LAYOUT_CYCLE.length];
    }

    function setShowAllIcon(button, layout) {
        if (!button) return;
        button.classList.remove('view_array', 'grid_view', 'grid_on');
        button.classList.add(ITEMS_LAYOUT_ICONS[layout] || 'view_array');
    }

    function isButtonCardFormat(cardFormat) {
        return (cardFormat || '').toLowerCase() === 'button';
    }

    function getPaintedSectionItems(itemsContainer, cardFormat) {
        if (!itemsContainer) return [];
        if (isButtonCardFormat(cardFormat)) {
            return Array.from(itemsContainer.querySelectorAll(':scope > .homeLibraryButton'));
        }
        return Array.from(itemsContainer.querySelectorAll(':scope > .card:not(.card-layout-dummy)'));
    }

    function getRealLayoutCards(itemsContainer) {
        if (!itemsContainer) return [];
        return Array.from(itemsContainer.querySelectorAll(':scope > .card:not(.card-layout-dummy)'));
    }

    function removeLayoutDummies(itemsContainer) {
        if (!itemsContainer) return;
        itemsContainer.querySelectorAll(':scope > .card-layout-dummy').forEach((el) => el.remove());
    }

    function invalidateLastRowPadding(itemsContainer) {
        if (!itemsContainer) return;
        removeLayoutDummies(itemsContainer);
        itemsContainer.removeAttribute('data-last-row-padding');
        itemsContainer.removeAttribute('data-last-row-padding-layout');
        itemsContainer.removeAttribute('data-measuring');
    }

    function canMeasureLastRowPadding(itemsContainer) {
        return !!(itemsContainer?.isConnected && itemsContainer.clientWidth >= 1);
    }

    function createLayoutDummyCard(templateCard, layout) {
        const dummy = document.createElement('div');
        dummy.className = templateCard?.className || 'card';
        dummy.classList.add('card', 'card-layout-dummy');
        dummy.classList.remove('card-hoverable');
        dummy.setAttribute('aria-hidden', 'true');
        dummy.setAttribute('tabindex', '-1');

        // cardBox
        const cardBox = document.createElement('div');
        cardBox.className = 'cardBox';
        dummy.appendChild(cardBox);

        // cardScalable
        const cardScalable = document.createElement('div');
        cardScalable.className = 'cardScalable';
        cardBox.appendChild(cardScalable);

        if (layout === 'grid') {
            const templatePadder = templateCard?.querySelector('.cardPadder');
            const padder = document.createElement('div');
            padder.className = templatePadder?.className
                || 'cardPadder cardPadder-portrait lazy-hidden-children';
            const cardIcon = document.createElement('span');
            cardIcon.className = 'cardImageIcon material-icons';
            cardIcon.setAttribute('aria-hidden', 'true');
            cardIcon.textContent = 'folder';
            padder.appendChild(cardIcon);
            cardScalable.appendChild(padder);

            const border = createCardBorderHost();
            const section = templateCard?.closest('[data-border],[data-border-style]');
            const raw = section?.dataset?.border
                || section?.dataset?.borderStyle
                || templateCard?.querySelector('.cardBorder')?.dataset?.style
                || '';
            const style = normalizeCardBorderStyle(raw);
            if (style) fillCardBorder(border, style);
            cardScalable.appendChild(border);
        }

        return dummy;
    }

    /**
     * Count how many real cards fit on the first row at natural (non-growing) width.
     * @param {HTMLElement} itemsContainer
     * @returns {number}
     */
    function countItemsPerRow(itemsContainer) {
        if (!canMeasureLastRowPadding(itemsContainer)) return 0;
        const cards = getRealLayoutCards(itemsContainer);
        if (!cards.length) return 0;
        itemsContainer.setAttribute('data-measuring', 'true');
        void itemsContainer.offsetWidth;
        const firstTop = cards[0].offsetTop;
        let count = 0;
        for (const card of cards) {
            if (card.offsetTop !== firstTop) break;
            count++;
        }
        itemsContainer.removeAttribute('data-measuring');
        return count;
    }

    /**
     * Pad the last flex row with invisible dummy cards so grow distribution matches full rows.
     * Reuses data-last-row-padding when cached for the same layout.
     * @param {HTMLElement} itemsContainer
     * @param {'grid'} layout
     */
    function syncLastRowPadding(itemsContainer, layout) {
        if (!itemsContainer || layout !== 'grid') return;

        const cachedPad = itemsContainer.getAttribute('data-last-row-padding');
        const cachedLayout = itemsContainer.getAttribute('data-last-row-padding-layout');
        const hasCache = cachedPad != null
            && cachedPad !== ''
            && cachedLayout === layout
            && /^\d+$/.test(cachedPad);

        // Disconnected / zero-width: do not measure or cache (retry when laid out).
        if (!hasCache && !canMeasureLastRowPadding(itemsContainer)) return;

        removeLayoutDummies(itemsContainer);

        let padding;
        if (hasCache) {
            padding = parseInt(cachedPad, 10);
        } else {
            itemsContainer.removeAttribute('data-last-row-padding');
            itemsContainer.removeAttribute('data-last-row-padding-layout');
            const cards = getRealLayoutCards(itemsContainer);
            if (!cards.length) return;
            const perRow = countItemsPerRow(itemsContainer);
            if (perRow <= 0) return;
            const rem = cards.length % perRow;
            padding = rem === 0 ? 0 : perRow - rem;
            itemsContainer.setAttribute('data-last-row-padding', String(padding));
            itemsContainer.setAttribute('data-last-row-padding-layout', layout);
        }

        if (padding <= 0) return;
        if (!itemsContainer.isConnected) return;
        const template = getRealLayoutCards(itemsContainer)[0];
        if (!template) return;
        const frag = document.createDocumentFragment();
        for (let i = 0; i < padding; i++) {
            frag.appendChild(createLayoutDummyCard(template, layout));
        }
        itemsContainer.appendChild(frag);
    }

    let lastRowPaddingResizeTimer = null;
    function handleLastRowPaddingWindowResize() {
        clearTimeout(lastRowPaddingResizeTimer);
        lastRowPaddingResizeTimer = setTimeout(() => {
            document.querySelectorAll(
                '.itemsContainer[data-layout="grid"]'
            ).forEach((container) => {
                const layout = container.getAttribute('data-layout');
                invalidateLastRowPadding(container);
                syncLastRowPadding(container, layout);
            });
        }, 150);
    }
    if (!window.__kefinLastRowPaddingResizeBound) {
        window.__kefinLastRowPaddingResizeBound = true;
        window.addEventListener('resize', handleLastRowPaddingWindowResize);
    }

    let lastRowPaddingRo = null;
    let lastRowPaddingRoTimer = null;
    const lastRowPaddingRoPending = new Set();

    function ensureLastRowPaddingResizeObserver() {
        if (lastRowPaddingRo || typeof ResizeObserver === 'undefined') return lastRowPaddingRo;
        lastRowPaddingRo = new ResizeObserver((entries) => {
            entries.forEach((entry) => {
                if (entry?.target) lastRowPaddingRoPending.add(entry.target);
            });
            clearTimeout(lastRowPaddingRoTimer);
            lastRowPaddingRoTimer = setTimeout(() => {
                const targets = [...lastRowPaddingRoPending];
                lastRowPaddingRoPending.clear();
                targets.forEach((el) => {
                    const layout = el.getAttribute?.('data-layout');
                    if (layout !== 'grid') return;
                    invalidateLastRowPadding(el);
                    syncLastRowPadding(el, layout);
                });
            }, 80);
        });
        return lastRowPaddingRo;
    }

    function observeLastRowPadding(itemsContainer) {
        const ro = ensureLastRowPaddingResizeObserver();
        if (!ro || !itemsContainer) return;
        try {
            ro.observe(itemsContainer);
        } catch (_) { /* ignore */ }
    }

    function unobserveLastRowPadding(itemsContainer) {
        if (!lastRowPaddingRo || !itemsContainer) return;
        try {
            lastRowPaddingRo.unobserve(itemsContainer);
        } catch (_) { /* ignore */ }
    }

    /**
     * Apply items layout (row|grid) and optional gapless cards on a scrollable section.
     * @param {HTMLElement} verticalSection
     * @param {string} layout
     * @param {boolean} [gapless]
     */
    function applyItemsLayoutState(verticalSection, layout, gapless) {
        if (!verticalSection) return;
        const itemsContainer = verticalSection.querySelector('.itemsContainer');
        if (!itemsContainer) return;
        const resolved = layout === 'grid' ? 'grid' : 'row';
        const showAllButton = verticalSection.querySelector('.show-all-button');
        const scrollButtons = verticalSection.querySelector('.emby-scrollbuttons');
        itemsContainer.setAttribute('data-layout', resolved);
        itemsContainer.removeAttribute('data-expanded');
        if (gapless === true) {
            itemsContainer.setAttribute('data-gapless', 'true');
        } else if (gapless === false) {
            itemsContainer.removeAttribute('data-gapless');
        }
        if (resolved === 'row') {
            unobserveLastRowPadding(itemsContainer);
            removeLayoutDummies(itemsContainer);
            if (scrollButtons) scrollButtons.style.display = '';
        } else if (scrollButtons) {
            scrollButtons.style.display = 'none';
        }
        if (showAllButton) {
            const nextLayout = nextItemsLayout(resolved);
            showAllButton.title = ITEMS_LAYOUT_NEXT_TITLE[resolved] || ITEMS_LAYOUT_NEXT_TITLE.row;
            showAllButton.setAttribute('aria-label', showAllButton.title);
            setShowAllIcon(showAllButton, nextLayout);
        }
        if (resolved === 'grid') {
            observeLastRowPadding(itemsContainer);
            // Two frames so wrap layout is settled before measuring / padding
            requestAnimationFrame(() => {
                requestAnimationFrame(() => {
                    if (itemsContainer.getAttribute('data-layout') !== resolved) return;
                    syncLastRowPadding(itemsContainer, resolved);
                });
            });
        }
    }

    function syncAttachedGridTilesLayouts(root) {
        if (!root?.querySelectorAll) return;
        root.querySelectorAll(
            '.itemsContainer[data-layout="grid"]'
        ).forEach((itemsContainer) => {
            const layout = itemsContainer.getAttribute('data-layout');
            const gapless = itemsContainer.getAttribute('data-gapless') === 'true';
            const section = itemsContainer.closest('.verticalSection, .emby-scroller-container')
                || itemsContainer.parentElement;
            if (section) applyItemsLayoutState(section, layout, gapless);
            else {
                observeLastRowPadding(itemsContainer);
                invalidateLastRowPadding(itemsContainer);
                syncLastRowPadding(itemsContainer, layout);
            }
        });
    }

    /** @deprecated Use applyItemsLayoutState */
    function applyGridExpandedState(verticalSection, expanded) {
        applyItemsLayoutState(verticalSection, expanded ? 'grid' : 'row');
    }

    const pendingItemsLayoutSaves = new Map();
    let itemsLayoutSaveTimeout = null;

    function scheduleItemsLayoutSave(sectionId, layout, sectionType) {
        if (!sectionId) return;
        const value = layout === 'grid' ? layout : 'row';
        pendingItemsLayoutSaves.set(sectionId, { layout: value, type: sectionType });
        window.KefinHomeScreenSectionConfigure?.updateRuntimeItemsLayout?.(sectionId, value);
        clearTimeout(itemsLayoutSaveTimeout);
        itemsLayoutSaveTimeout = setTimeout(async () => {
            const batch = new Map(pendingItemsLayoutSaves);
            pendingItemsLayoutSaves.clear();
            const api = window.KefinUserHomeScreenConfig;
            const save = api?.saveSectionItemsLayout || api?.saveSectionGridExpanded;
            if (!save) return;
            for (const [id, entry] of batch) {
                try {
                    const itemsLayout = typeof entry === 'object' ? entry.layout : entry;
                    const type = typeof entry === 'object' ? entry.type : undefined;
                    await save.call(api, id, itemsLayout, type ? { type } : undefined);
                } catch (e) {
                    console.warn('[KefinTweaks CardBuilder] Failed to save itemsLayout:', e);
                }
            }
        }, 300);
    }

    function isCardScrollerSection(sectionElement) {
        return !!sectionElement?.querySelector('.itemsContainer');
    }

    function getShowAllControlLabel(sectionElement) {
        const itemsContainer = sectionElement?.querySelector('.itemsContainer');
        const currentLayout = itemsContainer?.getAttribute('data-layout') || 'row';
        const resolved = currentLayout === 'grid' ? currentLayout : 'row';
        return ITEMS_LAYOUT_NEXT_TITLE[resolved] || ITEMS_LAYOUT_NEXT_TITLE.row;
    }

    function handleShowAllLayoutToggle(sectionElement) {
        const verticalSection = sectionElement.closest('.emby-scroller-container') || sectionElement;
        const itemsContainer = verticalSection.querySelector('.itemsContainer');
        if (!itemsContainer) return;

        const scroller = verticalSection.querySelector('.emby-scroller');
        const currentLayout = itemsContainer.getAttribute('data-layout') || 'row';
        const gapless = itemsContainer.getAttribute('data-gapless') === 'true';
        const layout = nextItemsLayout(currentLayout === 'grid' ? currentLayout : 'row');
        const sectionId = verticalSection.getAttribute('data-section-id') || verticalSection.dataset?.sectionId;
        const sectionType = verticalSection.getAttribute('data-section-type') || verticalSection.dataset?.sectionType;

        if (layout === 'row') {
            applyItemsLayoutState(verticalSection, 'row', gapless);
            updateScrollButtonStateForSection(verticalSection);
            const saved = parseFloat(itemsContainer.getAttribute('data-row-scroll-x'));
            const position = Number.isFinite(saved) ? saved : 0;
            setScrollerPosition(scroller, position, true);
            requestAnimationFrame(() => applyScrollButtonState(verticalSection));
            scheduleItemsLayoutSave(sectionId, 'row', sectionType);
        } else {
            if (currentLayout === 'row') {
                itemsContainer.setAttribute('data-row-scroll-x', String(getScrollerPosition(scroller)));
                setScrollerPosition(scroller, 0, false);
            }
            applyItemsLayoutState(verticalSection, layout, gapless);
            scheduleItemsLayoutSave(sectionId, layout, sectionType);
        }
    }

    function getSectionControlDefinitions(sectionConfig, sectionElement, cachedItems) {
        const definitions = [];

        definitions.push({
            id: 'refresh',
            icon: 'refresh',
            label: 'Refresh',
            className: 'section-refresh-button',
            isVisible: () => true,
            onClick: async (e) => {
                e.preventDefault();
                e.stopPropagation();
                await executeSectionRefresh(sectionConfig, sectionElement);
            }
        });

        if (isCardScrollerSection(sectionElement)) {
            definitions.push({
                id: 'showAll',
                icon: 'grid_view',
                getLabel: () => getShowAllControlLabel(sectionElement),
                label: 'Grid layout',
                className: 'show-all-button',
                isVisible: () => true,
                onClick: (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    handleShowAllLayoutToggle(sectionElement);
                }
            });
        }

        const configureDef = window.KefinHomeScreenSectionConfigure?.getConfigureSectionControl?.(
            sectionConfig,
            sectionElement,
            cachedItems
        );
        if (configureDef) {
            definitions.push(configureDef);
        }

        return definitions;
    }

    function renderSectionControls(sectionConfig, sectionElement, titleContainer, definitions) {
        const { inline, moreButton } = ensureSectionControlsMount(titleContainer);
        inline.innerHTML = '';

        const visibleDefinitions = definitions.filter((def) => !def.isVisible || def.isVisible());
        let refreshButton = null;

        visibleDefinitions.forEach((def) => {
            const label = typeof def.getLabel === 'function' ? def.getLabel() : def.label;
            const button = document.createElement('button');
            button.type = 'button';
            button.className = `${def.className} material-icons ${def.icon}`;
            button.title = label;
            button.setAttribute('aria-label', label);
            button.dataset.sectionControlId = def.id;
            button.addEventListener('click', (e) => {
                def.onClick(e, button);
            });
            inline.appendChild(button);
            if (def.id === 'refresh') {
                refreshButton = button;
            }
        });

        const newMoreButton = moreButton.cloneNode(true);
        moreButton.replaceWith(newMoreButton);

        const MORE_CONTROLS_MODAL_ID = 'kefin-section-controls-more';
        let activeMorePopover = null;
        const closeMorePopover = () => {
            if (window.ModalSystem?.isOpen?.(MORE_CONTROLS_MODAL_ID)) {
                window.ModalSystem.close(MORE_CONTROLS_MODAL_ID);
            }
            if (activeMorePopover) {
                activeMorePopover.remove();
                activeMorePopover = null;
            }
        };

        const buildMorePopoverContent = (onActivate, { forModal = false } = {}) => {
            const popover = document.createElement('div');
            popover.className = forModal
                ? 'kefinTweaks-popover section-controls-more-menu'
                : 'kefinTweaks-popover section-controls-more-popover';
            visibleDefinitions.forEach((def) => {
                const label = typeof def.getLabel === 'function' ? def.getLabel() : def.label;
                const item = document.createElement('div');
                item.className = 'kefinTweaks-popover-item detailsGroupItem section-controls-more-item';
                item.setAttribute('role', 'button');
                item.setAttribute('tabindex', '0');

                const iconSpan = document.createElement('span');
                iconSpan.className = `material-icons section-controls-more-item-icon ${def.icon}`;
                iconSpan.setAttribute('aria-hidden', 'true');

                const labelSpan = document.createElement('span');
                labelSpan.className = 'section-controls-more-item-label';
                labelSpan.textContent = label;

                item.appendChild(iconSpan);
                item.appendChild(labelSpan);

                const activate = (ev) => {
                    ev.preventDefault();
                    ev.stopPropagation();
                    onActivate();
                    def.onClick(ev, newMoreButton);
                };
                item.addEventListener('click', activate);
                item.addEventListener('keydown', (ev) => {
                    if (ev.key === 'Enter' || ev.key === ' ') {
                        activate(ev);
                    }
                });
                popover.appendChild(item);
            });
            return popover;
        };

        const positionMoreModal = (modal, anchorBtn) => {
            if (!modal?.dialog || !anchorBtn) return;
            modal.dialog.classList.remove('centeredDialog', 'formDialog', 'smoothScrollY', 'dialog-fixedSize');
            modal.dialog.style.position = 'fixed';
            modal.dialog.style.margin = '0';
            modal.dialog.style.maxHeight = 'none';
            modal.dialog.style.height = 'auto';
            modal.dialog.style.minHeight = 'auto';
            modal.dialog.style.minWidth = '12rem';
            modal.dialog.style.width = 'auto';
            modal.dialog.style.padding = '0.25em 0';
            modal.dialog.style.animation = '160ms ease-out 0s 1 normal both running scaleup';
            if (modal.dialogContent) {
                modal.dialogContent.style.padding = '0';
                modal.dialogContent.style.overflow = 'visible';
                modal.dialogContent.style.minHeight = 'auto';
                modal.dialogContent.style.height = 'auto';
                modal.dialogContent.style.flex = '0 0 auto';
            }
            if (modal.backdrop) {
                modal.backdrop.style.background = 'transparent';
            }
            if (modal.dialogContainer) {
                modal.dialogContainer.style.pointerEvents = 'none';
            }
            modal.dialog.style.pointerEvents = 'auto';

            const btnRect = anchorBtn.getBoundingClientRect();
            const margin = 8;
            const gap = 4;
            requestAnimationFrame(() => {
                const menuHeight = modal.dialog.offsetHeight || 0;
                const menuWidth = Math.max(modal.dialog.offsetWidth || 0, 180);
                let top = btnRect.bottom + gap;
                if (top + menuHeight > window.innerHeight - margin) {
                    top = Math.max(margin, btnRect.top - menuHeight - gap);
                }
                let left = btnRect.right - menuWidth;
                left = Math.min(Math.max(left, margin), window.innerWidth - menuWidth - margin);
                modal.dialog.style.top = `${top}px`;
                modal.dialog.style.left = `${left}px`;
            });
        };

        newMoreButton.addEventListener('click', (e) => {
            e.stopPropagation();
            e.preventDefault();

            if (activeMorePopover || window.ModalSystem?.isOpen?.(MORE_CONTROLS_MODAL_ID)) {
                closeMorePopover();
                return;
            }

            if (isMobileLayout() && window.ModalSystem?.create) {
                const content = buildMorePopoverContent(() => closeMorePopover(), { forModal: true });
                window.ModalSystem.create({
                    id: MORE_CONTROLS_MODAL_ID,
                    title: '',
                    content,
                    showCloseButton: false,
                    closeOnBackdrop: true,
                    closeOnEscape: true,
                    fixedSize: false,
                    onOpen: (modal) => {
                        if (modal?.dialogHeader) modal.dialogHeader.style.display = 'none';
                        if (modal?.dialogFooter) modal.dialogFooter.style.display = 'none';
                        positionMoreModal(modal, newMoreButton);
                    }
                });
                return;
            }

            const popover = buildMorePopoverContent(() => closeMorePopover());
            titleContainer.style.position = 'relative';
            newMoreButton.parentNode.insertBefore(popover, newMoreButton.nextSibling);

            const buttonRect = newMoreButton.getBoundingClientRect();
            const containerRect = titleContainer.getBoundingClientRect();
            popover.style.right = '40px';
            popover.style.left = 'auto';
            popover.style.top = '0px';
            popover.style.minWidth = `${Math.max(buttonRect.width, 180)}px`;
            popover.style.maxWidth = `${Math.max(0, containerRect.width)}px`;

            activeMorePopover = popover;

            const closeHandler = (ev) => {
                if (!popover.contains(ev.target) && !newMoreButton.contains(ev.target)) {
                    closeMorePopover();
                    document.removeEventListener('click', closeHandler);
                }
            };
            setTimeout(() => {
                document.addEventListener('click', closeHandler);
            }, 100);
        });

        return refreshButton;
    }

    function isMobileLayout() {
        return document.documentElement.classList.contains('layout-mobile') || window.innerWidth < 900;
    }

    function getSectionSkeletonCount(sectionConfig) {
        const raw = sectionConfig?.itemLimit || sectionConfig?.queries?.[0]?.queryOptions?.Limit || 0;
        return raw > 0 ? raw : 16;
    }

    const SKELETON_ONE_LINE_ITEM_TYPES = new Set([
        'Book', 'Genre', 'CollectionFolder', 'BoxSet', 'Playlist', 'Folder', 'Studio'
    ]);

    const SKELETON_CUSTOM_FOOTER_SECTION_IDS = new Set([
        'upcoming', 'recentlyReleased.movies', 'recentlyReleased.episodes'
    ]);

    function sectionUsesCustomFooterText(sectionConfig) {
        if (!sectionConfig) return false;
        if (SKELETON_CUSTOM_FOOTER_SECTION_IDS.has(sectionConfig.id)) return true;
        if (Array.isArray(sectionConfig.items) && sectionConfig.items.some(
            (item) => item?.CustomFooterText || item?.cardFooter
        )) {
            return true;
        }
        return false;
    }

    function inferSkeletonItemType(sectionConfig) {
        if (!sectionConfig) return null;
        const query = sectionConfig.queries?.[0];
        const path = typeof query?.path === 'string' ? query.path : '';
        if (path.includes('/Studios')) return 'Studio';
        if (path.includes('/Genres')) return 'Genre';

        let includeTypes = query?.queryOptions?.IncludeItemTypes;
        if (typeof includeTypes === 'string') {
            includeTypes = includeTypes.split(',').map((t) => t.trim()).filter(Boolean);
        }
        if (!Array.isArray(includeTypes) || includeTypes.length === 0) return null;
        if (includeTypes.length === 1) return includeTypes[0];
        if (includeTypes.every((t) => SKELETON_ONE_LINE_ITEM_TYPES.has(t))) {
            return includeTypes[0];
        }
        return null;
    }

    function getSkeletonFooterLineCount(sectionConfig) {
        if (sectionConfig?.hideCardFooter === true) return 0;
        if (sectionUsesCustomFooterText(sectionConfig)) return 3;
        const itemType = inferSkeletonItemType(sectionConfig);
        if (itemType && SKELETON_ONE_LINE_ITEM_TYPES.has(itemType)) return 1;
        return 2;
    }

    function createScrollerElement() {
        const scroller = document.createElement('div');
        const isMobile = isMobileLayout();

        scroller.setAttribute('data-horizontal', 'true');
        scroller.setAttribute('data-centerfocus', 'card');
        scroller.className = `padded-top-focusscale padded-bottom-focusscale emby-scroller padded-left custom-scroller${isMobile ? ' scrollX hiddenScrollX' : ''}`;
        scroller.setAttribute('data-scroll-mode-x', 'custom');
        scroller.style.scrollSnapType = 'none';
        scroller.style.touchAction = 'auto';
        scroller.style.overscrollBehaviorX = 'contain';
        scroller.style.overscrollBehaviorY = 'auto';
        scroller.style.webkitOverflowScrolling = 'touch';
        scroller.style.setProperty('--scroll-x', '0');

        return scroller;
    }

    function createItemsSliderElement() {
        const isMobile = isMobileLayout();
        const itemsContainer = document.createElement('div');
        itemsContainer.setAttribute('is', 'emby-itemscontainer');
        itemsContainer.className = `focuscontainer-x itemsContainer scrollSlider${!isMobile ? ' animatedScrollX' : ''}`;
        itemsContainer.style.whiteSpace = 'nowrap';
        return itemsContainer;
    }

    /**
     * Attach scroll buttons and desktop drag handlers to a scrollable section scroller.
     * @param {HTMLElement} verticalSection
     * @param {HTMLElement} scroller
     * @returns {HTMLElement} scrollButtons container
     */
    function attachScrollableSectionChrome(verticalSection, scroller) {
        const isMobile = isMobileLayout();
        const scrollButtons = document.createElement('div');
        scrollButtons.className = 'emby-scrollbuttons padded-right';

        const leftButton = document.createElement('button');
        leftButton.type = 'button';
        leftButton.setAttribute('data-ripple', 'false');
        leftButton.setAttribute('data-direction', 'left');
        leftButton.setAttribute('title', 'Previous');
        leftButton.className = 'emby-scrollbuttons-button paper-icon-button-light';
        leftButton.disabled = true;
        const leftSpan = document.createElement('span');
        leftSpan.className = 'material-icons chevron_left';
        leftSpan.setAttribute('aria-hidden', 'true');
        leftButton.appendChild(leftSpan);

        function getCurrentPosition() {
            const v = scroller.style.getPropertyValue('--scroll-x');
            if (v !== '' && !isNaN(parseFloat(v))) return parseFloat(v);
            const matrix = new DOMMatrixReadOnly(window.getComputedStyle(scroller).transform);
            const translateX = matrix.m41 || 0;
            return Math.abs(translateX);
        }

        function getMaxPosition() {
            return scroller.scrollWidth - scroller.clientWidth;
        }

        function setPosition(newPosition, options) {
            const opts = options || {};
            const maxPosition = getMaxPosition() + 300;
            const clampedPosition = Math.min(Math.max(newPosition, 0), Math.max(maxPosition, 0));

            if (opts.animate) {
                scroller.style.transition = 'transform 270ms ease-out';
            } else {
                scroller.style.transition = 'none';
            }

            scroller.style.transform = `translateX(-${clampedPosition}px)`;
            scroller.style.setProperty('--scroll-x', String(clampedPosition));

            const section = scroller.closest('.emby-scroller-container');
            if (section && typeof applyScrollButtonState === 'function') {
                if (opts.animate) {
                    const onTransitionEnd = () => {
                        scroller.removeEventListener('transitionend', onTransitionEnd);
                        applyScrollButtonState(section);
                    };
                    scroller.addEventListener('transitionend', onTransitionEnd);
                } else {
                    requestAnimationFrame(() => applyScrollButtonState(section));
                }
            }
        }

        function getScrollCards() {
            const itemsContainer = scroller.querySelector('.itemsContainer');
            if (!itemsContainer) return [];
            return Array.from(itemsContainer.querySelectorAll(':scope > .card:not(.card-layout-dummy):not(.skeleton-card)'));
        }

        const scrollerPadding = (() => {
            const style = window.getComputedStyle(scroller);
            return {
                left: parseFloat(style.paddingLeft) || 0,
                right: parseFloat(style.paddingRight) || 0
            };
        })();

        function getCardScrollLeft(card) {
            // Scroller + cards share the same translateX, so this delta is layout offset
            // within the border box. Subtract paddingLeft so snap aligns to the padded
            // content gutter (same inset as card 0 at scroll 0), not the page edge.
            const scrollerRect = scroller.getBoundingClientRect();
            const cardRect = card.getBoundingClientRect();
            return cardRect.left - scrollerRect.left - scrollerPadding.left;
        }

        /**
         * Cards fully inside the padded content clip (not the browser viewport / border box).
         * Undo translateX, then inset by scroller padding so visibility matches snap targets.
         */
        function getFullyVisibleCardIndices(cards) {
            const fullyVisible = [];
            const epsilon = 1;
            const scrollerRect = scroller.getBoundingClientRect();
            const currentPosition = getCurrentPosition();
            const contentWidth = Math.max(
                0,
                scroller.clientWidth - scrollerPadding.left - scrollerPadding.right
            );
            const visibleLeft = scrollerRect.left + currentPosition + scrollerPadding.left;
            const visibleRight = visibleLeft + contentWidth;
            cards.forEach((card, index) => {
                const cardRect = card.getBoundingClientRect();
                if (cardRect.width <= 0) return;
                if (cardRect.left >= visibleLeft - epsilon && cardRect.right <= visibleRight + epsilon) {
                    fullyVisible.push(index);
                }
            });
            return fullyVisible;
        }

        function snapScrollToCardIndex(cards, targetIndex) {
            if (!cards.length) return;
            const clampedIndex = Math.max(0, Math.min(targetIndex, cards.length - 1));
            const targetLeft = getCardScrollLeft(cards[clampedIndex]);
            setPosition(targetLeft, { animate: true });
        }

        leftButton.addEventListener('click', () => {
            const cards = getScrollCards();
            if (!cards.length) return;
            const fullyVisible = getFullyVisibleCardIndices(cards);
            const firstVisible = fullyVisible.length ? fullyVisible[0] : 0;
            const step = Math.max(1, fullyVisible.length);
            snapScrollToCardIndex(cards, firstVisible - step);
        });

        scrollButtons.appendChild(leftButton);

        const rightButton = document.createElement('button');
        rightButton.type = 'button';
        rightButton.setAttribute('data-ripple', 'false');
        rightButton.setAttribute('data-direction', 'right');
        rightButton.setAttribute('title', 'Next');
        rightButton.className = 'emby-scrollbuttons-button paper-icon-button-light';
        const rightSpan = document.createElement('span');
        rightSpan.className = 'material-icons chevron_right';
        rightSpan.setAttribute('aria-hidden', 'true');
        rightButton.appendChild(rightSpan);

        rightButton.addEventListener('click', () => {
            const cards = getScrollCards();
            if (!cards.length) return;
            const fullyVisible = getFullyVisibleCardIndices(cards);
            const lastVisible = fullyVisible.length ? fullyVisible[fullyVisible.length - 1] : -1;
            const nextIndex = lastVisible + 1;
            if (nextIndex >= cards.length) {
                setPosition(getMaxPosition(), { animate: true });
                return;
            }
            snapScrollToCardIndex(cards, nextIndex);
        });

        scrollButtons.appendChild(rightButton);

        let dragState = {
            isDragging: false,
            startX: 0,
            startY: 0,
            startPosition: 0,
            currentPosition: 0,
            maxPosition: 0,
            hasMoved: false,
            lastX: 0,
            lastTime: 0,
            velocity: 0,
            momentumId: null
        };

        if (!isMobile) {
            const DRAG_THRESHOLD_PX = 8;

            function onPointerDown(e) {
                if (e.type === 'mousedown' && e.button !== 0) {
                    return;
                }

                const point = e.touches ? e.touches[0] : e;

                if (dragState.momentumId !== null) {
                    cancelAnimationFrame(dragState.momentumId);
                    dragState.momentumId = null;
                }

                dragState.startX = point.clientX;
                dragState.startY = point.clientY;
                dragState.isDragging = false;

                function checkThreshold(moveEvent) {
                    const p = moveEvent.touches ? moveEvent.touches[0] : moveEvent;
                    const dx = p.clientX - dragState.startX;
                    const dy = p.clientY - dragState.startY;
                    if (Math.abs(dx) < DRAG_THRESHOLD_PX && Math.abs(dy) < DRAG_THRESHOLD_PX) return;

                    dragState.isDragging = true;
                    dragState.startPosition = getCurrentPosition();
                    dragState.currentPosition = dragState.startPosition;
                    dragState.maxPosition = getMaxPosition();
                    dragState.hasMoved = false;
                    dragState.lastX = p.clientX;
                    dragState.lastTime = Date.now();
                    dragState.velocity = 0;

                    cleanupPending();
                    if (e.touches) {
                        document.addEventListener('touchmove', onDragMove, { passive: false });
                        document.addEventListener('touchend', onDragEnd, { passive: true });
                    } else {
                        document.addEventListener('mousemove', onDragMove);
                        document.addEventListener('mouseup', onDragEnd);
                    }
                    if (!moveEvent.touches) moveEvent.preventDefault();
                }

                function cleanupPending() {
                    if (e.touches) {
                        document.removeEventListener('touchmove', checkThreshold);
                        document.removeEventListener('touchend', onPointerUp);
                    } else {
                        document.removeEventListener('mousemove', checkThreshold);
                        document.removeEventListener('mouseup', onPointerUp);
                    }
                }

                function onPointerUp() {
                    if (!dragState.isDragging) cleanupPending();
                }

                if (e.touches) {
                    document.addEventListener('touchmove', checkThreshold, { passive: false });
                    document.addEventListener('touchend', onPointerUp, { passive: true });
                } else {
                    document.addEventListener('mousemove', checkThreshold);
                    document.addEventListener('mouseup', onPointerUp);
                    e.preventDefault();
                }
            }

            function onDragMove(e) {
                if (!dragState.isDragging) return;

                const point = e.touches ? e.touches[0] : e;
                const deltaX = dragState.startX - point.clientX;
                const deltaY = dragState.startY - point.clientY;

                if (Math.abs(deltaX) > 10 && Math.abs(deltaX) > Math.abs(deltaY) * 1.5) {
                    dragState.hasMoved = true;

                    const rawNewPosition = dragState.startPosition + deltaX;
                    const clampedPosition = Math.min(Math.max(rawNewPosition, 0), Math.max(dragState.maxPosition, 0));
                    dragState.currentPosition = clampedPosition;

                    setPosition(clampedPosition, { animate: false });

                    const currentTime = Date.now();
                    const timeDelta = currentTime - dragState.lastTime;
                    if (timeDelta > 0) {
                        const positionDelta = point.clientX - dragState.lastX;
                        dragState.velocity = positionDelta / timeDelta;
                    }
                    dragState.lastX = point.clientX;
                    dragState.lastTime = currentTime;

                    if (e.touches) {
                        e.preventDefault();
                    }
                }
            }

            function onDragEnd(e) {
                if (!dragState.isDragging) return;

                if (e.type === 'touchend') {
                    document.removeEventListener('touchmove', onDragMove);
                    document.removeEventListener('touchend', onDragEnd);
                } else {
                    document.removeEventListener('mousemove', onDragMove);
                    document.removeEventListener('mouseup', onDragEnd);
                }

                if (dragState.hasMoved) {
                    scroller.style.pointerEvents = 'none';
                    requestAnimationFrame(() => {
                        scroller.style.pointerEvents = '';
                    });
                }

                dragState.isDragging = false;

                const friction = 0.965;
                const velocityThreshold = 0.01;
                const velocityBoost = 2.0;

                dragState.velocity *= velocityBoost;

                if (Math.abs(dragState.velocity) > velocityThreshold) {
                    let currentPosition = dragState.currentPosition;
                    const maxPosition = dragState.maxPosition;
                    let lastTimestamp = 0;

                    const step = (timestamp) => {
                        const frameTime = lastTimestamp ? (timestamp - lastTimestamp) : 16;
                        lastTimestamp = timestamp;

                        if (Math.abs(dragState.velocity) > velocityThreshold) {
                            currentPosition -= dragState.velocity * frameTime;
                            currentPosition = Math.min(Math.max(currentPosition, 0), Math.max(maxPosition, 0));
                            setPosition(currentPosition, { animate: false });

                            if (currentPosition === 0 || currentPosition === maxPosition) {
                                dragState.velocity = 0;
                                dragState.momentumId = null;
                                return;
                            }

                            dragState.velocity *= friction;
                            dragState.momentumId = requestAnimationFrame(step);
                        } else {
                            dragState.velocity = 0;
                            dragState.momentumId = null;
                        }
                    };

                    dragState.momentumId = requestAnimationFrame(step);
                } else {
                    dragState.velocity = 0;
                    dragState.momentumId = null;
                }
            }

            scroller.addEventListener('mousedown', onPointerDown);
        }

        return scrollButtons;
    }

    /**
     * Creates a scrollable container with horizontal scrolling functionality
     * @param {Array} items - Array of Jellyfin item objects
     * @param {string} title - Title for the scrollable container
     * @param {string} viewMoreUrl - Optional URL to make title clickable
     * @param {boolean} overflowCard - Use overflow card classes instead of normal card classes
     * @param {string} cardFormat - Override card format: 'portrait', 'backdrop', or 'square'
     * @returns {HTMLElement} - The constructed scrollable container
     */
    function getFacetRowType(items) {
        if (!Array.isArray(items) || items.length === 0) return null;
        let genreCount = 0;
        let studioCount = 0;
        items.forEach((item) => {
            if (item?.Type === 'Genre') genreCount++;
            else if (item?.Type === 'Studio') studioCount++;
        });
        const threshold = Math.ceil(items.length / 2);
        if (genreCount >= threshold) return 'Genre';
        if (studioCount >= threshold) return 'Studio';
        return null;
    }

    function appendSectionTitleContent(sectionTitleContainer, { title, caption, captionUrl, viewMoreUrl, discoveryPending }) {
        const captionText = caption && String(caption).trim();
        const hasCaption = !!captionText;
        const useSkeletonTitle = discoveryPending === true;
        let parent = sectionTitleContainer;

        if (hasCaption) {
            const wrapper = document.createElement('div');
            wrapper.className = 'sectionTitle-wrapper';
            sectionTitleContainer.appendChild(wrapper);
            parent = wrapper;
        }

        if (useSkeletonTitle) {
            const titleText = document.createElement('h2');
            titleText.className = 'sectionTitle sectionTitle-cards';
            const skeletonTitle = document.createElement('span');
            skeletonTitle.className = 'skeleton-text-line skeleton-section-title';
            skeletonTitle.setAttribute('aria-hidden', 'true');
            titleText.appendChild(skeletonTitle);
            parent.appendChild(titleText);
        } else if (viewMoreUrl) {
            const titleLink = document.createElement('a');
            titleLink.className = 'sectionTitle-link button-flat button-flat-mini sectionTitleTextButton emby-button';
            titleLink.style.cssText = 'text-decoration: none; cursor: pointer; display: flex; align-items: center;';

            if (typeof viewMoreUrl === 'function') {
                titleLink.addEventListener('click', (e) => {
                    e.preventDefault();
                    viewMoreUrl();
                });
            } else {
                titleLink.href = viewMoreUrl;
            }

            const titleText = document.createElement('h2');
            titleText.className = 'sectionTitle sectionTitle-cards';
            titleText.textContent = title;

            const chevronIcon = document.createElement('span');
            chevronIcon.className = 'material-icons chevron_right';
            chevronIcon.setAttribute('aria-hidden', 'true');

            titleLink.appendChild(titleText);
            titleLink.appendChild(chevronIcon);
            parent.appendChild(titleLink);
        } else {
            const titleText = document.createElement('h2');
            titleText.className = 'sectionTitle sectionTitle-cards';
            titleText.textContent = title;
            parent.appendChild(titleText);
        }

        if (hasCaption) {
            let captionEl;
            if (useSkeletonTitle) {
                captionEl = document.createElement('span');
                captionEl.className = 'sectionTitle sectionCaption';
                const skeletonCaption = document.createElement('span');
                skeletonCaption.className = 'skeleton-text-line skeleton-section-caption';
                skeletonCaption.setAttribute('aria-hidden', 'true');
                captionEl.appendChild(skeletonCaption);
            } else if (captionUrl) {
                captionEl = document.createElement('a');
                captionEl.className = 'sectionTitle sectionCaption button-flat button-flat-mini sectionTitleTextButton emby-button';
                if (typeof captionUrl === 'function') {
                    captionEl.addEventListener('click', (e) => {
                        e.preventDefault();
                        captionUrl();
                    });
                } else {
                    captionEl.href = captionUrl;
                }
                captionEl.textContent = captionText;
            } else {
                captionEl = document.createElement('span');
                captionEl.className = 'sectionTitle sectionCaption';
                captionEl.textContent = captionText;
            }
            parent.appendChild(captionEl);
        }
    }

    function createScrollableContainer(items, title, viewMoreUrl = null, overflowCard = false, cardFormat = null, sectionConfig = null) {
        const normalizedFormat = (cardFormat || '').toLowerCase();
        const isButtonLayout = normalizedFormat === 'button';

        // Create the main vertical section container
        const verticalSection = document.createElement('div');
        verticalSection.className = 'verticalSection emby-scroller-container custom-scroller-container';
        const facetRowType = getFacetRowType(items);
        if (facetRowType) {
            verticalSection.style.setProperty('--row-hue', `${Math.floor(Math.random() * 360)}deg`);
            verticalSection.dataset.facetRowType = facetRowType;
        }
        
        // Persist the card format if provided (ensures consistency for random/updates)
        if (cardFormat) {
            verticalSection.setAttribute('data-card-format', cardFormat);
        }

        // Create section title
        const sectionTitleContainer = document.createElement('div');
        sectionTitleContainer.className = 'sectionTitleContainer sectionTitleContainer-cards padded-left';

        appendSectionTitleContent(sectionTitleContainer, {
            title,
            caption: getSectionCaption(sectionConfig),
            captionUrl: getSectionCaptionUrl(sectionConfig),
            viewMoreUrl
        });

        ensureSectionControlsMount(sectionTitleContainer);

        if (isButtonLayout) {
            const itemsContainer = document.createElement('div');
            itemsContainer.setAttribute('is', 'emby-itemscontainer');
            itemsContainer.className = 'itemsContainer padded-left padded-right focuscontainer-x';

            items.forEach((item, index) => {
                const button = createLibraryButtonElement(item);
                button.setAttribute('data-index', index);
                itemsContainer.appendChild(button);
            });

            /* verticalSection.appendChild(sectionTitleContainer);
            verticalSection.appendChild(itemsContainer);
            return verticalSection; */
        }

        // Create scroller container
        const scroller = createScrollerElement();
        const itemsContainer = createItemsSliderElement();

        // Add items to container
        const useParentCard = !!sectionConfig?.useParentCard;
        items.forEach((item, index) => {
            const card = createJellyfinCardElement(item, overflowCard, cardFormat, item.cardFooter, useParentCard);
            card.setAttribute('data-index', index);
            itemsContainer.appendChild(card);
        });

        scroller.appendChild(itemsContainer);

        const scrollButtons = attachScrollableSectionChrome(verticalSection, scroller);

        // Assemble the section
        verticalSection.appendChild(sectionTitleContainer);
        verticalSection.appendChild(scrollButtons);
        verticalSection.appendChild(scroller);

        registerScrollSectionScrollButtons(verticalSection);

        return verticalSection;
    }

    /**
     * Creates a skeleton card element for loading states
     * @param {string} cardFormat - Card format: 'portrait', 'backdrop', 'thumb', 'square', 'logo', 'clear art', 'disc', 'banner', etc.
     * @param {boolean} overflowCard - Use overflow card classes
     * @param {Object|null} sectionConfig - Section config used to infer footer line count
     * @returns {HTMLElement} - Skeleton card element
     */
    function createSkeletonCard(cardFormat = null, overflowCard = false, sectionConfig = null) {
        const card = document.createElement('div');
        
        // Determine card classes based on format (must match createJellyfinCardElement)
        let cardClass, padderClass;
        cardFormat = cardFormat?.toLowerCase() || 'portrait';
        
        if (cardFormat === 'backdrop' || cardFormat === 'thumb' || cardFormat === 'series thumb'
            || cardFormat === 'logo' || cardFormat === 'clear art') {
            cardClass = overflowCard ? 'overflowBackdropCard' : 'backdropCard';
            padderClass = 'cardPadder-backdrop';
        } else if (cardFormat === 'square' || cardFormat === 'disc') {
            cardClass = overflowCard ? 'overflowSquareCard' : 'squareCard';
            padderClass = 'cardPadder-square';
        } else if (cardFormat === 'banner') {
            cardClass = overflowCard ? 'overflowBannerCard' : 'bannerCard';
            padderClass = 'cardPadder-banner';
        } else {
            // portrait / poster / series poster (default)
            cardClass = overflowCard ? 'overflowPortraitCard' : 'portraitCard';
            padderClass = 'cardPadder-portrait';
        }
        
        card.className = `card ${cardClass} skeleton-card`;
        card.setAttribute('data-skeleton', 'true');
        
        const cardBox = document.createElement('div');
        cardBox.className = `cardBox cardBox-bottompadded`;
        
        const cardScalable = document.createElement('div');
        cardScalable.className = 'cardScalable';
        
        const cardPadder = document.createElement('div');
        cardPadder.className = `cardPadder ${padderClass} skeleton-padder`;
        cardPadder.style.cssText = 'background: rgba(255,255,255,0.12); animation: skeleton-pulse 1.5s ease-in-out infinite;';
        
        cardScalable.appendChild(cardPadder);
        cardBox.appendChild(cardScalable);

        const footerLineCount = getSkeletonFooterLineCount(sectionConfig);
        if (footerLineCount > 0) {
            const cardTextStack = document.createElement('div');
            cardTextStack.className = 'cardTextStack';

            const lineWidths = ['70%', '55%', '40%'];
            for (let lineIndex = 0; lineIndex < footerLineCount; lineIndex++) {
                const isFirst = lineIndex === 0;
                const cardText = document.createElement('div');
                cardText.className = isFirst
                    ? 'cardText cardTextCentered cardText-first'
                    : 'cardText cardTextCentered cardText-secondary';

                const bdi = document.createElement('bdi');
                const skeletonLine = document.createElement('span');
                skeletonLine.className = 'skeleton-text-line';
                skeletonLine.style.width = lineWidths[lineIndex] || '40%';
                bdi.appendChild(skeletonLine);
                cardText.appendChild(bdi);
                cardTextStack.appendChild(cardText);
            }

            cardBox.appendChild(cardTextStack);
        }

        card.appendChild(cardBox);
        
        return card;
    }

    /**
     * Creates a skeleton spotlight section for progressive enhancement.
     * Layout/size are derived from options so the skeleton matches the final spotlight (Border/Borderless, Normal/Large/Full).
     * @param {string} title - Title for the spotlight section
     * @param {Object} options - Options for the spotlight carousel (viewMoreUrl, spotlightLayout, spotlightSize, fullScreen)
     * @returns {HTMLElement} - Skeleton spotlight container
     */
    function createSkeletonSpotlightSection(title, options = {}) {
        const {
            viewMoreUrl = null,
            spotlightLayout,
            spotlightSize,
            fullScreen,
            discoveryPending = false,
            caption = null
        } = options;
        const layout = spotlightLayout ?? (fullScreen === true ? 'Borderless' : 'Border');
        const size = spotlightSize ?? (fullScreen === true ? 'full' : 'normal');
        const captionText = caption && String(caption).trim();
        const useSkeletonTitle = discoveryPending === true;

        // Create main container (same structure as real spotlight)
        const container = document.createElement('div');
        container.className = 'spotlight-section padded-left';
        container.dataset.layout = layout;
        container.dataset.size = size;

        // Create banner container
        const bannerContainer = document.createElement('div');
        bannerContainer.className = 'spotlight-banner-container';

        // Title container hosts section name + refresh/configure controls.
        // Always create it so controls can attach even when the section has no name.
        {
            const sectionTitleContainer = document.createElement('div');
            sectionTitleContainer.className = 'spotlight-section-title-container';
            if (useSkeletonTitle || title) {
                let sectionTitleEl;
                if (useSkeletonTitle) {
                    sectionTitleEl = document.createElement('div');
                    sectionTitleEl.className = 'emby-tab-button emby-tab-button-active emby-button-foreground';
                    const skeletonTitle = document.createElement('span');
                    skeletonTitle.className = 'skeleton-text-line skeleton-section-title';
                    skeletonTitle.setAttribute('aria-hidden', 'true');
                    sectionTitleEl.appendChild(skeletonTitle);
                } else if (viewMoreUrl) {
                    const titleLink = document.createElement('a');
                    titleLink.className = 'emby-tab-button emby-tab-button-active emby-button-foreground';
                    titleLink.textContent = title;
                    titleLink.title = 'See All';
                    titleLink.style.textDecoration = 'none';
                    if (typeof viewMoreUrl === 'function') {
                        titleLink.addEventListener('click', (e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            viewMoreUrl();
                        });
                    } else {
                        titleLink.href = viewMoreUrl;
                        titleLink.addEventListener('click', (e) => {
                            e.stopPropagation();
                        });
                    }
                    sectionTitleEl = titleLink;
                } else {
                    sectionTitleEl = document.createElement('div');
                    sectionTitleEl.className = 'emby-tab-button emby-tab-button-active emby-button-foreground';
                    sectionTitleEl.textContent = title;
                }
                const sectionTitleWrapper = document.createElement('div');
                sectionTitleWrapper.className = `spotlight-section-title ${(!useSkeletonTitle && viewMoreUrl) ? '' : 'spotlight-title-link '}headerTabs sectionTabs`;
                sectionTitleWrapper.appendChild(sectionTitleEl);
                sectionTitleContainer.appendChild(sectionTitleWrapper);

                if (useSkeletonTitle && captionText) {
                    const captionEl = document.createElement('span');
                    captionEl.className = 'sectionTitle sectionCaption';
                    const skeletonCaption = document.createElement('span');
                    skeletonCaption.className = 'skeleton-text-line skeleton-section-caption';
                    skeletonCaption.setAttribute('aria-hidden', 'true');
                    captionEl.appendChild(skeletonCaption);
                    sectionTitleContainer.appendChild(captionEl);
                }
            }
            bannerContainer.appendChild(sectionTitleContainer);
        }

        // Create skeleton item (single full-container placeholder)
        const itemsContainer = document.createElement('div');
        itemsContainer.className = 'spotlight-items-container';

        const skeletonItem = document.createElement('div');
        skeletonItem.className = 'spotlight-item skeleton-spotlight-item';
        skeletonItem.setAttribute('data-index', '0');
        skeletonItem.setAttribute('data-active', 'true');
        skeletonItem.style.cssText = 'background: rgba(255,255,255,0.12); animation: skeleton-pulse 1.5s ease-in-out infinite;';

        itemsContainer.appendChild(skeletonItem);
        bannerContainer.appendChild(itemsContainer);
        container.appendChild(bannerContainer);

        return container;
    }

    /**
     * Creates a scrollable container with skeleton cards for progressive enhancement
     * @param {string} title - Title for the scrollable container
     * @param {string|Function} viewMoreUrl - Optional URL to make title clickable
     * @param {string} cardFormat - Card format: 'portrait', 'backdrop', 'thumb', or 'square'
     * @param {boolean} overflowCard - Use overflow card classes
     * @returns {HTMLElement} - Container with skeleton cards
     */
    function createProgressivelyEnhancedScrollableContainer(title, viewMoreUrl = null, cardFormat = null, overflowCard = false, sectionConfig = null) {
        // Create the main vertical section container (same structure as createScrollableContainer)
        const verticalSection = document.createElement('div');
        verticalSection.className = 'verticalSection emby-scroller-container custom-scroller-container';
        
        // Persist the card format if provided (ensures consistency for random/updates)
        if (cardFormat) {
            verticalSection.setAttribute('data-card-format', cardFormat);
        }

        // If the query is using the /Genres or /Studios paths, set the row hue to a random color
        if (sectionConfig?.queries?.some(query => typeof query.path === 'string' && (query.path.includes('/Genres') || query.path.includes('/Studios')))) {
            verticalSection.style.setProperty('--row-hue', `${Math.floor(Math.random() * 360)}deg`);
        }

        // Create section title
        const sectionTitleContainer = document.createElement('div');
        sectionTitleContainer.className = 'sectionTitleContainer sectionTitleContainer-cards padded-left';

        const discoveryPending = sectionConfig?.discoveryPending === true;
        appendSectionTitleContent(sectionTitleContainer, {
            title,
            caption: getSectionCaption(sectionConfig),
            captionUrl: getSectionCaptionUrl(sectionConfig),
            viewMoreUrl: discoveryPending ? null : viewMoreUrl,
            discoveryPending
        });

        ensureSectionControlsMount(sectionTitleContainer);

        const scroller = createScrollerElement();
        const itemsContainer = createItemsSliderElement();

        const skeletonCount = getSectionSkeletonCount(sectionConfig);
        for (let i = 0; i < skeletonCount; i++) {
            const skeletonCard = createSkeletonCard(cardFormat, overflowCard, sectionConfig);
            skeletonCard.setAttribute('data-index', i);
            itemsContainer.appendChild(skeletonCard);
        }

        scroller.appendChild(itemsContainer);

        const scrollButtons = attachScrollableSectionChrome(verticalSection, scroller);

        verticalSection.appendChild(sectionTitleContainer);
        verticalSection.appendChild(scrollButtons);
        verticalSection.appendChild(scroller);

        registerScrollSectionScrollButtons(verticalSection);

        return verticalSection;
    }


    /**
     * Measures the width of an element
     * @param {HTMLElement} el - Element to measure
     * @returns {number} - Width of the element
     */
    function measure(el) {
        if (!el) {
            return 0;
        }


        let measureRoot = document.querySelector('#measure-root');
        if (!measureRoot) {
            measureRoot = document.createElement('div');
            measureRoot.id = 'measure-root';        
            measureRoot.style.cssText = 'position: absolute; visibility: hidden; contain: layout style paint; white-space: nowrap; pointer-events: none;';
            document.body.appendChild(measureRoot);
        }

        const clonedEl = el.cloneNode(true);
        measureRoot.appendChild(clonedEl);
        const width = clonedEl.getBoundingClientRect().width;
        measureRoot.removeChild(clonedEl);
        return width;
      }

    /**
     * Checks the state of a promise
     * @param {Promise} p - Promise to check
     * @returns {string} - State of the promise: 'pending', 'fulfilled', or 'rejected'
     */
    function promiseState(p) {
        const t = {};
        return Promise.race([p, t])
          .then(v => (v === t)? "pending" : "fulfilled", () => "rejected");
      }

    // Add skeleton loading animation CSS if not already present
    if (!document.getElementById('skeleton-animation-style')) {
        const style = document.createElement('style');
        style.id = 'skeleton-animation-style';
        style.textContent = `
            @keyframes skeleton-pulse {
                0%, 100% { opacity: 0.5; }
                50% { opacity: 1; }
            }
        `;
        document.head.appendChild(style);
    }

    // Smart Lazy Image Loading with Global Observers
    let lazyImageObserver = null;
    let lazyMutationObserver = null;

    // Run updateScrollButtonStateForSection once when a section becomes visible (so --max-scroll is computed after layout)
    let scrollSectionVisibilityObserver = null;

    /**
     * Initialize the global IntersectionObserver for lazy loading images
     * Watches when elements enter the viewport and loads their images
     */
    function initLazyImageObserver() {
        if (lazyImageObserver) return; // Already initialized

        // Mobile: tighter prefetch so image downloads don't stampede during discovery paint
        const rootMargin = isMobileLayout() ? '300px' : '800px';
        
        const observerOptions = {
            threshold: 0.1, // Trigger when 10% of element is visible
            rootMargin
        };
        
        lazyImageObserver = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (!entry.isIntersecting) return;
                const cardImageContainer = entry.target;
                const imageUrl = cardImageContainer.getAttribute('data-src');
                if (!imageUrl) return;
                if (cardImageContainer.hasAttribute('data-loading')) return;

                cardImageContainer.setAttribute('data-loading', 'true');
                const img = new Image();
                img.onload = () => {
                    const isSvg = /\.svg(?:[?#]|$)/i.test(imageUrl);
                    if (isSvg) {
                        const maskUrl = `url("${imageUrl}")`;
                        cardImageContainer.style.webkitMaskImage = maskUrl;
                        cardImageContainer.style.maskImage = maskUrl;
                        cardImageContainer.style.webkitMaskRepeat = 'no-repeat';
                        cardImageContainer.style.maskRepeat = 'no-repeat';
                        cardImageContainer.style.webkitMaskPosition = 'center';
                        cardImageContainer.style.maskPosition = 'center';
                        cardImageContainer.style.webkitMaskSize = 'contain';
                        cardImageContainer.style.maskSize = 'contain';
                        cardImageContainer.style.backgroundColor = 'white';
                        cardImageContainer.classList.add('lazy-masked-svg');
                    } else {
                        cardImageContainer.style.backgroundImage = `url("${imageUrl}")`;
                    }
                    cardImageContainer.classList.remove('lazy');
                    cardImageContainer.classList.add('lazy-loaded');
                    cardImageContainer.removeAttribute('data-src');
                    cardImageContainer.removeAttribute('data-loading');
                    cardImageContainer.classList.remove('lazy-hidden');
                    const canvas = cardImageContainer.previousElementSibling;
                    if (canvas && canvas.tagName === 'CANVAS' && canvas.classList.contains('blurhash-canvas')) {
                        canvas.classList.add('lazy-hidden');
                        canvas.removeAttribute('data-blurhash-pending');
                    }
                    lazyImageObserver.unobserve(cardImageContainer);
                };
                img.onerror = () => {
                    cardImageContainer.removeAttribute('data-loading');
                    cardImageContainer.removeAttribute('data-src');
                    cardImageContainer.classList.remove('lazy');
                    cardImageContainer.classList.add('lazy-loaded');
                    cardImageContainer.classList.remove('lazy-hidden');
                    const canvas = cardImageContainer.previousElementSibling;
                    if (canvas && canvas.tagName === 'CANVAS' && canvas.classList.contains('blurhash-canvas')) {
                        canvas.classList.add('lazy-hidden');
                        canvas.removeAttribute('data-blurhash-pending');
                    }
                    lazyImageObserver.unobserve(cardImageContainer);
                };
                img.src = imageUrl;
            });
        }, observerOptions);
    }
    
    /**
     * Initialize the global MutationObserver to detect new elements
     * Automatically adds new cardImageContainer elements with data-src to the IntersectionObserver
     */
    function initLazyMutationObserver() {
        if (lazyMutationObserver) return; // Already initialized
        
        if (!lazyImageObserver) {
            initLazyImageObserver();
        }
        
        lazyMutationObserver = new MutationObserver((mutations) => {
            mutations.forEach(mutation => {
                mutation.addedNodes.forEach(node => {
                    // Check if the added node itself is a cardImageContainer with data-src
                    if (node.nodeType === 1 && // Element node
                        node.classList && 
                        node.classList.contains('cardImageContainer') &&
                        node.hasAttribute('data-src')) {
                        lazyImageObserver.observe(node);
                    }
                    
                    // Check for cardImageContainer descendants
                    if (node.nodeType === 1 && node.querySelectorAll) {
                        const lazyImages = node.querySelectorAll('.cardImageContainer[data-src]');
                        lazyImages.forEach(img => {
                            lazyImageObserver.observe(img);
                        });
                    }

                    observePendingBlurhashInNode(node);
                });
            });
        });
    }

    /**
     * Apply scroll button state for a section from --scroll-x and --max-scroll on the scroller.
     */
    function applyScrollButtonState(verticalSection) {
        const scroller = verticalSection.querySelector('.emby-scroller');
        const scrollButtons = verticalSection.querySelector('.emby-scrollbuttons');
        const leftButton = scrollButtons && scrollButtons.querySelector('button[data-direction="left"]');
        const rightButton = scrollButtons && scrollButtons.querySelector('button[data-direction="right"]');
        if (!scroller || !scrollButtons || !leftButton || !rightButton) return;
        const scrollX = parseFloat(scroller.style.getPropertyValue('--scroll-x')) || 0;
        const maxScroll = parseFloat(scroller.style.getPropertyValue('--max-scroll')) || 0;
        leftButton.disabled = scrollX <= 0;
        rightButton.disabled = scrollX >= maxScroll - 1;
    }

    /**
     * Set --max-scroll on the scroller from dimensions and apply button state. Called once when section is visible so layout is ready.
     */
    function updateScrollButtonStateForSection(verticalSection) {
        const scroller = verticalSection.querySelector('.emby-scroller');
        if (!scroller) return;
        const maxScroll = Math.max(0, (scroller.scrollWidth - scroller.clientWidth) || 0);
        scroller.style.setProperty('--max-scroll', String(maxScroll));
        applyScrollButtonState(verticalSection);
    }

    /**
     * Ensure scroll section visibility observer exists. When a section becomes visible, runs updateScrollButtonStateForSection once then unobserves.
     */
    function getScrollSectionVisibilityObserver() {
        if (scrollSectionVisibilityObserver) return scrollSectionVisibilityObserver;
        scrollSectionVisibilityObserver = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (!entry.isIntersecting) return;
                const verticalSection = entry.target;
                scrollSectionVisibilityObserver.unobserve(verticalSection);
                updateScrollButtonStateForSection(verticalSection);
            });
        }, { root: null, threshold: 0.01 });
        return scrollSectionVisibilityObserver;
    }

    /**
     * Register a scrollable section: when it becomes visible, set --max-scroll once and apply initial button state.
     */
    function registerScrollSectionScrollButtons(verticalSection) {
        const itemsContainer = verticalSection.querySelector('.itemsContainer');
        const scroller = verticalSection.querySelector('.emby-scroller');
        const first = itemsContainer && itemsContainer.firstElementChild;
        const last = itemsContainer && itemsContainer.lastElementChild;
        if (!first || !last) {
            if (scroller) {
                scroller.style.setProperty('--max-scroll', '0');
                applyScrollButtonState(verticalSection);
            }
            return;
        }
        getScrollSectionVisibilityObserver().observe(verticalSection);
    }

    /**
     * Initialize the smart lazy loading system
     * Scans existing elements and starts both observers
     */
    function initSmartLazyLoading() {
        if (typeof IntersectionObserver === 'undefined' || typeof MutationObserver === 'undefined') {
            return; // Browser doesn't support observers
        }
        
        initLazyImageObserver();
        initLazyMutationObserver();
        initBlurhashFillObserver();
        
        const existingLazyImages = document.querySelectorAll('.cardImageContainer[data-src]');
        existingLazyImages.forEach(img => {
            lazyImageObserver.observe(img);
        });

        document.querySelectorAll('canvas.blurhash-canvas[data-blurhash-pending]').forEach(observeBlurhashCanvas);
        
        if (document.body) {
            lazyMutationObserver.observe(document.body, {
                childList: true,
                subtree: true
            });
        } else {
            document.addEventListener('DOMContentLoaded', () => {
                if (lazyMutationObserver && document.body) {
                    lazyMutationObserver.observe(document.body, {
                        childList: true,
                        subtree: true
                    });
                }
            });
        }
    }
    
    // Initialize smart lazy loading on module load
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initSmartLazyLoading);
    } else {
        initSmartLazyLoading();
    }

    // Progressive section enhancement (deferred via IntersectionObserver when enhanceOnVisible)
    let sectionEnhanceObserver = null;
    let sectionEnhanceObserverRootMargin = null;
    const sectionEnhancePending = new WeakMap();

    /**
     * Read the currently active spotlight slide from a live section.
     * @param {HTMLElement} sectionEl
     * @returns {{ slide: HTMLElement, index: number, id: string } | null}
     */
    function getActiveSpotlightSlide(sectionEl) {
        if (!sectionEl) return null;
        const slide = sectionEl.querySelector('.spotlight-item[data-active="true"], .spotlight-item[data-active]');
        if (!slide || slide.classList.contains('skeleton-spotlight-item')) return null;
        const index = parseInt(slide.getAttribute('data-index'), 10);
        const id = slide.getAttribute('data-id');
        if (!id || Number.isNaN(index) || index < 0) return null;
        return { slide, index, id };
    }

    /**
     * Build the item list for a keep-current-slide spotlight refresh.
     * Dedupes activeId from results when present; inserts at i or appends as N+1 when beyond.
     * @param {Array} newItems
     * @param {{ index: number, id: string }} activeMeta
     * @param {Array} dataItems - prior/cached items used to resolve the active item object
     * @returns {{ items: Array, preserveIndex: number }}
     */
    function buildSpotlightRefreshItems(newItems, activeMeta, dataItems) {
        const source = Array.isArray(newItems) ? newItems.slice() : [];
        const i = activeMeta.index;
        const activeId = String(activeMeta.id);
        const N = source.length;

        const findById = (list) => (list || []).find((d) => d && String(d.Id) === activeId);
        let activeItem = findById(dataItems) || findById(source);
        if (!activeItem) {
            return {
                items: source,
                preserveIndex: Math.min(i, Math.max(0, N - 1)),
                canPreserve: false
            };
        }

        // Prefer cached object so the kept slide matches item data
        activeItem = findById(dataItems) || activeItem;

        const wasInResults = source.some((d) => d && String(d.Id) === activeId);
        let working = wasInResults
            ? source.filter((d) => !(d && String(d.Id) === activeId))
            : source;

        if (wasInResults) {
            if (i <= working.length) {
                working.splice(i, 0, activeItem);
                return { items: working, preserveIndex: i, canPreserve: true };
            }
            working.push(activeItem);
            return { items: working, preserveIndex: working.length - 1, canPreserve: true };
        }

        if (i < N) {
            working.splice(i, 0, activeItem);
            return { items: working, preserveIndex: i, canPreserve: true };
        }
        working.push(activeItem);
        return { items: working, preserveIndex: working.length - 1, canPreserve: true };
    }

    /**
     * Replace the rebuilt slide at preserveIndex with the detached active slide DOM.
     * @param {HTMLElement} newSection
     * @param {HTMLElement} activeSlide
     * @param {number} preserveIndex
     */
    function transplantActiveSpotlightSlide(newSection, activeSlide, preserveIndex) {
        if (!newSection || !activeSlide) return;
        const container = newSection.querySelector('.spotlight-items-container');
        if (!container) return;

        activeSlide.setAttribute('data-index', String(preserveIndex));
        activeSlide.setAttribute('data-active', 'true');
        activeSlide.removeAttribute('data-fade-out');
        activeSlide.removeAttribute('data-entering');

        const built = container.querySelector(`.spotlight-item[data-index="${preserveIndex}"]`);
        if (built) {
            built.replaceWith(activeSlide);
        } else {
            container.appendChild(activeSlide);
        }
    }

    /**
     * Rebuild a spotlight section from fresh items, optionally preserving the active slide.
     * @param {HTMLElement} sectionElement
     * @param {Array} items
     * @param {Object} options
     * @param {string} options.name
     * @param {string} [options.viewMoreUrl]
     * @param {Object} [options.spotlightConfig]
     * @param {Array} [options.dataItems]
     * @param {boolean} [options.keepCurrentSlide]
     * @param {Object} [options.sectionConfig]
     * @returns {{ content: HTMLElement, items: Array }}
     */
    function refreshSpotlight(sectionElement, items, options = {}) {
        const {
            name,
            viewMoreUrl = null,
            spotlightConfig = {},
            dataItems = [],
            keepCurrentSlide = false,
            sectionConfig = null
        } = options;

        let itemsForBuild = Array.isArray(items) ? items.slice() : [];
        let preserveIndex = 0;
        let activeSlide = null;
        let doPreserve = false;

        if (keepCurrentSlide) {
            const activeMeta = getActiveSpotlightSlide(sectionElement);
            if (activeMeta) {
                const built = buildSpotlightRefreshItems(itemsForBuild, activeMeta, dataItems);
                if (built.canPreserve) {
                    itemsForBuild = built.items;
                    preserveIndex = built.preserveIndex;
                    activeSlide = activeMeta.slide;
                    doPreserve = true;
                    // Detach before the old section is discarded so we can transplant it
                    activeSlide.remove();
                }
            }
        }

        const content = createSpotlightSection(itemsForBuild, name, {
            viewMoreUrl,
            ...spotlightConfig,
            ...(doPreserve ? { initialIndex: preserveIndex } : {})
        });

        if (doPreserve && activeSlide) {
            transplantActiveSpotlightSlide(content, activeSlide, preserveIndex);
        }

        content.style.cssText = sectionElement.style.cssText;
        content.className = sectionElement.className;
        Array.from(sectionElement.attributes).forEach((attr) => {
            content.setAttribute(attr.name, attr.value);
        });

        if (sectionConfig) {
            attachSectionControlButtons(sectionConfig, content, itemsForBuild);
        }

        sectionElement.replaceWith(content);
        return { content, items: itemsForBuild };
    }

    function getPaintedCardIds(sectionElement) {
        const cards = sectionElement.querySelectorAll('.itemsContainer > .card[data-id]:not(.card-layout-dummy):not(.skeleton-card)');
        if (cards.length) {
            return Array.from(cards).map((card) => card.getAttribute('data-id')).filter(Boolean);
        }
        const buttons = sectionElement.querySelectorAll('.itemsContainer > .homeLibraryButton[data-id]');
        return Array.from(buttons).map((button) => button.getAttribute('data-id')).filter(Boolean);
    }

    function classifyIdSequence(staleIds, freshIds) {
        if (!staleIds.length || !freshIds.length) return { type: 'replace' };
        if (staleIds.length === freshIds.length && staleIds.every((id, i) => id === freshIds[i])) {
            return { type: 'perfect' };
        }

        const staleSet = new Set(staleIds);
        const freshSet = new Set(freshIds);
        const sharedStale = staleIds.filter((id) => freshSet.has(id));
        const sharedFresh = freshIds.filter((id) => staleSet.has(id));
        if (!sharedStale.length || sharedStale.length !== sharedFresh.length) return { type: 'replace' };
        if (sharedStale.some((id, i) => id !== sharedFresh[i])) return { type: 'replace' };
        return { type: 'reconcile' };
    }

    function runAfterTransition(element, durationMs, callback) {
        let done = false;
        const finish = () => {
            if (done) return;
            done = true;
            element.removeEventListener('transitionend', onEnd);
            callback();
        };
        const onEnd = (event) => {
            if (event.target !== element) return;
            finish();
        };
        element.addEventListener('transitionend', onEnd);
        setTimeout(finish, durationMs);
    }

    function patchCardProgressBar(card, item) {
        const imageContainer = card.querySelector('.cardImageContainer');
        if (!imageContainer) return;

        const percent = item.UserData?.PlayedPercentage;
        const existingBar = imageContainer.querySelector('.itemProgressBarForeground');
        const existingFooter = existingBar?.closest('.innerCardFooter');

        if (percent && percent > 0) {
            if (existingBar) {
                existingBar.style.width = `${percent}%`;
                return;
            }
            const innerCardFooter = document.createElement('div');
            innerCardFooter.className = 'innerCardFooter fullInnerCardFooter innerCardFooterClear';
            const itemProgressBar = document.createElement('div');
            itemProgressBar.className = 'itemProgressBar';
            const itemProgressBarForeground = document.createElement('div');
            itemProgressBarForeground.className = 'itemProgressBarForeground';
            itemProgressBarForeground.style.width = `${percent}%`;
            itemProgressBar.appendChild(itemProgressBarForeground);
            innerCardFooter.appendChild(itemProgressBar);
            imageContainer.appendChild(innerCardFooter);
            return;
        }

        if (existingFooter && existingFooter.querySelector('.itemProgressBar')) {
            existingFooter.remove();
        }
    }

    function patchCardsUserData(sectionElement, items) {
        items.forEach((item) => {
            if (!item?.Id) return;
            updateCardResumeAttributes(item.Id, item.UserData || {});
            const escapedId = typeof CSS !== 'undefined' && CSS.escape
                ? CSS.escape(item.Id)
                : String(item.Id).replace(/["\\]/g, '\\$&');
            const card = sectionElement.querySelector(`.itemsContainer > .card[data-id="${escapedId}"]`);
            if (card) patchCardProgressBar(card, item);
        });
    }

    function getCardOuterWidth(card) {
        if (!card) return 0;
        const style = window.getComputedStyle(card);
        return card.getBoundingClientRect().width
            + (parseFloat(style.marginLeft) || 0)
            + (parseFloat(style.marginRight) || 0);
    }

    function getScrollerPosition(scroller) {
        if (!scroller) return 0;
        if (scroller.classList.contains('scrollX')) return scroller.scrollLeft || 0;
        const v = scroller.style.getPropertyValue('--scroll-x');
        if (v !== '' && !isNaN(parseFloat(v))) return parseFloat(v);
        return 0;
    }

    function setScrollerPosition(scroller, position, animate) {
        if (!scroller) return;
        const maxPosition = Math.max(0, (scroller.scrollWidth - scroller.clientWidth) || 0);
        const clamped = Math.min(Math.max(position, 0), maxPosition + 300);
        if (scroller.classList.contains('scrollX')) {
            scroller.scrollTo({ left: clamped, behavior: animate ? 'smooth' : 'auto' });
            return;
        }
        scroller.style.transition = animate ? 'transform 400ms ease-out' : 'none';
        scroller.style.transform = `translateX(-${clamped}px)`;
        scroller.style.setProperty('--scroll-x', String(clamped));
    }

    function reindexSectionCards(itemsContainer) {
        getRealLayoutCards(itemsContainer).forEach((card, index) => {
            card.setAttribute('data-index', String(index));
        });
    }

    function appendCardsForItems(itemsContainer, items, overflowCard, cardFormat, startIndex = 0, useParentCard = false) {
        const cards = [];
        items.forEach((item, offset) => {
            const card = createJellyfinCardElement(item, overflowCard, cardFormat, item.cardFooter, useParentCard);
            card.setAttribute('data-index', String(startIndex + offset));
            itemsContainer.appendChild(card);
            cards.push(card);
        });
        return cards;
    }

    function clearCardReconcileStyles(card) {
        card.classList.remove('cardbuilder-card-insert', 'cardbuilder-card-collapse', 'is-in');
        card.style.width = '';
        card.style.minWidth = '';
        card.style.maxWidth = '';
        card.style.marginLeft = '';
        card.style.marginRight = '';
        card.style.overflow = '';
        card.style.opacity = '';
        card.style.paddingLeft = '';
        card.style.paddingRight = '';
    }

    function captureCardLayout(card) {
        const style = window.getComputedStyle(card);
        return {
            card,
            width: card.getBoundingClientRect().width,
            marginLeft: style.marginLeft,
            marginRight: style.marginRight
        };
    }

    function applyCardCollapsedSize(card) {
        card.style.width = '0px';
        card.style.minWidth = '0px';
        card.style.maxWidth = '0px';
        card.style.marginLeft = '0px';
        card.style.marginRight = '0px';
        card.style.overflow = 'hidden';
        card.style.opacity = '0';
    }

    function applyCardExpandedSize(layout) {
        const { card, width, marginLeft, marginRight } = layout;
        card.style.width = `${width}px`;
        card.style.minWidth = `${width}px`;
        card.style.maxWidth = `${width}px`;
        card.style.marginLeft = marginLeft;
        card.style.marginRight = marginRight;
        card.style.overflow = 'hidden';
        card.style.opacity = '1';
    }

    function reconcileRowItems(sectionElement, items, sectionConfig, onComplete) {
        const itemsContainer = sectionElement.querySelector('.itemsContainer');
        const scroller = sectionElement.querySelector('.emby-scroller');
        if (!itemsContainer) return false;

        const overflowCard = sectionConfig.overflowCard;
        const cardFormat = sectionElement.getAttribute('data-card-format') || sectionConfig.cardFormat;

        const paintedCards = getRealLayoutCards(itemsContainer).filter((card) => {
            return card.getAttribute('data-id') && !card.classList.contains('skeleton-card');
        });
        const cardById = new Map();
        paintedCards.forEach((card) => {
            const id = card.getAttribute('data-id');
            if (id && !cardById.has(id)) cardById.set(id, card);
        });

        const freshIds = sectionConfig?.useParentCard ? items.map((item) => item?.ParentId || item?.SeriesId || item?.Id).filter(Boolean) : items.map((item) => item?.Id).filter(Boolean);
        const freshSet = new Set(freshIds);
        const outgoing = paintedCards.filter((card) => !freshSet.has(card.getAttribute('data-id')));
        const inserted = [];
        const prefixInserted = [];

        let nextNode = paintedCards[0] || null;
        let seenKept = false;

        items.forEach((item) => {
            if (!item?.Id) return;
            const existing = cardById.get(item.Id);
            if (existing) {
                seenKept = true;
                nextNode = existing.nextElementSibling;
                while (nextNode && (nextNode.classList.contains('card-layout-dummy') || nextNode.classList.contains('skeleton-card'))) {
                    nextNode = nextNode.nextElementSibling;
                }
                return;
            }

            const card = createJellyfinCardElement(item, overflowCard, cardFormat, item.cardFooter, !!sectionConfig?.useParentCard);
            if (nextNode) itemsContainer.insertBefore(card, nextNode);
            else itemsContainer.appendChild(card);
            inserted.push(card);
            if (!seenKept) prefixInserted.push(card);
        });

        ensureCardBorders(sectionElement);

        const previousPosition = getScrollerPosition(scroller);
        let prefixWidth = 0;
        prefixInserted.forEach((card) => {
            prefixWidth += getCardOuterWidth(card);
        });

        const midInserted = inserted.filter((card) => !prefixInserted.includes(card));
        const midLayouts = midInserted.map(captureCardLayout);
        const outgoingLayouts = outgoing.map(captureCardLayout);
        const canSlidePrefix = !!(scroller && prefixWidth > 0);
        const prefixLayouts = canSlidePrefix ? [] : prefixInserted.map(captureCardLayout);

        midLayouts.forEach(({ card }) => {
            card.classList.add('cardbuilder-card-insert');
            applyCardCollapsedSize(card);
        });
        prefixLayouts.forEach(({ card }) => {
            card.classList.add('cardbuilder-card-insert');
            applyCardCollapsedSize(card);
        });
        outgoingLayouts.forEach((layout) => {
            layout.card.classList.add('cardbuilder-card-collapse');
            applyCardExpandedSize(layout);
        });
        if (canSlidePrefix) {
            prefixInserted.forEach((card) => {
                card.classList.add('cardbuilder-card-insert');
                card.style.opacity = '0';
            });
            setScrollerPosition(scroller, previousPosition + prefixWidth, false);
        }

        itemsContainer.offsetHeight;
        itemsContainer.classList.add('cardbuilder-row-animating');

        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                outgoingLayouts.forEach(({ card }) => applyCardCollapsedSize(card));
                midLayouts.forEach((layout) => {
                    layout.card.classList.add('is-in');
                    applyCardExpandedSize(layout);
                });
                prefixLayouts.forEach((layout) => {
                    layout.card.classList.add('is-in');
                    applyCardExpandedSize(layout);
                });
                if (canSlidePrefix) {
                    prefixInserted.forEach((card) => {
                        card.classList.add('is-in');
                        card.style.opacity = '1';
                    });
                    setScrollerPosition(scroller, previousPosition, true);
                }

                const animTarget = outgoing[0] || midInserted[0] || prefixInserted[0] || scroller || itemsContainer;
                runAfterTransition(animTarget, 450, () => {
                    outgoing.forEach((card) => card.remove());
                    inserted.forEach(clearCardReconcileStyles);
                    itemsContainer.classList.remove('cardbuilder-row-animating');
                    if (scroller) scroller.style.transition = '';
                    reindexSectionCards(itemsContainer);
                    invalidateLastRowPadding(itemsContainer);
                    patchCardsUserData(sectionElement, items);
                    ensureCardBorders(sectionElement);
                    updateScrollButtonStateForSection(sectionElement);
                    if (typeof onComplete === 'function') {
                        onComplete();
                    }
                });
            });
        });

        return true;
    }

    function replaceItemsContainerContents(sectionElement, items, sectionConfig) {
        const itemsContainer = sectionElement.querySelector('.itemsContainer');
        if (!itemsContainer || !sectionConfig) return sectionElement;

        const overflowCard = sectionConfig.overflowCard;
        const cardFormat = sectionElement.getAttribute('data-card-format') || sectionConfig.cardFormat;
        const normalizedFormat = (cardFormat || '').toLowerCase();
        const layoutFromDom = itemsContainer.getAttribute('data-layout');
        const layout = (layoutFromDom === 'grid' || layoutFromDom === 'row')
            ? layoutFromDom
            : resolveItemsLayout(sectionConfig);
        const gapless = itemsContainer.getAttribute('data-gapless') === 'true'
            || resolveUseGaplessCards(sectionConfig);

        invalidateLastRowPadding(itemsContainer);

        const fragment = document.createDocumentFragment();
        if (normalizedFormat === 'button' || isButtonCardFormat(cardFormat)) {
            items.forEach((item, index) => {
                const button = createLibraryButtonElement(item);
                button.setAttribute('data-index', String(index));
                fragment.appendChild(button);
            });
        } else {
            const useParentCard = !!sectionConfig?.useParentCard;
            items.forEach((item, index) => {
                const card = createJellyfinCardElement(item, overflowCard, cardFormat, item.cardFooter, useParentCard);
                card.setAttribute('data-index', String(index));
                fragment.appendChild(card);
            });
        }

        itemsContainer.replaceChildren(fragment);

        applyItemsLayoutState(sectionElement, layout, gapless);
        ensureCardBorders(sectionElement);
        attachSectionControlButtons(sectionConfig, sectionElement, items);
        requestAnimationFrame(() => updateScrollButtonStateForSection(sectionElement));

        return sectionElement;
    }

    function fadeReplaceRowItems(sectionElement, items, sectionConfig, onComplete) {
        const itemsContainer = sectionElement.querySelector('.itemsContainer');
        if (!itemsContainer) return false;

        const finish = () => {
            replaceItemsContainerContents(sectionElement, items, sectionConfig);
            requestAnimationFrame(() => itemsContainer.classList.remove('is-hidden'));
            if (typeof onComplete === 'function') {
                onComplete();
            }
        };

        if (isMobileLayout()) {
            finish();
            return true;
        }

        itemsContainer.classList.add('cardbuilder-items-fade');
        itemsContainer.offsetHeight;
        itemsContainer.classList.add('is-hidden');
        runAfterTransition(itemsContainer, 320, finish);
        return true;
    }

    function replaceSectionWithFreshCards(sectionElement, items, sectionConfig, dataItems, revealSectionsSequentially) {
        let finalCardFormat = sectionConfig.cardFormat;
        const skeletonCardFormat = sectionElement.getAttribute('data-card-format');
        if (skeletonCardFormat) {
            finalCardFormat = skeletonCardFormat;
        }

        if (sectionConfig.spotlight || sectionConfig.renderMode === 'Spotlight') {
            const refreshed = refreshSpotlight(sectionElement, items, {
                name: sectionConfig.name,
                viewMoreUrl: sectionConfig.viewMoreUrl,
                spotlightConfig: sectionConfig.spotlightConfig,
                dataItems: Array.isArray(dataItems) ? dataItems : [],
                keepCurrentSlide: true,
                sectionConfig
            });
            ensureCardBorders(refreshed.content);
            if (revealSectionsSequentially && refreshed.content.classList.contains('cardbuilder-section-reveal') && !refreshed.content.classList.contains('in-viewport')) {
                observeSectionForReveal(refreshed.content);
            }
            return refreshed.content;
        }

        const content = createScrollableContainer(items, sectionConfig.name, sectionConfig.viewMoreUrl, sectionConfig.overflowCard, finalCardFormat, sectionConfig);
        content.style.cssText = sectionElement.style.cssText;
        content.className = sectionElement.className;
        Array.from(sectionElement.attributes).forEach((attr) => {
            content.setAttribute(attr.name, attr.value);
        });

        const oldItemsContainer = sectionElement.querySelector('.itemsContainer');
        const layoutFromDom = oldItemsContainer?.getAttribute('data-layout');
        const layout = (layoutFromDom === 'grid' || layoutFromDom === 'row')
            ? layoutFromDom
            : resolveItemsLayout(sectionConfig);
        const gapless = oldItemsContainer
            ? oldItemsContainer.getAttribute('data-gapless') === 'true'
            : resolveUseGaplessCards(sectionConfig);
        invalidateLastRowPadding(content.querySelector('.itemsContainer'));
        attachSectionControlButtons(sectionConfig, content, items);
        sectionElement.replaceWith(content);
        applyItemsLayoutState(content, layout, gapless);
        ensureCardBorders(content);
        if (revealSectionsSequentially && content.classList.contains('cardbuilder-section-reveal') && !content.classList.contains('in-viewport')) {
            observeSectionForReveal(content);
        }
        return content;
    }

    function fadeReplaceSpotlight(sectionElement, items, sectionConfig, dataItems, revealSectionsSequentially) {
        sectionElement.classList.add('cardbuilder-items-fade');
        sectionElement.offsetHeight;
        sectionElement.classList.add('is-hidden');
        runAfterTransition(sectionElement, 320, () => {
            const content = replaceSectionWithFreshCards(sectionElement, items, sectionConfig, dataItems, revealSectionsSequentially);
            markSectionEnhanced(content, sectionConfig);
            content.classList.add('cardbuilder-items-fade', 'is-hidden');
            requestAnimationFrame(() => content.classList.remove('is-hidden'));
        });
    }

    function markSectionEnhanced(sectionElement, sectionConfig) {
        if (!sectionElement) return;
        sectionElement.dataset.enhanced = 'true';
        if (typeof sectionConfig?._onSectionEnhanced === 'function') {
            sectionConfig._onSectionEnhanced(sectionElement, sectionConfig);
        }
    }

    function getDismissEmptySectionTimerMs() {
        const raw = window.KefinTweaksConfig?.homeScreenConfig?.HOME_SETTINGS?.dismissEmptySectionTimer
            ?? window.KefinHomeConfig2?.HOME_SETTINGS?.dismissEmptySectionTimer
            ?? 0;
        const n = Number(raw);
        return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
    }

    /**
     * Show "No items found" at locked section height, then fade and remove.
     * Used when progressive enhance resolves to an empty item list and the timer is > 0.
     */
    function dismissEmptyProgressiveSection(sectionElement, { holdMs = 1000 } = {}) {
        if (!sectionElement || !sectionElement.isConnected) return;
        if (sectionElement.dataset.emptyDismissing === 'true') return;

        sectionElement.dataset.emptyDismissing = 'true';
        const lockedHeight = Math.max(sectionElement.offsetHeight, 0);
        if (lockedHeight > 0) {
            sectionElement.style.minHeight = `${lockedHeight}px`;
        }

        const isSpotlight = sectionElement.classList.contains('spotlight-section')
            || !!sectionElement.querySelector('.spotlight-items-container, .skeleton-spotlight-item');

        const message = document.createElement('div');
        message.className = 'cardbuilder-empty-message';
        message.textContent = 'No items found';

        if (isSpotlight) {
            const itemsContainer = sectionElement.querySelector('.spotlight-items-container');
            if (itemsContainer) {
                itemsContainer.innerHTML = '';
                itemsContainer.appendChild(message);
            } else {
                const body = sectionElement.querySelector('.spotlight-banner-container') || sectionElement;
                Array.from(body.children).forEach((child) => {
                    if (!child.classList.contains('spotlight-section-title-container')
                        && !child.classList.contains('sectionTitleContainer')) {
                        child.remove();
                    }
                });
                body.appendChild(message);
            }
        } else {
            const itemsContainer = sectionElement.querySelector('.itemsContainer');
            if (itemsContainer) {
                itemsContainer.innerHTML = '';
                itemsContainer.appendChild(message);
            } else {
                sectionElement.appendChild(message);
            }
        }

        const hold = Math.max(0, Number(holdMs) || 0);
        setTimeout(() => {
            if (!sectionElement.isConnected) return;
            sectionElement.classList.add('cardbuilder-items-fade');
            sectionElement.offsetHeight;
            sectionElement.classList.add('is-hidden');
            runAfterTransition(sectionElement, 320, () => {
                sectionElement.remove();
            });
        }, hold);
    }

    function hasSectionDeferredData(result) {
        if (!result) return false;
        if (typeof result.ensureData === 'function') return true;
        if (result.isStalePromise) return true;
        return !!Object.getOwnPropertyDescriptor(result, 'dataPromise');
    }

    function getSectionDataPromise(result) {
        if (!result) return null;
        if (typeof result.ensureData === 'function') return result.ensureData();
        const desc = Object.getOwnPropertyDescriptor(result, 'dataPromise');
        if (desc?.get) return desc.get.call(result);
        return result.dataPromise || null;
    }

    function setupSectionProgressiveEnhancement(sectionElement, section, { revealSectionsSequentially = false } = {}) {
        if (!sectionElement || !section?.result) return;
        if (!hasSectionDeferredData(section.result)) return;
        if (sectionElement.dataset.enhanceScheduled === 'true') return;

        sectionElement.dataset.enhanceScheduled = 'true';

        const dataPromise = getSectionDataPromise(section.result);
        if (!dataPromise) return;

        section.result.isStalePromise?.then(isStale => {
            if (isStale) {
                sectionElement.dataset.refreshing = 'true';
            }
        });

        dataPromise.then(result => {
            sectionElement.dataset.refreshing = 'false';

            const sectionConfig = section.config;
            let items = result?.Items ?? result ?? [];
            if (!Array.isArray(items)) items = [];

            const dataItems = section.result?.data?.Items ?? section.result?.data ?? [];
            const isSpotlight = sectionConfig.spotlight || sectionConfig.renderMode === 'Spotlight';
            const isSkeleton = !!(sectionElement.querySelector('.skeleton-card, .skeleton-spotlight-item'));
            const hasSkeletonTitle = !!sectionElement.querySelector('.skeleton-section-title');

            if (items.length === 0) {
                const holdMs = getDismissEmptySectionTimerMs();
                if (holdMs > 0) {
                    dismissEmptyProgressiveSection(sectionElement, { holdMs });
                } else {
                    sectionElement.remove();
                }
                return;
            }

            // Discovery pending (and any skeleton with placeholder title) needs a full rebuild for title/viewMore/caption
            if (isSkeleton && (isSpotlight || hasSkeletonTitle)) {
                const content = replaceSectionWithFreshCards(sectionElement, items, sectionConfig, dataItems, revealSectionsSequentially);
                markSectionEnhanced(content, sectionConfig);
                return;
            }

            if (!isSkeleton && isSpotlight) {
                const staleIds = (Array.isArray(dataItems) ? dataItems : [])
                    .map((item) => item?.Id)
                    .filter(Boolean);
                const paintedIds = staleIds.length
                    ? staleIds
                    : Array.from(sectionElement.querySelectorAll('.spotlight-item[data-id]:not(.skeleton-spotlight-item)'))
                        .map((el) => el.getAttribute('data-id'))
                        .filter(Boolean);
                const freshIds = sectionConfig?.useParentCard ? items.map((item) => item?.ParentId || item?.SeriesId || item?.Id).filter(Boolean) : items.map((item) => item?.Id).filter(Boolean);
                const match = classifyIdSequence(paintedIds, freshIds);
                if (match.type === 'perfect') {
                    markSectionEnhanced(sectionElement, sectionConfig);
                    return;
                }
                // Soft-replace without fading the section to black (avoids visible→black→image blink on load)
                const spotlightContent = replaceSectionWithFreshCards(sectionElement, items, sectionConfig, dataItems, revealSectionsSequentially);
                markSectionEnhanced(spotlightContent, sectionConfig);
                return;
            }

            if (!isSkeleton && !isSpotlight) {
                const paintedIds = getPaintedCardIds(sectionElement);
                const freshIds = sectionConfig?.useParentCard ? items.map((item) => item?.ParentId || item?.SeriesId || item?.Id).filter(Boolean) : items.map((item) => item?.Id).filter(Boolean);
                const match = classifyIdSequence(paintedIds, freshIds);

                if (match.type === 'perfect') {
                    patchCardsUserData(sectionElement, items);
                    markSectionEnhanced(sectionElement, sectionConfig);
                    return;
                }

                const itemsContainer = sectionElement.querySelector('.itemsContainer');
                const layoutFromDom = itemsContainer?.getAttribute('data-layout');
                const layout = (layoutFromDom === 'grid' || layoutFromDom === 'row')
                    ? layoutFromDom
                    : resolveItemsLayout(sectionConfig);

                if (match.type === 'reconcile' && layout === 'row') {
                    reconcileRowItems(sectionElement, items, sectionConfig, () => {
                        markSectionEnhanced(sectionElement, sectionConfig);
                    });
                    return;
                }

                const cardFormat = sectionElement.getAttribute('data-card-format') || sectionConfig.cardFormat;
                if (isButtonCardFormat(cardFormat) && match.type === 'replace') {
                    replaceItemsContainerContents(sectionElement, items, sectionConfig);
                    markSectionEnhanced(sectionElement, sectionConfig);
                    return;
                }

                fadeReplaceRowItems(sectionElement, items, sectionConfig, () => {
                    markSectionEnhanced(sectionElement, sectionConfig);
                });
                return;
            }

            if (isSkeleton && isSpotlight) {
                const spotlightContent = replaceSectionWithFreshCards(sectionElement, items, sectionConfig, dataItems, revealSectionsSequentially);
                markSectionEnhanced(spotlightContent, sectionConfig);
                return;
            }

            replaceItemsContainerContents(sectionElement, items, sectionConfig);
            markSectionEnhanced(sectionElement, sectionConfig);
        });
    }

    function initializeSectionEnhanceObserver(rootMargin = '30% 0px 30% 0px') {
        if (typeof IntersectionObserver === 'undefined') {
            return;
        }

        if (sectionEnhanceObserver && sectionEnhanceObserverRootMargin === rootMargin) {
            return;
        }

        if (sectionEnhanceObserver) {
            sectionEnhanceObserver.disconnect();
        }

        sectionEnhanceObserverRootMargin = rootMargin;
        sectionEnhanceObserver = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (!entry.isIntersecting) return;

                const target = entry.target;
                sectionEnhanceObserver.unobserve(target);

                const pending = sectionEnhancePending.get(target);
                if (!pending) return;

                sectionEnhancePending.delete(target);
                setupSectionProgressiveEnhancement(target, pending.section, pending.options);
            });
        }, {
            threshold: 0,
            rootMargin
        });
    }

    function observeSectionForEnhance(sectionElement) {
        if (!sectionElement || !sectionEnhancePending.has(sectionElement)) return;

        initializeSectionEnhanceObserver(sectionEnhanceObserverRootMargin || '30% 0px 30% 0px');

        if (sectionEnhanceObserver) {
            sectionEnhanceObserver.observe(sectionElement);
        } else {
            const pending = sectionEnhancePending.get(sectionElement);
            sectionEnhancePending.delete(sectionElement);
            if (pending) {
                setupSectionProgressiveEnhancement(sectionElement, pending.section, pending.options);
            }
        }
    }

    function scheduleSectionProgressiveEnhancement(sectionElement, section, options) {
        const { enhanceOnVisible = false, enhanceRootMargin = '30% 0px 30% 0px', revealSectionsSequentially = false } = options;

        if (!hasSectionDeferredData(section?.result)) {
            return;
        }

        const enhanceOptions = { revealSectionsSequentially };

        if (!enhanceOnVisible) {
            setupSectionProgressiveEnhancement(sectionElement, section, enhanceOptions);
            return;
        }

        if (typeof IntersectionObserver === 'undefined') {
            setupSectionProgressiveEnhancement(sectionElement, section, enhanceOptions);
            return;
        }

        sectionEnhanceObserverRootMargin = enhanceRootMargin;
        sectionEnhancePending.set(sectionElement, { section, options: enhanceOptions });
        observeSectionForEnhance(sectionElement);
    }

    // Progressive Section Reveal with IntersectionObserver
    let sectionRevealObserver = null;
    
    /**
     * Initialize the global IntersectionObserver for section reveal animations
     * Watches when sections enter the viewport and triggers fade-in animations
     */
    function initializeSectionRevealObserver() {
        if (sectionRevealObserver) return; // Already initialized
        
        if (typeof IntersectionObserver === 'undefined') {
            return; // Browser doesn't support IntersectionObserver
        }
        
        const observerOptions = {
            threshold: 0.1, // Trigger when 10% of section is visible
            rootMargin: '0px 0px -50px 0px' // Trigger slightly before fully in view
        };
        
        sectionRevealObserver = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    // Add in-viewport class to trigger animation
                    entry.target.classList.add('in-viewport');
                    // Unobserve after animation is triggered (one-time animation)
                    sectionRevealObserver.unobserve(entry.target);
                }
            });
        }, observerOptions);
    }
    
    /**
     * Observe a section element for viewport entry to trigger reveal animation
     * @param {HTMLElement} sectionElement - The section element to observe
     */
    function observeSectionForReveal(sectionElement) {
        if (!sectionElement) return;
        
        // Initialize observer if not already done
        if (!sectionRevealObserver) {
            initializeSectionRevealObserver();
        }
        
        // Only observe if observer was successfully created
        if (sectionRevealObserver) {
            sectionRevealObserver.observe(sectionElement);
        }
    }

    async function initialize() {
        if (window.userHelper?.waitForLogin) {
            await window.userHelper.waitForLogin();
        }
        startCardUserDataListener();
        state.useBlurhash = localStorage.getItem(`${ApiClient.getCurrentUserId()}-blurhash`) === 'true' || false;
    }

    initialize();

    // Expose the cardBuilder to the global window object
    window.cardBuilder = cardBuilder;
    
    console.log('[KefinTweaks CardBuilder] Module loaded and available at window.cardBuilder');
})();