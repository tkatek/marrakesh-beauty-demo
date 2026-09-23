/* ==========================================================================
   animations.js — Marrakesh Beauty
   Hero + scroll reveal animations.
   Uses GSAP when available (CDN), otherwise falls back to an
   IntersectionObserver-based reveal so the site still animates gracefully.
   Honors prefers-reduced-motion.
   ========================================================================== */

(function () {
  "use strict";

  var REDUCED =
    window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ------------------------- Shared scroll-reveal ------------------------- */

  var observer = null;

  function observeReveals() {
    if (!("IntersectionObserver" in window) || REDUCED) return;

    if (observer) {
      // Re-run on newly added nodes (e.g. featured grid injected by main.js)
      var revealables = document.querySelectorAll(".reveal:not(.is-inview)");
      revealables.forEach(function (el) { observer.observe(el); });
      return;
    }

    observer = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-inview");
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.12, rootMargin: "0px 0px -48px 0px" }
    );

    document.querySelectorAll(".reveal").forEach(function (el) {
      observer.observe(el);
    });
  }

  window.MB = window.MB || {};
  window.MB.observeReveals = observeReveals;

  /* ------------------------- GSAP hero timeline ------------------------- */

  function gsapHero() {
    if (REDUCED || !window.gsap) return;

    var heroTitle = document.querySelector(".hero__title");
    if (!heroTitle) return;

    var tl = gsap.timeline({ defaults: { ease: "power3.out" } });

    tl.fromTo(
      ".hero__badge",
      { opacity: 0, y: 18 },
      { opacity: 1, y: 0, duration: 0.6 },
      0.1
    )
      .fromTo(
        ".hero__title",
        { opacity: 0, y: 34 },
        { opacity: 1, y: 0, duration: 0.9 },
        0.3
      )
      .fromTo(
        ".hero__text",
        { opacity: 0, y: 24 },
        { opacity: 1, y: 0, duration: 0.7 },
        0.55
      )
      .fromTo(
        ".hero__cta .btn",
        { opacity: 0, y: 18 },
        { opacity: 1, y: 0, duration: 0.6, stagger: 0.12 },
        0.7
      );

    return tl;
  }

  /* ------------------------- Parallax on hero media (subtle) ------------------------- */

  function gsapParallax() {
    if (REDUCED || !window.gsap) return;

    var hero = document.querySelector(".hero");
    if (!hero) return;

    gsap.to(hero, {
      backgroundPositionY: "42%",
      scrollTrigger: {
        trigger: hero,
        start: "top top",
        end: "bottom top",
        scrub: 0.6
      }
    });
  }

  /* ------------------------- Boot ------------------------- */

  document.addEventListener("DOMContentLoaded", function () {
    observeReveals();

    if (window.gsap) {
      if (window.ScrollTrigger && typeof window.gsap.registerPlugin === "function") {
        window.gsap.registerPlugin(window.ScrollTrigger);
      }
      gsapHero();
      if (window.ScrollTrigger) gsapParallax();
    }
  });
})();