// Movie LUT — guess the movie from a trickplay color barcode
(function () {
    'use strict';

    if (window.__kefinMovieLutLoaded) {
        console.log('[MovieLUT] Already initialized; skipping re-entry');
        return;
    }
    window.__kefinMovieLutLoaded = true;

    const LOG = (...args) => console.log('[MovieLUT]', ...args);
    const WARN = (...args) => console.warn('[MovieLUT]', ...args);

    const SAMPLE_COUNT = 256;
    const RUNTIME_END_FRAC = 0.95;
    const TICKS_PER_MS = 10000;
    const MAX_ACTOR_TRIES = 24;
    const MAX_MOVIE_PROBES_PER_ACTOR = 40;
    const LETTERS = ['A', 'B', 'C'];

    const els = {
        status: document.getElementById('mlut-status'),
        card: document.getElementById('mlut-card'),
        options: document.getElementById('mlut-options'),
        swatch: document.getElementById('mlut-swatch'),
        placeholder: document.getElementById('mlut-swatch-placeholder'),
        prev: document.getElementById('mlut-prev'),
        next: document.getElementById('mlut-next'),
        score: document.getElementById('mlut-score'),
        streak: document.getElementById('mlut-streak'),
        reveal: document.getElementById('mlut-reveal'),
        revealConnectors: document.getElementById('mlut-reveal-connectors'),
        revealTiles: document.getElementById('mlut-reveal-tiles')
    };

    let score = 0;
    let streak = 0;
    let currentRound = null;
    let roundBusy = false;

    /** Full session history of rounds (answered + current). */
    let history = [];
    let historyIndex = -1;

    function setStatus(text, tone) {
        if (!els.status) return;
        els.status.textContent = text || '';
        els.status.dataset.tone = tone || 'muted';
    }

    function sleep(ms) {
        return new Promise((r) => setTimeout(r, ms));
    }

    function shuffle(arr) {
        const a = arr.slice();
        for (let i = a.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            const t = a[i];
            a[i] = a[j];
            a[j] = t;
        }
        return a;
    }

    function pickRandom(arr) {
        if (!arr || !arr.length) return null;
        return arr[Math.floor(Math.random() * arr.length)];
    }

    function getApiClient() {
        if (typeof ApiClient !== 'undefined' && ApiClient) return ApiClient;
        if (window.parent && window.parent !== window && window.parent.ApiClient) {
            return window.parent.ApiClient;
        }
        return null;
    }

    function getPeopleCache() {
        if (window.PeopleCache) return window.PeopleCache;
        if (window.parent && window.parent !== window && window.parent.PeopleCache) {
            return window.parent.PeopleCache;
        }
        return null;
    }

    async function waitForApiClient(maxMs) {
        const limit = maxMs || 15000;
        const start = Date.now();
        while (Date.now() - start < limit) {
            const client = getApiClient();
            if (client && typeof client.getCurrentUserId === 'function') {
                try {
                    if (client.getCurrentUserId() && client.accessToken && client.accessToken()) {
                        return client;
                    }
                } catch (e) { /* not ready */ }
            }
            await sleep(150);
        }
        return getApiClient();
    }

    async function waitForPeopleCache(maxMs) {
        const limit = maxMs || 60000;
        const start = Date.now();
        setStatus('Waiting for PeopleCache…', 'muted');
        while (Date.now() - start < limit) {
            const cache = getPeopleCache();
            if (cache && typeof cache.getTopActors === 'function') {
                try {
                    const actors = await cache.getTopActors();
                    if (Array.isArray(actors) && actors.length > 0) {
                        return { cache, actors };
                    }
                    if (typeof cache.isComplete === 'function' && cache.isComplete()) {
                        setStatus('No movies/actors available for Movie LUT.', 'error');
                        return null;
                    }
                    setStatus('Building people cache (this may take a while on first run)…', 'muted');
                } catch (e) {
                    WARN('getTopActors failed', e);
                }
            }
            await sleep(500);
        }
        return null;
    }

    function getTrickplayInfoFromItem(item) {
        const raw = item && item.Trickplay;
        if (!raw || typeof raw !== 'object') return null;
        if (typeof raw.Width !== 'undefined' && typeof raw.Interval !== 'undefined') {
            return raw;
        }
        const firstKey = Object.keys(raw)[0];
        if (!firstKey) return null;
        const inner = raw[firstKey];
        if (!inner || typeof inner !== 'object') return null;
        if (typeof inner.Width !== 'undefined' && typeof inner.Interval !== 'undefined') {
            return inner;
        }
        const secondKey = Object.keys(inner)[0];
        if (!secondKey) return null;
        const info = inner[secondKey];
        if (info && typeof info.Width !== 'undefined' && typeof info.Interval !== 'undefined') {
            return info;
        }
        return null;
    }

    function actorFilmography(actor) {
        const items = actor.items || actor.actorItems || [];
        return items.filter((m) => m && m.Id);
    }

    async function fetchFullItem(apiClient, itemId) {
        const userId = apiClient.getCurrentUserId();
        if (!userId) return null;
        try {
            return await apiClient.getItem(userId, itemId);
        } catch (e) {
            WARN('getItem failed', itemId, e);
            return null;
        }
    }

    function yearOf(item) {
        if (item.ProductionYear) return item.ProductionYear;
        if (item.PremiereDate) {
            const y = new Date(item.PremiereDate).getFullYear();
            if (!Number.isNaN(y)) return y;
        }
        return null;
    }

    function formatTitle(item) {
        const y = yearOf(item);
        return y != null ? `${item.Name} (${y})` : String(item.Name || 'Unknown');
    }

    function tileRef(trickplayInfo, positionTicks) {
        const interval = trickplayInfo.Interval || 10000;
        const tileWidth = trickplayInfo.TileWidth || 10;
        const tileHeight = trickplayInfo.TileHeight || 10;
        const currentTimeMs = positionTicks / TICKS_PER_MS;
        const currentTile = Math.floor(currentTimeMs / interval);
        const tileSize = tileWidth * tileHeight;
        const sheetIndex = Math.floor(currentTile / tileSize);
        const tileOffset = currentTile % tileSize;
        const tileOffsetX = tileOffset % tileWidth;
        const tileOffsetY = Math.floor(tileOffset / tileWidth);
        return { sheetIndex, tileOffsetX, tileOffsetY };
    }

    function positionTicksForStripe(item, stripeIndex) {
        const runEnd = Math.floor(item.RunTimeTicks * RUNTIME_END_FRAC);
        const t = SAMPLE_COUNT <= 1 ? 0 : stripeIndex / (SAMPLE_COUNT - 1);
        return Math.floor(runEnd * t);
    }

    /**
     * One random stripe per segment (frac of barcode width), not equal thirds —
     * keeps connectors over the matching full-width tile:
     * 0–30% / 35–65% / 70–100%.
     */
    function pickThirdStripeIndices() {
        const ranges = [
            [0.05, 0.3],
            [0.35, 0.65],
            [0.7, 0.95]
        ];
        return ranges.map(([startFrac, endFrac]) => {
            const lo = Math.max(0, Math.floor(startFrac * SAMPLE_COUNT));
            const hi = Math.min(SAMPLE_COUNT - 1, Math.ceil(endFrac * SAMPLE_COUNT) - 1);
            const a = Math.min(lo, hi);
            const b = Math.max(lo, hi);
            return a + Math.floor(Math.random() * (b - a + 1));
        });
    }

    function loadImage(url) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.crossOrigin = 'anonymous';
            img.onload = () => resolve(img);
            img.onerror = () => reject(new Error('Failed to load sheet'));
            img.src = url;
        });
    }

    function averageTileRgb(ctx, sx, sy, tw, th) {
        let data;
        try {
            data = ctx.getImageData(sx, sy, tw, th).data;
        } catch (e) {
            WARN('getImageData blocked (CORS?)', e);
            return null;
        }
        let r = 0;
        let g = 0;
        let b = 0;
        let n = 0;
        const step = Math.max(1, Math.floor((tw * th) / 400));
        for (let i = 0; i < data.length; i += 4 * step) {
            r += data[i];
            g += data[i + 1];
            b += data[i + 2];
            n++;
        }
        if (!n) return { r: 0, g: 0, b: 0 };
        return {
            r: Math.round(r / n),
            g: Math.round(g / n),
            b: Math.round(b / n)
        };
    }

    async function loadSheetMap(apiClient, item, sheetIndexes) {
        const trickplayInfo = getTrickplayInfoFromItem(item);
        const mediaSourceId = item.MediaSourceId || item.Id;
        const width = trickplayInfo.Width || 320;
        const sheetCanvas = new Map();

        for (const sheetIndex of sheetIndexes) {
            if (sheetCanvas.has(sheetIndex)) continue;
            const imgSrc = apiClient.getUrl(
                'Videos/' + item.Id + '/Trickplay/' + width + '/' + sheetIndex + '.jpg',
                {
                    ApiKey: apiClient.accessToken(),
                    MediaSourceId: mediaSourceId
                }
            );
            try {
                const img = await loadImage(imgSrc);
                const c = document.createElement('canvas');
                c.width = img.naturalWidth || img.width;
                c.height = img.naturalHeight || img.height;
                const ctx = c.getContext('2d', { willReadFrequently: true });
                ctx.drawImage(img, 0, 0);
                sheetCanvas.set(sheetIndex, { canvas: c, ctx, width: c.width, height: c.height });
            } catch (e) {
                WARN('sheet load failed', sheetIndex, e);
            }
        }
        return sheetCanvas;
    }

    function cropTileToCanvas(sheet, trickplayInfo, ref) {
        const width = trickplayInfo.Width || 320;
        const height = trickplayInfo.Height || 180;
        const tileWidth = trickplayInfo.TileWidth || 10;
        const tileHeight = trickplayInfo.TileHeight || 10;
        let sx = ref.tileOffsetX * width;
        let sy = ref.tileOffsetY * height;
        let tw = width;
        let th = height;
        if (sx + tw > sheet.width || sy + th > sheet.height) {
            const cellW = sheet.width / tileWidth;
            const cellH = sheet.height / tileHeight;
            sx = Math.floor(ref.tileOffsetX * cellW);
            sy = Math.floor(ref.tileOffsetY * cellH);
            tw = Math.max(1, Math.floor(cellW));
            th = Math.max(1, Math.floor(cellH));
        }
        const out = document.createElement('canvas');
        out.width = tw;
        out.height = th;
        const octx = out.getContext('2d');
        octx.drawImage(sheet.canvas, sx, sy, tw, th, 0, 0, tw, th);
        return out;
    }

    async function sampleColorsFromTrickplay(apiClient, item) {
        const trickplayInfo = getTrickplayInfoFromItem(item);
        if (!trickplayInfo || !item.RunTimeTicks) {
            throw new Error('No trickplay data');
        }

        const width = trickplayInfo.Width || 320;
        const height = trickplayInfo.Height || 180;
        const samples = [];

        for (let i = 0; i < SAMPLE_COUNT; i++) {
            const positionTicks = positionTicksForStripe(item, i);
            const ref = tileRef(trickplayInfo, positionTicks);
            samples.push({
                sheetIndex: ref.sheetIndex,
                tileOffsetX: ref.tileOffsetX,
                tileOffsetY: ref.tileOffsetY
            });
        }

        const sheetsNeeded = [...new Set(samples.map((s) => s.sheetIndex))];
        const sheetCanvas = await loadSheetMap(apiClient, item, sheetsNeeded);

        if (!sheetCanvas.size) {
            throw new Error('Could not load any trickplay sheets');
        }

        const tileWidth = trickplayInfo.TileWidth || 10;
        const tileHeight = trickplayInfo.TileHeight || 10;
        const colors = [];

        for (const sample of samples) {
            const sheet = sheetCanvas.get(sample.sheetIndex);
            if (!sheet) {
                colors.push({ r: 20, g: 20, b: 20 });
                continue;
            }
            let sx = sample.tileOffsetX * width;
            let sy = sample.tileOffsetY * height;
            let tw = width;
            let th = height;
            if (sx + tw > sheet.width || sy + th > sheet.height) {
                const cellW = sheet.width / tileWidth;
                const cellH = sheet.height / tileHeight;
                sx = Math.floor(sample.tileOffsetX * cellW);
                sy = Math.floor(sample.tileOffsetY * cellH);
                tw = Math.max(1, Math.floor(cellW));
                th = Math.max(1, Math.floor(cellH));
            }
            const rgb = averageTileRgb(sheet.ctx, sx, sy, tw, th);
            colors.push(rgb || { r: 30, g: 30, b: 30 });
        }
        return colors;
    }

    /**
     * Extract visible stills for three stripe indices (one per third of runtime / barcode).
     */
    async function extractRevealStills(apiClient, item, stripeIndices) {
        const trickplayInfo = getTrickplayInfoFromItem(item);
        if (!trickplayInfo) return [];

        const refs = stripeIndices.map((stripeIndex) => {
            const positionTicks = positionTicksForStripe(item, stripeIndex);
            const ref = tileRef(trickplayInfo, positionTicks);
            return { stripeIndex, ...ref };
        });

        const sheets = await loadSheetMap(
            apiClient,
            item,
            refs.map((r) => r.sheetIndex)
        );

        return refs.map((ref) => {
            const sheet = sheets.get(ref.sheetIndex);
            const canvas = sheet ? cropTileToCanvas(sheet, trickplayInfo, ref) : null;
            const frac = SAMPLE_COUNT <= 1 ? 0.5 : (ref.stripeIndex + 0.5) / SAMPLE_COUNT;
            return {
                stripeIndex: ref.stripeIndex,
                frac,
                canvas
            };
        });
    }

    function paintBarcode(canvas, colors) {
        if (!canvas || !colors || !colors.length) return;
        const dpr = window.devicePixelRatio || 1;
        const cssW = canvas.clientWidth || 640;
        const cssH = canvas.clientHeight || 200;
        canvas.width = Math.max(1, Math.floor(cssW * dpr));
        canvas.height = Math.max(1, Math.floor(cssH * dpr));
        const ctx = canvas.getContext('2d');
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        const w = cssW;
        const h = cssH;
        const n = colors.length;
        for (let i = 0; i < n; i++) {
            const c = colors[i];
            ctx.fillStyle = `rgb(${c.r},${c.g},${c.b})`;
            const x0 = (i / n) * w;
            const x1 = ((i + 1) / n) * w;
            ctx.fillRect(x0, 0, Math.ceil(x1 - x0) + 0.5, h);
        }
    }

    function updateNavButtons() {
        const round = history[historyIndex] || currentRound;
        if (els.prev) {
            els.prev.hidden = historyIndex <= 0;
        }
        if (els.next) {
            // Forward when current view is already answered
            els.next.hidden = !(round && round.guessed);
        }
    }

    function clearReveal() {
        if (els.reveal) els.reveal.hidden = true;
        if (els.revealConnectors) els.revealConnectors.innerHTML = '';
        if (els.revealTiles) els.revealTiles.innerHTML = '';
    }

    /**
     * Straight vertical lines from each stripe on the barcode down to the tile below.
     * Arrowheads sit on the barcode edge and point at the stripe.
     */
    function layoutRevealConnectors(stills) {
        if (!els.reveal || !els.revealConnectors || !els.swatch || !els.revealTiles) return;
        const svg = els.revealConnectors;
        svg.innerHTML = '';

        const revealRect = els.reveal.getBoundingClientRect();
        const swatchRect = els.swatch.getBoundingClientRect();
        if (!revealRect.width || !swatchRect.width) return;

        // Extend SVG upward so connectors can reach the swatch above the reveal block
        const lift = Math.max(0, revealRect.top - swatchRect.bottom + 1);
        const svgH = revealRect.height + lift;
        const svgW = revealRect.width;

        svg.style.top = `${-lift}px`;
        svg.style.height = `${svgH}px`;
        svg.setAttribute('viewBox', `0 0 ${svgW} ${svgH}`);
        svg.setAttribute('width', String(svgW));
        svg.setAttribute('height', String(svgH));

        const tileEls = els.revealTiles.querySelectorAll('.mlut-reveal-tile');
        const NS = 'http://www.w3.org/2000/svg';
        const arrowH = 10;
        const arrowW = 7;
        const originTop = revealRect.top - lift;
        const originLeft = revealRect.left;

        stills.forEach((still, i) => {
            const tileEl = tileEls[i];
            if (!tileEl) return;

            const tileRect = tileEl.getBoundingClientRect();
            // Pure vertical: stripe X, from barcode bottom down to tile top
            const x = swatchRect.left + still.frac * swatchRect.width - originLeft;
            const yStripe = swatchRect.bottom - originTop;
            const yTile = tileRect.top - originTop;

            const line = document.createElementNS(NS, 'line');
            line.setAttribute('x1', String(x));
            line.setAttribute('y1', String(yTile));
            line.setAttribute('x2', String(x));
            line.setAttribute('y2', String(yStripe + arrowH));
            svg.appendChild(line);

            // Arrow pointing up at the stripe (tip on barcode, base toward tile)
            const poly = document.createElementNS(NS, 'polygon');
            poly.setAttribute(
                'points',
                `${x},${yStripe} ${x - arrowW},${yStripe + arrowH} ${x + arrowW},${yStripe + arrowH}`
            );
            svg.appendChild(poly);
        });
    }

    function showReveal(stills) {
        if (!els.reveal || !els.revealTiles) return;
        if (els.revealConnectors) els.revealConnectors.innerHTML = '';
        els.revealTiles.innerHTML = '';

        stills.forEach((still) => {
            const tile = document.createElement('figure');
            tile.className = 'mlut-reveal-tile';
            if (still.canvas) {
                // Clone canvas so history restore can re-append without detaching cached ref
                const c = document.createElement('canvas');
                c.width = still.canvas.width;
                c.height = still.canvas.height;
                c.getContext('2d').drawImage(still.canvas, 0, 0);
                tile.appendChild(c);
            } else {
                const ph = document.createElement('div');
                ph.className = 'mlut-reveal-ph';
                tile.appendChild(ph);
            }
            els.revealTiles.appendChild(tile);
        });

        els.reveal.hidden = false;
        requestAnimationFrame(() => {
            layoutRevealConnectors(stills);
        });
    }

    async function gatherThreeTrickplayMovies(apiClient, actor) {
        const filmography = shuffle(actorFilmography(actor));
        const found = [];
        let probes = 0;
        for (const entry of filmography) {
            if (found.length >= 3) break;
            if (probes >= MAX_MOVIE_PROBES_PER_ACTOR) break;
            probes++;
            const item = await fetchFullItem(apiClient, entry.Id);
            if (!item || !item.RunTimeTicks || item.RunTimeTicks <= 0) continue;
            if (!getTrickplayInfoFromItem(item)) continue;
            if (found.some((f) => f.Id === item.Id)) continue;
            found.push(item);
        }
        return found;
    }

    async function pickRound(apiClient, actors) {
        const actorPool = shuffle(actors.filter((a) => actorFilmography(a).length >= 3));
        let tries = 0;
        for (const actor of actorPool) {
            if (tries >= MAX_ACTOR_TRIES) break;
            tries++;
            setStatus(`Checking films for ${actor.Name || 'actor'}…`, 'muted');
            const three = await gatherThreeTrickplayMovies(apiClient, actor);
            if (three.length < 3) continue;
            const answer = pickRandom(three);
            const options = shuffle(three);
            return { actor, answer, options };
        }
        throw new Error(
            'Could not find an actor with three movies that have trickplay. Generate trickplay for more titles or wait for PeopleCache to finish.'
        );
    }

    function escapeHtml(str) {
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    function promptForActor(actor) {
        const name = (actor && actor.Name) || 'this actor';
        return `Which ${name} film is this?`;
    }

    function renderOptions(round) {
        els.options.innerHTML = '';

        round.options.forEach((item, i) => {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'mlut-option';
            btn.dataset.itemId = item.Id;
            btn.innerHTML =
                `<span class="mlut-option-letter">${LETTERS[i] || String(i + 1)})</span>` +
                escapeHtml(formatTitle(item));

            if (round.guessed) {
                btn.disabled = true;
                if (item.Id === round.answer.Id) btn.classList.add('is-correct');
                if (round.selectedItemId && item.Id === round.selectedItemId && item.Id !== round.answer.Id) {
                    btn.classList.add('is-wrong');
                }
            } else {
                btn.addEventListener('click', () => onGuess(item.Id));
            }
            els.options.appendChild(btn);
        });
    }

    function restoreRound(round) {
        currentRound = round;
        if (!round) {
            els.card.classList.remove('is-visible');
            clearReveal();
            updateNavButtons();
            return;
        }

        renderOptions(round);
        els.card.classList.add('is-visible');

        if (els.placeholder) {
            els.placeholder.style.display = round._colors ? 'none' : 'flex';
        }

        requestAnimationFrame(() => {
            if (round._colors) paintBarcode(els.swatch, round._colors);
            if (round.guessed && round.stills && round.stills.length) {
                showReveal(round.stills);
                const correct = round.selectedItemId === round.answer.Id;
                setStatus(
                    correct ? 'Correct!' : `Wrong — it was ${formatTitle(round.answer)}.`,
                    correct ? 'ok' : 'error'
                );
            } else {
                clearReveal();
                setStatus(promptForActor(round.actor), 'muted');
            }
            updateNavButtons();
        });
    }

    async function onGuess(itemId) {
        if (!currentRound || currentRound.guessed || roundBusy) return;
        currentRound.guessed = true;
        currentRound.selectedItemId = itemId;

        const correctId = currentRound.answer.Id;
        const correct = itemId === correctId;

        Array.from(els.options.querySelectorAll('.mlut-option')).forEach((btn) => {
            btn.disabled = true;
            const id = btn.dataset.itemId;
            if (id === correctId) btn.classList.add('is-correct');
            if (id === itemId && !correct) btn.classList.add('is-wrong');
        });

        if (correct) {
            score += 1;
            streak += 1;
            setStatus('Correct!', 'ok');
        } else {
            streak = 0;
            setStatus(`Wrong — it was ${formatTitle(currentRound.answer)}.`, 'error');
        }
        els.score.textContent = String(score);
        els.streak.textContent = String(streak);
        updateNavButtons();

        try {
            const apiClient = getApiClient() || currentRound.apiClient;
            if (apiClient) {
                setStatus(
                    (correct ? 'Correct! ' : `Wrong — it was ${formatTitle(currentRound.answer)}. `) +
                        'Loading stills…',
                    correct ? 'ok' : 'error'
                );
                const stripeIndices = pickThirdStripeIndices();
                const stills = await extractRevealStills(apiClient, currentRound.answer, stripeIndices);
                currentRound.stills = stills;
                // Only show if user is still on this round
                if (history[historyIndex] === currentRound) {
                    showReveal(stills);
                    setStatus(
                        correct ? 'Correct!' : `Wrong — it was ${formatTitle(currentRound.answer)}.`,
                        correct ? 'ok' : 'error'
                    );
                }
            }
        } catch (e) {
            WARN('reveal stills failed', e);
            setStatus(
                correct ? 'Correct!' : `Wrong — it was ${formatTitle(currentRound.answer)}.`,
                correct ? 'ok' : 'error'
            );
        }

        updateNavButtons();
    }

    async function startRound() {
        if (roundBusy) return;
        roundBusy = true;
        clearReveal();
        if (els.placeholder) {
            els.placeholder.style.display = 'flex';
            els.placeholder.textContent = 'Preparing swatch…';
        }
        if (els.next) els.next.hidden = true;

        try {
            const apiClient = await waitForApiClient(15000);
            if (!apiClient) {
                throw new Error('ApiClient not available. Open this page from within Jellyfin while logged in.');
            }

            setStatus('Loading top actors…', 'muted');
            const people = await waitForPeopleCache(90000);
            if (!people || !people.actors.length) {
                throw new Error(
                    'You don\'t have enough movies in your library to play this game. Add more movies to your library and try again.'
                );
            }

            setStatus('Picking actor and films…', 'muted');
            const round = await pickRound(apiClient, people.actors);

            setStatus(`Building swatch from still frames…`, 'muted');
            const colors = await sampleColorsFromTrickplay(apiClient, round.answer);

            const entry = {
                ...round,
                guessed: false,
                selectedItemId: null,
                stills: null,
                _colors: colors,
                apiClient
            };

            // Drop any future after branching (shouldn't exist); append new
            history = history.slice(0, historyIndex + 1);
            history.push(entry);
            historyIndex = history.length - 1;
            currentRound = entry;

            renderOptions(entry);
            els.card.classList.add('is-visible');

            requestAnimationFrame(() => {
                paintBarcode(els.swatch, colors);
                if (els.placeholder) els.placeholder.style.display = 'none';
            });

            setStatus(promptForActor(round.actor), 'muted');
            updateNavButtons();
        } catch (e) {
            WARN(e);
            setStatus(e && e.message ? e.message : String(e), 'error');
            currentRound = history[historyIndex] || null;
            // Allow next only if we already finished a round before
            updateNavButtons();
            if (!history.length) {
                if (els.next) els.next.hidden = false; // retry start via next when cold-fail
            }
        } finally {
            roundBusy = false;
        }
    }

    function goPrev() {
        if (historyIndex <= 0 || roundBusy) return;
        historyIndex -= 1;
        restoreRound(history[historyIndex]);
    }

    async function goNext() {
        if (roundBusy) return;
        const round = history[historyIndex];
        if (!round || !round.guessed) return;

        if (historyIndex < history.length - 1) {
            historyIndex += 1;
            restoreRound(history[historyIndex]);
            return;
        }

        // At tip of history → load a new round
        await startRound();
    }

    function wire() {
        if (els.prev) els.prev.addEventListener('click', () => goPrev());
        if (els.next) els.next.addEventListener('click', () => goNext());
        window.addEventListener('resize', () => {
            if (currentRound && currentRound._colors) {
                paintBarcode(els.swatch, currentRound._colors);
            }
            if (currentRound && currentRound.guessed && currentRound.stills) {
                layoutRevealConnectors(currentRound.stills);
            }
        });

        startRound();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', wire);
    } else {
        wire();
    }

    LOG('ready');
})();
