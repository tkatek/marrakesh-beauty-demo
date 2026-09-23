/* =====================================================================
   JAMAL MARRAKECH — ROSE EDITION
   Vanilla JavaScript + optional GSAP / ScrollTrigger enhancement.

   • Product information is read from the seven static HTML cards.
   • Cart and saved products use validated, versioned local storage.
   • No checkout, newsletter subscription, or network write is performed.
   • Every shopping feature works independently of the GSAP CDN.
   ===================================================================== */
(() => {
  'use strict';

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const escapeHTML = value => String(value).replace(/[&<>"']/g, char => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[char]));
  const icon = name => `<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><use href="#i-${name}"></use></svg>`;
  const formatPrice = number => `${new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(number)} MAD`;
  const normalize = value => String(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
  const STORAGE = Object.freeze({ cart: 'jamal-rose-cart-v1', saved: 'jamal-rose-saved-v1', motion: 'jamal-rose-motion-v1' });
  const MAX_QUANTITY = 99;

  const storage = {
    read(key, fallback) {
      try { const raw = localStorage.getItem(key); return raw === null ? fallback : JSON.parse(raw); }
      catch { return fallback; }
    },
    write(key, value) {
      try { localStorage.setItem(key, JSON.stringify(value)); return true; }
      catch { return false; } // Private mode / blocked storage: state remains usable for this visit.
    }
  };

  function init() {
    const cards = $$('.product-card[data-product]');
    const products = cards.map((element, index) => ({
      id: element.dataset.product,
      element,
      index,
      name: $('h3', element).textContent.trim(),
      category: element.dataset.category,
      subtitle: $('.product-card__subtitle', element).textContent.trim(),
      description: $('.product-description', element).textContent.trim(),
      image: $('img', element).getAttribute('src'),
      badge: $('.product-card__badge', element).textContent.trim(),
      variants: $$('.size-chip', element).map(button => ({
        size: button.dataset.size,
        price: Number(button.dataset.price)
      }))
    }));
    const productMap = new Map(products.map(product => [product.id, product]));
    const selectedSizes = new Map(products.map(product => [product.id, product.variants[0].size]));
    const root = document.documentElement;
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    const state = {
      saved: new Set(), cart: [], filter: 'all', sort: 'featured',
      motionPaused: storage.read(STORAGE.motion, false) === true,
      quickviewId: null
    };
    const rawSaved = storage.read(STORAGE.saved, []);
    if (Array.isArray(rawSaved)) rawSaved.filter(id => productMap.has(id)).forEach(id => state.saved.add(id));

    // Treat storage as untrusted. Never use stored prices, markup, or arbitrary product IDs.
    function validateCart(raw) {
      const result = [];
      if (!Array.isArray(raw)) return result;
      for (const item of raw.slice(0, 100)) {
        if (!item || typeof item !== 'object') continue;
        const product = productMap.get(item.id);
        if (!product || !product.variants.some(variant => variant.size === item.size)) continue;
        const quantity = Number(item.quantity);
        if (!Number.isInteger(quantity) || quantity <= 0) continue;
        const existing = result.find(row => row.id === item.id && row.size === item.size);
        if (existing) existing.quantity = Math.min(MAX_QUANTITY, existing.quantity + quantity);
        else result.push({ id: item.id, size: item.size, quantity: Math.min(MAX_QUANTITY, quantity) });
      }
      return result;
    }
    state.cart = validateCart(storage.read(STORAGE.cart, []));

    const refs = {
      header: $('#siteHeader'), grid: $('#productsGrid'), count: $('#productCount'),
      help: $('#ritualHelp'), empty: $('#collectionEmpty'),
      cart: $('#cartDialog'), cartItems: $('#cartItems'), cartFooter: $('#cartFooter'),
      quickview: $('#quickviewDialog'), search: $('#searchDialog'),
      menu: $('#mobileMenu'), toast: $('#toast'), reviews: $('#reviewsTrack')
    };
    let toastTimer;
    let gsapMedia = null;
    let hasPlayedHero = false;
    let animationLibrariesReady = false;
    const restoreFocus = new WeakMap();
    const feedbackTimers = new WeakMap();

    function isMotionAllowed() { return !reduceMotion.matches && !state.motionPaused; }

    function announce(message) {
      clearTimeout(toastTimer);
      refs.toast.textContent = message;
      refs.toast.classList.add('is-visible');
      toastTimer = window.setTimeout(() => refs.toast.classList.remove('is-visible'), 2800);
    }

    /* -------------------------- Modal lifecycle ------------------------ */
    function openDialog(dialog, trigger = document.activeElement) {
      if (!dialog) return;
      // When one dialog opens another, return focus to a visible page control on close.
      if (trigger?.closest?.('dialog')) trigger = $('[data-open-search]');
      for (const other of $$('dialog[open]')) if (other !== dialog) other.close();
      restoreFocus.set(dialog, trigger);
      if (!dialog.open) dialog.showModal();
      document.body.classList.add('dialog-open');
      $('#menuToggle').setAttribute('aria-expanded', String(refs.menu.open));
      if (dialog === refs.search) requestAnimationFrame(() => $('#searchInput').focus());
    }
    function closeDialog(dialog) { if (dialog?.open) dialog.close(); }
    $$('dialog').forEach(dialog => {
      dialog.addEventListener('close', () => {
        document.body.classList.toggle('dialog-open', $$('dialog[open]').length > 0);
        $('#menuToggle').setAttribute('aria-expanded', String(refs.menu.open));
        const previous = restoreFocus.get(dialog);
        if (!$$('dialog[open]').length && previous?.isConnected && previous.getClientRects().length) previous.focus({ preventScroll: true });
      });
      // Click outside the panel closes it; clicking padding inside does not.
      dialog.addEventListener('click', event => {
        if (event.target !== dialog) return;
        const rect = dialog.getBoundingClientRect();
        if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) closeDialog(dialog);
      });
    });
    $$('a', refs.menu).forEach(link => link.addEventListener('click', () => closeDialog(refs.menu)));

    /* ----------------------- Catalog and size choices ------------------ */
    function variantFor(id, size = selectedSizes.get(id)) {
      const product = productMap.get(id);
      return product?.variants.find(variant => variant.size === size) || product?.variants[0];
    }
    function updateSize(id, size) {
      const product = productMap.get(id);
      if (!product || !product.variants.some(variant => variant.size === size)) return;
      selectedSizes.set(id, size);
      $$('.size-chip', product.element).forEach(button => {
        const selected = button.dataset.size === size;
        button.classList.toggle('is-selected', selected);
        button.setAttribute('aria-pressed', String(selected));
      });
      $('.product-price strong', product.element).textContent = variantFor(id).price;
      if (state.quickviewId === id) {
        $$('[data-q-size]', refs.quickview).forEach(button => {
          const selected = button.dataset.qSize === size;
          button.classList.toggle('is-selected', selected);
          button.setAttribute('aria-pressed', String(selected));
        });
        const price = $('.quickview-price', refs.quickview);
        if (price) price.textContent = formatPrice(variantFor(id).price);
      }
      if (state.sort.startsWith('price')) renderCatalog();
    }
    function renderCatalog() {
      const ordered = [...products].sort((a, b) => {
        if (state.sort === 'price-asc') return variantFor(a.id).price - variantFor(b.id).price;
        if (state.sort === 'price-desc') return variantFor(b.id).price - variantFor(a.id).price;
        if (state.sort === 'name') return a.name.localeCompare(b.name);
        return a.index - b.index;
      });
      let count = 0;
      for (const product of ordered) {
        const visible = state.filter === 'all'
          || (state.filter === 'saved' ? state.saved.has(product.id) : product.category === state.filter);
        product.element.hidden = !visible;
        refs.grid.append(product.element);
        if (visible) count++;
      }
      refs.grid.append(refs.help);
      refs.help.hidden = state.filter !== 'all';
      refs.empty.hidden = count !== 0;
      refs.count.textContent = `${count} product${count === 1 ? '' : 's'} shown${state.filter === 'saved' ? ' in saved items' : ''}`;
      $$('[data-filter]').forEach(button => {
        const active = button.dataset.filter === state.filter;
        button.classList.toggle('is-active', active);
        button.setAttribute('aria-pressed', String(active));
      });
      window.ScrollTrigger?.refresh();
    }
    function setFilter(filter, scrollToCollection = false) {
      if (!['all', 'face', 'body', 'saved'].includes(filter)) return;
      state.filter = filter;
      renderCatalog();
      if (scrollToCollection) $('#collection').scrollIntoView({ behavior: isMotionAllowed() ? 'smooth' : 'auto' });
    }
    function renderFavorites() {
      for (const product of products) {
        const button = $('[data-favorite]', product.element);
        const saved = state.saved.has(product.id);
        button.setAttribute('aria-pressed', String(saved));
        button.setAttribute('aria-label', `${saved ? 'Unsave' : 'Save'} ${product.name}`);
      }
      $('#savedCount').textContent = String(state.saved.size);
      $('#savedCount').hidden = state.saved.size === 0;
      $('#showSaved').setAttribute('aria-label', `View ${state.saved.size} saved product${state.saved.size === 1 ? '' : 's'}`);
    }
    function toggleFavorite(id) {
      if (!productMap.has(id)) return;
      const wasSaved = state.saved.has(id);
      if (wasSaved) state.saved.delete(id); else state.saved.add(id);
      const persisted = storage.write(STORAGE.saved, [...state.saved]);
      renderFavorites();
      if (state.filter === 'saved') renderCatalog();
      announce(wasSaved ? 'Removed from your saved rituals.' : (persisted ? 'Saved for another lovely day.' : 'Saved for this visit. Browser storage is unavailable.'));
    }
    $('#productSort').addEventListener('change', event => {
      state.sort = event.target.value;
      renderCatalog();
    });

    /* ----------------------- Bag / quantity / totals ------------------- */
    const rowKey = row => `${row.id}|${row.size}`;
    function cartSummary() {
      return state.cart.reduce((summary, row) => {
        summary.count += row.quantity;
        summary.total += variantFor(row.id, row.size).price * row.quantity;
        return summary;
      }, { count: 0, total: 0 });
    }
    function persistCart() { storage.write(STORAGE.cart, state.cart); }
    function renderCart(focus = null) {
      const summary = cartSummary();
      $('#cartCount').textContent = String(summary.count);
      $$('[data-open-cart]').forEach(button => button.setAttribute('aria-label', `Open shopping bag, ${summary.count} item${summary.count === 1 ? '' : 's'}`));
      $('#cartTotal').textContent = formatPrice(summary.total);
      $('#orderPreview').hidden = true;
      refs.cartFooter.hidden = state.cart.length === 0;
      if (!state.cart.length) {
        refs.cartItems.innerHTML = `<div class="cart-empty">${icon('bag')}<h3>A little room for lovely.</h3><p>Your beauty bag is empty. Discover your first everyday essential.</p><button class="button button--wine" type="button" data-browse-from-cart>Explore the collection ${icon('arrow')}</button></div>`;
        if (focus) $('[data-browse-from-cart]', refs.cartItems).focus();
        return;
      }
      refs.cartItems.innerHTML = state.cart.map(row => {
        const product = productMap.get(row.id);
        const key = escapeHTML(rowKey(row));
        return `<article class="cart-item" data-cart-key="${key}">
          <img src="${escapeHTML(product.image)}" alt="${escapeHTML(product.name)} packaging concept" width="76" height="97"/>
          <div><div class="cart-item__title"><h3>${escapeHTML(product.name)}</h3><button class="cart-remove" type="button" data-remove="${key}" aria-label="Remove ${escapeHTML(product.name)} ${escapeHTML(row.size)}">Remove</button></div>
          <p class="cart-item__size">${escapeHTML(row.size)} · ${formatPrice(variantFor(row.id, row.size).price)} each</p>
          <div class="cart-item__bottom"><div class="quantity-control" role="group" aria-label="Quantity for ${escapeHTML(product.name)} ${escapeHTML(row.size)}">
          <button type="button" data-quantity="${key}" data-step="-1" aria-label="Decrease quantity of ${escapeHTML(product.name)}" ${row.quantity <= 1 ? 'disabled' : ''}>${icon('minus')}</button>
          <span aria-live="polite" aria-atomic="true">${row.quantity}</span>
          <button type="button" data-quantity="${key}" data-step="1" aria-label="Increase quantity of ${escapeHTML(product.name)}" ${row.quantity >= MAX_QUANTITY ? 'disabled' : ''}>${icon('plus')}</button>
          </div><strong>${formatPrice(variantFor(row.id, row.size).price * row.quantity)}</strong></div></div></article>`;
      }).join('');
      // Preserve keyboard focus after replacing the quantity row DOM.
      if (focus && refs.cart.open) {
        const item = $$('[data-cart-key]', refs.cartItems).find(element => element.dataset.cartKey === focus.key);
        const control = item && (focus.step
          ? $$('[data-step]', item).find(button => button.dataset.step === focus.step && !button.disabled)
          : $('[data-remove]', item));
        (control || (item && $('[data-remove]', item)) || $('[data-close-dialog]', refs.cart)).focus({ preventScroll: true });
      }
    }
    function showAddedFeedback(button) {
      if (!button) return;
      clearTimeout(feedbackTimers.get(button));
      button.classList.add('is-added');
      button.innerHTML = `${icon('check')}<span>Added</span>`;
      feedbackTimers.set(button, window.setTimeout(() => {
        button.classList.remove('is-added');
        button.innerHTML = `${icon('bag')}<span>Add to bag</span>`;
      }, 1300));
    }
    function addToCart(id, button) {
      const product = productMap.get(id);
      if (!product) return;
      const size = selectedSizes.get(id);
      const existing = state.cart.find(row => row.id === id && row.size === size);
      if (existing?.quantity >= MAX_QUANTITY) {
        announce('This demo allows up to 99 of each size.');
        return;
      }
      if (existing) existing.quantity++;
      else state.cart.push({ id, size, quantity: 1 });
      persistCart();
      renderCart();
      showAddedFeedback(button);
      if (refs.quickview.open) openDialog(refs.cart, $('[data-open-cart]'));
      else announce(`${product.name} · ${size} added to your bag.`);
      if (isMotionAllowed() && window.gsap) {
        window.gsap.fromTo('#cartCount', { scale: 1.3 }, { scale: 1, duration: .45, ease: 'back.out(2)', clearProps: 'transform' });
      }
    }
    function changeQuantity(key, step) {
      const row = state.cart.find(item => rowKey(item) === key);
      if (!row || ![-1, 1].includes(step)) return;
      row.quantity = Math.min(MAX_QUANTITY, Math.max(1, row.quantity + step));
      persistCart();
      renderCart({ key, step: String(step) });
    }
    function removeFromCart(key) {
      state.cart = state.cart.filter(row => rowKey(row) !== key);
      persistCart();
      renderCart({ key });
    }
    $('#previewOrder').addEventListener('click', () => {
      const summary = cartSummary();
      const message = $('#orderPreview');
      message.textContent = `Order preview: ${summary.count} item${summary.count === 1 ? '' : 's'}, ${formatPrice(summary.total)}. No order has been placed. Connect checkout, shipping, and payments before launching.`;
      message.hidden = false;
    });

    /* ---------------------- Search and product quick view -------------- */
    function renderSearch() {
      const query = normalize($('#searchInput').value);
      const matches = products.filter(product => normalize(`${product.name} ${product.subtitle} ${product.description}`).includes(query));
      $('#searchStatus').textContent = query ? `${matches.length} matching essential${matches.length === 1 ? '' : 's'}` : 'Explore all seven everyday essentials';
      const results = $('#searchResults');
      if (!matches.length) {
        results.innerHTML = '<p class="form-note">Nothing here just yet. Try “rose”, “oil”, “wash”, or “lip”.</p>';
        return;
      }
      results.innerHTML = matches.map(product => `<button class="search-result" type="button" data-quickview="${escapeHTML(product.id)}"><img src="${escapeHTML(product.image)}" alt="" width="53" height="61"/><span><strong>${escapeHTML(product.name)}</strong><small>${escapeHTML(product.subtitle)} · from ${formatPrice(product.variants[0].price)}</small></span>${icon('diagonal')}</button>`).join('');
    }
    $('#searchInput').addEventListener('input', renderSearch);
    function openQuickview(id, trigger) {
      const product = productMap.get(id);
      if (!product) return;
      state.quickviewId = id;
      $('#quickviewContent').innerHTML = `<div class="quickview-grid"><img class="quickview-image" src="${escapeHTML(product.image)}" alt="${escapeHTML(product.name)} illustrative packaging" width="800" height="840"/><div class="quickview-copy"><p class="eyebrow">${escapeHTML(product.badge.toUpperCase())}</p><h2 id="quickviewTitle">${escapeHTML(product.name)}</h2><p>${escapeHTML(product.description)}</p><div class="size-options" role="group" aria-label="Choose a size">${product.variants.map(variant => `<button class="size-chip ${selectedSizes.get(id) === variant.size ? 'is-selected' : ''}" type="button" data-q-size="${escapeHTML(variant.size)}" aria-pressed="${selectedSizes.get(id) === variant.size}">${escapeHTML(variant.size)}</button>`).join('')}</div><p class="quickview-price" aria-live="polite">${formatPrice(variantFor(id).price)}</p><button class="button button--wine" type="button" data-add="${escapeHTML(id)}">${icon('bag')}<span>Add to bag</span></button><p class="quickview-note">Packaging, sizes, and alternate-size prices are illustrative. Add final ingredient and use information before launch. This preview cannot accept orders.</p></div></div>`;
      openDialog(refs.quickview, trigger);
    }

    /* -------------------------- Ritual tabs ---------------------------- */
    const rituals = [
      { product: 'cleansing-wash', eyebrow: 'A FRESH START', description: 'A little water. A moment to slow down. Begin with a fresh, simple first step.' },
      { product: 'radiance-oil', eyebrow: 'A GOLDEN MOMENT', description: 'Make a little space for your daily ritual. A few golden drops, and a moment that is all yours.' },
      { product: 'clay-mask', eyebrow: 'THE SLOW-DOWN STEP', description: 'Set aside a quiet moment for your rose-and-clay ritual. Follow the final product label for use.' }
    ];
    const ritualTabs = $$('[data-ritual]');
    function activateRitual(index, focus = false) {
      const ritual = rituals[index];
      if (!ritual) return;
      const product = productMap.get(ritual.product);
      ritualTabs.forEach((tab, i) => {
        tab.setAttribute('aria-selected', String(i === index));
        tab.tabIndex = i === index ? 0 : -1;
        tab.classList.toggle('is-active', i === index);
      });
      $('#ritualPanel').setAttribute('aria-labelledby', ritualTabs[index].id);
      $('#ritualImage').src = product.image;
      $('#ritualImage').alt = `${product.name} packaging concept`;
      $('#ritualNumber').textContent = String(index + 1).padStart(2, '0');
      $('#ritualEyebrow').textContent = ritual.eyebrow;
      $('#ritualProductName').textContent = product.name;
      $('#ritualDescription').textContent = ritual.description;
      $('#ritualView').dataset.quickview = product.id;
      $('#ritualView').setAttribute('aria-label', `View ${product.name}`);
      if (focus) ritualTabs[index].focus();
      if (isMotionAllowed() && window.gsap) window.gsap.fromTo('#ritualImage', { opacity: .45, scale: 1.02 }, { opacity: 1, scale: 1, duration: .5, clearProps: 'transform,opacity', overwrite: true });
    }
    $('.ritual-tabs').addEventListener('keydown', event => {
      const current = ritualTabs.indexOf(event.target);
      if (current < 0) return;
      let next;
      if (event.key === 'ArrowRight' || event.key === 'ArrowDown') next = (current + 1) % ritualTabs.length;
      if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') next = (current + ritualTabs.length - 1) % ritualTabs.length;
      if (event.key === 'Home') next = 0;
      if (event.key === 'End') next = ritualTabs.length - 1;
      if (next !== undefined) { event.preventDefault(); activateRitual(next, true); }
    });

    /* -------------------- Mouse drag + native touch reviews ------------ */
    let drag = null;
    refs.reviews.addEventListener('pointerdown', event => {
      if (event.pointerType !== 'mouse' || event.button !== 0) return;
      drag = { x: event.clientX, scroll: refs.reviews.scrollLeft, pointer: event.pointerId, moved: false };
      refs.reviews.setPointerCapture(event.pointerId);
    });
    refs.reviews.addEventListener('pointermove', event => {
      if (!drag) return;
      const delta = event.clientX - drag.x;
      if (Math.abs(delta) > 5) { drag.moved = true; refs.reviews.classList.add('is-dragging'); }
      if (drag.moved) { event.preventDefault(); refs.reviews.scrollLeft = drag.scroll - delta; }
    });
    function endDrag() {
      if (drag && refs.reviews.hasPointerCapture(drag.pointer)) refs.reviews.releasePointerCapture(drag.pointer);
      drag = null;
      refs.reviews.classList.remove('is-dragging');
    }
    refs.reviews.addEventListener('pointerup', endDrag);
    refs.reviews.addEventListener('pointercancel', endDrag);
    refs.reviews.addEventListener('lostpointercapture', endDrag);
    refs.reviews.addEventListener('keydown', event => {
      if (!['ArrowLeft', 'ArrowRight'].includes(event.key)) return;
      event.preventDefault();
      refs.reviews.scrollBy({ left: (event.key === 'ArrowRight' ? 1 : -1) * refs.reviews.clientWidth * .8, behavior: isMotionAllowed() ? 'smooth' : 'auto' });
    });
    function updateReviewProgress() {
      const track = refs.reviews;
      const thumb = $('#reviewProgress');
      const overflow = track.scrollWidth - track.clientWidth;
      const fraction = Math.min(1, track.clientWidth / Math.max(track.scrollWidth, 1));
      const width = thumb.parentElement.clientWidth;
      thumb.style.width = `${fraction * 100}%`;
      thumb.style.transform = `translateX(${overflow > 0 ? (width * (1 - fraction) * track.scrollLeft / overflow) : 0}px)`;
    }
    refs.reviews.addEventListener('scroll', updateReviewProgress, { passive: true });
    if ('ResizeObserver' in window) new ResizeObserver(updateReviewProgress).observe(refs.reviews);
    else window.addEventListener('resize', updateReviewProgress, { passive: true });

    /* -------------------------- Other controls ------------------------- */
    $('#newsletterForm').addEventListener('submit', event => {
      event.preventDefault();
      if (!event.currentTarget.reportValidity()) return;
      $('#newsletterStatus').textContent = 'Preview checked. No subscription was created and no email was saved or sent. Connect your email service before launch.';
    });
    const updateHeader = () => refs.header.classList.toggle('is-scrolled', window.scrollY > 36);
    updateHeader();
    window.addEventListener('scroll', updateHeader, { passive: true });
    $('#copyrightYear').textContent = new Date().getFullYear();

    // Delegate dynamic controls as well as the static card buttons.
    document.addEventListener('click', event => {
      const button = event.target.closest('button');
      if (!button || button.disabled) return;
      if (button.hasAttribute('data-close-dialog')) return closeDialog(button.closest('dialog'));
      if (button.id === 'menuToggle') return openDialog(refs.menu, button);
      if (button.hasAttribute('data-open-search')) { renderSearch(); return openDialog(refs.search, button); }
      if (button.hasAttribute('data-open-cart')) { renderCart(); return openDialog(refs.cart, button); }
      if (button.id === 'showSaved') return setFilter('saved', true);
      if (button.dataset.filter) return setFilter(button.dataset.filter);
      if (button.hasAttribute('data-reset-filter')) return setFilter('all');
      if (button.dataset.favorite) return toggleFavorite(button.dataset.favorite);
      if (button.dataset.quickview) return openQuickview(button.dataset.quickview, button);
      if (button.dataset.add) return addToCart(button.dataset.add, button);
      if (button.dataset.size) return updateSize(button.closest('[data-product]').dataset.product, button.dataset.size);
      if (button.dataset.qSize) return updateSize(state.quickviewId, button.dataset.qSize);
      if (button.dataset.quantity) return changeQuantity(button.dataset.quantity, Number(button.dataset.step));
      if (button.dataset.remove) return removeFromCart(button.dataset.remove);
      if (button.hasAttribute('data-ritual')) return activateRitual(Number(button.dataset.ritual));
      if (button.hasAttribute('data-browse-from-cart')) { closeDialog(refs.cart); setFilter('all', true); }
    });

    /* --------------------- Progressive GSAP motion --------------------- */
    function setupGsap() {
      if (!window.gsap || !window.ScrollTrigger) return;
      if (gsapMedia) { gsapMedia.revert(); gsapMedia = null; }
      window.gsap.registerPlugin(window.ScrollTrigger);
      animationLibrariesReady = true;
      root.dataset.gsap = 'ready';
      if (!isMotionAllowed()) {
        const targets = $$('[data-hero], [data-hero-art], [data-reveal], .hero-art__image > img, #cartCount, #ritualImage');
        window.gsap.killTweensOf(targets);
        window.gsap.set(targets, { clearProps: 'transform,opacity' });
        return;
      }
      const gsap = window.gsap;
      gsapMedia = gsap.matchMedia();
      gsapMedia.add('(prefers-reduced-motion: no-preference)', () => {
        if (state.motionPaused) return;
        if (!hasPlayedHero) {
          hasPlayedHero = true;
          gsap.timeline({ defaults: { ease: 'power3.out', clearProps: 'transform,opacity' } })
            .fromTo('[data-hero]', { y: 24, opacity: .65 }, { y: 0, opacity: 1, stagger: .10, duration: .9 }, 0)
            .fromTo('[data-hero-art]', { y: 22, opacity: .7 }, { y: 0, opacity: 1, duration: 1.2 }, .1);
        }
        $$('[data-reveal]:not(.product-card)').forEach(element => {
          if (element.getBoundingClientRect().top < window.innerHeight * .87) return;
          // Start only when the element enters; nothing is pre-hidden off-screen.
          window.ScrollTrigger.create({
            trigger: element, start: 'top 90%', once: true,
            onEnter: () => gsap.fromTo(element, { y: 22, opacity: .5 }, { y: 0, opacity: 1, duration: .85, ease: 'power3.out', clearProps: 'transform,opacity' })
          });
        });
        window.ScrollTrigger.create({
          trigger: refs.grid, start: 'top 89%', once: true,
          onEnter: () => gsap.fromTo(cards.filter(card => !card.hidden), { y: 22, opacity: .55 }, { y: 0, opacity: 1, duration: .75, stagger: .065, ease: 'power3.out', clearProps: 'transform,opacity' })
        });
      });
      gsapMedia.add('(min-width: 901px) and (prefers-reduced-motion: no-preference)', () => {
        if (state.motionPaused) return;
        gsap.to('.hero-art__image > img', { yPercent: 7, scale: 1.08, ease: 'none', scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: .8 } });
      });
      window.ScrollTrigger.refresh();
    }
    function refreshMotionUI() {
      const paused = reduceMotion.matches || state.motionPaused;
      root.classList.toggle('motion-paused', paused);
      const button = $('#motionToggle');
      button.setAttribute('aria-pressed', String(paused));
      button.disabled = reduceMotion.matches;
      button.innerHTML = `${icon(paused ? 'play' : 'pause')}<span>${reduceMotion.matches ? 'Reduced motion' : state.motionPaused ? 'Resume motion' : 'Pause motion'}</span>`;
      if (animationLibrariesReady) setupGsap();
    }
    $('#motionToggle').addEventListener('click', () => {
      state.motionPaused = !state.motionPaused;
      storage.write(STORAGE.motion, state.motionPaused);
      refreshMotionUI();
    });
    reduceMotion.addEventListener('change', refreshMotionUI);
    $$('[data-animation-lib]').forEach(script => script.addEventListener('load', () => {
      if (!animationLibrariesReady && window.gsap && window.ScrollTrigger) setupGsap();
    }));
    // Mark a clean, supported fallback when external scripts cannot load.
    root.dataset.gsap = 'optional-loading';
    window.setTimeout(() => {
      if (!animationLibrariesReady) root.dataset.gsap = 'fallback';
    }, 6000);

    /* ------------------------ Initialize safely ------------------------ */
    $$('button[disabled], select[disabled]').forEach(control => { control.disabled = false; });
    renderFavorites();
    renderCatalog();
    renderCart();
    renderSearch();
    updateReviewProgress();
    refreshMotionUI();
    setupGsap();
    root.dataset.storeReady = 'true';
    $$('img').forEach(image => {
      if (!image.complete) image.addEventListener('load', () => window.ScrollTrigger?.refresh(), { once: true });
    });
    document.fonts?.ready.then(() => window.ScrollTrigger?.refresh());

    // Reconcile changes made in a second tab without trusting external storage.
    window.addEventListener('storage', event => {
      if (event.key === STORAGE.cart) { state.cart = validateCart(storage.read(STORAGE.cart, [])); renderCart(); }
      if (event.key === STORAGE.saved) {
        const saved = storage.read(STORAGE.saved, []);
        state.saved = new Set(Array.isArray(saved) ? saved.filter(id => productMap.has(id)) : []);
        renderFavorites();
        if (state.filter === 'saved') renderCatalog();
      }
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})();
