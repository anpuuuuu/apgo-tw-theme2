/**
 * APGO · 購物體驗調查 (sections/apgo-survey.liquid)
 *
 * The entry opens a three-question survey on the page. Answers are kept on
 * this device until sent, so closing and reopening loses nothing. Sending goes
 * to the App Proxy (/apps/survey/…), which answers with the reward state:
 *   issued   signed in, first time: show the code
 *   login    not signed in: offer 登入領取; after signing in the page comes
 *            back with ?apgo_survey=claim and the reward is claimed here
 *   already  this member had the reward before: show their code again
 *   failed   saved, but the reward could not be given yet (the worker retries)
 *
 * ?apgo_survey_preview=issued|login|already|failed|error|hint shows a state
 * without sending anything, for checking the copy on the live theme.
 *
 * Events go to dataLayer and Shopify customer events as apgo_survey_*.
 */
(function () {
  'use strict';

  var root = document.querySelector('[data-apgo-survey]');
  if (!root) return;

  var campaign = root.getAttribute('data-campaign') || 'survey';
  var endpoint = (root.getAttribute('data-endpoint') || '/apps/survey').replace(/\/$/, '');
  var loggedIn = root.getAttribute('data-logged-in') === 'true';
  var hintDelay = (parseInt(root.getAttribute('data-hint-delay'), 10) || 30) * 1000;
  var designMode = root.hasAttribute('data-design-mode');

  var params = new URLSearchParams(window.location.search);
  var preview = params.get('apgo_survey_preview') || root.getAttribute('data-preview') || '';

  var STORE_KEY = 'apgo-survey:' + campaign;
  var CLIENT_KEY = 'apgo-survey:client';
  var SESSION_COLLAPSED = 'apgo-survey:collapsed';
  var SESSION_HINT = 'apgo-survey:hinted';

  var launcher = root.querySelector('[data-apgo-sv-launcher]');
  var hint = root.querySelector('[data-apgo-sv-hint]');
  var layer = root.querySelector('[data-apgo-sv-layer]');
  var panel = root.querySelector('.apgo-sv__panel');
  var body = root.querySelector('[data-apgo-sv-body]');
  var done = root.querySelector('[data-apgo-sv-done]');
  var form = root.querySelector('[data-apgo-sv-form]');
  var steps = Array.prototype.slice.call(root.querySelectorAll('.apgo-sv__step'));
  var prevBtn = root.querySelector('[data-apgo-sv-prev]');
  var nextBtn = root.querySelector('[data-apgo-sv-next]');
  var submitBtn = root.querySelector('[data-apgo-sv-submit]');
  var bar = root.querySelector('[data-apgo-sv-bar]');
  var count = root.querySelector('[data-apgo-sv-count]');
  var otherInput = root.querySelector('[data-apgo-sv-other]');
  var q3 = root.querySelector('[data-apgo-sv-q3]');
  var chars = root.querySelector('[data-apgo-sv-chars]');
  var sendError = root.querySelector('[data-apgo-sv-send-error]');
  var claimedNote = root.querySelector('[data-apgo-sv-claimed]');

  var step = 1;
  var lastFocus = null;
  var hintTimer = null;
  var statusChecked = false;
  var sending = false;

  /* ---------- storage (any of it may be blocked) ---------- */

  function readJSON(store, key) {
    try { return JSON.parse(store.getItem(key) || 'null'); } catch (e) { return null; }
  }
  function writeJSON(store, key, value) {
    try { store.setItem(key, JSON.stringify(value)); } catch (e) { /* private mode */ }
  }
  function flag(store, key) {
    try { return store.getItem(key) === '1'; } catch (e) { return false; }
  }
  function setFlag(store, key) {
    try { store.setItem(key, '1'); } catch (e) { /* private mode */ }
  }

  function clientId() {
    var id = null;
    try { id = localStorage.getItem(CLIENT_KEY); } catch (e) { /* ignore */ }
    if (!id) {
      id = (window.crypto && crypto.randomUUID) ? crypto.randomUUID()
        : 'c' + Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
      try { localStorage.setItem(CLIENT_KEY, id); } catch (e) { /* ignore */ }
    }
    return id;
  }

  var saved = readJSON(localStorage, STORE_KEY) || {};
  function save() { writeJSON(localStorage, STORE_KEY, saved); }

  /* ---------- events ---------- */

  function track(name, payload) {
    payload = Object.assign({ campaign: campaign, page: root.getAttribute('data-page') }, payload || {});
    try { (window.dataLayer = window.dataLayer || []).push(Object.assign({ event: name }, payload)); } catch (e) { /* ignore */ }
    try {
      if (window.Shopify && Shopify.analytics && typeof Shopify.analytics.publish === 'function') {
        Shopify.analytics.publish(name, payload);
      }
    } catch (e) { /* ignore */ }
  }

  /* ---------- keep clear of the tactical hub button ---------- */

  function place() {
    var hub = document.querySelector('.apgo-widget-container');
    var bottom = 20;
    var right = 20;
    if (hub) {
      var r = hub.getBoundingClientRect();
      if (r.width && r.height && getComputedStyle(hub).position === 'fixed') {
        bottom = Math.round(window.innerHeight - r.top + 12);
        right = Math.max(12, Math.round(window.innerWidth - r.right));
      }
    }
    root.style.setProperty('--sv-bottom', bottom + 'px');
    root.style.setProperty('--sv-right', right + 'px');
  }

  /* ---------- answers ---------- */

  function answers() {
    var q1 = form.querySelector('input[name="q1"]:checked');
    var q2 = Array.prototype.map.call(form.querySelectorAll('input[name="q2"]:checked'), function (i) { return i.value; });
    return {
      q1: q1 ? parseInt(q1.value, 10) : null,
      q2: q2,
      q2_other: q2.indexOf('other') > -1 && otherInput ? otherInput.value.trim() : '',
      q3: q3 ? q3.value.trim() : ''
    };
  }

  function restore() {
    var a = saved.answers;
    if (!a) return;
    if (a.q1) {
      var r = form.querySelector('input[name="q1"][value="' + a.q1 + '"]');
      if (r) r.checked = true;
    }
    (a.q2 || []).forEach(function (v) {
      var c = form.querySelector('input[name="q2"][value="' + v + '"]');
      if (c) c.checked = true;
    });
    if (otherInput && a.q2_other) otherInput.value = a.q2_other;
    if (q3 && a.q3) q3.value = a.q3;
    syncOther();
    countChars();
  }

  function remember() {
    saved.answers = answers();
    saved.step = step;
    save();
  }

  // Older browsers without :has() style the picked answers by this class.
  function syncChecked() {
    form.querySelectorAll('.apgo-sv__face, .apgo-sv__option').forEach(function (label) {
      var input = label.querySelector('input');
      label.classList.toggle('is-checked', !!(input && input.checked));
    });
  }

  function syncOther() {
    syncChecked();
    if (!otherInput) return;
    var other = form.querySelector('input[name="q2"][value="other"]');
    otherInput.hidden = !(other && other.checked);
  }

  function countChars() {
    if (q3 && chars) chars.textContent = String(300 - q3.value.length);
  }

  /* ---------- steps ---------- */

  function showStep(n) {
    step = n;
    steps.forEach(function (s) { s.hidden = Number(s.getAttribute('data-step')) !== n; });
    prevBtn.hidden = n === 1;
    nextBtn.hidden = n === steps.length;
    submitBtn.hidden = n !== steps.length;
    if (bar) bar.style.width = Math.round((n / steps.length) * 100) + '%';
    if (count) count.textContent = n + ' / ' + steps.length;
    steps.forEach(function (s) {
      var err = s.querySelector('[data-apgo-sv-error]');
      if (err) err.hidden = true;
    });
    if (sendError) sendError.hidden = true;
  }

  function stepValid(n) {
    var a = answers();
    if (n === 1) return !!a.q1;
    if (n === 2) return a.q2.length > 0;
    return true;
  }

  function next() {
    if (!stepValid(step)) {
      var err = steps[step - 1].querySelector('[data-apgo-sv-error]');
      if (err) err.hidden = false;
      return;
    }
    track('apgo_survey_step', { step: step });
    showStep(step + 1);
    remember();
    var first = steps[step - 1].querySelector('input, textarea');
    if (first) first.focus({ preventScroll: true });
  }

  /* ---------- open / close ---------- */

  function isOpen() { return !layer.hidden; }

  function open(source) {
    if (isOpen()) return;
    hideHint();
    lastFocus = document.activeElement;
    layer.hidden = false;
    if (window.matchMedia('(max-width: 749px)').matches) document.documentElement.classList.add('apgo-sv-lock');
    panel.focus({ preventScroll: true });
    track('apgo_survey_open', { source: source || 'button' });
    if (loggedIn && !statusChecked && !preview) checkStatus();
  }

  function close() {
    if (!isOpen()) return;
    layer.hidden = true;
    document.documentElement.classList.remove('apgo-sv-lock');
    if (!done.hidden) {
      // A finished survey starts fresh next time.
      done.hidden = true;
      body.hidden = false;
      form.reset();
      syncOther();
      countChars();
      showStep(1);
    }
    if (lastFocus && lastFocus.focus) lastFocus.focus({ preventScroll: true });
    track('apgo_survey_close', { step: step });
  }

  /* ---------- hint ---------- */

  function campaignPopupOpen() {
    return !!document.querySelector('.apgo-cp.is-open');
  }

  function showHint() {
    if (isOpen() || root.classList.contains('is-collapsed') || flag(sessionStorage, SESSION_HINT)) return;
    if (campaignPopupOpen()) {
      hintTimer = setTimeout(showHint, 5000);
      return;
    }
    hint.hidden = false;
    setFlag(sessionStorage, SESSION_HINT);
    track('apgo_survey_hint');
    hintTimer = setTimeout(hideHint, 12000);
  }

  function hideHint() {
    clearTimeout(hintTimer);
    hint.hidden = true;
  }

  /* ---------- talking to the worker ---------- */

  function deviceKind() {
    var touch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    var w = window.innerWidth;
    if (w < 750) return 'mobile';
    if (touch && w <= 1180) return 'tablet';
    return 'desktop';
  }

  function request(path, method, payload) {
    return fetch(endpoint + path, {
      method: method,
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      credentials: 'same-origin',
      body: payload ? JSON.stringify(payload) : undefined
    }).then(function (res) {
      return res.json().catch(function () { return {}; }).then(function (data) {
        if (!res.ok || !data || data.ok === false) {
          var e = new Error('HTTP ' + res.status);
          e.data = data;
          throw e;
        }
        return data;
      });
    });
  }

  function fake(state) {
    return new Promise(function (resolve, reject) {
      setTimeout(function () {
        if (state === 'error') reject(new Error('preview'));
        else resolve({ ok: true, survey_id: 'preview', reward: { status: state } });
      }, 500);
    });
  }

  function checkStatus() {
    statusChecked = true;
    request('/status', 'GET').then(function (data) {
      if (data.reward && (data.reward.status === 'issued' || data.reward.status === 'already')) {
        claimedNote.hidden = false;
      }
    }).catch(function () { /* the note is only a courtesy */ });
  }

  function showDone(state) {
    var known = ['issued', 'login', 'already', 'failed'];
    if (known.indexOf(state) < 0) state = 'failed';
    Array.prototype.forEach.call(done.querySelectorAll('[data-apgo-sv-state]'), function (el) {
      el.hidden = el.getAttribute('data-apgo-sv-state') !== state;
    });
    body.hidden = true;
    done.hidden = false;
    panel.scrollTop = 0;
    track('apgo_survey_done', { reward: state });
  }

  function submit(event) {
    if (event) event.preventDefault();
    if (sending) return;
    if (!stepValid(1)) { showStep(1); return next(); }
    if (!stepValid(2)) { showStep(2); return next(); }

    var a = answers();
    sending = true;
    submitBtn.disabled = true;
    submitBtn.textContent = '送出中…';
    if (sendError) sendError.hidden = true;

    var payload = {
      client_id: clientId(),
      q1: a.q1,
      q2: a.q2,
      q2_other: a.q2_other,
      q3: a.q3,
      device: deviceKind(),
      page: root.getAttribute('data-page') || '',
      path: window.location.pathname
    };

    var call = preview ? fake(preview) : request('/submit', 'POST', payload);
    call.then(function (data) {
      track('apgo_survey_submit', { score: a.q1 });
      var state = (data.reward && data.reward.status) || 'failed';
      if (state === 'login') {
        saved.pending = data.survey_id;
      } else {
        delete saved.pending;
      }
      delete saved.answers;
      delete saved.step;
      save();
      showDone(state);
    }).catch(function () {
      if (sendError) sendError.hidden = false;
      track('apgo_survey_error', { at: 'submit' });
    }).then(function () {
      sending = false;
      submitBtn.disabled = false;
      submitBtn.textContent = '送出問卷';
    });
  }

  // Back from signing in with a survey waiting for its reward.
  function claimPending() {
    var wanted = params.get('apgo_survey') === 'claim';
    if (!loggedIn || !saved.pending || preview) {
      if (wanted && !loggedIn) open('login-return');
      return;
    }
    request('/claim', 'POST', { survey_id: saved.pending, client_id: clientId() }).then(function (data) {
      delete saved.pending;
      save();
      open('claim');
      showDone((data.reward && data.reward.status) || 'failed');
      track('apgo_survey_claim', { reward: data.reward && data.reward.status });
    }).catch(function () {
      // Kept: the next page load tries again.
      track('apgo_survey_error', { at: 'claim' });
    });
  }

  /* ---------- wiring ---------- */

  root.addEventListener('click', function (e) {
    var t = e.target.closest('button, a');
    if (!t || !root.contains(t)) return;

    if (t.hasAttribute('data-apgo-sv-open')) {
      if (root.classList.contains('is-collapsed') && t.classList.contains('apgo-sv__open')) {
        root.classList.remove('is-collapsed');
      }
      open(t.classList.contains('apgo-sv__hint-text') ? 'hint' : 'button');
    } else if (t.hasAttribute('data-apgo-sv-close')) {
      close();
    } else if (t.hasAttribute('data-apgo-sv-collapse')) {
      root.classList.add('is-collapsed');
      setFlag(sessionStorage, SESSION_COLLAPSED);
      hideHint();
      track('apgo_survey_collapse');
    } else if (t.hasAttribute('data-apgo-sv-hint-close')) {
      hideHint();
      track('apgo_survey_hint_close');
    } else if (t === prevBtn) {
      showStep(step - 1);
      remember();
    } else if (t === nextBtn) {
      next();
    } else if (t.hasAttribute('data-apgo-sv-copy')) {
      var code = t.getAttribute('data-apgo-sv-copy');
      var ok = function () { t.textContent = '已複製'; setTimeout(function () { t.textContent = '複製'; }, 2000); };
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(code).then(ok, ok);
      } else {
        ok();
      }
      track('apgo_survey_copy');
    } else if (t.hasAttribute('data-apgo-sv-login')) {
      track('apgo_survey_login');
    }
  });

  form.addEventListener('change', function (e) {
    var t = e.target;
    if (t.name === 'q2') {
      // 沒有遇到問題 excludes every other choice.
      if (t.value === 'none' && t.checked) {
        form.querySelectorAll('input[name="q2"]').forEach(function (i) { if (i !== t) i.checked = false; });
      } else if (t.checked) {
        var none = form.querySelector('input[name="q2"][value="none"]');
        if (none) none.checked = false;
      }
      syncOther();
      if (t.value === 'other' && t.checked && otherInput) otherInput.focus();
    }
    syncChecked();
    var err = steps[step - 1].querySelector('[data-apgo-sv-error]');
    if (err && stepValid(step)) err.hidden = true;
    remember();
  });

  form.addEventListener('input', function (e) {
    if (e.target === q3) countChars();
    if (e.target === q3 || e.target === otherInput) remember();
  });

  form.addEventListener('submit', submit);

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && isOpen()) close();
  });

  window.addEventListener('resize', place);

  /* ---------- start ---------- */

  if (flag(sessionStorage, SESSION_COLLAPSED)) root.classList.add('is-collapsed');
  restore();
  showStep(saved.step && saved.answers ? Math.min(saved.step, steps.length) : 1);
  place();
  // The hub button may draw after us.
  setTimeout(place, 1500);
  claimPending();

  if (preview === 'hint') {
    try { sessionStorage.removeItem(SESSION_HINT); } catch (e) { /* ignore */ }
    setTimeout(showHint, 800);
  } else if (preview && preview !== 'hint' && !designMode) {
    open('preview');
  } else if (!designMode) {
    hintTimer = setTimeout(showHint, hintDelay);
  }

  // Theme editor: open while the section is selected.
  document.addEventListener('shopify:section:select', function (e) {
    if (e.target && e.target.contains(root)) open('editor');
  });
  document.addEventListener('shopify:section:deselect', function (e) {
    if (e.target && e.target.contains(root)) close();
  });
})();
