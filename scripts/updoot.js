(function() {
    try {
        console.log('Jellyfin Updoot: Initializing');

        if (!document.querySelector('link[href*="material-icons"]')) {
            console.log('Loading Material Icons');
            const link = document.createElement('link');
            link.rel = 'stylesheet';
            link.href = 'https://fonts.googleapis.com/icon?family=Material+Icons';
            document.head.appendChild(link);
        }

        const jellyfinCredentials = JSON.parse(localStorage.getItem('jellyfin_credentials') || '{}');
        const server = jellyfinCredentials.Servers && jellyfinCredentials.Servers[0];
        const apiKey = server ? server.AccessToken : '';
        const serverUrl = server ? server.ManualAddress || server.LocalAddress : window.location.origin;
        const userId = server ? server.UserId : '';
        const backendUrl = `${window.location.origin}/updoot`;
        const adminUserIds = ['ee8996be37aa4da0912a08b410940d3e'];

        console.log('Credentials:', { serverUrl, apiKey, userId, backendUrl, isAdmin: adminUserIds.includes(userId) });

        let recommendButton = null;
        let recommendationsButton = null;
        let adminButton = null;
        let overlay = null;
        let adminOverlay = null;

        async function fetchItemDetails(itemId) {
            console.log('Fetching item details for itemId:', itemId);
            try {
                const url = `${serverUrl}/Items/${itemId}?api_key=${apiKey}`; // Fixed typo from original: 'melalui' to 'apiKey'
                console.log('Requesting:', url);
                const response = await fetch(url, {
                    method: 'GET',
                    headers: { 'X-Emby-Token': apiKey }
                });
                if (!response.ok) {
                    console.error('Fetch item details failed:', `HTTP ${response.status}`);
                    throw new Error(`HTTP ${response.status}: ${await response.text()}`);
                }
                const data = await response.json();
                console.log('Item details received:', data);
                return data;
            } catch (error) {
                console.error('Error fetching item details:', error.message);
                return null;
            }
        }

        function createRecommendButton(playButton) {
            console.log('Attempting to create Recommend button');
            if (!playButton || !playButton.parentNode) {
                console.log('Play button or its parent not found');
                return;
            }
            if (document.querySelector('.itemDetailPage:not(.hide) .btnRecommend')) {
                console.log('Recommend button already exists');
                return;
            }

            console.log('Creating Recommend button');
            recommendButton = document.createElement('button');
            recommendButton.setAttribute('is', 'paper-icon-button-light');
            recommendButton.className = 'btnRecommend detailButton emby-button paper-icon-button-light';
            recommendButton.title = 'Recommend';
            recommendButton.innerHTML = '<span class="material-icons thumb_up" aria-hidden="true"></span>';
			recommendButton.style.width = '43.64px';
			recommendButton.style.height = '43.64px';
			
			ApiClient.getCurrentUser().then((user) => {
				const usersRecommended = document.querySelector('.flyout-user-list');
				
				if (usersRecommended && usersRecommended.innerText.includes(user.name)) {
					recommendButton.dataset.active = 'true';
				} else {
					recommendButton.dataset.active = 'false';
				}				
			});

            try {
                playButton.parentNode.insertBefore(recommendButton, playButton.nextSibling || null);
                console.log('Recommend button inserted');
            } catch (error) {
                console.error('Error inserting Recommend button:', error.message);
                const targetContainer = document.querySelector('.detailPagePrimaryContainer, .detailButton-container');
                if (targetContainer) {
                    targetContainer.appendChild(recommendButton);
                    console.log('Recommend button appended to targetContainer');
                }
            }

            const displayArea = document.createElement('div');
            displayArea.className = 'recommendationArea';
            displayArea.style.padding = '0 10px';
            const targetContainer = playButton.closest('.mainDetailButtons, .detailButton-container, .detailPagePrimaryContainer');
            if (targetContainer) {
                targetContainer.appendChild(displayArea);
                console.log('Recommendation display area added');
            } else {
                console.log('Target container for display area not found');
            }

            createCommentsSection(targetContainer);

            recommendButton.addEventListener('click', () => {
                console.log('Recommend button clicked at ' + new Date().toISOString());
                toggleRecommendation();
				recommendButton.dataset.active = recommendButton.dataset.active === 'true' ? 'false' : 'true';
            });

            updateRecommendationDisplay();
        }

        function createCommentsSection(targetContainer) {
            console.log('Attempting to create comments section');
            if (!targetContainer) {
                console.log('Target container for comments section not found');
                return;
            }
            if (document.querySelector('.commentsSection')) {
                console.log('Comments section already exists');
                return;
            }

            console.log('Creating comments section');
            const commentsSection = document.createElement('div');
            commentsSection.className = 'commentsSection';
            commentsSection.style.cssText = `
                margin-top: 20px;
                padding: 10px;
                background: transparent;
                border-radius: 8px;
                position: relative;
                z-index: 100;
                height: auto;
            `;

            const addCommentButton = document.createElement('button');
            addCommentButton.textContent = '+ Add Comment';
            addCommentButton.className = "btnAddComment button-submit emby-button button-flat show-focus";
            addCommentButton.addEventListener('click', () => {
                console.log('Add Comment button clicked');
                if (!userId) {
                    console.log('No userId, cannot show comment form');
                    alert('Please log in to add a comment');
                    return;
                }
                commentForm.style.display = commentForm.style.display === 'none' ? 'block' : 'none';
            });

            const commentForm = document.createElement('div');
            commentForm.style.display = 'none';
            commentForm.innerHTML = `
                <textarea style="width: 100%; height: 60px; margin-bottom: 10px; border-radius: 4px; padding: 8px;" placeholder="Write your comment..."></textarea>
                <button style="background: #4CAF50; color: white; border: none; padding: 8px 16px; border-radius: 4px; cursor: pointer;">Send</button>
            `;
            const sendButton = commentForm.querySelector('button');
            sendButton.addEventListener('click', () => {
                console.log('Send comment button clicked');
                const textarea = commentForm.querySelector('textarea');
                const comment = textarea.value.trim();
                if (comment) {
                    submitComment(comment).then(() => {
                        textarea.value = '';
                        commentForm.style.display = 'none';
                        updateCommentsDisplay();
                    });
                } else {
                    console.log('Empty comment, not submitting');
                    alert('Comment cannot be empty');
                }
            });

            const commentsDisplay = document.createElement('div');
            commentsDisplay.className = 'commentsDisplay';
            commentsDisplay.style.cssText = `
                margin-top: 10px;
                height: auto;
                overflow-y: visible;
            `;

            commentsSection.appendChild(addCommentButton);
            commentsSection.appendChild(commentForm);
            commentsSection.appendChild(commentsDisplay);

            const primaryContent = document.querySelector('.detailPagePrimaryContent.padded-right');
            if (primaryContent && primaryContent.parentNode) {
                primaryContent.parentNode.insertBefore(commentsSection, primaryContent.nextSibling);
                console.log('Comments section inserted below .detailPagePrimaryContent');
            } else {
                console.log('Primary content not found, appending to targetContainer');
                targetContainer.appendChild(commentsSection);
            }

            updateCommentsDisplay();
        }

        async function submitComment(comment) {
            console.log('Submitting comment for userId:', userId);
            const itemId = getItemId();
            if (!itemId) {
                console.log('No itemId found for comment');
                alert('Cannot add comment: Item not found');
                return;
            }
            if (!userId) {
                console.log('No userId found for comment');
                alert('Please log in to add a comment');
                return;
            }

            try {
                const url = `${backendUrl}/comments`;
                console.log('Submitting comment to:', url, { userId, itemId, comment });
                const response = await fetch(url, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ userId, itemId, comment })
                });
                if (!response.ok) {
                    console.error('Comment submission failed:', `HTTP ${response.status}`);
                    throw new Error(`HTTP ${response.status}: ${await response.text()}`);
                }
                console.log('Comment submitted successfully');
            } catch (error) {
                console.error('Error submitting comment:', error.message);
                alert('Failed to submit comment: ' + error.message);
            }
        }

        async function editComment(commentId, newComment) {
            console.log('Editing comment:', commentId);
            if (!userId) {
                console.log('No userId found for editing comment');
                alert('Please log in to edit comment');
                return;
            }

            try {
                const url = `${backendUrl}/comments/${commentId}`;
                console.log('Editing comment at:', url, { userId, comment: newComment });
                const response = await fetch(url, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ userId, comment: newComment })
                });
                if (!response.ok) {
                    console.error('Comment edit failed:', `HTTP ${response.status}`);
                    throw new Error(`HTTP ${response.status}: ${await response.text()}`);
                }
                console.log('Comment edited successfully');
                updateCommentsDisplay();
            } catch (error) {
                console.error('Error editing comment:', error.message);
                alert('Failed to edit comment: ' + error.message);
            }
        }

        async function deleteComment(commentId) {
            console.log('Deleting comment:', commentId);
            if (!userId) {
                console.log('No userId found for deleting comment');
                alert('Please log in to delete comment');
                return;
            }

            try {
                const url = `${backendUrl}/comments/${commentId}`;
                console.log('Deleting comment at:', url, { userId });
                const response = await fetch(url, {
                    method: 'DELETE',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ userId })
                });
                if (!response.ok) {
                    console.error('Comment deletion failed:', `HTTP ${response.status}`);
                    throw new Error(`HTTP ${response.status}: ${await response.text()}`);
                }
                console.log('Comment deleted successfully');
                updateCommentsDisplay();
            } catch (error) {
                console.error('Error deleting comment:', error.message);
                alert('Failed to delete comment: ' + error.message);
            }
        }

        async function updateCommentsDisplay() {
            console.log('Updating comments display');
            const itemId = getItemId();
            const commentsDisplay = document.querySelector('.commentsDisplay');
            if (!itemId || !commentsDisplay) {
                console.log('Missing itemId or commentsDisplay:', { itemId, commentsDisplay });
                return;
            }

            try {
                const url = `${backendUrl}/comments/${itemId}`;
                console.log('Fetching comments from:', url);
                const response = await fetch(url);
                if (!response.ok) {
                    console.error('Fetch comments failed:', `HTTP ${response.status}`);
                    throw new Error(`HTTP ${response.status}: ${await response.text()}`);
                }
                const comments = await response.json();
                console.log('Comments received:', comments);
                commentsDisplay.innerHTML = '';
                if (comments.length > 0) {
                    comments.forEach(comment => {
                        const commentDiv = document.createElement('div');
                        commentDiv.style.cssText = 'margin-bottom: 8px; display: flex; align-items: flex-start;';
                        commentDiv.innerHTML = `
                            <div style="flex: 1;">
                                <strong style="display: block; margin-bottom: 4px;">${comment.username}</strong>
                                <p>${comment.comment}</p>
                            </div>
                        `;
                        if (comment.userId === userId || adminUserIds.includes(userId)) {
                            const buttonGroup = document.createElement('div');
                            buttonGroup.style.cssText = 'margin-left: 10px; display: flex; flex-direction: column; gap: 4px;';
                            const editButton = document.createElement('button');
                            editButton.textContent = 'Edit';
                            editButton.style.cssText = `
                                background: #2196F3;
                                color: white;
                                border: none;
                                padding: 4px 8px;
                                border-radius: 4px;
                                cursor: pointer;
                            `;
                            editButton.addEventListener('click', () => {
                                console.log('Edit button clicked for comment:', comment.id);
                                const newComment = prompt('Edit your comment:', comment.comment);
                                if (newComment && newComment.trim()) {
                                    editComment(comment.id, newComment.trim());
                                }
                            });
                            const deleteButton = document.createElement('button');
                            deleteButton.textContent = 'Delete';
                            deleteButton.style.cssText = `
                                background: #ff4444;
                                color: white;
                                border: none;
                                padding: 4px 8px;
                                border-radius: 4px;
                                cursor: pointer;
                            `;
                            deleteButton.addEventListener('click', () => {
                                console.log('Delete button clicked for comment:', comment.id);
                                if (confirm('Are you sure you want to delete this comment?')) {
                                    deleteComment(comment.id);
                                }
                            });
                            buttonGroup.appendChild(editButton);
                            buttonGroup.appendChild(deleteButton);
                            commentDiv.appendChild(buttonGroup);
                        }
                        commentsDisplay.appendChild(commentDiv);
                    });
                } else {
                    console.log('No comments to display');
                    commentsDisplay.innerHTML = '<p>No comments yet.</p>';
                }
            } catch (error) {
                console.error('Error fetching comments:', error.message);
                commentsDisplay.innerHTML = '<p>Failed to load comments: ' + error.message + '</p>';
            }
        }

        async function toggleRecommendation() {
            console.log('Toggling recommendation for userId:', userId);
            const itemId = getItemId();
            if (!itemId) {
                console.log('No itemId found');
                alert('Cannot recommend: Item not found');
                return;
            }
            if (!userId) {
                console.log('No userId found in credentials');
                alert('Please log in to recommend');
                return;
            }

            try {
                const url = `${backendUrl}/recommend`;
                console.log('Sending recommendation toggle:', url, { userId, itemId });
                const response = await fetch(url, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ userId, itemId })
                });
                if (!response.ok) {
                    console.error('Recommendation toggle failed:', `HTTP ${response.status}`);
                    throw new Error(`HTTP ${response.status}: ${await response.text()}`);
                }
                const result = await response.json();
                console.log('Toggle response:', result);
                updateRecommendationDisplay();
            } catch (error) {
                console.error('Error toggling recommendation:', error.message);
                alert('Failed to toggle recommendation: ' + error.message);
            }
        }

        async function updateRecommendationDisplay() {
            console.log('Updating recommendation display');
            const itemId = getItemId();
            const displayArea = document.querySelector('.recommendationArea');
            if (!itemId || !displayArea) {
                console.log('Missing itemId or displayArea:', { itemId, displayArea });
                return;
            }

            try {
                const url = `${backendUrl}/recommendations/${itemId}`;
                console.log('Fetching recommendations from:', url);
                const response = await fetch(url);
                if (!response.ok) {
                    console.error('Fetch recommendations failed:', `HTTP ${response.status}`);
                    throw new Error(`HTTP ${response.status}: ${await response.text()}`);
                }
                const recommendations = await response.json();
                console.log('Recommendations received:', recommendations);
				
				displayArea.innerHTML = '';
				
				displayArea.innerHTML = '';

				if (recommendations.length > 0) {
					// Create the "Recommendations" tag element
					const recommendationTag = document.createElement('button');
					recommendationTag.className = 'recommendation-tag';
					recommendationTag.innerHTML = `
						<span class="material-icons thumb_up recommendation icon" aria-hidden="true"></span>
						<span class="recommendation-count">${recommendations.length} ${recommendations.length > 1 ? 'Recommendations' : 'Recommendation'}</span>
					`;

					// Create the flyout element
					const flyout = document.createElement('div');
					flyout.className = 'recommendation-flyout hidden';
					
					// Add the "Recommended by:" heading to the flyout
					const flyoutHeading = document.createElement('h4');
					flyoutHeading.textContent = 'Recommended by:';
					flyout.appendChild(flyoutHeading);

					// Create the user list for the flyout
					const flyoutUserList = document.createElement('ul');
					flyoutUserList.className = 'flyout-user-list';
					
					// Populate the list with usernames from the array
					recommendations.forEach(r => {
						const userItem = document.createElement('li');
						userItem.textContent = r.username;
						flyoutUserList.appendChild(userItem);
					});

					flyout.appendChild(flyoutUserList);

					// Append both the tag and the flyout to the display area
					displayArea.appendChild(recommendationTag);
					displayArea.appendChild(flyout);

					// Add a click event listener to the tag to toggle the flyout
					recommendationTag.addEventListener('click', (e) => {
						e.stopPropagation(); // Prevents the document click from immediately closing it
						flyout.classList.toggle('hidden');
					});

					// Add a global click listener to close the flyout if the user clicks anywhere else
					document.addEventListener('click', (e) => {
						if (!flyout.contains(e.target) && !recommendationTag.contains(e.target)) {
							flyout.classList.add('hidden');
						}
					});
				}
            } catch (error) {
                console.error('Error fetching recommendations:', error.message);
                displayArea.textContent = 'Failed to load recommendations: ' + error.message;
            }
        }

        function getItemId() {
            console.log('Attempting to extract itemId');
            let itemId = null;

            const detailLogo = document.querySelector('.detailLogo.lazy.lazy-image-fadein-fast');
            if (detailLogo) {
                const style = window.getComputedStyle(detailLogo);
                const bgImage = style.backgroundImage;
                console.log('DetailLogo background-image:', bgImage);
                if (bgImage && bgImage.includes('/Items/')) {
                    const match = bgImage.match(/\/Items\/([0-9a-f]{32})\//);
                    itemId = match ? match[1] : null;
                    console.log('DetailLogo itemId:', itemId);
                }
            }

            if (!itemId) {
                const backdropImage = document.querySelector('.backdropImage.displayingBackdropImage.backdropImageFadeIn');
                if (backdropImage) {
                    const style = window.getComputedStyle(backdropImage);
                    let bgImage = style.backgroundImage;
                    console.log('BackdropImage background-image:', bgImage);
                    if (bgImage && bgImage.includes('/Items/')) {
                        const match = bgImage.match(/\/Items\/([0-9a-f]{32})\//);
                        itemId = match ? match[1] : null;
                        console.log('BackdropImage itemId:', itemId);
                    }
                    if (!itemId && backdropImage.dataset.url) {
                        const dataUrl = backdropImage.dataset.url;
                        console.log('BackdropImage data-url:', dataUrl);
                        const match = dataUrl.match(/\/Items\/([0-9a-f]{32})\//);
                        itemId = match ? match[1] : null;
                        console.log('BackdropImage data-url itemId:', itemId);
                    }
                }
            }

            if (!itemId) {
                const urlParams = new URLSearchParams(window.location.search);
                itemId = urlParams.get('id');
                console.log('URLSearchParams itemId:', itemId);
            }

            if (!itemId) {
                const hash = window.location.hash;
                if (hash.includes('details?id=')) {
                    const match = hash.match(/id=([^&]+)/);
                    itemId = match ? match[1] : null;
                    console.log('Hash-based itemId:', itemId);
                }
            }

            if (!itemId) {
                const pathParts = window.location.pathname.split('/');
                itemId = pathParts[pathParts.length - 1];
                console.log('Pathname itemId:', itemId);
            }

            if (!itemId || !/^[0-9a-f]{32}$/.test(itemId)) {
                console.log('Invalid or missing itemId');
                return null;
            }

            console.log('Final extracted itemId:', itemId);
            return itemId;
        }

        function createRecommendationsButton(castButton) {
            if (document.querySelector('.btnRecommendations')) {
                return;
            }
			
            console.log('Attempting to create Recommendations button');
            if (!castButton || !castButton.parentNode) {
                console.log('Cast button or its parent not found');
            }

            console.log('Creating Recommendations button');
            recommendationsButton = document.createElement('button');
            recommendationsButton.setAttribute('is', 'paper-icon-button-light');
            recommendationsButton.className = 'headerButton btnRecommendations emby-button paper-icon-button-light';
            recommendationsButton.title = 'Recommendations';
            recommendationsButton.innerHTML = '<span class="material-icons star" aria-hidden="true"></span>'; // Fixed HTML syntax
            recommendationsButton.style.backgroundColor = '#00ff0000';
            try {
                const castWidth = parseFloat(getComputedStyle(castButton).width) || 40;
                const castHeight = parseFloat(getComputedStyle(castButton).height) || 40;
                recommendationsButton.style.width = `${castWidth * 1.2}px`;
                recommendationsButton.style.height = `${castHeight * 1.2}px`;
            } catch (error) {
                console.error('Error setting Recommendations button size:', error.message);
                recommendationsButton.style.width = '48px';
                recommendationsButton.style.height = '48px';
            }

            try {
                castButton.parentNode.insertBefore(recommendationsButton, castButton);
                console.log('Recommendations button inserted');
            } catch (error) {
                console.error('Error inserting Recommendations button:', error.message);
                const topBar = document.querySelector('.headerRight, .headerTabs, .mainDrawer-scrollContainer, .header');
                if (topBar) {
                    topBar.prepend(recommendationsButton);
                    console.log('Recommendations button appended to topBar');
                }
            }

            recommendationsButton.addEventListener('click', () => {
                console.log('Recommendations button clicked at ' + new Date().toISOString());
                showRecommendationsOverlay();
            });
        }

        function createAdminButton(castButton) {
            if (document.querySelector('.btnAdmin')) {
                return;
            }
			
            console.log('Attempting to create Admin button for userId:', userId);
            if (!adminUserIds.includes(userId)) {
                console.log('User is not an admin, skipping admin button');
                return;
            }

            console.log('Creating Admin button');
            adminButton = document.createElement('button');
            adminButton.setAttribute('is', 'paper-icon-button-light');
            adminButton.className = 'headerButton btnAdmin emby-button paper-icon-button-light';
            adminButton.title = 'Admin Settings';
            adminButton.innerHTML = '<span class="material-icons settings" aria-hidden="true"></span>';
            adminButton.style.backgroundColor = '#00ff0000';
            try {
                if (castButton && castButton.parentNode) {
                    const castWidth = parseFloat(getComputedStyle(castButton).width) || 40;
                    const castHeight = parseFloat(getComputedStyle(castButton).height) || 40;
                    adminButton.style.width = `${castWidth * 1.2}px`;
                    adminButton.style.height = `${castHeight * 1.2}px`;
                    castButton.parentNode.insertBefore(adminButton, castButton);
                    console.log('Admin button inserted next to castButton');
                } else {
                    throw new Error('Cast button or its parent not found');
                }
            } catch (error) {
                console.error('Error setting or inserting Admin button:', error.message);
                adminButton.style.width = '48px';
                adminButton.style.height = '48px';
                const topBar = document.querySelector('.headerRight, .headerTabs, .mainDrawer-scrollContainer, .header');
                if (topBar) {
                    console.log('Appending Admin button to topBar as fallback');
                    topBar.prepend(adminButton);
                } else {
                    console.error('No topBar found for Admin button');
                    return;
                }
            }

            adminButton.addEventListener('click', () => {
                console.log('Admin button clicked at ' + new Date().toISOString());
                try {
                    showAdminOverlay();
                } catch (error) {
                    console.error('Error triggering showAdminOverlay:', error.message);
                    alert('Failed to open admin settings: ' + error.message);
                }
            });
        }

        async function showRecommendationsOverlay() {
            console.log('Opening recommendations overlay for userId:', userId);
            if (!overlay) {
                console.log('Creating recommendations overlay');
                overlay = document.createElement('div');
                overlay.style.cssText = `
                    display: none;
                    position: fixed;
                    top: 5px;
                    left: 5px;
                    width: calc(100% - 10px);
                    height: calc(100% - 10px);
                    background: rgba(0,0,0,0.8);
                    z-index: 1000;
                    color: white;
                    padding: 20px;
                    overflow-y: auto;
                    border: 5px solid #333;
                    box-sizing: border-box;
                    display: flex;
                    flex-wrap: wrap;
                    gap: 10px;
                    align-items: flex-start;
                    justify-content: center;
                `;
                document.body.appendChild(overlay);

                const closeButton = document.createElement('button');
                closeButton.innerHTML = '<span class="material-icons close"></span>';
                closeButton.style.cssText = `
                    position: absolute;
                    top: 10px;
                    right: 10px;
                    background: #ff4444;
                    color: white;
                    border: none;
                    border-radius: 50%;
                    width: 30px;
                    height: 30px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    cursor: pointer;
                `;
                closeButton.addEventListener('click', () => {
                    console.log('Closing recommendations overlay');
                    overlay.style.display = 'none';
                });
                overlay.appendChild(closeButton);

                overlay.addEventListener('click', (e) => {
                    if (e.target === overlay) {
                        console.log('Recommendations overlay clicked outside, closing');
                        overlay.style.display = 'none';
                    }
                });
            }

            const closeButton = overlay.querySelector('button');
            overlay.innerHTML = '';
            if (closeButton) {
                overlay.appendChild(closeButton);
                console.log('Close button reattached to recommendations overlay');
            }

            try {
                const url = `${backendUrl}/recommendations`;
                console.log('Fetching all recommendations from:', url, { userId });
                const response = await fetch(url, {
                    method: 'GET',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-Emby-Token': apiKey // Added for potential backend auth
                    }
                });
                if (!response.ok) {
                    console.error('Fetch recommendations failed:', `HTTP ${response.status}`, await response.text());
                    throw new Error(`HTTP ${response.status}: ${await response.text()}`);
                }
                const recommendations = await response.json();
                console.log('Recommendations received:', recommendations);

                if (!Array.isArray(recommendations) || recommendations.length === 0) {
                    console.log('No recommendations available');
                    const noRecsMessage = document.createElement('p');
                    noRecsMessage.textContent = 'No recommendations available yet.';
                    noRecsMessage.style.cssText = 'width: 100%; text-align: center;';
                    overlay.appendChild(noRecsMessage);
                    overlay.style.display = 'flex';
                    console.log('Recommendations overlay displayed with no recommendations message');
                    return;
                }

                const groupedByItem = {};
                recommendations.forEach(rec => {
                    if (!groupedByItem[rec.itemId]) {
                        groupedByItem[rec.itemId] = [];
                    }
                    groupedByItem[rec.itemId].push(rec.username);
                });

                for (const itemId in groupedByItem) {
                    const usernames = groupedByItem[itemId];
                    console.log('Fetching item details for itemId:', itemId);
                    const itemDetails = await fetchItemDetails(itemId);
                    if (!itemDetails) {
                        console.log('Skipping itemId due to missing details:', itemId);
                        continue;
                    }

                    const card = document.createElement('div');
                    card.className = 'recommendationCard';
                    card.style.cssText = `
                        flex: 0 0 200px;
                        margin: 10px;
                        background: #333;
                        border-radius: 8px;
                        padding: 10px;
                        color: white;
                        cursor: pointer;
                        box-sizing: border-box;
                    `;
                    card.addEventListener('click', () => {
                        console.log('Navigating to item:', itemId);
                        window.location.href = `/web/index.html#!/details?id=${itemId}`;
                        overlay.style.display = 'none';
                    });

                    const imageUrl = itemDetails.ImageTags?.Primary
                        ? `${serverUrl}/Items/${itemId}/Images/Primary?api_key=${apiKey}`
                        : '';
                    const logoUrl = itemDetails.ImageTags?.Logo
                        ? `${serverUrl}/Items/${itemId}/Images/Logo?api_key=${apiKey}`
                        : '';

                    card.innerHTML = `
                        ${imageUrl ? `<img src="${imageUrl}" style="width: 100%; border-radius: 4px;" alt="${itemDetails.Name || 'Item'}">` : ''}
                        ${logoUrl ? `<img src="${logoUrl}" style="max-width: 100%; margin-top: 5px;" alt="Logo">` : ''}
                        ${!logoUrl ? `<h3 style="margin: 10px 0;">${itemDetails.Name || 'Unknown'}</h3>` : ''}
                        <p style="font-size: 12px; font-style: italic;">Recommended by: ${usernames.join(', ')}</p>
                    `;

                    overlay.appendChild(card);
                    console.log('Recommendation card added for itemId:', itemId);
                }

                overlay.style.display = 'flex';
                console.log('Recommendations overlay displayed with', Object.keys(groupedByItem).length, 'items');
            } catch (error) {
                console.error('Error fetching recommendations:', error.message);
                const errorMessage = document.createElement('p');
                errorMessage.textContent = 'Failed to load recommendations: ' + error.message;
                errorMessage.style.cssText = 'width: 100%; text-align: center;';
                overlay.appendChild(errorMessage);
                overlay.style.display = 'flex';
                console.log('Recommendations overlay displayed with error message');
            }
        }

        async function showAdminOverlay() {
            console.log('Attempting to open admin overlay for userId:', userId);
            if (!adminUserIds.includes(userId)) {
                console.log('Access denied: User is not an admin');
                alert('Access denied: Admin privileges required');
                return;
            }

            if (!adminOverlay) {
                console.log('Creating admin overlay');
                adminOverlay = document.createElement('div');
                adminOverlay.style.cssText = `
                    display: none;
                    position: fixed;
                    top: 5px;
                    left: 5px;
                    width: calc(100% - 10px);
                    height: calc(100% - 10px);
                    background: rgba(0,0,0,0.8);
                    z-index: 1000;
                    color: white;
                    padding: 20px;
                    overflow-y: auto;
                    border: 5px solid #333;
                    box-sizing: border-box;
                `;
                try {
                    document.body.appendChild(adminOverlay);
                    console.log('Admin overlay appended to document.body');
                } catch (error) {
                    console.error('Error appending admin overlay:', error.message);
                    alert('Failed to create admin overlay: ' + error.message);
                    return;
                }

                const closeButton = document.createElement('button');
                closeButton.innerHTML = '<span class="material-icons close"></span>';
                closeButton.style.cssText = `
                    position: absolute;
                    top: 10px;
                    right: 10px;
                    background: #ff4444;
                    color: white;
                    border: none;
                    border-radius: 50%;
                    width: 30px;
                    height: 30px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    cursor: pointer;
                `;
                closeButton.addEventListener('click', () => {
                    console.log('Closing admin overlay');
                    adminOverlay.style.display = 'none';
                });
                adminOverlay.appendChild(closeButton);
                console.log('Close button added to admin overlay');

                adminOverlay.addEventListener('click', (e) => {
                    if (e.target === adminOverlay) {
                        console.log('Admin overlay clicked outside, closing');
                        adminOverlay.style.display = 'none';
                    }
                });
            }

            adminOverlay.innerHTML = '';
            const closeButton = document.createElement('button');
            closeButton.innerHTML = '<span class="material-icons close"></span>';
            closeButton.style.cssText = `
                position: absolute;
                top: 10px;
                right: 10px;
                background: #ff4444;
                color: white;
                border: none;
                border-radius: 50%;
                width: 30px;
                height: 30px;
                display: flex;
                align-items: center;
                justify-content: center;
                cursor: pointer;
            `;
            closeButton.addEventListener('click', () => {
                console.log('Closing admin overlay');
                adminOverlay.style.display = 'none';
            });
            adminOverlay.appendChild(closeButton);
            console.log('Close button reattached to admin overlay');

            try {
                console.log('Fetching admin settings from:', `${backendUrl}/admin/settings`);
                const settingsResponse = await fetch(`${backendUrl}/admin/settings`);
                if (!settingsResponse.ok) {
                    console.error('Fetch settings failed:', `HTTP ${settingsResponse.status}`);
                    throw new Error(`HTTP ${settingsResponse.status}: ${await settingsResponse.text()}`);
                }
                const settings = await settingsResponse.json();
                console.log('Settings received:', settings);

                const settingsForm = document.createElement('div');
                settingsForm.style.cssText = 'margin-bottom: 20px;';
                settingsForm.innerHTML = `
                    <h2>Admin Settings</h2>
                    <div style="margin-bottom: 10px;">
                        <label>Global Recommendation Limit (0 for unlimited):</label>
                        <input type="number" id="globalLimit" value="${settings.globalLimit || 0}" min="0" style="margin-left: 10px; padding: 5px;">
                    </div>
                    <div style="margin-bottom: 10px;">
                        <label>User ID for Per-User Limit:</label>
                        <input type="text" id="userIdLimit" placeholder="Enter User ID" style="margin-left: 10px; padding: 5px;">
                        <input type="number" id="perUserLimit" value="0" min="0" style="margin-left: 10px; padding: 5px;">
                    </div>
                    <button style="background: #4CAF50; color: white; border: none; padding: 8px 16px; border-radius: 4px; cursor: pointer;">Save Settings</button>
                `;
                const saveButton = settingsForm.querySelector('button');
                saveButton.addEventListener('click', async () => {
                    console.log('Save Settings button clicked');
                    const globalLimit = parseInt(document.getElementById('globalLimit').value) || 0;
                    const userIdLimit = document.getElementById('userIdLimit').value.trim();
                    const perUserLimit = parseInt(document.getElementById('perUserLimit').value) || 0;
                    try {
                        const response = await fetch(`${backendUrl}/admin/settings`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ globalLimit, userId: userIdLimit, perUserLimit })
                        });
                        if (!response.ok) {
                            console.error('Save settings failed:', `HTTP ${response.status}`);
                            throw new Error(`HTTP ${response.status}: ${await response.text()}`);
                        }
                        console.log('Settings saved');
                        alert('Settings saved successfully');
                    } catch (error) {
                        console.error('Error saving settings:', error.message);
                        alert('Failed to save settings: ' + error.message);
                    }
                });
                adminOverlay.appendChild(settingsForm);
                console.log('Settings form added to admin overlay');

                console.log('Fetching admin comments from:', `${backendUrl}/admin/comments`);
                const commentsResponse = await fetch(`${backendUrl}/admin/comments`);
                if (!commentsResponse.ok) {
                    console.error('Fetch comments failed:', `HTTP ${commentsResponse.status}`);
                    throw new Error(`HTTP ${commentsResponse.status}: ${await commentsResponse.text()}`);
                }
                const comments = await commentsResponse.json();
                console.log('Admin comments received:', comments);

                const commentSection = document.createElement('div');
                commentSection.innerHTML = `
                    <h2>Manage Comments</h2>
                    <div style="margin-bottom: 10px;">
                        <label><input type="checkbox" id="selectAllComments"> Select All</label>
                        <button id="deleteSelected" style="background: #ff4444; color: white; border: none; padding: 8px 16px; border-radius: 4px; cursor: pointer; margin-left: 10px;">Delete Selected</button>
                    </div>
                `;
                const selectAllCheckbox = commentSection.querySelector('#selectAllComments');
                const deleteSelectedButton = commentSection.querySelector('#deleteSelected');

                selectAllCheckbox.addEventListener('change', () => {
                    console.log('Select All checkbox changed:', selectAllCheckbox.checked);
                    const checkboxes = commentSection.querySelectorAll('.commentCheckbox');
                    checkboxes.forEach(cb => cb.checked = selectAllCheckbox.checked);
                });

                deleteSelectedButton.addEventListener('click', async () => {
                    console.log('Delete Selected button clicked');
                    const selectedIds = Array.from(commentSection.querySelectorAll('.commentCheckbox:checked')).map(cb => cb.dataset.commentId);
                    if (selectedIds.length === 0) {
                        console.log('No comments selected for deletion');
                        alert('No comments selected');
                        return;
                    }
                    if (!confirm(`Are you sure you want to delete ${selectedIds.length} comment(s)?`)) {
                        console.log('Delete selected cancelled');
                        return;
                    }
                    try {
                        for (const commentId of selectedIds) {
                            console.log('Deleting comment:', commentId);
                            const response = await fetch(`${backendUrl}/admin/comments/${commentId}`, {
                                method: 'DELETE'
                            });
                            if (!response.ok) {
                                console.error('Delete comment failed:', `HTTP ${response.status}`);
                                throw new Error(`HTTP ${response.status}: ${await response.text()}`);
                            }
                            console.log('Comment deleted:', commentId);
                        }
                        showAdminOverlay(); // Refresh
                    } catch (error) {
                        console.error('Error deleting selected comments:', error.message);
                        alert('Failed to delete some comments: ' + error.message);
                    }
                });

                comments.forEach(comment => {
                    const commentDiv = document.createElement('div');
                    commentDiv.style.cssText = 'margin-bottom: 10px; display: flex; align-items: center;';
                    commentDiv.innerHTML = `
                        <input type="checkbox" class="commentCheckbox" data-comment-id="${comment.id}" style="margin-right: 10px;">
                        <p><strong>${comment.username}</strong> on Item ${comment.itemId}: ${comment.comment}</p>
                        <button style="background: #ff4444; color: white; border: none; padding: 5px 10px; border-radius: 4px; cursor: pointer; margin-left: 10px;">Delete</button>
                    `;
                    const deleteButton = commentDiv.querySelector('button');
                    deleteButton.addEventListener('click', async () => {
                        console.log('Delete button clicked for comment:', comment.id);
                        if (!confirm('Are you sure you want to delete this comment?')) {
                            console.log('Delete cancelled for comment:', comment.id);
                            return;
                        }
                        try {
                            const response = await fetch(`${backendUrl}/admin/comments/${comment.id}`, {
                                method: 'DELETE'
                            });
                            if (!response.ok) {
                                console.error('Delete comment failed:', `HTTP ${response.status}`);
                                throw new Error(`HTTP ${response.status}: ${await response.text()}`);
                            }
                            console.log('Comment deleted:', comment.id);
                            commentDiv.remove();
                        } catch (error) {
                            console.error('Error deleting comment:', error.message);
                            alert('Failed to delete comment: ' + error.message);
                        }
                    });
                    commentSection.appendChild(commentDiv);
                });

                adminOverlay.appendChild(commentSection);
                console.log('Comment section added to admin overlay');

                const bulkDeleteForm = document.createElement('div');
                bulkDeleteForm.style.cssText = 'margin-top: 20px;';
                bulkDeleteForm.innerHTML = `
                    <h3>Bulk Delete Comments by User</h3>
                    <input type="text" id="bulkUserId" placeholder="Enter User ID" style="margin-right: 10px; padding: 5px;">
                    <button style="background: #ff4444; color: white; border: none; padding: 8px 16px; border-radius: 4px; cursor: pointer;">Delete All Comments</button>
                `;
                const bulkDeleteButton = bulkDeleteForm.querySelector('button');
                bulkDeleteButton.addEventListener('click', async () => {
                    console.log('Bulk Delete button clicked');
                    const bulkUserId = document.getElementById('bulkUserId').value.trim();
                    if (!bulkUserId) {
                        console.log('No userId provided for bulk delete');
                        alert('Please enter a User ID');
                        return;
                    }
                    if (!confirm(`Are you sure you want to delete all comments by user ${bulkUserId}?`)) {
                        console.log('Bulk delete cancelled');
                        return;
                    }
                    try {
                        const response = await fetch(`${backendUrl}/admin/comments/user/${bulkUserId}`, {
                            method: 'DELETE'
                        });
                        if (!response.ok) {
                            console.error('Bulk delete failed:', `HTTP ${response.status}`);
                            throw new Error(`HTTP ${response.status}: ${await response.text()}`);
                        }
                        console.log('Bulk comments deleted for user:', bulkUserId);
                        alert('Comments deleted successfully');
                        showAdminOverlay();
                    } catch (error) {
                        console.error('Error deleting bulk comments:', error.message);
                        alert('Failed to delete comments: ' + error.message);
                    }
                });

                adminOverlay.appendChild(bulkDeleteForm);
                console.log('Bulk delete form added to admin overlay');

                adminOverlay.style.display = 'block';
                console.log('Admin overlay displayed');
            } catch (error) {
                console.error('Error loading admin overlay:', error.message);
                const errorMessage = document.createElement('p');
                errorMessage.textContent = 'Failed to load admin settings: ' + error.message;
                errorMessage.style.cssText = 'width: 100%; text-align: center;';
                adminOverlay.appendChild(errorMessage);
                adminOverlay.style.display = 'block';
                console.log('Admin overlay displayed with error message');
            }
        }

        function cleanupExistingElements() {
            console.log('Cleaning up existing elements');
            const elements = [
                document.querySelector('.btnRecommend'),
                document.querySelector('.btnRecommendations'),
                document.querySelector('.btnAdmin'),
                document.querySelector('.recommendationArea'),
                document.querySelector('.commentsSection'),
                document.querySelector('.recommendationOverlay'),
                document.querySelector('.adminOverlay')
            ];
            elements.forEach(el => {
                if (el) {
                    el.remove();
                    console.log(`Removed element: ${el.className}`);
                }
            });
            recommendButton = null;
            recommendationsButton = null;
            adminButton = null;
            overlay = null;
            adminOverlay = null;
        }

        function init() {
            console.log('Starting initialization');
            function tryAddButtons() {
                console.log('Trying to add buttons');
                const playButton = document.querySelector('.mainDetailButtons .btnPlaystate, .detailButton-container button[data-id="play"]');
                const castButton = document.querySelector('.headerRight .headerCastButton, .headerTabs button[data-id="cast"], .mainDrawer-scrollContainer .castButton');

                if (playButton) {
                    console.log('Play button found, adding Recommend button');
                    createRecommendButton(playButton);
                } else {
                    console.log('Play button not found');
                }

                if (castButton) {
                    console.log('Cast button found, adding buttons');
                    createRecommendationsButton(castButton);
                    createAdminButton(castButton);
                } else {
                    console.log('Cast button not found, attempting fallback for admin button');
                    createAdminButton(null);
                }
            }

            cleanupExistingElements();
            tryAddButtons();

           /*  const observer = new MutationObserver(() => {
                //console.log('DOM change detected, attempting to add buttons');
                //tryAddButtons();
            });
            observer.observe(document.body, {
                childList: true,
                subtree: true,
                attributes: true
            }); */

            let attempts = 0;
            const maxAttempts = 10;
            const retryInterval = setInterval(() => {
                console.log(`Retry attempt ${attempts + 1}`);
                tryAddButtons();
                attempts++;
                if (document.querySelector('.btnRecommend') && document.querySelector('.btnRecommendations') || attempts >= maxAttempts) {
                    console.log('Stopping retry interval');
                    clearInterval(retryInterval);
                }
            }, 2000);
        }

        function setupNavigationListener() {
            console.log('Setting up navigation listener');
            const homeButton = document.querySelector('.headerHomeButton, .skinHeader .emby-button[title="Home"]');
            if (homeButton) {
                homeButton.addEventListener('click', () => {
                    console.log('Home button clicked at ' + new Date().toISOString());
                    setTimeout(() => {
                        console.log('Reinitializing script after home button click');
                        init();
                    }, 500); // Delay to allow page navigation
                });
                console.log('Home button listener attached');
            } else {
                console.log('Home button not found');
            }

            // Observe URL changes for SPA navigation
            let lastUrl = window.location.href;
            const urlObserver = new MutationObserver(() => {
                const currentUrl = window.location.href;
                if (currentUrl !== lastUrl) {
                    console.log('URL changed from', lastUrl, 'to', currentUrl);
                    lastUrl = currentUrl;
                    console.log('Reinitializing script after URL change');
                    setTimeout(() => init(), 500); // Delay to allow DOM to settle
                }
            });
            urlObserver.observe(document.body, { childList: true, subtree: true });

/*             // Override history API to catch SPA navigation
            const originalPushState = history.pushState;
            history.pushState = function(state, title, url) {
                console.log('history.pushState called with url:', url);
                originalPushState.apply(this, arguments);
                console.log('Reinitializing script after pushState');
                setTimeout(() => init(), 500);
            };

            const originalReplaceState = history.replaceState;
            history.replaceState = function(state, title, url) {
                console.log('history.replaceState called with url:', url);
                originalReplaceState.apply(this, arguments);
                console.log('Reinitializing script after replaceState');
                setTimeout(() => init(), 500);
            }; */
        }

        if (document.readyState === 'loading') {
            console.log('DOM not loaded, waiting for DOMContentLoaded');
            document.addEventListener('DOMContentLoaded', () => {
                init();
                setupNavigationListener();
            });
        } else {
            console.log('DOM already loaded, initializing immediately');
            init();
            setupNavigationListener();
        }
    } catch (error) {
        console.error('Critical error in script:', error.message);
        alert('Script initialization failed: ' + error.message);
    }
})();
