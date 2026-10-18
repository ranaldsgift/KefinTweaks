// Jellyfin Quiz Game - Enhanced with animations and preloading
(function() {
    'use strict';

	if (window.__kefinQuizLoaded) {
		console.log('[Quiz] Already initialized; skipping re-entry');
		return;
	}
	window.__kefinQuizLoaded = true;
	
	var itemList = [];
	var currentItemList = [];
	var titlesCorrect = [];
	var serverId;
	var timer;
	var quizScore = 0;
	var correctGuesses = 0;
	var quickGuesses = 0;
	var username = '';
	var resetTimer = false;
	var preloadedImages = [];
	var imagePreloader = null;
	var isQuizActive = false;
	var rerollCount = 0;
	var maxRerolls = 3;
	var correctGuessesData = [];
	
	// Initialize UI state
	document.getElementById('quizInitializeButton').disabled = true;
	document.getElementById("quizStartButton").disabled = true;
	document.getElementById('quizInitializeButton').style.display = "none";
	document.getElementById('quizStartButton').style.display = "none";
	document.getElementById('quizRerollButton').disabled = true;
	document.getElementById('quizRerollButton').style.display = "none";
	
	function initializeQuiz(apiClient) {
		console.log('initing quiz');
		document.getElementById('quizLoading').classList.remove("hide");
		apiClient.getItems(apiClient.getCurrentUserId(), {  
		  IncludeItemTypes: 'Movie',
		  Recursive: true,
		  Fields: 'PrimaryImageAspectRatio,ImageTags,BackdropImageTags'
		}).then((data) => {
			itemList = (data && data.Items) || [];
			currentItemList = itemList.slice();
			document.getElementById('quizLoading').classList.add("hide");
			initializeQuizData();
		});
		
		apiClient.getCurrentUser().then((user) => { username = user.Name; });
		
		fetch('/files/KefinTweaks/pages/scripts/hiscores.php', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/x-www-form-urlencoded',
			}
		})
		.then(response => response.text())
		.then(data => {
			var hiscores = data.split("\n");
			
			hiscores.sort((s1, s2) => { 
				var s1Value = parseInt(s1.split(';')[1]);
				var s2Value = parseInt(s2.split(';')[1]);
				return s1Value < s2Value ? 1 : s1Value > s2Value ? -1 : 0; 
			});
			
			var topScores = hiscores.slice(0,10);
			
			// Create table HTML
			var tableHtml = `
				<div class="hiscores-header">
					<h3>🏆 Leaderboard</h3>
				</div>
				<div class="hiscores-table-container">
					<table class="hiscores-table">
						<thead>
							<tr>
								<th class="rank-col">#</th>
								<th class="name-col">Player</th>
								<th class="score-col">Score</th>
								<th class="guesses-col">Guessed</th>
								<th class="date-col">Date</th>
							</tr>
						</thead>
						<tbody>
			`;
			
			topScores.forEach((score, index) => {
				if (score.trim()) {
					var scoreName = score.split(';')[0];
					var scorePoints = score.split(';')[1];
					var scoreGuesses = score.split(';')[2];
					var scoreDate = score.split(';')[3];
					
					// Format date
					var date = new Date(scoreDate);
					var formattedDate = date.toLocaleDateString('en-US', { 
						month: 'short', 
						day: 'numeric',
						year: 'numeric'
					});
					
					// Add rank styling
					var rankClass = '';
					if (index === 0) rankClass = 'rank-gold';
					else if (index === 1) rankClass = 'rank-silver';
					else if (index === 2) rankClass = 'rank-bronze';
					
					tableHtml += `
						<tr class="score-row ${rankClass}">
							<td class="rank-cell">${index + 1}</td>
							<td class="name-cell">${scoreName}</td>
							<td class="score-cell">${parseInt(scorePoints).toLocaleString()}</td>
							<td class="guesses-cell">${scoreGuesses}</td>
							<td class="date-cell">${formattedDate}</td>
						</tr>
					`;
				}
			});
			
			tableHtml += `
						</tbody>
					</table>
				</div>
			`;
			
			document.getElementById("quizHiscoresContainer").innerHTML = tableHtml;
		})
		.catch(error => {
			console.log('Error fetching hiscores:', error);
		});
	}
	
	function initializeQuizData() {
		document.getElementById('quizInputContainer').classList.add("hide");
		document.getElementById('quizInitializeButton').disabled = true;
		document.getElementById('quizInitializeButton').style.display = "none";
		document.getElementById("quizStartButton").disabled = true;
		document.getElementById('quizContainer').classList.remove("active");
		document.getElementById('quizContainer').classList.add("inactive");
		document.getElementById('quizContainer').classList.add("hide");
		document.getElementById('quizContainer').innerHTML = '';
		document.getElementById("quizTimer").textContent = "01:00";
		document.getElementById("quizTimer").classList.remove("warning");
		document.getElementById('quizScoreDisplay').classList.add("hide");
		document.getElementById('quizRerollDisplay').classList.add("hide");
		document.getElementById('quizControlButtons').classList.add("hide");
		document.getElementById('quizControlButtons').style.display = "none";
		quizScore = 0;
		correctGuesses = 0;
		quickGuesses = 0;
		rerollCount = 0;
		titlesCorrect = [];	
		correctGuessesData = [];
		resetTimer = true;
		isQuizActive = false;
		
		// Clear any existing answer overlays
		document.querySelectorAll('.answer-overlay').forEach((overlay) => {
			overlay.remove();
		});		
				
		currentItemList = [...itemList]; // Create a copy
		
		console.log('initing quiz data');
		
		// Preload images and add them to quiz container
		preloadImages().then(() => {
			// Add the preloaded images to the quiz container
			for (var i = 0; i < 9; i++) {		
				addImageToQuiz(i);
			}
			document.getElementById("quizStartButton").disabled = false;
			document.getElementById('quizStartButton').style.display = "inline-block";
		});
	}
	
	async function preloadImages() {
		console.log('Preloading images...');
		preloadedImages = [];
		imagePreloader = document.getElementById('imagePreloader');
		imagePreloader.innerHTML = ''; // Clear previous images
		
		const preloadPromises = [];
		
		for (let i = 0; i < 9; i++) {
			const randomItem = getRandomItem();
			const imageUrl = getImageUrl(randomItem);
			console.log(`Preloading image ${i}:`, imageUrl);
			
			if (!imageUrl) {
				console.warn(`No image URL generated for index ${i}, skipping`);
				preloadedImages.push({
					item: randomItem,
					url: null,
					loaded: false
				});
				continue;
			}
			
			const preloadPromise = new Promise((resolve, reject) => {
				const img = new Image();
				img.onload = () => {
					console.log(`Image ${i} loaded successfully`);
					preloadedImages.push({
						item: randomItem,
						url: imageUrl,
						loaded: true
					});
					resolve();
				};
				img.onerror = () => {
					console.warn('Failed to load image:', imageUrl);
					// Try to get a different image
					const fallbackItem = getRandomItem();
					const fallbackUrl = getImageUrl(fallbackItem);
					if (!fallbackUrl) {
						console.warn(`No fallback URL for index ${i}`);
						preloadedImages.push({
							item: randomItem,
							url: imageUrl,
							loaded: false
						});
						resolve();
						return;
					}
					const fallbackImg = new Image();
					fallbackImg.onload = () => {
						console.log(`Fallback image ${i} loaded successfully`);
						preloadedImages.push({
							item: fallbackItem,
							url: fallbackUrl,
							loaded: true
						});
						resolve();
					};
					fallbackImg.onerror = () => {
						console.warn(`Both original and fallback images failed for index ${i}`);
						preloadedImages.push({
							item: randomItem,
							url: imageUrl,
							loaded: false
						});
						resolve(); // Continue even if image fails
					};
					fallbackImg.src = fallbackUrl;
				};
				img.src = imageUrl;
			});
			
			preloadPromises.push(preloadPromise);
		}
		
		await Promise.all(preloadPromises);
		console.log('Image preloading complete:', preloadedImages.length, 'images loaded');
		console.log('Preloaded images array:', preloadedImages);
	}
	
	function getRandomItem() {
		if (!itemList || itemList.length === 0) {
			return null;
		}

		if (currentItemList.length === 0) {
			currentItemList = itemList.slice();
		}

		function hasBanner(item) {
			return !!(item && item.ImageTags && item.ImageTags.Banner);
		}

		function hasBackdrop(item) {
			return !!(item && item.BackdropImageTags && item.BackdropImageTags.length > 0);
		}

		// Prefer Banner-tagged titles; fall back to any with Backdrop (Banner is often missing).
		function pickFromList(predicate) {
			var attempts = 0;
			var maxAttempts = currentItemList.length * 2;
			while (attempts < maxAttempts && currentItemList.length > 0) {
				var randomIndex = Math.floor(Math.random() * currentItemList.length);
				var candidateItem = currentItemList[randomIndex];
				if (predicate(candidateItem)) {
					currentItemList.splice(randomIndex, 1);
					return candidateItem;
				}
				currentItemList.splice(randomIndex, 1);
				attempts++;
			}
			return null;
		}

		var randomItem = pickFromList(hasBanner);
		if (!randomItem) {
			currentItemList = itemList.slice();
			randomItem = pickFromList(hasBackdrop);
		}
		if (!randomItem) {
			console.warn('[Quiz] No movies with Banner or Backdrop images available');
			currentItemList = itemList.slice();
			return null;
		}

		console.log('randomItem', randomItem);
		return randomItem;
	}
	
	function getImageUrl(item) {
		if (!item) return null;
		console.log('getting img url for item:', item.Name);
		console.log('Item backdrop tags:', item.BackdropImageTags);
		var backdropCount = item.BackdropImageTags ? item.BackdropImageTags.length : 0;
		if (backdropCount === 0) {
			console.warn('No backdrop images for item:', item.Name);
			var newItem = getRandomItem();
			if (!newItem) {
				console.error('No backdrop images available');
				return null;
			}
			backdropCount = newItem.BackdropImageTags ? newItem.BackdropImageTags.length : 0;
			if (backdropCount === 0) {
				console.error('No backdrop images available');
				return null;
			}
			item = newItem;
		}
		var imageUrl = ApiClient.getImageUrl(item.Id, { type: 'Backdrop/' + Math.floor(Math.random() * backdropCount) });
		console.log('Generated image URL:', imageUrl);
		return imageUrl;
	}
	
	function addImageToQuiz(index) {		
		console.log('Adding image to quiz at index:', index);
		console.log('Preloaded images:', preloadedImages);
		
		// Use preloaded image if available
		if (preloadedImages[index] && preloadedImages[index].loaded && preloadedImages[index].url) {
			var imageData = preloadedImages[index];
			var imageUrl = imageData.url;
			var randomItem = imageData.item;
			console.log('Using preloaded image:', imageUrl);
		} else {
			// Fallback to generating new image
			console.log('Using fallback image generation');
			var randomItem = getRandomItem();
			var imageUrl = getImageUrl(randomItem);
		}
		
		if (!randomItem || !imageUrl) {
			console.error('No image URL available for index', index);
			return;
		}

		var existingImage = document.getElementById('quizContainer').querySelectorAll('img')[index];
		console.log('Existing image at index', index, ':', existingImage);
			 
		var timeStarted = new Date();

		if (existingImage) {
			// Smooth image replacement
			console.log('Replacing existing image');
			replaceImageWithAnimation(existingImage, imageUrl, randomItem, timeStarted);
			return;
		}
		
		// Create new image container
		console.log('Creating new image container');
		var imageContainer = document.createElement("div");
		imageContainer.className = "quiz-image-container";
		
		var image = document.createElement("IMG");
		image.src = imageUrl;
		image.dataset.movieName = randomItem.Name;
		image.dataset.timeStarted = timeStarted.toString();
		image.className = "fade-in";
		
		imageContainer.appendChild(image);
		document.getElementById('quizContainer').appendChild(imageContainer);
		console.log('Added image container to quiz container');
		
		// Preload next image for this slot
		preloadNextImage(index);
	}
	
	function replaceImageWithAnimation(oldImage, newImageUrl, newItem, timeStarted) {
		const container = oldImage.parentElement;
		
		// Create new image
		const newImage = document.createElement("IMG");
		newImage.src = newImageUrl;
		newImage.dataset.movieName = newItem.Name;
		newImage.dataset.timeStarted = timeStarted.toString();
		newImage.className = "fade-in";
		newImage.style.position = "absolute";
		newImage.style.top = "0";
		newImage.style.left = "0";
		newImage.style.width = "100%";
		newImage.style.height = "100%";
		newImage.style.objectFit = "cover";
		newImage.style.borderRadius = "8px";
		
		// Add new image behind old one
		container.appendChild(newImage);
		
		// Animate old image out
		oldImage.classList.add("fade-out");
		
		// Remove old image after animation
		setTimeout(() => {
			if (oldImage.parentElement) {
				oldImage.parentElement.removeChild(oldImage);
			}
			newImage.style.position = "static";
		}, 500);
		
		// Preload next image for this slot
		preloadNextImage(Array.from(container.parentElement.children).indexOf(container));
	}
	
	function preloadNextImage(slotIndex) {
		// Preload a new image for this slot
		const randomItem = getRandomItem();
		const imageUrl = getImageUrl(randomItem);
		if (!randomItem || !imageUrl) return;
		
		const img = new Image();
		img.onload = () => {
			// Store preloaded image for this slot
			if (!preloadedImages[slotIndex]) {
				preloadedImages[slotIndex] = [];
			}
			preloadedImages[slotIndex] = {
				item: randomItem,
				url: imageUrl,
				loaded: true
			};
		};
		img.src = imageUrl;
	}
	
	function quizListeners() {
		console.log('adding listener');
		document.getElementById('quizGuess').addEventListener('input', checkGuess);
		
		document.getElementById('quizStartButton').addEventListener('click', startQuiz);
		document.getElementById('quizInitializeButton').addEventListener('click', initializeQuizData);
		document.getElementById('quizRerollButton').addEventListener('click', rerollQuiz);
		
		// Modal listeners
		document.getElementById('modalCloseButton').addEventListener('click', hideScoreModal);
		document.getElementById('scoreModal').addEventListener('click', function(e) {
			if (e.target === this) {
				hideScoreModal();
			}
		});
	}
	
	function startQuiz() {
		resetTimer = false;
		isQuizActive = true;
		document.getElementById('quizHeaderContainer').classList.add("hide");
		document.getElementById('quizContainer').classList.add("active");
		document.getElementById('quizContainer').classList.remove("inactive");
		document.getElementById('quizContainer').classList.remove("hide");
		document.getElementById('quizControlButtons').classList.remove("hide");
		document.getElementById('quizTimerContainer').classList.remove("hide");
		document.getElementById('quizScoreDisplay').classList.add("show");
		document.getElementById('quizRerollDisplay').classList.add("show");
		document.getElementById('quizInitializeButton').disabled = false;
		document.getElementById('quizStartButton').disabled = false;
		document.getElementById('quizRerollButton').disabled = false;
		document.getElementById('quizStartButton').style.display = "none";
		document.getElementById('quizControlButtons').style.display = "flex";
		
		// Update reroll display and button
		updateRerollDisplay();
		updateRerollButton();
		
		// Clear input field and focus
		document.getElementById('quizGuess').value = '';
		document.getElementById('quizGuess').focus();
		
		startTimer(59, document.getElementById("quizTimer"));
		
		var quizStartedTime = new Date();
		console.log('setting time started');
		document.querySelectorAll('#quizContainer img').forEach((item) => {
			item.dataset["timeStarted"] = quizStartedTime.toString();
			console.log('setting time started');
		});
		document.getElementById("quizGuess").focus();
	}
	
	function startTimer(duration, display) {
		tickTimer(duration, display);
	}
	
	function tickTimer(duration, display) {		
		timer = duration;
		var minutes, seconds;
		setTimeout(function () {
			minutes = parseInt(timer / 60, 10);
			seconds = parseInt(timer % 60, 10);

			minutes = minutes < 10 ? "0" + minutes : minutes;
			seconds = seconds < 10 ? "0" + seconds : seconds;

			display.textContent = minutes + ":" + seconds;
			
			// Add warning animation when time is low
			if (timer <= 10 && timer > 0) {
				display.classList.add("warning");
			}
			
			// Update reroll cost display
			if (isQuizActive) {
				updateRerollButton();
				updateRerollDisplay();
			}
			
			if (resetTimer) {
				timer = 0;
				display.textContent = "01:00";
				display.classList.remove("warning");
				resetTimer = false;
			} else if (--timer < -1) {
				timer = 0;
				display.classList.remove("warning");
				finishQuiz();
			} else {
				tickTimer(timer, display);
			}
		}, 1000);
	}
	
	function finishQuiz() {
		isQuizActive = false;
		document.getElementById("quizStartButton").disabled = true;
		// Keep control buttons visible so user can reset quiz
		// Don't hide the quiz container, just show answers overlay
		showAnswers();
		
		console.log('submitting data for ' + username + ' with total ' + correctGuesses + ' correct');
		
		// Show modal immediately
		showScoreModal();
		
		const formData = new FormData();
		formData.append('username', username);
		formData.append('score', Math.round(quizScore));
		formData.append('correctItemCount', correctGuesses);
		
		fetch('/files/KefinTweaks/pages/scripts/quiz.php', {
			method: 'POST',
			body: formData
		})
		.then(response => response.text())
		.then(data => {
			console.log(data);
			// Update modal message with server response
			if (quizScore > 0) {
				document.getElementById('modalMessage').textContent = data;
			} else {
				document.getElementById('modalMessage').textContent = 'Try to finish with more than 0 points next time!';
			}
		})
		.catch(error => {
			console.log('Error submitting quiz score:', error);
			document.getElementById('modalMessage').textContent = 'Error submitting score. Please try again.';
		});
		
		document.getElementById("quizTimer").textContent = "01:00";
		document.getElementById("quizTimer").classList.remove("warning");
	}
	
	function showAnswers() {
		// Add answer overlays directly to each image container
		document.querySelectorAll('#quizContainer .quiz-image-container').forEach((container) => {
			var img = container.querySelector('img');
			if (img) {
				// Check if answer overlay already exists
				var existingAnswer = container.querySelector('.answer-overlay');
				if (existingAnswer) {
					existingAnswer.remove();
				}
				
				// Create answer overlay
				var answerOverlay = document.createElement('div');
				answerOverlay.className = 'answer-overlay';
				answerOverlay.innerHTML = img.dataset.movieName;
				
				// Style the answer overlay
				answerOverlay.style.position = 'absolute';
				answerOverlay.style.bottom = '0';
				answerOverlay.style.left = '0';
				answerOverlay.style.right = '0';
				answerOverlay.style.backgroundColor = 'rgba(0, 0, 0, 0.8)';
				answerOverlay.style.color = '#4ecdc4';
				answerOverlay.style.fontSize = '14px';
				answerOverlay.style.fontWeight = 'bold';
				answerOverlay.style.textAlign = 'center';
				answerOverlay.style.padding = '8px';
				answerOverlay.style.borderRadius = '0 0 8px 8px';
				answerOverlay.style.zIndex = '10';
				answerOverlay.style.textShadow = '2px 2px 4px rgba(0,0,0,0.8)';
				answerOverlay.style.lineHeight = '1.2';
				answerOverlay.style.wordWrap = 'break-word';
				answerOverlay.style.boxSizing = 'border-box';
				
				// Add to container
				container.appendChild(answerOverlay);
			}
		});
	}
	
	function checkGuess() {
		if (!isQuizActive) return;
		
		var index = 0;
		var quizItems = document.querySelectorAll('#quizContainer img');
		var foundMatch = false;
		
		quizItems.forEach((item) => {
			if (foundMatch) return;
			
			var guessValue = this.value.replace(/[^a-zA-Z ]/g, "");
			var movieName = item.dataset.movieName.replace(/[^a-zA-Z ]/g, "");
			var similarityScore = similarity(guessValue, movieName);
			if (similarityScore > 0.5) {
				console.log(`Similarity Score ${similarityScore} for guess ${guessValue} compared to ${movieName}`);
				if (similarityScore > 0.95) {
					console.log('match based on similarity ' + similarityScore);
					
					var currentTime = new Date();
					var timeStarted = new Date(item.dataset.timeStarted);
					var timePassed = (currentTime - timeStarted) / 1000;
					var timeMultiplier = (120 - timePassed) / 120;
					var pointsEarned = 120 * timeMultiplier;
					titlesCorrect.push(item.dataset.movieName);
					quizScore += pointsEarned;
					correctGuesses++;
					
					// Track correct guess data
					correctGuessesData.push({
						movieName: item.dataset.movieName,
						timePassed: timePassed,
						pointsEarned: pointsEarned,
						timestamp: currentTime
					});
					
					console.log('Points earned: ' + pointsEarned + ' for ' + item.dataset.movieName + ' in ' + timePassed.toFixed(2) + ' seconds');
					
					// Show points animation
					showPointsAnimation(item, Math.round(pointsEarned));
					
					// Update score display
					updateScoreDisplay();
					
					// Replace image
					addImageToQuiz(index);
					this.value = '';
					foundMatch = true;
					return;
				}
			}
			index++;
		});
	}
	
	function showPointsAnimation(imageElement, points) {
		const container = imageElement.closest('.quiz-image-container') || imageElement.parentElement;
		const rect = container.getBoundingClientRect();
		
		const pointsElement = document.createElement('div');
		pointsElement.className = 'points-animation';
		pointsElement.textContent = `+${points}`;
		pointsElement.style.left = (rect.left + rect.width / 2) + 'px';
		pointsElement.style.top = (rect.top + rect.height / 2) + 'px';
		
		document.body.appendChild(pointsElement);
		
		// Remove after animation
		setTimeout(() => {
			if (pointsElement.parentElement) {
				pointsElement.parentElement.removeChild(pointsElement);
			}
		}, 2000);
	}

	function showRerollAnimation() {
		const remaining = maxRerolls - rerollCount;
		const rerollButton = document.getElementById('quizRerollButton');
		const rect = rerollButton.getBoundingClientRect();
		
		const rerollElement = document.createElement('div');
		rerollElement.className = 'reroll-animation';
		rerollElement.textContent = `${remaining} rolls remaining`;
		rerollElement.style.left = (rect.left + rect.width / 2) + 'px';
		rerollElement.style.top = (rect.top - 20) + 'px';
		
		document.body.appendChild(rerollElement);
		
		// Remove after animation
		setTimeout(() => {
			if (rerollElement.parentElement) {
				rerollElement.parentElement.removeChild(rerollElement);
			}
		}, 2500);
	}
	
	function updateScoreDisplay() {
		const scoreDisplay = document.getElementById('quizScoreDisplay');
		scoreDisplay.textContent = `Score: ${Math.round(quizScore)}`;
		scoreDisplay.classList.add('show');
	}

	function calculateRerollCost() {
		return 50;
		// Cost scales from 200 at start to 120 at end (60 second timer)
		// Formula: 200 - (timeElapsed / 60) * 80
		const timeElapsed = 60 - timer; // timer counts down from 60
		const cost = Math.max(50, 200 - (timeElapsed / 60) * 80);
		return Math.round(cost);
	}

	function updateRerollDisplay() {
		const rerollDisplay = document.getElementById('quizRerollDisplay');
		const remaining = maxRerolls - rerollCount;
		const currentCost = calculateRerollCost();
		rerollDisplay.textContent = `Re-rolls: ${remaining}/${maxRerolls} (${currentCost} pts)`;
		rerollDisplay.classList.add('show');
	}

	function updateRerollButton() {
		const rerollButton = document.getElementById('quizRerollButton');
		const currentCost = calculateRerollCost();
		rerollButton.textContent = `Re-roll (-${currentCost} pts)`;
	}

	async function rerollQuiz() {
		if (rerollCount >= maxRerolls || !isQuizActive) {
			return;
		}

		// Calculate and deduct dynamic cost
		const rerollCost = calculateRerollCost();
		quizScore = Math.max(0, quizScore - rerollCost);
		rerollCount++;
		
		// Show reroll animation
		showRerollAnimation();
		
		// Update displays
		updateScoreDisplay();
		updateRerollDisplay();
		
		// Clear and refocus input field
		document.getElementById('quizGuess').value = '';
		document.getElementById('quizGuess').focus();
		
		// Disable button if no rerolls left
		if (rerollCount >= maxRerolls) {
			document.getElementById('quizRerollButton').disabled = true;
		}

		// Clear existing answer overlays
		document.querySelectorAll('.answer-overlay').forEach((overlay) => {
			overlay.remove();
		});

		// Preload new images
		await preloadImages();
		
		// Clear the entire quiz container
		document.getElementById('quizContainer').innerHTML = '';
		
		// Add all 9 new images to the grid
		for (var i = 0; i < 9; i++) {
			addImageToQuiz(i);
		}

		console.log('Quiz rerolled! All 9 images replaced.');
	}
	
	function similarity(s1, s2) {
		var longer = s1;
		var shorter = s2;
		if (s1.length < s2.length) {
			longer = s2;
			shorter = s1;
		}
		var longerLength = longer.length;
		if (longerLength == 0) {
			return 1.0;
		}
		return (longerLength - editDistance(longer, shorter)) / parseFloat(longerLength);
	}
	
	function editDistance(s1, s2) {
		s1 = s1.toLowerCase();
		s2 = s2.toLowerCase();

		var costs = new Array();
		for (var i = 0; i <= s1.length; i++) {
		var lastValue = i;
		for (var j = 0; j <= s2.length; j++) {
			if (i == 0)
				costs[j] = j;
			else {
				if (j > 0) {
					var newValue = costs[j - 1];
					if (s1.charAt(i - 1) != s2.charAt(j - 1))
					newValue = Math.min(Math.min(newValue, lastValue),
					costs[j]) + 1;
					costs[j - 1] = lastValue;
					lastValue = newValue;
			}
		  }
		}
		if (i > 0)
		  costs[s2.length] = lastValue;
		}
		return costs[s2.length];
	}

	function showScoreModal() {
		// Update modal content
		document.getElementById('modalFinalScore').textContent = Math.round(quizScore);
		document.getElementById('modalCorrectGuesses').textContent = correctGuesses;
		
		// Update correct guesses list
		updateCorrectGuessesList();
		
		// Show modal
		document.getElementById('scoreModal').classList.add('show');
	}

	function updateCorrectGuessesList() {
		const guessesList = document.getElementById('modalGuessesList');
		if (!guessesList) return;
		
		// Sort guesses by time (fastest first)
		const sortedGuesses = correctGuessesData.sort((a, b) => a.timePassed - b.timePassed);
		
		let html = '';
		sortedGuesses.forEach((guess, index) => {
			const timeFormatted = guess.timePassed < 1 ? 
				`${Math.round(guess.timePassed * 1000)}ms` : 
				`${guess.timePassed.toFixed(1)}s`;
			
			html += `
				<div class="guess-item">
					<span class="guess-number">${index + 1}.</span>
					<span class="guess-movie">${guess.movieName}</span>
					<span class="guess-time">${timeFormatted}</span>
					<span class="guess-points">+${Math.round(guess.pointsEarned)}</span>
				</div>
			`;
		});
		
		guessesList.innerHTML = html;
	}

	function hideScoreModal() {
		document.getElementById('scoreModal').classList.remove('show');
	}

    // Main initialization function
    function initializeQuizApp() {
        console.log('Initializing quiz app');
        serverId = ApiClient.serverId();
        initializeQuiz(ApiClient);
        quizListeners();
    }

    // Initialize the quiz when the script loads
    if (typeof ApiClient !== 'undefined') {
        // Wait for DOM to be ready
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', initializeQuizApp);
        } else {
            initializeQuizApp();
        }
    } else {
        // Wait for ApiClient to be available
        const checkApiClient = setInterval(() => {
            if (typeof ApiClient !== 'undefined') {
                clearInterval(checkApiClient);
                initializeQuizApp();
            }
        }, 100);
    }
})();