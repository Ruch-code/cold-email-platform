/**
 * Landing Page 3D Effects
 * Canvas background, floating particles, scroll animations, counters
 */

(function() {
  'use strict';

  // Configuration
  const CONFIG = {
    particleCount: 50,
    particleColors: ['#6366f1', '#a855f7', '#22c55e', '#f59e0b', '#ef4444'],
    canvasBgColor: '#0f1220',
    particleSize: { min: 2, max: 6 },
    particleSpeed: { min: 0.2, max: 0.8 },
    reducedMotion: window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  };

  // State
  let canvas = null;
  let ctx = null;
  let particles = [];
  let floatingParticles = [];
  let animationId = null;
  let lastTime = 0;
  let isInitialized = false;

  // Initialize on DOM ready
  function init() {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', initLanding);
    } else {
      initLanding();
    }
  }

  function initLanding() {
    if (isInitialized) return;
    
    // Check if landing page exists
    if (!document.getElementById('view-landing')) return;
    
    if (CONFIG.reducedMotion) {
      // Reduced motion - just show static elements
      document.querySelectorAll('.reveal').forEach(el => el.classList.add('visible'));
      animateCounters();
      return;
    }

    initCanvas();
    initFloatingParticles();
    initScrollAnimations();
    initCounters();
    initTiltCards();
    initNavigation();
    
    isInitialized = true;
    startAnimationLoop();
  }

  // Canvas Background with 3D particles
  function initCanvas() {
    canvas = document.getElementById('landing-canvas');
    if (!canvas) return;
    
    ctx = canvas.getContext('2d');
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);
    
    // Create background particles
    for (let i = 0; i < CONFIG.particleCount; i++) {
      particles.push(createParticle());
    }
  }

  function resizeCanvas() {
    if (!canvas) return;
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  }

  function createParticle() {
    return {
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      size: Math.random() * (CONFIG.particleSize.max - CONFIG.particleSize.min) + CONFIG.particleSize.min,
      speedX: (Math.random() - 0.5) * 0.3,
      speedY: (Math.random() - 0.5) * 0.3,
      color: CONFIG.particleColors[Math.floor(Math.random() * CONFIG.particleColors.length)],
      opacity: Math.random() * 0.5 + 0.1,
      pulsePhase: Math.random() * Math.PI * 2,
      pulseSpeed: 0.001 + Math.random() * 0.002,
    };
  }

  // Floating particles (CSS-based, DOM elements)
  function initFloatingParticles() {
    const container = document.getElementById('floating-particles');
    if (!container) return;

    for (let i = 0; i < 30; i++) {
      setTimeout(() => {
        const particle = document.createElement('div');
        particle.className = 'floating-particle';
        
        const size = Math.random() * 8 + 4;
        const color = CONFIG.particleColors[Math.floor(Math.random() * CONFIG.particleColors.length)];
        
        particle.style.cssText = `
          width: ${size}px;
          height: ${size}px;
          background: ${color};
          left: ${Math.random() * 100}%;
          animation-delay: ${Math.random() * 20}s;
          animation-duration: ${15 + Math.random() * 15}s;
          opacity: ${0.1 + Math.random() * 0.4};
          box-shadow: 0 0 ${size * 2}px ${color};
        `;
        
        container.appendChild(particle);
        
        // Remove after animation
        particle.addEventListener('animationend', () => particle.remove());
      }, Math.random() * 20000);
    }
  }

  // Animation loop for canvas
  function startAnimationLoop() {
    function loop(time) {
      if (!ctx) return;
      
      const delta = time - lastTime;
      lastTime = time;
      
      // Clear canvas
      ctx.fillStyle = CONFIG.canvasBgColor;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      
      // Update and draw particles
      particles.forEach(p => {
        // Update position
        p.x += p.speedX;
        p.y += p.speedY;
        
        // Pulse effect
        p.pulsePhase += p.pulseSpeed;
        const pulse = Math.sin(p.pulsePhase) * 0.3 + 0.7;
        
        // Wrap around edges
        if (p.x < -p.size) p.x = canvas.width + p.size;
        if (p.x > canvas.width + p.size) p.x = -p.size;
        if (p.y < -p.size) p.y = canvas.height + p.size;
        if (p.y > canvas.height + p.size) p.y = -p.size;
        
        // Draw
        ctx.globalAlpha = p.opacity * pulse;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fillStyle = p.color;
        ctx.fill();
      });
      
      // Draw connections between nearby particles
      drawConnections();
      
      ctx.globalAlpha = 1;
      
      animationId = requestAnimationFrame(loop);
    }
    
    animationId = requestAnimationFrame(loop);
  }

  function drawConnections() {
    const maxDist = 150;
    
    for (let i = 0; i < particles.length; i++) {
      for (let j = i + 1; j < particles.length; j++) {
        const dx = particles[i].x - particles[j].x;
        const dy = particles[i].y - particles[j].y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        
        if (dist < maxDist) {
          const opacity = (1 - dist / maxDist) * 0.15;
          ctx.globalAlpha = opacity;
          ctx.beginPath();
          ctx.moveTo(particles[i].x, particles[i].y);
          ctx.lineTo(particles[j].x, particles[j].y);
          ctx.strokeStyle = '#6366f1';
          ctx.lineWidth = 0.5;
          ctx.stroke();
        }
      }
    }
  }

  // Scroll-triggered animations
  function initScrollAnimations() {
    const revealElements = document.querySelectorAll('.reveal, .feature-card, .ai-model-card, .workflow-step, .workflow-step');
    
    if ('IntersectionObserver' in window) {
      const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            entry.target.classList.add('visible');
            observer.unobserve(entry.target);
          }
        });
      }, {
        threshold: 0.1,
        rootMargin: '0px 0px -50px 0px'
      });
      
      document.querySelectorAll('.feature-card, .ai-model-card, .workflow-step, .landing-cta, .landing-footer').forEach(el => {
        el.classList.add('reveal');
        observer.observe(el);
      });
    } else {
      // Fallback
      document.querySelectorAll('.reveal').forEach(el => el.classList.add('visible'));
    }
  }

  // Counter animations
  function initCounters() {
    const counters = document.querySelectorAll('.trust-number[data-count]');
    
    const counterObserver = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          animateCounter(entry.target);
          counterObserver.unobserve(entry.target);
        }
      });
    }, { threshold: 0.5 });
    
    counters.forEach(counter => counterObserver.observe(counter));
  }

  function animateCounter(el) {
    const target = parseInt(el.dataset.count, 10);
    const duration = 2000;
    const startTime = performance.now();
    
    function update(time) {
      const progress = Math.min((time - startTime) / duration, 1);
      const eased = easeOutCubic(progress);
      const current = Math.floor(target * eased);
      el.textContent = current.toLocaleString();
      
      if (progress < 1) {
        requestAnimationFrame(update);
      } else {
        el.textContent = target.toLocaleString();
      }
    }
    
    requestAnimationFrame(update);
  }

  function easeOutCubic(t) {
    return 1 - Math.pow(1 - t, 3);
  }

  // 3D Tilt effect for cards
  function initTiltCards() {
    const tiltCards = document.querySelectorAll('[data-tilt]');
    
    tiltCards.forEach(card => {
      card.addEventListener('mousemove', handleTilt);
      card.addEventListener('mouseleave', resetTilt);
    });
  }

  function handleTilt(e) {
    const card = e.currentTarget;
    const rect = card.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;
    
    const rotateX = (y - centerY) / centerY * 8;
    const rotateY = (centerX - x) / centerX * 8;
    
    card.style.transform = `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) scale3d(1.02, 1.02, 1.02)`;
  }

  function resetTilt(e) {
    const card = e.currentTarget;
    card.style.transform = '';
  }

  // Navigation handling
  function initNavigation() {
    // Handle data-goto buttons
    document.querySelectorAll('[data-goto]').forEach(btn => {
      btn.addEventListener('click', () => {
        const view = btn.dataset.goto;
        if (window.switchView) {
          window.switchView(view);
        }
      });
    });
  }

  // Expose for cleanup
  window.Landing3D = {
    destroy: () => {
      cancelAnimationFrame(animationId);
      window.removeEventListener('resize', resizeCanvas);
      canvas = null;
      ctx = null;
      particles = [];
    }
  };

  // Auto-init
  init();
})();