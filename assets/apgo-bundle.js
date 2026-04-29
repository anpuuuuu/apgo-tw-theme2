/* APGO · 限時優惠組合 (Bundle Picker) — Phase B frontend logic
 *
 * Scope: only loaded when product.metafields.apgo.bundle_enabled == true
 *        (gated in layout/theme.liquid).
 *
 * Single shared state across desktop + mobile shells. Any interaction in
 * either shell updates state, then a render() pass syncs every widget
 * instance + the sticky bottom bar.
 *
 * Phase B does NOT hit /cart/add — clicking 加入購物車 / 立即購買 only
 * console.logs the payload that Phase C will POST. See
 * docs/V1S_PLUS_BUNDLE_PLAN.md.
 */
(function () {
  'use strict';

  function $(s, c) { return (c || document).querySelector(s); }
  function $$(s, c) { return Array.prototype.slice.call((c || document).querySelectorAll(s)); }

  var widgets = $$('[data-apgo-bundle]');
  if (!widgets.length) return;

  // ---------- State ----------
  var state = {
    tier: null,         // { buy, gift, total, unit, totalPrice, label }
    scents: {},         // { name: count }
    pulse: false        // for counter animation hooks (Phase D)
  };

  function totalSelected() {
    var sum = 0;
    for (var k in state.scents) sum += state.scents[k] || 0;
    return sum;
  }

  function readTier(el) {
    if (!el) return null;
    return {
      buy: parseInt(el.dataset.buy, 10) || 0,
      gift: parseInt(el.dataset.gift, 10) || 0,
      total: parseInt(el.dataset.total, 10) || 0,
      unit: parseInt(el.dataset.unit, 10) || 0,
      totalPrice: parseInt(el.dataset.tierTotal, 10) || 0,
      label: el.dataset.tierLabel || ''
    };
  }

  function init() {
    // Adopt the first .is-active tier as the starting state.
    var defaultTier = $('[data-apgo-bundle-tier].is-active');
    state.tier = readTier(defaultTier) || readTier($('[data-apgo-bundle-tier]'));

    // All scents start at 0.
    $$('[data-apgo-bundle-scent]').forEach(function (row) {
      var name = row.getAttribute('data-apgo-bundle-scent');
      if (name && state.scents[name] == null) state.scents[name] = 0;
    });
  }

  // ---------- Render ----------
  function render() {
    if (!state.tier) return;
    var sel = totalSelected();
    var maxN = state.tier.total;
    var giftN = state.tier.gift;
    var remaining = Math.max(0, maxN - sel);
    var isComplete = sel >= maxN && maxN > 0;

    // 1) Tier active state — sync across all widgets
    $$('[data-apgo-bundle-tier]').forEach(function (t) {
      var d = readTier(t);
      var active = d.label === state.tier.label;
      t.classList.toggle('is-active', active);
      var input = t.querySelector('.apgo-bundle__tier-input');
      if (input) input.checked = active;
    });

    // 2) Counter X / max + note max + gift count
    $$('[data-apgo-bundle-current]').forEach(function (el) { el.textContent = sel; });
    $$('[data-apgo-bundle-max]').forEach(function (el) { el.textContent = maxN; });
    $$('[data-apgo-bundle-max-note]').forEach(function (el) { el.textContent = maxN; });
    $$('[data-apgo-bundle-gift-note]').forEach(function (el) { el.textContent = giftN; });

    // 3) Per-row qty num + disabled buttons
    $$('[data-apgo-bundle-scent]').forEach(function (row) {
      var name = row.getAttribute('data-apgo-bundle-scent');
      var n = state.scents[name] || 0;
      var numEl = row.querySelector('[data-apgo-bundle-qty-num]');
      if (numEl) numEl.textContent = n;
      var minusBtn = row.querySelector('[data-apgo-bundle-qty="-1"]');
      var plusBtn  = row.querySelector('[data-apgo-bundle-qty="1"]');
      if (minusBtn) minusBtn.disabled = n <= 0;
      if (plusBtn)  plusBtn.disabled  = sel >= maxN;
    });

    // 4) CTA dual state — both inside widgets and inside the mobile sticky bar
    $$('[data-apgo-bundle-cta-disabled]').forEach(function (el) {
      el.style.display = isComplete ? 'none' : '';
      var rem = el.querySelector('[data-apgo-bundle-remaining]');
      if (rem) rem.textContent = remaining;
    });
    $$('[data-apgo-bundle-cta-enabled]').forEach(function (el) {
      el.style.display = isComplete ? '' : 'none';
    });
    $$('[data-apgo-bundle-total]').forEach(function (el) {
      el.textContent = state.tier.totalPrice;
    });
  }

  // ---------- Wire interactions ----------
  function wire() {
    // Tier click — switch active, trim scents if over new max
    $$('[data-apgo-bundle-tier]').forEach(function (t) {
      t.addEventListener('click', function (e) {
        // Prevent label's default radio toggle from interfering
        if (e.target && e.target.matches('input.apgo-bundle__tier-input')) {
          // let the radio change happen, then re-render
        }
        var newTier = readTier(t);
        if (!newTier || newTier.label === state.tier.label) {
          // Same tier → just re-render to be safe
          state.tier = newTier;
          render();
          return;
        }
        state.tier = newTier;
        // If current selections exceed new max, trim from highest-qty first
        var sel = totalSelected();
        if (sel > newTier.total) {
          var entries = Object.keys(state.scents).map(function (k) {
            return [k, state.scents[k]];
          }).sort(function (a, b) { return b[1] - a[1]; });
          var i = 0;
          while (sel > newTier.total && i < entries.length * 100 /* safety */) {
            var name = entries[i % entries.length][0];
            if (state.scents[name] > 0) {
              state.scents[name]--;
              sel--;
            }
            i++;
          }
        }
        render();
      });
    });

    // Qty +/- (delegated so dynamically-added rows also work)
    document.addEventListener('click', function (e) {
      var btn = e.target.closest && e.target.closest('[data-apgo-bundle-qty]');
      if (!btn) return;
      var row = btn.closest('[data-apgo-bundle-scent]');
      if (!row) return;
      var name = row.getAttribute('data-apgo-bundle-scent');
      var delta = parseInt(btn.dataset.apgoBundleQty, 10) || 0;
      var cur = state.scents[name] || 0;
      var newVal = cur + delta;
      if (newVal < 0) return;
      if (delta > 0 && totalSelected() >= state.tier.total) return; // hit max
      state.scents[name] = newVal;
      render();
    });

    // Quick actions: 全部都同款 / 隨機驚喜 / 清除
    $$('[data-apgo-bundle-action]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var action = btn.dataset.apgoBundleAction;
        var names = Object.keys(state.scents);
        if (!names.length) return;

        if (action === 'clear') {
          names.forEach(function (n) { state.scents[n] = 0; });
        } else if (action === 'all-same') {
          // Pick the user's currently most-selected; tie → first scent
          var topName = names[0];
          var topQty = state.scents[topName];
          names.forEach(function (n) {
            if (state.scents[n] > topQty) { topQty = state.scents[n]; topName = n; }
          });
          names.forEach(function (n) { state.scents[n] = 0; });
          state.scents[topName] = state.tier.total;
        } else if (action === 'random') {
          names.forEach(function (n) { state.scents[n] = 0; });
          for (var i = 0; i < state.tier.total; i++) {
            var pick = names[Math.floor(Math.random() * names.length)];
            state.scents[pick]++;
          }
        }
        render();
      });
    });

    // Add-to-cart / Buy-now — Phase B logs only
    $$('[data-apgo-bundle-add]').forEach(function (btn) {
      btn.addEventListener('click', function (e) {
        e.preventDefault();
        console.log('[apgo-bundle] add-to-cart (Phase B placeholder):', buildPayload());
      });
    });
    $$('[data-apgo-bundle-buy-now]').forEach(function (btn) {
      btn.addEventListener('click', function (e) {
        e.preventDefault();
        console.log('[apgo-bundle] buy-now → would POST then redirect /cart (Phase C):', buildPayload());
      });
    });
  }

  // ---------- Payload (Phase C will use this) ----------
  function buildPayload() {
    var items = [];
    var bundleId = 'apgo-bundle-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8);
    for (var name in state.scents) {
      var q = state.scents[name];
      if (q > 0) items.push({ scent: name, quantity: q });
    }
    return {
      bundle_id: bundleId,
      tier_label: state.tier.label,
      buy_count: state.tier.buy,
      gift_count: state.tier.gift,
      total_count: state.tier.total,
      total_price: state.tier.totalPrice,
      items: items
    };
  }

  // ---------- Boot ----------
  init();
  wire();
  render();

  // Re-init on Shopify theme editor section reload
  if (window.Shopify && Shopify.designMode) {
    document.addEventListener('shopify:section:load', function () {
      widgets = $$('[data-apgo-bundle]');
      init();
      wire();
      render();
    });
  }
})();
