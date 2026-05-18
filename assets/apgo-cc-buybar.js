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

  // Tiny query helpers — `$$` returns a real array so .forEach works
  // everywhere (NodeList.forEach has gaps in older browsers).
  function $$(sel, ctx) {
    return Array.prototype.slice.call((ctx || document).querySelectorAll(sel));
  }

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
  // ---------- Purchase modal (mobile-only) ----------
  // Three modes via data-mode attr on .apgo-cc-purchase root:
  //   'add'  → only 加入購物車 CTA visible (full width)
  //   'buy'  → only 立即購買 CTA visible (full width)
  //   'both' → both CTAs side-by-side
  // CSS uses [data-mode] to control button visibility.
  var purchaseRoot      = document.querySelector('[data-apgo-cc-purchase]');
  var purchaseModeLabel = purchaseRoot && purchaseRoot.querySelector('[data-apgo-cc-purchase-mode-label]');
  var purchaseQtyInput  = purchaseRoot && purchaseRoot.querySelector('[data-apgo-cc-purchase-qty-input]');
  var purchaseQtyBtns   = purchaseRoot ? $$('[data-apgo-cc-purchase-qty]', purchaseRoot) : [];
  var purchasePriceEl   = purchaseRoot && purchaseRoot.querySelector('[data-apgo-cc-purchase-price]');
  var purchaseImg       = purchaseRoot && purchaseRoot.querySelector('[data-apgo-cc-purchase-img]');
  var purchaseAddCta    = purchaseRoot && purchaseRoot.querySelector('[data-apgo-cc-purchase-cta="add"]');
  var purchaseBuyCta    = purchaseRoot && purchaseRoot.querySelector('[data-apgo-cc-purchase-cta="buy"]');

  function openPurchase(mode) {
    if (!purchaseRoot) return;
    var m = (mode === 'buy' || mode === 'both') ? mode : 'add';
    purchaseRoot.setAttribute('data-mode', m);
    // Hidden screen-reader label for the active intent (best effort)
    var srLabel = m === 'buy' ? '立即購買' : m === 'both' ? '購買選項' : '加入購物車';
    if (purchaseModeLabel) purchaseModeLabel.textContent = srLabel;
    // Sync modal price + image from the in-panel display (apgo-cc-pdp.js
    // keeps the in-panel ones fresh on variant change).
    var sourcePrice = document.querySelector('[data-apgo-cc-price]');
    if (sourcePrice && purchasePriceEl) purchasePriceEl.textContent = sourcePrice.textContent.trim();
    var sourceImg = document.querySelector('[data-apgo-cc-main-img]');
    if (sourceImg && purchaseImg) purchaseImg.src = sourceImg.src;
    // Sync qty value with whatever the in-panel form has
    var formQty = form.querySelector('[name="quantity"]');
    if (formQty && purchaseQtyInput) purchaseQtyInput.value = formQty.value || '1';
    purchaseRoot.setAttribute('aria-hidden', 'false');
    purchaseRoot.classList.add('is-open');
    document.documentElement.style.overflow = 'hidden';
  }
  function closePurchase() {
    if (!purchaseRoot) return;
    purchaseRoot.classList.remove('is-open');
    purchaseRoot.setAttribute('aria-hidden', 'true');
    document.documentElement.style.overflow = '';
  }

  // Buybar 加入購物車 → open modal in 'add' mode (single CTA)
  if (addBtn) {
    addBtn.addEventListener('click', function () {
      if (addBtn.disabled) return;
      openPurchase('add');
    });
  }
  // Buybar 立即購買 → open modal in 'buy' mode (single CTA)
  if (checkoutBtn) {
    checkoutBtn.addEventListener('click', function () {
      openPurchase('buy');
    });
  }

  // In-panel variant chip click → open modal in 'both' mode so user can
  // pick add OR buy. Mobile-only (matchMedia 749px); desktop in-panel
  // chips work as a normal variant switcher with no modal.
  // requestAnimationFrame defers so the radio's change event + apgo-cc-pdp.js's
  // updateUI() runs first (price + variant id refreshed before modal opens).
  var inPanelChips = $$('.apgo-cc-pdp__form .apgo-cc-pdp__chip');
  inPanelChips.forEach(function (label) {
    label.addEventListener('click', function () {
      if (!window.matchMedia('(max-width: 749px)').matches) return;
      requestAnimationFrame(function () { openPurchase('both'); });
    });
  });

  // Modal close handlers
  if (purchaseRoot) {
    $$('[data-apgo-cc-purchase-close]', purchaseRoot).forEach(function (el) {
      el.addEventListener('click', closePurchase);
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && purchaseRoot.classList.contains('is-open')) closePurchase();
    });
  }

  // Modal qty stepper — writes back to in-panel form's quantity input so
  // the FormData submission uses the right number.
  purchaseQtyBtns.forEach(function (btn) {
    btn.addEventListener('click', function () {
      if (!purchaseQtyInput) return;
      var dir = btn.getAttribute('data-apgo-cc-purchase-qty');
      var q = parseInt(purchaseQtyInput.value, 10);
      if (isNaN(q) || q < 1) q = 1;
      if (dir === 'up') q += 1;
      if (dir === 'down') q = Math.max(1, q - 1);
      purchaseQtyInput.value = q;
      // Mirror into in-panel form's hidden quantity input so /cart/add.js
      // FormData picks it up on submit
      var formQty = form.querySelector('[name="quantity"]');
      if (formQty) formQty.value = q;
    });
  });

  // Modal variant chips — when user picks a variant in the modal, find the
  // matching radio in the in-panel form, check it, and fire 'change' so
  // apgo-cc-pdp.js's updateUI() runs (updates variant id, price, chip
  // active state, etc.). Also flip the visual is-active class on the
  // modal chip wrappers so the modal's own chips show selected state.
  if (purchaseRoot) {
    $$('[data-apgo-cc-modal-option-input]', purchaseRoot).forEach(function (input) {
      input.addEventListener('change', function () {
        var optionName = input.getAttribute('data-option-name');
        var value = input.value;
        // 1. Update sibling chip active states inside this option group
        var group = input.closest('.apgo-cc-pdp__option-group');
        if (group) {
          $$('label.apgo-cc-pdp__chip', group).forEach(function (lbl) {
            var lblInput = lbl.querySelector('input[data-apgo-cc-modal-option-input]');
            lbl.classList.toggle('is-active', !!lblInput && lblInput.checked);
          });
        }
        // 2. Mirror into the in-panel form's hidden option radio so the
        //    existing variant-change handler in apgo-cc-pdp.js fires
        var realInput = form.querySelector(
          'input[data-apgo-cc-option-input][name="options[' + optionName + ']"][value="' + value + '"]'
        );
        if (realInput) {
          realInput.checked = true;
          realInput.dispatchEvent(new Event('change', { bubbles: true }));
        }
        // 3. Refresh modal price + image to match new variant
        var sourcePrice = document.querySelector('[data-apgo-cc-price]');
        if (sourcePrice && purchasePriceEl) purchasePriceEl.textContent = sourcePrice.textContent.trim();
      });
    });
  }

  // Shared AJAX add — both purchase modal CTAs use this. triggerBtn is
  // the clicked button so it can be disabled + labelled "加入中…" while
  // the request is in flight. onSuccess decides what happens after the
  // cart is updated (toast+close OR redirect /cart).
  function purchaseSubmit(triggerBtn, onSuccess) {
    if (!form || !triggerBtn) return;
    var orig = triggerBtn.textContent;
    triggerBtn.disabled = true;
    triggerBtn.textContent = '加入中…';
    var fd = new FormData(form);
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

        triggerBtn.disabled = false;
        triggerBtn.textContent = orig;
        if (typeof onSuccess === 'function') onSuccess(cart);
      })
      .catch(function (err) {
        console.error('[apgo-cc-buybar] add failed:', err);
        var msg = (err && err.description) || (err && err.message) || '加入失敗，請稍後再試';
        showToast(msg, false);
        triggerBtn.disabled = false;
        triggerBtn.textContent = orig;
      });
  }

  // Modal 加入購物車 CTA — adds + toast + closes modal + opens mini cart
  if (purchaseAddCta) {
    purchaseAddCta.addEventListener('click', function () {
      purchaseSubmit(purchaseAddCta, function () {
        showToast('✓ 已加入購物車');
        closePurchase();
        if (!bar.classList.contains('is-open')) open();
      });
    });
  }
  // Modal 立即購買 CTA — adds + redirects to /cart for shopper to verify
  if (purchaseBuyCta) {
    purchaseBuyCta.addEventListener('click', function () {
      purchaseSubmit(purchaseBuyCta, function () {
        window.location.href = '/cart';
      });
    });
  }
})();
