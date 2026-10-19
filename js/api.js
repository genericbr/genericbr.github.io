/* Shared public-data cache. Admin requests always use request() and no-store. */
(function (global) {
  'use strict';
  const base = (CONFIG.api?.baseUrl || 'https://portfolio.genericbr-business.workers.dev').replace(/\/$/, '');
  const prefix = 'portfolio:v2:' + base + ':';
  const invalidationKey = 'portfolio:invalidate:' + base;
  const memory = new Map();
  const pending = new Map();
  let generation = 0;
  const publicPaths = new Set(['/', '/api/games', '/api/games/tags', '/api/game/credits', '/api/music/lyrics', '/api/music/tags', '/api/audiovisuals/playlist', '/api/audiovisuals/tags', '/api/steam/app', '/api/banners']);
  function signal(state, path) {
    global.dispatchEvent?.(new CustomEvent('portfolio:cache', { detail: { state, path } }));
  }
  function read(key) {
    if (memory.has(key)) return memory.get(key);
    try {
      const value = JSON.parse(global.localStorage.getItem(prefix + key));
      if (value && typeof value.time === 'number' && 'data' in value) { memory.set(key, value); return value; }
    } catch { /* Browser storage may be unavailable or contain an older format. */ }
    return null;
  }
  function write(key, value) {
    memory.set(key, value);
    try { global.localStorage.setItem(prefix + key, JSON.stringify(value)); } catch { /* Memory cache remains available in storage-restricted browsers. */ }
  }
  function resetMemory() { generation++; memory.clear(); pending.clear(); }
  function clear() {
    resetMemory();
    try {
      for (let i = global.localStorage.length - 1; i >= 0; i--) {
        const key = global.localStorage.key(i);
        if (key?.startsWith(prefix)) global.localStorage.removeItem(key);
      }
      // A short-lived marker notifies other tabs without persisting session or public data.
      global.localStorage.setItem(invalidationKey, String(Date.now()) + ':' + Math.random());
      global.localStorage.removeItem(invalidationKey);
    } catch { /* Storage can be disabled by browser policy. */ }
  }
  global.addEventListener?.('storage', event => {
    if (event.key === null || (event.key === invalidationKey && event.newValue)) { resetMemory(); signal('invalidated', '/'); }
    else if (event.key?.startsWith(prefix) && event.newValue === null) resetMemory();
  });
  async function request(path, { method = 'GET', body, token, headers = {}, timeout = 12000, invalidate = true, ...options } = {}) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);
    try {
      const requestHeaders = new Headers(headers);
      if (token) requestHeaders.set('Authorization', 'Bearer ' + token);
      const isFormData = typeof FormData !== 'undefined' && body instanceof FormData;
      if (body !== undefined && !isFormData) requestHeaders.set('Content-Type', 'application/json');
      const response = await fetch(base + path, { ...options, method, headers: requestHeaders, body: body === undefined ? undefined : (isFormData ? body : JSON.stringify(body)), signal: controller.signal, cache: 'no-store' });
      if (!response.ok) {
        let message = 'Não foi possível concluir a solicitação (HTTP ' + response.status + ').';
        try {
          const payload = await response.json();
          if (typeof payload?.error === 'string' && payload.error.length > 0 && payload.error.length <= 300 && !/[\u0000-\u001f]/.test(payload.error)) message = payload.error;
        } catch { /* Some error responses are empty or not JSON. */ }
        const error = new Error(message);
        error.status = response.status;
        throw error;
      }
      if (invalidate && method !== 'GET' && method !== 'HEAD' && path !== '/auth') clear();
      return response.status === 204 ? null : await response.json();
    } finally { clearTimeout(timer); }
  }
  async function upload(path, file, purpose, token) {
    if (typeof FormData === 'undefined') throw new Error('O navegador não oferece suporte a envio de imagens.');
    const body = new FormData();
    body.append('file', file, file.name || 'upload');
    if (purpose) body.append('purpose', purpose);
    return request(path, { method: 'POST', body, token, timeout: 40000, invalidate: false });
  }
  async function get(path = '/', { ttl = 300000, force = false } = {}) {
    const url = new URL(path || '/', base);
    if (url.origin !== new URL(base).origin || !publicPaths.has(url.pathname) || url.searchParams.has('admin')) throw new Error('Este recurso não permite cache público.');
    const key = url.pathname + url.search;
    const cached = read(key);
    const age = cached ? Date.now() - cached.time : Infinity;
    if (!force && cached && age >= 0 && age < ttl) { signal('hit', key); return cached.data; }
    if (pending.has(key)) return pending.get(key);
    const version = generation;
    const task = (async () => {
      try {
        const data = await request(key);
        if (version === generation) write(key, { time: Date.now(), data });
        signal('fresh', key);
        return data;
      } catch (error) {
        // Only a network outage or an upstream outage can use the previous public snapshot.
        if (cached && age >= 0 && age < 86400000 && (!error.status || error.status >= 500)) { signal('stale', key); return cached.data; }
        signal('error', key);
        throw error;
      }
    })();
    pending.set(key, task);
    try { return await task; } finally { if (pending.get(key) === task) pending.delete(key); }
  }
  global.PortfolioAPI = Object.freeze({ get, request, upload, clear, baseUrl: base });
})(window);
