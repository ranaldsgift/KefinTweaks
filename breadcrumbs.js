// KefinTweaks Breadcrumbs
// Adds breadcrumb navigation to item detail pages
// Supports: Movie, Series, Season, Episode, MusicArtist, MusicAlbum

(function() {
    'use strict';
    
    console.log('[KefinTweaks Breadcrumbs] Initializing...');
    
    // Configuration
    const CONFIG = {
        supportedTypes: ['Movie', 'Series', 'Season', 'Episode', 'MusicArtist', 'MusicAlbum'],
        minWidth: 768, // Only show on screens wider than 768px
        headerHeight: 80 // Position below .skinHeader
    };
    
    // State management
    let currentBreadcrumbs = null;
    let breadcrumbContainer = null;
    let activePopover = null;
    let currentItemId = null;
    
    // Track parent IDs to avoid unnecessary API calls
    let lastSeasonsParentId = null;
    let lastAlbumsParentId = null;
    let cachedSeasonsData = null;
    let cachedAlbumsData = null;
    
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
    
    // Simplified breadcrumb structure definition
    async function getTargetBreadcrumbStructure(item) {
        const structure = {
            elements: [],
            item: item
        };
        
        if (item.Type === 'Movie') {
            structure.elements = [
                { text: 'Movies', url: '#/movies.html', clickable: true },
                { text: item.Name, url: null, clickable: false }
            ];
        } else if (item.Type === 'Series') {
            structure.elements = [
                { text: 'Shows', url: '#/tv.html', clickable: true },
                { text: item.Name, url: null, clickable: false },
                { text: 'All Seasons', url: null, clickable: true, popover: true }
            ];
        } else if (item.Type === 'Season') {
            // Get series details for the series name
            const seriesDetails = await getItemDetails(item.ParentId);
            const seriesName = seriesDetails ? seriesDetails.Name : 'Unknown Series';
            
            structure.elements = [
                { text: 'Shows', url: '#/tv.html', clickable: true },
                { text: seriesName, url: `#/details?id=${item.ParentId}&serverId=${ApiClient.serverId()}`, clickable: true },
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
                { text: 'Shows', url: '#/tv.html', clickable: true },
                { text: seriesName, url: `#/details?id=${item.SeriesId}&serverId=${ApiClient.serverId()}`, clickable: true },
                { text: seasonName, url: null, clickable: true, popover: true },
                { text: `${item.ParentIndexNumber}x${padNumber(item.IndexNumber)} - ${item.Name}`, url: null, clickable: false }
            ];
        } else if (item.Type === 'MusicArtist') {
            structure.elements = [
                { text: 'Music', url: '#/music.html', clickable: true },
                { text: item.Name, url: null, clickable: false },
                { text: 'All Albums', url: null, clickable: true, popover: true }
            ];
        } else if (item.Type === 'MusicAlbum') {
            structure.elements = [
                { text: 'Music', url: '#/music.html', clickable: true },
                { text: item.AlbumArtist, url: `#/details?id=${item.ParentId}&serverId=${ApiClient.serverId()}`, clickable: true },
                { text: item.Name, url: null, clickable: true, popover: true }
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
                    // Force update for "All Seasons" and "All Albums" elements since the underlying data changes
                    targetElement.text === 'All Seasons' ||
                    targetElement.text === 'All Albums'
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
                    window.location.hash = elementDef.url;
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
                    window.location.hash = elementDef.url;
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
                    window.location.hash = `#/details?id=${selectedSeason.Id}&serverId=${ApiClient.serverId()}`;
                });
                showPopover(element, popover);
            });
        } else if (elementDef.text === 'All Albums') {
            // Music Artist page - always show popover
            const albums = await getAlbumsIfNeeded(item.Id);
            element.addEventListener('click', (e) => {
                e.stopPropagation();
                const popover = createPopover(albums, null, (selectedAlbum) => {
                    window.location.hash = `#/details?id=${selectedAlbum.Id}&serverId=${ApiClient.serverId()}`;
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
                        window.location.hash = `#/details?id=${selectedSeason.Id}&serverId=${ApiClient.serverId()}`;
                    });
                    showPopover(element, popover);
                });
            }
        } else if (item.Type === 'Episode') {
            // Episode page - check if single season
            const seasons = await getSeasonsIfNeeded(item.SeriesId);
            if (seasons.length === 1) {
                element.addEventListener('click', () => {
                    window.location.hash = `#/details?id=${seasons[0].Id}&serverId=${ApiClient.serverId()}`;
                });
            } else {
                const currentSeason = seasons.find(season => season.Id === item.ParentId);
                element.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const popover = createPopover(seasons, currentSeason, (selectedSeason) => {
                        window.location.hash = `#/details?id=${selectedSeason.Id}&serverId=${ApiClient.serverId()}`;
                    });
                    showPopover(element, popover);
                });
            }
        } else if (item.Type === 'MusicAlbum') {
            // Music album page - check if single album
            const albums = await getAlbumsIfNeeded(item.ParentId);
            if (albums.length === 1) {
                element.addEventListener('click', () => {
                    window.location.hash = `#/details?id=${albums[0].Id}&serverId=${ApiClient.serverId()}`;
                });
            } else {
                element.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const popover = createPopover(albums, item, (selectedAlbum) => {
                        window.location.hash = `#/details?id=${selectedAlbum.Id}&serverId=${ApiClient.serverId()}`;
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
    
    function debugBreadcrumbLinks() {
        if (!breadcrumbContainer) return;
        
        const children = Array.from(breadcrumbContainer.children);
        log('Breadcrumb structure:');
        children.forEach((child, index) => {
            if (child.style.cursor === 'pointer') {
                log(`  Element ${index}: "${child.textContent}" (clickable)`);
            } else {
                log(`  Element ${index}: "${child.textContent}" (static)`);
            }
        });
    }
    
    function ensureSeriesNameIsClickable(seriesId) {
        if (!breadcrumbContainer) return;
        
        const children = Array.from(breadcrumbContainer.children);
        
        // Find the series name element (should be the 3rd element: Shows / Series Name / ...)
        if (children.length >= 3) {
            const seriesElement = children[2]; // Shows (0) / Series Name (2) / ...
            
            // Check if it's already clickable
            if (seriesElement.style.cursor !== 'pointer') {
                log('Making series name clickable:', seriesElement.textContent);
                
                // Make it clickable
                seriesElement.style.cursor = 'pointer';
                
                // Add click handler
                seriesElement.onclick = () => {
                    window.location.hash = `#/details?id=${seriesId}&serverId=${ApiClient.serverId()}`;
                };
                
                log('Series name is now clickable and links to series page:', seriesId);
            } else {
                // Update existing click handler to ensure it points to the series page
                seriesElement.onclick = () => {
                    window.location.hash = `#/details?id=${seriesId}&serverId=${ApiClient.serverId()}`;
                };
                log('Updated series name click handler to point to series page:', seriesId);
            }
        }
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
        
        log('showBreadcrumbs called - wrapper exists:', !!wrapper, 'isWideScreen:', wideScreen, 'isSupportedPage:', isSupportedPage, 'currentPath:', currentPath);
        
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
            
            itemElement.textContent = item.Name || `Season ${item.IndexNumber}`;
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
            error('Failed to get item details:', err);
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
    
    // Breadcrumb generation
    function createBreadcrumbElement(text, url = null, isClickable = true) {
        const element = document.createElement('span');
        element.className = 'kefinTweaks-breadcrumb-element';
        element.textContent = text;
        
        if (url && isClickable) {
            element.style.cursor = 'pointer';
            element.addEventListener('click', () => {
                window.location.hash = url;
            });
        }
        
        return element;
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
    async function handlePageChange() {
        try {
            // Close any active popovers first
            closePopover();
            
            const currentPath = Emby.Page.lastPath;
            log('Page changed to:', currentPath);
            
            // Check if we're on a details page
            if (!currentPath || !currentPath.startsWith('/details?')) {
                log('Not a details page, hiding and clearing breadcrumbs');
                clearBreadcrumbs();
                hideBreadcrumbs();
                return;
            }
            
            // Extract item ID
            const itemId = getItemIdFromPath(currentPath);
            if (!itemId) {
                log('No item ID found in path, hiding and clearing breadcrumbs');
                clearBreadcrumbs();
                hideBreadcrumbs();
                return;
            }
            
            // Get item details
            const item = await getItemDetails(itemId);
            if (!item) {
                log('Failed to get item details, hiding and clearing breadcrumbs');
                clearBreadcrumbs();
                hideBreadcrumbs();
                return;
            }
            
            // Check if item type is supported
            if (!CONFIG.supportedTypes.includes(item.Type)) {
                log('Item type not supported:', item.Type, 'hiding and clearing breadcrumbs');
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
        
        // Clear existing content
        clearBreadcrumbs();
        
        // Add all elements
        for (let i = 0; i < targetStructure.elements.length; i++) {
            const elementDef = targetStructure.elements[i];
            const element = await createBreadcrumbElementFromStructure(elementDef, targetStructure.item);
            
            breadcrumbContainer.appendChild(element);
            
            // Add separator after each element except the last
            if (i < targetStructure.elements.length - 1) {
                const separator = createSeparator();
                breadcrumbContainer.appendChild(separator);
            }
        }
        
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
            window.KefinTweaksUtils.onViewPage((view, element) => {
                try {
                    // Run our custom code
                    handlePageChange();
                } catch (err) {
                    error('Breadcrumb page change handler failed:', err);
                }
            }, {
                immediate: true,
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
