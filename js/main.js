/* ==========================================================================
   Jamal Marrakech — main.js
   Nav, sidebar, draggable reviews slider, filters, gallery, qty, order summary
   ========================================================================== */
document.addEventListener('DOMContentLoaded', () => {

  /* ---------- Nav scroll ---------- */
  const nav = document.getElementById('nav');
  if (nav) {
    const onScroll = () => nav.classList.toggle('is-scrolled', window.scrollY > 28);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
  }

  /* ---------- Mobile sidebar ---------- */
  const toggle = document.getElementById('navToggle');
  const sidebar = document.getElementById('sidebar');
  const overlay = document.getElementById('sidebarOverlay');
  const closeBtn = document.getElementById('sidebarClose');

  if (toggle && sidebar && overlay) {
    const open = () => {
      sidebar.classList.add('is-open');
      sidebar.setAttribute('aria-hidden', 'false');
      overlay.classList.add('is-open');
      toggle.classList.add('is-active');
      toggle.setAttribute('aria-expanded', 'true');
      document.body.style.overflow = 'hidden';
    };
    const close = () => {
      sidebar.classList.remove('is-open');
      sidebar.setAttribute('aria-hidden', 'true');
      overlay.classList.remove('is-open');
      toggle.classList.remove('is-active');
      toggle.setAttribute('aria-expanded', 'false');
      document.body.style.overflow = '';
    };
    toggle.addEventListener('click', () => sidebar.classList.contains('is-open') ? close() : open());
    if (closeBtn) closeBtn.addEventListener('click', close);
    overlay.addEventListener('click', close);
    document.addEventListener('keydown', e => { if (e.key === 'Escape') close(); });
    document.querySelectorAll('.sidebar__links a, .sidebar__btn').forEach(a => a.addEventListener('click', close));
  }

  /* ---------- Draggable reviews slider — no arrows ---------- */
  const track = document.getElementById('reviewsTrack');
  if (track) {
    let isDown = false, startX = 0, scrollLeft = 0, hasDragged = false;

    const getX = e => (e.touches ? e.touches[0].pageX : e.pageX);
    const onDown = e => {
      isDown = true; hasDragged = false;
      track.classList.add('is-dragging');
      startX = getX(e) - track.offsetLeft;
      scrollLeft = track.scrollLeft;
    };
    const onMove = e => {
      if (!isDown) return;
      const x = getX(e) - track.offsetLeft;
      const walk = (x - startX) * 1.15;
      if (Math.abs(walk) > 4) hasDragged = true;
      track.scrollLeft = scrollLeft - walk;
    };
    const onUp = () => {
      isDown = false;
      track.classList.remove('is-dragging');
      // prevent click on cards after a drag
      if (hasDragged) {
        const handler = ev => { ev.preventDefault(); ev.stopPropagation(); track.removeEventListener('click', handler, true); };
        track.addEventListener('click', handler, true);
        setTimeout(() => track.removeEventListener('click', handler, true), 0);
      }
    };

    track.addEventListener('mousedown', onDown);
    track.addEventListener('mousemove', onMove);
    track.addEventListener('mouseup', onUp);
    track.addEventListener('mouseleave', () => { isDown = false; track.classList.remove('is-dragging'); });
    track.addEventListener('touchstart', onDown, { passive: true });
    track.addEventListener('touchmove', onMove, { passive: true });
    track.addEventListener('touchend', onUp);

    // wheel: horizontal scroll with touchpad feels natural — no extra code needed
    // auto nudge on load so users discover it's draggable
    requestAnimationFrame(() => {
      track.scrollLeft = 0;
      setTimeout(() => {
        if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
          track.scrollTo({ left: 56, behavior: 'smooth' });
          setTimeout(() => track.scrollTo({ left: 0, behavior: 'smooth' }), 900);
        }
      }, 1200);
    });
  }

  /* ---------- Product filters (products.html) ---------- */
  const chips = document.querySelectorAll('[data-filter]');
  const cards = document.querySelectorAll('#productGrid [data-category]');
  const noResults = document.getElementById('noResults');
  if (chips.length && cards.length) {
    chips.forEach(chip => {
      chip.addEventListener('click', () => {
        const f = chip.dataset.filter;
        chips.forEach(c => c.classList.toggle('is-active', c === chip));
        let visible = 0;
        cards.forEach(card => {
          const show = f === 'all' || card.dataset.category === f;
          card.style.display = show ? '' : 'none';
          if (show) visible++;
        });
        if (noResults) noResults.style.display = visible === 0 ? 'block' : 'none';
        // re-trigger reveal for visible cards
        cards.forEach(c => { if (c.style.display !== 'none') c.classList.add('is-visible'); });
      });
    });
  }

  /* ---------- Gallery (product-details) ---------- */
  const mainImg = document.getElementById('galleryMain');
  const thumbs = document.querySelectorAll('[data-thumb]');
  if (mainImg && thumbs.length) {
    thumbs.forEach(btn => {
      btn.addEventListener('click', () => {
        mainImg.src = btn.dataset.thumb;
        thumbs.forEach(b => b.classList.remove('is-active'));
        btn.classList.add('is-active');
      });
    });
  }

  /* ---------- Qty + order summary ---------- */
  const stepper = document.querySelector('[data-qty]');
  const sizeSel = document.querySelector('[data-size]');
  const unitEl = document.querySelector('[data-summary-unit]');
  const totalEl = document.querySelector('[data-summary-total]');
  if (stepper || sizeSel) {
    const countEl = stepper ? stepper.querySelector('[data-qty-count]') : null;
    const inputEl = stepper ? stepper.querySelector('[data-qty-input]') : null;
    let qty = 1;

    const unitPrice = () => {
      const opt = sizeSel ? sizeSel.selectedOptions[0] : null;
      const p = opt ? parseFloat(opt.dataset.price) : (unitEl ? parseFloat(unitEl.textContent) : 0);
      return isNaN(p) ? 0 : p;
    };

    const render = () => {
      const unit = unitPrice();
      if (countEl) countEl.textContent = qty;
      if (inputEl) inputEl.value = qty;
      if (unitEl) unitEl.textContent = unit.toFixed(0);
      if (totalEl) totalEl.textContent = (unit * qty).toFixed(0);
      const minus = stepper ? stepper.querySelector('[data-qty-minus]') : null;
      if (minus) minus.disabled = qty <= 1;
    };

    if (stepper) {
      stepper.querySelector('[data-qty-minus]')?.addEventListener('click', () => { if (qty > 1) { qty--; render(); } });
      stepper.querySelector('[data-qty-plus]')?.addEventListener('click', () => { qty++; render(); });
    }
    if (sizeSel) sizeSel.addEventListener('change', render);
    render();
  }

  /* ---------- Reveal fallback if GSAP not present ---------- */
  if (!window.gsap) {
    const io = 'IntersectionObserver' in window ? new IntersectionObserver((entries) => {
      entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add('is-visible'); io.unobserve(e.target); } });
    }, { threshold: 0.12 }) : null;
    if (io) document.querySelectorAll('.reveal-up, .reveal-img').forEach(el => io.observe(el));
    else document.querySelectorAll('.reveal-up, .reveal-img').forEach(el => el.classList.add('is-visible'));
    document.querySelectorAll('[data-hero-in]').forEach(el => { el.style.opacity = 1; el.style.transform = 'none'; });
  }

});
