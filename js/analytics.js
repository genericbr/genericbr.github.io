(function publicAnalyticsCollector(global) {
  'use strict';

  var doc = global.document;
  if (!doc || !global.location) return;

  var SESSION_KEY = 'portfolio.analytics.session';
  var MAX_IDLE_MS = 30 * 60 * 1000;
  var currentPath = '';
  var pendingPath = '';
  var memorySession = null;
  var started = false;

  function uuid() {
    if (global.crypto && typeof global.crypto.randomUUID === 'function') return global.crypto.randomUUID();
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
      var r = Math.random() * 16 | 0;
      return (c === 'x' ? r : (r & 3 | 8)).toString(16);
    });
  }

  function sessionStorage() {
    try { return global.sessionStorage; } catch (_) { return null; }
  }

  function readSession() {
    var now = Date.now();
    var store = sessionStorage();
    var value = null;
    try { value = store && JSON.parse(store.getItem(SESSION_KEY) || 'null'); } catch (_) { value = null; }
    if (!value && memorySession) value = memorySession;
    var validId = value && typeof value.id === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value.id);
    var validClock = value && Number.isFinite(value.lastActivity) && value.lastActivity <= now;
    if (!validId || !validClock || now - value.lastActivity >= MAX_IDLE_MS) {
      value = { id: uuid(), lastActivity: now };
    } else {
      value.lastActivity = now;
    }
    try { if (store) store.setItem(SESSION_KEY, JSON.stringify(value)); } catch (_) { memorySession = value; }
    if (!store || memorySession) memorySession = value;
    return value;
  }

  function normalizedPath(value) {
    if (typeof value !== 'string') return '';
    var path = value.split(/[?#]/)[0].replace(/\\/g, '/');
    if (!path || path.charAt(0) !== '/' || path.indexOf('..') !== -1 || /[\u0000-\u001f]/.test(path)) return '';
    if (/^\/dashboard(?:\.html)?(?:\/|$)/i.test(path)) return '';
    if (/^\/[a-z0-9_-]{3,64}$/i.test(path) && !/^(portfolio|games|audiovisuals|music|about)$/i.test(path.slice(1))) return '';
    if (/^\/$/.test(path) || /^\/(portfolio|games|audiovisuals|music|about)$/i.test(path)) return path;
    if (/^\/(game|video)\/[a-z0-9][a-z0-9_-]{1,127}$/i.test(path)) return path;
    if (/^\/audiovisual\/[a-z0-9][a-z0-9_-]{1,127}(?:\/[a-z0-9][a-z0-9_-]{0,127})?$/i.test(path)) return path;
    return '';
  }

  function referrerHost() {
    try {
      if (!doc.referrer) return '';
      var parsed = new URL(doc.referrer);
      if (!/^https?:$/.test(parsed.protocol) || parsed.origin === global.location.origin) return '';
      return parsed.hostname.toLowerCase();
    } catch (_) { return ''; }
  }

  function visible() {
    return doc.visibilityState !== 'hidden' && !doc.prerendering;
  }

  function post(body) {
    var api = global.PortfolioAPI;
    if (api && typeof api.request === 'function') {
      return Promise.resolve(api.request('/api/analytics/visit', {
        method: 'POST', body: body, invalidate: false, timeout: 5000, keepalive: true
      }));
    }
    return Promise.reject(new Error('analytics api unavailable'));
  }

  function send(path) {
    var session = readSession();
    var body = { visitId: session.id, pageViewId: uuid(), path: path, referrer: referrerHost() };
    post(body).catch(function () { return post(body).catch(function () { /* analytics is best effort */ }); });
  }

  function process(path) {
    var valid = normalizedPath(path);
    if (!valid) return;
    if (!visible()) { pendingPath = valid === currentPath ? '' : valid; return; }
    if (valid === currentPath) return;
    pendingPath = '';
    currentPath = valid;
    send(valid);
  }

  function onPageview(event) {
    var detail = event && event.detail;
    process(detail && detail.path);
  }

  function flush() {
    if (visible() && pendingPath) process(pendingPath);
  }

  function start() {
    if (started) return;
    started = true;
    global.addEventListener('portfolio:pageview', onPageview);
    global.addEventListener('pageshow', flush);
    global.addEventListener('prerenderingchange', flush);
    doc.addEventListener('visibilitychange', flush);
  }

  start();
  global.PortfolioAnalytics = {
    track: process,
    reset: function () { currentPath = ''; pendingPath = ''; },
    normalizePath: normalizedPath
  };
}(window));
