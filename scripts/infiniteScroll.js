// KefinTweaks Infinite Scroll
// Adds infinite scrolling to media library pages (Movies, TV, Music)
// Requires: cardBuilder.js module to be loaded before this script

(function () {    
    const RETRY_ATTEMPTS = 3;
    const RETRY_DELAY = 1000;
    
    // Common logging functions
    const LOG = (...args) => console.log('[KefinTweaks InfiniteScroll]', ...args);
    const WARN = (...args) => console.warn('[KefinTweaks InfiniteScroll]', ...args);
    const ERR = (...args) => console.error('[KefinTweaks InfiniteScroll]', ...args);
    
    LOG('Initializing...');
    
    // Supported pages (same as headerTabs)
    const SUPPORTED_PAGES = ['tv.html', 'movies.html', 'music.html', 'tv', 'movies', 'music', 'mixed'];
    
    // Media type configurations - Read from centralized config or use defaults
    const MEDIA_CONFIGS = {
        'movies.html': {
            includeItemTypes: 'Movie',
            context: 'movies',
            sortBy: 'SortName,ProductionYear'
        },
        'tv.html': {
            includeItemTypes: 'Series',
            context: 'tvshows',
            sortBy: 'SortName,ProductionYear'
        },
        'music.html': {
            includeItemTypes: 'Music',
            context: 'music',
            sortBy: 'SortName,ProductionYear'
        },
        'movies': {
            includeItemTypes: 'Movie',
            context: 'movies',
            sortBy: 'SortName,ProductionYear'
        },
        'tv': {
            includeItemTypes: 'Series',
            context: 'tvshows',
            sortBy: 'SortName,ProductionYear'
        },
        'music': {
            includeItemTypes: 'Music',
            context: 'music',
            sortBy: 'SortName,ProductionYear'
        },
        'mixed': {
            includeItemTypes: null,
            context: 'mixed',
            sortBy: 'SortName,ProductionYear'
        }
    };

    const MODERN_LIBRARY_PAGE_IDS = {
        movies: 'moviesPage',
        tv: 'tvshowsPage',
        music: 'musicPage',
        mixed: 'mixed'
    };
    
    let userId = null;
    const limit = 100;
    
    let currentPage = null;
    let currentTab = 0;
    let startIndex = 0;
    let loading = false;
    let hasMore = true;
    let totalRecordCount = null; // Track total items available from API
    let retryCount = 0;
    // scrollState removed - not needed
    let scrollTimeout = null;
    let isScrollTriggered = false; // Prevent multiple triggers
    let isRequestInProgress = false; // Blocking flag to prevent multiple simultaneous requests
    let hasInitialized = false; // Prevent multiple initializations
    let isInitializing = false; // Prevent concurrent initializations
    // # is not a normal sort prefix. Track when that bucket is finished so the next
    // page can continue at A without reusing the # offset.
    let alphaRangeKey = '';
    let hashBucketCount = null;

    // Create loading indicator element
    function createLoadingIndicator() {
        const loadingDiv = document.createElement('div');
        loadingDiv.className = 'infinite-scroll-loading';
        loadingDiv.id = 'infinite-scroll-loading-indicator';
        loadingDiv.innerHTML = `
            <div class="spinner"></div>
            <span>Loading more content...</span>
        `;
        return loadingDiv;
    }
    
    // Show loading indicator
    function showLoadingIndicator() {
        let loadingIndicator = document.getElementById('infinite-scroll-loading-indicator');
        
        if (!loadingIndicator) {
            loadingIndicator = createLoadingIndicator();
            
            // Find the container and append the loading indicator as a sibling
            const container = getContainer();
            if (container && container.parentNode) {
                container.parentNode.insertBefore(loadingIndicator, container.nextSibling);
            } else {
                // Fallback: append to body
                document.body.appendChild(loadingIndicator);
            }
        }
        
        // Show with animation
        setTimeout(() => {
            loadingIndicator.classList.add('show');
        }, 10);
        
        LOG('Loading indicator shown');
    }
    
    // Hide loading indicator
    function hideLoadingIndicator() {
        const loadingIndicator = document.getElementById('infinite-scroll-loading-indicator');
        if (loadingIndicator) {
            loadingIndicator.classList.remove('show');
            
            // Remove from DOM after animation
            setTimeout(() => {
                if (loadingIndicator.parentNode) {
                    loadingIndicator.parentNode.removeChild(loadingIndicator);
                }
            }, 300);
            
            LOG('Loading indicator hidden');
        }
    }

    const COUNT_GROUPED_NUMBER = String.raw`\d{1,3}(?:[,\s\u00A0\u202F]\d{3})*|\d+`;
    const COUNT_RANGE_PATTERN = new RegExp(
        `^(${COUNT_GROUPED_NUMBER})\\s*-\\s*(${COUNT_GROUPED_NUMBER})\\s+of\\s+(${COUNT_GROUPED_NUMBER})\\s*$`
    );

    function formatItemCount(value) {
        if (value == null || value === '?') return value == null ? '' : '?';
        const digits = String(value).replace(/[,\s\u00A0\u202F]/g, '');
        const count = Number(digits);
        if (!Number.isFinite(count)) return String(value);
        return count.toLocaleString();
    }
    const MODERN_LIBRARY_PAGE_SELECTOR = '#moviesPage, #tvshowsPage, #musicPage, #mixed';
    let pagingObserver = null;
    let pagingApplyScheduled = false;

    function isInfiniteScrollEnabled() {
        return window.KefinTweaksConfig?.scripts?.infiniteScroll !== false;
    }

    function getInfiniteScrollOptions() {
        const options = window.KefinTweaksConfig?.infiniteScroll;
        if (!options || typeof options !== 'object' || Array.isArray(options)) {
            return { hidePageControls: false, onlyShowTotalItemCount: false };
        }
        return {
            hidePageControls: options.hidePageControls === true,
            onlyShowTotalItemCount: options.onlyShowTotalItemCount === true
        };
    }

    function pageControlHideCss() {
        if (!getInfiniteScrollOptions().hidePageControls) return '';
        const modernButtons = MODERN_LIBRARY_PAGE_SELECTOR
            .split(',')
            .map((page) => `${page.trim()} button[title="Previous"], ${page.trim()} button[title="Next"]`)
            .join(',\n');
        return `
            .libraryPage:not(.hide) .paging .listPaging .btnPreviousPage,
            .libraryPage:not(.hide) .paging .listPaging .btnNextPage,
            ${modernButtons} {
                display: none !important;
            }
        `;
    }

    // Add CSS to hide paging controls when infinite scroll is active
    function addInfiniteScrollCSS() {
        if (!isInfiniteScrollEnabled()) {
            LOG('Infinite scroll disabled in configuration, skipping CSS addition');
            return;
        }

        const styleId = 'infinite-scroll-paging-hide';
        let style = document.getElementById(styleId);
        if (!style) {
            style = document.createElement('style');
            style.id = styleId;
            document.head.appendChild(style);
        }

        style.textContent = `
            ${pageControlHideCss()}

            /* Infinite scroll loading indicator */
            .infinite-scroll-loading {
                display: flex;
                flex-direction: column;
                gap: 10px;
                justify-content: center;
                align-items: center;
                padding: 20px;
                margin: 20px 0;
                border-radius: 8px;
                font-size: 14px;
                color: #666;
                opacity: 0;
                transition: opacity 0.3s ease;
            }
            
            .infinite-scroll-loading.show {
                opacity: 1;
            }
            
            .infinite-scroll-loading .spinner {
                width: 20px;
                height: 20px;
                border: 2px solid #f3f3f3;
                border-top: 2px solid #3498db;
                border-radius: 50%;
                animation: infinite-scroll-spin 1s linear infinite;
                margin-right: 10px;
            }
            
            @keyframes infinite-scroll-spin {
                0% { transform: rotate(0deg); }
                100% { transform: rotate(360deg); }
            }
        `;
        
        LOG('Added CSS to hide paging controls for infinite scroll');
    }

    function countLabelScopes() {
        const scopes = [];
        const view = getLibraryViewRoot();
        if (view) scopes.push(view);
        const libraryPage = document.querySelector('.libraryPage:not(.hide)');
        if (libraryPage && !scopes.includes(libraryPage)) scopes.push(libraryPage);
        return scopes;
    }

    function isPagingCountLabel(el) {
        if (!el) return false;
        if (el.matches('.listPaging > span')) return true;
        if (!el.classList.contains('MuiChip-label')) return false;
        return COUNT_RANGE_PATTERN.test(String(el.textContent || '').trim())
            || el.dataset.kefinTotalCount === 'true';
    }

    function forEachCountLabel(callback) {
        const seen = new Set();
        countLabelScopes().forEach((scope) => {
            scope.querySelectorAll('.listPaging > span, .MuiChip-label').forEach((el) => {
                if (seen.has(el) || !isPagingCountLabel(el)) return;
                seen.add(el);
                callback(el);
            });
        });
    }

    function totalFromLabel(el) {
        const match = String(el?.textContent || '').trim().match(COUNT_RANGE_PATTERN);
        if (match) return match[3];
        if (el?.dataset?.kefinTotalCount === 'true' && totalRecordCount != null) {
            return String(totalRecordCount);
        }
        return null;
    }

    function renderCountLabel(el, shownCount, total) {
        if (!el) return;
        if (getInfiniteScrollOptions().onlyShowTotalItemCount) {
            const raw = total == null || total === '?' ? totalFromLabel(el) : total;
            const next = raw == null || raw === '?' ? raw : formatItemCount(raw);
            if (!next) return;
            el.dataset.kefinTotalCount = 'true';
            if (el.textContent !== next) el.textContent = next;
            return;
        }
        if (shownCount == null || total == null) return;
        delete el.dataset.kefinTotalCount;
        el.textContent = `1-${formatItemCount(shownCount)} of ${formatItemCount(total)}`;
    }

    function applyTotalCountLabels() {
        if (!isInfiniteScrollEnabled() || !getInfiniteScrollOptions().onlyShowTotalItemCount) return;
        if (!getLibraryViewRoot()) return;
        forEachCountLabel((el) => {
            const total = totalFromLabel(el);
            if (!total) return;
            renderCountLabel(el, null, total);
        });
    }

    function scheduleApplyTotalCountLabels() {
        if (pagingApplyScheduled) return;
        pagingApplyScheduled = true;
        requestAnimationFrame(() => {
            pagingApplyScheduled = false;
            applyTotalCountLabels();
        });
    }

    function disconnectPagingObserver() {
        if (pagingObserver) {
            pagingObserver.disconnect();
            pagingObserver = null;
        }
    }

    function syncPagingPresentation() {
        addInfiniteScrollCSS();
        disconnectPagingObserver();
        if (!isInfiniteScrollEnabled() || !getInfiniteScrollOptions().onlyShowTotalItemCount) return;
        const root = getLibraryViewRoot() || document.querySelector('.libraryPage:not(.hide)');
        if (!root) return;
        applyTotalCountLabels();
        pagingObserver = new MutationObserver(() => {
            scheduleApplyTotalCountLabels();
        });
        pagingObserver.observe(root, { subtree: true, childList: true, characterData: true });
    }

    // Wait for ApiClient to be available
    function waitForApiClient() {
        return new Promise((resolve) => {
            if (typeof ApiClient !== 'undefined' && ApiClient._serverInfo && ApiClient._serverInfo.UserId) {
                LOG('ApiClient ready, userId:', ApiClient._serverInfo.UserId);
                resolve();
            } else {
                LOG('Waiting for ApiClient...');
                setTimeout(() => waitForApiClient().then(resolve), 100);
            }
        });
    }
    
    // Wait for cardBuilder to be available
    function waitForCardBuilder() {
        return new Promise((resolve) => {
            if (typeof window.cardBuilder !== 'undefined' && window.cardBuilder.buildCard) {
                LOG('cardBuilder ready');
                resolve();
            } else {
                LOG('Waiting for cardBuilder...');
                setTimeout(() => waitForCardBuilder().then(resolve), 100);
            }
        });
    }

    // Page detection function (same as headerTabs)
    function getCurrentPage() {
        const hash = window.location.hash;
        const hashMatches = hash.match(/#\/([^?]+)/g);
        
        if (!hashMatches || hashMatches.length === 0) {
            LOG('No hash matches found for:', hash);
            return null;
        }
        
        for (const match of hashMatches) {
            const pageFromHash = match.replace('#/', '');
            if (SUPPORTED_PAGES.includes(pageFromHash)) {
                return pageFromHash;
            }
        }
        return null;
    }
    
    // Get current tab index from URL
    function getCurrentTab() {
        const hash = window.location.hash;
        let searchParams = '';
        
        if (hash.includes('?')) {
            searchParams = hash.split('?')[1];
        } else {
            searchParams = window.location.search.substring(1);
        }
        
        const urlParams = new URLSearchParams(searchParams);
        const tabParam = urlParams.get('tab');
        return tabParam ? parseInt(tabParam, 10) : 0;
    }
    
    // State persistence functions - REMOVED
    // We don't need to store scroll state as it can cause issues with infinite scroll behavior
    
    function getParentId() {
        const match = window.location.hash.match(/topParentId=([^&]+)/);
        return match ? match[1] : null;
    }

    // Get current sort settings from Jellyfin's localStorage keys
    function getCurrentSortSettings() {
        const userId = ApiClient.getCurrentUserId();
        const parentId = getParentId();
        const page = getCurrentPage();
        
        if (!userId || !parentId || !page) {
            LOG('Missing required IDs for sort detection:', { userId, parentId, page });
            return null;
        }
        
        // Map page to media type
        const mediaTypeMap = {
            'movies.html': 'movies',
            'movies': 'movies',
            'tv.html': 'series',
            'tv': 'series'
        };
        
        const mediaType = mediaTypeMap[page];
        if (!mediaType) {
            LOG('Unsupported page for sort detection:', page);
            return null;
        }
        
        // Build localStorage keys
        const storageKey = `${userId}-${parentId}-${mediaType}`;
        const filterKey = `${userId}-${parentId}-${mediaType}-filter`;
        
        LOG('Looking for sort settings in localStorage keys:', { storageKey, filterKey });
        
        try {
            // Get main sort settings
            const sortData = JSON.parse(localStorage.getItem(storageKey) || '{}');
            const filterData = JSON.parse(localStorage.getItem(filterKey) || '{}');
            
            LOG('Found sort data:', sortData);
            LOG('Found filter data:', filterData);
            
            return {
                sortBy: sortData.SortBy || 'SortName,ProductionYear',
                sortOrder: sortData.SortOrder || 'Ascending',
                filters: filterData.Filters || '',
                years: filterData.Years || '',
                genres: filterData.Genres || '',
                tags: filterData.Tags || '',
                nameStartsWith: sortData.NameStartsWith || ''
            };
        } catch (error) {
            ERR('Error parsing sort settings from localStorage:', error);
            return null;
        }
    }

    function isModernLibraryUi() {
        return window.KefinTweaksUtils?.isModernUI?.() === true;
    }

    function getLibraryViewRoot() {
        const page = getCurrentPage();
        if (!page) return null;

        if (isModernLibraryUi()) {
            if (getCurrentTab() !== 0) return null;
            const pageId = MODERN_LIBRARY_PAGE_IDS[page];
            if (!pageId) return null;
            return document.getElementById(pageId);
        }

        const libraryPage = document.querySelector(".libraryPage:not(.hide)");
        if (!libraryPage) return null;

        if (page === 'tv.html' || page === 'tv') {
            return libraryPage.querySelector("#seriesTab.is-active");
        }
        if (page === 'movies.html' || page === 'movies') {
            return libraryPage.querySelector("#moviesTab.is-active");
        }
        return null;
    }

    function readSelectedAlphaPickerValue(root) {
        if (!root) return null;
        const selectedButton = root.querySelector(".alphaPickerButton-selected, .alphaPicker-fixed-right [aria-pressed='true']");
        if (!selectedButton) return null;
        const dataValue = selectedButton.getAttribute('data-value') || selectedButton.value;
        return dataValue ? dataValue : null;
    }

    // Selected letter from the side alpha picker. Jellyfin stores it as NameStartsWith.
    function getCurrentAlphaPicker() {
        const view = getLibraryViewRoot();
        const fromView = readSelectedAlphaPickerValue(view);
        if (fromView) {
            LOG('Found alpha picker selection:', fromView);
            return { value: fromView, sawPicker: true };
        }

        const libraryPage = document.querySelector(".libraryPage:not(.hide)");
        const fromPage = readSelectedAlphaPickerValue(libraryPage);
        if (fromPage) {
            LOG('Found alpha picker selection:', fromPage);
            return { value: fromPage, sawPicker: true };
        }

        const sawPicker = [view, libraryPage].some((scope) => scope?.querySelector(".alphaPickerButton, .alphaPickerRow"));
        return { value: null, sawPicker };
    }

    function primarySortField(sortBy) {
        return String(sortBy || '').split(',')[0].trim().toLowerCase();
    }

    function isSortNameSort(sortBy) {
        const field = primarySortField(sortBy);
        return field === 'sortname' || field === 'name';
    }

    function isDescendingSort(sortOrder) {
        return String(sortOrder || '').toLowerCase() === 'descending';
    }

    function nextAlphaLetter(letter) {
        const value = String(letter || '').trim().toUpperCase();
        if (value.length !== 1 || value < 'A' || value > 'Y') return null;
        return String.fromCharCode(value.charCodeAt(0) + 1);
    }

    function normalizeAlphaLetter(letter) {
        const value = String(letter || '').trim();
        if (value === '#') return '#';
        if (/^[a-zA-Z]$/.test(value)) return value.toUpperCase();
        return value;
    }

    /**
     * Widen a selected alpha-picker letter across the rest of a SortName list.
     * Ascending uses NameStartsWithOrGreater. Descending uses NameLessThan on the
     * next letter, and Z drops the letter filter because the descending library
     * already starts there. # stays an exact bucket until it is exhausted.
     */
    function resolveAlphaQuery(nameStartsWith, sortBy, sortOrder, displayedCount) {
        const letter = normalizeAlphaLetter(nameStartsWith);
        const identity = [letter, sortBy, sortOrder, getParentId(), getCurrentPage(), getCurrentTab()].join('|');
        if (identity !== alphaRangeKey) {
            alphaRangeKey = identity;
            hashBucketCount = null;
        }

        if (!letter || !isSortNameSort(sortBy)) {
            return letter
                ? { mode: 'exact', startIndex: displayedCount, nameStartsWith: letter }
                : { mode: 'none', startIndex: displayedCount };
        }

        const descending = isDescendingSort(sortOrder);
        if (letter === '#') {
            if (!descending && hashBucketCount != null) {
                return { mode: 'after-hash', startIndex: Math.max(0, displayedCount - hashBucketCount), nameStartsWithOrGreater: 'A' };
            }
            return { mode: descending ? 'exact' : 'hash', startIndex: displayedCount, nameStartsWith: '#' };
        }

        if (!/^[A-Z]$/.test(letter)) {
            return { mode: 'exact', startIndex: displayedCount, nameStartsWith: letter };
        }

        if (!descending) {
            return { mode: 'or-greater', startIndex: displayedCount, nameStartsWithOrGreater: letter };
        }

        const next = nextAlphaLetter(letter);
        if (!next) {
            return { mode: 'unbounded', startIndex: displayedCount };
        }
        return { mode: 'less-than', startIndex: displayedCount, nameLessThan: next };
    }

    function applyAlphaQuery(apiParams, query) {
        delete apiParams.NameStartsWith;
        delete apiParams.NameStartsWithOrGreater;
        delete apiParams.NameLessThan;
        if (query.nameStartsWith) apiParams.NameStartsWith = query.nameStartsWith;
        if (query.nameStartsWithOrGreater) apiParams.NameStartsWithOrGreater = query.nameStartsWithOrGreater;
        if (query.nameLessThan) apiParams.NameLessThan = query.nameLessThan;
        apiParams.StartIndex = query.startIndex;
    }

    // Get current start index based on existing items count
    function getCurrentStartIndex() {
        const container = getContainer();
        if (!container) return 0;
        
        const existingItemsCount = container.children.length;
        LOG('Current start index based on existing items:', existingItemsCount);
        
        return existingItemsCount;
    }

    // Update pagination display to show current range
    function updatePaginationDisplay() {
        const container = getContainer();
        if (!container) return;

        const currentItemsCount = container.children.length;
        const totalCount = totalRecordCount || '?';
        const showTotalOnly = getInfiniteScrollOptions().onlyShowTotalItemCount;

        forEachCountLabel((el) => {
            if (showTotalOnly) {
                const total = totalCount !== '?' ? totalCount : totalFromLabel(el);
                renderCountLabel(el, currentItemsCount, total);
                return;
            }
            if (el.matches('.listPaging > span')) {
                renderCountLabel(el, currentItemsCount, totalCount);
            }
        });
        LOG('Updated pagination display:', { currentItemsCount, totalCount, showTotalOnly });
    }

    function getContainer() {
        const activeTab = getLibraryViewRoot();
        if (!activeTab) return null;

        const container = activeTab.querySelector(".itemsContainer");
        if (!container) return null;

        return container;
    }

    /**
     * Infer card format from existing cards in the items container.
     * @param {Element} container
     * @returns {string|null} 'backdrop'|'square'|'banner'|'portrait'|null
     */
    function inferCardFormatFromContainer(container) {
        if (!container) return null;
        const existing = container.querySelector('.card');
        if (!existing) return null;

        if (existing.classList.contains('backdropCard') || existing.classList.contains('overflowBackdropCard')) {
            return 'backdrop';
        }
        if (existing.classList.contains('squareCard') || existing.classList.contains('overflowSquareCard')) {
            return 'square';
        }
        if (existing.classList.contains('bannerCard') || existing.classList.contains('overflowBannerCard')) {
            return 'banner';
        }
        if (existing.classList.contains('portraitCard') || existing.classList.contains('overflowPortraitCard')) {
            return 'portrait';
        }
        return null;
    }

    async function loadMore() {
        LOG('LoadMore called:', { loading, hasMore, isRequestInProgress, isScrollTriggered });
        
        if (loading || !hasMore || isRequestInProgress) {
            LOG('LoadMore blocked:', { loading, hasMore, isRequestInProgress });
            return;
        }
        
        const container = getContainer();
        if (!container) {
            LOG('LoadMore blocked: no eligible items container');
            return;
        }
        if (container.children.length === 0) {
            LOG('LoadMore blocked: No items in container yet (page still loading)');
            return;
        }
        
        LOG('Starting loadMore request...');
        loading = true;
        isRequestInProgress = true;
        
        // Show loading indicator
        showLoadingIndicator();

        // Wait for ApiClient to be ready
        if (!userId) {
            LOG('Waiting for ApiClient before loading...');
            await waitForApiClient();
        }
        
        // Wait for cardBuilder to be ready
        await waitForCardBuilder();

        const page = getCurrentPage();
        const tab = getCurrentTab();
        
        if (!page) {
            WARN("No supported page detected");
            loading = false;
            isRequestInProgress = false;
            hideLoadingIndicator();
            return;
        }

        const parentId = getParentId();
        if (!parentId) {
            WARN("No topParentId found in URL");
            loading = false;
            isRequestInProgress = false;
            hideLoadingIndicator();
            return;
        }

        const mediaConfig = MEDIA_CONFIGS[page];
        if (!mediaConfig) {
            WARN("No media configuration found for page:", page);
            loading = false;
            isRequestInProgress = false;
            hideLoadingIndicator();
            return;
        }

        // Double-check ApiClient is available
        if (typeof ApiClient === 'undefined') {
            ERR('ApiClient is not available');
            loading = false;
            isRequestInProgress = false;
            hideLoadingIndicator();
            return;
        }

        // Get current start index based on existing items
        startIndex = getCurrentStartIndex();
        
        // Get current sort settings from localStorage
        const sortSettings = getCurrentSortSettings();
        let apiParams = {
            SortBy: mediaConfig.sortBy, // fallback
            SortOrder: "Ascending", // fallback
            Recursive: true,
            Fields: "PrimaryImageAspectRatio,MediaSourceCount",
            ImageTypeLimit: 1,
            EnableImageTypes: "Primary,Backdrop,Banner,Thumb",
            ParentId: parentId,
            StartIndex: startIndex,
            Limit: limit
        };
        if (mediaConfig.includeItemTypes) {
            apiParams.IncludeItemTypes = mediaConfig.includeItemTypes;
        }

        // Apply detected sort settings if available
        if (sortSettings) {
            LOG('Using detected sort settings:', sortSettings);
            apiParams.SortBy = sortSettings.sortBy;
            apiParams.SortOrder = sortSettings.sortOrder;
            
            // Add filter parameters if they exist
            if (sortSettings.filters) {
                apiParams.Filters = sortSettings.filters;
            }
            if (sortSettings.years) {
                apiParams.Years = sortSettings.years;
            }
            if (sortSettings.genres) {
                apiParams.Genres = sortSettings.genres;
            }
            if (sortSettings.tags) {
                apiParams.Tags = sortSettings.tags;
            }
        } else {
            LOG('Using fallback sort settings');
        }

        // Widen the selected letter across the rest of a SortName list.
        const alphaPicker = getCurrentAlphaPicker();
        const nameStartsWith = alphaPicker.value
            || (!alphaPicker.sawPicker && sortSettings?.nameStartsWith)
            || '';
        let alphaQuery = resolveAlphaQuery(nameStartsWith, apiParams.SortBy, apiParams.SortOrder, startIndex);
        applyAlphaQuery(apiParams, alphaQuery);
        LOG('Alpha query:', alphaQuery);

        try {
            let fetchAnotherRange = true;
            while (fetchAnotherRange) {
                fetchAnotherRange = false;
                const url = ApiClient.getUrl("Users/" + ApiClient.getCurrentUserId() + "/Items", apiParams);
                LOG('Loading more items:', { page, tab, startIndex: alphaQuery.startIndex, limit, url, mode: alphaQuery.mode });

                const result = await ApiClient.getJSON(url);
                const items = result.Items || [];
                const queryOffset = alphaQuery.startIndex + items.length;

                if (items.length > 0) {
                    const container = getContainer();
                    if (container) {
                        if (typeof window.cardBuilder === 'undefined' || !window.cardBuilder.buildCard) {
                            ERR('cardBuilder not available or buildCard method missing');
                            loading = false;
                            isRequestInProgress = false;
                            hideLoadingIndicator();
                            return;
                        }

                        LOG('Building cards:', {
                            itemCount: items.length,
                            context: mediaConfig.context,
                            container: container
                        });

                        const cardFormat = inferCardFormatFromContainer(container);
                        const indexBase = container.children.length;
                        LOG('Inferred card format from container:', cardFormat);
                        items.forEach((item, index) => {
                            const card = window.cardBuilder.buildCard(item, false, cardFormat);
                            card.setAttribute('data-index', indexBase + index);
                            container.appendChild(card);
                        });
                        if (typeof window.cardBuilder.registerLazyImagesIn === 'function') {
                            window.cardBuilder.registerLazyImagesIn(container);
                        }

                        LOG('Cards built successfully');
                    }
                }

                // # is its own bucket. Once it is exhausted, continue at A in this same load.
                if (alphaQuery.mode === 'hash') {
                    const hashDone = items.length === 0
                        || (result.TotalRecordCount != null && queryOffset >= result.TotalRecordCount);
                    if (hashDone) {
                        hashBucketCount = queryOffset;
                        alphaQuery = { mode: 'after-hash', startIndex: 0, nameStartsWithOrGreater: 'A' };
                        applyAlphaQuery(apiParams, alphaQuery);
                        fetchAnotherRange = true;
                        LOG('Hash bucket exhausted, continuing from A');
                        continue;
                    }
                }

                if (result.TotalRecordCount !== undefined) {
                    if (alphaQuery.mode === 'after-hash' && hashBucketCount != null) {
                        totalRecordCount = hashBucketCount + result.TotalRecordCount;
                        hasMore = queryOffset < result.TotalRecordCount;
                    } else {
                        totalRecordCount = result.TotalRecordCount;
                        hasMore = queryOffset < totalRecordCount;
                    }
                    LOG('hasMore updated based on total count:', {
                        queryOffset,
                        totalRecordCount,
                        hasMore,
                        mode: alphaQuery.mode
                    });
                } else {
                    totalRecordCount = null;
                    hasMore = items.length >= limit;
                    LOG('hasMore updated using fallback logic:', {
                        itemsLength: items.length,
                        limit,
                        hasMore
                    });
                }

                if (!items.length) {
                    hasMore = false;
                    LOG('No more items to load (empty result)');
                }

                startIndex = queryOffset;
                updatePaginationDisplay();
                LOG('Loaded items successfully:', {
                    loaded: items.length,
                    startIndex,
                    totalRecordCount,
                    hasMore,
                    mode: alphaQuery.mode
                });
            }

            retryCount = 0;
            
        } catch (err) {
            ERR("Infinite scroll load error", err);
            
            // Retry logic
            if (retryCount < RETRY_ATTEMPTS) {
                retryCount++;
                WARN(`Retrying loadMore (attempt ${retryCount}/${RETRY_ATTEMPTS})`);
                setTimeout(() => {
                    loading = false;
                    isRequestInProgress = false;
                    loadMore();
                }, RETRY_DELAY * retryCount);
                return;
            } else {
                ERR("Max retry attempts reached, giving up");
                hasMore = false;
            }
        } finally {
            loading = false;
            isRequestInProgress = false;
            
            // Hide loading indicator
            hideLoadingIndicator();
        }
    }

    function setupScrollWatcher() {
        // Remove any existing scroll listener
        window.removeEventListener("scroll", handleScroll);
        
        // Add throttled scroll listener
        window.addEventListener("scroll", handleScroll);
        LOG('Scroll watcher setup complete');
    }
    
    function handleScroll() {
        // Throttle scroll events - only check every 100ms
        if (scrollTimeout) {
            clearTimeout(scrollTimeout);
        }
        
        scrollTimeout = setTimeout(() => {
            checkScrollPosition();
        }, 100);
    }
    
    function checkScrollPosition() {
        // Don't trigger if already loading, no more items, or request in progress
        if (loading || !hasMore || isScrollTriggered || isRequestInProgress) {
            return;
        }
        
        // Don't trigger when not on a supported page
        const container = getContainer();
        if (!container) {
            return;
        }
        
        // Don't trigger if there are no items in the container (page still loading)
        const existingItemsCount = container.children.length;
        if (existingItemsCount === 0) {
            LOG('Scroll check blocked: No items in container yet (page still loading)');
            return;
        }

        const scrollTop = window.scrollY || document.documentElement.scrollTop;
        const windowHeight = window.innerHeight;
        const documentHeight = document.documentElement.scrollHeight;
        
        // Calculate distance from bottom - trigger when one viewport height away
        const distanceFromBottom = documentHeight - (scrollTop + windowHeight);
        const triggerThreshold = windowHeight; // One viewport height from bottom
        
        if (distanceFromBottom <= triggerThreshold) {
            isScrollTriggered = true;
            LOG('Triggering loadMore from scroll (one viewport height from bottom)');
            loadMore().finally(() => {
                // Reset trigger flag after load completes
                setTimeout(() => {
                    isScrollTriggered = false;
                    LOG('Scroll trigger flag reset');
                }, 1000); // Wait 1 second before allowing next trigger
            });
        }
    }

    // Reset state when navigating to a new library or tab
    function reset() {
        const page = getCurrentPage();
        const tab = getCurrentTab();
        
        LOG('Resetting infinite scroll state:', { page, tab });
        
        // startIndex will be calculated dynamically based on existing items
        hasMore = true;
        totalRecordCount = null;
        alphaRangeKey = '';
        hashBucketCount = null;
        loading = false;
        retryCount = 0;
        isScrollTriggered = false;
        isRequestInProgress = false;
        
        // Scroll state restoration removed - not needed
        
        // Clear container if switching pages/tabs
        if (currentPage !== page || currentTab !== tab) {
            const container = getContainer();
            if (container) {
                //container.innerHTML = '';
                LOG('[REMOVED] Cleared container for new page/tab');
            }
            hasInitialized = false; // Reset initialization flag for new page/tab
            isInitializing = false; // Reset initializing flag for new page/tab
        }
        
        currentPage = page;
        currentTab = tab;
    }

    // Check if we should initialize infinite scroll
    function shouldInitialize() {
        if (hasInitialized) return false;

        const page = getCurrentPage();
        const container = getContainer();
        
        if (!page) {
            return false;
        }
        
        if (!container) {
            LOG('No active tab container found, waiting...');
            return false;
        }
        
        if (page === 'tv.html' || page === 'tv' || page === 'movies.html' || page === 'movies') {
            return true;
        }
        if (isModernLibraryUi() && (page === 'music' || page === 'mixed')) {
            return true;
        }

        return false;
    }
    
    // Initialize infinite scroll
    async function initialize() {
        if (hasInitialized || isInitializing) {
            return;
        }
        
        LOG('Initializing infinite scroll');
        isInitializing = true;
        hasInitialized = true;
        
        try {
            // Add CSS to hide paging controls
            addInfiniteScrollCSS();
            
            // Wait for ApiClient to be ready
            if (!userId) {
                LOG('Waiting for ApiClient before initialization...');
                await waitForApiClient();
            }
            
            // Wait for cardBuilder to be ready
            await waitForCardBuilder();
            
            reset();
            //loadMore(); // load first page
            setupScrollWatcher();
            syncPagingPresentation();
        } finally {
            isInitializing = false;
        }
    }
    
    // Scroll state loading removed - not needed

    function tryInitializeFromView() {
        if (shouldInitialize()) {
            initialize().catch(err => ERR('Initialization failed:', err));
            return true;
        }
        return false;
    }

    function armLibraryPageInit() {
        if (isInfiniteScrollEnabled()) syncPagingPresentation();
        if (tryInitializeFromView()) return;
        const utils = window.KefinTweaksUtils;
        if (utils?.pollUntil) {
            utils.pollUntil(() => (tryInitializeFromView() ? true : null), {
                intervalMs: 200,
                timeoutMs: 15000
            });
            return;
        }
        // Fallback brief poll
        let tries = 0;
        const timer = setInterval(() => {
            tries += 1;
            if (tryInitializeFromView() || tries >= 75) clearInterval(timer);
        }, 200);
    }

    function startInfiniteScrollHook() {
        const utils = window.KefinTweaksUtils;
        if (!utils?.onViewPage) {
            setTimeout(startInfiniteScrollHook, 500);
            return;
        }
        utils.onViewPage(() => {
            armLibraryPageInit();
        }, { pages: SUPPORTED_PAGES });
        armLibraryPageInit();
    }

    startInfiniteScrollHook();
    
    // Cleanup function
    function cleanup() {
        window.removeEventListener("scroll", handleScroll);
        disconnectPagingObserver();
        if (scrollTimeout) {
            clearTimeout(scrollTimeout);
        }
        
        // Remove the CSS that hides paging controls
        const styleElement = document.getElementById('infinite-scroll-paging-hide');
        if (styleElement) {
            styleElement.remove();
            LOG('Removed CSS for paging controls');
        }
        
        // Hide and remove loading indicator
        hideLoadingIndicator();
        
        LOG('Infinite scroll cleanup complete');
    }
    
    // Cleanup on page unload
    window.addEventListener('beforeunload', cleanup);
    
    LOG('Initialized successfully');
})();
