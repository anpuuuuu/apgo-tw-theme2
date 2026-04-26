/* APGO · PDP interactions
 * Scope: any element inside [data-section-id] on apgo-v1s-plus template
 * Handles: variant selection, price updates, qty stepper, mobile tabs,
 * mobile carousel counter, desktop thumbnail → main image swap, buy-now.
 */
(function () {
  'use strict';

  // ---------- helpers ----------
  function $(sel, ctx) { return (ctx || document).querySelector(sel); }
  function $$(sel, ctx) { return Array.prototype.slice.call((ctx || document).querySelectorAll(sel)); }

  function formatMoney(cents) {
    // Try Shopify's global formatter if present; otherwise a sensible TWD default.
    if (window.Shopify && typeof window.Shopify.formatMoney === 'function') {
      var fmt = (window.theme && window.theme.moneyFormat) || '{{amount}}';
      try { return window.Shopify.formatMoney(cents, fmt); } catch (e) { /* fall through */ }
    }
    var n = Number(cents) / 100;
    // NT$ 1,234 — matches the rest of the theme's default
    return 'NT$ ' + n.toLocaleString('zh-TW', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
  }

  // ---------- per-form init ----------
  function initForm(form) {
    if (!form || form._apgoInitialized) return;
    form._apgoInitialized = true;

    var variantsEl = $('[data-apgo-variants]', form);
    var variants = [];
    if (variantsEl) {
      try { variants = JSON.parse(variantsEl.textContent); } catch (e) { variants = []; }
    }

    // Current selected option values — read from checked radios
    function readSelectedOptions() {
      var values = [];
      $$('[data-apgo-option-group]', form).forEach(function (group) {
        var checked = $('input[data-apgo-option-input]:checked', group);
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

    function qty() {
      var q = parseInt(($('[data-apgo-qty-input]', form) || {}).value, 10);
      return isNaN(q) || q < 1 ? 1 : q;
    }

    function updatePriceUI(variant) {
      if (!variant) return;
      // Variant id hidden input
      var idInput = $('[data-apgo-variant-id]', form);
      if (idInput) idInput.value = variant.id;

      var price = Number(variant.price);
      var compare = Number(variant.compare_at_price || 0);
      var q = qty();
      var total = price * q;

      $$('[data-apgo-price]', form).forEach(function (n) { n.textContent = formatMoney(price); });
      $$('[data-apgo-total]', form).forEach(function (n) { n.textContent = formatMoney(total); });
      $$('[data-apgo-compare]', form).forEach(function (n) {
        if (compare > price) { n.textContent = formatMoney(compare); n.style.display = ''; }
        else { n.style.display = 'none'; }
      });
      $$('[data-apgo-installment]', form).forEach(function (n) {
        n.textContent = '分 3 期 0 利率 · 每期 ' + formatMoney(Math.round(price / 3));
      });

      // Availability → disable add button
      $$('[data-apgo-add]', form).forEach(function (btn) {
        if (variant.available) {
          btn.removeAttribute('disabled');
          btn.classList.remove('is-soldout');
        } else {
          btn.setAttribute('disabled', 'disabled');
          btn.classList.add('is-soldout');
        }
      });
    }

    function updateCurrentValueLabels() {
      $$('[data-apgo-option-group]', form).forEach(function (group) {
        var checked = $('input[data-apgo-option-input]:checked', group);
        var label = $('[data-apgo-current-value]', group);
        if (checked && label) label.textContent = checked.value;

        // Toggle .active on parent chip / scentbtn
        $$('label', group).forEach(function (lbl) {
          var input = $('input[data-apgo-option-input]', lbl);
          if (!input) return;
          if (input.checked) lbl.classList.add('active');
          else lbl.classList.remove('active');
        });
      });
    }

    // Extract the filename portion of a Shopify CDN URL (strip query + path).
    // Used to match variant.featured_image.src against thumb/slide <img src>
    // because the two ID systems (variant image id vs product media image id)
    // don't share numeric IDs in Shopify, but the filename in src does match.
    function srcFilename(url) {
      if (!url) return '';
      var noQuery = url.split('?')[0];
      return noQuery.substring(noQuery.lastIndexOf('/') + 1).toLowerCase();
    }

    // Swap the main media (desktop main img + thumb activation, mobile carousel scroll)
    // to the variant's featured image. No-op if the variant has no featured image set.
    function syncMediaToVariant(variant) {
      if (!variant || !variant.featured_image || !variant.featured_image.src) return;
      var targetFile = srcFilename(variant.featured_image.src);
      if (!targetFile) return;

      // Desktop: find matching thumb, activate it, push its image into main slot.
      var mainImg = $('[data-apgo-main-img]', form);
      var matchedThumb = null;
      $$('[data-apgo-thumb-idx]', form).forEach(function (t) {
        var img = $('img', t);
        if (!img) return;
        if (srcFilename(img.currentSrc || img.src) === targetFile) matchedThumb = t;
      });
      if (matchedThumb) {
        $$('[data-apgo-thumb-idx]', form).forEach(function (t) { t.classList.remove('active'); });
        matchedThumb.classList.add('active');
        if (mainImg) {
          var thumbImg = $('img', matchedThumb);
          if (thumbImg) {
            var src = thumbImg.currentSrc || thumbImg.src;
            mainImg.src = src.replace(/(\?|&)width=\d+/, '$1width=1400');
          }
        }
        if (matchedThumb.scrollIntoView) {
          try { matchedThumb.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' }); } catch (e) {}
        }
      } else if (mainImg) {
        // No matching thumb (image only attached to variant, not in product.media gallery).
        // Still swap the main img directly to the variant featured image.
        mainImg.src = variant.featured_image.src.replace(/(\?|&)width=\d+/, '$1width=1400');
      }

      // Mobile: scroll the carousel track to the matching slide.
      var track = $('[data-apgo-carousel-track]', form);
      if (track) {
        var slides = $$('.apgo-mpdp-slide', track);
        for (var i = 0; i < slides.length; i++) {
          var simg = $('img', slides[i]);
          if (!simg) continue;
          if (srcFilename(simg.currentSrc || simg.src) === targetFile) {
            try { track.scrollTo({ left: slides[i].offsetLeft, behavior: 'smooth' }); }
            catch (e) { track.scrollLeft = slides[i].offsetLeft; }
            break;
          }
        }
      }
    }

    function onOptionChange() {
      updateCurrentValueLabels();
      var values = readSelectedOptions();
      var variant = findVariant(values);
      updatePriceUI(variant);
      syncMediaToVariant(variant);
    }

    // Wire radio inputs
    $$('input[data-apgo-option-input]', form).forEach(function (input) {
      input.addEventListener('change', onOptionChange);
    });

    // Qty stepper
    $$('[data-apgo-qty]', form).forEach(function (btn) {
      btn.addEventListener('click', function () {
        var dir = btn.getAttribute('data-apgo-qty');
        var input = $('[data-apgo-qty-input]', form);
        if (!input) return;
        var q = parseInt(input.value, 10);
        if (isNaN(q) || q < 1) q = 1;
        if (dir === 'up') q += 1;
        if (dir === 'down') q = Math.max(1, q - 1);
        input.value = q;
        onOptionChange();
      });
    });
    var qtyInput = $('[data-apgo-qty-input]', form);
    if (qtyInput) qtyInput.addEventListener('change', onOptionChange);

    // Buy now — submit to /cart/add then redirect /checkout
    $$('[data-apgo-buy-now]', form).forEach(function (btn) {
      btn.addEventListener('click', function (e) {
        e.preventDefault();
        var fd = new FormData(form);
        fetch('/cart/add.js', {
          method: 'POST',
          headers: { 'Accept': 'application/json' },
          body: fd
        }).then(function (r) { return r.json(); })
          .then(function () { window.location.href = '/checkout'; })
          .catch(function () { form.submit(); });
      });
    });

    // Desktop thumb rail → main image swap
    var mainImg = $('[data-apgo-main-img]', form);
    $$('[data-apgo-thumb-idx]', form).forEach(function (thumb) {
      thumb.addEventListener('click', function () {
        var img = $('img', thumb);
        if (!img || !mainImg) return;
        // Swap the main image src; use 1400px variant if we can derive it
        var src = img.currentSrc || img.src;
        // Replace &width=200 with &width=1400 where possible
        var big = src.replace(/(\?|&)width=\d+/, '$1width=1400');
        mainImg.src = big;
        $$('[data-apgo-thumb-idx]', form).forEach(function (t) { t.classList.remove('active'); });
        thumb.classList.add('active');
      });
    });

    // Thumb rail prev/next nav — scroll by 5 tiles at a time
    (function () {
      var rail = $('[data-apgo-thumb-rail]', form);
      if (!rail) return;
      var prevBtn = $('[data-apgo-thumb-nav="prev"]', form);
      var nextBtn = $('[data-apgo-thumb-nav="next"]', form);

      function stepSize() {
        var firstThumb = rail.querySelector('.apgo-thumb');
        if (!firstThumb) return rail.clientWidth;
        var gap = 10; // must match CSS .apgo-thumb-rail gap
        // Scroll by one full "page" of 5 thumbs
        return (firstThumb.offsetWidth + gap) * 5;
      }

      function updateNav() {
        if (!prevBtn || !nextBtn) return;
        var overflow = rail.scrollWidth - rail.clientWidth > 1;
        if (!overflow) {
          prevBtn.setAttribute('disabled', 'disabled');
          nextBtn.setAttribute('disabled', 'disabled');
          return;
        }
        if (rail.scrollLeft <= 1) prevBtn.setAttribute('disabled', 'disabled');
        else prevBtn.removeAttribute('disabled');
        if (rail.scrollLeft + rail.clientWidth >= rail.scrollWidth - 1) nextBtn.setAttribute('disabled', 'disabled');
        else nextBtn.removeAttribute('disabled');
      }

      if (prevBtn) prevBtn.addEventListener('click', function () { rail.scrollBy({ left: -stepSize(), behavior: 'smooth' }); });
      if (nextBtn) nextBtn.addEventListener('click', function () { rail.scrollBy({ left: stepSize(), behavior: 'smooth' }); });
      rail.addEventListener('scroll', updateNav, { passive: true });
      window.addEventListener('resize', updateNav);
      // Initial state (after a tick so layout is settled)
      setTimeout(updateNav, 50);
    })();

    // Initial sync
    updateCurrentValueLabels();
    var v0 = findVariant(readSelectedOptions());
    if (v0) updatePriceUI(v0);
  }

  // ---------- mobile tabs ----------
  function initTabs(root) {
    var tabs = $$('[data-apgo-mtab]', root);
    var panels = $$('[data-apgo-mpanel]', root);
    if (!tabs.length || !panels.length) return;

    function activate(key) {
      tabs.forEach(function (t) {
        if (t.getAttribute('data-apgo-mtab') === key) t.classList.add('active');
        else t.classList.remove('active');
      });
      panels.forEach(function (p) {
        if (p.getAttribute('data-apgo-mpanel') === key) p.classList.add('active');
        else p.classList.remove('active');
      });
    }

    tabs.forEach(function (t) {
      t.addEventListener('click', function () { activate(t.getAttribute('data-apgo-mtab')); });
    });

    // Default → first tab active if none is
    if (!$$('[data-apgo-mtab].active', root).length) {
      activate(tabs[0].getAttribute('data-apgo-mtab'));
    }
  }

  // ---------- mobile carousel counter ----------
  function initCarousel(root) {
    var track = $('[data-apgo-carousel-track]', root);
    if (!track) return;
    var idxEl = $('[data-apgo-carousel-idx]', root);
    var totalEl = $('[data-apgo-carousel-total]', root);
    var slides = Array.prototype.slice.call(track.children);
    if (totalEl) totalEl.textContent = slides.length;

    function onScroll() {
      if (!slides.length) return;
      var w = track.clientWidth || 1;
      var i = Math.round(track.scrollLeft / w) + 1;
      if (i < 1) i = 1;
      if (i > slides.length) i = slides.length;
      if (idxEl) idxEl.textContent = i;
    }

    track.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
  }

  // ---------- boot ----------
  function boot() {
    $$('form.apgo-product-form').forEach(initForm);
    $$('[data-section-id]').forEach(function (section) {
      initTabs(section);
      initCarousel(section);
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }

  // Re-init on Shopify section editor events
  if (window.Shopify && Shopify.designMode) {
    document.addEventListener('shopify:section:load', boot);
    document.addEventListener('shopify:section:select', boot);
  }
})();
