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
      // Scroll the gallery track to the variant's featured_media slide so
      // the gallery shows the photo bound to this variant. The track is
      // initialized later in this section, so we resolve elements lazily.
      if (v.featured_media && v.featured_media.id != null) {
        var trackEl = $('[data-apgo-cc-gallery-track]', root);
        var targetSlide = null;
        if (trackEl) {
          var allSlides = $$('[data-apgo-cc-gallery-slide]', trackEl);
          for (var si = 0; si < allSlides.length; si++) {
            if (allSlides[si].getAttribute('data-apgo-cc-media-id') === String(v.featured_media.id)) {
              targetSlide = allSlides[si]; break;
            }
          }
          if (targetSlide) {
            var sIdx = parseInt(targetSlide.getAttribute('data-slide-index'), 10) || 0;
            trackEl.scrollTo({ left: sIdx * trackEl.clientWidth, behavior: 'smooth' });
          }
        }
        // Also flip thumb / dot active state immediately so the indicator
        // updates before the scroll-end debounce fires.
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

      // Scroll-spy via scroll listener (more predictable than IO for
      // short panels). Active = the LAST panel whose top has crossed
      // the sticky tab bar threshold. So even if the clicked panel is
      // shorter than half the viewport, its top staying at threshold
      // keeps it active rather than the next panel becoming active
      // just because the viewport center landed below its bottom.
      var panels = $$('[data-apgo-cc-panel]', tabsRoot);
      if (panels.length) {
        function updateActiveFromScroll() {
          // ~tab-bar height + 1px buffer so the first panel still wins
          // when scrolled exactly to its top
          var threshold = 60 + 1;
          var activeKey = panels[0].getAttribute('data-apgo-cc-panel');
          for (var i = 0; i < panels.length; i++) {
            var top = panels[i].getBoundingClientRect().top;
            if (top - threshold <= 0) {
              activeKey = panels[i].getAttribute('data-apgo-cc-panel');
            } else {
              break; // panels are ordered top-to-bottom in flow
            }
          }
          setActiveTab(activeKey);
        }
        var scrollTicking = false;
        window.addEventListener('scroll', function () {
          if (scrollTicking) return;
          scrollTicking = true;
          requestAnimationFrame(function () {
            updateActiveFromScroll();
            scrollTicking = false;
          });
        }, { passive: true });
        // Initial paint + after resize (panel heights can shift)
        updateActiveFromScroll();
        window.addEventListener('resize', updateActiveFromScroll);
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

    // ---------------- Gallery track (scroll-snap) ----------------
    // The gallery is a horizontal scroll track of all product.media slides.
    // Native scroll-snap handles finger-follow drag + momentum + snap.
    // JS responsibilities:
    //  1. Thumb / dot click → scrollIntoView the matching slide
    //  2. Variant chip change → scrollIntoView the variant's featured_media slide
    //  3. On scroll-end, detect which slide is centered → toggle:
    //     - data-apgo-cc-main-img attribute (so buybar / modal selectors
    //       always reference the currently-visible image)
    //     - thumb / dot is-active state
    //     - propagate to variant chip if that media is a variant's
    //       featured_media (mirrors the old click-to-swap behavior)
    var galleryTrack = $('[data-apgo-cc-gallery-track]', root);
    var slides = galleryTrack ? $$('[data-apgo-cc-gallery-slide]', galleryTrack) : [];

    function slideByMediaId(mediaId) {
      if (mediaId == null) return null;
      var id = String(mediaId);
      for (var i = 0; i < slides.length; i++) {
        if (slides[i].getAttribute('data-apgo-cc-media-id') === id) return slides[i];
      }
      return null;
    }

    function scrollToSlide(slide, smooth) {
      if (!slide || !galleryTrack) return;
      var idx = parseInt(slide.getAttribute('data-slide-index'), 10) || 0;
      // Use left offset rather than scrollIntoView to avoid scrolling the
      // whole page (scrollIntoView would also scroll the viewport vertically
      // to bring the gallery into view, which is not desired here).
      galleryTrack.scrollTo({
        left: idx * galleryTrack.clientWidth,
        behavior: smooth === false ? 'auto' : 'smooth'
      });
    }

    function setActiveSlide(slide) {
      if (!slide) return;
      slides.forEach(function (s) { s.classList.toggle('is-active', s === slide); });
      // Move data-apgo-cc-main-img to the active slide's <img> so external
      // selectors (buybar modal sync, etc.) read the currently-visible image.
      slides.forEach(function (s) {
        var img = $('img', s);
        if (!img) return;
        if (s === slide) img.setAttribute('data-apgo-cc-main-img', '');
        else img.removeAttribute('data-apgo-cc-main-img');
      });
      // Mirror to thumb / dot active state
      var activeMediaId = slide.getAttribute('data-apgo-cc-media-id');
      $$('[data-apgo-cc-thumb]', root).forEach(function (t) {
        t.classList.toggle('is-active', t.getAttribute('data-apgo-cc-media-id') === activeMediaId);
      });
    }

    function activeSlideFromScroll() {
      if (!galleryTrack || slides.length === 0) return null;
      var idx = Math.round(galleryTrack.scrollLeft / galleryTrack.clientWidth);
      idx = Math.max(0, Math.min(slides.length - 1, idx));
      return slides[idx];
    }

    function propagateActiveToChips(slide) {
      if (!slide) return;
      var mediaId = slide.getAttribute('data-apgo-cc-media-id');
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
      if (changed) {
        // Set a flag so updateUI() doesn't loop back into scrolling
        suppressScrollFromVariant = true;
        updateUI();
        suppressScrollFromVariant = false;
      }
    }

    // Scroll handler — split into two passes:
    //   1. Live tick (rAF-throttled): update thumb/dot/slide is-active class
    //      so the dot indicator follows the user's finger in real time
    //   2. Debounced settle (120ms after scroll stops): the heavier work —
    //      move data-apgo-cc-main-img attribute + propagate to variant chips
    //      (deferred because it triggers DOM mutations external code reads)
    var scrollDebounce;
    var scrollRaf = 0;
    var lastLiveSlide = null;
    var suppressScrollFromVariant = false;

    function setActiveSlideLive(slide) {
      // Cheap, idempotent — only flips class names, no attribute moves
      if (!slide || slide === lastLiveSlide) return;
      lastLiveSlide = slide;
      slides.forEach(function (s) { s.classList.toggle('is-active', s === slide); });
      var activeMediaId = slide.getAttribute('data-apgo-cc-media-id');
      $$('[data-apgo-cc-thumb]', root).forEach(function (t) {
        t.classList.toggle('is-active', t.getAttribute('data-apgo-cc-media-id') === activeMediaId);
      });
    }

    if (galleryTrack) {
      galleryTrack.addEventListener('scroll', function () {
        // Live indicator update — runs every scroll frame
        if (!scrollRaf) {
          scrollRaf = requestAnimationFrame(function () {
            scrollRaf = 0;
            var slide = activeSlideFromScroll();
            if (slide) setActiveSlideLive(slide);
          });
        }
        // Debounced settle — moves data-apgo-cc-main-img + chip propagation
        clearTimeout(scrollDebounce);
        scrollDebounce = setTimeout(function () {
          var slide = activeSlideFromScroll();
          if (!slide) return;
          setActiveSlide(slide); // moves data-apgo-cc-main-img attr
          if (!suppressScrollFromVariant) propagateActiveToChips(slide);
        }, 120);
      }, { passive: true });
    }

    // Thumb / dot click → scroll the track to the matching slide
    $$('[data-apgo-cc-thumb]', root).forEach(function (thumb) {
      thumb.addEventListener('click', function () {
        var mediaId = thumb.getAttribute('data-apgo-cc-media-id');
        var slide = slideByMediaId(mediaId);
        if (slide) scrollToSlide(slide, true);
      });
    });

    // Re-snap on viewport resize so we stay aligned to a slide boundary
    window.addEventListener('resize', function () {
      var slide = activeSlideFromScroll();
      if (slide) scrollToSlide(slide, false);
    });

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
      // Horizon's ThemeEvents.cartUpdate ('cart:update'). cart-icon.js
      // listens here and reads event.detail.data.itemCount. Build the
      // event directly with the same shape CartUpdateEvent would (no
      // dynamic import('@theme/events') — that fails silently in many
      // Shopify CDN setups and the badge stayed hidden).
      document.dispatchEvent(new CustomEvent('cart:update', {
        bubbles: true,
        detail: {
          resource: cart,
          sourceId: 'apgo-cc-pdp',
          data: {
            itemCount: cart.item_count,
            source: 'apgo-cc-pdp'
          }
        }
      }));
      // Non-Horizon events kept for any other listeners that wired in
      document.documentElement.dispatchEvent(new CustomEvent('cart:refresh', { bubbles: true, detail: { cart: cart } }));
      document.dispatchEvent(new CustomEvent('cart:updated', { detail: { cart: cart } }));
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
