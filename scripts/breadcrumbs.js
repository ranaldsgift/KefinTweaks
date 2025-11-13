// KefinTweaks Breadcrumbs
// Adds breadcrumb navigation to item detail pages
// Supports: Movie, Series, Season, Episode, MusicArtist, MusicAlbum, Audio
// Requires: utils.js module to be loaded before this script

(function() {
    'use strict';
    
    console.log('[KefinTweaks Breadcrumbs] Initializing...');
    
    // Configuration
    const CONFIG = {
        supportedTypes: ['Movie', 'Series', 'Season', 'Episode', 'MusicArtist', 'MusicAlbum', 'Audio'],
        minWidth: 768, // Only show on screens wider than 768px
    };
    
    // State management
    let currentBreadcrumbs = null;
    let breadcrumbContainer = null;
    let activePopover = null;
    let currentItemId = null;
    
    // Track parent IDs to avoid unnecessary API calls
    let lastSeasonsParentId = null;
    let lastAlbumsParentId = null;
    let lastSongsParentId = null;
    let cachedSeasonsData = null;
    let cachedAlbumsData = null;
    let cachedSongsData = null;
    
    // Smart API call functions that check parent ID
    async function getSeasonsIfNeeded(parentId) {
        if (lastSeasonsParentId === parentId && cachedSeasonsData) {
            log('Using existing seasons data for parent:', parentId);
            return cachedSeasonsData;
        }
        
        log('Fetching seasons for parent:', parentId);
        const seasons = await getSeasons(parentId);
        lastSeasonsParentId = parentId;
        cachedSeasonsData = seasons;
        return seasons;
    }
    
    async function getAlbumsIfNeeded(parentId) {
        if (lastAlbumsParentId === parentId && cachedAlbumsData) {
            log('Using existing albums data for parent:', parentId);
            return cachedAlbumsData;
        }
        
        log('Fetching albums for parent:', parentId);
        const albums = await getAlbums(parentId);
        lastAlbumsParentId = parentId;
        cachedAlbumsData = albums;
        return albums;
    }
    
    async function getSongsIfNeeded(parentId) {
        if (lastSongsParentId === parentId && cachedSongsData) {
            log('Using existing songs data for parent:', parentId);
            return cachedSongsData;
        }
        
        log('Fetching songs for parent:', parentId);
        const songs = await getSongs(parentId);
        lastSongsParentId = parentId;
        cachedSongsData = songs;
        return songs;
    }
    
    // Simplified breadcrumb structure definition
    async function getTargetBreadcrumbStructure(item) {
        const structure = {
            elements: [],
            item: item
        };

        // Don't append .html for server versions 10.11 and above
        const urlSuffix = ApiClient._appVersion.split('.')[1] > 10 ? '' : '.html'

        let queryParams = '';
        if (item.ParentId) {
            // Get the top parent item from the ancestors with a Type = CollectionFolder
            const ancestors = await ApiClient.getAncestorItems(item.Id);
            const collectionFolder = ancestors.find(ancestor => ancestor.Type === 'CollectionFolder');
            const userRootFolder = ancestors.find(ancestor => ancestor.Type === 'UserRootFolder');
            if (collectionFolder) {
                queryParams = `?topParentId=${collectionFolder.Id}&serverId=${ApiClient.serverId()}`;
            } else if (userRootFolder) {
                queryParams = `?topParentId=${userRootFolder.Id}&serverId=${ApiClient.serverId()}`;
            } else {
                queryParams = `?serverId=${ApiClient.serverId()}`;
            }
        }
        else if (ApiClient.serverId()) {
            queryParams = `?serverId=${ApiClient.serverId()}`;
        }
        
        if (item.Type === 'Movie') {
            structure.elements = [
                { text: 'Movies', url: `#/movies${urlSuffix}${queryParams}&tab=0`, clickable: true },
                { text: item.Name, url: null, clickable: false }
            ];
        } else if (item.Type === 'Series') {
            structure.elements = [
                { text: 'Shows', url: `#/tv${urlSuffix}${queryParams}&tab=0`, clickable: true },
                { text: item.Name, url: null, clickable: false },
                { text: 'All Seasons', url: null, clickable: true, popover: true }
            ];
        } else if (item.Type === 'Season') {
            // Get series details for the series name
            const seriesDetails = await getItemDetails(item.ParentId);
            const seriesName = seriesDetails ? seriesDetails.Name : 'Unknown Series';
            
            structure.elements = [
                { text: 'Shows', url: `#/tv${urlSuffix}${queryParams}&tab=0`, clickable: true },
                { text: seriesName, url: `${ApiClient._serverAddress}/web/#/details?id=${item.ParentId}&serverId=${ApiClient.serverId()}`, clickable: true },
                { text: item.Name || `Season ${item.IndexNumber}`, url: null, clickable: true, popover: true }
            ];
        } else if (item.Type === 'Episode') {
            // Get series details for the series name
            const seriesDetails = await getItemDetails(item.SeriesId);
            const seriesName = seriesDetails ? seriesDetails.Name : 'Unknown Series';
            
            // Get season details for the season name
            const seasonDetails = await getItemDetails(item.ParentId);
            const seasonName = seasonDetails ? (seasonDetails.Name || `Season ${seasonDetails.IndexNumber}`) : `Season ${item.ParentIndexNumber}`;
            
            structure.elements = [
                { text: 'Shows', url: `#/tv${urlSuffix}${queryParams}&tab=0`, clickable: true },
                { text: seriesName, url: `${ApiClient._serverAddress}/web/#/details?id=${item.SeriesId}&serverId=${ApiClient.serverId()}`, clickable: true },
                { text: seasonName, url: null, clickable: true, popover: true },
                { text: `${item.ParentIndexNumber}x${padNumber(item.IndexNumber)} - ${item.Name}`, url: null, clickable: false }
            ];
        } else if (item.Type === 'MusicArtist') {
            structure.elements = [
                { text: 'Music', url: `#/music${urlSuffix}${queryParams}&tab=0`, clickable: true },
                { text: item.Name, url: null, clickable: false },
                { text: 'All Albums', url: null, clickable: true, popover: true }
            ];
        } else if (item.Type === 'MusicAlbum') {
            structure.elements = [
                { text: 'Music', url: `#/music${urlSuffix}${queryParams}&tab=0`, clickable: true },
                { text: item.AlbumArtist, url: `${ApiClient._serverAddress}/web/#/details?id=${item.ParentId}&serverId=${ApiClient.serverId()}`, clickable: true },
                { text: item.Name, url: null, clickable: true, popover: true },
                { text: 'All Songs', url: null, clickable: true, popover: true }
            ];
        } else if (item.Type === 'Audio') {
            // Get album details for the album name and artist info
            const albumDetails = await getItemDetails(item.ParentId);
            const albumName = albumDetails ? albumDetails.Name : 'Unknown Album';
            const artistName = albumDetails ? albumDetails.AlbumArtist : 'Unknown Artist';
            const artistId = albumDetails ? albumDetails.ParentId : null;
            
            structure.elements = [
                { text: 'Music', url: `#/music${urlSuffix}${queryParams}&tab=0`, clickable: true },
                { text: artistName, url: artistId ? `${ApiClient._serverAddress}/web/#/details?id=${artistId}&serverId=${ApiClient.serverId()}` : null, clickable: !!artistId },
                { text: albumName, url: null, clickable: true, popover: true },
                { text: item.Name, url: null, clickable: false }
            ];
        }
        
        return structure;
    }
    
    // Compare existing breadcrumbs with target structure
    function compareBreadcrumbStructures(existing, target) {
        const differences = [];
        
        // Check if we have the right number of elements
        const existingElements = Array.from(breadcrumbContainer.children).filter(child => 
            child.classList.contains('kefinTweaks-breadcrumb-element')
        );
        
        log('Comparing breadcrumbs - existing:', existingElements.length, 'target:', target.elements.length);
        
        // Compare each element
        for (let i = 0; i < Math.max(existingElements.length, target.elements.length); i++) {
            const existingElement = existingElements[i];
            const targetElement = target.elements[i];
            
            if (!existingElement && targetElement) {
                // Need to add new element
                differences.push({ action: 'add', index: i, element: targetElement });
            } else if (existingElement && !targetElement) {
                // Need to remove element
                differences.push({ action: 'remove', index: i });
            } else if (existingElement && targetElement) {
                // Compare existing vs target
                const existingText = existingElement.textContent;
                const existingClickable = existingElement.style.cursor === 'pointer';
                const targetClickable = targetElement.clickable;
                
                // Check if popover functionality needs to be updated
                const needsPopoverUpdate = targetElement.popover && (
                    existingText !== targetElement.text || 
                    existingClickable !== targetClickable ||
                    // Force update for "All Seasons", "All Albums", and "All Songs" elements since the underlying data changes
                    targetElement.text === 'All Seasons' ||
                    targetElement.text === 'All Albums' ||
                    targetElement.text === 'All Songs'
                );
                
                if (existingText !== targetElement.text || existingClickable !== targetClickable || needsPopoverUpdate) {
                    differences.push({ action: 'update', index: i, element: targetElement });
                }
            }
        }
        
        return differences;
    }
    
    // Apply breadcrumb differences intelligently
    async function applyBreadcrumbDifferences(differences, targetStructure) {
        if (differences.length === 0) {
            log('No breadcrumb differences found, keeping existing structure');
            return;
        }
        
        log('Applying breadcrumb differences:', differences.length, 'changes needed');
        
        // Get existing elements
        const existingElements = Array.from(breadcrumbContainer.children).filter(child => 
            child.classList.contains('kefinTweaks-breadcrumb-element')
        );
        
        // Process differences in reverse order to maintain indices
        for (let i = differences.length - 1; i >= 0; i--) {
            const diff = differences[i];
            
            if (diff.action === 'add') {
                // Add new element at the specified index
                const newElement = await createBreadcrumbElementFromStructure(diff.element, targetStructure.item);
                const separator = createSeparator();
                
                if (diff.index === 0) {
                    breadcrumbContainer.insertBefore(newElement, breadcrumbContainer.firstChild);
                    breadcrumbContainer.insertBefore(separator, newElement.nextSibling);
                } else {
                    const insertAfter = existingElements[diff.index - 1];
                    if (insertAfter) {
                        breadcrumbContainer.insertBefore(separator, insertAfter.nextSibling);
                        breadcrumbContainer.insertBefore(newElement, separator.nextSibling);
                    } else {
                        breadcrumbContainer.appendChild(separator);
                        breadcrumbContainer.appendChild(newElement);
                    }
                }
                
                log('Added new breadcrumb element:', diff.element.text);
                
            } else if (diff.action === 'remove') {
                // Remove element and its separator
                const elementToRemove = existingElements[diff.index];
                if (elementToRemove) {
                    const separatorToRemove = elementToRemove.previousSibling;
                    if (separatorToRemove && separatorToRemove.classList.contains('kefinTweaks-breadcrumb-separator')) {
                        breadcrumbContainer.removeChild(separatorToRemove);
                    }
                    breadcrumbContainer.removeChild(elementToRemove);
                    log('Removed breadcrumb element at index:', diff.index);
                }
                
            } else if (diff.action === 'update') {
                // Update existing element
                const elementToUpdate = existingElements[diff.index];
                if (elementToUpdate) {
                    await updateBreadcrumbElement(elementToUpdate, diff.element, targetStructure.item);
                    log('Updated breadcrumb element:', diff.element.text);
                }
            }
        }
    }
    
    // Create breadcrumb element from structure definition
    async function createBreadcrumbElementFromStructure(elementDef, item) {
        const element = document.createElement('span');
        element.className = 'kefinTweaks-breadcrumb-element';
        element.textContent = elementDef.text;
        
        if (elementDef.clickable) {
            element.style.cursor = 'pointer';
            
            if (elementDef.url) {
                // Direct link
                element.addEventListener('click', () => {
                    window.location.href = elementDef.url;
                });
            } else if (elementDef.popover) {
                // Popover functionality
                await setupPopoverForElement(element, elementDef, item);
            }
        } else {
            element.style.cursor = 'default';
        }
        
        return element;
    }
    
    // Update existing breadcrumb element
    async function updateBreadcrumbElement(element, elementDef, item) {
        // Update text content
        element.textContent = elementDef.text;
        
        // Remove old event listeners by cloning
        const newElement = element.cloneNode(true);
        element.parentNode.replaceChild(newElement, element);
        
        // Set cursor style
        if (elementDef.clickable) {
            newElement.style.cursor = 'pointer';
            
            if (elementDef.url) {
                // Direct link
                newElement.addEventListener('click', () => {
                    window.location.href = elementDef.url;
                });
            } else if (elementDef.popover) {
                // Popover functionality
                await setupPopoverForElement(newElement, elementDef, item);
            }
        } else {
            newElement.style.cursor = 'default';
        }
    }
    
    // Setup popover functionality for an element
    async function setupPopoverForElement(element, elementDef, item) {
        if (elementDef.text === 'All Seasons') {
            // Series page - always show popover
            const seasons = await getSeasonsIfNeeded(item.Id);
            element.addEventListener('click', (e) => {
                e.stopPropagation();
                const popover = createPopover(seasons, null, (selectedSeason) => {
                    window.location.href = `${ApiClient._serverAddress}/web/#/details?id=${selectedSeason.Id}&serverId=${ApiClient.serverId()}`;
                });
                showPopover(element, popover);
            });
        } else if (elementDef.text === 'All Albums') {
            // Music Artist page - always show popover
            const albums = await getAlbumsIfNeeded(item.Id);
            element.addEventListener('click', (e) => {
                e.stopPropagation();
                const popover = createPopover(albums, null, (selectedAlbum) => {
                    window.location.href = `${ApiClient._serverAddress}/web/#/details?id=${selectedAlbum.Id}&serverId=${ApiClient.serverId()}`;
                });
                showPopover(element, popover);
            });
        } else if (elementDef.text === 'All Songs') {
            // Music Album page - always show popover
            const songs = await getSongsIfNeeded(item.Id);
            element.addEventListener('click', (e) => {
                e.stopPropagation();
                const popover = createPopover(songs, null, (selectedSong) => {
                    window.location.href = `${ApiClient._serverAddress}/web/#/details?id=${selectedSong.Id}&serverId=${ApiClient.serverId()}`;
                });
                showPopover(element, popover);
            });
        } else if (item.Type === 'Season') {
            // Season page - check if single season
            const seasons = await getSeasonsIfNeeded(item.ParentId);
            if (seasons.length === 1) {
                element.style.cursor = 'default';
            } else {
                element.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const popover = createPopover(seasons, item, (selectedSeason) => {
                        window.location.href = `${ApiClient._serverAddress}/web/#/details?id=${selectedSeason.Id}&serverId=${ApiClient.serverId()}`;
                    });
                    showPopover(element, popover);
                });
            }
        } else if (item.Type === 'Episode') {
            // Episode page - check if single season
            const seasons = await getSeasonsIfNeeded(item.SeriesId);
            if (seasons.length === 1) {
                element.addEventListener('click', () => {
                    window.location.href = `${ApiClient._serverAddress}/web/#/details?id=${seasons[0].Id}&serverId=${ApiClient.serverId()}`;
                });
            } else {
                const currentSeason = seasons.find(season => season.Id === item.ParentId);
                element.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const popover = createPopover(seasons, currentSeason, (selectedSeason) => {
                        window.location.href = `${ApiClient._serverAddress}/web/#/details?id=${selectedSeason.Id}&serverId=${ApiClient.serverId()}`;
                    });
                    showPopover(element, popover);
                });
            }
        } else if (item.Type === 'MusicAlbum') {
            // Music album page - clicking album name should show albums from all AlbumArtists
            // Prefer AlbumArtists on the item, fall back to fetching details
            let albumArtists = item.AlbumArtists;
            if (!albumArtists || !Array.isArray(albumArtists) || albumArtists.length === 0) {
                const albumDetails = await getItemDetails(item.Id);
                albumArtists = (albumDetails && albumDetails.AlbumArtists) ? albumDetails.AlbumArtists : [];
            }

            const artistIds = (albumArtists || []).map(a => a.Id).filter(Boolean);
            const albums = artistIds.length > 0
                ? await getAlbumsByArtistIds(artistIds)
                : await getAlbumsIfNeeded(item.ParentId);

            if (albums.length === 1) {
                element.addEventListener('click', () => {
                    window.location.href = `${ApiClient._serverAddress}/web/#/details?id=${albums[0].Id}&serverId=${ApiClient.serverId()}`;
                });
            } else {
                element.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const popover = createPopover(albums, item, (selectedAlbum) => {
                        window.location.href = `${ApiClient._serverAddress}/web/#/details?id=${selectedAlbum.Id}&serverId=${ApiClient.serverId()}`;
                    });
                    showPopover(element, popover);
                });
            }
        } else if (item.Type === 'Audio') {
            // Audio (Song) page - clicking album name should show albums from all AlbumArtists of the album
            const albumDetails = await getItemDetails(item.ParentId);
            const albumArtists = (albumDetails && albumDetails.AlbumArtists) ? albumDetails.AlbumArtists : [];
            const artistIds = albumArtists.map(a => a.Id).filter(Boolean);
            const albums = artistIds.length > 0
                ? await getAlbumsByArtistIds(artistIds)
                : await getAlbumsIfNeeded(albumDetails ? albumDetails.ParentId : null);

            if (albums && albums.length === 1) {
                element.addEventListener('click', () => {
                    window.location.href = `${ApiClient._serverAddress}/web/#/details?id=${albums[0].Id}&serverId=${ApiClient.serverId()}`;
                });
            } else {
                element.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const currentAlbum = albumDetails || null;
                    const popover = createPopover(albums || [], currentAlbum, (selectedAlbum) => {
                        window.location.href = `${ApiClient._serverAddress}/web/#/details?id=${selectedAlbum.Id}&serverId=${ApiClient.serverId()}`;
                    });
                    showPopover(element, popover);
                });
            }
        }
    }
    
    // Utility functions
    function log(message, ...args) {
        console.log(`[KefinTweaks Breadcrumbs] ${message}`, ...args);
    }
    
    function error(message, ...args) {
        console.error(`[KefinTweaks Breadcrumbs] ${message}`, ...args);
    }
    
    function isWideScreen() {
        return window.innerWidth > CONFIG.minWidth;
    }
    
    function getItemIdFromPath(path) {
        const match = path.match(/[?&]id=([^&]+)/);
        return match ? match[1] : null;
    }
    
    function padNumber(num, length = 2) {
        return num.toString().padStart(length, '0');
    }
    
    // DOM manipulation
    function createBreadcrumbContainer() {
        if (breadcrumbContainer) {
            return breadcrumbContainer;
        }
        
        // Find the header left container
        const headerLeft = document.querySelector('.skinHeader .headerLeft');
        if (!headerLeft) {
            error('Could not find .skinHeader .headerLeft element');
            return null;
        }
        
        // Create main wrapper
        const wrapper = document.createElement('div');
        wrapper.id = 'kefinTweaks-breadcrumbs-wrapper';
        wrapper.className = 'kefinTweaks-breadcrumbs-wrapper';
        wrapper.style.cssText = `
            display: none;
        `;
        
        // Create breadcrumb container (for background styling)
        breadcrumbContainer = document.createElement('div');
        breadcrumbContainer.id = 'kefinTweaks-breadcrumbs';
        breadcrumbContainer.className = 'kefinTweaks-breadcrumbs';
        
        // Create popover container
        const popoverContainer = document.createElement('div');
        popoverContainer.id = 'kefinTweaks-popover-container';
        popoverContainer.className = 'kefinTweaks-popover-container';
        popoverContainer.style.cssText = `
            position: absolute;
            top: calc(100% - 15px);
            left: 0;
            z-index: 1001;
        `;
        
        wrapper.appendChild(breadcrumbContainer);
        wrapper.appendChild(popoverContainer);
        headerLeft.appendChild(wrapper);
        
        log('Created breadcrumb container with wrapper structure inside .skinHeader .headerLeft');
        return breadcrumbContainer;
    }
    
    function showBreadcrumbs() {
        const wrapper = document.getElementById('kefinTweaks-breadcrumbs-wrapper');
        const wideScreen = isWideScreen();
        
        // Race condition protection: verify we're still on a supported page
        const currentPath = Emby.Page.lastPath || '';
        const isSupportedPage = currentPath.startsWith('/details?');
        
        if (wrapper && wideScreen && isSupportedPage) {
            wrapper.style.display = 'block';
            log('Breadcrumbs shown successfully');
        } else {
            log('Breadcrumbs not shown - wrapper:', !!wrapper, 'wideScreen:', wideScreen, 'isSupportedPage:', isSupportedPage);
        }
    }
    
    function hideBreadcrumbs() {
        const wrapper = document.getElementById('kefinTweaks-breadcrumbs-wrapper');
        if (wrapper) {
            wrapper.style.display = 'none';
        }
    }
    
    function clearBreadcrumbs() {
        if (breadcrumbContainer) {
            breadcrumbContainer.innerHTML = '';
            currentBreadcrumbs = null;
            currentItemId = null;
        }
        closePopover();
    }

    function closePopover() {
        if (activePopover) {
            activePopover.remove();
            activePopover = null;
        }
    }
    
    function createPopover(items, currentItem, onItemClick) {
        const popover = document.createElement('div');
        popover.className = 'kefinTweaks-popover';
        popover.style.display = 'block'; // Ensure it's visible
        
        log('Creating popover with', items.length, 'items');
        
        let selectedItemElement = null;
        
        items.forEach(item => {
            const itemElement = document.createElement('div');
            itemElement.className = 'kefinTweaks-popover-item';
            
            if (currentItem && item.Id === currentItem.Id) {
                itemElement.classList.add('selected');
                selectedItemElement = itemElement; // Store reference to selected item
            }
            
            // Format display text based on item type
            let displayText = item.Name;
            if (item.Type === 'Season' || item.Type === 'Episode') {
                displayText = item.Name || `Season ${item.IndexNumber}`;
            } else if (item.Type === 'Audio') {
                // For songs, show track number if available
                displayText = item.IndexNumber ? `${padNumber(item.IndexNumber)}. ${item.Name}` : item.Name;
            }
            
            itemElement.textContent = displayText;
            itemElement.addEventListener('click', () => {
                log('Popover item clicked:', item.Name);
                onItemClick(item);
                closePopover();
            });
            
            popover.appendChild(itemElement);
        });
        
        // Add auto-scroll functionality
        if (selectedItemElement) {
            // Use setTimeout to ensure the popover is rendered before scrolling
            setTimeout(() => {
                selectedItemElement.scrollIntoView({
                    behavior: 'instant',
                    block: 'nearest',
                    inline: 'nearest'
                });
                log('Auto-scrolled to selected item:', selectedItemElement.textContent);
            }, 10);
        }
        
        return popover;
    }
    
    function showPopover(triggerElement, popover) {
        closePopover();
        
        activePopover = popover;
        
        log('Showing popover for element:', triggerElement.textContent);
        
        // Add popover to the dedicated popover container
        const popoverContainer = document.getElementById('kefinTweaks-popover-container');
        if (popoverContainer) {
            // Calculate the left offset to align with the trigger element
            // Since breadcrumbs are now in the header, we need to calculate relative to the page
            const triggerRect = triggerElement.getBoundingClientRect();
            const popoverContainerRect = popoverContainer.getBoundingClientRect();
            
            // Calculate offset from popover container to trigger element
            const leftOffset = triggerRect.left - popoverContainerRect.left - 22;
            popover.style.left = `${leftOffset}px`;
            
            popoverContainer.appendChild(popover);
            log('Popover added to popover container with left offset:', leftOffset);
        } else {
            log('Popover container not found, falling back to trigger element');
            triggerElement.style.position = 'relative';
            triggerElement.appendChild(popover);
        }
        
        // Close popover when clicking outside
        const closeHandler = (e) => {
            if (!popover.contains(e.target) && !triggerElement.contains(e.target)) {
                closePopover();
                document.removeEventListener('click', closeHandler);
            }
        };
        
        setTimeout(() => {
            document.addEventListener('click', closeHandler);
        }, 100);
    }
    
    // API functions
    async function getItemDetails(itemId) {
        try {
            const currentUserId = ApiClient.getCurrentUserId();
            if (!currentUserId) {
                throw new Error('No user ID found');
            }

            const url = ApiClient.getUrl(`Users/${currentUserId}/Items/${itemId}`);
            const response = await ApiClient.getJSON(url);
            log('Retrieved item details:', response.Name, response.Type);
            return response;
        } catch (err) {
            console.error('Failed to get item details:', err);
            return null;
        }
    }
    
    async function getSeasons(seriesId) {
        try {
            const url = ApiClient.getUrl(`Shows/${seriesId}/Seasons`, {
                userId: ApiClient.getCurrentUserId(),
                imageTypeLimit: 1
            });
            const response = await ApiClient.getJSON(url);
            log('Retrieved seasons:', response.Items?.length || 0);
            return response.Items || [];
        } catch (err) {
            error('Failed to get seasons:', err);
            return [];
        }
    }
    
    async function getAlbums(artistId) {
        try {
            const url = ApiClient.getUrl('Items', {
                SortOrder: 'Descending',
                IncludeItemTypes: 'MusicAlbum',
                Recursive: true,
                Fields: 'ParentId',
                Limit: 100,
                StartIndex: 0,
                CollapseBoxSetItems: false,
                AlbumArtistIds: artistId,
                SortBy: 'PremiereDate,ProductionYear,Sortname'
            });
            const response = await ApiClient.getJSON(url);
            log('Retrieved albums:', response.Items?.length || 0);
            return response.Items || [];
        } catch (err) {
            error('Failed to get albums:', err);
            return [];
        }
    }
    
    async function getAlbumsByArtistIds(artistIds) {
        try {
            const idsParam = Array.isArray(artistIds) ? artistIds.join(',') : String(artistIds || '');
            const url = ApiClient.getUrl('Items', {
                SortOrder: 'Descending',
                IncludeItemTypes: 'MusicAlbum',
                Recursive: true,
                Fields: 'ParentId',
                Limit: 200,
                StartIndex: 0,
                CollapseBoxSetItems: false,
                AlbumArtistIds: idsParam,
                SortBy: 'PremiereDate,ProductionYear,Sortname'
            });
            const response = await ApiClient.getJSON(url);
            const items = response.Items || [];
            // Deduplicate by Id when multiple artists overlap
            const unique = [];
            const seen = new Set();
            for (const it of items) {
                if (it && it.Id && !seen.has(it.Id)) {
                    seen.add(it.Id);
                    unique.push(it);
                }
            }
            log('Retrieved albums by artist IDs:', unique.length);
            return unique;
        } catch (err) {
            error('Failed to get albums by artist IDs:', err);
            return [];
        }
    }
    
    async function getSongs(albumId) {
        try {
            const url = ApiClient.getUrl('Items', {
                ParentId: albumId,
                IncludeItemTypes: 'Audio',
                Recursive: false,
                Fields: 'ParentId',
                Limit: 100,
                StartIndex: 0,
                SortBy: 'IndexNumber,SortName'
            });
            const response = await ApiClient.getJSON(url);
            log('Retrieved songs:', response.Items?.length || 0);
            return response.Items || [];
        } catch (err) {
            error('Failed to get songs:', err);
            return [];
        }
    }
    
    function createSeparator() {
        const separator = document.createElement('span');
        separator.className = 'kefinTweaks-breadcrumb-separator';
        separator.textContent = ' / ';
        separator.style.margin = '0 8px';
        return separator;
    }
    
    // Page change handler
    // Simplified page change handler
    async function handlePageChange(item = null) {
        try {
            // Close any active popovers first
            closePopover();
            
            const currentPath = Emby.Page.lastPath;
            
            // Check if we're on a details page
            if (!currentPath || !currentPath.startsWith('/details?')) {
                clearBreadcrumbs();
                hideBreadcrumbs();
                return;
            }

            // Check if the user is logged in
            if (!ApiClient._loggedIn) {
                clearBreadcrumbs();
                hideBreadcrumbs();
                return;
            }
            
            // Extract item ID
            if (!item || !item.Id) {
                clearBreadcrumbs();
                hideBreadcrumbs();
                return;
            }
            
            // Check if item type is supported
            if (!CONFIG.supportedTypes.includes(item.Type)) {
                clearBreadcrumbs();
                hideBreadcrumbs();
                return;
            }
            
            // Determine target breadcrumb structure
            const targetStructure = await getTargetBreadcrumbStructure(item);
            log('Target breadcrumb structure:', targetStructure.elements.map(e => e.text));
            
            // Check if we need to create breadcrumbs from scratch
            if (!breadcrumbContainer || !currentBreadcrumbs) {
                log('Creating breadcrumbs from scratch');
                await createBreadcrumbsFromScratch(targetStructure);
            } else {
                // Compare existing with target and apply differences
                const differences = compareBreadcrumbStructures(currentBreadcrumbs, targetStructure);
                await applyBreadcrumbDifferences(differences, targetStructure);
            }
            
            // Update state
            currentBreadcrumbs = targetStructure;
            currentItemId = item.Id;
            
            log('About to show breadcrumbs...');
            showBreadcrumbs();
            log('Breadcrumbs updated successfully');
            
        } catch (err) {
            error('Error handling page change:', err);
            clearBreadcrumbs();
            hideBreadcrumbs();
        }
    }
    
    // Create breadcrumbs from scratch
    async function createBreadcrumbsFromScratch(targetStructure) {
        // Create container if it doesn't exist
        if (!breadcrumbContainer) {
            breadcrumbContainer = createBreadcrumbContainer();
        }
        
        // Build all elements first
        const elements = [];
        for (let i = 0; i < targetStructure.elements.length; i++) {
            const elementDef = targetStructure.elements[i];
            const element = await createBreadcrumbElementFromStructure(elementDef, targetStructure.item);
            elements.push(element);
            
            // Add separator after each element except the last
            if (i < targetStructure.elements.length - 1) {
                const separator = createSeparator();
                elements.push(separator);
            }
        }
        
        // Replace the innerHTML entirely to avoid any duplicate appending issues
        breadcrumbContainer.innerHTML = '';
        
        // Append all elements at once
        elements.forEach(el => breadcrumbContainer.appendChild(el));
        
        log('Created breadcrumbs from scratch with', targetStructure.elements.length, 'elements');
    }
    
    // Window resize handler
    function handleResize() {
        if (currentBreadcrumbs && breadcrumbContainer) {
            if (isWideScreen()) {
                showBreadcrumbs();
            } else {
                hideBreadcrumbs();
            }
        }
    }
    
    // Initialize breadcrumbs
    function initialize() {
        log('Initializing breadcrumbs...');
        
        // Use utils for page change detection
        if (window.KefinTweaksUtils) {
            log('Registering breadcrumb handler with KefinTweaksUtils');
            
            // Register handler for all pages (breadcrumbs can appear on any detail page)
            window.KefinTweaksUtils.onViewPage(async (view, element, hash, itemPromise) => {
                try {
                    // Await the item promise to get the actual item data
                    const item = await itemPromise;
                    // Run our custom code
                    handlePageChange(item);
                } catch (err) {
                    error('Breadcrumb page change handler failed:', err);
                }
            }, {
                pages: [] // Empty array means all pages
            });
        } else {
            error('KefinTweaksUtils not available, breadcrumbs may not work correctly');
        }
        
        // Add resize listener
        window.addEventListener('resize', handleResize);
        
        // Initial check
        handlePageChange();
        
        log('Breadcrumbs initialized successfully');
    }
    
    // Start initialization when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initialize);
    } else {
        initialize();
    }
    
})();
