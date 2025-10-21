// Jellyfin Home Screen Script
// Adds custom scrollable sections to the home screen
// Home screen sections are generated from playlists
// All playlists used for the home screen sections must be public
// Requires: cardBuilder.js module to be loaded before this script

(function() {
    'use strict';
    
    // Common logging function
    const LOG = (...args) => console.log('[HomeScreen]', ...args);
    const WARN = (...args) => console.warn('[HomeScreen]', ...args);
    const ERR = (...args) => console.error('[HomeScreen]', ...args);
    
    LOG('Script loaded - JS Injector mode');
    
    // Add CSS for discovery section loading indicator
    function addDiscoveryLoadingCSS() {
        const styleId = 'discovery-loading-styles';
        
        // Check if style already exists
        if (document.getElementById(styleId)) {
            return;
        }
        
        const style = document.createElement('style');
        style.id = styleId;
        style.textContent = `
            /* Discovery section loading indicator */
            .discovery-loading-indicator {
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
                order: 9999 !important;
            }
            
            .discovery-loading-indicator.show {
                opacity: 1;
            }
            
            .discovery-loading-indicator .spinner {
                width: 20px;
                height: 20px;
                border: 2px solid #f3f3f3;
                border-top: 2px solid #3498db;
                border-radius: 50%;
                animation: discovery-spin 1s linear infinite;
            }
            
            @keyframes discovery-spin {
                0% { transform: rotate(0deg); }
                100% { transform: rotate(360deg); }
            }
        `;
        
        document.head.appendChild(style);
        LOG('Added discovery loading CSS styles');
    }
    
    // Create loading indicator element
    function createDiscoveryLoadingIndicator() {
        const loadingDiv = document.createElement('div');
        loadingDiv.className = 'discovery-loading-indicator';
        loadingDiv.id = 'discovery-loading-indicator';
        loadingDiv.innerHTML = `
            <div class="spinner"></div>
            <span>Loading more discovery sections...</span>
        `;
        return loadingDiv;
    }
    
    // Show loading indicator
    function showDiscoveryLoadingIndicator() {
        let loadingIndicator = document.getElementById('discovery-loading-indicator');
        
        if (!loadingIndicator) {
            loadingIndicator = createDiscoveryLoadingIndicator();
            
            // Find the home sections container and append the loading indicator
            const container = document.querySelector('.homeSectionsContainer');
            if (container) {
                container.appendChild(loadingIndicator);
            } else {
                // Fallback: append to body
                document.body.appendChild(loadingIndicator);
            }
        }
        
        // Show with animation
        setTimeout(() => {
            loadingIndicator.classList.add('show');
        }, 10);
        
        LOG('Discovery loading indicator shown');
    }
    
    // Hide loading indicator
    function hideDiscoveryLoadingIndicator() {
        const loadingIndicator = document.getElementById('discovery-loading-indicator');
        if (loadingIndicator) {
            loadingIndicator.classList.remove('show');
            
            // Remove from DOM after animation
            setTimeout(() => {
                if (loadingIndicator.parentNode) {
                    loadingIndicator.parentNode.removeChild(loadingIndicator);
                }
            }, 300);
            
            LOG('Discovery loading indicator hidden');
        }
    }
    
    // Body class management for home page and themes
    function manageBodyClasses() {
        const body = document.body;
        const currentView = window.KefinTweaksUtils?.getCurrentView();
        const isHomePage = currentView === 'home' || window.location.pathname.includes('home.html');
        
        // Manage home-screen class
        if (isHomePage && body) {
            body.classList.add('home-screen');
        } else {
            body.classList.remove('home-screen');
        }
        
        // Manage theme classes (only on home page)
        if (isHomePage) {
            // Remove all existing theme classes
            const themeClasses = ['halloween-theme', 'christmas-theme', 'valentines-theme', 'newyear-theme'];
            themeClasses.forEach(themeClass => body.classList.remove(themeClass));
            
            // Add appropriate theme class based on current date
            if (isHalloweenPeriod()) {
                body.classList.add('halloween-theme');
            } else if (isChristmasPeriod()) {
                body.classList.add('christmas-theme');
            } else if (isValentinesPeriod()) {
                body.classList.add('valentines-theme');
            } else if (isNewYearsPeriod()) {
                body.classList.add('newyear-theme');
            }
        } else {
            // Remove all theme classes when not on home page
            const themeClasses = ['halloween-theme', 'christmas-theme', 'valentines-theme', 'newyear-theme'];
            themeClasses.forEach(themeClass => body.classList.remove(themeClass));
        }
    }
    
    // Initialize body class management
    manageBodyClasses();
    
    // Initialize discovery loading CSS
    addDiscoveryLoadingCSS();
    
    // Set up page view monitoring
    if (window.KefinTweaksUtils) {
        window.KefinTweaksUtils.onViewPage(manageBodyClasses, {
            immediate: true,
            pages: []
        });
        LOG('Registered body class management for home page');
    } else {
        WARN('KefinTweaksUtils not available, body class management may not work correctly');
    }
    
    // Custom home sections configuration
    // Read from centralized config or use defaults
    // name: The name of the section that will appear on the home screen
    // id: The ID of the playlist that will be used to fetch the items for the section
    // maxItems: The maximum number of items to display in the section
    // order: The flex order of the section on the home screen (requires css to take advantage of this)
    const customHomeSections = window.KefinTweaksConfig?.homeScreen?.customSections || [];

    // New and Trending sections configuration
    const enableNewAndTrending = window.KefinTweaksConfig?.homeScreen?.enableNewAndTrending !== false; // Default to true
    const enableNewMovies = window.KefinTweaksConfig?.homeScreen?.enableNewMovies !== false; // Default to true
    const enableNewEpisodes = window.KefinTweaksConfig?.homeScreen?.enableNewEpisodes !== false; // Default to true
    const enableTrending = window.KefinTweaksConfig?.homeScreen?.enableTrending || false; // Default to false (stubs for now)
    
    // Discovery sections configuration
    const enableWatchlist = window.KefinTweaksConfig?.homeScreen?.enableWatchlist || false;
    const enableDiscovery = window.KefinTweaksConfig?.homeScreen?.enableDiscovery || false;
    const enableSeasonal = window.KefinTweaksConfig?.homeScreen?.enableSeasonal || false;
    
    // People and genre configuration
    const minPeopleAppearances = window.KefinTweaksConfig?.homeScreen?.minPeopleAppearances || 10;
    const minGenreMovieCount = window.KefinTweaksConfig?.homeScreen?.minGenreMovieCount || 50;
    const enableInfiniteScroll = window.KefinTweaksConfig?.homeScreen?.enableInfiniteScroll !== false; // Default to true
    
    // Seasonal configuration
    const SEASONAL_ITEM_LIMIT = window.KefinTweaksConfig?.homeScreen?.seasonalItemLimit || 16;

    // Processing flag to prevent parallel execution
    let isProcessing = false;
    
    // Seasonal data storage
    let halloweenMovies = [];
    let horrorMovies = [];
    let thrillerMovies = [];
    let halloweenViewMoreUrls = {
        horror: null,
        thriller: null
    };

    // Discovery sections data storage
    let moviesTopPeople = null;
    let renderedSections = new Set(); // Track rendered sections to avoid duplicates
    let isGeneratingDiscoverySections = false; // Prevent parallel generation (legacy)
    let isRenderingDiscoveryGroup = false; // Prevent parallel rendering from buffer
    let isInitializingPeopleCache = false; // Prevent parallel people cache initialization
    let isPeopleCacheComplete = false; // Track if all people data has been loaded
    let preloadedSections = []; // Preloaded sections ready for instant rendering
    
    // Discovery buffer system
    let discoveryBuffer = []; // Buffer holding groups of discovery items (always 2 groups)
    let additionalDiscoveryContent = true; // Flag indicating if more discovery content is available
    let preloadedSectionElements = []; // Preloaded section DOM elements (hidden)
    let isPreloadingSections = false; // Prevent parallel preloading

/************ Helpers ************/

/**
 * Fetches item data from Jellyfin API to determine type
 * @param {string} itemId - The item ID to fetch
 * @returns {Promise<Object>} - Item data with type information
 */
async function fetchItemData(itemId) {
    const apiClient = window.ApiClient;
    const serverUrl = apiClient.serverAddress();
    const token = apiClient.accessToken();
    
    const url = `${serverUrl}/Items/${itemId}`;
    
    try {
        const response = await fetch(url, {
            headers: {
                "Authorization": `MediaBrowser Token="${token}"`
            }
        });
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const data = await response.json();
        return data;
    } catch (err) {
        ERR(`Failed to fetch item data for ${itemId}:`, err);
        return null;
    }
}

/**
 * Fetches playlist data from Jellyfin API
 * @param {string} playlistId - The playlist ID to fetch
 * @returns {Promise<Object>} - Playlist data with ItemIds array
 */
async function fetchPlaylistData(playlistId) {
    const apiClient = window.ApiClient;
    const serverUrl = apiClient.serverAddress();
    const token = apiClient.accessToken();
    
    const url = `${serverUrl}/Playlists/${playlistId}`;
    
    try {
        const response = await fetch(url, {
            headers: {
                "Authorization": `MediaBrowser Token="${token}"`
            }
        });
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const data = await response.json();
        return data;
    } catch (err) {
        ERR(`Failed to fetch playlist data for ${playlistId}:`, err);
        return { ItemIds: [] };
    }
}

/**
 * Fetches collection data from Jellyfin API
 * @param {string} collectionId - The collection ID to fetch
 * @returns {Promise<Object>} - Collection data with Items array
 */
async function fetchCollectionData(collectionId) {
    const apiClient = window.ApiClient;
    const serverUrl = apiClient.serverAddress();
    const token = apiClient.accessToken();
    const userId = apiClient.getCurrentUserId();
    
    const url = `${serverUrl}/Users/${userId}/Items?ParentId=${collectionId}&Fields=ItemCounts%2CPrimaryImageAspectRatio%2CCanDelete%2CMediaSourceCount`;
    
    try {
        const response = await fetch(url, {
            headers: {
                "Authorization": `MediaBrowser Token="${token}"`
            }
        });
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const data = await response.json();
        return data;
    } catch (err) {
        ERR(`Failed to fetch collection data for ${collectionId}:`, err);
        return { Items: [] };
    }
}

/**
 * Generates the view more URL for a playlist or collection
 * @param {string} itemId - The item ID
 * @param {string} itemType - The item type ('Playlist' or 'BoxSet')
 * @returns {string} - The complete URL for the item page
 */
function generateViewMoreUrl(itemId, itemType) {
    const apiClient = window.ApiClient;
    const serverId = apiClient.serverId();

    if (itemType === 'BoxSet') {
        // For collections, use the collection page
        return `#/details?id=${itemId}&serverId=${serverId}`;
    } else {
        // For playlists, use the list page
        return `#/list.html?parentId=${itemId}&serverId=${serverId}`;
    }
}

/**
 * Renders a custom home section
 * @param {Object} section - Section configuration object
 * @param {HTMLElement} container - Container to append the section to
 * @returns {boolean} - Success status
 */
async function renderCustomSection(section, container) {
    try {
        // First, fetch item data to determine type
        const itemData = await fetchItemData(section.id);
        if (!itemData) {
            ERR(`Failed to fetch item data for section ${section.name}`);
            return false;
        }
        
        let itemIds = [];
        let itemType = itemData.Type;
        
        // Handle different item types
        if (itemType === 'Playlist') {
            // Fetch playlist data
            const playlistData = await fetchPlaylistData(section.id);
            itemIds = playlistData.ItemIds || [];
        } else if (itemType === 'BoxSet') {
            // Fetch collection data
            const collectionData = await fetchCollectionData(section.id);
            itemIds = (collectionData.Items || []).map(item => item.Id);
        } else {
            ERR(`Unsupported item type ${itemType} for section ${section.name}`);
            return false;
        }
        
        // Limit to maxItems
        const limitedItemIds = itemIds.slice(0, section.maxItems);
        
        if (limitedItemIds.length === 0) {
            return false;
        }
        
        // Generate view more URL
        const viewMoreUrl = generateViewMoreUrl(section.id, itemType);
        
        // Check if cardBuilder is available
        if (typeof window.cardBuilder === 'undefined' || !window.cardBuilder.renderCardsFromIds) {
            WARN("cardBuilder not available, skipping section:", section.name);
            return false;
        }
        
        // Render the scrollable container
        const scrollableContainer = await window.cardBuilder.renderCardsFromIds(
            limitedItemIds,
            section.name ?? itemData.Name,
            viewMoreUrl
        );
        
        // Add data attribute to track rendered sections
        scrollableContainer.setAttribute('data-custom-section-id', section.id);
        scrollableContainer.setAttribute('data-custom-section-name', section.name);
        scrollableContainer.setAttribute('data-custom-section-type', itemType);

        if (section.order) {
            scrollableContainer.style.order = section.order;
        }
        
        // Append to container
        container.appendChild(scrollableContainer);
        
        return true;
        
    } catch (err) {
        ERR(`Error rendering section ${section.name}:`, err);
        return false;
    }
}

/**
 * Renders all custom home sections
 * @param {HTMLElement} container - Container to append sections to
 */
async function renderAllCustomSections(container) {
    const results = await Promise.all(
        customHomeSections.map(section => renderCustomSection(section, container))
    );
    
    const successCount = results.filter(Boolean).length;
    LOG(`Rendered ${successCount}/${customHomeSections.length} custom sections`);
}

/**
 * Renders trending movies section (stub for future implementation)
 * @param {HTMLElement} container - Container to append the section to
 * @returns {boolean} - Success status
 */
function renderTrendingMoviesSection(container) {
    // TODO: Implement trending movies section
    LOG('Trending Movies section not yet implemented');
    return false;
}

/**
 * Renders trending series section (stub for future implementation)
 * @param {HTMLElement} container - Container to append the section to
 * @returns {boolean} - Success status
 */
function renderTrendingSeriesSection(container) {
    // TODO: Implement trending series section
    LOG('Trending Series section not yet implemented');
    return false;
}

/**
 * Renders all new and trending sections
 * @param {HTMLElement} container - Container to append sections to
 */
async function renderAllNewAndTrendingSections(container) {
    if (!enableNewAndTrending) {
        LOG('New and Trending sections disabled, skipping...');
        return;
    }
    
    const sectionsToRender = [];
    
    // Add new movies section if enabled
    if (enableNewMovies) {
        sectionsToRender.push(renderNewMoviesSection(container));
    }
    
    // Add new episodes section if enabled
    if (enableNewEpisodes) {
        sectionsToRender.push(renderNewEpisodesSection(container));
    }
    
    // Add trending sections if enabled (stubs for now)
    if (enableTrending) {
        sectionsToRender.push(renderTrendingMoviesSection(container));
        sectionsToRender.push(renderTrendingSeriesSection(container));
    }
    
    if (sectionsToRender.length === 0) {
        return;
    }
    
    const results = await Promise.all(sectionsToRender);
    const successCount = results.filter(Boolean).length;
    LOG(`Rendered ${successCount}/${sectionsToRender.length} new and trending sections`);
}

/************ Seasonal Section Helpers ************/

/**
 * Checks if current date is within Halloween period (Oct 1-31)
 * @returns {boolean} - True if within Halloween period
 */
function isHalloweenPeriod() {
    const now = new Date();
    const month = now.getMonth() + 1; // getMonth() returns 0-11
    const day = now.getDate();
    return month === 10 && day >= 1 && day <= 31;
}

/**
 * Checks if current date is within Christmas period (Dec 1-30)
 * @returns {boolean} - True if within Christmas period
 */
function isChristmasPeriod() {
    const now = new Date();
    const month = now.getMonth() + 1;
    const day = now.getDate();
    return month === 12 && day >= 1 && day <= 30;
}

/**
 * Checks if current date is within New Years period (Dec 31 + Jan 1)
 * @returns {boolean} - True if within New Years period
 */
function isNewYearsPeriod() {
    const now = new Date();
    const month = now.getMonth() + 1;
    const day = now.getDate();
    return (month === 12 && day === 31) || (month === 1 && day === 1);
}

/**
 * Checks if current date is within Valentine's Day period (Feb 14)
 * @returns {boolean} - True if within Valentine's Day period
 */
function isValentinesPeriod() {
    const now = new Date();
    const month = now.getMonth() + 1;
    const day = now.getDate();
    return month === 2 && day === 14;
}

/**
 * Fetches all movie genres from Jellyfin API and caches them
 * @returns {Promise<Array>} - Array of genre objects with Name, ImageTags, and Id
 */
async function fetchAndCacheMovieGenres() {
    const apiClient = window.ApiClient;
    const serverUrl = apiClient.serverAddress();
    const token = apiClient.accessToken();
    
    try {
        const response = await fetch(`${serverUrl}/Genres?IncludeItemTypes=Movie`, {
            headers: {
                "Authorization": `MediaBrowser Token="${token}"`
            }
        });
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const data = await response.json();
        const genres = data.Items || [];
        
        // Optimize genres to only include essential fields
        const optimizedGenres = genres.map(genre => ({
            Id: genre.Id,
            Name: genre.Name,
            ImageTags: genre.ImageTags || {},
            MovieCount: genre.MovieCount
        }));
        
        // Cache the optimized genres
        const cache = new window.LocalStorageCache();
        cache.set('movieGenres', optimizedGenres);
        LOG(`Cached ${optimizedGenres.length} movie genres`);
        
        return optimizedGenres;
    } catch (err) {
        ERR('Failed to fetch movie genres:', err);
        return [];
    }
}

/**
 * Gets a genre ID from cached movie genres
 * @param {string} genreName - Name of the genre to find
 * @returns {Promise<string|null>} - Genre ID or null if not found
 */
async function getGenreId(genreName) {
    const cache = new window.LocalStorageCache();
    
    // Try to get from cache first
    let movieGenres = cache.get('movieGenres');
    
    // If not in cache or cache is invalid, fetch and cache
    if (!movieGenres || movieGenres.length === 0) {
        LOG('Movie genres not in cache, fetching...');
        movieGenres = await fetchAndCacheMovieGenres();
    }
    
    // Find the genre by name (case insensitive)
    const genre = movieGenres.find(g => g.Name.toLowerCase() === genreName.toLowerCase());
    return genre ? genre.Id : null;
}

/**
 * Fetches Halloween movie data from Jellyfin API
 * @returns {Promise<Object>} - Object containing halloween, horror, and thriller movies
 */
async function fetchHalloweenMovieData() {
    const apiClient = window.ApiClient;
    const serverUrl = apiClient.serverAddress();
    const token = apiClient.accessToken();
    const userId = apiClient.getCurrentUserId();
    const serverId = apiClient.serverId();
    
    // No longer fetching people data for Halloween
    const fieldsParam = '';
    
    // Fetch genre IDs for ViewMore URLs
    const [horrorGenreId, thrillerGenreId] = await Promise.all([
        getGenreId('Horror'),
        getGenreId('Thriller')
    ]);
    
    const queries = [
        {
            name: 'halloween',
            url: `${serverUrl}/Items?userId=${userId}&Tags=halloween&IncludeItemTypes=Movie&Recursive=true&Limit=200${fieldsParam}`,
            viewMoreUrl: null
        },
        {
            name: 'horror',
            url: `${serverUrl}/Items?userId=${userId}&Genres=Horror&IncludeItemTypes=Movie&Recursive=true&SortBy=Random&Limit=200${fieldsParam}`,
            viewMoreUrl: horrorGenreId ? `/web/#/list.html?genreId=${horrorGenreId}&serverId=${serverId}` : null
        },
        {
            name: 'thriller',
            url: `${serverUrl}/Items?userId=${userId}&Genres=Thriller&IncludeItemTypes=Movie&Recursive=true&SortBy=Random&Limit=200${fieldsParam}`,
            viewMoreUrl: thrillerGenreId ? `/web/#/list.html?genreId=${thrillerGenreId}&serverId=${serverId}` : null
        }
    ];
    
    try {
        const results = await Promise.all(
            queries.map(async (query) => {
                const response = await fetch(query.url, {
                    headers: {
                        "Authorization": `MediaBrowser Token="${token}"`
                    }
                });
                
                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                }
                
                const data = await response.json();
                return {
                    name: query.name,
                    items: data.Items || []
                };
            })
        );
        
        // Process results
        const halloweenItems = results.find(r => r.name === 'halloween')?.items || [];
        const horrorItems = results.find(r => r.name === 'horror')?.items || [];
        const thrillerItems = results.find(r => r.name === 'thriller')?.items || [];
        
        // Combine all items into halloweenMovies, removing duplicates by ID
        const allItems = [...halloweenItems];
        const existingIds = new Set(halloweenItems.map(item => item.Id));
        
        // Add horror items that aren't already in halloween
        horrorItems.forEach(item => {
            if (!existingIds.has(item.Id)) {
                allItems.push(item);
                existingIds.add(item.Id);
            }
        });
        
        // Add thriller items that aren't already in halloween or horror
        thrillerItems.forEach(item => {
            if (!existingIds.has(item.Id)) {
                allItems.push(item);
                existingIds.add(item.Id);
            }
        });
        
        return {
            allHalloweenMovies: allItems,
            halloweenMovies: halloweenItems,
            horrorMovies: horrorItems,
            thrillerMovies: thrillerItems,
            viewMoreUrls: {
                horror: queries.find(q => q.name === 'horror')?.viewMoreUrl || null,
                thriller: queries.find(q => q.name === 'thriller')?.viewMoreUrl || null
            }
        };
        
    } catch (err) {
        ERR('Failed to fetch Halloween movie data:', err);
        return {
            allHalloweenMovies: [],
            halloweenMovies: [],
            horrorMovies: [],
            thrillerMovies: [],
            viewMoreUrls: {
                horror: null,
                thriller: null
            }
        };
    }
}



/**
 * Fetches and processes top people data from all movies using pagination
 * @returns {Promise<Object|null>} - Top people data or null if failed
 */
async function fetchTopPeople() {
    const apiClient = window.ApiClient;
    const serverUrl = apiClient.serverAddress();
    const token = apiClient.accessToken();
    const userId = apiClient.getCurrentUserId();
    const cache = new window.LocalStorageCache();
    
    try {
        LOG('Starting paginated fetch of movies for people data processing...');
        
        let allMovies = [];
        let startIndex = 0;
        const limit = 500;
        let hasMoreData = true;
        
        // Load existing partial data if available
        const existingData = cache.get('movies_top_people');
        if (existingData && !existingData.isComplete) {
            const moviesProcessed = countMoviesFromPeopleData(existingData);
            if (moviesProcessed > 0) {
                startIndex = moviesProcessed;
                LOG(`Resuming from existing data: ${moviesProcessed} movies already processed`);
            }
        }
        
        // Fetch movies in chunks of 500
        while (hasMoreData) {
            const url = `${serverUrl}/Items?userId=${userId}&IncludeItemTypes=Movie&Recursive=true&Fields=People&Limit=${limit}&StartIndex=${startIndex}`;
            
            LOG(`Fetching movies ${startIndex} to ${startIndex + limit - 1}...`);
            
            const response = await fetch(url, {
                headers: {
                    "Authorization": `MediaBrowser Token="${token}"`
                }
            });
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            const data = await response.json();
            const movies = data.Items || [];
            
            if (movies.length === 0) {
                hasMoreData = false;
                LOG('No more movies to fetch');
            } else {
                allMovies = allMovies.concat(movies);
                startIndex += movies.length;
                
                LOG(`Fetched ${movies.length} movies, total: ${allMovies.length}`);
                
                // Process and cache partial data after each chunk
                const partialPeopleData = processPeopleData(allMovies);
                if (partialPeopleData) {
                    // Mark as incomplete and store movie count for resuming
                    partialPeopleData.isComplete = movies.length < limit; // Complete if we got less than limit
                    partialPeopleData.moviesProcessedCount = allMovies.length;
                    
                    // Update the global moviesTopPeople immediately so discovery sections can use it
                    moviesTopPeople = partialPeopleData;
                    
                    // Cache partial data
                    cache.set('movies_top_people', partialPeopleData, userId, 7 * 24 * 60 * 60 * 1000);
                    LOG(`Updated moviesTopPeople with partial data: ${partialPeopleData.actors.length} actors, ${partialPeopleData.directors.length} directors, ${partialPeopleData.writers.length} writers (${allMovies.length} movies processed)`);
                }
                
                // If we got less than the limit, we've reached the end
                if (movies.length < limit) {
                    hasMoreData = false;
                    isPeopleCacheComplete = true;
                    LOG('Reached end of movies, people cache is complete');
                }
            }
        }
        
        // Final processing of all data
        LOG(`Final processing of ${allMovies.length} movies...`);
        const finalPeopleData = processPeopleData(allMovies);
        
        if (finalPeopleData) {
            // Mark as complete and remove movies count to save space
            finalPeopleData.isComplete = true;
            delete finalPeopleData.moviesProcessedCount;
            
            // Update global variable
            moviesTopPeople = finalPeopleData;
            
            // Cache final data
            cache.set('movies_top_people', finalPeopleData, userId, 7 * 24 * 60 * 60 * 1000);
            LOG(`Final cached people data: ${finalPeopleData.actors.length} actors, ${finalPeopleData.directors.length} directors, ${finalPeopleData.writers.length} writers`);
        }
        
        return finalPeopleData;
        
    } catch (err) {
        ERR('Failed to fetch top people data:', err);
        return null;
    }
}

/**
 * Processes people data from movies array
 * @param {Array} movies - Array of movie objects with People data
 * @returns {Object|null} - Processed people data or null if failed
 */
function processPeopleData(movies) {
    try {
    const peopleMap = new Map();
    
    movies.forEach(movie => {
        if (movie.People) {
            movie.People.forEach(person => {
                const key = person.Id;
                if (!peopleMap.has(key)) {
                    peopleMap.set(key, {
                        id: person.Id,
                        name: person.Name,
                        directorCount: 0,
                        writerCount: 0,
                        actorCount: 0,
                        directorItemIds: [],
                        writerItemIds: [],
                        actorItemIds: []
                    });
                }
                
                const personData = peopleMap.get(key);
                if (person.Type === 'Director') {
                    personData.directorCount++;
                    if (!personData.directorItemIds.includes(movie.Id)) {
                        personData.directorItemIds.push(movie.Id);
                    }
                } else if (person.Type === 'Writer') {
                    personData.writerCount++;
                    if (!personData.writerItemIds.includes(movie.Id)) {
                        personData.writerItemIds.push(movie.Id);
                    }
                } else if (person.Type === 'Actor') {
                    personData.actorCount++;
                    if (!personData.actorItemIds.includes(movie.Id)) {
                        personData.actorItemIds.push(movie.Id);
                    }
                }
            });
        }
    });
    
        // Filter and sort people by count, taking top 100 per category
        const allPeople = Array.from(peopleMap.values());
        
        const topDirectors = allPeople
            .filter(person => person.directorCount >= minPeopleAppearances)
            .sort((a, b) => b.directorCount - a.directorCount)
            .slice(0, 100)
            .map(person => ({
                name: person.name,
                count: person.directorCount,
                itemIds: person.directorItemIds
            }));
            
        const topWriters = allPeople
            .filter(person => person.writerCount >= minPeopleAppearances)
            .sort((a, b) => b.writerCount - a.writerCount)
            .slice(0, 100)
            .map(person => ({
                name: person.name,
                count: person.writerCount,
                itemIds: person.writerItemIds
            }));
            
        const topActors = allPeople
            .filter(person => person.actorCount >= minPeopleAppearances)
            .sort((a, b) => b.actorCount - a.actorCount)
            .slice(0, 100)
            .map(person => ({
                name: person.name,
                count: person.actorCount,
                itemIds: person.actorItemIds
            }));
        
        return {
            actors: topActors,
            directors: topDirectors,
            writers: topWriters
        };
        
    } catch (err) {
        ERR('Failed to process people data:', err);
        return null;
    }
}


/**
 * Initializes the people cache in the background
 */
async function initializePeopleCache() {
    // Prevent concurrent initialization
    if (isInitializingPeopleCache) {
        LOG('People cache initialization already in progress, skipping...');
        return;
    }
    
    // Check if we already have complete data
    if (moviesTopPeople !== null && isPeopleCacheComplete) {
        LOG('People cache already loaded and complete');
        return;
    }
    
    const cache = new window.LocalStorageCache();
    
    // Check if we have valid cached data
    if (cache.isCacheValid('movies_top_people')) {
        const cachedData = cache.get('movies_top_people');
        
        // Check if data is complete
        if (cachedData.isComplete) {
            moviesTopPeople = cachedData;
            isPeopleCacheComplete = true;
            LOG('Loaded complete top people data from cache');
            return;
        } else if (cachedData.moviesProcessedCount) {
            // Use the stored count for resuming
            const moviesProcessed = cachedData.moviesProcessedCount;
            if (moviesProcessed > 0 && moviesProcessed % 500 === 0) {
                // We have a complete set of 500-item chunks, continue loading
                moviesTopPeople = cachedData;
                isPeopleCacheComplete = false;
                LOG(`Loaded partial top people data from cache (${moviesProcessed} movies), will continue fetching...`);
            } else if (moviesProcessed > 0) {
                // We have incomplete data, use what we have but don't continue loading
                moviesTopPeople = cachedData;
                isPeopleCacheComplete = true;
                LOG(`Loaded incomplete top people data from cache (${moviesProcessed} movies), not divisible by 500, using as-is`);
                return;
            } else {
                // We have partial data without count info, load it and continue fetching
                moviesTopPeople = cachedData;
                isPeopleCacheComplete = false;
                LOG('Loaded partial top people data from cache, will continue fetching...');
            }
        } else {
            // No moviesProcessedCount stored, treat as incomplete and continue fetching
            moviesTopPeople = cachedData;
            isPeopleCacheComplete = false;
            LOG('Loaded partial top people data from cache (no count stored), will continue fetching...');
        }
    }
    
    // Set flag to prevent concurrent calls
    isInitializingPeopleCache = true;
    
    try {
        // Fetch/continue fetching data in the background
        LOG('Fetching/continuing top people data in background...');
        const result = await fetchTopPeople();
        if (result) {
            moviesTopPeople = result;
            isPeopleCacheComplete = result.isComplete || false;
        }
    } finally {
        // Always reset the flag
        isInitializingPeopleCache = false;
    }
}

/**
 * Navigates to the watchlist tab by clicking the appropriate tab button
 */
function gotoWatchlistTab() {
    const visibleWatchlistTab = document.querySelector('.libraryPage:not(.hide) .pageTabContent:has(.watchlist.sections)');
    const visibleWatchlistTabIndex = visibleWatchlistTab ? visibleWatchlistTab.getAttribute('data-index') : null;

    if (visibleWatchlistTabIndex) {
        const tabButton = document.querySelector(`.headerTabs .emby-tab-button[data-index="${visibleWatchlistTabIndex}"]`);
        if (tabButton) {
            tabButton.click();

            const watchlistTabButton = document.querySelector('.libraryPage:not(.hide) .pageTabContent:has(.watchlist.sections) .watchlist-tabs button:not(.active)[data-tab="watchlist"]');
            if (watchlistTabButton) {
                watchlistTabButton.click();
            } else {
                WARN('Watchlist tab button not found');
            }
        } else {
            WARN('Watchlist tab button not found, navigating with page handler');
            const pageHandler = Emby?.Page;
        
            if (pageHandler && visibleWatchlistTabIndex) {
                pageHandler.show(`/home.html?tab=${visibleWatchlistTabIndex}`);
                return;
            }
        }
    } else {
        WARN('Watchlist tab not found');
    }
}

/************ Discovery Section Helpers ************/

/**
 * Fetches similar content for a movie or series
 * @param {string} itemId - The item ID
 * @param {string} type - 'Movie' or 'Series'
 * @returns {Promise<Array>} - Array of similar items
 */
async function fetchSimilarContent(itemId, type) {
    const apiClient = window.ApiClient;
    const serverUrl = apiClient.serverAddress();
    const token = apiClient.accessToken();
    
    const endpoint = type === 'Movie' ? 'Movies' : 'Shows';
    // Double the limit to account for filtering out played items
    // Sadly Jellyfin API doesn't seem to support filtering out played items in the Similar endpoint
    const url = `${serverUrl}/${endpoint}/${itemId}/Similar?limit=32`;
    
    try {
        const response = await fetch(url, {
            headers: {
                "Authorization": `MediaBrowser Token="${token}"`
            }
        });
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const data = await response.json();
        const allItems = data.Items || [];
        
        // Filter out played items
        const unplayedItems = allItems.filter(item => !item.UserData?.Played);
        
        // If we have enough unplayed items, randomly select 16
        if (unplayedItems.length >= 16) {
            // Shuffle array and take first 16
            const shuffled = [...unplayedItems].sort(() => Math.random() - 0.5);
            return shuffled.slice(0, 16);
        }
        
        // If we don't have enough unplayed items, return what we have
        // (shuffled to avoid always showing the same items)
        return [...unplayedItems].sort(() => Math.random() - 0.5);
        
    } catch (err) {
        ERR(`Failed to fetch similar content for ${type} ${itemId}:`, err);
        return [];
    }
}

/**
 * Fetches items with IsFavorite filter
 * @param {string} includeItemTypes - Item types to include (e.g., 'Movie,Series')
 * @returns {Promise<Array>} - Array of favorite items
 */
async function fetchFavoriteItems(includeItemTypes = 'Movie,Series') {
    const apiClient = window.ApiClient;
    const serverUrl = apiClient.serverAddress();
    const token = apiClient.accessToken();
    const userId = apiClient.getCurrentUserId();
    
    const url = `${serverUrl}/Items?userId=${userId}&IncludeItemTypes=${includeItemTypes}&SortBy=DatePlayed&SortOrder=Descending&Recursive=true&Limit=16&Filters=IsFavorite`;
    
    try {
        const response = await fetch(url, {
            headers: {
                "Authorization": `MediaBrowser Token="${token}"`
            }
        });
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const data = await response.json();
        return data.Items || [];
    } catch (err) {
        ERR(`Failed to fetch favorite items:`, err);
        return [];
    }
}

/**
 * Fetches items by person (director or actor)
 * @param {string} personId - The person ID
 * @param {string} includeItemTypes - Item types to include (e.g., 'Movie')
 * @returns {Promise<Array>} - Array of items by person
 */
async function fetchPersonItems(personId, includeItemTypes = 'Movie') {
    const apiClient = window.ApiClient;
    const serverUrl = apiClient.serverAddress();
    const token = apiClient.accessToken();
    
    const url = `${serverUrl}/Items?personIds=${personId}&IncludeItemTypes=${includeItemTypes}&Recursive=true&EnableImageTypes=Primary,Backdrop,Thumb&ImageTypeLimit=1&limit=16`;
    
    try {
        const response = await fetch(url, {
            headers: {
                "Authorization": `MediaBrowser Token="${token}"`
            }
        });
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const data = await response.json();
        return data.Items || [];
    } catch (err) {
        ERR(`Failed to fetch items for person ${personId}:`, err);
        return [];
    }
}

/**
 * Gets random item from array
 * @param {Array} items - Array of items
 * @returns {Object|null} - Random item or null if array is empty
 */
function getRandomItem(items) {
    if (!items || items.length === 0) return null;
    return items[Math.floor(Math.random() * items.length)];
}

/**
 * Shuffles an array and returns a new shuffled copy
 * @param {Array} array - Array to shuffle
 * @returns {Array} - New shuffled array
 */
function shuffleArray(array) {
    if (!array || array.length === 0) return [];
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
}

/**
 * Gets top N most frequent people from movie history
 * @param {Array} movies - Array of movie objects
 * @param {string} personType - 'Director' or 'Actor'
 * @param {number} limit - Number of top people to return
 * @returns {Array} - Array of person objects with counts
 */
function getTopPeople(movies, personType, limit = 25) {
    const personCounts = {};
    
    movies.forEach(movie => {
        if (movie.People) {
            movie.People.forEach(person => {
                if (person.Type === personType) {
                    const key = person.Id;
                    if (!personCounts[key]) {
                        personCounts[key] = {
                            ...person,
                            count: 0
                        };
                    }
                    personCounts[key].count++;
                }
            });
        }
    });
    
    return Object.values(personCounts)
        .sort((a, b) => b.count - a.count)
        .slice(0, limit);
}

/**
 * Gets watchlist data from localStorageCache
 * @returns {Array} - Combined watchlist items (movies + series)
 */
function getWatchlistData() {
    if (typeof window.LocalStorageCache === 'undefined') {
        WARN('LocalStorageCache not available');
        return [];
    }
    
    const cache = new window.LocalStorageCache();
    const movies = cache.get('watchlist_movies') || [];
    const series = cache.get('watchlist_series') || [];
    
    return [...movies, ...series].sort((a, b) => {
        const dateA = new Date(a.PremiereDate || 0);
        const dateB = new Date(b.PremiereDate || 0);
        return dateB - dateA;
    });
}

/**
 * Gets movie history data from localStorageCache
 * @returns {Array} - Array of watched movies
 */
function getMovieHistoryData() {
    if (typeof window.LocalStorageCache === 'undefined') {
        WARN('LocalStorageCache not available');
        return [];
    }
    
    const cache = new window.LocalStorageCache();
    return cache.get('movies') || [];
}

/**
 * Gets series progress data from localStorageCache
 * @returns {Array} - Array of series with progress data
 */
function getSeriesProgressData() {
    if (typeof window.LocalStorageCache === 'undefined') {
        WARN('LocalStorageCache not available');
        return [];
    }
    
    const cache = new window.LocalStorageCache();
    return cache.getChunked('progress') || [];
}

/**
 * Gets random watched movie from history (last 25 by DatePlayed)
 * @returns {Object|null} - Random watched movie or null
 */
function getRandomWatchedMovie() {
    const movies = getMovieHistoryData();
    if (movies.length === 0) return null;
    
    // Sort by DatePlayed descending and take last 25
    const sortedMovies = movies
        .filter(movie => movie.UserData && movie.UserData.Played)
        .sort((a, b) => new Date(b.UserData.LastPlayedDate || 0) - new Date(a.UserData.LastPlayedDate || 0))
        .slice(0, 25);
    
    return getRandomItem(sortedMovies);
}

/**
 * Gets random watched series from progress (last 25 by lastWatchedEpisode date)
 * @returns {Object|null} - Random watched series or null
 */
function getRandomWatchedSeries() {
    const series = getSeriesProgressData();
    if (series.length === 0) return null;
    
    // Sort by lastWatchedEpisode date and take last 25
    const sortedSeries = series
        .filter(s => s.lastWatchedEpisode && s.lastWatchedEpisode.UserData && s.lastWatchedEpisode.UserData.Played)
        .sort((a, b) => new Date(b.lastWatchedEpisode.UserData.LastPlayedDate || 0) - new Date(a.lastWatchedEpisode.UserData.LastPlayedDate || 0))
        .slice(0, 25);
    
    const randomSeries = getRandomItem(sortedSeries);

    return randomSeries ? randomSeries.series : null;
}

/**
 * Gets random favorite movie
 * @returns {Promise<Object|null>} - Random favorite movie or null
 */
async function getRandomFavoriteMovie() {
    const favorites = await fetchFavoriteItems('Movie');
    return getRandomItem(favorites);
}

/**
 * Gets random favorite series
 * @returns {Promise<Object|null>} - Random favorite series or null
 */
async function getRandomFavoriteSeries() {
    const favorites = await fetchFavoriteItems('Series');
    return getRandomItem(favorites);
}

/**
 * Gets random director from top 25 most-watched movie directors
 * @returns {Object|null} - Random director or null
 */
function getRandomDirector() {
    const movies = getMovieHistoryData();
    if (movies.length === 0) return null;
    
    const topDirectors = getTopPeople(movies, 'Director', 25);
    return getRandomItem(topDirectors);
}

/**
 * Gets random actor from top 25 most-watched movie actors
 * @returns {Object|null} - Random actor or null
 */
function getRandomActor() {
    const movies = getMovieHistoryData();
    if (movies.length === 0) return null;
    
    const topActors = getTopPeople(movies, 'Actor', 25);
    return getRandomItem(topActors);
}

/**
 * Fetches newest movies from Jellyfin API
 * @returns {Promise<Array>} - Array of newest movie items
 */
async function fetchNewMovies() {
    const apiClient = window.ApiClient;
    const serverUrl = apiClient.serverAddress();
    const token = apiClient.accessToken();
    const userId = apiClient.getCurrentUserId();
    
    const today = new Date().toISOString().split('T')[0]; // Format: YYYY-MM-DD
    const url = `${serverUrl}/Items?IncludeItemTypes=Movie&SortBy=PremiereDate&SortOrder=Descending&Limit=16&Fields=PremiereDate&Recursive=true&MaxPremiereDate=${today}&userId=${userId}`;
    
    try {
        const response = await fetch(url, {
            headers: {
                'X-Emby-Token': token
            }
        });
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const data = await response.json();
        return data.Items || [];
        
    } catch (err) {
        ERR('Failed to fetch new movies:', err);
        return [];
    }
}

/**
 * Fetches newest episodes from the last 7 days
 * Deduplicates episodes from the same series that aired on the same date,
 * keeping only the episode with the lowest index number
 * @returns {Promise<Array>} - Array of deduplicated newest episode items
 */
async function fetchNewEpisodes() {
    const apiClient = window.ApiClient;
    const serverUrl = apiClient.serverAddress();
    const token = apiClient.accessToken();
    const userId = apiClient.getCurrentUserId();
    
    // Compute ISO date range for the last 7 days
    const now = new Date();
    const maxDate = now.toISOString();
    const minDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
    
    const url = `${serverUrl}/Items?IncludeItemTypes=Episode` +
                `&LocationTypes=FileSystem` +
                `&Recursive=true` +
                `&SortBy=PremiereDate&SortOrder=Descending` +
                `&MinPremiereDate=${encodeURIComponent(minDate)}` +
                `&MaxPremiereDate=${encodeURIComponent(maxDate)}` +
                `&Limit=100` +
                `&Fields=PremiereDate,SeriesName,ParentIndexNumber,IndexNumber,ProviderIds,Path` +
                `&userId=${userId}`;
    
    try {
        const response = await fetch(url, {
            headers: { 'X-Emby-Token': token }
        });
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const data = await response.json();
        const episodes = data.Items || [];
        
        // Deduplicate episodes from the same series that aired on the same date
        const deduplicatedEpisodes = deduplicateEpisodesBySeriesAndDate(episodes);
        
        LOG(`Fetched ${episodes.length} episodes, deduplicated to ${deduplicatedEpisodes.length} episodes`);
        
        return deduplicatedEpisodes;
        
    } catch (err) {
        ERR('Failed to fetch new episodes:', err);
        return [];
    }
}

/**
 * Deduplicates episodes from the same series that aired on the same date
 * Keeps only the episode with the lowest index number (first episode of season)
 * @param {Array} episodes - Array of episode objects
 * @returns {Array} - Deduplicated array of episodes
 */
function deduplicateEpisodesBySeriesAndDate(episodes) {
    if (!episodes || episodes.length === 0) return [];
    
    // Group episodes by series name and premiere date
    const groupedEpisodes = new Map();
    
    episodes.forEach(episode => {
        const seriesName = episode.SeriesName || 'Unknown Series';
        const premiereDate = episode.PremiereDate || '';
        const key = `${seriesName}|${premiereDate}`;
        
        if (!groupedEpisodes.has(key)) {
            groupedEpisodes.set(key, []);
        }
        
        groupedEpisodes.get(key).push(episode);
    });
    
    // For each group, keep only the episode with the lowest index number
    const deduplicatedEpisodes = [];
    
    groupedEpisodes.forEach(episodeGroup => {
        if (episodeGroup.length === 1) {
            // Only one episode for this series/date, keep it
            deduplicatedEpisodes.push(episodeGroup[0]);
        } else {
            // Multiple episodes for this series/date, find the one with lowest index number
            const episodeWithLowestIndex = episodeGroup.reduce((lowest, current) => {
                const currentIndex = current.IndexNumber || 999999;
                const lowestIndex = lowest.IndexNumber || 999999;
                return currentIndex < lowestIndex ? current : lowest;
            });
            
            deduplicatedEpisodes.push(episodeWithLowestIndex);
            
            LOG(`Deduplicated ${episodeGroup.length} episodes from "${episodeGroup[0].SeriesName}" on ${episodeGroup[0].PremiereDate}, kept episode ${episodeWithLowestIndex.IndexNumber}`);
        }
    });
    
    return deduplicatedEpisodes;
}

/**
 * Renders New Movies section
 * @param {HTMLElement} container - Container to append the section to
 * @returns {Promise<boolean>} - Success status
 */
async function renderNewMoviesSection(container) {
    try {
        const movies = await fetchNewMovies();
        
        if (movies.length === 0) {
            return false;
        }
        
        // Check if cardBuilder is available
        if (typeof window.cardBuilder === 'undefined' || !window.cardBuilder.renderCards) {
            WARN("cardBuilder not available, skipping New Movies section");
            return false;
        }
        
        // Render the scrollable container
        const scrollableContainer = window.cardBuilder.renderCards(
            movies,
            'New Movies',
            null
        );
        
        // Add data attributes to track rendered sections
        scrollableContainer.setAttribute('data-custom-section-id', 'new-movies');
        scrollableContainer.setAttribute('data-custom-section-name', 'New Movies');
        scrollableContainer.style.order = 30;
        
        // Append to container
        container.appendChild(scrollableContainer);
        
        return true;
        
    } catch (err) {
        ERR('Error rendering New Movies section:', err);
        return false;
    }
}

/**
 * Renders New Episodes section
 * @param {HTMLElement} container - Container to append the section to
 * @returns {Promise<boolean>} - Success status
 */
async function renderNewEpisodesSection(container) {
    try {
        const episodes = await fetchNewEpisodes();
        
        if (episodes.length === 0) {
            return false;
        }
        
        // Check if cardBuilder is available
        if (typeof window.cardBuilder === 'undefined' || !window.cardBuilder.renderCards) {
            WARN("cardBuilder not available, skipping New Episodes section");
            return false;
        }
        
        // Render the scrollable container
        const scrollableContainer = window.cardBuilder.renderCards(
            episodes,
            'New Episodes',
            null
        );
        
        // Add data attributes to track rendered sections
        scrollableContainer.setAttribute('data-custom-section-id', 'new-episodes');
        scrollableContainer.setAttribute('data-custom-section-name', 'New Episodes');
        scrollableContainer.style.order = 31;
        
        // Append to container
        container.appendChild(scrollableContainer);
        
        return true;
        
    } catch (err) {
        ERR('Error rendering New Episodes section:', err);
        return false;
    }
}

/**
 * Renders watchlist section
 * @param {HTMLElement} container - Container to append the section to
 * @returns {boolean} - Success status
 */
function renderWatchlistSection(container) {
    try {
        const watchlistItems = getWatchlistData();
        
        if (watchlistItems.length === 0) {
            return false;
        }
        
        // Get 16 random items from watchlist
        const shuffled = [...watchlistItems].sort(() => Math.random() - 0.5);
        const limitedItems = shuffled.slice(0, 16);
        
        if (limitedItems.length === 0) {
            return false;
        }
        
        // Check if cardBuilder is available
        if (typeof window.cardBuilder === 'undefined' || !window.cardBuilder.renderCards) {
            WARN("cardBuilder not available, skipping watchlist section");
            return false;
        }

        // Render the scrollable container with function-based navigation
        const scrollableContainer = window.cardBuilder.renderCards(
            limitedItems,
            'My Watchlist',
            gotoWatchlistTab
        );
        
        // Add data attribute to track rendered sections
        scrollableContainer.setAttribute('data-custom-section-id', 'watchlist');
        scrollableContainer.setAttribute('data-custom-section-name', 'Your Watchlist');
        scrollableContainer.style.order = 32;
        
        // Append to container
        container.appendChild(scrollableContainer);
        
        return true;
        
    } catch (err) {
        ERR('Error rendering watchlist section:', err);
        return false;
    }
}

/**
 * Fetches full item objects from API using item IDs
 * @param {Array<string>} itemIds - Array of item IDs to fetch
 * @returns {Promise<Array>} Array of full item objects
 */
async function fetchItemsByIds(itemIds) {
    try {
        if (!itemIds || itemIds.length === 0) return [];
        
        const userId = ApiClient.getCurrentUserId();
        const serverId = ApiClient.serverId();
        
        // Use the Items endpoint to fetch multiple items by IDs
        const idsParam = itemIds.join(',');
        const url = `${ApiClient.serverAddress()}/Items?Ids=${idsParam}&UserId=${userId}&Fields=MediaSources,MediaStreams,Chapters,People,Genres,Studios,Taglines&EnableTotalRecordCount=false&EnableImageTypes=Primary,Backdrop,Thumb,Logo`;
        
        const response = await ApiClient.fetch({ url, method: 'GET' });
        const data = await response.json();
        
        return data.Items || [];
        
    } catch (err) {
        ERR('Error fetching items by IDs:', err);
        return [];
    }
}

/**
 * Generates a single group of discovery sections (6 sections total)
 * @returns {Promise<Array>} Array of section data objects
 */
async function generateDiscoveryGroup() {
    try {
        LOG('Generating single discovery group...');
        
        // Run all async operations in parallel for maximum speed
        const preloadPromises = [
            // 1. [Genre] Movies
            (async () => {
                const randomGenre = await getRandomGenre();
                if (randomGenre) {
                    const genreData = await preloadGenreSection(randomGenre);
                    if (genreData) {
                        return {
                            type: 'genre',
                            data: randomGenre,
                            items: genreData.items,
                            viewMoreUrl: genreData.viewMoreUrl
                        };
                    }
                }
                return null;
            })(),
            
            // 2. Directed by [Director] (async - fetch actual items)
            (async () => {
                if (moviesTopPeople && moviesTopPeople.directors.length > 0) {
                    const randomDirector = getRandomItem(moviesTopPeople.directors);
                    if (randomDirector && randomDirector.itemIds && randomDirector.itemIds.length > 0) {
                        // Validate that itemIds contain actual valid IDs (not undefined/null)
                        const validItemIds = randomDirector.itemIds.filter(id => id && typeof id === 'string' && id.trim() !== '');
                        if (validItemIds.length > 0) {
                            // Fetch actual items from API
                            const shuffledIds = shuffleArray(validItemIds).slice(0, 16);
                            const items = await fetchItemsByIds(shuffledIds);
                            
                            if (items && items.length > 0) {
                                return {
                                    type: 'director',
                                    data: randomDirector,
                                    items: items
                                };
                            }
                        }
                    }
                }
                return null;
            })(),
            
            // 3. Written by [Writer] (async - fetch actual items)
            (async () => {
                if (moviesTopPeople && moviesTopPeople.writers.length > 0) {
                    const randomWriter = getRandomItem(moviesTopPeople.writers);
                    if (randomWriter && randomWriter.itemIds && randomWriter.itemIds.length > 0) {
                        // Validate that itemIds contain actual valid IDs (not undefined/null)
                        const validItemIds = randomWriter.itemIds.filter(id => id && typeof id === 'string' && id.trim() !== '');
                        if (validItemIds.length > 0) {
                            // Fetch actual items from API
                            const shuffledIds = shuffleArray(validItemIds).slice(0, 16);
                            const items = await fetchItemsByIds(shuffledIds);
                            
                            if (items && items.length > 0) {
                                return {
                                    type: 'writer',
                                    data: randomWriter,
                                    items: items
                                };
                            }
                        }
                    }
                }
                return null;
            })(),
            
            // 4. Starring [Actor] (async - fetch actual items)
            (async () => {
                if (moviesTopPeople && moviesTopPeople.actors.length > 0) {
                    const randomActor = getRandomItem(moviesTopPeople.actors);
                    if (randomActor && randomActor.itemIds && randomActor.itemIds.length > 0) {
                        // Validate that itemIds contain actual valid IDs (not undefined/null)
                        const validItemIds = randomActor.itemIds.filter(id => id && typeof id === 'string' && id.trim() !== '');
                        if (validItemIds.length > 0) {
                            // Fetch actual items from API
                            const shuffledIds = shuffleArray(validItemIds).slice(0, 16);
                            const items = await fetchItemsByIds(shuffledIds);
                            
                            if (items && items.length > 0) {
                                return {
                                    type: 'actor',
                                    data: randomActor,
                                    items: items
                                };
                            }
                        }
                    }
                }
                return null;
            })(),
            
            // 5. Because you watched [Movie]
            (async () => {
                const randomWatchedMovie = getRandomWatchedMovie();
                if (randomWatchedMovie) {
                    const watchedData = await preloadBecauseYouWatchedSection(randomWatchedMovie);
                    if (watchedData) {
                        return {
                            type: 'watched',
                            data: randomWatchedMovie,
                            items: watchedData.items
                        };
                    }
                }
                return null;
            })(),
            
            // 6. Because you liked [Movie]
            (async () => {
                const randomLikedMovie = await getRandomFavoriteMovie();
                if (randomLikedMovie) {
                    const likedData = await preloadBecauseYouLikedSection(randomLikedMovie);
                    if (likedData) {
                        return {
                            type: 'liked',
                            data: randomLikedMovie,
                            items: likedData.items
                        };
                    }
                }
                return null;
            })()
        ];
        
        // Wait for all parallel operations to complete
        const preloadResults = await Promise.all(preloadPromises);
        
        // Filter out null results and collect valid sections
        const sections = preloadResults.filter(section => section !== null);
        
        LOG(`Generated discovery group with ${sections.length} sections`);
        return sections;
        
    } catch (err) {
        ERR('Error generating discovery group:', err);
        return [];
    }
}

/**
 * Ensures the discovery buffer has 2 groups of discovery items
 * Simple approach: always maintain 2 groups in buffer
 */
async function ensureDiscoveryBuffer() {
    const targetBufferSize = 2;
    
    if (discoveryBuffer.length >= targetBufferSize) {
        LOG(`Discovery buffer already has ${discoveryBuffer.length} groups (target: ${targetBufferSize})`);
        return;
    }
    
    LOG(`Ensuring discovery buffer has ${targetBufferSize} groups (current: ${discoveryBuffer.length})`);
    
    // Generate groups in parallel to fill the buffer
    const groupsToGenerate = targetBufferSize - discoveryBuffer.length;
    const generationPromises = [];
    
    for (let i = 0; i < groupsToGenerate; i++) {
        generationPromises.push(generateDiscoveryGroup());
    }
    
    try {
        const newGroups = await Promise.all(generationPromises);
        
        // Add non-empty groups to buffer
        newGroups.forEach(group => {
            if (group && group.length > 0) {
                discoveryBuffer.push(group);
            }
        });
        
        LOG(`Added ${newGroups.filter(g => g && g.length > 0).length} groups to discovery buffer (total: ${discoveryBuffer.length})`);
        
        // If we couldn't generate any new groups, mark that additional content is not available
        if (newGroups.every(group => !group || group.length === 0)) {
            additionalDiscoveryContent = false;
            LOG('No additional discovery content available');
        }
        
    } catch (err) {
        ERR('Error ensuring discovery buffer:', err);
        additionalDiscoveryContent = false;
    }
}

/**
 * Preloads the next batch of discovery sections in the background
 * Uses the new buffer-based system for better performance
 */
async function preloadNextSections() {
    if (isPreloadingSections) {
        LOG('Preloading already in progress, skipping...');
        return;
    }
    
    isPreloadingSections = true;
    
    try {
        LOG('Preloading discovery sections using buffer system...');
        
        // Ensure buffer has 2 groups (simple constant buffer)
        await ensureDiscoveryBuffer();
        
        LOG(`Discovery buffer populated with ${discoveryBuffer.length} groups`);
        
    } catch (err) {
        ERR('Error preloading discovery sections:', err);
    } finally {
        isPreloadingSections = false;
    }
}

/**
 * Renders the next group of discovery sections from the buffer
 * This is the unified function used by both infinite scroll and load more button
 * @param {HTMLElement} container - Container to render sections into
 * @param {HTMLElement} loadMoreButton - Optional load more button to update state
 * @returns {Promise<boolean>} - Success status
 */
async function renderNextDiscoveryGroup(container, loadMoreButton = null) {
    if (isRenderingDiscoveryGroup) {
        LOG('Discovery group rendering already in progress, skipping...');
        return false;
    }
    
    isRenderingDiscoveryGroup = true;
    
    try {
        LOG('Rendering next discovery group from buffer');
        
        // Show loading indicator
        showDiscoveryLoadingIndicator();
        
        // Check if we have a group in the buffer to render
        if (discoveryBuffer.length > 0) {
            LOG(`Rendering group from buffer (${discoveryBuffer.length} groups available)`);
            
            // Get the first group from buffer
            const groupToRender = discoveryBuffer.shift();
            
            // Render the group immediately
            if (groupToRender && groupToRender.length > 0) {
                let renderedCount = 0;
                
                for (const sectionData of groupToRender) {
                    try {
                        const success = await renderDiscoverySection(sectionData, container);
                        if (success) {
                            renderedCount++;
                        }
                    } catch (err) {
                        ERR(`Error rendering section ${sectionData.type}:`, err);
                    }
                }
                
                LOG(`Rendered ${renderedCount}/${groupToRender.length} sections from buffer`);
                
                // Update button state if provided
                if (loadMoreButton) {
                    if (discoveryBuffer.length > 0 || additionalDiscoveryContent) {
                        loadMoreButton.textContent = 'Discover More';
                        loadMoreButton.disabled = false;
                        loadMoreButton.style.opacity = '1';
                    } else {
                        // No more content available, hide button
                        loadMoreButton.style.display = 'none';
                    }
                }
                
                return renderedCount > 0;
            }
        } else {
            LOG('No groups in buffer, ensuring buffer is populated...');
            
            // Ensure buffer is populated
            await ensureDiscoveryBuffer();
            
            // Try again after buffer is populated
            if (discoveryBuffer.length > 0) {
                return await renderNextDiscoveryGroup(container, loadMoreButton);
            } else {
                // Still no content, hide button if provided
                if (loadMoreButton) {
                    loadMoreButton.style.display = 'none';
                }
                return false;
            }
        }
        
        return false;
        
    } catch (err) {
        ERR('Error rendering next discovery group:', err);
        return false;
    } finally {
        isRenderingDiscoveryGroup = false;
        
        // Hide loading indicator
        hideDiscoveryLoadingIndicator();
    }
}

/**
 * Handles the "Discover More" button click using the buffer system
 * @param {HTMLElement} loadMoreButton - The button element
 */
async function handleDiscoverMoreClick(loadMoreButton) {
    try {
        LOG('Discover More button clicked');
        
        const homeSectionsContainer = document.querySelector('.homeSectionsContainer');
        if (homeSectionsContainer) {
            await renderNextDiscoveryGroup(homeSectionsContainer, loadMoreButton);
            
            // Trigger background refill of buffer (don't await)
            ensureDiscoveryBuffer().catch(err => {
                ERR('Error refilling discovery buffer:', err);
            });
        } else {
            ERR('Home sections container not found');
        }
        
    } catch (err) {
        ERR('Error handling Discover More click:', err);
        
        // Reset button state on error
        loadMoreButton.textContent = 'Discover More';
        loadMoreButton.disabled = false;
        loadMoreButton.style.opacity = '1';
    }
}

/**
 * Preloads genre section data
 * @param {Object} genre - Genre object
 * @returns {Promise<Object|null>} - Genre data with items and viewMoreUrl
 */
async function preloadGenreSection(genre) {
    try {
        const apiClient = window.ApiClient;
        const serverUrl = apiClient.serverAddress();
        const token = apiClient.accessToken();
        const userId = apiClient.getCurrentUserId();
        const serverId = apiClient.serverId();
        
        const url = `${serverUrl}/Items?userId=${userId}&Genres=${encodeURIComponent(genre.Name)}&IncludeItemTypes=Movie&Recursive=true&SortBy=Random&Limit=16`;
        
        const response = await fetch(url, {
            headers: {
                "Authorization": `MediaBrowser Token="${token}"`
            }
        });
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const data = await response.json();
        const items = data.Items || [];
        
        if (items.length === 0) return null;
        
        const viewMoreUrl = `/web/#/list.html?genreId=${genre.Id}&serverId=${serverId}`;
        
        return {
            items: items,
            viewMoreUrl: viewMoreUrl,
            hasFullItems: true
        };
        
    } catch (err) {
        ERR(`Error preloading genre section for ${genre.Name}:`, err);
        return null;
    }
}

/**
 * Preloads "because you watched" section data
 * @param {Object} movie - Movie object
 * @returns {Promise<Object|null>} - Similar content data
 */
async function preloadBecauseYouWatchedSection(movie) {
    try {
        const items = await fetchSimilarContent(movie.Id, 'Movie');
        if (items.length === 0) return null;
        
        return {
            items: items.slice(0, 16),
            hasFullItems: true
        };
        
    } catch (err) {
        ERR(`Error preloading because you watched section for ${movie.Name}:`, err);
        return null;
    }
}

/**
 * Preloads "because you liked" section data
 * @param {Object} movie - Movie object
 * @returns {Promise<Object|null>} - Similar content data
 */
async function preloadBecauseYouLikedSection(movie) {
    try {
        const items = await fetchSimilarContent(movie.Id, 'Movie');
        if (items.length === 0) return null;
        
        return {
            items: items.slice(0, 16),
            hasFullItems: true
        };
        
    } catch (err) {
        ERR(`Error preloading because you liked section for ${movie.Name}:`, err);
        return null;
    }
}

/**
 * Generates discovery sections with infinite loading behavior
 * @param {HTMLElement} container - Container to append sections to
 * @returns {Promise<boolean>} - Success status
 */
async function generateDiscoverySections(container) {
    if (isGeneratingDiscoverySections) {
        LOG('Discovery sections generation already in progress, skipping...');
        return false;
    }
    
    isGeneratingDiscoverySections = true;
    
    // Show loading indicator
    showDiscoveryLoadingIndicator();
    
    try {
        // Ensure people cache is initialized
        if (!moviesTopPeople) {
            await initializePeopleCache();
            
            // If people cache is still not available (initialization failed or in progress), 
            // skip people-related sections
            if (!moviesTopPeople) {
                LOG('People cache not available, skipping people-related sections');
            }
        }
        
        let successCount = 0;
        
        // First, try to unhide preloaded sections
        if (preloadedSectionElements.length >= 6) {
            LOG('Unhiding preloaded sections for instant display');
            const sectionsToUnhide = preloadedSectionElements.splice(0, 6); // Take first 6 and remove them
            
            for (const sectionElement of sectionsToUnhide) {
                try {
                    // Unhide the section
                    sectionElement.style.display = '';
                    sectionElement.removeAttribute('data-preloaded');
                    successCount++;
                } catch (err) {
                    ERR('Error unhiding preloaded section:', err);
                }
            }
            
            // Also remove corresponding data
            preloadedSections.splice(0, 6);
            
            LOG(`Unhid ${successCount} preloaded discovery sections`);
        } else if (preloadedSections.length >= 6) {
            // Fallback: use preloaded data to render sections
            LOG('Using preloaded data for instant rendering');
            const sectionsToRender = preloadedSections.splice(0, 6); // Take first 6 and remove them
            
            const results = await Promise.all(
                sectionsToRender.map(section => renderDiscoverySection(section, container))
            );
            successCount = results.filter(Boolean).length;
            
            LOG(`Generated ${successCount}/${sectionsToRender.length} discovery sections from preloaded data`);
        } else {
            // Generate new sections if not enough preloaded
            LOG('Generating new sections (not enough preloaded)');
            const sectionsToRender = await generateNewSections();
            
            const results = await Promise.all(
                sectionsToRender.map(section => renderDiscoverySection(section, container))
            );
            successCount = results.filter(Boolean).length;
            
            LOG(`Generated ${successCount}/${sectionsToRender.length} new discovery sections`);
        }
        
        // Immediately start preloading next batch (don't await)
        preloadNextSections();
        
        return successCount > 0;
        
    } catch (err) {
        ERR('Error generating discovery sections:', err);
        return false;
    } finally {
        isGeneratingDiscoverySections = false;
        
        // Hide loading indicator
        hideDiscoveryLoadingIndicator();
    }
}

/**
 * Generates new sections when preloaded data is not available
 * @returns {Promise<Array>} - Array of section data
 */
async function generateNewSections() {
    const sectionsToRender = [];
    
    // 1. [Genre] Movies
    const randomGenre = await getRandomGenre();
    if (randomGenre) {
        const genreData = await preloadGenreSection(randomGenre);
        if (genreData) {
            sectionsToRender.push({
                type: 'genre',
                data: randomGenre,
                items: genreData.items,
                viewMoreUrl: genreData.viewMoreUrl
            });
        }
    }
    
    // 2. Directed by [Director]
    if (moviesTopPeople && moviesTopPeople.directors.length > 0) {
        const randomDirector = getRandomItem(moviesTopPeople.directors);
        if (randomDirector) {
            sectionsToRender.push({
                type: 'director',
                data: randomDirector,
                items: shuffleArray(randomDirector.itemIds).slice(0, 16)
            });
        }
    }
    
    // 3. Written by [Writer]
    if (moviesTopPeople && moviesTopPeople.writers.length > 0) {
        const randomWriter = getRandomItem(moviesTopPeople.writers);
        if (randomWriter) {
            sectionsToRender.push({
                type: 'writer',
                data: randomWriter,
                items: shuffleArray(randomWriter.itemIds).slice(0, 16)
            });
        }
    }
    
    // 4. Starring [Actor]
    if (moviesTopPeople && moviesTopPeople.actors.length > 0) {
        const randomActor = getRandomItem(moviesTopPeople.actors);
        if (randomActor) {
            sectionsToRender.push({
                type: 'actor',
                data: randomActor,
                items: shuffleArray(randomActor.itemIds).slice(0, 16)
            });
        }
    }
    
    // 5. Because you watched [Movie]
    const randomWatchedMovie = getRandomWatchedMovie();
    if (randomWatchedMovie) {
        const watchedData = await preloadBecauseYouWatchedSection(randomWatchedMovie);
        if (watchedData) {
            sectionsToRender.push({
                type: 'watched',
                data: randomWatchedMovie,
                items: watchedData.items
            });
        }
    }
    
    // 6. Because you liked [Movie]
    const randomLikedMovie = await getRandomFavoriteMovie();
    if (randomLikedMovie) {
        const likedData = await preloadBecauseYouLikedSection(randomLikedMovie);
        if (likedData) {
            sectionsToRender.push({
                type: 'liked',
                data: randomLikedMovie,
                items: likedData.items
            });
        }
    }
    
    return sectionsToRender;
}

/**
 * Renders a discovery section (unified function for both preloaded and dynamic sections)
 * @param {Object|string} sectionData - Preloaded section data object OR section type string
 * @param {HTMLElement} container - Container to append section to
 * @returns {Promise<boolean>} - Success status
 */
async function renderDiscoverySection(sectionData, container) {
    try {
        let sectionName = '';
        let items = [];
        let viewMoreUrl = null;
        let sectionId = '';
        let order = 200 + renderedSections.size;
        
        // Handle preloaded section data
        if (typeof sectionData === 'object' && sectionData.type) {
            if (!sectionData.items || sectionData.items.length === 0) return false;
            
            items = sectionData.items;
            viewMoreUrl = sectionData.viewMoreUrl || null;
            
            switch (sectionData.type) {
                case 'genre':
                    sectionName = `${sectionData.data.Name} Movies`;
                    sectionId = `genre-${sectionData.data.Name.toLowerCase()}`;
                    break;
                case 'director':
                    sectionName = `Directed by ${sectionData.data.name}`;
                    sectionId = `director-${sectionData.data.name.toLowerCase().replace(/\s+/g, '-')}`;
                    break;
                case 'writer':
                    sectionName = `Written by ${sectionData.data.name}`;
                    sectionId = `writer-${sectionData.data.name.toLowerCase().replace(/\s+/g, '-')}`;
                    break;
                case 'actor':
                    sectionName = `Starring ${sectionData.data.name}`;
                    sectionId = `actor-${sectionData.data.name.toLowerCase().replace(/\s+/g, '-')}`;
                    break;
                case 'watched':
                    sectionName = `Because you watched ${sectionData.data.Name} ${sectionData.data.ProductionYear ? `(${sectionData.data.ProductionYear})` : ''}`;
                    sectionId = `watched-${sectionData.data.Id}`;
                    break;
                case 'liked':
                    sectionName = `Because you liked ${sectionData.data.Name} ${sectionData.data.ProductionYear ? `(${sectionData.data.ProductionYear})` : ''}`;
                    sectionId = `liked-${sectionData.data.Id}`;
                    break;
                default:
                    return false;
            }
        }
        // Handle dynamic section generation (legacy support)
        else if (typeof sectionData === 'string') {
            const sectionType = sectionData;
        
        switch (sectionType) {
            case 'watched-movie': {
                const randomMovie = getRandomWatchedMovie();
                if (!randomMovie) return false;
                
                sectionName = `Because you watched ${randomMovie.Name} ${randomMovie.ProductionYear ? `(${randomMovie.ProductionYear})` : ''}`;
                items = await fetchSimilarContent(randomMovie.Id, 'Movie');
                sectionId = 'watched-movie';
                order = 102;
                break;
            }
            
            case 'watched-series': {
                const randomSeries = getRandomWatchedSeries();
                if (!randomSeries) return false;
                
                sectionName = `Because you watched ${randomSeries.Name} ${randomSeries.ProductionYear ? `(${randomSeries.ProductionYear})` : ''}`;
                items = await fetchSimilarContent(randomSeries.Id, 'Series');
                sectionId = 'watched-series';
                order = 103;
                break;
            }
            
            case 'liked-movie': {
                const randomMovie = await getRandomFavoriteMovie();
                if (!randomMovie) return false;
                
                sectionName = `Because you liked ${randomMovie.Name} ${randomMovie.ProductionYear ? `(${randomMovie.ProductionYear})` : ''}`;
                items = await fetchSimilarContent(randomMovie.Id, 'Movie');
                sectionId = 'liked-movie';
                order = 104;
                break;
            }
            
            case 'liked-series': {
                const randomSeries = await getRandomFavoriteSeries();
                if (!randomSeries) return false;
                
                sectionName = `Because you liked ${randomSeries.Name} ${randomSeries.ProductionYear ? `(${randomSeries.ProductionYear})` : ''}`;
                items = await fetchSimilarContent(randomSeries.Id, 'Series');
                sectionId = 'liked-series';
                order = 105;
                break;
            }
            
            case 'directed-by': {
                const randomDirector = getRandomDirector();
                if (!randomDirector) return false;
                
                sectionName = `Directed by ${randomDirector.Name}`;
                items = await fetchPersonItems(randomDirector.Id, 'Movie');
                sectionId = 'directed-by';
                order = 106;
                
                // Generate view more URL for person details
                const apiClient = window.ApiClient;
                const serverId = apiClient.serverId();
                viewMoreUrl = `/web/#/details?id=${randomDirector.Id}&serverId=${serverId}`;
                break;
            }
            
            case 'starring': {
                const randomActor = getRandomActor();
                if (!randomActor) return false;
                
                sectionName = `Starring ${randomActor.Name}`;
                items = await fetchPersonItems(randomActor.Id, 'Movie');
                sectionId = 'starring';
                order = 107;
                
                // Generate view more URL for person details
                const apiClient = window.ApiClient;
                const serverId = apiClient.serverId();
                viewMoreUrl = `/web/#/details?id=${randomActor.Id}&serverId=${serverId}`;
                break;
            }
            
            default:
                return false;
        }
        }
        
        if (items.length === 0) {
            return false;
        }
        
        // Limit to 16 items
        const limitedItems = items.slice(0, 16);
        
        // Check if cardBuilder is available
        if (typeof window.cardBuilder === 'undefined') {
            WARN("cardBuilder not available, skipping discovery section");
            return false;
        }
        
        // Determine if we have full items or just IDs
        const hasFullItems = limitedItems.length > 0 && limitedItems[0] && typeof limitedItems[0] === 'object' && limitedItems[0].Id;
        
        let scrollableContainer;
        if (hasFullItems) {
            // Use renderCards for full item objects
            if (!window.cardBuilder.renderCards) {
                WARN("cardBuilder.renderCards not available, skipping discovery section");
                return false;
            }
            scrollableContainer = window.cardBuilder.renderCards(limitedItems, sectionName, viewMoreUrl);
        } else {
            // Use renderCardsFromIds for ID arrays
            if (!window.cardBuilder.renderCardsFromIds) {
                WARN("cardBuilder.renderCardsFromIds not available, skipping discovery section");
                return false;
            }
            scrollableContainer = await window.cardBuilder.renderCardsFromIds(limitedItems, sectionName, viewMoreUrl);
        }
        
        // Add data attributes to track rendered sections
        scrollableContainer.setAttribute('data-custom-section-id', sectionId);
        scrollableContainer.setAttribute('data-custom-section-name', sectionName);
        scrollableContainer.style.order = order;
        
        // Append to container
        container.appendChild(scrollableContainer);
        
        // Track rendered section for preloaded sections
        if (typeof sectionData === 'object') {
            renderedSections.add(sectionId);
        }
        
        return true;
        
    } catch (err) {
        ERR(`Error rendering discovery section:`, err);
        return false;
    }
}


/**
 * Sets up infinite loading for discovery sections
 * @param {HTMLElement} container - Container to watch for scroll
 */
function setupInfiniteLoading(container) {
    if (enableInfiniteScroll) {
        setupScrollBasedLoading(container);
    } else {
        setupLoadMoreButton(container);
    }
}

/**
 * Sets up scroll-based infinite loading
 * @param {HTMLElement} container - Container to watch for scroll
 */
function setupScrollBasedLoading(container) {
    let lastScrollTop = 0;
    let scrollTimeout = null;
    
    const handleScroll = () => {
        if (isRenderingDiscoveryGroup) return;
        
        const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
        const windowHeight = window.innerHeight;
        const documentHeight = document.documentElement.scrollHeight;
        
        // Check if user has scrolled to bottom 30% of the page
        const scrollPercentage = (scrollTop + windowHeight) / documentHeight;
        
        if (scrollPercentage >= 0.7 && scrollTop > lastScrollTop) {
            // Clear any existing timeout
            if (scrollTimeout) {
                clearTimeout(scrollTimeout);
            }
            
            // Debounce the scroll event
            scrollTimeout = setTimeout(async () => {
                LOG('User scrolled to bottom 30%, rendering more discovery sections from buffer...');
                await renderNextDiscoveryGroup(container);
            }, 500);
        }
        
        lastScrollTop = scrollTop;
    };
    
    // Add scroll listener
    window.addEventListener('scroll', handleScroll, { passive: true });
    
    LOG('Scroll-based infinite loading for discovery sections enabled');
}

/**
 * Sets up load more button for discovery sections
 * @param {HTMLElement} container - Container to append button to
 */
function setupLoadMoreButton(container) {
    // Create load more button
    const loadMoreButton = document.createElement('button');
    loadMoreButton.textContent = 'Discover More';
    loadMoreButton.className = 'load-more-discovery-btn';
    loadMoreButton.style.cssText = `
        order: 9998 !important;
        display: block;
        width: 100%;
        max-width: 400px;
        margin: 20px auto;
        padding: 12px 24px;
        background: var(--btnSubmitColor);
        color: white;
        border: none;
        border-radius: 6px;
        font-size: 16px;
        font-weight: 600;
        cursor: pointer;
        transition: all 0.2s ease;
        box-shadow: 0 2px 8px rgba(0, 164, 220, 0.3);
    `;
    
    // Add hover effects
    loadMoreButton.addEventListener('mouseenter', () => {
        loadMoreButton.style.transform = 'translateY(-2px)';
        loadMoreButton.style.boxShadow = '0 4px 12px rgba(0, 164, 220, 0.4)';
    });
    
    loadMoreButton.addEventListener('mouseleave', () => {
        loadMoreButton.style.transform = 'translateY(0)';
        loadMoreButton.style.boxShadow = '0 2px 8px rgba(0, 164, 220, 0.3)';
    });
    
    // Add click handler using new buffer system
    loadMoreButton.addEventListener('click', async () => {
        await handleDiscoverMoreClick(loadMoreButton);
    });
    
    // Append button to container
    container.appendChild(loadMoreButton);
    
    LOG('Load more button for discovery sections enabled');
}

/**
 * Gets a random genre that hasn't been rendered yet
 * @returns {Promise<Object|null>} - Random genre or null
 */
async function getRandomGenre() {
    const cache = new window.LocalStorageCache();
    let movieGenres = cache.get('movieGenres');
    
    if (!movieGenres || movieGenres.length === 0) {
        movieGenres = await fetchAndCacheMovieGenres();
    }
    
    if (movieGenres.length === 0) return null;
    
    // Filter out already rendered genres and genres with insufficient movie count
    const availableGenres = movieGenres.filter(genre => 
        !renderedSections.has(`genre-${genre.Name.toLowerCase()}`) &&
        (genre.MovieCount || 0) >= minGenreMovieCount
    );
    
    if (availableGenres.length === 0) return null;
    
    const randomGenre = getRandomItem(availableGenres);
    if (randomGenre) {
        renderedSections.add(`genre-${randomGenre.Name.toLowerCase()}`);
    }
    
    return randomGenre;
}

/**
 * Renders a genre section
 * @param {Object} genre - Genre object
 * @param {HTMLElement} container - Container to append section to
 * @returns {Promise<boolean>} - Success status
 */
async function renderGenreSection(genre, container) {
    try {
        const apiClient = window.ApiClient;
        const serverUrl = apiClient.serverAddress();
        const token = apiClient.accessToken();
        const userId = apiClient.getCurrentUserId();
        const serverId = apiClient.serverId();
        
        const url = `${serverUrl}/Items?userId=${userId}&Genres=${encodeURIComponent(genre.Name)}&IncludeItemTypes=Movie&Recursive=true&SortBy=Random&Limit=16`;
        
        const response = await fetch(url, {
            headers: {
                "Authorization": `MediaBrowser Token="${token}"`
            }
        });
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const data = await response.json();
        const items = data.Items || [];
        
        if (items.length === 0) return false;
        
        const viewMoreUrl = `/web/#/list.html?genreId=${genre.Id}&serverId=${serverId}`;
        
        if (typeof window.cardBuilder === 'undefined' || !window.cardBuilder.renderCards) {
            WARN("cardBuilder not available, skipping genre section");
            return false;
        }
        
        const scrollableContainer = window.cardBuilder.renderCards(
            items,
            `${genre.Name} Movies`,
            viewMoreUrl
        );
        
        scrollableContainer.setAttribute('data-custom-section-id', `genre-${genre.Name.toLowerCase()}`);
        scrollableContainer.setAttribute('data-custom-section-name', `${genre.Name} Movies`);
        scrollableContainer.style.order = 200 + renderedSections.size;
        
        container.appendChild(scrollableContainer);
        return true;
        
    } catch (err) {
        ERR(`Error rendering genre section for ${genre.Name}:`, err);
        return false;
    }
}

/**
 * Renders a person section (director, writer, actor)
 * @param {string} personType - Type of person ('director', 'writer', 'actor')
 * @param {Object} person - Person object with name and itemIds
 * @param {HTMLElement} container - Container to append section to
 * @returns {Promise<boolean>} - Success status
 */
async function renderPersonSection(personType, person, container) {
    try {
        if (!person.itemIds || person.itemIds.length === 0) return false;
        
        // Limit to 16 items and randomize order
        const limitedItemIds = shuffleArray(person.itemIds).slice(0, 16);
        
        if (typeof window.cardBuilder === 'undefined' || !window.cardBuilder.renderCardsFromIds) {
            WARN("cardBuilder not available, skipping person section");
            return false;
        }
        
        const sectionName = personType === 'actor' ? `Starring ${person.name}` : 
                          personType === 'director' ? `Directed by ${person.name}` : 
                          `Written by ${person.name}`;
        
        const scrollableContainer = await window.cardBuilder.renderCardsFromIds(
            limitedItemIds,
            sectionName,
            null
        );
        
        const sectionId = `${personType}-${person.name.toLowerCase().replace(/\s+/g, '-')}`;
        scrollableContainer.setAttribute('data-custom-section-id', sectionId);
        scrollableContainer.setAttribute('data-custom-section-name', sectionName);
        scrollableContainer.style.order = 200 + renderedSections.size;
        
        container.appendChild(scrollableContainer);
        
        // Track rendered section
        renderedSections.add(sectionId);
        
        return true;
        
    } catch (err) {
        ERR(`Error rendering ${personType} section for ${person.name}:`, err);
        return false;
    }
}

/**
 * Renders "Because you watched" section
 * @param {Object} movie - Movie object
 * @param {HTMLElement} container - Container to append section to
 * @returns {Promise<boolean>} - Success status
 */
async function renderBecauseYouWatchedSection(movie, container) {
    try {
        const items = await fetchSimilarContent(movie.Id, 'Movie');
        if (items.length === 0) return false;
        
        const limitedItems = items.slice(0, 16);
        
        if (typeof window.cardBuilder === 'undefined' || !window.cardBuilder.renderCards) {
            WARN("cardBuilder not available, skipping because you watched section");
            return false;
        }
        
        const sectionName = `Because you watched ${movie.Name} ${movie.ProductionYear ? `(${movie.ProductionYear})` : ''}`;
        
        const scrollableContainer = window.cardBuilder.renderCards(
            limitedItems,
            sectionName,
            null
        );
        
        const sectionId = `watched-${movie.Id}`;
        scrollableContainer.setAttribute('data-custom-section-id', sectionId);
        scrollableContainer.setAttribute('data-custom-section-name', sectionName);
        scrollableContainer.style.order = 200 + renderedSections.size;
        
        container.appendChild(scrollableContainer);
        
        // Track rendered section
        renderedSections.add(sectionId);
        
        return true;
        
    } catch (err) {
        ERR(`Error rendering because you watched section for ${movie.Name}:`, err);
            return false;
    }
}

/**
 * Renders "Because you liked" section
 * @param {Object} movie - Movie object
 * @param {HTMLElement} container - Container to append section to
 * @returns {Promise<boolean>} - Success status
 */
async function renderBecauseYouLikedSection(movie, container) {
    try {
        const items = await fetchSimilarContent(movie.Id, 'Movie');
        if (items.length === 0) return false;
        
        const limitedItems = items.slice(0, 16);
        
        if (typeof window.cardBuilder === 'undefined' || !window.cardBuilder.renderCards) {
            WARN("cardBuilder not available, skipping because you liked section");
            return false;
        }
        
        const sectionName = `Because you liked ${movie.Name} ${movie.ProductionYear ? `(${movie.ProductionYear})` : ''}`;
        
        const scrollableContainer = window.cardBuilder.renderCards(
            limitedItems,
            sectionName,
            null
        );
        
        const sectionId = `liked-${movie.Id}`;
        scrollableContainer.setAttribute('data-custom-section-id', sectionId);
        scrollableContainer.setAttribute('data-custom-section-name', sectionName);
        scrollableContainer.style.order = 200 + renderedSections.size;
        
        container.appendChild(scrollableContainer);
        
        // Track rendered section
        renderedSections.add(sectionId);
        
        return true;
        
    } catch (err) {
        ERR(`Error rendering because you liked section for ${movie.Name}:`, err);
        return false;
    }
}

/**
 * Renders discovery section based on type
 * @param {string} sectionType - Type of discovery section
 * @param {HTMLElement} container - Container to append the section to
 * @returns {boolean} - Success status
 */

/**
 * Renders Halloween Movies section
 * @param {HTMLElement} container - Container to append the section to
 * @returns {boolean} - Success status
 */
function renderHalloweenMoviesSection(container) {
    try {
        if (halloweenMovies.length === 0) return false;
        
        const shuffled = [...halloweenMovies].sort(() => Math.random() - 0.5);
        const limitedItems = shuffled.slice(0, SEASONAL_ITEM_LIMIT);
        
        if (limitedItems.length === 0) return false;
        
        // Check if cardBuilder is available
        if (typeof window.cardBuilder === 'undefined' || !window.cardBuilder.renderCards) {
            WARN("cardBuilder not available, skipping Halloween Movies section");
            return false;
        }
        
        // Render the scrollable container
        const scrollableContainer = window.cardBuilder.renderCards(
            limitedItems,
            'Halloween Movies',
            null
        );
        
        scrollableContainer.setAttribute('data-custom-section-id', 'halloween-movies');
        scrollableContainer.setAttribute('data-custom-section-name', 'Halloween Movies');
        scrollableContainer.style.order = 50;
        
        container.appendChild(scrollableContainer);
        return true;
        
    } catch (err) {
        ERR('Error rendering Halloween Movies section:', err);
        return false;
    }
}

/**
 * Renders Horror Movies section
 * @param {HTMLElement} container - Container to append the section to
 * @returns {boolean} - Success status
 */
function renderHorrorMoviesSection(container) {
    try {
        if (horrorMovies.length === 0) return false;
        
        const shuffled = [...horrorMovies].sort(() => Math.random() - 0.5);
        const limitedItems = shuffled.slice(0, SEASONAL_ITEM_LIMIT);
        
        if (limitedItems.length === 0) return false;
        
        // Check if cardBuilder is available
        if (typeof window.cardBuilder === 'undefined' || !window.cardBuilder.renderCards) {
            WARN("cardBuilder not available, skipping Horror Movies section");
            return false;
        }
        
        // Render the scrollable container
        const scrollableContainer = window.cardBuilder.renderCards(
            limitedItems,
            'Horror Movies',
            halloweenViewMoreUrls.horror
        );
        
        scrollableContainer.setAttribute('data-custom-section-id', 'horror-movies');
        scrollableContainer.setAttribute('data-custom-section-name', 'Horror Movies');
        scrollableContainer.style.order = 51;
        
        container.appendChild(scrollableContainer);
        return true;
        
    } catch (err) {
        ERR('Error rendering Horror Movies section:', err);
        return false;
    }
}

/**
 * Renders Thriller Movies section
 * @param {HTMLElement} container - Container to append the section to
 * @returns {boolean} - Success status
 */
function renderThrillerMoviesSection(container) {
    try {
        if (thrillerMovies.length === 0) return false;
        
        const shuffled = [...thrillerMovies].sort(() => Math.random() - 0.5);
        const limitedItems = shuffled.slice(0, SEASONAL_ITEM_LIMIT);
        
        if (limitedItems.length === 0) return false;
        
        // Check if cardBuilder is available
        if (typeof window.cardBuilder === 'undefined' || !window.cardBuilder.renderCards) {
            WARN("cardBuilder not available, skipping Thriller Movies section");
            return false;
        }
        
        // Render the scrollable container
        const scrollableContainer = window.cardBuilder.renderCards(
            limitedItems,
            'Thriller Movies',
            halloweenViewMoreUrls.thriller
        );
        
        scrollableContainer.setAttribute('data-custom-section-id', 'thriller-movies');
        scrollableContainer.setAttribute('data-custom-section-name', 'Thriller Movies');
        scrollableContainer.style.order = 52;
        
        container.appendChild(scrollableContainer);
        return true;
        
    } catch (err) {
        ERR('Error rendering Thriller Movies section:', err);
        return false;
    }
}


/**
 * Renders all Halloween sections
 * @param {HTMLElement} container - Container to append sections to
 */
async function renderAllHalloweenSections(container) {
    if (!isHalloweenPeriod()) {
        LOG('Not in Halloween period, skipping Halloween sections');
        return;
    }
    
    try {
        // Fetch Halloween data if not already loaded
        if (halloweenMovies.length === 0) {
            LOG('Fetching Halloween movie data...');
            const movieData = await fetchHalloweenMovieData();
            halloweenMovies = movieData.halloweenMovies;
            horrorMovies = movieData.horrorMovies;
            thrillerMovies = movieData.thrillerMovies;
            halloweenViewMoreUrls = movieData.viewMoreUrls;
            
        }
        
        const results = [
            renderHalloweenMoviesSection(container),
            renderHorrorMoviesSection(container),
            renderThrillerMoviesSection(container)
        ];
        
        const successCount = results.filter(Boolean).length;
        LOG(`Rendered ${successCount}/${results.length} Halloween sections`);
        return successCount === results.length;
        
    } catch (err) {
        ERR('Error rendering Halloween sections:', err);
    }
}

/**
 * Renders all Christmas sections (stub for future implementation)
 * @param {HTMLElement} container - Container to append sections to
 */
async function renderAllChristmasSections(container) {
    if (!isChristmasPeriod()) {
        LOG('Not in Christmas period, skipping Christmas sections');
        return;
    }
    
    // TODO: Implement Christmas sections
    LOG('Christmas sections not yet implemented');
}

/**
 * Renders all New Years sections (stub for future implementation)
 * @param {HTMLElement} container - Container to append sections to
 */
async function renderAllNewYearsSections(container) {
    if (!isNewYearsPeriod()) {
        LOG('Not in New Years period, skipping New Years sections');
        return;
    }
    
    // TODO: Implement New Years sections
    LOG('New Years sections not yet implemented');
}

/**
 * Renders all Valentine's Day sections (stub for future implementation)
 * @param {HTMLElement} container - Container to append sections to
 */
async function renderAllValentinesSections(container) {
    if (!isValentinesPeriod()) {
        LOG('Not in Valentine\'s Day period, skipping Valentine\'s Day sections');
        return;
    }
    
    // TODO: Implement Valentine's Day sections
    LOG('Valentine\'s Day sections not yet implemented');
}

/**
 * Renders all seasonal sections based on current date
 * @param {HTMLElement} container - Container to append sections to
 */
async function renderAllSeasonalSections(container) {
    const sectionsToRender = [];
    
    // Add Halloween sections if in Halloween period
    if (isHalloweenPeriod()) {
        sectionsToRender.push(renderAllHalloweenSections(container));
    }
    
    // Add Christmas sections if in Christmas period
    if (isChristmasPeriod()) {
        sectionsToRender.push(renderAllChristmasSections(container));
    }
    
    // Add New Years sections if in New Years period
    if (isNewYearsPeriod()) {
        sectionsToRender.push(renderAllNewYearsSections(container));
    }
    
    // Add Valentine's Day sections if in Valentine's Day period
    if (isValentinesPeriod()) {
        sectionsToRender.push(renderAllValentinesSections(container));
    }
    
    if (sectionsToRender.length === 0) {
        LOG('No seasonal periods active, skipping seasonal sections');
        return;
    }
    
    const results = await Promise.all(sectionsToRender);
    const successCount = results.filter(Boolean).length;
    LOG(`Rendered ${successCount}/${sectionsToRender.length} seasonal section groups`);
}

/************ Home Screen Observer ************/

/**
 * Checks if custom sections are already rendered and renders them if not
 */
async function checkAndRenderCustomSections() {
    // Check if already processing to prevent parallel execution
    if (isProcessing) {
        return;
    }
    
    // Try multiple selectors to find the container
    const selectors = [
        '.libraryPage:not(.hide) .homeSectionsContainer',
        '.homeSectionsContainer',
        '.homeSectionsContainer:not(.hide)',
        '[class*="homeSections"]'
    ];
    
    let homeSectionsContainer = null;
    for (const selector of selectors) {
        homeSectionsContainer = document.querySelector(selector);
        if (homeSectionsContainer) {
            break;
        }
    }
    
    if (!homeSectionsContainer) {
        return;
    }
    
    // Check if sections are already rendered
    const hasRenderedCustomSections = customHomeSections.some(section => 
        homeSectionsContainer.querySelector(`[data-custom-section-id="${section.id}"]`)
    );
    
    const hasRenderedNewAndTrendingSections = (enableNewMovies && homeSectionsContainer.querySelector('[data-custom-section-id="new-movies"]')) ||
        (enableNewEpisodes && homeSectionsContainer.querySelector('[data-custom-section-id="new-episodes"]')) ||
        (enableTrending && homeSectionsContainer.querySelector('[data-custom-section-id="trending-movies"]'));
    
    const hasRenderedDiscoverySections = (enableWatchlist && homeSectionsContainer.querySelector('[data-custom-section-id="watchlist"]')) ||
        (enableDiscovery && homeSectionsContainer.querySelector('[data-custom-section-id="watched-movie"]')) ||
        (enableSeasonal && homeSectionsContainer.querySelector('[data-custom-section-id="halloween-movies"]'));
    
    if (hasRenderedCustomSections || hasRenderedNewAndTrendingSections || hasRenderedDiscoverySections) {
        return;
    }
    
    // Set processing flag to prevent parallel execution
    isProcessing = true;
    
    try {
        LOG('Starting parallel initialization of home screen sections...');
        
        // Run all initialization functions in parallel for faster loading
        const initPromises = [
            // Initialize people cache in background (non-blocking)
            initializePeopleCache(),
            
            // Render custom sections
            renderAllCustomSections(homeSectionsContainer),
            
            // Render new and trending sections
            renderAllNewAndTrendingSections(homeSectionsContainer),

            // Render seasonal sections
            renderAllSeasonalSections(homeSectionsContainer),

            // Render watchlist section
            renderWatchlistSection(homeSectionsContainer),
            
            // Set up infinite loading for discovery sections (synchronous, wrapped in Promise.resolve)
            Promise.resolve().then(() => setupInfiniteLoading(homeSectionsContainer)),
            
            // Start preloading first batch of discovery sections (non-blocking)
            preloadNextSections()
        ];
        
        // Wait for all parallel operations to complete
        await Promise.all(initPromises);
        
        LOG('All custom sections rendered successfully');
    } catch (error) {
        ERR('Error rendering custom sections:', error);
    } finally {
        // Always reset the processing flag
        isProcessing = false;
    }
}

/**
 * Sets up observer to watch for home sections container
 */
function setupHomeScreenObserver() {
    // Check immediately in case the element already exists
    checkAndRenderCustomSections();
    
    // Set up MutationObserver to watch for home sections container
    const observer = new MutationObserver((mutations) => {
        let shouldCheck = false;
        
        mutations.forEach((mutation) => {
            if (mutation.type === 'childList') {
                mutation.addedNodes.forEach((node) => {
                    if (node.nodeType === Node.ELEMENT_NODE) {
                        // Check if the added node contains home sections container
                        if (node.querySelector && node.querySelector('.homeSectionsContainer')) {
                            shouldCheck = true;
                        }
                        
                        // Also check if the added node is the home sections container itself
                        if (node.classList && node.classList.contains('homeSectionsContainer')) {
                            shouldCheck = true;
                        }
                        
                        // Check for any class containing "home" or "section"
                        if (node.classList) {
                            for (const className of node.classList) {
                                if (className.toLowerCase().includes('home') || className.toLowerCase().includes('section')) {
                                    shouldCheck = true;
                                    break;
                                }
                            }
                        }
                    }
                });
            }
            
            // Also check on attribute changes (like class changes)
            if (mutation.type === 'attributes' && mutation.attributeName === 'class') {
                const target = mutation.target;
                if (target.classList && (target.classList.contains('homeSectionsContainer') || 
                    Array.from(target.classList).some(cls => cls.toLowerCase().includes('home') || cls.toLowerCase().includes('section')))) {
                    shouldCheck = true;
                }
            }
        });
        
        if (shouldCheck) {
            setTimeout(checkAndRenderCustomSections, 100); // Small delay to ensure DOM is ready
        }
    });
    
    // Start observing
    observer.observe(document.body, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ['class']
    });
    
    LOG('Home screen observer initialized');
}

// Initialize the home screen observer
setupHomeScreenObserver();

// Fallback: Check periodically in case mutation observer misses something
let checkInterval = null;
const startPeriodicCheck = () => {
    if (checkInterval) return;
    
    checkInterval = setInterval(() => {
        // Skip if already processing
        if (isProcessing) {
            return;
        }
        
        const homeSectionsContainer = document.querySelector('.homeSectionsContainer');
        if (homeSectionsContainer && !homeSectionsContainer.querySelector('[data-custom-section-id]')) {
            checkAndRenderCustomSections();
        }
    }, 2000); // Check every 2 seconds
};

// Start periodic check after a short delay
setTimeout(startPeriodicCheck, 1000);

// Debug functions for troubleshooting (available in console)
window.debugHomeScreen = function() {
    LOG('Manual debug trigger called');
    checkAndRenderCustomSections();
};

window.debugCustomSections = function() {
    LOG('Custom sections configuration:', customHomeSections);
    LOG('New and Trending configuration - enableNewAndTrending:', enableNewAndTrending, 'enableNewMovies:', enableNewMovies, 'enableNewEpisodes:', enableNewEpisodes, 'enableTrending:', enableTrending);
    LOG('Discovery configuration - enableWatchlist:', enableWatchlist, 'enableDiscovery:', enableDiscovery, 'enableSeasonal:', enableSeasonal);
    LOG('Seasonal configuration - seasonalItemLimit:', SEASONAL_ITEM_LIMIT);
    LOG('Processing flag status:', isProcessing);
    
    // Check multiple selectors
    const selectors = [
        '.libraryPage:not(.hide) .homeSectionsContainer',
        '.homeSectionsContainer',
        '.homeSectionsContainer:not(.hide)',
        '[class*="homeSections"]'
    ];
    
    selectors.forEach(selector => {
        const element = document.querySelector(selector);
        LOG(`Selector "${selector}":`, element ? 'FOUND' : 'NOT FOUND', element);
    });
    
    // Log all elements with "home" or "section" in class name
    const allElements = document.querySelectorAll('*');
    const relevantElements = Array.from(allElements).filter(el => 
        el.className && typeof el.className === 'string' && 
        (el.className.toLowerCase().includes('home') || el.className.toLowerCase().includes('section'))
    );
    
    LOG('Elements with "home" or "section" in class:', relevantElements.map(el => ({
        tagName: el.tagName,
        className: el.className,
        id: el.id
    })));
    
    // Check if cardBuilder is available
    LOG('cardBuilder available:', typeof window.cardBuilder !== 'undefined');
    LOG('renderCardsFromIds available:', typeof window.cardBuilder?.renderCardsFromIds === 'function');
    
    // Check if LocalStorageCache is available
    LOG('LocalStorageCache available:', typeof window.LocalStorageCache !== 'undefined');
    
    // Check discovery section data availability
    if (enableWatchlist) {
        const watchlistData = getWatchlistData();
        LOG('Watchlist data available:', watchlistData.length, 'items');
    }
    
    if (enableDiscovery) {
        const movieHistory = getMovieHistoryData();
        const seriesProgress = getSeriesProgressData();
        LOG('Movie history available:', movieHistory.length, 'items');
        LOG('Series progress available:', seriesProgress.length, 'items');
    }
};


// Debug function for seasonal sections
window.debugSeasonalSections = function() {
    LOG('=== Seasonal Sections Debug ===');
    LOG('Configuration - enableSeasonal:', enableSeasonal, 'seasonalItemLimit:', SEASONAL_ITEM_LIMIT);
    
    LOG('Date checks:');
    LOG('- Halloween period:', isHalloweenPeriod());
    LOG('- Christmas period:', isChristmasPeriod());
    LOG('- New Years period:', isNewYearsPeriod());
    LOG('- Valentine\'s Day period:', isValentinesPeriod());
    
    if (enableSeasonal) {
        LOG('Halloween data:');
        LOG('- Halloween movies:', halloweenMovies.length);
        LOG('- Horror movies:', horrorMovies.length);
        LOG('- Thriller movies:', thrillerMovies.length);
        LOG('- Halloween people:', halloweenPeople.length);
        LOG('- ViewMore URLs:', halloweenViewMoreUrls);
        
        if (halloweenPeople.length > 0) {
            const directors = halloweenPeople.filter(p => p.directorCount >= 2);
            const actors = halloweenPeople.filter(p => p.actorCount >= 2);
            const writers = halloweenPeople.filter(p => p.writerCount >= 2);
            LOG('- Directors with 2+ movies:', directors.length);
            LOG('- Actors with 2+ movies:', actors.length);
            LOG('- Writers with 2+ movies:', writers.length);
        }
    }
};

// Debug function for movie genres cache
window.debugMovieGenres = async function() {
    LOG('=== Movie Genres Cache Debug ===');
    
    const cache = new window.LocalStorageCache();
    const movieGenres = cache.get('movieGenres');
    
    if (movieGenres && movieGenres.length > 0) {
        LOG(`Cached genres: ${movieGenres.length}`);
        LOG('Sample genres:', movieGenres.slice(0, 5).map(g => ({ name: g.Name, id: g.Id })));
        
        // Test genre lookups
        const horrorId = await getGenreId('Horror');
        const thrillerId = await getGenreId('Thriller');
        LOG('Horror genre ID:', horrorId);
        LOG('Thriller genre ID:', thrillerId);
    } else {
        LOG('No genres in cache, fetching...');
        const genres = await fetchAndCacheMovieGenres();
        LOG(`Fetched and cached ${genres.length} genres`);
    }
    
    // Show cache age
    const cacheAge = cache.getCacheAge('movieGenres');
    if (cacheAge !== null) {
        LOG(`Cache age: ${cacheAge.toFixed(2)} hours`);
    }
};

// Debug function for discovery sections
window.debugDiscoverySections = function() {
    LOG('=== Discovery Sections Debug ===');
    LOG('Configuration - enableDiscovery:', enableDiscovery);
    LOG('Configuration - enableInfiniteScroll:', enableInfiniteScroll);
    LOG('Configuration - minPeopleAppearances:', minPeopleAppearances);
    LOG('Configuration - minGenreMovieCount:', minGenreMovieCount);
    LOG('Movies top people loaded:', moviesTopPeople !== null);
    LOG('People cache complete:', isPeopleCacheComplete);
    LOG('Is initializing people cache:', isInitializingPeopleCache);
    LOG('Rendered sections count:', renderedSections.size);
    LOG('Rendered sections:', Array.from(renderedSections));
    LOG('Is generating discovery sections:', isGeneratingDiscoverySections);
    LOG('Preloaded sections count:', preloadedSections.length);
    LOG('Preloaded section elements count:', preloadedSectionElements.length);
    LOG('Is preloading sections:', isPreloadingSections);
    
    if (moviesTopPeople) {
        LOG('Top people data:');
        LOG('- Actors:', moviesTopPeople.actors.length);
        LOG('- Directors:', moviesTopPeople.directors.length);
        LOG('- Writers:', moviesTopPeople.writers.length);
        
        if (moviesTopPeople.actors.length > 0) {
            LOG('Sample actor:', moviesTopPeople.actors[0]);
        }
        if (moviesTopPeople.directors.length > 0) {
            LOG('Sample director:', moviesTopPeople.directors[0]);
        }
        if (moviesTopPeople.writers.length > 0) {
            LOG('Sample writer:', moviesTopPeople.writers[0]);
        }
    }
    
    // Test genre availability
    const cache = new window.LocalStorageCache();
    const movieGenres = cache.get('movieGenres');
    LOG('Available genres:', movieGenres ? movieGenres.length : 0);
    
    if (movieGenres && movieGenres.length > 0) {
        const genresWithEnoughMovies = movieGenres.filter(genre => 
            (genre.MovieCount || 0) >= minGenreMovieCount
        );
        LOG(`Genres with ${minGenreMovieCount}+ movies:`, genresWithEnoughMovies.length);
        
        if (genresWithEnoughMovies.length > 0) {
            LOG('Sample qualifying genres:', genresWithEnoughMovies.slice(0, 5).map(g => ({ 
                name: g.Name, 
                movieCount: g.MovieCount 
            })));
        }
    }
    
    // Test watchlist data
    const watchlistData = getWatchlistData();
    LOG('Watchlist data available:', watchlistData.length, 'items');
    
    // Test movie history
    const movieHistory = getMovieHistoryData();
    LOG('Movie history available:', movieHistory.length, 'items');
    
    // Test favorites
    fetchFavoriteItems('Movie').then(favorites => {
        LOG('Favorite movies available:', favorites.length, 'items');
    });
};

// Function to manually trigger discovery sections rendering from buffer
window.generateDiscoverySections = async function() {
    LOG('Manually triggering discovery sections rendering from buffer...');
    const homeSectionsContainer = document.querySelector('.homeSectionsContainer');
    if (homeSectionsContainer) {
        const result = await renderNextDiscoveryGroup(homeSectionsContainer);
        LOG('Discovery sections rendering result:', result);
    } else {
        LOG('Home sections container not found');
    }
};

// Function to manually trigger preloading
window.preloadDiscoverySections = async function() {
    LOG('Manually triggering discovery sections preloading...');
    await preloadNextSections();
    LOG('Preloading completed. Preloaded sections:', preloadedSections.length);
};

// Function to manually continue loading people data
window.continueLoadingPeopleData = async function() {
    LOG('Manually continuing people data loading...');
    if (isInitializingPeopleCache) {
        LOG('People cache initialization already in progress');
        return;
    }
    
    isInitializingPeopleCache = true;
    try {
        const result = await fetchTopPeople();
        if (result) {
            moviesTopPeople = result;
            isPeopleCacheComplete = result.isComplete || false;
            LOG('People data loading result:', result.isComplete ? 'Complete' : 'Partial');
        }
    } finally {
        isInitializingPeopleCache = false;
    }
};

// Function to manually refresh movie genres cache
window.refreshMovieGenres = async function() {
    LOG('Manually refreshing movie genres cache...');
    const cache = new window.LocalStorageCache();
    cache.clear('movieGenres');
    const genres = await fetchAndCacheMovieGenres();
    LOG(`Refreshed cache with ${genres.length} genres`);
    return genres;
};

// Function to manually unhide preloaded sections for testing
window.unhidePreloadedSections = function() {
    LOG('Manually unhiding preloaded sections...');
    const hiddenSections = document.querySelectorAll('[data-preloaded="true"]');
    LOG(`Found ${hiddenSections.length} hidden preloaded sections`);
    
    let unhiddenCount = 0;
    hiddenSections.forEach(section => {
        section.style.display = '';
        section.removeAttribute('data-preloaded');
        unhiddenCount++;
    });
    
    LOG(`Unhid ${unhiddenCount} preloaded sections`);
    return unhiddenCount;
};

// Function to test new movies section
window.testNewMovies = async function() {
    LOG('Testing New Movies section...');
    const movies = await fetchNewMovies();
    LOG(`Found ${movies.length} new movies:`, movies.map(m => ({ name: m.Name, premiereDate: m.PremiereDate })));
    return movies;
};

// Function to test new episodes section
window.testNewEpisodes = async function() {
    LOG('Testing New Episodes section...');
    const episodes = await fetchNewEpisodes();
    LOG(`Found ${episodes.length} new episodes from last 7 days (after deduplication):`, episodes.map(e => ({ 
        name: e.Name, 
        series: e.SeriesName, 
        episode: `S${e.ParentIndexNumber?.toString().padStart(2,'0') ?? '--'}E${e.IndexNumber?.toString().padStart(2,'0') ?? '--'}`,
        premiereDate: e.PremiereDate 
    })));
    
    // Group by series to show deduplication effect
    const seriesGroups = {};
    episodes.forEach(episode => {
        const series = episode.SeriesName || 'Unknown';
        if (!seriesGroups[series]) {
            seriesGroups[series] = [];
        }
        seriesGroups[series].push(episode);
    });
    
    LOG('Episodes grouped by series:', Object.keys(seriesGroups).map(series => ({
        series: series,
        episodeCount: seriesGroups[series].length,
        episodes: seriesGroups[series].map(e => `S${e.ParentIndexNumber?.toString().padStart(2,'0') ?? '--'}E${e.IndexNumber?.toString().padStart(2,'0') ?? '--'}`)
    })));
    
    return episodes;
};

// Function to test deduplication logic with sample data
window.testDeduplication = function() {
    LOG('Testing episode deduplication logic...');
    
    // Create sample episodes for testing
    const sampleEpisodes = [
        { Name: 'Episode 1', SeriesName: 'Test Series A', PremiereDate: '2024-01-15', IndexNumber: 1, ParentIndexNumber: 1 },
        { Name: 'Episode 2', SeriesName: 'Test Series A', PremiereDate: '2024-01-15', IndexNumber: 2, ParentIndexNumber: 1 },
        { Name: 'Episode 3', SeriesName: 'Test Series A', PremiereDate: '2024-01-15', IndexNumber: 3, ParentIndexNumber: 1 },
        { Name: 'Episode 1', SeriesName: 'Test Series B', PremiereDate: '2024-01-16', IndexNumber: 1, ParentIndexNumber: 1 },
        { Name: 'Episode 1', SeriesName: 'Test Series A', PremiereDate: '2024-01-17', IndexNumber: 1, ParentIndexNumber: 2 },
        { Name: 'Episode 2', SeriesName: 'Test Series A', PremiereDate: '2024-01-17', IndexNumber: 2, ParentIndexNumber: 2 }
    ];
    
    LOG('Original episodes:', sampleEpisodes.map(e => ({ 
        series: e.SeriesName, 
        episode: `S${e.ParentIndexNumber}E${e.IndexNumber}`, 
        date: e.PremiereDate 
    })));
    
    const deduplicated = deduplicateEpisodesBySeriesAndDate(sampleEpisodes);
    
    LOG('After deduplication:', deduplicated.map(e => ({ 
        series: e.SeriesName, 
        episode: `S${e.ParentIndexNumber}E${e.IndexNumber}`, 
        date: e.PremiereDate 
    })));
    
    LOG(`Deduplication result: ${sampleEpisodes.length} episodes → ${deduplicated.length} episodes`);
    
    return deduplicated;
};

LOG('Home screen functionality initialized');
LOG('Debug functions available: window.debugHomeScreen(), window.debugCustomSections(), window.debugDiscoverySections(), window.debugSeasonalSections(), window.debugMovieGenres(), window.refreshMovieGenres(), window.generateDiscoverySections(), window.preloadDiscoverySections(), window.continueLoadingPeopleData(), window.unhidePreloadedSections(), window.testNewMovies(), window.testNewEpisodes(), window.testDeduplication()');

})();
