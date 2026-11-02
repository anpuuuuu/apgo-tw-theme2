/* APGO · 活動彈窗 — opens the popup rendered by sections/apgo-campaign-popup.liquid
 * once per browsing session, on the first page that has it. The image is
 * loaded before the popup opens, so it never shows up empty.
 *
 * In the theme editor it opens while its section is selected instead.
 * Views, clicks and closes are pushed to dataLayer and Shopify customer events
 * as apgo_campaign_popup_view / apgo_campaign_popup_click / apgo_campaign_popup_close.
 */
(function () {
  'use strict';

  var SESSION_KEY = 'apgo-campaign-popup:shown';
  var IMAGE_WAIT_MS = 2500;

  function shownThisSession() {
    try {
      return sessionStorage.getItem(SESSION_KEY) === 'true';
    } catch (e) {
      return false;
    }
  }

  function markShownThisSession() {
    try {
      sessionStorage.setItem(SESSION_KEY, 'true');
    } catch (e) {}
  }

  function track(name, payload) {
    try {
      (window.dataLayer = window.dataLayer || []).push(Object.assign({ event: name }, payload));
    } catch (e) { /* analytics must never break the popup */ }
    try {
      if (window.Shopify && window.Shopify.analytics && typeof window.Shopify.analytics.publish === 'function') {
        window.Shopify.analytics.publish(name, payload);
      }
    } catch (e) { /* ditto */ }
  }

  function lockScroll(lock) {
    document.documentElement.style.overflow = lock ? 'hidden' : '';
    document.body.style.overflow = lock ? 'hidden' : '';
  }

  // Calls back once the image has loaded, failed, or IMAGE_WAIT_MS has passed.
  function whenImageReady(img, callback) {
    var done = false;
    function go() {
      if (done) return;
      done = true;
      callback();
    }
    if (!img) return go();
    img.loading = 'eager';
    if (img.complete && img.naturalWidth) return go();
    img.addEventListener('load', go, { once: true });
    img.addEventListener('error', go, { once: true });
    window.setTimeout(go, IMAGE_WAIT_MS);
  }

  function setup(root) {
    if (root.apgoCampaignPopup) return root.apgoCampaignPopup;

    var sheet = root.querySelector('.apgo-cp__sheet');
    var designMode = root.hasAttribute('data-design-mode');
    var payload = { campaign: root.getAttribute('data-campaign') || '' };
    var lastFocus = null;

    function isOpen() {
      return root.classList.contains('is-open');
    }

    function open() {
      if (isOpen()) return;
      lastFocus = document.activeElement;
      root.classList.add('is-open');
      root.setAttribute('aria-hidden', 'false');
      lockScroll(true);
      window.setTimeout(function () {
        if (sheet) sheet.focus();
      }, 60);
      if (!designMode) {
        markShownThisSession();
        track('apgo_campaign_popup_view', payload);
      }
    }

    function close(how) {
      if (!isOpen()) return;
      root.classList.remove('is-open');
      root.setAttribute('aria-hidden', 'true');
      lockScroll(false);
      if (lastFocus && typeof lastFocus.focus === 'function') lastFocus.focus();
      if (!designMode && how) track('apgo_campaign_popup_close', Object.assign({ how: how }, payload));
    }

    root.querySelectorAll('[data-apgo-cp-close]').forEach(function (button) {
      var how = button.classList.contains('apgo-cp__dismiss') ? 'dismiss'
        : button.classList.contains('apgo-cp__close') ? 'x' : 'backdrop';
      button.addEventListener('click', function () { close(how); });
    });

    root.querySelectorAll('[data-apgo-cp-link]').forEach(function (link) {
      link.addEventListener('click', function () {
        if (designMode) return;
        track('apgo_campaign_popup_click', Object.assign({
          target: link.getAttribute('data-apgo-cp-link'),
          url: link.href
        }, payload));
      });
    });

    document.addEventListener('keydown', function (event) {
      if (event.key === 'Escape' && isOpen()) close('escape');
    });

    root.apgoCampaignPopup = { open: open, close: close };
    return root.apgoCampaignPopup;
  }

  function findRoot(sectionId) {
    return document.querySelector('[data-apgo-campaign-popup][data-section-id="' + sectionId + '"]');
  }

  function init() {
    var root = document.querySelector('[data-apgo-campaign-popup]');
    if (!root) return;
    var popup = setup(root);
    if (root.hasAttribute('data-design-mode') || shownThisSession()) return;
    whenImageReady(root.querySelector('.apgo-cp__media img'), popup.open);
  }

  // Theme editor: show the popup while its section is being edited.
  document.addEventListener('shopify:section:select', function (event) {
    var root = findRoot(event.detail.sectionId);
    if (root) setup(root).open();
  });
  document.addEventListener('shopify:section:load', function (event) {
    var root = findRoot(event.detail.sectionId);
    if (root) setup(root).open();
  });
  document.addEventListener('shopify:section:deselect', function (event) {
    var root = findRoot(event.detail.sectionId);
    if (root) setup(root).close();
  });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
