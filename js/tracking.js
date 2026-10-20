/* Resolve invitations and record visits. Webhook credentials stay in the Worker. */
(function () {
  'use strict';
  let url = new URL(location.href);
  const redirected = url.searchParams.get('path');
  if (redirected?.startsWith('/') && !redirected.startsWith('//') && !/[\\\u0000-\u0020]/.test(redirected)) {
    const target = new URL(redirected, url.origin);
    if (target.origin === url.origin) {
      history.replaceState(history.state, '', target.pathname + target.search + target.hash);
      url = target;
    }
  }
  const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  const reserved = new Set(['portfolio','games','music','audiovisuals','about','images','dashboard','config','index']);
  const candidate = url.pathname.match(/^\/([a-z0-9]{5,32})\/?$/)?.[1];
  const code = candidate && !reserved.has(candidate) ? candidate : '';
  const token = url.searchParams.get('ref');
  if (url.searchParams.has('ref')) {
    url.searchParams.delete('ref');
    history.replaceState(history.state, '', url.pathname + url.search + url.hash);
  }
  if (!code && !uuid.test(token || '')) { window.PortfolioInviteReady = Promise.resolve(); return; }
  const main = document.querySelector('main');
  let loading;
  if (code && main) {
    main.inert = true; main.setAttribute('aria-busy', 'true');
    loading = document.createElement('p'); loading.className = 'invite-loading'; loading.setAttribute('role', 'status'); loading.textContent = 'Opening invitation…'; main.prepend(loading);
  }

  function safePath(value) {
    return typeof value === 'string' && !/[\\\u0000-\u0020?#%]/.test(value) && !value.split('/').some(part => part === '.' || part === '..') && /^\/(?:|portfolio|audiovisuals|music|games|about|(?:video|game)\/[A-Za-z0-9._:-]{1,120}|audiovisual\/[A-Za-z0-9._:-]{1,120}(?:\/[A-Za-z0-9._:-]{1,120})?)$/.test(value);
  }
  function imageURL(value) {
    try { const parsed = new URL(value); return ['https:', 'http:'].includes(parsed.protocol) && !parsed.username && !parsed.password ? parsed.href : ''; }
    catch { return ''; }
  }
  function panel(message = {}, unavailable = false, collecting = true) {
    if (!message || typeof message !== 'object') message = {};
    if (!collecting && !message.title && !message.text && !imageURL(message.image)) return;
    const section = document.createElement('section');
    section.className = 'invite-message'; section.setAttribute('aria-label', 'Invitation message');
    const content = document.createElement('div'); content.className = 'invite-message-content';
    if (message.title) { const heading = document.createElement('h2'); heading.textContent = String(message.title).slice(0,120); content.append(heading); }
    if (message.text || unavailable) { const text = document.createElement('p'); text.className = 'invite-message-text'; text.textContent = unavailable ? 'This invitation is unavailable. You can still browse the portfolio.' : String(message.text).slice(0,3000); content.append(text); }
    if (!unavailable && collecting) { const notice = document.createElement('small'); notice.className = 'invite-privacy'; notice.textContent = 'Visits through this invitation record your IP address and device information.'; content.append(notice); }
    const image = imageURL(message.image);
    if (image) { const picture = document.createElement('img'); picture.src = image; picture.alt = message.title || 'Invitation image'; picture.decoding = 'async'; picture.referrerPolicy = 'no-referrer'; picture.addEventListener('error', () => picture.remove(), { once:true }); section.append(picture); }
    section.append(content);
    const dismiss = document.createElement('button'); dismiss.type = 'button'; dismiss.className = 'invite-dismiss'; dismiss.setAttribute('aria-label', 'Dismiss invitation message'); dismiss.textContent = '×'; dismiss.addEventListener('click', () => section.remove()); section.append(dismiss);
    document.querySelector('main')?.prepend(section);
  }
  function record(invite) {
    if (invite.active === false) return;
    const key = 'portfolio:visit:' + invite.token;
    let visitId;
    try { if (sessionStorage.getItem('portfolioAdminToken')) return; visitId = sessionStorage.getItem(key); } catch {}
    if (!uuid.test(visitId || '')) visitId = crypto.randomUUID();
    let timer, sent = false;
    const stopTimer = () => { clearTimeout(timer); timer = undefined; };
    async function send() {
      stopTimer();
      if (sent || document.visibilityState !== 'visible' || document.prerendering) return;
      sent = true;
      document.removeEventListener('visibilitychange', schedule); document.removeEventListener('prerenderingchange', schedule);
      window.removeEventListener('pagehide', stopTimer); window.removeEventListener('pageshow', schedule);
      const device = { language: String(navigator.language || '').slice(0,35), screenWidth: Number(screen.width) || 0, screenHeight: Number(screen.height) || 0 };
      try { device.timezone = Intl.DateTimeFormat().resolvedOptions().timeZone; } catch {}
      try {
        const response = await fetch(PortfolioAPI.baseUrl + '/api/tracking/visit', {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token: invite.token, visitId, device }),
          credentials: 'omit', cache: 'no-store', keepalive: true, signal: AbortSignal.timeout(5000)
        });
        if (response.ok) { try { sessionStorage.setItem(key, visitId); } catch {} }
      } catch { /* A tracking outage must never interrupt the portfolio. */ }
    }
    function schedule() { stopTimer(); if (!sent && document.visibilityState === 'visible' && !document.prerendering) timer = setTimeout(send, 1200); }
    document.addEventListener('visibilitychange', schedule); document.addEventListener('prerenderingchange', schedule);
    window.addEventListener('pagehide', stopTimer); window.addEventListener('pageshow', schedule); schedule();
  }
  window.PortfolioInviteReady = (async () => {
    let invite;
    try {
      const query = code ? 'code=' + code : 'token=' + encodeURIComponent(token);
      const response = await fetch(PortfolioAPI.baseUrl + '/api/tracking/resolve?' + query, { credentials:'omit', cache:'no-store', signal:AbortSignal.timeout(6000) });
      if (!response.ok) throw new Error('Invitation unavailable');
      invite = await response.json();
      if (!uuid.test(invite?.token || '') || !safePath(invite.path)) throw new Error('Invalid invitation');
    } catch {
      if (!code) invite = { token: token.toLowerCase(), path: url.pathname, message: {} };
      else { history.replaceState(history.state, '', '/'); panel({}, true); return; }
    }
    if (code) history.replaceState(history.state, '', invite.path);
    panel(invite.message, false, invite.active !== false);
    record(invite);
  })().catch(() => { /* Optional personalization cannot prevent the portfolio from opening. */ }).finally(() => {
    loading?.remove();
    if (main) { main.inert = false; main.removeAttribute('aria-busy'); }
  });
})();
