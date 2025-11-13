// Remove From Continue Watching
// Adds functionality to remove items from the continue watchlist list
//
// This script adds a "remove from continue watching" button to cards that have
// data-positionticks attribute (indicating they are in progress)
//
// No external dependencies required - self-contained functionality

(function() {
    'use strict';
    
    const LOG = (...args) => console.log('[KefinTweaks RemoveContinue]', ...args);
    const WARN = (...args) => console.warn('[KefinTweaks RemoveContinue]', ...args);
    const ERROR = (...args) => console.error('[KefinTweaks RemoveContinue]', ...args);
    
    LOG('Initializing...');

    // Add CSS for positioning the remove button in top right corner
    const style = document.createElement('style');
    style.textContent = `
        .remove-continue-button {
            position: absolute !important;
            top: 8px !important;
            right: 8px !important;
            z-index: 10 !important;
            background: rgba(0, 0, 0, 0.7) !important;
            border: none !important;
            border-radius: 50% !important;
            width: 32px !important;
            height: 32px !important;
            display: flex !important;
            align-items: center !important;
            justify-content: center !important;
            cursor: pointer !important;
            transition: all 0.2s ease !important;
            opacity: 0 !important;
            transform: scale(0.8) !important;
        }
        
        .cardOverlayContainer:hover .remove-continue-button {
            opacity: 1 !important;
            transform: scale(1) !important;
        }
        
        .remove-continue-button:hover {
            background: rgba(220, 38, 38, 0.9) !important;
            transform: scale(1.1) !important;
        }
        
        .remove-continue-button:disabled {
            opacity: 0.6 !important;
            cursor: not-allowed !important;
            transform: scale(0.9) !important;
        }
        
        .remove-continue-button .material-icons {
            color: white !important;
            font-size: 18px !important;
        }
    `;
    document.head.appendChild(style);

    /************ Remove Continue Watching Button Observer ************/

    // Function to add remove continue watching button to a card overlay container
    function addRemoveContinueButton(overlayContainer) {
        // Check if remove continue button already exists
        if (overlayContainer && overlayContainer.querySelector('.remove-continue-button')) {
            return;
        }
        
        // Find the card parent to get the item ID and check for data-positionticks
        const card = overlayContainer.closest('.card');
        if (!card) {
            WARN('Could not find card parent for overlay container');
            return;
        }
        
        // Only add button to cards with data-positionticks (in progress items)
        const positionTicks = card.getAttribute('data-positionticks');
        if (!positionTicks) {
            return; // Not a continue watching item, skip
        }
        
        const itemId = card.getAttribute('data-id');
        if (!itemId) {
            WARN('Could not find data-id on card element');
            return;
        }
        
        // Find the .cardOverlayButton-br container to position our button before it
        const buttonContainer = overlayContainer.querySelector('.cardOverlayButton-br');
        if (!buttonContainer) {
            WARN('Could not find .cardOverlayButton-br container');
            return;
        }
        
        // Create remove continue watching button
        const removeButton = document.createElement('button');
        removeButton.type = 'button';
        removeButton.className = 'remove-continue-button';
        removeButton.setAttribute('data-action', 'none');
        removeButton.setAttribute('data-id', itemId);
        removeButton.title = 'Remove from Continue Watching';
        
        // Create the close icon
        const removeIcon = document.createElement('span');
        removeIcon.className = 'material-icons';
        removeIcon.textContent = 'close';
        removeIcon.setAttribute('aria-hidden', 'true');
        
        removeButton.appendChild(removeIcon);
        
        // Add click event listener
        removeButton.addEventListener('click', async (e) => {
            e.preventDefault();
            e.stopPropagation();
            
            // Show loading state
            const originalIcon = removeIcon.textContent;
            removeIcon.textContent = 'hourglass_empty';
            removeButton.disabled = true;
            
            try {
                // Call API to remove from continue watching
                await removeFromContinueWatching(itemId);
                
                // Remove the card from the DOM
                card.remove();
                
                LOG(`Successfully removed item ${itemId} from continue watching`);
            } catch (error) {
                ERROR('Failed to remove from continue watching:', error);
                
                // Restore original state on error
                removeIcon.textContent = originalIcon;
                removeButton.disabled = false;
                
                // Show error message to user
                alert('Failed to remove from continue watching. Please try again.');
            }
        });
        
        // Add the button as a sibling before the .cardOverlayButton-br container
        buttonContainer.parentNode.insertBefore(removeButton, buttonContainer);
        
        LOG(`Added remove continue watching button for item ${itemId}`);
    }

    // Function to fetch current user data for an item
    async function fetchUserData(itemId) {
        const userId = ApiClient.getCurrentUserId();
        const serverUrl = ApiClient.serverAddress();
        const token = ApiClient.accessToken();
        
        if (!userId || !serverUrl || !token) {
            throw new Error('Missing required API credentials');
        }
        
        const userDataUrl = `${serverUrl}/UserItems/${itemId}/UserData`;
        
        const response = await fetch(userDataUrl, {
            method: 'GET',
            headers: { 
                "Authorization": `MediaBrowser Token="${token}"`,
                "Content-Type": "application/json"
            }
        });
        
        if (!response.ok) {
            throw new Error(`Failed to fetch user data: ${response.status} ${response.statusText}`);
        }
        
        return await response.json();
    }

    // Function to update user data to reset progress while preserving played status
    async function updateUserDataProgress(itemId, userData) {
        const userId = ApiClient.getCurrentUserId();
        const serverUrl = ApiClient.serverAddress();
        const token = ApiClient.accessToken();
        
        if (!userId || !serverUrl || !token) {
            throw new Error('Missing required API credentials');
        }
        
        // Create updated user data with progress reset
        const updatedUserData = {
            ...userData,
            PlayedPercentage: 0,
            PlaybackPositionTicks: 0
        };
        
        const userDataUrl = `${serverUrl}/UserItems/${itemId}/UserData`;
        
        const response = await fetch(userDataUrl, {
            method: 'POST',
            headers: { 
                "Authorization": `MediaBrowser Token="${token}"`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify(updatedUserData)
        });
        
        if (!response.ok) {
            throw new Error(`Failed to update user data: ${response.status} ${response.statusText}`);
        }
        
        return response;
    }

    // Function to call the API to remove item from continue watching
    async function removeFromContinueWatching(itemId) {
        try {
            // First, fetch the current user data
            const userData = await fetchUserData(itemId);
            
            // Then update it to reset progress while preserving played status
            await updateUserDataProgress(itemId, userData);
            
            LOG(`Successfully reset progress for item ${itemId} while preserving played status`);
        } catch (error) {
            ERROR('Failed to reset progress:', error);
            throw error;
        }
    }

    // Function to process all existing overlay containers
    function processExistingOverlayContainers() {
        const overlayContainers = document.querySelectorAll('.cardOverlayContainer');
        
        overlayContainers.forEach((overlayContainer) => {
            const buttonContainer = overlayContainer.querySelector('.cardOverlayButton-br');
            if (buttonContainer) {
                addRemoveContinueButton(overlayContainer);
            }
        });
    }

    // Set up MutationObserver to watch for new overlay containers
    function setupRemoveContinueButtonObserver() {
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
                                    addRemoveContinueButton(node);
                                }
                            }
                            
                            // Check for overlay containers within the added node
                            const overlayContainers = node.querySelectorAll && node.querySelectorAll('.cardOverlayContainer');
                            if (overlayContainers && overlayContainers.length > 0) {
                                overlayContainers.forEach((overlayContainer) => {
                                    const buttonContainer = overlayContainer.querySelector('.cardOverlayButton-br');
                                    if (buttonContainer) {
                                        addRemoveContinueButton(overlayContainer);
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
    setupRemoveContinueButtonObserver();

    // Debug function for troubleshooting (available in console)
    window.debugRemoveContinueButtons = function() {
        LOG('Manual debug trigger called');
        LOG('Current overlay containers:', document.querySelectorAll('.cardOverlayContainer').length);
        LOG('Current remove continue buttons:', document.querySelectorAll('.remove-continue-button').length);
        LOG('Cards with data-positionticks:', document.querySelectorAll('.card[data-positionticks]').length);
        processExistingOverlayContainers();
    };

    LOG('Initialized successfully');
})();