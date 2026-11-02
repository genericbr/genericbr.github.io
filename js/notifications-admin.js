(function () {
  "use strict";
  const POLL_MS = 30000, STORAGE_KEY = "portfolioAdminReadNotifications", MAX_READ = 200;
  let root = null, request = null, active = false, generation = 0, timer = 0, toastTimer = 0, loading = false;
  let notifications = [], readIds = new Set(), seenIds = new Set(), createdNative = [], initialized = false, open = false, nativeEnabled = false;

  const esc = (v) => String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const fmt = (v) => { const d = new Date(v); return Number.isFinite(d.getTime()) ? new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(d) : "data desconhecida"; };
  const read = () => { try { const value = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]"); return new Set(Array.isArray(value) ? value.filter((x) => typeof x === "string").slice(-MAX_READ) : []); } catch { return new Set(); } };
  const saveRead = () => { readIds = new Set([...readIds].slice(-MAX_READ)); try { localStorage.setItem(STORAGE_KEY, JSON.stringify([...readIds])); } catch {} };
  const idOf = (item) => typeof item?.id === "string" ? item.id : "";
  const unread = () => notifications.filter((item) => !readIds.has(idOf(item)));
  const message = (item) => `${item.label || "Link rastreável"} · ${item.code ? "/" + item.code : item.path || ""}`;
  const mark = (id) => { if (!id) return; readIds.add(id); saveRead(); render(); };
  const markAll = () => { notifications.forEach((item) => { if (idOf(item)) readIds.add(idOf(item)); }); saveRead(); render(); };
  function shell() {
    root.innerHTML = '<button type="button" class="admin-notifications-button" data-admin-notifications-toggle aria-label="Notificações de acessos" aria-expanded="false" aria-controls="admin-notifications-panel"><svg aria-hidden="true" viewBox="0 0 24 24"><path d="M18 9a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4"/></svg><span class="admin-notifications-badge" data-admin-notifications-badge hidden></span></button><div id="admin-notifications-panel" class="admin-notifications-panel" hidden role="dialog" aria-label="Acessos recentes"><div class="admin-notifications-head"><div><strong>Acessos recentes</strong><small>Atualiza a cada 30 s com o painel aberto.</small></div><button type="button" class="secondary admin-notifications-read" data-admin-notifications-read-all>Marcar lidos</button></div><div class="admin-notifications-status" data-admin-notifications-status role="status" aria-live="polite"></div><div class="admin-notifications-list" data-admin-notifications-list></div><div class="admin-notifications-foot"><button type="button" class="secondary admin-notifications-refresh" data-admin-notifications-refresh>Atualizar agora</button><button type="button" class="secondary admin-notifications-native" data-admin-notifications-native>Ativar notificações do navegador</button></div></div><div class="admin-notifications-live" aria-live="polite" aria-atomic="true"></div>';
    root.querySelector(".admin-notifications-button").addEventListener("click", toggle);
    root.querySelector(".admin-notifications-read").addEventListener("click", markAll);
    root.querySelector(".admin-notifications-refresh").addEventListener("click", () => poll(false));
    root.querySelector(".admin-notifications-native").addEventListener("click", enableNative);
    document.addEventListener("click", outside, true); document.addEventListener("keydown", escape);
  }
  function render() {
    if (!root) return;
    const badge = root.querySelector(".admin-notifications-badge"), button = root.querySelector(".admin-notifications-button"), panel = root.querySelector(".admin-notifications-panel"), list = root.querySelector(".admin-notifications-list"), native = root.querySelector(".admin-notifications-native");
    const count = unread().length; badge.textContent = count > 99 ? "99+" : String(count); badge.hidden = !count; button.setAttribute("aria-expanded", String(open)); panel.hidden = !open;
    native.hidden = !("Notification" in window) || Notification.permission === "denied";
    native.textContent = nativeEnabled ? "Desativar notificações do navegador" : "Ativar notificações do navegador";
    list.innerHTML = notifications.length ? notifications.map((item) => '<button type="button" class="admin-notification-item' + (readIds.has(idOf(item)) ? " is-read" : "") + '" data-notification-id="' + esc(idOf(item)) + '"><span class="admin-notification-dot" aria-hidden="true"></span><span><strong>' + esc(item.label || "Acesso ao convite") + '</strong><small>/' + esc(item.code || "") + ' · ' + esc(item.path || "") + '</small><time datetime="' + esc(item.at) + '">' + esc(fmt(item.at)) + '</time></span></button>').join("") : '<p class="admin-notifications-empty">Nenhum acesso recente.</p>';
    list.querySelectorAll("[data-notification-id]").forEach((item) => item.addEventListener("click", () => mark(item.dataset.notificationId)));
  }
  function setStatus(text, error = false) { const node = root?.querySelector(".admin-notifications-status"); if (node) { node.textContent = text || ""; node.classList.toggle("error", error); } }
  function toast(text) {
    const token = generation, node = root?.querySelector(".admin-notifications-live");
    if (!node) return;
    clearTimeout(toastTimer);
    node.textContent = text;
    toastTimer = setTimeout(() => { if (active && token === generation) node.textContent = ""; }, 6000);
  }
  async function poll(initial = false) {
    if (!active || loading) return;
    const token = generation; loading = true;
    try {
      const result = await request("/api/tracking/notifications"), next = Array.isArray(result?.notifications) ? result.notifications.filter((item) => idOf(item) && item.at) : [];
      if (token !== generation || !active) return;
      const fresh = initialized ? next.filter((item) => !seenIds.has(idOf(item)) && !readIds.has(idOf(item))) : [];
      next.forEach((item) => seenIds.add(idOf(item))); if (seenIds.size > 500) seenIds = new Set([...seenIds].slice(-500));
      notifications = next; initialized = true;
      if (fresh.length) { toast(fresh.length === 1 ? `Novo acesso: ${message(fresh[0])}` : `${fresh.length} novos acessos`); if (nativeEnabled && "Notification" in window && Notification.permission === "granted") fresh.slice(0, 3).forEach((item) => { try { const n = new Notification("Novo acesso ao portfólio", { body: `${message(item)} · ${fmt(item.at)}` }); createdNative.push(n); n.onclick = () => { if (!active || token !== generation) return; window.focus(); open = true; render(); n.close(); createdNative = createdNative.filter((entry) => entry !== n); }; n.onclose = () => { createdNative = createdNative.filter((entry) => entry !== n); }; } catch {} }); }
      setStatus(result?.limited ? "Mostrando os acessos mais recentes." : ""); render();
    } catch (error) {
      if (token !== generation || !active) return;
      if (error?.status === 401) { stop(); return; }
      setStatus(error?.status === 404 ? "Atualize o Worker para ativar as notificações." : "Não foi possível atualizar os acessos.", true);
    } finally { if (token === generation) loading = false; }
  }
  async function enableNative() { if (!("Notification" in window)) return; if (nativeEnabled) { nativeEnabled = false; try { localStorage.removeItem("portfolioNativeNotifications"); } catch {} createdNative.splice(0).forEach((item) => { try { item.close(); } catch {} }); render(); return; } const token = generation, owner = root; try { const permission = await Notification.requestPermission(); if (permission === "granted" && active && token === generation && root === owner) { nativeEnabled = true; try { localStorage.setItem("portfolioNativeNotifications", "true"); } catch {} render(); } } catch {} }
  function toggle() { open = !open; render(); if (open) poll(); }
  function outside(event) { if (open && root && !root.contains(event.target)) { open = false; render(); } }
  function escape(event) { if (event.key === "Escape" && open) { open = false; render(); root.querySelector(".admin-notifications-button")?.focus(); } }
  function stop() { active = false; generation++; if (timer) clearInterval(timer); clearTimeout(toastTimer); toastTimer = 0; timer = 0; loading = false; open = false; initialized = false; seenIds = new Set(); readIds = new Set(); nativeEnabled = false; createdNative.splice(0).forEach((item) => { try { item.close(); } catch {} }); notifications = []; if (root) { document.removeEventListener("click", outside, true); document.removeEventListener("keydown", escape); root.replaceChildren(); } root = null; request = null; }
  window.PortfolioAdminNotifications = { start(options) { stop(); root = options.container; request = options.request; active = true; readIds = read(); if (readIds.size > MAX_READ) { readIds = new Set([...readIds].slice(-MAX_READ)); saveRead(); } try { nativeEnabled = localStorage.getItem("portfolioNativeNotifications") === "true" && "Notification" in window && Notification.permission === "granted"; } catch { nativeEnabled = false; } shell(); render(); poll(true); timer = setInterval(() => poll(false), POLL_MS); }, stop };
})();
