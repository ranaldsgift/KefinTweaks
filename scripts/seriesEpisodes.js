// KefinTweaks Series Episodes
// Displays episodes directly on series page with season selection
// Requires: cardBuilder.js, utils.js modules to be loaded before this script

(function() {
    'use strict';

    const LOG = (...args) => console.log('[KefinTweaks SeriesEpisodes]', ...args);
    const WARN = (...args) => console.warn('[KefinTweaks SeriesEpisodes]', ...args);
    const ERR = (...args) => console.error('[KefinTweaks SeriesEpisodes]', ...args);

    const EPISODES_CACHE_TTL = 60000;

    const episodeHookStateByHost = new WeakMap();

    function getEpisodesMount(host) {
        return host?.querySelector('.series-episodes-mount');
    }

    function setEpisodeHookState(host, state) {
        if (host) episodeHookStateByHost.set(host, state);
    }

    function getEpisodeHookState(host) {
        return host ? episodeHookStateByHost.get(host) : null;
    }

    function findTargetEpisodeCard(scrollerContainer, targetEpisodeNumber) {
        if (!scrollerContainer || !targetEpisodeNumber) return null;

        const itemsContainer = scrollerContainer.querySelector('.itemsContainer');
        if (!itemsContainer) return null;

        if (targetEpisodeNumber.id) {
            const byId = itemsContainer.querySelector(`.card[data-id="${targetEpisodeNumber.id}"]`);
            if (byId && !byId.hasAttribute('data-skeleton') && !byId.classList.contains('skeleton-card')) {
                return byId;
            }
        }

        for (const card of itemsContainer.querySelectorAll('.card')) {
            if (card.hasAttribute('data-skeleton') || card.classList.contains('skeleton-card')) {
                continue;
            }
            for (const link of card.querySelectorAll('.cardText a')) {
                const linkText = link.innerText || link.textContent;
                const match = linkText.match(/S(\d+):E(\d+)/);
                if (match
                    && parseInt(match[1], 10) === targetEpisodeNumber.season
                    && parseInt(match[2], 10) === targetEpisodeNumber.episode) {
                    return card;
                }
            }
        }

        return null;
    }

    function seasonId(season) {
        return season?.Id ?? season?.id;
    }

    function seasonName(season) {
        return season?.Name ?? season?.name;
    }

    function seasonIndex(season) {
        return season?.IndexNumber ?? season?.indexNumber;
    }

    function buildEpisodesQueryDef(seriesId, seasonIdValue) {
        return {
            path: `/Shows/${seriesId}/Episodes`,
            queryOptions: {
                SeasonId: seasonIdValue,
                SortBy: 'IndexNumber',
                SortOrder: 'Ascending',
                Fields: 'UserData,MediaSourceCount,PrimaryImageAspectRatio',
                ImageTypeLimit: 1,
                EnableTotalRecordCount: false
            }
        };
    }

    function postProcessEpisodes(data) {
        const items = Array.isArray(data)
            ? data.slice()
            : (Array.isArray(data?.Items) ? data.Items.slice() : []);
        return items.sort((a, b) => (a.IndexNumber || 0) - (b.IndexNumber || 0));
    }

    function formatSeasonName(seasonNameValue, seasonNumber) {
        if (!seasonNameValue) {
            return `Season ${seasonNumber}`;
        }
        return seasonNameValue;
    }

    function buildSeasonViewMoreUrl(season) {
        const apiClient = window.ApiClient;
        const serverId = apiClient.serverId();
        const sid = seasonId(season);
        return `/web/#/details?id=${sid}&serverId=${serverId}`;
    }

    async function buildSeriesEpisodesSection(seriesId, seasons, initialSeason, onMultiQueryChange) {
        const apiHelper = window.apiHelper;
        if (!apiHelper?.getQuery || !apiHelper?.buildQueryFromSection) {
            throw new Error('apiHelper.getQuery / buildQueryFromSection unavailable');
        }

        const initialIndex = Math.max(0, seasons.findIndex((season) => seasonId(season) === seasonId(initialSeason)));
        const hasMultiple = seasons.length > 1;
        const queries = seasons.map((season) => {
            const sid = seasonId(season);
            return {
                name: formatSeasonName(seasonName(season), seasonIndex(season)),
                viewMoreUrl: buildSeasonViewMoreUrl(season),
                ...buildEpisodesQueryDef(seriesId, sid)
            };
        });

        const initialSeasonObj = seasons[initialIndex];
        const sectionConfig = {
            id: `series-episodes-${seriesId}`,
            type: 'series-episodes',
            name: formatSeasonName(seasonName(initialSeasonObj), seasonIndex(initialSeasonObj)),
            enabled: true,
            order: 0,
            viewMoreUrl: buildSeasonViewMoreUrl(initialSeasonObj),
            cardFormat: 'Thumb',
            overflowCard: true,
            ttl: EPISODES_CACHE_TTL,
            userConfigurable: false,
            queries,
            _selectedQueryIndex: initialIndex
        };

        try {
            const storedLayout = await window.KefinUserHomeScreenConfig?.loadSectionItemsLayout?.(
                sectionConfig.id,
                { type: sectionConfig.type }
            );
            if (storedLayout === 'grid' || storedLayout === 'row') {
                sectionConfig.itemsLayout = storedLayout;
            }
        } catch (e) {
            WARN('Failed to restore series-episodes itemsLayout from sectionState', e);
        }

        if (hasMultiple) {
            sectionConfig.useMultiQueryPicker = true;
            sectionConfig.useQueryNamesForSection = true;
            sectionConfig.multiQueryPickerLabel = 'Select Season';
        }

        if (typeof onMultiQueryChange === 'function') {
            sectionConfig._onMultiQueryChange = onMultiQueryChange;
        }

        const initialQuery = queries[initialIndex];
        const userId = ApiClient.getCurrentUserId();
        const serverUrl = ApiClient.serverAddress();
        const url = apiHelper.buildQueryFromSection(initialQuery, userId, serverUrl);
        if (typeof url !== 'string') {
            throw new Error(`Invalid episodes query URL for season ${seasonId(initialSeasonObj)}`);
        }

        const queryResult = await apiHelper.getQuery(url, {
            useCache: true,
            ttl: EPISODES_CACHE_TTL
        });

        let mappedDataPromise = null;
        const ensureData = () => {
            if (!mappedDataPromise) {
                const raw = typeof queryResult.ensureData === 'function'
                    ? queryResult.ensureData()
                    : queryResult.dataPromise;
                mappedDataPromise = Promise.resolve(raw)
                    .then((data) => postProcessEpisodes(data))
                    .catch((err) => {
                        WARN('episodes ensureData failed for season', seasonId(initialSeasonObj), err);
                        return [];
                    });
            }
            return mappedDataPromise;
        };

        const result = {
            data: postProcessEpisodes(queryResult.data),
            isStale: queryResult.isStale === true,
            isStalePromise: queryResult.isStalePromise,
            ensureData
        };
        Object.defineProperty(result, 'dataPromise', {
            configurable: true,
            enumerable: true,
            get() {
                return ensureData();
            }
        });

        return { config: sectionConfig, result };
    }

    function getSectionTitleContainer(host) {
        return host?.querySelector('.series-episodes-section .sectionTitleContainer')
            || host?.querySelector('.sectionTitleContainer');
    }

    async function renderEpisodesProgressive(seriesId, seasons, initialSeason, host, onMultiQueryChange, configureSection) {
        if (!window.cardBuilder?.renderProgressiveSections) {
            WARN('cardBuilder.renderProgressiveSections unavailable');
            return null;
        }

        const mount = getEpisodesMount(host);
        if (!mount) {
            WARN('Episodes mount not found in host');
            return null;
        }

        const section = await buildSeriesEpisodesSection(seriesId, seasons, initialSeason, onMultiQueryChange);
        if (typeof configureSection === 'function') {
            configureSection(section.config);
        }
        const stagingMount = document.createElement('div');
        await window.cardBuilder.renderProgressiveSections(
            stagingMount,
            [Promise.resolve(section)],
            { showStaleDataBeforeRefresh: true }
        );

        const seasonSection = stagingMount.querySelector('.emby-scroller-container') || stagingMount.firstElementChild;
        if (!seasonSection) {
            WARN('Progressive episodes section did not render');
            return null;
        }

        seasonSection.classList.add('series-episodes-section');
        const scrollerContainer = seasonSection.querySelector('.emby-scroller');
        if (scrollerContainer) {
            scrollerContainer.classList.add('no-padding');
        }
        const sectionTitleContainer = seasonSection.querySelector('.sectionTitleContainer');
        if (sectionTitleContainer) {
            sectionTitleContainer.classList.add('no-padding');
        }

        mount.innerHTML = '';
        mount.appendChild(seasonSection);

        return { sectionEl: seasonSection, section };
    }

    function applyEpisodeScrollAndBadge(host, sectionEl, targetEpisodeNumber, activeSeasonIndex, nextUpHeaderText) {
        const scrollerContainer = sectionEl?.querySelector('.emby-scroller')
            || host?.querySelector('.series-episodes-section .emby-scroller');
        if (!scrollerContainer) return;

        if (targetEpisodeNumber && activeSeasonIndex !== undefined
            && targetEpisodeNumber.season === activeSeasonIndex) {
            ensureNextUpEpisodeStyle(nextUpHeaderText);
            updateNextUpItem(targetEpisodeNumber, scrollerContainer);
            return;
        }

        window.cardBuilder.setScrollerPosition(scrollerContainer, 0, false);
        LOG('Scrolled to beginning of season (not NextUp season)');
    }

    function ensureNextUpEpisodeStyle(nextUpHeaderText) {
        if (document.getElementById('kefinTweaks-nextUpEpisode-style')) {
            return;
        }
        const style = document.createElement('style');
        style.id = 'kefinTweaks-nextUpEpisode-style';
        const escapedHeaderText = (nextUpHeaderText || 'Next Up').replace(/'/g, "\\'").replace(/"/g, '\\"');
        style.textContent = `
            .nextUpEpisode:not(.nextUpEpisode ~ .nextUpEpisode) .cardScalable::after {
                content: '${escapedHeaderText}';
                position: absolute;
                transform: translateY(0);
                top: 0.5em;
                left: 0.5em;
                padding: 0.25em 0.5em;
                text-align: center;
                background: rgb(0 0 0 / 85%);
                font-size: 1.1em;
                border: 1px solid rgb(255 255 255 / 40%);
                border-radius: 5px;
                pointer-events: none;
            }
        `;
        document.head.appendChild(style);
        LOG('Added nextUpEpisode CSS with header text:', nextUpHeaderText);
    }

    function insertEpisodesHost(activePage) {
        const nextUpSection = activePage.querySelector('.nextUpSection');
        const detailPageContent = activePage.querySelector('.detailPageContent');

        let host = activePage.querySelector('.series-episodes-section');
        if (host) {
            if (!getEpisodesMount(host)) {
                const mount = document.createElement('div');
                mount.className = 'series-episodes-mount';
                while (host.firstChild) {
                    mount.appendChild(host.firstChild);
                }
                host.appendChild(mount);
            }
            return host;
        }

        host = document.createElement('div');
        host.className = 'series-episodes-section';

        const mount = document.createElement('div');
        mount.className = 'series-episodes-mount';

        host.appendChild(mount);

        if (nextUpSection && nextUpSection.parentNode) {
            nextUpSection.parentNode.insertBefore(host, nextUpSection.nextSibling);
        } else if (detailPageContent) {
            const childrenCollapsible = activePage.querySelector('.detailSection #listChildrenCollapsible')
                || activePage.querySelector('#childrenCollapsible');
            if (childrenCollapsible && childrenCollapsible.parentNode) {
                childrenCollapsible.parentNode.insertBefore(host, childrenCollapsible);
            } else {
                detailPageContent.insertBefore(host, detailPageContent.firstChild);
            }
        }

        return host;
    }

    /**
     * Fetches the Next Up episode for a given series
     * @param {string} seriesId - The series ID
     * @returns {Promise<Object|null>} - Episode number object with season and episode, or null
     */
    async function fetchNextUpEpisode(seriesId) {
        try {
            const apiClient = window.ApiClient;
            const userId = apiClient.getCurrentUserId();
            const serverUrl = apiClient.serverAddress();
            LOG(`Fetching Next Up episode for series: ${seriesId}`);
            const nextUpUrl = `${serverUrl}/Shows/NextUp?SeriesId=${seriesId}&UserId=${userId}&Fields=MediaSourceCount`;
            const nextUpRes = await fetch(nextUpUrl, { 
                headers: { "Authorization": window.apiHelper.getAuthHeader() } 
            });
            
            if (!nextUpRes.ok) {
                throw new Error(`HTTP ${nextUpRes.status}: ${nextUpRes.statusText}`);
            }
            
            const nextUpData = await nextUpRes.json();
            const items = nextUpData.Items || [];
            
            if (items.length > 0) {
                const item = items[0];
                LOG(`Fetched Next Up episode from API: ${item.Name} (S${item.ParentIndexNumber}:E${item.IndexNumber})`);
                return item;
            }
            
            LOG('No Next Up episode found in API response');
            return null;
        } catch (error) {
            ERR(`Failed to fetch Next Up episode for series ${seriesId}:`, error);
            return null;
        }
    }

    /**
     * Fetches season data by season ID
     * @param {string} seasonId - The season ID
     * @returns {Promise<Object|null>} - Season item or null
     */
    async function fetchSeasonData(seasonId) {
        try {
            const apiClient = window.ApiClient;
            const userId = apiClient.getCurrentUserId();
            const serverUrl = apiClient.serverAddress();
            LOG(`Fetching season data for season ID: ${seasonId}`);
            const seasonUrl = `${serverUrl}/Items/${seasonId}?UserId=${userId}`;
            const seasonRes = await fetch(seasonUrl, { 
                headers: { "Authorization": window.apiHelper.getAuthHeader() } 
            });
            
            if (!seasonRes.ok) {
                throw new Error(`HTTP ${seasonRes.status}: ${seasonRes.statusText}`);
            }
            
            const seasonData = await seasonRes.json();
            LOG(`Fetched season data: IndexNumber=${seasonData.IndexNumber}`);
            return seasonData;
        } catch (error) {
            ERR(`Failed to fetch season data for ${seasonId}:`, error);
            return null;
        }
    }

    /**
     * Extracts season data from the rendered DOM
     * @param {HTMLElement} activePage - The active page element
     * @returns {Array} - Array of season objects with { id, name, indexNumber }
     */
    function extractSeasonsFromDOM(activePage) {
        const seasons = [];
        
        // Check for 10.11+ seasons section first (.detailSection #listChildrenCollapsible)
        let childrenCollapsible = activePage.querySelector('.detailSection #listChildrenCollapsible');
        
        // Fallback to 10.10 seasons section (#childrenCollapsible)
        if (!childrenCollapsible) {
            childrenCollapsible = activePage.querySelector('#childrenCollapsible');
        }
        
        if (!childrenCollapsible) {
            WARN('Could not find childrenCollapsible element');
            return seasons;
        }
        
        const itemsContainer = childrenCollapsible.querySelector('.itemsContainer');
        if (!itemsContainer) {
            WARN('Could not find itemsContainer in childrenCollapsible');
            return seasons;
        }
        
        // Get all .card immediate children
        const seasonCards = itemsContainer.querySelectorAll(':scope > .card');
        
        seasonCards.forEach(card => {
            const seasonId = card.getAttribute('data-id');
            if (!seasonId) {
                return;
            }
            
            // Get season name from .cardText a link
            const cardTextLink = card.querySelector('.cardText a');
            const seasonName = cardTextLink ? (cardTextLink.innerText || cardTextLink.textContent).trim() : null;
            
            // Try to extract index number from season name or data attributes
            let indexNumber = null;
            
            // Try to parse from season name (e.g., "Season 1", "S1", etc.)
            if (seasonName) {
                const seasonMatch = seasonName.match(/Season\s+(\d+)/i) || seasonName.match(/S(\d+)/i);
                if (seasonMatch) {
                    indexNumber = parseInt(seasonMatch[1], 10);
                }
            }
            
            // If we couldn't parse from name, try data-index or other attributes
            if (indexNumber === null) {
                const dataIndex = card.getAttribute('data-index');
                if (dataIndex) {
                    indexNumber = parseInt(dataIndex, 10);
                }
            }
            
            if (seasonId) {
                seasons.push({
                    id: seasonId,
                    name: seasonName || `Season ${indexNumber || 'Unknown'}`,
                    indexNumber: indexNumber
                });
            }
        });
        
        // Sort by index number
        seasons.sort((a, b) => {
            const aIndex = a.indexNumber !== null ? a.indexNumber : 999;
            const bIndex = b.indexNumber !== null ? b.indexNumber : 999;
            return aIndex - bIndex;
        });
        
        LOG(`Extracted ${seasons.length} seasons from DOM:`, seasons);
        return seasons;
    }

    function scrollToEpisode(scrollerContainer, targetEpisodeNumber) {
        if (!scrollerContainer || !targetEpisodeNumber) return;

        const doScroll = () => {
            let targetCard = findTargetEpisodeCard(scrollerContainer, targetEpisodeNumber);

            if (!targetCard) {
                requestAnimationFrame(() => {
                    targetCard = findTargetEpisodeCard(scrollerContainer, targetEpisodeNumber);
                    if (targetCard) {
                        performEpisodeScroll(scrollerContainer, targetCard, targetEpisodeNumber);
                    } else {
                        WARN(`Could not find target episode card S${targetEpisodeNumber.season}:E${targetEpisodeNumber.episode}`);
                    }
                });
                return;
            }

            performEpisodeScroll(scrollerContainer, targetCard, targetEpisodeNumber);
        };

        requestAnimationFrame(doScroll);
    }

    function performEpisodeScroll(scrollerContainer, targetCard, targetEpisodeNumber) {
        const scrollerPadding = parseInt(window.getComputedStyle(scrollerContainer).paddingLeft, 10) || 0;
        const translateX = targetCard.offsetLeft - scrollerPadding;
        window.cardBuilder.setScrollerPosition(scrollerContainer, translateX, false);

        const scrollButtons = scrollerContainer.closest('.emby-scroller-container')?.querySelector('.emby-scrollbuttons');
        if (scrollButtons) {
            const leftButton = scrollButtons.querySelector('button[data-direction="left"]');
            if (leftButton) {
                leftButton.removeAttribute('disabled');
            }
        }

        LOG(`Scrolled to target episode S${targetEpisodeNumber.season}:E${targetEpisodeNumber.episode}`);
    }

    /**
     * Waits for the seasons section to be rendered in the DOM
     * @param {HTMLElement} activePage - The active page element
     * @param {number} maxAttempts - Maximum number of attempts
     * @param {number} interval - Interval between attempts in ms
     * @returns {Promise<HTMLElement|null>} - The childrenCollapsible element or null
     */
    function waitForSeasonsSection(activePage, maxAttempts = 10, interval = 500) {
        return new Promise((resolve) => {
            let attempts = 0;
            
            const checkForSeasons = () => {
                attempts++;
                
                // Check for 10.11+ seasons section first
                let childrenCollapsible = activePage.querySelector('.detailSection #listChildrenCollapsible');
                
                // Fallback to 10.10 seasons section
                if (!childrenCollapsible) {
                    childrenCollapsible = activePage.querySelector('#childrenCollapsible');
                }
                
                if (childrenCollapsible) {
                    const itemsContainer = childrenCollapsible.querySelector('.itemsContainer');
                    if (itemsContainer && itemsContainer.children.length > 0) {
                        LOG('Seasons section found and rendered');
                        resolve(childrenCollapsible);
                        return;
                    }
                }
                
                if (attempts >= maxAttempts) {
                    WARN('Seasons section not found after maximum attempts');
                    resolve(null);
                    return;
                }
                
                setTimeout(checkForSeasons, interval);
            };
            
            checkForSeasons();
        });
    }

    /**
     * Renders episodes section for a series
     * @param {string} seriesId - The series ID
     * @param {Array} seasons - Array of season objects from DOM
     * @param {Object} targetSeason - The target season to display
     * @param {Object} targetEpisodeNumber - Target episode number for scrolling
     * @param {string} nextUpHeaderText - Text from NextUp section header
     */
    async function renderEpisodesSection(seriesId, seasons, targetEpisode, nextUpHeaderText) {
        const activePage = document.querySelector('.libraryPage:not(.hide)');
        if (!activePage) {
            WARN('Active page not found');
            return;
        }

        if (activePage.querySelector('.series-episodes-section')) {
            LOG('Episodes section already rendered, skipping');
            return;
        }

        let targetSeason = null;
        if (targetEpisode) {
            if (targetEpisode.SeasonId) {
                targetSeason = seasons.find(s => s.Id === targetEpisode.SeasonId);
            }
            if (!targetSeason && targetEpisode.ParentIndexNumber !== undefined) {
                targetSeason = seasons.find(s => s.IndexNumber === targetEpisode.ParentIndexNumber);
            }
        }
        if (!targetSeason) {
            targetSeason = seasons[0];
        }
        if (!targetSeason) {
            WARN('No seasons available to render');
            return;
        }

        const targetEpisodeNumber = targetEpisode ? {
            season: targetEpisode.ParentIndexNumber,
            episode: targetEpisode.IndexNumber,
            id: targetEpisode.Id
        } : null;

        const nextUpSection = activePage.querySelector('.nextUpSection');
        if (nextUpSection) {
            nextUpSection.style.display = 'none';
        }

        const host = insertEpisodesHost(activePage);
        if (!host || !host.parentNode) {
            WARN('Could not insert episodes host');
            return;
        }

        const hookState = {
            targetEpisodeNumber,
            nextUpHeaderText,
            activeSeasonIndex: seasonIndex(targetSeason)
        };
        setEpisodeHookState(host, hookState);

        const configureSection = (sectionConfig) => {
            sectionConfig._onSectionEnhanced = (sectionEl) => {
                const state = getEpisodeHookState(host);
                if (!state) return;
                const liveSection = sectionEl?.isConnected
                    ? sectionEl
                    : (host.querySelector('.emby-scroller-container') || host.querySelector('[data-section-id]'));
                applyEpisodeScrollAndBadge(
                    host,
                    liveSection,
                    state.targetEpisodeNumber,
                    state.activeSeasonIndex,
                    state.nextUpHeaderText
                );
            };
        };

        const onMultiQueryChange = (queryIndex, sectionConfig, newContent) => {
            const sectionEl = newContent
                || host.querySelector('.emby-scroller-container')
                || host.querySelector('[data-section-id]');
            const activeSeason = seasons[queryIndex];
            if (!sectionEl || !activeSeason) return;

            LOG(`Season switched via query picker: ${seasonName(activeSeason)}`);

            applyEpisodeScrollAndBadge(
                host,
                sectionEl,
                hookState.targetEpisodeNumber,
                seasonIndex(activeSeason),
                hookState.nextUpHeaderText
            );
        };

        let renderResult;
        try {
            renderResult = await renderEpisodesProgressive(
                seriesId,
                seasons,
                targetSeason,
                host,
                onMultiQueryChange,
                configureSection
            );
        } catch (err) {
            ERR('Failed to render progressive episodes section', err);
            return;
        }
        if (!renderResult) {
            return;
        }

        LOG(`Successfully rendered progressive episodes section for season ${seasonIndex(targetSeason)}`);
    }

    function updateNextUpItem(targetEpisodeNumber, scrollerContainer) {
        const existingNextUpEpisodes = scrollerContainer.querySelectorAll('.nextUpEpisode');
        for (const existingNextUpEpisode of existingNextUpEpisodes) {
            existingNextUpEpisode.classList.remove('nextUpEpisode');
        }

        if (targetEpisodeNumber.season !== 1 || targetEpisodeNumber.episode !== 1) {
            const targetCard = findTargetEpisodeCard(scrollerContainer, targetEpisodeNumber);
            if (targetCard) {
                targetCard.classList.add('nextUpEpisode');
                LOG(`Added nextUpEpisode class to card S${targetEpisodeNumber.season}:E${targetEpisodeNumber.episode}`);
            }
        }

        scrollToEpisode(scrollerContainer, targetEpisodeNumber);
    }

    /**
     * Processes a series page to add episodes section
     * @param {Object} series - The series item
     */
    async function processSeriesPage(series) {
        const seriesId = series.Id;
        const activePage = document.querySelector('.libraryPage:not(.hide)');
        if (!activePage) {
            WARN('Active page not found');
            return;
        }

        // Already processed for this series on this page instance
        if (activePage.dataset.seriesEpisodesItemId === seriesId
            && (activePage.dataset.seriesEpisodesProcessed === 'true'
                || activePage.querySelector('.series-episodes-section'))) {
            LOG('Series page already processed for this item, skipping');
            return;
        }

        // Use apiHelper to get seasons
        const response = await window.apiHelper.getQuery(`${ApiClient.serverAddress()}/Shows/${seriesId}/Seasons`, { useCache: true });
        if (!response.data) {
            response.data = await response.dataPromise;
        }
        const seasonsData = response.data;

        // Extract seasons from DOM
        const seasons = seasonsData.Items || seasonsData || [];
        if (seasons.length === 0) {
            WARN('No seasons found');
            return;
        }

        // Get configuration
        const config = window.KefinTweaksConfig || {};
        const scripts = config.scripts || {};
        const flattenConfig = config.flattenSingleSeasonShows || {};
        const isScriptEnabled = scripts.flattenSingleSeasonShows !== false; // Default to true if not set
        const hideSingleSeasonContainer = flattenConfig.hideSingleSeasonContainer === true;

        // Only proceed if script is enabled or if single season
        const isSingleSeason = seasons.length === 1;
        if (!isSingleSeason && !isScriptEnabled) {
            LOG('Multi-season show and Episodes On Series Page script is disabled, skipping');
            return;
        }

        // Get NextUp episode
        let targetEpisode = await fetchNextUpEpisode(seriesId);
        let targetEpisodeNumber = null;
        
        // Determine target season
        let targetSeason = null;
        
        if (targetEpisode) {
            // Set targetEpisodeNumber for compatibility
            targetEpisodeNumber = { 
                season: targetEpisode.ParentIndexNumber, 
                episode: targetEpisode.IndexNumber,
                id: targetEpisode.Id
            };

            // Find season matching NextUp episode by SeasonId (preferred) or index number
            if (targetEpisode.SeasonId) {
                targetSeason = seasons.find(s => s.Id === targetEpisode.SeasonId);
            }
            
            if (!targetSeason && targetEpisode.ParentIndexNumber !== undefined) {
                 targetSeason = seasons.find(s => s.IndexNumber === targetEpisode.ParentIndexNumber);
            }
        }
        
        // Fallback to first season if NextUp not found or season not in list
        if (!targetSeason) {
            targetSeason = seasons[0];
            // If we have NextUp but season not found, use first episode of first season
            if (targetEpisodeNumber && !seasons.find(s => s.IndexNumber === targetEpisodeNumber.season)) {
                targetEpisodeNumber = { season: targetSeason.IndexNumber, episode: 1 };
                LOG(`NextUp season not in seasons list, defaulting to first episode of first season`);
            } else if (!targetEpisodeNumber) {
                targetEpisodeNumber = { season: targetSeason.IndexNumber, episode: 1 };
                LOG(`No NextUp found, defaulting to first episode of first season`);
            }
        }

        // Extract NextUp header text
        let nextUpHeaderText = 'Next Up';
        const pageForUi = document.querySelector('.libraryPage:not(.hide)') || activePage;
        const nextUpSection = pageForUi.querySelector('.nextUpSection');
        if (nextUpSection) {
            const nextUpHeader = nextUpSection.querySelector('.sectionTitle, h2, h3');
            if (nextUpHeader) {
                nextUpHeaderText = nextUpHeader.textContent.trim() || 'Next Up';
                LOG(`Extracted NextUp header text: "${nextUpHeaderText}"`);
            }
        }

        // Render episodes section
        await renderEpisodesSection(seriesId, seasons, targetEpisode, nextUpHeaderText);

        // Hide season container if option is enabled and there's only one season
        if (hideSingleSeasonContainer && isSingleSeason && childrenCollapsible) {
            childrenCollapsible.style.display = 'none';
            LOG('Hid season container for single-season show');
        }

        // Mark as processed for this series id (item-scoped for double onViewPage invokes)
        const pageToMark = document.querySelector('.libraryPage:not(.hide)') || pageForUi;
        pageToMark.dataset.seriesEpisodesProcessed = 'true';
        pageToMark.dataset.seriesEpisodesItemId = seriesId;
    }

    async function verifyNextUpItem(seriesId) {
        const nextUpItem = await fetchNextUpEpisode(seriesId);

        if (!nextUpItem) {
            LOG('No Next Up item found, skipping');
            return;
        }

        const currentNextUpItem = document.querySelector('.libraryPage:not(.hide) .nextUpEpisode');
        if (!currentNextUpItem) {
            LOG('No Next Up episode element found, skipping');
            return;
        }

        if (currentNextUpItem.dataset.id === nextUpItem.Id) {
            LOG('Next Up item is the same as the current one, skipping');
            return;
        }

        const targetEpisodeNumber = nextUpItem ? {
            season: nextUpItem.ParentIndexNumber,
            episode: nextUpItem.IndexNumber,
            id: nextUpItem.Id
        } : null;

        const scrollerContainer = document.querySelector('.libraryPage:not(.hide) .series-episodes-section .emby-scroller');
        if (!scrollerContainer) {
            LOG('Scroller container not found, skipping');
            return;
        }

        updateNextUpItem(targetEpisodeNumber, scrollerContainer);
    }

    function getSeriesIdFromHash(hash = window.location.hash) {
        try {
            const match = String(hash || window.location.href).match(/[\?&]id=([^&]+)/);
            return match ? decodeURIComponent(match[1]) : null;
        } catch (_) {
            return null;
        }
    }

    /**
     * Initialize the series episodes hook
     */
    function initializeSeriesEpisodesHook() {
        if (!window.KefinTweaksUtils || !window.KefinTweaksUtils.onViewPage) {
            WARN('KefinTweaksUtils.onViewPage not available, retrying in 1 second');
            setTimeout(initializeSeriesEpisodesHook, 1000);
            return;
        }

        LOG('Registering series episodes handler with KefinTweaksUtils');

        window.KefinTweaksUtils.onViewPage(
            async (view, element, hash, itemPromise) => {
                const currentItemId = getSeriesIdFromHash(hash);
                const activePage = document.querySelector('.libraryPage:not(.hide)');
                if (!activePage) return;

                const existingSection = activePage.querySelector('.series-episodes-section');
                const processedForId = activePage.dataset.seriesEpisodesItemId;

                // Only treat as already done when this page was processed for the current item
                if (currentItemId
                    && processedForId === currentItemId
                    && (activePage.dataset.seriesEpisodesProcessed === 'true' || existingSection)) {
                    LOG('Existing episodes section for current item, only verifying NextUp item');
                    verifyNextUpItem(currentItemId);
                    return;
                }

                const item = await itemPromise;

                if (!item || item.Type !== 'Series') {
                    return;
                }

                LOG(`Found series: ${item.Id} (${item.Name})`);

                // Small delay to ensure page is ready (Emby may still be swapping pages)
                setTimeout(async () => {
                    await processSeriesPage(item);
                }, 100);
            },
            {
                pages: ['details']
            }
        );

        LOG('Series episodes hook initialized');
    }

    // Initialize the hook when the script loads
    function initialize() {
        if (!window.KefinTweaksUtils || !window.KefinTweaksUtils.onViewPage) {
            WARN('KefinTweaksUtils not available, retrying in 1 second');
            setTimeout(initialize, 1000);
            return;
        }

        initializeSeriesEpisodesHook();
    }

    // Start initialization
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initialize);
    } else {
        initialize();
    }

    LOG('Script loaded successfully');
})();

