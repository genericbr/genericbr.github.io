/* Record an attributed portfolio visit, never an email open or a visitor identity. */
(function () {
  'use strict';
  let url = new URL(location.href);
  // GitHub Pages restores deep links through /index.html?path=… .
  const redirected = url.searchParams.get('path');
  if (redirected?.startsWith('/') && !redirected.startsWith('//') && !/[\\\u0000-\u0020]/.test(redirected)) {
    const target = new URL(redirected, url.origin);
    if (target.origin === url.origin) {
      history.replaceState(history.state, '', target.pathname + target.search + target.hash);
      url = target;
    }
  }
  const token = url.searchParams.get('ref');
  if (!url.searchParams.has('ref')) return;
  url.searchParams.delete('ref');
  history.replaceState(history.state, '', url.pathname + url.search + url.hash);
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(token || '')) return;
  const key = 'portfolio:visit:' + token.toLowerCase();
  let visitId;
  try {
    if (sessionStorage.getItem('portfolioAdminToken')) return;
    visitId = sessionStorage.getItem(key);
  } catch { /* A visit can still be recorded when browser storage is unavailable. */ }
  if (!/^[0-9a-f-]{36}$/i.test(visitId || '')) visitId = crypto.randomUUID();
  let timer, sent = false;
  const stopTimer = () => { clearTimeout(timer); timer = undefined; };
  async function send() {
    stopTimer();
    if (sent || document.visibilityState !== 'visible' || document.prerendering) return;
    sent = true;
    document.removeEventListener('visibilitychange', schedule);
    document.removeEventListener('prerenderingchange', schedule);
    window.removeEventListener('pagehide', stopTimer);
    try {
      const response = await fetch(PortfolioAPI.baseUrl + '/api/tracking/visit', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: token.toLowerCase(), visitId }),
        credentials: 'omit', cache: 'no-store', keepalive: true,
        signal: AbortSignal.timeout(5000)
      });
      if (response.ok) { try { sessionStorage.setItem(key, visitId); } catch {} }
    } catch { /* Tracking must never interrupt the portfolio, including before Worker deployment. */ }
  }
  function schedule() {
    stopTimer();
    if (!sent && document.visibilityState === 'visible' && !document.prerendering) timer = setTimeout(send, 1200);
  }
  document.addEventListener('visibilitychange', schedule);
  document.addEventListener('prerenderingchange', schedule);
  window.addEventListener('pagehide', stopTimer);
  window.addEventListener('pageshow', schedule);
  schedule();
})();
