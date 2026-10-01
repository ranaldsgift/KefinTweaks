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
    const shapeKey = document.body.dataset.seasonalShape || 'snowflake';
    const glyph = SHAPE_GLYPHS[shapeKey] || SHAPE_GLYPHS.snowflake;
    const animationStyle = document.body.dataset.seasonalAnimationStyle === 'fly' ? 'fly' : 'fall';
    const isFly = animationStyle === 'fly';

    // fly: bats burst from a top-center "window", arc outward; fade before strip bottom
    const CANVAS_HEIGHT_PX = isFly ? 220 : 160;
    const FADE_START_Y = isFly ? 170 : CANVAS_HEIGHT_PX;
    const PARTICLE_AMOUNT = isFly ? 8 : 15;
    const PARTICLE_SIZE = { min: 10, max: 22 };
    const PARTICLE_SPEED = isFly
        ? { min: 0.35, max: 0.7 }
        : { min: 0.2, max: 0.7 };
    // Window aperture near top-center (fraction of canvas width)
    const FLY_WINDOW_WIDTH_FRAC = 0.18;
    const FLY_WINDOW_Y = -8;
    // Outward curve: horizontal accel grows as they leave the window
    const FLY_OUTWARD_ACCEL = { min: 0.018, max: 0.038 };
    const FLY_OUTWARD_MAX = 3.2;
    const FLY_DOWN_ACCEL = { min: 0.008, max: 0.018 };
    const FLY_DOWN_MAX = 2.4;
    // Organic wing-wobble
    const FLY_WOBBLE_AMP = { min: 1.2, max: 2.8 };
    const FLY_WOBBLE_SPEED = { min: 0.08, max: 0.16 };
    const FLY_ROT_WOBBLE = { min: 8, max: 22 };

    const TARGET_FPS = 30;
    const FRAME_INTERVAL = 1000 / TARGET_FPS;
    const BASE_FRAME_MS = 1000 / 60;
    const MAX_DT_MS = 50;
    const RESIZE_DEBOUNCE_MS = 150;
    const SPRITE_BASE_SIZE = 32;
    const MAX_DPR = 2;

    const style = document.createElement('style');
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
        height: ${CANVAS_HEIGHT_PX}px;
        pointer-events: none;
        z-index: 1000;
      }
    `;
    document.head.appendChild(style);

    const canvas = document.createElement('canvas');
    canvas.className = 'snowverlay';
    document.body.appendChild(canvas);
    const ctx = canvas.getContext('2d', { alpha: true });

    /** CSS-pixel size used for physics / clearRect (not buffer pixels). */
    let cssWidth = window.innerWidth || 1;
    let cssHeight = CANVAS_HEIGHT_PX;

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
        cssHeight = CANVAS_HEIGHT_PX;
        const dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR);
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

    const particleOpacity = (particle) => {
        if (particle.opacity != null) return particle.opacity;
        if (!isFly) {
            return Math.max(0, 1 - particle.y / cssHeight);
        }
        if (particle.y <= FADE_START_Y) {
            return 1;
        }
        const fadeRange = Math.max(1, cssHeight - FADE_START_Y);
        return Math.max(0, 1 - (particle.y - FADE_START_Y) / fadeRange);
    };

    const flyWindowCenterX = () => cssWidth * 0.5;
    const flyWindowHalfWidth = () => Math.max(40, cssWidth * FLY_WINDOW_WIDTH_FRAC * 0.5);

    /** Spawn from top-center window; side picks outward curve direction. */
    const initFlyMotion = (particle, index = 0) => {
        const center = flyWindowCenterX();
        const half = flyWindowHalfWidth();
        // Cluster in the window; slight stagger so they don't stack
        particle.x = center + (Math.random() * 2 - 1) * half * 0.85;
        particle.y = FLY_WINDOW_Y - (index * 14) - Math.random() * 24;
        // Bias side from spawn position relative to center (with a little flip chance)
        let side = particle.x >= center ? 1 : -1;
        if (Math.random() < 0.18) side *= -1;

        const outwardAccel = (Math.random() * (FLY_OUTWARD_ACCEL.max - FLY_OUTWARD_ACCEL.min) + FLY_OUTWARD_ACCEL.min) * side;
        // Start mostly downward with a small outward kick, then curve harder
        particle.vx = side * (0.15 + Math.random() * 0.45);
        particle.vy = Math.random() * (PARTICLE_SPEED.max - PARTICLE_SPEED.min) + PARTICLE_SPEED.min;
        particle.outwardAccel = outwardAccel;
        particle.downAccel = Math.random() * (FLY_DOWN_ACCEL.max - FLY_DOWN_ACCEL.min) + FLY_DOWN_ACCEL.min;
        particle.wobblePhase = Math.random() * Math.PI * 2;
        particle.wobbleSpeed = Math.random() * (FLY_WOBBLE_SPEED.max - FLY_WOBBLE_SPEED.min) + FLY_WOBBLE_SPEED.min;
        particle.wobbleAmp = Math.random() * (FLY_WOBBLE_AMP.max - FLY_WOBBLE_AMP.min) + FLY_WOBBLE_AMP.min;
        particle.wobblePhase2 = Math.random() * Math.PI * 2;
        particle.wobbleSpeed2 = particle.wobbleSpeed * (0.55 + Math.random() * 0.5);
        particle.wobbleAmp2 = particle.wobbleAmp * (0.35 + Math.random() * 0.4);
        // Face along initial flight direction (emoji bat points up at 0deg → +180 for down)
        const aimDeg = (Math.atan2(particle.vy, particle.vx) * 180) / Math.PI + 90;
        particle.rotation = aimDeg + (Math.random() * 20 - 10);
        particle.rotationSpeed = (Math.random() * 1.2 - 0.6) * side;
        particle.rotWobbleAmp = Math.random() * (FLY_ROT_WOBBLE.max - FLY_ROT_WOBBLE.min) + FLY_ROT_WOBBLE.min;
        particle.side = side;
    };

    const createParticle = (isAnimated = true, index = 0) => {
        if (isFly) {
            const particle = {
                x: 0,
                y: 0,
                size: Math.random() * (PARTICLE_SIZE.max - PARTICLE_SIZE.min) + PARTICLE_SIZE.min,
                opacity: isAnimated ? null : Math.random() * 0.5 + 0.2,
                speed: 0,
                drift: 0,
                rotation: 180,
                rotationSpeed: 0
            };
            if (isAnimated) {
                initFlyMotion(particle, index);
            } else {
                // Static snapshot: scatter mid-arc for reduced-motion
                initFlyMotion(particle, index);
                const t = 0.25 + Math.random() * 0.55;
                particle.x += particle.vx * t * 40 + particle.outwardAccel * t * t * 200;
                particle.y += particle.vy * t * 40;
            }
            return particle;
        }

        return {
            x: Math.random() * cssWidth,
            y: isAnimated
                ? -20 - (index * cssHeight) / PARTICLE_AMOUNT
                : Math.random() * Math.min(FADE_START_Y, cssHeight),
            size: Math.random() * (PARTICLE_SIZE.max - PARTICLE_SIZE.min) + PARTICLE_SIZE.min,
            speed: Math.random() * (PARTICLE_SPEED.max - PARTICLE_SPEED.min) + PARTICLE_SPEED.min,
            opacity: isAnimated ? null : Math.random() * 0.5 + 0.2,
            drift: Math.random() * 0.4 - 0.2,
            rotation: Math.random() * 360,
            rotationSpeed: Math.random() * 2 - 1
        };
    };

    const resetParticle = (particle) => {
        if (isFly) {
            initFlyMotion(particle, Math.floor(Math.random() * PARTICLE_AMOUNT));
            return;
        }
        particle.y = -10 - Math.random() * 30;
        particle.x = Math.random() * cssWidth;
        particle.speed = Math.random() * (PARTICLE_SPEED.max - PARTICLE_SPEED.min) + PARTICLE_SPEED.min;
        particle.drift = Math.random() * 0.4 - 0.2;
        particle.rotation = Math.random() * 360;
    };

    const drawParticle = (particle) => {
        const opacity = particleOpacity(particle);
        if (opacity <= 0.01) return;

        const size = particle.size;
        ctx.save();
        ctx.translate(particle.x, particle.y);
        ctx.rotate((particle.rotation * Math.PI) / 180);
        ctx.globalAlpha = opacity;
        ctx.drawImage(glyphSprite, -size / 2, -size / 2, size, size);
        ctx.restore();
    };

    const particles = Array.from(
        { length: PARTICLE_AMOUNT },
        (_, i) => createParticle(true, i)
    );

    let animationFrame = null;
    let lastTime = 0;
    let animating = false;

    const stopAnimation = () => {
        if (animationFrame != null) {
            cancelAnimationFrame(animationFrame);
            animationFrame = null;
        }
        animating = false;
    };

    const updateParticle = (particle, frameScale) => {
        if (isFly) {
            particle.vx += (particle.outwardAccel || 0) * frameScale;
            const maxOut = FLY_OUTWARD_MAX;
            if (Math.abs(particle.vx) > maxOut) {
                particle.vx = Math.sign(particle.vx) * maxOut;
            }
            particle.vy = Math.min(
                FLY_DOWN_MAX,
                particle.vy + (particle.downAccel || 0) * frameScale
            );

            particle.wobblePhase += particle.wobbleSpeed * frameScale;
            particle.wobblePhase2 += particle.wobbleSpeed2 * frameScale;
            const wobbleX =
                Math.sin(particle.wobblePhase) * particle.wobbleAmp +
                Math.sin(particle.wobblePhase2) * particle.wobbleAmp2;
            const wobbleY =
                Math.cos(particle.wobblePhase * 0.85) * (particle.wobbleAmp * 0.35) +
                Math.sin(particle.wobblePhase2 * 1.3) * (particle.wobbleAmp2 * 0.5);

            particle.x += (particle.vx + wobbleX * 0.15) * frameScale;
            particle.y += (particle.vy + wobbleY * 0.12) * frameScale;

            const aimDeg = (Math.atan2(particle.vy, particle.vx) * 180) / Math.PI + 90;
            const rotFlutter = Math.sin(particle.wobblePhase) * particle.rotWobbleAmp
                + Math.sin(particle.wobblePhase2) * (particle.rotWobbleAmp * 0.4);
            particle.rotation = aimDeg + rotFlutter + particle.rotationSpeed * frameScale;
        } else {
            particle.y += particle.speed * frameScale;
            particle.x += particle.drift * frameScale;
            particle.rotation += particle.rotationSpeed * frameScale;
        }

        const offBottom = particle.y > cssHeight + 20;
        const fadedOut = isFly && particle.y > FADE_START_Y && particleOpacity(particle) <= 0.02;
        const offSides = particle.x < -50 || particle.x > cssWidth + 50;

        if (offBottom || fadedOut || offSides) {
            resetParticle(particle);
        }
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

        ctx.clearRect(0, 0, cssWidth, cssHeight);
        for (let i = 0; i < particles.length; i++) {
            const particle = particles[i];
            updateParticle(particle, frameScale);
            drawParticle(particle);
        }
    };

    const renderStatic = () => {
        ctx.clearRect(0, 0, cssWidth, cssHeight);
        for (let i = 0; i < PARTICLE_AMOUNT; i++) {
            drawParticle(createParticle(false));
        }
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
