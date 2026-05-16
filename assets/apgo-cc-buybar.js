/* APGO · Car Care PDP — Mobile Sticky Buy Bar
 *
 * B1: collapsed CTA bar + add-to-cart + checkout (price mirrored from PDP card)
 * B2 (this revision): expandable mini-cart sheet
 *   - Tap handle / chip → toggle open
 *   - Tap backdrop / 下拉收起 / Esc → close
 *   - Vertical drag on handle: swipe up → open, swipe down → close
 *   - Fetch /cart.js on boot + after every add + on cart:updated event;
 *     render line items (thumb, name, qty, price), chip count + subtotal
 *
 * Loaded only on template.suffix == 'apgo-v2' via layout/theme.liquid.
 */
(function () {
  'use strict';

  var bar = document.querySelector('[data-apgo-cc-buybar]');
  if (!bar) return;

  var form = document.querySelector('.apgo-cc-pdp__form');
  if (!form) return;

  // ---------- Element refs ----------
  // Some elements appear twice (bar + sheet head) — collect them via
  // querySelectorAll and update each in render code.
  var backdrop     = bar.querySelector('[data-apgo-cc-buybar-backdrop]');
  var sheet        = bar.querySelector('[data-apgo-cc-buybar-sheet]');
  var handle       = bar.querySelector('[data-apgo-cc-buybar-handle]');
  var closeBtn     = bar.querySelector('[data-apgo-cc-buybar-close]');
  var chipEls      = bar.querySelectorAll('[data-apgo-cc-buybar-chip]');
  var countEls     = bar.querySelectorAll('[data-apgo-cc-buybar-count]');
  var chipTotalEls = bar.querySelectorAll('[data-apgo-cc-buybar-chip-total]');
  var itemsEl      = bar.querySelector('[data-apgo-cc-buybar-items]');
  var emptyEl      = bar.querySelector('[data-apgo-cc-buybar-empty]');
  var subtotalEl   = bar.querySelector('[data-apgo-cc-buybar-subtotal]');
  var addBtn       = bar.querySelector('[data-apgo-cc-buybar-add]');
  var checkoutBtn  = bar.querySelector('[data-apgo-cc-buybar-checkout]');

  // ---------- Money formatter (TWD, no decimals) ----------
  // /cart.js returns prices in cents (multiplied by 100 for currencies that
  // support sub-units; TWD has none but Shopify still doubles to cents).
  function formatMoney(cents) {
    if (window.Shopify && typeof window.Shopify.formatMoney === 'function') {
      var fmt = (window.theme && window.theme.moneyFormat) || 'NT${{amount}}';
      try { return window.Shopify.formatMoney(cents, fmt); } catch (e) {}
    }
    var n = Number(cents) / 100;
    return 'NT$ ' + n.toLocaleString('zh-TW', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
  }

  // ---------- Toast (reuse .apgo-cc-toast already styled in apgo-carcare.css) ----------
  var toastEl = null;
  function showToast(msg, ok) {
    if (!toastEl) {
      toastEl = document.createElement('div');
      toastEl.className = 'apgo-cc-toast';
      document.body.appendChild(toastEl);
    }
    toastEl.textContent = msg;
    toastEl.classList.toggle('apgo-cc-toast--err', ok === false);
    toastEl.classList.add('is-visible');
    clearTimeout(toastEl._t);
    toastEl._t = setTimeout(function () {
      toastEl.classList.remove('is-visible');
    }, 2200);
  }

  // ---------- Open / close sheet ----------
  function open() {
    bar.classList.add('is-open');
    if (sheet) sheet.setAttribute('aria-hidden', 'false');
    if (backdrop) backdrop.setAttribute('aria-hidden', 'false');
    // Lock body scroll so user can scroll inside the sheet without
    // accidentally scrolling the page underneath.
    document.documentElement.style.overflow = 'hidden';
  }
  function close() {
    bar.classList.remove('is-open');
    if (sheet) sheet.setAttribute('aria-hidden', 'true');
    if (backdrop) backdrop.setAttribute('aria-hidden', 'true');
    document.documentElement.style.overflow = '';
  }
  function toggle() {
    if (bar.classList.contains('is-open')) close();
    else open();
  }

  if (handle)   handle.addEventListener('click', toggle);
  Array.prototype.forEach.call(chipEls, function (c) {
    c.addEventListener('click', function (e) {
      // chip inside the bar's top row is already inside `handle` so its
      // click bubbles → handle's listener fires. The sheet head's chip
      // needs its own toggle. Use stopPropagation on the bar chip to
      // avoid double-toggling.
      if (handle && handle.contains(c)) { e.stopPropagation(); }
      toggle();
    });
  });
  if (closeBtn) closeBtn.addEventListener('click', close);
  if (backdrop) backdrop.addEventListener('click', close);
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && bar.classList.contains('is-open')) close();
  });

  // ---------- Touch drag on handle / sheet head ----------
  // Lightweight gesture: track vertical delta from touchstart.
  //   swipe up ≥ 40px when closed → open
  //   swipe down ≥ 60px when open → close
  // Anything smaller is treated as a tap and falls through to click handlers.
  (function wireDrag() {
    if (!handle) return;
    var startY = 0;
    var moved = false;

    function onStart(e) {
      var t = e.touches ? e.touches[0] : e;
      startY = t.clientY;
      moved = false;
    }
    function onMove(e) {
      var t = e.touches ? e.touches[0] : e;
      var dy = t.clientY - startY;
      if (Math.abs(dy) > 10) moved = true;
    }
    function onEnd(e) {
      if (!moved) return;
      var t = (e.changedTouches && e.changedTouches[0]) || e;
      var dy = t.clientY - startY;
      if (dy <= -40 && !bar.classList.contains('is-open')) open();
      else if (dy >=  60 &&  bar.classList.contains('is-open')) close();
    }

    handle.addEventListener('touchstart', onStart, { passive: true });
    handle.addEventListener('touchmove',  onMove,  { passive: true });
    handle.addEventListener('touchend',   onEnd);

    // Also wire drag on sheet head so user can pull down from there
    var sheetHead = bar.querySelector('.apgo-cc-buybar__sheet-head');
    if (sheetHead) {
      sheetHead.addEventListener('touchstart', onStart, { passive: true });
      sheetHead.addEventListener('touchmove',  onMove,  { passive: true });
      sheetHead.addEventListener('touchend',   onEnd);
    }
  })();

  // ---------- Cart fetch + render ----------
  function fetchCart() {
    return fetch('/cart.js?_=' + Date.now(), {
      cache: 'no-store',
      headers: { 'Accept': 'application/json' }
    }).then(function (r) { return r.json(); });
  }

  function renderCart(cart) {
    if (!cart) return;
    var count = cart.item_count || 0;
    var total = cart.total_price || 0;
    var subtotal = cart.items_subtotal_price != null ? cart.items_subtotal_price : total;

    Array.prototype.forEach.call(countEls,     function (el) { el.textContent = count; });
    Array.prototype.forEach.call(chipTotalEls, function (el) { el.textContent = formatMoney(total); });
    if (subtotalEl) subtotalEl.textContent = formatMoney(subtotal);

    // Toggle empty state
    if (!cart.items || cart.items.length === 0) {
      if (emptyEl) emptyEl.style.display = '';
      // Remove any previously-rendered rows (everything except the empty <p>)
      Array.prototype.slice.call(itemsEl.children).forEach(function (c) {
        if (c !== emptyEl) c.remove();
      });
      return;
    }
    if (emptyEl) emptyEl.style.display = 'none';

    // Re-render from scratch (cart is small; diffing not worth the complexity)
    Array.prototype.slice.call(itemsEl.children).forEach(function (c) {
      if (c !== emptyEl) c.remove();
    });

    cart.items.forEach(function (item) {
      var row = document.createElement('div');
      row.className = 'apgo-cc-buybar__item';

      // Thumbnail (Shopify image URLs accept a size suffix like _80x.jpg
      // to keep payload small; .image is already sized but we hint anyway)
      var thumb = document.createElement('div');
      thumb.className = 'apgo-cc-buybar__item-thumb';
      if (item.image) {
        var img = document.createElement('img');
        img.src = item.image.replace(/(\.[a-z]+)(\?|$)/i, '_80x$1$2');
        img.alt = item.product_title || '';
        img.loading = 'lazy';
        thumb.appendChild(img);
      }
      row.appendChild(thumb);

      var info = document.createElement('div');
      info.className = 'apgo-cc-buybar__item-info';
      var name = document.createElement('div');
      name.className = 'apgo-cc-buybar__item-name';
      // Build readable name: title + variant (skip "Default Title")
      var title = item.product_title || item.title || '';
      if (item.variant_title && item.variant_title !== 'Default Title') {
        title += ' ' + item.variant_title;
      }
      name.textContent = title;
      var qty = document.createElement('div');
      qty.className = 'apgo-cc-buybar__item-qty';
      qty.textContent = '×' + item.quantity;
      info.appendChild(name);
      info.appendChild(qty);
      row.appendChild(info);

      var price = document.createElement('div');
      price.className = 'apgo-cc-buybar__item-price';
      // line_price already accounts for quantity and any line-item discounts
      price.textContent = formatMoney(item.final_line_price != null ? item.final_line_price : item.line_price);
      row.appendChild(price);

      itemsEl.appendChild(row);
    });
  }

  function refreshCart() {
    fetchCart().then(renderCart).catch(function (err) {
      console.warn('[apgo-cc-buybar] cart fetch failed:', err);
    });
  }

  // Initial cart load
  refreshCart();

  // Sync when other code updates the cart
  document.addEventListener('cart:updated', refreshCart);
  document.addEventListener('cart:update', function (e) {
    if (e && e.detail && e.detail.cart) renderCart(e.detail.cart);
    else refreshCart();
  });

  // ---------- Add to cart ----------
  if (addBtn) {
    addBtn.addEventListener('click', function () {
      if (addBtn.disabled) return;
      var fd = new FormData(form);

      var orig = addBtn.textContent;
      addBtn.disabled = true;
      addBtn.textContent = '加入中…';

      fetch('/cart/add.js', {
        method: 'POST',
        headers: { 'Accept': 'application/json' },
        body: fd
      })
        .then(function (r) {
          return r.json().then(function (data) {
            if (!r.ok) return Promise.reject(data);
            return data;
          });
        })
        .then(function () { return fetchCart(); })
        .then(function (cart) {
          renderCart(cart);

          document.dispatchEvent(new CustomEvent('cart:update', { detail: { cart: cart } }));
          document.documentElement.dispatchEvent(new CustomEvent('cart:refresh', { bubbles: true, detail: { cart: cart } }));
          document.dispatchEvent(new CustomEvent('cart:updated'));

          try {
            import('@theme/events').then(function (mod) {
              if (mod && mod.CartUpdateEvent) {
                document.dispatchEvent(new mod.CartUpdateEvent(cart, 'apgo-cc-buybar', {
                  itemCount: cart.item_count, source: 'apgo-cc-buybar', sections: {}
                }));
              }
              if (mod && mod.CartAddEvent) {
                document.dispatchEvent(new mod.CartAddEvent({}, 'apgo-cc-buybar', { source: 'apgo-cc-buybar' }));
              }
            }).catch(function () {});
          } catch (_) {}

          showToast('✓ 已加入購物車');
          addBtn.disabled = false;
          addBtn.textContent = orig;

          // Nudge: auto-open the sheet so user sees the new item land in cart
          if (!bar.classList.contains('is-open')) open();
        })
        .catch(function (err) {
          console.error('[apgo-cc-buybar] add failed:', err);
          var msg = (err && err.description) || (err && err.message) || '加入失敗，請稍後再試';
          showToast(msg, false);
          addBtn.disabled = false;
          addBtn.textContent = orig;
        });
    });
  }

  // ---------- 立即購買 → go to /cart so user can verify their cart
  // (with any auto-discounts applied) before committing to checkout. ----------
  if (checkoutBtn) {
    checkoutBtn.addEventListener('click', function () {
      window.location.href = '/cart';
    });
  }
})();
