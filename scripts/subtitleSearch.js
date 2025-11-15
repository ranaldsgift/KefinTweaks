// Jellyfin Subtitle Search Script
// Adds subtitle search functionality to the video OSD
// Allows users to search and download subtitles from remote sources
// Requires: toaster.js module to be loaded before this script

(function() {
    'use strict';
    
    // Common logging function
    const LOG = (...args) => console.log('[KefinTweaks SubtitleSearch]', ...args);
    const WARN = (...args) => console.warn('[KefinTweaks SubtitleSearch]', ...args);
    const ERR = (...args) => console.error('[KefinTweaks SubtitleSearch]', ...args);
    
    LOG('Initializing...');
    
    // State management
    let isInitialized = false;
    let isAddingCCButton = false;
    let onViewPageUnregister = null;
    let dialogCheckInterval = null;
    
    // Configuration
    const CONFIG = {
        searchButtonText: 'Search Subtitles',
        searchIcon: 'search',
        downloadIcon: 'file_download',
        ccIcon: 'closed_caption'
    };
    
    
    /**
     * Check if ApiClient is available
     */
    function isApiClientAvailable() {
        return typeof ApiClient !== 'undefined' && ApiClient && typeof ApiClient.getCurrentUser === 'function';
    }
    
    /**
     * Check if user has subtitle management permissions
     */
    async function checkSubtitlePermissions() {
        if (!isApiClientAvailable()) {
            WARN('ApiClient not available, cannot check subtitle permissions');
            return false;
        }

        if (!ApiClient._loggedIn) {
            LOG('User is not logged in, cannot check subtitle permissions');
            return false;
        }
        
        try {
            const user = await ApiClient.getCurrentUser();
            if (!user || !user.Policy) {
                WARN('User or Policy not available');
                return false;
            }
            
            const hasPermission = user.Policy.EnableSubtitleManagement;
            LOG('Subtitle management permission:', hasPermission);
            return hasPermission;
        } catch (error) {
            ERR('Error checking subtitle permissions:', error);
            return false;
        }
    }
    
    /**
     * Get the current item ID from the OSD
     */
    function getCurrentItemId() {
        const ratingButton = document.querySelector('#videoOsdPage:not(.hide) .btnUserRating');
        if (!ratingButton) {
            WARN('Rating button not found, cannot get item ID');
            return null;
        }
        
        const itemId = ratingButton.getAttribute('data-id');
        LOG('Current item ID:', itemId);
        return itemId;
    }
    
    /**
     * Get the preferred subtitle language
     */
    async function getPreferredLanguage() {
        if (!isApiClientAvailable()) {
            WARN('ApiClient not available, using default language: eng');
            return 'eng';
        }
        
        try {
            const user = await ApiClient.getCurrentUser();
            if (!user || !user.Configuration) {
                return 'eng';
            }
            
            // Try subtitle language preference first
            if (user.Configuration.SubtitleLanguagePreference) {
                LOG('Using subtitle language preference:', user.Configuration.SubtitleLanguagePreference);
                return user.Configuration.SubtitleLanguagePreference;
            }
            
            // Fall back to audio language preference
            if (user.Configuration.AudioLanguagePreference) {
                LOG('Using audio language preference:', user.Configuration.AudioLanguagePreference);
                return user.Configuration.AudioLanguagePreference;
            }
            
            // Default to English
            LOG('Using default language: eng');
            return 'eng';
        } catch (error) {
            ERR('Error getting preferred language:', error);
            return 'eng';
        }
    }
    
    /**
     * Check if CC button already exists
     */
    function ccButtonExists() {
        const existingButton = document.querySelector('#videoOsdPage:not(.hide) .btnSubtitles');
        return existingButton !== null;
    }
    
    /**
     * Create the CC button element
     */
    function createCCButton() {
        const button = document.createElement('button');
        button.setAttribute('is', 'paper-icon-button-light');
        button.className = 'btnSubtitles autoSize paper-icon-button-light';
        button.title = 'Subtitles';
        
        const icon = document.createElement('span');
        icon.className = 'xlargePaperIconButton material-icons closed_caption';
        icon.setAttribute('aria-hidden', 'true');
        
        button.appendChild(icon);
        return button;
    }
    
    /**
     * Add CC button to OSD controls
     */
    function addCCButton() {
        if (isAddingCCButton) {
            LOG('Already in process of adding CC button, skipping');
            return;
        }
        
        if (ccButtonExists()) {
            LOG('CC button already exists, skipping');
            return;
        }
        
        isAddingCCButton = true;
        
        try {
            const buttonsContainer = document.querySelector('#videoOsdPage:not(.hide) .osdControls > .buttons');
            if (!buttonsContainer) {
                WARN('OSD buttons container not found');
                return;
            }
            
            const ratingButton = buttonsContainer.querySelector('.btnUserRating');
            if (!ratingButton) {
                WARN('Rating button not found in buttons container');
                return;
            }
            
            const ccButton = createCCButton();
            
            // Insert CC button before the rating button
            buttonsContainer.insertBefore(ccButton, ratingButton);
            
            // Add click handler to open subtitle dialog
            ccButton.addEventListener('click', () => {
                LOG('CC button clicked, opening subtitle dialog');
                openSubtitleDialog();
            });
            
            LOG('CC button added successfully');
        } catch (error) {
            ERR('Error adding CC button:', error);
        } finally {
            isAddingCCButton = false;
        }
    }
    
    /**
     * Create subtitle dialog with search functionality
     */
    function createSubtitleDialog() {
        const dialog = document.createElement('div');
        dialog.className = 'dialogContainer';
        
        dialog.innerHTML = `
            <div class="focuscontainer dialog actionsheet-not-fullscreen actionSheet centeredDialog opened" 
                 data-history="true" data-removeonclose="true" 
                 style="animation: 140ms ease-out 0s 1 normal both running scaleup; position: fixed; margin: 0px; top: -33px;">
                <div class="actionSheetContent">
                    <h1 class="actionSheetTitle">Subtitles</h1>
                    <button is="emby-button" type="button" class="listItem listItem-button actionSheetMenuItem emby-button" 
                            id="subtitleSearchButton">
                        <span class="actionsheetMenuItemIcon listItemIcon listItemIcon-transparent material-icons ${CONFIG.searchIcon}" 
                              aria-hidden="true"></span>
                        <div class="listItemBody actionsheetListItemBody">
                            <div class="listItemBodyText actionSheetItemText">${CONFIG.searchButtonText}</div>
                        </div>
                    </button>
                    <div class="actionSheetScroller scrollY">
                        <div class="listItem">
                            <div class="listItemBody">
                                <div class="listItemBodyText">No subtitles available</div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        return dialog;
    }
    
    /**
     * Open subtitle dialog
     */
    function openSubtitleDialog() {
        // Remove any existing subtitle dialogs
        const existingDialogs = document.querySelectorAll('.dialogContainer');
        existingDialogs.forEach(dialog => {
            if (dialog.querySelector('.actionSheetTitle')?.textContent === 'Subtitles') {
                dialog.remove();
            }
        });
        
        const dialog = createSubtitleDialog();
        document.body.appendChild(dialog);
        
        // Add search button click handler
        const searchButton = dialog.querySelector('#subtitleSearchButton');
        if (searchButton) {
            searchButton.addEventListener('click', () => {
                LOG('Search button clicked');
                searchSubtitles();
            });
        }
        
        // Add click handler to close dialog when clicking outside
        dialog.addEventListener('click', (e) => {
            if (e.target === dialog) {
                dialog.remove();
            }
        });
        
        LOG('Subtitle dialog opened');
    }
    
    /**
     * Create subtitle search results dialog
     */
    function createSearchResultsDialog() {
        const dialog = document.createElement('div');
        dialog.className = 'dialogContainer';
        dialog.id = 'subtitleSearchResultsDialog';
        let serverName = ApiClient.serverName() ?? 'Jellyfin';
        
        dialog.innerHTML = `
            <div class="focuscontainer dialog actionsheet-not-fullscreen actionSheet centeredDialog opened" 
                 data-history="true" data-removeonclose="true" 
                 style="animation: 140ms ease-out 0s 1 normal both running scaleup; position: fixed; margin: 0px;">
                <div class="actionSheetContent">
                    <span style="padding: 10px 20px;margin: -6px auto 10px;max-width: 450px;background: #c1c1c1;border-radius: 0 0 10px 10px;color: #000000;">If you have ${serverName} open in multiple tabs the subtitle will be downloaded, but the player will not switch to the subtitle and it will appear as if the download is hanging.</span>
                    <h1 class="actionSheetTitle">Subtitle Search Results</h1>
                    <div class="actionSheetScroller scrollY" id="subtitleSearchResults">
                        <div class="listItem">
                            <div class="listItemBody">
                                <div class="listItemBodyText">Searching...</div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        return dialog;
    }
    
    /**
     * Search for subtitles
     */
    async function searchSubtitles() {
        const itemId = getCurrentItemId();
        if (!itemId) {
            ERR('Cannot search subtitles without item ID');
            return;
        }
        
        const language = await getPreferredLanguage();
        
        // Remove any existing search results dialog
        const existingResultsDialog = document.querySelector('#subtitleSearchResultsDialog');
        if (existingResultsDialog) {
            existingResultsDialog.remove();
        }
        
        // Create and show search results dialog
        const resultsDialog = createSearchResultsDialog();
        document.body.appendChild(resultsDialog);
        
        const resultsContainer = resultsDialog.querySelector('#subtitleSearchResults');
        
        // Add click handler to close dialog when clicking outside
        resultsDialog.addEventListener('click', (e) => {
            if (e.target === resultsDialog) {
                resultsDialog.remove();
            }
        });
        
        try {
            LOG('Searching subtitles for item:', itemId, 'language:', language);
            
            if (!isApiClientAvailable()) {
                throw new Error('ApiClient not available for authorization');
            }
            
            const token = ApiClient.accessToken();
            const serverUrl = ApiClient.serverAddress();
            
            const response = await fetch(`${serverUrl}/Items/${itemId}/RemoteSearch/Subtitles/${language}`, {
                method: 'GET',
                headers: {
                    'Accept': 'application/json',
                    'Authorization': `MediaBrowser Token="${token}"`
                }
            });
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            const subtitles = await response.json();
            LOG('Found subtitles:', subtitles.length);
            
            displaySubtitleResults(subtitles, resultsContainer, itemId);
            
        } catch (error) {
            ERR('Error searching subtitles:', error);
            resultsContainer.innerHTML = '<div class="listItem"><div class="listItemBody"><div class="listItemBodyText">Error searching subtitles</div></div></div>';
        }
    }
    
    /**
     * Display subtitle search results
     */
    function displaySubtitleResults(subtitles, container, itemId) {
        if (subtitles.length === 0) {
            container.innerHTML = '<div class="listItem"><div class="listItemBody"><div class="listItemBodyText">No subtitles found</div></div></div>';
            return;
        }
        
        const resultsHTML = subtitles.map(subtitle => {
            const matchType = subtitle.IsHashMatch ? 'Perfect match' : 'Partial match';
            const downloads = subtitle.DownloadCount?.toLocaleString() || '0';
            
            return `
                <div class="listItem listItem-border" data-subid="${subtitle.Id}">
                    <span class="listItemIcon material-icons closed_caption" aria-hidden="true"></span>
                    <div class="listItemBody three-line">
                        <div>${subtitle.Name}</div>
                        <div class="secondary listItemBodyText">
                            <span style="margin-right:1em;">Format: ${subtitle.Format}</span>
                            <span style="margin-right:1em;">${downloads} downloads</span>
                            <span>Framerate: ${subtitle.FrameRate}</span>
                        </div>
                        <div class="secondary listItemBodyText">
                            <span class="inline-flex align-items-center justify-content-center subtitleFeaturePillow">${matchType}</span>
                        </div>
                    </div>
                    <button type="button" is="paper-icon-button-light" 
                            data-subid="${subtitle.Id}" 
                            class="btnDownload listItemButton paper-icon-button-light">
                        <span class="material-icons file_download" aria-hidden="true"></span>
                    </button>
                </div>
            `;
        }).join('');
        
        container.innerHTML = resultsHTML;
        
        // Add download button handlers
        container.querySelectorAll('.btnDownload').forEach(button => {
            button.addEventListener('click', (e) => {
                const subId = e.currentTarget.getAttribute('data-subid');
                const subtitleName = e.currentTarget.closest('.listItem').querySelector('.listItemBody>div:first-child').textContent;
                
                // Hide dialog immediately and show progress
                hideDialogAndShowProgress();
                
                downloadSubtitle(itemId, subId, subtitleName);
            });
        });
    }
    
    /**
     * Get existing subtitle streams from item
     */
    async function getExistingSubtitleStreams(itemId) {
        try {
            if (!isApiClientAvailable()) {
                throw new Error('ApiClient not available');
            }
            
            const token = ApiClient.accessToken();
            const serverUrl = ApiClient.serverAddress();
            
            const response = await fetch(`${serverUrl}/Items/${itemId}`, {
                method: 'GET',
                headers: {
                    'Accept': 'application/json',
                    'Authorization': `MediaBrowser Token="${token}"`
                }
            });
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            const itemData = await response.json();
            const existingSubripStreams = [];
            
            if (itemData.MediaStreams) {
                itemData.MediaStreams.forEach((stream, index) => {
                    if (stream.Type === 'Subtitle' && stream.Codec === 'subrip') {
                        existingSubripStreams.push({
                            index: index,
                            codec: stream.Codec,
                            language: stream.Language,
                            displayTitle: stream.DisplayTitle
                        });
                    }
                });
            }
            
            LOG('Existing subrip streams:', existingSubripStreams);
            return existingSubripStreams;
            
        } catch (error) {
            ERR('Error getting existing subtitle streams:', error);
            return [];
        }
    }
    
    /**
     * Poll for newly added subtitle stream with retry mechanism
     */
    async function pollForNewSubtitleStream(itemId, existingStreams) {
        const maxAttempts = 20;
        const pollInterval = 5000; // 3 seconds
        
        for (let attempt = 1; attempt <= maxAttempts; attempt++) {
            LOG(`Polling attempt ${attempt}/${maxAttempts} for new subtitle stream`);
            
            try {
                const newStreamIndex = await findNewSubtitleStream(itemId, existingStreams);
                
                if (newStreamIndex !== null) {
                    LOG(`New subtitle stream found on attempt ${attempt}`);
                    return newStreamIndex;
                }
                
                // If not the last attempt, wait before trying again
                if (attempt < maxAttempts) {
                    LOG(`No new subtitle found, waiting ${pollInterval}ms before next attempt`);
                    await new Promise(resolve => setTimeout(resolve, pollInterval));
                }
                
            } catch (error) {
                ERR(`Error on polling attempt ${attempt}:`, error);
                
                // If not the last attempt, wait before trying again
                if (attempt < maxAttempts) {
                    await new Promise(resolve => setTimeout(resolve, pollInterval));
                }
            }
        }
        
        LOG('Max polling attempts reached, no new subtitle stream found');
        return null;
    }
    
    /**
     * Find newly added subtitle stream
     */
    async function findNewSubtitleStream(itemId, existingStreams) {
        try {
            if (!isApiClientAvailable()) {
                throw new Error('ApiClient not available');
            }
            
            const token = ApiClient.accessToken();
            const serverUrl = ApiClient.serverAddress();
            
            const response = await fetch(`${serverUrl}/Items/${itemId}`, {
                method: 'GET',
                headers: {
                    'Accept': 'application/json',
                    'Authorization': `MediaBrowser Token="${token}"`
                }
            });
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            const itemData = await response.json();
            const currentSubripStreams = [];
            
            if (itemData.MediaStreams) {
                itemData.MediaStreams.forEach((stream, index) => {
                    if (stream.Type === 'Subtitle' && stream.Codec === 'subrip') {
                        currentSubripStreams.push({
                            index: index,
                            codec: stream.Codec,
                            language: stream.Language,
                            displayTitle: stream.DisplayTitle
                        });
                    }
                });
            }
            
            LOG('Current subrip streams:', currentSubripStreams);
            
            // Find the new stream by comparing with existing ones
            const newStream = currentSubripStreams.find(currentStream => {
                return !existingStreams.some(existingStream => 
                    existingStream.language === currentStream.language &&
                    existingStream.displayTitle === currentStream.displayTitle
                );
            });
            
            if (newStream) {
                LOG('Found new subtitle stream:', newStream);
                return newStream.index;
            }
            
            LOG('No new subtitle stream found');
            return null;
            
        } catch (error) {
            ERR('Error finding new subtitle stream:', error);
            return null;
        }
    }
    
    /**
     * Get session data using device ID
     */
    async function getSession() {
        try {
            if (!isApiClientAvailable()) {
                throw new Error('ApiClient not available');
            }
            
            const token = ApiClient.accessToken();
            const serverUrl = ApiClient.serverAddress();
            const deviceId = ApiClient.deviceId();
            
            if (!deviceId) {
                throw new Error('Device ID not available');
            }
            
            if (!serverUrl) {
                throw new Error('Server URL not available');
            }
            
            LOG('Getting session with deviceId:', deviceId);
            
            // Get session from the endpoint with device ID
            const response = await fetch(`${serverUrl}/Sessions?deviceId=${deviceId}`, {
                method: 'GET',
                headers: {
                    'Accept': 'application/json',
                    'Authorization': `MediaBrowser Token="${token}"`
                }
            });
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            const sessions = await response.json();
            
            // Return the first session if available, or the sessions array itself
            if (Array.isArray(sessions) && sessions.length > 0) {
                LOG('Found session:', sessions[0].Id);
                return sessions[0];
            } else if (sessions && !Array.isArray(sessions)) {
                // If it's not an array, it might be a single session object
                LOG('Found session:', sessions.Id);
                return sessions;
            } else {
                throw new Error('No active session found for device');
            }
            
        } catch (error) {
            ERR('Error getting session:', error);
            throw error;
        }
    }

    /**
     * Send SetSubtitleStreamIndex command as fallback
     */
    async function setSubtitleStreamIndex(sessionId, subtitleStreamIndex) {
        try {
            if (!isApiClientAvailable()) {
                throw new Error('ApiClient not available');
            }
            
            const token = ApiClient.accessToken();
            const serverUrl = ApiClient.serverAddress();
            const userId = ApiClient.getCurrentUserId();
            
            LOG('Sending SetSubtitleStreamIndex command:', {
                sessionId,
                subtitleStreamIndex,
                userId
            });
            
            const response = await fetch(`${serverUrl}/Sessions/${sessionId}/Command`, {
                method: 'POST',
                headers: {
                    'X-Emby-Token': token,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    Name: "SetSubtitleStreamIndex",
                    ControllingUserId: userId,
                    Arguments: { Index: subtitleStreamIndex }
                })
            });
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            const result = await response.text();
            LOG('SetSubtitleStreamIndex command result:', result);
            
            return true;
        } catch (error) {
            ERR('Error sending SetSubtitleStreamIndex command:', error);
            return false;
        }
    }
    
    /**
     * Trigger custom playback progress event (to be called by external progress monitoring)
     */
    function triggerPlaybackProgressEvent(progressData) {
        const event = new CustomEvent('playbackprogress', {
            detail: progressData
        });
        document.dispatchEvent(event);
    }
    
    /**
     * Listen for progress updates to verify subtitle stream change
     */
    function listenForSubtitleStreamChange(sessionId, expectedSubtitleIndex, timeout = 10000) {
        return new Promise((resolve) => {
            let timeoutId;
            let progressListener;
            let checkInterval;
            
            const cleanup = () => {
                if (timeoutId) clearTimeout(timeoutId);
                if (progressListener) {
                    document.removeEventListener('playbackprogress', progressListener);
                }
                if (checkInterval) {
                    clearInterval(checkInterval);
                }
            };
            
            // Set timeout
            timeoutId = setTimeout(() => {
                LOG('Timeout waiting for subtitle stream verification');
                cleanup();
                resolve(false);
            }, timeout);
            
            // Listen for progress updates
            progressListener = (event) => {
                try {
                    const progressData = event.detail;
                    LOG('Progress update received:', progressData);
                    
                    if (progressData && progressData.SubtitleStreamIndex !== undefined) {
                        const currentSubtitleIndex = progressData.SubtitleStreamIndex;
                        LOG('Current subtitle stream index:', currentSubtitleIndex, 'Expected:', expectedSubtitleIndex);
                        
                        if (currentSubtitleIndex === expectedSubtitleIndex) {
                            LOG('Subtitle stream verification successful');
                            cleanup();
                            resolve(true);
                        }
                    }
                } catch (error) {
                    ERR('Error processing progress update:', error);
                }
            };
            
            // Listen for custom progress events
            document.addEventListener('playbackprogress', progressListener);
            
            // Also check current session state periodically as backup
            checkInterval = setInterval(async () => {
                try {
                    const session = await getSession();
                    if (session && session.PlayState && session.PlayState.SubtitleStreamIndex === expectedSubtitleIndex) {
                        LOG('Subtitle stream verified via session check');
                        cleanup();
                        resolve(true);
                    }
                } catch (error) {
                    ERR('Error checking session state:', error);
                }
            }, 1000);
        });
    }
    
    /**
     * Update playback progress with new subtitle stream using PlayNow command
     */
    async function updatePlaybackProgress(subtitleStreamIndex, subtitleName) {
        try {
            if (!isApiClientAvailable()) {
                throw new Error('ApiClient not available');
            }
            
            LOG('Changing subtitle stream to index:', subtitleStreamIndex);
            
            // Get session data
            const session = await getSession();
            const sessionId = session.Id;
            const playState = session.PlayState;
            
            if (!playState) {
                throw new Error('No play state found in session');
            }
            
            const token = ApiClient.accessToken();
            const serverUrl = ApiClient.serverAddress();
            
            // Get current item ID
            const itemId = getCurrentItemId();
            if (!itemId) {
                throw new Error('No current item ID found');
            }
            
            // Prepare PlayNow command parameters
            const params = new URLSearchParams({
                playCommand: "PlayNow",
                itemIds: itemId,
                startPositionTicks: playState.PositionTicks?.toString() || "0",
                subtitleStreamIndex: subtitleStreamIndex.toString(),
                audioStreamIndex: playState.AudioStreamIndex?.toString() || "0"
            });
            
            LOG('PlayNow command parameters:', {
                sessionId,
                itemId,
                startPositionTicks: playState.PositionTicks,
                subtitleStreamIndex,
                audioStreamIndex: playState.AudioStreamIndex
            });
            
            // Use PlayNow command to restart playback with new subtitle
            const commandResponse = await fetch(`${serverUrl}/Sessions/${sessionId}/Playing?${params.toString()}`, {
                method: 'POST',
                headers: {
                    'X-Emby-Token': token
                }
            });
            
            if (!commandResponse.ok) {
                throw new Error(`HTTP ${commandResponse.status}: ${commandResponse.statusText}`);
            }
            
            const commandResult = await commandResponse.text();
            LOG('PlayNow command result:', commandResult);
            
            // Wait a moment for the playback to restart
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            // Verify that the subtitle stream was actually changed
            LOG('Verifying subtitle stream change...');
            const verificationSuccess = await listenForSubtitleStreamChange(sessionId, subtitleStreamIndex, 10000);
            
            if (verificationSuccess) {
                LOG('Subtitle stream changed successfully using PlayNow command');
            } else {
                LOG('PlayNow command did not change subtitle stream, trying SetSubtitleStreamIndex fallback');
                
                // Try the direct command as fallback
                const fallbackSuccess = await setSubtitleStreamIndex(sessionId, subtitleStreamIndex);
                
                if (fallbackSuccess) {
                    LOG('Subtitle stream changed successfully using SetSubtitleStreamIndex fallback');
                } else {
                    throw new Error('Both PlayNow and SetSubtitleStreamIndex commands failed');
                }
            }
            
        } catch (error) {
            ERR('Error changing subtitle stream:', error);
            throw error;
        }
    }


    
    
    
    /**
     * Hide search results dialog and show download progress in top-right
     */
    function hideDialogAndShowProgress() {
        // Hide the search results dialog
        const resultsDialog = document.querySelector('#subtitleSearchResultsDialog');
        if (resultsDialog) {
            resultsDialog.style.display = 'none';
        }
        
        // Show download progress indicator
        showDownloadProgress();
    }
    
    /**
     * Show download progress message
     */
    function showDownloadProgress() {
        if (window.KefinTweaksToaster && window.KefinTweaksToaster.toast) {
            window.KefinTweaksToaster.toast('Downloading subtitle...', null, false);
        }
    }
    
    /**
     * Show download success message
     */
    function showDownloadSuccess() {
        hideDownloadProgress();
        
        if (window.KefinTweaksToaster && window.KefinTweaksToaster.toast) {
            window.KefinTweaksToaster.toast('Subtitle downloaded and activated!');
        }
    }
    
    /**
     * Show download error message
     */
    function showDownloadError(message) {
        hideDownloadProgress();
        
        if (window.KefinTweaksToaster && window.KefinTweaksToaster.toast) {
            window.KefinTweaksToaster.toast(message || 'Failed to download subtitle', '5');
        }
    }
    
    /**
     * Hide download progress UI (no-op now, kept for compatibility)
     */
    function hideDownloadProgress() {
        // No longer needed since we use toaster.toast() which auto-dismisses
    }
    
    /**
     * Download subtitle
     */
    async function downloadSubtitle(itemId, subId, subtitleName) {
        try {
            LOG('Downloading subtitle:', subId);
            
            if (!isApiClientAvailable()) {
                throw new Error('ApiClient not available for authorization');
            }
            
            // Get existing subtitle streams before download
            const existingStreams = await getExistingSubtitleStreams(itemId);
            
            const token = ApiClient.accessToken();
            const serverUrl = ApiClient.serverAddress();
            
            const response = await fetch(`${serverUrl}/Items/${itemId}/RemoteSearch/Subtitles/${subId}`, {
                method: 'POST',
                headers: {
                    'Authorization': `MediaBrowser Token="${token}"`
                }
            });
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            LOG('Subtitle downloaded successfully');
            
            // Poll for new subtitle stream with retry mechanism
            const newSubtitleIndex = await pollForNewSubtitleStream(itemId, existingStreams);
            
            if (newSubtitleIndex !== null) {
                LOG('New subtitle stream found at index:', newSubtitleIndex);
                
                // Update playback progress to use the new subtitle
                await updatePlaybackProgress(newSubtitleIndex, subtitleName);
                
                // Hide progress and show success
                hideDownloadProgress();
                showDownloadSuccess();
                
                // Remove the search results dialog on success
                const resultsDialog = document.querySelector('#subtitleSearchResultsDialog');
                if (resultsDialog) {
                    resultsDialog.remove();
                }
            } else {
                LOG('Could not determine new subtitle stream index after polling');
                
                // Hide progress and show error
                hideDownloadProgress();
                showDownloadError('Could not detect new subtitle');
                
                // Show the dialog again on error
                const resultsDialog = document.querySelector('#subtitleSearchResultsDialog');
                if (resultsDialog) {
                    resultsDialog.style.display = 'block';
                }
            }
            
            // Show success message (optional)
            // You could add a toast notification here
            
        } catch (error) {
            ERR('Error downloading subtitle:', error);
            
            // Hide progress and show error
            hideDownloadProgress();
            showDownloadError('Failed to download subtitle');
            
            // Show the dialog again on error
            const resultsDialog = document.querySelector('#subtitleSearchResultsDialog');
            if (resultsDialog) {
                resultsDialog.style.display = 'block';
            }
        }
    }
    
    /**
     * Add search button to existing subtitle dialogs
     */
    function addSearchButtonToExistingDialogs() {
        const subtitleDialogs = document.querySelectorAll('.dialogContainer:not(.hide)');
        
        subtitleDialogs.forEach(dialog => {
            const title = dialog.querySelector('.actionSheetTitle');
            if (title && title.innerHTML === 'Subtitles') {
                // Check if search button already exists
                if (dialog.querySelector('#subtitleSearchButton')) {
                    return;
                }
                
                const scroller = dialog.querySelector('.actionSheetScroller');
                if (!scroller) {
                    return;
                }
                
                // Create search button
                const searchButton = document.createElement('button');
                searchButton.setAttribute('is', 'emby-button');
                searchButton.type = 'button';
                searchButton.className = 'listItem listItem-button actionSheetMenuItem emby-button';
                searchButton.id = 'subtitleSearchButton';
                
                searchButton.innerHTML = `
                    <span class="actionsheetMenuItemIcon listItemIcon listItemIcon-transparent material-icons ${CONFIG.searchIcon}" 
                          aria-hidden="true"></span>
                    <div class="listItemBody actionsheetListItemBody">
                        <div class="listItemBodyText actionSheetItemText">${CONFIG.searchButtonText}</div>
                    </div>
                `;
                
                // Insert before the title
                title.parentNode.insertBefore(searchButton, title);
                
                // Add CSS offset to the dialog container
                const dialogContainer = dialog.querySelector('.focuscontainer.dialog');
                if (dialogContainer) {
                    const currentTop = dialogContainer.style.top;
                    if (currentTop) {
                        // Parse existing top value and add 33px
                        const currentTopValue = parseInt(currentTop.replace('px', ''));
                        dialogContainer.style.top = `${currentTopValue - 33}px`;
                    } else {
                        // If no existing top value, set to 33px
                        dialogContainer.style.top = '-33px';
                    }
                }
                
                // Add click handler
                searchButton.addEventListener('click', () => {
                    LOG('Search button clicked in existing dialog');
                    searchSubtitles();
                });
                
                
                LOG('Search button added to existing subtitle dialog');
            }
        });
    }
    
    /**
     * Start checking for subtitle dialogs periodically (only when on video page)
     * This is much more efficient than a MutationObserver watching the entire document
     */
    function startDialogCheck() {
        // Clear any existing interval
        if (dialogCheckInterval) {
            clearInterval(dialogCheckInterval);
        }
        
        // Check for dialogs periodically while on video page
        // The interval is automatically stopped when navigating away via onViewPage
        dialogCheckInterval = setInterval(() => {
            addSearchButtonToExistingDialogs();
        }, 500); // Check every 500ms
    }
    
    /**
     * Stop checking for subtitle dialogs
     */
    function stopDialogCheck() {
        if (dialogCheckInterval) {
            clearInterval(dialogCheckInterval);
            dialogCheckInterval = null;
        }
    }
    
    
    /**
     * Initialize subtitle search functionality for video page
     */
    async function initializeForVideoPage() {
        try {
            // Check if ApiClient is available first
            if (!isApiClientAvailable()) {
                LOG('ApiClient not available, skipping initialization');
                return;
            }
            
            // Check permissions first
            const hasPermission = await checkSubtitlePermissions();
            if (!hasPermission) {
                LOG('User does not have subtitle management permission, skipping initialization');
                return;
            }
            
            LOG('User has subtitle management permission, initializing for video page...');
            
            // Add CC button if it doesn't exist
            addCCButton();
            
            // Start checking for subtitle dialogs
            startDialogCheck();
            
            LOG('Subtitle search functionality initialized for video page');
            
        } catch (error) {
            ERR('Error initializing subtitle search:', error);
        }
    }
    
    /**
     * Initialize subtitle search functionality
     */
    async function initialize() {
        if (isInitialized) {
            LOG('Already initialized, skipping');
            return;
        }
        
        try {
            // Check if ApiClient is available first
            if (!isApiClientAvailable()) {
                LOG('ApiClient not available, skipping initialization');
                return;
            }
            
            // Check permissions first
            const hasPermission = await checkSubtitlePermissions();
            if (!hasPermission) {
                LOG('User does not have subtitle management permission, skipping initialization');
                return;
            }
            
            LOG('User has subtitle management permission, initializing...');
            
            // Wait for KefinTweaksUtils to be available
            if (!window.KefinTweaksUtils || !window.KefinTweaksUtils.onViewPage) {
                LOG('KefinTweaksUtils.onViewPage not available, retrying in 1 second');
                setTimeout(initialize, 1000);
                return;
            }
            
            // Register onViewPage handler for video page
            onViewPageUnregister = window.KefinTweaksUtils.onViewPage(async (view, element, hash) => {
                if (hash && hash.includes('#/video')) {
                    LOG('Video page detected via onViewPage, initializing...');
                    // Small delay to ensure OSD is ready
                    setTimeout(() => {
                        initializeForVideoPage();
                    }, 500);
                } else {
                    // Stop dialog checking when not on video page
                    stopDialogCheck();
                }
            }, {
                pages: ['video']
            });
            
            // Also check current page on initial load
            if (window.location.hash.includes('#/video')) {
                setTimeout(() => {
                    initializeForVideoPage();
                }, 500);
            }
            
            isInitialized = true;
            LOG('Subtitle search functionality initialized successfully');
            
        } catch (error) {
            ERR('Error initializing subtitle search:', error);
        }
    }
    
    /**
     * Clean up resources
     */
    function cleanup() {
        stopDialogCheck();
        
        if (onViewPageUnregister) {
            onViewPageUnregister();
            onViewPageUnregister = null;
        }
        
        isInitialized = false;
        LOG('Subtitle search functionality cleaned up');
    }
    
    // Initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initialize);
    } else {
        initialize();
    }
    
    // Expose functions globally for debugging
    window.subtitleSearchCleanup = cleanup;
    window.getSession = getSession;
    window.setSubtitleStreamIndex = setSubtitleStreamIndex;
    window.listenForSubtitleStreamChange = listenForSubtitleStreamChange;
    window.triggerPlaybackProgressEvent = triggerPlaybackProgressEvent;

    LOG('Initialized successfully');    
})();
