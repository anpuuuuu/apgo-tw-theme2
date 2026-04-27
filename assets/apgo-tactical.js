/* APGO · Collection page tactical interactions
 *
 * Scope: only loaded on collection templates (see layout/theme.liquid).
 * Handles:
 *   - Floating cart bar live total updates (listens to Shopify cart events)
 *   - Command Center bottom-sheet open/close
 *   - Haptic vibration feedback on tap (mobile only)
 *
 * Phase 3 + 4 of docs/COLLECTION_TACTICAL_PLAN.md
 */
(function () {
  'use strict';

  function $(sel, ctx) { return (ctx || document).querySelector(sel); }
  function $$(sel, ctx) { return Array.prototype.slice.call((ctx || document).querySelectorAll(sel)); }

  function vibrate(ms) {
    if (navigator.vibrate) {
      try { navigator.vibrate(ms || 15); } catch (e) {}
    }
  }

  // ----------------- Money formatting -----------------
  function formatMoney(cents) {
    if (window.Shopify && typeof window.Shopify.formatMoney === 'function') {
      var fmt = (window.theme && window.theme.moneyFormat) || 'NT${{amount}}';
      try { return window.Shopify.formatMoney(cents, fmt); } catch (e) {}
    }
    var n = Number(cents) / 100;
    return 'NT$ ' + n.toLocaleString('zh-TW', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
  }

  // ----------------- Floating cart bar -----------------
  function initCartBar() {
    var bar = $('[data-apgo-tac-cart-bar]');
    if (!bar) return;

    var totalEl = $('[data-apgo-tac-cart-total]', bar);
    var countEl = $('[data-apgo-tac-cart-count]', bar);
    var checkoutBtn = $('[data-apgo-tac-checkout]', bar);

    function applyState(cart) {
      if (!cart) return;
      if (totalEl) totalEl.textContent = formatMoney(cart.total_price || 0);
      if (countEl) countEl.textContent = cart.item_count || 0;
      // Hide bar entirely when cart is empty (cleaner than showing CRD: 0)
      if (cart.item_count === 0) bar.classList.add('apgo-tac-cart-bar--empty');
      else bar.classList.remove('apgo-tac-cart-bar--empty');
    }

    // Pull current state from Shopify
    function fetchCart() {
      fetch('/cart.js', { headers: { 'Accept': 'application/json' } })
        .then(function (r) { return r.json(); })
        .then(applyState)
        .catch(function () {});
    }

    if (checkoutBtn) {
      checkoutBtn.addEventListener('click', function () {
        vibrate(20);
        window.location.href = '/checkout';
      });
    }

    fetchCart();

    // Listen for cart updates from any source. Different themes/apps fire
    // different events — we cover the common ones.
    ['cart:updated', 'cart:refresh', 'cart:change', 'on:cart:add', 'cart:item-added'].forEach(function (evt) {
      document.addEventListener(evt, fetchCart);
    });

    // Catch fetch-based AJAX cart writes by intercepting fetch — narrow filter
    // so we don't refetch on every API call.
    var origFetch = window.fetch;
    if (typeof origFetch === 'function') {
      window.fetch = function () {
        var url = arguments[0];
        var promise = origFetch.apply(this, arguments);
        try {
          var u = typeof url === 'string' ? url : (url && url.url) || '';
          if (/\/cart\/(add|change|update|clear)/i.test(u)) {
            promise.then(function () { setTimeout(fetchCart, 80); });
          }
        } catch (e) {}
        return promise;
      };
    }
  }

  // ----------------- Bottom-sheet (Command Center) -----------------
  function initBottomSheet() {
    var sheet = $('[data-apgo-tac-sheet]');
    if (!sheet) return;
    var trigger = $('[data-apgo-tac-sheet-trigger]');
    var overlay = $('[data-apgo-tac-sheet-overlay]');
    var closers = $$('[data-apgo-tac-sheet-close]');

    function open() {
      vibrate(15);
      sheet.classList.add('is-open');
      if (overlay) overlay.classList.add('is-open');
      document.body.style.overflow = 'hidden';
    }
    function close() {
      vibrate(10);
      sheet.classList.remove('is-open');
      if (overlay) overlay.classList.remove('is-open');
      document.body.style.overflow = '';
    }

    if (trigger) trigger.addEventListener('click', open);
    if (overlay) overlay.addEventListener('click', close);
    closers.forEach(function (b) { b.addEventListener('click', close); });

    // Esc closes
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && sheet.classList.contains('is-open')) close();
    });
  }

  function boot() {
    initCartBar();
    initBottomSheet();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }

  // Re-init on Shopify section editor events so previewing changes works
  if (window.Shopify && Shopify.designMode) {
    document.addEventListener('shopify:section:load', boot);
    document.addEventListener('shopify:section:select', boot);
  }
})();
