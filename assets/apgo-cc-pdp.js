/* APGO · Car Care PDP interactions
 *
 * Scope: only loaded when template.suffix == 'apgo-v2' (see layout/theme.liquid).
 * Handles:
 *   - Tab switching
 *   - Variant option chips → live price + variant id update
 *   - Qty stepper
 *   - Thumbnail → main image swap
 *   - 加入購物車 (form submit) — AJAX cart add + toast, stay on page
 *   - 立即購買 — AJAX cart add + redirect to /cart for verification
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
      // Swap main gallery image to the variant's featured_image when one
      // is set in Shopify admin. Falls through silently if no per-variant
      // image (card stays on the product-level featured_media).
      var mainImg = $('[data-apgo-cc-main-img]', root);
      if (mainImg && v.featured_image && v.featured_image.src) {
        var newSrc = v.featured_image.src.replace(/(\?|&)width=\d+/, '$1width=1200');
        if (!newSrc.match(/[?&]width=/)) {
          newSrc += (newSrc.indexOf('?') > -1 ? '&' : '?') + 'width=1200';
        }
        if (mainImg.src !== newSrc) mainImg.src = newSrc;
      }
      // Sync the active thumb/dot to the variant's featured_media so the
      // gallery indicator reflects which photo belongs to this variant.
      if (v.featured_media && v.featured_media.id != null) {
        var activeMediaId = String(v.featured_media.id);
        $$('[data-apgo-cc-thumb]', root).forEach(function (el) {
          el.classList.toggle('is-active', el.getAttribute('data-apgo-cc-media-id') === activeMediaId);
        });
      }
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

    // ---------------- Tabs (continuous-scroll mode) ----------------
    // All panels render stacked (CSS no longer hides inactive ones).
    // Tab click smooth-scrolls to that panel. An IntersectionObserver
    // watches each panel and marks the corresponding tab .is-active
    // when its content crosses the viewport's vertical center, so the
    // tab bar highlights the section the reader is currently on.
    var tabsRoot = $('[data-apgo-cc-tabs]', root);
    if (tabsRoot) {
      function setActiveTab(key) {
        $$('[data-apgo-cc-tab]', tabsRoot).forEach(function (t) {
          t.classList.toggle('is-active', t.getAttribute('data-apgo-cc-tab') === key);
        });
      }

      $$('[data-apgo-cc-tab]', tabsRoot).forEach(function (tab) {
        tab.addEventListener('click', function () {
          var key = tab.getAttribute('data-apgo-cc-tab');
          var target = tabsRoot.querySelector('[data-apgo-cc-panel="' + key + '"]');
          if (!target) return;
          // Visually mark active immediately for snappy feedback; the
          // observer will sync once scroll settles.
          setActiveTab(key);
          target.scrollIntoView({ behavior: 'smooth', block: 'start' });
        });
      });

      // Scroll-spy: highlight the tab whose panel is currently in view.
      // rootMargin '-50% 0px -50% 0px' makes the observer fire when an
      // element crosses the viewport's vertical center — feels natural
      // since the active section is whatever the reader is centered on.
      if ('IntersectionObserver' in window) {
        var panels = $$('[data-apgo-cc-panel]', tabsRoot);
        if (panels.length) {
          var spyIo = new IntersectionObserver(function (entries) {
            entries.forEach(function (entry) {
              if (entry.isIntersecting) {
                setActiveTab(entry.target.getAttribute('data-apgo-cc-panel'));
              }
            });
          }, { rootMargin: '-50% 0px -50% 0px', threshold: 0 });
          panels.forEach(function (p) { spyIo.observe(p); });
        }
      }
    }

    // ---------------- Demo videos modal ----------------
    var videoModal = $('[data-apgo-cc-video-modal]', root) || $('[data-apgo-cc-video-modal]');
    var videoPlayer = videoModal && $('[data-apgo-cc-video-player]', videoModal);
    if (videoModal && videoPlayer) {
      function openVideo(url) {
        if (!url) return;
        videoPlayer.src = url;
        videoModal.setAttribute('aria-hidden', 'false');
        videoModal.classList.add('is-open');
        document.documentElement.style.overflow = 'hidden';
        // Best-effort autoplay (user clicked → counts as user gesture)
        videoPlayer.play().catch(function () {});
      }
      function closeVideo() {
        videoModal.setAttribute('aria-hidden', 'true');
        videoModal.classList.remove('is-open');
        document.documentElement.style.overflow = '';
        try { videoPlayer.pause(); } catch (e) {}
        videoPlayer.removeAttribute('src');
        videoPlayer.load();
      }
      $$('[data-apgo-cc-video]', root).forEach(function (card) {
        card.addEventListener('click', function () {
          openVideo(card.getAttribute('data-apgo-cc-video'));
        });
      });
      $$('[data-apgo-cc-video-close]', videoModal).forEach(function (el) {
        el.addEventListener('click', closeVideo);
      });
      document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape' && videoModal.classList.contains('is-open')) closeVideo();
      });
    }

    // ---------------- Thumb / dot → main img ----------------
    // Both thumbnails (with nested <img>) and dots (no <img>, just a
    // data-apgo-cc-thumb-src attribute) use the same hook.
    // Also: if this media is a variant's featured_media, propagate
    // the click back into the variant chips so the chip below highlights
    // the matching option (and price / variant id stay in sync).
    var mainImg = $('[data-apgo-cc-main-img]', root);
    $$('[data-apgo-cc-thumb]', root).forEach(function (thumb) {
      thumb.addEventListener('click', function () {
        if (!mainImg) return;
        var src;
        var img = $('img', thumb);
        if (img) {
          // Thumbnail with nested <img>: upgrade the width param
          src = (img.currentSrc || img.src).replace(/(\?|&)width=\d+/, '$1width=1200');
        } else if (thumb.dataset.apgoCcThumbSrc) {
          // Dot indicator: full-size url passed via data attribute
          src = thumb.dataset.apgoCcThumbSrc;
        }
        if (!src) return;
        mainImg.src = src;
        $$('[data-apgo-cc-thumb]', root).forEach(function (t) { t.classList.remove('is-active'); });
        thumb.classList.add('is-active');

        // If this thumb's media is a variant's featured_media, find that
        // variant and select its options so the chip below highlights.
        var mediaId = thumb.getAttribute('data-apgo-cc-media-id');
        if (!mediaId) return;
        var matchedVariant = null;
        for (var vi = 0; vi < variants.length; vi++) {
          var vv = variants[vi];
          if (vv && vv.featured_media && String(vv.featured_media.id) === String(mediaId)) {
            matchedVariant = vv; break;
          }
        }
        if (!matchedVariant) return;
        var vOpts = [matchedVariant.option1, matchedVariant.option2, matchedVariant.option3];
        var groups = $$('[data-apgo-cc-option-group]', root);
        var changed = false;
        for (var gi = 0; gi < groups.length; gi++) {
          var optVal = vOpts[gi];
          if (optVal == null) continue;
          var group = groups[gi];
          var radio = group.querySelector(
            'input[data-apgo-cc-option-input][value="' + optVal.replace(/"/g, '\\"') + '"]'
          );
          if (radio && !radio.checked) { radio.checked = true; changed = true; }
        }
        // Fire updateUI() once at the end via a synthetic change so price /
        // variant id / chip is-active states refresh in one pass (avoids
        // re-running updateUI per option group).
        if (changed) {
          updateUI();
        }
      });
    });

    // ---------------- Swipe gesture on main gallery image ----------------
    // Mainly for the dot-indicator mode (show_thumbs off), but also
    // works when thumbnails are shown. Reuses the same is-active logic
    // by programmatically triggering the relevant thumb's click handler.
    var galleryMain = $('.apgo-cc-pdp__gallery-main', root);
    if (galleryMain) {
      var swipeStartX = 0;
      var swipeStartY = 0;
      var swipeActive = false;
      var SWIPE_MIN = 40; // px horizontal travel to count as swipe

      function getThumbs() {
        return $$('[data-apgo-cc-thumb]', root);
      }
      function currentIdx(thumbs) {
        for (var i = 0; i < thumbs.length; i++) {
          if (thumbs[i].classList.contains('is-active')) return i;
        }
        return 0;
      }
      function go(delta) {
        var thumbs = getThumbs();
        if (thumbs.length < 2) return;
        var idx = currentIdx(thumbs);
        var next = (idx + delta + thumbs.length) % thumbs.length;
        thumbs[next].click();
      }

      galleryMain.addEventListener('touchstart', function (e) {
        if (!e.touches || e.touches.length !== 1) return;
        swipeStartX = e.touches[0].clientX;
        swipeStartY = e.touches[0].clientY;
        swipeActive = true;
      }, { passive: true });

      galleryMain.addEventListener('touchend', function (e) {
        if (!swipeActive) return;
        swipeActive = false;
        var touch = e.changedTouches && e.changedTouches[0];
        if (!touch) return;
        var dx = touch.clientX - swipeStartX;
        var dy = touch.clientY - swipeStartY;
        // Horizontal swipe only — ignore vertical scroll gestures
        if (Math.abs(dx) < SWIPE_MIN || Math.abs(dy) > Math.abs(dx)) return;
        go(dx < 0 ? 1 : -1); // swipe left → next, swipe right → previous
      });

      galleryMain.addEventListener('touchcancel', function () {
        swipeActive = false;
      });
    }

    // ---------------- Toast (reuse .apgo-cc-toast CSS from quick-add) ----------------
    var toastEl = null;
    function showToast(msg, isErr) {
      if (!toastEl) {
        toastEl = document.createElement('div');
        toastEl.className = 'apgo-cc-toast';
        document.body.appendChild(toastEl);
      }
      toastEl.textContent = msg;
      toastEl.classList.toggle('apgo-cc-toast--err', !!isErr);
      toastEl.classList.add('is-visible');
      clearTimeout(toastEl._t);
      toastEl._t = setTimeout(function () {
        toastEl.classList.remove('is-visible');
      }, 2200);
    }

    function dispatchCartEvents(cart) {
      document.dispatchEvent(new CustomEvent('cart:update', { detail: { cart: cart } }));
      document.documentElement.dispatchEvent(new CustomEvent('cart:refresh', { bubbles: true, detail: { cart: cart } }));
      document.dispatchEvent(new CustomEvent('cart:updated'));
      try {
        import('@theme/events').then(function (mod) {
          if (mod && mod.CartUpdateEvent) {
            document.dispatchEvent(new mod.CartUpdateEvent(cart, 'apgo-cc-pdp', {
              itemCount: cart.item_count, source: 'apgo-cc-pdp', sections: {}
            }));
          }
          if (mod && mod.CartAddEvent) {
            document.dispatchEvent(new mod.CartAddEvent({}, 'apgo-cc-pdp', { source: 'apgo-cc-pdp' }));
          }
        }).catch(function () {});
      } catch (_) {}
    }

    // ---------------- Form / CTA buttons (desktop in-panel) ----------------
    // Both buttons go AJAX. 加入購物車 (form submit) → toast + stay on page.
    // 立即購買 → toast (optional) + redirect to /cart so user can verify
    // their order (matching the mobile buybar behaviour).
    var form = $('form.apgo-cc-pdp__form', root);

    function ajaxAdd(triggerBtn, onSuccess) {
      if (!form) return;
      var fd = new FormData(form);
      var orig = triggerBtn && triggerBtn.textContent;
      if (triggerBtn) { triggerBtn.disabled = true; triggerBtn.textContent = '加入中…'; }

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
          // Refetch live cart so header counters / drawer pick up the change
          return fetch('/cart.js?_=' + Date.now(), {
            cache: 'no-store',
            headers: { 'Accept': 'application/json' }
          }).then(function (r) { return r.json(); });
        })
        .then(function (cart) {
          dispatchCartEvents(cart);
          if (triggerBtn) { triggerBtn.disabled = false; triggerBtn.textContent = orig; }
          if (typeof onSuccess === 'function') onSuccess(cart);
        })
        .catch(function (err) {
          console.error('[apgo-cc-pdp] cart add failed:', err);
          var msg = (err && err.description) || (err && err.message) || '加入失敗，請稍後再試';
          showToast(msg, true);
          if (triggerBtn) { triggerBtn.disabled = false; triggerBtn.textContent = orig; }
        });
    }

    // 加入購物車 = form submit. Intercept so the browser doesn't navigate
    // to /cart on form post — instead AJAX add + toast + stay on PDP.
    if (form) {
      form.addEventListener('submit', function (e) {
        e.preventDefault();
        var btn = $('button[type="submit"]', form);
        ajaxAdd(btn, function () {
          showToast('✓ 已加入購物車');
        });
      });
    }

    // 立即購買 → AJAX add + redirect to /cart (so shopper can verify cart
    // with any auto-discounts before committing). Note: NOT /checkout.
    var buyNow = $('[data-apgo-cc-buy-now]', root);
    if (buyNow && form) {
      buyNow.addEventListener('click', function () {
        ajaxAdd(buyNow, function () {
          window.location.href = '/cart';
        });
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
