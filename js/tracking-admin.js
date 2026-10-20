(function() {
  "use strict";
  let generation = 0, active = false, busy = false, mounted = null, busyOwner = null;
  const esc = (v) => String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
  const $ = (r, s) => r.querySelector(s);
  const date = (v) => {
    if (!v) return "—";
    const d = new Date(v);
    return Number.isFinite(d.getTime()) ? new Intl.DateTimeFormat("pt-BR", { dateStyle: "medium", timeStyle: "short" }).format(d) : "—";
  };
  const count = (v) => Number(v || 0).toLocaleString("pt-BR");
  const pathValid = (v) => {
    const p = String(v || "");
    if (!p || p.trim() !== p || /[\u0000-\u001f\u007f\s\\?#%]/.test(p) || p.includes("..")) return false;
    return /^(?:\/$|\/portfolio$|\/audiovisuals$|\/music$|\/games$|\/about$|\/(?:video|game)\/[A-Za-z0-9_-]+$|\/audiovisual\/[A-Za-z0-9_-]+(?:\/[A-Za-z0-9_-]+)?)$/.test(p);
  };
  const codeValid = (v) => !v || /^[a-z0-9]{5,32}$/.test(String(v));
  const imageValid = (v) => {
    if (!v) return true;
    try {
      const u = new URL(String(v).trim());
      return (u.protocol === "http:" || u.protocol === "https:") && !u.username && !u.password && !/[\u0000-\u0020\u007f]/.test(u.href);
    } catch {
      return false;
    }
  };
  const messageOf = (l) => ({ title: l?.message?.title || "", text: l?.message?.text || "", image: l?.message?.image || "" });
  const destination = (l) => l?.code ? new URL("/" + encodeURIComponent(l.code), location.origin).href : new URL(l.path + (l.path.includes("?") ? "&" : "?") + "ref=" + encodeURIComponent(l.id), location.origin).href;
  const presetLabel = (p) => p === "/" ? "Página inicial" : { "/portfolio": "Portfolio", "/audiovisuals": "Audiovisuais", "/music": "Música", "/games": "Jogos" }[p] || p.slice(1);
  function presets(current) {
    return '<div class="tracking-presets" role="group" aria-label="Destinos rápidos">' + presetsList(current) + "</div>";
  }
  function presetsList(current) {
    return ["/", "/portfolio", "/audiovisuals", "/music", "/games"].map((p) => '<button type="button" class="secondary tracking-preset" data-path="' + p + '"' + (current === p ? ' aria-pressed="true"' : "") + ">" + presetLabel(p) + "</button>").join("");
  }
  function messageFields(m) {
    return '<fieldset class="tracking-message"><legend>Mensagem exclusiva (opcional)</legend><label>Título<input name="messageTitle" maxlength="120" value="' + esc(m.title) + '" placeholder="Uma mensagem para este convite"></label><label>Texto<textarea name="messageText" maxlength="3000" rows="3" placeholder="Texto mostrado ao visitante">' + esc(m.text) + '</textarea></label><label>Imagem por URL<input name="messageImage" maxlength="2000" inputmode="url" value="' + esc(m.image) + '" placeholder="https://…"><span class="tracking-help">Use uma imagem pública HTTP ou HTTPS.</span></label><label class="tracking-upload">Enviar imagem<input type="file" name="messageImageFile" data-message-image-file accept="image/*"><span class="tracking-help" data-upload-status></span></label></fieldset>';
  }
  function notifyField(link, create) {
    return '<label class="tracking-check"><input type="checkbox" name="notify"' + (create || link.notify !== false ? " checked" : "") + "> Enviar acessos ao Discord</label>";
  }
  function card(l) {
    const m = messageOf(l), image = m.image && imageValid(m.image) ? '<img class="tracking-message-image" src="' + esc(m.image) + '" alt="" loading="lazy" data-message-preview>' : "";
    return '<article class="tracking-card" data-tracking-id="' + esc(l.id) + '"><div class="tracking-card-head"><div><h3>' + esc(l.label || "Sem nome") + '</h3><p class="tracking-path">' + esc(l.path) + (l.code ? " · <strong>/" + esc(l.code) + "</strong>" : " · link legado") + '</p></div><span class="tracking-state ' + (l.active === false ? "paused" : "active") + '">' + (l.active === false ? "Pausado" : "Ativo") + '</span></div><div class="tracking-stats"><div><strong>' + (l.statsTruncated ? "≥" : "") + count(l.visits) + "</strong><span>visitas</span></div><div><strong>" + date(l.firstVisitAt) + "</strong><span>primeira visita</span></div><div><strong>" + date(l.lastVisitAt) + "</strong><span>última visita</span></div></div>" + (m.title || m.text || image ? '<div class="tracking-message-preview">' + image + "<div><strong>" + esc(m.title) + "</strong><p>" + esc(m.text) + "</p></div></div>" : "") + '<p class="tracking-url"><code>' + esc(destination(l)) + '</code><button type="button" class="secondary" data-copy-link>Copiar</button></p><details class="tracking-edit-details"><summary><span>Editar link</span><span class="tracking-summary-meta">' + esc(l.code ? "/" + l.code : l.path) + '</span></summary><form class="tracking-edit" data-tracking-edit><div class="tracking-edit-fields"><label>Nome interno<input name="label" value="' + esc(l.label) + '" required maxlength="80"></label><label>Destino<input name="path" value="' + esc(l.path) + '" required maxlength="180"></label><label>Código curto<input name="code" value="' + esc(l.code || "") + '" minlength="5" maxlength="32" pattern="[a-z0-9]{5,32}" placeholder="automático (5–32 letras/números)"></label></div>' + presets(l.path) + '<details class="tracking-advanced"><summary>Mensagem exclusiva (opcional)</summary>' + messageFields(m) + '</details>' + notifyField(l, false) + '<div class="tracking-actions"><button type="submit">Salvar</button><button type="button" class="secondary" data-preview>Pré-visualizar</button><button type="button" class="secondary" data-visit-details>Ver acessos</button><button type="button" class="secondary" data-toggle>' + (l.active === false ? "Ativar" : "Pausar") + '</button><button type="button" class="danger" data-delete>Excluir</button><span class="status" data-status role="status"></span></div><div class="tracking-visits" data-visits-list hidden></div></form></details></article>';
  }
  function createMarkup() {
    return '<section class="tracking-create"><div class="tracking-create-head"><div><p class="eyebrow">NOVO LINK</p><h2>Criar convite</h2></div><span class="tracking-create-hint">Nome e destino são obrigatórios.</span></div><form data-tracking-create><div class="tracking-create-fields"><label>Nome interno<input name="label" required maxlength="80" placeholder="Publisher — apresentação outubro"></label><label>Destino<input name="path" required maxlength="180" value="/portfolio" placeholder="/portfolio"></label><label>Código curto <span class="tracking-label-note">opcional</span><input name="code" minlength="5" maxlength="32" pattern="[a-z0-9]{5,32}" placeholder="ex.: ka3tv"></label></div>' + presets("/portfolio") + '<details class="tracking-advanced"><summary>Mensagem, imagem e notificações (opcional)</summary>' + messageFields({}) + notifyField(null, true) + '</details><div class="tracking-actions"><button type="submit">Criar link</button><span class="status" data-status role="status"></span></div></form></section>';
  }
  function settingsMarkup() {
    return '<details class="tracking-settings"><summary><span><span class="eyebrow">DISCORD</span><strong>Notificações de acessos</strong></span><span class="tracking-webhook-state" data-webhook-state>Carregando status…</span></summary><form data-webhook-settings><p class="tracking-settings-help">Receba data, IP e dispositivo dos acessos feitos por convites rastreáveis.</p><p class="tracking-delivery" data-webhook-delivery></p><label>URL do webhook<input type="password" name="webhookUrl" autocomplete="new-password" placeholder="Cole uma nova URL para substituir a atual"></label><label class="tracking-check"><input type="checkbox" name="enabled" checked> Ativar notificações</label><div class="tracking-actions"><button type="submit">Salvar configuração</button><button type="button" class="secondary" data-webhook-test>Testar</button><button type="button" class="danger" data-webhook-remove>Remover webhook</button><span class="status" data-status role="status"></span></div></form></details>';
  }
  const fields = ["label", "path", "code", "messageTitle", "messageText", "messageImage", "notify", "webhookUrl", "enabled"];
  function fieldState(form) {
    return fields.map((n) => {
      const e = $(form, '[name="' + n + '"]');
      return e?.type === "checkbox" ? String(e.checked) : e?.value || "";
    }).join("");
  }
  function dirty(form) {
    form?.classList.toggle("tracking-dirty", form.dataset.initialFields !== fieldState(form));
  }
  const deliveryReason = (value) => ({ "missing-config": "webhook não configurado ou pausado", "invalid-payload": "Discord recusou o conteúdo", "invalid-or-revoked-webhook": "webhook inválido ou revogado", "webhook-forbidden": "Discord recusou a permissão", "rate-limited": "Discord limitou o envio", "network-error": "falha de rede", timeout: "tempo de envio esgotado", "webhook-http-error": "Discord recusou o envio", "discord-server-error": "Discord indisponível" }[String(value || "").toLowerCase()] || "falha não detalhada");
  const deliveryText = (delivery) => {
    if (!delivery?.status) return "";
    const when = date(delivery.at);
    if (delivery.status === "sent") return "Último envio: " + when;
    if (delivery.status === "failed") return "Último envio falhou: " + when + " · " + deliveryReason(delivery.reason || delivery.error || delivery.code);
    return "";
  };
  function applySettings(f, v) {
    const configured = !!v?.configured;
    f.dataset.configured = String(configured);
    const enabled = configured ? v?.enabled !== false : v?.defaultEnabled === true;
    $(f, '[name="enabled"]').checked = enabled;
    f.dataset.initialFields = fieldState(f);
    const summary = $(f.closest(".tracking-settings"), "[data-webhook-state]");
    if (summary) summary.textContent = configured ? (enabled ? "Configurado · ativo" : "Configurado · pausado") : "Não configurado";
    const delivery = $(f, "[data-webhook-delivery]");
    if (delivery) delivery.textContent = deliveryText(v?.delivery);
  }
  function busyState(root, value, owner = generation) {
    if (!value && busyOwner !== owner) return;
    busyOwner = value ? owner : null;
    busy = value;
    root.classList.toggle("tracking-busy", value);
    root.querySelectorAll("button,input,textarea").forEach((e) => e.disabled = value);
  }
  async function refresh(api, root, notify, token, upload) {
    if (token === generation && active) await renderLinks(api, root, notify, upload);
  }
  async function renderSettings(api, root, token) {
    const f = $(root, "[data-webhook-settings]");
    if (!f) return;
    f.inert = true;
    try {
      const v = await api("/api/tracking/settings");
      if (token !== generation || !active || !f.isConnected) return;
      const state = $(f, "[data-status]");
      applySettings(f, { ...v, defaultEnabled: true });
      if (state) state.textContent = v?.configured ? (v?.enabled === false ? "Configurado · pausado" : "Configurado · ativo") : "Nenhum webhook configurado.";
    } catch (e) {
      if (token !== generation || !active || !f.isConnected) return;
      $(f, "[data-status]").textContent = e.status === 404 ? "Recurso de webhook indisponível no Worker atual." : e.message || "Não foi possível carregar a configuração.";
    } finally {
      if (token === generation && active && f.isConnected) f.inert = false;
    }
  }
  async function renderLinks(api, root, notify, upload) {
    const token = ++generation;
    if (!active) return;
    root.classList.add("tracking-root");
    root.innerHTML = '<div class="state">Carregando links…</div>';
    let payload;
    try {
      payload = await api("/api/tracking/links");
    } catch (e) {
      if (token !== generation || !active) return;
      root.innerHTML = '<div class="state">' + (e.status === 404 ? "O Worker ainda não possui o recurso de links rastreáveis. Atualize o Worker antes de usar esta aba." : esc(e.message || "Não foi possível carregar os links.")) + "</div>";
      return;
    }
    if (token !== generation || !active) return;
    const links = Array.isArray(payload?.links) ? payload.links : [];
    root.innerHTML = '<div class="tracking-heading"><div><p class="eyebrow">VISITAS AO PORTFÓLIO</p><h2>Links rastreáveis</h2><p class="muted">Acompanhe acessos vindos dos seus emails. Isso registra visita ao site; não confirma que o email foi aberto.</p></div><span class="tracking-retention">Dados dos últimos ' + esc(payload?.retentionDays || 90) + " dias</span></div>" + createMarkup() + settingsMarkup() + '<div class="tracking-list" aria-live="polite">' + (links.length ? links.map(card).join("") : '<div class="tracking-empty"><h3>Nenhum link criado</h3><p>Crie um link para cada publisher ou email. O contador registra visitas ao portfólio por 90 dias.</p></div>') + '</div><p class="tracking-note">Pré-visualizações, scanners de segurança e bloqueadores podem gerar ou esconder visitas. Acessos por convite registram IP e dispositivo por 90 dias. A visita não confirma abertura de email.</p>';
    if (busy) root.querySelectorAll("button,input,textarea").forEach(control => control.disabled = true);
    bind(root, api, notify, upload);
    await renderSettings(api, root, token);
  }
  function message(form) {
    return { title: $(form, '[name="messageTitle"]')?.value.trim() || "", text: $(form, '[name="messageText"]')?.value.trim() || "", image: $(form, '[name="messageImage"]')?.value.trim() || "" };
  }
  function status(form, text, error) {
    const n = $(form, "[data-status]");
    if (n) {
      n.textContent = text;
      n.classList.toggle("error", !!error);
    }
  }
  function bind(root, api, notify, upload) {
    root.querySelectorAll(".tracking-preset").forEach((b) => b.addEventListener("click", () => {
      if (busy) return;
      const f = b.closest("form"), i = f && $(f, '[name="path"]');
      if (!i) return;
      i.value = b.dataset.path;
      f.querySelectorAll(".tracking-preset").forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
      dirty(f);
      i.focus();
    }));
    root.querySelectorAll("[data-message-preview]").forEach((image) => image.addEventListener("error", () => {
      image.hidden = true;
    }));
    root.querySelectorAll("[data-tracking-create],[data-tracking-edit]").forEach((f) => {
      f.dataset.initialFields = fieldState(f);
      f.addEventListener("input", () => dirty(f));
      f.addEventListener("change", () => dirty(f));
    });
    root.querySelectorAll("[data-message-image-file]").forEach((input) => input.addEventListener("change", async () => {
      if (!upload || !input.files?.[0] || busy) return;
      const form = input.closest("form"), help = $(input.closest("label"), "[data-upload-status]"), token = generation;
      if (help) help.textContent = "Enviando…";
      busyState(root, true);
      try {
        const result = await upload(input.files[0], "banner");
        const url = typeof result === "string" ? result : result?.url || result?.secure_url || result?.path || "";
        if (!imageValid(url)) throw new Error("O upload não retornou uma URL válida.");
        if (token !== generation || !active || !form.isConnected) return;
        const image = $(form, '[name="messageImage"]');
        image.value = url;
        dirty(form);
        if (help) help.textContent = "Imagem enviada.";
      } catch (error) {
        if (token === generation && active && help) help.textContent = error.message || "Não foi possível enviar a imagem.";
      } finally {
        input.value = "";
        if (active && root.isConnected) busyState(root, false, token);
      }
    }));
    const submit = async (event, editing) => {
      event.preventDefault();
      const f = event.currentTarget, d = Object.fromEntries(new FormData(f)), m = message(f);
      if (!pathValid(d.path)) return status(f, "Use um caminho interno do portfólio, sem query string.", true);
      if (!codeValid(d.code)) return status(f, "O código deve ter 5–32 caracteres minúsculos (letras e números).", true);
      if (!imageValid(m.image)) return status(f, "A imagem deve usar uma URL HTTP ou HTTPS válida.", true);
      const body = { label: d.label.trim(), path: d.path.trim(), ...d.code ? { code: d.code } : {}, message: m, notify: d.notify === "on" };
      if (editing) body.id = f.closest("[data-tracking-id]").dataset.trackingId;
      status(f, editing ? "Salvando…" : "Criando…");
      const token = generation;
      busyState(root, true);
      try {
        await api("/api/tracking/links", { method: "POST", body });
        if (token === generation && active) notify?.(editing ? "Link atualizado." : "Link criado.");
        await refresh(api, root, notify, token, upload);
      } catch (e) {
        if (token === generation && active) status(f, e.message || "Não foi possível salvar.", true);
      } finally {
        if (active && root.isConnected) busyState(root, false, token);
      }
    };
    $(root, "[data-tracking-create]")?.addEventListener("submit", (e) => submit(e, false));
    root.querySelectorAll("[data-tracking-edit]").forEach((f) => f.addEventListener("submit", (e) => submit(e, true)));
    root.querySelectorAll("[data-copy-link]").forEach((b) => b.addEventListener("click", async () => {
      const text = $(b.closest("[data-tracking-id]"), "code")?.textContent || "";
      try {
        await navigator.clipboard.writeText(text);
        b.textContent = "Copiado";
        setTimeout(() => {
          if (b.isConnected) b.textContent = "Copiar";
        }, 1400);
      } catch {
        window.prompt("Copie o link:", text);
      }
    }));
    root.querySelectorAll("[data-preview]").forEach((b) => b.addEventListener("click", () => {
      const f = $(b.closest("[data-tracking-id]"), "[data-tracking-edit]"), p = $(f, '[name="path"]').value;
      if (pathValid(p)) window.open(new URL(p, location.origin).href, "_blank", "noopener");
    }));
    root.querySelectorAll("[data-toggle]").forEach((b) => b.addEventListener("click", async () => {
      if (busy) return;
      const card2 = b.closest("[data-tracking-id]"), f = $(card2, "form"), token = generation;
      busyState(root, true);
      try {
        await api("/api/tracking/links", { method: "POST", body: { id: card2.dataset.trackingId, active: b.textContent.trim() === "Ativar" } });
        await refresh(api, root, notify, token, upload);
      } catch (e) {
        status(f, e.message || "Não foi possível alterar o estado.", true);
      } finally {
        if (active && root.isConnected) busyState(root, false, token);
      }
    }));
    root.querySelectorAll("[data-delete]").forEach((b) => b.addEventListener("click", async () => {
      if (busy || !window.confirm("Excluir este link e seus dados de visitas?")) return;
      const card2 = b.closest("[data-tracking-id]"), token = generation;
      busyState(root, true);
      try {
        await api("/api/tracking/links?id=" + encodeURIComponent(card2.dataset.trackingId), { method: "DELETE" });
        notify?.("Link excluído.");
        await refresh(api, root, notify, token, upload);
      } catch (e) {
        status($(card2, "form"), e.message || "Não foi possível excluir.", true);
      } finally {
        if (active && root.isConnected) busyState(root, false, token);
      }
    }));
    root.querySelectorAll("[data-visit-details]").forEach((b) => b.addEventListener("click", async () => {
      const card2 = b.closest("[data-tracking-id]"), list = $(card2, "[data-visits-list]");
      if (!list.hidden) {
        list.hidden = true;
        return;
      }
      list.hidden = false;
      list.innerHTML = '<span class="muted">Carregando acessos…</span>';
      try {
        const v = await api("/api/tracking/visits?id=" + encodeURIComponent(card2.dataset.trackingId)), visits = Array.isArray(v?.visits) ? v.visits.slice(0, 20) : [];
        list.innerHTML = visits.length ? visits.map((x) => '<div class="tracking-visit"><strong>' + esc(date(x.at)) + "</strong><span>" + esc([x.ip, x.device, x.browser, x.os, x.city, x.country].filter(Boolean).join(" · ") || "Detalhes indisponíveis") + "</span></div>").join("") : '<span class="muted">Nenhum acesso detalhado disponível.</span>';
      } catch (e) {
        list.innerHTML = '<span class="status error">' + esc(e.status === 404 ? "O Worker ainda não oferece detalhes de acessos." : e.message || "Não foi possível carregar os acessos.") + "</span>";
      }
    }));
    const settings = $(root, "[data-webhook-settings]");
    if (settings) {
      settings.dataset.initialFields = fieldState(settings);
      settings.addEventListener("input", () => dirty(settings));
      settings.addEventListener("change", () => dirty(settings));
    }
    settings?.addEventListener("submit", async (e) => {
      e.preventDefault();
      const f = e.currentTarget, v = $(f, '[name="webhookUrl"]').value.trim();
      status(f, "Salvando…");
      const token = generation;
      busyState(root, true);
      try {
        const freshUrl = !!v;
        const enabled = freshUrl && f.dataset.configured !== "true" ? true : $(f, '[name="enabled"]').checked;
        const result = await api("/api/tracking/settings", { method: "POST", body: { ...v ? { webhookUrl: v } : {}, enabled } });
        if (token !== generation || !active || !f.isConnected) return;
        applySettings(f, { ...(result?.settings || result || {}), configured: result?.configured ?? result?.settings?.configured ?? true, enabled: result?.enabled ?? result?.settings?.enabled ?? enabled });
        $(f, '[name="enabled"]').checked = enabled;
        $(f, '[name="webhookUrl"]').value = "";
        f.dataset.initialFields = fieldState(f);
        status(f, "Configuração salva. A URL permanece oculta.");
      } catch (x) {
        if (token === generation && active) status(f, x.message || "Não foi possível salvar.", true);
      } finally {
        if (active && root.isConnected) busyState(root, false, token);
      }
    });
    $(root, "[data-webhook-test]")?.addEventListener("click", async () => {
      if (busy) return;
      status(settings, "Enviando teste…");
      const token = generation;
      busyState(root, true);
      try {
        const result = await api("/api/tracking/webhook/test", { method: "POST", body: {} });
        let diagnostics;
        try { diagnostics = await api("/api/tracking/settings"); } catch {}
        if (token === generation && active && settings.isConnected) {
          if (diagnostics) applySettings(settings, diagnostics);
          else if (result?.delivery) applySettings(settings, { configured: settings.dataset.configured === "true", enabled: $(settings, '[name="enabled"]').checked, delivery: result.delivery });
          status(settings, "Teste enviado.");
        }
      } catch (e) {
        const errorText = e.message || "Não foi possível testar o webhook.";
        if (token === generation && active && settings.isConnected) status(settings, errorText, true);
        try {
          const diagnostics = await api("/api/tracking/settings");
          if (token === generation && active && settings.isConnected) {
            applySettings(settings, diagnostics);
            status(settings, errorText, true);
          }
        } catch {}
      } finally {
        if (active && root.isConnected) busyState(root, false, token);
      }
    });
    $(root, "[data-webhook-remove]")?.addEventListener("click", async () => {
      if (busy) return;
      status(settings, "Removendo…");
      const token = generation;
      busyState(root, true);
      try {
        const result = await api("/api/tracking/settings", { method: "POST", body: { webhookUrl: "", enabled: false } });
        if (token !== generation || !active || !settings.isConnected) return;
        $(settings, '[name="webhookUrl"]').value = "";
        applySettings(settings, { ...(result?.settings || result || {}), configured: false, enabled: false, delivery: null });
        if (token === generation && active) status(settings, "Webhook removido.");
      } catch (e) {
        if (token === generation && active) status(settings, e.message || "Não foi possível remover o webhook.", true);
      } finally {
        if (active && root.isConnected) busyState(root, false, token);
      }
    });
  }
  window.PortfolioTrackingAdmin = { render({ request, container, notify, upload }) {
    active = true;
    busy = false;
    mounted = container;
    busyOwner = null;
    return renderLinks(request, container, notify, upload);
  }, reset(container = mounted) {
    active = false;
    generation++;
    busy = false;
    busyOwner = null;
    if (container) {
      container.classList.remove("tracking-root", "tracking-busy");
      container.replaceChildren();
    }
    mounted = null;
  }, hasDirty(container = mounted) {
    return !!container?.querySelector(".tracking-dirty");
  }, isBusy() {
    return busy;
  } };
})();
