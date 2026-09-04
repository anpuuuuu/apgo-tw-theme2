/* APGO shared quick add
 *
 * Used by collection/search product cards and the homepage best-seller cards.
 * - Single variant: add immediately.
 * - Multiple variants/options: open one reusable option picker.
 * - Successful add: show a toast, fly an APGO parcel SVG to the visible cart
 *   icon on a quadratic Bezier path, then publish the authoritative cart count.
 */
(function () {
  'use strict';

  function $(selector, context) {
    return (context || document).querySelector(selector);
  }

  function $$(selector, context) {
    return Array.prototype.slice.call((context || document).querySelectorAll(selector));
  }

  var routesRoot = (window.Shopify && window.Shopify.routes && window.Shopify.routes.root) || '/';
  var productCache = Object.create(null);
  var toastEl = null;
  var modal = null;
  var previousBodyOverflow = '';
  var modalState = {
    product: null,
    variant: null,
    trigger: null,
    previousFocus: null
  };

  function formatMoney(cents) {
    if (window.Shopify && typeof window.Shopify.formatMoney === 'function') {
      var format = (window.theme && window.theme.moneyFormat) || 'NT${{amount}}';
      try {
        return window.Shopify.formatMoney(cents, format);
      } catch (_) {}
    }

    return 'NT$ ' + (Number(cents) / 100).toLocaleString('zh-TW', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    });
  }

  function setButtonLoading(button, isLoading) {
    if (!button) return;

    if (isLoading) {
      if (!button.dataset.apgoOriginalHtml) button.dataset.apgoOriginalHtml = button.innerHTML;
      button.classList.add('is-loading');
      button.disabled = true;
      var label = button.querySelector('.add-to-cart-text');
      if (label) label.textContent = '加入中…';
    } else {
      button.classList.remove('is-loading');
      button.disabled = false;
      if (button.dataset.apgoOriginalHtml) {
        button.innerHTML = button.dataset.apgoOriginalHtml;
        delete button.dataset.apgoOriginalHtml;
      }
    }
  }

  function showToast(message, ok) {
    if (!toastEl) {
      toastEl = document.createElement('div');
      toastEl.className = 'apgo-cc-toast';
      toastEl.setAttribute('role', 'status');
      toastEl.setAttribute('aria-live', 'polite');
      toastEl.setAttribute('aria-atomic', 'true');
      document.body.appendChild(toastEl);
    }

    toastEl.textContent = message;
    toastEl.classList.toggle('apgo-cc-toast--err', ok === false);
    toastEl.classList.add('is-visible');
    clearTimeout(toastEl._apgoTimer);
    toastEl._apgoTimer = setTimeout(function () {
      toastEl.classList.remove('is-visible');
    }, 2600);
  }

  function addToCart(variantId, quantity) {
    return fetch(routesRoot + 'cart/add.js', {
      method: 'POST',
      credentials: 'same-origin',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json'
      },
      body: JSON.stringify({ id: variantId, quantity: quantity || 1 })
    }).then(function (response) {
      if (response.ok) return response.json();
      return response.json().catch(function () { return {}; }).then(function (error) {
        throw error;
      });
    });
  }

  function fetchCart() {
    return fetch(routesRoot + 'cart.js', {
      credentials: 'same-origin',
      headers: { Accept: 'application/json' }
    }).then(function (response) {
      if (!response.ok) throw new Error('Cart request failed');
      return response.json();
    });
  }

  function publishCart(cart) {
    if (!cart || typeof cart.item_count !== 'number') return;

    var detail = {
      cart: cart,
      resource: cart,
      data: {
        itemCount: cart.item_count,
        item_count: cart.item_count,
        source: 'apgo-quick-add'
      }
    };

    document.dispatchEvent(new CustomEvent('cart:update', {
      bubbles: true,
      detail: detail
    }));
    document.dispatchEvent(new CustomEvent('cart:updated', {
      detail: { cart: cart }
    }));
  }

  function visibleCartIcon() {
    return $$('.header-actions__cart-icon').find(function (icon) {
      var rect = icon.getBoundingClientRect();
      var style = window.getComputedStyle(icon);
      return rect.width > 0 && rect.height > 0 && style.display !== 'none' && style.visibility !== 'hidden';
    }) || null;
  }

  function elementCenter(element) {
    if (!element || typeof element.getBoundingClientRect !== 'function') return null;
    var rect = element.getBoundingClientRect();
    if (!rect.width || !rect.height) return null;
    return {
      x: rect.left + rect.width / 2,
      y: rect.top + rect.height / 2
    };
  }

  function flyParcelToCart(origin) {
    return new Promise(function (resolve) {
      var cartIcon = visibleCartIcon();
      var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      if (!origin || !cartIcon || reduceMotion) {
        resolve();
        return;
      }

      var targetRect = cartIcon.getBoundingClientRect();
      if (!targetRect.width || !targetRect.height) {
        resolve();
        return;
      }

      var start = origin;
      var end = {
        x: targetRect.left + targetRect.width / 2,
        y: targetRect.top + targetRect.height / 2
      };
      var deltaX = end.x - start.x;
      var deltaY = end.y - start.y;
      var arcLift = Math.min(140, Math.max(62, Math.abs(deltaX) * 0.09));
      var control = {
        x: start.x + deltaX * 0.34,
        y: start.y + deltaY * 0.16 - arcLift
      };

      var parcel = document.createElement('span');
      parcel.className = 'apgo-quick-add-fly';
      parcel.setAttribute('aria-hidden', 'true');
      parcel.innerHTML = [
        '<svg viewBox="0 0 48 48" focusable="false">',
        '  <circle cx="24" cy="24" r="22" fill="#ff6b1a"/>',
        '  <path d="M14 23h20v13H14z" fill="none" stroke="#fff" stroke-width="2.4" stroke-linejoin="round"/>',
        '  <path d="M11.5 18.5h25V24h-25zM24 18.5V36" fill="none" stroke="#fff" stroke-width="2.4" stroke-linejoin="round"/>',
        '  <path d="M24 18.5c-3.4 0-7.5-.7-7.5-4 0-1.7 1.3-3 3-3 2.8 0 4.5 3.2 4.5 7Zm0 0c3.4 0 7.5-.7 7.5-4 0-1.7-1.3-3-3-3-2.8 0-4.5 3.2-4.5 7Z" fill="none" stroke="#fff" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>',
        '</svg>'
      ].join('');
      document.body.appendChild(parcel);

      var duration = 720;
      var direction = deltaX >= 0 ? 1 : -1;
      var keyframes = [];
      var frameCount = 28;

      for (var frameIndex = 0; frameIndex <= frameCount; frameIndex += 1) {
        var pathProgress = frameIndex / frameCount;
        var inverse = 1 - pathProgress;
        var x = inverse * inverse * start.x + 2 * inverse * pathProgress * control.x + pathProgress * pathProgress * end.x;
        var y = inverse * inverse * start.y + 2 * inverse * pathProgress * control.y + pathProgress * pathProgress * end.y;
        var scale = 1 - pathProgress * 0.7;
        var rotation = direction * Math.sin(Math.PI * pathProgress) * 18;
        var opacity = pathProgress > 0.78 ? Math.max(0, 1 - (pathProgress - 0.78) / 0.22) : 1;

        keyframes.push({
          offset: pathProgress,
          transform: 'translate3d(' + (x - 22) + 'px,' + (y - 22) + 'px,0) scale(' + scale + ') rotate(' + rotation + 'deg)',
          opacity: opacity
        });
      }

      if (typeof parcel.animate !== 'function') {
        parcel.remove();
        resolve();
        return;
      }

      var animation = parcel.animate(keyframes, {
        duration: duration,
        easing: 'cubic-bezier(0.42, 0, 1, 1)',
        fill: 'forwards'
      });

      var minimumLifetime = new Promise(function (done) {
        setTimeout(done, duration);
      });

      Promise.all([
        animation.finished.catch(function () {}),
        minimumLifetime
      ]).then(function () {
        parcel.remove();
        resolve();
      });
    });
  }

  function completeSuccessfulAdd(origin, quantity) {
    showToast(quantity > 1 ? '已加入 ' + quantity + ' 件商品' : '已加入購物車', true);

    return Promise.all([
      flyParcelToCart(origin),
      fetchCart().catch(function () { return null; })
    ]).then(function (results) {
      publishCart(results[1]);
    });
  }

  function buildProductJsonUrl(value) {
    var href = typeof value === 'string' ? value : value && value.href;
    if (!href) return null;

    try {
      var url = new URL(href, window.location.origin);
      var path = url.pathname.replace(/\/$/, '').replace(/\.js$/, '');
      if (path.indexOf('/products/') === -1) return null;
      return url.origin + path + '.js';
    } catch (_) {
      return null;
    }
  }

  function fetchProduct(jsonUrl) {
    if (productCache[jsonUrl]) return Promise.resolve(productCache[jsonUrl]);

    return fetch(jsonUrl, {
      credentials: 'same-origin',
      headers: { Accept: 'application/json' }
    })
      .then(function (response) {
        if (!response.ok) throw new Error('Product request failed');
        return response.json();
      })
      .then(function (product) {
        if (!product || !Array.isArray(product.variants)) throw new Error('Product variants missing');
        productCache[jsonUrl] = product;
        return product;
      });
  }

  function optionName(option) {
    if (typeof option === 'string') return option;
    if (option && typeof option === 'object') return option.name || '';
    return String(option || '');
  }

  function hasMeaningfulChoices(product) {
    var names = (product.options || []).map(optionName);
    var meaningfulOption = names.some(function (name) {
      return String(name).toLowerCase() !== 'title';
    });
    return product.variants.length > 1 || meaningfulOption;
  }

  function normaliseOptions(options, variants) {
    if (!options || !options.length) return [];

    return options.map(function (option, index) {
      var name = optionName(option) || '選項 ' + (index + 1);
      var values = typeof option === 'object' && option && Array.isArray(option.values) ? option.values.slice() : [];

      variants.forEach(function (variant) {
        var value = variant.options[index];
        if (value != null && values.indexOf(value) === -1) values.push(value);
      });

      return { name: name, values: values };
    });
  }

  function productImage(product, variant) {
    if (variant && variant.featured_image) {
      return variant.featured_image.src || variant.featured_image.url || '';
    }
    if (typeof product.featured_image === 'string') return product.featured_image;
    if (product.featured_image) return product.featured_image.src || product.featured_image.url || '';
    return '';
  }

  function buildModal() {
    if (modal) return modal;

    modal = document.createElement('div');
    modal.className = 'apgo-cc-qa-modal';
    modal.setAttribute('aria-hidden', 'true');
    modal.innerHTML = [
      '<div class="apgo-cc-qa-modal__overlay" data-qa-close></div>',
      '<div class="apgo-cc-qa-modal__dialog" role="dialog" aria-modal="true" aria-labelledby="apgo-cc-qa-title">',
      '  <button type="button" class="apgo-cc-qa-modal__close" data-qa-close aria-label="關閉規格選擇">×</button>',
      '  <div class="apgo-cc-qa-modal__body">',
      '    <div class="apgo-cc-qa-modal__top">',
      '      <div class="apgo-cc-qa-modal__media"><img class="apgo-cc-qa-modal__img" data-qa-img alt=""></div>',
      '      <div class="apgo-cc-qa-modal__info">',
      '        <p class="apgo-cc-qa-modal__eyebrow">選擇商品規格</p>',
      '        <h3 class="apgo-cc-qa-modal__title" id="apgo-cc-qa-title" data-qa-title></h3>',
      '        <div class="apgo-cc-qa-modal__price" data-qa-price></div>',
      '      </div>',
      '    </div>',
      '    <div class="apgo-cc-qa-modal__options" data-qa-options></div>',
      '    <div class="apgo-cc-qa-modal__footer">',
      '      <div class="apgo-cc-qa-modal__qty">',
      '        <button type="button" data-qa-qty="-1" aria-label="減少數量">−</button>',
      '        <input type="number" value="1" min="1" inputmode="numeric" data-qa-qty-input aria-label="商品數量">',
      '        <button type="button" data-qa-qty="1" aria-label="增加數量">+</button>',
      '      </div>',
      '      <button type="button" class="apgo-cc-qa-modal__cta" data-qa-add>加入購物車</button>',
      '    </div>',
      '  </div>',
      '</div>'
    ].join('');
    document.body.appendChild(modal);

    $$('[data-qa-close]', modal).forEach(function (element) {
      element.addEventListener('click', closeModal);
    });

    $$('[data-qa-qty]', modal).forEach(function (button) {
      button.addEventListener('click', function () {
        var input = $('[data-qa-qty-input]', modal);
        var value = parseInt(input.value, 10) || 1;
        input.value = Math.max(1, value + parseInt(button.dataset.qaQty, 10));
      });
    });

    $('[data-qa-add]', modal).addEventListener('click', function () {
      var variant = modalState.variant;
      if (!variant || !variant.available) return;

      var cta = $('[data-qa-add]', modal);
      var quantity = Math.max(1, parseInt($('[data-qa-qty-input]', modal).value, 10) || 1);
      var flyOrigin = elementCenter(cta);
      cta.disabled = true;
      cta.textContent = '加入中…';

      addToCart(variant.id, quantity)
        .then(function () {
          cta.textContent = '已加入 ✓';
          return completeSuccessfulAdd(flyOrigin, quantity);
        })
        .then(function () {
          closeModal();
        })
        .catch(function (error) {
          cta.disabled = false;
          cta.textContent = '加入購物車';
          showToast((error && error.description) || '加入失敗，請稍後再試', false);
        });
    });

    return modal;
  }

  function selectedModalOptions() {
    return $$('.apgo-cc-qa-modal__opt-group', modal).map(function (group) {
      var active = $('.apgo-cc-qa-modal__chip.is-active', group);
      return active ? active.dataset.val : null;
    });
  }

  function updateModalVariant() {
    if (!modalState.product) return;

    var selected = selectedModalOptions();
    var match = modalState.product.variants.find(function (variant) {
      return variant.options.every(function (value, index) {
        return selected[index] == null || selected[index] === value;
      });
    }) || null;

    modalState.variant = match;
    var cta = $('[data-qa-add]', modal);
    var image = $('[data-qa-img]', modal);

    if (!match) {
      $('[data-qa-price]', modal).textContent = '此規格組合不存在';
      cta.disabled = true;
      cta.textContent = '此組合不可選';
      return;
    }

    var imageUrl = productImage(modalState.product, match);
    if (imageUrl) image.src = imageUrl;

    if (match.compare_at_price && match.compare_at_price > match.price) {
      $('[data-qa-price]', modal).innerHTML =
        '<span class="apgo-cc-qa-modal__price-current">' + formatMoney(match.price) + '</span>' +
        '<span class="apgo-cc-qa-modal__price-compare">' + formatMoney(match.compare_at_price) + '</span>';
    } else {
      $('[data-qa-price]', modal).innerHTML =
        '<span class="apgo-cc-qa-modal__price-current">' + formatMoney(match.price) + '</span>';
    }

    cta.disabled = !match.available;
    cta.textContent = match.available ? '加入購物車' : '已售完';
  }

  function openModal(product, trigger) {
    buildModal();
    var firstAvailable = product.variants.find(function (variant) { return variant.available; }) || product.variants[0];
    var options = normaliseOptions(product.options, product.variants);
    var skipDefaultTitle = options.length === 1 && String(options[0].name).toLowerCase() === 'title';

    modalState.product = product;
    modalState.variant = firstAvailable;
    modalState.trigger = trigger;
    modalState.previousFocus = document.activeElement;

    $('[data-qa-title]', modal).textContent = product.title;
    var image = $('[data-qa-img]', modal);
    image.src = productImage(product, firstAvailable);
    image.alt = product.title;

    var optionsRoot = $('[data-qa-options]', modal);
    optionsRoot.innerHTML = '';

    if (!skipDefaultTitle) {
      options.forEach(function (option, optionIndex) {
        var group = document.createElement('fieldset');
        group.className = 'apgo-cc-qa-modal__opt-group';

        var legend = document.createElement('legend');
        legend.className = 'apgo-cc-qa-modal__opt-name';
        legend.textContent = option.name;
        group.appendChild(legend);

        var chips = document.createElement('div');
        chips.className = 'apgo-cc-qa-modal__opt-chips';
        option.values.forEach(function (value) {
          var chip = document.createElement('button');
          chip.type = 'button';
          chip.className = 'apgo-cc-qa-modal__chip';
          chip.textContent = value;
          chip.dataset.opt = String(optionIndex);
          chip.dataset.val = value;
          chip.setAttribute('aria-pressed', String(firstAvailable.options[optionIndex] === value));

          if (firstAvailable.options[optionIndex] === value) chip.classList.add('is-active');

          chip.addEventListener('click', function () {
            $$('.apgo-cc-qa-modal__chip', chips).forEach(function (other) {
              var active = other === chip;
              other.classList.toggle('is-active', active);
              other.setAttribute('aria-pressed', String(active));
            });
            updateModalVariant();
          });
          chips.appendChild(chip);
        });

        group.appendChild(chips);
        optionsRoot.appendChild(group);
      });
    }

    $('[data-qa-qty-input]', modal).value = 1;
    updateModalVariant();
    previousBodyOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    modal.classList.add('is-open');
    modal.setAttribute('aria-hidden', 'false');
    $('[data-qa-close]', modal).focus();
  }

  function closeModal() {
    if (!modal || !modal.classList.contains('is-open')) return;

    modal.classList.remove('is-open');
    modal.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = previousBodyOverflow;

    var previousFocus = modalState.previousFocus;
    modalState.product = null;
    modalState.variant = null;
    modalState.trigger = null;
    modalState.previousFocus = null;

    if (previousFocus && typeof previousFocus.focus === 'function') previousFocus.focus();
  }

  function handleModalKeyboard(event) {
    if (!modal || !modal.classList.contains('is-open')) return;
    if (event.key === 'Escape') {
      closeModal();
      return;
    }
    if (event.key !== 'Tab') return;

    var focusable = $$('button:not([disabled]), input:not([disabled])', modal);
    if (!focusable.length) return;
    var first = focusable[0];
    var last = focusable[focusable.length - 1];

    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  function openQuickAdd(jsonUrl, trigger) {
    if (!jsonUrl || !trigger || trigger.classList.contains('is-loading')) return;

    var flyOrigin = elementCenter(trigger);
    setButtonLoading(trigger, true);
    fetchProduct(jsonUrl)
      .then(function (product) {
        if (hasMeaningfulChoices(product)) {
          setButtonLoading(trigger, false);
          openModal(product, trigger);
          return;
        }

        var variant = product.variants[0];
        if (!variant || !variant.available) {
          setButtonLoading(trigger, false);
          showToast('商品已售完', false);
          return;
        }

        return addToCart(variant.id, 1)
          .then(function () {
            return completeSuccessfulAdd(flyOrigin, 1);
          })
          .then(function () {
            setButtonLoading(trigger, false);
          });
      })
      .catch(function (error) {
        setButtonLoading(trigger, false);
        showToast((error && error.description) || '讀取商品失敗，請至商品頁加入', false);
      });
  }

  function bindTrigger(button) {
    if (!button || button.dataset.apgoQuickAddBound === 'true') return;

    var jsonUrl = button.dataset.jsonUrl || buildProductJsonUrl(button.dataset.productUrl);
    if (!jsonUrl) return;

    button.dataset.jsonUrl = jsonUrl;
    button.dataset.apgoQuickAddBound = 'true';
    button.addEventListener('click', function (event) {
      event.preventDefault();
      event.stopPropagation();
      openQuickAdd(jsonUrl, button);
    });
  }

  function bindHomepageButtons(root) {
    $$('[data-apgo-quick-add-trigger]', root || document).forEach(bindTrigger);
  }

  function injectCollectionButtons(root) {
    $$('.product-card', root || document).forEach(function (card) {
      if (card.dataset.apgoQuickAddReady === 'true') return;

      var link = card.querySelector('a[href*="/products/"]');
      var jsonUrl = buildProductJsonUrl(link);
      if (!jsonUrl) return;

      var button = document.createElement('button');
      button.type = 'button';
      button.className = 'apgo-cc-quick-add';
      button.dataset.jsonUrl = jsonUrl;
      button.setAttribute('aria-label', '選擇規格並加入購物車');
      button.innerHTML = '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" aria-hidden="true"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>';

      bindTrigger(button);
      card.appendChild(button);
      card.dataset.apgoQuickAddReady = 'true';
    });
  }

  function boot(root) {
    bindHomepageButtons(root || document);
    if (document.body.classList.contains('apgo-cc-skin')) {
      injectCollectionButtons(root || document);
    }
  }

  document.addEventListener('keydown', handleModalKeyboard);

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { boot(document); });
  } else {
    boot(document);
  }

  if (window.Shopify && window.Shopify.designMode) {
    document.addEventListener('shopify:section:load', function (event) {
      boot(event.target);
    });
  }

  var observer = new MutationObserver(function (mutations) {
    var needsRefresh = mutations.some(function (mutation) {
      return Array.prototype.some.call(mutation.addedNodes, function (node) {
        return node.nodeType === 1 && (
          node.matches && node.matches('.product-card, [data-apgo-quick-add-trigger]') ||
          node.querySelector && node.querySelector('.product-card, [data-apgo-quick-add-trigger]')
        );
      });
    });
    if (needsRefresh) boot(document);
  });

  observer.observe(document.body, { childList: true, subtree: true });
})();
