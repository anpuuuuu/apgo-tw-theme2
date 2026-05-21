(function () {
  'use strict';

  var STORAGE_DEFAULT = 'apgo-newsletter-state';
  var SESSION_SUFFIX = ':shown';
  var PENDING_EMAIL_SUFFIX = ':pending-email';
  var SUCCESS_CLOSE_MS = 8000;

  function nowSeconds() {
    return Math.floor(Date.now() / 1000);
  }

  function readState(key) {
    try {
      var raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      return null;
    }
  }

  function writeState(key, state) {
    try {
      localStorage.setItem(key, JSON.stringify(state));
    } catch (e) {}
  }

  function wasShownThisSession(key) {
    try {
      return sessionStorage.getItem(key) === 'true';
    } catch (e) {
      return false;
    }
  }

  function markShownThisSession(key) {
    try {
      sessionStorage.setItem(key, 'true');
    } catch (e) {}
  }

  function canShow(state, sessionKey) {
    if (state.status === 'subscribed') return false;
    return !wasShownThisSession(sessionKey);
  }

  function looksLikeEmail(value) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
  }

  function hasCustomerPosted() {
    return window.location.search.indexOf('customer_posted=true') !== -1;
  }

  document.addEventListener('DOMContentLoaded', function () {
    var root = document.querySelector('[data-apgo-newsletter]');
    if (!root) return;

    var storageKey = root.getAttribute('data-storage-key') || STORAGE_DEFAULT;
    var sessionKey = storageKey + SESSION_SUFFIX;
    var pendingEmailKey = storageKey + PENDING_EMAIL_SUFFIX;
    var postedSuccessfully = hasCustomerPosted();

    if (!postedSuccessfully && !canShow(readState(storageKey) || {}, sessionKey)) return;

    var sheet = root.querySelector('.apgo-cc-newsletter__sheet');
    var formView = root.querySelector('[data-apgo-newsletter-form-view]');
    var successView = root.querySelector('[data-apgo-newsletter-success-view]');
    var form = root.querySelector('.apgo-cc-newsletter__form');
    var email = root.querySelector('[data-apgo-newsletter-email]');
    var consent = root.querySelector('[data-apgo-newsletter-consent]');
    var submit = root.querySelector('[data-apgo-newsletter-submit]');
    var error = root.querySelector('[data-apgo-newsletter-error]');
    var successTitle = root.querySelector('[data-apgo-newsletter-success-title]');
    var successCopy = root.querySelector('[data-apgo-newsletter-success-copy]');
    var lastFocus = null;
    var closeTimer = null;

    function setError(message) {
      if (!error) return;
      error.textContent = message || '';
      error.hidden = !message;
    }

    function setLoading(isLoading) {
      if (!submit) return;
      submit.disabled = isLoading;
      submit.textContent = isLoading ? '處理中...' : submit.getAttribute('data-original-label');
    }

    function lockScroll(lock) {
      document.documentElement.style.overflow = lock ? 'hidden' : '';
      document.body.style.overflow = lock ? 'hidden' : '';
    }

    function open() {
      lastFocus = document.activeElement;
      markShownThisSession(sessionKey);
      root.classList.add('is-open');
      root.setAttribute('aria-hidden', 'false');
      lockScroll(true);
      window.setTimeout(function () {
        if (email) email.focus();
        else if (sheet) sheet.focus();
      }, 60);
    }

    function close(rememberDismiss) {
      if (rememberDismiss) markShownThisSession(sessionKey);

      window.clearTimeout(closeTimer);
      root.classList.remove('is-open');
      root.setAttribute('aria-hidden', 'true');
      lockScroll(false);
      if (lastFocus && typeof lastFocus.focus === 'function') lastFocus.focus();
    }

    function showSuccess(address, alreadySubscribed) {
      writeState(storageKey, {
        status: 'subscribed',
        count: 1,
        ts: nowSeconds()
      });
      try {
        sessionStorage.removeItem(pendingEmailKey);
      } catch (e) {}

      setError('');
      if (formView) formView.hidden = true;
      if (successView) successView.hidden = false;
      if (successTitle && alreadySubscribed) successTitle.textContent = '您已訂閱 ✓';
      if (successCopy) {
        successCopy.textContent = alreadySubscribed
          ? '我們會持續把新品與優惠通知寄給您。'
          : (address ? '最新優惠會寄到 ' + address : '最新優惠會寄到您的信箱。');
      }
      closeTimer = window.setTimeout(function () { close(false); }, SUCCESS_CLOSE_MS);
    }

    if (submit) submit.setAttribute('data-original-label', submit.textContent);

    if (postedSuccessfully) {
      var pendingAddress = '';
      try {
        pendingAddress = sessionStorage.getItem(pendingEmailKey) || '';
      } catch (e) {}
      open();
      showSuccess(pendingAddress, false);
      return;
    }

    root.querySelectorAll('[data-apgo-newsletter-dismiss]').forEach(function (button) {
      button.addEventListener('click', function () { close(true); });
    });

    root.querySelectorAll('[data-apgo-newsletter-close-success]').forEach(function (button) {
      button.addEventListener('click', function () { close(false); });
    });

    document.addEventListener('keydown', function (event) {
      if (event.key === 'Escape' && root.classList.contains('is-open')) close(true);
    });

    if (form) {
      form.addEventListener('submit', function (event) {
        setError('');

        var address = email ? email.value.trim() : '';
        if (!address) {
          event.preventDefault();
          if (email && typeof email.reportValidity === 'function') email.reportValidity();
          return;
        }

        if (!looksLikeEmail(address)) {
          event.preventDefault();
          setError('請輸入有效 email');
          if (email) email.focus();
          return;
        }

        if (!consent || !consent.checked) {
          event.preventDefault();
          setError('請同意條款後再訂閱');
          if (consent) consent.focus();
          return;
        }

        try {
          sessionStorage.setItem(pendingEmailKey, address);
        } catch (e) {}
        setLoading(true);
      });
    }

    open();
  });
})();
