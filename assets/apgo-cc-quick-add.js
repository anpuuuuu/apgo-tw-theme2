/* APGO · Car Care Quick Add
 *
 * Scope: only loaded on collection templates (see layout/theme.liquid).
 *
 * Behavior:
 *   1. Scan every .product-card on the page; inject a small round + button
 *      at the bottom-right of each, tagged with the product handle.
 *   2. Click button:
 *      - Single-variant product → AJAX add 1 to cart, show success toast
 *      - Multi-variant product → open modal with variant picker, qty
 *        stepper, live price + variant image; submit AJAX adds to cart
 *   3. Modal closes on Esc / backdrop click / × button
 *   4. Toast shown bottom-center with auto-dismiss after 2.5s
 *
 * The modal is created once at boot and reused for all products to avoid
 * DOM bloat on long collection pages.
 */
(function () {
  'use strict';

  // ---------- Helpers ----------
  function $(s, c) { return (c || document).querySelector(s); }
  function $$(s, c) { return Array.prototype.slice.call((c || document).querySelectorAll(s)); }

  function formatMoney(cents) {
    if (window.Shopify && typeof window.Shopify.formatMoney === 'function') {
      var fmt = (window.theme && window.theme.moneyFormat) || 'NT${{amount}}';
      try { return window.Shopify.formatMoney(cents, fmt); } catch (e) {}
    }
    var n = Number(cents) / 100;
    return 'NT$ ' + n.toLocaleString('zh-TW', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
  }

  // ---------- Toast ----------
  var toastEl = null;
  function showToast(msg, ok) {
    if (!toastEl) {
      toastEl = document.createElement('div');
      toastEl.className = 'apgo-cc-toast';
      document.body.appendChild(toastEl);
    }
    toastEl.textContent = msg;
    toastEl.classList.toggle('apgo-cc-toast--err', !ok);
    toastEl.classList.add('is-visible');
    clearTimeout(toastEl._t);
    toastEl._t = setTimeout(function () {
      toastEl.classList.remove('is-visible');
    }, 2500);
  }

  // ---------- Cart add (single variant fast path) ----------
  function addToCart(variantId, qty) {
    return fetch('/cart/add.js', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify({ id: variantId, quantity: qty || 1 })
    }).then(function (r) {
      if (!r.ok) return r.json().then(function (e) { throw e; });
      return r.json();
    });
  }

  // Build the /products/<handle>.js URL from a link href, preserving locale
  // prefix (e.g. /en/, /zh-tw/) and handling URL-encoded Chinese handles.
  function buildProductJsonUrl(link) {
    var url;
    try { url = new URL(link.href); } catch (e) { return null; }
    var path = url.pathname.split('?')[0].split('#')[0];
    if (!path) return null;
    if (path.charAt(path.length - 1) === '/') path = path.slice(0, -1);
    return url.origin + path + '.js';
  }

  // ---------- Inject quick-add buttons ----------
  function injectButtons(root) {
    root = root || document;
    $$('.product-card', root).forEach(function (card) {
      if (card._apgoCcQA) return;
      var link = card.querySelector('a[href*="/products/"]');
      if (!link) return;

      var jsonUrl = buildProductJsonUrl(link);
      if (!jsonUrl) return;
      // First-time only debug helper to surface what URLs we're going to hit
      if (!window._apgoCcLogged) {
        console.log('[apgo-cc-quick-add] sample jsonUrl from card:', jsonUrl, ' linkHref:', link.href, ' linkRaw:', link.getAttribute('href'));
        window._apgoCcLogged = true;
      }

      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'apgo-cc-quick-add';
      btn.dataset.jsonUrl = jsonUrl;
      btn.setAttribute('aria-label', '加入購物車');
      btn.innerHTML = '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>';

      btn.addEventListener('click', function (e) {
        e.preventDefault();
        e.stopPropagation();
        openQuickAdd(jsonUrl, btn);
      });

      // Wrap [ref="priceContainer"] + btn in a flex row so the + button
      // sits on the same line as the sale price (not floating abs bottom-right).
      var priceEl = card.querySelector('[ref="priceContainer"]');
      if (priceEl && priceEl.parentNode) {
        var row = document.createElement('div');
        row.className = 'apgo-cc-price-row';
        priceEl.parentNode.insertBefore(row, priceEl);
        row.appendChild(priceEl);
        row.appendChild(btn);
      } else {
        // Fallback: priceContainer not found, append to card as before
        card.appendChild(btn);
      }
      card._apgoCcQA = true;
    });
  }

  // ---------- Modal: build once, reuse ----------
  var modal = null;
  var modalState = { product: null, variant: null };

  function buildModal() {
    if (modal) return modal;
    modal = document.createElement('div');
    modal.className = 'apgo-cc-qa-modal';
    modal.innerHTML = [
      '<div class="apgo-cc-qa-modal__overlay" data-qa-close></div>',
      '<div class="apgo-cc-qa-modal__dialog" role="dialog" aria-modal="true" aria-labelledby="apgo-cc-qa-title">',
      '  <button type="button" class="apgo-cc-qa-modal__close" data-qa-close aria-label="關閉">×</button>',
      '  <div class="apgo-cc-qa-modal__body">',
      '    <div class="apgo-cc-qa-modal__top">',
      '      <div class="apgo-cc-qa-modal__media">',
      '        <img class="apgo-cc-qa-modal__img" data-qa-img alt="">',
      '      </div>',
      '      <div class="apgo-cc-qa-modal__info">',
      '        <h3 class="apgo-cc-qa-modal__title" id="apgo-cc-qa-title" data-qa-title></h3>',
      '        <div class="apgo-cc-qa-modal__price" data-qa-price></div>',
      '      </div>',
      '    </div>',
      '    <div class="apgo-cc-qa-modal__options" data-qa-options></div>',
      '    <div class="apgo-cc-qa-modal__footer">',
      '      <div class="apgo-cc-qa-modal__qty">',
      '        <button type="button" data-qa-qty="-1" aria-label="減少">−</button>',
      '        <input type="number" value="1" min="1" data-qa-qty-input>',
      '        <button type="button" data-qa-qty="1" aria-label="增加">+</button>',
      '      </div>',
      '      <button type="button" class="apgo-cc-qa-modal__cta" data-qa-add>加入購物車</button>',
      '    </div>',
      '  </div>',
      '</div>'
    ].join('');
    document.body.appendChild(modal);

    // Close handlers
    modal.querySelectorAll('[data-qa-close]').forEach(function (el) {
      el.addEventListener('click', closeModal);
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && modal.classList.contains('is-open')) closeModal();
    });

    // Qty stepper
    modal.querySelectorAll('[data-qa-qty]').forEach(function (b) {
      b.addEventListener('click', function () {
        var input = $('[data-qa-qty-input]', modal);
        var v = parseInt(input.value, 10) || 1;
        v = Math.max(1, v + parseInt(b.dataset.qaQty, 10));
        input.value = v;
      });
    });

    // Add to cart
    $('[data-qa-add]', modal).addEventListener('click', function () {
      var v = modalState.variant;
      if (!v) return;
      var qty = parseInt($('[data-qa-qty-input]', modal).value, 10) || 1;
      var cta = $('[data-qa-add]', modal);
      cta.disabled = true;
      cta.textContent = '加入中…';
      addToCart(v.id, qty)
        .then(function () {
          cta.textContent = '已加入 ✓';
          showToast('已加入購物車', true);
          setTimeout(closeModal, 800);
        })
        .catch(function (err) {
          cta.disabled = false;
          cta.textContent = '加入購物車';
          showToast((err && err.description) || '加入失敗，請稍後再試', false);
        });
    });

    return modal;
  }

  function openModal(product) {
    buildModal();
    modalState.product = product;
    var firstAvailable = product.variants.find(function (v) { return v.available; }) || product.variants[0];
    modalState.variant = firstAvailable;

    $('[data-qa-title]', modal).textContent = product.title;
    var img = $('[data-qa-img]', modal);
    var src = (firstAvailable.featured_image && firstAvailable.featured_image.src) || product.featured_image || '';
    img.src = src;
    img.alt = product.title;

    // Normalise options into [{name, values}] regardless of Shopify shape
    function normaliseOptions(opts, variants) {
      if (!opts || !opts.length) return [];
      // Shape A: strings — e.g. ["Color", "Size"]
      // Shape B: objects with name/values — e.g. [{name: "Color", values: [...]}]
      if (typeof opts[0] === 'string') {
        return opts.map(function (n, i) {
          var vals = [];
          variants.forEach(function (v) {
            var val = v.options[i];
            if (vals.indexOf(val) === -1) vals.push(val);
          });
          return { name: n, values: vals };
        });
      }
      return opts.map(function (o, i) {
        var vals = (o && o.values) || [];
        if (!vals.length) {
          variants.forEach(function (v) {
            var val = v.options[i];
            if (vals.indexOf(val) === -1) vals.push(val);
          });
        }
        return { name: (o && o.name) || ('Option ' + (i + 1)), values: vals };
      });
    }

    var normalisedOpts = normaliseOptions(product.options, product.variants);
    var skipModalOpts = normalisedOpts.length === 1 &&
      String(normalisedOpts[0].name).toLowerCase() === 'title';

    // Render options
    var optsRoot = $('[data-qa-options]', modal);
    optsRoot.innerHTML = '';
    if (!skipModalOpts) {
      normalisedOpts.forEach(function (opt, optIdx) {
        var group = document.createElement('div');
        group.className = 'apgo-cc-qa-modal__opt-group';
        group.innerHTML = '<div class="apgo-cc-qa-modal__opt-name">' + opt.name + '</div>';
        var chipsWrap = document.createElement('div');
        chipsWrap.className = 'apgo-cc-qa-modal__opt-chips';
        opt.values.forEach(function (val) {
          var chip = document.createElement('button');
          chip.type = 'button';
          chip.className = 'apgo-cc-qa-modal__chip';
          if (firstAvailable.options[optIdx] === val) chip.classList.add('is-active');
          chip.textContent = val;
          chip.dataset.opt = optIdx;
          chip.dataset.val = val;
          chip.addEventListener('click', function () {
            chipsWrap.querySelectorAll('.apgo-cc-qa-modal__chip').forEach(function (c) {
              c.classList.remove('is-active');
            });
            chip.classList.add('is-active');
            updateActiveVariant();
          });
          chipsWrap.appendChild(chip);
        });
        group.appendChild(chipsWrap);
        optsRoot.appendChild(group);
      });
    }

    $('[data-qa-qty-input]', modal).value = 1;
    $('[data-qa-add]', modal).disabled = false;
    $('[data-qa-add]', modal).textContent = firstAvailable.available ? '加入購物車' : '已售完';

    updatePriceUI();
    modal.classList.add('is-open');
    document.body.style.overflow = 'hidden';
  }

  function closeModal() {
    if (!modal) return;
    modal.classList.remove('is-open');
    document.body.style.overflow = '';
    modalState.product = null;
    modalState.variant = null;
  }

  function readModalSelectedOptions() {
    var values = [];
    $$('.apgo-cc-qa-modal__opt-group', modal).forEach(function (group) {
      var active = $('.apgo-cc-qa-modal__chip.is-active', group);
      values.push(active ? active.dataset.val : null);
    });
    return values;
  }

  function updateActiveVariant() {
    if (!modalState.product) return;
    var sel = readModalSelectedOptions();
    var match = modalState.product.variants.find(function (v) {
      return v.options.every(function (o, i) { return sel[i] == null || sel[i] === o; });
    });
    if (!match) return;
    modalState.variant = match;

    // swap image if variant has featured_image
    if (match.featured_image && match.featured_image.src) {
      $('[data-qa-img]', modal).src = match.featured_image.src;
    }
    updatePriceUI();
    var cta = $('[data-qa-add]', modal);
    cta.disabled = !match.available;
    cta.textContent = match.available ? '加入購物車' : '已售完';
  }

  function updatePriceUI() {
    var v = modalState.variant;
    if (!v) return;
    var priceEl = $('[data-qa-price]', modal);
    if (v.compare_at_price && v.compare_at_price > v.price) {
      priceEl.innerHTML =
        '<span class="apgo-cc-qa-modal__price-current">' + formatMoney(v.price) + '</span>' +
        '<span class="apgo-cc-qa-modal__price-compare">' + formatMoney(v.compare_at_price) + '</span>';
    } else {
      priceEl.innerHTML = '<span class="apgo-cc-qa-modal__price-current">' + formatMoney(v.price) + '</span>';
    }
  }

  // ---------- Quick add entry ----------
  function openQuickAdd(jsonUrl, triggerBtn) {
    var origHTML = triggerBtn.innerHTML;
    triggerBtn.classList.add('is-loading');
    triggerBtn.disabled = true;

    console.log('[apgo-cc-quick-add] fetching:', jsonUrl);

    fetch(jsonUrl, { headers: { 'Accept': 'application/json' }, credentials: 'same-origin' })
      .then(function (r) {
        console.log('[apgo-cc-quick-add] response', { status: r.status, url: r.url, redirected: r.redirected, contentType: r.headers.get('content-type') });
        if (!r.ok) {
          throw new Error('HTTP ' + r.status + ' on ' + jsonUrl);
        }
        return r.text();
      })
      .then(function (raw) {
        var product;
        try { product = JSON.parse(raw); }
        catch (e) {
          // The endpoint returned HTML (e.g. a Shogun custom landing page) —
          // not the standard Shopify product JSON. Tell user we can't quick-add.
          throw new Error('Endpoint returned non-JSON. First 100 chars: ' + raw.substring(0, 100));
        }
        if (!product || !product.variants) {
          throw new Error('Product payload missing .variants — ' + jsonUrl);
        }

        triggerBtn.classList.remove('is-loading');
        triggerBtn.disabled = false;
        triggerBtn.innerHTML = origHTML;

        // Shopify can return product.options as either ['Color', 'Size'] or
        // [{name: 'Color', values: [...]}, ...] depending on API version /
        // app modifications. Normalise to plain string names.
        function optName(o) {
          if (typeof o === 'string') return o;
          if (o && typeof o === 'object') return o.name || '';
          return String(o);
        }
        var optionNames = (product.options || []).map(optName);

        var hasOptions =
          product.variants.length > 1 ||
          (optionNames.length > 0 &&
            !(optionNames.length === 1 &&
              optionNames[0].toLowerCase() === 'title'));

        if (!hasOptions) {
          var v = product.variants[0];
          if (!v.available) {
            showToast('商品已售完', false);
            return;
          }
          addToCart(v.id, 1)
            .then(function () {
              showToast('已加入購物車', true);
              document.dispatchEvent(new CustomEvent('cart:updated'));
            })
            .catch(function (err) {
              showToast((err && err.description) || '加入失敗', false);
            });
        } else {
          openModal(product);
        }
      })
      .catch(function (err) {
        triggerBtn.classList.remove('is-loading');
        triggerBtn.disabled = false;
        triggerBtn.innerHTML = origHTML;
        // Log full detail so we can debug from devtools
        console.error('[apgo-cc-quick-add] read failed:', err);
        showToast('讀取商品失敗，請至商品頁加入', false);
      });
  }

  // ---------- Boot ----------
  function boot() {
    injectButtons();
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else { boot(); }

  // Re-inject on Shopify section editor reloads + after AJAX paginations
  if (window.Shopify && Shopify.designMode) {
    document.addEventListener('shopify:section:load', function (e) { injectButtons(e.target); });
  }
  // Watch DOM mutations for new product cards (e.g. infinite scroll, ajax filters)
  var observer = new MutationObserver(function (muts) {
    var changed = false;
    muts.forEach(function (m) {
      m.addedNodes.forEach(function (n) {
        if (n.nodeType === 1 && (n.classList && n.classList.contains('product-card') || n.querySelector && n.querySelector('.product-card'))) {
          changed = true;
        }
      });
    });
    if (changed) injectButtons();
  });
  observer.observe(document.body, { childList: true, subtree: true });
})();
