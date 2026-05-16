/* APGO · Car Care PDP — Mobile Sticky Buy Bar
 *
 * B1 scope (this file's current state):
 *   - 加入購物車 button → POST /cart/add.js using the existing .apgo-cc-pdp__form
 *     fields (variant id, options, quantity). On success, refetch /cart.js
 *     and dispatch cart:update / cart:updated so the header counter etc.
 *     stay in sync.
 *   - 前往結帳 button → navigate to /checkout
 *   - Price on the bar mirrors the in-panel price (which apgo-cc-pdp.js
 *     keeps fresh on variant change) — a MutationObserver pipes it across
 *     so we don't duplicate variant-lookup logic here.
 *
 * B2 will extend with swipe-up to reveal mini cart sheet + drag handle
 * interactions. The markup already includes .apgo-cc-buybar__handle so
 * that work is purely additive.
 *
 * Loaded only on template.suffix == 'apgo-v2' via layout/theme.liquid.
 */
(function () {
  'use strict';

  var bar = document.querySelector('[data-apgo-cc-buybar]');
  if (!bar) return;

  var form = document.querySelector('.apgo-cc-pdp__form');
  if (!form) return; // PDP form missing → bar can't do anything useful

  var addBtn      = bar.querySelector('[data-apgo-cc-buybar-add]');
  var checkoutBtn = bar.querySelector('[data-apgo-cc-buybar-checkout]');
  var priceEl     = bar.querySelector('[data-apgo-cc-buybar-price]');

  // ---------- Toast (reuse the .apgo-cc-toast CSS already defined for quick-add) ----------
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

  // ---------- Mirror price from PDP price card → bar ----------
  // apgo-cc-pdp.js owns variant switching + price updates on [data-apgo-cc-price].
  // We observe that element and copy its text into the bar so the two
  // always show the same value without us re-implementing variant lookup.
  var sourcePriceEl = document.querySelector('[data-apgo-cc-price]');
  if (sourcePriceEl && priceEl) {
    // sync initial value (in case bar rendered before PDP updated)
    priceEl.textContent = sourcePriceEl.textContent.trim();
    var obs = new MutationObserver(function () {
      priceEl.textContent = sourcePriceEl.textContent.trim();
    });
    obs.observe(sourcePriceEl, { childList: true, characterData: true, subtree: true });
  }

  // ---------- Add to cart ----------
  if (addBtn) {
    addBtn.addEventListener('click', function () {
      if (addBtn.disabled) return;
      // FormData picks up variant id, all option radios, quantity in one go.
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
        .then(function () {
          // Refetch live cart so cart drawer / header counter pick up changes
          return fetch('/cart.js?_=' + Date.now(), {
            cache: 'no-store',
            headers: { 'Accept': 'application/json' }
          }).then(function (r) { return r.json(); });
        })
        .then(function (cart) {
          document.dispatchEvent(new CustomEvent('cart:update', { detail: { cart: cart } }));
          document.documentElement.dispatchEvent(new CustomEvent('cart:refresh', { bubbles: true, detail: { cart: cart } }));
          document.dispatchEvent(new CustomEvent('cart:updated'));

          // Try Horizon's @theme/events (best-effort, ignore if absent)
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

  // ---------- Checkout ----------
  if (checkoutBtn) {
    checkoutBtn.addEventListener('click', function () {
      window.location.href = '/checkout';
    });
  }
})();
