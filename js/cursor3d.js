/**
 * 3D Mouse Cursor System - fellou.ai style
 * Features:
 * - Custom cursor with job-themed particle trail
 * - 3D card tilt on hover
 * - Magnetic button attraction
 * - Click ripple with job icons
 * - Parallax background depth
 * - Dark/light mode compatible
 */

(function() {
  'use strict';

  // Configuration
  const CONFIG = {
    trailLength: 12,
    trailLifetime: 600,
    particleSize: { min: 4, max: 12 },
    magneticRadius: 80,
    magneticStrength: 0.15,
    tiltMax: 8,
    tiltSpeed: 0.1,
    rippleDuration: 500,
    parallaxDepth: 30,
    reducedMotion: window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    isMobile: /Mobi|Android/i.test(navigator.userAgent),
  };

  // Job-themed particle icons
  const JOB_ICONS = [
    '💼', '🚀', '💻', '📄', '🔍', '📧', '🎯', '💡',
    '⚡', '🌟', '📈', '🔗', '🎓', '🏢', '💰', '✨'
  ];

  const JOB_ICONS_LIGHT = [
    '💼', '🚀', '💻', '📄', '🔍', '📧', '🎯', '💡',
    '⚡', '🌟', '📈', '🔗', '🎓', '🏢', '💰', '✨'
  ];

  // State
  let mouseX = 0, mouseY = 0;
  let trail = [];
  let cursorElement = null;
  let trailContainer = null;
  let parallaxLayers = [];
  let magneticElements = [];
  let tiltElements = [];
  let rippleContainer = null;
  let animationId = null;
  let isDarkMode = true;
  let lastClickTime = 0;

  // Initialize
  function init() {
    if (CONFIG.reducedMotion || CONFIG.isMobile) {
      // Fallback for mobile/reduced motion - just add basic hover effects
      initFallback();
      return;
    }

    detectColorScheme();
    createCursor();
    createTrailContainer();
    createRippleContainer();
    setupEventListeners();
    discoverElements();
    startAnimationLoop();
    
    // Watch for color scheme changes
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', detectColorScheme);
  }

  function detectColorScheme() {
    isDarkMode = window.matchMedia('(prefers-color-scheme: dark)').matches;
    document.documentElement.classList.toggle('cursor-light', !isDarkMode);
    document.documentElement.classList.toggle('cursor-dark', isDarkMode);
  }

  function createCursor() {
    cursorElement = document.createElement('div');
    cursorElement.className = 'cursor-3d';
    cursorElement.innerHTML = `
      <div class="cursor-core"></div>
      <div class="cursor-ring"></div>
      <div class="cursor-ring cursor-ring-2"></div>
    `;
    document.body.appendChild(cursorElement);
  }

  function createTrailContainer() {
    trailContainer = document.createElement('div');
    trailContainer.className = 'cursor-trail-container';
    trailContainer.setAttribute('aria-hidden', 'true');
    document.body.appendChild(trailContainer);
  }

  function createRippleContainer() {
    rippleContainer = document.createElement('div');
    rippleContainer.className = 'cursor-ripple-container';
    rippleContainer.setAttribute('aria-hidden', 'true');
    document.body.appendChild(rippleContainer);
  }

  function setupEventListeners() {
    // Mouse move
    document.addEventListener('mousemove', (e) => {
      mouseX = e.clientX;
      mouseY = e.clientY;
      
      if (!CONFIG.reducedMotion) {
        updateCursorPosition();
        addTrailParticle();
        updateParallax();
        updateMagneticElements();
      }
    }, { passive: true });

    // Mouse down/up for click effects
    document.addEventListener('mousedown', (e) => {
      if (e.button === 0) createClickRipple(e.clientX, e.clientY);
      cursorElement?.classList.add('cursor-click');
    });

    document.addEventListener('mouseup', () => {
      cursorElement?.classList.remove('cursor-click');
    });

    // Mouse leave/enter viewport
    document.addEventListener('mouseleave', () => {
      cursorElement?.classList.add('cursor-hidden');
    });

    document.addEventListener('mouseenter', () => {
      cursorElement?.classList.remove('cursor-hidden');
    });

    // Keyboard navigation support
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Tab') {
        cursorElement?.classList.add('cursor-keyboard');
      }
    });

    document.addEventListener('keyup', (e) => {
      if (e.key === 'Tab') {
        cursorElement?.classList.remove('cursor-keyboard');
      }
    });

    // Scroll for parallax
    window.addEventListener('scroll', updateParallax, { passive: true });

    // Resize
    window.addEventListener('resize', discoverElements);
  }

  function discoverElements() {
    // Find elements for magnetic attraction
    magneticElements = Array.from(document.querySelectorAll(
      '.btn, .nav-item, .card, .card-action button, .auth-tab, .tag, .match-pill, .badge, .stat-card, .sal-card, .ats-metric'
    )).filter(el => isVisible(el));

    // Find elements for 3D tilt
    tiltElements = Array.from(document.querySelectorAll(
      '.card, .stat-card, .panel, .sal-card, .ats-metric, .auth-panel, .preview-box'
    )).filter(el => isVisible(el));

    // Find parallax layers (elements with data-parallax attribute)
    parallaxLayers = Array.from(document.querySelectorAll('[data-parallax]')).filter(el => isVisible(el));
    
    // Auto-add parallax to hero sections
    if (parallaxLayers.length === 0) {
      const heroSections = document.querySelectorAll('.page-head, .brand, .footer-brand');
      heroSections.forEach((el, i) => {
        el.setAttribute('data-parallax', String(0.1 + i * 0.05));
        parallaxLayers.push(el);
      });
    }
  }

  function isVisible(el) {
    const rect = el.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0 && 
           rect.top < window.innerHeight && rect.bottom > 0 &&
           rect.left < window.innerWidth && rect.right > 0;
  }

  function updateCursorPosition() {
    if (!cursorElement) return;
    cursorElement.style.transform = `translate(${mouseX}px, ${mouseY}px)`;
  }

  function addTrailParticle() {
    const now = Date.now();
    
    // Throttle particle creation
    if (trail.length > 0 && now - trail[trail.length - 1].time < 30) return;
    
    const icon = isDarkMode 
      ? JOB_ICONS[Math.floor(Math.random() * JOB_ICONS.length)]
      : JOB_ICONS_LIGHT[Math.floor(Math.random() * JOB_ICONS_LIGHT.length)];
    
    const size = CONFIG.particleSize.min + Math.random() * (CONFIG.particleSize.max - CONFIG.particleSize.min);
    const particle = {
      x: mouseX,
      y: mouseY,
      icon,
      size,
      rotation: Math.random() * 360,
      rotationSpeed: (Math.random() - 0.5) * 2,
      scale: 0,
      opacity: 1,
      time: now,
      element: createParticleElement(icon, size)
    };

    trailContainer.appendChild(particle.element);
    trail.push(particle);

    // Limit trail length
    if (trail.length > CONFIG.trailLength) {
      removeOldestParticle();
    }
  }

  function createParticleElement(icon, size) {
    const el = document.createElement('div');
    el.className = 'trail-particle';
    el.textContent = icon;
    el.style.fontSize = `${size}px`;
    el.style.left = `${mouseX}px`;
    el.style.top = `${mouseY}px`;
    return el;
  }

  function removeOldestParticle() {
    const oldest = trail.shift();
    if (oldest?.element?.parentNode) {
      oldest.element.style.opacity = '0';
      oldest.element.style.transform += ' scale(0)';
      setTimeout(() => oldest.element?.remove(), 300);
    }
  }

  function updateTrail() {
    const now = Date.now();
    
    trail.forEach((particle, index) => {
      const age = now - particle.time;
      const progress = Math.min(age / CONFIG.trailLifetime, 1);
      
      // Fade out
      particle.opacity = 1 - progress;
      particle.scale = 1 - progress * 0.5;
      particle.rotation += particle.rotationSpeed;
      
      // Apply transforms
      particle.element.style.opacity = particle.opacity;
      particle.element.style.transform = `translate(-50%, -50%) rotate(${particle.rotation}deg) scale(${particle.scale})`;
      
      // Remove expired
      if (progress >= 1) {
        particle.element.remove();
      }
    });
    
    // Clean up expired particles
    trail = trail.filter(p => now - p.time < CONFIG.trailLifetime);
  }

  function updateParallax() {
    const scrollY = window.scrollY;
    const centerX = window.innerWidth / 2;
    const centerY = window.innerHeight / 2;
    const offsetX = (mouseX - centerX) / centerX;
    const offsetY = (mouseY - centerY) / centerY;

    parallaxLayers.forEach(layer => {
      const depth = parseFloat(layer.getAttribute('data-parallax') || '0.1');
      const x = offsetX * CONFIG.parallaxDepth * depth;
      const y = offsetY * CONFIG.parallaxDepth * depth + scrollY * depth * 0.1;
      layer.style.transform = `translate3d(${x}px, ${y}px, 0)`;
    });
  }

  function updateMagneticElements() {
    magneticElements.forEach(el => {
      const rect = el.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;
      const distX = mouseX - centerX;
      const distY = mouseY - centerY;
      const distance = Math.sqrt(distX * distX + distY * distY);

      if (distance < CONFIG.magneticRadius) {
        const force = (1 - distance / CONFIG.magneticRadius) * CONFIG.magneticStrength;
        const moveX = distX * force;
        const moveY = distY * force;
        
        el.style.transform = `translate(${moveX}px, ${moveY}px)`;
        el.classList.add('magnetic-active');
      } else {
        el.style.transform = '';
        el.classList.remove('magnetic-active');
      }
    });
  }

  function updateTiltElements() {
    tiltElements.forEach(el => {
      const rect = el.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;
      const distX = mouseX - centerX;
      const distY = mouseY - centerY;
      const distance = Math.sqrt(distX * distX + distY * distY);
      const maxDist = Math.max(rect.width, rect.height) * 0.8;

      if (distance < maxDist) {
        const rotateX = (distY / maxDist) * CONFIG.tiltMax;
        const rotateY = -(distX / maxDist) * CONFIG.tiltMax;
        
        el.style.transform = `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) scale3d(1.02, 1.02, 1.02)`;
        el.classList.add('tilt-active');
      } else {
        // Smooth return to normal
        const currentTransform = el.style.transform;
        if (currentTransform && currentTransform.includes('rotate')) {
          el.style.transform = '';
          el.classList.remove('tilt-active');
        }
      }
    });
  }

  function createClickRipple(x, y) {
    const now = Date.now();
    if (now - lastClickTime < 100) return; // Debounce
    lastClickTime = now;

    const icon = isDarkMode 
      ? JOB_ICONS[Math.floor(Math.random() * JOB_ICONS.length)]
      : JOB_ICONS_LIGHT[Math.floor(Math.random() * JOB_ICONS_LIGHT.length)];

    const ripple = document.createElement('div');
    ripple.className = 'click-ripple';
    ripple.innerHTML = `
      <div class="ripple-ring"></div>
      <div class="ripple-icon">${icon}</div>
      <div class="ripple-ring ripple-ring-2"></div>
    `;
    ripple.style.left = `${x}px`;
    ripple.style.top = `${y}px`;
    
    rippleContainer.appendChild(ripple);

    // Animate
    requestAnimationFrame(() => {
      ripple.classList.add('ripple-active');
    });

    setTimeout(() => {
      ripple.classList.remove('ripple-active');
      ripple.classList.add('ripple-fade');
      setTimeout(() => ripple.remove(), 300);
    }, CONFIG.rippleDuration);
  }

  function startAnimationLoop() {
    function loop() {
      updateTrail();
      updateTiltElements();
      animationId = requestAnimationFrame(loop);
    }
    loop();
  }

  function initFallback() {
    // Minimal fallback for mobile/reduced motion
    document.querySelectorAll('.card, .btn, .stat-card').forEach(el => {
      el.classList.add('fallback-hover');
    });
    // Add basic cursor style
    document.body.style.cursor = 'default';
  }

  // Public API
  window.Cursor3D = {
    init,
    destroy: () => {
      cancelAnimationFrame(animationId);
      cursorElement?.remove();
      trailContainer?.remove();
      rippleContainer?.remove();
      trail.forEach(p => p.element?.remove());
      trail = [];
      magneticElements.forEach(el => el.style.transform = '');
      tiltElements.forEach(el => el.style.transform = '');
    },
    refresh: discoverElements,
    setColorScheme: (dark) => {
      isDarkMode = dark;
      detectColorScheme();
    }
  };

  // Auto-init when DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();