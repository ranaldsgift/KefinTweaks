function addSeasonalOverlay() {
    const existing = document.querySelector('.snowverlay');
    if (existing) {
        return;
    }

    const SHAPE_GLYPHS = {
        bat: '🦇',
        snowflake: '❄',
        bell: '🔔',
        heart: '❤'
    };

    /** Extensible mode definitions — add entries + handlers to support new styles. */
    const ANIMATION_MODES = {
        fall: {
            id: 'fall',
            canvas: { heightPx: 160, fullViewport: false },
            poolSize: 15,
            fadeStartYRatio: 1,
            speed: { min: 0.2, max: 0.7 }
        },
        fly: {
            id: 'fly',
            canvas: { heightPx: 75, fullViewport: false },
            poolSize: 12,
            flockSize: { min: 4, max: 6 },
            groupDelayMs: { min: 1000, max: 6000 },
            onScreenSec: { min: 2, max: 3 },
            topY: { min: 8, max: 68 },
            spawnX: -50
        },
        corners: {
            id: 'corners',
            canvas: { heightPx: null, fullViewport: false, cornerCanvases: true },
            // Larger pool so micro-packs can stream while earlier bats are still flying
            poolSize: 48,
            // Narrow focused packs (not one wide swarm)
            packSize: { min: 5, max: 8 },
            // Continuous stream duration at one corner, then pause before next corner
            streamDurationMs: { min: 2000, max: 3000 },
            streamGapMs: { min: 160, max: 300 },
            groupDelayMs: { min: 1000, max: 6000 },
            onScreenSec: { min: 1.5, max: 2.5 },
            // Chord through the corner quadrant (~sqrt(2) * quadrant)
            pathLengthRatio: { min: 0.18, max: 0.28 },
            // Corner canvas / chord band as fraction of min(vw, vh)
            quadrantFrac: 0.14
        }
    };

    const DEFAULT_MODE_ID = 'fall';
    const styleKey = String(document.body.dataset.seasonalAnimationStyle || DEFAULT_MODE_ID).toLowerCase();
    const modeDef = ANIMATION_MODES[styleKey] || ANIMATION_MODES[DEFAULT_MODE_ID];

    const shapeKey = document.body.dataset.seasonalShape || 'snowflake';
    const glyph = SHAPE_GLYPHS[shapeKey] || SHAPE_GLYPHS.snowflake;

    const PARTICLE_SIZE = { min: 10, max: 22 };
    const TARGET_FPS = 30;
    const FRAME_INTERVAL = 1000 / TARGET_FPS;
    const BASE_FRAME_MS = 1000 / 60;
    const MAX_DT_MS = 50;
    const RESIZE_DEBOUNCE_MS = 150;
    const SPRITE_BASE_SIZE = 32;
    const MAX_DPR = 2;
    const FRAMES_PER_SEC = 1000 / BASE_FRAME_MS;

    const rand = (min, max) => min + Math.random() * (max - min);
    const randInt = (min, max) => min + Math.floor(Math.random() * (max - min + 1));

    const useCornerCanvases = modeDef.canvas.cornerCanvases === true;
    const CORNER_IDS = ['tl', 'tr', 'bl', 'br'];

    const canvasHeightCss = () => {
        if (modeDef.canvas.fullViewport) {
            return Math.max(1, window.innerHeight || 1);
        }
        return modeDef.canvas.heightPx || 160;
    };

    const cornerSizeCss = () => {
        const vw = Math.max(1, window.innerWidth || 1);
        const vh = Math.max(1, window.innerHeight || 1);
        // Keep corner canvases large enough for a readable swarm (~14% min side, min 96px)
        return Math.max(96, Math.floor(Math.min(vw, vh) * (modeDef.quadrantFrac || 0.14)));
    };

    const style = document.createElement('style');
    if (useCornerCanvases) {
        style.textContent = `
      body {
        height: 100svh;
        margin: 0;
      }
      .snowverlay.snowverlay-corner {
        position: fixed;
        width: var(--snowverlay-corner-size, 14vmin);
        height: var(--snowverlay-corner-size, 14vmin);
        pointer-events: none;
        z-index: 1000;
      }
      .snowverlay-corner-tl { top: 0; left: 0; }
      .snowverlay-corner-tr { top: 0; right: 0; }
      .snowverlay-corner-bl { bottom: 0; left: 0; }
      .snowverlay-corner-br { bottom: 0; right: 0; }
    `;
    } else {
        style.textContent = `
      body {
        height: 100svh;
        margin: 0;
      }
      .snowverlay {
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: ${modeDef.canvas.heightPx || 160}px;
        pointer-events: none;
        z-index: 1000;
      }
    `;
    }
    document.head.appendChild(style);

    /** @type {HTMLCanvasElement|null} */
    let canvas = null;
    /** @type {CanvasRenderingContext2D|null} */
    let ctx = null;
    /** @type {Record<string, { canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D }>} */
    const cornerLayers = {};

    if (useCornerCanvases) {
        CORNER_IDS.forEach((id) => {
            const el = document.createElement('canvas');
            el.className = `snowverlay snowverlay-corner snowverlay-corner-${id}`;
            document.body.appendChild(el);
            cornerLayers[id] = {
                canvas: el,
                ctx: el.getContext('2d', { alpha: true })
            };
        });
    } else {
        canvas = document.createElement('canvas');
        canvas.className = 'snowverlay';
        document.body.appendChild(canvas);
        ctx = canvas.getContext('2d', { alpha: true });
    }

    let cssWidth = window.innerWidth || 1;
    let cssHeight = useCornerCanvases
        ? Math.max(1, window.innerHeight || 1)
        : canvasHeightCss();
    let cornerSize = useCornerCanvases ? cornerSizeCss() : 0;

    const buildGlyphSprite = () => {
        const sprite = document.createElement('canvas');
        sprite.width = SPRITE_BASE_SIZE;
        sprite.height = SPRITE_BASE_SIZE;
        const sCtx = sprite.getContext('2d');
        sCtx.clearRect(0, 0, SPRITE_BASE_SIZE, SPRITE_BASE_SIZE);
        sCtx.font = `${SPRITE_BASE_SIZE * 0.85}px sans-serif`;
        sCtx.textAlign = 'center';
        sCtx.textBaseline = 'middle';
        sCtx.fillText(glyph, SPRITE_BASE_SIZE / 2, SPRITE_BASE_SIZE / 2);
        return sprite;
    };
    const glyphSprite = buildGlyphSprite();

    const resizeCanvas = () => {
        cssWidth = Math.max(1, window.innerWidth || 1);
        const dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR);
        if (useCornerCanvases) {
            cssHeight = Math.max(1, window.innerHeight || 1);
            cornerSize = cornerSizeCss();
            document.documentElement.style.setProperty('--snowverlay-corner-size', `${cornerSize}px`);
            CORNER_IDS.forEach((id) => {
                const layer = cornerLayers[id];
                if (!layer) return;
                layer.canvas.width = Math.round(cornerSize * dpr);
                layer.canvas.height = Math.round(cornerSize * dpr);
                layer.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
            });
            return;
        }
        cssHeight = canvasHeightCss();
        canvas.width = Math.round(cssWidth * dpr);
        canvas.height = Math.round(cssHeight * dpr);
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    let resizeTimer = null;
    const onResize = () => {
        if (resizeTimer != null) clearTimeout(resizeTimer);
        resizeTimer = setTimeout(() => {
            resizeTimer = null;
            resizeCanvas();
            if (reducedMotionMq.matches && shouldPaintStatic()) {
                renderStatic();
            }
        }, RESIZE_DEBOUNCE_MS);
    };

    window.addEventListener('resize', onResize);
    resizeCanvas();

    const burstState = {
        nextLaunchAt: 0,
        lastCorner: null,
        // Active corner stream (corners mode)
        streamUntil: 0,
        nextStreamPackAt: 0,
        streamCorner: null,
        streamFromVertical: true,
        streamLane: 0.5,
        streamSpeed: 0,
        activeCornerCanvas: null
    };

    function getActiveCornerCtx() {
        const id = burstState.activeCornerCanvas || burstState.streamCorner;
        return id ? cornerLayers[id]?.ctx || null : null;
    }

    function clearCornerCanvas(id) {
        const layer = cornerLayers[id];
        if (!layer) return;
        layer.ctx.clearRect(0, 0, cornerSize, cornerSize);
    }

    function clearAllCornerCanvases() {
        CORNER_IDS.forEach(clearCornerCanvas);
    }

    function clearActiveSurface() {
        if (useCornerCanvases) {
            const id = burstState.activeCornerCanvas || burstState.streamCorner;
            if (id) clearCornerCanvas(id);
            return;
        }
        ctx.clearRect(0, 0, cssWidth, cssHeight);
    }

    /** Map viewport particle coords into the active corner canvas local space. */
    function toCornerLocal(x, y, cornerId) {
        const size = cornerSize;
        if (cornerId === 'tr') return { x: x - (cssWidth - size), y };
        if (cornerId === 'bl') return { x, y: y - (cssHeight - size) };
        if (cornerId === 'br') return { x: x - (cssWidth - size), y: y - (cssHeight - size) };
        return { x, y };
    }

    function makeBaseParticle() {
        return {
            x: 0,
            y: 0,
            vx: 0,
            vy: 0,
            size: rand(PARTICLE_SIZE.min, PARTICLE_SIZE.max),
            opacity: null,
            speed: 0,
            drift: 0,
            rotation: 0,
            rotationSpeed: 0,
            active: false,
            wanderPhase: Math.random() * Math.PI * 2
        };
    }

    function speedForDistance(distPx, secMin, secMax) {
        const sec = rand(secMin, secMax);
        return distPx / (sec * FRAMES_PER_SEC);
    }

    function applyFacing(particle, vx, vy) {
        particle.rotation = (Math.atan2(vy, vx) * 180) / Math.PI + 90;
    }

    function applyGentleWander(particle, frameScale) {
        particle.wanderPhase += 0.035 * frameScale;
        const wanderVy = Math.sin(particle.wanderPhase) * 0.4;
        const wanderVx = Math.cos(particle.wanderPhase * 0.7) * 0.08;
        return {
            vx: particle.vx + wanderVx,
            vy: particle.vy + wanderVy
        };
    }

    const fallHandlers = {
        createParticle(isAnimated, index) {
            const fadeY = cssHeight;
            return {
                ...makeBaseParticle(),
                active: true,
                x: Math.random() * cssWidth,
                y: isAnimated
                    ? -20 - (index * cssHeight) / modeDef.poolSize
                    : Math.random() * fadeY,
                speed: rand(modeDef.speed.min, modeDef.speed.max),
                opacity: isAnimated ? null : Math.random() * 0.5 + 0.2,
                drift: Math.random() * 0.4 - 0.2,
                rotation: Math.random() * 360,
                rotationSpeed: Math.random() * 2 - 1
            };
        },
        opacity(particle) {
            if (particle.opacity != null) return particle.opacity;
            return Math.max(0, 1 - particle.y / cssHeight);
        },
        update(particle, frameScale) {
            particle.y += particle.speed * frameScale;
            particle.x += particle.drift * frameScale;
            particle.rotation += particle.rotationSpeed * frameScale;
            const offBottom = particle.y > cssHeight + 20;
            const offSides = particle.x < -50 || particle.x > cssWidth + 50;
            if (offBottom || offSides) {
                particle.y = -10 - Math.random() * 30;
                particle.x = Math.random() * cssWidth;
                particle.speed = rand(modeDef.speed.min, modeDef.speed.max);
                particle.drift = Math.random() * 0.4 - 0.2;
                particle.rotation = Math.random() * 360;
            }
        },
        tickFrame() {},
        paintStatic() {
            for (let i = 0; i < modeDef.poolSize; i++) {
                drawParticle(fallHandlers.createParticle(false, i));
            }
        }
    };

    function parkFlyParticle(p) {
        p.active = false;
        p.x = -999;
        p.y = -999;
    }

    function initFlyMember(p, memberIndex, baseVx, baseY) {
        const spreadX = memberIndex * rand(14, 24);
        p.x = modeDef.spawnX - spreadX - Math.random() * 20;
        p.y = baseY + (Math.random() * 2 - 1) * 6;
        p.vx = baseVx * (0.94 + Math.random() * 0.12);
        p.vy = rand(-0.08, 0.08);
        p.wanderPhase = Math.random() * Math.PI * 2;
        p.active = true;
        applyFacing(p, p.vx, p.vy);
    }

    function launchFlyGroup(particles) {
        const flockSize = randInt(modeDef.flockSize.min, modeDef.flockSize.max);
        const baseVx = speedForDistance(
            cssWidth + 80,
            modeDef.onScreenSec.min,
            modeDef.onScreenSec.max
        );
        const baseY = rand(modeDef.topY.min, modeDef.topY.max);
        let placed = 0;
        for (let i = 0; i < particles.length && placed < flockSize; i++) {
            if (!particles[i].active) {
                initFlyMember(particles[i], placed, baseVx, baseY);
                placed += 1;
            }
        }
    }

    function flyGroupActive(particles) {
        return particles.some((p) => p.active);
    }

    const flyHandlers = {
        createParticle() {
            const p = makeBaseParticle();
            parkFlyParticle(p);
            return p;
        },
        opacity(particle) {
            if (!particle.active) return 0;
            if (particle.opacity != null) return particle.opacity;
            const fadeStartX = cssWidth * 0.88;
            if (particle.x <= fadeStartX) return 1;
            const fadeRange = Math.max(1, cssWidth + 50 - fadeStartX);
            return Math.max(0, 1 - (particle.x - fadeStartX) / fadeRange);
        },
        update(particle, frameScale) {
            if (!particle.active) return;
            const { vx, vy } = applyGentleWander(particle, frameScale);
            particle.x += vx * frameScale;
            particle.y += vy * frameScale;
            particle.y = Math.max(modeDef.topY.min, Math.min(modeDef.topY.max, particle.y));
            applyFacing(particle, vx, vy);
            const offRight = particle.x > cssWidth + 60;
            const faded = flyHandlers.opacity(particle) <= 0.02;
            if (offRight || faded) {
                parkFlyParticle(particle);
            }
        },
        tickFrame(particles) {
            const now = Date.now();
            if (flyGroupActive(particles)) return;
            if (burstState.nextLaunchAt === 0) {
                burstState.nextLaunchAt = now + randInt(
                    modeDef.groupDelayMs.min,
                    modeDef.groupDelayMs.max
                );
                return;
            }
            if (now >= burstState.nextLaunchAt) {
                launchFlyGroup(particles);
                burstState.nextLaunchAt = 0;
            }
        },
        paintStatic() {
            for (let i = 0; i < modeDef.poolSize; i++) {
                const p = flyHandlers.createParticle();
                p.active = true;
                p.x = Math.random() * cssWidth;
                p.y = rand(modeDef.topY.min, modeDef.topY.max);
                applyFacing(p, 1, 0);
                drawParticle(p);
            }
        },
        onStart(particles) {
            launchFlyGroup(particles);
            burstState.nextLaunchAt = 0;
        }
    };

    const CORNER_PICK_IDS = CORNER_IDS;

    function pickNextCorner() {
        const choices = CORNER_PICK_IDS.filter((c) => c !== burstState.lastCorner);
        const corner = choices[Math.floor(Math.random() * choices.length)] || 'tl';
        burstState.lastCorner = corner;
        const fromVertical = Math.random() < 0.5;
        return { corner, fromVertical };
    }

    /**
     * True 45° diagonal across the corner canvas.
     * fromVertical: enter the vertical screen edge; else enter the horizontal edge.
     * |vx| === |vy| so the path is always 45°.
     *
     * Spawn is offset along the travel direction by `margin` so that after the
     * off-screen approach, particles ENTER the viewport/canvas at `lane` —
     * without this, a 45° approach from margin px off-screen only clips the tip.
     */
    function cornerBurstVector(corner, fromVertical, speed, laneT = 0.5) {
        // Component along each axis for 45° (speed is full diagonal magnitude)
        const c = speed / Math.SQRT2;
        // Lane within the corner canvas (match drawn canvas size when available)
        const band = useCornerCanvases
            ? cornerSize
            : Math.min(cssWidth, cssHeight) * (modeDef.quadrantFrac || 0.14);
        // Keep chords inside the canvas with room for particle size / wander
        const lane = band * (0.25 + Math.max(0, Math.min(1, laneT)) * 0.55);
        const margin = 24;

        if (corner === 'tl') {
            return fromVertical
                ? {
                    // left → top (up-right 45°): enter left edge at y=lane
                    spawn: () => ({ x: -margin - Math.random() * 12, y: lane + margin }),
                    vx: c,
                    vy: -c
                }
                : {
                    // top → left (down-left 45°): enter top edge at x=lane
                    spawn: () => ({ x: lane + margin, y: -margin - Math.random() * 12 }),
                    vx: -c,
                    vy: c
                };
        }
        if (corner === 'tr') {
            return fromVertical
                ? {
                    // right → top (up-left 45°): enter right edge at y=lane
                    spawn: () => ({ x: cssWidth + margin + Math.random() * 12, y: lane + margin }),
                    vx: -c,
                    vy: -c
                }
                : {
                    // top → right (down-right 45°): enter top edge at x=cssWidth-lane
                    spawn: () => ({ x: cssWidth - lane - margin, y: -margin - Math.random() * 12 }),
                    vx: c,
                    vy: c
                };
        }
        if (corner === 'bl') {
            return fromVertical
                ? {
                    // left → bottom (down-right 45°): enter left edge at y=cssHeight-lane
                    spawn: () => ({ x: -margin - Math.random() * 12, y: cssHeight - lane - margin }),
                    vx: c,
                    vy: c
                }
                : {
                    // bottom → left (up-left 45°): enter bottom edge at x=lane
                    spawn: () => ({ x: lane + margin, y: cssHeight + margin + Math.random() * 12 }),
                    vx: -c,
                    vy: -c
                };
        }
        // br
        return fromVertical
            ? {
                // right → bottom (down-left 45°): enter right edge at y=cssHeight-lane
                spawn: () => ({ x: cssWidth + margin + Math.random() * 12, y: cssHeight - lane - margin }),
                vx: -c,
                vy: c
            }
            : {
                // bottom → right (up-right 45°): enter bottom edge at x=cssWidth-lane
                spawn: () => ({ x: cssWidth - lane - margin, y: cssHeight + margin + Math.random() * 12 }),
                vx: c,
                vy: -c
            };
    }

    function isOffScreen(p) {
        if (useCornerCanvases) {
            // Deactivate once past the active corner canvas (+ margin for sprite)
            const id = burstState.activeCornerCanvas || burstState.streamCorner;
            if (!id) return true;
            const local = toCornerLocal(p.x, p.y, id);
            const m = 48;
            return local.x < -m || local.y < -m || local.x > cornerSize + m || local.y > cornerSize + m;
        }
        const m = 80;
        return p.x < -m || p.x > cssWidth + m || p.y < -m || p.y > cssHeight + m;
    }

    function cornersGroupActive(particles) {
        return particles.some((p) => p.active);
    }

    /** Launch one narrow pack on the current stream lane. */
    function launchCornersMicroPack(particles) {
        const { streamCorner, streamFromVertical, streamLane, streamSpeed } = burstState;
        if (!streamCorner || !streamSpeed) return;

        const spec = cornerBurstVector(streamCorner, streamFromVertical, streamSpeed, streamLane);
        const packSize = randInt(modeDef.packSize.min, modeDef.packSize.max);
        let placed = 0;
        for (let i = 0; i < particles.length && placed < packSize; i++) {
            const p = particles[i];
            if (p.active) continue;
            const pos = spec.spawn();
            // Narrow corridor: short stagger along travel, ~±4px lateral
            const along = placed * rand(6, 12);
            const lateral = (Math.random() * 2 - 1) * 4;
            if (streamFromVertical) {
                p.x = pos.x - Math.sign(spec.vx || 1) * along;
                p.y = pos.y + lateral;
            } else {
                p.x = pos.x + lateral;
                p.y = pos.y - Math.sign(spec.vy || 1) * along;
            }
            const scale = 0.97 + Math.random() * 0.06;
            p.vx = spec.vx * scale;
            p.vy = spec.vy * scale;
            p.wanderPhase = Math.random() * Math.PI * 2;
            p.active = true;
            applyFacing(p, p.vx, p.vy);
            placed += 1;
        }
    }

    /** Begin a 2–3s stream of narrow packs at a new corner. */
    function beginCornersStream(particles) {
        const { corner, fromVertical } = pickNextCorner();
        // Travel distance for speed: roughly the corner diagonal
        const pathBase = useCornerCanvases
            ? cornerSize * Math.SQRT2
            : Math.min(cssWidth, cssHeight) * (modeDef.quadrantFrac || 0.14) * Math.SQRT2;
        const pathLen = pathBase * rand(0.85, 1.25);
        const speed = speedForDistance(
            pathLen,
            modeDef.onScreenSec.min,
            modeDef.onScreenSec.max
        );
        const now = Date.now();
        if (burstState.activeCornerCanvas && burstState.activeCornerCanvas !== corner) {
            clearCornerCanvas(burstState.activeCornerCanvas);
        }
        burstState.streamCorner = corner;
        burstState.activeCornerCanvas = corner;
        burstState.streamFromVertical = fromVertical;
        burstState.streamLane = Math.random();
        burstState.streamSpeed = speed;
        burstState.streamUntil = now + randInt(
            modeDef.streamDurationMs.min,
            modeDef.streamDurationMs.max
        );
        burstState.nextLaunchAt = 0;
        launchCornersMicroPack(particles);
        burstState.nextStreamPackAt = now + randInt(
            modeDef.streamGapMs.min,
            modeDef.streamGapMs.max
        );
    }

    const cornersHandlers = {
        createParticle() {
            const p = makeBaseParticle();
            p.active = false;
            p.x = -999;
            p.y = -999;
            return p;
        },
        opacity(particle) {
            if (!particle.active) return 0;
            if (particle.opacity != null) return particle.opacity;
            return 1;
        },
        update(particle, frameScale) {
            if (!particle.active) return;
            particle.wanderPhase += 0.03 * frameScale;
            const perp = Math.sin(particle.wanderPhase) * 0.1;
            const vx = particle.vx + (-Math.sign(particle.vy) || -1) * perp * 0.45;
            const vy = particle.vy + (Math.sign(particle.vx) || 1) * perp * 0.45;
            particle.x += vx * frameScale;
            particle.y += vy * frameScale;
            applyFacing(particle, vx, vy);
            if (isOffScreen(particle)) {
                particle.active = false;
                particle.x = -999;
                particle.y = -999;
            }
        },
        tickFrame(particles) {
            const now = Date.now();

            // Active stream: keep launching narrow packs for 2–3s
            if (burstState.streamUntil > 0) {
                if (now < burstState.streamUntil) {
                    if (now >= burstState.nextStreamPackAt) {
                        launchCornersMicroPack(particles);
                        burstState.nextStreamPackAt = now + randInt(
                            modeDef.streamGapMs.min,
                            modeDef.streamGapMs.max
                        );
                    }
                    return;
                }
                // Stream window ended — keep drawing on activeCornerCanvas until bats exit
                burstState.streamUntil = 0;
                burstState.nextStreamPackAt = 0;
                burstState.streamCorner = null;
                burstState.streamSpeed = 0;
                burstState.nextLaunchAt = 0;
            }

            if (cornersGroupActive(particles)) return;

            if (burstState.activeCornerCanvas) {
                clearCornerCanvas(burstState.activeCornerCanvas);
                burstState.activeCornerCanvas = null;
            }

            if (burstState.nextLaunchAt === 0) {
                burstState.nextLaunchAt = now + randInt(
                    modeDef.groupDelayMs.min,
                    modeDef.groupDelayMs.max
                );
                return;
            }
            if (now >= burstState.nextLaunchAt) {
                beginCornersStream(particles);
            }
        },
        paintStatic() {
            const { corner, fromVertical } = pickNextCorner();
            const lane = Math.random();
            const spec = cornerBurstVector(corner, fromVertical, 8, lane);
            burstState.activeCornerCanvas = corner;
            clearAllCornerCanvases();
            const count = randInt(8, 14);
            for (let i = 0; i < count; i++) {
                const p = cornersHandlers.createParticle();
                const pos = spec.spawn();
                p.active = true;
                p.x = pos.x + (Math.random() * 2 - 1) * 4;
                p.y = pos.y + (Math.random() * 2 - 1) * 4;
                applyFacing(p, spec.vx, spec.vy);
                drawParticle(p);
            }
        },
        onStart(particles) {
            beginCornersStream(particles);
        }
    };

    const MODE_HANDLERS = {
        fall: fallHandlers,
        fly: flyHandlers,
        corners: cornersHandlers
    };

    const handlers = MODE_HANDLERS[modeDef.id] || fallHandlers;

    const particles = Array.from({ length: modeDef.poolSize }, (_, i) => {
        if (modeDef.id === 'fall') {
            return handlers.createParticle(true, i);
        }
        return handlers.createParticle();
    });

    function particleOpacity(particle) {
        return handlers.opacity(particle);
    }

    function drawParticle(particle) {
        const opacity = particleOpacity(particle);
        if (opacity <= 0.01) return;
        if (modeDef.id !== 'fall' && !particle.active) return;

        let drawCtx = ctx;
        let dx = particle.x;
        let dy = particle.y;
        if (useCornerCanvases) {
            const cornerId = burstState.activeCornerCanvas;
            drawCtx = getActiveCornerCtx();
            if (!drawCtx || !cornerId) return;
            const local = toCornerLocal(particle.x, particle.y, cornerId);
            dx = local.x;
            dy = local.y;
            // Skip if outside this corner canvas (with small margin for sprite)
            if (dx < -40 || dy < -40 || dx > cornerSize + 40 || dy > cornerSize + 40) return;
        }
        if (!drawCtx) return;

        const size = particle.size;
        drawCtx.save();
        drawCtx.translate(dx, dy);
        drawCtx.rotate((particle.rotation * Math.PI) / 180);
        drawCtx.globalAlpha = opacity;
        drawCtx.drawImage(glyphSprite, -size / 2, -size / 2, size, size);
        drawCtx.restore();
    }

    let animationFrame = null;
    let lastTime = 0;
    let animating = false;
    let startedBurst = false;

    const stopAnimation = () => {
        if (animationFrame != null) {
            cancelAnimationFrame(animationFrame);
            animationFrame = null;
        }
        animating = false;
        startedBurst = false;
    };

    const animate = (currentTime) => {
        animationFrame = requestAnimationFrame(animate);

        if (!lastTime) {
            lastTime = currentTime;
            return;
        }

        const rawDelta = currentTime - lastTime;
        if (rawDelta < FRAME_INTERVAL) return;

        lastTime = currentTime - (rawDelta % FRAME_INTERVAL);
        const dt = Math.min(rawDelta, MAX_DT_MS);
        const frameScale = dt / BASE_FRAME_MS;

        if (!startedBurst && handlers.onStart) {
            handlers.onStart(particles);
            startedBurst = true;
        }

        if (handlers.tickFrame) {
            handlers.tickFrame(particles);
        }

        clearActiveSurface();
        for (let i = 0; i < particles.length; i++) {
            const particle = particles[i];
            handlers.update(particle, frameScale);
            drawParticle(particle);
        }
    };

    const renderStatic = () => {
        if (useCornerCanvases) {
            clearAllCornerCanvases();
        } else {
            ctx.clearRect(0, 0, cssWidth, cssHeight);
        }
        handlers.paintStatic();
    };

    const reducedMotionMq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const mobileMq = window.matchMedia('(max-width: 899px)');

    const isHomePageActive = () =>
        document.documentElement.getAttribute('data-active-page') === 'home';

    const shouldRunAnimation = () =>
        !document.hidden
        && isHomePageActive()
        && !mobileMq.matches
        && !reducedMotionMq.matches;

    const shouldPaintStatic = () =>
        !document.hidden
        && isHomePageActive()
        && !mobileMq.matches
        && reducedMotionMq.matches;

    const startAnimation = () => {
        if (animating) return;
        animating = true;
        lastTime = 0;
        startedBurst = false;
        burstState.nextLaunchAt = 0;
        burstState.lastCorner = null;
        burstState.streamUntil = 0;
        burstState.nextStreamPackAt = 0;
        burstState.streamCorner = null;
        burstState.streamSpeed = 0;
        burstState.activeCornerCanvas = null;
        if (modeDef.id === 'fly' || modeDef.id === 'corners') {
            particles.forEach((p) => {
                p.active = false;
                p.x = -999;
                p.y = -999;
            });
        }
        if (useCornerCanvases) clearAllCornerCanvases();
        animationFrame = requestAnimationFrame(animate);
    };

    const syncAnimationRunning = () => {
        if (shouldRunAnimation()) {
            if (!animating) startAnimation();
            return;
        }

        stopAnimation();
        if (shouldPaintStatic()) {
            renderStatic();
        } else if (useCornerCanvases) {
            clearAllCornerCanvases();
        } else {
            ctx.clearRect(0, 0, cssWidth, cssHeight);
        }
    };

    const onVisibilityChange = () => syncAnimationRunning();
    const onReducedMotionChange = () => syncAnimationRunning();
    const onMobileChange = () => syncAnimationRunning();

    document.addEventListener('visibilitychange', onVisibilityChange);
    reducedMotionMq.addEventListener('change', onReducedMotionChange);
    mobileMq.addEventListener('change', onMobileChange);

    let pageAttrObserver = null;
    if (typeof MutationObserver !== 'undefined') {
        pageAttrObserver = new MutationObserver(() => syncAnimationRunning());
        pageAttrObserver.observe(document.documentElement, {
            attributes: true,
            attributeFilter: ['data-active-page']
        });
    }

    syncAnimationRunning();

    const cleanup = () => {
        stopAnimation();
        if (resizeTimer != null) clearTimeout(resizeTimer);
        window.removeEventListener('resize', onResize);
        document.removeEventListener('visibilitychange', onVisibilityChange);
        reducedMotionMq.removeEventListener('change', onReducedMotionChange);
        mobileMq.removeEventListener('change', onMobileChange);
        if (pageAttrObserver) pageAttrObserver.disconnect();
    };

    window.addEventListener('beforeunload', cleanup);
}

addSeasonalOverlay();
