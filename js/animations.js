/* ==========================================================================
   animations.js — Jamal Marrakech
   GSAP hero + ScrollTrigger reveals. Honors prefers-reduced-motion.
   Falls back silently if GSAP missing (main.js handles IO fallback).
   ========================================================================== */
(function () {
  var REDUCED = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  document.addEventListener('DOMContentLoaded', function () {
    if (REDUCED || !window.gsap) return;

    var hasST = !!window.ScrollTrigger;
    if (hasST && typeof gsap.registerPlugin === 'function') gsap.registerPlugin(ScrollTrigger);

    /* Hero entrance — warm, readable, no green flash */
    var hero = document.getElementById('hero');
    if (hero && document.querySelectorAll('[data-hero-in]').length) {
      var tl = gsap.timeline({ defaults: { ease: 'power3.out' } });
      tl.to('[data-hero-in]', { opacity: 1, y: 0, duration: 0.85, stagger: 0.11 }, 0.18)
        .from('.hero__card', { y: 28, opacity: 0, duration: 1, ease: 'power2.out' }, 0.35)
        .from('.hero__float', { y: 18, opacity: 0, duration: 0.7 }, 0.85);
      // subtle sun rotation
      var sun = document.querySelector('.hero__sun svg, .sun svg');
      if (sun) gsap.to(sun, { rotation: 360, duration: 90, repeat: -1, ease: 'none', transformOrigin: '50% 50%' });
    }

    if (!hasST) return;

    // group reveals with stagger — mirrors main.js groups but via GSAP for smoothness
    var groups = ['.best-grid', '.shop-grid', '.why-grid'];
    groups.forEach(function (sel) {
      var grid = document.querySelector(sel);
      if (!grid) return;
      var items = grid.querySelectorAll('.reveal-up');
      if (!items.length) return;
      items.forEach(function (el, i) { el.style.transitionDelay = (i * 0.07) + 's'; });
      ScrollTrigger.create({
        trigger: grid, start: 'top 84%', once: true,
        onEnter: function () { items.forEach(function (el) { el.classList.add('is-visible'); }); }
      });
    });

    // reviews track
    var track = document.getElementById('reviewsTrack');
    if (track) {
      ScrollTrigger.create({
        trigger: '#reviews', start: 'top 82%', once: true,
        onEnter: function () {
          document.querySelectorAll('#reviews .reveal-up').forEach(function (el) { el.classList.add('is-visible'); });
          gsap.fromTo(track, { opacity: 0, x: 24 }, { opacity: 1, x: 0, duration: 0.8, ease: 'power2.out' });
        }
      });
    }

    // single reveals
    var single = document.querySelectorAll('.reveal-up:not(.best-grid .reveal-up):not(.shop-grid .reveal-up):not(.why-grid .reveal-up):not(#reviews .reveal-up)');
    single.forEach(function (el) {
      ScrollTrigger.create({
        trigger: el, start: 'top 87%', once: true,
        onEnter: function () { el.classList.add('is-visible'); }
      });
    });
    document.querySelectorAll('.reveal-img').forEach(function (el) {
      ScrollTrigger.create({
        trigger: el, start: 'top 82%', once: true,
        onEnter: function () { el.classList.add('is-visible'); }
      });
    });
  });
})();
