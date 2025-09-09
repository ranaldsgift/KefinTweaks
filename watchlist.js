// Jellyfin Watchlist Enhancement Script
// Adds watchlist functionality throughout Jellyfin interface
// Requires: cardBuilder.js module to be loaded before this script

(function() {
    'use strict';
    
    // Common logging function
    const LOG = (...args) => console.log('[Watchlist]', ...args);
    const WARN = (...args) => console.warn('[Watchlist]', ...args);
    const ERR = (...args) => console.error('[Watchlist]', ...args);
    
    LOG('Script loaded - JS Injector mode');

/************ Helpers ************/

function formatPremiereDate(dateStr) {
	if (!dateStr) return "";
	return new Date(dateStr).toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" });
}

function setCardData(items, options) {
	// Stub function for compatibility
}

function buildCard(index, item, apiClient, options) {
	// Check if cardBuilder is available
	if (typeof window.cardBuilder !== 'undefined' && window.cardBuilder.buildCard) {
		// Use cardBuilder to create a proper Jellyfin card
		const cardElement = window.cardBuilder.buildCard(item);
		cardElement.setAttribute('data-index', index);
		cardElement.classList.add('discover-card');
		
		// Convert DOM element to HTML string
		return cardElement.outerHTML;
	} else {
		// Fallback to simple card if cardBuilder is not available
		WARN("cardBuilder not available, using fallback card creation");
		return buildFallbackCard(index, item, apiClient, options);
	}
}

function buildFallbackCard(index, item, apiClient, options) {
	var serverUrl = apiClient.serverAddress();
	var imgUrl = serverUrl + "/Items/" + item.Id + "/Images/Primary?maxWidth=200&tag=" + item.PrimaryImageTag;
	var itemUrl = getItemDetailUrl(item);
        
	var html = '';
            html += '<div class="card overflowPortraitCard card-hoverable card-withuserdata discover-card" data-index="' + index + '">';
            html += '   <div class="cardBox cardBox-bottompadded">';
            html += '       <div class="cardScalable discoverCard-' + item.SourceType + '">';
            html += '           <div class="cardPadder cardPadder-overflowPortrait lazy-hidden-children"></div>';
            html += '           <canvas aria-hidden="true" width="20" height="20" class="blurhash-canvas lazy-hidden"></canvas>';
            html += '           <a href="' + itemUrl + '" class="cardImageContainer coveredImage cardContent itemAction lazy blurhashed lazy-image-fadein-fast" aria-label="" style="background-image: url(' + imgUrl + ');"></a>';
            html += '           <div class="cardOverlayContainer itemAction" data-action="link">';
            html += '               <div class="cardOverlayButton-br flex">';
            html += '                   <button is="discover-requestbutton" type="button" data-action="none" class="discover-requestbutton cardOverlayButton cardOverlayButton-hover itemAction paper-icon-button-light emby-button" data-id="' + item.id + '" data-media-type="' + item.SourceType + '">';
            html += '                       <span class="material-icons cardOverlayButtonIcon cardOverlayButtonIcon-hover add" aria-hidden="true"></span>';
            html += '                   </button>';
            html += '               </div>';
            html += '           </div>';
            html += '       </div>';
            html += '       <div class="cardText cardTextCentered cardText-first">';
            html += '           <bdi>';
            html += '               <a target="_blank" href="' + item.id + '/' + item.SourceType + '/' + item.id + '" class="itemAction textActionButton" title="' + item.Name + '" data-action="link">' + item.Name + '</a>';
            html += '           </bdi>';
            html += '       </div>';
            html += '       <div class="cardText cardTextCentered cardText-secondary">';
            html += '           <bdi>';

            var date = new Date(item.PremiereDate);
            
            html += '               <a target="_blank" href="' + item.id + '/' + item.SourceType + '/' + item.id + '" class="itemAction textActionButton" title="' + date.getFullYear() + '" data-action="link">' + date.getFullYear() + '</a>';
            html += '           </bdi>';
            html += '       </div>';
            html += '   </div>';
            html += '</div>';
        
        return html;
}

async function toggleFavorite(itemId, btn) {
	const apiClient = window.ApiClient;
	const userId = apiClient.getCurrentUserId();
	const serverUrl = apiClient.serverAddress();
	const token = apiClient.accessToken();

	const isFav = btn.textContent === "♡";
	try {
		await fetch(`${serverUrl}/Users/${userId}/FavoriteItems/${itemId}?IsFavorite=${isFav}`, {
			method: "POST",
			headers: { "Authorization": `MediaBrowser Token=\"${token}\"` }
		});
		btn.textContent = isFav ? "♥" : "♡";
	} catch (err) {
		ERR("Favorite toggle failed", err);
	}
}

function buildCardsHtmlInternal(items, options) {
	setCardData(items, options);
	let html = "";
	let itemsInRow = 0;
	let currentIndexValue;
	let hasOpenRow = false;
	let hasOpenSection = false;
	const sectionTitleTagName = options.sectionTitleTagName || "div";
	const apiClient = window.ApiClient;
	let lastServerId;

	for (const [i, item] of items.entries()) {
		const serverId = item.ServerId || options.serverId;
		if (serverId !== lastServerId) lastServerId = serverId;
		
		let newIndexValue = "";
		if (options.indexBy === "PremiereDate") {
			newIndexValue = formatPremiereDate(item.PremiereDate);
		} else if (options.indexBy === "ProductionYear") {
			newIndexValue = item.ProductionYear;
		} else if (options.indexBy === "CommunityRating") {
			const rounded = item.CommunityRating % 1 >= 0.5 ? 0.5 : 0;
			newIndexValue = item.CommunityRating ? (Math.floor(item.CommunityRating) + rounded) + "+" : "";
		}

		// Handle section changes
		if (newIndexValue !== currentIndexValue) {
			
			// Close previous row and section if open
			if (hasOpenRow) { 
				html += "</div>"; 
				hasOpenRow = false; 
				itemsInRow = 0; 
			}
			if (hasOpenSection) { 
				html += "</div>"; 
				hasOpenSection = false; 
			}
			
			// Start new section (always horizontal)
			html += "<div class=\"horizontalSection\">";
			html += `<${sectionTitleTagName} class="sectionTitle">${newIndexValue}</${sectionTitleTagName}>`;
			
			currentIndexValue = newIndexValue;
			hasOpenSection = true;
		}

		// Handle row creation for multi-row layouts
		if (options.rows && itemsInRow === 0) { 
			html += "<div class=\"cardColumn\">"; 
			hasOpenRow = true; 
		}

		// Build the card with direct linking
		html += buildCard(i, item, apiClient, options);
		itemsInRow++;

		// Close row if we've reached the row limit
		if (options.rows && itemsInRow >= options.rows) { 
			html += "</div>"; 
			hasOpenRow = false; 
			itemsInRow = 0; 
		}
	}

	// Close any remaining open elements
	if (hasOpenRow) html += "</div>";
	if (hasOpenSection) html += "</div>";
	
	return html;
}

function buildCardWithLink(index, item, apiClient, options) {
	// Generate the URL for the item detail page
	const itemUrl = getItemDetailUrl(item);
	
	// Build the original card content
	const cardContent = buildCard(index, item, apiClient, options);
	
	// Wrap the card in a clickable link
	return `<a href="${itemUrl}" class="card-link" style="text-decoration: none; color: inherit;">${cardContent}</a>`;
}

function getItemDetailUrl(item) {
	// Construct the URL to the item's detail page
	// Adjust this based on your Jellyfin setup and routing
	const baseUrl = window.location.origin;
	const serverId = item.ServerId;
	
	// Standard Jellyfin item detail URL format
	return `${baseUrl}/web/#/details?id=${item.Id}&serverId=${serverId}`;
}

async function fetchLikedItems(type) {
	const apiClient = window.ApiClient;
	const userId = apiClient.getCurrentUserId();
	const serverUrl = apiClient.serverAddress();
	const token = apiClient.accessToken();

	const url = `${serverUrl}/Items?Filters=Likes&IncludeItemTypes=${type}&UserId=${userId}&Recursive=true`;

	try {
		const res = await fetch(url, { headers: { "Authorization": `MediaBrowser Token=\"${token}\"` } });
		const data = await res.json();
		return data.Items || [];
	} catch (err) {
		ERR("Failed to fetch liked items for type:", type, err);
		return [];
	}
}

async function renderCards(containerSelector, type) {
	const container = document.querySelector(containerSelector);
	if (!container) {
		WARN("Container not found:", containerSelector);
		return { type, itemCount: 0 };
	}
	const items = await fetchLikedItems(type);
	
	// Hide section if no items
	if (!items || items.length === 0) {
		container.style.display = 'none';
		return { type, itemCount: 0 };
	}
	
	// Show section and create proper Jellyfin section structure
	container.style.display = '';
	const sectionHtml = createWatchlistSection(type, items);
	container.innerHTML = sectionHtml;
	return { type, itemCount: items.length };
}

function createWatchlistSection(type, items) {
	// This function assumes items array is not empty (checked at higher level)
	
	// Create the main vertical section container
	const verticalSection = document.createElement('div');
	verticalSection.className = 'verticalSection emby-scroller-container';

	// Create section title
	const sectionTitle = document.createElement('h2');
	sectionTitle.className = 'sectionTitle sectionTitle-cards focuscontainer-x padded-left padded-right';
	sectionTitle.textContent = getTypeDisplayName(type);

	// Create scroll buttons container
	const scrollButtons = document.createElement('div');
	scrollButtons.setAttribute('is', 'emby-scrollbuttons');
	scrollButtons.className = 'emby-scrollbuttons padded-right';

	// Previous button
	const prevButton = document.createElement('button');
	prevButton.type = 'button';
	prevButton.setAttribute('is', 'paper-icon-button-light');
	prevButton.setAttribute('data-ripple', 'false');
	prevButton.setAttribute('data-direction', 'left');
	prevButton.title = 'Previous';
	prevButton.className = 'emby-scrollbuttons-button paper-icon-button-light';
	prevButton.disabled = true;

	const prevIcon = document.createElement('span');
	prevIcon.className = 'material-icons chevron_left';
	prevIcon.setAttribute('aria-hidden', 'true');
	prevButton.appendChild(prevIcon);

	// Next button
	const nextButton = document.createElement('button');
	nextButton.type = 'button';
	nextButton.setAttribute('is', 'paper-icon-button-light');
	nextButton.setAttribute('data-ripple', 'false');
	nextButton.setAttribute('data-direction', 'right');
	nextButton.title = 'Next';
	nextButton.className = 'emby-scrollbuttons-button paper-icon-button-light';

	const nextIcon = document.createElement('span');
	nextIcon.className = 'material-icons chevron_right';
	nextIcon.setAttribute('aria-hidden', 'true');
	nextButton.appendChild(nextIcon);

	scrollButtons.appendChild(prevButton);
	scrollButtons.appendChild(nextButton);

	// Create scroller container
	const scroller = document.createElement('div');
	scroller.setAttribute('is', 'emby-scroller');
	scroller.setAttribute('data-horizontal', 'true');
	scroller.setAttribute('data-centerfocus', 'card');
	scroller.className = 'padded-top-focusscale padded-bottom-focusscale emby-scroller';
	scroller.setAttribute('data-scroll-mode-x', 'custom');
	scroller.style.overflow = 'hidden';

	// Create items container
	const itemsContainer = document.createElement('div');
	itemsContainer.setAttribute('is', 'emby-itemscontainer');
	itemsContainer.className = 'focuscontainer-x itemsContainer scrollSlider animatedScrollX';
	itemsContainer.style.whiteSpace = 'nowrap';
	itemsContainer.style.willChange = 'transform';
	itemsContainer.style.transition = 'transform 270ms ease-out';
	itemsContainer.style.transform = 'translateX(0px)';

	// Add items to container using cardBuilder
	items.forEach((item, index) => {
		if (typeof window.cardBuilder !== 'undefined' && window.cardBuilder.buildCard) {
			const card = window.cardBuilder.buildCard(item);
			card.setAttribute('data-index', index);
			card.classList.add('discover-card');
			itemsContainer.appendChild(card);
		} else {
			// Fallback to HTML string
			const cardHtml = buildFallbackCard(index, item, window.ApiClient, {});
			const tempDiv = document.createElement('div');
			tempDiv.innerHTML = cardHtml;
			itemsContainer.appendChild(tempDiv.firstElementChild);
		}
	});

	scroller.appendChild(itemsContainer);

	// Add scroll functionality
	let scrollPosition = 0;
	const cardWidth = 212; // 200px card + 12px gap
	const visibleCards = Math.floor(scroller.offsetWidth / cardWidth);
	const scrollStep = Math.max(1, Math.floor(visibleCards * 0.9));
	const maxScroll = Math.max(0, items.length - visibleCards);

	const updateScrollButtons = () => {
		prevButton.disabled = scrollPosition <= 0;
		nextButton.disabled = scrollPosition >= maxScroll;
	};

	const scrollTo = (position, smooth = true) => {
		scrollPosition = Math.max(0, Math.min(position, maxScroll));
		
		if (smooth) {
			itemsContainer.style.transition = 'transform 500ms cubic-bezier(0.25, 0.46, 0.45, 0.94)';
		} else {
			itemsContainer.style.transition = 'none';
		}
		
		itemsContainer.style.transform = `translateX(-${scrollPosition * cardWidth}px)`;
		updateScrollButtons();
		
		if (smooth) {
			setTimeout(() => {
				itemsContainer.style.transition = 'transform 270ms ease-out';
			}, 500);
		}
	};

	prevButton.addEventListener('click', () => {
		const newPosition = Math.max(0, scrollPosition - scrollStep);
		scrollTo(newPosition, true);
	});
	
	nextButton.addEventListener('click', () => {
		const newPosition = Math.min(maxScroll, scrollPosition + scrollStep);
		scrollTo(newPosition, true);
	});

	// Initial state
	updateScrollButtons();

	// Assemble the section
	verticalSection.appendChild(sectionTitle);
	verticalSection.appendChild(scrollButtons);
	verticalSection.appendChild(scroller);

	return verticalSection.outerHTML;
}

function getTypeDisplayName(itemType) {
	const typeMap = {
		'Movie': 'Movies',
		'Series': 'TV Shows',
		'Episode': 'Episodes',
		'Person': 'People',
		'MusicAlbum': 'Albums',
		'Audio': 'Songs',
		'Artist': 'Artists',
		'Playlist': 'Playlists',
		'Book': 'Books',
		'AudioBook': 'Audiobooks',
		'Photo': 'Photos',
		'PhotoAlbum': 'Photo Albums',
		'TvChannel': 'TV Channels',
		'LiveTvProgram': 'Live TV',
		'BoxSet': 'Collections'
	};
	return typeMap[itemType] || itemType;
}

/************ Watchlist Section Observer ************/

// Function to render watchlist content when .sections.watchlist is found
async function renderWatchlistContent() {
    try {
        const results = await Promise.all([
            renderCards(".sections.watchlist > .watchlist-movies", "Movie"),
            renderCards(".sections.watchlist > .watchlist-series", "Series"),
            renderCards(".sections.watchlist > .watchlist-episodes", "Episode")
        ]);
        
        // Check if all sections are empty
        const totalItems = results.reduce((sum, result) => sum + result.itemCount, 0);
        
        if (totalItems === 0) {
            // Show empty state message
            showEmptyWatchlistMessage();
        } else {
            // Hide empty state message if it exists
            hideEmptyWatchlistMessage();
        }
    } catch (err) {
        ERR('Error rendering watchlist cards:', err);
    }
}

// Function to check if watchlist section exists and render content
function checkAndRenderWatchlist() {
    const watchlistSection = document.querySelector('.sections.watchlist');
    if (watchlistSection && !watchlistSection.dataset.watchlistRendered) {
        watchlistSection.dataset.watchlistRendered = 'true';
        renderWatchlistContent();
    }
}

// Set up observer to watch for .sections.watchlist element
function setupWatchlistSectionObserver() {
    // Check immediately in case the element already exists
    checkAndRenderWatchlist();
    
    // Set up MutationObserver to watch for .sections.watchlist
    const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
            if (mutation.type === 'childList') {
                mutation.addedNodes.forEach((node) => {
                    if (node.nodeType === Node.ELEMENT_NODE) {
                        // Check if the added node is the watchlist section
                        if (node.classList && node.classList.contains('sections') && node.classList.contains('watchlist')) {
                            checkAndRenderWatchlist();
                        }
                        
                        // Check for watchlist section within the added node
                        const watchlistSection = node.querySelector && node.querySelector('.sections.watchlist');
                        if (watchlistSection) {
                            checkAndRenderWatchlist();
                        }
                    }
                });
            }
        });
    });
    
    // Start observing
    observer.observe(document.body, {
        childList: true,
        subtree: true
    });
}

// Initialize the watchlist section observer
setupWatchlistSectionObserver();

function showEmptyWatchlistMessage() {
    // Check if message already exists
    let emptyMessage = document.querySelector('.watchlist-empty-message');
    if (emptyMessage) {
        emptyMessage.style.display = 'block';
        return;
    }
    
    // Create empty state message
    emptyMessage = document.createElement('div');
    emptyMessage.className = 'watchlist-empty-message';
    emptyMessage.style.cssText = `
        text-align: center;
        padding: 40px 20px;
        color: #999;
        font-size: 16px;
        line-height: 1.5;
    `;
    
    emptyMessage.innerHTML = `
        <div style="margin-bottom: 20px;">
            <span class="material-icons" style="font-size: 48px; color: #666;">bookmark_border</span>
        </div>
        <h3 style="color: #fff; margin-bottom: 16px; font-size: 20px;">Your Watchlist is Empty</h3>
        <p style="margin: 0; max-width: 400px; margin-left: auto; margin-right: auto;">
            Press the <span class="material-icons" style="font-size: 18px; vertical-align: middle; color: #00a4dc;">bookmark_border</span> 
            button to add an item to your Watchlist
        </p>
    `;
    
    // Find the watchlist container and add the message
    const watchlistContainer = document.querySelector('.sections.watchlist');
    if (watchlistContainer) {
        watchlistContainer.appendChild(emptyMessage);
    } else {
        // Fallback to body if watchlist container not found
        document.body.appendChild(emptyMessage);
    }
}

function hideEmptyWatchlistMessage() {
    const emptyMessage = document.querySelector('.watchlist-empty-message');
    if (emptyMessage) {
        emptyMessage.style.display = 'none';
    }
}

LOG('Watchlist functionality initialized');

/************ Watchlist Button Observer ************/

// Function to add watchlist button to a card overlay container
function addWatchlistButton(overlayContainer) {
	// Check if watchlist button already exists
	if (overlayContainer && overlayContainer.querySelector('.watchlist-button')) {
		return;
	}
	
	// Find the card parent to get the item ID
	const card = overlayContainer.closest('.card');
	if (!card) {
		WARN('Could not find card parent for overlay container');
		return;
	}
	
	const itemId = card.getAttribute('data-id');
	if (!itemId) {
		WARN('Could not find data-id on card element');
		return;
	}
	
	// Find the .cardOverlayButton-br container
	const buttonContainer = overlayContainer.querySelector('.cardOverlayButton-br');
	if (!buttonContainer) {
		WARN('Could not find .cardOverlayButton-br container');
		return;
	}
	
	// Create watchlist button
	const watchlistButton = document.createElement('button');
	watchlistButton.type = 'button';
	watchlistButton.className = 'watchlist-button cardOverlayButton cardOverlayButton-hover itemAction paper-icon-button-light emby-button';
	watchlistButton.setAttribute('data-action', 'none');
	watchlistButton.setAttribute('data-id', itemId);
	watchlistButton.setAttribute('data-active', 'false');
	watchlistButton.title = 'Add to Watchlist';
	
	// Create the bookmark icon
	const watchlistIcon = document.createElement('span');
	watchlistIcon.className = 'material-icons cardOverlayButtonIcon cardOverlayButtonIcon-hover';
	watchlistIcon.textContent = 'bookmark_border';
	watchlistIcon.setAttribute('aria-hidden', 'true');
	
	watchlistButton.appendChild(watchlistIcon);
	
	// Add click event listener
	watchlistButton.addEventListener('click', (e) => {
		e.preventDefault();
		e.stopPropagation();
		
		// Toggle watchlist status
		const newRating = watchlistButton.dataset.active === 'false' ? 'true' : 'false';
		ApiClient.updateUserItemRating(ApiClient.getCurrentUserId(), itemId, newRating);
		watchlistButton.dataset.active = newRating;
		
		// Update icon and title based on state
		const isActive = watchlistButton.dataset.active === 'true';
		watchlistIcon.textContent = isActive ? 'bookmark' : 'bookmark_border';
		watchlistButton.title = isActive ? 'Remove from Watchlist' : 'Add to Watchlist';
	});
	
	// Check item's current watchlist status and set initial state
	ApiClient.getItem(ApiClient.getCurrentUserId(), itemId).then((item) => {
		if (item.UserData && item.UserData.Likes) {
			watchlistButton.dataset.active = 'true';
			watchlistIcon.textContent = 'bookmark';
			watchlistButton.title = 'Remove from Watchlist';
		}
	}).catch(err => {
		ERR('Error fetching item data for watchlist button:', err);
	});
	
	// Add the watchlist button to the button container
	buttonContainer.appendChild(watchlistButton);
}

// Function to process all existing overlay containers
function processExistingOverlayContainers() {
	const overlayContainers = document.querySelectorAll('.cardOverlayContainer');
	
	overlayContainers.forEach((overlayContainer) => {
		const buttonContainer = overlayContainer.querySelector('.cardOverlayButton-br');
		if (buttonContainer) {
			addWatchlistButton(overlayContainer);
		}
	});
}

// Set up MutationObserver to watch for new overlay containers
function setupWatchlistButtonObserver() {
	const observer = new MutationObserver((mutations) => {
		mutations.forEach((mutation) => {
			if (mutation.type === 'childList') {
				// Check for added nodes
				mutation.addedNodes.forEach((node) => {
					if (node.nodeType === Node.ELEMENT_NODE) {
						// Check if the added node is an overlay container
						if (node.classList && node.classList.contains('cardOverlayContainer')) {
							const buttonContainer = node.querySelector('.cardOverlayButton-br');
							if (buttonContainer) {
								addWatchlistButton(node);
							}
						}
						
						// Check for overlay containers within the added node
						const overlayContainers = node.querySelectorAll && node.querySelectorAll('.cardOverlayContainer');
						if (overlayContainers && overlayContainers.length > 0) {
							overlayContainers.forEach((overlayContainer) => {
								const buttonContainer = overlayContainer.querySelector('.cardOverlayButton-br');
								if (buttonContainer) {
									addWatchlistButton(overlayContainer);
								}
							});
						}
					}
				});
			}
		});
	});
	
	// Start observing
	observer.observe(document.body, {
		childList: true,
		subtree: true
	});
	
	// Process any existing overlay containers
	processExistingOverlayContainers();
}

// Initialize the observer
setupWatchlistButtonObserver();

/************ Item Detail Page Observer ************/

// Function to add watchlist button to item detail page
function addDetailPageWatchlistButton() {
	const trailerButton = document.querySelector('.itemDetailPage:not(.hide) .btnPlayTrailer');
	
	if (!trailerButton) {
		return;
	}
	
	// Check if watchlist button already exists
	const existingButton = document.querySelector('.itemDetailPage:not(.hide) .watchlist-icon');
	if (existingButton) {
		return;
	}
	
	const watchlistIcon = document.createElement('button');
	watchlistIcon.setAttribute("is", "emby-button");
	watchlistIcon.className = 'watchlist-icon detailButton emby-button hide';	
	watchlistIcon.title = "Add to Watchlist";
	watchlistIcon.dataset.active = 'false';
	
	// Get item ID from URL
	const itemId = window.location.href.substring(window.location.href.indexOf("id=") + 3, window.location.href.indexOf("id=") + 35);
	
	watchlistIcon.addEventListener('click', () => {
		const newRating = watchlistIcon.dataset.active === 'false' ? 'true' : 'false';
		ApiClient.updateUserItemRating(ApiClient.getCurrentUserId(), itemId, newRating);
		watchlistIcon.dataset.active = newRating;
		
		// Update title based on state
		const isActive = watchlistIcon.dataset.active === 'true';
		watchlistIcon.title = isActive ? 'Remove from Watchlist' : 'Add to Watchlist';
	});	
	
	// Get item data to check if it should be shown and current state
	ApiClient.getItem(ApiClient.getCurrentUserId(), itemId).then((item) => {
		// Only show for Movies, Series, Seasons, and Episodes
		if (item.Type !== "Movie" && item.Type !== "Series" && item.Type !== "Season" && item.Type !== "Episode") {
			watchlistIcon.style.display = "none";
			return;
		}
		
		// Set initial state based on current watchlist status
		if (item.UserData && item.UserData.Likes) {
			watchlistIcon.dataset.active = 'true';
			watchlistIcon.title = 'Remove from Watchlist';
		}
	}).catch(err => {
		ERR('Error fetching item data:', err);
	});
	
	// Add button after trailer button
	trailerButton.after(watchlistIcon);
	
	// Set up observer to show button when other buttons become visible
	const target = document.querySelector('.mainDetailButtons');
	if (target) {
		const observer = new MutationObserver(mutations => {
			mutations.forEach(mutation => {
				if (mutation.type === "attributes" &&
					mutation.attributeName === "class" &&
					mutation.target.classList.contains("emby-button") &&
					!mutation.target.classList.contains("watchlist-icon") &&
					!mutation.target.classList.contains("hide")) {

					if (watchlistIcon && watchlistIcon.classList.contains("hide")) {
						watchlistIcon.classList.remove('hide');
						observer.disconnect(); 
					}
				}
			});
		});

		observer.observe(target, {
			attributes: true,
			subtree: true,
			attributeFilter: ["class"]
		});
	}
}

// Function to monitor item detail pages
function monitorItemDetailPage() {
	const observer = new MutationObserver(() => {
		const visibleItemDetailPage = document.querySelector('.itemDetailPage:not(.hide)');
		if (!visibleItemDetailPage) {
			return;
		}
		
		// Check if watchlist button already exists
		const existingButton = document.querySelector('.itemDetailPage:not(.hide) .watchlist-icon');
		if (existingButton) {
			return;
		}
		
		addDetailPageWatchlistButton();
	});

	// Start observing the entire document body
	observer.observe(document.body, {
		childList: true,
		subtree: true,
		attributes: true,
		attributeFilter: ['class']
	});
}

// Initialize the item detail page observer
monitorItemDetailPage();

    // Debug functions for troubleshooting (available in console)
    window.debugWatchlistButtons = function() {
        LOG('Manual debug trigger called');
        LOG('Current overlay containers:', document.querySelectorAll('.cardOverlayContainer').length);
        LOG('Current watchlist buttons:', document.querySelectorAll('.watchlist-button').length);
        processExistingOverlayContainers();
    };

    window.debugWatchlistRendering = function() {
        LOG('Manual watchlist rendering trigger called');
        checkAndRenderWatchlist();
    };

    window.debugDetailPageWatchlist = function() {
        LOG('Manual detail page watchlist trigger called');
        addDetailPageWatchlistButton();
    };

    LOG('Debug functions available: window.debugWatchlistButtons(), window.debugWatchlistRendering(), window.debugDetailPageWatchlist()');
})();