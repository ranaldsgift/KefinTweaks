// Thumbnail Scrubber
// YouTube-style scrubber: on card hover show a progress bar at the bottom; near the bar show timestamp and trickplay thumb above cursor.

(function() {
    'use strict';

    const LOG = (...args) => console.log('[KefinTweaks ThumbnailScrubber]', ...args);
    const WARN = (...args) => console.warn('[KefinTweaks ThumbnailScrubber]', ...args);
    const ERR = (...args) => console.error('[KefinTweaks ThumbnailScrubber]', ...args);

    const SCRUB_ZONE_HEIGHT_PX = 40;
    const SCRUB_ACTIVATION_DELAY_MS = 300;
    const PROGRESS_BAR_WIDTH_PERCENT = 95;

    // Passive hover preview defaults (can be overridden by config)
    const HOVER_PREVIEW_DEFAULT_ENABLED = false;
    const HOVER_PREVIEW_DEFAULT_TIMEOUT_MS = 800;
    const HOVER_PREVIEW_DEFAULT_FRAME_MS = 333;

    const VIDEO_TYPES = ['Movie', 'Episode'];

    /** Ticks are 100-nanosecond units; 10_000 ticks = 1 ms */
    const TICKS_PER_MS = 10_000;

    const PREVIEW_WIDTH_PERCENT = 0.25;
    const PREVIEW_WIDTH_MIN_PX = 150;
    const PREVIEW_ASPECT = 16 / 9;

    /** Trickplay data by item id */
    const trickPlayMap = new Map();

    /**
     * Single module-level state for the card currently under the cursor (event delegation).
     * { card, cardImageContainer, itemId, overlay, activationTimer, scrubberData, lastClientX, lastClientY }
     */
    let currentCardState = null;
    let rafId = null;
    let hoverPreviewRafId = null;
    let hoverPreviewIntervalId = null;

    if (!document.getElementById('kefin-scrubber-styles')) {
        const style = document.createElement('style');
        style.id = 'kefin-scrubber-styles';
        style.textContent = `
            .kefin-scrubber-overlay {
                position: absolute; inset: 0; z-index: 15;
                display: flex; flex-direction: column; justify-content: flex-end;
                pointer-events: none;
                opacity: 0; transition: opacity 0.15s ease;
            }
            .kefin-scrubber-overlay.is-visible { opacity: 1; }
            .kefin-scrubber-overlay.is-zone-active {
                pointer-events: auto;
            }
            .kefin-scrubber-progress-wrap {
                width: 100%;
                display: flex; justify-content: center;
                transition: transform 0.2s ease, padding 0.2s ease;
                position: relative;
                z-index: 20;
            }
            .kefin-scrubber-overlay.is-zone-active .kefin-scrubber-progress-wrap {
                transform: translateY(-8px);
                padding-bottom: 8px;
                pointer-events: auto;
            }
            .kefin-scrubber-progress-track {
                height: 4px; border-radius: 2px;
                background: rgba(255,255,255,0.3);
                width: 100%;
                max-width: 95%;
                overflow: hidden;
            }
            .kefin-scrubber-progress-fill {
                height: 100%; border-radius: 2px;
                background: rgba(255,255,255,0.9);
                width: 0%; transition: none;
            }
            .kefin-scrubber-preview {
                position: absolute; 
                left: 0; 
                bottom: 20px;
                padding: 0 0 6px;
                display: none; flex-direction: column; align-items: center;
                pointer-events: none;
                z-index: 10;
                transition: transform 0.2s ease;
            }
            .kefin-scrubber-overlay.is-zone-active .kefin-scrubber-preview {
                display: flex;
            }
            .kefin-scrubber-overlay.is-popover-open .kefin-scrubber-preview {
                transform: translateY(-80px);
            }
            .kefin-scrubber-popover {
                position: absolute; left: 50%; bottom: 100%;
                transform: translate(-50%, 8px);
                min-width: 160px;
                background: rgba(28,28,28,0.98);
                border: 1px solid rgba(255,255,255,0.2);
                border-radius: 6px;
                box-shadow: 0 4px 20px rgba(0,0,0,0.5);
                padding: 4px 0;
                z-index: 25;
                pointer-events: auto;
                opacity: 0;
                transition: transform 0.2s ease, opacity 0.2s ease;
            }
            .kefin-scrubber-overlay.is-popover-open .kefin-scrubber-popover {
                opacity: 1;
                transform: translate(-50%, -4px);
            }
            .kefin-scrubber-chapterThumbWrapper {
                overflow: hidden; border-radius: 4px;
                box-shadow: 0 2px 12px rgba(0,0,0,0.5);
                background: #000;
                background-repeat: no-repeat;
                border: 1px solid rgba(255, 255, 255, 0.85);
            }
            .kefin-scrubber-timestamp {
                margin-top: 4px; padding: 2px 8px;
                background: rgba(0,0,0,0.85); border-radius: 4px;
                color: #fff; font-size: 13px; font-weight: 500;
            }
            .card:has(.kefin-scrubber-overlay.is-visible.is-zone-active)  .cardOverlayButton-br {
                bottom: 30px;
            }
            .card:has(.kefin-scrubber-overlay.is-visible)  .cardOverlayButton-br {
                bottom: 10px;
            }
            .card:has(.kefin-scrubber-overlay)  .cardOverlayButton-br {
                transition: bottom 200ms ease;
            }
            .kefin-scrubber-popover-option {
                display: block;
                width: 100%;
                padding: 8px 14px;
                border: none;
                background: none;
                color: rgba(255,255,255,0.9);
                font-size: 13px;
                text-align: left;
                cursor: pointer;
            }
            .kefin-scrubber-popover-option:hover {
                background: rgba(255,255,255,0.1);
            }
            .kefin-scrubber-overlay[data-no-trickplay] {
                display: none !important;
            }

            /* Passive hover preview: dedicated clipped box so only one tile is visible */
            .cardImageContainer .kefin-hover-preview-box {
                position: absolute;
                left: 0;
                right: 0;
                top: 50%;
                transform: translateY(-50%);
                margin: 0 auto;
                overflow: hidden;
                pointer-events: none;
                z-index: 18;
            }
            .cardImageContainer .kefin-hover-preview-frame {
                width: 100%;
                height: 100%;
                background-repeat: no-repeat;
            }
        `;
        document.head.appendChild(style);
    }

    /**
     * Read thumbnail scrubber configuration from global config.
     * Returns { previewOnHover: boolean, hoverTimeoutMs: number, scrubActivationDelayMs: number, hoverPreviewFrameMs?: number }.
     */
    function getThumbnailScrubberConfig() {
        const root = (window.KefinTweaksConfig && window.KefinTweaksConfig.thumbnailScrubber) || {};
        const previewOnHover = root.PreviewOnHover === true;

        // Hover start delay (ms) - prefer HOVER_PREVIEW_TIMEOUT_MS, fall back to legacy HOVER_TIMEOUT.
        const hoverDelayRaw = root.HOVER_PREVIEW_TIMEOUT_MS != null ? root.HOVER_PREVIEW_TIMEOUT_MS : root.HOVER_TIMEOUT;
        const hoverTimeoutMs = Number.isFinite(hoverDelayRaw * 1)
            ? Math.max(0, hoverDelayRaw * 1)
            : HOVER_PREVIEW_DEFAULT_TIMEOUT_MS;

        // Scrub activation delay override (ms) - fall back to default constant.
        const scrubDelayRaw = root.SCRUB_ACTIVATION_DELAY_MS;
        const scrubActivationDelayMs = Number.isFinite(scrubDelayRaw * 1) && scrubDelayRaw >= 0
            ? scrubDelayRaw * 1
            : SCRUB_ACTIVATION_DELAY_MS;

        // Optional override for hover preview frame speed (ms between frames).
        const hoverPreviewFrameMs = Number.isFinite(root.HOVER_PREVIEW_FRAME_MS * 1) && root.HOVER_PREVIEW_FRAME_MS > 0
            ? root.HOVER_PREVIEW_FRAME_MS * 1
            : null;

        return {
            previewOnHover: previewOnHover ?? HOVER_PREVIEW_DEFAULT_ENABLED,
            hoverTimeoutMs,
            scrubActivationDelayMs,
            hoverPreviewFrameMs
        };
    }

    function isHoverPreviewEnabled() {
        try {
            return !!getThumbnailScrubberConfig().previewOnHover;
        } catch (e) {
            WARN('Error reading hover preview config', e);
            return HOVER_PREVIEW_DEFAULT_ENABLED;
        }
    }

    function getHoverPreviewTimeoutMs() {
        try {
            return getThumbnailScrubberConfig().hoverTimeoutMs || HOVER_PREVIEW_DEFAULT_TIMEOUT_MS;
        } catch (e) {
            WARN('Error reading hover timeout config', e);
            return HOVER_PREVIEW_DEFAULT_TIMEOUT_MS;
        }
    }

    function getHoverPreviewFrameIntervalMs() {
        try {
            const cfg = getThumbnailScrubberConfig();
            return cfg.hoverPreviewFrameMs || HOVER_PREVIEW_DEFAULT_FRAME_MS;
        } catch (e) {
            WARN('Error reading hover frame interval config', e);
            return null;
        }
    }

    function getScrubActivationDelayMs() {
        try {
            return getThumbnailScrubberConfig().scrubActivationDelayMs || SCRUB_ACTIVATION_DELAY_MS;
        } catch (e) {
            WARN('Error reading scrub activation delay config', e);
            return SCRUB_ACTIVATION_DELAY_MS;
        }
    }

    /**
     * Format positionTicks as running time (MM:SS or HH:MM:SS).
     * Uses Jellyfin's datetime.getDisplayRunningTime if available.
     */
    function formatRunningTime(positionTicks) {
        if (typeof datetime !== 'undefined' && typeof datetime.getDisplayRunningTime === 'function') {
            return datetime.getDisplayRunningTime(positionTicks);
        }
        const totalMs = Math.floor(positionTicks / TICKS_PER_MS);
        const totalSeconds = Math.floor(totalMs / 1000);
        const hours = Math.floor(totalSeconds / 3600);
        const minutes = Math.floor((totalSeconds % 3600) / 60);
        const seconds = totalSeconds % 60;
        if (hours > 0) {
            return `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
        }
        return `${minutes}:${String(seconds).padStart(2, '0')}`;
    }

    /**
     * Check if item is video and has runtime (we need RunTimeTicks for scrub).
     * Returns { eligible: boolean, reason?: string } for logging.
     */
    function checkEligibleCard(card) {
        let id = card.getAttribute('data-id');
        let type = card.getAttribute('data-type');

        if (!id) {
            if (card.parentElement.classList.contains('detailImageContainer')) {
                // If the card is a .detailImageContainer, we need to get the itemId from the page's Play button
                const detailPagePrimaryContainer = card.closest('.detailPagePrimaryContainer');
                if (detailPagePrimaryContainer) {
                    const playStateButton = detailPagePrimaryContainer.querySelector('.btnPlaystate');
                    if (playStateButton) {
                        id = playStateButton.getAttribute('data-id');
                        type = playStateButton.getAttribute('data-type');
                    }
                }
            }
        }
        if (!id) return { eligible: false, reason: 'no data-id' };
        const isVideoType = VIDEO_TYPES.includes(type);
        if (!isVideoType) {
            return { eligible: false, reason: `not video (type=${type})` };
        }
        return { eligible: true };
    }

    function isEligibleCard(card) {
        return checkEligibleCard(card).eligible;
    }

    /**
     * Resolve the scrubber "card" context from an element (e.target or e.relatedTarget).
     * Returns { card, cardImageContainer, itemId } if the element is inside an eligible card within
     * .itemsContainer or .detailImageContainer; otherwise null.
     */
    function resolveCardFromElement(element) {
        if (!element || !element.closest) return null;
        const card = element.closest('.card');
        if (!card) return null;
        const container = card.closest('.itemsContainer') || card.closest('.detailImageContainer');
        if (!container) return null;
        if (!isEligibleCard(card)) return null;
        const cardImageContainer = card.querySelector('.cardImageContainer');
        if (!cardImageContainer) return null;
        let itemId = card.getAttribute('data-id');
        if (!itemId && card.parentElement && card.parentElement.classList.contains('detailImageContainer')) {
            const detailPagePrimaryContainer = card.closest('.detailPagePrimaryContainer');
            if (detailPagePrimaryContainer) {
                const playStateButton = detailPagePrimaryContainer.querySelector('.btnPlaystate');
                if (playStateButton) itemId = playStateButton.getAttribute('data-id');
            }
        }
        if (!itemId) return null;
        return { card, cardImageContainer, itemId };
    }

    /**
     * Extract trickplay info object from item.Trickplay.
     * Item.Trickplay can be the info object directly, or nested e.g. Trickplay[mediaSourceId][width] = { Width, Height, Interval, ... }.
     */
    function getTrickplayInfoFromItem(item) {
        const raw = item.Trickplay;
        if (!raw || typeof raw !== 'object') return null;
        // Already a flat info object (has Width/Interval etc.)
        if (typeof raw.Width !== 'undefined' && typeof raw.Interval !== 'undefined') {
            return raw;
        }
        // Nested: first key (e.g. mediaSourceId) -> second key (e.g. width) -> info
        const firstKey = Object.keys(raw)[0];
        if (!firstKey) return null;
        const inner = raw[firstKey];
        if (!inner || typeof inner !== 'object') return null;
        if (typeof inner.Width !== 'undefined' && typeof inner.Interval !== 'undefined') {
            return inner;
        }
        const secondKey = Object.keys(inner)[0];
        if (!secondKey) return null;
        const info = inner[secondKey];
        if (info && typeof info.Width !== 'undefined' && typeof info.Interval !== 'undefined') {
            return info;
        }
        return null;
    }

    /**
     * Fetch item to get RunTimeTicks, MediaSourceId, and Trickplay.
     */
    async function fetchItem(itemId) {
        if (typeof ApiClient === 'undefined' || !ApiClient.getItem) {
            LOG('fetchItem: ApiClient unavailable');
            return null;
        }
        const userId = ApiClient.getCurrentUserId();
        if (!userId) {
            LOG('fetchItem: no userId', itemId);
            return null;
        }
        try {
            LOG('fetchItem: requesting', itemId);
            const item = await ApiClient.getItem(userId, itemId);
            LOG('fetchItem: got item', itemId, item ? (item.RunTimeTicks ? 'has RunTimeTicks' : 'no RunTimeTicks') : 'null');
            return item;
        } catch (e) {
            WARN('fetchItem failed', itemId, e);
            return null;
        }
    }

    /**
     * Get or populate scrubber data for an item. Uses only the item response (RunTimeTicks, MediaSourceId, Trickplay).
     */
    async function getScrubberData(itemId) {
        if (trickPlayMap.has(itemId)) {
            LOG('getScrubberData: cache hit', itemId);
            return trickPlayMap.get(itemId);
        }
        LOG('getScrubberData: cache miss, fetching item', itemId);
        const item = await fetchItem(itemId);
        if (!item || !item.RunTimeTicks || item.RunTimeTicks <= 0) {
            LOG('getScrubberData: no item or RunTimeTicks', itemId);
            return null;
        }
        const mediaSourceId = item.MediaSourceId || item.Id;
        const trickplayInfo = getTrickplayInfoFromItem(item);
        if (!trickplayInfo) {
            LOG('getScrubberData: no Trickplay on item', itemId);
            return null;
        }
        LOG('getScrubberData: Trickplay from item', itemId, 'mediaSourceId=', mediaSourceId, 'interval=', trickplayInfo.Interval);
        const data = {
            runTimeTicks: item.RunTimeTicks,
            trickplayInfo,
            mediaSourceId,
            item
        };
        trickPlayMap.set(itemId, data);
        LOG('getScrubberData: cached', itemId, 'runTimeTicks=', data.runTimeTicks);
        return data;
    }

    /**
     * Compute trickplay tile index and background position from positionTicks.
     * Matches Jellyfin's updateTrickplayBubbleHtml tile math.
     * When containerWidth and containerHeight are provided and > 0, returns scaled backgroundSize and position
     * so one tile exactly fills the container; otherwise returns position in source pixels (backgroundSize left to call site).
     */
    function getTrickplayStyle(apiClient, itemId, trickplayInfo, mediaSourceId, positionTicks, containerWidth, containerHeight) {
        const interval = trickplayInfo.Interval || 10000;
        const width = trickplayInfo.Width || 320;
        const height = trickplayInfo.Height || 180;
        const tileWidth = trickplayInfo.TileWidth || 10;
        const tileHeight = trickplayInfo.TileHeight || 10;

        const currentTimeMs = positionTicks / TICKS_PER_MS;
        const currentTile = Math.floor(currentTimeMs / interval);
        const tileSize = tileWidth * tileHeight;
        const index = Math.floor(currentTile / tileSize);
        const tileOffset = currentTile % tileSize;
        const tileOffsetX = tileOffset % tileWidth;
        const tileOffsetY = Math.floor(tileOffset / tileWidth);

        const imgSrc = apiClient.getUrl('Videos/' + itemId + '/Trickplay/' + width + '/' + index + '.jpg', {
            ApiKey: apiClient.accessToken(),
            MediaSourceId: mediaSourceId
        });

        const useScaled = containerWidth > 0 && containerHeight > 0;
        if (useScaled) {
            const backgroundSize = (tileWidth * containerWidth) + 'px ' + (tileHeight * containerHeight) + 'px';
            const backgroundPositionX = -(tileOffsetX * containerWidth) + 'px';
            const backgroundPositionY = -(tileOffsetY * containerHeight) + 'px';
            return {
                backgroundImage: `url('${imgSrc}')`,
                backgroundPositionX,
                backgroundPositionY,
                backgroundSize,
                width: width + 'px',
                height: height + 'px'
            };
        }

        const offsetX = -(tileOffsetX * width);
        const offsetY = -(tileOffsetY * height);
        return {
            backgroundImage: `url('${imgSrc}')`,
            backgroundPositionX: offsetX + 'px',
            backgroundPositionY: offsetY + 'px',
            width: width + 'px',
            height: height + 'px'
        };
    }

    /**
     * Estimate positionTicks from mouse X as fraction of card width and item runTimeTicks.
     */
    function positionTicksFromCard(card, clientX, runTimeTicks) {
        const rect = card.getBoundingClientRect();
        const fraction = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
        return Math.floor(fraction * runTimeTicks);
    }

    /**
     * True if pointer is in the bottom SCRUB_ZONE_HEIGHT_PX of the given element (e.g. cardImageContainer).
     * Only the area up to the element's bottom edge is considered; below that is not in zone.
     * Use cardImageContainer so the zone does not extend into card content below the image.
     */
    function isInScrubZone(containerElement, clientY) {
        if (!containerElement) return false;
        const rect = containerElement.getBoundingClientRect();
        return clientY >= rect.bottom - SCRUB_ZONE_HEIGHT_PX && clientY <= rect.bottom;
    }

    /**
     * Create or return existing scrubber overlay as a sibling of .cardOverlayContainer (so it appears above it).
     * Structure: overlay > progressWrap > progressTrack > progressFill; preview > chapterThumbWrapper + timestamp.
     */
    function getOrCreateScrubberOverlay(cardImageContainer) {
        const parent = cardImageContainer.parentNode;
        if (!parent) return null;

        let overlay = parent.querySelector('.kefin-scrubber-overlay');
        if (overlay) return overlay;

        overlay = document.createElement('div');
        overlay.className = 'kefin-scrubber-overlay';

        const progressWrap = document.createElement('div');
        progressWrap.className = 'kefin-scrubber-progress-wrap';

        const progressTrack = document.createElement('div');
        progressTrack.className = 'kefin-scrubber-progress-track';

        const progressFill = document.createElement('div');
        progressFill.className = 'kefin-scrubber-progress-fill';

        progressTrack.appendChild(progressFill);
        progressWrap.appendChild(progressTrack);
        overlay.appendChild(progressWrap);

        const popover = document.createElement('div');
        popover.className = 'kefin-scrubber-popover';
        popover.style.display = 'none';
        const optPlay = document.createElement('button');
        optPlay.type = 'button';
        optPlay.className = 'kefin-scrubber-popover-option';
        optPlay.textContent = 'Play From Here';
        const optResume = document.createElement('button');
        optResume.type = 'button';
        optResume.className = 'kefin-scrubber-popover-option';
        optResume.textContent = 'Set Resume Position';
        popover.appendChild(optPlay);
        popover.appendChild(optResume);
        progressWrap.appendChild(popover);

        overlay._progressWrap = progressWrap;
        overlay._popover = popover;

        const preview = document.createElement('div');
        preview.className = 'kefin-scrubber-preview';

        const chapterThumbWrapper = document.createElement('div');
        chapterThumbWrapper.className = 'kefin-scrubber-chapterThumbWrapper';

        const timestampEl = document.createElement('div');
        timestampEl.className = 'kefin-scrubber-timestamp';

        preview.appendChild(chapterThumbWrapper);
        preview.appendChild(timestampEl);
        overlay.appendChild(preview);

        const cardOverlayContainer = parent.querySelector('.cardOverlayContainer');
        if (cardOverlayContainer) {
            parent.insertBefore(overlay, cardOverlayContainer);
        } else {
            parent.appendChild(overlay);
        }
/*         if (!parent.style.position || parent.style.position === 'static') {
            parent.style.position = 'relative';
        } */

        overlay._progressTrack = progressTrack;
        overlay._progressFill = progressFill;
        overlay._preview = preview;
        overlay._chapterThumbWrapper = chapterThumbWrapper;
        overlay._timestampEl = timestampEl;
        return overlay;
    }

    /**
     * Position preview (thumb + timestamp) so thumb is centered above cursor but clamped to card width.
     */
    function positionPreview(previewEl, thumbWidth, cardRect, clientX) {
        const cardPadding = 10;
        const half = thumbWidth / 2;
        let left = clientX - cardRect.left - half;
        left = Math.max(cardPadding, Math.min(left, cardRect.width - thumbWidth - (cardPadding * 2)));
        previewEl.style.left = left + 'px';
        previewEl.style.right = 'auto';
        previewEl.style.width = thumbWidth + 'px';
    }

    /**
     * Update or create the innerCardFooter progress bar on the card image.
     * fraction is 0..1 of total runtime.
     */
    function updateCardResumeFooter(card, fraction) {
        if (!card) return;
        const cardImageContainer = card.querySelector('.cardImageContainer');
        if (!cardImageContainer) return;

        const clamped = Math.max(0, Math.min(1, fraction || 0));
        const widthPercent = (clamped * 100).toFixed(4) + '%';

        let footer = cardImageContainer.querySelector('.innerCardFooter');
        if (!footer) {
            footer = document.createElement('div');
            footer.className = 'innerCardFooter fullInnerCardFooter innerCardFooterClear';

            const bar = document.createElement('div');
            bar.className = 'itemProgressBar';

            const barFg = document.createElement('div');
            barFg.className = 'itemProgressBarForeground';

            bar.appendChild(barFg);
            footer.appendChild(bar);
            cardImageContainer.appendChild(footer);
        }

        const barFg = footer.querySelector('.itemProgressBarForeground');
        if (barFg) {
            barFg.style.width = widthPercent;
        }
    }

    /** Fraction 0..1 from clientX relative to the visible progress track (for time/thumb). */
    function getScrubFraction(card, clientX) {
        if (!card) return 0;
        const rect = card.getBoundingClientRect();
        const barWidth = rect.width * (PROGRESS_BAR_WIDTH_PERCENT / 100);
        const barLeft = rect.left + (rect.width - barWidth) / 2;
        return Math.max(0, Math.min(1, (clientX - barLeft) / barWidth));
    }

    /** Fill the progress bar visually up to the cursor using the track's actual rect. */
    function getProgressFillFraction(overlay, clientX) {
        if (!overlay || !overlay._progressTrack) return 0;
        const trackRect = overlay._progressTrack.getBoundingClientRect();
        if (trackRect.width <= 0) return 0;
        return Math.max(0, Math.min(1, (clientX - trackRect.left) / trackRect.width));
    }

    /**
     * Update scrubber UI (progress fill, timestamp, thumb position, trickplay image).
     * When popover is open, uses frozen _popoverClientX/_popoverClientY so position stays fixed.
     * state: { card, cardImageContainer, itemId, overlay, scrubberData }
     */
    function updateUI(state, clientX, clientY) {
        if (!state || !state.overlay) return;
        const { card, cardImageContainer, itemId, overlay, scrubberData } = state;

        if (overlay._popoverOpen && overlay._popoverClientX != null) {
            clientX = overlay._popoverClientX;
            clientY = overlay._popoverClientY;
        }

        const rect = card.getBoundingClientRect();
        const fraction = getScrubFraction(card, clientX);

        const thumbWidth = Math.max(PREVIEW_WIDTH_MIN_PX, Math.round(rect.width * PREVIEW_WIDTH_PERCENT));
        const thumbHeight = Math.round(thumbWidth / PREVIEW_ASPECT);

        overlay._chapterThumbWrapper.style.width = thumbWidth + 'px';
        overlay._chapterThumbWrapper.style.height = thumbHeight + 'px';

        const fillFraction = getProgressFillFraction(overlay, clientX);
        overlay._progressFill.style.width = (fillFraction * 100) + '%';

        const runTimeTicks = scrubberData ? scrubberData.runTimeTicks : 0;
        const positionTicks = Math.floor(fraction * runTimeTicks);

        overlay._timestampEl.textContent = runTimeTicks ? formatRunningTime(positionTicks) : '0:00';

        positionPreview(overlay._preview, thumbWidth, rect, clientX);

        if (scrubberData && typeof ApiClient !== 'undefined') {
            const cw = thumbWidth;
            const ch = thumbHeight;
            const style = getTrickplayStyle(
                ApiClient,
                itemId,
                scrubberData.trickplayInfo,
                scrubberData.mediaSourceId,
                positionTicks,
                cw,
                ch
            );
            overlay._chapterThumbWrapper.style.backgroundImage = style.backgroundImage;
            overlay._chapterThumbWrapper.style.backgroundPositionX = style.backgroundPositionX;
            overlay._chapterThumbWrapper.style.backgroundPositionY = style.backgroundPositionY;
            overlay._chapterThumbWrapper.style.backgroundSize = style.backgroundSize != null ? style.backgroundSize : 'auto';
        }
    }

    function clearActivationTimer() {
        if (currentCardState && currentCardState.activationTimer) {
            clearTimeout(currentCardState.activationTimer);
            currentCardState.activationTimer = null;
        }
    }

    function hidePopoverState() {
        if (currentCardState && currentCardState.overlay && currentCardState.overlay._popover) {
            const overlay = currentCardState.overlay;
            overlay._popover.style.display = 'none';
            overlay._popoverOpen = false;
            overlay.classList.remove('is-popover-open');
            overlay._popoverClientX = null;
            overlay._popoverClientY = null;
        }
    }

    function collapseZone() {
        if (currentCardState && currentCardState.overlay) {
            const overlay = currentCardState.overlay;
            overlay.classList.remove('is-zone-active');
            if (overlay._progressFill) overlay._progressFill.style.width = '0%';
        }
    }

    function stopHoverPreview() {
        if (!currentCardState) return;
        const state = currentCardState;
        if (state.hoverPreviewTimer) {
            clearTimeout(state.hoverPreviewTimer);
            state.hoverPreviewTimer = null;
        }
        state.hoverPreviewRunning = false;
        if (hoverPreviewRafId != null) {
            cancelAnimationFrame(hoverPreviewRafId);
            hoverPreviewRafId = null;
        }
        if (hoverPreviewIntervalId != null) {
            clearInterval(hoverPreviewIntervalId);
            hoverPreviewIntervalId = null;
        }
        if (state.cardImageContainer) {
            const box = state.cardImageContainer.querySelector('.kefin-hover-preview-box');
            if (box && box._frame) {
                box._frame.style.backgroundImage = '';
                box._frame.style.backgroundPositionX = '';
                box._frame.style.backgroundPositionY = '';
                box._frame.style.backgroundSize = '';
            }
            if (box) {
                box.style.height = '';
                box.style.width = '';
            }
        }
    }

    function teardown() {
        if (!currentCardState) return;
        clearActivationTimer();
        stopHoverPreview();
        if (currentCardState.overlay) {
            const overlay = currentCardState.overlay;
            overlay.classList.remove('is-visible', 'is-zone-active', 'is-popover-open');
            if (overlay._progressFill) overlay._progressFill.style.width = '0%';
            overlay._popoverOpen = false;
            if (overlay._popover) overlay._popover.style.display = 'none';
        }
        currentCardState = null;
        if (rafId != null) {
            cancelAnimationFrame(rafId);
            rafId = null;
        }
    }

    function startHoverPreviewLoop() {
        if (!currentCardState || !currentCardState.hoverPreviewRunning || !currentCardState.scrubberData) {
            hoverPreviewRafId = null;
            return;
        }

        const state = currentCardState;
        const data = state.scrubberData;
        const container = state.cardImageContainer;
        if (!container || typeof ApiClient === 'undefined') {
            state.hoverPreviewRunning = false;
            hoverPreviewRafId = null;
            return;
        }

        const runTimeTicks = data.runTimeTicks || 0;
        if (runTimeTicks <= 0) {
            state.hoverPreviewRunning = false;
            hoverPreviewRafId = null;
            return;
        }

        // Base trickplay interval (ms) comes from server metadata.
        const baseIntervalMs = data.trickplayInfo && data.trickplayInfo.Interval ? data.trickplayInfo.Interval : 10000;

        // Optional override from config for hover preview speed (ms between frames).
        const configuredIntervalMs = getHoverPreviewFrameIntervalMs();

        // Draw initial frame immediately at current positionTicks using original trickplay aspect ratio.
        const renderFrame = () => {
            if (!currentCardState || !currentCardState.hoverPreviewRunning || currentCardState.card !== state.card) {
                return;
            }

            const rect = container.getBoundingClientRect();
            const cw = rect.width || 0;
            // Maintain trickplay aspect ratio (16:9 by default) regardless of poster aspect.
            const ch = Math.round(cw / PREVIEW_ASPECT) || 0;

            // Create or reuse a clipped hover preview box inside the card image.
            let box = container.querySelector('.kefin-hover-preview-box');
            if (!box) {
                box = document.createElement('div');
                box.className = 'kefin-hover-preview-box';
                const frame = document.createElement('div');
                frame.className = 'kefin-hover-preview-frame';
                box.appendChild(frame);
                box._frame = frame;
                container.appendChild(box);
            }
            const frameEl = box._frame || box.firstElementChild || box;

            box.style.width = cw + 'px';
            box.style.height = ch + 'px';

            const positionTicks = state.hoverPreviewPositionTicks || 0;

            const style = getTrickplayStyle(
                ApiClient,
                state.itemId,
                data.trickplayInfo,
                data.mediaSourceId,
                positionTicks,
                cw,
                ch
            );

            frameEl.style.backgroundImage = style.backgroundImage;
            frameEl.style.backgroundPositionX = style.backgroundPositionX;
            frameEl.style.backgroundPositionY = style.backgroundPositionY;
            frameEl.style.backgroundSize = style.backgroundSize != null ? style.backgroundSize : 'auto';
        };

        // Initial draw
        renderFrame();

        // Clear any previous interval to avoid duplicates
        if (hoverPreviewIntervalId != null) {
            clearInterval(hoverPreviewIntervalId);
            hoverPreviewIntervalId = null;
        }

        // Advance exactly one tile per tick, using the base trickplay interval for distance in ticks
        // so we always land on real trickplay frame boundaries, even if the visual speed is overridden.
        hoverPreviewIntervalId = setInterval(() => {
            if (!currentCardState || !currentCardState.hoverPreviewRunning || currentCardState.card !== state.card) {
                clearInterval(hoverPreviewIntervalId);
                hoverPreviewIntervalId = null;
                return;
            }

            const advanceTicks = baseIntervalMs * TICKS_PER_MS;
            const currentTicks = (state.hoverPreviewPositionTicks || 0) + advanceTicks;
            const wrappedTicks = currentTicks % runTimeTicks;
            state.hoverPreviewPositionTicks = wrappedTicks;

            renderFrame();
        }, configuredIntervalMs);
    }

    async function ensureScrubberDataForHover(state) {
        if (!state) return;
        if (state.scrubberData) return;
        const data = await getScrubberData(state.itemId);
        if (!data) {
            if (state.overlay) {
                state.overlay.setAttribute('data-no-trickplay', 'true');
                state.overlay.classList.remove('is-visible', 'is-zone-active');
            }
            return;
        }
        state.scrubberData = data;
    }

    async function maybeStartHoverPreview() {
        if (!currentCardState || !isHoverPreviewEnabled()) return;
        const state = currentCardState;
        if (state.hoverPreviewRunning || state.hoverPreviewTimer) return;

        const timeoutMs = getHoverPreviewTimeoutMs();
        const timeout = timeoutMs < 0 ? 0 : timeoutMs;

        state.hoverPreviewTimer = setTimeout(async () => {
            state.hoverPreviewTimer = null;
            if (!currentCardState || currentCardState.card !== state.card) return;
            await ensureScrubberDataForHover(state);
            if (!currentCardState || currentCardState.card !== state.card) return;
            state.hoverPreviewRunning = true;
            state.hoverPreviewLastTs = performance.now();
            // Start from card's data-positionticks when available, otherwise from 0.
            const posAttr = state.card && state.card.getAttribute
                ? state.card.getAttribute('data-positionticks')
                : null;
            const startTicks = posAttr && !Number.isNaN(Number(posAttr))
                ? Number(posAttr)
                : 0;
            state.hoverPreviewPositionTicks = startTicks;
            state.hoverPreviewFrameAccumMs = 0;
            startHoverPreviewLoop();
        }, timeout);
    }

    function attachCard(ctx) {
        if (!ctx) return;
        const overlay = getOrCreateScrubberOverlay(ctx.cardImageContainer);
        if (overlay.hasAttribute('data-no-trickplay')) return;
        currentCardState = {
            card: ctx.card,
            cardImageContainer: ctx.cardImageContainer,
            itemId: ctx.itemId,
            overlay: overlay,
            activationTimer: null,
            scrubberData: null,
            lastClientX: 0,
            lastClientY: 0,
            hoverPreviewTimer: null,
            hoverPreviewRunning: false,
            hoverPreviewLastTs: 0,
            hoverPreviewPositionTicks: 0,
            hoverPreviewFrameAccumMs: 0
        };
        overlay.classList.add('is-visible');
        if (isHoverPreviewEnabled()) {
            maybeStartHoverPreview();
        }
    }

    function getDelegationRoot() {
        return document.getElementById('reactRoot') || document.body;
    }

    function updateUIFromRAF() {
        rafId = null;
        if (currentCardState) {
            updateUI(currentCardState, currentCardState.lastClientX, currentCardState.lastClientY);
        }
    }

    function scheduleUIUpdate() {
        if (rafId != null) return;
        rafId = requestAnimationFrame(updateUIFromRAF);
    }

    async function activateScrubberForCurrentCard() {
        if (!currentCardState) return;
        const itemId = currentCardState.itemId;
        const overlay = currentCardState.overlay;
        LOG('activateScrubber: start', itemId);
        const data = await getScrubberData(itemId);
        if (!data) {
            LOG('activateScrubber: no data, abort', itemId);
            overlay.setAttribute('data-no-trickplay', 'true');
            overlay.classList.remove('is-visible', 'is-zone-active');
            return;
        }
        overlay.classList.add('is-zone-active');
        currentCardState.scrubberData = data;
        updateUI(currentCardState, currentCardState.lastClientX, currentCardState.lastClientY);
    }

    function showPopoverState(overlay, positionTicks, mediaSourceId, clientX, clientY) {
        if (!currentCardState) return;
        overlay._popover._positionTicks = positionTicks;
        overlay._popover._itemId = currentCardState.itemId;
        overlay._popover._mediaSourceId = mediaSourceId;
        overlay._popoverClientX = clientX;
        overlay._popoverClientY = clientY;
        overlay._popover.style.display = 'block';
        overlay._popoverOpen = true;
        overlay.classList.add('is-popover-open');
    }

    function onDelegatedMouseOver(e) {
        const ctx = resolveCardFromElement(e.target);
        if (!ctx) return;
        if (currentCardState && currentCardState.card === ctx.card) return;
        teardown();
        attachCard(ctx);
    }

    function onDelegatedMouseMove(e) {
        const ctx = resolveCardFromElement(e.target);
        if (!ctx) {
            if (currentCardState) teardown();
            return;
        }
        if (currentCardState && ctx.card !== currentCardState.card) {
            teardown();
            attachCard(ctx);
        }
        if (!currentCardState) return;
        const state = currentCardState;

        // Do not activate scrubber when hovering overlay action button (play, etc.)
        if (e.target && e.target.closest && e.target.closest('.cardOverlayButton-br')) {
            clearActivationTimer();
            return;
        }

        state.lastClientX = e.clientX;
        state.lastClientY = e.clientY;
        const inZone = isInScrubZone(state.cardImageContainer, e.clientY);
        const overlay = state.overlay;

        if (inZone) {
            // When user actively scrubs, stop passive hover preview
            if (isHoverPreviewEnabled()) {
                stopHoverPreview();
            }
            if (overlay.hasAttribute('data-no-trickplay')) return;
            if (!state.activationTimer) {
                const delayMs = getScrubActivationDelayMs();
                state.activationTimer = setTimeout(() => {
                    state.activationTimer = null;
                    activateScrubberForCurrentCard();
                }, delayMs);
            }
            scheduleUIUpdate();
        } else {
            if (!overlay._popoverOpen) {
                overlay.classList.remove('is-zone-active');
                if (overlay._progressFill) overlay._progressFill.style.width = '0%';
            }
            if (!overlay._popoverOpen) clearActivationTimer();

            // Outside scrub zone but still on card - ensure hover preview timer is running
            if (isHoverPreviewEnabled() && !state.hoverPreviewRunning && !state.hoverPreviewTimer) {
                maybeStartHoverPreview();
            }
        }
    }

    function onDelegatedMouseOut(e) {
        const related = resolveCardFromElement(e.relatedTarget);
        if (related) return;
        teardown();
    }

    function onDelegatedClick(e) {
        const ctx = resolveCardFromElement(e.target);
        if (!ctx || !currentCardState || ctx.card !== currentCardState.card) return;
        const overlay = currentCardState.overlay;
        if (!overlay) return;

        if (overlay._popoverOpen && overlay._popover && !overlay._popover.contains(e.target) && currentCardState.card.contains(e.target)) {
            hidePopoverState();
            e.preventDefault();
            e.stopPropagation();
            return;
        }

        if (!overlay.classList.contains('is-zone-active')) return;
        if (overlay._popover && overlay._popover.contains(e.target)) return;
        if (!overlay.contains(e.target)) return;
        if (!isInScrubZone(currentCardState.cardImageContainer, e.clientY)) return;
        e.preventDefault();
        e.stopPropagation();

        (async () => {
            const itemId = currentCardState.itemId;
            const clickCard = currentCardState.card;
            let data = currentCardState.scrubberData;
            if (!data) {
                data = await getScrubberData(itemId);
                if (!data) {
                    overlay.setAttribute('data-no-trickplay', 'true');
                    overlay.classList.remove('is-visible', 'is-zone-active');
                    return;
                }
                currentCardState.scrubberData = data;
            }
            const fraction = getScrubFraction(currentCardState.card, e.clientX);
            const positionTicks = Math.floor(fraction * data.runTimeTicks);
            showPopoverState(overlay, positionTicks, data.mediaSourceId, e.clientX, e.clientY);

            const pop = overlay._popover;

            function playFromHere() {
                if (window.apiHelper && typeof window.apiHelper.playItem === 'function') {
                    window.apiHelper.playItem(pop._itemId, {
                        startPositionTicks: pop._positionTicks,
                        mediaSourceId: pop._mediaSourceId || undefined
                    }).catch(err => WARN('Play From Here failed', err));
                }
            }

            function setResumePosition() {
                const userId = typeof ApiClient !== 'undefined' && ApiClient.getCurrentUserId ? ApiClient.getCurrentUserId() : null;
                if (!userId || !ApiClient || !ApiClient.serverAddress) return;
                const url = `${ApiClient.serverAddress()}/Users/${userId}/Items/${pop._itemId}/UserData`;
                fetch(url, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-Emby-Token': ApiClient.accessToken()
                    },
                    body: JSON.stringify({ PlaybackPositionTicks: pop._positionTicks })
                }).then(r => {
                    if (!r.ok) throw new Error(r.statusText);
                    if (!data || !data.runTimeTicks) return;
                    const fraction = pop._positionTicks / data.runTimeTicks;
                    updateCardResumeFooter(clickCard, fraction);
                }).catch(err => WARN('Set Resume Position failed', err));
            }

            const opts = pop.querySelectorAll('.kefin-scrubber-popover-option');
            const optClick = (ev, action) => {
                ev.preventDefault();
                ev.stopPropagation();
                hidePopoverState();
                collapseZone();
                action();
            };
            opts[0].onclick = (ev) => optClick(ev, playFromHere);
            opts[1].onclick = (ev) => optClick(ev, setResumePosition);
        })();
    }

    function init() {
        const root = getDelegationRoot();
        root.addEventListener('mouseover', onDelegatedMouseOver, true);
        root.addEventListener('mousemove', onDelegatedMouseMove, true);
        root.addEventListener('mouseout', onDelegatedMouseOut, true);
        root.addEventListener('click', onDelegatedClick, true);
        LOG('Initialized (event delegation)');
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
