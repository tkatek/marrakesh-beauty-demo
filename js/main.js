/* ==========================================================================
   Jamal Marrakech — main.js
   Nav scroll state, mobile sidebar, GSAP entrance + scroll-reveal animations
   ========================================================================== */

document.addEventListener('DOMContentLoaded', () => {

  /* ---------- Nav scroll state ---------- */
  const nav = document.getElementById('nav');
  const onScroll = () => {
    if (window.scrollY > 40) nav.classList.add('is-scrolled');
    else nav.classList.remove('is-scrolled');
  };
  onScroll();
  window.addEventListener('scroll', onScroll, { passive: true });

  /* ---------- Mobile sidebar ---------- */
  const toggle   = document.getElementById('navToggle');
  const sidebar  = document.getElementById('sidebar');
  const overlay  = document.getElementById('sidebarOverlay');
  const closeBtn = document.getElementById('sidebarClose');

  const openSidebar = () => {
    sidebar.classList.add('is-open');
    overlay.classList.add('is-open');
    toggle.classList.add('is-active');
    toggle.setAttribute('aria-expanded', 'true');
    document.body.style.overflow = 'hidden';
  };
  const closeSidebar = () => {
    sidebar.classList.remove('is-open');
    overlay.classList.remove('is-open');
    toggle.classList.remove('is-active');
    toggle.setAttribute('aria-expanded', 'false');
    document.body.style.overflow = '';
  };

  toggle.addEventListener('click', () => {
    sidebar.classList.contains('is-open') ? closeSidebar() : openSidebar();
  });
  closeBtn.addEventListener('click', closeSidebar);
  overlay.addEventListener('click', closeSidebar);
  document.querySelectorAll('.sidebar__links a, .sidebar__btn').forEach(a =>
    a.addEventListener('click', closeSidebar)
  );

  /* ---------- GSAP ---------- */
  if (window.gsap) {
    gsap.registerPlugin(ScrollTrigger);

    /* Hero load sequence — one orchestrated moment */
    const heroTl = gsap.timeline({ defaults: { ease: 'power3.out' } });
    heroTl
      .to('.hero__img', { scale: 1, duration: 1.6, ease: 'power2.out' }, 0)
      .to('[data-hero-in]', {
        opacity: 1, y: 0, duration: 1,
        stagger: 0.12
      }, 0.3)
      .to('.hero__scroll', { opacity: 1, duration: 0.8 }, 1.2)
      .from('.hero__scroll', { opacity: 0 }, 1.2);

    gsap.set('.hero__scroll', { opacity: 0 });
    gsap.to('.hero__scroll', { opacity: 1, duration: 0.8, delay: 1.3 });

    /* Nav fade-in */
    gsap.from('.nav__inner', { opacity: 0, y: -16, duration: 1, delay: 0.2, ease: 'power2.out' });

    /* Scroll-triggered reveals for content below the fold.
       Grouped elements (product/shop/review/why cards) get a small
       stagger via transition-delay so each grid animates in rhythm. */
    const staggerGroups = ['.best-grid', '.reviews__grid', '.shop-grid', '.why-grid'];
    staggerGroups.forEach(sel => {
      const group = document.querySelector(sel);
      if (!group) return;
      const items = group.querySelectorAll('.reveal-up');
      items.forEach((item, i) => { item.style.transitionDelay = `${i * 0.1}s`; });
      ScrollTrigger.create({
        trigger: group,
        start: 'top 82%',
        once: true,
        onEnter: () => items.forEach(item => item.classList.add('is-visible'))
      });
    });

    /* Remaining single reveal-up / reveal-img elements outside grids */
    const grouped = new Set();
    staggerGroups.forEach(sel => {
      document.querySelectorAll(`${sel} .reveal-up`).forEach(el => grouped.add(el));
    });
    document.querySelectorAll('.reveal-up').forEach(el => {
      if (grouped.has(el)) return;
      ScrollTrigger.create({
        trigger: el, start: 'top 85%', once: true,
        onEnter: () => el.classList.add('is-visible')
      });
    });
    document.querySelectorAll('.reveal-img').forEach(el => {
      ScrollTrigger.create({
        trigger: el, start: 'top 80%', once: true,
        onEnter: () => el.classList.add('is-visible')
      });
    });

  } else {
    /* Fallback if GSAP fails to load: just reveal everything */
    document.querySelectorAll('.reveal-up, .reveal-img, [data-hero-in]')
      .forEach(el => { el.style.opacity = 1; el.style.transform = 'none'; });
  }

  /* ---------- Testimonials: drag-to-scroll, no buttons/arrows ---------- */
  const track = document.getElementById('reviewsTrack');
  if (track) {
    let isDown = false, startX = 0, startScroll = 0, moved = false;

    const start = (x) => {
      isDown = true; moved = false;
      startX = x;
      startScroll = track.scrollLeft;
      track.classList.add('is-dragging');
    };
    const move = (x) => {
      if (!isDown) return;
      const dx = x - startX;
      if (Math.abs(dx) > 4) moved = true;
      track.scrollLeft = startScroll - dx;
    };
    const end = () => {
      isDown = false;
      track.classList.remove('is-dragging');
    };

    // Mouse
    track.addEventListener('mousedown', (e) => { start(e.pageX); e.preventDefault(); });
    window.addEventListener('mousemove', (e) => move(e.pageX));
    window.addEventListener('mouseup', end);

    // Touch (native scrolling already works; this just keeps the cursor state tidy)
    track.addEventListener('touchstart', (e) => start(e.touches[0].pageX), { passive: true });
    track.addEventListener('touchmove', (e) => move(e.touches[0].pageX), { passive: true });
    track.addEventListener('touchend', end);

    // Prevent link/text click firing right after a drag
    track.addEventListener('click', (e) => { if (moved) e.preventDefault(); }, true);
  }

});