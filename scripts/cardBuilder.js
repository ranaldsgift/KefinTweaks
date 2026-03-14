// Jellyfin Card Builder
// This module provides a main entry point function to build Jellyfin cards
// Usage: window.cardBuilder.buildCard(jellyfinItem)

(function() {
    'use strict';

    const state = {
        useEpisodeImages: false,
    };

    // Global toggle for progressive section fade-in.
    // Developers can set this to false to disable the behavior.
    const FADE_IN_SECTIONS = true;

    // Sliding window: render current slide + 4 prev + 4 next (9 total). As user navigates, remove/add slides.
    const SPOTLIGHT_WINDOW_PREV = 4;
    const SPOTLIGHT_WINDOW_NEXT = 4;

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

    function deduplicateItems(items) {
        const deduplicated = [];
        const ids = new Set();
        for (const item of items) {
            if (!item.ProviderIds) {
                deduplicated.push(item);
                continue;
            }

            if (item.ProviderIds.Imdb && ids.has(item.ProviderIds.Imdb)) continue;
            if (item.ProviderIds.Tmdb && ids.has(item.ProviderIds.Tmdb)) continue;
            if (item.ProviderIds.Tvdb && ids.has(item.ProviderIds.Tvdb)) continue;

            deduplicated.push(item);
            ids.add(item.ProviderIds.Imdb);
            ids.add(item.ProviderIds.Tmdb);
            ids.add(item.ProviderIds.Tvdb);
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
                 
        // Flatten Series Episodes
        if (sectionConfig.flattenSeries === true) {
            processed = flattenSeriesEpisodes(processed);
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

        // Process each query in the queries array
        for (const query of sectionConfig.queries) {
            let queryResult;
            
            if (query.dataSource) {
                // Handle cache-based data sources
                queryResult = await ApiHelper.fetchFromDataSource(query.dataSource, query.queryOptions || {}, false);
            } else {
                // Build and execute query
                const queryUrl = ApiHelper.buildQueryFromSection(query, userId, serverUrl, sectionConfig.renderMode === 'Spotlight');
                
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

    /**
     * Create refresh button for progressive sections
     * @param {Object} sectionConfig - Section configuration
     * @param {HTMLElement} sectionElement - The section element to refresh
     * @returns {HTMLElement} - The refresh button element
     */
    function createRefreshButton(sectionConfig, sectionElement) {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'section-refresh-button material-icons refresh';
        button.title = 'Refresh Section';
        button.setAttribute('aria-label', 'Refresh Section');
        
        // Click handler
        button.addEventListener('click', async (e) => {
            e.preventDefault();
            e.stopPropagation();
            
            // Set refreshing state
            sectionElement.dataset.refreshing = 'true';
            
            try {
                // Refresh the queries
                const freshItems = await refreshSectionQueries(sectionConfig);
                
                if (freshItems.length === 0) {
                    // If no items, remove section
                    sectionElement.remove();
                    return;
                }
                
                // Get card format from current section
                let finalCardFormat = sectionConfig.cardFormat;
                const currentCardFormat = sectionElement.getAttribute('data-card-format');
                if (currentCardFormat) {
                    finalCardFormat = currentCardFormat;
                }
                
                // Create new content
                let content = null;
                if (sectionConfig.spotlight || sectionConfig.renderMode === 'Spotlight') {
                    content = createSpotlightSection(freshItems, sectionConfig.name, { 
                        viewMoreUrl: sectionConfig.viewMoreUrl, 
                        ...sectionConfig.spotlightConfig
                    });
                } else {
                    content = createScrollableContainer(freshItems, sectionConfig.name, sectionConfig.viewMoreUrl, sectionConfig.overflowCard, finalCardFormat, sectionConfig.forcedImageType);
                }
                
                // Preserve all styles, classes, and attributes
                content.style.cssText = sectionElement.style.cssText;
                content.className = sectionElement.className;
                Array.from(sectionElement.attributes).forEach(attr => {
                    content.setAttribute(attr.name, attr.value);
                });
                
                // Preserve data-expanded state from old itemsContainer to new one
                const oldItemsContainer = sectionElement.querySelector('.itemsContainer');
                const newItemsContainer = content.querySelector('.itemsContainer');
                if (oldItemsContainer && newItemsContainer) {
                    const isExpanded = oldItemsContainer.getAttribute('data-expanded') === 'true';
                    if (isExpanded) {
                        newItemsContainer.setAttribute('data-expanded', 'true');
                        // Also update the show-all-button text if it exists
                        const showAllButton = content.querySelector('.show-all-button');
                        if (showAllButton) {
                            showAllButton.title = 'Show items in scrollable layout';
                        }
                        // Hide scroll buttons if they exist
                        const scrollButtons = content.querySelector('.emby-scrollbuttons');
                        if (scrollButtons) {
                            scrollButtons.style.display = 'none';
                        }
                    }
                }
                
                // Replace the section element
                sectionElement.replaceWith(content);
                //checkSectionOverflow(content, true);
                setTimeout(() => checkSectionOverflow(content, true), 150);

                // Add refresh button to new content
                const sectionTitleContainer = content.querySelector('.sectionTitleContainer');
                let newButton = null;
                if (sectionTitleContainer) {
                    newButton = createRefreshButton(sectionConfig, content);
                    sectionTitleContainer.appendChild(newButton);
                }
                
                // Set refreshing state to false
                content.dataset.refreshing = 'false';
                
                // Show checkmark on the new button
                if (newButton) {
                    showRefreshComplete(newButton);
                }
                
            } catch (error) {
                console.error('[KefinTweaks CardBuilder] Error refreshing section:', error);
                sectionElement.dataset.refreshing = 'false';
            }
        });
        
        return button;
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
        /**
         * Main entry point function to build a Jellyfin card
         * @param {Object} item - The Jellyfin item object
         * @param {boolean} overflowCard - Use overflow card classes instead of normal card classes
         * @param {string} cardFormat - Override card format: 'portrait', 'backdrop', 'thumb', or 'square'
         * @param {string} customFooterText - Optional custom footer text (e.g., air date for episodes)
         * @returns {HTMLElement} - The constructed card element
         */
        buildCard: function(item, overflowCard = false, cardFormat = null, customFooterText = null) {
            return createJellyfinCardElement(item, overflowCard, cardFormat, customFooterText);
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
        renderCards: function(items, title, viewMoreUrl = null, overflowCard = false, cardFormat = null, sortOrder = null, sortOrderDirection = 'Ascending', forcedImageType = null) {
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
            
            const container = createScrollableContainer(sortedItems, title, viewMoreUrl, overflowCard, finalCardFormat, forcedImageType);
            return container;
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
        renderProgressivelyEnhancedCards: async function(itemsPromise, title, viewMoreUrl = null, overflowCard = false, cardFormat = null, sortOrder = null, sortOrderDirection = 'Ascending', forcedImageType = null, minimumItems = -1) {
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
                const container = createScrollableContainer(items, title, viewMoreUrl, overflowCard, resolvedFormat, forcedImageType);
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
                const realContainer = createScrollableContainer(sortedItems, title, viewMoreUrl, overflowCard, resolvedFormat, forcedImageType);

                // Copy critical attributes to preserve layout/order
                if (skeletonContaineElement.style.order) {
                    realContainer.style.order = skeletonContainer.style.order;
                }
                if (skeletonContaineElement.hasAttribute('data-section-id')) {
                    realContainer.setAttribute('data-section-id', skeletonContainer.getAttribute('data-section-id'));
                }
                
                // Replace content of skeleton container with real content
                // This preserves the container element itself and its layout properties (like order)
                skeletonContaineElement.replaceWith(realContainer);
                checkSectionOverflow(realContainer, true);
                //setTimeout(() => checkSectionOverflow(realContainer, true), 150);
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
            const { revealSectionsSequentially = false, waitForContainerClass = null } = options;

            const renderProgressiveSectionsStartTime = performance.now();

            // Get the HTML for all of the progressive sections and append it to the container at once
            let sectionElements = [];
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
                
                // If the data is already available, we should render the section instead of the skeleton
                if (dataItems && dataItems.length > 0) {
                    let content = null;

                    if (sectionConfig.spotlight || sectionConfig.renderMode === 'Spotlight') {
                        content = createSpotlightSection(dataItems, sectionConfig.name, { 
                            viewMoreUrl: sectionConfig.viewMoreUrl, 
                            progressiveEnhancement: true,
                            ...sectionConfig.spotlightConfig
                        });
                    } else {
                        content = createScrollableContainer(dataItems, sectionConfig.name, sectionConfig.viewMoreUrl, sectionConfig.overflowCard, finalCardFormat, sectionConfig.forcedImageType);
                    }

                    content.setAttribute('data-section-id', sectionConfig.id);
                    content.style.order = sectionConfig.order;
                    content.dataset.order = sectionConfig.order;

                    if (sectionConfig.hideCardFooter === true) {
                        content.dataset.hideCardFooter = 'true';
                    }
                    
                    // Add refresh button to rendered section
                    const sectionTitleContainer = content.querySelector('.sectionTitleContainer');
                    if (sectionTitleContainer) {
                        const refreshButton = createRefreshButton(sectionConfig, content);
                        sectionTitleContainer.appendChild(refreshButton);
                    }
                    
                    sectionElements.push(content);
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
                    if (sectionConfig.viewMoreUrl) {
                        spotlightSettings.viewMoreUrl = sectionConfig.viewMoreUrl;
                    }
                    sectionElement = createSkeletonSpotlightSection(sectionConfig.name, spotlightSettings);
                } else {
                    sectionElement = createProgressivelyEnhancedScrollableContainer(sectionConfig.name, sectionConfig.viewMoreUrl, sectionConfig.cardFormat, sectionConfig.overflowCard);
                }
                sectionElement.setAttribute('data-section-id', sectionConfig.id);
                sectionElement.style.order = sectionConfig.order;

                if (sectionConfig.hideCardFooter === true) {
                    sectionElement.dataset.hideCardFooter = 'true';
                }
                //container.appendChild(sectionElement);
                
                // set section element content-visibility to hidden
                //sectionElement.style.contentVisibility = 'hidden';

                if (revealSectionsSequentially) {
                    sectionElement.classList.add('cardbuilder-section-reveal');
                    sectionElement.style.display = 'none';
                }

                sectionElements.push(sectionElement);
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

            container.appendChild(fragment);

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
                sectionElements.forEach(section => {
                    section.style.display = '';
                    observeSectionForReveal(section);
                });
            }

            for (let index = 0; index < sectionElements.length; index++) {
                const sectionStartTime = performance.now();

                const sectionElement = sectionElements[index];
                const section = await sections[index];

                section.result?.isStalePromise?.then(async isStale => {
                    if (isStale) {
                        // Add refreshing state to the section element
                        sectionElement.dataset.refreshing = 'true';
                        return;
                    }
                });

                section.result?.dataPromise?.then(async result => {
                    // Remove refreshing state from the section element
                    sectionElement.dataset.refreshing = 'false';

                    const sectionConfig = section.config;
                    let items = result?.Items ?? result ?? [];

                    // Check if the data is stale if it was previously available first
                    const dataItems = section.result?.data?.Items ?? section.result?.data ?? [];

                    let itemsMatch = true;

                    // Check if the items in the section are the same as the items in the data
                    const itemsInSection = sectionElement.querySelectorAll('.itemsContainer .card[data-id]');
                    
                    // Check that each item appears in order in the section by going through the itemsInSection and making sure the itemsInData index matches
                    for (let i = 0; i < itemsInSection.length; i++) {
                        const itemInSection = itemsInSection[i];
                        const item = items[i];
                        if (item && itemInSection && itemInSection.getAttribute('data-id') !== item.Id) {
                            itemsMatch = false;
                            break;
                        }
                    }

                    if (items.length !== dataItems.length) {
                        itemsMatch = false;
                    }

                    for (const item of items) {
                        const dataItem = dataItems.find(dataItem => dataItem.Id === item.Id);
                        if (!dataItem) {
                            itemsMatch = false;
                            break;
                        }

                        if (dataItem.UserData) {
                            for (const key in dataItem.UserData) {
                                if (dataItem.UserData[key] !== item.UserData[key]) {
                                    itemsMatch = false;
                                    break;
                                }
                            }
                        }
                    }

                    const shouldRefresh = !itemsMatch;

                    // If there are no items, remove any existing section element
                    if (items.length === 0) {
                        sectionElement.remove();
                        return;
                    }

                    if (!shouldRefresh) {
                        return;
                    }

                    let content = null;

                    let finalCardFormat = sectionConfig.cardFormat;

                    // Get card format from skeleton container
                    const skeletonCardFormat = sectionElement.getAttribute('data-card-format');
                    if (skeletonCardFormat) {
                        finalCardFormat = skeletonCardFormat;
                    }

                    //items = postProcessItems(sectionConfig, items);

                    if (sectionConfig.spotlight || sectionConfig.renderMode === 'Spotlight') {
                        content = createSpotlightSection(items, sectionConfig.name, { 
                            viewMoreUrl: sectionConfig.viewMoreUrl, 
                            ...sectionConfig.spotlightConfig
                        });
                    } else {
                        content = createScrollableContainer(items, sectionConfig.name, sectionConfig.viewMoreUrl, sectionConfig.overflowCard, finalCardFormat, sectionConfig.forcedImageType);
                    }

                    //content.setAttribute('data-section-id', sectionConfig.id);
                    //content.style.order = sectionConfig.order;
                    //content.setAttribute('data-card-format', finalCardFormat);
                    //content.style.contentVisibility = sectionElement.style.contentVisibility ?? 'hidden';

                    // Ensure all styles and classes and attributes are retained in the new content
                    content.style.cssText = sectionElement.style.cssText;
                    content.className = sectionElement.className;
                    Array.from(sectionElement.attributes).forEach(attr => {
                        content.setAttribute(attr.name, attr.value);
                    });

                    // Preserve data-expanded state from old itemsContainer to new one
                    const oldItemsContainer = sectionElement.querySelector('.itemsContainer');
                    const newItemsContainer = content.querySelector('.itemsContainer');
                    if (oldItemsContainer && newItemsContainer) {
                        const isExpanded = oldItemsContainer.getAttribute('data-expanded') === 'true';
                        if (isExpanded) {
                            newItemsContainer.setAttribute('data-expanded', 'true');
                            // Also update the show-all-button text if it exists
                            const showAllButton = content.querySelector('.show-all-button');
                            if (showAllButton) {
                                showAllButton.title = 'Show items in scrollable layout';
                            }
                            // Hide scroll buttons if they exist
                            const scrollButtons = content.querySelector('.emby-scrollbuttons');
                            if (scrollButtons) {
                                scrollButtons.style.display = 'none';
                            }
                        }
                    }

                    // Add refresh button to new content
                    const sectionTitleContainer = content.querySelector('.sectionTitleContainer');
                    if (sectionTitleContainer) {
                        const refreshButton = createRefreshButton(sectionConfig, content);
                        sectionTitleContainer.appendChild(refreshButton);
                    }

                    sectionElement.replaceWith(content);
                    // Update the scroll buttons for the new content
                    //updateScrollableContainerScrollButtons(content.querySelector('.emby-scroller'));

                    //checkSectionOverflow(content, true);
                    //setTimeout(() => checkSectionOverflow(content, true), 150);

                    // If revealSectionsSequentially is enabled and section hasn't been revealed yet, re-observe it
                    if (revealSectionsSequentially && content.classList.contains('cardbuilder-section-reveal') && !content.classList.contains('in-viewport')) {
                        observeSectionForReveal(content);
                    }
                });
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
                forcedImageType = null,
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
                    return createScrollableContainer(sortedItems, title, viewMoreUrl, overflowCard, resolvedFormat, forcedImageType);
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
                        /* checkSectionOverflow(content, true);
                        setTimeout(() => checkSectionOverflow(content, true), 150); */
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
        const pixels = blurhashDecode(blurhashString, w, h);
        if (!pixels) return false;
        const ctx = canvas.getContext('2d');
        if (!ctx) return false;
        const imageData = ctx.createImageData(w, h);
        imageData.data.set(pixels);
        ctx.putImageData(imageData, 0, 0);
        return true;
    }

    /**
     * Get blurhash string for the card image when the image is from the current item.
     * Mirrors the image URL logic; returns undefined when image comes from parent/series (we don't have their ImageBlurHashes).
     * @param {Object} item - Jellyfin item
     * @param {string|null} cardFormat - 'backdrop'|'square'|'portrait'|'poster'|'thumb'|null
     * @param {string|null} forcedImageType - e.g. 'Primary'
     * @returns {string|undefined} - Blurhash string or undefined
     */
    function getBlurhashForCard(item, cardFormat, forcedImageType) {
        const hashes = item.ImageBlurHashes;
        if (!hashes || typeof hashes !== 'object') return undefined;
        cardFormat = cardFormat?.toLowerCase() || null;
        forcedImageType = forcedImageType?.toLowerCase() || null;

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
            if (item.ImageTags?.Primary) return hashes.Primary?.[item.ImageTags.Primary];
            if (item.PrimaryImageTag) return hashes.Primary?.[item.PrimaryImageTag];
            if (item.ImageTags?.Thumb) return hashes.Thumb?.[item.ImageTags.Thumb];
            return undefined;
        }
        if (cardFormat === 'thumb') {
            if (forcedImageType && state.useEpisodeImages && item.Type === 'Episode' && item.ImageTags?.Primary)
                return hashes.Primary?.[item.ImageTags.Primary];
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

    /**
     * Creates a Jellyfin card element from an item
     * @param {Object} item - The Jellyfin item object
     * @param {boolean} overflowCard - Use overflow card classes instead of normal card classes
     * @param {string} cardFormat - Override card format: 'portrait', 'backdrop', 'thumb', or 'square'
     * @param {string} customFooterText - Optional custom footer text (e.g., air date for episodes)
     * @param {string} forcedImageType - Force specific image type (e.g., 'Primary')
     * @returns {HTMLElement} - The constructed card element
     */
    function createJellyfinCardElement(item, overflowCard = false, cardFormat = null, customFooterText = null, forcedImageType = null) {
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
        cardFormat = cardFormat?.toLowerCase() || null;
        forcedImageType = forcedImageType?.toLowerCase() || null;

        // Use custom footer text from item property if not explicitly provided
        if (!customFooterText && item.CustomFooterText) {
            customFooterText = item.CustomFooterText;
        }

        if (cardFormat) {
            // Use specified cardFormat
            if (cardFormat === 'backdrop' || cardFormat === 'thumb' || cardFormat === 'logo' || cardFormat === 'clear art' || forcedImageType) {
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
                // portrait (default)
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
        
        // Create the main card container
        const card = document.createElement('div');
        card.className = `card ${cardClass} card-hoverable card-withuserdata`;
        card.setAttribute('data-index', '0');
        card.setAttribute('data-isfolder', itemType === 'MusicAlbum' || itemType === 'Artist' ? 'true' : 'false');
        card.setAttribute('data-serverid', serverId);
        if (!isCustomCard) card.setAttribute('data-id', itemId);
        if (isCustomCard) card.setAttribute('data-custom-card', 'true');
        card.setAttribute('data-type', itemType);
        const mediaType = item.MediaType === 'Unknown' && item.ChannelId ? 'Video' : item.MediaType;
        card.setAttribute('data-mediatype', mediaType || 'Video');

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
        if (itemType === 'Movie') {
            cardIcon.textContent = 'movie';
        } else if (itemType === 'Series') {
            cardIcon.textContent = 'tv';
        } else if (itemType === 'Episode') {
            cardIcon.textContent = 'play_circle';
        } else if (itemType === 'MusicAlbum') {
            cardIcon.textContent = 'album';
        } else if (itemType === 'Audio') {
            cardIcon.textContent = 'music_note';
        } else if (itemType === 'Artist') {
            cardIcon.textContent = 'person';
        } else {
            cardIcon.textContent = 'folder';
        }
        
        cardPadder.appendChild(cardIcon);

        // Blurhash canvas (placeholder) – will be filled and shown when we have a blurhash
        const blurhashCanvas = document.createElement('canvas');
        blurhashCanvas.setAttribute('aria-hidden', 'true');
        blurhashCanvas.width = 20;
        blurhashCanvas.height = 20;
        // lazy-hidden only when we have no blurhash (grey card until image loads)
        blurhashCanvas.className = 'blurhash-canvas';

        let cardUrl = item.cardUrl || `${ApiClient._serverAddress}/web/#/details?id=${itemId}&serverId=${serverId}`;

        if (!item.cardUrl && itemType === 'Genre') {
            const parentParam = item.ParentId ? `&parentId=${item.ParentId}` : '';
            cardUrl = `${ApiClient._serverAddress}/web/#/list.html?genreId=${item.Id}&serverId=${serverId}${parentParam}`;
        }

        // Card image container
        const cardImageContainer = document.createElement('a');
        cardImageContainer.href = cardUrl;
        cardImageContainer.className = 'cardImageContainer coveredImage cardContent itemAction lazy blurhashed lazy-image-fadein-fast';
        cardImageContainer.setAttribute('data-action', 'link');
        cardImageContainer.setAttribute('aria-label', item.Name || 'Unknown');

        // Force specific image if card format is specified
/*         if (forcedImageType === 'Primary' && item.ImageTags?.Primary) {
             const imageUrl = `${serverAddress}/Items/${item.Id}/Images/Primary?${imageParams}&quality=96&tag=${item.ImageTags.Primary}`;
             cardImageContainer.style.backgroundImage = `url("${imageUrl}")`;
        } else  */
        let imageUrl = '';

        const hasCustomImages = item.posterUrl || item.thumbUrl || item.squareUrl || item.imageUrl;

        const imageItem = item.Type === 'Timer' ? item.ProgramInfo : item;

        if (hasCustomImages) {
            if (cardFormat === 'backdrop' || cardFormat === 'thumb') {
                imageUrl = `${item.thumbUrl || item.imageUrl || item.posterUrl || item.squareUrl}`;
            } else if (cardFormat === 'square') {
                imageUrl = `${item.squareUrl || item.imageUrl || item.posterUrl || item.thumbUrl}`;
            } else {
                // portrait/poster or default
                imageUrl = `${item.posterUrl || item.imageUrl || item.thumbUrl || item.squareUrl}`;
            }
        } else if (cardFormat === 'backdrop') {
            if (item.BackdropImageTags[0]) {
                imageUrl = `${serverAddress}/Items/${item.Id}/Images/Backdrop?${imageParams}&quality=96&tag=${item.BackdropImageTags[0]}`;
            } else if (item.ParentBackdropImageTags && item.ParentBackdropImageTags[0]) {
                imageUrl = `${serverAddress}/Items/${item.ParentBackdropItemId}/Images/Backdrop?${imageParams}&quality=96&tag=${item.ParentBackdropImageTags[0]}`;
            } else if (item.ImageTags?.Thumb) {
                imageUrl = `${serverAddress}/Items/${item.Id}/Images/Thumb?${imageParams}&quality=96&tag=${item.ImageTags?.Thumb}`;
            } else {
                imageUrl = `${serverAddress}/Items/${item.Id}/Images/Primary?${imageParams}&quality=96&tag=${item.ImageTags?.Primary}`;
            }
        } else if (cardFormat === 'square') {
            if (item.Type === 'Season' || item.Type === 'Series' || item.Type === 'Movie') {
                imageUrl = item.BackdropImageTags && item.BackdropImageTags[0] ? `${serverAddress}/Items/${item.Id}/Images/Backdrop?${imageParams}&quality=96&tag=${item.BackdropImageTags[0]}` : item.ImageTags?.Primary ? `${serverAddress}/Items/${item.Id}/Images/Primary?${imageParams}&quality=96&tag=${item.ImageTags?.Primary}` : '';
            } else if (item.ImageTags?.Primary) {
                imageUrl = `${serverAddress}/Items/${item.Id}/Images/Primary?${imageParams}&quality=96&tag=${item.ImageTags?.Primary}`;
            } else if (item.PrimaryImageTag) { 
                imageUrl = `${serverAddress}/Items/${item.Id}/Images/Primary?${imageParams}&quality=96&tag=${item.PrimaryImageTag}`;
            } else if (item.SeriesPrimaryImageTag) {
                imageUrl = `${serverAddress}/Items/${item.Id}/Images/Primary?${imageParams}&quality=96&tag=${item.SeriesPrimaryImageTag}`;
            } else if (item.BackdropImageTags && item.BackdropImageTags[0]) {
                imageUrl = `${serverAddress}/Items/${item.Id}/Images/Backdrop?${imageParams}&quality=96&tag=${item.BackdropImageTags[0]}`;
            } else if (item.ImageTags?.Thumb) {
                imageUrl = `${serverAddress}/Items/${item.Id}/Images/Thumb?${imageParams}&quality=96&tag=${item.ImageTags?.Thumb}`;
            }
        } else if (cardFormat === 'portrait' || cardFormat === 'poster') {
            if (item.Type === 'Episode' && item.SeriesPrimaryImageTag) {
                imageUrl = `${serverAddress}/Items/${item.SeriesId}/Images/Primary?${imageParams}&quality=96&tag=${item.SeriesPrimaryImageTag}`;                
            } else if (item.ImageTags?.Primary) {
                imageUrl = `${serverAddress}/Items/${item.Id}/Images/Primary?${imageParams}&quality=96&tag=${item.ImageTags?.Primary}`;
            } else if (item.PrimaryImageTag) {
                imageUrl = `${serverAddress}/Items/${item.Id}/Images/Primary?${imageParams}&quality=96&tag=${item.PrimaryImageTag}`;
            } else if (item.ImageTags?.Thumb) {
                imageUrl = `${serverAddress}/Items/${item.Id}/Images/Thumb?${imageParams}&quality=96&tag=${item.ImageTags?.Thumb}`;
            }
        } else if (cardFormat === 'thumb') {
            if (forcedImageType && state.useEpisodeImages && item.Type === 'Episode') {
                // Explicit override for episodes – always use the episode's primary image
                imageUrl = `${serverAddress}/Items/${item.Id}/Images/Primary?${imageParams}&quality=96&tag=${item.ImageTags?.Primary}`;
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
        } else if (cardFormat === 'banner' && item.ImageTags?.Banner) {
            imageUrl = `${serverAddress}/Items/${item.Id}/Images/Banner?${imageParams}&quality=96&tag=${item.ImageTags.Banner}`;
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
            
        } else {
            // No image - add icon as inner element
            const iconSpan = document.createElement('span');
            iconSpan.className = 'cardImageIcon material-icons';
            iconSpan.setAttribute('aria-hidden', 'true');
            
            // Set icon based on item type
            if (item.Type === 'Movie') {
                iconSpan.textContent = 'movie';
            } else if (item.Type === 'Series') {
                iconSpan.textContent = 'tv';
            } else if (item.Type === 'Episode') {
                iconSpan.textContent = 'tv';
            } else if (item.Type === 'Person') {
                iconSpan.textContent = 'person';
            } else if (item.Type === 'MusicAlbum') {
                iconSpan.textContent = 'album';
            } else if (item.Type === 'Audio') {
                iconSpan.textContent = 'music_note';
            } else if (item.Type === 'Artist' || item.Type === 'MusicArtist') {
                iconSpan.textContent = 'person';
            } else {
                iconSpan.textContent = 'folder';
            }
            
            cardImageContainer.appendChild(iconSpan);
        }

        const blurhashStr = !item.imageUrl ? getBlurhashForCard(item, cardFormat, forcedImageType) : null;
        if (!blurhashStr || cardFormat === 'logo' || cardFormat === 'clear art' || cardFormat === 'disc') {
            blurhashCanvas.classList.add('lazy-hidden');
        } else {
            // Draw blurhash immediately so placeholder is visible ASAP (canvas is behind cardImageContainer)
            if (!drawBlurhashToCanvas(blurhashCanvas, blurhashStr)) {
                blurhashCanvas.classList.add('lazy-hidden');
            } else {
                // Hide the image container so the blurhash canvas shows until the real image loads
                cardImageContainer.classList.add('lazy-hidden');
            }
        }

        if (imageUrl) {
            // Use data-src for lazy loading instead of immediate backgroundImage
            cardImageContainer.setAttribute('data-src', imageUrl);
            if (blurhashStr) cardImageContainer.setAttribute('data-blurhash', blurhashStr);
            // Add lazy class for styling/selection
            cardImageContainer.classList.add('lazy');
        }
        //countIndicator indicator

        if (!isCustomCard) {
            const cardIndicators = document.createElement('div');
            cardIndicators.className = 'cardIndicators';

            if (item.UserData?.Played) {
                const playedIndicator = document.createElement('div');
                playedIndicator.className = 'playedIndicator indicator';
                const playedIndicatorIcon = document.createElement('span');
                playedIndicatorIcon.className = 'material-icons indicatorIcon check';
                playedIndicatorIcon.setAttribute('aria-hidden', 'true');
                playedIndicator.appendChild(playedIndicatorIcon);
                cardIndicators.appendChild(playedIndicator);
            }

            if (item.UserData?.UnplayedItemCount && item.UserData?.UnplayedItemCount > 0) {
                const unplayedIndicator = document.createElement('div');
                unplayedIndicator.className = 'countIndicator indicator';
                unplayedIndicator.textContent = item.UserData?.UnplayedItemCount;
                cardIndicators.appendChild(unplayedIndicator);
            }

            if (item.LocationType === 'Virtual') {
                const virtualIndicator = document.createElement('div');
                virtualIndicator.className = 'missingIndicator';
                virtualIndicator.textContent = 'Missing';
                cardIndicators.appendChild(virtualIndicator);
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

            cardOverlayContainer.appendChild(playButton);
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
            titleLink.setAttribute('data-isfolder', itemType === 'MusicAlbum' || itemType === 'Artist' || itemType === 'MusicArtist' ? 'true' : 'false');
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

        cardBox.appendChild(cardScalable);
        cardBox.appendChild(cardTextFragment);
        
        card.appendChild(cardBox);

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
            cycleBackdropsTime = 10000,
            entranceAnimationFirst = 'fadeIn',
            entranceAnimationSecond = 'fadeIn',
            entranceAnimationThird = 'fadeIn',
            slideAnimationFirst = 'kenBurnsZoomIn',
            slideAnimationSecond = 'kenBurnsZoomIn',
            slideAnimationThird = 'kenBurnsZoomIn',
            viewMoreUrl = null
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
        const serverId = ApiClient.serverId();
        const serverAddress = ApiClient.serverAddress();
        const sectionKey = 'spotlight_' + Date.now() + '_' + Math.random().toString(36).slice(2, 9);
        const cycleBackdropMap = new Map();
        let currentIndex = 0;
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
        
        // Add section title in top left corner (absolute positioning, aligned with controls)
        if (title) {
            let sectionTitleEl;
            
            if (viewMoreUrl) {
                // Create clickable title
                const titleLink = document.createElement('a');
                titleLink.className = 'emby-tab-button emby-tab-button-active emby-button-foreground';
                titleLink.textContent = title;
                titleLink.title = 'See All';
                titleLink.style.textDecoration = 'none';
                
                // Handle both URL and function
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
                // Regular non-clickable title
                sectionTitleEl = document.createElement('div');
                sectionTitleEl.className = 'emby-tab-button emby-tab-button-active emby-button-foreground';
                sectionTitleEl.textContent = title;
            }

            const sectionTitleWrapper = document.createElement('div');
            sectionTitleWrapper.className = `spotlight-section-title ${viewMoreUrl ? '' : 'spotlight-title-link '}headerTabs sectionTabs`;
            sectionTitleWrapper.appendChild(sectionTitleEl);

            const sectionTitleContainer = document.createElement('div');
            sectionTitleContainer.className = 'spotlight-section-title-container';
            sectionTitleContainer.appendChild(sectionTitleWrapper);
            
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
        let currentWindowIndices = getSpotlightWindowIndices(0, items.length);

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
                group.className = 'headerTabs sectionTabs';
                const item = document.createElement(tag);
                item.className = 'emby-tab-button' + (extraClasses ? ' ' + extraClasses : '');
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
                container.className = 'spotlight-truncated-list headerTabs sectionTabs';
                container.setAttribute('data-label', label);
                if (icon) container.setAttribute('data-icon', icon);

                if (!items || items.length === 0) {
                    return container;
                }
                
                const displayContainer = document.createElement('span');
                displayContainer.className = 'emby-tab-button';
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
            taglineEl.className = 'emby-tab-button';
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
            playButton.className = 'emby-button submit-button raised button-flat btnPlay detailButton';
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
            watchlistButton.className = 'emby-button button-flat';
            
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
                ratingContainer.className = 'starRatingContainer mediaInfoItem spotlight-rating-container';
                
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

        // Initial render: create slides for window around index 0
        currentWindowIndices.forEach((idx) => {
            createAndAppendSlide(items[idx], idx, idx === 0);
        });
        
        bannerContainer.appendChild(itemsContainer);

        // Mark the initially visible slide (index 0) as active so only it is shown
        const firstItemActive = bannerContainer.querySelector('.spotlight-item[data-index="0"]');
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

        // Apply initial pan animation to first slide (helper also sets up completion tracking)
        if (panAnimation && items.length > 0) {
            const firstItemPan = bannerContainer.querySelector('.spotlight-item[data-index="0"]');
            if (firstItemPan) {
                applyPanAnimationToSlide(firstItemPan);
                startCycleBackdropTimer(firstItemPan, items[0].Id);
            }
        }
        
        // Navigation buttons (top right)
        if (showNavButtons && items.length > 1) {
            const navButtonsContainer = document.createElement('div');
            navButtonsContainer.className = 'spotlight-nav-buttons-container emby-tab-button emby-tab-button-active';
            
            const prevButton = document.createElement('button');
            prevButton.className = 'spotlight-nav-button spotlight-nav-prev emby-button';
            const prevIcon = document.createElement('span');
            prevIcon.className = 'material-icons emby-button-foreground';
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
            nextIcon.className = 'material-icons emby-button-foreground';
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
        
        // Pause button (bottom right)
        if (autoPlay && items.length > 1) {
            const navButtonsContainer = bannerContainer.querySelector('.spotlight-nav-container .spotlight-nav-buttons-container');
            const pauseButton = document.createElement('button');
            pauseButton.className = 'spotlight-pause-button spotlight-nav-button emby-button';
            const pauseIcon = document.createElement('span');
            pauseIcon.className = 'material-icons emby-button-foreground';
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
        
        // Slide state container (dots or numeric "N / X")
        const MAX_DOTS = 5;
        if (showSlideState && items.length > 1) {
            const dotsContainer = document.createElement('div');
            dotsContainer.className = 'spotlight-dots' + (showDots ? '' : ' spotlight-dots-numeric');
            dotsContainer.setAttribute('data-index', '1'); /* 1-based for "N / X" display */
            dotsContainer.setAttribute('data-total-items', String(items.length));
            
            if (showDots) {
                const numDots = Math.min(items.length, MAX_DOTS);
                for (let i = 0; i < numDots; i++) {
                    const dot = document.createElement('button');
                    dot.className = 'spotlight-dot' + (i === 0 ? ' active' : '');
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
            kenBurnsPanRight: 'scale3d(1.1, 1.1, 1) translateX(2%)',
            kenBurnsPanLeft: 'scale3d(1.1, 1.1, 1) translateX(-2%)',
            kenBurnsPanUp: 'scale3d(1.1, 1.1, 1) translateY(-2%)',
            kenBurnsDiagonal: 'scale3d(1.13, 1.13, 1) translate(2%, -2%)',
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
            var maxCycles = Math.max(0, Math.ceil(interval / cycleBackdropsTime) - 1);
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
                }, cycleBackdropsTime);
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
                }, cycleBackdropsTime);
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

    /**
     * Check if a section's items overflow the scroller and set data-expandable for show-all button visibility.
     * Can be called for any .emby-scroller-container that contains .itemsContainer (e.g. when section is detected in DOM).
     * @param {HTMLElement} verticalSection - Section element (emby-scroller-container)
     * @param {boolean} forceUpdate - If true, update even when data-expandable is already set (e.g. on resize)
     */
    function checkSectionOverflow(verticalSection, forceUpdate = false) {
        return;
        if (!verticalSection || verticalSection.nodeType !== 1) return;
        const itemsContainer = verticalSection.querySelector('.itemsContainer');
        const scroller = verticalSection.querySelector('.emby-scroller');
        if (!itemsContainer || !scroller) return;
        if (!forceUpdate && verticalSection.hasAttribute('data-expandable')) return;
        const hasOverflow = itemsContainer.scrollWidth > scroller.clientWidth;
        verticalSection.setAttribute('data-expandable', hasOverflow ? 'true' : 'false');
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
    function createScrollableContainer(items, title, viewMoreUrl = null, overflowCard = false, cardFormat = null, forcedImageType = null) {        
        // Create the main vertical section container
        const verticalSection = document.createElement('div');
        verticalSection.className = 'verticalSection emby-scroller-container custom-scroller-container';
        
        // Persist the card format if provided (ensures consistency for random/updates)
        if (cardFormat) {
            verticalSection.setAttribute('data-card-format', cardFormat);
        }

        // Create section title
        const sectionTitleContainer = document.createElement('div');
        sectionTitleContainer.className = 'sectionTitleContainer sectionTitleContainer-cards padded-left';
        
        if (viewMoreUrl) {
            // Create clickable title with chevron icon
            const titleLink = document.createElement('a');
            titleLink.className = 'sectionTitle-link button-flat button-flat-mini sectionTitleTextButton emby-button';
            titleLink.style.cssText = 'text-decoration: none; cursor: pointer; display: flex; align-items: center;';
            
            // Handle both URL and function
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
            sectionTitleContainer.appendChild(titleLink);
        } else {
            // Regular non-clickable title            
            const titleText = document.createElement('h2');
            titleText.className = 'sectionTitle sectionTitle-cards';
            titleText.textContent = title;
            sectionTitleContainer.appendChild(titleText);
        }

        // Create "Show All" button (always created, shown/hidden based on data-expandable attribute)
        const showAllButton = document.createElement('button');
        showAllButton.type = 'button';
        showAllButton.className = 'show-all-button';
        showAllButton.title = 'Show all items';
        sectionTitleContainer.appendChild(showAllButton);

        // Create scroller container
        const scroller = document.createElement('div');
        //scroller.setAttribute('is', 'emby-scroller');

        const isMobile = document.documentElement.classList.contains('layout-mobile');

        scroller.setAttribute('data-horizontal', 'true');
        scroller.setAttribute('data-centerfocus', 'card');
        scroller.className = `padded-top-focusscale padded-bottom-focusscale emby-scroller custom-scroller${isMobile ? ' scrollX hiddenScrollX' : ''}`;
        scroller.setAttribute('data-scroll-mode-x', 'custom');
        // Enable mobile swipe scrolling
        scroller.style.scrollSnapType = 'none';
		// Allow both axes so vertical page scroll isn't blocked when gesture starts over the scroller
		scroller.style.touchAction = 'auto';
		// Keep horizontal scroll self-contained but allow vertical to bubble to page
		scroller.style.overscrollBehaviorX = 'contain';
		scroller.style.overscrollBehaviorY = 'auto';
		// iOS inertia scrolling
		scroller.style.webkitOverflowScrolling = 'touch';
		scroller.style.setProperty('--scroll-x', '0');

        // Create items container
        const itemsContainer = document.createElement('div');
        itemsContainer.setAttribute('is', 'emby-itemscontainer');
        itemsContainer.className = `focuscontainer-x itemsContainer scrollSlider${!isMobile ? ' animatedScrollX' : ''}`;
        itemsContainer.style.whiteSpace = 'nowrap';

        // If the items contain more episodes than non-episodes, and the card format is Poster, set the forced image type to Primary
        if (items.filter(item => item.Type === 'Episode').length > items.filter(item => item.Type !== 'Episode').length && cardFormat === 'Poster') {
            forcedImageType = 'Primary';
        }

        // Add items to container
        items.forEach((item, index) => {
            const card = createJellyfinCardElement(item, overflowCard, cardFormat, null, forcedImageType);
            card.setAttribute('data-index', index);
            itemsContainer.appendChild(card);
        });

        scroller.appendChild(itemsContainer);

        // Create the left/right scroll buttons for the scroller

        const scrollButtons = document.createElement('div');
        //scrollButtons.setAttribute('is', 'emby-scrollbuttons');
        scrollButtons.className = 'emby-scrollbuttons padded-right';

        const leftButton = document.createElement('button');
        leftButton.type = 'button';
        //leftButton.setAttribute('is', 'paper-icon-button-light');
        leftButton.setAttribute('data-ripple', 'false');
        leftButton.setAttribute('data-direction', 'left');
        leftButton.setAttribute('title', 'Previous');
        leftButton.className = 'emby-scrollbuttons-button paper-icon-button-light';
        leftButton.disabled = true;
        const leftSpan = document.createElement('span');
        leftSpan.className = 'material-icons chevron_left';
        leftSpan.setAttribute('aria-hidden', 'true');
        leftButton.appendChild(leftSpan);

        // Shared helpers for translateX-based scrolling
        function getCurrentPosition() {
            const v = scroller.style.getPropertyValue('--scroll-x');
            if (v !== '' && !isNaN(parseFloat(v))) return parseFloat(v);
            const matrix = new DOMMatrixReadOnly(window.getComputedStyle(scroller).transform);
            const translateX = matrix.m41 || 0;
            return Math.abs(translateX);
        }

        function getMaxPosition() {
            // Ensure we scroll enough to see the last card
            return scroller.scrollWidth - scroller.clientWidth + 300;
        }

        function setPosition(newPosition, options) {
            const opts = options || {};
            const maxPosition = getMaxPosition();
            const clampedPosition = Math.min(Math.max(newPosition, 0), Math.max(maxPosition, 0));

            // Control whether movement is animated or immediate
            if (opts.animate) {
                scroller.style.transition = 'transform 270ms ease-out';
            } else {
                scroller.style.transition = 'none';
            }

            scroller.style.transform = `translateX(-${clampedPosition}px)`;
            scroller.style.setProperty('--scroll-x', String(clampedPosition));
            scroller.setAttribute('data-max-scroll', clampedPosition >= maxPosition ? 'true' : 'false');

            const verticalSection = scroller.closest('.emby-scroller-container');
            if (verticalSection && typeof updateScrollButtonStateForSection === 'function') {
                if (opts.animate) {
                    const onTransitionEnd = () => {
                        scroller.removeEventListener('transitionend', onTransitionEnd);
                        updateScrollButtonStateForSection(verticalSection);
                    };
                    scroller.addEventListener('transitionend', onTransitionEnd);
                } else {
                    requestAnimationFrame(() => updateScrollButtonStateForSection(verticalSection));
                }
            }
        }

        leftButton.addEventListener('click', () => {
            // Scroll backward by viewport width
            const itemsContainer = scroller.querySelector('.itemsContainer');
            if (!itemsContainer) return;
            const scrollAmount = itemsContainer.clientWidth;

            const currentPosition = getCurrentPosition();
            const newPosition = scrollAmount > currentPosition ? 0 : currentPosition - scrollAmount;

            setPosition(newPosition, { animate: true });
        });

        scrollButtons.appendChild(leftButton);

        const rightButton = document.createElement('button');
        rightButton.type = 'button';
        //rightButton.setAttribute('is', 'paper-icon-button-light');
        rightButton.setAttribute('data-ripple', 'false');
        rightButton.setAttribute('data-direction', 'right');
        rightButton.setAttribute('title', 'Next');
        rightButton.className = 'emby-scrollbuttons-button paper-icon-button-light';
        const rightSpan = document.createElement('span');
        rightSpan.className = 'material-icons chevron_right';
        rightSpan.setAttribute('aria-hidden', 'true');
        rightButton.appendChild(rightSpan);

        rightButton.addEventListener('click', () => {
            const itemsContainer = scroller.querySelector('.itemsContainer');

            if (!itemsContainer) return;

            const scrollAmount = itemsContainer.clientWidth;

            const currentPosition = getCurrentPosition();
            const newPosition = currentPosition + scrollAmount;

            setPosition(newPosition, { animate: true });
        });

        scrollButtons.appendChild(rightButton);

        // Update button states based on scroll position
        function updateScrollButtons() {
            const currentPosition = getCurrentPosition();
            const maxPosition = getMaxPosition();

            // Disable left button at start
            leftButton.disabled = currentPosition === 0;

            // Disable right button at end
            rightButton.disabled = currentPosition >= maxPosition;
        }

        // Update on resize (for responsive layouts)
        /* const resizeObserver = new ResizeObserver(() => updateScrollButtons());
        resizeObserver.observe(scroller); */

        // Initial button state on creation
        //updateScrollButtons();

        // Call updateScrollButtons when the container is added to the DOM
        /* verticalSection.addEventListener('DOMContentLoaded', () => {
            updateScrollButtons();
        }); */
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
            // Movement threshold (px) before we treat the gesture as a drag. Avoids getMaxPosition/layout work on simple clicks.
            const DRAG_THRESHOLD_PX = 8;

            // Touch and drag support (translateX-based). Expensive drag setup runs only after pointer moves past threshold.
            function onPointerDown(e) {
                // Only handle left mouse button for drag (button 0)
                if (e.type === 'mousedown' && e.button !== 0) {
                    return;
                }

                const point = e.touches ? e.touches[0] : e;

                // Cancel any existing momentum animation
                if (dragState.momentumId !== null) {
                    cancelAnimationFrame(dragState.momentumId);
                    dragState.momentumId = null;
                }

                // Store only cheap state until we know it's a drag
                dragState.startX = point.clientX;
                dragState.startY = point.clientY;
                dragState.isDragging = false;

                function checkThreshold(moveEvent) {
                    const p = moveEvent.touches ? moveEvent.touches[0] : moveEvent;
                    const dx = p.clientX - dragState.startX;
                    const dy = p.clientY - dragState.startY;
                    if (Math.abs(dx) < DRAG_THRESHOLD_PX && Math.abs(dy) < DRAG_THRESHOLD_PX) return;

                    // Committing to drag: do expensive work once
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

                function onPointerUp(upEvent) {
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
                console.log('onDragMove', dragState.currentPosition);
                if (!dragState.isDragging) return;
                
                const point = e.touches ? e.touches[0] : e;
                const deltaX = dragState.startX - point.clientX;
                const deltaY = dragState.startY - point.clientY;
                
                // Directional check: require horizontal movement to be dominant
                // Only trigger horizontal scroll if:
                // 1. Moved more than 10px horizontally (increased threshold)
                // 2. Horizontal movement is greater than vertical movement (directional check)
                if (Math.abs(deltaX) > 10 && Math.abs(deltaX) > Math.abs(deltaY) * 1.5) {
                    dragState.hasMoved = true;

                    const rawNewPosition = dragState.startPosition + deltaX;
                    // Clamp using cached maxPosition to avoid repeated layout work
                    const clampedPosition = Math.min(Math.max(rawNewPosition, 0), Math.max(dragState.maxPosition, 0));
                    dragState.currentPosition = clampedPosition;

                    setPosition(clampedPosition, { animate: false });
                    
                    // Calculate velocity for momentum scrolling
                    const currentTime = Date.now();
                    const timeDelta = currentTime - dragState.lastTime;
                    if (timeDelta > 0) {
                        const positionDelta = point.clientX - dragState.lastX;
                        dragState.velocity = positionDelta / timeDelta; // pixels per millisecond
                    }
                    dragState.lastX = point.clientX;
                    dragState.lastTime = currentTime;
                    
                    // Prevent default to stop page scrolling on touch
                    if (e.touches) {
                        e.preventDefault();
                    }
                }
            }

            function onDragEnd(e) {
                console.log('onDragEnd', dragState.currentPosition);
                if (!dragState.isDragging) return;
                
                // Clean up listeners
                if (e.type === 'touchend') {
                    document.removeEventListener('touchmove', onDragMove);
                    document.removeEventListener('touchend', onDragEnd);
                } else {
                    document.removeEventListener('mousemove', onDragMove);
                    document.removeEventListener('mouseup', onDragEnd);
                }
                
                // If user dragged, prevent click events from firing
                if (dragState.hasMoved) {
                    // Temporarily disable clicks on the scroller
                    scroller.style.pointerEvents = 'none';
                    requestAnimationFrame(() => {
                        scroller.style.pointerEvents = '';
                    });
                }
                
                dragState.isDragging = false;
                
                // Apply momentum scrolling if there's sufficient velocity
                // Tunable constants to better match native Jellyfin inertia
                const friction = 0.965; // Higher = slides longer
                const velocityThreshold = 0.01; // pixels per millisecond
                const velocityBoost = 2.0; // Scale swipe strength to increase carry distance
                
                // Boost the measured velocity before starting momentum to increase travel distance
                dragState.velocity *= velocityBoost;

                if (Math.abs(dragState.velocity) > velocityThreshold) {
                    let currentPosition = dragState.currentPosition;
                    const maxPosition = dragState.maxPosition;
                    let lastTimestamp = 0;

                    const step = (timestamp) => {
                        // Compute frame time in ms using rAF timestamp
                        const frameTime = lastTimestamp ? (timestamp - lastTimestamp) : 16;
                        lastTimestamp = timestamp;

                        if (Math.abs(dragState.velocity) > velocityThreshold) {
                            currentPosition -= dragState.velocity * frameTime;

                            // Clamp locally to avoid extra layout work
                            currentPosition = Math.min(Math.max(currentPosition, 0), Math.max(maxPosition, 0));
                            setPosition(currentPosition, { animate: false });

                            // If we've hit an edge, stop the momentum
                            if (currentPosition === 0 || currentPosition === maxPosition) {
                                dragState.velocity = 0;
                                dragState.momentumId = null;
                                return;
                            }

                            dragState.velocity *= friction; // Apply deceleration
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

            // Attach drag start listeners (threshold inside onPointerDown defers getMaxPosition until real drag)
            scroller.addEventListener('mousedown', onPointerDown);

        }

        // Overflow detection will be handled by ResizeObserver below

        // Toggle between scroll and grid view
        showAllButton.addEventListener('click', () => {
            const performanceTimerStart = performance.now();

            // Find the scroll buttons for this container
            const scrollerContainer = showAllButton.closest('.emby-scroller-container');

            const performanceTimerEnd = performance.now();
            const performanceTime = performanceTimerEnd - performanceTimerStart;
            console.log(`[KefinTweaks CardBuilder] Time to find scroller container: ${performanceTime}ms`);

            const performanceTimerStart2 = performance.now();

            const scrollButtons = scrollerContainer ? scrollerContainer.querySelector('.emby-scrollbuttons') : null;
        
            const performanceTimerEnd2 = performance.now();
            const performanceTime2 = performanceTimerEnd2 - performanceTimerStart2;
            console.log(`[KefinTweaks CardBuilder] Time to find scroll buttons: ${performanceTime2}ms`);

            const performanceTimerStart3 = performance.now();

            const isExpanded = itemsContainer.getAttribute('data-expanded') === 'true';

            if (isExpanded) {
                // Switch back to scroll view
                itemsContainer.removeAttribute('data-expanded');
                if (scrollButtons) scrollButtons.style.display = '';
                showAllButton.title = 'Show all items in a grid layout';
                setPosition(dragState.currentPosition, { animate: true });
            } else {
                // Switch to grid view
                dragState.currentPosition = getCurrentPosition();
                setPosition(0, { animate: false });
                itemsContainer.setAttribute('data-expanded', 'true');
                if (scrollButtons) scrollButtons.style.display = 'none';
                showAllButton.title = 'Show items in scrollable layout';
            }

            const performanceTimerEnd3 = performance.now();
            const performanceTime3 = performanceTimerEnd3 - performanceTimerStart3;
            console.log(`[KefinTweaks CardBuilder] Time to switch view: ${performanceTime3}ms`);
        });

        // Track window size to detect actual window resize events
        /* let lastWindowWidth = window.innerWidth;
        let lastWindowHeight = window.innerHeight;

        // Window resize handler - only update data-expandable on actual window resize
        let windowResizeTimer = null;
        function handleWindowResize() {
            const currentWidth = window.innerWidth;
            const currentHeight = window.innerHeight;
            
            // Only update if window size actually changed
            if (currentWidth !== lastWindowWidth || currentHeight !== lastWindowHeight) {
                lastWindowWidth = currentWidth;
                lastWindowHeight = currentHeight;
                
                // Debounce window resize checks
                clearTimeout(windowResizeTimer);
                windowResizeTimer = setTimeout(() => {
                    checkSectionOverflow(verticalSection, true); // Force update on window resize
                }, 100); // 100ms debounce
            }
        }

        // Listen for window resize events
        window.addEventListener('resize', handleWindowResize); */

        // Initial overflow check is done when section is detected in the DOM by overflowMutationObserver

        // Assemble the section
        verticalSection.appendChild(sectionTitleContainer);
        //const scrollButtons2 = document.createElement('div');
        verticalSection.appendChild(scrollButtons);
        verticalSection.appendChild(scroller);

        registerScrollSectionScrollButtons(verticalSection);

        return verticalSection;
    }

    /**
     * Creates a skeleton card element for loading states
     * @param {string} cardFormat - Card format: 'portrait', 'backdrop', 'thumb', or 'square'
     * @param {boolean} overflowCard - Use overflow card classes
     * @returns {HTMLElement} - Skeleton card element
     */
    function createSkeletonCard(cardFormat = null, overflowCard = false) {
        const card = document.createElement('div');
        
        // Determine card classes based on format
        let cardClass, padderClass;
        cardFormat = cardFormat?.toLowerCase() || 'portrait';
        
        if (cardFormat === 'backdrop' || cardFormat === 'thumb') {
            cardClass = overflowCard ? 'overflowBackdropCard' : 'backdropCard';
            padderClass = 'cardPadder-backdrop';
        } else if (cardFormat === 'square') {
            cardClass = overflowCard ? 'overflowSquareCard' : 'squareCard';
            padderClass = 'cardPadder-square';
        } else {
            // portrait (default)
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
        const { viewMoreUrl = null, spotlightLayout, spotlightSize, fullScreen } = options;
        const layout = spotlightLayout ?? (fullScreen === true ? 'Borderless' : 'Border');
        const size = spotlightSize ?? (fullScreen === true ? 'full' : 'normal');

        // Create main container (same structure as real spotlight)
        const container = document.createElement('div');
        container.className = 'spotlight-section padded-left';
        container.dataset.layout = layout;
        container.dataset.size = size;

        // Create banner container
        const bannerContainer = document.createElement('div');
        bannerContainer.className = 'spotlight-banner-container';

        // Add section title (same structure as createSpotlightSection for minimal layout shift)
        if (title) {
            let sectionTitleEl;
            if (viewMoreUrl) {
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
            sectionTitleWrapper.className = `spotlight-section-title ${viewMoreUrl ? '' : 'spotlight-title-link '}headerTabs sectionTabs`;
            sectionTitleWrapper.appendChild(sectionTitleEl);
            const sectionTitleContainer = document.createElement('div');
            sectionTitleContainer.className = 'spotlight-section-title-container';
            sectionTitleContainer.appendChild(sectionTitleWrapper);
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
    function createProgressivelyEnhancedScrollableContainer(title, viewMoreUrl = null, cardFormat = null, overflowCard = false) {
        // Create the main vertical section container (same structure as createScrollableContainer)
        const verticalSection = document.createElement('div');
        verticalSection.className = 'verticalSection emby-scroller-container custom-scroller-container';
        
        // Persist the card format if provided (ensures consistency for random/updates)
        if (cardFormat) {
            verticalSection.setAttribute('data-card-format', cardFormat);
        }

        // Create section title
        const sectionTitleContainer = document.createElement('div');
        sectionTitleContainer.className = 'sectionTitleContainer sectionTitleContainer-cards padded-left';
        
        if (viewMoreUrl) {
            const titleLink = document.createElement('a');
            titleLink.className = 'sectionTitle-link sectionTitleTextButton';
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
            sectionTitleContainer.appendChild(titleLink);
        } else {
            const titleText = document.createElement('h2');
            titleText.className = 'sectionTitle sectionTitle-cards';
            titleText.textContent = title;
            sectionTitleContainer.appendChild(titleText);
        }

        // Create scroller container
        const scroller = document.createElement('div');
        scroller.setAttribute('data-horizontal', 'true');
        scroller.setAttribute('data-centerfocus', 'card');
        scroller.className = 'padded-top-focusscale padded-bottom-focusscale emby-scroller custom-scroller';
        scroller.setAttribute('data-scroll-mode-x', 'custom');
        scroller.style.scrollSnapType = 'none';
        scroller.style.touchAction = 'auto';
        scroller.style.overscrollBehaviorX = 'contain';
        scroller.style.overscrollBehaviorY = 'auto';
        scroller.style.webkitOverflowScrolling = 'touch';

        // Create items container
        const itemsContainer = document.createElement('div');
        itemsContainer.className = 'focuscontainer-x itemsContainer scrollSlider animatedScrollX';
        itemsContainer.style.whiteSpace = 'nowrap';

        // Add skeleton cards (enough to fill viewport width)
        const skeletonCount = (cardFormat === 'backdrop' || cardFormat === 'thumb') ? 8 : 10;
        for (let i = 0; i < skeletonCount; i++) {
            const skeletonCard = createSkeletonCard(cardFormat, overflowCard);
            skeletonCard.setAttribute('data-index', i);
            itemsContainer.appendChild(skeletonCard);
        }

        scroller.appendChild(itemsContainer);
        verticalSection.appendChild(sectionTitleContainer);
        verticalSection.appendChild(scroller);

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

    // Overflow check: run checkSectionOverflow when .emby-scroller-container with .itemsContainer appears in DOM
    let overflowMutationObserver = null;

    // Single shared IntersectionObserver for scroll button state (first/last card visibility per section)
    let scrollButtonsStateObserver = null;
    const scrollButtonsSectionState = new WeakMap(); // verticalSection -> { firstVisible, lastVisible }
    
    /**
     * Initialize the global IntersectionObserver for lazy loading images
     * Watches when elements enter the viewport and loads their images
     */
    function initLazyImageObserver() {
        if (lazyImageObserver) return; // Already initialized
        
        const observerOptions = {
            threshold: 0.1, // Trigger when 10% of element is visible
            rootMargin: '800px' // Start loading well before element enters viewport to avoid grey flash
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
                    cardImageContainer.style.backgroundImage = `url("${imageUrl}")`;
                    cardImageContainer.classList.remove('lazy');
                    cardImageContainer.classList.add('lazy-loaded');
                    cardImageContainer.removeAttribute('data-src');
                    cardImageContainer.removeAttribute('data-loading');
                    cardImageContainer.classList.remove('lazy-hidden');
                    const canvas = cardImageContainer.previousElementSibling;
                    if (canvas && canvas.tagName === 'CANVAS' && canvas.classList.contains('blurhash-canvas')) {
                        canvas.classList.add('lazy-hidden');
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
                });
            });
        });
    }

    /**
     * Check if two DOMRects intersect (used for "visible in scroller" with root: null).
     */
    function rectsIntersect(a, b) {
        return !(a.right < b.left || a.left > b.right || a.bottom < b.top || a.top > b.bottom);
    }

    /**
     * Check if container fully contains child horizontally (entire card visible in scroller).
     */
    function rectContainsRectHorizontally(containerRect, childRect) {
        return containerRect.left <= childRect.left && childRect.right <= containerRect.right;
    }

    /**
     * Apply scroll button state for a section from scrollButtonsSectionState WeakMap.
     */
    function applyScrollButtonState(verticalSection) {
        const state = scrollButtonsSectionState.get(verticalSection);
        if (!state) return;
        const scroller = verticalSection.querySelector('.emby-scroller');
        const scrollButtons = verticalSection.querySelector('.emby-scrollbuttons');
        const leftButton = scrollButtons && scrollButtons.querySelector('button[data-direction="left"]');
        const rightButton = scrollButtons && scrollButtons.querySelector('button[data-direction="right"]');
        if (!scroller || !scrollButtons || !leftButton || !rightButton) return;
        const scrollX = parseFloat(window.getComputedStyle(scroller).getPropertyValue('--scroll-x')) || 0;
        leftButton.disabled = state.firstVisible && scrollX === 0;
        rightButton.disabled = state.lastVisible || scroller.getAttribute('data-max-scroll') === 'true';
        if (state.firstVisible && state.lastVisible) {
            scrollButtons.setAttribute('data-no-controls', 'true');
        } else {
            scrollButtons.removeAttribute('data-no-controls');
        }
    }

    /**
     * Compute first/last visibility for a section and apply button state (e.g. initial sync).
     */
    function updateScrollButtonStateForSection(verticalSection) {
        const itemsContainer = verticalSection.querySelector('.itemsContainer');
        const scroller = verticalSection.querySelector('.emby-scroller');
        const first = itemsContainer && itemsContainer.firstElementChild;
        const last = itemsContainer && itemsContainer.lastElementChild;
        if (!itemsContainer || !scroller || !first || !last) return;
        const scrollerRect = scroller.getBoundingClientRect();
        const firstVisible = rectsIntersect(first.getBoundingClientRect(), scrollerRect);
        const lastVisible = rectContainsRectHorizontally(scrollerRect, last.getBoundingClientRect());
        scrollButtonsSectionState.set(verticalSection, { firstVisible, lastVisible });
        applyScrollButtonState(verticalSection);
    }

    /**
     * Initialize the single shared IntersectionObserver for scroll button state (lazy).
     */
    function initScrollButtonsStateObserver() {
        if (scrollButtonsStateObserver) return;
        scrollButtonsStateObserver = new IntersectionObserver((entries) => {
            const sectionsAffected = new Set();
            entries.forEach(entry => {
                const verticalSection = entry.target.closest('.emby-scroller-container');
                if (!verticalSection) return;
                const itemsContainer = entry.target.parentElement;
                if (!itemsContainer || !itemsContainer.classList.contains('itemsContainer')) return;
                const scroller = itemsContainer.parentElement;
                if (!scroller) return;
                const scrollerRect = scroller.getBoundingClientRect();
                const cardRect = entry.boundingClientRect;
                const isFirst = entry.target === itemsContainer.firstElementChild;
                const visibleInScroller = isFirst
                    ? rectsIntersect(cardRect, scrollerRect)
                    : rectContainsRectHorizontally(scrollerRect, cardRect);
                const state = scrollButtonsSectionState.get(verticalSection) || { firstVisible: false, lastVisible: false };
                if (isFirst) state.firstVisible = visibleInScroller; else state.lastVisible = visibleInScroller;
                scrollButtonsSectionState.set(verticalSection, state);
                sectionsAffected.add(verticalSection);
            });
            sectionsAffected.forEach(applyScrollButtonState);
        }, { root: null, threshold: 0.1 });
    }

    /**
     * Register a scrollable section's first/last card with the shared observer and run initial sync.
     */
    function registerScrollSectionScrollButtons(verticalSection) {
        const itemsContainer = verticalSection.querySelector('.itemsContainer');
        const first = itemsContainer && itemsContainer.firstElementChild;
        const last = itemsContainer && itemsContainer.lastElementChild;
        if (!first || !last) {
            const scrollButtons = verticalSection.querySelector('.emby-scrollbuttons');
            const leftButton = scrollButtons && scrollButtons.querySelector('button[data-direction="left"]');
            const rightButton = scrollButtons && scrollButtons.querySelector('button[data-direction="right"]');
            if (leftButton) leftButton.disabled = true;
            if (rightButton) rightButton.disabled = true;
            if (scrollButtons && !first && !last) scrollButtons.setAttribute('data-no-controls', 'true');
            return;
        }
        if (!scrollButtonsStateObserver) initScrollButtonsStateObserver();
        scrollButtonsStateObserver.observe(first);
        scrollButtonsStateObserver.observe(last);
        requestAnimationFrame(() => updateScrollButtonStateForSection(verticalSection));
    }

    /**
     * Collect section elements (.emby-scroller-container containing .itemsContainer) from an added node
     * @param {Node} node - Added node (element or fragment)
     * @returns {HTMLElement[]} - Deduplicated section elements to run overflow check on
     */
    function getScrollerSectionsForOverflowCheck(node) {
        if (!node || node.nodeType !== 1 || !node.querySelectorAll) return [];
        const sections = [];
        const selfMatch = node.classList && node.classList.contains('emby-scroller-container') && node.querySelector('.itemsContainer');
        if (selfMatch) sections.push(node);
        const inner = node.querySelectorAll('.emby-scroller-container');
        inner.forEach(el => {
            if (el !== node && el.querySelector('.itemsContainer')) sections.push(el);
        });
        return sections;
    }

    /**
     * Initialize the MutationObserver that runs checkSectionOverflow when sections appear in the DOM
     */
    function initOverflowMutationObserver() {
        if (overflowMutationObserver) return;
        overflowMutationObserver = new MutationObserver((mutations) => {
            const sectionsToCheck = new Set();
            mutations.forEach(mutation => {
                mutation.addedNodes.forEach(node => {
                    getScrollerSectionsForOverflowCheck(node).forEach(section => sectionsToCheck.add(section));
                });
            });
            sectionsToCheck.forEach(section => {
                requestAnimationFrame(() => {
                    checkSectionOverflow(section, false);
                    // Re-check after a short delay so images/layout can affect dimensions
                    setTimeout(() => checkSectionOverflow(section, true), 150);
                });
            });
        });
    }

    /**
     * Initialize the smart lazy loading system
     * Scans existing elements and starts both observers
     */
    function initSmartLazyLoading() {
        if (typeof IntersectionObserver === 'undefined' || typeof MutationObserver === 'undefined') {
            return; // Browser doesn't support observers
        }
        
        // Initialize observers
        initLazyImageObserver();
        initLazyMutationObserver();
        initOverflowMutationObserver();
        
        // Scan existing elements with data-src
        const existingLazyImages = document.querySelectorAll('.cardImageContainer[data-src]');
        existingLazyImages.forEach(img => {
            lazyImageObserver.observe(img);
        });
        
        // Run overflow check on any sections already in the DOM
        document.querySelectorAll('.emby-scroller-container').forEach(section => {
            if (section.querySelector('.itemsContainer')) {
                requestAnimationFrame(() => checkSectionOverflow(section, false));
            }
        });
        
        // Start watching for new elements
        if (document.body) {
            lazyMutationObserver.observe(document.body, {
                childList: true,
                subtree: true
            });
            overflowMutationObserver.observe(document.body, {
                childList: true,
                subtree: true
            });
        } else {
            // If body isn't ready, wait for DOMContentLoaded
            document.addEventListener('DOMContentLoaded', () => {
                if (lazyMutationObserver && document.body) {
                    lazyMutationObserver.observe(document.body, {
                        childList: true,
                        subtree: true
                    });
                }
                if (overflowMutationObserver && document.body) {
                    overflowMutationObserver.observe(document.body, {
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

    function initialize() {
        if (!state.useEpisodeImages) {
            state.useEpisodeImages = window.userHelper.useEpisodeImages();
        }
    }

    initialize();

    // Expose the cardBuilder to the global window object
    window.cardBuilder = cardBuilder;
    
    console.log('[KefinTweaks CardBuilder] Module loaded and available at window.cardBuilder');
})();
