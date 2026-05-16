/* APGO · Car Care PDP interactions
 *
 * Scope: only loaded when template.suffix == 'apgo-v2' (see layout/theme.liquid).
 * Handles:
 *   - Tab switching
 *   - Variant option chips → live price + variant id update
 *   - Qty stepper
 *   - Thumbnail → main image swap
 *   - Buy now (AJAX cart add → /checkout)
 *
 * Phase 4 of docs/CAR_CARE_REDESIGN_PLAN.md
 */
(function () {
  'use strict';

  function $(sel, ctx) { return (ctx || document).querySelector(sel); }
  function $$(sel, ctx) { return Array.prototype.slice.call((ctx || document).querySelectorAll(sel)); }

  function formatMoney(cents) {
    if (window.Shopify && typeof window.Shopify.formatMoney === 'function') {
      var fmt = (window.theme && window.theme.moneyFormat) || 'NT${{amount}}';
      try { return window.Shopify.formatMoney(cents, fmt); } catch (e) {}
    }
    var n = Number(cents) / 100;
    return 'NT$ ' + n.toLocaleString('zh-TW', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
  }

  function initPDP(root) {
    if (!root || root._apgoCcInit) return;
    root._apgoCcInit = true;

    // ---------------- Variant chips ----------------
    var variants = [];
    var variantsEl = $('[data-apgo-cc-variants]', root);
    if (variantsEl) {
      try { variants = JSON.parse(variantsEl.textContent); } catch (e) {}
    }
    var variantIdInput = $('[data-apgo-cc-variant-id]', root);
    var priceEl = $('[data-apgo-cc-price]', root);
    var submitBtn = $('button[type="submit"]', root);

    function readSelectedOptions() {
      var values = [];
      $$('[data-apgo-cc-option-group]', root).forEach(function (group) {
        var checked = $('input[data-apgo-cc-option-input]:checked', group);
        values.push(checked ? checked.value : null);
      });
      return values;
    }

    function findVariant(values) {
      for (var i = 0; i < variants.length; i++) {
        var v = variants[i];
        var vOpts = [v.option1, v.option2, v.option3];
        var ok = true;
        for (var j = 0; j < values.length; j++) {
          if (values[j] != null && vOpts[j] !== values[j]) { ok = false; break; }
        }
        if (ok) return v;
      }
      return null;
    }

    function updateUI() {
      // Active chip + current value labels
      $$('[data-apgo-cc-option-group]', root).forEach(function (group) {
        var checked = $('input[data-apgo-cc-option-input]:checked', group);
        var label = $('[data-apgo-cc-option-current]', group);
        if (checked && label) label.textContent = checked.value;
        $$('label.apgo-cc-pdp__chip', group).forEach(function (lbl) {
          var input = $('input[data-apgo-cc-option-input]', lbl);
          if (!input) return;
          if (input.checked) lbl.classList.add('is-active');
          else lbl.classList.remove('is-active');
        });
      });

      var v = findVariant(readSelectedOptions());
      if (!v) return;
      if (variantIdInput) variantIdInput.value = v.id;
      if (priceEl) priceEl.textContent = formatMoney(v.price);
      if (submitBtn) {
        if (v.available) {
          submitBtn.removeAttribute('disabled');
          submitBtn.textContent = '加入購物車';
        } else {
          submitBtn.setAttribute('disabled', 'disabled');
          submitBtn.textContent = '已售完';
        }
      }
    }

    $$('input[data-apgo-cc-option-input]', root).forEach(function (i) {
      i.addEventListener('change', updateUI);
    });

    // ---------------- Qty stepper ----------------
    $$('[data-apgo-cc-qty]', root).forEach(function (btn) {
      btn.addEventListener('click', function () {
        var dir = btn.getAttribute('data-apgo-cc-qty');
        var input = $('[data-apgo-cc-qty-input]', root);
        if (!input) return;
        var q = parseInt(input.value, 10);
        if (isNaN(q) || q < 1) q = 1;
        if (dir === 'up') q += 1;
        if (dir === 'down') q = Math.max(1, q - 1);
        input.value = q;
      });
    });

    // ---------------- Tabs ----------------
    var tabsRoot = $('[data-apgo-cc-tabs]', root);
    if (tabsRoot) {
      $$('[data-apgo-cc-tab]', tabsRoot).forEach(function (tab) {
        tab.addEventListener('click', function () {
          var key = tab.getAttribute('data-apgo-cc-tab');
          $$('[data-apgo-cc-tab]', tabsRoot).forEach(function (t) { t.classList.remove('is-active'); });
          tab.classList.add('is-active');
          $$('[data-apgo-cc-panel]', tabsRoot).forEach(function (p) {
            if (p.getAttribute('data-apgo-cc-panel') === key) p.classList.add('is-active');
            else p.classList.remove('is-active');
          });
        });
      });
    }

    // ---------------- Thumb → main img ----------------
    var mainImg = $('[data-apgo-cc-main-img]', root);
    $$('[data-apgo-cc-thumb]', root).forEach(function (thumb) {
      thumb.addEventListener('click', function () {
        var img = $('img', thumb);
        if (!img || !mainImg) return;
        var src = (img.currentSrc || img.src).replace(/(\?|&)width=\d+/, '$1width=1200');
        mainImg.src = src;
        $$('[data-apgo-cc-thumb]', root).forEach(function (t) { t.classList.remove('is-active'); });
        thumb.classList.add('is-active');
      });
    });

    // ---------------- Buy now ----------------
    var buyNow = $('[data-apgo-cc-buy-now]', root);
    var form = $('form.apgo-cc-pdp__form', root);
    if (buyNow && form) {
      buyNow.addEventListener('click', function () {
        var fd = new FormData(form);
        fetch('/cart/add.js', {
          method: 'POST', headers: { 'Accept': 'application/json' }, body: fd
        }).then(function (r) { return r.json(); })
          .then(function () { window.location.href = '/checkout'; })
          .catch(function () { form.submit(); });
      });
    }

    // Initial paint
    updateUI();
  }

  function boot() {
    $$('[data-apgo-cc-pdp]').forEach(initPDP);
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else { boot(); }
  if (window.Shopify && Shopify.designMode) {
    document.addEventListener('shopify:section:load', boot);
  }
})();
