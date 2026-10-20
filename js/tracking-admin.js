/* Admin-only portfolio visit links. The module deliberately never stores recipient identity. */
(function () {
  "use strict";
  const allowedPresets = ["/portfolio", "/", "/audiovisuals", "/music", "/games"];
  let generation = 0;
  let active = false;
  let busy = false;
  let mountedContainer = null;
  const esc = (value) => String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
  const $ = (root, selector) => root.querySelector(selector);
  function date(value) {
    if (!value) return "—";
    const parsed = new Date(value);
    return Number.isFinite(parsed.getTime()) ? new Intl.DateTimeFormat("pt-BR", { dateStyle: "medium", timeStyle: "short" }).format(parsed) : "—";
  }
  function pathValid(value) {
    const path = String(value || "");
    if (!path || path.trim() !== path || /[\u0000-\u001f\u007f\s\\?#%]/.test(path) || path.includes("..")) return false;
    if (/^(?:\/$|\/portfolio$|\/audiovisuals$|\/music$|\/games$|\/about$)/.test(path)) return true;
    if (/^\/(?:video|game)\/[A-Za-z0-9_-]+$/.test(path)) return true;
    return /^\/audiovisual\/[A-Za-z0-9_-]+(?:\/[A-Za-z0-9_-]+)?$/.test(path);
  }
  function destination(link) {
    return new URL(link.path + (link.path.includes("?") ? "&" : "?") + "ref=" + encodeURIComponent(link.id), location.origin).href;
  }
  function formatCount(value) { return Number(value || 0).toLocaleString("pt-BR"); }
  function presetMarkup(current) {
    return '<div class="tracking-presets" role="group" aria-label="Destinos rápidos">' + allowedPresets.map((path) => '<button type="button" class="secondary tracking-preset" data-path="' + path + '"' + (current === path ? ' aria-pressed="true"' : "") + '>' + (path === "/" ? "Perfil" : path.slice(1).replace("audiovisuals", "Audiovisuais")) + "</button>").join("") + "</div>";
  }
  function card(link) {
    const url = destination(link);
    return '<article class="tracking-card" data-tracking-id="' + esc(link.id) + '"><div class="tracking-card-head"><div><h3>' + esc(link.label || "Sem nome") + '</h3><p class="tracking-path">' + esc(link.path) + '</p></div><span class="tracking-state ' + (link.active === false ? "paused" : "active") + '">' + (link.active === false ? "Pausado" : "Ativo") + "</span></div>" +
      '<div class="tracking-stats"><div><strong>' + (link.statsTruncated ? "≥" : "") + formatCount(link.visits) + '</strong><span>visitas</span></div><div><strong>' + date(link.firstVisitAt) + '</strong><span>primeira visita</span></div><div><strong>' + date(link.lastVisitAt) + '</strong><span>última visita</span></div></div>' +
      '<p class="tracking-url"><code>' + esc(url) + '</code><button type="button" class="secondary" data-copy-link>Copiar</button></p>' +
      '<form class="tracking-edit" data-tracking-edit><label>Nome interno<input name="label" value="' + esc(link.label) + '" required maxlength="80"></label><label>Destino<input name="path" value="' + esc(link.path) + '" required maxlength="180" inputmode="url"></label>' + presetMarkup(link.path) + '<div class="tracking-actions"><button type="submit">Salvar</button><button type="button" class="secondary" data-preview>Pré-visualizar</button><button type="button" class="secondary" data-toggle>' + (link.active === false ? "Ativar" : "Pausar") + '</button><button type="button" class="danger" data-delete>Excluir</button><span class="status" data-status role="status"></span></div></form></article>';
  }
  function emptyMarkup() {
    return '<div class="tracking-empty"><h3>Nenhum link criado</h3><p>Crie um link para cada publisher ou email. O contador registra visitas ao portfólio por 90 dias.</p></div>';
  }
  function formMarkup() {
    return '<section class="tracking-create"><div><p class="eyebrow">NOVO LINK</p><h2>Criar link rastreável</h2><p class="muted">Use um nome interno para lembrar para quem você enviou o endereço.</p></div><form data-tracking-create><div class="tracking-create-fields"><label>Nome interno<input name="label" required maxlength="80" placeholder="Publisher — apresentação outubro"></label><label>Destino<input name="path" required maxlength="180" value="/portfolio" placeholder="/portfolio"></label></div>' + presetMarkup("/portfolio") + '<div class="tracking-actions"><button type="submit">Criar link</button><span class="status" data-status role="status"></span></div></form></section>';
  }
  function setDirty(form) {
    if (!form) return;
    const label = $(form, 'input[name="label"]')?.value || "";
    const path = $(form, 'input[name="path"]')?.value || "";
    form.classList.toggle("tracking-dirty", form.dataset.initialLabel !== label || form.dataset.initialPath !== path);
  }
  function setBusy(root, value) {
    busy = value;
    root.classList.toggle("tracking-busy", value);
    root.querySelectorAll("button,input").forEach((control) => { control.disabled = value; });
  }
  async function refreshIfCurrent(api, root, notify, token) {
    if (token !== generation || !active) return;
    await renderLinks(api, root, notify);
  }
  async function renderLinks(api, root, notify) {
    const token = ++generation;
    if (!active) return;
    root.classList.add("tracking-root");
    root.innerHTML = '<div class="state">Carregando links…</div>';
    let payload;
    try { payload = await api("/api/tracking/links"); }
    catch (error) {
      if (token !== generation || !active) return;
      root.innerHTML = '<div class="state">' + (error.status === 404 ? "O Worker ainda não possui o recurso de links rastreáveis. Atualize o Worker antes de usar esta aba." : esc(error.message || "Não foi possível carregar os links.")) + '</div>';
      return;
    }
    if (token !== generation || !active) return;
    const links = Array.isArray(payload?.links) ? payload.links : [];
    const truncated = links.some((link) => link.statsTruncated);
    root.innerHTML = '<div class="tracking-heading"><div><p class="eyebrow">VISITAS AO PORTFÓLIO</p><h2>Links rastreáveis</h2><p class="muted">Acompanhe acessos vindos dos seus emails. Isso registra visita ao site; não confirma que o email foi aberto.</p></div><span class="tracking-retention">Dados dos últimos ' + esc(payload?.retentionDays || 90) + ' dias</span></div>' + formMarkup() + '<div class="tracking-list" aria-live="polite">' + (links.length ? links.map(card).join("") : emptyMarkup()) + '</div><p class="tracking-note">Pré-visualizações, scanners de segurança e bloqueadores podem gerar ou esconder visitas. Nenhum email ou identidade do visitante é armazenado.' + (truncated ? ' Alguns contadores atingiram o limite de leitura e são exibidos como mínimo.' : '') + '</p>';
    bind(root, api, notify);
  }
  function bind(root, api, notify) {
    const setStatus = (form, message, error = false) => { const node = $(form, "[data-status]"); if (node) { node.textContent = message; node.classList.toggle("error", error); } };
    root.querySelectorAll(".tracking-preset").forEach((button) => button.addEventListener("click", () => {
      if (busy) return;
      const form = button.closest("form"); const input = form && $(form, 'input[name="path"]'); if (!input) return;
      input.value = button.dataset.path; form.querySelectorAll(".tracking-preset").forEach((item) => item.setAttribute("aria-pressed", String(item === button)));
      setDirty(form);
      input.focus();
    }));
    const create = $(root, "[data-tracking-create]");
    root.querySelectorAll("[data-tracking-create], [data-tracking-edit]").forEach((form) => {
      const label = $(form, 'input[name="label"]')?.value || "";
      const path = $(form, 'input[name="path"]')?.value || "";
      form.dataset.initialLabel = label; form.dataset.initialPath = path;
      form.addEventListener("input", () => setDirty(form));
    });
    create?.addEventListener("submit", async (event) => {
      event.preventDefault(); const form = event.currentTarget; const data = Object.fromEntries(new FormData(form));
      if (!pathValid(data.path)) { setStatus(form, "Use um caminho interno do portfólio, sem query string.", true); return; }
      const button = form.querySelector('button[type="submit"]'); button.disabled = true; setStatus(form, "Criando…");
      const token = generation; setBusy(root, true);
      try { await api("/api/tracking/links", { method: "POST", body: { label: data.label.trim(), path: data.path.trim() } }); if (token === generation && active) notify?.("Link criado."); await refreshIfCurrent(api, root, notify, token); }
      catch (error) { if (token === generation && active) setStatus(form, error.message || "Não foi possível criar o link.", true); }
      finally { if (active && root.isConnected) setBusy(root, false); }
    });
    root.querySelectorAll("[data-copy-link]").forEach((button) => button.addEventListener("click", async () => {
      const cardRoot = button.closest("[data-tracking-id]"); const text = $(cardRoot, "code")?.textContent || "";
      try { await navigator.clipboard.writeText(text); button.textContent = "Copiado"; setTimeout(() => { if (button.isConnected) button.textContent = "Copiar"; }, 1400); } catch { window.prompt("Copie o link:", text); }
    }));
    root.querySelectorAll("[data-preview]").forEach((button) => button.addEventListener("click", () => { const cardRoot = button.closest("[data-tracking-id]"); const path = $(cardRoot, 'input[name="path"]')?.value || "/portfolio"; if (pathValid(path)) window.open(new URL(path, location.origin).href, "_blank", "noopener"); }));
    root.querySelectorAll("[data-tracking-edit]").forEach((form) => form.addEventListener("submit", async (event) => {
      event.preventDefault(); const cardRoot = form.closest("[data-tracking-id]"), id = cardRoot.dataset.trackingId, data = Object.fromEntries(new FormData(form));
      if (!pathValid(data.path)) { setStatus(form, "Use um caminho interno do portfólio, sem query string.", true); return; }
      setStatus(form, "Salvando…");
      const token = generation; setBusy(root, true);
      try { await api("/api/tracking/links", { method: "POST", body: { id, label: data.label.trim(), path: data.path.trim() } }); if (token === generation && active) notify?.("Link atualizado."); await refreshIfCurrent(api, root, notify, token); }
      catch (error) { if (token === generation && active) setStatus(form, error.message || "Não foi possível salvar.", true); }
      finally { if (active && root.isConnected) setBusy(root, false); }
    }));
    root.querySelectorAll("[data-toggle]").forEach((button) => button.addEventListener("click", async () => {
      if (busy) return;
      const cardRoot = button.closest("[data-tracking-id]"), form = $(cardRoot, "[data-tracking-edit]"), id = cardRoot.dataset.trackingId;
      const token = generation; setBusy(root, true);
      try { await api("/api/tracking/links", { method: "POST", body: { id, label: $(form, 'input[name="label"]').value.trim(), path: $(form, 'input[name="path"]').value.trim(), active: button.textContent.trim() === "Ativar" } }); await refreshIfCurrent(api, root, notify, token); }
      catch (error) { if (token === generation && active) setStatus(form, error.message || "Não foi possível alterar o estado.", true); }
      finally { if (active && root.isConnected) setBusy(root, false); }
    }));
    root.querySelectorAll("[data-delete]").forEach((button) => button.addEventListener("click", async () => {
      if (busy) return;
      const cardRoot = button.closest("[data-tracking-id]"), id = cardRoot.dataset.trackingId;
      if (!window.confirm("Excluir este link e seus dados de visitas?")) return;
      const token = generation; setBusy(root, true);
      try { await api("/api/tracking/links?id=" + encodeURIComponent(id), { method: "DELETE" }); if (token === generation && active) notify?.("Link excluído."); await refreshIfCurrent(api, root, notify, token); }
      catch (error) { if (token === generation && active) setStatus($(cardRoot, "form"), error.message || "Não foi possível excluir.", true); }
      finally { if (active && root.isConnected) setBusy(root, false); }
    }));
  }
  window.PortfolioTrackingAdmin = {
    render({ request, container, notify }) { active = true; busy = false; mountedContainer = container; return renderLinks(request, container, notify); },
    reset(container = mountedContainer) { active = false; generation += 1; busy = false; if (container) { container.classList.remove("tracking-root", "tracking-busy"); container.replaceChildren(); } mountedContainer = null; },
    hasDirty(container = mountedContainer) { return !!container?.querySelector(".tracking-dirty"); },
    isBusy() { return busy; }
  };
})();
