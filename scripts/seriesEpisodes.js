// KefinTweaks Series Episodes
// Displays episodes directly on series page with season selection
// Requires: cardBuilder.js, utils.js modules to be loaded before this script

(function() {
    'use strict';

    const LOG = (...args) => console.log('[KefinTweaks SeriesEpisodes]', ...args);
    const WARN = (...args) => console.warn('[KefinTweaks SeriesEpisodes]', ...args);
    const ERR = (...args) => console.error('[KefinTweaks SeriesEpisodes]', ...args);

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
            const token = apiClient.accessToken();

            LOG(`Fetching season data for season ID: ${seasonId}`);
            const seasonUrl = `${serverUrl}/Items/${seasonId}?UserId=${userId}`;
            const seasonRes = await fetch(seasonUrl, { 
                headers: { "Authorization": `MediaBrowser Token="${token}"` } 
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
     * Fetches all episodes for a given series
     * @param {string} seriesId - The series ID
     * @param {string} [seasonId] - Optional season ID to filter episodes
     * @returns {Promise<Array>} - Array of episode items
     */
    async function fetchEpisodesForSeries(seriesId, seasonId = null) {
        try {
            const apiClient = window.ApiClient;
            const userId = apiClient.getCurrentUserId();
            const serverUrl = apiClient.serverAddress();
            const token = apiClient.accessToken();

            LOG(`Fetching episodes for series: ${seriesId}${seasonId ? ` (Season ID: ${seasonId})` : ''}`);
            const episodesUrl = `${serverUrl}/Shows/${seriesId}/Episodes?UserId=${userId}&Fields=UserData`;
            const episodesRes = await fetch(episodesUrl, { 
                headers: { "Authorization": `MediaBrowser Token="${token}"` } 
            });
            
            if (!episodesRes.ok) {
                throw new Error(`HTTP ${episodesRes.status}: ${episodesRes.statusText}`);
            }
            
            const episodesData = await episodesRes.json();
            let episodes = episodesData.Items || [];
            
            // Filter by season ID if specified
            if (seasonId !== null) {
                episodes = episodes.filter(ep => ep.SeasonId === seasonId);
            }
            
            LOG(`Fetched ${episodes.length} episodes for series: ${seriesId}${seasonId ? ` (Season ID: ${seasonId})` : ''}`);
            return episodes;
        } catch (error) {
            ERR(`Failed to fetch episodes for series ${seriesId}:`, error);
            return [];
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

    /**
     * Formats a season name, adding season number in parentheses if not in "Season XX" format
     * @param {string} seasonName - The season name
     * @param {number} seasonNumber - The season number
     * @returns {string} - Formatted season name
     */
    function formatSeasonName(seasonName, seasonNumber) {
        if (!seasonName) {
            return `Season ${seasonNumber}`;
        }
        
        return seasonName;
    }

    /**
     * Creates a season selector button with popover for multi-season shows
     * @param {HTMLElement} sectionTitleContainer - The section title container element
     * @param {Array} seasons - Array of season objects
     * @param {Object} currentSeason - The currently selected season
     * @param {Function} onSeasonSelect - Callback when a season is selected
     */
    function createSeasonSelector(sectionTitleContainer, seasons, currentSeason, onSeasonSelect) {
        // Create select season button
        const selectButton = document.createElement('button');
        selectButton.className = 'emby-button raised season-selector-button';
        selectButton.textContent = 'Select Season';
        selectButton.style.cssText = 'margin-left: 1em; padding: 0.5em 1em; font-size: 0.9em;';
        selectButton.setAttribute('aria-label', 'Select season');

        // Find the <a> tag link (titleLink) and append button after it
        const titleLink = sectionTitleContainer.querySelector('a.sectionTitle-link');
        if (titleLink) {
            titleLink.parentNode.insertBefore(selectButton, titleLink.nextSibling);
        } else {
            const sectionTitle = sectionTitleContainer.querySelector('.sectionTitle');
            if (sectionTitle) {
                sectionTitle.parentNode.insertBefore(selectButton, sectionTitle.nextSibling);
            } else {
                sectionTitleContainer.appendChild(selectButton);
            }
        }

        let activePopover = null;

        const closePopover = () => {
            if (activePopover) {
                activePopover.remove();
                activePopover = null;
            }
        };

        const createPopover = () => {
            const popover = document.createElement('div');
            popover.className = 'kefinTweaks-popover seasonPopover itemDetailsGroup';

            const seasonPopoverCss = `
                .seasonPopover {
                    background-color: rgba(0, 0, 0, 0.95);
                    position: absolute;
                    z-index: 1001;
                    display: block;
                }
            `;
            const styleElement = document.createElement('style');
            styleElement.textContent = seasonPopoverCss;
            document.head.appendChild(styleElement);
            
            // Calculate left position based on right edge of the <a> tag link
            const titleLink = sectionTitleContainer.querySelector('a.sectionTitle-link');
            if (titleLink) {
                const titleLinkRect = titleLink.getBoundingClientRect();
                const sectionTitleContainerRect = sectionTitleContainer.getBoundingClientRect();
                const leftOffset = titleLinkRect.right - sectionTitleContainerRect.left;
                popover.style.left = `${leftOffset}px`;
            } else {
                popover.style.left = '0';
            }

            let selectedItemElement = null;
            seasons.forEach(season => {
                const itemElement = document.createElement('div');
                itemElement.className = 'kefinTweaks-popover-item';
                
                if (currentSeason && season.id === currentSeason.id) {
                    itemElement.classList.add('selected');
                    selectedItemElement = itemElement;
                }
                
                const displayText = formatSeasonName(`${season.name}`, season.indexNumber);
                itemElement.textContent = displayText;
                itemElement.addEventListener('click', () => {
                    LOG(`Season selected: ${displayText}`);
                    onSeasonSelect(season);
                    closePopover();
                });
                
                popover.appendChild(itemElement);
            });

            // Store reference to selected item for scrolling
            popover._selectedItem = selectedItemElement;

            return popover;
        };

        selectButton.addEventListener('click', (e) => {
            e.stopPropagation();
            e.preventDefault();
            
            if (activePopover) {
                closePopover();
            } else {
                const popover = createPopover();
                sectionTitleContainer.style.position = 'relative';
                selectButton.parentNode.insertBefore(popover, selectButton.nextSibling);
                popover.style.top = '100%';
                popover.style.bottom = 'auto';
                popover.style.marginTop = '8px';
                popover.style.marginBottom = '0';
                
                activePopover = popover;

                // Scroll to selected season if it exists
                if (popover._selectedItem) {
                    setTimeout(() => {
                        popover._selectedItem.scrollIntoView({
                            behavior: 'instant',
                            block: 'nearest',
                            inline: 'nearest'
                        });
                        LOG('Auto-scrolled to selected season:', popover._selectedItem.textContent);
                    }, 10);
                }

                const closeHandler = (e) => {
                    if (!popover.contains(e.target) && !selectButton.contains(e.target)) {
                        closePopover();
                        document.removeEventListener('click', closeHandler);
                    }
                };
                
                setTimeout(() => {
                    document.addEventListener('click', closeHandler);
                }, 100);
            }
        });
    }

    /**
     * Scrolls to a specific episode in the scroller container
     * @param {HTMLElement} scrollerContainer - The scroller container element
     * @param {Object} targetEpisodeNumber - Object with season and episode numbers
     */
    function scrollToEpisode(scrollerContainer, targetEpisodeNumber) {
        if (!scrollerContainer || !targetEpisodeNumber) return;

        setTimeout(() => {
            const scrollerItemsContainer = scrollerContainer.querySelector('.itemsContainer');
            if (!scrollerItemsContainer) {
                WARN('Could not find itemsContainer in scroller');
                return;
            }

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

            if (targetCard) {
                const itemsContainer = scrollerItemsContainer;
                const cardOffset = targetCard.offsetLeft;
                const scrollerPadding = parseInt(window.getComputedStyle(scrollerContainer).paddingLeft, 10) || 0;
                const translateX = (cardOffset - scrollerPadding);
                scrollerContainer.scrollToPosition(translateX);
                
                const scrollButtons = scrollerContainer.closest('.emby-scroller-container')?.querySelector('.emby-scrollbuttons');
                if (scrollButtons) {
                    const leftButton = scrollButtons.querySelector('button[data-direction="left"]');
                    if (leftButton) {
                        leftButton.removeAttribute('disabled');
                    }
                }
                
                LOG(`Scrolled to target episode S${targetEpisodeNumber.season}:E${targetEpisodeNumber.episode}`);
            } else {
                WARN(`Could not find target episode card S${targetEpisodeNumber.season}:E${targetEpisodeNumber.episode}`);
            }
        }, 100);
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

        // Check if already rendered
        if (activePage.querySelector('.series-episodes-section')) {
            LOG('Episodes section already rendered, skipping');
            return;
        }

        // Determine target season parameters
        let targetSeasonId, targetSeasonIndex, targetSeasonName;
        
        if (targetEpisode) {
            targetSeasonId = targetEpisode.SeasonId;
            targetSeasonIndex = targetEpisode.ParentIndexNumber;
            // Try to find matching season in seasons list for consistent naming, otherwise use API data
            const matchingSeason = seasons.find(s => s.id === targetSeasonId);
            targetSeasonName = matchingSeason ? matchingSeason.name : (targetEpisode.SeasonName || `Season ${targetSeasonIndex}`);
        } else {
            // Fallback to first season
            if (seasons.length > 0) {
                targetSeasonId = seasons[0].id;
                targetSeasonIndex = seasons[0].indexNumber;
                targetSeasonName = seasons[0].name;
            } else {
                WARN('No seasons available to render');
                return;
            }
        }

        // Construct targetSeason object for selector
        const targetSeason = {
            id: targetSeasonId,
            name: targetSeasonName,
            indexNumber: targetSeasonIndex
        };

        // Fetch episodes for the target season
        const episodes = await fetchEpisodesForSeries(seriesId, targetSeasonId);
        if (episodes.length === 0) {
            WARN(`No episodes found for season ${targetSeasonId}`);
            return;
        }

        // Check for cardBuilder
        if (!window.cardBuilder || !window.cardBuilder.renderCards) {
            WARN('cardBuilder.renderCards not available');
            return;
        }

        // Format season name
        const seasonName = formatSeasonName(targetSeasonName, targetSeasonIndex);

        // Build viewMoreUrl
        const apiClient = window.ApiClient;
        const serverId = apiClient.serverId();
        const viewMoreUrl = `${apiClient._serverAddress || apiClient.serverAddress()}/web/#/details?id=${targetSeasonId}&serverId=${serverId}`;

        // Render season section using renderCards
        const seasonSection = window.cardBuilder.renderCards(
            episodes,
            seasonName,
            viewMoreUrl,
            true, // overflowCard
            null   // cardFormat (use default)
        );

        // Define targetEpisodeNumber for internal usage (scrolling/highlighting)
        const targetEpisodeNumber = targetEpisode ? {
            season: targetEpisode.ParentIndexNumber,
            episode: targetEpisode.IndexNumber,
            id: targetEpisode.Id
        } : null;

        // Mark as series episodes section
        seasonSection.classList.add('series-episodes-section');
        
        const hideSingleSeasonContainer = window.KefinTweaksConfig?.flattenSingleSeasonShows?.hideSingleSeasonContainer === true;

        // ElegantFin handling :)
        seasonSection.style.cssText = `
            overflow: hidden;
            display: block;
        `;

        const scrollerContainer = seasonSection.querySelector('.emby-scroller');
        if (scrollerContainer) {
            scrollerContainer.classList.add('no-padding');
        }

        const sectionTitleContainer = seasonSection.querySelector('.sectionTitleContainer');
        if (sectionTitleContainer) {
            sectionTitleContainer.classList.add('no-padding');
        }

        // Hide NextUp section if it exists
        const nextUpSection = activePage.querySelector('.nextUpSection');
        if (nextUpSection) {
            nextUpSection.style.display = 'none';
        }

        // Insert episodes section right after NextUp section (or at the beginning if no NextUp)
        const detailPageContent = activePage.querySelector('.detailPageContent');
        if (detailPageContent) {
            if (nextUpSection && nextUpSection.parentNode) {
                nextUpSection.parentNode.insertBefore(seasonSection, nextUpSection.nextSibling);
            } else {
                // Find a good insertion point - after NextUp or before childrenCollapsible
                const childrenCollapsible = activePage.querySelector('.detailSection #listChildrenCollapsible') || 
                                           activePage.querySelector('#childrenCollapsible');
                if (childrenCollapsible && childrenCollapsible.parentNode) {
                    childrenCollapsible.parentNode.insertBefore(seasonSection, childrenCollapsible);
                } else {
                    detailPageContent.insertBefore(seasonSection, detailPageContent.firstChild);
                }
            }
        }

        // Add season selector if more than one season
        if (seasons.length > 1) {
            const handleSeasonChange = async (selectedSeason) => {
                LOG(`Switching to season: ${selectedSeason.name}`);
                
                const newEpisodes = await fetchEpisodesForSeries(seriesId, selectedSeason.id);
                if (newEpisodes.length === 0) {
                    WARN(`No episodes found for Season ID: ${selectedSeason.id}`);
                    return;
                }
                
                // Update section title
                const sectionTitle = sectionTitleContainer.querySelector('.sectionTitle');
                if (sectionTitle) {
                    const newSeasonName = formatSeasonName(selectedSeason.name, selectedSeason.indexNumber);
                    sectionTitle.textContent = newSeasonName;
                }
                
                // Update viewMoreUrl
                const titleLink = sectionTitleContainer.querySelector('a.sectionTitle-link');
                if (titleLink && selectedSeason.id) {
                    const newViewMoreUrl = `${apiClient._serverAddress || apiClient.serverAddress()}/web/#/details?id=${selectedSeason.id}&serverId=${serverId}`;
                    titleLink.href = newViewMoreUrl;
                    LOG(`Updated viewMoreUrl to: ${newViewMoreUrl}`);
                }
                
                // Update season selector button
                const oldButton = sectionTitleContainer.querySelector('.season-selector-button');
                if (oldButton) {
                    oldButton.remove();
                }
                createSeasonSelector(sectionTitleContainer, seasons, selectedSeason, handleSeasonChange);
                
                // Replace episodes
                const itemsContainer = scrollerContainer?.querySelector('.itemsContainer');
                if (itemsContainer && window.cardBuilder && window.cardBuilder.buildCard) {
                    itemsContainer.innerHTML = '';
                    
                    newEpisodes.forEach(episode => {
                        const card = window.cardBuilder.buildCard(episode, true);
                        if (card) {
                            itemsContainer.appendChild(card);
                        }
                    });
                    
                    // Check if NextUp is in this season
                    if (targetEpisodeNumber && targetEpisodeNumber.season === selectedSeason.indexNumber) {
                        if (targetEpisodeNumber.season !== 1 || targetEpisodeNumber.episode !== 1) {
                            setTimeout(() => {
                                const cards = itemsContainer.querySelectorAll('.card');
                                for (const card of cards) {
                                    const cardTextLinks = card.querySelectorAll('.cardText a');
                                    for (const link of cardTextLinks) {
                                        const linkText = link.innerText || link.textContent;
                                        const match = linkText.match(/S(\d+):E(\d+)/);
                                        if (match && 
                                            parseInt(match[1], 10) === targetEpisodeNumber.season &&
                                            parseInt(match[2], 10) === targetEpisodeNumber.episode) {
                                            card.classList.add('nextUpEpisode');
                                            LOG(`Added nextUpEpisode class to card S${targetEpisodeNumber.season}:E${targetEpisodeNumber.episode}`);
                                            break;
                                        }
                                    }
                                }
                            }, 50);
                        }
                        scrollToEpisode(scrollerContainer, targetEpisodeNumber);
                    } else {
                        // Scroll to beginning if this season doesn't have NextUp
                        if (scrollerContainer) {
                            setTimeout(() => {
                                scrollerContainer.scrollToPosition(0);
                                LOG('Scrolled to beginning of season (not NextUp season)');
                            }, 100);
                        }
                    }
                }
            };
            
            createSeasonSelector(sectionTitleContainer, seasons, targetSeason, handleSeasonChange);
        }

        // Add NextUp episode styling and class if needed
        if (targetEpisodeNumber && scrollerContainer) {
            if (targetEpisodeNumber.season === targetSeason.indexNumber) {
                // Add CSS for nextUpEpisode class if not already added
                if (!document.getElementById('kefinTweaks-nextUpEpisode-style')) {
                    const style = document.createElement('style');
                    style.id = 'kefinTweaks-nextUpEpisode-style';
                    const escapedHeaderText = nextUpHeaderText.replace(/'/g, "\\'").replace(/"/g, '\\"');
                    style.textContent = `
                        .nextUpEpisode .cardScalable::after {
                            content: '${escapedHeaderText}';
                            position: absolute;
                            transform: translateY(-100%);
                            padding: 0.5em 1em;
                            width: calc(100% - 2em);
                            text-align: center;
                            background: linear-gradient(90deg, transparent, black, transparent);
                            font-size: 1.2em;
                        }
                    `;
                    document.head.appendChild(style);
                    LOG('Added nextUpEpisode CSS with header text:', nextUpHeaderText);
                }
                
                // Add nextUpEpisode class if not S1E1
                if (targetEpisodeNumber.season !== 1 || targetEpisodeNumber.episode !== 1) {
                    setTimeout(() => {
                        const scrollerItemsContainer = scrollerContainer.querySelector('.itemsContainer');
                        if (scrollerItemsContainer) {
                            const cards = scrollerItemsContainer.querySelectorAll('.card');
                            for (const card of cards) {
                                const cardTextLinks = card.querySelectorAll('.cardText a');
                                for (const link of cardTextLinks) {
                                    const linkText = link.innerText || link.textContent;
                                    const match = linkText.match(/S(\d+):E(\d+)/);
                                    if (match && 
                                        parseInt(match[1], 10) === targetEpisodeNumber.season &&
                                        parseInt(match[2], 10) === targetEpisodeNumber.episode) {
                                        card.classList.add('nextUpEpisode');
                                        LOG(`Added nextUpEpisode class to card S${targetEpisodeNumber.season}:E${targetEpisodeNumber.episode}`);
                                        break;
                                    }
                                }
                            }
                        }
                    }, 100);
                }
                
                scrollToEpisode(scrollerContainer, targetEpisodeNumber);
            }
        }

        LOG(`Successfully rendered episodes section for season ${targetSeason.indexNumber} with ${episodes.length} episodes`);
    }

    /**
     * Processes a series page to add episodes section
     * @param {string} seriesId - The series ID
     */
    async function processSeriesPage(seriesId) {
        const activePage = document.querySelector('.libraryPage:not(.hide)');
        if (!activePage) {
            WARN('Active page not found');
            return;
        }

        // Check if already processed
        if (activePage.dataset.seriesEpisodesProcessed === 'true') {
            LOG('Series page already processed, skipping');
            return;
        }

        // Wait for seasons section to render
        LOG('Waiting for seasons section to render...');
        const childrenCollapsible = await waitForSeasonsSection(activePage);
        
        if (!childrenCollapsible) {
            WARN('Could not find seasons section, aborting');
            return;
        }

        // Extract seasons from DOM
        const seasons = extractSeasonsFromDOM(activePage);
        if (seasons.length === 0) {
            WARN('No seasons found in DOM');
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
                targetSeason = seasons.find(s => s.id === targetEpisode.SeasonId);
            }
            
            if (!targetSeason && targetEpisode.ParentIndexNumber !== undefined) {
                 targetSeason = seasons.find(s => s.indexNumber === targetEpisode.ParentIndexNumber);
            }
        }
        
        // Fallback to first season if NextUp not found or season not in list
        if (!targetSeason) {
            targetSeason = seasons[0];
            // If we have NextUp but season not found, use first episode of first season
            if (targetEpisodeNumber && !seasons.find(s => s.indexNumber === targetEpisodeNumber.season)) {
                targetEpisodeNumber = { season: targetSeason.indexNumber, episode: 1 };
                LOG(`NextUp season not in seasons list, defaulting to first episode of first season`);
            } else if (!targetEpisodeNumber) {
                targetEpisodeNumber = { season: targetSeason.indexNumber, episode: 1 };
                LOG(`No NextUp found, defaulting to first episode of first season`);
            }
        }

        // Extract NextUp header text
        let nextUpHeaderText = 'Next Up';
        const nextUpSection = activePage.querySelector('.nextUpSection');
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

        // Mark as processed
        activePage.dataset.seriesEpisodesProcessed = 'true';
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
                const activePage = document.querySelector('.libraryPage:not(.hide)');
                if (!activePage) return;

                // Remove processed flag when page changes
                if (activePage.dataset.seriesEpisodesProcessed) {
                    //delete activePage.dataset.seriesEpisodesProcessed;
                    LOG('Existing episodes section found, skipping');
                    return;
                }

                // Remove any existing episodes section
                const existingSection = activePage.querySelector('.series-episodes-section');
                if (existingSection) {
                    //existingSection.remove();
                    LOG('Existing episodes section found, skipping');
                    return;
                }

                const item = await itemPromise;

                if (item && item.Type === 'Series') {
                    LOG(`Found series: ${item.Id} (${item.Name})`);
                    
                    // Small delay to ensure page is ready
                    setTimeout(async () => {
                        await processSeriesPage(item.Id);
                    }, 100);
                }
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

