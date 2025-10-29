// Jellyfin Card Builder
// This module provides a main entry point function to build Jellyfin cards
// Usage: window.cardBuilder.buildCard(jellyfinItem)

(function() {
    'use strict';
    
    // Main card builder object
    const cardBuilder = {
        /**
         * Main entry point function to build a Jellyfin card
         * @param {Object} item - The Jellyfin item object
         * @param {boolean} overflowCard - Use overflow card classes instead of normal card classes
         * @param {string} cardFormat - Override card format: 'portrait', 'backdrop', or 'square'
         * @returns {HTMLElement} - The constructed card element
         */
        buildCard: function(item, overflowCard = false, cardFormat = null) {
            return createJellyfinCardElement(item, overflowCard, cardFormat);
        },
        
        /**
         * Renders a scrollable container with cards
         * @param {Array} items - Array of Jellyfin item objects
         * @param {string} title - Title for the scrollable container
         * @param {string|Function} viewMoreUrl - Optional URL to make title clickable, or function to call on click
         * @param {boolean} overflowCard - Use overflow card classes instead of normal card classes
         * @param {string} cardFormat - Override card format: 'portrait', 'backdrop', or 'square'
         * @returns {HTMLElement} - The constructed scrollable container
         */
        renderCards: function(items, title, viewMoreUrl = null, overflowCard = false, cardFormat = null) {
            return createScrollableContainer(items, title, viewMoreUrl, overflowCard, cardFormat);
        },

        /**
         * Renders a scrollable container with cards from item IDs
         * @param {Array} itemIds - Array of Jellyfin item IDs
         * @param {string} title - Title for the scrollable container
         * @param {string} viewMoreUrl - Optional URL to make title clickable
         * @param {boolean} overflowCard - Use overflow card classes instead of normal card classes
         * @param {string} cardFormat - Override card format: 'portrait', 'backdrop', or 'square'
         * @returns {Promise<HTMLElement>} - The constructed scrollable container
         */
        renderCardsFromIds: async function(itemIds, title, viewMoreUrl = null, overflowCard = false, cardFormat = null) {
            const LOG = (...args) => console.log('[CardBuilder]', ...args);
            
            if (!itemIds || itemIds.length === 0) {
                LOG(`No item IDs provided for section: ${title}`);
                return createScrollableContainer([], title, viewMoreUrl, overflowCard, cardFormat);
            }

            try {
                // Fetch all items at once
                const items = await Promise.all(
                    itemIds.map(id => ApiClient.getItem(ApiClient.getCurrentUserId(), id))
                );
                
                LOG(`Fetched ${items.length} items for section: ${title}`);
                return createScrollableContainer(items, title, viewMoreUrl, overflowCard, cardFormat);
            } catch (error) {
                console.error('[CardBuilder] Error fetching items:', error);
                return createScrollableContainer([], title, viewMoreUrl, overflowCard, cardFormat);
            }
        }
    };

    /**
     * Creates a Jellyfin card element from an item
     * @param {Object} item - The Jellyfin item object
     * @param {boolean} overflowCard - Use overflow card classes instead of normal card classes
     * @param {string} cardFormat - Override card format: 'portrait', 'backdrop', or 'square'
     * @returns {HTMLElement} - The constructed card element
     */
    function createJellyfinCardElement(item, overflowCard = false, cardFormat = null) {
        const serverId = ApiClient.serverId();
        const serverAddress = ApiClient.serverAddress();
        
        // Determine card type based on cardFormat override or item type
        let cardClass, padderClass, imageParams;
        
        if (cardFormat) {
            // Use specified cardFormat
            if (cardFormat === 'backdrop' || cardFormat === 'thumb') {
                cardClass = overflowCard ? 'overflowBackdropCard' : 'backdropCard';
                padderClass = 'cardPadder-backdrop';
                imageParams = 'fillHeight=267&fillWidth=474';
            } else if (cardFormat === 'square') {
                cardClass = overflowCard ? 'overflowSquareCard' : 'squareCard';
                padderClass = 'cardPadder-square';
                imageParams = 'fillHeight=297&fillWidth=297';
            } else {
                // portrait (default)
                cardClass = overflowCard ? 'overflowPortraitCard' : 'portraitCard';
                padderClass = 'cardPadder-portrait';
                imageParams = 'fillHeight=446&fillWidth=297';
            }
        } else {
            // Use item type to determine card type
            if (item.Type === 'Episode' || item.Type === 'TvChannel') {
                cardClass = overflowCard ? 'overflowBackdropCard' : 'backdropCard';
                padderClass = 'cardPadder-backdrop';
                imageParams = 'fillHeight=267&fillWidth=474';
            } else if (['MusicAlbum', 'Audio', 'Artist', 'MusicArtist'].includes(item.Type)) {
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
        card.setAttribute('data-isfolder', item.Type === 'MusicAlbum' || item.Type === 'Artist' ? 'true' : 'false');
        card.setAttribute('data-serverid', serverId);
        card.setAttribute('data-id', item.Id);
        card.setAttribute('data-type', item.Type);
        card.setAttribute('data-mediatype', item.MediaType || 'Video');
        card.setAttribute('data-prefix', item.Name?.startsWith('The ') ? 'THE' : '');

        // Card box container
        const cardBox = document.createElement('div');
        cardBox.className = 'cardBox cardBox-bottompadded';

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
        if (item.Type === 'Movie') {
            cardIcon.textContent = 'movie';
        } else if (item.Type === 'Series') {
            cardIcon.textContent = 'tv';
        } else if (item.Type === 'Episode') {
            cardIcon.textContent = 'play_circle';
        } else if (item.Type === 'MusicAlbum') {
            cardIcon.textContent = 'album';
        } else if (item.Type === 'Audio') {
            cardIcon.textContent = 'music_note';
        } else if (item.Type === 'Artist') {
            cardIcon.textContent = 'person';
        } else {
            cardIcon.textContent = 'folder';
        }
        
        cardPadder.appendChild(cardIcon);

        // Blurhash canvas (placeholder)
        const blurhashCanvas = document.createElement('canvas');
        blurhashCanvas.setAttribute('aria-hidden', 'true');
        blurhashCanvas.width = 20;
        blurhashCanvas.height = 20;
        blurhashCanvas.className = 'blurhash-canvas lazy-hidden';

        // Card image container
        const cardImageContainer = document.createElement('a');
        cardImageContainer.href = `${ApiClient._serverAddress}/web/#/details?id=${item.Id}&serverId=${serverId}`;
        cardImageContainer.className = 'cardImageContainer coveredImage cardContent itemAction lazy blurhashed lazy-image-fadein-fast';
        cardImageContainer.setAttribute('data-action', 'link');
        cardImageContainer.setAttribute('aria-label', item.Name || 'Unknown');

        // Force specific image if card format is specified
        if (cardFormat === 'backdrop') {
            let imageUrl = '';
            if (item.BackdropImageTags[0]) {
                imageUrl = `${serverAddress}/Items/${item.Id}/Images/Backdrop?${imageParams}&quality=96&tag=${item.BackdropImageTags[0]}`;
            } else if (item.ParentBackdropImageTags[0]) {
                imageUrl = `${serverAddress}/Items/${item.ParentBackdropItemId}/Images/Backdrop?${imageParams}&quality=96&tag=${item.ParentBackdropImageTags[0]}`;
            } else {
                imageUrl = `${serverAddress}/Items/${item.Id}/Images/Primary?${imageParams}&quality=96&tag=${item.ImageTags?.Primary}`;
            }
            cardImageContainer.style.backgroundImage = `url("${imageUrl}")`;
        } else if (cardFormat === 'square') {
            if (item.Type === 'Season' || item.Type === 'Series' || item.Type === 'Movie') {
                const imageUrl = item.BackdropImageTags[0] ? `${serverAddress}/Items/${item.Id}/Images/Backdrop?${imageParams}&quality=96&tag=${item.BackdropImageTags[0]}` : `${serverAddress}/Items/${item.Id}/Images/Primary?${imageParams}&quality=96&tag=${item.ImageTags?.Primary}`;
                cardImageContainer.style.backgroundImage = `url("${imageUrl}")`;
            } else {
                const imageUrl = item.PrimaryImageTags[0] ? `${serverAddress}/Items/${item.Id}/Images/Primary?${imageParams}&quality=96&tag=${item.PrimaryImageTags[0]}` : `${serverAddress}/Items/${item.Id}/Images/Thumb?${imageParams}&quality=96&tag=${item.ImageTags?.Thumb}`;
                cardImageContainer.style.backgroundImage = `url("${imageUrl}")`;
            }
        } else if (cardFormat === 'portrait') {
            if (item.Type === 'Episode' && item.SeriesPrimaryImageTag) {
                const imageUrl = `${serverAddress}/Items/${item.SeriesId}/Images/Primary?${imageParams}&quality=96&tag=${item.SeriesPrimaryImageTag}`;
                cardImageContainer.style.backgroundImage = `url("${imageUrl}")`;
            } else {
                const imageUrl = item.ImageTags?.Primary ? `${serverAddress}/Items/${item.Id}/Images/Primary?${imageParams}&quality=96&tag=${item.ImageTags?.Primary}` : `${serverAddress}/Items/${item.Id}/Images/Thumb?${imageParams}&quality=96&tag=${item.ImageTags?.Thumb}`;
                cardImageContainer.style.backgroundImage = `url("${imageUrl}")`;
            }
        } else if (cardFormat === 'thumb') {
            let imageUrl = '';
            if (item.ImageTags?.Thumb) {
                imageUrl = `${serverAddress}/Items/${item.Id}/Images/Thumb?${imageParams}&quality=96&tag=${item.ImageTags?.Thumb}`;
            } else if (item.ParentThumbImageTag) {
                imageUrl = `${serverAddress}/Items/${item.SeriesId}/Images/Thumb?${imageParams}&quality=96&tag=${item.ParentThumbImageTag}`;
            } else {
                imageUrl = `${serverAddress}/Items/${item.Id}/Images/Primary?${imageParams}&quality=96&tag=${item.ImageTags?.Primary}`;
            }
            cardImageContainer.style.backgroundImage = `url("${imageUrl}")`;
        } else if (item.ImageTags?.Primary) {
            let imageUrl;
            if (item.IsJellyseerr) {
                // Jellyseerr items use external image URLs
                imageUrl = item.ImageTags.Primary.startsWith('http') 
                    ? item.ImageTags.Primary 
                    : `https://image.tmdb.org/t/p/w500${item.ImageTags.Primary}`;
            } else {
                // Regular Jellyfin items
                imageUrl = `${serverAddress}/Items/${item.Id}/Images/Primary?${imageParams}&quality=96&tag=${item.ImageTags.Primary}`;
            }
            cardImageContainer.style.backgroundImage = `url("${imageUrl}")`;
        } else if (item.ImageTags?.Thumb) {
            const imageUrl = `${serverAddress}/Items/${item.Id}/Images/Thumb?${imageParams}&quality=96&tag=${item.ImageTags.Thumb}`;
            cardImageContainer.style.backgroundImage = `url("${imageUrl}")`;
        } else if ((item.Type === 'Season') && item.SeriesPrimaryImageTag) {
            const imageUrl = `${serverAddress}/Items/${item.Id}/Images/Primary?${imageParams}&quality=96&tag=${item.SeriesPrimaryImageTag}`;
            cardImageContainer.style.backgroundImage = `url("${imageUrl}")`;
        } else if ((item.Type === 'Episode') && item.ParentThumbImageTag) {
            const imageUrl = `${serverAddress}/Items/${item.ParentThumbItemId}/Images/Thumb?${imageParams}&quality=96&tag=${item.ParentThumbImageTag}`;
            cardImageContainer.style.backgroundImage = `url("${imageUrl}")`;
        } else if (item.BackdropImageTags && item.BackdropImageTags.length > 0) {
            const imageUrl = `${serverAddress}/Items/${item.Id}/Images/Backdrop?${imageParams}&quality=96&tag=${item.BackdropImageTags[0]}`;
            cardImageContainer.style.backgroundImage = `url("${imageUrl}")`;
        } else if (item.ParentBackdropImageTags && item.ParentBackdropImageTags.length > 0) {
            const imageUrl = `${serverAddress}/Items/${item.ParentBackdropItemId}/Images/Backdrop?${imageParams}&quality=96&tag=${item.ParentBackdropImageTags[0]}`;
            cardImageContainer.style.backgroundImage = `url("${imageUrl}")`;
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

        // Card overlay container
        const cardOverlayContainer = document.createElement('div');
        cardOverlayContainer.className = 'cardOverlayContainer itemAction';
        cardOverlayContainer.setAttribute('data-action', 'link');

        // Overlay link
        const overlayLink = document.createElement('a');
        overlayLink.href = `${ApiClient._serverAddress}/web/#/details?id=${item.Id}&serverId=${serverId}`;
        overlayLink.className = 'cardImageContainer';

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
        watchedButton.setAttribute('data-id', item.Id);
        watchedButton.setAttribute('data-serverid', serverId);
        watchedButton.setAttribute('data-itemtype', item.Type);
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
        favoriteButton.setAttribute('data-id', item.Id);
        favoriteButton.setAttribute('data-serverid', serverId);
        favoriteButton.setAttribute('data-itemtype', item.Type);
        favoriteButton.setAttribute('data-likes', '');
        favoriteButton.setAttribute('data-isfavorite', item.UserData?.IsFavorite || 'false');
        favoriteButton.title = 'Add to favorites';
        
        const favoriteIcon = document.createElement('span');
        favoriteIcon.className = 'material-icons cardOverlayButtonIcon cardOverlayButtonIcon-hover favorite';
        favoriteIcon.setAttribute('aria-hidden', 'true');
        favoriteButton.appendChild(favoriteIcon);
        buttonContainer.appendChild(favoriteButton);

        // Assemble overlay
        cardOverlayContainer.appendChild(overlayLink);
        cardOverlayContainer.appendChild(playButton);
        cardOverlayContainer.appendChild(buttonContainer);

        // Card text container - different structure for episodes
        const cardTextContainer = document.createElement('div');
        cardTextContainer.className = 'cardText cardTextCentered cardText-first';

        if (item.Type === 'Episode') {
            // Episodes: Series name as primary, episode title as secondary
            const seriesLink = document.createElement('a');
            seriesLink.href = `${ApiClient._serverAddress}/web/#/details?id=${item.SeriesId || item.Id}&serverId=${serverId}`;
            seriesLink.className = 'itemAction textActionButton';
            seriesLink.setAttribute('data-id', item.SeriesId || item.Id);
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

            // Episode title as secondary
            const secondaryText = document.createElement('div');
            secondaryText.className = 'cardText cardTextCentered cardText-secondary';
            const episodeLink = document.createElement('a');
            episodeLink.href = `${ApiClient._serverAddress}/web/#/details?id=${item.Id}&serverId=${serverId}`;
            episodeLink.className = 'itemAction textActionButton';
            episodeLink.setAttribute('data-id', item.Id);
            episodeLink.setAttribute('data-serverid', serverId);
            episodeLink.setAttribute('data-type', 'Episode');
            episodeLink.setAttribute('data-mediatype', 'undefined');
            episodeLink.setAttribute('data-channelid', 'undefined');
            episodeLink.setAttribute('data-isfolder', 'false');
            episodeLink.setAttribute('data-action', 'link');
            episodeLink.title = item.Name || 'Unknown Episode';
            episodeLink.textContent = item.Name || 'Unknown Episode';

            const episodeBdi = document.createElement('bdi');
            episodeBdi.appendChild(episodeLink);
            secondaryText.appendChild(episodeBdi);
        } else {
            // Default: Item name as primary, year as secondary
            const titleLink = document.createElement('a');
            titleLink.href = `${ApiClient._serverAddress}/web/#/details?id=${item.Id}&serverId=${serverId}`;
            titleLink.className = 'itemAction textActionButton';
            titleLink.setAttribute('data-id', item.Id);
            titleLink.setAttribute('data-serverid', serverId);
            titleLink.setAttribute('data-type', item.Type);
            titleLink.setAttribute('data-mediatype', 'undefined');
            titleLink.setAttribute('data-channelid', 'undefined');
            titleLink.setAttribute('data-isfolder', item.Type === 'MusicAlbum' || item.Type === 'Artist' || item.Type === 'MusicArtist' ? 'true' : 'false');
            titleLink.setAttribute('data-action', 'link');
            titleLink.title = item.Name || 'Unknown';
            titleLink.textContent = item.Name || 'Unknown';

            const titleBdi = document.createElement('bdi');
            titleBdi.appendChild(titleLink);
            cardTextContainer.appendChild(titleBdi);

            // Secondary text (year)
            const secondaryText = document.createElement('div');
            secondaryText.className = 'cardText cardTextCentered cardText-secondary';
            const yearBdi = document.createElement('bdi');
            yearBdi.textContent = item.ProductionYear || item.PremiereDate?.substring(0, 4) || '';
            secondaryText.appendChild(yearBdi);
        }

        // Assemble card
        cardScalable.appendChild(cardPadder);
        cardScalable.appendChild(blurhashCanvas);
        cardScalable.appendChild(cardImageContainer);
        cardScalable.appendChild(cardOverlayContainer);
        
        cardBox.appendChild(cardScalable);
        cardBox.appendChild(cardTextContainer);
        
        // Add secondary text after primary text
        if (item.Type === 'Episode') {
            const secondaryText = document.createElement('div');
            secondaryText.className = 'cardText cardTextCentered cardText-secondary';
            const episodeLink = document.createElement('a');
            const episodeName = item.IndexNumber && item.ParentIndexNumber ? `S${item.ParentIndexNumber}:E${item.IndexNumber} - ${item.Name}` : item.Name;
            episodeLink.href = `${ApiClient._serverAddress}/web/#/details?id=${item.Id}&serverId=${serverId}`;
            episodeLink.className = 'itemAction textActionButton';
            episodeLink.setAttribute('data-id', item.Id);
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
            cardBox.appendChild(secondaryText);
        } else {
            const secondaryText = document.createElement('div');
            secondaryText.className = 'cardText cardTextCentered cardText-secondary';
            const yearBdi = document.createElement('bdi');
            yearBdi.textContent = item.ProductionYear || item.PremiereDate?.substring(0, 4) || '';
            secondaryText.appendChild(yearBdi);
            cardBox.appendChild(secondaryText);
        }
        
        card.appendChild(cardBox);

        return card;
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
    function createScrollableContainer(items, title, viewMoreUrl = null, overflowCard = false, cardFormat = null) {
        const LOG = (...args) => console.log('[CardBuilder]', ...args);
        
        // Create the main vertical section container
        const verticalSection = document.createElement('div');
        verticalSection.className = 'verticalSection emby-scroller-container custom-scroller-container';

        // Create section title
        const sectionTitleContainer = document.createElement('div');
        sectionTitleContainer.className = 'sectionTitleContainer sectionTitleContainer-cards padded-left';
        
        if (viewMoreUrl) {
            // Create clickable title with chevron icon
            const titleLink = document.createElement('a');
            titleLink.className = 'sectionTitle-link sectionTitleTextButton';
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

        // Create "Show All" button (will be added after items are created)
        const showAllButton = document.createElement('button');
        showAllButton.type = 'button';
        showAllButton.className = 'show-all-button';
        showAllButton.style.cssText = 'margin-left: 10px; font-size: 12px; padding: 4px 8px; min-width: auto; background: transparent; border: 1px solid rgba(255, 255, 255, 0.3) !important; border-radius: 4px; cursor: pointer; color: var(--main-text, #fff) !important; margin-bottom: .35em; align-self: center;';
        showAllButton.textContent = 'Show All';
        showAllButton.title = 'Show all items in a grid layout';

        // Create scroller container
        const scroller = document.createElement('div');
        scroller.setAttribute('is', 'emby-scroller');
        scroller.setAttribute('data-horizontal', 'true');
        scroller.setAttribute('data-centerfocus', 'card');
        scroller.className = 'padded-top-focusscale padded-bottom-focusscale emby-scroller custom-scroller';
        scroller.setAttribute('data-scroll-mode-x', 'custom');
        scroller.style.overflow = 'hidden';

        // Create items container
        const itemsContainer = document.createElement('div');
        itemsContainer.setAttribute('is', 'emby-itemscontainer');
        itemsContainer.className = 'focuscontainer-x itemsContainer scrollSlider animatedScrollX';
        itemsContainer.style.whiteSpace = 'nowrap';

        // Add items to container
        items.forEach((item, index) => {
            const card = createJellyfinCardElement(item, overflowCard, cardFormat);
            card.setAttribute('data-index', index);
            itemsContainer.appendChild(card);
        });

        scroller.appendChild(itemsContainer);

        // Add "Show All" button to title if there are more than 20 items
        if (items.length > 20) {
            sectionTitleContainer.style.display = 'flex';
            sectionTitleContainer.appendChild(showAllButton);
        }

        // Toggle between scroll and grid view
        let isShowingAll = false;
        const originalItemsContainerStyle = itemsContainer.style.cssText;
        
        showAllButton.addEventListener('click', () => {
            // Find the scroll buttons for this container
            const scrollerContainer = showAllButton.closest('.emby-scroller-container');
            const scrollButtons = scrollerContainer ? scrollerContainer.querySelector('.emby-scrollbuttons') : null;
            
            if (isShowingAll) {
                // Switch back to scroll view
                itemsContainer.style.cssText = originalItemsContainerStyle;
                if (scrollButtons) scrollButtons.style.display = '';
                showAllButton.textContent = 'Show All';
                showAllButton.title = 'Show all items in a grid layout';
                isShowingAll = false;
            } else {
                // Switch to grid view
                itemsContainer.style.cssText = 'display: flex; flex-wrap: wrap; gap: 12px; white-space: normal; transform: none !important; transition: none !important;';
                if (scrollButtons) scrollButtons.style.display = 'none';
                showAllButton.textContent = 'Show Less';
                showAllButton.title = 'Show items in scrollable layout';
                isShowingAll = true;
            }
        });

        // Assemble the section
        verticalSection.appendChild(sectionTitleContainer);
        verticalSection.appendChild(scroller);

        return verticalSection;
    }

    // Expose the cardBuilder to the global window object
    window.cardBuilder = cardBuilder;
    
    console.log('[CardBuilder] Module loaded and available at window.cardBuilder');
})();
