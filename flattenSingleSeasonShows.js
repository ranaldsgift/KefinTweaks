// KefinTweaks Flatten Single Season Shows
// Flattens series with only 1 season to show episodes directly on the series details page
// Requires: cardBuilder.js, utils.js modules to be loaded before this script

(function() {
    'use strict';

    const LOG = (...args) => console.log('[KefinTweaks FlattenSingleSeasonShows]', ...args);
    const WARN = (...args) => console.warn('[KefinTweaks FlattenSingleSeasonShows]', ...args);
    const ERR = (...args) => console.error('[KefinTweaks FlattenSingleSeasonShows]', ...args);

    /**
     * Fetches all episodes for a given series
     * @param {string} seriesId - The series ID
     * @returns {Promise<Array>} - Array of episode items
     */
    async function fetchEpisodesForSeries(seriesId) {
        try {
            const apiClient = window.ApiClient;
            const userId = apiClient.getCurrentUserId();
            const serverUrl = apiClient.serverAddress();
            const token = apiClient.accessToken();

            LOG(`Fetching episodes for series: ${seriesId}`);
            const episodesUrl = `${serverUrl}/Shows/${seriesId}/Episodes?UserId=${userId}&Fields=UserData&EnableImageTypes=Primary`;
            const episodesRes = await fetch(episodesUrl, { 
                headers: { "Authorization": `MediaBrowser Token="${token}"` } 
            });
            
            if (!episodesRes.ok) {
                throw new Error(`HTTP ${episodesRes.status}: ${episodesRes.statusText}`);
            }
            
            const episodesData = await episodesRes.json();
            const episodes = episodesData.Items || [];
            
            LOG(`Fetched ${episodes.length} episodes for series: ${seriesId}`);
            return episodes;
        } catch (error) {
            ERR(`Failed to fetch episodes for series ${seriesId}:`, error);
            return [];
        }
    }

    /**
     * Flattens a single-season show by creating a "Season 1" section with all episodes
     * @param {string} seriesId - The series ID
     */
    async function flattenShow(seriesId) {
        LOG(`Flattening show: ${seriesId}`);

        // Check if already flattened for this series (avoid duplicates)
        const activePage = document.querySelector('.libraryPage:not(.hide)');
        if (activePage && activePage.dataset.flattenedSeriesId === seriesId) {
            LOG(`Show ${seriesId} already flattened, skipping`);
            return;
        }

        // Check if flattened section already exists
        const existingSection = activePage?.querySelector('.flattened-season-section');
        if (existingSection) {
            LOG(`Flattened section already exists, skipping`);
            return;
        }

        // Get all episodes for the series
        const episodes = await fetchEpisodesForSeries(seriesId);
        if (episodes.length === 0) {
            WARN(`No episodes found for series: ${seriesId}`);
            return;
        }

        // Check for cardBuilder
        if (!window.cardBuilder || !window.cardBuilder.renderCards) {
            WARN('cardBuilder.renderCards not available');
            return;
        }

        // Find the detailPageContent
        const detailPageContent = activePage?.querySelector('.detailPageContent');
        if (!detailPageContent) {
            WARN('detailPageContent not found');
            return;
        }

        // Find the #childrenCollapsible div
        const childrenCollapsible = detailPageContent.querySelector('#childrenCollapsible');
        if (!childrenCollapsible) {
            WARN('#childrenCollapsible not found');
            return;
        }

        try {
            // Get the season ID from the first episode's ParentId
            const seasonId = episodes[0]?.SeasonId;
            let viewMoreUrl = null;
            
            if (seasonId) {
                const apiClient = window.ApiClient;
                const serverId = apiClient.serverId();
                viewMoreUrl = `${apiClient._serverAddress || apiClient.serverAddress()}/web/#/details?id=${seasonId}&serverId=${serverId}`;
                LOG(`Setting viewMoreUrl to season details: ${viewMoreUrl}`);
            } else {
                WARN('Could not determine season ID from episodes');
            }

            // Render Season 1 section using renderCards
            const seasonSection = window.cardBuilder.renderCards(
                episodes,
                'Season 1',
                viewMoreUrl,
                false, // overflowCard
                null   // cardFormat (use default)
            );

            // Mark as flattened section
            seasonSection.classList.add('flattened-season-section');
            seasonSection.setAttribute('data-flattened-section', 'true');

            const scrollerContainer = seasonSection.querySelector('.emby-scroller');
            if (scrollerContainer) {
                scrollerContainer.classList.add('no-padding');
            }

            const sectionTitleContainer = seasonSection.querySelector('.sectionTitleContainer');
            if (sectionTitleContainer) {
                sectionTitleContainer.classList.add('no-padding');
            }

            // Prepend the Season 1 section right before #childrenCollapsible
            childrenCollapsible.parentNode.insertBefore(seasonSection, childrenCollapsible);

            // Mark as flattened for this series to avoid duplicates
            if (activePage) {
                activePage.dataset.flattenedSeriesId = seriesId;
            }

            LOG(`Successfully flattened show ${seriesId} with ${episodes.length} episodes`);
        } catch (error) {
            ERR('Error rendering flattened season section:', error);
        }
    }

    /**
     * Initialize the flatten single season shows hook
     */
    function initializeFlattenHook() {
        if (!window.KefinTweaksUtils || !window.KefinTweaksUtils.onViewPage) {
            WARN('KefinTweaksUtils.onViewPage not available, retrying in 1 second');
            setTimeout(initializeFlattenHook, 1000);
            return;
        }

        LOG('Registering flatten single season shows handler with KefinTweaksUtils');

        window.KefinTweaksUtils.onViewPage(
            async (view, element, itemPromise) => {
                // Only handle details pages
                const activePage = document.querySelector('.libraryPage:not(.hide)');
                if (!activePage) return;

                // Remove any existing flattened section and reset flag when page changes
                const existingSection = activePage.querySelector('.flattened-season-section');
                if (existingSection) {
                    existingSection.remove();
                }
                delete activePage.dataset.flattenedSeriesId;

                // Await the item promise to get the actual item data
                const item = await itemPromise;

                // Check if item is a Series and has only 1 ChildCount
                if (item && item.Type === 'Series' && item.ChildCount === 1) {
                    LOG(`Found single-season series: ${item.Id} (${item.Name})`);
                    
                    // Small delay to ensure details DOM is ready
                    setTimeout(async () => {
                        await flattenShow(item.Id);
                    }, 100);
                }
            },
            {
                immediate: true,
                pages: ['details']
            }
        );

        LOG('Flatten single season shows hook initialized');
    }

    // Initialize the hook when the script loads
    function initialize() {
        if (!window.KefinTweaksUtils || !window.KefinTweaksUtils.onViewPage) {
            WARN('KefinTweaksUtils not available, retrying in 1 second');
            setTimeout(initialize, 1000);
            return;
        }

        initializeFlattenHook();
    }

    // Start initialization
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initialize);
    } else {
        initialize();
    }

    LOG('Script loaded successfully');
})();

