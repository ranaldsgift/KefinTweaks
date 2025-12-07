// Jellyfin Watchlist Script
// Adds watchlist functionality throughout Jellyfin interface
// Requires: cardBuilder.js, localStorageCache.js, modal.js, utils.js modules to be loaded before this script
// Requirement #2: Custom Tabs plugin
/* 
In the Custom Tabs plugin, add a new tab with the following HTML content:

<div class="sections watchlist">
</div>
*/

(function() {
    'use strict';
    
    // Common logging function
    const LOG = (...args) => console.log('[KefinTweaks Watchlist]', ...args);
    const WARN = (...args) => console.warn('[KefinTweaks Watchlist]', ...args);
    const ERR = (...args) => console.error('[KefinTweaks Watchlist]', ...args);
    
    LOG('Initializing...');
	
	// Initialize localStorage cache manager
	const localStorageCache = new window.LocalStorageCache();
	
	const WATCHLIST_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

	// Playback monitoring for watchlist cleanup
	let playbackMonitorInitialized = false;

	// Store watchlist tab index
	let _watchlistTabIndex = null;

	// Data optimization functions for localStorage storage
	function optimizeProgressDataForStorage(progressDataArray) {
		return progressDataArray.map(progress => ({
			// Series info (minimal)
			series: {
				Id: progress.series.Id,
				Name: progress.series.Name,
				ImageTags: progress.series.ImageTags,
				Status: progress.series.Status,
				ProductionYear: progress.series.ProductionYear
			},
			
			// Progress metrics (pre-calculated statistics only)
			watchedCount: progress.watchedCount,
			totalEpisodes: progress.totalEpisodes,
			remainingCount: progress.remainingCount,
			percentage: progress.percentage,
			totalRuntime: progress.totalRuntime,
			watchedRuntime: progress.watchedRuntime,
			remainingRuntime: progress.remainingRuntime,
			
			// Last watched episode (minimal)
			lastWatchedEpisode: progress.lastWatchedEpisode ? {
				Id: progress.lastWatchedEpisode.Id,
				Name: progress.lastWatchedEpisode.Name,
				IndexNumber: progress.lastWatchedEpisode.IndexNumber,
				ParentIndexNumber: progress.lastWatchedEpisode.ParentIndexNumber,
				UserData: progress.lastWatchedEpisode.UserData,
				ImageTags: progress.lastWatchedEpisode.ImageTags
			} : null,
			
			// Binary progress data for instant rendering (compact storage)
			binaryProgress: progress.binaryProgress || {}
			
			// Episodes array completely removed - will be fetched on-demand
		}));
	}

	function optimizeMovieDataForStorage(movieDataArray) {		
		// Return optimized movie data
		return movieDataArray.map(movie => ({
			Id: movie.Id,
			Name: movie.Name,
			BackdropImageTags: movie.BackdropImageTags,
			ImageTags: movie.ImageTags,
			PremiereDate: movie.PremiereDate,
			RunTimeTicks: movie.RunTimeTicks,
			ProductionYear: movie.ProductionYear,
			UserData: {
				IsFavorite: movie.UserData.IsFavorite,
				LastPlayedDate: movie.UserData.LastPlayedDate,
				PlayCount: movie.UserData.PlayCount,
				Played: movie.UserData.Played
			}
		}));
	}

	// Optimize watchlist data for localStorage storage
	function optimizeWatchlistDataForStorage(watchlistDataArray) {
		return watchlistDataArray.map(item => ({
			Id: item.Id,
			Type: item.Type,
			MediaType: item.MediaType,
			Name: item.Name,
			SeriesId: item.SeriesId,
			SeriesName: item.SeriesName,
			SeriesPrimaryImageTag: item.SeriesPrimaryImageTag,
			ParentBackdropItemId: item.ParentBackdropItemId,
			ParentBackdropImageTags: item.ParentBackdropImageTags,
			ParentThumbImageTag: item.ParentPrimaryImageTags,
			IndexNumber: item.IndexNumber,
			ParentIndexNumber: item.ParentIndexNumber,
			ImageTags: item.ImageTags,
			BackdropImageTags: item.BackdropImageTags,
			PremiereDate: item.PremiereDate,
			ProductionYear: item.ProductionYear,
			UserData: {
				IsFavorite: item.UserData.IsFavorite,
				Played: item.UserData.Played,
				LastPlayedDate: item.UserData.LastPlayedDate,
				PlayCount: item.UserData.PlayCount
			}
		}));
	}

	// Add refresh button to tab headers
	function addRefreshButtons() {
		const watchlistSection = getWatchlistSection();
		if (!watchlistSection) return;

		// Progress tab refresh button and sort button
		const progressStats = watchlistSection.querySelector('.progress-header-stats-container');
		if (progressStats) {
			const refreshBtn = createRefreshButton('progress', 'Series Progress');
			
			// Add sort button next to refresh button
			const sortBtn = createSortButton();
			progressStats.appendChild(sortBtn);
			progressStats.appendChild(refreshBtn);
		}

		// History tab refresh button  
		const historyStats = watchlistSection.querySelector('.movie-history-stats-container');
		if (historyStats) {
			// Add sort button first
			const sortBtn = createMovieSortButton();
			historyStats.appendChild(sortBtn);
			
			const refreshBtn = createRefreshButton('movies', 'Movie History');
			historyStats.appendChild(refreshBtn);
		}

		// Watchlist tab refresh button
		const watchlistHeaderRight = watchlistSection.querySelector('.watchlist-header-right');
		if (watchlistHeaderRight) {
			const importExportBtn = createImportExportButton();
			watchlistHeaderRight.appendChild(importExportBtn);
			const refreshBtn = createRefreshButton('watchlist', 'Watchlist');
			watchlistHeaderRight.appendChild(refreshBtn);
		}
	}

	// Create a refresh button element
	function createRefreshButton(cacheName, label) {
		const refreshBtn = document.createElement('button');
		refreshBtn.className = 'paper-icon-button-light emby-button ';
		refreshBtn.innerHTML = '<span class="material-icons refresh"></span>';
		refreshBtn.title = `Refresh ${label} data from server`;
		
		refreshBtn.onclick = async () => {
			refreshBtn.disabled = true;
			refreshBtn.innerHTML = '<span class="material-icons refresh"></span>';
			
			try {
				// Clear localStorage cache
				if (cacheName === 'progress') {
					localStorageCache.clear(`progress`);
					// Clear in-memory cache
					progressCache.data = [];
					progressCache.allDataLoaded = false;
					progressCache.totalPages = 0;
					tabStates.progress.isDataFetched = false;
				} else if (cacheName === 'movies') {
					localStorageCache.clear(`movies`);
					// Clear in-memory cache
					movieCache.data = [];
					movieCache.allDataLoaded = false;
					movieCache.totalPages = 0;
					tabStates.history.isDataFetched = false;
				} else if (cacheName === 'watchlist') {					
					// Clear all watchlist sections
					const sections = ['movies', 'series', 'seasons', 'episodes'];
					sections.forEach(section => {
						localStorageCache.clear(`watchlist_${section}`);
						watchlistCache[section].data = [];
					});
				}
				
				// Re-fetch data
				if (cacheName === 'progress') {
					await initProgressTab();
				} else if (cacheName === 'movies') {
					await initHistoryTab();
				} else if (cacheName === 'watchlist') {
					await initWatchlistTab();
				}
				
				// Show success feedback with checkmark
				refreshBtn.innerHTML = '<span class="material-icons check"></span>';
				setTimeout(() => {
					refreshBtn.innerHTML = '<span class="material-icons refresh"></span>';
					refreshBtn.disabled = false;
				}, 2000);
				
			} catch (error) {
				ERR('Failed to refresh cache:', error);
				refreshBtn.innerHTML = '<span class="material-icons error"></span>';
				setTimeout(() => {
					refreshBtn.innerHTML = '<span class="material-icons refresh"></span>';
					refreshBtn.disabled = false;
				}, 3000);
			}
		};
		
		return refreshBtn;
	}

	// Create import/export button element
	function createImportExportButton() {
		const btn = document.createElement('button');
		btn.className = 'layout-toggle-btn';
		btn.innerHTML = '<span class="material-icons import_export"></span>';
		btn.title = 'Import/Export Watchlist';
		
		btn.onclick = () => {
			showImportExportModal();
		};
		
		return btn;
	}

	// Create sort button element
	function createSortButton() {
		const sortBtn = document.createElement('button');
		sortBtn.className = 'sort-button';
		sortBtn.id = 'progress-sort-btn';
		
		// Get current sort order
		const currentSort = getCurrentSortOrder();
		const currentLabel = SORT_OPTIONS[currentSort]?.label || 'Last Watched';
		
		sortBtn.innerHTML = `
			<span class="material-icons sort"></span>
			<span class="sort-label">${currentLabel}</span>
			<span class="material-icons arrow_drop_down"></span>
		`;
		sortBtn.title = 'Sort series by different criteria';
		
		sortBtn.onclick = (e) => {
			e.preventDefault();
			e.stopPropagation();
			showSortModal();
		};
		
		// Update the label with direction indicator after creation
		updateSortButtonLabel(currentSort);
		
		return sortBtn;
	}

	// Create movie sort button element
	function createMovieSortButton() {
		const sortBtn = document.createElement('button');
		sortBtn.className = 'sort-button';
		sortBtn.id = 'movie-sort-btn';
		
		// Get current sort order
		const currentSort = getCurrentMovieSortOrder();
		const currentLabel = MOVIE_SORT_OPTIONS[currentSort]?.label || 'Last Watched';
		
		sortBtn.innerHTML = `
			<span class="material-icons sort"></span>
			<span class="sort-label">${currentLabel}</span>
			<span class="material-icons arrow_drop_down"></span>
		`;
		sortBtn.title = 'Sort movies by different criteria';
		
		sortBtn.onclick = (e) => {
			e.preventDefault();
			e.stopPropagation();
			showMovieSortModal();
		};
		
		// Update the label with direction indicator after creation
		updateMovieSortButtonLabel(currentSort);
		
		return sortBtn;
	}

	// Show sort options modal
	function showSortModal() {
		// Create modal content
		const sortOptionsContent = `
			<h2 style="margin: 0 0 .5em;">Sort By</h2>
			<div>
				${Object.entries(SORT_OPTIONS).map(([key, option]) => `
					<label class="radio-label-block mdl-radio mdl-js-radio mdl-js-ripple-effect show-focus">
						<input type="radio" is="emby-radio" name="sortOption" data-id="${key}" value="${key}" class="menuSortBy mdl-radio__button" data-radio="true" ${option.default ? 'checked=""' : ''}>
						<div class="mdl-radio__circles">
							<svg>
								<defs>
									<clipPath id="cutoff-${key}">
										<circle cx="50%" cy="50%" r="50%"></circle>
									</clipPath>
								</defs>
								<circle class="mdl-radio__outer-circle" cx="50%" cy="50%" r="50%" fill="none" stroke="currentcolor" stroke-width="0.26em" clip-path="url(#cutoff-${key})"></circle>
								<circle class="mdl-radio__inner-circle" cx="50%" cy="50%" r="25%" fill="currentcolor"></circle>
							</svg>
							<div class="mdl-radio__focus-circle"></div>
						</div>
						<span class="radioButtonLabel mdl-radio__label">${option.label}</span>
					</label>
				`).join('')}
			</div>
			<h2 style="margin: 1em 0 .5em;">Sort Order</h2>
			<div>
				<label class="radio-label-block mdl-radio mdl-js-radio mdl-js-ripple-effect show-focus">
					<input type="radio" is="emby-radio" name="sortDirection" value="asc" class="menuSortOrder mdl-radio__button" data-radio="true">
					<div class="mdl-radio__circles">
						<svg>
							<defs>
								<clipPath id="cutoff-asc">
									<circle cx="50%" cy="50%" r="50%"></circle>
								</clipPath>
							</defs>
							<circle class="mdl-radio__outer-circle" cx="50%" cy="50%" r="50%" fill="none" stroke="currentcolor" stroke-width="0.26em" clip-path="url(#cutoff-asc)"></circle>
							<circle class="mdl-radio__inner-circle" cx="50%" cy="50%" r="25%" fill="currentcolor"></circle>
						</svg>
						<div class="mdl-radio__focus-circle"></div>
					</div>
					<span class="radioButtonLabel mdl-radio__label">Ascending</span>
				</label>
				<label class="radio-label-block mdl-radio mdl-js-radio mdl-js-ripple-effect show-focus">
					<input type="radio" is="emby-radio" name="sortDirection" value="desc" class="menuSortOrder mdl-radio__button" checked="" data-radio="true">
					<div class="mdl-radio__circles">
						<svg>
							<defs>
								<clipPath id="cutoff-desc">
									<circle cx="50%" cy="50%" r="50%"></circle>
								</clipPath>
							</defs>
							<circle class="mdl-radio__outer-circle" cx="50%" cy="50%" r="50%" fill="none" stroke="currentcolor" stroke-width="0.26em" clip-path="url(#cutoff-desc)"></circle>
							<circle class="mdl-radio__inner-circle" cx="50%" cy="50%" r="25%" fill="currentcolor"></circle>
						</svg>
						<div class="mdl-radio__focus-circle"></div>
					</div>
					<span class="radioButtonLabel mdl-radio__label">Descending</span>
				</label>
			</div>
		`;

		// Create modal using the generic modal system
		const modal = window.ModalSystem.create({
			id: 'sort-modal',
			content: sortOptionsContent,
			onOpen: (modalInstance) => {
				// Set current selection
				const currentSort = getCurrentSortOrder();
				const currentDirection = getCurrentSortDirection();
				const currentRadio = modalInstance.dialog.querySelector(`input[value="${currentSort}"]`);
				const currentDirectionRadio = modalInstance.dialog.querySelector(`input[value="${currentDirection}"]`);
				if (currentRadio) {
					currentRadio.checked = true;
				}
				if (currentDirectionRadio) {
					currentDirectionRadio.checked = true;
				}

				// Add event listeners for radio button changes
				const sortOptions = modalInstance.dialog.querySelectorAll('input[name="sortOption"]');
				const sortDirections = modalInstance.dialog.querySelectorAll('input[name="sortDirection"]');
				
				// Apply changes immediately when radio buttons change
				const applyChanges = () => {
					const selectedOption = modalInstance.dialog.querySelector('input[name="sortOption"]:checked');
					const selectedDirection = modalInstance.dialog.querySelector('input[name="sortDirection"]:checked');
					if (selectedOption) {
						const direction = selectedDirection ? selectedDirection.value : 'desc';
						setSortOrder(selectedOption.value, direction);
						updateSortButtonLabel(selectedOption.value, direction);
					}
				};
				
				sortOptions.forEach(option => {
					option.addEventListener('change', applyChanges);
				});
				
				sortDirections.forEach(direction => {
					direction.addEventListener('change', applyChanges);
				});
			}
		});
	}

	// Update sort button label
	function updateSortButtonLabel(sortKey, direction = null) {
		const watchlistSection = getWatchlistSection();
		if (!watchlistSection) return;
		
		const sortBtn = watchlistSection.querySelector('#progress-sort-btn');
		if (sortBtn) {
			const currentDirection = direction || getCurrentSortDirection();
			const directionText = currentDirection === 'asc' ? '↑' : '↓';
			const label = SORT_OPTIONS[sortKey]?.label || 'Last Watched';
			const labelSpan = sortBtn.querySelector('.sort-label');
			if (labelSpan) {
				labelSpan.textContent = `${label} ${directionText}`;
			}
		}
	}

	// Show movie sort options modal
	function showMovieSortModal() {
		// Create modal content
		const movieSortOptionsContent = `
			<h2 style="margin: 0 0 .5em;">Sort By</h2>
			<div>
				${Object.entries(MOVIE_SORT_OPTIONS).map(([key, option]) => `
					<label class="radio-label-block mdl-radio mdl-js-radio mdl-js-ripple-effect show-focus">
						<input type="radio" is="emby-radio" name="movieSortOption" data-id="${key}" value="${key}" class="menuSortBy mdl-radio__button" data-radio="true" ${option.default ? 'checked=""' : ''}>
						<div class="mdl-radio__circles">
							<svg>
								<defs>
									<clipPath id="cutoff-movie-${key}">
										<circle cx="50%" cy="50%" r="50%"></circle>
									</clipPath>
								</defs>
								<circle class="mdl-radio__outer-circle" cx="50%" cy="50%" r="50%" fill="none" stroke="currentcolor" stroke-width="0.26em" clip-path="url(#cutoff-movie-${key})"></circle>
								<circle class="mdl-radio__inner-circle" cx="50%" cy="50%" r="25%" fill="currentcolor"></circle>
							</svg>
							<div class="mdl-radio__focus-circle"></div>
						</div>
						<span class="radioButtonLabel mdl-radio__label">${option.label}</span>
					</label>
				`).join('')}
			</div>
			<h2 style="margin: 1em 0 .5em;">Sort Order</h2>
			<div>
				<label class="radio-label-block mdl-radio mdl-js-radio mdl-js-ripple-effect show-focus">
					<input type="radio" is="emby-radio" name="movieSortDirection" value="asc" class="menuSortOrder mdl-radio__button" data-radio="true">
					<div class="mdl-radio__circles">
						<svg>
							<defs>
								<clipPath id="cutoff-movie-asc">
									<circle cx="50%" cy="50%" r="50%"></circle>
								</clipPath>
							</defs>
							<circle class="mdl-radio__outer-circle" cx="50%" cy="50%" r="50%" fill="none" stroke="currentcolor" stroke-width="0.26em" clip-path="url(#cutoff-movie-asc)"></circle>
							<circle class="mdl-radio__inner-circle" cx="50%" cy="50%" r="25%" fill="currentcolor"></circle>
						</svg>
						<div class="mdl-radio__focus-circle"></div>
					</div>
					<span class="radioButtonLabel mdl-radio__label">Ascending</span>
				</label>
				<label class="radio-label-block mdl-radio mdl-js-radio mdl-js-ripple-effect show-focus">
					<input type="radio" is="emby-radio" name="movieSortDirection" value="desc" class="menuSortOrder mdl-radio__button" checked="" data-radio="true">
					<div class="mdl-radio__circles">
						<svg>
							<defs>
								<clipPath id="cutoff-movie-desc">
									<circle cx="50%" cy="50%" r="50%"></circle>
								</clipPath>
							</defs>
							<circle class="mdl-radio__outer-circle" cx="50%" cy="50%" r="50%" fill="none" stroke="currentcolor" stroke-width="0.26em" clip-path="url(#cutoff-movie-desc)"></circle>
							<circle class="mdl-radio__inner-circle" cx="50%" cy="50%" r="25%" fill="currentcolor"></circle>
						</svg>
						<div class="mdl-radio__focus-circle"></div>
					</div>
					<span class="radioButtonLabel mdl-radio__label">Descending</span>
				</label>
			</div>
		`;

		// Create modal using the generic modal system
		const modal = window.ModalSystem.create({
			id: 'movie-sort-modal',
			content: movieSortOptionsContent,
			onOpen: (modalInstance) => {
				// Set current selection
				const currentSort = getCurrentMovieSortOrder();
				const currentDirection = getCurrentMovieSortDirection();
				const currentRadio = modalInstance.dialog.querySelector(`input[value="${currentSort}"]`);
				const currentDirectionRadio = modalInstance.dialog.querySelector(`input[value="${currentDirection}"]`);
				if (currentRadio) {
					currentRadio.checked = true;
				}
				if (currentDirectionRadio) {
					currentDirectionRadio.checked = true;
				}

				// Add event listeners for radio button changes
				const sortOptions = modalInstance.dialog.querySelectorAll('input[name="movieSortOption"]');
				const sortDirections = modalInstance.dialog.querySelectorAll('input[name="movieSortDirection"]');
				
				// Apply changes immediately when radio buttons change
				const applyChanges = () => {
					const selectedOption = modalInstance.dialog.querySelector('input[name="movieSortOption"]:checked');
					const selectedDirection = modalInstance.dialog.querySelector('input[name="movieSortDirection"]:checked');
					if (selectedOption) {
						const direction = selectedDirection ? selectedDirection.value : 'desc';
						setMovieSortOrder(selectedOption.value, direction);
						updateMovieSortButtonLabel(selectedOption.value, direction);
						renderHistoryContent();
					}
				};
				
				sortOptions.forEach(option => {
					option.addEventListener('change', applyChanges);
				});
				
				sortDirections.forEach(direction => {
					direction.addEventListener('change', applyChanges);
				});
			}
		});
	}

	// Update movie sort button label
	function updateMovieSortButtonLabel(sortKey, direction = null) {
		const watchlistSection = getWatchlistSection();
		if (!watchlistSection) return;
		
		const sortBtn = watchlistSection.querySelector('#movie-sort-btn');
		if (sortBtn) {
			const currentDirection = direction || getCurrentMovieSortDirection();
			const directionText = currentDirection === 'asc' ? '↑' : '↓';
			const label = MOVIE_SORT_OPTIONS[sortKey]?.label || 'Last Watched';
			const labelSpan = sortBtn.querySelector('.sort-label');
			if (labelSpan) {
				labelSpan.textContent = `${label} ${directionText}`;
			}
		}
	}

	// Function to update the last watched display
	function updateLastWatched(lastWatchedElement, episodeInfo) {
		if (!lastWatchedElement || !episodeInfo) return;
		
		const timeAgo = formatTimeAgo(new Date().toISOString());
		const formattedDate = formatLastWatchedDate(new Date().toISOString());
		const episodeInfoText = `${episodeInfo.season}x${episodeInfo.episode.toString().padStart(2, '0')} "${episodeInfo.title}"`;
		lastWatchedElement.innerHTML = `Last watched <strong>${episodeInfoText}</strong> ${timeAgo} on ${formattedDate}.`;
	}

	// Function to update last watched display after removing an episode from watched
	async function updateLastWatchedAfterRemoval(seriesId) {
		const cachedProgress = getCachedSeriesProgress(seriesId);
		if (!cachedProgress || !cachedProgress.episodes) {
			return;
		}

		const progressCard = document.querySelector(`[data-series-id="${seriesId}"]`)?.closest('.progress-card');
		if (!progressCard) return;

		const lastWatchedElement = progressCard.querySelector('.progress-last-watched');
		if (!lastWatchedElement) return;

		// Find the most recently watched episode from the cache
		const watchedEpisodes = cachedProgress.episodes.filter(ep => 
			ep.UserData && ep.UserData.Played === true && ep.UserData.LastPlayedDate
		);

		if (watchedEpisodes.length > 0) {
			// Sort by LastPlayedDate and get the most recent
			const lastWatched = watchedEpisodes.sort((a, b) => 
				new Date(b.UserData.LastPlayedDate) - new Date(a.UserData.LastPlayedDate)
			)[0];

			const episodeInfo = {
				title: lastWatched.Name,
				season: lastWatched.ParentIndexNumber || 0,
				episode: lastWatched.IndexNumber || 0
			};
			updateLastWatched(lastWatchedElement, episodeInfo);
		} else {
			// No more watched episodes, clear the display
			lastWatchedElement.innerHTML = '';
		}
	}

	// Helper function to fetch episode by series ID, season, and episode number
	async function fetchEpisode(seriesId, season, episode) {
		if (!seriesId || !season || !episode) {
			throw new Error('Missing required information: seriesId, season, or episode');
		}

		LOG(`Fetching episode ID: series ${seriesId}, season ${season}, episode ${episode}`);
		const episodes = await fetchEpisodesForSeries(seriesId);
		
		if (!episodes || episodes.length === 0) {
			throw new Error(`No episodes found for series ${seriesId}`);
		}

		// Find the episode that matches the season and episode number
		const matchingEpisode = episodes.find(ep => {
			const start = ep.IndexNumber;
			const end = ep.IndexNumberEnd || ep.IndexNumber;
			return ep.ParentIndexNumber === parseInt(season) && 
			       parseInt(episode) >= start && 
			       parseInt(episode) <= end;
		});

		if (matchingEpisode) {
			LOG(`Found episode ID: ${matchingEpisode.Id} for season ${season}, episode ${episode}`);
			return matchingEpisode;
		} else {
			throw new Error(`Could not find episode for series ${seriesId}, season ${season}, episode ${episode}`);
		}
	}

	// Show episode watched confirmation modal
	function showEpisodeWatchedConfirmation(episodeId, element, episodeInfo = null, seriesId = null, isWatched = false) {
		// Note: If episodeId is missing, it will be fetched when the confirm button is clicked
		// using the seriesId, season, and episode information from episodeInfo

		// Create modal content based on watched status
		const episodeTitle = episodeInfo ? episodeInfo.title : 'Episode Title';
		const episodeDetails = episodeInfo ? `Season ${episodeInfo.season}, Episode ${episodeInfo.episode}` : 'Season X, Episode Y';
		const message = isWatched 
			? 'Are you sure you want to remove this episode from watched?'
			: 'Are you sure you want to mark this episode as watched?';
		const confirmButtonText = isWatched ? 'Remove from Watched' : 'Mark as Watched';
		const confirmButtonIcon = isWatched ? 'remove_circle' : 'check';
		
		const confirmationContent = `
			<div class="confirmation-body">
				<div class="episode-info">
					<div class="episode-title">${episodeTitle}</div>
					<div class="episode-details">${episodeDetails}</div>
				</div>
				<div class="confirmation-message">
					${message}
				</div>
			</div>
			<div class="confirmation-actions">
				<button class="view-episode-btn" id="view-episode-btn">
					<span class="material-icons info"></span>
					Go To Episode
				</button>
				<button class="confirm-btn" id="confirm-episode-action">
					<span class="material-icons ${confirmButtonIcon}"></span>
					${confirmButtonText}
				</button>
				<button class="cancel-btn" id="cancel-episode-action">
					<span class="material-icons close"></span>
					Cancel
				</button>
			</div>
		`;

		// Create modal using the generic modal system
		const modal = window.ModalSystem.create({
			id: 'episode-confirmation-modal',
			title: isWatched ? 'Remove Episode from Watched' : 'Mark Episode as Watched',
			content: confirmationContent,
			onOpen: (modalInstance) => {
				// Store the episode ID, element, and watched status for the confirmation
				modalInstance.dialog.dataset.episodeId = episodeId || '';
				modalInstance.dialog.dataset.elementType = element.classList.contains('progress-chunk') ? 'chunk' : 'button';
				modalInstance.dialog.dataset.seriesId = (episodeInfo && episodeInfo.seriesId) || seriesId || '';
				modalInstance.dialog.dataset.isWatched = isWatched;
				
				// Store season/episode for binary mode
				if (episodeInfo) {
					modalInstance.dialog.dataset.season = episodeInfo.season || '';
					modalInstance.dialog.dataset.episode = episodeInfo.episode || '';
				}

				// Add event listeners
				const confirmBtn = modalInstance.dialog.querySelector('#confirm-episode-action');
				const cancelBtn = modalInstance.dialog.querySelector('#cancel-episode-action');
				const viewEpisodeBtn = modalInstance.dialog.querySelector('#view-episode-btn');
				
				viewEpisodeBtn.onclick = async () => {
					// Navigate to the episode's item page
					let episodeId = modalInstance.dialog.dataset.episodeId;
					const seriesId = modalInstance.dialog.dataset.seriesId;
					const season = modalInstance.dialog.dataset.season;
					const episode = modalInstance.dialog.dataset.episode;
					
					// If episodeId is missing, fetch it using seriesId, season, and episode
					if (!episodeId) {
						try {
							const item = await fetchEpisode(seriesId, season, episode);
							if (item) {
								episodeId = item.Id;
								modalInstance.dialog.dataset.episodeId = episodeId;
							}
						} catch (err) {
							WARN('Cannot navigate to episode:', err.message);
							window.ModalSystem.close('episode-confirmation-modal');
							return;
						}
					}
					
					if (episodeId) {
						Dashboard.navigate(`#/details?id=${episodeId}`);
					}

					window.ModalSystem.close('episode-confirmation-modal');
				};
				
				confirmBtn.onclick = async () => {
					let episodeId = modalInstance.dialog.dataset.episodeId;
					const elementType = modalInstance.dialog.dataset.elementType;
					const seriesId = modalInstance.dialog.dataset.seriesId;
					const season = modalInstance.dialog.dataset.season;
					const episode = modalInstance.dialog.dataset.episode;
					const isCurrentlyWatched = modalInstance.dialog.dataset.isWatched === 'true';
					
					// If episodeId is missing, fetch it using seriesId, season, and episode
					if (!episodeId) {
						try {
							const item = await fetchEpisode(seriesId, season, episode);
							if (item) {
								episodeId = item.Id;
								modalInstance.dialog.dataset.episodeId = episodeId;
							}
						} catch (err) {
							ERR(err.message);
							window.ModalSystem.close('episode-confirmation-modal');
							return;
						}
					}
					
					// Find the original element
					let element = null;
					if (elementType === 'chunk') {
						// Find progress bar by series ID, then find chunk by season/episode
						const progressBar = document.querySelector(`.progress-bar[data-series-id="${seriesId}"]`);
						if (progressBar) {
							const season = modalInstance.dialog.dataset.season;
							const episode = modalInstance.dialog.dataset.episode;
							element = progressBar.querySelector(`[data-season="${season}"][data-episode="${episode}"]`);
						}
					}
					
					if (!element) {
						element = document.querySelector(`[data-episode-id="${episodeId}"].episode-watched-toggle`);
					}
					
					// Reconstruct episodeInfo for updateLastWatched if needed
					const episodeInfoForUpdate = episodeInfo || {
						title: modalInstance.dialog.querySelector('.episode-title')?.textContent || 'Episode',
						season: parseInt(modalInstance.dialog.dataset.season),
						episode: parseInt(modalInstance.dialog.dataset.episode),
						seriesId: seriesId
					};
					
					if (isCurrentlyWatched) {
						// Remove from watched
						await toggleEpisodeWatchedStatus(episodeId, element, false);
						
						// Update last watched display
						await updateLastWatchedAfterRemoval(seriesId);
					} else {
						// Mark as watched
						await toggleEpisodeWatchedStatus(episodeId, element);
						
						// Update the .progress-last-watched element with the newly watched episode
						const progressCard = document.querySelector(`[data-series-id="${seriesId}"]`)?.closest('.progress-card');
						if (progressCard) {
							const lastWatchedElement = progressCard.querySelector('.progress-last-watched');
							updateLastWatched(lastWatchedElement, episodeInfoForUpdate);
						}
					}
					
					window.ModalSystem.close('episode-confirmation-modal');
				};
				
				cancelBtn.onclick = () => {
					window.ModalSystem.close('episode-confirmation-modal');
				};
			}
		});
	}

	// Function to update the unwatched episodes list, removing watched episodes
	async function updateUnwatchedEpisodesList(seriesId) {
		const progressCard = document.querySelector(`[data-series-id="${seriesId}"].progress-card`);
		if (!progressCard) return;

		const unwatchedEpisodesList = progressCard.querySelector('.unwatched-episodes-list');
		if (!unwatchedEpisodesList) return;

		// Check if there are any episode items rendered
		const episodeItems = unwatchedEpisodesList.querySelectorAll('.unwatched-episode-item');
		if (episodeItems.length === 0) return;

		// Get the updated cache to check which episodes are now watched
		const cachedProgress = getCachedSeriesProgress(seriesId);
		if (!cachedProgress || !cachedProgress.episodes) return;

		// Create a set of watched episode identifiers (season + episode number)
		const watchedEpisodes = new Set();
		cachedProgress.episodes.forEach(ep => {
			if (ep.UserData && ep.UserData.Played === true) {
				// For multi-part episodes, mark all parts as watched
				const expanded = expandMultiPartEpisodes(ep);
				expanded.forEach(expandedEp => {
					watchedEpisodes.add(`${expandedEp.ParentIndexNumber}_${expandedEp.expandedIndex}`);
				});
			}
		});

		// Remove any episode items that are now watched
		episodeItems.forEach(item => {
			const season = item.getAttribute('data-season');
			const episode = item.getAttribute('data-episode');
			const key = `${season}_${episode}`;

			if (watchedEpisodes.has(key)) {
				// Fade out and remove the item
				item.style.opacity = '0.5';
				item.style.transition = 'opacity 0.3s ease';
				
				setTimeout(() => {
					item.remove();
					
					// Check if no more episodes remain
					const remainingEpisodes = unwatchedEpisodesList.querySelectorAll('.unwatched-episode-item');
					if (remainingEpisodes.length === 0) {
						unwatchedEpisodesList.innerHTML = '<div class="unwatched-empty">No unwatched episodes found</div>';
					}
				}, 300);
			}
		});
	}

	// Show mark all episodes confirmation modal
	function showMarkAllEpisodesConfirmation(seriesId, buttonElement, seriesInfo) {
		// Create modal content
		const confirmationContent = `
			<div class="confirmation-body">
				<div class="series-info">
					<div class="series-title">${seriesInfo.name}</div>
					<div class="series-details">${seriesInfo.watchedCount} of ${seriesInfo.totalEpisodes} episodes watched (${seriesInfo.percentage}%)</div>
				</div>
				<div class="episode-count-info">
					<span class="episode-count">${seriesInfo.unwatchedCount}</span> unwatched episodes will be marked as watched
				</div>
				<div class="confirmation-message">
					Are you sure you want to mark all remaining episodes as watched?
				</div>
			</div>
			<div class="confirmation-actions">
				<button class="confirm-btn" id="confirm-mark-all-watched">
					<span class="material-icons check_circle"></span>
					Mark All as Watched
				</button>
				<button class="cancel-btn" id="cancel-mark-all-watched">
					<span class="material-icons close"></span>
					Cancel
				</button>
			</div>
		`;

		// Create modal using the generic modal system
		const modal = window.ModalSystem.create({
			id: 'mark-all-confirmation-modal',
			title: 'Mark All Episodes as Watched',
			content: confirmationContent,
			onOpen: (modalInstance) => {
				// Store the series ID and button for the confirmation
				modalInstance.dialog.dataset.seriesId = seriesId;
				modalInstance.dialog.dataset.buttonElement = 'true';

				// Add event listeners
				const confirmBtn = modalInstance.dialog.querySelector('#confirm-mark-all-watched');
				const cancelBtn = modalInstance.dialog.querySelector('#cancel-mark-all-watched');
				
				confirmBtn.onclick = async () => {
					const seriesId = modalInstance.dialog.dataset.seriesId;
					
					// Find the mark all button
					const markAllBtn = document.querySelector(`[data-series-id="${seriesId}"].mark-all-watched-btn`);
					if (confirmBtn) {
						await markAllEpisodesAsWatched(seriesId, confirmBtn);
					}
					
					window.ModalSystem.close('mark-all-confirmation-modal');
				};
				
				cancelBtn.onclick = () => {
					window.ModalSystem.close('mark-all-confirmation-modal');
				};
			}
		});
	}

	// Show all shows modal
	function showAllShowsModal() {
		// Get all progress data and sort it the same way as top 5
		const progressData = progressCache.data;
		const allShows = progressData
			.map(progress => ({
				name: progress.series.Name,
				episodesWatched: progress.watchedCount,
				totalEpisodes: progress.totalEpisodes,
				percentage: progress.percentage,
				seriesId: progress.series.Id
			}))
			.sort((a, b) => {
				// Primary sort: completion percentage (highest first)
				const percentageDiff = b.percentage - a.percentage;
				if (percentageDiff !== 0) {
					return percentageDiff;
				}
				// Tiebreaker: episode count (most episodes first)
				return b.totalEpisodes - a.totalEpisodes;
			});
		
		let showsHtml = '';
		if (allShows.length === 0) {
			showsHtml = '<div class="no-shows-message">No shows watched yet</div>';
		} else {
			showsHtml = allShows.map((show, index) => {
				const rank = index + 1;
				const episodesText = show.episodesWatched === 1 ? 'episode' : 'episodes';
				
				return `
					<div class="all-show-item">
						<div class="show-rank">${rank}</div>
						<div class="show-info">
							<div class="show-name">${show.name}</div>
							<div class="show-episodes">${show.episodesWatched} of ${show.totalEpisodes} ${episodesText} (${show.percentage}%)</div>
						</div>
					</div>
				`;
			}).join('');
		}
		
		// Create modal content
		const modalContent = `
			<div class="all-shows-list">
				${showsHtml}
			</div>
		`;
		
		// Create modal using the generic modal system
		window.ModalSystem.create({
			id: 'all-shows-modal',
			title: 'All Watched Shows',
			content: modalContent,
			onOpen: (modalInstance) => {
				// Modal is ready and content is populated
				LOG('All shows modal opened');
			}
		});
	}
    
	// Centralized selector function for visible library page
	function getVisibleLibraryPage() {
		return document.querySelector('.homePage:not(.hide)');
	}

	// Tab state tracking to avoid unnecessary re-rendering
	const tabStates = {
		progress: { currentPage: 1, currentSearch: '', currentSort: 'lastWatched', currentDirection: 'desc', hasContent: false, lastDataHash: '', isFetching: false, isDataFetched: false, isRendering: false },
		history: { currentPage: 1, currentSearch: '', currentSort: 'lastWatched', currentDirection: 'desc', hasContent: false, lastDataHash: '', isFetching: false, isDataFetched: false },
		watchlist: { currentPage: 1, currentSearch: '', hasContent: false, lastDataHash: '', isFetching: false, isDataFetched: false },
		statistics: { currentPage: 1, currentSearch: '', hasContent: false, lastDataHash: '', isFetching: false, isDataFetched: false }
	};

	// Check if we should skip rendering based on current state
	function shouldSkipRendering(tabName, currentPage, currentSearch, container, data) {
		const state = tabStates[tabName];
		const isSamePage = state.currentPage === currentPage;
		const isSameSearch = state.currentSearch === currentSearch;
		
		// For progress tab, also check if sort order or direction has changed
		let isSameSort = true;
		if (tabName === 'progress') {
			const currentSort = getCurrentSortOrder();
			const currentDirection = getCurrentSortDirection();
			isSameSort = state.currentSort === currentSort && state.currentDirection === currentDirection;
		} else if (tabName === 'history') {
			// For history tab, check if movie sort order or direction has changed
			const currentSort = getCurrentMovieSortOrder();
			const currentDirection = getCurrentMovieSortDirection();
			isSameSort = state.currentSort === currentSort && state.currentDirection === currentDirection;
		}

		const children = container.querySelectorAll(':scope > *:not(.loading-message)');
		
		// Check if container has the right number of children
		// TODO - Improve this to check if the children are the same as the data
		const hasCorrectContent = container && 
								children.length === data.length;
		
		// Skip if we have content and it's the same page/search/sort/data count
		return state.hasContent && isSamePage && isSameSearch && isSameSort && hasCorrectContent;
	}

	// Update tab state after successful render
	function updateTabState(tabName, currentPage, currentSearch) {
		const state = {
			currentPage,
			currentSearch,
			hasContent: true,
			lastDataHash: '', // No longer used
			isFetching: false,
			isDataFetched: true
		};
		
		// For progress tab, also track current sort order and direction
		if (tabName === 'progress') {
			state.currentSort = getCurrentSortOrder();
			state.currentDirection = getCurrentSortDirection();
		} else if (tabName === 'history') {
			// For history tab, track current movie sort order and direction
			state.currentSort = getCurrentMovieSortOrder();
			state.currentDirection = getCurrentMovieSortDirection();
		}
		
		tabStates[tabName] = state;
	}

	// Clear tab state when content is cleared
	function clearTabState(tabName) {
		tabStates[tabName].hasContent = false;
		tabStates[tabName].lastDataHash = '';
		tabStates[tabName].isDataFetched = false;
		tabStates[tabName].isFetching = false;
	}

	function getWatchlistSection() {
		const visibleWatchlistSections = document.querySelectorAll('.libraryPage:not(.hide) .sections.watchlist');

		if (!visibleWatchlistSections || visibleWatchlistSections.length === 0) {
			return null;
		}

		if (visibleWatchlistSections.length > 1) {
			return visibleWatchlistSections[visibleWatchlistSections.length - 1];
		}

		return visibleWatchlistSections[0];
	}
	
	// Safe element getter that targets the visible library page
	function getElementByIdSafe(elementId) {
		const libraryPage = getVisibleLibraryPage();
		return libraryPage ? libraryPage.querySelector(`#${elementId}`) : getElementByIdSafe(elementId);
	}
	
	// Add custom CSS for watchlist icon
	const style = document.createElement('style');
	style.textContent = `
		.material-icons.watchlist:before {
			content: "\\e866";
		}
		
		.loading-message {
			display: flex;
			flex-direction: column;
			align-items: center;
			justify-content: center;
			padding: 2rem;
			text-align: center;
			color: #888;
			grid-column: 1 / -1;
		}
		
		.loading-spinner {
			width: 32px;
			height: 32px;
			border: 3px solid #f3f3f3;
			border-top: 3px solid #3498db;
			border-radius: 50%;
			animation: spin 1s linear infinite;
			margin-bottom: 1rem;
		}
		
		@keyframes spin {
			0% { transform: rotate(0deg); }
			100% { transform: rotate(360deg); }
		}
	`;
	document.head.appendChild(style);
	LOG('Custom watchlist icon CSS added');

	/************ Progress Tab Functions ************/

	// Generic cache factory function
	function createGenericCache(pageSize = 20) {
		return {
			data: [],                    // Main data array
			filteredData: [],            // Filtered data array
			searchTerm: '',              // Current search term
			filteredPages: 0,            // Pages for filtered data
			totalPages: 0,               // Pages for all data
			pageSize,                    // Items per page
			allDataLoaded: false,        // Data loading state
			sorted: false,               // Data sorting state
			currentPage: 1               // Current page for this tab
		};
	}

	// Progress caching and pagination configuration
	const progressCache = createGenericCache(20);

	// Movie history caching and pagination configuration
	const movieCache = createGenericCache(20);

	// Cache management functions
	function isCacheValid() {
		return progressCache.data.length > 0 && progressCache.allDataLoaded;
	}


	// Search functionality
	function filterProgressDataBySearch(progressData, searchTerm) {
		if (!searchTerm || searchTerm.trim() === '') {
			return progressData;
		}
		
		const term = searchTerm.toLowerCase().trim();
		return progressData.filter(progress => 
			progress.series.Name.toLowerCase().includes(term)
		);
	}

	function updateSearchResults(searchTerm) {
		LOG(`updateSearchResults called with: "${searchTerm}"`);
		progressCache.searchTerm = searchTerm;
		
		// Filter the preloaded progress data using correct property name
		if (progressCache.allDataLoaded && progressCache.data.length > 0) {
			progressCache.filteredData = filterProgressDataBySearch(progressCache.data, searchTerm);
			progressCache.filteredPages = Math.ceil(progressCache.filteredData.length / progressCache.pageSize);
			LOG(`Progress search: ${progressCache.filteredData.length} results from ${progressCache.data.length} total`);
		} else {
			// Fallback - this shouldn't happen with new system, but handle gracefully
			progressCache.filteredData = [];
			progressCache.filteredPages = 0;
			WARN('Progress data not loaded yet, search will be empty');
		}
		
		LOG(`Search updated: "${searchTerm}" -> ${progressCache.filteredData.length} results, ${progressCache.filteredPages} pages`);
		
		// Update pagination immediately after search results change
		const params = getUrlParams();
		if (params.pageTab === 'progress') {
			const currentPage = params.page || 1;
			const totalPages = progressPagination.getCurrentTotalPages();
			
			// If current page exceeds total pages after filtering, reset to page 1
			if (currentPage > totalPages && totalPages > 0) {
				LOG(`Current page ${currentPage} exceeds total pages ${totalPages} after search, resetting to page 1`);
				updateUrlParams('progress', 1);
				// Update pagination controls with page 1
				renderPaginationControls(1, totalPages, 'progress');
			} else {
				// Update pagination controls with current page
				renderPaginationControls(currentPage, totalPages, 'progress');
			}
		}
	}

	// Movie search functionality
	function filterMoviesBySearch(movies, searchTerm) {
		if (!searchTerm || searchTerm.trim() === '') {
			return movies;
		}
		
		const term = searchTerm.toLowerCase().trim();
		return movies.filter(movie => {
			const title = (movie.Name || '').toLowerCase();
			const year = movie.ProductionYear || '';
			const genres = (movie.Genres || []).join(' ').toLowerCase();
			
			return title.includes(term) || 
				year.toString().includes(term) || 
				genres.includes(term);
		});
	}

	function updateMovieSearchResults(searchTerm) {
		LOG(`updateMovieSearchResults called with: "${searchTerm}"`);
		movieCache.searchTerm = searchTerm;
		
		// Filter the cached movie data
		if (movieCache.data.length > 0) {
			movieCache.filteredData = filterMoviesBySearch(movieCache.data, searchTerm);
			movieCache.filteredPages = Math.ceil(movieCache.filteredData.length / movieCache.pageSize);
			LOG(`Movie search: ${movieCache.filteredData.length} results from ${movieCache.data.length} total`);
			LOG(`Movie cache state: searchTerm="${movieCache.searchTerm}", filteredData.length=${movieCache.filteredData.length}, filteredPages=${movieCache.filteredPages}`);
		} else {
			WARN('No movie data available for search');
		}
		
		LOG(`Movie search updated: "${searchTerm}" -> ${movieCache.filteredData.length} results, ${movieCache.filteredPages} pages`);
		
		// Update pagination immediately after search results change
		const params = getUrlParams();
		if (params.pageTab === 'history') {
			const currentPage = params.page || 1;
			const totalPages = moviePagination.getCurrentTotalPages();
			
			// If current page exceeds total pages after filtering, reset to page 1
			if (currentPage > totalPages && totalPages > 0) {
				LOG(`Current page ${currentPage} exceeds total pages ${totalPages} after movie search, resetting to page 1`);
				updateUrlParams('history', 1);
				// Update pagination controls with page 1
				renderPaginationControls(1, totalPages, 'history');
			} else {
				// Update pagination controls with current page
				renderPaginationControls(currentPage, totalPages, 'history');
			}
		}
	}

	function getCurrentTotalPages() {
		// Use the new pagination system
		return progressPagination.getCurrentTotalPages();
	}

	// Individual series progress cache management
	function cacheSeriesProgress(seriesId, progressData) {
		// Find existing entry in data array
		const existingIndex = progressCache.data.findIndex(item => item.series.Id === seriesId);
		
		if (existingIndex !== -1) {
			// Update existing entry
			progressCache.data[existingIndex] = progressData;
		} else {
			// Add new entry
			progressCache.data.push(progressData);
		}
		
		LOG(`Cached progress data for series: ${progressData.series.Name}`);
	}

	function getCachedSeriesProgress(seriesId) {
		const cachedProgress = progressCache.data.find(item => 
			item && item.series && item.series.Id === seriesId
		);
		return cachedProgress || null;
	}

	// Helper function to get series ID from episode ID
	async function getSeriesIdFromEpisode(episodeId) {
		// Query API to get episode details and find series ID
		const apiClient = window.ApiClient;
		const userId = apiClient.getCurrentUserId();
		const serverUrl = apiClient.serverAddress();
		const token = apiClient.accessToken();
		
		try {
			const episodeUrl = `${serverUrl}/Items/${episodeId}?UserId=${userId}&Fields=ParentId`;
			const episodeRes = await fetch(episodeUrl, { headers: { "Authorization": `MediaBrowser Token=\"${token}\"` } });
			const episodeData = await episodeRes.json();
			
			// Get the series ID from the episode's parent (season) parent
			if (episodeData.ParentId) {
				const seasonUrl = `${serverUrl}/Items/${episodeData.ParentId}?UserId=${userId}&Fields=ParentId`;
				const seasonRes = await fetch(seasonUrl, { headers: { "Authorization": `MediaBrowser Token=\"${token}\"` } });
				const seasonData = await seasonRes.json();
				
				return seasonData.ParentId || null;
			}
			
			return null;
		} catch (err) {
			ERR(`Failed to get series ID for episode ${episodeId}:`, err);
			return null;
		}
	}

	// Helper function to recalculate series progress metrics
	function recalculateSeriesProgressMetrics(progressData) {
		// Only recalculate if we have episodes data in memory
		if (!progressData.episodes || !Array.isArray(progressData.episodes)) {
			LOG('No episodes data available for recalculation');
			return progressData;
		}
		
		const episodes = progressData.episodes;
		const today = new Date();
		today.setHours(23, 59, 59, 999);
		
		// Filter to aired episodes only
		const airedEpisodes = episodes.filter(ep => 
			ep.PremiereDate && new Date(ep.PremiereDate) <= today
		);
		
		// Expand multi-part episodes to get the actual total count
		const expandedForCount = [];
		airedEpisodes.forEach(episode => {
			expandedForCount.push(...expandMultiPartEpisodes(episode));
		});
		progressData.totalEpisodes = expandedForCount.length;
		
		// Count watched episodes - expand multi-part episodes and count all parts if watched
		const watchedEpisodes = airedEpisodes.filter(ep => 
			ep.UserData && ep.UserData.Played === true
		);
		const watchedExpanded = [];
		watchedEpisodes.forEach(episode => {
			watchedExpanded.push(...expandMultiPartEpisodes(episode));
		});
		progressData.watchedCount = watchedExpanded.length;
		progressData.remainingCount = progressData.totalEpisodes - progressData.watchedCount;
		progressData.percentage = progressData.totalEpisodes > 0 
			? Math.round((progressData.watchedCount / progressData.totalEpisodes) * 100) 
			: 0;
		
		// Update last watched episode
		const lastWatched = watchedEpisodes
			.sort((a, b) => new Date(b.UserData.LastPlayedDate || 0) - new Date(a.UserData.LastPlayedDate || 0))[0];
		progressData.lastWatchedEpisode = lastWatched ? {
			Id: lastWatched.Id,
			Name: lastWatched.Name,
			IndexNumber: lastWatched.IndexNumber,
			ParentIndexNumber: lastWatched.ParentIndexNumber,
			UserData: lastWatched.UserData,
			ImageTags: lastWatched.ImageTags
		} : null;
		
		LOG(`Recalculated metrics for series: ${progressData.series.Name} - ${progressData.watchedCount}/${progressData.totalEpisodes} (${progressData.percentage}%)`);
		return progressData;
	}

	// Main function to update episode watched status in cache
	async function updateEpisodeWatchedStatusInCache(seriesId, episodeId, isWatched = true) {
		let cachedProgress = getCachedSeriesProgress(seriesId);
		if (!cachedProgress) {
			LOG(`No cached progress found for series: ${seriesId}, fetching and adding to cache`);
			
			// Fetch series data from API
			const apiClient = window.ApiClient;
			const userId = apiClient.getCurrentUserId();
			const serverUrl = apiClient.serverAddress();
			const token = apiClient.accessToken();
			
			try {
				// Fetch the series item
				const seriesUrl = `${serverUrl}/Items/${seriesId}?UserId=${userId}&Fields=UserData,RecursiveItemCount&EnableImageTypes=Primary,Banner`;
				const seriesRes = await fetch(seriesUrl, { headers: { "Authorization": `MediaBrowser Token=\"${token}\"` } });
				const series = await seriesRes.json();
				
				if (!series || !series.Id) {
					LOG(`Failed to fetch series data for seriesId: ${seriesId}`);
					return false;
				}
				
				// Fetch and create progress data for this series
				cachedProgress = await fetchSeriesProgressWithMissingEpisodes(series, userId, serverUrl, token);
				
				if (!cachedProgress) {
					LOG(`Failed to create progress data for series: ${seriesId}`);
					return false;
				}
				
				LOG(`Successfully added series ${series.Name} to cache`);
			} catch (err) {
				ERR(`Failed to fetch and add series ${seriesId} to cache:`, err);
				return false;
			}
		}
		
		// Update episode data if available in memory
		if (cachedProgress.episodes) {
			const episode = cachedProgress.episodes.find(ep => ep.Id === episodeId);
			if (episode) {
				episode.UserData = episode.UserData || {};
				episode.UserData.Played = isWatched;
				episode.UserData.IsPlayed = isWatched;
				
				// Update LastPlayedDate based on watched status
				if (isWatched) {
					episode.UserData.LastPlayedDate = new Date().toISOString();
				} else {
					// Clear LastPlayedDate when unwatching
					episode.UserData.LastPlayedDate = null;
				}
				
				LOG(`Updated episode ${episodeId} watched status to ${isWatched} in memory cache`);
			}
		}
		
		// Recalculate statistics by actually counting watched episodes
		// This accounts for multi-part episodes and is more reliable than incrementing/decrementing
		if (Array.isArray(cachedProgress.episodes) && cachedProgress.episodes.length > 0) {
			// Expand multi-part episodes to get accurate counts
			const expandedEpisodes = [];
			cachedProgress.episodes.forEach(ep => {
				expandedEpisodes.push(...expandMultiPartEpisodes(ep));
			});
			
			// Count watched episodes by checking UserData.Played status
			const watchedCount = cachedProgress.episodes.filter(ep => 
				ep.UserData && ep.UserData.Played === true
			).reduce((count, ep) => count + expandMultiPartEpisodes(ep).length, 0);
			
			// Total is the count of all expanded episodes
			const totalEpisodes = expandedEpisodes.length;
			cachedProgress.watchedCount = watchedCount;
			cachedProgress.remainingCount = totalEpisodes - watchedCount;
			cachedProgress.totalEpisodes = totalEpisodes;
		}
		
		// Recalculate percentage
		cachedProgress.percentage = cachedProgress.totalEpisodes > 0 
			? Math.round((cachedProgress.watchedCount / cachedProgress.totalEpisodes) * 100) 
			: 0;
		
		// Regenerate binaryProgress from episodes if available
		if (Array.isArray(cachedProgress.episodes) && cachedProgress.episodes.length > 0) {
			cachedProgress.binaryProgress = generateBinaryProgressData(cachedProgress.episodes);
		}
		
		// Get the last watched episode based on the cachedProgress.episodes
		const lastWatchedEpisode = cachedProgress.episodes
			.filter(ep => ep.UserData && ep.UserData.LastPlayedDate)
			.sort((a, b) => new Date(b.UserData.LastPlayedDate) - new Date(a.UserData.LastPlayedDate))[0];

		if (lastWatchedEpisode) {
			cachedProgress.lastWatchedEpisode = lastWatchedEpisode;
		}
		
		// Update the cache
		cacheSeriesProgress(seriesId, cachedProgress);
		
		// Update localStorage to persist changes
		updateProgressDataInLocalStorage();
		
		LOG(`Updated episode ${episodeId} watched status to ${isWatched} in cache for series: ${cachedProgress.series.Name}`);
		return true;
	}

	// Helper function to update episode watched status in cache without localStorage update
	// Used for bulk operations to avoid multiple localStorage writes
	function updateEpisodeWatchedStatusInCacheWithoutLocalStorage(seriesId, episodeId, isWatched = true) {
		const cachedProgress = getCachedSeriesProgress(seriesId);
		if (!cachedProgress) {
			LOG(`No cached progress found for series: ${seriesId}`);
			return false;
		}
		
		// Find and update the specific episode
		const episode = cachedProgress.episodes.find(ep => ep.Id === episodeId);
		if (!episode) {
			LOG(`Episode ${episodeId} not found in cached progress for series: ${seriesId}`);
			return false;
		}
		
		// Update the episode's watched status
		episode.UserData = episode.UserData || {};
		episode.UserData.Played = isWatched;
		episode.UserData.IsPlayed = isWatched;
		
		// Update LastPlayedDate based on watched status
		if (isWatched) {
			episode.UserData.LastPlayedDate = new Date().toISOString();
		} else {
			// Clear LastPlayedDate when unwatching
			episode.UserData.LastPlayedDate = null;
		}
		
		// Recalculate series metrics
		recalculateSeriesProgressMetrics(cachedProgress);
		
		// Regenerate binaryProgress from episodes if available
		if (Array.isArray(cachedProgress.episodes) && cachedProgress.episodes.length > 0) {
			cachedProgress.binaryProgress = generateBinaryProgressData(cachedProgress.episodes);
		}
		
		// Update the cache (without localStorage)
		cacheSeriesProgress(seriesId, cachedProgress);
		
		LOG(`Updated episode ${episodeId} watched status to ${isWatched} in cache for series: ${cachedProgress.series.Name} (no localStorage update)`);
		return true;
	}

	// Function to update progress card UI after cache changes
	async function updateProgressCardUI(seriesId) {
		// Find the progress card for this series by looking for buttons with data-series-id
		const seriesButton = document.querySelector(`[data-series-id="${seriesId}"]`);
		if (!seriesButton) {
			LOG(`Progress card not found for series: ${seriesId}`);
			return;
		}
		
		// Find the parent progress card
		const progressCard = seriesButton.closest('.progress-card');
		if (!progressCard) {
			LOG(`Progress card container not found for series: ${seriesId}`);
			return;
		}
		
		// Get updated progress data
		const updatedProgress = getCachedSeriesProgress(seriesId);
		if (!updatedProgress) {
			LOG(`No updated progress data found for series: ${seriesId}`);
			return;
		}
		
		// Update chunked progress bar (preserve enhanced chunks if possible)
		await updateProgressBarInPlace(progressCard, updatedProgress);
		
		// Update percentage text
		const percentageText = progressCard.querySelector('.progress-percentage');
		if (percentageText) {
			percentageText.textContent = `${updatedProgress.percentage}%`;
		}
		
		// Update stats text
		const statsText = progressCard.querySelector('.progress-stats');
		if (statsText) {
			statsText.innerHTML = updatedProgress.percentage === 100 
				? `Watched <strong>${updatedProgress.watchedCount} of ${updatedProgress.totalEpisodes}</strong> episodes - <strong>Series Complete!</strong>`
				: `Watched <strong>${updatedProgress.watchedCount} of ${updatedProgress.totalEpisodes}</strong> episodes which leaves <strong>${updatedProgress.remainingCount} episodes</strong> left to watch.`;
		}
		
		// Update completion badge
		const completionBadge = progressCard.querySelector('.completion-badge');
		if (updatedProgress.percentage === 100) {
			if (!completionBadge) {
				const titleElement = progressCard.querySelector('.progress-title');
				if (titleElement) {
					const badge = document.createElement('span');
					badge.className = 'completion-badge';
					badge.textContent = '✓ Complete';
					titleElement.appendChild(badge);
				}
			}
		} else if (completionBadge) {
			completionBadge.remove();
		}
		
		// Update progress bar class for completed series
		const progressBarContainer = progressCard.querySelector('.progress-bar');
		if (progressBarContainer) {
			if (updatedProgress.percentage === 100) {
				progressBarContainer.classList.add('progress-bar-completed');
			} else {
				progressBarContainer.classList.remove('progress-bar-completed');
			}
		}
		
		// Update mark all as watched button visibility
		const markAllButton = progressCard.querySelector('.mark-all-watched');
		if (markAllButton) {
			if (updatedProgress.remainingCount === 0) {
				markAllButton.style.display = 'none';
			} else {
				markAllButton.style.display = '';
			}
		}
		
		// Update unwatched toggle button visibility
		const unwatchedToggle = progressCard.querySelector('.unwatched-toggle');
		if (unwatchedToggle) {
			if (updatedProgress.remainingCount === 0) {
				unwatchedToggle.classList.add('hide');
			} else {
				unwatchedToggle.classList.remove('hide');
			}
		}

		const lastWatchedElement = progressCard.querySelector('.progress-last-watched');
		if (lastWatchedElement) {
			if (updatedProgress.lastWatchedEpisode) {
				const episodeInfo = {
					title: updatedProgress.lastWatchedEpisode.Name,
					season: updatedProgress.lastWatchedEpisode.ParentIndexNumber,
					episode: updatedProgress.lastWatchedEpisode.IndexNumber
				};
				updateLastWatched(lastWatchedElement, episodeInfo);
			} else {
				// No episodes watched yet
				lastWatchedElement.innerHTML = '';
			}
		}
		
		// Update the unwatched episodes list to remove watched episodes
		await updateUnwatchedEpisodesList(seriesId);
		
		LOG(`Updated UI for series: ${updatedProgress.series.Name} (${updatedProgress.percentage}% complete)`);
	}

	// Function to create chunked progress bar showing individual episode status
	async function createChunkedProgressBar(card, progressData) {
		const progressBar = card.querySelector('.progress-bar');
		if (!progressBar) return;

		const { totalEpisodes, watchedCount } = progressData;
		const seriesId = progressData.series.Id;
		
		// Check if we have binary progress data
		if (progressData.binaryProgress) {
			// Create progress bar from binary data (instant)
			createBinaryProgressBar(progressBar, progressData.binaryProgress, seriesId);
			
		} else {
			// Fallback to simple progress bar
			progressBar.innerHTML = `<div class="progress-bar-fill" style="width: ${progressData.percentage}%"></div>`;
		}
	}

	// Function to update progress data in localStorage
	function updateProgressDataInLocalStorage() {
		if (progressCache.data.length === 0) {
			LOG('No progress data to update in localStorage');
			return;
		}
		
		try {
			// Optimize the data for storage (same as in fetchAllProgressData)
			const optimizedData = optimizeProgressDataForStorage(progressCache.data);
			
			// Update localStorage with the new data
			const success = localStorageCache.set('progress', optimizedData);
			if (success) {
				LOG('Updated progress data in localStorage');
			} else {
				WARN('Failed to update progress data in localStorage');
			}
		} catch (err) {
			ERR('Error updating progress data in localStorage:', err);
		}
	}

	// URL parameter handling functions (using Jellyfin's hash format)
	function getUrlParams() {
		// Parse hash parameters from the query string part of the hash
		const hash = window.location.hash;
		
		// Check if there are query parameters in the hash
		if (hash.includes('?')) {
			const [, queryString] = hash.split('?');
			const params = new URLSearchParams(queryString);
			
			return {
				pageTab: params.get('pageTab') || 'watchlist',
				page: parseInt(params.get('page')) || 1,
				search: params.get('search') || '',
				movieSearch: params.get('movieSearch') || '',
				sort: params.get('sort') || 'lastWatched',
				sortDirection: params.get('sortDirection') || 'desc',
				movieSort: params.get('movieSort') || 'lastWatched',
				movieSortDirection: params.get('movieSortDirection') || 'desc'
			};
		}
		
		// No query parameters found, return defaults
		return {
			pageTab: 'watchlist',
			page: 1,
			search: '',
			movieSearch: '',
			sort: 'lastWatched',
			sortDirection: 'desc',
			movieSort: 'lastWatched',
			movieSortDirection: 'desc'
		};
	}

	function updateUrlParams(pageTab, page, sort = null, sortDirection = null, movieSort = null, movieSortDirection = null) {
		const currentHash = window.location.hash;
		
		let newHash = currentHash;
		
		// Get search terms from respective caches
		const searchTerm = pageTab === 'progress' ? progressCache.searchTerm : '';
		const movieSearchTerm = pageTab === 'history' ? movieCache.searchTerm : '';
		
		// Get current sort order and direction or use provided values
		const currentSort = sort || (pageTab === 'progress' ? getCurrentSortOrder() : null);
		const currentDirection = sortDirection || (pageTab === 'progress' ? getCurrentSortDirection() : null);
		const currentMovieSort = movieSort || (pageTab === 'history' ? getCurrentMovieSortOrder() : null);
		const currentMovieDirection = movieSortDirection || (pageTab === 'history' ? getCurrentMovieSortDirection() : null);
		
		if (currentHash.includes('?')) {
			// Replace existing parameters
			const [hashPath, hashSearch] = currentHash.split('?');
			const params = new URLSearchParams(hashSearch);
			
			// Set our parameters
			params.set('pageTab', pageTab);
			
			// Only set page parameter for paginated tabs (progress and history)
			if (pageTab === 'progress' || pageTab === 'history') {
				params.set('page', page.toString());
			} else {
				// Remove page parameter for non-paginated tabs (watchlist and statistics)
				params.delete('page');
			}
			
			// Update sort parameters for progress tab
			if (currentSort && pageTab === 'progress') {
				params.set('sort', currentSort);
				if (currentDirection) {
					params.set('sortDirection', currentDirection);
				}
			} else if (pageTab !== 'progress') {
				params.delete('sort');
				params.delete('sortDirection');
			}
			
			// Update movie sort parameters for history tab
			if (currentMovieSort && pageTab === 'history') {
				params.set('movieSort', currentMovieSort);
				if (currentMovieDirection) {
					params.set('movieSortDirection', currentMovieDirection);
				}
			} else if (pageTab !== 'history') {
				params.delete('movieSort');
				params.delete('movieSortDirection');
			}
			
			// Update search parameters based on tab
			if (searchTerm && searchTerm.trim() !== '') {
				params.set('search', searchTerm);
			} else {
				params.delete('search');
			}
			
			if (movieSearchTerm && movieSearchTerm.trim() !== '') {
				params.set('movieSearch', movieSearchTerm);
			} else {
				params.delete('movieSearch');
			}
			
			const paramString = params.toString();
			newHash = paramString ? `${hashPath}?${paramString}` : hashPath;
		} else {
			// Add parameters
			let paramString = `pageTab=${pageTab}`;
			
			// Only add page parameter for paginated tabs (progress and history)
			if (pageTab === 'progress' || pageTab === 'history') {
				paramString += `&page=${page}`;
			}
			
			// Add sort parameters for progress tab
			if (currentSort && pageTab === 'progress') {
				paramString += `&sort=${currentSort}`;
				if (currentDirection) {
					paramString += `&sortDirection=${currentDirection}`;
				}
			}
			
			// Add movie sort parameters for history tab
			if (currentMovieSort && pageTab === 'history') {
				paramString += `&movieSort=${currentMovieSort}`;
				if (currentMovieDirection) {
					paramString += `&movieSortDirection=${currentMovieDirection}`;
				}
			}
			
			if (searchTerm && searchTerm.trim() !== '') {
				paramString += `&search=${encodeURIComponent(searchTerm)}`;
			}
			if (movieSearchTerm && movieSearchTerm.trim() !== '') {
				paramString += `&movieSearch=${encodeURIComponent(movieSearchTerm)}`;
			}
			newHash = `${currentHash}?${paramString}`;
		}
		
		// Update cache currentPage for the appropriate tab
		if (pageTab === 'progress') {
			progressCache.currentPage = page;
		} else if (pageTab === 'history') {
			movieCache.currentPage = page;
		}
		
		const newUrl = window.location.origin + window.location.pathname + '#' + newHash.substring(1);
		
		// Replace history entry instead of adding new one
		window.history.replaceState(null, '', newUrl);
		LOG(`Hash updated: pageTab=${pageTab}, page=${page}, search="${searchTerm}", movieSearch="${movieSearchTerm}"`, newUrl);
	}

	// Sorting configuration and functions
	const SORT_OPTIONS = {
		lastWatched: { 
			label: 'Last Watched', 
			default: true,
			defaultDirection: 'desc',
			sortFn: (a, b, direction) => sortByLastWatched(a, b, direction)
		},
		name: { 
			label: 'Name', 
			defaultDirection: 'asc',
			sortFn: (a, b, direction) => sortByName(a, b, direction)
		},
		progress: { 
			label: 'Progress', 
			defaultDirection: 'desc',
			sortFn: (a, b, direction) => sortByProgress(a, b, direction)
		},
		episodeCount: { 
			label: 'Episode Count', 
			defaultDirection: 'desc',
			sortFn: (a, b, direction) => sortByEpisodeCount(a, b, direction)
		},
		releaseDate: { 
			label: 'Release Date', 
			defaultDirection: 'desc',
			sortFn: (a, b, direction) => sortByReleaseDate(a, b, direction)
		}
	};

	// Movie-specific sorting configuration
	const MOVIE_SORT_OPTIONS = {
		lastWatched: { 
			label: 'Last Watched', 
			default: true,
			defaultDirection: 'desc',
			sortFn: (a, b, direction) => sortMovieByLastWatched(a, b, direction)
		},
		name: { 
			label: 'Name', 
			defaultDirection: 'asc',
			sortFn: (a, b, direction) => sortMovieByName(a, b, direction)
		},
		premiereDate: { 
			label: 'Premiere Date', 
			defaultDirection: 'desc',
			sortFn: (a, b, direction) => sortMovieByPremiereDate(a, b, direction)
		},
		runtime: { 
			label: 'Runtime', 
			defaultDirection: 'desc',
			sortFn: (a, b, direction) => sortMovieByRuntime(a, b, direction)
		}
	};

	// Get current sort order from URL or localStorage
	function getCurrentSortOrder() {
		const params = getUrlParams();
		if (params.sort && SORT_OPTIONS[params.sort]) {
			return params.sort;
		}
		
		// Fallback to localStorage
		const savedSort = localStorage.getItem('kefinTweaks_progressSort');
		if (savedSort && SORT_OPTIONS[savedSort]) {
			return savedSort;
		}
		
		return 'lastWatched';
	}

	// Get current sort direction from URL or localStorage
	function getCurrentSortDirection() {
		const params = getUrlParams();
		if (params.sortDirection && (params.sortDirection === 'asc' || params.sortDirection === 'desc')) {
			return params.sortDirection;
		}
		
		// Fallback to localStorage
		const savedDirection = localStorage.getItem('kefinTweaks_progressSortDirection');
		if (savedDirection && (savedDirection === 'asc' || savedDirection === 'desc')) {
			return savedDirection;
		}
		
		// Default to the sort option's default direction
		const currentSort = getCurrentSortOrder();
		return SORT_OPTIONS[currentSort]?.defaultDirection || 'desc';
	}

	// Movie-specific sort functions
	function getCurrentMovieSortOrder() {
		const params = getUrlParams();
		if (params.movieSort && MOVIE_SORT_OPTIONS[params.movieSort]) {
			return params.movieSort;
		}
		
		// Fallback to localStorage
		const savedSort = localStorage.getItem('kefinTweaks_movieSort');
		if (savedSort && MOVIE_SORT_OPTIONS[savedSort]) {
			return savedSort;
		}
		
		return 'lastWatched';
	}

	function getCurrentMovieSortDirection() {
		const params = getUrlParams();
		if (params.movieSortDirection && (params.movieSortDirection === 'asc' || params.movieSortDirection === 'desc')) {
			return params.movieSortDirection;
		}
		
		// Fallback to localStorage
		const savedDirection = localStorage.getItem('kefinTweaks_movieSortDirection');
		if (savedDirection && (savedDirection === 'asc' || savedDirection === 'desc')) {
			return savedDirection;
		}
		
		// Default to the sort option's default direction
		const currentSort = getCurrentMovieSortOrder();
		return MOVIE_SORT_OPTIONS[currentSort]?.defaultDirection || 'desc';
	}

	// Set sort order and update URL
	function setSortOrder(sortKey, direction = null) {
		if (!SORT_OPTIONS[sortKey]) {
			LOG(`Invalid sort key: ${sortKey}`);
			return;
		}
		
		// Use provided direction or default for the sort option
		const sortDirection = direction || SORT_OPTIONS[sortKey].defaultDirection;
		
		// Save to localStorage
		localStorage.setItem('kefinTweaks_progressSort', sortKey);
		localStorage.setItem('kefinTweaks_progressSortDirection', sortDirection);
		
		// Update URL - reset to page 1 when sort changes
		const params = getUrlParams();
		updateUrlParams(params.pageTab, 1, sortKey, sortDirection);
		
		// Update tab state to reflect page reset
		if (tabStates.progress) {
			tabStates.progress.currentPage = 1;
		}
		
		// Re-render content
		renderProgressContent();
	}

	// Sort function for last watched (individual items)
	function sortByLastWatched(a, b, direction = 'desc') {
		// Get last watched dates from progress data
		const dateA = a.lastWatchedEpisode && a.lastWatchedEpisode.UserData && a.lastWatchedEpisode.UserData.LastPlayedDate 
			? new Date(a.lastWatchedEpisode.UserData.LastPlayedDate) 
			: new Date(0); // Fallback to epoch if no last watched date
		
		const dateB = b.lastWatchedEpisode && b.lastWatchedEpisode.UserData && b.lastWatchedEpisode.UserData.LastPlayedDate 
			? new Date(b.lastWatchedEpisode.UserData.LastPlayedDate) 
			: new Date(0); // Fallback to epoch if no last watched date
		
		// Sort by direction
		return direction === 'asc' ? dateA - dateB : dateB - dateA;
	}

	// Sort function for name
	function sortByName(a, b, direction = 'asc') {
		const result = a.series.Name.localeCompare(b.series.Name);
		return direction === 'asc' ? result : -result;
	}

	// Sort function for progress percentage
	function sortByProgress(a, b, direction = 'desc') {
		// Primary sort: progress percentage
		const progressResult = b.percentage - a.percentage;
		
		// If progress is the same, use last watched date as tiebreaker
		if (progressResult === 0) {
			const dateA = a.lastWatchedEpisode && a.lastWatchedEpisode.UserData && a.lastWatchedEpisode.UserData.LastPlayedDate 
				? new Date(a.lastWatchedEpisode.UserData.LastPlayedDate) 
				: new Date(0); // Fallback to epoch if no last watched date
			
			const dateB = b.lastWatchedEpisode && b.lastWatchedEpisode.UserData && b.lastWatchedEpisode.UserData.LastPlayedDate 
				? new Date(b.lastWatchedEpisode.UserData.LastPlayedDate) 
				: new Date(0); // Fallback to epoch if no last watched date
			
			// For tiebreaker, always use descending (most recent first) regardless of main direction
			const tiebreakerResult = dateB - dateA;
			return direction === 'asc' ? -progressResult : progressResult + (tiebreakerResult * 0.0001);
		}
		
		return direction === 'asc' ? -progressResult : progressResult;
	}

	// Sort function for episode count
	function sortByEpisodeCount(a, b, direction = 'desc') {
		const result = b.totalEpisodes - a.totalEpisodes;
		return direction === 'asc' ? -result : result;
	}

	// Sort function for release date
	function sortByReleaseDate(a, b, direction = 'desc') {
		const dateA = new Date(a.series.ProductionYear);
		const dateB = new Date(b.series.ProductionYear);
		const result = dateB - dateA;
		return direction === 'asc' ? -result : result;
	}

	// Movie-specific sort functions
	function sortMovieByLastWatched(a, b, direction = 'desc') {
		const dateA = a.UserData && a.UserData.LastPlayedDate 
			? new Date(a.UserData.LastPlayedDate) 
			: new Date(0); // Fallback to epoch if no last played date
		
		const dateB = b.UserData && b.UserData.LastPlayedDate 
			? new Date(b.UserData.LastPlayedDate) 
			: new Date(0); // Fallback to epoch if no last played date
		
		// Sort by direction
		return direction === 'asc' ? dateA - dateB : dateB - dateA;
	}

	function sortMovieByName(a, b, direction = 'asc') {
		const result = a.Name.localeCompare(b.Name);
		return direction === 'asc' ? result : -result;
	}

	function sortMovieByPremiereDate(a, b, direction = 'desc') {
		const dateA = new Date(a.PremiereDate || a.ProductionYear);
		const dateB = new Date(b.PremiereDate || b.ProductionYear);
		const result = dateB - dateA;
		return direction === 'asc' ? -result : result;
	}

	function sortMovieByRuntime(a, b, direction = 'desc') {
		const runtimeA = a.RunTimeTicks ? Math.floor(a.RunTimeTicks / 10000000) : 0; // Convert ticks to seconds
		const runtimeB = b.RunTimeTicks ? Math.floor(b.RunTimeTicks / 10000000) : 0;
		const result = runtimeB - runtimeA;
		return direction === 'asc' ? -result : result;
	}

	// Set movie sort order and update URL
	function setMovieSortOrder(sortKey, direction = null) {
		if (!MOVIE_SORT_OPTIONS[sortKey]) {
			LOG(`Invalid movie sort key: ${sortKey}`);
			return;
		}
		
		// Use provided direction or default for the sort option
		const sortDirection = direction || MOVIE_SORT_OPTIONS[sortKey].defaultDirection;
		
		// Save to localStorage
		localStorage.setItem('kefinTweaks_movieSort', sortKey);
		localStorage.setItem('kefinTweaks_movieSortDirection', sortDirection);
		
		// Update URL - reset to page 1 when sort changes
		const params = getUrlParams();
		updateUrlParams(params.pageTab, 1, null, null, sortKey, sortDirection);
		
		// Update tab state to reflect page reset
		if (tabStates.history) {
			tabStates.history.currentPage = 1;
		}
		
		// Re-render content
		renderHistoryContent();
	}

	// Apply sorting to data
	function applySorting(data, sortKey) {
		if (!SORT_OPTIONS[sortKey]) {
			LOG(`Invalid sort key: ${sortKey}`);
			return data;
		}
		
		const sortDirection = getCurrentSortDirection();
		const sortFn = SORT_OPTIONS[sortKey].sortFn;
		const sortedData = [...data].sort((a, b) => sortFn(a, b, sortDirection));
		LOG(`Applied sorting: ${SORT_OPTIONS[sortKey].label} (${sortDirection})`);
		return sortedData;
	}

	// Apply sorting to movie data
	function applyMovieSorting(data, sortKey) {
		if (!MOVIE_SORT_OPTIONS[sortKey]) {
			LOG(`Invalid movie sort key: ${sortKey}`);
			return data;
		}
		
		const sortDirection = getCurrentMovieSortDirection();
		const sortFn = MOVIE_SORT_OPTIONS[sortKey].sortFn;
		const sortedData = [...data].sort((a, b) => sortFn(a, b, sortDirection));
		LOG(`Applied movie sorting: ${MOVIE_SORT_OPTIONS[sortKey].label} (${sortDirection})`);
		return sortedData;
	}

	function updateUrlWithSearch(pageTab, page, search = '', movieSearch = '') {
		const currentHash = window.location.hash;
		
		let newHash = currentHash;
		
		if (currentHash.includes('?')) {
			// Replace existing parameters
			const [hashPath, hashSearch] = currentHash.split('?');
			const params = new URLSearchParams(hashSearch);
			
			// Set our parameters
			params.set('pageTab', pageTab);
			params.set('page', page.toString());
			
			// Add or remove search parameter
			if (search && search.trim() !== '') {
				params.set('search', search);
			} else {
				params.delete('search');
			}
			
			// Add or remove movie search parameter
			if (movieSearch && movieSearch.trim() !== '') {
				params.set('movieSearch', movieSearch);
			} else {
				params.delete('movieSearch');
			}
			
			const paramString = params.toString();
			newHash = paramString ? `${hashPath}?${paramString}` : hashPath;
		} else {
			// Add parameters
			let paramString = `pageTab=${pageTab}&page=${page}`;
			if (search && search.trim() !== '') {
				paramString += `&search=${encodeURIComponent(search)}`;
			}
			if (movieSearch && movieSearch.trim() !== '') {
				paramString += `&movieSearch=${encodeURIComponent(movieSearch)}`;
			}
			newHash = `${currentHash}?${paramString}`;
		}
		
		// Update cache currentPage for the appropriate tab
		if (pageTab === 'progress') {
			progressCache.currentPage = page;
		} else if (pageTab === 'history') {
			movieCache.currentPage = page;
		}
		
		const newUrl = window.location.origin + window.location.pathname + '#' + newHash.substring(1);
		
		// Replace history entry instead of adding new one
		window.history.replaceState(null, '', newUrl);
		LOG(`Hash updated: pageTab=${pageTab}, page=${page}, search="${search}", movieSearch="${movieSearch}"`, newUrl);
	}

	// Hash change listener for browser navigation
	function setupHashChangeListener() {
		window.addEventListener('hashchange', () => {
			if (!window.location.hash.includes('#/home')) {
				return;
			}

			LOG('Hash changed, checking watchlist tab');
			const params = getUrlParams();
			
			// Check if we're on any watchlist tab and render accordingly
			if (params.pageTab === 'progress' || params.pageTab === 'history' || params.pageTab === 'watchlist' || params.pageTab === 'statistics') {
				// Find the watchlist section and switch to the appropriate tab
				const watchlistSection = getWatchlistSection();
				if (watchlistSection) {
					// Update tab UI
					const buttons = watchlistSection.querySelectorAll('.watchlist-tabs button');
					buttons.forEach(button => button.classList.remove('active'));
					
					const tabContents = watchlistSection.querySelectorAll('div[data-tab]:not(.watchlist-tabs)');
					tabContents.forEach(content => content.style.display = 'none');
					
					const activeButton = watchlistSection.querySelector(`.watchlist-tabs button[data-tab="${params.pageTab}"]`);
					const activeContent = watchlistSection.querySelector(`div[data-tab="${params.pageTab}"]:not(.watchlist-tabs)`);
					
					if (activeButton) activeButton.classList.add('active');
					if (activeContent) activeContent.style.display = 'block';
					
					// Render content based on active tab
					if (params.pageTab === 'progress') {
						renderProgressContent();
					} else if (params.pageTab === 'watchlist') {
						renderWatchlistContent();
					} else if (params.pageTab === 'history') {
						renderHistoryContent();
					} else if (params.pageTab === 'statistics') {
						renderStatisticsContent();
					}
				}
			}
		});
	}

	// Tab initialization functions
	async function initProgressTab() {
		const watchlistSection = getWatchlistSection();
		const progressContent = watchlistSection ? watchlistSection.querySelector('div[data-tab="progress"] .progress-series') : null;

		// Only skip if we're currently fetching OR if data is fetched AND we have cached data
		if (tabStates.progress.isFetching || (tabStates.progress.isDataFetched && progressCache.allDataLoaded)) {
			LOG('Progress tab already initialized or fetching');
			return;
		}

		const urlParams = getUrlParams();
		if (urlParams.search) {
			const searchInput = getElementByIdSafe('progress-search');			
			if (searchInput) {
				searchInput.value = urlParams.search;
			}
		}
		
		LOG('Initializing progress tab');
		renderProgressContent();
		
		try {
			await fetchAllProgressData(true);
			tabStates.progress.isDataFetched = true;
			tabStates.progress.isFetching = false;

			if (urlParams.search) {
				updateSearchResults(urlParams.search);
			}
			
			if (movieCache && movieCache.allDataLoaded) {
				renderStatisticsContent();
			}

			renderProgressContent();
			LOG('Progress tab initialization complete');
		} catch (err) {
			ERR('Error initializing progress tab:', err);
			tabStates.progress.isFetching = false;
		}
	}

	async function initHistoryTab() {
		if (tabStates.history.isFetching) {
			LOG('History tab is currently fetching, skipping');
			return;
		}

		const urlParams = getUrlParams();
		if (urlParams.movieSearch) {
			const searchInput = getElementByIdSafe('movie-search');			
			if (searchInput) {
				searchInput.value = urlParams.movieSearch;
			}
		}
		
		LOG('Initializing history tab');
		renderHistoryContent();
		
		try {
			// Always fetch data (will use cache if available)
			await fetchWatchedMovies(true);
			tabStates.history.isDataFetched = true;
			tabStates.history.isFetching = false;

			if (urlParams.movieSearch) {
				updateMovieSearchResults(urlParams.movieSearch);
			}

			if (progressCache && progressCache.allDataLoaded) {
				renderStatisticsContent();
			}
			
			// Always render content, even if data was already fetched
			// This ensures content is rendered when tab is reinitialized
			renderHistoryContent();
			LOG('History tab initialization complete');
		} catch (err) {
			ERR('Error initializing history tab:', err);
			tabStates.history.isFetching = false;
		}
	}

	// Initialize a specific watchlist section
	async function initWatchlistSection(section, type) {
		LOG(`Initializing ${section} section`);
		
		// Check localStorage cache first
		const userId = window.ApiClient.getCurrentUserId();
		const cachedData = localStorageCache.get(`watchlist_${section}`);
		if (cachedData && false) {
			LOG(`Using localStorage cache for watchlist ${section}`);
			watchlistCache[section].data = cachedData;
			return;
		}
		
		try {
			const items = watchlistCache[section].data;
			
			// Sort items by release date descending (newest first)
			const sortedItems = items.sort((a, b) => {
				const dateA = new Date(a.PremiereDate || a.ProductionYear || 0);
				const dateB = new Date(b.PremiereDate || b.ProductionYear || 0);
				return dateB - dateA; // Descending order (newest first)
			});
			
			// Store in cache
			//watchlistCache[section].data = sortedItems;
			
			// Store in localStorage for next time (optimized)
			const optimizedData = optimizeWatchlistDataForStorage(sortedItems);
			localStorageCache.set(`watchlist_${section}`, optimizedData, ApiClient._currentUser.Id, WATCHLIST_CACHE_TTL);
			LOG(`Stored optimized watchlist ${section} data in localStorage`);
			
			// Sync watched status for this section (remove played items)
			const playedItems = sortedItems.filter(item => item.UserData && item.UserData.Played);
			if (playedItems.length > 0) {
				LOG(`Found ${playedItems.length} played items in ${section} section, removing from watchlist`);
				for (const item of playedItems) {
					await removeItemFromWatchlist(item.Id, item.Type);
				}
			}
			
			LOG(`${section} section initialization complete: ${sortedItems.length} items`);
		} catch (err) {
			ERR(`Error initializing ${section} section:`, err);
			watchlistCache[section].data = [];
		}
	}

	async function initWatchlistTab() {
		if (tabStates.watchlist.isFetching) {
			LOG('Watchlist tab is fetching');
			return;
		}
		
		LOG('Initializing watchlist tab');
		tabStates.watchlist.isFetching = true;
		tabStates.watchlist.isDataFetched = false;
		
		renderWatchlistContent();
		
		try {
			// Fetch watchlist data
			const watchlistData = await window.apiHelper.getWatchlistItems({ IncludeItemTypes: 'Movie,Series,Season,Episode' });
			localStorageCache.set('watchlist_movies', watchlistData.Items.filter(item => item.Type === 'Movie'));
			localStorageCache.set('watchlist_series', watchlistData.Items.filter(item => item.Type === 'Series'));
			localStorageCache.set('watchlist_seasons', watchlistData.Items.filter(item => item.Type === 'Season'));
			localStorageCache.set('watchlist_episodes', watchlistData.Items.filter(item => item.Type === 'Episode'));
			watchlistCache.movies.data = watchlistData.Items.filter(item => item.Type === 'Movie');
			watchlistCache.series.data = watchlistData.Items.filter(item => item.Type === 'Series');
			watchlistCache.seasons.data = watchlistData.Items.filter(item => item.Type === 'Season');
			watchlistCache.episodes.data = watchlistData.Items.filter(item => item.Type === 'Episode');

			// Initialize all watchlist sections in parallel
			await Promise.all([
				initWatchlistSection('movies', 'Movie'),
				initWatchlistSection('series', 'Series'),
				initWatchlistSection('seasons', 'Season'),
				initWatchlistSection('episodes', 'Episode')
			]);
			
			tabStates.watchlist.isDataFetched = true;
			tabStates.watchlist.isFetching = false;
			
			// Sync watched status to remove played items
			await syncWatchedStatusToWatchlist();
			
			renderWatchlistContent();
			
			LOG('Watchlist tab initialization complete');
		} catch (err) {
			ERR('Error initializing watchlist tab:', err);
			tabStates.watchlist.isFetching = false;
		}
	}

	async function initStatisticsTab() {
		if (tabStates.statistics.isFetching || tabStates.statistics.isDataFetched) {
			LOG('Statistics tab already initialized or fetching');
			return;
		}
		
		// Statistics depends on progress and history data
		if (!tabStates.progress.isDataFetched || !tabStates.history.isDataFetched) {
			LOG('Statistics tab waiting for progress and history data');
			return;
		}
		
		LOG('Initializing statistics tab');
		tabStates.statistics.isFetching = true;
		
		try {
			// Statistics are calculated from existing cache data
			tabStates.statistics.isDataFetched = true;
			tabStates.statistics.isFetching = false;

			await renderStatisticsContent();
			LOG('Statistics tab initialization complete');
		} catch (err) {
			ERR('Error initializing statistics tab:', err);
			tabStates.statistics.isFetching = false;
		}
	}

	// Initialize all tabs with proper dependencies
	async function initializeAllTabs() {
		LOG('Starting tab initialization');
		
		// Independent tabs can run in parallel
		const watchlistPromise = initWatchlistTab();
		
		// Dependent tabs: progress and history first, then statistics
		const progressPromise = initProgressTab();
		const historyPromise = initHistoryTab();
		
		// Wait for progress and history, then init statistics
		await Promise.all([watchlistPromise, progressPromise, historyPromise]);
		await initStatisticsTab();
		LOG('All tabs initialized');
	}

	function sortInProgressSeries(series) {
		LOG('Starting to sort series by Status and date');
		
		const sorted = series.sort((a, b) => {
			// First, separate Continuing vs Ended
			if (a.Status === 'Continuing' && b.Status === 'Ended') return -1;
			if (a.Status === 'Ended' && b.Status === 'Continuing') return 1;
			
			// Within same status, sort by appropriate date
			if (a.Status === 'Continuing') {
				const dateA = new Date(a.PremiereDate || 0);
				const dateB = new Date(b.PremiereDate || 0);
				return dateB - dateA; // Newest first
			} else { // Ended
				const dateA = new Date(a.EndDate || 0);
				const dateB = new Date(b.EndDate || 0);
				return dateB - dateA; // Most recently ended first
			}
		});
		
		// Debug logging for sorting results
		const continuingCount = sorted.filter(s => s.Status === 'Continuing').length;
		const endedCount = sorted.filter(s => s.Status === 'Ended').length;
		LOG(`Sorting complete: ${continuingCount} Continuing, ${endedCount} Ended series`);
		
		return sorted;
	}

	function sortProgressDataByLastWatched(progressDataArray) {
		LOG('Starting to sort progress data by most recently watched episode');
		
		const sorted = progressDataArray.sort((a, b) => {
			// Get last watched dates from progress data
			const dateA = a.lastWatchedEpisode && a.lastWatchedEpisode.UserData && a.lastWatchedEpisode.UserData.LastPlayedDate 
				? new Date(a.lastWatchedEpisode.UserData.LastPlayedDate) 
				: new Date(0); // Fallback to epoch if no last watched date
			
			const dateB = b.lastWatchedEpisode && b.lastWatchedEpisode.UserData && b.lastWatchedEpisode.UserData.LastPlayedDate 
				? new Date(b.lastWatchedEpisode.UserData.LastPlayedDate) 
				: new Date(0); // Fallback to epoch if no last watched date
			
			// Sort by most recently watched first (descending order)
			return dateB - dateA;
		});
		
		// Debug logging for sorting results
		const withLastWatched = sorted.filter(p => p.lastWatchedEpisode && p.lastWatchedEpisode.UserData && p.lastWatchedEpisode.UserData.LastPlayedDate).length;
		const withoutLastWatched = sorted.length - withLastWatched;
		LOG(`Progress sorting complete: ${withLastWatched} with last watched date, ${withoutLastWatched} without`);
		
		return sorted;
	}


	async function fetchAllProgressData(useCache = true) {
		// Check if we're already fetching to prevent duplicate calls
		if (tabStates.progress.isFetching) {
			LOG('Progress data fetch already in progress, skipping duplicate call');
			return progressCache.data; // Return existing data or empty array
		}

		// Check if we already have all progress data loaded
		if (useCache && progressCache.allDataLoaded) {
			LOG('Using cached all progress data');
			return progressCache.data;
		}

		// Check localStorage cache if in-memory cache is empty
		if (useCache && !progressCache.allDataLoaded) {
			const cachedData = localStorageCache.get(`progress`);
			if (cachedData) {
				LOG('Using localStorage cache for progress data');
				progressCache.data = cachedData;
				progressCache.allDataLoaded = true;
				progressCache.totalPages = Math.ceil(cachedData.length / progressCache.pageSize);
				return cachedData;
			}
		}

		// Set fetching flag to prevent duplicate calls
		tabStates.progress.isFetching = true;
		LOG('Starting progress data fetch...');
		const apiClient = window.ApiClient;
		const userId = apiClient.getCurrentUserId();
		const serverUrl = apiClient.serverAddress();
		const token = apiClient.accessToken();

		// Fetch series from API directly
		const seriesUrl = `${serverUrl}/Items?IncludeItemTypes=Series&UserId=${userId}&Recursive=true&Fields=UserData,RecursiveItemCount&EnableImageTypes=Primary,Banner`;
		
		try {
			const seriesRes = await fetch(seriesUrl, { headers: { "Authorization": `MediaBrowser Token=\"${token}\"` } });
			const seriesData = await seriesRes.json();
			const series = seriesData.Items || [];

			if (series.length === 0) {
				LOG('No series found, returning empty progress data');
				progressCache.data = [];
				progressCache.allDataLoaded = true;
				return [];
			}
			
			// Filter series that have been started (UserData.PlayedPercentage > 0)
			const inProgressSeries = series.filter(series => {
				return series.UserData && 
					series.UserData.PlayedPercentage > 0;
			});		
			LOG(`Found ${inProgressSeries.length} series with PlayedPercentage > 0`);


			LOG(`Fetching progress data for all ${inProgressSeries.length} series`);

			// Fetch progress data for all series in parallel
			const progressData = await Promise.all(
				inProgressSeries.map(async (seriesItem) => {
					return await fetchSeriesProgressWithMissingEpisodes(seriesItem, userId, serverUrl, token);
				})
			);

			// Filter out series with no valid progress data
			const validProgressData = progressData.filter(data => data !== null);
			LOG(`Successfully processed ${validProgressData.length} progress entries`);

			// Sort by most recently watched episode
			const sortedProgressData = sortProgressDataByLastWatched(validProgressData);

			// Update cache with all progress data
			progressCache.data = sortedProgressData;
			progressCache.allDataLoaded = true;
			progressCache.totalPages = Math.ceil(sortedProgressData.length / progressCache.pageSize);

			// Store in localStorage for next time (optimized)
			const optimizedData = optimizeProgressDataForStorage(sortedProgressData);
			localStorageCache.set(`progress`, optimizedData);
			LOG('Stored optimized progress data in localStorage');

			LOG(`All progress data loaded and sorted: ${sortedProgressData.length} items, ${progressCache.totalPages} pages`);
			
			return sortedProgressData;
		} catch (err) {
			ERR("Failed to fetch all progress data:", err);
			return [];
		} finally {
			// Always clear the fetching flag, even on error
			tabStates.progress.isFetching = false;
			LOG('Progress data fetch completed');
			renderStatisticsContent();
		}
	}

	async function fetchProgressForPage(page = 1) {
		LOG(`Getting progress data for page ${page} from preloaded data`);
		
		// Ensure we have all progress data loaded
		if (!progressCache.allDataLoaded || progressCache.data.length === 0) {
			await fetchAllProgressData(true);
		}

		// Get current sort order and apply sorting
		const currentSort = getCurrentSortOrder();
		const sortedData = applySorting(progressCache.data, currentSort);
		
		// Update pagination with sorted data
		progressPagination.updateCache(sortedData);
		
		// Get the progress data for this page from sorted data
		const { pageData } = progressPagination.getCachedPage(page);
		
		return pageData;
	}

	async function fetchSeriesProgressWithMissingEpisodes(series, userId, serverUrl, token) {
		try {
			// Check if we already have progress data cached for this series
			const cachedProgress = getCachedSeriesProgress(series.Id);
			if (cachedProgress) {
				LOG(`Using cached progress for series: ${series.Name}`);
				return cachedProgress;
			}
			
			// Get all episodes including missing ones to get accurate TotalRecordCount
			const episodesUrl = `${serverUrl}/Shows/${series.Id}/Episodes?UserId=${userId}&Fields=UserData&EnableImageTypes=Primary`;
			const episodesRes = await fetch(episodesUrl, { headers: { "Authorization": `MediaBrowser Token=\"${token}\"` } });
			const episodesData = await episodesRes.json();
			let episodes = episodesData.Items || [];

			episodes = episodes
				.filter(ep => ep.ParentIndexNumber !== 0)
				.filter((ep, index, self) => 
					index === self.findIndex(e => 
						e.ParentIndexNumber === ep.ParentIndexNumber && 
						e.IndexNumber === ep.IndexNumber
					)
				);
			
			// Count only episodes that have aired (have PremiereDate and it's before today)
			const today = new Date();
			today.setHours(23, 59, 59, 999); // End of today
			
			const airedEpisodes = episodes.filter(ep => 
				ep.PremiereDate && new Date(ep.PremiereDate) <= today
			);
			
			// Expand multi-part episodes to get the actual total count
			const expandedForCount = [];
			airedEpisodes.forEach(episode => {
				expandedForCount.push(...expandMultiPartEpisodes(episode));
			});
			const totalEpisodes = expandedForCount.length;
			
			// Count watched episodes - expand multi-part episodes and count all parts if watched
			const watchedExpanded = [];
			airedEpisodes.forEach(episode => {
				if (episode.UserData && episode.UserData.Played === true) {
					watchedExpanded.push(...expandMultiPartEpisodes(episode));
				}
			});
			const watchedCount = watchedExpanded.length;
			const remainingCount = totalEpisodes - watchedCount;

			// Debug logging to verify we're getting the right data
			LOG(`Series: ${series.Name}, Aired Episodes: ${totalEpisodes}, Watched: ${watchedCount}, Remaining: ${remainingCount}`);

			if (totalEpisodes === 0 || watchedCount === 0) return null;

			// Calculate total runtime from available episodes (only those with actual files)
			const availableEpisodes = episodes.filter(ep => ep.RunTimeTicks && ep.RunTimeTicks > 0);
			const totalRuntime = availableEpisodes.reduce((total, ep) => total + (ep.RunTimeTicks / 10000000), 0);
			
			// Calculate watched runtime from actually watched episodes
			const watchedRuntime = watchedExpanded.reduce((total, ep) => total + (ep.RunTimeTicks ? ep.RunTimeTicks / 10000000 : 0), 0);
			
			// Estimate remaining runtime (this is approximate since we don't have runtime for missing episodes)
			const remainingRuntime = totalRuntime - watchedRuntime;

			// Find last watched episode
			let lastWatchedEpisode = null;
			if (watchedExpanded.length > 0) {
				lastWatchedEpisode = watchedExpanded
					.filter(ep => ep.UserData && ep.UserData.LastPlayedDate)
					.sort((a, b) => new Date(b.UserData.LastPlayedDate) - new Date(a.UserData.LastPlayedDate))[0];
			}

			// Calculate percentage based on total episodes (including missing ones)
			const percentage = totalEpisodes > 0 ? Math.round((watchedCount / totalEpisodes) * 100) : 0;

			// Filter unwatched episodes from aired episodes only
			const unwatchedEpisodes = airedEpisodes.filter(episode => 
				!episode.UserData.Played || episode.UserData.Played === false
			);

			// Generate binary progress data for instant rendering
			const binaryProgress = generateBinaryProgressData(episodes);
			
			const progressData = {
				series: series,
				watchedCount: watchedCount,
				totalEpisodes: totalEpisodes,
				remainingCount: remainingCount,
				percentage: percentage,
				totalRuntime: totalRuntime,
				watchedRuntime: watchedRuntime,
				remainingRuntime: remainingRuntime,
				lastWatchedEpisode: lastWatchedEpisode,
				// Binary progress data for instant rendering (stored in localStorage)
				binaryProgress: binaryProgress,
				// Episodes cached in memory only (not stored in localStorage)
				episodes: episodes
			};

			// Cache the progress data for this series
			cacheSeriesProgress(series.Id, progressData);

			return progressData;
		} catch (err) {
			ERR(`Failed to fetch progress for series ${series.Name}:`, err);
			return null;
		}
	}

	function formatTimeAgo(dateString) {
		const now = new Date();
		const date = new Date(dateString);
		const diffInSeconds = Math.floor((now - date) / 1000);
		
		if (diffInSeconds < 60) return 'just now';
		if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)} minutes ago`;
		if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)} hours ago`;
		if (diffInSeconds < 2592000) return `${Math.floor(diffInSeconds / 86400)} days ago`;
		if (diffInSeconds < 31536000) return `${Math.floor(diffInSeconds / 2592000)} months ago`;
		return `${Math.floor(diffInSeconds / 31536000)} years ago`;
	}

	function formatLastWatchedDate(dateString) {
		const date = new Date(dateString);
		return date.toLocaleDateString('en-US', { 
			month: 'short', 
			day: 'numeric', 
			year: 'numeric',
			hour: 'numeric',
			minute: '2-digit',
			hour12: true
		});
	}

	async function toggleMovieFavorite(movieId, buttonElement) {
		LOG(`Toggling favorite for movie: ${movieId}`);
		const apiClient = window.ApiClient;
		const userId = apiClient.getCurrentUserId();
		const serverUrl = apiClient.serverAddress();
		const token = apiClient.accessToken();
		
		try {
			// Determine current favorite status from button state
			const isCurrentlyFavorite = buttonElement.classList.contains('favorited');
			const method = isCurrentlyFavorite ? 'DELETE' : 'POST';
			
			// Make the appropriate API call
			const toggleUrl = `${serverUrl}/Users/${userId}/FavoriteItems/${movieId}`;
			const toggleRes = await fetch(toggleUrl, {
				method: method,
				headers: { 
					"Authorization": `MediaBrowser Token="${token}"`
				}
			});
			
			if (!toggleRes.ok) {
				throw new Error(`Failed to ${isCurrentlyFavorite ? 'remove from' : 'add to'} favorites: ${toggleRes.status}`);
			}
			
			// Update button appearance based on the new state (opposite of current)
			const icon = buttonElement.querySelector('.material-icons');
			const text = buttonElement.querySelector('span:last-child');
			const newFavoriteStatus = !isCurrentlyFavorite;
			
			if (newFavoriteStatus) {
				buttonElement.classList.add('favorited');
			} else {
				buttonElement.classList.remove('favorited');
			}
			
			LOG(`Successfully ${newFavoriteStatus ? 'added to' : 'removed from'} favorites: ${movieId}`);
			
		} catch (err) {
			ERR('Error toggling movie favorite:', err);
			// You could add a toast notification here if desired
		}
	}

	// Statistics calculation functions
	async function calculateProgressStatistics(progressData) {
		if (!progressData || progressData.length === 0) {
			// Still try to get movie count even if no series data
			await fetchWatchedMovies(true); // Use cached data
			return {
				seriesStarted: 0,
				seriesWatched: 0,
				episodesWatched: 0,
				moviesWatched: movieCache.data.length,
				topShows: []
			};
		}

		// Calculate basic statistics
		const seriesStarted = progressData.length;
		const seriesWatched = progressData.filter(progress => progress.percentage === 100).length;
		const episodesWatched = progressData.reduce((total, progress) => total + progress.watchedCount, 0);

		// Get movie count from cache
		await fetchWatchedMovies(true); // Use cached data
		const moviesWatched = movieCache.data.length;

		// Calculate top 5 shows by completion percentage, then by episode count
		const topShows = progressData
			.map(progress => ({
				name: progress.series.Name,
				episodesWatched: progress.watchedCount,
				totalEpisodes: progress.totalEpisodes,
				percentage: progress.percentage,
				seriesId: progress.series.Id
			}))
			.sort((a, b) => {
				// Primary sort: completion percentage (highest first)
				const percentageDiff = b.percentage - a.percentage;
				if (percentageDiff !== 0) {
					return percentageDiff;
				}
				// Tiebreaker: episode count (most episodes first)
				return b.totalEpisodes - a.totalEpisodes;
			})
			.slice(0, 5);

		return {
			seriesStarted,
			seriesWatched,
			episodesWatched,
			moviesWatched,
			topShows
		};
	}

	async function updateProgressStatistics(progressData) {
		const stats = await calculateProgressStatistics(progressData);
		
		// Update stat cards
		const seriesStartedEl = getElementByIdSafe('stat-series-started');
		const seriesWatchedEl = getElementByIdSafe('stat-series-watched');
		const episodesWatchedEl = getElementByIdSafe('stat-episodes-watched');
		const moviesWatchedEl = getElementByIdSafe('stat-movies-watched');
		
		if (seriesStartedEl) seriesStartedEl.textContent = stats.seriesStarted.toLocaleString();
		if (seriesWatchedEl) seriesWatchedEl.textContent = stats.seriesWatched.toLocaleString();
		if (episodesWatchedEl) episodesWatchedEl.textContent = stats.episodesWatched.toLocaleString();
		if (moviesWatchedEl) moviesWatchedEl.textContent = stats.moviesWatched.toLocaleString();
		
		// Update top shows list
		updateTopShowsList(stats.topShows);
		
		LOG(`Statistics updated: ${stats.seriesStarted} started, ${stats.seriesWatched} watched, ${stats.episodesWatched} episodes, ${stats.moviesWatched} movies`);
	}

	function updateTopShowsList(topShows) {
		const topShowsList = getElementByIdSafe('top-shows-list');
		if (!topShowsList) return;
		
		if (topShows.length === 0) {
			topShowsList.innerHTML = '<div class="top-show-item"><div class="top-show-name">No shows watched yet</div></div>';
			return;
		}
		
		const showsHtml = topShows.map((show, index) => {
			const rank = index + 1;
			const episodesText = show.episodesWatched === 1 ? 'episode' : 'episodes';
			
			return `
				<div class="top-show-item">
					<div class="show-rank">${rank}</div>
					<div class="top-show-name" title="${show.name}">${show.name}</div>
					<div class="top-show-episodes">${show.episodesWatched} of ${show.totalEpisodes} ${episodesText} (${show.percentage}%)</div>
				</div>
			`;
		}).join('');
		
		topShowsList.innerHTML = showsHtml;
	}

	function updateProgressStats() {
		const progressCountEl = getElementByIdSafe('progress-count');
		const completedCountEl = getElementByIdSafe('completed-count');
		
		if (!progressCountEl || !completedCountEl) return;
		
		// Always use full, non-filtered progress data for stats
		const fullData = progressCache.data;
		
		// Calculate counts
		let inProgressCount = 0;
		let completedCount = 0;
		
		fullData.forEach(progress => {
			if (progress.percentage >= 100) {
				completedCount++;
			} else if (progress.percentage > 0) {
				inProgressCount++;
			}
		});
		
		// Update the display
		progressCountEl.textContent = `${inProgressCount} In Progress`;
		completedCountEl.textContent = `${completedCount} Watched`;
		
		LOG(`Progress stats updated: ${inProgressCount} in progress, ${completedCount} completed (from full dataset)`);
	}

	async function renderProgressContent() {
		if (tabStates.progress.isRendering) {
			return;
		}

		tabStates.progress.isRendering = true;

		const watchlistSection = getWatchlistSection();
		const progressTab = watchlistSection ? watchlistSection.querySelector('div[data-tab="progress"]') : null;
		const paginatedContainer = progressTab ? progressTab.querySelector('.paginated-container') : null;
		const container = paginatedContainer ? paginatedContainer.querySelector('.progress-series') : null;

		if (!container) {
			WARN("Progress container not found");
			return;
		}

		try {
			// Check if we're currently fetching data or data hasn't been fetched yet
			if (tabStates.progress.isFetching || !tabStates.progress.isDataFetched) {
				hideEmptyProgressMessage();
				container.innerHTML = '<div class="loading-message"><div class="loading-spinner"></div><div>Loading progress data...</div></div>';
				return;
			}

			// Get current page and search term from URL
			const params = getUrlParams();
			const currentPage = (params.pageTab === 'progress') ? 
				(params.page || 1) : 
				(progressCache.currentPage || 1);
			const searchTerm = params.search || '';
			
			// Get progress data for current page from preloaded data
			const pageProgress = await fetchProgressForPage(currentPage);

			const searchInput = getElementByIdSafe('progress-search');
			if (searchInput && params.pageTab === 'progress') {
				searchInput.value = searchTerm;
			}
			
			// Check if we should skip rendering
			if (shouldSkipRendering('progress', currentPage, searchTerm, container, pageProgress)) {
				LOG(`Skipping progress render - same page (${currentPage}), search ("${searchTerm}"), and content`);
				// Still need to ensure pagination controls are rendered
				const totalPages = progressCache.searchTerm ? progressCache.filteredPages : progressCache.totalPages;
				if (totalPages > 1) {
					renderPaginationControls(currentPage, totalPages, 'progress');
				}
				return;
			}
			
			// Restore search state if URL has search parameter
			if (searchTerm && searchTerm !== progressCache.searchTerm) {
				const clearBtn = getElementByIdSafe('progress-search-clear');
				
				if (searchInput) {
					searchInput.value = searchTerm;
					updateSearchResults(searchTerm);
					
					if (clearBtn) {
						clearBtn.style.display = 'flex';
					}
				}
			}
			
			LOG(`Rendering progress content for page ${currentPage}`);

			// Ensure we have all progress data loaded
			await fetchAllProgressData(true);

			// Get total pages from current data (filtered if searching)
			const totalPages = getCurrentTotalPages();
			
			// Update statistics with all progress data (not just current page)
			updateProgressStatistics(progressCache.data);
			
			if (!pageProgress || pageProgress.length === 0) {
				// Hide any existing content and show appropriate empty message
				container.innerHTML = '';
				if (progressCache.searchTerm && progressCache.searchTerm.trim() !== '') {
					showEmptySearchMessage();
				} else {
					showEmptyProgressMessage();
				}
				return;
			}

			// Hide empty message and clear container
			hideEmptyProgressMessage();
			container.innerHTML = '';
			
			// Create progress cards asynchronously
			for (const progress of pageProgress) {
				const progressCard = await createProgressCard(progress);
				container.appendChild(progressCard);
			}

			// Update progress stats
			updateProgressStats();

			// Add pagination controls to both top and bottom
			renderPaginationControls(currentPage, totalPages, 'progress');

			// Update cache currentPage
			progressCache.currentPage = currentPage;
			
			// Update tab state after successful render
			updateTabState('progress', currentPage, searchTerm);

			LOG(`Rendered ${pageProgress.length} progress items for page ${currentPage} of ${totalPages}`);
		} catch (err) {
			ERR('Error rendering progress content:', err);
			// Clear container and show empty message on error
			container.innerHTML = '';
			clearTabState('progress');
			showEmptyProgressMessage();
		} finally {
			tabStates.progress.isRendering = false;
		}
	}

	// Centralized pagination system
	function createPaginationSystem(cache) {
		return {
			isCacheValid: () => cache.data.length > 0,
			
			clearCache: () => {
				cache.data = [];
				cache.filteredData = [];
				cache.totalPages = 0;
				cache.sorted = false;
				cache.searchTerm = '';
				cache.filteredPages = 0;
				cache.allDataLoaded = false;
				LOG('Cache cleared');
			},
			
			updateCache: (data) => {
				cache.data = data;
				cache.totalPages = Math.ceil(data.length / cache.pageSize);
				cache.sorted = true;
				cache.allDataLoaded = true;
				LOG(`Cache updated: ${data.length} items, ${cache.totalPages} pages`);
			},
			
			getCurrentData: () => {
				return cache.searchTerm ? cache.filteredData : cache.data;
			},
			
			getCurrentTotalPages: () => {
				return cache.searchTerm ? cache.filteredPages : cache.totalPages;
			},
			
			getCachedPage: (page = 1) => {
				const currentData = cache.searchTerm ? cache.filteredData : cache.data;
				const totalPages = cache.searchTerm ? cache.filteredPages : cache.totalPages;
				
				const startIndex = (page - 1) * cache.pageSize;
				const endIndex = startIndex + cache.pageSize;
				const pageData = currentData.slice(startIndex, endIndex);
				
				LOG(`Retrieved page ${page}: ${pageData.length} items (${startIndex}-${endIndex}) from ${currentData.length} total`);
				return { pageData, totalPages, currentPage: page };
			}
		};
	}

	// Create pagination systems
	const progressPagination = createPaginationSystem(progressCache);
	const moviePagination = createPaginationSystem(movieCache);

	// Watchlist cache for different sections
	const watchlistCache = {
		movies: { data: [] },
		series: { data: [] },
		seasons: { data: [] },
		episodes: { data: [] }
	};

	// Function to render the complete watchlist HTML structure
	function renderWatchlistHtml() {
		const watchlistSection = getWatchlistSection();
		if (!watchlistSection) {
			WARN('Watchlist section not found, cannot render HTML');
			return;
		}

		// Check if HTML is already rendered
		if (watchlistSection.dataset.htmlRendered === 'true') {
			LOG('Watchlist HTML already rendered, skipping');
			return;
		}

		LOG('Rendering watchlist HTML structure');

		watchlistSection.innerHTML = `
			<div class="watchlist-tabs">
				<button data-tab="watchlist">Watchlist</button>
				<button data-tab="progress">Series Progress</button>
				<button data-tab="history">Movie History</button>
				<button data-tab="statistics">Statistics</button>
			</div>
			
		<div data-tab="watchlist" data-layout="Default">
			<div class="watchlist-header tab-header">
				<h2>My Watchlist</h2>
				<div class="watchlist-header-right">
					<div class="watchlist-header-stats-container">
						<div class="watchlist-header-stats" id="watchlist-stats-shows" style="display: none;">
							<span id="watchlist-shows-count">0 Shows</span>
						</div>
						<div class="watchlist-header-stats" id="watchlist-stats-seasons" style="display: none;">
							<span id="watchlist-seasons-count">0 Seasons</span>
						</div>
						<div class="watchlist-header-stats" id="watchlist-stats-episodes" style="display: none;">
							<span id="watchlist-episodes-count">0 Episodes</span>
						</div>
						<div class="watchlist-header-stats" id="watchlist-stats-movies" style="display: none;">
							<span id="watchlist-movies-count">0 Movies</span>
						</div>
					</div>
					<button class="layout-toggle-btn" id="watchlist-layout-toggle" title="Toggle layout">
						<span class="material-icons view_module"></span>
					</button>
				</div>
			</div>
			<div class="watchlist-movies"></div>
			<div class="watchlist-series"></div>
			<div class="watchlist-seasons"></div>
			<div class="watchlist-episodes"></div>
			<div class="watchlist-empty-message" style="display: none;">
				<div class="empty-message-icon">
					<span class="material-icons bookmark_border"></span>
				</div>
				<div class="empty-message-title">Your Watchlist is Empty</div>
				<div class="empty-message-subtitle">Click the <span class="material-icons bookmark_border"></span> to add movies and shows to your watchlist</div>
			</div>
		</div>
			
			<div data-tab="progress">
				<div class="progress-tab-header tab-header">
					<h2>Series Progress</h2>
					<div class="progress-header-stats-container">
						<div class="progress-header-stats">
							<span id="completed-count">0 Watched</span>
						</div>
						<div class="progress-header-stats">
							<span id="progress-count">0 In Progress</span>
						</div>
					</div>
				</div>
				<div class="search-container">
					<div class="search-input-wrapper">
						<span class="material-icons search-icon search"></span>
						<input type="text" id="progress-search" class="search-input" placeholder="Search shows..." />
						<button class="search-clear-btn" id="progress-search-clear" style="display: none;">
							<span class="material-icons close"></span>
						</button>
					</div>
				</div>
				<div class="paginated-container">
					<div class="progress-series"></div>
				</div>
				<div class="progress-empty-message" style="display: none;">
					<div class="empty-message-icon">
						<span class="material-icons acute"></span>
					</div>
					<div class="empty-message-title">No Progress to Show</div>
					<div class="empty-message-subtitle">Start watching some shows to track your progress here</div>
				</div>
			</div>
			
			<div data-tab="history">
				<div class="movie-history-header tab-header">
					<h2>Movie Watched History</h2>
					<div class="movie-history-stats-container">
						<div class="movie-history-stats">
							<span id="movie-count">0 Watched</span>
						</div>
					</div>
				</div>
				<div class="search-container">
					<div class="search-input-wrapper">
						<span class="material-icons search-icon search"></span>
						<input type="text" id="movie-search" placeholder="Search movies..." class="search-input">
						<button class="search-clear-btn" id="movie-search-clear" style="display: none;">
							<span class="material-icons close"></span>
						</button>
					</div>
				</div>
				<div class="paginated-container">
					<div class="movie-history-grid" id="movie-history-grid">
						<!-- Movie cards will be populated here -->
					</div>
				</div>
				<div class="movie-history-empty-message" style="display: none;">
					<div class="empty-message-icon">
						<span class="material-icons movie"></span>
					</div>
					<div class="empty-message-title">No Movies Watched</div>
					<div class="empty-message-subtitle">Start watching some movies to see your history here</div>
				</div>
			</div>
			
			<div data-tab="statistics" data-ready="false">
				<div class="loading-container">
					<div class="loading-message">
						<div class="loading-spinner"></div>
						<div>Loading statistics data...</div>
					</div>
				</div>
				<div class="progress-stats-container">
					<div class="progress-stats-grid">
						<div class="stat-card">
							<div class="stat-icon">
								<span class="material-icons play_circle"></span>
							</div>
							<div class="stat-content">
								<div class="stat-value" id="stat-series-started">0</div>
								<div class="stat-label">Series Started</div>
							</div>
						</div>
						<div class="stat-card">
							<div class="stat-icon">
								<span class="material-icons check_circle_outline"></span>
							</div>
							<div class="stat-content">
								<div class="stat-value" id="stat-series-watched">0</div>
								<div class="stat-label">Series Watched</div>
							</div>
						</div>
						<div class="stat-card">
							<div class="stat-icon">
								<span class="material-icons tv"></span>
							</div>
							<div class="stat-content">
								<div class="stat-value" id="stat-episodes-watched">0</div>
								<div class="stat-label">Episodes Watched</div>
							</div>
						</div>
						<div class="stat-card">
							<div class="stat-icon">
								<span class="material-icons movie"></span>
							</div>
							<div class="stat-content">
								<div class="stat-value" id="stat-movies-watched">0</div>
								<div class="stat-label">Movies Watched</div>
							</div>
						</div>
					</div>
					<div class="top-shows-container">
						<div class="top-shows-header">
							<span class="material-icons star"></span>
							<span>Top 5 Shows</span>
							<button class="show-all-btn" id="show-all-shows-btn" title="View all watched shows">
								<span class="material-icons list"></span>
								<span>Show All</span>
							</button>
						</div>
						<div class="top-shows-list" id="top-shows-list">
							<!-- Top shows will be populated here -->
						</div>
					</div>
				</div>
			</div>
		`;

		// Mark as rendered to prevent duplicate rendering
		watchlistSection.dataset.htmlRendered = 'true';
		// Reset listeners setup flag since we have new DOM elements
		watchlistSection.dataset.listenersSetup = 'false';

		// Add refresh buttons after HTML is rendered
		addRefreshButtons();
		
		LOG('Watchlist HTML structure rendered successfully');
	}

	/************ Import/Export Functions ************/

	// Show import/export modal
	function showImportExportModal() {
		const modalContent = document.createElement('div');
		modalContent.className = 'import-export-modal-content';
		modalContent.style.minWidth = '500px';
		modalContent.style.maxWidth = '800px';

		// Create tab buttons
		const tabContainer = document.createElement('div');
		tabContainer.className = 'import-export-tabs';
		tabContainer.style.display = 'flex';
		tabContainer.style.gap = '8px';
		tabContainer.style.marginBottom = '20px';
		tabContainer.style.borderBottom = '1px solid rgba(255, 255, 255, 0.1)';

		const exportTabBtn = document.createElement('button');
		exportTabBtn.className = 'import-export-tab active';
		exportTabBtn.textContent = 'Export';
		exportTabBtn.style.cssText = 'flex: 1; padding: 12px; background: transparent; border: none; border-bottom: 2px solid #00a4dc; color: rgba(255, 255, 255, 0.7); cursor: pointer; font-size: 14px; font-weight: 500;';
		
		const importTabBtn = document.createElement('button');
		importTabBtn.className = 'import-export-tab';
		importTabBtn.textContent = 'Import';
		importTabBtn.style.cssText = 'flex: 1; padding: 12px; background: transparent; border: none; border-bottom: 2px solid transparent; color: rgba(255, 255, 255, 0.7); cursor: pointer; font-size: 14px; font-weight: 500;';

		const syncTabBtn = document.createElement('button');
		syncTabBtn.className = 'import-export-tab';
		syncTabBtn.textContent = 'Playlist Sync';
		syncTabBtn.style.cssText = 'flex: 1; padding: 12px; background: transparent; border: none; border-bottom: 2px solid transparent; color: rgba(255, 255, 255, 0.7); cursor: pointer; font-size: 14px; font-weight: 500;';

		// Tab content container
		const tabContent = document.createElement('div');
		tabContent.className = 'import-export-tab-content';
		tabContent.style.minHeight = '400px';

		// Active tab state
		let activeTab = 'export';

		// Store exported data to preserve across tab switches
		let savedExportData = '';

		// Playlist sync cache so we only fetch once per modal open
		let playlistSyncState = {
			playlists: null,
			isLoading: false
		};

		// Tab switching
		const switchTab = (tab) => {
			// Save export data before clearing
			if (activeTab === 'export') {
				const exportTextarea = tabContent.querySelector('#export-textarea');
				if (exportTextarea) {
					savedExportData = exportTextarea.value;
				}
			}

			activeTab = tab;
			exportTabBtn.classList.toggle('active', tab === 'export');
			importTabBtn.classList.toggle('active', tab === 'import');
			syncTabBtn.classList.toggle('active', tab === 'sync');
			exportTabBtn.style.borderBottomColor = tab === 'export' ? '#00a4dc' : 'transparent';
			exportTabBtn.style.color = tab === 'export' ? '#fff' : 'rgba(255, 255, 255, 0.7)';
			importTabBtn.style.borderBottomColor = tab === 'import' ? '#00a4dc' : 'transparent';
			importTabBtn.style.color = tab === 'import' ? '#fff' : 'rgba(255, 255, 255, 0.7)';
			syncTabBtn.style.borderBottomColor = tab === 'sync' ? '#00a4dc' : 'transparent';
			syncTabBtn.style.color = tab === 'sync' ? '#fff' : 'rgba(255, 255, 255, 0.7)';
			
			tabContent.innerHTML = '';
			if (tab === 'export') {
				renderExportTab(tabContent, savedExportData, (newData) => {
					savedExportData = newData;
				});
			} else if (tab === 'import') {
				renderImportTab(tabContent);
			} else if (tab === 'sync') {
				renderPlaylistSyncTab(tabContent, playlistSyncState);
			}
		};

		exportTabBtn.onclick = () => switchTab('export');
		importTabBtn.onclick = () => switchTab('import');
		syncTabBtn.onclick = () => switchTab('sync');

		tabContainer.appendChild(exportTabBtn);
		tabContainer.appendChild(importTabBtn);
		tabContainer.appendChild(syncTabBtn);
		modalContent.appendChild(tabContainer);
		modalContent.appendChild(tabContent);

		// Render default tab (export)
		renderExportTab(tabContent, savedExportData, (newData) => {
			savedExportData = newData;
		});

		// Create modal
		const modal = window.ModalSystem.create({
			id: 'import-export-modal',
			content: modalContent,
			closeOnBackdrop: true,
			closeOnEscape: true
		});
	}

	// Render export tab
	function renderExportTab(container, savedData = '', updateSavedData = null) {
		container.innerHTML = '';

		const description = document.createElement('p');
		description.style.cssText = 'color: rgba(255, 255, 255, 0.7); margin-bottom: 20px; font-size: 14px; line-height: 1.5;';
		description.textContent = 'Export your watchlist to a JSON file. The export includes item names and provider IDs (IMDb, TMDB, TVDB).';
		container.appendChild(description);

		const exportBtn = document.createElement('button');
		exportBtn.className = 'emby-button emby-button-raised button-submit';
		exportBtn.textContent = 'Export Watchlist';
		exportBtn.style.cssText = 'margin-bottom: 20px;';
		exportBtn.style.alignSelf = 'flex-start';
		
		const textarea = document.createElement('textarea');
		textarea.id = 'export-textarea';
		textarea.readOnly = true;
		textarea.style.cssText = 'width: 100%; min-height: 300px; padding: 12px; background: rgba(0, 0, 0, 0.3); border: 1px solid rgba(255, 255, 255, 0.2); border-radius: 4px; color: #fff; font-family: monospace; font-size: 12px; resize: vertical; box-sizing: border-box;';
		textarea.placeholder = 'Exported watchlist data will appear here...';
		// Preserve saved data if switching tabs
		if (savedData) {
			textarea.value = savedData;
		}
		container.appendChild(exportBtn);
		container.appendChild(textarea);

		const buttonContainer = document.createElement('div');
		buttonContainer.style.cssText = 'display: flex; gap: 10px; margin-top: 10px;';
		
		const copyBtn = document.createElement('button');
		copyBtn.className = 'emby-button';
		copyBtn.textContent = 'Copy to Clipboard';
		copyBtn.style.cssText = 'padding: 8px 16px; background: rgba(255, 255, 255, 0.1); color: white; border: 1px solid rgba(255, 255, 255, 0.2); border-radius: 4px; cursor: pointer; font-size: 14px;';
		// Enable copy button if there's saved content
		copyBtn.disabled = !savedData;

		copyBtn.onclick = async () => {
			try {
				await navigator.clipboard.writeText(textarea.value);
				copyBtn.textContent = 'Copied!';
				setTimeout(() => {
					copyBtn.textContent = 'Copy to Clipboard';
				}, 2000);
			} catch (err) {
				ERR('Failed to copy to clipboard:', err);
				alert('Failed to copy to clipboard. Please copy manually.');
			}
		};

		buttonContainer.appendChild(copyBtn);
		container.appendChild(buttonContainer);

		exportBtn.onclick = async () => {
			exportBtn.disabled = true;
			exportBtn.textContent = 'Exporting...';
			textarea.value = '';

			try {
				const exportData = await exportWatchlistData();
				const jsonString = JSON.stringify(exportData, null, 2);
				textarea.value = jsonString;
				// Update saved data so it persists across tab switches
				if (updateSavedData) {
					updateSavedData(jsonString);
				}
				copyBtn.disabled = false;
				exportBtn.disabled = false;
				exportBtn.textContent = 'Export Watchlist';
			} catch (err) {
				ERR('Export failed:', err);
				textarea.value = `Error exporting watchlist: ${err.message}`;
				// Clear saved data on error
				if (updateSavedData) {
					updateSavedData('');
				}
				exportBtn.disabled = false;
				exportBtn.textContent = 'Export Watchlist';
			}
		};
	}

	// Render import tab
	function renderImportTab(container) {
		container.innerHTML = '';

		const description = document.createElement('p');
		description.style.cssText = 'color: rgba(255, 255, 255, 0.7); margin-bottom: 20px; font-size: 14px; line-height: 1.5;';
		description.textContent = 'Paste your watchlist JSON data below. Each item must have at least one provider ID (IMDb, TMDB, or TVDB).';
		container.appendChild(description);

		const textarea = document.createElement('textarea');
		textarea.id = 'import-textarea';
		textarea.style.cssText = 'width: 100%; min-height: 200px; padding: 12px; background: rgba(0, 0, 0, 0.3); border: 1px solid rgba(255, 255, 255, 0.2); border-radius: 4px; color: #fff; font-family: monospace; font-size: 12px; resize: vertical; box-sizing: border-box; margin-bottom: 10px;';
		textarea.placeholder = 'Paste your watchlist JSON data here...';
		container.appendChild(textarea);

		const validationMsg = document.createElement('div');
		validationMsg.id = 'import-validation';
		validationMsg.style.cssText = 'margin-bottom: 10px; padding: 10px; border-radius: 4px; font-size: 13px; display: none;';
		container.appendChild(validationMsg);

		const previewContainer = document.createElement('div');
		previewContainer.id = 'import-preview';
		previewContainer.style.cssText = 'margin-bottom: 10px; max-height: 200px; overflow-y: auto; display: none;';
		container.appendChild(previewContainer);

		const progressContainer = document.createElement('div');
		progressContainer.id = 'import-progress';
		progressContainer.style.cssText = 'margin-bottom: 10px; display: none;';
		container.appendChild(progressContainer);

		const summaryContainer = document.createElement('div');
		summaryContainer.id = 'import-summary';
		summaryContainer.style.cssText = 'margin-bottom: 10px; padding: 10px; border-radius: 4px; display: none;';
		container.appendChild(summaryContainer);

		const buttonContainer = document.createElement('div');
		buttonContainer.style.cssText = 'display: flex; gap: 10px; margin-top: 10px;';

		const validateBtn = document.createElement('button');
		validateBtn.className = 'emby-button';
		validateBtn.textContent = 'Validate & Preview';
		validateBtn.style.cssText = 'padding: 8px 16px; background: rgba(255, 255, 255, 0.1); color: white; border: 1px solid rgba(255, 255, 255, 0.2); border-radius: 4px; cursor: pointer; font-size: 14px;';

		const importBtn = document.createElement('button');
		importBtn.className = 'emby-button emby-button-raised button-submit';
		importBtn.textContent = 'Import Watchlist';
		importBtn.disabled = true;
		importBtn.style.display = 'none'; // Hide until validated

		const clearBtn = document.createElement('button');
		clearBtn.className = 'emby-button';
		clearBtn.textContent = 'Clear Watchlist';
		clearBtn.style.cssText = 'padding: 8px 16px; background: rgba(255, 0, 0, 0.2); color: #ff6b6b; border: 1px solid rgba(255, 0, 0, 0.3); border-radius: 4px; cursor: pointer; font-size: 14px; margin-left: auto;';

		buttonContainer.appendChild(validateBtn);
		buttonContainer.appendChild(importBtn);
		buttonContainer.appendChild(clearBtn);
		container.appendChild(buttonContainer);

		let validatedData = null;

		validateBtn.onclick = () => {
			const jsonText = textarea.value.trim();
			if (!jsonText) {
				showValidationMessage(validationMsg, 'Please paste JSON data first.', 'error');
				return;
			}

			// Hide progress container when validating
			progressContainer.style.display = 'none';
			summaryContainer.style.display = 'none';

			try {
				const data = JSON.parse(jsonText);
				const validation = validateImportData(data);
				
				if (validation.valid) {
					validatedData = data;
					showValidationMessage(validationMsg, validation.message, 'success');
					showPreview(previewContainer, data);
					importBtn.disabled = false;
					importBtn.style.display = ''; // Show button when validated
				} else {
					validatedData = null;
					showValidationMessage(validationMsg, validation.message, 'error');
					previewContainer.style.display = 'none';
					importBtn.disabled = true;
					importBtn.style.display = 'none'; // Hide button on validation failure
				}
			} catch (err) {
				validatedData = null;
				showValidationMessage(validationMsg, `Invalid JSON: ${err.message}`, 'error');
				previewContainer.style.display = 'none';
				importBtn.disabled = true;
				importBtn.style.display = 'none'; // Hide button on parse error
			}
		};

		importBtn.onclick = async () => {
			if (!validatedData) {
				showValidationMessage(validationMsg, 'Please validate the data first.', 'error');
				return;
			}

			importBtn.disabled = true;
			validateBtn.disabled = true;
			clearBtn.disabled = true;
			summaryContainer.style.display = 'none';
			
			// Show progress container immediately at 0/X items
			progressContainer.style.display = 'block';
			showImportProgress(progressContainer, 0, validatedData.length, 'Starting import...');

			try {
				const results = await importWatchlistData(validatedData, progressContainer);
				showImportSummary(summaryContainer, results);
				summaryContainer.style.display = 'block';
				
				// Refresh watchlist
				await initWatchlistTab();
				renderWatchlistContent();
			} catch (err) {
				ERR('Import failed:', err);
				showValidationMessage(validationMsg, `Import failed: ${err.message}`, 'error');
			} finally {
				importBtn.disabled = false;
				validateBtn.disabled = false;
				clearBtn.disabled = false;
			}
		};

		clearBtn.onclick = async () => {
			if (confirm('Are you sure you want to clear your entire watchlist? This action cannot be undone.')) {
				if (confirm('This will remove ALL items from your watchlist. Are you absolutely sure?')) {
					clearBtn.disabled = true;
					clearBtn.textContent = 'Clearing...';
					try {
						await clearWatchlist();
						// Close modal after clearing
						window.ModalSystem.close('import-export-modal');
					} catch (err) {
						ERR('Failed to clear watchlist:', err);
						alert('Failed to clear watchlist. Please try again.');
					} finally {
						clearBtn.disabled = false;
						clearBtn.textContent = 'Clear Watchlist';
					}
				}
			}
		};
	}

	const PLAYLIST_SYNC_DEFAULT_NAME = '| Watchlist |';
	const PLAYLIST_SYNC_CHUNK_SIZE = 75;

	function renderPlaylistSyncTab(container, state = { playlists: null, isLoading: false }) {
		container.innerHTML = '';

		const description = document.createElement('p');
		description.style.cssText = 'color: rgba(255, 255, 255, 0.7); margin-bottom: 20px; font-size: 14px; line-height: 1.5;';
		description.textContent = 'Sync your watchlist directly to a Jellyfin playlist. We will overwrite the playlist with the items currently on your watchlist.';
		container.appendChild(description);

		const selectGroup = document.createElement('div');
		selectGroup.style.cssText = 'display: flex; flex-direction: column; gap: 6px; margin-bottom: 20px;';

		const selectLabel = document.createElement('label');
		selectLabel.textContent = 'Choose Playlist';
		selectLabel.style.cssText = 'font-weight: 600; color: #fff;';
		selectGroup.appendChild(selectLabel);

		const playlistSelect = document.createElement('select');
		playlistSelect.id = 'playlist-sync-select';
		playlistSelect.style.cssText = 'padding: 10px; border-radius: 4px; border: 1px solid rgba(255, 255, 255, 0.2); background: rgba(0, 0, 0, 0.3); color: #fff;';
		playlistSelect.disabled = true;
		selectGroup.appendChild(playlistSelect);

		const selectHint = document.createElement('div');
		selectHint.style.cssText = 'font-size: 12px; color: rgba(255, 255, 255, 0.6);';
		selectHint.textContent = 'Default: | Watchlist |. Choose "New..." to create a fresh playlist.';
		selectGroup.appendChild(selectHint);

		container.appendChild(selectGroup);

		const buttonRow = document.createElement('div');
		buttonRow.style.cssText = 'display: flex; gap: 10px; align-items: center;';

		const syncBtn = document.createElement('button');
		syncBtn.className = 'emby-button raised button-submit';
		syncBtn.textContent = 'Sync Playlist';
		syncBtn.disabled = true;

		const refreshBtn = document.createElement('button');
		refreshBtn.className = 'emby-button raised';
		refreshBtn.textContent = 'Refresh List';

		buttonRow.appendChild(syncBtn);
		buttonRow.appendChild(refreshBtn);

		container.appendChild(buttonRow);

		const statusMsg = document.createElement('div');
		statusMsg.style.cssText = 'margin-top: 15px; font-size: 13px; display: none;';
		container.appendChild(statusMsg);

		const loadingText = document.createElement('div');
		loadingText.style.cssText = 'margin-top: 10px; font-size: 13px; color: rgba(255, 255, 255, 0.6);';
		container.appendChild(loadingText);

		const setStatus = (message, type = 'info') => {
			if (!message) {
				statusMsg.style.display = 'none';
				statusMsg.textContent = '';
				return;
			}
			statusMsg.style.display = 'block';
			statusMsg.textContent = message;
			if (type === 'error') {
				statusMsg.style.color = '#ff6b6b';
			} else if (type === 'success') {
				statusMsg.style.color = '#4caf50';
			} else {
				statusMsg.style.color = 'rgba(255, 255, 255, 0.7)';
			}
		};

		const setLoading = (isLoading, message = 'Loading playlists...') => {
			state.isLoading = isLoading;
			playlistSelect.disabled = isLoading;
			refreshBtn.disabled = isLoading;
			syncBtn.disabled = isLoading || !playlistSelect.value;
			loadingText.textContent = isLoading ? message : '';
		};

		const populateSelect = (playlists = []) => {
			playlistSelect.innerHTML = '';
			const newOption = document.createElement('option');
			newOption.value = '__new__';
			newOption.textContent = 'New...';
			playlistSelect.appendChild(newOption);

			playlists
				.sort((a, b) => a.Name.localeCompare(b.Name))
				.forEach(playlist => {
					const option = document.createElement('option');
					option.value = playlist.Id;
					option.textContent = `${playlist.Name} (${playlist.ChildCount || 0})`;
					playlistSelect.appendChild(option);
				});

			const defaultPlaylist = playlists.find(pl => pl.Name === PLAYLIST_SYNC_DEFAULT_NAME);
			if (defaultPlaylist) {
				playlistSelect.value = defaultPlaylist.Id;
			} else {
				playlistSelect.value = '__new__';
			}

			playlistSelect.disabled = false;
			syncBtn.disabled = false;
		};

		const loadPlaylists = async (force = false) => {
			if (state.isLoading) return;
			try {
				setStatus('');
				setLoading(true);
				if (!force && state.playlists && state.playlists.length) {
					populateSelect(state.playlists);
					return;
				}
				const playlists = await fetchUserPlaylistsForSync();
				state.playlists = playlists;
				if (!playlists.length) {
					setStatus('No playlists found. Use the "New..." option to create one from your watchlist.', 'info');
				}
				populateSelect(playlists);
			} catch (err) {
				ERR('Failed to load playlists:', err);
				setStatus(`Failed to load playlists: ${err.message}`, 'error');
				playlistSelect.innerHTML = '';
				const loadingOption = document.createElement('option');
				loadingOption.textContent = 'Unable to load playlists';
				playlistSelect.appendChild(loadingOption);
				playlistSelect.disabled = true;
				syncBtn.disabled = true;
			} finally {
				setLoading(false);
			}
		};

		const getSelectedPlaylist = () => {
			if (playlistSelect.value === '__new__') {
				return { isNew: true, playlist: null };
			}
			const playlist = state.playlists?.find(pl => pl.Id === playlistSelect.value);
			return { isNew: false, playlist };
		};

		playlistSelect.addEventListener('change', () => {
			setStatus('');
			syncBtn.disabled = state.isLoading || !playlistSelect.value;
		});

		refreshBtn.addEventListener('click', () => loadPlaylists(true));

		syncBtn.addEventListener('click', () => {
			const selection = getSelectedPlaylist();
			if (!selection.isNew && !selection.playlist) {
				setStatus('Please select a playlist or choose "New...".', 'error');
				return;
			}
			openPlaylistSyncConfirmation({
				isNew: selection.isNew,
				playlist: selection.playlist,
				onSuccess: (message) => {
					setStatus(message || 'Playlist synced successfully.', 'success');
					loadPlaylists(true);
				}
			});
		});

		loadPlaylists();
	}

	async function fetchUserPlaylistsForSync() {
		const apiClient = window.ApiClient;
		const userId = apiClient.getCurrentUserId();
		const serverUrl = apiClient.serverAddress();
		const token = apiClient.accessToken();

		const url = `${serverUrl}/Users/${userId}/Items?IncludeItemTypes=Playlist&Recursive=true&Fields=ChildCount`;
		const response = await fetch(url, {
			headers: {
				'Authorization': `MediaBrowser Token="${token}"`
			}
		});

		if (!response.ok) {
			throw new Error(`HTTP ${response.status}: ${response.statusText}`);
		}

		const data = await response.json();
		return data.Items || [];
	}

	function openPlaylistSyncConfirmation({ isNew, playlist, onSuccess }) {
		if (!window.ModalSystem) {
			alert('Modal system not available');
			return;
		}

		const modalId = 'playlist-sync-confirm-modal';
		window.ModalSystem.close(modalId);

		const modalContent = document.createElement('div');
		modalContent.style.cssText = 'display: flex; flex-direction: column; gap: 15px;';

		const message = document.createElement('p');
		message.style.cssText = 'color: rgba(255, 255, 255, 0.8); line-height: 1.5;';

		let nameInput = null;
		let title = 'Sync Playlist';

		if (isNew) {
			title = 'Create Playlist From Watchlist';
			message.textContent = 'A new playlist will be created containing the items currently on your watchlist.';

			nameInput = document.createElement('input');
			nameInput.type = 'text';
			nameInput.className = 'emby-input';
			nameInput.placeholder = 'Playlist name';
			nameInput.value = PLAYLIST_SYNC_DEFAULT_NAME;
			nameInput.style.cssText = 'padding: 10px; border-radius: 4px; border: 1px solid rgba(255, 255, 255, 0.2); background: rgba(0, 0, 0, 0.3); color: #fff;';

			modalContent.appendChild(message);
			modalContent.appendChild(nameInput);
		} else {
			title = 'Sync Existing Playlist';
			message.textContent = 'This will set the items in the playlist to be the items in your watchlist. Any items on this playlist which are not in your watchlist will be removed.';
			const playlistInfo = document.createElement('div');
			playlistInfo.style.cssText = 'padding: 10px; border-radius: 4px; background: rgba(255, 255, 255, 0.05); color: rgba(255, 255, 255, 0.9);';
			playlistInfo.textContent = `Playlist: ${playlist?.Name || 'Unknown'}`;
			modalContent.appendChild(message);
			modalContent.appendChild(playlistInfo);
		}

		const modal = window.ModalSystem.create({
			id: modalId,
			title,
			content: modalContent,
			closeOnBackdrop: true,
			closeOnEscape: true,
			footer: `
				<button class="emby-button raised button-submit" id="playlistSyncConfirmBtn">
					<span>Confirm</span>
				</button>
				<button class="emby-button raised" id="playlistSyncCancelBtn">
					<span>Cancel</span>
				</button>
			`,
			onOpen: (modalInstance) => {
				const confirmBtn = modalInstance.dialogFooter?.querySelector('#playlistSyncConfirmBtn');
				const cancelBtn = modalInstance.dialogFooter?.querySelector('#playlistSyncCancelBtn');

				const setError = (message) => {
					if (message) {
						const errorMsg = document.createElement('div');
						errorMsg.style.cssText = 'color: #ff6b6b; font-size: 13px; display: none;';
						modalContent.appendChild(errorMsg);	
						errorMsg.textContent = message;
						errorMsg.style.display = 'block';
					}
				};

				if (cancelBtn) {
					cancelBtn.addEventListener('click', () => modalInstance.close());
				}

				if (confirmBtn) {
					confirmBtn.addEventListener('click', async () => {
						try {
							setError('');
							confirmBtn.disabled = true;
							confirmBtn.querySelector('span').textContent = 'Syncing...';

							const playlistName = isNew ? (nameInput?.value || '').trim() : playlist?.Name;
							if (isNew && !playlistName) {
								setError('Please provide a playlist name.');
								confirmBtn.disabled = false;
								confirmBtn.querySelector('span').textContent = 'Confirm';
								return;
							}

							await syncWatchlistToPlaylist({
								isNew,
								playlistId: playlist?.Id,
								playlistName
							});

							modalInstance.close();
							if (typeof onSuccess === 'function') {
								onSuccess(`Playlist "${playlistName}" now matches your watchlist.`);
							}
							showPlaylistSyncToast(`Playlist "${playlistName}" synced with your watchlist.`);
						} catch (err) {
							ERR('Playlist sync failed:', err);
							setError(err.message || 'Failed to sync playlist.');
						} finally {
							if (confirmBtn) {
								confirmBtn.disabled = false;
								confirmBtn.querySelector('span').textContent = 'Confirm';
							}
						}
					});
				}
			}
		});

		return modal;
	}

	function showPlaylistSyncToast(message) {
		if (window.KefinTweaksToaster && typeof window.KefinTweaksToaster.toast === 'function') {
			window.KefinTweaksToaster.toast(message);
		} else {
			LOG(message);
		}
	}

	function buildPlaylistSyncItems(items = []) {
		if (!Array.isArray(items)) {
			return [];
		}

		const seriesIds = new Set();
		const seasonIds = new Set();

		items.forEach(item => {
			if (!item || !item.Id) return;
			if (item.Type === 'Series') {
				seriesIds.add(item.Id);
			} else if (item.Type === 'Season') {
				seasonIds.add(item.Id);
			}
		});

		const seenIds = new Set();
		const filtered = [];

		items.forEach(item => {
			if (!item || !item.Id) {
				return;
			}

			if (item.Type === 'Episode') {
				const parentSeasonId = item.ParentId || item.SeasonId;
				if ((parentSeasonId && seasonIds.has(parentSeasonId)) || (item.SeriesId && seriesIds.has(item.SeriesId))) {
					return;
				}
			}

			if (seenIds.has(item.Id)) {
				return;
			}

			filtered.push(item);
			seenIds.add(item.Id);
		});

		return filtered;
	}

	async function syncWatchlistToPlaylist({ isNew, playlistId, playlistName }) {
		const apiClient = window.ApiClient;
		const userId = apiClient.getCurrentUserId();
		const serverUrl = apiClient.serverAddress();
		const token = apiClient.accessToken();

		if (!window.apiHelper || typeof window.apiHelper.getWatchlistItems !== 'function') {
			throw new Error('apiHelper is not available.');
		}

		const watchlistItems = await window.apiHelper.getWatchlistItems({
			IncludeItemTypes: 'Movie,Series,Season,Episode',
			Fields: 'ProviderIds'
		}, false);

		const itemsToSync = buildPlaylistSyncItems(watchlistItems.Items || []);
		if (!itemsToSync.length) {
			throw new Error('No eligible watchlist items to sync.');
		}
		const watchlistIds = itemsToSync.map(item => item.Id);

		if (!watchlistIds.length) {
			throw new Error('Your watchlist is empty.');
		}

		if (isNew) {
			await createPlaylistFromWatchlist({
				serverUrl,
				token,
				userId,
				name: playlistName,
				itemIds: watchlistIds
			});
			return;
		}

		if (!playlistId) {
			throw new Error('Playlist ID is required.');
		}

		await replacePlaylistItemsWithWatchlist({
			serverUrl,
			token,
			playlistId,
			itemIds: watchlistIds
		});
	}

	async function createPlaylistFromWatchlist({ serverUrl, token, userId, name, itemIds }) {
		const params = new URLSearchParams({
			Name: name,
			UserId: userId
		});

		const response = await fetch(`${serverUrl}/Playlists?${params.toString()}`, {
			method: 'POST',
			headers: {
				'Authorization': `MediaBrowser Token="${token}"`
			}
		});

		if (!response.ok) {
			throw new Error(`Failed to create playlist (${response.status})`);
		}

		const playlist = await response.json();
		const playlistId = playlist?.Id;
		if (!playlistId) {
			throw new Error('Playlist created but no ID returned.');
		}

		if (itemIds.length) {
			await addItemsToPlaylist({ serverUrl, token, playlistId, itemIds });
		}
	}

	async function replacePlaylistItemsWithWatchlist({ serverUrl, token, playlistId, itemIds }) {
		// Remove existing entries
		const existingItemsResponse = await fetch(`${serverUrl}/Playlists/${playlistId}/Items`, {
			headers: {
				'Authorization': `MediaBrowser Token="${token}"`
			}
		});

		if (!existingItemsResponse.ok) {
			throw new Error(`Failed to fetch existing playlist items (${existingItemsResponse.status})`);
		}

		const existingData = await existingItemsResponse.json();
		const entryIds = (existingData.Items || [])
			.map(item => item.PlaylistItemId)
			.filter(Boolean);

		for (const chunk of chunkArray(entryIds, PLAYLIST_SYNC_CHUNK_SIZE)) {
			const params = new URLSearchParams({
				EntryIds: chunk.join(',')
			});
			const deleteResponse = await fetch(`${serverUrl}/Playlists/${playlistId}/Items?${params.toString()}`, {
				method: 'DELETE',
				headers: {
					'Authorization': `MediaBrowser Token="${token}"`
				}
			});
			if (!deleteResponse.ok) {
				throw new Error(`Failed to clear playlist items (${deleteResponse.status})`);
			}
		}

		await addItemsToPlaylist({ serverUrl, token, playlistId, itemIds });
	}

	async function addItemsToPlaylist({ serverUrl, token, playlistId, itemIds }) {
		if (!itemIds.length) return;
		for (const chunk of chunkArray(itemIds, PLAYLIST_SYNC_CHUNK_SIZE)) {
			const params = new URLSearchParams({
				Ids: chunk.join(',')
			});
			const response = await fetch(`${serverUrl}/Playlists/${playlistId}/Items?${params.toString()}`, {
				method: 'POST',
				headers: {
					'Authorization': `MediaBrowser Token="${token}"`
				}
			});
			if (!response.ok) {
				throw new Error(`Failed to add items to playlist (${response.status})`);
			}
		}
	}

	function chunkArray(array, size) {
		const chunks = [];
		for (let i = 0; i < array.length; i += size) {
			chunks.push(array.slice(i, i + size));
		}
		return chunks;
	}

	// Show validation message
	function showValidationMessage(container, message, type) {
		container.style.display = 'block';
		container.textContent = message;
		container.style.background = type === 'success' ? 'rgba(76, 175, 80, 0.2)' : 'rgba(255, 0, 0, 0.2)';
		container.style.border = type === 'success' ? '1px solid rgba(76, 175, 80, 0.4)' : '1px solid rgba(255, 0, 0, 0.4)';
		container.style.color = type === 'success' ? '#4caf50' : '#ff6b6b';
	}

	// Show preview
	function showPreview(container, data) {
		container.innerHTML = '';
		container.style.display = 'block';

		const previewTitle = document.createElement('div');
		previewTitle.style.cssText = 'font-weight: 600; margin-bottom: 8px; color: #fff;';
		previewTitle.textContent = `Preview: ${data.length} item(s) to import`;
		container.appendChild(previewTitle);

		const previewList = document.createElement('div');
		previewList.style.cssText = 'max-height: 150px; overflow-y: auto;';
		
		data.slice(0, 10).forEach((item, index) => {
			const itemDiv = document.createElement('div');
			itemDiv.style.cssText = 'padding: 6px; margin-bottom: 4px; background: rgba(255, 255, 255, 0.05); border-radius: 4px; font-size: 12px; color: rgba(255, 255, 255, 0.8);';
			const name = item.Name || item.name || 'Unknown';
			const providers = [];
			if (item.Imdb || item.imdb) providers.push('IMDb');
			if (item.Tmdb || item.tmdb) providers.push('TMDB');
			if (item.Tvdb || item.tvdb) providers.push('TVDB');
			itemDiv.textContent = `${index + 1}. ${name} (${providers.join(', ')})`;
			previewList.appendChild(itemDiv);
		});

		if (data.length > 10) {
			const moreDiv = document.createElement('div');
			moreDiv.style.cssText = 'padding: 6px; font-size: 12px; color: rgba(255, 255, 255, 0.6); font-style: italic;';
			moreDiv.textContent = `... and ${data.length - 10} more item(s)`;
			previewList.appendChild(moreDiv);
		}

		container.appendChild(previewList);
	}

	// Show import progress
	function showImportProgress(container, current, total, itemName) {
		container.innerHTML = `
			<div style="color: rgba(255, 255, 255, 0.8); font-size: 13px; margin-bottom: 8px;">
				Importing: ${current} / ${total}
			</div>
			<div style="width: 100%; height: 8px; background: rgba(255, 255, 255, 0.1); border-radius: 4px; overflow: hidden;">
				<div style="width: ${(current / total) * 100}%; height: 100%; background: #00a4dc; transition: width 0.3s;"></div>
			</div>
			<div style="color: rgba(255, 255, 255, 0.6); font-size: 12px; margin-top: 4px;">
				${itemName || ''}
			</div>
		`;
	}

	// Show import summary
	function showImportSummary(container, results) {
		container.innerHTML = '';
		container.style.display = 'block';
		container.style.background = 'rgba(255, 255, 255, 0.05)';
		container.style.border = '1px solid rgba(255, 255, 255, 0.1)';
		container.style.padding = '12px';
		container.style.borderRadius = '4px';

		const summaryTitle = document.createElement('div');
		summaryTitle.style.cssText = 'font-weight: 600; margin-bottom: 8px; color: #fff; font-size: 14px;';
		summaryTitle.textContent = 'Import Summary';
		container.appendChild(summaryTitle);

		const summaryList = document.createElement('div');
		summaryList.style.cssText = 'display: flex; flex-direction: column; gap: 4px; font-size: 13px;';

		const successDiv = document.createElement('div');
		successDiv.style.color = '#4caf50';
		successDiv.textContent = `✓ Successfully imported: ${results.imported} item(s)`;
		summaryList.appendChild(successDiv);

		if (results.skipped > 0) {
			const skippedDiv = document.createElement('div');
			skippedDiv.style.color = 'rgba(255, 255, 255, 0.7)';
			skippedDiv.textContent = `⊘ Already in watchlist: ${results.skipped} item(s)`;
			summaryList.appendChild(skippedDiv);
		}

		if (results.notFound > 0) {
			const notFoundDiv = document.createElement('div');
			notFoundDiv.style.color = '#ff6b6b';
			notFoundDiv.textContent = `✗ Not found in library: ${results.notFound} item(s)`;
			summaryList.appendChild(notFoundDiv);
		}

		if (results.errors > 0) {
			const errorsDiv = document.createElement('div');
			errorsDiv.style.color = '#ff6b6b';
			errorsDiv.textContent = `✗ Errors: ${results.errors} item(s)`;
			summaryList.appendChild(errorsDiv);
		}

		container.appendChild(summaryList);
	}

	// Export watchlist data from server
	async function exportWatchlistData() {
		const apiClient = window.ApiClient;
		const userId = apiClient.getCurrentUserId();
		const serverUrl = apiClient.serverAddress();
		const token = apiClient.accessToken();

		const exportData = [];

		// Fetch all watchlist items from server (not cache)
		const types = [
			{ type: 'Movie', section: 'movies' },
			{ type: 'Series', section: 'series' },
			{ type: 'Season', section: 'seasons' },
			{ type: 'Episode', section: 'episodes' }
		];

		
		const watchlistData = await window.apiHelper.getWatchlistItems({ IncludeItemTypes: 'Movie,Series,Season,Episode', Fields: 'ProviderIds,SeriesName,ParentId' }, false);
		const items = watchlistData.Items;

		for (const item of items) {
			try {
				const exportItem = {
					status: true,
					Name: item.Name,
					Type: item.Type // Add Type field for efficient import
				};

				// Add provider IDs (only if they exist)
				if (item.ProviderIds) {
					if (item.ProviderIds.Imdb) exportItem.Imdb = item.ProviderIds.Imdb;
					if (item.ProviderIds.Tmdb) exportItem.Tmdb = item.ProviderIds.Tmdb;
					if (item.ProviderIds.Tvdb) exportItem.Tvdb = item.ProviderIds.Tvdb;
				}

				// For episodes, add SeriesName and SeasonName
				if (item.Type === 'Episode') {
					if (item.SeriesName) {
						exportItem.SeriesName = item.SeriesName;
					}
					// Get SeasonName from parent season
					if (item.ParentId) {
						try {
							const seasonUrl = `${serverUrl}/Items/${item.ParentId}?UserId=${userId}&Fields=Name`;
							const seasonRes = await fetch(seasonUrl, { headers: { "Authorization": `MediaBrowser Token=\"${token}\"` } });
							const seasonData = await seasonRes.json();
							if (seasonData.Name) {
								exportItem.SeasonName = seasonData.Name;
							}
						} catch (err) {
							WARN('Failed to fetch season name for episode:', err);
						}
					}
				}

				// For seasons, add SeriesName
				if (item.Type === 'Season') {
					if (item.SeriesName) {
						exportItem.SeriesName = item.SeriesName;
					}
				}

				// Only add if at least one provider ID exists
				if (exportItem.Imdb || exportItem.Tmdb || exportItem.Tvdb) {
					exportData.push(exportItem);
				}
			} catch (err) {
				ERR(`Failed to export item:`, err);
			}
		}

		return exportData;
	}

	// Validate import data
	function validateImportData(data) {
		if (!Array.isArray(data)) {
			return { valid: false, message: 'Data must be an array of items.' };
		}

		if (data.length === 0) {
			return { valid: false, message: 'No items to import.' };
		}

		const errors = [];
		const providerIdMap = new Map(); // Track provider IDs for duplicate detection

		for (let i = 0; i < data.length; i++) {
			const item = data[i];
			const itemNum = i + 1;

			// Check if item is an object
			if (typeof item !== 'object' || item === null) {
				errors.push(`Item ${itemNum}: Must be an object.`);
				continue;
			}

			// Check status field
			if (item.status !== undefined && typeof item.status !== 'boolean') {
				errors.push(`Item ${itemNum}: 'status' must be a boolean.`);
			}

			// Check Type field (required)
			const itemType = item.Type || item.type;
			if (!itemType) {
				errors.push(`Item ${itemNum}: 'Type' field is required (Movie, Series, Season, or Episode).`);
				continue;
			}
			if (!['Movie', 'Series', 'Season', 'Episode'].includes(itemType)) {
				errors.push(`Item ${itemNum}: 'Type' must be one of: Movie, Series, Season, Episode.`);
				continue;
			}

			// Check for at least one provider ID
			const imdb = item.Imdb || item.imdb;
			const tmdb = item.Tmdb || item.tmdb;
			const tvdb = item.Tvdb || item.tvdb;

			if (!imdb && !tmdb && !tvdb) {
				errors.push(`Item ${itemNum}: Must have at least one provider ID (Imdb, Tmdb, or Tvdb).`);
				continue;
			}

			// Check for duplicate provider IDs (include Type in key to allow same ID for different types)
			const providerKeys = [];
			if (imdb) providerKeys.push(`Imdb:${imdb}:${itemType}`);
			if (tmdb) providerKeys.push(`Tmdb:${tmdb}:${itemType}`);
			if (tvdb) providerKeys.push(`Tvdb:${tvdb}:${itemType}`);

			for (const key of providerKeys) {
				if (providerIdMap.has(key)) {
					const existingItem = providerIdMap.get(key);
					errors.push(`Item ${itemNum}: Duplicate provider ID '${key}' found (also in item ${existingItem}).`);
				} else {
					providerIdMap.set(key, itemNum);
				}
			}
		}

		if (errors.length > 0) {
			return { valid: false, message: `Validation failed:\n${errors.slice(0, 10).join('\n')}${errors.length > 10 ? `\n... and ${errors.length - 10} more error(s).` : ''}` };
		}

		return { valid: true, message: `Validation successful: ${data.length} item(s) ready to import.` };
	}

	// Import watchlist data
	async function importWatchlistData(data, progressContainer) {
		const apiClient = window.ApiClient;
		const userId = apiClient.getCurrentUserId();
		const serverUrl = apiClient.serverAddress();
		const token = apiClient.accessToken();

		const results = {
			imported: 0,
			skipped: 0,
			notFound: 0,
			errors: 0
		};

		// Analyze import data to determine which types are used
		const usedTypes = new Set();
		for (const item of data) {
			const itemType = item.Type || item.type;
			if (itemType) usedTypes.add(itemType);
		}

		// Build query parameters
		const includeTypes = Array.from(usedTypes).join(',');
		const queryParams = new URLSearchParams({
			UserId: userId,
			Recursive: 'true',
			IncludeItemTypes: includeTypes,
			Fields: 'ProviderIds,Type'
		});

		// Fetch all matching items in bulk
		let allLibraryItems = [];
		try {
			const url = `${serverUrl}/Items?${queryParams.toString()}`;
			const res = await fetch(url, { headers: { "Authorization": `MediaBrowser Token=\"${token}\"` } });
			const libraryData = await res.json();
			allLibraryItems = libraryData.Items || [];
			LOG(`Fetched ${allLibraryItems.length} items from library matching import criteria`);
		} catch (err) {
			ERR('Failed to fetch library items:', err);
			throw new Error('Failed to fetch library items. Please try again.');
		}

		// Create a lookup map: providerId -> item
		const libraryMap = new Map();
		for (const item of allLibraryItems) {
			if (item.ProviderIds) {
				if (item.ProviderIds.Imdb) {
					const key = `Imdb:${item.ProviderIds.Imdb}:${item.Type}`;
					libraryMap.set(key, item);
				}
				if (item.ProviderIds.Tmdb) {
					const key = `Tmdb:${item.ProviderIds.Tmdb}:${item.Type}`;
					libraryMap.set(key, item);
				}
				if (item.ProviderIds.Tvdb) {
					const key = `Tvdb:${item.ProviderIds.Tvdb}:${item.Type}`;
					libraryMap.set(key, item);
				}
			}
		}

		// Get all current watchlist items to check for duplicates
		const currentWatchlist = new Set();
		const watchlistTypes = ['Movie', 'Series', 'Season', 'Episode'];
		for (const type of watchlistTypes) {
			try {
				const url = `${serverUrl}/Items?Filters=Likes&IncludeItemTypes=${type}&UserId=${userId}&Recursive=true&Fields=ProviderIds`;
				const res = await fetch(url, { headers: { "Authorization": `MediaBrowser Token=\"${token}\"` } });
				const watchlistData = await res.json();
				const items = watchlistData.Items || [];
				for (const item of items) {
					if (item.ProviderIds) {
						if (item.ProviderIds.Imdb) currentWatchlist.add(`Imdb:${item.ProviderIds.Imdb}:${type}`);
						if (item.ProviderIds.Tmdb) currentWatchlist.add(`Tmdb:${item.ProviderIds.Tmdb}:${type}`);
						if (item.ProviderIds.Tvdb) currentWatchlist.add(`Tvdb:${item.ProviderIds.Tvdb}:${type}`);
					}
				}
			} catch (err) {
				WARN(`Failed to fetch current watchlist for ${type}:`, err);
			}
		}

		// Process each import item
		for (let i = 0; i < data.length; i++) {
			const importItem = data[i];
			const itemName = importItem.Name || importItem.name || `Item ${i + 1}`;
			
			// Update progress before processing item
			showImportProgress(progressContainer, i + 1, data.length, itemName);
			
			// Allow UI to update before processing
			await new Promise(resolve => requestAnimationFrame(resolve));

			try {
				// Get provider IDs and type
				const imdb = importItem.Imdb || importItem.imdb;
				const tmdb = importItem.Tmdb || importItem.tmdb;
				const tvdb = importItem.Tvdb || importItem.tvdb;
				const itemType = importItem.Type || importItem.type;

				// Find matching item in library using provider IDs and type
				let foundItem = null;
				const searchKeys = [];
				if (imdb) searchKeys.push(`Imdb:${imdb}:${itemType}`);
				if (tmdb) searchKeys.push(`Tmdb:${tmdb}:${itemType}`);
				if (tvdb) searchKeys.push(`Tvdb:${tvdb}:${itemType}`);

				for (const key of searchKeys) {
					if (libraryMap.has(key)) {
						foundItem = libraryMap.get(key);
						break; // Use first match
					}
				}

				if (!foundItem) {
					results.notFound++;
					// Update progress after processing
					await new Promise(resolve => requestAnimationFrame(resolve));
					continue;
				}

				// Check if already in watchlist
				let alreadyInWatchlist = false;
				for (const key of searchKeys) {
					if (currentWatchlist.has(key)) {
						alreadyInWatchlist = true;
						break;
					}
				}

				if (alreadyInWatchlist) {
					results.skipped++;
					// Update progress after processing
					await new Promise(resolve => requestAnimationFrame(resolve));
					continue;
				}

				// Add to watchlist
				await apiClient.updateUserItemRating(userId, foundItem.Id, 'true');
				results.imported++;

				// Update current watchlist set
				if (foundItem.ProviderIds) {
					if (foundItem.ProviderIds.Imdb) currentWatchlist.add(`Imdb:${foundItem.ProviderIds.Imdb}:${foundItem.Type}`);
					if (foundItem.ProviderIds.Tmdb) currentWatchlist.add(`Tmdb:${foundItem.ProviderIds.Tmdb}:${foundItem.Type}`);
					if (foundItem.ProviderIds.Tvdb) currentWatchlist.add(`Tvdb:${foundItem.ProviderIds.Tvdb}:${foundItem.Type}`);
				}

				// Update progress after processing
				await new Promise(resolve => requestAnimationFrame(resolve));

			} catch (err) {
				ERR(`Error importing item ${i + 1}:`, err);
				results.errors++;
				// Update progress after error
				await new Promise(resolve => requestAnimationFrame(resolve));
			}
		}

		return results;
	}

	// Clear entire watchlist
	async function clearWatchlist() {
		const apiClient = window.ApiClient;
		const userId = apiClient.getCurrentUserId();
		const serverUrl = apiClient.serverAddress();
		const token = apiClient.accessToken();

		const types = ['Movie', 'Series', 'Season', 'Episode'];
		let cleared = 0;

		for (const type of types) {
			try {
				const url = `${serverUrl}/Items?Filters=Likes&IncludeItemTypes=${type}&UserId=${userId}&Recursive=true&Fields=Id`;
				const res = await fetch(url, { headers: { "Authorization": `MediaBrowser Token=\"${token}\"` } });
				const data = await res.json();
				const items = data.Items || [];

				for (const item of items) {
					try {
						await apiClient.updateUserItemRating(userId, item.Id, 'false');
						cleared++;
					} catch (err) {
						ERR(`Failed to remove item ${item.Id}:`, err);
					}
				}
			} catch (err) {
				ERR(`Failed to fetch ${type} items for clearing:`, err);
			}
		}

		// Clear cache
		const sections = ['movies', 'series', 'seasons', 'episodes'];
		sections.forEach(section => {
			localStorageCache.clear(`watchlist_${section}`);
			watchlistCache[section].data = [];
		});

		// Refresh watchlist
		await initWatchlistTab();
		renderWatchlistContent();

		alert(`Watchlist cleared: ${cleared} item(s) removed.`);
	}

	// Update watchlist cache when an item is toggled
	async function updateWatchlistCacheOnToggle(itemId, itemType, isAdded) {
		try {
			// Determine which cache section this item belongs to
			let sectionName;
			switch (itemType) {
				case 'Movie':
					sectionName = 'movies';
					break;
				case 'Series':
					sectionName = 'series';
					break;
				case 'Season':
					sectionName = 'seasons';
					break;
				case 'Episode':
					sectionName = 'episodes';
					break;
				default:
					LOG('Unknown item type for cache update:', itemType);
					return;
			}

			if (isAdded) {
				// Item was added to watchlist - fetch the item and add to cache
				const item = await ApiClient.getItem(ApiClient.getCurrentUserId(), itemId);
				if (item) {
					// Add to cache if not already present
					const existingIndex = watchlistCache[sectionName].data.findIndex(cachedItem => cachedItem.Id === itemId);
					if (existingIndex === -1) {
						watchlistCache[sectionName].data.push(item);
						
						// Sort by release date descending (newest first)
						watchlistCache[sectionName].data.sort((a, b) => {
							const dateA = new Date(a.PremiereDate || a.ProductionYear || 0);
							const dateB = new Date(b.PremiereDate || b.ProductionYear || 0);
							return dateB - dateA;
						});
						
						// Update localStorage cache
						const optimizedData = optimizeWatchlistDataForStorage(watchlistCache[sectionName].data);
						localStorageCache.set(`watchlist_${sectionName}`, optimizedData, ApiClient._currentUser.Id, WATCHLIST_CACHE_TTL);
						
						LOG(`Added ${itemType} to watchlist cache: ${item.Name}`);
					}
				}
			} else {
				// Item was removed from watchlist - remove from cache
				const existingIndex = watchlistCache[sectionName].data.findIndex(cachedItem => cachedItem.Id === itemId);
				if (existingIndex !== -1) {
					const removedItem = watchlistCache[sectionName].data.splice(existingIndex, 1)[0];
					
					// Update localStorage cache
					const optimizedData = optimizeWatchlistDataForStorage(watchlistCache[sectionName].data);
					localStorageCache.set(`watchlist_${sectionName}`, optimizedData, ApiClient._currentUser.Id, WATCHLIST_CACHE_TTL);
					
					LOG(`Removed ${itemType} from watchlist cache: ${removedItem.Name}`);
				}
			}
		} catch (err) {
			ERR('Error updating watchlist cache:', err);
		}
	}

	// Initialize monitoring to remove watched items from watchlist (playback + manual)
	function initializePlaybackMonitoring() {
		if (playbackMonitorInitialized) {
			return;
		}

		const maxRetries = 10;
		let retries = 0;
		// Use WebSocket to listen for UserDataChanged messages instead of intercepting fetch
		// This is more reliable and doesn't interfere with fetch requests
		function setupWebSocketMonitoring() {
			try {
				// Grab the actual socket
				const socket = (window.ApiClient && (window.ApiClient.webSocket || window.ApiClient._webSocket)) || null;

				if (!socket) {
					if (retries >= maxRetries) {
						ERR('Max retries reached, giving up on WebSocket monitoring');
						return false;
					}
					retries++;
					setTimeout(() => {
						if (!playbackMonitorInitialized) {
							setupWebSocketMonitoring();
						}
					}, 1000);
					return;
				}

				// Store original handler if it exists
				const originalHandler = socket.onmessage;

				// Hook into onmessage
				socket.onmessage = function(event) {
					try {
						// Pass it through so Jellyfin still works normally
						if (originalHandler) {
							originalHandler.call(this, event);
						}

						const messageData = event.Data || event.data;
						const data = typeof messageData === 'string' ? JSON.parse(messageData) : messageData;

						// Check if this is a UserDataChanged message
						if (data.MessageType === 'UserDataChanged' && data.Data && data.Data.UserDataList && data.Data.UserDataList.length > 0) {
							const userData = data.Data.UserDataList[0];
							if (userData.ItemId) {
								LOG(`Detected UserDataChanged for item: ${userData.ItemId}, Played: ${userData.Played}`);
								// Handle the watched status change (works for both played and unplayed)
								handleItemWatchedStatusChange(userData.ItemId, userData.Played, userData.Likes).catch(err => {
									ERR('Error handling UserDataChanged event:', err);
								});
							}
						}
					} catch (err) {
						// Log parse errors but don't break the original handler
						WARN('WebSocket message parse error:', err);
					}
				};

				playbackMonitorInitialized = true;
				LOG('Playback and watch status monitoring initialized via WebSocket');
				return true;
			} catch (err) {
				ERR('Error setting up WebSocket monitoring:', err);
				return false;
			}
		}

		//setupWebSocketMonitoring();

		// Try to set up immediately
		if (!setupWebSocketMonitoring()) {
			// If WebSocket isn't available yet, retry after a short delay
			// This can happen if the page loads before the WebSocket connection is established
			setTimeout(() => {
				if (!playbackMonitorInitialized) {
					setupWebSocketMonitoring();
				}
			}, 1000);
		}
	}

	let watchedItems = [];

	async function getWatchedItem(itemId) {
		const watchedItem = watchedItems.find(item => item.Id === itemId);
		if (watchedItem) {
			return watchedItem;
		}

		const item = await ApiClient.getItem(ApiClient.getCurrentUserId(), itemId);
		if (!item) {
			LOG('Could not fetch item data for:', itemId);
			return;
		}

		watchedItems.push(item);
		return item;
	}

	// Shared handler for when items' watched status changes (played or unplayed)
	async function handleItemWatchedStatusChange(itemId, isPlayed, isWatchlisted) {
		try {
			LOG('Item watched status changed:', itemId);
			
			// Get the item data to check current played status
			const item = await getWatchedItem(itemId);

			// Only handle movies, series, seasons, and episodes
			if (item.Type !== 'Movie' && item.Type !== 'Series' && item.Type !== 'Season' && item.Type !== 'Episode') {
				return;
			}
			
			LOG(`Item is now ${isPlayed ? 'played' : 'unplayed'}:`, item.Name);
			
			if (isPlayed) {
				if (isWatchlisted) {
					// Item is now played - remove from watchlist and update caches
					LOG('Item is now played and watchlisted, removing from watchlist:', item.Name);
					await removeItemFromWatchlist(itemId, item.Type);
				}
				
				// Update relevant caches based on item type
				if (item.Type === 'Episode') {
					// Update series progress cache for episodes
					if (item.SeriesId) {
						if (progressCache.allDataLoaded) {
							LOG('Updating series progress cache for episode:', item.Name);
							await updateEpisodeWatchedStatusInCache(item.SeriesId, itemId, true);
						} else {
							LOG('Progress cache not fully loaded, updating localStorage only for episode:', item.Name);
							await updateEpisodeInLocalStorage(item);
						}
					}
					
					// Check parent Season and Series
					await checkAndRemoveParentItems(item);
				} else if (item.Type === 'Movie') {
					// Update movie history cache for movies
					if (movieCache.allDataLoaded) {
						LOG('Updating movie history cache for movie:', item.Name);
						await updateMovieHistoryCache(item);
					} else {
						LOG('Movie cache not fully loaded, updating localStorage only for movie:', item.Name);
						await updateMovieInLocalStorage(item);
					}
				}

				// Extract item ID from current URL
				const currentUrl = window.location.hash;
				const urlMatch = currentUrl.match(/[?&]id=([^&]+)/);
				const currentItemId = urlMatch ? urlMatch[1] : null;

				// Hide the watchlist button if we are on the item detail page of the item that was just watched
				if (currentItemId === itemId) {
					const watchlistIcon = document.querySelector('.itemDetailPage:not(.hide) .watchlist-icon');
					if (watchlistIcon) {
						watchlistIcon.style.display = "none";
						LOG('Hidden watchlist button on item detail page of watched item');
					}
				}

				// Check for any cards on the page for the item that was just watched and hide the watchlist button if found
				const itemCards = document.querySelectorAll('.card[data-id="' + itemId + '"]');
				if (itemCards.length > 0) {
					for (const card of itemCards) {
						const watchlistIcon = card.querySelector('.watchlist-button');
						if (watchlistIcon) {
							watchlistIcon.dataset.active = "false";
							LOG('Hidden watchlist button on card for watched item');
						}
					}
				}
				
				LOG('Successfully removed played item from watchlist and updated caches:', item.Name);
			} else {
				// Item is now unplayed - update caches to reflect unwatched status
				LOG('Item is now unplayed, updating caches:', item.Name);
				
				// Update relevant caches based on item type
				if (item.Type === 'Episode') {
					// Update series progress cache for episodes (mark as unwatched)
					if (item.SeriesId) {
						if (progressCache.allDataLoaded) {
							LOG('Updating series progress cache for episode (unwatched):', item.Name);
							await updateEpisodeWatchedStatusInCache(item.SeriesId, itemId, false);
						} else {
							LOG('Progress cache not fully loaded, updating localStorage only for episode (unwatched):', item.Name);
							await updateEpisodeInLocalStorageUnwatched(item);
						}
					}
				} else if (item.Type === 'Movie') {
					// Remove from movie history cache for movies
					if (movieCache.allDataLoaded) {
						LOG('Removing movie from history cache (unwatched):', item.Name);
						await removeMovieFromHistoryCache(item);
					} else {
						LOG('Movie cache not fully loaded, updating localStorage only for movie (unwatched):', item.Name);
						await removeMovieFromLocalStorage(item);
					}
				}

				// Unhide the watchlist button if we are on the item detail page of the item that was just watched
				const watchlistIcon = document.querySelector('.itemDetailPage:not(.hide) .watchlist-icon');
				if (watchlistIcon) {
					watchlistIcon.style.display = "block";
					LOG('Shown watchlist button on item detail page of unwatched item');
				}
				
				LOG('Successfully updated caches for unplayed item:', item.Name);
			}
		} catch (err) {
			ERR('Error handling item watched status change:', err);
		}
	}

	// Update episode in localStorage when progress cache is not fully loaded
	async function updateEpisodeInLocalStorage(episode) {
		try {
			const cachedProgress = localStorageCache.get('progress');
			if (!cachedProgress) {
				LOG('No progress data in localStorage to update');
				return;
			}
			
			const seriesIndex = cachedProgress.findIndex(p => p.series.Id === episode.SeriesId);
			if (seriesIndex === -1) {
				LOG('Series not found in localStorage progress data:', episode.SeriesId);

				// Fetch series data from API
				const apiClient = window.ApiClient;
				const userId = apiClient.getCurrentUserId();
				const serverUrl = apiClient.serverAddress();
				const token = apiClient.accessToken();
				
				try {
					// Fetch the series item
					const seriesUrl = `${serverUrl}/Items/${seriesId}?UserId=${userId}&Fields=UserData,RecursiveItemCount&EnableImageTypes=Primary,Banner`;
					const seriesRes = await fetch(seriesUrl, { headers: { "Authorization": `MediaBrowser Token=\"${token}\"` } });
					const series = await seriesRes.json();
					
					if (!series || !series.Id) {
						LOG(`Failed to fetch series data for seriesId: ${seriesId}`);
						return;
					}
					
					// Fetch and create progress data for this series
					cachedProgress = await fetchSeriesProgressWithMissingEpisodes(series, userId, serverUrl, token);
					
					if (!cachedProgress) {
						LOG(`Failed to create progress data for series: ${seriesId}`);
						return;
					}
					
					LOG(`Successfully added series ${series.Name} to cache`);
				} catch (err) {
					ERR(`Failed to fetch and add series ${seriesId} to cache:`, err);
					return;
				}
			}
			
			const seriesProgress = cachedProgress[seriesIndex];
			const season = String(episode.ParentIndexNumber);
			const episodeIndex = episode.IndexNumber - 1; // Convert to 0-based index
			
			// Update binaryProgress for the specific episode
			if (seriesProgress.binaryProgress && seriesProgress.binaryProgress[season]) {
				const seasonProgress = seriesProgress.binaryProgress[season];
				if (episodeIndex >= 0 && episodeIndex < seasonProgress.length) {
					// Mark episode as watched (set to '1')
					seriesProgress.binaryProgress[season] = 
						seasonProgress.substring(0, episodeIndex) + '1' + seasonProgress.substring(episodeIndex + 1);
					
					LOG(`Updated episode ${episode.IndexNumber} in season ${season} as watched in localStorage`);
					
					// Save back to localStorage
					localStorageCache.set('progress', cachedProgress);
				}
			}
		} catch (err) {
			ERR('Error updating episode in localStorage:', err);
		}
	}

	// Update movie in localStorage when movie cache is not fully loaded
	async function updateMovieInLocalStorage(movie) {
		try {
			const cachedMovies = localStorageCache.get('movies');
			if (!cachedMovies) {
				LOG('No movie data in localStorage to update');
				return;
			}
			
			// Check if movie already exists
			const existingIndex = cachedMovies.findIndex(m => m.Id === movie.Id);
			if (existingIndex !== -1) {
				// Update existing movie
				cachedMovies[existingIndex] = movie;
				LOG('Updated existing movie in localStorage:', movie.Name);
			} else {
				// Add new movie to beginning (most recent first)
				cachedMovies.unshift(movie);
				LOG('Added new movie to localStorage:', movie.Name);
			}
			
			// Save back to localStorage
			localStorageCache.set('movies', cachedMovies);
		} catch (err) {
			ERR('Error updating movie in localStorage:', err);
		}
	}

	// Update episode as unwatched in localStorage when progress cache is not fully loaded
	async function updateEpisodeInLocalStorageUnwatched(episode) {
		try {
			const cachedProgress = localStorageCache.get('progress');
			if (!cachedProgress) {
				LOG('No progress data in localStorage to update');
				return;
			}
			
			const seriesIndex = cachedProgress.findIndex(p => p.series.Id === episode.SeriesId);
			if (seriesIndex === -1) {
				LOG('Series not found in localStorage progress data:', episode.SeriesId);
				return;
			}
			
			const seriesProgress = cachedProgress[seriesIndex];
			const season = String(episode.ParentIndexNumber);
			const episodeIndex = episode.IndexNumber - 1; // Convert to 0-based index
			
			// Update binaryProgress for the specific episode
			if (seriesProgress.binaryProgress && seriesProgress.binaryProgress[season]) {
				const seasonProgress = seriesProgress.binaryProgress[season];
				if (episodeIndex >= 0 && episodeIndex < seasonProgress.length) {
					// Mark episode as unwatched (set to '0')
					seriesProgress.binaryProgress[season] = 
						seasonProgress.substring(0, episodeIndex) + '0' + seasonProgress.substring(episodeIndex + 1);
					
					LOG(`Updated episode ${episode.IndexNumber} in season ${season} as unwatched in localStorage`);
					
					// Save back to localStorage
					localStorageCache.set('progress', cachedProgress);
				}
			}
		} catch (err) {
			ERR('Error updating episode as unwatched in localStorage:', err);
		}
	}

	// Remove movie from history cache when marked as unwatched
	async function removeMovieFromHistoryCache(movie) {
		try {
			// Find and remove movie from cache
			const existingIndex = movieCache.data.findIndex(cachedMovie => cachedMovie.Id === movie.Id);
			if (existingIndex !== -1) {
				movieCache.data.splice(existingIndex, 1);
				LOG('Removed movie from history cache:', movie.Name);
				
				// Update cache metadata
				movieCache.totalPages = Math.ceil(movieCache.data.length / movieCache.pageSize);
				
				// Update localStorage cache
				await localStorageCache.set('movies', movieCache.data);
				
				// Update filtered data if search is active
				if (movieCache.searchTerm) {
					updateMovieSearchResults(movieCache.searchTerm);
				}
				
				LOG('Movie removed from history cache successfully');
			} else {
				LOG('Movie not found in history cache:', movie.Name);
			}
		} catch (err) {
			ERR('Error removing movie from history cache:', err);
		}
	}

	// Remove movie from localStorage when movie cache is not fully loaded
	async function removeMovieFromLocalStorage(movie) {
		try {
			const cachedMovies = localStorageCache.get('movies');
			if (!cachedMovies) {
				LOG('No movie data in localStorage to update');
				return;
			}
			
			// Find and remove movie
			const existingIndex = cachedMovies.findIndex(m => m.Id === movie.Id);
			if (existingIndex !== -1) {
				cachedMovies.splice(existingIndex, 1);
				LOG('Removed movie from localStorage:', movie.Name);
				
				// Save back to localStorage
				localStorageCache.set('movies', cachedMovies);
			} else {
				LOG('Movie not found in localStorage:', movie.Name);
			}
		} catch (err) {
			ERR('Error removing movie from localStorage:', err);
		}
	}

	// Update movie history cache when a movie is marked as played
	async function updateMovieHistoryCache(movie) {
		try {
			// Check if movie is already in cache
			const existingIndex = movieCache.data.findIndex(cachedMovie => cachedMovie.Id === movie.Id);
			
			if (existingIndex !== -1) {
				// Update existing movie in cache
				movieCache.data[existingIndex] = movie;
				LOG('Updated existing movie in history cache:', movie.Name);
			} else {
				// Add new movie to cache
				movieCache.data.unshift(movie); // Add to beginning (most recent first)
				LOG('Added new movie to history cache:', movie.Name);
			}
			
			// Update cache metadata
			movieCache.totalPages = Math.ceil(movieCache.data.length / movieCache.pageSize);
			movieCache.allDataLoaded = true;
			
			// Update localStorage cache
			await localStorageCache.set(`movies`, movieCache.data);
			
			// Update filtered data if search is active
			if (movieCache.searchTerm) {
				updateMovieSearchResults(movieCache.searchTerm);
			}
			
			LOG('Movie history cache updated successfully');
		} catch (err) {
			ERR('Error updating movie history cache:', err);
		}
	}

	// Remove item from watchlist (API + cache + UI)
	async function removeItemFromWatchlist(itemId, itemType) {
		// Remove from watchlist via API
		await ApiClient.updateUserItemRating(ApiClient.getCurrentUserId(), itemId, 'false');
		
		// Remove from cache
		await updateWatchlistCacheOnToggle(itemId, itemType, false);
		
		// Update watchlist button on item detail page if user is viewing this item
		await updateWatchlistButtonOnDetailPage();
	}

	// Check and remove parent Season/Series if they're played
	async function checkAndRemoveParentItems(episode) {
		try {
			// Check Season
			if (episode.SeasonId) {
				const seasonInWatchlist = await checkIfItemInWatchlist(episode.SeasonId);
				if (seasonInWatchlist) {
					const seasonItem = await ApiClient.getItem(ApiClient.getCurrentUserId(), episode.SeasonId);
					if (seasonItem && seasonItem.UserData && seasonItem.UserData.Played) {
						LOG('Season is now played, removing from watchlist:', seasonItem.Name);
						await removeItemFromWatchlist(episode.SeasonId, 'Season');
					}
				}
			}
			
			// Check Series
			if (episode.SeriesId) {
				const seriesInWatchlist = await checkIfItemInWatchlist(episode.SeriesId);
				if (seriesInWatchlist) {
					const seriesItem = await ApiClient.getItem(ApiClient.getCurrentUserId(), episode.SeriesId);
					if (seriesItem && seriesItem.UserData && seriesItem.UserData.Played) {
						LOG('Series is now played, removing from watchlist:', seriesItem.Name);
						await removeItemFromWatchlist(episode.SeriesId, 'Series');
					}
				}
			}
		} catch (err) {
			ERR('Error checking parent items:', err);
		}
	}

	// Sync watched status to watchlist - remove all played items
	async function syncWatchedStatusToWatchlist() {
		try {
			LOG('Syncing watched status to watchlist...');
			let removedCount = 0;
			
			// Check all watchlist sections
			const sections = ['movies', 'series', 'seasons', 'episodes'];
			for (const section of sections) {
				const items = watchlistCache[section].data;
				const playedItems = items.filter(item => item.UserData && item.UserData.Played);
				
				if (playedItems.length > 0) {
					LOG(`Found ${playedItems.length} played items in ${section} section`);
					
					// Remove each played item
					for (const item of playedItems) {
						await removeItemFromWatchlist(item.Id, item.Type);
						removedCount++;
					}
				}
			}
			
			if (removedCount > 0) {
				LOG(`Sync complete: removed ${removedCount} played items from watchlist`);
			} else {
				LOG('Sync complete: no played items found in watchlist');
			}
		} catch (err) {
			ERR('Error syncing watched status to watchlist:', err);
		}
	}

	// Update watchlist button on item detail page based on current item's watchlist status
	async function updateWatchlistButtonOnDetailPage() {
		try {
			// Check if we're on an item detail page
			const itemDetailPage = document.querySelector('#itemDetailPage:not(.hide)');
			if (!itemDetailPage) {
				LOG('Not on item detail page, skipping watchlist button update');
				return;
			}
			
			// Check if there's a watchlist button
			const watchlistButton = itemDetailPage.querySelector('.mainDetailButtons .watchlist-icon.detailButton');
			if (!watchlistButton) {
				LOG('No watchlist button found on detail page, skipping update');
				return;
			}
			
			// Extract item ID from current URL
			const currentUrl = window.location.hash;
			const urlMatch = currentUrl.match(/[?&]id=([^&]+)/);
			const currentItemId = urlMatch ? urlMatch[1] : null;
			
			if (!currentItemId) {
				LOG('Could not extract item ID from URL, skipping update');
				return;
			}
			
			// Fetch current item data to get watchlist status
			const item = await ApiClient.getItem(ApiClient.getCurrentUserId(), currentItemId);
			if (!item || !item.UserData) {
				LOG('Could not fetch item data, skipping watchlist button update');
				return;
			}
			
			// Update button based on current watchlist status
			const isInWatchlist = item.UserData.Likes ?? false;
			watchlistButton.setAttribute('data-active', isInWatchlist.toString());
			watchlistButton.title = isInWatchlist ? 'Remove from Watchlist' : 'Add to Watchlist';
			
			LOG(`Updated watchlist button on detail page for item ${currentItemId}: ${isInWatchlist ? 'in watchlist' : 'not in watchlist'}`);
		} catch (err) {
			ERR('Error updating watchlist button on detail page:', err);
		}
	}

	// Check if an item is in the user's watchlist via API
	async function checkIfItemInWatchlist(itemId) {
		try {
			// First check if we have the item in our cache (faster)
			const sections = ['movies', 'series', 'seasons', 'episodes'];
			for (const section of sections) {
				if (watchlistCache[section].data.some(item => item.Id === itemId)) {
					return true;
				}
			}
			
			// If not in cache, check via API
			const item = await ApiClient.getItem(ApiClient.getCurrentUserId(), itemId);
			if (item && item.UserData && item.UserData.Likes) {
				LOG(`Item ${itemId} is in watchlist (via API check)`);
				return true;
			}
			
			LOG(`Item ${itemId} is not in watchlist (via API check)`);
			return false;
		} catch (err) {
			ERR('Error checking if item is in watchlist:', err);
			return false;
		}
	}

	async function fetchWatchedMovies(useCache = true) {
		// Check if we're already fetching to prevent duplicate calls
		if (tabStates.history.isFetching) {
			LOG('Movie data fetch already in progress, skipping duplicate call');
			return movieCache.data; // Return existing data or empty array
		}

		// Check if we have valid cached movie data
		if (useCache && moviePagination.isCacheValid() && movieCache.data.length > 0) {
			LOG('Using cached movie data');
			return movieCache.data;
		}

		// Check localStorage cache if in-memory cache is empty
		if (useCache && movieCache.data.length === 0) {
			const cachedData = localStorageCache.get(`movies`);
			if (cachedData) {
				LOG('Using localStorage cache for movies');
				moviePagination.updateCache(cachedData);
				return cachedData;
			}
		}

		// Set fetching flag to prevent duplicate calls
		tabStates.history.isFetching = true;
		LOG('Starting movie data fetch...');
		const apiClient = window.ApiClient;
		const userId = apiClient.getCurrentUserId();
		const serverUrl = apiClient.serverAddress();
		const token = apiClient.accessToken();

		// Fetch movies that have been played
		const url = `${serverUrl}/Items?IncludeItemTypes=Movie&UserId=${userId}&Recursive=true&Filters=IsPlayed&Fields=UserData,ProviderIds&EnableImageTypes=Primary,Backdrop,Thumb&ImageTypeLimit=1&SortBy=DatePlayed&SortOrder=Descending`;

		try {
			const res = await fetch(url, { headers: { "Authorization": `MediaBrowser Token=\"${token}\"` } });
			const data = await res.json();
			const movies = data.Items || [];

			// Filter out movie duplicates
			const seenImdbIds = new Set();
			const filteredMovies = movies.filter(movie => {
				if (!movie.ProviderIds || !movie.ProviderIds.Imdb) return true;
				if (seenImdbIds.has(movie.ProviderIds.Imdb)) return false;
				seenImdbIds.add(movie.ProviderIds.Imdb);
				return true;
			});
			
			// Sort movies by most recently watched
			const sortedMovies = filteredMovies.sort((a, b) => {
				const dateA = a.UserData && a.UserData.LastPlayedDate ? new Date(a.UserData.LastPlayedDate) : new Date(0);
				const dateB = b.UserData && b.UserData.LastPlayedDate ? new Date(b.UserData.LastPlayedDate) : new Date(0);
				return dateB - dateA; // Most recent first
			});
			
			// Update cache
			moviePagination.updateCache(sortedMovies);
			
			// Store in localStorage for next time (optimized)
			const optimizedMovies = optimizeMovieDataForStorage(sortedMovies);
			localStorageCache.set(`movies`, optimizedMovies);
			LOG('Stored optimized movie data in localStorage');
			
			LOG(`Found and cached ${sortedMovies.length} watched movies`);
			return sortedMovies;
		} catch (err) {
			ERR("Failed to fetch watched movies:", err);
			return [];
		} finally {
			// Always clear the fetching flag, even on error
			tabStates.history.isFetching = false;
			LOG('Movie data fetch completed');
			renderStatisticsContent();
		}
	}

	function createMovieCard(movie) {
		const card = document.createElement('div');
		card.className = 'movie-card';
		
		// Get movie image URL
		const imageUrl = movie.ImageTags.Thumb && movie.ImageTags.Thumb
			? `${ApiClient._serverAddress}/Items/${movie.Id}/Images/Thumb?maxHeight=400&maxWidth=400&tag=${movie.ImageTags.Thumb}`
			: movie.BackdropImageTags && movie.BackdropImageTags[0]
			? `${ApiClient._serverAddress}/Items/${movie.Id}/Images/Backdrop?maxHeight=400&maxWidth=400&tag=${movie.BackdropImageTags[0]}`
			: movie.ImageTags.Primary
			? `${ApiClient._serverAddress}/Items/${movie.Id}/Images/Primary?maxHeight=300&maxWidth=200&tag=${movie.ImageTags.Primary}`
			: '';

		// Format watched date
		const watchedDate = movie.UserData && movie.UserData.LastPlayedDate 
			? formatLastWatchedDate(movie.UserData.LastPlayedDate)
			: 'Unknown date';

		// Format runtime
		const runtime = movie.RunTimeTicks 
			? Math.round(movie.RunTimeTicks / 10000000 / 60) + ' min'
			: 'Unknown runtime';

		// Format year
		const year = movie.ProductionYear || movie.PremiereDate 
			? new Date(movie.PremiereDate || movie.ProductionYear).getFullYear()
			: 'Unknown year';

		// Check if movie is favorited
		const isFavorite = movie.UserData && movie.UserData.IsFavorite;
		const favoriteIcon = isFavorite ? 'favorite' : 'favorite_border';
		const favoriteText = isFavorite ? 'Favorited' : 'Favorite';
		const favoriteClass = isFavorite ? 'favorited' : '';

		card.innerHTML = `
			<a href="${ApiClient._serverAddress}/web/#/details?id=${movie.Id}&serverId=${ApiClient.serverId()}">
				<div class="movie-poster">
					${imageUrl ? `<img src="${imageUrl}" alt="${movie.Name}" loading="lazy">` : `<div class="movie-poster-placeholder"><span class="material-icons movie"></span></div>`}
					<div class="movie-poster-overlay">
						<div class="movie-watched-badge">
							<span class="material-icons check_circle"></span>
							<span>Watched</span>
						</div>
						<button class="cardOverlayButton cardOverlayButton-hover emby-button ${favoriteClass}" onclick="event.preventDefault(); event.stopPropagation(); toggleMovieFavorite('${movie.Id}', this)">
							<span class="material-icons ${favoriteIcon}"></span>
						</button>
					</div>
				</div>
			</a>
			<div class="movie-details">
				<a href="${ApiClient._serverAddress}/web/#/details?id=${movie.Id}&serverId=${ApiClient.serverId()}">
					<h3 class="movie-title">${movie.Name}</h3>
				</a>
				<div class="movie-meta">
					<div class="movie-year">${year}</div>
					<div class="movie-runtime">
						<span class="material-icons schedule"></span>
						<span>${runtime}</span>
					</div>
				</div>
				<div class="movie-watched-date">Watched on ${watchedDate}</div>
			</div>
		`;

		return card;
	}

	async function renderHistoryContent() {
		LOG('Rendering Movie History content');
		
		const watchlistSection = getWatchlistSection();
		const historyTab = watchlistSection ? watchlistSection.querySelector('div[data-tab="history"]') : null;
		const paginatedContainer = historyTab ? historyTab.querySelector('.paginated-container') : null;
		const container = paginatedContainer ? paginatedContainer.querySelector('.movie-history-grid') : null;
		const emptyMessage = historyTab ? historyTab.querySelector('.movie-history-empty-message') : null;
		const movieCount = getElementByIdSafe('movie-count');
		
		if (!container) {
			WARN("Movie history container not found");
			return;
		}

		try {
			// Check if we're currently fetching data or data hasn't been fetched yet
			if (tabStates.history.isFetching || !tabStates.history.isDataFetched) {
				hideEmptyHistoryMessage();
				container.innerHTML = '<div class="loading-message"><div class="loading-spinner"></div><div>Loading movie history...</div></div>';
				return;
			}

			// Get current page and search terms from URL
			const params = getUrlParams();
			const currentPage = (params.pageTab === 'history') ? 
				(params.page || 1) : 
				(movieCache.currentPage || 1);
			const movieSearchTerm = params.movieSearch || '';
			
			// Get current sort order and apply sorting to movie data
			const currentSort = getCurrentMovieSortOrder();
			const sortedMovies = applyMovieSorting(movieCache.data, currentSort);
			
			// Update pagination with sorted data
			moviePagination.updateCache(sortedMovies);
			
			// Get paginated movie data using the new pagination system
			const { pageData: movies, totalPages } = moviePagination.getCachedPage(currentPage);

			const searchInput = getElementByIdSafe('movie-search');
			if (searchInput && params.pageTab === 'history') {
				searchInput.value = movieSearchTerm;
			}
			
			if (totalPages > 1) {
				renderPaginationControls(currentPage, totalPages, 'history');
			}
			
			// Check if we should skip rendering
			if (shouldSkipRendering('history', currentPage, movieSearchTerm, container, movies)) {
				LOG(`Skipping history render - same page (${currentPage}), search ("${movieSearchTerm}"), and content`);
				// Still need to ensure pagination controls are rendered
				if (totalPages > 1) {
					renderPaginationControls(currentPage, totalPages, 'history');
				}
				return;
			}
			
			// Restore search state if URL has search parameter
			if (movieSearchTerm && movieSearchTerm !== movieCache.searchTerm) {
				const searchInput = getElementByIdSafe('movie-search');
				const clearBtn = getElementByIdSafe('movie-search-clear');
				
				if (searchInput) {
					searchInput.value = movieSearchTerm;
					updateMovieSearchResults(movieSearchTerm);
					if (clearBtn) clearBtn.style.display = 'flex';
				}
			}
			
			// Always use full, non-filtered movie data for stats
			const totalMovies = movieCache.data.length;
			
			// Update movie count
			if (movieCount) {
				movieCount.textContent = `${totalMovies} Watched`;
			}
			
			if (totalMovies === 0) {
				// Show empty message
				container.innerHTML = '';
				if (emptyMessage) {
					emptyMessage.style.display = 'block';
				}
				LOG('No watched movies found, showing empty state');
				return;
			}

			// Hide empty message and clear container
			if (emptyMessage) {
				emptyMessage.style.display = 'none';
			}
			container.innerHTML = '';
			
			// Create movie cards
			movies.forEach(movie => {
				const movieCard = createMovieCard(movie);
				container.appendChild(movieCard);
			});

			// Update cache currentPage
			movieCache.currentPage = currentPage;
			
			// Update tab state after successful render
			updateTabState('history', currentPage, movieSearchTerm);

			LOG(`Rendered ${movies.length} watched movies for page ${currentPage} of ${totalPages}`);
		} catch (err) {
			ERR('Error rendering movie history content:', err);
			// Clear container and show empty message on error
			container.innerHTML = '';
			clearTabState('history');
			if (emptyMessage) {
				emptyMessage.style.display = 'block';
			}
		}
	}

	async function renderStatisticsContent() {
		LOG('Rendering Statistics content');
		
		try {
			// Check if both data sources are fully loaded
			const progressDataReady = progressCache.allDataLoaded;
			const historyDataReady = movieCache.allDataLoaded;
			
			const watchlistSection = getWatchlistSection();
			const statisticsTab = watchlistSection ? watchlistSection.querySelector('div[data-tab="statistics"]') : null;
			
			if (!statisticsTab) return;
			
			if (!progressDataReady || !historyDataReady) {
				// Set data-ready="false" to show loading container
				statisticsTab.setAttribute('data-ready', 'false');
				return;
			}
			
			// Both data sources are ready, set data-ready="true" to show content
			statisticsTab.setAttribute('data-ready', 'true');
			
			// Both data sources are ready, proceed with statistics rendering
			// Ensure we have all progress data loaded
			await fetchAllProgressData(true);
			
			// Update statistics with all progress data
			await updateProgressStatistics(progressCache.data);
			
			LOG('Statistics content rendered successfully');
		} catch (err) {
			ERR('Error rendering statistics content:', err);
			// Set data-ready="false" on error
			if (statisticsTab) {
				statisticsTab.setAttribute('data-ready', 'false');
			}
		}
	}

	function renderPaginationControls(currentPage, totalPages, tabName = 'progress') {
		const watchlistSection = getWatchlistSection();
		if (!watchlistSection) return;

		// Check if pagination already exists for this tab
		const tabContent = watchlistSection.querySelector(`div[data-tab="${tabName}"]`);
		const paginatedContainer = tabContent ? tabContent.querySelector('.paginated-container') : null;
		
		if (!paginatedContainer) return;

		// Check for existing pagination controls
		const existingTopPagination = paginatedContainer.querySelector('.pagination-top');
		const existingBottomPagination = paginatedContainer.querySelector('.pagination-bottom');
		
		// If totalPages <= 1, remove existing pagination and return
		if (totalPages <= 1) {
			if (existingTopPagination) existingTopPagination.remove();
			if (existingBottomPagination) existingBottomPagination.remove();
			return; // Don't show pagination for single page
		}

		// Check if pagination already exists and is correct
		
		// If pagination exists and shows the same page, just update active states
		if (existingTopPagination && existingBottomPagination) {
			const currentPageFromPagination = existingTopPagination.querySelector('.pagination-info')?.textContent;
			const expectedPageInfo = `Page ${currentPage} of ${totalPages}`;
			
			if (currentPageFromPagination === expectedPageInfo) {
				// Just update active states without recreating
				updatePaginationActiveStates(existingTopPagination, currentPage, totalPages);
				updatePaginationActiveStates(existingBottomPagination, currentPage, totalPages);
				return;
			}
		}

		// Remove existing pagination for this specific tab only
		if (existingTopPagination) existingTopPagination.remove();
		if (existingBottomPagination) existingBottomPagination.remove();

		// Create pagination container
		const paginationContainer = document.createElement('div');
		paginationContainer.className = 'pagination';
		paginationContainer.innerHTML = `
			<div class="pagination-info">
				Page ${currentPage} of ${totalPages}
			</div>
			<div class="pagination-controls">
				<button class="pagination-btn ${currentPage === 1 ? 'disabled' : ''}" data-page="1">
					<span class="material-icons first_page"></span>
				</button>
				<button class="pagination-btn ${currentPage === 1 ? 'disabled' : ''}" data-page="${currentPage - 1}">
					<span class="material-icons chevron_left"></span>
				</button>
				<div class="pagination-pages">
					${generatePageNumbers(currentPage, totalPages)}
				</div>
				<button class="pagination-btn ${currentPage === totalPages ? 'disabled' : ''}" data-page="${currentPage + 1}">
					<span class="material-icons chevron_right"></span>
				</button>
				<button class="pagination-btn ${currentPage === totalPages ? 'disabled' : ''}" data-page="${totalPages}">
					<span class="material-icons last_page"></span>
				</button>
			</div>
		`;

		// Function to add event listeners to pagination container
		const addPaginationListeners = (container) => {
			container.addEventListener('click', (e) => {
				const button = e.target.closest('.pagination-btn');
				if (!button || button.classList.contains('disabled')) return;

				const page = parseInt(button.dataset.page);
				LOG(`Pagination clicked: page ${page}, current page ${currentPage}, tab ${tabName}`);
				
				if (page && page !== currentPage) {
					// Get search terms based on tab
					const searchTerm = tabName === 'progress' ? progressCache.searchTerm : '';
					const movieSearchTerm = tabName === 'history' ? movieCache.searchTerm : '';
					
					LOG(`Navigating to page ${page} with search terms: progress="${searchTerm}", movie="${movieSearchTerm}"`);
					
					updateUrlWithSearch(tabName, page, searchTerm, movieSearchTerm);
					
					if (tabName === 'history') {
						renderHistoryContent();
					} else {
						renderProgressContent();
					}
				}
			});
		};

		// Add event listeners to the original container
		addPaginationListeners(paginationContainer);

		// Insert pagination controls at both top and bottom of paginated container
		if (paginatedContainer) {
			// Top pagination
			const topPagination = paginationContainer.cloneNode(true);
			topPagination.classList.add('pagination-top');
			addPaginationListeners(topPagination); // Add event listeners to cloned container
			paginatedContainer.insertBefore(topPagination, paginatedContainer.firstChild);
			
			// Bottom pagination
			const bottomPagination = paginationContainer.cloneNode(true);
			bottomPagination.classList.add('pagination-bottom');
			addPaginationListeners(bottomPagination); // Add event listeners to cloned container
			paginatedContainer.appendChild(bottomPagination);
		}
	}

	function updatePaginationActiveStates(paginationElement, currentPage, totalPages) {
		// Update page info
		const pageInfo = paginationElement.querySelector('.pagination-info');
		if (pageInfo) {
			pageInfo.textContent = `Page ${currentPage} of ${totalPages}`;
		}

		// Update button states
		const buttons = paginationElement.querySelectorAll('.pagination-btn');
		buttons.forEach(button => {
			const page = parseInt(button.dataset.page);
			button.classList.remove('active', 'disabled');
			
			if (page === currentPage) {
				button.classList.add('active');
			} else if ((page === 1 || page === currentPage - 1) && currentPage === 1) {
				button.classList.add('disabled');
			} else if ((page === totalPages || page === currentPage + 1) && currentPage === totalPages) {
				button.classList.add('disabled');
			}
		});
	}

	function generatePageNumbers(currentPage, totalPages) {
		const maxVisible = 5;
		let startPage = Math.max(1, currentPage - Math.floor(maxVisible / 2));
		let endPage = Math.min(totalPages, startPage + maxVisible - 1);

		// Adjust start if we're near the end
		if (endPage - startPage + 1 < maxVisible) {
			startPage = Math.max(1, endPage - maxVisible + 1);
		}

		let pages = '';
		
		// Add first page and ellipsis if needed
		if (startPage > 1) {
			pages += `<button class="pagination-btn ${currentPage === 1 ? 'active' : ''}" data-page="1">1</button>`;
			if (startPage > 2) {
				pages += '<span class="pagination-ellipsis">...</span>';
			}
		}

		// Add visible pages
		for (let i = startPage; i <= endPage; i++) {
			pages += `<button class="pagination-btn ${currentPage === i ? 'active' : ''}" data-page="${i}">${i}</button>`;
		}

		// Add last page and ellipsis if needed
		if (endPage < totalPages) {
			if (endPage < totalPages - 1) {
				pages += '<span class="pagination-ellipsis">...</span>';
			}
			pages += `<button class="pagination-btn ${currentPage === totalPages ? 'active' : ''}" data-page="${totalPages}">${totalPages}</button>`;
		}

		return pages;
	}

	async function createProgressCard(progress) {
		const { series, watchedCount, totalEpisodes, remainingCount, percentage, watchedRuntime, remainingRuntime, lastWatchedEpisode } = progress;
		
		const card = document.createElement('div');
		card.className = 'progress-card';
		card.dataset.seriesId = series.Id;
		
		// Add completed class for 100% shows
		if (percentage === 100) {
			card.classList.add('progress-card-completed');
		}
		
		// Get series image URL
		const imageUrl = window.innerWidth > 768 ?
		 series.ImageTags && series.ImageTags.Primary 
			? `${ApiClient._serverAddress}/Items/${series.Id}/Images/Primary?maxHeight=200&maxWidth=140&tag=${series.ImageTags.Primary}`
			: ''
			: series.ImageTags && series.ImageTags.Banner
			? `${ApiClient._serverAddress}/Items/${series.Id}/Images/Banner?maxWidth=300&height=60&tag=${series.ImageTags.Banner}`
			: '';

		// Format last watched info (only if we have episode data)
		let lastWatchedInfo = '';
		if (lastWatchedEpisode) {
			const timeAgo = formatTimeAgo(lastWatchedEpisode.UserData.LastPlayedDate);
			const formattedDate = formatLastWatchedDate(lastWatchedEpisode.UserData.LastPlayedDate);
			const episodeInfo = `${lastWatchedEpisode.ParentIndexNumber}x${lastWatchedEpisode.IndexNumber.toString().padStart(2, '0')} "${lastWatchedEpisode.Name}"`;
			lastWatchedInfo = `Last watched <strong>${episodeInfo}</strong> ${timeAgo} on ${formattedDate}.`;
		}

		card.innerHTML = `
			<div class="progress-card-content">
				<div class="progress-poster">
					<a href="${ApiClient._serverAddress}/web/#/details?id=${series.Id}&serverId=${ApiClient.serverId()}" class="poster-link">
						<img src="${imageUrl}" alt="${series.Name}" loading="lazy">
					</a>
				</div>
				<div class="progress-details">
					<div class="progress-header">
						<h3 class="progress-title">
							<a href="${ApiClient._serverAddress}/web/#/details?id=${series.Id}&serverId=${ApiClient.serverId()}" class="title-link">
								${series.Name}
							</a>
							${percentage === 100 ? '<span class="completion-badge">✓ Complete</span>' : ''}
						</h3>
						<div class="progress-percentage">${percentage}%</div>
					</div>
					<div class="progress-bar-container">
						<div class="progress-bar ${percentage === 100 ? 'progress-bar-completed' : ''}" data-series-id="${series.Id}">
							<!-- Episode chunks will be populated by JavaScript -->
						</div>
					</div>
					<div class="progress-stats">
						<span>
						${percentage === 100 
							? `Watched <strong>${watchedCount} of ${totalEpisodes}</strong> episodes - <strong>Series Complete!</strong>`
							: `Watched <strong>${watchedCount} of ${totalEpisodes}</strong> episodes which leaves <strong>${remainingCount} episodes</strong> left to watch.`
						}
						</span>
					</div>
					${lastWatchedInfo ? `<div class="progress-last-watched">${lastWatchedInfo}</div>` : ''}
					<div class="progress-actions">
						<button class="action-link unwatched-toggle ${remainingCount === 0 ? 'hide' : ''}" data-series-id="${series.Id}">+ View Unwatched Episodes</button>
						<button class="action-link mark-all-watched ${percentage === 100 ? 'hide' : ''}" data-series-id="${series.Id}">+ Mark All As Watched</button>
					</div>
					<div class="unwatched-episodes-container" id="unwatched-${series.Id}" style="display: none;">
						<div class="unwatched-episodes-list">
							<!-- Unwatched episodes will be populated here -->
						</div>
					</div>
				</div>
			</div>
		`;

		// Add click handler for unwatched episodes toggle
		const unwatchedToggle = card.querySelector('.unwatched-toggle');
		const unwatchedContainer = card.querySelector('.unwatched-episodes-container');
		
		unwatchedToggle.addEventListener('click', async () => {
			if (unwatchedContainer.style.display === 'none') {
				// Show unwatched episodes
				await loadUnwatchedEpisodes(series.Id, unwatchedContainer);
				unwatchedContainer.style.display = 'block';
				unwatchedToggle.textContent = '- Hide Unwatched Episodes';
			} else {
				// Hide unwatched episodes
				unwatchedContainer.style.display = 'none';
				unwatchedToggle.textContent = '+ View Unwatched Episodes';
			}
		});

		// Add click handler for mark all as watched button
		const markAllWatchedBtn = card.querySelector('.mark-all-watched');
		if (markAllWatchedBtn) {
			markAllWatchedBtn.addEventListener('click', async () => {
				// Get series info for confirmation modal
				const seriesInfo = {
					name: series.Name,
					watchedCount: progress.watchedCount,
					totalEpisodes: progress.totalEpisodes,
					unwatchedCount: progress.remainingCount,
					percentage: progress.percentage
				};
				
				showMarkAllEpisodesConfirmation(series.Id, markAllWatchedBtn, seriesInfo);
			});
		}

		// Create chunked progress bar
		await createChunkedProgressBar(card, progress);

		return card;
	}

	// Helper function to expand multi-part episodes into individual parts
	function expandMultiPartEpisodes(episode) {
		// If no IndexNumberEnd or it's the same as IndexNumber, it's a single episode
		if (!episode.IndexNumberEnd || episode.IndexNumberEnd === episode.IndexNumber) {
			return [{ ...episode, expandedIndex: episode.IndexNumber }];
		}
		
		// Multi-part episode - expand into individual parts
		const parts = [];
		for (let i = episode.IndexNumber; i <= episode.IndexNumberEnd; i++) {
			parts.push({
				...episode,
				expandedIndex: i
			});
		}
		return parts;
	}

	// Function to generate binary progress data from episodes
	function generateBinaryProgressData(episodes) {
		const today = new Date();
		today.setHours(23, 59, 59, 999);
		
		// Filter to aired episodes only and expand multi-part episodes
		const airedEpisodes = episodes.filter(ep => 
			ep.PremiereDate && new Date(ep.PremiereDate) <= today
		);
		
		// Expand multi-part episodes into individual parts
		const expandedEpisodes = [];
		airedEpisodes.forEach(episode => {
			expandedEpisodes.push(...expandMultiPartEpisodes(episode));
		});
		
		// Group by season and sort by expandedIndex
		const seasonProgress = {};
		expandedEpisodes.forEach(episode => {
			const season = episode.ParentIndexNumber;
			if (!seasonProgress[season]) {
				seasonProgress[season] = [];
			}
			seasonProgress[season].push(episode);
		});
		
		// Generate binary strings for each season
		const binaryData = {};
		Object.keys(seasonProgress).forEach(season => {
			const seasonEpisodes = seasonProgress[season].sort((a, b) => a.expandedIndex - b.expandedIndex);
			const binaryString = seasonEpisodes.map(ep => 
				(ep.UserData && ep.UserData.Played === true) ? '1' : '0'
			).join('');
			binaryData[season] = binaryString;
		});
		
		return binaryData;
	}

	// Function to create progress bar from binary data
	function createBinaryProgressBar(progressBar, binaryData, seriesId) {
		progressBar.innerHTML = '';
		progressBar.setAttribute('data-series-id', seriesId);
		
		Object.keys(binaryData).sort((a, b) => parseInt(a) - parseInt(b)).forEach(season => {
			const binaryString = binaryData[season];
			
			// Create chunks for this season
			for (let i = 0; i < binaryString.length; i++) {
				const isWatched = binaryString[i] === '1';
				const chunk = document.createElement('div');
				chunk.className = `progress-chunk ${isWatched ? 'watched' : 'unwatched'} binary-chunk`;
				chunk.dataset.isWatched = isWatched;
				chunk.setAttribute('data-season', season);
				chunk.setAttribute('data-episode', i + 1);
				chunk.title = `S${season}:E${i + 1} (${isWatched ? 'Watched' : 'Unwatched'})`;
				
				// Add click handler for all episodes
				chunk.addEventListener('click', async (e) => {
					e.preventDefault();
					e.stopPropagation();
					const playState = chunk.dataset.isWatched === 'true';
					
					// Show confirmation modal - episode details will be enhanced if available
					const episodeInfo = {
						title: `Episode ${i + 1}`, // Placeholder name
						season: parseInt(season),
						episode: i + 1,
						seriesId: seriesId
					};

					const episodeId = chunk.getAttribute('data-episode-id');
					showEpisodeWatchedConfirmation(episodeId, chunk, episodeInfo, seriesId, playState);
				});
				
				progressBar.appendChild(chunk);
			}
		});
	}

	// Function to enhance progress bar with episode details
	function enhanceProgressBarWithEpisodes(progressBar, episodes) {
		return;
		const today = new Date();
		today.setHours(23, 59, 59, 999);
		
		// Filter to aired episodes only
		const airedEpisodes = episodes.filter(ep => 
			ep.PremiereDate && new Date(ep.PremiereDate) <= today
		);
		
		// Group episodes by season
		const seasonEpisodes = {};
		airedEpisodes.forEach(episode => {
			const season = episode.ParentIndexNumber;
			if (!seasonEpisodes[season]) {
				seasonEpisodes[season] = [];
			}
			seasonEpisodes[season].push(episode);
		});
		
		// Enhance each chunk with episode details
		const chunks = progressBar.querySelectorAll('.binary-chunk');
		chunks.forEach(chunk => {
			const season = parseInt(chunk.getAttribute('data-season'));
			const episodeNum = parseInt(chunk.getAttribute('data-episode'));
			
			const seasonEpisodesList = seasonEpisodes[season];
			if (seasonEpisodesList) {
				// Find the original episode that contains this episode number
				// This handles both single episodes and multi-part episodes
				const episode = seasonEpisodesList.find(ep => {
					const start = ep.IndexNumber;
					const end = ep.IndexNumberEnd || ep.IndexNumber;
					return episodeNum >= start && episodeNum <= end;
				});
				
				if (episode) {
					// Update chunk with episode details
					chunk.setAttribute('data-episode-id', episode.Id);
					chunk.setAttribute('data-episode-title', episode.Name);
					
					// If this is a multi-part episode, show which part this chunk represents
					const partInfo = (episode.IndexNumberEnd && episode.IndexNumberEnd !== episode.IndexNumber)
						? ` (Part ${episodeNum - episode.IndexNumber + 1} of ${episode.IndexNumberEnd - episode.IndexNumber + 1})`
						: '';
					
					chunk.title = `S${season}:E${episodeNum} - ${episode.Name}${partInfo} (${episode.UserData && episode.UserData.Played === true ? 'Watched' : 'Unwatched'})`;
					chunk.classList.remove('binary-chunk'); // Remove binary class
					
					// Add click handler for all episodes
					chunk.addEventListener('click', async (e) => {
						e.preventDefault();
						e.stopPropagation();
						
						const isWatched = episode.UserData && episode.UserData.Played === true;
						const episodeInfo = {
							title: episode.Name,
							season: season,
							episode: episodeNum,
							seriesId: episode.SeriesId
						};
						
						// Always show the confirmation modal
						showEpisodeWatchedConfirmation(episode.Id, chunk, episodeInfo, episode.SeriesId, isWatched);
					});
				}
			}
		});
	}

	// Function to update progress bar in place without recreating enhanced chunks
	async function updateProgressBarInPlace(progressCard, updatedProgress) {
		const progressBar = progressCard.querySelector('.progress-bar');
		if (!progressBar) return;

		const seriesId = updatedProgress.series.Id;
		
		// Check if we have binary progress data
		if (updatedProgress.binaryProgress) {
			// Update existing chunks based on binary data
			const existingChunks = progressBar.querySelectorAll('.progress-chunk');
			existingChunks.forEach(chunk => {
				const season = chunk.getAttribute('data-season');
				const episode = parseInt(chunk.getAttribute('data-episode'));
				const isWatched = updatedProgress.binaryProgress[season] && 
					updatedProgress.binaryProgress[season][episode - 1] === '1';

				chunk.dataset.isWatched = isWatched;
				
				// Update chunk state
				chunk.classList.toggle('watched', isWatched);
				chunk.classList.toggle('unwatched', !isWatched);
				
				// Update title
				if (chunk.title) {
					chunk.title = chunk.title.replace(/\((Watched|Unwatched)\)/, isWatched ? '(Watched)' : '(Unwatched)');
				}
			});
			
			// If we have episodes data, enhance any remaining binary chunks
			if (updatedProgress.episodes && updatedProgress.episodes.length > 0) {
				setTimeout(async () => {
					try {
						enhanceProgressBarWithEpisodes(progressBar, updatedProgress.episodes);
					} catch (err) {
						ERR(`Failed to enhance progress bar for series ${seriesId}:`, err);
					}
				}, 100);
			}
		} else {
			// Fallback to full recreation if no binary data
			await createChunkedProgressBar(progressCard, updatedProgress);
		}
	}

	// Function to fetch episodes on-demand from API with in-memory caching
	async function fetchEpisodesForSeries(seriesId) {
		// First check if we have episodes in memory cache
		const cachedProgress = getCachedSeriesProgress(seriesId);
		if (cachedProgress && cachedProgress.episodes) {
			LOG(`Using in-memory episodes cache for series: ${seriesId} (${cachedProgress.episodes.length} episodes)`);
			return cachedProgress.episodes;
		}
		
		const apiClient = window.ApiClient;
		const userId = apiClient.getCurrentUserId();
		const serverUrl = apiClient.serverAddress();
		const token = apiClient.accessToken();
		
		try {
			LOG(`Fetching episodes from API for series: ${seriesId}`);
			const episodesUrl = `${serverUrl}/Shows/${seriesId}/Episodes?UserId=${userId}&Fields=UserData&EnableImageTypes=Primary`;
			const episodesRes = await fetch(episodesUrl, { headers: { "Authorization": `MediaBrowser Token=\"${token}\"` } });
			const episodesData = await episodesRes.json();
			let episodes = episodesData.Items || [];

			// Filter and deduplicate episodes
			episodes = episodes
				.filter(ep => ep.ParentIndexNumber !== 0)
				.filter((ep, index, self) => 
					index === self.findIndex(e => 
						e.ParentIndexNumber === ep.ParentIndexNumber && 
						e.IndexNumber === ep.IndexNumber
					)
				);
			
			// Cache episodes in memory (not localStorage)
			if (cachedProgress) {
				cachedProgress.episodes = episodes;
				LOG(`Cached ${episodes.length} episodes in memory for series: ${seriesId}`);
			}
			
			LOG(`Fetched ${episodes.length} episodes for series: ${seriesId}`);
			return episodes;
		} catch (err) {
			ERR(`Failed to fetch episodes for series ${seriesId}:`, err);
			return [];
		}
	}

	// Function to load and display unwatched episodes
	async function loadUnwatchedEpisodes(seriesId, container) {
		const listContainer = container.querySelector('.unwatched-episodes-list');
		
		// Show loading state
		listContainer.innerHTML = '<div class="unwatched-loading">Loading unwatched episodes...</div>';
		
		try {
			// Fetch episodes on-demand from API
			const episodes = await fetchEpisodesForSeries(seriesId);
			
			// Filter unwatched episodes
			const unwatchedEpisodes = episodes.filter(ep => 
				ep.ParentIndexNumber !== 0 &&
				(!ep.UserData.Played || ep.UserData.Played === false)
			);
			
			if (unwatchedEpisodes.length === 0) {
				listContainer.innerHTML = '<div class="unwatched-empty">No unwatched episodes found</div>';
				return;
			}
			
			// Sort episodes by season and episode number
			const sortedEpisodes = [...unwatchedEpisodes].sort((a, b) => {
				if (a.ParentIndexNumber !== b.ParentIndexNumber) {
					return a.ParentIndexNumber - b.ParentIndexNumber;
				}
				return a.IndexNumber - b.IndexNumber;
			});
			
			// Create episode list HTML
			const episodesHtml = sortedEpisodes.map(episode => {
				const seasonEpisode = `${episode.ParentIndexNumber}x${episode.IndexNumber.toString().padStart(2, '0')}`;
				const episodeTitle = episode.Name || 'Untitled Episode';
				const episodeDate = episode.PremiereDate ? new Date(episode.PremiereDate).toLocaleDateString() : '';
				
				// Check if episode has a valid image
				const hasImage = episode.ImageTags && episode.ImageTags.Primary;
				
				const episodeImageHtml = hasImage 
					? `<img src="${ApiClient._serverAddress}/Items/${episode.Id}/Images/Primary?maxHeight=60&maxWidth=100&tag=${episode.ImageTags.Primary}" alt="${episodeTitle}" loading="lazy">`
					: `<div class="episode-placeholder">
							<span class="material-icons tv"></span>
					</div>`;
				
				return `
					<div class="unwatched-episode-item" data-episode-id="${episode.Id}" data-series-id="${seriesId}" data-season="${episode.ParentIndexNumber}" data-episode="${episode.IndexNumber}" data-name="${episodeTitle}">
						<button class="episode-watched-toggle" data-episode-id="${episode.Id}" title="Mark as watched">
							<span class="material-icons check"></span>
						</button>
						<div class="episode-image">
							${episodeImageHtml}
						</div>
						<div class="episode-details">
							<div class="episode-title">
								<a href="${ApiClient._serverAddress}/web/#/details?id=${episode.Id}&serverId=${ApiClient.serverId()}" class="episode-link">
									${seasonEpisode} - ${episodeTitle}
								</a>
							</div>
							${episodeDate ? `<div class="episode-date">${episodeDate}</div>` : ''}
						</div>
					</div>
				`;
			}).join('');
			
			listContainer.innerHTML = episodesHtml;
			
			// Add event listeners for watched toggle buttons
			const watchedToggleButtons = listContainer.querySelectorAll('.episode-watched-toggle');
			watchedToggleButtons.forEach(button => {
				button.addEventListener('click', async (e) => {
					e.preventDefault();
					e.stopPropagation();
					
					const episodeItem = button.closest('.unwatched-episode-item');

					if (!episodeItem) {
						return;
					}

					const episodeName = episodeItem.getAttribute('data-name');
					const episodeId = episodeItem.getAttribute('data-episode-id');
					const seriesId = episodeItem.getAttribute('data-series-id');
					const season = episodeItem.getAttribute('data-season');
					const episode = episodeItem.getAttribute('data-episode');
					
					const episodeInfo = {
						title: episodeName ? episodeName.replace(/^S\d+:E\d+\s*-\s*/, '') : 'Unknown Episode', // Remove season/episode prefix
						season: season,
						episode: episode,
						seriesId: seriesId
					};
					
					showEpisodeWatchedConfirmation(episodeId, button, episodeInfo);
				});
			});
			
		} catch (err) {
			ERR('Error loading unwatched episodes:', err);
			listContainer.innerHTML = '<div class="unwatched-error">Error loading episodes</div>';
		}
	}

	// Function to toggle watched status of an individual episode
	async function toggleEpisodeWatchedStatus(episodeId, buttonElement, isWatched = true) {
		LOG(`${isWatched ? 'Marking' : 'Removing'} episode as watched: ${episodeId || 'binary mode'}`);
		
		// If we don't have an episode ID (binary mode), we need to fetch episodes first
		if (!episodeId) {
			const seriesId = buttonElement.closest('.progress-card')?.querySelector('[data-series-id]')?.getAttribute('data-series-id');
			if (!seriesId) {
				ERR('Cannot find series ID for binary mode episode');
				return;
			}
			
			// Fetch episodes to get the actual episode ID
			const episodes = await fetchEpisodesForSeries(seriesId);
			const season = parseInt(buttonElement.getAttribute('data-season'));
			const episodeNum = parseInt(buttonElement.getAttribute('data-episode'));
			
			const seasonEpisodes = episodes.filter(ep => ep.ParentIndexNumber === season);
			const episode = seasonEpisodes.find(ep => ep.IndexNumber === episodeNum);
			
			if (!episode) {
				ERR(`Episode not found: S${season}:E${episodeNum}`);
				return;
			}
			
			episodeId = episode.Id;
		}
		
		const apiClient = window.ApiClient;
		const userId = apiClient.getCurrentUserId();
		const serverUrl = apiClient.serverAddress();
		const token = apiClient.accessToken();
		
		try {
			// Mark or unmark episode as played using Jellyfin API
			const markPlayedUrl = `${serverUrl}/Users/${userId}/PlayedItems/${episodeId}`;
			const response = await fetch(markPlayedUrl, {
				method: isWatched ? 'POST' : 'DELETE',
				headers: { 
					"Authorization": `MediaBrowser Token="${token}"`,
					"Content-Type": "application/json"
				}
			});
			
			if (!response.ok) {
				throw new Error(`Failed to ${isWatched ? 'mark' : 'unmark'} episode as watched: ${response.status}`);
			}
			
			// Update cache immediately after successful API call
			const seriesId = episodeId ? await getSeriesIdFromEpisode(episodeId) : 
				buttonElement.closest('.progress-card')?.querySelector('[data-series-id]')?.getAttribute('data-series-id');
			
			if (seriesId) {
				const cacheUpdated = await updateEpisodeWatchedStatusInCache(seriesId, episodeId, isWatched);
				if (cacheUpdated) {
					// If episodes weren't cached, attempt a direct binaryProgress flip for the specific season/episode
					const cached = getCachedSeriesProgress(seriesId);
					if (cached && !Array.isArray(cached.episodes) && cached.binaryProgress && buttonElement && buttonElement.classList.contains('progress-chunk')) {
						const season = String(buttonElement.getAttribute('data-season'));
						const epNum = parseInt(buttonElement.getAttribute('data-episode')); // 1-based index
						if (season && Number.isFinite(epNum) && cached.binaryProgress[season]) {
							// Find which episode object this corresponds to for multi-part handling
							// We need to get the actual episode to check if it's multi-part
							// For now, just update the single bit, multi-part will be handled by recalculating
							const idx = epNum - 1;
							const bin = cached.binaryProgress[season];
							if (idx >= 0 && idx < bin.length) {
								cached.binaryProgress[season] = bin.substring(0, idx) + (isWatched ? '1' : '0') + bin.substring(idx + 1);
								cacheSeriesProgress(seriesId, cached);
							}
						}
					}
					// If the action came from a progress chunk, update that chunk in-place
					if (buttonElement && buttonElement.classList.contains('progress-chunk')) {
						const chunkEl = buttonElement;
						
						if (isWatched) {
							chunkEl.classList.add('watched');
							chunkEl.classList.remove('unwatched');
							if (chunkEl.title) {
								chunkEl.title = chunkEl.title.replace(/\(Unwatched\)/, '(Watched)');
							}
						} else {
							chunkEl.classList.add('unwatched');
							chunkEl.classList.remove('watched');
							if (chunkEl.title) {
								chunkEl.title = chunkEl.title.replace(/\(Watched\)/, '(Unwatched)');
							}
						}
					}

					// Update the progress card UI (percentages, counts, etc.)
					await updateProgressCardUI(seriesId);
				}
			}
			
			// Update UI - remove the episode from the list
			const episodeItem = buttonElement.closest('.unwatched-episode-item');
			if (episodeItem) {
				episodeItem.style.opacity = '0.5';
				episodeItem.style.transition = 'opacity 0.3s ease';
				
				// Remove the episode after a short delay
				setTimeout(() => {
					episodeItem.remove();
					
					// Check if no more episodes remain
					const listContainer = episodeItem.closest('.unwatched-episodes-list');
					if (listContainer) {
						const remainingEpisodes = listContainer.querySelectorAll('.unwatched-episode-item');
						if (remainingEpisodes.length === 0) {
							listContainer.innerHTML = '<div class="unwatched-empty">No unwatched episodes found</div>';
						}
					}
				}, 300);
			}
			
			LOG(`Successfully marked episode as watched: ${episodeId}`);
			
		} catch (err) {
			ERR('Error toggling episode watched status:', err);
			// You could add a toast notification here if desired
		}
	}

	// Function to mark all unwatched episodes as watched
	async function markAllEpisodesAsWatched(seriesId, buttonElement) {
		LOG(`Marking all episodes as watched for series: ${seriesId}`);
		
		// Get cached progress data for this series
		const cachedProgress = getCachedSeriesProgress(seriesId);
		if (!cachedProgress) {
			ERR('Series progress data not found in cache');
			return;
		}
		
		// Fetch unwatched episodes on-demand from API
		const episodes = await fetchEpisodesForSeries(seriesId);
		const unwatchedEpisodes = episodes.filter(ep => 
			ep.ParentIndexNumber !== 0 &&
			(!ep.UserData.Played || ep.UserData.Played === false)
		);
		
		if (unwatchedEpisodes.length === 0) {
			LOG('No unwatched episodes to mark as watched');
			return;
		}
		
		const apiClient = window.ApiClient;
		const userId = apiClient.getCurrentUserId();
		const serverUrl = apiClient.serverAddress();
		const token = apiClient.accessToken();
		
		// Disable button and show loading state
		buttonElement.disabled = true;
		buttonElement.textContent = 'Marking...';
		
		try {
			// Mark all episodes as played in parallel
			const markPromises = unwatchedEpisodes.map(async (episode) => {
				const markPlayedUrl = `${serverUrl}/Users/${userId}/PlayedItems/${episode.Id}`;
				const response = await fetch(markPlayedUrl, {
					method: 'POST',
					headers: { 
						"Authorization": `MediaBrowser Token="${token}"`,
						"Content-Type": "application/json"
					}
				});
				
				if (!response.ok) {
					throw new Error(`Failed to mark episode ${episode.Id} as watched: ${response.status}`);
				}
				
				return episode.Id;
			});
			
			// Wait for all requests to complete
			const completedEpisodes = await Promise.all(markPromises);
			
			LOG(`Successfully marked ${completedEpisodes.length} episodes as watched`);
			
			// Update cache for all episodes (without localStorage updates)
			completedEpisodes.forEach(episodeId => {
				updateEpisodeWatchedStatusInCacheWithoutLocalStorage(seriesId, episodeId, true);
			});
			
			// Update localStorage once for all changes
			updateProgressDataInLocalStorage();
			
			// Update the progress card UI
			await updateProgressCardUI(seriesId);
			
			// Update the last watched display with the last episode from the batch
			const progressCard = buttonElement.closest('.progress-card');
			if (progressCard && unwatchedEpisodes.length > 0) {
				const lastWatchedElement = progressCard.querySelector('.progress-last-watched');
				// Get the last episode from the batch (should be sorted by season/episode)
				// Find the episode with the highest season and episode number
				const lastEpisode = unwatchedEpisodes.reduce((last, current) => {
					const lastSeason = last.ParentIndexNumber || 0;
					const currentSeason = current.ParentIndexNumber || 0;
					if (currentSeason > lastSeason) return current;
					if (currentSeason < lastSeason) return last;
					// Same season, compare episode number
					const lastEp = last.IndexNumber || 0;
					const currentEp = current.IndexNumber || 0;
					return currentEp > lastEp ? current : last;
				});
				
				if (lastWatchedElement && lastEpisode) {
					const episodeInfo = {
						title: lastEpisode.Name,
						season: lastEpisode.ParentIndexNumber || 0,
						episode: lastEpisode.IndexNumber || 0
					};
					updateLastWatched(lastWatchedElement, episodeInfo);
				}
			}
			
			if (progressCard) {
				const unwatchedContainer = progressCard.querySelector('.unwatched-episodes-container');
				const listContainer = unwatchedContainer.querySelector('.unwatched-episodes-list');
				listContainer.innerHTML = '<div class="unwatched-empty">No unwatched episodes found</div>';
				
				// Hide the unwatched episodes container
				unwatchedContainer.style.display = 'none';
				
				// Update the toggle button text
				const unwatchedToggle = progressCard.querySelector('.unwatched-toggle');
				unwatchedToggle.style.display = 'none';
				
				// Hide the mark all button since there are no more unwatched episodes
				buttonElement.style.display = 'none';
			}
			
		} catch (err) {
			ERR('Error marking all episodes as watched:', err);
			// Re-enable button on error
			buttonElement.disabled = false;
			buttonElement.textContent = '+ Mark All As Watched';
		}
	}


	// Compare existing DOM data-ids with new data-ids
	function compareDataIds(existingContainer, newItems) {
		if (!existingContainer || !newItems) return false;
		
		// Get existing data-ids from DOM
		const existingIds = Array.from(existingContainer.querySelectorAll('.itemsContainer > div.card[data-id]'))
			.map(el => el.getAttribute('data-id'))
			.sort();
		
		// Get new data-ids from items
		const newIds = newItems.map(item => item.Id).sort();
		
		// Compare arrays
		if (existingIds.length !== newIds.length) return false;
		
		return existingIds.every((id, index) => id === newIds[index]);
	}

	// Render cards from cached data
	async function renderCardsFromCache(container, sectionName, type) {
		if (!container) {
			WARN("Container not found for type:", type);
			return { type, itemCount: 0 };
		}
		
		const items = watchlistCache[sectionName].data;
		
		// Hide section if no items
		if (!items || items.length === 0) {
			container.style.display = 'none';
			return { type, itemCount: 0 };
		}
		
		// Check if content has changed by comparing data-ids
		if (compareDataIds(container, items)) {
			LOG(`Skipping ${type} render - content unchanged (${items.length} items)`);
			container.style.display = '';
			return { type, itemCount: items.length };
		}
		
		// Show section and use cardBuilder to create scrollable container
		container.style.display = '';
		
		// Use cardBuilder to create scrollable container
		if (typeof window.cardBuilder !== 'undefined' && window.cardBuilder.renderCards) {
			const scrollableContainer = window.cardBuilder.renderCards(items, getTypeDisplayName(type), null);
			container.innerHTML = '';
			container.appendChild(scrollableContainer);
			
			LOG(`Rendered ${items.length} ${type} items using cardBuilder from cache`);
		} else {
			ERR("cardBuilder not available - this should not happen with proper dependency management");
			container.style.display = 'none';
			return { type, itemCount: 0 };
		}
		
		return { type, itemCount: items.length };
	}

	function getTypeDisplayName(itemType) {
		const typeMap = {
			'Movie': 'Movies',
			'Series': 'Shows',
			'Season': 'Seasons',
			'Episode': 'Episodes'
		};
		return typeMap[itemType] || itemType;
	}

	/************ Tab Functionality ************/

	// Function to switch between tabs
	function switchTab(activeTab) {
		const watchlistSection = getWatchlistSection();
		if (!watchlistSection) return;
		
		// Remove active class from all buttons
		const buttons = watchlistSection.querySelectorAll('.watchlist-tabs button');
		buttons.forEach(button => button.classList.remove('active'));
		
		// Hide all tab content (only the content divs, not the tab buttons)
		const tabContents = watchlistSection.querySelectorAll('div[data-tab]:not(.watchlist-tabs)');
		tabContents.forEach(content => {
			content.style.display = 'none';
		});
		
		// Show selected tab content and activate button
		const activeButton = watchlistSection.querySelector(`.watchlist-tabs button[data-tab="${activeTab}"]`);
		const activeContent = watchlistSection.querySelector(`div[data-tab="${activeTab}"]:not(.watchlist-tabs)`);
		
		if (activeButton) activeButton.classList.add('active');
		if (activeContent) activeContent.style.display = 'block';
		
		// Update URL parameters - preserve current page and sort state for this tab
		// Only preserve page for paginated tabs (progress and history)
		const currentPage = (activeTab === 'progress' || activeTab === 'history') ? (tabStates[activeTab]?.currentPage || 1) : 1;
		
		// Preserve current sort state when switching tabs
		let currentSort = null;
		let currentSortDirection = null;
		let currentMovieSort = null;
		let currentMovieSortDirection = null;
		
		// Read sort state from the tab we're switching to (preserve its state)
		if (activeTab === 'progress') {
			currentSort = tabStates[activeTab]?.currentSort || 'lastWatched';
			currentSortDirection = tabStates[activeTab]?.currentDirection || 'desc';
		} else if (activeTab === 'history') {
			currentMovieSort = tabStates[activeTab]?.currentSort || 'lastWatched';
			currentMovieSortDirection = tabStates[activeTab]?.currentDirection || 'desc';
		}
		
		updateUrlParams(activeTab, currentPage, currentSort, currentSortDirection, currentMovieSort, currentMovieSortDirection);
		
		// Render content based on active tab
		if (activeTab === 'progress') {
			renderProgressContent();
		} else if (activeTab === 'watchlist') {
			renderWatchlistContent();
		} else if (activeTab === 'history') {
			renderHistoryContent();
		} else if (activeTab === 'statistics') {
			renderStatisticsContent();
		}
		
		LOG(`Switched to ${activeTab} tab`);
	}

	// Function to set active tab based on URL params or default to watchlist
	function setActiveTab() {
		const watchlistSection = getWatchlistSection();
		if (!watchlistSection) return;

		// Check for active tab
		const activeTab = watchlistSection.querySelector('.watchlist-tabs button.active');
		
		// Get tab from URL parameters
		const params = getUrlParams();
		const targetTab = params.pageTab || 'watchlist';

		if (activeTab && activeTab.getAttribute('data-tab') === targetTab) {
			LOG('Active tab found, skipping');
			return;
		}
		
		// Validate that the tab exists
		const validTabs = ['watchlist', 'progress', 'history', 'statistics'];
		const finalTab = validTabs.includes(targetTab) ? targetTab : 'watchlist';
		
		// Remove active class from all buttons
		const buttons = watchlistSection.querySelectorAll('.watchlist-tabs button');
		buttons.forEach(button => button.classList.remove('active'));
		
		// Hide all tab content
		const tabContents = watchlistSection.querySelectorAll('div[data-tab]:not(.watchlist-tabs)');
		tabContents.forEach(content => {
			content.style.display = 'none';
		});
		
		// Show target tab and activate button
		const targetButton = watchlistSection.querySelector(`.watchlist-tabs button[data-tab="${finalTab}"]`);
		const targetContent = watchlistSection.querySelector(`div[data-tab="${finalTab}"]:not(.watchlist-tabs)`);
		
		if (targetButton) targetButton.classList.add('active');
		if (targetContent) targetContent.style.display = 'block';
		
		LOG(`Active tab set to ${finalTab} (from ${params.pageTab ? 'URL param' : 'default'})`);
	}

	// Function to setup tab event listeners
	function setupTabListeners() {
		const watchlistSection = getWatchlistSection();
		if (!watchlistSection) return;
		
		// Check if listeners are already setup to prevent duplicates
		if (watchlistSection.dataset.listenersSetup === 'true') {
			LOG('Tab listeners already setup, skipping');
			return;
		}
		
		const tabButtons = watchlistSection.querySelectorAll('.watchlist-tabs button');
		tabButtons.forEach(button => {
			button.addEventListener('click', () => {
				const tabName = button.getAttribute('data-tab');
				switchTab(tabName);
			});
		});
		
		// Setup search functionality for Progress tab
		setupProgressSearch();
		setupMovieSearch();
		
		// Setup "Show All" button for top shows
		const showAllBtn = getElementByIdSafe('show-all-shows-btn');
		if (showAllBtn) {
			showAllBtn.addEventListener('click', (e) => {
				e.preventDefault();
				e.stopPropagation();
				showAllShowsModal();
			});
		}
		
		// Mark as setup to prevent duplicates
		watchlistSection.dataset.listenersSetup = 'true';
		
		LOG('Tab event listeners setup complete');
	}

	// Function to setup progress search functionality
	function setupProgressSearch() {
		const searchInput = getElementByIdSafe('progress-search');
		const clearBtn = getElementByIdSafe('progress-search-clear');
		
		if (!searchInput || !clearBtn) {
			WARN('Progress search elements not found:', { searchInput: !!searchInput, clearBtn: !!clearBtn });
			return;
		}
		
		// Check if already setup to prevent duplicates
		if (searchInput.dataset.searchSetup === 'true') {
			LOG('Progress search already setup, skipping');
			return;
		}
		
		// Debounced search function
		let searchTimeout;
		const debouncedSearch = (searchTerm) => {
			clearTimeout(searchTimeout);
			searchTimeout = setTimeout(() => {
				updateSearchResults(searchTerm);
				// Update URL with search term
				const params = getUrlParams();
				updateUrlWithSearch(params.pageTab, 1, searchTerm); // Reset to page 1 when searching
				renderProgressContent();
			}, 300); // 300ms delay
		};
		
		// Search input event
		searchInput.addEventListener('input', (e) => {
			const searchTerm = e.target.value;
			
			// Show/hide clear button
			if (searchTerm.trim() === '') {
				clearBtn.style.display = 'none';
			} else {
				clearBtn.style.display = 'flex';
			}
			
			// Update search results
			debouncedSearch(searchTerm);
		});
		
		// Clear button event
		clearBtn.addEventListener('click', () => {
			searchInput.value = '';
			clearBtn.style.display = 'none';
			updateSearchResults('');
			// Update URL to remove search parameter
			const params = getUrlParams();
			updateUrlWithSearch(params.pageTab, 1, ''); // Reset to page 1 when clearing
			renderProgressContent();
		});
		
		// Mark as setup to prevent duplicates
		searchInput.dataset.searchSetup = 'true';
		
		LOG('Progress search functionality setup complete');
	}

	// Function to setup movie search functionality
	function setupMovieSearch() {
		const searchInput = getElementByIdSafe('movie-search');
		const clearBtn = getElementByIdSafe('movie-search-clear');
		
		if (!searchInput || !clearBtn) {
			WARN('Movie search elements not found:', { searchInput: !!searchInput, clearBtn: !!clearBtn });
			return;
		}
		
		// Check if already setup to prevent duplicates
		if (searchInput.dataset.searchSetup === 'true') {
			LOG('Movie search already setup, skipping');
			return;
		}
		
		// Debounced search function
		let searchTimeout;
		const debouncedSearch = (searchTerm) => {
			clearTimeout(searchTimeout);
			searchTimeout = setTimeout(() => {
				updateMovieSearchResults(searchTerm);
				// Update URL with search term
				const params = getUrlParams();
				updateUrlWithSearch(params.pageTab, 1, '', searchTerm); // Reset to page 1 when searching
				renderHistoryContent();
			}, 300); // 300ms delay
		};
		
		// Search input event
		searchInput.addEventListener('input', (e) => {
			const searchTerm = e.target.value;
			
			// Show/hide clear button
			if (searchTerm.trim() === '') {
				clearBtn.style.display = 'none';
			} else {
				clearBtn.style.display = 'flex';
			}
			
			// Update search results
			debouncedSearch(searchTerm);
		});
		
		// Clear button event
		clearBtn.addEventListener('click', () => {
			searchInput.value = '';
			clearBtn.style.display = 'none';
			updateMovieSearchResults('');
			// Update URL to remove search parameter
			const params = getUrlParams();
			updateUrlWithSearch(params.pageTab, 1, '', ''); // Reset to page 1 when clearing
			renderHistoryContent();
		});
		
		// Mark as setup to prevent duplicates
		searchInput.dataset.searchSetup = 'true';
		
		LOG('Movie search functionality setup complete');
	}


	/************ Watchlist Section Observer ************/

	// Function to render watchlist content when .sections.watchlist is found
	async function renderWatchlistContent() {
		try {
			const watchlistSection = getWatchlistSection();
			if (!watchlistSection) {
				ERR('Watchlist section not found');
				return;
			}

			const watchlistSections = ['.watchlist-movies', '.watchlist-series', '.watchlist-seasons', '.watchlist-episodes'];
			
			// Check if we're currently fetching data or data hasn't been fetched yet
			if (!tabStates.watchlist.isDataFetched) {
				//Hide empty message
				hideEmptyWatchlistMessage();

				watchlistSections.forEach(section => {
					const container = watchlistSection.querySelector(section);
					if (container) {
						container.innerHTML = '';
					}
				});
				
				// Show loading state for watchlist tab
				const container = watchlistSection.querySelector('.watchlist-movies');
				
				if (container) {
					container.innerHTML = '<div class="loading-message"><div class="loading-spinner"></div><div>Loading watchlist...</div></div>';
					container.style.display = '';
				}
				return;
			}
			
			// Render all sections using cached data
			const results = await Promise.all([
				renderCardsFromCache(watchlistSection.querySelector('.watchlist-movies'), 'movies', 'Movie'),
				renderCardsFromCache(watchlistSection.querySelector('.watchlist-series'), 'series', 'Series'),
				renderCardsFromCache(watchlistSection.querySelector('.watchlist-seasons'), 'seasons', 'Season'),
				renderCardsFromCache(watchlistSection.querySelector('.watchlist-episodes'), 'episodes', 'Episode')
			]);
			
			// Update watchlist stats in header
			updateWatchlistHeaderStats();
			
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
	async function renderWatchlist() {
		const watchlistSection = getWatchlistSection();
		
		if (watchlistSection) {
			// Check if this is a new watchlist section (no HTML structure)
			const hasTabs = watchlistSection.querySelector('.watchlist-tabs');
			const isNewSection = !hasTabs;
			
			// Check if this is a recreated section by comparing content to cache
			const isRecreatedSection = hasTabs && !isWatchlistContentValid(watchlistSection);
			
			if (isNewSection || isRecreatedSection) {
				LOG(`Watchlist section ${isNewSection ? 'found' : 'recreated'}, initializing...`);
				
				// Mark as rendered to prevent duplicate initialization
				watchlistSection.dataset.watchlistRendered = 'true';
				
				// Render the complete HTML structure first
				renderWatchlistHtml();
				
				// Setup tab functionality
				setupTabListeners();
				
				// Setup layout toggle
				setupLayoutToggle();
				
				// Set active tab based on URL params or default to watchlist
				setActiveTab();
				
				// Initialize all tabs in parallel with proper dependencies
				await initializeAllTabs();
				
				// Render the default active tab content
				//renderWatchlistContent();
				
				LOG('Watchlist section initialized with all tabs');
			}
		}
	}

	// Function to validate if watchlist content matches cache expectations
	function isWatchlistContentValid(watchlistSection) {
		try {
			// Check if all expected containers exist
			const moviesContainer = watchlistSection.querySelector('.watchlist-movies');
			const seriesContainer = watchlistSection.querySelector('.watchlist-series');
			const seasonsContainer = watchlistSection.querySelector('.watchlist-seasons');
			const episodesContainer = watchlistSection.querySelector('.watchlist-episodes');
			
			if (!moviesContainer || !seriesContainer || !seasonsContainer || !episodesContainer) {
				LOG('Watchlist containers missing, content invalid');
				return false;
			}

			const moviesItemsContainer = moviesContainer.querySelector('.itemsContainer');
			const seriesItemsContainer = seriesContainer.querySelector('.itemsContainer');
			const seasonsItemsContainer = seasonsContainer.querySelector('.itemsContainer');
			const episodesItemsContainer = episodesContainer.querySelector('.itemsContainer');
			
			// Check if content matches cache expectations
			const expectedMovies = watchlistCache.movies.data.length;
			const expectedSeries = watchlistCache.series.data.length;
			const expectedSeasons = watchlistCache.seasons.data.length;
			const expectedEpisodes = watchlistCache.episodes.data.length;
			
			const actualMovies = moviesItemsContainer ? moviesItemsContainer.children.length : 0;
			const actualSeries = seriesItemsContainer ? seriesItemsContainer.children.length : 0;
			const actualSeasons = seasonsItemsContainer ? seasonsItemsContainer.children.length : 0;
			const actualEpisodes = episodesItemsContainer ? episodesItemsContainer.children.length : 0;			
			
			const contentMatches = actualMovies === expectedMovies && 
								actualSeries === expectedSeries && 
								actualSeasons === expectedSeasons && 
								actualEpisodes === expectedEpisodes;
			
			if (!contentMatches) {
				LOG(`Watchlist content mismatch - Expected: ${expectedMovies}M/${expectedSeries}S/${expectedSeasons}Se/${expectedEpisodes}E, Actual: ${actualMovies}M/${actualSeries}S/${actualSeasons}Se/${actualEpisodes}E`);
				watchlistSection.dataset.htmlRendered = 'false';
				return false;
			}
			
			LOG('Watchlist content is valid');
			watchlistSection.dataset.htmlRendered = 'true';
			return true;
			
		} catch (err) {
			ERR('Error validating watchlist content:', err);
			watchlistSection.dataset.htmlRendered = 'false';
			return false;
		}
	}

	// Set up observer to watch for home page navigation
	function setupWatchlistSectionObserver() {
		// Check immediately in case we're already on home page
		if (window.location.href.includes('#/home')) {
			renderWatchlist();
		}
		
		// Create a MutationObserver to watch for empty watchlist containers
		const observer = new MutationObserver((mutations) => {
			mutations.forEach((mutation) => {
				// Check for added nodes
				if (mutation.type === 'childList') {
					mutation.addedNodes.forEach((node) => {
						if (node.nodeType === Node.ELEMENT_NODE) {
							// Check if this is a library page that became visible
							if (node.classList && node.classList.contains('homePage') && !node.classList.contains('hide')) {
								checkForEmptyWatchlist();
							}
							
							// Also check any library pages within the added node
							const libraryPages = node.querySelectorAll ? node.querySelectorAll('.homePage:not(.hide)') : [];
							libraryPages.forEach(libraryPage => {
								checkForEmptyWatchlist();
							});
						}
					});
				}
				
				// Check for attribute changes (like removing 'hide' class)
				if (mutation.type === 'attributes' && mutation.attributeName === 'class') {
					const target = mutation.target;
					if (target.classList && target.classList.contains('homePage') && !target.classList.contains('hide')) {
						checkForEmptyWatchlist();
					}
				}
			});
		});
		
		// Start observing
		observer.observe(document.body, {
			childList: true,
			subtree: true,
			attributes: true,
			attributeFilter: ['class']
		});
		
		// Function to check for empty watchlist container
		function checkForEmptyWatchlist() {
			const visibleWatchlistSections = document.querySelectorAll('.libraryPage:not(.hide) .sections.watchlist');

			visibleWatchlistSections.forEach(section => {
				if (section.children.length === 0) {
					LOG('Empty watchlist container found, initializing...');
					renderWatchlist();
				}
			});
		}
	}


	// Initialize the watchlist section observer
	setupWatchlistSectionObserver();

	// Initialize hash change listener for browser navigation
	setupHashChangeListener();

	function showEmptyWatchlistMessage() {
		// Find the empty message in the watchlist tab
		const emptyMessage = document.querySelector('div[data-tab="watchlist"] .watchlist-empty-message');
		if (emptyMessage) {
			emptyMessage.style.display = 'block';
		}
	}

	function hideEmptyWatchlistMessage() {
		const emptyMessage = document.querySelector('div[data-tab="watchlist"] .watchlist-empty-message');
		if (emptyMessage) {
			emptyMessage.style.display = 'none';
		}
	}

	// Update watchlist header stats based on current cache data
	function updateWatchlistHeaderStats() {
		const showsCount = watchlistCache.series.data.length;
		const seasonsCount = watchlistCache.seasons.data.length;
		const episodesCount = watchlistCache.episodes.data.length;
		const moviesCount = watchlistCache.movies.data.length;

		// Update or hide shows stats
		const showsStats = getElementByIdSafe('watchlist-stats-shows');
		if (showsStats) {
			if (showsCount > 0) {
				showsStats.style.display = 'flex';
				getElementByIdSafe('watchlist-shows-count').textContent = `${showsCount} Show${showsCount === 1 ? '' : 's'}`;
			} else {
				showsStats.style.display = 'none';
			}
		}

		// Update or hide seasons stats
		const seasonsStats = getElementByIdSafe('watchlist-stats-seasons');
		if (seasonsStats) {
			if (seasonsCount > 0) {
				seasonsStats.style.display = 'flex';
				getElementByIdSafe('watchlist-seasons-count').textContent = `${seasonsCount} Season${seasonsCount === 1 ? '' : 's'}`;
			} else {
				seasonsStats.style.display = 'none';
			}
		}

		// Update or hide episodes stats
		const episodesStats = getElementByIdSafe('watchlist-stats-episodes');
		if (episodesStats) {
			if (episodesCount > 0) {
				episodesStats.style.display = 'flex';
				getElementByIdSafe('watchlist-episodes-count').textContent = `${episodesCount} Episode${episodesCount === 1 ? '' : 's'}`;
			} else {
				episodesStats.style.display = 'none';
			}
		}

		// Update or hide movies stats
		const moviesStats = getElementByIdSafe('watchlist-stats-movies');
		if (moviesStats) {
			if (moviesCount > 0) {
				moviesStats.style.display = 'flex';
				getElementByIdSafe('watchlist-movies-count').textContent = `${moviesCount} Movie${moviesCount === 1 ? '' : 's'}`;
			} else {
				moviesStats.style.display = 'none';
			}
		}
	}

	// Setup layout toggle button functionality
	function setupLayoutToggle() {
		const layoutToggleBtn = getElementByIdSafe('watchlist-layout-toggle');
		if (layoutToggleBtn) {
			layoutToggleBtn.addEventListener('click', () => {
				const libraryPage = document.querySelector('.libraryPage:not(.hide)');
				const watchlistTab = libraryPage?.querySelector('div[data-tab="watchlist"]');
				if (watchlistTab) {
					const currentLayout = watchlistTab.getAttribute('data-layout') || 'Default';
					const newLayout = currentLayout === 'Default' ? 'List' : 'Default';
					watchlistTab.setAttribute('data-layout', newLayout);
					
					// Update button icon based on layout
					const icon = layoutToggleBtn.querySelector('.material-icons');
					if (icon) {
						if (newLayout === 'List') {
							icon.classList.add('view_list');
							icon.classList.remove('view_module');
						} else {
							icon.classList.add('view_module');
							icon.classList.remove('view_list');
						}
					}
					
					LOG(`Layout switched to: ${newLayout}`);
				}
			});
			LOG('Layout toggle button setup complete');
		}
	}

	function showEmptyProgressMessage() {
		const emptyMessage = document.querySelector('div[data-tab="progress"] .progress-empty-message');
		if (emptyMessage) {
			emptyMessage.style.display = 'block';
		}
	}

	function showEmptySearchMessage() {
		const emptyMessage = document.querySelector('div[data-tab="progress"] .progress-empty-message');
		if (emptyMessage) {
			// Update the message for search results
			const title = emptyMessage.querySelector('.empty-message-title');
			const subtitle = emptyMessage.querySelector('.empty-message-subtitle');
			
			if (title) title.textContent = 'No Series Found';
			if (subtitle) subtitle.textContent = `No series match "${progressCache.searchTerm}". Try a different search term.`;
			
			emptyMessage.style.display = 'block';
		}
	}

	function hideEmptyProgressMessage() {
		const emptyMessage = document.querySelector('div[data-tab="progress"] .progress-empty-message');
		if (emptyMessage) {
			// Reset message to default
			const title = emptyMessage.querySelector('.empty-message-title');
			const subtitle = emptyMessage.querySelector('.empty-message-subtitle');
			
			if (title) title.textContent = 'No Progress to Show';
			if (subtitle) subtitle.textContent = 'Start watching some shows to track your progress here';
			
			emptyMessage.style.display = 'none';
		}
	}

	function showEmptyHistoryMessage() {
		const emptyMessage = document.querySelector('div[data-tab="history"] .movie-history-empty-message');
		if (emptyMessage) {
			emptyMessage.style.display = 'block';
		}
	}

	function hideEmptyHistoryMessage() {
		const emptyMessage = document.querySelector('div[data-tab="history"] .movie-history-empty-message');
		if (emptyMessage) {
			emptyMessage.style.display = 'none';
		}
	}

	LOG('Watchlist functionality initialized');

	// Get watchlist tab index, fetching if not yet set
	async function getWatchlistTabIndex() {
		if (_watchlistTabIndex !== null) {
			return _watchlistTabIndex;
		}

		// Fetch the tab index as we do in addCustomMenuLink
		try {
			const response = await fetch(`${ApiClient._serverAddress}/CustomTabs/Config`, {
				method: "GET",
				headers: {
					"Content-Type": "application/json",
					"X-Emby-Token": ApiClient._serverInfo.AccessToken || ApiClient.accessToken(),
				},
			});
			const data = await response.json();
			data.forEach((tab, index) => {
				if (tab.ContentHtml.indexOf('sections watchlist') !== -1) {
					_watchlistTabIndex = index + 2;
					LOG('Fetched and stored watchlist tab index:', _watchlistTabIndex);
				}
			});
		} catch (err) {
			ERR('Failed to fetch watchlist tab index:', err);
		}

		return _watchlistTabIndex;
	}

	// Function to fetch episodes and enhance progress bars on the watchlist tab
	async function fetchEpisodesAndEnhanceProgressBar() {
		const watchlistSection = getWatchlistSection();
		if (!watchlistSection) {
			LOG('Watchlist section not found, skipping progress bar enhancement');
			return;
		}

		const progressTab = watchlistSection.querySelector('div[data-tab="progress"]');
		if (!progressTab) {
			LOG('Progress tab not found, skipping progress bar enhancement');
			return;
		}

		// Find all progress cards with progress bars
		const progressCards = progressTab.querySelectorAll('.progress-card');
		if (progressCards.length === 0) {
			LOG('No progress cards found, skipping progress bar enhancement');
			return;
		}

		LOG(`Found ${progressCards.length} progress cards, enhancing progress bars with episode details`);

		// Enhance each progress bar
		for (const card of progressCards) {
			const progressBar = card.querySelector('.progress-bar');
			if (!progressBar) continue;

			const seriesIdElement = card.querySelector('[data-series-id]');
			if (!seriesIdElement) continue;

			const seriesId = seriesIdElement.getAttribute('data-series-id');
			if (!seriesId) continue;

			// Only enhance if it has binary chunks (already rendered)
			const hasBinaryChunks = progressBar.querySelectorAll('.binary-chunk').length > 0;
			if (!hasBinaryChunks) continue;

			try {
				const episodes = await fetchEpisodesForSeries(seriesId);
				if (episodes && episodes.length > 0) {
					enhanceProgressBarWithEpisodes(progressBar, episodes);
					LOG(`Enhanced progress bar with episode details for series: ${seriesId}`);
				}
			} catch (err) {
				ERR(`Failed to enhance progress bar for series ${seriesId}:`, err);
			}
		}
	}

	// Register onViewPage handler to call setActiveTab
	if (window.KefinTweaksUtils && window.KefinTweaksUtils.onViewPage) {
		window.KefinTweaksUtils.onViewPage(async (view, element, hash) => {
			LOG('onViewPage handler triggered for view:', view);
			renderWatchlist();

			// Check if we're on the watchlist tab
			const watchlistTabIndex = await getWatchlistTabIndex();
			if (watchlistTabIndex !== null && hash) {
				// Get current tab from URL
				const hashParams = hash.includes('?') ? hash.split('?')[1] : '';
				const urlParams = new URLSearchParams(hashParams);
				const currentTab = urlParams.get('tab');
				const currentTabIndex = currentTab ? parseInt(currentTab, 10) : 0;

				if (currentTabIndex === watchlistTabIndex) {
					LOG('On watchlist tab, enhancing progress bars with episode details');
					// Small delay to let initial render complete
					setTimeout(() => {
						//fetchEpisodesAndEnhanceProgressBar();
					}, 100);
				}
			}
		}, {
			pages: ['home', 'home.html'] // Only trigger for home page where watchlist tabs are
		});
		LOG('Registered onViewPage handler for setActiveTab');
	} else {
		WARN('KefinTweaksUtils.onViewPage not available');
	}

	function addCustomMenuLink() {
		LOG('Adding custom menu link for Watchlist tab');
		if (window.KefinTweaksUtils && window.KefinTweaksUtils.addCustomMenuLink) {
			fetch(`${ApiClient._serverAddress}/CustomTabs/Config`, {
				method: "GET",
				headers: {
				"Content-Type": "application/json",
				"X-Emby-Token": ApiClient._serverInfo.AccessToken || ApiClient.accessToken(),
				},
			})
			.then((r) => r.json())
			.then((data) => {
				console.log(data);
				data.forEach((tab, index) => {
					if (tab.ContentHtml.indexOf('sections watchlist') !== -1) {
						const watchlistTabIndex = index + 2;
						_watchlistTabIndex = watchlistTabIndex; // Store the tab index
						let homePageSuffix = '.html';
						if (ApiClient._serverInfo.Version?.split('.')[1] > 10) {
							homePageSuffix = '';
						}
						window.KefinTweaksUtils.addCustomMenuLink(
							'Watchlist', 
							'bookmark', 
							`#/home${homePageSuffix}?tab=${watchlistTabIndex}`
						);
						LOG('Added custom menu link to side menu for Watchlist tab');
					}
				});
			})
			.catch(console.error);
		}
	}

	addCustomMenuLink();

	// Initialize playback monitoring
	initializePlaybackMonitoring();

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
		
		// Check if card has data-type attribute - if not, don't add watchlist button
		const itemType = card.getAttribute('data-type');
		if (!itemType) {
			LOG('Card has no data-type, skipping watchlist button');
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
		watchlistButton.className = 'watchlist-button cardOverlayButton cardOverlayButton-hover itemAction paper-icon-button-light emby-button button-flat';
		watchlistButton.setAttribute('data-action', 'none');
		watchlistButton.setAttribute('data-id', itemId);
		watchlistButton.setAttribute('data-active', 'false');
		watchlistButton.title = 'Add to Watchlist';
		
		// Create the bookmark icon
		const watchlistIcon = document.createElement('span');
		watchlistIcon.className = 'material-icons cardOverlayButtonIcon cardOverlayButtonIcon-hover watchlist';
		watchlistIcon.setAttribute('aria-hidden', 'true');
		
		watchlistButton.appendChild(watchlistIcon);
		
		// Add click event listener
		watchlistButton.addEventListener('click', async (e) => {
			e.preventDefault();
			e.stopPropagation();
			
			// Toggle watchlist status
			const newRating = watchlistButton.dataset.active === 'false' ? 'true' : 'false';
			await ApiClient.updateUserItemRating(ApiClient.getCurrentUserId(), itemId, newRating);
			watchlistButton.dataset.active = newRating;
			
			// Update icon and title based on state
			const isActive = watchlistButton.dataset.active === 'true';
			// Icon state is handled by CSS class, no need to change textContent
			watchlistButton.title = isActive ? 'Remove from Watchlist' : 'Add to Watchlist';
			
			// Update watchlist cache immediately
			await updateWatchlistCacheOnToggle(itemId, itemType, isActive);
		});
		
		// Check if item type is supported for watchlist
		if (itemType !== "Movie" && itemType !== "Series" && itemType !== "Season" && itemType !== "Episode") {
			return;
		}

        if (!ApiClient._loggedIn) {
			LOG('User is not logged in, skipping watchlist button');
			return;
		}
		
		// Check item's current watchlist status from cache only (no server fetch)
		// Map itemType to section name
		let sectionName;
		switch (itemType) {
			case 'Movie':
				sectionName = 'movies';
				break;
			case 'Series':
				sectionName = 'series';
				break;
			case 'Season':
				sectionName = 'seasons';
				break;
			case 'Episode':
				sectionName = 'episodes';
				break;
			default:
				// Unknown type, skip check
				break;
		}
		
		if (sectionName) {
			// First check in-memory cache
			let isInWatchlist = false;
			if (watchlistCache[sectionName] && watchlistCache[sectionName].data) {
				isInWatchlist = watchlistCache[sectionName].data.some(item => item.Id === itemId);
			}
			
			// If not in memory cache, check localStorage cache
			if (!isInWatchlist) {
				const cachedData = localStorageCache.get(`watchlist_${sectionName}`);
				if (cachedData && Array.isArray(cachedData)) {
					isInWatchlist = cachedData.some(item => item.Id === itemId);
				}
			}
			
			// Set button state if item is in watchlist
			if (isInWatchlist) {
				watchlistButton.dataset.active = 'true';
				watchlistButton.title = 'Remove from Watchlist';
			}
		}
		
		// Add the watchlist button to the button container, right before the play state button if it exists
		const playStateButton = buttonContainer.querySelector('button[is="emby-playstatebutton"]');
		if (playStateButton) {
			buttonContainer.insertBefore(watchlistButton, playStateButton);
		} else {
			buttonContainer.appendChild(watchlistButton);
		}
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
	function addDetailPageWatchlistButton(item = null) {
		const trailerButton = document.querySelector('.itemDetailPage:not(.hide) .btnPlayTrailer');
		
		if (!trailerButton) {
			return;
		}
		
		// Check if watchlist button already exists
		const existingButton = document.querySelector('.itemDetailPage:not(.hide) .watchlist-icon');
		if (existingButton) {
			return;
		}

		const isTVLayout = document.getRootNode().documentElement.className.includes('layout-tv')
		
		const watchlistIcon = document.createElement('button');
		watchlistIcon.setAttribute("is", "emby-button");
		watchlistIcon.className = `watchlist-icon detailButton emby-button button-flat${isTVLayout ? ' show-focus' : ''}`;	
		watchlistIcon.title = "Add to Watchlist";
		watchlistIcon.dataset.active = 'false';
		
		// Add the content wrapper and icon span inside the button
		const contentWrapper = document.createElement('div');
		contentWrapper.className = 'detailButton-content';
		
		const iconSpan = document.createElement('span');
		iconSpan.className = 'material-icons detailButton-icon watchlist';
		iconSpan.setAttribute('aria-hidden', 'true');
		
		contentWrapper.appendChild(iconSpan);
		watchlistIcon.appendChild(contentWrapper);
		
		// Get item ID from URL
		const itemId = window.location.href.substring(window.location.href.indexOf("id=") + 3, window.location.href.indexOf("id=") + 35);
		
		watchlistIcon.addEventListener('click', async () => {
			const newRating = watchlistIcon.dataset.active === 'false' ? 'true' : 'false';
			await ApiClient.updateUserItemRating(ApiClient.getCurrentUserId(), itemId, newRating);
			watchlistIcon.dataset.active = newRating;
			
			// Update title based on state
			const isActive = watchlistIcon.dataset.active === 'true';
			watchlistIcon.title = isActive ? 'Remove from Watchlist' : 'Add to Watchlist';
			
			// Update watchlist cache immediately
			// Get item type from the item data we already have
			const item = await ApiClient.getItem(ApiClient.getCurrentUserId(), itemId);
			if (item) {
				await updateWatchlistCacheOnToggle(itemId, item.Type, isActive);
			}
		});	
		
		if (item) {
			// Set initial state based on current watchlist status
			if (item.UserData && item.UserData.Likes) {
				watchlistIcon.dataset.active = 'true';
				watchlistIcon.title = 'Remove from Watchlist';
			}
		} else {
			// Get item data to check if it should be shown and current state
			ApiClient.getItem(ApiClient.getCurrentUserId(), itemId).then((item) => {
				// Only show for Movies, Series, Seasons, and Episodes
				if (item.Type !== "Movie" && item.Type !== "Series" && item.Type !== "Season" && item.Type !== "Episode") {
					watchlistIcon.style.display = "none";
				}

				if (item.UserData && item.UserData.Played) {
					watchlistIcon.style.display = "none";
				}
				
				// Set initial state based on current watchlist status
				if (item.UserData && item.UserData.Likes) {
					watchlistIcon.dataset.active = 'true';
					watchlistIcon.title = 'Remove from Watchlist';
				}
			}).catch(err => {
				ERR('Error fetching item data:', err);
			});
		}

		// Add button after trailer button
		trailerButton.after(watchlistIcon);
	}

	// Function to monitor item detail pages using onViewPage
	function initializeItemDetailPageHandler() {
		if (!window.KefinTweaksUtils || !window.KefinTweaksUtils.onViewPage) {
			WARN('KefinTweaksUtils.onViewPage not available, retrying in 1 second');
			setTimeout(initializeItemDetailPageHandler, 1000);
			return;
		}

		LOG('Registering item detail page handler with KefinTweaksUtils');

		window.KefinTweaksUtils.onViewPage(async (view, element, hash, itemPromise) => {
			// Await the item promise to get the actual item data
			const item = await itemPromise;
			
			// Small delay to ensure details DOM is ready
			setTimeout(() => {
				const visibleItemDetailPage = document.querySelector('.itemDetailPage:not(.hide)');
				if (!visibleItemDetailPage) {
					return;
				}

				if (visibleItemDetailPage.dataset.watchlistButtonAdded === 'true') {
					return;
				}
				
				// Check if watchlist button already exists
				const existingButton = document.querySelector('.itemDetailPage:not(.hide) .watchlist-icon');
				if (existingButton) {
					return;
				}

				// Check if item is provided and if item type is supported for watchlist
				if (item && (item.Type === "Movie" || item.Type === "Series" || item.Type === "Season" || item.Type === "Episode")) {
					visibleItemDetailPage.dataset.watchlistButtonAdded = 'true';
					addDetailPageWatchlistButton(item);
				}
			}, 100);
		}, {
			pages: ['details']
		});

		LOG('Item detail page handler initialized via KefinTweaksUtils');
	}

	// Initialize the item detail page handler
	if (document.readyState === 'loading') {
		document.addEventListener('DOMContentLoaded', initializeItemDetailPageHandler);
	} else {
		initializeItemDetailPageHandler();
	}

	// Function to add watchlist button to a slide
	function addSlideWatchlistButton(slide) {
		// Check if watchlist button already exists
		const existingButton = slide.querySelector('.watchlist-button');
		if (existingButton) {
			return;
		}

		// Get item ID from slide
		const itemId = slide.getAttribute('data-item-id');
		if (!itemId) {
			WARN('Could not find data-item-id on slide element');
			return;
		}

		// Find the button container
		const buttonContainer = slide.querySelector('.button-container');
		if (!buttonContainer) {
			WARN('Could not find .button-container in slide');
			return;
		}

		// Find the play button to insert after it
		const playButton = slide.querySelector('.btnPlay.play-button');
		if (!playButton) {
			WARN('Could not find play button in slide');
			return;
		}

		// Create watchlist button (empty button, icon added via CSS ::before)
		const watchlistButton = document.createElement('button');
		watchlistButton.type = 'button';
		watchlistButton.className = 'watchlist-button';
		watchlistButton.setAttribute('data-item-id', itemId);
		watchlistButton.setAttribute('data-active', 'false');
		watchlistButton.title = 'Add to Watchlist';

		// Add click event listener
		watchlistButton.addEventListener('click', async (e) => {
			e.preventDefault();
			e.stopPropagation();

			// Toggle watchlist status
			const newRating = watchlistButton.dataset.active === 'false' ? 'true' : 'false';
			await ApiClient.updateUserItemRating(ApiClient.getCurrentUserId(), itemId, newRating);
			watchlistButton.dataset.active = newRating;

			// Update title based on state
			const isActive = watchlistButton.dataset.active === 'true';
			watchlistButton.title = isActive ? 'Remove from Watchlist' : 'Add to Watchlist';

			// Update watchlist cache immediately
			const item = await ApiClient.getItem(ApiClient.getCurrentUserId(), itemId);
			if (item) {
				await updateWatchlistCacheOnToggle(itemId, item.Type, isActive);
			}
		});

		// Check if item type is supported for watchlist
		ApiClient.getItem(ApiClient.getCurrentUserId(), itemId).then((item) => {
			// Only show for Movies, Series, Seasons, and Episodes
			if (item.Type !== "Movie" && item.Type !== "Series" && item.Type !== "Season" && item.Type !== "Episode") {
				watchlistButton.style.display = "none";
				return;
			}

			// Set initial state based on current watchlist status
			if (item.UserData && item.UserData.Likes) {
				watchlistButton.dataset.active = 'true';
				watchlistButton.title = 'Remove from Watchlist';
			}
		}).catch(err => {
			ERR('Error fetching item data for slide watchlist button:', err);
		});

		// Insert button after play button
		playButton.parentNode.insertBefore(watchlistButton, playButton.nextSibling);
	}

	// Function to monitor slides container for MediaBar Plugin
	function monitorSlidesContainer() {
		const observer = new MutationObserver((mutations) => {
			mutations.forEach((mutation) => {
				if (mutation.type === 'childList') {
					// Check for added nodes
					mutation.addedNodes.forEach((node) => {
						if (node.nodeType === Node.ELEMENT_NODE) {
							// Check if the added node is a slide
							if (node.classList && node.classList.contains('slide')) {
								addSlideWatchlistButton(node);
							}

							// Check for slides within the added node
							const slides = node.querySelectorAll && node.querySelectorAll('.slide');
							if (slides && slides.length > 0) {
								slides.forEach((slide) => {
									addSlideWatchlistButton(slide);
								});
							}
						}
					});
				}
			});
		});

		// Check if slides container already exists
		const slidesContainer = document.querySelector('#slides-container');
		if (slidesContainer) {
			// Process existing slides
			const existingSlides = slidesContainer.querySelectorAll('.slide');
			existingSlides.forEach((slide) => {
				addSlideWatchlistButton(slide);
			});

			// Start observing the slides container
			observer.observe(slidesContainer, {
				childList: true,
				subtree: true
			});
		}

		// Also watch for slides container to be added
		const containerObserver = new MutationObserver(() => {
			const slidesContainer = document.querySelector('#slides-container');
			if (slidesContainer) {
				// Process existing slides
				const existingSlides = slidesContainer.querySelectorAll('.slide');
				existingSlides.forEach((slide) => {
					addSlideWatchlistButton(slide);
				});

				// Start observing the slides container
				observer.observe(slidesContainer, {
					childList: true,
					subtree: true
				});

				// Disconnect the container observer since we've found it
				containerObserver.disconnect();
			}
		});

		// Start observing the entire document body for the slides container
		containerObserver.observe(document.body, {
			childList: true,
			subtree: true
		});
	}

	// Initialize the slides container observer
	monitorSlidesContainer();

    // Debug functions for troubleshooting (available in console)
    window.debugWatchlistButtons = function() {
        LOG('Manual debug trigger called');
        LOG('Current overlay containers:', document.querySelectorAll('.cardOverlayContainer').length);
        LOG('Current watchlist buttons:', document.querySelectorAll('.watchlist-button').length);
        processExistingOverlayContainers();
    };

    window.debugWatchlistRendering = function() {
        LOG('Manual watchlist rendering trigger called');
        renderWatchlist();
    };

    window.debugWatchlistOptimization = function() {
        LOG('Watchlist optimization debug');
        const watchlistSection = getWatchlistSection();
        if (!watchlistSection) {
            LOG('No watchlist section found');
            return;
        }
        
        const containers = [
            { name: 'Movies', el: watchlistSection.querySelector('.watchlist-movies') },
            { name: 'Series', el: watchlistSection.querySelector('.watchlist-series') },
            { name: 'Seasons', el: watchlistSection.querySelector('.watchlist-seasons') },
            { name: 'Episodes', el: watchlistSection.querySelector('.watchlist-episodes') }
        ];
        
        containers.forEach(({ name, el }) => {
            if (el) {
                const dataIds = Array.from(el.querySelectorAll('[data-id]'))
                    .map(card => card.getAttribute('data-id'))
                    .sort();
                const childCount = el.children.length;
                LOG(`${name}: ${childCount} children, data-ids=[${dataIds.join(', ')}]`);
            } else {
                LOG(`${name}: container not found`);
            }
        });
    };

    window.debugDetailPageWatchlist = function() {
        LOG('Manual detail page watchlist trigger called');
        addDetailPageWatchlistButton();
    };

    window.debugProgressTab = function() {
        LOG('Manual progress tab trigger called');
        renderProgressContent();
    };

    window.debugFetchProgress = async function() {
        LOG('Manual fetch progress trigger called');
        const progress = await fetchAllProgressData();
        LOG('Progress data:', progress);
        return progress;
    };

    window.debugFetchProgressWithMissing = async function() {
        LOG('Manual fetch progress with missing episodes trigger called');
        const apiClient = window.ApiClient;
        const userId = apiClient.getCurrentUserId();
        const serverUrl = apiClient.serverAddress();
        const token = apiClient.accessToken();
        
        const url = `${serverUrl}/Items?IncludeItemTypes=Series&UserId=${userId}&Recursive=true&Fields=UserData,RecursiveItemCount`;
        const res = await fetch(url, { headers: { "Authorization": `MediaBrowser Token=\"${token}\"` } });
        const data = await res.json();
        const series = data.Items || [];
        
        const inProgressSeries = series.filter(series => {
            return series.UserData && series.UserData.PlayedPercentage > 0;
        });
        
        const sortedSeries = sortInProgressSeries(inProgressSeries);
        
        const progressData = await Promise.all(
            sortedSeries.map(async (series) => {
                return await fetchSeriesProgressWithMissingEpisodes(series, userId, serverUrl, token);
            })
        );
        
        LOG('Progress data with missing episodes:', progressData);
        return progressData;
    };

    window.debugSorting = function() {
        LOG('Testing sorting functionality');
        const apiClient = window.ApiClient;
        const userId = apiClient.getCurrentUserId();
        const serverUrl = apiClient.serverAddress();
        const token = apiClient.accessToken();
        
        fetch(`${serverUrl}/Items?IncludeItemTypes=Series&UserId=${userId}&Recursive=true&Fields=UserData,ChildCount,RecursiveItemCount`, { 
            headers: { "Authorization": `MediaBrowser Token=\"${token}\"` } 
        })
        .then(res => res.json())
        .then(data => {
            const series = data.Items || [];
            const inProgressSeries = series.filter(series => {
                return series.UserData && series.UserData.PlayedPercentage > 0;
            });
            
            LOG(`Found ${inProgressSeries.length} series with PlayedPercentage > 0`);
            const sorted = sortInProgressSeries(inProgressSeries);
            
            // Show first 10 series to verify sorting
            LOG('First 10 sorted series:');
            sorted.slice(0, 10).forEach((s, i) => {
                LOG(`${i + 1}. ${s.Name} (${s.Status}) - Premiere: ${s.PremiereDate}, End: ${s.EndDate}`);
            });
        });
    };

    window.debugPagination = function() {
        LOG('Testing pagination functionality');
        LOG('Current cache state:', {
            hasData: progressCache.data.length > 0,
            totalSeries: progressCache.data.length,
            totalPages: progressCache.totalPages,
            pageSize: progressCache.pageSize,
            cachedProgressCount: progressCache.data.length
        });
        
        if (progressCache.data.length > 0) {
            LOG('Testing page retrieval:');
            for (let page = 1; page <= Math.min(3, progressCache.totalPages); page++) {
                const { pageData } = progressPagination.getCachedPage(page);
                LOG(`Page ${page}: ${pageData.length} progress items`);
            }
        } else {
            LOG('No cached data available. Run fetchAllProgressData first.');
        }
    };

    window.debugCache = function() {
        LOG('Cache management functions:');
        LOG('clearProgressCache() - Clear all cached data');
        LOG('isCacheValid() - Check if cache is still valid');
        LOG('Current cache valid:', isCacheValid());
    };

    window.debugPageFetch = async function(page = 1) {
        LOG(`Testing page ${page} fetch`);
        const progress = await fetchProgressForPage(page);
        LOG(`Page ${page} progress data:`, progress);
        return progress;
    };

    window.debugSeriesCache = function() {
        LOG('Series progress cache state:');
        LOG('Cached series count:', progressCache.data.length);
        LOG('Cached series IDs:', progressCache.data.map(item => item.series.Id));
        
        // Show first few cached series
        const cachedSeries = progressCache.data;
        if (cachedSeries.length > 0) {
            LOG('Sample cached series:');
            cachedSeries.slice(0, 3).forEach(progress => {
                LOG(`- ${progress.series.Name}: ${progress.watchedCount}/${progress.totalEpisodes} (${progress.percentage}%)`);
            });
        }
    };

    window.debugPreloading = function() {
        LOG('Testing preloading functionality');
        LOG('Current cache state:', {
            hasSeriesData: progressCache.data.length > 0,
            totalSeries: progressCache.data.length,
            totalPages: progressCache.totalPages,
            cachedProgressCount: progressCache.data.length
        });
        
        // Test preloading
        preloadProgressData();
    };

    window.debugHash = function() {
        LOG('Current hash:', window.location.hash);
        LOG('Parsed params:', getUrlParams());
        LOG('Test updating hash to progress page 2...');
        updateUrlParams('progress', 2);
    };

    window.debugAllProgressData = async function() {
        LOG('Testing new all progress data functionality');
        const allData = await fetchAllProgressData();
        LOG('All progress data loaded:', allData.length, 'items');
        LOG('Cache state:', {
            allDataLoaded: progressCache.allDataLoaded,
            totalItems: progressCache.data.length,
            totalPages: progressCache.totalPages,
            pageSize: progressCache.pageSize
        });
        
        // Show first few items with their last watched dates
        if (allData.length > 0) {
            LOG('First 5 items (sorted by last watched):');
            allData.slice(0, 5).forEach((progress, i) => {
                const lastWatched = progress.lastWatchedEpisode && progress.lastWatchedEpisode.UserData && progress.lastWatchedEpisode.UserData.LastPlayedDate
                    ? new Date(progress.lastWatchedEpisode.UserData.LastPlayedDate).toLocaleString()
                    : 'Never';
                LOG(`${i + 1}. ${progress.series.Name} - Last watched: ${lastWatched}`);
            });
        }
        
        return allData;
    };

    window.debugNewPagination = function(page = 1) {
        LOG(`Testing new pagination for page ${page}`);
        const { pageData, totalPages, currentPage } = progressPagination.getCachedPage(page);
        LOG(`Page ${currentPage}: ${pageData.length} items, ${totalPages} total pages`);
        return { pageData, totalPages, currentPage };
    };

    window.debugStatistics = function() {
        LOG('Testing statistics functionality');
        if (progressCache.allDataLoaded && progressCache.data.length > 0) {
            const stats = calculateProgressStatistics(progressCache.data);
            LOG('Calculated statistics:', stats);
            updateProgressStatistics(progressCache.data);
            LOG('Statistics updated in UI');
            return stats;
        } else {
            LOG('No progress data loaded yet. Run fetchAllProgressData() first.');
            return null;
        }
    };

    window.debugMovieHistory = async function() {
        LOG('Testing movie history functionality');
        const movies = await fetchWatchedMovies();
        LOG('Found watched movies:', movies.length);
        if (movies.length > 0) {
            LOG('Sample movies:');
            movies.slice(0, 3).forEach((movie, i) => {
                LOG(`${i + 1}. ${movie.Name} (${movie.ProductionYear || 'Unknown year'})`);
            });
        }
        return movies;
    };

    window.debugRenderMovieHistory = function() {
        LOG('Testing movie history rendering');
        renderHistoryContent();
    };

    window.debugMoviePagination = function(page = 1) {
        LOG(`Testing movie pagination for page ${page}`);
        const { pageData, totalPages, currentPage } = moviePagination.getCachedPage(page);
        LOG(`Page ${currentPage}: ${pageData.length} movies, ${totalPages} total pages`);
        return { pageData, totalPages, currentPage };
    };

    window.debugMovieCache = function() {
        LOG('Movie cache state:', {
            hasData: movieCache.data.length > 0,
            totalMovies: movieCache.data.length,
            totalPages: movieCache.totalPages,
            pageSize: movieCache.pageSize,
            allDataLoaded: movieCache.allDataLoaded
        });
        
        if (movieCache.data.length > 0) {
            LOG('Sample movies:');
            movieCache.data.slice(0, 3).forEach((movie, i) => {
                const watchedDate = movie.UserData && movie.UserData.LastPlayedDate 
                    ? new Date(movie.UserData.LastPlayedDate).toLocaleString()
                    : 'Unknown';
                LOG(`${i + 1}. ${movie.Name} - Watched: ${watchedDate}`);
            });
        }
    };

    // Expose functions to global scope for onclick handlers
    window.toggleMovieFavorite = toggleMovieFavorite;

    LOG('Initialized successfully');
})();
