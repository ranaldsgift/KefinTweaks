// KefinTweaks Flatten Single Season Shows
// Flattens series with only 1 season to show episodes directly on the series details page
// Requires: cardBuilder.js, utils.js modules to be loaded before this script

(function() {
    'use strict';

    const LOG = (...args) => console.log('[KefinTweaks FlattenSingleSeasonShows]', ...args);
    const WARN = (...args) => console.warn('[KefinTweaks FlattenSingleSeasonShows]', ...args);
    const ERR = (...args) => console.error('[KefinTweaks FlattenSingleSeasonShows]', ...args);

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
            const token = apiClient.accessToken();

            LOG(`Fetching Next Up episode for series: ${seriesId}`);
            const nextUpUrl = `${serverUrl}/Shows/NextUp?SeriesId=${seriesId}&UserId=${userId}&Fields=MediaSourceCount`;
            const nextUpRes = await fetch(nextUpUrl, { 
                headers: { "Authorization": `MediaBrowser Token="${token}"` } 
            });
            
            if (!nextUpRes.ok) {
                throw new Error(`HTTP ${nextUpRes.status}: ${nextUpRes.statusText}`);
            }
            
            const nextUpData = await nextUpRes.json();
            const items = nextUpData.Items || [];
            
            if (items.length > 0) {
                const item = items[0];
                if (item.IndexNumber && item.ParentIndexNumber) {
                    const episodeNumber = {
                        season: item.ParentIndexNumber,
                        episode: item.IndexNumber
                    };
                    LOG(`Fetched Next Up episode from API: S${episodeNumber.season}:E${episodeNumber.episode}`);
                    return episodeNumber;
                }
            }
            
            LOG('No Next Up episode found in API response');
            return null;
        } catch (error) {
            ERR(`Failed to fetch Next Up episode for series ${seriesId}:`, error);
            return null;
        }
    }

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
            const episodesUrl = `${serverUrl}/Shows/${seriesId}/Episodes?UserId=${userId}&Fields=UserData`;
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
        let childrenCollapsible = detailPageContent.querySelector('#childrenCollapsible');
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

            // Check if Next Up section exists
            const nextUpSection = activePage?.querySelector('.nextUpSection');
            const nextUpItemsContainer = nextUpSection?.querySelector('.itemsContainer');
            
            // Extract episode info from Next Up if it exists
            let targetEpisodeNumber = null;
            if (nextUpSection && nextUpItemsContainer) {
                LOG('Next Up section found, hiding nextUpSection');
                
                // Get the existing card from Next Up and extract episode info
                const existingCard = nextUpItemsContainer.querySelector('.card');
                if (existingCard) {
                    // Find the .cardText a element that contains the episode number
                    const cardTextLinks = existingCard.querySelectorAll('.cardText a');
                    for (const link of cardTextLinks) {
                        const linkText = link.innerText || link.textContent;
                        // Match SX:EY pattern (may be part of longer text like "S1:E5 - Episode Name")
                        const match = linkText.match(/S(\d+):E(\d+)/);
                        if (match) {
                            targetEpisodeNumber = {
                                season: parseInt(match[1], 10),
                                episode: parseInt(match[2], 10)
                            };
                            LOG(`Found Next Up episode from DOM: S${targetEpisodeNumber.season}:E${targetEpisodeNumber.episode}`);
                            break;
                        }
                    }
                }
                
                // If we couldn't find it from the DOM, fetch from API
                if (!targetEpisodeNumber) {
                    LOG('Could not find episode number from DOM, fetching from API');
                    targetEpisodeNumber = await fetchNextUpEpisode(seriesId);
                }
                
                // Hide the entire Next Up section
                nextUpSection.style.display = 'none';
            }

            const seasonName = episodes[0]?.SeasonName || `Season ${episodes[0]?.ParentIndexNumber}`;

            // Render Season 1 section using renderCards (default behavior)
            const seasonSection = window.cardBuilder.renderCards(
                episodes,
                `${seasonName}`,
                viewMoreUrl,
                true, // overflowCard
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

            let childrenItemsContainer = childrenCollapsible.querySelector('.itemsContainer');

            if (!childrenItemsContainer || childrenItemsContainer.children.length === 0) {
                // Check for 10.11.X children container
                childrenCollapsible = activePage.querySelector('#listChildrenCollapsible');
                childrenItemsContainer = childrenCollapsible ? childrenCollapsible.querySelector('.itemsContainer') : null;
            }

            // Check if childrenCollapsible has only one child in its itemsContainer, and hide it if so
            if (childrenItemsContainer && childrenItemsContainer.children.length === 1) {
                LOG('childrenCollapsible contains only one child, hiding it');
                childrenCollapsible.style.display = 'none';
            }

            // If we found a target episode from Next Up, scroll to it
            if (targetEpisodeNumber && scrollerContainer) {
                // Wait for cards to be rendered and positioned
                setTimeout(() => {
                    const scrollerItemsContainer = scrollerContainer.querySelector('.itemsContainer');
                    if (!scrollerItemsContainer) {
                        WARN('Could not find itemsContainer in scroller');
                        return;
                    }

                    // Find the card that matches the target episode number
                    const cards = scrollerItemsContainer.querySelectorAll('.card');
                    let targetCard = null;
                    
                    for (const card of cards) {
                        const cardTextLinks = card.querySelectorAll('.cardText a');
                        for (const link of cardTextLinks) {
                            const linkText = link.innerText || link.textContent;
                            const match = linkText.match(/S(\d+):E(\d+)/);
                            if (match && 
                                parseInt(match[1], 10) === targetEpisodeNumber.season &&
                                parseInt(match[2], 10) === targetEpisodeNumber.episode) {
                                targetCard = card;
                                break;
                            }
                        }
                        if (targetCard) break;
                    }

                    // Scroll to make the target card the leftmost visible element
                    if (targetCard) {
                        const itemsContainer = scrollerItemsContainer;
                        const cardOffset = targetCard.offsetLeft;
                        const scrollerPadding = parseInt(window.getComputedStyle(scrollerContainer).paddingLeft, 10) || 0;
                        
                        // Calculate the scrollToPosition value
                        // The card offset minus padding gives us how much to scroll
                        const translateX = (cardOffset - scrollerPadding);
                        scrollerContainer.scrollToPosition(translateX);
                        
                        // Enable the left scroll button so users can scroll back
                        const scrollButtons = scrollerContainer.closest('.emby-scroller-container')?.querySelector('.emby-scrollbuttons');
                        if (scrollButtons) {
                            const leftButton = scrollButtons.querySelector('button[data-direction="left"]');
                            if (leftButton) {
                                leftButton.removeAttribute('disabled');
                                LOG('Enabled left scroll button');
                            }
                        }
                        
                        LOG(`Scrolled to target episode S${targetEpisodeNumber.season}:E${targetEpisodeNumber.episode} using translateX(${translateX}px)`);
                    } else {
                        WARN(`Could not find target episode card S${targetEpisodeNumber.season}:E${targetEpisodeNumber.episode}`);
                    }
                }, 100);
            }

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
            async (view, element, hash, itemPromise) => {
                // Only handle details pages
                const activePage = document.querySelector('.libraryPage:not(.hide)');
                if (!activePage) return;

                // Remove any existing flattened section and reset flag when page changes
                const existingSection = activePage.querySelector('.flattened-season-section');
                if (existingSection) {
                    LOG('Flattened section already exists, skipping');
                    return;
                }

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

