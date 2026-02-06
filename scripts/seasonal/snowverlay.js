function addSnowverlay() {
    // Check if snowverlay canvas is already added
    const snowverlayCanvas = document.querySelector('.snowverlay');
    if (snowverlayCanvas) {
        return;
    }

    // Configuration constants
    const CANVAS_HEIGHT_PX = 160;
    const SNOWFLAKE_AMOUNT = 15;
    const SNOWFLAKE_SIZE = { min: 10, max: 22 };
    const SNOWFLAKE_SPEED = { min: 0.2, max: 0.7 };
    
    // Dynamically inject styles
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
  
    // Create and inject canvas
    const canvas = document.createElement('canvas');
    canvas.className = 'snowverlay';
    document.body.appendChild(canvas);
    const ctx = canvas.getContext('2d');
    
    // Resize handler
    const resizeCanvas = () => {
      canvas.width = window.innerWidth;
      canvas.height = CANVAS_HEIGHT_PX;
    };
    
    window.addEventListener('resize', resizeCanvas);
    resizeCanvas();
  
    // Snowflake factory
    const createSnowflake = (isAnimated = true, index = 0) => ({
      x: Math.random() * canvas.width,
      y: isAnimated 
        ? -20 - (index * canvas.height) / SNOWFLAKE_AMOUNT
        : Math.random() * canvas.height,
      size: Math.random() * (SNOWFLAKE_SIZE.max - SNOWFLAKE_SIZE.min) + SNOWFLAKE_SIZE.min,
      speed: Math.random() * (SNOWFLAKE_SPEED.max - SNOWFLAKE_SPEED.min) + SNOWFLAKE_SPEED.min,
      opacity: isAnimated ? null : Math.random() * 0.5 + 0.2,
      drift: Math.random() * 0.4 - 0.2, // Random horizontal drift (wind)
      rotation: Math.random() * 360,
      rotationSpeed: Math.random() * 2 - 1 // Degrees per frame
    });

    // Draw single snowflake
    const drawSnowflake = (flake) => {
      ctx.save();
      ctx.translate(flake.x, flake.y);
      ctx.rotate((flake.rotation * Math.PI) / 180);
      ctx.font = `${flake.size}px sans-serif`;
      ctx.fillStyle = `rgba(255, 255, 255, ${flake.opacity ?? (1 - flake.y / canvas.height)})`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('❄', 0, 0);
      ctx.restore();
    };
  
    // Animation control
    let animationFrame;
    const stopAnimation = () => {
      if (animationFrame) cancelAnimationFrame(animationFrame);
    };
  
    // Static snow renderer
    const renderStaticSnow = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      Array.from({ length: SNOWFLAKE_AMOUNT }, () => createSnowflake(false))
        .forEach(drawSnowflake);
    };
  
    // Animated snow renderer
    const startSnowAnimation = () => {
      const snowflakes = Array.from(
        { length: SNOWFLAKE_AMOUNT },
        (_, i) => createSnowflake(true, i)
      );
  
      const animate = () => {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        snowflakes.forEach(flake => {
          flake.y += flake.speed;
          flake.x += flake.drift;
          flake.rotation += flake.rotationSpeed;
          
          if (flake.y > canvas.height) {
            flake.y = -10;
            flake.x = Math.random() * canvas.width;
          }
          
          drawSnowflake(flake);
        });
  
        animationFrame = requestAnimationFrame(animate);
      };
  
      animate();
      return stopAnimation;
    };
  
    // Motion preference handler
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    let currentAnimation = null;
    
    const handleMotionChange = (e) => {
      stopAnimation();
      if (currentAnimation) currentAnimation();
      
      if (e.matches) {
        renderStaticSnow();
        currentAnimation = null;
      } else {
        currentAnimation = startSnowAnimation();
      }
    };
  
    mediaQuery.addEventListener('change', handleMotionChange);
    handleMotionChange(mediaQuery);
  
    // Cleanup on unload
    window.addEventListener('beforeunload', () => {
      mediaQuery.removeEventListener('change', handleMotionChange);
      stopAnimation();
    });
}

addSnowverlay();