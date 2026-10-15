/* APGO · 你可能也需要 — opens the panel rendered by sections/apgo-maybe-need.liquid
 * after a successful add to cart on a product page.
 *
 *   window.ApgoMaybeNeed.open(cart) → true when the panel opened; false when
 *   the caller should show its usual "✓ 已加入購物車" toast instead: no panel
 *   on this page, already shown for this product in this browsing session, or
 *   fewer than data-min products left after removing what is in the cart.
 *
 * Callers: apgo-pdp.js, apgo-cc-pdp.js, apgo-cc-buybar.js — each passes the
 * cart it just fetched after /cart/add.js.
 *
 * Products added from the panel carry hidden line item properties
 * (_rec = maybe-need, _rec_from = the product page's handle), so orders show
 * what the panel sold. Views, clicks and adds are also pushed to dataLayer and
 * Shopify customer events as apgo_rec_view / apgo_rec_click / apgo_rec_add.
 */
(function () {
  'use strict';

  var root = document.querySelector('[data-apgo-maybe-need]');
  var api = { open: function () { return false; } };
  window.ApgoMaybeNeed = api;
  if (!root) return;

  var sheet = root.querySelector('.apgo-mn__sheet');
  var cards = Array.prototype.slice.call(root.querySelectorAll('[data-mn-card]'));
  var sourceHandle = root.getAttribute('data-product-handle');
  var max = parseInt(root.getAttribute('data-max'), 10) || 4;
  var min = parseInt(root.getAttribute('data-min'), 10) || 2;
  var storageKey = 'apgoMN:' + root.getAttribute('data-product-id');
  var routesRoot = (window.Shopify && window.Shopify.routes && window.Shopify.routes.root) || '/';
  var lastFocus = null;

  function track(name, data) {
    var payload = Object.assign({ source: sourceHandle }, data || {});
    try {
      (window.dataLayer = window.dataLayer || []).push(Object.assign({ event: name }, payload));
    } catch (e) { /* analytics must never break the panel */ }
    try {
      if (window.Shopify && window.Shopify.analytics && typeof window.Shopify.analytics.publish === 'function') {
        window.Shopify.analytics.publish(name, payload);
      }
    } catch (e) { /* ditto */ }
  }

  // Show up to `max` cards whose product — or a product of the same
  // 同款不同容量 group (data-family) — is not in the cart. Returns those shown.
  function pickCards(cart) {
    var inCart = {};
    ((cart && cart.items) || []).forEach(function (item) { inCart[item.product_id] = true; });
    var shown = [];
    cards.forEach(function (card) {
      var ids = [card.getAttribute('data-product-id')].concat(
        (card.getAttribute('data-family') || '').split(',').filter(Boolean)
      );
      var taken = ids.some(function (id) { return inCart[id]; });
      var hide = taken || shown.length >= max;
      card.hidden = hide;
      if (!hide) shown.push(card);
    });
    return shown;
  }

  // The car-care product pages are dark, the laundry ones cream: match
  // whichever this page is, read from its background.
  function pageIsDark() {
    var els = [document.querySelector('main'), document.body];
    for (var i = 0; i < els.length; i++) {
      if (!els[i]) continue;
      var rgba = (getComputedStyle(els[i]).backgroundColor.match(/[\d.]+/g) || []).map(Number);
      if (rgba.length < 3 || rgba[3] === 0) continue; // transparent: look further out
      return (0.299 * rgba[0] + 0.587 * rgba[1] + 0.114 * rgba[2]) / 255 < 0.4;
    }
    return false;
  }

  function open(cart) {
    try {
      if (window.sessionStorage.getItem(storageKey)) return false;
    } catch (e) { /* storage blocked: show it, just not "once only" */ }

    var shown = pickCards(cart);
    if (shown.length < min) return false;

    try { window.sessionStorage.setItem(storageKey, '1'); } catch (e) { /* see above */ }
    root.classList.toggle('apgo-mn--dark', pageIsDark());
    root.setAttribute('data-count', String(shown.length));
    lastFocus = document.activeElement;
    root.hidden = false;
    document.documentElement.classList.add('apgo-mn-open');
    // Two frames: the first paints the closed state so the slide-in animates.
    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        root.classList.add('is-open');
        sheet.focus({ preventScroll: true });
      });
    });
    track('apgo_rec_view', {
      items: shown.map(function (card) { return card.getAttribute('data-handle'); })
    });
    return true;
  }

  function close() {
    if (root.hidden) return;
    root.classList.remove('is-open');
    document.documentElement.classList.remove('apgo-mn-open');
    setTimeout(function () { root.hidden = true; }, 300);
    if (lastFocus && typeof lastFocus.focus === 'function') {
      try { lastFocus.focus({ preventScroll: true }); } catch (e) { /* element gone */ }
    }
  }

  // Same three events the product pages send, so the header count and the
  // buy bar's mini cart pick up what the panel added.
  function dispatchCartEvents(cart) {
    document.dispatchEvent(new CustomEvent('cart:update', {
      bubbles: true,
      detail: {
        resource: cart,
        sourceId: 'apgo-maybe-need',
        cart: cart,
        data: { itemCount: cart.item_count, source: 'apgo-maybe-need', sections: {} }
      }
    }));
    document.documentElement.dispatchEvent(new CustomEvent('cart:refresh', { bubbles: true, detail: { cart: cart } }));
    document.dispatchEvent(new CustomEvent('cart:updated', { detail: { cart: cart } }));
  }

  function add(btn) {
    var card = btn.closest('[data-mn-card]');
    var handle = card && card.getAttribute('data-handle');
    var label = btn.textContent;
    btn.disabled = true;
    btn.textContent = '加入中…';

    fetch(routesRoot + 'cart/add.js', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify({
        items: [{
          id: Number(btn.getAttribute('data-variant-id')),
          quantity: 1,
          properties: { _rec: 'maybe-need', _rec_from: sourceHandle }
        }]
      })
    })
      .then(function (r) {
        return r.json().then(function (json) { return r.ok ? json : Promise.reject(json); });
      })
      .then(function () {
        return fetch(routesRoot + 'cart.js?_=' + Date.now(), {
          cache: 'no-store',
          headers: { 'Accept': 'application/json' }
        }).then(function (r) { return r.json(); });
      })
      .then(function (cart) {
        dispatchCartEvents(cart);
        btn.textContent = '✓ 已加入';
        btn.classList.add('is-added');
        track('apgo_rec_add', { item: handle, variant: btn.getAttribute('data-variant-id') });
      })
      .catch(function (err) {
        console.error('[apgo-maybe-need] add failed:', err);
        btn.textContent = (err && err.description) || '加入失敗，請再試一次';
        setTimeout(function () {
          btn.disabled = false;
          btn.textContent = label;
        }, 2200);
      });
  }

  root.addEventListener('click', function (e) {
    var t = e.target;
    if (t.closest('[data-mn-close]')) {
      close();
      return;
    }
    var addBtn = t.closest('[data-mn-add]');
    if (addBtn) {
      if (!addBtn.disabled && !addBtn.classList.contains('is-added')) add(addBtn);
      return;
    }
    var link = t.closest('[data-mn-link]');
    if (link) {
      var card = link.closest('[data-mn-card]');
      track('apgo_rec_click', { item: card && card.getAttribute('data-handle') });
      return;
    }
    if (t.closest('[data-mn-cart]')) track('apgo_rec_to_cart', {});
  });

  // Esc closes; Tab stays inside the dialog while it is open.
  document.addEventListener('keydown', function (e) {
    if (root.hidden) return;
    if (e.key === 'Escape') {
      close();
      return;
    }
    if (e.key !== 'Tab') return;
    var focusable = Array.prototype.filter.call(
      sheet.querySelectorAll('a[href], button:not([disabled])'),
      function (el) { return el.offsetParent !== null; }
    );
    if (!focusable.length) return;
    var first = focusable[0];
    var last = focusable[focusable.length - 1];
    if (e.shiftKey && (document.activeElement === first || document.activeElement === sheet)) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  });

  api.open = open;
  api.close = close;
})();
