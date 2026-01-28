// KefinTweaks People Cache Manager
// Handles fetching, processing, and caching of top actors, directors, and writers
(function() {
    'use strict';

    const LOG = (...args) => console.log('[KefinTweaks PeopleCache]', ...args);
    const WARN = (...args) => console.warn('[KefinTweaks PeopleCache]', ...args);
    const ERR = (...args) => console.error('[KefinTweaks PeopleCache]', ...args);

    // Configuration
    const MIN_PEOPLE_APPEARANCES = 2; // Minimum number of items a person must appear in to be tracked

    // State
    let moviesTopPeople = null;
    let isInitializing = false;
    let isComplete = false;

    /**
     * Extracts necessary item data for caching (similar to watchlist format)
     */
    function extractItemDataForCache(item) {
        return {
            Id: item.Id,
            Type: item.Type,
            Name: item.Name,
            SeriesId: item.SeriesId,
            SeriesName: item.SeriesName,
            IndexNumber: item.IndexNumber,
            ParentIndexNumber: item.ParentIndexNumber,
            PremiereDate: item.PremiereDate,
            ProductionYear: item.ProductionYear,
            UserData: {
                Played: item.UserData?.Played || false,
                IsFavorite: item.UserData?.IsFavorite || false
            }
        };
    }

    /**
     * Processes people data from movies array and returns RAW data (all people, unfiltered)
     */
    function processPeopleDataRaw(movies, existingPeopleMap = null) {
        try {
            const peopleMap = existingPeopleMap ? new Map(existingPeopleMap) : new Map();
            
            movies.forEach(movie => {
                // Extract item data for caching
                const itemData = extractItemDataForCache(movie);
                
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
                                directorItems: [],
                                writerItems: [],
                                actorItems: []
                            });
                        }
                        
                        const personData = peopleMap.get(key);
                        if (person.Type === 'Director') {
                            personData.directorCount++;
                            if (!personData.directorItems.some(item => item.Id === movie.Id)) {
                                personData.directorItems.push(itemData);
                            }
                        } else if (person.Type === 'Writer') {
                            personData.writerCount++;
                            if (!personData.writerItems.some(item => item.Id === movie.Id)) {
                                personData.writerItems.push(itemData);
                            }
                        } else if (person.Type === 'Actor') {
                            personData.actorCount++;
                            if (!personData.actorItems.some(item => item.Id === movie.Id)) {
                                personData.actorItems.push(itemData);
                            }
                        }
                    });
                }
            });
            
            return peopleMap;
        } catch (err) {
            ERR('Failed to process people data:', err);
            return null;
        }
    }

    /**
     * Filters and sorts raw people data
     */
    function filterPeopleData(peopleMap) {
        try {
            if (!peopleMap) return null;
            
            const allPeople = Array.from(peopleMap.values());
            
            // Get threshold from config or default
            const minAppearances = (window.KefinTweaksConfig && 
                                  window.KefinTweaksConfig.homeScreen && 
                                  window.KefinTweaksConfig.homeScreen.discovery && 
                                  window.KefinTweaksConfig.homeScreen.discovery.minPeopleAppearances) 
                                  || MIN_PEOPLE_APPEARANCES;

            const topDirectors = allPeople
                .filter(person => person.directorCount >= minAppearances)
                .sort((a, b) => b.directorCount - a.directorCount)
                .slice(0, 100)
                .map(person => ({
                    id: person.id,
                    name: person.name,
                    count: person.directorCount,
                    items: person.directorItems || []
                }));
                
            const topWriters = allPeople
                .filter(person => person.writerCount >= minAppearances)
                .sort((a, b) => b.writerCount - a.writerCount)
                .slice(0, 100)
                .map(person => ({   
                    id: person.id,
                    name: person.name,
                    count: person.writerCount,
                    items: person.writerItems || []
                }));
                
            const topActors = allPeople
                .filter(person => person.actorCount >= minAppearances)
                .sort((a, b) => b.actorCount - a.actorCount)
                .slice(0, 100)
                .map(person => ({   
                    id: person.id,
                    name: person.name,
                    count: person.actorCount,
                    items: person.actorItems || []
                }));
            
            return {
                actors: topActors,
                directors: topDirectors,
                writers: topWriters
            };
        } catch (err) {
            ERR('Failed to filter people data:', err);
            return null;
        }
    }

    /**
     * Fetches and processes top people data from all movies using pagination
     */
    async function fetchTopPeople() {
        const apiClient = window.ApiClient;
        const serverUrl = apiClient.serverAddress();
        const token = apiClient.accessToken();
        const userId = apiClient.getCurrentUserId();
        const indexedDBCache = window.IndexedDBCache;
        
        try {
            LOG('Starting paginated fetch of movies for people data processing...');
            
            let startIndex = 0;
            const limit = 500;
            let hasMoreData = true;
            let peopleMap = null;
            
            // Load existing raw people data if available (for resuming)
            const existingRawData = await indexedDBCache.get('movies_top_people_raw', userId);
            if (existingRawData && !existingRawData.isComplete) {
                const moviesProcessed = existingRawData.moviesProcessedCount;
                if (moviesProcessed > 0) {
                    startIndex = moviesProcessed;
                    peopleMap = new Map(existingRawData.peopleData || []);
                    LOG(`Resuming from existing data: ${moviesProcessed} movies already processed`);
                }
            }
            
            while (hasMoreData) {
                const url = `${serverUrl}/Items?userId=${userId}&IncludeItemTypes=Movie&Recursive=true&Fields=People,UserData&Limit=${limit}&StartIndex=${startIndex}`;
                
                LOG(`Fetching movies ${startIndex} to ${startIndex + limit - 1}...`);
                
                const response = await fetch(url, {
                    headers: { 'Authorization': `MediaBrowser Token="${token}"` }
                });
                
                if (!response.ok) throw new Error(`HTTP ${response.status}`);
                
                const data = await response.json();
                const movies = data.Items || [];
                
                if (movies.length === 0) {
                    hasMoreData = false;
                } else {
                    peopleMap = processPeopleDataRaw(movies, peopleMap);
                    startIndex += movies.length;
                    
                    // Update global state with partial results for immediate use
                    const filteredData = filterPeopleData(peopleMap);
                    if (filteredData) {
                        moviesTopPeople = filteredData;
                    }
                    
                    // Checkpoint raw data
                    const rawDataToCache = {
                        isComplete: movies.length < limit,
                        moviesProcessedCount: startIndex,
                        peopleData: Array.from(peopleMap.entries())
                    };
                    await indexedDBCache.set('movies_top_people_raw', rawDataToCache, userId, 7 * 24 * 60 * 60 * 1000);
                    
                    if (movies.length < limit) {
                        hasMoreData = false;
                        isComplete = true;
                    }
                }
            }
            
            const finalPeopleData = filterPeopleData(peopleMap);
            if (finalPeopleData) {
                finalPeopleData.isComplete = true;
                moviesTopPeople = finalPeopleData;
                
                await indexedDBCache.set('movies_top_people', finalPeopleData, userId, 7 * 24 * 60 * 60 * 1000);
                await indexedDBCache.clear('movies_top_people_raw', userId);
                
                LOG('People cache complete and saved');
            }
            
            return finalPeopleData;
            
        } catch (err) {
            ERR('Failed to fetch top people data:', err);
            return null;
        }
    }

    /**
     * Initializes the people cache in the background
     */
    async function initialize() {
        if (isInitializing) return;
        
        if (moviesTopPeople !== null && isComplete) {
            return;
        }
        
        const indexedDBCache = window.IndexedDBCache;
        const userId = window.ApiClient.getCurrentUserId();
        
        // Check for valid complete filtered data
        const validComplete = await indexedDBCache.isCacheValid('movies_top_people', userId);
        if (validComplete) {
            const cachedData = await indexedDBCache.get('movies_top_people', userId);
            if (cachedData && cachedData.isComplete) {
                moviesTopPeople = cachedData;
                isComplete = true;
                LOG('Loaded complete top people data from IndexedDB');
                return;
            }
        }
        
        // Initialize background fetch
        isInitializing = true;
        try {
            await fetchTopPeople();
        } finally {
            isInitializing = false;
        }
    }

    async function getTopPeople() {
        if (!moviesTopPeople) {
            await initialize();
        }
        return moviesTopPeople;
    }

    async function getTopActors() {
        if (!moviesTopPeople) {
            await initialize();
        }
        return moviesTopPeople.actors;
    }

    async function getTopDirectors() {
        if (!moviesTopPeople) {
            await initialize();
        }
        return moviesTopPeople.directors;
    }

    async function getTopWriters() {
        if (!moviesTopPeople) {
            await initialize();
        }
        return moviesTopPeople.writers;
    }

    function isCacheComplete() {
        return isComplete;
    }

    // Expose API
    window.PeopleCache = {
        init: initialize,
        getTopPeople: getTopPeople,
        getTopActors: getTopActors,
        getTopDirectors: getTopDirectors,
        getTopWriters: getTopWriters,
        isComplete: isCacheComplete
    };

    LOG('Module loaded');

})();
