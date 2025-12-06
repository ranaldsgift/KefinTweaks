// Jellyfin Card Builder
// This module provides a main entry point function to build Jellyfin cards
// Usage: window.cardBuilder.buildCard(jellyfinItem)

(function() {
    'use strict';
    
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
    
    // Main card builder object
    const cardBuilder = {
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
        renderCards: function(items, title, viewMoreUrl = null, overflowCard = false, cardFormat = null, sortOrder = null, sortOrderDirection = 'Ascending') {
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
            
            return createScrollableContainer(sortedItems, title, viewMoreUrl, overflowCard, finalCardFormat);
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
                
                return createScrollableContainer(sortedItems, title, viewMoreUrl, overflowCard, finalCardFormat);
            } catch (error) {
                console.error('[KefinTweaks CardBuilder] Error fetching items:', error);
                return createScrollableContainer([], title, viewMoreUrl, overflowCard, cardFormat);
            }
        },
        
        /**
         * Renders a spotlight section (Netflix-style slim banner carousel)
         * @param {Array} items - Array of Jellyfin item objects
         * @param {string} title - Title for the spotlight section
         * @param {Object} options - Options for the spotlight carousel
         * @returns {HTMLElement} - The constructed spotlight container
         */
        renderSpotlightSection: function(items, title, options = {}) {
            return createSpotlightSection(items, title, options);
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
        }
    };

    /**
     * Creates a Jellyfin card element from an item
     * @param {Object} item - The Jellyfin item object
     * @param {boolean} overflowCard - Use overflow card classes instead of normal card classes
     * @param {string} cardFormat - Override card format: 'portrait', 'backdrop', 'thumb', or 'square'
     * @param {string} customFooterText - Optional custom footer text (e.g., air date for episodes)
     * @returns {HTMLElement} - The constructed card element
     */
    function createJellyfinCardElement(item, overflowCard = false, cardFormat = null, customFooterText = null) {
        const serverId = ApiClient.serverId();
        const serverAddress = ApiClient.serverAddress();
        
        // Determine card type based on cardFormat override or item type
        let cardClass, padderClass, imageParams;
        cardFormat = cardFormat?.toLowerCase() || null;
        
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
            } else if (item.ParentBackdropImageTags && item.ParentBackdropImageTags[0]) {
                imageUrl = `${serverAddress}/Items/${item.ParentBackdropItemId}/Images/Backdrop?${imageParams}&quality=96&tag=${item.ParentBackdropImageTags[0]}`;
            } else if (item.ImageTags?.Thumb) {
                imageUrl = `${serverAddress}/Items/${item.Id}/Images/Thumb?${imageParams}&quality=96&tag=${item.ImageTags?.Thumb}`;
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
            } else if (item.ParentBackdropImageTags && item.ParentBackdropImageTags.length > 0) {
                imageUrl = `${serverAddress}/Items/${item.ParentBackdropItemId}/Images/Backdrop?${imageParams}&quality=96&tag=${item.ParentBackdropImageTags[0]}`;
            } else if (item.SeriesPrimaryImageTag) {
                imageUrl = `${serverAddress}/Items/${item.SeriesId}/Images/Primary?${imageParams}&quality=96&tag=${item.SeriesPrimaryImageTag}`;
            } else if (item.ImageTags?.Primary) {
                imageUrl = `${serverAddress}/Items/${item.Id}/Images/Primary?${imageParams}&quality=96&tag=${item.ImageTags.Primary}`;
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

        if (item.UserData?.Played) {
            const cardIndicators = document.createElement('div');
            cardIndicators.className = 'cardIndicators';
            const playedIndicator = document.createElement('div');
            playedIndicator.className = 'playedIndicator indicator';
            const playedIndicatorIcon = document.createElement('span');
            playedIndicatorIcon.className = 'material-icons indicatorIcon check';
            playedIndicatorIcon.setAttribute('aria-hidden', 'true');
            playedIndicator.appendChild(playedIndicatorIcon);
            cardIndicators.appendChild(playedIndicator);
            cardImageContainer.appendChild(cardIndicators);
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
            
            // Add custom footer text if provided (e.g., air date)
            if (customFooterText) {
                const footerText = document.createElement('div');
                footerText.className = 'cardText cardTextCentered cardText-secondary';
                const footerBdi = document.createElement('bdi');
                footerBdi.textContent = customFooterText;
                footerText.appendChild(footerBdi);
                cardBox.appendChild(footerText);
            }
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
     * Renders a spotlight section (Netflix-style slim banner carousel)
     * @param {Array} items - Array of Jellyfin item objects
     * @param {string} title - Title for the spotlight section
     * @param {Object} options - Options for the spotlight carousel
     * @param {boolean} options.autoPlay - Auto-cycle through items (default: true)
     * @param {number} options.interval - Auto-play interval in ms (default: 5000)
     * @param {boolean} options.showDots - Show dot indicators (default: true)
     * @param {boolean} options.showNavButtons - Show prev/next buttons (default: true)
     * @returns {HTMLElement} - The constructed spotlight container
     */
    function createSpotlightSection(items, title, options = {}) {
        if (!items || items.length === 0) {
            return document.createElement('div');
        }
        
        const {
            autoPlay = true,
            interval = 5000,
            showDots = true,
            showNavButtons = true,
            showClearArt = false,
            viewMoreUrl = null
        } = options;
        
        const serverId = ApiClient.serverId();
        const serverAddress = ApiClient.serverAddress();
        let currentIndex = 0;
        let autoPlayTimer = null;
        let isPaused = false;
        
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
                titleLink.className = 'spotlight-section-title spotlight-title-link';
                titleLink.textContent = title;
                titleLink.title = 'See All';
                titleLink.style.textDecoration = 'none';

                const cssStyle = document.createElement('style');
                cssStyle.textContent = `
                    .spotlight-title-link:hover {
                        text-decoration: underline !important;
                    }
                `;
                titleLink.appendChild(cssStyle);
                
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
                sectionTitleEl.className = 'spotlight-section-title';
                sectionTitleEl.textContent = title;
            }
            
            bannerContainer.appendChild(sectionTitleEl);
        }
        
        // Create items container (for fade transitions)
        const itemsContainer = document.createElement('div');
        itemsContainer.className = 'spotlight-items-container';
        
        // Create items
        items.forEach((item, index) => {
            // Get item type early for use throughout
            const itemType = item.Type || 'Movie';
            
            const itemDiv = document.createElement('div');
            itemDiv.className = 'spotlight-item';
            itemDiv.setAttribute('data-index', index);
            if (index === 0) {
                itemDiv.style.opacity = '1';
            } else {
                itemDiv.style.opacity = '0';
            }

            let imageUrl = '';

            if (item.Type === 'Episode' && item.ParentBackdropImageTags?.[0]) {
                // Series backdrop image
                imageUrl = `${serverAddress}/Items/${item.ParentBackdropItemId}/Images/Backdrop?fillHeight=450&fillWidth=1920&quality=96&tag=${item.ParentBackdropImageTags[0]}`;
            } else if (item.BackdropImageTags?.[0]) {
                imageUrl = `${serverAddress}/Items/${item.Id}/Images/Backdrop?fillHeight=450&fillWidth=1920&quality=96&tag=${item.BackdropImageTags[0]}`;
            } else if (item.ImageTags?.Primary) {
                imageUrl = `${serverAddress}/Items/${item.Id}/Images/Primary?fillHeight=450&fillWidth=1920&quality=96&tag=${item.ImageTags.Primary}`;
            }
            
            if (imageUrl) {
                itemDiv.style.backgroundImage = `url("${imageUrl}")`;
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
                const logoUrl = `${serverAddress}/Items/${item.Id}/Images/Logo?fillHeight=200&quality=96&tag=${item.ImageTags.Logo}`;
                titleEl = document.createElement('img');
                titleEl.className = 'spotlight-item-logo';
                titleEl.src = logoUrl;
                titleEl.alt = item.Name || 'Unknown';
            } else {
                // Use text title as fallback
                titleEl = document.createElement('h3');
                titleEl.className = 'spotlight-item-title';
                titleEl.textContent = item.Name || 'Unknown';
            }
            
            // Combined: Year + Time + Ends At + Genres (all on one line)
            const metadataRow = document.createElement('div');
            metadataRow.className = 'spotlight-metadata-row';
            
            // Year
            const year = item.ProductionYear || (item.PremiereDate ? new Date(item.PremiereDate).getFullYear() : null);
            if (year) {
                const yearEl = document.createElement('span');
                yearEl.textContent = year;
                metadataRow.appendChild(yearEl);
            }
            
            // Runtime
            if (item.RunTimeTicks) {
                const runtimeMinutes = Math.round(item.RunTimeTicks / 10000000 / 60);
                const hours = Math.floor(runtimeMinutes / 60);
                const minutes = runtimeMinutes % 60;
                let runtimeText = '';
                if (hours > 0) {
                    runtimeText = `${hours}h ${minutes > 0 ? minutes + 'm' : ''}`.trim();
                } else {
                    runtimeText = `${minutes}m`;
                }
                
                const runtimeEl = document.createElement('span');
                runtimeEl.textContent = runtimeText;
                metadataRow.appendChild(runtimeEl);
                
                // End time (when it would end if started now)
                const now = new Date();
                // RunTimeTicks is in 100-nanosecond intervals, convert to milliseconds
                const runtimeMs = item.RunTimeTicks / 10000;
                const endTime = new Date(now.getTime() + runtimeMs);
                const endTimeEl = document.createElement('span');
                endTimeEl.className = 'spotlight-end-time';
                endTimeEl.textContent = `Ends at ${endTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
                metadataRow.appendChild(endTimeEl);
            }
            
            // Genres (on same line) - make clickable if IDs are available
            if (item.Genres && item.Genres.length > 0) {
                const genresContainer = document.createElement('span');

                if (item.GenreItems && item.GenreItems.length > 0) {
                    item.GenreItems.forEach((genreItem, index) => {
                        const genreName = genreItem.Name;
                        const genreId = genreItem.Id;
                        
                        if (genreName) {
                            const genreLink = document.createElement('a');
                            genreLink.className = 'spotlight-genre-link';
                            genreLink.href = `${serverAddress}/web/#/list.html?genreId=${genreId}&serverId=${serverId}`;
                            genreLink.textContent = genreName;
                            genreLink.addEventListener('click', (e) => {
                                e.stopPropagation();
                            });
                            if (index > 0) {
                                const comma = document.createElement('span');
                                comma.textContent = ', ';
                                genresContainer.appendChild(comma);
                            }

                            genresContainer.appendChild(genreLink);
                        }
                    });
                }
                
                if (genresContainer.children.length > 0) {
                    metadataRow.appendChild(genresContainer);
                }
            }
            
            // Helper function to create truncated list that expands on ellipsis hover
            // items can be array of strings (names) or array of objects with Name and Id
            function createTruncatedList(label, items, maxItems = 3, isPeople = false) {                
                const container = document.createElement('div');
                container.className = 'spotlight-truncated-list';

                if (!items || items.length === 0) {
                    return container;
                }
                
                const displayContainer = document.createElement('span');
                const labelSpan = document.createElement('span');
                labelSpan.textContent = `${label} `;
                displayContainer.appendChild(labelSpan);
                
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
                
                // Store references to hidden elements for easy show/hide
                const hiddenElements = [];
                
                // Create spans for all names (but initially hide the ones beyond maxItems)
                itemsData.forEach((itemData, index) => {
                    let nameElement;
                    
                    // Create link if it's a person with an ID, otherwise just text
                    if (isPeople && itemData.id) {
                        nameElement = document.createElement('a');
                        nameElement.className = 'spotlight-person-link';
                        nameElement.href = `${serverAddress}/web/#/details?id=${itemData.id}&serverId=${serverId}`;
                        nameElement.textContent = itemData.name;
                        nameElement.addEventListener('click', (e) => {
                            e.stopPropagation();
                        });
                    } else {
                        nameElement = document.createElement('span');
                        nameElement.textContent = itemData.name;
                    }
                    
                    nameElement.setAttribute('data-name-index', index);
                    
                    // Hide names beyond maxItems initially
                    if (index >= maxItems) {
                        nameElement.style.display = 'none';
                        hiddenElements.push(nameElement);
                    }
                    
                    displayContainer.appendChild(nameElement);
                    
                    // Add comma separator (except for last item)
                    if (index < itemsData.length - 1) {
                        const comma = document.createElement('span');
                        comma.textContent = ', ';
                        comma.setAttribute('data-comma-after', index);
                        
                        // Hide comma if it's after the last visible item
                        if (index >= maxItems - 1) {
                            comma.style.cssText = 'display: none;';
                            hiddenElements.push(comma);
                        }
                        displayContainer.appendChild(comma);
                    }
                });
                
                // Add ellipsis as separate hoverable element if there are more items
                if (hasMore) {
                    const ellipsisElement = document.createElement('span');
                    ellipsisElement.className = 'spotlight-ellipsis';
                    ellipsisElement.textContent = '...';
                    displayContainer.appendChild(ellipsisElement);
                    
                    let isExpanded = false;
                    
                    // On ellipsis hover, reveal all hidden names and hide ellipsis
                    ellipsisElement.addEventListener('mouseenter', () => {
                        if (!isExpanded) {
                            // Show all hidden elements
                            hiddenElements.forEach(el => {
                                el.style.display = '';
                            });
                            ellipsisElement.style.display = 'none';
                            isExpanded = true;
                        }
                    });
                    
                    // Keep expanded state when mouse moves within the container
                    // Only collapse when mouse leaves the entire container
                    container.addEventListener('mouseleave', () => {
                        if (isExpanded) {
                            // Hide names beyond maxItems again
                            hiddenElements.forEach(el => {
                                el.style.display = 'none';
                            });
                            ellipsisElement.style.display = '';
                            isExpanded = false;
                        }
                    });
                }
                
                container.appendChild(displayContainer);
                return container;
            }
            
            // For Series: show seasons/episodes. For Movies: show director/writer
            let directorContainer = null;
            let writerContainer = null;
            let combinedContainer = null;
            let seriesInfoContainer = null;
                
            // Create series info container
            seriesInfoContainer = document.createElement('div');
            seriesInfoContainer.className = 'spotlight-truncated-list';
            
            if (itemType === 'Series') {
                // For Series, show seasons and episodes count
                const seasonsCount = item.ChildCount || 0;
                
                // Initial text with seasons count
                const seasonsText = `${seasonsCount} ${seasonsCount === 1 ? 'season' : 'seasons'}`;
                seriesInfoContainer.textContent = seasonsText;
                
                // Fetch episode count asynchronously and update
                (async () => {
                    try {
                        const episodesCount = item.RecursiveItemCount || 0;
                        
                        // Update the series info container with episode count
                        if (seriesInfoContainer) {
                            const episodesText = `${episodesCount} ${episodesCount === 1 ? 'episode' : 'episodes'}`;
                            seriesInfoContainer.textContent = `${seasonsText} - ${episodesText}`;
                        }
                    } catch (err) {
                        console.error('Failed to fetch episode count:', err);
                        // Keep just the seasons text if episode fetch fails
                    }
                })();
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
                        combinedContainer = createTruncatedList('Directed and Written by', directors, 3, true);
                        // Add empty writer container to maintain spacing
                        writerContainer = document.createElement('div');
                        writerContainer.className = 'spotlight-empty-writer-container';
                    } else {
                        // Show separately (with person objects for links)
                        directorContainer = createTruncatedList('Directed by', directors, 3, true);
                        writerContainer = createTruncatedList('Written by', writers, 3, true);
                    }
                }
            } else if (itemType === 'Season') {
                // For Seasons, show episodes count
                const episodesCount = item.RecursiveItemCount || 0;
                const episodesText = `${episodesCount} ${episodesCount === 1 ? 'episode' : 'episodes'}`;
                seriesInfoContainer.textContent = episodesText;
            } else if (itemType === 'Episode') {
                // For Episodes, show episode number
                const seasonNumber = item.ParentIndexNumber || 0;
                const seasonText = `Season ${seasonNumber}`;
                const episodeNumber = item.IndexNumber || 0;
                const episodeText = `Episode ${episodeNumber}`;
                seriesInfoContainer.textContent = `${seasonText} - ${episodeText}`;
            }
            
            // Taglines for Movies, Overview for Series
            let taglineEl = null;
            taglineEl = document.createElement('p');
            taglineEl.className = 'spotlight-tagline';
            if (itemType === 'Series') {
                // For Series, show Overview instead of Tagline
                if (item.Overview) {                    
                    taglineEl.textContent = item.Overview;
                }
            } else {
                // For Movies, show Tagline (if available)
                if (item.Taglines && Array.isArray(item.Taglines) && item.Taglines.length > 0) {
                    taglineEl.textContent = item.Taglines[0]; // Show first tagline
                } else if (item.Overview) {
                    taglineEl.textContent = item.Overview;
                }
            }
            
            // Buttons container
            const buttonsContainer = document.createElement('div');
            buttonsContainer.className = 'spotlight-buttons-container';
            
            // Play button (material icon span button)
            const playButton = document.createElement('button');
            playButton.className = 'spotlight-play-button emby-button';
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
            watchlistButton.className = 'spotlight-watchlist-button emby-button';
            
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
            infoButton.className = 'spotlight-info-button emby-button';
            const infoIcon = document.createElement('span');
            infoIcon.className = 'material-icons';
            infoIcon.textContent = 'info';
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
                ratingContainer.className = 'spotlight-rating-container';
                
                const starIcon = document.createElement('span');
                starIcon.className = 'material-icons spotlight-rating-star';
                starIcon.textContent = 'star';
                
                const ratingValue = document.createElement('span');
                ratingValue.className = 'spotlight-rating-value';
                if (rating && typeof rating === 'number') {
                    ratingValue.textContent = rating.toFixed(1);
                } else {
                    ratingValue.textContent = 'N/A';
                    ratingValue.classList.add('na');
                }
                
                ratingContainer.appendChild(starIcon);
                ratingContainer.appendChild(ratingValue);
                buttonsContainer.appendChild(ratingContainer);
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
                    metadataContainer.appendChild(combinedContainer);
                    metadataContainer.appendChild(emptyWriterContainer);
                } else {
                    if (directorContainer) {
                        metadataContainer.appendChild(directorContainer);
                    }

                    if (writerContainer) {
                        metadataContainer.appendChild(writerContainer);
                        if (!directorContainer) {
                            metadataContainer.appendChild(emptyDirectorContainer);
                        }
                    } else {
                        if (!directorContainer) {
                            metadataContainer.appendChild(emptyDirectorContainer);
                        }
                        metadataContainer.appendChild(emptyWriterContainer);
                    }
                }
            }
            if (metadataContainer.children.length > 0) {
                overlay.appendChild(metadataContainer);
            }
            if (taglineEl) {
                overlay.appendChild(taglineEl);
            }
            overlay.appendChild(buttonsContainer);
            
            itemDiv.appendChild(overlay);
            
            // ClearArt image (bottom right corner, if enabled and available)
            if (showClearArt && item.ImageTags?.Art) {
                const clearArtUrl = `${serverAddress}/Items/${item.Id}/Images/Art?fillHeight=300&quality=96&tag=${item.ImageTags.Art}`;
                const clearArtEl = document.createElement('img');
                clearArtEl.className = 'spotlight-clearart';
                clearArtEl.src = clearArtUrl;
                clearArtEl.alt = item.Name || 'Unknown';
                itemDiv.appendChild(clearArtEl);
            }
            
            // Click to navigate (but not on buttons)
            infoButton.addEventListener('click', (e) => {
                window.location.href = `${serverAddress}/web/#/details?id=${item.Id}&serverId=${serverId}`;
            });
            
            itemsContainer.appendChild(itemDiv);
        });
        
        bannerContainer.appendChild(itemsContainer);
        
        // Navigation buttons (top right)
        if (showNavButtons && items.length > 1) {
            const navContainer = document.createElement('div');
            navContainer.className = 'spotlight-nav-container';
            
            const prevButton = document.createElement('button');
            prevButton.className = 'spotlight-nav-button spotlight-nav-prev emby-button';
            const prevIcon = document.createElement('span');
            prevIcon.className = 'material-icons';
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
            nextIcon.className = 'material-icons';
            nextIcon.textContent = 'chevron_right';
            nextButton.appendChild(nextIcon);
            nextButton.addEventListener('click', (e) => {
                e.stopPropagation();
                // Reset timer when manually navigating
                goToItem((currentIndex + 1) % items.length, true);
            });
            
            navContainer.appendChild(prevButton);
            navContainer.appendChild(nextButton);
            bannerContainer.appendChild(navContainer);
        }
        
        // Pause button (bottom right)
        if (autoPlay && items.length > 1) {
            const navContainer = bannerContainer.querySelector('.spotlight-nav-container');
            const pauseButton = document.createElement('button');
            pauseButton.className = 'spotlight-pause-button spotlight-nav-button emby-button';
            const pauseIcon = document.createElement('span');
            pauseIcon.className = 'material-icons';
            pauseIcon.textContent = 'pause';
            pauseButton.appendChild(pauseIcon);
            pauseButton.addEventListener('click', (e) => {
                e.stopPropagation();
                isPaused = !isPaused;
                if (isPaused) {
                    clearInterval(autoPlayTimer);
                    pauseIcon.textContent = 'play_arrow';
                } else {
                    startAutoPlay();
                    pauseIcon.textContent = 'pause';
                }
            });
            navContainer.insertBefore(pauseButton, navContainer.firstChild);
        }
        
        // Dot indicators
        if (showDots && items.length > 1) {
            const dotsContainer = document.createElement('div');
            dotsContainer.className = 'spotlight-dots';
            
            items.forEach((_, index) => {
                const dot = document.createElement('button');
                dot.className = 'spotlight-dot' + (index === 0 ? ' active' : '');
                dot.setAttribute('data-index', index);
                dot.addEventListener('click', (e) => {
                    e.stopPropagation();
                    // Reset timer when manually navigating
                    goToItem(index, true);
                });
                dotsContainer.appendChild(dot);
            });
            
            bannerContainer.appendChild(dotsContainer);
        }
        
        // Go to item function (fade transition)
        function goToItem(index, resetTimer = true) {
            if (index === currentIndex) return;
            
            const currentItem = bannerContainer.querySelector(`.spotlight-item[data-index="${currentIndex}"]`);
            const nextItem = bannerContainer.querySelector(`.spotlight-item[data-index="${index}"]`);
            
            if (currentItem && nextItem) {
                currentItem.style.opacity = '0';
                nextItem.style.opacity = '1';
            }
            
            currentIndex = index;
            
            // Update dots
            if (showDots) {
                const dots = bannerContainer.querySelectorAll('.spotlight-dot');
                dots.forEach((dot, i) => {
                    if (i === index) {
                        dot.classList.add('active');
                    } else {
                        dot.classList.remove('active');
                    }
                });
            }
            
            // Reset auto-play timer when manually navigating (always reset delay)
            if (resetTimer && autoPlay && !isPaused) {
                clearInterval(autoPlayTimer);
                autoPlayTimer = null;
                startAutoPlay();
            }
        }
        
        // Auto-play function
        function startAutoPlay() {
            // Always clear any existing timer first
            if (autoPlayTimer) {
                clearInterval(autoPlayTimer);
                autoPlayTimer = null;
            }
            
            if (!autoPlay || items.length <= 1 || isPaused) return;
            
            autoPlayTimer = setInterval(() => {
                // Don't reset timer when auto-advancing (to maintain interval)
                goToItem((currentIndex + 1) % items.length, false);
            }, interval);
        }
        
        // Pause on hover - prevent auto-cycling when hovering
        let isHovering = false;
        bannerContainer.addEventListener('mouseenter', () => {
            isHovering = true;
            if (autoPlayTimer) {
                clearInterval(autoPlayTimer);
                autoPlayTimer = null;
            }
        });
        
        bannerContainer.addEventListener('mouseleave', () => {
            isHovering = false;
            // Only restart if auto-play is enabled, not paused, and not hovering
            if (autoPlay && !isPaused && !isHovering) {
                startAutoPlay();
            }
        });
        
        // Start auto-play
        if (autoPlay) {
            startAutoPlay();
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
        
        return container;
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
        showAllButton.textContent = 'Expand';
        showAllButton.title = 'Show all items';

        // Create scroller container
        const scroller = document.createElement('div');
        scroller.setAttribute('is', 'emby-scroller');
        scroller.setAttribute('data-horizontal', 'true');
        scroller.setAttribute('data-centerfocus', 'card');
        scroller.className = 'padded-top-focusscale padded-bottom-focusscale emby-scroller custom-scroller';
        scroller.setAttribute('data-scroll-mode-x', 'custom');
		// Enable smooth native horizontal touch scrolling (no snapping, no buttons)
		scroller.style.scrollSnapType = 'none';
		// Allow both axes so vertical page scroll isn't blocked when gesture starts over the scroller
		scroller.style.touchAction = 'auto';
		// Keep horizontal scroll self-contained but allow vertical to bubble to page
		scroller.style.overscrollBehaviorX = 'contain';
		scroller.style.overscrollBehaviorY = 'auto';
		// iOS inertia scrolling
		scroller.style.webkitOverflowScrolling = 'touch';

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
                showAllButton.textContent = 'Expand';
                showAllButton.title = 'Show all items in a grid layout';
                isShowingAll = false;
            } else {
                // Switch to grid view
                itemsContainer.style.cssText = 'display: flex; flex-wrap: wrap; gap: 12px; white-space: normal; transform: none !important; transition: none !important;';
                if (scrollButtons) scrollButtons.style.display = 'none';
                showAllButton.textContent = 'Collapse';
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
    
    console.log('[KefinTweaks CardBuilder] Module loaded and available at window.cardBuilder');
})();
