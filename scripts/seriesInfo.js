// KefinTweaks Series Info
// Adds series and season information to details pages
// Requires: utils.js module to be loaded before this script

(function() {
    'use strict';

    const LOG = (...args) => console.log('[KefinTweaks SeriesInfo]', ...args);
    const WARN = (...args) => console.warn('[KefinTweaks SeriesInfo]', ...args);
    const ERR = (...args) => console.error('[KefinTweaks SeriesInfo]', ...args);

    /**
     * Parses a runtime string (e.g., "42m", "1h 5m") into total minutes
     * @param {string} runtimeStr - Runtime string like "42m" or "1h 5m"
     * @returns {number} Total minutes, or 0 if parsing fails
     */
    function parseRuntimeString(runtimeStr) {
        if (!runtimeStr || typeof runtimeStr !== 'string') {
            return 0;
        }

        let totalMinutes = 0;
        
        // Match hours: "1h" or "1 h"
        const hourMatch = runtimeStr.match(/(\d+)\s*h/i);
        if (hourMatch) {
            totalMinutes += parseInt(hourMatch[1], 10) * 60;
        }
        
        // Match minutes: "5m" or "5 m"
        const minuteMatch = runtimeStr.match(/(\d+)\s*m/i);
        if (minuteMatch) {
            totalMinutes += parseInt(minuteMatch[1], 10);
        }
        
        return totalMinutes;
    }

    /**
     * Extracts total runtime from episode DOM elements on season page
     * @param {HTMLElement} activePage - The active page element
     * @returns {Promise<number>} Total runtime in minutes, or 0 if not found
     */
    async function extractSeasonRuntimeFromDOM(activePage) {
        // Check for #listChildrenCollapsible first (10.11+)
        let childrenCollapsible = activePage.querySelector('#listChildrenCollapsible');
        
        // Fallback to #childrenCollapsible (10.10)
        if (!childrenCollapsible) {
            childrenCollapsible = activePage.querySelector('#childrenCollapsible');
        }
        
        if (!childrenCollapsible) {
            WARN('Could not find childrenCollapsible element for season runtime extraction');
            return 0;
        }
        
        const itemsContainer = childrenCollapsible.querySelector('.itemsContainer');
        if (!itemsContainer) {
            WARN('Could not find itemsContainer in childrenCollapsible');
            return 0;
        }
        
        // Wait for episode containers to appear (up to 10 seconds)
        const maxAttempts = 20; // 20 attempts * 500ms = 10 seconds
        const interval = 500;
        let attempts = 0;
        
        while (attempts < maxAttempts) {
            // Get all direct children (episode containers)
            const episodeContainers = itemsContainer.querySelectorAll(':scope > *');
            
            // Check if we have episode containers with runtime data
            let hasValidContainers = false;
            if (episodeContainers.length > 0) {
                // Check if at least one container has the expected structure
                for (const container of episodeContainers) {
                    const mediaInfo = container.querySelector('.secondary.listItemMediaInfo.listItemBodyText');
                    if (mediaInfo) {
                        const mediaInfoItem = mediaInfo.querySelector(':scope > .mediaInfoItem');
                        if (mediaInfoItem) {
                            hasValidContainers = true;
                            break;
                        }
                    }
                }
            }
            
            if (hasValidContainers) {
                // Found valid containers, extract runtimes
                let totalMinutes = 0;
                let parsedCount = 0;
                
                episodeContainers.forEach(episodeContainer => {
                    // Find .secondary.listItemMediaInfo.listItemBodyText
                    const mediaInfo = episodeContainer.querySelector('.secondary.listItemMediaInfo.listItemBodyText');
                    if (!mediaInfo) {
                        return;
                    }
                    
                    // Find .mediaInfoItem direct child
                    const mediaInfoItem = mediaInfo.querySelector(':scope > .mediaInfoItem');
                    if (!mediaInfoItem) {
                        return;
                    }
                    
                    const runtimeText = (mediaInfoItem.innerText || mediaInfoItem.textContent || '').trim();
                    if (runtimeText) {
                        const minutes = parseRuntimeString(runtimeText);
                        if (minutes > 0) {
                            totalMinutes += minutes;
                            parsedCount++;
                        }
                    }
                });
                
                LOG(`Extracted runtime from ${parsedCount} episodes: ${totalMinutes} minutes total`);
                return totalMinutes;
            }
            
            attempts++;
            if (attempts < maxAttempts) {
                await new Promise(resolve => setTimeout(resolve, interval));
            }
        }
        
        WARN('Could not find episode containers with runtime data after waiting 10 seconds');
        return 0;
    }

    /**
     * Formats RunTimeTicks into an end time string
     * @param {number} runTimeTicks - Runtime in ticks (100-nanosecond intervals)
     * @returns {string} Formatted end time (e.g., "2:40 AM Dec 6" or "2:40 AM" if same day)
     */
    function formatEndTime(runTimeTicks) {
        if (!runTimeTicks || runTimeTicks <= 0) {
            return null;
        }

        const now = new Date();
        // RunTimeTicks is in 100-nanosecond intervals, convert to milliseconds
        const runtimeMs = runTimeTicks / 10000;
        const endTime = new Date(now.getTime() + runtimeMs);

        // Format time
        const timeStr = endTime.toLocaleTimeString([], { 
            hour: 'numeric', 
            minute: '2-digit',
            hour12: true 
        });

        // Check if end date is the same as current day
        const nowDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const endDate = new Date(endTime.getFullYear(), endTime.getMonth(), endTime.getDate());
        
        if (nowDate.getTime() === endDate.getTime()) {
            // Same day, return only time
            return timeStr;
        } else {
            // Different day, include date
            const dateStr = endTime.toLocaleDateString([], { 
                month: 'short', 
                day: 'numeric' 
            });
            return `${timeStr} ${dateStr}`;
        }
    }

    /**
     * Formats total minutes into an end time string
     * @param {number} totalMinutes - Total runtime in minutes
     * @returns {string} Formatted end time (e.g., "2:40 AM Dec 6" or "2:40 AM" if same day)
     */
    function formatEndTimeFromMinutes(totalMinutes) {
        if (!totalMinutes || totalMinutes <= 0) {
            return null;
        }

        const now = new Date();
        // Convert minutes to milliseconds
        const runtimeMs = totalMinutes * 60 * 1000;
        const endTime = new Date(now.getTime() + runtimeMs);

        // Format time
        const timeStr = endTime.toLocaleTimeString([], { 
            hour: 'numeric', 
            minute: '2-digit',
            hour12: true 
        });

        // Check if end date is the same as current day
        const nowDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const endDate = new Date(endTime.getFullYear(), endTime.getMonth(), endTime.getDate());
        
        if (nowDate.getTime() === endDate.getTime()) {
            // Same day, return only time
            return timeStr;
        } else {
            // Different day, include date
            const dateStr = endTime.toLocaleDateString([], { 
                month: 'short', 
                day: 'numeric' 
            });
            return `${timeStr} ${dateStr}`;
        }
    }

    /**
     * Adds series info to the itemMiscInfo container
     * @param {Object} item - Series item object
     * @param {HTMLElement} miscInfoContainer - The .itemMiscInfo container
     */
    function addSeriesInfo(item, miscInfoContainer) {
        // Check if already added
        if (miscInfoContainer.querySelector('.kt-series-info')) {
            LOG('Series info already added, skipping');
            return;
        }

        const infoContainer = document.createElement('div');
        infoContainer.className = 'kt-series-info';
        infoContainer.style.display = 'flex';

        // Seasons count (only show if more than 1 season)
        const childCount = item.ChildCount || 0;
        if (childCount > 1) {
            const seasonsDiv = document.createElement('div');
            seasonsDiv.className = 'mediaInfoItem';
            seasonsDiv.textContent = `${childCount} Seasons`;
            infoContainer.appendChild(seasonsDiv);
        }

        // Episodes count
        const RecursiveItemCount = item.RecursiveItemCount || 0;
        if (RecursiveItemCount > 0) {
            const episodesDiv = document.createElement('div');
            episodesDiv.className = 'mediaInfoItem';
            episodesDiv.textContent = `${RecursiveItemCount} ${RecursiveItemCount === 1 ? 'Episode' : 'Episodes'}`;
            infoContainer.appendChild(episodesDiv);
        }

        // End time - RunTimeTicks is for first episode, multiply by episode count for total
        if (item.RunTimeTicks && item.RunTimeTicks > 0 && RecursiveItemCount > 0) {
            const totalRuntimeTicks = item.RunTimeTicks * RecursiveItemCount;
            const endTimeStr = formatEndTime(totalRuntimeTicks);
            if (endTimeStr) {
                const endTimeDiv = document.createElement('div');
                endTimeDiv.className = 'mediaInfoItem';
                endTimeDiv.textContent = `Ends at: ${endTimeStr}`;
                infoContainer.appendChild(endTimeDiv);
            }
        }

        // Append to miscInfoContainer
        if (infoContainer.children.length > 0) {
            miscInfoContainer.appendChild(infoContainer);
            LOG('Added series info to itemMiscInfo container');
        }
    }

    /**
     * Adds season info to the itemMiscInfo container
     * @param {Object} item - Season item object
     * @param {HTMLElement} miscInfoContainer - The .itemMiscInfo container
     * @param {HTMLElement} activePage - The active page element
     */
    async function addSeasonInfo(item, miscInfoContainer, activePage) {
        // Remove hide class if present
        if (miscInfoContainer.classList.contains('hide')) {
            miscInfoContainer.classList.remove('hide');
            LOG('Removed hide class from itemMiscInfo container');
        }

        // Check if already added
        if (miscInfoContainer.querySelector('.kt-season-info')) {
            LOG('Season info already added, skipping');
            return;
        }

        const infoContainer = document.createElement('div');
        infoContainer.className = 'kt-season-info';
        infoContainer.style.display = 'flex';

        // Episodes count
        const episodeCount = item.ChildCount || 0;
        if (episodeCount > 0) {
            const episodesDiv = document.createElement('div');
            episodesDiv.className = 'mediaInfoItem';
            episodesDiv.textContent = `${episodeCount} ${episodeCount === 1 ? 'Episode' : 'Episodes'}`;
            infoContainer.appendChild(episodesDiv);
        }

        // End time - extract from DOM episode runtimes
        const totalMinutes = await extractSeasonRuntimeFromDOM(activePage);
        if (totalMinutes > 0) {
            const endTimeStr = formatEndTimeFromMinutes(totalMinutes);
            if (endTimeStr) {
                const endTimeDiv = document.createElement('div');
                endTimeDiv.className = 'mediaInfoItem';
                endTimeDiv.textContent = `Ends at: ${endTimeStr}`;
                infoContainer.appendChild(endTimeDiv);
            }
        }

        // Append to miscInfoContainer
        if (infoContainer.children.length > 0) {
            miscInfoContainer.appendChild(infoContainer);
            LOG('Added season info to itemMiscInfo container');
        }
    }

    /**
     * Processes a details page for Series or Season items
     * @param {Object} item - The item object
     */
    async function processDetailsPage(item) {
        if (!item || (item.Type !== 'Series' && item.Type !== 'Season')) {
            return;
        }

        const activePage = document.querySelector('.libraryPage:not(.hide)');
        if (!activePage) {
            WARN('Active page not found');
            return;
        }

        // Find the itemMiscInfo container
        const miscInfoContainer = activePage.querySelector('.itemMiscInfo');
        if (!miscInfoContainer) {
            WARN('itemMiscInfo container not found');
            return;
        }

        LOG(`Processing ${item.Type} details page for: ${item.Name}`);

        if (item.Type === 'Series') {
            addSeriesInfo(item, miscInfoContainer);
        } else if (item.Type === 'Season') {
            await addSeasonInfo(item, miscInfoContainer, activePage);
        }
    }

    /**
     * Initialize the series info hook
     */
    function initializeSeriesInfoHook() {
        if (!window.KefinTweaksUtils || !window.KefinTweaksUtils.onViewPage) {
            WARN('KefinTweaksUtils.onViewPage not available, retrying in 1 second');
            setTimeout(initializeSeriesInfoHook, 1000);
            return;
        }

        LOG('Registering series info handler with KefinTweaksUtils');

        window.KefinTweaksUtils.onViewPage(
            async (view, element, hash, itemPromise) => {
                // Await the item promise to get the actual item data
                const item = await itemPromise;

                if (!item || (item.Type !== 'Series' && item.Type !== 'Season')) {
                    return;
                }

                // Small delay to ensure details DOM is ready
                setTimeout(() => {
                    processDetailsPage(item);
                }, 100);
            },
            {
                pages: ['details']
            }
        );

        LOG('Series info hook initialized');
    }

    // Initialize the hook when the script loads
    initializeSeriesInfoHook();

    console.log('[KefinTweaks SeriesInfo] Module loaded and ready');
})();

